// Open Waters: the sea state. Real ocean waves, not the lake's ripples: long swells rolling in from far away,
// a shorter wind sea on top, and chop and foam that grow with the wind. The weather drives all of it (clear days
// roll gently, a storm throws up waves several metres high) and it builds and eases over a minute or two, the way
// the sea does, never snapping from one state to the next.
//
// The waves are a sum of Gerstner waves (crests sharpen and troughs flatten as they steepen). Their phase comes
// from the wall clock, so every angler on a charter sees the same wave under the same hull. The same maths runs
// in the shader (oceanMesh.js) and here on the CPU, so boats, bobbers and swimmers ride exactly what you see.
import { OCEAN, oceanSurfaceY } from './geo.js';

const G = 9.81;
const TAU = Math.PI * 2;
const WATER_Y = 0.85;

// How the sea looks in each weather. swell/wind: amplitude (half the crest-to-trough height, metres) of the long
// swell and the wind sea; chop: small ripples (normals only); foam: whitecaps; steep: how sharp the crests get.
export const SEA_STATES = {
  clear: { swell: 0.5, wind: 0.16, chop: 0.32, foam: 0.04, steep: 0.32, spray: 0 },
  overcast: { swell: 0.85, wind: 0.34, chop: 0.55, foam: 0.16, steep: 0.42, spray: 0.05 },
  rain: { swell: 1.15, wind: 0.58, chop: 0.8, foam: 0.38, steep: 0.52, spray: 0.25 },
  storm: { swell: 1.85, wind: 1.0, chop: 1.0, foam: 0.85, steep: 0.66, spray: 1 },
};

// The wave train. Directions are fixed (a wave's phase depends on them, so they can never turn), and a
// swell comes from the open ocean to the east while the wind sea runs a little across it. len: wavelength (m).
const SWELL_DIR = Math.PI * 0.92, WIND_DIR = Math.PI * 0.72;
export const COMPONENTS = [
  { len: 74, dir: SWELL_DIR, a: 0.58, kind: 'swell' },
  { len: 52, dir: SWELL_DIR + 0.33, a: 0.3, kind: 'swell' },
  { len: 39, dir: SWELL_DIR - 0.47, a: 0.17, kind: 'swell' },
  { len: 19, dir: WIND_DIR, a: 0.5, kind: 'wind' },
  { len: 12.5, dir: WIND_DIR + 0.62, a: 0.32, kind: 'wind' },
  { len: 8.2, dir: WIND_DIR - 0.48, a: 0.2, kind: 'wind' },
].map((c) => {
  const k = TAU / c.len;
  return { ...c, k, w: Math.sqrt(G * k), dx: Math.cos(c.dir), dz: Math.sin(c.dir) }; // deep-water dispersion
});
export const N_WAVES = COMPONENTS.length;

/** The live sea: eased toward the weather's state. amp/phase are per component (read by the shader too). */
export const SEA = {
  swell: SEA_STATES.clear.swell, wind: SEA_STATES.clear.wind, chop: SEA_STATES.clear.chop,
  foam: SEA_STATES.clear.foam, steep: SEA_STATES.clear.steep, spray: 0,
  amp: new Float32Array(N_WAVES), q: new Float32Array(N_WAVES), phase: new Float32Array(N_WAVES), time: 0,
  weather: 'clear', lite: false, // lite: low graphics quality (no wind waves, foam or spray)
};

/** Seconds on the shared sea clock (the wall clock, so the whole crew agrees). */
export const seaClock = (now = Date.now()) => (now - Date.UTC(2026, 0, 1)) / 1000;

/** Advance the sea toward the weather. windK: the valley's wind (0.3 calm .. 1.6 a gale), gusts included. */
export function updateSea(dt, weather, windK = 0.4, now = Date.now()) {
  const tgt = SEA_STATES[weather] || SEA_STATES.clear;
  SEA.weather = weather;
  const gust = Math.max(0.6, Math.min(1.5, 0.55 + windK * 0.55));
  // the sea builds slowly (about 90 s to most of the way) and lies down a little slower still
  const ease = (cur, to) => cur + (to - cur) * Math.min(1, dt * (to > cur ? 1 / 45 : 1 / 70));
  SEA.swell = ease(SEA.swell, tgt.swell);
  SEA.wind = ease(SEA.wind, tgt.wind * gust);
  SEA.chop = ease(SEA.chop, tgt.chop * Math.min(1.3, gust));
  SEA.foam = ease(SEA.foam, Math.min(1, tgt.foam * gust));
  SEA.steep = ease(SEA.steep, tgt.steep);
  SEA.spray = ease(SEA.spray, tgt.spray * gust);
  const T = seaClock(now);
  SEA.time = T;
  for (let i = 0; i < N_WAVES; i++) {
    const c = COMPONENTS[i];
    const A = c.kind === 'wind' && SEA.lite ? 0 : c.a * (c.kind === 'swell' ? SEA.swell : SEA.wind); // (low graphics: the swell only)
    SEA.amp[i] = A;
    // Gerstner steepness, kept below the point where crests fold over themselves
    SEA.q[i] = A > 1e-4 ? Math.min(SEA.steep / (c.k * A * N_WAVES), 1 / (c.k * A * N_WAVES) * 0.9) : 0;
    SEA.phase[i] = (c.w * T) % TAU; // computed in double precision here, so the shader never loses it
  }
}
/** Jump straight to a weather's sea (arriving at sea, tests). */
export function setSea(weather, now = Date.now()) {
  const s = SEA_STATES[weather] || SEA_STATES.clear;
  Object.assign(SEA, { swell: s.swell, wind: s.wind, chop: s.chop, foam: s.foam, steep: s.steep, spray: s.spray });
  updateSea(0, weather, 0.8, now);
}

// Calmer over shallow water: waves shoal and break on the islands' reefs and beaches.
const depthDamp = (x, z) => {
  const d = WATER_Y - oceanSurfaceY(x, z);
  if (d <= 0) return 0;
  return Math.min(1, 0.18 + d / 9);
};

function displace(lx, lz, out) {
  let dx = 0, dz = 0;
  for (let i = 0; i < N_WAVES; i++) {
    const c = COMPONENTS[i], A = SEA.amp[i];
    if (!A) continue;
    const th = c.k * (c.dx * lx + c.dz * lz) - SEA.phase[i];
    const qa = SEA.q[i] * A * Math.cos(th);
    dx += qa * c.dx; dz += qa * c.dz;
  }
  out[0] = dx; out[1] = dz;
}
const tmp = [0, 0];

/** Wave height (metres above the still water line) at world (x, z), matching the ocean shader. */
export function oceanWave(x, z) {
  const lx = x - OCEAN.x, lz = z - OCEAN.z;
  // the surface point that ends up over (x, z): undo the horizontal Gerstner shift (two fixed-point steps)
  let px = lx, pz = lz;
  for (let it = 0; it < 2; it++) { displace(px, pz, tmp); px = lx - tmp[0]; pz = lz - tmp[1]; }
  let h = 0;
  for (let i = 0; i < N_WAVES; i++) {
    const c = COMPONENTS[i], A = SEA.amp[i];
    if (!A) continue;
    h += A * Math.sin(c.k * (c.dx * px + c.dz * pz) - SEA.phase[i]);
  }
  return h * depthDamp(x, z);
}

/** Surface slope at (x, z): how a floating thing tilts. Returns { h, sx, sz } (rise per metre along x and z). */
export function oceanSlope(x, z, e = 1.2) {
  const h = oceanWave(x, z);
  return { h, sx: (oceanWave(x + e, z) - oceanWave(x - e, z)) / (2 * e), sz: (oceanWave(x, z + e) - oceanWave(x, z - e)) / (2 * e) };
}

/** Significant wave height right now (crest to trough, metres): for the HUD and the captain's patter.
 *  With a weather name: what that weather brings (a forecast, from the cove). */
export function waveHeight(weather = null) {
  let s = 0;
  const st = weather ? SEA_STATES[weather] || SEA_STATES.clear : null;
  for (let i = 0; i < N_WAVES; i++) {
    const c = COMPONENTS[i], A = st ? c.a * (c.kind === 'swell' ? st.swell : st.wind) : SEA.amp[i];
    s += A * A;
  }
  return 4 * Math.sqrt(s / 2);
}
export function seaName(h = waveHeight()) {
  return h < 0.6 ? 'Calm' : h < 1.3 ? 'Slight swell' : h < 2.2 ? 'Moderate seas' : h < 3.4 ? 'Rough seas' : 'Very rough seas';
}

/** GLSL for the same waves (uniforms uAmp, uQ, uPhase; local coords relative to the ocean's centre). */
export const WAVES_GLSL = /* glsl */ `
  #define N_WAVES ${N_WAVES}
  uniform float uAmp[N_WAVES]; uniform float uQ[N_WAVES]; uniform float uPhase[N_WAVES];
  const vec3 WK[N_WAVES] = vec3[N_WAVES](${COMPONENTS.map((c) => `vec3(${c.dx.toFixed(6)}, ${c.dz.toFixed(6)}, ${c.k.toFixed(6)})`).join(', ')});
  // Gerstner: returns the displaced point (xz) and height (y); jac: how squeezed the surface is (foam on crests)
  vec3 gerstner(vec2 p, out vec3 nrm, out float jac) {
    vec3 o = vec3(p.x, 0.0, p.y);
    vec3 n = vec3(0.0, 1.0, 0.0);
    jac = 1.0;
    for (int i = 0; i < N_WAVES; i++) {
      vec3 w = WK[i]; float A = uAmp[i]; float Q = uQ[i];
      float th = w.z * dot(w.xy, p) - uPhase[i];
      float c = cos(th), s = sin(th);
      o.x += Q * A * w.x * c; o.z += Q * A * w.y * c; o.y += A * s;
      float wa = w.z * A;
      n.x -= w.x * wa * c; n.z -= w.y * wa * c; n.y -= Q * wa * s;
      jac -= Q * wa * s;
    }
    nrm = normalize(n);
    return o;
  }
`;
