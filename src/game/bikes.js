// Bicycles (v1.9): a bike stall at Pinewood Lodge run by Rosie Spokes, four bikes to buy, and riding.
//
// Riding: N (or the hotbar bike button) gets on or off your bike anywhere on dry ground. W/S (or both mouse
// buttons) pedal forward and brake/back up, A/D steer: the handlebars and front wheel turn the way you steer,
// the wheels roll and the cranks turn with your speed, and you lean into the turns. Backing up is slow and
// you look back over your shoulder. The fishing button rings the bell (everyone nearby hears it).
import * as THREE from 'three';
import { buildBike, BIKE_SCALE } from '../entities/bikeModels.js';
import { Actor } from './actor.js';
import { randomAvatar } from '../data/avatarOptions.js';
import { mulberry32 } from '../core/rng.js';
import { surfaceY, walkY, onDock } from '../world/terrain.js';
import { signBoard } from '../world/campers.js';
import { addBox } from '../world/colliders.js';
import { h } from '../ui/dom.js';
import { icon, iconURL } from '../ui/icons.js';
import { objectThumb } from '../ui/thumbs.js';
import { Sheets } from '../ui/sheets.js';

export const BIKES = {
  cruiser: { name: 'Meadow Cruiser', price: { coins: 3000 }, speed: 1, desc: 'A mint step-through with whitewall tyres and a wicker basket of wildflowers.' },
  road: { name: 'Red Rocket', price: { coins: 9000 }, speed: 1.1, desc: 'Skinny tyres and drop bars: the quickest bike on the trails.' },
  mtb: { name: 'Ridge Runner', price: { coins: 12000 }, speed: 1, hills: true, desc: 'Knobby tyres and a suspension fork. Climbs hills without slowing down.' },
  tourer: { name: 'Angler\'s Tourer', price: { coins: 15000 }, speed: 1.04, desc: 'A crate on the back, a rod tube and a headlamp. Built for fishing trips.' },
};
export const BIKE_IDS = Object.keys(BIKES);
const WHEEL_R = 0.34 * BIKE_SCALE;
// Speeds (walk 3.6, sprint 4.9): a bike tops out about 1.65x a sprint; backing up is a slow shuffle.
export const BIKE_MAX = 8.0, BIKE_REV = 1.3;
const ACCEL = 5.5, BRAKE = 10, COAST = 2.4;

// The stall: east of the lodge's west cabin, its counter facing the trail into the clearing.
export const STALL = { x: -9.2, z: -183 };
const RACK = { x: -9.2, z: -179.4 };

export class Bikes {
  constructor(game) {
    this.game = game;
    this.riding = false;
    this.v = 0; this.steer = 0; this.wheel = 0; this.crank = 0; this.lean = 0; this.back = 0;
    this.bellT = 0;
    this.vendor = null;
  }
  get d() { return this.game.ext.d; }
  owned() { return this.d.bikes || []; }
  get equipped() { const id = this.d.bike; return id && BIKES[id] && this.owned().includes(id) ? id : null; }

  init() { this.buildStall(); }

  // ---------------- the stall ----------------
  buildStall() {
    const scene = this.game.engine.scene;
    const y0 = surfaceY(STALL.x, STALL.z);
    const g = new THREE.Group(); g.name = 'bike-stall';
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const box = (w, hh, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
    const wood = lam('#9a6a3e'), dark = lam('#6a4428'), top = lam('#c8955a');
    // counter
    box(0.9, 0.95, 2.6, wood, 0, 0.475, 0);
    box(1.05, 0.08, 2.75, top, 0, 0.99, 0);
    // a bell and a pump on the counter
    const brass = new THREE.MeshPhongMaterial({ color: '#f2c84a', shininess: 90, specular: '#ffffff' });
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass); bell.position.set(0.1, 1.03, -0.8); g.add(bell);
    box(0.06, 0.45, 0.06, lam('#2f5fa8'), 0.15, 1.25, 0.9); box(0.2, 0.04, 0.04, dark, 0.15, 1.47, 0.9);
    // posts and a striped awning
    for (const [x, z] of [[-0.45, -1.3], [-0.45, 1.3], [0.45, -1.3], [0.45, 1.3]]) box(0.12, 2.3, 0.12, dark, x, 1.15, z);
    const stripes = document.createElement('canvas'); stripes.width = 64; stripes.height = 8;
    { const c = stripes.getContext('2d'); for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f4efe2' : '#2f9a86'; c.fillRect(i * 8, 0, 8, 8); } }
    const st = new THREE.CanvasTexture(stripes); st.magFilter = THREE.NearestFilter; st.colorSpace = THREE.SRGBColorSpace;
    const awn = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 3.0), new THREE.MeshLambertMaterial({ map: st }));
    awn.position.set(0.15, 2.38, 0); awn.rotation.z = -0.22; awn.castShadow = true; g.add(awn);
    // the sign (v1.12: the same carved board and lettering as the trailer park's, sized so the whole name fits)
    const sign = signBoard('SPOKES & SPROCKETS', 2.5, 0.5);
    sign.rotation.y = Math.PI / 2;
    sign.position.set(0.55, 2.75, 0); g.add(sign);
    g.position.set(STALL.x, y0, STALL.z);
    scene.add(g);
    addBox(STALL.x - 0.6, STALL.z - 1.45, STALL.x + 0.6, STALL.z + 1.45);
    // the bikes on show, parked side by side on a plank rack, leaning on their kickstands
    const rack = new THREE.Group();
    const ry = surfaceY(RACK.x, RACK.z);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.06, 0.25), dark); plank.position.set(0, 0.03, 0); plank.receiveShadow = true; rack.add(plank);
    BIKE_IDS.forEach((id, i) => {
      const b = buildBike(id); if (!b) return;
      const w = new THREE.Group(); w.add(b);
      b.scale.setScalar(BIKE_SCALE); b.rotation.y = Math.PI / 2; // facing the stall
      w.rotation.z = 0.1; w.position.set(-1.05 + i * 0.7, 0, 0.05);
      rack.add(w);
    });
    rack.position.set(RACK.x, ry, RACK.z);
    scene.add(rack);
    addBox(RACK.x - 1.55, RACK.z - 0.45, RACK.x + 1.55, RACK.z + 0.45);
    // Rosie Spokes, behind the counter
    const actor = new Actor(scene);
    actor.setLook(randomAvatar(mulberry32(5150)), { rod: 'rod_willow', lure: 'lure_classic', boat: 'boat_oak' });
    this.vendor = { actor, x: STALL.x - 0.95, z: STALL.z, y: surfaceY(STALL.x - 0.95, STALL.z), yaw: Math.PI / 2 };
  }

  nearStall() {
    const p = this.game.player;
    return p.mode === 'shore' && !this.riding && Math.hypot(p.pos.x - (STALL.x + 1.2), p.pos.z - STALL.z) < 3.4;
  }
  contextActions() {
    return this.nearStall() ? [{ id: 'bikes', label: 'Bike shop', color: 'gold', at: { x: STALL.x, z: STALL.z, y: surfaceY(STALL.x, STALL.z), h: 2.9 }, fn: () => this.game.ui.sheets.open('bikes') }] : [];
  }
  plates(toScreen) {
    const v = this.vendor, me = this.game.player.pos;
    if (!v || Math.hypot(v.x - me.x, v.z - me.z) > 30) return [];
    return [{ id: 'rosie', name: 'Rosie Spokes', title: 'Bike shop', level: 0, screen: toScreen(v.actor.headWorld()), bubble: this.bubble && performance.now() < this.bubble.until ? this.bubble : null, npc: true }];
  }

  async buy(id) {
    const g = this.game, b = BIKES[id];
    if (!b) return false;
    if (this.owned().includes(id)) { this.choose(id); return true; }
    const r = await g.save.spend('gear', `bike_${id}`, b.price);
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough yet.'); return false; }
    g.ext.change((d) => { d.bikes = [...new Set([...(d.bikes || []), id])]; d.bike = id; });
    g.audio.sfx('purchase');
    g.ui.toast(`The ${b.name} is yours! Press ${this.keyName()} anywhere on dry ground to hop on.`, { icon: 'star', ms: 5000 });
    this.bubble = { kind: 'chat', text: 'Enjoy the ride! Ring that bell for me.', until: performance.now() + 4000, key: performance.now() };
    g.pushMeta?.();
    return true;
  }
  choose(id) { this.game.ext.change((d) => { d.bike = id; }); this.game.audio.sfx('toggle'); }
  keyName() { return (this.game.keymap?.keyFor('bike') || 'n').toUpperCase(); }

  // ---------------- riding ----------------
  canMount() {
    const g = this.game, p = g.player;
    if (p.mode !== 'shore' || p.airborne || g.chairs?.seat || g.fishing.busy || g.home?.active || g.treasure?.dig || g.riding) return false;
    if (onDock(p.pos.x, p.pos.z)) return true; // bridges, docks, jetties and boardwalks (v1.9.3)
    return walkY(p.pos.x, p.pos.z, 0) != null && (p.wadeDepth || 0) < 0.05;
  }
  toggle() {
    const g = this.game;
    if (this.riding) { this.dismount(); return; }
    if (!this.equipped) { g.ui.toast(this.owned().length ? 'Pick a bike in the Bike shop at Pinewood Lodge.' : 'You don\'t have a bike yet. Rosie sells them at Pinewood Lodge.', { icon: 'map' }); return; }
    if (!this.canMount()) { g.ui.toast(g.player.mode === 'boat' ? 'Bikes stay on land. Go ashore first.' : 'Bikes don\'t float! Get out of the water first.', { icon: 'info' }); return; }
    g.fishing.cancel();
    this.riding = true; this.v = 0; this.steer = 0; this.back = 0;
    g.player.target = null;
    g.audio.sfx('toggle');
  }
  dismount() {
    if (!this.riding) return;
    this.riding = false; this.v = 0; this.steer = 0; this.lean = 0;
    this.game.player.moving = false;
  }
  ring() {
    const now = performance.now();
    if (now - this.bellT < 350) return;
    this.bellT = now;
    this.game.audio.sfx('bikebell');
    this.game.netEvent('bell', {});
  }

  /** Moves the player on the bike (call before player.update, which then runs locked). */
  drive(dt) {
    const g = this.game, p = g.player;
    if (!this.riding) return;
    if (p.mode !== 'shore') { this.dismount(); return; }
    const locked = g.ui.modalOpen || g.home?.active;
    let f = 0, r = 0;
    if (!locked) {
      f = (p.held('up') ? 1 : 0) - (p.held('down') ? 1 : 0);
      r = (p.held('right') ? 1 : 0) - (p.held('left') ? 1 : 0);
      if (p.stick && (Math.abs(p.stick.x) > 0.05 || Math.abs(p.stick.y) > 0.05)) { f = -p.stick.y; r = p.stick.x; }
      // both mouse buttons: pedal forward and steer toward where the camera looks
      if (p.mouseWalk && !r) { let dy = g.engine.cam.yaw + Math.PI - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r = Math.max(-1, Math.min(1, -dy * 1.6)); }
      if (f || r) p.touch();
    }
    const spec = BIKES[this.equipped] || BIKES.cruiser;
    // hills: climbing slows you down (not on the mountain bike); rolling downhill speeds you up a little
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const ahead = surfaceY(p.pos.x + fx * 0.8, p.pos.z + fz * 0.8) - surfaceY(p.pos.x, p.pos.z);
    const grade = Math.max(-0.6, Math.min(0.8, ahead / 0.8));
    const hill = spec.hills ? 1 : grade > 0 ? Math.max(0.55, 1 - grade * 0.7) : 1 - grade * 0.25;
    const top = BIKE_MAX * spec.speed * hill;
    if (f > 0) this.v = Math.min(top, this.v + ACCEL * dt * (this.v < 0 ? 2 : 1));
    else if (f < 0) this.v = this.v > 0.05 ? Math.max(0, this.v - BRAKE * dt) : Math.max(-BIKE_REV, this.v - ACCEL * 0.5 * dt);
    else this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), COAST * dt);
    if (this.v > top) this.v = Math.max(top, this.v - BRAKE * 0.5 * dt);
    // steering: the bars turn with the input; how fast you turn grows with speed (and flips backing up)
    this.steer += (r * 0.55 - this.steer) * Math.min(1, dt * 7);
    const sp = Math.abs(this.v);
    if (sp > 0.05) p.yaw -= (this.steer / 0.55) * Math.min(2.3, 0.7 + sp * 0.3) * dt * Math.sign(this.v);
    // move, sliding along walls; never into water (no wading on a bike)
    if (sp > 0.001) {
      const step = this.v * dt, nx = p.pos.x + fx * step, nz = p.pos.z + fz * step;
      const ok = (x, z) => p.canStand(x, z) && walkY(x, z, 0.3) != null;
      if (ok(nx, nz)) { p.pos.x = nx; p.pos.z = nz; }
      else if (ok(nx, p.pos.z)) { p.pos.x = nx; this.v *= 0.7; }
      else if (ok(p.pos.x, nz)) { p.pos.z = nz; this.v *= 0.7; }
      else { if (sp > 3) g.audio.sfx('flop'); this.v = 0; }
    }
    p.moving = sp > 0.15;
    p.dir.set(fx, 0, fz);
    // wheels roll with the ground, the cranks turn with the wheels (a gentle gear)
    this.wheel += (this.v * dt) / WHEEL_R;
    this.crank += (this.v * dt) / WHEEL_R * 0.55;
    // lean into turns; look back over your shoulder when backing up
    const lean = -(this.steer / 0.55) * Math.min(1, sp / 6) * 0.22 * Math.sign(this.v || 1);
    this.lean += (lean - this.lean) * Math.min(1, dt * 5);
    this.back += ((this.v < -0.05 || (f < 0 && this.v <= 0.05)) ? 1 - this.back : -this.back) * Math.min(1, dt * 6);
    // the camera swings round behind you while you ride forward (unless you're steering it yourself)
    if (this.v > 1.5 && !p.mouseWalk && performance.now() - (g.camDragAt || 0) > 1500) {
      let dy = p.yaw + Math.PI - g.engine.cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      g.engine.cam.yaw += dy * Math.min(1, dt * 1.6);
    }
  }

  /** The bike part of the actor state. */
  state() {
    return this.riding ? { id: this.equipped, steer: this.steer, wheel: this.wheel, crank: this.crank, lean: this.lean, back: this.back } : null;
  }

  update(dt, t) {
    const v = this.vendor;
    if (v) {
      const me = this.game.player.pos;
      const near = Math.hypot(me.x - v.x, me.z - v.z) < 40;
      v.actor.root.visible = near;
      if (near) {
        if (!this.greeted && Math.hypot(me.x - v.x, me.z - v.z) < 6) { this.greeted = true; this.bubble = { kind: 'chat', text: this.owned().length ? 'How\'s the ride treating you?' : 'Need wheels? Best bikes in the valley!', until: performance.now() + 3500, key: performance.now() }; }
        if (Math.hypot(me.x - v.x, me.z - v.z) > 12) this.greeted = false;
        v.actor.update(dt, t, { x: v.x, y: v.y, z: v.z, yaw: v.yaw, mode: 'shore', pose: Math.sin(t * 0.3) > 0.97 ? 'wave' : 'idle', moving: false, bobber: null, tension: 0, rod: 'back' });
      }
    }
  }
}

// ---------------- the Bike shop sheet ----------------
const price = (p) => h('span.price', h('img', { src: iconURL(p.coins ? 'coin' : 'pearl') }), String(p.coins || p.pearls));
Sheets.prototype.render_bikes = function render_bikes(c) {
  const g = this.game, B = g.bikes;
  c.title.textContent = 'Spokes & Sprockets';
  const owned = B.owned(), eq = B.equipped;
  c.body.append(h('div.muted', { style: { marginBottom: '10px' } }, `Rosie's bikes. Ride anywhere on dry ground: press ${B.keyName()} to hop on or off, W/S to pedal and back up, A/D to steer, and the fishing button rings your bell.`));
  const grid = h('div.bike-grid');
  for (const id of BIKE_IDS) {
    const b = BIKES[id], have = owned.includes(id), on = eq === id;
    const th = objectThumb(`bike:${id}`, () => { const m = buildBike(id, { shadows: false }); if (m) m.rotation.y = 0; return m; }, { rx: 0.25, ry: -0.5, pad: 1.1 });
    const can = (g.profile.coins || 0) >= (b.price.coins || 0) && (g.profile.pearls || 0) >= (b.price.pearls || 0);
    const near = B.nearStall();
    const btn = have
      ? (on ? h('button.btn.small', { disabled: true }, 'Riding this one') : h('button.btn.green', { on: { click: () => { B.choose(id); this.render(); } } }, 'Use this bike'))
      : h('button.btn.gold', { disabled: !can || !near, title: !near ? 'Buy at Rosie\'s stall at Pinewood Lodge' : '', on: { click: async () => { if (await B.buy(id)) this.render(); } } }, !near ? 'Buy at the stall' : can ? 'Buy' : 'Need more');
    grid.append(h(`div.bike-card${on ? '.on' : ''}`,
      h('div.bike-pic', th ? h('img', { src: th, alt: '' }) : icon('star')),
      h('div.bike-name', b.name),
      h('div.bike-desc', b.desc),
      h('div.bike-buy', have ? h('span.ic-tag', on ? 'Yours · in use' : 'Yours') : price(b.price), btn)));
  }
  c.body.append(grid);
};
