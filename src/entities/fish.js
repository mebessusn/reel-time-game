// Fish and junk models (soft-block style). Fish come from softfish.js (one merged mesh per
// species/variant, nose along +X); junk catches are small soft-block props.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { softFishModel } from './softfish.js';
import { SHELL_MATS, SHELL_NODES } from '../data/shellfishMesh.js';
import { Atlas, softBox, tone, hash, atlasMaterial } from '../render/soft.js';

// ---------------------------------------------------------------- v1.12 shellfish (art/shellfish.blend)
// One merged mesh per species (one geometry group per material), nose along +X, centred. Gold and diamond
// shellfish get a gilded or glassy coat.
const shellCache = new Map();
const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
export function shellModel(id, variant = 'normal') {
  const key = `${id}:${variant}`;
  if (shellCache.has(key)) return shellCache.get(key);
  const n = SHELL_NODES.find((x) => x.name === id);
  if (!n) return null;
  const geos = [], mats = [];
  n.prims.forEach((p) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(Array.from(p.nrm, (v) => v / 127)), 3));
    geo.setIndex(p.idx);
    geos.push(geo);
    const m = SHELL_MATS[p.m];
    let color = lin(m.color);
    const emissive = lin(m.emissive);
    if (variant === 'gold') color = color.clone().lerp(new THREE.Color('#e8b830'), 0.75);
    if (variant === 'diamond') color = color.clone().lerp(new THREE.Color('#c8f4ff'), 0.7);
    mats.push(new THREE.MeshPhongMaterial({ color, emissive: variant === 'gold' ? new THREE.Color('#3a2800') : variant === 'diamond' ? new THREE.Color('#1a3a48') : emissive, shininess: variant === 'normal' ? (m.rough < 0.35 ? 70 : 24) : 90, specular: variant === 'normal' ? '#444444' : '#ffffff' }));
  });
  const geometry = mergeGeometries(geos, true);
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  geometry.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2);
  geometry.computeBoundingBox();
  const out = { geometry, material: mats, length: bb.max.x - bb.min.x };
  shellCache.set(key, out);
  return out;
}

// World size: roughly proportional to log(weight), clamped.
export function fishScale(speciesId, weight) {
  const sp = SPECIES_BY_ID[speciesId];
  const base = sp.shell ? shellModel(speciesId).length * 0.6 : softFishModel(speciesId).length;
  const [mn, mx] = sp.weight;
  const rel = (weight - mn) / (mx - mn);
  const lenBlocks = 0.45 + Math.log10(1 + mx) * 0.35 + rel * 0.25; // ~0.5..1.6 blocks
  return (lenBlocks / base) * (sp.scale || 1);
}

export function buildFish(speciesId, variant = 'normal', weight = null) {
  const sp = SPECIES_BY_ID[speciesId];
  const model = sp.shell ? shellModel(speciesId, variant) : softFishModel(speciesId, variant);
  const mesh = new THREE.Mesh(model.geometry, model.material);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.scale.setScalar(fishScale(speciesId, weight ?? (sp.weight[0] + sp.weight[1]) / 2));
  return mesh;
}

// ---------------------------------------------------------------- junk
const junkCache = new Map();
export function buildJunk(junkId) {
  let m = junkCache.get(junkId);
  if (!m) {
    const atlas = new Atlas(256);
    const geos = [];
    const box = (w, h, d, r, paint, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const g = softBox(atlas, w, h, d, r, typeof paint === 'function' ? { all: paint } : paint, { D: 64 });
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
      geos.push(g);
    };
    const fill = (c, k = 0.08) => (f) => f.fill((x, y) => (hash(x, y, 9) > 0.85 ? tone(c, -k) : c));
    switch (junkId) {
      case 'boot':
        box(0.42, 0.14, 0.2, 0.06, { all: fill('#5a3a20'), bottom: fill('#2a2a2a') }, 0.06, 0.07, 0);
        box(0.18, 0.4, 0.2, 0.07, { all: (f) => { fill('#6a4a2a')(f); for (let y = 2; y < f.h - 2; y += 4) f.rect(Math.floor(f.w / 2) - 1, y, 2, 1, '#d8c090'); } }, -0.07, 0.3, 0);
        break;
      case 'can':
        box(0.2, 0.32, 0.2, 0.08, { all: (f) => { f.fill('#a8a8b0'); f.rect(0, Math.floor(f.h * 0.3), f.w, Math.floor(f.h * 0.4), '#c0392b'); f.rect(2, Math.floor(f.h * 0.45), f.w - 4, 2, '#f0f0f0'); }, top: (f) => { f.fill('#c0c0c8'); f.rect(Math.floor(f.w / 2) - 1, 2, 3, 2, '#707078'); } }, 0, 0.16, 0);
        break;
      case 'lilypad':
        box(0.5, 0.03, 0.5, 0.012, { all: (f) => f.fill((x, y) => (Math.abs(x - y) < 1 ? '#6aba4a' : '#4a9a3a')) }, 0, 0.02, 0);
        box(0.1, 0.1, 0.1, 0.04, { all: fill('#f8b0c8') }, 0.05, 0.08, 0.05);
        break;
      case 'bottle':
        box(0.2, 0.36, 0.2, 0.07, { all: (f) => { f.fill('#7ac0a0'); f.rect(2, Math.floor(f.h * 0.3), f.w - 4, Math.floor(f.h * 0.35), '#f6ebd3'); f.px(2, 2, '#c8f0e0'); } }, 0, 0.18, 0);
        box(0.08, 0.12, 0.08, 0.03, { all: fill('#7ac0a0') }, 0, 0.42, 0);
        box(0.07, 0.06, 0.07, 0.02, { all: fill('#a07040') }, 0, 0.5, 0);
        break;
      case 'chest':
        box(0.6, 0.3, 0.4, 0.06, { all: (f) => { f.fill((x, y) => (y % 5 === 4 ? '#6a4020' : '#8a5a2a')); f.rect(0, 0, 3, f.h, '#c8a040'); f.rect(f.w - 3, 0, 3, f.h, '#c8a040'); } }, 0, 0.15, 0);
        box(0.62, 0.16, 0.42, 0.08, { all: (f) => { f.fill('#a0703e'); f.rect(0, 0, 3, f.h, '#c8a040'); f.rect(f.w - 3, 0, 3, f.h, '#c8a040'); } }, 0, 0.36, 0);
        box(0.1, 0.12, 0.04, 0.02, { all: fill('#f2c040') }, 0, 0.29, 0.21);
        break;
      default:
        box(0.2, 0.2, 0.2, 0.06, fill('#888888'), 0, 0.1, 0);
    }
    const geo = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    geo.translate(0, -0.15, 0);
    m = { geo, mat: atlasMaterial(atlas) };
    junkCache.set(junkId, m);
  }
  const mesh = new THREE.Mesh(m.geo, m.mat);
  mesh.scale.setScalar(1.6);
  mesh.castShadow = true;
  return mesh;
}
