// Headless completability check. A simple greedy bot runs each seed; if a bot
// can finish, a human can. Run: node lib/game/simulate.mjs
import { buildTrack, segBox } from "./track.js";
import { newPlayer, step, CFG, progressOf } from "./physics.js";
import { seedFromDate } from "./rng.js";

// The bot carries a target platform index and only advances it once that
// platform is behind it, so it can't lose track mid-air.
export function botInput(p, segs, time, state) {
  // Advance the target only while standing, so a jump can't be retargeted
  // mid-air. z falls as the course goes on: a platform is behind once its near
  // edge (maxZ) is above our position.
  while (p.onGround && state.tgt < segs.length - 1 &&
         segs[state.tgt].z + segs[state.tgt].d / 2 > p.z) {
    state.tgt++;
  }
  const here = segs[p.seg] ? segBox(segs[p.seg], time) : null;
  const tgtBox = segBox(segs[state.tgt], time);
  const wantX = (tgtBox.minX + tgtBox.maxX) / 2;
  const wantZ = (tgtBox.minZ + tgtBox.maxZ) / 2;

  const speed = Math.hypot(p.vx, p.vz);
  const rise = tgtBox.top - p.y;
  const g = CFG.gravity;

  // Face the landing spot: on the ground that's the near edge, in the air the
  // middle of the platform.
  const faceZ = p.onGround ? tgtBox.maxZ : wantZ;
  const faceX = p.onGround ? wantX : wantX;
  p.yaw = Math.atan2(-(faceX - p.x), -(faceZ - p.z));

  // A sprint jump clears `speed * airtime` metres in whatever direction we
  // travel. Launch when the hop fits, and always at the lip so a platform that
  // runs out can't be walked off. (`here` is null when we're mid-air.)
  const airtime = (CFG.jump + Math.sqrt(Math.max(0, CFG.jump * CFG.jump - 2 * g * rise))) / g;
  const need = Math.hypot(Math.max(0, p.z - tgtBox.maxZ), Math.abs(wantX - p.x));
  const lip = here ? p.z - here.minZ : 99;
  const jump = p.onGround && speed > 3.0 && (need <= speed * airtime * 0.9 || lip < 0.5);

  // Steer: push forward, and strafe toward the target's centreline. Deadband
  // the lateral error so the bot doesn't oscillate over the centre in the air.
  const lateral = wantX - p.x;
  const strafe = Math.abs(lateral) < 0.25 ? 0 : Math.max(-1, Math.min(1, lateral * 0.8));
  let fwd = 1;
  if (!p.onGround && p.vy < 0) {
    const dropTo = Math.max(0, p.y - tgtBox.top);
    const tLand = (-p.vy + Math.sqrt(p.vy * p.vy + 2 * g * dropTo)) / g;
    const landZ = p.z + p.vz * tLand;
    if (landZ < wantZ - 0.3) fwd = -0.7;
    else if (landZ > wantZ + 0.3) fwd = 1;
    else fwd = 0.3;
  }
  return { fwd, strafe, jump, sprint: true };
}

export function runSeed(seed, segsArg) {
  const segs = segsArg || buildTrack(seed);
  const p = newPlayer(segs);
  const state = { tgt: 1 };
  let t = 0;
  const maxT = 400;
  let bestProg = 0;
  let stuckFor = 0;
  while (t < maxT) {
    const input = botInput(p, segs, t, state);
    step(p, input, segs, t);
    t += CFG.step;
    const prog = progressOf(p, segs);
    if (prog > bestProg + 0.01) { bestProg = prog; stuckFor = 0; }
    else stuckFor += CFG.step;
    if (!p.alive) return { ok: false, why: "fell", prog: bestProg, t };
    if (stuckFor > 8) return { ok: false, why: "stuck", prog: bestProg, t };
    const finish = segs[segs.length - 1];
    if (p.z <= finish.minZ + 2) return { ok: true, t, prog: bestProg };
  }
  return { ok: false, why: "timeout", prog: bestProg, t };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const seeds = Number(process.argv[2] || 40);
  let pass = 0;
  const fails = [];
  for (let i = 0; i < seeds; i++) {
    const r = runSeed(seedFromDate(new Date(Date.UTC(2026, 0, 1) + i * 86400000)));
    if (r.ok) pass++;
    else fails.push({ seed: i, ...r });
  }
  console.log(`pass ${pass}/${seeds}`);
  for (const f of fails.slice(0, 12)) console.log(" fail", f.seed, f.why, "progress", f.prog.toFixed(1));
  console.log(`today seed ok:`, runSeed(seedFromDate()).ok);
}
