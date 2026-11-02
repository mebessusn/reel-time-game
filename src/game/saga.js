// The primary quest lines' engine: one for every map (the stories are src/data/saga.js, and each other map adds its own). It keeps your place in each line in
// ext.saga, puts the current step's people, items, scene props and a beam of light in the world for you alone, marks the way on
// the maps, and offers what you can do there as ordinary context actions. Nothing here goes over the network: quest items and
// quest weather only ever exist on your own screen.
// Another map's rules come in through addSagaMap (src/data/saga.js), as a set of optional hooks:
//   name, here(g), groundY(g, x, z, prop), npcY(g, q, person), beamY(g, target, step, me, carrying, groundAt), stepSpot(g, step),
//   personAt(g, person), personVisible(g, person), liveNpc(g, name), townFolk(g, name), gate(g, step) -> null | 'skip' | { label, text },
//   hideGem(g, step), lineOpen(g, line), pinAt(place), labels, tow, props: { kind(o, model) }, bob, act(saga, line, step) -> bool,
//   update(saga, dt, t), sky(g, steps, near), carried(saga, carry, place), onFinish(g, step), onDone(g, line)
import * as THREE from 'three';
import { SAGA, SAGA_BY_ID, PEOPLE, SAGA_MAPS } from '../data/saga.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { Actor } from './actor.js';
import { surfaceY, walkY, WATER_Y } from '../world/terrain.js';
import { addCircle } from '../world/colliders.js';
import { placeModels } from '../world/polyfork.js';
import { PLACES } from './places.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

const GEAR = { rod: 'rod_bamboo', lure: 'lure_classic', boat: 'boat_oak' };
const LABEL = { cottage: 'a bigger home', lodge: 'the Lodge' };
const TOW = { canoe: 6 };
const maps = () => Object.values(SAGA_MAPS);
/** Asks each other map's rules in turn: the first answer that isn't null. */
const ask = (hook, ...a) => { for (const M of maps()) { const r = M[hook]?.(...a); if (r != null) return r; } return null; };
const groundAt = (x, z) => walkY(x, z, 0.6) ?? surfaceY(x, z) ?? 1;
const model = (m, y = 0, s = 1) => placeModels(`saga-${m}`, [{ m, x: 0, z: 0, y, ry: 0, s, solid: false }], { colliders: false });

export class Saga {
  constructor(game) {
    this.game = game; this.actors = new Map(); this.carry = null; this.next = 0; this.wait = 0; this.props = new Map(); this.trail = null; this.raising = null; this.mini = null;
    const g = new THREE.Group(); g.visible = false; g.name = 'saga-beam';
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 60, 14, 1, true).translate(0, 30, 0), new THREE.MeshBasicMaterial({ color: '#ffd46a', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd46a', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    g.add(beam, ring); game.engine.scene.add(g); this.beam = g;
    this.gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), new THREE.MeshBasicMaterial({ color: '#ffe28a' })); this.gem.visible = false; game.engine.scene.add(this.gem);
    this.bar = h('div.saga-track', { style: { position: 'fixed', left: '12px', top: '168px', maxWidth: '240px', padding: '8px 12px', borderRadius: '12px', background: 'rgba(250,246,236,0.94)', color: '#2c3a42', font: '600 13px/1.3 "Baloo 2",Nunito,sans-serif', boxShadow: '0 3px 10px rgba(0,0,0,.2)', cursor: 'pointer', zIndex: 40, display: 'none' }, on: { click: () => this.cycle() } });
  }
  get d() { return this.game.ext.d.saga || { lines: {}, unlocks: {} }; }
  change(fn) { this.game.ext.change((d) => { d.saga = d.saga || { lines: {}, unlocks: {} }; d.saga.lines = d.saga.lines || {}; d.saga.unlocks = d.saga.unlocks || {}; fn(d.saga); }); }
  unlocked(k) { return !!this.d.unlocks?.[k]; }
  state(id) { return this.d.lines?.[id] || null; }
  map() { const g = this.game; for (const [id, M] of Object.entries(SAGA_MAPS)) if (M.here?.(g)) return id; return 'valley'; }
  /** This map's rules (none in the valley). */
  rules(m = this.map()) { return SAGA_MAPS[m] || null; }
  mapName(m) { return m === 'valley' ? 'the Five Lakes' : SAGA_MAPS[m]?.name || m; }
  night() { return (this.game.engine.sky.night || 0) > 0.45; }
  line(id) { return SAGA_BY_ID[id]; }
  lineOf(s) { return SAGA.find((L) => L.steps.includes(s)); }
  /** Where one of the stories' people is standing right now. */
  whereOf(id) {
    const P2 = PEOPLE[id], g = this.game;
    if (this.carry?.s.who === id && this.trail) return { ...P2.at, x: this.trail.x, z: this.trail.z };
    const own = ask('personAt', g, P2); if (own) return own;
    if (P2.meet && P2.meetStep) { const q = this.state(P2.meetStep[0]); if (q && !q.done && q.step === P2.meetStep[1]) return P2.meet; }
    return P2.at;
  }
  /** Where a place in a step or giver really is: someone's live position where they have one. */
  spot(s) {
    const own = ask('stepSpot', this.game, s); if (own) return own;
    if (s.ats) return s.ats[Math.min(s.ats.length - 1, this.state(this.lineOf(s).id)?.have || 0)];
    if (s.who) return this.whereOf(s.who);
    if (s.place) { const q = PLACES.find((p) => p.id === s.place); return { map: 'valley', x: q.x, z: q.z, r: s.r || 8 }; }
    if (s.place2) return s.place2;
    const live = s.npc && this.liveNpc(s.npc);
    if (live) return { ...s.at, x: live.pos.x, z: live.pos.z, r: Math.max(4, Math.min(s.at.r || 4, 6)) };
    return s.at || null;
  }
  liveNpc(name) {
    const g = this.game, k = name.toLowerCase();
    const own = ask('liveNpc', g, k); if (own) return own;
    return g.npcs?.list.find((q) => q.name?.toLowerCase().includes(k) && q.kind !== 'scene') || null;
  }
  townFolk(name) { return ask('townFolk', this.game, name); }
  /** The lines you're on, this map's first. */
  active() { const m = this.map(); return SAGA.filter((L) => { const s = this.state(L.id); return s && !s.done; }).sort((a, b) => (this.spot(this.stepOf(b))?.map === m ? 1 : 0) - (this.spot(this.stepOf(a))?.map === m ? 1 : 0)); }
  stepOf(L) { const s = this.state(L.id); return s && !s.done ? L.steps[s.step] : null; }
  /** A line you could start: its giver, on this map. */
  offers(m = this.map()) {
    const g = this.game;
    return SAGA.filter((L) => { if (this.state(L.id) || (L.level && g.profile.level < L.level)) return false; if (maps().some((M) => M.lineOpen && !M.lineOpen(g, L))) return false; return this.spot(L.giver)?.map === m; });
  }
  tracked() { const a = this.active(); return a.find((L) => L.id === this.pin) || a[0] || null; }
  cycle() { const a = this.active(); if (a.length < 2) return; const i = a.findIndex((L) => L.id === this.tracked().id); this.pin = a[(i + 1) % a.length].id; this.show(); }
  /** A shop's lock: say what opens it, and turn the tracker to that line. */
  point(id, text) { if (this.state(id) && !this.state(id).done) { this.pin = id; this.show(); } this.game.ui.toast(`${text} It is marked on your map.`, { icon: 'lock', ms: 5000 }); }
  /** The gold marks for this map's map screen: what you're after, and who has a quest for you. */
  pinsFor(m) {
    const out = [], pinAt = this.rules(m)?.pinAt;
    const add = (name, text, q) => { if (!q || q.map !== m) return; const at = pinAt?.(q) || q; out.push({ id: name, name, text, x: at.x, z: at.z }); };
    for (const L of this.active()) { const s = this.stepOf(L); add(L.name, s.text, ['catch', 'check'].includes(s.t) ? s.pin : this.spot(s)); }
    for (const L of this.offers(m)) add(L.name, `New quest, from ${L.giver.name}`, this.spot(L.giver));
    return out;
  }
  /** One gold map mark, for the three map screens. */
  pinButton(p, left, top) {
    return h('button.mv-pin.sc-pin.saga-pin', { style: { left, top, '--c': '#f0b429' }, 'aria-label': `${p.name}: ${p.text}`, title: `${p.name}: ${p.text}`, on: { click: (e) => { e.stopPropagation(); this.game.ui.toast(p.text, { title: p.name, icon: 'scroll', ms: 4500 }); } } }, h('span.mv-pin-in', icon('star')), h('span.mv-label', p.name));
  }
  say(name, title, x, z, text) {
    const g = this.game, y = groundAt(x, z), live = this.actors.get(name)?.npc || this.townFolk(name);
    return g.dialogue.open({ npc: live || { name, look: null, pos: new THREE.Vector3(x, y, z), actor: { headWorld: (o) => o.set(x, y + 1.6, z) } }, title: title || '', text, choices: [{ label: 'Go on', primary: true }] });
  }
  async begin(L) {
    const g = this.game, q = this.spot(L.giver);
    const live = (L.giver.npc && this.liveNpc(L.giver.npc)) || this.townFolk(L.giver.name), who = live || { name: L.giver.name, look: null, pos: new THREE.Vector3(q.x, groundAt(q.x, q.z), q.z), actor: { headWorld: (o) => o.set(q.x, groundAt(q.x, q.z) + 1.6, q.z) } };
    g.dialogue.open({ npc: who, title: L.giver.title, text: `${L.intro} (Reward: ${L.rewardText}.)`, choices: [{ label: 'I\'m in!', primary: true, fn: () => { this.change((d) => { d.lines[L.id] = { step: 0, have: 0, done: false }; }); this.pin = L.id; g.audio.sfx('page'); g.ui.toast(`New quest: ${L.name}. ${L.steps[0].text}.`, { title: 'Quest', icon: 'scroll', ms: 5500 }); this.show(); } }, { label: 'Not just now' }] });
  }
  /** The step's finished: the next one, or the end of the line. */
  async advance(L) {
    const g = this.game, st = this.state(L.id), s = L.steps[st.step], next = st.step + 1, done = next >= L.steps.length;
    this.change((d) => { const q = d.lines[L.id]; q.step = next; q.have = 0; q.done = done; if (s.unlock) d.unlocks[s.unlock] = 1; if (done && L.unlock) d.unlocks[L.unlock] = 1; });
    g.audio.sfx(done ? 'achievement' : 'page');
    const un = s.unlock || (done && L.unlock);
    if (un) g.ui.toast(s.unlockText || L.unlockText || `You can get ${LABEL[un] || maps().map((M) => M.labels?.[un]).find(Boolean) || un} now.`, { title: 'Unlocked', icon: 'star', ms: 6500 });
    if (done) {
      g.ui.toast(`${L.name}: complete!`, { title: 'Quest', icon: 'star', ms: 5000 });
      await g.reward('saga', L.id, L.reward, L.name);
      for (const it of L.items || []) await g.reward('saga', `${L.id}-${it}`, { item: it }, L.name);
      if (L.decor) g.ext.change((x) => { x.home.owned = [...new Set([...(x.home.owned || []), L.decor])]; if (!x.home.decor.includes(L.decor)) x.home.decor.push(L.decor); });
      for (const M of maps()) M.onDone?.(g, L);
    } else g.ui.toast(`Next: ${L.steps[next].text}.`, { title: L.name, icon: 'scroll', ms: 4500 });
    this.show();
  }
  async finish(L, s) {
    const q = this.spot(s), base = s.t === 'talk' ? (s.who ? PEOPLE[s.who].name : s.name || s.npc) : L.name;
    if (s.ring) this.game.audio.sfx('bell');
    for (const M of maps()) M.onFinish?.(this.game, s);
    for (const line of [].concat(s.say || [])) { const o = typeof line === 'string' ? { text: line } : line; await this.say(o.who || base, !o.who && s.who ? PEOPLE[s.who].title : '', q.x, q.z, o.text); }
    await this.advance(L);
  }
  /** A fish landed: every line waiting on one. */
  onCatch(c) {
    const sp = SPECIES_BY_ID[c.speciesId];
    for (const L of this.active()) {
      const s = this.stepOf(L); if (s?.t !== 'catch' || !s.match(c, sp)) continue;
      const have = this.state(L.id).have + 1;
      if (have >= s.n) this.advance(L); else { this.change((d) => { d.lines[L.id].have = have; }); this.game.ui.toast(`${s.text} (${have}/${s.n})`, { icon: 'scroll', ms: 3000 }); }
    }
  }
  contextActions() {
    const g = this.game, me = g.player.pos, m = this.map(), out = [];
    if (this.carry || this.mini || this.raising) return out;
    for (const L of this.offers()) { const q = this.spot(L.giver); if (Math.hypot(q.x - me.x, q.z - me.z) < (q.r || 5)) out.push({ id: `saga-start-${L.id}`, label: `Quest: ${L.name}`, color: 'gold', fn: () => this.begin(L) }); }
    for (const L of this.active()) {
      const s = this.stepOf(L), q = this.spot(s);
      if (!q || q.map !== m || ['catch', 'check'].includes(s.t) || Math.hypot(q.x - me.x, q.z - me.z) > (q.r || 4)) continue;
      const gate = ask('gate', g, s); // (another map's step can wait: down the mine, underwater, for the lights)
      if (gate === 'skip') continue;
      if (s.when === 'night' && !this.night()) { out.push({ id: `saga-wait-${L.id}`, label: 'Come back after dark', fn: () => g.ui.toast('Nothing to see yet. Come back after dark.', { icon: 'scroll' }) }); continue; }
      if (gate) { out.push({ id: `saga-wait-${L.id}`, label: gate.label, fn: () => g.ui.toast(gate.text, { icon: 'scroll' }) }); continue; }
      const label = s.t === 'talk' ? `Talk to ${s.who ? PEOPLE[s.who].name : s.name || s.npc}` : s.label;
      out.push({ id: `saga-${L.id}`, label, color: 'gold', fn: () => this.act(L, s) });
    }
    return out;
  }
  act(L, s) {
    const g = this.game, st = this.state(L.id), me = g.player.pos;
    if (s.t === 'carry') { this.carry = { L, s, t: s.secs }; this.trail = { x: me.x, z: me.z, yaw: 0 }; g.audio.sfx('page'); g.ui.toast(`Go! ${Math.round(s.secs)} seconds.`, { title: L.name, icon: 'star', ms: 2500 }); this.show(); return; }
    if (maps().some((M) => M.act?.(this, L, s))) return; // (another map's own kind of step)
    if (s.t === 'hold' || s.n > 1) {
      const now = performance.now(); if (now < this.wait) return; this.wait = now + 500;
      const have = st.have + 1; g.audio.sfx('page');
      if (have >= s.n) { this.finish(L, s); return; }
      this.change((d) => { d.lines[L.id].have = have; }); g.ui.toast(`${s.label} (${have}/${s.n})`, { icon: 'scroll', ms: 1800 }); return;
    }
    this.finish(L, s);
  }
  // ---------------------------------------------------------------- scene props
  prop(k) {
    let o = this.props.get(k); if (o) return o;
    o = new THREE.Group(); o.name = `saga-${k}`; o.visible = false;
    if (k === 'canoe') o.add(model('camp-canoe'));
    else for (const M of maps()) M.props?.[k]?.(o, model); // another map's props
    this.game.engine.scene.add(o); this.props.set(k, o); return o;
  }
  yAt(x, z, k) {
    return this.rules()?.groundY?.(this.game, x, z, k) ?? Math.max(surfaceY(x, z) ?? 1, WATER_Y);
  }
  updateProps(dt, t) {
    const g = this.game, m = this.map(), me = g.player.pos, C = this.carry;
    if (C && this.trail) { const T = this.trail, len = TOW[C.s.prop] ?? maps().map((M) => M.tow?.[C.s.prop]).find((x) => x != null) ?? 1.6, dx = me.x - T.x, dz = me.z - T.z, d = Math.hypot(dx, dz); if (d > len) { T.x += dx / d * (d - len); T.z += dz / d * (d - len); T.yaw = Math.atan2(dx, dz); } }
    for (const o of this.props.values()) o.visible = false;
    if (this.raising) this.raising.o.visible = true;
    for (const L of this.active()) {
      const s = this.stepOf(L), k = s?.prop; if (!k) continue;
      const q = this.spot(s); if (q?.map !== m || this.raising?.k === k) continue;
      const o = this.prop(k); o.visible = true;
      if (C?.s === s) { o.position.set(this.trail.x, this.yAt(this.trail.x, this.trail.z, k) + (this.bobs(k) ? Math.sin(t * 1.6) * 0.06 : 0), this.trail.z); o.rotation.y = this.trail.yaw; continue; }
      const away = k === 'cub' ? 8 + 15 * (1 - (this.state(L.id).have || 0) / (s.n || 1)) : 0, x = q.x, z = q.z - away;
      o.position.set(x, this.yAt(x, z, k) + (this.bobs(k) ? Math.sin(t * 1.6) * 0.06 : 0), z); o.rotation.y = k === 'cub' ? -0.6 : 0.8; o.userData.pack?.update(dt);
    }
    for (const M of maps()) M.update?.(this, dt, t);
  }
  bobs(k) { return maps().some((M) => M.bob?.[k]); }
  /** The weather and the lights a step calls for, near it, on your screen alone. */
  updateSky() {
    const g = this.game, m = this.map(), me = g.player.pos, near = (s, r) => { const q = this.spot(s); return q?.map === m && Math.hypot(q.x - me.x, q.z - me.z) < r; };
    const steps = this.active().map((L) => this.stepOf(L));
    const storm = this.carry?.s.storm || steps.some((s) => s?.storm && near(s, 240));
    if (storm) { g.engine.sky.forceWeather = 'storm'; this.storming = true; } else if (this.storming) { g.engine.sky.forceWeather = null; this.storming = false; }
    for (const M of maps()) M.sky?.(g, steps, near); // (another map's own quest weather: the lights)
  }
  /** Every frame. */
  update(dt, t) {
    const g = this.game, m = this.map(), me = g.player.pos;
    if (!this.bar.parentNode) g.ui.root.append(this.bar);
    if (this.carry) {
      const C = this.carry, q = C.s.to; C.t -= dt;
      if (q.map === m && Math.hypot(q.x - me.x, q.z - me.z) < q.r) { this.carry = null; g.ui.toast('Just in time. Thank you!', { title: C.L.name, icon: 'star' }); for (const M of maps()) M.carried?.(this, C, q); this.advance(C.L); }
      else if (C.t <= 0) { this.carry = null; g.ui.toast('Not quite in time. Go back and try again.', { title: C.L.name, icon: 'scroll', ms: 4000 }); this.show(); }
    }
    this.updateProps(dt, t);
    this.updateSky();
    // the people
    for (const [id, P2] of Object.entries(PEOPLE)) {
      const q = this.whereOf(id), on = q.map === m && Math.hypot(q.x - me.x, q.z - me.z) < 90 && this.around(P2) && maps().every((M) => M.personVisible?.(g, P2) !== false);
      let A = this.actors.get(id);
      if (on && !A) {
        const lk = P2.look || this.liveNpc(P2.lookOf)?.look; if (!lk) continue;
        const a = new Actor(g.engine.scene), y = groundAt(q.x, q.z);
        a.setLook(lk, GEAR); const npc = { name: P2.name, title: P2.title, look: lk, pos: new THREE.Vector3(q.x, y, q.z), yaw: 0, actor: a }; a.headWorld ??= (o) => o.set(npc.pos.x, npc.pos.y + 1.6, npc.pos.z);
        A = { a, npc }; this.actors.set(id, A); this.actors.set(P2.name, A); if (!P2.meet) addCircle(q.x, q.z, 0.3, { skip: () => !A.a.root.visible || this.carry?.s.who === id });
      }
      if (!A) continue;
      A.a.root.visible = on;
      if (on) { const walking = this.carry?.s.who === id, y = this.rules()?.npcY?.(g, q, P2) ?? groundAt(q.x, q.z), yaw = walking ? this.trail.yaw : Math.atan2(me.x - q.x, me.z - q.z); A.npc.pos.set(q.x, y, q.z); A.a.update(dt, t, { x: q.x, y, z: q.z, yaw, mode: 'shore', pose: 'idle', moving: walking, rod: 'none' }); if (A.a.rod) A.a.rod.visible = false; }
    }
    // the beam on what you're after, and the item itself
    const L = this.tracked(), s = L && this.stepOf(L), tgt = this.carry ? this.carry.s.to : s && !['catch', 'check'].includes(s.t) ? this.spot(s) : null;
    const show = tgt?.map === m;
    this.beam.visible = !!show;
    if (show) { const y = this.rules()?.beamY?.(g, tgt, s, me, !!this.carry, groundAt) ?? groundAt(tgt.x, tgt.z); this.beam.position.set(tgt.x, y + 0.08, tgt.z); }
    this.gem.visible = !!show && s?.t === 'item' && !this.carry && !maps().some((M) => M.hideGem?.(g, s));
    if (this.gem.visible) { this.gem.position.set(tgt.x, this.beam.position.y + 0.9 + Math.sin(t * 2) * 0.1, tgt.z); this.gem.rotation.y = t; }
    this.next -= dt; if (this.next > 0) return; this.next = 0.5;
    for (const A of this.active()) { const q = this.stepOf(A); if (q?.t === 'check' && q.done(g)) this.advance(A); }
    this.show();
  }
  around(P2) { if (P2.step) { const s = this.state(P2.step[0]); return !!s && !s.done && s.step === P2.step[1]; } return !P2.from || !!this.state(P2.from); }
  show() {
    const L = this.tracked(), o = !L && this.offers()[0], el = this.bar, C = this.carry;
    if (!L && !o) { el.style.display = 'none'; return; }
    el.style.display = document.body.classList.contains('in-dialogue') ? 'none' : 'block';
    const s = L && this.stepOf(L), st = L && this.state(L.id), n = this.active().length, q = s && (['catch', 'check'].includes(s.t) ? s.pin : this.spot(s)), where = q && q.map !== this.map() ? ` (in ${this.mapName(q.map)})` : '';
    el.textContent = o ? `New quest here: ${o.name}, from ${o.giver.name}` : C ? `${C.s.text}: ${Math.ceil(C.t)} s` : `${L.name}${n > 1 ? ` (${n})` : ''}: ${s.text}${s.n > 1 ? ` (${st.have}/${s.n})` : ''}${where}`;
  }
  /** Tests: everything a step points at, on this map, that can't be stood on or found. */
  audit() {
    const m = this.map(), bad = [];
    const look = (name, q) => { if (!q) bad.push(`${name}: nowhere`); else if (q.map === m && groundAt(q.x, q.z) == null) bad.push(`${name}: no ground`); };
    for (const L of SAGA) { look(`${L.id} giver`, this.spot(L.giver)); L.steps.forEach((s, i) => { if (!['catch', 'check'].includes(s.t)) look(`${L.id} ${i}`, this.spot(s)); if (s.to) look(`${L.id} ${i} to`, s.to); }); }
    return bad;
  }
}
export { SAGA_BY_ID };
