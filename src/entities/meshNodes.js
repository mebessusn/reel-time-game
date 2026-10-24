// Three.js groups from the generated mesh modules (art/src/*.py -> scripts/glb-to-js.mjs).
import * as THREE from 'three';

const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
const cache = new WeakMap();

function materials(MATS, opts = {}) {
  let m = cache.get(MATS);
  if (m) return m;
  m = MATS.map((x) => {
    const color = lin(x.color);
    if (opts[x.name]) return opts[x.name](color);
    const e = x.emissive || [0, 0, 0];
    if (e[0] + e[1] + e[2] > 0.05) return new THREE.MeshLambertMaterial({ color, emissive: lin(e), emissiveIntensity: 0.8 });
    if (x.metal > 0.5) return new THREE.MeshPhongMaterial({ color, shininess: 70, specular: '#e8eef4' });
    if (x.rough < 0.45) return new THREE.MeshPhongMaterial({ color, shininess: 60, specular: '#ffffff' });
    return new THREE.MeshLambertMaterial({ color });
  });
  cache.set(MATS, m);
  return m;
}

/** One named node as a Group of meshes (one per material). opts: { matName: (color) => Material }. */
export function buildNode(MATS, NODES, name, { shadow = true, opts } = {}) {
  const n = NODES.find((x) => x.name === name);
  const g = new THREE.Group();
  g.name = name;
  if (!n) return g;
  const mats = materials(MATS, opts);
  for (const p of n.prims) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
    if (p.nrm) geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(p.nrm), 3, true));
    else geo.computeVertexNormals();
    geo.setIndex(p.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(p.idx, 1) : new THREE.Uint16BufferAttribute(p.idx, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mats[p.m]);
    mats[p.m].userData.matIndex = p.m; // (v1.15.13: so a boat can find the materials it repaints)
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}
