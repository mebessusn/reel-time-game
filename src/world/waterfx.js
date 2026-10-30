// v1.17.1 water effects, shared by the lake shader (water.js), the sea (ocean/oceanMesh.js) and the valley ground
// (terrain.js): ripple rings that light up, each lake's own water colour, and the wash running up the beaches.
import * as THREE from 'three';
import { HALF, LAKES } from './terrain.js'; // (terrain.js imports applySwash from here: only used inside functions)

// ---------------------------------------------------------------- ripple rings
/** GLSL: rings from the shared uRipples slots (x, z, start time, speed). A leading ring and two trailing ones per
 *  splash, which tilt the surface (grad: add -grad to the normal's x / z) so the sun catches them. Needs uRipples[n]. */
export const RIPPLES_GLSL = (n) => /* glsl */ `
  float ripples(vec2 q, float t, out vec2 grad) {
    float ring = 0.0; grad = vec2(0.0);
    for (int i = 0; i < ${n}; i++) {
      vec4 r = uRipples[i];
      float age = t - r.z;
      if (age < 0.0 || age > 2.6) continue;
      vec2 dv = q - r.xy; float d = length(dv);
      float behind = age * max(0.45, 1.2 + r.w) - d; // metres inside the leading ring
      if (behind < -0.15 || behind > 1.1) continue;
      float fade = 1.0 - age / 2.6; fade *= fade;
      float env = smoothstep(-0.15, 0.05, behind) * (1.0 - smoothstep(0.3, 1.1, behind)) * fade;
      float s = behind * 17.0; // about 0.37 m from ring to ring
      ring += smoothstep(0.35, 1.0, sin(s)) * env * (1.0 - behind * 0.6) * (behind < 0.2 ? 1.4 : 1.0); // (the leading ring brightest)
      grad += (dv / max(d, 0.001)) * cos(s) * env * 0.6;
    }
    return clamp(ring, 0.0, 1.0);
  }
`;

// ---------------------------------------------------------------- each lake's water
// shallow / deep colours and murk (0 clear .. 1 you can't see the bottom past a few feet)
export const WATER_PRESETS = {
  cove: { shallow: '#5fb4cf', deep: '#1f4f80', murk: 0 }, // the cove, the rivers and the creeks (as before)
  frost: { shallow: '#92e0e4', deep: '#1a6f92', murk: 0 }, // Frostpine: snowmelt, clear and icy
  marsh: { shallow: '#8c8a46', deep: '#3a4021', murk: 0.85 }, // Lilymarsh: peaty, green-brown
  pond: { shallow: '#5fa877', deep: '#1c5038', murk: 0.5 }, // Fern Pond: weedy green
  quarry: { shallow: '#55d6c8', deep: '#0f7a88', murk: 0.1 }, // the Old Quarry: limestone turquoise
  cave: { shallow: '#4796ad', deep: '#0f2d48', murk: 0.25 }, // Echo Cavern: dark, still and blue
};
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Pure: how much each lake's water colours a point ({ id: weight }, weights sum to 1; the cove takes the rest). */
export function presetWeights(x, z) {
  const w = {};
  let sum = 0;
  for (const [id, L] of Object.entries(LAKES)) {
    if (!WATER_PRESETS[id]) continue;
    const e = Math.hypot((x - L.cx) / (L.rx + L.noise), (z - L.cz) / (L.rz + L.noise));
    const k = smooth(1.45, 1.0, e); // the lake, blending out along its inflows over a few tens of metres
    if (k > 0) { w[id] = k; sum += k; }
  }
  if (sum > 1) for (const id in w) w[id] /= sum;
  w.cove = Math.max(0, 1 - Math.min(1, sum));
  return w;
}
/** Two small textures over the valley (4 m a texel): shallow colour + murk, and deep colour (linear RGB, as the
 *  shader's colour uniforms were). */
export function bakePresetTextures() {
  const N = HALF / 2, S = (HALF * 2) / N;
  const cols = Object.fromEntries(Object.entries(WATER_PRESETS).map(([id, p]) => [id, { s: new THREE.Color(p.shallow), d: new THREE.Color(p.deep), m: p.murk }]));
  const a = new Uint8Array(N * N * 4), b = new Uint8Array(N * N * 4);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const w = presetWeights(i * S - HALF + S / 2, j * S - HALF + S / 2);
    let sr = 0, sg = 0, sb = 0, dr = 0, dg = 0, db = 0, m = 0;
    for (const [id, k] of Object.entries(w)) { const c = cols[id]; sr += c.s.r * k; sg += c.s.g * k; sb += c.s.b * k; dr += c.d.r * k; dg += c.d.g * k; db += c.d.b * k; m += c.m * k; }
    const o = (j * N + i) * 4;
    a[o] = sr * 255; a[o + 1] = sg * 255; a[o + 2] = sb * 255; a[o + 3] = m * 255;
    b[o] = dr * 255; b[o + 1] = dg * 255; b[o + 2] = db * 255; b[o + 3] = 255;
  }
  const tex = (d) => { const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return { shallow: tex(a), deep: tex(b) };
}

// ---------------------------------------------------------------- the wash on the beaches
/** Shared uniforms: water.js drives them every frame. uSwOn 0 turns the wash off (other maps). */
export const SWASH = { uSwT: { value: 0 }, uSwH: { value: 0.08 }, uSwOn: { value: 1 } };

/** Patch the valley ground's shader (after the splat and the caustics patches, which declare tGroundNoise, vW0 / vW1
 *  and vCW): each little wave runs up the beach as a thin sheet with a foam lip, drains back, and leaves the sand dark
 *  where it reached, drying until the next one. Only on beach-like ground (sand, mud, the lake bed, gravel, dirt). */
export function applySwash(material) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    Object.assign(sh.uniforms, SWASH);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSwT; uniform float uSwH; uniform float uSwOn;')
      .replace('#include <opaque_fragment>', /* glsl */ `
        {
          float hw = vCW.y - uWaterY; // height above the still water line
          float beach = clamp(vW0.y + vW0.z + vW1.y + vW1.z + vW1.w, 0.0, 1.0);
          if (uSwOn > 0.0 && beach > 0.05 && hw > -0.06 && hw < uSwH * 1.4 + 0.04) {
            // neighbouring stretches of shore are out of step; each wave reaches its own height
            float ph = uSwT * 0.3 + texture2D(tGroundNoise, vCW.xz / 23.0).x * 3.0 + texture2D(tGroundNoise, vCW.xz / 6.0).y * 0.5;
            float cyc = fract(ph);
            float H = uSwH * (0.65 + 0.7 * texture2D(tGroundNoise, vCW.xz / 13.0 + floor(ph) * 0.37).z);
            float level = cyc < 0.25 ? H * smoothstep(0.0, 0.25, cyc) : H * (1.0 - (cyc - 0.25) / 0.75); // up fast, drains slowly
            float film = smoothstep(level + 0.012, level - 0.008, hw) * smoothstep(-0.06, 0.0, hw);
            // the sand stays dark where the sheet reached, drying until the next one comes
            float left = 0.25 + 0.75 * (1.0 - clamp(hw / max(H, 0.001), 0.0, 1.0)); // when the draining sheet left this height
            float wet = hw < H ? max(film, 1.0 - smoothstep(0.0, 0.55, fract(cyc - left))) : 0.0;
            wet = max(wet, smoothstep(0.015, -0.03, hw));
            float lum = dot(outgoingLight, vec3(0.333));
            outgoingLight *= 1.0 - 0.38 * wet * beach;
            outgoingLight = mix(outgoingLight, vec3(0.42, 0.62, 0.66) * (lum * 1.35 + 0.02), film * 0.55 * beach);
            // the foam lip at the sheet's edge, broken into lace, fading as it drains
            float lace = smoothstep(0.35, 0.65, texture2D(tGroundNoise, vCW.xz / 1.3 + vec2(uSwT * 0.05, 0.0)).w);
            float lip = smoothstep(0.03, 0.0, abs(hw - level)) * step(0.015, level) * (1.0 - smoothstep(0.45, 0.9, cyc)) * (0.45 + 0.55 * lace);
            outgoingLight = mix(outgoingLight, vec3(lum * 1.7 + 0.04), lip * 0.75 * beach);
          }
        }
        #include <opaque_fragment>`);
  };
  return material;
}
