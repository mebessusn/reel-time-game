// Rod, bobber, fishing line, and rowboat models.
import * as THREE from 'three';
import { VoxelGrid, voxelMesh, shadeHex } from '../render/voxel.js';
import { ITEMS_BY_ID } from '../data/items.js';
import { buildSoftBoat, buildSoftOar } from './softboat.js';
import { gearModel } from './gearModels.js';

const ROD_TIP = 1.625;

export function buildRod(itemId, lite = false) {
  const item = ITEMS_BY_ID[itemId] || ITEMS_BY_ID.rod_willow;
  const model = gearModel(item.id, lite);
  if (model) {
    const tip = new THREE.Object3D();
    tip.position.set(0, ROD_TIP, 0);
    model.add(tip);
    model.userData.tip = tip;
    return model;
  }
  const [a, b] = item.colors;
  const g = new VoxelGrid();
  const len = 28;
  for (let y = 0; y < len; y++) g.set(0, y, 0, y < 6 ? b : (y % 7 === 0 ? shadeHex(a, -0.2) : a));
  g.box(1, 4, 0, 2, 5, 0, '#5a5a5a'); // reel
  g.set(2, 5, 0, '#c0c0c0');
  const mesh = voxelMesh(g, { scale: 1 / 16, center: [0.5, 2, 0.5], noise: 0.05, receiveShadow: false, material: item.glow ? new THREE.MeshLambertMaterial({ vertexColors: true, emissive: a, emissiveIntensity: 0.4 }) : undefined });
  const tip = new THREE.Object3D();
  tip.position.set(0, (len - 2) / 16, 0);
  mesh.add(tip);
  mesh.userData.tip = tip;
  return mesh;
}

export function buildBobber(itemId) {
  const item = ITEMS_BY_ID[itemId] || ITEMS_BY_ID.lure_classic;
  const model = gearModel(item.id);
  if (model) { model.traverse((o) => { if (o.isMesh) o.castShadow = false; }); return model; }
  const [a, b] = item.colors;
  const g = new VoxelGrid();
  switch (itemId) {
    case 'lure_duck':
      g.box(0, 0, 0, 3, 1, 2, a); g.box(2, 2, 0, 3, 3, 2, a); g.set(4, 2, 1, b); g.set(3, 3, 0, '#1a1a1a'); g.set(3, 3, 2, '#1a1a1a'); break;
    case 'lure_frog':
      g.box(0, 0, 0, 3, 1, 3, a); g.set(0, 2, 0, a); g.set(0, 2, 3, a); g.set(0, 3, 0, '#1a1a1a'); g.set(0, 3, 3, '#1a1a1a'); g.box(3, 0, 0, 3, 0, 3, b); break;
    case 'lure_spinner':
      g.box(1, 0, 1, 2, 3, 2, b); g.box(0, 2, 1, 3, 2, 2, a); g.set(1, 4, 1, a); break;
    case 'lure_crystal':
      g.box(1, 0, 1, 2, 4, 2, a); g.set(0, 2, 1, b); g.set(3, 2, 2, b); g.set(1, 5, 1, b); break;
    case 'lure_lantern':
      g.box(1, 0, 1, 2, 3, 2, a); g.box(0, 1, 0, 3, 2, 3, b); g.set(1, 4, 1, '#3a3a3a'); break;
    default:
      g.box(0, 0, 0, 3, 1, 3, b); g.box(0, 2, 0, 3, 3, 3, a); g.set(1, 4, 1, a); g.set(2, 4, 2, '#3a3a3a');
  }
  const mat = item.glow ? new THREE.MeshLambertMaterial({ vertexColors: true, emissive: a, emissiveIntensity: 0.6 }) : undefined;
  const m = voxelMesh(g, { scale: 1 / 14, center: [2, 1.5, 2], noise: 0.02, material: mat, castShadow: false });
  return m;
}

export class FishingLine {
  constructor() {
    this.points = 16;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.points * 3), 3));
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#f0f0e8', transparent: true, opacity: 0.8 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
  }
  // Line colour tells the fight: pale = slack, gold = sweet spot, orange/red = about to snap.
  setTension(t) {
    const m = this.line.material;
    if (t < 0) { m.color.set('#f0f0e8'); m.opacity = 0.8; return; }
    m.color.set(t < 0.2 ? '#d8e8f0' : t < 0.62 ? '#ffe070' : t < 0.82 ? '#ffb040' : '#ff4a3a');
    m.opacity = 1;
  }
  update(from, to, sag = 0.6, tension = 0) {
    const arr = this.line.geometry.attributes.position.array;
    const s = sag * (1 - tension);
    for (let i = 0; i < this.points; i++) {
      const t = i / (this.points - 1);
      const x = from.x + (to.x - from.x) * t;
      const z = from.z + (to.z - from.z) * t;
      const y = from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * s;
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
    }
    this.line.geometry.attributes.position.needsUpdate = true;
  }
}

// Rowboat: soft-block hull (src/entities/softboat.js), bow toward +Z, with two animated soft oars.
export function buildBoat(itemId) {
  const b = buildSoftBoat(itemId);
  const group = new THREE.Group();
  group.add(b.mesh);
  const oarL = buildSoftOar(b.oarColor, b.oarShaft);
  const oarR = oarL.clone();
  const pivotL = new THREE.Group(), pivotR = new THREE.Group();
  pivotL.position.set(-0.76, 0.66, 0.2); pivotR.position.set(0.76, 0.66, 0.2);
  oarL.rotation.y = Math.PI; pivotL.add(oarL); pivotR.add(oarR);
  group.add(pivotL, pivotR);
  group.userData.oars = [pivotL, pivotR];
  group.userData.seatY = b.seatY;
  return group;
}

export function animateOars(boat, t, rowing) {
  const [l, r] = boat.userData.oars;
  const a = rowing ? Math.sin(t * 3) * 0.6 : 0.2;
  const dip = rowing ? Math.cos(t * 3) * 0.25 : 0.25;
  l.rotation.set(0, a, dip); r.rotation.set(0, -a, -dip);
}
