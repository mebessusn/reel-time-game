// Frostmere: "Above the Clouds", the flight north (and home) in Skye's Snow Goose. While the far world loads you fly
// the plane yourself over a sea of cloud: through golden ring gates, up the sparkling updrafts, round the storm
// clouds, and alongside a skein of geese. A score, up to three stars, your best flight, and a Skip button.
//
// It's an overlay scene (engine.overlay): the lake keeps running underneath while this one is drawn instead.
import * as THREE from 'three';
import { SnowGoose } from './plane.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { mulberry32 } from '../core/rng.js';
import { puffMaterial, cloudClusters, makeWisps, layoutWrapped, cirrus, horizonBanks, updraftMesh, animateUpdraft, speedLines, updateSpeedLines, Puffs, gullFlock, flap } from './flightfx.js';

const SPEED = 44, BOOST = 20, RING_R = 7.5, GATES = 14;
// v1.16.2: the edges of the sky (soft walls round the course; you can dive down into the sea of cloud) and the tricks
const SIDE_SOFT = 230, SIDE_HARD = 300, FLOOR = -36, CEIL = 200, LOOP_R = 24, LOOP_T = 2.6, ROLL_T = 0.9, TRICK_CAP = 400;

function skyMaterial(top, mid, bottom) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(top) }, uMid: { value: new THREE.Color(mid) }, uBot: { value: new THREE.Color(bottom) }, uSun: { value: new THREE.Vector3(0.4, 0.3, -0.85).normalize() }, uSunCol: { value: new THREE.Color('#fff2d0') } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 uTop, uMid, uBot, uSun, uSunCol;
      void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(uMid, uTop, pow(y, 0.55)) : mix(uMid, uBot, pow(-y, 0.5));
        float s = max(0.0, dot(normalize(vD), uSun)); c += uSunCol * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(c, 1.0); }`,
  });
}

/** The time of day for the sky: 'day' | 'dusk' | 'night' (from the lake's sky). */
const PALETTE = {
  day: { top: '#3f7fd0', mid: '#a8d0f0', bot: '#dceaf4', fog: '#cfe2f0', sun: '#fff2d0', cloud: '#ffffff', shade: '#c8d8ec', hemi: 1.0 },
  dusk: { top: '#2a3478', mid: '#f0a072', bot: '#f6cfb0', fog: '#e8b898', sun: '#ffb070', cloud: '#ffe6d6', shade: '#c098b0', hemi: 0.8 },
  night: { top: '#03060f', mid: '#13203c', bot: '#202c44', fog: '#1a2438', sun: '#9fb4ff', cloud: '#5a6a88', shade: '#2c3650', hemi: 0.45 },
};

export class FlightGame {
  /** opts: { phase, towards: 'north'|'home', minTime, ready: () => bool, onDone(result) } */
  constructor(game, opts) {
    this.game = game; this.opts = opts;
    const P = this.pal = PALETTE[opts.phase] || PALETTE.day;
    const sc = this.scene = new THREE.Scene();
    sc.fog = new THREE.Fog(P.fog, 120, 900);
    this.camera = new THREE.PerspectiveCamera(60, game.engine.width / game.engine.height, 0.5, 2400);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), skyMaterial(P.top, P.mid, P.bot));
    sky.material.uniforms.uSunCol.value.set(P.sun);
    this.sky = sky; sc.add(sky);
    sc.add(new THREE.HemisphereLight(P.mid, P.shade, P.hemi));
    const sun = this.sunLight = new THREE.DirectionalLight(P.sun, opts.phase === 'night' ? 0.35 : 1.15);
    sun.position.set(300, 400, -600); sc.add(sun); sc.add(sun.target);
    // v1.16.3: high cirrus, cloud banks round the horizon, speed lines, feathers
    this.cirrus = cirrus(P); sc.add(this.cirrus);
    this.banks = horizonBanks(P); sc.add(this.banks);
    this.lines = speedLines(); sc.add(this.lines);
    this.feathers = new Puffs(sc);
    this.fuel = 1; this.boosting = false; this.slowT = 0; this.boostK = 0; this.strikes = 0;
    if (opts.phase === 'night') this.addStars();
    if (opts.phase === 'night') this.addAurora();
    // the plane
    this.plane = new SnowGoose();
    this.plane.group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    sc.add(this.plane.group);
    this.pos = new THREE.Vector3(0, 60, 0); this.yaw = 0; this.pitch = 0; this.bank = 0; this.speed = SPEED; this.boost = 0;
    this.buildClouds();
    this.buildCourse();
    this.t = 0; this.score = 0; this.rings = 0; this.updrafts = 0; this.stormHits = 0; this.geeseDone = false; this.done = false;
    this.mouse = null;
    this.onMove = (e) => { const r = game.engine.renderer.domElement.getBoundingClientRect(); this.mouse = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1, t: performance.now() }; };
    window.addEventListener('pointermove', this.onMove);
    // tricks: Q / E barrel rolls, Space a loop (the keys are free while you fly: nothing else is on screen)
    this.onKey = (e) => {
      if (this.done || (e.repeat && e.type === 'keydown') || e.target?.closest?.('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 'shift') { this.boosting = e.type === 'keydown'; return; }
      if (e.type !== 'keydown') return;
      if (k === 'q' || k === 'e') { e.preventDefault(); e.stopImmediatePropagation(); this.trick('roll', k === 'q' ? -1 : 1); }
      else if (k === ' ' || k === 'r') { e.preventDefault(); e.stopImmediatePropagation(); this.trick('loop'); }
    };
    window.addEventListener('keydown', this.onKey, true); window.addEventListener('keyup', this.onKey, true);
    this.trickPts = 0; this.tricks = 0;
    this.buildHud();
  }

  addStars() {
    const n = 900, p = new Float32Array(n * 3), r = mulberry32(9);
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, y = 0.08 + r() * 0.92, s = Math.sqrt(1 - y * y); p.set([Math.cos(a) * s * 1700, y * 1700, Math.sin(a) * s * 1700], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    this.scene.add(this.stars);
  }
  addAurora() {
    const geo = new THREE.PlaneGeometry(2400, 380, 120, 1);
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec2 vU; uniform float uT; void main(){ vU = uv; vec3 p = position; p.z += sin(p.x * 0.004 + uT * 0.2) * 160.0 + sin(p.x * 0.011 - uT * 0.35) * 60.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'varying vec2 vU; uniform float uT; void main(){ float band = sin(vU.x * 60.0 + uT * 0.8) * 0.5 + 0.5; band = mix(band, 1.0, 0.45); float fadeY = smoothstep(0.0, 0.25, vU.y) * (1.0 - smoothstep(0.55, 1.0, vU.y)); vec3 c = mix(vec3(0.15, 1.0, 0.55), vec3(0.6, 0.3, 1.0), smoothstep(0.45, 1.0, vU.y)); gl_FragColor = vec4(c * band * fadeY * 0.55, 1.0); }' });
    this.aurora = new THREE.Mesh(geo, mat); this.aurora.position.set(0, 520, -1100); this.aurora.rotation.x = -0.15;
    this.scene.add(this.aurora);
  }

  // ---------------------------------------------------------------- the cloud sea (recycled round the plane)
  buildClouds() {
    const P = this.pal;
    this.TILE = 1300;
    this.cloudData = cloudClusters(this.TILE);
    const geo = new THREE.IcosahedronGeometry(1, 4);
    this.cloudMat = puffMaterial(P, new THREE.Vector3(0.4, 0.55, -0.7));
    this.clouds = new THREE.InstancedMesh(geo, this.cloudMat, this.cloudData.length);
    this.clouds.frustumCulled = false;
    this.scene.add(this.clouds);
    this.wisps = makeWisps(this.scene, P, this.cloudData, this.TILE);
    this.layoutClouds();
  }
  layoutClouds() {
    layoutWrapped(this.clouds, this.cloudData, this.pos, this.TILE);
    layoutWrapped(this.wisps.im, this.wisps.items, this.pos, this.TILE, () => 1);
  }

  // ---------------------------------------------------------------- the course: gates, updrafts, storms, geese
  buildCourse() {
    const r = mulberry32((Date.now() / 60000) | 0);
    this.gates = []; this.drafts = []; this.storms = []; this.gulls = [];
    let x = 0, z = 0, y = 60, dir = 0;
    const ringGeo = new THREE.TorusGeometry(RING_R, 0.55, 10, 40);
    const ringMat = new THREE.MeshLambertMaterial({ color: '#ffd24a', emissive: '#c88a10', emissiveIntensity: 0.9 });
    for (let i = 0; i < GATES; i++) {
      dir += (r() - 0.5) * 0.7; dir = Math.max(-0.9, Math.min(0.9, dir));
      x += Math.sin(dir) * 150; z -= Math.cos(dir) * 150; y = Math.max(28, Math.min(120, y + (r() - 0.5) * 40));
      const m = new THREE.Mesh(ringGeo, ringMat.clone());
      m.position.set(x, y, z); m.rotation.y = -dir; // facing along the course
      // a glow halo inside each ring
      const halo = new THREE.Mesh(new THREE.CircleGeometry(RING_R - 0.4, 32), new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending }));
      m.add(halo);
      this.scene.add(m);
      this.gates.push({ m, x, y, z, dir, passed: false, missed: false });
      // every few gates, an updraft off to one side; a storm cloud in the way now and then
      if (i % 3 === 1) this.addDraft(x + Math.cos(dir) * (r() < 0.5 ? -30 : 30), z + Math.sin(dir) * 30, y);
      if (i % 3 === 2 && i < GATES - 1) { const f = gullFlock(6 + (i % 3)); const side = r() < 0.5 ? -1 : 1; f.position.set(x + Math.sin(dir) * 70 + Math.cos(dir) * side * 40, y + (r() - 0.5) * 8, z - Math.cos(dir) * 70 + Math.sin(dir) * side * 40); f.userData = { vx: -Math.cos(dir) * side * 9, vz: -Math.sin(dir) * side * 9, hitT: 0 }; f.rotation.y = Math.atan2(f.userData.vx, f.userData.vz); this.scene.add(f); this.gulls.push(f); }
      if (i % 4 === 2) this.addStorm(x + Math.sin(dir) * 75 + Math.cos(dir) * (r() - 0.5) * 50, y + (r() - 0.5) * 16, z - Math.cos(dir) * 75);
    }
    this.courseEnd = new THREE.Vector3(x, y, z);
    // the geese: a V of nine birds, flying the course a little ahead of gate 6
    const G = this.gates[Math.min(6, this.gates.length - 1)];
    this.geese = new THREE.Group();
    const bodyM = new THREE.MeshLambertMaterial({ color: '#8a8278' }), wingM = new THREE.MeshLambertMaterial({ color: '#6a6258' }), headM = new THREE.MeshLambertMaterial({ color: '#1e1e1e' }), cheekM = new THREE.MeshLambertMaterial({ color: '#f4f0e8' });
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 3, 8), bodyM); body.rotation.x = Math.PI / 2; b.add(body);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.7, 6), headM); neck.position.set(0, 0.05, 0.75); neck.rotation.x = Math.PI / 2.4; b.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), headM); head.position.set(0, 0.2, 1.1); b.add(head);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), cheekM); cheek.position.set(0, 0.17, 1.08); cheek.scale.set(1.5, 0.8, 0.8); b.add(cheek);
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.5), wingM); w.position.set(s * 0.8, 0.05, 0); b.add(w); b.userData[s < 0 ? 'wl' : 'wr'] = w; }
      const k = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
      b.position.set(side * k * 2.2, -k * 0.4, -k * 2.4); b.userData.ph = i * 0.7;
      this.geese.add(b);
    }
    this.geese.position.set(G.x, G.y + 6, G.z); this.geese.rotation.y = Math.PI - G.dir;
    this.geeseGate = G;
    this.scene.add(this.geese);
  }
  addDraft(x, z, y) {
    const grp = updraftMesh(); grp.position.set(x, y, z); this.scene.add(grp);
    this.drafts.push({ grp, x, y, z, used: false });
  }
  addStorm(x, y, z) {
    const grp = new THREE.Group(), r = mulberry32(z | 0);
    const mat = new THREE.MeshLambertMaterial({ color: '#4a4f5c', emissive: '#14161c' });
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat); const s = 6 + r() * 7; m.scale.set(s, s * 0.7, s); m.position.set((r() - 0.5) * 22, (r() - 0.5) * 10, (r() - 0.5) * 22); grp.add(m); }
    const flash = new THREE.PointLight('#cfe0ff', 0, 140, 1.4); grp.add(flash);
    grp.position.set(x, y, z); this.scene.add(grp);
    this.storms.push({ grp, flash, x, y, z, r: 17, hitT: 0, ft: 2 + r() * 4 });
  }

  // ---------------------------------------------------------------- the HUD
  buildHud() {
    const g = this.game;
    this.el = h('div.flight-hud', { role: 'region', 'aria-label': 'Flight' },
      h('div.fl-top', h('span.fl-rings', ''), h('span.fl-score', '')),
      h('div.fl-bar', h('i')),
      h('div.fl-tip', `${this.opts.towards === 'home' ? 'Homeward bound! Fly through the golden rings.' : 'Fly through the golden rings! A/D or the mouse to turn, W/S to climb and dive.'} Shift: boost. Q / E: barrel roll. Space: loop the loop.`),
      h('div.fl-tricks', h('button.btn.ghost.small', { on: { click: () => this.trick('roll', -1) } }, 'Roll'), h('button.btn.ghost.small', { on: { click: () => this.trick('loop') } }, 'Loop'),
        h('button.btn.gold.small.fl-boost', { on: { pointerdown: () => { this.boosting = true; }, pointerup: () => { this.boosting = false; }, pointerleave: () => { this.boosting = false; } } }, 'Boost')),
      h('div.fl-fuel', h('span', 'BOOST'), h('i', h('b'))),
      h('div.fl-blur'),
      h('button.btn.ghost.small.fl-skip', { on: { click: () => this.skip() } }, icon('play'), 'Skip'));
    g.ui.root.append(this.el);
    g.ui.root.classList.add('flying');
    this.refreshHud();
  }
  refreshHud() {
    if (!this.el) return;
    this.el.querySelector('.fl-rings').textContent = `Rings ${this.rings}/${GATES}`;
    this.el.querySelector('.fl-score').textContent = `${this.score}`;
    const prog = Math.min(1, this.passedIdx() / GATES);
    this.el.querySelector('.fl-bar i').style.width = `${Math.round(prog * 100)}%`;
  }
  passedIdx() { let k = 0; for (const gt of this.gates) if (gt.passed || gt.missed) k++; return k; }
  pop(text, color = '#fff4c8') { this.game.juice?.pop(text, { color, size: 30, ms: 900 }); }

  skip() { if (this.done) return; this.skipped = true; }

  /** Into the birds: you slow right down for a couple of seconds, feathers everywhere (nobody's hurt: they scatter). */
  birdStrike(p) {
    this.slowT = 2.5; this.strikes++; this.score = Math.max(0, this.score - 25); this.boost = 0;
    this.feathers.burst(p.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 3, 0.5, -Math.cos(this.yaw) * 3)), 45);
    this.pop('BIRD STRIKE! Slowed down, -25', '#ffd0c0'); this.game.audio.sfx?.('thunk') || this.game.audio.sfx?.('bump'); this.game.juice?.hit({ shake: 0.6 });
  }
  /** Start a trick: 'roll' (dir -1 left, 1 right) or 'loop'. One at a time; loops need some room under you. */
  trick(kind, dir = 1) {
    if (this.done || this.tr || this.t < 1) return;
    if (kind === 'loop' && this.pos.y > CEIL - LOOP_R * 2 - 4) { this.pop('Too high for a loop!', '#c8d0ff'); return; }
    this.tr = { kind, dir, t: 0, dur: kind === 'loop' ? LOOP_T : ROLL_T, at: this.pos.clone(), yaw: this.yaw, pitch: this.pitch, bank: this.bank };
    this.game.audio.sfx('whoosh');
  }
  endTrick() {
    const T = this.tr; this.tr = null;
    const pts = T.kind === 'loop' ? 60 : 25, room = Math.max(0, Math.min(pts, TRICK_CAP - this.trickPts));
    this.tricks++; this.trickPts += room; this.score += room;
    this.pop(`${T.kind === 'loop' ? 'LOOP THE LOOP!' : 'BARREL ROLL!'}${room ? ` +${room}` : ''}`, '#ffd0f0');
    if (T.kind === 'loop') this.pitch = 0;
  }
  /** How far you are, sideways, from the course (the line through the gates), and which way it is. */
  courseNearest() {
    let best = null;
    const pts = [{ x: 0, z: 0 }, ...this.gates, { x: this.courseEnd.x + Math.sin(this.gates[this.gates.length - 1].dir) * 2000, z: this.courseEnd.z - Math.cos(this.gates[this.gates.length - 1].dir) * 2000 }];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((this.pos.x - a.x) * ex + (this.pos.z - a.z) * ez) / L2));
      const x = a.x + ex * t, z = a.z + ez * t, d = Math.hypot(this.pos.x - x, this.pos.z - z);
      if (!best || d < best.d) best = { d, x, z };
    }
    return best;
  }

  // ---------------------------------------------------------------- per frame
  update(dt, t) {
    if (this.done) return;
    const g = this.game, pl = g.player, P = this.plane;
    this.t += dt;
    this.camera.aspect = g.engine.width / g.engine.height; this.camera.updateProjectionMatrix();
    // controls: keys first, else the mouse (if it moved in the last few seconds)
    let steer = (pl.held('right') ? 1 : 0) - (pl.held('left') ? 1 : 0);
    let climb = (pl.held('up') ? 1 : 0) - (pl.held('down') ? 1 : 0);
    if (!steer && !climb && this.mouse && performance.now() - this.mouse.t < 4000) { steer = Math.max(-1, Math.min(1, this.mouse.x * 1.6)); climb = Math.max(-1, Math.min(1, -this.mouse.y * 1.6)); }
    if (pl.stick) { steer = pl.stick.x; climb = -pl.stick.y; }
    // autopilot when you let go: gently toward the next gate
    const next = this.gates.find((gt) => !gt.passed && !gt.missed);
    if (!steer && !climb && next && this.t > 2) {
      const want = Math.atan2(next.x - this.pos.x, -(next.z - this.pos.z));
      let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      steer = Math.max(-0.6, Math.min(0.6, d * 1.5));
      climb = Math.max(-0.5, Math.min(0.5, (next.y - this.pos.y) * 0.05));
    }
    // the edges: soft walls either side of the course turn you back toward it, a hard one stops you leaving
    const near = this.courseNearest();
    if (near.d > SIDE_SOFT && !this.tr) {
      const want = Math.atan2(near.x - this.pos.x, -(near.z - this.pos.z));
      let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      steer = Math.max(-1, Math.min(1, d * 2));
      if (!this.edgeWarned) { this.edgeWarned = true; this.pop('Turning back to the course', '#c8e4ff'); }
    } else if (near.d < SIDE_SOFT - 40) this.edgeWarned = false;
    if (this.tr) { steer = 0; climb = 0; }
    this.bank += (steer - this.bank) * Math.min(1, dt * 2.6);
    this.pitch += (climb - this.pitch) * Math.min(1, dt * 2.4);
    this.yaw += this.bank * dt * 0.95;
    this.boost = Math.max(0, this.boost - dt * 8);
    // the boost: hold Shift (or the button) while there's fuel; updrafts fill it up, and it recharges slowly
    const on = this.boosting && this.fuel > 0.02 && !this.tr;
    this.fuel = Math.max(0, Math.min(1, this.fuel + (on ? -0.32 : 0.09) * dt));
    this.boostK += ((on ? 1 : 0) - this.boostK) * Math.min(1, dt * 3);
    this.slowT = Math.max(0, this.slowT - dt);
    this.speed = (SPEED + this.boost + this.boostK * 30) * (this.slowT > 0 ? 0.5 + 0.5 * (1 - this.slowT / 2.5) : 1);
    let roll = 0, loopA = 0;
    if (this.tr) {
      const T = this.tr; T.t += dt;
      const k = Math.min(1, T.t / T.dur), e = k * k * (3 - 2 * k);
      if (T.kind === 'roll') {
        roll = e * Math.PI * 2 * T.dir;
        this.pos.x += Math.sin(this.yaw) * this.speed * dt; this.pos.z -= Math.cos(this.yaw) * this.speed * dt;
        this.pos.x += Math.cos(this.yaw) * Math.sin(k * Math.PI) * T.dir * 6 * dt; this.pos.z += Math.sin(this.yaw) * Math.sin(k * Math.PI) * T.dir * 6 * dt; // (a little sideways hop as you roll)
      } else {
        // round a vertical circle in the line of flight, drifting on a little so you come out ahead of where you went in
        loopA = e * Math.PI * 2;
        const fwd = LOOP_R * Math.sin(loopA) + this.speed * 0.35 * T.t, up = LOOP_R * (1 - Math.cos(loopA));
        this.pos.set(T.at.x + Math.sin(T.yaw) * fwd, T.at.y + up, T.at.z - Math.cos(T.yaw) * fwd);
      }
      if (k >= 1) this.endTrick();
    } else {
      this.pos.x += Math.sin(this.yaw) * this.speed * dt;
      this.pos.z -= Math.cos(this.yaw) * this.speed * dt;
      this.pos.y += this.pitch * 24 * dt;
    }
    this.pos.y = Math.max(FLOOR, Math.min(CEIL, this.pos.y));
    if (near.d > SIDE_HARD) { const f = SIDE_HARD / near.d; this.pos.x = near.x + (this.pos.x - near.x) * f; this.pos.z = near.z + (this.pos.z - near.z) * f; }
    // the plane: bank and pitch, the surfaces move with the stick
    P.group.position.copy(this.pos);
    P.group.rotation.order = 'YXZ';
    P.group.rotation.set(-this.pitch * 0.32 + Math.sin(this.t * 1.7) * 0.01 - loopA, Math.PI - this.yaw, -this.bank * 0.65 - roll + (this.stormT > 0 ? Math.sin(this.t * 40) * 0.08 : 0));
    P.animate(dt, { throttle: 0.85 + this.boost / BOOST * 0.15, roll: steer, pitch: climb, yaw: steer * 0.4 });
    // the chase camera
    const back = new THREE.Vector3(-Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const want = this.pos.clone().addScaledVector(back, 19).add(new THREE.Vector3(0, 5.5 - this.pitch * 2, 0));
    if (!this.camInit) { this.camera.position.copy(want); this.camInit = true; }
    this.camera.position.lerp(want, Math.min(1, dt * 3.5));
    if (this.stormT > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0));
    if (this.tr?.kind === 'loop') this.camera.lookAt(this.pos.x, this.pos.y + 1, this.pos.z); // (watch it go round)
    else this.camera.lookAt(this.pos.x + Math.sin(this.yaw) * 20, this.pos.y + 1.5, this.pos.z - Math.cos(this.yaw) * 20);
    // inside a cloud (down in the sea of cloud, or in a towering cumulus) everything goes soft and white
    let inCloud = this.pos.y < 6 ? Math.min(1, (6 - this.pos.y) / 5) : 0;
    if (!inCloud) for (const c of this.cloudData) if (c.tower) { const T2 = this.TILE; let dx = c.x - this.pos.x, dz = c.z - this.pos.z; dx = ((dx + T2 / 2) % T2 + T2) % T2 - T2 / 2; dz = ((dz + T2 / 2) % T2 + T2) % T2 - T2 / 2; if (Math.hypot(dx, c.y - this.pos.y, dz) < c.s * 1.05) { inCloud = 1; break; } }
    this.cloudK = (this.cloudK || 0) + (inCloud - (this.cloudK || 0)) * Math.min(1, dt * 3);
    this.scene.fog.near = 120 - this.cloudK * 118; this.scene.fog.far = 900 - this.cloudK * 820;
    // the boost: a wider view, blur at the edges, streaks rushing past
    this.camera.fov = 60 + this.boostK * 18 + Math.min(1, this.boost / BOOST) * 6; this.camera.updateProjectionMatrix();
    if (this.el) { this.el.querySelector('.fl-blur').style.opacity = (this.boostK * 0.9).toFixed(2); this.el.querySelector('.fl-fuel b').style.width = `${Math.round(this.fuel * 100)}%`; this.el.querySelector('.fl-fuel').classList.toggle('on', this.boostK > 0.5); }
    updateSpeedLines(this.lines, this.camera, dt, this.speed, Math.max(this.boostK, Math.min(1, this.boost / BOOST) * 0.6));
    if (this.boostK > 0.3 && Math.random() < dt * 4) this.game.audio.sfx?.('whoosh', { vol: 0.25 });
    this.cirrus.position.x = this.pos.x; this.cirrus.position.z = this.pos.z; this.cirrus.material.uniforms.uT.value = this.t; this.cirrus.material.uniforms.uOff.value.set(this.pos.x / 3600, this.pos.z / 3600);
    this.banks.position.x = this.camera.position.x; this.banks.position.z = this.camera.position.z;
    this.cloudMat.uniforms.uT.value = this.t;
    for (const m of [this.cloudMat, this.wisps.im.material]) { m.uniforms.uFogNear.value = this.scene.fog.near; m.uniforms.uFogFar.value = this.scene.fog.far; }
    this.feathers.update(dt);
    this.sky.position.copy(this.camera.position);
    if (this.stars) this.stars.position.copy(this.camera.position);
    if (this.aurora) { this.aurora.material.uniforms.uT.value = this.t; this.aurora.position.x = this.pos.x; this.aurora.position.z = this.pos.z - 1100; }
    this.sunLight.position.set(this.pos.x + 300, 400, this.pos.z - 600); this.sunLight.target.position.copy(this.pos);
    this.cloudT = (this.cloudT || 0) - dt;
    if (this.cloudT <= 0) { this.cloudT = 0.2; this.layoutClouds(); }
    // gates
    for (const gt of this.gates) {
      if (gt.passed || gt.missed) continue;
      // in the gate's own frame: along = how far past its plane, off = distance from its centre
      const dx = this.pos.x - gt.x, dz = this.pos.z - gt.z, dy = this.pos.y - gt.y;
      const along = -(Math.sin(gt.dir) * dx - Math.cos(gt.dir) * dz);
      if (along < 0) {
        const off = Math.hypot(Math.cos(gt.dir) * dx + Math.sin(gt.dir) * dz, dy);
        if (off < RING_R + 1.5) {
          gt.passed = true; this.rings++;
          const perfect = off < 3;
          this.score += 100 + (perfect ? 50 : 0);
          this.pop(perfect ? 'PERFECT! +150' : '+100', perfect ? '#ffe070' : '#fff4c8');
          g.audio.sfx(perfect ? 'superland' : 'coin');
          gt.m.material.emissive.set('#ffffff'); gt.fade = 1;
        } else if (along < -10) { gt.missed = true; gt.m.material.color.set('#8a7a5a'); gt.m.material.emissive.set('#000000'); }
      }
    }
    for (const gt of this.gates) if (gt.fade) { gt.fade = Math.max(0, gt.fade - dt * 1.5); gt.m.scale.setScalar(1 + (1 - gt.fade) * 0.6); gt.m.material.opacity = gt.fade; gt.m.material.transparent = true; if (!gt.fade) gt.m.visible = false; }
    // updrafts
    for (const d of this.drafts) {
      if (Math.hypot(d.x - this.pos.x, d.z - this.pos.z) < 500) animateUpdraft(d.grp, dt, this.t);
      const inside = Math.hypot(this.pos.x - d.x, this.pos.z - d.z) < 9 && this.pos.y > d.y - 30 && this.pos.y < d.y + 48;
      if (inside) { this.pos.y += dt * 16; this.fuel = Math.min(1, this.fuel + dt * 0.8); } // (the wind lifts you, and tops up the boost)
      if (!d.used && inside) {
        d.used = true; this.updrafts++; this.boost = BOOST; this.score += 50;
        this.pop('UPDRAFT! +50', '#bff0ff'); g.audio.sfx('whoosh');
      }
    }
    // gulls crossing the course: fly into a flock and you lose speed (and a few feathers fly)
    for (const f of this.gulls) {
      f.position.x += f.userData.vx * dt; f.position.z += f.userData.vz * dt; flap(f, this.t, 10);
      f.userData.hitT = Math.max(0, f.userData.hitT - dt);
      if (!f.userData.hitT && f.position.distanceTo(this.pos) < 12) {
        let hit = false; for (const b of f.children) { const w = b.getWorldPosition(new THREE.Vector3()); if (w.distanceTo(this.pos) < 5) { hit = true; break; } }
        if (hit) { f.userData.hitT = 3; this.birdStrike(this.pos); }
      }
    }
    // storm clouds: lightning now and then; flying through one shakes you about
    this.stormT = Math.max(0, (this.stormT || 0) - dt);
    for (const s of this.storms) {
      s.ft -= dt;
      if (s.ft <= 0) { s.ft = 1.5 + Math.random() * 4; s.flashT = 0.18; }
      s.flashT = Math.max(0, (s.flashT || 0) - dt); s.flash.intensity = s.flashT > 0 ? 6 : 0;
      if (Math.hypot(this.pos.x - s.x, this.pos.y - s.y, this.pos.z - s.z) < s.r && s.hitT <= 0) {
        s.hitT = 3; this.stormHits++; this.stormT = 1.2; this.score = Math.max(0, this.score - 50);
        this.pop('BUMPY! -50', '#c8d0ff'); g.audio.sfx('thunder'); g.juice?.hit({ shake: 0.5 });
      }
      s.hitT -= dt;
    }
    // the geese: they flap along the course; fly in close and they let you join the V
    if (this.geese) {
      const G = this.geeseGate;
      for (const b of this.geese.children) { const f = Math.sin(this.t * 7 + b.userData.ph) * 0.5; b.userData.wl.rotation.z = f; b.userData.wr.rotation.z = -f; }
      for (const b of this.geese.children) { const w = b.getWorldPosition(new THREE.Vector3()); if (w.distanceTo(this.pos) < 3.5 && !(this.geeseHitT > 0)) { this.geeseHitT = 3; this.birdStrike(this.pos); } }
      this.geeseHitT = Math.max(0, (this.geeseHitT || 0) - dt);
      if (!this.geeseDone && this.geese.position.distanceTo(this.pos) < 26 && !(this.geeseHitT > 0)) { this.geeseDone = true; this.score += 75; this.pop('FLYING WITH THE GEESE! +75', '#f4e8c8'); g.audio.sfx('achievement'); }
    }
    this.refreshHud();
    // the end: every gate done (or skipped), the world below is ready, and at least minTime has passed
    const courseDone = this.passedIdx() >= GATES;
    if ((courseDone || this.skipped) && this.opts.ready() && (this.t > (this.opts.minTime || 0) || this.skipped)) this.finish();
    else if ((courseDone || this.skipped) && !this.opts.ready() && !this.waitShown) { this.waitShown = true; this.el.querySelector('.fl-tip').textContent = 'Nearly there... the clouds are thinning.'; }
  }

  result() {
    const stars = this.rings >= GATES && this.stormHits === 0 ? 3 : this.rings >= Math.ceil(GATES * 0.8) ? 2 : this.rings >= Math.ceil(GATES * 0.5) ? 1 : 0;
    return { score: this.score, rings: this.rings, gates: GATES, tricks: this.tricks, strikes: this.strikes, updrafts: this.updrafts, storms: this.stormHits, geese: this.geeseDone, stars, skipped: !!this.skipped && this.passedIdx() < GATES };
  }
  finish() {
    if (this.done) return;
    this.done = true;
    this.dispose();
    this.opts.onDone?.(this.result());
  }
  dispose() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('keydown', this.onKey, true); window.removeEventListener('keyup', this.onKey, true);
    this.el?.remove(); this.el = null;
    this.game.ui.root.classList.remove('flying');
    this.scene.traverse((o) => { o.geometry?.dispose?.(); });
  }
}
