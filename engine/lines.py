"""
Line-movement memory.

The collector is stateless: every cycle rewrites games.json with only the
*current* prices, so a price that drifted from 1.85 to 1.62 looks identical to
one that opened at 1.62. But drift is exactly what the integrity feature needs
— a line steaming toward the favourite is the market confirming; a line
collapsing against it is the classic "something's wrong" tell.

lines.py keeps a small rolling history (last 8 snapshots per game, 7-day
retention) in data/line_history.json. model.py snapshots every cycle before
evaluating, and integrity() consults movement() to flag real drift.

Usage (from model.py, not standalone):
  lines.snapshot(games)   # record current prices
  lines.movement(g)       # {n, first, now, drift} or None
"""
import datetime, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
HIST = os.path.join(HERE, "..", "data", "line_history.json")
KEEP = 8                 # snapshots retained per game
RETENTION_H = 24 * 7     # and no longer than a week
# relative price change counted as real movement (1.50 -> 1.38 is 8%)
SIGNIFICANT = 0.08
WINDOW_H = 72            # compare against the oldest snapshot inside this window


def _load():
    try:
        return json.load(open(HIST))
    except Exception:
        return {}


def _save(h):
    try:
        json.dump(h, open(HIST, "w"))
    except Exception:
        pass


def _price(g):
    m = (g.get("markets") or {}).get("h2h")
    if not m:
        return None
    try:
        fav, other = float(m["bestOdds"]), float(m.get("otherOdds") or 0)
    except (TypeError, ValueError):
        return None
    return (fav, other) if other > 1 else (fav, None)


def snapshot(games):
    """Record this cycle's prices. Runs before evaluation so the same cycle can
    already compare against history."""
    h = _load()
    now = datetime.datetime.now(datetime.UTC).isoformat()
    cutoff = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=RETENTION_H)
    alive = {g["id"] for g in games}
    for gid, rows in list(h.items()):
        if gid not in alive:
            del h[gid]
            continue
        h[gid] = [r for r in rows
                  if datetime.datetime.fromisoformat(r[0]) > cutoff][-KEEP:]
    for g in games:
        p = _price(g)
        if not p:
            continue
        rows = h.setdefault(g["id"], [])
        if rows and rows[-1][1] == p[0] and rows[-1][2] == p[1]:
            rows[-1][0] = now          # same price: refresh the stamp, no new row
        else:
            rows.append([now, p[0], p[1]])
            del rows[:-KEEP]
    _save(h)


def movement(g):
    """Drift for one game: current price vs the oldest snapshot inside the
    window. Positive drift = steaming toward the favourite (price shortening)."""
    h = _load()
    rows = h.get(g["id"]) or []
    if len(rows) < 2:
        return None
    cur = _price(g)
    if not cur:
        return None
    cutoff = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=WINDOW_H)
    old = next((r for r in rows if datetime.datetime.fromisoformat(r[0]) > cutoff), None)
    if not old or old[1] <= 1 or cur[0] <= 1:
        return None
    drift = old[1] / cur[0] - 1        # +ve: favourite price shortened
    if abs(drift) < SIGNIFICANT:
        return None
    return {"n": len(rows), "first": old[1], "now": cur[0], "drift": round(drift, 3)}
