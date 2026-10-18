// Your cabin: a cozy room with an aquarium where the fish you choose swim, decor you buy from Gus,
// and a wall mount for your best catch. Friends who are on the lake can visit: your layout rides in
// your presence (a few ids, nothing else), so their game builds the same room.
import * as THREE from 'three';
import { buildFish } from '../entities/fish.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { buildDecor, buildPlaque } from '../entities/decorModels.js';

export const DECOR = {
  rug: { name: 'Braided Rug', price: { coins: 450 }, slot: 'floor' },
  armchair: { name: 'Armchair', price: { coins: 900 }, slot: 'seat' },
  lamp: { name: 'Lantern Lamp', price: { coins: 550 }, slot: 'lamp' },
  plant: { name: 'Fern in a Pot', price: { coins: 350 }, slot: 'plant' },
  shelf: { name: 'Bookshelf', price: { coins: 1000 }, slot: 'shelf' },
  stove: { name: 'Wood Stove', price: { coins: 1500 }, slot: 'stove' },
  painting: { name: 'Lake Painting', price: { coins: 800 }, slot: 'wall' },
  mount: { name: 'Trophy Mount', price: { coins: 1200 }, slot: 'mount', desc: 'Shows the heaviest fish you have kept.' },
  tank2: { name: 'Bigger Aquarium', price: { pearls: 60 }, slot: 'tank', desc: 'Room for 8 fish instead of 4.' },
  banner: { name: 'Lake Banner', price: { coins: 650 }, slot: 'banner' },
  catbed: { name: 'Cat Bed (with cat)', price: { pearls: 80 }, slot: 'pet' },
  // earned by completing a lake collection (Fishpedia > Collections)
  plaque_cove: { name: 'Cove Plaque', earned: 'cove', color: '#f2c040' },
  plaque_frost: { name: 'Frostpine Plaque', earned: 'frost', color: '#a8e0f0' },
  plaque_marsh: { name: 'Lilymarsh Plaque', earned: 'marsh', color: '#8ac060' },
  plaque_pond: { name: 'Fern Pond Plaque', earned: 'pond', color: '#6aa070' },
  plaque_river: { name: 'Willow River Plaque', earned: 'river', color: '#7ab0d8' },
  plaque_quarry: { name: 'Quarry Plaque', earned: 'quarry', color: '#b8b0a0' },
  plaque_deep: { name: 'Legends Plaque', earned: 'deep', color: '#c890ff' },
};
// Furniture you can move around in the editor view: default spot [x, z, rotation] and footprint [w, d].
export const MOVABLE = {
  rug: { at: [0, 0.8, 0], size: [4, 3], walk: true },
  armchair: { at: [-2.8, 0.6, 0.5], size: [1.4, 1.3], seat: { h: 0.62, face: 0 } },
  lamp: { at: [3.8, -1.2, 0], size: [0.5, 0.5] },
  plant: { at: [-4.4, -3.4, 0], size: [0.9, 0.9] },
  shelf: { at: [-4.75, -1.2, 0], size: [0.5, 1.8] },
  stove: { at: [4.2, 2.6, 0], size: [1.2, 1.0] },
  catbed: { at: [1.6, 2.8, 0], size: [1.0, 0.8], walk: true },
};
export const ROOM = { x0: -5, x1: 5, z0: -4, z1: 4 };
// v1.13.7: pieces that hang on a wall, movable in the editor along the back wall (0, z = -4) or the left wall (1, x = -5).
// at: [wall, along, height]; size: [width, height]. Stored in home.pos as [wall, along, height].
export const WALL_ITEMS = {
  painting: { at: [0, 0.8, 2.3], size: [1.8, 1.2] },
  banner: { at: [1, 0.4, 2.2], size: [0.9, 1.4] },
  mount: { at: [1, 2.0, 2.4], size: [1.6, 0.9] },
};
const WALL_TOP = 3.1;
// fixed things a wall piece shouldn't cover: the back window and the door ([wall, along0, along1, y0, y1])
const WALL_KEEPOUT = [[0, -3.05, -0.55, 1.2, 3.0], [1, 1.7, 3.1, 0, 2.3]];
/** Keep a wall piece on its wall, inside the room and (when `avoid`) off the window and the door. */
export function clampWall(id, wall, u, y, avoid = true) {
  const sz = WALL_ITEMS[id]?.size || [1, 1];
  const hw = sz[0] / 2, hh = sz[1] / 2;
  const span = wall === 0 ? [ROOM.x0, ROOM.x1] : [ROOM.z0, ROOM.z1];
  const cu = (v) => Math.max(span[0] + hw + 0.1, Math.min(span[1] - hw - 0.1, v));
  const cy = (v) => Math.max(0.6 + hh, Math.min(WALL_TOP - hh, v));
  u = cu(u); y = cy(y);
  if (avoid) for (const [w, a0, a1, y0, y1] of WALL_KEEPOUT) {
    if (w !== wall || u + hw <= a0 || u - hw >= a1 || y + hh <= y0 || y - hh >= y1) continue;
    // step out sideways to the nearer free side (or above, if the side is past the end of the wall)
    const left = a0 - hw - 0.02, right = a1 + hw + 0.02;
    const opts = [left, right].filter((v) => v === cu(v)).sort((a, b) => Math.abs(a - u) - Math.abs(b - u));
    if (opts.length) u = opts[0];
    else if (y1 + hh + 0.02 <= WALL_TOP - hh) y = y1 + hh + 0.02;
  }
  return [wall, Math.round(u * 100) / 100, Math.round(y * 100) / 100];
}
const clampX = (x) => Math.max(ROOM.x0 + 0.4, Math.min(ROOM.x1 - 0.4, x));
const clampZ = (z) => Math.max(ROOM.z0 + 0.4, Math.min(ROOM.z1 - 0.4, z));
export const WALLS = { pine: '#c89a62', moss: '#7a9a6a', sky: '#8ab0c8', rose: '#c89a9a', night: '#4a5470' };
export const FLOORS = { oak: '#8a5a32', birch: '#c8b08a', slate: '#6a6a72', checker: '#9a6a3a' };

// Shrink a fish mesh so it is at most `len` units nose to tail.
function fitFish(m, len) {
  if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
  const bb = m.geometry.boundingBox;
  const cur = (bb.max.x - bb.min.x) * m.scale.x;
  if (cur > len) m.scale.multiplyScalar(len / cur);
  return m;
}
const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
const box = (w, h, d, c, x, y, z, extra) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c, extra)); m.position.set(x, y, z); return m; };

/** A compact, shareable description of a home (rides in presence). */
export function homeLayout(ext, profile) {
  const h = ext.home;
  const tank = (h.tank || []).slice(0, 8).map((f) => [f.speciesId, f.variant === 'gold' ? 'g' : f.variant === 'diamond' ? 'd' : 'n']);
  const all = [...(profile.creel || []), ...(profile.storage || [])];
  const best = all.reduce((a, c) => (!a || c.weight > a.weight ? c : a), null);
  const pos = {};
  for (const [id, v] of Object.entries(h.pos || {})) if ((MOVABLE[id] || WALL_ITEMS[id]) && Array.isArray(v)) pos[id] = v.map((n) => Math.round(n * 100) / 100);
  return { d: (h.decor || []).filter((id) => DECOR[id]).slice(0, 24), t: tank, w: h.wall in WALLS ? h.wall : 'pine', f: h.floor in FLOORS ? h.floor : 'oak', m: best ? [best.speciesId, best.variant === 'normal' ? 'n' : best.variant[0], best.weight] : null, p: pos };
}

// Untrusted (a peer's presence): keep only known ids.
export function sanitizeLayout(l) {
  if (!l || typeof l !== 'object') return null;
  const v = (x) => (x === 'g' ? 'gold' : x === 'd' ? 'diamond' : 'normal');
  return {
    d: Array.isArray(l.d) ? l.d.filter((id) => typeof id === 'string' && DECOR[id]).slice(0, 24) : [],
    t: Array.isArray(l.t) ? l.t.filter((f) => Array.isArray(f) && SPECIES_BY_ID[f[0]]).slice(0, 8).map((f) => ({ speciesId: f[0], variant: v(f[1]) })) : [],
    w: WALLS[l.w] ? l.w : 'pine',
    f: FLOORS[l.f] ? l.f : 'oak',
    m: Array.isArray(l.m) && SPECIES_BY_ID[l.m[0]] ? { speciesId: l.m[0], variant: v(l.m[1]), weight: Math.min(SPECIES_BY_ID[l.m[0]].weight[1], Math.max(0, Number(l.m[2]) || 1)) } : null,
    p: Object.fromEntries(Object.entries(l.p && typeof l.p === 'object' ? l.p : {}).filter(([id, v]) => (MOVABLE[id] || WALL_ITEMS[id]) && Array.isArray(v) && v.length >= 2 && v.every((n) => Number.isFinite(+n)))
      .map(([id, v]) => [id, WALL_ITEMS[id] ? clampWall(id, +v[0] === 1 ? 1 : 0, +v[1], +(v[2] ?? WALL_ITEMS[id].at[2]), false) : [clampX(+v[0]), clampZ(+v[1]), (+v[2] || 0) % (Math.PI * 2)]])),
  };
}

export class HomeScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#2a1e16');
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.yaw = 0.55; this.pitch = 0.5; this.dist = 15; this.mode = 'walk';
    this.scene.add(new THREE.HemisphereLight('#fff4e0', '#4a3a2a', 0.85));
    const sun = new THREE.DirectionalLight('#ffe8c0', 0.7);
    sun.position.set(-4, 9, 6);
    this.scene.add(sun);
    this.lampLight = new THREE.PointLight('#ffc070', 0, 9, 1.5);
    this.lampLight.position.set(3.5, 2.4, -1.5);
    this.scene.add(this.lampLight);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.fish = [];
  }

  /** Build the room from a sanitized layout. */
  build(layout) {
    this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.fish = [];
    const L = layout;
    const R = this.root;
    const wall = WALLS[L.w], floor = FLOORS[L.f];
    // floor planks
    for (let i = 0; i < 10; i++) R.add(box(1, 0.2, 8, i % 2 ? floor : new THREE.Color(floor).offsetHSL(0, 0, 0.04).getStyle(), -4.5 + i, -0.1, 0));
    if (L.f === 'checker') for (let x = 0; x < 10; x++) for (let z = 0; z < 8; z++) if ((x + z) % 2) R.add(box(1, 0.21, 1, '#e8d8b8', -4.5 + x, -0.1, -3.5 + z));
    // walls: back and left, with logs. Each wall is its own group so the walk camera can see through
    // whichever wall is between it and you, instead of being squeezed in close.
    this.walls = { n: new THREE.Group(), w: new THREE.Group(), e: new THREE.Group(), s: new THREE.Group(), ceil: new THREE.Group() };
    for (let y = 0; y < 4; y++) {
      this.walls.n.add(box(10, 0.8, 0.3, y % 2 ? wall : new THREE.Color(wall).offsetHSL(0, 0, -0.05).getStyle(), 0, 0.4 + y * 0.8, -4.15));
      this.walls.w.add(box(0.3, 0.8, 8, y % 2 ? new THREE.Color(wall).offsetHSL(0, 0, -0.04).getStyle() : wall, -5.15, 0.4 + y * 0.8, 0));
    }
    // window with the lake outside
    this.walls.n.add(box(2.4, 1.5, 0.1, '#8fc9f0', -1.8, 2.1, -3.98));
    this.walls.n.add(box(2.4, 0.5, 0.11, '#3a78a8', -1.8, 1.6, -3.97));
    this.walls.n.add(box(2.6, 0.12, 0.2, '#5a3a22', -1.8, 2.9, -3.95), box(2.6, 0.12, 0.2, '#5a3a22', -1.8, 1.32, -3.95), box(0.1, 1.5, 0.15, '#5a3a22', -1.8, 2.1, -3.95));
    // door on the left wall
    this.walls.w.add(box(0.12, 2.2, 1.3, '#6a4024', -4.98, 1.1, 2.4), box(0.14, 0.12, 0.12, '#f2c040', -4.9, 1.1, 1.95));
    R.add(this.walls.n, this.walls.w);
    // aquarium
    const big = L.d.includes('tank2');
    const tw = big ? 3.6 : 2.6;
    // v1.13.11: cabinet, gravel, plants and hood are one model per size; the glass stays a see-through box
    const cab = buildDecor(big ? 'tank2' : 'tank'); cab.position.set(2.2, 0, -3.2); R.add(cab);
    const glass = box(tw, 1.5, 1.0, '#9fe0f8', 2.2, 1.65, -3.2, { transparent: true, opacity: 0.32, depthWrite: false });
    glass.renderOrder = 2;
    R.add(glass);
    this.tank = { x: 2.2, y: 1.7, z: -3.2, w: tw - 0.5, h: 0.9, d: 0.6 };
    for (const f of L.t.slice(0, big ? 8 : 4)) {
      const m = fitFish(buildFish(f.speciesId, f.variant), 0.7);
      m.userData = { ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.4, y: Math.random() };
      this.fish.push(m);
      R.add(m);
    }
    // the other two walls and a ceiling: hidden in the editor (dollhouse) view, there when you walk around
    this.cut = new THREE.Group();
    for (let y = 0; y < 4; y++) {
      this.walls.e.add(box(0.3, 0.8, 8, y % 2 ? wall : new THREE.Color(wall).offsetHSL(0, 0, -0.04).getStyle(), 5.15, 0.4 + y * 0.8, 0));
      this.walls.s.add(box(10.6, 0.8, 0.3, y % 2 ? new THREE.Color(wall).offsetHSL(0, 0, -0.05).getStyle() : wall, 0, 0.4 + y * 0.8, 4.15));
    }
    this.walls.s.add(box(2.0, 1.3, 0.1, '#8fc9f0', 1.5, 2.0, 3.98), box(2.2, 0.12, 0.2, '#5a3a22', 1.5, 2.7, 3.95), box(2.2, 0.12, 0.2, '#5a3a22', 1.5, 1.32, 3.95));
    this.walls.ceil.add(box(10.6, 0.2, 8.6, new THREE.Color(wall).offsetHSL(0, 0, -0.12).getStyle(), 0, 3.3, 0));
    for (let i = 0; i < 5; i++) this.walls.ceil.add(box(0.3, 0.3, 8.4, '#5a3a22', -4 + i * 2, 3.1, 0));
    this.cut.add(this.walls.e, this.walls.s, this.walls.ceil);
    R.add(this.cut);
    // a built-in bench under the window, with a cushion: somewhere to sit and look at the lake
    const bench = buildDecor('bench'); bench.position.set(-1.8, 0, -3.6); R.add(bench);
    this.colliders = [{ x: -1.8, z: -3.6, w: 2.6, d: 0.8 }, { x: 2.2, z: -3.2, w: tw + 0.3, d: 1.3 }];
    this.seats = [{ id: 'bench', x: -1.8, z: -3.2, y: 0.52, yaw: 0, label: 'Sit by the window' }];
    // decor: wall pieces stay put; furniture can be moved in the editor view
    const has = (id) => L.d.includes(id);
    this.items = {};
    const placeItem = (id, g) => {
      const m = MOVABLE[id];
      const [x, z, r] = L.p?.[id] || m.at;
      g.position.set(x, 0, z); g.rotation.y = r || 0;
      g.userData.decorId = id;
      R.add(g);
      this.items[id] = g;
      if (!m.walk) {
        const sw = Math.abs(Math.cos(r || 0)) * m.size[0] + Math.abs(Math.sin(r || 0)) * m.size[1], sd = Math.abs(Math.sin(r || 0)) * m.size[0] + Math.abs(Math.cos(r || 0)) * m.size[1];
        this.colliders.push({ x, z, w: sw, d: sd, id });
      }
      if (m.seat) this.seats.push({ id, x: x + Math.sin(r || 0) * 0.05, z: z + Math.cos(r || 0) * 0.05, y: m.seat.h, yaw: (r || 0) + m.seat.face, label: 'Sit in the armchair' });
    };
    // v1.13.11: every piece is a detailed model (art/src/decor.py, src/entities/decorModels.js)
    if (has('rug')) placeItem('rug', buildDecor('rug'));
    if (has('armchair')) placeItem('armchair', buildDecor('armchair'));
    if (has('lamp')) {
      const lampG = buildDecor('lamp');
      placeItem('lamp', lampG);
      this.lampLight.position.set(lampG.position.x, 2.4, lampG.position.z);
      this.lampLight.intensity = 2.2;
    } else this.lampLight.intensity = 0;
    if (has('plant')) placeItem('plant', buildDecor('plant'));
    if (has('shelf')) placeItem('shelf', buildDecor('shelf'));
    if (has('stove')) placeItem('stove', buildDecor('stove'));
    // v1.13.7: wall pieces hang on the back or left wall and move along it in the editor (local +z faces into the room)
    const placeWall = (id, g) => {
      const [wall, u, y] = L.p?.[id] && WALL_ITEMS[id] ? L.p[id] : WALL_ITEMS[id].at;
      if (wall === 1) { g.position.set(ROOM.x0, y, u); g.rotation.y = Math.PI / 2; } else { g.position.set(u, y, ROOM.z0); g.rotation.y = 0; }
      g.userData.decorId = id; g.userData.wall = wall; g.userData.u = u; g.userData.y = y;
      R.add(g);
      this.items[id] = g;
    };
    if (has('painting')) placeWall('painting', buildDecor('painting'));
    if (has('banner')) placeWall('banner', buildDecor('banner'));
    // collection plaques: a row of golden fish on boards along the right of the back wall
    L.d.filter((id) => id.startsWith('plaque_')).forEach((id, i) => {
      const x = 4.4 - (i % 4) * 0.75, y = 2.9 - Math.floor(i / 4) * 0.7;
      const pq = buildPlaque(DECOR[id].color); pq.position.set(x, y, ROOM.z0); R.add(pq);
    });
    if (has('catbed')) placeItem('catbed', buildDecor('catbed'));
    if (has('mount') && L.m) {
      const m = fitFish(buildFish(L.m.speciesId, L.m.variant, L.m.weight), 1.4);
      m.position.set(0, 0, 0.15);
      const mg = buildDecor('mount'); mg.add(m); placeWall('mount', mg);
    }
    this.door = { x: -4.4, z: 2.4 };
    this.layout = L;
    if (this.avatar) R.add(this.avatar.group);
  }

  /** Is this spot free to stand on? (inside the walls, not in furniture) */
  canStand(x, z, r = 0.3) {
    if (x < ROOM.x0 + r || x > ROOM.x1 - r || z < ROOM.z0 + r || z > ROOM.z1 - r) return false;
    for (const c of this.colliders || []) if (Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r) return false;
    return true;
  }

  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  update(dt, t) {
    this.onTick?.(dt, t);
    const T = this.tank;
    for (const f of this.fish) {
      const u = f.userData;
      const a = t * u.sp + u.ph;
      f.position.set(T.x + Math.sin(a) * T.w / 2, T.y + Math.sin(a * 0.7 + u.ph) * 0.25 + (u.y - 0.5) * 0.4, T.z + Math.cos(a * 1.3) * T.d / 2 * 0.6);
      f.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
      f.rotation.z = Math.sin(t * 6 + u.ph) * 0.08;
    }
    const fov = this.mode === 'walk' ? 60 : 45;
    if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    if (this.mode === 'walk' && this.avatar) {
      // third person at the distance you chose (wheel), orbiting where you drag. The camera is never pushed
      // in: any wall (or the ceiling) between it and you just turns invisible.
      const av = this.avatar.group.position;
      const cy = this.walkYaw ?? 0, cp = this.walkPitch ?? 0.55, d = this.walkDist ?? 4.6;
      const want = new THREE.Vector3(av.x + Math.sin(cy) * Math.cos(cp) * d, 1.15 + Math.sin(cp) * d, av.z + Math.cos(cy) * Math.cos(cp) * d);
      if (!this.camInit) { this.camera.position.copy(want); this.camInit = true; } else this.camera.position.lerp(want, 0.25);
      this.camera.lookAt(av.x, 1.05, av.z);
      const c = this.camera.position, W = this.walls;
      if (this.cut) this.cut.visible = true;
      if (W) { W.n.visible = c.z > -4.0; W.s.visible = c.z < 4.0; W.w.visible = c.x > -5.0; W.e.visible = c.x < 5.0; W.ceil.visible = c.y < 3.15; }
      return;
    }
    this.camInit = false;
    if (this.walls) for (const w of Object.values(this.walls)) w.visible = true;
    if (this.cut) this.cut.visible = false;
    const d = this.dist;
    const tx = this.panX || 0, tz = this.panZ || 0;
    this.camera.position.set(tx + Math.sin(this.yaw) * Math.cos(this.pitch) * d, 1 + Math.sin(this.pitch) * d, tz + Math.cos(this.yaw) * Math.cos(this.pitch) * d);
    this.camera.lookAt(tx, 1, tz - 0.6);
  }
}
