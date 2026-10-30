// v1.17.1: models from Polyfork (polyfork.dev, free low-poly assets, licensed to ship inside the game). Each one is
// downloaded as a .glb into art/polyfork/ and turned into src/data/polyforkMesh.js by scripts/glb-to-js.mjs (no
// binary files in the artifact, nothing fetched from polyfork.dev). Polyfork models are one material coloured per
// vertex; the converter splits them into one material per colour, and here they are merged back into one
// vertex-coloured, flat-shaded mesh like the nature models, with the window glass ("pane") kept apart so it can
// glow at night.
//
// First try-out: the Nature & Forest kit's Log Cabin (log-cabin-4fac3b, 6 x 7 m, 5.5 m tall, front facing +z) in its
// own little clearing in the woods (CLEARINGS.logcabin in terrain.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { POLYFORK_MATS, POLYFORK_NODES } from '../data/polyforkMesh.js';
import { natureMaterial } from './nature.js';
import { nightWindows } from './nightwindows.js';
import { addBox, addCircle } from './colliders.js';
import { CLEARINGS, heightAt } from './terrain.js';

const toLinear = (u) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
const cache = new Map();
/** One Polyfork model as { body, glass }: non-indexed geometries, body with a `color` attribute (linear RGB). */
export function polyforkModel(name) {
  if (cache.has(name)) return cache.get(name);
  const n = POLYFORK_NODES.find((x) => x.name === name);
  if (!n) throw new Error(`polyfork model ${name} missing`);
  const body = [], glass = [];
  for (const p of n.prims) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
    g.setIndex(p.idx);
    const ng = g.toNonIndexed();
    g.dispose();
    if (POLYFORK_MATS[p.m].name === 'pane') { glass.push(ng); continue; }
    const cnt = ng.attributes.position.count, col = new Float32Array(cnt * 3);
    if (p.col) { // per-vertex sRGB 0..255 (indexed like pos), to linear
      for (let v = 0; v < cnt; v++) for (let q = 0; q < 3; q++) col[v * 3 + q] = toLinear(p.col[p.idx[v] * 3 + q] / 255);
    } else for (let i = 0; i < cnt; i++) col.set(POLYFORK_MATS[p.m].color, i * 3);
    ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
    body.push(ng);
  }
  const merge = (list) => {
    if (!list.length) return null;
    const geo = mergeGeometries(list);
    list.forEach((x) => x.dispose());
    geo.computeVertexNormals(); // non-indexed: one normal per face, the faceted look
    return geo;
  };
  const out = { body: merge(body), glass: merge(glass) };
  cache.set(name, out);
  return out;
}

// How a model stands: its footprint below 2.4 m (or its whole height, if lower) in its own frame, and its height.
const feet = new Map();
export function polyforkFoot(name) { return footprint(name); }
function footprint(name) {
  if (feet.has(name)) return feet.get(name);
  const { body } = polyforkModel(name), pos = body.attributes.position;
  let top = 0;
  for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i));
  const b = new THREE.Box2(), v = new THREE.Vector2(), cut = Math.min(2.4, top * 0.9);
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < cut) b.expandByPoint(v.set(pos.getX(i), pos.getZ(i)));
  const f = { x0: b.min.x, x1: b.max.x, z0: b.min.y, z1: b.max.y, top };
  feet.set(name, f);
  return f;
}

/** v1.17.1 (the campground batch): Polyfork pieces stood on the valley floor and merged into one mesh (one draw
 *  call, plus one for lit glass). Each item: { m: model, x, z, ry = 0, s = 1, solid = true, y, on, dy }. A piece stands
 *  on the lowest ground under its corners, a few cm in, unless it gives `y`, or sits `dy` above another item `on`.
 *  A solid piece blocks walkers over its footprint: a box when it sits square to the world, otherwise a row of
 *  circles (the long way), or one circle of radius `solid` when that is a number. Returns the group (not added). */
export function placeModels(name, items, { colliders = true, group = new THREE.Group() } = {}) {
  group.name = name;
  const bodies = [], panes = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const it of items) {
    const { body, glass } = polyforkModel(it.m), f = footprint(it.m), s = it.s ?? 1, ry = it.ry ?? 0;
    const c = Math.cos(ry), sn = Math.sin(ry);
    const toWorld = (lx, lz) => [it.x + (lx * c + lz * sn) * s, it.z + (-lx * sn + lz * c) * s];
    if (it.y == null) {
      if (it.on) it.y = it.on.y + (it.dy ?? 0);
      else it.y = Math.min(...[[f.x0, f.z0], [f.x1, f.z0], [f.x0, f.z1], [f.x1, f.z1], [(f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2]].map(([a, b]) => heightAt(...toWorld(a, b)))) - (it.sink ?? 0.04);
    }
    m4.compose(new THREE.Vector3(it.x, it.y, it.z), q.setFromAxisAngle(up, ry), new THREE.Vector3(s, s, s));
    bodies.push(body.clone().applyMatrix4(m4));
    if (glass) panes.push(glass.clone().applyMatrix4(m4));
    if (!colliders || it.solid === false) continue;
    if (typeof it.solid === 'number') { addCircle(it.x, it.z, it.solid); continue; }
    const hw = (f.x1 - f.x0) / 2 * s, hd = (f.z1 - f.z0) / 2 * s, [cx, cz] = toWorld((f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2);
    const quarter = Math.abs(Math.sin(ry * 2)) < 0.02;
    if (quarter) { const ex = Math.abs(c) * hw + Math.abs(sn) * hd, ez = Math.abs(sn) * hw + Math.abs(c) * hd; addBox(cx - ex + 0.05, cz - ez + 0.05, cx + ex - 0.05, cz + ez - 0.05); continue; }
    const long = hw >= hd, r = Math.max(0.15, Math.min(hw, hd)), len = Math.max(hw, hd) - r;
    const ax = long ? c : sn, az = long ? -sn : c; // the long axis in the world
    const n = Math.max(1, Math.ceil(len * 2 / (r * 1.2)) + 1);
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : -len + (2 * len * i) / (n - 1); addCircle(cx + ax * t, cz + az * t, r); }
  }
  const merged = (list) => { const g = mergeGeometries(list); list.forEach((x) => x.dispose()); return g; };
  const mesh = new THREE.Mesh(merged(bodies), natureMaterial());
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.polyfork = true;
  group.add(mesh);
  if (panes.length) { const gm = new THREE.Mesh(merged(panes), nightWindows.glass(new THREE.MeshLambertMaterial({ color: '#3f4d55', emissive: '#000000', flatShading: true }))); gm.userData.polyfork = true; group.add(gm); }
  return group;
}

// The cabin's spot: the middle of its clearing, front door facing the trail to the south-east of it.
export const LOG_CABIN = { x: CLEARINGS.logcabin.x, z: CLEARINGS.logcabin.z, ry: CLEARINGS.logcabin.ry };

export function buildLogCabin(scene) {
  const { body, glass } = polyforkModel('log-cabin');
  const C = LOG_CABIN, y = heightAt(C.x, C.z);
  const group = new THREE.Group();
  group.name = 'polyfork-log-cabin';
  group.position.set(C.x, y - 0.05, C.z); // (a few cm into the ground so no gap shows under the bottom log)
  group.rotation.y = C.ry;
  const mesh = new THREE.Mesh(body, natureMaterial());
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  if (glass) group.add(new THREE.Mesh(glass, nightWindows.glass(new THREE.MeshLambertMaterial({ color: '#3f4d55', emissive: '#000000', flatShading: true }))));
  scene.add(group);
  // Solid: the log walls (corners included, the roof's overhang left open), measured from the model below 2.4 m
  // and turned with the cabin (ry is a quarter turn, so the box stays axis-aligned).
  const b = new THREE.Box3(), v = new THREE.Vector3(), pos = body.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 2.4) b.expandByPoint(v.fromBufferAttribute(pos, i));
  const pts = [[b.min.x, b.min.z], [b.max.x, b.max.z]].map(([x, z]) => new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), C.ry));
  addBox(C.x + Math.min(pts[0].x, pts[1].x) + 0.1, C.z + Math.min(pts[0].z, pts[1].z) + 0.1, C.x + Math.max(pts[0].x, pts[1].x) - 0.1, C.z + Math.max(pts[0].z, pts[1].z) - 0.1);
  return group;
}
