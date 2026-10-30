// The cannonball contest, off the diving tower at the end of Palm Key's jetty. Three jumps each: hold the mouse (or F)
// on the board to bounce, let go to jump, and press Space in the air to tuck. Tuck just after the top of your jump for
// the biggest splash (too early loses height; too late and it's a belly-flop of a splash). Three judges (Kai, Marlowe
// and a very serious gull) hold up cards out of 10; your best jump counts.
// The jumper's client flies them (it holds the player while they're on the tower or in the air) and shares the result
// in its state (bg.cb), so the others see the splash and the cards.
import * as THREE from 'three';
import { cannonScore, aiCannon, GRAV, clamp } from './common.js';

const JUMPS = 3, WATER_Y = 0.85;
export const JUDGES = ['Kai', 'Marlowe', 'the gull'];
export const CANNON = {
  id: 'cannon', name: 'Cannonball Contest', icon: 'star', max: 4, limit: 200,
  want: (n) => Math.max(3, n),
  blurb: 'Off the diving tower: bounce, jump, tuck at the top. Biggest splash wins.',
  how: 'Hold the mouse (or F) to bounce, let go to jump, Space to tuck in the air.',
  make: (ctx) => new Contest(ctx),
};

class Contest {
  constructor(ctx) {
    this.ctx = ctx;
    this.T = ctx.bg.tower;
    this.n = 0; this.best = 0; this.cards = null; this.k = 0; this.last = null;
    this.phase = 'stand'; // stand | air | swim | done
    this.charge = null; this.v = new THREE.Vector3(); this.tuck = null; this.idle = 0;
    this.seen = {};
    this.ai = {};
    ctx.ps.forEach((p, i) => { if (p[0].startsWith('ai')) this.ai[p[0]] = { i, done: 0, best: 0, fly: null }; });
  }
  top(i = this.ctx.index) { const T = this.T, sx = Math.cos(T.yaw), sz = -Math.sin(T.yaw), o = [0, 0.2, -0.2, 0.1][i % 4]; return { x: T.x + sx * o + T.ux * 0.7, z: T.z + sz * o + T.uz * 0.7, y: T.top, yaw: T.yaw }; }
  /** Where an islander waits their turn: along the back rail. */
  queue(i) { const T = this.T, sx = Math.cos(T.yaw), sz = -Math.sin(T.yaw), o = [-0.65, 0.65, 0][i % 3]; return { x: T.x + sx * o - T.ux * 0.55, z: T.z + sz * o - T.uz * 0.55, y: T.top }; }
  spawn(i) { return this.top(i); }
  get holding() { return this.phase === 'stand' || this.phase === 'air'; }

  ctl(dt) {
    const ctx = this.ctx, g = ctx.game, pl = g.player;
    if (ctx.time() < 0 && this.phase === 'stand') { const s = this.top(); pl.pos.set(s.x, s.y, s.z); pl.yaw = s.yaw; return true; }
    if (this.phase === 'stand') {
      const s = this.top();
      pl.pos.set(s.x, s.y, s.z); pl.baseY = s.y; pl.air = 0; pl.vy = 0; pl.target = null; pl.yaw = s.yaw; pl.moving = false;
      this.idle += dt;
      if (this.idle > 25 && !this.charge) this.launch(0.3); // (don't keep everyone waiting)
      return true;
    }
    if (this.phase === 'air') {
      this.v.y -= GRAV * dt;
      pl.pos.addScaledVector(this.v, dt);
      pl.moving = false;
      if (this.v.y < 0 && this.apexT == null) { this.apexT = performance.now(); this.apexY = pl.pos.y; }
      const surf = this.ctx.ow.dive.surfaceAt(pl.pos.x, pl.pos.z);
      if (pl.pos.y <= surf) this.splash();
      return true;
    }
    return false;
  }
  launch(power) {
    const ctx = this.ctx, g = ctx.game, T = this.T;
    if (this.phase !== 'stand' || ctx.time() < 0 || this.n >= JUMPS) return;
    const p = clamp(power, 0, 1);
    this.v.set(T.ux * (2.2 + p * 1.2), 3 + p * 4, T.uz * (2.2 + p * 1.2));
    this.phase = 'air'; this.tuck = null; this.apexT = null; this.launchT = performance.now(); this.charge = null; this.idle = 0;
    g.audio.sfx('swish');
  }
  splash() {
    const ctx = this.ctx, g = ctx.game, pl = g.player;
    const fall = this.apexT ? (performance.now() - this.apexT) / 1000 : 0.3;
    const tuckRel = this.tuck == null ? null : (this.tuck - (this.apexT ?? this.tuck)) / 1000;
    const r = cannonScore((this.apexY ?? pl.pos.y) - WATER_Y, tuckRel, fall, ctx.seed, ctx.index * 10 + this.n);
    this.n++; this.k++;
    this.best = Math.max(this.best, r.total);
    this.cards = r.cards;
    this.last = [this.k, +pl.pos.x.toFixed(1), +pl.pos.z.toFixed(1), r.splash, ...r.cards];
    const pos = new THREE.Vector3(pl.pos.x, WATER_Y, pl.pos.z);
    g.fx.splash(pos, 0.6 + r.splash * 0.35);
    if (r.splash > 6) setTimeout(() => g.fx.splash(pos, 0.5 + r.splash * 0.2), 160);
    g.engine.water.ripple?.(pos.x, pos.z, 1 + r.splash * 0.3);
    g.audio.sfx('splashRemote');
    ctx.bg.hud?.flash(`${r.cards.join(' · ')}  =  ${r.total}`);
    g.chat.system(`Cannonball ${this.n}: ${JUDGES.map((j, i) => `${j} ${r.cards[i]}`).join(', ')}. ${r.total} out of 30${tuckRel == null ? ' (no tuck: a pencil dive!)' : ''}.`, 'info');
    g.ext.bump('cannonballs');
    this.phase = 'swim';
    ctx.ow.dive.enter(pl.pos.x, pl.pos.z);
    this.backAt = performance.now() + 3000;
  }

  update(dt, t) {
    const ctx = this.ctx, g = ctx.game, rt = ctx.time(), now = performance.now();
    if (rt < 0) { ctx.say(null, CANNON.how); return; }
    // back up the tower for the next one (or onto the jetty when you're done)
    if (this.phase === 'swim' && now > this.backAt) {
      if (this.n < JUMPS) { const s = this.top(); ctx.bg.place(s.x, s.z, s.yaw, s.y); this.phase = 'stand'; }
      else { const f = this.T.foot; ctx.bg.place(f.x, f.z, this.T.yaw + Math.PI, null); this.phase = 'done'; }
    }
    // the others' splashes
    for (const p of ctx.ps) {
      const id = p[0];
      if (id === ctx.me || id.startsWith('ai')) continue;
      const L = ctx.state(id)?.cb?.[2];
      if (Array.isArray(L) && L[0] > (this.seen[id] || 0)) {
        this.seen[id] = L[0];
        g.fx.splash(new THREE.Vector3(L[1], WATER_Y, L[2]), 0.6 + L[3] * 0.35);
        g.audio.sfx('splashRemote');
        g.chat.system(`${p[1]}: ${JUDGES.map((j, i) => `${j} ${L[4 + i]}`).join(', ')}.`, 'info');
      }
    }
    // the islanders' jumps, on a shared schedule
    for (const [id, A] of Object.entries(this.ai)) {
      const n = ctx.bg.npcs[+id.slice(2) - 1];
      const at = 4 + A.done * 9 + A.i * 2.6;
      if (!A.fly && A.done < JUMPS && rt > at) { const s = this.top(A.i); A.fly = { t0: now, x: s.x, z: s.z, y: s.y, r: aiCannon(ctx.seed, A.i, A.done) }; }
      if (n) n.actor.root.visible = true;
      if (A.fly) {
        const s = (now - A.fly.t0) / 1000, vy = 5.5, vf = 3;
        const y = A.fly.y + vy * s - 0.5 * GRAV * s * s;
        const x = A.fly.x + this.T.ux * vf * s, z = A.fly.z + this.T.uz * vf * s;
        if (n) n.actor.update(dt, t, { x, y: Math.max(WATER_Y - 0.6, y), z, yaw: this.T.yaw, mode: 'shore', pose: s > vy / GRAV ? 'tuck' : 'cheer', moving: false, rod: 'back' });
        if (y <= WATER_Y) {
          const r = A.fly.r;
          g.fx.splash(new THREE.Vector3(x, WATER_Y, z), 0.6 + r.splash * 0.35);
          g.audio.sfx('splashRemote');
          A.best = Math.max(A.best, r.total); A.done++; A.fly = null;
          g.chat.system(`${ctx.ps.find((p) => p[0] === id)[1]}: ${JUDGES.map((j, i) => `${j} ${r.cards[i]}`).join(', ')}.`, 'info');
        }
      } else if (n) { const s = this.queue(A.i); n.actor.update(dt, t, { x: s.x, y: s.y, z: s.z, yaw: this.T.yaw, mode: 'shore', pose: 'idle', moving: false, rod: 'back' }); }
    }
    // the strip
    const bar = this.charge ? '▮'.repeat(Math.round(this.power() * 10)).padEnd(10, '▯') : '';
    const big = `Jump ${Math.min(JUMPS, this.n + (this.phase === 'done' ? 0 : 1))} of ${JUMPS} · best ${this.best}/30`;
    const small = this.phase === 'stand' ? (this.charge ? `Bounce ${bar}` : 'Hold to bounce, let go to jump.') : this.phase === 'air' ? (this.tuck ? 'Tucked!' : 'Space to tuck: just after the top!') : this.phase === 'done' ? 'All done! Watch the others.' : `The judges: ${(this.cards || []).join(' · ')}`;
    ctx.say(big, small);
    const allDone = ctx.ps.every((p) => (p[0] === ctx.me ? this.phase === 'done' : this.ai[p[0]] ? this.ai[p[0]].done >= JUMPS : ctx.isAI(p[0]) || (ctx.state(p[0])?.cb?.[0] ?? 0) >= JUMPS));
    if (allDone && !this.doneAt) this.doneAt = Date.now();
    if (this.doneAt && (ctx.host || ctx.hostGone() || Date.now() - this.doneAt > 10000)) ctx.finish(this.scores());
  }
  power() { if (!this.charge) return 0; const k = ((performance.now() - this.charge) / 1400) % 1; return k < 0.5 ? k * 2 : 2 - k * 2; }
  primary(down) {
    if (this.phase === 'swim' || this.phase === 'done') return true;
    if (this.phase === 'air') { if (down) this.jump(); return true; }
    if (this.phase !== 'stand' || this.ctx.time() < 0) return true;
    if (down) { this.charge = performance.now(); return true; }
    if (this.charge) this.launch(this.power());
    return true;
  }
  jump() {
    if (this.phase === 'swim' || this.phase === 'done') return false; // (Space swims up as usual)
    if (this.phase === 'stand') { if (!this.charge) this.launch(0.55); return true; }
    if (this.phase === 'air' && this.tuck == null) { this.tuck = performance.now(); this.ctx.game.audio.sfx('click'); }
    return true;
  }
  pose() { return this.phase === 'air' ? (this.tuck ? 'tuck' : 'cheer') : this.charge ? 'charge' : null; }
  scores() {
    const ctx = this.ctx;
    return ctx.ps.map((p) => ({ id: p[0], s: p[0] === ctx.me ? this.best : this.ai[p[0]] ? this.ai[p[0]].best : (ctx.state(p[0])?.cb?.[1] || 0) }));
  }
  label(id, s) { return `${s} / 30`; }
  state() { return { cb: [this.n >= JUMPS && this.phase === 'done' ? JUMPS : this.n, this.best, this.last] }; }
  end() {
    if (this.holding) { const f = this.T.foot; this.ctx.bg.place(f.x, f.z, this.T.yaw + Math.PI, null); }
    this.phase = 'done';
  }
}
