// v1.14.9 The Wild Woods: the things in the forest between the lakes. Built from simple flat-shaded shapes (the lake
// landmarks' style), each site merged into one mesh per material so the whole lot costs a few dozen draw calls, and
// each site is hidden when you're far from it.
//   Ridge Lookout     the ranger's fire tower in the west hills (climb it: a deck 9 m up, Ranger Rhea at the foot)
//   Trapper's Cabin   a log cabin in the east woods, smoke from the chimney, snowshoes on the wall
//   Crash Clearing    a little bush plane that came down in the far east woods long ago, moss on its wings
//   Hollis's Treehouse a hut in a giant oak north of Frostpine, where Old Hollis lives
//   Footbridges       plank bridges over Tarn Run and Hollow Brook
//   Beavers           a dam across Hollow Brook and a lodge in Fox Hollow (the beavers swim in wildwoods.js)
//   Beehives          wild skeps in the trees round Lantern Spring and the cabin
//   Fairy rings       circles of mushrooms that glow after dark
//   Pumpkins          autumn patches at the lodge, the camp, the trailer park and Gus's cabin
//   Signs             a little sign at each hidden pool
//   Ridgeback Loop    the bike trail's start gate, checkpoint arches and jumps (the trail itself is in terrain.js)
// Positions live here (WOODS) so the game (wildwoods.js), the map and the tests share them.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { surfaceY, CLEARINGS, CREEKS, POOLS, TRAILS, WATER_Y, addWalkway, groundY } from './terrain.js';
import { addBox, addCircle } from './colliders.js';
import { nightWindows } from './nightwindows.js';

// ---------------------------------------------------------------- materials (shared, so sites merge together)
const MATS = new Map();
export function wmat(color, o = {}) {
  const key = `${color}|${o.emissive || ''}|${o.opacity ?? ''}`;
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...o, ...(o.opacity != null ? { transparent: true } : {}) }));
  return MATS.get(key);
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n);
const blob = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const jit = (i, k = 1) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
const gy = (x, z) => surfaceY(x, z);

/** A builder for one site: add primitives in the site's local frame, then bake them into one mesh per material. */
class Site {
  constructor(name, x, z, yaw = 0, y = gy(x, z)) {
    this.name = name; this.x = x; this.z = z; this.yaw = yaw; this.y = y;
    this.root = new THREE.Group(); this.root.position.set(x, y, z); this.root.rotation.y = yaw;
    this.parts = new THREE.Group(); this.root.add(this.parts);
    this.live = []; // things that stay separate (animated or glowing)
  }
  /** Local (lx, lz) to world. */
  w(lx, lz) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); return [this.x + lx * c + lz * s, this.z - lx * s + lz * c]; }
  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    if (s !== 1) m.scale.setScalar(s);
    this.parts.add(m);
    return m;
  }
  keep(obj) { this.root.add(obj); this.live.push(obj); return obj; }
  /** Solid circle at local (lx, lz). */
  solid(lx, lz, r, top) { const [x, z] = this.w(lx, lz); addCircle(x, z, r, top != null ? { top } : {}); }
  bake() {
    this.root.updateMatrixWorld(true);
    const buckets = new Map();
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    this.parts.traverse((o) => {
      if (!o.isMesh) return;
      let g = o.geometry.index ? o.geometry : o.geometry; // all our primitives are indexed
      g = g.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); }
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (!buckets.has(o.material)) buckets.set(o.material, []);
      buckets.get(o.material).push(g);
    });
    this.root.remove(this.parts);
    for (const [mat, geos] of buckets) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = true; m.receiveShadow = true;
      this.root.add(m);
    }
    this.root.name = `woods-${this.name}`;
    return this.root;
  }
}

/** Merge a loose group's meshes (in its own space) into one mesh per material. Returns a new group. */
export function bakeLoose(group, keep = () => false) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), buckets = new Map(), out = new THREE.Group();
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (keep(o)) { const c = o.clone(); new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld).decompose(c.position, c.quaternion, c.scale); out.add(c); return; } // (v1.14.10: was applied on top of its own transform)
    const g = o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (g.attributes.normal && !(g.attributes.normal.array instanceof Float32Array)) { const n = g.attributes.normal, f = new Float32Array(n.count * 3); for (let i = 0; i < n.count; i++) { f[i * 3] = n.getX(i); f[i * 3 + 1] = n.getY(i); f[i * 3 + 2] = n.getZ(i); } g.setAttribute('normal', new THREE.BufferAttribute(f, 3)); } // (packed Blender meshes)
    if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
  });
  for (const [mat, geos] of buckets) { const m = new THREE.Mesh(mergeGeometries(geos, false), mat); m.castShadow = true; m.receiveShadow = true; out.add(m); }
  return out;
}

// ---------------------------------------------------------------- where everything is
const C = CLEARINGS;
const along = (pts, f) => { // a point a fraction f along a polyline, and its direction
  let total = 0; const seg = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); total += l; }
  let d = f * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) { const t = Math.min(1, d / seg[i]); const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, ux: (bx - ax) / seg[i], uz: (bz - az) / seg[i] }; }
    d -= seg[i];
  }
  return { x: pts[0][0], z: pts[0][1], ux: 1, uz: 0 };
};
const LOOP = TRAILS.loop.pts;
const LOOP_RING = LOOP.slice(3); // the loop itself (the first three points lead in from the Lilymarsh trail)

export const WOODS = {
  tower: { x: C.tower.x, z: C.tower.z, deck: 9, half: 2.1 },
  trapper: { x: C.trapper.x, z: C.trapper.z },
  plane: { x: C.plane.x, z: C.plane.z },
  hollis: { x: C.hollis.x, z: C.hollis.z },
  wagonStops: ['wagon1', 'wagon2', 'wagon3', 'wagon4', 'wagon5'].map((k) => ({ id: k, x: C[k].x, z: C[k].z })),
  bridges: [{ creek: 'tarnrun', ...along(CREEKS.tarnrun.pts, 0.55) }, { creek: 'hollowbrook', ...along(CREEKS.hollowbrook.pts, 0.62) }],
  dam: { ...along(CREEKS.hollowbrook.pts, 0.22) },
  lodge: { x: POOLS.foxhollow.cx + 5, z: POOLS.foxhollow.cz + 6.5 },
  hives: [[-21, 141], [-41, 158], [-24, 162], [124, -20], [111, -4]].map(([x, z]) => ({ x, z })),
  rings: [[-120, 10], [70, -60], [-60, 110], [150, 120], [-130, -100], [20, -170]].map(([x, z]) => ({ x, z })),
  pumpkins: [[C.lodge.x + 9, C.lodge.z + 12], [C.camp.x + 7, C.camp.z - 6], [C.park.x - 10, C.park.z + 8], [-14, 50], [C.fernview.x + 6, C.fernview.z + 8]].map(([x, z]) => ({ x, z })),
  pools: Object.entries(POOLS).map(([id, P]) => ({ id, name: P.name, x: P.cx, z: P.cz, sign: { x: P.cx + (P.rx + 3), z: P.cz + 1 } })),
  // Ridgeback Loop: the gate where the lead-in meets the loop, six arches round it, three jumps
  gate: { ...along(LOOP_RING, 0) },
  arches: [1, 2, 3, 4, 5, 6].map((i) => ({ i, ...along(LOOP_RING, i / 7) })),
  jumps: [0.21, 0.5, 0.79].map((f) => ({ ...along(LOOP_RING, f) })),
  loop: LOOP_RING,
};

// ---------------------------------------------------------------- the sites
function fireTower() {
  const T = WOODS.tower, s = new Site('tower', T.x, T.z, 0.4);
  const wood = wmat('#8a6440'), woodD = wmat('#5e4128'), roof = wmat('#9a3a2e'), glass = wmat('#bcd8e4', { opacity: 0.45 }), rail = wmat('#6e4e30');
  const H = T.deck, a = 1.9;
  for (const [x, z] of [[-a, -a], [a, -a], [-a, a], [a, a]]) { s.add(box(0.32, H + 0.4, 0.32), woodD, x * 1.06, (H + 0.4) / 2, z * 1.06, x * -0.012, 0, z * 0.012); s.solid(x * 1.06, z * 1.06, 0.3, s.y + H); }
  for (let k = 1; k < 4; k++) { // cross braces on each face
    const y = (k / 4) * H;
    for (const side of [0, 1, 2, 3]) { const r = side * Math.PI / 2; s.add(box(a * 2.2, 0.14, 0.14), wood, Math.sin(r) * a * 1.05, y, Math.cos(r) * a * 1.05, 0, r, (k % 2 ? 1 : -1) * 0.5); }
  }
  s.add(box(a * 2.3, 0.22, a * 2.3), wood, 0, H, 0); // deck
  for (const side of [0, 1, 2, 3]) { const r = side * Math.PI / 2; s.add(box(a * 2.3, 0.1, 0.1), rail, Math.sin(r) * a * 1.12, H + 1.0, Math.cos(r) * a * 1.12, 0, r, 0); s.add(box(a * 2.3, 0.08, 0.08), rail, Math.sin(r) * a * 1.12, H + 0.55, Math.cos(r) * a * 1.12, 0, r, 0); }
  // the cab: corner posts, a glass band, a pyramid roof
  for (const [x, z] of [[-a, -a], [a, -a], [-a, a], [a, a]]) s.add(box(0.16, 2.4, 0.16), woodD, x * 1.1, H + 1.3, z * 1.1);
  s.add(box(a * 2.1, 0.9, a * 2.1), glass, 0, H + 1.85, 0);
  s.add(new THREE.ConeGeometry(a * 1.9, 1.3, 4), roof, 0, H + 3.15, 0, 0, Math.PI / 4, 0);
  // a zigzag stair up one face
  for (let i = 0; i < 18; i++) { const y = (i + 0.5) * (H / 18), side = Math.floor(i / 6) % 2 ? -1 : 1; s.add(box(0.9, 0.08, 0.32), wood, a + 0.65, y, side * (-1.6 + ((i % 6) / 5) * 3.2) * (Math.floor(i / 6) % 2 ? -1 : 1)); }
  s.add(box(0.08, H, 0.08), rail, a + 1.1, H / 2, -1.7); s.add(box(0.08, H, 0.08), rail, a + 1.1, H / 2, 1.7);
  // a flag on the roof and a map board at the foot
  s.add(box(0.05, 1.2, 0.05), woodD, 0, H + 4.2, 0); s.add(box(0.6, 0.35, 0.02), wmat('#3a8a5a'), 0.3, H + 4.55, 0);
  s.add(box(1.4, 1, 0.1), wood, -3.2, 1.4, 1.5, 0, 0.6, 0); s.add(box(0.1, 1.4, 0.1), woodD, -3.6, 0.7, 1.2); s.add(box(0.1, 1.4, 0.1), woodD, -2.8, 0.7, 1.8);
  s.solid(-3.2, 1.5, 0.5);
  // the deck you walk on (a walkway: walkY returns it inside the cab) and a rail that keeps you on it
  addWalkway({ cx: T.x, cz: T.z, ux: Math.cos(0.4), uz: -Math.sin(0.4), half: a * 1.1, w: a * 2.2, y: s.y + H + 0.11 });
  T.y = s.y; T.deckY = s.y + H + 0.11;
  return s.bake();
}

function logWall(s, mat, matD, len, h, x, z, ry) {
  const n = Math.round(h / 0.32);
  for (let i = 0; i < n; i++) s.add(cyl(0.17, 0.17, len + (i % 2 ? 0.3 : 0.5), 7), i % 2 ? matD : mat, x, 0.17 + i * 0.32, z, 0, ry, Math.PI / 2);
}
function trapperCabin() {
  const T = WOODS.trapper, s = new Site('trapper', T.x, T.z, -0.7);
  const log = wmat('#7a5434'), logD = wmat('#61412a'), roof = wmat('#4f5a3a'), stone = wmat('#8a857a'), door = wmat('#5a3a22'), white = wmat('#e8e4da');
  logWall(s, log, logD, 5, 2.3, 0, -2, 0); logWall(s, log, logD, 5, 2.3, 0, 2, 0);
  logWall(s, log, logD, 4, 2.3, -2.5, 0, Math.PI / 2); logWall(s, log, logD, 4, 2.3, 2.5, 0, Math.PI / 2);
  for (const sd of [-1, 1]) s.add(box(6, 0.16, 2.8), roof, 0, 2.95, sd * 1.15, sd * 0.62, 0, 0);
  s.add(box(0.9, 3.8, 0.9), stone, 2.0, 1.9, -1.2); // chimney
  s.add(box(0.9, 1.7, 0.08), door, 0.6, 0.9, 2.18);
  const pane = nightWindows.pane(0.8, 0.55); pane.position.set(-1.2, 1.35, 2.2); s.keep(pane);
  s.add(box(0.9, 0.65, 0.06), wmat('#3a4a52'), -1.2, 1.35, 2.17);
  // snowshoes on the wall, a woodpile, a chopping block with an axe, a drying rack of fish
  for (const k of [-0.25, 0.25]) s.add(new THREE.TorusGeometry(0.28, 0.04, 4, 10), door, 1.7 + k, 1.4, 2.22, 0, 0, Math.PI / 2);
  for (let i = 0; i < 9; i++) s.add(cyl(0.13, 0.13, 1.1, 6), i % 2 ? log : logD, -3.4, 0.14 + Math.floor(i / 3) * 0.24, -1 + (i % 3) * 0.28, Math.PI / 2, 0, 0);
  s.add(cyl(0.3, 0.32, 0.5, 8), logD, -1.8, 0.25, 3.4); s.add(box(0.06, 0.6, 0.06), door, -1.75, 0.75, 3.4, 0, 0, 0.4); s.add(box(0.28, 0.12, 0.04), white, -1.6, 0.98, 3.4, 0, 0, 0.4);
  for (const x of [1.6, 3.4]) s.add(box(0.08, 1.6, 0.08), logD, x, 0.8, 3.6); s.add(box(1.9, 0.06, 0.06), logD, 2.5, 1.55, 3.6);
  for (let i = 0; i < 4; i++) s.add(box(0.12, 0.42, 0.06), wmat('#9aa8a0'), 1.9 + i * 0.4, 1.3, 3.6);
  const [cx, cz] = s.w(0, 0); addBox(cx - 2.9, cz - 2.9, cx + 2.9, cz + 2.9); // (yawed, so a generous square)
  s.solid(-3.4, -0.7, 0.6); s.solid(-1.8, 3.4, 0.35);
  T.chimney = s.w(2.0, -1.2); T.y = s.y;
  return s.bake();
}

function bushPlane() {
  const T = WOODS.plane, s = new Site('plane', T.x, T.z, 0.9);
  const paint = wmat('#d8a03a'), paintD = wmat('#a8762a'), white = wmat('#e8e4da'), moss = wmat('#5f7d3c'), dark = wmat('#3a3a3e'), glass = wmat('#8ab0c0', { opacity: 0.6 }), metal = wmat('#9a9a9a');
  const P = new THREE.Group(); P.position.set(0, 0.55, 0); P.rotation.set(0.06, 0, -0.1); s.parts.add(P);
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); P.add(m); };
  add(box(4.6, 1.1, 1.2), paint, 0, 0.55, 0); add(box(1.4, 0.8, 1.0), paintD, -2.9, 0.65, 0); add(box(1.0, 0.5, 0.7), paintD, -4.0, 0.75, 0);
  add(box(0.9, 0.7, 1.22), glass, 1.4, 1.0, 0);
  add(box(1.2, 1.1, 0.12), paint, -4.3, 1.35, 0); add(box(0.9, 0.08, 2.4), paint, -4.2, 0.9, 0); // tail
  add(box(1.6, 0.1, 5.2), white, 0.6, 1.25, 1.6, 0, 0, 0.04); // the right wing, still on
  add(box(0.06, 1.6, 0.06), metal, 0.6, 0.6, 1.2, 0.5, 0, 0);
  add(box(0.5, 0.5, 0.5), dark, 2.6, 0.5, 0); add(box(0.08, 1.6, 0.18), dark, 2.9, 0.45, 0.2, 0.9, 0, 0); // nose and a bent prop
  add(box(1.6, 0.12, 0.6), moss, 0.6, 1.32, 2.8); add(box(1.0, 0.1, 0.6), moss, -1.0, 1.12, 0.3);
  // the left wing, torn off and lying in the ferns, and a crate that fell out of the hold
  s.add(box(1.5, 0.1, 4.6), white, 1.0, 0.2, -4.6, 0.05, 0.4, 0.12); s.add(box(1.2, 0.1, 0.6), moss, 1.2, 0.3, -5.0, 0, 0.4, 0.12);
  s.add(box(0.8, 0.6, 0.6), wmat('#8a6a40'), -1.8, 0.3, -2.2, 0, 0.5, 0);
  s.add(cyl(0.3, 0.3, 0.2, 10), dark, 0.8, 0.3, -0.9, Math.PI / 2, 0, 0); // a wheel that came off
  const [x0, z0] = s.w(-3, 0), [x1, z1] = s.w(2.5, 0);
  for (let i = 0; i <= 6; i++) addCircle(x0 + (x1 - x0) * i / 6, z0 + (z1 - z0) * i / 6, 0.85);
  s.solid(1.0, -4.6, 1.0); s.solid(-1.8, -2.2, 0.5);
  T.y = s.y;
  return s.bake();
}

function treehouse() {
  const T = WOODS.hollis, s = new Site('hollis', T.x, T.z, 0.3);
  const bark = wmat('#5a4430'), barkD = wmat('#45331f'), leaf = wmat('#4f7d3a'), leafD = wmat('#3f6a2e'), plank = wmat('#9a7a52'), plankD = wmat('#7a5a3a'), roof = wmat('#7a3a2a'), rope = wmat('#c8b088');
  s.add(cyl(1.0, 1.5, 8.5, 9), bark, 0, 4.25, 0); // the old oak
  for (const [a, l] of [[0.5, 3], [2.4, 2.6], [4.1, 3.2]]) s.add(cyl(0.3, 0.45, l, 6), barkD, Math.cos(a) * 1.4, 7.2, Math.sin(a) * 1.4, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; s.add(blob(2.6 + jit(i) * 0.8, 1), i % 2 ? leaf : leafD, Math.cos(a) * 3, 9.2 + jit(i, 3) * 1.6, Math.sin(a) * 3); }
  s.add(blob(3.4, 1), leaf, 0, 11.2, 0);
  // the platform and the hut on it
  s.add(box(5, 0.2, 4.4), plank, 0.6, 5.0, 0);
  for (const [x, z] of [[-1.7, -2], [2.9, -2], [-1.7, 2], [2.9, 2]]) s.add(box(0.2, 5, 0.2), plankD, x, 2.5, z);
  s.add(box(2.8, 2.0, 2.4), plank, 1.2, 6.1, -0.3); for (const sd of [-1, 1]) s.add(box(3.2, 0.12, 1.8), roof, 1.2, 7.4, -0.3 + sd * 0.75, sd * 0.6, 0, 0);
  const pane = nightWindows.pane(0.7, 0.5); pane.position.set(1.2, 6.3, 0.92); s.keep(pane);
  s.add(box(0.75, 0.55, 0.05), wmat('#3a4a52'), 1.2, 6.3, 0.9);
  for (let i = 0; i < 12; i++) s.add(box(0.5, 0.05, 0.06), plankD, 3.2, 0.4 + i * 0.4, 1.6); // rope ladder
  s.add(box(0.03, 4.8, 0.03), rope, 3.0, 2.5, 1.6); s.add(box(0.03, 4.8, 0.03), rope, 3.4, 2.5, 1.6);
  const lamp = new THREE.Mesh(box(0.25, 0.32, 0.25), wmat('#ffd27a', { emissive: '#c88a2a' })); lamp.position.set(-1.6, 4.6, 2.1); s.keep(lamp); T.lamp = lamp;
  s.add(box(1.4, 0.7, 0.4), plankD, -2.8, 0.35, 2.2); // a bench at the foot
  s.solid(0, 0, 1.6);
  for (const [x, z] of [[-1.7, -2], [2.9, -2], [-1.7, 2], [2.9, 2]]) s.solid(x, z, 0.2);
  T.y = s.y;
  return s.bake();
}

function footbridge(B) {
  const yaw = Math.atan2(B.ux, B.uz) + Math.PI / 2; // across the creek
  const base = Math.max(gy(B.x + B.uz * 3, B.z - B.ux * 3), gy(B.x - B.uz * 3, B.z + B.ux * 3), WATER_Y + 0.2);
  const s = new Site(`bridge-${B.creek}`, B.x, B.z, yaw, base);
  const plank = wmat('#a07a4e'), plankD = wmat('#7a5a38');
  for (let i = 0; i < 11; i++) s.add(box(1.5, 0.1, 0.5), i % 2 ? plank : plankD, 0, 0.22 + Math.sin((i / 10) * Math.PI) * 0.25, -2.6 + i * 0.52);
  for (const x of [-0.72, 0.72]) { s.add(box(0.08, 0.08, 5.6), plankD, x, 0.85, 0); for (const z of [-2.6, 0, 2.6]) s.add(box(0.1, 0.7, 0.1), plankD, x, 0.55, z); }
  addWalkway({ cx: B.x, cz: B.z, ux: Math.sin(yaw), uz: Math.cos(yaw), half: 2.9, w: 1.3, y: base + 0.35 });
  return s.bake();
}

function beavers() {
  const D = WOODS.dam, L = WOODS.lodge;
  const sticks = wmat('#6a4e30'), sticksD = wmat('#4e3822'), mud = wmat('#4a3a2a');
  const d = new Site('dam', D.x, D.z, Math.atan2(D.ux, D.uz) + Math.PI / 2, WATER_Y - 0.4);
  for (let i = 0; i < 26; i++) d.add(cyl(0.07, 0.09, 1.2 + jit(i) * 1.4, 5), i % 3 ? sticks : sticksD, (jit(i, 2) - 0.5) * 3.4, 0.2 + jit(i, 5) * 0.55, (jit(i, 7) - 0.5) * 0.7, (jit(i, 9) - 0.5) * 0.6, (jit(i, 4) - 0.5) * 0.5, Math.PI / 2 + (jit(i, 3) - 0.5) * 0.5);
  d.add(box(3.2, 0.4, 0.9), mud, 0, 0.15, 0);
  const l = new Site('beaver-lodge', L.x, L.z, 0.6, WATER_Y - 0.6);
  l.add(new THREE.SphereGeometry(1.7, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), mud, 0, 0, 0);
  for (let i = 0; i < 30; i++) { const a = jit(i) * Math.PI * 2, r = 0.6 + jit(i, 2) * 1.0; l.add(cyl(0.06, 0.08, 1 + jit(i, 3) * 0.9, 5), i % 2 ? sticks : sticksD, Math.cos(a) * r, 0.3 + (1.7 - r) * 0.7, Math.sin(a) * r, (jit(i, 4) - 0.5) * 1.6, a, (jit(i, 5) - 0.5) * 1.6); }
  addCircle(L.x, L.z, 1.8, { water: true });
  return [d.bake(), l.bake()];
}

/** A wild beehive hanging under a branch: a stack of golden rings. */
function hive(H, i) {
  const y = gy(H.x, H.z);
  const s = new Site(`hive${i}`, H.x, H.z, jit(i) * 6, y);
  const straw = wmat('#d8a840'), strawD = wmat('#b8862a'), bark = wmat('#5a4430'), leaf = wmat('#5a8a3a');
  s.add(cyl(0.3, 0.42, 4.2, 7), bark, 0, 2.1, 0); s.add(cyl(0.12, 0.16, 1.8, 5), bark, 0.8, 3.6, 0, 0, 0, -1.1);
  for (let k = 0; k < 4; k++) s.add(new THREE.TorusGeometry(0.28 - k * 0.04, 0.12, 5, 10), k % 2 ? strawD : straw, 1.3, 3.0 - k * 0.2 + 0.4, 0, Math.PI / 2, 0, 0);
  for (let k = 0; k < 3; k++) s.add(blob(1.2 + jit(i, k) * 0.4, 0), leaf, (jit(i, k + 3) - 0.5) * 1.6, 4.6 + k * 0.4, (jit(i, k + 6) - 0.5) * 1.6);
  s.solid(0, 0, 0.45);
  H.y = y; H.at = { x: s.w(1.3, 0)[0], y: y + 2.9, z: s.w(1.3, 0)[1] };
  return s.bake();
}

/** A fairy ring: a circle of little mushrooms whose caps glow after dark. */
export const RING_GLOW = wmat('#bfe8d8', { emissive: '#000000' });
function fairyRing(F, i) {
  const s = new Site(`ring${i}`, F.x, F.z, 0);
  const stem = wmat('#ece4d0');
  const n = 11;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, r = 2.2 + (jit(k, i) - 0.5) * 0.5, x = Math.cos(a) * r, z = Math.sin(a) * r, y = gy(F.x + x, F.z + z) - s.y;
    const h = 0.26 + jit(k, i + 3) * 0.16;
    s.add(cyl(0.05, 0.07, h, 5), stem, x, y + h / 2, z);
    s.add(new THREE.SphereGeometry(0.19 + jit(k, i + 5) * 0.08, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), RING_GLOW, x, y + h, z);
  }
  return s.bake();
}

/** An autumn pumpkin patch. */
function pumpkins(P, i) {
  const s = new Site(`pumpkins${i}`, P.x, P.z, jit(i) * 6);
  const orange = wmat('#e07a24'), orangeD = wmat('#c8621a'), stem = wmat('#5a6a2a'), leaf = wmat('#4f7d3a'), straw = wmat('#d8c070');
  for (let k = 0; k < 6; k++) {
    const x = (jit(k, i) - 0.5) * 3, z = (jit(k, i + 9) - 0.5) * 3, r = 0.22 + jit(k, i + 2) * 0.2, y = gy(P.x + x, P.z + z) - s.y;
    const p = s.add(new THREE.SphereGeometry(r, 8, 6), k % 2 ? orange : orangeD, x, y + r * 0.75, z); p.scale.set(1.15, 0.8, 1.15);
    s.add(cyl(0.03, 0.04, 0.14, 4), stem, x, y + r * 1.4, z, 0.2, 0, 0.1);
    if (k % 2) s.add(box(0.5, 0.02, 0.3), leaf, x + 0.3, y + 0.02, z, 0, k, 0);
  }
  s.add(box(0.9, 0.5, 0.55), straw, 1.6, gy(P.x + 1.6, P.z) - s.y + 0.25, 0.4); // a hay bale
  return s.bake();
}

function poolSign(P, i) {
  const s = new Site(`sign-${P.id}`, P.sign.x, P.sign.z, Math.atan2(P.x - P.sign.x, P.z - P.sign.z) + Math.PI);
  const wood = wmat('#8a6440'), woodD = wmat('#5e4128');
  s.add(box(0.12, 1.3, 0.12), woodD, 0, 0.65, 0); s.add(box(1.2, 0.42, 0.08), wood, 0, 1.15, 0.06, 0, 0, (jit(i) - 0.5) * 0.1);
  s.solid(0, 0, 0.18);
  return s.bake();
}

/** The Ridgeback Loop's start gate, checkpoint arches and jumps. */
function bikeLoop() {
  const out = [];
  const wood = wmat('#8a6440'), woodD = wmat('#5e4128'), flagA = wmat('#e0483a'), flagB = wmat('#f4d870'), dirt = wmat('#8a6a48');
  const arch = (P, name, big) => {
    const yaw = Math.atan2(P.ux, P.uz);
    const s = new Site(name, P.x, P.z, yaw);
    const W = big ? 2.6 : 2.2;
    for (const x of [-W, W]) { s.add(box(0.22, big ? 3.4 : 3, 0.22), woodD, x, (big ? 3.4 : 3) / 2, 0); s.solid(x, 0, 0.18); }
    s.add(box(W * 2 + 0.4, 0.3, 0.26), wood, 0, big ? 3.4 : 3, 0);
    for (let k = 0; k < 7; k++) s.add(box(0.3, 0.32, 0.02), k % 2 ? flagA : flagB, -W + 0.3 + k * ((W * 2 - 0.6) / 6), (big ? 3.4 : 3) - 0.32, 0.12, 0, 0, Math.PI / 4);
    if (big) { s.add(box(2.4, 0.6, 0.08), wmat('#2a2a2a'), 0, 3.9, 0); }
    return s.bake();
  };
  out.push(arch(WOODS.gate, 'loop-gate', true));
  WOODS.arches.forEach((A) => out.push(arch(A, `loop-arch${A.i}`, false)));
  WOODS.jumps.forEach((J, i) => { // a low dirt kicker: ride over it fast and the bike leaves the ground (bikes.js reads WOODS.jumps)
    const s = new Site(`loop-jump${i}`, J.x, J.z, Math.atan2(J.ux, J.uz));
    s.add(box(2.4, 0.5, 1.6), dirt, 0, 0.12, 0, -0.32, 0, 0);
    J.y = s.y;
    out.push(s.bake());
  });
  return out;
}

// ---------------------------------------------------------------- build it all
/** Builds every site, adds them to the scene, and returns { sites: [{ obj, x, z, r }], hives, rings, pumpkins }. */
export function buildWoods(scene) {
  const sites = [];
  const put = (obj, x, z, r = 90) => { scene.add(obj); sites.push({ obj, x, z, r }); return obj; };
  put(fireTower(), WOODS.tower.x, WOODS.tower.z, 140); // a landmark: seen from far off
  put(trapperCabin(), WOODS.trapper.x, WOODS.trapper.z);
  put(bushPlane(), WOODS.plane.x, WOODS.plane.z);
  put(treehouse(), WOODS.hollis.x, WOODS.hollis.z, 120);
  for (const B of WOODS.bridges) put(footbridge(B), B.x, B.z, 70);
  const [dam, lodge] = beavers(); put(dam, WOODS.dam.x, WOODS.dam.z, 70); put(lodge, WOODS.lodge.x, WOODS.lodge.z, 70);
  WOODS.hives.forEach((H, i) => put(hive(H, i), H.x, H.z, 70));
  const rings = WOODS.rings.map((F, i) => put(fairyRing(F, i), F.x, F.z, 60));
  const pumpkinSites = WOODS.pumpkins.map((P, i) => put(pumpkins(P, i), P.x, P.z, 70));
  WOODS.pools.forEach((P, i) => put(poolSign(P, i), P.sign.x, P.sign.z, 50));
  for (const o of bikeLoop()) put(o, o.position.x, o.position.z, 90);
  return { sites, rings, pumpkinSites };
}

/** Hide sites you're far from. Call now and then (every half second is plenty). */
export function cullWoods(sites, px, pz) {
  for (const s of sites) { const on = Math.hypot(s.x - px, s.z - pz) < s.r; if (s.obj.visible !== on) s.obj.visible = on; }
}

/** Is (x, z) a good spot to pitch a camp: in the woods, on gentle dry ground, away from water, trails and settlements? */
export function campable(x, z, trailDist, isWater, near) {
  if (groundY(x, z) == null) return false;
  if (trailDist(x, z) < 5) return false;
  for (let a = 0; a < 8; a++) { const px = x + Math.cos(a * 0.785) * 4, pz = z + Math.sin(a * 0.785) * 4; if (isWater(px, pz) || groundY(px, pz) == null) return false; }
  for (const c of Object.values(CLEARINGS)) if (Math.hypot(x - c.x, z - c.z) < c.r + 6) return false;
  if (Math.hypot(x, z) < 70) return false; // not in Cozy Cove itself
  return !near?.(x, z);
}
