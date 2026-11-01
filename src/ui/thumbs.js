// Offscreen renders of fish, junk, gear and avatars for cards, grids and the feed.
import * as THREE from 'three';
import { buildFish, buildJunk } from '../entities/fish.js';
import { buildRod, buildBobber, buildBoat } from '../entities/gear.js';
import { buildAvatar } from '../entities/avatar2.js';
import { SPECIES_BY_ID } from '../data/species.js';

let renderer = null, scene, camera;
const cache = new Map();
const W = 192, H = 132;

function setup() {
  if (renderer) return;
  const canvas = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a6a', 1.1));
  const d = new THREE.DirectionalLight('#ffffff', 1.2);
  d.position.set(2, 4, 5);
  scene.add(d);
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  camera.position.set(0, 0.6, 10);
  camera.lookAt(0, 0, 0);
}

function shoot(obj, { pad = 1.15, w = W, h = H, side = true } = {}) {
  setup();
  if (renderer.domElement.width !== w || renderer.domElement.height !== h) renderer.setSize(w, h, false);
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center);
  const aspect = w / h;
  const half = Math.max(size.x / 2 / aspect, size.y / 2, 0.05) * pad;
  camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
  camera.position.set(side ? 0 : 6, side ? 0.4 : 4, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL();
  scene.remove(obj);
  return url;
}

export function fishThumb(speciesId, variant = 'normal') {
  const key = `f:${speciesId}:${variant}`;
  if (cache.has(key)) return cache.get(key);
  const m = buildFish(speciesId, variant);
  m.scale.setScalar(1);
  // v1.12: shellfish are seen from above at a slant (side on, a crayfish is all legs)
  if (SPECIES_BY_ID[speciesId]?.shell) m.rotation.set(0.95, -0.25, 0); else m.rotation.set(0.12, 0, 0);
  const url = shoot(m);
  cache.set(key, url);
  return url;
}

export function junkThumb(junkId) {
  const key = `j:${junkId}`;
  if (cache.has(key)) return cache.get(key);
  const m = buildJunk(junkId);
  m.scale.setScalar(1);
  m.rotation.set(0.35, -0.6, 0);
  const url = shoot(m, { pad: 1.4 });
  cache.set(key, url);
  return url;
}

export function itemThumb(item) {
  const key = `i:${item.id}`;
  if (cache.has(key)) return cache.get(key);
  let m;
  if (item.kind === 'rod') { m = buildRod(item.id); m.rotation.set(0, 0, -0.9); }
  else if (item.kind === 'lure') { m = buildBobber(item.id); m.rotation.set(0.3, -0.6, 0); }
  else if (item.kind === 'boat') { m = buildBoat(item.id); m.rotation.set(0.45, -2.2, 0); }
  else return null;
  const url = shoot(m, { pad: 1.2 });
  cache.set(key, url);
  return url;
}

export function avatarThumb(cfg, { head = false } = {}) {
  const key = `a:${head ? 'h' : 'b'}:${JSON.stringify(cfg)}`;
  if (cache.has(key)) return cache.get(key);
  const av = buildAvatar(cfg);
  const obj = head ? av.parts.head : av.group;
  if (head) { av.parts.head.parent.remove(av.parts.head); av.parts.head.position.set(0, 0, 0); }
  obj.rotation.set(0.05, -0.35, 0);
  const url = shoot(obj, { pad: head ? 1.25 : 1.1, w: head ? 48 : 120, h: head ? 48 : 160 });
  av.dispose?.();
  cache.set(key, url);
  return url;
}

/** v1.9: a thumbnail of any model (built on demand), cached by key. */
export function objectThumb(key, build, { rx = 0, ry = 0, pad = 1.15 } = {}) {
  const k = `o:${key}`;
  if (cache.has(k)) return cache.get(k);
  const m = build();
  if (!m) return null;
  m.rotation.set(rx, ry, 0);
  const url = shoot(m, { pad });
  cache.set(k, url);
  return url;
}

/**
 * v1.10: a preview of one avatar-creator option: your angler wearing it, framed on the part it changes.
 * `region` is 'head' (hair, face, hats), 'torso' (shirts, accessories), 'legs' (pants), 'feet' (shoes), 'full',
 * or 'tall' (the whole angler at a fixed scale, for heights).
 */
const OPT = 112;
export function optionThumb(cfg, region = 'full') {
  const key = `opt:${region}:${JSON.stringify(cfg)}`;
  if (cache.has(key)) return cache.get(key);
  setup();
  if (renderer.domElement.width !== OPT || renderer.domElement.height !== OPT) renderer.setSize(OPT, OPT, false);
  const av = buildAvatar(cfg);
  const g = av.group;
  g.rotation.set(0, region === 'head' ? -0.28 : -0.42, 0);
  scene.add(g);
  g.updateMatrixWorld(true);
  const full = new THREE.Box3().setFromObject(g);
  let box = full.clone();
  if (region === 'head') box = new THREE.Box3().setFromObject(av.parts.head);
  else if (region !== 'full') {
    const y0 = full.min.y, hgt = full.max.y - y0;
    const [a, b] = region === 'torso' ? [0.36, 0.8] : region === 'legs' ? [0.02, 0.56] : [0, 0.2];
    box.min.y = y0 + hgt * a; box.max.y = y0 + hgt * b;
  }
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  let half = Math.max(size.x, size.y, 0.05) / 2 * (region === 'head' ? 1.22 : region === 'full' ? 1.06 : 1.18);
  if (region === 'tall') { half = 1.12; c.y = full.min.y + half * 0.97; } // fixed scale, so heights compare
  camera.left = -half; camera.right = half; camera.top = half; camera.bottom = -half;
  camera.position.set(c.x, c.y + 0.25, c.z + 10);
  camera.lookAt(c.x, c.y, c.z);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL();
  scene.remove(g);
  av.dispose?.();
  cache.set(key, url);
  if (cache.size > 900) { const first = cache.keys().next().value; cache.delete(first); }
  return url;
}
