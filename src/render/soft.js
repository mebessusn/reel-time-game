// Soft-block rendering kit: analytically rounded boxes whose six faces are painted, pixel by pixel, into a
// canvas atlas (Closest filtering keeps the 16-bit pixels crisp on the soft shapes). Shared by characters,
// fish, boats, props and terrain decorations. Mirrors scripts/blender/softchar.py (the Blender look-dev).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const D = 32; // texels per world unit: the "16-bit" pixel density

// ---------------------------------------------------------------- colour helpers
const _a = new THREE.Color(), _b = new THREE.Color();
const toneCache = new Map(), mixCache = new Map(), rgbCache = new Map();
export function tone(hex, k) { // k > 0 lighter, k < 0 darker
  const key = hex + k;
  let v = toneCache.get(key);
  if (v) return v;
  _a.set(hex);
  if (k > 0) _a.lerp(_b.set('#ffffff'), k); else _a.lerp(_b.set('#1a1020'), -k);
  v = `#${_a.getHexString()}`;
  toneCache.set(key, v);
  return v;
}
export function mix(h1, h2, k) {
  const key = h1 + h2 + k;
  let v = mixCache.get(key);
  if (v) return v;
  _a.set(h1).lerp(_b.set(h2), k);
  v = `#${_a.getHexString()}`;
  mixCache.set(key, v);
  return v;
}
function rgbOf(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    const h = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;
    v = h.length === 3 ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)] : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    rgbCache.set(hex, v);
  }
  return v;
}
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1274126177) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- atlas + painter
// Pixels live in a plain RGBA buffer (rows stored bottom-up so it uploads straight into a DataTexture).
export class Atlas {
  constructor(size = 256) {
    this.size = size;
    this.data = new Uint8Array(size * size * 4);
    this.x = 1; this.y = 1; this.rowH = 0;
  }
  alloc(w, h) {
    if (this.x + w + 2 > this.size) { this.x = 1; this.y += this.rowH + 2; this.rowH = 0; }
    if (this.y + h + 1 > this.size) throw new Error(`soft atlas full (${this.size}px)`);
    const r = { x: this.x, y: this.y, w, h };
    this.x += w + 2; this.rowH = Math.max(this.rowH, h);
    return r;
  }
  /** byte offset of atlas pixel (x, y) with y measured down from the top */
  idx(x, y) { return ((this.size - 1 - y) * this.size + x) * 4; }
}

// Paints one face region. Coordinates are face-local pixels, y down from the top edge.
export class Face {
  constructor(atlas, r) { this.a = atlas; this.r = r; this.w = r.w; this.h = r.h; this.d = atlas.data; }
  px(x, y, c) {
    if (c == null || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = this.a.idx(this.r.x + x, this.r.y + y);
    if (c === 'clear') { this.d[i + 3] = 0; return; }
    const v = rgbOf(c);
    this.d[i] = v[0]; this.d[i + 1] = v[1]; this.d[i + 2] = v[2]; this.d[i + 3] = 255;
  }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c); }
  fill(fn) {
    const f = typeof fn === 'function';
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.px(x, y, f ? fn(x, y) : fn);
  }
  // Gutter: copy edge pixels one texel outward so nearest sampling never bleeds into a neighbour.
  gutter() {
    const { x, y, w, h } = this.r, a = this.a, d = this.d;
    const cp = (sx, sy, dx, dy) => { const s = a.idx(sx, sy), t = a.idx(dx, dy); d[t] = d[s]; d[t + 1] = d[s + 1]; d[t + 2] = d[s + 2]; d[t + 3] = d[s + 3]; };
    for (let i = 0; i < w; i++) { cp(x + i, y, x + i, y - 1); cp(x + i, y + h - 1, x + i, y + h); }
    for (let j = -1; j <= h; j++) { cp(x, y + j, x - 1, y + j); cp(x + w - 1, y + j, x + w, y + j); }
  }
}

const SIDES = ['right', 'left', 'top', 'bottom', 'front', 'back'];

/**
 * A rounded box whose six faces are painted into the atlas.
 * paint: { front, back, left, right, top, bottom, all } — each (face, side) => void. Missing faces use `all`.
 * opts: { D: texel density override, seg: corner segments, shade: false to skip baked shading }
 */
export function softBox(atlas, w, h, d, radius, paint, opts = {}) {
  const dims = {
    front: [w, h], back: [w, h], right: [d, h], left: [d, h], top: [w, d], bottom: [w, d],
  };
  const regions = {};
  const dens = opts.D || D;
  for (const s of SIDES) {
    const [fw, fh] = dims[s];
    const r = atlas.alloc(Math.max(2, Math.round(fw * dens)), Math.max(2, Math.round(fh * dens)));
    regions[s] = r;
    const f = new Face(atlas, r);
    (paint[s] || paint.all)?.(f, s);
    if (opts.shade !== false) edgeShade(f, s);
    f.gutter();
  }
  const g = new RoundedBoxGeometry(w, h, d, opts.seg ?? 2, radius);
  const pos = g.attributes.position.array;
  const uv = g.attributes.uv.array;
  const per = pos.length / 6;
  const S = atlas.size;
  const cl = (v) => Math.min(0.999, Math.max(0.001, v));
  for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) {
    const side = SIDES[Math.floor(i / per)];
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    let u, v;
    switch (side) {
      case 'front': u = (x + w / 2) / w; v = (y + h / 2) / h; break;
      case 'back': u = (w / 2 - x) / w; v = (y + h / 2) / h; break;
      case 'right': u = (d / 2 - z) / d; v = (y + h / 2) / h; break;
      case 'left': u = (z + d / 2) / d; v = (y + h / 2) / h; break;
      case 'top': u = (x + w / 2) / w; v = (d / 2 - z) / d; break;
      default: u = (x + w / 2) / w; v = (z + d / 2) / d;
    }
    const r = regions[side];
    uv[j] = (r.x + cl(u) * r.w) / S;
    uv[j + 1] = 1 - (r.y + (1 - cl(v)) * r.h) / S;
  }
  g.attributes.uv.needsUpdate = true;
  return g;
}

// Soft baked shading: a gentle top-to-bottom gradient and darker rims, the 16-bit "ramp" look.
export function edgeShade(f, side) {
  const d = f.d, a = f.a;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const i = a.idx(f.r.x + x, f.r.y + y);
    if (d[i + 3] === 0) continue;
    let k = 1;
    if (side !== 'top' && side !== 'bottom') k *= 1.04 - 0.12 * (y / Math.max(1, f.h - 1));
    const edge = x === 0 || y === 0 || x === f.w - 1 || y === f.h - 1;
    if (edge) k *= side === 'top' ? 0.96 : 0.9;
    if (side === 'bottom') k *= 0.82;
    d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
  }
}

/** Nearest-filtered sRGB texture straight from an atlas buffer. */
export function atlasTexture(atlas) {
  const tex = new THREE.DataTexture(atlas.data, atlas.size, atlas.size, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Texture + Lambert material for an atlas (alpha-tested so painted cut-outs work). */
export function atlasMaterial(atlas, opts = {}) {
  return new THREE.MeshLambertMaterial({ map: atlasTexture(atlas), alphaTest: 0.5, ...opts });
}

export function place(geo, x, y, z) { const m = new THREE.Mesh(geo); m.position.set(x, y, z); return m; }

/**
 * Any geometry with 0..1 UVs, painted into its own atlas region (pw x ph pixels).
 * paint(face) paints it; v = 1 is the top row of the region.
 */
export function atlasGeo(atlas, geo, pw, ph, paint, opts = {}) {
  const r = atlas.alloc(pw, ph);
  const f = new Face(atlas, r);
  paint(f);
  if (opts.shade) edgeShade(f, 'front');
  f.gutter();
  const uv = geo.attributes.uv.array, S = atlas.size;
  const cl = (v) => Math.min(0.999, Math.max(0.001, v));
  for (let j = 0; j < uv.length; j += 2) {
    uv[j] = (r.x + cl(uv[j]) * r.w) / S;
    uv[j + 1] = 1 - (r.y + (1 - cl(uv[j + 1])) * r.h) / S;
  }
  geo.attributes.uv.needsUpdate = true;
  return geo;
}

/**
 * A lathe (hat, skirt, dome) painted in bands. prof: [[r, y, key], ...] from the first point to the last;
 * segment k (point k to k+1) is painted with paint(key of point k, x, rowInSegment, k).
 * opts: { segs, rps (rows per segment), pw (pixels round), deform(v: Vector3) }
 */
export function latheGeo(atlas, prof, paint, opts = {}) {
  const segs = opts.segs || 18, rps = opts.rps || 3, pw = opts.pw || 48;
  const pts = prof.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y));
  const geo = new THREE.LatheGeometry(pts, segs);
  const n = prof.length - 1;
  atlasGeo(atlas, geo, pw, n * rps, (f) => f.fill((x, y) => {
    const k = n - 1 - Math.floor(y / rps); // v = 1 (top row) is the last point
    return paint(prof[k][2], x, rps - 1 - (y % rps), k);
  }));
  if (opts.deform) {
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); opts.deform(v); p.setXYZ(i, v.x, v.y, v.z); }
  }
  geo.computeVertexNormals();
  return geo;
}
