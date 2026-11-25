"""
Tune the model's own settings from how it actually did.

Every settled pick carries the probability the model claimed, the price, and
whether it won. That is enough to ask two questions no fixed constant can:

  1. CALIBRATION — when the model says 75%, does it win 75%? A model running
     hot on a sport gets treated as if it had said less.
  2. GATE LEVEL — does the 70% floor actually earn? If the sport's picks lose
     money at the price taken, the floor for that sport should come up.

Result is a per-sport confidence scale and floor in engine/tuned.json, read by
model.py. Learning from outcomes, not from opinion — this is the loop that makes
the thing better instead of merely bigger.

Usage:
  python learn.py                     # tune from the ledger
  python learn.py --report            # show what it would change, save nothing
"""
import argparse, datetime, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
LEDGER = os.path.join(DATA, "ledger.json")
OUT = os.path.join(HERE, "tuned.json")

MIN_N = 20            # a sport needs this many settled picks before it is tuned
SHRINK = 40           # pull small samples toward the global picture
DEFAULT_SCALE = 1.0
MAX_SCALE = 1.35      # never demand more than 35% extra conviction
MIN_SCALE = 0.85     # never loosen more than 15%
DEFAULT_FLOOR = 0.70
FLOOR_STEP = 0.02
MAX_FLOOR = 0.80


def load_ledger():
    try:
        return json.load(open(LEDGER))["items"]
    except Exception:
        return []


def settled(items):
    return [
        i for i in items
        if i.get("result") in ("correct", "wrong")
        and isinstance(i.get("modelProb"), (int, float))
        and isinstance(i.get("price"), (int, float))
    ]


def bands(items):
    """Claimed-probability bands -> (picks, actually won, price break-even)."""
    out = {}
    for i in items:
        b = min(0.95, max(0.50, round(i["modelProb"] * 20) / 20))  # 5% buckets
        d = out.setdefault(b, {"n": 0, "w": 0, "be": 0.0})
        d["n"] += 1
        d["w"] += i["result"] == "correct"
        d["be"] += 1.0 / i["price"]          # the rate needed to profit
    return out


def calibrate(items):
    """Shrink each band's realised rate toward its own claim, then fit a single
    multiplier so claimed*p fits what was won. Overconfident -> scale < 1."""
    b = bands(items)
    num = den = 0.0
    for claim, d in b.items():
        if d["n"] < 5:
            continue
        # empirical-Bayes style: blend the sample with the claim by sample size
        w = d["n"] / (d["n"] + SHRINK)
        realised = w * (d["w"] / d["n"]) + (1 - w) * claim
        num += realised * d["n"]
        den += claim * d["n"]
    if not den:
        return DEFAULT_SCALE
    scale = num / den
    return round(min(MAX_SCALE, max(MIN_SCALE, scale)), 3)


def floor_for(items):
    """Raise the floor while picks at the top of the book lose money.
    A floor only earns if the higher band clears its break-even rate."""
    b = bands(items)
    floor = DEFAULT_FLOOR
    for claim in sorted(b):                    # walk up while the cheap band earns
        d = b[claim]
        if claim < floor or d["n"] < 5:
            continue
        needed = d["be"] / d["n"]              # break-even rate for this band
        if d["w"] / d["n"] < needed and floor + FLOOR_STEP <= MAX_FLOOR:
            floor = round(floor + FLOOR_STEP, 3)
    return floor


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true")
    a = ap.parse_args()

    items = settled(load_ledger())
    per = {}
    for i in items:
        per.setdefault(i.get("sport") or "other", []).append(i)
    global_items = [i for i in items if i.get("sport") in per]

    tuned = {"updatedAt": datetime.datetime.now(datetime.UTC).isoformat(),
             "sports": {}, "global": {}}
    if len(global_items) >= MIN_N:
        tuned["global"] = {"scale": calibrate(global_items),
                           "floor": floor_for(global_items),
                           "n": len(global_items)}

    for sport, rows in per.items():
        if len(rows) < MIN_N:
            tuned["sports"][sport] = {"scale": None, "floor": None, "n": len(rows),
                                      "note": "inherits global"}
            continue
        tuned["sports"][sport] = {"scale": calibrate(rows), "floor": floor_for(rows),
                                  "n": len(rows)}

    print(json.dumps(tuned, indent=1))
    if a.report:
        return
    json.dump(tuned, open(OUT, "w"), indent=1)
    print(f"wrote {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
