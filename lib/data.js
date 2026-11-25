// Shared data access. Everything the site shows is built by engine/cycle.py.
import fs from "node:fs";
import path from "node:path";

const DATA = path.join(process.cwd(), "data");

function read(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
  } catch {
    return fallback;
  }
}

export function getLive() {
  return read("state.json", { picks: [], alerts: [], record: null, generatedAt: null });
}

export function getGames() {
  return read("games.json", { games: [] }).games || [];
}

export function getLedger() {
  const led = read("ledger.json", { items: [] });
  return led.items || [];
}

export function readBacktest() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, "backtest.json"), "utf8")).items || [];
  } catch {
    return [];
  }
}

// What the replay actually covered, so the page can qualify its own numbers.
export function backtestMeta() {
  const items = readBacktest();
  return { sports: new Set(items.map((i) => i.sport)).size, graded: items.length };
}

// Graded outcomes only. `forward` is the real published record (picks locked
// live, graded as games settle); `backtest` is a replay and never mixed into it.
function tally(items) {
  const graded = items.filter((i) => i.result === "correct" || i.result === "wrong");
  const won = graded.filter((i) => i.result === "correct").length;
  const last = graded.slice(-50);
  return {
    graded: graded.length,
    correct: won,
    wrong: graded.length - won,
    accuracy: graded.length ? won / graded.length : null,
    rolling: last.length ? last.filter((i) => i.result === "correct").length / last.length : null,
    units: Math.round(graded.reduce((a, i) => a + (i.profitUnits || 0), 0) * 100) / 100,
  };
}

export function getForwardRecord() {
  const items = getLedger();
  return { ...tally(items), recent: tally(items) && items.filter((i) => i.result).slice(-25).reverse() };
}

// Combined totals across both sources, carried explicitly so callers can label them.
export function getRecord() {
  const forward = tally(getLedger());
  const backtest = tally(readBacktest());
  const graded = [...readBacktest(), ...getLedger()].filter(
    (i) => i.result === "correct" || i.result === "wrong"
  );
  return {
    graded: forward.graded + backtest.graded,
    correct: forward.correct + backtest.correct,
    wrong: forward.wrong + backtest.wrong,
    accuracy: graded.length ? (forward.correct + backtest.correct) / graded.length : null,
    rolling: forward.rolling,
    units: Math.round((forward.units + backtest.units) * 100) / 100,
    forward,
    backtest,
    recent: graded.slice(-25).reverse(),
  };
}

export function getIntegrity() {
  return (getLive().alerts || []).slice(0, 24);
}

// Premium live board — in-play get-in / exit signals, written by engine/live.py
export function getSignals() {
  return read("live.json", { signals: [] }).signals || [];
}

export const SPORT_LABEL = {
  nba: "NBA", nfl: "NFL", mlb: "MLB", nhl: "NHL", ncaab: "NCAAB", ncaaf: "NCAAF", wnba: "WNBA",
  epl: "EPL", laliga: "La Liga", seriea: "Serie A", bundesliga: "Bundesliga",
  ligue1: "Ligue 1", ucl: "Champions League", uel: "Europa League", mls: "MLS",
  brasileirao: "Brazil Série A", ligaprof: "Argentina Primera", superlig: "Turkish Süper Lig",
  ligapt: "Primeira Liga", eredivisie: "Eredivisie", ligamx: "Liga MX",
  atp: "ATP", wta: "WTA", ufc: "UFC", esports: "Esports",
};

export function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
