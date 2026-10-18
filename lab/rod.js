// Dev-only lab: the real Actor (avatar + rod + line + bobber) in each fishing pose, to check rod angles
// against big hats. /lab/rod.html?hat=sunhat&rod=rod_birch
import * as THREE from 'three';
import { loadGear } from '../src/entities/gearModels.js';
import { Actor } from '../src/game/actor.js';
import * as O from '../src/data/avatarOptions.js';

await loadGear();
if (q2().has('tx')) Actor.ROD_TILT = { x: +q2().get('tx'), y: +q2().get('ty') };
function q2() { return new URLSearchParams(location.search); }
const q = new URLSearchParams(location.search);
const poses = (q.get('poses') || 'idle,charge,wait,reel,back').split(',');
const angles = [0.0, 1.4, 2.6];
const CW = 300, CH = 340, W = poses.length * CW, H = angles.length * CH;
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(W, H); r.setScissorTest(true); r.outputColorSpace = THREE.SRGBColorSpace;
document.body.append(r.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#ffffff', '#6a5a4a', 1.1));
const sun = new THREE.DirectionalLight('#fff4e0', 1.3); sun.position.set(2, 3, 4); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshLambertMaterial({ color: '#7bb661' }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const cfg = { ...O.defaultAvatar('female'), hat: q.get('hat') || 'sunhat', shirt: 'sundress', shirtColor: 8, hair: 'sidebraid', eyewear: 'bigsunnies' };
const cam = new THREE.PerspectiveCamera(32, CW / CH, 0.05, 50);
poses.forEach((pose, i) => {
  const a = new Actor(scene);
  a.setLook(cfg, { rod: q.get('rod') || 'rod_birch', lure: 'lure_duck', boat: 'boat_oak' });
  const seat = pose.startsWith('sit');
  const s = { x: 0, y: 0, z: 0, yaw: seat ? 0.7 : 0, seat: seat ? 0.26 : 0, seatYaw: seat ? 0 : undefined, running: pose === 'run', moving: pose === 'run', mode: 'shore', pose: pose === 'back' || pose === 'run' || pose === 'sit' ? 'idle' : pose === 'sitwait' ? 'wait' : pose, rod: pose === 'back' ? 'back' : 'hand', bobber: pose === 'wait' || pose === 'reel' || pose === 'sitwait' ? { x: 0.4, z: 4, y: 0.05 } : null, power: 0.6, castK: 0.5, tension: 0.4 };
  let chair = null;
  if (seat) {
    chair = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color: '#d0603a' }), w = new THREE.MeshLambertMaterial({ color: '#7a5230' });
    const seatM = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.46), m); seatM.position.y = 0.24; chair.add(seatM);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.46, 0.035), m); back.position.set(0, 0.55, -0.28); back.rotation.x = -0.26; chair.add(back);
    for (const sx of [-0.29, 0.29]) for (const sz of [-0.2, 0.2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.05), w); l.position.set(sx, 0.125, sz); chair.add(l); }
    for (const sx of [-0.32, 0.32]) { const ar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.5), w); ar.position.set(sx, 0.44, 0.02); chair.add(ar); }
    scene.add(chair);
  }
  for (let k = 0; k < 12; k++) a.update(0.2, 1 + k * 0.1, s);
  angles.forEach((ang, j) => {
    cam.position.set(Math.sin(ang) * 3.6, 1.3, Math.cos(ang) * 3.6); cam.lookAt(0, 0.95, 0);
    r.setViewport(i * CW, H - (j + 1) * CH, CW, CH); r.setScissor(i * CW, H - (j + 1) * CH, CW, CH);
    r.setClearColor('#2a4a42'); r.clear(); r.render(scene, cam);
  });
  a.dispose(); if (chair) scene.remove(chair);
});
window.__done = true;
