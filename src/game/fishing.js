// Fishing state machine: charge -> flying -> waiting -> nibble -> bite -> reeling -> landed (design doc section 5).
import * as THREE from 'three';
import { isWater, zoneAt, WATER_Y, onDock, castClearance } from '../world/terrain.js';
import { blocked } from '../world/colliders.js';

// open water a bobber can sit on: not under the dock, a jetty or the bridge (with a little clearance)
const openWater = (x, z) => isWater(x, z) && !blocked(x, z, 0.25, 'boat') && !onDock(x, z) && !onDock(x + 0.5, z) && !onDock(x - 0.5, z) && !onDock(x, z + 0.5) && !onDock(x, z - 0.5);
/** v1.17.1: how far a cast can fly straight ahead before something tall is in the way (a lamp post, a tree, a wall,
 *  a piling, a sign): the line goes over low things (rocks you could step on), not through high ones. */
function solidClearance(p, fwd, max = 30) {
  const over = p.pos.y + 1.6; // (low solids whose top is under the rod tip's arc don't stop it)
  for (let s = 0.9; s <= max; s += 0.4) { const x = p.pos.x + fwd.x * s, z = p.pos.z + fwd.z * s; if (blocked(x, z, 0.12, 'shore', over) || (!onDock(x, z) && blocked(x, z, 0.12, 'boat'))) return s; } // (a dock or jetty you stand on blocks boats, not lines: castClearance stops a line at the far side of one)
  return Infinity;
}
import { SPECIES_BY_ID } from '../data/species.js';
import { biteDelay, rollBite, effectiveZone, eligibleSpecies, rollWeight, easeOverweight } from './rules.js';
import { spotAt, gateAt } from './spots.js';
import { swirlAt } from '../world/swirls.js';
import { newTug, stepTug, tugWon, tugLost } from './tug.js';
import { lineRating } from '../data/bait.js';
import { WEATHER_FISHING } from '../core/clock.js';
import { buildFish, buildJunk } from '../entities/fish.js';
import { TIERS } from '../data/species.js';

// Test hook: ?fastbite shortens waits for automated playthroughs.
const FAST_BITE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fastbite');

/** Release at or above this power for a Super Cast (the gold band on the power bar). */
export const SUPER_AT = 0.978;

/** v1.12.1: which tiers the answer fish is drawn from, best first, for a turn that took `secs`. */
export function answerTiers(secs) {
  if (secs >= 1800) return ['legendary', 'epic'];
  if (secs >= 600) return ['epic', 'rare'];
  if (secs >= 120) return Math.random() < 0.5 ? ['epic', 'rare'] : ['rare', 'epic'];
  return ['rare'];
}
/** v1.12.1: diamond odds for the answer fish: none under 30 min, 10% from 30 min, 25% from an hour. */
export function answerDiamondChance(secs) { return secs >= 3600 ? 0.25 : secs >= 1800 ? 0.1 : 0; }

export class Fishing {
  constructor(game) {
    this.game = game;
    this.state = 'idle';
    this.power = 0; this.powerDir = 1;
    this.bobber = null; // { x, z, y, dunk, flying }
    this.timer = 0;
    this.reel = null;
    this.bite = null;
    this.aim = null;
    this.holding = false;
    this.flightFrom = new THREE.Vector3();
    this.flightTo = new THREE.Vector3();
    this.perfect = false;
  }

  get busy() { return this.state !== 'idle'; }

  /** Is there open water (not under a dock) somewhere along a full-power cast straight ahead? */
  waterInReach() {
    const p = this.game.player, fwd = p.forward();
    let extra = 0;
    try { extra = this.game.perks().castDistance || 0; } catch { /* save still loading */ }
    const max = Math.min(4 + 14 + extra, castClearance(p.pos.x, p.pos.z, fwd.x, fwd.z, 30) - 0.8, solidClearance(p, fwd) - 0.6);
    for (let d = 2; d <= max; d += 0.5) if (openWater(p.pos.x + fwd.x * d, p.pos.z + fwd.z * d)) return true;
    return false;
  }

  // Begin charging. aimPoint optional (world xz) to face toward.
  startCharge(aimPoint) {
    if (this.state !== 'idle') return false;
    if (this.game.ocean && !this.game.ocean.canCast()) return false; // v1.15: lines up while the charter runs
    if (this.game.north && !this.game.north.canCast()) return false; // Frostmere: not from the plane
    const p = this.game.player;
    if (p.mode === 'swim') { // (v1.14.11: no casting while you're swimming)
      const now = performance.now();
      if (now - (this.noWaterToast || 0) > 2500) { this.noWaterToast = now; this.game.ui.toast('You can\'t cast while swimming. Climb out onto the bank first.', { icon: 'waves' }); }
      return false;
    }
    if (this.game.north?.ice?.tryDrop()) return false; // Frostmere: at a hole in the ice, the line goes straight down
    if (aimPoint) p.faceToward(aimPoint.x, aimPoint.z);
    // only wind up when there's open water within a full-power cast in the direction you're facing
    if (!this.waterInReach()) {
      if (this.game.north?.snowballs?.tryThrow(aimPoint)) return false; // Frostmere: on the snow, a snowball
      const now = performance.now();
      const ice = this.game.north?.ice?.onIce();
      if (now - (this.noWaterToast || 0) > 2500) { this.noWaterToast = now; this.game.ui.toast(ice ? (this.game.north.ice.has('auger_hand') || this.game.north.ice.has('auger_power') ? 'You\'re on the ice: drill a hole (E) and fish through it.' : 'You\'re on the ice. Pell at the trading post sells augers to drill a hole.') : 'No water in reach. Face the water to cast.', { icon: 'waves' }); }
      return false;
    }
    this.aim = aimPoint ? new THREE.Vector3(aimPoint.x, 0, aimPoint.z) : null;
    this.state = 'charge';
    this.power = 0; this.powerDir = 1;
    this.game.audio.sfx('charge');
    return true;
  }

  releaseCharge() {
    if (this.state !== 'charge') return;
    this.iceHole = null; this.tipup = false;
    const g = this.game, p = g.player;
    const perks = g.perks();
    const power = this.power;
    this.perfect = power >= 0.9;
    // Super Cast: release in the narrow gold band at the very top. Flies further, sparkles all the way,
    // and the fish notice: faster bites and better odds (rules.js reads ctx.superCast). v1.8.1: the band is
    // half as wide (SUPER_AT) and a Super Cast lights the Golden Line buff (see game.goldenLine).
    this.super = power >= SUPER_AT;
    const fwd = p.forward();
    // v1.8.2: a line can't fly through a bridge, dock or jetty: the cast stops short of it
    const clear = Math.min(castClearance(p.pos.x, p.pos.z, fwd.x, fwd.z, 30) - 0.8, solidClearance(p, fwd) - 0.6); // (v1.17.1: and not through anything solid)
    const dist = Math.min(clear, 4 + power * 14 + (perks.castDistance || 0) + (this.super ? 3 : 0));
    // Walk back along the cast line until we hit water.
    let land = null;
    for (let d = dist; d >= 2; d -= 0.5) {
      const x = p.pos.x + fwd.x * d, z = p.pos.z + fwd.z * d;
      if (openWater(x, z)) { land = { x, z }; break; }
    }
    // a short cast along a dock carries on past the planks to the first open water within reach
    if (!land) {
      const max = Math.min(clear, 4 + 14 + (perks.castDistance || 0) + (this.super ? 3 : 0));
      for (let d = dist; d <= max; d += 0.5) {
        const x = p.pos.x + fwd.x * d, z = p.pos.z + fwd.z * d;
        if (openWater(x, z)) { land = { x, z }; break; }
      }
    }
    if (!land) {
      this.state = 'idle';
      g.ui.toast(clear < 6 ? 'Something solid is in the way. Turn a little and cast again.' : 'Cast toward the water!');
      g.audio.sfx('plip');
      return;
    }
    g.actor.rodTip(this.flightFrom);
    this.flightTo.set(land.x, WATER_Y, land.z);
    this.bobber = { x: this.flightFrom.x, z: this.flightFrom.z, y: this.flightFrom.y, flying: true, dunk: 0 };
    this.state = 'flying';
    this.timer = 0;
    this.flightTime = 0.45 + power * 0.35;
    g.audio.sfx('whoosh');
    if (this.super) {
      g.audio.sfx('supercast');
      g.juice?.pop('SUPER CAST!', { color: '#ffd84a', size: 42, ms: 1300, cls: 'pop-super' });
      g.juice?.hit({ stop: 0.05, shake: 0.25, zoom: 0.94 });
      g.fx.sparkle(this.flightFrom, '#ffe070', 26, 1.1);
      g.bumpStat('perfectCasts'); g.ext?.bump('superCasts'); g.quests?.progress('supercast', {});
      g.goldenLine?.();
    } else if (this.perfect) { g.fx.sparkle(this.flightFrom, '#fff4a0', 10, 0.6); g.bumpStat('perfectCasts'); }
    if (g.actor.equipped?.rod === 'rod_cherry') for (let i = 0; i < 6; i++) g.fx.petal(this.flightFrom);
    g.netEvent('cast', { x: land.x, z: land.z });
  }

  /** Frostmere: drop the line straight down a hole in the ice (no cast). { instant }: already down (a tip-up). */
  dropAt(hole, { instant = false } = {}) {
    const g = this.game;
    this.iceHole = hole; this.tipup = false; this.super = false; this.perfect = false; this.aim = null;
    g.actor.rodTip(this.flightFrom);
    this.flightTo.set(hole.x, WATER_Y, hole.z);
    this.bobber = { x: instant ? hole.x : this.flightFrom.x, z: instant ? hole.z : this.flightFrom.z, y: instant ? undefined : this.flightFrom.y, flying: !instant, dunk: 0 };
    this.state = instant ? 'waiting' : 'flying';
    this.timer = 0; this.flightTime = 0.3;
    g.audio.sfx('reelin');
    g.netEvent('cast', { x: hole.x, z: hole.z });
  }
  /** The fishing context as if the line were at (x, z) (Frostmere's tip-ups). */
  ctxAt(x, z) { const keep = this.bobber; this.bobber = { x, z }; try { return this.ctx(); } finally { this.bobber = keep; } }

  ctx() {
    const g = this.game;
    const wt = g.engine.sky.state;
    const rawZone = zoneAt(this.bobber.x, this.bobber.z) || 'dock';
    const perks = g.perks();
    const zone = effectiveZone(rawZone, g.profile.level, wt.phase, perks);
    // a lake's deep end or landmark (v1.13: casts below its level never land, see the 'flying' case)
    const sp = spotAt(this.bobber.x, this.bobber.z);
    const spot = sp && zoneAt(this.bobber.x, this.bobber.z) === sp.lake && g.profile.level >= sp.level ? sp : null;
    const c = {
      zone, rawZone, spot: spot?.id || null, spotKind: spot?.kind || null, spotLocked: sp && !spot ? sp : null, phase: wt.phase, weather: wt.weather, fullMoon: wt.fullMoon, bloodMoon: !!wt.bloodMoon, perks,
      perfectCast: this.perfect, superCast: this.super, goodCompany: g.goodCompany(), firstEver: (g.profile.catchCount || 0) === 0,
      swirl: g.player.mode === 'boat' && !!swirlAt(this.bobber.x, this.bobber.z),
      bait: g.tackle?.active || null, event: g.events?.current || null, season: g.living?.season || null,
      craving: g.cookout?.craving() || null,
    };
    if (g.north?.here) g.north.ctxExtra(c); // Frostmere: the aurora, the shanty
    return g.ocean ? g.ocean.ctxExtra(c) : c; // v1.15 Open Waters: no junk at sea, the spotter's birds
  }

  // Primary action (click / Space). Returns true if consumed.
  press() {
    if (this.state === 'bite') { this.hook(); return true; }
    if (this.state === 'reeling') { this.holding = true; return true; }
    if ((this.state === 'waiting' || this.state === 'nibble') && this.iceHole && this.game.north?.ice) return this.game.north.ice.jig(); // Frostmere: jig
    if (this.state === 'waiting' || this.state === 'nibble') { this.reelIn(); return true; }
    return false;
  }
  releasePress() { this.holding = false; }

  reelIn() {
    this.state = 'idle';
    this.bobber = null;
    this.game.audio.sfx('reelin');
  }

  cancel() { this.game.ocean?.fight.onCancel(); if (this.flip) { this.game.engine.scene.remove(this.flip.mesh); this.flip = null; } this.clearFightFish(); this.state = 'idle'; this.bobber = null; this.reel = null; this.holding = false; this.game.ui.hideReel(); this.game.ui.hideBang(); }

  hook() {
    const g = this.game;
    g.ui.hideBang();
    const c = this.ctx();
    // v1.15 Open Waters: a crewmate handing you the rod mid-fight passes their fish (forcedBite)
    this.bite = this.forcedBite || (g.answerPending ? this.answerBite(c) : (c.ocean && g.ocean?.voyage.lessonBite()) || rollBite(c));
    const handed = !!this.forcedBite; this.forcedBite = null;
    // a fish jumped near your bobber? good chance it's the one that bites
    const hs = !this.bite.answer && !c.firstEver && this.bite.kind === 'fish' ? g.living?.hintBite(this.bobber) : null; // your very first fish is always the promised bluegill
    if (hs && eligibleSpecies(null, c).some((x) => x.id === hs)) { this.bite.speciesId = hs; this.bite.weight = rollWeight(SPECIES_BY_ID[hs]); this.bite.hinted = true; }
    if (!g.answerPending && !handed) this.bite = easeOverweight(this.bite, c, g.ocean?.lineRating() ?? lineRating(g.profile.equipped.rod, g.ext?.d?.upgrades));
    // one bait per hooked fish
    if (c.bait && !handed) this.bite.bait = g.tackle.consume();
    this.biteCtx = c;
    this.lastIce = !!this.iceHole; this.lastTipup = !!this.tipup; // (Frostmere's quests: through the ice, off a tip-up)
    g.audio.sfx('hook');
    if (this.bite.kind === 'junk') {
      this.state = 'reeling';
      this.reel = { junk: true, progress: 0 };
      g.juice?.hit({ stop: 0.05, shake: 0.2, zoom: 0.95 });
      return;
    }
    const sp = SPECIES_BY_ID[this.bite.speciesId];
    // the hook-set: a beat of hit-stop, a shake that grows with the fish, a zoom punch, a ring on the water
    const ti = TIERS.indexOf(sp.tier);
    g.juice?.hit({ stop: 0.07 + ti * 0.02, shake: 0.35 + ti * 0.1 + (this.bite.variant !== 'normal' ? 0.2 : 0), zoom: 0.9 - ti * 0.015 });
    g.juice?.pop(ti >= 3 || this.bite.variant !== 'normal' ? 'BIG ONE!' : 'HOOKED!', { color: ti >= 3 ? '#ffd060' : '#fff4d8', size: ti >= 3 ? 40 : 32 });
    g.fx.splash(new THREE.Vector3(this.bobber.x, WATER_Y, this.bobber.z), 1 + ti * 0.2);
    g.social?.onHook(this.bite);
    g.engine.water.ripple(this.bobber.x, this.bobber.z, 1.2);
    const relaxed = g.profile.settings.relaxedReel;
    // rough weather makes every fight harder (Tug & Turn difficulty), the blood moon most of all
    const wtNow = g.engine.sky.state;
    const wxDiff = (WEATHER_FISHING[wtNow.weather]?.diff || 0) + (wtNow.bloodMoon ? WEATHER_FISHING.bloodmoon.diff : 0);
    const diff = sp.difficulty + (this.bite.variant === 'diamond' ? 0.5 : 0) + wxDiff;
    const up = g.tackle?.effects() || {};
    this.reel = newTug(sp, diff, { relaxed, perk: (g.perks().reelZone || 0) * 0.5, reelBonus: up.reelBonus || 0, lineBonus: up.lineBonus || 0 });
    // Weight limit (v1.9.3): a fish heavier than your line rating snaps it the moment it's hooked, so no one
    // spends a whole fight on a fish they could never land. The toast says what to upgrade.
    const rating = g.ocean?.lineRating() ?? lineRating(g.profile.equipped.rod, g.ext?.d?.upgrades); // v1.15: the charter's big-game rods
    this.reel.rating = rating;
    if (this.bite.weight > rating && !this.bite.answer) { this.reel.overweight = true; }
    g.ocean?.fight.onHook(this.reel, this.bite, sp); // v1.15: big game goes to the fighting chair
    // Geometry of the fight: the fish works left/right across the line from you to the bobber.
    const p = g.player.pos;
    const dx = this.bobber.x - p.x, dz = this.bobber.z - p.z;
    const len = Math.max(2.5, Math.hypot(dx, dz));
    this.fight = { ux: dx / len, uz: dz / len, dist: len, lat: 0 };
    // the hooked fish, seen under the surface
    this.fightFish = buildFish(sp.id, this.bite.variant, this.bite.weight);
    this.fightFish.material = this.fightFish.material.clone();
    Object.assign(this.fightFish.material, { transparent: true, opacity: 0.8, depthWrite: false });
    this.fightFish.renderOrder = 3;
    this.fightFish.scale.multiplyScalar(1.1);
    g.engine.scene.add(this.fightFish);
    this.state = 'reeling';
    this.holding = false;
    g.rodAim = 0;
    g.ui.showReel(this.reel, this.bite);
  }

  // Claude's Catch: when your answer is ready, the next bite is a golden rare (or the best this spot offers).
  answerBite(c) {
    const g = this.game;
    g.answerPending = false;
    // v1.12.1: the longer Claude worked, the better the fish, on a deliberately slow curve:
    // under 2 min a gold rare, 2-10 min rare or epic, 10-30 min epic, 30+ min legendary (or the best this spot
    // has). Diamond only on long runs: 10% from 30 min, 25% from an hour.
    const secs = g.answerSeconds || 0;
    let all = eligibleSpecies(null, c);
    // v1.15.9: aboard a charter, Marlowe's "fish on!": the golden fish is a big-game fish
    if (c.ocean && g.ocean?.voyage.takeBigAnswer()) { const big = all.filter((s) => s.big); if (big.length) all = big; }
    const want = answerTiers(secs);
    let pool = [];
    for (const t of want) { pool = all.filter((s) => s.tier === t); if (pool.length) break; }
    if (!pool.length) pool = all.filter((s) => want.includes(s.tier) || s.tier === 'rare');
    if (!pool.length) pool = all.filter((s) => ['rare', 'epic', 'legendary'].includes(s.tier));
    if (!pool.length) pool = all;
    if (!pool.length) return rollBite(c);
    const sp = pool[Math.floor(Math.random() * pool.length)];
    const variant = Math.random() < answerDiamondChance(secs) ? 'diamond' : 'gold';
    // long answers land heavier fish (the bonus builds over a full hour)
    const w = rollWeight(sp);
    const heavy = Math.min(sp.weight[1], w + (sp.weight[1] - w) * Math.min(0.6, secs / 3600 * 0.6));
    return { kind: 'fish', speciesId: sp.id, variant, weight: Math.round(heavy * 100) / 100, answer: true };
  }

  update(dt, t) {
    const g = this.game;
    switch (this.state) {
      case 'charge': {
        this.power += this.powerDir * dt / 0.9;
        if (this.power >= 1) { this.power = 1; this.powerDir = -1; }
        if (this.power <= 0) { this.power = 0; this.powerDir = 1; }
        g.ui.setPower(this.power);
        break;
      }
      case 'flying': {
        this.timer += dt;
        const k = Math.min(1, this.timer / this.flightTime);
        const b = this.bobber;
        b.x = this.flightFrom.x + (this.flightTo.x - this.flightFrom.x) * k;
        b.z = this.flightFrom.z + (this.flightTo.z - this.flightFrom.z) * k;
        b.y = this.flightFrom.y + (this.flightTo.y - this.flightFrom.y) * k + Math.sin(Math.PI * k) * (this.iceHole ? 0.2 : 1.5 + this.flightTime * 2);
        if (this.super && Math.random() < 0.8) g.fx.sparkle(new THREE.Vector3(b.x, b.y, b.z), Math.random() < 0.5 ? '#ffe070' : '#fff8d0', 2, 0.15);
        if (k >= 1) {
          b.flying = false; b.y = undefined;
          g.fx.splash(this.flightTo, this.super ? 1.3 : 0.5);
          g.ocean?.nightSea.splash(b.x, b.z); // v1.15.10: plankton light up round the bobber at night
          g.engine.water.ripple(b.x, b.z, this.super ? 2 : 1);
          if (this.super) { g.fx.ring?.(this.flightTo, '#ffd84a'); g.fx.sparkle(this.flightTo, '#ffe070', 22, 1.4); g.audio.sfx('superland'); }
          g.audio.sfx('plop', { x: b.x, z: b.z });
          // v1.13: water above your level: nothing down there will bite yet, so the line comes straight back
          const gate = gateAt(b.x, b.z);
          if (g.profile.level < gate.level) {
            this.state = 'idle'; this.bobber = null; this.super = false;
            g.audio.sfx('reelin');
            g.lakeGateFailed?.(gate);
            break;
          }
          this.state = 'waiting';
          const c = this.ctx();
          this.timer = FAST_BITE ? 2 : biteDelay(c) * (g.ocean?.biteMult(c) ?? 1);
          this.zoneShown = c.rawZone;
          g.onBobberLanded(c);
        }
        break;
      }
      case 'waiting': {
        if (this.iceHole && g.north?.ice && !g.answerPending) { g.north.ice.waiting(dt, this); break; } // Frostmere: the flasher's marks decide
        this.timer -= dt;
        if (g.answerPending && this.timer > 1.7) this.timer = 1.7; // the answer fish is already circling
        if (Math.random() < dt * 0.4) g.engine.water.ripple(this.bobber.x, this.bobber.z, -0.6);
        if (this.timer < 1.6) { this.state = 'nibble'; }
        break;
      }
      case 'nibble': {
        this.timer -= dt;
        // bubbles drifting toward the bobber
        if (Math.random() < dt * 8) {
          const a = this.timer * 3;
          g.fx.bubbles(new THREE.Vector3(this.bobber.x + Math.cos(a) * this.timer * 0.6, WATER_Y, this.bobber.z + Math.sin(a) * this.timer * 0.6));
        }
        this.bobber.dunk = Math.random() < dt * 3 ? 0.4 : this.bobber.dunk * 0.9;
        if (this.timer <= 0) {
          this.state = 'bite';
          const relaxed = g.profile.settings.relaxedReel;
          this.timer = 0.8 + (g.perks().hookWindow || 0) + (relaxed ? 0.6 : 0) + ((g.profile.catchCount || 0) === 0 ? 1.2 : 0);
          this.bobber.dunk = 1;
          g.fx.splash(new THREE.Vector3(this.bobber.x, WATER_Y, this.bobber.z), 0.7);
          g.engine.water.ripple(this.bobber.x, this.bobber.z, 0.5);
          g.audio.sfx('bite');
          g.ui.showBang();
          g.netEvent('splash', { x: this.bobber.x, z: this.bobber.z });
        }
        break;
      }
      case 'bite': {
        this.timer -= dt;
        this.bobber.dunk = 0.8 + Math.sin(t * 30) * 0.2;
        if (this.timer <= 0) {
          g.ui.hideBang();
          g.ui.toast('It got away... cast again!');
          g.juice?.broke();
          if (this.bite?.answer) g.answerLost?.(); // v1.12.1
          g.audio.sfx('miss');
          g.fx.splash(new THREE.Vector3(this.bobber.x, WATER_Y, this.bobber.z), 0.4);
          this.state = 'idle';
          this.bobber = null;
        }
        break;
      }
      case 'reeling': this.updateReel(dt, t); break;
      case 'landed': if (this.flip) this.updateFlip(dt); break;
      default: break;
    }
  }

  updateReel(dt, t) {
    const g = this.game, r = this.reel;
    if (r.junk) {
      r.progress += dt / 1.2;
      g.audio.reelLoop(true, 0.5);
      if (r.progress >= 1) this.land();
      return;
    }
    const wasJump = r.jump > 0;
    stepTug(r, dt, this.holding, g.rodAim || 0);
    g.ocean?.fight.onStep(r, dt);
    g.ui.updateReel(r);
    g.audio.reelLoop(this.holding, r.good ? 1 : 0.4);
    // Where the fish is: along the line (closer as you win line) and off to the side it pulls toward.
    const f = this.fight, p = g.player.pos;
    // "right" is screen-right: flip the side axis to match where the camera looks from
    const yaw = g.engine.cam.yaw;
    const dot = -f.uz * Math.cos(yaw) - f.ux * Math.sin(yaw);
    if (Math.abs(dot) > 0.2) f.side = Math.sign(dot);
    const side = f.side || 1;
    f.lat += (r.pull * Math.min(4, f.dist * 0.45) - f.lat) * Math.min(1, dt * 2.5);
    const along = 1.6 + (f.dist - 1.6) * (1 - r.progress * 0.88);
    let bx = p.x + f.ux * along - f.uz * f.lat * side, bz = p.z + f.uz * along + f.ux * f.lat * side;
    if (!openWater(bx, bz)) { bx = p.x + f.ux * along; bz = p.z + f.uz * along; f.lat *= 0.5; }
    if (openWater(bx, bz)) { this.bobber.x += (bx - this.bobber.x) * Math.min(1, dt * 6); this.bobber.z += (bz - this.bobber.z) * Math.min(1, dt * 6); }
    this.bobber.dunk = 0.5 + r.tension * 0.4 + Math.sin(t * 22) * 0.12;
    // the fish under the bobber, nose away from you and toward its pull
    const fish = this.fightFish;
    if (fish) {
      const fy = Math.atan2(-(f.uz + f.ux * r.pull * side * 0.8), f.ux - f.uz * r.pull * side * 0.8);
      fish.rotation.set(0, fy, Math.sin(t * 16) * 0.12);
      const leap = r.jump > 0 ? Math.sin(Math.PI * (1 - r.jump / 0.95)) * 1.7 : 0;
      fish.position.set(this.bobber.x + f.ux * 0.6, WATER_Y - 0.45 + leap * 1.2, this.bobber.z + f.uz * 0.6);
      fish.material.opacity = leap > 0.2 ? 1 : 0.75;
      if (r.jump > 0 && !wasJump) { g.fx.splash(new THREE.Vector3(this.bobber.x, WATER_Y, this.bobber.z), 1.1); g.audio.sfx('splashRemote'); g.ui.tugCue('leap'); }
    }
    if (Math.random() < dt * (2 + r.strength * 6)) g.fx.splash(new THREE.Vector3(this.bobber.x, WATER_Y, this.bobber.z), 0.2 + r.surge * 0.4);
    if (r.surge > 0.35 && Math.random() < dt * 4) g.engine.water.ripple(this.bobber.x, this.bobber.z, 0.6);
    if (r.overweight && (r.heavyT = (r.heavyT || 0) + dt) > 0.6) { r.snapped = true; this.escape(true, 'heavy'); return; } // a moment to feel the weight, then snap
    if (tugWon(r)) { if (r.clean) g.bumpStat('cleanReels'); this.land(); }
    else if (tugLost(r)) this.escape(r.snapped);
  }

  clearFightFish() { if (this.fightFish) { this.game.engine.scene.remove(this.fightFish); this.fightFish.material.dispose(); this.fightFish = null; } }

  escape(snapped = false, why = '') {
    const g = this.game;
    if (why === 'heavy') {
      const r = this.reel;
      g.audio.reelLoop(false); g.ui.hideReel(); this.clearFightFish();
      g.juice?.pop('Too heavy!', { color: '#ff9a7a', size: 36, ms: 1500 }); g.juice?.broke();
      g.ext?.bump('tooHeavy');
      g.ui.toast(`That ${r.species.name} was about ${Math.round(this.bite.weight)} lb, more than your line's ${r.rating} lb rating. A stronger rod or Braided line upgrade will hold it.`, { icon: 'rod', ms: 6500, title: 'The line snapped' });
      g.audio.sfx('miss');
      g.fx.splash(new THREE.Vector3(this.bobber.x, WATER_Y, this.bobber.z), 1.4);
      this.state = 'idle'; this.bobber = null; this.reel = null;
      return;
    }
    g.audio.reelLoop(false);
    g.ui.hideReel();
    this.clearFightFish();
    const big = g.ocean?.fight.onEscape(this.reel, snapped); // v1.15: a big-game fish gets its own words
    if (big) {
      g.juice?.broke(); g.audio.sfx('miss'); g.ui.toast(big, { icon: 'fish', ms: 6000 });
      g.fx.splash(new THREE.Vector3(this.bobber.x, WATER_Y, this.bobber.z), 1.4);
      this.state = 'idle'; this.bobber = null; this.reel = null;
      return;
    }
    const close = this.reel.progress > 0.8 || (snapped && this.reel.progress > 0.7);
    if (close) { g.juice?.pop('So close!', { color: '#ff9a7a', size: 36, ms: 1300 }); g.juice?.hit({ stop: 0, shake: 0.3, zoom: 1.04 }); }
    g.juice?.broke();
    if (this.bite?.answer) g.answerLost?.(); // v1.12.1
    g.ext?.bump(close ? 'nearMisses' : 'escapes');
    g.ui.toast(close ? `It was right there! The ${this.reel.species.name} ${snapped ? 'snapped the line' : 'slipped off'} at the last second.` : snapped ? `Snap! The ${this.reel.species.name} broke the line. Ease off when the line goes red.` : `The ${this.reel.species.name} took all the line and slipped away. It happens!`);
    g.audio.sfx('miss');
    g.fx.splash(new THREE.Vector3(this.bobber.x, WATER_Y, this.bobber.z), 1);
    this.state = 'idle';
    this.bobber = null;
    this.reel = null;
  }

  land() {
    const g = this.game;
    g.ocean?.fight.onLand(this.reel);
    g.audio.reelLoop(false);
    g.ui.hideReel();
    this.clearFightFish();
    const at = new THREE.Vector3(this.bobber.x, WATER_Y, this.bobber.z);
    g.fx.splash(at, 1.2);
    g.audio.sfx('flop');
    this.state = 'landed';
    this.bobber = null;
    const bite = this.bite, ctx = this.biteCtx;
    this.reel = null;
    // the catch flips out of the water in an arc to your hands, spinning, before the card pops
    const mesh = bite.kind === 'junk' ? buildJunk(bite.junkId) : buildFish(bite.speciesId, bite.variant, bite.weight);
    g.engine.scene.add(mesh);
    const to = g.actor.headWorld().clone();
    to.y -= 0.2;
    this.flip = { mesh, t: 0, dur: 0.75, from: at.clone(), to, bite, ctx };
    if (bite.kind !== 'junk') {
      const ti = TIERS.indexOf(SPECIES_BY_ID[bite.speciesId].tier);
      if (ti >= 2 || bite.variant !== 'normal') g.fx.sparkle(at.clone().setY(WATER_Y + 0.8), bite.variant === 'diamond' ? '#a0f0ff' : '#ffe080', 20);
    }
  }

  updateFlip(dt) {
    const f = this.flip, g = this.game;
    f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    const m = f.mesh;
    m.position.lerpVectors(f.from, f.to, k);
    m.position.y += Math.sin(Math.PI * k) * 2.6;
    m.rotation.set(0, Math.atan2(f.to.x - f.from.x, f.to.z - f.from.z) - Math.PI / 2, k * Math.PI * 4);
    const pop = k > 0.85 ? 1 + (k - 0.85) * 2 : 1;
    m.scale.setScalar((m.userData.base ??= m.scale.x) * pop);
    if (k >= 1) {
      g.engine.scene.remove(m);
      this.flip = null;
      if (f.bite.kind !== 'junk') g.juice?.landed();
      g.juice?.hit({ stop: 0.05, shake: 0.15, zoom: 0.94 });
      g.onLanded(f.bite, f.ctx).finally(() => { if (this.state === 'landed') this.state = 'idle'; });
    }
  }

  // Bobber state for rendering/network
  bobberState() {
    if (!this.bobber) return null;
    return { x: this.bobber.x, z: this.bobber.z, y: this.bobber.flying ? this.bobber.y : undefined, flying: this.bobber.flying, dunk: this.bobber.dunk || 0 };
  }

  poseName() {
    switch (this.state) {
      case 'charge': return 'charge';
      case 'flying': return 'cast';
      case 'waiting': case 'nibble': return 'wait';
      case 'bite': return 'bite';
      case 'reeling': return 'reel';
      default: return 'idle';
    }
  }
}
