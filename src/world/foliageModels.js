// Foliage models (v1.13.13): trees, bushes, ferns, grass, reeds, flowers, mushrooms and lily pads modelled in Blender
// by art/src/foliage.py (art/foliage.blend) and shipped as src/data/foliageMesh.js. Each model is grid parts like
// the fish: positions, a tint per vertex and a UV inside one region of the painted atlas (foliageAtlas.js).
// Leaf cards get normals bent outward from the plant's middle, so a canopy shades like a round mass of leaves
// rather than a pile of flat cards.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FOLIAGE_MESH } from '../data/foliageMesh.js';
import { REGIONS, FOLIAGE_ATLAS, paintFoliageAtlas } from './foliageAtlas.js';

const ALPHA = Array.from({ length: 92 }, (_, i) => String.fromCharCode(35 + i)).filter((c) => c !== '\\').join('');
const IDX = new Map([...ALPHA].map((c, i) => [c, i]));
const LEAFY = new Set(['leaves', 'needles', 'curtain', 'frond', 'blades', 'reeds', 'flowers']);

function decodeDeltas(str, n) {
  const out = new Int32Array(n);
  let i = 0;
  for (let k = 0; k < n; k++) {
    const ch = str[i++];
    const d = ch === '~' ? (i += 2, IDX.get(str[i - 2]) * 91 + IDX.get(str[i - 1]) - 4096) : IDX.get(ch) - 44;
    out[k] = d + (k >= 3 ? out[k - 3] : 0);
  }
  return out;
}

function buildPart(part, data, pal, centre) {
  const R = part.r, C = part.c, n = R * C;
  const raw = decodeDeltas(part.p, n * 3), q = data.q, b = data.min;
  const [rx, ry, rw, rh] = REGIONS[part.g] || REGIONS.stem, S = FOLIAGE_ATLAS;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let v = 0; v < n; v++) {
    pos[v * 3] = b[0] + raw[v * 3] * q; pos[v * 3 + 1] = b[1] + raw[v * 3 + 1] * q; pos[v * 3 + 2] = b[2] + raw[v * 3 + 2] * q;
    const c = pal[IDX.get(part.k[v])]; col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
    const u = IDX.get(part.t[v * 2]) / 90, w = IDX.get(part.t[v * 2 + 1]) / 90;
    // inset from the region's edges so shrunk (mipmapped) texture never borrows from the next region
    const m = Math.min(4, rw * 0.06, rh * 0.06);
    uv[v * 2] = (rx + m + u * (rw - 2 * m)) / S; uv[v * 2 + 1] = 1 - (ry + m + (1 - w) * (rh - 2 * m)) / S;
  }
  const idx = [];
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) { const a = i * C + j, bb = a + 1, c = a + C + 1, d = a + C; idx.push(a, bb, c, a, c, d); }
  let P = pos, Cl = col, U = uv;
  if (part.c1) { // close the tube's top
    const row = R - 1, ring = C - 1; let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < ring; j++) { const v = row * C + j; cx += pos[v * 3]; cy += pos[v * 3 + 1]; cz += pos[v * 3 + 2]; }
    P = new Float32Array((n + 1) * 3); P.set(pos); P.set([cx / ring, cy / ring, cz / ring], n * 3);
    Cl = new Float32Array((n + 1) * 3); Cl.set(col); Cl.set(col.slice((row * C) * 3, (row * C) * 3 + 3), n * 3);
    U = new Float32Array((n + 1) * 2); U.set(uv); U.set(uv.slice((row * C) * 2, (row * C) * 2 + 2), n * 2);
    for (let j = 0; j < ring; j++) idx.push(n, row * C + j + 1, row * C + j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(Cl, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if (LEAFY.has(part.n) && centre) { // round the canopy's shading: normals mostly point away from the plant's middle
    const N = geo.attributes.normal, p = geo.attributes.position;
    for (let v = 0; v < N.count; v++) {
      let x = p.getX(v) - centre.x, y = (p.getY(v) - centre.y) * 1.3 + 0.35, z = p.getZ(v) - centre.z;
      const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      const nx = N.getX(v) * 0.25 + x * 0.75, ny = N.getY(v) * 0.25 + y * 0.75, nz = N.getZ(v) * 0.25 + z * 0.75, m = Math.hypot(nx, ny, nz) || 1;
      N.setXYZ(v, nx / m, ny / m, nz / m);
    }
  }
  return geo;
}

const cache = new Map();
/** One plant as an indexed geometry (position, normal, color, uv), standing on y = 0. */
export function foliageGeometry(name) {
  if (cache.has(name)) return cache.get(name);
  const data = FOLIAGE_MESH[name];
  if (!data) throw new Error(`foliage model ${name} missing`);
  const pal = data.pal.map((h) => { const c = new THREE.Color(h); return { r: c.r * 1.25, g: c.g * 1.25, b: c.b * 1.25 }; });
  // the plant's middle: halfway up its leaves
  let lo = 1e9, hi = -1e9, sx = 0, sz = 0, cnt = 0;
  const geos = data.parts.map((part) => buildPart(part, data, pal, null));
  data.parts.forEach((part, i) => { if (!LEAFY.has(part.n)) return; const p = geos[i].attributes.position; for (let v = 0; v < p.count; v++) { const y = p.getY(v); lo = Math.min(lo, y); hi = Math.max(hi, y); sx += p.getX(v); sz += p.getZ(v); cnt++; } });
  geos.forEach((g) => g.dispose());
  const centre = cnt ? new THREE.Vector3(sx / cnt, (lo + hi) / 2, sz / cnt) : null;
  const geo = mergeGeometries(data.parts.map((part) => buildPart(part, data, pal, centre)), false);
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  cache.set(name, geo);
  return geo;
}

let material = null;
/** The one material every plant shares (the painted atlas, vertex tints, leaf outlines cut by alpha). */
export function foliageMaterial() {
  if (material) return material;
  const map = paintFoliageAtlas();
  material = new THREE.MeshLambertMaterial({ map, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide });
  return material;
}
export const FOLIAGE_NAMES = Object.keys(FOLIAGE_MESH);
