// Crab races. Four crabs, four lanes, ten metres of sand. Back a crab in the paddock, then cheer it on: Space (or a
// click) on the beat gives it a push. The crabs' own running comes from the round's seed, so every client sees the same
// race; the pushes come from each backer's network state (bg.ch, a running total), so they agree within a beat or so.
// Crabs love the rain: they run faster when it's wet.
import { h } from '../../ui/dom.js';
import { PAD_BY_ID } from '../geo.js';
import { crabRun, cheerPush, aiCheer, CHEER_BEAT, CRAB_TRACK, clamp } from './common.js';

const PADDOCK = 8; // seconds to pick a crab
export const CRAB_NAMES = ['Red', 'Blue', 'Yellow', 'Purple'];
const MESH = ['bg_crab_red', 'bg_crab_blue', 'bg_crab_yellow', 'bg_crab_purple'];
const PLACE = ['1st', '2nd', '3rd', '4th'];

export const CRABS = {
  id: 'crabs', name: 'Crab Races', icon: 'flag', max: 4, limit: 120,
  want: () => 4,
  blurb: 'Back a crab, then cheer it down the track. Cheer on the beat for the biggest push.',
  how: 'Pick your crab, then press Space (or click) on the beat to cheer.',
  make: (ctx) => new Race(ctx),
};

class Race {
  constructor(ctx) {
    this.ctx = ctx;
    const T = PAD_BY_ID.crabs;
    this.T = T;
    this.pick = clamp(ctx.index, 0, 3);
    this.ch = 0; this.lastCheer = 0; this.cheers = 0;
    this.lane = (i) => T.z + 1.2 - i * 0.8;
    this.crabs = MESH.map((m, i) => { const M = ctx.put(m, T.x - CRAB_TRACK / 2, this.lane(i), 0, T.y); M.scale.setScalar(1.7); return { m: M, d: 0, fin: 0 }; });
    this.finished = [];
    this.picker = h('div.bg-picks', CRAB_NAMES.map((n, i) => h(`button.bg-pick.c${i}`, { on: { click: () => { this.pick = i; this.drawPicker(); ctx.game.audio.sfx('click'); } } }, n)));
    ctx.bg.hud?.el.append(this.picker);
    this.drawPicker();
  }
  spawn(i) { const T = this.T; return { x: T.x - 3 + i * 2, z: T.z + 2.5, yaw: Math.PI, y: T.y, pitch: 0.75, dist: 7 }; }
  drawPicker() { [...this.picker.children].forEach((b, i) => b.classList.toggle('on', i === this.pick)); }
  raceT() { return this.ctx.time() - PADDOCK; }
  /** Who backs crab c: each player's pick (an islander keeps the crab in its own lane). */
  backers(c) {
    const ctx = this.ctx, out = [];
    ctx.ps.forEach((p, i) => {
      const id = p[0];
      const pick = id === ctx.me ? this.pick : ctx.isAI(id) ? i : (ctx.state(id)?.pk ?? i);
      if (pick === c) out.push({ id, i, ai: id !== ctx.me && ctx.isAI(id) });
    });
    return out;
  }
  dist(c, t) {
    const ctx = this.ctx;
    let d = crabRun(ctx.seed, c, t, ctx.rain);
    for (const b of this.backers(c)) d += b.id === ctx.me ? this.ch : b.ai ? aiCheer(ctx.seed, b.i, t) : (ctx.state(b.id)?.ch || 0);
    return d;
  }

  update(dt, t) {
    const ctx = this.ctx, T = this.T, rt = this.raceT();
    if (ctx.time() < 0) return;
    if (rt < 0) {
      ctx.say(`Pick your crab: ${Math.ceil(-rt)}`, `You're backing ${CRAB_NAMES[this.pick]}. Cheer on the beat once they're off!`);
      this.npcs(dt, t, false);
      return;
    }
    if (this.picker.isConnected) { this.picker.remove(); ctx.game.audio.sfx('horn'); }
    // the race
    for (let c = 0; c < 4; c++) {
      const C = this.crabs[c];
      if (!C.fin) {
        C.d = this.dist(c, rt);
        if (C.d >= CRAB_TRACK) { C.fin = rt; C.d = CRAB_TRACK; this.finished.push(c); ctx.game.audio.sfx(this.finished.length === 1 ? 'achievement' : 'bell'); }
      }
      const x = T.x - CRAB_TRACK / 2 + Math.min(CRAB_TRACK, C.d);
      C.m.position.set(x, T.y + Math.abs(Math.sin(t * 14 + c)) * 0.03 * (C.fin ? 0 : 1), this.lane(c));
      C.m.rotation.y = Math.sin(t * 9 + c * 2) * (C.fin ? 0 : 0.12) + (C.fin ? Math.sin(t * 3) * 0.5 : 0);
    }
    this.npcs(dt, t, true);
    const beat = (rt % CHEER_BEAT) / CHEER_BEAT;
    ctx.bg.hud?.el.classList.toggle('beat', beat < 0.18);
    const order = [0, 1, 2, 3].sort((a, b) => (this.crabs[b].fin ? 100 - this.crabs[b].fin : this.crabs[b].d) - (this.crabs[a].fin ? 100 - this.crabs[a].fin : this.crabs[a].d));
    const pos = order.indexOf(this.pick);
    ctx.say(`${CRAB_NAMES[this.pick]} is ${PLACE[pos]} · ${this.crabs[this.pick].d.toFixed(1)} m`, 'Cheer on the beat: Space or click!');
    // done when three have crossed (the last place is then settled too)
    if (this.finished.length >= 3 && !this.doneAt) this.doneAt = Date.now();
    if (this.doneAt && (ctx.host || ctx.hostGone() || Date.now() - this.doneAt > 10000)) ctx.finish(this.scores());
  }
  npcs(dt, t, racing) {
    const ctx = this.ctx, T = this.T;
    ctx.ps.forEach((p, i) => {
      if (!ctx.isAI(p[0]) || p[0] === ctx.me) return;
      const n = ctx.bg.npcs[+p[0].slice(2) - 1];
      if (!n) return;
      n.actor.root.visible = true;
      n.actor.update(dt, t, { x: T.x - 3 + i * 2, y: T.y, z: T.z + 2.7, yaw: Math.PI, mode: 'shore', pose: racing && Math.sin(t * 5 + i) > -0.2 ? 'cheer' : 'idle', moving: false, rod: 'back' });
    });
  }
  /** Places come from the order the crabs crossed (crabs still running come after, by distance). */
  order() { const rest = [0, 1, 2, 3].filter((c) => !this.finished.includes(c)).sort((a, b) => this.crabs[b].d - this.crabs[a].d); return [...this.finished, ...rest]; }
  scores() {
    const ctx = this.ctx, ord = this.order();
    return ctx.ps.map((p, i) => {
      const pick = p[0] === ctx.me ? this.pick : ctx.isAI(p[0]) ? i : (ctx.state(p[0])?.pk ?? i);
      const place = ord.indexOf(pick);
      return { id: p[0], s: 4 - place, txt: `${CRAB_NAMES[pick]}, ${PLACE[place]}` };
    });
  }
  label(id, s) { return `${PLACE[clamp(4 - s, 0, 3)]} crab`; }
  cheer() {
    const ctx = this.ctx, rt = this.raceT(), now = performance.now();
    if (rt < 0 || this.crabs[this.pick].fin) return true;
    if (now - this.lastCheer < 220) return true; // (mashing doesn't help)
    this.lastCheer = now;
    const ph = rt % CHEER_BEAT, off = Math.min(ph, CHEER_BEAT - ph);
    const push = cheerPush(off);
    this.ch += push; this.cheers++;
    ctx.game.audio.sfx(push > 0.15 ? 'bell' : 'click');
    ctx.bg.hud?.flash(push > 0.15 ? 'On the beat!' : push > 0.08 ? 'Nearly!' : 'Off the beat');
    this.poseT = 0.4;
    ctx.game.ext.bump('crabCheers');
    return true;
  }
  jump() { return this.cheer(); }
  primary(down) { if (down) this.cheer(); return true; }
  pose() { return this.raceT() >= 0 ? 'cheer' : null; }
  state() { return { pk: this.pick, ch: +this.ch.toFixed(2) }; }
  end() { this.picker.remove(); this.ctx.bg.hud?.el.classList.remove('beat'); }
}
