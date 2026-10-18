// Dev-only lab: every modelled rod and lure through the game's own builders and materials.
import * as THREE from 'three';
import { loadGear } from '../src/entities/gearModels.js';
import { buildRod, buildBobber } from '../src/entities/gear.js';
import { ITEMS } from '../src/data/items.js';

await loadGear();
const rods = ITEMS.filter((i) => i.kind === 'rod'), lures = ITEMS.filter((i) => i.kind === 'lure');
const W = 1800, H = 900;
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(W, H); r.setScissorTest(true); r.outputColorSpace = THREE.SRGBColorSpace;
document.body.append(r.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#ffffff', '#6a5a4a', 1.1));
const sun = new THREE.DirectionalLight('#fff4e0', 1.4); sun.position.set(2, 3, 4); scene.add(sun);
const cell = (obj, x, y, w, h, cam) => {
  scene.add(obj);
  r.setViewport(x, H - y - h, w, h); r.setScissor(x, H - y - h, w, h);
  r.setClearColor('#2a4a42'); r.clear(); r.render(scene, cam);
  scene.remove(obj);
};
rods.forEach((it, i) => {
  const m = buildRod(it.id); m.rotation.set(0, -0.5, -0.25);
  const cam = new THREE.PerspectiveCamera(30, 200 / 520, 0.1, 20); cam.position.set(0, 0.75, 3.6); cam.lookAt(0, 0.75, 0);
  cell(m, i * 200, 0, 200, 520, cam);
});
lures.forEach((it, i) => {
  const m = buildBobber(it.id); m.rotation.set(0.25, -0.6, 0);
  const cam = new THREE.PerspectiveCamera(30, 225 / 380, 0.01, 20); cam.position.set(0, 0.05, 1.0); cam.lookAt(0, 0.02, 0);
  cell(m, i * 225, 520, 225, 380, cam);
});
window.__done = true;
