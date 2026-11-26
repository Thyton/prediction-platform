// Structural validator. Every generated course must pass without physics:
// each consecutive hop has to be inside the sloppy-player reach, and every
// landing platform has to be wide enough to catch a careless arc.
import { buildTrack, LANE } from "./track.js";
import { hopFeasible, reachFor } from "./reach.js";
import { seedFromDate } from "./rng.js";
import { CFG } from "./physics.js";

const MIN_LANDING_W = 1.8;
const EDGE_MARGIN = 0.3;   // keep the target line off the very lip

export function validate(segs) {
  const problems = [];
  for (let i = 1; i < segs.length; i++) {
    const a = segs[i - 1], b = segs[i];
    const ax = a.lane * LANE, bx = b.lane * LANE;
    const A = {
      minX: ax - a.w / 2, maxX: ax + a.w / 2,
      minZ: a.z - a.d / 2, maxZ: a.z + a.d / 2, top: a.y,
    };
    const B = {
      minX: bx - b.w / 2, maxX: bx + b.w / 2,
      minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, top: b.y,
    };
    if (!hopFeasible(A, B)) {
      problems.push(`seg ${i}: hop out of reach`);
      continue;
    }
    // the landing platform must be wide enough for the widest realistic arc.
    // Alt-route platforms are a bonus lane, so they get a looser floor.
    const floor = b.alt ? 1.5 : MIN_LANDING_W;
    const clearance = b.w - EDGE_MARGIN * 2;
    if (clearance < floor) problems.push(`seg ${i}: landing too narrow (${b.w.toFixed(2)})`);
    // and the hop must fit the walk-and-hop speed, not just a sprint
    const walkReach = reachFor(b.y - a.y, CFG.maxSpeed);
    const need = Math.max(0, A.minZ - B.maxZ);
    if (need > walkReach) problems.push(`seg ${i}: needs a sprint (${need.toFixed(2)} > ${walkReach.toFixed(2)})`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const n = Number(process.argv[2] || 50);
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const seed = seedFromDate(new Date(Date.UTC(2026, 0, 1) + i * 86400000));
    const p = validate(buildTrack(seed));
    if (p.length) { bad++; if (bad <= 6) console.log("seed", i, "->", p.slice(0, 3).join("; ")); }
  }
  console.log(`clean ${n - bad}/${n}`);
  console.log("today:", validate(buildTrack(seedFromDate())).length || "clean");
}
