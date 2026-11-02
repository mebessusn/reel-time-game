// Surface detail for models that are flat colour: a fine grain and a broader mottling, sampled in world space from one small noise
// texture, so nothing reads as plain plastic up close and nothing needs a texture of its own. Three texture reads, one shared
// texture, no new draw calls. DETAIL.uDetailK.value is 0 on low quality (the shader then skips the reads).
import * as THREE from 'three';

let tex = null;
function noiseTexture() {
  if (tex) return tex;
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N);
  let s = 90210; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const grid = (n) => { const g = new Float32Array(n * n); for (let i = 0; i < n * n; i++) g[i] = r(); return g; };
  const layers = [[8, 0.5], [32, 0.3], [128, 0.2]].map(([n, w]) => ({ n, w, g: grid(n) }));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let v = 0;
    for (const L of layers) { const u = i / N * L.n, t = j / N * L.n, a = Math.floor(u), b = Math.floor(t), fu = u - a, ft = t - b, n = L.n, at = (p, q) => L.g[(q % n) * n + (p % n)]; const su = fu * fu * (3 - 2 * fu), st = ft * ft * (3 - 2 * ft); v += L.w * ((at(a, b) * (1 - su) + at(a + 1, b) * su) * (1 - st) + (at(a, b + 1) * (1 - su) + at(a + 1, b + 1) * su) * st); }
    const k = (j * N + i) * 4, g = Math.round(v * 255); img.data[k] = img.data[k + 1] = img.data[k + 2] = g; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 2;
  return tex;
}

export const DETAIL = { uDetail: { value: null }, uDetailK: { value: 1 } };

/** Lay stone or tile on a flat-coloured wall or floor, in world space: courses of blocks with a mortar line, each block its own shade. */
export function applyTiles(material, { size = 1.4, height = 0.7, mortar = 0.035, dark = 0.74, floor = false } = {}) {
  const prev = material.onBeforeCompile, key = material.customProgramCacheKey?.call(material) || '';
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    DETAIL.uDetail.value ??= noiseTexture();
    Object.assign(shader.uniforms, DETAIL);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTW; varying vec3 vTN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz; vTN = abs(normalize(mat3(modelMatrix) * objectNormal));');
    const uv = floor ? 'vTW.xz' : 'vec2(vTN.x > vTN.z ? vTW.z : vTW.x, vTW.y)';
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail; uniform float uDetailK; varying vec3 vTW; varying vec3 vTN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uDetailK > 0.0) {
          vec2 tb = ${uv} / vec2(${size.toFixed(2)}, ${height.toFixed(2)});
          float row = floor(tb.y); tb.x += mod(row, 2.0) * 0.5;
          vec2 tf = fract(tb), id = floor(tb);
          float edge = min(min(tf.x, 1.0 - tf.x) * ${size.toFixed(2)}, min(tf.y, 1.0 - tf.y) * ${height.toFixed(2)});
          float shade = texture2D(uDetail, (id + 0.5) * 0.043).r, grain = texture2D(uDetail, ${uv} * 0.31).r;
          diffuseColor.rgb *= mix(${dark.toFixed(2)}, 0.9 + shade * 0.22, smoothstep(0.0, ${mortar.toFixed(3)}, edge)) * (0.9 + grain * 0.2);
        }`);
  };
  material.customProgramCacheKey = () => `tiles${size}${height}${floor}${key}`;
  return material;
}

/** Add the grain to a material. Safe alongside other shader patches (caustics, night windows). */
export function applyDetail(material, { scale = 0.9, strength = 0.26 } = {}) {
  if (material.userData.detail) return material;
  material.userData.detail = true;
  const prev = material.onBeforeCompile, key = material.customProgramCacheKey?.call(material) || '';
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    DETAIL.uDetail.value ??= noiseTexture();
    Object.assign(shader.uniforms, DETAIL);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDW; varying vec3 vDN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vDW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vDW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif
        vDN = abs(normalize(mat3(modelMatrix) * objectNormal));`);
    if (!shader.vertexShader.includes('objectNormal')) shader.vertexShader = shader.vertexShader.replace('vDN = abs(normalize(mat3(modelMatrix) * objectNormal));', 'vDN = vec3(0.0, 1.0, 0.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail; uniform float uDetailK; varying vec3 vDW; varying vec3 vDN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uDetailK > 0.0) {
          vec3 dw = vDN / (vDN.x + vDN.y + vDN.z + 0.001), dp = vDW * ${scale.toFixed(2)};
          float dn = texture2D(uDetail, dp.zy * 0.25).r * dw.x + texture2D(uDetail, dp.xz * 0.25).r * dw.y + texture2D(uDetail, dp.xy * 0.25).r * dw.z;
          diffuseColor.rgb *= 1.0 + (dn - 0.5) * ${(strength * 2).toFixed(2)} * uDetailK;
        }`);
  };
  material.customProgramCacheKey = () => `detail${scale}${strength}${key}`;
  return material;
}
