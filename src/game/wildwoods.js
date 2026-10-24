// v1.14.9 The Wild Woods: what you do in the forest between the lakes.
//   Foraging     chanterelles, blackberries and wild mint (they regrow each day), worms under fallen logs, crickets in
//                the grass at night. Mushrooms, berries and mint go in your pantry; worms and crickets in your bait.
//   Forest stew  two chanterelles, two blackberries and a sprig of mint at any campfire: Well Fed (no one fish).
//   Field Guide  photograph the valley's wildlife (press E when one's close and in view): three sets of four.
//   Journal      eight pages of Elias Fenn's journal blown round the woods.
//   Ridge Lookout climb the fire tower; Ranger Rhea's three daily tasks and her fly rod.
//   Old Hollis   brings you tea for three sprigs of mint, and tells you where something hidden is.
//   Wren's Wagon parks at one of five stops for three hours at a time (the same stop for everyone, from the clock);
//                a quarter off three of Gus's things, and she buys what you pick.
//   Ridgeback Loop a timed bike lap: through the gate, all six arches in order, back through the gate. Personal best
//                and the week's board; the jumps throw your bike into the air.
//   Camps        pitch a tent and a fire anywhere in the woods; friends see it (one short field in your presence),
//                and anyone can roast a fish or cook stew at it.
//   Secret Waters find all four hidden pools.
//   The living forest: beavers in Fox Hollow, owls at night by the lookout and the treehouse, bees round the hives,
//                fairy rings that glow after dark, pumpkins in autumn.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WOODS, buildWoods, cullWoods, campable, RING_GLOW, wmat, bakeLoose } from '../world/woods.js';
import { POOLS, CREEKS, HALF, groundY, surfaceY, isWater, trailDist, heightAt, grassAt, WATER_Y, zoneAt, CLEARINGS, LAKES, regionName } from '../world/terrain.js';
import { shoot } from '../ui/polaroid.js';
import { buildNode } from '../entities/meshNodes.js';
import { CAMP_MATS, CAMP_NODES } from '../data/campMesh.js';
import { addCircle } from '../world/colliders.js';
import { PLACES } from './places.js';
import { FORAGE, PANTRY, STEW, GUIDE, GUIDE_SETS, GUIDE_ALL, PAGES, PAGES_ALL, SECRET_WATERS, RANGER_TASKS, WAGON_HOURS, WAGON_DISCOUNT, RHEA, HOLLIS, WREN, RHEA_LOOK, HOLLIS_LOOK, WREN_LOOK } from '../data/woodsdata.js';
import { defaultAvatar } from '../data/avatarOptions.js';
import { ITEMS, ITEMS_BY_ID } from '../data/items.js';
import { BAITS } from '../data/bait.js';
import { seasonFor } from '../data/seasons.js';
import { mulberry32 } from '../core/rng.js';

const DAY = 86400000;
const dayNo = (t = Date.now()) => Math.floor(t / DAY);
const weekNo = (t = Date.now()) => Math.floor((t + 3 * DAY) / (7 * DAY)); // Monday-based weeks
const look = (o) => ({ ...defaultAvatar(o.gender), ...o });
const POOL_IDS = Object.keys(POOLS);

// ---------------------------------------------------------------- the map: every new place is discovered by walking near
PLACES.push(
  ...Object.entries(POOLS).map(([id, P]) => ({ id: `pool-${id}`, kind: 'lake', name: P.name, x: P.cx, z: P.cz, r: P.rx + 6, secret: true, desc: { moonwell: 'A round pool in the western hills that never rises or falls. Silver fish come up at night.', foxhollow: 'A wooded hollow in the east, with a beaver lodge and brook trout. Hollow Brook runs out of it to Willow River.', mirrortarn: 'A still tarn below the north mesa that holds the sky. Tarn Run flows from it down to Frostrun Creek.', lantern: 'A spring in the south woods where tiny fish glow like lanterns after dark.' }[id] })),
  ...Object.entries(CREEKS).map(([id, Ck]) => { const m = Ck.pts[Math.floor(Ck.pts.length / 2)]; return { id: `creek-${id}`, kind: 'lake', name: Ck.name, x: m[0], z: m[1], r: 10, desc: 'A wadeable creek with riffles. Fly fishing country.' }; }),
  { id: 'tower', kind: 'poi', name: 'Ridge Lookout', x: WOODS.tower.x, z: WOODS.tower.z, r: 18, desc: 'The ranger\'s fire tower in the west hills. Climb it for the view; Ranger Rhea has jobs and a fly rod.' },
  { id: 'trapper', kind: 'poi', name: "Trapper's Cabin", x: WOODS.trapper.x, z: WOODS.trapper.z, r: 14, desc: 'Elias Fenn\'s old log cabin in the east woods. He mapped the valley.' },
  { id: 'plane', kind: 'poi', name: 'Crash Clearing', x: WOODS.plane.x, z: WOODS.plane.z, r: 16, desc: 'The old mail plane that came down in a storm. The moss is winning.' },
  { id: 'hollis', kind: 'poi', name: "Hollis's Treehouse", x: WOODS.hollis.x, z: WOODS.hollis.z, r: 16, desc: 'Old Hollis has lived in this oak since he was a boy. He likes mint tea.' },
  { id: 'loop', kind: 'poi', name: 'Ridgeback Loop', x: WOODS.gate.x, z: WOODS.gate.z, r: 14, desc: 'A dirt bike trail round Lookout Mesa. Ride through the gate and all six arches for a lap time.' },
);

// ---------------------------------------------------------------- forage spots: seeded, the same for everyone
function forageSpots() {
  const r = mulberry32(19830917), out = [];
  const nearWater = (x, z, d) => { for (let a = 0; a < 8; a++) { if (isWater(x + Math.cos(a * 0.785) * d, z + Math.sin(a * 0.785) * d)) return true; } return false; };
  const clear = (x, z) => groundY(x, z) != null && !isWater(x, z) && trailDist(x, z) > 3 && Math.hypot(x, z) > 62 && Object.values(CLEARINGS).every((c) => Math.hypot(x - c.x, z - c.z) > c.r + 3) && !out.some((o) => Math.hypot(o.x - x, o.z - z) < 7);
  const want = { chanterelle: 26, blackberry: 22, mint: 18, log: 14, cricket: 14 };
  for (const [kind, n] of Object.entries(want)) {
    let got = 0;
    for (let i = 0; i < 4000 && got < n; i++) {
      const x = (r() * 2 - 1) * (HALF - 26), z = (r() * 2 - 1) * (HALF - 26);
      if (!clear(x, z)) continue;
      if (kind === 'mint' && !nearWater(x, z, 6)) continue;
      if (kind !== 'mint' && nearWater(x, z, 4)) continue;
      if (kind === 'cricket' && grassAt(x, z) < 0.6) continue;
      if (kind === 'chanterelle' && heightAt(x, z) < 2) continue;
      out.push({ i: out.length, kind, x, z, y: surfaceY(x, z), yaw: r() * 6.28 });
      got++;
    }
  }
  return out;
}
let SPOTS_CACHE = null;
/** The forage spots (worked out once, after the woods are built). */
export function FORAGE_SPOTS_GET() { return SPOTS_CACHE || (SPOTS_CACHE = forageSpots()); }

/** A small model for each forage kind (merged into one geometry per material, instanced). */
function forageModel(kind) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); g.add(m); };
  if (kind === 'chanterelle') {
    const stem = wmat('#e8c070'), cap = wmat('#e8a030');
    for (const [x, z, s] of [[0, 0, 1], [0.22, 0.1, 0.8], [-0.15, 0.2, 0.7], [0.1, -0.2, 0.6]]) {
      add(new THREE.CylinderGeometry(0.04 * s, 0.03 * s, 0.16 * s, 5), stem, x, 0.08 * s, z);
      add(new THREE.CylinderGeometry(0.12 * s, 0.04 * s, 0.07 * s, 7), cap, x, 0.17 * s, z);
    }
  } else if (kind === 'blackberry') {
    const leaf = wmat('#3f6a2e'), leafL = wmat('#4f7d3a'), berry = wmat('#2a1a36'), red = wmat('#a8243a');
    add(new THREE.IcosahedronGeometry(0.55, 0), leaf, 0, 0.4, 0, 0, 0, 0, 1.2, 0.8, 1.1);
    add(new THREE.IcosahedronGeometry(0.4, 0), leafL, 0.3, 0.55, 0.2);
    for (let k = 0; k < 9; k++) { const a = k * 2.4, y = 0.3 + (k % 3) * 0.18; add(new THREE.IcosahedronGeometry(0.06, 0), k % 4 ? berry : red, Math.cos(a) * 0.55, y, Math.sin(a) * 0.5); }
  } else if (kind === 'mint') {
    const leaf = wmat('#5ab07a'), leafD = wmat('#3f8a5a');
    for (let k = 0; k < 7; k++) { const a = k * 0.9; add(new THREE.BoxGeometry(0.05, 0.36 + (k % 3) * 0.08, 0.05), leafD, Math.cos(a) * 0.12, 0.18, Math.sin(a) * 0.12, Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2); add(new THREE.OctahedronGeometry(0.08, 0), leaf, Math.cos(a) * 0.14, 0.38 + (k % 3) * 0.08, Math.sin(a) * 0.14); }
  } else if (kind === 'log') {
    const bark = wmat('#5a4430'), end = wmat('#b89a6a'), moss = wmat('#5f7d3c');
    add(new THREE.CylinderGeometry(0.28, 0.32, 2.4, 8), bark, 0, 0.26, 0, 0, 0, Math.PI / 2);
    for (const x of [-1.2, 1.2]) add(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 8), end, x, 0.26, 0, 0, 0, Math.PI / 2);
    add(new THREE.BoxGeometry(1.0, 0.06, 0.4), moss, 0.2, 0.55, 0);
  } else { // cricket: a tuft of long grass (the crickets themselves you only hear)
    const grass = wmat('#7a9a4a'), grassD = wmat('#5a7a3a');
    for (let k = 0; k < 9; k++) { const a = k * 0.7; add(new THREE.BoxGeometry(0.04, 0.55 + (k % 3) * 0.15, 0.04), k % 2 ? grass : grassD, Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15, Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3); }
  }
  return g;
}

export class WildWoods {
  constructor(game) {
    this.game = game;
    this.t = 0; this.cullT = 0; this.built = false;
    this.camps = new Map(); // id -> { group, x, z }
    this.lap = null; // { t0, next }
  }
  get d() {
    const e = this.game.ext.d;
    if (!e.woods) e.woods = { forage: { day: 0, picked: [] }, pantry: {}, guide: {}, pages: {}, sets: {}, ranger: { day: 0, have: {}, done: [] }, loopBest: 0, camp: null, hints: [] };
    return e.woods;
  }
  change(fn) { this.game.ext.change((d) => { if (!d.woods) d.woods = this.d; fn(d.woods); }); }

  // ---------------------------------------------------------------- build
  init() {
    if (this.built || this.failed) return;
    try { this.build(); this.built = true; } catch (e) { this.failed = true; console.error('[woods]', e); }
  }
  build() {
    const g = this.game, scene = g.engine.scene;
    const { sites, rings, pumpkinSites } = buildWoods(scene);
    this.sites = sites; this.pumpkinSites = pumpkinSites;
    this.buildForage(scene);
    this.buildPages(scene);
    this.buildCritters(scene);
    this.buildWagon(scene);
    // the people
    const T = WOODS.tower, a = 0.4;
    this.rhea = g.npcs?.add({ id: 'woods-rhea', name: 'Ranger Rhea', title: 'Ridge Lookout', look: look(RHEA_LOOK), kind: 'stand', x: T.x - Math.cos(a) * 3.6 + Math.sin(a) * 1.6, z: T.z + Math.sin(a) * 3.6 + Math.cos(a) * 1.6, yaw: a + Math.PI, hello: RHEA.hello, mutter: RHEA.mutter });
    const H = WOODS.hollis;
    this.hollis = g.npcs?.add({ id: 'woods-hollis', name: 'Old Hollis', title: 'Lives in the oak', look: look(HOLLIS_LOOK), kind: 'stand', x: H.x - 2.2, z: H.z + 2.8, yaw: 0.3, hello: HOLLIS.hello, mutter: HOLLIS.mutter, idlePose: 'sit' });
    const W = this.wagonStop();
    this.wren = g.npcs?.add({ id: 'woods-wren', name: 'Wren', title: "Wren's Wagon", look: look(WREN_LOOK), kind: 'stand', x: W.x + 2.2, z: W.z + 1.4, yaw: 0, hello: WREN.hello, mutter: WREN.mutter });
    this.placeWagon(true);
    this.refreshForage();
    this.watchBoard();
    this.applySeason();
  }

  buildForage(scene) {
    // one instanced mesh per kind: the model's parts merged into one geometry, coloured per vertex (5 draw calls in all)
    this.forage = {};
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const kind of Object.keys(FORAGE)) {
      const spots = FORAGE_SPOTS_GET().filter((s) => s.kind === kind);
      const model = forageModel(kind);
      model.updateMatrixWorld(true);
      const parts = [];
      model.traverse((o) => {
        if (!o.isMesh) return;
        const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
        for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
        const g2 = geo.index ? geo.toNonIndexed() : geo;
        const c = o.material.color, n = g2.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g2.setAttribute('color', new THREE.BufferAttribute(col, 3));
        parts.push(g2);
      });
      const im = new THREE.InstancedMesh(mergeGeometries(parts, false), mat, spots.length);
      im.receiveShadow = true; im.castShadow = false;
      scene.add(im);
      this.forage[kind] = { spots, meshes: [im] };
      if (kind === 'log') for (const s of spots) addCircle(s.x, s.z, 0.5, { top: s.y + 0.55 });
    }
  }
  /** Show what's left to pick today (crickets only at night). */
  refreshForage() {
    if (!this.forage) return;
    const f = this.d.forage, today = dayNo();
    if (f.day !== today) this.change((w) => { w.forage = { day: today, picked: [] }; });
    const picked = new Set(this.d.forage.picked), m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0);
    const night = this.isNight();
    for (const { spots, meshes } of Object.values(this.forage)) {
      spots.forEach((s, k) => {
        const show = !picked.has(s.i) && (s.kind !== 'cricket' || night);
        m.compose(new THREE.Vector3(s.x, s.y - 0.02, s.z), q.setFromEuler(new THREE.Euler(0, s.yaw, 0)), show ? one : zero);
        for (const im of meshes) im.setMatrixAt(k, m);
      });
      for (const im of meshes) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
    }
    this.nightShown = night;
  }
  isNight() { const ph = this.game.engine.sky?.state?.phase; return ph === 'night' || ph === 'dusk'; }

  buildPages(scene) {
    const at = {
      trapper: (() => { const [x, z] = [WOODS.trapper.x + 3.2, WOODS.trapper.z + 2.4]; return { x, z }; })(),
      tower: { x: WOODS.tower.x, z: WOODS.tower.z, y: WOODS.tower.deckY },
      mirrortarn: { x: POOLS.mirrortarn.cx - POOLS.mirrortarn.rx - 2.5, z: POOLS.mirrortarn.cz + 1 },
      moonwell: { x: POOLS.moonwell.cx, z: POOLS.moonwell.cz + POOLS.moonwell.rz + 2.5 },
      dam: { x: WOODS.dam.x + WOODS.dam.uz * 3.2, z: WOODS.dam.z - WOODS.dam.ux * 3.2 },
      plane: { x: WOODS.plane.x - 3, z: WOODS.plane.z + 3 },
      hollis: { x: WOODS.hollis.x + 2.6, z: WOODS.hollis.z - 2.2 },
      gate: { x: WOODS.gate.x + WOODS.gate.uz * 4, z: WOODS.gate.z - WOODS.gate.ux * 4 },
    };
    const paper = wmat('#f2ead6', { emissive: '#3a3020' }), ribbon = wmat('#a83a2a');
    this.pages = PAGES.map((P) => {
      const p = at[P.at];
      let y = p.y ?? groundY(p.x, p.z) ?? surfaceY(p.x, p.z);
      const grp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.56).rotateX(0.12).rotateY(0.3), paper); // (a ribbon-tied sheet: the ribbon is painted on)
      grp.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.58).rotateX(0.12).rotateY(0.3), ribbon), { name: 'tie' }));
      grp.position.set(p.x, y + 0.06, p.z);
      scene.add(grp);
      return { ...P, x: p.x, y, z: p.z, mesh: grp };
    });
    this.refreshPages();
  }
  refreshPages() { const pl = this.game.player?.pos; for (const p of this.pages || []) p.mesh.visible = !this.d.pages[p.id] && (!pl || Math.hypot(p.x - pl.x, p.z - pl.z) < 60); }

  buildCritters(scene) {
    // beavers paddling round their lodge
    const fur = wmat('#6a4a2e'), tail = wmat('#3a2a1e'), eye = wmat('#111111');
    this.beavers = [0, 1].map((i) => {
      const b = new THREE.Group();
      b.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.3), fur));
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.22), fur); hd.position.set(0.32, 0.05, 0); b.add(hd);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.2), tail); tl.position.set(-0.4, -0.02, 0); b.add(tl);
      for (const s of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), eye); e.position.set(0.42, 0.1, s); b.add(e); }
      b.userData.tail = tl; b.userData.ph = i * Math.PI;
      scene.add(b);
      return b;
    });
    // owls on branches by the lookout and the treehouse (only out at night)
    const owlF = wmat('#8a7a62'), owlD = wmat('#5e523e'), owlE = wmat('#f0c040', { emissive: '#604010' });
    const perch = [{ x: WOODS.tower.x + 5, z: WOODS.tower.z - 4, h: 4.2 }, { x: WOODS.hollis.x + 1.2, z: WOODS.hollis.z - 1.4, h: 7.6 }, { x: POOLS.moonwell.cx + 7, z: POOLS.moonwell.cz - 5, h: 3.4 }];
    this.owls = perch.map((P) => {
      const o = new THREE.Group();
      const y = (groundY(P.x, P.z) ?? surfaceY(P.x, P.z)) + P.h;
      if (P.h < 5) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, P.h, 6), wmat('#5a4430')); post.position.set(0, -P.h / 2, 0); o.add(post); addCircle(P.x, P.z, 0.2); }
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.28), owlF); body.position.y = 0.22; o.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.26), owlD); head.position.y = 0.52; o.add(head);
      for (const s of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), owlE); e.position.set(s, 0.54, 0.14); head.add(e); e.position.y = 0.02; }
      o.position.set(P.x, y, P.z);
      o.userData.head = head;
      scene.add(o);
      return o;
    });
    // bees: a few specks circling each hive
    const beeM = new THREE.MeshBasicMaterial({ color: '#f0c020' }), beeG = new THREE.BoxGeometry(0.05, 0.04, 0.04);
    this.bees = WOODS.hives.map((H) => {
      const g = new THREE.InstancedMesh(beeG, beeM, 7); // a swarm is one draw call
      g.position.set(H.at.x, H.at.y, H.at.z); g.frustumCulled = false;
      scene.add(g);
      return g;
    });
  }

  buildWagon(scene) {
    const wood = wmat('#8a5a34'), woodD = wmat('#5e3a20'), canvas = wmat('#e8dcc0'), stripe = wmat('#c0483a'), wheel = wmat('#3a2a1e'), gold = wmat('#d8a840');
    const w = new THREE.Group();
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; w.add(m); };
    add(new THREE.BoxGeometry(3.4, 0.9, 1.8), wood, 0, 1.05, 0);
    add(new THREE.CylinderGeometry(1.05, 1.05, 3.4, 10, 1, true, 0, Math.PI), canvas, 0, 1.5, 0, 0, 0, Math.PI / 2);
    for (const x of [-1.2, 0, 1.2]) add(new THREE.BoxGeometry(0.18, 0.02, 2.1), stripe, x, 2.53, 0, 0, 0, 0);
    for (const [x, z] of [[-1.1, 0.95], [1.1, 0.95], [-1.1, -0.95], [1.1, -0.95]]) add(new THREE.TorusGeometry(0.42, 0.07, 5, 12), wheel, x, 0.45, z);
    add(new THREE.BoxGeometry(2.2, 0.08, 0.6), woodD, 0, 1.0, 1.15, -0.3, 0, 0); // the shop counter flap
    add(new THREE.BoxGeometry(1.4, 0.36, 0.06), gold, 0, 1.75, 0.92); // the sign
    add(new THREE.BoxGeometry(0.1, 0.1, 1.6), woodD, 2.2, 0.75, 0, 0, 0, 0.3); // the shafts
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), wmat('#ffd27a', { emissive: '#c88a2a' })); lamp.position.set(-1.8, 1.8, 0.9); w.add(lamp);
    this.wagon = bakeLoose(w); // one mesh per material
    scene.add(this.wagon);
  }
  /** Where the wagon is right now (the same for everyone): a new stop every few hours, in a shuffled order. */
  wagonStop(t = Date.now()) {
    const slot = Math.floor(t / (WAGON_HOURS * 3600000));
    const r = mulberry32(slot * 2654435761 >>> 0);
    const stops = WOODS.wagonStops;
    let i = Math.floor(r() * stops.length);
    if (i === Math.floor(mulberry32((slot - 1) * 2654435761 >>> 0)() * stops.length)) i = (i + 1) % stops.length; // never the same stop twice running
    return { ...stops[i], slot, leaves: (slot + 1) * WAGON_HOURS * 3600000 };
  }
  placeWagon(force = false) {
    const W = this.wagonStop();
    if (!force && W.slot === this.wagonSlot) return;
    this.wagonSlot = W.slot;
    const y = groundY(W.x, W.z) ?? surfaceY(W.x, W.z);
    this.wagon.position.set(W.x, y, W.z);
    this.wagon.rotation.y = 0.3 + W.slot % 5;
    if (this.wren) { this.wren.home = { x: W.x + Math.cos(this.wagon.rotation.y) * 0 + Math.sin(this.wagon.rotation.y) * 2.4, z: W.z + Math.cos(this.wagon.rotation.y) * 2.4 }; this.wren.pos.set(this.wren.home.x, groundY(this.wren.home.x, this.wren.home.z) ?? y, this.wren.home.z); this.wren.homeYaw = this.wagon.rotation.y; }
    this.wagonStock = this.stock(W.slot);
  }
  /** Three things from Gus's shelves, a quarter off, different each stop. */
  stock(slot) {
    const p = this.game.profile, r = mulberry32((slot * 7919) >>> 0);
    const pool = ITEMS.filter((it) => it.source === 'shop' && it.price?.coins && !['boat'].includes(it.kind) && it.price.coins >= 400 && it.price.coins <= 20000);
    const out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    if (!p?.owned?.includes('rod_fly')) out[0] = ITEMS_BY_ID.rod_fly;
    return out.map((it) => ({ item: it, price: { coins: Math.round(it.price.coins * WAGON_DISCOUNT / 10) * 10 } }));
  }

  // ---------------------------------------------------------------- the season
  applySeason() {
    const autumn = seasonFor() === 'autumn';
    for (const o of this.pumpkinSites || []) o.userData.season = autumn;
  }

  // ---------------------------------------------------------------- every frame
  update(dt, t) {
    if (!this.built) return;
    const g = this.game, p = g.player.pos;
    this.cullT -= dt;
    if (this.cullT <= 0) {
      this.cullT = 0.5;
      cullWoods(this.sites, p.x, p.z);
      for (const o of this.pumpkinSites) if (!o.userData.season) o.visible = false;
      this.placeWagon();
      const night = this.isNight();
      if (night !== this.nightShown || this.d.forage.day !== dayNo()) this.refreshForage();
      for (const o of this.owls) o.visible = night && Math.hypot(o.position.x - p.x, o.position.z - p.z) < 70;
      this.checkPools();
      this.renderCamps();
      this.refreshPages();
    }
    // fairy rings glow after dark; the treehouse lamp too
    const k = this.isNight() ? 1 : 0;
    this.glow = (this.glow ?? 0) + (k - (this.glow ?? 0)) * Math.min(1, dt * 0.8);
    RING_GLOW.emissive.setRGB(0.45 * this.glow, 1.0 * this.glow, 0.85 * this.glow);
    // beavers swim round their lodge; owls turn their heads; bees buzz
    const L = WOODS.lodge;
    if (Math.hypot(L.x - p.x, L.z - p.z) < 80) for (const b of this.beavers) {
      const a = t * 0.25 + b.userData.ph, R = 3.4 + Math.sin(t * 0.13 + b.userData.ph) * 1.2;
      b.position.set(L.x + Math.cos(a) * R, WATER_Y - 0.06 + Math.sin(t * 2 + b.userData.ph) * 0.02, L.z + Math.sin(a) * R);
      b.rotation.y = -a; b.userData.tail.rotation.z = Math.sin(t * 6 + b.userData.ph) * 0.25;
      b.visible = true;
    } else for (const b of this.beavers) b.visible = false;
    for (const c of this.camps.values()) for (const [k, f] of (c.group.userData.flames || []).entries()) f.scale.set(1, 0.85 + Math.sin(t * (9 + k * 4) + k) * 0.15 + Math.sin(t * 23) * 0.05, 1);
    { const night = g.engine.sky.night || 0; for (const c of this.camps.values()) { const gl = c.group.userData.glow; if (gl) gl.material.opacity = 0.06 + night * 0.26; } } // (v1.14.10: the fire's glow shows after dark)
    // v1.14.10: embers and a wisp of smoke off camps you're near
    for (const c of this.camps.values()) { const F = c.group.userData.fire; if (!F || Math.abs(F.x - p.x) > 30 || Math.abs(F.z - p.z) > 30) continue; const y = c.group.position.y; if (Math.random() < dt * 3) this.game.fx.ember({ x: F.x, y: y + 0.5, z: F.z }); if (Math.random() < dt * 1.5) this.game.fx.smoke({ x: F.x, y: y + 0.8, z: F.z }); }
    for (const o of this.owls) if (o.visible) o.userData.head.rotation.y = Math.sin(t * 0.4 + o.position.x) * 1.1;
    for (const bg of this.bees) {
      bg.visible = Math.hypot(bg.position.x - p.x, bg.position.z - p.z) < 40 && !this.isNight();
      if (bg.visible) { const m = this._bm || (this._bm = new THREE.Matrix4()); for (let k2 = 0; k2 < 7; k2++) { const a = t * (1.8 + k2 * 0.2) + k2; m.makeTranslation(Math.cos(a) * (0.5 + k2 * 0.08), Math.sin(a * 1.7) * 0.3, Math.sin(a) * (0.5 + k2 * 0.08)); bg.setMatrixAt(k2, m); } bg.instanceMatrix.needsUpdate = true; }
    }
    // pages bob and turn so they catch the eye
    for (const pg of this.pages) if (pg.mesh.visible) { pg.mesh.rotation.y = t * 0.6; pg.mesh.position.y = pg.y + 0.1 + Math.sin(t * 2 + pg.x) * 0.05; }
    this.updateTower();
    this.updateLap(dt);
    this.hoots(dt);
  }

  hoots(dt) {
    this.hootT = (this.hootT ?? 6) - dt;
    if (this.hootT > 0) return;
    this.hootT = 9 + Math.random() * 12;
    const p = this.game.player.pos;
    const o = this.owls.find((x) => x.visible && Math.hypot(x.position.x - p.x, x.position.z - p.z) < 35);
    if (o) this.game.audio.sfx('owl', { remote: true, vol: 0.5 });
  }

  checkPools() {
    const found = this.game.ext.d.found || {};
    const n = POOL_IDS.filter((id) => found[`pool-${id}`]).length;
    if (n === POOL_IDS.length && !this.d.secretDone) {
      this.change((w) => { w.secretDone = Date.now(); });
      this.game.reward('woods', 'secret-waters', SECRET_WATERS, 'Secret Waters: all four hidden pools');
    }
  }

  // ---------------------------------------------------------------- what you can do here (E)
  contextActions() {
    if (!this.built) return [];
    const g = this.game, pl = g.player, p = pl.pos, acts = [];
    if (pl.mode !== 'shore') return acts;
    // the tower
    const T = WOODS.tower;
    if (this.onTower()) acts.push({ id: 'tower-down', label: 'Climb down', color: 'green', fn: () => this.climb(false) });
    else if (Math.hypot(p.x - (T.x + Math.cos(0.4) * 3.0), p.z - (T.z - Math.sin(0.4) * 3.0)) < 2.6 && !g.bikes?.riding) acts.push({ id: 'tower-up', label: 'Climb the lookout', color: 'green', at: { x: T.x, z: T.z, y: T.y + 2, h: 1 }, fn: () => this.climb(true) });
    // people
    for (const [npc, fn, label] of [[this.rhea, () => this.talkRhea(), 'Talk to Ranger Rhea'], [this.hollis, () => this.talkHollis(), 'Talk to Old Hollis'], [this.wren, () => this.openWagon(), "Wren's Wagon"]]) {
      if (npc && npc.actor.root.visible && Math.hypot(npc.pos.x - p.x, npc.pos.z - p.z) < 3) acts.push({ id: `talk-${npc.id}`, label, color: npc === this.wren ? 'gold' : 'green', at: { x: npc.pos.x, z: npc.pos.z, y: npc.pos.y, h: 2.4 }, fn });
    }
    // pages
    const pg = this.pages.find((x) => x.mesh.visible && Math.hypot(x.x - p.x, x.z - p.z) < 2 && Math.abs(x.y - p.y) < 2.5);
    if (pg) acts.push({ id: `page-${pg.id}`, label: 'Pick up the page', color: 'gold', at: { x: pg.x, z: pg.z, y: pg.y, h: 0.8 }, fn: () => this.takePage(pg) });
    // forage
    const f = this.nearForage();
    if (f && !g.bikes?.riding) acts.push({ id: `forage-${f.i}`, label: FORAGE[f.kind].verb, color: 'green', at: { x: f.x, z: f.z, y: f.y, h: 1.1 }, fn: () => this.pick(f) });
    // wildlife
    const w = this.photoTarget();
    if (w) acts.push({ id: `photo-${w.kind}`, label: `Photograph the ${GUIDE.find((x) => x.id === w.kind).name.toLowerCase()}`, color: 'blue', fn: () => this.photograph(w) });
    // camps
    const mine = this.d.camp;
    if (mine && Math.hypot(mine.x - p.x, mine.z - p.z) < 3) acts.push({ id: 'camp-pack', label: 'Pack up your camp', fn: () => this.packCamp() });
    else if (!mine && !g.bikes?.riding && this.canCampHere()) acts.push({ id: 'camp-pitch', label: 'Pitch a camp here', fn: () => this.pitchCamp() });
    // the loop board at the gate
    if (Math.hypot(WOODS.gate.x - p.x, WOODS.gate.z - p.z) < 4 && !g.bikes?.riding) acts.push({ id: 'loop-board', label: 'Ridgeback Loop times', fn: () => g.ui.sheets.open('loop') });
    return acts;
  }

  // ---------------------------------------------------------------- the tower
  onTower() { return !!this.up; }
  climb(up) {
    const g = this.game, T = WOODS.tower, pl = g.player;
    g.ui.closeAll?.();
    const fade = document.createElement('div'); fade.className = 'travel-fade'; g.ui.root.append(fade);
    g.audio.sfx('step', { vol: 0.6 });
    setTimeout(() => {
      this.up = up;
      if (up) { pl.pos.set(T.x, T.deckY, T.z); pl.baseY = T.deckY; this.change((w) => { w.climbs = (w.climbs || 0) + 1; }); }
      else { const x = T.x + Math.cos(0.4) * 3.2, z = T.z - Math.sin(0.4) * 3.2, y = groundY(x, z) ?? surfaceY(x, z); pl.pos.set(x, y, z); pl.baseY = y; }
      pl.air = 0; pl.vy = 0; pl.target = null;
      g.engine.cam.target.set(pl.pos.x, pl.pos.y + 0.8, pl.pos.z);
      if (up && !this.d.towerSeen) { this.change((w) => { w.towerSeen = 1; }); g.ui.toast('The whole valley from up here: five lakes like beads on a string. Fenn was right.', { icon: 'map', title: 'Ridge Lookout', ms: 5000 }); }
    }, 300);
    setTimeout(() => fade.remove(), 800);
  }
  /** Keeps you on the deck while you're up there (the rail). */
  updateTower() {
    const g = this.game, T = WOODS.tower, pl = g.player;
    if (!this.up) return;
    // left some other way (a waystone, the menu's home button): you're not up there any more
    if (Math.hypot(pl.pos.x - T.x, pl.pos.z - T.z) > 6 || pl.mode !== 'shore') { this.up = false; return; }
    const c = Math.cos(0.4), s = Math.sin(0.4), dx = pl.pos.x - T.x, dz = pl.pos.z - T.z;
    let u = dx * c - dz * s, v = dx * s + dz * c; const lim = 1.8;
    if (Math.abs(u) > lim || Math.abs(v) > lim) {
      u = Math.max(-lim, Math.min(lim, u)); v = Math.max(-lim, Math.min(lim, v));
      pl.pos.x = T.x + u * c + v * s; pl.pos.z = T.z - u * s + v * c;
    }
    if (pl.baseY < T.deckY - 0.3) { pl.baseY = T.deckY; pl.pos.y = T.deckY; }
  }

  // ---------------------------------------------------------------- foraging
  nearForage() {
    const p = this.game.player.pos, picked = new Set(this.d.forage.picked), night = this.isNight();
    let best = null, bd = 2.2;
    for (const s of FORAGE_SPOTS_GET()) {
      if (picked.has(s.i) || (s.kind === 'cricket' && !night)) continue;
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  pick(s) {
    const g = this.game, F = FORAGE[s.kind], r = mulberry32((s.i * 977 + dayNo()) >>> 0);
    const n = F.n[0] + Math.floor(r() * (F.n[1] - F.n[0] + 1));
    this.change((w) => { w.forage.picked = [...new Set([...w.forage.picked, s.i])]; if (!F.bait) w.pantry[s.kind] = (w.pantry[s.kind] || 0) + n; w.ranger.have[s.kind] = (w.ranger.have[s.kind] || 0) + (s.kind === 'log' ? 1 : n); w.picked = (w.picked || 0) + n; });
    if (F.bait) g.ext.change((d) => { d.bait[F.bait] = (d.bait[F.bait] || 0) + n; if (!d.activeBait) d.activeBait = F.bait; });
    g.audio.sfx(s.kind === 'log' ? 'dig' : 'pop');
    g.fx?.sparkle?.(new THREE.Vector3(s.x, s.y + 0.4, s.z), F.color || '#c8e0a0', 10);
    g.ui.toast(F.bait ? `+${n} ${F.name} in your bait tin.` : `+${n} ${F.name}. (${this.d.pantry[s.kind]} in your pantry)`, { icon: F.bait ? 'worm' : 'leaf', ms: 2200 });
    this.refreshForage();
    this.rangerProgress();
  }
  pantry(k) { return this.d.pantry[k] || 0; }
  spotsAll() { return FORAGE_SPOTS_GET(); }

  /** Forest stew: cooked at any campfire (cookout.js asks). */
  canStew() { return Object.entries(STEW.need).every(([k, n]) => this.pantry(k) >= n); }
  cookStew() {
    const g = this.game;
    if (!this.canStew()) { g.ui.toast(`Stew takes ${Object.entries(STEW.need).map(([k, n]) => `${n} ${FORAGE[k].name.toLowerCase()}`).join(', ')}.`); return; }
    this.change((w) => { for (const [k, n] of Object.entries(STEW.need)) w.pantry[k] -= n; w.stews = (w.stews || 0) + 1; });
    g.cookout?.stew?.(STEW.seconds);
  }

  // ---------------------------------------------------------------- the Field Guide
  /** The closest wildlife you haven't photographed yet, close and in view. */
  photoTarget() {
    const g = this.game, p = g.player.pos, have = this.d.guide, cands = [];
    const look = (kind, obj, max) => { if (have[kind] || !obj || !obj.visible) return; const w = obj.getWorldPosition(this._v || (this._v = new THREE.Vector3())); const d = w.distanceTo(p); if (d > max) return; const s = g.engine.toScreen(w); if (!s || s.x < 40 || s.y < 40 || s.x > g.engine.width - 40 || s.y > g.engine.height - 40) return; cands.push({ kind, d, obj }); };
    for (const a of g.fauna?.list || []) look(a.kind, a.mesh, 18);
    for (const b of g.fauna?.birds || []) look(b.kind, b.mesh, 36);
    for (const d of g.wildlife?.ducks || []) look('duck', d.m, 18);
    for (const h of g.wildlife?.herons || []) look('heron', h.m, 22);
    if (g.wildlife?.geese) for (const gs of [].concat(g.wildlife.geese.list || g.wildlife.geese)) look('goose', gs.m || gs.mesh || gs, 45);
    for (const b of this.beavers) look('beaver', b, 16);
    for (const o of this.owls) look('owl', o, 16);
    for (const b of this.bees) look('bee', b, 10);
    cands.sort((a, b) => a.d - b.d);
    return cands[0] || null;
  }
  photograph(w) {
    const g = this.game, e = GUIDE.find((x) => x.id === w.kind);
    if (this.shooting) return;
    // v1.14.10: you turn to it and raise the camera to your eye; a moment later the shutter goes and the polaroid
    // slides onto the screen (and into your photo album)
    const pl = g.player, at = w.obj.getWorldPosition(new THREE.Vector3());
    pl.target = null; pl.yaw = Math.atan2(at.x - pl.pos.x, at.z - pl.pos.z);
    g.myEmote = { id: 'photo', left: 1.7 }; g.netEvent?.('emote', { id: 'photo' });
    this.shooting = true;
    setTimeout(() => {
      this.shooting = false;
      const now = w.obj.getWorldPosition(new THREE.Vector3()), eye = g.actor.headWorld(new THREE.Vector3());
      const dx = now.x - eye.x, dz = now.z - eye.z, d = Math.hypot(dx, dz) || 1;
      eye.x += dx / d * 0.45; eye.z += dz / d * 0.45; eye.y += 0.05;
      now.y += 0.25;
      const flash = document.createElement('div'); flash.className = 'woods-flash'; g.ui.root.append(flash); setTimeout(() => flash.remove(), 500);
      g.audio.sfx('shutter');
      try { shoot(g, eye, now, `${g.profile.name}'s ${e.name.replace(/^./, (c) => c.toLowerCase())}`, `${regionName(pl.pos.x, pl.pos.z) || 'The woods'}  ·  ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`); } catch (err) { console.error(err); }
      this.logPhoto(w, e);
    }, 650);
  }
  logPhoto(w, e) {
    const g = this.game;
    this.change((d) => { d.guide[w.kind] = Date.now(); d.ranger.have.photo = (d.ranger.have.photo || 0) + 1; });
    g.ui.toast(`${e.name}: in your Field Guide (${Object.keys(this.d.guide).length}/${GUIDE.length}).`, { icon: 'camera', title: 'Snap!', ms: 3200 });
    g.reward('woods', `photo-${w.kind}`, { coins: 60, xp: 50 }, 'Field Guide');
    this.checkGuideSets();
    this.rangerProgress();
  }
  checkGuideSets() {
    const have = this.d.guide;
    for (const [set, S] of Object.entries(GUIDE_SETS)) {
      if (this.d.sets[set]) continue;
      if (GUIDE.filter((x) => x.set === set).every((x) => have[x.id])) { this.change((w) => { w.sets[set] = Date.now(); }); this.game.reward('woods', `guide-${set}`, S.reward, `Field Guide: ${S.name} complete`); }
    }
    if (!this.d.sets.all && GUIDE.every((x) => have[x.id])) { this.change((w) => { w.sets.all = Date.now(); }); this.game.reward('woods', 'guide-all', GUIDE_ALL, 'Field Guide complete'); }
  }

  // ---------------------------------------------------------------- the journal
  takePage(pg) {
    const g = this.game;
    this.change((w) => { w.pages[pg.id] = Date.now(); });
    this.refreshPages();
    g.audio.sfx('page');
    const n = Object.keys(this.d.pages).length;
    g.ui.toast(`"${pg.title}" (${n}/${PAGES.length}). Read it in the Valley Journal.`, { icon: 'scroll', title: 'A page of Fenn\'s journal', ms: 4200 });
    g.ui.sheets.state.journalPage = pg.id;
    g.ui.sheets.open('valleyjournal');
    if (n === PAGES.length && !this.d.pagesDone) { this.change((w) => { w.pagesDone = Date.now(); }); g.reward('woods', 'pages-all', PAGES_ALL, 'The whole of Fenn\'s journal'); }
  }

  // ---------------------------------------------------------------- Ranger Rhea
  /** Today's three tasks: the same for everyone. */
  rangerTasks() {
    const r = mulberry32((dayNo() * 31337) >>> 0), pool = RANGER_TASKS.slice(), out = [];
    while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    const R = this.d.ranger;
    if (R.day !== dayNo()) this.change((w) => { w.ranger = { day: dayNo(), have: {}, done: [] }; });
    return out.map((T) => ({ ...T, have: Math.min(T.n, this.taskHave(T)), done: this.d.ranger.done.includes(T.id) }));
  }
  taskHave(T) {
    const h = this.d.ranger.have;
    if (T.kind === 'forage') return h[T.key] || 0;
    if (T.kind === 'photo') return h.photo || 0;
    if (T.kind === 'catch') return h[`catch-${T.zone}`] || 0;
    if (T.kind === 'loop') return h.loop || 0;
    return 0;
  }
  rangerProgress() {
    if (this.d.ranger.day !== dayNo()) return;
    for (const T of this.rangerTasks()) if (!T.done && T.have >= T.n) {
      this.change((w) => { w.ranger.done = [...w.ranger.done, T.id]; });
      this.game.reward('woods', `ranger-${dayNo()}-${T.id}`, T.reward, `Ranger Rhea: ${T.text}`);
    }
  }
  onCatch(c) {
    const z = c?.zone;
    if (!z) return;
    const key = z === 'creek' ? 'catch-creek' : POOL_IDS.includes(z) ? 'catch-pool' : null;
    if (!key) return;
    if (this.d.ranger.day !== dayNo()) this.rangerTasks();
    this.change((w) => { w.ranger.have[key] = (w.ranger.have[key] || 0) + 1; });
    this.rangerProgress();
  }
  talkRhea() {
    const g = this.game, n = this.rhea, owned = g.profile.owned.includes('rod_fly');
    const tasks = this.rangerTasks();
    const list = tasks.map((T) => `${T.done ? '✓' : '·'} ${T.text} (${T.have}/${T.n})`).join('\n');
    const bye = { label: 'Thanks, Rhea' };
    const openLater = (o) => setTimeout(() => g.dialogue.open(o), 200);
    const rod = owned ? null : { label: `Buy the fly rod (${ITEMS_BY_ID.rod_fly.price.coins} coins)`, fn: () => setTimeout(() => this.buyRod(), 150) };
    g.dialogue.open({ npc: n, title: n.title, text: this.d.metRhea ? `Today's jobs:\n${list}` : RHEA.intro, choices: [
      ...(this.d.metRhea ? [] : [{ label: 'What\'s out here?', primary: true, fn: () => { this.change((w) => { w.metRhea = 1; }); openLater({ npc: n, title: n.title, text: `${RHEA.more}\n\nToday's jobs:\n${list}`, choices: [rod, bye].filter(Boolean) }); } }]),
      ...(this.d.metRhea && rod ? [rod] : []),
      { label: 'Field Guide', fn: () => setTimeout(() => g.ui.sheets.open('fieldguide'), 150) },
      bye,
    ] });
  }
  async buyRod() {
    const g = this.game, r = await g.save.buy('rod_fly');
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough yet.'); return; }
    g.audio.sfx('purchase');
    g.ui.toast('The Willowbend Fly Rod is yours. Equip it in your tackle (T) and try a creek.', { icon: 'star', ms: 5000 });
    g.pushMeta?.();
  }

  // ---------------------------------------------------------------- Old Hollis
  /** Something hidden you haven't found: a pool first, then a page. */
  hollisHint() {
    const found = this.game.ext.d.found || {};
    const pool = POOL_IDS.find((id) => !found[`pool-${id}`]);
    const where = (x, z) => { const ns = z < -60 ? 'north' : z > 60 ? 'south' : ''; const ew = x < -60 ? 'west' : x > 60 ? 'east' : ''; return `${ns}${ns && ew ? '-' : ''}${ew}` || 'middle'; };
    if (pool) { const P = POOLS[pool]; return { key: `pool-${pool}`, text: `There's a pool called ${P.name} in the ${where(P.cx, P.cz)} of the valley, off the trails. ${{ moonwell: 'Up in the western hills, in a saddle between the ridges.', foxhollow: 'Follow Hollow Brook up from Willow River and you\'ll walk right into it.', mirrortarn: 'Follow Tarn Run up from Frostrun Creek. It sits under the mesa.', lantern: 'South of the cove, between the Fern Pond trail and the big mesa. Go at night: you\'ll see why it\'s called that.' }[pool]}` }; }
    const pg = (this.pages || []).find((x) => !this.d.pages[x.id]);
    if (pg) return { key: pg.id, text: `One of Fenn's pages blew ${{ trapper: 'round his old cabin in the east woods', tower: 'right up onto the ranger\'s lookout deck', mirrortarn: 'to the shore of Mirror Tarn', moonwell: 'down by the Moonwell', dam: 'onto the bank by the beaver dam', plane: 'into Crash Clearing, by the old mail plane', hollis: 'under my own oak, if you can believe it', gate: 'over to the Ridgeback Loop\'s start gate' }[pg.at]}.` };
    return null;
  }
  talkHollis() {
    const g = this.game, n = this.hollis;
    const bye = { label: 'Goodbye, Hollis' };
    const openLater = (o) => setTimeout(() => g.dialogue.open(o), 200);
    const tea = { label: `Share some mint tea (3 mint, you have ${this.pantry('mint')})`, primary: true, fn: () => {
      if (this.pantry('mint') < 3) { openLater({ npc: n, title: n.title, text: 'Three sprigs of mint, and the kettle goes on. It grows thick by the water. Pools, creeks, lake shores.', choices: [bye] }); return; }
      const hint = this.hollisHint();
      if (!hint) { openLater({ npc: n, title: n.title, text: HOLLIS.allKnown, choices: [bye] }); return; }
      this.change((w) => { w.pantry.mint -= 3; w.hints = [...new Set([...(w.hints || []), hint.key])]; });
      g.audio.sfx('buff');
      openLater({ npc: n, title: n.title, text: `${HOLLIS.tea[Math.floor(Math.random() * HOLLIS.tea.length)]} ${hint.text}`, choices: [bye] });
    } };
    g.dialogue.open({ npc: n, title: n.title, text: this.d.metHollis ? HOLLIS.more : HOLLIS.intro, choices: this.d.metHollis ? [tea, { label: 'The Valley Journal', fn: () => setTimeout(() => g.ui.sheets.open('valleyjournal'), 150) }, bye] : [{ label: 'Tell me about the valley', primary: true, fn: () => { this.change((w) => { w.metHollis = 1; }); openLater({ npc: n, title: n.title, text: HOLLIS.more, choices: [tea, bye] }); } }, bye] });
  }

  // ---------------------------------------------------------------- Wren's wagon
  openWagon() {
    const g = this.game;
    if (!this.d.metWren) { this.change((w) => { w.metWren = 1; }); g.dialogue.open({ npc: this.wren, title: "Wren's Wagon", text: WREN.intro, choices: [{ label: 'Let\'s see what you\'ve got', primary: true, fn: () => setTimeout(() => g.ui.sheets.open('wagon'), 150) }] }); return; }
    g.ui.sheets.open('wagon');
  }
  async buyFromWagon(entry) {
    const g = this.game, it = entry.item;
    if (g.profile.owned.includes(it.id)) { g.ui.toast('You already have that.'); return false; }
    if (it.level && g.profile.level < it.level) { g.ui.toast(`Wren won't sell you that before level ${it.level}.`); return false; }
    const r = await g.save.spend('wagon', it.id, entry.price);
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough coins.'); return false; }
    await g.save.grant('wagon', it.id, { item: it.id });
    g.audio.sfx('purchase');
    g.ui.toast(`${it.name}: yours, a quarter off.`, { icon: 'shop', ms: 3000 });
    g.pushMeta?.();
    return true;
  }
  async sellPantry() {
    const g = this.game;
    let coins = 0;
    for (const k of PANTRY) coins += this.pantry(k) * FORAGE[k].sell;
    if (!coins) { g.ui.toast('Nothing to sell. Pick mushrooms, berries and mint in the woods.'); return; }
    // keep enough for one stew
    const keep = {};
    for (const [k, n] of Object.entries(STEW.need)) keep[k] = Math.min(this.pantry(k), n);
    coins = 0;
    for (const k of PANTRY) coins += Math.max(0, this.pantry(k) - (keep[k] || 0)) * FORAGE[k].sell;
    if (!coins) { g.ui.toast('Wren leaves you enough for one stew. Pick some more first.'); return; }
    this.change((w) => { for (const k of PANTRY) w.pantry[k] = keep[k] || 0; });
    await g.reward('woods', `sell-${Date.now()}`, { coins }, "Sold to Wren's Wagon");
  }

  // ---------------------------------------------------------------- camps
  canCampHere() {
    const p = this.game.player.pos;
    if (this._campT && performance.now() - this._campT.t < 400 && Math.hypot(this._campT.x - p.x, this._campT.z - p.z) < 0.5) return this._campT.ok;
    const ok = campable(p.x, p.z, trailDist, isWater, (x, z) => [...this.camps.values()].some((c) => Math.hypot(c.x - x, c.z - z) < 10));
    this._campT = { t: performance.now(), x: p.x, z: p.z, ok };
    return ok;
  }
  pitchCamp() {
    const g = this.game, pl = g.player;
    const yaw = pl.yaw, x = pl.pos.x + Math.sin(yaw) * 2.2, z = pl.pos.z + Math.cos(yaw) * 2.2;
    this.change((w) => { w.camp = { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, yaw: Math.round(yaw * 100) / 100 }; w.camps = (w.camps || 0) + 1; });
    g.audio.sfx('place');
    g.ui.toast('Camp pitched. Friends can see it and roast fish at your fire. Pack it up any time (E at the tent).', { icon: 'flame', ms: 4200 });
    g.pushMeta?.();
    this.renderCamps();
  }
  packCamp() { this.change((w) => { w.camp = null; }); this.game.audio.sfx('pop'); this.game.pushMeta?.(); this.renderCamps(); }
  /** The field in your presence that says where your camp is. */
  meta() { const c = this.d.camp; return c ? { cp: [c.x, c.z, c.yaw] } : {}; }
  /** All camps you can see: yours and everyone else's (from their presence). */
  campList() {
    const out = [];
    if (this.d.camp) out.push({ id: 'me', ...this.d.camp, name: 'Your camp' });
    for (const r of this.game.remotes?.list?.values() || []) {
      const cp = r.peer.meta?.cp;
      if (!Array.isArray(cp) || cp.length < 3) continue;
      const [x, z, yaw] = cp.map(Number);
      if (![x, z, yaw].every(Number.isFinite) || Math.abs(x) > HALF || Math.abs(z) > HALF) continue;
      out.push({ id: r.id, x, z, yaw, name: `${String(r.peer.meta?.name || 'Someone').slice(0, 20)}'s camp` });
    }
    return out;
  }
  renderCamps() {
    const p = this.game.player.pos, want = this.campList().filter((c) => Math.hypot(c.x - p.x, c.z - p.z) < 90).slice(0, 8), keep = new Set();
    for (const c of want) {
      const key = `${c.id}|${c.x}|${c.z}`;
      keep.add(key);
      if (!this.camps.has(key)) { const grp = buildCamp(c); this.game.engine.scene.add(grp); this.camps.set(key, { group: grp, x: c.x, z: c.z, fire: grp.userData.fire, name: c.name }); }
    }
    for (const [key, c] of this.camps) if (!keep.has(key)) { this.game.engine.scene.remove(c.group); this.camps.delete(key); }
  }
  /** A camp's fire you're standing by (cookout.js uses it to roast fish and cook stew). */
  campFireNear(r = 2.6) {
    const p = this.game.player.pos;
    for (const c of this.camps.values()) if (Math.hypot(c.fire.x - p.x, c.fire.z - p.z) < r) return c.fire;
    return null;
  }

  // ---------------------------------------------------------------- the Ridgeback Loop
  updateLap(dt) {
    const g = this.game, b = g.bikes, pl = g.player, p = pl.pos;
    // jumps: a dirt kicker throws you up if you hit it fast
    if (b?.riding && !pl.airborne && Math.abs(b.v) > 5) {
      for (const J of WOODS.jumps) {
        const dx = p.x - J.x, dz = p.z - J.z, along = dx * J.ux + dz * J.uz, side = -dx * J.uz + dz * J.ux;
        if (Math.abs(side) < 1.2 && along > 0.2 && along < 0.9 && (Math.sin(pl.yaw) * J.ux + Math.cos(pl.yaw) * J.uz) > 0.5) { pl.vy = 3.4 + Math.min(3, (Math.abs(b.v) - 5) * 0.6); g.audio.sfx('whoosh'); this.change((w) => { w.jumps = (w.jumps || 0) + 1; }); break; }
      }
    }
    const gate = WOODS.gate, crossing = (P, r = 3.2) => Math.hypot(p.x - P.x, p.z - P.z) < r;
    if (!b?.riding) { if (this.lap) this.endLap(false); return; }
    if (!this.lap) {
      if (crossing(gate) && !this.atGate) { this.lap = { t0: performance.now(), next: 0 }; g.audio.sfx('toggle'); g.ui.toast('Lap started! Through all six arches in order, then back through the gate.', { icon: 'bike', ms: 2600 }); this.lapHud(); }
      this.atGate = crossing(gate, 4.5);
      return;
    }
    this.atGate = this.atGate && crossing(gate, 4.5);
    const L = this.lap, A = WOODS.arches[L.next];
    if (A && crossing(A, 3.4)) { L.next++; g.audio.sfx('click'); }
    if (!A && crossing(gate) && !this.atGate) { this.endLap(true); this.atGate = true; return; }
    if (performance.now() - L.t0 > 600000) this.endLap(false);
    this.lapHud();
  }
  lapHud() {
    const g = this.game;
    if (!this.lap) { this.hud?.remove(); this.hud = null; return; }
    if (!this.hud) { this.hud = document.createElement('div'); this.hud.className = 'loop-hud'; g.ui.root.append(this.hud); }
    const s = (performance.now() - this.lap.t0) / 1000;
    this.hud.textContent = `Ridgeback Loop  ${fmtTime(s)}  ·  arch ${Math.min(6, this.lap.next)}/6${this.d.loopBest ? `  ·  best ${fmtTime(this.d.loopBest)}` : ''}`;
  }
  async endLap(finished) {
    const g = this.game, L = this.lap;
    this.lap = null; this.lapHud();
    if (!finished || !L) return;
    const secs = Math.round((performance.now() - L.t0) / 100) / 10;
    const best = this.d.loopBest || 0, pb = !best || secs < best;
    this.change((w) => { if (pb) w.loopBest = secs; w.laps = (w.laps || 0) + 1; w.ranger.have.loop = (w.ranger.have.loop || 0) + 1; });
    g.audio.sfx(pb ? 'achievement' : 'coin');
    g.ui.toast(`${fmtTime(secs)}${pb ? (best ? `: a new personal best (was ${fmtTime(best)})!` : ': your first lap!') : `. Best: ${fmtTime(best)}.`}`, { icon: 'bike', title: 'Ridgeback Loop', ms: 4500 });
    if (pb) {
      const wk = weekNo(), uid = g.save.userId || g.profile.name;
      const mine = this.board.find((x) => x.id === `${wk}:${uid}`);
      if (!mine || secs < mine.t) g.shared.set('loop', `${wk}:${uid}`.slice(0, 120), { w: wk, t: secs, name: String(g.profile.name || 'Angler').slice(0, 20), at: Date.now() });
    }
    if (!this.d.firstLapReward) { this.change((w) => { w.firstLapReward = 1; }); g.reward('woods', 'first-lap', { coins: 250, xp: 200 }, 'Your first lap of the Ridgeback Loop'); }
    this.rangerProgress();
  }
  watchBoard() {
    this.board = [];
    try { this.unsub = this.game.shared.watch('loop', (docs) => { const wk = weekNo(); this.board = docs.filter((d) => Number(d.w) === wk && Number(d.t) > 20 && Number(d.t) < 600).map((d) => ({ id: d.id, t: Number(d.t), name: String(d.name || 'Someone').slice(0, 20) })).sort((a, b) => a.t - b.t).slice(0, 10); if (this.game.ui.sheets.current?.name === 'loop') this.game.ui.sheets.refresh(); }); } catch { /* no shared store: personal best only */ }
  }
}

export function fmtTime(s) { const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; }

/** A camp (v1.14.10: Blender-built, art/src/camp.py): the tent, a fire ring with a tripod and pot, two chairs by the
 *  fire, a woodpile with a chopping block, a cooler and a pack. The flames flicker (the game's own); no real light. */
function buildCamp(c) {
  const g = new THREE.Group();
  const y = groundY(c.x, c.z) ?? surfaceY(c.x, c.z);
  g.position.set(c.x, y, c.z); g.rotation.y = c.yaw;
  const put = (name, x, z, ry = 0) => { const n = buildNode(CAMP_MATS, CAMP_NODES, name, { shadow: true }); n.position.set(x, 0, z); n.rotation.y = ry; g.add(n); return n; };
  const FX = 1.1; // the fire, in front of the tent and to one side
  put('camp_tent', -1.5, -0.7, Math.atan2(FX + 1.5, 0.7) * 0.5 + 0.25);
  put('camp_fire', FX, 0, 0.4);
  put('camp_chair', FX - 1.25, 0.95, Math.atan2(1.25, -0.95));
  put('camp_chair_red', FX + 1.2, 0.85, Math.atan2(-1.2, -0.85));
  put('camp_woodpile', -0.2, -2.1, 0.2);
  put('camp_cooler', -2.9, 0.9, 0.9);
  const flame = new THREE.MeshBasicMaterial({ color: '#ffb040' }), flame2 = new THREE.MeshBasicMaterial({ color: '#ff6a20' }), flame3 = new THREE.MeshBasicMaterial({ color: '#fff0a0' });
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 6), flame); f1.position.set(FX, 0.36, 0); g.add(f1);
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 5), flame2); f2.position.set(FX + 0.07, 0.42, 0.06); g.add(f2);
  const f3 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), flame3); f3.position.set(FX - 0.05, 0.3, -0.04); g.add(f3);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.7, 16), new THREE.MeshBasicMaterial({ color: '#ffb060', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })); glow.rotation.x = -Math.PI / 2; glow.position.set(FX, 0.04, 0); g.add(glow); // (no real light: a light per camp would cost every material a recompile)
  const live = new Set([f1, f2, f3, glow]);
  const baked = bakeLoose(g, (o) => live.has(o));
  baked.position.copy(g.position); baked.rotation.copy(g.rotation);
  baked.userData.flames = baked.children.filter((o) => o.material === flame || o.material === flame2 || o.material === flame3);
  baked.userData.glow = baked.children.find((o) => o.geometry?.type === 'CircleGeometry');
  baked.userData.fire = { x: c.x + Math.cos(c.yaw) * FX, z: c.z - Math.sin(c.yaw) * FX };
  return baked;
}
