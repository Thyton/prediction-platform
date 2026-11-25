"""
TipLab live — in-play signal engine.

Watches every open pick whose game has started, pulls the live scoreboard, and
emits a signal when the in-play picture diverges from the pick we published:

  CASH_OUT  the picked side is losing *and* the clock/period says the window to
            recover has largely closed — take the exit while value is left.
  HOLD      the picked side is leading comfortably — stay in, don't take a thin price.
  RISING    the picked side is behind but the game is young — the get-in window
            is still open (a live price is usually better than the locked one).

Signals are anchored to the pick (gameId) so the site can show them on the
premium board and the member's own tracked list. All heuristics, no book feed —
we read only the free ESPN scoreboard state.

Usage:
  python live.py --ledger ../data/ledger.json --out ../data/live.json
"""
import argparse, datetime, json, os, sys

import collector as C

LIVE_WINDOW_BEFORE = datetime.timedelta(hours=4)


def parse_iso(s):
    try:
        return datetime.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except Exception:
        return None


def clock_state(comp):
    """Return (state, period_label, seconds_remaining_or_None) from an ESPN competition."""
    st = ((comp.get("status") or {}).get("type") or {}).get("state", "pre")
    detail = (comp.get("status") or {}).get("displayClock") or ""
    period = (comp.get("status") or {}).get("period")
    return st, str(detail), period


def progress(sport, period, secs_left):
    """0.0 (start) .. 1.0 (over) — how much of the match has been played."""
    # full-match expected periods per sport
    if sport in ("epl", "laliga", "seriea", "bundesliga", "ligue1", "ucl", "uel", "mls"):
        total = 90.0
        try:
            played = (period - 1) * 45 + (45 - float(secs_left or 45))
        except (TypeError, ValueError):
            played = 0.0
        return min(1.0, max(0.0, played / total))
    # period alone made the whole first quarter read as 0%, so time-based
    # thresholds never fired. Use the clock within the period.
    clocked = {"nba": (4, 12.0), "ncaab": (2, 20.0), "wnba": (4, 10.0),
               "nhl": (3, 20.0), "nfl": (4, 15.0)}
    if sport in clocked:
        periods, per = clocked[sport]
        try:
            secs = int(str(secs_left).split(":")[0]) * 60 + int(str(secs_left).split(":")[1])
        except (TypeError, ValueError, IndexError):
            secs = per * 60
        played = ((period or 1) - 1) * per * 60 + max(0.0, per * 60 - secs)
        return min(1.0, max(0.0, played / (periods * per * 60)))
    return 0.5


def score_of(comp):
    home = next((c for c in comp.get("competitors") or [] if c.get("homeAway") == "home"), None)
    away = next((c for c in comp.get("competitors") or [] if c.get("homeAway") == "away"), None)
    if not home or not away:
        return None
    try:
        return int(float(home.get("score") or 0)), int(float(away.get("score") or 0))
    except (TypeError, ValueError):
        return None


def tennis_live_state(game_id, starts_at=None):
    """Return (sets_home, sets_away, state, set_no, games_in_set, progress) for a
    tennis competition. Sets are derived from the per-set linescores."""
    sport, _, cid = game_id.partition(":")
    path = PATH_BY_SPORT.get(sport)
    if not path or not cid:
        return None
    st0 = parse_iso(starts_at)
    days = [(st0 + datetime.timedelta(days=k)).strftime("%Y%m%d") for k in (-1, 0, 1)] if st0 else []
    days.append(None)
    for day in days:
        params = {"dates": day} if day else None
        try:
            d = C.get(f"{C.ESPN}/{path}/scoreboard", params=params)
        except Exception:
            continue
        for ev in d.get("events") or []:
            for grp in ev.get("groupings") or []:
                for c in grp.get("competitions") or []:
                    if str(c.get("id")) != str(cid):
                        continue
                    st = ((c.get("status") or {}).get("type") or {}).get("state", "pre")
                    comps = c.get("competitors") or []
                    home = next((x for x in comps if x.get("homeAway") == "home"), None)
                    away = next((x for x in comps if x.get("homeAway") == "away"), None)
                    if not home or not away:
                        return None

                    def sets(c_):
                        won = 0
                        for s in c_.get("linescores") or []:
                            try:
                                v = float(s.get("value") or 0)
                            except (TypeError, ValueError):
                                continue
                            if v >= 6:
                                won += 1
                        return won

                    selected = (c.get("status") or {}).get("period") or 1
                    hs, as_ = sets(home), sets(away)
                    ls_h = (home.get("linescores") or [{}])[-1].get("value") or 0
                    ls_a = (away.get("linescores") or [{}])[-1].get("value") or 0
                    played = max(hs + as_, 0)
                    prog = min(1.0, 0.08 + 0.3 * played + 0.03 * max(ls_h, ls_a))
                    # sets lead plus current-set game lead: how clearly ahead
                    lead_units = (hs - as_) * 4 + (float(ls_h) - float(ls_a))
                    return hs, as_, st, selected, f"{int(ls_h)}-{int(ls_a)}", prog, lead_units
    return None


PATH_BY_SPORT = {sport: path for path, sport, _label, _two in C.ESPN_LEAGUES}


def bo3_live_state(game_id):
    """(maps_home, maps_away, state, bo, label, progress, lead_units) for an
    esports match, straight from bo3's live/finished rows."""
    _, _, mid = game_id.partition(":")
    try:
        d = C.get(f"{C.BO3}/matches?page=1&per_page=10&sort=-end_date&filter[status][]=live")
    except Exception:
        return None
    rows = d.get("results") or []
    try:
        d2 = C.get(f"{C.BO3}/matches?page=1&per_page=10&sort=-end_date&filter[status][]=upcoming")
        rows += d2.get("results") or []
    except Exception:
        pass
    for r in rows:
        if str(r.get("id")) != str(mid):
            continue
        s1, s2 = r.get("team1_score"), r.get("team2_score")
        if s1 is None or s2 is None:
            return None
        status = r.get("status")
        bo = r.get("bo_type") or 3
        played = int(s1 or 0) + int(s2 or 0)
        # our ledger's "home" is the first slug part, which bo3 stores as team1
        prog = min(1.0, (played + 0.5) / max(1, bo))
        lead = int(s1 or 0) - int(s2 or 0)
        return int(s1), int(s2), status, bo, f"{s1}-{s2} maps", prog, lead
    return None


def live_state(game_id, starts_at=None):
    """Return (hs, as_, state, period, clock, progress) for an ESPN gameId.

    ESPN's undated scoreboard is "today", and a late game spans UTC midnight, so
    we query the pick's own start date (and the day after) rather than relying on
    "today"."""
    sport, _, eid = game_id.partition(":")
    if sport in ("atp", "wta"):
        return None      # tennis has its own reader
    if sport == "esports":
        return None
    path = PATH_BY_SPORT.get(sport)
    if not path:
        return None
    days = []
    st0 = parse_iso(starts_at)
    if st0:
        # a game's UTC date can straddle the US-local board date either way
        for k in (-1, 0, 1):
            days.append((st0 + datetime.timedelta(days=k)).strftime("%Y%m%d"))
    days.append(None)  # today as a fallback
    for day in days:
        params = {"dates": day} if day else None
        try:
            d = C.get(f"{C.ESPN}/{path}/scoreboard", params=params)
        except Exception:
            continue
        for ev in d.get("events") or []:
            if str(ev.get("id")) != str(eid):
                continue
            comp = (ev.get("competitions") or [{}])[0]
            st, clock, period = clock_state(comp)
            sc = score_of(comp)
            if not sc:
                return None
            hs, as_ = sc
            return hs, as_, st, period, clock, progress(sport, period, clock)
    return None


def signal_for(item):
    gid = item.get("gameId")
    if not gid or item.get("result"):
        return None
    started = parse_iso(item.get("startsAt"))
    if not started:
        return None
    now = datetime.datetime.now(datetime.UTC)
    if now < started - LIVE_WINDOW_BEFORE:
        return None
    st_live = None
    if item.get("sport") in ("atp", "wta"):
        st_live = tennis_live_state(gid, item.get("startsAt"))
    elif item.get("sport") == "esports":
        st_live = bo3_live_state(gid)
    else:
        st_live = live_state(gid, item.get("startsAt"))
    if not st_live:
        return None
    tennis = item.get("sport") in ("atp", "wta")
    esports = item.get("sport") == "esports"
    if tennis or esports:
        hs, as_, state, period, clock, prog, lead = st_live
    else:
        hs, as_, state, period, clock, prog = st_live
        lead = None
    if esports and state not in ("live", "upcoming"):
        return None
    if not esports and state == "post":
        return None  # grader will settle it
    if not esports and state != "in":
        return None
    side = item.get("side")
    mine, theirs = (hs, as_) if side == "home" else (as_, hs)
    if lead is None:
        lead = mine - theirs
    else:
        lead = lead if side == "home" else -lead

    # scale thresholds per sport: a 2-run lead means nothing in basketball, and a
    # single break in tennis (lead_units 1) is already a real edge
    soccer_like = {"epl", "laliga", "seriea", "bundesliga", "ligue1", "ucl", "uel", "mls",
                   "brasileirao", "ligaprof", "superlig", "ligapt", "eredivisie", "ligamx"}
    if tennis:
        hold_at, late, caution_at = 2.0, 0.55, 0.5
        hold_text = "Ahead by a set/break — hold; the price is thin now."
        out_text = "Down late — the window to come back is closing. Exit."
        rise_text = "Down early — better live price available. Get in."
    elif item.get("sport") in ("nba", "ncaab", "wnba"):
        hold_at, late, caution_at = 8, 0.72, 0.62
        hold_text = "Comfortable lead — hold to the finish."
        out_text = "Down late — exit while some value remains."
        rise_text = "Down early — the get-in window is still open."
    elif item.get("sport") in ("nfl", "ncaaf"):
        hold_at, late, caution_at = 7, 0.72, 0.65
        hold_text = "Two-score lead — hold to the finish."
        out_text = "Down late — exit while some value remains."
        rise_text = "Down early — the get-in window is still open."
    elif item.get("sport") == "mlb":
        hold_at, late, caution_at = 1, 0.6, 0.5
        hold_text = "Ahead — hold to the finish."
        out_text = "Down late — exit while some value remains."
        rise_text = "Down early — the get-in window is still open."
    elif esports:
        hold_at, late, caution_at = 1, 0.55, 0.5
        hold_text = "Ahead on maps — hold; each next map is the market's swing point."
        out_text = "Down on maps with match point against — exit before the next map settles."
        rise_text = "Down early in the series — the next map is the get-in window."
    else:  # soccer + hockey: a one-goal lead is already the classic hold
        hold_at, late, caution_at = 1, 0.72, 0.62
        hold_text = "Leading — hold to the finish; the price is thin now."
        out_text = "Behind late — the recovery window is closing. Exit now."
        rise_text = "Behind — the get-in window is still open at a better live price."

    if lead >= hold_at and prog >= 0.45:
        kind, text = "HOLD", hold_text
    elif lead <= -1 and prog >= late:
        kind, text = "CASH_OUT", out_text
    elif lead < 0:
        kind, text = "RISING", rise_text
    elif lead == 0 and prog >= caution_at:
        kind, text = "CAUTION", "Level late — no momentum edge; consider a partial exit."
    else:
        return None

    return {
        "gameId": gid, "kind": kind, "text": text,
        "sport": item.get("sport"), "match": item.get("match"),
        "side": side, "score": f"{mine}-{theirs}",
        "period": period, "clock": clock, "progress": round(prog, 3),
        "at": now.isoformat(),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ledger", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    led = json.load(open(a.ledger)) if os.path.exists(a.ledger) else {"items": []}
    sigs = []
    for item in led.get("items", []):
        s = signal_for(item)
        if s:
            sigs.append(s)
    sigs.sort(key=lambda x: -x["progress"])
    json.dump({"generatedAt": datetime.datetime.now(datetime.UTC).isoformat(), "signals": sigs},
              open(a.out, "w"), indent=1)
    print(f"{len(sigs)} live signals -> {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
