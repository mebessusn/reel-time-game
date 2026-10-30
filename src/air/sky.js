// Skye's Air Races: the sky round a circuit. A gradient dome with the sun, the time of day's palette, stars and the
// aurora at night, and rain (and a darker, lower sky) on stormy circuits. The sky circuits also get the cloud sea
// from "Above the Clouds" (src/north/flightfx.js); the land circuits get high cirrus and banks on the horizon.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

export const PALETTES = {
  day: { top: '#3f7fd0', mid: '#a8d0f0', bot: '#dceaf4', fog: '#cfe2f0', sun: '#fff2d0', cloud: '#ffffff', shade: '#c8d8ec', hemi: 1.0, sunI: 1.25 },
  dusk: { top: '#2a3478', mid: '#f0a072', bot: '#f6cfb0', fog: '#e8b898', sun: '#ffc088', cloud: '#ffe6d6', shade: '#c098b0', hemi: 0.95, sunI: 1.2 },
  night: { top: '#03060f', mid: '#13203c', bot: '#202c44', fog: '#1a2438', sun: '#9fb4ff', cloud: '#5a6a88', shade: '#2c3650', hemi: 0.5, sunI: 0.4 },
  storm: { top: '#2a3040', mid: '#6a7284', bot: '#8a92a0', fog: '#7a8290', sun: '#c8d0e0', cloud: '#b8c0cc', shade: '#58606e', hemi: 0.7, sunI: 0.55 },
};

/** The time of day's palette, with a land biome's sky colours laid over the day's. */
export function paletteFor(c, biome) {
  const base = { ...PALETTES[c.weather === 'storm' ? 'storm' : c.phase] || PALETTES.day };
  if (biome?.sky && c.phase === 'day' && c.weather !== 'storm') Object.assign(base, { top: biome.sky.top, mid: biome.sky.mid, fog: biome.sky.fog, bot: biome.sky.fog });
  if (biome?.sky && c.phase === 'dusk') Object.assign(base, { fog: biome.sky.fog });
  return base;
}

export function skyDome(P) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(2600, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(P.top) }, uMid: { value: new THREE.Color(P.mid) }, uBot: { value: new THREE.Color(P.bot) }, uSun: { value: new THREE.Vector3(0.4, 0.3, -0.85).normalize() }, uSunCol: { value: new THREE.Color(P.sun) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 uTop, uMid, uBot, uSun, uSunCol;
      void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(uMid, uTop, pow(y, 0.55)) : mix(uMid, uBot, pow(-y, 0.5));
        float s = max(0.0, dot(normalize(vD), uSun)); c += uSunCol * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  m.renderOrder = -2; m.frustumCulled = false;
  return m;
}

export function stars() {
  const n = 1100, p = new Float32Array(n * 3), r = mulberry32(9);
  for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, y = 0.06 + r() * 0.94, s = Math.sqrt(1 - y * y); p.set([Math.cos(a) * s * 2400, y * 2400, Math.sin(a) * s * 2400], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
  pts.frustumCulled = false; return pts;
}

/** Curtains of the northern lights, two of them, waving slowly (additive, so they glow over the night sky). */
export function aurora() {
  const grp = new THREE.Group(), mats = [];
  for (let k = 0; k < 2; k++) {
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uT: { value: k * 7 } },
      vertexShader: 'varying vec2 vU; uniform float uT; void main(){ vU = uv; vec3 p = position; p.z += sin(p.x * 0.004 + uT * 0.2) * 160.0 + sin(p.x * 0.011 - uT * 0.35) * 60.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'varying vec2 vU; uniform float uT; void main(){ float band = sin(vU.x * 60.0 + uT * 0.8) * 0.5 + 0.5; band = mix(band, 1.0, 0.45); float fadeY = smoothstep(0.0, 0.25, vU.y) * (1.0 - smoothstep(0.55, 1.0, vU.y)); vec3 c = mix(vec3(0.15, 1.0, 0.55), vec3(0.6, 0.3, 1.0), smoothstep(0.45, 1.0, vU.y)); gl_FragColor = vec4(c * band * fadeY * 0.6, 1.0); }' });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3400, 520, 140, 1), mat); m.position.set(k ? 500 : -300, 620 + k * 80, k ? 1300 : -1400); m.rotation.y = k ? 0.4 : 0; m.rotation.x = -0.15;
    m.frustumCulled = false; grp.add(m); mats.push(mat);
  }
  grp.userData.mats = mats;
  return grp;
}

/** Rain: streaks falling round the camera. */
export function rain(n = 1400) {
  const pos = new Float32Array(n * 6), r = mulberry32(3), items = [];
  for (let i = 0; i < n; i++) items.push({ x: (r() - 0.5) * 120, y: r() * 80, z: (r() - 0.5) * 120 });
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#c8d4e4', transparent: true, opacity: 0.45, depthWrite: false }));
  lines.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); lines.frustumCulled = false; lines.userData.items = items;
  return lines;
}
export function updateRain(lines, cam, dt, vel) {
  const pos = lines.geometry.attributes.position, it = lines.userData.items;
  for (let i = 0; i < it.length; i++) {
    const q = it[i]; q.y -= dt * 60; q.x -= (vel?.x || 0) * dt; q.z -= (vel?.z || 0) * dt;
    if (q.y < -40) q.y += 80; if (q.x < -60) q.x += 120; if (q.x > 60) q.x -= 120; if (q.z < -60) q.z += 120; if (q.z > 60) q.z -= 120;
    const x = cam.x + q.x, y = cam.y + q.y, z = cam.z + q.z;
    pos.setXYZ(i * 2, x, y, z); pos.setXYZ(i * 2 + 1, x + (vel?.x || 0) * 0.02, y + 2.2, z + (vel?.z || 0) * 0.02);
  }
  pos.needsUpdate = true;
}
