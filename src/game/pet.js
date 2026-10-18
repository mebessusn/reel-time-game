// Fishing buddies: a pet that trots after you, sits by you while you fish, rides in your boat, and
// every few minutes wanders off and comes back with something it found. Other anglers see it too.
import * as THREE from 'three';
import { groundY, WATER_Y } from '../world/terrain.js';
import { buildCritter } from '../entities/critters.js';
import { basketSpot, BIKE_SCALE } from '../entities/bikeModels.js';

export const PETS = {
  otter: { name: 'Otter', price: { pearls: 70 }, desc: 'Swims beside your boat and loves shiny things.', colors: ['#7a5232', '#c8a070', '#2a1a10'] },
  cat: { name: 'Dock Cat', price: { pearls: 55 }, desc: 'Purrs when you land something. Judges you when you miss.', colors: ['#e89a4a', '#f8e8d0', '#2a1a10'] },
  dog: { name: 'Lab Pup', price: { coins: 3500 }, desc: 'Fetches everything. Mostly sticks.', colors: ['#d8b070', '#f0dcb0', '#2a1a10'] },
  duck: { name: 'Duckling', price: { coins: 2000 }, desc: 'Waddles after you. Peeps at fish.', colors: ['#f2d040', '#f0a020', '#2a1a10'] },
};

// v1.8.2: cute low-poly pets from art/critters.blend (round bodies, big heads and eyes, blushing cheeks)
const MODEL = { otter: 'otter', cat: 'cat', dog: 'dog', duck: 'duckling' };
export function buildPet(kind) {
  if (!PETS[kind]) return null;
  const c = buildCritter(MODEL[kind]);
  if (!c) return null;
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.add(c);
  g.add(body);
  const { head, tail, legFL, legFR, legBL, legBR } = c.userData.parts;
  g.userData = { body, head, tail, legs: { FL: legFL, FR: legFR, BL: legBL, BR: legBR } };
  g.scale.setScalar(kind === 'duck' ? 1.25 : 1.15);
  return g;
}

/** Moves a pet mesh after its owner. Shared by your pet and other anglers' pets. */
export class PetFollower {
  constructor(scene, kind) {
    this.scene = scene;
    this.kind = kind;
    this.mesh = buildPet(kind);
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.away = 0; // seconds left wandering off to fetch something
    if (this.mesh) scene.add(this.mesh);
  }
  dispose() { this.mesh?.parent?.remove(this.mesh); }

  update(dt, t, owner) {
    if (!this.mesh) return;
    const m = this.mesh;
    m.visible = owner.visible !== false;
    const side = new THREE.Vector3(Math.cos(owner.yaw), 0, -Math.sin(owner.yaw)); // owner's left
    let tx, tz, ty;
    // v1.9.4: in the boat the pet is parented to the boat itself, so it rises, pitches and rolls with every
    // wave instead of the hull clipping through it: at the bow, or in the stern behind you when a friend has
    // the front seat. Off the boat it goes back to the world where it was.
    const inBoat = owner.mode === 'boat' && this.kind !== 'otter' && owner.root;
    // v1.13.11: on a bike with a front basket or a back crate, the pet hops in and rides there (every pet, the otter too)
    const basket = !inBoat && owner.mode !== 'boat' && owner.bike ? basketSpot(owner.bike) : null;
    const home = inBoat ? owner.root : basket ? basket.obj : null;
    if (m.userData.baseScale == null) m.userData.baseScale = m.scale.x;
    if (home && m.parent !== home) {
      if (m.parent && m.parent !== this.scene) m.parent.remove(m);
      home.add(m);
      m.scale.setScalar(basket ? (m.userData.baseScale * 0.8) / BIKE_SCALE : m.userData.baseScale); // the bike model is scaled down; undo that, then a little snugger
    } else if (!home && m.parent !== this.scene) {
      m.getWorldPosition(this.pos); this.scene.add(m); m.scale.setScalar(m.userData.baseScale); this.yaw = owner.yaw - Math.PI / 2;
    }
    if (basket) {
      m.position.copy(basket.pos);
      m.rotation.set(0, 0, 0); // facing the way the bike goes
      const b = m.userData.body; if (b) { b.rotation.set(0, 0, 0.5); b.position.set(0.04, 0.02, 0); } // sat up, peering over the rim
      if (m.userData.head) { m.userData.head.rotation.x = Math.sin(t * 1.3) * 0.15; m.userData.head.rotation.z = -0.4; }
      if (m.userData.tail) m.userData.tail.rotation.y = Math.sin(t * 5) * 0.5;
      this.sitK = 1;
      return;
    }
    if (inBoat) {
      const z = owner.passenger ? 0.62 : owner.guest ? -1.05 : 0.78;
      this.pos.set(0, 0.17, z); // on the boat's floor, in the boat's own frame
      this.yaw = -Math.PI / 2;
    } else if (owner.mode === 'boat') {
      // the otter swims alongside
      tx = owner.x + side.x * 1.3; tz = owner.z + side.z * 1.3;
      this.pos.set(tx, WATER_Y - 0.12, tz);
    } else if (this.away > 0) {
      this.away -= dt;
      const a = t * 0.8;
      tx = owner.x + Math.cos(a) * 7; tz = owner.z + Math.sin(a) * 7;
    } else {
      const sitting = owner.fishing;
      tx = owner.x + side.x * (sitting ? 0.8 : 1.1) - Math.sin(owner.yaw) * (sitting ? 0.2 : 0.9);
      tz = owner.z + side.z * (sitting ? 0.8 : 1.1) - Math.cos(owner.yaw) * (sitting ? 0.2 : 0.9);
    }
    let moving = false;
    if (owner.mode !== 'boat') {
      const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
      if (d > 16) { this.pos.set(tx, owner.y, tz); }
      else if (d > 0.15) {
        // v1.9: keeps up with you, even on a bike: the further behind, the harder it runs
        const sp = Math.min(d, dt * (d > 2 ? Math.min(13, 4.5 + d * 2) : 3.2));
        this.pos.x += (dx / d) * sp; this.pos.z += (dz / d) * sp;
        this.speed = sp / Math.max(dt, 1e-3);
        moving = true;
        let dy = Math.atan2(-dz, dx) - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += dy * Math.min(1, dt * 8);
      } else {
        let dy = owner.yaw - Math.PI / 2 - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += dy * Math.min(1, dt * 3);
      }
      const gy = groundY(this.pos.x, this.pos.z);
      this.pos.y = gy != null ? gy : this.kind === 'otter' ? WATER_Y - 0.12 : owner.y;
    } else if (!inBoat) this.yaw = owner.yaw - Math.PI / 2;
    m.position.copy(this.pos);
    // v1.9: real legs. A trot at a walk (diagonal pairs together), a bounding gallop when it has to
    // hurry (front pair then back pair, the back flexing), a waddle for the duckling.
    const spd = moving ? this.speed || 0 : 0;
    this.runK = (this.runK || 0) + ((moving ? 1 : 0) - (this.runK || 0)) * Math.min(1, dt * 8);
    // v1.9.2: the faster it goes, the longer each stride (not just quicker legs): an easy walk beside you,
    // a trot when you run, a long, loping gallop beside your bike
    this.spdS = (this.spdS || 0) + (spd - (this.spdS || 0)) * Math.min(1, dt * 4);
    const v = this.spdS, strideLen = Math.min(1.25, 0.28 + v * 0.11);
    this.stride = ((this.stride || 0) + (v / strideLen) * Math.PI * 2 * dt) % (Math.PI * 200);
    const ph = this.stride, rk = this.runK, gallop = Math.min(1, Math.max(0, (v - 5) / 2.5)), walkish = Math.max(0, 1 - v / 2.5);
    const L = m.userData.legs || {}, duckK = this.kind === 'duck';
    const swing = (leg, a) => { if (leg) leg.rotation.z = a; };
    if (duckK) {
      swing(L.FL, Math.sin(ph) * 0.7 * rk); swing(L.FR, -Math.sin(ph) * 0.7 * rk);
      if (m.userData.body) m.userData.body.rotation.x = Math.sin(ph) * 0.14 * rk; // waddle
    } else {
      const amp = (0.6 - walkish * 0.28 + gallop * 0.3) * rk;
      const trot = { FL: Math.sin(ph), BR: Math.sin(ph), FR: -Math.sin(ph), BL: -Math.sin(ph) };
      const gal = { FL: Math.sin(ph), FR: Math.sin(ph + 0.5), BL: Math.sin(ph + 2.6), BR: Math.sin(ph + 3.1) };
      for (const k of ['FL', 'FR', 'BL', 'BR']) swing(L[k], (trot[k] * (1 - gallop) + gal[k] * gallop) * amp);
    }
    m.position.y += rk * (duckK ? Math.abs(Math.sin(ph)) * 0.025 : Math.abs(Math.sin(ph)) * (0.008 + (1 - walkish) * 0.012 + gallop * 0.045));
    m.rotation.y = this.yaw;
    if (m.userData.tail) m.userData.tail.rotation.y = Math.sin(moving ? ph * 0.5 : t * 4) * 0.4;
    // v1.8.2: a proper sit, in the boat and beside you while you fish: haunches down, chest up, head level,
    // tail curled on the floor (the duckling just settles and fluffs down; the otter swims)
    const sit = !moving && (owner.mode === 'boat' ? this.kind !== 'otter' : owner.fishing) ? 1 : 0;
    this.sitK = (this.sitK || 0) + (sit - (this.sitK || 0)) * Math.min(1, dt * 6);
    const k = this.sitK, duck = this.kind === 'duck';
    if (m.userData.body) {
      const b = m.userData.body;
      b.rotation.z = k * (duck ? 0.12 : 0.55) + (duck ? 0 : Math.sin(ph + 1.2) * 0.12 * gallop * rk); // the gallop rocks the body
      b.position.set(k * (duck ? 0 : 0.05), k * (duck ? -0.02 : 0.08), 0); // pivots on the haunches, not the belly
    }
    if (m.userData.head) {
      m.userData.head.rotation.x = Math.sin(t * 0.9) * 0.12;
      m.userData.head.rotation.z = -k * (duck ? 0.1 : 0.48) + (moving ? 0 : Math.max(0, Math.sin(t * 0.37) - 0.8) * 1.2); // looks around, a little head tilt
    }
    // sitting: front legs straight down under the chest, back legs folded forward under the haunches
    if (k > 0.01 && !duck) { swing(L.FL, -k * 0.55); swing(L.FR, -k * 0.55); swing(L.BL, k * 0.95); swing(L.BR, k * 0.95); }
    if (m.userData.tail && k > 0.5) m.userData.tail.rotation.z = -k * 0.5;
    else if (m.userData.tail) m.userData.tail.rotation.z = 0;
  }
}

const FINDS = [['can', 30], ['boot', 25], ['lilypad', 20], ['bottle', 15], ['chest', 10]];

export class Pet {
  constructor(game) { this.game = game; this.follower = null; this.fetchT = 300 + Math.random() * 200; }
  get kind() { return this.game.ext.d.pet || null; }
  owned() { return this.game.ext.d.pets || []; }

  init() { this.sync(); }
  sync() {
    if (this.follower?.kind === this.kind) return;
    this.follower?.dispose();
    this.follower = this.kind ? new PetFollower(this.game.engine.scene, this.kind) : null;
    if (this.follower) this.follower.pos.copy(this.game.player.pos);
    this.game.pushMeta();
  }

  async buy(kind) {
    const g = this.game, p = PETS[kind];
    if (this.owned().includes(kind)) { this.choose(kind); return true; }
    const r = await g.save.spend('decor', `pet_${kind}`, p.price);
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough yet.'); return false; }
    g.ext.change((d) => { d.pets = [...new Set([...(d.pets || []), kind])]; d.pet = kind; });
    g.audio.sfx('purchase');
    g.ui.toast(`${p.name} adopted! They'll follow you around the lake.`, { icon: 'smile', ms: 4500 });
    this.sync();
    return true;
  }
  choose(kind) { this.game.ext.change((d) => { d.pet = kind; }); this.sync(); }

  // Every few minutes your pet wanders off and brings something back.
  async fetch() {
    const g = this.game, f = this.follower;
    if (!f) return;
    let x = Math.random() * 100, pick = FINDS[0][0];
    for (const [id, w] of FINDS) { x -= w; if (x <= 0) { pick = id; break; } }
    f.away = 6;
    setTimeout(async () => {
      try {
        const out = await g.save.recordJunk(pick);
        const name = PETS[f.kind].name;
        const what = { can: 'a tin can (thanks?)', boot: 'an old boot', lilypad: 'a lily pad', bottle: 'a message in a bottle', chest: `a little treasure chest! +${out.coins || 0} coins` }[pick];
        g.ui.toast(`Your ${name} brought back ${what}`, { icon: 'smile', ms: 4500 });
        if (out.message) g.chat?.system(`The bottle says: “${out.message}”`, 'info');
        g.ext.bump('petFinds');
        if (out.levelUp) g.onLevelUp(out.levelUp);
      } catch { /* the pet got distracted */ }
    }, 6000);
  }

  update(dt, t) {
    const g = this.game, pl = g.player;
    if (!this.follower) return;
    this.follower.update(dt, t, { x: pl.pos.x, y: pl.pos.y, z: pl.pos.z, yaw: pl.yaw, mode: pl.mode, fishing: g.fishing.state !== 'idle', root: g.actor.root, passenger: !!g.riding, guest: !!g.remotes?.hasPassenger(g.save?.userId), bike: g.bikes?.riding ? g.actor.bikeObj : null });
    if (pl.afk || g.ui.modalOpen) return;
    this.fetchT -= dt;
    if (this.fetchT <= 0) { this.fetchT = 360 + Math.random() * 240; this.fetch(); }
  }
}
