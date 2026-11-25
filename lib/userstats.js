// Per-user record helpers. A member's own W/L is computed from the picks they
// followed, joined against the graded ledger — never from the headline numbers.
import { getLedger } from "./data";

export function ledgerMap() {
  const m = new Map();
  for (const i of getLedger()) m.set(i.gameId, i);
  return m;
}

export function followsOf(user) {
  const f = user?.follows;
  if (!f) return [];
  return Array.isArray(f) ? f : Object.keys(f).map((gameId) => ({ gameId, ...(f[gameId] || {}) }));
}

export function personalRecord(user) {
  const followed = followsOf(user);
  const ledger = ledgerMap();
  const items = followed
    .map((f) => ({ ...(ledger.get(f.gameId) || {}), followedAt: f.ts, stake: f.stake || 1 }))
    .filter((i) => i.gameId);
  // pushes settle the stake back, so they count as graded but not as win/loss
  const graded = items.filter((i) => ["correct", "wrong", "push"].includes(i.result));
  const won = graded.filter((i) => i.result === "correct").length;
  const lost = graded.filter((i) => i.result === "wrong").length;
  const units = graded.reduce((a, i) => {
    if (i.result === "push") return a;
    return a + (i.result === "correct" ? (Number(i.price) - 1) * i.stake : -1 * i.stake);
  }, 0);
  // current streak: walk backwards from the newest graded pick
  let streak = 0;
  const newest = graded.length ? graded[graded.length - 1].result : null;
  for (let k = graded.length - 1; k >= 0; k--) {
    if (graded[k].result !== newest) break;
    streak++;
  }
  const streakKind = newest;
  const bySport = {};
  for (const i of graded) {
    const s = i.sport || "other";
    bySport[s] = bySport[s] || { w: 0, l: 0 };
    if (i.result !== "push") bySport[s][i.result === "correct" ? "w" : "l"]++;
  }
  return {
    open: items.filter((i) => !i.result),
    graded,
    won,
    lost,
    units: Math.round(units * 100) / 100,
    accuracy: graded.length ? won / graded.length : null,
    streak,
    streakKind,
    bySport,
  };
}

export function isFollowing(user, gameId) {
  const f = user?.follows;
  if (!f) return false;
  return Array.isArray(f) ? f.some((x) => x.gameId === gameId) : Boolean(f[gameId]);
}
