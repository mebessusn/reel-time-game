// v1.12: a picture for everything in Gus's shop. Bait, upgrades, away gear, cabin decor, pets, clothes and
// emotes all get a little 3D render (rods, lures and boats already had one in thumbs.js).
import * as THREE from 'three';
import { objectThumb, fishThumb, optionThumb } from './thumbs.js';
import { shellModel, buildFish } from '../entities/fish.js';
import { buildAvatar, animateAvatar } from '../entities/avatar2.js';
import { buildBoat, buildRod } from '../entities/gear.js';
import { buildShovel } from '../entities/treasureModels.js';
import { buildDecor } from '../entities/decorModels.js';
import { buildPet } from '../game/pet.js';
import { HATS, SHIRTS, ACCESSORIES, defaultAvatar } from '../data/avatarOptions.js';

const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
const phong = (c, extra = {}) => new THREE.MeshPhongMaterial({ color: c, shininess: 60, ...extra });
const box = (w, h, d, c, x = 0, y = 0, z = 0, extra) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c, extra)); m.position.set(x, y, z); return m; };
const ball = (r, c, x = 0, y = 0, z = 0, extra, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), phong(c, extra)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; };
const cyl = (r0, r1, h, c, x = 0, y = 0, z = 0, extra, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), phong(c, extra)); m.position.set(x, y, z); return m; };
const grp = (...p) => { const g = new THREE.Group(); g.add(...p); return g; };
const tube = (pts, r, c, extra) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 40, r, 8), phong(c, extra));
function shell(name) { const m = shellModel(name); return m ? new THREE.Mesh(m.geometry, m.material) : null; }

// ---- bait
const BAIT = {
  worm: () => grp(tube([[-0.5, 0, 0], [-0.3, 0.15, 0.05], [-0.1, -0.05, 0], [0.1, 0.12, -0.05], [0.3, -0.04, 0], [0.5, 0.1, 0]], 0.06, '#d87a8a'), ball(0.065, '#c8606a', 0.5, 0.1, 0)),
  cricket: () => { const g = grp(ball(0.18, '#4a6a2a', 0, 0, 0, {}, 1.6, 0.8, 0.8), ball(0.12, '#3a5a22', 0.3, 0.04, 0), ball(0.03, '#111', 0.38, 0.1, 0.06), ball(0.03, '#111', 0.38, 0.1, -0.06));
    for (const s of [1, -1]) { g.add(tube([[0.05, 0, s * 0.1], [-0.12, 0.25, s * 0.2], [-0.35, -0.08, s * 0.22]], 0.025, '#3a5a22')); g.add(tube([[0.38, 0.1, s * 0.04], [0.6, 0.3, s * 0.2], [0.8, 0.35, s * 0.3]], 0.008, '#2a3a1a')); }
    return g; },
  dough: () => grp(ball(0.32, '#f0d070', 0, 0, 0, {}, 1, 0.9, 1), ball(0.05, '#e8b840', 0.15, 0.2, 0.15), ball(0.04, '#e8b840', -0.12, 0.25, -0.1), tube([[0, 0.25, 0], [0, 0.55, 0], [0.15, 0.6, 0]], 0.02, '#b8bec2')),
  glowgrub: () => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) g.add(ball(0.12 - i * 0.008, '#8affd8', -0.3 + i * 0.13, Math.sin(i * 0.8) * 0.05, 0, { emissive: '#3ab890' })); g.add(ball(0.03, '#123', 0.42, 0.05, 0.06)); return g; },
};
export function baitThumb(id) {
  if (id === 'minnow') return fishThumb('minnow');
  const b = BAIT[id];
  return b ? objectThumb(`bait:${id}`, b, { rx: 0.4, ry: -0.5, pad: 1.25 }) : null;
}

// ---- rod and boat upgrades
const UPG = {
  reel: () => { const g = grp(cyl(0.3, 0.3, 0.16, '#b8bec2', 0, 0, 0, { shininess: 90 }), cyl(0.18, 0.18, 0.2, '#5a6470'), box(0.06, 0.45, 0.06, '#3a3a40', 0.28, -0.1, 0), ball(0.07, '#c89a5a', 0.28, -0.32, 0)); g.children.forEach((m) => { if (m.geometry.type === 'CylinderGeometry') m.rotation.x = Math.PI / 2; });
    for (let i = 0; i < 8; i++) { const t = box(0.08, 0.08, 0.04, '#d8a840', Math.cos(i / 8 * Math.PI * 2) * 0.34, Math.sin(i / 8 * Math.PI * 2) * 0.34, 0.06); t.rotation.z = i / 8 * Math.PI * 2; g.add(t); }
    return g; },
  line: () => { const g = grp(cyl(0.3, 0.3, 0.06, '#6a4a2a', 0, 0.22, 0), cyl(0.3, 0.3, 0.06, '#6a4a2a', 0, -0.22, 0), cyl(0.24, 0.24, 0.4, '#3ac0a0'), cyl(0.08, 0.08, 0.5, '#4a3a2a')); g.add(tube([[0.24, 0.1, 0], [0.5, 0.2, 0.1], [0.8, 0.05, 0.1]], 0.012, '#3ac0a0')); g.rotation.z = 0.3; return g; },
  hull: () => { const b = buildBoat('boat_oak'); const g = grp(b); for (let i = 0; i < 5; i++) g.add(ball(0.06, '#fff4b0', -0.8 + i * 0.4, 0.5 + (i % 2) * 0.2, 0.4, { emissive: '#d8c060' })); return g; },
  holders: () => { const g = grp(cyl(0.04, 0.05, 0.9, '#6a4a2a', 0, 0.2, 0), box(0.04, 0.25, 0.04, '#6a4a2a', 0.07, 0.72, 0), box(0.04, 0.25, 0.04, '#6a4a2a', -0.07, 0.72, 0)); g.children[1].rotation.z = -0.4; g.children[2].rotation.z = 0.4; const r = buildRod('rod_willow'); r.rotation.z = -0.9; r.position.set(-0.1, 0.65, 0); r.scale.setScalar(0.6); g.add(r); return g; },
  hold: () => { const g = grp(cyl(0.38, 0.3, 0.5, '#c8a060'), cyl(0.39, 0.39, 0.06, '#8a6a3a', 0, 0.25, 0), cyl(0.31, 0.31, 0.06, '#8a6a3a', 0, -0.25, 0)); for (let i = 0; i < 10; i++) { const s = box(0.03, 0.5, 0.04, '#a88048', Math.cos(i / 10 * Math.PI * 2) * 0.36, 0, Math.sin(i / 10 * Math.PI * 2) * 0.36); g.add(s); } const strap = tube([[-0.3, 0.25, 0], [0, 0.65, 0], [0.3, 0.25, 0]], 0.03, '#6a4024'); g.add(strap); g.add(ball(0.08, '#f2c040', 0.4, 0.15, 0.2, { emissive: '#664400' })); return g; },
};
export function upgradeThumb(id) { return UPG[id] ? objectThumb(`upg:${id}`, UPG[id], { rx: 0.35, ry: -0.6, pad: 1.2 }) : null; }

// ---- away gear
const GEARM = {
  pot: () => shell('crabpot'),
  cage: () => shell('cage'),
  setline: () => grp(ball(0.22, '#f2f0e8', 0, 0.5, 0, {}, 1, 1.3, 1), ball(0.225, '#d84030', 0, 0.62, 0, {}, 1, 0.5, 1), cyl(0.02, 0.02, 0.4, '#6a4a2a', 0, 0.95, 0), tube([[0, 0.2, 0], [0.1, -0.3, 0], [0.05, -0.8, 0.1]], 0.008, '#e8e8e8'), tube([[0.05, -0.8, 0.1], [0.12, -0.92, 0.1], [0.04, -0.98, 0.1]], 0.012, '#b8bec2')),
  shovel: () => buildShovel(),
};
export function gearThumb(id) { return GEARM[id] ? objectThumb(`gear:${id}`, GEARM[id], { rx: 0.4, ry: -0.6, pad: 1.15 }) : null; }

// ---- cabin decor (the same pieces the cottage builds)
const DECORM = {
  rug: () => buildDecor('rug'),
  armchair: () => buildDecor('armchair'),
  lamp: () => buildDecor('lamp'),
  plant: () => buildDecor('plant'),
  shelf: () => buildDecor('shelf'),
  stove: () => { const g = buildDecor('stove'); g.rotation.y = Math.PI; return grp(g); }, // fire door toward the camera
  painting: () => buildDecor('painting'),
  mount: () => { const g = buildDecor('mount'); const fish = fishMesh('largemouth'); if (fish) { fish.position.z = 0.2; g.add(fish); } return g; },
  tank2: () => { const g = buildDecor('tank2'); g.add(box(3.6, 1.5, 1.0, '#9ad8f0', 0, 1.65, 0, { transparent: true, opacity: 0.35 })); return g; },
  banner: () => buildDecor('banner'),
  catbed: () => buildDecor('catbed'),
};
function fishMesh(id) { try { const m = buildFish(id, 'normal'); m.scale.setScalar(m.scale.x * 1.4); return m; } catch { return null; } }
export function decorThumb(id) { return DECORM[id] ? objectThumb(`decor:${id}`, DECORM[id], { rx: 0.35, ry: -0.6, pad: 1.15 }) : null; }

// ---- pets
export function petThumb(id) { return objectThumb(`pet:${id}`, () => buildPet(id), { rx: 0.15, ry: -0.7, pad: 1.15 }); }

// ---- clothes (your angler wearing it) and emotes
const WEAR = [['hat', HATS], ['shirt', SHIRTS], ['accessory', ACCESSORIES]];
export function wearThumb(item, avatar) {
  for (const [key, list] of WEAR) {
    const o = list.find((x) => x.item === item.id);
    if (o) return optionThumb({ ...(avatar || defaultAvatar('nonbinary')), [key]: o.id }, key === 'hat' ? 'head' : 'torso');
  }
  return null;
}

const EMOTE_POSE = { emote_clap: 'clap', emote_dance: 'dance' };
export function emoteThumb(item, avatar) {
  const pose = EMOTE_POSE[item.id];
  if (!pose) return null;
  return objectThumb(`emote:${item.id}:${JSON.stringify(avatar || {})}`, () => {
    const av = buildAvatar(avatar || defaultAvatar('nonbinary'));
    try { animateAvatar(av, pose, 0.35, {}); } catch { /* pose missing: stand */ }
    return av.group;
  }, { rx: 0.05, ry: -0.35, pad: 1.1 });
}
