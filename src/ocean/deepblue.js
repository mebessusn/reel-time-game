// v1.15.19 Open Waters: Deep Blue. Ten new things to find out at sea.
//   Coralhaven     a sunken village on a bank 17 m down: coral cottages, lamps, air domes to breathe in, Shelly's trading
//                  post (a pearl for three sea glass, and five lost pearls to find) and Old Finn (pays more for deep fish)
//   Weed mats      drifting sargassum: cast against one and the mahi and tripletail come up from under it
//   Flotsam        things that fell off ships, bobbing in loose fields: hook them from the deck as you pass
//   Islets         Gull Rock (sea lions and gulls), Lone Palm, and the Sandbar (clams at low tide); swim ashore
//   The Marigold   a freighter wreck on a bank 18 m down: morays in her portholes, a strongbox in her hold
//   Ships          a trawler with gulls in her wake, a sailing race going by, and on foggy nights the Lantern Mary
//   Channel Light  a buoy-light platform with Ida the keeper: tie up, climb on, buy pots and longlines
//   Pots and lines set them from the boat; haul them up next trip
//   The chart      fills in where the boat has been; a logbook of every place found, each with a reward
//   Emberkey       a young volcano: black sand, steam, a glowing crater, and its own fish in the warm water
// Everything the crew should see the same (the drifting mats, the ships, the flotsam) comes from the clock and the
// charter's id, so it costs no network traffic.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WATER_Y } from '../world/terrain.js';
import { addCircle } from '../world/colliders.js';
import { Actor } from '../game/actor.js';
import { defaultAvatar } from '../data/avatarOptions.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { Coralhaven } from './coralhaven.js';
import { eligibleSpecies, rollWeight, catchValue } from '../game/rules.js';
import { buildFauna } from '../world/fauna.js';
import { OCEAN, ISLETS, ISLET_BY_ID, BANK_BY_ID, ISLAND_BY_ID, CHANNEL, DOCKS, SPOT_BY_ID, oceanSurfaceY, oceanZoneAt, inOcean } from './geo.js';
import { oceanWave } from './waves.js';
import { buildNode } from './meshes.js';
import { ISLAND_MATS, ISLAND_NODES } from '../data/islandMesh.js';
import { ISLEPROP_MATS, ISLEPROP_NODES } from '../data/islePropsMesh.js';
import { WRECK_MATS, WRECK_NODES } from '../data/wreckMesh.js';
import { TREASURE_MATS, TREASURE_NODES } from '../data/treasureMesh.js';
import { REEF_MATS, REEF_NODES } from '../data/reefMesh.js';
import { applyCaustics } from '../world/caustics.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { fishThumb } from '../ui/thumbs.js';
import { mulberry32 } from '../core/rng.js';
import { DISCOVERIES, FLOTSAM, SHELLY, FINN, IDA, CLAMS, STRONGBOX, PEARLS_QUEST, SEA_GEAR, SEA_GEAR_MAX, CHART_REVEAL } from './deepblueData.js';

const M = new Map();
const mat = (color, o = {}) => { const k = `${color}|${o.emissive || ''}|${o.opacity ?? ''}`; if (!M.has(k)) M.set(k, new THREE.MeshLambertMaterial({ color, flatShading: true, ...o, ...(o.opacity != null ? { transparent: true, depthWrite: false } : {}) })); return M.get(k); };
const jit = (i, k = 1) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
const L = (lx, lz) => ({ x: OCEAN.x + lx, z: OCEAN.z + lz });
const DAY = 86400000;
const dayNo = () => Math.floor(Date.now() / DAY);
const look = (o) => ({ ...defaultAvatar(o.gender || 'female'), ...o });

/** Merge a group's meshes into one mesh per material (in the group's own space). keep(o): leave that one separate. */
function bake(group, keep = () => false) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), buckets = new Map(), out = new THREE.Group();
  out.position.copy(group.position); out.rotation.copy(group.rotation); out.name = group.name;
  group.traverse((o) => {
    if (!o.isMesh) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    if (keep(o)) { const c = o.clone(); c.matrixAutoUpdate = true; rel.decompose(c.position, c.quaternion, c.scale); out.add(c); return; }
    const g = o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); }
    g.applyMatrix4(rel);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
  });
  for (const [m, geos] of buckets) { const merged = mergeGeometries(geos, false); if (!merged) continue; merged.computeBoundingSphere(); const mesh = new THREE.Mesh(merged, m); mesh.castShadow = true; mesh.receiveShadow = true; out.add(mesh); }
  return out;
}
const mesh = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); if (s !== 1) o.scale.setScalar(s); return o; };
const nodeInto = (parent, MATS, NODES, name, x, y, z, ry = 0, s = 1) => { const n = buildNode(MATS, NODES, name, { shadow: false }); n.position.set(x, y, z); n.rotation.y = ry; n.scale.setScalar(s); parent.add(n); return n; };

export class DeepBlue {
  constructor(game, ow) {
    this.game = game; this.ow = ow;
    this.built = false;
    this.people = [];
    this.buoys = new Map();
  }
  get d() { const o = this.game.ext.d.ocean || {}; return o; }
  change(fn) { this.game.ext.change((d) => { d.ocean.deep = d.ocean.deep || {}; fn(d.ocean.deep, d.ocean); }); }
  get dd() { return this.d.deep || {}; }

  // ---------------------------------------------------------------- building (with the islands, on the first trip)
  build() {
    if (this.built || !this.ow.islands.built) return;
    this.built = true;
    const scene = this.game.engine.scene;
    this.root = new THREE.Group(); this.root.name = 'deep-blue'; scene.add(this.root);
    this.sites = [];
    const put = (obj, x, z, r) => { this.root.add(obj); this.sites.push({ obj, x, z, r }); return obj; };
    this.town = new Coralhaven(this.game, this.ow, this); // v1.15.20: a town you go inside (coralhaven.js)
    put(this.town.buildExterior(), BANK_BY_ID.coralhaven.x, BANK_BY_ID.coralhaven.z, 180);
    this.pearls = this.town.pearls;
    put(this.buildMarigold(), BANK_BY_ID.marigold.x, BANK_BY_ID.marigold.z, 160);
    for (const T of ISLETS) put(this.buildIslet(T), T.x, T.z, 260);
    put(this.buildChannel(), CHANNEL.c.x, CHANNEL.c.z, 400);
    put(this.buildEmber(), ISLAND_BY_ID.ember.x, ISLAND_BY_ID.ember.z, 600);
    this.buildMats();
    this.buildShips();
    this.buildFlotsamMeshes();
  }

  person(name, title, avatar, x, y, z, yaw) {
    const actor = new Actor(this.game.engine.scene);
    actor.setLook(avatar, { rod: 'rod_bamboo', lure: 'lure_classic', boat: 'boat_oak' });
    actor.root.visible = false;
    const p = { name, title, actor, pos: new THREE.Vector3(x, y, z), yaw, face: yaw };
    this.people.push(p);
    return p;
  }

  // ---- the Marigold
  buildMarigold() {
    const B = BANK_BY_ID.marigold, g = new THREE.Group(); g.name = 'marigold';
    g.position.set(B.x, 0, B.z);
    const fy = (lx, lz) => oceanSurfaceY(B.x + lx, B.z + lz);
    nodeInto(g, WRECK_MATS, WRECK_NODES, 'wreck_bow', 6, fy(6, 0) - 0.6, 0, 0.5, 1.45);
    nodeInto(g, WRECK_MATS, WRECK_NODES, 'wreck_stern', -7, fy(-7, 2) - 0.8, 2, 0.2, 1.45);
    nodeInto(g, WRECK_MATS, WRECK_NODES, 'wreck_mast', 1, fy(1, -6) - 0.2, -6, 1.3, 1.3);
    // the hold: a strongbox in the sand between the two halves
    const chest = new THREE.Group(); chest.position.set(-0.5, fy(-0.5, 1) + 0.05, 1); chest.rotation.y = 0.4;
    nodeInto(chest, TREASURE_MATS, TREASURE_NODES, 'chest_base', 0, 0, 0, 0, 1.2); nodeInto(chest, TREASURE_MATS, TREASURE_NODES, 'chest_lid', 0, 0, 0, 0, 1.2);
    g.add(chest);
    this.strongbox = { x: B.x - 0.5, y: chest.position.y, z: B.z + 1 };
    // a name board half buried, and coral starting to take her
    g.add(mesh(new THREE.BoxGeometry(3.4, 0.7, 0.15), mat('#2a3a4a'), 9, fy(9, -3) + 0.3, -3, -0.9, 0.4, 0.1));
    g.add(mesh(new THREE.BoxGeometry(2.8, 0.4, 0.17), mat('#d8b040'), 9, fy(9, -3) + 0.33, -3, -0.9, 0.4, 0.1));
    const r = mulberry32(919), kinds = ['reef_fan', 'reef_sponge', 'reef_kelp', 'reef_anemone', 'reef_branch'];
    for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, d = 10 + r() * 16, x = Math.cos(a) * d, z = Math.sin(a) * d; nodeInto(g, REEF_MATS, REEF_NODES, kinds[i % kinds.length], x, fy(x, z) - 0.05, z, r() * 6.28, 0.8 + r()); }
    return bake(g);
  }

  // ---- islets
  buildIslet(T) {
    const g = new THREE.Group(); g.name = `islet-${T.id}`; g.position.set(T.x, 0, T.z);
    const fy = (lx, lz) => Math.max(WATER_Y - 0.3, oceanSurfaceY(T.x + lx, T.z + lz));
    const r = mulberry32(T.seed * 31);
    // the islet's own ground (the islands' painted ground only covers the big islands)
    const S = 1, R = Math.max(T.r, T.rz) * 1.8, N = Math.ceil(R * 2 / S) + 1, pos = [], col = [], idx = [];
    const sand = new THREE.Color(T.rocky ? '#8a8478' : '#e8d8a8'), wet = new THREE.Color('#b8a87a'), bed = new THREE.Color('#d8caa0'), grass = new THREE.Color('#6a9a4a');
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = -R + i * S, z = -R + j * S, y = oceanSurfaceY(T.x + x, T.z + z);
      pos.push(x, y, z);
      const c = y < WATER_Y - 0.1 ? bed : y < WATER_Y + 0.25 ? wet : (!T.rocky && !T.flat && y > WATER_Y + 0.9 ? grass : sand);
      col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) { const a = i * N + j, b = (i + 1) * N + j; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true }); applyCaustics(groundMat);
    const ground = new THREE.Mesh(geo, groundMat); ground.receiveShadow = true;
    if (T.rocky) { // Gull Rock: a jumble of rocks, sea lions basking, gulls overhead
      for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = r() * T.r * 0.8, x = Math.cos(a) * d, z = Math.sin(a) * d; nodeInto(g, ISLAND_MATS, ISLAND_NODES, ['isle_rock_a', 'isle_rock_b', 'isle_rock_c'][i % 3], x, fy(x, z) - 0.4, z, r() * 6.28, 0.6 + r() * 0.7); }
      this.sealions = [];
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + 0.4, d = T.r * (0.4 + (i % 2) * 0.3), x = Math.cos(a) * d, z = Math.sin(a) * d, y = fy(x, z);
        const sl = new THREE.Group(); sl.position.set(x, y + 0.15, z); sl.rotation.y = a + 1.4;
        sl.add(mesh(new THREE.CapsuleGeometry(0.32, 1.2, 4, 8), mat('#5a4a3e'), 0, 0.2, 0, 0, 0, Math.PI / 2));
        const head = mesh(new THREE.SphereGeometry(0.24, 8, 6), mat('#4a3e34'), 0.85, 0.42, 0); sl.add(head); sl.userData.head = head;
        sl.add(mesh(new THREE.BoxGeometry(0.4, 0.05, 0.5), mat('#3a302a'), -0.8, 0.05, 0, 0, 0, 0.2));
        g.add(sl); this.sealions.push(sl);
      }
      this.gulls = [];
      for (let i = 0; i < 6; i++) { const m = buildFauna('gull', false); if (!m) continue; m.scale.setScalar(1.1); this.game.engine.scene.add(m); this.gulls.push({ m, R: 8 + i * 2, h: 6 + i, w: 0.4 + i * 0.05, a: i }); }
    } else if (T.flat) { // the Sandbar: shells, and clam holes that show at low tide
      for (let i = 0; i < 6; i++) { const x = (r() - 0.5) * T.r * 1.6, z = (r() - 0.5) * T.rz; nodeInto(g, ISLEPROP_MATS, ISLEPROP_NODES, 'isle_shells', x, fy(x, z), z, r() * 6.28, 0.9); }
      this.clams = Array.from({ length: 8 }, (_, i) => { const x = (jit(i, 3) - 0.5) * T.r * 1.5, z = (jit(i, 5) - 0.5) * T.rz * 1.2; return { i, x: T.x + x, z: T.z + z, y: fy(x, z) }; });
    } else { // Lone Palm
      nodeInto(g, ISLAND_MATS, ISLAND_NODES, 'isle_palm_b', 0.5, fy(0.5, 0.2) - 0.05, 0.2, 0.6, 1.2);
      nodeInto(g, ISLEPROP_MATS, ISLEPROP_NODES, 'isle_coconuts', 1.6, fy(1.6, 0.8), 0.8, 1.2, 1);
      nodeInto(g, ISLEPROP_MATS, ISLEPROP_NODES, 'isle_shells', -2, fy(-2, 1.5), 1.5, 0.4, 1);
      nodeInto(g, ISLEPROP_MATS, ISLEPROP_NODES, 'isle_driftwood', -1.5, fy(-1.5, -2), -2, 2.1, 1);
      addCircle(T.x + 0.5, T.z + 0.2, 0.35);
    }
    const out = bake(g); // (the sea lions bask: they don't need to move)
    out.add(ground);
    return out;
  }

  // ---- Channel Light
  buildChannel() {
    const C = CHANNEL, g = new THREE.Group(); g.name = 'channel-light';
    g.position.set(C.c.x, 0, C.c.z); g.rotation.y = Math.atan2(C.ux, C.uz);
    const deck = mat('#8a7458'), deckD = mat('#6a5640'), iron = mat('#5a6268'), rust = mat('#9a5a3a'), red = mat('#c03a2a'), white = mat('#ece6da');
    const floor = oceanSurfaceY(C.c.x, C.c.z), top = C.y;
    // deck on piles (local: z along the platform's length, x across)
    g.add(mesh(new THREE.BoxGeometry(C.w, 0.3, C.len), deck, 0, top - 0.15, 0));
    for (let i = 0; i < 9; i++) g.add(mesh(new THREE.BoxGeometry(C.w, 0.05, 0.08), deckD, 0, top + 0.01, -C.len / 2 + 0.7 + i * 1.33));
    for (const [x, z] of [[-C.w / 2 + 0.4, -C.len / 2 + 0.4], [C.w / 2 - 0.4, -C.len / 2 + 0.4], [-C.w / 2 + 0.4, C.len / 2 - 0.4], [C.w / 2 - 0.4, C.len / 2 - 0.4], [0, -C.len / 2 + 0.4], [0, C.len / 2 - 0.4]]) {
      const hgt = top - floor;
      g.add(mesh(new THREE.CylinderGeometry(0.28, 0.32, hgt, 8), iron, x, floor + hgt / 2, z));
      g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.6, 8), rust, x, WATER_Y, z));
    }
    // railings round three sides (the boat comes alongside the fourth)
    for (const sx of [-1]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.08, C.len), iron, sx * (C.w / 2 - 0.1), top + 1, 0));
    for (const sz of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(C.w, 0.08, 0.08), iron, 0, top + 1, sz * (C.len / 2 - 0.1)));
    // the keeper's hut, the light tower, barrels and a stack of pots
    nodeInto(g, ISLAND_MATS, ISLAND_NODES, 'isle_hut', -2.6, top, -3.4, Math.PI / 2, 0.5);
    for (const [x, z] of [[1.2, 3.4], [2.0, 3.6]]) g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10), rust, x, top + 0.45, z));
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(0.9, 0.5, 0.7), mat('#5a7a8a'), -2.6 + i * 0.1, top + 0.25 + i * 0.5, 3.4));
    const tx = 2.2, tz = -3.4, tower = 8;
    for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) g.add(mesh(new THREE.BoxGeometry(0.14, tower, 0.14), (x + z) > 0 ? red : white, tx + x * (1 - 0.3), top + tower / 2, tz + z * (1 - 0.3), z * 0.04, 0, -x * 0.04));
    for (let k = 1; k < 4; k++) g.add(mesh(new THREE.BoxGeometry(1.3, 0.1, 1.3), k % 2 ? red : white, tx, top + (k / 4) * tower, tz));
    g.add(mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 10), iron, tx, top + tower, tz));
    const lamp = mesh(new THREE.IcosahedronGeometry(0.42, 1), mat('#fff4c0', { emissive: '#000000' }), tx, top + tower + 0.5, tz); lamp.name = 'lamp';
    g.add(lamp);
    g.add(mesh(new THREE.ConeGeometry(0.7, 0.6, 8), red, tx, top + tower + 1.1, tz));
    const out = bake(g, (o) => o.name === 'lamp');
    this.lamp = out.children.find((o) => o.name === 'lamp');
    this.lamp.material = this.lamp.material.clone();
    // Ida, by the hut
    const w = (lx, lz) => ({ x: C.c.x + lx * Math.cos(g.rotation.y) + lz * Math.sin(g.rotation.y), z: C.c.z - lx * Math.sin(g.rotation.y) + lz * Math.cos(g.rotation.y) });
    const ip = w(-0.6, -1.2);
    this.ida = this.person('Ida', 'Keeper of the Channel Light', look({ gender: 'female', skin: 2, height: 'short', hair: 'bob', hairColor: 9, eyes: 'focused', brows: 'straight', mouth: 'smile', hat: 'beanie', hatColor: 1, shirt: 'raincoat', shirtColor: 5, pants: 'waders', pantsColor: 2, shoes: 'boots', accessory: 'none' }), ip.x, top, ip.z, g.rotation.y + Math.PI / 2);
    return out;
  }

  // ---- Emberkey
  buildEmber() {
    const I = ISLAND_BY_ID.ember, g = new THREE.Group(); g.name = 'emberkey'; g.position.set(I.x, 0, I.z);
    const top = oceanSurfaceY(I.x, I.z);
    // the crater floor glows: a pool of lava with a crust of cooling rock
    g.add(mesh(new THREE.CircleGeometry(I.r * 0.13, 20), mat('#ff6a1a', { emissive: '#ff4a0a' }), 0, top + 0.2, 0, -Math.PI / 2, 0, 0));
    for (let i = 0; i < 9; i++) { const a = jit(i, 2) * 6.28, d = jit(i, 4) * I.r * 0.1; g.add(mesh(new THREE.DodecahedronGeometry(0.6 + jit(i) * 0.6, 0), mat('#2a2220'), Math.cos(a) * d, top + 0.25, Math.sin(a) * d, jit(i, 5), jit(i, 6), 0)); }
    // black boulders down the slopes
    const r = mulberry32(71);
    for (let i = 0; i < 26; i++) { const a = r() * 6.28, e = 0.35 + r() * 0.6, x = Math.cos(a) * I.r * e, z = Math.sin(a) * I.rz * e, y = oceanSurfaceY(I.x + x, I.z + z); if (y < WATER_Y + 0.4) continue; g.add(mesh(new THREE.DodecahedronGeometry(0.5 + r() * 1.2, 0), mat(i % 2 ? '#2e2a28' : '#3e3632'), x, y - 0.1, z, r(), r(), r())); }
    const out = bake(g);
    // steam: puffs rising from vents on the slopes and a plume from the crater (sprites, recycled)
    const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    this.steam = [];
    const vents = [[0, 0, top + 0.5, 3.2]];
    for (let i = 0; i < 5; i++) { const a = i * 1.25 + 0.4, e = 0.5 + (i % 2) * 0.15, x = Math.cos(a) * I.r * e, z = Math.sin(a) * I.rz * e; vents.push([x, z, oceanSurfaceY(I.x + x, I.z + z) + 0.2, 1]); }
    this.vents = vents.map(([x, z, y, s]) => ({ x: I.x + x, y, z: I.z + z, s }));
    for (const V of this.vents) for (let k = 0; k < (V.s > 2 ? 6 : 2); k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: V.s > 2 ? '#b8a8a0' : '#f0f0f0', transparent: true, opacity: 0, depthWrite: false }));
      sp.userData = { V, ph: k / (V.s > 2 ? 6 : 2) };
      this.root.add(sp); this.steam.push(sp);
    }
    return out;
  }

  // ---- drifting weed mats
  buildMats() {
    const parts = [], r = mulberry32(3301), c1 = new THREE.Color('#9a8a2a'), c2 = new THREE.Color('#c8a83a');
    for (let k = 0; k < 14; k++) { const a = r() * 6.28, d = r() * 3.2, s = 0.8 + r() * 1.6; const g = new THREE.CircleGeometry(s, 6); g.rotateX(-Math.PI / 2); g.translate(Math.cos(a) * d, 0.02 + k * 0.002, Math.sin(a) * d); const n = g.attributes.position.count, col = new Float32Array(n * 3), c = k % 3 ? c1 : c2; for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv'); parts.push(g); }
    const geo = mergeGeometries(parts, false);
    this.mats = [];
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const homes = [[-40, 120, 60], [-90, 160, 40], [20, 80, 50], [60, 160, 40], [-150, 40, 50], [150, -60, 60], [-260, 120, 50], [300, 120, 60], [-30, -230, 50], [200, 380, 40], [-200, 430, 40], [380, -200, 40]];
    homes.forEach(([lx, lz, R], i) => {
      const mm = new THREE.Mesh(geo, m); mm.receiveShadow = true; mm.scale.set(1 + (i % 3) * 0.3, 1, 1 + ((i + 1) % 3) * 0.25);
      this.root.add(mm);
      this.mats.push({ mesh: mm, home: L(lx, lz), R, w: 0.002 + (i % 4) * 0.0007, ph: i * 1.7 });
    });
  }
  matPos(M, t = Date.now() / 1000) { const a = t * M.w + M.ph; return { x: M.home.x + Math.cos(a) * M.R, z: M.home.z + Math.sin(a * 0.8) * M.R * 0.7 }; }

  // ---- ships on the horizon
  buildShips() {
    const hull = (len, w, c) => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(w, 1.6, len), mat(c), 0, 0.4, 0)); g.add(mesh(new THREE.ConeGeometry(w * 0.72, 3, 4), mat(c), 0, 0.4, len / 2 + 1.2, Math.PI / 2, Math.PI / 4, 0)); return g; };
    // the trawler: red hull, white wheelhouse, booms, and gulls following
    const tr = hull(16, 4.4, '#9a2a24');
    tr.add(mesh(new THREE.BoxGeometry(3.2, 2.4, 3.6), mat('#ece6da'), 0, 2.3, -2));
    tr.add(mesh(new THREE.BoxGeometry(0.2, 7, 0.2), mat('#3a3a3a'), 0, 4.5, 2));
    for (const s of [-1, 1]) tr.add(mesh(new THREE.BoxGeometry(0.15, 0.15, 7), mat('#3a3a3a'), s * 1.5, 5.5, 2, 0.5, 0, s * 0.6));
    this.trawler = bake(tr); this.root.add(this.trawler);
    this.trawlerGulls = [];
    for (let i = 0; i < 7; i++) { const m = buildFauna('gull', false); if (!m) continue; m.scale.setScalar(1.2); this.root.add(m); this.trawlerGulls.push({ m, ph: i * 0.9, R: 5 + i * 1.3, h: 5 + (i % 3) * 2 }); }
    // the sailing race: three sloops in company
    this.sloops = [0, 1, 2].map((i) => {
      const s = hull(8, 2.4, ['#ece6da', '#2a4a7a', '#c8a040'][i]);
      const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.2, -2.5, 0, 10, 0.5, 0, 1.2, 3], 3)); sail.computeVertexNormals();
      s.add(new THREE.Mesh(sail, new THREE.MeshLambertMaterial({ color: '#f8f4ea', side: THREE.DoubleSide })));
      s.add(mesh(new THREE.BoxGeometry(0.15, 10, 0.15), mat('#5a4a3a'), 0, 5.6, 0.4));
      const b = bake(s); this.root.add(b); return b;
    });
    // the Lantern Mary: a dark old ship with tattered sails and a green lantern, only on foggy nights
    const gh = hull(20, 5, '#1e2422');
    for (const z of [-4, 3]) { gh.add(mesh(new THREE.BoxGeometry(0.3, 13, 0.3), mat('#2a2e2c'), 0, 7, z)); gh.add(mesh(new THREE.PlaneGeometry(7, 6, 1, 1), mat('#9aa8a0', { opacity: 0.45 }), 0, 8, z + 0.3, 0, Math.PI / 2, 0.08)); }
    gh.add(mesh(new THREE.SphereGeometry(0.5, 8, 6), mat('#9affb0', { emissive: '#3aff6a' }), 0, 3.4, 9));
    this.ghost = bake(gh, (o) => o.material?.opacity != null && o.material.transparent);
    this.ghost.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.userData.base = o.material.opacity ?? 1; } });
    this.root.add(this.ghost);
  }

  // ---- flotsam meshes (one set, re-placed per field)
  buildFlotsamMeshes() {
    this.flot = [];
    const proto = {
      crate: () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), mat('#8a6a40'))); g.add(mesh(new THREE.BoxGeometry(0.95, 0.1, 0.95), mat('#5e4128'), 0, 0.2, 0)); return g; },
      barrel: () => { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.0, 10), mat('#7a4a2a'), 0, 0, 0, Math.PI / 2, 0, 0.3)); for (const k of [-0.3, 0.3]) g.add(mesh(new THREE.TorusGeometry(0.41, 0.04, 4, 12), mat('#4a4a4a'), k * Math.cos(0.3), k * Math.sin(0.3), 0, 0, Math.PI / 2, 0)); return g; },
      float: () => { const g = new THREE.Group(); g.add(mesh(new THREE.SphereGeometry(0.35, 10, 8), mat('#5ab0a0', { opacity: 0.75 }))); g.add(mesh(new THREE.TorusGeometry(0.36, 0.04, 4, 12), mat('#c8b088'), 0, 0, 0, Math.PI / 2, 0, 0)); return g; },
      bottle: () => { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.45, 8), mat('#6ab08a', { opacity: 0.7 }), 0, 0, 0, Math.PI / 2, 0, 0)); g.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 6), mat('#8a6a40'), 0, 0, 0.3, Math.PI / 2, 0, 0)); return g; },
      chest: () => { const g = new THREE.Group(); nodeInto(g, TREASURE_MATS, TREASURE_NODES, 'chest_base', 0, -0.25, 0, 0, 0.8); nodeInto(g, TREASURE_MATS, TREASURE_NODES, 'chest_lid', 0, -0.25, 0, 0, 0.8); return g; },
    };
    this.flotProto = proto;
  }

  // ---------------------------------------------------------------- flotsam fields (per trip, the same for the crew)
  /** This trip's flotsam: five fields of a few pieces each, placed from the charter's id. */
  flotsamFor(c) {
    if (!c) return [];
    if (this.flotFor === c.id) return this.flotItems;
    let seed = 0; for (const ch of c.id) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
    const r = mulberry32(seed >>> 0), items = [];
    for (let f = 0; f < 5; f++) {
      let cx = 0, cz = 0;
      for (let k = 0; k < 40; k++) { const a = r() * 6.28, d = 120 + r() * 360; cx = OCEAN.x + Math.cos(a) * d; cz = OCEAN.z + Math.sin(a) * d; if (oceanSurfaceY(cx, cz) < -10 && oceanZoneAt(cx, cz) !== 'shore') break; }
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        let x = r() * 100; const tot = FLOTSAM.reduce((a, b) => a + b.weight, 0); let kind = FLOTSAM[0];
        x = r() * tot; for (const F of FLOTSAM) { x -= F.weight; if (x <= 0) { kind = F; break; } }
        items.push({ id: `${f}-${i}`, kind, x: cx + (r() - 0.5) * 30, z: cz + (r() - 0.5) * 30, yaw: r() * 6.28 });
      }
    }
    this.flotFor = c.id; this.flotItems = items;
    for (const o of this.flot) this.root.remove(o.mesh);
    this.flot = items.map((it) => { const m = this.flotProto[it.kind.id](); this.root.add(m); return { ...it, mesh: m }; });
    return items;
  }

  // ---------------------------------------------------------------- per frame
  update(dt, t) {
    const g = this.game, ow = this.ow;
    if (!this.built) { if (ow.islands.built) this.build(); return; }
    const sea = ow.atSea && !!ow.charter;
    this.root.visible = ow.atSea;
    if (!ow.atSea) { for (const p of this.people) p.actor.root.visible = false; for (const gl of this.gulls || []) gl.m.visible = false; return; }
    const p = g.player.pos, now = Date.now(), ts = now / 1000;
    this.cullT = (this.cullT || 0) - dt;
    if (this.cullT <= 0) { this.cullT = 0.5; for (const s of this.sites) s.obj.visible = Math.hypot(s.x - p.x, s.z - p.z) < s.r; this.discover(); this.renderBuoys(); }
    const night = g.engine.sky.night || 0;
    // people: draw the ones near you
    for (const pe of this.people) {
      const near = pe.pos.distanceTo(p) < 45;
      pe.actor.root.visible = near;
      if (!near) continue;
      const dx = p.x - pe.pos.x, dz = p.z - pe.pos.z, close = dx * dx + dz * dz < 16;
      const want = close ? Math.atan2(dx, dz) : pe.yaw + Math.sin(t * 0.3 + pe.pos.x) * 0.4;
      let d = want - pe.face; d = Math.atan2(Math.sin(d), Math.cos(d)); pe.face += d * Math.min(1, dt * 3);
      pe.actor.update(dt, t, { x: pe.pos.x, y: pe.pos.y, z: pe.pos.z, yaw: pe.face, mode: 'shore', pose: 'idle', moving: false, rod: 'back' });
    }
    this.town.update(dt, t); // v1.15.20: Coralhaven, outside and in
    // Channel Light's lamp flashes after dark (two short, one long)
    if (this.lamp) { const ph = (ts % 6); const on = night > 0.3 && (ph < 0.3 || (ph > 0.6 && ph < 0.9) || (ph > 1.5 && ph < 2.6)); this.lamp.material.emissive.set(on ? '#fff0a0' : '#000000'); }
    // Gull Rock's gulls and sea lions
    const GR = ISLET_BY_ID.gullrock, nearGR = Math.hypot(GR.x - p.x, GR.z - p.z) < 160;
    for (const gl of this.gulls || []) { gl.m.visible = nearGR; if (nearGR) { const a = t * gl.w + gl.a; gl.m.position.set(GR.x + Math.cos(a) * gl.R, WATER_Y + gl.h + Math.sin(t + gl.a) * 0.6, GR.z + Math.sin(a) * gl.R); gl.m.rotation.y = -a; } }
    // Emberkey's steam
    const EK = ISLAND_BY_ID.ember;
    const nearEK = Math.hypot(EK.x - p.x, EK.z - p.z) < 500;
    for (const sp of this.steam) sp.visible = nearEK;
    if (nearEK) for (const sp of this.steam) {
      const V = sp.userData.V, k = ((ts * (V.s > 2 ? 0.08 : 0.2)) + sp.userData.ph) % 1;
      sp.position.set(V.x + Math.sin(k * 4 + V.x) * k * 2 * V.s, V.y + k * (V.s > 2 ? 26 : 6), V.z + Math.cos(k * 3) * k * V.s);
      sp.scale.setScalar((1.5 + k * 6) * V.s); sp.material.opacity = Math.sin(k * Math.PI) * (V.s > 2 ? 0.45 : 0.35);
    }
    // the weed mats drift (and ride the waves)
    for (const Mt of this.mats) { const q = this.matPos(Mt, ts); Mt.mesh.position.set(q.x, WATER_Y + oceanWave(q.x, q.z) + 0.02, q.z); Mt.mesh.visible = Math.hypot(q.x - p.x, q.z - p.z) < 260; }
    // ships go by (only while you're on a charter)
    this.updateShips(sea, ts, t, night);
    // flotsam bobs (this trip's)
    if (sea) { this.flotsamFor(ow.charter); const got = this.dd.flot?.c === ow.charter.id ? new Set(this.dd.flot.got) : new Set(); for (const f of this.flot) { f.mesh.visible = !got.has(f.id) && Math.hypot(f.x - p.x, f.z - p.z) < 220; if (f.mesh.visible) { f.mesh.position.set(f.x, WATER_Y + oceanWave(f.x, f.z) + 0.05, f.z); f.mesh.rotation.set(Math.sin(t + f.yaw) * 0.15, f.yaw + t * 0.05, Math.cos(t * 0.8 + f.yaw) * 0.12); } } }
    else for (const f of this.flot) f.mesh.visible = false;
  }

  updateShips(sea, ts, t, night) {
    const C = OCEAN, show = sea;
    // the trawler: a slow lap of the outer sea, half an hour round
    const a = ts * (Math.PI * 2 / 1800), tx = C.x + Math.cos(a) * 470, tz = C.z + Math.sin(a) * 430;
    this.trawler.visible = show; this.trawler.position.set(tx, WATER_Y + oceanWave(tx, tz) - 0.2, tz); this.trawler.rotation.y = -a + Math.PI;
    const pp = this.game.player.pos, gullsOn = show && Math.hypot(tx - pp.x, tz - pp.z) < 180; // (tiny at a distance: only drawn when you're close)
    for (const gl of this.trawlerGulls) { gl.m.visible = gullsOn; if (!gullsOn) continue; const b = t * 0.8 + gl.ph; gl.m.position.set(tx + Math.cos(b) * gl.R - Math.cos(a) * 0, WATER_Y + gl.h + Math.sin(t * 2 + gl.ph), tz + Math.sin(b) * gl.R); gl.m.rotation.y = -b; }
    // the sailing race: round the middle of the sea every 15 minutes, in a little line
    this.sloops.forEach((s, i) => { const b = ts * (Math.PI * 2 / 900) - i * 0.035, x = C.x + Math.cos(b) * 300, z = C.z + Math.sin(b) * 260; s.visible = show; s.position.set(x, WATER_Y + oceanWave(x, z) - 0.2, z); s.rotation.set(0, -b + Math.PI, 0.18); });
    // the Lantern Mary: foggy nights only, slipping past a long way off
    const fog = this.ow.events?.fogK || 0, ghostTime = night > 0.5 && (fog > 0.3 || Math.floor(ts / 3600) % 4 === 0);
    const want = show && ghostTime ? 1 : 0;
    this.ghostK = (this.ghostK || 0) + (want - (this.ghostK || 0)) * Math.min(1, 0.016 * 0.5);
    this.ghost.visible = this.ghostK > 0.02;
    if (this.ghost.visible) {
      const P = this.ow.boat.pose, gA = ts * 0.01, gx = P.x + Math.cos(gA) * 160, gz = P.z + Math.sin(gA) * 160;
      this.ghost.position.set(gx, WATER_Y + oceanWave(gx, gz) - 0.4, gz); this.ghost.rotation.y = -gA;
      this.ghost.traverse((o) => { if (o.isMesh) o.material.opacity = (o.material.userData.base ?? 1) * this.ghostK * 0.85; });
      if (this.ghostK > 0.6 && !this.d.deep?.disc?.ghost) this.found('ghost');
    }
  }

  // ---------------------------------------------------------------- the logbook
  discover() {
    const g = this.game, ow = this.ow, p = g.player.pos, c = ow.charter;
    if (!c) return;
    const near = (x, z, r) => Math.hypot(x - p.x, z - p.z) < r;
    const B = BANK_BY_ID;
    if (near(B.coralhaven.x, B.coralhaven.z, 45)) this.found('coralhaven');
    if (near(B.marigold.x, B.marigold.z, 40)) this.found('marigold');
    for (const T of ISLETS) if (near(T.x, T.z, 45)) this.found(T.id);
    if (near(CHANNEL.c.x, CHANNEL.c.z, 60)) this.found('channel');
    if (near(ISLAND_BY_ID.ember.x, ISLAND_BY_ID.ember.z, 110)) this.found('ember');
    // the chart fills in: 40 m squares the boat (or you) has been near
    const cell = (x, z) => `${Math.floor((x - OCEAN.x) / 40)},${Math.floor((z - OCEAN.z) / 40)}`;
    const k = cell(p.x, p.z);
    if (!this.dd.seen?.includes(k)) this.change((d) => { const s = new Set(d.seen || []); for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) s.add(cell(p.x + i * 40, p.z + j * 40)); d.seen = [...s].slice(-2000); });
  }
  found(id) {
    if (this.dd.disc?.[id]) return;
    const D = DISCOVERIES[id];
    this.change((d) => { d.disc = { ...(d.disc || {}), [id]: Date.now() }; });
    const g = this.game;
    g.audio.sfx('achievement');
    g.ui.toast(D.name, { icon: 'compass', title: 'New in your logbook', ms: 4200 });
    g.chat.npcSay?.('Captain Marlowe', D.line);
    g.reward('ocean', `disc-${id}`, D.reward, `Logbook: ${D.name}`);
  }

  // ---------------------------------------------------------------- what you can do (E)
  /** On the boat's deck. */
  boatActions() {
    const g = this.game, ow = this.ow, c = ow.charter, p = g.player.pos, out = [];
    if (!this.built || !c) return out;
    // flotsam alongside: hook it
    const got = this.dd.flot?.c === c.id ? new Set(this.dd.flot.got) : new Set();
    const f = this.flot.find((x) => !got.has(x.id) && Math.hypot(x.x - p.x, x.z - p.z) < 9);
    if (f) out.push({ id: `flot-${f.id}`, label: `Hook ${f.kind.name}`, color: 'gold', at: { x: f.x, z: f.z, y: WATER_Y, h: 1.2 }, fn: () => this.hook(f) });
    // pots and lines: set here, or haul yours
    if (!ow.boat.pose.moving) {
      const mine = (this.d.seaGear || []).find((x) => Math.hypot(x.x - ow.boat.pose.x, x.z - ow.boat.pose.z) < 40);
      if (mine) out.push({ id: 'haul', label: `Haul your ${SEA_GEAR[mine.kind].name.toLowerCase()}`, color: 'green', fn: () => this.haul(mine) });
      else {
        const zone = oceanZoneAt(ow.boat.pose.x, ow.boat.pose.z) || 'openocean';
        for (const [k, G] of Object.entries(SEA_GEAR)) if ((this.d.gearOwned?.[k] || 0) > 0 && G.zones.includes(zone) && (this.d.seaGear || []).length < SEA_GEAR_MAX) { out.push({ id: `set-${k}`, label: `Set a ${G.name.toLowerCase()} here`, fn: () => this.setGear(k) }); break; }
      }
    }
    return out;
  }
  /** Ashore (an island, an islet, the platform). */
  shoreActions() {
    const g = this.game, p = g.player.pos, out = [];
    if (!this.built) return out;
    if (this.town.inside) return this.town.townActions();
    const by = (pe, r = 3) => pe && pe.actor.root.visible && pe.pos.distanceTo(p) < r;
    if (by(this.ida)) out.push({ id: 'ida', label: 'Talk to Ida', color: 'gold', at: { x: this.ida.pos.x, z: this.ida.pos.z, y: this.ida.pos.y, h: 2.4 }, fn: () => this.talkIda() });
    // clams on the sandbar at low tide
    if (this.clams && this.ow.tides?.low) {
      const lowId = `${dayNo()}-${this.ow.tides.level < 0 ? Math.floor(Date.now() / (6 * 3600000)) : 0}`;
      const cl = this.clams.find((x) => Math.hypot(x.x - p.x, x.z - p.z) < 1.8 && this.dd.clams?.[x.i] !== lowId);
      if (cl) out.push({ id: `clam-${cl.i}`, label: 'Dig for clams', color: 'green', at: { x: cl.x, z: cl.z, y: cl.y, h: 1 }, fn: () => this.dig(cl, lowId) });
    }
    return out;
  }
  /** Underwater. */
  diveActions() {
    const g = this.game, p = g.player.pos, out = [];
    if (!this.built) return out;
    const by = (pe, r = 3.2) => pe && pe.actor.root.visible && pe.pos.distanceTo(p) < r;
    out.push(...this.town.diveActions());
    const pl = this.pearls?.find((x) => !this.dd.pearls?.[x.i] && Math.hypot(x.x - p.x, x.z - p.z) < 1.8 && Math.abs(x.y - p.y) < 2.2);
    if (pl) out.push({ id: `pearl-${pl.i}`, label: 'Pick up the pearl', color: 'gold', fn: () => this.takePearl(pl) });
    const S = this.strongbox;
    if (S && Math.hypot(S.x - p.x, S.z - p.z) < 2.4 && this.dd.box !== dayNo()) out.push({ id: 'strongbox', label: 'Open the Marigold\'s strongbox', color: 'gold', fn: () => this.openBox() });
    return out;
  }

  // ---------------------------------------------------------------- the things themselves
  async hook(f) {
    const g = this.game, c = this.ow.charter, K = f.kind, r = Math.random;
    this.change((d) => { d.flot = d.flot?.c === c.id ? { c: c.id, got: [...d.flot.got, f.id] } : { c: c.id, got: [f.id] }; d.hooked = (d.hooked || 0) + 1; });
    g.audio.sfx('reelin');
    this.found('flotsam');
    const coins = Math.round(K.coins[0] + r() * (K.coins[1] - K.coins[0])), pearls = K.pearls ? Math.round(K.pearls[0] + r() * (K.pearls[1] - K.pearls[0])) : 0;
    if (K.bottle) g.chat.system(`Inside the bottle: "${['If you find this, the fishing is better out past the Canyon. -M', 'Dear whoever: the sea glass on Turtle Atoll is the best. Keep a jar. -E', 'Wish you were here. (Well, someone is now!)', 'The Lantern Mary sails on foggy nights. Don\'t follow her.'][Math.floor(r() * 4)]}"`, 'info', { popup: true });
    if (K.glass) this.game.ext.change((d) => { d.ocean.beach = d.ocean.beach || {}; const gl = d.ocean.beach.glass || {}; d.ocean.beach.glass = { ...gl, green: (gl.green || 0) + 1 }; });
    await g.reward('ocean', `flot-${c.id}-${f.id}`, { coins, pearls, xp: 30 }, `Hooked ${K.name}`);
  }
  async dig(cl, lowId) {
    const g = this.game;
    this.change((d) => { d.clams = { ...(d.clams || {}), [cl.i]: lowId }; d.dug = (d.dug || 0) + 1; });
    g.audio.sfx('dig'); g.fx.splash(new THREE.Vector3(cl.x, WATER_Y, cl.z), 0.3);
    const pearl = Math.random() < CLAMS.pearlChance, coins = Math.round(CLAMS.coins[0] + Math.random() * (CLAMS.coins[1] - CLAMS.coins[0]));
    if (pearl) g.juice?.pop('A PEARL!', { color: '#f0f0ff', size: 34 });
    await g.reward('ocean', `clam-${cl.i}-${lowId}`, { coins, pearls: pearl ? 1 : 0, xp: 15 }, pearl ? 'A clam with a pearl in it!' : 'A bucket of sandbar clams');
  }
  async openBox() {
    const g = this.game, r = Math.random;
    this.change((d) => { d.box = dayNo(); d.boxes = (d.boxes || 0) + 1; });
    g.audio.sfx('chestburst');
    await g.reward('ocean', `box-${dayNo()}`, { coins: Math.round(STRONGBOX.coins[0] + r() * (STRONGBOX.coins[1] - STRONGBOX.coins[0])), pearls: Math.round(STRONGBOX.pearls[0] + r() * (STRONGBOX.pearls[1] - STRONGBOX.pearls[0])), xp: 120 }, "The Marigold's strongbox (it fills up again by tomorrow: nobody knows how)");
  }
  async takePearl(pl) {
    const g = this.game;
    this.change((d) => { d.pearls = { ...(d.pearls || {}), [pl.i]: Date.now() }; });
    g.audio.sfx('coinpick');
    const n = Object.keys(this.dd.pearls || {}).length;
    g.ui.toast(`Shelly's pearl ${n}/5.${n === 5 ? ' Take them back to her at the Trading Post, inside Coralhaven!' : ''}`, { icon: 'star', ms: 3000 });
  }

  // ---- people
  talkShelly() {
    const g = this.game, n = this.town.shelly, found = Object.keys(this.dd.pearls || {}).length;
    const glass = this.d.beach?.glass || {}, have = Object.values(glass).reduce((a, b) => a + b, 0);
    const choices = [];
    if (found === 5 && !this.dd.pearlsDone) choices.push({ label: 'Here are your five pearls', primary: true, fn: () => { this.change((d) => { d.pearlsDone = Date.now(); }); setTimeout(() => g.dialogue.open({ npc: n, title: n.title, text: SHELLY.pearlsDone, choices: [{ label: 'Thanks, Shelly' }] }), 200); g.reward('ocean', 'coralhaven-pearls', PEARLS_QUEST, 'Shelly\'s lost pearls'); } });
    choices.push({ label: `Trade 3 sea glass for a pearl (you have ${have})`, fn: () => setTimeout(() => this.tradeGlass(), 150) });
    choices.push({ label: 'Bye, Shelly' });
    g.dialogue.open({ npc: n, title: n.title, text: `${SHELLY.intro}${this.dd.pearlsDone ? '' : ` (${found}/5 pearls found.)`}`, choices });
  }
  async tradeGlass() {
    const g = this.game, glass = { ...(this.d.beach?.glass || {}) };
    let need = 3;
    for (const k of Object.keys(glass)) { while (need > 0 && glass[k] > 1) { glass[k]--; need--; } } // (spare pieces first: keep one of each colour for your jar)
    for (const k of Object.keys(glass)) { while (need > 0 && glass[k] > 0) { glass[k]--; need--; } }
    if (need > 0) { g.ui.toast('You need three bits of sea glass. Search rock pools at low tide, or hook glass floats.'); return; }
    g.ext.change((d) => { d.ocean.beach.glass = glass; });
    await g.reward('ocean', `glass-${Date.now()}`, { pearls: 1 }, 'Shelly\'s trade');
  }
  talkFinn() {
    const g = this.game, n = this.town.finn, deep = new Set(['bluewater', 'canyon', 'abyss', 'wreck', 'openocean']);
    const locked = new Set(g.ext.d.locked || []);
    const fish = g.profile.creel.filter((c) => !locked.has(c.id) && SPECIES_BY_ID[c.speciesId]?.zones?.some((z) => deep.has(z))).slice(0, 5);
    g.dialogue.open({ npc: n, title: n.title, text: FINN.intro + (fish.length ? '' : ' You\'ve nothing from deep water in your backpack. Come back when you do.'), choices: [
      ...fish.map((c) => { const v = Math.round(catchValue(c.speciesId, c.variant, c.weight) * 1.5); return { label: `${SPECIES_BY_ID[c.speciesId].name} (${c.weight.toFixed(1)} lb): ${v} coins`, fn: () => setTimeout(() => this.sellFinn(c, v), 150) }; }),
      { label: 'Not today' },
    ] });
  }
  async sellFinn(c, v) {
    const g = this.game;
    if (!(await g.save.give(c.id))) { g.ui.toast('Couldn\'t take that fish out of your backpack.'); return; }
    await g.reward('ocean', `finn-${c.id}`, { coins: v }, `Old Finn bought your ${SPECIES_BY_ID[c.speciesId].name}`);
  }
  talkIda() {
    const g = this.game, n = this.ida, own = this.d.gearOwned || {};
    const buy = (k) => ({ label: `Buy a ${SEA_GEAR[k].name.toLowerCase()} (${SEA_GEAR[k].price.coins.toLocaleString()} coins, you have ${own[k] || 0})`, fn: () => setTimeout(() => this.buyGear(k), 150) });
    g.dialogue.open({ npc: n, title: n.title, text: `${IDA.intro} ${SEA_GEAR.pot.what} ${SEA_GEAR.line.what}`, choices: [
      buy('pot'), buy('line'),
      this.dd.chartAll ? null : { label: `Copy my chart into yours (${CHART_REVEAL.coins.toLocaleString()} coins: the whole sea)`, fn: () => setTimeout(() => this.buyChart(), 150) },
      { label: 'Bye, Ida' },
    ].filter(Boolean) });
  }
  async buyGear(k) {
    const g = this.game, r = await g.save.spend('seagear', k, SEA_GEAR[k].price);
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough coins.'); return; }
    g.ext.change((d) => { d.ocean.gearOwned = { ...(d.ocean.gearOwned || {}), [k]: ((d.ocean.gearOwned || {})[k] || 0) + 1 }; });
    g.audio.sfx('purchase');
    g.ui.toast(`A ${SEA_GEAR[k].name.toLowerCase()}. Set it from the boat at anchor (E on deck) and haul it next trip.`, { icon: 'anchor', ms: 4500 });
  }
  async buyChart() {
    const g = this.game, r = await g.save.spend('chart', 'all', CHART_REVEAL);
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough coins.'); return; }
    this.change((d) => { d.chartAll = Date.now(); });
    g.audio.sfx('page');
    g.ui.toast('Ida copies her chart into yours: the whole sea, every rock.', { icon: 'map', ms: 3500 });
  }

  // ---- pots and lines
  setGear(k) {
    const g = this.game, P = this.ow.boat.pose;
    g.ext.change((d) => {
      d.ocean.gearOwned = { ...(d.ocean.gearOwned || {}), [k]: Math.max(0, ((d.ocean.gearOwned || {})[k] || 0) - 1) };
      d.ocean.seaGear = [...(d.ocean.seaGear || []), { id: Math.random().toString(36).slice(2, 8), kind: k, x: +(P.x + Math.sin(P.yaw + 1.6) * 6).toFixed(1), z: +(P.z + Math.cos(P.yaw + 1.6) * 6).toFixed(1), zone: oceanZoneAt(P.x, P.z) || 'openocean', at: Date.now() }];
    });
    g.audio.sfx('plop');
    g.ui.toast(`${SEA_GEAR[k].name} set, with a buoy on it. Haul it on your next trip (it needs ${SEA_GEAR[k].soak} minutes).`, { icon: 'anchor', ms: 4500 });
    this.renderBuoys();
  }
  async haul(s) {
    const g = this.game, G = SEA_GEAR[s.kind];
    if (Date.now() - s.at < G.soak * 60000) { g.ui.toast(`Not yet: give it ${Math.ceil((G.soak * 60000 - (Date.now() - s.at)) / 60000)} more minutes.`, { icon: 'clock' }); return; }
    g.ext.change((d) => { d.ocean.seaGear = (d.ocean.seaGear || []).filter((x) => x.id !== s.id); d.ocean.gearOwned = { ...(d.ocean.gearOwned || {}), [s.kind]: ((d.ocean.gearOwned || {})[s.kind] || 0) + 1 }; });
    this.renderBuoys();
    g.audio.sfx('reelin');
    const wt = g.engine.sky.state, ctx = { zone: s.zone, phase: wt.phase, weather: wt.weather };
    let pool = eligibleSpecies(null, ctx).filter((x) => ['common', 'uncommon', 'rare'].includes(x.tier) && !x.spear);
    if (s.kind === 'line') pool = pool.filter((x) => !x.tropical || x.big);
    if (!pool.length) pool = eligibleSpecies(null, { ...ctx, phase: 'day', weather: 'clear' }).filter((x) => !x.spear && ['common', 'uncommon', 'rare'].includes(x.tier));
    const n = G.n[0] + Math.floor(Math.random() * (G.n[1] - G.n[0] + 1)), lines = [];
    for (let i = 0; i < n && pool.length; i++) {
      const sp = pool[Math.floor(Math.random() * pool.length)], w = rollWeight(sp);
      const c = { speciesId: sp.id, variant: 'normal', weight: w, zone: s.zone, phase: wt.phase, weather: wt.weather, fullMoon: false, ts: Date.now(), away: true };
      try { const r = await g.save.recordCatch(c); g.quests?.progress('catch', c); if (r.levelUp) g.onLevelUp(r.levelUp); lines.push(`${sp.name} (${w.toFixed(1)} lb)`); } catch (e) { break; }
    }
    g.ext.bump('seaGearHauls');
    g.ui.toast(lines.length ? `${G.name}: ${lines.join(', ')}` : `${G.name}: empty this time.`, { icon: 'creel', title: 'Hauled up', ms: 6000 });
    await g.autoClaim?.();
  }
  renderBuoys() {
    const want = this.ow.atSea ? (this.d.seaGear || []) : [], keep = new Set();
    for (const s of want) {
      keep.add(s.id);
      if (this.buoys.has(s.id)) continue;
      const b = new THREE.Group();
      b.add(mesh(new THREE.SphereGeometry(0.35, 10, 8), mat(s.kind === 'pot' ? '#e8602a' : '#f2c030')));
      b.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), mat('#3a3a3a'), 0, 0.8, 0));
      b.add(mesh(new THREE.BoxGeometry(0.4, 0.28, 0.02), mat('#e84a3a'), 0.2, 1.35, 0));
      b.userData.s = s;
      this.root.add(b); this.buoys.set(s.id, b);
    }
    for (const [id, b] of this.buoys) if (!keep.has(id)) { this.root.remove(b); this.buoys.delete(id); }
    for (const b of this.buoys.values()) { const s = b.userData.s; b.position.set(s.x, WATER_Y + oceanWave(s.x, s.z) - 0.1, s.z); }
  }

  // ---------------------------------------------------------------- fishing hooks
  /** Cast up against a weed mat: the mahi and tripletail come out from under it. */
  boost(ctx, bobber) {
    if (!this.built || !bobber) return null;
    const ts = Date.now() / 1000;
    for (const Mt of this.mats) { const q = this.matPos(Mt, ts); if (Math.hypot(q.x - bobber.x, q.z - bobber.z) < 8) { ctx.weedmat = true; this.found('weed'); return { mahi: 3, tripletail: 4, wahoo: 1.5 }; } }
    return null;
  }

  // ---------------------------------------------------------------- the chart and the logbook
  logbook() {
    const g = this.game, disc = this.dd.disc || {};
    const rows = Object.entries(DISCOVERIES).map(([id, D]) => h(`li.ow-crew${disc[id] ? '' : '.dim'}`, h('span.ow-lv', icon(disc[id] ? 'check' : 'help')), h('b', disc[id] ? D.name : '???'), h('small', disc[id] ? new Date(disc[id]).toLocaleDateString() : 'Not found yet')));
    const seen = (this.dd.seen || []).length;
    this.ow.ui.openModal('ow-logbook', h('div.ow-head', h('span.ow-badge', icon('compass')), h('div', h('b', 'Logbook'), h('span', `${Object.keys(disc).length}/${Object.keys(DISCOVERIES).length} found · ${this.dd.chartAll ? 'the whole sea charted' : `${Math.min(100, Math.round(seen / 4.5))}% of the sea charted`}`))),
      h('ul.ow-list', rows),
      h('p.ow-note', `Pots and lines set: ${(this.d.seaGear || []).length}/${SEA_GEAR_MAX}. Ida at the Channel Light sells them, and a copy of her chart.`));
  }
}
