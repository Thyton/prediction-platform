"""
The Odds API bridge — real multi-book moneylines.

ESPN gave one book per event (and stopped serving NBA/NHL/NCAAB entirely), so prices
come from here and are matched onto collected games by team name.

Usage: imported by the model step. Requires ODDS_API_KEY.
"""
import json, os, re, sys, time, urllib.request, unicodedata

BASE = "https://api.the-odds-api.com/v4"

# our sport key -> The Odds API sport key
SPORTS = {
    "nba": "basketball_nba",
    "ncaab": "basketball_ncaab",
    "wnba": "basketball_wnba",
    "nfl": "americanfootball_nfl",
    "nhl": "icehockey_nhl",
    "mlb": "baseball_mlb",
    "epl": "soccer_epl",
    "laliga": "soccer_spain_la_liga",
    "seriea": "soccer_italy_serie_a",
    "bundesliga": "soccer_germany_bundesliga",
    "ligue1": "soccer_france_ligue_one",
    "ucl": "soccer_uefa_champs_league",
    "uel": "soccer_uefa_europa_league",
    "mls": "soccer_usa_mls",
    "ufc": "mma_mixed_martial_arts",
    "ncaaf": "americanfootball_ncaaf",
    "brasileirao": "soccer_brazil_campeonato",
    "ligaprof": "soccer_argentina_primera_division",
    "superlig": "soccer_turkey_super_league",
    "ligapt": "soccer_portugal_primeira_liga",
    "eredivisie": "soccer_netherlands_eredivisie",
    "ligamx": "soccer_mexico_ligamx",
}

UA = {"User-Agent": "TipLab/1.0 (+https://tiplab.io)", "Accept": "application/json"}


def norm(name):
    """Loose key for team matching across sources."""
    if not name:
        return ""
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9 ]", " ", s.lower())
    stop = (" fc", " cf", " sc", " ac", " afc", " city", " united", " utd", " club")
    s = " " + re.sub(r"\s+", " ", s).strip() + " "
    for w in stop:
        s = s.replace(w + " ", " ")
    return re.sub(r"\s+", " ", s).strip()


def _american_to_decimal(ml):
    try:
        ml = float(ml)
    except (TypeError, ValueError):
        return None
    if ml == 0:
        return None
    return round(1 + (ml / 100 if ml > 0 else 100 / abs(ml)), 3)


def fetch_sport(sport, timeout=25):
    """Return {norm_home|norm_away: {bestOdds, otherOdds, favSide, bookCount}} for one sport."""
    key = os.environ.get("ODDS_API_KEY")
    api_key = SPORTS.get(sport)
    if not key or not api_key:
        return {}
    import datetime as _dt
    now = _dt.datetime.now(_dt.UTC)
    t_from = (now - _dt.timedelta(hours=6)).strftime("%Y-%m-%dT%H:%M:%SZ")
    t_to = (now + _dt.timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    url = (
        f"{BASE}/sports/{api_key}/odds?apiKey={key}&regions=us"
        f"&markets=h2h&oddsFormat=decimal&dateFormat=iso"
        f"&commenceTimeFrom={t_from}&commenceTimeTo={t_to}"
    )
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            events = json.loads(r.read())
            remaining = r.headers.get("x-requests-remaining")
    except Exception as e:
        print(f"  oddsapi {sport} fetch failed: {e}", file=sys.stderr)
        return {}
    if remaining is not None:
        print(f"  odds credits left: {remaining}", flush=True)

    out = {}
    for ev in events or []:
        home, away = ev.get("home_team"), ev.get("away_team")
        if not home or not away:
            continue
        best_home = best_away = None
        books = set()
        for bm in ev.get("bookmakers") or []:
            books.add(bm.get("key"))
            for market in bm.get("markets") or []:
                if market.get("key") != "h2h":
                    continue
                for oc in market.get("outcomes") or []:
                    price = oc.get("price")
                    if not price:
                        continue
                    if norm(oc.get("name")) == norm(home):
                        if best_home is None or price > best_home:
                            best_home = price
                    elif norm(oc.get("name")) == norm(away):
                        if best_away is None or price > best_away:
                            best_away = price
        if not best_home or not best_away:
            continue
        fav = "home" if best_home <= best_away else "away"
        out[f"{norm(home)}|{norm(away)}"] = {
            "bestOdds": min(best_home, best_away),
            "otherOdds": max(best_home, best_away),
            "favSide": fav,
            "bookCount": str(len(books)),
            "commence": ev.get("commence_time"),
        }
    return out


def enrich(games, sport_keys=None):
    """Attach real prices to games. Only fills games that have none."""
    wanted = {g["sport"] for g in games}
    if sport_keys:
        wanted &= set(sport_keys)
    price_map = {}
    # fetch sports in parallel: serially this alone was ~90s per cycle
    from concurrent.futures import ThreadPoolExecutor

    def one(sport):
        return sport, fetch_sport(sport)

    with ThreadPoolExecutor(max_workers=6) as pool:
        for sport, m in pool.map(one, sorted(wanted)):
            if m:
                price_map[sport] = m
                print(f"  {sport}: {len(m)} priced events", flush=True)

    filled = 0
    for g in games:
        have = (g.get("markets") or {}).get("h2h")
        # keep only when we already have real multi-book consensus
        if have and int(have.get("bookCount") or 0) >= 5:
            continue
        table = price_map.get(g["sport"])
        if not table:
            continue
        key = f"{norm(g['home'])}|{norm(g['away'])}"
        hit = table.get(key)
        if not hit:
            continue
        # guard against back-to-backs: the price must be for a game close in time
        try:
            import datetime as _dt
            a = _dt.datetime.fromisoformat(str(g.get("startsAt")).replace("Z", "+00:00"))
            b = _dt.datetime.fromisoformat(str(hit.get("commence")).replace("Z", "+00:00"))
            if abs((a - b).total_seconds()) > 72 * 3600:
                continue
        except Exception:
            pass
        g["markets"] = {
            "h2h": {
                "outcome": g["home"] if hit["favSide"] == "home" else g["away"],
                "bestOdds": hit["bestOdds"],
                "otherOdds": hit["otherOdds"],
                "bookCount": hit["bookCount"],
                "favSide": hit["favSide"],
                "source": "oddsapi",
            }
        }
        filled += 1
    return filled


if __name__ == "__main__":
    import sys
    keys = sys.argv[1:] or None
    demo = [{"sport": "nba", "home": "Charlotte Hornets", "away": "Memphis Grizzlies", "markets": {}}]
    print("filled:", enrich(demo, keys))
    print(demo[0]["markets"])
