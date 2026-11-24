"""
TipLab cycle — one full pass: grade yesterday's picks, learn, publish new picks,
and rewrite the public state the site renders.

  python cycle.py            # grade + publish
  python cycle.py --grade    # grade only
  python cycle.py --publish  # publish only

Writes into ./data/ : games.json, picks.json, record.json, state.json
"""
import argparse, datetime, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
LEDGER = os.path.join(DATA, "ledger.json")
PY = sys.executable


def load_env():
    p = os.path.join(HERE, ".env")
    if os.path.exists(p):
        for line in open(p):
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k, v)


load_env()


def run(*args):
    return subprocess.run([PY, "-X", "utf8", *args], cwd=HERE, capture_output=True, text=True)


def record_summary(led):
    bt_path = os.path.join(DATA, "backtest.json")
    bt = []
    if os.path.exists(bt_path):
        try:
            bt = json.load(open(bt_path)).get("items", [])
        except Exception:
            bt = []
    merged = bt + led.get("items", [])
    graded = [i for i in merged if i.get("result") in ("correct", "wrong")]
    won = sum(1 for i in graded if i["result"] == "correct")
    units = round(sum(i.get("profitUnits") or 0 for i in graded), 2)
    n = len(graded)
    last = graded[-50:]
    return {
        "graded": n, "correct": won, "wrong": n - won,
        "accuracy": round(won / n, 4) if n else None,
        "units": units,
        "rolling": round(sum(1 for i in last if i["result"] == "correct") / max(1, len(last)), 4) if last else None,
        "recent": list(reversed(graded[-25:])),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--grade", action="store_true")
    ap.add_argument("--publish", action="store_true")
    a = ap.parse_args()
    do_all = not (a.grade or a.publish)
    os.makedirs(DATA, exist_ok=True)

    if do_all or a.grade:
        if os.path.exists(LEDGER):
            r = run("grade.py", "--ledger", LEDGER, "--state", LEDGER)
            print(r.stdout, r.stderr, sep="", file=sys.stderr)
        # premium live board: in-play get-in / exit signals on open picks
        r = run("live.py", "--ledger", LEDGER, "--out", os.path.join(DATA, "live.json"))
        print(r.stdout, r.stderr, sep="", file=sys.stderr)
    if do_all or a.publish:
        gpath = os.path.join(DATA, "games.json")
        r = run("collector.py", "--out", gpath)
        if r.returncode:
            print("collect failed", r.stderr, file=sys.stderr)
            return 1
        r = run("model.py", "--games", gpath, "--out", os.path.join(DATA, "raw_picks.json"))
        if r.returncode:
            print("model failed", r.stderr, file=sys.stderr)
            return 1
        raw = json.load(open(os.path.join(DATA, "raw_picks.json")))
        led = json.load(open(LEDGER)) if os.path.exists(LEDGER) else {"items": []}
        led.setdefault("items", [])
        have = {i["gameId"] for i in led["items"]}
        now = datetime.datetime.now(datetime.UTC)

        def not_started(p):
            """A pick is only honest if it locks before kickoff."""
            try:
                st = datetime.datetime.fromisoformat(p["startsAt"].replace("Z", "+00:00"))
                return st > now
            except Exception:
                return True
        fresh = [p for p in raw["picks"] if p["gameId"] not in have and not_started(p)]
        fresh.sort(key=lambda p: -p["edgePct"])
        # dopamine board: strongest reads, but no single sport may own the whole
        # board — a per-sport ceiling keeps tennis and esports visible. Picks
        # still open but past their start time grade late, so slot recovery waits
        # for the grader; the sports ceiling below is what frees space early.
        cap = int(os.environ.get("PICK_CAP", "18"))
        per_sport = int(os.environ.get("PICK_PER_SPORT", "5"))
        slots = max(0, cap - sum(1 for i in led["items"] if not i.get("result")))
        # guarantee each tracked sport at least one slot when it has a candidate
        sports_on = {i["sport"] for i in led["items"] if not i.get("result")}
        want = [p for p in fresh if p["sport"] not in sports_on]
        chosen, seen = [], {}
        for p in want:
            if len(chosen) >= min(2, slots):
                break
            chosen.append(p)
            seen[p["sport"]] = 1
        for p in fresh:
            if len(chosen) >= slots:
                break
            n = seen.get(p["sport"], 0)
            if n >= per_sport:
                continue
            seen[p["sport"]] = n + 1
            chosen.append(p)
        fresh = chosen
        for p in fresh:
            if p["gameId"] not in have:
                p["lockTs"] = datetime.datetime.now(datetime.UTC).isoformat()
                p["result"] = None
                p["profitUnits"] = None
                led["items"].append(p)
        json.dump(led, open(LEDGER, "w"), indent=1)
        json.dump({"generatedAt": datetime.datetime.now(datetime.UTC).isoformat(),
                   "picks": [i for i in led["items"] if not i.get("result")],
                   "alerts": raw["alerts"],
                   "record": record_summary(led)},
                  open(os.path.join(DATA, "state.json"), "w"), indent=1)
        print(f"state: {len(led['items'])} total, "
              f"{sum(1 for i in led['items'] if not i.get('result'))} open picks", file=sys.stderr)
        # push the fresh data to the live site
        if os.environ.get("VERCEL_TOKEN"):
            r = run("publish.py")
            print("deploy:", (r.stdout or r.stderr).strip()[-80:], file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
