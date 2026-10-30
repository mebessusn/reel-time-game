// Frostmere: the northern sky and weather.
//   - Snow instead of rain: flurries (overcast), steady snow (rain) and blizzards (storm: driven sideways, the fog
//     closes in, the wind howls). GPU points: the flakes fall and wrap round the camera in a shader.
//   - The aurora: curtains of green and violet rippling across the northern sky on most clear nights (the same nights
//     for everyone: it's worked out from the date), with the dogs howling when they come out.
//   - Diamond dust: on still, clear, cold mornings the air glitters.
//   - Breath: little puffs of breath from everyone close by.
//   - The ice: a long booming crack now and then on the lake on cold nights.
import * as THREE from 'three';
import { northSfx } from './sounds.js';
import { toLocal, kindAt, isIce, NORTH } from './geo.js';

const SN = 2600;
const snowVS = `
  attribute vec4 seed;
  uniform float uTime, uWind, uFall, uBox, uPx;
  uniform vec3 uCam;
  varying float vA;
  void main() {
    vec3 p = seed.xyz * uBox;
    float t = uTime * (0.6 + seed.w * 0.6);
    p.y = mod(p.y - t * uFall * 3.0, uBox) - uBox * 0.3;
    p.x += sin(t * 0.7 + seed.w * 20.0) * 0.6 + uWind * t * 2.0;
    p.z += cos(t * 0.5 + seed.w * 13.0) * 0.6;
    // wrap round the camera
    vec3 c = uCam;
    p.x = mod(p.x - c.x + uBox * 0.5, uBox) + c.x - uBox * 0.5;
    p.z = mod(p.z - c.z + uBox * 0.5, uBox) + c.z - uBox * 0.5;
    p.y += c.y;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(6.0, max(1.6, (0.9 + seed.w * 1.6) * 60.0 / -mv.z)) * uPx;
    vA = clamp(1.0 - (-mv.z) / (uBox * 0.55), 0.0, 1.0);
  }`;
const snowFS = `
  uniform float uOpacity; uniform vec3 uColor;
  varying float vA;
  void main() { vec2 q = gl_PointCoord - 0.5; float d = dot(q, q); if (d > 0.25) discard; gl_FragColor = vec4(uColor, uOpacity * vA * (1.0 - d * 3.0)); }`;
const auroraVS = `
  varying vec2 vUv; varying vec3 vW;
  void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const auroraFS = `
  uniform float uTime, uOn;
  varying vec2 vUv; varying vec3 vW;
  float h(float x) { return fract(sin(x * 127.1) * 43758.5453); }
  float n(float x) { float i = floor(x), f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
  void main() {
    float x = vUv.x * 9.0;
    float folds = n(x * 1.3 + uTime * 0.12) * 0.6 + n(x * 3.1 - uTime * 0.2) * 0.4;
    float rays = pow(n(vUv.x * 160.0 + uTime * 0.6), 2.0) * 0.6 + 0.4;
    float bottom = smoothstep(0.0, 0.12 + folds * 0.1, vUv.y);
    float top = 1.0 - smoothstep(0.35 + folds * 0.4, 1.0, vUv.y);
    float a = bottom * top * rays * (0.5 + folds * 0.8);
    vec3 green = vec3(0.25, 1.0, 0.55), violet = vec3(0.7, 0.35, 1.0), pink = vec3(1.0, 0.4, 0.7);
    vec3 col = mix(green, violet, smoothstep(0.35, 0.9, vUv.y));
    col = mix(col, pink, smoothstep(0.0, 0.08, 0.1 - vUv.y) * 0.6);
    float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
    gl_FragColor = vec4(col * a * 1.4, a * uOn * edge * 0.8);
  }`;

/** Same answer for everyone: is tonight an aurora night? (two nights in three) */
export function auroraNight(now = Date.now()) {
  const day = Math.floor(now / (24 * 60 * 1000)); // (one game day is 24 real minutes)
  const x = Math.sin(day * 12.9898) * 43758.5453;
  return x - Math.floor(x) < 0.67;
}

export class NorthSky {
  constructor(north) {
    this.north = north; this.game = north.game;
    const scene = this.game.engine.scene;
    // snow
    const geo = new THREE.BufferGeometry(), seed = new Float32Array(SN * 4);
    for (let i = 0; i < SN; i++) { seed[i * 4] = Math.random() - 0.5; seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random() - 0.5; seed[i * 4 + 3] = Math.random(); }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 3), 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    this.snowMat = new THREE.ShaderMaterial({ vertexShader: snowVS, fragmentShader: snowFS, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uWind: { value: 0 }, uFall: { value: 1 }, uBox: { value: 50 }, uPx: { value: 1 }, uCam: { value: new THREE.Vector3() }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#ffffff') } } });
    this.snow = new THREE.Points(geo, this.snowMat); this.snow.frustumCulled = false; this.snow.visible = false; this.snow.name = 'north-snow';
    this.snow.geometry.drawRange.count = SN;
    scene.add(this.snow);
    // diamond dust: a few glittering specks drifting in the sunlight
    this.dustMat = new THREE.ShaderMaterial({ vertexShader: snowVS, fragmentShader: `uniform float uOpacity, uTime; varying float vA; void main() { vec2 q = gl_PointCoord - 0.5; float d = abs(q.x) + abs(q.y); if (d > 0.5) discard; float tw = 0.5 + 0.5 * sin(uTime * 9.0 + gl_FragCoord.x * 0.37 + gl_FragCoord.y * 0.71); gl_FragColor = vec4(1.0, 0.98, 0.9, uOpacity * vA * tw * (1.0 - d * 2.0)); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uWind: { value: 0.05 }, uFall: { value: 0.05 }, uBox: { value: 26 }, uPx: { value: 1 }, uCam: { value: new THREE.Vector3() }, uOpacity: { value: 0 } } });
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', geo.attributes.position); dg.setAttribute('seed', geo.attributes.seed); dg.drawRange.count = 700;
    this.dust = new THREE.Points(dg, this.dustMat); this.dust.frustumCulled = false; this.dust.visible = false; scene.add(this.dust);
    // the aurora: three long curtains far off to the north, following you
    this.auroraMat = new THREE.ShaderMaterial({ vertexShader: auroraVS, fragmentShader: auroraFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: { value: 0 }, uOn: { value: 0 } } });
    this.aurora = new THREE.Group(); this.aurora.name = 'aurora'; this.aurora.visible = false;
    for (const [dx, dz, w, hgt, y, ry] of [[-120, -330, 700, 150, 70, 0.08], [160, -290, 520, 120, 85, -0.18], [-20, -380, 900, 190, 60, 0.02]]) {
      const g = new THREE.PlaneGeometry(w, hgt, 90, 1);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, Math.sin(x / 70) * 40 + Math.sin(x / 23) * 12); } // the curtain folds
      const m = new THREE.Mesh(g, this.auroraMat); m.position.set(dx, y + hgt / 2, dz); m.rotation.y = ry; m.frustumCulled = false; m.renderOrder = -1;
      this.aurora.add(m);
    }
    scene.add(this.aurora);
    this.auroraK = 0; this.auroraOn = false; this.boomT = 40; this.breathT = 0; this.wind = null;
  }
  update(dt, t) {
    const g = this.game, N = this.north, here = N.here && !N.trip, sky = g.engine.sky, wt = sky.state || {}, cam = g.engine.camera.position;
    this.snow.visible = false; this.dust.visible = false; this.aurora.visible = false;
    if (!here) { this.auroraOn = false; this.windSound(0); return; }
    // the valley's rain and fireflies don't come north: snow instead
    if (sky.rain) sky.rain.visible = false;
    if (sky.fireflies) sky.fireflies.visible = false;
    const wx = wt.weather, night = sky.night || 0;
    const amt = wx === 'storm' ? 1 : wx === 'rain' ? 0.65 : wx === 'overcast' ? 0.22 : 0;
    const U = this.snowMat.uniforms;
    U.uTime.value = t; U.uCam.value.copy(cam); U.uPx.value = this.dustMat.uniforms.uPx.value = g.engine.renderer?.getPixelRatio?.() || 1;
    U.uOpacity.value += (amt * 0.95 - U.uOpacity.value) * Math.min(1, dt);
    U.uWind.value = wx === 'storm' ? 2.6 : 0.25; U.uFall.value = wx === 'storm' ? 2.2 : 1;
    this.snow.geometry.drawRange.count = Math.round(SN * Math.max(0.15, amt));
    this.snow.visible = U.uOpacity.value > 0.02;
    // diamond dust: clear, still, cold mornings and days
    const D = this.dustMat.uniforms, dust = wx === 'clear' && (wt.phase === 'dawn' || wt.phase === 'day') ? (wt.phase === 'dawn' ? 1 : 0.5) : 0;
    D.uTime.value = t; D.uCam.value.copy(cam); D.uOpacity.value += (dust * 0.9 - D.uOpacity.value) * Math.min(1, dt * 0.5);
    this.dust.visible = D.uOpacity.value > 0.02;
    // the aurora
    const want = night > 0.55 && wx !== 'storm' && wx !== 'rain' && (auroraNight() || this.force) ? 1 : 0;
    this.auroraK += (want - this.auroraK) * Math.min(1, dt * 0.25);
    this.auroraMat.uniforms.uOn.value = this.auroraK * (wx === 'overcast' ? 0.5 : 1) * (this.boost || 1); // (v1.17.2: a Great Aurora burns brighter)
    this.auroraMat.uniforms.uTime.value = t;
    this.aurora.visible = this.auroraK > 0.02;
    this.aurora.position.set(cam.x, 0, cam.z);
    const on = this.auroraK > 0.5;
    if (on && !this.auroraOn) this.auroraStarts();
    this.auroraOn = on;
    // the lake ice booms on cold nights
    const p = g.player.pos, [u, v] = toLocal(p.x, p.z);
    this.boomT -= dt * (night > 0.5 ? 1.5 : 0.5);
    if (this.boomT <= 0) { this.boomT = 45 + Math.random() * 90; if (isIce(kindAt(u, v)) || Math.hypot(u, v - 60) < 200) northSfx(g.audio, 'boom', { vol: 0.7 }); }
    // breath puffs
    this.breathT -= dt;
    if (this.breathT <= 0) { this.breathT = 0.9; this.breath(); }
    this.windSound(wx === 'storm' ? 1 : wx === 'rain' ? 0.45 : 0.18);
    void NORTH;
  }
  auroraStarts() {
    const g = this.game;
    g.ui.toast('The northern lights are out! Green and violet curtains ripple over the sky.', { title: 'Aurora', icon: 'star', ms: 6000 });
    setTimeout(() => northSfx(g.audio, 'howl'), 1500); setTimeout(() => northSfx(g.audio, 'howl', { vol: 0.7 }), 3200);
    const day = Math.floor(Date.now() / (24 * 60 * 1000));
    if (this.north.d.auroraDay !== day) { g.ext.change((d) => { d.north.auroraDay = day; d.north.auroras = (d.north.auroras || 0) + 1; }); this.north.onEvent('aurora'); }
  }
  /** A little cloud of breath from each head nearby, now and then. */
  breath() {
    const g = this.game, fx = g.fx, me = g.player.pos, heads = [];
    if (g.actor?.root.visible && !this.north.hidden) heads.push(g.actor);
    for (const n of this.north.villagers?.list || []) if (n.actor.root.visible && Math.abs(n.pos.x - me.x) < 18 && Math.abs(n.pos.z - me.z) < 18) heads.push(n.actor);
    for (const r of g.remotes?.list?.values?.() || []) if (r.actor.root.visible && r.pos.distanceTo(me) < 18) heads.push(r.actor);
    const v = this._v || (this._v = new THREE.Vector3());
    for (const a of heads) {
      if (Math.random() < 0.45) continue;
      a.headWorld?.(v); if (!v) continue;
      const yaw = a.root.rotation.y, fx0 = Math.sin(yaw) * 0.22, fz0 = Math.cos(yaw) * 0.22;
      for (let k = 0; k < 3; k++) fx.spawn(v.x + fx0, v.y - 0.05, v.z + fz0, fx0 * 1.5 + (Math.random() - 0.5) * 0.15, 0.12 + Math.random() * 0.1, fz0 * 1.5 + (Math.random() - 0.5) * 0.15, '#f4f8fc', 0.9, 0.05, 0.6);
    }
  }
  /** The wind: filtered noise that rises in a blizzard. */
  windSound(level) {
    const A = this.game.audio, ctx = A?.ctx;
    if (!ctx) return;
    if (!this.wind && level > 0) {
      const src = ctx.createBufferSource(); src.buffer = A.white || A.pink || null; if (!src.buffer) return;
      src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
      const gain = ctx.createGain(); gain.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13; const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(bp.frequency);
      src.connect(bp); bp.connect(gain); gain.connect(A.bus?.ambience || A.bus?.sfx || ctx.destination);
      src.start(); lfo.start();
      this.wind = { src, gain, lfo };
    }
    if (this.wind) this.wind.gain.gain.setTargetAtTime(level * 0.05, ctx.currentTime, 1.2);
  }
}
