// Shared data access. Everything the site shows is built by engine/cycle.py.
import fs from "node:fs";
import path from "node:path";

const DATA = path.join(process.cwd(), "data");

export { fmtTime, SPORT_LABEL } from "./labels";

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
  // pushes (draws) settle the stake but are neither a win nor a loss
  const graded = items.filter((i) => ["correct", "wrong", "push"].includes(i.result));
  const won = graded.filter((i) => i.result === "correct").length;
  const last = graded.slice(-50);
  return {
    graded: graded.length,
    correct: won,
    wrong: graded.filter((i) => i.result === "wrong").length,
    push: graded.filter((i) => i.result === "push").length,
    accuracy: graded.length ? won / graded.length : null,
    rolling: last.length ? last.filter((i) => i.result === "correct").length / last.length : null,
    units: Math.round(graded.reduce((a, i) => a + (i.profitUnits || 0), 0) * 100) / 100,
  };
}

// Current run of the same outcome, newest backwards. A push breaks nothing —
// it settles the stake back, so it neither extends nor ends a streak.
export function streakOf(items) {
  const graded = items
    .filter((i) => ["correct", "wrong", "push"].includes(i.result))
    .sort((a, b) => new Date(a.settledAt || 0) - new Date(b.settledAt || 0));
  let kind = null;
  let n = 0;
  for (let k = graded.length - 1; k >= 0; k--) {
    const r = graded[k].result;
    if (r === "push") continue;
    if (kind === null) kind = r;
    if (r !== kind) break;
    n++;
  }
  return { kind, n };
}


export function getForwardRecord() {
  const items = getLedger();
  return { ...tally(items), recent: tally(items) && items.filter((i) => i.result).slice(-25).reverse() };
}

// Per-sport forward performance — the shape of the record, not just the total.
// Public on purpose: a sport we are cold on should be visible, not averaged away.
export function getBySport() {
  const rows = {};
  for (const i of getLedger()) {
    if (!i.result) continue;
    const s = i.sport || "other";
    const d = (rows[s] = rows[s] || { sport: s, w: 0, l: 0, p: 0, units: 0 });
    if (i.result === "push") d.p++;
    else if (i.result === "correct") d.w++;
    else d.l++;
    d.units += i.profitUnits || 0;
  }
  return Object.values(rows)
    .map((d) => {
      const scored = d.w + d.l;
      return { ...d, units: Math.round(d.units * 100) / 100, accuracy: scored ? d.w / scored : null };
    })
    .sort((a, b) => b.w + b.l - (a.w + a.l));
}


// Combined totals across both sources, carried explicitly so callers can label them.
export function getRecord() {
  const forward = tally(getLedger());
  const backtest = tally(readBacktest());
  const graded = [...readBacktest(), ...getLedger()].filter((i) =>
    ["correct", "wrong", "push"].includes(i.result)
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
    recent: graded.slice(-50).reverse(),
  };
}

// Only genuine anomalies by default — thin alone is a caution, so listing every
// thin market drowned the tab. Counts are carried so nothing is hidden.
export function getIntegrity() {
  const all = getLive().alerts || [];
  return {
    high: all.filter((a) => a.severity >= 2).slice(0, 40),
    watch: all.filter((a) => a.severity < 2).slice(0, 40),
    total: all.length,
  };
}

// Premium live board — in-play get-in / exit signals, written by engine/live.py
export function getSignals() {
  return read("live.json", { signals: [] }).signals || [];
}


