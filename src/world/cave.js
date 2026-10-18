// Echo Cavern: a flooded cave under Cavern Hill, reached by rowing up the spur off the Quarry Cut.
// The heightfield gives the water and the rock walls; this adds the roof (a lumpy rock dome over the
// cave lake and an arched tunnel over the end of the spur), stalactites, glowing crystals and glowworms,
// and dims the light while you're inside so the glowing fish stand out.
import * as THREE from 'three';
import { LAKES, RIVERS, WATER_Y, surfaceY, CAVE_DOME, caveDomeE, caveRoofY, caveTunnelAt, setWalkOverlay } from './terrain.js';
import { addSolidFn } from './colliders.js';
import { mulberry32 } from '../core/rng.js';

const C = LAKES.cave;
const SPUR = RIVERS.cavespur.pts;
// v1.8.1: a taller dome and a wider tunnel, so there's room for you, your boat and the camera
export const DOME_BASE = CAVE_DOME.base, DOME_H = CAVE_DOME.h, TUNNEL_R = 6.4, TUNNEL_Y = 4.2;

// v1.8.2 obsidian: the whole cavern (outside skin, arch, dome) is dark volcanic glass, rough but smooth:
// soft rounded lumps and smooth shading, never pointy facets, with a faint violet-teal sheen.
const vnoise = (x, z, s) => { // smooth value noise, no grid look
  const fx = Math.floor(x), fz = Math.floor(z), u = x - fx, w = z - fz, h = (i, j) => { const n = Math.sin((fx + i) * 127.1 + (fz + j) * 311.7 + s) * 43758.5453; return n - Math.floor(n); };
  const su = u * u * (3 - 2 * u), sw = w * w * (3 - 2 * w);
  return (h(0, 0) * (1 - su) + h(1, 0) * su) * (1 - sw) + (h(0, 1) * (1 - su) + h(1, 1) * su) * sw;
};
// v1.9: limestone, the classic cave rock: warm cream, tan and pale ochre in soft horizontal strata, with
// darker bedding lines and paler drip streaks (vertex colours), and a fine pitted, layered grain laid on
// by a world-space (triplanar) texture so it never stretches down the steep faces.
function paintObsidian(geo) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  const cream = new THREE.Color('#d8c8a6'), tan = new THREE.Color('#bba27a'), ochre = new THREE.Color('#c9a66a'), bed = new THREE.Color('#9a8462'), drip = new THREE.Color('#ece2cc');
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = vnoise(x * 0.1, z * 0.1, 3), w = vnoise(x * 0.25 + 4, z * 0.25, 6);
    const strata = Math.sin(y * 2.1 + n * 3.2); // soft bands that wander a little
    c.copy(cream).lerp(tan, 0.5 + strata * 0.35).lerp(ochre, Math.max(0, n - 0.55) * 1.4);
    if (Math.abs(Math.sin(y * 2.1 + n * 3.2 + 1.3)) > 0.93) c.lerp(bed, 0.45); // a bedding line
    const streak = Math.max(0, Math.sin(x * 1.7 + z * 1.3 + w * 5) - 0.86) * 5;
    c.lerp(drip, Math.min(0.5, streak));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
let graniteTex = null; // (the rock grain texture; named for its first life as granite)
function granite() {
  if (graniteTex) return graniteTex;
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), r = mulberry32(777);
  for (let y = 0; y < S; y++) {
    const layer = 0.95 + Math.sin(y * 0.21 + Math.sin(y * 0.05) * 2) * 0.02; // fine horizontal layering
    for (let x = 0; x < S; x++) { const i = y * S + x, v = (layer + r() * 0.06) * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = Math.min(255, v); img.data[i * 4 + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
  // little pits and pores, and a few fossil-ish pale flecks
  for (let k = 0; k < 900; k++) { ctx.fillStyle = `rgba(90,72,50,${0.18 + r() * 0.25})`; ctx.beginPath(); ctx.ellipse(r() * S, r() * S, 0.6 + r() * 1.6, 0.5 + r() * 1.1, 0, 0, 6.3); ctx.fill(); }
  for (let k = 0; k < 260; k++) { ctx.fillStyle = 'rgba(255,250,236,0.45)'; ctx.beginPath(); ctx.ellipse(r() * S, r() * S, 0.8 + r() * 1.8, 0.6 + r(), r() * 3, 0, 6.3); ctx.fill(); }
  graniteTex = new THREE.CanvasTexture(cv);
  graniteTex.wrapS = graniteTex.wrapT = THREE.RepeatWrapping;
  graniteTex.colorSpace = THREE.SRGBColorSpace;
  graniteTex.anisotropy = 4;
  return graniteTex;
}
const obsidianMat = () => {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: new THREE.Color('#14100a') });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tGranite = { value: granite() };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGWP; varying vec3 vGWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vGWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tGranite; varying vec3 vGWP; varying vec3 vGWN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 bw = pow(abs(vGWN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z + 1e-4);
        vec3 gr = texture2D(tGranite, vGWP.zy * 0.5).rgb * bw.x + texture2D(tGranite, vGWP.xz * 0.5).rgb * bw.y + texture2D(tGranite, vGWP.xy * 0.5).rgb * bw.z;
        diffuseColor.rgb *= gr * 1.04;`);
  };
  m.customProgramCacheKey = () => 'cave-limestone';
  return m;
};

// An inverted-U rock arch along local z (smooth, indexed): inner radius ri, outer ro, legs down to y = -legs.
// v1.9.2: the arch is one closed, rounded piece of rock: a thick inverted U swept along local z, whose two
// ends are bevelled into a big rounded lip (the inner and outer faces curve in to meet), and whose legs
// plunge well into the ground. Inner radius ri, outer ro.
function archGeo(len, ri, ro, legs) {
  const mid = (ri + ro) / 2, half = (ro - ri) / 2, bev = (ro - ri) * 1.1, deep = -legs - 3;
  const ARC = 28;
  // one ring: outer face from the right foot over the top to the left foot, across the bottom, then the
  // inner face back from the left foot over to the right foot (a closed loop)
  const loop = (rIn, rOut, z, lip) => {
    const pts = [];
    const n = (x, y, s) => vnoise(x * 0.3 + z * 0.25, y * 0.3 + z * 0.1, s) - 0.5;
    const arc = (R, from, to, out) => {
      for (let i = 0; i <= ARC; i++) {
        const a = from + (to - from) * (i / ARC), x = Math.cos(a) * R, y = Math.sin(a) * R;
        // the same lump on both faces (outer a little more), always outward, so the faces never cross and
        // meet cleanly at the rounded lip (v1.9.3)
        const bump = Math.abs(n(x / R * mid, y / R * mid, 5));
        const Rk = R + bump * (out ? 1.3 : 0.35) * lip;
        pts.push([(x / R) * Rk, (y / R) * Rk, z]);
      }
    };
    pts.push([rOut, deep, z], [rOut, -legs * 0.5, z]);
    arc(rOut, 0, Math.PI, true);
    pts.push([-rOut, -legs * 0.5, z], [-rOut, deep, z], [-rIn, deep, z], [-rIn, -legs * 0.5, z]);
    arc(rIn, Math.PI, 0, false);
    pts.push([rIn, -legs * 0.5, z], [rIn, deep, z]);
    return pts;
  };
  // rings: evenly along the middle, close together through the bevels so the lips are smooth
  const zs = new Set();
  for (let j = 0; j <= 18; j++) zs.add(+(-len / 2 + (j / 18) * len).toFixed(4));
  for (const f of [0, 0.03, 0.09, 0.18, 0.3, 0.45, 0.62, 0.8, 1]) { zs.add(+(-len / 2 + f * bev).toFixed(4)); zs.add(+(len / 2 - f * bev).toFixed(4)); }
  const zl = [...zs].sort((a, b) => a - b);
  const rings = zl.map((z) => {
    const dEnd = Math.min(z + len / 2, len / 2 - z), u = Math.min(1, Math.max(0, dEnd / bev));
    const lip = Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))); // a quarter circle: 0 at the very end, 1 inside
    const h = half * lip; // the very end closes to a single rounded edge
    return loop(mid - h, mid + h, z, lip);
  });
  const P = rings[0].length, pos = [], idx = [];
  for (const r of rings) for (const v of r) pos.push(...v);
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < P; i++) {
    const a = j * P + i, b = j * P + (i + 1) % P, c = (j + 1) * P + (i + 1) % P, d = (j + 1) * P + i;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * The obsidian skin over Cavern Hill and down the cavern walls: follows the ground just above it with soft
 * swells, runs down every rock face into the water (so no bare terrain shows at the shore or in the
 * channel), stays under the dome inside, and tucks under the grass at its edge.
 */
export const SKIN_R = 54;
/** v1.9: where the cavern's rock shows (1 = solid rock, 0 = its edge, below 0 = grass): just a skirt round
 *  the dome's foot and the tunnel's arch, with a soft, wandering edge. */
export function caveRockAt(x, z) {
  const wob = (vnoise(x * 0.11, z * 0.11, 23) - 0.5) * 0.12;
  const m1 = 1 - (caveDomeE(x, z) - 1.0 - wob) / 0.18;
  const tn = caveTunnelAt(x, z);
  const m2 = tn.t > -0.05 && tn.t < 1.25 ? (1 - (tn.d - (TUNNEL_R + 2.2) - wob * 12) / 5.5) * Math.min(1, (tn.t + 0.05) / 0.3) : -1; // a long, soft slope down to the grass
  return Math.min(1, Math.max(m1, m2));
}
function hillSkin() {
  const R = SKIN_R, step = 1, n = Math.floor((R * 2) / step) + 1, x0 = C.cx - R, z0 = C.cz - R;
  const pos = new Float32Array(n * n * 3), land = new Uint8Array(n * n), edge = new Uint8Array(n * n), keep = new Uint8Array(n * n), idx = [];
  const gr = new Float32Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const k = i * n + j; gr[k] = surfaceY(x0 + i * step, z0 + j * step); land[k] = gr[k] > WATER_Y + 0.25 ? 1 : 0; }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = x0 + i * step, z = z0 + j * step, d = Math.hypot(x - C.cx, z - C.cz), k = i * n + j;
    let near = land[k];
    for (let a = -2; a <= 2 && !near; a++) for (let b = -2; b <= 2 && !near; b++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < n && jj < n && land[ii * n + jj]) near = 1; }
    // a soft, wandering edge that slopes down under the grass (never a sawtooth cliff)
    const rock = caveRockAt(x, z);
    const f0 = Math.min(1, Math.max(0, (rock + 0.15) / 0.75)), fade = f0 * f0 * (3 - 2 * f0);
    const swell = (vnoise(x * 0.09, z * 0.09, 11) * 0.9 + vnoise(x * 0.22, z * 0.22, 13) * 0.35) * fade;
    // over the highest ground around (so a steep face never pokes through between grid points)
    let top = gr[k];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < n && jj < n) top = Math.max(top, gr[ii * n + jj]); }
    // in the water: the first row out keeps the wall's height (it covers the ground's straight drop at the
    // shoreline), further out it runs down the rock face under the water
    let ring1 = false;
    if (!land[k]) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < n && jj < n && land[ii * n + jj]) ring1 = true; }
    edge[k] = ring1 ? 1 : 0;
    let y = land[k] || ring1 ? (gr[k] - 1.4) * (1 - fade) + (top + 0.3 + swell) * fade : WATER_Y - 0.9;
    const e = caveDomeE(x, z);
    if (e < 1) y = Math.min(y, caveRoofY(e) - 0.35); // never through the roof
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    keep[k] = d < R && near && rock > -0.15 ? 1 : 0;
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
    const a = i * n + j, b = a + n, c = a + 1, e = b + 1;
    if (keep[a] && keep[b] && keep[c] && keep[e] && (land[a] || land[b] || land[c] || land[e] || edge[a] || edge[b] || edge[c] || edge[e])) idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // v1.9: you walk ON the skin (not through it): its height at any point on land, outside the dome
  g.userData.heightAt = (x, z) => {
    const fi = (x - x0) / step, fj = (z - z0) / step, i = Math.floor(fi), j = Math.floor(fj);
    if (i < 0 || j < 0 || i >= n - 1 || j >= n - 1) return null;
    const a = i * n + j, b = a + n;
    if (!(keep[a] && keep[b] && keep[a + 1] && keep[b + 1]) || !(land[a] && land[b] && land[a + 1] && land[b + 1])) return null;
    const u = fi - i, w = fj - j, Y = (k) => pos[k * 3 + 1];
    return (Y(a) * (1 - u) + Y(b) * u) * (1 - w) + (Y(a + 1) * (1 - u) + Y(b + 1) * u) * w;
  };
  return paintObsidian(g);
}

/** Soft, smooth lumps on a unit dome (no per-vertex jitter, so no pointy facets). */
function smoothLumps(geo) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = (vnoise(v.x * 3 + 7, v.z * 3 + v.y * 2, 17) - 0.5) * 0.11 + (vnoise(v.x * 7, v.z * 7 + v.y * 5, 19) - 0.5) * 0.035;
    const k = 1 + n * Math.min(1, v.y * 4); // the rim stays put on the ground
    p.setXYZ(i, v.x * k, v.y * (1 + n * 0.6), v.z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** How far inside the cavern a point is: 1 deep inside, 0 out in daylight. */
export function caveDepth(x, z) {
  const e = Math.hypot((x - C.cx) / (C.rx + 4), (z - C.cz) / (C.rz + 4));
  let k = 1 - Math.max(0, Math.min(1, (e - 0.85) / 0.4));
  // along the tunnel: from its mouth (dark grows as you go in)
  const [ax, az] = SPUR[SPUR.length - 2], [bx, bz] = SPUR[SPUR.length - 1];
  const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
  if (d < 5) k = Math.max(k, Math.max(0, t - 0.35) / 0.65 * 0.8);
  return k;
}

let bugMat = null;
export function buildCave(scene) {
  const r = mulberry32(4242);
  const g = new THREE.Group();
  g.name = 'echo-cavern';
  const rockMat = obsidianMat();
  // the hill over the cavern, skinned in obsidian
  const skinMat = obsidianMat();
  Object.assign(skinMat, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); // wins over the ground it hugs
  const skinGeo = hillSkin();
  const skin = new THREE.Mesh(skinGeo, skinMat);
  // v1.9.2: a scatter of rounded boulders of all sizes along the line where the rock meets the grass, so the
  // seam reads as tumbled rock, not a saw-tooth edge
  {
    const rr = mulberry32(9090), parts = [];
    const put = (x, z, size) => {
      const y = surfaceY(x, z);
      if (y < WATER_Y + 0.3) return;
      const geo = new THREE.IcosahedronGeometry(1, 2), p = geo.attributes.position, v = new THREE.Vector3();
      const sx = 1 + rr() * 0.5, sy = 0.55 + rr() * 0.35, sz = 0.8 + rr() * 0.4, seed = rr() * 50;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 1 + (vnoise(v.x * 1.6 + seed, v.z * 1.6 + v.y, 31) - 0.5) * 0.45; p.setXYZ(i, v.x * sx * n * size, v.y * sy * n * size, v.z * sz * n * size); }
      geo.rotateY(rr() * 6.28);
      geo.translate(x, y - size * sy * 0.3, z);
      parts.push(paintObsidian(geo.toNonIndexed()));
    };
    // walk the seam: around the dome and down both sides of the tunnel, a step at a time
    const seam = [];
    for (let a = 0; a < Math.PI * 2; a += 0.035) {
      const ux = Math.cos(a), uz = Math.sin(a);
      let lo = 10, hi = 60;
      for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; caveRockAt(C.cx + ux * m, C.cz + uz * m) > 0.02 ? (lo = m) : (hi = m); }
      seam.push([C.cx + ux * lo, C.cz + uz * lo]);
    }
    for (const [x, z] of seam) {
      if (rr() < 0.35) continue;
      const size = 0.45 + Math.pow(rr(), 1.8) * 1.5;
      put(x + (rr() - 0.5) * 1.6, z + (rr() - 0.5) * 1.6, size);
      if (rr() < 0.4) put(x + (rr() - 0.5) * 3, z + (rr() - 0.5) * 3, 0.25 + rr() * 0.35); // a little one nearby
    }
    // and a second, chunkier ring where the skirt meets the foot of the dome
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      const ex = C.cx + Math.cos(a) * (C.rx + CAVE_DOME.pad) * 1.01, ez = C.cz + Math.sin(a) * (C.rz + CAVE_DOME.pad) * 1.01;
      const tn = caveTunnelAt(ex, ez);
      if (tn.t > 0.2 && tn.t < 1.4 && tn.d < TUNNEL_R + 1.5) continue; // leave the tunnel mouth open
      if (rr() < 0.15) continue;
      put(ex + (rr() - 0.5) * 1.2, ez + (rr() - 0.5) * 1.2, 0.9 + Math.pow(rr(), 1.5) * 1.5);
    }
    if (parts.length) {
      const rocks = new THREE.Mesh(mergeAll(parts), rockMat);
      rocks.castShadow = true; rocks.receiveShadow = true; rocks.name = 'cave-seam-rocks';
      g.add(rocks);
    }
  }
  setWalkOverlay(skinGeo.userData.heightAt);
  // the dome and the tunnel's arch are solid rock: you can walk up the skirt to them, not into them
  addSolidFn((x, z) => {
    if (caveDomeE(x, z) < 1.04) return true;
    const tn = caveTunnelAt(x, z);
    return tn.t > 0.05 && tn.t < 1.3 && tn.d < TUNNEL_R + 3.4;
  });
  skin.receiveShadow = true; skin.name = 'cave-skin';
  g.add(skin);

  // the dome over the cave lake, resting on the rock walls
  const dome = paintObsidian(smoothLumps(new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2)));
  { // open the dome where the tunnel comes in (its rim runs down under the water everywhere else)
    const p = dome.attributes.position, ix = dome.index.array, keepIx = [];
    const W = (i) => [C.cx + p.getX(i) * (C.rx + 4), DOME_BASE + p.getY(i) * DOME_H, C.cz + p.getZ(i) * (C.rz + 4)];
    const R = TUNNEL_R + 0.3;
    const inTube = ([x, y, z]) => { const { t, d } = caveTunnelAt(x, z); return t > 0.2 && t < 1.3 && d < R && y < TUNNEL_Y + Math.sqrt(Math.max(0, R * R - d * d)); };
    for (let k = 0; k < ix.length; k += 3) {
      const a = W(ix[k]), b = W(ix[k + 1]), c = W(ix[k + 2]);
      if (!inTube([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3])) keepIx.push(ix[k], ix[k + 1], ix[k + 2]);
    }
    dome.setIndex(keepIx);
  }
  const domeMesh = new THREE.Mesh(dome, rockMat);
  domeMesh.scale.set(C.rx + 4, DOME_H, C.rz + 4);
  domeMesh.position.set(C.cx, DOME_BASE, C.cz);
  domeMesh.castShadow = true; domeMesh.receiveShadow = true;
  g.add(domeMesh);

  // the tunnel: an arched roof over the last stretch of the spur
  const [ax, az] = SPUR[SPUR.length - 2], [bx, bz] = SPUR[SPUR.length - 1];
  const len = Math.hypot(bx - ax, bz - az) * 0.75 + 4;
  // v1.8.2: a THICK arch (inner and outer rock faces, legs down to the water, capped ends), so the mouth
  // and the view out from inside show solid rock, never a paper-thin shell
  const tunnel = paintObsidian(archGeo(len, TUNNEL_R, TUNNEL_R + 3, TUNNEL_Y));
  const tm = new THREE.Mesh(tunnel, rockMat);
  tm.castShadow = true;
  const tg = new THREE.Group();
  tg.add(tm);
  tg.position.set(bx - (bx - ax) * 0.3, TUNNEL_Y, bz - (bz - az) * 0.3);
  tg.rotation.y = Math.atan2(bx - ax, bz - az);
  g.add(tg);

  // stalactites hanging from the dome, and a few stalagmites at the water's edge
  // (v1.9: each one hangs from the dome's real, lumpy surface, found by a ray up from the water, and only
  // under the flatter middle of the roof, so none pokes out through the top)
  domeMesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0);
  const roofAt = (x, z) => { ray.set(new THREE.Vector3(x, 0, z), up); const hit = ray.intersectObject(domeMesh, false)[0]; return hit ? hit.point.y : null; };
  const stal = [];
  for (let i = 0, tries = 0; i < 90 && tries < 400; tries++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.72;
    const x = C.cx + Math.cos(a) * (C.rx + 2) * d, z = C.cz + Math.sin(a) * (C.rz + 2) * d;
    const ry = roofAt(x, z);
    if (ry == null) continue;
    i++;
    const roof = ry - 0.12;
    const h = 0.8 + r() * 2.4;
    const geo = new THREE.ConeGeometry(0.14 + r() * 0.26, h, 10, 3).rotateX(Math.PI);
    geo.translate(x, roof - h / 2, z);
    stal.push(geo);
  }
  const stalMesh = new THREE.Mesh(mergeAll(stal), new THREE.MeshPhongMaterial({ color: '#d9caa8', shininess: 30, specular: '#5a5040' }));
  g.add(stalMesh);

  // glowing crystal clusters on the walls, and soft light from them
  const crystalMat = new THREE.MeshLambertMaterial({ color: '#7ae8ff', emissive: '#3ad0f0', emissiveIntensity: 1.2, flatShading: true });
  const amethyst = new THREE.MeshLambertMaterial({ color: '#c8a0ff', emissive: '#8a50e0', emissiveIntensity: 1.1, flatShading: true });
  const crystals = [], purple = [];
  for (let i = 0, tries = 0; i < 22 && tries < 200; tries++) {
    const a = r() * Math.PI * 2;
    // on the rock face just above the waterline: walk out from the middle until the wall. Directions with
    // no wall (out through the tunnel mouth) are skipped, so no crystal ever hangs in mid-air.
    let f = 0.6;
    while (f < 1.3 && surfaceY(C.cx + Math.cos(a) * C.rx * f, C.cz + Math.sin(a) * C.rz * f) < WATER_Y + 0.3) f += 0.01;
    if (f >= 1.3) continue;
    const ux = Math.cos(a) * C.rx, uz = Math.sin(a) * C.rz, ul = Math.hypot(ux, uz);
    const x = C.cx + ux * f - (ux / ul) * 0.9, z = C.cz + uz * f - (uz / ul) * 0.9; // set into the skin's rock face
    const tn = caveTunnelAt(x, z);
    if (tn.t > 0.3 && tn.t < 1.4 && tn.d < TUNNEL_R + 3) continue; // not at the tunnel mouth
    i++;
    const y = WATER_Y + 0.3 + r() * 2.6;
    for (let k = 0; k < 3; k++) {
      const geo = new THREE.OctahedronGeometry(0.22 + r() * 0.3, 0);
      geo.scale(0.6, 1.8 + r(), 0.6);
      geo.rotateZ((r() - 0.5) * 0.8); geo.rotateX((r() - 0.5) * 0.8);
      geo.translate(x + (r() - 0.5) * 0.8, y + r() * 0.5, z + (r() - 0.5) * 0.8);
      (i % 3 === 0 ? purple : crystals).push(geo);
    }
  }
  g.add(new THREE.Mesh(mergeAll(crystals), crystalMat), new THREE.Mesh(mergeAll(purple), amethyst));
  const lights = [['#5ae0ff', 0, 1], ['#a070ff', 2.1, 0.8], ['#5affd0', 4.2, 0.9]].map(([c, a, k]) => {
    const l = new THREE.PointLight(c, 0, 38, 1.1);
    l.position.set(C.cx + Math.cos(a) * C.rx * 0.6, 5, C.cz + Math.sin(a) * C.rz * 0.6);
    l.userData.k = k; l.userData.lbAlways = true; // lit whatever the time of day (light budget)
    g.add(l);
    return l;
  });

  // glowworms: tiny twinkling dots across the ceiling
  const n = 420, pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.95;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    pos[i * 3] = C.cx + x * (C.rx + 3.6); pos[i * 3 + 2] = C.cz + z * (C.rz + 3.6);
    pos[i * 3 + 1] = (roofAt(pos[i * 3], pos[i * 3 + 2]) ?? caveRoofY(caveDomeE(pos[i * 3], pos[i * 3 + 2]))) - 0.35;
    ph[i] = r() * 6.28;
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  wg.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const wormMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uOn: { value: 0 } },
    vertexShader: 'attribute float aPh; uniform float uT; varying float vA; void main() { vA = 0.55 + 0.45 * sin(uT * 1.7 + aPh); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 5.0 * (20.0 / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uOn; varying float vA; void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(0.45, 0.95, 1.0, (1.0 - d * 2.0) * vA * uOn); }',
  });
  const worms = new THREE.Points(wg, wormMat);
  worms.frustumCulled = false;
  g.add(worms);

  // v1.8.2: bioluminescent bugs drifting through the cave (and a few in the tunnel), each on its own slow
  // looping path, pulsing teal, green and blue. All in the shader: no per-frame work on the CPU.
  {
    const nb = 90, base = new Float32Array(nb * 3), seed = new Float32Array(nb * 4);
    const [ax2, az2] = SPUR[SPUR.length - 2], [bx2, bz2] = SPUR[SPUR.length - 1];
    for (let i = 0; i < nb; i++) {
      let x, z;
      if (i < 76) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.85; x = C.cx + Math.cos(a) * C.rx * d; z = C.cz + Math.sin(a) * C.rz * d; }
      else { const t = 0.4 + r() * 0.6; x = ax2 + (bx2 - ax2) * t + (r() - 0.5) * 4; z = az2 + (bz2 - az2) * t + (r() - 0.5) * 4; }
      base[i * 3] = x; base[i * 3 + 1] = WATER_Y + 1.2 + r() * (i < 76 ? 9 : 4); base[i * 3 + 2] = z;
      seed[i * 4] = r() * 6.28; seed[i * 4 + 1] = 0.25 + r() * 0.5; seed[i * 4 + 2] = 0.8 + r() * 2.2; seed[i * 4 + 3] = r();
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(base, 3));
    bg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    bugMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uOn: { value: 0 } },
      vertexShader: `attribute vec4 aSeed; uniform float uT; varying float vA; varying vec3 vC;
        void main() {
          float t = uT * aSeed.y + aSeed.x;
          vec3 p = position + vec3(sin(t) * aSeed.z + sin(t * 2.3) * 0.4, sin(t * 1.7) * 0.6, cos(t * 0.9) * aSeed.z + cos(t * 3.1) * 0.3);
          vA = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uT * (1.5 + aSeed.w * 2.0) + aSeed.x * 3.0), 3.0);
          vC = mix(vec3(0.35, 1.0, 0.75), vec3(0.4, 0.75, 1.0), aSeed.w);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 9.0 * (16.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform float uOn; varying float vA; varying vec3 vC;
        void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float core = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC, core * core * vA * uOn); }`,
    });
    const bugs = new THREE.Points(bg, bugMat);
    bugs.frustumCulled = false; bugs.name = 'cave-bugs';
    g.add(bugs);
  }

  scene.add(g);
  let inside = 0;
  return {
    group: g,
    get inside() { return inside; },
    /** Call after the sky has set the outdoor light: dims it inside the cave. */
    update(dt, t, pos, sky) {
      const want = pos ? caveDepth(pos.x, pos.z) : 0;
      inside += (want - inside) * Math.min(1, dt * 1.5);
      wormMat.uniforms.uT.value = t;
      wormMat.uniforms.uOn.value = 0.25 + inside * 0.75;
      if (bugMat) { bugMat.uniforms.uT.value = t; bugMat.uniforms.uOn.value = 0.35 + inside * 0.65; }
      for (const l of lights) l.intensity = (0.6 + inside * 6) * l.userData.k * (0.85 + Math.sin(t * 0.7 + l.userData.k * 5) * 0.15);
      if (sky) sky.hideSky = inside > 0.35; // no stars, moon, sun or clouds through the cave roof
      if (inside > 0.01 && sky) {
        const k = inside;
        sky.scene.fog.color.lerp(new THREE.Color('#0a1418'), k * 0.9);
        sky.scene.background.lerp(new THREE.Color('#05090c'), k * 0.95);
        sky.scene.fog.near = sky.scene.fog.near * (1 - k) + 6 * k;
        sky.scene.fog.far = sky.scene.fog.far * (1 - k) + 48 * k;
        sky.sun.intensity *= 1 - k * 0.9;
        sky.hemi.intensity *= 1 - k * 0.72;
        sky.moonLight.intensity *= 1 - k;
      }
    },
  };
}

function mergeAll(geos) {
  // tiny local merge (positions + normals) so this module stays independent of the examples helpers
  let n = 0;
  const nonIdx = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of nonIdx) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  const withColor = nonIdx.every((g) => g.attributes.color), col = withColor ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const g of nonIdx) {
    g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (col) col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/**
 * Camera fit inside the cavern (v1.8.1): when the player is in the cave, the camera may not leave the
 * hollow (the dome over the lake, the tunnel over the spur). Returns the fraction (0.15..1) of the way
 * from the target to the wanted camera position that stays inside, so the camera pulls in instead of
 * clipping through the rock.
 */
export function caveCamFit(tx, ty, tz, x, y, z) {
  if (caveDepth(tx, tz) < 0.12) return 1;
  const [ax, az] = SPUR[SPUR.length - 2], [bx, bz] = SPUR[SPUR.length - 1];
  const vx = bx - ax, vz = bz - az, vv = vx * vx + vz * vz;
  const inside = (px, py, pz) => {
    // under the dome (walls below its rim are the lake's edge, a little in from the rock)
    // (kept inside the ring of boulders along the walls: the lake's own outline, a little in)
    const ex = (px - C.cx) / (C.rx - 0.5), ez = (pz - C.cz) / (C.rz - 0.5);
    const ey = Math.max(0, py - 1) / (DOME_H * 0.75);
    if (ex * ex + ez * ez + ey * ey < 0.92) return true;
    // in the tunnel
    const t = Math.max(0, Math.min(1.2, ((px - ax) * vx + (pz - az) * vz) / vv));
    const d = Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
    const tr = TUNNEL_R - 2.4; // clear of the boulders lining the tunnel
    return d < tr && py < TUNNEL_Y + Math.sqrt(Math.max(0, tr * tr - d * d));
  };
  let ok = 0;
  for (let i = 1; i <= 24; i++) {
    const f = i / 24;
    if (!inside(tx + (x - tx) * f, ty + (y - ty) * f, tz + (z - tz) * f)) break;
    ok = f;
  }
  return Math.max(0.15, ok);
}
