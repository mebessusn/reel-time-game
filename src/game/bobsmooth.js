// Other players' floats arrive 5 times a second. This glides the one we draw between those updates, so their line
// reels in smoothly. A new cast or a long jump goes straight there.
const RATE = 6, SNAP = 8;

/** The float to draw this frame: q is last frame's (kept and reused), b is the latest from the net. */
export function smoothBobber(q, b, dt) {
  if (!b) return null;
  if (!q || (!q.flying && Math.hypot(b.x - q.x, b.z - q.z) > SNAP)) return { ...b };
  const k = Math.min(1, dt * RATE);
  q.x += (b.x - q.x) * k; q.z += (b.z - q.z) * k;
  q.dunk = (q.dunk || 0) + ((b.dunk || 0) - (q.dunk || 0)) * k;
  q.y = b.y == null ? undefined : (q.y ?? b.y) + (b.y - (q.y ?? b.y)) * k;
  q.flying = b.flying;
  return q;
}
