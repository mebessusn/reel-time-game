// Wren's Wagon (v1.17.23, art/src/wagon.py -> art/wagon.blend/.glb -> src/data/wagonMesh.js): a canvas-covered
// wooden wagon that is a travelling shop. Polyfork style: one flat-shaded mesh with a colour per face (vertex
// colours from the model's materials), plus the lantern's glass on its own glowing material. Origin on the ground
// under the middle of the bed; +x is the front (the tongue), +z the shop side (the counter, the awning, Wren).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WAGON_MATS, WAGON_NODES } from '../data/wagonMesh.js';
import { indexAttr } from '../core/meshpack.js';

let geos = null;
function geometries() {
  if (geos) return geos;
  const n = WAGON_NODES.find((x) => x.name === 'wagon');
  const body = [], glow = [];
  for (const p of n.prims) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
    g.setIndex(indexAttr(p.idx, THREE.BufferAttribute));
    const ng = g.toNonIndexed(); g.dispose();
    const c = WAGON_MATS[p.m].color, cnt = ng.attributes.position.count, col = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) { col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
    ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (WAGON_MATS[p.m].name === 'glow' ? glow : body).push(ng);
  }
  geos = { body: mergeGeometries(body), glow: mergeGeometries(glow) };
  body.concat(glow).forEach((g) => g.dispose());
  geos.body.computeVertexNormals(); geos.glow.computeVertexNormals(); // non-indexed: one normal per face
  return geos;
}

/** A new wagon: a Group of two meshes (the wagon, and the lantern glass that glows). */
export function buildWagonModel() {
  const G = geometries(), g = new THREE.Group();
  // double-sided: the canvas is a thin shell you can see from inside through the shop opening
  const body = new THREE.Mesh(G.body, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  body.castShadow = true; body.receiveShadow = true;
  const glow = new THREE.Mesh(G.glow, new THREE.MeshLambertMaterial({ color: '#ffd890', emissive: '#e0902a', emissiveIntensity: 0.9 }));
  g.add(body, glow);
  return g;
}

/** The wagon's solid parts in its own frame (x along it, z out of the shop side): [x0, x1, z0, z1] boxes. */
export const WAGON_SOLIDS = [
  [-1.8, 1.7, -1.04, 1.04],    // the bed, the canvas and the wheels
  [-0.18, 0.34, -1.24, -0.76], // the water barrel on the far side
  [-0.74, 0.74, 0.9, 1.32],    // the counter
  [-1.06, -0.88, 1.52, 1.7],   // the awning poles
  [0.88, 1.06, 1.52, 1.7],
  [1.7, 3.2, -0.45, 0.45],     // the tongue and its doubletree
  [-2.57, -1.93, 0.33, 0.97],  // the crates
  [-2.76, -1.8, 1.06, 1.6],    // two sacks by the crates
  [1.7, 2.5, -1.4, -0.7],      // two sacks by the front
];
