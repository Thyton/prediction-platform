// Reachability maths shared by the generator (to clamp impossible jumps) and
// the test bot (to prove a course is completable). Pure ballistics.
import { CFG } from "./physics.js";

// How far you can travel horizontally while landing `rise` metres up/down.
// Solved exactly from the jump impulse, then discounted for imperfect play.
export function reachFor(rise, speed = CFG.maxSpeed * CFG.sprintMul) {
  // vy = jump - g*t ; y(t) = jump*t - g*t^2/2 = rise  ->  solve for t
  const g = CFG.gravity, v = CFG.jump;
  const disc = v * v - 2 * g * rise;
  if (disc <= 0) return 0;                       // can't get that high at all
  const t = (v + Math.sqrt(disc)) / g;           // latest of the two roots
  return t * speed;
}

// Is hopping from the far edge of `a` to the near edge of `b` physically doable?
// `slack` < 1 makes the test stricter than the raw maximum — the default keeps
// every gap inside what a sloppy player clears, not what a perfect one could.
export function hopFeasible(a, b, slack = 0.6) {
  const gap = a.minZ - b.maxZ;                   // z falls going forward
  const rise = b.top - a.top;
  const lateral = Math.max(
    0,
    Math.max(b.minX - a.maxX, a.minX - b.maxX)
  );
  if (gap < 0 && lateral === 0) return true;     // overlapping, trivially fine
  const reach = reachFor(rise);
  const need = Math.hypot(Math.max(0, gap), lateral);
  return need <= reach * slack;
}
