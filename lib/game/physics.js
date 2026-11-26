// First-person platformer physics. Pure functions over a state object so the
// whole thing is testable without a browser and replays identically.
import { segBox, LANE } from "./track.js";

export const CFG = {
  gravity: 26,
  jump: 8.6,
  accel: 46,
  airAccel: 15,
  friction: 11,
  maxSpeed: 5.0,
  sprintMul: 1.3,
  coyote: 0.11,
  jumpBuffer: 0.12,
  step: 1 / 120,            // fixed timestep
  halfW: 0.34,
  height: 1.68,
  eye: 1.5,
  coyoteFall: 0.28,         // how far below the feet a ledge still counts
  stepUp: 0.62,             // ledges up to this height are walked over, not jumped
  jumpClear: 1.45,          // while rising, platform lips this far up are passed through
  jumpCut: 3.2,             // releasing jump above this vertical speed clips the rise
  jumpMinSteps: 30,         // steps before a release may clip (keeps a tap a hop, not a stub)
  bounce: 10.4,             // bounce pads: a lift, not a launch into orbit
};

export function newPlayer(segs) {
  const s = segs[0];
  return {
    x: s.lane * LANE, y: s.y + 0.001, z: s.z + s.d / 2 - 1.2,
    vx: 0, vy: 0, vz: 0,
    yaw: 0,                   // yaw 0 faces -Z, straight down the course
    pitch: 0,
    onGround: true,
    coyote: 0, jumpBuf: 0,
    sprint: false,
    seg: 0,
    lastGroundZ: s.z + 2,
    alive: true, finished: false,
    time: 0,
  };
}

// Input is {fwd: -1..1, strafe: -1..1, jump: bool, sprint: bool}
export function step(p, input, segs, time, dt = CFG.step) {
  if (!p.alive || p.finished) return p;

  // --- horizontal intent in world space, from yaw ---
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  let ix = input.strafe * cos - input.fwd * sin;
  let iz = -input.strafe * sin - input.fwd * cos;
  const il = Math.hypot(ix, iz);
  if (il > 1) { ix /= il; iz /= il; }

  const speedCap = input.sprint ? CFG.maxSpeed * CFG.sprintMul : CFG.maxSpeed;
  const accel = p.onGround ? CFG.accel : CFG.airAccel;

  // accelerate toward intent, capped so sprinting is a real choice with a cost
  const hs = Math.hypot(p.vx, p.vz);
  if (il > 0.01) {
    p.vx += ix * accel * dt;
    p.vz += iz * accel * dt;
    const ns = Math.hypot(p.vx, p.vz);
    if (ns > speedCap) { p.vx = (p.vx / ns) * speedCap; p.vz = (p.vz / ns) * speedCap; }
  } else if (p.onGround) {
    const f = Math.max(0, 1 - CFG.friction * dt);
    p.vx *= f; p.vz *= f;
    if (hs < 0.05) { p.vx = 0; p.vz = 0; }
  }

  // --- jump with coyote time + input buffer ---
  p.jumpBuf = input.jump ? CFG.jumpBuffer : Math.max(0, p.jumpBuf - dt);
  p.coyote = p.onGround ? CFG.coyote : Math.max(0, p.coyote - dt);
  // variable jump height: release mid-rise and the arc is clipped, so a tap is
  // a short hop and holding is a full jump. jumpMinSteps keeps a quick tap from
  // collapsing into nothing before it has risen.
  if (!input.jump && !p.onGround && p.vy > CFG.jumpCut && p.jumpSteps >= CFG.jumpMinSteps) p.vy = CFG.jumpCut;

  if (p.jumpBuf > 0 && p.coyote > 0) {
    p.vy = CFG.jump;
    p.jumpSteps = 0;
    // a small forward nudge on launch, so a standing jump still reaches the
    // next block instead of dropping straight down
    if (hs < CFG.maxSpeed * 0.8 && il > 0.01) { p.vx += ix * 2.2; p.vz += iz * 2.2; }
    p.jumpBuf = 0; p.coyote = 0;
    p.onGround = false;
  }

  p.vy -= CFG.gravity * dt;

  // --- integrate X and Z, resolving platform faces ---
  moveAxis(p, segs, "x", p.vx * dt, time);
  moveAxis(p, segs, "z", p.vz * dt, time);

  // --- vertical: land on the highest surface under the feet ---
  const prevFeet = p.y;
  p.y += p.vy * dt;
  const wasGround = p.onGround;
  p.onGround = false;

  const feet = p.y;
  const head = p.y + CFG.height;
  let bestTop = -Infinity;
  for (let i = 0; i < segs.length; i++) {
    const b = segBox(segs[i], time);
    if (p.x + CFG.halfW < b.minX || p.x - CFG.halfW > b.maxX) continue;
    if (p.z + CFG.halfW < b.minZ || p.z - CFG.halfW > b.maxZ) continue;
    // only surfaces we were at/above (or that we're standing in) count as ground
    if (b.top <= prevFeet + 0.02 && b.top > bestTop && feet <= b.top + 0.02 && head > b.bottom) {
      bestTop = b.top;
    }
  }
  if (bestTop > -Infinity) {
    const on = segAt(segs, p, bestTop, time);
    p.y = bestTop + 0.0001;
    if (p.vy <= 0) {
      if (on && on.kind === "bounce") {
        p.vy = CFG.bounce;        // spring: launch instead of settling
        p.onGround = false;
        p.coyote = 0;
      } else {
        p.vy = 0;
        p.onGround = true;
      }
    }
  }

  // progress marker updates on contact with ANY surface, not only a settled
  // landing — a bounce pad launches on the same frame, so the player would
  // otherwise still be reported as standing on the previous platform.
  if (bestTop > -Infinity) p.seg = nearestSeg(p, segs, time);
  if (p.onGround) p.lastGroundZ = p.z;

  // --- fall out ---
  if (p.y < -14) p.alive = false;

  p.time += dt;
  return p;
}

function moveAxis(p, segs, axis, delta, time) {
  if (delta === 0) return;
  const before = p[axis];
  p[axis] += delta;
  const feet = p.y, head = p.y + CFG.height;
  for (let i = 0; i < segs.length; i++) {
    const b = segBox(segs[i], time);
    // skip anything not overlapping vertically (feet..head against slab)
    if (head < b.bottom || feet > b.top - 0.001) continue;
    if (p.x + CFG.halfW < b.minX || p.x - CFG.halfW > b.maxX) continue;
    if (p.z + CFG.halfW < b.minZ || p.z - CFG.halfW > b.maxZ) continue;
    // we're inside the slab footprint but above its top? then it's a floor, not a wall
    if (feet >= b.top - 0.001) continue;

    // step assist: shin-high ledges are walked up rather than stopping you dead
    const rise = b.top - feet;
    if (p.onGround && rise <= CFG.stepUp) {
      p.y = b.top + 0.0001;
      p.vy = 0;
      continue;
    }

    // Mantle while rising: mid-jump you must be able to carry forward momentum
    // over the lip of a higher platform instead of hitting it as a wall. A
    // full jump clears ~1.4m, so anything inside that is passable on the way up.
    if (!p.onGround && p.vy > 0 && rise <= CFG.jumpClear) continue;

    // push out along the axis we moved
    if (axis === "x") {
      p.x = delta > 0 ? b.minX - CFG.halfW : b.maxX + CFG.halfW;
      p.vx = 0;
    } else {
      p.z = delta > 0 ? b.minZ - CFG.halfW : b.maxZ + CFG.halfW;
      p.vz = 0;
    }
    if (Math.abs(p[axis] - before) < 1e-9) break;
  }
}

function segAt(segs, p, top, time) {
  for (let i = 0; i < segs.length; i++) {
    const b = segBox(segs[i], time);
    if (Math.abs(b.top - top) > 0.02) continue;
    if (p.x + CFG.halfW < b.minX || p.x - CFG.halfW > b.maxX) continue;
    if (p.z + CFG.halfW < b.minZ || p.z - CFG.halfW > b.maxZ) continue;
    return segs[i];
  }
  return null;
}

function nearestSeg(p, segs, time) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < segs.length; i++) {
    const b = segBox(segs[i], time);
    const dx = Math.max(0, Math.max(b.minX - p.x, p.x - b.maxX));
    const dz = Math.max(0, Math.max(b.minZ - p.z, p.z - b.maxZ));
    const d = dx * dx + dz * dz + Math.abs(b.top - p.y) * 0.25;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// Progress = metres travelled down the course (z decreases).
export function progressOf(p, segs) {
  const startZ = segs[0].z + 2;
  return Math.max(0, startZ - p.z);
}
