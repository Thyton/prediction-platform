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

export function getRecord() {
  const items = [...readBacktest(), ...getLedger()];
  const graded = items.filter((i) => i.result === "correct" || i.result === "wrong");
  const won = graded.filter((i) => i.result === "correct").length;
  const last = graded.slice(-50);
  const lastWon = last.filter((i) => i.result === "correct").length;
  return {
    graded: graded.length,
    correct: won,
    wrong: graded.length - won,
    accuracy: graded.length ? won / graded.length : null,
    rolling: last.length ? lastWon / last.length : null,
    units: Math.round(graded.reduce((a, i) => a + (i.profitUnits || 0), 0) * 100) / 100,
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
  nba: "NBA", nfl: "NFL", mlb: "MLB", nhl: "NHL", ncaab: "NCAAB", wnba: "WNBA",
  epl: "EPL", laliga: "La Liga", seriea: "Serie A", bundesliga: "Bundesliga",
  ligue1: "Ligue 1", ucl: "Champions League", uel: "Europa League", mls: "MLS",
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
