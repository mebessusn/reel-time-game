// Campfire cookouts (v1.9.5). Sit on a log by any campfire, press E ("Roast a fish") and pick one from your
// creel. You hold it out over the flames on a green stick: it browns from raw to golden to roasted over a few
// seconds, sizzling, with smoke curling off it. Then eat it right off the stick, or pack it in your snack bag
// for later (eat it from the creel any time).
//
// Eating gives "Well Fed: Smells Like <fish>": you smell so strongly of that fish that its relatives come
// looking for it. For a few minutes that species bites far more often, every bite comes a little sooner, and
// the reel zone is a touch wider (a full angler has steadier hands). Bigger fish make a longer buff.
import * as THREE from 'three';
import { PX } from '../entities/avatar.js';
import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { fishThumb } from '../ui/thumbs.js';
import { buildFish } from '../entities/fish.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { CAMPFIRE, CAMP_FIRE } from '../world/props.js';
import { FERNVIEW_FIRE } from '../world/campers.js';
import { heightAt } from '../world/terrain.js';

export const ROAST_SECONDS = 5.5;
export const EAT_SECONDS = 2.8;
export const WELL_FED = { biteSpeed: 0.1, reelZone: 0.05, craving: 4 };
/** Buff length in seconds for a roasted fish of this weight: 3 min, up to 6 min for a hefty one. */
export function fedSeconds(weight) { return Math.round(180 + Math.min(180, Math.max(0, weight || 0) * 12)); }
const RAW = new THREE.Color('#ffffff'), GOLD = new THREE.Color('#e0a860'), ROAST = new THREE.Color('#7a4220');

export class Cookout {
  constructor(game) {
    this.game = game;
    this.active = null; // { fish, t, group, mat, done }
    this.fed = null; // { sp, w, until }
    this.panel = null;
    window.addEventListener('keydown', (e) => {
      if (!this.panel) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.closePanel(); if (this.active?.done) this.packFromStick(); return; }
      const n = '123456789'.indexOf(e.key);
      const btn = n >= 0 ? this.panel.querySelectorAll('button[data-k]')[n] : null;
      if (btn) { e.preventDefault(); e.stopImmediatePropagation(); btn.click(); }
    }, true);
  }

  get d() { return this.game.ext.d; }
  snacks() { return this.d.snacks || []; }

  /** The campfire next to the log you're sitting on, or null. */
  fire() {
    // v1.14.9: or a camp's fire you're standing by (yours or a friend's, in the woods)
    const camp = this.game.woods?.campFireNear?.();
    if (camp) return camp;
    const s = this.game.chairs?.seat;
    if (!s || s.kind !== 'log') return null;
    const fires = [CAMPFIRE, CAMP_FIRE, FERNVIEW_FIRE];
    return fires.sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
  }

  contextActions() {
    const f = this.fire();
    if (!f || this.active || this.panel) return [];
    const out = [{ id: 'roast', label: 'Roast a fish', color: 'gold', at: { x: f.x, z: f.z, y: heightAt(f.x, f.z), h: 1.4 }, fn: () => this.openPicker() }];
    // v1.14.9: a forest stew, from what you picked in the woods
    const W = this.game.woods;
    if (W?.canStew?.() && !this.eating) out.push({ id: 'stew', label: 'Cook forest stew', color: 'green', fn: () => W.cookStew() });
    return out;
  }

  // ---------------- the picker
  closePanel() { this.panel?.remove(); this.panel = null; }
  openPicker() {
    const g = this.game;
    this.closePanel();
    const locked = new Set(this.d.locked || []);
    const fish = g.profile.creel.filter((c) => !locked.has(c.id)).sort((a, b) => a.weight - b.weight).slice(0, 9);
    const rows = fish.map((c, i) => h('button.roast-row', { 'data-k': '1', on: { click: () => { this.closePanel(); this.start(c); } } },
      h('span.dlg-key', String(i + 1)), h('img', { src: fishThumb(c.speciesId, c.variant), alt: '' }),
      h('span.rr-name', `${c.variant !== 'normal' ? `${c.variant[0].toUpperCase()}${c.variant.slice(1)} ` : ''}${SPECIES_BY_ID[c.speciesId]?.name || 'Fish'}`), h('span.rr-w.num', `${c.weight.toFixed(1)} lb`)));
    const snacks = this.snacks();
    this.panel = h('div.roast-panel.plank', { role: 'dialog', 'aria-label': 'Roast a fish' },
      h('div.dlg-head', h('span.dlg-name', 'Campfire cookout'), h('span.dlg-esc', 'Esc to close')),
      h('div.muted', 'Pick a fish to roast on a stick. Locked fish stay in your backpack.'),
      rows.length ? h('div.roast-list', rows) : h('div.empty', 'Your backpack is empty. Catch something first!'),
      snacks.length ? h('div.muted', { style: { marginTop: '8px' } }, `Snack bag: ${snacks.length} roasted fish. Eat one from your inventory.`) : null);
    g.ui.root.append(this.panel);
    g.audio.sfx('open');
  }

  // ---------------- roasting
  async start(c) {
    const g = this.game, f = this.fire();
    if (!f || this.active) return;
    const ok = await g.save.give(c.id); // off the creel and onto the stick
    if (!ok) { g.ui.toast("Couldn't take that fish out of your backpack."); return; }
    g.ui.sheets?.current?.name === 'creel' && g.ui.sheets.refresh();
    const group = new THREE.Group();
    // a fresh green stick (a little glow of its own so it still reads green by firelight at night)
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 1, 6), new THREE.MeshLambertMaterial({ color: '#7cb342', emissive: '#2c4a12' }));
    group.add(stick);
    const fish = buildFish(c.speciesId, c.variant, Math.min(c.weight, 2.5)); // (a whopper still fits on a stick)
    const mat = fish.material.clone(); fish.material = mat;
    group.add(fish);
    g.engine.scene.add(group);
    this.active = { fish: c, t: 0, group, mesh: fish, mat, fire: f, done: false, smokeT: 0, sizzleT: 0.3 };
    g.audio.sfx('dirt');
    g.ui.toast(`Roasting your ${SPECIES_BY_ID[c.speciesId]?.name || 'fish'}... hold it over the flames.`, { icon: 'flame', ms: 2600 });
  }

  /** Got up mid-roast: the fish comes off the fire half done and goes in the snack bag anyway. */
  cancel() {
    const a = this.active;
    if (!a) return;
    this.clearStick();
    this.game.ui.setRoast?.(null);
    this.pack(a.fish, true);
  }

  update(dt) {
    const g = this.game, a = this.active;
    this.game.ui.setFedLeft?.(this.fedLeft(), this.fed);
    if (!a) return;
    // got up from the log mid-roast: it goes in the bag as it is
    if (!this.fire()) { this.closePanel(); if (a.done) this.packFromStick(); else this.cancel(); return; }
    // the stick: from your hands out over the middle of the fire
    const pl = g.player.pos, f = a.fire, fy = heightAt(f.x, f.z);
    const yaw = Math.atan2(f.x - pl.x, f.z - pl.z);
    g.player.yaw = yaw;
    // held just above the flame tips, where you can see it brown (the stick is placed after the avatar poses, in afterActor)
    a.yaw = yaw; a.tip = new THREE.Vector3(f.x, fy + 1.3, f.z);
    if (!a.done) {
      a.t += dt;
      const p = Math.min(1, a.t / ROAST_SECONDS);
      a.mat.color.copy(RAW).lerp(GOLD, Math.min(1, p * 1.6)).lerp(ROAST, Math.max(0, p - 0.45) / 0.55);
      a.smokeT -= dt;
      if (a.smokeT <= 0) { a.smokeT = 0.22 - p * 0.12; g.fx?.smoke?.(a.mesh.getWorldPosition(new THREE.Vector3())); }
      a.sizzleT -= dt;
      if (a.sizzleT <= 0) { a.sizzleT = 0.9 + Math.random() * 0.6; g.audio.sfx('tick'); }
      g.ui.setRoast?.(p);
      if (p >= 1) this.finish();
    } else {
      a.smokeT -= dt;
      if (a.smokeT <= 0) { a.smokeT = 0.45; g.fx?.smoke?.(a.mesh.getWorldPosition(new THREE.Vector3())); }
    }
  }

  /** Hands where the avatar actually put them this frame (run after the player's actor updates). */
  hands() {
    const av = this.game.actor.avatar, P = av?.parts;
    if (!P) return null;
    const r = av.rodHand.getWorldPosition(new THREE.Vector3());
    const l = P.armL.localToWorld(av.rodHand.position.clone().setX(-av.rodHand.position.x));
    return { r, l, mid: r.clone().add(l).multiplyScalar(0.5) };
  }

  afterActor(dt) {
    const a = this.active, e = this.eating;
    if (a?.tip) {
      const hd = this.hands();
      if (hd) {
        // the stick runs from just behind your hands (both on it) out over the flames
        const dir = a.tip.clone().sub(hd.mid).normalize();
        const butt = hd.mid.clone().addScaledVector(dir, -0.14), len = butt.distanceTo(a.tip);
        a.stick ||= a.group.children[0];
        a.stick.position.copy(butt).lerp(a.tip, 0.5);
        a.stick.scale.set(1, len, 1);
        a.stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        a.mesh.position.copy(a.tip);
        a.mesh.rotation.set(Math.sin(a.t * 2.6) * 0.5, a.yaw + Math.PI / 2, 0); // turning it over the flames
      }
    }
    if (e) {
      // eating: the roasted fish in your hands at your mouth, a bite at a time
      e.t += dt;
      // v1.13.11: held level across the mouth (the lips are the face's 2nd and 3rd rows up), just in front of the
      // face and tilted a touch towards it, not at the hands' midpoint, which sat on the nose
      const head = this.game.actor.avatar?.parts?.head;
      if (head) {
        head.updateWorldMatrix(true, false);
        e.mesh.position.copy(head.localToWorld(new THREE.Vector3(0, 1.9 * PX, 5.4 * PX)));
        e.mesh.rotation.set(0, this.game.player.yaw, 0); // side-on across the mouth
      }
      const bites = Math.floor(e.t / 0.55);
      if (bites !== e.bites) {
        e.bites = bites;
        this.game.audio.sfx('plip');
        const p = e.mesh.position;
        for (let i = 0; i < 5; i++) this.game.fx?.spawn?.(p.x, p.y, p.z, (Math.random() - 0.5) * 1.2, 0.6 + Math.random(), (Math.random() - 0.5) * 1.2, Math.random() < 0.5 ? '#8a5228' : '#c88a50', 0.7);
      }
      e.mesh.scale.setScalar(e.s0 * Math.max(0.05, 1 - e.t / EAT_SECONDS));
      if (e.t >= EAT_SECONDS) { this.game.engine.scene.remove(e.mesh); this.eating = null; this.fedNow(e.snack); }
    }
  }

  finish() {
    const g = this.game, a = this.active;
    a.done = true;
    g.ui.setRoast?.(null);
    g.audio.sfx('reveal', { tier: 'uncommon' });
    const name = SPECIES_BY_ID[a.fish.speciesId]?.name || 'fish';
    this.closePanel();
    this.panel = h('div.roast-panel.plank.roast-done', { role: 'dialog', 'aria-label': 'Your fish is roasted' },
      h('div.dlg-head', h('span.dlg-name', `Roasted ${name}`), h('span.dlg-esc', 'Esc packs it')),
      h('div.muted', `Golden brown and smoky. Eat it now for Well Fed: Smells Like ${name} (${name} bite far more often, quicker bites, steadier hands).`),
      h('div.dlg-choices',
        h('button.btn.gold.dlg-choice', { 'data-k': '1', on: { click: () => { this.closePanel(); this.eatFromStick(); } } }, h('span.dlg-key', '1'), 'Eat it off the stick'),
        h('button.btn.dlg-choice', { 'data-k': '2', on: { click: () => { this.closePanel(); this.packFromStick(); } } }, h('span.dlg-key', '2'), 'Pack it for later')));
    g.ui.root.append(this.panel);
    this.panel.querySelector('button')?.focus();
  }
  clearStick() { const a = this.active; if (a) this.game.engine.scene.remove(a.group); this.active = null; }
  eatFromStick() { const a = this.active; if (!a) return; this.clearStick(); this.eat({ sp: a.fish.speciesId, w: a.fish.weight }); }
  packFromStick() { const a = this.active; if (!a) return; this.clearStick(); this.pack(a.fish); }

  pack(c, half = false) {
    const g = this.game;
    g.ext.change((d) => { d.snacks = [...(d.snacks || []), { sp: c.speciesId, w: Math.round(c.weight * 100) / 100, at: Date.now() }].slice(-20); });
    g.ui.toast(half ? `You pulled the ${SPECIES_BY_ID[c.speciesId]?.name || 'fish'} off the fire half done. It's in your snack bag.` : `Packed a roasted ${SPECIES_BY_ID[c.speciesId]?.name || 'fish'} in your snack bag. Eat it from your inventory (C) any time.`, { icon: 'creel', ms: 4200 });
    g.ui.sheets?.current?.name === 'creel' && g.ui.sheets.refresh();
  }

  /** Eat a snack from the bag (index into ext.d.snacks). */
  eatSnack(i) {
    const s = this.snacks()[i];
    if (!s) return;
    this.game.ext.change((d) => { d.snacks = (d.snacks || []).filter((_, k) => k !== i); });
    this.eat(s);
    this.game.ui.sheets?.current?.name === 'creel' && this.game.ui.sheets.refresh();
  }

  /** Start eating (the roasted fish appears in your hands; the buff lands when it's gone). */
  eat(s) {
    const g = this.game;
    if (this.eating) { g.engine.scene.remove(this.eating.mesh); this.fedNow(this.eating.snack); }
    const mesh = buildFish(s.sp, 'normal', Math.min(s.w || 1, 2.5));
    mesh.material = mesh.material.clone(); mesh.material.color.copy(ROAST);
    g.engine.scene.add(mesh);
    this.eating = { t: 0, mesh, s0: mesh.scale.x, snack: s, bites: -1 };
    g.ui.sheets?.current && g.ui.sheets.close?.();
  }

  fedNow(s) {
    const g = this.game, name = SPECIES_BY_ID[s.sp]?.name || 'fish', secs = fedSeconds(s.w);
    this.fed = { sp: s.sp, w: s.w, until: performance.now() + secs * 1000, secs };
    g.audio.sfx('buff');
    g.juice?.pop('Yum!', { color: '#ffd890', size: 30 });
    g.chat?.system(`Well Fed! You smell so much like ${name} that its whole family wants a word. For ${Math.round(secs / 60)} min: ${name} bite far more often, bites come quicker, and your hands are steadier on the reel.`, 'catch', { popup: true });
    g.bumpStat?.('fishEaten');
  }

  /** v1.14.9: a forest stew (wildwoods.js): Well Fed with no one fish (no craving), for `secs`. */
  stew(secs) {
    const g = this.game;
    this.fed = { sp: null, stew: true, w: 0, until: performance.now() + secs * 1000, secs };
    g.audio.sfx('buff');
    g.juice?.pop('Mmm, stew!', { color: '#c8e0a0', size: 30 });
    g.chat?.system(`Well Fed: Forest Stew! Chanterelles, blackberries and wild mint. For ${Math.round(secs / 60)} min fish bite quicker and your hands are steadier on the reel.`, 'catch', { popup: true });
    g.ext.bump?.('stews');
  }

  fedLeft() { return this.fed ? Math.max(0, (this.fed.until - performance.now()) / 1000) : 0; }
  /** Added to the game's perks while Well Fed. */
  perks() { return this.fedLeft() > 0 ? { biteSpeed: WELL_FED.biteSpeed, reelZone: WELL_FED.reelZone } : {}; }
  /** The species you smell of (rules.rollBite weights it by WELL_FED.craving), or null. */
  craving() { return this.fedLeft() > 0 ? this.fed.sp : null; }
  info() {
    const left = this.fedLeft();
    if (!(left > 0)) return null;
    if (this.fed.stew) return { name: 'Well Fed: Forest Stew', left, lines: [`Fish bite ${Math.round(WELL_FED.biteSpeed * 100)}% faster`, `Reel zone ${Math.round(WELL_FED.reelZone * 100)}% wider in Tug & Turn`], from: 'From a forest stew cooked at a campfire.' };
    const name = SPECIES_BY_ID[this.fed.sp]?.name || 'fish';
    return { name: `Well Fed: Smells Like ${name}`, left, lines: [`${name} bite far more often (where they live)`, `Fish bite ${Math.round(WELL_FED.biteSpeed * 100)}% faster`, `Reel zone ${Math.round(WELL_FED.reelZone * 100)}% wider in Tug & Turn`], from: 'From eating a campfire-roasted fish. Eat another to switch fish.' };
  }
}
