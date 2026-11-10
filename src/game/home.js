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
  // trophies (earned, never sold)
  rug3: { name: 'Great Room Rug', model: 'rug', price: { coins: 900 }, slot: 'floor', tier: 2, desc: 'A big braided rug. Needs the Lodge.' },
  armchair3: { name: 'Fireside Armchair', model: 'armchair', price: { coins: 1800 }, slot: 'seat', tier: 2, desc: 'An armchair for the Lodge\'s fire. Needs the Lodge.' },
  plant3: { name: 'Great Room Fern', model: 'plant', price: { coins: 700 }, slot: 'plant', tier: 2, desc: 'One more fern. Needs the Lodge.' },
  // v1.17.1: seconds for the Cottage's den (the same pieces, a second of each; `tier` = the home they need)
  rug2: { name: 'Den Rug', model: 'rug', price: { coins: 450 }, slot: 'floor', tier: 1, desc: 'A second braided rug. Needs the Cottage.' },
  armchair2: { name: 'Den Armchair', model: 'armchair', price: { coins: 900 }, slot: 'seat', tier: 1, desc: 'A second armchair. Needs the Cottage.' },
  lamp2: { name: 'Den Lamp', model: 'lamp', price: { coins: 550 }, slot: 'lamp', tier: 1, desc: 'A second lantern lamp. Needs the Cottage.' },
  plant2: { name: 'Den Fern', model: 'plant', price: { coins: 350 }, slot: 'plant', tier: 1, desc: 'A second fern in a pot. Needs the Cottage.' },
  shelf2: { name: 'Den Bookshelf', model: 'shelf', price: { coins: 1000 }, slot: 'shelf', tier: 1, desc: 'A second bookshelf. Needs the Cottage.' },
  // v1.17.15: for the Lakehouse's sunroom on the water
  rug4: { name: 'Sunroom Rug', model: 'rug', price: { coins: 1200 }, slot: 'floor', tier: 3, desc: 'A braided rug for the sunroom. Needs the Lakehouse.' },
  armchair4: { name: 'Sunroom Armchair', model: 'armchair', price: { coins: 2400 }, slot: 'seat', tier: 3, desc: 'An armchair by the glass, looking out on the water. Needs the Lakehouse.' },
  plant4: { name: 'Sunroom Fern', model: 'plant', price: { coins: 900 }, slot: 'plant', tier: 3, desc: 'A fern that loves the light. Needs the Lakehouse.' },
  shelf4: { name: 'Sunroom Bookshelf', model: 'shelf', price: { coins: 2000 }, slot: 'shelf', tier: 3, desc: 'A bookshelf for the sunroom. Needs the Lakehouse.' },
  // v1.17.15 the ending moment (src/game/finale.js): from the townsfolk, once every quest line is finished
  trophy_saga: { name: 'Friends of the Water Cup', earned: 'saga', how: 'Finish every quest line', slot: 'floor', desc: 'A golden cup on a stand, from the townsfolk, for finishing every quest line.' },
};

// v1.17.1: bigger homes. Your place grows in tiers; each needs a level and some lake collections, and costs coins (or
// pearls instead of the coins: never instead of the level or the collections). The Cottage adds a den through a
// doorway in the east wall, the Lodge a great room past the den, and the Lakehouse (v1.17.15) a sunroom on the water
// off the great room, plus a house of its own with a dock on Cozy Cove's west shore (src/world/homeplot.js). Outside,
// the cabin up the hill grows with the tier too.
/** Another map's home pieces: their DECOR entries, where they stand (MOVABLE) or hang (WALL_ITEMS), and a builder. */
const DECOR_BUILDERS = {};
export function addDecor({ decor = {}, movable = {}, wall = {}, build }) {
  Object.assign(DECOR, decor); Object.assign(MOVABLE, movable); Object.assign(WALL_ITEMS, wall);
  for (const id of Object.keys(decor)) DECOR_BUILDERS[id] = build;
}

export const HOME_TIERS = [
  { id: 'cabin', name: 'Cabin' },
  { id: 'cottage', name: 'Cottage', level: 10, collections: 2, price: { coins: 25000 }, alt: { pearls: 150 },
    desc: 'Knock through the east wall into a den: a quilted bed, two more windows, and room for a second rug, armchair, lamp, fern and bookshelf.' },
  { id: 'lodge', name: 'Lodge', level: 20, collections: 4, price: { coins: 90000 }, alt: { pearls: 450 },
    desc: 'Build on a great room past the den: a stone fireplace, a long table, tall windows on the lake, and room for one more rug, armchair and fern.' },
  { id: 'lakehouse', name: 'Lakehouse', level: 30, collections: 6, price: { coins: 220000 }, alt: { pearls: 1100 },
    desc: 'A house on the west shore of Cozy Cove with its own dock to fish from, and a glass sunroom on the water off the great room, with room for one more rug, armchair, fern and bookshelf.' },
];
/** The tier a save or a layout really has: a whole number from 0 (the Cabin) to the biggest there is. */
export function homeTier(h) {
  const t = Math.floor(Number(h?.tier ?? h) || 0);
  return Math.max(0, Math.min(HOME_TIERS.length - 1, t));
}
/** What's still missing before you can buy a tier: [] when it's yours to buy. */
export function tierNeeds(tier, profile, ext) {
  const T = HOME_TIERS[tier]; if (!T) return ['There is no bigger home yet'];
  const out = [];
  if ((profile.level || 1) < T.level) out.push(`Reach level ${T.level} (you're ${profile.level || 1})`);
  const done = Object.keys(ext.collections || {}).length;
  if (done < T.collections) out.push(`Complete ${T.collections} lake collections (${done} so far)`);
  if (tier === 1 && !ext.saga?.unlocks?.cottage) out.push('Help out on The Lost Survey, from Gus');
  if (tier === 2 && !ext.saga?.unlocks?.lodge) out.push('Finish The Lost Survey, from Gus');
  return out;
}
// Furniture you can move around in the editor view: default spot [x, z, rotation] and footprint [w, d].
export const MOVABLE = {
  rug: { at: [0, 0.8, 0], size: [4, 3], walk: true },
  armchair: { at: [-2.8, 0.6, 0.5], size: [1.4, 1.3], seat: { h: 0.62, face: 0 } },
  lamp: { at: [3.8, -1.2, 0], size: [0.5, 0.5] },
  plant: { at: [-4.4, -3.4, 0], size: [0.9, 0.9] },
  shelf: { at: [-4.75, -1.2, 0], size: [0.5, 1.8] },
  stove: { at: [4.2, 2.6, 0], size: [1.2, 1.0] },
  catbed: { at: [1.6, 2.8, 0], size: [1.0, 0.8], walk: true },
  rug2: { at: [7.6, -0.4, 0], size: [4, 3], walk: true },
  armchair2: { at: [9.2, 0.9, -1.95], size: [1.4, 1.3], seat: { h: 0.62, face: 0 } },
  lamp2: { at: [10.5, 1.6, 0], size: [0.5, 0.5] },
  plant2: { at: [5.6, -3.4, 0], size: [0.9, 0.9] },
  shelf2: { at: [10.75, -0.6, Math.PI], size: [0.5, 1.8] },
  rug3: { at: [15, 0.5, 0], size: [4, 3], walk: true },
  rug4: { at: [15, 6.6, 0], size: [4, 3], walk: true },
  armchair4: { at: [12.4, 7.6, 2.4], size: [1.4, 1.3], seat: { h: 0.62, face: 0 } },
  plant4: { at: [18.4, 4.6, 0], size: [0.9, 0.9] },
  shelf4: { at: [11.3, 5.4, 0], size: [0.5, 1.8] },
  armchair3: { at: [15.4, 1.6, 2.6], size: [1.4, 1.3], seat: { h: 0.62, face: 0 } },
  plant3: { at: [11.8, 3.3, 0], size: [0.9, 0.9] },
  trophy_saga: { at: [-1.6, 3.35, Math.PI], size: [0.7, 0.7] },
};
export const ROOM = { x0: -5, x1: 5, z0: -4, z1: 4 };
// the Cottage's den, east of the main room, and the doorway between them (in the main room's east wall)
export const DEN = { x0: 5, x1: 11, z0: -4, z1: 2 };
export const DOORWAY = { z0: -1, z1: 1 };
// the Lodge's great room, east of the den, through a doorway of the same size in the den's east wall
export const GREAT = { x0: 11, x1: 19, z0: -4, z1: 4 };
// the Lakehouse's sunroom, south of the great room through a doorway in its window wall, with glass on three sides
export const SUN = { x0: 11, x1: 19, z0: 4.3, z1: 9 };
export const SUN_DOOR = { x0: 14, x1: 16 };
/** Keep a floor piece (half sizes hw, hd) inside the room it's in: the main room, or (a Cottage) the den. */
export function clampFloor(x, z, hw, hd, tier = 0) {
  const R = tier >= 3 && x > DEN.x1 && z > GREAT.z1 ? SUN : tier >= 2 && x > DEN.x1 ? GREAT : tier >= 1 && x > ROOM.x1 ? DEN : ROOM;
  return [Math.max(R.x0 + hw, Math.min(R.x1 - hw, x)), Math.max(R.z0 + hd, Math.min(R.z1 - hd, z))];
}
// v1.13.7: pieces that hang on a wall, movable in the editor along the back wall (0, z = -4) or the left wall (1, x = -5).
// at: [wall, along, height]; size: [width, height]. Stored in home.pos as [wall, along, height].
export const WALL_ITEMS = {
  painting: { at: [0, 0.8, 2.3], size: [1.8, 1.2] },
  banner: { at: [1, 0.4, 2.2], size: [0.9, 1.4] },
  mount: { at: [1, 2.0, 2.4], size: [1.6, 0.9] },
};
const WALL_TOP = 3.1;
const DEN_BED = { x: 8.7, z: -2.8, w: 1.7, d: 2.3 };
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

/** v1.17.15 the townsfolk's trophy for finishing every quest line: a golden cup with two handles on a wooden stand, a brass
 *  plate on the front (local +z) and a little gold fish leaping off the lid. About 1.5 m tall, 0.7 m square. */
export function buildSagaTrophy() {
  const g = new THREE.Group(), wood = '#5a3a22', woodD = '#3e2616', gold = { emissive: '#4a3000' }, G = '#e8b830';
  const mesh = (geo, c, x, y, z, extra) => { const m = new THREE.Mesh(geo, lam(c, extra)); m.position.set(x, y, z); return m; };
  g.add(box(0.62, 0.74, 0.62, wood, 0, 0.41, 0), box(0.72, 0.08, 0.72, woodD, 0, 0.04, 0), box(0.7, 0.06, 0.7, woodD, 0, 0.81, 0));
  g.add(box(0.36, 0.14, 0.012, '#d8b050', 0, 0.5, 0.316, gold), box(0.3, 0.02, 0.014, '#7a5a20', 0, 0.52, 0.318), box(0.22, 0.02, 0.014, '#7a5a20', 0, 0.48, 0.318));
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.07, 20), G, 0, 0.875, 0, gold)); // foot
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.2, 12), G, 0, 1.01, 0, gold)); // stem
  const bowl = new THREE.LatheGeometry([[0.02, 0], [0.12, 0.02], [0.2, 0.1], [0.24, 0.24], [0.25, 0.34], [0.23, 0.34], [0.22, 0.25]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
  g.add(mesh(bowl, G, 0, 1.1, 0, { ...gold, side: THREE.DoubleSide }));
  for (const s of [-1, 1]) { const hd = mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 16, Math.PI * 1.2), G, s * 0.25, 1.3, 0, gold); hd.rotation.z = s > 0 ? -Math.PI * 0.6 : Math.PI * 0.4; g.add(hd); }
  g.add(mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.03, 24), G, 0, 1.455, 0, gold)); // lid
  const fish = new THREE.Group(); fish.position.set(0, 1.56, 0); fish.rotation.z = 0.5;
  fish.add(mesh(new THREE.SphereGeometry(0.07, 12, 8).scale(1.6, 1, 0.55), G, 0, 0, 0, gold), mesh(new THREE.ConeGeometry(0.06, 0.1, 4).rotateZ(Math.PI / 2).scale(1, 1, 0.3), G, -0.15, 0, 0, gold));
  g.add(fish, mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), G, 0, 1.5, 0, gold));
  return g;
}

/** A compact, shareable description of a home (rides in presence). */
export function homeLayout(ext, profile) {
  const h = ext.home;
  const tank = (h.tank || []).slice(0, 8).map((f) => [f.speciesId, f.variant === 'gold' ? 'g' : f.variant === 'diamond' ? 'd' : 'n']);
  const all = [...(profile.creel || []), ...(profile.storage || [])];
  const best = all.reduce((a, c) => (!a || c.weight > a.weight ? c : a), null);
  const pos = {};
  for (const [id, v] of Object.entries(h.pos || {})) if ((MOVABLE[id] || WALL_ITEMS[id]) && Array.isArray(v)) pos[id] = v.map((n) => Math.round(n * 100) / 100);
  const tier = homeTier(h);
  return { h: tier, d: (h.decor || []).filter((id) => DECOR[id] && (DECOR[id].tier || 0) <= tier).slice(0, 40), t: tank, w: h.wall in WALLS ? h.wall : 'pine', f: h.floor in FLOORS ? h.floor : 'oak', m: best ? [best.speciesId, best.variant === 'normal' ? 'n' : best.variant[0], best.weight] : null, p: pos };
}

// Untrusted (a peer's presence): keep only known ids.
export function sanitizeLayout(l) {
  if (!l || typeof l !== 'object') return null;
  const v = (x) => (x === 'g' ? 'gold' : x === 'd' ? 'diamond' : 'normal');
  const tier = [1, 2, 3].includes(l.h) ? l.h : 0;
  return {
    h: tier,
    d: Array.isArray(l.d) ? l.d.filter((id) => typeof id === 'string' && DECOR[id] && (DECOR[id].tier || 0) <= tier).slice(0, 40) : [],
    t: Array.isArray(l.t) ? l.t.filter((f) => Array.isArray(f) && SPECIES_BY_ID[f[0]]).slice(0, 8).map((f) => ({ speciesId: f[0], variant: v(f[1]) })) : [],
    w: WALLS[l.w] ? l.w : 'pine',
    f: FLOORS[l.f] ? l.f : 'oak',
    m: Array.isArray(l.m) && SPECIES_BY_ID[l.m[0]] ? { speciesId: l.m[0], variant: v(l.m[1]), weight: Math.min(SPECIES_BY_ID[l.m[0]].weight[1], Math.max(0, Number(l.m[2]) || 1)) } : null,
    p: Object.fromEntries(Object.entries(l.p && typeof l.p === 'object' ? l.p : {}).filter(([id, v]) => (MOVABLE[id] || WALL_ITEMS[id]) && Array.isArray(v) && v.length >= 2 && v.every((n) => Number.isFinite(+n)))
      .map(([id, v]) => [id, WALL_ITEMS[id] ? clampWall(id, +v[0] === 1 ? 1 : 0, +v[1], +(v[2] ?? WALL_ITEMS[id].at[2]), false) : [...clampFloor(+v[0], +v[1], 0.4, 0.4, tier), (+v[2] || 0) % (Math.PI * 2)]])),
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
    this.lampLight2 = new THREE.PointLight('#ffc070', 0, 8, 1.5); this.scene.add(this.lampLight2); // (the den's lamp)
    this.sunLight = new THREE.PointLight('#fff2d8', 0, 14, 1.2); this.sunLight.position.set(15, 2.8, 6.5); this.scene.add(this.sunLight); // (the sunroom's daylight)
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.fish = [];
    this.door2Z = 7.3;
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
    const tier = this.tier = homeTier(L.h);
    const shade = (k) => new THREE.Color(wall).offsetHSL(0, 0, k).getStyle();
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
      const ec = y % 2 ? wall : shade(-0.04);
      if (tier && y < 3) { // (the Cottage: a doorway through to the den, 2 m wide and 2.4 m high)
        for (const zc of [(ROOM.z0 + DOORWAY.z0) / 2, (DOORWAY.z1 + ROOM.z1) / 2]) this.walls.e.add(box(0.3, 0.8, DOORWAY.z0 - ROOM.z0, ec, 5.15, 0.4 + y * 0.8, zc));
      } else this.walls.e.add(box(0.3, 0.8, 8, ec, 5.15, 0.4 + y * 0.8, 0));
      this.walls.s.add(box(10.6, 0.8, 0.3, y % 2 ? new THREE.Color(wall).offsetHSL(0, 0, -0.05).getStyle() : wall, 0, 0.4 + y * 0.8, 4.15));
    }
    this.walls.s.add(box(2.0, 1.3, 0.1, '#8fc9f0', 1.5, 2.0, 3.98), box(2.2, 0.12, 0.2, '#5a3a22', 1.5, 2.7, 3.95), box(2.2, 0.12, 0.2, '#5a3a22', 1.5, 1.32, 3.95));
    this.walls.ceil.add(box(10.6, 0.2, 8.6, new THREE.Color(wall).offsetHSL(0, 0, -0.12).getStyle(), 0, 3.3, 0));
    for (let i = 0; i < 5; i++) this.walls.ceil.add(box(0.3, 0.3, 8.4, '#5a3a22', -4 + i * 2, 3.1, 0));
    this.cut.add(this.walls.e, this.walls.s, this.walls.ceil);
    R.add(this.cut);
    if (tier) this.buildDen(L, wall, floor, shade);
    if (tier >= 2) this.buildGreatRoom(L, wall, floor, shade);
    this.sunLight.intensity = tier >= 3 ? 1.6 : 0;
    // a built-in bench under the window, with a cushion: somewhere to sit and look at the lake
    const bench = buildDecor('bench'); bench.position.set(-1.8, 0, -3.6); R.add(bench);
    this.colliders = [{ x: -1.8, z: -3.6, w: 2.6, d: 0.8 }, { x: 2.2, z: -3.2, w: tw + 0.3, d: 1.3 }];
    this.seats = [{ id: 'bench', x: -1.8, z: -3.2, y: 0.52, yaw: 0, label: 'Sit by the window' }];
    if (tier >= 2) { this.colliders.push({ x: 13.2, z: -1.6, w: 2.5, d: 3.7 }, { x: GREAT.x1 - 0.4, z: 0, w: 1, d: 3.3 }); this.seats.push({ id: 'greatbench', x: 14.2, z: -1.6, y: 0.5, yaw: -Math.PI / 2, label: 'Sit at the long table' }); }
    if (tier) { this.colliders.push({ x: DEN_BED.x, z: DEN_BED.z, w: DEN_BED.w + 0.1, d: DEN_BED.d + 0.1 }); this.seats.push({ id: 'bed', x: DEN_BED.x, z: DEN_BED.z + DEN_BED.d / 2 - 0.35, y: 0.56, yaw: 0, label: 'Sit on the bed' }); }
    if (tier >= 3) this.buildSunroom(L, wall, floor, shade);
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
    const model = (id) => buildDecor(DECOR[id]?.model || id);
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
    // the den's seconds (v1.17.1)
    for (const id of ['rug2', 'armchair2', 'plant2', 'shelf2']) if (tier && has(id)) placeItem(id, model(id));
    if (tier && has('lamp2')) { const lg = model('lamp2'); placeItem('lamp2', lg); this.lampLight2.position.set(lg.position.x, 2.4, lg.position.z); this.lampLight2.intensity = 2.0; }
    else this.lampLight2.intensity = 0;
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
    for (const [id, build] of Object.entries(DECOR_BUILDERS)) if (has(id)) (WALL_ITEMS[id] ? placeWall : placeItem)(id, build(id)); // another map's pieces (addDecor)
    if (tier >= 2) for (const id of ['rug3', 'armchair3', 'plant3']) if (has(id)) placeItem(id, model(id));
    if (tier >= 3) for (const id of ['rug4', 'armchair4', 'plant4', 'shelf4']) if (has(id)) placeItem(id, model(id));
    // collection plaques: a row of golden fish on boards along the right of the back wall
    L.d.filter((id) => id.startsWith('plaque_')).forEach((id, i) => {
      const x = 4.4 - (i % 4) * 0.75, y = 2.9 - Math.floor(i / 4) * 0.7;
      const pq = buildPlaque(DECOR[id].color); pq.position.set(x, y, ROOM.z0); R.add(pq);
    });
    if (has('catbed')) placeItem('catbed', buildDecor('catbed'));
    if (has('trophy_saga')) placeItem('trophy_saga', buildSagaTrophy());
    if (has('mount') && L.m) {
      const m = fitFish(buildFish(L.m.speciesId, L.m.variant, L.m.weight), 1.4);
      m.position.set(0, 0, 0.15);
      const mg = buildDecor('mount'); mg.add(m); placeWall('mount', mg);
    }
    this.door = { x: -4.4, z: 2.4 };
    this.door2 = tier >= 3 ? { x: SUN.x1 - 0.6, z: this.door2Z } : null; // (the Lakehouse: the sunroom's door out to your dock)
    this.layout = L;
    if (this.avatar) R.add(this.avatar.group);
  }

  /** The Cottage's den: floor, log walls with two windows, a ceiling, the doorway's frame and a quilted bed. */
  buildDen(L, wall, floor, shade) {
    const R = this.root, D = DEN, W = this.walls, cx = (D.x0 + D.x1) / 2, cz = (D.z0 + D.z1) / 2, lx = D.x1 - D.x0, lz = D.z1 - D.z0;
    for (let i = 0; i < lx; i++) R.add(box(1, 0.2, lz, i % 2 ? floor : new THREE.Color(floor).offsetHSL(0, 0, 0.04).getStyle(), D.x0 + 0.5 + i, -0.1, cz));
    if (L.f === 'checker') for (let x = 0; x < lx; x++) for (let z = 0; z < lz; z++) if ((x + z) % 2) R.add(box(1, 0.21, 1, '#e8d8b8', D.x0 + 0.5 + x, -0.1, D.z0 + 0.5 + z));
    W.de = new THREE.Group(); W.ds = new THREE.Group();
    for (let y = 0; y < 4; y++) {
      W.n.add(box(lx + 0.3, 0.8, 0.3, y % 2 ? wall : shade(-0.05), cx + 0.15, 0.4 + y * 0.8, D.z0 - 0.15));
      if (this.tier >= 2 && y < 3) for (const [z0, z1] of [[D.z0 - 0.3, DOORWAY.z0], [DOORWAY.z1, D.z1 + 0.3]]) W.de.add(box(0.3, 0.8, z1 - z0, y % 2 ? shade(-0.04) : wall, D.x1 + 0.15, 0.4 + y * 0.8, (z0 + z1) / 2));
      else W.de.add(box(0.3, 0.8, lz + 0.6, y % 2 ? shade(-0.04) : wall, D.x1 + 0.15, 0.4 + y * 0.8, cz));
      W.ds.add(box(lx + 0.3, 0.8, 0.3, y % 2 ? shade(-0.05) : wall, cx + 0.15, 0.4 + y * 0.8, D.z1 + 0.15));
    }
    // a window in the north wall (the hill behind) and one in the east wall (morning sun)
    const frame = '#5a3a22';
    W.n.add(box(1.8, 1.3, 0.1, '#8fc9f0', 6.6, 2.0, D.z0 + 0.02), box(2.0, 0.12, 0.2, frame, 6.6, 2.7, D.z0 + 0.05), box(2.0, 0.12, 0.2, frame, 6.6, 1.32, D.z0 + 0.05), box(0.1, 1.3, 0.15, frame, 6.6, 2.0, D.z0 + 0.05));
    W.de.add(box(0.1, 1.3, 1.8, '#9fd4f4', D.x1 - 0.02, 2.0, -2.6), box(0.2, 0.12, 2.0, frame, D.x1 - 0.05, 2.7, -2.6), box(0.2, 0.12, 2.0, frame, D.x1 - 0.05, 1.32, -2.6), box(0.15, 1.3, 0.1, frame, D.x1 - 0.05, 2.0, -2.6));
    // the doorway's frame: two posts and a lintel, on the den side and the main room side
    for (const sx of [4.98, 5.32]) W.e.add(box(0.12, 2.45, 0.16, frame, sx, 1.22, DOORWAY.z0 - 0.05), box(0.12, 2.45, 0.16, frame, sx, 1.22, DOORWAY.z1 + 0.05), box(0.12, 0.16, 2.3, frame, sx, 2.42, 0)); // (with the wall: hidden in the editor)
    W.ceil.add(box(lx + 0.6, 0.2, lz + 0.6, shade(-0.12), cx + 0.15, 3.3, cz));
    for (let i = 0; i < 3; i++) W.ceil.add(box(0.3, 0.3, lz + 0.4, frame, D.x0 + 1 + i * 2, 3.1, cz));
    this.cut.add(W.de, W.ds);
    // the bed: headboard against the north wall, a carved frame, a mattress, a patchwork quilt and two pillows
    const B = DEN_BED, g = new THREE.Group(), wood = '#6a4428', woodD = '#4a2e1a', z0 = B.z - B.d / 2, z1 = B.z + B.d / 2;
    g.add(box(B.w, 1.15, 0.12, wood, B.x, 0.75, z0 + 0.06), box(B.w + 0.1, 0.1, 0.16, woodD, B.x, 1.36, z0 + 0.06));
    for (const sx of [-1, 1]) g.add(box(0.14, 1.3, 0.14, woodD, B.x + sx * (B.w / 2), 0.65, z0 + 0.07), box(0.14, 0.7, 0.14, woodD, B.x + sx * (B.w / 2), 0.35, z1 - 0.07));
    g.add(box(B.w, 0.42, 0.1, wood, B.x, 0.38, z1 - 0.05)); // footboard
    for (const sx of [-1, 1]) g.add(box(0.08, 0.2, B.d - 0.2, wood, B.x + sx * (B.w / 2 - 0.02), 0.3, B.z)); // side rails
    g.add(box(B.w - 0.12, 0.22, B.d - 0.25, '#f2ece0', B.x, 0.45, B.z)); // mattress
    const quilt = ['#c8584a', '#e8c070', '#5a8ac0', '#7aa86a', '#e8e0d0', '#b86a9a'];
    const qx = 4, qz = 4, qw = (B.w - 0.04) / qx, qd = (B.d - 0.7) / qz;
    for (let i = 0; i < qx; i++) for (let k = 0; k < qz; k++) g.add(box(qw - 0.01, 0.06, qd - 0.01, quilt[(i * 3 + k * 2) % quilt.length], B.x - (B.w - 0.04) / 2 + qw * (i + 0.5), 0.58, z0 + 0.6 + qd * (k + 0.5)));
    g.add(box(B.w + 0.02, 0.05, 0.3, '#e8e0d0', B.x, 0.6, z0 + 0.48)); // the folded-back sheet
    for (const sx of [-1, 1]) g.add(box(B.w / 2 - 0.16, 0.16, 0.36, '#fbf6ec', B.x + sx * B.w / 4, 0.66, z0 + 0.3));
    g.add(box(0.5, 0.5, 0.45, woodD, B.x - B.w / 2 - 0.4, 0.25, z0 + 0.3), box(0.16, 0.3, 0.16, '#e8c070', B.x - B.w / 2 - 0.4, 0.65, z0 + 0.3)); // a night stand and a candle jar
    R.add(g);
  }

  /** The Lodge: a great room past the den, with a stone fireplace on the east wall, a long table and tall windows on the lake. */
  buildGreatRoom(L, wall, floor, shade) {
    const R = this.root, D = GREAT, W = this.walls, cx = (D.x0 + D.x1) / 2, lx = D.x1 - D.x0, lz = D.z1 - D.z0, frame = '#5a3a22', stone = '#8a8478', stoneD = '#6a655c';
    for (let i = 0; i < lx; i++) R.add(box(1, 0.2, lz, i % 2 ? floor : new THREE.Color(floor).offsetHSL(0, 0, 0.04).getStyle(), D.x0 + 0.5 + i, -0.1, 0));
    if (L.f === 'checker') for (let x = 0; x < lx; x++) for (let z = 0; z < lz; z++) if ((x + z) % 2) R.add(box(1, 0.21, 1, '#e8d8b8', D.x0 + 0.5 + x, -0.1, D.z0 + 0.5 + z));
    W.gn = new THREE.Group(); W.ge = new THREE.Group(); W.gs = new THREE.Group(); W.gw = new THREE.Group();
    for (let y = 0; y < 4; y++) {
      const a = y % 2 ? wall : shade(-0.05), b = y % 2 ? shade(-0.05) : wall;
      W.gn.add(box(lx + 0.6, 0.8, 0.3, a, cx, 0.4 + y * 0.8, D.z0 - 0.15));
      if (this.tier >= 3 && y < 3) for (const [x0, x1] of [[D.x0 - 0.3, SUN_DOOR.x0], [SUN_DOOR.x1, D.x1 + 0.3]]) W.gs.add(box(x1 - x0, 0.8, 0.3, b, (x0 + x1) / 2, 0.4 + y * 0.8, D.z1 + 0.15));
      else W.gs.add(box(lx + 0.6, 0.8, 0.3, b, cx, 0.4 + y * 0.8, D.z1 + 0.15));
      W.ge.add(box(0.3, 0.8, lz + 0.6, a, D.x1 + 0.15, 0.4 + y * 0.8, 0));
      W.gw.add(box(0.3, 0.8, D.z1 - DEN.z1, b, D.x0 - 0.15, 0.4 + y * 0.8, (D.z1 + DEN.z1) / 2));
    }
    for (const x of this.tier >= 3 ? [13, 17] : [13, 15, 17]) W.gs.add(box(1.5, 2.1, 0.1, '#8fc9f0', x, 1.75, D.z1 - 0.02), box(1.7, 0.12, 0.2, frame, x, 2.85, D.z1 - 0.05), box(1.7, 0.12, 0.2, frame, x, 0.68, D.z1 - 0.05), box(0.1, 2.1, 0.15, frame, x, 1.75, D.z1 - 0.05));
    for (const sx of [10.98, 11.32]) W.de.add(box(0.12, 2.45, 0.16, frame, sx, 1.22, DOORWAY.z0 - 0.05), box(0.12, 2.45, 0.16, frame, sx, 1.22, DOORWAY.z1 + 0.05), box(0.12, 0.16, 2.3, frame, sx, 2.42, 0));
    W.ceil.add(box(lx + 0.6, 0.2, lz + 0.6, shade(-0.12), cx, 3.3, 0));
    for (let i = 0; i < 4; i++) W.ceil.add(box(0.3, 0.3, lz + 0.4, frame, D.x0 + 1 + i * 2, 3.1, 0));
    this.cut.add(W.gn, W.ge, W.gs, W.gw);
    // the fireplace, on the east wall: a stone chimney breast, a hearth, a mantel and a fire that stays lit
    const f = new THREE.Group(); f.add(box(0.7, 3.2, 3, stone, D.x1 - 0.35, 1.6, 0), box(0.9, 0.16, 3.4, stoneD, D.x1 - 0.5, 0.08, 0), box(0.82, 1.1, 1.5, '#1c1612', D.x1 - 0.33, 0.7, 0), box(0.5, 0.14, 3.2, frame, D.x1 - 0.72, 1.7, 0));
    for (const z of [-0.45, 0, 0.45]) f.add(box(0.3, 0.16, 0.5, '#4a2e1a', D.x1 - 0.72, 0.28, z));
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 7), new THREE.MeshBasicMaterial({ color: '#ffb040' })); flame.position.set(D.x1 - 0.72, 0.72, 0); f.add(flame); R.add(f);
    this.greatFlame = flame; this.greatLight = new THREE.PointLight('#ffb070', 3.2, 12, 1.4); this.greatLight.position.set(D.x1 - 1.4, 1.6, 0); R.add(this.greatLight);
    // the long table, with a bench down each side
    const t = new THREE.Group(), wood = '#6a4428', woodD = '#4a2e1a'; t.add(box(1, 0.1, 3.6, wood, 13.2, 0.76, -1.6));
    for (const [x, z] of [[12.85, -3.2], [13.55, -3.2], [12.85, 0], [13.55, 0]]) t.add(box(0.12, 0.72, 0.12, woodD, x, 0.36, z));
    for (const x of [12.2, 14.2]) t.add(box(0.34, 0.08, 3.4, wood, x, 0.46, -1.6), box(0.1, 0.42, 0.1, woodD, x, 0.21, -3), box(0.1, 0.42, 0.1, woodD, x, 0.21, -0.2));
    R.add(t);
  }

  /** The Lakehouse: a sunroom on the water south of the great room. A low log wall with glass above it on three sides,
   *  a glass door out to the dock in the east wall, pale deck boards, a window seat and the lake all round outside. */
  buildSunroom(L, wall, floor, shade) {
    const R = this.root, D = SUN, W = this.walls, cx = (D.x0 + D.x1) / 2, cz = (D.z0 + D.z1) / 2, lx = D.x1 - D.x0, lz = D.z1 - D.z0;
    const frame = '#f2ead8', post = '#5a3a22', glassC = '#a8dcf4', deck = '#c8a878';
    for (let i = 0; i < lx; i++) R.add(box(1, 0.2, lz + 0.3, i % 2 ? deck : new THREE.Color(deck).offsetHSL(0, 0, 0.04).getStyle(), D.x0 + 0.5 + i, -0.1, cz - 0.15)); // (from under the doorway)
    // the lake outside, the deck's edge and the posts the room stands on
    const water = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), new THREE.MeshLambertMaterial({ color: '#3a86b8' }));
    water.rotation.x = -Math.PI / 2; water.position.set(D.x0 - 0.3 + 15, -0.7, D.z0 + 11); R.add(water); // (south and east of the sunroom only)
    // and past it, the far shore and the sky (one-sided, facing the house; with the walls, so the editor's view leaves them out)
    const far = (w, x, z, ry) => {
      for (const [h, y, c] of [[14, 7.65, '#bfe3f5'], [1.4, -0.05, '#4a7a4a']]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); m.rotation.y = ry; this.cut.add(m); }
    };
    far(30, D.x0 - 0.3 + 15, D.z0 + 22, Math.PI); far(22, D.x0 - 0.3 + 30, D.z0 + 11, -Math.PI / 2);
    R.add(box(lx + 0.8, 0.14, lz + 0.6, '#7a5a3a', cx, -0.27, cz + 0.1));
    for (const x of [D.x0 - 0.2, cx, D.x1 + 0.2]) R.add(box(0.3, 0.5, 0.3, post, x, -0.55, D.z1 + 0.25));
    W.ss = new THREE.Group(); W.se = new THREE.Group(); W.sw = new THREE.Group();
    const glassMat = { transparent: true, opacity: 0.28, depthWrite: false };
    const pane = (w, h, d, x, y, z) => { const m = box(w, h, d, glassC, x, y, z, glassMat); m.renderOrder = 2; return m; };
    const zs = D.z1 + 0.15; // (the south wall's middle)
    // south: the long glass wall on the lake, a low log wall under it, a sill, posts every 2 m and a beam on top
    W.ss.add(box(lx + 0.6, 0.8, 0.3, shade(-0.05), cx, 0.4, zs), pane(lx, 2.1, 0.06, cx, 1.85, zs), box(lx + 0.6, 0.3, 0.3, post, cx, 3.05, zs), box(lx + 0.6, 0.08, 0.42, frame, cx, 0.84, zs - 0.02));
    for (let x = D.x0 + 2; x < D.x1 - 0.5; x += 2) W.ss.add(box(0.14, 2.1, 0.34, post, x, 1.85, zs));
    for (const x of [D.x0 - 0.15, D.x1 + 0.15]) W.ss.add(box(0.3, 2.1, 0.3, post, x, 1.85, zs)); // (the corner posts)
    // west: the same, from the great room's wall to the corner
    const xw = D.x0 - 0.15;
    W.sw.add(box(0.3, 0.8, lz, shade(-0.04), xw, 0.4, cz), pane(0.06, 2.1, lz, xw, 1.85, cz), box(0.3, 0.3, lz, post, xw, 3.05, cz), box(0.42, 0.08, lz, frame, xw + 0.02, 0.84, cz), box(0.34, 2.1, 0.14, post, xw, 1.85, cz));
    // east: the same, with a glass door out to the dock
    const xe = D.x1 + 0.15, dz = this.door2Z, dw = 1.2, a0 = D.z0, a1 = dz - dw / 2 - 0.14, b0 = dz + dw / 2 + 0.14, b1 = D.z1;
    for (const [z0, z1] of [[a0, a1], [b0, b1]]) W.se.add(box(0.3, 0.8, z1 - z0, shade(-0.04), xe, 0.4, (z0 + z1) / 2), pane(0.06, 2.1, z1 - z0, xe, 1.85, (z0 + z1) / 2), box(0.42, 0.08, z1 - z0, frame, xe - 0.02, 0.84, (z0 + z1) / 2));
    W.se.add(box(0.3, 0.3, lz, post, xe, 3.05, cz));
    for (const z of [dz - dw / 2 - 0.07, dz + dw / 2 + 0.07]) W.se.add(box(0.34, 2.9, 0.14, post, xe, 1.45, z));
    W.se.add(box(0.36, 0.14, dw, post, xe, 2.6, dz), pane(0.05, 2.5, dw, xe, 1.27, dz), box(0.36, 0.06, dw, post, xe, 0.03, dz), box(0.08, 0.1, 0.36, '#f2c040', D.x1 - 0.02, 1.1, dz - 0.3));
    // the doorway from the great room: posts and a lintel on both faces of the wall
    for (const sz of [GREAT.z1 - 0.04, D.z0 + 0.04]) W.gs.add(box(0.16, 2.45, 0.1, post, SUN_DOOR.x0 - 0.06, 1.22, sz), box(0.16, 2.45, 0.1, post, SUN_DOOR.x1 + 0.06, 1.22, sz), box(SUN_DOOR.x1 - SUN_DOOR.x0 + 0.28, 0.16, 0.1, post, (SUN_DOOR.x0 + SUN_DOOR.x1) / 2, 2.42, sz));
    W.ceil.add(box(lx + 0.6, 0.2, lz + 0.3, '#e8e0cc', cx, 3.3, cz + 0.15));
    for (let i = 0; i < 4; i++) W.ceil.add(box(0.24, 0.24, lz, post, D.x0 + 1 + i * 2, 3.12, cz));
    this.cut.add(W.ss, W.sw, W.se);
    // a window seat along the glass, looking out on the water
    const seat = buildDecor('bench'); seat.position.set(15, 0, D.z1 - 0.4); seat.rotation.y = Math.PI; R.add(seat);
    this.colliders.push({ x: 15, z: D.z1 - 0.4, w: 2.6, d: 0.8 });
    this.seats.push({ id: 'sunbench', x: 15, z: D.z1 - 0.8, y: 0.52, yaw: Math.PI, label: 'Sit by the water' });
  }

  /** Is this spot free to stand on? (inside the walls, not in furniture) */
  canStand(x, z, r = 0.3) {
    const inside = (A) => x >= A.x0 + r && x <= A.x1 - r && z >= A.z0 + r && z <= A.z1 - r;
    const ok = inside(ROOM) || (this.tier >= 1 && (inside(DEN) || (x > ROOM.x1 - 1 && x < DEN.x0 + 1 && z >= DOORWAY.z0 + r && z <= DOORWAY.z1 - r)));
    const lodge = this.tier >= 2 && (inside(GREAT) || (x > DEN.x1 - 1 && x < GREAT.x0 + 1 && z >= DOORWAY.z0 + r && z <= DOORWAY.z1 - r));
    const sun = this.tier >= 3 && (inside(SUN) || (z > GREAT.z1 - 1 && z < SUN.z0 + 1 && x >= SUN_DOOR.x0 + r && x <= SUN_DOOR.x1 - r));
    if (!ok && !lodge && !sun) return false;
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
      if (!this.camInit) { this.camera.position.copy(want); this.camInit = true; } else this.camera.position.lerp(want, 1 - Math.exp(-17.26 * dt)); // (a quarter of the way each frame at 60 fps, the same at any frame rate)
      this.camera.lookAt(av.x, 1.05, av.z);
      const c = this.camera.position, W = this.walls;
      if (this.cut) this.cut.visible = true;
      if (W) { W.n.visible = c.z > -4.0; W.s.visible = c.z < 4.0; W.w.visible = c.x > -5.0; W.e.visible = this.tier >= 1 ? (c.x < ROOM.x1) === (av.x < ROOM.x1) : c.x < 5.0; W.ceil.visible = c.y < 3.15; if (W.de) { W.de.visible = this.tier >= 2 ? (c.x < DEN.x1) === (av.x < DEN.x1) : c.x < DEN.x1; W.ds.visible = c.z < DEN.z1; } if (W.gn) { W.gn.visible = c.z > GREAT.z0; W.gs.visible = this.tier >= 3 ? (c.z < GREAT.z1) === (av.z < GREAT.z1) : c.z < GREAT.z1; W.ge.visible = c.x < GREAT.x1; W.gw.visible = c.x > GREAT.x0; } if (W.ss) { W.ss.visible = c.z < SUN.z1; W.se.visible = c.x < SUN.x1; W.sw.visible = c.x > SUN.x0; } }
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
