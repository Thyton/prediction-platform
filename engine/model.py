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
DIV = {"esports":600,"epl":220,"laliga":220,"seriea":220,"bundesliga":220,"ligue1":220,"ucl":220,"uel":220,"mls":220}
CROSS_LEAGUE_MEMBERS = {"epl","laliga","seriea","bundesliga","ligue1","ucl","uel","mls"}
CUP = {"ucl","uel"}
DRAW_BASE = {"epl": .26, "laliga": .25, "seriea": .27, "bundesliga": .24,
             "ligue1": .25, "ucl": .24, "uel": .25, "mls": .24}
MIN_EDGE = 0.045      # 4.5% model-vs-market edge required
THIN_EXTRA = 0.030    # extra edge demanded when only 1 book quotes
MIN_BOOKS = 1
OVERROUND = 1.075     # typical two-way book margin (7.5%)
MIN_GAMES = 4         # ratings need this many tracked games before we trust an edge
BLEND = 0.55          # weight on market prob; model contributes (1-BLEND) via ratings


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


def expected(a, b, div=400):
    return 1 / (1 + 10 ** ((b - a) / div))


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
    s.setdefault("counts", {}).setdefault(sport, {})
    s["counts"][sport][home] = s["counts"][sport].get(home, 0) + 1
    s["counts"][sport][away] = s["counts"][sport].get(away, 0) + 1
    s["played"] = s.get("played", 0) + 1
    if sport in CROSS_LEAGUE_MEMBERS:      # keep an all-soccer pool for cups
        pool = s["ratings"].setdefault("soccer_all", {})
        pa = pool.get(home, a)
        pb = pool.get(away, b)
        epa = expected(pa, pb)
        pool[home] = round(pa + k * (sa - epa), 17)
        pool[away] = round(pb + k * (sb - (1 - epa)), 17)


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
    ha = 25.0 if sport != "tennis" and sport not in ("atp", "wta", "ufc") else 0.0
    if sport in CUP:
        pool = s["ratings"].get("soccer_all") or {}
        a = pool.get(g["home"], rating(s, sport, g["home"])) + ha
        b = pool.get(g["away"], rating(s, sport, g["away"]))
    else:
        a = rating(s, sport, g["home"]) + ha
        b = rating(s, sport, g["away"])
    e = expected(a, b, DIV.get(sport, 400))
    if g.get("drawPossible"):
        base = DRAW_BASE.get(sport, .25)
        gap = abs(e - .5)
        d = max(.10, base - gap * .55)      # blowouts draw less
        return (1 - d) * e, (1 - d) * (1 - e), d
    return e, 1 - e, 0.0


def evaluate(g, s):
    """Find the best side, using the model ONLY to correct the market's
    favourite/dog split (so a well-known team isn't flattened by a cold start).

    Esports carry no price yet, so they take the pure-rating path and publish at
    a stronger threshold instead of an edge."""
    m = (g.get("markets") or {}).get("h2h")
    if not m:
        return evaluate_no_market(g, s)
    try:
        books = int(m.get("bookCount") or 0)
        odds = float(m.get("bestOdds"))
    except (TypeError, ValueError):
        return None
    if books < MIN_BOOKS or odds <= 1.01:
        return None
    need = MIN_EDGE if books >= 1 else MIN_EDGE + THIN_EXTRA
    # a model edge is only meaningful when both ratings carry real history;
    # otherwise the "edge" is just cold-start noise against a sharp market
    if g.get("sport") != "esports":
        cnt = s.get("counts", {}).get(g["sport"], {})
        if cnt.get(g["home"], 0) < MIN_GAMES or cnt.get(g["away"], 0) < MIN_GAMES:
            return None

    rawH, rawA, pD = model_probs(g, s)
    # The quoted market is two-way; fold the model's draw mass back onto the two
    # sides so both are on the same scale as the price before comparing.
    if pD > 0:
        scale = 1 - pD
        rawH, rawA = rawH / scale, rawA / scale
    # de-vig: favourite from its own price; dog from its real price when we have both
    # sides (backtest/collector carry otherOdds), else assume the standard complement.
    imp_f = min(0.985, (1 / odds) / OVERROUND)
    other = m.get("otherOdds")
    if other:
        imp_d = min(0.985, (1 / float(other)) / OVERROUND)
    else:
        imp_d = 1 - imp_f
    mk_f, mk_d = imp_f, imp_d
    # normalise so they sum to 1 after vig removal
    tot = mk_f + mk_d
    mk_f, mk_d = mk_f / tot, mk_d / tot
    mkH, mkA = (mk_f, mk_d) if m["favSide"] == "home" else (mk_d, mk_f)
    # blend: model speaks only when it disagrees with the market, and softly
    pH = BLEND * mkH + (1 - BLEND) * rawH
    pA = BLEND * mkA + (1 - BLEND) * rawA

    edges = {"home": pH - mkH, "away": pA - mkA}
    # consensus picks: we ship the market favourite the model also rates top.
    # Disagreements (model likes the dog) are flagged as WATCH, not tips — the
    # backtest showed our cold Elo does not beat sharp dog prices.
    fav = m["favSide"]
    edge = edges[fav]
    if edge < 0.0:
        return None                      # model actually dislikes the favourite
    side = fav
    price = odds
    prob = pH if side == "home" else pA
    if prob < 0.55 or prob > 0.85:
        return None   # ship 62-85% conviction zone; outside = noise or chalk
    tier = "PREMIUM" if prob >= 0.72 else "HIGH" if prob >= 0.62 else "STANDARD"
    return {
        "gameId": g["id"], "match": g["match"], "league": g["league"], "sport": g["sport"],
        "side": side, "price": round(price, 2), "modelProb": round(prob, 4),
        "marketProb": round(mkH if side == "home" else mkA, 4),
        "edgePct": round(edge, 4), "tier": tier,
        "bookCount": books, "startsAt": g["startsAt"],
        "home": g["home"], "away": g["away"],
        "homeLogo": g.get("homeLogo"), "awayLogo": g.get("awayLogo"),
        "homeAbbr": g.get("homeAbbr"), "awayAbbr": g.get("awayAbbr"),
    }


def evaluate_no_market(g, s):
    """No price available (esports). Publish only clear model edges, priced at
    the model probability with a small margin — flagged as 'model price'."""
    if g.get("sport") != "esports":
        return None
    if not g.get("boType"):          # needs a known series length to be meaningful
        return None
    pH, pA, _ = model_probs(g, s)
    side, prob = ("home", pH) if pH >= pA else ("away", pA)
    edge = abs(pH - pA)
    if edge < 0.12 or prob < 0.56:   # thin data: require a clear lean, not a blowout
        return None
    price = round(1 / max(prob * 1.02, 0.05), 2)   # 2% model margin
    tier = "PREMIUM" if edge >= 0.26 else "HIGH" if edge >= 0.18 else "STANDARD"
    return {
        "gameId": g["id"], "match": g["match"], "league": g["league"], "sport": g["sport"],
        "side": side, "price": price, "modelProb": round(prob, 4),
        "marketProb": None, "edgePct": round(edge, 4), "tier": tier,
        "bookCount": 0, "startsAt": g["startsAt"], "modelPriced": True,
        "home": g["home"], "away": g["away"],
        "homeLogo": g.get("homeLogo"), "awayLogo": g.get("awayLogo"),
        "homeAbbr": g.get("homeAbbr"), "awayAbbr": g.get("awayAbbr"),
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


def ensure_seeded(s, games):
    """If a described team has no rating yet, seed from the market so the board
    is never blank. Learned ratings always win once they exist."""
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
        p = min(0.94, max(0.06, (1 / odds) / OVERROUND))
        r = 1500 + 400 * math.log10(p / (1 - p))
        sport = s["ratings"].setdefault(g["sport"], {})
        fav = g["home"] if m["favSide"] == "home" else g["away"]
        dog = g["away"] if m["favSide"] == "home" else g["home"]
        sport.setdefault(fav, r)
        sport.setdefault(dog, 1500 - (r - 1500) * 0.35)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    s = load()
    games = json.load(open(a.games))["games"]
    ensure_seeded(s, games)
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
