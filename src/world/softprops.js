// Soft-block world props: cabin, dock, trees, plants, lanterns, campfire, notice board, boat rack,
// lighthouse, ruins and lily pads. Each category paints into its own atlas and merges into one mesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Atlas, softBox, tone, mix, hash, atlasMaterial } from '../render/soft.js';
import { buildSoftBoat } from '../entities/softboat.js';

// ---------------------------------------------------------------- shared helpers
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
class Kit {
  constructor(size = 1024, density = 0) { this.atlas = new Atlas(size); this.geos = []; this.density = density; }
  /** softBox placed at (x,y,z) with rotation (rx,ry,rz) and optional uniform scale. */
  box(w, h, d, r, paint, x, y, z, rx = 0, ry = 0, rz = 0, opts) {
    const g = softBox(this.atlas, w, h, d, r, paint, this.density && !opts?.D ? { ...opts, D: this.density } : opts);
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(1, 1, 1));
    g.applyMatrix4(_m);
    this.geos.push(g);
    return g;
  }
  /** Reuse an already painted geometry (shared texels) at another transform. */
  stamp(geo, x, y, z, ry = 0, scale = 1, rx = 0, rz = 0) {
    const g = geo.clone();
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(scale, scale, scale));
    g.applyMatrix4(_m);
    this.geos.push(g);
  }
  /** Build a template (not added) from a sub-kit callback, merged into one geometry. */
  template(fn) {
    const saved = this.geos; this.geos = [];
    fn(this);
    const g = mergeGeometries(this.geos);
    this.geos.forEach((x) => x.dispose());
    this.geos = saved;
    return g;
  }
  mesh(name, matOpts = {}, shadows = true) {
    const m = new THREE.Mesh(mergeGeometries(this.geos), atlasMaterial(this.atlas, matOpts));
    this.geos.forEach((x) => x.dispose());
    this.geos = [];
    m.name = name;
    m.castShadow = shadows; m.receiveShadow = true;
    return m;
  }
}

const noisy = (c, k = 0.06, s = 0, p = 0.85) => (f) => f.fill((x, y) => (hash(x, y, s) > p ? tone(c, -k) : hash(x, y, s + 1) > p + 0.07 ? tone(c, k * 0.8) : c));
const planksAlong = (base, every = 4, seed = 1) => (f) => f.fill((x, y) => {
  if (y % every === every - 1) return tone(base, -0.24);
  const row = Math.floor(y / every);
  if ((x + row * 13) % 29 === 0) return tone(base, -0.3);
  const n = hash(Math.floor(x / 4), row, seed);
  return n > 0.78 ? tone(base, 0.08) : n < 0.18 ? tone(base, -0.07) : base;
});
const planksAcross = (base, every = 4, seed = 2) => (f) => f.fill((x, y) => {
  if (x % every === every - 1) return tone(base, -0.24);
  const col = Math.floor(x / every);
  if ((y + col * 11) % 31 === 0) return tone(base, -0.3);
  const n = hash(col, Math.floor(y / 4), seed);
  return n > 0.78 ? tone(base, 0.08) : n < 0.18 ? tone(base, -0.07) : base;
});
const bark = (c) => (f) => f.fill((x, y) => (x % 3 === 0 ? tone(c, -0.18) : hash(x, Math.floor(y / 3), 41) > 0.8 ? tone(c, 0.1) : c));
const stone = (c) => (f) => f.fill((x, y) => {
  const bx = Math.floor((x + (Math.floor(y / 4) % 2) * 3) / 6), by = Math.floor(y / 4);
  if (y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 3) % 6 === 5) return tone(c, -0.28);
  const n = hash(bx, by, 43);
  return n > 0.7 ? tone(c, 0.08) : n < 0.25 ? tone(c, -0.08) : c;
});

// ---------------------------------------------------------------- cabin (Gus's Tackle & Tide)
// Footprint matches the old cabin: walls x 0..7, z 0..6 from the origin (CABIN.x - 3.5, ground, CABIN.z - 3);
// door on the east wall (x = 7) at z 2.5..3.5, porch east of it, Gus's counter at z 3.25..4.5.
export function softCabin() {
  const k = new Kit(2048);
  const W = 7, Dp = 6, logH = 0.36, logs = 8;
  const LOG = '#9a6638', LOG_L = '#ad7646', END = '#d0a26a';
  const STONE = '#8a8a84';
  // stone foundation
  k.box(W + 0.4, 0.5, Dp + 0.4, 0.12, { all: stone(STONE), top: noisy('#7a7a74') }, W / 2, 0.25, Dp / 2);
  // windows on the north/south walls (x ranges, log rows), a round-ish one on the west wall, door on the east
  const winX = [[1.3, 2.5], [4.5, 5.7]];
  const winRows = [3, 4, 5];
  const doorZ = [2.45, 3.55];
  for (let i = 0; i < logs; i++) {
    const y = 0.5 + logH / 2 + i * logH;
    const tone2 = i % 2 ? LOG : LOG_L;
    const logFace = (wallLen, holes, outward) => (f, side) => {
      // wood grain + knots; end-grain rings on the short faces
      if (side === 'right' || side === 'left') {
        f.fill((x, yy) => { const d = Math.hypot(x - f.w / 2 + 0.5, yy - f.h / 2 + 0.5); return d < 1.5 ? tone(END, -0.2) : d < f.h / 2 - 1 ? ((Math.floor(d) % 2) ? END : tone(END, -0.1)) : tone(tone2, -0.1); });
        return;
      }
      f.fill((x, yy) => (yy === 0 ? tone(tone2, 0.1) : yy === f.h - 1 ? tone(tone2, -0.25) : hash(Math.floor(x / 5), yy, 7 + i) > 0.82 ? tone(tone2, -0.1) : x % 23 === (i * 7) % 23 ? tone(tone2, -0.3) : tone2));
      if (side !== 'front' && side !== 'back') return;
      const mirrored = side === 'back';
      for (const [a, b, kind] of holes) {
        const px0 = Math.round(((mirrored ? wallLen - b : a) / wallLen) * f.w), px1 = Math.round(((mirrored ? wallLen - a : b) / wallLen) * f.w);
        for (let x = px0; x < px1; x++) for (let yy = 0; yy < f.h; yy++) {
          const edge = x === px0 || x === px1 - 1;
          if (kind === 'door') f.px(x, yy, edge ? '#4a2c16' : (x - px0) % 4 === 0 ? '#5a361e' : '#6a4024');
          else f.px(x, yy, edge ? '#5e3c22' : (x - px0) === Math.floor((px1 - px0) / 2) ? '#5e3c22' : hash(x, yy, 3) > 0.7 ? '#f8e8a0' : '#cfe8f0');
        }
      }
    };
    const winHoles = winRows.includes(i) ? winX.map(([a, b]) => [a, b, 'win']) : [];
    // north (z=0) and south (z=Dp) walls run along x; logs alternate overhang
    const over = i % 2 ? 0.25 : 0.05;
    for (const z of [0, Dp]) k.box(W + over * 2, logH, logH, logH * 0.45, { all: logFace(W + over * 2, winHoles.map(([a, b, t]) => [a + over, b + over, t])) }, W / 2, y, z, 0, 0, 0);
    // west (x=0) and east (x=W) walls run along z (built along x then turned)
    const over2 = i % 2 ? 0.05 : 0.25;
    const eastHoles = i < 6 ? [[doorZ[0] + over2, doorZ[1] + over2, 'door']] : [];
    const westHoles = (i === 4 || i === 5) ? [[2.6 + over2, 3.4 + over2, 'win']] : [];
    k.box(Dp + over2 * 2, logH, logH, logH * 0.45, { all: logFace(Dp + over2 * 2, westHoles) }, 0, y, Dp / 2, 0, Math.PI / 2, 0);
    k.box(Dp + over2 * 2, logH, logH, logH * 0.45, { all: logFace(Dp + over2 * 2, eastHoles) }, W, y, Dp / 2, 0, -Math.PI / 2, 0);
  }
  const eave = 0.5 + logs * logH;
  // gable ends (planked triangles approximated by stacked boards)
  for (const x of [0, W]) for (let j = 0; j < 5; j++) {
    const w = Dp - j * 1.15;
    if (w <= 0.4) break;
    k.box(w, 0.32, 0.22, 0.06, { all: planksAcross('#b08458', 5, 9 + j) }, x, eave + 0.16 + j * 0.32, Dp / 2, 0, Math.PI / 2, 0);
  }
  // roof: two thick shingled slabs meeting at the ridge
  const pitch = 0.62, roofL = W + 1.0, slab = Dp / 2 / Math.cos(pitch) + 0.55;
  const shingles = (f) => f.fill((x, y) => {
    const row = Math.floor(y / 3), off = (row % 2) * 3;
    if (y % 3 === 2) return '#5e2a1e';
    if ((x + off) % 6 === 5) return '#6a3022';
    const n = hash(Math.floor((x + off) / 6), row, 51);
    return n > 0.75 ? '#a85a40' : n < 0.2 ? '#7a3a2a' : '#94503a';
  });
  for (const s of [-1, 1]) {
    const cz = Dp / 2 + s * (Dp / 4 + 0.12);
    k.box(roofL, 0.18, slab, 0.06, { top: shingles, bottom: planksAlong('#7a5230'), all: (f) => f.fill('#6a3022') }, W / 2, eave + Math.tan(pitch) * Dp / 4 + 0.1, cz, s * pitch, 0, 0);
  }
  k.box(roofL + 0.1, 0.16, 0.34, 0.07, { all: (f) => f.fill((x) => (x % 4 === 0 ? '#5e2a1e' : '#6a3022')) }, W / 2, eave + Math.tan(pitch) * Dp / 2 + 0.16, Dp / 2);
  // stone chimney on the south slope
  k.box(0.95, 3.6, 0.95, 0.12, { all: stone('#8e8a84') }, 1.9, eave + 0.6, 4.4);
  k.box(1.15, 0.22, 1.15, 0.08, { all: noisy('#6a6a66'), top: (f) => { f.fill('#6a6a66'); f.rect(Math.floor(f.w / 2) - 3, Math.floor(f.h / 2) - 3, 6, 6, '#1e1c1a'); } }, 1.9, eave + 2.45, 4.4);
  // flower boxes under the north/south windows
  for (const z of [-0.32, Dp + 0.32]) for (const [a, b] of winX) {
    k.box(b - a + 0.2, 0.2, 0.26, 0.06, { all: planksAlong('#6a4024', 3, 4), top: (f) => f.fill((x, y) => ['#f08ab0', '#4a8a30', '#f8e070', '#4a8a30', '#ffffff', '#4a8a30', '#a070e0', '#4a8a30'][(x + y * 3) % 8]) }, (a + b) / 2, 0.5 + 3 * logH - 0.1, z);
  }
  // porch deck, posts, striped awning, counter, sign, barrels, crate, lantern
  k.box(1.6, 0.16, 3.2, 0.05, { top: planksAcross('#b08458', 4, 12), all: planksAlong('#94683e') }, W + 0.8, 0.42, 3.0);
  for (const z of [1.55, 4.45]) k.box(0.18, 3.0, 0.18, 0.06, { all: bark('#6a4024') }, W + 1.5, 1.95, z);
  const stripes = (f) => f.fill((x, y) => (Math.floor(x / 4) % 2 ? '#3a7ab8' : '#f0ead8'));
  k.box(1.9, 0.08, 3.5, 0.03, { top: stripes, bottom: stripes, all: (f) => f.fill('#3a7ab8') }, W + 0.85, 3.25, 3.0, 0, 0, -0.32);
  // scalloped valance along the awning's front edge
  for (let i = 0; i < 7; i++) k.box(0.06, 0.18, 0.46, 0.03, { all: (f) => f.fill(i % 2 ? '#3a7ab8' : '#f0ead8') }, W + 1.76, 2.92, 1.5 + i * 0.5);
  // counter with bait jar and a fish on it
  k.box(0.32, 0.8, 1.25, 0.06, { all: planksAlong('#7a5230', 4, 3), top: planksAcross('#94683e') }, W + 1.0, 0.9, 3.88);
  k.box(0.5, 0.08, 1.4, 0.03, { all: planksAcross('#94683e') }, W + 1.0, 1.34, 3.88);
  k.box(0.16, 0.2, 0.16, 0.06, { all: (f) => f.fill((x, y) => (y < 3 ? '#c8a070' : '#a8d8c8')) }, W + 1.0, 1.48, 4.38);
  k.box(0.36, 0.12, 0.05, 0.03, { all: (f) => { f.fill('#4a90e2'); f.px(f.w - 3, 1, '#1a1a1a'); } }, W + 1.0, 1.44, 3.6, 0, Math.PI / 2, 0);
  // hanging sign with a painted fish
  const signF = (f) => { f.fill('#e8d090'); f.rect(0, 0, f.w, 1, '#a07848'); f.rect(0, f.h - 1, f.w, 1, '#a07848'); const cx = Math.floor(f.w / 2), cy = Math.floor(f.h / 2); f.rect(cx - 6, cy - 2, 9, 5, '#4a90e2'); f.rect(cx + 3, cy - 1, 3, 3, '#4a90e2'); f.rect(cx - 9, cy - 3, 3, 7, '#3a70b8'); f.px(cx + 1, cy - 1, '#1a1a1a'); };
  k.box(0.06, 0.62, 0.95, 0.03, { right: signF, left: signF, all: (f) => f.fill('#a07848') }, W + 0.55, 2.35, 2.0);
  k.box(0.08, 0.08, 0.7, 0.03, { all: (f) => f.fill('#4a2c16') }, W + 0.25, 2.75, 2.0, 0, Math.PI / 2, 0);
  for (const z of [0.6, 1.15]) {
    k.box(0.5, 0.62, 0.5, 0.2, { all: (f) => f.fill((x, y) => (y === 3 || y === f.h - 4 ? '#5a5a58' : x % 4 === 0 ? '#7a4a28' : '#8a5a34')), top: (f) => f.fill((x, y) => (Math.hypot(x - f.w / 2, y - f.h / 2) < f.w / 2 - 2 ? '#a07040' : '#5a5a58')) }, W + 0.45, 0.81, z);
  }
  k.box(0.75, 0.5, 0.5, 0.06, { all: planksAcross('#c09060', 3, 6) }, W + 1.3, 0.75, 0.75);
  // fishing net on the south wall, a rod leaning by the door
  const net = (f) => { for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) f.px(x, y, (x + y) % 3 === 0 || (x - y + 99) % 3 === 0 ? '#d8c8a0' : 'clear'); };
  k.box(1.5, 1.2, 0.03, 0.01, { front: net, back: net, all: (f) => f.fill('clear') }, 3.2, 1.6, Dp + 0.22, 0, 0, 0, { shade: false, seg: 1 });
  k.box(0.05, 2.2, 0.05, 0.02, { all: (f) => f.fill('#8a6a3a') }, W + 0.3, 1.6, 1.85, 0.25, 0, 0.1);
  return k.mesh('cabin');
}

// ---------------------------------------------------------------- dock
export function softDock(DOCK, heightAt) {
  const k = new Kit(1024);
  const x0 = DOCK.x0, x1 = DOCK.x1 + 1, z0 = DOCK.z0, z1 = DOCK.z1 + 1;
  const w = x1 - x0, len = z1 - z0, top = DOCK.deckY;
  // deck in two halves (keeps texture faces inside the atlas)
  const half = len / 2;
  for (let i = 0; i < 2; i++) {
    const cz = z0 + half / 2 + i * half;
    k.box(w, 0.2, half + 0.02, 0.05, { top: planksAlong('#b8875a', 5, 20 + i), all: planksAlong('#94683e', 4, 3) }, (x0 + x1) / 2, top - 0.1, cz);
  }
  // edge beams
  for (const x of [x0 + 0.1, x1 - 0.1]) k.box(len, 0.22, 0.2, 0.07, { all: planksAlong('#7a5230', 6, 4) }, x, top - 0.18, (z0 + z1) / 2, 0, Math.PI / 2, 0);
  // round-ish posts every 3 blocks, down to the lake bed
  for (let bz = DOCK.z0; bz <= DOCK.z1; bz += 3) for (const bx of [x0 + 0.2, x1 - 0.2]) {
    const bed = Math.min(heightAt(Math.floor(bx), bz), 1);
    const h = top + 0.25 - bed;
    k.box(0.3, h, 0.3, 0.13, { all: bark('#6a4a2a'), top: (f) => f.fill((x, y) => (Math.hypot(x - f.w / 2 + 0.5, y - f.h / 2 + 0.5) % 2 < 1 ? '#a07848' : '#8a6038')) }, bx, bed + h / 2, bz + 0.5);
  }
  // end rail, a cleat, a coil of rope and a bucket
  k.box(w, 0.14, 0.14, 0.06, { all: planksAlong('#8a5a34', 7) }, (x0 + x1) / 2, top + 0.35, z0 + 0.12);
  for (const x of [x0 + 0.15, x1 - 0.15]) k.box(0.16, 0.42, 0.16, 0.06, { all: bark('#6a4a2a') }, x, top + 0.2, z0 + 0.12);
  k.box(0.36, 0.12, 0.36, 0.15, { all: (f) => f.fill((x, y) => ((x + y) % 3 === 0 ? '#a08860' : '#d8c090')), top: (f) => f.fill((x, y) => (Math.hypot(x - f.w / 2, y - f.h / 2) % 3 < 1.2 ? '#a08860' : '#d8c090')) }, x1 - 0.5, top + 0.06, z0 + 3.2);
  k.box(0.3, 0.32, 0.3, 0.1, { all: (f) => f.fill((x, y) => (y === 2 || y === f.h - 3 ? '#5a5a58' : '#4a7ac0')), top: (f) => f.fill((x, y) => (Math.hypot(x - f.w / 2, y - f.h / 2) < f.w / 2 - 1.5 ? '#2a4a7a' : '#4a7ac0')) }, x0 + 0.45, top + 0.16, z0 + 9.4);
  return k.mesh('dock');
}

// ---------------------------------------------------------------- trees
// v1.8.1 tree redesign: more shape and texture, same soft-block look. Pines are five tiers, each a wide
// drooping skirt plus a smaller cap turned 45 degrees, darker at the bottom and lighter toward the tip, on
// a tapered trunk with root flares and a few cones. Leafy trees are a cluster of canopy blobs on a trunk
// with visible branches: oaks, apple trees (red fruit) and slim white birches. Spots inside `snowy` get
// snow-tipped pines. Low corner segments (seg 1) keep the triangle count near the old trees'.
const LOW = { seg: 1 };
const needleTex = (c, tierFromTop) => (f, side) => f.fill((x, y) => {
  if (side === 'top') return hash(x, y, 70) > 0.8 ? tone(c, 0.2) : (x + y) % 4 === 0 ? tone(c, 0.12) : tone(c, 0.06);
  if (side === 'bottom') return tone(c, -0.34);
  // drooping fronds: dark vertical strokes, a bright rim along the top, shadowed hem
  if (y < 2) return tone(c, 0.24 - tierFromTop * 0.02);
  if (y >= f.h - 2) return tone(c, -0.26);
  const col = (x + Math.floor(hash(Math.floor(x / 3), 0, 71) * 3)) % 4;
  if (col === 0) return tone(c, -0.16);
  if (hash(x, y, 72) > 0.9) return tone(c, 0.14);
  return col === 2 ? tone(c, 0.05) : c;
});
const snowTex = (c) => (f, side) => f.fill((x, y) => {
  if (side === 'top') return hash(x, y, 73) > 0.85 ? '#dfeaf2' : '#ffffff';
  if (side === 'bottom') return tone(c, -0.34);
  if (y < 2 + (hash(x, 0, 74) > 0.5 ? 1 : 0)) return hash(x, y, 75) > 0.7 ? '#e8f2f8' : '#ffffff';
  if (y >= f.h - 2) return tone(c, -0.26);
  return (x % 4 === 0) ? tone(c, -0.16) : c;
});
const barkTex = (c) => (f, side) => f.fill((x, y) => {
  if (side === 'top' || side === 'bottom') { const d = Math.hypot(x - f.w / 2 + 0.5, y - f.h / 2 + 0.5); return d < f.w / 2 - 1 ? (Math.floor(d) % 2 ? '#c8a070' : '#b08a58') : tone(c, -0.2); }
  // ridged bark with the odd knot
  if (x % 3 === 0) return tone(c, -0.2);
  if (hash(Math.floor(x / 3), Math.floor(y / 5), 76) > 0.9 && y % 5 < 2) return tone(c, -0.32);
  return hash(x, Math.floor(y / 3), 77) > 0.78 ? tone(c, 0.1) : c;
});
const birchTex = (f, side) => f.fill((x, y) => {
  if (side === 'top' || side === 'bottom') return '#d8c8a0';
  if (y % 7 === 3 && hash(Math.floor(x / 2), y, 78) > 0.35) return '#2a2420';
  if (hash(x, y, 79) > 0.93) return '#5a5048';
  return hash(x, Math.floor(y / 2), 80) > 0.7 ? '#e8e4dc' : '#f4f2ec';
});
// leaf clumps: 3x3 clusters, lit on the upper left, shaded on the lower right, varied in tone
const leafTex = (c, { autumn = false, fruit = null, light = 0 } = {}) => (f, side) => f.fill((x, y) => {
  if (side === 'bottom') return tone(c, -0.3);
  const cx = Math.floor(x / 3), cy = Math.floor(y / 3), lx = x % 3, ly = y % 3;
  const n = hash(cx, cy, 81);
  let base = n > 0.72 ? tone(c, 0.08) : n < 0.2 ? tone(c, -0.1) : c;
  if (autumn && n > 0.8) base = n > 0.9 ? '#e0a040' : '#d8843a';
  if (fruit && hash(cx, cy, 82) > 0.86 && lx === 1 && ly === 1) return fruit;
  if (fruit && hash(cx, cy, 82) > 0.86 && lx === 1 && ly === 0) return tone(fruit, 0.25);
  if (lx === 0 && ly === 0) return tone(base, 0.16 + light);
  if (lx === 2 && ly === 2) return tone(base, -0.16);
  if (side === 'top' && hash(x, y, 83) > 0.75) return tone(base, 0.12);
  return base;
});

export function softTrees(spots, extra, heightAt, { snowy = () => false } = {}) {
  const k = new Kit(2048, 20);
  const pineGreen = ['#2e6a3e', '#3a7a44', '#2a6040'];
  const roots = (t, c, r) => { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; t.box(0.18, 0.2, r, 0.07, { all: barkTex(c) }, Math.sin(a) * r * 0.42, 0.08, Math.cos(a) * r * 0.42, -0.35, a, 0, LOW); } };
  const pine = (v, snow) => k.template((t) => {
    const h = 1.5 + v * 0.45, trunk = '#6a4a2a';
    roots(t, trunk, 0.55);
    t.box(0.36, h * 0.6, 0.36, 0.1, { all: barkTex(trunk) }, 0, h * 0.3, 0, 0, 0, 0, LOW);
    t.box(0.26, h * 0.7, 0.26, 0.08, { all: barkTex(trunk) }, 0, h * 0.6 + h * 0.3, 0, 0, 0.3, 0, LOW);
    const tiers = 5, c0 = pineGreen[v];
    for (let i = 0; i < tiers; i++) {
      const s = 2.7 - i * 0.48 - v * 0.08, y = 1.05 + v * 0.3 + i * 0.72;
      const c = tone(c0, -0.08 + i * 0.05);
      const tex = snow ? snowTex(c) : needleTex(c, tiers - i);
      t.box(s, 0.5, s, Math.min(0.24, s * 0.18), { all: tex, top: tex }, 0, y, 0, 0, i % 2 ? Math.PI / 4 : 0.12, 0, LOW); // the skirt
      t.box(s * 0.7, 0.42, s * 0.7, Math.min(0.2, s * 0.14), { all: tex, top: tex }, 0, y + 0.34, 0, 0, i % 2 ? 0.12 : Math.PI / 4, 0, LOW); // the cap above it
    }
    const topY = 1.05 + v * 0.3 + tiers * 0.72;
    t.box(0.34, 0.55, 0.34, 0.12, { all: snow ? snowTex(c0) : needleTex(tone(c0, 0.18), 0) }, 0, topY + 0.05, 0, 0, Math.PI / 4, 0, LOW);
    t.box(0.12, 0.4, 0.12, 0.05, { all: needleTex(tone(c0, 0.22), 0) }, 0, topY + 0.45, 0, 0, 0, 0, LOW);
    // a few cones tucked under the lower skirts
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + v; t.box(0.11, 0.18, 0.11, 0.05, { all: (f) => f.fill((x, y) => ((x + y) % 2 ? '#7a5030' : '#5a3a20')) }, Math.sin(a) * 0.8, 1.0 + v * 0.3 + i * 0.6, Math.cos(a) * 0.8, 0, 0, 0, LOW); }
  });
  const leafy = (kind, v) => k.template((t) => {
    const birch = kind === 'birch', apple = kind === 'apple';
    const trunkC = birch ? '#efece4' : '#7a5a3a';
    const tex = birch ? () => birchTex : barkTex;
    const h = birch ? 2.2 + v * 0.3 : 1.4 + (v % 2) * 0.4;
    const tw = birch ? 0.28 : 0.44;
    roots(t, birch ? '#8a8070' : trunkC, birch ? 0.4 : 0.62);
    t.box(tw, h + 0.4, tw, 0.12, { all: tex(trunkC) }, 0, (h + 0.4) / 2, 0, 0, 0, 0, LOW);
    // branches reaching up into the canopy
    for (const [bx, bz, rz, rx] of [[0.32, 0.08, -0.75, 0], [-0.28, -0.12, 0.7, 0.2], [0.05, 0.3, 0, 0.75]]) t.box(0.15, 0.85, 0.15, 0.05, { all: tex(trunkC) }, bx, h + 0.05, bz, rx, 0, rz, LOW);
    const c = birch ? ['#8ab84a', '#9ac454', '#7aa844'][v] : apple ? ['#4f9a3a', '#5aa442', '#468e34'][v] : ['#5a9a3a', '#6aaa44', '#4f8e36'][v];
    const autumn = !birch && !apple && v === 2;
    const fruit = apple ? ['#d8282a', '#e8402a', '#c82040'][v] : null;
    const blobs = birch
      ? [[0, 0.9, 0, 1.6, 1.5, 1.5], [0.35, 1.85, -0.2, 1.2, 1.2, 1.1], [-0.4, 1.4, 0.35, 1.0, 1.0, 1.0], [0.1, 2.6, 0.1, 0.8, 0.8, 0.8]]
      : [[0, 0.95, 0, 2.6, 1.5, 2.5], [0.6, 1.75, -0.4, 1.7, 1.25, 1.6], [-0.75, 1.55, 0.55, 1.4, 1.1, 1.35], [0.15, 2.35, 0.3, 1.25, 0.95, 1.2], [-0.5, 0.75, -0.75, 1.2, 0.9, 1.1], [1.05, 0.9, 0.6, 1.0, 0.85, 1.0]];
    blobs.forEach(([x, y, z, w, hh, d], i) => {
      const cc = tone(c, (i % 3 - 1) * 0.05);
      const leaves = leafTex(cc, { autumn, fruit: i < 4 ? fruit : null, light: y > 2 ? 0.04 : 0 });
      t.box(w, hh, d, Math.min(0.5, Math.min(w, hh, d) * 0.36), { all: leaves, top: leaves, bottom: (f) => f.fill(tone(cc, -0.3)) }, x, h + y, z, 0, i * 0.7, 0, i === 0 ? undefined : LOW);
    });
  });
  const pines = [0, 1, 2].map((v) => pine(v, false));
  const snowPines = [0, 1, 2].map((v) => pine(v, true));
  const oaks = [0, 1, 2].map((v) => leafy('oak', v));
  const apples = [0, 1].map((v) => leafy('apple', v));
  const birches = [0, 1, 2].map((v) => leafy('birch', v));
  for (const s of spots) {
    const y = heightAt(s.x, s.z);
    const scale = 0.88 + (s.r % 7) * 0.04, ry = ((s.r >>> 4) % 8) * 0.785, v = (s.r >>> 3) % 3;
    const x = s.x + 0.5, z = s.z + 0.5;
    const snow = snowy(x, z);
    const pick = s.r % 10;
    if (pick < 6 || snow) k.stamp((snow ? snowPines : pines)[v], x, y, z, ry, scale);
    else if (pick < 8) k.stamp(oaks[v], x, y, z, ry, scale);
    else if (pick < 9) k.stamp(birches[v], x, y, z, ry, scale);
    else k.stamp(apples[v % 2], x, y, z, ry, scale);
  }
  for (const [kind, x, z, v] of extra) k.stamp((kind === 'pine' ? pines : oaks)[v % 3], x + 0.5, heightAt(x, z), z + 0.5, 0.4, 1);
  [...pines, ...snowPines, ...oaks, ...apples, ...birches].forEach((g) => g.dispose());
  return k.mesh('trees');
}

// v1.8.1 bushes in the same soft-block style: a few leafy blobs with clumped leaf texture, some with berries.
// `list` is [{ x, y, z, ry, s, berries }]; every vertex gets aBend (0 at the ground) for the wind shader.
export function softBushes(list) {
  const k = new Kit(1024, 22);
  const greens = ['#3f7d36', '#4a8a3a', '#356b2e', '#5a8f3c'];
  const berryCols = [null, '#c8283a', '#5a2a8a', '#e05a2a'];
  const shapes = [
    [[0, 0.32, 0, 1.0, 0.7, 0.95], [0.32, 0.55, 0.1, 0.62, 0.5, 0.6], [-0.3, 0.5, -0.15, 0.55, 0.45, 0.55]], // round
    [[0, 0.24, 0, 1.4, 0.48, 0.95], [0.4, 0.42, 0, 0.7, 0.42, 0.7], [-0.45, 0.36, 0.1, 0.62, 0.4, 0.6], [0, 0.55, -0.1, 0.5, 0.35, 0.5]], // low and wide
    [[0, 0.4, 0, 0.8, 0.85, 0.8], [0.2, 0.86, 0.05, 0.55, 0.5, 0.55], [-0.25, 0.45, 0.25, 0.5, 0.45, 0.5]], // tall
  ];
  const templates = new Map();
  const get = (si, gi, bi) => {
    const key = `${si}-${gi}-${bi}`;
    if (!templates.has(key)) {
      const geo = k.template((t) => {
        shapes[si].forEach(([x, y, z, w, h, d], i) => {
          const c = tone(greens[gi], (i % 2 ? 0.05 : -0.02));
          const tex = leafTex(c, { fruit: berryCols[bi] });
          t.box(w, h, d, Math.min(w, h, d) * 0.4, { all: tex, top: tex, bottom: (f) => f.fill(tone(c, -0.3)) }, x, y, z, 0, i * 0.8, 0, LOW);
        });
        // a few sprigs poking out of the top
        for (let i = 0; i < 3; i++) { const a = i * 2.1 + si; t.box(0.08, 0.28, 0.08, 0.03, { all: (f) => f.fill(tone(greens[gi], 0.15)) }, Math.sin(a) * 0.25, shapes[si][0][1] + shapes[si][0][4] * 0.5 + 0.08, Math.cos(a) * 0.25, Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4, LOW); }
      });
      const p = geo.attributes.position, bend = new Float32Array(p.count);
      for (let i = 0; i < p.count; i++) bend[i] = Math.max(0, Math.min(1, p.getY(i) / 1.2));
      geo.setAttribute('aBend', new THREE.BufferAttribute(bend, 1));
      templates.set(key, geo);
    }
    return templates.get(key);
  };
  for (const b of list) k.stamp(get(b.shape % 3, b.green % 4, b.berries), b.x, b.y, b.z, b.ry, b.s);
  for (const g of templates.values()) g.dispose();
  return k.mesh('bushes');
}

// ---------------------------------------------------------------- plants: reeds, flowers, mushrooms, fallen log
export function softPlants(reeds, flowers, log, heightAt) {
  const k = new Kit(256);
  const reed = k.template((t) => {
    for (const [x, z, h] of [[0, 0, 0.9], [0.18, 0.1, 0.7], [-0.12, 0.16, 0.8], [0.06, -0.18, 0.6]]) {
      t.box(0.05, h, 0.05, 0.02, { all: (f) => f.fill((px, py) => (py % 4 === 0 ? '#5a8a30' : '#6a9a3a')) }, x, h / 2, z, 0, 0, x * 0.4, { seg: 1 });
    }
    t.box(0.08, 0.22, 0.08, 0.035, { all: (f) => f.fill((x, y) => (y % 3 === 0 ? '#5a3418' : '#6a4020')) }, 0, 0.98, 0, 0, 0, 0, { seg: 1 });
    t.box(0.07, 0.18, 0.07, 0.03, { all: (f) => f.fill('#6a4020') }, -0.12, 0.88, 0.16, 0, 0, -0.05, { seg: 1 });
  });
  const flowerCols = ['#f0d040', '#f07090', '#a080e0', '#ffffff', '#f09040'];
  const flowerT = flowerCols.map((c) => k.template((t) => {
    t.box(0.04, 0.24, 0.04, 0.015, { all: (f) => f.fill('#4a8a3a') }, 0, 0.12, 0, 0, 0, 0, { seg: 1 });
    t.box(0.14, 0.06, 0.14, 0.03, { all: (f) => f.fill((x, y) => (Math.abs(x - f.w / 2 + 0.5) < 1 && Math.abs(y - f.h / 2 + 0.5) < 1 ? '#f8e070' : c)) }, 0, 0.26, 0, 0, 0.6, 0, { seg: 1 });
    t.box(0.1, 0.03, 0.05, 0.012, { all: (f) => f.fill('#5a9a3a') }, 0.05, 0.08, 0, 0, 0, 0.5, { seg: 1 });
  }));
  const shroom = k.template((t) => {
    t.box(0.07, 0.12, 0.07, 0.03, { all: (f) => f.fill('#f0e8d8') }, 0, 0.06, 0, 0, 0, 0, { seg: 1 });
    t.box(0.2, 0.09, 0.2, 0.045, { all: (f) => f.fill((x, y) => ((x * 3 + y * 5) % 7 === 0 ? '#f8f0e0' : '#c83a2a')), bottom: (f) => f.fill('#e8d0c0') }, 0, 0.15, 0, 0, 0, 0, { seg: 1 });
  });
  for (const r of reeds) {
    const by = Math.max(heightAt(r.x, r.z), 0);
    for (let i = 0; i < 2; i++) k.stamp(reed, r.x + 0.3 + i * 0.4, by, r.z + 0.4 + ((r.r >>> i) % 3) * 0.15, (r.r % 6) + i, 0.9 + (i * 0.15));
  }
  for (const f of flowers) {
    const y = heightAt(f.x, f.z);
    if (f.r % 7 === 0) { k.stamp(shroom, f.x + 0.5, y, f.z + 0.5, f.r % 5); k.stamp(shroom, f.x + 0.75, y, f.z + 0.3, 1, 0.7); continue; }
    k.stamp(flowerT[f.r % flowerT.length], f.x + 0.35, y, f.z + 0.5, f.r % 6);
    k.stamp(flowerT[(f.r + 2) % flowerT.length], f.x + 0.7, y, f.z + 0.25, 2, 0.85);
  }
  if (log) {
    const ring = (f) => f.fill((x, y) => { const d = Math.hypot(x - f.w / 2 + 0.5, y - f.h / 2 + 0.5); return d < f.w / 2 - 1.5 ? (Math.floor(d) % 2 ? '#c8a070' : '#b08a58') : '#5a3a20'; });
    k.box(4, 0.95, 0.95, 0.4, { all: bark('#6a4a2a'), right: ring, left: ring }, log.x + 2, log.y + 0.47, log.z + 0.5);
    k.box(0.3, 0.2, 0.3, 0.1, { all: (f) => f.fill('#5a9a3a') }, log.x + 1.4, log.y + 0.98, log.z + 0.45);
  }
  [reed, shroom, ...flowerT].forEach((g) => g.dispose());
  return k.mesh('plants', {}, false);
}

// ---------------------------------------------------------------- lily pads (separate meshes so they can bob)
export function softLilyPads(spots, WATER_Y) {
  const k = new Kit(256);
  const padTop = (shade) => (f) => {
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const u = (x + 0.5) / f.w - 0.5, v = (y + 0.5) / f.h - 0.5;
      const d = Math.hypot(u, v) * 2, ang = Math.atan2(u, v);
      if (d > 1 || (Math.abs(ang) < 0.3 && d > 0.12)) { f.px(x, y, 'clear'); continue; }
      f.px(x, y, d > 0.86 ? tone(shade, -0.2) : Math.abs(u) < 0.03 ? tone(shade, 0.15) : hash(x, y, 71) > 0.9 ? tone(shade, 0.08) : shade);
    }
  };
  const pads = ['#4a9a3a', '#5aaa44'].map((c) => softBox(k.atlas, 0.95, 0.05, 0.95, 0.02, { top: padTop(c), bottom: padTop(tone(c, -0.2)), all: (f) => f.fill('clear') }, { seg: 1, shade: false, D: 40 }));
  const flower = k.template((t) => {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; t.box(0.06, 0.04, 0.16, 0.02, { all: (f) => f.fill((x, y) => (y === 0 ? '#fcd8e4' : '#f8b0c8')) }, Math.cos(a) * 0.05, 0.08, Math.sin(a) * 0.05, 0.6, -a + Math.PI / 2, 0, { seg: 1 }); }
    t.box(0.06, 0.06, 0.06, 0.025, { all: (f) => f.fill('#f8e070') }, 0, 0.1, 0, 0, 0, 0, { seg: 1 });
  });
  const mat = atlasMaterial(k.atlas, { side: THREE.DoubleSide });
  const group = new THREE.Group();
  for (const s of spots) {
    const m = new THREE.Mesh(pads[s.r % 2], mat);
    m.position.set(s.x + 0.5, WATER_Y + 0.03, s.z + 0.5);
    m.rotation.y = (s.r % 8) * 0.7;
    m.userData.phase = (s.r % 100) / 16;
    if (s.r % 5 === 0) m.add(new THREE.Mesh(flower, mat));
    group.add(m);
  }
  group.name = 'lilypads';
  return group;
}

// ---------------------------------------------------------------- lanterns
export function softLanterns(posts) {
  const k = new Kit(256);
  const lamp = k.template((t) => {
    t.box(0.12, 1.45, 0.12, 0.045, { all: (f) => f.fill((x, y) => (y % 9 === 0 ? '#4a4a4a' : '#3a3a3a')) }, 0, 0.72, 0);
    t.box(0.22, 0.08, 0.22, 0.03, { all: (f) => f.fill('#2a2a2a') }, 0, 1.48, 0);
    for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) t.box(0.035, 0.3, 0.035, 0.012, { all: (f) => f.fill('#2a2a2a') }, x, 1.66, z, 0, 0, 0, { seg: 1 });
    t.box(0.34, 0.08, 0.34, 0.04, { all: (f) => f.fill('#2a2a2a') }, 0, 1.84, 0);
    t.box(0.12, 0.08, 0.12, 0.04, { all: (f) => f.fill('#2a2a2a') }, 0, 1.92, 0);
  });
  for (const p of posts) k.stamp(lamp, p.x, p.y, p.z);
  lamp.dispose();
  const frame = k.mesh('lanterns');
  // glowing panes: one shared basic material so the sky can dim/brighten every lamp at once
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffd890', transparent: true });
  const paneGeo = mergeGeometries(posts.map((p) => new THREE.BoxGeometry(0.22, 0.26, 0.22).translate(p.x, p.y + 1.66, p.z)));
  const panes = new THREE.Mesh(paneGeo, glowMat);
  const group = new THREE.Group();
  group.add(frame, panes);
  group.name = 'lanterns';
  return { group, glowMat };
}

// ---------------------------------------------------------------- campfire, notice board, boat rack
export function softCampfire(c, y) {
  const k = new Kit(512);
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    k.box(0.28, 0.2, 0.24, 0.09, { all: noisy('#8a8a86', 0.12, a) }, c.x + Math.cos(ang) * 0.72, y + 0.1, c.z + Math.sin(ang) * 0.72, 0, -ang, 0);
  }
  for (const r of [0.3, -0.5, 1.4]) k.box(0.9, 0.14, 0.14, 0.06, { all: bark('#5a3a20'), right: (f) => f.fill('#c8a070'), left: (f) => f.fill('#c8a070') }, c.x, y + 0.12, c.z, 0, r, 0.1);
  k.box(0.5, 0.05, 0.5, 0.03, { all: noisy('#2a2422', 0.15, 9) }, c.x, y + 0.03, c.z); // ash bed (the flames are live, see fire.js)
  // log benches
  const ring = (f) => f.fill((x, yy) => (Math.hypot(x - f.w / 2 + 0.5, yy - f.h / 2 + 0.5) % 2 < 1 ? '#c8a070' : '#b08a58'));
  for (const ox of [-2.25, 2.25]) k.box(0.42, 0.4, 1.75, 0.18, { all: bark('#7a5a3a'), front: ring, back: ring }, c.x + ox, y + 0.2, c.z + 0.12);
  return k.mesh('campfire');
}

export function softBoard(b, y) {
  const k = new Kit(512);
  for (const ox of [-1.3, 1.3]) k.box(0.14, 2.5, 0.14, 0.05, { all: bark('#6a4a2a') }, b.x + ox, y + 1.25, b.z);
  const face = (f) => {
    planksAlong('#b8875a', 5, 30)(f);
    const papers = [[3, 3, 9, 8, '#f6ebd3', '#c0392b'], [15, 5, 8, 9, '#f6ebd3', '#3a7ab8'], [26, 2, 10, 7, '#fff4c8', '#3a8a5a'], [8, 13, 7, 6, '#f6ebd3', '#e8a030'], [29, 11, 8, 8, '#f6ebd3', '#8a4aa0']];
    for (const [x, yy, w, h, c, pin] of papers) {
      f.rect(x, yy, w, h, c);
      for (let r = yy + 2; r < yy + h - 1; r += 2) f.rect(x + 1, r, w - 2 - (r % 3), 1, '#b8ac98');
      f.px(x + Math.floor(w / 2), yy, pin);
    }
  };
  k.box(2.8, 1.4, 0.12, 0.05, { front: face, all: planksAlong('#94683e') }, b.x, y + 1.7, b.z - 0.12);
  k.box(3.1, 0.12, 0.42, 0.05, { all: planksAcross('#7a3a2a', 4, 3) }, b.x, y + 2.5, b.z - 0.06, 0.15, 0, 0);
  return k.mesh('board');
}

export function softRack(r, y) {
  const k = new Kit(512);
  for (const ox of [-1.5, 1.5]) for (const oz of [-0.75, 0.75]) k.box(0.14, 1.5, 0.14, 0.05, { all: bark('#6a4a2a') }, r.x + ox, y + 0.75, r.z + oz);
  for (const oz of [-0.75, 0.75]) k.box(3.3, 0.14, 0.16, 0.05, { all: planksAlong('#7a5a3a', 5) }, r.x, y + 1.5, r.z + oz);
  const mesh = k.mesh('rack');
  // an upturned rowboat resting on the rack
  const boat = buildSoftBoat('boat_oak').mesh;
  boat.rotation.set(Math.PI, Math.PI / 2, 0);
  boat.scale.setScalar(0.82);
  boat.position.set(r.x, y + 2.05, r.z);
  const g = new THREE.Group();
  g.add(mesh, boat);
  return g;
}

// ---------------------------------------------------------------- lighthouse and ruins
export function softLighthouse(L, y) {
  // One solid, gently tapered tower turned on a lathe, with its red and white bands painted on in
  // pixels (no stacked blocks), sitting on a stone plinth, topped by a gallery, glass lantern room and dome.
  const cx = L.x + 0.25, cz = L.z + 0.25;
  const g = new THREE.Group();
  g.name = 'lighthouse';
  const px = (w, h, fn) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { x.fillStyle = fn(i, j); x.fillRect(i, j, 1, 1); }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const H = 8.2; // tower height
  // bands: 5 red, 4 white, with a little pixel weathering and a darker line where they meet
  const bandTex = px(48, 164, (i, j) => {
    const band = Math.floor(j / (164 / 9)), edge = j % Math.round(164 / 9) === 0;
    const base = band % 2 ? '#efe9dd' : '#c8443a';
    const n = hash(i, j, 7);
    if (edge) return band % 2 ? '#d8d0c2' : '#9e3029';
    return n > 0.93 ? tone(base, -0.07) : n < 0.05 ? tone(base, 0.05) : base;
  });
  // profile: a soft flare at the foot, a long gentle taper, a little lip under the gallery
  const prof = [];
  const rB = 1.45, rT = 0.98;
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    const r = rT + (rB - rT) * Math.pow(1 - k, 1.35) + (k < 0.06 ? (0.06 - k) * 2.2 : 0);
    prof.push(new THREE.Vector2(r, k * H));
  }
  prof.push(new THREE.Vector2(rT + 0.12, H + 0.04), new THREE.Vector2(0.01, H + 0.04));
  const towerGeo = new THREE.LatheGeometry(prof, 28);
  const tower = new THREE.Mesh(towerGeo, new THREE.MeshLambertMaterial({ map: bandTex }));
  tower.position.set(cx, y + 0.55, cz);
  tower.castShadow = true; tower.receiveShadow = true;
  // stone plinth
  const stoneTex = px(64, 8, (i, j) => { const brick = (i + (j % 4 < 2 ? 0 : 4)) % 8 === 0 || j % 4 === 3; return brick ? '#6f6c66' : hash(Math.floor(i / 8), Math.floor(j / 4), 3) > 0.6 ? '#9a968e' : '#8a867e'; });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.86, 0.6, 28), new THREE.MeshLambertMaterial({ map: stoneTex }));
  plinth.position.set(cx, y + 0.28, cz);
  plinth.receiveShadow = true; plinth.castShadow = true;
  // door and windows follow the curve of the wall
  const dark = new THREE.MeshLambertMaterial({ color: '#4a2c18' });
  const glassDark = new THREE.MeshLambertMaterial({ color: '#2a3a48', emissive: '#000000' });
  const trim = new THREE.MeshLambertMaterial({ color: '#f4efe4' });
  const onWall = (h, ang, w, hh, mat, depth = 0.08) => {
    const r = rT + (rB - rT) * Math.pow(1 - h / H, 1.35);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, depth), mat);
    m.position.set(cx + Math.sin(ang) * (r + 0.01), y + 0.55 + h, cz + Math.cos(ang) * (r + 0.01));
    m.rotation.y = ang;
    const tilt = Math.atan((rB - rT) / H) * 1.2; m.rotateX(-tilt);
    g.add(m);
    return m;
  };
  onWall(0.55, 0, 0.62, 1.0, dark); onWall(1.1, 0, 0.74, 0.1, trim);
  const winMats = [];
  for (const [h, a] of [[2.6, 0.5], [4.4, -0.7], [6.2, 0.9]]) { onWall(h, a, 0.36, 0.5, trim, 0.06); winMats.push(onWall(h, a, 0.26, 0.4, glassDark.clone(), 0.08).material); }
  // gallery: deck, railing posts and rail
  const iron = new THREE.MeshLambertMaterial({ color: '#2b2f33' });
  const deckY = y + 0.55 + H + 0.08;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.3, 0.16, 28), iron); deck.position.set(cx, deckY, cz);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.035, 4, 28), iron); rail.rotation.x = Math.PI / 2; rail.position.set(cx, deckY + 0.5, cz);
  const rail2 = rail.clone(); rail2.position.y = deckY + 0.25;
  g.add(deck, rail, rail2);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), iron); post.position.set(cx + Math.cos(a) * 1.36, deckY + 0.25, cz + Math.sin(a) * 1.36); g.add(post); }
  // lantern room: glass with iron mullions, then a domed copper cap, vent ball and finial
  const roomY = deckY + 0.08;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.05, 16, 1, true), new THREE.MeshLambertMaterial({ color: '#cfe8f0', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.set(cx, roomY + 0.6, cz); glass.renderOrder = 3;
  g.add(glass);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.06), iron); m.position.set(cx + Math.cos(a) * 0.72, roomY + 0.6, cz + Math.sin(a) * 0.72); g.add(m); }
  const sill = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.12, 16), iron); sill.position.set(cx, roomY + 0.06, cz);
  const copper = new THREE.MeshLambertMaterial({ color: '#c8443a' });
  const domePts = []; for (let i = 0; i <= 10; i++) { const k = i / 10; domePts.push(new THREE.Vector2(0.92 * Math.cos(k * Math.PI / 2) + 0.001, 0.72 * Math.sin(k * Math.PI / 2))); }
  const dome = new THREE.Mesh(new THREE.LatheGeometry(domePts, 20), copper); dome.position.set(cx, roomY + 1.12, cz);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), iron); ball.position.set(cx, roomY + 1.9, cz);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 6), iron); fin.position.set(cx, roomY + 2.2, cz);
  g.add(sill, dome, ball, fin, tower, plinth);
  g.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  g.userData.windows = winMats;
  return { mesh: g, lampY: roomY + 0.55 };
}

export function softRuins(pillars, arch) {
  const k = new Kit(1024);
  const bricks = (f) => stone('#6a7068')(f);
  const mossy = (f) => { stone('#6a7068')(f); for (let i = 0; i < f.w * 2; i++) { const x = Math.floor(hash(i, 3, 91) * f.w); f.px(x, 0, '#4a7a3a'); f.px(x, 1, hash(i, 4, 91) > 0.5 ? '#4a7a3a' : null); } };
  for (const p of pillars) {
    for (let i = 0; i < p.h; i++) k.box(0.92, 0.98, 0.92, 0.14, { all: i === p.h - 1 ? mossy : bricks }, p.x + 0.5, p.base + 0.5 + i, p.z + 0.5, 0, (i % 2) * 0.12, 0);
  }
  for (const b of arch) k.box(0.95, 0.5, 0.9, 0.16, { all: mossy }, b.x + 0.5, b.y + 0.25, b.z + 0.5, 0, b.r, 0.08);
  k.box(0.3, 0.2, 0.3, 0.06, { all: (f) => f.fill((x, y) => ((x + y) % 3 ? '#d0b040' : '#fff0a0')) }, arch[2].x + 0.5, arch[2].y + 0.6, arch[2].z + 0.3, 0, 0.6, 0);
  return k.mesh('ruins');
}

// ---------------------------------------------------------------- Lake Legends trophy board
// 3x5 pixel glyphs for painted lettering.
const GLYPHS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'], '>': ['#..', '.#.', '..#', '.#.', '#..'], ' ': ['...', '...', '...', '...', '...'],
};
function paintText(f, text, color, shadow, scale = 2) {
  const adv = 4 * scale;
  const w = text.length * adv - scale;
  let x0 = Math.floor((f.w - w) / 2);
  const y0 = Math.floor((f.h - 5 * scale) / 2);
  for (const ch of text) {
    const g = GLYPHS[ch] || GLYPHS[' '];
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) {
      if (g[gy][gx] !== '#') continue;
      if (shadow) f.rect(x0 + gx * scale + 1, y0 + gy * scale + 1, scale, scale, shadow);
      f.rect(x0 + gx * scale, y0 + gy * scale, scale, scale, color);
    }
    x0 += adv;
  }
}

export const TROPHY_SLOTS = [-1.12, 0, 1.12]; // local x of the three plaques (rank 2, 1, 3 order handled by caller)

// Built facing +z around a local origin at ground level; the caller places/rotates the group.
export function softTrophyBoard() {
  const k = new Kit(1024, 32);
  const felt = (f) => f.fill((x, y) => (hash(x, y, 77) > 0.86 ? '#2a5038' : hash(x, y, 78) > 0.9 ? '#3a6a4a' : '#30593f'));
  const frame = planksAlong('#6a4528', 6, 9);
  // posts with stone footings
  for (const ox of [-1.9, 1.9]) {
    k.box(0.22, 3.15, 0.22, 0.07, { all: bark('#5e3e22') }, ox, 1.58, 0);
    k.box(0.42, 0.28, 0.42, 0.1, { all: noisy('#8a8478', 0.1, 5) }, ox, 0.14, 0);
  }
  // backboard: wooden frame + green felt
  k.box(3.6, 1.85, 0.14, 0.06, { all: frame }, 0, 1.78, 0);
  k.box(3.28, 1.52, 0.06, 0.03, { front: felt, all: (f) => f.fill('#30593f') }, 0, 1.76, 0.08);
  // header sign with gold lettering
  k.box(2.7, 0.5, 0.12, 0.05, {
    front: (f) => { planksAlong('#4a2e18', 7, 4)(f); f.rect(1, 1, f.w - 2, 1, '#c8901a'); f.rect(1, f.h - 2, f.w - 2, 1, '#c8901a'); paintText(f, 'LAKE LEGENDS', '#f8d060', '#2a1808', 2); },
    all: planksAlong('#4a2e18', 7, 4),
  }, 0, 2.86, 0.06, 0, 0, 0, { D: 48 });
  // crossbeam + little shingled roof
  k.box(4.2, 0.16, 0.26, 0.06, { all: planksAlong('#6a4528', 5) }, 0, 3.12, 0);
  k.box(4.5, 0.12, 0.8, 0.05, { all: planksAcross('#8a3a2a', 4, 3), top: planksAcross('#9a4432', 4, 3) }, 0, 3.3, 0.12, 0.2, 0, 0);
  // plaques, medals, brass nameplates, pegs
  const medal = ['#c8ccd8', '#f2c040', '#c87a40']; // left = 2nd, middle = 1st, right = 3rd
  const label = ['2', '1', '3'];
  TROPHY_SLOTS.forEach((x, i) => {
    k.box(0.98, 0.7, 0.08, 0.06, {
      front: (f) => {
        f.fill((px, py) => (px < 2 || py < 2 || px >= f.w - 2 || py >= f.h - 2 ? '#6a3e1e' : hash(px, py, 31 + i) > 0.9 ? '#8a5228' : '#9a6234'));
        // faint fish silhouette for an empty slot
        const cx = f.w / 2, cy = f.h / 2;
        for (let py = 0; py < f.h; py++) for (let px = 0; px < f.w; px++) {
          const dx = (px - cx) / (f.w * 0.3), dy = (py - cy) / (f.h * 0.22);
          if (dx * dx + dy * dy < 1 || (px > cx + f.w * 0.26 && px < cx + f.w * 0.38 && Math.abs(py - cy) < (px - cx - f.w * 0.26) * 0.9)) f.px(px, py, '#875028');
        }
      },
      all: (f) => f.fill('#7a4a24'),
    }, x, 1.9, 0.13);
    k.box(0.22, 0.22, 0.06, 0.1, { front: (f) => { f.fill(medal[i]); f.rect(1, 1, f.w - 2, 1, tone(medal[i], 0.25)); paintText(f, label[i], tone(medal[i], -0.45), null, 1); }, all: (f) => f.fill(tone(medal[i], -0.15)) }, x - 0.36, 2.12, 0.19, 0, 0, 0, { D: 48 });
    k.box(0.74, 0.15, 0.04, 0.03, { all: (f) => f.fill((px, py) => (py === 0 ? '#f8e0a0' : hash(px, py, 5) > 0.85 ? '#b08830' : '#d8a840')) }, x, 1.27, 0.12);
    k.box(0.07, 0.07, 0.1, 0.03, { all: (f) => f.fill('#3a3a3a') }, x, 2.2, 0.2);
  });
  // a small sand-coloured step in front
  k.box(3.4, 0.12, 0.7, 0.05, { all: planksAcross('#b8875a', 4, 6) }, 0, 0.06, 0.55);
  return k.mesh('trophy-board');
}


// ---------------------------------------------------------------- Five Lakes Valley props
// Jetties: plank walkways out over a lake (rect in world blocks, `along` = long axis, `dir` = toward the water).
export function softJetties(jetties, heightAt) {
  // (v1.9.2: a turned jetty is built straight in its own frame, then turned about its land end)
  const straight = jetties.filter((j) => !j.rot), group = new THREE.Group();
  group.name = 'jetties';
  for (const j of jetties.filter((x) => x.rot)) {
    const pivot = j.pivot, plain = { ...j, rot: 0, dir: j.axisDir, end: { x: j.pivot.x + j.axisDir[0] * ((j.along === 'x' ? j.x1 - j.x0 : j.z1 - j.z0)), z: j.pivot.z + j.axisDir[1] * ((j.along === 'x' ? j.x1 - j.x0 : j.z1 - j.z0)) } };
    const m = softJetties([plain], heightAt);
    m.position.set(-pivot.x, 0, -pivot.z);
    const holder = new THREE.Group(); holder.position.set(pivot.x, 0, pivot.z); holder.rotation.y = j.rot; holder.add(m);
    group.add(holder);
  }
  if (!straight.length) return group.children.length ? group : new THREE.Group();
  const k = new Kit(2048);
  for (const j of straight) {
    const w = j.x1 - j.x0, d = j.z1 - j.z0, top = j.deckY;
    const cx = (j.x0 + j.x1) / 2, cz = (j.z0 + j.z1) / 2;
    const alongX = j.along === 'x';
    k.box(w, 0.2, d, 0.05, { top: alongX ? planksAcross('#b8875a', 5, 7) : planksAlong('#b8875a', 5, 7), all: planksAlong('#94683e', 4, 3) }, cx, top - 0.1, cz);
    const len = alongX ? w : d;
    for (let t = 0.5; t < len; t += 2.5) for (const side of [-1, 1]) {
      const px = alongX ? j.x0 + t : cx + side * (w / 2 - 0.2);
      const pz = alongX ? cz + side * (d / 2 - 0.2) : j.z0 + t;
      const bed = Math.max(-2.5, Math.min(heightAt(Math.floor(px), Math.floor(pz)), 1)); // deep lakes: posts end out of sight below the surface
      const h = top + 0.25 - bed;
      k.box(0.26, h, 0.26, 0.11, { all: bark('#6a4a2a') }, px, bed + h / 2, pz);
    }
    // end rail at the water end (lantern posts come from the lantern builder)
    const ex = j.end.x, ez = j.end.z;
    const rx = alongX ? ex - j.dir[0] * 0.15 : cx, rz = alongX ? cz : ez - j.dir[1] * 0.15;
    k.box(alongX ? 0.14 : w, 0.14, alongX ? d : 0.14, 0.06, { all: planksAlong('#8a5a34', 7) }, rx, top + 0.35, rz);
  }
  const mesh = k.mesh('jetties');
  if (!group.children.length) return mesh;
  group.add(mesh);
  return group;
}

// Arched footbridge (runs along z) with rails; boats row underneath.
export function softBridge(B, yAt, groundAt = null) {
  const k = new Kit(2048);
  const cx = (B.x0 + B.x1) / 2, w = B.x1 - B.x0;
  const steps = Math.ceil((B.z1 - B.z0) / 0.5);
  for (let i = 0; i < steps; i++) {
    const z = B.z0 + (i + 0.5) * ((B.z1 - B.z0) / steps);
    const y = yAt(cx, z);
    const y2 = yAt(cx, z + 0.5), slope = Math.atan2(y2 - y, 0.5);
    k.box(w, 0.16, 0.52, 0.04, { top: planksAcross('#b07a48', 6, 12), all: planksAlong('#8a5a34', 4, 2) }, cx, y - 0.08, z, -slope, 0, 0);
    if (i % 3 === 0) for (const side of [-1, 1]) k.box(0.12, 0.7, 0.12, 0.05, { all: bark('#5e3e22') }, cx + side * (w / 2 - 0.06), y + 0.3, z);
    // v1.8.2: posts only at the two ends, down onto the banks; nothing in between (boats row clean under)
    if (groundAt && (i === 1 || i === steps - 2)) {
      const gy = Math.min(...[-1, 1].map((sd) => groundAt(cx + sd * (w / 2 - 0.2), z)));
      const len = y - 0.16 - gy;
      if (len > 0.05) for (const side of [-1, 1]) k.box(0.24, len + 0.3, 0.24, 0.06, { all: bark('#4e3420') }, cx + side * (w / 2 - 0.2), gy - 0.3 + (len + 0.3) / 2, z);
    }
    // a curved beam under each edge of the arch, so the span reads as one self-supporting bow
    for (const side of [-1, 1]) k.box(0.16, 0.22, 0.52, 0.04, { all: bark('#5a3a20') }, cx + side * (w / 2 - 0.12), y - 0.27, z, -slope, 0, 0);
  }
  // rails
  for (const side of [-1, 1]) for (let i = 0; i < steps; i += 1) {
    const z = B.z0 + (i + 0.5) * ((B.z1 - B.z0) / steps), y = yAt(cx, z), y2 = yAt(cx, z + 0.5);
    k.box(0.1, 0.1, 0.54, 0.04, { all: planksAlong('#7a5230', 5) }, cx + side * (w / 2 - 0.06), y + 0.62, z, -Math.atan2(y2 - y, 0.5), 0, 0);
  }
  return k.mesh('bridge');
}

// A small log hut: w x d footprint centred on (x, z), facing `ry` (door on local +z).
// Log-textured triangular gables at both ends of a hut (ridge along x), from the wall top up to the roof.
function gables(w, d, wh, rise, wall) {
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 30;
  const cx = cv.getContext('2d');
  for (let yy = 0; yy < 30; yy++) { const r = yy % 6; cx.fillStyle = r === 5 ? tone(wall, -0.3) : r === 0 ? tone(wall, 0.12) : wall; cx.fillRect(0, yy, 16, 1); }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1 / 1.9, 1 / 1.9); tex.colorSpace = THREE.SRGBColorSpace;
  const shape = new THREE.Shape([new THREE.Vector2(-d / 2 + 0.02, 0), new THREE.Vector2(d / 2 - 0.02, 0), new THREE.Vector2(0, rise)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
  geo.rotateY(Math.PI / 2); // the triangle stands across z; its thickness runs along x
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  const grp = new THREE.Group();
  for (const s of [-1, 1]) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(s > 0 ? w / 2 - 0.2 : -w / 2 + 0.02, wh - 0.02, 0);
    mesh.castShadow = true; mesh.receiveShadow = true;
    grp.add(mesh);
  }
  return grp;
}

export function softHut(H, y) {
  const k = new Kit(1024);
  const { w, d } = H;
  const logs = (c) => (f) => f.fill((x, yy) => (yy % 6 === 5 ? tone(c, -0.3) : yy % 6 === 0 ? tone(c, 0.12) : hash(Math.floor(x / 5), Math.floor(yy / 6), 3) > 0.8 ? tone(c, -0.08) : c));
  const wall = H.wall || '#8a5a32';
  const wh = H.h || 2.4;
  k.box(w, wh, d, 0.18, {
    all: logs(wall),
    front: (f) => {
      logs(wall)(f);
      const dw = Math.floor(f.w * 0.22), dh = Math.floor(f.h * 0.62);
      f.rect(Math.floor((f.w - dw) / 2), f.h - dh, dw, dh, '#5a361e');
      f.rect(Math.floor((f.w - dw) / 2) + 2, f.h - dh + 2, dw - 4, dh - 2, '#6a4024');
      f.px(Math.floor((f.w + dw) / 2) - 4, f.h - Math.floor(dh / 2), '#f2c040');
      for (const wx of [0.16, 0.7]) { const x0 = Math.floor(f.w * wx), ww = Math.floor(f.w * 0.14); f.rect(x0, Math.floor(f.h * 0.25), ww, Math.floor(f.h * 0.3), '#3a2a1a'); f.rect(x0 + 1, Math.floor(f.h * 0.25) + 1, ww - 2, Math.floor(f.h * 0.3) - 2, '#ffe0a0'); }
    },
  }, 0, wh / 2, 0);
  const roofC = H.roof || '#a8452e';
  const shingles = (f) => f.fill((x, yy) => (yy % 4 === 3 ? tone(roofC, -0.3) : (x + Math.floor(yy / 4) * 3) % 7 === 0 ? tone(roofC, -0.2) : hash(Math.floor(x / 3), Math.floor(yy / 4), 5) > 0.8 ? tone(roofC, 0.1) : roofC));
  const pitch = 0.55, half = d / 2 + 0.4, slab = half / Math.cos(pitch);
  for (const s of [-1, 1]) k.box(w + 0.6, 0.16, slab, 0.06, { top: shingles, all: (f) => f.fill(tone(roofC, -0.35)) }, 0, wh + Math.tan(pitch) * half / 2 + 0.05, s * half / 2, s * pitch, 0, 0);
  // v1.8.2: triangular gable ends, flush under the roof (they were rectangles poking through it)
  if (H.chimney) k.box(0.5, 1.4, 0.5, 0.12, { all: stone('#7a746c') }, w * 0.3, wh + 1.1, -d * 0.15);
  if (H.sign) {
    k.box(Math.min(w * 0.8, H.sign.length * 0.2 + 0.4), 0.42, 0.08, 0.04, { front: (f) => { planksAlong('#4a2e18', 7, 4)(f); paintText(f, H.sign, '#f8d060', '#2a1808', 2); }, all: planksAlong('#4a2e18', 7, 4) }, 0, wh - 0.27, d / 2 + 0.07, 0, 0, 0, { D: 48 }); // v1.9: on the wall under the eaves, where the roof can't hide it
  }
  // porch step + barrel
  k.box(w * 0.5, 0.16, 0.7, 0.05, { all: planksAcross('#94683e', 5, 3) }, 0, 0.08, d / 2 + 0.35);
  k.box(0.5, 0.7, 0.5, 0.2, { all: (f) => f.fill((x, yy) => (yy === 2 || yy === f.h - 3 ? '#4a4a48' : x % 5 === 0 ? '#6a4628' : '#8a5a32')) }, w / 2 + 0.4, 0.35, d / 2 - 0.3);
  const m = k.mesh(H.name || 'hut');
  const g = new THREE.Group();
  g.add(m);
  g.add(gables(w, d, wh, Math.tan(pitch) * half - 0.1, wall)); // apex just under the ridge, edges under the roof slope
  g.position.set(H.x, y, H.z);
  g.rotation.y = H.ry || 0;
  return g;
}

// Trail signpost: a post with one or two arrow boards, lettering painted on.
export function softSignposts(posts) {
  const k = new Kit(1024, 32);
  for (const p of posts) {
    k.box(0.18, 2.7, 0.18, 0.06, { all: bark('#5e3e22') }, p.x, p.y + 1.35, p.z); // v1.8.2: taller, boards up out of the way
    p.boards.forEach((b, i) => {
      const len = Math.max(1.1, (b.text.length + 2) * 0.17 + 0.4);
      const paint = (f) => { planksAlong('#b8875a', 6, 9 + i)(f); paintText(f, `${b.text} >`, '#3a2414', null, 2); };
      const ox = Math.cos(b.yaw) * (len / 2 - 0.05), oz = -Math.sin(b.yaw) * (len / 2 - 0.05);
      k.box(len, 0.34, 0.07, 0.05, { front: paint, back: (f) => { planksAlong('#b8875a', 6, 9 + i)(f); paintText(f, `< ${b.text}`, '#3a2414', null, 2); }, all: planksAlong('#94683e', 5, 4) }, p.x + ox, p.y + 2.3 - i * 0.42, p.z + oz, 0, b.yaw, 0, { D: 48 });
    });
  }
  return k.mesh('signposts');
}

// A canvas tent for Fern Camp.
export function softTent(T, y) {
  const k = new Kit(512);
  const cloth = (f) => f.fill((x, yy) => (x % 8 === 0 ? tone(T.color, -0.15) : hash(x, yy, 9) > 0.92 ? tone(T.color, 0.1) : T.color));
  for (const s of [-1, 1]) k.box(1.9, 0.08, 1.5, 0.03, { all: cloth }, 0, 0.62, s * 0.5, s * 0.85, 0, 0);
  k.box(0.08, 1.2, 0.08, 0.03, { all: bark('#5e3e22') }, 0, 0.6, 0);
  const m = k.mesh('tent');
  const g = new THREE.Group(); g.add(m); g.position.set(T.x, y, T.z); g.rotation.y = T.ry || 0;
  return g;
}

// ---------------------------------------------------------------- camp chairs on the banks
// Folding camp chairs: wooden frame, striped canvas seat and back, armrests. Built once per colour as a
// template at the origin (facing +z), then stamped at each spot. Some get a little tackle box beside them.
export function softChairs(list) {
  const k = new Kit(1024);
  const COLORS = ['#3a7ab8', '#c0392b', '#3a8a5a', '#e8a030', '#8a4aa0'];
  const wood = (f) => f.fill((x, y) => (hash(x, Math.floor(y / 3), 77) > 0.8 ? '#9a6a3e' : '#7a5230'));
  const canvas = (c) => (f) => f.fill((x) => (Math.floor(x / 3) % 2 ? c : '#efe6d2'));
  const temps = COLORS.map((col) => k.template((t) => {
    for (const sx of [-0.29, 0.29]) {
      for (const sz of [-0.2, 0.2]) t.box(0.05, 0.25, 0.05, 0.015, { all: wood }, sx, 0.125, sz);
      t.box(0.06, 0.04, 0.5, 0.015, { all: wood }, sx * 1.12, 0.44, 0.02);          // armrest
      t.box(0.04, 0.2, 0.04, 0.01, { all: wood }, sx * 1.12, 0.34, 0.22);            // armrest post
      t.box(0.04, 0.62, 0.04, 0.01, { all: wood }, sx, 0.52, -0.27, -0.26);          // back upright
    }
    t.box(0.62, 0.05, 0.46, 0.02, { all: canvas(col), bottom: canvas(tone(col, -0.2)) }, 0, 0.24, 0);
    t.box(0.58, 0.46, 0.035, 0.015, { all: canvas(col), back: canvas(tone(col, -0.2)) }, 0, 0.55, -0.28, -0.26);
    t.box(0.62, 0.04, 0.04, 0.01, { all: wood }, 0, 0.06, 0.2);                       // foot rail
  }));
  const tackle = k.template((t) => {
    t.box(0.34, 0.18, 0.22, 0.03, { all: noisy('#3d7a52', 0.08, 5), top: (f) => f.fill('#4c8e63') }, 0, 0.09, 0);
    t.box(0.2, 0.04, 0.04, 0.01, { all: (f) => f.fill('#d8d0b8') }, 0, 0.21, 0);
  });
  list.forEach((c, i) => {
    k.stamp(temps[(i * 3 + (c.area?.length || 0)) % temps.length], c.x, c.y, c.z, c.yaw);
    if (i % 3 === 0) k.stamp(tackle, c.x + Math.cos(c.yaw) * 0.55, c.y, c.z - Math.sin(c.yaw) * 0.55, c.yaw + 0.4);
  });
  return k.mesh('chairs');
}

// shared with dressing.js (per-lake set dressing)
export { Kit, noisy, planksAlong, planksAcross, bark, stone };
