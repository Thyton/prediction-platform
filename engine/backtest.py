"""
Honest 30-day backtest: replay the model day-by-day. Picks are generated with
ratings built only from PREVIOUS days, then graded against that day's finals.
Result -> data/backtest.json feeds the public record.
"""
import sys, json, datetime
sys.path.insert(0, '.')
import collector as C
import model as M

s = M.load()   # start from trained state (ratings from all history, no look-ahead within window)
days = [(datetime.date.today() - datetime.timedelta(days=b)).strftime("%Y%m%d") for b in range(1, 11)]
days.reverse()  # oldest first so ratings build chronologically
# Replay the leagues that actually supply the board (soccer + US majors). ESPN
# drops event odds after ~2 weeks, so a 10-day window is the honest maximum.
BACKTEST_SPORTS = {
    "nba", "nfl", "nhl", "mlb", "ncaab", "ncaaf", "wnba", "ufc",
    "epl", "laliga", "seriea", "bundesliga", "ligue1", "ucl", "uel", "mls",
    "brasileirao", "ligaprof", "superlig", "ligapt", "eredivisie", "ligamx",
}
leagues = [l for l in C.ESPN_LEAGUES if l[1] in BACKTEST_SPORTS]
ledger = []
for day in days:
    finals = []
    for path, sport, label, tw in leagues:
        try:
            d = C.get(f"{C.ESPN}/{path}/scoreboard", params={"dates": day})
        except Exception:
            continue
        for ev in d.get("events") or []:
            comps = (ev.get("competitions") or [{}])[0].get("competitors") or []
            home = next((c for c in comps if c.get("homeAway")=="home"), None)
            away = next((c for c in comps if c.get("homeAway")=="away"), None)
            if not home or not away: continue
            hn = (home.get("team") or {}).get("displayName")
            an = (away.get("team") or {}).get("displayName")
            try:
                hs, as_ = int(home.get("score")), int(away.get("score"))
            except Exception:
                continue
            # historical odds come from the core API (site API drops them after the day)
            markets = None
            try:
                o = C.get(f"{C.CORE}/{C.core_path(path)}/events/{ev['id']}/competitions/{ev['id']}/odds")
                best_h, best_a = None, None
                for it in o.get("items") or []:
                    hd = C.american_to_decimal((it.get("homeTeamOdds") or {}).get("moneyLine"))
                    ad = C.american_to_decimal((it.get("awayTeamOdds") or {}).get("moneyLine"))
                    if hd and (best_h is None or hd > best_h): best_h = hd
                    if ad and (best_a is None or ad > best_a): best_a = ad
                if best_h and best_a:
                    fav = "home" if best_h <= best_a else "away"
                    markets = {"h2h": {"bestOdds": min(best_h, best_a), "otherOdds": max(best_h, best_a),
                                        "bookCount": "1", "favSide": fav}}
            except Exception:
                pass
            if not markets:
                continue
            finals.append((sport, label, hn, an, hs, as_, markets, ev['id'], path))
    for sport, label, hn, an, hs, as_, mk, eid, path in finals:
        g = {"id": f"{sport}:{eid}", "sport": sport, "home": hn, "away": an,
             "match": f"{an} @ {hn}", "league": label,
             "drawPossible": sport not in ("nba","nfl","nhl","ncaab","wnba"),
             "startsAt": f"{day[:4]}-{day[4:6]}-{day[6:]}T12:00:00Z",
             "markets": mk}
        p = M.evaluate(g, s)
        if p:
            won = (p["side"]=="home" and hs>as_) or (p["side"]=="away" and as_>hs)
            p["result"] = "correct" if won else "wrong"
            p["profitUnits"] = round(float(p["price"])-1,3) if won else -1.0
            p["final"] = f"{hs}-{as_}"
            p["source"] = "backtest"
            ledger.append(p)
        margin = min(3.0, abs(hs-as_))
        M.update(s, sport, hn, an, hs, as_, margin_mult=0.7+0.3*margin)
json.dump({"generatedAt": datetime.datetime.now(datetime.UTC).isoformat(),
           "windowDays": len(days), "items": ledger}, open("../data/backtest.json", "w"), indent=1)
won = sum(1 for p in ledger if p["result"]=="correct")
units = sum(p["profitUnits"] for p in ledger)
print(f"BACKTEST: {won}/{len(ledger)} = {100*won/max(1,len(ledger)):.1f}% | units {units:+.2f}")
