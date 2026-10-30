// Frostmere (map 3): the frozen north. Skye Halloran flies you up from her seaplane base on Frostpine Lake in the Snow
// Goose: a take-off run across the lake, "Above the Clouds" (the flight game, src/north/flight.js) while the north is
// built, and a landing on the Hearthwick ice strip. Coming home is the same in reverse.
//
// Frostmere is a far corner of the same world, west of the valley (src/north/geo.js), plugged into the terrain lookups
// (src/north/hooks.js), so walking, casting, bites and other anglers all work up here.
import * as THREE from 'three';
import { FAR_X, WATER_Y } from '../world/terrain.js';
import { NORTH, ICE_Y, inNorth, toLocal, toWorld, landAt, kindAt, isIce, P, regionOf } from './geo.js';
import { installWestWorld } from './hooks.js';
import { NorthWorld } from './world.js';
import { Hearthwick, SAUNA_HOLE } from './hearthwick.js';
import { buildAlpine } from './alpine.js';
import { SeaMonster } from './seamonster.js';
import { Snowmobile, toggleRide, SNO } from './sno.js';
import { Expeditions } from './expeditions.js';
import { Resort } from './resort.js';
import { Lifts } from './lifts.js';
import { Wilds } from './wilds.js';
import { Villagers, NPC_HOLES } from './villagers.js';
import { IceFishing, ICE_GEAR } from './ice.js';
import { Warmth } from './warmth.js';
import { Shanty } from './shanty.js';
import { Skates } from './skates.js';
import { Sleds } from './sleds.js';
import { Races, JUNE_TIME } from './races.js';
import { Snowballs } from './snowballs.js';
import { Tracks } from './tracks.js';
import { Fauna, NORTH_GUIDE, GUIDE_SETS_NORTH } from './fauna.js';
import { Wild, LOG_PAGES } from './wild.js';
import { NorthSky } from './sky.js';
import { openShop } from './shop.js';
import { Lodge } from './lodge.js';
import { addCircle } from '../world/colliders.js';
import { NorthQuests } from './quests.js';
import { northSfx } from './sounds.js';
import { ITEMS } from '../data/items.js';
import { Boards, derbyFish } from './boards.js';
import { SLED_ROUTES, TAXI_IN, TAXI_OUT } from './geo.js';
import { Airbases, BASE, STRIP } from './base.js';
import { FlightGame } from './flight.js';
import { AirRaces } from '../air/airraces.js';
import { SnowGoose } from './plane.js';
import { h } from '../ui/dom.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { catchValue } from '../game/rules.js';
import './north.css';

export const FM = {
  LEVEL: 25,
  FARE: 200, // coins per flight (the first flight north, and every flight home, is free)
};

/** A plane's flight path: a smooth curve through points, with a speed (m/s) at each point. */
// v1.17.1: how hard the plane may speed up and slow down (m/s a second), the sideways push it takes in a turn, and how
// fast it swings round on the spot at the end (radians a second)
const PLANE = { up: 4.5, down: 3.5, side: 3, pivot: 0.5 };
const blur = (a, passes) => { for (let n = 0; n < passes; n++) { let prev = a[0]; for (let i = 1; i < a.length - 1; i++) { const c = a[i]; a[i] = (prev + c * 2 + a[i + 1]) / 4; prev = c; } } return a; };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** The plane's way: the control points [x, y, z, speed] drawn through as a curve, then baked to a point every metre and
 *  evened out, so nothing it follows has a corner: the line, the height (a long flare and climb, not a ramp) and the speed
 *  (slower through a turn, and only ever changing as fast as PLANE says). `from` is the nose's heading when it sets off;
 *  `to` the heading it should end on (it swings round on the spot if the line ends short of it). */
class Path {
  constructor(pts, { from = null, to = null } = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal', 0.5);
    const len0 = curve.getLength(), n = Math.max(8, Math.ceil(len0)), pt = curve.getSpacedPoints(n);
    const lens = curve.getLengths(400), at = pts.map((p, i) => ({ s: lens[Math.round(i / (pts.length - 1) * 400)], v: p[3] }));
    const spec = (s) => { for (let i = 0; i < at.length - 1; i++) if (s <= at[i + 1].s) return at[i].v + (at[i + 1].v - at[i].v) * (s - at[i].s) / Math.max(1e-3, at[i + 1].s - at[i].s); return at[at.length - 1].v; };
    const xs = blur(pt.map((p) => p.x), 40), ys = blur(pt.map((p) => p.y), 260), zs = blur(pt.map((p) => p.z), 40);
    const cnt = xs.length, yaw = new Float64Array(cnt), pitch = new Float64Array(cnt), S = new Float64Array(cnt);
    for (let i = 0; i < cnt; i++) {
      const a = Math.max(0, i - 2), b = Math.min(cnt - 1, i + 2), dx = xs[b] - xs[a], dz = zs[b] - zs[a];
      yaw[i] = Math.atan2(dx, dz); pitch[i] = Math.atan2(ys[b] - ys[a], Math.hypot(dx, dz) || 1);
      if (i) { yaw[i] = yaw[i - 1] + wrap(yaw[i] - yaw[i - 1]); S[i] = S[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1], zs[i] - zs[i - 1]); }
    }
    if (from != null) { const d = wrap(from - yaw[0]); for (let i = 0; i < cnt && S[i] < 12; i++) { const k = 1 - S[i] / 12; yaw[i] += d * k * k * (3 - 2 * k); } } // (the first metres ease off the way the nose was parked)
    blur(yaw, 6);
    const v = new Float64Array(cnt);
    for (let i = 0; i < cnt; i++) {
      const a = Math.max(0, i - 4), b = Math.min(cnt - 1, i + 4), curv = Math.abs(yaw[b] - yaw[a]) / Math.max(1, S[b] - S[a]);
      v[i] = Math.min(spec(S[i] * len0 / Math.max(1, S[cnt - 1])), Math.max(2.5, Math.sqrt(PLANE.side / Math.max(1e-4, curv))));
    }
    if (from != null) v[0] = Math.min(v[0], 1); // (a take-off starts from rest and a landing ends at rest; the other ends are in the air)
    if (to != null) v[cnt - 1] = Math.min(v[cnt - 1], 0.8);
    for (let i = 1; i < cnt; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * PLANE.up * (S[i] - S[i - 1])));
    for (let i = cnt - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * PLANE.down * (S[i + 1] - S[i])));
    blur(v, 30);
    Object.assign(this, { xs, ys, zs, yaw, pitch, S, v, cnt, len: S[cnt - 1], s: 0, i: 0, swing: 0 });
    this.toYaw = to == null ? yaw[cnt - 1] : yaw[cnt - 1] + wrap(to - yaw[cnt - 1]);
    this.swingFor = Math.abs(this.toYaw - yaw[cnt - 1]) / PLANE.pivot;
  }
  /** Sample number and how far on to the next, at distance s. */
  find(s) { let i = this.i; const S = this.S; while (i < this.cnt - 2 && S[i + 1] < s) i++; this.i = i; return [i, Math.min(1, (s - S[i]) / Math.max(1e-3, S[i + 1] - S[i]))]; }
  speed(s) { const [i, k] = this.find(s); return this.v[i] + (this.v[i + 1] - this.v[i]) * k; }
  step(dt) {
    if (this.s < this.len) { this.s = Math.min(this.len, this.s + Math.max(0.4, this.speed(this.s)) * dt); return false; }
    this.swing += dt; return this.swing >= this.swingFor;
  }
  pose() {
    const [i, k] = this.find(this.s), mix = (a) => a[i] + (a[i + 1] - a[i]) * k;
    let yaw = mix(this.yaw);
    if (this.s >= this.len && this.swingFor > 0) { const t = Math.min(1, this.swing / this.swingFor); yaw += (this.toYaw - this.yaw[this.cnt - 1]) * t * t * (3 - 2 * t); }
    return { p: new THREE.Vector3(mix(this.xs), mix(this.ys), mix(this.zs)), yaw, pitch: mix(this.pitch), v: this.s >= this.len ? 0 : this.speed(this.s) };
  }
}

/** The Snow Goose's engine: a low radial-engine drone that rises with the throttle (Web Audio). */
export class EngineSound {
  constructor(audio) {
    this.audio = audio; this.on = false;
  }
  start() {
    const A = this.audio, ctx = A?.ctx;
    if (!ctx || this.on) return;
    this.on = true;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(A.bus?.sfx || ctx.destination);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.connect(out);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 38;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 76.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9; const lg = ctx.createGain(); lg.gain.value = 0.25; lfo.connect(lg); lg.connect(out.gain);
    o1.connect(lp); o2.connect(g2); g2.connect(lp);
    o1.start(); o2.start(); lfo.start();
    this.n = { out, lp, o1, o2, lfo };
  }
  set(throttle) {
    const n = this.n; if (!n) return;
    const t = n.o1.context.currentTime;
    n.o1.frequency.setTargetAtTime(38 + throttle * 34, t, 0.25);
    n.o2.frequency.setTargetAtTime(76.5 + throttle * 69, t, 0.25);
    n.lp.frequency.setTargetAtTime(300 + throttle * 900, t, 0.3);
    n.out.gain.setTargetAtTime(0.035 + throttle * 0.09, t, 0.3);
  }
  stop() {
    const n = this.n; if (!n) return;
    const t = n.o1.context.currentTime;
    n.out.gain.setTargetAtTime(0, t, 0.4);
    setTimeout(() => { try { n.o1.stop(); n.o2.stop(); n.lfo.stop(); n.out.disconnect(); } catch { /* already stopped */ } }, 2000);
    this.n = null; this.on = false;
  }
}

export class Frostmere {
  constructor(game) {
    this.game = game;
    const scene = game.engine.scene;
    this.holes = []; // (src/north/ice.js fills these in; the hooks ask holeAt)
    installWestWorld({ holeAt: (x, z) => this.holeAt(x, z), floorAt: (x, z) => this.floorAt(x, z), deckAt: (x, z) => this.lodge?.floorAt(x, z) ?? (this.village ? this.village.floorAt(x, z) : null), hallAt: (x, z) => this.lodge?.floorAt(x, z) != null });
    this.world = new NorthWorld(scene);
    this.bases = new Airbases(game);
    this.trip = null;
    this.engine = new EngineSound(game.audio);
    this.northPlane = null; // the strip's copy of the plane, built with the north
    // the camera up here: never below the ground (or the ice)
    const prev = game.engine.camFloor;
    game.engine.camFloor = (x, z) => (x < -FAR_X ? this.camFloor(x, z) : prev ? prev(x, z) : WATER_Y + 1.2);
  }

  init() {
    const g = this.game;
    g.ext.change((d) => { d.north = { flights: 0, firstFree: true, best: 0, stars: 0, unlocked: 0, gear: {}, holes: 0, ...(d.north || {}) }; });
    this.ice = new IceFishing(this);
    this.warmth = new Warmth(this);
    this.shanty = new Shanty(this);
    this.skate = new Skates(this);
    this.sleds = new Sleds(this);
    this.races = new Races(this);
    this.snowballs = new Snowballs(this);
    this.boards = new Boards(this);
    this.tracks = new Tracks(this);
    this.fauna = new Fauna(this);
    this.wild = new Wild(this);
    this.sky = new NorthSky(this);
    this.lodge = new Lodge(this);
    this.quests = new NorthQuests(this);
    this.air = new AirRaces(this); this.air.init();
    this.sno = new Snowmobile(this); this.expeditions = new Expeditions(this); this.resort = new Resort(this); this.lifts = new Lifts(this); this.wilds = new Wilds(this);
    this.checkUnlock(true);
    const q = new URLSearchParams(location.search);
    // dev and browser tests: ?north flies you straight up (level 25 for this session); ?north=quick skips the flight
    if (import.meta.env.DEV && q.has('north')) setTimeout(() => this.debugFly(q.get('north')), 800);
    if (import.meta.env.DEV && q.has('aurora')) this.sky.force = true; // (dev and tests: tonight's an aurora night)
  }
  async debugFly(mode) {
    const g = this.game;
    if (g.profile.level < FM.LEVEL) g.profile.level = FM.LEVEL;
    if (mode === 'quick') { await this.world.build(); this.onNorthBuilt(); this.arrive(); return; }
    this.board('north');
  }
  get d() { return this.game.ext.d.north || {}; }
  get here() { return this.game.player.pos.x < -FAR_X; }
  get level() { return this.game.profile.level; }

  checkUnlock(quiet = false) {
    const g = this.game;
    if (this.level < FM.LEVEL || this.d.unlocked) return;
    g.ext.change((d) => { d.north.unlocked = Date.now(); });
    if (quiet && g.profile.level > FM.LEVEL) return;
    g.ui.toast('Skye Halloran will fly you north to Frostmere. Her seaplane base is on the east shore of Frostpine Lake.', { icon: 'star', title: 'Frostmere', ms: 8000 });
    g.chat.system('Journal: Skye Halloran, the bush pilot, flies to Frostmere, the frozen north. Find her seaplane base at the end of the Frostpine trail, on the lake\'s east shore.', 'level', { popup: true });
    g.audio.sfx('achievement');
  }

  // ---------------------------------------------------------------- terrain helpers
  /** Tell the ice where every hole is (the fixed ones, then everyone's drilled holes). */
  refreshHoles() { this.holes = [...(this.fixedHoles || []), ...(this.shantyHole ? [this.shantyHole] : []), ...(this.ice?.drilledHoles() || [])]; this.world.setHoles(this.holes); }
  holeAt(x, z) { for (const h of this.holes) if ((h.x - x) ** 2 + (h.z - z) ** 2 < h.r * h.r) return h; return null; }
  floorAt(x, z) { return this.expeditions?.floorAt(x, z) ?? this.shanty?.floorAt(x, z) ?? this.wild?.caves?.floorAt(x, z) ?? this.lodge?.floorAt(x, z) ?? (this.village ? this.village.floorAt(x, z) : null); } // (porches, and the lodge's hall)
  groundAt(x, z) { if (!inNorth(x, z)) return null; const [u, v] = toLocal(x, z); return isIce(kindAt(u, v)) ? ICE_Y : landAt(u, v); }
  camFloor(x, z) { const cf = this.wild?.caves?.camFloor(x, z); if (cf != null) return cf; const gy = this.groundAt(x, z); return Math.max(gy ?? WATER_Y, WATER_Y) + 0.9; }

  // ---------------------------------------------------------------- talking to Skye
  talkSkye(north = false) {
    const g = this.game, S = north ? this.bases.northSkye : this.bases.skye;
    if (!north && this.level < FM.LEVEL) {
      g.dialogue.open({ npc: S, title: 'Bush pilot', text: `Skye Halloran, Frostpine Air. I fly the Snow Goose up to Frostmere, way up north where the lakes freeze solid and the fish come up through the ice. Come and see me at level ${FM.LEVEL} and I'll take you.`, choices: [{ label: 'I\'ll be back' }] });
      return;
    }
    if (north) {
      g.dialogue.open({ npc: S, title: 'Bush pilot', text: 'Ready to head south? The flight home\'s on me. Say the word and I\'ll warm her up. Or fancy a race? My air race board\'s open.', choices: [
        { label: 'Fly me home', primary: true, fn: () => this.board('home') },
        { label: 'Skye\'s Air Races', fn: () => setTimeout(() => this.air.open(S), 200) },
        { label: 'Not yet' },
      ] });
      return;
    }
    const free = this.d.firstFree;
    const text = free
      ? 'You must be the angler everyone\'s talking about! First flight north is on me, and so is a parka: nobody flies to Frostmere in a t-shirt. Lakes frozen a metre thick, fish under the ice, and the northern lights at night. Hop in!'
      : `Back for more of the north? It's ${FM.FARE} coins up, and the ride home's free. Mind the storm clouds on the way.`;
    g.dialogue.open({ npc: S, title: 'Bush pilot', text, choices: [
      { label: free ? 'Fly me north!' : `Fly north (${FM.FARE} coins)`, primary: true, fn: () => this.payAndBoard() },
      { label: 'What\'s up there?', fn: () => setTimeout(() => this.lore(), 250) },
      ...(this.air?.unlocked ? [{ label: 'Skye\'s Air Races', fn: () => setTimeout(() => this.air.open(S), 200) }] : []),
      { label: 'Maybe later' },
    ] });
  }
  lore() {
    const g = this.game;
    g.dialogue.open({ npc: this.bases.skye, title: 'Bush pilot', text: 'Hearthwick, the friendliest village on the ice. You drill a hole, you drop a jig, you watch the flasher. Lake trout as long as your arm, sheefish in the river, and out at the floe edge, things I won\'t mention. The kennels, the sauna, the skating... and if you\'re lucky, the aurora.', choices: [{ label: 'Fly me north!', primary: true, fn: () => this.payAndBoard() }, { label: 'Sounds cold' }] });
  }
  async payAndBoard() {
    const g = this.game;
    if (!this.d.firstFree) {
      if (g.profile.coins < FM.FARE) { g.ui.toast(`A flight north is ${FM.FARE} coins. You have ${g.profile.coins.toLocaleString()}.`, { icon: 'coin' }); return; }
      const r = await g.save.spend('flight', `fly${Date.now()}`, { coins: FM.FARE });
      if (!r?.ok) { g.ui.toast(r?.reason || 'Not enough coins.', { icon: 'coin' }); return; }
      g.audio.sfx('coin'); g.ui.refresh?.();
    }
    this.board('north');
  }

  // ---------------------------------------------------------------- the trip
  /** Board the plane and go: dir 'north' (from the valley) or 'home' (from the strip). */
  board(dir) {
    const g = this.game;
    if (this.trip) return;
    if (g.fishing.busy) g.fishing.cancel();
    if (g.chairs.seat) g.chairs.stand();
    if (g.bikes?.riding) g.bikes.dismount();
    if (g.player.mode !== 'shore') { g.player.mode = 'shore'; g.actor.setMode('shore'); }
    g.ui.closeAll?.();
    const phase = g.engine.sky.state?.phase || 'day';
    this.trip = { dir, stage: 'taxi', t: 0, phase, path: null, flight: null, result: null };
    if (dir === 'north') this.world.build(); // (start building the north now: it carries on through the flight)
    g.player.target = null;
    this.hidePlayer(true);
    this.engine.start();
    g.audio.sfx('creak');
    g.chat.npcSay?.('Skye Halloran', dir === 'north' ? 'Buckle up! Next stop, Frostmere.' : 'Homeward bound. Wave goodbye to the ice!');
    this.startTaxi();
  }
  hidePlayer(on) {
    const g = this.game;
    g.actor.root.visible = !on;
    this.hidden = on;
  }
  /** The take-off: from the valley's mooring (taxi out, a run south across Frostpine, lift off over the south shore), or
   *  from the Hearthwick strip (a run west along the strip). */
  startTaxi() {
    const T = this.trip;
    if (T.dir === 'north') {
      const M = BASE.mooring, y = WATER_Y - 0.3;
      T.plane = this.bases.plane; this.bases.atMooring = false;
      T.path = new Path([
        // (nose west off the mooring, up the east side of the lake, round a wide loop clear of the leviathan's bones, and off to the south)
        [M.x, y, M.z, 2], [-95, y, -146, 5], [-101, y, -153, 6], [-101, y, -163, 7], [-105, y, -172, 7], [-112, y, -177, 7], [-120, y, -172, 8], [-122, y, -160, 12], [-118, y, -145, 22], [-114, y, -128, 29], [-112, y + 0.6, -110, 31], [-112, 6, -92, 32], [-111, 18, -66, 34], [-110, 34, -36, 36],
      ], { from: M.yaw });
      T.water = true;
    } else {
      const S = STRIP.park, y = ICE_Y - 0.02;
      T.plane = this.northPlane;
      const [a, b, c] = TAXI_OUT.slice(1).map(([u, v]) => toWorld(u, v)), d = toWorld(-60, 60), e = toWorld(-110, 60), f = toWorld(-150, 58), gg = toWorld(-200, 52), hh = toWorld(-250, 45);
      T.path = new Path([[S.x, y, S.z, 2], [a.x, y, a.z, 6], [b.x, y, b.z, 8], [c.x, y, c.z, 14], [d.x, y, d.z, 26], [e.x, y + 0.6, e.z, 31], [f.x, 6, f.z, 33], [gg.x, 20, gg.z, 35], [hh.x, 38, hh.z, 36]], { from: S.yaw });
      T.water = false;
    }
    T.stage = 'taxi'; T.t = 0; T.lastYaw = T.tilt = T.swing = null; T.bank = 0;
  }
  /** The landing: up north, an approach from the west onto the strip and a roll-out to the hangar; at home, an
   *  approach from the south onto Frostpine and a taxi back to the dock. */
  startLanding() {
    const T = this.trip, g = this.game;
    if (T.dir === 'north') {
      this.onNorthBuilt();
      const y = ICE_Y - 0.02, pk = STRIP.park;
      T.plane = this.northPlane; T.plane.group.visible = true;
      const p0 = toWorld(-330, 66), p1 = toWorld(-230, 62), p2 = toWorld(-150, 60), p3 = toWorld(-90, 60), p4 = toWorld(-20, 60), [p5, p6] = TAXI_IN.slice(0, 2).map(([u, v]) => toWorld(u, v));
      T.path = new Path([[p0.x, 78, p0.z, 36], [p1.x, 36, p1.z, 31], [p2.x, y + 0.4, p2.z, 26], [p3.x, y, p3.z, 18], [p4.x, y, p4.z, 9], [p5.x, y, p5.z, 5], [p6.x, y, p6.z, 3], [pk.x, y, pk.z, 1]], { to: pk.yaw }); // (it swings round on the spot to park nose north)
      T.water = false;
    } else {
      const y = WATER_Y - 0.3, M = BASE.mooring;
      T.plane = this.bases.plane; T.plane.group.visible = true; this.bases.atMooring = false; // (or the mooring's bob pins it at the dock while the camera follows the approach)
      // (down onto the lake, along the south of the dock, and a slow U-turn in the bay to come alongside nose west)
      T.path = new Path([[-112, 40, -16, 34], [-112, 20, -58, 30], [-112, y + 0.5, -102, 25], [-112, y, -128, 15], [-111, y, -146, 8], [-103, y, -156, 5], [-93, y, -156.5, 4], [-85.5, y, -155, 3], [-82.8, y, -150.3, 2.5], [-85.5, y, -146, 2.5], [M.x, y, M.z, 1]], { to: M.yaw });
      T.water = true;
    }
    T.stage = 'land'; T.t = 0; T.look = T.wrote = T.lastYaw = T.tilt = T.swing = null; T.bank = 0; // (the landing starts from the chase view, whatever angle you took off with)
    this.engine.start();
    g.ui.toast(T.dir === 'north' ? 'Frostmere! Skye brings the Snow Goose down onto the ice.' : 'Frostpine Lake below. Skye sets her down on the water.', { icon: 'star', ms: 4000 });
  }
  onNorthBuilt() {
    if (this.northPlane) return;
    this.bases.buildNorth(this.world);
    this.village = new Hearthwick(this.game, this.world); this.village.build();
    this.villagers = new Villagers(this.game, this); this.villagers.build();
    // the holes that are always open: the shanty regulars' and the sauna's plunge hole
    const sp = toWorld(SAUNA_HOLE.u, SAUNA_HOLE.v);
    this.fixedHoles = [...NPC_HOLES, { x: sp.x, z: sp.z, r: 1.1, plunge: true }];
    this.refreshHoles();
    this.races.build(this.world.group);
    this.tracks.attach(this.world.group);
    this.wild.build(this.world.group);
    this.fauna.build(this.world.group);
    this.alpine = buildAlpine(this.world.group, this.village); // v1.17.1: the Polyfork props (src/north/alpine.js), after everything solid
    this.expeditions.build(this.world.group); this.resort.build(this.world.group); this.lifts.build(this.world.group); this.wilds.build(this.world.group); void this.sno.mesh; this.builtExtras = true; // v1.17.2
    this.monster = new SeaMonster(this.world.group); // v1.17.1: something far out past the floe edge
    this.boards.watch();
    this.northPlane = new SnowGoose();
    this.world.group.add(this.northPlane.group);
    this.parkNorthPlane();
  }
  parkNorthPlane() {
    const S = STRIP.park;
    this.northPlane.group.position.set(S.x, ICE_Y - 0.02, S.z); this.northPlane.group.rotation.set(0, S.yaw, 0);
    // v1.16.2: the parked plane is solid: its floats (skis), the fuselage between them and the tail
    if (!this.planeSolid) {
      this.planeSolid = true;
      const along = (a, side) => ({ x: S.x + Math.sin(S.yaw) * a + Math.cos(S.yaw) * side, z: S.z + Math.cos(S.yaw) * a - Math.sin(S.yaw) * side });
      for (let a = -4.5; a <= 3; a += 0.9) for (const sd of [-1.38, 0, 1.38]) { if (sd === 0 && a > 2) continue; const p = along(a, sd); addCircle(p.x, p.z, sd ? 0.42 : 0.6); }
    }
  }

  /** Drive the plane along the trip's path; spray, engine, camera. Returns true while the trip has the controls. */
  stepTrip(dt, t) {
    const T = this.trip, g = this.game;
    if (!T) return false;
    T.t += dt;
    if (T.stage === 'fly') return true; // (the flight game is drawn instead of the lake)
    const done = T.path.step(dt);
    const { p, yaw, pitch, v } = T.path.pose();
    const pl = T.plane;
    // bank into turns (from the change in heading), lift the nose on the take-off run
    const dyaw = Math.atan2(Math.sin(yaw - (T.lastYaw ?? yaw)), Math.cos(yaw - (T.lastYaw ?? yaw))) / Math.max(dt, 1e-3);
    T.lastYaw = yaw;
    T.bank = (T.bank || 0) + (Math.max(-0.5, Math.min(0.5, -dyaw * 0.7)) - (T.bank || 0)) * Math.min(1, dt * 2);
    // never below the surface: the curve through a steep approach dips under its points (through the ice), and
    // the ground under the approach can be higher than the path
    const floor = T.water ? WATER_Y - 0.3 : (inNorth(p.x, p.z) ? Math.max(ICE_Y - 0.02, (this.groundAt(p.x, p.z) ?? ICE_Y) - 0.02) : ICE_Y - 0.02);
    if (p.y < floor) p.y = floor;
    // how much it's on the surface: 1 down to 0 over the first 2 m of air, so nothing snaps on lift-off or touchdown
    const air = Math.min(1, Math.max(0, p.y - floor) / 2), ground = 1 - air * air * (3 - 2 * air), onSurface = ground > 0.9;
    const rotate = ground * Math.max(0, Math.min(0.14, (v - 20) * 0.02)); // (the nose lifts on the run, and flares for the touchdown)
    const tilt = (1 - ground) * -pitch + ground * Math.min(0, -pitch) - rotate;
    T.tilt = T.tilt == null ? tilt : T.tilt + (tilt - T.tilt) * Math.min(1, dt * 3);
    pl.group.position.copy(p);
    pl.group.rotation.order = 'YXZ';
    pl.group.rotation.set(T.tilt + (onSurface ? Math.sin(t * 9) * 0.002 * v / 10 : 0), yaw, T.bank * (0.15 + 0.85 * (1 - ground)));
    const throttle = T.stage === 'land' ? (v > 10 ? 0.4 : 0.15) : v > 6 ? 1 : 0.35;
    pl.animate(dt, { throttle, roll: -T.bank, pitch: rotate ? 0.6 : 0, yaw: dyaw * 0.3 });
    this.engine.set(pl.rpm);
    // spray off the floats (water) or snow off the skis (ice) while running fast on the surface
    if (onSurface && v > 5 && Math.random() < dt * 30 * Math.min(1, v / 20)) {
      for (const s of [-1, 1]) {
        const lx = s * 1.38, lz = -1.5, cx = Math.cos(yaw), sx = Math.sin(yaw);
        const x = p.x + lx * cx + lz * sx, z = p.z - lx * sx + lz * cx;
        const back = { x: -sx, z: -cx }, side = { x: cx * s, z: -sx * s };
        g.fx.spawn(x, p.y + 0.3, z, back.x * v * 0.12 + side.x * 2 * Math.random(), 1.2 + Math.random() * 1.8, back.z * v * 0.12 + side.z * 2 * Math.random(), T.water ? '#e8f6ff' : '#f6faff', T.water ? 0.7 : 1.2, T.water ? -6 : -2.5, 0.3);
      }
    }
    // the camera: a chase view behind and above, swinging round to the side on the ground. v1.17.1: drag (or the
    // right stick, or the wheel to zoom) to look round the plane; from then on the view keeps your angle, turning
    // with the plane, until the trip ends.
    const cam = g.engine.camera, c = g.engine.cam;
    const behind = 22 - 7 * ground, up = 7 - 2 * ground; // (closer in on the surface)
    const wantSwing = T.stage === 'taxi' && T.t < 5 ? 1.2 : 0.35; // (round to the side at the start, easing in behind)
    const swing = T.swing = T.swing == null ? wantSwing : T.swing + (wantSwing - T.swing) * Math.min(1, dt * 0.8);
    if (T.wrote) {
      const dy = c.yaw - T.wrote.yaw, dp = c.pitch - T.wrote.pitch;
      if (!T.look && (Math.abs(dy) > 1e-5 || Math.abs(dp) > 1e-5 || Math.abs(c.zoom - T.wrote.zoom) > 1e-5)) T.look = { off: T.wrote.off, pitch: T.wrote.pitch };
      if (T.look) { T.look.off += dy; T.look.pitch = Math.max(0.02, Math.min(1.2, T.look.pitch + dp)); }
    }
    const off = T.look ? T.look.off : swing, ang = T.look ? T.look.pitch : Math.atan2(up, behind);
    const dist = Math.hypot(behind, up) * (T.look ? c.zoom : 1), cy = yaw + Math.PI + off;
    const want = new THREE.Vector3(p.x + Math.sin(cy) * Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, p.z + Math.cos(cy) * Math.cos(ang) * dist);
    c.yaw = cy; c.pitch = ang;
    T.wrote = { yaw: cy, pitch: ang, zoom: c.zoom, off };
    const fl = g.engine.camFloor ? g.engine.camFloor(want.x, want.z) : 0; want.y = Math.max(want.y, fl + 1.5);
    if (!T.camInit) { cam.position.copy(want); T.camInit = true; }
    cam.position.lerp(want, Math.min(1, dt * (T.look ? 8 : 2.5))); // (your own angle follows your drag closely)
    cam.lookAt(p.x, p.y + 2.5, p.z);
    // keep the (hidden) angler with the plane, so the sky, sound and other systems follow along
    g.player.pos.set(p.x, p.y + 2, p.z); g.player.baseY = g.player.pos.y;
    g.engine.cam.target.set(p.x, p.y + 2.8, p.z);
    // the take-off ends in cloud: a white fade, then the flight game
    if (T.stage === 'taxi' && p.y > (T.water ? 14 : 16)) this.toClouds();
    if (T.stage === 'land' && done) this.disembark();
    return true;
  }
  toClouds() {
    const T = this.trip, g = this.game;
    T.stage = 'fly';
    const fade = h('div.travel-fade.north-white'); g.ui.root.append(fade);
    setTimeout(() => {
      T.plane.group.visible = false; // (into the cloud: the flight game's own plane takes over)
      const ready = () => (T.dir === 'north' ? this.world.built : true);
      T.flight = new FlightGame(g, { phase: T.phase === 'dusk' || T.phase === 'dawn' ? 'dusk' : T.phase === 'night' ? 'night' : 'day', towards: T.dir, minTime: 20, ready, onDone: (r) => this.landFrom(r) });
      g.engine.overlay = T.flight;
      this.engine.set(0.8);
    }, 450);
    setTimeout(() => fade.remove(), 1200);
  }
  landFrom(result) {
    const T = this.trip, g = this.game;
    T.result = result;
    const fade = h('div.travel-fade.north-white'); g.ui.root.append(fade);
    setTimeout(() => {
      g.engine.overlay = null;
      // each end's plane back where it lives: the valley's at its mooring, the north's on the strip
      if (T.dir === 'north') { this.world.setVisible(true); this.bases.moor(); this.bases.plane.group.visible = true; }
      else { this.world.setVisible(false); if (this.northPlane) { this.parkNorthPlane(); this.northPlane.group.visible = true; } }
      T.camInit = false;
      this.startLanding();
      this.recordFlight(result);
    }, 400);
    setTimeout(() => fade.remove(), 1300);
  }
  recordFlight(r) {
    const g = this.game;
    if (!r || r.skipped) return;
    const best = this.d.best || 0;
    g.ext.change((d) => { d.north.best = Math.max(d.north.best || 0, r.score); d.north.stars = Math.max(d.north.stars || 0, r.stars); });
    const stars = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
    g.chat.system(`Above the Clouds: ${r.score} points, ${r.rings}/${r.gates} rings ${stars}${r.score > best ? ' (a new best!)' : ''}`, 'info', { popup: true });
    if (r.stars >= 3) {
      g.ext.bump?.('flight3'); this.onEvent('flight3');
      if (!(g.profile.owned || []).includes('hat_aviator')) g.reward('north', 'aviator', { item: 'hat_aviator' }, 'Three stars! Skye gives you her old Aviator Cap');
    }
    this.boards?.post('flight', r.score);
  }
  disembark() {
    const T = this.trip, g = this.game;
    this.engine.stop();
    const fade = h('div.travel-fade'); g.ui.root.append(fade); setTimeout(() => fade.remove(), 900);
    if (T.dir === 'north') {
      this.parkNorthPlane();
      const E = STRIP.exit;
      g.player.pos.set(E.x, ICE_Y, E.z); g.player.baseY = ICE_Y; g.player.yaw = Math.PI * 0.85;
      g.engine.cam.target.set(E.x, ICE_Y + 0.8, E.z); g.engine.cam.yaw = Math.PI * 0.2;
      g.ext.change((d) => { d.north.flights = (d.north.flights || 0) + 1; d.north.firstFree = false; });
      g.ui.toast('Welcome to Frostmere! Hearthwick is just up the shore. Mind the thin ice.', { title: 'Frostmere', icon: 'star', ms: 6500 });
      this.welcome();
      g.chat.npcSay?.('Skye Halloran', 'Here we are! I\'ll be by the hangar when you want to go home.');
    } else {
      this.bases.moor();
      const D = BASE.dock;
      g.player.pos.set(D.x - 6, D.y, D.z + 0.6); g.player.baseY = D.y; g.player.yaw = Math.PI / 2;
      g.engine.cam.target.set(D.x - 6, D.y + 0.8, D.z + 0.6); g.engine.cam.yaw = -Math.PI / 2;
      g.ui.toast('Back at Frostpine. Thanks for flying with Skye!', { icon: 'star', ms: 4000 });
    }
    this.hidePlayer(false);
    this.trip = null;
    g.pushMeta?.();
  }
  /** Your first time up here: Skye's parka (yours to keep) and Astrid's quest. */
  welcome() {
    const g = this.game;
    if (!this.quests.state('arrive')) setTimeout(() => this.quests.start('arrive'), 2500);
    setTimeout(() => this.warmth.showHelp(), 3500);
    if (!(g.profile.owned || []).includes('shirt_parka')) {
      g.save.grant('north', 'parka', { item: 'shirt_parka' }).then(() => { g.ui.refresh?.(); g.ui.toast('Skye hands you her spare Expedition Parka: "Nobody flies north in a t-shirt. Keep it." (Put it on in your wardrobe: it keeps you much warmer.)', { title: 'Expedition Parka', icon: 'star', ms: 8000 }); });
    }
  }
  /** Straight to the strip (tests, and the "quick" dev flag). */
  arrive() {
    this.onNorthBuilt();
    this.world.setVisible(true);
    setTimeout(() => this.welcome(), 500);
    const E = STRIP.exit, g = this.game;
    g.player.pos.set(E.x, ICE_Y, E.z); g.player.baseY = ICE_Y; g.player.target = null;
    g.engine.cam.target.set(E.x, ICE_Y + 0.8, E.z);
  }

  // ---------------------------------------------------------------- hooks the rest of the game calls
  /** Before the player moves. */
  preUpdate(dt) { void dt; }
  /** True while something up here has the controls (the trip). */
  control(dt, t) { return this.air?.racing || this.stepTrip(dt, t) || this.sleds.control(dt) || this.sno?.control(dt) || this.lifts?.control() || this.resort?.control(dt) || this.expeditions?.control(); }
  /** True while the trip owns the camera. */
  camera() { return !!this.trip && this.trip.stage !== 'fly'; }
  update(dt, t) {
    const g = this.game, here = this.here;
    this.air?.update(dt);
    this.world.setVisible(here || (this.trip?.dir === 'north' && this.trip.stage === 'land') || (this.trip?.dir === 'home' && this.trip.stage === 'taxi'));
    this.world.update(dt, t, g.engine.camera.position);
    if (here && this.monster) { const w = g.engine.sky.state?.weather; this.monster.update(dt, t, g.player.pos, g.engine.scene.fog, w === 'storm' || w === 'rain' || w === 'overcast'); }
    this.bases.update(dt, t, { north: here });
    if (here && this.village) this.village.update(dt, t, g.player.pos);
    const ph = g.engine.sky.state?.phase;
    if (here && this.village && ph !== this.lastPhase && (ph === 'dawn' || ph === 'dusk') && this.lastPhase) { northSfx(g.audio, 'bell', { vol: 0.8 }); g.chat?.system?.(`The Hearthwick bell rings for ${ph}.`, 'info'); }
    this.lastPhase = ph;
    this.questT = (this.questT || 0) - dt;
    if (this.questT <= 0 && this.village) { this.questT = 1; this.quests.tick(); }
    if (this.ice && this.village) {
      this.ice.update(dt); this.warmth.update(dt); this.shanty.update();
      this.fauna.update(dt, t); this.wild.update(dt, t);
      if (this.builtExtras && here) { this.expeditions.update(dt, t); this.resort.update(dt, t); this.lifts.update(dt); this.wilds.update(dt, t); this.sno.update(dt); }
      this.skate.update(dt); this.tracks.update(dt); this.sleds.update(dt); this.races.update(dt, t); this.snowballs.update(dt); this.lodge.update(dt, t);
    }
    if (here) { this.northSky(g.engine.sky); this.northLight(g.engine.sky); }
    this.sky.update(dt, t);
    // the camera sees further up here (the far peaks); back to the lake's own range when you leave
    const cam = g.engine.camera, wantFar = here ? 820 : 520;
    if (cam.far !== wantFar && !(g.ocean?.deep?.town?.inside)) { cam.far = wantFar; cam.updateProjectionMatrix(); }
    this.unlockT = (this.unlockT || 0) - dt;
    if (this.unlockT <= 0) { this.unlockT = 3; this.checkUnlock(); }
  }
  /** Up north the light bounces off the snow: a cooler sun, a pale sky light and a bright ground bounce. */
  northLight(sky) {
    const night = sky.night || 0;
    sky.hemi.color.lerp(this._c1 || (this._c1 = new THREE.Color('#d6e6f4')), 0.55 * (1 - night));
    sky.hemi.groundColor.set(night > 0.5 ? '#2a3448' : '#c4d2e0');
    sky.hemi.intensity *= 1.75; // (snow country is bright: the snow throws the light back up)
    sky.sun.intensity *= 1.3;
    sky.sun.color.lerp(this._c2 || (this._c2 = new THREE.Color('#f4f0ec')), 0.5);
  }
  /** Up north the air is cold and clear: a pale fog that closes in when it snows. */
  northSky(sky) {
    const f = sky.scene.fog, w = sky.state?.weather;
    const far = w === 'storm' ? 120 : w === 'rain' ? 200 : w === 'overcast' ? 420 : 760;
    f.near = w === 'storm' ? 15 : w === 'rain' ? 40 : 170; f.far = far;
    if (w === 'storm' || w === 'rain') { const c = this._white || (this._white = new THREE.Color('#e6edf3')); f.color.lerp(c, (w === 'storm' ? 0.75 : 0.4) * (1 - (sky.night || 0) * 0.7)); sky.scene.background?.isColor && sky.scene.background.copy(f.color); } // (a whiteout)
  }
  contextActions() {
    const g = this.game, p = g.player.pos, out = [];
    if (this.trip) return out;
    const near = (s, r = 3.2) => s && Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < r && Math.abs(s.pos.y - p.y) < 2.5;
    if (near(this.bases.skye)) out.push({ id: 'skye', label: 'Talk to Skye', color: 'gold', at: { x: this.bases.skye.pos.x, z: this.bases.skye.pos.z, y: this.bases.skye.pos.y, h: 2.4 }, fn: () => this.talkSkye(false) });
    if (this.here && this.shanty?.inside) return this.shanty.contextActions();
    if (this.here && this.lodge?.inside) return this.lodge.contextActions();
    if (this.here) out.push(...(this.lodge?.contextActions() || []));
    if (this.sleds?.riding) return this.sleds.contextActions();
    if (this.sno?.on) return this.sno.contextActions();
    if (this.here && this.builtExtras && (this.expeditions.soak || this.expeditions.aboard)) return this.expeditions.contextActions();
    if (this.here && this.village) out.push(...this.wildActions(), ...this.boardActions());
    if (this.here && this.builtExtras) out.push(...this.lifts.contextActions(), ...this.expeditions.contextActions(), ...this.resort.contextActions(), ...this.wilds.contextActions());
    if (this.here && this.village) out.push(...this.shanty.contextActions(), ...this.warmth.contextActions());
    if (this.here && this.ice) out.push(...this.ice.contextActions());
    if (this.here && this.villagers) out.push(...this.villagers.contextActions());
    if (this.here && near(this.bases.northSkye)) out.push({ id: 'skye-north', label: 'Talk to Skye', color: 'gold', at: { x: this.bases.northSkye.pos.x, z: this.bases.northSkye.pos.z, y: this.bases.northSkye.pos.y, h: 2.4 }, fn: () => this.talkSkye(true) });
    if (this.here && this.village) out.push(...this.skate.contextActions()); // (last: lacing up never hides anything else)
    return out;
  }
  canCast() { return !this.trip && !this.ice?.drill; }
  /** The fishing button, before fishing sees it (drilling). */
  primary(down) { return this.here && (!!this.lodge?.primary(down) || !!this.ice?.primary(down)); }
  /** Up north the fishing context knows about the aurora (src/north/sky.js) and your shanty. */
  ctxExtra(c) { c.aurora = !!this.sky?.auroraOn; c.great = !!this.wilds?.great; c.shanty = !!this.shanty?.inside; c.north = true; if (this.game.fishing.tipup) c.noJunk = true; return c; } // (a tip-up's flag means a fish took the bait)
  /** Extra choices when you talk to someone in Hearthwick: Pell's shop, and so on. */
  talkChoices(n) {
    const g = this.game, out = [...(this.quests?.talkChoices(n) || [])];
    if (n.talk === 'pell') {
      const gear = this.d.gear || {};
      if (!gear.auger_hand && !this.d.freeAuger) out.push({ label: 'I need an auger', primary: true, fn: () => setTimeout(() => this.freeAuger(n), 150) });
      out.push({ label: 'Show me your gear', primary: !out.length, fn: () => setTimeout(() => this.pellShop(n), 150) });
      out.push({ label: 'Cold-weather outfits', fn: () => setTimeout(() => this.pellOutfits(n), 150) });
    }
    if (n.talk === 'june' && this.quests.state('june') && !this.quests.state('june').done && this.fauna.myFish().length) out.push({ label: 'Give the dogs a fish', fn: () => setTimeout(() => this.feedDogs(n), 150) });
    if (n.talk === 'june') {
      if (!this.d.pup) out.push({ label: `A one-dog sled for yourself (${SNO.pup} coins)`, fn: () => this.buyRide('pup', SNO.pup, 'A one-dog sled, with Pepper,')() });
      else if (this.d.sno) out.push({ label: this.d.ride === 'pup' ? 'Use the snowmobile on the ride key' : 'Use the one-dog sled on the ride key', fn: () => this.game.ext.change((d) => { d.north.ride = d.north.ride === 'pup' ? 'sno' : 'pup'; }) });
      out.push({ label: 'Take a sled out', primary: true, fn: () => setTimeout(() => this.sleds.start('drive'), 150) });
      out.push({ label: `Run the Sled Derby (beat ${JUNE_TIME} s)`, fn: () => setTimeout(() => this.races.startDerby(), 150) });
      out.push({ label: 'Hire a ride (40 coins)', fn: () => setTimeout(() => this.hireMenu(n), 150) });
    }
    if (n.talk === 'mira') {
      const locked = new Set(g.ext.d.locked || []);
      const rare = (g.profile.creel || []).find((c) => !locked.has(c.id) && SPECIES_BY_ID[c.speciesId]?.north && ['rare', 'epic', 'legendary'].includes(SPECIES_BY_ID[c.speciesId].tier));
      if (rare) out.push({ label: `Commission: carve my ${SPECIES_BY_ID[rare.speciesId].name}`, primary: true, fn: () => setTimeout(() => this.commission(n, rare), 150) });
    }
    if ((n.talk === 'kit' || n.talk === 'bo') && !this.snowballs.fight) out.push({ label: 'Snowball fight!', primary: true, fn: () => setTimeout(() => this.snowballs.startFight(), 150) });
    if (n.talk === 'elsi') {
      out.push({ label: 'A mug of cocoa (15 coins)', primary: true, fn: () => setTimeout(() => this.cocoa(n), 150) });
      const fish = this.smokable();
      if (fish) out.push({ label: `Smoke my ${SPECIES_BY_ID[fish.speciesId].name}`, fn: () => setTimeout(() => this.smoke(n, fish), 150) });
    }
    return out;
  }
  async cocoa(n) {
    const g = this.game, r = await g.save.spend('cocoa', 'mug', { coins: 15 });
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough coins.'); return; }
    g.audio.sfx('buff');
    this.warmth.warm = Math.min(100, this.warmth.warm + 35);
    this.warmth.setBuff('Hot cocoa', 5 * 60, 0.4);
    g.dialogue.open({ npc: n, title: n.title, text: 'There you go, dear. Marshmallows on top. That\'ll keep the cold out for a while.', choices: [{ label: 'Mmm, thanks!' }] });
    this.onEvent('cocoa');
  }
  /** Your smallest Frostmere fish (Elsi smokes it: a long warm buff). */
  smokable() {
    const g = this.game, locked = new Set(g.ext.d.locked || []);
    return (g.profile.creel || []).filter((c) => !locked.has(c.id) && SPECIES_BY_ID[c.speciesId]?.north && ['common', 'uncommon'].includes(SPECIES_BY_ID[c.speciesId].tier)).sort((a, b) => a.weight - b.weight)[0] || null;
  }
  async smoke(n, c) {
    const g = this.game;
    if (!(await g.save.give(c.id))) { g.ui.toast('Couldn\'t take that fish out of your backpack.'); return; }
    g.audio.sfx('buff');
    this.warmth.warm = 100;
    this.warmth.setBuff('Smoked fish', 12 * 60, 0.35);
    g.dialogue.open({ npc: n, title: n.title, text: `One ${SPECIES_BY_ID[c.speciesId].name}, smoked over alder the old way. Eat it out on the ice and you won\'t feel the cold for ages.`, choices: [{ label: 'Smells amazing' }] });
    g.ui.sheets?.refresh?.();
    this.onEvent('smoke');
  }
  /** Mira buys a rare fish to carve in ice for the green: a good price, and your name on the plinth. */
  async commission(n, c) {
    const g = this.game, sp = SPECIES_BY_ID[c.speciesId], v = Math.round(catchValue(c.speciesId, c.variant, c.weight) * 2);
    if (!(await g.save.give(c.id))) return;
    g.ui.sheets?.refresh?.();
    g.ext.change((d) => { d.north.carvings = [...(d.north.carvings || []), { sp: c.speciesId, w: c.weight, at: Date.now() }].slice(-12); });
    g.dialogue.open({ npc: n, title: n.title, text: `Oh, look at the colours on this ${sp.name}! I'll have it in ice on the green by tomorrow, with your name on the plinth. Here, for the fish.`, choices: [{ label: 'Can\'t wait to see it' }] });
    await g.reward('north', `carve-${c.id}`, { coins: v, xp: 120 }, `Mira's commission: ${sp.name}`);
    this.onEvent('carve');
  }
  async feedDogs(n) {
    const g = this.game, fish = this.fauna.myFish().sort((a, b) => a.weight - b.weight)[0];
    if (!fish || !(await g.save.give(fish.id))) return;
    g.ui.sheets?.refresh?.();
    g.dialogue.open({ npc: n, title: n.title, text: `A ${SPECIES_BY_ID[fish.speciesId].name}! Pepper, Juniper, look! ...See how they wag? You've got eight new best friends.`, choices: [{ label: 'Good dogs!' }] });
    for (let i = 0; i < 3; i++) setTimeout(() => northSfx(g.audio, 'bark'), i * 260);
    this.onEvent('feeddogs');
  }
  pellOutfits(n) {
    const g = this.game;
    openShop(g, { title: 'Pell\'s Trading Post', sub: 'Cold-weather outfits', text: 'Knitted in Hearthwick, every one. Warmer clothes keep the cold off longer out on the ice.',
      items: () => { const own = new Set(g.profile.owned || []); return ITEMS.filter((it) => it.northPrice).map((it) => ({ id: it.id, name: it.name, what: it.desc || '', price: it.northPrice, owned: own.has(it.id), buy: () => this.buyOutfit(it) })); } });
    void n;
  }
  async buyOutfit(it) {
    const g = this.game, r = await g.save.spend('northwear', it.id, it.northPrice);
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough coins.'); return; }
    await g.save.grant('northwear', it.id, { item: it.id });
    g.audio.sfx('purchase'); g.ui.refresh?.();
    g.ui.toast(`${it.name}: yours! Put it on in your wardrobe.`, { icon: 'star', ms: 4000 });
  }
  hireMenu(n) {
    const g = this.game;
    g.dialogue.open({ npc: n, title: n.title, text: 'Where to? The team knows every trail. Hop on, hold tight, and enjoy the view.', choices: [
      ...Object.entries(SLED_ROUTES).map(([k, r]) => ({ label: r.name[0].toUpperCase() + r.name.slice(1), fn: () => setTimeout(() => this.hire(k), 150) })),
      { label: 'Maybe later' },
    ] });
  }
  async hire(k) {
    const g = this.game, r = await g.save.spend('sledride', k, { coins: 40 });
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough coins.'); return; }
    g.audio.sfx('purchase');
    this.sleds.hire(k, SLED_ROUTES[k]);
  }
  freeAuger(n) {
    const g = this.game;
    g.ext.change((d) => { d.north.gear = { ...(d.north.gear || {}), auger_hand: 1 }; d.north.freeAuger = Date.now(); });
    g.audio.sfx('purchase');
    g.dialogue.open({ npc: n, title: n.title, text: 'First time on the ice? Here: a hand auger, on the house. Walk out on the bay, face where you want your hole and press E to drill. Crank it steady! Then drop your line and jig. Come back for a flasher when you\'ve got the coins: fishing blind is no fun.', choices: [{ label: 'Thanks, Pell!' }] });
    this.onEvent('auger');
  }
  /** Pell's gear: everything in one list that stays open while you shop (v1.16.2). */
  buyRide(kind, coins, label) {
    const g = this.game;
    return async () => { const r = await g.save.spend('northride', kind, { coins }); if (!r.ok) { g.ui.toast(r.reason || 'Not enough coins.'); return false; } g.ext.change((d) => { d.north[kind] = 1; d.north.ride = kind; }); g.audio.sfx('purchase'); g.ui.toast(`${label} is yours. Press the ${kind === 'sno' ? 'snowflake' : 'dog'} button on the bar below (or your ride key) to hop on, anywhere on the snow.`, { icon: 'star', ms: 5000 }); return true; };
  }
  pellShop(n) {
    const g = this.game;
    openShop(g, { title: 'Pell\'s Trading Post', sub: 'Ice-fishing gear', text: 'Everything you need for the ice. Buy what you like; I\'ll be here.',
      items: () => { const gear = this.d.gear || {}; return ['auger_hand', 'flasher', 'tipups', 'skates', 'jigrod', 'snowshoes', 'cleats', 'auger_power'].map((k) => ({ id: k, name: ICE_GEAR[k].name, what: ICE_GEAR[k].what, price: ICE_GEAR[k].price, owned: !!gear[k], buy: () => this.buyGear(k, n) })).concat([{ id: 'sno', name: 'Snowmobile', what: 'The fastest way over the snow. Press your ride key to hop on, anywhere up north.', price: { coins: SNO.price }, owned: !!this.d.sno, buy: this.buyRide('sno', SNO.price, 'The snowmobile') }]); } });
  }
  pellShopMore(n) { this.pellShop(n); }
  async buyGear(k, n) {
    const g = this.game, r = await g.save.spend('northgear', k, ICE_GEAR[k].price);
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough coins.'); return; }
    g.ext.change((d) => { d.north.gear = { ...(d.north.gear || {}), [k]: 1 }; });
    g.audio.sfx('purchase'); g.ui.refresh?.();
    g.ui.toast(`${ICE_GEAR[k].name}! ${ICE_GEAR[k].what}`, { icon: 'coin', ms: 4500 });
    this.onEvent('buy', { k });
    void n;
  }
  /** Things that happen up here, for the quests and achievements (src/north/quests.js). */
  onEvent(kind, data = {}) {
    const g = this.game, bump = (k, n = 1) => g.ext.change((d) => { d.north[k] = (d.north[k] || 0) + n; });
    switch (kind) {
      case 'tripleflag': bump('triple'); break;
      case 'gonethrough': bump('through'); break;
      case 'plunge': bump('plunges'); break;
      case 'glide': bump('glides'); break;
      case 'derby': bump('derbies'); if (data.won) bump('topdog'); break;
      case 'catch': if (g.fishing.lastTipup) bump('flags'); break;
      case 'flight3': bump('flight3'); break;
      default: break;
    }
    this.quests?.event(kind, data);
    if (['drill', 'tripleflag', 'gonethrough', 'sauna', 'plunge', 'glide', 'derby', 'catch', 'photo', 'aurora', 'flight3', 'page'].includes(kind)) this.syncStats();
  }
  /** Frostmere's counters, handed to the profile's achievement stats (rules.setOceanStats takes them too). */
  async syncStats() {
    const g = this.game, d = this.d, guide = d.guide || {};
    const map = { fmHoles: d.holes || 0, fmFlags: d.flags || 0, fmTriple: d.triple || 0, fmThrough: d.through || 0, fmSaunas: d.saunas || 0, fmPlunge: d.plunges || 0, fmGlide: d.glides || 0, fmDerby: d.derbies || 0, fmTopDog: d.topdog || 0, fmBearCubs: guide.bear && guide.cubs ? 1 : 0, fmAuroras: d.auroras || 0, fmFlight3: d.flight3 || 0, fmGuide: Object.keys(guide).length, fmPages: Object.keys(d.pages || {}).length };
    try { await g.save.setOceanStats?.(map); await g.autoClaim?.(); } catch (e) { console.warn('[frostmere] stats', e); }
  }
  onTalk(n) { this.onEvent('talk', { who: n.talk }); }
  zoneLabel() { if (!this.here) return null; if (this.lodge?.inside) return 'The Hearth Lodge'; const [u, v] = toLocal(this.game.player.pos.x, this.game.player.pos.z); return regionOf(u, v); }
  stateExtra() {
    const sk = this.skate?.pose();
    const o = { ...(this.hidden ? { hid: 1 } : {}), ...(sk ? { sk } : {}), ...(this.skate?.on && this.here ? { bl: 1 } : {}), ...(this.sleds?.stateExtra() || {}), ...(this.sno?.stateExtra() || {}), ...(this.game.ocean?.jetski?.stateExtra() || {}), ...(this.air?.stateExtra() || {}) };
    return Object.keys(o).length ? o : null;
  }
  /** How close you are to Hearthwick's bonfire (the crackle), 0..1. */
  nearFire() { const f = this.village?.bonfire; return f && this.here ? Math.max(0, 1 - this.game.player.pos.distanceTo(f) / 10) : 0; }
  /** The music up here: Hearthwick's own tunes in the village, the wide north's elsewhere. */
  musicRegion() {
    if (!this.here || this.trip) return null;
    const [u, v] = toLocal(this.game.player.pos.x, this.game.player.pos.z);
    return Math.hypot(u - P.village.u, v - P.village.v) < 70 || Math.hypot(u - P.shanties.u, v - P.shanties.v) < 40 || Math.hypot(u - P.kennels.u, v - P.kennels.v) < 25 ? 'Hearthwick Village' : 'Frostmere North';
  }
  /** The fishing button's pose up here: throwing a snowball, cranking the auger. */
  /** v1.17.2: sitting on something that isn't a chair: the height of the seat above your feet, and which way it faces. */
  rideSeat() {
    if (!this.here) return null;
    const yaw = this.game.player.yaw;
    if (this.sno?.on) return { h: 0.72, yaw };
    { const l = this.lifts?.seat(); if (l) return l; }
    if (this.resort?.sledRun) return { h: 0.3, yaw };
    if (this.expeditions?.soak) return { h: 0.2, yaw };
    return null;
  }
  pose() { if (!this.here) return null; if (this.ice?.drill) return 'reel'; return this.snowballs?.pose() || null; }
  /** The boards by the lodge door, and the skates (last: E picks the first action). */
  boardActions() {
    const V = this.village, p = this.game.player.pos, out = [];
    const L = V && V.lodgeBoard;
    if (L && Math.hypot(p.x - L.x, p.z - L.z) < 2.6) {
      out.push({ id: 'fm-boards', label: 'Hearthwick boards', color: 'gold', at: { x: L.x, z: L.z, y: L.y, h: 2.6 }, fn: () => this.boardMenu() });
    }
    const R = this.races.courses.glide.start;
    if (R && Math.hypot(p.x - R.x, p.z - R.z) < 7 && !this.races.race) out.push({ id: 'glide', label: 'Race the Long Glide', color: 'gold', fn: () => this.races.startGlide() });
    return out;
  }
  boardMenu() {
    const g = this.game, B = this.boards;
    const fish = derbyFish();
    g.dialogue.open({ npc: this.village.boardSpeaker || this.villagers.byId('astrid'), title: 'Hearthwick', text: `Hearthwick boards. This week's Ice Derby fish: the ${fish.name}. Land the heaviest one this week to top the board.`, choices: [
      { label: 'Ice Derby', primary: true, fn: () => setTimeout(() => B.show('ice'), 150) },
      { label: 'Sled Derby', fn: () => setTimeout(() => B.show('derby'), 150) },
      { label: 'The Long Glide', fn: () => setTimeout(() => B.show('glide'), 150) },
      { label: 'Above the Clouds', fn: () => setTimeout(() => B.show('flight'), 150) },
      { label: 'Done' },
    ] });
  }
  /** E out in the wild: toss a fish to a curious bear, photograph an animal, pick up a log page. */
  wildActions() {
    const out = [], F = this.fauna;
    if (!F.built) return out;
    const bear = F.curiousBear();
    if (bear) out.push({ id: 'bear-fish', label: 'Toss the bear a fish', color: 'gold', fn: () => F.tossFish(bear) });
    out.push(...this.wild.contextActions());
    const c = F.photoTarget();
    if (c) { const e = NORTH_GUIDE.find((x) => x.id === c.id); out.push({ id: `photo-${c.id}`, label: `Photograph the ${e.name.replace(/^The /, '').toLowerCase()}`, color: 'blue', fn: () => F.photograph(c) }); }
    return out;
  }
  logPhoto(id) {
    const g = this.game, e = NORTH_GUIDE.find((x) => x.id === id);
    if (this.d.guide?.[id]) return;
    g.ext.change((d) => { d.north.guide = { ...(d.north.guide || {}), [id]: Date.now() }; });
    const have = this.d.guide || {};
    g.ui.toast(`${e.name}: in your Field Guide (${Object.keys(have).length}/${NORTH_GUIDE.length} in Frostmere).`, { icon: 'camera', title: 'Snap!', ms: 3500 });
    g.reward('north', `photo-${id}`, { coins: e.set === 'legend' ? 300 : 80, xp: e.set === 'legend' ? 250 : 60 }, 'Field Guide');
    for (const [set, S] of Object.entries(GUIDE_SETS_NORTH)) {
      if (this.d.guideSets?.[set]) continue;
      if (NORTH_GUIDE.filter((x) => x.set === set).every((x) => have[x.id])) { g.ext.change((d) => { d.north.guideSets = { ...(d.north.guideSets || {}), [set]: Date.now() }; }); g.reward('north', `guide-${set}`, S.reward, `Field Guide: ${S.name} complete`); }
    }
    if (id === 'whitepaw' || id === 'stag' || id === 'thing') this.legendSeen(id);
    this.onEvent('photo', { id });
  }
  /** A legend seen: counted, and your name on the shared "seen it" list. */
  async legendSeen(id) {
    const g = this.game, now = Date.now();
    g.ext.change((d) => { d.north.legends = { ...(d.north.legends || {}), [id]: ((d.north.legends || {})[id] || 0) + 1 }; });
    try { await g.shared?.set('fm_legends', `${id}-${g.save.userId || 'me'}`, { legend: id, name: String(g.profile.name || '').slice(0, 20), at: now }); } catch { /* offline */ }
    this.onEvent('legend', { id });
  }
  takePage(p) {
    const g = this.game;
    g.ext.change((d) => { d.north.pages = { ...(d.north.pages || {}), [p.id]: Date.now() }; });
    g.audio.sfx('page');
    const n = Object.keys(this.d.pages || {}).length;
    this.showPage(p);
    g.ui.toast(`A page of the Valiant's log (${n}/${LOG_PAGES.length}). ${n === LOG_PAGES.length ? 'That\'s all of them! Take them to Grandma Elsi.' : 'Grandma Elsi will want to see this.'}`, { title: 'The Valiant\'s Log', icon: 'scroll', ms: 5000 });
    this.onEvent('page', { id: p.id, n });
  }
  showPage(p) {
    document.querySelector('.fm-board')?.remove();
    const el = h('div.fm-board.plank.fm-page', h('div.fm-board-head', h('b', `The Valiant's Log: ${p.title}`), h('button.btn.ghost', { on: { click: () => el.remove() } }, 'Close')), h('p.fm-page-text', p.text), h('small', '— Capt. J. Hale, schooner Valiant'));
    this.game.ui.root.append(el);
  }

  /** Every fish you land up here: the Ice Derby and the quests. */
  async onCatch(c, sp) {
    if (!this.here || !sp?.north) return;
    this.onEvent('catch', { c, sp });
    if (c.speciesId === derbyFish().id) {
      const best = await this.boards.post('ice', c.weight, { sp: c.speciesId });
      if (best) this.game.ui.toast(`${c.weight.toFixed(2)} lb ${sp.name}: your best this week on the Ice Derby board!`, { title: 'Ice Derby', icon: 'trophy', ms: 5000 });
    }
  }
  meta() { return this.here ? { away: { k: 'north', w: [] }, ...(this.ice?.meta() || {}) } : {}; }
}
export { P, NORTH };
