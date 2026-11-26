// Daily activity: everything the desk did, newest first. An entry is a pick
// locked with its price; a settle is a grade with its result; a push is a
// refunded stake. This is the "why come back" surface — it shows the desk
// working every day, win or lose, and it does not hide the bad days.
import { getLedger } from "./data";

const LIMIT = 120;   // deep enough to scroll a week of work, cheap to render

export function getActivity() {
  const items = getLedger();
  const events = [];
  for (const p of items) {
    const base = {
      sport: p.sport, match: p.match, price: p.price, league: p.league,
      modelPriced: p.modelPriced, espnUrl: p.espnUrl, why: p.why,
    };
    events.push({ ...base, type: "entry", at: p.lockTs, gameId: p.gameId });
    if (p.result === "push") {
      events.push({ ...base, type: "push", at: p.settledAt, gameId: p.gameId });
    } else if (p.result) {
      events.push({
        ...base, type: "settle", at: p.settledAt, gameId: p.gameId,
        result: p.result, final: p.final, units: p.profitUnits,
      });
    }
  }
  events.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  return events.slice(0, LIMIT);
}

// Per-day tally for the strip above the feed: how many were locked, how many
// settled, and what the day cost or made.
export function getActivityDays() {
  const days = new Map();
  for (const p of getLedger()) {
    const at = p.settledAt || p.lockTs;
    if (!at) continue;
    const k = new Date(at).toISOString().slice(0, 10);
    const d = days.get(k) || { day: k, locked: 0, settled: 0, w: 0, l: 0, units: 0 };
    if (p.lockTs) d.locked++;
    if (["correct", "wrong", "push"].includes(p.result)) {
      d.settled++;
      if (p.result === "correct") d.w++;
      if (p.result === "wrong") d.l++;
      d.units += p.profitUnits || 0;
    }
    days.set(k, d);
  }
  return [...days.values()]
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .slice(0, 30)
    .map((d) => ({ ...d, units: Math.round(d.units * 100) / 100 }));
}
