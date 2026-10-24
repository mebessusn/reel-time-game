// Five Lakes Valley terrain: heightmap, water bodies, zones and queries.
// Axes: +x east, -z north (camera looks north from the dock), y up. 1 unit = 1 block.
// Cozy Cove (the original map, -56..55) sits in the middle untouched; around it the valley opens up:
// Frostpine Lake (NW, alpine), Old Quarry (NE), Willow River (cove -> Lilymarsh, boatable),
// Lilymarsh (SE), Fern Pond (SW) and Pinewood Lodge (N), linked by trails.
import { makeNoise2D } from '../core/rng.js';
import { buildSmoothTerrain, blurGrid, cornersOf, KIND } from './smoothterrain.js';
import { applyCaustics } from './caustics.js';

export const HALF = 224; // world spans -224..223 on x and z
// v1.8: everything beyond Cozy Cove is twice the size it was (lakes, trails, hills, settlements), so each
// outer fishing spot has four times the water. Coordinates below are written at the old scale and passed
// through sc(): points outside the cove double, points in and around the cove stay where they are.
export const OUTER = 2;
const COVE_KEEP = 55;
export const sc = (x, z) => (Math.hypot(x, z) > COVE_KEEP ? [x * OUTER, z * OUTER] : [x, z]);
// a settlement prop: keep its offset from the settlement centre, move the centre
export const scAround = (x, z, cx, cz) => { const [nx, nz] = sc(cx, cz); return [nx + (x - cx), nz + (z - cz)]; };
export const WATER_Y = 0.85; // water surface height
export const LAKE_R = 34;
export const DEEP_C = { x: 0, z: -12 };
// v1.14.3: the lighthouse island, moved in from the east bank toward the middle of the cove (it used to sit at 21, 6),
// clear of the deep end and the Sunken Ruins
export const LIGHTHOUSE_ISLE = { x: 13, z: 6 };
export const FALLS_C = { x: 27, z: -24 };
export const DOCK = { x0: -2, x1: 1, z0: 22, z1: 40, deckY: 1.5 }; // deck occupies x0..x1+1, z0..z1+1
export const SPAWN = { x: 0.5, z: 38 };

const noise = makeNoise2D(20261009);
const fbm = (x, z) => noise(x * 0.05, z * 0.05) + 0.5 * noise(x * 0.11 + 7, z * 0.11 - 3) + 0.25 * noise(x * 0.23 - 11, z * 0.23 + 5);
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- the valley's waters
export const LAKES = {
  frost: { name: 'Frostpine Lake', cx: -144, cz: -140, rx: 64, rz: 48, noise: 5 },
  marsh: { name: 'Lilymarsh', cx: 132, cz: 160, rx: 68, rz: 44, noise: 6 },
  pond: { name: 'Fern Pond', cx: -152, cz: 148, rx: 34, rz: 28, noise: 3.5 },
  quarry: { name: 'Old Quarry', cx: 160, cz: -156, rx: 26, rz: 24, noise: 1.4 },
  cave: { name: 'Echo Cavern', cx: 64, cz: -158, rx: 21, rz: 16, noise: 1.2 }, // v1.8.1: roomier inside
};
// Waterways: every lake can be rowed to from the cove. Willow River runs to Lilymarsh; Frostrun Creek,
// Fern Brook and the Quarry Cut were dug out in v1.8; a spur off the Cut runs into the hill to Echo Cavern.
export const RIVERS = {
  willow: { name: 'Willow River', w: 3.4, pts: [[30, 6], [44, 9.5], [52, 12], [78, 22], [104, 32], [124, 44], [140, 68], [148, 96], [144, 124]] },
  frostrun: { name: 'Frostrun Creek', w: 3.2, pts: [[-30, -8], [-50, -10], [-70, -24], [-86, -50], [-98, -76], [-108, -98], [-118, -112]] },
  fernbrook: { name: 'Fern Brook', w: 3, pts: [[-27, 18], [-48, 38], [-78, 66], [-108, 92], [-136, 110], [-148, 122]] },
  quarrycut: { name: 'Quarry Cut', w: 3.2, pts: [[10, -36], [24, -56], [48, -78], [78, -98], [108, -112], [130, -124], [148, -136]] },
  cavespur: { name: 'Echo Cavern', w: 4.2, pts: [[48, -78], [56, -100], [60, -122], [62, -144]] },
};
export const RIVER = RIVERS.willow.pts;
// v1.8.2: Echo Cavern's obsidian dome (cave.js builds it). The ground stays under the roof inside and rises
// to meet its rim outside, so no terrain pokes through it as jagged spikes.
export const CAVE_DOME = { base: -1, h: 18.7, pad: 4 }; // rim sunk below the water: the dome IS the cave wall, no gaps
export function caveDomeE(x, z) { const C = LAKES.cave; return Math.hypot((x - C.cx) / (C.rx + CAVE_DOME.pad), (z - C.cz) / (C.rz + CAVE_DOME.pad)); }
export const caveRoofY = (e) => CAVE_DOME.base + CAVE_DOME.h * Math.sqrt(Math.max(0, 1 - e * e));
/** Where a point sits along the cavern tunnel (the last leg of the spur): t along it, d off its axis. */
export function caveTunnelAt(x, z) {
  const P = RIVERS.cavespur.pts, [ax, az] = P[P.length - 2], [bx, bz] = P[P.length - 1];
  const vx = bx - ax, vz = bz - az, t = ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz);
  return { t, d: Math.hypot(x - (ax + vx * t), z - (az + vz * t)) };
}
// v1.14.9 The Wild Woods: four hidden pools tucked into the woods off the trails, and two wadeable creeks with riffles
// (fly fishing) running out of two of them into the waterways. Each pool is its own fishing zone; the creeks are 'creek'.
export const POOLS = {
  moonwell: { name: 'Moonwell', cx: -185, cz: -20, rx: 9, rz: 7, noise: 1 },
  foxhollow: { name: 'Fox Hollow', cx: 160, cz: 10, rx: 10, rz: 8, noise: 1.2 },
  mirrortarn: { name: 'Mirror Tarn', cx: -38, cz: -142, rx: 11, rz: 8, noise: 1 },
  lantern: { name: 'Lantern Spring', cx: -30, cz: 150, rx: 8, rz: 7.5, noise: 0.8 },
};
export const CREEKS = {
  tarnrun: { name: 'Tarn Run', w: 1.25, pts: [[-46, -136], [-58, -128], [-70, -122], [-82, -113], [-94, -108], [-104, -104], [-111, -104]] },
  hollowbrook: { name: 'Hollow Brook', w: 1.25, pts: [[152, 16], [146, 24], [140, 28], [134, 35], [128, 38], [124, 42]] },
};
const MARSH_ISLES = [[88, 180, 9], [184, 140, 8], [120, 196, 6]];

// Trails between the lakes (flattened, dirt-topped). Signposts stand at their first points.
// (old-scale points; the outer ones are doubled by sc(), and long legs get a midpoint so they still curve)
const scTrail = (pts) => {
  const out = [];
  for (const [x, z] of pts) {
    const p = sc(x, z), q = out[out.length - 1];
    if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) > 40) out.push([(p[0] + q[0]) / 2 + (noise(p[0] * 0.01, q[1] * 0.01) * 6), (p[1] + q[1]) / 2 + noise(q[0] * 0.01, p[1] * 0.01) * 6]);
    out.push(p);
  }
  return out;
};
export const TRAILS = {
  pond: { to: 'FERN POND', pts: scTrail([[-4, 46], [-22, 56], [-42, 66], [-58, 72]]) },
  frost: { to: 'FROSTPINE', pts: scTrail([[-16, 46], [-38, 34], [-46, 8], [-48, -22], [-53, -42]]) },
  lodge: { to: 'LODGE', pts: scTrail([[-48, -22], [-30, -48], [-10, -58], [0, -70], [0, -86]]) },
  quarry: { to: 'QUARRY', pts: scTrail([[10, 41], [26, 31], [40, 19], [44, 15], [44, 3], [47, -6], [56, -24], [64, -46], [72, -62]]) },
  marsh: { to: 'LILYMARSH', pts: scTrail([[9, 43], [22, 51], [32, 62], [34, 70]]) },
  // v1.14.9: the Ridgeback Loop, a dirt bike trail round Lookout Mesa in the south woods, off the Lilymarsh trail
  loop: { to: 'RIDGEBACK LOOP', pts: [[46, 108], [40, 120], [36, 131], ...Array.from({ length: 25 }, (_, i) => { const a = Math.PI * 0.5 + (i / 24) * Math.PI * 2; return [25 + Math.cos(a) * 27 + Math.sin(a * 3) * 3, 156 - Math.sin(a) * 25]; })] },
};
// Flattened clearings for the settlements
const CL = (x, z, r, h) => { const [nx, nz] = sc(x, z); return { x: nx, z: nz, r: Math.round(r * 1.4), h }; };
export const CLEARINGS = {
  lodge: CL(0, -97, 13, 2),
  camp: CL(-92, 95, 8, 2),
  bog: CL(99, 99, 6, 2),
  shed: CL(98, -58, 7, 3),
  // v1.9.4: Sundae's Trailer Park east of Fern Pond, and Fernview Campground off its north shore (src/world/campers.js)
  park: { x: -100, z: 156, r: 13, h: 3 },
  fernview: { x: -170, z: 107, r: 10, h: 3 },
  // v1.14.9 The Wild Woods (src/world/woods.js): the ranger's fire tower, the trapper's cabin, the crashed bush plane,
  // Old Hollis's treehouse, and the five places Wren's wagon stops
  tower: { x: -158, z: -45, r: 9, h: 3 },
  trapper: { x: 118, z: -12, r: 8, h: 2 },
  plane: { x: 182, z: 88, r: 10, h: 2 },
  hollis: { x: -80, z: -190, r: 9, h: 3 },
  wagon1: { x: -66, z: 32, r: 6, h: 2 },
  wagon2: { x: 22, z: -128, r: 6, h: 2 },
  wagon3: { x: 98, z: -32, r: 6, h: 2 },
  wagon4: { x: 62, z: 104, r: 6, h: 2 },
  wagon5: { x: -92, z: 120, r: 6, h: 2 },
};
// Hills and mountains: [x, z, radius, height]
const BUMPS0 = [[-88, -102, 40, 12], [-110, -62, 32, 9], [-50, -108, 24, 7], [104, -104, 30, 9], [110, 20, 24, 5], [-110, 16, 26, 5],
  [40, -92, 18, 3], [-30, 98, 20, 3], [-100, -24, 18, 4], [100, 40, 16, 4], [62, -18, 14, 3], [-62, 22, 16, 3], [22, -82, 12, 3],
  [-18, 84, 12, 2], [96, 2, 16, 4], [32, 98, 14, 3], [-30, -84, 14, 3], [84, -30, 12, 3], [-84, 40, 12, 3]];
const BUMPS = [...BUMPS0.map(([x, z, r, h]) => [...sc(x, z), r * OUTER, h]),
  [-40, -200, 30, 8], [40, 200, 30, 6], [200, -20, 26, 6], [-200, 40, 26, 6], [-110, 20, 22, 4], [110, -20, 22, 4]];

// Inner verticality: walkable plateaus (lookouts with cliff sides) and rocky spines/spires you walk around.
export const MESAS = [{ x: -34, z: -80, r: 10, h: 5 }, { x: 28, z: -68, r: 8, h: 5 }, { x: -86, z: 30, r: 9, h: 5 }, { x: 92, z: 40, r: 8, h: 5 }, { x: 8, z: 82, r: 8, h: 4 }]
  .map((m) => { const [x, z] = sc(m.x, m.z); return { ...m, x, z, r: Math.round(m.r * 1.5) }; });
const RIDGES = [
  { pts: [[-70, -8], [-86, 8], [-100, 34]], w: 5, h: 10 },
  { pts: [[88, -24], [96, 0], [100, 24]], w: 5, h: 9 },
  { pts: [[-22, 92], [0, 100], [20, 98]], w: 4, h: 8 },
  { pts: [[52, -88], [64, -100]], w: 4, h: 9 },
].map((r) => ({ ...r, pts: r.pts.map(([x, z]) => sc(x, z)), w: r.w * 1.5 }));
const SPIRES = [[40, -40, 2.4, 9], [-24, -40, 2, 7], [60, 2, 2.2, 8], [-64, 52, 2.6, 9], [36, 84, 2, 7], [-50, 96, 2.4, 8], [86, -40, 2.2, 10], [-96, -40, 2.4, 9]]
  .map(([x, z, r, h]) => [...sc(x, z), r * 1.3, h]);
const ridged = (x, z) => 1 - Math.abs(noise(x * 0.034, z * 0.034));

const ell = (x, z, L) => (Math.hypot((x - L.cx) / L.rx, (z - L.cz) / L.rz) - 1) * Math.min(L.rx, L.rz) + fbm(x * 1.3, z * 1.3) * L.noise;
function polyDist(x, z, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const vx = bx - ax, vz = bz - az, px = x - ax, pz = z - az;
    const t = Math.max(0, Math.min(1, (px * vx + pz * vz) / (vx * vx + vz * vz)));
    const d = Math.hypot(px - vx * t, pz - vz * t);
    if (d < best) best = d;
  }
  return best;
}
const RIVER_LIST = Object.values(RIVERS);
/** Signed distance to the nearest waterway (negative inside), and which one. */
// v1.9.11: where the Echo Cavern spur leaves the Quarry Cut the channels meet at a sharp angle; a round pool
// there gives a rowboat room to turn the corner, and its banks drop off steeply instead of shelving.
const JUNCTIONS = [{ x: 50.5, z: -84, r: 8.5 }];
for (const r of RIVER_LIST) { const xs = r.pts.map((p) => p[0]), zs = r.pts.map((p) => p[1]); r.box = [Math.min(...xs) - r.w - 1, Math.min(...zs) - r.w - 1, Math.max(...xs) + r.w + 1, Math.max(...zs) + r.w + 1]; }
function riverAt(x, z) {
  let sd = 1e9, which = null;
  for (const r of RIVER_LIST) {
    const b = r.box, bx = Math.max(b[0] - x, 0, x - b[2]), bz = Math.max(b[1] - z, 0, z - b[3]);
    if (Math.sqrt(bx * bx + bz * bz) - r.w - 0.6 >= sd) continue; // v1.14.9: this river can't be the nearest
    const d = polyDist(x, z, r.pts) - r.w - noise(x * 0.09, z * 0.09) * 0.6; if (d < sd) { sd = d; which = r; }
  }
  for (const j of JUNCTIONS) { const d = Math.hypot(x - j.x, z - j.z) - j.r; if (d < sd) { sd = d; which = RIVERS.cavespur; } }
  return { sd, which };
}
const nearJunction = (x, z, pad) => JUNCTIONS.some((j) => Math.hypot(x - j.x, z - j.z) < j.r + pad);
const riverSd = (x, z) => riverAt(x, z).sd;
function valleyWater(x, z) { // nearest of the valley lakes
  let zone = null, sd = 1e9;
  for (const [k, L] of Object.entries(LAKES)) {
    if (Math.abs(x - L.cx) > L.rx + 40 || Math.abs(z - L.cz) > L.rz + 40) continue;
    const d = ell(x, z, L);
    if (d < sd) { sd = d; zone = k; }
  }
  return { zone, sd };
}
const POOL_LIST = Object.entries(POOLS), CREEK_LIST = Object.values(CREEKS);
/** Signed distance to the nearest hidden pool (negative inside), and which. */
function poolAt(x, z) {
  let zone = null, sd = 1e9;
  for (const [k, P] of POOL_LIST) {
    if (Math.abs(x - P.cx) > P.rx + 30 || Math.abs(z - P.cz) > P.rz + 30) continue;
    const d = ell(x, z, P);
    if (d < sd) { sd = d; zone = k; }
  }
  return { zone, sd };
}
/** Signed distance to the nearest creek (negative inside), and which. */
for (const c of CREEK_LIST) { const xs = c.pts.map((p) => p[0]), zs = c.pts.map((p) => p[1]); c.box = [Math.min(...xs) - 12, Math.min(...zs) - 12, Math.max(...xs) + 12, Math.max(...zs) + 12]; }
function creekAt(x, z) {
  let sd = 1e9, which = null;
  for (const c of CREEK_LIST) {
    if (x < c.box[0] || z < c.box[1] || x > c.box[2] || z > c.box[3]) continue; // (far from it: skip the maths)
    const d = polyDist(x, z, c.pts) - c.w - noise(x * 0.13, z * 0.13) * 0.35;
    if (d < sd) { sd = d; which = c; }
  }
  return { sd, which };
}
/** A creek's riffles and runs: shallow riffles you can wade, with a knee-deep run every dozen metres. */
const creekRun = (x, z) => noise(x * 0.085 + 31, z * 0.085 - 17) > 0.35;
const marshIsle = (x, z) => Math.min(...MARSH_ISLES.map(([cx, cz, r]) => Math.hypot(x - cx, z - cz) - r + fbm(x * 2, z * 2) * 1.2));
const quarryEntrance = (x, z) => { // the trail ramps in from the south-west
  const a = Math.atan2(z - LAKES.quarry.cz, x - LAKES.quarry.cx), want = Math.atan2(16, -8); // the Quarry Cut comes in this way too
  return Math.abs(Math.atan2(Math.sin(a - want), Math.cos(a - want))) < 0.42;
};
const trailList = Object.values(TRAILS).map((t) => t.pts);
// v1.14.9: each trail's bounding box, so a point far from a trail skips it (the trail's distance can't beat the box's)
const trailBox = trailList.map((pts) => { const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]); return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]; });
function trailDist(x, z) {
  let d = 1e9;
  for (let i = 0; i < trailList.length; i++) {
    const b = trailBox[i], bx = Math.max(b[0] - x, 0, x - b[2]), bz = Math.max(b[1] - z, 0, z - b[3]);
    if (bx * bx + bz * bz >= d * d) continue;
    d = Math.min(d, polyDist(x, z, trailList[i]));
  }
  return d;
}

function lakeDist(x, z) {
  // Stretch the cove a bit north and toward the falls.
  const dx = x * 0.95, dz = (z + 2) * 0.9;
  return Math.sqrt(dx * dx + dz * dz) + fbm(x, z) * 5;
}

function computeHeight(x, z) {
  const d = lakeDist(x, z);
  const fallsD = Math.hypot(x - FALLS_C.x, z - FALLS_C.z);
  const deepD = Math.hypot(x - DEEP_C.x, z - DEEP_C.z);
  // Island rock for the lighthouse
  // a roomy sandy island: a raised core with a low beach ring, edges wobbled so it isn't a perfect disc
  const islandD = Math.hypot(x - LIGHTHOUSE_ISLE.x, z - LIGHTHOUSE_ISLE.z) + fbm(x * 1.7 + 40, z * 1.7) * 1.4;
  if (islandD < 6.2) return 2;
  if (islandD < 8.6) return 1;
  // ---- Cozy Cove (unchanged from the original map)
  if (fallsD < 7 || d < LAKE_R) {
    let depth;
    if (fallsD < 7) depth = -2 - Math.floor((7 - fallsD) / 3);
    else depth = -1 - Math.floor(((LAKE_R - d) / LAKE_R) * 5.5);
    if (x < -18) depth = Math.max(depth, -2 + (fbm(x * 2, z * 2) > 0.2 ? 1 : 0)); // reed shallows
    if (deepD < 10) depth = Math.min(depth, -6 - Math.floor((10 - deepD) / 2.5));
    return Math.max(-11, depth);
  }
  // ---- v1.14.9: hidden pools and creeks
  const pw = poolAt(x, z);
  if (pw.sd < 0) return Math.max(-3, -1 - Math.floor(-pw.sd / 3));
  const ck = creekAt(x, z);
  if (ck.sd < 0 && riverSd(x, z) > 0) return ck.sd < -0.5 && creekRun(x, z) ? -1 : 0; // (where a creek runs into the river, the river's channel wins)
  // ---- the waterways (deep enough to row the whole way)
  const rv = riverSd(x, z);
  if (rv < 0) return rv < -1.4 || nearJunction(x, z, 0) ? -3 : -2; // (the junction pool is deep right to its edge)
  // ---- the valley lakes
  const w = valleyWater(x, z);
  if (w.sd < 0) {
    if (w.zone === 'marsh') {
      const isle = marshIsle(x, z);
      if (isle < 0) return isle < -2 ? 2 : 1;
      return Math.max(-4, -1 - Math.floor(-w.sd / 7));
    }
    if (w.zone === 'frost') return Math.max(-10, -1 - Math.floor(-w.sd / 4.5));
    if (w.zone === 'pond') return Math.max(-6, -1 - Math.floor(-w.sd / 4));
    if (w.zone === 'cave') return Math.max(-7, -2 - Math.floor(-w.sd / 2));
    return Math.max(-12, -2 - Math.floor(-w.sd / 2)); // quarry: steep sides
  }
  // ---- land
  const r0 = Math.hypot(x, z);
  const t = Math.min(d - LAKE_R, rv, w.sd, pw.sd, ck.sd);
  const tr = trailDist(x, z);
  if (w.zone === 'quarry' && w.sd < 8 && !quarryEntrance(x, z) && rv > 4) return w.sd < 1.5 ? 8 : 7; // quarried rock walls
  const ce = caveDomeE(x, z);
  if (ce < 1) return Math.max(2, Math.floor(caveRoofY(ce) - 1.6)); // rock walls up from the water, always under the roof
  if (t < 2.5) return rv < 2.5 && nearJunction(x, z, 4) ? 2 : 1; // beach (v1.9.11: a steep bank round the junction pool)
  const caveD = Math.hypot(x - LAKES.cave.cx, z - LAKES.cave.cz);
  if (rv < 2.2 && caveD > 36) return nearJunction(x, z, 3) ? 2 : 1; // river banks (steep round the junction pool)
  const K = 4 - 1.6 * smooth(50, 72, r0) + 1.2 * smooth(120, 200, r0); // gentle valley floor, rising toward the ranges
  let h = 1 + Math.floor(Math.min(t, 18) * 0.16 + Math.max(0, fbm(x + 40, z - 40)) * K);
  // Cliff behind the waterfall
  const cliffD = Math.hypot(x - (FALLS_C.x + 5), z - (FALLS_C.z - 5));
  if (cliffD < 10) h = Math.max(h, Math.round(11 - cliffD * 0.4));
  // Keep the dock/cabin area flat and walkable
  if (Math.abs(x) < 16 && z > 30 && z < 52) h = Math.min(h, 2);
  // Mountains and hills
  for (const [bx, bz, br, bh] of BUMPS) {
    const k = 1 - Math.hypot(x - bx, z - bz) / br;
    if (k > 0) h += Math.floor(bh * Math.pow(k, 1.2) + fbm(x * 1.7, z * 1.7) * 1.5 * k);
  }
  // Cavern Hill: a broad rocky hill with Echo Cavern hollowed out under it (the cave lake and the spur
  // channel cut through it; cave.js roofs them over)
  // v1.8.2: a low skirt of ground around the dome's foot, with a ridge over the tunnel
  if (ce < 1.9) h = Math.max(h, Math.round(4.5 - (ce - 1) * 4));
  const ct = caveTunnelAt(x, z);
  { // the ridge over the tunnel rises gently from the mouth (no flat cliff end)
    const rise = smooth(-0.05, 0.4, ct.t) * (1 - smooth(1.05, 1.3, ct.t));
    if (rise > 0 && ct.d < 16) h = Math.max(h, Math.round(1 + (8.5 - Math.max(0, ct.d - 5) * 0.75) * rise));
  }
  if (ct.t > 0.05 && ct.t < 1.3 && ct.d < 7.2) h = Math.min(h, 2); // v1.9.2: nothing pokes up inside the tunnel's arch
  // Plateaus, ridges and rock spires
  for (const m of MESAS) {
    const md = Math.hypot(x - m.x, z - m.z) + fbm(x * 2.5, z * 2.5) * 1.6;
    if (md < m.r) h = Math.max(h, m.h); else if (md < m.r + 3) h = Math.max(h, m.h - 2);
  }
  for (const r of RIDGES) {
    const rd = polyDist(x, z, r.pts) + fbm(x * 2, z * 2) * 1.5;
    if (rd < r.w) h = Math.max(h, Math.round(r.h * (1 - (rd / r.w) ** 2) + ridged(x * 3, z * 3) * 2));
  }
  for (const [sx, sz, sr, sh] of SPIRES) {
    const sd = Math.hypot(x - sx, z - sz);
    if (sd < sr) h = Math.max(h, sh - Math.floor(sd));
  }
  // v1.14.9: the hidden pools and creeks keep low, walkable banks whatever hill they sit in
  if (pw.sd < 9) h = Math.min(h, 1 + Math.floor(Math.max(0, pw.sd - 1.5) * 0.45));
  if (ck.sd < 6) h = Math.min(h, 1 + Math.floor(Math.max(0, ck.sd - 1) * 0.5));
  // Settlement clearings and trails stay walkable
  for (const c of Object.values(CLEARINGS)) {
    const cd = Math.hypot(x - c.x, z - c.z);
    if (cd < c.r) h = c.h; else if (cd < c.r + 4) h = Math.min(h, c.h + 1 + Math.floor(cd - c.r));
  }
  if (tr < 2.2) h = Math.max(1, Math.min(h, 3));
  else if (tr < 4) h = Math.min(h, 4);
  // Mountain ranges ring the valley: ragged inner edge, ridged peaks, passes left open for clearings and trails.
  const e = HALF - Math.max(Math.abs(x), Math.abs(z)) + fbm(x * 0.8 + 13, z * 0.8 - 7) * 9;
  let band = smooth(23, 4, e);
  if (band > 0) {
    for (const c of Object.values(CLEARINGS)) band *= smooth(c.r + 2, c.r + 16, Math.hypot(x - c.x, z - c.z));
    band *= smooth(3, 14, tr);
    const peak = 8 + ridged(x, z) * 13 + fbm(x * 2.1, z * 2.1) * 3;
    h = Math.max(h, Math.round(h + band * peak));
  }
  // Absolute edge: a wall nobody walks past
  if (HALF - Math.max(Math.abs(x), Math.abs(z)) < 3) h = Math.max(h, 8);
  return Math.min(36, Math.max(1, h));
}

const N = HALF * 2;
const heights = new Int8Array(N * N);
const idx = (x, z) => (x + HALF) * N + (z + HALF);
for (let x = -HALF; x < HALF; x++) for (let z = -HALF; z < HALF; z++) heights[idx(x, z)] = computeHeight(x, z);
// Smooth the beach approach under the dock
for (let z = DOCK.z0 - 2; z <= DOCK.z1; z++) for (let x = DOCK.x0 - 1; x <= DOCK.x1 + 1; x++) {
  const h = heights[idx(x, z)];
  if (z > 36 && h > 2) heights[idx(x, z)] = 2;
}

// ---------------------------------------------------------------- the smooth surface
// What you see and walk on: the block heights blurred into slopes. Underwater blocks are lifted 0.7 before
// blurring so the blurred shoreline lands on the old block edge (beach 1 and shallows 0 meet at the water line).
const M = N + 1;
const SURF = (() => {
  const v = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) v[i] = heights[i] > 0 ? heights[i] : heights[i] + 0.7;
  return cornersOf(blurGrid(v, N, 1.1), N);
})();
let GRASS = null;
/** 0..1: how much of the ground at (x, z) is grass (0 before the terrain is built). */
export function grassAt(x, z) {
  if (!GRASS) return 0;
  const fx = x + HALF, fz = z + HALF;
  const a = Math.max(0, Math.min(N - 1, Math.floor(fx))), b = Math.max(0, Math.min(N - 1, Math.floor(fz)));
  const u = fx - a, w = fz - b;
  const g00 = GRASS[a * M + b], g10 = GRASS[(a + 1) * M + b], g01 = GRASS[a * M + b + 1], g11 = GRASS[(a + 1) * M + b + 1];
  return (g00 * (1 - u) + g10 * u) * (1 - w) + (g01 * (1 - u) + g11 * u) * w;
}

/** Height of the smooth ground surface at (x, z), matching the rendered triangles exactly. */
export function surfaceY(x, z) {
  const fx = x + HALF, fz = z + HALF;
  const a = Math.max(0, Math.min(N - 1, Math.floor(fx))), b = Math.max(0, Math.min(N - 1, Math.floor(fz)));
  const u = Math.max(0, Math.min(1, fx - a)), w = Math.max(0, Math.min(1, fz - b));
  const h00 = SURF[a * M + b], h10 = SURF[(a + 1) * M + b], h01 = SURF[a * M + b + 1], h11 = SURF[(a + 1) * M + b + 1];
  // triangles 00-10-01 and 10-11-01, as the mesh is built
  if (u + w <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * w;
  return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - w);
}

export function heightAt(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  if (ix < -HALF || iz < -HALF || ix >= HALF || iz >= HALF) return 30;
  return heights[idx(ix, iz)];
}

export function isWater(x, z) { return heightAt(x, z) <= 0; }
export function waterDepth(x, z) { return Math.max(0, 1 - heightAt(x, z)); }

// ---------------------------------------------------------------- jetties and the footbridge
// A jetty starts on the shore at (x, z) and runs `len` blocks out over the water along `dir`.
// v1.8.1: the shore end always lands on solid ground. If (x, z) is already in the water the jetty first walks
// back (against `dir`) to the bank, and it starts 4 blocks up the beach so the smoothed shoreline (which
// rounds the land's edge down) never leaves it floating.
// Is (x, z) on the mainland (a big connected stretch of land), not a little island?
export function mainland(x, z, need = 2500) {
  const sx = Math.floor(x), sz = Math.floor(z);
  if (heightAt(sx, sz) <= 0) return false;
  const seen = new Set([sx * 4096 + sz]), q = [[sx, sz]];
  while (q.length) {
    const [cx, cz] = q.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz, k = nx * 4096 + nz;
      if (seen.has(k) || heightAt(nx, nz) <= 0 || Math.abs(nx) >= HALF || Math.abs(nz) >= HALF) continue;
      seen.add(k);
      if (seen.size >= need) return true;
      q.push([nx, nz]);
    }
  }
  return false;
}
// v1.8.1: if the planned spot is on an island (or has no deep water in front), slide the jetty along the
// shore until it starts on the mainland and reaches open water.
function placeJetty(lake, x, z, dir, len) {
  const good = (px, pz) => {
    let k = 0, b = 0;
    while (b < 40 && heightAt(px - dir[0] * b, pz - dir[1] * b) <= 0) b++;
    const ax = px - dir[0] * b, az = pz - dir[1] * b;
    while (k < 40 && heightAt(ax + dir[0] * k, az + dir[1] * k) > 0) k++;
    const sx = ax + dir[0] * (k - 1), sz = az + dir[1] * (k - 1);
    if (!mainland(sx, sz)) return false;
    // open water at the end and a bit beyond, not another bank
    for (let t = 1; t <= len + 3; t++) if (heightAt(sx + dir[0] * t, sz + dir[1] * t) > 0) return false;
    return heightAt(sx + dir[0] * (len + 1), sz + dir[1] * (len + 1)) <= -1;
  };
  if (good(x, z)) return [x, z];
  const px = -dir[1], pz = dir[0]; // along the shore
  for (let o = 2; o <= 60; o += 2) for (const sgn of [1, -1]) {
    const cx = x + px * o * sgn, cz = z + pz * o * sgn;
    if (good(cx, cz)) return [cx, cz];
  }
  return [x, z];
}
function makeJetty(lake, x, z, dir, len = 6, rot = 0, land = 10) {
  [x, z] = placeJetty(lake, x, z, dir, len);
  let back = 0;
  while (back < 40 && heightAt(x - dir[0] * back, z - dir[1] * back) <= 0) back++;
  x -= dir[0] * back; z -= dir[1] * back;
  let k = 0;
  while (k < 40 && heightAt(x + dir[0] * k, z + dir[1] * k) > 0) k++;
  // back up the beach until the visible ground meets the deck, so the planks run onto dry land
  let s = k - 1;
  while (s > k - land && surfaceY(x + dir[0] * s, z + dir[1] * s) < 1.5 - 0.12) s--;
  const e = k + len;
  const ax = x + dir[0] * s, az = z + dir[1] * s, bx = x + dir[0] * e, bz = z + dir[1] * e;
  const along = dir[0] !== 0 ? 'x' : 'z';
  const rect = along === 'x'
    ? { x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: z - 1, z1: z + 1 }
    : { x0: x - 1, x1: x + 1, z0: Math.min(az, bz), z1: Math.max(az, bz) };
  // v1.9.2: a jetty can be turned (rot, radians, + = counter-clockwise from above) about its land end
  const pivot = { x: ax, z: az }, c = Math.cos(rot), sn = Math.sin(rot);
  const turn = (px, pz) => { const dx = px - pivot.x, dz = pz - pivot.z; return { x: pivot.x + dx * c + dz * sn, z: pivot.z - dx * sn + dz * c }; };
  const rdir = rot ? [dir[0] * c + dir[1] * sn, -dir[0] * sn + dir[1] * c] : dir;
  const end = turn(bx, bz);
  return { lake, ...rect, along, dir: rdir, axisDir: dir, rot, pivot, deckY: 1.5, end, launch: { x: end.x + rdir[0] * 2.5, z: end.z + rdir[1] * 2.5 } };
}
export const JETTIES = [
  makeJetty('frost', -136, -86, [0, -1], 8), // west of the Frostrun Creek mouth
  makeJetty('pond', ...sc(-55, 73), [-1, 0], 6),
  makeJetty('marsh', ...sc(27, 76), [1, 0], 7),
  makeJetty('quarry', ...sc(75, -61), [0, -1], 7, -Math.PI / 6, 5), // turned 30 degrees toward the stream so boats can pull in; v1.9.3: only its foot on the beach, more of it over the water
];
// The cove's own dock launches at the rack point.
export const COVE_LAUNCH = { x: 4.5, z: 27 };

// Footbridges: one wherever a trail crosses a waterway, laid along the trail and arched so boats row under.
// Each is a rectangle in its own frame: centre (cx, cz), unit direction (ux, uz) along the deck, half
// length `half` and width 2. The deck rests on the bank at both ends and rises over the water.
function segCross(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + r[0] * t, a[1] + r[1] * t, r] : null;
}
export const BRIDGES = (() => {
  const out = [];
  for (const tr of Object.values(TRAILS)) for (let i = 0; i < tr.pts.length - 1; i++) for (const rv of RIVER_LIST) for (let j = 0; j < rv.pts.length - 1; j++) {
    const hit = segCross(tr.pts[i], tr.pts[i + 1], rv.pts[j], rv.pts[j + 1]);
    if (!hit || out.some((b) => Math.hypot(b.cx - hit[0], b.cz - hit[1]) < 8)) continue;
    // v1.8.1: the deck crosses straight over the water (square to the river where the trail meets it), bank
    // to bank, instead of following the trail, which could run it along the river for a long way.
    const rd = [rv.pts[j + 1][0] - rv.pts[j][0], rv.pts[j + 1][1] - rv.pts[j][1]], rl = Math.hypot(rd[0], rd[1]);
    let ux = -rd[1] / rl, uz = rd[0] / rl;
    if (ux * hit[2][0] + uz * hit[2][1] < 0) { ux = -ux; uz = -uz; } // same way as the trail runs
    // walk out each way to where the visible bank rises out of the water
    const wet = (x, z) => surfaceY(x, z) < WATER_Y + 0.2;
    let a = 0, b = 0;
    while (a < 16 && wet(hit[0] - ux * a, hit[1] - uz * a)) a += 0.25;
    while (b < 16 && wet(hit[0] + ux * b, hit[1] + uz * b)) b += 0.25;
    const cx = hit[0] + ux * (b - a) / 2, cz = hit[1] + uz * (b - a) / 2, span = (a + b) / 2;
    const base = Math.max(1, Math.min(surfaceY(cx - ux * (span + 1.2), cz - uz * (span + 1.2)), surfaceY(cx + ux * (span + 1.2), cz + uz * (span + 1.2))));
    out.push({ cx, cz, ux, uz, span, half: span + 1.6, w: 2, peak: Math.max(3.9, base + 2.0), base: Math.min(base, 3) }); // v1.8.2: a high arch, boats pass well under
  }
  return out;
})();
export const BRIDGE = BRIDGES[0] || null; // older code reads the first one
const bridgeLocal = (B, x, z) => { const dx = x - B.cx, dz = z - B.cz; return [dx * B.ux + dz * B.uz, -dx * B.uz + dz * B.ux]; };
function bridgeAt(x, z) {
  for (const B of BRIDGES) { const [s, t] = bridgeLocal(B, x, z); if (Math.abs(s) < B.half && Math.abs(t) < B.w / 2) return B; }
  return null;
}
// Deck height: flush with the bank at both ends, rising in a gentle arch over the water (boats fit under).
export function bridgeY(x, z, B = bridgeAt(x, z)) {
  if (!B) return 1;
  const s = bridgeLocal(B, x, z)[0];
  const a = B.span + 1.4;
  if (Math.abs(s) >= a) return B.base;
  return B.base + (B.peak - B.base) * Math.cos((Math.PI / 2) * (s / a)) ** 1.3;
}
/** Deck height along a bridge by distance s from its middle (for building the mesh). */
export function bridgeYAlong(B, s) { return bridgeY(B.cx + B.ux * s, B.cz + B.uz * s, B); }
const inRect = (x, z, r) => {
  if (r.rot) { const dx = x - r.pivot.x, dz = z - r.pivot.z, c = Math.cos(r.rot), sn = Math.sin(r.rot); x = r.pivot.x + dx * c - dz * sn; z = r.pivot.z + dx * sn + dz * c; } // into the jetty's own frame
  return x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;
};
const onCoveDock = (x, z) => x >= DOCK.x0 && x < DOCK.x1 + 1 && z >= DOCK.z0 && z < DOCK.z1 + 1;

export function jettyAt(x, z) { return JETTIES.find((j) => inRect(x, z, j)) || null; }
// v1.8.1: walkways other modules add (the Lilymarsh boardwalk): oriented decks { cx, cz, ux, uz, half, w, y }
export const WALKWAYS = [];
export function addWalkway(w) { WALKWAYS.push(w); }
export function walkwayAt(x, z) {
  for (const W of WALKWAYS) { const dx = x - W.cx, dz = z - W.cz; if (Math.abs(dx * W.ux + dz * W.uz) < W.half && Math.abs(-dx * W.uz + dz * W.ux) < W.w / 2) return W; }
  return null;
}
export function onBridge(x, z) { return !!bridgeAt(x, z); }
/** v1.8.2: a boat of radius r would hit a dock, jetty or boardwalk (bridges are high enough to row under). */
export function deckHit(x, z, r = 0.9) {
  const hit = (px, pz) => onCoveDock(px, pz) || !!jettyAt(px, pz) || !!walkwayAt(px, pz);
  if (hit(x, z)) return true;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; if (hit(x + Math.cos(a) * r, z + Math.sin(a) * r)) return true; }
  return false;
}
export function onDock(x, z) { return onCoveDock(x, z) || !!jettyAt(x, z) || onBridge(x, z) || !!walkwayAt(x, z); }

// Height a walker stands at, or null if not walkable on foot.
export function groundY(x, z) {
  if (onCoveDock(x, z) || jettyAt(x, z)) return DOCK.deckY;
  if (onBridge(x, z)) return bridgeY(x, z);
  const h = heightAt(x, z);
  if (h <= 0) return null;
  // Steep terrain is not walkable above 5 blocks (keeps players on the valley floor)
  if (h > 5) return null;
  return surfaceY(x, z);
}

// Where you can walk, judged on the smooth surface you see (not the block heights underneath):
// any dry ground that isn't a cliff. Shallow sand you can see above the water counts as dry; slopes up
// to about 50 degrees are fine, and you can wade a step into the shallows; only real cliffs, deep water and the high peaks stop you.
const WALK_SLOPE = 1.2; // rise per unit
/** v1.9.1: gentle enough ground for a tree or a prop to stand on (not a cliff or a steep bank). */
export function gentleAt(x, z, max = 0.55, r = 1.2) {
  const c = surfaceY(x, z);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; if (Math.abs(surfaceY(x + Math.cos(a) * r, z + Math.sin(a) * r) - c) / r > max) return false; }
  return true;
}
const WALK_TOP = 15;
/** v1.8.2: visibly dry ground at (x, z): the rendered surface is above the water line all around a small
 *  footprint (chairs, people). The block map alone calls the smoothed water's edge "land". Docks count. */
export function dryAt(x, z, r = 0.45, level = Infinity) {
  if (onDock(x, z)) return true;
  const c = surfaceY(x, z);
  if (c < WATER_Y + 0.12) return false;
  for (let a = 0; a < 6; a++) {
    const t = (a / 6) * Math.PI * 2, y = surfaceY(x + Math.cos(t) * r, z + Math.sin(t) * r);
    if (y < WATER_Y + 0.06 || Math.abs(y - c) > level) return false; // `level`: how uneven the footprint may be
  }
  return walkY(x, z) != null;
}
/** v1.8.2: how far a cast from (x, z) along (ux, uz) can fly before something solid is in the way (a bridge,
 *  a dock or jetty you're not standing on). Infinity when the way is clear for `max`. */
export function castClearance(x, z, ux, uz, max = 30) {
  let left = !onDock(x, z);
  for (let s = 0.5; s <= max; s += 0.5) {
    const px = x + ux * s, pz = z + uz * s, on = onDock(px, pz);
    if (!on) left = true;
    else if (left) return s;
  }
  return Infinity;
}

/** Where you stand at (x, z), or null if you can't. `wade` is how deep below the water line you may walk
 *  (v1.8.1: the player wades to knee depth so climbing out of a boat never strands you). */
export const WADE_DEPTH = 0.55;
export function walkY(x, z, wade = 0.22) {
  if (onCoveDock(x, z) || jettyAt(x, z)) return DOCK.deckY;
  if (onBridge(x, z)) return bridgeY(x, z);
  const ww = walkwayAt(x, z);
  if (ww) return Math.max(ww.y, surfaceY(x, z));
  const s = surfaceY(x, z);
  if (s == null || s < WATER_Y - wade || s > WALK_TOP) return null; // you can wade in at the edges
  const e = 0.35;
  const gx = Math.abs(surfaceY(x + e, z) - surfaceY(x - e, z)) / (2 * e);
  const gz = Math.abs(surfaceY(x, z + e) - surfaceY(x, z - e)) / (2 * e);
  if (Math.max(gx, gz) > WALK_SLOPE) return null;
  if (walkOverlay) { const o = walkOverlay(x, z); if (o != null && o > s) return o; } // e.g. the cavern's rock skin
  return s;
}
// v1.9: a surface laid over the ground that you walk on top of (cave.js registers Echo Cavern's rock skin)
let walkOverlay = null;
export function setWalkOverlay(fn) { walkOverlay = fn; }

export function zoneAt(x, z) {
  if (!isWater(x, z)) return null;
  const d = lakeDist(x, z);
  const fallsD = Math.hypot(x - FALLS_C.x, z - FALLS_C.z);
  if (d < LAKE_R + 1 || fallsD < 9) {
    const deepD = Math.hypot(x - DEEP_C.x, z - DEEP_C.z);
    if (fallsD < 9) return 'falls';
    if (deepD < 4) return 'ruins';
    if (deepD < 10) return 'deep';
    if (x < -16) return 'shallows';
    if (Math.hypot(x - 0, z - DOCK.z0) < 10) return 'dock';
    return 'open';
  }
  { const pw = poolAt(x, z); if (pw.sd < 1.5) return pw.zone; }
  if (creekAt(x, z).sd < 1.2 && riverSd(x, z) > 0) return 'creek';
  if (riverSd(x, z) < 1.5) return 'river';
  return valleyWater(x, z).zone || 'open';
}

// Boats need at least depth 2 except near the cove launch.
export function boatable(x, z) {
  const h = heightAt(x, z);
  if (h <= -1 && poolAt(x, z).sd < 2) return false; // v1.14.9: the hidden pools are for wading and casting, not rowing
  return h <= -1 || (h <= 0 && Math.abs(x - 4) < 3 && z > 18 && z < 34);
}

// Which connected body of water a point is in. Since v1.8 every lake is linked by a waterway, so it's all
// one: you can row anywhere.
export function waterBody(x, z) {
  return zoneAt(x, z) ? 'cove' : null;
}

// Where a boat launched from here goes in the water (the cove dock, or a lake's jetty).
export function launchPointNear(x, z, radius = 5) {
  if (onCoveDock(x, z)) return COVE_LAUNCH;
  let best = null, bd = radius;
  for (const j of JETTIES) {
    const cx = Math.max(j.x0, Math.min(j.x1, x)), cz = Math.max(j.z0, Math.min(j.z1, z));
    const dd = Math.hypot(x - cx, z - cz);
    if (dd <= bd) { bd = dd; best = j.launch; }
  }
  return best;
}
// The nearest landing to row back to, in the same body of water when possible.
export function nearestLanding(x, z) {
  const here = waterBody(x, z);
  const opts = [{ ...COVE_LAUNCH, body: 'cove' }, ...JETTIES.map((j) => ({ ...j.launch, body: waterBody(j.launch.x, j.launch.z) }))];
  const same = opts.filter((o) => o.body === here);
  return (same.length ? same : opts).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
}

export function regionName(x, z) {
  const names = { lodge: 'Pinewood Lodge', camp: 'Fern Camp', bog: 'Bog Hut', shed: 'Quarry Shed', park: "Sundae's Trailer Park", fernview: 'Fernview Campground',
    tower: 'Ridge Lookout', trapper: "Trapper's Cabin", plane: 'Crash Clearing', hollis: "Hollis's Treehouse" };
  for (const [k, c] of Object.entries(CLEARINGS)) if (names[k] && Math.hypot(x - c.x, z - c.z) < c.r + 6) return names[k];
  { const pw = poolAt(x, z); if (pw.sd < 10) return POOLS[pw.zone].name; }
  { const ck = creekAt(x, z); if (ck.sd < 5) return ck.which.name; }
  const w = valleyWater(x, z);
  if (w.zone && w.sd < (w.zone === 'cave' ? 4 : 18)) return LAKES[w.zone].name;
  if (lakeDist(x, z) < LAKE_R + 14) return 'Cozy Cove';
  const rv = riverAt(x, z);
  if (rv.sd < 8) return rv.which.name;
  return 'Five Lakes Valley';
}

export function buildTerrainMesh() {
  const sandy = (x, z, h) => {
    if (h === 1 && (x * x + z * z) > 3600) { const c = creekAt(x, z).sd; if (c > 0.6 && c < 7 && riverSd(x, z) > 4) return false; } // v1.14.9: grassy creek banks
    if (h === 1) return true;
    if (h !== 2) return false;
    return lakeDist(x, z) < LAKE_R + 4 || riverSd(x, z) < 3 || valleyWater(x, z).sd < 4;
  };
  const marshy = (x, z) => { const w = valleyWater(x, z); return w.zone === 'marsh' && w.sd < 9; };
  // ground material of each block (paths are added afterwards from the smooth trail distance)
  const kindOf = (x, z, h) => {
    if (h <= 0) return h <= -6 ? KIND.gravel : h <= -3 ? KIND.gravel : (x < -16 && lakeDist(x, z) < LAKE_R) || marshy(x, z) ? KIND.mud : KIND.bed;
    if (h >= 6 && valleyWater(x, z).zone === 'quarry' && valleyWater(x, z).sd < 7) return KIND.stone;
    if (h <= 2 && marshy(x, z)) return KIND.mud;
    if (sandy(x, z, h)) return KIND.sand;
    const snowline = 17 + Math.round(fbm(x * 1.5, z * 1.5) * 3);
    if (h >= snowline) return KIND.snow;
    if (h >= 13 || (h >= 8 && fbm(x * 3.1, z * 3.1) > 0.15)) return KIND.stone;
    return KIND.grass;
  };
  const NK = 8;
  const chans = Array.from({ length: NK }, () => new Float32Array(N * N));
  for (let x = -HALF; x < HALF; x++) for (let z = -HALF; z < HALF; z++) chans[kindOf(x, z, heightAt(x, z))][idx(x, z)] = 1;
  const soft = chans.map((c) => cornersOf(blurGrid(c, N, 0.85), N));
  const weights = new Float32Array(M * M * NK);
  for (let a = 0; a < M; a++) for (let b = 0; b < M; b++) {
    const g = a * M + b, x = a - HALF, z = b - HALF;
    let sum = 0;
    for (let k = 0; k < NK; k++) { weights[g * NK + k] = soft[k][g]; sum += soft[k][g]; }
    for (let k = 0; k < NK; k++) weights[g * NK + k] /= sum || 1;
    // dirt trails follow the true trail lines, so they curve with soft edges
    const y = SURF[g];
    if (y > WATER_Y - 0.1 && y < 5.5) {
      const tr = trailDist(x, z);
      const t = tr > 1.45 ? 0 : tr < 0.55 ? 1 : 1 - (tr - 0.55) / 0.9;
      const dirt = t * t * (3 - 2 * t) * 0.95;
      if (dirt > 0) { for (let k = 0; k < NK; k++) weights[g * NK + k] *= 1 - dirt; weights[g * NK + KIND.dirt] += dirt; }
    }
  }
  // remember how grassy each corner is, for the grass tufts, bushes and rocks scattered on top
  GRASS = new Float32Array(M * M);
  for (let g = 0; g < M * M; g++) GRASS[g] = weights[g * NK + KIND.grass];
  const mesh = buildSmoothTerrain({
    HALF, N, surf: SURF, weights, waterY: WATER_Y,
    tint: (x, z) => 0.93 + fbm(x * 0.7 + 3, z * 0.7 - 9) * 0.07 + fbm(x * 2.3, z * 2.3) * 0.025,
  });
  // caustics patch the same shader: run the ground blend first, then the caustics
  const splat = mesh.material.onBeforeCompile;
  applyCaustics(mesh.material);
  const caustic = mesh.material.onBeforeCompile;
  mesh.material.onBeforeCompile = (sh, r) => { splat(sh, r); caustic(sh, r); };
  mesh.material.customProgramCacheKey = () => 'smooth-splat-caustics';
  return mesh;
}

// Random-ish but stable spots for trees and plants (spatial hash keeps spacing checks fast).
export function scatterSpots(seed, count, filter) {
  const out = [];
  let s = seed >>> 0;
  let guard = 0;
  const cells = new Map();
  const key = (x, z) => `${Math.floor(x / 3)},${Math.floor(z / 3)}`;
  // v1.14.3: positions from a proper hash (mulberry32), anywhere, not whole blocks. The old version took an LCG's low
  // bits modulo the map size, and those repeat in short cycles, so trees and reeds stood in rows.
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  while (out.length < count && guard++ < count * 40) {
    const x = Math.round((next() * 2 - 1) * HALF * 4) / 4;
    const z = Math.round((next() * 2 - 1) * HALF * 4) / 4;
    if (!filter(x, z)) continue;
    let near = false;
    for (let i = -1; i <= 1 && !near; i++) for (let j = -1; j <= 1 && !near; j++) {
      for (const p of cells.get(key(x + i * 3, z + j * 3)) || []) if (Math.abs(p.x - x) < 3 && Math.abs(p.z - z) < 3) { near = true; break; }
    }
    if (near) continue;
    const p = { x, z, r: Math.floor(next() * 4294967296) };
    out.push(p);
    const k = key(x, z);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(p);
  }
  return out;
}

export { trailDist, riverSd, valleyWater, lakeDist, poolAt, creekAt };
export const TERRAIN_N = N;
