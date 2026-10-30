// Locals of Five Lakes Valley: a few anglers fishing at every lake, and folks strolling about.
// They wave and say hello as you pass, and if you recently landed something special they cheer and
// congratulate you. Purely local (each player sees the same cast from the same seed); far-away
// locals are hidden and not animated.
import * as THREE from 'three';
import { Actor } from './actor.js';
import { NEAR_RANGE } from './party.js';
const MAX_SHOWN = 16, SHADOW_RANGE = 28;
import { randomAvatar } from '../data/avatarOptions.js';
import { mulberry32 } from '../core/rng.js';
import { groundY, heightAt, isWater, zoneAt, LAKES, RIVER, WATER_Y, sc, dryAt, walkY, surfaceY, castClearance, onDock, onBridge, JETTIES } from '../world/terrain.js';
import { blocked } from '../world/colliders.js';
import { SPECIES, SPECIES_BY_ID } from '../data/species.js';
import { SCENE } from '../world/campers.js';
import { defaultAvatar } from '../data/avatarOptions.js';

// v1.9.4: a little scene at Sundae's Trailer Park. Sundae, who owns it, is out by site 2 telling his tenant
// Maria Lopez off about the rent; she's crying into her hands. They stay put and play it out on a loop.
const SUNDAE_LINES = ['Rent was due on the FIRST, Maria!', 'Three months! THREE!', "This ain't a charity, it's a trailer park!", "Don't you cry at me, I got bills too!",
  'Pay up by Friday or you\'re out!', "I've heard every excuse in the book!", 'The lot fee went up, you know that!'];
const MARIA_LINES = ['*sniff* ...I just need a few more days...', "I'm trying, Sundae, I really am...", '*sob*', 'The diner cut my hours...', 'Please... just till payday...'];
const SCENE_LOOKS = {
  sundae: { ...defaultAvatar('male'), skin: 2, height: 'tall', frame: 'broad', hair: 'buzz', hairColor: 6, facialHair: 'moustache', brows: 'thick', mouth: 'o', hat: 'cap_star', shirt: 'hawaiian', shirtColor: 5, pants: 'cargo', pantsColor: 2, shoes: 'sandals', eyewear: 'aviators' },
  maria: { ...defaultAvatar('female'), skin: 6, hair: 'long', hairColor: 1, brows: 'worried', mouth: 'neutral', eyes: 'sleepy', shirt: 'cardigan', shirtColor: 9, pants: 'jeans', pantsColor: 1, shoes: 'slipons' },
};

const NAMES = ['Marla', 'Pip', 'Juniper', 'Old Tobias', 'Wren', 'Hazel', 'Bramble', 'Cedar', 'Poppy', 'Fennel', 'Odette', 'Moss', 'Rowan', 'Tilly', 'Basil',
  'Clover', 'Ezra', 'Maple', 'Nell', 'Otis', 'Pearl', 'Quill', 'Rosie', 'Sorrel', 'Teddy', 'Ursa', 'Vera', 'Wally', 'Yarrow', 'Zinnia', 'Arlo', 'Birdie',
  'Cosmo', 'Dot', 'Elsie', 'Finch', 'Gus Jr.', 'Hollis', 'Ivy', 'Jasper', 'Kit', 'Lark', 'Mabel', 'Ned', 'Olive', 'Percy'];
const HELLO = ['Hi there, {you}!', 'Morning, {you}!', 'Lovely day for it!', 'Hey {you}! Biting today?', 'Oh hello!', 'Howdy, neighbour!', 'Good to see you, {you}!',
  'Tight lines, {you}!', 'Mind the ducks!', 'Nice hat!', 'Fancy meeting you here!', 'Hiya!'];
const FISHER_HELLO = ['Shh... they’re biting!', 'Hey {you}! Pull up a bucket.', 'Caught a little one earlier!', 'Morning! Water’s calm today.', 'Hi {you}! Try a bit further out.'];
// How locals answer an emote: [their pose, a few lines]
const REPLIES = {
  wave: ['wave', ['Hey there, {you}!', 'Hi! Lovely day for it.', 'Oh, hello!', 'Wave right back at you!']],
  cheer: ['cheer', ['Woo! What are we cheering?', 'Yeah! Go {you}!', 'Hooray!']],
  clap: ['clap', ['Bravo!', 'Encore!', 'Very nice!']],
  shrug: ['shrug', ['Beats me too.', 'Who knows, really.', 'Fish gonna fish.']],
  showoff: ['clap', ['Ooh, look at that one!', 'Now THAT is a fish.', 'Show-off! I love it.']],
  sleep: ['shrug', ['Sleepy already?', 'Long day on the water, huh?', 'Sweet dreams, {you}.']],
  dance: ['dance', ['Ha! Nice moves!', 'Oh, it’s a dance-off now?', 'I can do that too!']],
  orange: ['orange', ['The Orange Shuffle! I know this one!', 'Ha! Like this?', 'You can’t shuffle alone!']],
};

const CONGRATS = ['Congrats on that {fish}, {you}!', 'Whoa, a {fish}! Nice catch!', 'Was that YOUR {fish}? Amazing!', 'Everyone’s talking about your {fish}!', 'Three cheers for the {fish}!'];

// Where locals live: water bodies (for fishers) and spots to stroll around.
export const AREAS = [
  { id: 'cove', water: { x: 0, z: -2 }, roam: [[-16, 48], [18, 46], [-38, 18], [30, -40]], roamers: 3, fishers: 3, angles: [0.15, 0.35, 0.55, 0.85, 1.15] },
  { id: 'frost', water: { x: LAKES.frost.cx, z: LAKES.frost.cz }, roam: [sc(-50, -38), sc(-36, -30)], roamers: 3, fishers: 4 },
  { id: 'marsh', water: { x: LAKES.marsh.cx, z: LAKES.marsh.cz }, roam: [sc(28, 66), sc(42, 100)], roamers: 3, fishers: 4 },
  { id: 'pond', water: { x: LAKES.pond.cx, z: LAKES.pond.cz }, roam: [sc(-56, 84), sc(-90, 92)], roamers: 2, fishers: 3 },
  { id: 'quarry', water: { x: LAKES.quarry.cx, z: LAKES.quarry.cz }, roam: [sc(70, -56), sc(96, -56)], roamers: 2, fishers: 2 },
  { id: 'river', river: true, roam: [[50, -6], sc(60, 40)], roamers: 2, fishers: 3 },
  { id: 'lodge', roam: [sc(0, -90), sc(-8, -96), sc(8, -98)], roamers: 3, fishers: 0 },
];

const walkable = (x, z) => groundY(x, z) != null && dryAt(x, z, 0.35) && !blocked(x, z, 0.35, 'shore'); // v1.8.2: visibly dry, never in the water
function nearestWalkable(x, z) {
  if (walkable(x, z)) return { x, z };
  for (let r = 1; r < 14; r++) for (let a = 0; a < 16; a++) {
    const px = x + Math.cos(a / 16 * Math.PI * 2) * r, pz = z + Math.sin(a / 16 * Math.PI * 2) * r;
    if (walkable(px, pz)) return { x: px, z: pz };
  }
  return null;
}
// A spot on the bank looking out over the water, with water a few blocks in front.
export function bankSpot(fromX, fromZ, dirX, dirZ) {
  let x = fromX, z = fromZ;
  for (let i = 0; i < 200; i++) { // walk outward from the water until we hit land
    if (!isWater(x, z)) break;
    x += dirX * 0.5; z += dirZ * 0.5;
  }
  x += dirX * 0.8; z += dirZ * 0.8;
  // v1.8.2: step up the bank until the ground is visibly dry (the smoothed shoreline runs a little inland)
  for (let i = 0; i < 10 && !walkable(x, z); i++) { x += dirX * 0.4; z += dirZ * 0.4; }
  if (!walkable(x, z)) return null;
  // the line goes back toward the water: into open water you can see, and not through a bridge or dock
  const reach = 5.5;
  const bx = x - dirX * reach, bz = z - dirZ * reach;
  if (!isWater(bx, bz) || surfaceY(bx, bz) > WATER_Y - 0.25) return null;
  if (castClearance(x, z, -dirX, -dirZ, reach + 0.5) < reach + 0.5) return null;
  // v1.9: and nowhere near one: the line, the rod and the angler keep 1.8 clear of every bridge and dock
  // on both sides (arched bridges stand tall, so a line crossing even a corner shows through the railing)
  for (let s2 = 0; s2 <= reach + 0.5; s2 += 0.4) {
    const px = x - dirX * s2, pz = z - dirZ * s2;
    for (const o of [-1.8, -0.9, 0, 0.9, 1.8]) { const qx = px - dirZ * o, qz = pz + dirX * o; if (onBridge(qx, qz)) return null; }
  }
  return { x, z, yaw: Math.atan2(-dirX, -dirZ), bobber: { x: bx, z: bz } };
}

export class Npcs {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.lastAnyGreet = 0;
    // ?nonpc skips the locals (used by multi-tab tests on slow software GL)
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('nonpc')) { this.off = true; return; }
    const r = mulberry32(31337);
    let n = 0;
    const name = () => NAMES[(n++) % NAMES.length];
    const make = (kind, area, spot) => {
      const actor = new Actor(game.engine.scene); actor.lite = true;
      const rods = ['rod_willow', 'rod_birch', 'rod_willow', 'rod_cherry'];
      actor.setLook(randomAvatar(r), { rod: rods[Math.floor(r() * rods.length)], lure: 'lure_classic', boat: 'boat_oak' });
      actor.root.visible = false;
      const npc = { id: `npc${n}`, kind, area: area.id, name: name(), actor, pos: new THREE.Vector3(spot.x, walkY(spot.x, spot.z) ?? groundY(spot.x, spot.z) ?? 1, spot.z), yaw: spot.yaw ?? r() * 6.28, home: { x: spot.x, z: spot.z },
        target: null, wait: r() * 4, moving: false, lastGreet: -1e9, congrats: null, bubble: null, pose: 'idle', emote: null, r };
      if (kind === 'fisher') { npc.bobber = spot.bobber; npc.cycle = 'wait'; npc.timer = 8 + r() * 25; npc.zone = zoneAt(spot.bobber.x, spot.bobber.z) || 'open'; }
      this.list.push(npc);
    };
    for (const area of AREAS) {
      // fishers on the bank
      const spots = [];
      if (area.river) {
        for (let i = 1; i < RIVER.length - 1 && spots.length < area.fishers * 3; i++) {
          const [x0, z0] = RIVER[i], [x1, z1] = RIVER[i + 1];
          const len = Math.hypot(x1 - x0, z1 - z0), px = -(z1 - z0) / len, pz = (x1 - x0) / len;
          for (const s of [1, -1]) { const sp = bankSpot(x0, z0, px * s, pz * s); if (sp) spots.push(sp); }
        }
      } else if (area.water) {
        const angles = area.angles || Array.from({ length: 10 }, (_, i) => i / 10 + r() * 0.05);
        for (const a of angles) {
          const ang = a * Math.PI * 2;
          const sp = bankSpot(area.water.x, area.water.z, Math.cos(ang), Math.sin(ang));
          if (sp) spots.push(sp);
        }
      }
      const chosen = [];
      for (const s of spots) if (chosen.length < area.fishers && chosen.every((c) => Math.hypot(c.x - s.x, c.z - s.z) > 9)) chosen.push(s);
      // (a lake whose banks are all cliffs or crowded: someone fishes off the end of its jetty instead)
      if (!chosen.length && area.water) {
        const j = JETTIES.find((x) => x.lake === area.id);
        if (j) { const x = j.end.x - j.dir[0] * 0.8, z = j.end.z - j.dir[1] * 0.8; chosen.push({ x, z, yaw: Math.atan2(j.dir[0], j.dir[1]), bobber: { x: j.end.x + j.dir[0] * 5, z: j.end.z + j.dir[1] * 5 } }); }
      }
      for (const s of chosen) make('fisher', area, s);
      // strollers
      for (let i = 0; i < area.roamers; i++) {
        const [hx, hz] = area.roam[i % area.roam.length];
        const sp = nearestWalkable(hx + (r() - 0.5) * 6, hz + (r() - 0.5) * 6);
        if (sp) make('roamer', area, sp);
      }
    }
    // the scene at the trailer park
    for (const [key, name, title, pose] of [['sundae', 'Sundae', 'Park owner', 'yell'], ['maria', 'Maria Lopez', 'Tenant', 'cry']]) {
      const at = SCENE[key];
      const actor = new Actor(game.engine.scene); actor.lite = true;
      actor.setLook(SCENE_LOOKS[key], { rod: 'rod_willow', lure: 'lure_classic', boat: 'boat_oak' });
      actor.root.visible = false;
      this.list.push({ id: `scene-${key}`, kind: 'scene', area: 'park', name, title, scenePose: pose, lines: key === 'sundae' ? SUNDAE_LINES : MARIA_LINES, lineAt: key === 'sundae' ? 1500 : 4200, li: 0, actor,
        pos: new THREE.Vector3(at.x, walkY(at.x, at.z) ?? groundY(at.x, at.z) ?? 1, at.z), yaw: at.yaw, home: { x: at.x, z: at.z }, target: null, wait: 1e9, moving: false, lastGreet: -1e9, bubble: null, pose, emote: null, r });
    }
  }

  /**
   * v1.15.6: add a local from elsewhere (the Open Waters islanders). def: { id, name, title, look, kind: 'roamer' |
   * 'fisher' | 'stand', x, z, yaw, roam (metres), hello: [lines], bobber: { x, z } (fishers), catch: [species ids],
   * rod, talk }. Returns the local, or null with ?nonpc.
   */
  add(def) {
    if (this.off) return null;
    const r = mulberry32(this.list.length * 7919 + (def.name.length * 131));
    const actor = new Actor(this.game.engine.scene); actor.lite = true;
    actor.setLook(def.look || randomAvatar(r), { rod: def.rod || 'rod_willow', lure: 'lure_classic', boat: 'boat_oak' });
    actor.root.visible = false;
    const npc = { ...def, kind: def.kind || 'roamer', actor, pos: new THREE.Vector3(def.x, walkY(def.x, def.z) ?? groundY(def.x, def.z) ?? 1, def.z), yaw: def.yaw ?? r() * 6.28, home: { x: def.x, z: def.z },
      target: null, wait: r() * 4, moving: false, lastGreet: -1e9, congrats: null, bubble: null, pose: 'idle', emote: null, r };
    if (npc.kind === 'fisher') { npc.cycle = 'wait'; npc.timer = 8 + r() * 25; npc.zone = zoneAt(def.bobber.x, def.bobber.z) || 'open'; }
    this.list.push(npc);
    return npc;
  }

  // The latest great catch you made (set by the game when a rare+, gold or diamond lands).
  greatCatch() {
    const c = this.game.lastGreat;
    return c && Date.now() - c.at < 5 * 60 * 1000 ? c : null;
  }

  /** You emoted: up to two locals close by turn to you and answer in kind, after a short beat. */
  onEmote(id) {
    const me = this.game.player.pos, now = performance.now();
    const near = this.list
      .map((npc) => ({ npc, d: Math.hypot(npc.pos.x - me.x, npc.pos.z - me.z) }))
      .filter(({ npc, d }) => d < 9 && npc.kind !== 'scene' && npc.actor.root.visible && now - (npc.lastReply || -1e9) > 6000)
      .sort((a, b) => a.d - b.d).slice(0, 2);
    near.forEach(({ npc }, i) => {
      const [pose, lines] = REPLIES[id] || REPLIES.wave;
      npc.lastReply = now;
      npc.reply = { at: now + 450 + i * 550 + npc.r() * 300, pose, text: lines[Math.floor(npc.r() * lines.length)] };
    });
  }

  say(npc, text, now) {
    npc.bubble = { kind: 'chat', text, until: now + 4200, key: now };
    this.game.chat?.npcSay?.(npc.name, text);
  }

  update(dt, t) {
    const g = this.game, me = g.player.pos;
    const now = performance.now();
    const you = g.profile?.name || 'friend';
    const pick = (arr, npc) => arr[Math.floor(npc.r() * arr.length)].replace('{you}', you);
    // v1.16 perf: only the nearest MAX_SHOWN people within 70 m are drawn (Hearthwick's green can hold two dozen)
    const dist = new Map(); for (const npc of this.list) dist.set(npc, Math.hypot(npc.pos.x - me.x, npc.pos.z - me.z));
    const inRange = this.list.filter((n) => dist.get(n) < 70);
    const shown = inRange.length > MAX_SHOWN ? new Set(inRange.sort((a, b) => dist.get(a) - dist.get(b)).slice(0, MAX_SHOWN)) : null;
    for (const npc of this.list) {
      const d = dist.get(npc);
      const near = d < 70 && (!shown || shown.has(npc));
      npc.actor.root.visible = near;
      // (perf: people further than SHADOW_RANGE drop their shadow: half the cost of drawing them)
      const sh = near && d < SHADOW_RANGE;
      if (near && npc.shadowOn !== sh) { npc.shadowOn = sh; npc.actor.root.traverse((o) => { if (o.isMesh && o.userData.cs !== false) { if (o.userData.cs == null) o.userData.cs = o.castShadow; o.castShadow = sh && o.userData.cs; } }); }
      if (npc.actor.line) npc.actor.line.line.visible = near && npc.kind === 'fisher';
      if (!near) { npc.actor.bobberObj && (npc.actor.bobberObj.visible = false); continue; }
      if (npc.kind === 'scene') { this.updateScene(npc, dt, t, now, d); continue; }
      // ---- greetings
      // (a new great catch gets its cheer even if they said hello a minute ago)
      const great = this.greatCatch();
      const freshNews = great && npc.congrats !== great.id && now - npc.lastGreet > 8000;
      if (d < 6.5 && (now - npc.lastGreet > 90000 || freshNews) && now - this.lastAnyGreet > 2500 && !g.ui?.modalOpen) {
        npc.lastGreet = now; this.lastAnyGreet = now;
        npc.yaw = Math.atan2(me.x - npc.pos.x, me.z - npc.pos.z);
        if (great && npc.congrats !== great.id) {
          npc.congrats = great.id;
          npc.emote = { id: 'cheer', until: now + 2800 };
          this.say(npc, pick(CONGRATS, npc).replace('{fish}', great.label), now);
          g.audio?.sfx?.('cheer', { remote: true });
        } else {
          npc.emote = { id: 'wave', until: now + 2400 };
          this.say(npc, pick(npc.hello || (npc.kind === 'fisher' ? FISHER_HELLO : HELLO), npc), now);
        }
        npc.target = null; npc.wait = 3;
      }
      // ---- v1.15.17: talking to themselves while you're near (npc.mutter: their lines, dealt in a shuffled order so
      // you hear them all before any repeats; a bubble over their head, not the chat log, so a long wait stays quiet)
      if (npc.mutter && d < 12 && !g.ui?.modalOpen && !npc.talking) {
        if (!npc.mutterAt) npc.mutterAt = now + 8000 + npc.r() * 4000;
        else if (now >= npc.mutterAt && now - npc.lastGreet > 6000 && !(npc.bubble && now < npc.bubble.until)) {
          npc.mutterAt = now + 14000 + npc.r() * 8000;
          if (!npc.mutterDeck?.length) { npc.mutterDeck = npc.mutter.map((_, i) => i); for (let i = npc.mutterDeck.length - 1; i > 0; i--) { const j = Math.floor(npc.r() * (i + 1)); [npc.mutterDeck[i], npc.mutterDeck[j]] = [npc.mutterDeck[j], npc.mutterDeck[i]]; } }
          npc.bubble = { kind: 'chat', text: npc.mutter[npc.mutterDeck.pop()].replace('{you}', you), until: now + 4800, key: now };
        }
      } else if (npc.mutter && d > 16) npc.mutterAt = 0;
      // ---- answering your emote
      if (npc.reply && now >= npc.reply.at) {
        const rep = npc.reply; npc.reply = null;
        npc.yaw = Math.atan2(me.x - npc.pos.x, me.z - npc.pos.z);
        npc.emote = { id: rep.pose, until: now + (rep.pose === 'orange' || rep.pose === 'dance' ? 3600 : 2600) };
        this.say(npc, rep.text.replace('{you}', you), now);
        npc.target = null; npc.wait = Math.max(npc.wait || 0, 3);
        if (rep.pose === 'cheer' || rep.pose === 'clap') g.audio?.sfx?.(rep.pose, { remote: true });
      }
      if (npc.bubble && now > npc.bubble.until) npc.bubble = null;
      if (npc.emote && now > npc.emote.until) npc.emote = null;
      // ---- behaviour
      let pose = 'idle', bobber = null, tension = 0;
      if (npc.talking) npc.bubble = null; // (their words are in the dialogue box)
      if (npc.kind === 'roamer') { if (!npc.talking) this.stroll(npc, dt); else npc.moving = false; } // talking: stand still and face you
      else if (npc.kind === 'stand') {
        // v1.15.6: keeps their post (a bar, a tent, a lookout); turns to you when you come close, else looks about
        npc.moving = false;
        if (!npc.talking && !npc.emote) {
          if (npc.homeYaw == null) npc.homeYaw = npc.yaw;
          const base = d < 6 ? Math.atan2(me.x - npc.pos.x, me.z - npc.pos.z) : npc.homeYaw + Math.sin(t * 0.25 + npc.home.x) * 0.5;
          let dy = base - npc.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); npc.yaw += dy * Math.min(1, dt * 3);
        }
        if (npc.idlePose && !npc.emote) pose = npc.idlePose;
      } else {
        npc.timer -= dt;
        if (npc.cycle === 'wait' && npc.timer <= 0) { npc.cycle = 'reel'; npc.timer = 2.4; }
        else if (npc.cycle === 'reel' && npc.timer <= 0) {
          npc.cycle = 'hold'; npc.timer = 3;
          const pool = npc.catch ? npc.catch.map((id) => SPECIES_BY_ID[id]).filter(Boolean) : SPECIES.filter((s) => s.zones.includes(npc.zone) && (s.tier === 'common' || s.tier === 'uncommon') && !s.shell && !s.spots);
          const sp = (pool.length ? pool : [SPECIES_BY_ID.bluegill])[Math.floor(npc.r() * Math.max(1, pool.length))];
          npc.actor.showHeld(sp.id, 'normal', (sp.weight[0] + sp.weight[1]) / 2, 3);
          g.fx?.splash?.(new THREE.Vector3(npc.bobber.x, WATER_Y, npc.bobber.z), 0.5);
        } else if (npc.cycle === 'hold' && npc.timer <= 0) { npc.cycle = 'wait'; npc.timer = 15 + npc.r() * 30; }
        if (npc.cycle !== 'hold') {
          bobber = { x: npc.bobber.x, z: npc.bobber.z, dunk: npc.cycle === 'reel' ? 0.6 + Math.sin(t * 20) * 0.3 : (Math.sin(t * 1.3 + npc.home.x) > 0.97 ? 0.3 : 0) };
          pose = npc.cycle === 'reel' ? 'reel' : 'wait';
          tension = npc.cycle === 'reel' ? 0.5 : 0;
        }
        if (!npc.emote) npc.yaw += (Math.atan2(npc.bobber.x - npc.pos.x, npc.bobber.z - npc.pos.z) - npc.yaw) * Math.min(1, dt * 2);
      }
      if (npc.emote) { pose = npc.emote.id; bobber = npc.kind === 'fisher' ? bobber : null; }
      npc.pos.y = walkY(npc.pos.x, npc.pos.z) ?? groundY(npc.pos.x, npc.pos.z) ?? npc.pos.y;
      npc.actor.update(dt, t, { x: npc.pos.x, y: npc.pos.y, z: npc.pos.z, yaw: npc.yaw, mode: 'shore', pose, moving: npc.moving && !npc.emote, bobber: npc.emote ? null : bobber, tension, rod: npc.kind === 'fisher' ? 'hand' : 'back', seat: npc.seat || 0, seatYaw: npc.seat ? npc.seatYaw : undefined }); // (v1.17.1: `seat` = sitting on a bench that high, facing seatYaw)
    }
  }

  /** The trailer park scene: they hold their poses, trade lines, and Maria's tears fall. */
  updateScene(npc, dt, t, now, d) {
    npc.pos.y = walkY(npc.pos.x, npc.pos.z) ?? groundY(npc.pos.x, npc.pos.z) ?? npc.pos.y;
    if (npc.bubble && now > npc.bubble.until) npc.bubble = null;
    if (d < 34 && now > npc.lineAt) {
      const gap = (npc.scenePose === 'yell' ? 5200 : 10400) + npc.r() * 1500;
      npc.bubble = { kind: 'chat', text: npc.lines[npc.li++ % npc.lines.length], until: now + Math.min(4800, gap * 0.85), key: now };
      npc.lineAt = now + gap;
    }
    if (npc.actor.rod) npc.actor.rod.visible = false;
    npc.actor.update(dt, t, { x: npc.pos.x, y: npc.pos.y, z: npc.pos.z, yaw: npc.yaw, mode: 'shore', pose: npc.scenePose, moving: false, bobber: null, tension: 0, rod: 'back' });
    if (npc.scenePose === 'cry') this.tears(npc, dt, d);
  }

  /** Tears: little drops that slip out from behind her hands and fall to the ground. */
  tears(npc, dt, d) {
    if (!this.tearFx) {
      const N = 40;
      const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.9 }), N);
      mesh.frustumCulled = false;
      this.game.engine.scene.add(mesh);
      this.tearFx = { mesh, drops: Array.from({ length: N }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() })), next: 0, acc: 0, m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    }
    const fx = this.tearFx;
    fx.mesh.visible = d < 40;
    if (!fx.mesh.visible) return;
    fx.acc += dt * 9; // drops a second
    const head = npc.actor.headWorld(new THREE.Vector3());
    const fx0 = Math.sin(npc.yaw), fz0 = Math.cos(npc.yaw), sx = Math.cos(npc.yaw), sz = -Math.sin(npc.yaw);
    while (fx.acc >= 1) {
      fx.acc -= 1;
      const dr = fx.drops[fx.next++ % fx.drops.length];
      const side = npc.r() < 0.5 ? -1 : 1;
      // from the cheeks, just below and in front of the hands
      dr.p.set(head.x + fx0 * 0.3 + sx * side * (0.12 + npc.r() * 0.08), head.y - 0.62 - npc.r() * 0.1, head.z + fz0 * 0.3 + sz * side * (0.12 + npc.r() * 0.08));
      dr.v.set(fx0 * 0.35 + sx * side * 0.15 * npc.r(), 0.2 + npc.r() * 0.3, fz0 * 0.35 + sz * side * 0.15 * npc.r());
      dr.life = 1; dr.ground = npc.pos.y;
    }
    for (let i = 0; i < fx.drops.length; i++) {
      const dr = fx.drops[i];
      if (dr.life > 0) {
        dr.v.y -= 9.8 * dt;
        dr.p.addScaledVector(dr.v, dt);
        if (dr.p.y <= dr.ground + 0.02) dr.life = 0;
      }
      const k = dr.life > 0 ? 1 : 0;
      fx.s.set(k * 0.8, k * 1.6, k * 0.8); // a stretched drop
      fx.m.compose(dr.p, fx.q, fx.s);
      fx.mesh.setMatrixAt(i, fx.m);
    }
    fx.mesh.instanceMatrix.needsUpdate = true;
  }

  stroll(npc, dt) {
    npc.moving = false;
    if (npc.emote) return;
    if (!npc.target) {
      npc.wait -= dt;
      if (npc.wait > 0) return;
      for (let i = 0; i < 8; i++) {
        const R = npc.roam || 24, x = npc.home.x + (npc.r() - 0.5) * R, z = npc.home.z + (npc.r() - 0.5) * R;
        if (walkable(x, z)) { npc.target = { x, z }; break; }
      }
      npc.wait = 2 + npc.r() * 6;
      return;
    }
    const dx = npc.target.x - npc.pos.x, dz = npc.target.z - npc.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.3) { npc.target = null; return; }
    const step = Math.min(dist, 1.7 * dt);
    const nx = npc.pos.x + (dx / dist) * step, nz = npc.pos.z + (dz / dist) * step;
    if (!walkable(nx, nz)) { npc.target = null; return; }
    npc.pos.x = nx; npc.pos.z = nz; npc.moving = true;
    let dy = Math.atan2(dx, dz) - npc.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    npc.yaw += dy * Math.min(1, dt * 8);
  }

  // For nameplates and bubbles.
  plates(toScreen) {
    const out = [];
    const me = this.game.player.pos;
    for (const npc of this.list) {
      if (!npc.actor.root.visible) continue;
      const d = Math.hypot(npc.pos.x - me.x, npc.pos.z - me.z);
      const asking = this.game.quests?.isAsking(npc.id);
      if (d > NEAR_RANGE) continue; // v1.11: nameplates within about 40 yards only
      const accepted = asking && this.game.quests.d.quests.npc?.accepted;
      out.push({ id: npc.id, name: asking ? `✉ ${npc.name}` : npc.name, title: asking ? (accepted ? 'Waiting on your fish' : 'Has a request') : npc.title || (npc.kind === 'fisher' ? 'Local angler' : 'Local'), level: 0, screen: toScreen(npc.actor.headWorld()), bubble: npc.bubble, npc: true });
    }
    return out;
  }
}
