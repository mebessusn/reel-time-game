// Animated lake surface: depth-tinted, lit by a moving wave field (swells + drifting wind ripples), shore foam,
// rain rings, a sun/moon sheen and sparkles.
import * as THREE from 'three';
import { HALF, surfaceY, WATER_Y, FAR_X } from './terrain.js';
let westWave = null;
/** Frostmere: its open water's own gentle waves (the floe edge, the springs, the holes). */
export function setWestWave(fn) { westWave = fn; }
import { oceanWave } from '../ocean/waves.js';
import { CAUSTICS } from './caustics.js';
import { RIPPLES_GLSL, bakePresetTextures, SWASH } from './waterfx.js';

const MAX_RIPPLES = 12;

// Shared so boats, bobbers and floating things can ride the same swell the shader draws.
export const WAVES = { uniforms: null };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Height of the wind swell at a point (world units above WATER_Y), matching the water shader. */
export function waveAt(x, z) {
  if (x > FAR_X) return oceanWave(x, z); // v1.15 Open Waters: the sea's own waves
  if (x < -FAR_X) return westWave ? westWave(x, z) : 0; // Frostmere
  const u = WAVES.uniforms;
  if (!u) return 0;
  const t = u.uTime.value, w = u.uWind.value;
  const depth = Math.max(0, Math.min(1, (WATER_Y - surfaceY(x, z) + 0.15) / 12));
  const damp = smooth(0.02, 0.3, depth) * (surfaceY(x, z) > WATER_Y ? 0 : 1);
  const a = 0.015 + 0.40 * smooth(0.2, 1.3, w);
  return damp * a * (Math.sin((x * 0.8 + z * 0.6) * 0.70 + t * 1.3) * 0.62 + Math.sin((x * 0.31 + z * 0.95) * 1.14 + t * 1.9) * 0.38);
}

export function buildWater() {
  // depth under the surface from the smooth ground, two samples per block so shorelines stay round
  const N = HALF * 4, S = 0.5;
  const data = new Uint8Array(N * N * 4);
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) {
    const y = surfaceY(x * S - HALF + S / 2, z * S - HALF + S / 2);
    const d = Math.max(0, Math.min(1, (WATER_Y - y + 0.15) / 12));
    const i = (z * N + x) * 4;
    data[i] = d * 255;
    data[i + 1] = Math.max(0, Math.min(255, (y - WATER_Y + 0.05) * 255 * 4)); // soft land mask
    data[i + 2] = 0; data[i + 3] = 255;
  }
  const depthTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  depthTex.magFilter = THREE.LinearFilter;
  depthTex.minFilter = THREE.LinearFilter;
  depthTex.needsUpdate = true;

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uDepth: { value: null },
      uShallow: { value: new THREE.Color('#5fb4cf') },
      uDeep: { value: new THREE.Color('#1f4f80') },
      uLight: { value: new THREE.Color('#ffffff') },
      uSkyTint: { value: new THREE.Color('#8fc9f0') },
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, -0.5) },
      uGlitter: { value: 1 },
      uRain: { value: 0 },
      uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0)) },
      uHalf: { value: HALF },
      uWind: { value: 0.3 },
      uPreS: { value: null }, uPreD: { value: null }, // v1.17.1: each lake's own colours (waterfx.js WATER_PRESETS)
    },
  ]);
  uniforms.uDepth.value = depthTex;
  const pre = bakePresetTextures();
  uniforms.uPreS.value = pre.shallow; uniforms.uPreD.value = pre.deep;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false, // so things drawn after the water (ambient fish) still depth-test against the bed
    fog: true,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uWind; uniform sampler2D uDepth; uniform float uHalf;
      varying vec3 vWorld; varying float vSwell;
      #include <fog_pars_vertex>
      
      // Wind swells: long rolling waves that grow with the wind (flat calm at dawn, choppy in a storm).
      // The same formula lives in waveAt() below so boats and bobbers ride them.
      float swellAmp(float w) { return 0.015 + 0.40 * smoothstep(0.2, 1.3, w); }
      float swell(vec2 p, float t, float w) {
        vec2 d1 = vec2(0.8, 0.6), d2 = vec2(0.31, 0.95);
        float a = swellAmp(w);
        return a * (sin(dot(p, d1) * 0.70 + t * 1.3) * 0.62 + sin(dot(p, d2) * 1.14 + t * 1.9) * 0.38);
      }

      void main() {
        vec3 p = position;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        wp.y += sin(dot(wp.xz, vec2(0.38, 0.21)) + uTime * 0.85) * 0.03 + sin(dot(wp.xz, vec2(-0.27, 0.46)) + uTime * 1.05) * 0.02;
        vec4 dm = texture2D(uDepth, (wp.xz + uHalf) / (uHalf * 2.0));
        float damp = smoothstep(0.02, 0.3, dm.r) * (1.0 - dm.g); // calmer near the shore, none on land
        float sw = swell(wp.xz, uTime, uWind) * damp;
        wp.y += sw;
        vSwell = sw / max(0.001, swellAmp(uWind));
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform sampler2D uDepth; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uLight;
      uniform vec3 uSkyTint; uniform vec3 uSunDir; uniform float uGlitter; uniform float uRain; uniform float uHalf;
      uniform vec4 uRipples[${MAX_RIPPLES}]; uniform float uWind; uniform sampler2D uPreS; uniform sampler2D uPreD;
      varying vec3 vWorld; varying float vSwell;
      ${RIPPLES_GLSL(MAX_RIPPLES)}
      // Wind swells: long rolling waves that grow with the wind (flat calm at dawn, choppy in a storm).
      // The same formula lives in waveAt() below so boats and bobbers ride them.
      float swellAmp(float w) { return 0.015 + 0.40 * smoothstep(0.2, 1.3, w); }
      float swell(vec2 p, float t, float w) {
        vec2 d1 = vec2(0.8, 0.6), d2 = vec2(0.31, 0.95);
        float a = swellAmp(w);
        return a * (sin(dot(p, d1) * 0.70 + t * 1.3) * 0.62 + sin(dot(p, d2) * 1.14 + t * 1.9) * 0.38);
      }

      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // value noise + fbm for small, drifting ripples
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
      // Wave height: a few long directional swells, plus wind ripples that drift two ways and
      // cross each other (no repeating grid, so no circles or blobs).
      float waveH(vec2 p, float t) {
        float h = 0.0;
        h += sin(dot(p, vec2(0.38, 0.21)) + t * 0.85) * 0.50;
        h += sin(dot(p, vec2(-0.27, 0.46)) + t * 1.05) * 0.32;
        h += sin(dot(p, vec2(0.71, -0.33)) + t * 1.55) * 0.18;
        h += (fbm(p * 0.9 + vec2(t * 0.35, t * 0.12)) - 0.5) * 0.9;
        h += (fbm(p * 1.9 - vec2(t * 0.22, -t * 0.4)) - 0.5) * 0.45;
        return h;
      }
      void main() {
        vec2 q = vWorld.xz;
        vec2 uv = (q + uHalf) / (uHalf * 2.0);
        vec4 dm = texture2D(uDepth, uv);
        float depth = dm.r;
        // v1.17.1: each lake has its own water (clear and icy, peaty, weedy, turquoise...), blending along the inflows
        vec4 ps = texture2D(uPreS, uv);
        float murk = ps.a;
        vec3 col = mix(ps.rgb, texture2D(uPreD, uv).rgb, smoothstep(0.0, mix(0.7, 0.3, murk), depth));
        // waves: a normal from the height field lights the surface
        float e = 0.12;
        float h0 = waveH(q, uTime);
        float hx = waveH(q + vec2(e, 0.0), uTime), hz = waveH(q + vec2(0.0, e), uTime);
        float calm = mix(0.55, 1.0, smoothstep(0.0, 0.35, depth)); // the shallows are calmer
        float se = 0.35, s0 = swell(q, uTime, uWind);
        float sgx = (swell(q + vec2(se, 0.0), uTime, uWind) - s0) / se, sgz = (swell(q + vec2(0.0, se), uTime, uWind) - s0) / se;
        // ripples (bobbers, splashes): rings that tilt the surface, so they catch the light
        vec2 rg; float rr = ripples(q, uTime, rg);
        vec3 N = normalize(vec3(-(hx - h0) / e * 0.24 * calm - sgx * 3.2 * calm - rg.x, 1.0, -(hz - h0) / e * 0.24 * calm - sgz * 3.2 * calm - rg.y));
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 L = normalize(uSunDir);
        // troughs a touch darker, crests catch the light
        float lit = clamp(dot(N, normalize(vec3(L.x, 1.0, L.z))), 0.0, 1.0);
        col *= 0.74 + 0.36 * lit;
        col += vec3(0.07, 0.1, 0.12) * smoothstep(0.35, 1.0, h0) * calm;
        col -= vec3(0.03, 0.04, 0.03) * smoothstep(-0.2, -0.9, h0) * calm;
        col = mix(col, uSkyTint, 0.16 * (1.0 - 0.5 * murk)); // (murky water shows its own colour more than the sky)
        // whitecaps on the crests when it blows
        float capK = smoothstep(0.55, 1.2, uWind) * calm;
        float cap = smoothstep(0.62, 0.95, vSwell) * step(0.5, vnoise(q * 1.7 + vec2(uTime * 0.6, 0.0))) * capK;
        col = mix(col, vec3(0.93, 0.97, 1.0), cap * 0.75);
        float sk = smoothstep(0.25, 1.1, uWind) * calm;
        col += vec3(0.06, 0.09, 0.1) * smoothstep(0.2, 1.0, vSwell) * sk;   // crests lighter
        col -= vec3(0.05, 0.06, 0.05) * smoothstep(-0.2, -1.0, vSwell) * sk; // troughs darker
        // v1.14.10 seafoam: a bright line where the water meets the shore, and lacy bands that roll in toward it
        float mDeep = max(0.0, depth * 12.0 - 0.15); // metres of water under this point
        float lace = fbm(q * 2.4 + vec2(uTime * 0.18, -uTime * 0.11));
        float edge = smoothstep(0.38, 0.02, mDeep + (lace - 0.5) * 0.25);
        float roll = smoothstep(0.6, 0.95, sin(mDeep * 5.5 - uTime * 1.7 + lace * 2.6)) * smoothstep(1.7, 0.25, mDeep);
        float foam = clamp(edge * 0.95 + roll * smoothstep(0.42, 0.68, lace) * 0.85, 0.0, 1.0) * (1.0 - smoothstep(0.55, 0.9, dm.g));
        foam *= 0.75 + 0.25 * sin(uTime * 2.1 + dot(q, vec2(0.7, 0.4))); // breathing as the water laps
        col = mix(col, vec3(0.96, 0.985, 1.0), foam * 0.85);
        // sun (or moon) on the moving surface: soft sheen plus sharp sparkles along the path
        vec3 R = reflect(-V, N);
        float spec = pow(max(dot(R, L), 0.0), 140.0);
        float sheen = pow(max(dot(R, L), 0.0), 12.0);
        col += vec3(1.0, 0.95, 0.82) * (spec * 1.1 + sheen * 0.12) * uGlitter;
        float g = hash(q * 3.1 + floor(uTime * 3.0));
        vec3 Rg = reflect(-V, vec3(0.0, 1.0, 0.0));
        float sunPath = smoothstep(0.9, 0.995, dot(Rg, L));
        float glit = step(0.994 - sunPath * 0.02, g) * uGlitter * sunPath;
        col += vec3(1.0, 0.95, 0.8) * glit * 0.35;
        col = mix(col, vec3(0.92, 0.97, 1.0), rr * 0.75);
        // rain rings
        if (uRain > 0.0) {
          vec2 cell = floor(q * 0.8);
          float hsh = hash(cell);
          float t = fract(uTime * 0.7 + hsh);
          vec2 c = (cell + vec2(hash(cell + 1.3), hash(cell + 7.1))) / 0.8;
          float ring = smoothstep(0.08, 0.0, abs(length(q - c) - t * 0.5)) * (1.0 - t) * step(hsh, uRain);
          col = mix(col, vec3(0.9), ring * 0.5);
        }
        col *= uLight;
        // clear in the shallows, murkier with depth, more mirror-like at grazing angles (tilted by the waves)
        float fres = pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 3.0);
        float alpha = mix(mix(0.34, 0.66, murk), mix(0.86, 0.95, murk), smoothstep(0.0, mix(0.55, 0.18, murk), depth)); // (murky water hides its bed sooner)
        alpha = mix(alpha, 0.94, fres * 0.7);
        col = mix(col, uSkyTint * uLight * 1.08, fres * 0.45 * (1.0 - 0.45 * murk));
        alpha = max(alpha, foam * 0.92); // (foam is white water, not see-through)
        alpha *= 1.0 - smoothstep(0.3, 0.9, dm.g);
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }`,
  });

  // the surface covers the valley at two blocks per quad: waves are long enough that finer only costs triangles
  const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, HALF, HALF);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, WATER_Y, 0);
  mesh.renderOrder = 2;
  mesh.name = 'water';

  let rippleIdx = 0;
  WAVES.uniforms = uniforms;
  return {
    mesh, uniforms,
    ripple(x, z, speed = 0) {
      const r = uniforms.uRipples.value[rippleIdx++ % MAX_RIPPLES];
      r.set(x, z, uniforms.uTime.value, speed);
    },
    update(t) {
      uniforms.uTime.value = t;
      SWASH.uSwT.value = t; SWASH.uSwH.value = 0.09 + 0.16 * smooth(0.2, 1.3, uniforms.uWind.value); // (lapping in a calm, running well up the sand in a blow)
      CAUSTICS.uCTime.value = t;
      CAUSTICS.uWaterY.value = WATER_Y;
      const L = uniforms.uLight.value;
      const lum = (L.r + L.g + L.b) / 3;
      CAUSTICS.uCaustic.value = Math.max(0, Math.min(1, (lum - 0.25) * 1.3)) * (1 - uniforms.uRain.value);
    },
  };
}
