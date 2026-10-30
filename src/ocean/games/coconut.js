// Coconut toss. Three buckets down the beach (1, 2 and 3 points, further is worth more), five coconuts each. Aim with
// the camera, hold to wind up (the power swings up and down), let go to throw. The wind pushes coconuts sideways and
// in the rain they're slippery (the power wobbles a little).
// Each throw is worked out on the thrower's client and shared in their state (bg.th, the last throw, and bg.cc, the
// count and score), so everyone sees everyone's coconuts fly.
import * as THREE from 'three';
import { PAD_BY_ID } from '../geo.js';
import { bucketSpots, coconutThrow, flyAt, aiThrows, clamp } from './common.js';

const THROWS = 5;
export const COCONUT = {
  id: 'coconut', name: 'Coconut Toss', icon: 'star', max: 4, limit: 150,
  want: (n) => Math.max(2, n),
  blurb: 'Five coconuts, three buckets. Further buckets score more. Mind the wind!',
  how: 'Aim with the camera, hold the mouse (or F) to wind up, let go to throw.',
  make: (ctx) => new Toss(ctx),
};

class Toss {
  constructor(ctx) {
    this.ctx = ctx;
    const K = PAD_BY_ID.coconut;
    this.K = K;
    this.x0 = K.x - 6;
    this.buckets = bucketSpots(ctx.seed, { x: this.x0, z: K.z }, { x: 1, z: 0 });
    this.buckets.forEach((b) => { b.m = ctx.put('bg_bucket', b.x, b.z, 0, K.y); b.m.scale.setScalar(1 + (b.d - 4) * 0.04); });
    this.n = 0; this.score = 0; this.charge = null; this.last = null; this.k = 0;
    this.flying = []; // coconuts in the air: { m, o, v, w, t0, T, hit, who }
    this.seen = {}; // the last throw I drew for each player
    this.ai = {};
    ctx.ps.forEach((p, i) => { if (p[0].startsWith('ai')) this.ai[p[0]] = { pts: aiThrows(ctx.seed, i), done: 0, s: 0 }; });
    // a faint aiming line on the sand
    const geo = new THREE.PlaneGeometry(0.08, 3.2); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, 1.9);
    this.aim = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }));
    ctx.bg.root.add(this.aim);
    (ctx.round.meshes ||= []).push(this.aim);
  }
  laneZ(i) { return this.K.z + [-0.6, 0.6, -1.8, 1.8][i % 4]; }
  spawn(i) { return { x: this.x0 - 0.4, z: this.laneZ(i), yaw: Math.PI / 2, y: this.K.y }; }
  aimYaw() { return this.ctx.game.engine.cam.yaw - Math.PI; }
  power() { if (!this.charge) return 0; const k = ((performance.now() - this.charge) / 1600) % 1; return k < 0.5 ? k * 2 : 2 - k * 2; }

  primary(down) {
    const ctx = this.ctx, g = ctx.game;
    if (ctx.time() < 0 || this.n >= THROWS) return true;
    if (down) { if (!this.charge && !this.flyingMine()) this.charge = performance.now(); return true; }
    if (!this.charge) return true;
    let pw = this.power();
    this.charge = null;
    if (ctx.rain) pw = clamp(pw + (Math.random() - 0.5) * 0.1, 0, 1);
    const p = g.player.pos, yaw = this.aimYaw();
    g.player.yaw = yaw;
    const th = coconutThrow({ x: p.x, z: p.z }, yaw, pw, ctx.wind, this.K.y, this.buckets);
    this.n++; this.k++;
    this.last = { k: this.k, o: [+th.o.x.toFixed(2), +th.o.y.toFixed(2), +th.o.z.toFixed(2)], v: [+th.v.x.toFixed(2), +th.v.y.toFixed(2), +th.v.z.toFixed(2)], w: [th.wind.x, th.wind.z], T: +th.land.t.toFixed(2), b: th.hit ? th.hit.d : 0 };
    this.launch(th.o, th.v, th.wind, th.land.t, th.hit, ctx.me);
    this.throwT = 0.35;
    g.audio.sfx('swish');
    g.ext.bump('coconuts');
    return true;
  }
  flyingMine() { return this.flying.some((f) => f.who === this.ctx.me); }
  launch(o, v, w, T, hit, who) {
    const m = this.ctx.put('bg_coconut', o.x, o.z, 0, o.y);
    this.flying.push({ m, o, v, w, t0: performance.now(), T, hit, who });
  }

  update(dt, t) {
    const ctx = this.ctx, g = ctx.game, now = performance.now(), rt = ctx.time();
    if (rt < 0) return;
    // other players' throws (from their state)
    for (const p of ctx.ps) {
      const id = p[0];
      if (id === ctx.me || id.startsWith('ai')) continue;
      const th = ctx.state(id)?.th;
      if (th && th.k > (this.seen[id] || 0)) {
        this.seen[id] = th.k;
        const hit = th.b ? this.buckets.find((b) => b.d === th.b) : null;
        this.launch({ x: th.o[0], y: th.o[1], z: th.o[2] }, { x: th.v[0], y: th.v[1], z: th.v[2] }, { x: th.w[0], z: th.w[1] }, th.T, hit, id);
      }
    }
    // the islanders' throws, on a schedule everyone shares
    ctx.ps.forEach((p, i) => {
      const A = this.ai[p[0]];
      if (!A) return;
      const n = ctx.bg.npcs[+p[0].slice(2) - 1];
      while (A.done < THROWS && rt > 2.5 + A.done * 3.4 + i * 0.8) {
        const pts = A.pts[A.done++];
        A.s += pts;
        const b = pts ? this.buckets.find((x) => x.pts === pts) : { x: this.x0 + 3 + Math.random() * 6, z: this.laneZ(i) + (Math.random() - 0.5) * 3 };
        const o = { x: this.x0 - 0.2, y: this.K.y + 1.6, z: this.laneZ(i) };
        const T = 1.1, tgtY = this.K.y + (pts ? 0.44 : 0.08);
        const v = { x: (b.x - o.x) / T, y: (tgtY - o.y + 0.5 * 9.81 * T * T) / T, z: (b.z - o.z) / T };
        this.launch(o, v, { x: 0, z: 0 }, T, pts ? b : null, p[0]);
        if (n) n.throwT = 0.35;
      }
      if (n) {
        n.throwT = Math.max(0, (n.throwT || 0) - dt);
        n.actor.root.visible = true;
        n.actor.update(dt, t, { x: this.x0 - 0.4, y: this.K.y, z: this.laneZ(i), yaw: Math.PI / 2, mode: 'shore', pose: n.throwT > 0 ? 'cast' : 'idle', moving: false, rod: 'back' });
      }
    });
    // coconuts in flight
    for (const f of [...this.flying]) {
      const s = (now - f.t0) / 1000;
      const p = flyAt(f.o, f.v, f.w, Math.min(s, f.T));
      f.m.position.set(p.x, p.y, p.z);
      f.m.rotation.x += dt * 8;
      if (s >= f.T) {
        if (!f.done) {
          f.done = true;
          if (f.hit) { g.audio.sfx('plop'); g.fx.splash?.(f.m.position.clone(), 0.25); if (f.who === ctx.me) { this.score += f.hit.pts; ctx.bg.hud?.flash(`+${f.hit.pts}!`); } }
          else { g.audio.sfx('dirt'); if (f.who === ctx.me) ctx.bg.hud?.flash('Missed!'); }
          f.until = now + (f.hit ? 300 : 2500);
        }
        if (f.hit) f.m.visible = false;
        if (now > f.until) { f.m.removeFromParent(); this.flying.splice(this.flying.indexOf(f), 1); }
      }
    }
    this.throwT = Math.max(0, (this.throwT || 0) - dt);
    if (this.charge) g.player.yaw = this.aimYaw();
    this.aim.visible = this.n < THROWS;
    this.aim.position.set(g.player.pos.x, this.K.y + 0.03, g.player.pos.z); this.aim.rotation.y = this.aimYaw();
    const bar = '▮'.repeat(Math.round(this.power() * 10)).padEnd(10, '▯');
    const w = ctx.wind;
    ctx.say(`${this.score} points · coconut ${Math.min(THROWS, this.n + 1)} of ${THROWS}`, this.n >= THROWS ? 'All thrown! Waiting for the others…' : this.charge ? `Power ${bar}` : `Hold to wind up, let go to throw.${w.kn > 9 ? ` Wind ${w.kn} kn: aim into it.` : ''}`);
    // done when everyone's thrown and the last coconut's down
    const allIn = ctx.ps.every((p) => (p[0] === ctx.me ? this.n >= THROWS : this.ai[p[0]] ? this.ai[p[0]].done >= THROWS : ctx.isAI(p[0]) || (ctx.state(p[0])?.cc?.[0] ?? 0) >= THROWS));
    if (allIn && !this.flying.length && !this.doneAt) this.doneAt = Date.now();
    if (this.doneAt && (ctx.host || ctx.hostGone() || Date.now() - this.doneAt > 10000)) ctx.finish(this.scores());
  }
  scores() {
    const ctx = this.ctx;
    return ctx.ps.map((p) => ({ id: p[0], s: p[0] === ctx.me ? this.score : this.ai[p[0]] ? this.ai[p[0]].s : (ctx.state(p[0])?.cc?.[1] || 0) }));
  }
  pose() { return this.charge ? 'throw' : this.throwT > 0 ? 'cast' : null; }
  state() { return { cc: [this.n, this.score], th: this.last }; }
  end() { this.charge = null; }
}
