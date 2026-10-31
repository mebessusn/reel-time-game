// Frostmere: building the frozen north's scenery. Everything is built once, on the first trip north (during the
// flight, a slice at a time so the game keeps drawing), and hidden whenever you're not up here.
// - the land: a smooth snowy height field in 4x4 chunks (frustum-culled), coloured snow, rock, blue glacier ice,
//   stony beach and tundra grass, with a little sparkle in the snow;
// - the ice: one sheet over the lake, the Long Glide and the sea ice, coloured snow-ice, clear black ice and thin
//   grey ice; drilled holes are cut out of it in the shader (up to 48 at once), each with a water disc and ice walls;
// - open water (the sea past the floe edge, Steamhole Springs, the Frozen Falls pool) and drifting floes;
// - a ring of far mountains, and the scatter: snow-laden spruce, rocks, drifts and grass, instanced.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { groomed, HOLLOW, NORTH, GRID, WATER_Y, ICE_Y, K, buildGridAsync, landAt, kindAt, depthAt, thinIce, isIce, ridgeDist, riverDist, RIVER_W, P, coastV, floeV, SPRINGS, FALLS_POOL, toWorld, toLocal, lakeSd, trailDist, renderHeight, waterEdge } from './geo.js';
import { makeNoise2D, mulberry32 } from '../core/rng.js';
import { instanced } from './instancing.js';
import { addCircle } from '../world/colliders.js';

const noise = makeNoise2D(771);
const C = (h) => new THREE.Color(h);
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));
export const UNDER_FISH = 10;
const toLocalXZ = (x, z) => toLocal(x, z);
const MAX_HOLES = 48;

const SNOW_LOOK = Number((import.meta.env.DEV && new URLSearchParams(location.search).get('snow')) || 3); // (v1.17.2: which snow; ?snow=1|2|3 in dev)
/** Snow sparkle: tiny glints that catch the light as the camera moves (Lambert + a few lines of shader). */
function sparkle(mat, amount = 1) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uSparkle = { value: amount };
    s.uniforms.uLook = { value: SNOW_LOOK };
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform float uSparkle;\nfloat h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }\nfloat h2s(vec2 p){ return h3(vec3(p, 1.7)); }\nfloat vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2s(i), h2s(i + vec2(1.0, 0.0)), f.x), mix(h2s(i + vec2(0.0, 1.0)), h2s(i + vec2(1.0, 1.0)), f.x), f.y); }\nuniform float uLook;\n/* v1.17.2 the snow\'s height in metres: 1 wind-carved sastrugi, 2 soft pillows, 3 crust and ripples */\nfloat snowH(vec2 p, float near){ vec2 W = vec2(0.8, 0.6), S = vec2(-0.6, 0.8); float warp = vn(p * 0.07) * 5.0 + vn(p * 0.23 + 4.0) * 1.4, fld = smoothstep(0.3, 0.7, vn(p * 0.04 + 9.0)); float a = dot(p, W), b = dot(p, S); float h = (vn(p * 0.16) * 0.55 + vn(p * 0.37 + 2.0) * 0.22); if (uLook == 2.0) h += vn(p * 0.6 + 5.0) * 0.16 * near; else { float ridge = 1.0 - abs(sin(a * (uLook == 1.0 ? 0.9 : 1.5) + warp + b * 0.1)); h += ridge * ridge * (uLook == 1.0 ? 0.17 : 0.07) * fld * near; } h += vn(vec2(a * 0.5, b * 2.2)) * 0.04 * near; return h; }')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.3; // (snow throws light back: shaded banks stay soft blue-white)')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
      // v1.17.1: the snow has a surface: wind-carved ripples (sastrugi) lit by the low sun, drifts and hollows in
      // a faint blue, and a fine grain up close (only on snow: pale, unsaturated ground)
      { vec3 c0 = gl_FragColor.rgb; float lum = dot(c0, vec3(0.333)); float sat = max(c0.r, max(c0.g, c0.b)) - min(c0.r, min(c0.g, c0.b));
        float snowy = smoothstep(0.55, 0.75, lum) * (1.0 - smoothstep(0.08, 0.2, sat)) * uSparkle;
        if (snowy > 0.0) {
          float dist = length(cameraPosition - vWP), near = 1.0 - smoothstep(35.0, 130.0, dist), close = 1.0 - smoothstep(10.0, 45.0, dist);
          vec2 p = vWP.xz + vec2(3000.0, 0.0);
          // the snow's own shape, lit by the real sun: the slope of snowH (below) tips the light per pixel
          float e = mix(1.2, 0.3, close);
          float h0 = snowH(p, near), hx = snowH(p + vec2(e, 0.0), near), hz = snowH(p + vec2(0.0, e), near);
          vec3 N = normalize(vec3((h0 - hx) / e, 1.0, (h0 - hz) / e));
#if NUM_DIR_LIGHTS > 0
          vec3 L = normalize((vec4(directionalLights[0].direction, 0.0) * viewMatrix).xyz);
#else
          vec3 L = normalize(vec3(0.5, 0.6, 0.4));
#endif
          float sh = (dot(N, L) - L.y) * 1.5, dip = smoothstep(0.62, 0.22, vn(p * 0.022)); // (sh: brighter or darker than flat snow; dip: the big hollows)
          vec3 c = c0 * 0.94;
          vec3 cool = uLook == 3.0 ? vec3(0.66, 0.77, 0.94) : vec3(0.60, 0.70, 0.95), warm = vec3(1.0, 0.965, 0.90);
          c = mix(c, c * cool, clamp(-sh * (uLook == 2.0 ? 2.2 : 1.7), 0.0, 0.85));
          c = mix(c, min(c * 1.14, vec3(1.0)) * warm, clamp(sh * 1.5, 0.0, 0.8));
          c = mix(c, c * vec3(0.80, 0.86, 1.0), dip * 0.6);
          if (uLook == 1.0) { float sc = smoothstep(0.6, 0.72, vn(p * 0.035 + 7.0)); c = mix(c, c * vec3(0.84, 0.87, 0.93), sc * 0.7); } // (wind-scoured crust)
          if (uLook == 3.0) { float cr = smoothstep(0.48, 0.66, vn(p * 0.05 + 3.0)); c = mix(c, c * vec3(0.78, 0.88, 0.98) + vec3(0.03), cr * 0.65); } // (glazed crust)
          c *= 1.0 + (vn(p * 3.1) * 0.6 + vn(p * 9.0) * 0.4 - 0.5) * 0.09 * close;
          gl_FragColor.rgb = mix(c0, c, snowy);
        } }
      { vec3 cell = floor(vWP * 7.0); float r = h3(cell); vec3 V = normalize(cameraPosition - vWP);
        float g = step(0.985, r) * pow(max(0.0, dot(V, normalize(vec3(h3(cell + 1.7) - 0.5, 1.0, h3(cell + 3.1) - 0.5)))), 24.0);
        float fade = 1.0 - smoothstep(25.0, 60.0, length(cameraPosition - vWP));
        gl_FragColor.rgb += vec3(0.9, 0.95, 1.0) * g * uSparkle * fade * (0.6 + 0.4 * gl_FragColor.g); }`);
  };
  return mat;
}

export class NorthWorld {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); this.group.name = 'frostmere'; this.group.visible = false;
    scene.add(this.group);
    this.built = false; this.building = null;
    this.holeU = Array.from({ length: MAX_HOLES }, () => new THREE.Vector3(0, 0, -1));
    // v1.16.2: fish swimming under the clear ice near you (x, z, heading, length), and the ice shader's clock
    this.fishU = Array.from({ length: UNDER_FISH }, () => new THREE.Vector4(0, 0, 0, 0));
    this.fishB = Array.from({ length: UNDER_FISH }, () => new THREE.Vector4(0.16, 0, 1, 7)); // (body width, depth, tail, swish rate)
    this.iceT = { value: 0 };
    this.underFish = [];
    this.floes = [];
  }

  /** Build it all (resolves when done). onProgress(0..1). */
  build(onProgress) {
    if (this.built) return Promise.resolve();
    if (this.building) return this.building;
    this.building = (async () => {
      await buildGridAsync(6); onProgress?.(0.3);
      this.buildTerrain(); await yieldFrame(); onProgress?.(0.45);
      this.buildIce(); await yieldFrame(); onProgress?.(0.55);
      this.buildWater(); await yieldFrame(); onProgress?.(0.6);
      this.buildMountains(); await yieldFrame(); onProgress?.(0.7);
      await this.buildScatter(); onProgress?.(0.9);
      this.buildStrip(); onProgress?.(1);
      this.built = true;
    })();
    return this.building;
  }

  // ---------------------------------------------------------------- the land
  buildTerrain() {
    const STEP = 2.0, CH = 4, half = NORTH.half, size = (half * 2) / CH, n = Math.round(size / STEP); // (v1.17.1: 2 m, was 2.5)
    const mat = sparkle(new THREE.MeshLambertMaterial({ vertexColors: true }), 1);
    const caveIce = C('#5a9cd0'), snow = C('#f3f7fb'), snowShade = C('#dfe9f3'), rock = C('#6f737b'), rockD = C('#555960'), glacier = C('#bfe3f3'), beach = C('#8b8a86'), grass = C('#b9ad86'), bed = C('#2d3d46'), tmp = new THREE.Color(), rockTmp = new THREE.Color();
    this.chunks = [];
    const hf = (u, v) => { // (the drawn ground: near any water, the smooth shore that carries on under the ice)
      const we = waterEdge(u, v);
      if (we > 4) return landAt(u, v);
      return Math.max(we < 0 ? (isIce(kindAt(u, v)) ? ICE_Y - 0.9 : WATER_Y - 1.2) : -99, Math.min(we > 0 ? landAt(u, v) + 0.6 : 99, renderHeight(u, v)));
    };
    for (let ci = 0; ci < CH; ci++) for (let cj = 0; cj < CH; cj++) {
      const u0 = -half + ci * size, v0 = -half + cj * size;
      const geo = new THREE.PlaneGeometry(size, size, n, n); geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const u = u0 + size / 2 + pos.getX(i), v = v0 + size / 2 + pos.getZ(i);
        // v1.17.1: near any water the ground follows renderHeight (the shore's slope carried smoothly on under the ice),
        // so the snow meets the ice along a clean curve instead of the grid's saw-tooth; under the ice it never drops far
        const k = kindAt(u, v);
        const h = hf(u, v);
        pos.setY(i, h);
        // colour: snow on gentle ground, rock on steep, blue glacier ice, a stony beach, tundra grass blown clear
        const e = 1.8, sl = Math.max(Math.abs(hf(u + e, v) - hf(u - e, v)), Math.abs(hf(u, v + e) - hf(u, v - e))) / (2 * e); // (v1.17.1: wider, so rock doesn't flicker vertex to vertex)
        const nz = noise(u * 0.08, v * 0.08), nz2 = noise(u * 0.31 + 9, v * 0.31);
        if (k !== K.LAND) tmp.copy(snowShade);
        else {
          tmp.copy(snow).lerp(snowShade, 0.35 + nz * 0.3);
          { // rock on the steep: a smooth ramp in, toned between grey and dark grey by broad noise (no 2 m flicker)
            const rk = Math.max(0, Math.min(1, (sl - 0.7 - nz * 0.15) * 1.4 + (h > 26 && nz > 0.25 ? 0.35 : 0)));
            if (rk > 0 && !groomed(u, v)) tmp.lerp(rockTmp.copy(rock).lerp(rockD, 0.5 + nz * 0.5), rk * rk * (3 - 2 * rk));
          }
          const gl = Math.hypot(u - P.glacier.u, v - P.glacier.v);
          if (gl < 70 && u < -260 && h > 10) tmp.lerp(glacier, Math.min(0.85, (70 - gl) / 40));
          if (v < coastV(u) + 7 && h < 3) tmp.lerp(beach, 0.55 + nz2 * 0.25);
          { const du = u - P.caves.u, dv = v - P.caves.v; if (du > -14 && du < 17 && Math.abs(dv - 2) < 34 && sl > 0.3) tmp.lerp(caveIce, Math.min(0.92, (sl - 0.3) * 1.4) * (1 - Math.max(0, Math.abs(dv - 2) - 22) / 12)); } // (v1.17.1: the Blue Caves' cliff is bare glacier ice)
          if (u > 140 && v > -120 && v < 140 && nz2 > 0.42 && sl < 0.3) tmp.lerp(grass, (nz2 - 0.42) * 2.2);
        }
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      // v1.17.1: normals from the ground itself (central differences 1.6 m either way), not from the 2 m triangles:
      // steep banks and the stream's ravine shaded in smooth sweeps instead of saw-toothed diamonds
      const nor = new Float32Array(pos.count * 3), E = 1.6;
      for (let i = 0; i < pos.count; i++) {
        const u = u0 + size / 2 + pos.getX(i), v = v0 + size / 2 + pos.getZ(i);
        const nx = -(hf(u + E, v) - hf(u - E, v)) / (2 * E), nz = -(hf(u, v + E) - hf(u, v - E)) / (2 * E), l = Math.hypot(nx, 1, nz);
        nor[i * 3] = nx / l; nor[i * 3 + 1] = 1 / l; nor[i * 3 + 2] = nz / l;
      }
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      // and each 2 m square is split along whichever diagonal is flatter, so a steep bank that runs across the grid at an
      // angle keeps a straight edge instead of zigzagging (and so does its shadow)
      { const W1 = n + 1, ix = []; const H = (k) => pos.getY(k);
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
          const a = r * W1 + c, b = a + 1, d = a + W1, e = d + 1; // (PlaneGeometry: rows along z, columns along x)
          if (Math.abs(H(a) - H(e)) <= Math.abs(H(b) - H(d))) ix.push(a, d, e, a, e, b); else ix.push(a, d, b, b, d, e);
        }
        geo.setIndex(ix); }
      const m = new THREE.Mesh(geo, mat);
      const w = toWorld(u0 + size / 2, v0 + size / 2);
      m.position.set(w.x, 0, w.z); m.receiveShadow = true; m.name = 'north-ground';
      this.group.add(m); this.chunks.push(m);
    }
  }

  // ---------------------------------------------------------------- the ice
  buildIce() {
    const STEP = 2, half = NORTH.half, n = Math.round((half * 2) / STEP);
    // one big grid; keep only the quads that are over ice
    const verts = [], cols = [], idx = [], map = new Int32Array((n + 1) * (n + 1)).fill(-1);
    const snowIce = C('#e2eef6'), clear = C('#1f4c66'), clear2 = C('#3a7896'), thin = C('#6f90a4'), blue = C('#86c6e2'), river = C('#c8e0ec'), tmp = new THREE.Color();
    const at = (i, j) => {
      const k = i * (n + 1) + j; if (map[k] >= 0) return map[k];
      const u = -half + i * STEP, v = -half + j * STEP, w = toWorld(u, v);
      let kk = kindAt(u, v); const t = thinIce(u, v), nz = noise(u * 0.045, v * 0.045), nz2 = noise(u * 0.18 + 3, v * 0.18);
      // (v1.17.1: a corner out on the shore takes the colour of the ice beside it: white corners made white teeth)
      const onShore = !isIce(kk);
      if (onShore) for (const [du, dv] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP], [STEP, STEP], [-STEP, -STEP], [STEP, -STEP], [-STEP, STEP]]) { const q = kindAt(u + du, v + dv); if (isIce(q)) { kk = q; break; } }
      // snow-covered ice in drifts, clear black ice where the wind swept it, grey thin ice, blue by the ridge
      tmp.copy(snowIce);
      if (kk === K.LAKE) { const c = Math.max(0, Math.min(1, (nz + 0.3) * 1.9)); tmp.lerp(depthAt(u, v) > 14 ? clear : clear2, c * 0.9); }
      if (kk === K.RIVER) tmp.copy(river).lerp(clear2, Math.max(0, nz2) * 0.6);
      if (kk === K.SEAICE) tmp.lerp(C('#dce8ef'), 0.5 + nz2 * 0.3);
      tmp.lerp(thin, t * 0.75);
      const rd = ridgeDist(u, v); if (kk === K.LAKE && rd < 12) tmp.lerp(blue, (12 - rd) / 12 * 0.6);
      // (v1.17.1: the ice's outermost corners, out on the shore, tuck down under the snow, so the edge you see is where
      // the shore's smooth slope meets the ice, not the 2 m grid's square teeth)
      let yI = !onShore ? ICE_Y + (kk === K.SEAICE ? Math.max(0, nz2) * 0.12 : 0) : ICE_Y - 0.35;
      // at the floe edge there's no shore to hide the teeth: a corner out over the open sea slides up onto the floe
      // line itself (staying level), so the sea ice ends along the edge's own curve
      if (onShore && kindAt(u, v) === K.SEA && kk === K.SEAICE) { const fv = floeV(u) + 0.05; if (fv > v && fv - v <= STEP * 1.5) { w.z = NORTH.z + fv; yI = ICE_Y; } }
      verts.push(w.x, yI, w.z); cols.push(tmp.r, tmp.g, tmp.b);
      return (map[k] = verts.length / 3 - 1);
    };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const u = -half + (i + 0.5) * STEP, v = -half + (j + 0.5) * STEP;
      if (!isIce(kindAt(u, v)) && !isIce(kindAt(u - STEP, v)) && !isIce(kindAt(u + STEP, v)) && !isIce(kindAt(u, v - STEP)) && !isIce(kindAt(u, v + STEP))) continue; // (one cell over onto the shore: no gaps)
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      idx.push(a, d, b, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(verts.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const holes = this.holeU;
    const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 140, specular: '#8fb0c4' });
    const fishU = this.fishU, fishB = this.fishB, iceT = this.iceT;
    mat.onBeforeCompile = (s) => {
      s.uniforms.uHoles = { value: holes }; s.uniforms.uFish = { value: fishU }; s.uniforms.uFishB = { value: fishB }; s.uniforms.uT = iceT;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWP; uniform vec3 uHoles[${MAX_HOLES}]; uniform vec4 uFish[${UNDER_FISH}]; uniform vec4 uFishB[${UNDER_FISH}]; uniform float uT;
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453), c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
        float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float cellEdge(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = vec2(hsh(i + g), hsh(i + g + 7.3));
            float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
          return d2 - d1; }`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          for (int i = 0; i < ${MAX_HOLES}; i++) { vec3 h = uHoles[i]; if (h.z > 0.0 && distance(vWP.xz, h.xy) < h.z) discard; }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          // v1.16.2 the look of real lake ice: frosty blue snow-ice, and where it's clear you see down into it:
          // trapped air bubbles near the top, the dark water further down, and fish gliding past underneath
          { vec3 Vd = normalize(vWP - cameraPosition);
            float clr = 1.0 - smoothstep(0.4, 0.75, diffuseColor.r), see = 0.3 + 0.7 * clr;
            vec2 par = Vd.xz / max(0.2, -Vd.y);
            // frost: a cold blue in the hollows of the snow-ice, a little sparkle
            float fr = vn(vWP.xz * 0.35) * 0.6 + vn(vWP.xz * 1.7) * 0.4;
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.9, 1.04), (1.0 - clr) * (0.35 + fr * 0.65));
            float spark = step(0.995, fract(sin(dot(floor(vWP.xz * 9.0), vec2(12.9898, 78.233))) * 43758.5453)) * (1.0 - clr);
            // the depth: teal-blue swirls of old water a metre down, seen through the clear ice
            vec2 dp = vWP.xz + par * 1.3;
            float sw = vn(dp * 0.12 + vec2(uT * 0.01, 0.0)) * 0.6 + vn(dp * 0.45) * 0.4;
            vec3 deep = mix(vec3(0.05, 0.2, 0.28), vec3(0.16, 0.42, 0.52), sw);
            diffuseColor.rgb = mix(diffuseColor.rgb, deep, clr * 0.62);
            // the fish (v1.17.1): soft dark shapes, nose first along their heading, the body flexing in a wave that grows
            // toward the tail; each kind its own build (a slim pike, a trout, a deep-bodied perch, an eel-ish burbot),
            // pectoral fins, and the deeper ones fainter and blurrier
            float sh = 0.0; vec2 fp = vWP.xz + par * 1.1;
            for (int i = 0; i < ${UNDER_FISH}; i++) { vec4 F = uFish[i]; if (F.w <= 0.0) continue; vec4 B = uFishB[i];
              vec2 q = fp - F.xy; float cs = cos(F.z), sn = sin(F.z); q = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
              float L = F.w, along = clamp(-q.y / L + 0.3, 0.0, 1.2);
              q.x -= sin(q.y * 4.0 / L - uT * B.w + float(i) * 1.7) * 0.06 * L * along * along;
              float wid = B.x * L * (1.0 - smoothstep(-0.1, 0.5, q.y / L) * 0.55) * (1.0 - smoothstep(-0.1, -0.5, q.y / L) * 0.6);
              float body = length(vec2(q.x / max(0.001, wid), q.y / (0.52 * L)));
              vec2 tq = q - vec2(0.0, -0.56 * L * B.z); float tail = max(abs(tq.x) - (0.015 + max(0.0, -tq.y) * 0.55) * L, abs(tq.y + 0.08 * L) - 0.11 * L);
              vec2 fq = vec2(abs(q.x) - wid * 1.05, q.y - 0.18 * L); float fin = length(fq / vec2(0.09 * L, 0.05 * L));
              float soft = 0.25 + B.y * 0.5;
              float s1 = max(max(1.0 - smoothstep(1.0 - soft, 1.0 + soft * 0.4, body), 1.0 - smoothstep(-0.01, 0.03 * L + B.y * 0.06, tail)), (1.0 - smoothstep(0.6, 1.2, fin)) * 0.7);
              sh = max(sh, s1 * (1.0 - B.y * 0.55)); }
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.32, 0.42, 0.52), sh * 0.78 * see);
            // bubbles frozen in the top of the ice
            vec2 bq = (vWP.xz + par * 0.22) * 4.0; vec2 bc = floor(bq), bf = fract(bq) - 0.5;
            float bh = fract(sin(dot(bc, vec2(41.3, 289.1))) * 43758.5453);
            float bub = step(0.965, bh) * (1.0 - smoothstep(0.015, 0.03 + fract(bh * 13.0) * 0.05, length(bf + (vec2(bh, fract(bh * 7.0)) - 0.5) * 0.6)));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.93, 1.0), bub * clr * 0.45 + spark * 0.5);
            // the sky's glare off the surface at a low angle
            float fres = pow(1.0 - abs(Vd.y), 3.0);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.8, 0.94), fres * 0.28); }
          { float c1 = cellEdge(vWP.xz * 0.07), c2 = cellEdge(vWP.xz * 0.23 + 5.0);
            float crack = (1.0 - smoothstep(0.0, 0.012, c1)) * 0.35 + (1.0 - smoothstep(0.0, 0.008, c2)) * 0.18;
            float clearIce = 1.0 - smoothstep(0.35, 0.65, diffuseColor.r);
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.95, 0.98, 1.0), vec3(0.75, 0.88, 0.95), clearIce), crack * (0.4 + 0.6 * clearIce)); }`);
    };
    this.ice = new THREE.Mesh(geo, mat); this.ice.name = 'north-ice'; this.ice.receiveShadow = true;
    this.group.add(this.ice);
    // the inside of each hole: a dark water disc below the ice, an ice-blue wall, and a slushy rim (pooled meshes)
    this.holeMeshes = [];
    const water = new THREE.MeshPhongMaterial({ color: '#0e2a36', shininess: 120, specular: '#6a8a9a' });
    const wall = new THREE.MeshLambertMaterial({ color: '#8cc4dc', side: THREE.BackSide });
    const slush = new THREE.MeshLambertMaterial({ color: '#dde9f0' });
    const discG = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), wallG = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), rimG = new THREE.TorusGeometry(1.05, 0.12, 5, 20).rotateX(Math.PI / 2);
    for (let i = 0; i < MAX_HOLES; i++) {
      const g = new THREE.Group(); g.visible = false;
      // (the disc sits just under the ice top, above the snow ground the ice sheet covers)
      const d = new THREE.Mesh(discG, water); d.position.y = -0.045; g.add(d);
      const w = new THREE.Mesh(wallG, wall); w.scale.y = 0.06; w.position.y = -0.02; g.add(w);
      const r = new THREE.Mesh(rimG, slush); r.position.y = 0.03; g.add(r);
      g.userData = { disc: d, rim: r, water };
      this.group.add(g); this.holeMeshes.push(g);
    }
  }
  /** Show the holes (an array of { x, z, r, skin 0..1 }), cut out of the ice. */
  setHoles(list) {
    for (let i = 0; i < MAX_HOLES; i++) {
      const h = list[i], m = this.holeMeshes?.[i];
      if (!h) { this.holeU[i].set(0, 0, -1); if (m) m.visible = false; continue; }
      this.holeU[i].set(h.x, h.z, h.r);
      if (m) {
        m.visible = true; m.position.set(h.x, ICE_Y, h.z); m.scale.set(h.r, 1, h.r);
        m.userData.disc.material = h.skin > 0.6 ? this.skinMat || (this.skinMat = new THREE.MeshLambertMaterial({ color: '#a8c4d0' })) : m.userData.water;
      }
    }
  }

  // ---------------------------------------------------------------- open water and floes
  buildWater() {
    const half = NORTH.half;
    // the sea: a big plane across the north, from past the map edge to the floe edge (the ice sheet hides the rest)
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 900, 700, 1, 1).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ color: '#16323f', shininess: 110, specular: '#8fb0c0' }));
    const w = toWorld(0, -half - 120); sea.position.set(w.x, WATER_Y, w.z); sea.name = 'north-sea'; this.group.add(sea);
    this.seaMesh = sea;
    // the pools: a warm, steaming spring and the falls' plunge pool
    const pool = new THREE.MeshPhongMaterial({ color: '#1d4a56', shininess: 120, specular: '#a0c8d4', transparent: true, opacity: 0.94 });
    for (const p of [SPRINGS, FALLS_POOL, ...HOLLOW]) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(p.r + 0.5, 28).rotateX(-Math.PI / 2), pool);
      const q = toWorld(p.u, p.v); m.position.set(q.x, WATER_Y, q.z); this.group.add(m);
    }
    // drifting floes off the edge: flat slabs of snow-topped ice in five shapes, instanced (they drift and bob)
    const r = mulberry32(55), shapes = [];
    for (let k = 0; k < 5; k++) {
      const shape = new THREE.Shape(), n = 7;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = 0.7 + r() * 0.5; if (i) shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.04, bevelSegments: 1 }); geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), top = C('#eef4f8'), side = C('#9fcbe0');
      for (let i = 0; i < pos.count; i++) { const c = pos.getY(i) > 0.05 ? top : side; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      shapes.push(geo);
    }
    this.floeMeshes = shapes.map((geo) => { const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), 12); im.count = 0; im.frustumCulled = false; this.group.add(im); return im; });
    for (let i = 0; i < 46; i++) {
      const u = -330 + r() * 660, v = floeV(u) - 6 - r() * 90, s = 3 + r() * 9, k = i % 5;
      const im = this.floeMeshes[k];
      if (im.count >= 12) continue;
      this.floes.push({ u, v, s, ry: r() * 6, ph: r() * 6, sp: 0.05 + r() * 0.15, im, i: im.count++ });
    }
  }

  // ---------------------------------------------------------------- far mountains
  buildMountains() {
    const seg = 96, rings = 4, geo = new THREE.BufferGeometry(), pos = [], col = [], idx = [];
    const snow = C('#f2f6fa'), rock = C('#6a7078'), tmp = new THREE.Color();
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2;
      for (let k = 0; k <= rings; k++) {
        const t = k / rings;
        const north = Math.sin(a) < -0.55; // (the sea side stays low: the open horizon beyond the floe edge)
        const r0 = 430 + t * 160;
        const peak = (north ? 4 : 70 + noise(Math.cos(a) * 6, Math.sin(a) * 6) * 55 + noise(a * 9, 1) * 18) * Math.sin(t * Math.PI) ** 0.7;
        const x = NORTH.x + Math.cos(a) * r0, z = NORTH.z + Math.sin(a) * r0;
        pos.push(x, (north ? -2 : 8) + peak, z);
        tmp.copy(rock).lerp(snow, Math.min(1, Math.max(0, (peak - 25) / 35 + noise(a * 20, t * 4) * 0.3)));
        col.push(tmp.r, tmp.g, tmp.b);
      }
    }
    for (let i = 0; i < seg; i++) for (let k = 0; k < rings; k++) { const a = i * (rings + 1) + k, b = a + rings + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: true }));
    m.name = 'north-peaks'; this.group.add(m);
  }

  // ---------------------------------------------------------------- the scatter (instanced)
  async buildScatter() {
    const r = mulberry32(1203);
    const clear = (u, v) => { // keep places and paths open
      for (const p of Object.values(P)) if (Math.hypot(u - p.u, v - p.v) < (p === P.village ? 74 : p === P.taiga ? 0 : 22)) return false;
      if (riverDist(u, v).d < RIVER_W) return false;
      if (trailDist(u, v) < 6) return false; // (the sled trails and the Ring Line)
      if (groomed(u, v)) return false; // (Skyline's piste and the Big Air Jump)
      if (u > -345 && u < 40 && Math.abs(v - 60) < 18) return false; // (the plane's way in and out over the western shore)
      return true;
    };
    const kinds = [
      { names: ['nf_spruce_a', 'nf_spruce_b', 'nf_spruce_c', 'nf_spruce_d', 'nf_spruce_e', 'nf_spruce_f', 'nf_spruce_g', 'nf_spruce_h', 'nf_spruce_i', 'nf_spruce_j'], n: 1500, rad: 0.7, ok: (u, v, h) => {
        const taiga = Math.exp(-((u - P.taiga.u) ** 2 + (v - P.taiga.v) ** 2) / (2 * 110 ** 2)) + (v > 120 ? 0.35 : 0) + (u < -150 && v > -60 ? 0.3 : 0);
        return h < 30 && r() < taiga * 0.9 + 0.04; } },
      { names: ['nf_spruce_bare'], n: 220, rad: 0.4, ok: (u, v, h) => h < 20 && (u > 100 || r() < 0.35) }, // (v1.17.1: storm-killed snags across the whole map, not just the east)
      { names: ['nf_rock_a', 'nf_rock_b', 'nf_rock_c'], n: 760, rad: 1.0, ok: (u, v, h) => h < 40 && (h > 8 || v < coastV(u) + 20 || waterEdge(u, v) < 10 || r() < 0.3) },
      { names: ['nf_drift'], n: 480, rad: 0, sink: 0.3, tint: new THREE.Color(1.3, 1.32, 1.36), ok: (u, v, h) => h < 18 }, // (sunk deeper: just the crests show, so they read as drifts, not slabs)
      { names: ['nf_grass'], n: 1700, rad: 0, ok: (u, v, h) => h < 10 && v > -150 && (u > 100 || r() < 0.45) }, // (dry grass poking through the snow, everywhere low)
      // v1.17.1: shore ice: slabs the winter's freeze shoved up onto the banks of the lake and the river (solid)
      { names: ['ic_shard_a', 'ic_shard_b', 'ic_shard_c', 'ic_shard_d', 'ic_shard_e'], n: 340, rad: 0.8, tries: 90000, ok: (u, v) => { const we = waterEdge(u, v); return we > 0.4 && we < 2.6 && lakeSd(u, v) < 40; } },
    ];
    this.inst = [];
    const cells = 3, cellSize = (NORTH.half * 2) / cells;
    for (const k of kinds) {
      // pick spots
      const spots = [];
      let tries = 0;
      while (spots.length < k.n && tries < (k.tries || k.n * 12)) {
        tries++;
        const u = -NORTH.half + 12 + r() * (NORTH.half * 2 - 24), v = -NORTH.half + 12 + r() * (NORTH.half * 2 - 24);
        if (kindAt(u, v) !== K.LAND || !clear(u, v)) continue;
        const h = landAt(u, v);
        if (!k.ok(u, v, h)) continue;
        const e = 1, sl = Math.max(Math.abs(landAt(u + e, v) - landAt(u - e, v)), Math.abs(landAt(u, v + e) - landAt(u, v - e))) / 2;
        if (sl > 1.2) continue;
        spots.push({ u, v, h: h - 0.15 - sl * 0.4 - (k.sink || 0), s: 0.75 + r() * 0.6, ry: r() * Math.PI * 2, which: Math.floor(r() * k.names.length) });
      }
      // one instanced mesh per variant and cell (materials baked into vertex colours: one draw each)
      k.names.forEach((name, wi) => {
        const items = spots.filter((s) => s.which === wi).map((s) => { const w = toWorld(s.u, s.v); return { x: w.x, y: s.h, z: w.z, ry: s.ry, s: s.s }; });
        this.inst.push(...instanced(this.group, name, items, { shadow: name.startsWith('nf_spruce'), cells: 3, half: NORTH.half, cx: NORTH.x, cz: NORTH.z, tint: k.tint || null }));
      });
      if (k.rad) for (const s of spots) { const w = toWorld(s.u, s.v); addCircle(w.x, w.z, k.rad * s.s); }
      await yieldFrame();
    }
  }

  // ---------------------------------------------------------------- Hearthwick ice strip
  buildStrip() {
    const S = P.strip, g = new THREE.Group(); g.name = 'north-strip';
    // the strip runs west to east along v = S.v, from u -150 to u 40; cones every 20 m along both edges, lamps between
    this.stripLamps = [];
    const cones = [], lamps = [];
    for (let u = -150; u <= 40; u += 20) for (const s of [-1, 1]) {
      const w = toWorld(u, S.v + s * 13); cones.push({ x: w.x, y: ICE_Y, z: w.z });
      const w2 = toWorld(u + 10, S.v + s * 13); lamps.push({ x: w2.x, y: ICE_Y, z: w2.z });
    }
    instanced(g, 'ab_cone', cones); this.stripLamps = instanced(g, 'ab_striplamp', lamps);
    for (const l of lamps) addCircle(l.x, l.z, 0.2);
    this.group.add(g);
  }

  /** Each frame while up north: floes drift and bob, the sea swells a little. */
  update(dt, t, cam) {
    if (!this.built) return;
    const m4 = this._m4 || (this._m4 = new THREE.Matrix4()), q = this._q || (this._q = new THREE.Quaternion()), sc = this._s || (this._s = new THREE.Vector3()), p = this._p || (this._p = new THREE.Vector3()), up = this._up || (this._up = new THREE.Vector3(0, 1, 0));
    for (const f of this.floes) {
      f.u += dt * f.sp; if (f.u > 340) f.u = -340;
      f.ry += dt * 0.004 * (f.ph > 3 ? 1 : -1);
      const w = toWorld(f.u, f.v);
      p.set(w.x, WATER_Y - 0.05 + Math.sin(t * 0.8 + f.ph) * 0.05, w.z); q.setFromAxisAngle(up, f.ry); sc.set(f.s, 6, f.s);
      m4.compose(p, q, sc); f.im.setMatrixAt(f.i, m4);
    }
    for (const im of this.floeMeshes || []) im.instanceMatrix.needsUpdate = true;
    this.iceT.value = t;
    this.updateUnderFish(dt, cam);
  }
  /** Fish under the ice near you: they cruise, turn away from the shore, and get recycled ahead of you as you go. */
  updateUnderFish(dt, cam) {
    if (!cam) return;
    const F = this.underFish, r = Math.random, ok = (x, z) => { const [u, v] = toLocalXZ(x, z); const k = kindAt(u, v); return k === K.LAKE || k === K.RIVER; };
    while (F.length < UNDER_FISH) F.push({ x: 0, z: 0, yaw: 0, v: 0, len: 0, turn: 0, live: false });
    // the kinds: [body width ratio, tail length, chance]: pike, trout, perch, burbot, whitefish
    const KINDS = [[0.11, 1.15, 0.2], [0.16, 1.0, 0.3], [0.22, 0.9, 0.2], [0.13, 1.25, 0.1], [0.15, 1.0, 0.2]];
    for (const f of F) {
      if (!f.live || Math.hypot(f.x - cam.x, f.z - cam.z) > 34) {
        // a new one somewhere round you, over water
        f.live = false;
        for (let k = 0; k < 6 && !f.live; k++) {
          const a = r() * Math.PI * 2, d = 6 + r() * 22, x = cam.x + Math.sin(a) * d, z = cam.z + Math.cos(a) * d;
          if (!ok(x, z)) continue;
          let pick = r(), K = KINDS[0]; for (const q of KINDS) { pick -= q[2]; if (pick <= 0) { K = q; break; } }
          const big = r() < 0.12;
          Object.assign(f, { x, z, yaw: r() * Math.PI * 2, v: 0.35 + r() * 0.8, vNow: 0.5, len: big ? 1.4 + r() * 1.1 : 0.4 + r() * 0.7, turn: 0, wantTurn: 0, live: true, w: K[0] * (0.9 + r() * 0.2), tail: K[1], depth: r() * 0.8, glide: 0, swish: 6 + r() * 3 });
        }
        continue;
      }
      // cruise, glide now and then, and turn gently (never sliding sideways: they only ever move nose first)
      f.glide -= dt;
      if (f.glide < -6 - r() * 8) f.glide = 1.5 + r() * 2;
      f.vNow += ((f.glide > 0 ? f.v * 0.35 : f.v) - f.vNow) * Math.min(1, dt * 0.8);
      if (r() < dt * 0.25) f.wantTurn = (r() - 0.5) * 0.9;
      const ahead = ok(f.x + Math.sin(f.yaw) * 2.5, f.z + Math.cos(f.yaw) * 2.5);
      if (!ahead) f.wantTurn = (f.wantTurn >= 0 ? 1 : -1) * 1.4; // (the shore ahead: turn away, smoothly)
      f.turn += (f.wantTurn - f.turn) * Math.min(1, dt * 1.5); f.yaw += f.turn * dt * Math.max(0.4, f.vNow);
      const nx = f.x + Math.sin(f.yaw) * f.vNow * dt, nz = f.z + Math.cos(f.yaw) * f.vNow * dt;
      if (ok(nx, nz)) { f.x = nx; f.z = nz; }
    }
    F.forEach((f, i) => { this.fishU[i].set(f.x, f.z, f.yaw, f.live ? f.len : 0); this.fishB[i].set(f.w || 0.16, f.depth || 0, f.tail || 1, f.swish || 7); });
  }
  setVisible(on) { this.group.visible = on; }
}
export { lakeSd };
