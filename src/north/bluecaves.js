// Frostmere: the Blue Caves (v1.17.1). A walk-in ice cave in the glacier's flank: a tunnel mouth cut into the slope,
// a long passage into a domed main hall with a frozen pool (and something big frozen in it), a side alcove where the
// mammoth sleeps in a wall of clear ice, and a little crystal grotto. The cave is one hollow, described as a signed
// distance field (tunnels and domes melted together, roughened with noise) and turned into a mesh with marching
// cubes; its walls are glacier ice in a shader of their own (deep blue, banded, cracked, full of bubbles, glowing where
// they're thin). The floor is a game floor, the walls are solid, and the camera stays inside.
import * as THREE from 'three';
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';
import { toWorld, landAt, P } from './geo.js';
import { mergedMesh } from './instancing.js';
import { addSolidFn, addCircle } from '../world/colliders.js';
import { mulberry32 } from '../core/rng.js';

// a little 3D value noise (for the walls' roughness)
const hash = (x, y, z) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v), w) * 2 - 1;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

/** The ice: deep blue, banded with the glacier's layers, cracked, bubbly, glowing where it's thin; frosted floors. */
function iceMaterial(uni) {
  const m = new THREE.MeshLambertMaterial({ color: '#4a8ab8', side: THREE.DoubleSide, fog: false }); // (no snow haze inside the ice)
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uni);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP; varying vec3 vWN; uniform float uT; uniform vec3 uMouth; uniform vec3 uShaft;
      float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec3 N = normalize(vWN); vec3 V = normalize(cameraPosition - vWP);
        float n = n3(vWP * 0.35) * 0.6 + n3(vWP * 1.3) * 0.3 + n3(vWP * 4.1) * 0.1;
        // the glacier's layers: bands of paler and deeper blue, warped
        float band = sin(vWP.y * 2.6 + n3(vWP * vec3(0.12, 0.0, 0.12)) * 6.0) * 0.5 + 0.5;
        vec3 deep = vec3(0.01, 0.13, 0.36), mid = vec3(0.08, 0.42, 0.78), pale = vec3(0.55, 0.86, 1.0);
        vec3 ice = mix(deep, mid, smoothstep(0.25, 0.85, n * 0.7 + band * 0.45));
        // thin ice glows: brighter where it's lit from outside (the mouth, the shaft), and at grazing angles
        float lit = 0.45 + 0.55 * exp(-distance(vWP, uMouth) / 18.0) + 0.6 * exp(-distance(vWP.xz, uShaft.xz) / 4.0) * smoothstep(uShaft.y - 6.0, uShaft.y, vWP.y);
        float fres = pow(1.0 - abs(dot(N, V)), 2.0);
        ice = mix(ice, pale, fres * 0.45 + smoothstep(0.75, 1.0, n) * 0.35);
        // cracks: thin white veins; bubbles: little bright dots frozen in
        float cn = n3(vWP * 0.7 + 3.1), cw = fwidth(cn) * 1.2 + 0.002;
        float cr = (1.0 - smoothstep(0.0, cw, abs(cn - 0.5))) * smoothstep(0.66, 0.86, n3(vWP * 0.15 + 7.0)) * (1.0 - smoothstep(0.3, 0.7, N.y));
        vec3 bc = floor(vWP * 6.0); float bh = h3(bc); float bub = step(0.975, bh) * (1.0 - smoothstep(0.02, 0.07, length(fract(vWP * 6.0) - 0.5)));
        ice += vec3(0.7, 0.9, 1.0) * (cr * 0.16 + bub * 0.6);
        // the floor: polished blue ice (the mouth's light gleams in it), with frost and blown snow in drifts
        float fl = smoothstep(0.55, 0.85, N.y);
        vec3 polish = mix(vec3(0.05, 0.24, 0.5), vec3(0.18, 0.5, 0.82), n3(vWP * 0.3) * 0.7 + n3(vWP * 2.2) * 0.3);
        float drift = smoothstep(0.52, 0.78, n3(vWP * vec3(0.22, 0.0, 0.22) + 11.0) + (n3(vWP * 1.7) - 0.5) * 0.25);
        vec3 frost = mix(vec3(0.5, 0.72, 0.9), vec3(0.78, 0.9, 1.0), n3(vWP * 0.9)) * (0.88 + 0.12 * n);
        vec3 floorC = mix(polish, frost, drift);
        vec3 Rf = reflect(-V, N); vec3 toM = normalize(uMouth - vWP), toS = normalize(vec3(uShaft.x, uShaft.y + 9.0, uShaft.z) - vWP);
        float gleam = (pow(max(0.0, dot(Rf, toM)), 24.0) * exp(-distance(vWP, uMouth) / 30.0) * 1.6 + pow(max(0.0, dot(Rf, toS)), 30.0) * exp(-distance(vWP.xz, uShaft.xz) / 10.0)) * (1.0 - drift);
        float spark = step(0.992, h3(floor(vWP * 9.0))) * pow(max(0.0, dot(V, N)), 8.0) * drift;
        ice = mix(ice, floorC, fl) + vec3(0.8, 0.92, 1.0) * (gleam + spark) * fl;
        // icicle sheen on the ceiling: darker, wet
        ice *= mix(1.0, 0.7, smoothstep(-0.5, -0.9, N.y));
        // (seen from outside, where the lip of the mouth stands out of the cliff: weathered glacier ice in daylight)
        float outside = step(dot(N, V), 0.0);
        if (outside > 0.5) { lit = 0.55; ice = mix(vec3(0.42, 0.64, 0.82), vec3(0.8, 0.9, 0.98), smoothstep(0.2, 0.9, n + band * 0.2)) * (0.85 + 0.25 * smoothstep(-0.2, 0.8, -N.y)); }
        diffuseColor.rgb = ice * (outside > 0.5 ? 0.55 : 0.12); // (it's underground: the sun barely reaches; the ice's own glow carries it)
        totalEmissiveRadiance += ice * lit * 0.85;
      }`);
  };
  return m;
}

export class BlueCaves {
  constructor(wild) {
    this.wild = wild; this.north = wild.north; this.game = wild.game;
    this.uni = { uT: { value: 0 }, uMouth: { value: new THREE.Vector3() }, uShaft: { value: new THREE.Vector3() } };
  }
  L(du, dv) { const C = P.caves; return toWorld(C.u + du, C.v + dv); }

  build(group) {
    const G = this.group = new THREE.Group(); G.name = 'blue-caves'; group.add(G);
    // the plan (in metres from the caves' marker): the mouth on the slope to the east, a passage west into the hill
    const mouth = this.L(11, 3), f0 = landAt(P.caves.u + 20, P.caves.v + 4) + 0.3; // (the flat in front of the cliff; landAt takes the north's own coords)
    this.mouth = mouth; this.f0 = f0;
    const f1 = f0 + 1.2;
    const pt = (du, dv) => this.L(du, dv);
    this.tunnels = [
      { a: pt(24, 4), b: pt(2, 2), fa: f0 - 0.3, fb: f0 + 0.8, rw: 3.3, h: 5.4 },
      { a: pt(2, 2), b: pt(-14, 0), fa: f0 + 0.8, fb: f1, rw: 3.6, h: 5.8 },
      { a: pt(-17, 3), b: pt(-20, 9.5), fa: f1, fb: f1, rw: 2.7, h: 4.6 },
      { a: pt(-30, -5), b: pt(-35, -10), fa: f1, fb: f1, rw: 2.5, h: 4.2 },
    ];
    this.domes = [
      { c: pt(-24, -1), f: f1, R: 10.5, H: 9.5 }, // the main hall
      { c: pt(-21, 13.5), f: f1, R: 5.8, H: 6.5 }, // the mammoth's alcove
      { c: pt(-37.5, -12.5), f: f1, R: 4.8, H: 5.2 }, // the crystal grotto
    ];
    this.top = f1 + 10.5;
    // the grid the cave is meshed on: its east face is the mouth (left open)
    const S = 0.55, x0 = this.L(-44, 0).x, x1 = mouth.x, z0 = this.L(0, -19).z, z1 = this.L(0, 21).z, y0 = f0 - 2.2, y1 = this.top + 1.5;
    this.box = { x0, x1, z0, z1, y0, y1 };
    const nx = Math.ceil((x1 - x0) / S), ny = Math.ceil((y1 - y0) / S), nz = Math.ceil((z1 - z0) / S);
    const val = new Float32Array((nx + 1) * (ny + 1) * (nz + 1)), id = (i, j, k) => (k * (ny + 1) + j) * (nx + 1) + i;
    for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) val[id(i, j, k)] = this.sdf(x0 + i * S, y0 + j * S, z0 + k * S);
    // marching cubes (corners: 0-3 round the bottom face, 4-7 above them)
    const C8 = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]];
    const E12 = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    const pos = [], vl = new Array(12), cv = new Array(8), cp = new Array(8);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let ci = 0;
      for (let c = 0; c < 8; c++) { const o = C8[c]; cv[c] = val[id(i + o[0], j + o[1], k + o[2])]; if (cv[c] < 0) ci |= 1 << c; }
      if (ci === 0 || ci === 255) continue;
      const em = edgeTable[ci];
      for (let e = 0; e < 12; e++) if (em & (1 << e)) {
        const [a, b] = E12[e], oa = C8[a], ob = C8[b], t = cv[a] / (cv[a] - cv[b]);
        vl[e] = [x0 + (i + oa[0] + (ob[0] - oa[0]) * t) * S, y0 + (j + oa[1] + (ob[1] - oa[1]) * t) * S, z0 + (k + oa[2] + (ob[2] - oa[2]) * t) * S];
      }
      for (let q = ci * 16; triTable[q] !== -1; q += 3) pos.push(...vl[triTable[q]], ...vl[triTable[q + 1]], ...vl[triTable[q + 2]]);
      void cp;
    }
    const geo = new THREE.BufferGeometry(), P32 = new Float32Array(pos), N32 = new Float32Array(pos.length), e = 0.25;
    for (let v = 0; v < P32.length; v += 3) { // normals from the field (pointing out into the open cave)
      const x = P32[v], y = P32[v + 1], z = P32[v + 2];
      const gx = this.sdf(x + e, y, z) - this.sdf(x - e, y, z), gy = this.sdf(x, y + e, z) - this.sdf(x, y - e, z), gz = this.sdf(x, y, z + e) - this.sdf(x, y, z - e), L = Math.hypot(gx, gy, gz) || 1;
      N32[v] = -gx / L; N32[v + 1] = -gy / L; N32[v + 2] = -gz / L;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(P32, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N32, 3)); geo.computeBoundingSphere();
    this.uni.uMouth.value.set(mouth.x, f0 + 2, mouth.z);
    const shell = new THREE.Mesh(geo, iceMaterial(this.uni)); shell.name = 'blue-caves-shell'; shell.receiveShadow = false; shell.castShadow = false; G.add(shell);
    this.tris = P32.length / 9;
    this.carveTerrain();
    this.furnish(G);
    this.dressMouth(G);
    // the walls are solid; you walk on the cave's floor; the camera stays inside
    addSolidFn((x, z, r) => this.wallAt(x, z, r));
    const prevFit = this.game.engine.camFit;
    this.game.engine.camFit = (tx, ty, tz, x, y, z) => (this.inside(tx, ty, tz) ? this.fit(tx, ty, tz, x, y, z) : prevFit ? prevFit(tx, ty, tz, x, y, z) : 1);
  }

  /** The floor height under (x, z) of the nearest part of the cave, and its distance field there. */
  parts(x, z) {
    let best = null;
    for (const T of this.tunnels) {
      const ax = T.b.x - T.a.x, az = T.b.z - T.a.z, L2 = ax * ax + az * az, k = Math.max(0, Math.min(1, ((x - T.a.x) * ax + (z - T.a.z) * az) / L2));
      const d = Math.hypot(x - (T.a.x + ax * k), z - (T.a.z + az * k)), f = T.fa + (T.fb - T.fa) * k, s = d / T.rw;
      if (!best || s < best.s) best = { s, f, rw: T.rw, h: T.h, d };
    }
    for (const D of this.domes) { const d = Math.hypot(x - D.c.x, z - D.c.z), s = d / D.R; if (!best || s < best.s) best = { s, f: D.f, rw: D.R, h: D.H, d }; }
    return best;
  }
  floorY(x, z) { return this.parts(x, z).f; }
  /** Negative in the open cave, positive in the ice. */
  sdf(x, y, z) {
    let d = 9;
    for (const T of this.tunnels) {
      const ax = T.b.x - T.a.x, az = T.b.z - T.a.z, L2 = ax * ax + az * az, k = Math.max(0, Math.min(1, ((x - T.a.x) * ax + (z - T.a.z) * az) / L2));
      const hd = Math.hypot(x - (T.a.x + ax * k), z - (T.a.z + az * k)), f = T.fa + (T.fb - T.fa) * k, yy = Math.max(0, y - f);
      d = smin(d, (Math.hypot(hd / T.rw, yy / T.h) - 1) * Math.min(T.rw, T.h), 2.2);
    }
    for (const D of this.domes) { const hd = Math.hypot(x - D.c.x, z - D.c.z), yy = Math.max(0, y - D.f); d = smin(d, (Math.hypot(hd / D.R, yy / D.H) - 1) * Math.min(D.R, D.H), 3.0); }
    d += noise3(x * 0.32, y * 0.32, z * 0.32) * 0.55 + noise3(x * 1.1, y * 1.1, z * 1.1) * 0.16;
    // the floor: flat (a little rippled) under each part
    const f = this.floorY(x, z) + noise3(x * 0.6, 0, z * 0.6) * 0.05;
    return Math.max(d, f - y);
  }
  inside(x, y, z) { const b = this.box; return x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < this.top + 0.5 && this.sdf(x, Math.max(y, this.floorY(x, z) + 1.0), z) < -0.2; }
  /** Is the player down in the cave (not walking on the hill above it)? */
  playerIn() { const p = this.game.player.pos, b = this.box; return p.x > b.x0 - 1 && p.x < this.tunnels[0].a.x + 1 && p.z > b.z0 && p.z < b.z1 && p.y < this.f0 + 4.5; }
  /** The floor under (x, z) while you're in the cave, else null. */
  floorAt(x, z) {
    if (!this.box || !this.playerIn()) return null;
    const b = this.box; if (x < b.x0 || z < b.z0 || z > b.z1 || x > this.tunnels[0].a.x) return null;
    if (x > b.x1) { const p = this.parts(x, z); return p.s < 0.95 ? p.f : null; } // (the cut in front of the mouth)
    const f = this.floorY(x, z);
    return this.sdf(x, f + 1.0, z) < -0.15 ? f : null;
  }
  wallAt(x, z, r) {
    if (!this.box || !this.playerIn() || r > 0.6) return false;
    const b = this.box; if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return false;
    const f = this.floorY(x, z), ground = landAt(x + 3000, z) ?? 0;
    if (ground < f + 1.0 && this.parts(x, z).s > 1.2) return false; // (out on the open slope by the mouth)
    return this.sdf(x, f + 1.0, z) > -r - 0.1;
  }
  camFloor(x, z) { return this.playerIn() && this.box && x > this.box.x0 && x < this.box.x1 + 3 && z > this.box.z0 && z < this.box.z1 ? this.floorY(Math.min(x, this.box.x1), z) + 0.5 : null; }
  /** How far out the camera can go (0..1) before it leaves the cave. */
  fit(tx, ty, tz, x, y, z) {
    let ok = 1;
    for (let k = 1; k <= 12; k++) { const t = k / 12, px = tx + (x - tx) * t, py = ty + (y - ty) * t, pz = tz + (z - tz) * t; if (px > this.box.x1 + 4) break; if (px <= this.box.x1 && this.sdf(px, py, pz) > -0.45) { ok = Math.max(0.12, (k - 1) / 12); break; } }
    return ok;
  }

  /** Cut the cave out of the hillside's ground: the ground's shader drops any of itself that lies inside the cave
   *  (so the cliff opens at the mouth, and no slope of ground cuts across a passage). */
  carveTerrain() {
    const m = this.north.world?.chunks?.[0]?.material; if (!m) return;
    const T = this.tunnels, D = this.domes, b = this.box;
    const u = {
      uCvBox: { value: new THREE.Vector4(b.x0, b.z0, b.x1, b.z1) },
      uCvA: { value: T.map((t) => new THREE.Vector4(t.a.x, t.a.z, t.b.x, t.b.z)) },
      uCvB: { value: T.map((t) => new THREE.Vector4(t.fa, t.fb, t.rw * 1.1, t.h * 1.06)) },
      uCvD: { value: D.map((d) => new THREE.Vector4(d.c.x, d.c.z, d.f, d.R * 1.08)) },
      uCvH: { value: D.map((d) => d.H * 1.05) },
    };
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      prev?.call(m, sh, r);
      Object.assign(sh.uniforms, u);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform vec4 uCvBox; uniform vec4 uCvA[${T.length}]; uniform vec4 uCvB[${T.length}]; uniform vec4 uCvD[${D.length}]; uniform float uCvH[${D.length}];`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vWP.x > uCvBox.x && vWP.x < uCvBox.z && vWP.z > uCvBox.y && vWP.z < uCvBox.w) {
          bool cut = false;
          for (int i = 0; i < ${T.length}; i++) {
            vec2 a = uCvA[i].xy, d = uCvA[i].zw - a; float k = clamp(dot(vWP.xz - a, d) / dot(d, d), 0.0, 1.0);
            float f = mix(uCvB[i].x, uCvB[i].y, k), hd = length(vWP.xz - a - d * k);
            if (vWP.y > f + 0.03 && length(vec2(hd / uCvB[i].z, (vWP.y - f) / uCvB[i].w)) < 1.0) cut = true;
          }
          for (int i = 0; i < ${D.length}; i++) {
            float hd = length(vWP.xz - uCvD[i].xy);
            if (vWP.y > uCvD[i].z + 0.03 && length(vec2(hd / uCvD[i].w, (vWP.y - uCvD[i].z) / uCvH[i])) < 1.0) cut = true;
          }
          if (cut) discard;
        }`);
    };
    m.customProgramCacheKey = () => 'north-ground-caves';
    m.needsUpdate = true;
  }

  /** What's in the cave: icicles, ice columns, crystals, the frozen pool, the mammoth in its ice, a light shaft. */
  furnish(G) {
    const r = mulberry32(77), D0 = this.domes[0], D1 = this.domes[1], D2 = this.domes[2];
    const ceil = (x, z) => { const f = this.floorY(x, z); let y = f + 1; while (y < this.top + 1 && this.sdf(x, y, z) < 0) y += 0.25; return y; };
    // icicles all over the ceilings (hanging from it), ice columns and stalagmites by the walls
    const spots = [];
    for (let k = 0; k < 55; k++) { // (v1.17.1b: a few clusters in the chambers; none in the entrance passage)
      const pick = r() < 0.6 ? D0 : r() < 0.5 ? D1 : D2;
      let x, z;
      if (pick.c) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * pick.R * 0.85; x = pick.c.x + Math.cos(a) * d; z = pick.c.z + Math.sin(a) * d; } else { const t = r(); x = pick.a.x + (pick.b.x - pick.a.x) * t + (r() - 0.5) * 3; z = pick.a.z + (pick.b.z - pick.a.z) * t + (r() - 0.5) * 3; }
      if (x > this.mouth.x - 1 || this.sdf(x, this.floorY(x, z) + 1, z) > -0.5 || this.parts(x, z).h < 6) continue;
      spots.push([x, ceil(x, z), z]);
    }
    for (const [x, y, z] of spots) { const m = mergedMesh('fp_icicles', { shadow: false }); m.position.set(x, y + 0.05, z); m.rotation.set(0, r() * 6, 0); m.scale.set(0.8 + r() * 0.8, 0.9 + r() * 1.4, 0.8 + r() * 0.8); G.add(m); }
    // glowing crystal clusters round the walls (the grotto is full of them)
    const cg = new THREE.CylinderGeometry(0, 1, 1, 6, 1); cg.translate(0, 0.5, 0);
    const cmat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#2a8ec8', emissiveIntensity: 0.55, transparent: true, opacity: 0.9, flatShading: true, fog: false });
    const crystals = [];
    const wallSpot = (D, a) => { let d = 0.5; while (d < D.R + 2 && this.sdf(D.c.x + Math.cos(a) * d, D.f + 1.5, D.c.z + Math.sin(a) * d) < -0.5) d += 0.3; return [D.c.x + Math.cos(a) * d, D.c.z + Math.sin(a) * d]; };
    for (const [D, n] of [[D2, 26], [D0, 14], [D1, 6]]) for (let k = 0; k < n; k++) {
      const [x, z] = wallSpot(D, r() * Math.PI * 2);
      for (let q = 0; q < 3 + Math.floor(r() * 4); q++) crystals.push({ x: x + (r() - 0.5) * 1.2, y: D.f - 0.1, z: z + (r() - 0.5) * 1.2, s: 0.08 + r() * 0.16, h: 0.35 + r() * 1.1, rx: (r() - 0.5) * 1.1, rz: (r() - 0.5) * 1.1, hue: r() });
    }
    const im = new THREE.InstancedMesh(cg, cmat, crystals.length), m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler();
    const cc = new THREE.Color();
    crystals.forEach((c, i) => { e4.set(c.rx, r() * 6, c.rz); q4.setFromEuler(e4); m4.compose(new THREE.Vector3(c.x, c.y, c.z), q4, new THREE.Vector3(c.s, c.h, c.s)); im.setMatrixAt(i, m4); im.setColorAt(i, cc.setHSL(0.5 + c.hue * 0.2, 0.75, 0.62 + c.hue * 0.15)); });
    G.add(im);
    for (const [D, col, I] of [[D2, '#5ad8ff', 1.4], [D0, '#4ab0ff', 1.2]]) { const l = new THREE.PointLight(col, I, D.R * 2.2, 1.4); l.userData.lbAlways = true; l.position.set(D.c.x, D.f + 2.5, D.c.z); G.add(l); }
    // ice columns where the ceiling met the floor
    for (let k = 0; k < 7; k++) { const [x, z] = wallSpot(D0, k / 7 * Math.PI * 2 + 0.4); if (this.tunnels.some((T) => Math.hypot(x - T.a.x, z - T.a.z) < 6 || Math.hypot(x - T.b.x, z - T.b.z) < 6)) continue; // (not in a doorway)
 const m = mergedMesh('fp_icecolumn', { shadow: false }); m.position.set(x + (D0.c.x - x) * 0.12, D0.f - 1.2, z + (D0.c.z - z) * 0.12); m.scale.setScalar(0.9 + r() * 0.5); m.rotation.y = r() * 6; G.add(m); addCircle(m.position.x, m.position.z, 0.75 * m.scale.x); }
    // the frozen pool in the hall: clear black-blue ice you can walk on, with the Old One frozen in it
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.ShaderMaterial({ transparent: true, fog: false, uniforms: this.uni,
      vertexShader: 'varying vec2 vU; varying vec3 vW; void main(){ vU = uv; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
      fragmentShader: `uniform float uT; varying vec2 vU; varying vec3 vW;
        float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){ vec2 q = vU - 0.5; float r = length(q) * 2.0;
          vec3 c = mix(vec3(0.01, 0.08, 0.16), vec3(0.06, 0.3, 0.5), smoothstep(1.0, 0.2, r));
          // a soft blue glow from deep under the ice, slowly breathing, with lighter veins drifting through it
          float gl = exp(-r * r * 3.0) * (0.75 + 0.25 * sin(uT * 0.6)); float vein = smoothstep(0.75, 1.0, sin(vW.x * 1.7 + sin(vW.z * 1.3 + uT * 0.2) * 2.0) * 0.5 + 0.5);
          c += vec3(0.1, 0.55, 0.95) * gl * 0.9 + vec3(0.3, 0.75, 1.0) * vein * gl * 0.25;
          vec2 bc = floor(vU * 40.0); float b = step(0.95, h2(bc)) * (1.0 - smoothstep(0.05, 0.3, length(fract(vU * 40.0) - 0.5)));
          c += vec3(0.6, 0.85, 1.0) * b * 0.5 + vec3(0.8, 0.95, 1.0) * pow(1.0 - r, 6.0) * 0.15;
          float edge = smoothstep(1.0, 0.92, r);
          gl_FragColor = vec4(c, 0.92 * edge); }` }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(D0.c.x + 1.5, D0.f + 0.12, D0.c.z + 0.5); pool.renderOrder = 2; pool.material.polygonOffset = true; pool.material.polygonOffsetFactor = -2; pool.material.polygonOffsetUnits = -4; // (clear of the floor's ripples: no flicker) G.add(pool);
    // the mammoth, standing broadside at the back of the alcove, frozen in a great lens of old ice that runs into the
    // wall: frosted in veils, cracked, full of bubbles, clear enough in places to see its eye and the curl of its tusks
    const back = (() => { const ax = D1.c.x - this.tunnels[2].a.x, az = D1.c.z - this.tunnels[2].a.z, L = Math.hypot(ax, az); return { x: ax / L, z: az / L }; })();
    const side = { x: -back.z, z: back.x }, yaw = Math.atan2(side.x, side.z), S = 0.9;
    const mx = D1.c.x + back.x * 1.9 - side.x * 0.9 * S, mz = D1.c.z + back.z * 1.9 - side.z * 0.9 * S; // (its middle, tusks to tail, centred)
    const mam = mergedMesh('fp_mammoth_full'); mam.position.set(mx, D1.f - 0.12, mz); mam.rotation.y = yaw; mam.scale.setScalar(S); G.add(mam);
    const bc = { x: D1.c.x + back.x * 2.3, z: D1.c.z + back.z * 2.3 }, BX = 2.5, BY = 2.9, BZ = 5.0; // (the lens: depth, height, length)
    const blockGeo = new THREE.IcosahedronGeometry(1, 5), bp = blockGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(bp, i), k = 1 + noise3(v.x * 2.2 + 3, v.y * 2.2, v.z * 2.2) * 0.07 + noise3(v.x * 6, v.y * 6, v.z * 6) * 0.025; bp.setXYZ(i, v.x * k, v.y * k, v.z * k); }
    blockGeo.computeVertexNormals();
    const bmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uT: this.uni.uT },
      vertexShader: 'varying vec3 vW; varying vec3 vN; varying vec3 vL; void main(){ vL = position; vW = (modelMatrix * vec4(position, 1.0)).xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
      fragmentShader: `uniform float uT; varying vec3 vW; varying vec3 vN; varying vec3 vL;
        float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y), mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          vec3 N = normalize(vN), V = normalize(cameraPosition - vW); float ndv = abs(dot(N, V)), fres = pow(1.0 - ndv, 2.5);
          // frost veils (streaming down the face), clear windows between them
          float veil = smoothstep(0.42, 0.75, n3(vW * vec3(0.9, 0.25, 0.9)) * 0.7 + n3(vW * 2.5) * 0.3);
          float cn = n3(vW * 1.1 + 5.0); float crack = 1.0 - smoothstep(0.0, fwidth(cn) * 1.4 + 0.003, abs(cn - 0.5));
          vec3 bcell = floor(vW * 9.0); float bub = step(0.965, h3(bcell)) * (1.0 - smoothstep(0.08, 0.32, length(fract(vW * 9.0) - 0.5)));
          vec3 deep = vec3(0.05, 0.3, 0.55), pale = vec3(0.7, 0.9, 1.0);
          float band = sin(vW.y * 2.6 + n3(vW * vec3(0.12, 0.0, 0.12)) * 6.0) * 0.5 + 0.5; crack *= smoothstep(0.6, 0.8, n3(vW * 0.3 + 2.0));
          vec3 c = mix(deep, pale, veil * 0.7 + fres * 0.3 + band * 0.12) + vec3(0.8, 0.95, 1.0) * (crack * 0.3 + bub * 0.5);
          float spec = pow(max(0.0, dot(reflect(-V, N), normalize(vec3(0.3, 1.0, 0.2)))), 40.0);
          c += spec * 0.6;
          float a = clamp(0.3 + veil * 0.45 + fres * 0.25 + crack * 0.2 + bub * 0.3, 0.0, 0.9);
          a *= smoothstep(-1.02, -0.86, vL.y) ; // (it melts into the floor)
          gl_FragColor = vec4(c, a);
        }` });
    const block = new THREE.Mesh(blockGeo, bmat); block.position.set(bc.x, D1.f + BY * 0.82, bc.z); block.scale.set(BZ, BY, BX); block.rotation.y = yaw + Math.PI / 2; block.renderOrder = 3; G.add(block);
    const ml = new THREE.PointLight('#7ad0ff', 2.2, 14, 1.3); ml.userData.lbAlways = true; ml.position.set(bc.x - back.x * 3.5, D1.f + 2.6, bc.z - back.z * 3.5); G.add(ml);
    const glow = new THREE.PointLight('#bff0ff', 1.2, 7, 1.5); glow.userData.lbAlways = true; glow.position.set(bc.x + back.x * 0.6, D1.f + 3.2, bc.z + back.z * 0.6); G.add(glow); // (the ice lit from within)
    this.mammoth = { x: bc.x, z: bc.z, r: 3.2 };
    { const c = Math.cos(yaw), s_ = Math.sin(yaw); addSolidFn(this.mamFn = (x, z, rr) => { if (!this.playerIn()) return false; const dx = x - bc.x, dz = z - bc.z, ls = dx * s_ + dz * c, lb = dx * c - dz * s_; return (ls / (BZ + rr)) ** 2 + (lb / (BX + rr)) ** 2 < 1; }); }
    // a shaft of daylight down through a crack in the hall's roof, with motes turning in it
    const sx = D0.c.x - 3, sz = D0.c.z - 2.5, sy = ceil(sx, sz);
    this.uni.uShaft.value.set(sx, D0.f, sz);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.5, sy - D0.f, 24, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: this.uni,
      vertexShader: 'varying vec2 vU; varying vec3 vN; varying vec3 vW; void main(){ vU = uv; vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
      // (a soft beam: bright where you look through its middle, fading to nothing at its edges and when you're in it)
      fragmentShader: 'uniform float uT; varying vec2 vU; varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float core = pow(abs(dot(normalize(vN), V)), 3.0); float rays = 0.65 + 0.35 * sin(vU.x * 31.0 + uT * 0.3) * sin(vU.x * 13.0 - uT * 0.2); float near = smoothstep(1.5, 5.0, distance(cameraPosition, vW)); float a = core * rays * near * smoothstep(0.0, 0.6, vU.y) * 0.16; gl_FragColor = vec4(vec3(0.8, 0.93, 1.0) * a, 1.0); }' }));
    shaft.position.set(sx, (sy + D0.f) / 2, sz); G.add(shaft);
    const motes = new Float32Array(120 * 3); for (let i = 0; i < 120; i++) motes.set([sx + (r() - 0.5) * 3, D0.f + r() * (sy - D0.f), sz + (r() - 0.5) * 3], i * 3);
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(motes, 3));
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.06, transparent: true, opacity: 0.7, depthWrite: false })); G.add(this.motes);
    this.shaftAt = { x: sx, z: sz, y0: D0.f, y1: sy };
  }
  /** The way in: fallen ice and boulders at the cliff's foot, a signpost. */
  dressMouth(G) {
    const r = mulberry32(91), x = this.mouth.x - 0.25;
    const foot = (du, dv, name, s, ry) => { const p = this.L(du, dv), m = mergedMesh(name, { shadow: false }); m.position.set(p.x, landAt(p.x + 3000, p.z) - 0.2, p.z); m.rotation.y = ry; m.scale.setScalar(s); G.add(m); return m; };
    for (const [du, dv, n, s_] of [[12.5, -7.5, 'nf_rock_b', 1.0], [13.5, 10, 'nf_rock_a', 1.3], [11.5, -11, 'nf_rock_c', 2.0], [15, 7.5, 'nf_rock_c', 1.6], [16, -6, 'nf_rock_a', 0.8], [12, 13, 'nf_ice_spire', 1.4], [11.5, -14, 'nf_ice_spire', 1.1], [14, -10, 'nf_drift', 0.8], [14, 12, 'nf_drift', 0.7]]) {
      const m = foot(du, dv, n, s_, r() * 6); addCircle(m.position.x, m.position.z, 0.7 * s_);
    }
    const sp = foot(25, 9, 'fp_signpost', 1, -Math.PI / 2 + 0.5); addCircle(sp.position.x, sp.position.z, 0.2);
  }

  update(dt, t) {
    this.uni.uT.value = t;
    if (this.motes) {
      const a = this.motes.geometry.attributes.position, S = this.shaftAt;
      for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 0.12; if (y < S.y0) y = S.y1; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.05); }
      a.needsUpdate = true;
    }
  }
}
