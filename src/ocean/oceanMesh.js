// Open Waters: the sea surface. One big grid that follows the camera (fine near you, coarse toward the horizon),
// displaced by the Gerstner waves in waves.js. It takes its light from the valley's water (the sky sets those
// uniforms every frame), so dawn, dusk, night, rain and lightning all look right out here too.
//
// What the weather does to it: swell height and steepness, wind-sea chop, whitecaps that break on the steepest
// crests, foam streaks blown downwind in a gale, rain rings, and the sun's glitter path dimming under cloud.
import * as THREE from 'three';
import { OCEAN, oceanSurfaceY, SPOT_BY_ID } from './geo.js';
import { SEA, N_WAVES, WAVES_GLSL } from './waves.js';
import { RIPPLES_GLSL } from '../world/waterfx.js';

const WATER_Y = 0.85;
const GRID = 176, REACH = 620, CORE = 0.13; // vertices per side, metres to the edge, share of the grid kept even

// Depth under the sea (0 deep .. 1 at the beach) and a land mask, baked once the first time you go to sea.
function bakeDepth() {
  const N = 512, S = (OCEAN.half * 2) / N; // (v1.15.21: 2.5 m a texel, for the foam line)
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = OCEAN.x - OCEAN.half + (i + 0.5) * S, z = OCEAN.z - OCEAN.half + (j + 0.5) * S;
    const y = oceanSurfaceY(x, z), d = WATER_Y - y;
    const o = (j * N + i) * 4;
    data[o] = Math.max(0, Math.min(255, (1 - Math.min(1, Math.max(0, d) / 26)) * 255)); // shallowness
    data[o + 1] = Math.max(0, Math.min(255, (y - WATER_Y + 0.4) * 255 * 1.5)); // land
    data[o + 2] = Math.max(0, Math.min(255, (1 - Math.min(6, Math.max(0, d)) / 6) * 255)); // v1.15.21: depth in the last 6 m, for seafoam
    data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

function buildGrid() {
  // u in -1..1 maps to -REACH..REACH: even spacing in the middle, stretching toward the edge (u^5)
  const f = (u) => REACH * (CORE * u + (1 - CORE) * Math.sign(u) * Math.pow(Math.abs(u), 5));
  const n = GRID + 1, pos = new Float32Array(n * n * 3);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const o = (i * n + j) * 3;
    pos[o] = f(i / GRID * 2 - 1); pos[o + 1] = 0; pos[o + 2] = f(j / GRID * 2 - 1);
  }
  const idx = new Uint32Array(GRID * GRID * 6);
  let k = 0;
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const a = i * n + j, b = a + n;
    idx[k++] = a; idx[k++] = a + 1; idx[k++] = b; idx[k++] = a + 1; idx[k++] = b + 1; idx[k++] = b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), REACH * 1.5);
  return g;
}

export class OceanSurface {
  constructor(scene, valleyWater) {
    this.scene = scene; this.valley = valleyWater;
    this.mesh = null;
  }
  ensure() {
    if (this.mesh) return this.mesh;
    const V = this.valley.uniforms;
    const weed = SPOT_BY_ID.weedline, blue = SPOT_BY_ID.deepblue;
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uAmp: { value: SEA.amp }, uQ: { value: SEA.q }, uPhase: { value: SEA.phase },
      uDepth: { value: null }, uHalf: { value: OCEAN.half }, uCenter: { value: new THREE.Vector2(OCEAN.x, OCEAN.z) },
      uT: { value: 0 }, uChop: { value: 0.3 }, uFoam: { value: 0 }, uSpray: { value: 0 }, uSteep: { value: 0.3 }, uSwellA: { value: 0.5 }, uUnder: { value: 0 },
      uLight: { value: new THREE.Color(1, 1, 1) }, uSkyTint: { value: new THREE.Color('#8fc9f0') }, uSunDir: { value: new THREE.Vector3(0.3, 0.8, -0.5) },
      uGlitter: { value: 1 }, uRain: { value: 0 }, uFlash: { value: 0 },
      uWeed: { value: new THREE.Vector4(weed.x - OCEAN.x, weed.z - OCEAN.z, 0.96, 0.28) }, // a centre and a direction
      uBlue: { value: new THREE.Vector3(blue.x - OCEAN.x, blue.z - OCEAN.z, blue.r) },
      uVT: { value: 0 },
      uRipples: { value: V.uRipples.value }, // the same splash rings the lake shader draws
    }]);
    uniforms.uDepth.value = bakeDepth();
    // the per-wave arrays are shared, live, with waves.js (THREE.UniformsUtils.merge copied them)
    uniforms.uAmp.value = SEA.amp; uniforms.uQ.value = SEA.q; uniforms.uPhase.value = SEA.phase;
    uniforms.uRipples.value = V.uRipples.value;
    this.uniforms = uniforms;
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, // (seen from below when you dive)
      vertexShader: /* glsl */ `
        ${WAVES_GLSL}
        uniform sampler2D uDepth; uniform float uHalf; uniform vec2 uCenter;
        varying vec3 vWorld; varying vec3 vN; varying float vJac; varying float vH; varying vec2 vLocal; varying vec4 vDm;
        #include <fog_pars_vertex>
        void main() {
          vec4 wp0 = modelMatrix * vec4(position, 1.0);
          vec2 p = wp0.xz - uCenter;
          vec4 dm = texture2D(uDepth, (p + uHalf) / (uHalf * 2.0));
          float damp = 0.18 + 0.82 * (1.0 - dm.r); // waves shoal down over the reefs and beaches
          damp *= 1.0 - smoothstep(0.2, 0.7, dm.g);
          vec3 n; float jac;
          vec3 o = gerstner(p, n, jac);
          vec3 d = vec3(o.x - p.x, o.y, o.z - p.y) * damp;
          vec4 wp = vec4(wp0.x + d.x, ${WATER_Y.toFixed(2)} + d.y, wp0.z + d.z, 1.0);
          vN = normalize(mix(vec3(0.0, 1.0, 0.0), n, damp));
          vJac = mix(1.0, jac, damp); vH = d.y; vLocal = p + d.xz; vDm = dm;
          vWorld = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uT; uniform float uChop; uniform float uFoam; uniform float uSteep; uniform float uSwellA; uniform float uUnder; uniform float uSpray; uniform vec3 uLight; uniform vec3 uSkyTint;
        uniform vec3 uSunDir; uniform float uGlitter; uniform float uRain; uniform float uFlash; uniform vec4 uWeed; uniform vec3 uBlue;
        uniform vec4 uRipples[12]; uniform vec2 uCenter; uniform float uVT; uniform sampler2D uDepth; uniform float uHalf;
        varying vec3 vWorld; varying vec3 vN; varying float vJac; varying float vH; varying vec2 vLocal; varying vec4 vDm;
        #include <fog_pars_fragment>
        ${RIPPLES_GLSL(12)}
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.07 + vec2(3.1, 1.7); a *= 0.5; } return s; }
        void main() {
          vec2 q = vLocal;
          float dist = length(cameraPosition - vWorld);
          float near = 1.0 - smoothstep(30.0, 220.0, dist); // fine detail fades with distance (no shimmer)
          // chop: small wind ripples on the swell, two layers drifting across each other
          vec2 wv = vec2(0.76, 0.64);
          float e = 0.25;
          vec2 a1 = q * 0.55 + wv * uT * 0.9, a2 = q * 1.3 - vec2(-wv.y, wv.x) * uT * 0.7;
          float h0 = fbm(a1) + fbm(a2) * 0.5;
          float hx = fbm(a1 + vec2(e, 0.0)) + fbm(a2 + vec2(e * 2.36, 0.0)) * 0.5;
          float hz = fbm(a1 + vec2(0.0, e)) + fbm(a2 + vec2(0.0, e * 2.36)) * 0.5;
          float ck = uChop * 0.9 * near;
          vec2 rg; float rr = ripples(vWorld.xz, uVT, rg); // (v1.17.1: splash rings tilt the surface too)
          vec3 N = normalize(vN + vec3(-(hx - h0) / e * ck - rg.x, 0.0, -(hz - h0) / e * ck - rg.y));
          vec3 V = normalize(cameraPosition - vWorld);
          vec3 L = normalize(uSunDir);
          float shallow = vDm.r;
          // colour: the deep blue offshore, aquamarine and turquoise over sand, a purer, darker blue in the Deep Blue
          vec3 deep = vec3(0.02, 0.15, 0.30), mid = vec3(0.05, 0.32, 0.45), reef = vec3(0.16, 0.66, 0.66), sand = vec3(0.45, 0.82, 0.74);
          vec3 col = mix(deep, mid, smoothstep(0.15, 0.55, shallow));
          col = mix(col, reef, smoothstep(0.6, 0.86, shallow));
          col = mix(col, sand, smoothstep(0.88, 0.98, shallow));
          float blue = 1.0 - smoothstep(uBlue.z * 0.6, uBlue.z * 1.1, length(q - uBlue.xy));
          col = mix(col, vec3(0.01, 0.10, 0.30), blue * 0.6 * (1.0 - shallow));
          // light through the crest facing the sun (the green-blue glow in a breaking wave)
          float sss = pow(max(0.0, dot(V, -L + vec3(0.0, 0.25, 0.0))), 3.0) * smoothstep(-0.2, 1.4, vH);
          col += vec3(0.05, 0.28, 0.26) * sss * (0.35 + 0.65 * uGlitter);
          float lit = clamp(dot(N, normalize(vec3(L.x, 1.0, L.z))), 0.0, 1.0);
          col *= 0.7 + 0.42 * lit;
          // crests catch the light, troughs fall into shadow (reads the swell's shape from far away)
          float hk = vH / max(0.25, uSwellA);
          col += vec3(0.04, 0.09, 0.1) * smoothstep(0.1, 1.2, hk);
          col *= 1.0 - 0.18 * smoothstep(-0.1, -1.1, hk);
          // the weed line: rafts of golden sargassum strung along a current seam
          vec2 wd = normalize(uWeed.zw);
          vec2 rel = q - uWeed.xy;
          float across = dot(rel, vec2(-wd.y, wd.x)) + (vnoise(rel * 0.02) - 0.5) * 30.0;
          float along = dot(rel, wd);
          float band = (1.0 - smoothstep(4.0, 11.0, abs(across))) * (1.0 - smoothstep(70.0, 120.0, abs(along)));
          float rafts = smoothstep(0.52, 0.7, fbm(rel * 0.21 + vec2(uT * 0.01, 0.0))) * band;
          col = mix(col, vec3(0.62, 0.48, 0.16) * (0.75 + 0.5 * vnoise(rel * 2.1)), rafts * 0.85);
          // whitecaps: where the crest squeezes (the Gerstner jacobian dips), more as the wind rises
          float capN = fbm(q * 0.35 + wv * uT * 1.6);
          float c0 = 1.0 - uSteep * (0.2 + 0.35 * (1.0 - uFoam)), c1 = 1.0 - uSteep * 0.75;
          float cap = smoothstep(c0, c1, vJac) * smoothstep(0.42 - uFoam * 0.2, 0.7, capN) * smoothstep(0.02, 0.25, uFoam);
          cap = max(cap, smoothstep(0.8, 1.6, hk) * smoothstep(0.55, 0.75, capN) * smoothstep(0.35, 0.9, uFoam)); // the tallest crests break
          // foam streaks blown downwind in a gale
          vec2 sq = vec2(dot(q, wv), dot(q, vec2(-wv.y, wv.x)));
          float streak = smoothstep(0.62, 0.8, fbm(vec2(sq.x * 0.03 - uT * 0.4, sq.y * 0.6))) * smoothstep(0.45, 1.0, uFoam) * near;
          // surf on the beaches and the reef edges
          float surf = smoothstep(0.86, 0.97, shallow) * (0.5 + 0.5 * sin(dot(q, vec2(0.21, 0.13)) * 3.0 - uT * 1.4)) * (1.0 - vDm.g);
          // v1.15.21 seafoam, read per pixel: a bright line where the sea meets the sand, rocks and reefs, and lace
          // rolling in toward it in bands (bigger and livelier than on the lakes)
          vec4 dmf = texture2D(uDepth, (vWorld.xz - uCenter + uHalf) / (uHalf * 2.0));
          float mDeep = (1.0 - dmf.b) * 6.0;
          float lace = fbm(vWorld.xz * 0.9 + vec2(uT * 0.22, -uT * 0.13));
          float edge = smoothstep(1.0, 0.05, mDeep + (lace - 0.5) * 0.6) * (1.0 - smoothstep(0.55, 0.9, dmf.g));
          float roll = smoothstep(0.55, 0.92, sin(mDeep * 2.6 - uT * 1.5 + lace * 3.0)) * smoothstep(4.0, 0.4, mDeep) * smoothstep(0.38, 0.62, lace);
          float sea = clamp(edge * 0.95 + roll * 0.8, 0.0, 1.0) * (1.0 - uUnder) * (0.8 + 0.2 * sin(uT * 1.9 + dot(vWorld.xz, vec2(0.13, 0.09))));
          float foam = clamp(cap * 0.95 + streak * 0.45 + surf * 0.45 + sea * 0.9, 0.0, 1.0);
          col = mix(col, vec3(0.92, 0.96, 0.98), foam);
          // ripples (bobbers, splashes, the boat's wake) and rain rings
          vec2 wq = vWorld.xz;
          col = mix(col, vec3(0.92, 0.97, 1.0), rr * 0.55);
          if (uRain > 0.0) {
            vec2 cell = floor(wq * 0.6); float hsh = hash(cell);
            float t = fract(uT * 0.9 + hsh);
            vec2 c = (cell + vec2(hash(cell + 1.3), hash(cell + 7.1))) / 0.6;
            float ring = smoothstep(0.06, 0.0, abs(length(wq - c) - t * 0.4)) * (1.0 - t) * step(hsh, uRain * 0.8) * (1.0 - smoothstep(10.0, 45.0, dist));
            col = mix(col, vec3(0.8, 0.86, 0.9), ring * 0.22);
          }
          col *= uLight;
          // sky reflection and the sun's (or moon's) glitter path
          float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 5.0);
          col = mix(col, uSkyTint * uLight * 1.05 + uFlash, clamp(fres * 0.85, 0.0, 0.8));
          vec3 R = reflect(-V, N);
          float spec = pow(max(dot(R, L), 0.0), 180.0), sheen = pow(max(dot(R, L), 0.0), 14.0);
          col += vec3(1.0, 0.95, 0.82) * (spec * 1.4 + sheen * 0.12) * uGlitter * (1.0 - foam);
          float alpha = mix(0.9, 0.62, smoothstep(0.75, 0.98, shallow));
          alpha = mix(alpha, 0.97, fres * 0.6 + foam * 0.5);
          alpha = max(alpha, sea * 0.93); // (v1.15.21: seafoam is white water)
          alpha *= 1.0 - smoothstep(0.35, 0.9, vDm.g);
          gl_FragColor = vec4(col, alpha);
          if (!gl_FrontFacing) {
            // v1.17.1 from underneath (stylised Snell's window): straight up, a bright circle of sky, the sun a glowing
            // blot in it, its rim wobbling with the waves; past about 49 degrees from straight up the surface turns
            // into a mirror of the deep (total internal reflection), dark teal with the ripples' light moving in it
            float c = mix(-V.y, dot(-V, N), 0.3); // (V points down from the surface to you; the waves only wobble the rim)
            float win = smoothstep(0.62, 0.7, c);
            vec3 sky = mix(vec3(0.3, 0.72, 0.78), uSkyTint * 1.25, 0.45) * uLight;
            float rip = 0.82 + 0.18 * (h0 - 0.75) * 2.0;
            vec3 Lr = normalize(vec3(L.x * 0.75, max(L.y, 0.05), L.z * 0.75)); // the sun, pulled toward overhead by refraction
            float sun = pow(max(dot(-V, Lr), 0.0), 90.0) * 2.0 + pow(max(dot(-V, Lr), 0.0), 16.0) * 0.18;
            vec3 above = sky * rip + vec3(1.0, 0.95, 0.82) * sun * uGlitter;
            float rim = smoothstep(0.035, 0.0, abs(c - 0.66)) * 0.35;
            vec3 mirror = vec3(0.05, 0.25, 0.31) * uLight * (0.85 + 0.3 * h0) + vec3(0.03, 0.1, 0.1) * smoothstep(0.55, 0.9, h0) * uLight;
            gl_FragColor = vec4(mix(mirror, above, win) + sky * rim, 0.92);
          }
          #include <fog_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(buildGrid(), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.name = 'ocean';
    mesh.visible = false;
    this.scene.add(mesh);
    this.mesh = mesh;
    return mesh;
  }
  /** Follow the camera and copy the valley water's light. on: is anyone looking at the sea. */
  update(camPos, on, flash = 0) {
    if (!on) { if (this.mesh) this.mesh.visible = false; return; }
    const m = this.ensure();
    m.visible = true;
    const step = 8; // snap so the near grid doesn't swim over the waves
    m.position.set(Math.round(camPos.x / step) * step, 0, Math.round(camPos.z / step) * step);
    const u = this.uniforms, V = this.valley.uniforms;
    u.uT.value = SEA.time % 3600;
    u.uChop.value = SEA.lite ? SEA.chop * 0.4 : SEA.chop; u.uFoam.value = SEA.lite ? 0 : SEA.foam; u.uSpray.value = SEA.lite ? 0 : SEA.spray; u.uSteep.value = SEA.steep; // (low graphics: calmer detail, no foam)
    u.uSwellA.value = Math.hypot(...SEA.amp);
    u.uLight.value.copy(V.uLight.value); u.uSkyTint.value.copy(V.uSkyTint.value); u.uSunDir.value.copy(V.uSunDir.value);
    u.uVT.value = V.uTime.value;
    u.uGlitter.value = V.uGlitter.value; u.uRain.value = V.uRain.value; u.uFlash.value = flash;
  }
  dispose() { if (!this.mesh) return; this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.uniforms.uDepth.value.dispose(); this.mesh = null; }
}
export const OCEAN_GRID = { GRID, REACH, N_WAVES };
