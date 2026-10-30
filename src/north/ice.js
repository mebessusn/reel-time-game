// Frostmere: ice fishing, the heart of the north.
//   1. Drill a hole: stand on the ice with an auger (Pell's) and hold E's action; tap the fishing button in a steady
//      rhythm to crank faster. The hole stays open for everyone (shared through your meta) until it skins over.
//   2. Drop your line: the fishing button at a hole drops your jig straight down (fishing.dropAt).
//   3. Jig: with the line down, the fishing button twitches the jig. The flasher (a dial of the water under you) shows
//      the bottom, your lure, and fish as marks that rise toward it. A steady rhythm draws them up; jigging too fast
//      spooks them. When a mark meets the lure it bites: the normal hook and fight.
//   4. Tip-ups: set up to three in your other holes. A flag springs up when one takes; run over and set the hook.
//   5. Holes skin over when nobody fishes them for a few minutes; chip them open again with the ice scoop.
import * as THREE from 'three';
import { mergedMesh } from './instancing.js';
import { toLocal, inNorth, kindAt, isIce, depthAt, ICE_Y, WATER_Y, thinIce } from './geo.js';
import { rollBite, biteDelay } from '../game/rules.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { northSfx } from './sounds.js';
import { h } from '../ui/dom.js';
import { addSolidFn } from '../world/colliders.js';

export const ICE_GEAR = {
  auger_hand: { name: 'Hand Auger', price: { coins: 150 }, what: 'Drills a hole through the ice in a few seconds. Crank it in a steady rhythm to drill faster.' },
  auger_power: { name: 'Power Auger', price: { coins: 2500 }, what: 'A petrol auger: a hole in a second, no cranking.' },
  flasher: { name: 'Flasher', price: { coins: 300 }, what: 'A sonar dial for ice fishing: it shows the bottom, your jig and every fish that comes to look at it.' },
  jigrod: { name: 'Jig Rod', price: { coins: 600 }, what: 'A short, sensitive rod for fishing through the ice. Fish come to your jig a fifth faster.' },
  tipups: { name: 'Tip-ups (set of 3)', price: { coins: 400 }, what: 'Set them in your spare holes; a flag springs up when a fish takes the bait.' },
  cleats: { name: 'Ice Cleats', price: { coins: 350 }, what: 'Spikes for your boots: you feel thin ice creaking sooner.' },
  skates: { name: 'Ice Skates', price: { coins: 500 }, what: 'Your own pair: lace them up on any ice and glide.' },
  snowshoes: { name: 'Snowshoes', price: { coins: 250 }, what: 'Walk over deep snow off the paths without sinking in.' },
};
export const HOLE_R = 0.42;
const MY_MAX = 12, SKIN_AFTER = 240, SKIN_TIME = 60, FLAG_WINDOW = 25;

export class IceFishing {
  constructor(north) {
    this.north = north; this.game = north.game;
    this.mine = []; // my holes: { id, x, z, r, t (last fished, s), skin }
    this.remote = []; // other anglers' holes (from their meta)
    this.tipups = []; // { hole, obj, flag, armT, flagged, flagT }
    this.drill = null;
    this.marks = []; this.lastJig = -9; this.jigs = 0;
    this.time = 0;
    this.camps = new Map(); // v1.17.1: hole id -> { tent, stool, seat, x, z, yaw } (a pop-up tent and a stool by each drilled hole)
    this.buildUI();
    // the tents' walls (back and sides; the front is open to the hole) and the stools are solid
    addSolidFn((x, z, r) => {
      for (const c of this.camps.values()) {
        const dx = x - c.tx, dz = z - c.tz; if (dx * dx + dz * dz > 9) continue;
        const lx = dx * Math.cos(c.yaw) - dz * Math.sin(c.yaw), lz = dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw);
        if (lz > -1.3 - r && lz < -1.12 + r && Math.abs(lx) < 1.0 + r) return true; // the back
        if (Math.abs(Math.abs(lx) - 0.95) < 0.1 + r && lz > -1.3 && lz < 0.34 + r) return true; // the sides
        if (Math.hypot(x - c.sx, z - c.sz) < 0.2 + r && !(this.game.chairs?.seat === c.seat)) return true; // the stool
      }
      return false;
    });
  }
  /** Pop-up camps: a tent and a stool by every drilled hole that knows which way its angler faced. */
  syncCamps() {
    const want = new Map(), g = this.game;
    for (const hl of this.drilledHoles()) if (typeof hl.yaw === 'number' && isFinite(hl.yaw)) want.set(hl.id, hl);
    for (const [id, c] of this.camps) if (!want.has(id)) {
      this.group.remove(c.tent); this.group.remove(c.stool);
      if (g.chairs) { if (g.chairs.seat === c.seat) g.chairs.stand(); g.chairs.list = g.chairs.list.filter((q) => q !== c.seat); }
      this.camps.delete(id);
    }
    for (const [id, hl] of want) {
      if (this.camps.has(id)) continue;
      const fx = Math.sin(hl.yaw), fz = Math.cos(hl.yaw);
      const tx = hl.x - fx * 0.75, tz = hl.z - fz * 0.75, sx = hl.x - fx * 0.95, sz = hl.z - fz * 0.95;
      const tent = mergedMesh('hw_icetent'); tent.position.set(tx, ICE_Y, tz); tent.rotation.y = hl.yaw; this.group.add(tent);
      const stool = mergedMesh('hw_icestool'); stool.position.set(sx, ICE_Y, sz); stool.rotation.y = hl.yaw + 0.3; this.group.add(stool);
      const seat = { id: `icestool-${id}`, x: sx, z: sz, y: ICE_Y, h: 0.45, kind: 'stool', yaw: hl.yaw };
      g.chairs?.list.push(seat);
      this.camps.set(id, { tent, stool, seat, tx, tz, sx, sz, yaw: hl.yaw });
    }
  }
  get gear() { return this.north.d.gear || {}; }
  has(k) { return !!this.gear[k]; }
  get group() { return this.north.world.group; }

  // ---------------------------------------------------------------- holes
  allHoles() { return this.north.holes || []; }
  /** The hole you're standing at (within reach to fish it), or null. */
  holeNear(r = 1.9) {
    const p = this.game.player.pos;
    let best = null, bd = r;
    for (const hl of this.allHoles()) { const d = Math.hypot(hl.x - p.x, hl.z - p.z); if (d < bd) { bd = d; best = hl; } }
    return best;
  }
  /** Standing on the ice up north (not in the water, not on land)? */
  onIce() {
    const p = this.game.player.pos;
    if (!inNorth(p.x, p.z) || this.game.player.mode !== 'shore') return false;
    const [u, v] = toLocal(p.x, p.z);
    return isIce(kindAt(u, v)) && Math.abs(p.y - ICE_Y) < 0.4;
  }
  canDrillHere() {
    const p = this.game.player.pos, fwd = this.game.player.forward(), x = p.x + fwd.x * 0.9, z = p.z + fwd.z * 0.9;
    if (!this.onIce()) return null;
    const [u, v] = toLocal(x, z);
    if (!isIce(kindAt(u, v))) return null;
    for (const hl of this.allHoles()) if (Math.hypot(hl.x - x, hl.z - z) < 2.2) return null;
    for (const c of this.camps.values()) if (Math.hypot(c.tx - x, c.tz - z) < 2.0 || Math.hypot(c.tx - p.x, c.tz - p.z) < 1.4) return null; // (not in someone's tent)
    for (const sh of this.north.village?.shanties || []) if (Math.hypot(sh.x - x, sh.z - z) < 2.8) return null; // (not under a shanty)
    if (this.north.village?.rinkCenter && Math.hypot(this.north.village.rinkCenter.x - x, (this.north.village.rinkCenter.z - z) * 1.5) < 17) return null; // (not on the rink)
    return { x, z };
  }
  addHole(x, z, { mine = true, yaw = null } = {}) {
    const hl = { id: Math.random().toString(36).slice(2, 7), x: +x.toFixed(2), z: +z.toFixed(2), r: HOLE_R, t: this.time, skin: 0, mine, ...(yaw != null ? { yaw: +yaw.toFixed(2) } : {}) };
    if (mine) { this.mine.push(hl); while (this.mine.length > MY_MAX) this.removeHole(this.mine[0]); }
    this.north.refreshHoles();
    return hl;
  }
  removeHole(hl) {
    this.mine = this.mine.filter((q) => q !== hl);
    for (const tu of this.tipups.filter((q) => q.hole === hl)) this.pullTipup(tu, true);
    this.north.refreshHoles();
  }
  /** Holes the north cuts into the ice, besides the fixed ones: mine, then everyone else's. */
  drilledHoles() { return [...this.mine, ...this.remote].slice(0, 40); }
  /** Other anglers' holes, from what they share in their meta (refreshed every couple of seconds). */
  syncRemote() {
    const net = this.game.net, out = [];
    for (const p of net?.peers?.values?.() || []) for (const q of p.meta?.nh || []) { if (!Array.isArray(q) || !Number.isFinite(q[0]) || !Number.isFinite(q[1])) continue; out.push({ id: `${p.id}:${q[0]},${q[1]}`, x: q[0], z: q[1], r: HOLE_R, skin: 0, t: this.time, remote: true, ...(Number.isFinite(q[2]) ? { yaw: q[2] } : {}) }); }
    const key = out.map((q) => q.id).join('|');
    if (key !== this.remoteKey) { this.remoteKey = key; this.remote = out; this.north.refreshHoles(); }
  }
  meta() { return this.mine.length ? { nh: this.mine.map((q) => (q.yaw != null ? [q.x, q.z, q.yaw] : [q.x, q.z])) } : {}; }

  // ---------------------------------------------------------------- drilling
  startDrill() {
    const at = this.canDrillHere();
    if (!at || this.drill) return;
    const power = this.has('auger_power');
    const auger = mergedMesh(power ? 'hw_auger_power' : 'hw_auger', { shadow: true });
    auger.position.set(at.x, ICE_Y, at.z); this.group.add(auger);
    this.drill = { at, power, auger, p: 0, lastTap: -9, spin: 0, snd: 0 };
    this.game.player.faceToward?.(at.x, at.z);
    this.ui.drill.classList.remove('hidden');
    this.ui.drillHint.textContent = power ? 'Drilling...' : 'Tap the fishing button in a steady rhythm to crank!';
  }
  /** A tap of the fishing button while drilling: in rhythm (0.2-0.6 s apart) cranks hard, out of rhythm a little. */
  drillTap() {
    const D = this.drill; if (!D || D.power) return;
    const gap = this.time - D.lastTap; D.lastTap = this.time;
    const good = gap > 0.18 && gap < 0.62;
    D.p += good ? 0.13 : 0.05; D.kick = 1;
    this.ui.drillBar.classList.toggle('good', good);
    northSfx(this.game.audio, 'drill');
  }
  updateDrill(dt) {
    const D = this.drill; if (!D) return;
    const g = this.game, p = g.player.pos;
    if (Math.hypot(p.x - D.at.x, p.z - D.at.z) > 2.2 || g.player.mode !== 'shore') { this.endDrill(false); return; }
    D.p += dt * (D.power ? 0.85 : 0.12);
    D.kick = Math.max(0, (D.kick || 0) - dt * 4);
    D.spin += dt * (D.power ? 30 : 6 + D.kick * 18);
    D.auger.rotation.y = D.spin;
    D.auger.position.y = ICE_Y - 0.4 * Math.min(1, D.p);
    D.snd -= dt; if (D.power && D.snd <= 0) { D.snd = 0.12; northSfx(g.audio, 'drill', { vol: 0.8 }); }
    if (Math.random() < dt * (D.power ? 30 : 8 + D.kick * 30)) g.fx.spawn(D.at.x + (Math.random() - 0.5) * 0.3, ICE_Y + 0.05, D.at.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.6, 1 + Math.random() * 1.4, (Math.random() - 0.5) * 1.6, Math.random() < 0.5 ? '#ffffff' : '#dcecf6', 0.6, -6);
    this.ui.drillBar.style.setProperty('--p', Math.min(1, D.p));
    if (D.p >= 1) this.endDrill(true);
  }
  endDrill(done) {
    const D = this.drill; if (!D) return;
    this.group.remove(D.auger);
    this.drill = null;
    this.ui.drill.classList.add('hidden');
    if (!done) return;
    const g = this.game, hl = this.addHole(D.at.x, D.at.z, { yaw: Math.atan2(D.at.x - g.player.pos.x, D.at.z - g.player.pos.z) });
    northSfx(g.audio, 'drillthrough');
    for (let i = 0; i < 18; i++) g.fx.spawn(hl.x, ICE_Y, hl.z, (Math.random() - 0.5) * 2, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 2, i % 2 ? '#e8f6ff' : '#bfe0f0', 0.7, -7);
    g.fx.splash?.(new THREE.Vector3(hl.x, WATER_Y, hl.z), 0.6);
    g.ext.change((d) => { d.north.holes = (d.north.holes || 0) + 1; });
    this.north.onEvent?.('drill', { hole: hl });
    g.pushMeta?.();
    const n = this.north.d.holes || 0;
    this.syncCamps();
    for (let i = 0; i < 10; i++) g.fx.spawn(hl.x - Math.sin(hl.yaw) * 0.8, ICE_Y + 0.6, hl.z - Math.cos(hl.yaw) * 0.8, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, '#f4f8fc', 0.6, -5); // (the tent pops up)
    northSfx(g.audio, 'drillthrough', { vol: 0.3 });
    if (n === 1) g.ui.toast('Your first hole! A tent pops up behind it, with a stool: sit (E) and press the fishing button to drop your line.', { title: 'Ice fishing', icon: 'star', ms: 7000 });
  }

  // ---------------------------------------------------------------- the line down a hole
  /** The fishing button with the line up: at a hole, drop it straight down. Returns true if it did. */
  tryDrop() {
    if (!this.onIce() && !this.holeNear(1.6)) return false;
    const hl = this.holeNear(1.9);
    if (!hl) return false;
    const g = this.game;
    if (hl.skin > 0.6) { g.ui.toast('This hole has frozen over. Chip it open first (E).', { icon: 'waves' }); return true; }
    if (this.tipups.some((q) => q.hole === hl)) { g.ui.toast('Your tip-up is in this hole. Fish another one.', { icon: 'waves' }); return true; }
    g.player.faceToward?.(hl.x, hl.z);
    g.fishing.dropAt(hl);
    hl.t = this.time; hl.skin = 0;
    this.marks = []; this.jigs = 0; this.lastJig = this.time;
    this.spawnT = 2 + Math.random() * 3;
    if (!this.north.d.jigHelp) {
      g.ext.change((d) => { d.north.jigHelp = 1; });
      g.ui.toast('How to jig: tap the fishing button (Space or click) about once a second, when the bar under the flasher is GREEN. Fish appear on the flasher as coloured lines and rise to your lure (the red line) as they get interested. When one bites, press again to set the hook.', { title: 'Jigging through the ice', icon: 'info', ms: 12000 });
    }
    this.lureD = null;
    return true;
  }
  /** Line down a hole and waiting: run the marks (the fishing state machine hands over 'waiting' to us). */
  waiting(dt, F) {
    const g = this.game, hl = F.iceHole;
    const [u, v] = toLocal(hl.x, hl.z), maxD = Math.max(3, Math.min(30, depthAt(u, v) || 6));
    if (this.lureD == null) this.lureD = maxD * 0.82;
    this.maxD = maxD;
    hl.t = this.time; hl.skin = 0;
    const ctx = F.ctx();
    // a new mark now and then (sooner with the jig rod, in a shanty, and while you jig)
    this.spawnT -= dt * (this.has('jigrod') ? 1.25 : 1) * (this.north.shanty?.inside ? 1.15 : 1) * (this.time - this.lastJig < 3 ? 1.3 : 0.8);
    if (this.spawnT <= 0 && this.marks.length < 3) {
      this.spawnT = biteDelay(ctx) * 0.45 + Math.random() * 3;
      const bite = g.answerPending ? null : rollBite({ ...ctx, noJunk: true });
      const sp = bite?.kind === 'fish' ? SPECIES_BY_ID[bite.speciesId] : null;
      const size = bite ? Math.min(1, (bite.weight || 1) / Math.max(1, sp?.weight[1] || 1)) * 0.6 + (['rare', 'epic', 'legendary', 'mythic'].indexOf(sp?.tier) + 1) * 0.12 : 0.6;
      const home = Math.max(0.5, Math.min(maxD - 0.3, maxD * (sp?.depth ?? 0.7) + (Math.random() - 0.5) * 2));
      this.marks.push({ d: Math.min(maxD - 0.2, home + 1.5), home, interest: 0.35, bite, size, glow: !!sp?.glowFlasher && ctx.phase === 'night', life: 18 + Math.random() * 10 });
      northSfx(g.audio, 'tick');
    }
    // marks drift toward the lure as their interest grows, and lose interest if you stop jigging
    const idle = this.time - this.lastJig;
    for (const m of this.marks) {
      m.life -= dt;
      if (idle > 4) m.interest -= dt * 0.06;
      const want = m.interest > 0.45 ? this.lureD : m.home;
      m.d += (want - m.d) * Math.min(1, dt * (0.25 + m.interest * 0.9));
      if (m.interest > 0.55 && Math.abs(m.d - this.lureD) < 0.35 && F.state === 'waiting') { this.bite(m, F); return; }
    }
    this.marks = this.marks.filter((m) => m.interest > 0 && m.life > 0);
    // now and then a seal pops up in your hole for a look round, and helps itself to your bait
    this.sealT = (this.sealT ?? 70 + Math.random() * 120) - dt;
    if (this.sealT <= 0 && !hl.shanty) { this.sealT = 120 + Math.random() * 240; this.sealPops(hl); }
  }
  sealPops(hl) {
    const g = this.game;
    const m = this.seal || (this.seal = mergedMesh('fw_seal')); m.scale.setScalar(0.55); m.rotation.set(-1.35, Math.random() * 6, 0);
    m.position.set(hl.x, WATER_Y - 0.5, hl.z); this.group.add(m); m.visible = true;
    this.marks = []; this.sealUp = 0;
    northSfx(g.audio, 'splash', { vol: 0.5 });
    g.juice?.pop('A seal!', { color: '#e8f4ff', size: 34, ms: 1500 });
    g.ui.toast('A seal popped up in your hole, had a good look at you, and stole your bait! The fish will be back.', { icon: 'waves', ms: 4500 });
    const t0 = performance.now(), tick = () => { const k = (performance.now() - t0) / 3500; if (k >= 1 || !m.parent) { m.visible = false; return; } m.position.y = WATER_Y - 0.5 + Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.9; requestAnimationFrame(tick); };
    tick();
  }
  bite(m, F) {
    F.state = 'nibble'; F.timer = 1.1;
    if (m.bite && m.bite.kind === 'fish') F.forcedBite = m.bite;
    this.marks = this.marks.filter((q) => q !== m);
  }
  /** The fishing button with the line down: twitch the jig. */
  jig() {
    const g = this.game, gap = this.time - this.lastJig;
    this.lastJig = this.time; this.jigs++;
    northSfx(g.audio, 'jig');
    const F = g.fishing; if (F.bobber) F.bobber.dunk = 0.35;
    g.actor?.twitch?.();
    if (gap < 0.32) { // too fast: they spook
      let any = false;
      for (const m of this.marks) { m.interest -= 0.35; m.home = Math.min(this.maxD || 10, m.home + 1); any = true; }
      if (any) { northSfx(g.audio, 'spook'); this.ui.flasherMsg('Too fast! They spooked.', 'bad'); }
    } else if (gap < 1.6) {
      for (const m of this.marks) m.interest = Math.min(1, m.interest + 0.22);
      this.ui.flasherMsg(this.marks.length ? 'Nice and steady...' : '', 'good');
    } else for (const m of this.marks) m.interest = Math.min(1, m.interest + 0.1);
    return true;
  }

  // ---------------------------------------------------------------- tip-ups
  tipupsOwned() { return this.has('tipups') ? 3 : 0; }
  setTipup(hl) {
    const g = this.game;
    if (this.tipups.length >= this.tipupsOwned()) { g.ui.toast('All your tip-ups are set.', { icon: 'waves' }); return; }
    const obj = mergedMesh('hw_tipup'), flag = mergedMesh('hw_tipup_flag');
    obj.position.set(hl.x, ICE_Y, hl.z); obj.rotation.y = Math.random() * 6;
    flag.position.set(0, 0.42, 0); obj.add(flag);
    this.group.add(obj);
    const ctx = { ...g.fishing.ctxAt(hl.x, hl.z) };
    const tu = { hole: hl, obj, flag, armT: biteDelay(ctx) * 2.2 + 8 + Math.random() * 10, flagged: false, flagT: 0, up: 0 };
    this.tipups.push(tu);
    hl.t = this.time;
    northSfx(g.audio, 'jig');
    g.ui.toast(`Tip-up set (${this.tipups.length}/${this.tipupsOwned()}). Watch for the flag!`, { icon: 'waves', ms: 2500 });
    this.north.onEvent('tipupSet');
  }
  pullTipup(tu, quiet = false) {
    this.group.remove(tu.obj);
    this.tipups = this.tipups.filter((q) => q !== tu);
    if (!quiet) { northSfx(this.game.audio, 'jig'); this.game.ui.toast('Tip-up back in your pack.', { ms: 1500 }); }
  }
  updateTipups(dt) {
    const g = this.game;
    for (const tu of this.tipups) {
      tu.hole.t = this.time; tu.hole.skin = 0;
      if (!tu.flagged) {
        tu.armT -= dt;
        if (tu.armT <= 0) {
          tu.flagged = true; tu.flagT = FLAG_WINDOW;
          northSfx(g.audio, 'flag');
          g.juice?.pop('FLAG!', { color: '#ff8a3a', size: 40, ms: 1400 });
          g.ui.toast('A tip-up flag is up! Get over there and set the hook.', { title: 'FLAG!', icon: 'star', ms: 4500 });
          g.netEvent?.('nflag', { x: tu.hole.x, z: tu.hole.z });
          this.flagsUp = this.tipups.filter((q) => q.flagged).length;
          if (this.flagsUp >= 3) this.north.onEvent?.('tripleflag');
        }
      } else {
        tu.flagT -= dt;
        if (tu.flagT <= 0) { tu.flagged = false; tu.armT = 20 + Math.random() * 30; g.ui.toast('Too slow: the fish dropped the bait. The tip-up is reset.', { ms: 3000 }); }
      }
      tu.up += ((tu.flagged ? 1 : 0) - tu.up) * Math.min(1, dt * 10);
      tu.flag.rotation.x = -Math.PI / 2 * tu.up + (tu.flagged ? Math.sin(this.time * 9) * 0.06 : 0);
    }
  }
  /** Set the hook on a flagged tip-up: the fish is on, straight into the fight. */
  takeFlag(tu) {
    const g = this.game;
    this.pullTipup(tu, true);
    g.player.faceToward?.(tu.hole.x, tu.hole.z);
    g.fishing.dropAt(tu.hole, { instant: true });
    g.fishing.state = 'bite'; g.fishing.timer = 2;
    g.fishing.tipup = true;
    g.fishing.hook();
    this.north.onEvent?.('tipupHook');
  }

  // ---------------------------------------------------------------- each frame
  update(dt) {
    this.time += dt;
    this.syncT = (this.syncT || 0) - dt;
    if (this.syncT <= 0) { this.syncT = 2; this.syncRemote(); }
    // holes skin over when nobody's fished them for a while
    let changed = false;
    const F = this.game.fishing;
    for (const hl of this.mine) {
      if (F.iceHole === hl && F.state !== 'idle') continue;
      const idle = this.time - hl.t - SKIN_AFTER;
      const s = idle > 0 ? Math.min(1, idle / SKIN_TIME) : 0;
      if (Math.abs(s - hl.skin) > 0.05) { hl.skin = s; changed = true; }
    }
    // v1.17.1: a hole you've walked away from and aren't fishing closes over and goes, tent and all, after a while
    const me = this.game.player.pos;
    for (const hl of [...this.mine]) {
      if ((F.iceHole === hl && F.state !== 'idle') || this.tipups.some((tu) => tu.hole === hl)) continue;
      const idle = this.time - hl.t, away = Math.hypot(hl.x - me.x, hl.z - me.z);
      if (away > 20 && idle > 90) { this.removeHole(hl); changed = false; this.game.pushMeta?.(); } // (one you're standing by stays: it only skins over, and you can chip it open)
    }
    if (changed) this.north.refreshHoles();
    this.campT = (this.campT || 0) - dt;
    if (this.campT <= 0) { this.campT = 0.5; this.syncCamps(); }
    this.updateDrill(dt);
    this.updateTipups(dt);
    this.drawFlasher(dt);
  }

  /** E actions on the ice. */
  contextActions() {
    const out = [], g = this.game;
    if (!this.north.here || this.drill) return out;
    const hl = this.holeNear(1.9);
    for (const tu of this.tipups) {
      const d = Math.hypot(tu.hole.x - g.player.pos.x, tu.hole.z - g.player.pos.z);
      if (d < 2.2) out.push(tu.flagged ? { id: 'tipup-hook', label: 'FLAG! Set the hook', color: 'gold', at: { x: tu.hole.x, z: tu.hole.z, y: ICE_Y, h: 1.2 }, fn: () => this.takeFlag(tu) } : { id: 'tipup-pull', label: 'Take up tip-up', at: { x: tu.hole.x, z: tu.hole.z, y: ICE_Y, h: 1.2 }, fn: () => this.pullTipup(tu) });
    }
    // (a skinned hole beside a tip-up still gets its own action)
    if (hl && this.tipups.some((tu) => tu.hole === hl)) return out;
    if (out.length && !hl) return out;
    if (hl) {
      if (hl.skin > 0.6) out.push({ id: 'chip', label: 'Chip the hole open', color: 'blue', at: { x: hl.x, z: hl.z, y: ICE_Y, h: 0.8 }, fn: () => this.chip(hl) });
      else if (hl.mine && this.tipups.length < this.tipupsOwned() && !hl.npc) out.push({ id: 'tipup-set', label: 'Set a tip-up', color: 'blue', at: { x: hl.x, z: hl.z, y: ICE_Y, h: 0.8 }, fn: () => this.setTipup(hl) });
      return out;
    }
    if ((this.has('auger_hand') || this.has('auger_power')) && this.canDrillHere()) out.push({ id: 'drill', label: 'Drill a hole', color: 'blue', fn: () => this.startDrill() });
    return out;
  }
  chip(hl) {
    const g = this.game;
    hl.skin = 0; hl.t = this.time; this.north.refreshHoles();
    northSfx(g.audio, 'crack', { vol: 0.5 });
    for (let i = 0; i < 10; i++) g.fx.spawn(hl.x, ICE_Y + 0.05, hl.z, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, '#e8f6ff', 0.5, -7);
    g.ui.toast('Chipped open. Back in business.', { ms: 1500 });
  }
  /** The fishing button: drilling taps. Returns true if it used the press. */
  primary(down) {
    if (!down) return false;
    if (this.drill) { this.drillTap(); return true; }
    return false;
  }

  // ---------------------------------------------------------------- the flasher and drill UI
  buildUI() {
    const cv = h('canvas.flasher-dial', { width: 200, height: 200 });
    const msg = h('div.flasher-msg');
    const coach = h('div.flasher-coach'), beat = h('div.jig-beat', h('i'), h('span', 'JIG'));
    const panel = h('div.flasher.hidden', coach, cv, msg, beat, h('div.flasher-label', 'FLASHER'));
    const drillBar = h('div.drill-bar', h('div.drill-fill'));
    const drillHint = h('div.drill-hint');
    const drill = h('div.drill-ui.hidden', h('div.drill-title', 'Drilling'), drillBar, drillHint);
    this.game.ui.root.append(panel, drill);
    let msgT = 0;
    this.ui = {
      panel, cv, ctx: cv.getContext('2d'), drill, drillBar, drillHint, coach, beat,
      flasherMsg: (text, kind) => { msg.textContent = text; msg.className = `flasher-msg ${kind || ''}`; clearTimeout(msgT); msgT = setTimeout(() => { msg.textContent = ''; }, 1400); },
    };
  }
  drawFlasher() {
    const F = this.game.fishing, on = !!F.iceHole && ['waiting', 'nibble', 'bite'].includes(F.state) && this.north.here;
    this.ui.panel.classList.toggle('hidden', !on);
    if (!on) return;
    const c = this.ui.ctx, W = 200, cx = 100, cy = 100, R = 78, maxD = this.maxD || 10, see = this.has('flasher');
    const ang = (d) => -Math.PI / 2 + (d / maxD) * Math.PI * 2 * 0.9;
    c.clearRect(0, 0, W, W);
    c.fillStyle = '#0d1a22'; c.beginPath(); c.arc(cx, cy, 96, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#26404c'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    // depth ticks every 5 m
    c.fillStyle = '#6a8a98'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let d = 0; d <= maxD; d += maxD > 15 ? 5 : 2) { const a = ang(d); c.fillRect(cx + Math.cos(a) * (R + 6) - 1, cy + Math.sin(a) * (R + 6) - 1, 2, 2); c.fillText(String(d), cx + Math.cos(a) * (R + 15), cy + Math.sin(a) * (R + 15)); }
    if (!see) {
      c.fillStyle = '#8aa4b0'; c.font = 'bold 12px sans-serif'; c.fillText('No flasher', cx, cy - 8); c.font = '10px sans-serif'; c.fillText('(Pell sells them)', cx, cy + 8);
    } else {
      const arc = (d0, d1, col, w, r = R) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(cx, cy, r, ang(d0), ang(d1)); c.stroke(); };
      // the bottom: a thick red band with orange above it
      arc(maxD - 0.15, maxD, '#ff3a2a', 10); arc(maxD - 0.5, maxD - 0.15, '#ff9a2a', 8);
      // the ice at the top
      arc(0, 0.25, '#ff3a2a', 8);
      // the lure, flickering as it jigs
      const lf = this.time - this.lastJig < 0.3 ? 1 : 0.7 + Math.sin(this.time * 20) * 0.15;
      arc(this.lureD - 0.12, this.lureD + 0.12, `rgba(255,60,40,${lf})`, 9);
      // the fish: green small, yellow middling, red big (a glowing ghost on the darkest nights)
      for (const m of this.marks) {
        const col = m.glow ? '#9af8ff' : m.size > 0.75 ? '#ff4a3a' : m.size > 0.45 ? '#ffd23a' : '#4aff6a';
        const w = 5 + m.size * 6 + (m.glow ? Math.sin(this.time * 8) * 2 : 0);
        arc(m.d - 0.12 - m.size * 0.2, m.d + 0.12 + m.size * 0.2, col, w);
      }
      c.fillStyle = '#c8e4f0'; c.font = 'bold 16px sans-serif'; c.fillText(`${(this.lureD || 0).toFixed(1)} m`, cx, cy - 6);
      c.font = '10px sans-serif'; c.fillStyle = '#6a8a98'; c.fillText(`bottom ${maxD.toFixed(1)} m`, cx, cy + 10);
    }
    // v1.17.1: the jig rhythm, big and plain: the beat bar under the dial refills after each jig; jig again while it's
    // GREEN (too soon, red, spooks them; too late, grey, and they lose interest). The coach line says what's going on.
    const gap = this.time - this.lastJig, zone = gap <= 0.32 ? 'fast' : gap < 1.6 ? 'ok' : 'slow';
    const B = this.ui.beat; B.className = `jig-beat ${zone}${F.state !== 'waiting' ? ' off' : ''}`;
    B.querySelector('i').style.width = `${Math.round(Math.min(1, gap / 1.6) * 100)}%`;
    B.querySelector('span').textContent = F.state !== 'waiting' ? '' : zone === 'fast' ? 'wait...' : zone === 'ok' ? 'JIG NOW' : 'jig!';
    const near = this.marks.reduce((b, m) => Math.min(b, Math.abs(m.d - (this.lureD || 0))), 99), keen = this.marks.some((m) => m.interest > 0.45);
    const tip = F.state === 'nibble' || F.state === 'bite' ? 'A BITE! Press the fishing button to set the hook!'
      : !see ? 'No flasher: jig every second or so (fishing button) and wait for a bite.'
        : !this.marks.length ? 'Jig (fishing button) every second to call fish in. Fish show up as coloured lines.'
          : near < 0.8 ? 'Right at your lure! Keep the same steady beat...'
            : keen ? 'Coming up to your lure. Keep jigging on the green.'
              : 'A fish down there. Jig on the green beat to get its interest.';
    if (this.ui.coach.textContent !== tip) this.ui.coach.textContent = tip;
  }
  /** Thin ice under (x, z)? 0 safe .. 1 very thin. */
  thinAt(x, z) { const [u, v] = toLocal(x, z); return thinIce(u, v) || 0; }
}
