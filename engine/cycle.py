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
BOARD_WINDOW_H = int(os.environ.get("BOARD_WINDOW_H", "72"))  # how far ahead a pick may be published


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
    graded = [i for i in merged if i.get("result") in ("correct", "wrong", "push")]
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
    ap.add_argument("--live", action="store_true")
    a = ap.parse_args()
    do_all = not (a.grade or a.publish or a.live)
    os.makedirs(DATA, exist_ok=True)

    # grade first so live signals only ever describe still-open picks
    if do_all or a.grade:
        if os.path.exists(LEDGER):
            r = run("grade.py", "--ledger", LEDGER, "--state", LEDGER)
            print(r.stdout, r.stderr, sep="", file=sys.stderr)
        if a.grade:
            return 0
    if do_all or a.live:
        r = run("live.py", "--ledger", LEDGER, "--out", os.path.join(DATA, "live.json"))
        print(r.stdout, r.stderr, sep="", file=sys.stderr)
        if a.live:
            # signals only, but they still have to reach the live site
            if os.environ.get("VERCEL_TOKEN"):
                r = run("publish.py", "--live")
                print("deploy:", (r.stdout or r.stderr).strip()[-80:], file=sys.stderr)
            return 0
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

        def in_window(p):
            """Only board games the site actually renders. Anything further out
            than the 48h tab window would squat on a slot invisibly."""
            try:
                st = datetime.datetime.fromisoformat(p["startsAt"].replace("Z", "+00:00"))
                return (st - now).total_seconds() <= BOARD_WINDOW_H * 3600
            except Exception:
                return False

        fresh = [p for p in raw["picks"] if p["gameId"] not in have and not_started(p) and in_window(p)]
        fresh.sort(key=lambda p: -p["edgePct"])
        # board: strongest reads, but no single sport may own the whole board. The
        # cap is on the live board, not on additions — the inside of a window can
        # change between scans, so additions alone can't hold the total.
        cap = int(os.environ.get("PICK_CAP", "18"))
        per_sport = int(os.environ.get("PICK_PER_SPORT", "5"))
        visible = [i for i in led["items"] if not i.get("result") and in_window(i) and not_started(i)]
        slots = max(0, cap - len(visible))
        seen = {}
        for i in visible:
            seen[i["sport"]] = seen.get(i["sport"], 0) + 1
        chosen, picked = [], set()
        # guarantee each sport with no pick on the board gets one when it has a candidate
        for p in [p for p in fresh if p["sport"] not in seen][:2]:
            if len(chosen) >= slots:
                break
            chosen.append(p)
            picked.add(p["gameId"])
            seen[p["sport"]] = 1
        # then fill by edge; the same pick must not be chosen twice
        for p in fresh:
            if len(chosen) >= slots:
                break
            if p["gameId"] in picked:
                continue
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
        commit_data()
    return 0


def commit_data():
    """Commit the regenerated data. Only when this machine is the runner — CI
    already commits its own run, and a commit here would collide with it."""
    if os.environ.get("GITHUB_ACTIONS"):
        return
    repo = os.path.dirname(HERE)
    try:
        changed = subprocess.run(
            ["git", "status", "--porcelain", "data"], cwd=repo,
            capture_output=True, text=True, timeout=60,
        ).stdout.strip()
        if not changed:
            return
        subprocess.run(["git", "add", "data"], cwd=repo, timeout=60)
        subprocess.run(
            ["git", "commit", "-q", "-m",
             f"data: cycle {datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%dT%H:%MZ')}"],
            cwd=repo, timeout=60,
        )
    except Exception as e:
        print("data commit skipped:", e, file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
