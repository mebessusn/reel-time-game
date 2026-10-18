// v1.13: each lake's landmark, its answer to Cozy Cove's Sunken Ruins. Small, half sunk, and the highest-level
// water in its lake (src/game/spots.js). Frostpine's is the Frozen Leviathan itself (frostbones.js).
//   Fern Pond:   the Drowned Mill, a watermill that slid into the pond, wheel and all
//   Lilymarsh:   the Bog King's Crown, a giant mossy stone crown sunk among the lilies
//   Old Quarry:  the Drowned Digger, the quarry's steam shovel, its bucket hanging over the water
//   Echo Cavern: the Sunken Bell, a great bronze bell lying on its side in the cavern pool
// Built from simple flat-shaded shapes, like the rest of the valley's props. Solid to boats.
import * as THREE from 'three';
import { WATER_Y } from './terrain.js';
import { addCircle } from './colliders.js';
import { SPOT_BY_ID } from '../game/spots.js';

const M = (color, o = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...o });
function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// a tiny deterministic jitter so stones don't line up like bricks
const jit = (i, k = 1) => (Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;

/** Solid to boats: circles along a segment in the landmark's local frame. */
function solidLine(g, ax, az, bx, bz, r) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (r * 1.2)));
  const c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y);
  for (let i = 0; i <= n; i++) {
    const lx = ax + (bx - ax) * (i / n), lz = az + (bz - az) * (i / n);
    addCircle(g.position.x + lx * c + lz * s, g.position.z - lx * s + lz * c, r, { water: true });
  }
}

// ---------------------------------------------------------------- Fern Pond: the Drowned Mill
function drownedMill() {
  const g = new THREE.Group(); g.name = 'drowned-mill';
  const stone = M('#8d877a'), stoneD = M('#6e695f'), moss = M('#5f7d3c'), wood = M('#7a5a3a'), woodD = M('#553d26'), mill = M('#a39c8c');
  // two broken stone walls meeting in a corner, stepped where they crumbled
  const wall = (len, heights, x0, z0, along) => {
    heights.forEach((ht, i) => {
      const t = (i + 0.5) * (len / heights.length) - len / 2;
      const w = len / heights.length + 0.02;
      const b = mesh(box(along ? w : 0.6, ht + 2.4, along ? 0.6 : w), i % 2 ? stoneD : stone, x0 + (along ? t : 0), WATER_Y - 2.4 + (ht + 2.4) / 2, z0 + (along ? 0 : t), 0, 0, (jit(i, len) - 0.5) * 0.06);
      g.add(b);
      if (ht > 0.3 && jit(i, 7) > 0.2) g.add(mesh(box((along ? w : 0.64) * 0.8, 0.12, (along ? 0.64 : w) * 0.8), moss, b.position.x, WATER_Y + ht + 0.04, b.position.z));
    });
  };
  wall(4.2, [1.7, 1.45, 1.1, 0.6, 0.25], -0.6, -1.8, true);
  wall(3.4, [1.7, 1.2, 0.8, 0.35], -2.7, -0.3, false);
  // the waterwheel, tipped against the wall, its lower half under water
  const wheel = new THREE.Group();
  const R = 1.9, N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    for (const side of [-0.32, 0.32]) wheel.add(mesh(box(0.2, (2 * Math.PI * R) / N + 0.06, 0.12), wood, Math.cos(a) * R, Math.sin(a) * R, side, 0, 0, a));
    wheel.add(mesh(box(0.55, 0.06, 0.78), woodD, Math.cos(a) * (R + 0.18), Math.sin(a) * (R + 0.18), 0, 0, 0, a + Math.PI / 2)); // paddles
  }
  for (let i = 0; i < 6; i++) wheel.add(mesh(box(0.12, R * 2, 0.1), woodD, 0, 0, i % 2 ? 0.3 : -0.3, 0, 0, (i / 6) * Math.PI));
  wheel.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.3, 8), woodD, 0, 0, 0, Math.PI / 2, 0, 0));
  wheel.position.set(1.4, WATER_Y + 0.35, -0.7); wheel.rotation.set(0.05, -0.35, 0.18);
  g.add(wheel);
  // the millstone, slid half out of the wall's corner
  g.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.38, 14), mill, -1.6, WATER_Y + 0.12, -0.9, 0.35, 0, 0.25));
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 8), stoneD, -1.6, WATER_Y + 0.14, -0.9, 0.35, 0, 0.25));
  // a couple of loose beams floating by
  g.add(mesh(box(2.4, 0.18, 0.22), woodD, 0.9, WATER_Y + 0.03, 1.6, 0, 0.7, 0.04));
  g.add(mesh(box(1.6, 0.16, 0.2), wood, -0.4, WATER_Y + 0.02, 1.9, 0, -0.3, -0.03));
  g.userData.solid = [[-2.7, -1.8, 1.5, -1.8, 0.55], [-2.7, -2, -2.7, 1.4, 0.55], [0.6, -0.4, 2.2, -1.0, 0.8], [-1.6, -0.9, -1.6, -0.9, 1]];
  return g;
}

// ---------------------------------------------------------------- Lilymarsh: the Bog King's Crown
function bogCrown() {
  const g = new THREE.Group(); g.name = 'bog-crown';
  const stone = M('#a39a80'), stoneD = M('#857c66'), moss = M('#5f8a3a'), mossD = M('#3f5a2a'), gem = M('#c8a040', { emissive: '#2a1a00' }), gem2 = M('#3aa8a0', { emissive: '#06201e' }), lily = M('#4f8a3a'), flower = M('#f2d8e0');
  const crown = new THREE.Group();
  const R = 2.3, N = 12;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    crown.add(mesh(box((2 * Math.PI * R) / N + 0.1, 1.3, 0.5), i % 2 ? stoneD : stone, x, 0, z, 0, -a + Math.PI / 2, 0));
    // the rim
    crown.add(mesh(box((2 * Math.PI * R) / N + 0.14, 0.2, 0.62), jit(i, 21) > 0.45 ? moss : stoneD, x, 0.72, z, 0, -a + Math.PI / 2, 0));
    // points: tall and short, each tipped with a round finial
    if (i % 2 === 0) {
      const tall = i % 4 === 0;
      const p = mesh(new THREE.ConeGeometry(0.42, tall ? 1.5 : 0.95, 4), stone, x, 0.8 + (tall ? 0.75 : 0.47), z, 0, -a + Math.PI / 4, 0);
      crown.add(p);
      crown.add(mesh(new THREE.IcosahedronGeometry(0.2, 0), stoneD, x, 0.8 + (tall ? 1.55 : 1.0), z));
    }
    // gems set in the band, facing out
    if (i % 3 === 1) crown.add(mesh(new THREE.OctahedronGeometry(0.3, 0), i % 2 ? gem : gem2, Math.cos(a) * (R + 0.27), 0.1, Math.sin(a) * (R + 0.27), 0, -a, 0));
    // moss drapes over the rim
    if (jit(i, 3) > 0.1) crown.add(mesh(box(0.8, 0.7 + jit(i, 5) * 0.5, 0.14), jit(i, 9) > 0.5 ? moss : mossD, Math.cos(a) * (R + 0.3), 0.45, Math.sin(a) * (R + 0.3), 0, -a + Math.PI / 2, 0));
  }
  crown.position.set(0, WATER_Y + 0.05, 0); crown.rotation.set(0.32, 0.4, -0.12); crown.scale.setScalar(1.2);
  g.add(crown);
  // lily pads and a few flowers round it
  for (let i = 0; i < 14; i++) {
    const a = jit(i, 11) * Math.PI * 2, r = 3.2 + jit(i, 13) * 2.6;
    const pad = mesh(new THREE.CylinderGeometry(0.34 + jit(i, 2) * 0.2, 0.34 + jit(i, 2) * 0.2, 0.03, 9, 1, false, 0.3, Math.PI * 1.8), lily, Math.cos(a) * r, WATER_Y + 0.02, Math.sin(a) * r, 0, a, 0);
    pad.castShadow = false; g.add(pad);
    if (i % 4 === 0) g.add(mesh(new THREE.IcosahedronGeometry(0.11, 0), flower, Math.cos(a) * r, WATER_Y + 0.1, Math.sin(a) * r));
  }
  g.userData.solid = [[0, 0, 0, 0, 3.2]];
  return g;
}

// ---------------------------------------------------------------- Old Quarry: the Drowned Digger
function drownedDigger() {
  const g = new THREE.Group(); g.name = 'drowned-digger';
  const rust = M('#9a5230'), rustD = M('#6a3820'), iron = M('#3a302a'), paint = M('#d0a832'), glass = M('#2a3a40');
  // the cab, sunk to its roof and leaning
  const cab = new THREE.Group();
  cab.add(mesh(box(2.4, 2.2, 1.9), rust, 0, -0.6, 0));
  cab.add(mesh(box(2.6, 0.16, 2.1), rustD, 0, 0.55, 0)); // roof
  cab.add(mesh(box(2.42, 0.4, 1.92), paint, 0, -0.1, 0)); // the old yellow stripe
  cab.add(mesh(box(0.05, 0.42, 0.7), glass, 1.22, 0.15, 0.3));
  cab.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.4, 8), iron, -0.7, 1.2, -0.5, 0, 0, 0.12)); // smokestack
  cab.add(mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.18, 8), iron, -0.62, 1.9, -0.5, 0, 0, 0.12));
  cab.position.set(-1.3, WATER_Y + 0.55, 0); cab.rotation.set(0.06, 0.2, -0.14);
  g.add(cab);
  // the lattice boom, rising out of the water at a slant
  const boom = new THREE.Group();
  const L = 6.2;
  for (const s of [-0.28, 0.28]) boom.add(mesh(box(L, 0.14, 0.14), rust, L / 2, 0, s));
  for (const s of [-0.28, 0.28]) boom.add(mesh(box(L, 0.12, 0.12), rustD, L / 2, 0.42, s));
  for (let i = 0; i <= 8; i++) {
    const x = (i / 8) * L;
    boom.add(mesh(box(0.08, 0.42, 0.08), rustD, x, 0.21, -0.28)); boom.add(mesh(box(0.08, 0.42, 0.08), rustD, x, 0.21, 0.28));
    boom.add(mesh(box(0.08, 0.08, 0.6), rustD, x, 0.42, 0));
    if (i < 8) boom.add(mesh(box(0.06, 0.55, 0.06), iron, x + L / 16, 0.21, 0.28, 0, 0, -0.85));
  }
  boom.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 10), iron, L, 0.2, 0, Math.PI / 2, 0, 0)); // the sheave
  boom.position.set(0, WATER_Y - 0.3, 0); boom.rotation.set(0, 0.2, 0.62);
  g.add(boom);
  // the dipper bucket on its chain, hanging just over the water
  boom.updateMatrixWorld(true);
  const tip = new THREE.Vector3(L, 0.2, 0).applyMatrix4(boom.matrix);
  const by = WATER_Y + 0.55;
  const chainLen = tip.y - by - 0.4;
  for (let i = 0; i < Math.max(2, Math.round(chainLen / 0.22)); i++) g.add(mesh(new THREE.TorusGeometry(0.07, 0.025, 4, 6), iron, tip.x, tip.y - 0.1 - i * 0.22, tip.z, 0, i % 2 ? Math.PI / 2 : 0, 0));
  const bucket = new THREE.Group();
  bucket.add(mesh(box(1.2, 0.9, 1.0), rust, 0, 0, 0));
  bucket.add(mesh(box(1.26, 0.14, 1.06), rustD, 0, 0.45, 0));
  for (let i = 0; i < 4; i++) bucket.add(mesh(new THREE.ConeGeometry(0.1, 0.32, 4), iron, -0.45 + i * 0.3, -0.58, 0.42, Math.PI, 0, 0));
  bucket.position.set(tip.x, by, tip.z); bucket.rotation.set(0.1, 0.4, 0.08);
  g.add(bucket);
  g.userData.solid = [[-2.4, 0, 0, 0, 1.4], [0, 0, 3, -0.6, 0.6], [tip.x - 0.01, tip.z, tip.x, tip.z, 0.9]];
  return g;
}

// ---------------------------------------------------------------- Echo Cavern: the Sunken Bell
function sunkenBell() {
  const g = new THREE.Group(); g.name = 'sunken-bell';
  const bronze = M('#9a7038', { emissive: '#2a1806' }), patina = M('#4aa090', { emissive: '#0a2622' }), wood = M('#5a4430', { emissive: '#120c06' }), iron = M('#3a3632', { emissive: '#0a0908' });
  // the bell: a lathe profile, lying tipped on its side with its mouth turned up out of the water
  const prof = [[0.01, 2.3], [0.5, 2.28], [0.78, 2.15], [0.92, 1.9], [0.98, 1.5], [1.08, 1.0], [1.3, 0.5], [1.6, 0.14], [1.72, 0.02], [1.62, 0.0]].map(([r, y]) => new THREE.Vector2(r, y));
  const bellGeo = new THREE.LatheGeometry(prof, 18);
  const bell = new THREE.Group();
  const shell = mesh(bellGeo, bronze); shell.material.side = THREE.DoubleSide;
  bell.add(shell);
  bell.add(mesh(new THREE.TorusGeometry(1.66, 0.09, 5, 18), patina, 0, 0.06, 0, Math.PI / 2, 0, 0)); // the green lip
  bell.add(mesh(new THREE.TorusGeometry(1.0, 0.06, 5, 16), patina, 0, 1.05, 0, Math.PI / 2, 0, 0));
  bell.add(mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.32, 8), bronze, 0, 2.42, 0)); // the crown
  // the clapper, slipped half out of the mouth
  bell.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), iron, 0.25, 0.9, 0, 0, 0, 0.35));
  bell.add(mesh(new THREE.IcosahedronGeometry(0.26, 0), iron, 0.55, 0.2, 0));
  bell.position.set(0, WATER_Y - 0.1, 0); bell.rotation.set(0, 0.5, 1.2); bell.scale.setScalar(1.45);
  g.add(bell);
  // what's left of the timber yoke it hung from
  g.add(mesh(box(0.32, 3.2, 0.32), wood, -2.3, WATER_Y + 0.2, -1.0, 0.1, 0, 0.45));
  g.add(mesh(box(0.32, 2.4, 0.32), wood, 1.8, WATER_Y - 0.1, -1.6, -0.15, 0, -0.3));
  g.add(mesh(box(3.4, 0.3, 0.3), wood, 0.2, WATER_Y + 0.05, 1.7, 0, 0.5, 0.05));
  // a few cave crystals growing on the bell's shoulder, glowing
  const glow = new THREE.MeshBasicMaterial({ color: '#8af0ff' });
  [[-3.1, 0.3, -1.4, 0.45], [-2.8, 0.2, -0.6, 0.3], [2.9, 0.25, 1.2, 0.4], [3.2, 0.2, 0.4, 0.26]].forEach(([x, y, z, s]) => { const c = mesh(new THREE.OctahedronGeometry(s, 0), glow, x, WATER_Y + y, z, 0.3, 0.2, 0.2); c.scale.y = 1.8; c.castShadow = false; g.add(c); });
  g.userData.solid = [[-1.6, 0, 1.6, 0, 2], [-2.3, -1, -2.3, -1, 0.5]];
  return g;
}

const BUILDERS = { pond_poi: [drownedMill, 0.4], marsh_poi: [bogCrown, 0], quarry_poi: [drownedDigger, -0.9], cave_poi: [sunkenBell, 0.2] };

export function buildLakePOIs(scene) {
  const out = {};
  for (const [id, [build, ry]] of Object.entries(BUILDERS)) {
    const s = SPOT_BY_ID[id]; if (!s) continue;
    const g = build();
    g.position.set(s.x, 0, s.z); g.rotation.y = ry;
    scene.add(g);
    for (const [ax, az, bx, bz, r] of g.userData.solid || []) solidLine(g, ax, az, bx, bz, r);
    out[id] = g;
  }
  return out;
}
