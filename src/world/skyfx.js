// Sky dressing for the bigger valley: fluffy soft-block clouds, a dense twinkling star dome,
// a large glowing pixel moon, and low ground fog that pools in the valley at dawn, dusk and night.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from '../core/rng.js';
import { HALF, WATER_Y } from './terrain.js';

// ---------------------------------------------------------------- clouds
// Each cloud is a cluster of rounded puffs (bigger in the middle, flat-ish base), merged into one
// geometry with vertex shading: bright crowns, soft grey undersides.
export function buildClouds(count = 34, seed = 77) {
  const r = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'clouds';
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.94, fog: false, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.35 });
  const top = new THREE.Color('#ffffff'), under = new THREE.Color('#c8d0dc');
  for (let i = 0; i < count; i++) {
    const puffs = [];
    const n = 5 + Math.floor(r() * 6);
    const len = 14 + r() * 22, wid = 8 + r() * 10;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1) - 0.5;
      const mid = 1 - Math.abs(t) * 1.3;
      const s = (5 + r() * 5) * (0.6 + mid * 0.7);
      const g = new RoundedBoxGeometry(s * (1.1 + r() * 0.5), s * (0.65 + r() * 0.25), s * (1 + r() * 0.4), 2, s * 0.32); // 2 segments (v1.13.19: was 3; same from the ground, half the triangles)
      g.translate(t * len + (r() - 0.5) * 3, s * 0.3 * mid + r() * 1.5, (r() - 0.5) * wid * 0.6);
      puffs.push(g);
    }
    // a wide flat base slab keeps the bottom tidy
    const base = new RoundedBoxGeometry(len * 1.05, 2.4, wid * 0.8, 2, 1.1);
    base.translate(0, -0.6, 0);
    puffs.push(base);
    const geo = mergeGeometries(puffs);
    puffs.forEach((g) => g.dispose());
    geo.computeBoundingBox();
    const { min, max } = geo.boundingBox;
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let v = 0; v < pos.count; v++) {
      const k = Math.min(1, Math.max(0, (pos.getY(v) - min.y) / (max.y - min.y)));
      c.copy(under).lerp(top, Math.pow(k, 0.6));
      col.set([c.r, c.g, c.b], v * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, mat);
    const spread = HALF * 2.6;
    m.position.set((r() - 0.5) * spread * 2, 58 + r() * 22, (r() - 0.5) * spread * 2);
    m.rotation.y = r() * Math.PI;
    m.userData.speed = 0.8 + r() * 0.8;
    group.add(m);
  }
  group.userData.mat = mat;
  group.userData.wrap = HALF * 2.6;
  return group;
}

export function updateClouds(group, dt, { tint, sun, gloom, night }) {
  const W = group.userData.wrap;
  for (const m of group.children) {
    m.position.x += dt * m.userData.speed * (1 + gloom);
    if (m.position.x > W) m.position.x -= W * 2;
  }
  const mat = group.userData.mat;
  mat.color.copy(tint);
  mat.emissive.copy(tint);
  mat.emissiveIntensity = 0.12 + sun * 0.3;
  mat.opacity = Math.min(0.97, 0.88 + gloom * 0.1) * (1 - night * 0.35);
}

// ---------------------------------------------------------------- stars
export function buildStars(count = 3200, seed = 9) {
  const r = mulberry32(seed);
  const pos = new Float32Array(count * 3), size = new Float32Array(count), phase = new Float32Array(count), tint = new Float32Array(count * 3);
  const palette = [[1, 1, 1], [0.8, 0.88, 1], [1, 0.92, 0.78], [0.85, 0.8, 1]];
  for (let i = 0; i < count; i++) {
    // denser toward a tilted "milky" band
    let u = r() * 2 - 1, th = r() * Math.PI * 2;
    if (i % 3 === 0) { u = (r() - 0.5) * 0.35 + 0.35; th = r() * Math.PI * 2; }
    const y = Math.abs(u), rr = Math.sqrt(1 - u * u);
    pos.set([rr * Math.cos(th) * 300, y * 300 + 6, rr * Math.sin(th) * 300], i * 3);
    const big = r();
    size[i] = big > 0.985 ? 6 : big > 0.92 ? 4.5 : big > 0.6 ? 3 : 2;
    phase[i] = r() * 6.28;
    tint.set(palette[Math.floor(r() * palette.length)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  g.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPx: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float size; attribute float phase; attribute vec3 tint;
      uniform float uTime; uniform float uPx; varying float vTw; varying vec3 vTint;
      void main() {
        vTw = 0.65 + 0.35 * sin(uTime * (1.3 + fract(phase) * 2.0) + phase * 7.0);
        vTint = tint;
        gl_PointSize = size * uPx * (0.85 + vTw * 0.3);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying float vTw; varying vec3 vTint;
      void main() {
        vec2 q = abs(gl_PointCoord - 0.5);
        float cross = step(max(q.x, q.y), 0.5) * (step(q.x, 0.17) + step(q.y, 0.17)); // pixel plus-shaped twinkle
        float a = clamp(cross, 0.0, 1.0);
        if (a < 0.01) discard;
        gl_FragColor = vec4(vTint, a * uOpacity * vTw);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -2;
  return pts;
}

// ---------------------------------------------------------------- moon
// v1.8.2: smooth, painted moon (no pixels): a lit sphere with soft maria and craters, and a soft-edged
// terminator for the phase. The dark side keeps a faint earthshine so a crescent still reads as a whole moon.
function moonTexture(phase) {
  const S = 160;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const img = x.createImageData(S, S), d = img.data;
  const R = S / 2 - 3, cx = S / 2;
  const th = (phase / 8) * Math.PI * 2; // 0 new, pi full
  const L = [Math.sin(th), -0.12, -Math.cos(th)]; // light from the right while waxing, face-on at full
  const maria = [[-0.28, -0.22, 0.34], [0.18, -0.05, 0.28], [-0.05, 0.3, 0.22], [0.32, 0.32, 0.16]];
  const craters = [[0.35, -0.42, 0.09], [-0.42, 0.18, 0.07], [0.1, 0.52, 0.06], [-0.15, -0.55, 0.05], [0.55, 0.08, 0.05], [-0.6, -0.1, 0.04]];
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const u = (px + 0.5 - cx) / R, v = (py + 0.5 - cx) / R, rr = u * u + v * v;
    const i = (py * S + px) * 4;
    if (rr > 1) { d[i + 3] = 0; continue; }
    const nz = Math.sqrt(1 - rr);
    // surface: pale cream, darker grey-blue maria, soft-rimmed craters
    let tone = 0.95 - 0.08 * rr;
    for (const [mx, my, mr] of maria) { const q = Math.hypot(u - mx, v - my) / mr; if (q < 1) tone -= 0.12 * (1 - q * q); }
    for (const [qx, qy, qr] of craters) { const q = Math.hypot(u - qx, v - qy) / qr; if (q < 1.25) tone += q < 1 ? -0.07 * (1 - q) + (u - qx < 0 ? 0.04 : -0.02) * (1 - q) : 0.03 * (1.25 - q) * 4; }
    // phase: the lit side of the sphere, with a soft terminator
    const lam = u * L[0] + v * L[1] + nz * L[2];
    const lit = phase === 4 ? 1 : Math.min(1, Math.max(0, (lam + 0.06) / 0.16));
    const r0 = 246 * tone, g0 = 240 * tone, b0 = 222 * tone; // lit colour
    const er = 52, eg = 60, eb = 92; // earthshine
    d[i] = er + (r0 - er) * lit; d[i + 1] = eg + (g0 - eg) * lit; d[i + 2] = eb + (b0 - eb) * lit;
    const edge = Math.min(1, (1 - Math.sqrt(rr)) * R / 1.5); // anti-aliased rim
    d[i + 3] = 255 * edge * (0.55 + 0.45 * lit);
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** The sun: a warm, soft-edged disc (smooth, no pixels) for the sprite in sky.js. */
export function sunTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,253,240,1)');
  g.addColorStop(0.38, 'rgba(255,246,205,1)');
  g.addColorStop(0.48, 'rgba(255,226,150,0.95)');
  g.addColorStop(0.56, 'rgba(255,214,120,0.35)');
  g.addColorStop(0.78, 'rgba(255,200,110,0.08)');
  g.addColorStop(1, 'rgba(255,200,110,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function glowTexture() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,250,220,0.95)');
  g.addColorStop(0.25, 'rgba(230,236,255,0.45)');
  g.addColorStop(0.6, 'rgba(170,190,255,0.12)');
  g.addColorStop(1, 'rgba(150,170,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

export class Moon {
  constructor(scene) {
    this.mat = new THREE.SpriteMaterial({ fog: false, depthWrite: false, transparent: true });
    this.disc = new THREE.Sprite(this.mat);
    this.disc.scale.set(34, 34, 1);
    this.glowMat = new THREE.SpriteMaterial({ map: glowTexture(), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.8 });
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.scale.set(120, 120, 1);
    this.disc.renderOrder = -1; this.glow.renderOrder = -1;
    scene.add(this.glow, this.disc);
    this.phase = -1;
  }
  // Rides a low arc across the northern sky (in front of the default camera) through the night.
  update(focus, f, phase, visible, gloom, blood = 0) {
    this.mat.color.setRGB(1, 1 - blood * 0.86, 1 - blood * 0.9); // v1.9: a deep blood red disc and halo
    this.glowMat.color.setRGB(1, 1 - blood * 0.9, 1 - blood * 0.92);
    if (phase !== this.phase) { this.mat.map?.dispose(); this.mat.map = moonTexture(phase); this.mat.needsUpdate = true; this.phase = phase; }
    const nightT = ((f + 0.25) % 1) / 0.55; // 0 at dusk (~0.75) .. 1 at dawn (~0.3)
    const a = Math.min(1, Math.max(0, nightT));
    const dir = new THREE.Vector3(Math.cos(Math.PI * (1 - a)) * 0.75, 0.25 + Math.sin(Math.PI * a) * 0.12, -1).normalize();
    this.dir = dir;
    this.disc.position.copy(focus).addScaledVector(dir, 220);
    this.glow.position.copy(this.disc.position).addScaledVector(dir, 2);
    const fullness = 1 - Math.abs(4 - phase) / 4;
    this.disc.visible = this.glow.visible = visible;
    this.mat.opacity = 1 - gloom * 0.7;
    this.glowMat.opacity = Math.min(1, (0.35 + fullness * 0.55 + blood * 0.35)) * (1 - gloom * 0.8);
    this.glow.scale.setScalar(90 + fullness * 50 + blood * 60);
    this.disc.scale.setScalar(34 + blood * 10);
  }
}

// ---------------------------------------------------------------- ground fog
// Three stacked translucent sheets with drifting noise, faded near the camera and thinned where
// they cross into hills. Amount follows the time of day (thick at dawn, wisps at dusk and night).
export function buildGroundFog() {
  const group = new THREE.Group();
  group.name = 'ground-fog';
  const mats = [];
  [1.35, 2.15, 3.0].forEach((y, i) => {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uColor: { value: new THREE.Color('#ffffff') }, uLayer: { value: i }, uCam: { value: new THREE.Vector3() } },
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uAmount; uniform vec3 uColor; uniform float uLayer; uniform vec3 uCam;
        varying vec3 vW;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          vec2 p = floor(vW.xz * 2.0) / 2.0; // chunky half-block pixels
          float t = uTime * (0.25 + uLayer * 0.08);
          float n = vnoise(p * 0.045 + vec2(t, t * 0.6) + uLayer * 3.1) * 0.65 + vnoise(p * 0.11 - vec2(t * 1.4, 0.0) + uLayer) * 0.35;
          float dens = smoothstep(0.38, 0.8, n);
          float near = smoothstep(4.0, 22.0, distance(vW, uCam)); // never a wall in your face
          float a = dens * near * uAmount * (0.42 - uLayer * 0.1);
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2, 1, 1).rotateX(-Math.PI / 2), mat);
    plane.position.y = y + (WATER_Y - 0.85);
    plane.renderOrder = 4;
    group.add(plane);
    mats.push(mat);
  });
  group.userData.mats = mats;
  return group;
}

// How foggy it is at day fraction f (0..1) and weather.
export function fogAmount(f, weather) {
  const bump = (c, w) => Math.max(0, 1 - Math.abs(f - c) / w);
  let a = bump(0.27, 0.07) * 1.0 + bump(0.78, 0.05) * 0.45 + (f > 0.83 || f < 0.18 ? 0.35 : 0);
  if (weather === 'rain') a = Math.max(a, 0.45);
  if (weather === 'storm') a = Math.max(a, 0.3);
  if (weather === 'overcast') a = Math.max(a, 0.25);
  return Math.min(1, a);
}

export function updateGroundFog(group, t, amount, color, cam) {
  group.visible = amount > 0.02;
  for (const m of group.userData.mats) {
    m.uniforms.uTime.value = t;
    m.uniforms.uAmount.value = amount;
    m.uniforms.uColor.value.copy(color);
    m.uniforms.uCam.value.copy(cam);
  }
}
