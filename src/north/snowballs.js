// Frostmere: snowballs. Up north, with snow underfoot and no water in reach, the fishing button scoops up a snowball
// and throws it where you're facing (or where you clicked). Other anglers see it fly (a net event) and a hit bursts
// in a puff of snow. Kit and Bo will take you on: first to five hits wins.
import * as THREE from 'three';
import { toLocal, inNorth, kindAt, K, ICE_Y } from './geo.js';
import { northSfx } from './sounds.js';

const MAX = 24, SPEED = 17, GRAV = 11;

export class Snowballs {
  constructor(north) {
    this.north = north; this.game = north.game;
    this.balls = [];
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#40505a' }), MAX);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.name = 'snowballs';
    this.game.engine.scene.add(this.mesh);
    this.throwT = 0; this.cool = 0;
    this.fight = null; // { score: [you, kids], kids: [npc], t }
    this.subscribed = null;
  }
  /** Snow under your feet (not the ice, not a building)? */
  onSnow() {
    const p = this.game.player.pos;
    if (!inNorth(p.x, p.z) || this.game.player.mode !== 'shore') return false;
    const [u, v] = toLocal(p.x, p.z);
    return (kindAt(u, v) === K.LAND || !!this.fight) && this.north.village?.floorAt(p.x, p.z) == null; // (in a fight, the ice has snow on it too)
  }
  /** In a snowball fight, on the snow: a click throws (rather than walking you to the spot). */
  clickThrows() { return !!this.fight && this.north.here && this.onSnow(); }
  /** The fishing button with no water in reach, on the snow: throw one. Returns true if it did. */
  tryThrow(aim) {
    const g = this.game;
    if (!this.north.here || !this.onSnow()) return false;
    if (this.cool > 0) { this.queued = { aim, t: 0.6 }; return true; } // (too soon: it goes the moment your arm's free)
    const pl = g.player;
    if (aim) pl.faceToward(aim.x, aim.z);
    const f = pl.forward(), dist = aim ? Math.min(22, Math.max(4, Math.hypot(aim.x - pl.pos.x, aim.z - pl.pos.z))) : 14;
    const vy = Math.min(9, GRAV * dist / (2 * SPEED) + 1.2);
    this.spawn(pl.pos.x + f.x * 0.5, pl.pos.y + 1.6, pl.pos.z + f.z * 0.5, f.x * SPEED, vy, f.z * SPEED, 'me');
    g.netEvent?.('nsb', { x: +pl.pos.x.toFixed(2), y: +(pl.pos.y + 1.6).toFixed(2), z: +pl.pos.z.toFixed(2), vx: +(f.x * SPEED).toFixed(2), vy: +vy.toFixed(2), vz: +(f.z * SPEED).toFixed(2) });
    this.throwT = 0.45; this.cool = 0.35;
    northSfx(g.audio, 'snowball', { vol: 0.5 });
    if (!this.north.d.snowballs) g.ext.change((d) => { d.north.snowballs = 1; });
    return true;
  }
  spawn(x, y, z, vx, vy, vz, owner) {
    if (this.balls.length >= MAX) this.balls.shift();
    this.balls.push({ p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(vx, vy, vz), owner, t: 0 });
  }
  pose() { return this.throwT > 0 ? (this.throwT > 0.25 ? 'throw' : 'cast') : null; }
  /** Listen for other anglers' snowballs. */
  subscribe() {
    const net = this.game.net;
    if (!net || this.subscribed === net) return;
    this.subscribed = net;
    net.on('ev:nsb', ({ from, data }) => {
      if (!this.north.here || !data || ![data.x, data.y, data.z, data.vx, data.vy, data.vz].every((n) => typeof n === 'number' && isFinite(n))) return;
      if (Math.abs(data.vx) > 40 || Math.abs(data.vy) > 40 || Math.abs(data.vz) > 40) return;
      this.spawn(data.x, data.y, data.z, data.vx, data.vy, data.vz, from || 'them');
    });
  }
  update(dt) {
    const g = this.game, me = g.player.pos;
    this.subscribe();
    this.throwT = Math.max(0, this.throwT - dt); this.cool = Math.max(0, this.cool - dt);
    if (this.queued) { const q = this.queued; this.queued = null; q.t -= dt; if (this.cool <= 0) this.tryThrow(q.aim); else if (q.t > 0) this.queued = q; }
    const m4 = new THREE.Matrix4();
    const targets = [];
    for (const r of g.remotes?.list?.values?.() || []) if (r.actor.root.visible) targets.push({ pos: r.pos, who: r, name: r.peer.meta?.name || 'Someone' });
    for (const k of this.fight?.kids || []) targets.push({ pos: k.pos, who: k, kid: true, name: k.name });
    let n = 0;
    for (const b of this.balls) {
      b.t += dt; b.v.y -= GRAV * dt; b.p.addScaledVector(b.v, dt);
      let hit = null;
      if (b.owner === 'me') { for (const T of targets) if (Math.abs(T.pos.x - b.p.x) < 0.55 && Math.abs(T.pos.z - b.p.z) < 0.55 && b.p.y > T.pos.y + 0.2 && b.p.y < T.pos.y + 2.1) { hit = T; break; } }
      else if (Math.abs(me.x - b.p.x) < 0.55 && Math.abs(me.z - b.p.z) < 0.55 && b.p.y > me.y + 0.2 && b.p.y < me.y + 2.1) hit = { me: true };
      const ground = this.north.groundAt(b.p.x, b.p.z) ?? ICE_Y;
      if (hit || b.p.y < ground + 0.05 || b.t > 4) {
        b.dead = true;
        this.puff(b.p, hit ? 18 : 8);
        if (hit) this.onHit(b, hit);
        continue;
      }
      if (n < MAX) { m4.makeTranslation(b.p.x, b.p.y, b.p.z); this.mesh.setMatrixAt(n++, m4); }
    }
    this.balls = this.balls.filter((b) => !b.dead);
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
    this.updateFight(dt);
  }
  puff(p, k) {
    const fx = this.game.fx;
    for (let i = 0; i < k; i++) fx.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3, i % 3 ? '#ffffff' : '#dceaf4', 0.5 + Math.random() * 0.3, -7);
  }
  onHit(b, hit) {
    const g = this.game;
    northSfx(g.audio, 'snowball');
    if (hit.me) {
      g.juice?.hit({ shake: 0.25 });
      const who = b.owner?.name || (typeof b.owner === 'string' && g.remotes?.list?.get(b.owner)?.peer.meta?.name) || 'Someone';
      if (this.fight && b.owner?.kid) { this.fight.score[1]++; this.scoreToast(); }
      else g.ui.toast(`${who} got you with a snowball!`, { ms: 2000 });
      return;
    }
    if (hit.kid && this.fight) { this.fight.score[0]++; g.juice?.pop('HIT!', { color: '#ffffff', size: 34, ms: 700 }); this.scoreToast(); return; }
    g.juice?.pop('SPLAT!', { color: '#ffffff', size: 30, ms: 700 });
    this.north.onEvent('snowballhit');
  }

  // ---------------------------------------------------------------- Kit and Bo's snowball fight
  startFight() {
    const V = this.north.villagers, kids = ['kit', 'bo'].map((id) => V.byId(id)).filter(Boolean);
    if (!kids.length) return;
    const p = this.game.player.pos;
    kids.forEach((k, i) => { k.fightHome = { kind: k.kind, x: k.pos.x, z: k.pos.z }; k.kind = 'stand'; k.pos.x = p.x + (i ? 7 : -7) + 4; k.pos.z = p.z + 9; k.home = { x: k.pos.x, z: k.pos.z }; k.homeYaw = null; k.kid = true; });
    this.fight = { score: [0, 0], kids, t: 0, next: 2 };
    this.game.ui.toast('Snowball fight with Kit and Bo! First to five hits. Fishing button to throw (click where to aim).', { title: 'Snowball fight!', icon: 'star', ms: 6000 });
  }
  scoreToast() {
    const F = this.fight, g = this.game;
    g.ui.toast(`You ${F.score[0]} - ${F.score[1]} Kit & Bo`, { ms: 1500 });
    if (F.score[0] >= 5 || F.score[1] >= 5) this.endFight(F.score[0] >= 5);
  }
  async endFight(won) {
    const F = this.fight, g = this.game;
    this.fight = null;
    for (const k of F.kids) { k.kind = k.fightHome.kind; k.home = { x: k.fightHome.x, z: k.fightHome.z }; k.kid = false; }
    if (won) {
      g.juice?.pop('YOU WIN!', { color: '#ffd84a', size: 48, ms: 1500 });
      g.chat?.npcSay?.('Kit', 'No fair! Again tomorrow!');
      this.north.onEvent('snowballwin');
      if (!this.north.d.snowWin) { g.ext.change((d) => { d.north.snowWin = Date.now(); }); await g.reward('north', 'snowball-first', { coins: 60, xp: 40 }, 'Snowball champion'); }
    } else { g.chat?.npcSay?.('Bo', 'Ha! Snow in your ear! Rematch?'); }
  }
  updateFight(dt) {
    const F = this.fight; if (!F) return;
    const g = this.game, me = g.player.pos;
    F.t += dt; F.next -= dt;
    if (!this.north.here || F.kids.some((k) => Math.hypot(k.pos.x - me.x, k.pos.z - me.z) > 45)) { this.endFight(false); return; }
    if (F.next <= 0) {
      F.next = 1.4 + Math.random() * 1.6;
      const k = F.kids[Math.floor(Math.random() * F.kids.length)];
      const dx = me.x - k.pos.x, dz = me.z - k.pos.z, d = Math.hypot(dx, dz) || 1, miss = 1 - Math.min(0.85, 0.55 + F.t * 0.004);
      const ax = dx / d + (Math.random() - 0.5) * miss * 0.6, az = dz / d + (Math.random() - 0.5) * miss * 0.6, l = Math.hypot(ax, az);
      const vy = GRAV * d / (2 * SPEED) + 1.0;
      k.yaw = Math.atan2(dx, dz); k.emote = { id: 'throw', until: performance.now() + 500 };
      this.spawn(k.pos.x, k.pos.y + 1.5, k.pos.z, ax / l * SPEED, vy, az / l * SPEED, { kid: true, name: k.name });
    }
    // the kids dodge about a little
    for (const k of F.kids) { k.pos.x += Math.sin(F.t * 1.3 + (k.name === 'Kit' ? 0 : 2)) * dt * 1.2; }
  }
  contextActions() {
    if (this.fight) return [];
    const V = this.north.villagers, p = this.game.player.pos;
    const kid = ['kit', 'bo'].map((id) => V?.byId(id)).find((k) => k && Math.hypot(k.pos.x - p.x, k.pos.z - p.z) < 3.2);
    return kid ? [{ id: 'snowfight', label: 'Snowball fight!', color: 'blue', at: { x: kid.pos.x, z: kid.pos.z, y: kid.pos.y, h: 2 }, fn: () => this.startFight() }] : [];
  }
}
