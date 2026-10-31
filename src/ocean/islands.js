// Open Waters: the three islands you can walk on. Built the first time you go to sea.
// - Palm Key: a long beach with palm groves, a little village of huts round a fire pit, canoes and nets, Kai's tiki
//   bar by the jetty, and the beach-games sand.
// - Turtle Atoll: a wide ring of dunes round a turquoise lagoon (wade in and swim), a motu in the middle with a
//   hammock, and the marine biologist's research tent. Sea turtles and eagle rays in the lagoon.
// - Smuggler's Rock: a path climbs from the jetty beach to the old lookout and its cannons; cliffs round the far side,
//   the rock arch over the grotto, and the crates the smugglers left behind.
// v1.15.6: the ground uses the valley's own painted ground (grass, sand, dirt paths, stone, the sea bed) with
// trodden paths between the places worth walking to; grass tufts, bushes, ferns and tropical plants on the grass;
// driftwood, shells, coconuts and tide pools on the beaches. Static props are merged per material so the islands
// cost a few dozen draw calls, not thousands.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ISLAND_MATS, ISLAND_NODES } from '../data/islandMesh.js';
import { ISLEPROP_MATS, ISLEPROP_NODES } from '../data/islePropsMesh.js';
import { buildNode } from './meshes.js';
import { ISLANDS, ISLAND_BY_ID, DOCKS, GROTTO, PADS, ATOLL, oceanSurfaceY, padAt, islandE } from './geo.js';
import { addCircle } from '../world/colliders.js';
import { mulberry32 } from '../core/rng.js';
import { Actor } from '../game/actor.js';
import { defaultAvatar } from '../data/avatarOptions.js';
import { applyCaustics } from '../world/caustics.js';
import { KIND } from '../world/smoothterrain.js';
import { tuftGeo, tuftMaterial, rockGeometry, branchGeometry, addWind } from '../world/groundcover.js';
import { natureBushes } from '../world/nature.js';
import { buildFerns } from '../world/ferns.js';
import { WIND } from '../world/props.js';
import { buildFire } from '../world/fire.js';

const WATER_Y = 0.85;
const NK = 8;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const slopeAt = (x, z) => Math.max(Math.abs(oceanSurfaceY(x + 0.5, z) - oceanSurfaceY(x - 0.5, z)), Math.abs(oceanSurfaceY(x, z + 0.5) - oceanSurfaceY(x, z - 0.5)));
const fbm = (x, z) => Math.sin(x * 0.37 + z * 0.21) * 0.5 + Math.sin(x * 0.11 - z * 0.29) * 0.35 + Math.sin(x * 1.3 + z * 0.9) * 0.15;

// ---------------------------------------------------------------- paths (shared with the islanders, who walk them)
/** A point on an island at normalised radius e along angle a (follows the wobbly outline). */
function ringPoint(I, a, e) {
  let lo = 0, hi = 2 * Math.max(I.r, I.rz);
  for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (islandE(I, I.x + Math.cos(a) * m, I.z + Math.sin(a) * m) < e) lo = m; else hi = m; }
  return { x: I.x + Math.cos(a) * lo, z: I.z + Math.sin(a) * lo };
}
const toward = (a, b, d) => { const l = Math.hypot(b.x - a.x, b.z - a.z) || 1; return { x: a.x + (b.x - a.x) / l * d, z: a.z + (b.z - a.z) / l * d }; };
const jettyFoot = (D, back = 2) => ({ x: D.x0 - D.ux * back, z: D.z0 - D.uz * back });
const off = (D, b, s) => ({ x: D.x0 - D.ux * b + D.side.x * s, z: D.z0 - D.uz * b + D.side.z * s }); // b: up the beach from the jetty foot; s: to the boat's side

/** Where things stand on each island (computed once from the shapes in geo.js). */
export const SITES = (() => {
  const P = ISLAND_BY_ID.palm, T = ISLAND_BY_ID.turtle, S = ISLAND_BY_ID.smuggler;
  const DP = DOCKS.palm, DT = DOCKS.turtle, DS = DOCKS.smuggler;
  const pad = (id) => PADS.find((p) => p.id === id);
  const tAng = Math.atan2(DT.uz, DT.ux), sAng = Math.atan2(DS.uz, DS.ux);
  const village = { x: P.x + 10, z: P.z + 6 };
  // v1.15.8: the village's huts and torches go in the gaps between its paths (they used to stand on them)
  const vEnds = [off(DP, 10, -3), pad('coconut'), pad('court'), { x: P.x - 6, z: P.z + 2 }];
  const vBear = vEnds.map((q) => Math.atan2(q.z - village.z, q.x - village.x));
  const gap = (a) => Math.min(...vBear.map((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))));
  const hutA = [];
  for (let k = 0; k < 4; k++) { let best = null; for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; const sc = Math.min(gap(a), ...hutA.map((h) => Math.abs(Math.atan2(Math.sin(a - h), Math.cos(a - h))) * 0.7)); if (!best || sc > best.sc) best = { a, sc }; } hutA.push(best.a); }
  return {
    palm: {
      tiki: off(DP, 7, 5),
      village, fire: { x: village.x, z: village.z },
      huts: hutA.map((a) => ({ x: village.x + Math.cos(a) * 8.5, z: village.z + Math.sin(a) * 8.5 })),
      torches: hutA.map((a) => ({ x: village.x + Math.cos(a + 0.32) * 5.6, z: village.z + Math.sin(a + 0.32) * 5.6 })),
      top: { x: P.x - 6, z: P.z + 2 },
      canoes: [ringPoint(P, Math.atan2(DP.uz, DP.ux) + 0.35, 0.93), ringPoint(P, Math.atan2(DP.uz, DP.ux) + 0.45, 0.94)],
      nets: ringPoint(P, Math.atan2(DP.uz, DP.ux) - 0.3, 0.9),
      paths: [
        [jettyFoot(DP), off(DP, 4.6, 3.2), off(DP, 5.0, 5)], // jetty to the bar's counter
        [jettyFoot(DP), off(DP, 6, 0.6), off(DP, 10, -3), village], // up to the village (round the games board)
        [village, { x: pad('coconut').x, z: pad('coconut').z }],
        [village, { x: pad('court').x, z: pad('court').z }],
        [village, { x: P.x - 6, z: P.z + 2 }, { x: pad('castles').x, z: pad('castles').z }],
        [{ x: P.x - 6, z: P.z + 2 }, { x: pad('crabs').x, z: pad('crabs').z }],
      ],
    },
    turtle: {
      tent: ringPoint(T, tAng + 0.5, 0.91), // (off the ring path, toward the sea)
      fire: ringPoint(T, tAng - 0.45, 0.8),
      motu: { x: T.x, z: T.z },
      ring: Array.from({ length: 48 }, (_, k) => ringPoint(T, tAng + (k / 48) * Math.PI * 2, 0.8)),
      paths: [[jettyFoot(DT), ringPoint(T, tAng, 0.8)], Array.from({ length: 49 }, (_, k) => ringPoint(T, tAng + (k / 48) * Math.PI * 2, 0.8))],
    },
    smuggler: {
      lookout: ringPoint(S, sAng + Math.PI * 0.95, 0.22),
      cliffTop: ringPoint(S, sAng + 1.9, 0.62),
      paths: [
        [jettyFoot(DS), ringPoint(S, sAng - 0.35, 0.72), ringPoint(S, sAng + 0.45, 0.55), ringPoint(S, sAng - 0.25, 0.4), ringPoint(S, sAng + 0.6, 0.27), toward(ringPoint(S, sAng + Math.PI * 0.95, 0.22), ringPoint(S, sAng + 0.6, 0.27), 3.0)], // switchbacks to the lookout's door
        [toward(ringPoint(S, sAng + Math.PI * 0.95, 0.22), ringPoint(S, sAng + 0.6, 0.27), 3.0), ringPoint(S, sAng + 1.9, 0.62)], // from the door out to the cliff top
        [jettyFoot(DS), off(DS, 2, 1.4)], // to the crates
      ],
    },
    // v1.15.19 Emberkey: one black-sand trail zigzagging up from the landing to the crater rim
    ember: (() => {
      const E = ISLAND_BY_ID.ember, DE = DOCKS.ember, eAng = Math.atan2(DE.uz, DE.ux);
      return { rim: ringPoint(E, eAng + 0.3, 0.2), paths: [[jettyFoot(DE), ringPoint(E, eAng - 0.3, 0.75), ringPoint(E, eAng + 0.35, 0.55), ringPoint(E, eAng - 0.25, 0.38), ringPoint(E, eAng + 0.3, 0.2)]] };
    })(),
  };
})();

function segDist(px, pz, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / L2));
  return Math.hypot(px - a.x - dx * t, pz - a.z - dz * t);
}
/** Distance to the nearest path on this island. */
export function pathDist(id, x, z) {
  let d = Infinity;
  for (const p of SITES[id].paths) for (let i = 1; i < p.length; i++) d = Math.min(d, segDist(x, z, p[i - 1], p[i]));
  return d;
}

// ---------------------------------------------------------------- the ground
function groundWeights(I, x, z, y, slope, w) {
  w.fill(0);
  const e = islandE(I, x, z), n = fbm(x, z);
  if (y < WATER_Y - 0.15) {
    // the sea bed: pale sand near the island, gravel at the foot of the cliffs
    w[KIND.bed] = 1;
    if (I.cliffs && slope > 0.5) { w[KIND.gravel] = 0.7; w[KIND.bed] = 0.3; }
    return;
  }
  if (I.volcano) { // v1.15.19 Emberkey: black sand and ash, scrubby green low down, bare rock up the cone
    const low = smooth(WATER_Y + 4, WATER_Y + 1.5, y) * smooth(WATER_Y + 0.8, WATER_Y + 1.4, y + n * 0.4) * 0.6;
    w[KIND.grass] = low; w[KIND.gravel] = (1 - low) * 0.65; w[KIND.stone] = (1 - low) * 0.35 + smooth(0.6, 1.0, slope) * 0.3;
    return;
  }
  let grass = 0;
  if (I.atoll) grass = e > ATOLL.in + 0.08 && e < 0.94 ? smooth(WATER_Y + 1.6, WATER_Y + 2.3, y + n * 0.5) * 0.55 : 0; // beach grass on the dune crest
  else grass = smooth(WATER_Y + 0.9, WATER_Y + 1.5, y + n * 0.35);
  if (padAt(x, z, 1)) grass = 0;
  w[KIND.grass] = grass; w[KIND.sand] = 1 - grass;
  // trodden paths: dirt through the grass, packed sand on the beach
  const pd = pathDist(I.id, x, z);
  if (pd < 1.6) {
    const k = smooth(1.6, 0.6, pd + n * 0.25);
    const into = grass > 0.3 ? KIND.dirt : KIND.gravel;
    for (let i = 0; i < NK; i++) w[i] *= 1 - k * 0.85;
    w[into] += k * (grass > 0.3 ? 0.85 : 0.35); w[KIND.sand] += grass > 0.3 ? 0 : k * 0.5;
  }
  // rock where it's steep (and the cliffs)
  const rock = (I.cliffs ? smooth(0.6, 1.0, slope) : smooth(0.8, 1.15, slope)) + (I.cliffs ? smooth(WATER_Y + 7, WATER_Y + 10, y) * 0.4 * smooth(0.25, 0.5, slope) : 0);
  if (rock > 0) { for (let i = 0; i < NK; i++) w[i] *= 1 - Math.min(1, rock); w[KIND.stone] += Math.min(1, rock); }
}

function islandGround(I, mat) {
  // v1.15.8: the ground runs on out under deep water (well past where you can see underwater), so a diver never
  // sees its edge; it used to stop 8 m down in a ragged line. Coarser out on the shelf, where it's deep.
  const R = Math.max(I.r, I.rz) + I.shelf * 0.9, S = 0.8, N = Math.ceil((R * 2) / S) + 1;
  const ys = new Float32Array(N * N), keep = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const y = oceanSurfaceY(I.x - R + i * S, I.z - R + j * S); ys[i * N + j] = y; keep[i * N + j] = 1; }
  const group = new THREE.Group();
  group.name = `island-${I.id}`;
  const w = new Float32Array(NK);
  const CH = 40;
  for (let ci = 0; ci < N - 1; ci += CH) for (let cj = 0; cj < N - 1; cj += CH) {
    const i1 = Math.min(N - 1, ci + CH), j1 = Math.min(N - 1, cj + CH), W = i1 - ci + 1, D = j1 - cj + 1;
    let any = false;
    for (let i = ci; i <= i1 && !any; i++) for (let j = cj; j <= j1; j++) if (keep[i * N + j]) { any = true; break; }
    if (!any) continue;
    const pos = new Float32Array(W * D * 3), nor = new Float32Array(W * D * 3), col = new Float32Array(W * D * 3), w0 = new Float32Array(W * D * 4), w1 = new Float32Array(W * D * 4);
    let v = 0;
    for (let i = ci; i <= i1; i++) for (let j = cj; j <= j1; j++, v++) {
      const x = I.x - R + i * S, z = I.z - R + j * S, y = ys[i * N + j];
      const at = (a, b) => ys[Math.max(0, Math.min(N - 1, a)) * N + Math.max(0, Math.min(N - 1, b))];
      const hx = (at(i + 1, j) - at(i - 1, j)) / (2 * S), hz = (at(i, j + 1) - at(i, j - 1)) / (2 * S), l = Math.hypot(hx, 1, hz);
      pos.set([x, y, z], v * 3); nor.set([-hx / l, 1 / l, -hz / l], v * 3);
      groundWeights(I, x, z, y, Math.max(Math.abs(hx), Math.abs(hz)), w);
      for (let k = 0; k < 4; k++) { w0[v * 4 + k] = w[k]; w1[v * 4 + k] = w[k + 4]; }
      // tint: wet sand at the water's edge, darker hollows, soft drifts
      let t = 0.93 + fbm(x * 0.7 + 3, z * 0.7 - 9) * 0.05;
      t *= 1 + w[KIND.sand] * 0.14 + w[KIND.bed] * 0.1; // bright coral sand
      if (I.volcano && y > WATER_Y - 3) t *= 0.42 + smooth(WATER_Y + 8, WATER_Y + 20, y) * 0.18; // black sand and ash
      if (y > WATER_Y - 0.15 && y < WATER_Y + 0.4) t *= 0.8 + smooth(WATER_Y, WATER_Y + 0.4, y) * 0.2;
      const cav = (at(i + 2, j) + at(i - 2, j) + at(i, j + 2) + at(i, j - 2)) / 4 - y;
      t *= 1 - Math.max(0, Math.min(0.15, cav * 0.25));
      col.set([t, t, t], v * 3);
    }
    const idx = [];
    for (let a = 0; a < W - 1; a++) for (let b = 0; b < D - 1; b++) {
      const gi = ci + a, gj = cj + b;
      if (!(keep[gi * N + gj] || keep[(gi + 1) * N + gj] || keep[gi * N + gj + 1] || keep[(gi + 1) * N + gj + 1])) continue;
      const p00 = a * D + b, p10 = (a + 1) * D + b, p01 = a * D + b + 1, p11 = (a + 1) * D + b + 1;
      idx.push(p00, p01, p10, p10, p01, p11);
    }
    if (!idx.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aW0', new THREE.BufferAttribute(w0, 4));
    g.setAttribute('aW1', new THREE.BufferAttribute(w1, 4));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.name = 'island-ground';
    group.add(m);
  }
  return group;
}

// ---------------------------------------------------------------- merging static props
class Batch {
  constructor() { this.buckets = new Map(); this.cache = new Map(); }
  /** Add the named node (from MATS/NODES) at a transform. */
  add(MATS, NODES, name, x, y, z, yaw = 0, s = 1, tilt = 0) {
    const key = `${NODES === ISLAND_NODES ? 'i' : 'p'}:${name}`;
    let proto = this.cache.get(key);
    if (!proto) { proto = buildNode(MATS, NODES, name); this.cache.set(key, proto); }
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ')), new THREE.Vector3(s, s, s));
    for (const mesh of proto.children) {
      const g = new THREE.BufferGeometry();
      const src = mesh.geometry;
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(src.attributes.position.array), 3));
      if (src.attributes.normal) { const a = src.attributes.normal, f = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); } g.setAttribute('normal', new THREE.BufferAttribute(f, 3)); }
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(src.index.array), 1));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(m);
      let b = this.buckets.get(mesh.material);
      if (!b) this.buckets.set(mesh.material, (b = []));
      b.push(g);
    }
  }
  /** One mesh per material. */
  build(name) {
    const out = new THREE.Group();
    out.name = name;
    for (const [mat, geos] of this.buckets) {
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      out.add(mesh);
    }
    return out;
  }
}

const KAI_LOOK = { ...defaultAvatar('male'), skin: 6, height: 'medium', frame: 'broad', hair: 'messy', hairColor: 0, facialHair: 'none', mouth: 'grin', eyes: 'happy', hat: 'none', shirt: 'hawaiian', shirtColor: 7, pants: 'shorts', pantsColor: 8, shoes: 'sandals', accessory: 'lei' };

export class Islands {
  constructor(scene, game) {
    this.scene = scene; this.game = game;
    this.built = false;
    this.turtles = [];
    this.kai = null;
    this.halos = [];
    this.fires = []; // v1.15.10: the island fire pits (cookouts, the fireside drum): { x, z, y, island, flame }
    this.hutDoors = []; // where you can turn in for the night: { x, z, yaw, island }
    this.drum = null; // the fireside player's spot on Palm Key
  }
  /** Is (x, z) free for a new thing of radius r? (paths, pads, the jetty foot, the grotto and everything placed) */
  free(I, x, z, r, { path = 1.3 } = {}) {
    if (pathDist(I.id, x, z) < path + r) return false;
    if (padAt(x, z, 3 + r)) return false;
    const D = DOCKS[I.id];
    if (Math.hypot(x - D.x0, z - D.z0) < 5 + r) return false;
    if (Math.hypot(x - GROTTO.lagoon.x, z - GROTTO.lagoon.z) < 14) return false;
    for (const o of this.taken) if (Math.hypot(x - o.x, z - o.z) < o.r + r) return false;
    return true;
  }
  take(x, z, r) { this.taken.push({ x, z, r }); }
  /** v1.15.10: a fire pit's evening: real flames, log benches round it (seats for a cookout), and on Palm Key a drum
   *  for the fireside player. Benches go where the paths and everything placed leave room. */
  fireCircle(I, F, prop, drum) {
    const yAt = (x, z) => Math.max(WATER_Y - 0.4, oceanSurfaceY(x, z));
    const fy = yAt(F.x, F.z);
    const flame = buildFire(new THREE.Vector3(F.x, fy + 0.05, F.z));
    flame.scale.setScalar(0.75);
    this.root.add(flame);
    const fire = { x: F.x, z: F.z, y: fy, island: I.id, flame };
    this.fires.push(fire);
    const ok = (x, z, r) => pathDist(I.id, x, z) > 0.55 + r && oceanSurfaceY(x, z) > WATER_Y + 0.3 && this.taken.every((o) => (Math.hypot(o.x - F.x, o.z - F.z) < 0.5) || Math.hypot(x - o.x, z - o.z) > o.r + r);
    const got = [];
    for (let k = 0; k < 24 && got.length < (drum ? 4 : 3); k++) {
      const a = (k * 7 % 24) / 24 * Math.PI * 2, R = 3.0;
      const x = F.x + Math.cos(a) * R, z = F.z + Math.sin(a) * R;
      if (!ok(x, z, 0.65) || got.some((b) => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) < 0.75)) continue;
      got.push(a);
      if (drum && got.length === 1) { // the first free place is the drummer's: the drum, and him behind it
        const dx = F.x + Math.cos(a) * 2.5, dz = F.z + Math.sin(a) * 2.5, px = F.x + Math.cos(a) * 3.2, pz = F.z + Math.sin(a) * 3.2;
        prop('isle_drum', dx, dz, a, 1, null, 0.2);
        this.drum = { x: dx, z: dz, at: { x: px, z: pz }, yaw: Math.atan2(F.x - px, F.z - pz), fire };
        this.take(dx, dz, 1.2);
        continue;
      }
      prop('isle_logbench', x, z, -a - Math.PI / 2);
      this.take(x, z, 1.0);
      const tx = -Math.sin(a), tz = Math.cos(a), y = yAt(x, z);
      for (const s of [-0.45, 0.45]) {
        const sx = x + tx * s, sz = z + tz * s;
        addCircle(sx, sz, 0.2);
        this.game.chairs?.list.push({ id: `isle-${I.id}-${got.length}-${s}`, x: sx, z: sz, y, h: 0.42, kind: 'log', yaw: Math.atan2(F.x - sx, F.z - sz), isle: true });
      }
    }
  }
  build() {
    if (this.built) return;
    this.built = true;
    const root = new THREE.Group();
    root.name = 'islands';
    this.root = root;
    this.scene.add(root);
    this.taken = [];
    // the valley's painted ground (grass, sand, dirt, stone, the lake bed), so the islands match the main map
    let mat = this.scene.getObjectByName('terrain')?.material;
    if (!mat?.userData?.splat) { mat = new THREE.MeshLambertMaterial({ vertexColors: true }); applyCaustics(mat); }
    for (const I of ISLANDS) root.add(islandGround(I, mat));
    const B = new Batch();
    const yAt = (x, z) => Math.max(WATER_Y - 0.4, oceanSurfaceY(x, z));
    const put = (name, x, z, yaw = 0, s = 1, y = null, collide = 0) => { B.add(ISLAND_MATS, ISLAND_NODES, name, x, y ?? yAt(x, z), z, yaw, s); if (collide) addCircle(x, z, collide * s); };
    const prop = (name, x, z, yaw = 0, s = 1, y = null, collide = 0, tilt = 0) => { B.add(ISLEPROP_MATS, ISLEPROP_NODES, name, x, y ?? yAt(x, z) - 0.02, z, yaw, s, tilt); if (collide) addCircle(x, z, collide * s); };
    const live = (name, x, z, yaw = 0, s = 1, y = null) => { const m = buildNode(ISLAND_MATS, ISLAND_NODES, name); m.position.set(x, y ?? yAt(x, z), z); m.rotation.y = yaw; m.scale.setScalar(s); root.add(m); return m; };
    // jetties: two sections end to end
    for (const D of Object.values(DOCKS)) if (!D.platform) for (const k of [0, 1]) put('isle_jetty', D.x0 + D.ux * 9 * k, D.z0 + D.uz * 9 * k, Math.atan2(D.ux, D.uz), 1, D.y); // (Channel Light builds its own: deepblue.js)
    this.buildPalm(put, prop);
    this.buildTurtle(put, prop);
    this.buildSmuggler(put, prop);
    for (const I of ISLANDS) this.dress(I, put, prop);
    root.add(B.build('island-props'));
    this.buildPlants(root);
    // animated: sea turtles and eagle rays in Turtle Atoll's lagoon (between the motu and the lagoon beach)
    const T = ISLAND_BY_ID.turtle, ringR = T.r * (ATOLL.motu + 0.08) + 1, outR = T.r * ATOLL.deep * 0.85;
    for (let i = 0; i < 5; i++) {
      const m = live('isle_turtle', T.x, T.z, 0, 1.1, WATER_Y - 0.3);
      this.turtles.push({ m, a: i * 1.3, R: ringR + ((outR - ringR) * i) / 4, w: 0.05 + i * 0.012, dive: i * 2.1 });
    }
    this.rays = [];
    for (let i = 0; i < 3; i++) {
      const m = live('isle_ray', T.x, T.z, 0, 1.3 + i * 0.2, WATER_Y - 0.9);
      this.rays.push({ m, a: i * 2.1 + 0.5, R: ringR + 0.5 + i * ((outR - ringR) / 3), w: -(0.07 + i * 0.015), ph: i * 1.7 });
    }
    // Kai behind the bar
    const K = this.tiki.kai, actor = new Actor(this.scene);
    actor.setLook(KAI_LOOK, { rod: 'rod_bamboo', lure: 'lure_classic', boat: 'boat_oak' });
    this.kai = { name: 'Kai', actor, pos: new THREE.Vector3(K.x, K.y, K.z), yaw: this.tiki.yaw, wait: 0 };
  }

  // ---- Palm Key: the bar, the village, the beach
  buildPalm(put, prop) {
    const D = DOCKS.palm, S = SITES.palm, yaw = Math.atan2(D.ux, D.uz);
    const t = S.tiki;
    const ty = Math.max(WATER_Y - 0.4, oceanSurfaceY(t.x, t.z));
    put('isle_tiki', t.x, t.z, yaw, 1, ty); this.take(t.x, t.z, 4.5);
    // v1.15.8: solid where the bar is (the posts, the counter, the back shelves and the sides), open in front for customers
    const at = (lx, lz) => ({ x: t.x + D.ux * lz + D.uz * lx, z: t.z + D.uz * lz - D.ux * lx }); // local (x across, z out the front)
    for (const [lx, lz, r] of [[-2.1, 1.5, 0.25], [2.1, 1.5, 0.25], [-2.1, -1.4, 0.2], [2.1, -1.4, 0.2], [-2.8, 1.9, 0.12], [2.8, 1.9, 0.12]]) { const q = at(lx, lz); addCircle(q.x, q.z, r); }
    for (let lx = -1.6; lx <= 1.61; lx += 0.8) { const q = at(lx, 1.12); addCircle(q.x, q.z, 0.42); const b = at(lx, -1.3); addCircle(b.x, b.z, 0.32); }
    for (const sx of [-2.1, 2.1]) for (let lz = -0.9; lz <= 1.0; lz += 0.6) { const q = at(sx, lz); addCircle(q.x, q.z, 0.3); }
    const kai = at(0, 0.35), sign = at(0, 1.7);
    this.tiki = { x: t.x, z: t.z, yaw, counter: at(0, 1.95), kai: { ...kai, y: ty + 0.26 } }; // Kai stands on his step behind the counter
    this.barSign(sign.x, ty + 2.05, sign.z, yaw);
    for (const s of [-1, 1]) { const x = t.x + D.ux * 3.2 + D.side.x * s * 3.6, z = t.z + D.uz * 3.2 + D.side.z * s * 3.6; prop('isle_torch', x, z, 0, 1, null, 0.12); this.halo(x, z, 2.33); }
    // the village: four huts facing the fire pit, torches between them
    const V = S.village;
    prop('isle_firepit', V.x, V.z, 0.3); this.take(V.x, V.z, 2.4); this.halo(V.x, V.z, 0.6, 3.2, '#ff7a30');
    S.huts.forEach((hpos, k) => { const a = Math.atan2(V.x - hpos.x, V.z - hpos.z); put('isle_hut', hpos.x, hpos.z, a, 1, null, 2.2); this.take(hpos.x, hpos.z, 3.4);
      this.hutDoors.push({ x: hpos.x + Math.sin(a) * 2.9, z: hpos.z + Math.cos(a) * 2.9, yaw: a, island: 'palm' }); });
    this.fireCircle(ISLAND_BY_ID.palm, V, prop, true);
    for (const q of S.torches) { prop('isle_torch', q.x, q.z, 0, 1, null, 0.12); this.halo(q.x, q.z, 2.33); this.take(q.x, q.z, 0.6); }
    // the beach: loungers, umbrellas and towels in a row; canoes pulled up; a net rack; a signpost at the jetty
    const back = { x: -D.ux, z: -D.uz }, side = D.side;
    for (let k = 0; k < 5; k++) {
      const x = D.x0 + back.x * 3 - side.x * (7 + k * 3.4), z = D.z0 + back.z * 3 - side.z * (7 + k * 3.4);
      if (!this.free(ISLAND_BY_ID.palm, x, z, 1, { path: 0.6 })) continue;
      if (k === 2) prop('isle_towel', x, z, yaw + 0.2);
      else { put('isle_lounger', x, z, yaw); for (const o of [-0.75, 0, 0.75]) addCircle(x + D.ux * o, z + D.uz * o, 0.36); } // (solid along its length)
      if (k % 2 === 0) put('isle_umbrella', x + side.x * 1.4, z + side.z * 1.4, k * 0.7, 1, null, 0.22);
      this.take(x, z, 1.6);
    }
    for (const [i, c] of S.canoes.entries()) { const a = Math.atan2(c.x - ISLAND_BY_ID.palm.x, c.z - ISLAND_BY_ID.palm.z) + Math.PI / 2 + i * 0.3; prop('isle_canoe', c.x, c.z, a, 1, null, 0); addCircle(c.x, c.z, 1.0); this.take(c.x, c.z, 2.6); }
    prop('isle_netrack', S.nets.x, S.nets.z, Math.atan2(S.nets.x - ISLAND_BY_ID.palm.x, S.nets.z - ISLAND_BY_ID.palm.z)); this.take(S.nets.x, S.nets.z, 2);
    const sp = off(D, 3.5, 3.2); // (v1.17.2: across the path from the Beach Games board, not in front of it)
    prop('isle_signpost', sp.x, sp.z, yaw + 2.6, 1, null, 0.12); this.take(sp.x, sp.z, 0.6);
  }

  // ---- Turtle Atoll: the research tent, the motu with its hammock, a fire on the dunes
  buildTurtle(put, prop) {
    const I = ISLAND_BY_ID.turtle, S = SITES.turtle, D = DOCKS.turtle;
    const tn = S.tent, ta = Math.atan2(I.x - tn.x, I.z - tn.z);
    prop('isle_tent', tn.x, tn.z, ta, 1, null, 1.4); this.take(tn.x, tn.z, 3.6); this.tent = { x: tn.x, z: tn.z, yaw: ta };
    prop('isle_torch', tn.x + Math.cos(ta) * 2.4, tn.z - Math.sin(ta) * 2.4, 0, 1, null, 0.12); this.halo(tn.x + Math.cos(ta) * 2.4, tn.z - Math.sin(ta) * 2.4, 2.33);
    prop('isle_firepit', S.fire.x, S.fire.z, 1.1); this.take(S.fire.x, S.fire.z, 2.4); this.halo(S.fire.x, S.fire.z, 0.6, 3.2, '#ff7a30');
    this.fireCircle(I, S.fire, prop, false);
    // the motu: three palms, a hammock between them, coconuts
    const M = S.motu;
    put('isle_palm_b', M.x - 1.8, M.z + 0.6, 0.4, 0.9, null, 0.3); put('isle_palm_a', M.x + 1.9, M.z - 0.4, 2.6, 0.85, null, 0.3); put('isle_palm_c', M.x + 0.2, M.z + 2.2, 4.1, 0.7, null, 0.3);
    prop('isle_hammock', M.x, M.z - 0.5, 0); addCircle(M.x - 1.7, M.z - 0.5, 0.1); addCircle(M.x + 1.7, M.z - 0.5, 0.1);
    prop('isle_coconuts', M.x + 0.8, M.z + 1.2, 0.5);
    this.take(M.x, M.z, 4);
    const c = off(D, 3, 3.2); prop('isle_canoe', c.x, c.z, Math.atan2(D.ux, D.uz) + 0.4); addCircle(c.x, c.z, 1); this.take(c.x, c.z, 2.6);
    const sp = off(D, 3.5, -2.2); prop('isle_signpost', sp.x, sp.z, Math.atan2(D.ux, D.uz) + 2.6, 1, null, 0.12); this.take(sp.x, sp.z, 0.6);
  }

  // ---- Smuggler's Rock: the lookout and cannons up top, a rope fence on the cliff, the arch and the grotto
  buildSmuggler(put, prop) {
    const I = ISLAND_BY_ID.smuggler, S = SITES.smuggler, D = DOCKS.smuggler, yaw = Math.atan2(D.ux, D.uz);
    put('isle_crates', D.x0 - D.ux * 2 + D.side.x * 3, D.z0 - D.uz * 2 + D.side.z * 3, yaw, 1, null, 1.2); this.take(D.x0 - D.ux * 2 + D.side.x * 3, D.z0 - D.uz * 2 + D.side.z * 3, 2);
    put('isle_chest', D.x0 - D.ux * 1.5 - D.side.x * 2.5, D.z0 - D.uz * 1.5 - D.side.z * 2.5, yaw + 0.4, 1, null, 0.5); this.take(D.x0 - D.ux * 1.5 - D.side.x * 2.5, D.z0 - D.uz * 1.5 - D.side.z * 2.5, 1);
    const L = S.lookout, door = S.paths[0][S.paths[0].length - 1], la = Math.atan2(-(door.x - L.x), -(door.z - L.z)); // (the doorway faces the path up)
    prop('isle_lookout', L.x, L.z, la); this.take(L.x, L.z, 3.4); this.lookout = { x: L.x, z: L.z, yaw: la };
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; const lx = Math.cos(a) * 1.8, lz = Math.sin(a) * 1.8; if (a > 4.3 && a < 5.2) continue; const c = Math.cos(la), s = Math.sin(la); addCircle(L.x + lx * c + lz * s, L.z - lx * s + lz * c, 0.32); } // (the doorway stays open)
    // two cannons on the cliff top, aimed out to sea, and a rope fence along the edge
    const ca = Math.atan2(S.cliffTop.x - I.x, S.cliffTop.z - I.z);
    for (const s of [-1, 1]) { const x = S.cliffTop.x + Math.cos(ca) * 3.5 * s, z = S.cliffTop.z - Math.sin(ca) * 3.5 * s; prop('isle_cannon', x, z, ca, 1.1, null, 0.6); this.take(x, z, 1.4); }
    for (let k = -3; k <= 3; k++) {
      const a = Math.atan2(S.cliffTop.z - I.z, S.cliffTop.x - I.x) + k * 0.085;
      const p = ringPoint(I, a, 0.86);
      prop('isle_fence', p.x, p.z, Math.atan2(p.x - I.x, p.z - I.z) + Math.PI / 2); addCircle(p.x, p.z, 0.15); this.take(p.x, p.z, 1);
    }
    const sp = off(D, 3.5, -2.2); prop('isle_signpost', sp.x, sp.z, yaw + 2.6, 1, null, 0.12); this.take(sp.x, sp.z, 0.6);
    // path stones up the switchbacks
    for (const p of S.paths[0].slice(1)) prop('isle_stepstone', p.x, p.z, p.x * 0.3);
    // the arch over the grotto's channel, the roof and the smugglers' lanterns
    const a = Math.atan2(D.uz, D.ux) + 1.1;
    const cx = I.x + Math.cos(a) * I.r * 1.02, cz = I.z + Math.sin(a) * I.rz * 1.02;
    put('isle_arch', cx, cz, Math.atan2(Math.cos(a), Math.sin(a)), 1.4, WATER_Y - 1.2);
    this.cave = { x: cx, z: cz };
    const GL = GROTTO.lagoon, GB = GROTTO.beach;
    const roof = buildNode(ISLAND_MATS, ISLAND_NODES, 'isle_grotto');
    roof.position.set((GL.x + GB.x) / 2, WATER_Y + 4.4, (GL.z + GB.z) / 2); roof.rotation.y = GROTTO.yaw;
    roof.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; } });
    this.root.add(roof);
    for (const s of [-1, 1]) { const x = GB.x + GROTTO.u.z * 2.2 * s - GROTTO.u.x * 1.2, z = GB.z - GROTTO.u.x * 2.2 * s - GROTTO.u.z * 1.2; put('isle_lantern', x, z, 0, 1, 1.4); this.halo(x, z, 1.4 + 1.38, 1.2); }
  }

  // ---- every island: palms, rocks, driftwood, shells, coconuts, tide pools, flowering shrubs
  dress(I, put, prop) {
    const r = mulberry32(I.seed * 101 + 7);
    const nPalm = I.id === 'palm' ? 70 : I.id === 'turtle' ? 46 : I.id === 'ember' ? 8 : 18; // (a few palms on Emberkey's lower slopes)
    // palms in groves: pick grove centres, then palms round them, leaning out to sea
    for (let n = 0, tries = 0; n < nPalm && tries < 3000; tries++) {
      const a = r() * Math.PI * 2, e = I.atoll ? ATOLL.in + 0.08 + r() * 0.3 : I.cliffs ? 0.55 + r() * 0.35 : 0.3 + r() * 0.62;
      const x = I.x + Math.cos(a) * I.r * e, z = I.z + Math.sin(a) * I.rz * e, y = oceanSurfaceY(x, z);
      if (y < WATER_Y + 0.4 || slopeAt(x, z) > 0.6 || !this.free(I, x, z, 0.7, { path: 0.9 })) continue;
      if (r() > 0.55 + Math.max(0, fbm(x * 0.15, z * 0.15)) * 0.8) continue; // clumps, not a lawn
      const outward = Math.atan2(-(z - I.z), x - I.x); // (the palms' lean is along +x)
      put(['isle_palm_a', 'isle_palm_b', 'isle_palm_c'][n % 3], x, z, outward + (r() - 0.5) * 1.2, 0.85 + r() * 0.45, y - 0.05, 0.35);
      this.take(x, z, 1.4);
      if (r() < 0.25) prop('isle_coconuts', x + 0.9, z + 0.4, r() * 6.28);
      n++;
    }
    // shore rocks, and big ones at the foot of the cliffs
    for (let n = 0, tries = 0; n < (I.cliffs ? 26 : 12) && tries < 600; tries++) {
      const a = r() * Math.PI * 2, e = 0.92 + r() * 0.2;
      const x = I.x + Math.cos(a) * I.r * e, z = I.z + Math.sin(a) * I.rz * e;
      const D = DOCKS[I.id];
      if (Math.hypot(x - (D.x0 + D.end.x) / 2, z - (D.z0 + D.end.z) / 2) < 16 || padAt(x, z, 9) || Math.hypot(x - GROTTO.mouth.x, z - GROTTO.mouth.z) < 12) continue;
      if (!this.free(I, x, z, 1.5, { path: 1 })) continue;
      const sy = oceanSurfaceY(x, z);
      if (sy > WATER_Y + 1.2) continue; // (only at the water's edge, never perched on a cliff top)
      const big = I.cliffs && n % 4 === 0;
      put(big ? 'isle_rock_c' : n % 2 ? 'isle_rock_b' : 'isle_rock_a', x, z, r() * 6.28, big ? 0.45 + r() * 0.3 : 0.5 + r() * 0.5, sy - (big ? 1.2 : 0.4), big ? 0 : 1.0);
      this.take(x, z, big ? 4 : 2);
      n++;
    }
    // tide pools on rocky shores, driftwood and shells along the tide line
    for (let n = 0, tries = 0; n < (I.atoll ? 3 : I.cliffs ? 4 : 3) && tries < 300; tries++) {
      const a = r() * Math.PI * 2, p = ringPoint(I, a, I.atoll ? 0.985 : 0.97);
      if (oceanSurfaceY(p.x, p.z) < WATER_Y + 0.05 || !this.free(I, p.x, p.z, 1.6, { path: 0.5 })) continue;
      prop('isle_tidepool', p.x, p.z, r() * 6.28); this.take(p.x, p.z, 2); n++;
    }
    for (let n = 0, tries = 0; n < (I.id === 'palm' ? 14 : 10) && tries < 500; tries++) {
      const a = r() * Math.PI * 2, p = ringPoint(I, a, 0.96 + r() * 0.03);
      if (oceanSurfaceY(p.x, p.z) < WATER_Y + 0.08 || !this.free(I, p.x, p.z, 0.9, { path: 0.5 })) continue;
      prop(n % 2 ? 'isle_driftwood' : 'isle_shells', p.x, p.z, r() * 6.28, 0.8 + r() * 0.5); this.take(p.x, p.z, 1.2); n++;
    }
    if (I.atoll) for (let n = 0, tries = 0; n < 8 && tries < 300; tries++) { // shells round the lagoon beach too
      const p = ringPoint(I, r() * Math.PI * 2, ATOLL.in - 0.02);
      if (oceanSurfaceY(p.x, p.z) < WATER_Y + 0.08 || !this.free(I, p.x, p.z, 0.8, { path: 0.5 })) continue;
      prop('isle_shells', p.x, p.z, r() * 6.28, 0.9); this.take(p.x, p.z, 1); n++;
    }
    // flowering shrubs, sea grape and banana plants on the grass (and by the buildings)
    const plants = ['isle_hibiscus', 'isle_hibiscus_pink', 'isle_seagrape', 'isle_banana_a', 'isle_banana_b'];
    for (let n = 0, tries = 0; n < (I.id === 'palm' ? 40 : I.atoll ? 22 : 22) && tries < 2500; tries++) {
      const a = r() * Math.PI * 2, e = I.atoll ? ATOLL.in + 0.1 + r() * 0.25 : 0.2 + r() * 0.72;
      const x = I.x + Math.cos(a) * I.r * e, z = I.z + Math.sin(a) * I.rz * e, y = oceanSurfaceY(x, z);
      if (y < WATER_Y + (I.atoll ? 1.0 : 1.2) || slopeAt(x, z) > 0.55 || !this.free(I, x, z, 0.9, { path: 0.7 })) continue;
      const kind = I.atoll ? (n % 3 ? 'isle_seagrape' : 'isle_hibiscus_pink') : plants[n % plants.length];
      prop(kind, x, z, r() * 6.28, 0.8 + r() * 0.5, null, kind.startsWith('isle_banana') ? 0.2 : 0);
      this.take(x, z, 1.1); n++;
    }
  }

  // ---- grass tufts, beach grass, bushes, ferns and loose rocks (instanced or merged)
  buildPlants(root) {
    const tufts = [], dune = [], bushes = [], ferns = [], rocks = [];
    for (const I of ISLANDS) {
      const r = mulberry32(I.seed * 977 + 3);
      const R = Math.max(I.r, I.rz);
      for (let k = 0; k < (I.id === 'palm' ? 9000 : 6000); k++) {
        const x = I.x + (r() * 2 - 1) * R, z = I.z + (r() * 2 - 1) * R, y = oceanSurfaceY(x, z);
        if (y < WATER_Y + 0.5 || padAt(x, z, 1) || pathDist(I.id, x, z) < 0.9 || slopeAt(x, z) > 0.7) continue;
        if (this.taken.some((o) => o.r > 1.5 && Math.hypot(x - o.x, z - o.z) < o.r * 0.8)) continue;
        const grassy = I.atoll ? (y > WATER_Y + 1.6 ? 0.45 : 0.15) : smooth(WATER_Y + 0.9, WATER_Y + 1.5, y);
        if (r() > grassy * (0.6 + Math.max(0, fbm(x * 0.2, z * 0.2)))) continue;
        (I.atoll || y < WATER_Y + 1.3 ? dune : tufts).push({ x, y: y - 0.02, z, s: 0.8 + r() * 0.7, a: r() * 6.28 });
      }
      for (let k = 0, n = 0; k < 900 && n < (I.id === 'palm' ? 70 : I.atoll ? 26 : 40); k++) {
        const x = I.x + (r() * 2 - 1) * R, z = I.z + (r() * 2 - 1) * R, y = oceanSurfaceY(x, z);
        if (y < WATER_Y + (I.atoll ? 1.3 : 1.4) || slopeAt(x, z) > 0.55 || !this.free(I, x, z, 0.9, { path: 0.8 })) continue;
        bushes.push({ x, y: y - 0.06, z, ry: r() * 6.28, s: 0.7 + r() * 0.5, shape: Math.floor(r() * 3), green: Math.floor(r() * 4), berries: r() < 0.2 ? 1 : 0 });
        this.take(x, z, 0.9); n++;
      }
      if (!I.atoll) for (let k = 0, n = 0; k < 1200 && n < (I.id === 'palm' ? 60 : 50); k++) { // ferns in the shade under the palms
        const x = I.x + (r() * 2 - 1) * R, z = I.z + (r() * 2 - 1) * R, y = oceanSurfaceY(x, z);
        if (y < WATER_Y + 1.5 || slopeAt(x, z) > 0.6 || pathDist(I.id, x, z) < 1.2 || padAt(x, z, 2)) continue;
        if (!this.taken.some((o) => o.r < 1.6 && o.r > 1.2 && Math.hypot(x - o.x, z - o.z) < 3.2)) continue; // (near a palm)
        if (this.taken.some((o) => Math.hypot(x - o.x, z - o.z) < o.r * 0.6)) continue;
        ferns.push({ x, y: y - 0.05, z, ry: r() * 6.28, s: 0.6 + r() * 0.5 }); n++;
      }
      if (I.cliffs) for (let k = 0; k < 90; k++) { // boulders set into the cliff face, so it reads as broken rock, not a wall
        const a = (k / 90) * Math.PI * 2, p = ringPoint(I, a, 0.955 + (k % 3) * 0.02);
        const y = oceanSurfaceY(p.x, p.z);
        if (y < WATER_Y + 3 || slopeAt(p.x, p.z) < 1.2) continue;
        rocks.push({ x: p.x, y: WATER_Y + 0.5 + r() * (y - WATER_Y - 1), z: p.z, s: 1.2 + r() * 1.8, seed: 5000 + k, face: true });
      }
      for (let k = 0, n = 0; k < 600 && n < (I.cliffs ? 50 : 18); k++) { // loose rocks
        const x = I.x + (r() * 2 - 1) * R, z = I.z + (r() * 2 - 1) * R, y = oceanSurfaceY(x, z);
        if (y < WATER_Y + 0.2 || !this.free(I, x, z, 0.5, { path: 0.6 })) continue;
        if (!I.cliffs && slopeAt(x, z) < 0.3 && r() < 0.7) continue;
        rocks.push({ x, y, z, s: 0.25 + Math.pow(r(), 2) * 0.6, seed: k + I.seed * 1000 }); n++;
      }
    }
    // grass tufts (and paler beach grass on the dunes), one instanced mesh each, swaying with the valley's wind
    const tuftMesh = (list, base, name) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(tuftGeo(), tuftMaterial(WIND, `isle-${name}`), list.length); // (the valley's own tufts and material)
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), cols = new Float32Array(list.length * 3);
      list.forEach((p, i) => { q.setFromAxisAngle(up, p.a); m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s * 1.3, p.s)); mesh.setMatrixAt(i, m); const t = 0.85 + (i % 7) * 0.04; cols.set([base[0] * t, base[1] * t, base[2] * t], i * 3); });
      mesh.instanceColor = new THREE.InstancedBufferAttribute(cols, 3);
      mesh.computeBoundingSphere();
      mesh.receiveShadow = true;
      mesh.name = `isle-${name}`;
      root.add(mesh);
    };
    tuftMesh(tufts, [0.95, 1.05, 0.85], 'grass');
    tuftMesh(dune, [1.25, 1.18, 0.72], 'dunegrass');
    if (bushes.length) { const b = natureBushes(bushes); addWind(b.material, WIND, 0.05, 'isle-bushes'); root.add(b); }
    if (ferns.length) root.add(buildFerns(ferns));
    if (rocks.length) {
      const parts = rocks.map((p) => { const rr = mulberry32(p.seed); const g = rockGeometry(rr, p.s); g.translate(p.x, p.y - p.s * 0.25, p.z); if (p.s > 0.45 && !p.face) addCircle(p.x, p.z, p.s * 0.9); return g.index ? g.toNonIndexed() : g; });
      const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      parts.forEach((g) => g.dispose());
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'isle-rocks';
      root.add(mesh);
    }
  }

  /** v1.15.8: the name on the tiki bar's hanging sign, painted in cream on the board. */
  barSign(x, y, z, yaw) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#2f9a9a'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#f2e6c4'; g.lineWidth = 6; g.strokeRect(10, 10, 492, 108);
    g.fillStyle = '#fff6dc'; g.font = '800 60px "Baloo 2", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText("KAI'S TIKI BAR", 256, 68);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 0.38), new THREE.MeshLambertMaterial({ map: tex }));
    m.position.set(x + Math.sin(yaw) * 0.04, y, z + Math.cos(yaw) * 0.04); m.rotation.y = yaw;
    m.name = 'tiki-sign';
    this.root.add(m);
  }

  /** A soft glow over a torch, a fire or a lantern, shown at night. */
  halo(x, z, h, size = 2.0, color = '#ffb050') {
    if (!this.haloTex) {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d'), grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grd.addColorStop(0, 'rgba(255,230,180,1)'); grd.addColorStop(0.3, 'rgba(255,200,120,0.45)'); grd.addColorStop(1, 'rgba(255,180,100,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
      this.haloTex = new THREE.CanvasTexture(c);
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.haloTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.position.set(x, oceanSurfaceY(x, z) + h, z); s.scale.setScalar(size);
    s.userData.ph = x * 1.7 + z;
    (this.root || this.scene).add(s);
    this.halos.push(s);
  }

  update(dt, t, near) {
    if (!this.built) return;
    this.root.visible = near;
    if (!near) { if (this.kai) this.kai.actor.root.visible = false; return; }
    const lite = this.game.engine.quality === 'low'; // low graphics: no grass tufts (their overdraw costs most), like the valley
    for (const n of ['isle-grass', 'isle-dunegrass']) { const m = this.root.getObjectByName(n); if (m) m.visible = !lite; }
    const night = this.game.engine.sky?.night ?? 0;
    for (const s of this.halos) s.material.opacity = night * (0.75 + Math.sin(t * 7 + s.userData.ph) * 0.12 + Math.sin(t * 13 + s.userData.ph * 2) * 0.08);
    // v1.15.10: the fire pits burn (embers rise after dark), when you're near enough to see them
    const cam = this.game.engine.camera.position;
    for (const f of this.fires) {
      const close = Math.hypot(cam.x - f.x, cam.z - f.z) < 70;
      f.flame.visible = close && !lite; // (low graphics: the embers and the glow, not the flame shader)
      if (!close) continue;
      if (!lite) f.flame.userData.update?.(t, dt, night, 0.3);
      if (night > 0.3 && Math.random() < dt * 3) this.game.fx?.ember(new THREE.Vector3(f.x, f.y + 0.5, f.z));
    }
    const I = ISLAND_BY_ID.turtle;
    for (const T of this.turtles) {
      T.a += T.w * dt;
      const x = I.x + Math.cos(T.a) * T.R, z = I.z + Math.sin(T.a) * T.R;
      T.m.position.set(x, WATER_Y - 0.35 - Math.max(0, Math.sin(t * 0.2 + T.dive)) * 0.9, z);
      T.m.rotation.y = Math.atan2(-Math.sin(T.a), Math.cos(T.a)) + Math.PI / 2;
    }
    for (const R of this.rays || []) {
      R.a += R.w * dt;
      const x = I.x + Math.cos(R.a) * R.R, z = I.z + Math.sin(R.a) * R.R;
      R.m.position.set(x, WATER_Y - 0.8 - Math.sin(t * 0.3 + R.ph) * 0.35, z);
      R.m.rotation.set(0, Math.atan2(-Math.sin(R.a), Math.cos(R.a)) + (R.w < 0 ? Math.PI : 0), Math.sin(t * 1.8 + R.ph) * 0.12);
      R.m.scale.x = R.m.scale.z * (1 + Math.sin(t * 1.8 + R.ph) * 0.1); // the wings beat
    }
    const K = this.kai, g = this.game;
    if (K) {
      const d2 = K.pos.distanceToSquared(g.player.pos);
      K.actor.root.visible = d2 < 80 * 80;
      if (K.actor.root.visible) {
        const close = d2 < 25;
        const want = K.talking ? K.yaw : close ? Math.atan2(g.player.pos.x - K.pos.x, g.player.pos.z - K.pos.z) : this.tiki.yaw + Math.sin(t * 0.3) * 0.5;
        let d = want - (K.face ?? want); d = Math.atan2(Math.sin(d), Math.cos(d)); K.face = (K.face ?? want) + d * Math.min(1, dt * 3);
        K.actor.update(dt, t, { x: K.pos.x, y: K.pos.y, z: K.pos.z, yaw: K.face, mode: 'shore', pose: close && Math.sin(t * 0.6) > 0.95 ? 'wave' : 'idle', moving: false, rod: 'back' });
      }
    }
  }
}
