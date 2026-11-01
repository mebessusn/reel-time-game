// Shovel and treasure chest (v1.8.1, art/treasure.blend -> art/treasure.glb -> src/data/treasureMesh.js via
// scripts/glb-to-js.mjs). The chest is two nodes: the base (with a heap of coins and pearls) and the lid,
// whose origin sits on the hinge along the back top edge, so rotating it about X flips it open.
// The shovel's origin is the right-hand grip; the blade points down its local -Y.
import * as THREE from 'three';
import { TREASURE_MATS, TREASURE_NODES } from '../data/treasureMesh.js';

const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
let mats = null;
function materials() {
  if (mats) return mats;
  mats = TREASURE_MATS.map((m) => {
    const color = lin(m.color);
    if (m.metal > 0.5) return new THREE.MeshPhongMaterial({ color, shininess: 90, specular: '#fff4c8', emissive: m.name === 'coin' || m.name === 'gold' ? new THREE.Color('#5a3a00') : new THREE.Color(0), emissiveIntensity: 0.35 });
    if (m.rough < 0.35) return new THREE.MeshPhongMaterial({ color, shininess: 70, specular: '#ffffff' });
    return new THREE.MeshLambertMaterial({ color });
  });
  return mats;
}
export const coinMaterial = () => materials()[TREASURE_MATS.findIndex((m) => m.name === 'coin')];
export const pearlMaterial = () => materials()[TREASURE_MATS.findIndex((m) => m.name === 'pearl')];

function node(name) {
  const n = TREASURE_NODES.find((x) => x.name === name);
  const g = new THREE.Group();
  g.name = name;
  g.position.fromArray(n.t); g.quaternion.fromArray(n.r); g.scale.fromArray(n.s);
  for (const p of n.prims) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(p.nrm), 3, true));
    geo.setIndex(new THREE.Uint16BufferAttribute(p.idx, 1));
    const mesh = new THREE.Mesh(geo, materials()[p.m]);
    mesh.castShadow = true;
    g.add(mesh);
  }
  return g;
}

/** A shovel held at the grip, blade toward local -Y. */
export function buildShovel() {
  const s = node('shovel');
  s.position.set(0, 0, 0);
  const g = new THREE.Group();
  g.add(s);
  g.name = 'shovel';
  return g;
}

/** The chest: userData.lid (rotate .x negative to open), userData.glow (a point light). */
export function buildChest() {
  const g = new THREE.Group();
  g.add(node('chest_base'));
  const lid = node('chest_lid');
  g.add(lid);
  const glow = new THREE.PointLight('#ffd060', 0, 5);
  glow.position.y = 0.7;
  g.add(glow);
  g.userData.lid = lid; g.userData.glow = glow;
  return g;
}
