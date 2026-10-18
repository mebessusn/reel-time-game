// Smooth valley terrain. The block heightmap still drives the game's logic (water, zones, spawns), but what
// you see and walk on is a smooth surface: the block heights blurred into rolling slopes, with lake and
// river edges that curve. Ground materials (grass, sand, dirt paths, stone, snow, mud, lake bed, gravel)
// blend into each other per vertex, and their textures are soft, painted noise rather than pixel tiles.
import * as THREE from 'three';
import { hash } from '../render/soft.js';

export const KIND = { grass: 0, sand: 1, dirt: 2, stone: 3, snow: 4, mud: 5, bed: 6, gravel: 7 };
const NK = 8;

// ---------------------------------------------------------------- blur helpers
function gaussKernel(sigma) {
  const r = Math.ceil(sigma * 2.5), k = [];
  let s = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(v); s += v; }
  return { r, k: k.map((v) => v / s) };
}
/** Separable gaussian blur of an n x n grid (row-major), edges clamped. */
export function blurGrid(src, n, sigma) {
  const { r, k } = gaussKernel(sigma);
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += src[a * n + Math.min(n - 1, Math.max(0, b + i))] * k[i + r];
    tmp[a * n + b] = s;
  }
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += tmp[Math.min(n - 1, Math.max(0, a + i)) * n + b] * k[i + r];
    out[a * n + b] = s;
  }
  return out;
}

/** Corner grid ((n+1) x (n+1)) from a block-centre grid: each corner is the mean of its four blocks. */
export function cornersOf(blocks, n) {
  const m = n + 1, out = new Float32Array(m * m);
  for (let a = 0; a <= n; a++) for (let b = 0; b <= n; b++) {
    const a0 = Math.max(0, a - 1), a1 = Math.min(n - 1, a), b0 = Math.max(0, b - 1), b1 = Math.min(n - 1, b);
    out[a * m + b] = (blocks[a0 * n + b0] + blocks[a0 * n + b1] + blocks[a1 * n + b0] + blocks[a1 * n + b1]) / 4;
  }
  return out;
}

// ---------------------------------------------------------------- textures (soft painted noise, tileable)
function tileNoise(size, period, seed) {
  // value noise that wraps every `period` cells across `size` pixels
  const cell = size / period;
  const g = (i, j) => hash(((i % period) + period) % period, ((j % period) + period) % period, seed);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = g(i, j), b = g(i + 1, j), c = g(i, j + 1), d = g(i + 1, j + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

function paintTexture(kind, size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const n1 = tileNoise(size, 4, 11 + kind), n2 = tileNoise(size, 12, 23 + kind), n3 = tileNoise(size, 32, 37 + kind), n4 = tileNoise(size, 64, 41 + kind);
  const base = hex(['#74ab52', '#e0cf98', '#8c6440', '#8d8b86', '#eef3f5', '#5f5a3e', '#b9a87a', '#5d636a'][kind]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const a = n1(x, y), b = n2(x, y), c = n3(x, y), d = n4(x, y);
    let k = 1, tint = [0, 0, 0];
    switch (kind) {
      case KIND.grass: {
        k = 0.86 + a * 0.16 + b * 0.1 + (d - 0.5) * 0.12;
        const blade = Math.sin((x * 0.9 + y * 2.3) + c * 9) > 0.86 && d > 0.45;
        if (blade) k *= 0.86;
        tint = [-(b - 0.5) * 18, (a - 0.5) * 14, -(a - 0.5) * 6];
        if (hash(x, y, 5) > 0.9986) tint = [120, 110, 60]; // the odd tiny flower
        break;
      }
      case KIND.sand:
        k = 0.94 + a * 0.06 + (c - 0.5) * 0.08 + Math.sin(y * 0.55 + b * 6 + x * 0.08) * 0.03;
        if (hash(x, y, 7) > 0.985) k *= 0.85;
        break;
      case KIND.dirt: {
        k = 0.85 + a * 0.12 + (c - 0.5) * 0.16;
        const peb = tileNoise(size, 24, 77)(x, y);
        if (peb > 0.72) { k = 1.12 + (peb - 0.72); tint = [8, 6, 10]; }
        break;
      }
      case KIND.stone: {
        k = 0.82 + a * 0.16 + b * 0.1 + (d - 0.5) * 0.08;
        const crack = Math.abs(n2(x * 1.7, y * 1.7) - 0.5) < 0.025;
        if (crack) k *= 0.72;
        break;
      }
      case KIND.snow: k = 0.95 + a * 0.05 + (c - 0.5) * 0.04; tint = [-4 * b, 0, 6 * b]; break;
      case KIND.mud: k = 0.82 + a * 0.15 + (c - 0.5) * 0.14; tint = [0, (b - 0.5) * 16, 0]; break;
      case KIND.bed: k = 0.88 + a * 0.1 + (c - 0.5) * 0.12; break;
      case KIND.gravel: { const p = n4(x, y); k = 0.78 + p * 0.38 + a * 0.06; break; }
      default: break;
    }
    const i = (y * size + x) * 4;
    img.data[i] = Math.max(0, Math.min(255, base[0] * k + tint[0]));
    img.data[i + 1] = Math.max(0, Math.min(255, base[1] * k + tint[1]));
    img.data[i + 2] = Math.max(0, Math.min(255, base[2] * k + tint[2]));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- material
function splatMaterial() {
  const texs = Array.from({ length: NK }, (_, k) => paintTexture(k));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.userData.splat = (shader) => {
    texs.forEach((t, k) => { shader.uniforms[`tSplat${k}`] = { value: t }; });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aW0; attribute vec4 aW1; varying vec4 vW0; varying vec4 vW1; varying vec2 vTP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW0 = aW0; vW1 = aW1; vTP = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec4 vW0; varying vec4 vW1; varying vec2 vTP;\n${texs.map((_, k) => `uniform sampler2D tSplat${k};`).join('\n')}`)
      .replace('#include <map_fragment>', /* glsl */ `
        {
          // one rotated scale (cheap on low-end GPUs); the vertex tint breaks up any repeats
          vec2 p1 = mat2(0.8, -0.6, 0.6, 0.8) * vTP / 4.0;
          vec3 g = vec3(0.0);
          if (vW0.x > 0.002) g += vW0.x * texture2D(tSplat0, p1).rgb;
          if (vW0.y > 0.002) g += vW0.y * texture2D(tSplat1, p1).rgb;
          if (vW0.z > 0.002) g += vW0.z * texture2D(tSplat2, p1).rgb;
          if (vW0.w > 0.002) g += vW0.w * texture2D(tSplat3, p1).rgb;
          if (vW1.x > 0.002) g += vW1.x * texture2D(tSplat4, p1).rgb;
          if (vW1.y > 0.002) g += vW1.y * texture2D(tSplat5, p1).rgb;
          if (vW1.z > 0.002) g += vW1.z * texture2D(tSplat6, p1).rgb;
          if (vW1.w > 0.002) g += vW1.w * texture2D(tSplat7, p1).rgb;
          float ws = dot(vW0, vec4(1.0)) + dot(vW1, vec4(1.0));
          diffuseColor.rgb *= g / max(ws, 0.001);
        }`);
  };
  mat.onBeforeCompile = (shader) => mat.userData.splat(shader);
  mat.customProgramCacheKey = () => 'smooth-splat';
  return mat;
}

/**
 * T: { HALF, N, surf: Float32Array corners ((N+1)^2), weights: Float32Array corners x 8, tint: (x,z)=>number }
 * Corner (a, b) sits at world x = a - HALF, z = b - HALF. Returns a group of chunk meshes sharing one material.
 */
export function buildSmoothTerrain(T) {
  const { HALF, N, surf, weights } = T;
  const M = N + 1;
  const at = (a, b) => surf[a * M + b];
  const mat = splatMaterial();
  const group = new THREE.Group();
  group.name = 'terrain';
  group.material = mat;
  // normals from the corner grid (central differences)
  const nrm = new Float32Array(M * M * 3);
  for (let a = 0; a < M; a++) for (let b = 0; b < M; b++) {
    const hx = at(Math.min(M - 1, a + 1), b) - at(Math.max(0, a - 1), b), hz = at(a, Math.min(M - 1, b + 1)) - at(a, Math.max(0, b - 1));
    const nx = -hx / 2, nz = -hz / 2, l = Math.hypot(nx, 1, nz);
    nrm.set([nx / l, 1 / l, nz / l], (a * M + b) * 3);
  }
  const CH = 32;
  for (let ca = 0; ca < N; ca += CH) for (let cb = 0; cb < N; cb += CH) {
    const a1 = Math.min(N, ca + CH), b1 = Math.min(N, cb + CH);
    const W = a1 - ca + 1, D = b1 - cb + 1;
    const pos = new Float32Array(W * D * 3), nor = new Float32Array(W * D * 3), col = new Float32Array(W * D * 3);
    const w0 = new Float32Array(W * D * 4), w1 = new Float32Array(W * D * 4);
    let v = 0;
    for (let a = ca; a <= a1; a++) for (let b = cb; b <= b1; b++, v++) {
      const g = a * M + b, x = a - HALF, z = b - HALF;
      pos[v * 3] = x; pos[v * 3 + 1] = surf[g]; pos[v * 3 + 2] = z;
      nor.set(nrm.subarray(g * 3, g * 3 + 3), v * 3);
      const ny = nrm[g * 3 + 1];
      // weights, with steep slopes turning to rock
      const w = weights.subarray(g * NK, g * NK + NK);
      const steep = Math.max(0, Math.min(1, (0.8 - ny) * 4));
      for (let k = 0; k < 4; k++) { w0[v * 4 + k] = w[k] * (1 - steep); w1[v * 4 + k] = w[k + 4] * (1 - steep); }
      if (surf[g] > T.waterY - 0.2) w0[v * 4 + 3] += steep; else w1[v * 4 + 3] += steep; // rock above water, gravel below
      // soft tint: broad light/dark drifts plus a touch of shade in hollows
      const k = T.tint(x, z) * (0.9 + ny * 0.1);
      col[v * 3] = k; col[v * 3 + 1] = k; col[v * 3 + 2] = k;
    }
    const idx = [];
    for (let i = 0; i < W - 1; i++) for (let j = 0; j < D - 1; j++) {
      const p00 = i * D + j, p10 = (i + 1) * D + j, p01 = i * D + j + 1, p11 = (i + 1) * D + j + 1;
      // same diagonal as surfaceY's triangle interpolation (00-10-01, 10-11-01), wound to face up
      idx.push(p00, p01, p10, p10, p01, p11);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aW0', new THREE.BufferAttribute(w0, 4));
    geo.setAttribute('aW1', new THREE.BufferAttribute(w1, 4));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain-chunk';
    group.add(mesh);
  }
  return group;
}
