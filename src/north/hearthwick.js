// Frostmere: Hearthwick, the ice-fishing village on Frostmere's south shore (the Cozy Cove of the north). The Hearth
// Lodge on the green with its bonfire and bell tower, Pell's Trading Post, Grandma Elsi's smokehouse, the sauna by
// the shore, Mira's carving shed, painted cabins and their stilt caches, June's kennels, the skating rink, and out on
// the ice the shanty town, every shanty with smoke at its stovepipe and tip-ups round its holes.
// Built once (with the rest of the north) from art/src/hearthwick.py; one or two draws per building.
import * as THREE from 'three';
import { HEARTHWICK_MATS, HEARTHWICK_NODES } from '../data/hearthwickMesh.js';
import { addLibrary, mergedMesh, instanced } from './instancing.js';
import { signBoard } from './plane.js';
import { addBox, addCircle } from '../world/colliders.js';
import { toWorld, landAt, kindAt, isIce, ICE_Y, K, polyDist, TAXI_IN, TAXI_OUT, TAXI_CLEAR } from './geo.js';
import { mulberry32 } from '../core/rng.js';
import { KennelDogs } from './dogs.js';
import { northSfx } from './sounds.js';

addLibrary(HEARTHWICK_MATS, HEARTHWICK_NODES);

// ry: which way the front (+z) faces. N = toward the lake (-v), E = +u, W = -u, S = +v
const N = Math.PI, E = Math.PI / 2, W = -Math.PI / 2, S = 0;
// buildings: [node, u, v, ry, half width x, half depth z (the walls), porch { z0, z1 (front), y (deck top), hw, steps:
// [tops of the three steps down from the front] }] in the model's own coordinates (art/src/hearthwick.py)
/** The shanty town regulars' fishing holes (local u, v); villagers.js cuts them and seats the fishers by them. */
export const NPC_HOLE_UV = [{ u: 48, v: 96 }, { u: 84, v: 112 }, { u: 66, v: 88 }, { u: 36, v: 116 }];

export const BUILDINGS = [
  { id: 'lodge', node: 'hw_lodge', u: 72, v: 172, ry: N, hw: 8.4, hd: 5.65, porch: { z0: 5.5, z1: 7.9, y: 0.63, hw: 6.5, steps: [0.48, 0.34, 0.2], posts: 6 }, sign: ['HEARTH LODGE', 3.6, 0.55, [0, 3.3, 5.82]] },
  { id: 'trading', node: 'hw_tradingpost', u: 40, v: 156, ry: E, hw: 4.8, hd: 3.8, porch: { z0: 3.6, z1: 5.6, y: 0.53, hw: 4.6, steps: [0.38, 0.24, 0.1], posts: 4 }, sign: ["PELL'S TRADING POST", 7.5, 1.28, [0, 5.58, 3.99]] },
  { id: 'smokehouse', node: 'hw_smokehouse', u: 104, v: 158, ry: W, hw: 2.7, hd: 2.5 },
  { id: 'sauna', node: 'hw_sauna', u: 116, v: 133, ry: N, hw: 2.4, hd: 2.1, porch: { z0: 2.0, z1: 3.6, y: 0.12, hw: 2.2, low: true }, woodpile: [-3.0, 0] },
  { id: 'carving', node: 'hw_carvingshed', u: 16, v: 150, ry: E, hw: 2.6, hd: 1.8, open: true },
  { id: 'cabin1', node: 'hw_cabin_red', u: 6, v: 172, ry: E, hw: 3.3, hd: 2.55, stoop: true, woodpile: [3.7, -1.0] },
  { id: 'cabin2', node: 'hw_cabin_yellow', u: 30, v: 184, ry: N, hw: 3.3, hd: 2.55, stoop: true, woodpile: [3.7, -1.0] },
  { id: 'cabin3', node: 'hw_cabin_teal', u: 52, v: 196, ry: N, hw: 3.3, hd: 2.55, stoop: true, woodpile: [3.7, -1.0] },
  { id: 'cabin4', node: 'hw_cabin_green', u: 96, v: 190, ry: N, hw: 3.3, hd: 2.55, stoop: true, woodpile: [3.7, -1.0] },
  { id: 'cabin5', node: 'hw_cabin_red', u: 124, v: 178, ry: W, hw: 3.3, hd: 2.55, stoop: true, woodpile: [3.7, -1.0] },
  { id: 'cache1', node: 'hw_cache', u: 18, v: 192, ry: N, hw: 1.0, hd: 0.9, stilts: true },
  { id: 'cache2', node: 'hw_cache', u: 112, v: 200, ry: N, hw: 1.0, hd: 0.9, stilts: true },
  { id: 'bell', node: 'hw_belltower', u: 90, v: 141, ry: N, hw: 1.15, hd: 1.15, stilts: true },
  { id: 'skatehut', node: 'hw_skatehut', u: 98, v: 129, ry: N, hw: 1.25, hd: 1.05, sign: ['SKATES', 1.6, 0.36, [0, 2.6, 1.08]] },
  { id: 'sign', node: 'hw_sign', u: 44, v: 136, ry: Math.PI, hw: 1.2, hd: 0.15, sign: ['HEARTHWICK', 2.4, 0.66, [0, 1.75, 0.09]], noBlock: true },
];
export const GREEN = { u: 72, v: 148, bonfire: { u: 72, v: 148 } };
export const RINK = { u: 112, v: 98, rx: 17, rz: 11 };
export const KENNELS = { u: 150, v: 172, w: 9, d: 7 };
export const SAUNA_HOLE = { u: 116, v: 122 };

export class Hearthwick {
  constructor(game, world) {
    this.game = game; this.world = world;
    this.group = new THREE.Group(); this.group.name = 'hearthwick';
    this.floors = []; // porches you can stand on: { x0, z0, x1, z1, y }
    this.smoke = []; // chimney tops (world positions)
    this.shanties = [];
  }
  ground(u, v) { return isIce(kindAt(u, v)) ? ICE_Y : landAt(u, v); }

  build() {
    const g = this.group;
    for (const B of BUILDINGS) this.place(B);
    this.buildNoticeBoard();
    this.buildGreen();
    this.buildRink();
    this.buildKennels();
    this.buildShanties();
    this.buildPaths();
    this.buildLamps();
    this.world.group.add(g);
  }

  /** One building: placed on its pad, with its painted sign, collider, porch floor and chimney smoke. */
  place(B) {
    const w = toWorld(B.u, B.v), y = this.ground(B.u, B.v) - 0.05;
    const m = mergedMesh(B.node); m.position.set(w.x, y, w.z); m.rotation.y = B.ry;
    this.group.add(m); B.obj = m; B.y = y; B.x = w.x; B.z = w.z;
    // the walls block; the porch in front is a floor you can step up onto
    const rot = (lx, lz) => ({ x: w.x + lx * Math.cos(B.ry) + lz * Math.sin(B.ry), z: w.z - lx * Math.sin(B.ry) + lz * Math.cos(B.ry) });
    const box = (lx0, lz0, lx1, lz1, opts) => { const a = rot(lx0, lz0), b = rot(lx1, lz1); addBox(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), opts); };
    const floor = (lx0, lz0, lx1, lz1, fy) => { const a = rot(lx0, lz0), b = rot(lx1, lz1); this.floors.push({ x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z), y: fy }); };
    if (!B.noBlock) {
      if (B.stilts) for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = rot(sx * B.hw * 0.9, sz * B.hd * 0.9); addCircle(p.x, p.z, 0.25); }
      else if (B.open) box(-B.hw, -B.hd, B.hw, -B.hd + 0.4);
      else box(-B.hw, -B.hd, B.hw, B.hd);
    }
    // v1.17.1: a porch is a raised deck you climb by its steps: its sides and front are a ledge you can't walk through
    // from the ground (people up on it can step off), its posts are solid, and each step is a floor of its own height
    const P = B.porch;
    if (P) {
      floor(-P.hw, P.z0, P.hw, P.z1, y + P.y);
      if (!P.low) {
        const top = y + P.y, sw = 0.85, T = 0.16;
        box(-P.hw - T, P.z0, -P.hw, P.z1 + T, { top }); box(P.hw, P.z0, P.hw + T, P.z1 + T, { top });
        box(-P.hw - T, P.z1, -sw, P.z1 + T, { top }); box(sw, P.z1, P.hw + T, P.z1 + T, { top });
        for (let k = 0; k < (P.posts || 4); k++) { const lx = -P.hw + 0.15 + k * (2 * P.hw - 0.3) / ((P.posts || 4) - 1); if (Math.abs(lx) < sw + 0.1) continue; const p = rot(lx, P.z1 - 0.15); addCircle(p.x, p.z, 0.14); }
        (P.steps || []).forEach((st, k) => floor(-0.8, P.z1 + 0.04 + k * 0.28, 0.8, P.z1 + 0.32 + k * 0.28, y + st));
        for (const sd of [-1, 1]) box(sd > 0 ? 0.8 : -0.95, P.z1 + T, sd > 0 ? 0.95 : -0.8, P.z1 + 0.88, { top: y + (P.steps?.[0] || P.y) }); // (the steps' sides)
      }
    }
    // a cabin's stoop by the door, and the woodpile by the side wall
    if (B.stoop) floor(-1.8, B.hd, -0.2, B.hd + 0.95, y + 0.36);
    if (B.woodpile) { const p = rot(B.woodpile[0], B.woodpile[1]); addCircle(p.x, p.z, 0.65, { top: y + 0.95 }); }
    if (B.id === 'trading') { // (v1.17.2: the logs stop at the eaves: board in the gable under the back of the roof)
      const sh = new THREE.Shape([new THREE.Vector2(-4.75, 0), new THREE.Vector2(4.75, 0), new THREE.Vector2(0, 2.55)]);
      const gable = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshLambertMaterial({ color: '#6e4a2c', side: THREE.DoubleSide }));
      const p = rot(0, -3.62); gable.position.set(p.x, y + 3.62, p.z); gable.rotation.y = B.ry; gable.castShadow = true; this.group.add(gable);
    }
    if (B.sign) {
      const [text, sw, sh, [lx, ly, lz]] = B.sign;
      const s = signBoard(text, sw, sh, { bg: '#8c2f28', fg: '#f4e8c8', edge: '#c9a24a' });
      const p = rot(lx, lz + 0.02); s.position.set(p.x, y + ly, p.z); s.rotation.y = B.ry;
      this.group.add(s);
    }
    // where smoke rises: the lodge's chimney, the cabins' and shops' stovepipes
    const pipes = { hw_lodge: [[8.85, 13.6, 0]], hw_tradingpost: [[-2.0, 7.3, -1.0]], hw_smokehouse: [[0, 6.0, 0]], hw_sauna: [[1.2, 5.0, -1.0]], hw_cabin_red: [[1.6, 6.8, -0.8]], hw_cabin_yellow: [[1.6, 6.8, -0.8]], hw_cabin_teal: [[1.6, 6.8, -0.8]], hw_cabin_green: [[1.6, 6.8, -0.8]] }[B.node];
    for (const [lx, ly, lz] of pipes || []) { const p = rot(lx, lz); this.smoke.push(new THREE.Vector3(p.x, y + ly, p.z)); }
  }

  /** The notice board by the lodge steps: the Ice Derby, the races and the flight scores. */
  buildNoticeBoard() {
    const L = BUILDINGS.find((b) => b.id === 'lodge'), lx = -7.6, lz = 8.0;
    const x = L.x + lx * Math.cos(L.ry) + lz * Math.sin(L.ry), z = L.z - lx * Math.sin(L.ry) + lz * Math.cos(L.ry);
    const [u, v] = [x - toWorld(0, 0).x, z - toWorld(0, 0).z], y = this.ground(u, v);
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = L.ry;
    const post = mergedMesh('hw_lamppost'); post.scale.set(1, 0.72, 1); post.position.x = -1.28; g.add(post);
    const post2 = mergedMesh('hw_lamppost'); post2.scale.set(1, 0.72, 1); post2.position.x = 1.28; g.add(post2);
    for (const s of [-0.9, 0.9]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.3, 0.1), new THREE.MeshLambertMaterial({ color: '#5c3d26' })); leg.position.set(s, 1.15, -0.06); leg.castShadow = true; g.add(leg); } // (v1.17.2: its own posts, now the lamps stand clear of it)
    const sign = signBoard('HEARTHWICK  BOARDS', 1.9, 0.32, { bg: '#8c2f28', fg: '#f4e8c8', edge: '#c9a24a' }); sign.position.set(0, 2.15, 0.06); g.add(sign);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
    const c = cv.getContext('2d'); c.fillStyle = '#c49a6a'; c.fillRect(0, 0, 256, 160);
    const notes = ['#f4ecd8', '#fff4c0', '#e8f4ff', '#ffe0e0', '#f4ecd8', '#e0ffe4'];
    notes.forEach((col, i) => { c.fillStyle = col; c.save(); c.translate(20 + (i % 3) * 78, 14 + Math.floor(i / 3) * 72); c.rotate((i % 2 ? 1 : -1) * 0.06); c.fillRect(0, 0, 66, 60); c.fillStyle = '#5a4a3a'; for (let k = 0; k < 5; k++) c.fillRect(8, 12 + k * 9, 30 + ((i + k) % 3) * 10, 3); c.fillStyle = '#c8302a'; c.beginPath(); c.arc(33, 4, 4, 0, 6.3); c.fill(); c.restore(); });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.2), new THREE.MeshLambertMaterial({ map: tex })); board.position.set(0, 1.4, 0.05); g.add(board);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 0.08), new THREE.MeshLambertMaterial({ color: '#5c3d26' })); back.position.set(0, 1.4, 0); g.add(back);
    this.group.add(g);
    addBox(Math.min(x - 1, x + 1), Math.min(z - 0.3, z + 0.3), Math.max(x - 1, x + 1), Math.max(z - 0.3, z + 0.3));
    this.lodgeBoard = { x: x + Math.sin(L.ry) * 1.2, z: z + Math.cos(L.ry) * 1.2, y };
    // v1.17.1: the board itself, as something a dialogue can face (the camera looks at the notices, not at Astrid)
    this.boardSpeaker = { name: 'Notice board', pos: new THREE.Vector3(x, y, z), actor: { headWorld: (v) => v.set(x, y + 1.45, z) } };
  }

  /** The green: the bonfire, benches round it, the ice sculptures by Mira's shed. */
  buildGreen() {
    const G = GREEN.bonfire, w = toWorld(G.u, G.v), y = this.ground(G.u, G.v);
    const bf = mergedMesh('hw_bonfire'); bf.position.set(w.x, y, w.z); this.group.add(bf);
    addCircle(w.x, w.z, 1.4);
    this.bonfire = new THREE.Vector3(w.x, y + 0.6, w.z);
    // the bonfire's glow (the light budget lights it when it's dark enough to matter)
    this.fireLight = new THREE.PointLight('#ff9a48', 2.2, 22, 1.4); this.fireLight.position.set(w.x, y + 1.6, w.z); this.group.add(this.fireLight);
    const benches = [];
    // v1.17.1: the benches round the fire are seats (two each, facing the flames), and the fire cooks (src/game/cookout.js)
    this.fires = [{ x: w.x, y: y + 0.4, z: w.z }];
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + 0.3, x = w.x + Math.sin(a) * 4.2, z = w.z + Math.cos(a) * 4.2, by = this.ground(G.u + Math.sin(a) * 4.2, G.v + Math.cos(a) * 4.2), ry = a + Math.PI;
      benches.push({ x, y: by, z, ry });
      const along = (d) => ({ x: x + Math.cos(ry) * d, z: z - Math.sin(ry) * d });
      for (const d of [-0.75, 0, 0.75]) { const p = along(d); addCircle(p.x, p.z, 0.32, { top: by + 0.56 }); }
      for (const d of [-0.5, 0.5]) { const p = along(d); this.game.chairs?.list.push({ id: `hwbench-${k}-${d}`, x: p.x + Math.sin(ry) * 0.06, z: p.z + Math.cos(ry) * 0.06, y: by + 0.05, h: 0.45, kind: 'log', yaw: Math.atan2(w.x - p.x, w.z - p.z) }); }
    }
    instanced(this.group, 'hw_bench', benches, { shadow: true });
    this.benches = benches;
    for (const [n, u, v, ry, cr] of [['hw_icesculpt_fish', 26, 145, E, 0.85], ['hw_icesculpt_bear', 26, 156, E, 1.2], ['hw_icesculpt_owl', 58, 142, N + 0.4, 0.75]]) {
      const p = toWorld(u, v), m = mergedMesh(n); m.position.set(p.x, this.ground(u, v), p.z); m.rotation.y = ry; this.group.add(m); addCircle(p.x, p.z, cr);
    }
    const crates = [[44, 150], [102, 152], [118, 137]].map(([u, v], i) => { const p = toWorld(u, v); addCircle(p.x, p.z, 0.6); return { x: p.x, y: this.ground(u, v), z: p.z, ry: i * 1.3 }; });
    instanced(this.group, 'hw_crates', crates);
  }

  /** The rink: cleared ice inside an oval of boards, with the skate hut on the shore. */
  buildRink() {
    const R = RINK, n = 24, walls = [];
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.2) continue; // the gate, toward the shore
      const u = R.u + Math.cos(a) * R.rx, v = R.v + Math.sin(a) * R.rz, p = toWorld(u, v);
      const da = 0.01, tu = -Math.sin(a) * R.rx, tv = Math.cos(a) * R.rz; void da;
      walls.push({ x: p.x, y: ICE_Y, z: p.z, ry: Math.atan2(tu, tv) + Math.PI / 2, s: 1.12 });
      addCircle(p.x, p.z, 0.6);
    }
    instanced(this.group, 'hw_rinkwall', walls);
    // the swept ice inside: a glossy oval
    const geo = new THREE.CircleGeometry(1, 48); geo.rotateX(-Math.PI / 2); geo.scale(R.rx - 0.4, 1, R.rz - 0.4);
    const ice = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: '#d8ecf6', shininess: 140, specular: '#ffffff', transparent: true, opacity: 0.9 }));
    const p = toWorld(R.u, R.v); ice.position.set(p.x, ICE_Y + 0.01, p.z); ice.receiveShadow = true; ice.name = 'rink-ice';
    this.group.add(ice);
    this.rinkCenter = new THREE.Vector3(p.x, ICE_Y, p.z);
  }

  /** June's kennels: a fenced yard, doghouses, the dogs, a sled. */
  buildKennels() {
    const Kn = KENNELS, c = toWorld(Kn.u, Kn.v), y = this.ground(Kn.u, Kn.v), fence = [];
    for (let x = -Kn.w + 1; x < Kn.w; x += 2) for (const s of [-1, 1]) {
      if (s < 0 && Math.abs(x) < 2) continue; // the gate, toward the village (north)
      fence.push({ x: c.x + x, y, z: c.z + s * Kn.d, ry: 0 }); addCircle(c.x + x, c.z + s * Kn.d, 0.6);
    }
    for (let z = -Kn.d + 1; z < Kn.d; z += 2) for (const s of [-1, 1]) { fence.push({ x: c.x + s * Kn.w, y, z: c.z + z, ry: Math.PI / 2 }); addCircle(c.x + s * Kn.w, c.z + z, 0.6); }
    instanced(this.group, 'hw_fence', fence);
    const houses = [];
    for (let k = 0; k < 6; k++) { const x = c.x - Kn.w + 2 + k * 3, z = c.z + Kn.d - 1.6; houses.push({ x, y, z, ry: Math.PI }); addCircle(x, z, 0.7); }
    instanced(this.group, 'hw_doghouse', houses);
    this.dogHouses = houses;
    const sled = mergedMesh('hw_sled'); sled.position.set(c.x + Kn.w + 2.5, y, c.z - 2); sled.rotation.y = -0.4; this.group.add(sled); addCircle(c.x + Kn.w + 2.5, c.z - 2, 1.0);
    this.kennelCenter = new THREE.Vector3(c.x, y, c.z);
    this.dogs = new KennelDogs(this.group, { x: c.x, z: c.z, w: Kn.w, d: Kn.d, y }, 8, () => y);
    this.dogs.onBark = (vol) => northSfx(this.game.audio, 'bark', { vol });
  }

  /** The shanty town: a dozen painted shanties out on the bay ice, each with tip-ups round it and a stovepipe smoking. */
  buildShanties() {
    const r = mulberry32(48), spots = [], colors = ['hw_shanty_red', 'hw_shanty_yellow', 'hw_shanty_blue', 'hw_shanty_green'];
    let tries = 0;
    while (spots.length < 13 && tries++ < 600) {
      const u = 22 + r() * 80, v = 80 + r() * 42;
      if (kindAt(u, v) !== K.LAKE || kindAt(u, v + 4) !== K.LAKE) continue;
      if (Math.hypot(u - RINK.u, v - RINK.v) < 24 || Math.hypot(u - 32, v - 100) < 14 || v < 76) continue; // (clear of the rink, the plane's parking spot and the strip)
      if (spots.some((s) => Math.hypot(s.u - u, s.v - v) < 10)) continue;
      if (NPC_HOLE_UV.some((h) => Math.hypot(h.u - u, h.v - v) < 5.5)) continue; // (v1.17.1: leave the regulars' holes room to fish)
      if (Math.min(polyDist(u, v, TAXI_IN).d, polyDist(u, v, TAXI_OUT).d) < TAXI_CLEAR) continue; // (v1.17.1: and the plane's wings room to pass)
      if (Math.hypot(u - 52, v - 120) < 7) continue; // (and clear of the strip's windsock, base.js STRIP.windsock)
      spots.push({ u, v, ry: r() * Math.PI * 2, c: colors[spots.length % 4] });
    }
    const byColor = Object.fromEntries(colors.map((c) => [c, []]));
    const tipups = [];
    for (const s of spots) {
      const p = toWorld(s.u, s.v);
      s.idx = byColor[s.c].length;
      byColor[s.c].push({ x: p.x, y: ICE_Y, z: p.z, ry: s.ry });
      const skip = () => this.game.north?.shanty?.inside?.idx === s.idx && this.game.north.shanty.inside.c === s.c; // (not while you're inside this one)
      addBox(p.x - 1.2, p.z - 1.2, p.x + 1.2, p.z + 1.2, { skip }); addCircle(p.x, p.z, 1.55, { skip }); // (the box is axis-aligned; the circle covers a turned shanty's corners)
      this.smoke.push(new THREE.Vector3(p.x - 0.55 * Math.cos(s.ry) - 0.6 * Math.sin(s.ry), ICE_Y + 3.5, p.z + 0.55 * Math.sin(s.ry) - 0.6 * Math.cos(s.ry)));
      for (let k = 0; k < 2; k++) { const a = s.ry + 1 + k * 2.1, d = 3.2 + r() * 1.5; tipups.push({ x: p.x + Math.sin(a) * d, y: ICE_Y, z: p.z + Math.cos(a) * d, ry: r() * 6 }); }
      this.shanties.push({ ...s, x: p.x, z: p.z });
    }
    this.shantyMeshes = {};
    for (const c of colors) this.shantyMeshes[c] = instanced(this.group, c, byColor[c], { shadow: true });
    instanced(this.group, 'hw_tipup', tipups);
    this.decorTipups = tipups;
  }

  /** Ploughed paths: packed snow between the buildings, and a lane out onto the ice to the shanties. */
  buildPaths() {
    const lanes = [
      [[34, 102], [36, 116], [40, 128], [44, 136], [52, 142], [64, 146]], // from the plane to the green
      [[72, 148], [72, 162]], [[72, 148], [50, 154], [47, 156]], [[72, 148], [92, 152], [100, 158]], [[72, 148], [96, 142], [112, 136]],
      [[72, 148], [76, 136], [74, 126], [66, 116], [60, 106]], // down to the ice and the shanties
      [[96, 142], [98, 132], [104, 122], [108, 110]], // to the rink
      [[100, 158], [124, 166], [140, 166], [150, 166]], // to the kennels
      [[50, 154], [30, 160], [20, 150]], [[30, 160], [10, 170]], [[72, 162], [52, 176], [36, 182]], [[52, 176], [52, 188]], [[92, 166], [96, 184]], [[110, 168], [122, 176]],
    ];
    const pos = [], col = [], idx = [], c1 = new THREE.Color('#d9e1e8'), c2 = new THREE.Color('#c8d2dc'), tmp = new THREE.Color();
    for (const pts of lanes) {
      const dense = [];
      for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 1.5)); for (let k = 0; k < n; k++) dense.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
      dense.push(pts[pts.length - 1]);
      const base = pos.length / 3;
      dense.forEach(([u, v], i) => {
        const [pu, pv] = dense[Math.max(0, i - 1)], [nu, nv] = dense[Math.min(dense.length - 1, i + 1)];
        let tx = nu - pu, tz = nv - pv; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        for (const s of [-1, 1]) {
          const uu = u - tz * s * 1.3, vv = v + tx * s * 1.3, p = toWorld(uu, vv);
          pos.push(p.x, this.ground(uu, vv) + 0.035, p.z);
          tmp.copy(c1).lerp(c2, ((i * 7 + (s > 0 ? 3 : 0)) % 5) / 5); col.push(tmp.r, tmp.g, tmp.b);
        }
        if (i) { const a = base + (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true; m.name = 'hearthwick-paths'; this.group.add(m);
  }

  /** Lamp posts along the paths and round the green, and strings of lights between them over the green. */
  buildLamps() {
    const spots = [[52, 152], [58, 140], [72, 136], [86, 140], [92, 152], [84, 162], [46, 150], [100, 150], [76, 132], [68, 120], [38, 126], [104, 128], [112, 162], [136, 164], [40, 168], [96, 172]];
    const items = spots.map(([u, v]) => { const p = toWorld(u, v); addCircle(p.x, p.z, 0.25); return { x: p.x, y: this.ground(u, v), z: p.z }; });
    this.lamps = instanced(this.group, 'hw_lamppost', items);
    this.lampSpots = items;
    // warm light spilling from the lodge porch and the trading post (the lamps themselves glow)
    for (const id of ['lodge', 'trading']) {
      const b = BUILDINGS.find((q) => q.id === id), d = b.hd + 1.2;
      const l = new THREE.PointLight('#ffc27a', 1.4, 16, 1.5); l.position.set(b.x + Math.sin(b.ry) * d, b.y + 2.6, b.z + Math.cos(b.ry) * d); this.group.add(l);
    }
    // strings of warm bulbs, sagging between the green's lamp posts
    const ring = items.slice(0, 6), bulbs = [], line = [];
    for (let i = 0; i < ring.length; i++) {
      if (i === ring.length - 1) break; // (an open string: five swags round the green, not back across it)
      const a = ring[i], b = ring[(i + 1) % ring.length];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + 2.9 + (b.y - a.y) * t - Math.sin(t * Math.PI) * 0.6;
        line.push(new THREE.Vector3(x, y, z)); if (k % 2 === 1) bulbs.push({ x, y: y - 0.06, z });
      }
    }
    this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), new THREE.LineBasicMaterial({ color: '#2a2420' })));
    const bulbGeo = new THREE.SphereGeometry(0.07, 6, 4), colors = ['#ffd27a', '#ff8a6a', '#8ad8ff', '#a8ff9a', '#ffd27a'];
    this.bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), bulbs.length);
    const m4 = new THREE.Matrix4();
    bulbs.forEach((b, i) => { m4.makeTranslation(b.x, b.y, b.z); this.bulbs.setMatrixAt(i, m4); this.bulbs.setColorAt(i, new THREE.Color(colors[i % colors.length])); });
    this.group.add(this.bulbs);
  }

  /** Each frame while you're up north: chimney smoke and bonfire sparks near you, the fire flickering, bulbs twinkling. */
  update(dt, t, me) {
    const fx = this.game.fx;
    this.smokeT = (this.smokeT || 0) + dt;
    if (this.smokeT > 0.2) {
      this.smokeT = 0;
      for (const c of this.smoke) if (Math.random() < 0.34 && Math.abs(c.x - me.x) < 110 && Math.abs(c.z - me.z) < 110) fx.smoke(c);
      if (this.bonfire.distanceTo(me) < 60) { fx.ember(this.bonfire); fx.ember(this.bonfire); if (Math.random() < 0.5) fx.smoke(this.bonfire.clone().setY(this.bonfire.y + 1.2)); }
    }
    if (this.dogs && this.kennelCenter.distanceTo(me) < 120) this.dogs.update(dt, me);
    if (this.fireLight) this.fireLight.intensity = 2.0 + Math.sin(t * 11) * 0.25 + Math.sin(t * 17.3) * 0.2 + Math.sin(t * 5.1) * 0.15;
  }

  /** Show or hide one shanty (hidden while you're inside it: the cutaway takes its place). */
  showShanty(sh, on) {
    const m4 = new THREE.Matrix4();
    for (const im of this.shantyMeshes[sh.c] || []) {
      if (on) m4.compose(new THREE.Vector3(sh.x, ICE_Y, sh.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sh.ry), new THREE.Vector3(1, 1, 1));
      else m4.makeScale(0, 0, 0);
      im.setMatrixAt(sh.idx, m4); im.instanceMatrix.needsUpdate = true;
    }
  }

  /** A porch (or other floor) under (x, z)? Its height, else null. */
  floorAt(x, z) { for (const f of this.floors) if (x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1) return f.y; return null; }
}
