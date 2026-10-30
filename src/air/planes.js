// Skye's Air Races: the planes. Each flies a little differently; each can wear a paint job.
//   snowgoose  Skye's bush plane (everyone has it): steady all-rounder
//   cub        a little yellow taildragger: slower, turns on a dime
//   biplane    a stunt biplane on floats: quick tricks, good boost from them
//   racer      a sleek low-wing racer: fast, wide turns
// Models: art/src/airraces.py (pl_*) and art/src/snowgoose.py (the Snow Goose).
import * as THREE from 'three';
import { buildNode } from '../ocean/meshes.js';
import { AIRRACES_MATS, AIRRACES_NODES } from '../data/airracesMesh.js';
import { SnowGoose } from '../north/plane.js';

export const PLANES = {
  snowgoose: { id: 'snowgoose', name: 'Snow Goose', desc: 'Skye\'s bush plane. Steady and forgiving.', speed: 46, turn: 1.0, climb: 1.0, boost: 1.0, trick: 1.0, scale: 1.0, unlock: null },
  cub: { id: 'cub', name: 'Yellow Cub', desc: 'Small and nimble: turns on a dime, a little slower.', speed: 44.5, turn: 1.3, climb: 1.15, boost: 1.0, trick: 1.1, scale: 1.0, unlock: { medals: 4, text: '4 medals' } },
  biplane: { id: 'biplane', name: 'Red Baron', desc: 'A stunt biplane: lightning tricks, and tricks fill its boost faster.', speed: 45.5, turn: 1.15, climb: 1.05, boost: 1.1, trick: 1.6, scale: 1.0, unlock: { medals: 10, text: '10 medals' } },
  racer: { id: 'racer', name: 'Bluebolt Racer', desc: 'Built for speed, but it turns wide: line up your corners early.', speed: 48.5, turn: 0.85, climb: 0.95, boost: 1.2, trick: 0.9, scale: 1.0, unlock: { golds: 6, text: '6 golds' } },
};
export const PLANE_LIST = Object.values(PLANES);

// paint jobs: [paint, trim]; some come with medals, the rest from Skye's paint shop (coins)
export const PAINTS = [
  { id: 'factory', name: 'Factory', colors: null, price: 0 },
  { id: 'sunset', name: 'Sunset', colors: ['#f07020', '#2a1e3a'], price: 400 },
  { id: 'mint', name: 'Mint', colors: ['#7ad8b8', '#f2f0ea'], price: 400 },
  { id: 'midnight', name: 'Midnight', colors: ['#1e2c48', '#f2c21a'], price: 600 },
  { id: 'cherry', name: 'Cherry', colors: ['#d8304a', '#f2f0ea'], price: 600 },
  { id: 'forest', name: 'Forest', colors: ['#2f6a3c', '#e2cf98'], price: 600 },
  { id: 'aurora', name: 'Aurora', colors: ['#3ad8a0', '#7a4ad0'], price: 0, unlock: 'aurora' },
  { id: 'gold', name: 'Gold Leaf', colors: ['#d8a82a', '#1c1e22'], price: 0, unlock: 'platinum' },
];
export const PAINT_BY_ID = Object.fromEntries(PAINTS.map((p) => [p.id, p]));

const PROP_AT = { cub: [0, 1.15, 2.42], biplane: [0, 1.75, 2.62], racer: [0, 1.1, 3.05] };

/** A plane you can fly: group, the prop to spin, paint, and an animate(dt, {throttle, roll, pitch, yaw}). */
export function buildPlane(id = 'snowgoose', paint = 'factory') {
  if (id === 'snowgoose' || !PLANES[id]) {
    const sg = new SnowGoose();
    sg.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    if (paint !== 'factory') repaint(sg.group, PAINT_BY_ID[paint]?.colors, ['sg_red'], ['sg_cream']);
    return { group: sg.group, animate: (dt, c) => sg.animate(dt, c), kind: 'snowgoose' };
  }
  const g = new THREE.Group(); g.name = `plane-${id}`;
  const body = buildNode(AIRRACES_MATS, AIRRACES_NODES, `pl_${id}`); g.add(body);
  const prop = new THREE.Group(); prop.position.fromArray(PROP_AT[id]); prop.add(buildNode(AIRRACES_MATS, AIRRACES_NODES, `pl_${id}_prop`)); g.add(prop);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(id === 'biplane' ? 1.15 : 0.95, 28), new THREE.MeshBasicMaterial({ color: '#2a2a2a', transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide }));
  disc.position.fromArray(PROP_AT[id]); disc.position.z += 0.05; g.add(disc);
  g.traverse((o) => { if (o.isMesh && o !== disc) { o.castShadow = true; o.receiveShadow = false; } });
  repaint(g, PAINT_BY_ID[paint]?.colors, [`pl_${id}_paint`], [`pl_${id}_trim`]);
  let spin = 0, rpm = 0;
  return {
    group: g, kind: id,
    animate(dt, { throttle = 0.8 } = {}) {
      rpm += (throttle - rpm) * Math.min(1, dt * 2); spin += dt * (2 + rpm * 70); prop.rotation.z = spin;
      const fast = rpm > 0.35; disc.visible = fast; prop.children[0].visible = !fast || rpm < 0.5;
    },
  };
}

/** Swap a plane's paint and trim materials for clones in new colours. */
function repaint(group, colors, paintNames, trimNames) {
  if (!colors) return;
  const names = AIRRACES_MATS.map((m) => m.name);
  group.traverse((o) => {
    if (!o.isMesh) return;
    const idx = o.material.userData.matIndex, nm = idx != null ? names[idx] : null;
    const isSG = !nm && o.material.color; // (the Snow Goose's library: match by colour below)
    if (nm && paintNames.includes(nm)) { o.material = o.material.clone(); o.material.userData.clone = true; o.material.color.set(colors[0]); }
    else if (nm && trimNames.includes(nm)) { o.material = o.material.clone(); o.material.userData.clone = true; o.material.color.set(colors[1]); }
    else if (isSG && paintNames[0] === 'sg_red') {
      const c = o.material.color, hsl = {}; c.getHSL(hsl);
      if (hsl.s > 0.5 && (hsl.h < 0.05 || hsl.h > 0.95) && hsl.l > 0.2 && hsl.l < 0.6) { o.material = o.material.clone(); o.material.userData.clone = true; o.material.color.set(colors[0]); }
      else if (hsl.l > 0.8 && hsl.s < 0.5) { o.material = o.material.clone(); o.material.userData.clone = true; o.material.color.set(colors[1]); }
    }
  });
}

/** Can you fly this plane yet? (medals and golds from your air-race record) */
export function planeUnlocked(id, rec) {
  const P = PLANES[id]; if (!P?.unlock || rec?.testAll) return true;
  const medals = Object.values(rec?.medals || {}).reduce((n, m) => n + (m || 0), 0);
  const golds = Object.values(rec?.medals || {}).filter((m) => m >= 3).length;
  return (P.unlock.medals ? medals >= P.unlock.medals : true) && (P.unlock.golds ? golds >= P.unlock.golds : true);
}
