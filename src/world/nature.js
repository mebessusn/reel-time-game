// v1.8.1 natural low-poly trees and bushes (art/nature.blend -> art/nature.glb -> src/data/natureMesh.js via
// scripts/glb-to-js.mjs). Faceted, flat-shaded, vertex-coloured: pines (and snowy pines near Frostpine),
// round-canopied oaks, autumn trees, apple trees, birches, and bushes with optional berries.
// Each model is turned into one vertex-coloured geometry, then stamped (merged) many times with a small
// random tint so no two trees look exactly alike.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NATURE_MATS, NATURE_NODES } from '../data/natureMesh.js';

const cache = new Map();
/** One model as a non-indexed geometry with a `color` attribute (linear RGB from its materials). */
function model(name) {
  if (cache.has(name)) return cache.get(name);
  const n = NATURE_NODES.find((x) => x.name === name);
  if (!n) throw new Error(`nature model ${name} missing`);
  const parts = n.prims.map((p) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
    g.setIndex(p.idx);
    const ng = g.toNonIndexed();
    g.dispose();
    const c = NATURE_MATS[p.m].color, cnt = ng.attributes.position.count, col = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) { col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
    ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return ng;
  });
  const geo = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  geo.computeVertexNormals(); // non-indexed: one normal per face, the faceted look
  cache.set(name, geo);
  return geo;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function stamp(out, name, x, y, z, ry, scale, tint = 1, extra = null) {
  const g = model(name).clone();
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(scale, scale * (extra?.sy || 1), scale));
  g.applyMatrix4(_m);
  if (tint !== 1) { const c = g.attributes.color.array; for (let i = 0; i < c.length; i++) c[i] *= tint; }
  if (extra?.bend) {
    const pos = g.attributes.position, b = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) b[i] = Math.max(0, Math.min(1, (pos.getY(i) - y) / (1.2 * scale)));
    g.setAttribute('aBend', new THREE.BufferAttribute(b, 1));
  }
  out.push(g);
}

export const natureMaterial = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** spots: [{ x, z, r }] (r: a random int), heightAt(x, z), snowy(x, z) -> bool. Returns one Mesh. */
export function natureTrees(spots, extra, heightAt, { snowy = () => false } = {}) {
  const parts = [];
  for (const s of spots) {
    const x = s.x + 0.5, z = s.z + 0.5, y = heightAt(s.x, s.z) - 0.05;
    const v = (s.r >>> 3) % 3, ry = ((s.r >>> 4) % 64) * 0.098, scale = 0.85 + (s.r % 9) * 0.04;
    const tint = 0.9 + ((s.r >>> 7) % 9) * 0.025;
    const pick = s.r % 100;
    let name;
    if (snowy(x, z)) name = pick < 85 ? `pine${v}` : `birch${v % 2}`; // v1.9.2: plain pines (the low-poly snow read as unfinished)
    else if (pick < 55) name = `pine${v}`;
    else if (pick < 73) name = `oak${v}`;
    else if (pick < 82) name = `autumn${v}`;
    else if (pick < 92) name = `birch${v % 2}`;
    else name = `apple${v % 2}`;
    stamp(parts, name, x, y, z, ry, scale * (name.startsWith('pine') ? 1.15 : 1.05), tint);
  }
  for (const [kind, x, z, v] of extra) stamp(parts, kind === 'pine' ? `pine${v % 3}` : `oak${v % 3}`, x + 0.5, heightAt(x, z) - 0.05, z + 0.5, 0.4, 1.1);
  const mesh = new THREE.Mesh(mergeGeometries(parts), natureMaterial());
  parts.forEach((p) => p.dispose());
  mesh.name = 'trees'; mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/** list: [{ x, y, z, ry, s, shape, berries (0 none, 1..3) }]. Every vertex carries aBend for the wind. */
export function natureBushes(list) {
  const parts = [];
  for (const b of list) {
    const tint = 0.88 + ((b.green || 0) % 4) * 0.06;
    stamp(parts, `bush${b.shape % 3}`, b.x, b.y, b.z, b.ry, b.s * 1.15, tint, { bend: true, sy: 0.95 });
    if (b.berries) stamp(parts, `berries${b.shape % 3}_${(b.berries - 1) % 3}`, b.x, b.y, b.z, b.ry, b.s * 1.15, 1, { bend: true, sy: 0.95 });
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), natureMaterial());
  parts.forEach((p) => p.dispose());
  mesh.name = 'bushes'; mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
