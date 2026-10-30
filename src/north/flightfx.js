// v1.16.3 "Above the Clouds", the looks: fluffy shaded clouds (puffy clusters with bumpy, sun-lit tops, shaded
// undersides and soft wispy edges), a cirrus layer high up and cloud banks on the horizon, distant birds, the updraft
// as a stream of wind spiralling upward, speed lines, and a little feather burst for bird strikes.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

// ---------------------------------------------------------------- clouds
const NOISE = `
  vec3 h3(vec3 p){ p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453) * 2.0 - 1.0; }
  float n3(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(h3(i), f), dot(h3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x), mix(dot(h3(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(h3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(h3(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(h3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x), mix(dot(h3(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(h3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z); }`;

/** A puff: a bumpy ball, bright and warm on top where the sun hits, cool and shaded underneath, with a soft rim. */
export function puffMaterial(P, sunDir) {
  return new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(P.cloud) }, uShade: { value: new THREE.Color(P.shade) }, uSun: { value: new THREE.Color(P.sun) }, uSunDir: { value: sunDir.clone().normalize() }, uFog: { value: new THREE.Color(P.fog) }, uFogNear: { value: 120 }, uFogFar: { value: 900 }, uT: { value: 0 } },
    vertexShader: `${NOISE}
      uniform float uT; varying vec3 vN; varying vec3 vW; varying float vH; varying float vD;
      void main(){
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float s = length(instanceMatrix[0].xyz);
        vec3 p = position;
        float n = n3(p * 1.6 + ip.xyz * 0.05) * 0.22 + n3(p * 3.7 + ip.xyz * 0.11 + uT * 0.02) * 0.08;
        p += normal * n;
        vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vW = w.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * (normal + vec3(0.0, n * 0.6, 0.0))); vH = position.y; vD = n;
        vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uTop, uShade, uSun, uSunDir, uFog; uniform float uFogNear, uFogFar; varying vec3 vN; varying vec3 vW; varying float vH; varying float vD;
      void main(){
        vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
        float up = smoothstep(-0.55, 0.85, n.y);
        float sun = max(0.0, dot(n, uSunDir));
        vec3 c = mix(uShade * 0.92, uTop, up);
        c += uSun * pow(sun, 2.0) * 0.18;
        c = mix(c, uShade * 0.8, smoothstep(0.1, -0.15, vD) * 0.25); // (the hollows between the bumps)
        float rim = pow(1.0 - max(0.0, dot(n, v)), 2.5);
        c += mix(uTop, uSun, 0.5) * rim * 0.22 * (0.4 + 0.6 * up);
        float f = smoothstep(uFogNear, uFogFar, length(cameraPosition - vW));
        gl_FragColor = vec4(mix(c, uFog, f), 1.0);
      }`,
  });
}

/** A soft round sprite texture (wisps, glows). */
function softTex(inner = 0.0) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, inner * 32, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** The cloud data: clusters of puffs (a flat-bottomed heap: big puffs low, smaller ones on top), plus towers. */
export function cloudClusters(TILE, r = mulberry32(31)) {
  const out = [];
  for (let k = 0; k < 150; k++) {
    const cx = (r() - 0.5) * TILE, cz = (r() - 0.5) * TILE, size = 12 + r() * 22, base = -6 + r() * 8;
    const n = 6 + Math.floor(r() * 7);
    for (let j = 0; j < n; j++) {
      const a = r() * Math.PI * 2, d = r() * size * 0.9, s = size * (0.45 + r() * 0.5) * (1 - d / (size * 2.2));
      out.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d * 0.7, y: base + s * 0.25 + (1 - d / size) * size * 0.25, s, sy: 0.62 + r() * 0.2 });
    }
  }
  // towering cumulus: stacked heaps rising out of the cloud sea
  for (let k = 0; k < 18; k++) {
    const cx = (r() - 0.5) * TILE, cz = (r() - 0.5) * TILE, hgt = 45 + r() * 75;
    for (let j = 0; j < 14; j++) { const f = j / 14; out.push({ x: cx + (r() - 0.5) * 34 * (1 - f * 0.6), z: cz + (r() - 0.5) * 34 * (1 - f * 0.6), y: f * hgt, s: 20 - f * 9 + r() * 6, sy: 0.85, tower: true }); }
  }
  return out;
}

/** Wisps: soft billboards round the cloud edges and in thin layers (instanced sprites as camera-facing quads). */
export function makeWisps(scene, P, data, TILE) {
  const n = Math.min(900, data.length);
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: softTex(0.1) }, uCol: { value: new THREE.Color(P.cloud) }, uFog: { value: new THREE.Color(P.fog) }, uFogNear: { value: 120 }, uFogFar: { value: 900 } },
    vertexShader: `varying vec2 vU; varying float vF; uniform float uFogNear, uFogFar;
      void main(){ vU = uv; vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float s = length(instanceMatrix[0].xyz);
        c.xy += position.xy * s * vec2(1.6, 0.7); vF = smoothstep(uFogNear, uFogFar, -c.z); gl_Position = projectionMatrix * c; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 uCol, uFog; varying vec2 vU; varying float vF;
      void main(){ float a = texture2D(map, vU).a * 0.5; gl_FragColor = vec4(mix(uCol, uFog, vF), a * (1.0 - vF * 0.6)); }`,
  });
  const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.renderOrder = 2;
  const r = mulberry32(77), items = [];
  for (let i = 0; i < n; i++) { const c = data[Math.floor(r() * data.length)]; items.push({ x: c.x + (r() - 0.5) * c.s * 1.6, z: c.z + (r() - 0.5) * c.s * 1.6, y: c.y + (r() - 0.3) * c.s * 0.5, s: c.s * (1.0 + r() * 1.2) }); }
  scene.add(im);
  return { im, items, TILE };
}
export function layoutWrapped(im, items, pos, TILE, sy = (it) => it.sy || 1) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  items.forEach((c, i) => {
    let dx = c.x - pos.x, dz = c.z - pos.z;
    dx = ((dx + TILE / 2) % TILE + TILE) % TILE - TILE / 2; dz = ((dz + TILE / 2) % TILE + TILE) % TILE - TILE / 2;
    p.set(pos.x + dx, c.y, pos.z + dz); s.set(c.s, c.s * sy(c), c.s);
    m.compose(p, q, s); im.setMatrixAt(i, m);
  });
  im.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- the sky's extra layers
export function cirrus(P) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color(P.cloud) }, uOff: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${NOISE} uniform float uT; uniform vec3 uCol; uniform vec2 uOff; varying vec2 vU;
      void main(){ vec2 p = (vU + uOff) * vec2(9.0, 26.0); float n = n3(vec3(p, uT * 0.01)) * 0.6 + n3(vec3(p * 2.3, 1.0)) * 0.3 + n3(vec3(p * 5.0, 2.0)) * 0.1;
        float a = smoothstep(0.05, 0.5, n) * 0.55; float edge = smoothstep(0.5, 0.2, length(vU - 0.5)); gl_FragColor = vec4(uCol, a * edge); }`,
  }));
  m.rotation.x = -Math.PI / 2; m.position.y = 420; m.renderOrder = -1;
  return m;
}
/** A ring of cloud banks round the horizon (a cylinder with a soft, lumpy top edge). */
export function horizonBanks(P) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1500, 1500, 260, 96, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.BackSide,
    uniforms: { uCol: { value: new THREE.Color(P.cloud) }, uShade: { value: new THREE.Color(P.shade) } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${NOISE} uniform vec3 uCol, uShade; varying vec2 vU;
      void main(){ float x = vU.x * 40.0; float top = 0.35 + n3(vec3(x, 0.0, 0.0)) * 0.25 + n3(vec3(x * 3.0, 1.0, 0.0)) * 0.1;
        float a = smoothstep(top + 0.04, top - 0.08, vU.y); vec3 c = mix(uShade, uCol, smoothstep(0.0, top, vU.y)); gl_FragColor = vec4(c, a * 0.85); }`,
  }));
  m.position.y = 40; m.renderOrder = -1;
  return m;
}

// ---------------------------------------------------------------- the updraft: a stream of wind spiralling upward
export function updraftMesh() {
  const grp = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color('#c8f2ff') } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; uniform vec3 uCol; varying vec2 vU;
      void main(){ float streak = smoothstep(0.0, 0.25, fract(vU.x * 3.0 - uT * 0.9)) * smoothstep(1.0, 0.55, fract(vU.x * 3.0 - uT * 0.9));
        float across = smoothstep(0.0, 0.5, vU.y) * smoothstep(1.0, 0.5, vU.y); float ends = smoothstep(0.0, 0.08, vU.x) * smoothstep(1.0, 0.85, vU.x);
        gl_FragColor = vec4(uCol, streak * across * ends * 0.42); }`,
  });
  // five ribbons wound round the column, each a twisted strip rising 70 m
  for (let k = 0; k < 5; k++) {
    const pts = [], ph = k / 5 * Math.PI * 2, R = 4 + (k % 2) * 2.2;
    for (let i = 0; i <= 64; i++) { const t = i / 64; pts.push(new THREE.Vector3(Math.cos(ph + t * 7) * R * (1 - t * 0.25), -25 + t * 70, Math.sin(ph + t * 7) * R * (1 - t * 0.25))); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 128, 0.55 + (k % 3) * 0.2, 3, false);
    // flatten the tube's v into the strip's across-coordinate
    const m = new THREE.Mesh(geo, mat); grp.add(m);
  }
  // rising motes, stretched into streaks
  const n = 220, p = new Float32Array(n * 3), r = mulberry32(5);
  for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = r() * 6; p.set([Math.cos(a) * d, r() * 70 - 25, Math.sin(a) * d], i * 3); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const motes = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.5, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, map: softTex(0.2) }));
  grp.add(motes);
  grp.userData = { mat, motes };
  return grp;
}
export function animateUpdraft(grp, dt, t) {
  const { mat, motes } = grp.userData;
  mat.uniforms.uT.value = t;
  grp.rotation.y += dt * 0.5;
  const a = motes.geometry.attributes.position;
  for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * (14 + (i % 7)); if (y > 45) y -= 70; a.setY(i, y); const x = a.getX(i), z = a.getZ(i), c = Math.cos(dt * 1.4), s = Math.sin(dt * 1.4); a.setX(i, x * c - z * s); a.setZ(i, x * s + z * c); }
  a.needsUpdate = true;
}

// ---------------------------------------------------------------- speed lines (streaks rushing past when you boost)
export function speedLines() {
  const n = 90, pos = new Float32Array(n * 6), r = mulberry32(11);
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, fog: false }));
  lines.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lines.frustumCulled = false; lines.renderOrder = 5;
  lines.userData.items = Array.from({ length: n }, () => ({ a: r() * Math.PI * 2, d: 3.5 + r() * 9, z: -r() * 70, len: 3 + r() * 6 }));
  return lines;
}
/** Lay the streaks out round the camera's line of travel; k 0..1 is how hard you're boosting. */
export function updateSpeedLines(lines, cam, dt, speed, k) {
  lines.material.opacity = k * 0.55;
  lines.visible = k > 0.02;
  if (!lines.visible) return;
  const pos = lines.geometry.attributes.position, fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  cam.getWorldDirection(fwd); right.crossVectors(fwd, cam.up).normalize(); up.crossVectors(right, fwd).normalize();
  lines.userData.items.forEach((it, i) => {
    it.z += speed * dt * 1.6; if (it.z > 2) { it.z -= 72; }
    const o = cam.position.clone().addScaledVector(right, Math.cos(it.a) * it.d).addScaledVector(up, Math.sin(it.a) * it.d * 0.7);
    const a = o.clone().addScaledVector(fwd, -it.z), b = a.clone().addScaledVector(fwd, -it.len * (0.5 + k));
    pos.setXYZ(i * 2, a.x, a.y, a.z); pos.setXYZ(i * 2 + 1, b.x, b.y, b.z);
  });
  pos.needsUpdate = true;
}

// ---------------------------------------------------------------- feathers (a bird strike)
export class Puffs {
  constructor(scene) {
    this.n = 120; this.items = [];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.n * 3), 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#f4f0e8', size: 0.45, transparent: true, depthWrite: false, map: softTex(0.3) }));
    this.pts.frustumCulled = false; scene.add(this.pts);
  }
  burst(p, n = 40, color = '#f4f0e8') {
    this.pts.material.color.set(color);
    for (let i = 0; i < n; i++) this.items.push({ p: p.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.3) * 10, (Math.random() - 0.5) * 14), life: 1.2 + Math.random() });
    if (this.items.length > this.n) this.items.splice(0, this.items.length - this.n);
  }
  update(dt) {
    const a = this.pts.geometry.attributes.position;
    this.items = this.items.filter((it) => (it.life -= dt) > 0);
    for (let i = 0; i < this.n; i++) {
      const it = this.items[i];
      if (!it) { a.setXYZ(i, 0, -9999, 0); continue; }
      it.v.multiplyScalar(1 - dt * 1.5); it.v.y -= dt * 2; it.p.addScaledVector(it.v, dt);
      a.setXYZ(i, it.p.x, it.p.y, it.p.z);
    }
    a.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- a flock of gulls crossing the course (a hazard)
export function gullFlock(n = 7) {
  const grp = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: '#f2f2ee' }), wing = new THREE.MeshLambertMaterial({ color: '#c8ccd2' }), tip = new THREE.MeshLambertMaterial({ color: '#2a2a2a' });
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group();
    const bd = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 3, 8), body); bd.rotation.x = Math.PI / 2; b.add(bd);
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); const wm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.3), wing); wm.position.x = s * 0.4; w.add(wm);
      const wt = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.22), tip); wt.position.x = s * 0.9; w.add(wt);
      b.add(w); b.userData[s < 0 ? 'wl' : 'wr'] = w;
    }
    b.position.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 9); b.userData.ph = Math.random() * 6;
    grp.add(b);
  }
  return grp;
}
export function flap(grp, t, speed = 9) { for (const b of grp.children) { const f = Math.sin(t * speed + b.userData.ph) * 0.6; b.userData.wl.rotation.z = f; b.userData.wr.rotation.z = -f; } }
