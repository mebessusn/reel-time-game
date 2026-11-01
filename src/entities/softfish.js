// Fish models (v1.13.12): every species modelled in Blender by art/src/fish.py (art/fish.blend), shipped as
// src/data/fishMesh.js. Each fish is a list of grid parts (body loft, fin membranes, eyes, barbels, teeth...) with a
// colour per vertex; this rebuilds the triangles and normals, merges the parts and caches one geometry + material
// per species/variant. Fish space: nose toward +X, y up, z across, body about 1 long, centred.
// Glowing parts (lures, glow lines, geodes) carry colours above 1, so they stay bright in the dark.
// Any species missing from the data falls back to the old soft-block builder (softfishLegacy.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FISH_MESH } from '../data/fishMesh.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { legacyFishModel } from './softfishLegacy.js';
import { paintFishSkin, ATLAS } from './fishSkin.js';

const ALPHA = Array.from({ length: 92 }, (_, i) => String.fromCharCode(35 + i)).filter((c) => c !== '\\').join('');
const IDX = new Map([...ALPHA].map((c, i) => [c, i]));
const GOLD_RAMP = ['#6a4808', '#a8761a', '#d8a828', '#f4d050', '#fff0a0'];
const DIAMOND_RAMP = ['#256f8c', '#45acd0', '#78dcef', '#b8f2ff', '#ffffff'];
const GLOW_BOOST = 1.9;

/** Positions: one character per small delta, or '~' + two base-91 characters for d + 4096. */
function decodeDeltas(str, n) {
  const out = new Int32Array(n);
  let i = 0, k = 0;
  while (k < n) {
    const ch = str[i++];
    let d;
    if (ch === '~') { d = IDX.get(str[i]) * 91 + IDX.get(str[i + 1]) - 4096; i += 2; } else d = IDX.get(ch) - 44;
    out[k] = d + (k >= 3 ? out[k - 3] : 0);
    k++;
  }
  return out;
}

const lin = (hex) => new THREE.Color(hex); // THREE.Color takes sRGB hex and stores linear values
function rampColor(c, ramp) {
  const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; // linear luminance
  const k = Math.min(ramp.length - 1, Math.max(0, Math.round(Math.pow(l, 0.45) * (ramp.length - 1) + 0.25)));
  return ramp[k];
}

// Which atlas region a part samples (see fishSkin.js): the body, the tail fin, the other fins, the eyes, or a white
// texel for parts that keep their own colours.
function regionOf(part) {
  if (part.n === 'body') return 'body';
  if (part.n === 'eye') return 'eye';
  if (part.f) return part.n === 'caudal' ? 'caudal' : 'fins';
  return null;
}

function buildPart(part, base, q, pal, variant, textured, lod = 1) { // lod 2: about a quarter of the triangles (v1.13.19)
  const R = part.r, C0 = part.c, n0 = R * C0;
  const raw = decodeDeltas(part.p, n0 * 3);
  const region = textured ? regionOf(part) : null;
  const seam = !!(region && part.w); // a wrapped, textured grid gets a duplicate seam column so its UVs can run 0..1
  const C = seam ? C0 + 1 : C0, n = R * C;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const boost = part.g ? GLOW_BOOST : 1;
  const W = ATLAS.W, H = ATLAS.H;
  const [rx, ry, rw, rh] = region ? ATLAS[region] : ATLAS.white;
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
    const src = i * C0 + (j % C0), v = i * C + j;
    pos[v * 3] = base[0] + raw[src * 3] * q; pos[v * 3 + 1] = base[1] + raw[src * 3 + 1] * q; pos[v * 3 + 2] = base[2] + raw[src * 3 + 2] * q;
    let c;
    if (region) c = WHITE;
    else {
      c = pal[IDX.get(part.k[src])];
      if (variant !== 'normal' && !part.g && !(c.r + c.g + c.b < 0.03)) c = rampColor(c, variant === 'gold' ? GOLD_RAMP_C : DIAMOND_RAMP_C);
    }
    col[v * 3] = c.r * boost; col[v * 3 + 1] = c.g * boost; col[v * 3 + 2] = c.b * boost;
    let a, b;
    if (region === 'body') { a = i / (R - 1); b = j / C0; }        // along the body, around it
    else if (region === 'eye') { a = j / C0; b = i / (R - 1); }    // around the eye, out from the pupil
    else if (region) { a = j / (C0 - 1); b = i / (R - 1); }        // fins: along the base, out to the edge
    else { a = 0.5; b = 0.5; }
    uv[v * 2] = (rx + 0.5 + a * (rw - 1)) / W; uv[v * 2 + 1] = 1 - (ry + 0.5 + b * (rh - 1)) / H;
  }
  const idx = [];
  const wrapQuads = part.w && !seam;
  const cc = wrapQuads ? C : C - 1;
  const m = part.m;
  const si = lod > 1 && R > 4 ? 2 : 1, sj = lod > 1 && C0 > 5 && (wrapQuads ? C0 % 2 === 0 : (C - 1) % 2 === 0) ? 2 : 1;
  for (let i = 0; i < R - 1; i += si) {
    const i2 = Math.min(i + si, R - 1);
    for (let j = 0; j < cc; j += sj) {
      const j2 = (j + sj) % C;
      const a = i * C + j, b = i * C + j2, c = i2 * C + j2, d = i2 * C + j;
      if (m && !(m[(i * C0) + (j % C0)])) continue;
      idx.push(a, b, c, a, c, d);
    }
  }
  let vcount = n;
  const extraPos = [], extraCol = [], extraUv = [];
  // fan the end rings shut (body tip and tail root, tube ends)
  const cap = (row, flip) => {
    let cx = 0, cy = 0, cz = 0, r = 0, g = 0, bb = 0, ua = 0, va = 0;
    for (let j = 0; j < C0; j++) { const v = row * C + j; cx += pos[v * 3]; cy += pos[v * 3 + 1]; cz += pos[v * 3 + 2]; r += col[v * 3]; g += col[v * 3 + 1]; bb += col[v * 3 + 2]; ua += uv[v * 2]; va += uv[v * 2 + 1]; }
    extraPos.push(cx / C0, cy / C0, cz / C0); extraCol.push(r / C0, g / C0, bb / C0);
    const side = row * C + Math.round(C0 / 4); extraUv.push(uv[side * 2], uv[side * 2 + 1]); // the flank's colour, not the belly's
    const ci = vcount++;
    for (let j = 0; j < C0; j++) { const a = row * C + j, b = row * C + (j + 1) % (seam ? C : C0); if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); }
  };
  if (part.w && part.c0) cap(0, false);
  if (part.w && part.c1) cap(R - 1, true);
  const P = new Float32Array(vcount * 3); P.set(pos); P.set(extraPos, n * 3);
  const Cl = new Float32Array(vcount * 3); Cl.set(col); Cl.set(extraCol, n * 3);
  const U = new Float32Array(vcount * 2); U.set(uv); U.set(extraUv, n * 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(Cl, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if (seam) { // the seam column's normals: average both sides so the join doesn't show
    const N = geo.attributes.normal;
    for (let i = 0; i < R; i++) {
      const a = i * C, b = i * C + C0;
      const x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1;
      N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l);
    }
  }
  return geo;
}
const WHITE = new THREE.Color(1, 1, 1);
const GOLD_RAMP_C = GOLD_RAMP.map(lin), DIAMOND_RAMP_C = DIAMOND_RAMP.map(lin);

const cache = new Map();

/** Merged fish geometry + material for a species/variant (cached): { geometry, material, length }. */
export function softFishModel(speciesId, variant = 'normal', { lod = 1 } = {}) {
  const key = `${speciesId}:${variant}${lod > 1 ? ':lo' : ''}`;
  if (cache.has(key)) return cache.get(key);
  const data = FISH_MESH[speciesId];
  if (!data) { const old = legacyFishModel(speciesId, variant); cache.set(key, old); return old; }
  if (lod > 1) { // the light version shares the full model's painted skin and material
    const full = softFishModel(speciesId, variant);
    const geos = data.parts.map((p) => buildPart(p, data.min, data.q, data.pal.map(lin), variant, !!full.material.map, lod));
    const geometry = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    geometry.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const out = { geometry, material: full.material, length: bb.max.x - bb.min.x };
    cache.set(key, out);
    return out;
  }
  const sp = SPECIES_BY_ID[speciesId];
  const pal = data.pal.map(lin);
  const skin = sp ? paintFishSkin(sp, data.paint, variant) : null; // null in node (tests): vertex colours only
  const geos = data.parts.map((p) => buildPart(p, data.min, data.q, pal, variant, !!skin, lod));
  const geometry = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  // centre it (the body's middle, not the long tail or snout, sits at the origin like the old models)
  geometry.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const glow = variant === 'diamond' ? '#62c8e0' : variant === 'gold' ? '#d8a020' : sp?.glow || '#000000';
  const material = skin
    ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map: skin.map, emissiveMap: skin.emissiveMap, emissive: skin.emissiveMap ? '#ffffff' : variant === 'gold' ? '#3a2800' : variant === 'diamond' ? '#123848' : '#000000', emissiveIntensity: 1, alphaTest: 0.5 })
    : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: glow, emissiveIntensity: variant === 'diamond' ? 0.22 : variant === 'gold' ? 0.14 : sp?.glow ? 0.06 : 0 });
  const out = { geometry, material, length: bb.max.x - bb.min.x };
  cache.set(key, out);
  return out;
}

/** v1.13.12: paint every species' skin up front (on the loading screen), a few at a time so the page stays live,
 *  so hooking a new kind of fish or opening the Fishpedia never stops to paint. Gold and diamond skins are painted
 *  the first time one is caught. */
export async function prewarmFishSkins(onProgress, { idle = false } = {}) {
  const ids = Object.keys(FISH_MESH);
  for (let i = 0; i < ids.length; i++) {
    if (idle) { // v1.13.19: after the game has started, one species at a time in the browser's idle moments
      await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 120)));
      softFishModel(ids[i], 'normal');
      continue;
    }
    softFishModel(ids[i], 'normal');
    if (i % 4 === 3) { onProgress?.((i + 1) / ids.length); await new Promise((r) => setTimeout(r, 0)); }
  }
  onProgress?.(1);
}
