"""
TipLab grader — settle released picks against real finals, log the record,
and feed every outcome back into the ratings (the learning loop).

Usage:
  python grade.py --ledger picks.json --state ledger_state.json
"""
import argparse, datetime, json, os, sys, time

import collector as C
import model as M

PATH_BY_LEAGUE = {label: (path, sport) for path, sport, label, _ in C.ESPN_LEAGUES}
FINISHED = {"post", "final", "finished", "defwin"}


def load(p):
    d = json.load(open(p)) if os.path.exists(p) else {"items": []}
    if "picks" in d and "items" not in d:      # model output
        d["items"] = d["picks"]
    d.setdefault("items", [])
    return d


def save(p, d):
    json.dump(d, open(p, "w"), indent=1)


SCORE_CACHE = {}


def day_results(path, sport, day):
    """Fetch a whole day of finals once, keyed by event id."""
    key = (path, day)
    if key in SCORE_CACHE:
        return SCORE_CACHE[key]
    out = {}
    try:
        d = C.get(f"{C.ESPN}/{path}/scoreboard", params={"dates": day})
    except Exception:
        SCORE_CACHE[key] = out
        return out
    for ev in d.get("events") or []:
        if (ev.get("status") or {}).get("type", {}).get("state") != "post":
            continue
        comps = (ev.get("competitions") or [{}])[0].get("competitors") or []
        home = next((c for c in comps if c.get("homeAway") == "home"), None)
        away = next((c for c in comps if c.get("homeAway") == "away"), None)
        if not home or not away:
            continue
        try:
            out[str(ev["id"])] = (int(home["score"]), int(away["score"]))
        except (KeyError, TypeError, ValueError):
            continue
    SCORE_CACHE[key] = out
    return out


def bo3_final(match_id):
    try:
        d = C.get(f"{C.BO3}/matches?page=1&per_page=10&sort=-end_date&filter[status][eq]=finished")
    except Exception:
        return None
    # bo3 has no id lookup; match by id in recent finished rows via full pages
    for page in range(1, 6):
        try:
            d = C.get(f"{C.BO3}/matches?page={page}&per_page=10&sort=-end_date&filter[status][eq]=finished")
        except Exception:
            return None
        for r in d.get("results") or []:
            if str(r.get("id")) == str(match_id):
                s1, s2 = r.get("team1_score"), r.get("team2_score")
                if s1 is None or s2 is None:
                    return None
                return int(s1), int(s2)
    return None


def final_score(game_id, starts_at=None):
    """"nba:401910023" -> (home_score, away_score) or None."""
    sport, _, eid = game_id.partition(":")
    if not eid:
        return None
    if sport == "esports":
        return bo3_final(eid)
    for path, s, label, _ in C.ESPN_LEAGUES:
        if s != sport:
            continue
        days = []
        if starts_at:
            try:
                d0 = datetime.datetime.fromisoformat(starts_at.replace("Z", "+00:00")).date()
            except Exception:
                d0 = None
            if d0:
                days = [(d0 + datetime.timedelta(days=k)).strftime("%Y%m%d") for k in (0, 1)]
        if not days:
            days = [datetime.date.today().strftime("%Y%m%d")]
        for day in days:
            res = day_results(path, sport, day)
            if eid in res:
                return res[eid]
        return None
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ledger", required=True)
    ap.add_argument("--state", required=True)
    a = ap.parse_args()
    led = load(a.ledger)
    s = M.load()
    trained_at = s.get("trainedAt")
    settled = 0
    for it in led["items"]:
        if it.get("result"):
            continue
        if trained_at and it.get("startsAt"):
            try:
                if datetime.datetime.fromisoformat(it["startsAt"].replace("Z", "+00:00")) < datetime.datetime.fromisoformat(trained_at):
                    continue          # finished before the model learned it: skip, no look-ahead
            except Exception:
                pass
        fs = final_score(it["gameId"], it.get("startsAt"))
        if not fs:
            continue
        hs, as_ = fs
        won = (it["side"] == "home" and hs > as_) or (it["side"] == "away" and as_ > hs)
        it["result"] = "correct" if won else "wrong"
        it["final"] = f"{hs}-{as_}"
        it["profitUnits"] = round(float(it["price"]) - 1, 3) if won else -1.0
        it["settledAt"] = datetime.datetime.now(datetime.UTC).isoformat()
        # learn from the outcome
        margin = min(3.0, abs(hs - as_))
        M.update(s, it["sport"], it["home"], it["away"], hs, as_, margin_mult=0.7 + 0.3 * margin)
        settled += 1
        time.sleep(0.3)
    M.save(s)
    save(a.ledger, led)
    graded = [i for i in led["items"] if i.get("result")]
    won = sum(1 for i in graded if i["result"] == "correct")
    print(f"settled {settled}; record {won}/{len(graded)}"
          f" ({100*won/len(graded) if graded else 0:.1f}%)", file=sys.stderr)


if __name__ == "__main__":
    main()
