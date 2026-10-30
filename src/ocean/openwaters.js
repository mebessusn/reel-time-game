// Open Waters (v1.15): Captain Marlowe's charters. From a pier at Cozy Cove he takes you (and up to three friends from
// your party) out past the lighthouse to the open ocean for big-game fishing.
//
// The ocean is a far corner of the same world (see geo.js), so walking, casting, bites, other anglers and the sky all
// work out there unchanged. What's special lives here:
// - the charter: booking (level 20 for everyone aboard, 5,000 coins each, the first trip free), invites to your party,
//   boarding, sailing between spots by the chart, the idle timer, heading home;
// - the crew's own side room (BaseNet.joinRoom): while you're out, you see and chat with your crew only, and the lake
//   shows you as "on a charter";
// - the sea: Gerstner waves driven by the weather (waves.js, oceanMesh.js), fog and visibility at sea, sound;
// - big-game fights from the fighting chair, with crew roles (bigfight.js), and whales and dolphins (sealife.js).
import { JetSki } from './jetski.js';
import * as THREE from 'three';
import { WATER_Y, FAR_X, addWalkway, walkY, regionName } from '../world/terrain.js';
import { addCircle } from '../world/colliders.js';
import { Actor } from '../game/actor.js';
import { defaultAvatar } from '../data/avatarOptions.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { OCEAN_ZONES } from '../data/oceanSpecies.js';
import { OCEAN, SPOTS, SPOT_BY_ID, DOCKS, ISLAND_BY_ID, inOcean, spotAt, jettyAt, oceanSurfaceY, islandAt, dockName } from './geo.js';
import { Islands } from './islands.js';
import { Islanders } from './islanders.js';
import { Dive } from './dive.js';
import { fishThumb } from '../ui/thumbs.js';
import { h } from '../ui/dom.js';
import { installFarWorld } from './hooks.js';
import { SEA, COMPONENTS, updateSea, setSea, oceanWave, waveHeight, seaName } from './waves.js';
import { OceanSurface } from './oceanMesh.js';
import { CharterBoat, BOAT, route, dockRoute, coursePose, deckAtLocal, buildPier, buildSign, buildDockedBoat } from './charterBoat.js';
import { BigFight } from './bigfight.js';
import { SeaLife } from './sealife.js';
import { CharterUI } from './charterUI.js';
import { BeachGames } from './games/party.js';
import { OceanProgress } from './progress.js';
import { OceanQuests } from './quests.js';
import { Tackle, runningBiteMult } from './tackle.js';
import { Smugglers } from './smugglers.js';
import { FishFinder } from './finder.js';
import { Voyage } from './voyage.js';
import { Evenings } from './evenings.js';
import { NightSea } from './nightsea.js';
import { BillfishDerby, Tides } from './seaside.js';
import { SeaEvents } from './seaevents.js';
import { DeepBlue } from './deepblue.js';
import { OwnBoat } from './ownboat.js';
import { OWN_BOAT, boatLook } from './voyageData.js';
import { trustRank, tripTrust, ABYSS_RANK, TRUST } from './voyageData.js';
import { dayFraction, shiftTo, setTimeShift } from '../core/clock.js';
import { CAUSTICS } from '../world/caustics.js';
import { ISLAND_MATS, ISLAND_NODES } from '../data/islandMesh.js';
import { buildNode } from './meshes.js';
import { PARTY_MAX } from '../game/party.js';
import './ocean.css';

export const OW = {
  LEVEL: 20, // everyone aboard
  FEE: 5000, // coins per person per trip; the first trip is free
  IDLE_END: 30 * 60 * 1000, // nobody aboard active this long: Marlowe heads home
  LINE: 3000, // the charter's big-game rods (lb): enough for a great white
  CREW_MAX: PARTY_MAX,
};

// The charter pier on Cozy Cove's south-east shore, pointing north-west into the cove, with the boat alongside.
const PIER = (() => {
  const shore = { x: 19.8, z: 32.2 }, ux = -0.5, uz = -0.866, len = 12;
  const x0 = shore.x - ux * 2, z0 = shore.z - uz * 2; // starts on the bank
  return { x0, z0, ux, uz, len, y: 1.45, end: { x: x0 + ux * len, z: z0 + uz * len }, yaw: Math.atan2(ux, uz) };
})();
const side = { x: -PIER.uz, z: PIER.ux }; // to starboard of the pier (the boat's side)
export const CHARTER_DOCK = {
  ...PIER,
  marlowe: { x: PIER.x0 + PIER.ux * 4.2 + side.x * 0.55, z: PIER.z0 + PIER.uz * 4.2 + side.z * 0.55 },
  sign: { x: PIER.x0 - PIER.ux * 1.4 - side.x * 3.2, z: PIER.z0 - PIER.uz * 1.4 - side.z * 3.2 }, // up the beach beside the pier, not in front of it
  boat: { x: PIER.x0 + PIER.ux * 8.5 + side.x * 3.9, z: PIER.z0 + PIER.uz * 8.5 + side.z * 3.9, yaw: PIER.yaw + Math.PI },
};

const MARLOWE_LOOK = { ...defaultAvatar('male'), skin: 4, height: 'tall', frame: 'broad', hair: 'crop', hairColor: 9, facialHair: 'beard', brows: 'thick', mouth: 'smile', eyes: 'content', hat: 'hat_captain', shirt: 'polo', shirtColor: 13, pants: 'shorts', pantsColor: 6, shoes: 'slipons' };
// Where the crew stand when they come aboard (cockpit, local to the boat)
const SLOTS = [{ x: -1.0, z: -3.4 }, { x: 1.0, z: -3.4 }, { x: -1.1, z: -6.4 }, { x: 1.1, z: -6.4 }];

const rid = () => Math.random().toString(36).slice(2, 8);
const str = (s, n = 24) => String(s ?? '').slice(0, n);

export class OpenWaters {
  constructor(game) {
    this.game = game;
    const scene = game.engine.scene;
    this.boat = new CharterBoat(scene);
    installFarWorld(() => (this.boat.visible ? [this.boat] : []));
    this.surface = new OceanSurface(scene, game.engine.water);
    this.charter = null; // { id, ld, v, crew, names, spot, course, start, ... }
    this.crewNet = null;
    this.lobby = null;
    this.fight = new BigFight(game, this);
    this.life = new SeaLife(scene, game, this);
    this.ui = new CharterUI(game, this);
    this.islands = new Islands(scene, game); // stage 2: built on the first trip
    this.islanders = new Islanders(game, this); // v1.15.6: locals on every island
    this.dive = new Dive(game, this); // stage 3: swimming and spearfishing
    this.games = new BeachGames(game, this); // stage 4: party games on Palm Key
    this.progress = new OceanProgress(game, this); // stage 5: achievements, release, trophies, the collection
    this.quests = new OceanQuests(game); // stage 5: bonus sea requests on the notice board
    this.tackle = new Tackle(game, this); // Marlowe's tackle locker (big-game rod, trolling skirt, harness)
    this.smugglers = new Smugglers(game, this); // Smuggler's Rock: the grotto and the smugglers' maps
    this.finder = new FishFinder(game, this); // the charter's fish finder
    this.evenings = new Evenings(game, this); // v1.15.10: island fires, the fireside drum, sleeping till dawn
    this.nightSea = new NightSea(game, this); // v1.15.10: glowing plankton, squid lights
    this.billfish = new BillfishDerby(game, this); // v1.15.11: the weekly Billfish Derby
    this.own = new OwnBoat(game, this); // v1.15.13: your own boat
    this.events = new SeaEvents(game, this); // v1.15.12: bait balls, waterspouts, fog banks
    this.tides = new Tides(game, this); // v1.15.11: tides, and tide pools to search at low tide
    this.deep = new DeepBlue(game, this); // v1.15.19: Deep Blue (Coralhaven, the Marigold, islets, Channel Light, Emberkey...)
    this.voyage = new Voyage(game, this); // v1.15.9: the trip log and report, the first-trip lesson, Claude's fish on
    this.buildCove(scene);
    // the camera stays above the waves out here
    game.engine.camFloor = (x, z) => (x > FAR_X ? this.dive.camFloor(x, z) : WATER_Y + 1.2);
    this.lastActive = Date.now();
    this.jetski = new JetSki(this);
    this.prompted = new Set();
    // v1.15.6: walk off a beach (or a jetty's side) into water past your depth and you start swimming
    game.player.onFarEdge = (x, z) => {
      const p = game.player.pos;
      if (!this.atSea || this.dive.on || this.boat.deckY(p.x, p.z) != null || this.boat.footprint(x, z)) return;
      if (!islandAt(p.x, p.z, 1.7) && !jettyAt(p.x, p.z)) return;
      if (oceanSurfaceY(x, z) > WATER_Y - 0.5 || jettyAt(x, z)) return; // (a cliff or a slope, not the sea)
      if (Math.hypot(x - p.x, z - p.z) > 2.5) return; // (v1.17.1: only a step off the edge: a far point the game merely asked about (a click out on the water) must never become where you swim from)
      this.swimAt = { x, z, t: performance.now() };
    };
  }

  // ---------------------------------------------------------------- Cozy Cove: the pier, the sign, Marlowe, the boat
  buildCove(scene) {
    const D = CHARTER_DOCK;
    const pier = buildPier();
    pier.position.set(D.x0, D.y, D.z0); pier.rotation.y = D.yaw;
    pier.name = 'charter-pier';
    scene.add(pier);
    addWalkway({ cx: D.x0 + D.ux * D.len / 2, cz: D.z0 + D.uz * D.len / 2, ux: D.ux, uz: D.uz, half: D.len / 2 + 0.2, w: 2.3, y: D.y + 0.05 });
    const sign = buildSign();
    const sy = walkY(D.sign.x, D.sign.z) ?? 1.2;
    sign.position.set(D.sign.x, sy, D.sign.z); sign.rotation.y = D.yaw + Math.PI; // square to the pier, so the board runs along the beach and faces the path
    sign.name = 'charter-sign';
    scene.add(sign);
    for (const k of [-0.75, 0.75]) addCircle(D.sign.x + side.x * k, D.sign.z + side.z * k, 0.2); // its two posts
    const boat = buildDockedBoat();
    boat.position.set(D.boat.x, WATER_Y - 0.05, D.boat.z); boat.rotation.y = D.boat.yaw;
    boat.name = 'charter-docked';
    scene.add(boat);
    this.docked = boat;
    // below level 20 a chain and padlock across the pier, past Marlowe (he still talks to you)
    const lock = buildNode(ISLAND_MATS, ISLAND_NODES, 'isle_lockchain');
    lock.position.set(D.x0 + D.ux * 5.8, D.y + 0.05, D.z0 + D.uz * 5.8); lock.rotation.y = Math.atan2(-D.ux, -D.uz);
    lock.name = 'charter-lock';
    scene.add(lock);
    this.lock = lock;
    for (let k = -6; k <= 6; k += 2.4) addCircle(D.boat.x + Math.sin(D.boat.yaw) * k, D.boat.z + Math.cos(D.boat.yaw) * k, 2.3, { water: true });
    // Captain Marlowe: on the pier by day; out at sea he's at the wheel of your boat
    const actor = new Actor(scene);
    actor.setLook(MARLOWE_LOOK, { rod: 'rod_bamboo', lure: 'lure_classic', boat: 'boat_oak' });
    this.marlowe = { name: 'Captain Marlowe', actor, pos: new THREE.Vector3(D.marlowe.x, D.y + 0.05, D.marlowe.z), yaw: D.yaw + Math.PI / 2, home: { ...D.marlowe }, wait: 0 };
    // v1.15.15: on his pier from the start (the title screen doesn't run the game's update, so he used to wait at the
    // map's origin, out in the middle of the Cove, until you pressed Continue)
    actor.update(0, 0, { x: D.marlowe.x, y: D.y + 0.05, z: D.marlowe.z, yaw: D.yaw + Math.PI / 2, mode: 'shore', pose: 'idle', moving: false, rod: 'back' });
    this.marloweSea = new Actor(scene);
    this.marloweSea.setLook(MARLOWE_LOOK, { rod: 'rod_bamboo', lure: 'lure_classic', boat: 'boat_oak' });
    this.marloweSea.root.visible = false;
  }

  init() {
    const g = this.game;
    g.ext.change((d) => { d.ocean = { trips: 0, freeUsed: false, unlocked: 0, whales: 0, dolphins: 0, breach: 0, catches: {}, best: {}, role: 'angler', ...(d.ocean || {}) }; });
    if (g.ext.d.ocean.trust == null) g.ext.change((d) => { d.ocean.trust = d.ocean.trips || 0; }); // v1.15.12: past trips count toward Marlowe's trust
    this.checkUnlock(true);
    // the private test build's test kit (and ?testkit on the dev server); never in a public build
    /* global __RT_TESTKIT__ */
    const q = new URLSearchParams(location.search);
    if ((typeof __RT_TESTKIT__ !== 'undefined' && __RT_TESTKIT__) || (import.meta.env.DEV && q.has('testkit'))) import('./testkit.js').then((m) => m.installTestKit(g));
    // dev and browser tests: ?ocean[=spot] books a free solo charter straight away (level 20 for this session)
    if (import.meta.env.DEV && q.has('ocean')) setTimeout(() => this.debugSail(q.get('ocean')), 600);
  }
  async debugSail(spot) {
    const g = this.game, p = g.profile;
    if (p.level < OW.LEVEL) { p.level = OW.LEVEL; }
    g.ext.change((d) => { d.ocean.freeUsed = false; });
    this.noLesson = !new URLSearchParams(location.search).has('lesson'); // (browser tests: no lesson unless ?lesson)
    await this.book();
    if (spot && SPOT_BY_ID[spot] && spot !== 'harbor') { this.sailTo(spot); this.charter.dep -= 600000; this.course = this.makeCourse(this.charter); }
  }
  get d() { return this.game.ext.d.ocean || {}; }
  get atSea() { return this.game.player.pos.x > FAR_X; }
  get level() { return this.game.profile.level; }

  /** Level 20: a one-time toast and journal line (and the lock on the pier comes off). */
  checkUnlock(quiet = false) {
    const g = this.game;
    if (this.level < OW.LEVEL || this.d.unlocked) return;
    g.ext.change((d) => { d.ocean.unlocked = Date.now(); });
    if (quiet && (g.profile.level > OW.LEVEL)) return; // already past it when this shipped: no fanfare
    g.ui.toast('Captain Marlowe will take you out to Open Waters. Find his pier on the east side of Cozy Cove.', { icon: 'anchor', title: 'Open Waters', ms: 8000 });
    g.chat.system('Journal: Captain Marlowe will take you out to Open Waters. His charter pier is by the lighthouse, on the east side of Cozy Cove.', 'level', { popup: true });
    g.audio.sfx('achievement');
  }

  // ---------------------------------------------------------------- the lobby's view of me
  meta() {
    const c = this.charter;
    if (!c) return { chtr: this.offer || null };
    return { chtr: this.pubCharter(), away: this.crewNet ? { k: 'charter', w: Object.values(c.names || {}).slice(0, 4) } : null, role: this.d.role || 'angler' };
  }
  pubCharter() {
    const c = this.charter;
    return c ? { id: c.id, ld: c.ld, v: c.v, crew: c.crew, names: c.names, spot: c.spot, fd: c.fd || null, tow: c.tow || 0, from: c.from, to: c.to, dep: c.dep, home: c.home || 0, ts: c.ts || 0, bt: c.bt || null } : null;
  }

  // ---------------------------------------------------------------- booking
  crewCandidates() {
    const g = this.game, me = g.save.userId;
    const list = [{ id: me, name: g.profile.name, lvl: g.profile.level, me: true }];
    for (const id of g.party?.members?.() || []) {
      if (id === me) continue;
      const p = g.party.peerById(id);
      list.push({ id, name: str(p?.meta?.name || g.party.nameOf(id)), lvl: p?.meta?.lvl || 0, here: !!p });
    }
    return list.slice(0, OW.CREW_MAX);
  }
  feeFor() { return this.d.freeUsed ? OW.FEE : 0; }
  /** v1.15.12: how far Marlowe trusts you (points from trips). */
  trust() { return trustRank(this.d.trust || 0); }
  /** A trip ended: Marlowe's trust grows (a trophy on the trip counts double). */
  addTrust(summary) {
    const g = this.game, pts = tripTrust(summary);
    if (!pts) return;
    const was = this.trust();
    g.ext.change((d) => { d.ocean.trust = (d.ocean.trust || 0) + pts; });
    const now = this.trust();
    if (now.i > was.i) setTimeout(() => {
      g.audio.sfx('achievement');
      g.chat.system(`Captain Marlowe trusts you as his ${now.name} now.${now.i === ABYSS_RANK ? ' He\'ll take you out to the Abyss, his deepest water, where the monsters are. Look for it on the chart.' : ' He has a new story for you at the pier.'}`, 'level', { popup: true });
    }, 2600);
  }

  talk() {
    const g = this.game, M = this.marlowe;
    if (this.level < OW.LEVEL) {
      g.dialogue.open({ npc: M, title: 'Charter captain', text: `Ahoy! I run charters out past the lighthouse, to the open ocean. Big fish out there, mind: marlin-sized trouble. Come back at level ${OW.LEVEL} and I'll take you out.`, choices: [{ label: 'Aye aye, Captain' }] });
      return;
    }
    const first = !this.d.freeUsed;
    const text = first
      ? `There's the angler I've been hearing about! First trip's on the house. Bring your party, up to ${OW.CREW_MAX} of you, and I'll find you something bigger than you are.`
      : `Back for more, my ${this.trust().name.toLowerCase()}? It's ${OW.FEE.toLocaleString()} coins a head for a trip. Everybody aboard needs to be level ${OW.LEVEL}.${this.trust().next ? ` (${this.trust().toNext} more good trip${this.trust().toNext > 1 ? 's' : ''} and you're my ${this.trust().next.name}.)` : ''}`;
    g.dialogue.open({ npc: M, title: 'Charter captain', text, choices: [
      { label: 'Book a charter', primary: true, fn: () => this.ui.charterCard() },
      { label: 'Tackle locker', fn: () => setTimeout(() => this.tackle.card(), 250) },
      ...(this.d.lessonDone ? [{ label: this.d.lessonAgain ? 'Lesson\'s on for next trip' : 'Show me the ropes', fn: () => { this.game.ext.change((d) => { d.ocean.lessonAgain = true; }); this.game.chat.npcSay?.('Captain Marlowe', 'Right you are. Next trip, I\'ll walk you through it again.'); } }] : []),
      { label: 'Billfish Derby', fn: () => setTimeout(() => this.billfish.card(), 250) },
      { label: 'Tell me a story', fn: () => setTimeout(() => this.story(), 250) },
      { label: this.own.owned ? 'My boat' : 'A boat of my own?', fn: () => setTimeout(() => this.own.card(), 250) },
      { label: 'What\'s out there?', fn: () => setTimeout(() => this.lore(), 250) },
      { label: 'Maybe later' },
    ] });
  }
  /** v1.15.12: one story per rank of trust, the newest you've earned first. */
  story() {
    const g = this.game, T = this.trust();
    const S = [
      ['The first fish I ever lost', 'My first marlin, I was nine. Fought it two hours from my granddad\'s skiff, got it to the boat, and the hook pulled. Granddad just laughed and said, "Now you\'ll come back." Here I am.'],
      ['The night of the squid', 'Thirty years back, a squid took a bait over the Canyon and towed us half a mile. Never saw it. Just the line going down and down, and the lights making the water glow green. Come back at night and you\'ll see what I mean.'],
      ['The Abyss', 'Past the Deep Blue there\'s water where the bottom just stops. Old charts call it the Abyss. The biggest fish I ever saw came up out of it: a great white longer than this boat. I\'ll take you there, now. Bring your best line.'],
      ['Why I still go out', 'People ask why an old man still runs charters. It\'s you lot. That face when the reel screams and you know it\'s the big one. Never gets old. Never will. Thank you, Old Salt.'],
    ];
    const [title, text] = S[Math.min(T.i, S.length - 1)];
    g.dialogue.open({ npc: this.marlowe, title: `Marlowe's story: ${title}`, text, choices: [{ label: T.next ? `(Your next story at ${T.next.name})` : 'Thanks, Captain' }] });
  }
  lore() {
    const g = this.game;
    g.dialogue.open({ npc: this.marlowe, title: 'Charter captain', text: 'Mahi on the weed line, tuna and sailfish out in the Deep Blue, makos for the brave, and trevally bullying the reef by my mooring. Whales go by, too, if you keep your eyes open. Big fish fight long: sit in the chair, ease off when they run, and let the crew gaff it.', choices: [{ label: 'Book a charter', primary: true, fn: () => this.ui.charterCard() }, { label: 'Thanks, Captain' }] });
  }

  /** The leader books: pays, sets the course from Marlowe's mooring, invites the eligible crew, and boards. */
  async book({ night = false, own = false } = {}) {
    const g = this.game;
    if (this.charter) return;
    own = own && this.own.owned;
    const fee = own ? 0 : this.feeFor();
    if (fee && g.profile.coins < fee) { g.ui.toast(`A charter is ${fee.toLocaleString()} coins. You have ${g.profile.coins.toLocaleString()}.`, { icon: 'coin' }); return; }
    const crew = this.crewCandidates().filter((c) => c.lvl >= OW.LEVEL);
    if (!(await this.pay(own))) return;
    const now = Date.now();
    const id = `c${now.toString(36)}${rid()}`;
    const from = this.mooring(id);
    const c = { id, ld: g.save.userId, v: 1, crew: crew.map((x) => x.id), names: Object.fromEntries(crew.map((x) => [x.id, x.name])), spot: 'harbor', from, to: from, dep: now - 600000, start: now, ts: night ? Math.round(shiftTo(dayFraction(), 0.88)) : 0, bt: own ? this.own.look() : null }; // (v1.15.10: a night charter runs on its own clock, from after dark)
    this.offer = { ...c }; // the lake sees the invite in my meta
    await this.board(c);
  }
  async pay(free = false) {
    const g = this.game, fee = free ? 0 : this.feeFor();
    this.paid = fee;
    if (!fee) { if (!free) g.ext.change((d) => { d.ocean.freeUsed = true; }); return true; } // (your own boat: free, and the first free trip stays unused)
    const r = await g.save.spend('charter', `trip${Date.now()}`, { coins: fee });
    if (!r?.ok) { g.ui.toast(r?.reason || 'Not enough coins.', { icon: 'coin' }); return false; }
    g.audio.sfx('coin');
    g.ui.refresh?.();
    return true;
  }
  /** Where a charter starts: Marlowe's mooring, nudged per trip so two crews' boats never share a spot. */
  mooring(id) {
    const s = SPOT_BY_ID.harbor;
    let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const a = ((h >>> 0) % 360) * Math.PI / 180, r = 8 + ((h >>> 9) % 20);
    return { x: Math.round(s.x + Math.cos(a) * r), z: Math.round(s.z + Math.sin(a) * r) };
  }
  anchorYaw() { const c = COMPONENTS[0]; return Math.atan2(-c.dx, -c.dz); } // bow into the swell

  /** Invites from the lake: a party member booked a charter with me on the crew list. */
  checkInvites() {
    const g = this.game;
    if (this.charter || g.ui.modalOpen) return;
    for (const p of g.party?.peers?.() || []) {
      const c = p.meta?.chtr;
      if (!c?.id || !Array.isArray(c.crew) || !c.crew.includes(g.save.userId) || c.home || this.prompted.has(c.id)) continue;
      if (Date.now() - (c.dep || 0) > 2 * 3600 * 1000 && !c.start) continue;
      this.prompted.add(c.id);
      this.ui.inviteCard(p, c);
      return;
    }
  }
  async accept(c) {
    const g = this.game;
    if (this.level < OW.LEVEL) { g.ui.toast(`Charters need level ${OW.LEVEL}.`, { icon: 'lock' }); return; }
    const own = !!c.bt; // a crewmate's own boat: free for everyone
    const fee = own ? 0 : this.feeFor();
    if (fee && g.profile.coins < fee) { g.ui.toast(`You need ${fee.toLocaleString()} coins for the charter.`, { icon: 'coin' }); return; }
    if (!(await this.pay(own))) return;
    await this.board({ ...c, v: c.v || 1, bt: boatLook({ owned: 1, ...c.bt }) });
  }

  // ---------------------------------------------------------------- boarding and heading home
  async board(c) {
    const g = this.game;
    if (g.fishing.busy) g.fishing.cancel();
    if (g.chairs.seat) g.chairs.stand();
    if (g.bikes?.riding) g.bikes.dismount();
    if (g.player.mode === 'boat') { g.player.mode = 'shore'; g.actor.setMode('shore'); }
    g.ui.closeAll();
    this.ui.closeModal();
    await this.fade(async () => {
      this.charter = { ...c };
      if (g.bikes?.riding) g.bikes.dismount(); // (v1.15.21: and again here, in case you hopped on during the fade)
      setTimeShift(c.ts || 0); // a night charter's clock (or a crew that slept till dawn)
      this.progress.newTrip();
      this.voyage.start(this.paid || 0); this.paid = 0;
      this.course = this.makeCourse(this.charter);
      this.boat.setVisible(true);
      this.boat.setLook(c.bt || null); // v1.15.13: an owner's boat, or Marlowe's
      this.islands.build();
      this.islanders.build();
      this.games.build();
      this.evenings.build();
      setSea(g.engine.sky.state.weather || 'clear');
      this.boat.update(0.016, this.course);
      // a place in the cockpit (by your order on the crew list)
      const i = Math.max(0, (c.crew || []).indexOf(g.save.userId)) % SLOTS.length;
      const w = this.boat.toWorld(SLOTS[i].x, SLOTS[i].z);
      const y = this.boat.deckY(w.x, w.z) ?? WATER_Y + 1.2;
      g.player.pos.set(w.x, y, w.z); g.player.baseY = y; g.player.target = null; g.player.air = 0; g.player.vy = 0;
      g.player.yaw = this.boat.pose.yaw + Math.PI;
      g.engine.cam.target.set(w.x, y + 0.8, w.z);
      g.engine.cam.yaw = this.boat.pose.yaw + Math.PI * 0.85;
      this.lastActive = Date.now();
      this.life.reset(this.charter);
    });
    // v1.15.14: the Open Waters title card fades in as the spray clears
    const night = (g.engine.sky.night || 0) > 0.5;
    this.ui.titleCard(c.bt ? `Aboard the ${String(c.bt.name || 'Sea Biscuit').slice(0, 18)}` : night ? 'A night charter with Captain Marlowe' : 'with Captain Marlowe');
    g.ext.change((d) => { d.ocean.trips = (d.ocean.trips || 0) + 1; if (!c.bt) d.ocean.freeUsed = true; }); // (your own boat doesn't use up the free first trip)
    g.ext.bump('charters');
    await this.enterCrew(c);
    g.audio.sfx('horn');
    const sea = seaName();
    g.chat.npcSay?.('Captain Marlowe', this.weatherLine(true));
    g.ui.toast(`${sea}. Cast from the cockpit; big fish go to the fighting chair. Press M for the chart.`, { title: 'Open Waters', icon: 'anchor', ms: 6500 });
    g.pushMeta();
  }

  makeCourse(c) {
    const from = c.from || this.mooring(c.id), to = c.to || from;
    const dock = SPOT_BY_ID[c.spot]?.dock, fd = c.fd && DOCKS[c.fd] ? DOCKS[c.fd] : null;
    // in and out of a jetty, the boat lines up along it (no cutting across the jetty or the beach)
    const pts = dock || fd ? dockRoute(from, to, fd, dock ? DOCKS[dock] : null) : route(from, to);
    return { pts, dep: c.dep || 0, anchorYaw: this.anchorYaw(), fixedYaw: dock ? DOCKS[dock].yaw : null, startYaw: fd ? fd.yaw : null, speed: c.bt?.up?.engine ? OWN_BOAT.speed : undefined };
  }
  /** Moored at an island's jetty (and arrived)? Returns the dock or null. */
  moored() {
    const c = this.charter, dock = c && SPOT_BY_ID[c.spot]?.dock;
    return dock && !this.boat.pose.moving && coursePose(this.course).arrived ? DOCKS[dock] : null;
  }
  /** Everyone ashore comes back aboard when the boat leaves (Marlowe sounds the horn first). */
  recall() {
    const g = this.game, pl = g.player;
    this.games.cancel('The boat\'s leaving, so the beach game is off.');
    this.jetski.dismount();
    if (this.dive.on) { this.dive.toBoat('Marlowe sounded the horn: everyone out of the water and back aboard.'); return; }
    if (!this.atSea || this.boat.deckY(pl.pos.x, pl.pos.z) != null) return;
    if (g.fishing.busy) g.fishing.cancel();
    if (g.chairs.seat) g.chairs.stand();
    this.toCockpit();
    g.chat.system('Marlowe sounded the horn and you hurried back aboard.', 'info');
  }
  toCockpit(i = 0) {
    const g = this.game, s = SLOTS[i % SLOTS.length], w = this.boat.toWorld(s.x, s.z), y = this.boat.deckY(w.x, w.z) ?? WATER_Y + 1.2;
    g.player.pos.set(w.x, y, w.z); g.player.baseY = y; g.player.target = null;
    g.engine.cam.target.set(w.x, y + 0.8, w.z);
  }
  goAshore() {
    const g = this.game, D = this.moored();
    if (!D) return;
    const x = D.x0 + D.ux * (D.len - 3), z = D.z0 + D.uz * (D.len - 3);
    g.audio.sfx('plop');
    g.player.pos.set(x, D.y, z); g.player.baseY = D.y; g.player.target = null; g.player.yaw = D.yaw;
    g.engine.cam.target.set(x, D.y + 0.8, z);
    if (!this.d.ashore?.[D.island]) { g.ext.change((d) => { d.ocean.ashore = { ...(d.ocean.ashore || {}), [D.island]: Date.now() }; }); g.ui.toast(`Welcome to ${dockName(D)}! ${D.platform ? 'Fish from the platform; Marlowe waits alongside.' : 'Fish from the beach and the jetty; Marlowe waits at the jetty.'}`, { icon: 'sun', title: 'Ashore', ms: 6000 }); }
  }

  /** Everyone home (the leader, or the timer), or just me. */
  async headHome(reason = 'me') {
    const g = this.game;
    if (!this.charter) return;
    if (g.fishing.busy) g.fishing.cancel();
    if (g.chairs.seat) g.chairs.stand();
    this.fight.end();
    this.games.cancel();
    this.ui.closeModal();
    this.goingHome = true; // (v1.15.23: nothing may start a swim while the fade runs: that's how you ended up under the pier)
    if (this.dive.on) { this.dive.on = false; g.player.mode = 'shore'; g.actor.setMode('shore'); g.audio.setUnderwater?.(false); this.dive.clearFish(); }
    const was = this.charter;
    this.voyage.finish();
    await this.fade(async () => {
      this.leaveCrew();
      this.charter = null; this.course = null; this.offer = null;
      setTimeShift(0); // back to the lake's clock
      this.boat.setVisible(false);
      this.marloweSea.root.visible = false;
      this.life.clear();
      const D = CHARTER_DOCK, x = D.x0 + D.ux * 2.5, z = D.z0 + D.uz * 2.5, y = walkY(x, z) ?? D.y;
      // on the pier, standing, whatever you were doing out there (swimming, diving, in Coralhaven)
      this.dive.exit(x, y, z); this.swimAt = null;
      if (this.deep?.town?.inside) this.deep.town.setInside(false); // (out of Coralhaven too: its camera range and lights go back)
      g.player.yaw = D.yaw + Math.PI;
    });
    this.goingHome = false;
    g.audio.sfx('horn');
    const lines = { timer: 'Captain Marlowe brought the boat home: everyone aboard had gone quiet for a while.', leader: `${str(was.names?.[was.ld] || 'The charter leader')} called the trip. Captain Marlowe brought everyone home.`, me: 'Captain Marlowe ran you back to Cozy Cove in the tender.' };
    g.chat.system(lines[reason] || lines.me, 'info', { popup: true });
    g.pushMeta();
  }

  fade(fn) {
    const g = this.game;
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'travel-fade ow-spray';
      g.ui.root.append(el);
      g.audio.sfx('meteor');
      setTimeout(async () => { try { await fn(); } catch (e) { console.error('[open waters]', e); } }, 380);
      setTimeout(() => { el.remove(); resolve(); }, 950);
    });
  }

  // ---------------------------------------------------------------- the crew's side room
  async enterCrew(c) {
    const g = this.game;
    if (!g.net || g.net.kind === 'none') return; // single player: just you and Marlowe
    const lobby = g.net;
    this.lobby = lobby;
    const sub = lobby.joinRoom(`charter-${c.id}`);
    this.crewNet = sub;
    // the lake keeps seeing me, marked away on a charter, with no position
    lobby.setMeta({ ...g.meta() });
    lobby.sendState(null);
    // the lake still sees me while I'm out (LocalNet forgets a quiet peer): a heartbeat on a timer, not the frame
    // loop, so a busy or hidden tab doesn't drop off the lake
    clearInterval(this.beat);
    this.beat = setInterval(() => { if (this.lobby === lobby) lobby.sendState(null); }, 3000);
    g.net = sub;
    g.remotes.resync(sub);
    sub.on('ev:crew', (e) => { if (g.net === sub) this.fight.onCrew(e); });
    try { await g.attachNet(sub); } catch (e) { console.warn('[open waters] crew room', e); }
    if (sub.solo || (sub.kind !== 'none' && !sub.connected)) g.chat.system('Couldn\'t open the crew\'s channel, so your crewmates may not see you out here. You can still fish.', 'info');
    else g.chat.system('You\'re out at sea: chat reaches your crew only until you\'re back at the cove.', 'info');
  }
  leaveCrew() {
    const g = this.game, lobby = this.lobby;
    if (!lobby) return;
    lobby.leaveRoom();
    clearInterval(this.beat);
    this.crewNet = null; this.lobby = null;
    g.net = lobby;
    g.remotes.resync(lobby);
    g.pushMeta();
  }

  // ---------------------------------------------------------------- sailing
  /** Set a course for a spot (anyone aboard can take the wheel). */
  sailTo(spotId) {
    const g = this.game, c = this.charter, s = SPOT_BY_ID[spotId];
    if (!c || !s || c.spot === spotId) return;
    if (s.trust && this.trust().i < s.trust) { g.ui.toast(`Marlowe only takes a ${TRUST[s.trust].name} out to ${s.name}. Keep chartering with him.`, { icon: 'lock' }); return; }
    if (this.fight.active) { g.ui.toast('Not while there\'s a fish on!', { icon: 'fish' }); return; }
    const now = Date.now(), here = coursePose(this.course, now);
    let h = 0; for (const ch of c.id + spotId) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const a = ((h >>> 0) % 360) * Math.PI / 180, r = s.r * 0.35 * (((h >>> 8) % 100) / 100);
    const to = s.dock ? { x: s.x, z: s.z } : { x: Math.round(s.x + Math.cos(a) * r), z: Math.round(s.z + Math.sin(a) * r) }; // (a jetty: exactly alongside)
    const fd = SPOT_BY_ID[c.spot]?.dock && here.arrived ? SPOT_BY_ID[c.spot].dock : null; // leaving a jetty?
    Object.assign(c, { spot: spotId, fd, tow: 0, from: { x: here.x, z: here.z }, to, dep: now, v: (c.v || 1) + 1, by: g.save.userId });
    this.recall();
    this.course = this.makeCourse(c);
    if (g.fishing.busy && !(this.tackle.trolling && !this.fight.active)) g.fishing.cancel(); // (a trolled line stays out)
    g.audio.sfx('horn');
    g.chat.system(`Setting a course for ${s.name}. Lines up while we run!`, 'info');
    g.pushMeta();
  }
  /** A giant squid on the line drags the whole boat toward it: a short, slow course a few metres its way, which the
   *  crew adopt like any other. (Not at a jetty, and never into the shallows.) */
  tow(tx, tz) {
    const g = this.game, c = this.charter;
    if (!c || this.moored() || SPOT_BY_ID[c.spot]?.dock) return;
    const now = Date.now(), here = coursePose(this.course, now);
    const dx = tx - here.x, dz = tz - here.z, L = Math.hypot(dx, dz);
    if (L < 6) return;
    const to = { x: +(here.x + dx / L * 9).toFixed(1), z: +(here.z + dz / L * 9).toFixed(1) };
    if (!inOcean(to.x, to.z) || oceanSurfaceY(to.x, to.z) > -6) return;
    Object.assign(c, { from: { x: here.x, z: here.z }, to, dep: now, fd: null, v: (c.v || 1) + 1, by: g.save.userId, tow: 1 });
    this.course = this.makeCourse(c);
    g.audio.sfx('run');
    g.chat.npcSay?.('Captain Marlowe', ['It\'s towing us! Hold on!', 'She\'s pulling the whole boat. Easy, easy!', 'That squid wants the boat back!'][Math.floor(Math.random() * 3)]);
    g.pushMeta();
  }
  /** Take a newer charter state from a crewmate (a course, everyone home). */
  adopt(c) {
    const g = this.game, me = this.charter;
    if (!me || !c || c.id !== me.id || !((c.v || 0) > (me.v || 0))) return;
    this.evenings.adoptShift(c, me); // a crewmate slept till dawn
    const moved = c.dep !== me.dep || c.to?.x !== me.to?.x || c.to?.z !== me.to?.z;
    Object.assign(me, { v: c.v, spot: c.spot, fd: c.fd || null, tow: c.tow || 0, from: c.from, to: c.to, dep: c.dep, home: c.home || 0, by: c.by });
    if (moved && c.tow) { this.course = this.makeCourse(me); return; } // (a squid's tow: no horn, nobody recalled)
    if (moved) {
      this.recall();
      this.course = this.makeCourse(me);
      if (g.fishing.busy && !this.fight.active && !this.tackle.trolling) g.fishing.cancel();
      const s = SPOT_BY_ID[c.spot];
      if (s) g.chat.system(`${str(me.names?.[c.by] || 'A crewmate')} set a course for ${s.name}.`, 'info');
    }
    if (me.home) setTimeout(() => this.headHome('leader'), 600);
  }
  /** The leader calls everyone home. */
  callHome() {
    const g = this.game, c = this.charter;
    if (!c) return;
    Object.assign(c, { home: Date.now(), v: (c.v || 1) + 1, by: g.save.userId });
    g.pushMeta();
    setTimeout(() => this.headHome('me'), 900); // give the crew a beat to hear it
  }
  isLeader() {
    const c = this.charter, g = this.game;
    if (!c) return false;
    if (c.ld === g.save.userId) return true;
    // the leader went home: the first crew member still aboard takes over
    const aboard = new Set([g.save.userId, ...[...(g.net?.peers?.values?.() || [])].map((p) => p.meta?.id)]);
    if (aboard.has(c.ld)) return false;
    return (c.crew || []).find((id) => aboard.has(id)) === g.save.userId;
  }

  // ---------------------------------------------------------------- per frame
  /** Before the player moves: the boat moves (and carries everyone on deck with it). */
  preUpdate(dt) {
    const g = this.game;
    const wt = g.engine.sky.state;
    const sea = this.atSea || this.charter;
    if (sea) updateSea(dt, wt.weather || 'clear', g.engine.water?.uniforms.uWind.value ?? 0.4);
    if (!this.charter || !this.course) return;
    const pl = g.player;
    const was = this.boat.deckY(pl.pos.x, pl.pos.z) != null ? this.boat.toLocal(pl.pos.x, pl.pos.z) : null;
    this.boat.update(dt, this.course, g.engine.sky.night || 0);
    if (was && pl.mode === 'shore') {
      // ride along: same spot on deck after the boat moved and turned
      const w = this.boat.toWorld(was.x, was.z);
      const dyaw = this.lastYaw != null ? Math.atan2(Math.sin(this.boat.pose.yaw - this.lastYaw), Math.cos(this.boat.pose.yaw - this.lastYaw)) : 0;
      pl.pos.x = w.x; pl.pos.z = w.z; pl.yaw += dyaw;
      if (pl.target && this.boat.pose.moving) pl.target = null;
    } else if (this.jetski.on) { // (v1.17.2: riding: never counted as fallen in the water)
    } else if (this.goingHome) {
      // (heading home: stay put until the fade has put you on the pier)
    } else if (this.swimAt && pl.mode === 'shore' && !g.fishing.busy && !this.games.holding && !g.chairs.seat) {
      // v1.15.6: walked off a beach or a jetty into water past your depth: swim
      const s = this.swimAt; this.swimAt = null;
      if (performance.now() - (s.t || 0) < 600 && Math.hypot(s.x - pl.pos.x, s.z - pl.pos.z) < 3) this.dive.enter(s.x, s.z); // (v1.17.1: fresh, and right where you are)
    } else if (this.atSea && pl.mode === 'shore' && walkY(pl.pos.x, pl.pos.z) == null && !g.fishing.busy && !this.games.holding && !g.chairs.seat && !this.boat.footprint(pl.pos.x, pl.pos.z)) { // (never off a seat, never from inside the hull)
      // somehow in the water: start swimming
      this.dive.enter(pl.pos.x, pl.pos.z);
    }
    this.lastYaw = this.boat.pose.yaw;
    if (!this.dive.on) this.dive.updateTow(); // (v1.17.1: climbing aboard with a big one in tow drops it off too)
    // trolling: a lure out while the boat runs is towed along in her wake, 22 m astern
    const b = g.fishing.bobber;
    if (b && !b.flying && this.boat.pose.moving && this.tackle.trolling && !this.fight.active) {
      const st = this.boat.sternWorld(), P = this.boat.pose;
      const tx = st.x - Math.sin(P.yaw) * 22, tz = st.z - Math.cos(P.yaw) * 22;
      b.x += (tx - b.x) * Math.min(1, dt * 2); b.z += (tz - b.z) * Math.min(1, dt * 2);
    }
    // the fighting chair and the seats ride with the boat
    const seat = g.chairs.seat;
    if (seat?.kind === 'fight') { const c = this.boat.chairWorld(); Object.assign(seat, { x: c.x, y: c.y, z: c.z, yaw: c.yaw }); }
    else if (seat?.kind === 'boatseat') { const c = this.boat.seatWorld(seat.st); Object.assign(seat, { x: c.x, y: c.y, z: c.z, yaw: c.yaw }); }
  }

  /** After the sky: the sea surface, fog at sea, clouds, life, crew sync, the timer. */
  update(dt, t) {
    this.jetski?.update(dt);
    const g = this.game;
    const cam = g.engine.camera.position;
    const looking = cam.x > FAR_X;
    SEA.lite = g.engine.quality === 'low'; // low graphics: the swell without the wind sea, no caustics, no spray
    if (looking && SEA.lite) CAUSTICS.uCaustic.value = 0;
    this.surface.update(cam, looking, g.engine.sky.flash || 0);
    const sky = g.engine.sky;
    sky.clouds.position.x = looking ? OCEAN.x : 0;
    if (looking) { this.seaFog(sky); this.dive.look(sky); }
    this.dive.hud();
    this.updateMarlowe(dt, t);
    this.islands.update(dt, t, looking);
    this.games.update(dt, t);
    this.progress.update();
    this.finder.update(dt);
    this.voyage.update(dt);
    this.evenings.update(dt);
    this.nightSea.update(dt, t);
    this.billfish.update(dt);
    this.tides.update(dt, t);
    this.events.update(dt, t);
    try { this.deep.update(dt, t); } catch (e) { if (!this.deepErr) { this.deepErr = 1; console.error('deep blue', e); } }
    if (this.atSea) this.smugglers.update();
    this.checkUnlockTick(dt);
    if (!this.charter) { this.inviteT = (this.inviteT || 0) - dt; if (this.inviteT <= 0) { this.inviteT = 1.5; this.checkInvites(); } this.ui.update(dt); return; }
    // the crew: newer charter state, and who's still active
    let crewActive = 0;
    for (const p of g.net?.peers?.values?.() || []) {
      if (p.meta?.chtr?.id === this.charter.id) this.adopt(p.meta.chtr);
      if (p.state && !p.state.afk) crewActive = Date.now();
    }
    if (!g.player.afk) this.lastActive = Date.now();
    this.lastActive = Math.max(this.lastActive, crewActive);
    if (Date.now() - this.lastActive > OW.IDLE_END) { this.headHome('timer'); return; }
    // spray off the bow when she slams into a wave; a wake when under way
    const P = this.boat.pose;
    if (P.moving && !SEA.lite && Math.random() < dt * 18) {
      const s = this.boat.sternWorld();
      g.fx.wake(new THREE.Vector3(s.x, WATER_Y + oceanWave(s.x, s.z) + 0.05, s.z), new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw)));
      if (Math.random() < 0.3) g.engine.water.ripple(s.x, s.z, 1.5);
    }
    const slam = -(this.boat.vp || 0);
    if (!SEA.lite && (slam > 0.18 && (P.moving || SEA.swell > 1)) && Math.random() < dt * 8) {
      const b = this.boat.bowWorld();
      g.fx.splash(new THREE.Vector3(b.x, WATER_Y + oceanWave(b.x, b.z) + 0.3, b.z), 0.7 + SEA.spray);
    }
    this.fight.update(dt, t);
    this.life.update(dt, t, this.charter);
    this.ui.update(dt);
  }

  /** Visibility at sea follows the weather: miles on a clear day, a few hundred metres in rain, a grey wall in a storm. */
  seaFog(sky) {
    const f = sky.scene.fog, w = sky.state?.weather;
    const far = w === 'storm' ? 150 : w === 'rain' ? 230 : w === 'overcast' ? 380 : 500;
    const near = w === 'storm' ? 25 : w === 'rain' ? 45 : w === 'overcast' ? 90 : 140;
    const k = this.events?.fogK || 0; // v1.15.12: a fog bank closes everything in
    f.near = near + (6 - near) * k; f.far = far + (48 - far) * k;
  }

  updateMarlowe(dt, t) {
    const g = this.game, M = this.marlowe;
    const near = g.player.pos.distanceTo(M.pos) < 60;
    M.actor.root.visible = near;
    if (near) {
      // he watches the water, and turns to look at you when you come close
      const dx = g.player.pos.x - M.pos.x, dz = g.player.pos.z - M.pos.z, close = dx * dx + dz * dz < 25;
      const want = M.talking ? M.yaw : close ? Math.atan2(dx, dz) : CHARTER_DOCK.yaw + Math.PI / 2 + Math.sin(t * 0.2) * 0.4;
      let d = want - (M.face ?? want); d = Math.atan2(Math.sin(d), Math.cos(d));
      M.face = (M.face ?? want) + d * Math.min(1, dt * 3);
      M.actor.update(dt, t, { x: M.pos.x, y: M.pos.y, z: M.pos.z, yaw: M.face, mode: 'shore', pose: close && !M.talking && Math.sin(t * 0.7) > 0.96 ? 'wave' : 'idle', moving: false, rod: 'back' });
    }
    // at sea, at the wheel up on the flybridge
    const S = this.marloweSea;
    S.root.visible = !!this.charter && this.atSea;
    if (S.root.visible) {
      const h = this.boat.helmWorld();
      S.update(dt, t, { x: h.x, y: h.y, z: h.z, yaw: h.yaw, mode: 'shore', pose: 'idle', moving: false, rod: 'back' });
      S.root.rotation.x = -this.boat.pose.pitch * 0.6; S.root.rotation.z = this.boat.pose.roll * 0.6;
    }
  }
  checkUnlockTick(dt) { this.unlockT = (this.unlockT || 0) - dt; if (this.unlockT <= 0) { this.unlockT = 3; this.checkUnlock(); if (this.lock) this.lock.visible = this.level < OW.LEVEL; } }

  // ---------------------------------------------------------------- Kai's tiki bar (Palm Key)
  talkKai() {
    const g = this.game, K = this.islands.kai;
    g.dialogue.open({ npc: K, title: 'Tiki bar', text: 'Aloha! Bring me a fish and I\'ll grill it island-style with lime and coconut. Eat up and the fish of the sea come looking for you. Reef fish make the best plates: they keep you going twice as long.', choices: [
      { label: 'Cook me a fish', primary: true, fn: () => setTimeout(() => this.kaiPicker(), 200) },
      { label: 'Dive gear', fn: () => setTimeout(() => this.dive.shop(), 200) },
      { label: 'What\'s biting here?', fn: () => setTimeout(() => g.dialogue.open({ npc: K, title: 'Tiki bar', text: 'From the beach: tangs, snapper and parrotfish on the reef, bonefish on the flats at dawn and dusk, and tarpon after dark if you\'re brave. Barracuda will take anything shiny. The lionfish, grouper and octopus? You\'ll want a speargun for those.', choices: [{ label: 'Mahalo, Kai' }] }), 200) },
      { label: 'Later!' },
    ] });
  }
  kaiPicker() {
    const g = this.game;
    const locked = new Set(g.ext.d.locked || []);
    const fish = g.profile.creel.filter((c) => !locked.has(c.id)).sort((a, b) => (SPECIES_BY_ID[b.speciesId]?.tropical ? 1 : 0) - (SPECIES_BY_ID[a.speciesId]?.tropical ? 1 : 0) || a.weight - b.weight).slice(0, 9);
    const rows = fish.map((c) => h('button.ow-role', { on: { click: async () => {
      this.ui.closeModal();
      if (!(await g.save.give(c.id))) { g.ui.toast('Couldn\'t take that fish out of your backpack.'); return; }
      const sp = SPECIES_BY_ID[c.speciesId];
      g.audio.sfx('dirt');
      g.chat.npcSay?.('Kai', `One ${sp?.name || 'fish'}, island-style, coming right up!`);
      setTimeout(() => g.cookout.eat({ sp: c.speciesId, w: Math.min(30, c.weight) * (sp?.tropical ? 2 : 1) }), 1500);
      g.ext.bump('kaiPlates');
    } } }, h('img', { src: fishThumb(c.speciesId, c.variant), alt: '', style: { width: '40px', height: '24px', objectFit: 'contain', verticalAlign: 'middle', marginRight: '6px' } }), h('b', SPECIES_BY_ID[c.speciesId]?.name || 'Fish'), h('small', `${c.weight.toFixed(1)} lb${SPECIES_BY_ID[c.speciesId]?.tropical ? ' · reef fish: twice as long' : ''}`)));
    this.ui.openModal('ow-kai', h('div.ow-head', h('span.ow-badge', h('b', 'K')), h('div', h('b', "Kai's Tiki Bar"), h('span', 'Pick a fish to have grilled. Locked fish stay in your backpack.'))),
      rows.length ? h('div.ow-roles', rows) : h('p.ow-note', 'Your backpack is empty. Catch something first!'));
  }

  // ---------------------------------------------------------------- talking points
  weatherLine(boarding = false) {
    const w = this.game.engine.sky.state.weather, h = waveHeight();
    const L = {
      clear: ['Flat calm and a blue sky. Sailfish weather.', 'Not a breath of wind. Keep an eye out for whales.'],
      overcast: ['Grey skies: the tuna like it when the light\'s low.', 'Bit of a swell under the clouds. Hold on to your hat.'],
      rain: ['Rain on the water. Wahoo and tuna come up to feed in this.', 'Wet one today! Fish don\'t mind, and neither do I.'],
      storm: [`Seas are ${h.toFixed(1)} metres and building. Keep one hand for yourself and one for the boat!`, 'Makos and trevally love a storm. So do I, mostly.'],
    }[w] || ['Lovely day for it.'];
    let line = L[Math.floor(Math.random() * L.length)];
    if ((this.game.engine.sky.night || 0) > 0.5 && w !== 'storm') line = ['Lights on at anchor: the squid come up to them, and the swordfish come for the squid.', 'Look at the plankton in the wake, glowing like stars. Swordfish weather.', 'Night on the water. Swordfish rise after dark, and if you\'re lucky, something bigger out over the Canyon.'][Math.floor(Math.random() * 3)];
    return boarding ? `Welcome aboard! ${line}` : line;
  }

  // ---------------------------------------------------------------- hooks the rest of the game calls
  audioScene() { if (this.deep?.town?.inside) return { swell: 0.08, wind: 0 }; return this.atSea ? { swell: SEA.swell, wind: SEA.wind } : null; } // (v1.15.20: muffled inside Coralhaven)
  contextActions() {
    const g = this.game, pl = g.player, out = [];
    if (this.jetski.on) return this.jetski.contextActions();
    if (this.games.busy && !this.dive.on) return this.games.contextActions();
    if (this.dive.on) return [...this.deep.diveActions(), ...this.dive.contextActions()];
    if (pl.mode !== 'shore') return out;
    out.push(...this.dive.contextActions());
    if (!this.charter && pl.pos.distanceTo(this.marlowe.pos) < 3.2) {
      const locked = this.level < OW.LEVEL;
      out.push({ id: 'marlowe', label: locked ? `Captain Marlowe (Lv ${OW.LEVEL})` : 'Captain Marlowe', color: locked ? undefined : 'blue', at: { x: this.marlowe.pos.x, z: this.marlowe.pos.z, y: this.marlowe.pos.y, h: 2.4 }, fn: () => this.talk() });
    }
    if (this.charter && this.atSea) {
      const c = this.boat.chairWorld();
      if (!g.chairs.seat && Math.hypot(pl.pos.x - c.x, pl.pos.z - c.z) < 1.6 && !this.chairTaken()) out.push({ id: 'fightchair', label: 'Fighting chair', color: 'green', fn: () => this.sitChair() });
      if (!g.chairs.seat) {
        for (const st of BOAT.seats) {
          const w = this.boat.seatWorld(st);
          if (Math.hypot(pl.pos.x - w.x, pl.pos.z - w.z) < 1.1 && !this.seatTaken(w)) { out.push({ id: `seat-${st.id}`, label: st.bow ? 'Sit at the bow' : 'Sit down', color: 'green', fn: () => g.chairs.sit({ id: `boat-${st.id}`, kind: 'boatseat', st, ...w, h: st.h }) }); break; }
        }
      }
      const D = this.moored(), onBoat = this.boat.deckY(pl.pos.x, pl.pos.z) != null;
      if (D && onBoat) out.unshift({ id: 'ashore', label: D.platform ? `Climb up: ${dockName(D)}` : `Go ashore: ${dockName(D)}`, color: 'green', fn: () => this.goAshore() });
      if (!onBoat) {
        if (D && Math.hypot(pl.pos.x - D.moor.x, pl.pos.z - D.moor.z) < 14) out.unshift({ id: 'aboard', label: 'Back aboard', color: 'blue', fn: () => { this.toCockpit(); g.audio.sfx('plop'); } });
        out.unshift(...this.games.contextActions(), ...this.smugglers.contextActions(), ...this.islanders.contextActions(), ...this.evenings.contextActions(), ...this.tides.contextActions(), ...this.deep.shoreActions());
        const K = this.islands.kai;
        if (K && pl.pos.distanceTo(K.pos) < 3.5) out.unshift({ id: 'kai', label: "Kai's Tiki Bar", color: 'gold', at: { x: K.pos.x, z: K.pos.z, y: K.pos.y, h: 2.4 }, fn: () => this.talkKai() });
        return out;
      }
      const H = this.fight.helping; // a crewmate's marathon fish: offer to take over the rod
      if (H && !g.fishing.busy && !H.f?.g) out.unshift({ id: 'takerod', label: this.fight.takeReq === H.id ? `Waiting for ${H.name}…` : `Take the rod from ${H.name}`, color: 'gold', fn: () => this.fight.askTake() });
      out.push(...this.deep.boatActions());
      out.push({ id: 'chart', label: 'Chart', color: 'blue', fn: () => this.ui.chart() });
      out.push({ id: 'crew', label: 'Crew & roles', fn: () => this.ui.crewCard() });
      out.push({ id: 'logbook', label: 'Logbook', fn: () => this.deep.logbook() }); // v1.15.19
    }
    return out;
  }
  seatTaken(w) {
    for (const r of this.game.remotes.list.values()) { const s = r.peer.state; if (s?.seat && Math.hypot(r.pos.x - w.x, r.pos.z - w.z) < 0.5) return true; }
    return false;
  }
  chairTaken() {
    const c = this.boat.chairWorld();
    for (const r of this.game.remotes.list.values()) { const s = r.peer.state; if (s?.seat && Math.hypot(r.pos.x - c.x, r.pos.z - c.z) < 0.8) return true; }
    return false;
  }
  sitChair() {
    const g = this.game, c = this.boat.chairWorld();
    if (this.chairTaken()) return false;
    g.chairs.sit({ id: 'fight', kind: 'fight', x: c.x, y: c.y, z: c.z, yaw: c.yaw, h: 0.68 });
    return true;
  }
  zoneLabel() {
    if (!this.atSea) return null;
    const b = this.game.fishing.bobber;
    const at = b && !b.flying ? b : this.game.player.pos;
    const s = spotAt(at.x, at.z);
    const z = this.game.fishing.bobber ? OCEAN_ZONES[this.zoneHere(at)]?.name : null;
    return `${z || s?.name || regionName(at.x, at.z)} · ${seaName()}`;
  }
  zoneHere(p) { const s = spotAt(p.x, p.z); return s?.zone || 'openocean'; }
  /** Extra bite context at sea: no junk, the spotter's birds, a crewmate's luck. */
  ctxExtra(ctx) {
    if (!this.atSea) return ctx;
    ctx.ocean = true; ctx.noJunk = true; ctx.firstEver = false; // (the tutorial's promised bluegill doesn't live out here)
    if (this.life.birdsUntil > Date.now()) { ctx.birds = true; ctx.superCast = ctx.superCast || Math.random() < 0.25; }
    const nb = this.nightSea.boost(); // v1.15.10: under the squid lights
    if (nb) ctx.boost = { ...(ctx.boost || {}), ...nb };
    const eb = this.events.boost(ctx, this.game.fishing.bobber); // v1.15.12: a bait ball, a fog bank
    if (eb) ctx.boost = { ...(ctx.boost || {}), ...eb };
    const wb = this.deep.boost(ctx, this.game.fishing.bobber); // v1.15.19: cast against a drifting weed mat
    if (wb) ctx.boost = { ...(ctx.boost || {}), ...wb };
    return ctx;
  }
  /** How much longer bites take out here (big fish are few and far between), and what speeds them up. */
  biteMult(ctx) {
    if (!ctx?.ocean) return 1;
    let m = 1.55;
    if (ctx.birds) m *= 0.6;
    if (ctx.weedmat) m *= 0.7; // v1.15.19: fish under the weed
    if (ctx.baitball) m /= 3; // v1.15.12: cast into a bait ball
    if (this.charter?.bt?.up?.outriggers && !this.boat.pose.moving) m *= OWN_BOAT.outriggers; // v1.15.13: your outriggers
    if (this.boat.pose.moving) m *= runningBiteMult(this.game.profile.equipped.lure) ?? 4; // lines up while we run (unless trolling)
    return m;
  }
  lineRating() { return this.atSea ? this.tackle.fight().lineLb : null; }
  /** May you cast right now? (Not while the boat's running.) */
  canCast() {
    if (this.deep?.town?.inside) { this.game.ui.toast('No fishing indoors! Shelly would never forgive you.', { icon: 'info' }); return false; } // v1.15.23
    if (!this.atSea || !this.charter) return true;
    if (this.boat.pose.moving && !this.tackle.trolling) { this.game.ui.toast('Lines up while the boat\'s running (a Trolling Skirt from Marlowe\'s locker lets you troll). Cast when he drops anchor.', { icon: 'anchor' }); return false; }
    return true;
  }
  /** My state extras: where I stand on deck (so crewmates draw me on their copy of the boat, wherever it is). */
  stateExtra() {
    if (!this.charter || !this.atSea) return null;
    const pl = this.game.player;
    const l = this.boat.toLocal(pl.pos.x, pl.pos.z);
    return { dk: [+l.x.toFixed(2), +l.z.toFixed(2), +(pl.yaw - this.boat.pose.yaw).toFixed(2)], ...this.fight.stateExtra(), ...(this.games.stateExtra() || {}) };
  }
  /** Remotes at sea: only my crew, drawn on my boat. Returns { hide, x, y, z, yaw } or null. */
  remoteAt(r, s) {
    if (!s || !(s.x > FAR_X)) return null;
    const mine = this.charter && r.peer.meta?.chtr?.id === this.charter.id;
    if (!mine || !this.boat.visible) return { hide: true };
    if (Array.isArray(s.dk)) {
      const [lx, lz, ly] = s.dk;
      const w = this.boat.toWorld(lx, lz);
      const dy = deckAtLocal(lx, lz);
      const y = (dy != null ? this.boat.heightAtLocal(lx, lz, dy) : s.y) + (s.seat ? 0 : 0);
      return { x: w.x, y, z: w.z, yaw: this.boat.pose.yaw + (ly || 0) };
    }
    return null;
  }
}
