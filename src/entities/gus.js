// Gus the heron, shopkeeper (v1.8 remodel, art/gus.blend): an S-necked grey heron in a bucket hat with a
// fishing fly in the band, round gold spectacles, a green apron with a float in the pocket and a red bow tie.
// The mesh ships as plain arrays (src/data/gusMesh.js, made by scripts/glb-to-js.mjs). Two parts: the legs,
// and the body pivoting at the hips, which the game tips forward when he pecks at the counter.
// Built facing +Z and turned to +X (toward his customers), like the old model.
import * as THREE from 'three';
import { GUS_MATS, GUS_NODES } from '../data/gusMesh.js';

const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);

// v1.8.2: richer colour (a touch more saturation, no warm glow washing him out under the lanterns) and
// soft feather mottling in vertex colours, so he reads as a painted heron, not a pale plastic one.
const TEXTURED = /feather|belly|crest|apron|hat/;
function material(m) {
  const color = lin(m.color);
  const hsl = {}; color.getHSL(hsl); color.setHSL(hsl.h, Math.min(1, hsl.s * 1.25), hsl.l * 0.9);
  const vertexColors = TEXTURED.test(m.name);
  if (m.metal > 0.5) return new THREE.MeshPhongMaterial({ color, shininess: 80, specular: '#fff0c0' });
  if (m.rough < 0.35) return new THREE.MeshPhongMaterial({ color, shininess: 60, specular: '#ffffff', vertexColors });
  return new THREE.MeshLambertMaterial({ color, vertexColors });
}

// Feathery mottling: overlapping scallops and soft streaks, a little darker toward the tail and the legs.
function mottle(geo, name) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  const feather = /feather|crest/.test(name), cloth = /apron|hat/.test(name);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let k = 1;
    if (feather) k = 0.78 + 0.22 * Math.abs(Math.sin(y * 38 + Math.sin(x * 21) * 1.4)) * (0.8 + 0.2 * Math.sin(z * 17 + x * 9));
    else if (cloth) k = 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(x * 60) * Math.sin(y * 60 + z * 40)); // a woven look
    else k = 0.9 + 0.1 * Math.sin(y * 24 + z * 11); // the white belly: gentle soft-feather banding
    k *= 0.9 + 0.1 * Math.min(1, Math.max(0, y * 1.2)); // a little shade lower down
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

export function buildGus() {
  const mats = GUS_MATS.map(material);
  const g = new THREE.Group();
  let body = null;
  for (const n of GUS_NODES) {
    const node = new THREE.Group();
    node.name = n.name;
    node.position.fromArray(n.t); node.quaternion.fromArray(n.r); node.scale.fromArray(n.s);
    for (const p of n.prims) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(p.nrm), 3, true));
      geo.setIndex(p.idx.length > 65535 ? new THREE.Uint32BufferAttribute(p.idx, 1) : new THREE.Uint16BufferAttribute(p.idx, 1));
      if (TEXTURED.test(GUS_MATS[p.m].name)) mottle(geo, GUS_MATS[p.m].name);
      const mesh = new THREE.Mesh(geo, mats[p.m]);
      mesh.castShadow = true; mesh.receiveShadow = false;
      node.add(mesh);
    }
    g.add(node);
    if (n.name === 'gus_body') body = node;
  }
  const outer = new THREE.Group();
  g.rotation.y = Math.PI / 2; // face +X
  outer.add(g);
  outer.userData.body = body || g;
  return outer;
}
