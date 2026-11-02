// v1.17.5: real volumetric clouds, used by every sky in the game.
// Each frame a ray is marched from the camera through a layer of 3D noise, lit by a few steps toward the sun, into a small
// off-screen picture that is then spread over the sky behind everything solid. Nothing is stored: the noise is worked out once on
// load. The size of that picture and the steps per ray follow the graphics setting (VolClouds.quality).
//
// One object, added to a scene with scene.add(clouds.mesh). It draws itself: nothing else has to call render.
import * as THREE from 'three';

const QUAL = { low: { res: 0.3, steps: 22, light: 3 }, medium: { res: 0.4, steps: 34, light: 4 }, high: { res: 0.55, steps: 52, light: 5 } };
export const MAX_BLOBS = 16;

let noiseTex = null;
/** A tiling cube of cloud noise: billowy at the top of its range, with holes between. */
function cloudNoise() {
  if (noiseTex) return noiseTex;
  const N = 48, data = new Uint8Array(N * N * N), fbmPts = [4, 8, 16].map((cells, oi) => {
    let seed = 1234 + oi * 77; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    return { cells, pts: new Float32Array(cells * cells * cells * 3).map(() => rnd()) };
  });
  const worley = ({ cells, pts }, x, y, z) => {
    const fx = x * cells, fy = y * cells, fz = z * cells, ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz); let best = 9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const cx = ix + a, cy = iy + b, cz = iz + c, i = ((((cx % cells) + cells) % cells) + ((((cy % cells) + cells) % cells) * cells) + ((((cz % cells) + cells) % cells) * cells * cells)) * 3;
      const dx = cx + pts[i] - fx, dy = cy + pts[i + 1] - fy, dz = cz + pts[i + 2] - fz, d = dx * dx + dy * dy + dz * dz;
      if (d < best) best = d;
    }
    return 1 - Math.min(1, Math.sqrt(best));
  };
  for (let k = 0, q = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++, q++) {
    const x = i / N, y = j / N, z = k / N, v = worley(fbmPts[0], x, y, z) * 0.62 + worley(fbmPts[1], x, y, z) * 0.27 + worley(fbmPts[2], x, y, z) * 0.11;
    data[q] = Math.round(Math.min(1, Math.max(0, v)) * 255);
  }
  const t = new THREE.Data3DTexture(data, N, N, N);
  t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType; t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping; t.unpackAlignment = 1; t.needsUpdate = true;
  return (noiseTex = t);
}

const VERT = 'varying vec2 vU; void main(){ vU = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }';
const MARCH = (steps, light) => `
precision highp float; precision highp sampler3D;
varying vec2 vU;
uniform sampler3D uNoise; uniform mat4 uInv; uniform vec3 uCam, uSun, uLit, uShade, uHaze, uWind;
uniform float uY0, uY1, uTop, uScale, uCover, uMaxD, uDense, uJit, uDark;
uniform vec4 uBlobs[${MAX_BLOBS}]; uniform float uBlobH[${MAX_BLOBS}]; uniform int uNB;
float shape(vec3 p, out float blob) {
  blob = 0.0;
  float h = (p.y - uY0) / (uY1 - uY0);
  float prof = smoothstep(0.0, 0.14, h) * smoothstep(1.0, 0.42, h);
  vec3 q = p * uScale + uWind;
  float wide = texture(uNoise, vec3(q.xz * 0.13, 0.31)).r;
  float cov = smoothstep(1.0 - uCover, 1.0 - uCover + 0.34, wide + 0.12);
  float base = texture(uNoise, q).r;
  float d = (base - (1.0 - cov * prof) * 0.92) * 2.7;
  for (int i = 0; i < uNB; i++) {
    vec4 b = uBlobs[i]; vec3 v = p - b.xyz; v.y = max(abs(v.y) - uBlobH[i], 0.0);
    float k = 1.0 - length(v) / b.w;
    if (k > -0.25) { float e = texture(uNoise, q * 2.3).r; float bd = (k + (e - 0.55) * 0.55) * 3.2; if (bd > d) { d = bd; blob = 1.0; } }
  }
  return d;
}
void main() {
  vec4 far = uInv * vec4(vU * 2.0 - 1.0, 1.0, 1.0); vec3 rd = normalize(far.xyz / far.w - uCam);
  float t0 = 0.0, t1 = uMaxD;
  if (abs(rd.y) > 1e-4) { float a = (uY0 - uCam.y) / rd.y, b = (uTop - uCam.y) / rd.y; t0 = max(0.0, min(a, b)); t1 = min(uMaxD, max(a, b)); if (max(a, b) < 0.0) t1 = -1.0; }
  else if (uCam.y < uY0 || uCam.y > uTop) t1 = -1.0;
  vec4 c = vec4(0.0);
  if (t1 > t0) {
    float dt = (t1 - t0) / float(${steps}), t = t0 + dt * fract(sin(dot(gl_FragCoord.xy + uJit, vec2(12.9898, 78.233))) * 43758.5453);
    for (int i = 0; i < ${steps}; i++) {
      vec3 p = uCam + rd * t; float blob, d = shape(p, blob);
      if (d > 0.0) {
        float sum = 0.0, bl, ls = (uY1 - uY0) * 0.09;
        for (int j = 1; j <= ${light}; j++) sum += max(0.0, shape(p + uSun * ls * float(j), bl));
        float sh = exp(-sum * 1.05), hgt = clamp((p.y - uY0) / (uY1 - uY0), 0.0, 1.0);
        vec3 col = mix(uShade, uLit, sh * 0.82 + hgt * 0.18);
        if (blob > 0.5) col *= uDark;
        float a = 1.0 - exp(-d * uDense * dt);
        a *= 1.0 - smoothstep(uMaxD * 0.5, uMaxD, t);
        col = mix(col, uHaze, smoothstep(uMaxD * 0.25, uMaxD, t) * 0.7);
        c.rgb += col * a * (1.0 - c.a); c.a += a * (1.0 - c.a);
        if (c.a > 0.97) break;
      }
      t += dt;
    }
  }
  gl_FragColor = c;
}`;

export class VolClouds {
  /** y0, y1: the layer; scale: how big the clouds are (a smaller number is bigger); maxD: how far you can see them; cover 0..1. */
  constructor({ y0 = 54, y1 = 100, scale = 1 / 110, maxD = 900, cover = 0.5, dense = 0.05 } = {}) {
    this.q = null;
    this.u = {
      uNoise: { value: null }, uInv: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(0.4, 0.8, -0.4).normalize() },
      uLit: { value: new THREE.Color('#ffffff') }, uShade: { value: new THREE.Color('#8fa2c0') }, uHaze: { value: new THREE.Color('#dfeaf4') }, uWind: { value: new THREE.Vector3() },
      uY0: { value: y0 }, uY1: { value: y1 }, uTop: { value: y1 }, uScale: { value: scale }, uCover: { value: cover }, uMaxD: { value: maxD }, uDense: { value: dense }, uJit: { value: 0 }, uDark: { value: 0.42 },
      uBlobs: { value: Array.from({ length: MAX_BLOBS }, () => new THREE.Vector4()) }, uBlobH: { value: new Array(MAX_BLOBS).fill(0) }, uNB: { value: 0 },
    };
    this.pm = new THREE.Matrix4(); this.frame = -1; this.wind = new THREE.Vector2();
    this.quadScene = new THREE.Scene(); this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false; this.quadScene.add(this.quad);
    const tDiffuse = this.tOut = { value: null };
    const mat = new THREE.ShaderMaterial({
      uniforms: { tCloud: tDiffuse, uPx: this.px = { value: new THREE.Vector2() } }, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = vec4(position.xy, 0.99999, 1.0); }',
      fragmentShader: 'uniform sampler2D tCloud; uniform vec2 uPx; varying vec2 vU; void main(){ gl_FragColor = 0.2 * (texture2D(tCloud, vU) + texture2D(tCloud, vU + uPx) + texture2D(tCloud, vU - uPx) + texture2D(tCloud, vU + vec2(uPx.x, -uPx.y)) + texture2D(tCloud, vU + vec2(-uPx.x, uPx.y)));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); this.mesh.name = 'vol-clouds'; this.mesh.frustumCulled = false; this.mesh.renderOrder = -10; this.mesh.userData.keep = true;
    this.mesh.onBeforeRender = (r, _s, cam) => this.march(r, cam);
  }
  /** The light, and the drift. Colours are THREE.Colors; sun points toward the light. */
  update(dt, { sun, lit, shade, haze, cover, wind = 1, dark } = {}) {
    const u = this.u;
    if (sun) u.uSun.value.copy(sun);
    if (lit) u.uLit.value.copy(lit); if (shade) u.uShade.value.copy(shade); if (haze) u.uHaze.value.copy(haze);
    if (cover != null) u.uCover.value = cover; if (dark != null) u.uDark.value = dark;
    u.uWind.value.x -= dt * 0.0035 * wind; u.uWind.value.z -= dt * 0.0012 * wind; u.uWind.value.y += dt * 0.0006;
  }
  /** Solid-looking clouds at set places: [{ x, y, z, r, h }] (h stretches them up and down). */
  setBlobs(list) {
    const u = this.u; u.uNB.value = Math.min(MAX_BLOBS, list.length);
    list.slice(0, MAX_BLOBS).forEach((b, i) => { u.uBlobs.value[i].set(b.x, b.y, b.z, b.r); u.uBlobH.value[i] = b.h || 0; u.uTop.value = Math.max(u.uTop.value, b.y + (b.h || 0) + b.r); });
  }
  march(r, cam) {
    if (!cam.isPerspectiveCamera) return;
    const info = r.info.render.frame; if (info === this.frame) return; this.frame = info;
    const q = VolClouds.quality || 'medium', Q = QUAL[q] || QUAL.medium;
    if (q !== this.q || !this.mat) {
      this.q = q; this.mat?.dispose();
      this.u.uNoise.value = cloudNoise();
      this.mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: MARCH(Q.steps, Q.light), depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false });
      this.quad.material = this.mat;
    }
    r.getDrawingBufferSize(this.size ??= new THREE.Vector2());
    const w = Math.max(64, Math.floor(this.size.x * Q.res)), h = Math.max(64, Math.floor(this.size.y * Q.res));
    if (!this.rt) {
      this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false, colorSpace: THREE.LinearSRGBColorSpace });
      this.rt.texture.minFilter = this.rt.texture.magFilter = THREE.LinearFilter;
      this.tOut.value = this.rt.texture;
    } else if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    this.px.value.set(0.9 / w, 0.9 / h);
    this.pm.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse); this.u.uInv.value.copy(this.pm);
    this.u.uCam.value.setFromMatrixPosition(cam.matrixWorld);
    this.u.uJit.value = (this.u.uJit.value + 1.37) % 97;
    const prev = r.getRenderTarget(), auto = r.shadowMap.autoUpdate, xr = r.xr.enabled, tm = r.toneMapping;
    r.xr.enabled = false; r.shadowMap.autoUpdate = false; r.toneMapping = THREE.NoToneMapping;
    r.setRenderTarget(this.rt); r.setClearColor(0x000000, 0); r.clear(); r.render(this.quadScene, this.quadCam);
    r.setRenderTarget(prev); r.shadowMap.autoUpdate = auto; r.xr.enabled = xr; r.toneMapping = tm;
  }
  dispose() { this.rt?.dispose(); this.mat?.dispose(); this.quad.geometry.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
VolClouds.quality = 'medium';
/** The colours for a sky with no weather of its own (the flight and the races). */
export function paletteLight(clouds, P, night = false) {
  const lit = new THREE.Color(P.cloud), shade = new THREE.Color(P.shade).lerp(new THREE.Color(night ? '#0c1220' : '#6f86ad'), 0.45);
  clouds.update(0, { sun: new THREE.Vector3(0.38, 0.55, -0.74).normalize(), lit, shade, haze: new THREE.Color(P.fog) });
}
