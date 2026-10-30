// Solid props the player can't walk (or row) through. Props register footprints while they are built;
// Player.canStand() asks blocked(). Boxes are axis-aligned in world units; circles are trunks, posts, towers.
// `water: true` also blocks boats (things that stand out of the lake: lighthouse, ruin pillars).

const solids = [];

export function addBox(x0, z0, x1, z1, opts = {}) {
  solids.push({ kind: 'box', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), ...opts });
}

export function addCircle(x, z, r, opts = {}) {
  solids.push({ kind: 'circle', x, z, r, ...opts });
}

export function clearColliders() { solids.length = 0; solidFns.length = 0; }

export function colliderCount() { return solids.length; }

// v1.8.1: low solids (rocks) carry `top`, the world height of their top. A walker whose feet are within
// STEP of that height (or above it) passes: you can jump onto a boulder, stand on it and hop over it.
export const STEP = 0.34;

/** True when a body of radius r centred at (x, z) overlaps a solid. mode: 'shore' | 'boat'.
 *  feetY (optional): the walker's feet height, which lets them clear low solids. */
const solidFns = [];
/** v1.9: a solid shape given as a test fn(x, z, r) -> true when blocked (on foot only), e.g. Echo Cavern. */
export function addSolidFn(fn) { solidFns.push(fn); }
export function blocked(x, z, r = 0.28, mode = 'shore', feetY = null) {
  if (mode !== 'boat') for (const fn of solidFns) if (fn(x, z, r)) return true;
  for (const s of solids) {
    if (mode === 'boat' && !s.water) continue;
    if (s.top != null && feetY != null && feetY >= s.top - STEP) continue;
    if (s.skip?.()) continue; // (v1.17.1: e.g. a shanty's walls while you're inside it)
    if (s.kind === 'circle') {
      const rr = s.r + r;
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz < rr * rr) return true;
    } else if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) return true;
  }
  return false;
}

/** The highest low-solid top under (x, z) (for standing on rocks), or null. */
export function solidTopAt(x, z) {
  let best = null;
  for (const s of solids) {
    if (s.top == null) continue;
    let inside;
    if (s.kind === 'circle') { const dx = x - s.x, dz = z - s.z; inside = dx * dx + dz * dz < s.r * s.r; }
    else inside = x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1;
    if (inside && (best == null || s.top > best)) best = s.top;
  }
  return best;
}

/** Debugging: the solids within d of (x, z), and whether a solid shape (solidFn) answers there. */
export function collidersNear(x, z, d = 3) {
  const out = solids.filter((s) => (s.kind === 'circle' ? Math.hypot(s.x - x, s.z - z) < d + s.r : x > s.x0 - d && x < s.x1 + d && z > s.z0 - d && z < s.z1 + d)).map((s) => ({ ...s }));
  return { solids: out, fns: solidFns.map((fn, i) => (fn(x, z, 0.45) ? i : -1)).filter((i) => i >= 0) };
}

/** Tests and tools: which solids (and which solid fns, by index) a body at (x, z) touches. */
export function solidsAt(x, z, r = 0.28) {
  const out = [];
  solidFns.forEach((fn, i) => { if (fn(x, z, r)) out.push({ fn: i, src: String(fn).slice(0, 80) }); });
  for (const s of solids) {
    if (s.skip?.()) continue;
    if (s.kind === 'circle' ? Math.hypot(x - s.x, z - s.z) < s.r + r : x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) out.push(s);
  }
  return out;
}
