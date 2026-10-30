// Frostmere: the races.
//   - The Frostmere Sled Derby: June's timed run round the sled trail (geo.js SLED_TRAIL) on a sled you drive,
//     through flagged gates. Beat June's 48 s for the Top Dog achievement; your best goes on the shared board.
//   - The Long Glide: a skate race down the frozen river (geo.js RIVER) through lantern gates, against Kit and Bo.
// Both: a 3-2-1 countdown, a timer, gates in order (miss one and you have to go back), a finish banner.
import * as THREE from 'three';
import { instanced, mergedMesh } from './instancing.js';
import { signBoard } from './plane.js';
import { toWorld, SLED_TRAIL, RIVER, ICE_Y } from './geo.js';
import { Actor } from '../game/actor.js';
import { LOOKS } from './villagers.js';
import { northSfx } from './sounds.js';
import { h } from '../ui/dom.js';
import { addCircle } from '../world/colliders.js';

export const JUNE_TIME = 48;
const GATE_R = 9;

/** Gates along a polyline (local u, v), every `step` metres: { x, z, yaw }. */
function gatesAlong(pts, step, skipStart = 0) {
  const out = [], P = pts.map(([u, v]) => toWorld(u, v));
  let acc = -skipStart;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    for (let s = 0; s < L; s += 1) { acc += 1; if (acc >= step) { acc = 0; out.push({ x: a.x + (b.x - a.x) * s / L, z: a.z + (b.z - a.z) * s / L, yaw }); } }
  }
  const e = P[P.length - 1], f = P[P.length - 2];
  out.push({ x: e.x, z: e.z, yaw: Math.atan2(e.x - f.x, e.z - f.z), finish: true });
  return out;
}

export class Races {
  constructor(north) {
    this.north = north; this.game = north.game;
    this.race = null;
    this.courses = {
      derby: { pts: SLED_TRAIL, gates: gatesAlong(SLED_TRAIL, 60, 30), w: 7, name: 'Frostmere Sled Derby' },
      glide: { pts: RIVER.slice(1, 8), gates: gatesAlong(RIVER.slice(1, 8), 35, 15), w: 5.5, name: 'The Long Glide' },
    };
    const hud = h('div.race-hud.hidden', h('div.race-name'), h('div.race-time'), h('div.race-gates'), h('div.race-next'));
    this.hud = hud; this.game.ui.root.append(hud);
  }
  /** The gate posts (flags for the derby, lanterns for the glide) and the start and finish banners. */
  build(group) {
    for (const [k, C] of Object.entries(this.courses)) {
      const posts = [];
      for (const G of C.gates) for (const s of [-1, 1]) {
        const x = G.x + Math.cos(G.yaw) * C.w * s, z = G.z - Math.sin(G.yaw) * C.w * s;
        posts.push({ x, y: this.north.groundAt(x, z) ?? ICE_Y, z, ry: G.yaw }); addCircle(x, z, 0.22);
      }
      instanced(group, 'hw_lamppost', posts);
      // a banner over the start and the finish
      const s0 = toWorld(C.pts[0][0], C.pts[0][1]), s1 = toWorld(C.pts[1][0], C.pts[1][1]), yaw = Math.atan2(s1.x - s0.x, s1.z - s0.z);
      const st = { x: s0.x + Math.sin(yaw) * 6, z: s0.z + Math.cos(yaw) * 6 };
      C.start = { x: st.x, z: st.z, yaw };
      for (const [p, text] of [[st, k === 'derby' ? 'SLED DERBY  START / FINISH' : 'THE LONG GLIDE  START'], ...(k === 'glide' ? [[C.gates[C.gates.length - 1], 'FINISH']] : [])]) {
        const gy = this.north.groundAt(p.x, p.z) ?? ICE_Y;
        const b = signBoard(text, C.w * 2 - 0.6, 0.7, { bg: '#2f5f9a', fg: '#f4e8c8', edge: '#c9a24a' });
        b.position.set(p.x, gy + 3.2, p.z); b.rotation.y = yaw + Math.PI; group.add(b);
        const back = b.clone(); back.rotation.y = yaw; back.position.x += Math.sin(yaw) * 0.02; group.add(back);
        for (const s of [-1, 1]) { const m = mergedMesh('hw_lamppost'); m.position.set(p.x + Math.cos(yaw) * C.w * s, gy, p.z - Math.sin(yaw) * C.w * s); m.scale.y = 1.25; group.add(m); addCircle(m.position.x, m.position.z, 0.22); }
      }
    }
  }

  /** The guide: a pillar of light on the next gate (and a pennant on top), and an arrow over your head pointing at it. */
  makeGuide(scene) {
    if (this.guide) return this.guide;
    const beacon = new THREE.Group(); beacon.name = 'race-beacon';
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 26, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    pillar.position.y = 13; beacon.add(pillar);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.22, 10, 36), new THREE.MeshBasicMaterial({ color: '#fff2a8', fog: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.4; beacon.add(ring);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6, 8), new THREE.MeshLambertMaterial({ color: '#3a2a1c' }));
    pole.position.y = 3; beacon.add(pole);
    const flagShape = new THREE.Shape(); flagShape.moveTo(0, 0); flagShape.lineTo(1.9, -0.55); flagShape.lineTo(0, -1.1); flagShape.closePath();
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), new THREE.MeshLambertMaterial({ color: '#e8402a', side: THREE.DoubleSide, emissive: '#601008' }));
    flag.position.y = 6; beacon.add(flag);
    beacon.visible = false; scene.add(beacon);
    const arrow = new THREE.Group(); arrow.name = 'race-arrow';
    const am = new THREE.MeshBasicMaterial({ color: '#ffd84a', fog: false, depthTest: false, transparent: true, opacity: 0.95 });
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 16), am); head.rotation.x = Math.PI / 2; head.position.z = 0.55; arrow.add(head);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 10), am); shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.25; arrow.add(shaft);
    arrow.renderOrder = 10; arrow.traverse((o) => { o.renderOrder = 10; }); arrow.visible = false; scene.add(arrow);
    this.guide = { beacon, arrow, flag, pillar };
    return this.guide;
  }
  updateGuide(R, t) {
    const G = this.makeGuide(this.game.engine.scene), gate = R && !R.done ? R.C.gates[R.gate] : null;
    G.beacon.visible = G.arrow.visible = !!gate;
    if (!gate) return;
    const p = this.game.player.pos, gy = this.north.groundAt(gate.x, gate.z) ?? ICE_Y;
    G.beacon.position.set(gate.x, gy, gate.z);
    G.flag.rotation.y = Math.sin(t * 3) * 0.25; G.pillar.material.opacity = 0.24 + Math.sin(t * 4) * 0.08;
    G.flag.material.color.set(gate.finish ? '#2fb84a' : '#e8402a');
    const yaw = Math.atan2(gate.x - p.x, gate.z - p.z), d = Math.hypot(gate.x - p.x, gate.z - p.z);
    G.arrow.position.set(p.x, p.y + (this.north.sleds.riding ? 3.0 : 2.7) + Math.sin(t * 4) * 0.08, p.z);
    G.arrow.rotation.set(0, yaw, 0);
    this.hud.querySelector('.race-next').textContent = gate.finish ? `Finish: ${d.toFixed(0)} m` : `Next gate: ${d.toFixed(0)} m`;
  }

  // ---------------------------------------------------------------- starting
  startDerby() {
    const C = this.courses.derby, S = this.north.sleds;
    S.start('derby', { route: C.pts, at: { x: C.start.x - Math.sin(C.start.yaw) * 10, z: C.start.z - Math.cos(C.start.yaw) * 10, yaw: C.start.yaw } });
    S.riding.hold = 3;
    this.begin('derby');
  }
  startGlide() {
    const g = this.game, C = this.courses.glide, K = this.north.skate;
    if (!K.on) { if (!K.owned) K.rented = true; K.set(true); }
    const st = C.start;
    g.player.pos.set(st.x - Math.sin(st.yaw) * 4, ICE_Y, st.z - Math.cos(st.yaw) * 4); g.player.baseY = ICE_Y; g.player.yaw = st.yaw; g.player.skateV?.set(0, 0, 0);
    g.engine.cam.yaw = st.yaw + Math.PI;
    // Kit and Bo line up beside you
    this.kids = [['kit', 10.6], ['bo', 9.6]].map(([who, v], i) => {
      const a = new Actor(g.engine.scene); a.lite = true; a.setLook(LOOKS[who], { rod: 'rod_bamboo', lure: 'lure_classic', boat: 'boat_oak' });
      return { a, v, d: -3, side: i ? 2.2 : -2.2, name: who === 'kit' ? 'Kit' : 'Bo', done: 0 };
    });
    this.begin('glide');
  }
  begin(kind) {
    const g = this.game, C = this.courses[kind];
    this.race = { kind, C, t: -3, gate: 0, done: false, beep: 3 };
    this.hud.classList.remove('hidden');
    this.hud.querySelector('.race-name').textContent = C.name;
    g.juice?.pop('3', { size: 60, ms: 800 }); northSfx(g.audio, 'tick');
  }
  abort() {
    if (!this.race) return;
    this.cleanup();
    this.game.ui.toast('Race abandoned.', { ms: 2000 });
  }
  cleanup() {
    this.race = null; this.hud.classList.add('hidden');
    if (this.guide) this.guide.beacon.visible = this.guide.arrow.visible = false;
    for (const k of this.kids || []) { k.a.root.parent?.remove(k.a.root); k.a.dispose?.(); }
    this.kids = null;
  }

  // ---------------------------------------------------------------- each frame
  update(dt, t) {
    const R = this.race; if (!R) return;
    const g = this.game, p = g.player.pos;
    R.t += dt;
    // the countdown
    if (R.t < 0) { const n = Math.ceil(-R.t); if (n < R.beep) { R.beep = n; g.juice?.pop(String(n), { size: 60, ms: 800 }); northSfx(g.audio, 'tick'); } if (R.kind === 'glide') g.player.skateV?.set(0, 0, 0); }
    else if (R.beep > 0) { R.beep = 0; g.juice?.pop('GO!', { color: '#7aff9a', size: 64, ms: 900 }); g.audio.sfx('bell'); }
    // left the course (stepped off the sled, took the skates off, flew home)
    if ((R.kind === 'derby' && !this.north.sleds.riding) || (R.kind === 'glide' && !this.north.skate.on) || !this.north.here) { this.abort(); return; }
    const G = R.C.gates[R.gate];
    // far off the course (pulled away some other way): call it off rather than leave the clock running
    if (G && Math.hypot(p.x - G.x, p.z - G.z) > 150) { this.abort(); return; }
    if (R.t >= 0 && G && Math.hypot(p.x - G.x, p.z - G.z) < GATE_R + (R.kind === 'derby' ? 2 : 0)) {
      R.gate++;
      northSfx(g.audio, 'flag', { vol: 0.5 });
      if (G.finish) this.finish();
    }
    this.updateGuide(R, t);
    this.hud.querySelector('.race-time').textContent = `${Math.max(0, R.t).toFixed(1)} s`;
    this.hud.querySelector('.race-gates').textContent = R.done ? '' : `Gate ${Math.min(R.gate + 1, R.C.gates.length)} / ${R.C.gates.length}`;
    // Kit and Bo skate the river's line
    for (const k of this.kids || []) {
      if (R.t > 0 && !k.done) k.d += k.v * dt * (0.92 + Math.sin(R.t * 0.7 + k.side) * 0.08);
      const at = this.alongGlide(Math.max(0, k.d));
      if (at.end && !k.done) { k.done = R.t; }
      const x = at.x + Math.cos(at.yaw) * k.side, z = at.z - Math.sin(at.yaw) * k.side;
      k.a.update(dt, t, { x, y: ICE_Y, z, yaw: at.yaw, mode: 'shore', pose: 'idle', moving: R.t > 0 && !k.done, rod: 'back', skate: R.t > 0 && !k.done ? 2 : 1 });
    }
  }
  /** A point d metres down the Long Glide. */
  alongGlide(d) {
    const P = this.courses.glide.pts.map(([u, v]) => toWorld(u, v));
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
      if (d <= L) return { x: a.x + (b.x - a.x) * d / L, z: a.z + (b.z - a.z) * d / L, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
      d -= L;
    }
    const a = P[P.length - 2], b = P[P.length - 1];
    return { x: b.x, z: b.z, yaw: Math.atan2(b.x - a.x, b.z - a.z), end: true };
  }
  async finish() {
    const R = this.race, g = this.game, N = this.north, time = R.t;
    R.done = true;
    g.juice?.pop('FINISH!', { color: '#ffd84a', size: 56, ms: 1600 });
    g.audio.sfx('achievement');
    let msg = `${R.C.name}: ${time.toFixed(1)} s.`;
    if (R.kind === 'derby') {
      msg += time < JUNE_TIME ? ' You beat June\'s time! Top dog!' : ` June's time is ${JUNE_TIME.toFixed(1)} s. So close!`;
      N.onEvent('derby', { time, won: time < JUNE_TIME });
    } else {
      const beat = (this.kids || []).filter((k) => !k.done || k.done > time).map((k) => k.name);
      msg += beat.length === 2 ? ' You beat Kit AND Bo!' : beat.length ? ` You beat ${beat[0]}!` : ' Kit and Bo got there first!';
      N.onEvent('glide', { time, won: beat.length === 2 });
    }
    const best = await N.boards.post(R.kind, time);
    if (best) msg += ' (A new personal best!)';
    g.chat.system(msg, 'info', { popup: true });
    setTimeout(() => this.cleanup(), 2500);
  }
}
