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

/** A fresh instance (shared geometry and materials) of a modelled rod or lure, or null.
 *  lite (v1.16 perf, for villagers): every part merged into one vertex-coloured mesh, one draw call instead of five. */
export function gearModel(id, lite = false) {
  const m = lite ? liteModel(id) : models.get(id);
  return m ? m.clone(true) : null;
}
const lites = new Map();
let liteMat = null;
function liteModel(id) {
  if (lites.has(id)) return lites.get(id);
  const m = models.get(id); if (!m) return null;
  const node = m.children[0], parts = node.children.filter((o) => o.isMesh);
  let n = 0; for (const o of parts) n += o.geometry.attributes.position.count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3), idx = [];
  let at = 0;
  for (const o of parts) {
    const g = o.geometry, P = g.attributes.position, N = g.attributes.normal, c = o.material.color, cnt = P.count;
    for (let i = 0; i < cnt; i++) {
      pos.set([P.getX(i), P.getY(i), P.getZ(i)], (at + i) * 3); nrm.set([N.getX(i), N.getY(i), N.getZ(i)], (at + i) * 3); col.set([c.r, c.g, c.b], (at + i) * 3);
    }
    const I = g.index; for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + at);
    at += cnt;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  liteMat ||= new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, liteMat); mesh.castShadow = true; mesh.receiveShadow = false;
  const node2 = new THREE.Group(); node2.name = node.name; node2.position.copy(node.position); node2.quaternion.copy(node.quaternion); node2.scale.copy(node.scale); node2.add(mesh);
  const wrap = new THREE.Group(); wrap.name = m.name; wrap.add(node2);
  lites.set(id, wrap);
  return wrap;
}
