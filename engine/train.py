"""
Train TipLab ratings from real settled results.

Pulls the last N days of finals from the same public feeds the collector uses and
runs Elo updates, so the model carries genuine signal instead of only echoing prices.

Usage:
  python train.py --days 21
"""
import argparse, datetime, json, sys, time

import collector as C
import model as M


from concurrent.futures import ThreadPoolExecutor


def day_finals(path, day):
    try:
        d = C.get(f"{C.ESPN}/{path}/scoreboard", params={"dates": day})
    except Exception:
        return []
    out = []
    for ev in d.get("events") or []:
        comps = (ev.get("competitions") or [{}])[0].get("competitors") or []
        if len(comps) < 2:
            continue
        if (ev.get("status") or {}).get("type", {}).get("state") != "post":
            continue
        home = next((c for c in comps if c.get("homeAway") == "home"), None)
        away = next((c for c in comps if c.get("homeAway") == "away"), None)
        if not home or not away:
            continue
        hn = (home.get("team") or {}).get("displayName")
        an = (away.get("team") or {}).get("displayName")
        hs, as_ = home.get("score"), away.get("score")
        if not hn or not an or hs in (None, "") or as_ in (None, ""):
            continue
        try:
            out.append((hn, an, int(hs), int(as_)))
        except (TypeError, ValueError):
            pass
    return out


def finals_for(path, sport, two_way, days):
    """All finals over the window, fetched 4 days at a time."""
    day_list = [(datetime.date.today() - datetime.timedelta(days=b)).strftime("%Y%m%d") for b in range(days)]
    rows = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for batch in pool.map(lambda d: day_finals(path, d), day_list):
            rows.extend(batch)
    return rows


def tennis_finals(path, days):
    """Finished tennis: nested groupings, athlete competitors, sets won as score."""
    out = []
    for back in range(days):
        day = (datetime.date.today() - datetime.timedelta(days=back)).strftime("%Y%m%d")
        try:
            d = C.get(f"{C.ESPN}/{path}/scoreboard", params={"dates": day})
        except Exception:
            continue
        for ev in d.get("events") or []:
            for grp in ev.get("groupings") or []:
                for c in grp.get("competitions") or []:
                    if (c.get("status") or {}).get("type", {}).get("state") != "post":
                        continue
                    comps = c.get("competitors") or []
                    home = next((x for x in comps if x.get("homeAway") == "home"), None)
                    away = next((x for x in comps if x.get("homeAway") == "away"), None)
                    hn = ((home or {}).get("athlete") or {}).get("displayName")
                    an = ((away or {}).get("athlete") or {}).get("displayName")
                    if not hn or not an or not home.get("winner") in (True, False):
                        continue
                    # sets won: count per-set scores, fall back to winner flag
                    def sets(comp):
                        return sum(1 for s in (comp.get("linescores") or []) if s.get("winner"))
                    hs, as_ = sets(home), sets(away)
                    if hs == as_:
                        hs, as_ = (1, 0) if home.get("winner") else (0, 1)
                    out.append((hn, an, hs, as_))
        time.sleep(0.3)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=21)
    a = ap.parse_args()
    s = M.load()
    total = 0
    # esports results from bo3 (finished matches carry winner_team_id)
    try:
        rows = C.bo3_finished(420)
        for hn, an, hs, as_ in rows:
            M.update(s, "esports", hn, an, hs, as_, margin_mult=1.0)
            total += 1
        print(f"  Esports: {len(rows)} finals", file=sys.stderr)
    except Exception as e:
        print(f"  ! esports: {e}", file=sys.stderr)

    for path, sport, label, two_way in C.ESPN_LEAGUES:
        if sport in ("atp", "wta"):
            rows = tennis_finals(path, a.days)
            for hn, an, hs, as_ in rows:
                M.update(s, sport, hn, an, hs, as_, margin_mult=1.0)
                total += 1
            print(f"  {label}: {len(rows)} finals", file=sys.stderr)
            continue
        rows = finals_for(path, sport, two_way, a.days)
        for hn, an, hs, as_ in rows:
            margin = min(3.0, abs(hs - as_)) if sport != "mlb" else 1.0
            M.update(s, sport, hn, an, hs, as_, margin_mult=0.7 + 0.3 * margin)
            total += 1
        print(f"  {label}: {len(rows)} finals", file=sys.stderr)
    s["trainedAt"] = datetime.datetime.now(datetime.UTC).isoformat()
    s["updated"] = s["trainedAt"]
    M.save(s)
    print(f"trained on {total} results; {sum(len(v) for v in s['ratings'].values())} rated teams", file=sys.stderr)


if __name__ == "__main__":
    main()
