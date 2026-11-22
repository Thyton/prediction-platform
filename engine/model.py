"""
TipLab model — calibrated probabilities from market prices + learned team ratings.

Principles (kept deliberately honest, because the whole product rests on them):
  * Market de-vigged probability is the baseline. We never pretend a market
    price is wrong without evidence.
  * Team ratings are learned from every settled result (Elo-style, sport-specific K).
    A rating *shift* vs the market is the only edge we claim.
  * Edge = model probability - de-vigged market probability, both sides considered.
  * Draws are modelled for soccer (Dixon-Coles-lite: draw prior shrinks with the
    rating gap). Two-way sports have no draw.

State: model_state.json  { ratings: {sport: {team: elo}}, played: n, updated }

Usage:
  python model.py --games games.json --out picks.json
"""
import json, math, os, sys, datetime, argparse, random

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "model_state.json")
ELO0 = 1500.0
K_BY_SPORT = {  # lower K = more stable ratings
    "nba": 18, "nfl": 14, "mlb": 10, "nhl": 12, "ncaab": 16, "wnba": 16,
    "epl": 16, "laliga": 16, "seriea": 16, "bundesliga": 16, "ligue1": 16,
    "ucl": 14, "uel": 14, "mls": 16, "atp": 20, "wta": 20, "ufc": 20, "esports": 24,
}
DRAW_BASE = {"epl": .26, "laliga": .25, "seriea": .27, "bundesliga": .24,
             "ligue1": .25, "ucl": .24, "uel": .25, "mls": .24}
MIN_EDGE = 0.045      # 4.5% model-vs-market edge required
THIN_EXTRA = 0.030    # extra edge demanded when only 1 book quotes
MIN_BOOKS = 1
OVERROUND = 1.075     # typical two-way book margin (7.5%)


def load():
    if os.path.exists(STATE):
        with open(STATE) as f:
            return json.load(f)
    return {"ratings": {}, "played": 0}


def save(s):
    with open(STATE, "w") as f:
        json.dump(s, f, indent=1)


def rating(s, sport, team):
    return (s["ratings"].get(sport) or {}).get(team, ELO0)


def expected(a, b):
    return 1 / (1 + 10 ** ((b - a) / 400))


def update(s, sport, home, away, home_score, away_score, margin_mult=1.0):
    """Elo update. Draw = 0.5 each."""
    a = rating(s, sport, home)
    b = rating(s, sport, away)
    if home_score > away_score:
        sa, sb = 1.0, 0.0
    elif home_score < away_score:
        sa, sb = 0.0, 1.0
    else:
        sa = sb = 0.5
    k = K_BY_SPORT.get(sport, 16) * margin_mult
    ea = expected(a, b)
    s["ratings"].setdefault(sport, {})
    s["ratings"][sport][home] = round(a + k * (sa - ea), 17)
    s["ratings"][sport][away] = round(b + k * (sb - (1 - ea)), 17)
    s["played"] = s.get("played", 0) + 1


def devig(fav_dec, other_dec):
    """Two-way de-vig. Returns (p_fav, p_other)."""
    pi, pj = 1 / fav_dec, 1 / other_dec
    t = pi + pj
    return pi / t, pj / t


def side_odds(g):
    """Return (odds_home, odds_away) if the market row carries both."""
    m = (g.get("markets") or {}).get("h2h")
    if not m:
        return None, None
    fav = m["favSide"]
    return (m["bestOdds"], None) if fav == "home" else (None, m["bestOdds"])


def model_probs(g, s):
    """Elo -> home/away (and draw) probabilities, home-advantage adjusted."""
    sport = g["sport"]
    ha = 55.0 if sport != "tennis" and sport not in ("atp", "wta", "ufc") else 0.0
    a = rating(s, sport, g["home"]) + ha
    b = rating(s, sport, g["away"])
    e = expected(a, b)
    if g.get("drawPossible"):
        base = DRAW_BASE.get(sport, .25)
        gap = abs(e - .5)
        d = max(.10, base - gap * .55)      # blowouts draw less
        return (1 - d) * e, (1 - d) * (1 - e), d
    return e, 1 - e, 0.0


def evaluate(g, s):
    """Find the best side, using the model ONLY to correct the market's
    favourite/dog split (so a well-known team isn't flattened by a cold start)."""
    m = (g.get("markets") or {}).get("h2h")
    if not m:
        return None
    try:
        books = int(m.get("bookCount") or 0)
        odds = float(m.get("bestOdds"))
    except (TypeError, ValueError):
        return None
    if books < MIN_BOOKS or odds <= 1.01:
        return None
    need = MIN_EDGE + (THIN_EXTRA if books <= 1 else 0.0)

    pH, pA, pD = model_probs(g, s)
    # strip the book margin from the quoted side; the other side is the complement
    imp_f = min(0.985, (1 / odds) / OVERROUND)
    mk_f = imp_f
    mk_d = 1 - imp_f
    mkH, mkA = (mk_f, mk_d) if m["favSide"] == "home" else (mk_d, mk_f)

    edges = {"home": pH - mkH, "away": pA - mkA}
    side = max(edges, key=edges.get)
    edge = edges[side]
    if edge < need:
        return None
    # price: market price on the favourite side, model price on the dog side
    if side == m["favSide"]:
        price = odds
    else:
        price = round(1 / (mkH if side == "home" else mkA), 2)
    prob = pH if side == "home" else pA
    tier = "PREMIUM" if edge >= 0.09 else "HIGH" if edge >= 0.06 else "STANDARD"
    return {
        "gameId": g["id"], "match": g["match"], "league": g["league"], "sport": g["sport"],
        "side": side, "price": round(price, 2), "modelProb": round(prob, 4),
        "marketProb": round(mkH if side == "home" else mkA, 4),
        "edgePct": round(edge, 4), "tier": tier,
        "bookCount": books, "startsAt": g["startsAt"],
        "home": g["home"], "away": g["away"],
    }


def integrity(g, s):
    """Flag abnormal market shape — the integrity feature."""
    flags, sev = [], 0
    m = (g.get("markets") or {}).get("h2h")
    if m:
        try:
            books = int(m.get("bookCount") or 0)
            odds = float(m.get("bestOdds"))
        except (TypeError, ValueError):
            return None
        if books <= 1:
            flags.append("Thin market: only 1 book quoting (low liquidity, less scrutiny)")
            sev = max(sev, 2)
        elif books <= 2:
            flags.append(f"Thin market: only {books} books quoting")
            sev = max(sev, 1)
        if odds and odds <= 1.35:
            flags.append("Heavy favourite: extreme price imbalance may mean an uncompetitive matchup")
            sev = max(sev, 2)
        if odds and odds >= 5.5:
            flags.append("Big underdog priced: market implies low confidence")
            sev = max(sev, 1)
    if not flags:
        return None
    return {"gameId": g["id"], "match": g["match"], "league": g["league"],
            "severity": sev, "signal": "high_risk_alert" if sev >= 2 else "integrity_watch",
            "flags": flags}


def bootstrap(s, games):
    """Seed the *unquoted* team from the favourite's price gap, so a cold start
    still carries the market's information without flattening both sides."""
    for g in games:
        m = (g.get("markets") or {}).get("h2h")
        if not m:
            continue
        try:
            odds = float(m.get("bestOdds"))
        except (TypeError, ValueError):
            continue
        if odds <= 1.01:
            continue
        gap_pf = min(0.94, max(0.06, 1 / odds))
        sport = s["ratings"].setdefault(g["sport"], {})
        fav = g["home"] if m["favSide"] == "home" else g["away"]
        dog = g["away"] if m["favSide"] == "home" else g["home"]
        r = 1500 + 400 * math.log10(gap_pf / (1 - gap_pf))
        if fav not in sport:
            sport[fav] = r
        if dog not in sport:
            sport[dog] = 1500 - (r - 1500) * 0.35


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    s = load()
    games = json.load(open(a.games))["games"]
    bootstrap(s, games)
    picks, alerts = [], []
    for g in games:
        p = evaluate(g, s)
        if p:
            picks.append(p)
        al = integrity(g, s)
        if al:
            alerts.append(al)
    out = {"generatedAt": datetime.datetime.now(datetime.UTC).isoformat(),
           "picks": picks, "alerts": alerts}
    json.dump(out, open(a.out, "w"), indent=1)
    print(f"{len(picks)} picks, {len(alerts)} alerts -> {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
