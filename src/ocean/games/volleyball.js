// Beach volleyball (1v1 or 2v2, islanders make up the numbers). The ball flies in arcs everyone computes the same way;
// a ring on the sand shows where it will come down. Get under it and press Space (or click) as it arrives: the closer
// to the moment, the faster and nastier your return. Miss it and the other side scores. First to 5.
// The wind pushes the ball about, and in the rain it's slippery (the timing window is a little tighter).
//
// Network: the host's state carries vb { arc, sc, void, end } (serves and islanders' hits); each player's state carries
// vh, the last arc they hit. The newest arc (highest n) is the one in the air. When the host calls a point it voids
// any hit at or below vb.void, so a late hit can't come back from the dead.
import * as THREE from 'three';
import { PAD_BY_ID } from '../geo.js';
import { arcAt, clamp } from './common.js';

const HALF_L = 7, HALF_W = 3.5, REACH = 1.7, WIN = 5;
const ring = (() => { const g = new THREE.RingGeometry(0.55, 0.75, 28); g.rotateX(-Math.PI / 2); return g; })();

export const VOLLEY = {
  id: 'volley', name: 'Beach Volleyball', icon: 'sun', max: 4, limit: 360,
  want: (n) => (n <= 2 ? 2 : 4),
  blurb: 'One against one or two against two. Get under the ball and bump it back. First to 5.',
  how: 'Stand in the ring where the ball comes down and press Space (or click) as it arrives.',
  make: (ctx) => new Volley(ctx),
};

class Volley {
  constructor(ctx) {
    this.ctx = ctx;
    const C = PAD_BY_ID.court;
    this.C = C;
    this.team = (i) => i % 2; // even places on the left (x below the net), odd on the right
    this.myTeam = this.team(ctx.index);
    this.vh = null; // my last hit
    this.vb = ctx.host ? { arc: null, sc: [0, 0], void: 0, end: 0 } : null;
    this.tried = 0; // the arc I last swung at
    this.poseT = 0;
    this.ai = {}; // islanders' positions
    ctx.ps.forEach((p, i) => { const s = this.home(i); this.ai[p[0]] = { x: s.x, z: s.z, yaw: s.yaw, bump: 0 }; });
    this.ball = ctx.put('bg_ball', C.x, C.z, 0, C.y + 1);
    this.mark = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }));
    this.mark.renderOrder = 2;
    ctx.bg.root.add(this.mark);
    (ctx.round.meshes ||= []).push(this.mark);
    this.aiTried = new Set(); this.called = new Set(); // (host) arcs already swung at by islanders, and points called
  }
  home(i) {
    const t = this.team(i), slot = Math.floor(i / 2), n = this.ctx.ps.length;
    const sx = t === 0 ? -1 : 1, z = n > 2 ? (slot === 0 ? -1.6 : 1.6) : 0;
    return { x: this.C.x + sx * 3.6, z: this.C.z + z, yaw: t === 0 ? Math.PI / 2 : -Math.PI / 2 };
  }
  spawn(i) { const s = this.home(i); return { ...s, y: this.C.y }; }

  // ---------------------------------------------------------------- the ball in the air
  hostVb() { return this.ctx.host ? this.vb : this.ctx.hostState()?.vb || null; }
  current() {
    const vb = this.hostVb();
    let best = vb?.arc || null;
    const vd = vb?.void || 0;
    for (const p of this.ctx.ps) {
      const s = p[0] === this.ctx.me ? { vh: this.vh } : this.ctx.state(p[0]);
      const a = s?.vh;
      if (a && a.n > vd && (!best || a.n > best.n)) best = a;
    }
    return best;
  }
  arrival(a) { return a.t0 + a.T * 1000; }
  /** A return from (x, z) by the team `t`: aimed away from the other side's players, faster with better timing. */
  makeArc(n, from, t, q, by) {
    const C = this.C, other = 1 - t, sx = other === 0 ? -1 : 1;
    const opp = this.ctx.ps.map((p, i) => ({ p, i })).filter((o) => this.team(o.i) === other).map((o) => this.posOf(o.p[0], o.i));
    let best = null;
    for (let k = 0; k < 5; k++) {
      const c = { x: C.x + sx * (1.2 + Math.random() * (HALF_L - 1.8)), z: C.z + (Math.random() * 2 - 1) * (HALF_W - 0.6) };
      const d = Math.min(...opp.map((o) => Math.hypot(o.x - c.x, o.z - c.z)), 99);
      const score = d * (0.3 + q) + Math.random();
      if (!best || score > best.score) best = { ...c, score };
    }
    const T = 2.05 - q * 0.6, H = 2.8 + (1 - q) * 1.4;
    const w = this.ctx.wind;
    const lo = sx > 0 ? C.x + 0.6 : C.x - HALF_L + 0.6, hi = sx > 0 ? C.x + HALF_L - 0.6 : C.x - 0.6;
    const b = { x: +clamp(best.x + w.x * T * T * 0.3, lo, hi).toFixed(2), y: C.y + 1.0, z: +clamp(best.z + w.z * T * T * 0.3, C.z - HALF_W + 0.3, C.z + HALF_W - 0.3).toFixed(2) };
    return { n, a: { x: +from.x.toFixed(2), y: C.y + 1.1, z: +from.z.toFixed(2) }, b, t0: Date.now(), T: +T.toFixed(2), H: +H.toFixed(2), side: other, by };
  }
  serve(n, t) {
    const C = this.C, sx = t === 0 ? -1 : 1;
    const a = this.makeArc(n, { x: C.x + sx * (HALF_L - 0.3), z: C.z }, t, 0.15, 'serve');
    a.t0 = Date.now() + 300;
    return a;
  }
  posOf(id, i) {
    if (id === this.ctx.me) return this.ctx.game.player.pos;
    if (this.ctx.isAI(id)) return this.ai[id];
    const s = this.ctx.game.net?.peers && [...this.ctx.game.net.peers.values()].find((p) => p.meta?.id === id)?.state;
    return s && s.x != null ? { x: s.x, z: s.z } : this.home(i);
  }

  // ---------------------------------------------------------------- per frame
  update(dt, t) {
    const ctx = this.ctx, now = Date.now(), C = this.C;
    if (ctx.time() < 0) { this.ball.visible = false; this.mark.visible = false; return; }
    const vb = this.hostVb();
    if (vb?.end) { ctx.finish(this.scores()); return; }
    if (ctx.host) this.hostTick(now);
    const a = this.current();
    // the ball and its ring
    if (a) {
      const p = arcAt(a, now);
      this.ball.visible = true;
      this.ball.position.set(p.x, Math.max(C.y + 0.11, p.y), p.z);
      this.ball.rotation.x += dt * 6; this.ball.rotation.z += dt * 4;
      const incoming = p.s < 1;
      this.mark.visible = incoming;
      this.mark.position.set(a.b.x, C.y + 0.03, a.b.z);
      this.mark.material.color.set(a.side === this.myTeam ? '#ffe070' : '#ffffff');
      this.mark.scale.setScalar(1 + (1 - p.s) * 0.6);
    } else { this.ball.visible = false; this.mark.visible = false; }
    // islanders run for the ball
    ctx.ps.forEach((pp, i) => {
      const id = pp[0];
      if (!ctx.isAI(id) || id === ctx.me) return;
      const A = this.ai[id], hm = this.home(i);
      let tx = hm.x, tz = hm.z;
      if (a && a.side === this.team(i) && now > a.t0 + 350 && arcAt(a, now).s < 1.05) {
        const mates = ctx.ps.map((q, j) => ({ q, j })).filter((o) => this.team(o.j) === this.team(i) && ctx.isAI(o.q[0]));
        const closest = mates.sort((m1, m2) => Math.hypot(this.ai[m1.q[0]].x - a.b.x, this.ai[m1.q[0]].z - a.b.z) - Math.hypot(this.ai[m2.q[0]].x - a.b.x, this.ai[m2.q[0]].z - a.b.z))[0];
        if (closest?.q[0] === id) { tx = a.b.x - (this.team(i) === 0 ? 0.4 : -0.4); tz = a.b.z; }
      }
      const dx = tx - A.x, dz = tz - A.z, d = Math.hypot(dx, dz), sp = 4.4 * dt;
      A.moving = d > 0.15;
      if (d > 0.01) { const k = Math.min(1, sp / d); A.x += dx * k; A.z += dz * k; }
      A.yaw = this.team(i) === 0 ? Math.PI / 2 : -Math.PI / 2;
      A.bump = Math.max(0, A.bump - dt);
      const npc = ctx.bg.npcs[+id.slice(2) - 1];
      if (npc) { npc.actor.root.visible = true; npc.actor.update(dt, t, { x: A.x, y: C.y, z: A.z, yaw: A.yaw, mode: 'shore', pose: A.bump > 0 ? 'bump' : A.moving ? 'run' : 'idle', moving: A.moving, running: A.moving, rod: 'back' }); }
    });
    this.poseT = Math.max(0, this.poseT - dt);
    // the scoreboard
    const sc = vb?.sc || [0, 0];
    const names = (tm) => ctx.ps.filter((_, i) => this.team(i) === tm).map((p) => (p[0] === ctx.me ? 'You' : p[1])).join(' & ');
    const mine = sc[this.myTeam], theirs = sc[1 - this.myTeam];
    const coming = a && a.side === this.myTeam && arcAt(a, now).s < 1;
    ctx.say(`${names(this.myTeam)} ${mine} – ${theirs} ${names(1 - this.myTeam)}`, coming ? 'Coming your way: into the ring, Space as it lands!' : `First to ${WIN}. ${ctx.wind.kn > 10 ? `Wind ${ctx.wind.kn} kn: watch the drift.` : ''}`);
  }
  /** The host serves, plays the islanders, and calls points. */
  hostTick(now) {
    const ctx = this.ctx, vb = this.vb;
    if (vb.end) return;
    const a = this.current();
    if (!a) { if (now > ctx.t0 + 1200) { vb.arc = this.serve(1, 1); } return; }
    const arr = this.arrival(a);
    // islanders on the receiving side: a swing just before it lands
    if (!this.aiTried.has(a.n) && now > arr - 80) {
      this.aiTried.add(a.n);
      const recv = ctx.ps.map((p, i) => ({ id: p[0], i })).filter((o) => this.team(o.i) === a.side && ctx.isAI(o.id) && o.id !== ctx.me);
      let best = null;
      for (const o of recv) { const A = this.ai[o.id], d = Math.hypot(A.x - a.b.x, A.z - a.b.z); if (!best || d < best.d) best = { ...o, d }; }
      if (best) {
        const p = clamp(0.9 - best.d * 0.22 - ctx.wind.kn * 0.006 - (ctx.rain ? 0.05 : 0), 0.25, 0.92);
        if (best.d < REACH && Math.random() < p) {
          this.ai[best.id].bump = 0.45;
          vb.arc = this.makeArc(a.n + 1, { x: a.b.x, z: a.b.z }, a.side, 0.25 + Math.random() * 0.5, best.id);
          ctx.game.audio.sfx('plop');
          return;
        }
      }
    }
    // nobody got it: a point to the other side, then their serve
    if (now > arr + 1100 && !this.called.has(a.n)) {
      this.called.add(a.n);
      const t = 1 - a.side;
      vb.sc = [...vb.sc]; vb.sc[t]++;
      vb.void = a.n + 1;
      ctx.game.audio.sfx(t === this.myTeam ? 'coin' : 'miss');
      if (vb.sc[t] >= WIN) { vb.end = Date.now(); return; }
      this.pendingServe = { n: a.n + 2, t, at: now + 1800 };
    }
    if (this.pendingServe && now > this.pendingServe.at) { vb.arc = this.serve(this.pendingServe.n, this.pendingServe.t); this.pendingServe = null; }
  }

  // ---------------------------------------------------------------- input
  swing() {
    const ctx = this.ctx, g = ctx.game, now = Date.now();
    if (ctx.time() < 0) return true;
    const a = this.current();
    this.poseT = 0.45;
    if (!a || a.side !== this.myTeam || this.tried === a.n) { g.audio.sfx('swish'); return true; }
    const arr = this.arrival(a), dt = (now - arr) / 1000, win = ctx.rain ? 0.42 : 0.5;
    const p = g.player.pos, d = Math.hypot(p.x - a.b.x, p.z - a.b.z);
    if (dt < -win * 1.6) { g.audio.sfx('swish'); return true; } // (way too early: not a real swing, try again)
    this.tried = a.n;
    if (dt > -win && dt < win * 0.5 && d < REACH) {
      const q = clamp(1 - Math.abs(dt) / win, 0, 1) * clamp(1.2 - d / REACH * 0.4, 0, 1);
      this.vh = this.makeArc(a.n + 1, { x: p.x, z: p.z }, this.myTeam, q, ctx.me);
      g.audio.sfx('plop');
      ctx.bg.hud?.flash(q > 0.8 ? 'Perfect bump!' : q > 0.5 ? 'Nice!' : 'Just got it!');
      ctx.game.ext.bump('volleyHits');
    } else {
      g.audio.sfx('swish');
      ctx.bg.hud?.flash(d >= REACH ? 'Too far from the ball!' : dt < 0 ? 'Too early!' : 'Too late!');
    }
    return true;
  }
  jump() { return this.swing(); }
  primary(down) { if (down) this.swing(); return true; }
  pose() { return this.poseT > 0 ? 'bump' : null; }
  state() { return { vh: this.vh, ...(this.ctx.host ? { vb: this.vb } : {}) }; }
  scores() { const sc = this.hostVb()?.sc || [0, 0]; return this.ctx.ps.map((p, i) => ({ id: p[0], s: sc[this.team(i)] })); }
  end() {}
}
