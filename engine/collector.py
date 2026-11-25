"""
TipLab collector — pulls live/upcoming games across all supported sports.

Sources (all free, ToS-safe, read-only):
  - ESPN public scoreboard API (NBA, NFL, MLB, NHL, NCAAB, WNBA, soccer leagues, tennis, UFC)
  - bo3.gg public API (CS2, Dota 2, LoL, Valorant, etc.)

Normalised shape:
  {id, sport, league, match, home, away, startsAt, markets:{h2h:{outcome, bestOdds, bookCount}}, books:[]}

Usage:
  python collector.py --out games.json
"""
import json, re, sys, time, urllib.parse, urllib.request, datetime, argparse

import oddsapi


def _load_env():
    """Read engine/.env so scheduled runs get ODDS_API_KEY etc."""
    import os as _os
    p = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), ".env")
    if _os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                _os.environ.setdefault(k, v)


_load_env()

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.espn.com/",
    "Origin": "https://www.espn.com",
}
ESPN = "https://site.api.espn.com/apis/site/v2/sports"

# ESPN path -> (sport, league label, two_way)
ESPN_LEAGUES = [
    ("basketball/nba",                      "nba",        "NBA",          True),
    ("basketball/wnba",                     "wnba",       "WNBA",         True),
    ("basketball/mens-college-basketball",  "ncaab",      "NCAAB",        True),
    ("football/nfl",                        "nfl",        "NFL",          True),
    ("football/college-football",           "ncaaf",      "NCAAF",        True),
    ("baseball/mlb",                        "mlb",        "MLB",          True),
    ("hockey/nhl",                          "nhl",        "NHL",          True),
    ("mma/ufc",                             "ufc",        "UFC",          True),
    ("soccer/eng.1",                        "epl",        "EPL",          False),
    ("soccer/esp.1",                        "laliga",     "La Liga",      False),
    ("soccer/ita.1",                        "seriea",     "Serie A",      False),
    ("soccer/ger.1",                        "bundesliga", "Bundesliga",   False),
    ("soccer/fra.1",                        "ligue1",     "Ligue 1",      False),
    ("soccer/bra.1",                        "brasileirao","Brazil Serie A", False),
    ("soccer/arg.1",                        "ligaprof",   "Argentina Liga Profesional", False),
    ("soccer/tur.1",                        "superlig",   "Turkish Super Lig", False),
    ("soccer/por.1",                        "ligapt",     "Portugal Primeira Liga", False),
    ("soccer/ned.1",                        "eredivisie", "Dutch Eredivisie", False),
    ("soccer/mex.1",                        "ligamx",     "Liga MX",      False),
    ("soccer/uefa.champions",               "ucl",        "Champions League", False),
    ("soccer/uefa.europa",                  "uel",        "Europa League", False),
    ("soccer/usa.1",                        "mls",        "MLS",          False),
    ("tennis/atp",                          "atp",        "ATP Tour",     True),
    ("tennis/wta",                          "wta",        "WTA Tour",     True),
]

CORE = "https://sports.core.api.espn.com/v2/sports"


def core_path(path):
    """'basketball/nba' -> 'basketball/leagues/nba' (core API differs from site API)."""
    sport, _, league = path.partition("/")
    return f"{sport}/leagues/{league}"


def enrich_odds(path, event_id, comp_id=None):
    """Pull moneyline odds from ESPN's core API for one event. Returns markets dict."""
    comp_id = comp_id or event_id
    base = f"{CORE}/{core_path(path)}/events/{event_id}/competitions/{comp_id}/odds"
    try:
        listing = get(base)
    except Exception:
        return {}
    best = {}  # side -> (best_odds, book_count)
    books = set()
    for o in (listing.get("items") or [])[:15]:
        book = (o.get("provider") or {}).get("name") or "book"
        for side, key in (("home", "homeTeamOdds"), ("away", "awayTeamOdds")):
            ml = american_to_decimal((o.get(key) or {}).get("moneyLine"))
            if not ml:
                continue
            books.add(book)
            if side not in best or ml > best[side][0]:
                best[side] = (ml, 0)
    if len(best) < 2:
        return {}
    for s in best:
        best[s] = (best[s][0], len(books))
    fav = "home" if best["home"][0] <= best["away"][0] else "away"
    return {
        "h2h": {
            "outcome": None,          # filled by caller from the actual side name
            "bestOdds": best[fav][0],
            "otherOdds": best["away" if fav == "home" else "home"][0],
            "bookCount": str(best[fav][1]),
            "favSide": fav,
        }
    }


def get(url, timeout=20, tries=3, params=None):
    """GET with exponential backoff; ESPN 403s on bursts so pace aggressively."""
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    last = None
    for n in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (403, 429):
                time.sleep(1.5 * (n + 1))
                continue
            raise
        except Exception as e:
            last = e
            time.sleep(1.0 * (n + 1))
    raise last


def american_to_decimal(ml):
    try:
        ml = float(ml)
    except (TypeError, ValueError):
        return None
    if ml == 0:
        return None
    return round(1 + (ml / 100 if ml > 0 else 100 / abs(ml)), 3)


def parse_espn_odds(comp):
    """Extract best H2H price per side across all book odds objects."""
    sides = {}  # name -> list[(decimal_odds, book)]
    for o in (comp.get("odds") or []):
        if not isinstance(o, dict):
            continue
        book = o.get("provider", {}).get("name") or o.get("provider", {}).get("id") or "book"
        for key, side in (("homeTeamOdds", "home"), ("awayTeamOdds", "away")):
            so = o.get(key) or {}
            dec = american_to_decimal(so.get("moneyLine"))
            if dec:
                sides.setdefault(side, []).append((dec, book))
    out = {}
    for side, lst in sides.items():
        lst.sort(key=lambda x: -x[0])  # best price for bettor
        out[side] = {"bestOdds": lst[0][0], "bookCount": len({b for _, b in lst})}
    return out


def event_get(e, k):
    return e.get(k)


def parse_espn_event(event, sport, league, two_way):
    st = (event_get(event, "status") or {}).get("type", {}).get("state", "pre")
    comp = event_get(event, "competitions") or [{}]
    comp = comp[0] if isinstance(comp, list) else comp
    if st not in ("pre", "in", "post"):
        return None
    competitors = comp.get("competitors") or []
    if len(competitors) < 2:
        return None
    home = next((c for c in competitors if c.get("homeAway") == "home"), None)
    away = next((c for c in competitors if c.get("homeAway") == "away"), None)
    if not home or not away:
        return None
    hn = (home.get("team") or {}).get("displayName") or (home.get("athlete") or {}).get("displayName")
    an = (away.get("team") or {}).get("displayName") or (away.get("athlete") or {}).get("displayName")
    if not hn or not an:
        return None
    home_logo = (home.get("team") or {}).get("logo") or (home.get("athlete") or {}).get("headshot", {}).get("href")
    away_logo = (away.get("team") or {}).get("logo") or (away.get("athlete") or {}).get("headshot", {}).get("href")
    home_abbr = (home.get("team") or {}).get("abbreviation")
    away_abbr = (away.get("team") or {}).get("abbreviation")
    odds = parse_espn_odds(comp)
    markets = {}
    if len(odds) >= 2:
        # pick the shortest-priced side as the market favourite reference
        fav_side = "home" if odds.get("home", {}).get("bestOdds", 99) <= odds.get("away", {}).get("bestOdds", 99) else "away"
        o = odds[fav_side]
        markets["h2h"] = {
            "outcome": hn if fav_side == "home" else an,
            "bestOdds": o["bestOdds"],
            "bookCount": str(o["bookCount"]),
            "favSide": fav_side,
        }
    return {
        "id": f"{sport}:{event_get(event, 'id')}",
        "sport": sport,
        "league": league,
        "match": f"{an} @ {hn}",
        "home": hn,
        "away": an,
        "homeLogo": home_logo,
        "awayLogo": away_logo,
        "homeAbbr": home_abbr,
        "awayAbbr": away_abbr,
        "startsAt": event_get(event, "date"),
        "state": st,
        "_path": None,
        "_eid": event_get(event, "id"),
        "_cid": comp.get("id"),
        "markets": markets,
        "espnUrl": next((l.get("href") for l in (event_get(event, "links") or []) if l.get("rel") == ["summary"]), None),
        "drawPossible": not two_way,
    }


NEAR_WINDOW = {"nba", "nhl", "nfl", "ncaab", "ncaaf", "mlb", "wnba"}
SPARSE = {"epl", "laliga", "seriea", "bundesliga", "ligue1", "ucl", "uel", "mls",
          "brasileirao", "ligaprof", "superlig", "ligapt", "eredivisie", "ligamx"}


def collect_espn(limit_per_league=60):
    """Pull today + next 3 days (10 for sparse leagues) so boards aren't empty.

    Leagues are fetched in parallel — serially this took ~3 minutes, which times
    out the 30-minute cycle's publish step on slow ESPN days."""
    from concurrent.futures import ThreadPoolExecutor

    days4 = [(datetime.date.today() + datetime.timedelta(days=d)).strftime("%Y%m%d") for d in range(0, 4)]
    days_near = [(datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y%m%d")] + days4[:2]
    days10 = [(datetime.date.today() + datetime.timedelta(days=d)).strftime("%Y%m%d") for d in range(0, 11)]

    def fetch_board(args):
        path, sport, day = args
        for attempt in range(3):
            try:
                return sport, path, day, get(f"{ESPN}/{path}/scoreboard", params={"dates": day})
            except Exception as e:
                if attempt == 2:
                    if day == day:
                        print(f"  ! {path} {day}: {e}", file=sys.stderr)
                else:
                    time.sleep(1.2)
        return sport, path, day, None

    jobs = []
    for path, sport, label, two_way in ESPN_LEAGUES:
        days = days10 if sport in SPARSE else (days_near if sport in NEAR_WINDOW else days4)
        for day in days:
            jobs.append((path, sport, day))
    boards = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for sport, path, day, d in pool.map(fetch_board, jobs):
            if d:
                boards.setdefault((path, sport), []).append(d)

    games = []
    for path, sport, label, two_way in ESPN_LEAGUES:
        for d in boards.get((path, sport), []):
            if sport in ("atp", "wta"):
                for ev in (d.get("events") or []):
                    for grp in ev.get("groupings") or []:
                        for c in (grp.get("competitions") or [])[:limit_per_league]:
                            g = parse_espn_event(dict(c, id=c.get("id") or f"{ev.get('id')}-{c.get('id')}",
                                                     date=c.get("date"), status=c.get("status"),
                                                     links=[], competitions=[c]), sport, label, True)
                            if g and g.get("state") in ("pre", "in"):
                                g["match"] = f"{g['away']} vs {g['home']}"
                                g["tournament"] = ev.get("name")
                                g["league"] = ev.get("name") or label
                                g["_path"] = path
                                g["noMarketOk"] = True
                                games.append(g)
                continue
            for ev in (d.get("events") or [])[:limit_per_league]:
                g = parse_espn_event(ev, sport, label, two_way)
                if g:
                    g["_path"] = path
                    games.append(g)
    return games


def e_match(c):
    comps = c.get("competitors") or []
    home = next((x for x in comps if x.get("homeAway") == "home"), None)
    away = next((x for x in comps if x.get("homeAway") == "away"), None)
    hn = ((home or {}).get("athlete") or {}).get("displayName")
    an = ((away or {}).get("athlete") or {}).get("displayName")
    return f"{an} vs {hn}"


# ---------------- esports (bo3.gg) ----------------
BO3 = "https://api.bo3.gg/api/v1"
DISC_CACHE = {}


def slug_teams(slug, y, mo, d):
    """bo3 slugs are '<team1>-vs-<team2>-DD-MM-YYYY'; recover display names from them."""
    s = slug.replace(f"-{d:02d}-{mo:02d}-{y}", "")
    parts = s.split("-vs-")
    if len(parts) != 2:
        return None, None
    def pretty(p):
        t = p.replace("-", " ").strip()
        return " ".join(w.capitalize() if w.lower() not in ("csgo", "cs2", "dota2", "lol", "navi") else w.upper()
                        for w in t.split())
    return pretty(parts[0]), pretty(parts[1])


def _bo3_page(query):
    try:
        d = get(f"{BO3}/matches?{query}")
    except Exception:
        return []
    return d.get("results") or []


def bo3_pool():
    """bo3 ignores paging and most filters, so distinct rows come from combining the
    status and sort variants that do work. Deduped by match id."""
    seen = {}
    for st in ("finished", "live", "upcoming"):
        for srt in ("-end_date", "-start_date", "id", "-id"):
            for row in _bo3_page(f"per_page=10&filter[status][]={st}&sort={srt}"):
                if row.get("id") and row.get("team1_id") and row.get("team2_id"):
                    seen[row["id"]] = row
            time.sleep(0.2)
    return list(seen.values())


def bo3_finished(pages=None):
    """Finished esports matches with names and scores, deduped."""
    out = []
    for r in bo3_pool():
        if r.get("status") not in ("finished", "defwin"):
            continue
        s1, s2 = r.get("team1_score"), r.get("team2_score")
        if s1 is None or s2 is None:
            continue
        try:
            st = datetime.datetime.fromisoformat(r["start_date"].replace("Z", "+00:00"))
            h, a = slug_teams(r.get("slug", ""), st.year, st.month, st.day)
        except Exception:
            continue
        if h and a:
            out.append((h, a, int(s1), int(s2)))
    return out


def collect_esports():
    """Live + imminent esports matches across statuses bo3 will actually return.

    bo3 carries real bookmaker moneyline odds in `bet_updates` (Thunderpick), so
    esports no longer has to be model-priced — we take the market when it exists
    and fall back to the model only for unpriced rows."""
    games = []
    now = datetime.datetime.now(datetime.UTC)
    lo = now - datetime.timedelta(hours=14)
    hi = now + datetime.timedelta(hours=168)
    seen = {}
    for st in ("live", "upcoming"):
        for srt in ("-end_date", "-start_date"):
            try:
                d = get(f"{BO3}/matches?per_page=10&sort={srt}&filter[status][]={st}")
            except Exception as e:
                print(f"  ! esports ({st}/{srt}): {e}", file=sys.stderr)
                continue
            for r in d.get("results", []):
                if not (r.get("team1_id") and r.get("team2_id")):
                    continue
                try:
                    sd = datetime.datetime.fromisoformat(r["start_date"].replace("Z", "+00:00"))
                except Exception:
                    continue
                if lo <= sd <= hi:
                    seen[r["id"]] = r
            time.sleep(0.25)
    for r in seen.values():
        try:
            st_ = datetime.datetime.fromisoformat(r["start_date"].replace("Z", "+00:00"))
            h, a = slug_teams(r.get("slug", ""), st_.year, st_.month, st_.day)
        except Exception:
            continue
        if not h or not a:
            continue
        markets = {}
        bu = r.get("bet_updates") or {}
        t1, t2 = bu.get("team_1") or {}, bu.get("team_2") or {}
        try:
            c1, c2 = float(t1.get("coeff") or 0), float(t2.get("coeff") or 0)
        except (TypeError, ValueError):
            c1 = c2 = 0.0
        if c1 > 1 and c2 > 1:
            fav = "home" if c1 <= c2 else "away"
            markets["h2h"] = {
                "outcome": h if fav == "home" else a,
                "bestOdds": min(c1, c2),
                "otherOdds": max(c1, c2),
                "bookCount": "1",
                "favSide": fav,
                "source": "bo3",
            }
        games.append({
            "id": f"esports:{r['id']}",
            "sport": "esports",
            "league": "Esports",
            "match": f"{a} vs {h}",
            "home": h,
            "away": a,
            "startsAt": r.get("start_date"),
            "state": r.get("status"),
            "markets": markets,
            "tier": r.get("tier"),
            "boType": r.get("bo_type"),
            "mapScore": [r.get("team1_score"), r.get("team2_score")],
            "drawPossible": False,
        })
    return games


def dedupe(games):
    seen, out = set(), []
    for g in games:
        if g["id"] in seen:
            continue
        seen.add(g["id"])
        out.append(g)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="-")
    ap.add_argument("--sports", default="all")
    a = ap.parse_args()
    games = collect_espn() + collect_esports()
    games = dedupe(games)
    # enrich odds from core API where the scoreboard didn't carry them; otherwise
    # fill the missing dog price from the site-API odds (they often carry both sides)
    need = [g for g in games if not (g.get("markets") or {}).get("h2h") and g.get("_path") and g.get("_eid")]
    from concurrent.futures import ThreadPoolExecutor

    def enrich_one(g):
        try:
            return g, enrich_odds(g["_path"], g["_eid"], g.get("_cid"))
        except Exception:
            return g, {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for g, m in pool.map(enrich_one, need):
            if m:
                g["markets"] = m
    for g in games:
        m = g.get("markets") or {}
        h2h = m.get("h2h")
        if h2h:
            h2h["outcome"] = g["home"] if h2h["favSide"] == "home" else g["away"]
    # real multi-book prices from The Odds API (ESPN serves one book, and none for NBA/NHL/NCAAB)
    try:
        filled = oddsapi.enrich(games)
        print(f"  oddsapi filled {filled} games", file=sys.stderr)
    except Exception as e:
        print(f"  oddsapi error: {e}", file=sys.stderr)

    games.sort(key=lambda g: g.get("startsAt") or "")
    payload = {"generatedAt": datetime.datetime.now(datetime.UTC).isoformat(), "games": games}
    js = json.dumps(payload, indent=1, ensure_ascii=False)
    if a.out == "-":
        print(js)
    else:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(js)
        withodds = sum(1 for g in games if g.get("markets"))
        print(f"wrote {len(games)} games ({withodds} with odds) -> {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
