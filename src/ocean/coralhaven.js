// v1.15.20 Coralhaven: a town under the sea. On the Coralhaven bank, 17 m down, a cluster of coral-stone domes joined
// by tunnels, windows glowing. Swim to the airlock and you go inside (like going home: you're somewhere else), into a
// whole town with air in it: the Grand Hall with its fountain, Shelly's Trading Post, Old Finn's Fish Market, the Kelp &
// Kettle cafe, the Glass Gallery and its great window full of fish, Marina's Dive Locker and the Tidewater Inn.
// Nobody stands about on the sea floor any more: the townsfolk live inside.
// The town's layout (and where you can walk) is in coralhavenMap.js; DeepBlue builds and runs this with the rest.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WATER_Y } from '../world/terrain.js';
import { addCircle, addBox } from '../world/colliders.js';
import { Actor } from '../game/actor.js';
import { defaultAvatar } from '../data/avatarOptions.js';
import { buildFish } from '../entities/fish.js';
import { BANK_BY_ID, oceanSurfaceY } from './geo.js';
import { REEF_MATS, REEF_NODES } from '../data/reefMesh.js';
import { CORALHAVEN_MATS, CORALHAVEN_NODES } from '../data/coralhavenMesh.js';
import { buildNode } from './meshes.js';
import { applyCaustics } from '../world/caustics.js';
import { mulberry32 } from '../core/rng.js';
import { TOWN, ROOMS, ROOM_BY_ID, CORRIDORS, CORRIDOR_W, AIRLOCK_IN, inTown, townRoom, W } from './coralhavenMap.js';

const look = (o) => ({ ...defaultAvatar(o.gender || 'female'), ...o });
const M = new Map();
const GLOW = 0.4; // v1.15.23: the town has real lights now, so self-glow is turned well down (shading reads)
/** Lit materials get a little glow of their own so the town reads at night (the town adds no lights: new lights
 *  would make every material in the game recompile). */
const mat = (color, o = {}) => {
  const k = `${color}|${o.emissive || ''}|${o.side || ''}|${o.opacity ?? ''}|${o.glow ?? ''}`;
  if (!M.has(k)) {
    const m = new THREE.MeshLambertMaterial({ color, flatShading: true, side: o.side || THREE.FrontSide, emissive: o.emissive || new THREE.Color(color).multiplyScalar((o.glow ?? 0.3) * GLOW), ...(o.opacity != null ? { transparent: true, opacity: o.opacity, depthWrite: false } : {}) });
    M.set(k, m);
  }
  return M.get(k);
};
const mesh = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
/** One of the Blender-built pieces (art/src/coralhaven.py). Its materials get a little glow of their own, like the
 *  rest of the town (the town adds no lights). */
const prop = (name, x = 0, y = 0, z = 0, ry = 0, s = 1) => {
  const n = buildNode(CORALHAVEN_MATS, CORALHAVEN_NODES, name, { shadow: false });
  n.traverse((o) => { if (o.isMesh && !o.material.userData.glowed) { o.material.userData.glowed = true; if (o.material.emissive && o.material.emissive.r + o.material.emissive.g + o.material.emissive.b < 0.05) o.material.emissive.copy(o.material.color).multiplyScalar(0.32 * GLOW); } });
  n.position.set(x, y, z); n.rotation.y = ry; if (s !== 1) n.scale.setScalar(s); return n;
};
const CHAIR_SEAT = 0.95; // (keepers' chairs: seat height)
/** Shrink a fish to at most `len` nose to tail (as the cabin's aquarium does). */
function fitFish(m, len) {
  const bb = new THREE.Box3().setFromObject(m), cur = bb.max.x - bb.min.x;
  if (cur > len) m.scale.multiplyScalar(len / cur);
  return m;
}
const jit = (i, k = 1) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };

function bake(group, keep = () => false) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), buckets = new Map(), out = new THREE.Group();
  out.position.copy(group.position); out.rotation.copy(group.rotation); out.name = group.name;
  const kept = new Set();
  const underKept = (o) => { for (let q = o.parent; q; q = q.parent) if (kept.has(q)) return true; return false; };
  group.traverse((o) => {
    if (!o.isMesh || underKept(o)) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    if (keep(o)) { kept.add(o); const c = o.clone(); rel.decompose(c.position, c.quaternion, c.scale); out.add(c); return; }
    const g = o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(k === 'uv' && o.material.map)) g.deleteAttribute(k);
    if (!o.material.map && g.attributes.uv) g.deleteAttribute('uv');
    if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); }
    g.applyMatrix4(rel);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
  });
  for (const [m, geos] of buckets) { const merged = mergeGeometries(geos, false); if (!merged) continue; merged.computeBoundingSphere(); const me = new THREE.Mesh(merged, m); me.receiveShadow = true; out.add(me); }
  return out;
}

/** The sea seen through a window: a deep blue gradient, light from above, a few far fish shapes. Scrolls slowly. */
function seaTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#5fd0dc'); gr.addColorStop(0.45, '#1f86a6'); gr.addColorStop(1, '#0a3552');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  x.globalAlpha = 0.06; x.fillStyle = '#e8ffff';
  for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(i * 48, 0); x.lineTo(i * 48 + 22, 0); x.lineTo(i * 48 + 60, 256); x.lineTo(i * 48 + 30, 256); x.fill(); }
  x.globalAlpha = 0.35; x.fillStyle = '#08304a';
  for (let i = 0; i < 9; i++) { const fx = jit(i, 2) * 256, fy = 60 + jit(i, 3) * 160, s = 5 + jit(i, 4) * 9; x.beginPath(); x.ellipse(fx, fy, s, s * 0.45, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(fx - s, fy); x.lineTo(fx - s * 1.7, fy - s * 0.5); x.lineTo(fx - s * 1.7, fy + s * 0.5); x.fill(); }
  x.globalAlpha = 0.5; x.fillStyle = '#ffffff';
  for (let i = 0; i < 30; i++) { x.beginPath(); x.arc(jit(i, 7) * 256, jit(i, 8) * 256, 0.8 + jit(i, 9) * 1.6, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function signTexture(text, bg = '#3a5a5a', fg = '#fff3cc') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 512, 96); x.strokeStyle = '#d8b878'; x.lineWidth = 6; x.strokeRect(5, 5, 502, 86);
  x.fillStyle = fg; x.font = 'bold 40px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// the exterior's rooms are the interior's, drawn at 3/4 scale on the bank
const EXT_K = 0.75;

export class Coralhaven {
  constructor(game, ow, deep) {
    this.game = game; this.ow = ow; this.deep = deep;
    this.people = []; this.walkers = [];
    this.inside = false;
  }

  // ================================================================ outside, on the sea floor
  buildExterior() {
    const B = BANK_BY_ID.coralhaven, g = new THREE.Group(); g.name = 'coralhaven';
    g.position.set(B.x, 0, B.z);
    const base = oceanSurfaceY(B.x, B.z);
    this.base = base;
    const shell = mat('#c9b9a0', { glow: 0.12 }), band = ['#e8907a', '#f0c08a', '#c8a0d8', '#8ad0c8', '#f2a6b8', '#e8b060', '#a8c8e8'].map((c) => mat(c, { glow: 0.15 }));
    const lit = mat('#ffd890', { emissive: '#e8a040' }), glass = mat('#9ff0ff', { emissive: '#3ab0c0' }), dark = mat('#5a5048', { glow: 0.05 }), ring = mat('#8adfff', { emissive: '#4ac8f0' });
    this.extDomes = []; this.extTubes = [];
    // a stone apron the whole complex sits on
    g.add(mesh(new THREE.CylinderGeometry(44 * EXT_K, 46 * EXT_K, 1.2, 28), dark, 0, base - 0.4, 0));
    ROOMS.forEach((R, i) => {
      const x = R.x * EXT_K, z = R.z * EXT_K, r = R.r * EXT_K + (R.id === 'hall' ? 1.5 : 0.8), hk = R.id === 'hall' ? 0.85 : 0.75;
      const dome = mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), shell, x, base, z); dome.scale.y = hk; g.add(dome);
      g.add(mesh(new THREE.TorusGeometry(r * 1.01, 0.35, 6, 28), band[i % band.length], x, base + 0.6, z, Math.PI / 2, 0, 0));
      // portholes all round, lit from inside
      const nw = R.id === 'hall' ? 12 : 7;
      for (let k = 0; k < nw; k++) {
        const a = (k / nw) * Math.PI * 2 + i, el = 0.45, nx = Math.sin(a) * Math.cos(el), ny = Math.sin(el) * hk, nz = Math.cos(a) * Math.cos(el);
        const p = mesh(new THREE.CircleGeometry(R.id === 'hall' ? 0.9 : 0.55, 12), lit, x + nx * r * 1.005, base + ny * r * 1.005, z + nz * r * 1.005);
        p.lookAt(x + nx * r * 3, base + ny * r * 3, z + nz * r * 3); g.add(p);
      }
      // a glass cupola on top of the hall
      if (R.id === 'hall') { g.add(mesh(new THREE.SphereGeometry(3.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass, x, base + r * hk - 0.4, z)); g.add(mesh(new THREE.TorusGeometry(3.25, 0.25, 6, 18), band[0], x, base + r * hk - 0.35, z, Math.PI / 2, 0, 0)); }
      this.extDomes.push({ x: B.x + x, z: B.z + z, y: base, r: r + 0.5, hk });
    });
    // the tunnels between them
    for (const C of CORRIDORS) {
      const a = { x: C.a.x * EXT_K, z: C.a.z * EXT_K }, b = { x: C.b.x * EXT_K, z: C.b.z * EXT_K }, L = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
      const t = mesh(new THREE.CylinderGeometry(2, 2, L, 12, 1, false), shell, (a.x + b.x) / 2, base + 0.6, (a.z + b.z) / 2, Math.PI / 2, 0, 0);
      const holder = new THREE.Group(); holder.position.copy(t.position); holder.rotation.y = yaw; t.position.set(0, 0, 0); holder.add(t);
      for (let k = 1; k < L / 3; k++) holder.add(mesh(new THREE.TorusGeometry(2.05, 0.18, 5, 14), dark, 0, 0, -L / 2 + k * 3));
      for (let k = 1; k < L / 4; k++) for (const s of [-1, 1]) { const p = mesh(new THREE.CircleGeometry(0.4, 10), lit, s * 1.72, 0.9, -L / 2 + k * 4 + 1.5, 0, s * Math.PI / 2 - s * 0.5, 0); holder.add(p); }
      g.add(holder);
      this.extTubes.push({ a: { x: B.x + a.x, z: B.z + a.z }, b: { x: B.x + b.x, z: B.z + b.z }, y: base + 0.6, r: 2.5 });
    }
    // the airlock: a round hatch on the end of the west tunnel, with a glowing ring and a light above it
    const AL = ROOM_BY_ID.airlock, ax = AL.x * EXT_K - AL.r * EXT_K - 1.2, az = AL.z * EXT_K;
    g.add(mesh(new THREE.CylinderGeometry(2.1, 2.3, 3, 14), shell, ax + 0.8, base + 1.2, az, 0, 0, Math.PI / 2));
    g.add(mesh(new THREE.TorusGeometry(1.95, 0.12, 8, 28), ring, ax - 0.7, base + 1.5, az, 0, Math.PI / 2, 0));
    g.add(prop('ch_hatch', ax - 0.85, base - 0.1, az, -Math.PI / 2));
    g.add(mesh(new THREE.IcosahedronGeometry(0.35, 1), lit, ax - 0.4, base + 3.6, az));
    this.door = { x: B.x + ax - 1.6, y: base + 1.4, z: B.z + az }; // where you hang in the water at the hatch
    // lamps on kelp stalks along the way in, and the town's name on a stone
    for (let i = 0; i < 8; i++) { const x = ax - 4 - i * 3.2, z = (i % 2 ? 2.6 : -2.6) + az, y = oceanSurfaceY(B.x + x, B.z + z); g.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.6, 5), mat('#4a7a3a', { glow: 0.1 }), x, y + 1.3, z)); g.add(mesh(new THREE.IcosahedronGeometry(0.3, 1), ring, x, y + 2.7, z)); }
    // coral gardens all round
    const r = mulberry32(777), kinds = ['reef_brain', 'reef_branch', 'reef_table', 'reef_fan', 'reef_anemone', 'reef_kelp', 'reef_sponge'];
    for (let i = 0; i < 80; i++) {
      const a = r() * Math.PI * 2, d = 38 + r() * 16, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.abs(z - az) < 4 && x < ax) continue; // (keep the way to the door clear)
      const n = buildNode(REEF_MATS, REEF_NODES, kinds[Math.floor(r() * kinds.length)], { shadow: false });
      n.position.set(x, oceanSurfaceY(B.x + x, B.z + z) - 0.05, z); n.rotation.y = r() * 6.28; n.scale.setScalar(0.9 + r() * 1.2); g.add(n);
    }
    // Shelly's five lost pearls, out among the coral (they glow faintly so a careful diver spots them)
    const pr = mulberry32(4401);
    this.pearls = Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2 + pr() * 0.8, d = 37 + pr() * 14, x = Math.cos(a) * d, z = Math.sin(a) * d, y = oceanSurfaceY(B.x + x, B.z + z) + 0.35; const m = mesh(new THREE.SphereGeometry(0.18, 10, 8), mat('#f6f2ff', { emissive: '#8a86a0' }), x, y, z); m.name = `pearl${i}`; g.add(m); return { i, x: B.x + x, y, z: B.z + z, m }; });
    const out = bake(g, (o) => /^pearl/.test(o.name));
    out.traverse((o) => { if (o.isMesh && !o.material.userData.c) { o.material.userData.c = true; applyCaustics(o.material); } });
    for (const p of this.pearls) p.m = out.children.find((o) => o.name === p.m.name);
    this.fountainOut = { x: B.x, y: base + 13 * 0.85 + 1, z: B.z };
    return out;
  }
  /** Is (x, y, z) inside the domes or the tunnels? (The diver can't swim through them.) */
  solidAt(x, y, z) {
    for (const D of this.extDomes || []) { const dy = (y - D.y) / D.hk; if (y > D.y - 1 && Math.hypot(x - D.x, dy, z - D.z) < D.r) return true; }
    for (const T of this.extTubes || []) {
      if (Math.abs(y - T.y) > T.r) continue;
      const dx = T.b.x - T.a.x, dz = T.b.z - T.a.z, L2 = dx * dx + dz * dz, k = Math.max(0, Math.min(1, ((x - T.a.x) * dx + (z - T.a.z) * dz) / L2));
      if (Math.hypot(x - T.a.x - dx * k, z - T.a.z - dz * k) < T.r) return true;
    }
    return false;
  }

  // ================================================================ inside: the town
  buildInterior() {
    if (this.interior) return;
    const g = new THREE.Group(); g.name = 'coralhaven-town'; g.position.set(TOWN.x, TOWN.y, TOWN.z);
    const IN = THREE.BackSide;
    const wallD = mat('#e4d6bc', { side: THREE.DoubleSide, glow: 0.42 }), gold = mat('#e8b440', { glow: 0.3 }), goldD = mat('#b8862a', { glow: 0.25 });
    const wall = mat('#e4d6bc', { side: IN, glow: 0.42 }), wallF = mat('#e4d6bc', { glow: 0.42 }), wallLo = mat('#b89a78', { side: IN, glow: 0.35 }), ceil = mat('#cfe6e2', { side: IN, glow: 0.5 });
    const floorA = mat('#cbbfa6', { glow: 0.35 }), floorB = mat('#9ab8b0', { glow: 0.35 }), trim = mat('#8a7a62', { glow: 0.3 });
    const wood = mat('#8a6440', { glow: 0.3 }), woodD = mat('#5e4128', { glow: 0.3 }), cloth = ['#d8705a', '#5a9ab0', '#e0b050', '#8a6ab0', '#6aa070'].map((c) => mat(c, { glow: 0.3 }));
    const lamp = mat('#ffe2a0', { emissive: '#ffc060' }), coral = ['#e8907a', '#f0c08a', '#c8a0d8', '#f2a6b8'].map((c) => mat(c, { glow: 0.3 }));
    this.seaTex = seaTexture();
    const sea = new THREE.MeshBasicMaterial({ map: this.seaTex, fog: false, side: THREE.DoubleSide });
    const gap = (r) => Math.asin(Math.min(0.95, (CORRIDOR_W / 2 + 0.25) / r));
    const CORR_H = 5.2, SIDE_H = CORR_H - CORRIDOR_W / 2; // (side walls, then a barrel vault up to CORR_H)
    for (const R of ROOMS) {
      const rg = new THREE.Group(); rg.position.set(R.x, 0, R.z);
      // which ways the corridors leave this room
      const outs = R.id === 'hall' ? ROOMS.filter((o) => o.id !== 'hall').map((o) => Math.atan2(o.x, o.z)) : [Math.atan2(-R.x, -R.z)];
      const gh = gap(R.r);
      // floor: two-tone rings of tile
      rg.add(mesh(new THREE.CircleGeometry(R.r, 36), floorA, 0, 0.01, 0, -Math.PI / 2, 0, 0));
      if (R.id !== 'airlock') { // (the airlock's floor is plain: just its welcome mat)
        rg.add(mesh(new THREE.RingGeometry(R.r * 0.35, R.r * 0.5, 36), floorB, 0, 0.02, 0, -Math.PI / 2, 0, 0));
        rg.add(mesh(new THREE.RingGeometry(R.r * 0.82, R.r * 0.88, 36), floorB, 0, 0.02, 0, -Math.PI / 2, 0, 0));
      }
      // walls, with gaps for the corridors (and a lintel above each gap)
      const sorted = outs.map((a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
      for (let k = 0; k < sorted.length; k++) {
        const s0 = sorted[k] + gh, s1 = (k + 1 < sorted.length ? sorted[k + 1] : sorted[0] + Math.PI * 2) - gh, len = s1 - s0;
        if (len > 0.01) {
          rg.add(mesh(new THREE.CylinderGeometry(R.r, R.r, R.h, Math.max(4, Math.ceil(len * 10)), 1, true, s0, len), wall, 0, R.h / 2, 0));
          rg.add(mesh(new THREE.CylinderGeometry(R.r - 0.02, R.r - 0.02, 1.1, Math.max(4, Math.ceil(len * 10)), 1, true, s0, len), wallLo, 0, 0.55, 0));
        }
        rg.add(mesh(new THREE.CylinderGeometry(R.r, R.r, R.h - CORR_H, 6, 1, true, sorted[k] - gh, gh * 2), wall, 0, CORR_H + (R.h - CORR_H) / 2, 0));
      }
      // v1.15.23: each doorway is arched like its corridor: a wall panel with an arch-shaped opening fills the square cut,
      // with a soffit over it and a trim arch round it
      for (const a of outs) {
        const dp = R.r - 0.6, hw = Math.max(3.2, Math.sqrt(1.2 * R.r) + 0.3), top = CORR_H + 0.05, ow2 = CORRIDOR_W / 2 + 0.02;
        const sh = new THREE.Shape();
        sh.moveTo(-hw, 0); sh.lineTo(-ow2, 0); sh.lineTo(-ow2, SIDE_H); sh.absarc(0, SIDE_H, ow2, Math.PI, 0, true); sh.lineTo(ow2, 0); sh.lineTo(hw, 0); sh.lineTo(hw, top); sh.lineTo(-hw, top); sh.closePath();
        const dg = new THREE.Group(); dg.position.set(Math.sin(a) * dp, 0, Math.cos(a) * dp); dg.rotation.y = a;
        dg.add(new THREE.Mesh(new THREE.ShapeGeometry(sh, 16), wallD));
        dg.add(mesh(new THREE.PlaneGeometry(hw * 2, 0.8), wallD, 0, top, 0.38, Math.PI / 2, 0, 0));
        dg.add(mesh(new THREE.TorusGeometry(ow2 + 0.1, 0.13, 6, 24, Math.PI), trim, 0, SIDE_H, -0.08));
        for (const s2 of [-1, 1]) dg.add(mesh(new THREE.BoxGeometry(0.26, SIDE_H, 0.26), trim, s2 * (ow2 + 0.1), SIDE_H / 2, -0.08));
        rg.add(dg);
      }
      // the domed ceiling
      const dome = mesh(new THREE.SphereGeometry(R.r, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), ceil, 0, R.h, 0); dome.scale.y = (R.id === 'hall' ? 7 : 3.2) / R.r; rg.add(dome);
      rg.add(mesh(new THREE.TorusGeometry(R.r - 0.1, 0.18, 5, 36), trim, 0, R.h, 0, Math.PI / 2, 0, 0));
      // windows onto the sea between the doorways
      const nWin = R.id === 'hall' ? 2 : R.id === 'airlock' ? 0 : 1;
      for (let k = 0; k < sorted.length; k++) {
        const s0 = sorted[k] + gh, s1 = (k + 1 < sorted.length ? sorted[k + 1] : sorted[0] + Math.PI * 2) - gh;
        for (let n = 0; n < nWin; n++) {
          const a = s0 + (s1 - s0) * ((n + 1) / (nWin + 1));
          if (s1 - s0 < 0.6) continue;
          const ww = R.id === 'hall' ? 4.6 : 2.6, wh = R.id === 'hall' ? 4.6 : 2.4, wy = R.id === 'hall' ? 3.6 : 2.5;
          // v1.15.23: a flat window on a curved wall sits in by the curve's depth, so its edges don't go behind the wall;
          // the frame runs back to meet the wall all round
          const wr = Math.sqrt(R.r * R.r - (ww / 2 + 0.25) ** 2) - 0.04, fd = R.r - wr + 0.1;
          const win = mesh(new THREE.PlaneGeometry(ww, wh), sea, Math.sin(a) * wr, wy, Math.cos(a) * wr, 0, a + Math.PI, 0); rg.add(win);
          const fg = new THREE.Group(); fg.position.set(Math.sin(a) * (wr - 0.06), wy, Math.cos(a) * (wr - 0.06)); fg.rotation.y = a + Math.PI;
          for (const s2 of [-1, 1]) { fg.add(mesh(new THREE.BoxGeometry(ww + 0.3, 0.18, fd + 0.07), trim, 0, s2 * wh / 2, (0.07 - fd) / 2)); fg.add(mesh(new THREE.BoxGeometry(0.18, wh, fd + 0.07), trim, s2 * ww / 2, 0, (0.07 - fd) / 2)); }
          fg.add(mesh(new THREE.BoxGeometry(0.1, wh, 0.1), trim, 0, 0, 0)); fg.add(mesh(new THREE.BoxGeometry(ww, 0.1, 0.1), trim, 0, wh * 0.1, 0));
          rg.add(fg);
        }
      }
      // hanging lamps
      const nl = R.id === 'hall' ? 8 : 3;
      for (let k = 0; k < nl; k++) { const a = (k / nl) * Math.PI * 2 + 0.3, d = R.r * (R.id === 'hall' ? 0.7 : 0.5); rg.add(prop(k % 2 ? 'ch_jellylamp_pink' : 'ch_jellylamp', Math.sin(a) * d, R.h + (R.id === 'hall' ? 0.6 : -0.1), Math.cos(a) * d, a, R.id === 'hall' ? 1.4 : 1)); }
      this.furnish(R, rg, { wood, woodD, cloth, lamp, coral, trim, sea, floorB });
      g.add(rg);
      // the room's name over its doorway, on the Grand Hall's wall (up out of the camera's way)
      if (R.id !== 'hall') {
        const H = ROOM_BY_ID.hall, a = Math.atan2(R.x, R.z), d = H.r - 0.15;
        const sign = mesh(new THREE.PlaneGeometry(4.2, 0.8), new THREE.MeshBasicMaterial({ map: signTexture(R.name.replace(/^the /, 'The ')), fog: false }), Math.sin(a) * d, CORR_H + 0.6, Math.cos(a) * d, 0, a + Math.PI, 0);
        sign.name = 'sign'; g.add(sign);
      }
    }
    // the corridors: tiled floor, walls with portholes, a barrel-vault roof and a strip of lamps
    for (const C of CORRIDORS) {
      const R = ROOM_BY_ID[C.id], hall = ROOM_BY_ID.hall, yaw = Math.atan2(C.b.x - C.a.x, C.b.z - C.a.z), D = Math.hypot(C.b.x - C.a.x, C.b.z - C.a.z);
      const L = D - hall.r - R.r + 1.2, mid = hall.r - 0.6 + L / 2;
      const cg = new THREE.Group(); cg.position.set(Math.sin(yaw) * mid, 0, Math.cos(yaw) * mid); cg.rotation.y = yaw;
      cg.add(mesh(new THREE.PlaneGeometry(CORRIDOR_W, L), floorB, 0, 0.015, 0, -Math.PI / 2, 0, 0));
      cg.add(mesh(new THREE.PlaneGeometry(CORRIDOR_W * 0.4, L), floorA, 0, 0.02, 0, -Math.PI / 2, 0, 0));
      for (const s of [-1, 1]) {
        const w = mesh(new THREE.PlaneGeometry(L, SIDE_H), wallF, s * CORRIDOR_W / 2, SIDE_H / 2, 0, 0, -s * Math.PI / 2, 0); cg.add(w);
        for (let k = 0; k * 4 + 2 < L; k++) {
          const pz = -L / 2 + 2 + k * 4, px = (o) => s * (CORRIDOR_W / 2 - o);
          cg.add(mesh(new THREE.CircleGeometry(0.55, 24), sea, px(0.03), 1.8, pz, 0, -s * Math.PI / 2, 0));
          // v1.15.23: a gold rim and a flange, with rivets
          cg.add(mesh(new THREE.TorusGeometry(0.6, 0.08, 6, 28), gold, px(0.06), 1.8, pz, 0, -s * Math.PI / 2, 0));
          cg.add(mesh(new THREE.RingGeometry(0.62, 0.8, 28), goldD, px(0.04), 1.8, pz, 0, -s * Math.PI / 2, 0));
          for (let q = 0; q < 8; q++) { const qa = q / 8 * Math.PI * 2; cg.add(mesh(new THREE.SphereGeometry(0.035, 5, 4), gold, px(0.06), 1.8 + Math.sin(qa) * 0.71, pz + Math.cos(qa) * 0.71)); }
        }
      }
      const vault = mesh(new THREE.CylinderGeometry(CORRIDOR_W / 2, CORRIDOR_W / 2, L, 14, 1, true, Math.PI / 2, Math.PI), ceil, 0, SIDE_H, 0, Math.PI / 2, 0, 0);
      cg.add(vault);
      for (let k = 0; k * 3 + 1.5 < L; k++) cg.add(mesh(new THREE.BoxGeometry(0.3, 0.08, 1.2), lamp, 0, CORR_H - 0.12, -L / 2 + 1.5 + k * 3));
      g.add(cg);
    }
    const signs = []; g.traverse((o) => { if (o.name === 'sign') signs.push(o); });
    const baked = bake(g, (o) => o.name === 'sign' || o.userData.live); // (the sea windows merge into one: the scrolling is on their shared texture)
    // live bits (the aquarium's fish, the fountain's water) are re-found after baking
    this.live = []; baked.traverse((o) => { if (o.userData.live) this.live.push(o); });
    if (this.tank) { baked.add(this.tank); this.tankFish = this.tank.children; }
    this.interior = baked;
    // v1.15.23: where the lights hang: high in each room, under the corridors' lamp strips, and round the Grand Hall
    this.lightSpots = [];
    for (const R of ROOMS) this.lightSpots.push({ x: R.x, y: R.h - (R.id === 'hall' ? 2 : 1.4), z: R.z, dist: R.r * 2.4, k: R.id === 'hall' ? 1.6 : 1.4 });
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; this.lightSpots.push({ x: Math.sin(a) * 10, y: 6.5, z: Math.cos(a) * 10, dist: 18, k: 0.9 }); }
    for (const C of CORRIDORS) for (const u of [0.38, 0.62]) this.lightSpots.push({ x: C.b.x * u, y: 5.2 - 0.6, z: C.b.z * u, dist: 11, k: 1.1 });
    baked.visible = false;
    this.game.engine.scene.add(baked);
    this.buildPeople();
  }

  /** Each room's furniture (local to the room). Colliders go in world space. */
  furnish(R, rg, m) {
    const wx = (lx) => TOWN.x + R.x + lx, wz = (lz) => TOWN.z + R.z + lz;
    const box = (w, h, d, mt, x, y, z, ry = 0) => { const b = mesh(new THREE.BoxGeometry(w, h, d), mt, x, y, z, 0, ry, 0); rg.add(b); return b; };
    const solid = (x0, z0, x1, z1) => addBox(wx(Math.min(x0, x1)), wz(Math.min(z0, z1)), wx(Math.max(x0, x1)), wz(Math.max(z0, z1)));
    // a counter facing the room's doorway, with the keeper's spot behind it
    const toDoor = Math.atan2(-R.x, -R.z), back = (d) => ({ x: -Math.sin(toDoor) * d, z: -Math.cos(toDoor) * d });
    const counter = (d = R.r - 3.6, w = 5) => {
      const c = back(d), cg = new THREE.Group(); cg.position.set(c.x, 0, c.z); cg.rotation.y = toDoor;
      cg.add(prop('ch_counter')); cg.scale.x = w / 5;
      rg.add(cg);
      const hw = w / 2 + 0.2; addCircle(wx(c.x), wz(c.z), 0.6); for (let k = -1; k <= 1; k += 2) addCircle(wx(c.x + Math.cos(toDoor) * hw * 0.6 * k), wz(c.z - Math.sin(toDoor) * hw * 0.6 * k), 0.65);
      const keeper = back(d + 1.1);
      // v1.15.23: a tall chair behind the counter, so the keeper sits up level with it (backrest away from the counter)
      const ch = new THREE.Group(); ch.position.set(keeper.x, 0, keeper.z); ch.rotation.y = toDoor;
      ch.add(mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.1, 12), m.woodD, 0, CHAIR_SEAT - 0.05, 0));
      for (const [lx, lz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) ch.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, CHAIR_SEAT - 0.1, 5), m.wood, lx, (CHAIR_SEAT - 0.1) / 2, lz));
      ch.add(mesh(new THREE.TorusGeometry(0.3, 0.025, 4, 12), m.trim, 0, 0.38, 0, Math.PI / 2, 0, 0));
      ch.add(mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), m.wood, -0.2, CHAIR_SEAT + 0.25, -0.28), mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), m.wood, 0.2, CHAIR_SEAT + 0.25, -0.28));
      ch.add(mesh(new THREE.BoxGeometry(0.5, 0.28, 0.06), m.woodD, 0, CHAIR_SEAT + 0.38, -0.28));
      rg.add(ch);
      return { x: wx(keeper.x), z: wz(keeper.z), yaw: toDoor, seat: CHAIR_SEAT };
    };
    const shelves = (d, w = 3) => { const c = back(d), sg = new THREE.Group(); sg.position.set(c.x, 0, c.z); sg.rotation.y = toDoor; sg.add(prop('ch_shelf')); sg.scale.x = w / 3; rg.add(sg); return sg; };
    this.spots = this.spots || {};
    if (R.kind === 'hall') {
      // the fountain: a shell basin, a column of water, a giant clam on top
      rg.add(prop('ch_fountain'));
      const pool = mesh(new THREE.CylinderGeometry(3.45, 3.45, 0.1, 32), new THREE.MeshLambertMaterial({ color: '#5ac8d8', emissive: '#2a8aa0', transparent: true, opacity: 0.85 }), 0, 0.84, 0); pool.userData.live = 'pool'; rg.add(pool);
      addCircle(wx(0), wz(0), 4.1);
      // benches and kelp planters round the hall, between the doorways
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + Math.PI / 7, d = R.r - 2.2;
        const bx = Math.sin(a) * d, bz = Math.cos(a) * d;
        if (ROOMS.some((o) => o.id !== 'hall' && Math.abs(Math.atan2(Math.sin(Math.atan2(o.x, o.z) - a), Math.cos(Math.atan2(o.x, o.z) - a))) < 0.32)) continue;
        rg.add(prop('ch_bench', bx, 0, bz, a + Math.PI));
        const pa = a + 0.28, px = Math.sin(pa) * (d + 0.4), pz = Math.cos(pa) * (d + 0.4);
        rg.add(prop('ch_planter', px, 0, pz, jit(k) * 6));
        addCircle(wx(bx), wz(bz), 0.8); addCircle(wx(px), wz(pz), 0.65);
      }
      // a big kelp-green rug and a noticeboard
      rg.add(mesh(new THREE.RingGeometry(5, 9, 36), mat('#5a8a7a', { glow: 0.3 }), 0, 0.025, 0, -Math.PI / 2, 0, 0));
    } else if (R.kind === 'trading') {
      this.spots.shelly = counter();
      const s = shelves(R.r - 1.3, 5);
      void s;
      for (let k = 0; k < 4; k++) { const a = toDoor + Math.PI + (k - 1.5) * 0.5, d = R.r * 0.45; rg.add(mesh(new THREE.BoxGeometry(0.9, 0.6, 0.7), m.wood, Math.sin(a) * d, 0.3, Math.cos(a) * d, 0, a, 0)); for (let q = 0; q < 5; q++) rg.add(mesh(new THREE.ConeGeometry(0.12, 0.2, 6), m.coral[q % 4], Math.sin(a) * d + (jit(q, k) - 0.5) * 0.6, 0.68, Math.cos(a) * d + (jit(k, q) - 0.5) * 0.4)); addCircle(wx(Math.sin(a) * d), wz(Math.cos(a) * d), 0.55); }
    } else if (R.kind === 'market') {
      this.spots.finn = counter();
      // ice tables with fish laid out
      const fishIds = ['snapper', 'triggerfish', 'gt', 'barracuda', 'bluetang', 'parrotfish'];
      // v1.15.23: four tables spread round the sides (two each side), clear of the counter and the doorway
      for (let k = 0; k < 4; k++) {
        const a = toDoor + (k < 2 ? 1 : -1) * (k % 2 ? 1.95 : 1.05), d = R.r - 2.7, x = Math.sin(a) * d, z = Math.cos(a) * d;
        const tg = new THREE.Group(); tg.position.set(x, 0, z); tg.rotation.y = a + Math.PI / 2;
        tg.add(prop('ch_icetable'));
        for (let q = 0; q < 2; q++) { try { const f = buildFish(fishIds[(k * 2 + q) % fishIds.length]); f.scale.setScalar(0.55); f.position.set(-0.5 + q, 1.06, 0); f.rotation.set(0, Math.PI / 2, Math.PI / 2); f.userData.live = 'fishstall'; tg.add(f); } catch (e) { /* (no model: skip) */ } }
        rg.add(tg); addCircle(wx(x), wz(z), 1.3);
      }
      rg.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), m.trim, 0, R.h - 1.4, 0)); rg.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12), mat('#c8a040', { glow: 0.4 }), 0, R.h - 2.3, 0));
    } else if (R.kind === 'cafe') {
      this.spots.coral = counter();
      shelves(R.r - 1.3, 4);
      for (let k = 0; k < 4; k++) {
        const a = toDoor + Math.PI + (k - 1.5) * 0.62, d = R.r * 0.42, x = Math.sin(a) * d, z = Math.cos(a) * d;
        rg.add(prop('ch_table', x, 0, z, a));
        rg.add(mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.2, 8), m.cloth[k], x + 0.2, 0.92, z));
        for (const s2 of [-1, 1]) { const sx = x + Math.sin(a + Math.PI / 2) * 1 * s2, sz = z + Math.cos(a + Math.PI / 2) * 1 * s2; rg.add(prop('ch_stool', sx, 0, sz, s2)); }
        addCircle(wx(x), wz(z), 0.75);
      }
    } else if (R.kind === 'gallery') {
      // the great window: an aquarium wall across the far side, with live fish in it
      const far = back(R.r - 2.4), gw = 13;
      const tg = new THREE.Group(); tg.position.set(far.x, 0, far.z); tg.rotation.y = toDoor;
      tg.add(mesh(new THREE.PlaneGeometry(gw, 5.6), m.sea, 0, 3.1, -1.6));
      tg.add(mesh(new THREE.BoxGeometry(gw, 0.5, 3.4), mat('#d8c89a', { glow: 0.4 }), 0, 0.25, -0.1));
      tg.add(mesh(new THREE.BoxGeometry(gw + 0.3, 0.3, 0.3), m.trim, 0, 5.9, 1.4)); tg.add(mesh(new THREE.BoxGeometry(gw + 0.3, 0.6, 0.3), m.trim, 0, 0.3, 1.4));
      for (let k = 0; k <= 4; k++) tg.add(mesh(new THREE.BoxGeometry(0.2, 5.6, 0.25), m.trim, -gw / 2 + k * gw / 4, 3.1, 1.4));
      const glass = mesh(new THREE.PlaneGeometry(gw, 5.4), mat('#bff0ff', { opacity: 0.12, glow: 0.4 }), 0, 3.1, 1.42); glass.userData.live = 'glass'; tg.add(glass);
      // v1.15.23: water in the tank: a blue-green volume the fish swim in, a rippling surface and a bright waterline
      const water = mesh(new THREE.BoxGeometry(gw - 0.1, 5.0, 2.9), new THREE.MeshLambertMaterial({ color: '#3ab0c8', emissive: '#105868', transparent: true, opacity: 0.28, depthWrite: false }), 0, 3.0, -0.12);
      water.userData.live = 'water'; water.renderOrder = 3; tg.add(water);
      const surf = mesh(new THREE.PlaneGeometry(gw - 0.1, 2.9, 24, 6), new THREE.MeshLambertMaterial({ color: '#9ae8f0', emissive: '#2a8898', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }), 0, 5.5, -0.12, -Math.PI / 2, 0, 0);
      surf.userData.live = 'surf'; surf.renderOrder = 4; tg.add(surf);
      const line = mesh(new THREE.PlaneGeometry(gw, 0.06), new THREE.MeshBasicMaterial({ color: '#d8fbff', transparent: true, opacity: 0.8, fog: false }), 0, 5.5, 1.4); line.userData.live = 'line'; tg.add(line);
      for (let k = 0; k < 9; k++) { const n = buildNode(REEF_MATS, REEF_NODES, ['reef_kelp', 'reef_fan', 'reef_brain', 'reef_branch', 'reef_anemone'][k % 5], { shadow: false }); n.position.set(-gw / 2 + 0.8 + k * 1.4, 0.5, -0.6 + jit(k) * 0.9); n.scale.setScalar(0.7 + jit(k, 2) * 0.6); tg.add(n); }
      const tank = ['clownfish', 'bluetang', 'moorishidol', 'parrotfish', 'triggerfish', 'lanternangel', 'snapper', 'bluetang', 'clownfish', 'moorishidol'];
      // (the fish swim in a group of their own, added after the room is baked, so they move in the tank's frame)
      this.tank = new THREE.Group(); this.tank.position.set(R.x + far.x, 0, R.z + far.z); this.tank.rotation.y = toDoor;
      // (v1.15.23: they swim like the fish in your cabin's aquarium: long lazy laps end to end, bobbing, tails wagging)
      tank.forEach((id, k) => { try { const f = fitFish(buildFish(id), id === 'snapper' || id === 'parrotfish' ? 1.3 : 0.95); f.userData = { k, ph: jit(k, 3) * 6.28, sp: 0.16 + jit(k, 4) * 0.14, y: (k % 5) / 4 + (jit(k, 5) - 0.5) * 0.15 }; this.tank.add(f); } catch (e) { /* skip */ } });
      rg.add(tg);
      const fx = Math.cos(toDoor), fz = -Math.sin(toDoor); // along the window
      for (let k = -6; k <= 6; k++) addCircle(wx(far.x + fx * k), wz(far.z + fz * k), 1.9);
      // benches facing the glass
      for (let k = -1; k <= 1; k++) { const c = back(R.r * 0.15), bg = new THREE.Group(); bg.position.set(c.x + fx * k * 3.2, 0, c.z + fz * k * 3.2); bg.rotation.y = toDoor + Math.PI; bg.add(prop('ch_bench')); rg.add(bg); addCircle(wx(bg.position.x), wz(bg.position.z), 0.9); }
      this.spots.gallery = { x: wx(back(R.r * 0.15).x), z: wz(back(R.r * 0.15).z) };
    } else if (R.kind === 'locker') {
      this.spots.marina = counter(R.r - 3.2, 4);
      for (const da of [-1.25, 1.25, -2.1, 2.1]) { const a = toDoor + Math.PI + da, d = R.r - 1.1, x = Math.sin(a) * d, z = Math.cos(a) * d; rg.add(prop('ch_tankrack', x, 0, z, a + Math.PI)); addCircle(wx(x), wz(z), 1); }
    } else if (R.kind === 'inn') {
      this.spots.pip = counter(R.r - 3.2, 3.4);
      // v1.15.23: six beds, three down each side, spaced out and clear of Pip's desk and the doorway
      for (let k = 0; k < 6; k++) {
        const a = toDoor + (k < 3 ? 1 : -1) * (0.95 + (k % 3) * 0.62), d = R.r - 1.6, x = Math.sin(a) * d, z = Math.cos(a) * d;
        rg.add(prop('ch_bed', x, 0, z, a + Math.PI)); addCircle(wx(x), wz(z), 1.2);
      }
      rg.add(mesh(new THREE.CircleGeometry(2.2, 20), m.cloth[0], 0, 0.03, 0, -Math.PI / 2, 0, 0));
    } else if (R.kind === 'airlock') {
      // the inner hatch on the west wall, a valve wheel and hazard stripes on the floor
      const a = Math.PI * 1.5, hx = Math.sin(a) * (R.r - 0.15), hz = Math.cos(a) * (R.r - 0.15);
      rg.add(prop('ch_hatch', hx + 0.1, 0, hz, Math.PI / 2));
      // v1.15.23: no hazard stripes or puddle: a round welcome mat in front of the hatch
      rg.add(mesh(new THREE.CircleGeometry(1.5, 32), mat('#2e6a78', { glow: 0.3 }), hx + 1.9, 0.03, hz, -Math.PI / 2, 0, 0));
      rg.add(mesh(new THREE.RingGeometry(1.32, 1.46, 32), mat('#e8b440', { glow: 0.3 }), hx + 1.9, 0.035, hz, -Math.PI / 2, 0, 0));
      this.spots.greeter = { x: wx(-1.6), z: wz(2.4), yaw: -2.4 }; // (beside the mat, turned to whoever comes in)
    }
  }

  buildPeople() {
    const S = this.spots, mk = (name, title, avatar, at, extra = {}) => {
      const actor = new Actor(this.game.engine.scene);
      actor.setLook(avatar, { rod: 'rod_bamboo', lure: 'lure_classic', boat: 'boat_oak' });
      actor.root.visible = false;
      const p = { name, title, actor, pos: new THREE.Vector3(at.x, TOWN.y, at.z), yaw: at.yaw ?? 0, face: at.yaw ?? 0, seat: at.seat, ...extra };
      this.people.push(p); return p;
    };
    this.shelly = mk('Shelly', 'Coralhaven Trading Post', look({ gender: 'female', skin: 6, hair: 'wavy', hairColor: 8, eyes: 'happy', mouth: 'smile', shirt: 'tank', shirtColor: 7, pants: 'shorts', pantsColor: 4, shoes: 'sandals', accessory: 'shells' }), S.shelly);
    this.finn = mk('Old Finn', 'Fish market', look({ gender: 'male', skin: 2, hair: 'bald', facialHair: 'beard', hairColor: 9, eyes: 'sleepy', brows: 'thick', mouth: 'smirk', hat: 'sailor', shirt: 'stripes', shirtColor: 2, pants: 'cargo', pantsColor: 2, shoes: 'boots' }), S.finn);
    this.coral = mk('Coral', 'The Kelp & Kettle', look({ gender: 'female', skin: 4, hair: 'buns', hairColor: 5, eyes: 'happy', mouth: 'grin', shirt: 'polo', shirtColor: 3, pants: 'jeans', pantsColor: 1, shoes: 'sneakers' }), S.coral);
    this.marina = mk('Marina', 'Dive Locker', look({ gender: 'female', skin: 1, hair: 'ponytail', hairColor: 1, eyes: 'focused', mouth: 'smile', shirt: 'turtleneck', shirtColor: 5, pants: 'joggers', pantsColor: 5, shoes: 'boots', eyewear: 'goggles' }), S.marina);
    this.pip = mk('Pip', 'The Tidewater Inn', look({ gender: 'male', skin: 3, height: 'short', hair: 'curly', hairColor: 3, eyes: 'round', mouth: 'grin', shirt: 'cardigan', shirtColor: 6, pants: 'wideleg', pantsColor: 0, shoes: 'boots' }), S.pip);
    // v1.15.23: Nerissa greets you at the airlock, in her smart navy uniform and silk scarf
    this.greeter = mk('Nerissa', 'Coralhaven welcome desk', look({ gender: 'female', skin: 3, hair: 'buns', hairColor: 1, eyes: 'lashes', brows: 'arched', mouth: 'smile', shirt: 'cardigan', shirtColor: 15, pants: 'longskirt', pantsColor: 2, shoes: 'slipons', accessory: 'acc_scarf' }), S.greeter);
    // townsfolk out for a walk: round the hall, and in and out of the rooms
    const hallRing = (a, d = 9) => ({ x: Math.sin(a) * d, z: Math.cos(a) * d });
    // a visit: along the corridor's middle to the room and back (so nobody walks through a wall)
    const visit = (id) => { const R = ROOM_BY_ID[id], L = Math.hypot(R.x, R.z), u = { x: R.x / L, z: R.z / L }, at = (d) => ({ x: u.x * d, z: u.z * d }); return [at(11), at(L * 0.62), at(L - R.r * 0.25), at(L * 0.62), at(11)]; };
    const routes = [
      [hallRing(0.3), hallRing(1.5), ...visit('market'), hallRing(2.6), hallRing(4.2)],
      [hallRing(3.2), ...visit('gallery'), hallRing(3.6), hallRing(5.4)],
      [hallRing(5.0), ...visit('inn'), hallRing(5.8), ...visit('trading'), hallRing(0.8)],
      [hallRing(2.0, 11), ...visit('cafe'), hallRing(1.2, 11), hallRing(0.4, 11)],
      [hallRing(4.4, 12), ...visit('locker'), hallRing(5.2, 12), hallRing(0.2, 12), hallRing(2.8, 12)],
    ];
    const folk = [
      { name: 'Reef', o: { gender: 'male', skin: 5, hair: 'crop', hairColor: 0, shirt: 'hoodie', shirtColor: 4, pants: 'shorts', pantsColor: 2 } },
      { name: 'Nell', o: { gender: 'female', skin: 2, hair: 'long', hairColor: 6, shirt: 'sundress', shirtColor: 1, pants: 'longskirt', pantsColor: 1 } },
      { name: 'Barnacle Bert', o: { gender: 'male', skin: 3, hair: 'bald', facialHair: 'beard', hairColor: 9, hat: 'beanie', shirt: 'sweater', shirtColor: 2, pants: 'cargo', pantsColor: 3 } },
      { name: 'Lulu', o: { gender: 'female', skin: 4, height: 'short', hair: 'pigtails', hairColor: 2, shirt: 'tee', shirtColor: 6, pants: 'shorts', pantsColor: 4 } },
      { name: 'Doc Hart', o: { gender: 'nonbinary', skin: 1, hair: 'messy', hairColor: 4, extras: ['glassesRound'], shirt: 'turtleneck', shirtColor: 7, pants: 'wideleg', pantsColor: 0 } },
    ];
    this.walkers = folk.map((f, i) => {
      // (a leg that would cut across the fountain goes round the hall instead)
      const raw = routes[i], loc = [];
      raw.forEach((q, k) => {
        const p0 = raw[(k + raw.length - 1) % raw.length], dx = q.x - p0.x, dz = q.z - p0.z, L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, -(p0.x * dx + p0.z * dz) / L2));
        if (Math.hypot(p0.x + dx * u, p0.z + dz * u) < 6) {
          let a0 = Math.atan2(p0.x, p0.z), a1 = Math.atan2(q.x, q.z), da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
          for (let n = 1; n <= 3; n++) loc.push(hallRing(a0 + da * n / 4, 8.5));
        }
        loc.push(q);
      });
      const pts = loc.map((q) => ({ x: TOWN.x + q.x, z: TOWN.z + q.z }));
      return mk(f.name, 'Coralhaven', look(f.o), { ...pts[0], yaw: 0 }, { route: pts, leg: 1, wait: jit(i) * 3 });
    });
  }

  // ================================================================ moving between them
  enter() {
    const g = this.game, ow = this.ow;
    this.buildInterior();
    const fade = document.createElement('div'); fade.className = 'travel-fade'; g.ui.root.append(fade);
    setTimeout(() => {
      const p = W(AIRLOCK_IN.x + 1.2, AIRLOCK_IN.z);
      ow.dive.exit(p.x, TOWN.y, p.z);
      g.player.yaw = Math.PI / 2;
      g.audio.sfx('creak');
      g.ui.toast('Coralhaven. The air hisses in and the water drains away. Welcome!', { icon: 'waves', title: 'Through the airlock', ms: 3800 });
      if (!this.deep.dd.townIn) this.deep.change((d) => { d.townIn = Date.now(); });
    }, 260);
    setTimeout(() => fade.remove(), 900);
  }
  leave() {
    const g = this.game, ow = this.ow;
    const fade = document.createElement('div'); fade.className = 'travel-fade'; g.ui.root.append(fade);
    setTimeout(() => {
      const D = this.door;
      ow.dive.enter(D.x, D.z);
      g.player.pos.set(D.x - 0.6, D.y, D.z); ow.dive.vel.set(-0.6, 0, 0); g.player.yaw = -Math.PI / 2;
      g.engine.cam.target.set(D.x - 0.6, D.y + 0.8, D.z);
      ow.dive.o2 = ow.dive.maxO2;
    }, 260);
    setTimeout(() => fade.remove(), 900);
  }

  // ================================================================ per frame
  update(dt, t) {
    const g = this.game, p = g.player.pos, ow = this.ow;
    const inside = !ow.dive.on && inTown(p.x, p.z);
    if (inside !== this.inside) this.setInside(inside);
    // outside: bubbles rising off the hall's cupola, the pearls bobbing
    const B = BANK_BY_ID.coralhaven;
    if (!inside && ow.atSea && Math.hypot(B.x - p.x, B.z - p.z) < 80) {
      if (Math.random() < dt * 3) g.fx.bubbles?.(new THREE.Vector3(this.fountainOut.x + (Math.random() - 0.5) * 3, this.fountainOut.y, this.fountainOut.z + (Math.random() - 0.5) * 3));
      for (const pl of this.pearls) if (pl.m) { pl.m.visible = !this.deep.dd.pearls?.[pl.i]; pl.m.position.y = pl.y + Math.sin(t * 2 + pl.i) * 0.05; }
    }
    if (!inside) return;
    const sky = g.engine.sky, f = sky.scene.fog;
    f.near = 70; f.far = 200; f.color.set('#2e6a70'); sky.scene.background?.set?.('#2e6a70');
    if (sky.rain) sky.rain.visible = false;
    if (g.engine.cam.zoom > 0.9) g.engine.cam.zoom = 0.9; // (the walls are in the way of a camera far out)
    if (this.seaTex) this.seaTex.offset.x = (t * 0.004) % 1;
    for (const o of this.tankFish || []) { // (the cabin aquarium's swim, in a tank 13 m long)
      const u = o.userData, a = t * u.sp + u.ph;
      o.position.set(Math.sin(a) * 5.6, 1.2 + u.y * 3.6 + Math.sin(a * 0.7 + u.ph) * 0.3, -0.15 + Math.cos(a * 1.3) * 0.9);
      o.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI; o.rotation.z = Math.sin(t * 6 + u.ph) * 0.08;
    }
    for (const o of this.live) if (o.userData.live === 'surf') { const pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * 1.3 + t * 1.6) * 0.04 + Math.cos(pa.getY(i) * 2.1 + t * 1.1) * 0.03); pa.needsUpdate = true; }
    this.lightUp(t);
    for (const o of this.live) if (o.userData.live === 'pool') o.position.y = 0.84 + Math.sin(t * 2) * 0.02;
    if (Math.random() < dt * 5) g.fx.bubbles?.(new THREE.Vector3(TOWN.x + (Math.random() - 0.5) * 0.6, TOWN.y + 4.2, TOWN.z + (Math.random() - 0.5) * 0.6));
    // people: keepers face you when you come near; walkers stroll their routes
    for (const pe of this.people) {
      let moving = false;
      if (pe.route) {
        if (pe.wait > 0) pe.wait -= dt;
        else {
          const to = pe.route[pe.leg], dx = to.x - pe.pos.x, dz = to.z - pe.pos.z, d = Math.hypot(dx, dz);
          if (d < 0.3) { pe.leg = (pe.leg + 1) % pe.route.length; pe.wait = 1 + jit(pe.leg, pe.name.length) * 4; }
          else { const step = Math.min(d, 1.25 * dt); pe.pos.x += dx / d * step; pe.pos.z += dz / d * step; pe.yaw = Math.atan2(dx, dz); moving = true; }
        }
      }
      const dx = p.x - pe.pos.x, dz = p.z - pe.pos.z, close = dx * dx + dz * dz < 12 && !moving;
      pe.actor.root.visible = dx * dx + dz * dz < 900; // (only the people within 30 m are drawn)
      if (!pe.actor.root.visible) continue;
      const want = close ? Math.atan2(dx, dz) : pe.yaw;
      let d = want - pe.face; d = Math.atan2(Math.sin(d), Math.cos(d)); pe.face += d * Math.min(1, dt * 4);
      pe.actor.update(dt, t, { x: pe.pos.x, y: TOWN.y, z: pe.pos.z, yaw: pe.face, mode: 'shore', pose: 'idle', moving, rod: 'back', ...(pe.seat ? { seat: pe.seat, seatYaw: pe.yaw } : {}) });
    }
  }
  /** v1.15.23: real light indoors. The town borrows the scene's existing point lights (the dock lamp, the campfire
   *  lights and the three lantern lights; adding new ones would recompile every material in the game) and hangs them
   *  at the four light spots nearest you (the light budget's limit), warm and soft, with a steady indoor fill instead of the sky's. */
  borrowedLights() {
    const g = this.game, sky = g.engine.sky;
    return [sky.dockLight, sky.fireLight, sky.fireLight2, ...(g.nightLights?.lights || [])].filter(Boolean);
  }
  lightUp(t) {
    const g = this.game, sky = g.engine.sky, p = g.player.pos, L = this.borrowedLights();
    if (!this.lightSaved) this.lightSaved = L.map((l) => ({ l, pos: l.position.clone(), distance: l.distance, decay: l.decay, color: l.color.clone(), always: l.userData.lbAlways }));
    const lx = p.x - TOWN.x, lz = p.z - TOWN.z;
    const near = (this.lightSpots || []).map((q) => ({ q, d: (q.x - lx) ** 2 + (q.z - lz) ** 2 })).sort((a, b) => a.d - b.d).slice(0, 4); // (the light budget shows four point lights at once)
    L.forEach((l, i) => {
      const q = near[i]?.q; if (!q) { l.intensity = 0; return; }
      l.userData.lbAlways = true; l.position.set(TOWN.x + q.x, TOWN.y + q.y, TOWN.z + q.z); l.distance = q.dist; l.decay = 1.1; l.color.set('#ffe0b8');
      l.intensity = q.k * 1.4 * (0.97 + Math.sin(t * 1.3 + i) * 0.03);
    });
    sky.hemi.color.set('#fff0dc'); sky.hemi.groundColor.set('#5a7a78'); sky.hemi.intensity = 0.45;
    sky.sun.intensity = 0.25; sky.sun.color.set('#cfe8ff'); if (sky.moonLight) sky.moonLight.intensity = 0;
  }
  restoreLights() {
    for (const s of this.lightSaved || []) { s.l.position.copy(s.pos); s.l.distance = s.distance; s.l.decay = s.decay; s.l.color.copy(s.color); s.l.intensity = 0; if (s.always) s.l.userData.lbAlways = s.always; else delete s.l.userData.lbAlways; }
    this.lightSaved = null; // (the sky and the lantern lights set their own intensities again next frame)
  }
  setInside(on) {
    this.inside = on;
    if (!on) this.restoreLights();
    const cam = this.game.engine.camera; // (nothing outside the town is drawn while you're in it)
    if (on) { this.far0 = this.far0 || cam.far; cam.far = 140; } else if (this.far0) cam.far = this.far0;
    cam.updateProjectionMatrix();
    if (on) this.buildInterior();
    if (this.interior) this.interior.visible = on;
    for (const pe of this.people) pe.actor.root.visible = on;
    if (!on && this.game.engine.sky.rain) this.game.engine.sky.rain.visible = true;
  }

  // ================================================================ things to do (E)
  diveActions() {
    const p = this.game.player.pos, D = this.door;
    if (!D || Math.hypot(D.x - p.x, D.z - p.z) > 4.5 || Math.abs(D.y - p.y) > 3.5) return [];
    return [{ id: 'town-in', label: 'Enter Coralhaven', color: 'gold', at: { x: D.x, z: D.z, y: D.y, h: 2 }, fn: () => this.enter() }];
  }
  townActions() {
    if (!this.inside) return [];
    const g = this.game, p = g.player.pos, out = [], dp = this.deep;
    const by = (pe, r = 3) => pe && Math.hypot(pe.pos.x - p.x, pe.pos.z - p.z) < r;
    const talk = (pe, id, fn) => { if (by(pe)) out.push({ id, label: `Talk to ${pe.name}`, color: 'gold', at: { x: pe.pos.x, z: pe.pos.z, y: TOWN.y, h: 2.4 }, fn }); };
    talk(this.shelly, 'shelly', () => dp.talkShelly());
    talk(this.finn, 'finn', () => dp.talkFinn());
    talk(this.coral, 'coral', () => this.talkCoral());
    talk(this.marina, 'marina', () => this.ow.dive.shop());
    talk(this.pip, 'pip', () => this.talkPip());
    talk(this.greeter, 'greeter', () => this.chat(this.greeter));
    for (const w of this.walkers) if (by(w, 2.2)) { out.push({ id: `folk-${w.name}`, label: `Say hello to ${w.name}`, fn: () => this.chat(w) }); break; }
    const A = W(AIRLOCK_IN.x, AIRLOCK_IN.z);
    if (Math.hypot(A.x - p.x, A.z - p.z) < 3.4) out.push({ id: 'town-out', label: 'Out through the airlock', color: 'blue', at: { x: A.x, z: A.z, y: TOWN.y, h: 2.6 }, fn: () => this.leave() });
    return out;
  }
  chat(w) {
    const lines = {
      Nerissa: ['Welcome to Coralhaven! The Grand Hall is straight ahead, and every shop opens off it.', 'Shelly at the Trading Post buys pearls and treasure. Old Finn pays best for sea fish.', 'Tired? The Tidewater Inn has beds, and the Kelp & Kettle does the best bubble tea under the sea.', 'Mind your air when you head back out. Marina at the Dive Locker can sell you a bigger tank.'],
      Reef: ['Born down here. Never seen a cloud. Are they soft?', 'The window in the Gallery is the best seat in town.', 'Shelly lost her pearls again. Out in the coral, she says.'],
      Nell: ['The bubble tea at the Kelp & Kettle is the only reason I get up.', 'Nerissa at the airlock knows everyone. Ask her anything.', 'Old Finn pays more than anyone up top. Don\'t tell Gus.'],
      'Barnacle Bert': ['Forty years down here. The pressure keeps me young.', 'Stay at the Tidewater some night. You can hear whales through the wall.', 'Did you see the wreck east of here? The Marigold. Bad luck ship.'],
      Lulu: ['Race you round the fountain!', 'I saw a lantern angelfish at dusk! It glowed!', 'Marina says I can have fins when I\'m bigger.'],
      'Doc Hart': ['Fascinating. The coral grows a little every year, and so does the town.', 'Air in the domes is pumped from the vents at Emberkey. Clever, eh?', 'I study the fish in the Gallery. They study me back.'],
    }[w.name] || ['Lovely day down here.'];
    this.game.dialogue.open({ npc: w, title: 'Coralhaven', text: lines[Math.floor(Math.random() * lines.length)], choices: [{ label: 'Nice to meet you' }] });
  }
  talkCoral() {
    const g = this.game, until = this.deep.dd.teaUntil || 0, left = Math.max(0, Math.ceil((until - Date.now()) / 60000));
    g.dialogue.open({ npc: this.coral, title: this.coral.title, text: `Coral, of the Kelp & Kettle. Sit down, you look waterlogged. My bubble tea's made with kelp from the gardens outside: drink one and you'll hold your breath half as long again on your next dives.${left ? ` (Yours lasts another ${left} min.)` : ''}`, choices: [
      { label: 'A bubble tea, please (120 coins)', primary: true, fn: () => setTimeout(() => this.buyTea(), 150) },
      { label: 'Just looking' },
    ] });
  }
  async buyTea() {
    const g = this.game, r = await g.save.spend('cafe', 'tea', { coins: 120 });
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough coins.'); return; }
    this.deep.change((d) => { d.teaUntil = Date.now() + 20 * 60000; });
    g.audio.sfx('purchase');
    g.ui.toast('Bubble tea: +50% air on your dives for 20 minutes.', { icon: 'waves', title: 'The Kelp & Kettle', ms: 3800 });
  }
  talkPip() {
    const g = this.game, ev = this.ow.evenings;
    g.dialogue.open({ npc: this.pip, title: this.pip.title, text: 'Pip, of the Tidewater Inn! Three beds, quiet as a clam, and you can hear the whales sing through the wall. Rooms are for after dusk.', choices: [
      ev?.evening ? { label: 'Sleep till dawn', primary: true, fn: () => setTimeout(() => ev.sleep(), 150) } : { label: 'Come back after dusk', fn: () => g.ui.toast('The inn\'s for sleeping: come back after dusk and turn in till dawn.', { icon: 'moon' }) },
      { label: 'Bye, Pip' },
    ] });
  }
  /** Bubble tea: half as much air again. */
  airMult() { return (this.deep.dd.teaUntil || 0) > Date.now() ? 1.5 : 1; }
}
