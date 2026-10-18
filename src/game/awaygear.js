// Away gear: crab pots and set lines you leave in the water. They fill on the real clock, so they
// keep fishing while this panel is in the background (or closed). Walk or row up and press E to
// empty them. Contents depend on the lake and on the hour each catch happened.
import * as THREE from 'three';
import { isWater, zoneAt, WATER_Y, regionName } from '../world/terrain.js';
import { SPECIES, SPECIES_BY_ID } from '../data/species.js';
import { worldTime } from '../core/clock.js';
import { mulberry32, hashString } from '../core/rng.js';
import { eligibleSpecies, rollBite, rollWeight, effectiveZone } from './rules.js';

export const GEAR = {
  // v1.9.7: gear fills faster but only soaks for a while (life), then you pull it in. A pot fills in 5 min and
  // soaks 18 (3-4 fills if you keep emptying it); a set line fills in 7.5 min and soaks 20.
  pot: { id: 'pot', name: 'Crab Pot', price: { coins: 800 }, every: 75000, holds: 4, life: 18 * 60000, desc: 'Sits on the bottom and lures in crayfish, shrimp, mussels and small crabs, plus the odd bottom fish. A catch every 75 seconds, holds 4, and soaks for 18 minutes before you haul it back in.' },
  setline: { id: 'setline', name: 'Set Line', price: { coins: 3000 }, every: 150000, holds: 3, life: 20 * 60000, desc: 'A baited line on a float. Anything can bite, rares included. A catch every 2.5 minutes, holds 3, and soaks for 20 minutes before you haul it back in.' },
  // v1.12: the big crayfish and crabs only walk into a proper cage
  cage: { id: 'cage', name: 'Lobster Cage', price: { coins: 10000 }, every: 240000, holds: 2, life: 24 * 60000, level: 15, desc: 'A heavy wire cage with a funnel door. It catches the big crayfish and crabs a crab pot can\'t hold, and which ones depends on the lake. A catch every 4 minutes, holds 2, soaks for 24 minutes.' },
};
/** v1.12: which shellfish a trap can find at this lake and level. */
export function shellPool(kind, lake, level) {
  return SPECIES.filter((s) => s.shell === kind && (s.minLevel || 1) <= level && s.zones.includes(lake));
}
const SHELL_WEIGHT = { common: 6, uncommon: 4, rare: 2, epic: 1, legendary: 0.35, mythic: 0.1 };
/** v1.9.7: at most this many of each kind in one lake at a time (and you can own up to OWN_MAX of each). */
export const PER_LAKE = 3;
export const OWN_MAX = 6;
export const MAX_PLACED = 12;
/** Which lake a fishing zone belongs to (the cove's zones are all Cozy Cove). */
export function gearLake(zone) { return ['dock', 'shallows', 'open', 'deep', 'falls', 'ruins'].includes(zone) ? 'cove' : zone || 'cove'; }
const FAST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fastgear');

// What one slot of a piece of gear caught, rolled deterministically from its id and slot number so a
// reload never changes it. `at` is when it happened (decides time of day and weather).
export function rollGearCatch(gear, slot, level) {
  const at = gear.placedAt + (slot + 1) * every(gear.kind);
  const wt = worldTime(at);
  const r = mulberry32(hashString(`${gear.id}:${slot}`));
  const zone = effectiveZone(gear.zone, level, wt.phase, {});
  const ctx = { zone, phase: wt.phase, weather: wt.weather, fullMoon: wt.fullMoon, perks: {}, noJunk: true };
  const lake = gearLake(gear.zone);
  const pickShell = (pool) => {
    const total = pool.reduce((a, s) => a + SHELL_WEIGHT[s.tier], 0);
    let x = r() * total, sp = pool[pool.length - 1];
    for (const s of pool) { x -= SHELL_WEIGHT[s.tier]; if (x <= 0) { sp = s; break; } }
    return { kind: 'fish', speciesId: sp.id, variant: r() < 0.02 ? 'gold' : r() < 0.003 ? 'diamond' : 'normal', weight: rollWeight(sp, r), at, zone, phase: wt.phase, weather: wt.weather };
  };
  if (gear.kind === 'cage') {
    let pool = shellPool('cage', lake, level);
    if (!pool.length) pool = shellPool('pot', lake, level);
    if (!pool.length) pool = [SPECIES_BY_ID.crayfish];
    return pickShell(pool);
  }
  if (gear.kind === 'pot') {
    // bottom feeders and small fry; a crab pot sometimes brings up a little treasure instead
    if (r() < 0.06) return { kind: 'junk', junkId: r() < 0.5 ? 'chest' : 'bottle', at };
    // v1.12: mostly shellfish now
    const shells = shellPool('pot', lake, level);
    if (shells.length && r() < 0.68) return pickShell(shells);
    let pool = eligibleSpecies(null, ctx).filter((s) => ['common', 'uncommon'].includes(s.tier));
    if (!pool.length) pool = eligibleSpecies(null, { ...ctx, phase: 'day', weather: 'clear' }).filter((s) => s.tier === 'common');
    if (!pool.length) pool = [SPECIES_BY_ID.bluegill];
    const weightOf = (s) => (s.behaviour === 'sink' ? 3 : 1) * (s.tier === 'common' ? 2 : 1);
    const total = pool.reduce((a, s) => a + weightOf(s), 0);
    let x = r() * total, sp = pool[pool.length - 1];
    for (const s of pool) { x -= weightOf(s); if (x <= 0) { sp = s; break; } }
    return { kind: 'fish', speciesId: sp.id, variant: r() < 0.02 ? 'gold' : 'normal', weight: rollWeight(sp, r), at, zone, phase: wt.phase, weather: wt.weather };
  }
  const b = rollBite(ctx, r);
  return { ...b, at, zone, phase: wt.phase, weather: wt.weather };
}

function every(kind) { return FAST ? 15000 : GEAR[kind].every; }
function life(kind) { return FAST ? 90000 : GEAR[kind].life; }
/** When this piece of gear's soak ends (set when it went in the water; old saves count from now). */
export function gearEnds(gear) { return (gear.setAt ?? gear.placedAt) + life(gear.kind); }

/** How many catches are waiting in a piece of gear now (nothing more fills after its soak ends). */
export function gearCount(gear, now = Date.now()) {
  const t = Math.min(now, gearEnds(gear));
  return Math.min(GEAR[gear.kind].holds, Math.max(0, Math.floor((t - gear.placedAt) / every(gear.kind))));
}

function buildBuoy(kind) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), mat(kind === 'pot' ? '#e8682a' : kind === 'cage' ? '#f2c040' : '#f2f0e8'));
  body.position.y = 0.08;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.44), mat(kind === 'pot' ? '#f8f0e0' : kind === 'cage' ? '#2a2a2a' : '#d84030'));
  band.position.y = 0.12;
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), mat('#6a4a2a'));
  pole.position.y = 0.5;
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.03), mat('#f2c040'));
  flag.position.set(0.17, 0.72, 0);
  g.add(body, band, pole, flag);
  g.userData = { flag, body };
  return g;
}

export class AwayGear {
  constructor(game) {
    this.game = game;
    this.meshes = new Map();
    this.group = new THREE.Group();
    game.engine.scene.add(this.group);
  }

  get ext() { return this.game.ext; }
  get placed() { return this.ext.d.gear; }

  init() {
    // v1.9.7: gear set before soaks had an end gets one, counted from now
    if (this.placed.some((g) => g.setAt == null)) this.ext.change((d) => { const now = Date.now(); d.gear = d.gear.map((g) => (g.setAt == null ? { ...g, setAt: now - Math.max(0, life(g.kind) - 5 * 60000) } : g)); });
    this.sync();
    // Coming back to the panel: tell the player what their gear caught while they were away.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.report(); });
    setTimeout(() => this.report(true), 4000);
  }

  report(first = false) {
    const full = this.placed.map((g) => ({ g, n: gearCount(g) })).filter((x) => x.n > 0);
    const n = full.reduce((a, x) => a + x.n, 0);
    const key = full.map((x) => `${x.g.id}${x.n}`).join('|');
    if (!n || key === this.lastReport) return;
    this.lastReport = key;
    const where = [...new Set(full.map((x) => regionName(x.g.x, x.g.z)))].join(', ');
    this.game.ui.toast(`Your gear caught ${n} thing${n > 1 ? 's' : ''} while you were away (${where}). Row or walk over and press E to empty it.`, { icon: 'creel', title: first ? 'Welcome back' : 'Away gear', ms: 6500 });
  }

  owned(kind) { return this.ext.d.gearOwned[kind] || 0; }
  inUse(kind) { return this.placed.filter((g) => g.kind === kind).length; }
  spare() { return Object.keys(GEAR).filter((k) => this.owned(k) > this.inUse(k)); }

  async buy(kind) {
    const it = GEAR[kind];
    if (it.level && this.game.profile.level < it.level) { this.game.ui.toast(`${it.name}s unlock at level ${it.level}.`); return false; }
    if (this.owned(kind) >= OWN_MAX) { this.game.ui.toast(`You can own up to ${OWN_MAX} ${it.name}s.`); return false; }
    const r = await this.game.save.spend('gear', kind, it.price);
    if (!r.ok) { this.game.ui.toast(r.reason || 'Not enough coins.'); return false; }
    this.ext.change((d) => { d.gearOwned[kind] = (d.gearOwned[kind] || 0) + 1; });
    this.game.audio.sfx('purchase');
    this.game.ui.toast(`Bought a ${it.name}. Open your backpack (B) and place it while facing open water.`, { icon: 'shop', ms: 5000 });
    return true;
  }

  // A water spot right in front of you that a pot could sit in.
  spotAhead() {
    const p = this.game.player;
    const f = p.forward();
    const range = p.mode === 'boat' ? [1.4, 2.4, 3.2] : [1.5, 2.5, 3.5, 4.5, 5.5];
    for (const d of range) {
      const x = p.pos.x + f.x * d, z = p.pos.z + f.z * d;
      if (isWater(x, z) && zoneAt(x, z) && this.placed.every((g) => Math.hypot(g.x - x, g.z - z) > 3)) return { x, z, zone: zoneAt(x, z) };
    }
    return null;
  }

  near(r = 3.6) {
    const p = this.game.player.pos;
    let best = null, bd = r;
    for (const g of this.placed) { const d = Math.hypot(g.x - p.x, g.z - p.z); if (d < bd) { bd = d; best = g; } }
    return best;
  }

  place(kind) {
    const s = this.spotAhead();
    if (!s) { this.game.ui.toast('Face open water to set your gear.'); return; }
    const lake = gearLake(s.zone), here = this.placed.filter((g) => g.kind === kind && gearLake(g.zone) === lake).length;
    if (here >= PER_LAKE) { this.game.ui.toast(`You already have ${PER_LAKE} ${GEAR[kind].name}s out in ${regionName(s.x, s.z)}. Try another lake, or haul one in.`); return; }
    if (this.placed.length >= MAX_PLACED) { this.game.ui.toast(`You can have ${MAX_PLACED} pieces of gear out at once.`); return; }
    const now = Date.now();
    const g = { id: `${kind}-${now.toString(36)}${Math.floor(Math.random() * 1e4)}`, kind, x: +s.x.toFixed(2), z: +s.z.toFixed(2), zone: s.zone, placedAt: now, setAt: now };
    this.ext.change((d) => { d.gear.push(g); });
    this.game.fx.splash(new THREE.Vector3(g.x, WATER_Y, g.z), 0.6);
    this.game.audio.sfx('plop');
    this.game.ui.toast(`${GEAR[kind].name} set in ${regionName(g.x, g.z)}. It soaks for ${Math.round(GEAR[kind].life / 60000)} minutes; empty it as it fills.`, { ms: 4200 });
    this.game.quests?.progress('gear', { kind });
    this.sync();
  }

  // Empty a piece of gear: every catch goes through the normal save path (creel, Fishpedia, XP).
  async collect(gear, { pickUp = false } = {}) {
    const n = gearCount(gear);
    const g = this.game;
    const got = [];
    for (let i = 0; i < n; i++) got.push(rollGearCatch(gear, i, g.profile.level));
    // reset the gear: it starts filling again now
    this.ext.change((d) => {
      const i = d.gear.findIndex((x) => x.id === gear.id);
      if (i < 0) return;
      if (pickUp || Date.now() >= gearEnds(d.gear[i])) d.gear.splice(i, 1); // a soak that's over: hauled in for good
      else d.gear[i] = { ...d.gear[i], placedAt: Date.now() };
    });
    this.sync();
    if (!got.length) { g.ui.toast(pickUp ? `${GEAR[gear.kind].name} picked up.` : 'Nothing yet. Give it a little longer.'); return []; }
    g.audio.sfx('flop');
    const lines = [];
    for (const b of got) {
      if (b.kind === 'junk') { const out = await g.save.recordJunk(b.junkId); lines.push(b.junkId === 'chest' ? `a little treasure (+${out.coins || 0}c)` : 'a message in a bottle'); continue; }
      const c = { id: undefined, speciesId: b.speciesId, variant: b.variant, weight: b.weight, zone: b.zone, phase: b.phase, weather: b.weather, fullMoon: false, ts: b.at, waitCatch: true, away: true };
      try {
        const s = await g.save.recordCatch(c);
        c.id = s.catchId || c.id;
        g.traits?.onCatch(c);
        g.quests?.progress('catch', c);
        g.community?.onCatch().catch(() => {});
        lines.push(`${b.variant === 'gold' ? 'Gold ' : ''}${SPECIES_BY_ID[b.speciesId].name} (${b.weight} lb)`);
        if (s.levelUp) g.onLevelUp(s.levelUp);
      } catch (e) { lines.push(`(one got away: ${e.message})`); break; }
    }
    g.ext.bump('gearCatches', got.length);
    g.ui.toast(`${GEAR[gear.kind].name}: ${lines.join(', ')}`, { icon: 'creel', title: pickUp ? 'Picked up' : 'Emptied', ms: 6000 });
    await g.autoClaim();
    return got;
  }

  contextActions() {
    const acts = [];
    const near = this.near();
    if (near) {
      const n = gearCount(near);
      const left = Math.max(0, Math.ceil((gearEnds(near) - Date.now()) / 60000));
      acts.push({ id: `gear-${near.id}-${n}`, label: n ? `Empty ${GEAR[near.kind].name} (${n}) · ${left} min left` : `${GEAR[near.kind].name} (filling… ${left} min left)`, color: n ? 'gold' : 'blue', fn: () => this.collect(near) });
      acts.push({ id: `gearup-${near.id}`, label: 'Pick up', color: 'ghost', fn: () => this.collect(near, { pickUp: true }) });
    }
    // v1.12.1: setting a trap is done from the backpack now (the old "Put out" prompt popped up whenever you faced water)
    return acts;
  }

  // Keep the buoys in the world matching the saved gear.
  sync() {
    const ids = new Set(this.placed.map((g) => g.id));
    for (const [id, m] of this.meshes) if (!ids.has(id)) { this.group.remove(m); this.meshes.delete(id); }
    for (const g of this.placed) {
      if (this.meshes.has(g.id)) continue;
      const m = buildBuoy(g.kind);
      m.position.set(g.x, WATER_Y, g.z);
      this.group.add(m);
      this.meshes.set(g.id, m);
    }
  }

  /** v1.9.7: a soak that's over hauls itself in: its catch goes to your creel and the gear back to your tackle. */
  expire() {
    if (this.expiring || this.game.fishing?.busy || this.game.ui?.modalOpen) return;
    const done = this.placed.find((g) => Date.now() >= gearEnds(g));
    if (!done) return;
    this.expiring = true;
    this.game.ui.toast(`Your ${GEAR[done.kind].name} in ${regionName(done.x, done.z)} finished its soak. Hauling it in.`, { icon: 'creel', ms: 3500 });
    this.collect(done, { pickUp: true }).finally(() => { this.expiring = false; });
  }

  update(dt, t) {
    this.expT = (this.expT || 0) - dt;
    if (this.expT <= 0) { this.expT = 3; this.expire(); }
    for (const g of this.placed) {
      const m = this.meshes.get(g.id);
      if (!m) continue;
      m.position.y = WATER_Y - 0.05 + Math.sin(t * 1.6 + g.x) * 0.05;
      m.rotation.z = Math.sin(t * 1.1 + g.z) * 0.08;
      const full = gearCount(g) > 0;
      m.userData.flag.visible = full;
      if (full) m.userData.flag.rotation.y = Math.sin(t * 3) * 0.3;
    }
  }
}
