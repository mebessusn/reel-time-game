// Frostmere (v1.17.2): reasons to go out. The trail huts (light the stove: warmth, and a line in the ledger), Galena (relight the street lamps and the old shaft gives up its secret), Ember Hollow
// (soak in the hot pools, fish them) and the Valiant (climb aboard the wreck and search her).
import * as THREE from 'three';
import { toWorld, toLocal, P, WATER_Y, ICE_Y } from './geo.js';
import { HUTS, GALENA, GALENA_LAMPS, GALENA_SHAFT, HOLLOW_PIECES, SOAK, buildSite } from './sites.js';
import { LOG_PAGES } from './wild.js';
import { addCircle, addSolidFn } from '../world/colliders.js';
import { natureMaterial } from '../world/nature.js';
import { placeModels } from '../world/polyfork.js';
import { northSfx } from './sounds.js';

export const LEDGER = {
  taiga: 'Ansel built this one. "If you are reading this you were lost. Burn what you need. Cut more before you go."',
  shore: 'Skye, in pencil: "Weather turned at the shore. Sat it out here with a tin of beans. Best night of the year."',
  tundra: 'June\'s hand: "Pepper found this hut in a whiteout, nose down the whole way. Good dog. Best dog."',
  point: 'Dr. Vale: "Bears 40 yards off at dawn. Kept the stove low. They only want the fish, and I only want the photographs."',
  pass: 'Unsigned: "Galena men came through here with silver in their boots. None of them came back this way."',
  south: 'Torvald: "Nothing to report. Fine stove. Good place to think about fish."',
};
const GALENA_NOTES = [
  'A note in the lamp\'s base: "Galena, founded on silver and bad advice. Pop. 212."',
  'Scratched in the post: "Shaft 2 flooded Oct. 9th. Foreman says it\'s nothing."',
  'A letter, unsent: "They say the seam runs under the ice. We have stopped asking where the water comes from."',
  'A pay slip, unclaimed: "M. Lund, formerly of the schooner Valiant. Paid in full."',
  'Chalked on the lamp: "Last one out, leave the lights on."',
];
const LANTERN_WARM = 7, HUT_R = 6;

export class Expeditions {
  constructor(north) { this.north = north; this.game = north.game; this.soak = null; this.aboard = false; this.lamps = []; this.huts = []; }
  ground(x, z) { return this.north.groundAt(x, z) ?? ICE_Y; }
  build(group) {
    const G = this.group = new THREE.Group(); G.name = 'north-expeditions'; group.add(G);
    const g = (x, z) => this.ground(x, z);
    // ---- the huts
    const pieces = HUTS.map((H) => [H.model, H.u, H.v, H.ry]);
    buildSite(G, 'north-huts', pieces, g);
    const smokeMat = new THREE.MeshBasicMaterial({ color: '#ffd090', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.RingGeometry(0.55, 0.75, 20).rotateX(-Math.PI / 2);
    for (const H of HUTS) {
      const w = toWorld(H.u, H.v), door = { x: w.x + Math.sin(H.ry) * 4.6, z: w.z + Math.cos(H.ry) * 4.6 };
      this.huts.push({ ...H, x: w.x, z: w.z, door, y: g(door.x, door.z), glow: null });
      const m = new THREE.Mesh(ring, smokeMat); m.position.set(door.x, g(door.x, door.z) + 0.06, door.z); G.add(m); this.huts[this.huts.length - 1].glow = m;
    }
    this.hutGlow = smokeMat;
    // ---- Galena
    const gal = buildSite(G, 'north-galena', GALENA, g), gw = toWorld(P.galena.u, P.galena.v);
    this.cull = [[gal, gw]];
    const lampItems = GALENA_LAMPS.map(({ u, v }) => { const w = toWorld(u, v); return { m: 'street-oil-lamp', x: w.x, z: w.z, ry: 0, y: g(w.x, w.z) - 0.05, solid: 0.25 }; });
    G.add(placeModels('north-galena-lamps', lampItems));
    const glow = new THREE.SphereGeometry(0.2, 8, 6), mat = new THREE.MeshBasicMaterial({ color: '#ffc870' });
    GALENA_LAMPS.forEach(({ u, v }, i) => {
      const w = toWorld(u, v), y = g(w.x, w.z), m = new THREE.Mesh(glow, mat);
      m.position.set(w.x, y + 2.75, w.z); m.visible = false; G.add(m);
      this.lamps.push({ i, x: w.x, z: w.z, y: y + 1.2, m });
    });
    const sh = toWorld(GALENA_SHAFT.u, GALENA_SHAFT.v); this.shaft = { x: sh.x + 2.8, z: sh.z, y: g(sh.x + 2.8, sh.z) };
    // ---- Ember Hollow
    this.cull.push([buildSite(G, 'north-hollow', HOLLOW_PIECES, g), toWorld(P.hollow.u, P.hollow.v)]);
    this.pools = SOAK.map((p) => { const w = toWorld(p.u, p.v); return { ...p, x: w.x, z: w.z }; });
    // the steam: soft puffs rising off each pool and fading out (one draw for all of them)
    const N = 90, pos = new Float32Array(N * 3); this.steam = { pos, life: new Float32Array(N).map(() => Math.random()), home: new Uint8Array(N).map((_, i) => i % this.pools.length) };
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(16, 16, 1, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, 32, 32);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.steamM = new THREE.Points(sg, new THREE.PointsMaterial({ size: 3.6, map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.32, depthWrite: false, color: '#f4f8fa', sizeAttenuation: true })); this.steamM.frustumCulled = false; G.add(this.steamM);
    // ---- the Valiant: a deck you can stand on, reached by a rope ladder on her lee side
    const V = P.wreck, w = toWorld(V.u, V.v);
    this.ship = { x: w.x, z: w.z, ry: 0.7, deck: ICE_Y + 2.25 };
    const toShip = (x, z) => { const dx = x - w.x, dz = z - w.z, c = Math.cos(0.7), s = Math.sin(0.7); return [dx * c - dz * s, dx * s + dz * c]; };
    this.toShip = toShip;
    // aboard, the rail keeps you on deck (off the deck the hull circles in wild.js stop you, and they stand aside while you're up here)
    addSolidFn((x, z, r) => { if (!this.aboard) return false; const [a, b] = toShip(x, z); return Math.abs(a) > 1.3 - r || Math.abs(b) > 5.2 - r; });
    const put = (a, b) => { const c = Math.cos(0.7), s = Math.sin(0.7); return { x: w.x + a * c + b * s, z: w.z - a * s + b * c }; };
    this.ladder = put(-2.7, -1); this.ladderDeck = put(-1, -1);
    this.spots = [
      { id: 'hold', ...put(0, 3.2), label: 'Search the hold', find: 'Tins of salt pork, frozen solid, and a sailor\'s sea chest. Inside, a carved whalebone comb.', reward: { coins: 300, xp: 200 } },
      { id: 'galley', ...put(0.3, -2.2), label: 'Search the galley', find: 'The cook\'s ledger. The last entry just says: "Fish. Again. Thank God."', reward: { coins: 300, xp: 200 } },
      { id: 'cabin', ...put(-0.1, -4.2), label: 'Open the captain\'s chest', find: 'Hale\'s sextant, his pipe, and a letter to his wife that he never got to send. You take the letter to Grandma Elsi.', reward: { coins: 1500, xp: 900, pearls: 10 }, needs: true },
    ];
    const crate = [
      { m: 'cargo-crate', ...put(0, 3.2), ry: 0.7, y: this.ship.deck, solid: false },
      { m: 'cargo-crate', ...put(0.3, -2.2), ry: 1.2, y: this.ship.deck, solid: false },
      { m: 'treasure-chest', ...put(-0.1, -4.2), ry: 0.7, y: this.ship.deck, solid: false },
    ];
    G.add(placeModels('north-valiant-gear', crate, { colliders: false }));
    addCircle(this.ladder.x, this.ladder.z, 0.1);
  }
  floorAt(x, z) { if (!this.aboard) return null; const [a, b] = this.toShip(x, z); return Math.abs(a) < 1.6 && Math.abs(b) < 5.6 ? this.ship.deck : null; }
  litHuts() { return this.north.d.huts || {}; }
  warmSource() {
    const p = this.game.player.pos;
    if (this.soak) return [14, 'Soaking'];
    for (const H of this.huts) if (this.litHuts()[H.id] && Math.hypot(H.door.x - p.x, H.door.z - p.z) < HUT_R) return [LANTERN_WARM, 'By the hut stove'];
    return null;
  }
  update(dt, t) {
    const g = this.game, me = g.player.pos, d = this.north.d;
    for (const [m, q] of this.cull) m.visible = Math.hypot(q.x - me.x, q.z - me.z) < 300; // (far places cost nothing)
    this.hutGlow.opacity = 0.35 + Math.sin(t * 2) * 0.15;
    for (const H of this.huts) H.glow.visible = !this.litHuts()[H.id] && Math.hypot(H.x - me.x, H.z - me.z) < 40;
    for (const L of this.lamps) L.m.visible = !!d.lamps?.[L.i] && Math.hypot(L.x - me.x, L.z - me.z) < 300;
    { // the steam, only while you're near enough to see it
      const S = this.steam, P0 = this.pools[0], on = Math.hypot(P0.x - me.x, P0.z - me.z) < 170; this.steamM.visible = on;
      if (on) {
        for (let i = 0; i < S.life.length; i++) {
          S.life[i] -= dt * 0.28;
          if (S.life[i] <= 0) { S.life[i] = 1; const p = this.pools[S.home[i]], a = Math.random() * 6.28, r = Math.random() * p.r * 0.8; S.pos[i * 3] = p.x + Math.cos(a) * r; S.pos[i * 3 + 1] = WATER_Y; S.pos[i * 3 + 2] = p.z + Math.sin(a) * r; }
          S.pos[i * 3 + 1] += dt * 1.1; S.pos[i * 3] += dt * 0.25;
        }
        this.steamM.geometry.attributes.position.needsUpdate = true;
      }
    }
    this.mist = (this.mist || 0) - dt;
    if (this.mist <= 0) {
      this.mist = 0.2;
      for (const H of this.huts) if (this.litHuts()[H.id] && Math.abs(H.x - me.x) < 90 && Math.abs(H.z - me.z) < 90 && Math.random() < 0.5) g.fx.smoke(new THREE.Vector3(H.x, H.y + 5, H.z));
    }
    if (this.aboard) { // (the bulwarks: you stay on her deck until you take the ladder)
      const p = g.player, [a, b] = this.toShip(p.pos.x, p.pos.z), A = Math.max(-1.15, Math.min(1.15, a)), B = Math.max(-5, Math.min(5, b));
      if (A !== a || B !== b) { const c = Math.cos(0.7), s = Math.sin(0.7); p.pos.x = this.ship.x + A * c + B * s; p.pos.z = this.ship.z - A * s + B * c; }
      p.pos.y = this.ship.deck; p.baseY = this.ship.deck;
    }
    if (this.soak) {
      const p = g.player;
      p.pos.set(this.soak.x, WATER_Y - 0.1, this.soak.z); p.baseY = p.pos.y; p.moving = false;
      if ((d.soaks || 0) === 0 && !this.soakTold) { this.soakTold = true; g.ext.change((q) => { q.north.soaks = 1; }); g.reward('north', 'hollow-first', { coins: 200, xp: 150 }, 'Your first soak in Ember Hollow'); }
      if (p.keys?.size || p.stick) this.leavePool();
    }
  }
  control() { return !!this.soak; }
  enterPool(P0) {
    const g = this.game, p = g.player, me = p.pos, a = Math.atan2(me.x - P0.x, me.z - P0.z);
    this.soak = { x: P0.x + Math.sin(a) * (P0.r - 1.5), z: P0.z + Math.cos(a) * (P0.r - 1.5), back: { x: me.x, z: me.z, y: me.y } };
    p.yaw = a + Math.PI; g.audio.sfx('splash'); g.ui.toast('Warm as a bath. Move to climb out.', { title: 'Ember Hollow', icon: 'star', ms: 3500 });
  }
  leavePool() { const p = this.game.player, s = this.soak; if (!s) return; this.soak = null; p.pos.set(s.back.x, s.back.y, s.back.z); p.baseY = s.back.y; p.vy = 0; }
  climb(on) {
    const g = this.game, p = g.player, q = on ? this.ladderDeck : { x: this.ladder.x - Math.sin(0.7 + Math.PI / 2) * -0.8, z: this.ladder.z - Math.cos(0.7 + Math.PI / 2) * -0.8 };
    this.aboard = on;
    const y = on ? this.ship.deck : this.ground(q.x, q.z);
    p.pos.set(q.x, y, q.z); p.baseY = y; p.vy = 0; p.target = null; g.audio.sfx('creak');
    g.engine.cam.target.set(q.x, y + 0.8, q.z);
    if (on && !this.north.d.aboard) { g.ext.change((d) => { d.north.aboard = 1; }); g.ui.toast('The deck groans under you. Nobody has stood here in a hundred years.', { title: 'The Valiant', icon: 'star', ms: 5000 }); }
  }
  search(s) {
    const g = this.game, d = this.north.d;
    if (s.needs && Object.keys(d.pages || {}).length < LOG_PAGES.length) { g.ui.toast(`Locked. The key must be in the captain's log: find all ${LOG_PAGES.length} pages (${Object.keys(d.pages || {}).length} so far).`, { title: 'The Valiant', icon: 'lock', ms: 5000 }); return; }
    g.ext.change((q) => { q.north.searched = { ...(q.north.searched || {}), [s.id]: 1 }; });
    g.ui.toast(s.find, { title: 'The Valiant', icon: 'scroll', ms: 7000 });
    g.reward('north', `valiant-${s.id}`, s.reward, s.label);
  }
  lightHut(H) {
    const g = this.game;
    g.ext.change((d) => { d.north.huts = { ...(d.north.huts || {}), [H.id]: Date.now() }; });
    g.audio.sfx('toggle'); northSfx(g.audio, 'crack', { vol: 0.3 });
    g.ui.toast(LEDGER[H.id], { title: `${H.name}: the ledger`, icon: 'scroll', ms: 8000 });
    const n = Object.keys(this.litHuts()).length;
    g.reward('north', `hut-${H.id}`, { coins: 120, xp: 100 }, `${H.name} lit`);
    if (n === HUTS.length) g.reward('north', 'huts-all', { coins: 1000, xp: 700, pearls: 8, title: 'Trail Keeper' }, 'Every hut in the north');
    this.north.onEvent('hut', { id: H.id });
  }
  lightLamp(L) {
    const g = this.game;
    g.ext.change((d) => { d.north.lamps = { ...(d.north.lamps || {}), [L.i]: 1 }; });
    g.audio.sfx('toggle');
    g.ui.toast(GALENA_NOTES[L.i], { title: 'Galena', icon: 'scroll', ms: 7500 });
    const n = Object.keys(this.north.d.lamps || {}).length;
    if (n === GALENA_LAMPS.length) g.ui.toast('Every lamp in Galena is burning. Something shifts down at the old headframe.', { title: 'Galena', icon: 'star', ms: 6000 });
  }
  openShaft() {
    const g = this.game;
    g.ext.change((d) => { d.north.shaft = 1; });
    northSfx(g.audio, 'crack', { vol: 0.8 }); g.engine.shake = 0.5;
    g.ui.toast('The boards fall in. Far below, cold water, and a seam of silver running out under the lake, just as the letter said.', { title: 'Shaft 2', icon: 'star', ms: 8000 });
    g.reward('north', 'galena-shaft', { coins: 1500, xp: 900, pearls: 10, title: 'Last Miner of Galena' }, 'The secret of Galena');
  }
  contextActions() {
    const g = this.game, me = g.player.pos, d = this.north.d, out = [];
    const near = (q, r) => Math.hypot(q.x - me.x, q.z - me.z) < r;
    if (this.soak) return [{ id: 'pool-out', label: 'Climb out', color: 'green', fn: () => this.leavePool() }];
    if (this.aboard) {
      if (near(this.ladderDeck, 2)) out.push({ id: 'valiant-down', label: 'Climb down', color: 'green', fn: () => this.climb(false) });
      for (const s of this.spots) if (near(s, 2.2) && !d.searched?.[s.id]) out.push({ id: `valiant-${s.id}`, label: s.label, color: 'gold', fn: () => this.search(s) });
      return out;
    }
    if (near(this.ladder, 2.4)) out.push({ id: 'valiant-up', label: 'Climb the rope ladder', color: 'gold', fn: () => this.climb(true) });
    for (const H of this.huts) if (near(H.door, 2.8)) {
      if (!d.huts?.[H.id]) out.push({ id: `hut-${H.id}`, label: 'Light the stove', color: 'gold', fn: () => this.lightHut(H) });
    }
    for (const L of this.lamps) if (near(L, 2.4) && !d.lamps?.[L.i]) out.push({ id: `lamp-${L.i}`, label: 'Light the lamp', color: 'gold', fn: () => this.lightLamp(L) });
    if (near(this.shaft, 3.4) && !d.shaft) {
      const n = Object.keys(d.lamps || {}).length;
      out.push(n >= GALENA_LAMPS.length ? { id: 'shaft', label: 'Pry open Shaft 2', color: 'gold', fn: () => this.openShaft() } : { id: 'shaft', label: `Shaft 2 is boarded shut (${n}/${GALENA_LAMPS.length} lamps lit)`, fn: () => g.ui.toast('The town is dark. Relight the street lamps first.', { icon: 'lock' }) });
    }
    for (const p of this.pools) if (Math.hypot(p.x - me.x, p.z - me.z) < p.r + 1.8) out.push({ id: 'soak', label: 'Soak in the hot pool', color: 'gold', fn: () => this.enterPool(p) });
    return out;
  }
}
export { toLocal, natureMaterial };
