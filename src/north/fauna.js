// Frostmere: the wildlife and the legends.
//   Polar bears on the coast by Bear Point: they wander and sniff the air; get too close and one huffs, rears up and
//   comes over. Back off and it leaves you be; toss it a fish and it sits down to eat; otherwise it noses in, takes
//   your latest catch and ambles off. Cozy, never a fight. A mother with two cubs that tumble about by the den.
//   Arctic foxes pounce into the snow, a caribou herd drifts across the tundra, musk oxen stand in a ring (facing out
//   when you come near), seals and walrus haul out on the sea ice (seals slip into the water if you crowd them),
//   narwhals surface in the open lead, snowy owls sit on the cabin roofs, ravens hop about the shanties.
//   The legends: Old Whitepaw (a huge silvered bear at Bear Point, only on aurora nights), the Frost Stag (a white
//   elk at the taiga's edge at dusk in a snowfall, gone in a swirl of snow if you get close) and the Thing Under the
//   Ice (a vast shadow passing under the clear black ice of the deep basin, with a boom and a crack).
//   The Field Guide's Frostmere chapter: photograph each (E when one's close and in view).
import * as THREE from 'three';
import { FROSTWILD_MATS, FROSTWILD_NODES } from '../data/frostwildMesh.js';
import { addLibrary, mergedMesh, instanced } from './instancing.js';
import { QuadPack, KINDS } from './quads.js';
import { toWorld, toLocal, kindAt, isIce, isOpen, K, P, ICE_Y, WATER_Y, coastV, floeV, zoneOf } from './geo.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { northSfx } from './sounds.js';
import { shoot } from '../ui/polaroid.js';

addLibrary(FROSTWILD_MATS, FROSTWILD_NODES);

export const NORTH_GUIDE = [
  { id: 'bear', name: 'Polar bear', set: 'wild', desc: 'Along the coast by Bear Point. Keep your distance, or bring a fish.' },
  { id: 'cubs', name: 'Polar bear cubs', set: 'wild', desc: 'Two cubs tumbling about by their mother\'s den on Bear Point.' },
  { id: 'fox', name: 'Arctic fox', set: 'wild', desc: 'White as the snow. Listen for the pounce at the forest edge.' },
  { id: 'caribou', name: 'Caribou', set: 'wild', desc: 'A herd drifts across the eastern tundra.' },
  { id: 'muskox', name: 'Musk oxen', set: 'wild', desc: 'Shaggy, stubborn, and always in a ring on the northern hills.' },
  { id: 'owl', name: 'Snowy owl', set: 'wild', desc: 'Perched on the rooftops of Hearthwick, watching everything.' },
  { id: 'seal', name: 'Ringed seal', set: 'coast', desc: 'Basking on the sea ice. Creep up quietly.' },
  { id: 'walrus', name: 'Walrus', set: 'coast', desc: 'Hauled out on the floes at the edge of the ice.' },
  { id: 'narwhal', name: 'Narwhal', set: 'coast', desc: 'Surfacing in the open lead beyond the floe edge. Look for the tusk.' },
  { id: 'ibex', name: 'Alpine ibex', set: 'wild', desc: 'Up on Aurora Hill and the Skyline slopes, where nothing else can stand.' },
  { id: 'hare', name: 'Mountain hare', set: 'wild', desc: 'Round the taiga. Quick. You\'ll need to creep up.' },
  { id: 'raven', name: 'Raven', set: 'coast', desc: 'Hopping round the shanties after anyone\'s bait.' },
  { id: 'whitepaw', name: 'Old Whitepaw', set: 'legend', desc: 'A giant silvered bear, seen only at Bear Point when the northern lights are out.' },
  { id: 'stag', name: 'The Frost Stag', set: 'legend', desc: 'A white elk with antlers like the aurora. The taiga\'s edge, at dusk, in a snowfall.' },
  { id: 'thing', name: 'The Thing Under the Ice', set: 'legend', desc: 'Something vast moves under the clear black ice of the deep basin. Nobody knows what.' },
];
export const GUIDE_SETS_NORTH = {
  wild: { name: 'The Tundra', reward: { coins: 800, xp: 400, pearls: 5 } },
  coast: { name: 'The Coast', reward: { coins: 800, xp: 400, pearls: 5 } },
  legend: { name: 'Legends of the North', reward: { coins: 1500, xp: 800, pearls: 10 } },
};
const rnd = (a, b) => a + Math.random() * (b - a);

export class Fauna {
  constructor(north) { this.north = north; this.game = north.game; this.built = false; this.v = new THREE.Vector3(); }
  ground(x, z) { return this.north.groundAt(x, z) ?? ICE_Y; }
  W(u, v) { return toWorld(u, v); }

  build(group) {
    this.group = new THREE.Group(); this.group.name = 'north-fauna'; group.add(this.group);
    const G = this.group;
    // ---- polar bears: two roamers on the coast, a mother and two cubs at the den, and Old Whitepaw
    this.bears = new QuadPack(G, KINDS.bear, 6, { scales: [1, 1, 1, 0.45, 0.42, 1.5], tints: [null, null, null, null, null, '#cfe0f0'] });
    const BP = this.W(P.bearpoint.u, P.bearpoint.v);
    this.bearAI = this.bears.list.map((a, i) => {
      const home = i < 2 ? this.W(120 + i * 110, -228) : i < 5 ? { x: BP.x + 6, z: BP.z + 4 } : { x: BP.x - 4, z: BP.z - 10 };
      a.x = home.x + rnd(-8, 8); a.z = home.z + rnd(-8, 8); a.y = this.ground(a.x, a.z); a.yaw = rnd(0, 6.28);
      return { a, home, role: i < 3 ? 'adult' : i < 5 ? 'cub' : 'whitepaw', state: 'wander', t: rnd(0, 4), tgt: null, range: i < 2 ? 40 : 14 };
    });
    // ---- foxes, caribou, musk oxen
    this.foxes = new QuadPack(G, KINDS.fox, 3);
    this.foxAI = this.foxes.list.map((a, i) => { const h = this.W([-200, -120, 230][i], [210, 230, 150][i]); a.x = h.x; a.z = h.z; a.y = this.ground(a.x, a.z); return { a, home: h, t: rnd(0, 3), tgt: null, range: 30 }; });
    this.caribou = new QuadPack(G, KINDS.caribou, 8, { scales: [1, 0.95, 1.05, 0.9, 1, 0.8, 0.98, 1.1] });
    this.herd = { a: this.W(200, -120), b: this.W(300, 60), k: 0, dir: 1 };
    this.caribouAI = this.caribou.list.map((a, i) => { const off = { x: rnd(-9, 9), z: rnd(-9, 9) }; a.x = this.herd.a.x + off.x; a.z = this.herd.a.z + off.z; a.y = this.ground(a.x, a.z); return { a, off, graze: rnd(0, 5) }; });
    this.oxen = new QuadPack(G, KINDS.muskox, 5);
    this.oxHome = this.W(-40, -150);
    this.oxen.list.forEach((a, i) => { const ang = i / 5 * Math.PI * 2; a.x = this.oxHome.x + Math.sin(ang) * 3; a.z = this.oxHome.z + Math.cos(ang) * 3; a.y = this.ground(a.x, a.z); a.yaw = ang + Math.PI; a.ang = ang; });
    // ---- the Frost Stag (hidden until it appears)
    this.stagPack = new QuadPack(G, KINDS.stag, 1);
    this.stag = { a: this.stagPack.list[0], on: false, t: 0, cool: 30 };
    this.stag.a.visible = false;
    // ---- seals and walrus on the sea ice, narwhals in the lead
    this.seals = [-60, 10, 90, 150].map((u) => { const v = floeV(u) + 6, w = this.W(u, v), m = mergedMesh('fw_seal'); m.position.set(w.x, ICE_Y, w.z); m.rotation.y = rnd(0, 6); G.add(m); return { m, x: w.x, z: w.z, gone: 0 }; });
    this.walrus = [-150, -110, 60].map((u, i) => { const v = floeV(u) + 4 + i, w = this.W(u, v), m = mergedMesh('fw_walrus'); m.position.set(w.x, ICE_Y, w.z); m.rotation.y = rnd(0, 6); G.add(m); return { m, x: w.x, z: w.z, ph: rnd(0, 6) }; });
    this.narwhals = [0, 1, 2].map((i) => { const m = mergedMesh('fw_narwhal'); G.add(m); return { m, u: -40 + i * 60, ph: i * 2.1, v0: 0 }; });
    // ---- owls on the rooftops, ravens round the shanties
    const V = this.north.village;
    this.owls = ['cabin2', 'cabin4', 'trading'].map((id, i) => { const b = V && (V.group.children.find((o) => o.name === ({ cabin2: 'hw_cabin_yellow', cabin4: 'hw_cabin_green', trading: 'hw_tradingpost' })[id])); const m = mergedMesh('fw_owl'); if (b) { m.position.set(b.position.x, b.position.y + (id === 'trading' ? 7.6 : 6.1), b.position.z); m.rotation.y = b.rotation.y + i; } G.add(m); return { m, base: m.rotation.y, ph: i }; });
    this.ravens = Array.from({ length: 4 }, (_, i) => {
      const g = new THREE.Group(), body = mergedMesh('fw_raven', { shadow: false }), wl = mergedMesh('fw_raven_wing', { shadow: false }), wr = mergedMesh('fw_raven_wing', { shadow: false });
      wl.position.set(0.06, 0.2, 0.05); wr.position.set(-0.06, 0.2, 0.05); wr.scale.x = -1; g.add(body, wl, wr); G.add(g);
      const sh = V?.shanties[i * 3 % (V?.shanties.length || 1)] || { x: this.W(60, 108).x, z: this.W(60, 108).z };
      const r = { g, wl, wr, x: sh.x + 3, z: sh.z + 2, y: ICE_Y, tx: null, fly: 0, t: rnd(0, 3), home: { x: sh.x, z: sh.z } };
      g.position.set(r.x, r.y, r.z);
      return r;
    });
    // ---- the Thing Under the Ice: a vast soft shadow under the ice sheet
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0, depthWrite: false }));
    sh.scale.set(6, 1, 22); sh.renderOrder = 2; sh.visible = false; G.add(sh);
    this.thing = { m: sh, t: 120 + rnd(0, 120), on: false };
    this.built = true;
  }

  // ---------------------------------------------------------------- each frame
  update(dt, t) {
    if (!this.built) return;
    const g = this.game, N = this.north, me = g.player.pos, night = g.engine.sky.night || 0;
    const near = (x, z, r) => Math.abs(x - me.x) < r && Math.abs(z - me.z) < r;
    this.updateBears(dt, t, near);
    // foxes: trot about, now and then a pounce into the snow
    for (const F of this.foxAI) {
      const a = F.a;
      if (!near(a.x, a.z, 160)) continue;
      F.t -= dt;
      if (a.hopT > 0) { a.hopT -= dt; a.hop = Math.sin((1 - a.hopT / 0.7) * Math.PI) * 0.7; if (a.hopT <= 0) { a.hop = 0; for (let i = 0; i < 10; i++) g.fx.spawn(a.x + Math.sin(a.yaw) * 0.4, a.y + 0.1, a.z + Math.cos(a.yaw) * 0.4, rnd(-1, 1), rnd(0.5, 1.5), rnd(-1, 1), '#ffffff', 0.5, -6); } }
      else if (F.tgt) { if (this.walkTo(a, F.tgt, 3.2, dt)) { F.tgt = null; a.gait = 'stand'; } }
      else if (F.t <= 0) {
        F.t = rnd(2, 6);
        if (Math.random() < 0.35) { a.hopT = 0.7; a.gait = 'stand'; }
        else { F.tgt = { x: F.home.x + rnd(-F.range, F.range), z: F.home.z + rnd(-F.range, F.range) }; a.gait = 'trot'; }
      }
      a.y = this.ground(a.x, a.z);
    }
    this.foxes.update(dt);
    // the caribou herd drifts between two grazing grounds
    const H = this.herd;
    if (near((H.a.x + H.b.x) / 2, (H.a.z + H.b.z) / 2, 260)) {
      H.k += dt * 0.004 * H.dir; if (H.k > 1 || H.k < 0) { H.dir *= -1; H.k = Math.max(0, Math.min(1, H.k)); }
      const cx = H.a.x + (H.b.x - H.a.x) * H.k, cz = H.a.z + (H.b.z - H.a.z) * H.k, hy = Math.atan2(H.b.x - H.a.x, H.b.z - H.a.z) + (H.dir < 0 ? Math.PI : 0);
      for (const C of this.caribouAI) {
        const a = C.a, tx = cx + C.off.x, tz = cz + C.off.z, d = Math.hypot(tx - a.x, tz - a.z);
        C.graze -= dt;
        if (d > 2.5) { this.walkTo(a, { x: tx, z: tz }, d > 8 ? 3 : 1.2, dt); a.gait = d > 8 ? 'trot' : 'walk'; }
        else { a.gait = 'stand'; if (C.graze < 0) { C.graze = rnd(3, 8); a.yaw = hy + rnd(-1, 1); } }
        a.y = this.ground(a.x, a.z);
      }
      this.caribou.update(dt);
    }
    // musk oxen: grazing loosely, or a tight ring facing out when you come close
    const ring = near(this.oxHome.x, this.oxHome.z, 22);
    for (const a of this.oxen.list) {
      const r = ring ? 2.2 : 4 + Math.sin(t * 0.1 + a.i) * 1.5, tx = this.oxHome.x + Math.sin(a.ang) * r, tz = this.oxHome.z + Math.cos(a.ang) * r;
      if (Math.hypot(tx - a.x, tz - a.z) > 0.3) { this.walkTo(a, { x: tx, z: tz }, 1.5, dt); a.gait = 'walk'; } else { a.gait = 'stand'; const want = ring ? a.ang : a.ang + Math.PI + Math.sin(t * 0.2 + a.i); let d = want - a.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); a.yaw += d * Math.min(1, dt * 2); }
      a.y = this.ground(a.x, a.z);
    }
    this.oxen.update(dt);
    // seals slip into the water when crowded, and come back later; walrus breathe; narwhals surface in the lead
    for (const s of this.seals) {
      const d = Math.hypot(s.x - me.x, s.z - me.z);
      if (!s.gone && d < 7) { s.gone = rnd(25, 45); s.m.visible = false; g.fx.splash?.(new THREE.Vector3(s.x, WATER_Y, s.z), 0.8); northSfx(g.audio, 'splash', { vol: 0.4 }); }
      else if (s.gone) { s.gone -= dt; if (s.gone <= 0 && d > 15) { s.gone = 0; s.m.visible = true; } }
      if (!s.gone) s.m.scale.y = 1 + Math.sin(t * 1.2 + s.x) * 0.03;
    }
    for (const w of this.walrus) w.m.scale.set(1 + Math.sin(t * 0.8 + w.ph) * 0.03, 1 + Math.sin(t * 0.8 + w.ph) * 0.04, 1);
    for (const n of this.narwhals) {
      n.u += dt * 2.2; if (n.u > 200) n.u = -180;
      const v = floeV(n.u) - 18 - Math.sin(n.u / 40 + n.ph) * 8, w = this.W(n.u, v);
      const dive = Math.sin(t * 0.35 + n.ph);
      n.m.position.set(w.x, WATER_Y - 0.35 - Math.max(0, -dive) * 2.2, w.z); n.m.rotation.set(-Math.cos(t * 0.35 + n.ph) * 0.08, Math.PI / 2 + Math.sin(n.u / 40 + n.ph) * 0.15, 0);
      n.m.visible = near(w.x, w.z, 260);
    }
    // owls turn their heads; ravens hop about and take off when you come near
    for (const o of this.owls) o.m.rotation.y = o.base + Math.sin(t * 0.5 + o.ph) * 0.9 * (Math.sin(t * 0.13 + o.ph) > 0 ? 1 : 0);
    for (const r of this.ravens) this.updateRaven(r, dt, t, me);
    this.updateStag(dt, t, me, night);
    this.updateThing(dt, t, me);
  }
  /** Walk an animal toward a target at speed v; true when it's there. */
  walkTo(a, tgt, v, dt) {
    const dx = tgt.x - a.x, dz = tgt.z - a.z, d = Math.hypot(dx, dz);
    if (d < 0.25) return true;
    let dy = Math.atan2(dx, dz) - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 3);
    const step = Math.min(d, v * dt);
    const nx = a.x + Math.sin(a.yaw) * step, nz = a.z + Math.cos(a.yaw) * step, [u, vv] = toLocal(nx, nz);
    if (isOpen(kindAt(u, vv))) return true; // (never into the open water)
    a.x = nx; a.z = nz;
    return false;
  }

  // ---------------------------------------------------------------- the bears
  updateBears(dt, t, near) {
    const g = this.game, me = g.player.pos, aurora = !!this.north.sky?.auroraOn, night = (g.engine.sky.night || 0) > 0.5;
    const mum = this.bearAI[2];
    for (const B of this.bearAI) {
      const a = B.a;
      if (B.role === 'whitepaw') { a.visible = aurora && night; if (!a.visible) continue; }
      if (!near(a.x, a.z, 200)) continue;
      const d = Math.hypot(a.x - me.x, a.z - me.z);
      B.t -= dt;
      if (B.role === 'cub') {
        // cubs stay by mum: chase each other round her, tumble, sit
        if (B.t <= 0) { B.t = rnd(1.5, 4); B.tgt = { x: mum.a.x + rnd(-4, 4), z: mum.a.z + rnd(-4, 4) }; a.gait = Math.random() < 0.5 ? 'run' : 'trot'; if (Math.random() < 0.2) { a.gait = 'sit'; B.tgt = null; } }
        if (B.tgt && this.walkTo(a, B.tgt, a.gait === 'run' ? 3.5 : 2, dt)) { B.tgt = null; a.gait = Math.random() < 0.3 ? 'rear' : 'stand'; }
        a.y = this.ground(a.x, a.z);
        continue;
      }
      if (B.role === 'whitepaw') { a.gait = d < 30 ? 'rear' : 'stand'; let dy = Math.atan2(me.x - a.x, me.z - a.z) - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt); a.y = this.ground(a.x, a.z); continue; }
      switch (B.state) {
        case 'wander':
          if (d < 14 && !g.north.trip && this.north.here && (B.cool || 0) <= 0) { B.state = 'huff'; B.t = 2.2; a.gait = 'rear'; northSfx(g.audio, 'bark', { vol: 0.3 }); g.juice?.pop('*huff*', { color: '#ffffff', size: 26, ms: 1200 }); g.ui.toast('A polar bear has noticed you! Back away, or toss it a fish (E).', { title: 'Polar bear', icon: 'star', ms: 4500 }); break; }
          B.cool = Math.max(0, (B.cool || 0) - dt);
          if (B.tgt) { if (this.walkTo(a, B.tgt, 1.3, dt)) { B.tgt = null; a.gait = Math.random() < 0.3 ? 'sit' : 'stand'; B.t = rnd(3, 8); } else a.gait = 'walk'; }
          else if (B.t <= 0) { B.tgt = { x: B.home.x + rnd(-B.range, B.range), z: B.home.z + rnd(-B.range, B.range) }; }
          break;
        case 'huff':
          { let dy = Math.atan2(me.x - a.x, me.z - a.z) - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 3); }
          if (B.t <= 0) { B.state = 'approach'; a.gait = 'walk'; }
          break;
        case 'approach':
          if (d > 24) { B.state = 'wander'; B.cool = 20; a.gait = 'stand'; g.ui.toast('The bear lost interest and wandered off.', { ms: 2500 }); break; }
          if (d < 2.2) { this.bearSteals(B); break; }
          this.walkTo(a, me, 1.8, dt); a.gait = 'walk';
          break;
        case 'eat':
          a.gait = 'sit';
          if (B.t <= 0) { B.state = 'wander'; B.cool = 40; a.gait = 'stand'; }
          break;
        case 'leave':
          if (!B.tgt) B.tgt = { x: B.home.x + rnd(-10, 10), z: B.home.z + rnd(-10, 10) };
          if (this.walkTo(a, B.tgt, 2, dt) || B.t <= 0) { B.state = 'wander'; B.cool = 40; B.tgt = null; }
          a.gait = 'walk';
          break;
        default: break;
      }
      a.y = this.ground(a.x, a.z);
    }
    this.bears.update(dt);
  }
  /** The bear nearest you that's coming over (for "toss it a fish"). */
  curiousBear() { const me = this.game.player.pos; return this.bearAI?.find((B) => (B.state === 'approach' || B.state === 'huff') && Math.hypot(B.a.x - me.x, B.a.z - me.z) < 12) || null; }
  myFish() {
    const g = this.game, locked = new Set(g.ext.d.locked || []);
    return (g.profile.creel || []).filter((c) => !locked.has(c.id) && SPECIES_BY_ID[c.speciesId] && !['legendary', 'mythic'].includes(SPECIES_BY_ID[c.speciesId].tier));
  }
  async tossFish(B) {
    const g = this.game, fish = this.myFish().sort((a, b) => a.weight - b.weight)[0];
    if (!fish) { g.ui.toast('You\'ve no fish to spare! Back away slowly...', { ms: 3000 }); return; }
    if (!(await g.save.give(fish.id))) return;
    B.state = 'eat'; B.t = 12; B.a.gait = 'sit';
    g.ui.toast(`You tossed the bear your ${SPECIES_BY_ID[fish.speciesId].name}. It sits down to eat, very pleased with itself.`, { title: 'Polar bear', icon: 'star', ms: 4500 });
    g.ui.sheets?.refresh?.();
    this.north.onEvent('feedbear');
  }
  async bearSteals(B) {
    const g = this.game, list = this.myFish(), last = list[list.length - 1];
    B.state = 'leave'; B.t = 20; B.tgt = null;
    if (last && await g.save.give(last.id)) {
      g.ui.toast(`The bear snuffled your backpack and made off with your ${SPECIES_BY_ID[last.speciesId].name}!`, { title: 'Polar bear', icon: 'star', ms: 5000 });
      g.ui.sheets?.refresh?.();
    } else g.ui.toast('The bear sniffs you all over, finds nothing to eat, and ambles off.', { title: 'Polar bear', icon: 'star', ms: 4000 });
  }

  // ---------------------------------------------------------------- ravens
  updateRaven(r, dt, t, me) {
    const d = Math.hypot(r.x - me.x, r.z - me.z);
    if (r.fly > 0) {
      r.fly -= dt;
      const k = Math.min(1, dt * 0.8);
      r.x += (r.tx - r.x) * k; r.z += (r.tz - r.z) * k;
      r.y = ICE_Y + Math.sin(Math.min(1, (3.5 - r.fly) / 3.5) * Math.PI) * 6;
      const flap = Math.sin(t * 18) * 0.9; r.wl.rotation.z = flap; r.wr.rotation.z = -flap;
      r.g.rotation.y = Math.atan2(r.tx - r.x, r.tz - r.z);
      if (r.fly <= 0) { r.y = this.ground(r.x, r.z); r.wl.rotation.z = 0; r.wr.rotation.z = 0; }
    } else {
      r.t -= dt;
      if (d < 4) { r.fly = 3.5; const a = rnd(0, 6.28); r.tx = r.home.x + Math.sin(a) * 12; r.tz = r.home.z + Math.cos(a) * 12; this.game.audio.sfx('flop'); }
      else if (r.t <= 0) { r.t = rnd(1, 3); r.x += rnd(-0.6, 0.6); r.z += rnd(-0.6, 0.6); r.g.rotation.y = rnd(0, 6.28); r.hop = 0.25; }
      r.hop = Math.max(0, (r.hop || 0) - dt);
      r.y = this.ground(r.x, r.z) + Math.sin((r.hop / 0.25) * Math.PI) * 0.15;
    }
    r.g.position.set(r.x, r.y, r.z);
  }

  // ---------------------------------------------------------------- the legends
  updateStag(dt, t, me, night) {
    const S = this.stag, a = S.a, g = this.game, st = g.engine.sky.state || {};
    const [u, v] = toLocal(me.x, me.z);
    const inTaiga = Math.hypot(u - P.taiga.u, v - P.taiga.v) < 110 || Math.hypot(u - P.trapper.u, v - P.trapper.v) < 60;
    const dusky = st.phase === 'dusk' || (st.phase === 'night' && night < 0.9) || st.phase === 'dawn';
    const snowing = ['rain', 'storm', 'overcast'].includes(st.weather);
    S.cool -= dt;
    if (!S.on && inTaiga && dusky && snowing && S.cool <= 0 && this.north.here) {
      // it steps out of the trees, 35-45 m away, somewhere you can see
      const ang = Math.atan2(me.x - this.W(P.taiga.u, P.taiga.v).x, me.z - this.W(P.taiga.u, P.taiga.v).z) + rnd(-0.8, 0.8), r = rnd(35, 45);
      a.x = me.x - Math.sin(ang) * r; a.z = me.z - Math.cos(ang) * r; a.y = this.ground(a.x, a.z); a.yaw = ang; a.visible = true; a.gait = 'stand';
      S.on = true; S.t = 60; S.seenT = 0;
      g.ui.toast('Something white moves at the edge of the trees...', { title: 'The taiga', icon: 'star', ms: 4500 });
    }
    if (S.on) {
      S.t -= dt;
      const d = Math.hypot(a.x - me.x, a.z - me.z);
      let dy = Math.atan2(me.x - a.x, me.z - a.z) - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 0.8);
      a.gait = Math.sin(t * 0.4) > 0.7 ? 'walk' : 'stand';
      if (a.gait === 'walk') { a.x += Math.sin(a.yaw + 1.6) * dt * 0.8; a.z += Math.cos(a.yaw + 1.6) * dt * 0.8; a.y = this.ground(a.x, a.z); }
      if (d < 55 && this.onScreen(a.x, a.y + 1.5, a.z)) { S.seenT += dt; if (S.seenT > 2 && !S.logged) { S.logged = true; this.north.legendSeen('stag'); } }
      if (d < 15 || S.t <= 0) this.stagVanish();
    }
    if (a.visible) for (let i = 0; i < 2; i++) if (Math.random() < dt * 8) g.fx.spawn(a.x + rnd(-1, 1), a.y + rnd(1.5, 3.2), a.z + rnd(-1, 1), rnd(-0.3, 0.3), rnd(0.1, 0.4), rnd(-0.3, 0.3), Math.random() < 0.5 ? '#9af8d8' : '#c8a8ff', 1.2, 0.1, 0.3);
    this.stagPack.update(dt);
  }
  stagVanish() {
    const S = this.stag, a = S.a, g = this.game;
    for (let i = 0; i < 60; i++) g.fx.spawn(a.x + rnd(-1.5, 1.5), a.y + rnd(0, 2.8), a.z + rnd(-1.5, 1.5), rnd(-2, 2), rnd(0.5, 2.5), rnd(-2, 2), i % 3 ? '#ffffff' : '#9af8d8', 1.4, -1, 0.4);
    northSfx(g.audio, 'hiss', { vol: 0.5 });
    a.visible = false; S.on = false; S.logged = false; S.cool = 240;
    g.ui.toast('In a swirl of snow, the Frost Stag is gone.', { title: 'The Frost Stag', icon: 'star', ms: 4500 });
  }
  updateThing(dt, t, me) {
    const T = this.thing, g = this.game;
    const [u, v] = toLocal(me.x, me.z);
    const onBasin = zoneOf(u, v) === 'basin' && Math.abs(me.y - ICE_Y) < 0.4;
    if (!T.on) {
      T.t -= dt * (onBasin ? 1 : 0);
      if (T.t <= 0 && onBasin) {
        T.on = true; T.k = 0; T.yaw = rnd(0, 6.28);
        T.from = { x: me.x - Math.sin(T.yaw) * 40 + rnd(-6, 6), z: me.z - Math.cos(T.yaw) * 40 + rnd(-6, 6) };
        T.m.visible = true; T.m.rotation.y = T.yaw;
        northSfx(g.audio, 'boom');
        g.juice?.hit({ shake: 0.35 });
      }
      return;
    }
    T.k += dt / 22;
    const x = T.from.x + Math.sin(T.yaw) * T.k * 80, z = T.from.z + Math.cos(T.yaw) * T.k * 80;
    T.m.position.set(x, ICE_Y - 0.12, z);
    T.m.material.opacity = Math.sin(Math.min(1, T.k) * Math.PI) * 0.55;
    if (!T.logged && T.k > 0.35 && Math.hypot(x - me.x, z - me.z) < 30) { T.logged = true; g.ui.toast('A shadow as big as a boat slides under the ice beneath your feet...', { title: '???', icon: 'star', ms: 5000 }); this.north.legendSeen('thing'); }
    if (T.k > 0.5 && !T.cracked) { T.cracked = true; northSfx(g.audio, 'crack', { vol: 0.5 }); }
    if (T.k >= 1) { T.on = false; T.m.visible = false; T.t = 300 + rnd(0, 300); T.logged = false; T.cracked = false; }
  }
  onScreen(x, y, z) {
    const s = this.game.engine.toScreen?.(this.v.set(x, y, z));
    const E = this.game.engine;
    return !!s && s.x > 0 && s.y > 0 && s.x < E.width && s.y < E.height;
  }

  // ---------------------------------------------------------------- the Field Guide
  /** The closest animal (not yet in your guide) that's close and in view. */
  photoTarget() {
    const have = this.north.d.guide || {}, me = this.game.player.pos, cands = [];
    const look = (id, x, y, z, max) => { if (have[id]) return; const d = Math.hypot(x - me.x, z - me.z); if (d > max || !this.onScreen(x, y, z)) return; cands.push({ id, d, at: new THREE.Vector3(x, y, z) }); };
    for (const B of this.bearAI || []) if (B.a.visible) look(B.role === 'cub' ? 'cubs' : B.role === 'whitepaw' ? 'whitepaw' : 'bear', B.a.x, B.a.y + 1 * B.a.s, B.a.z, B.role === 'whitepaw' ? 45 : 22);
    for (const F of this.foxAI || []) look('fox', F.a.x, F.a.y + 0.3, F.a.z, 14);
    for (const C of this.caribouAI || []) look('caribou', C.a.x, C.a.y + 1.2, C.a.z, 30);
    for (const a of this.oxen?.list || []) look('muskox', a.x, a.y + 0.9, a.z, 26);
    for (const o of this.owls || []) look('owl', o.m.position.x, o.m.position.y + 0.4, o.m.position.z, 16);
    for (const s of this.seals || []) if (s.m.visible) look('seal', s.x, ICE_Y + 0.4, s.z, 16);
    for (const w of this.walrus || []) look('walrus', w.x, ICE_Y + 0.8, w.z, 22);
    for (const n of this.narwhals || []) if (n.m.visible && n.m.position.y > WATER_Y - 0.6) look('narwhal', n.m.position.x, WATER_Y + 0.3, n.m.position.z, 40);
    for (const r of this.ravens || []) look('raven', r.x, r.y + 0.2, r.z, 10);
    if (this.stag?.on) look('stag', this.stag.a.x, this.stag.a.y + 1.6, this.stag.a.z, 50);
    if (this.thing?.on && this.thing.m.material.opacity > 0.2) look('thing', this.thing.m.position.x, ICE_Y, this.thing.m.position.z, 40);
    if (this.north.builtExtras) this.north.wilds.photoCands(look);
    cands.sort((a, b) => a.d - b.d);
    return cands[0] || null;
  }
  photograph(c) {
    const g = this.game, e = NORTH_GUIDE.find((x) => x.id === c.id);
    if (this.shooting) return;
    const pl = g.player; pl.target = null; pl.yaw = Math.atan2(c.at.x - pl.pos.x, c.at.z - pl.pos.z);
    g.myEmote = { id: 'photo', left: 1.7 }; g.netEvent?.('emote', { id: 'photo' });
    this.shooting = true;
    setTimeout(() => {
      this.shooting = false;
      const eye = g.actor.headWorld(new THREE.Vector3()), dx = c.at.x - eye.x, dz = c.at.z - eye.z, d = Math.hypot(dx, dz) || 1;
      eye.x += dx / d * 0.45; eye.z += dz / d * 0.45;
      const flash = document.createElement('div'); flash.className = 'woods-flash'; g.ui.root.append(flash); setTimeout(() => flash.remove(), 500);
      g.audio.sfx('shutter');
      try { shoot(g, eye, c.at, `${g.profile.name}'s ${e.name.replace(/^The /, 'the ').replace(/^./, (ch) => ch.toLowerCase())}`, `Frostmere  ·  ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`); } catch (err) { console.error(err); }
      this.north.logPhoto(c.id);
    }, 650);
  }
}
