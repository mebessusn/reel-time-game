// The old shipwreck in the middle of Lilymarsh (v1.9.1, art/shipwreck.blend -> art/shipwreck.glb ->
// src/data/wreckMesh.js via scripts/glb-to-js.mjs): a big wooden ship cracked in two, ribs showing at the
// break, a snapped mast, and the fallen top lying across the gap with its torn sail. It sits half sunk;
// boats can't row through it.
import * as THREE from 'three';
import { WRECK_MATS, WRECK_NODES } from '../data/wreckMesh.js';
import { WATER_Y } from './terrain.js';
import { addCircle } from './colliders.js';

export const WRECK = { x: 131.2, z: 159.6, ry: 0.6, sink: 1.3, scale: 1.35, r: 14 };
const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);

export function buildShipwreck(scene) {
  const mats = WRECK_MATS.map((m) => new THREE.MeshLambertMaterial({ color: lin(m.color), side: m.name === 'sail' ? THREE.DoubleSide : THREE.FrontSide }));
  const g = new THREE.Group();
  g.name = 'shipwreck';
  for (const n of WRECK_NODES) {
    const node = new THREE.Group();
    node.name = n.name;
    node.position.fromArray(n.t); node.quaternion.fromArray(n.r); node.scale.fromArray(n.s);
    for (const p of n.prims) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(p.nrm), 3, true));
      geo.setIndex(p.idx.length && Math.max(...p.idx) > 65535 ? new THREE.Uint32BufferAttribute(p.idx, 1) : new THREE.Uint16BufferAttribute(p.idx, 1));
      const mesh = new THREE.Mesh(geo, mats[p.m]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      node.add(mesh);
    }
    g.add(node);
  }
  g.position.set(WRECK.x, WATER_Y - WRECK.sink, WRECK.z);
  g.rotation.y = WRECK.ry;
  g.scale.setScalar(WRECK.scale);
  g.position.y = WATER_Y - WRECK.sink * WRECK.scale;
  scene.add(g);
  // solid to boats and lines: a row of circles along the hull (the model's length runs along its local x)
  const ux = Math.cos(WRECK.ry), uz = -Math.sin(WRECK.ry);
  for (let t = -8.5; t <= 9.6; t += 1.2) addCircle(WRECK.x + ux * t * WRECK.scale, WRECK.z + uz * t * WRECK.scale, 2.7 * WRECK.scale, { water: true });
  return g;
}
