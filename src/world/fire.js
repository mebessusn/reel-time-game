// Campfire flames: three crossed flame cards (a pixel-stepped noise shader, hot core to orange tips,
// additive), a bed of glowing coals that pulse, a warm ground glow, and soft smoke wisps that rise and
// drift. Sparks come from fx.ember. Everything flickers on the same rhythm as the fire light.
import * as THREE from 'three';

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
`;

function flameMaterial(seed, scale) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uScale: { value: scale }, uK: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSeed, uScale, uK; varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 q = floor(vUv * vec2(20.0, 30.0)) / vec2(20.0, 30.0);   // pixel steps like the rest of the world
        float x = (q.x - 0.5) * 2.0, y = q.y;
        float n = fbm(vec2(q.x * 3.2 + uSeed, q.y * 2.4 - uTime * 2.6 * uScale));
        float n2 = vnoise(vec2(q.x * 9.0 + uSeed * 3.0, q.y * 6.0 - uTime * 4.0));
        float width = (1.0 - y) * (0.75 + 0.35 * n) - y * 0.15;          // wide at the base, tongues at the top
        float sway = sin(uTime * 3.1 + uSeed + y * 4.0) * 0.12 * y;
        float body = smoothstep(width, width - 0.35, abs(x + sway));
        float flame = body * smoothstep(1.0, 0.25, y + (n2 - 0.5) * 0.35) * uK;
        if (flame < 0.08) discard;
        vec3 deep = vec3(0.86, 0.22, 0.06), mid = vec3(1.0, 0.55, 0.12), core = vec3(1.0, 0.93, 0.55);
        vec3 col = mix(deep, mid, smoothstep(0.1, 0.5, flame));
        col = mix(col, core, smoothstep(0.62, 0.95, flame) * (1.0 - y));
        gl_FragColor = vec4(col, clamp(flame * 1.25, 0.0, 1.0));
      }`,
  });
}

let smokeTex = null;
function smokeTexture() {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(200,200,200,0.55)'); grd.addColorStop(1, 'rgba(200,200,200,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  smokeTex = new THREE.CanvasTexture(c);
  smokeTex.magFilter = THREE.NearestFilter;
  return smokeTex;
}

export function buildFire(pos) {
  const g = new THREE.Group();
  g.name = 'fire';
  g.position.copy(pos);
  const mats = [];
  // flame cards: a big outer fire and a smaller inner one, crossed so it reads from every side
  for (const [h, w, n, sc] of [[1.25, 0.95, 3, 1], [0.8, 0.55, 2, 1.4]]) {
    for (let i = 0; i < n; i++) {
      const m = flameMaterial(i * 1.7 + h * 3, sc);
      const card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      card.position.y = h / 2 - 0.02;
      card.rotation.y = (i / n) * Math.PI;
      card.renderOrder = 5;
      g.add(card); mats.push(m);
    }
  }
  // coals
  const coalMat = new THREE.MeshBasicMaterial({ color: '#ff7a2a' });
  const coals = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39, r = 0.08 + (i % 3) * 0.08;
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.09), coalMat);
    c.position.set(Math.cos(a) * r, -0.2, Math.sin(a) * r); c.rotation.y = a;
    coals.add(c);
  }
  g.add(coals);
  // warm ground glow
  const glowC = document.createElement('canvas'); glowC.width = glowC.height = 64;
  const gx = glowC.getContext('2d'); const grd = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,170,90,0.75)'); grd.addColorStop(0.5, 'rgba(255,130,60,0.25)'); grd.addColorStop(1, 'rgba(255,120,60,0)');
  gx.fillStyle = grd; gx.fillRect(0, 0, 64, 64);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.24; glow.renderOrder = 2;
  g.add(glow);
  // smoke wisps
  const puffs = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), color: '#8a8a88', transparent: true, depthWrite: false, opacity: 0 }));
    s.userData.t = i / 7;
    g.add(s); puffs.push(s);
  }
  g.userData.update = (t, dt, night = 0, wind = 0.3) => {
    const flick = 0.9 + Math.sin(t * 11.3) * 0.05 + Math.sin(t * 6.7) * 0.05;
    for (const m of mats) { m.uniforms.uTime.value = t; m.uniforms.uK.value = flick; }
    coalMat.color.setHSL(0.05, 1, 0.45 + 0.1 * Math.sin(t * 2.3) + 0.05 * Math.sin(t * 7.1));
    glow.material.opacity = (0.45 + night * 0.55) * flick;
    for (const s of puffs) {
      s.userData.t = (s.userData.t + dt * 0.18) % 1;
      const k = s.userData.t;
      s.position.set(Math.sin(k * 6 + s.id) * 0.15 + k * wind * 1.6, 1.0 + k * 3.2, Math.cos(k * 5 + s.id) * 0.15);
      s.scale.setScalar(0.4 + k * 1.6);
      s.material.opacity = Math.sin(k * Math.PI) * (0.22 - night * 0.08);
    }
  };
  return g;
}
