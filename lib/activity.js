// Daily activity: everything the desk did, newest first. An entry is a pick
// locked with its price; a settle is a grade with its result; a push is a
// refunded stake. This is the "why come back" surface — it shows the desk
// working every day, win or lose.
import { getLedger } from "./data";

export function getActivity() {
  const items = getLedger();
  const events = [];
  for (const p of items) {
    const base = {
      sport: p.sport, match: p.match, price: p.price,
      modelPriced: p.modelPriced, espnUrl: p.espnUrl,
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
  return events.slice(0, 40);
}
