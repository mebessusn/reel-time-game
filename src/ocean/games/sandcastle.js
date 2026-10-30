// The sandcastle contest. Two minutes to build on your plot (a 3 x 3 grid): pick a piece, face a square and click
// (or press E) to place it. Mounds, towers and walls stack (three high in dry sand, four when the rain makes it wet);
// moats go in bare sand; flags and shells finish a stack. Then everyone votes for their favourite castle that isn't
// their own, and Kai and the islanders vote too. Most votes wins (a judge's eye for height, variety and symmetry breaks
// ties). Each player's castle travels in their state (bg.cs, packed), and their vote as bg.vt.
import * as THREE from 'three';
import { h } from '../../ui/dom.js';
import { PIECES, PIECE_BY_C, canPlace, castleScore, aiCastle, packCastle, unpackCastle } from './common.js';

const BUILD = 120, VOTE = 25;
const ring = (() => { const g = new THREE.RingGeometry(0.34, 0.46, 4, 1, Math.PI / 4); g.rotateX(-Math.PI / 2); return g; })();

export const CASTLES = {
  id: 'castles', name: 'Sandcastle Contest', icon: 'home', max: 4, limit: BUILD + VOTE + 30,
  want: (n) => Math.max(3, n),
  blurb: 'Two minutes to build the best castle on the beach, then everyone votes.',
  how: 'Pick a piece, face a square on your plot, and click (or press E) to place it.',
  make: (ctx) => new Contest(ctx),
};

class Contest {
  constructor(ctx) {
    this.ctx = ctx;
    this.maxH = ctx.rain ? 4 : 3;
    this.cells = Array.from({ length: 9 }, () => []);
    this.sel = 't';
    this.vote = null;
    this.drawn = {}; // plot index -> { key, meshes }
    this.plots = ctx.bg.plots;
    this.mark = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: '#ffe070', transparent: true, opacity: 0.85, depthWrite: false }));
    ctx.bg.root.add(this.mark);
    (ctx.round.meshes ||= []).push(this.mark);
    this.palette = h('div.bg-picks', PIECES.map((p) => h('button.bg-pick', { 'data-c': p.c, on: { click: () => { this.sel = p.c; this.drawPalette(); ctx.game.audio.sfx('click'); } } }, p.name)),
      h('button.bg-pick.undo', { on: { click: () => this.undo() } }, 'Undo'));
    ctx.bg.hud?.el.append(this.palette);
    this.drawPalette();
    this.voteBox = null;
  }
  spawn(i) { const P = this.plots[i % 4]; return { x: P.x, z: P.z + 2.2 * (i < 2 ? -1 : 1), yaw: i < 2 ? 0 : Math.PI, y: P.y }; }
  drawPalette() { for (const b of this.palette.children) b.classList.toggle('on', b.dataset.c === this.sel); }
  cellPos(P, k) { return { x: P.x + ((k % 3) - 1) * 1.0, z: P.z + (Math.floor(k / 3) - 1) * 1.0 }; }
  /** The square I'm facing on my plot, or -1. */
  facing() {
    const pl = this.ctx.game.player, P = this.plots[this.ctx.index % 4];
    const fx = pl.pos.x + Math.sin(pl.yaw) * 0.9, fz = pl.pos.z + Math.cos(pl.yaw) * 0.9;
    let best = -1, bd = 0.75;
    for (let k = 0; k < 9; k++) { const c = this.cellPos(P, k), d = Math.hypot(c.x - fx, c.z - fz); if (d < bd) { bd = d; best = k; } }
    return best;
  }
  place() {
    const ctx = this.ctx, g = ctx.game, t = ctx.time();
    if (t < 0 || t > BUILD) return true;
    const k = this.facing();
    if (k < 0) { g.ui.toast('Face a square on your plot (the roped-off sand) to build there.', { icon: 'home', ms: 2500 }); return true; }
    const why = canPlace(this.cells[k], this.sel, this.maxH);
    if (why) { g.audio.sfx('miss'); ctx.bg.hud?.flash(why); return true; }
    this.cells[k].push(this.sel);
    g.audio.sfx('dirt');
    this.digT = 0.5;
    g.ext.bump('castlePieces');
    return true;
  }
  undo() { const k = this.facing(); if (k >= 0 && this.cells[k].length) { this.cells[k].pop(); this.ctx.game.audio.sfx('dirt'); } }
  castleOf(id, i) {
    const ctx = this.ctx;
    if (id === ctx.me) return this.cells;
    if (id.startsWith('ai')) return aiCastle(ctx.seed, i, Math.min(BUILD, ctx.time()), BUILD, this.maxH);
    return unpackCastle(ctx.state(id)?.cs);
  }
  draw(i, cells) {
    const P = this.plots[i % 4], key = packCastle(cells), D = this.drawn[i];
    if (D?.key === key) return;
    for (const m of D?.meshes || []) m.removeFromParent();
    const meshes = [];
    cells.forEach((stack, k) => {
      const c = this.cellPos(P, k);
      let y = P.y;
      for (const pc of stack) {
        const piece = PIECE_BY_C[pc];
        const m = this.ctx.put(piece.id, c.x, c.z, (k * 1.3) % 6.28, y);
        if (pc === 'm') m.scale.setScalar(1.1);
        meshes.push(m);
        y += piece.h;
      }
    });
    this.drawn[i] = { key, meshes };
  }

  update(dt, t) {
    const ctx = this.ctx, g = ctx.game, rt = ctx.time();
    if (rt < 0) return;
    // everyone's castles
    ctx.ps.forEach((p, i) => this.draw(i, this.castleOf(p[0], i)));
    // islanders building (or admiring)
    ctx.ps.forEach((p, i) => {
      if (!p[0].startsWith('ai')) return;
      const n = ctx.bg.npcs[+p[0].slice(2) - 1];
      if (!n) return;
      const s = this.spawn(i);
      n.actor.root.visible = true;
      n.actor.update(dt, t, { x: s.x + Math.sin(t * 0.3 + i) * 0.6, y: s.y, z: s.z, yaw: s.yaw, mode: 'shore', pose: rt < BUILD ? 'dig' : 'clap', moving: false, rod: 'back' });
    });
    this.digT = Math.max(0, (this.digT || 0) - dt);
    if (rt < BUILD) {
      const k = this.facing();
      this.mark.visible = k >= 0;
      if (k >= 0) { const P = this.plots[ctx.index % 4], c = this.cellPos(P, k); this.mark.position.set(c.x, P.y + 0.05, c.z); }
      const left = Math.ceil(BUILD - rt);
      ctx.say(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} to build · ${PIECE_BY_C[this.sel].name}`, `${this.maxH > 3 ? 'Wet sand: stacks four high! ' : ''}Face a square and click or press E to place it.`);
      return;
    }
    // voting
    this.mark.visible = false;
    if (this.palette.isConnected) { this.palette.remove(); g.audio.sfx('bell'); this.showVote(); }
    const left = Math.ceil(BUILD + VOTE - rt);
    ctx.say(this.vote ? `You voted for ${this.nameOf(this.vote)}` : `Vote for your favourite castle: ${left}`, 'Walk round and have a look. You can\'t vote for your own.');
    const humans = ctx.ps.filter((p) => !ctx.isAI(p[0]) || p[0] === ctx.me);
    const allVoted = humans.every((p) => (p[0] === ctx.me ? this.vote : ctx.state(p[0])?.vt));
    if ((rt > BUILD + VOTE || allVoted) && !this.doneAt) this.doneAt = Date.now();
    if (this.doneAt && (ctx.host || ctx.hostGone() || Date.now() - this.doneAt > 10000)) ctx.finish(this.scores());
  }
  nameOf(id) { const p = this.ctx.ps.find((x) => x[0] === id); return p ? `${p[1]}'s castle` : 'a castle'; }
  showVote() {
    const ctx = this.ctx;
    this.voteBox = h('div.bg-picks', ctx.ps.filter((p) => p[0] !== ctx.me).map((p) => h('button.bg-pick', { 'data-id': p[0], on: { click: () => { this.vote = p[0]; ctx.game.audio.sfx('click'); for (const b of this.voteBox.children) b.classList.toggle('on', b.dataset.id === p[0]); } } }, p[1])));
    ctx.bg.hud?.el.append(this.voteBox);
  }
  scores() {
    const ctx = this.ctx;
    const looks = ctx.ps.map((p, i) => castleScore(this.castleOf(p[0], i)));
    const votes = ctx.ps.map(() => 0);
    const bestOther = (self) => { let b = -1; looks.forEach((s, j) => { if (j !== self && (b < 0 || s > looks[b])) b = j; }); return b; };
    // Kai judges too, then everyone else's votes
    const kai = bestOther(-1);
    if (kai >= 0) votes[kai]++;
    ctx.ps.forEach((p, i) => {
      const v = p[0] === ctx.me ? this.vote : ctx.isAI(p[0]) ? ctx.ps[bestOther(i)]?.[0] : ctx.state(p[0])?.vt;
      const j = ctx.ps.findIndex((x) => x[0] === v);
      if (j >= 0 && j !== i) votes[j]++;
    });
    return ctx.ps.map((p, i) => ({ id: p[0], s: votes[i] * 100 + looks[i], txt: `${votes[i]} vote${votes[i] === 1 ? '' : 's'}` }));
  }
  label(id, s) { const v = Math.floor(s / 100); return `${v} vote${v === 1 ? '' : 's'}`; }
  primary(down) { if (down) this.place(); return true; }
  actions() {
    const t = this.ctx.time();
    if (t < 0 || t > BUILD) return [];
    return [{ id: 'bgplace', label: `Place: ${PIECE_BY_C[this.sel].name}`, color: 'gold', fn: () => this.place() }];
  }
  pose() { return this.digT > 0 ? 'dig' : null; }
  state() { return { cs: packCastle(this.cells), ...(this.vote ? { vt: this.vote } : {}) }; }
  end() { this.palette.remove(); this.voteBox?.remove(); }
}
