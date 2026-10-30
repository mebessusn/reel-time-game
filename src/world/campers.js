// Fern Pond's trailer park and campground (v1.9.4). The trailers and tents are modelled in Blender
// (art/campers.blend -> art/campers.glb -> src/data/camperMesh.js via scripts/glb-to-js.mjs): a silver
// Airstream with a striped awning, a two-tone 50s "canned ham", a little red teardrop, two canvas A-frame
// tents and a dome tent. Models face +X (the hitch end), door side toward +Z.
//   Sundae's Trailer Park: east of the pond, five gravel pads, each with a trailer and a picnic table, string
//   lights between posts that glow at night, and a sign over the way in.
//   Fernview Campground: off the pond's north shore, tents round a campfire with log benches.
import * as THREE from 'three';
import { CAMPER_MATS, CAMPER_NODES } from '../data/camperMesh.js';
import { surfaceY } from './terrain.js';
import { addCircle, addBox } from './colliders.js';
import { nightWindows } from './nightwindows.js';
import { placeModels } from './polyfork.js';
import { campgroundAt } from './campground.js';

/** The two clearings (terrain.js flattens them; see CLEARINGS.park / CLEARINGS.fernview). */
export const PARK = { x: -100, z: 156 };
export const CAMPGROUND = { x: -170, z: 107 };
export const FERNVIEW_FIRE = { x: CAMPGROUND.x + 1, z: CAMPGROUND.z + 2 };

// Trailer sites, relative to PARK: kind, offset, yaw (radians; 0 = hitch toward +X)
const SITES = [
  ['airstream', -7, -6, Math.PI * 0.5],
  ['ham', 0.5, -7.5, Math.PI * 0.5],
  ['tear', 7.5, -5.5, Math.PI * 0.62],
  ['ham', -7.5, 5.5, -Math.PI * 0.5],
  ['airstream', 3, 6.5, -Math.PI * 0.5],
];
/** Sundae (the owner) and his tenant Maria Lopez, out by the door of site 2's canned ham. */
export const SCENE = (() => {
  const [, ox, oz, yaw] = SITES[1];
  const x = PARK.x + ox, z = PARK.z + oz, sx = Math.sin(yaw), sz = Math.cos(yaw), ux = Math.cos(yaw), uz = -Math.sin(yaw);
  const maria = { x: x + sx * 1.5 + ux * 0.75, z: z + sz * 1.5 + uz * 0.75 };
  const sundae = { x: maria.x + sx * 1.3 + ux * 1.5, z: maria.z + sz * 1.3 + uz * 1.5 };
  maria.yaw = Math.atan2(sundae.x - maria.x, sundae.z - maria.z) + 0.5; // half turned away from him
  sundae.yaw = Math.atan2(maria.x - sundae.x, maria.z - sundae.z);
  return { maria, sundae };
})();
// Tents, relative to the campground: kind, offset, yaw (turned to face the fire)
const TENTS = [['tentA', -5.5, -3], ['dome', 5, -4.5], ['tentB', 6.5, 4], ['bell', -5.5, 5.5]];
// v1.17.1: the tents are Polyfork models now (src/world/polyfork.js; door toward +z, turned to face the fire)
const PF_TENT = { tentA: 'canvas-ridge-tent', tentB: 'canvas-ridge-tent', dome: 'dome-tent', bell: 'canvas-wall-tent' };
// ...and the campground has the rest of a campground (Polyfork's Campground & Lake kit), relative to CAMPGROUND:
// model, offset, yaw (0 = front toward +z), keep-out radius for ferns and grass
const EXTRAS = [
  ['camp-kitchen-table', -9, 1.2, Math.PI / 2, 1.2], ['bear-proof-food-locker', -4.5, -9.5, 0.3, 1],
  ['camp-notice-board', 9.6, -2.6, Math.PI / 2, 1.3], ['hammock-on-posts', -0.5, 9.5, 0.15, 2.2],
  ['cordwood-pile', 2.5, -8, 0.15, 1.2], ['canoe-rack', 6, 10.5, 0.35, 2.8], ['wooden-rowboat', 15, 12.6, 1.9, 2], ['camp-canoe', 10.5, 12.9, 1.75, 2.6],
  ['folding-camp-chair', 1, -0.6, 0, 0.6], ['folding-camp-chair', 1.2, 4.6, Math.PI, 0.6], ['folding-camp-chair', 3.1, 4.1, -2.36, 0.6],
  ['campground-rail-fence-run', 9.6, 4.6, Math.PI / 2, 0.7], ['campground-rail-fence-run', 9.6, 6.6, Math.PI / 2, 0.7],
  ['campground-rail-fence-run', 9.6, -4.6, Math.PI / 2, 0.7], ['campground-rail-fence-run', 9.6, -6.6, Math.PI / 2, 0.7],
];
const PARTS = { airstream: ['airstream_body'], ham: ['ham_body', 'ham_trim'], tear: ['tear_body', 'tear_trim'], tentA: ['tentA_body'], tentB: ['tentB_body'], dome: ['dome_body'], bell: ['bell_body'] };
// footprint along the model's x (for colliders): [from, to, radius]
const FOOT = { airstream: [-2.4, 3.2, 1.15], ham: [-1.9, 2.7, 1.05], tear: [-1.3, 2.1, 0.9], tentA: [-1.3, 1.9, 1.15], tentB: [-1.3, 1.9, 1.15], dome: [-1, 1.4, 1.15], bell: [-0.9, 0.9, 1.75] };

/** v1.9.4: everything at the park and campground as rough circles (known before anything is built), so
 *  ferns, grass and bushes keep off the trailers, their pads and tables, the tents and their guy lines. */
const KEEP_OUT = (() => {
  const out = [];
  const along = (x, z, yaw, [a, b, r], pad) => { const ux = Math.cos(yaw), uz = -Math.sin(yaw); for (let t = a; t <= b + 0.01; t += 0.6) out.push({ x: x + ux * t, z: z + uz * t, r: r + pad }); };
  for (const [kind, ox, oz, yaw] of SITES) {
    const x = PARK.x + ox, z = PARK.z + oz;
    along(x, z, yaw, [-3.3, 4.1, 1.9], 0.3); // the gravel pad
    const sx = Math.sin(yaw), sz = Math.cos(yaw), ux = Math.cos(yaw), uz = -Math.sin(yaw);
    out.push({ x: x + sx * 3.4 - ux * 0.6, z: z + sz * 3.4 - uz * 0.6, r: 1.4 }); // the picnic table
  }
  for (const [kind, ox, oz] of TENTS) {
    const x = CAMPGROUND.x + ox, z = CAMPGROUND.z + oz, yaw = Math.atan2(-(FERNVIEW_FIRE.z - z), FERNVIEW_FIRE.x - x);
    out.push({ x, z, r: kind === 'bell' ? 2.9 : 2.6 }); // tent, porch and guy lines
    along(x, z, yaw, FOOT[kind], 0.8);
  }
  out.push({ x: FERNVIEW_FIRE.x, z: FERNVIEW_FIRE.z, r: 3.4 }); // the fire ring and log benches
  for (const [, ox, oz, , r] of EXTRAS) out.push({ x: CAMPGROUND.x + ox, z: CAMPGROUND.z + oz, r });
  out.push({ x: SCENE.sundae.x, z: SCENE.sundae.z, r: 1 }, { x: SCENE.maria.x, z: SCENE.maria.z, r: 1 });
  return out;
})();
export function camperAt(x, z, pad = 0) {
  if (campgroundAt(x, z, pad)) return true; // (v1.17.1: and the ranger station's and the A-frame's yards)
  for (const c of KEEP_OUT) { const dx = x - c.x, dz = z - c.z, rr = c.r + pad; if (dx * dx + dz * dz < rr * rr) return true; }
  return false;
}

const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
let mats = null;
function materials() {
  if (mats) return mats;
  mats = CAMPER_MATS.map((m) => {
    const color = lin(m.color);
    const side = m.name.startsWith('tent') || m.name.startsWith('canvas') ? THREE.DoubleSide : THREE.FrontSide;
    // window glass: flat tinted grey, pulled toward the camera so it never fights the body panel behind it
    if (m.name === 'glass' || m.name === 'tent_mesh') {
      const w = new THREE.MeshLambertMaterial({ color: m.name === 'glass' ? '#59636c' : lin(m.color), side, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); w.userData.flat = true;
      if (m.name === 'glass') nightWindows.glass(w); // v1.13.7: the trailers' windows light up at night
      return w;
    }
    if (m.metal > 0.5) return new THREE.MeshPhongMaterial({ color, shininess: 70, specular: '#d8dce4', side });
    if (m.rough < 0.3) return new THREE.MeshPhongMaterial({ color, shininess: 90, specular: '#a0b0c0', side });
    return new THREE.MeshLambertMaterial({ color, side });
  });
  return mats;
}
const geos = new Map();
function geometries(n) {
  if (!geos.has(n.name)) {
    geos.set(n.name, n.prims.map((p) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(p.nrm), 3, true));
      geo.setIndex(p.idx.length && Math.max(...p.idx) > 65535 ? new THREE.Uint32BufferAttribute(p.idx, 1) : new THREE.Uint16BufferAttribute(p.idx, 1));
      return [geo, p.m];
    }));
  }
  return geos.get(n.name);
}
/** One trailer or tent as a group (facing +X at the origin). */
export function buildCamper(kind) {
  const g = new THREE.Group();
  g.name = `camper-${kind}`;
  for (const name of PARTS[kind] || []) {
    const n = CAMPER_NODES.find((x) => x.name === name);
    if (!n) continue;
    for (const [geo, m] of geometries(n)) {
      const mesh = new THREE.Mesh(geo, materials()[m]);
      const flat = !!mesh.material.userData.flat;
      mesh.castShadow = !flat; mesh.receiveShadow = !flat;
      g.add(mesh);
    }
  }
  return g;
}
function solidAlong(x, z, yaw, kind) {
  const [a, b, r] = FOOT[kind];
  const ux = Math.cos(yaw), uz = -Math.sin(yaw);
  for (let t = a + r * 0.6; t <= b - r * 0.6 + 0.01; t += r * 0.8) addCircle(x + ux * t, z + uz * t, r);
}

// ---- small built props (boxes): gravel pads, picnic tables, posts, the park sign
const M = {
  gravel: new THREE.MeshLambertMaterial({ color: '#a69c8c' }),
  wood: new THREE.MeshLambertMaterial({ color: '#9a6a3e' }),
  woodDark: new THREE.MeshLambertMaterial({ color: '#6a4628' }),
  post: new THREE.MeshLambertMaterial({ color: '#5a3e24' }),
  cord: new THREE.LineBasicMaterial({ color: '#2a2a2a' }),
};
const BOX = new THREE.BoxGeometry(1, 1, 1);
function block(parent, mat, w, h, d, x, y, z, ry = 0) {
  const m = new THREE.Mesh(BOX, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
// v1.17.1: the picnic tables are Polyfork's Heavy Timber Picnic Table (benches along the model's x, like the old ones)
const picnicTable = (pf, x, z, ry) => pf.push({ m: 'heavy-timber-picnic-table', x, z, ry });
export function signBoard(text, w = 4.2, h = 0.8) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = Math.round(1024 * h / w);
  const c = cv.getContext('2d');
  c.fillStyle = '#7a4e2a'; c.fillRect(0, 0, cv.width, cv.height);
  c.strokeStyle = '#4a2e18'; c.lineWidth = 8; c.strokeRect(4, 4, cv.width - 8, cv.height - 8);
  c.fillStyle = '#f4e4c0'; c.textAlign = 'center'; c.textBaseline = 'middle';
  // v1.9.4: shrink the lettering until the whole name fits inside the border
  let fs = Math.round(cv.height * 0.46);
  const font = () => `bold ${fs}px Georgia, serif`;
  c.font = font();
  while (fs > 8 && c.measureText(text).width > cv.width - 70) { fs -= 1; c.font = font(); }
  c.fillText(text, cv.width / 2, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const front = new THREE.MeshLambertMaterial({ map: tex });
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), [M.wood, M.wood, M.wood, M.wood, front, front]);
}

/** Builds both places. Returns { group, bulbs } (bulbs: a material whose glow sky.js turns up at night). */
export function buildCampers(scene) {
  const group = new THREE.Group();
  group.name = 'fern-campers';
  const pf = []; // (Polyfork pieces, merged into one mesh at the end)
  // ---- Sundae's Trailer Park
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffd890' });
  const bulbs = [];
  SITES.forEach(([kind, ox, oz, yaw], i) => {
    const x = PARK.x + ox, z = PARK.z + oz, y = surfaceY(x, z);
    const ux = Math.cos(yaw), uz = -Math.sin(yaw);
    // the gravel pad
    block(group, M.gravel, 7.4, 0.1, 3.6, x + ux * 0.4, y + 0.02, z + uz * 0.4, yaw);
    const t = buildCamper(kind);
    t.position.set(x, y + 0.06, z); t.rotation.y = yaw;
    group.add(t);
    solidAlong(x, z, yaw, kind);
    // a picnic table on the door side (+Z in the model)
    const sx = Math.sin(yaw), sz = Math.cos(yaw);
    const px = x + sx * 3.4 - ux * 0.6, pz = z + sz * 3.4 - uz * 0.6;
    picnicTable(pf, px, pz, yaw);
    // a post at the pad's corner for the string lights, and a site number
    const qx = x + sx * 2.6 + ux * 3.4, qz = z + sz * 2.6 + uz * 3.4, qy = surfaceY(qx, qz);
    block(group, M.post, 0.12, 2.6, 0.12, qx, qy + 1.3, qz);
    addCircle(qx, qz, 0.12);
    bulbs.push(new THREE.Vector3(qx, qy + 2.5, qz));
    const num = signBoard(String(i + 1), 0.4, 0.3);
    num.position.set(qx, qy + 1.4, qz); num.rotation.y = yaw + Math.PI / 2;
    group.add(num);
  });
  // string lights: posts joined in a loop round the park, a sagging cord hung with warm bulbs
  const order = [0, 1, 2, 4, 3];
  const bulbGeo = new THREE.SphereGeometry(0.07, 6, 4);
  const bulbPos = [];
  for (let k = 0; k < order.length; k++) {
    const a = bulbs[order[k]], b = bulbs[order[(k + 1) % order.length]];
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.7; pts.push(p); if (i % 2 === 1) bulbPos.push(p.clone().setY(p.y - 0.1)); }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), M.cord));
  }
  const bulbMesh = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbPos.length);
  bulbPos.forEach((p, i) => bulbMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  group.add(bulbMesh);
  // the sign over the way in, facing the Fern Pond trail just north of the park
  {
    const x = PARK.x - 2, z = PARK.z - 12.5, y = surfaceY(x, z);
    // both posts run from their own (sunk) footing up to the same top, just above the board
    const top = y + 3.32;
    for (const s of [-1, 1]) { const foot = surfaceY(x + s * 2.5, z) - 0.3; block(group, M.post, 0.22, top - foot, 0.22, x + s * 2.5, (top + foot) / 2, z); addCircle(x + s * 2.5, z, 0.15); }
    const board = signBoard("SUNDAE'S TRAILER PARK", 4.8, 0.75);
    board.position.set(x, y + 2.85, z);
    group.add(board);
  }
  // ---- Fernview Campground: tents facing the fire
  for (const [kind, ox, oz] of TENTS) {
    const x = CAMPGROUND.x + ox, z = CAMPGROUND.z + oz, y = surfaceY(x, z);
    const yaw = Math.atan2(-(FERNVIEW_FIRE.z - z), FERNVIEW_FIRE.x - x); // door (+X) toward the fire
    pf.push({ m: PF_TENT[kind], x, z, ry: yaw + Math.PI / 2 }); // (+X door in the old models, +z in Polyfork's)
  }
  {
    const x = CAMPGROUND.x - 1, z = CAMPGROUND.z - 6.5;
    picnicTable(pf, x, z, 0.2);
    pf.push({ m: 'camping-lantern', x: x + 0.3, z: z - 0.1, ry: 0.4, on: pf[pf.length - 1], dy: 0.76, solid: false });
    const sx = CAMPGROUND.x + 9.5, sz = CAMPGROUND.z + 1, sy = surfaceY(sx, sz);
    block(group, M.post, 0.18, 2.2, 0.18, sx, sy + 1.1, sz); addCircle(sx, sz, 0.12);
    const board = signBoard('FERNVIEW CAMPGROUND', 3.2, 0.6);
    board.position.set(sx + 0.1, sy + 1.9, sz); board.rotation.y = Math.PI / 2;
    group.add(board);
  }
  // v1.17.1: the rest of the campground (EXTRAS), a cooking grate and a dutch oven over the fire, a jug on the kitchen table
  for (const [m, ox, oz, ry] of EXTRAS) pf.push({ m, x: CAMPGROUND.x + ox, z: CAMPGROUND.z + oz, ry });
  const kitchen = pf.find((p) => p.m === 'camp-kitchen-table');
  pf.push({ m: 'camp-water-jug', x: kitchen.x - 0.05, z: kitchen.z + 0.5, ry: 1.2, on: kitchen, dy: 0.85, solid: false });
  pf.push({ m: 'camp-dutch-oven', x: kitchen.x + 0.05, z: kitchen.z - 0.35, ry: 0.5, on: kitchen, dy: 0.85, solid: false });
  const grate = { m: 'campfire-cooking-grate', x: FERNVIEW_FIRE.x, z: FERNVIEW_FIRE.z - 0.1, ry: Math.PI / 2, solid: false };
  pf.push(grate);
  group.add(placeModels('fern-campers-polyfork', pf));
  scene.add(group);
  return { group, bulbMat };
}
