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


def run(*args):
    return subprocess.run([PY, "-X", "utf8", *args], cwd=HERE, capture_output=True, text=True)


def record_summary(led):
    graded = [i for i in led.get("items", []) if i.get("result") in ("correct", "wrong")]
    won = sum(1 for i in graded if i["result"] == "correct")
    units = round(sum(i.get("profitUnits") or 0 for i in graded), 2)
    n = len(graded)
    return {
        "graded": n, "correct": won, "wrong": n - won,
        "accuracy": round(won / n, 4) if n else None,
        "units": units,
        "rolling": round(sum(1 for i in graded[-50:] if i["result"] == "correct") / max(1, len(graded[-50:])), 4) if graded else None,
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
        fresh = [p for p in raw["picks"] if p["gameId"] not in have]
        # dopamine board: show the strongest reads, not everything
        fresh.sort(key=lambda p: -p["edgePct"])
        cap = int(os.environ.get("PICK_CAP", "15"))
        fresh = fresh[:max(0, cap - sum(1 for i in led["items"] if not i.get("result")))]
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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
