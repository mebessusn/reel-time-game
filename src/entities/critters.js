// Cute low-poly critters (v1.8.2, art/critters.blend -> art/critters.glb -> src/data/critterMesh.js via
// scripts/glb-to-js.mjs): mallard drake and hen for the wild ducks, and the four pets (cat, pup, otter,
// duckling). Each critter is a few nodes named <kind>_<part>: body, head, tail, and wingL/wingR for the
// ducks. The head, tail and wings pivot where they join the body. Facing +X, standing on y = 0.
import * as THREE from 'three';
import { CRITTER_MATS, CRITTER_NODES } from '../data/critterMesh.js';

const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
let mats = null, geos = null;
function materials() {
  if (mats) return mats;
  mats = CRITTER_MATS.map((m) => {
    const color = lin(m.color);
    if (m.rough < 0.35) return new THREE.MeshPhongMaterial({ color, shininess: 80, specular: '#ffffff' });
    return new THREE.MeshLambertMaterial({ color });
  });
  return mats;
}
function geometries(n) {
  geos ??= new Map();
  if (!geos.has(n.name)) {
    geos.set(n.name, n.prims.map((p) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(p.nrm), 3, true));
      geo.setIndex(p.idx.length > 65535 || Math.max(...p.idx) > 65535 ? new THREE.Uint32BufferAttribute(p.idx, 1) : new THREE.Uint16BufferAttribute(p.idx, 1));
      return [geo, p.m];
    }));
  }
  return geos.get(n.name);
}

/** A critter group; userData holds its parts ({ head, tail, wingL, wingR }) by name. */
export function buildCritter(kind, { shadows = true } = {}) {
  const body = CRITTER_NODES.find((n) => n.name === `${kind}_body`);
  if (!body) return null;
  const g = new THREE.Group();
  g.name = kind;
  const parts = {};
  for (const n of CRITTER_NODES) {
    if (!n.name.startsWith(kind + '_')) continue;
    const part = n.name.slice(kind.length + 1);
    const node = new THREE.Group();
    node.name = n.name;
    node.position.set(n.t[0] - body.t[0], n.t[1] - body.t[1], n.t[2] - body.t[2]);
    node.quaternion.fromArray(n.r); node.scale.fromArray(n.s);
    for (const [geo, m] of geometries(n)) { const mesh = new THREE.Mesh(geo, materials()[m]); mesh.castShadow = shadows; node.add(mesh); }
    g.add(node);
    parts[part] = node;
  }
  g.userData.parts = parts;
  return g;
}
