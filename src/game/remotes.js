// Other anglers on the lake: one Actor per peer, smoothed positions, emotes, show-offs, catches.
import * as THREE from 'three';
import { Actor } from './actor.js';
import { WATER_Y } from '../world/terrain.js';
import { PetFollower, PETS } from './pet.js';
import { SEAT_H } from './chairs.js';
import { readParty } from './party.js';
import { SPECIES_BY_ID } from '../data/species.js';

const MAX_RENDERED = 16;

export class Remotes {
  constructor(game) {
    this.game = game;
    this.list = new Map();
  }

  attach(net) {
    // v1.15: only the net you're on right now draws anglers (a charter's crew room, or the lake)
    const real = net;
    net = { on: (type, fn) => real.on(type, (e) => { if (this.game.net === real) fn(e); }) };
    net.on('peer:join', (p) => this.add(p));
    net.on('peer:leave', (p) => this.remove(p.id));
    // v1.14.7: looks are built when an angler is first drawn (update() notices the change), not for everyone on the lake
    net.on('peer:meta', (p) => { const r = this.list.get(p.id); if (r?.lk) r.lk = null; });
    net.on('ev:cast', ({ from }) => { if (this.near(from)) this.game.audio.sfx('whoosh', { remote: true }); });
    net.on('ev:splash', ({ from, data }) => {
      const r = this.list.get(from);
      if (!r || !data) return;
      this.game.fx.splash(new THREE.Vector3(data.x, WATER_Y, data.z), 0.6);
      this.game.engine.water.ripple(data.x, data.z, 0.4);
      if (this.near(from)) this.game.audio.sfx('splashRemote');
    });
    net.on('ev:catch', ({ from, data }) => {
      const r = this.list.get(from);
      // v1.14.7: presence is untrusted; a catch naming a fish this game doesn't know (an older or newer
      // version, or a broken client) is ignored instead of breaking the bubble drawing every frame
      if (!r || !data || !SPECIES_BY_ID[data.speciesId]) return;
      if (r.actor.root.visible) r.actor.showHeld(data.speciesId, data.variant, data.weight, 3.5);
      // In an artifact room there is no shared feed table, so great catches reach the feed from here.
      if (this.game.net?.kind === 'room' && (data.variant !== 'normal' || ['rare', 'epic', 'legendary', 'mythic'].includes(data.tier))) {
        this.game.ui.addFeed({ kind: 'catch', name: r.peer.meta?.name || 'Someone', payload: { speciesId: data.speciesId, variant: data.variant, weight: data.weight } });
      }
      this.game.lakeFlag?.onRemoteCatch(r.peer.meta, data, r.pos); // v1.9.8: record their lake flag for them if they can't
      r.bubble = { kind: 'showoff', speciesId: data.speciesId, variant: data.variant, until: performance.now() + 5000, key: performance.now() };
      this.game.logCatch?.(r.peer.meta?.name || 'Someone', data);
      if (data.variant === 'diamond' || data.tier === 'mythic') {
        this.game.fx.column(r.actor.root.position.clone().setY(WATER_Y), data.variant === 'diamond' ? '#a0f0ff' : '#ff9ae8');
        this.game.audio.sfx('remoteGreat');
      }
    });
    // a bike bell: ding-ding, louder the closer they are
    net.on('ev:bell', ({ from }) => {
      const r = this.list.get(from);
      if (!r) return;
      const d = r.actor.root.position.distanceTo(this.game.player.pos);
      if (d < 30) this.game.audio.sfx('bikebell', { remote: true, vol: Math.max(0.15, 1 - d / 30) });
    });
    net.on('ev:emote', ({ from, data }) => {
      const r = this.list.get(from);
      if (!r || !data) return;
      r.emote = { id: data.id, until: performance.now() + 2600 };
      if (data.id === 'showoff' && SPECIES_BY_ID[data.speciesId]) r.bubble = { kind: 'showoff', speciesId: data.speciesId, variant: data.variant, until: performance.now() + 5000, key: performance.now() };
      if (this.near(from)) this.game.audio.sfx({ wave: 'whistle', cheer: 'cheer', clap: 'clap', sleep: 'yawn' }[data.id] || 'click', { remote: true });
    });
  }

  near(id, d = 25) {
    const r = this.list.get(id);
    // v1.13.10: their actual position, not where their model was last drawn (which lags, or sits at the origin
    // until they're first drawn), so a chat bubble isn't dropped for someone standing right next to you
    return !!r && r.pos.distanceTo(this.game.player.pos) < d;
  }

  add(peer) {
    if (this.list.has(peer.id)) return;
    // v1.14.7: no avatar, rod or boat yet: only the 16 nearest anglers are drawn, so a busy lake builds models
    // for those alone (each costs a few MB) and builds the rest as they come near
    const actor = new Actor(this.game.engine.scene);
    const s = peer.state;
    const r = { id: peer.id, peer, actor, pos: new THREE.Vector3(s?.x || 0, s?.y || 1.5, s?.z || 38), yaw: s?.yaw || Math.PI, bubble: null, emote: null };
    this.list.set(peer.id, r);
  }

  /** Swap to another net's anglers (going to sea and back): drop everyone, add whoever that net knows. */
  resync(net) {
    for (const id of [...this.list.keys()]) this.remove(id);
    for (const p of net?.peers?.values?.() || []) this.add(p);
  }

  remove(id) {
    const r = this.list.get(id);
    if (!r) return;
    r.actor.dispose();
    r.pet?.dispose();
    this.list.delete(id);
  }

  update(dt, t) {
    const me = this.game.player.pos;
    const sorted = [...this.list.values()].sort((a, b) => a.pos.distanceToSquared(me) - b.pos.distanceToSquared(me));
    sorted.forEach((r, i) => {
      const s = r.peer.state;
      const oc = s ? this.game.ocean?.remoteAt(r, s) : null; // v1.15: at sea, only my crew, on my copy of the boat
      const visible = i < MAX_RENDERED && !!s && !oc?.hide && !s.hid; // (hid: aboard Skye's plane, Frostmere)
      r.actor.root.visible = visible;
      if (!s) return;
      if (visible) {
        const lk = r.lk && r.lkMeta === r.peer.meta ? r.lk : JSON.stringify([r.peer.meta?.avatar, r.peer.meta?.equipped]);
        r.lkMeta = r.peer.meta;
        if (r.lk !== lk) { r.lk = lk; r.actor.setLook(r.peer.meta?.avatar, r.peer.meta?.equipped || {}); }
      } else if (r.shown) {
        // v1.14.7: out of the nearest 16: their line, float and held fish live in the scene, not under the angler,
        // so hide them too (a held fish used to hang in the air forever when its angler stopped being drawn)
        r.shown = false;
        r.actor.line.line.visible = false;
        if (r.actor.bobberObj) r.actor.bobberObj.visible = false;
        r.actor.clearHeld();
        if (r.actor.lantern) r.actor.lantern.userData.pool.visible = false;
      }
      const k = Math.min(1, dt * 8);
      if (r.pos.distanceTo(new THREE.Vector3(s.x, s.y, s.z)) > 8) r.pos.set(s.x, s.y, s.z);
      r.pos.x += (s.x - r.pos.x) * k; r.pos.y += (s.y - r.pos.y) * k; r.pos.z += (s.z - r.pos.z) * k;
      let dy = s.yaw - r.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.yaw += dy * k;
      if (oc && oc.x != null) {
        const kk = Math.min(1, dt * 10), ox = oc.x - r.pos.x, oz = oc.z - r.pos.z;
        if (ox * ox + oz * oz > 25) r.pos.set(oc.x, oc.y, oc.z); else { r.pos.x += ox * kk; r.pos.z += oz * kk; r.pos.y = oc.y; }
        let d2 = oc.yaw - r.yaw; d2 = Math.atan2(Math.sin(d2), Math.cos(d2)); r.yaw += d2 * kk;
      }
      // v1.8.2: a passenger sits on the front seat of the boat as THIS screen draws it (the host's own
      // rendered position and heading), never at their own lagging broadcast position, so it never
      // trails behind the boat or spins in the seat
      // v1.11: only a party member rides in your boat (or anyone's, as you see it): strangers stay where they are
      const rideOk = !!s.ride && (s.ride === this.game.save.userId ? !!this.game.party?.has(r.peer.meta?.id) : !!readParty(this.byMeta(s.ride)?.peer.meta)?.m.includes(r.peer.meta?.id));
      if (rideOk) {
        const me = this.game.player, mine = s.ride === this.game.save.userId;
        const host = mine ? null : this.byMeta(s.ride);
        const hp = mine ? me.pos : host?.pos, hy = mine ? me.yaw : host?.yaw;
        if (hp && hy != null) { r.yaw = hy; r.pos.set(hp.x + Math.sin(hy) * 0.45, hp.y, hp.z + Math.cos(hy) * 0.45); }
      }
      const now = performance.now();
      let pose = s.pose;
      if (r.emote && now < r.emote.until && (pose === 'idle' || !pose)) pose = r.emote.id === 'showoff' ? 'hold' : r.emote.id;
      if (s.afk) pose = 'sleep';
      // their pet, if they have one (only known kinds; presence is untrusted)
      // v1.9: on a bike: the wheels and cranks turn with how fast they're really going on this screen
      let bike = null;
      if (s.bk && s.mode === 'shore') {
        const moved = r.lastP ? Math.hypot(r.pos.x - r.lastP.x, r.pos.z - r.lastP.z) : 0;
        const sgn = (s.bv || 0) < 0 ? -1 : 1, v = Math.min(12, moved / Math.max(dt, 1e-3)) * sgn;
        r.bikeW = (r.bikeW || 0) + (v * dt) / (0.34 * 0.68);
        r.bikeLean = (r.bikeLean || 0) + ((-(s.bs || 0) / 0.55) * Math.min(1, Math.abs(v) / 6) * 0.22 * sgn - (r.bikeLean || 0)) * Math.min(1, dt * 5);
        r.bikeBack = (r.bikeBack || 0) + ((sgn < 0 ? 1 : 0) - (r.bikeBack || 0)) * Math.min(1, dt * 6);
        bike = { id: s.bk, steer: s.bs || 0, wheel: r.bikeW, crank: r.bikeW * 0.55, lean: r.bikeLean, back: r.bikeBack };
      }
      r.lastP = { x: r.pos.x, z: r.pos.z };
      const pk = PETS[r.peer.meta?.pet] ? r.peer.meta.pet : null;
      // v1.14.7: pets are made when their angler is first drawn
      if ((r.pet?.kind || null) !== pk && (visible || r.pet)) { r.pet?.dispose(); r.pet = pk ? new PetFollower(this.game.engine.scene, pk) : null; if (r.pet) r.pet.pos.copy(r.pos); }
      if (r.pet) r.pet.update(dt, t, { x: r.pos.x, y: r.pos.y, z: r.pos.z, yaw: r.yaw, mode: s.mode, fishing: !!s.bobber, visible, root: r.actor.root, passenger: rideOk, guest: !!(r.peer.meta?.id && (this.hasPassenger(r.peer.meta.id) || this.game.riding === r.peer.meta.id)), bike: bike?.id && r.actor.bikeObj?.visible ? r.actor.bikeObj : null });
      if (!visible) return;
      r.shown = true;
      r.actor.update(dt, t, { x: r.pos.x, y: r.pos.y, z: r.pos.z, yaw: r.yaw, mode: s.mode, pose, moving: s.moving, bobber: s.bobber, tension: s.tension, rod: s.rod || (s.mode === 'boat' && !s.bobber ? 'back' : 'hand'), seat: s.seat && s.mode === 'shore' ? (s.seat === 1 || s.seat === true ? SEAT_H : Math.min(0.8, +s.seat || SEAT_H)) : 0, seatYaw: s.seat && s.mode === 'shore' && typeof s.seatYaw === 'number' ? s.seatYaw : undefined, running: !!s.run, passenger: rideOk, bike, swim: s.sw || 0, dg: typeof s.dg === 'string' ? s.dg.slice(0, 5) : '', skate: s.sk === 1 || s.sk === 2 ? s.sk : 0, blades: !!s.bl, sled: s.sl ? 1 : 0 });
      if (r.bubble && now > r.bubble.until) r.bubble = null;
      if (s.afk) r.bubble = { kind: 'zzz', text: 'z z z', until: now + 1000, key: 'z' };
      else if (r.bubble?.kind === 'zzz') r.bubble = null;
    });
  }

  count() { return this.list.size; }
  within(pos, d) { let n = 0; for (const r of this.list.values()) if (r.peer.state && r.pos.distanceTo(pos) < d) n++; return n; }
  boatsNear(pos, d) { return [...this.list.values()].filter((r) => r.peer.state?.mode === 'boat' && !r.peer.state?.ride && r.pos.distanceTo(pos) < d); }
  /** The remote whose angler id is `id` (meta.id), or null. */
  byMeta(id) { for (const r of this.list.values()) if (r.peer.meta?.id === id) return r; return null; }
  /** Is someone already riding in this angler's boat? */
  hasPassenger(id) { for (const r of this.list.values()) if (r.peer.state?.ride === id && (id !== this.game.save.userId || this.game.party?.has(r.peer.meta?.id))) return true; return false; }
}
