// Detailed rods and lures modelled in Blender (art/gear.blend -> gear.glb, quantized). scripts/gear-to-js.mjs
// turns the GLB into plain JS arrays (src/data/gearMesh.js), so the page embeds no binary files: nothing is
// fetched or unzipped, and the artifact can be shared publicly. Built once at boot; until then (or if building
// fails) gear.js falls back to the old voxel models, and actors swap in the models when ready.
// Materials named glow_* are emissive; metals get a shiny Phong so reels and guides catch the light.
import * as THREE from 'three';
import { GEAR_MATS, GEAR_NODES } from '../data/gearMesh.js';

const models = new Map();
let state = 'idle', promise = null;
const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);

function convert(m) {
  const color = lin(m.color);
  const emissive = lin(m.emissive);
  const glow = /^glow_/.test(m.name) || (emissive.getHex() !== 0 && m.strength > 0);
  const mat = m.metal > 0.5
    ? new THREE.MeshPhongMaterial({ color, shininess: 70, specular: color.clone().lerp(new THREE.Color('#ffffff'), 0.5) })
    : new THREE.MeshLambertMaterial({ color });
  if (glow) { mat.emissive = (emissive.getHex() ? emissive : color).clone(); mat.emissiveIntensity = 0.85; mat.userData.glow = true; }
  mat.name = m.name;
  return mat;
}

const attr = (a, size) => new THREE.BufferAttribute(new (globalThis[a.type])(a.data), size, a.norm);

function build() {
  const mats = GEAR_MATS.map(convert);
  for (const n of GEAR_NODES) {
    // The node carries the quantization offset and scale (positions are stored as small integers), so keep its
    // transform and wrap it: the wrapper is the model's origin, and tips and sockets hang off the wrapper.
    const node = new THREE.Group();
    node.name = n.name;
    node.position.fromArray(n.t); node.quaternion.fromArray(n.r); node.scale.fromArray(n.s);
    for (const p of n.prims) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', attr(p.pos, 3));
      g.setAttribute('normal', attr(p.nrm, 3));
      g.setIndex(attr(p.idx, 1));
      const mesh = new THREE.Mesh(g, mats[p.m]);
      mesh.castShadow = true; mesh.receiveShadow = false;
      node.add(mesh);
    }
    const wrap = new THREE.Group();
    wrap.name = n.name.replace(/\.\d+$/, '');
    wrap.add(node);
    models.set(wrap.name, wrap);
  }
}

export function loadGear() {
  if (promise) return promise;
  state = 'loading';
  promise = new Promise((res) => setTimeout(res, 0)).then(() => { build(); state = 'ready'; return true; })
    .catch((e) => { console.warn('gear models failed to load, using voxel gear', e); state = 'failed'; return false; });
  return promise;
}

export const gearReady = () => state === 'ready';

/** A fresh instance (shared geometry and materials) of a modelled rod or lure, or null. */
export function gearModel(id) {
  const m = models.get(id);
  return m ? m.clone(true) : null;
}
