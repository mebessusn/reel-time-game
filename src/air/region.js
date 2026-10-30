// Skye's Air Races: the land circuits' flying regions. Each is a big landscape of its own (about 2.5 to 3 km across)
// grown round its track: natural hills, cliffs or islands from noise, with a flying corridor carved along the line
// (so the track always has room, and the scenery crowds in close beside it), narrow cuts for the shortcuts behind
// ridges, water in the low ground, and the game's own props (the valley's trees, Frostmere's spruce and rock,
// Open Waters' palms) scattered thickly near the line and thinly far off.
//
// Biomes: valley (Five Lakes), fjord (Frostmere's glaciers), taiga, tropic (Open Waters), desert, mixed.
import * as THREE from 'three';
import { makeNoise2D, mulberry32 } from '../core/rng.js';
import { instanced, addLibrary, merged } from '../north/instancing.js';
import { NATURE_MATS, NATURE_NODES } from '../data/natureMesh.js';
import { ISLAND_MATS, ISLAND_NODES } from '../data/islandMesh.js';
import { ISLEPROP_MATS, ISLEPROP_NODES } from '../data/islePropsMesh.js';
import { AIRRACES_MATS, AIRRACES_NODES } from '../data/airracesMesh.js';
import { FROSTWILD_MATS, FROSTWILD_NODES } from '../data/frostwildMesh.js';
import { AIRSCENERY_MATS, AIRSCENERY_NODES } from '../data/airsceneryMesh.js';

let libsAdded = false;
export function addAirLibraries() {
  if (libsAdded) return; libsAdded = true;
  addLibrary(NATURE_MATS, NATURE_NODES); addLibrary(ISLAND_MATS, ISLAND_NODES); addLibrary(ISLEPROP_MATS, ISLEPROP_NODES);
  addLibrary(AIRRACES_MATS, AIRRACES_NODES); addLibrary(FROSTWILD_MATS, FROSTWILD_NODES); addLibrary(AIRSCENERY_MATS, AIRSCENERY_NODES);
}

// per biome: the ground's colours, how hilly, where the water is, the sky, and what grows
export const BIOMES = {
  valley: {
    sky: { top: '#3f7fd0', mid: '#a8d0f0', fog: '#c8dcea' }, amp: 70, rough: 0.5, cliff: 0,
    col: { low: '#d8c890', grass: '#6aa84a', grass2: '#4f8a3a', rock: '#8a8478', high: '#a49a88', snow: '#f2f4f6', bed: '#5a8a7a' },
    water: '#3a8aa8', props: [['oak0', 0.14, 1.8], ['oak1', 0.12, 1.8], ['oak2', 0.1, 1.9], ['birch0', 0.1, 1.9], ['birch1', 0.08, 1.9], ['pine0', 0.12, 2.0], ['pine1', 0.1, 2.0], ['autumn0', 0.05, 1.8], ['bush0', 0.08, 1.6], ['bush1', 0.06, 1.6], ['as_rock_g1', 0.025, 1.6], ['as_rock_g2', 0.02, 1.6], ['as_rock_g3', 0.012, 1.5], ['as_stones', 0.03, 1.6]],
    rocks: ['as_rock_g1', 'as_rock_g2', 'as_rock_g3', 'as_stones'], towns: ['farm', 'farm', 'hamlet'],
  },
  fjord: {
    sky: { top: '#3a6ab8', mid: '#c8dcf0', fog: '#d4e0ec' }, amp: 150, rough: 0.6, cliff: 1,
    col: { low: '#c8d4dc', grass: '#e6eef4', grass2: '#d2dee8', rock: '#6a7480', high: '#9aa4b0', snow: '#f8fbff', bed: '#2a4a5a' },
    water: '#2a5a78', density: 0.55, props: [['nf_spruce_a', 0.1, 2.0], ['nf_spruce_b', 0.08, 2.0], ['nf_spruce_c', 0.08, 2.0], ['nf_spruce_d', 0.1, 2.0], ['nf_spruce_e', 0.07, 2.0], ['nf_spruce_g', 0.09, 2.0], ['nf_spruce_h', 0.05, 2.0], ['nf_spruce_i', 0.04, 2.0], ['nf_spruce_j', 0.06, 2.0], ['pine0_snow', 0.08, 2.0], ['as_rock_s1', 0.06, 1.8], ['as_rock_s2', 0.04, 1.8], ['nf_rock_c', 0.04, 2.6], ['nf_ice_spire', 0.03, 1.8]],
    rocks: ['as_rock_s1', 'as_rock_s2', 'as_rock_g3', 'as_stones'], towns: ['fishing', 'fishing', 'cabins'],
  },
  taiga: {
    sky: { top: '#3a70c0', mid: '#b8d4ea', fog: '#c4d4e0' }, amp: 55, rough: 0.45, cliff: 0,
    col: { low: '#b8b090', grass: '#4f7a44', grass2: '#3a6038', rock: '#7a7468', high: '#8a8070', snow: '#eef2f4', bed: '#4a6a5a' },
    water: '#3a7088', density: 0.8, props: [['nf_spruce_a', 0.12, 2.3], ['nf_spruce_b', 0.1, 2.3], ['nf_spruce_c', 0.1, 2.3], ['nf_spruce_d', 0.12, 2.3], ['nf_spruce_e', 0.08, 2.3], ['nf_spruce_f', 0.12, 2.3], ['nf_spruce_h', 0.06, 2.3], ['nf_spruce_i', 0.05, 2.3], ['pine0', 0.12, 2.3], ['pine2', 0.12, 2.3], ['birch0', 0.06, 2.0], ['as_rock_g1', 0.025, 1.6], ['as_rock_g3', 0.015, 1.6]],
    rocks: ['as_rock_g1', 'as_rock_g2', 'as_rock_g3', 'as_stones'], towns: ['cabins', 'cabins', 'fishing'],
  },
  tropic: {
    sky: { top: '#2f7ad8', mid: '#a8dcf4', fog: '#c8e8f4' }, amp: 40, rough: 0.55, cliff: 0, islands: true,
    col: { low: '#f0dca0', grass: '#5aaa4a', grass2: '#3a8a3a', rock: '#7a7468', high: '#5a7a4a', snow: '#5a7a4a', bed: '#7ad8c8' },
    water: '#2ab0c8', props: [['isle_palm_a', 0.3, 2.2], ['isle_palm_b', 0.3, 2.2], ['isle_palm_c', 0.25, 2.2], ['isle_banana_a', 0.1, 2.0], ['isle_seagrape', 0.1, 2.0], ['isle_hibiscus', 0.06, 2.0], ['isle_rock_a', 0.04, 2.4], ['as_rock_v1', 0.03, 1.6], ['as_rock_v2', 0.03, 1.6]],
    rocks: ['as_rock_v1', 'as_rock_v2', 'isle_rock_a'], towns: ['village', 'village'],
  },
  desert: {
    sky: { top: '#4a86d0', mid: '#f2dcc0', fog: '#ecd8c0' }, amp: 110, rough: 0.5, cliff: 1, mesas: true,
    col: { low: '#e2b884', grass: '#c89a62', grass2: '#b8804a', rock: '#b05a36', high: '#c8703e', snow: '#d89a62', bed: '#a86a40' },
    water: '#3a8aa8', density: 0.55, props: [['ar_hoodoo', 0.12, 0.32], ['ar_mesa', 0.012, 0.14], ['bush2', 0.12, 1.4], ['as_rock_r1', 0.03, 1.8], ['as_rock_r2', 0.025, 1.8]],
    rocks: ['as_rock_r1', 'as_rock_r2'], towns: ['pueblo', 'ranch'],
  },
  mixed: {
    sky: { top: '#2a3478', mid: '#f0a072', fog: '#d8b8a8' }, amp: 90, rough: 0.55, cliff: 0.5,
    col: { low: '#d8c890', grass: '#5a9a44', grass2: '#4a7a3a', rock: '#8a7a68', high: '#9a8a78', snow: '#f2f4f6', bed: '#4a7a7a' },
    water: '#3a7898', props: [['pine0', 0.15, 2.0], ['oak0', 0.1, 1.9], ['nf_spruce_a', 0.12, 2.1], ['autumn1', 0.08, 1.8], ['birch1', 0.06, 1.9], ['as_rock_g1', 0.03, 1.6], ['as_rock_g2', 0.025, 1.6], ['as_stones', 0.02, 1.6]],
    rocks: ['as_rock_g1', 'as_rock_g2', 'as_stones'], towns: ['farm', 'hamlet', 'ranch'],
  },
};

// v1.17.1: the people of the land: little settlements by biome. Each item: [mesh, dx, dz, yaw, radius, height]
// in the town's own frame (+z is downhill: fronts look out over the valley, jetties run down into the water).
const H = Math.PI / 2;
const TOWNS = {
  farm: { field: [-26, 26, 18, 56], items: [['as_farmhouse', 0, 0, 0, 7, 10], ['as_barn', 22, -6, -H, 9, 11], ['as_silo', 30, -16, 0, 2.2, 15], ['as_haybales', 4, 24, 0.4, 3, 2], ['as_haybales', -14, 34, 1.2, 3, 2],
    ['as_cart', 10, 8, 0.8, 2, 2.5], ['as_fence', -20, 16, 0, 0, 0], ['as_fence', -8, 16, 0, 0, 0], ['as_fence', 8, 16, 0, 0, 0], ['as_fence', 20, 16, 0, 0, 0], ['as_fence', -26, 22, H, 0, 0], ['as_fence', -26, 34, H, 0, 0], ['as_fence', 26, 22, H, 0, 0], ['as_fence', 26, 34, H, 0, 0]] },
  hamlet: { items: [['as_cottage', 0, 0, 0, 5, 6], ['as_cottage', 15, 5, -0.5, 5, 6], ['as_cottage', -13, 8, 0.4, 5, 6], ['as_chapel', 3, -20, 0, 8, 17], ['as_fence', -6, 10, 0, 0, 0], ['as_fence', 9, 13, -0.3, 0, 0], ['as_cart', -6, -9, 1.9, 2, 2.5], ['as_haybales', 22, -8, 0.3, 3, 2]] },
  cabins: { items: [['as_logcabin', 0, 0, 0, 5, 7], ['as_logcabin', 15, -6, -0.6, 5, 7], ['as_logcabin', -12, -9, 0.5, 5, 7], ['as_fence', 2, 9, 0, 0, 0]] },
  fishing: { shore: true, items: [['as_rorbu', 0, 0, 0, 6, 8], ['as_rorbu', 11, 2, -0.12, 6, 8], ['as_rorbu', -10, 3, 0.15, 6, 8], ['as_jetty', 3, 6, 0, 0, 0], ['as_jetty', -12, 9, 0.1, 0, 0], ['as_logcabin', 4, -16, 0, 5, 7]] },
  village: { shore: true, items: [['as_stilthut', 0, 0, 0, 4, 8], ['as_stilthut', 9, 3, -0.3, 4, 8], ['as_stilthut', -8, 5, 0.4, 4, 8], ['as_jetty', 1, 6, 0, 0, 0], ['as_canoe', 6, 12, 1.2, 0, 0], ['as_canoe', -5, 13, 1.6, 0, 0], ['as_stilthut', 2, -11, 0.2, 4, 8]] },
  pueblo: { items: [['as_adobe', 0, 0, 0, 5, 5], ['as_adobe', 12, 2, 0.2, 5, 5], ['as_adobe', -10, -6, -0.3, 5, 5], ['as_adobe', 4, -14, 3.1, 5, 5], ['as_windpump', 4, 15, 0.6, 2.4, 11]] },
  ranch: { field: [-24, 24, 20, 50], items: [['as_farmhouse', 0, 0, 0, 7, 10], ['as_watertower', 15, -9, 0, 3, 15], ['as_windpump', -13, 9, 0.8, 2.4, 11], ['as_barn', -6, -22, H, 9, 11], ['as_fence', -18, 17, 0, 0, 0], ['as_fence', -6, 17, 0, 0, 0], ['as_fence', 6, 17, 0, 0, 0], ['as_fence', 18, 17, 0, 0, 0]] },
};
const CROPS = [['#7ab04a', '#6a9a3e'], ['#d8b860', '#c8a450'], ['#8a6a44', '#7a5a38'], ['#a8c860', '#90b050']];

/** The land's material: the vertex colours carry the big picture; up close the shader adds the detail: grass in
 *  patches and tufts, dry spots, rock in strata with cracks on steep ground, snow with drifts and a sparkle, and a
 *  bumpy surface the sun picks out. */
function landMaterial(B) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSandy = { value: B.mesas ? 1 : B.islands ? 0.5 : 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vWn = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; varying vec3 vWn; uniform float uSandy;
      float lh(vec2 p){ vec3 q = fract(vec3(p, 1.7) * 0.3183099 + 0.1); q *= 17.0; return fract(q.x * q.y * q.z * (q.x + q.y + q.z)); }
      float lv(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(lh(i), lh(i + vec2(1.0, 0.0)), f.x), mix(lh(i + vec2(0.0, 1.0)), lh(i + vec2(1.0, 1.0)), f.x), f.y); }
      float bumpH(vec2 p){ return lv(p * 0.35) * 0.6 + lv(p * 1.3) * 0.3 + lv(p * 4.0) * 0.1; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 p = vWp.xz * 0.5; float dist = length(cameraPosition - vWp), fine = 1.0 - smoothstep(80.0, 320.0, dist), mid = 1.0 - smoothstep(300.0, 1400.0, dist);
        float slope = 1.0 - clamp(vWn.y, 0.0, 1.0);
        vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(0.333)), sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
        float n1 = lv(p * 0.06), n2 = lv(p * 0.27), n3 = lv(p * 1.2), n4 = lv(p * 5.0);
        float snowy = smoothstep(0.6, 0.78, lum) * (1.0 - smoothstep(0.06, 0.16, sat));
        float steep = smoothstep(0.3, 0.6, slope);
        // ground: patches lighter and darker, warmer and cooler; dry spots; a fine tufty grain close by
        c *= mix(0.86 + 0.28 * (n1 * 0.55 + n2 * 0.45) * mid + 0.14 * (1.0 - mid), 0.97 + 0.06 * n1, snowy);
        c = mix(c, c * vec3(1.12, 1.05, 0.78), smoothstep(0.6, 0.85, n2) * 0.45 * (1.0 - snowy) * (1.0 - uSandy * 0.5));
        c *= 1.0 + (n4 - 0.5) * 0.3 * fine * (1.0 - snowy * 0.6) + (n3 - 0.5) * 0.16 * mid;
        c *= 1.0 - smoothstep(0.72, 0.9, lv(p * 0.6 + 7.0)) * 0.18 * mid * (1.0 - snowy); // (darker clumps)
        // rock: strata and cracks on the steep faces
        float strata = sin(vWp.y * (1.3 + uSandy * 0.8) + n2 * 4.0) * 0.5 + 0.5;
        float crack = 1.0 - smoothstep(0.0, 0.05, abs(lv(vec2(vWp.y * 0.7, (vWp.x + vWp.z) * 0.18)) - 0.5));
        c = mix(c, c * (0.78 + 0.4 * strata) * (1.0 - crack * 0.4 * fine), steep * (1.0 - snowy * 0.7));
        // snow: blue in the hollows, and the sun's sparkle
        c = mix(c, c * vec3(0.86, 0.92, 1.02), snowy * smoothstep(0.55, 0.2, n2) * 0.6);
        { float ph = dot(vWp.xz, vec2(0.8, 0.6)) * 0.9 + lv(vWp.xz * 0.04) * 7.0; float fld = smoothstep(0.35, 0.7, lv(vWp.xz * 0.02 + 3.0));
          c *= 1.0 + (cos(ph) * 0.06 + sin(ph) * 0.02) * fld * snowy * mid * (1.0 - steep); } // (wind ripples in the snow)
        c += vec3(0.9, 0.95, 1.0) * snowy * step(0.993, lh(floor(vWp.xz * 4.0))) * fine * 0.6;
        c *= 1.0 + snowy * 0.07;
        diffuseColor.rgb = c;
      }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec2 p = vWp.xz; float e = 0.6, k = (1.0 - smoothstep(60.0, 260.0, length(cameraPosition - vWp))) * 0.9;
        float gx = bumpH(p + vec2(e, 0.0)) - bumpH(p - vec2(e, 0.0)), gz = bumpH(p + vec2(0.0, e)) - bumpH(p - vec2(0.0, e));
        normal = normalize(normal - (viewMatrix * vec4(gx, 0.0, gz, 0.0)).xyz * k);
      }`);
  };
  return mat;
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Region {
  /** track: src/air/track.js; c: the circuit. */
  constructor(track, c) {
    this.track = track; this.c = c; this.B = BIOMES[c.biome] || BIOMES.valley;
    this.water = c.water ?? 2;
    const n1 = makeNoise2D(c.seed || 1), n2 = makeNoise2D((c.seed || 1) + 7), n3 = makeNoise2D((c.seed || 1) + 19);
    this.noise = (x, z) => n1(x * 0.0022, z * 0.0022) * 1.0 + n2(x * 0.006, z * 0.006) * 0.42 + n3(x * 0.018, z * 0.018) * 0.14 + n3(x * 0.05 + 3, z * 0.05) * 0.04;
    this.n2 = n2;
    const b = track.box, pad = 650;
    this.x0 = b.min.x - pad; this.x1 = b.max.x + pad; this.z0 = b.min.z - pad; this.z1 = b.max.z + pad;
    // the corridor: distance to the line (and to each shortcut's cut) on a coarse grid, with the line's height
    this.CS = 8;
    this.cw = Math.ceil((this.x1 - this.x0) / this.CS) + 1; this.ch = Math.ceil((this.z1 - this.z0) / this.CS) + 1;
    this.dist = new Float32Array(this.cw * this.ch).fill(1e9); this.ty = new Float32Array(this.cw * this.ch);
    this.cut = new Float32Array(this.cw * this.ch).fill(1e9); this.cutY = new Float32Array(this.cw * this.ch); this.cutHide = new Float32Array(this.cw * this.ch).fill(1e9);
    this.tt = new Float32Array(this.cw * this.ch);
    const R = 200, stamp = (p, dArr, yArr, extra = null, t = -1) => {
      const ci = Math.round((p.x - this.x0) / this.CS), cj = Math.round((p.z - this.z0) / this.CS), rr = Math.ceil(R / this.CS);
      for (let j = Math.max(0, cj - rr); j <= Math.min(this.ch - 1, cj + rr); j++) for (let i = Math.max(0, ci - rr); i <= Math.min(this.cw - 1, ci + rr); i++) {
        const x = this.x0 + i * this.CS, z = this.z0 + j * this.CS, d = Math.hypot(x - p.x, z - p.z), k = j * this.cw + i;
        if (d < dArr[k]) { dArr[k] = d; yArr[k] = p.y; if (t >= 0) this.tt[k] = t; }
        if (extra) { const e = Math.hypot(x - extra.x, z - extra.z); if (e < this.cutHide[k]) this.cutHide[k] = e; }
      }
    };
    for (let k = 0; k < 1400; k++) stamp(track.curve.getPointAt(k / 1400), this.dist, this.ty, null, k / 1400);
    // gorges: stretches where the walls close in either side of the line
    this.gorges = (c.obstacles || []).filter((o) => o.type === 'gorge').map((o) => ({ t: o.t, len: o.opts?.len || 0.1 }));
    // a dam: the reservoir's floor upstream, a deep canyon downstream (the ground falls away below the line)
    this.dams = (c.obstacles || []).filter((o) => o.type === 'dam').map((o) => ({ t: track.nearest(track.frame(o.t).p).t }));
    for (const s of track.shortcuts) {
      const L = s.a.distanceTo(s.b); for (let k = 0; k <= 60; k++) { const p = s.a.clone().lerp(s.b, k / 60); stamp(p, this.cut, this.cutY, s.mid); }
      s.hideR = L * 0.55;
    }
  }
  idx(x, z) { const i = Math.max(0, Math.min(this.cw - 1, Math.round((x - this.x0) / this.CS))), j = Math.max(0, Math.min(this.ch - 1, Math.round((z - this.z0) / this.CS))); return j * this.cw + i; }
  /** Bilinear lookup of a corridor table. */
  look(arr, x, z) {
    const fx = (x - this.x0) / this.CS, fz = (z - this.z0) / this.CS, i = Math.max(0, Math.min(this.cw - 2, Math.floor(fx))), j = Math.max(0, Math.min(this.ch - 2, Math.floor(fz)));
    const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fz - j)), w = this.cw;
    return arr[j * w + i] * (1 - u) * (1 - v) + arr[j * w + i + 1] * u * (1 - v) + arr[(j + 1) * w + i] * (1 - u) * v + arr[(j + 1) * w + i + 1] * u * v;
  }
  /** The natural ground before the corridor is cut. */
  natural(x, z) {
    const B = this.B, n = this.noise(x, z);
    let h = this.water + 6 + (n * 0.5 + 0.5) * B.amp;
    if (B.cliff) { const r = this.n2(x * 0.004 + 5, z * 0.004); h += Math.max(0, r) * B.amp * 0.9 * B.cliff; } // ridges and cliffs
    if (B.islands) { h = this.water - 14 + Math.max(0, n * 1.4 + 0.25) * B.amp * 1.3; } // mostly sea, islands where the noise peaks
    if (B.mesas) { const m = this.n2(x * 0.003 - 9, z * 0.003 + 4); if (m > 0.18) h = Math.max(h, this.water + 40 + B.amp * (0.7 + Math.min(0.2, m - 0.18))); } // flat-topped mesas
    // the edge of the world: up into hills (or down into sea) far from the track
    const e = Math.min(x - this.x0, this.x1 - x, z - this.z0, this.z1 - z);
    if (e < 300) h += (B.islands ? -1 : 1) * (300 - e) * 0.25;
    return h;
  }
  /** The ground height (the corridor carved through the natural ground). */
  height(x, z) {
    let h = this.natural(x, z);
    const d = this.look(this.dist, x, z), ty = this.look(this.ty, x, z);
    // the flying corridor: the ground is held at least `clear` under the line, widening out to the natural ground
    let W = this.B.islands ? 70 : this.B.cliff ? 55 : 65, ease = 140; const clear = this.B.islands ? 10 : 16;
    if (this.gorges.length && d < 260) {
      const t = this.tt[this.idx(x, z)];
      for (const G of this.gorges) {
        let dt = Math.abs(t - G.t); dt = Math.min(dt, 1 - dt);
        const k = 1 - smooth(G.len * 0.35, G.len * 0.5, dt); // 1 inside the gorge, easing out at its ends
        if (k > 0) { W = W + (30 - W) * k; ease = ease + (36 - ease) * k; h = Math.max(h, h + (ty + 55 + this.noise(x * 2.5, z * 2.5) * 14 - h) * k * smooth(28, 50, d)); }
      }
    }
    // v1.17.1: hard circuits hug the land: the ground rises with the line, so a climb is up a mountain's flank and over
    // its shoulder, and a dive drops into the valley beyond (the corridor's still carved clear under the line)
    if (this.c.hug && d < W + ease + 120) {
      const hug = ty - clear - 5 + this.noise(x * 1.5, z * 1.5) * 6, k = 1 - smooth(W * 0.5, W + ease + 120, d);
      if (hug > h) h += (hug - h) * k;
    }
    let floor = Math.min(ty - clear, this.B.islands ? this.water - 2 : ty - clear);
    if (this.dams.length && d < 260) {
      const t = this.tt[this.idx(x, z)];
      for (const D of this.dams) { let dt = t - D.t; if (dt < -0.5) dt += 1; if (dt > 0.5) dt -= 1; if (dt > 0.002 && dt < 0.09) floor -= 70 * smooth(0.002, 0.012, dt) * (1 - smooth(0.06, 0.09, dt)); else if (dt <= 0.002 && dt > -0.06) floor = Math.min(floor, ty - 22); }
    }
    // shortcuts: a ridge (or mesa, or cliff) hides each one (raised before the corridor's carved, so never over the line)
    for (const s of this.track.shortcuts) {
      const e = this.look(this.cutHide, x, z);
      if (e < s.hideR) { const top = s.mid.y + (s.cave || s.tunnel ? 24 : 34) + this.noise(x * 2, z * 2) * 6; h = Math.max(h, top - (e / s.hideR) ** 2 * (top - h)); }
    }
    if (d < W + ease) {
      const k = smooth(W, W + ease, d); // 0 in the corridor, 1 well outside
      const carved = Math.min(h, floor + (this.B.cliff ? 0 : 1) * (this.noise(x * 3, z * 3) * 4));
      h = carved + (h - carved) * k;
    }
    // and a narrow cut through the ridge along each shortcut's path
    for (const s of this.track.shortcuts) {
      const dc = this.look(this.cut, x, z), cy = this.look(this.cutY, x, z);
      if (dc < 52) { const cutFloor = cy - (s.cave || s.tunnel ? 9 : 12); h = Math.min(h, cutFloor + smooth(22, 52, dc) * (h - cutFloor)); }
    }
    return h;
  }

  /** Build the land, the water and the props into `group`. Returns { colliders } for the trees. */
  build(group, quality = 'high') {
    const B = this.B, step = quality === 'low' ? 10 : 7, CH = 320;
    const col = Object.fromEntries(Object.entries(B.col).map(([k, v]) => [k, new THREE.Color(v)]));
    const tmp = new THREE.Color();
    const mat = landMaterial(B);
    this.hCache = new Map();
    this.planTowns(quality);
    let chunks = 0;
    for (let cz = this.z0; cz < this.z1; cz += CH) for (let cx = this.x0; cx < this.x1; cx += CH) {
      const nx = Math.ceil(Math.min(CH, this.x1 - cx) / step), nz = Math.ceil(Math.min(CH, this.z1 - cz) / step);
      const pos = new Float32Array((nx + 1) * (nz + 1) * 3), cols = new Float32Array(pos.length), idx = [];
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        const x = cx + i * step, z = cz + j * step, y = this.height(x, z), k = (j * (nx + 1) + i) * 3;
        pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
        const sl = Math.abs(this.height(x + 3, z) - y) + Math.abs(this.height(x, z + 3) - y), nn = this.noise(x * 4, z * 4);
        // colour: wet sand by the water, grass (two greens in patches), rock on steep ground, snow up high
        if (y < this.water + 1.5) tmp.copy(col.low).lerp(col.bed, smooth(this.water + 1.5, this.water - 6, y));
        else tmp.copy(col.grass).lerp(col.grass2, smooth(-0.2, 0.3, nn));
        tmp.lerp(col.rock, smooth(1.6, 3.4, sl));
        if (y > this.water + B.amp * 0.85) tmp.lerp(col.high, smooth(this.water + B.amp * 0.85, this.water + B.amp * 1.1, y));
        if (B.col.snow && y > this.water + B.amp * 1.15) tmp.lerp(col.snow, smooth(this.water + B.amp * 1.15, this.water + B.amp * 1.3, y) * (1 - smooth(2.4, 4, sl)));
        if (B.mesas) { const band = Math.sin(y * 0.35) * 0.5 + 0.5; tmp.lerp(col.high, band * smooth(1.2, 2.5, sl) * 0.5); } // the mesas' strata
        const fc = this.fieldAt(x, z, y); if (fc) tmp.lerp(fc, 0.5); // (under the field's own mesh: no green edges)
        tmp.multiplyScalar(0.92 + nn * 0.12);
        cols[k] = tmp.r; cols[k + 1] = tmp.g; cols[k + 2] = tmp.b;
      }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c2 = a + nx + 1, d = c2 + 1; idx.push(a, c2, b, b, c2, d); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.name = 'air-land'; group.add(m); chunks++;
    }
    // a far ring of low hills (or sea) out to the horizon, under the fog
    const far = new THREE.Mesh(new THREE.RingGeometry(1, 3, 48, 1), new THREE.MeshLambertMaterial({ color: B.islands ? B.water : B.col.grass2 }));
    far.rotation.x = -Math.PI / 2; far.scale.setScalar(Math.max(this.x1 - this.x0, this.z1 - this.z0) * 0.7);
    far.position.set((this.x0 + this.x1) / 2, B.islands ? this.water - 0.3 : this.water + 20, (this.z0 + this.z1) / 2); group.add(far);
    // the water: a big sheet, see-through enough to show the shallows, with a gentle shimmer
    const wmat = new THREE.MeshPhongMaterial({ color: B.water, transparent: true, opacity: 0.78, shininess: 120, specular: '#ffffff' });
    wmat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = this.waterT = { value: 0 };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform float uT;')
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
          normal = normalize(normal + vec3(sin(vWp.x * 0.15 + uT * 1.3) * 0.05 + sin(vWp.z * 0.23 - uT) * 0.04, 0.0, cos(vWp.z * 0.17 + uT * 1.1) * 0.05 + sin(vWp.x * 0.29 + uT * 0.7) * 0.03));`);
    };
    if (this.water > -30) {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(this.x1 - this.x0 + 4000, this.z1 - this.z0 + 4000), wmat);
      water.rotation.x = -Math.PI / 2; water.position.set((this.x0 + this.x1) / 2, this.water, (this.z0 + this.z1) / 2); water.renderOrder = 1; water.receiveShadow = true; group.add(water);
    }
    // props: thick near the corridor (where you see them up close), thin far away; never in the corridor's middle
    const r = mulberry32((this.c.seed || 1) * 977), trees = [];
    const total = Math.round((quality === 'low' ? 4500 : quality === 'medium' ? 6500 : 9000) * (B.density || 1)), items = Object.fromEntries(B.props.map(([n]) => [n, []]));
    const wsum = B.props.reduce((a, p) => a + p[1], 0);
    for (let k = 0; k < total * 3 && trees.length < total; k++) {
      const x = this.x0 + 60 + r() * (this.x1 - this.x0 - 120), z = this.z0 + 60 + r() * (this.z1 - this.z0 - 120);
      const d = this.look(this.dist, x, z);
      if (d < 34 || (d > 380 && r() > 0.25)) continue;
      if (this.look(this.cut, x, z) < 34) continue;
      if (this.towns.some((T) => Math.hypot(x - T.x, z - T.z) < T.r)) continue;
      const y = this.height(x, z);
      if (y < this.water + 0.8) continue;
      const sl = Math.abs(this.height(x + 2, z) - y) + Math.abs(this.height(x, z + 2) - y);
      if (sl > 2.6) continue;
      let pick = r() * wsum, P = B.props[0]; for (const p of B.props) { pick -= p[1]; if (pick <= 0) { P = p; break; } }
      const s = P[2] * (0.8 + r() * 0.5);
      // (nothing in the corridor stands up into the line's height: the valley floor along the course is clear)
      if (d < 120 && y + this.propHeight(P[0]) * s > this.look(this.ty, x, z) - 4) continue;
      items[P[0]].push({ x, y: y - 0.3, z, ry: r() * Math.PI * 2, s });
      if (!/rock|bush|grass/.test(P[0])) trees.push({ x, z, y, top: y + this.propHeight(P[0]) * s, r: (P[0] === 'ar_mesa' ? 38 : P[0] === 'ar_hoodoo' ? 4.5 : 1.2) * s });
    }
    const cx = (this.x0 + this.x1) / 2, cz = (this.z0 + this.z1) / 2, half = Math.max(this.x1 - this.x0, this.z1 - this.z0) / 2 + 10;
    for (const [n, list] of Object.entries(items)) if (list.length && merged(n).solid) instanced(group, n, list, { shadow: false, cells: 5, half, cx, cz });
    this.buildTowns(group, trees);
    this.trees = trees;
    // a spatial hash of the trees, for crashing into them
    this.treeHash = new Map();
    for (const t of trees) { const k = `${Math.floor(t.x / 20)}|${Math.floor(t.z / 20)}`; if (!this.treeHash.has(k)) this.treeHash.set(k, []); this.treeHash.get(k).push(t); }
    return { chunks, trees: trees.length };
  }
  /** Pick the settlements' spots: off the line (but in view of it), on gentle ground; shore towns where the land
   *  runs down into water. Each faces downhill. */
  planTowns(quality) {
    const B = this.B, r = mulberry32((this.c.seed || 1) * 131 + 7), want = quality === 'low' ? 6 : 11, kinds = B.towns || [];
    this.towns = []; this.fields = [];
    if (!kinds.length) return;
    for (let k = 0; k < 900 && this.towns.length < want; k++) {
      const kind = kinds[k % kinds.length], T = TOWNS[kind];
      const x = this.x0 + 120 + r() * (this.x1 - this.x0 - 240), z = this.z0 + 120 + r() * (this.z1 - this.z0 - 240);
      const d = this.look(this.dist, x, z);
      if (d < 85 || d > 360 || this.look(this.cut, x, z) < 60) continue;
      if (this.towns.some((o) => Math.hypot(o.x - x, o.z - z) < 170)) continue;
      const y = this.height(x, z);
      if (d < 150 && y + 18 > this.look(this.ty, x, z) - 4) continue;
      // downhill: the way the ground falls; and gentle enough to build on
      const e = 14, gx = this.height(x + e, z) - this.height(x - e, z), gz = this.height(x, z + e) - this.height(x, z - e), g = Math.hypot(gx, gz) / (2 * e);
      if (g > 0.22) continue;
      const yaw = g > 0.01 ? Math.atan2(-gx, -gz) : r() * Math.PI * 2, fx = Math.sin(yaw), fz = Math.cos(yaw);
      if (T.shore) { if (y < this.water + 1 || y > this.water + 6) continue; if (this.height(x + fx * 22, z + fz * 22) > this.water - 0.5) continue; }
      else if (y < this.water + 3) continue;
      this.towns.push({ kind, x, z, y, yaw, r: 48 });
      if (T.field) { const [a0, a1, b0, b1] = T.field; this.fields.push({ x, z, yaw, a0, a1, b0, b1, crop: Math.floor(r() * CROPS.length), rows: r() < 0.5 }); }
    }
  }
  /** A crop field's colour under (x, z), or null. */
  fieldAt(x, z, y) {
    for (const F of this.fields) {
      const dx = x - F.x, dz = z - F.z, c = Math.cos(F.yaw), s = Math.sin(F.yaw), lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (lx < F.a0 || lx > F.a1 || lz < F.b0 || lz > F.b1 || y < this.water + 1) continue;
      this.fc = this.fc || new THREE.Color(); return this.fc.set(CROPS[F.crop][1]);
    }
    return null;
  }
  /** Put the settlements' buildings in (instanced, a draw per kind) and make them solid. */
  buildTowns(group, trees) {
    const lists = {};
    for (const T of this.towns) {
      const c = Math.cos(T.yaw), s = Math.sin(T.yaw);
      for (const [n, dx, dz, ry, rad, ht] of TOWNS[T.kind].items) {
        if (!merged(n).solid) continue;
        const x = T.x + dx * c + dz * s, z = T.z - dx * s + dz * c;
        let y = this.height(x, z);
        if (rad) { let lo = y; for (let a = 0; a < 4; a++) lo = Math.min(lo, this.height(x + Math.cos(a * 1.57) * rad * 0.7, z + Math.sin(a * 1.57) * rad * 0.7)); y = lo - 0.15; }
        if (/jetty|canoe/.test(n)) y = Math.max(this.water - 0.2, Math.min(y, this.water + 0.4));
        else if (y < this.water + 0.3) continue;
        (lists[n] = lists[n] || []).push({ x, y, z, ry: T.yaw + ry, s: 1 });
        if (rad) trees.push({ x, z, y, top: y + ht, r: rad });
      }
    }
    const cx = (this.x0 + this.x1) / 2, cz = (this.z0 + this.z1) / 2, half = Math.max(this.x1 - this.x0, this.z1 - this.z0) / 2 + 10;
    for (const [n, list] of Object.entries(lists)) instanced(group, n, list, { shadow: false, cells: 1, half, cx, cz }); // (a draw per kind: the draw budget)
    // the fields: a skin laid over the ground, rows of crop (or furrows) in the field's own direction
    for (const F of this.fields) {
      const w = F.a1 - F.a0, d = F.b1 - F.b0, nx = Math.ceil(w / 3), nz = Math.ceil(d / 3), geo = new THREE.PlaneGeometry(w, d, nx, nz); geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position, c = Math.cos(F.yaw), s = Math.sin(F.yaw);
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i) + (F.a0 + F.a1) / 2, lz = pos.getZ(i) + (F.b0 + F.b1) / 2, x = F.x + lx * c + lz * s, z = F.z - lx * s + lz * c;
        pos.setXYZ(i, x, Math.max(this.height(x, z), this.water + 0.2) + 0.18, z);
      }
      geo.computeVertexNormals();
      const pal = CROPS[F.crop], m = new THREE.MeshLambertMaterial({ color: '#ffffff' });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uA = { value: new THREE.Color(pal[0]) }; sh.uniforms.uB = { value: new THREE.Color(pal[1]) }; sh.uniforms.uRows = { value: (F.rows ? w : d) / 2.4 };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFu;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvFu = uv;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFu; uniform vec3 uA; uniform vec3 uB; uniform float uRows;')
          .replace('#include <color_fragment>', `#include <color_fragment>
          { float t = ${F.rows ? 'vFu.x' : 'vFu.y'} * uRows; float row = smoothstep(0.15, 0.45, abs(fract(t) - 0.5) * 2.0);
            float n = fract(sin(dot(floor(vFu * vec2(37.0, 29.0)), vec2(12.9898, 78.233))) * 43758.5453);
            float edge = smoothstep(0.0, 0.03, min(min(vFu.x, 1.0 - vFu.x), min(vFu.y, 1.0 - vFu.y)));
            diffuseColor.rgb = mix(uB * 0.8, uA, row) * (0.92 + 0.12 * n); diffuseColor.a = edge; }`);
      };
      m.transparent = true; m.depthWrite = true;
      const mesh = new THREE.Mesh(geo, m); mesh.name = 'air-field'; group.add(mesh);
    }
  }
  propHeight(n) { this.ph = this.ph || {}; if (this.ph[n] != null) return this.ph[n]; const m = merged(n).solid; if (!m) return (this.ph[n] = 6); m.computeBoundingBox(); return (this.ph[n] = m.boundingBox.max.y); }
  /** True if a sphere at p (radius r) is in the ground or a tree. */
  hits(p, r = 1.5) {
    if (p.y - r < this.height(p.x, p.z)) return 'ground';
    const k0 = Math.floor(p.x / 20), k1 = Math.floor(p.z / 20);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const t of this.treeHash?.get(`${k0 + a}|${k1 + b}`) || []) {
      if (p.y - r < t.top && Math.hypot(p.x - t.x, p.z - t.z) < t.r + r) return 'tree';
    }
    return null;
  }
  update(dt, t) { if (this.waterT) this.waterT.value = t; }
}
