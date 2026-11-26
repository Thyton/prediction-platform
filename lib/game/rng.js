// Deterministic PRNG (mulberry32). Same seed => same track for every player,
// which is what makes a daily leaderboard fair and a ghost replay meaningful.
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromDate(d = new Date()) {
  // UTC year-month-day folded into 32 bits — changes once a day, everywhere.
  const s = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// helpers that read better at the call site than raw floats
export const range = (r, lo, hi) => lo + r() * (hi - lo);
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
export const chance = (r, p) => r() < p;
