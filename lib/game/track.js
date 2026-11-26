// Procedural course generator. Everything is boxes, so the whole game ships with
// zero art assets — nothing to license, nothing to copy, endless content.
import { rng, range, pick, chance } from "./rng.js";
import { hopFeasible } from "./reach.js";

export const LANE = 2.3;      // lateral step between platform centres
export const PLAT_H = 0.5;

// A run of segments. Segment index drives difficulty, so the course escalates
// instead of being a flat random walk.
export function buildTrack(seed, count = 110) {
  const r = rng(seed);
  const segs = [];
  let z = 0;
  let y = 0;
  let lane = 0;

  // the start pad is wide and calm so the first second teaches the controls
  segs.push({ z: 0, y: 0, w: 4.2, d: 4.2, lane: 0, kind: "start" });

  for (let i = 1; i < count; i++) {
    const t = i / count;                     // 0 -> 1 difficulty ramp
    const last = segs[segs.length - 1];

    // try random candidates; keep the first that clears the reach test, and
    // finally fall back to a short hop toward the same lane so it always lands.
    let seg = null;
    for (let attempt = 0; attempt < 8 && !seg; attempt++) {
      const lazy = attempt >= 5;
      const gap = lazy ? 1.0 : range(r, 1.0 + t * 0.5, 1.5 + t * 0.8);
      let nl = lane;
      if (!lazy && chance(r, 0.34 + t * 0.36)) {
        nl = Math.max(-2, Math.min(2, lane + (chance(r, 0.5) ? -1 : 1)));
      }
      let ny = y;
      if (!lazy && chance(r, 0.3)) ny += (chance(r, 0.5) ? 1 : -1) * range(r, 0.35, 0.85);
      ny = Math.max(-2.5, Math.min(7, ny));

      // width never drops below the player's landing tolerance (~2 blocks);
      // difficulty comes from gaps and lane changes instead
      const w = Math.max(2.3, range(r, 4.6, 2.7) - t * 0.25);
      const d = Math.max(2.1, range(r, 4.6, 2.9) - t * 0.2);
      // gaps are measured edge-to-edge from the last platform's near edge
      const dz = last.z - last.d / 2 - gap - d / 2;
      const cand = { z: dz, y: ny, w, d, lane: nl, kind: "plat" };

      if (hopFeasible(box(last), box(cand))) seg = cand;
      else if (lazy) {
        const safeD = 2.0;
        seg = { ...cand, lane, y: Math.max(-2.5, Math.min(7, y)), z: last.z - last.d / 2 - safeD };
      }
    }

    const roll = r();
    if (i > 12 && roll < 0.06 + t * 0.13) seg.kind = "move";
    else if (i > 18 && roll < 0.2 + t * 0.16) seg.kind = "crumble";
    else if (i > 8 && roll > 1 - (0.05 + t * 0.1)) seg.kind = "lava";
    if (seg.kind === "move") {
      seg.amp = range(r, 0.8, 1.9);
      seg.speed = range(r, 0.5, 1.1);
      seg.phase = r() * Math.PI * 2;
    }
    if (seg.kind === "crumble") { seg.fuse = 0.85; seg.d = Math.max(seg.d, 3.0); }

    segs.push(seg);
    z = seg.z; y = seg.y; lane = seg.lane;

    // a stretch where two routes exist — expression, not just survival
    if (i > 30 && chance(r, 0.26)) {
      const altLane = Math.max(-2, Math.min(2, lane + (chance(r, 0.5) ? 1 : -1)));
      if (altLane !== lane) {
        const alt = {
          ...seg,
          lane: altLane,
          // 1.4 ahead of the parent's near edge (z falls forward), so the two
          // are distinct depth-wise and either can be chosen cleanly
          z: seg.z - seg.d / 2 - 1.4 - seg.d / 2,
          w: Math.max(2.3, seg.w * 0.85),
          d: seg.d * 0.9,
          alt: true,
        };
        if (hopFeasible(box(last), box(alt))) segs.push(alt);
      }
    }
  }

  // finish: a long calm pad, so the ending lands rather than just stopping
  const end = segs[segs.length - 1];
  segs.push({ z: z - 5.5, y: end.y, w: 8, d: 14, lane: end.lane, kind: "finish" });
  return segs;
}

// cheap footprint used only for reach maths during generation
function box(s) {
  const x = s.lane * LANE;
  return {
    minX: x - s.w / 2, maxX: x + s.w / 2,
    minZ: s.z - s.d / 2, maxZ: s.z + s.d / 2,
    top: s.y, top_: s.y,
  };
}

// World-space box for a segment at a given time (moving platforms animate).
export function segBox(seg, time) {
  const x = seg.lane * LANE + (seg.kind === "move" ? Math.sin(time * seg.speed + seg.phase) * seg.amp : 0);
  const halfW = seg.w / 2;
  const halfD = seg.d / 2;
  return {
    // centre + half extents; y is the top surface, so the body sits on `min.y + h`
    x, y: seg.y, z: seg.z,
    minX: x - halfW, maxX: x + halfW,
    minZ: seg.z - halfD, maxZ: seg.z + halfD,
    top: seg.y, bottom: seg.y - PLAT_H,
    w: seg.w, d: seg.d,
  };
}

export function trackLength(segs) {
  const last = segs[segs.length - 1];
  return Math.abs(last.z) + 4;
}
