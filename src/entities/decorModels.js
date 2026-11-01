// Cottage furniture and wall pieces (v1.13.11, art/src/decor.py -> art/decor.blend/.glb -> src/data/decorMesh.js).
// Floor pieces stand on their origin with the footprint centred (MOVABLE sizes in src/game/home.js); wall pieces are
// centred on their origin, back on the wall, facing local +Z. The armchair faces +Z, the bookshelf +X (it stands
// against the left wall) and the stove's fire door -Z.
import * as THREE from 'three';
import { DECOR_MATS, DECOR_NODES } from '../data/decorMesh.js';

const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
let mats = null;
function materials() {
  if (mats) return mats;
  mats = DECOR_MATS.map((m) => {
    const color = lin(m.color);
    if (m.name === 'glow') return new THREE.MeshLambertMaterial({ color, emissive: '#f0a030', emissiveIntensity: 0.6 });
    if (m.name === 'fire') return new THREE.MeshLambertMaterial({ color, emissive: '#ff6010', emissiveIntensity: 0.9 });
    if (m.metal > 0.5) return new THREE.MeshPhongMaterial({ color, shininess: 70, specular: '#fff0c8' });
    if (m.rough < 0.35) return new THREE.MeshPhongMaterial({ color, shininess: 80, specular: '#ffffff' });
    return new THREE.MeshLambertMaterial({ color });
  });
  return mats;
}

function node(name, swap = {}) {
  const n = DECOR_NODES.find((x) => x.name === name);
  const g = new THREE.Group();
  if (!n) return g;
  for (const p of n.prims) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(p.nrm), 3, true));
    geo.setIndex(new THREE.Uint16BufferAttribute(p.idx, 1));
    const mesh = new THREE.Mesh(geo, swap[DECOR_MATS[p.m].name] || materials()[p.m]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

/** A cottage piece by its DECOR id (rug, armchair, lamp, plant, shelf, stove, painting, banner, mount, catbed). */
export function buildDecor(id) { return node(`decor_${id}`); }

/** A lake collection plaque, its fish in the lake's colour. */
export function buildPlaque(color) {
  const metal = new THREE.MeshPhongMaterial({ color, shininess: 70, specular: '#fff0c8', emissive: color, emissiveIntensity: 0.2 });
  return node('decor_plaque', { plaque_metal: metal });
}
