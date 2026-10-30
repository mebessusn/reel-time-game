// Frostmere: cheap repeats. A Blender node (art/src/*.py -> src/data/*Mesh.js) merged into one geometry with its
// materials baked in as vertex colours: one draw for the solid parts, and one more for any glowing parts (lamps,
// windows). Instanced, a whole forest of one kind of spruce costs a draw call or two.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SNOWGOOSE_MATS, SNOWGOOSE_NODES } from '../data/snowgooseMesh.js';

const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
const cache = new Map();
const PANE = new THREE.Color('#ffd79b');
const srgbToLin = (u) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
const LIBS = [[SNOWGOOSE_MATS, SNOWGOOSE_NODES]];
/** Register another mesh library (MATS, NODES) for merged(). */
export function addLibrary(MATS, NODES) { LIBS.push([MATS, NODES]); }

const SOLID = new THREE.MeshLambertMaterial({ vertexColors: true });
const GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });
export const MERGED_MATS = { solid: SOLID, glow: GLOW };

/** { solid: BufferGeometry|null, glow: BufferGeometry|null } for a named node. */
export function merged(name) {
  if (cache.has(name)) return cache.get(name);
  let lib = null, n = null;
  for (const L of LIBS) { n = L[1].find((x) => x.name === name); if (n) { lib = L; break; } }
  if (!n) { cache.set(name, { solid: null, glow: null }); return cache.get(name); }
  const MATS = lib[0], parts = { solid: [], glow: [] };
  for (const p of n.prims) {
    const m = MATS[p.m], e = m.emissive || [0, 0, 0];
    const pane = m.name === 'pane'; // (v1.17.1: a Polyfork model's window glass: lit, like the village's windows)
    const glow = pane || e[0] + e[1] + e[2] > 0.05;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
    if (p.nrm) { const nr = new Float32Array(p.nrm.length); for (let i = 0; i < nr.length; i++) nr[i] = p.nrm[i] / 127; geo.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); }
    geo.setIndex(Array.from(p.idx));
    if (!p.nrm) geo.computeVertexNormals();
    const c = pane ? PANE : glow ? lin(e).multiplyScalar(1.15) : lin(m.color), cnt = p.pos.length / 3, col = new Float32Array(cnt * 3);
    if (p.col && !glow) for (let i = 0; i < cnt * 3; i++) col[i] = srgbToLin(p.col[i] / 255); // (v1.17.1: Polyfork: colour per vertex, sRGB 0..255)
    else for (let i = 0; i < cnt; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (glow ? parts.glow : parts.solid).push(geo);
  }
  const out = { solid: parts.solid.length ? mergeGeometries(parts.solid, false) : null, glow: parts.glow.length ? mergeGeometries(parts.glow, false) : null };
  for (const k of ['solid', 'glow']) if (out[k]) out[k].computeBoundingSphere();
  cache.set(name, out);
  return out;
}

/** Every merged geometry built so far (shared by all their copies: never dispose these). */
export function sharedGeometries() { const s = new Set(); for (const v of cache.values()) { if (v.solid) s.add(v.solid); if (v.glow) s.add(v.glow); } return s; }

/** A single merged copy (a Group with one or two meshes) of a node. */
export function mergedMesh(name, { shadow = true } = {}) {
  const m = merged(name), g = new THREE.Group(); g.name = name;
  if (m.solid) { const a = new THREE.Mesh(m.solid, SOLID); a.castShadow = shadow; a.receiveShadow = true; g.add(a); }
  if (m.glow) g.add(new THREE.Mesh(m.glow, GLOW));
  return g;
}

/** Instanced copies: items = [{ x, y, z, ry, s }]. Returns the meshes (added to `parent`). */
export function instanced(parent, name, items, { shadow = false, cells = 1, half = 400, cx = 0, cz = 0, tint = null } = {}) {
  const m = merged(name), out = [];
  const groups = new Map();
  for (const it of items) {
    const k = cells > 1 ? `${Math.floor((it.x - cx + half) / (2 * half / cells))}|${Math.floor((it.z - cz + half) / (2 * half / cells))}` : '0';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const list of groups.values()) for (const [geo, mat] of [[m.solid, SOLID], [m.glow, GLOW]]) {
    if (!geo) continue;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { p.set(it.x, it.y, it.z); q.setFromAxisAngle(up, it.ry || 0); sc.setScalar(it.s || 1); m4.compose(p, q, sc); im.setMatrixAt(i, m4); if (tint) im.setColorAt(i, tint); }); // (v1.17.1: `tint` scales the colour, above 1 to brighten: snow drifts match the snow)
    im.computeBoundingSphere(); im.castShadow = shadow && mat === SOLID; im.receiveShadow = true;
    im.name = `inst:${name}`;
    parent.add(im); out.push(im);
  }
  return out;
}
