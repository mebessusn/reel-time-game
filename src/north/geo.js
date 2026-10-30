// Frostmere (map 3): the frozen north's geography. A square world far west of the valley (centre NORTH.x, NORTH.z),
// reached by Skye's bush plane. Local coordinates (u, v) are metres from the centre; -v is north, toward the sea.
//
// The land is a height grid (1 m), built once on the first visit. Water comes in three kinds:
// - the frozen lake (Frostmere) and the frozen river (the Long Glide): an ice sheet at ICE_Y you walk and skate on;
//   it's only water where someone has drilled a hole;
// - open water: the sea past the floe edge, Steamhole Springs and the plunge pool under the Frozen Falls;
// - the sea ice between the coast and the floe edge (walkable, with leads of open water at the edge).
import { makeNoise2D } from '../core/rng.js';

export const WATER_Y = 0.85; // (terrain.js WATER_Y: the water line)
export const ICE_Y = 1.0; // the top of the ice sheet
export const NORTH = { x: -3000, z: 0, half: 380 };
export const inNorth = (x, z) => Math.abs(x - NORTH.x) < NORTH.half && Math.abs(z - NORTH.z) < NORTH.half;
export const toLocal = (x, z) => [x - NORTH.x, z - NORTH.z];
export const toWorld = (u, v) => ({ x: NORTH.x + u, z: NORTH.z + v });

const noise = makeNoise2D(9061);
const noise2 = makeNoise2D(4127);
const fbm = (u, v, s, o = 4, n = noise) => { let a = 0, f = 1, amp = 1, t = 0; for (let i = 0; i < o; i++) { a += n(u * s * f, v * s * f) * amp; t += amp; f *= 2; amp *= 0.5; } return a / t; };
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const ell = (u, v, cx, cz, rx, rz) => Math.hypot((u - cx) / rx, (v - cz) / rz);
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L));
  return { d: Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t };
}
export function polyDist(u, v, pts) {
  let best = { d: 1e9, i: 0, t: 0 };
  for (let i = 0; i < pts.length - 1; i++) { const r = segDist(u, v, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); if (r.d < best.d) best = { d: r.d, i, t: r.t }; }
  return best;
}

// ---------------------------------------------------------------- the shapes
/** Frostmere, the big lake: three lobes (main, west bay, Hearthwick bay) with a wobbly shore. sd < 0 inside (metres-ish). */
export function lakeSd(u, v) {
  const w = fbm(u, v, 0.012, 3) * 0.16;
  const e = Math.min(ell(u, v, 0, 10, 165, 100), ell(u, v, -130, -10, 80, 60), ell(u, v, 70, 85, 70, 42));
  return (e - 1 + w) * 90;
}
/** The Long Glide: the frozen river from the lake's east outlet, winding south-east through the taiga. */
export const RIVER = [[150, 20], [185, 40], [215, 80], [232, 125], [262, 158], [300, 175], [326, 214], [320, 262], [296, 300]];
export const RIVER_W = 11;
export const riverDist = (u, v) => polyDist(u, v, RIVER);
/** The glacier stream: from the glacier tongue down over the Frozen Falls into the lake's west bay. */
export const STREAM = [[-300, -150], [-282, -110], [-262, -70], [-242, -40], [-214, -22]];
export const FALLS = { u: -252, v: -55, drop: 7 };
export const FALLS_POOL = { u: -238, v: -36, r: 8 };
/** The sea: open water north of the floe edge, sea ice between the coast and the edge. */
export const coastV = (u) => -205 + 14 * Math.sin(u / 47) + 8 * Math.sin(u / 19 + 1.3) - 26 * Math.exp(-(((u - 190) / 34) ** 2)); // (Bear Point juts out)
export const floeV = (u) => coastV(u) - 46 - 10 * Math.sin(u / 33 + 0.5);
export const SPRINGS = { u: -148, v: 150, r: 10 };
/** v1.17.2 Ember Hollow: three hot pools in a valley on the south side of the map. */
export const HOLLOW = [{ u: 18, v: 282, r: 8 }, { u: 36, v: 292, r: 5.5 }, { u: 12, v: 298, r: 4.5 }];

// ---------------------------------------------------------------- places (local u, v)
// v1.17.1: the Snow Goose's ground track on the Hearthwick ice (local u, v): the roll-out after landing and the taxi
// out to take off, both ending / starting at the parking spot (base.js STRIP.park, (32, 100)). frostmere.js flies these;
// the shanty town keeps clear of them (TAXI_CLEAR: half the 13.4 m wingspan, a shanty's own size and a margin).
export const TAXI_IN = [[20, 64], [32, 84], [32, 100]];
export const TAXI_OUT = [[32, 100], [32, 76], [26, 62], [0, 60]];
export const TAXI_CLEAR = 9.5;
export const P = {
  village: { u: 72, v: 160, name: 'Hearthwick' },
  shanties: { u: 60, v: 108, name: 'Hearthwick Shanty Town' },
  rink: { u: 112, v: 100, name: 'Hearthwick Rink' },
  strip: { u: -40, v: 60, name: 'Hearthwick Ice Strip' }, // the plane lands west to east along v 60
  ridge: { u: -10, v: -38, name: 'The Pressure Ridge' },
  glacier: { u: -300, v: -170, name: 'Glacier Tongue' },
  caves: { u: -318, v: -150, name: 'The Blue Caves' },
  floe: { u: 40, v: -262, name: 'The Floe Edge' },
  bearpoint: { u: 190, v: -218, name: 'Bear Point' },
  springs: { u: SPRINGS.u, v: SPRINGS.v, name: 'Steamhole Springs' },
  falls: { u: FALLS.u, v: FALLS.v, name: 'The Frozen Falls' },
  glide: { u: 262, v: 158, name: 'The Long Glide' },
  aurorahill: { u: 255, v: -80, name: 'Aurora Hill' },
  wreck: { u: -130, v: -226, name: 'The Wreck of the Valiant' },
  taiga: { u: -230, v: 250, name: 'Taiga Edge' },
  trapper: { u: -258, v: 236, name: "Old Ansel's Cabin" },
  station: { u: 300, v: -175, name: 'Skyward Station' },
  kennels: { u: 150, v: 172, name: 'The Kennels' },
  sledtrail: { u: 270, v: 40, name: 'The Sled Trail' },
  galena: { u: -176, v: 112, name: 'Galena' },
  hollow: { u: 24, v: 288, name: 'Ember Hollow' },
  skyline: { u: 180, v: 296, name: 'Skyline Base' },
  summit: { u: 180, v: 364, name: 'Skyline Summit' },
  skijump: { u: 250, v: 330, name: 'The Big Air Jump' },
};
export const PLACE_LIST = Object.entries(P).map(([id, p]) => ({ id, ...p }));
/** Building pads: level ground for Hearthwick and the outposts ({ u, v, r, h, tilt } tilt: rise per metre southward). */
export const PADS = [
  { u: 72, v: 168, r: 50, h: 2.4, tilt: 0.018 }, // Hearthwick
  { u: 150, v: 172, r: 20, h: 3.0, tilt: 0 }, // the kennels
  { u: 30, v: 140, r: 12, h: 1.9, tilt: 0.02 }, // Skye's hangar
  { u: -258, v: 236, r: 12, h: 9.5, tilt: 0 }, // Old Ansel's cabin
  { u: 300, v: -175, r: 16, h: 2.4, tilt: 0 }, // Skyward Station
  { u: -176, v: 112, r: 34, h: 3.2, tilt: 0 }, // v1.17.2: Galena, the old mining town
  { u: 24, v: 288, r: 28, h: 3, tilt: 0 }, // Ember Hollow
  { u: 180, v: 296, r: 16, h: 4, tilt: 0 }, // Skyline's base station
  { u: 180, v: 364, r: 15, h: 27.5, tilt: 0 }, // Skyline's summit
  { u: 30, v: 216, r: 11, h: 3, tilt: 0 }, { u: 150, v: 284, r: 11, h: 3.5, tilt: 0 }, { u: 232, v: -36, r: 11, h: 5, tilt: 0 }, { u: 40, v: -188, r: 11, h: 3, tilt: 0 }, { u: -136, v: 118, r: 11, h: 3, tilt: 0 }, // the Ring Line's stations
];

// ---------------------------------------------------------------- the height grid
// LAND[i] = ground height (y) for land, or the bed height under water/ice. KIND[i]: 0 land, 1 lake ice, 2 river
// ice, 3 sea ice, 4 open sea, 5 open pool (springs, falls pool).
export const GRID = { N: 761, step: 1, o: -380 };
let LAND = null, KINDS = null, DEPTH = null;
/** Packed snow, kept white however steep: Skyline's piste and the Big Air Jump. */
export const groomed = (u, v) => (Math.abs(u - 180) < 70 && v > 296 && v < 376) || (Math.abs(u - 250) < 22 && v > 298 && v < 340);
/** Where the Big Air Jump's lip stands. */
export const JUMP = { u: 250, v: 318 };
export const K = { LAND: 0, LAKE: 1, RIVER: 2, SEAICE: 3, SEA: 4, POOL: 5 };

/** A smooth minimum: like Math.min, but rounds the crease where the two meet over about k metres of height. */
const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };
/** Cut the land down toward `target` (smoothly), fading the cut out to nothing by distance `reach`: no ledge where it stops. */
const carve = (h, target, k, d, reach) => h + (smin(h, target, k) - h) * smooth(reach, reach * 0.55, d);
function rawHeight(u, v) {
  // rolling snowy tundra, rising to mountains in the west and north-west, hills in the east
  let h = 3 + fbm(u, v, 0.008, 4) * 6 + fbm(u + 500, v, 0.03, 3, noise2) * 1.2;
  const west = smooth(-150, -330, u) * (0.6 + 0.4 * smooth(250, -100, v));
  h += west * (18 + fbm(u, v, 0.02, 4) * 22);
  // the glacier tongue: a long smooth tongue of ice flowing down out of the north-west mountains
  const gl = polyDist(u, v, [[-370, -260], [-330, -200], [-300, -165]]);
  h = h * (1 - smooth(40, 10, gl.d)) + (14 + 30 * (1 - gl.t) + fbm(u, v, 0.05, 2) * 1.5) * smooth(40, 10, gl.d);
  // the Blue Caves (v1.17.1): the glacier's snout ends in an ice cliff, and the caves run back into it
  { const du = u - P.caves.u, dv = v - P.caves.v; h += 14 * smooth(11, 4, du) * smooth(34, 22, Math.abs(dv - 2)) * smooth(-90, -60, du); }
  // Aurora Hill and Bear Point
  h += 20 * Math.exp(-((u - 255) ** 2 + (v + 80) ** 2) / (2 * 38 ** 2));
  h += 7 * Math.exp(-((u - 190) ** 2 + (v + 218) ** 2) / (2 * 22 ** 2)) * (0.8 + 0.4 * fbm(u, v, 0.1, 2));
  // v1.17.2: the snow lies in drifts: long low dunes along the wind and softer swells between them (real relief you walk over)
  { const n = fbm(u, v, 0.03, 2), band = Math.sin((u * 0.8 + v * 0.6) * 0.16 + fbm(u, v, 0.012, 2) * 7); h += n * 1.5 + band * (0.28 + 0.3 * Math.max(0, n + 0.2)); }
  // building pads, eased into the land round them
  // v1.17.2: the Big Air Jump, a kicker across the foot of the south slope (you come down it heading north, and it throws you off)
  // v1.17.2: Skyline's piste, one long even slope from the base station to the summit
  { const w = Math.exp(-((u - 180) ** 2) / (2 * 42 ** 2)) * smooth(296, 310, v) * smooth(372, 354, v); h += (4 + (v - 306) * 0.5 - h) * w; }
  { const dv = v - JUMP.v, w = Math.exp(-((u - JUMP.u) ** 2) / (2 * 8 ** 2)); if (dv >= 0 && dv < 16) h += (16 - 2.4 * Math.sin(Math.PI * dv / 16) - h) * w * smooth(16, 12, dv); }
  for (const p of PADS) { const d = Math.hypot(u - p.u, v - p.v); if (d < p.r + 14) { const k = smooth(p.r + 14, p.r, d); h = h * (1 - k) + (p.h + (v - p.v) * p.tilt) * k; } }
  // the far rim: mountains all round the edge so the world doesn't stop at a cliff
  const edge = Math.max(Math.abs(u), Math.abs(v));
  h += smooth(300, 375, edge) * (30 + fbm(u, v, 0.015, 3) * 25) * (v < -150 && Math.abs(u) < 300 ? 0 : 1) * (1 - smooth(85, 60, Math.abs(u - 180)) * smooth(400, 382, v)); // (v1.17.2: not across Skyline)
  return h;
}

/** v1.17.1: the ground's shape for drawing near the water, worked out exactly rather than read off the 1 m grid. The
 *  grid steps from a shore's height straight down to the lake bed between two cells, so a mesh drawn from it showed a
 *  saw-tooth where the snow met the ice. This is the same land, with the shore's slope carried on smoothly down under
 *  the ice (and the open water), so the snow meets the ice along a clean curve. */
export function renderHeight(u, v) {
  let h = rawHeight(u, v);
  const lsd = lakeSd(u, v), rv = riverDist(u, v), shore = Math.min(lsd, rv.d - RIVER_W / 2);
  h = Math.min(h, shore > 0 ? WATER_Y + 0.35 + shore * 0.18 + Math.max(0, shore - 8) * 0.25 : WATER_Y + 0.35 + shore * 0.6);
  const st = polyDist(u, v, STREAM);
  if (st.d < 30) { const bed = WATER_Y + 0.6 + (1 - st.t) * 12 + FALLS.drop * smooth(0.59, 0.53, st.t); h = carve(h, bed + 0.12 * st.d + 0.028 * st.d * st.d, 1.6, st.d, 30); } // (v1.17.1: a rounded valley, softly blended into the land: it was a sharp V)
  const coast = coastV(u);
  if (v < coast + 6) h = Math.min(h, WATER_Y + 0.4 + (v - coast) * (v >= coast ? 0.25 : 0.6));
  for (const [c, r] of [[SPRINGS, SPRINGS.r], [FALLS_POOL, FALLS_POOL.r]]) { const d = Math.hypot(u - c.u, v - c.v) - r; if (d < 16) h = carve(h, WATER_Y + 0.35 + d * (d > 0 ? 0.45 : 0.6), 1.2, d, 16); }
  return h;
}
/** How near (u, v) is to any water's edge (lakes, the river, the coast, the pools), in metres (negative: in it). */
export function waterEdge(u, v) {
  const rv = riverDist(u, v);
  return Math.min(lakeSd(u, v), rv.d - RIVER_W / 2, v - coastV(u), Math.hypot(u - SPRINGS.u, v - SPRINGS.v) - SPRINGS.r, Math.hypot(u - FALLS_POOL.u, v - FALLS_POOL.v) - FALLS_POOL.r);
}

/** Build the grid (about a second of work, done once: during the flight north, a few rows a frame). */
export function buildGrid() { if (LAND) return; const it = gridRows(); while (!it.next().done); }
export async function buildGridAsync(budgetMs = 8) {
  if (LAND) return;
  const it = gridRows();
  for (;;) {
    const t0 = performance.now();
    let r;
    while (!(r = it.next()).done && performance.now() - t0 < budgetMs);
    if (r.done || LAND) return;
    await new Promise((q) => setTimeout(q, 0));
  }
}
function* gridRows() {
  const { N, o } = GRID;
  const L = new Float32Array(N * N), KK = new Uint8Array(N * N), DD = new Float32Array(N * N);
  for (let i = 0; i < N; i++) {
    if (i % 8 === 0) yield i;
    for (let j = 0; j < N; j++) {
    const u = o + i, v = o + j, k = i * N + j;
    let h = rawHeight(u, v), kind = K.LAND, depth = 0;
    const lsd = lakeSd(u, v);
    const rv = riverDist(u, v);
    const coast = coastV(u), floe = floeV(u);
    const sp = Math.hypot(u - SPRINGS.u, v - SPRINGS.v), fp = Math.hypot(u - FALLS_POOL.u, v - FALLS_POOL.v);
    const st = polyDist(u, v, STREAM);
    // the shores ease down to the ice
    const shore = Math.min(lsd, rv.d - RIVER_W / 2);
    // v1.17.1: the springs and the plunge pool get banks that ease down to the water (they were cut straight down)
    const hp = HOLLOW.map((c) => [Math.hypot(u - c.u, v - c.v), c]);
    for (const [d, c] of [[sp, SPRINGS], [fp, FALLS_POOL], ...hp]) { const e = d - c.r; if (e < 16) h = carve(h, WATER_Y + 0.35 + e * 0.45, 1.2, e, 16); }
    if (shore > 0) h = Math.min(h, WATER_Y + 0.35 + shore * 0.18 + Math.max(0, shore - 8) * 0.25);
    // the glacier stream cuts a little valley, and drops over the falls
    if (st.d < 30) { const bed = WATER_Y + 0.6 + (1 - st.t) * 12 + FALLS.drop * smooth(0.59, 0.53, st.t); h = carve(h, bed + 0.12 * st.d + 0.028 * st.d * st.d, 1.6, st.d, 30); } // (v1.17.1: a rounded valley, softly blended into the land: it was a sharp V)
    if (lsd < 0) {
      kind = K.LAKE;
      // two deep basins, a shallow west bay and Hearthwick bay
      const b1 = Math.exp(-((u + 20) ** 2 + (v - 5) ** 2) / (2 * 55 ** 2)), b2 = Math.exp(-((u - 70) ** 2 + (v + 40) ** 2) / (2 * 40 ** 2));
      depth = Math.min(32, 1.2 + (-lsd) * 0.12 + 22 * b1 + 26 * b2 + fbm(u, v, 0.05, 2) * 1.5);
      if (ell(u, v, -130, -10, 80, 60) < 1) depth = Math.min(depth, 4 + (-lsd) * 0.05);
      if (ell(u, v, 70, 85, 70, 42) < 1) depth = Math.min(depth, 3 + (-lsd) * 0.06);
    } else if (rv.d < RIVER_W / 2) {
      kind = K.RIVER; depth = 1.2 + (RIVER_W / 2 - rv.d) * 0.5;
    }
    if (v < coast && kind === K.LAND) {
      // the coast: a beach of stones, then sea ice out to the floe edge, then the open sea
      if (v < floe) { kind = K.SEA; depth = 6 + (floe - v) * 0.6; }
      else { kind = K.SEAICE; depth = 2 + (coast - v) * 0.12; }
    } else if (v < coast + 6 && kind === K.LAND) h = Math.min(h, WATER_Y + 0.4 + (v - coast) * 0.25);
    if (sp < SPRINGS.r) { kind = K.POOL; depth = 2 + (SPRINGS.r - sp) * 0.25; }
    if (fp < FALLS_POOL.r) { kind = K.POOL; depth = 2.5 + (FALLS_POOL.r - fp) * 0.35; }
    for (const [d, c] of hp) if (d < c.r) { kind = K.POOL; depth = 1.5 + (c.r - d) * 0.3; }
    if (kind !== K.LAND) {
      h = WATER_Y - depth;
      // v1.17.1: just inside the water's edge the bed carries the shore's slope on down (still under the ice), so the
      // ground read off this grid (walking, the mesh) eases into the water instead of stepping off a ledge
      const edge = Math.min(lsd, rv.d - RIVER_W / 2, v - coast, sp - SPRINGS.r, fp - FALLS_POOL.r, ...hp.map(([d, c]) => d - c.r));
      if (edge < 0) h = Math.max(h, Math.min(ICE_Y - 0.4, WATER_Y + 0.35 + edge * 0.6));
    }
    L[k] = h; KK[k] = kind; DD[k] = depth;
    }
  }
  if (!LAND) { LAND = L; KINDS = KK; DEPTH = DD; }
}
export const gridReady = () => !!LAND;

const idx = (u, v) => {
  const { N, o } = GRID;
  const i = Math.max(0, Math.min(N - 1, Math.round(u - o))), j = Math.max(0, Math.min(N - 1, Math.round(v - o)));
  return i * N + j;
};
/** Ground (or bed) height at local (u, v), bilinear. */
export function landAt(u, v) {
  if (!LAND) buildGrid();
  const { N, o } = GRID;
  const fx = Math.max(0, Math.min(N - 1.001, u - o)), fz = Math.max(0, Math.min(N - 1.001, v - o));
  const a = Math.floor(fx), b = Math.floor(fz), s = fx - a, t = fz - b;
  const k = a * N + b;
  return (LAND[k] * (1 - s) + LAND[k + N] * s) * (1 - t) + (LAND[k + 1] * (1 - s) + LAND[k + N + 1] * s) * t;
}
export function kindAt(u, v) { if (!KINDS) buildGrid(); return KINDS[idx(u, v)]; }
export function depthAt(u, v) { if (!DEPTH) buildGrid(); return DEPTH[idx(u, v)]; }
export const isIce = (k) => k === K.LAKE || k === K.RIVER || k === K.SEAICE;
export const isOpen = (k) => k === K.SEA || k === K.POOL;

/** How thin the ice is here, 0 (thick) .. 1 (dangerously thin): by the inlets, the springs, the ridge and the edge. */
export function thinIce(u, v) {
  const k = kindAt(u, v);
  if (!isIce(k)) return 0;
  let t = 0;
  t = Math.max(t, smooth(28, 10, Math.hypot(u - SPRINGS.u, v - SPRINGS.v)));
  t = Math.max(t, smooth(24, 6, Math.hypot(u - 150, v - 20))); // the outlet into the Long Glide
  t = Math.max(t, smooth(22, 6, Math.hypot(u - FALLS_POOL.u, v - FALLS_POOL.v)));
  t = Math.max(t, smooth(10, 2, ridgeDist(u, v)) * 0.85);
  if (k === K.SEAICE) t = Math.max(t, smooth(12, 2, v - floeV(u)));
  return t;
}
/** The Pressure Ridge: a jagged line of shoved-up ice across the main lake. */
export const RIDGE = [[-95, -12], [-60, -30], [-28, -36], [8, -44], [40, -56], [72, -58]];
export const ridgeDist = (u, v) => polyDist(u, v, RIDGE).d;

// ---------------------------------------------------------------- fishing zones and regions
/** The fishing zone at (u, v) (only where there's water to fish: a hole, or open water). */
export function zoneOf(u, v) {
  const k = kindAt(u, v);
  if (k === K.SEA) return 'floe';
  if (k === K.SEAICE) return 'floe';
  if (k === K.POOL) return Math.hypot(u - SPRINGS.u, v - SPRINGS.v) < SPRINGS.r + 2 ? 'springs' : v > 200 ? 'hollow' : 'fallspool';
  if (k === K.RIVER) return riverDist(u, v).i < 1 ? 'rivermouth' : 'glide';
  if (k === K.LAKE) {
    if (ridgeDist(u, v) < 9) return 'ridge';
    if (Math.hypot(u - 150, v - 20) < 30) return 'rivermouth';
    const d = depthAt(u, v);
    if (d > 14) return 'basin';
    if (ell(u, v, 70, 85, 70, 42) < 1 || ell(u, v, -130, -10, 80, 60) < 1) return 'bay';
    return 'frostmere';
  }
  return null;
}

/** A place name for the HUD: the nearest named place within its reach, or the land around you. */
export function regionOf(u, v) {
  const near = (id, r) => Math.hypot(u - P[id].u, v - P[id].v) < r;
  if (near('village', 46)) return 'Hearthwick';
  if (near('shanties', 34)) return 'Hearthwick Shanty Town';
  if (near('rink', 14)) return 'Hearthwick Rink';
  if (near('kennels', 20)) return 'The Kennels';
  if (near('galena', 42)) return 'Galena';
  if (near('hollow', 34)) return 'Ember Hollow';
  if (near('skyline', 22)) return 'Skyline Base';
  if (near('summit', 22)) return 'Skyline Summit';
  if (near('skijump', 26)) return 'The Big Air Jump';
  if (near('springs', 26)) return 'Steamhole Springs';
  if (near('falls', 30)) return 'The Frozen Falls';
  if (near('caves', 24)) return 'The Blue Caves';
  if (near('glacier', 70)) return 'Glacier Tongue';
  if (near('wreck', 34)) return 'The Wreck of the Valiant';
  if (near('bearpoint', 40)) return 'Bear Point';
  if (near('station', 30)) return 'Skyward Station';
  if (near('aurorahill', 40)) return 'Aurora Hill';
  if (near('trapper', 28)) return "Old Ansel's Cabin";
  if (near('taiga', 70)) return 'Taiga Edge';
  const k = kindAt(u, v);
  if (k === K.SEA || (k === K.SEAICE && v - floeV(u) < 14)) return 'The Floe Edge';
  if (k === K.SEAICE) return 'The Sea Ice';
  if (k === K.RIVER) return 'The Long Glide';
  if (ridgeDist(u, v) < 16 && k === K.LAKE) return 'The Pressure Ridge';
  if (k === K.LAKE) return near('strip', 70) && Math.abs(v - P.strip.v) < 14 ? 'Hearthwick Ice Strip' : 'Frostmere';
  if (v < coastV(u) + 30) return 'The North Shore';
  if (u > 160) return 'The Tundra';
  return 'Frostmere';
}

// ---------------------------------------------------------------- sled trails (kept clear of trees)
/** The Sled Derby: a loop from the kennels out over the eastern tundra and back. */
export const SLED_TRAIL = [[150, 158], [192, 150], [232, 122], [262, 82], [282, 40], [276, 0], [246, -22], [210, -8], [196, 40], [186, 92], [166, 132], [150, 158]];
/** June's hired rides: from the kennels to the far corners of the map. */
export const SLED_ROUTES = {
  floe: { name: 'the Floe Edge', pts: [[150, 158], [130, 122], [112, 44], [100, -62], [72, -150], [46, -228]] },
  station: { name: 'Skyward Station', pts: [[150, 158], [200, 148], [250, 98], [288, 22], [300, -96], [298, -160]] },
  glacier: { name: 'the Glacier Tongue', pts: [[150, 158], [122, 124], [0, 104], [-140, 60], [-215, -40], [-262, -128]] },
  taiga: { name: 'the Trapper\'s Cabin', pts: [[150, 158], [150, 205], [100, 232], [-40, 252], [-190, 246], [-244, 234]] },
};
/** v1.17.2 the Ring Line, a chairlift right round the map: its line, and its five stations (src/north/lifts.js). */
export const RING_STOPS = [
  { id: 'hearth', name: 'Hearthwick', u: 30, v: 216 }, { id: 'sky', name: 'Skyline', u: 150, v: 284 }, { id: 'aurora', name: 'Aurora Hill', u: 232, v: -36 },
  { id: 'shore', name: 'North Shore', u: 40, v: -188 }, { id: 'galena', name: 'Galena', u: -136, v: 118 },
];
export const RING = [[30, 216], [90, 262], [150, 284], [230, 270], [292, 220], [312, 120], [300, 30], [232, -36], [206, -130], [150, -182], [40, -188], [-60, -190], [-150, -178], [-192, -100], [-200, 0], [-136, 118], [-104, 190], [-40, 226]];
export const TRAILS = [SLED_TRAIL, ...Object.values(SLED_ROUTES).map((r) => r.pts), [...RING, RING[0]]];
/** Distance to the nearest sled trail (to keep the trees off them). */
export function trailDist(u, v) { let d = 1e9; for (const t of TRAILS) d = Math.min(d, polyDist(u, v, t).d); return d; }
