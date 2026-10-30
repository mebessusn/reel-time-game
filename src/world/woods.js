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
import { SnowGoose } from '../north/plane.js';
import { SNOWGOOSE_MATS } from '../data/snowgooseMesh.js';
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
  /** v1.17.1: a straight piece from point a to point b (local [x, y, z]): a box w x d across, or a round one (r0 at a,
   *  r1 at b). Everything slanted is built with this, so braces, rails and roots meet what they join. */
  beam(a, b, mat, { w = 0.12, d = w, r0 = 0, r1 = r0, seg = 7, over = 0 } = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), len = dir.length() + over * 2;
    const geo = r0 ? new THREE.CylinderGeometry(r1, r0, len, seg) : new THREE.BoxGeometry(w, len, d);
    const m = new THREE.Mesh(geo, mat); m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.parts.add(m); return m;
  }
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
  bridges: [{ creek: 'tarnrun', ...along(CREEKS.tarnrun.pts, 0.35) }, { creek: 'hollowbrook', ...along(CREEKS.hollowbrook.pts, 0.62) }],
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
  // the frame (v1.17.1, rebuilt): four legs, three rings of girts, and one diagonal brace per panel, each cut to run
  // corner to corner (they used to be loose sticks at random angles)
  const L = a * 1.06, LV = [0, H / 3, (2 * H) / 3, H - 0.1];
  for (const [x, z] of [[-L, -L], [L, -L], [-L, L], [L, L]]) { s.add(box(0.32, H + 0.4, 0.32), woodD, x, (H + 0.4) / 2, z); s.solid(x, z, 0.3, s.y + H); }
  for (const y of LV.slice(1)) { // girts
    for (const sz of [-1, 1]) s.add(box(L * 2, 0.16, 0.14), wood, 0, y, sz * L);
    for (const sx of [-1, 1]) s.add(box(0.14, 0.16, L * 2), wood, sx * L, y, 0);
  }
  for (let k = 0; k < 3; k++) { // one diagonal per panel, alternating, on each face
    const y0 = LV[k] + 0.15, y1 = LV[k + 1], dy = y1 - y0, len = Math.hypot(L * 2, dy), ang = Math.atan2(dy, L * 2), flip = k % 2 ? -1 : 1;
    for (const sz of [-1, 1]) s.add(box(len, 0.14, 0.12), wood, 0, (y0 + y1) / 2, sz * (L + 0.02), 0, 0, flip * ang);
    for (const sx of [-1, 1]) { if (sx > 0) continue; s.add(box(0.12, 0.14, len), wood, sx * (L + 0.02), (y0 + y1) / 2, 0, -flip * ang, 0, 0); } // (not on the stair face)
  }
  s.add(box(a * 2.3, 0.22, a * 2.3), wood, 0, H, 0); // deck
  for (const side of [0, 1, 2, 3]) { const r = side * Math.PI / 2; s.add(box(a * 2.3, 0.1, 0.1), rail, Math.sin(r) * a * 1.12, H + 1.0, Math.cos(r) * a * 1.12, 0, r, 0); s.add(box(a * 2.3, 0.08, 0.08), rail, Math.sin(r) * a * 1.12, H + 0.55, Math.cos(r) * a * 1.12, 0, r, 0); }
  // the cab: corner posts, a glass band, a pyramid roof
  for (const [x, z] of [[-a, -a], [a, -a], [-a, a], [a, a]]) s.add(box(0.16, 2.4, 0.16), woodD, x * 1.1, H + 1.3, z * 1.1);
  s.add(box(a * 2.1, 0.9, a * 2.1), glass, 0, H + 1.85, 0);
  s.add(new THREE.ConeGeometry(a * 1.9, 1.3, 4), roof, 0, H + 3.15, 0, 0, Math.PI / 4, 0);
  // a switchback stair up the +x face (v1.17.1, rebuilt): three flights stacked one over the other, each running the
  // other way from the one below, with evenly spaced treads (rise and run to match) on a pair of stringers that slope
  // with them, a handrail at the same pitch, and a landing at every turn; the top landing steps onto the deck
  const FL = 3, PER = 10, rise = H / FL, sx = a + 0.75, Z = 1.75;
  for (let f = 0; f < FL; f++) {
    const dir = f % 2 ? -1 : 1, z0 = -Z * dir, z1 = Z * dir, y0 = f * rise, dz = z1 - z0;
    for (let j = 1; j <= PER; j++) { const t = j / (PER + 1); s.add(box(0.95, 0.07, 0.3), wood, sx, y0 + rise * t, z0 + dz * t); }
    const len = Math.hypot(dz, rise), ang = -Math.atan2(rise, dz); // (a box along z, tipped so its far end rises with the flight)
    for (const ox of [-0.5, 0.5]) s.add(box(0.07, 0.24, len + 0.2), woodD, sx + ox, y0 + rise / 2 - 0.12, (z0 + z1) / 2, ang, 0, 0);
    s.add(box(0.06, 0.06, len), rail, sx + 0.52, y0 + rise / 2 + 0.85, (z0 + z1) / 2, ang, 0, 0); // handrail on the outside
    for (const t of [0.15, 0.5, 0.85]) s.add(box(0.05, 0.85, 0.05), rail, sx + 0.52, y0 + rise * t + 0.42, z0 + dz * t); // its posts
    // the landing at the top of this flight
    s.add(box(1.05, 0.1, 0.8), wood, sx, y0 + rise, z1 + 0.35 * dir);
    s.add(box(0.12, y0 + rise, 0.12), woodD, sx + 0.5, (y0 + rise) / 2, z1 + 0.7 * dir); // its post, to the ground
  }
  s.add(box(sx - a * 1.15 + 0.1, 0.1, 0.9), wood, (a * 1.15 + sx) / 2 - 0.05, H, Z * (FL % 2 ? 1 : -1) + 0.35 * (FL % 2 ? 1 : -1)); // the step across onto the deck
  for (let lz = -Z - 0.6; lz <= Z + 0.61; lz += 0.6) s.solid(sx, lz, 0.55); // (the stair is solid all along: you climb it with E)
  for (const [x, z] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6], [0, 1.2], [0, -1.2], [1.2, 0], [-1.2, 0]]) s.solid(x, z, 0.5); // (and you can't walk into the tower's middle)
  // a flag on the roof and a map board at the foot
  s.add(box(0.05, 1.2, 0.05), woodD, 0, H + 4.2, 0); s.add(box(0.6, 0.35, 0.02), wmat('#3a8a5a'), 0.3, H + 4.55, 0);
  s.add(box(1.4, 1, 0.1), wood, -3.2, 1.4, 1.5, 0, 0.6, 0); s.add(box(0.1, 1.4, 0.1), woodD, -3.6, 0.7, 1.2); s.add(box(0.1, 1.4, 0.1), woodD, -2.8, 0.7, 1.8);
  s.solid(-3.2, 1.5, 0.5);
  // the deck you walk on (a walkway: walkY returns it inside the cab) and a rail that keeps you on it
  addWalkway({ cx: T.x, cz: T.z, ux: Math.cos(0.4), uz: -Math.sin(0.4), half: a * 1.1, w: a * 2.2, y: s.y + H + 0.11, active: () => !!T.up }); // (v1.17.1: only once you've climbed: walking underneath no longer lifts you onto the deck)
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
  // v1.17.1: the crashed plane is a real bush plane now: Skye's Snow Goose model (the one you fly north in), in a
  // faded old yellow, nose down in the ferns with a bent prop, moss on the wings, a crate and a wheel thrown clear
  const T = WOODS.plane, s = new Site('plane', T.x, T.z, 0.9);
  const moss = wmat('#5f7d3c'), dark = wmat('#3a3a3e');
  s.add(box(0.8, 0.6, 0.6), wmat('#8a6a40'), -1.8, 0.3, -3.2, 0, 0.5, 0);
  s.add(box(0.6, 0.45, 0.5), wmat('#7a5a34'), -2.6, 0.22, -2.4, 0.1, 1.2, 0);
  s.add(cyl(0.3, 0.3, 0.2, 10), dark, 4.2, 0.3, -2.5, Math.PI / 2, 0, 0.3); // a wheel that came off
  for (let i = 0; i < 5; i++) s.add(box(0.5 + jit(i) * 0.6, 0.04, 0.3 + jit(i, 2) * 0.3), moss, -3 + jit(i, 3) * 6, 0.05, 2.5 + jit(i, 4) * 2, 0, jit(i, 5) * 3, 0); // (torn panels in the ferns)
  s.solid(-1.8, -3.2, 0.5); s.solid(-2.6, -2.4, 0.4);
  T.y = s.y;
  const goose = new SnowGoose(), g = goose.group;
  const recolor = { sg_red: '#b8892e', sg_cream: '#cfc4a4', sg_alu: '#7a7c7a', sg_glass: '#3a4a4a', sg_lamp: '#6a6458', sg_nav_red: '#5a2a24', sg_nav_green: '#2a4a2a' };
  g.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.transparent) { o.visible = false; return; } // (no lettering, no prop disc)
    const n = SNOWGOOSE_MATS[o.material.userData.matIndex]?.name, c = recolor[n];
    if (c) { o.material = o.material.clone(); o.material.color.set(c); if (o.material.emissive) o.material.emissive.set('#000000'); }
  });
  goose.prop.rotation.set(0.5, 0, 0.9); // (bent)
  goose.ailL.rotation.x = 0.4; goose.rud.rotation.y = -0.35; goose.elev.rotation.x = -0.25;
  g.rotation.order = 'YXZ'; g.rotation.set(0.14, 0.9 + Math.PI / 2, -0.16);
  g.position.set(T.x, s.y - 0.55, T.z);
  g.updateMatrixWorld(true);
  // moss and leaves settled on the wings and the cowl
  const mossM = new THREE.MeshLambertMaterial({ color: '#5f7d3c' });
  for (const [x, y, z, w, d] of [[-3.5, 3.86, 0.3, 1.6, 0.9], [4.2, 3.86, 0.1, 1.2, 0.8], [0.8, 3.86, 0.4, 0.9, 0.6], [0, 2.95, 2.6, 0.6, 0.5]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), mossM); m.position.set(x, y, z); g.add(m); }
  // solid: along the fuselage and the floats (the high wing is over your head)
  const v = new THREE.Vector3();
  for (let lz = -5; lz <= 3.4; lz += 1.2) { v.set(0, 1.5, lz); g.localToWorld(v); addCircle(v.x, v.z, lz > -2 ? 0.95 : 0.6); }
  for (const lx of [-1.5, 1.5]) for (let lz = -2.5; lz <= 3; lz += 1.4) { v.set(lx, 0.3, lz); g.localToWorld(v); addCircle(v.x, v.z, 0.45); }
  return [s.bake(), g];
}

// v1.17.1: Old Hollis's treehouse, rebuilt (twice): a broad old oak on roots that run into the ground, real limbs and
// a layered crown; a deck that wraps round the trunk on six braced posts, with a railing; a free-standing board-and-
// batten hut at the deck's east end (clear of the trunk) with a shingled gable roof, a door, shuttered windows and a
// stovepipe; and a ladder whose rails and rungs follow one straight line from the ground up to a gap in the railing.
// Hollis's bench and tea table sit at the foot, clear of the posts. Local frame: the trunk at the origin, +z the front.
export const HOLLIS_YAW = 0.3;
const HOLLIS_SEAT = { lx: -4.0, lz: 3.3, h: 0.46 }; // (his bench: he sits facing +z, his table in front of him)
/** Where Old Hollis sits: world x, z, the seat height and the way he faces. */
export function hollisSeat() {
  const T = WOODS.hollis, c = Math.cos(HOLLIS_YAW), sn = Math.sin(HOLLIS_YAW);
  return { x: T.x + HOLLIS_SEAT.lx * c + HOLLIS_SEAT.lz * sn, z: T.z - HOLLIS_SEAT.lx * sn + HOLLIS_SEAT.lz * c, h: HOLLIS_SEAT.h, yaw: HOLLIS_YAW };
}
function treehouse() {
  const T = WOODS.hollis, s = new Site('hollis', T.x, T.z, HOLLIS_YAW);
  const bark = wmat('#5e4632'), barkD = wmat('#46331f'), barkL = wmat('#6e5640'), moss = wmat('#5a7a3a');
  const leaf = wmat('#4f7d3a'), leafD = wmat('#3e6a2e'), leafL = wmat('#6a9a48');
  const plank = wmat('#a07e54'), plankD = wmat('#7a5a3a'), plankL = wmat('#b8946a'), post = wmat('#5e4228');
  const shingle = wmat('#7a3a2a'), shingleD = wmat('#62301f'), iron = wmat('#3a3a3e'), cream = wmat('#efe6d2');
  const D = 4.8, TR = (y) => 1.35 - 0.35 * (y / 10.5); // deck height; the trunk's radius at height y
  // ---- the oak
  s.add(cyl(1.0, 1.35, 10.5, 14), bark, 0, 5.25, 0);
  for (let i = 0; i < 7; i++) { // roots: from the trunk's foot, sloping down and into the ground
    const a = (i / 7) * Math.PI * 2 + 0.3, len = 1.4 + jit(i, 2) * 0.9, c = Math.cos(a), sn = Math.sin(a);
    s.beam([c * 0.9, 0.55, sn * 0.9], [c * (1.3 + len), -0.25, sn * (1.3 + len)], i % 2 ? bark : barkD, { r0: 0.42, r1: 0.12 });
  }
  for (let i = 0; i < 5; i++) { const a = jit(i, 8) * Math.PI * 2, y = 1.2 + jit(i, 9) * 2.8; s.add(blob(0.16, 0), barkD, Math.cos(a) * TR(y), y, Math.sin(a) * TR(y)); } // knots (below the deck)
  for (let i = 0; i < 4; i++) { const a = 2.6 + i * 0.35, y = 0.7 + i * 0.4; s.add(box(0.45, 0.8 + jit(i) * 0.6, 0.08), moss, Math.cos(a) * (TR(y) + 0.02), y, Math.sin(a) * (TR(y) + 0.02), 0, Math.PI / 2 - a, 0); } // moss, flat on the north side
  const limbs = [[0.5, 8.6, 3.4], [1.8, 9.1, 3.1], [3.0, 8.4, 3.6], [4.3, 9.0, 3.2], [5.5, 9.6, 2.9]];
  limbs.forEach(([a, y, l], i) => {
    const c = Math.cos(a), sn = Math.sin(a), A = [c * 0.6, y, sn * 0.6], B = [c * l, y + l * 0.55, sn * l];
    s.beam(A, B, i % 2 ? bark : barkD, { r0: 0.4, r1: 0.18, over: 0.1 });
    for (const f of [-0.45, 0.45]) { const b = a + f; s.beam(B, [B[0] + Math.cos(b) * 1.3, B[2 - 1] + 0.9, B[2] + Math.sin(b) * 1.3], barkD, { r0: 0.16, r1: 0.07, seg: 6 }); }
  });
  const crown = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + jit(i, 4) * 0.4, r = 2.6 + jit(i, 5) * 1.6; crown.push([Math.cos(a) * r, 11.2 + jit(i, 6) * 1.6, Math.sin(a) * r, 1.7 + jit(i, 7) * 0.8]); }
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.4, r = 1.2 + jit(i, 11) * 1.2; crown.push([Math.cos(a) * r, 13.0 + jit(i, 12) * 1.2, Math.sin(a) * r, 1.9 + jit(i, 13) * 0.7]); }
  crown.push([0, 14.4, 0, 2.3]);
  crown.forEach(([x, y, z, r], i) => s.add(blob(r, 1), [leaf, leafD, leafL][i % 3], x, y, z, jit(i, 14), jit(i, 15) * 3, 0));
  // ---- the deck: round the trunk, which comes up through a square hole in the middle
  const X0 = -2.4, X1 = 5.6, Z0 = -2.6, Z1 = 2.6, HO = 1.35; // (HO: the hole's half size)
  const span = (x0, x1, f) => { if (x1 - x0 > 0.05) f(x0, x1); };
  for (const x of [X0 + 0.5, -1.4, 1.4, 2.6, 3.8, 5.0]) s.add(box(0.14, 0.24, Z1 - Z0), plankD, x, D - 0.2, 0); // joists (two frame the hole)
  for (const z of [-1.4, 1.4]) span(-1.4, 1.4, (a, b) => s.add(box(b - a, 0.24, 0.14), plankD, (a + b) / 2, D - 0.2, z)); // headers round the hole
  for (const z of [Z0, Z1]) s.add(box(X1 - X0 + 0.16, 0.28, 0.16), post, (X0 + X1) / 2, D - 0.16, z); // rim
  for (const x of [X0, X1]) s.add(box(0.16, 0.28, Z1 - Z0), post, x, D - 0.16, 0);
  for (let k = 0, z = Z0 + 0.15; z < Z1; z += 0.31, k++) {
    const m = k % 3 === 1 ? plankL : k % 2 ? plankD : plank;
    if (Math.abs(z) < HO) { span(X0, -HO, (a, b) => s.add(box(b - a, 0.07, 0.28), m, (a + b) / 2, D, z)); span(HO, X1, (a, b) => s.add(box(b - a, 0.07, 0.28), m, (a + b) / 2, D, z)); }
    else s.add(box(X1 - X0, 0.07, 0.28), m, (X0 + X1) / 2, D, z);
  }
  // six posts on footings, each with a knee brace up to the beam it carries
  const posts = [[X0, Z0], [1.6, Z0], [X1, Z0], [X0, Z1], [1.6, Z1], [X1, Z1]];
  for (const [x, z] of posts) {
    s.add(box(0.26, D - 0.3, 0.26), post, x, (D - 0.3) / 2, z);
    s.add(box(0.4, 0.14, 0.4), plankD, x, 0.04, z);
    s.solid(x, z, 0.28);
    const ix = x === X0 ? 1 : x === X1 ? -1 : 0, iz = z === Z0 ? 1 : -1;
    if (ix) s.beam([x + ix * 0.1, D - 1.4, z], [x + ix * 1.1, D - 0.32, z], plankD, { w: 0.12 }); // along the rim, in from the end
    s.beam([x, D - 1.4, z + iz * 0.1], [x, D - 0.32, z + iz * 1.0], plankD, { w: 0.12 }); // under the joist, in from the edge
  }
  // the railing, with a gap at the front for the ladder
  const LAD = { x0: -1.5, x1: -0.5 };
  const rail = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    s.add(box(0.1, 0.1, L + 0.1), plankL, mx, D + 1.0, mz, 0, ry, 0); s.add(box(0.06, 0.06, L), plankD, mx, D + 0.25, mz, 0, ry, 0);
    const n = Math.max(1, Math.round(L / 0.32));
    for (let i = 0; i <= n; i++) { const t = i / n; s.add(box(0.06, 0.78, 0.06), i % n === 0 ? post : plankD, ax + (bx - ax) * t, D + 0.62, az + (bz - az) * t); }
  };
  rail(X0, Z0, X1, Z0); rail(X0, Z0, X0, Z1); rail(X1, Z0, X1, Z1); rail(X0, Z1, LAD.x0, Z1); rail(LAD.x1, Z1, X1, Z1);
  // ---- the hut, at the deck's east end, a clear metre from the trunk
  const H = { x0: 2.5, x1: 5.3, z0: -2.35, z1: 0.35, h: 2.1 }, hx = (H.x0 + H.x1) / 2, hz = (H.z0 + H.z1) / 2, hw = H.x1 - H.x0, hd = H.z1 - H.z0, y0 = D + 0.04;
  const boards = (len, alongZ, at) => { for (let u = -len / 2 + 0.15; u < len / 2; u += 0.3) { const o = at(u); s.add(box(alongZ ? 0.07 : 0.29, H.h, alongZ ? 0.29 : 0.07), (Math.round(u * 10) % 3) ? plank : plankL, o[0], y0 + H.h / 2, o[1]); } };
  boards(hw, false, (u) => [hx + u, H.z0]); // back
  boards(hd, true, (u) => [H.x0, hz + u]); // west
  // east wall, with a window
  const WIN = { w: 0.7, h: 0.55 }, wy = y0 + 1.25;
  for (let u = -hd / 2 + 0.15; u < hd / 2; u += 0.3) {
    const z = hz + u;
    if (Math.abs(u) < WIN.w / 2) { const lo = wy - WIN.h / 2 - y0, hi = y0 + H.h - (wy + WIN.h / 2); s.add(box(0.07, lo, 0.29), plank, H.x1, y0 + lo / 2, z); s.add(box(0.07, hi, 0.29), plank, H.x1, wy + WIN.h / 2 + hi / 2, z); }
    else s.add(box(0.07, H.h, 0.29), plank, H.x1, y0 + H.h / 2, z);
  }
  s.add(box(0.1, WIN.h + 0.14, WIN.w + 0.14), post, H.x1 + 0.04, wy, hz); s.add(box(0.02, WIN.h, WIN.w), wmat('#2e3e46'), H.x1 - 0.02, wy, hz);
  { const p2 = nightWindows.pane(WIN.w - 0.04, WIN.h - 0.04); p2.position.set(H.x1 + 0.1, wy, hz); p2.rotation.y = Math.PI / 2; s.keep(p2); }
  // the front: the door on the left, a window on the right
  const DOOR = { x: 3.1, w: 0.8, h: 1.75 }, FW = { x: 4.55 };
  for (let x = H.x0 + 0.15; x < H.x1; x += 0.3) {
    if (Math.abs(x - DOOR.x) < DOOR.w / 2) { s.add(box(0.29, H.h - DOOR.h, 0.07), plank, x, y0 + DOOR.h + (H.h - DOOR.h) / 2, H.z1); continue; }
    if (Math.abs(x - FW.x) < WIN.w / 2) { const lo = wy - WIN.h / 2 - y0, hi = y0 + H.h - (wy + WIN.h / 2); s.add(box(0.29, lo, 0.07), plank, x, y0 + lo / 2, H.z1); s.add(box(0.29, hi, 0.07), plank, x, wy + WIN.h / 2 + hi / 2, H.z1); continue; }
    s.add(box(0.29, H.h, 0.07), x % 0.6 < 0.3 ? plank : plankL, x, y0 + H.h / 2, H.z1);
  }
  for (const [x, z] of [[H.x0, H.z0], [H.x1, H.z0], [H.x0, H.z1], [H.x1, H.z1]]) s.add(box(0.14, H.h, 0.14), post, x, y0 + H.h / 2, z);
  for (const sx of [-1, 1]) s.add(box(0.08, DOOR.h, 0.1), post, DOOR.x + sx * DOOR.w / 2, y0 + DOOR.h / 2, H.z1 + 0.03);
  s.add(box(DOOR.w + 0.16, 0.08, 0.1), post, DOOR.x, y0 + DOOR.h + 0.04, H.z1 + 0.03);
  const door = new THREE.Group(); door.position.set(DOOR.x - DOOR.w / 2, y0, H.z1 + 0.04); door.rotation.y = -0.55;
  for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(box(DOOR.w / 3 - 0.01, DOOR.h - 0.04, 0.05), k % 2 ? plankD : plank); m.position.set(DOOR.w / 6 + k * DOOR.w / 3, DOOR.h / 2, 0); door.add(m); }
  for (const y of [0.35, 1.35]) { const m = new THREE.Mesh(box(DOOR.w - 0.06, 0.1, 0.05), post); m.position.set(DOOR.w / 2, y, 0.05); door.add(m); }
  { const m = new THREE.Mesh(box(0.1, 0.05, 0.05), iron); m.position.set(DOOR.w - 0.12, 0.95, 0.08); door.add(m); }
  s.parts.add(door);
  // the front window: frame, cross bar, shutters, the glass and the night glow
  s.add(box(WIN.w + 0.14, 0.08, 0.1), post, FW.x, wy + WIN.h / 2 + 0.04, H.z1 + 0.02); s.add(box(WIN.w + 0.2, 0.08, 0.16), plankD, FW.x, wy - WIN.h / 2 - 0.04, H.z1 + 0.06);
  for (const sx of [-1, 1]) { s.add(box(0.08, WIN.h, 0.1), post, FW.x + sx * (WIN.w / 2 + 0.03), wy, H.z1 + 0.02); s.add(box(0.34, WIN.h + 0.06, 0.04), wmat('#4a6a52'), FW.x + sx * (WIN.w / 2 + 0.24), wy, H.z1 + 0.07); }
  s.add(box(WIN.w, 0.04, 0.05), post, FW.x, wy, H.z1 + 0.02); s.add(box(0.04, WIN.h, 0.05), post, FW.x, wy, H.z1 + 0.02);
  s.add(box(WIN.w, WIN.h, 0.02), wmat('#2e3e46'), FW.x, wy, H.z1 - 0.03);
  { const pane = nightWindows.pane(WIN.w - 0.04, WIN.h - 0.04); pane.position.set(FW.x, wy, H.z1 + 0.01); s.keep(pane); }
  // the roof: a gable along x (eaves front and back), shingled in rows from ridge to eave, with barge boards
  const pitch = 0.55, OV = 0.35, half = hd / 2 + OV, rise = Math.tan(pitch) * half, top = y0 + H.h, run = half / Math.cos(pitch), ROWS = 5;
  for (const sd of [-1, 1]) {
    for (let r = 0; r < ROWS; r++) {
      const t = (r + 0.5) / ROWS; // ridge (0) to eave (1)
      s.add(box(hw + 0.5, 0.08, run / ROWS + 0.12), r % 2 ? shingle : shingleD, hx, top + rise * (1 - t) + 0.04, hz + sd * half * t, sd * pitch, 0, 0);
    }
    for (const x of [H.x0 - 0.27, H.x1 + 0.27]) s.beam([x, top + rise + 0.02, hz], [x, top - 0.02, hz + sd * half], post, { w: 0.06, d: 0.18 });
  }
  s.add(box(hw + 0.6, 0.12, 0.22), shingleD, hx, top + rise + 0.06, hz);
  { // gable ends: boards up to the roof line exactly
    const re = rise * (1 - (hd / 2) / half);
    const sh = new THREE.Shape([new THREE.Vector2(-hd / 2, 0), new THREE.Vector2(hd / 2, 0), new THREE.Vector2(hd / 2, re), new THREE.Vector2(0, rise), new THREE.Vector2(-hd / 2, re)]);
    const tri = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false });
    for (const x of [H.x0 - 0.035, H.x1 - 0.035]) s.add(tri, plankL, x, top, hz, 0, Math.PI / 2, 0);
  }
  s.add(cyl(0.09, 0.09, 1.3, 8), iron, H.x1 - 0.6, top + rise * 0.5 + 0.4, hz - 0.6); s.add(cyl(0.16, 0.12, 0.12, 8), iron, H.x1 - 0.6, top + rise * 0.5 + 1.08, hz - 0.6); // stovepipe
  // ---- the ladder: rails and rungs on one straight line, from the ground to the deck's front rim
  const LX = (LAD.x0 + LAD.x1) / 2, ZT = Z1 + 0.14, ZF = ZT + 1.25, at = (y) => ZF + (ZT - ZF) * (y / D);
  for (const ox of [-0.32, 0.32]) s.beam([LX + ox, 0, ZF], [LX + ox, D + 0.9, at(D + 0.9)], post, { w: 0.09 });
  for (let y = 0.3; y < D; y += 0.32) s.add(box(0.6, 0.06, 0.07), plankD, LX, y, at(y));
  s.solid(LX, ZF - 0.2, 0.45); s.solid(LX, ZF - 0.75, 0.35);
  // ---- at the foot: Hollis's bench, his tea table, a stool for a guest; a lantern on the front-left post
  const B = HOLLIS_SEAT;
  s.add(box(1.5, 0.08, 0.46), plank, B.lx, B.h - 0.04, B.lz);
  for (const sx of [-0.62, 0.62]) for (const sz of [-0.17, 0.17]) s.add(box(0.08, B.h - 0.08, 0.08), plankD, B.lx + sx, (B.h - 0.08) / 2, B.lz + sz);
  for (const sx of [-0.62, 0.62]) s.add(box(0.08, 0.6, 0.08), plankD, B.lx + sx, B.h + 0.3, B.lz - 0.21);
  s.add(box(1.5, 0.12, 0.05), plank, B.lx, B.h + 0.42, B.lz - 0.22); s.add(box(1.5, 0.08, 0.05), plank, B.lx, B.h + 0.18, B.lz - 0.22);
  s.solid(B.lx - 0.45, B.lz - 0.05, 0.34); s.solid(B.lx + 0.45, B.lz - 0.05, 0.34);
  const TB = { lx: B.lx, lz: B.lz + 0.95 };
  s.add(box(0.9, 0.06, 0.6), plank, TB.lx, 0.58, TB.lz); for (const sx of [-0.36, 0.36]) for (const sz of [-0.22, 0.22]) s.add(box(0.06, 0.55, 0.06), plankD, TB.lx + sx, 0.28, TB.lz + sz);
  s.add(cyl(0.11, 0.13, 0.16, 10), cream, TB.lx + 0.12, 0.69, TB.lz); s.add(cyl(0.035, 0.035, 0.1, 6), cream, TB.lx + 0.26, 0.71, TB.lz, 0, 0, -0.9); s.add(cyl(0.07, 0.03, 0.04, 8), cream, TB.lx + 0.12, 0.79, TB.lz);
  for (const [dx, dz] of [[-0.22, -0.1], [-0.2, 0.14]]) s.add(cyl(0.045, 0.04, 0.08, 8), wmat('#7a9a8a'), TB.lx + dx, 0.65, TB.lz + dz);
  s.add(box(0.14, 0.02, 0.1), wmat('#6aa04a'), TB.lx - 0.05, 0.62, TB.lz + 0.2);
  s.solid(TB.lx, TB.lz, 0.5);
  s.add(cyl(0.22, 0.25, 0.45, 9), barkL, TB.lx + 1.1, 0.22, TB.lz + 0.2); s.add(cyl(0.2, 0.2, 0.04, 9), barkD, TB.lx + 1.1, 0.46, TB.lz + 0.2); s.solid(TB.lx + 1.1, TB.lz + 0.2, 0.28);
  s.add(box(0.05, 0.05, 0.42), iron, X0, 3.1, Z1 + 0.34); s.add(box(0.03, 0.2, 0.03), iron, X0, 2.98, Z1 + 0.52);
  const lamp = new THREE.Mesh(box(0.22, 0.3, 0.22), wmat('#ffd27a', { emissive: '#c88a2a' })); lamp.position.set(X0, 2.72, Z1 + 0.52); s.keep(lamp); T.lamp = lamp;
  s.add(box(0.28, 0.05, 0.28), iron, X0, 2.9, Z1 + 0.52); s.add(box(0.28, 0.05, 0.28), iron, X0, 2.55, Z1 + 0.52);
  // a name board on the trunk
  s.add(box(1.0, 0.32, 0.06), plankL, 0, 1.7, TR(1.7) + 0.03); s.add(box(1.06, 0.04, 0.07), plankD, 0, 1.86, TR(1.7) + 0.03);
  // solids: the trunk and its roots
  s.solid(0, 0, 1.55);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; s.solid(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0.3, s.y + 0.4); }
  T.y = s.y;
  return s.bake();
}

function footbridge(B) {
  const yaw = Math.atan2(B.ux, B.uz) + Math.PI / 2; // across the creek
  // v1.17.1: sits down on its banks (the ends' planks just on the ground), not up on the higher bank's height
  const ends = [2.6, -2.6].map((d) => gy(B.x + B.uz * d, B.z - B.ux * d)), base = Math.max((ends[0] + ends[1]) / 2 - 0.12, WATER_Y + 0.05);
  const s = new Site(`bridge-${B.creek}`, B.x, B.z, yaw, base);
  const plank = wmat('#a07a4e'), plankD = wmat('#7a5a38');
  for (let i = 0; i < 11; i++) s.add(box(1.5, 0.1, 0.5), i % 2 ? plank : plankD, 0, 0.22 + Math.sin((i / 10) * Math.PI) * 0.25, -2.6 + i * 0.52);
  for (const x of [-0.72, 0.72]) { s.add(box(0.08, 0.08, 5.6), plankD, x, 0.85, 0); for (const z of [-2.6, 0, 2.6]) s.add(box(0.1, 0.7, 0.1), plankD, x, 0.55, z); }
  addWalkway({ cx: B.x, cz: B.z, ux: Math.sin(yaw), uz: Math.cos(yaw), half: 2.9, w: 1.3, y: base + 0.35 }); // (walk height: the deck's middle)
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
  { const [site, goose] = bushPlane(); put(site, WOODS.plane.x, WOODS.plane.z); put(goose, WOODS.plane.x, WOODS.plane.z); }
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
  if (Math.abs(x) > 230 || Math.abs(z) > 230) return false; // (the valley's woods only: not the islands or indoors)
  if (groundY(x, z) == null) return false;
  if (trailDist(x, z) < 5) return false;
  for (let a = 0; a < 8; a++) { const px = x + Math.cos(a * 0.785) * 4, pz = z + Math.sin(a * 0.785) * 4; if (isWater(px, pz) || groundY(px, pz) == null) return false; }
  for (const c of Object.values(CLEARINGS)) if (Math.hypot(x - c.x, z - c.z) < c.r + 6) return false;
  if (Math.hypot(x, z) < 70) return false; // not in Cozy Cove itself
  return !near?.(x, z);
}
