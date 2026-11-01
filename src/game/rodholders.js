// Rod holders: fish more than one rod at once. Cast as usual, then press E ("Prop this rod up") to stand
// that rod in a holder on the bank with its bobber still out. Take out your next rod and cast again.
// A propped rod bites on its own: its bobber dunks, a bell rings and a "!" floats over it. Get to it
// within a few seconds and press E to grab it and fight the fish as usual. Miss it and the bait's gone.
// How many holders you can use comes from the "Rod holders" upgrade. Shore only.
import * as THREE from 'three';
import { WATER_Y, groundY } from '../world/terrain.js';
import { buildRod, buildBobber, FishingLine } from '../entities/gear.js';
import { biteDelay } from './rules.js';

const BITE_WINDOW = 7; // seconds a propped rod's bite waits for you
const REACH = 3.2;

export class RodHolders {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.marker = null;
  }

  get max() { return this.game.ext?.d?.upgrades?.holders || 0; }

  canProp() {
    const g = this.game, f = g.fishing;
    return g.player.mode === 'shore' && (f.state === 'waiting' || f.state === 'nibble') && f.bobber && !g.home?.active && this.list.length < this.max && !g.answerPending;
  }

  prop() {
    const g = this.game, f = g.fishing, p = g.player;
    if (!this.canProp()) return;
    const ctx = f.ctx();
    const rodId = g.profile.equipped.rod, lureId = g.profile.equipped.lure;
    // the rod stands in the bank just in front of you, leaning out over the water toward its bobber
    const fx = f.bobber.x - p.pos.x, fz = f.bobber.z - p.pos.z, d = Math.hypot(fx, fz) || 1;
    const at = { x: p.pos.x + (fx / d) * 0.6, z: p.pos.z + (fz / d) * 0.6 };
    const root = new THREE.Group();
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.7, 6), new THREE.MeshLambertMaterial({ color: '#6a4a2a' }));
    stake.position.y = 0.2;
    const fork = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 5, 8, Math.PI), stake.material);
    fork.position.y = 0.55; fork.rotation.z = Math.PI;
    const rod = buildRod(rodId);
    const tilt = new THREE.Group();
    tilt.add(rod);
    tilt.position.y = 0.5;
    tilt.rotation.x = -0.75; // lean out over the water
    root.add(stake, fork, tilt);
    root.position.set(at.x, groundY(at.x, at.z), at.z);
    root.rotation.y = Math.atan2(fx, fz);
    const bob = buildBobber(lureId);
    bob.position.set(f.bobber.x, WATER_Y, f.bobber.z);
    const line = new FishingLine();
    g.engine.scene.add(root, bob, line.line);
    const h = {
      id: Math.random().toString(36).slice(2, 8), root, tilt, rod, bob, line,
      x: f.bobber.x, z: f.bobber.z, ctx, timer: biteDelay(ctx) * 1.25, state: 'waiting', dunk: 0, t: 0,
    };
    this.list.push(h);
    // the rod in your hands goes into the holder: you take out the next one, ready to cast
    f.bobber = null; f.state = 'idle';
    g.audio.sfx('click');
    g.ui.toast(`Rod propped up (${this.list.length}/${this.max}). Cast another! A bell rings when one bites.`, { icon: 'rod', ms: 3200 });
  }

  remove(h) {
    const s = this.game.engine.scene;
    s.remove(h.root, h.bob, h.line.line);
    this.list = this.list.filter((x) => x !== h);
  }

  clear() { for (const h of [...this.list]) this.remove(h); }

  near() {
    const p = this.game.player.pos;
    let best = null, bd = REACH;
    for (const h of this.list) { const d = Math.hypot(h.root.position.x - p.x, h.root.position.z - p.z); if (d < bd) { bd = d; best = h; } }
    return best;
  }

  // Grab the biting rod: its bobber becomes yours, and the fish is hooked straight away.
  grab(h) {
    const g = this.game, f = g.fishing;
    if (f.busy) return;
    this.remove(h);
    g.player.faceToward(h.x, h.z);
    f.bobber = { x: h.x, z: h.z, dunk: 1 };
    f.perfect = false; f.super = false; f.fromHolder = true;
    f.state = 'bite';
    f.hook();
  }

  contextActions() {
    const acts = [];
    if (this.canProp()) acts.push({ id: 'prop-rod', label: `Prop this rod up (${this.list.length + 1}/${this.max})`, color: 'blue', fn: () => this.prop() });
    const h = this.near();
    if (h && !this.game.fishing.busy) {
      const at = { x: h.root.position.x, z: h.root.position.z, y: h.root.position.y, h: 1.8 };
      if (h.state === 'bite') acts.push({ id: `grab-${h.id}`, label: 'Grab the rod!', color: 'gold', at, fn: () => this.grab(h) });
      else acts.push({ id: `pick-${h.id}`, label: 'Pick up rod', color: 'ghost', at, fn: () => { this.remove(h); this.game.audio.sfx('reelin'); } });
    }
    return acts;
  }

  update(dt) {
    const g = this.game;
    if (!this.list.length) { if (this.marker) this.marker.visible = false; return; }
    // leaving the shore (boat, cottage, far away) packs the rods up
    if (g.player.mode !== 'shore' || g.home?.active) { this.clear(); g.ui.toast('You packed up your propped rods.', { icon: 'rod' }); return; }
    const tip = new THREE.Vector3();
    let biting = null;
    for (const h of this.list) {
      h.t += dt;
      if (Math.hypot(h.root.position.x - g.player.pos.x, h.root.position.z - g.player.pos.z) > 45) { this.remove(h); g.ui.toast('A propped rod was left too far behind, so you packed it up.', { icon: 'rod' }); continue; }
      if (h.state === 'waiting') {
        h.timer -= dt;
        if (h.timer < 1.4) h.dunk = Math.random() < dt * 3 ? 0.35 : h.dunk * 0.9;
        if (h.timer <= 0) {
          h.state = 'bite'; h.timer = BITE_WINDOW;
          g.audio.sfx('bell'); g.audio.sfx('bite');
          g.fx.splash(new THREE.Vector3(h.x, WATER_Y, h.z), 0.7);
          g.ui.toast('A propped rod is bending! Get to it and press E.', { icon: 'bell', ms: 3000 });
        }
      } else if (h.state === 'bite') {
        h.timer -= dt;
        h.dunk = 0.7 + Math.sin(h.t * 18) * 0.3;
        biting = biting || h;
        if (h.timer <= 0) {
          h.state = 'waiting'; h.timer = biteDelay(h.ctx) * 1.25; h.dunk = 0;
          g.ui.toast('It stole the bait from a propped rod. It will bite again.', { icon: 'worm' });
        }
      }
      // the rod bows when something pulls
      h.tilt.rotation.x = -0.75 + (h.state === 'bite' ? 0.25 + Math.sin(h.t * 14) * 0.12 : 0);
      h.bob.position.set(h.x, WATER_Y - h.dunk * 0.18 + Math.sin(h.t * 2) * 0.02, h.z);
      h.rod.updateWorldMatrix(true, true);
      if (h.rod.userData.tip) h.rod.userData.tip.getWorldPosition(tip); else { tip.set(0, 1.6, 0); h.rod.localToWorld(tip); }
      h.line.update(tip, h.bob.position, 0.4, h.state === 'bite' ? 0.8 : 0);
      h.line.line.visible = true;
    }
    // a bobbing "!" over the rod that's biting
    if (!this.marker) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'); x.font = '900 52px Nunito, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#ffd84a'; x.strokeStyle = '#3a2a10'; x.lineWidth = 6; x.strokeText('!', 32, 52); x.fillText('!', 32, 52);
      this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
      this.marker.scale.set(0.8, 0.8, 0.8); this.marker.renderOrder = 10;
      g.engine.scene.add(this.marker);
    }
    this.marker.visible = !!biting;
    if (biting) this.marker.position.set(biting.root.position.x, biting.root.position.y + 2.4 + Math.sin(biting.t * 6) * 0.12, biting.root.position.z);
  }
}

