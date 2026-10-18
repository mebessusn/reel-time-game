// An angler in the world: avatar + rod + bobber + line + optional rowboat. Used for you and for remote players.
import * as THREE from 'three';
import { buildShovel } from '../entities/treasureModels.js';
import { buildBike, poseBike, BIKE_SCALE, BIKE_SEAT } from '../entities/bikeModels.js';
import { makeLantern } from './nightlights.js';
import { buildAvatar, animateAvatar } from '../entities/avatar2.js';
import { buildRod, buildBobber, buildBoat, FishingLine, animateOars } from '../entities/gear.js';
import { gearReady } from '../entities/gearModels.js';
import { buildFish } from '../entities/fish.js';
import { WATER_Y } from '../world/terrain.js';
import { waveAt } from '../world/water.js';

const tmpV = new THREE.Vector3();

export class Actor {
  static camera = null; // set by the game so held fish can turn to face it
  // While fishing, the rod leans forward over the water and out to the casting side, clear of big hat brims.
  static ROD_TILT = { x: 0.45, y: 0.45 };
  static SHOVEL = { scale: 0.62, y: 0.0, rx: 0.75 };
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ'; // yaw, then pitch with the swell
    this.body = new THREE.Group(); // avatar holder (sits inside boat when rowing)
    this.root.add(this.body);
    scene.add(this.root);
    this.line = new FishingLine();
    scene.add(this.line.line);
    this.bobberObj = null;
    this.boatObj = null;
    this.lookKey = '';
    this.gearKey = '';
    this.held = null;
    this.heldTimer = 0;
    this.pose = 'idle';
    this.mode = 'shore';
    this.yaw = 0;
  }

  setLook(avatarCfg, equipped = {}) {
    this.lastLook = [avatarCfg, equipped];
    const key = JSON.stringify(avatarCfg || {});
    if (key !== this.lookKey) {
      if (this.avatar) { this.body.remove(this.avatar.group); this.avatar.dispose?.(); }
      this.avatar = buildAvatar(avatarCfg);
      this.body.add(this.avatar.group);
      // a little lantern on the belt, lit after dark
      if (!this.lantern) { this.lantern = makeLantern(); this.scene.add(this.lantern.userData.pool); }
      this.avatar.group.add(this.lantern);
      // clipped to the belt on the front right hip, clear of the body
      this.lantern.position.set(-0.17, (this.avatar.hip || 0.32) + 0.03, 0.235);
      this.rodPlace = null;
      this.lookKey = key;
      this.gearKey = ''; // re-attach rod
    }
    const gkey = `${equipped.rod}|${equipped.lure}|${equipped.boat}|${gearReady()}`; // rebuilt once the detailed models arrive
    if (gkey !== this.gearKey) {
      if (this.rod) this.rod.parent?.remove(this.rod);
      this.rod = buildRod(equipped.rod);
      this.rodPlace = null;
      this.placeRod(this.wantRod || 'hand');
      if (this.bobberObj) this.scene.remove(this.bobberObj);
      this.bobberObj = buildBobber(equipped.lure);
      this.bobberObj.visible = false;
      this.scene.add(this.bobberObj);
      if (this.boatObj) this.root.remove(this.boatObj);
      this.boatObj = buildBoat(equipped.boat);
      this.boatObj.visible = this.mode === 'boat';
      this.root.add(this.boatObj);
      this.gearKey = gkey;
      this.equipped = { ...equipped };
    }
  }

  /** k: 0 day .. 1 night. Shows the lantern and its ground glow. */
  setNightGlow(k, flick = 1) {
    if (!this.lantern) return;
    const u = this.lantern.userData;
    this.lantern.visible = k > 0.02 && this.root.visible;
    u.glass.color.setRGB(1, 0.85 + 0.1 * k, 0.6 + 0.1 * k);
    u.halo.material.opacity = 0.68 * k * flick;
    u.pool.visible = this.lantern.visible;
    if (u.pool.visible) {
      const p = this.lanternWorld();
      u.pool.position.set(p.x, (this.mode === 'boat' ? WATER_Y : this.root.position.y) + 0.06, p.z);
      u.pool.material.opacity = 0.44 * k * flick;
    }
  }
  lanternWorld(out = new THREE.Vector3()) { return this.lantern ? this.lantern.getWorldPosition(out) : this.root.getWorldPosition(out); }

  // 'hand' (walking/fishing) or 'back' (stowed, emoting, rowing, holding a fish up)
  placeRod(where) {
    this.wantRod = where;
    if (!this.rod || !this.avatar || this.rodPlace === where) return;
    const socket = where === 'back' && this.avatar.rodBack ? this.avatar.rodBack : this.avatar.rodHand;
    this.rod.parent?.remove(this.rod);
    socket.add(this.rod);
    this.rod.rotation.set(where === 'back' ? 0 : Math.PI / 2, 0, 0); // in hand it points forward when the arm is raised
    this.rodPlace = where;
  }

  // v1.8.1: a shovel in both hands while digging for treasure
  showShovel(on) {
    if (!this.avatar?.rodHand) return;
    if (on && !this.shovel) {
      this.shovel = buildShovel();
      this.shovel.scale.setScalar(Actor.SHOVEL.scale);
      this.shovel.position.set(0, Actor.SHOVEL.y, 0);
      this.shovel.rotation.set(Actor.SHOVEL.rx, 0, 0);
    }
    if (!this.shovel) return;
    if (on && this.shovel.parent !== this.avatar.rodHand) this.avatar.rodHand.add(this.shovel);
    this.shovel.visible = on;
  }

  setMode(mode) {
    this.mode = mode;
    if (this.boatObj) this.boatObj.visible = mode === 'boat';
  }

  rodTip(out = new THREE.Vector3()) {
    if (!this.rod) return out.copy(this.root.position);
    this.rod.updateWorldMatrix(true, false);
    return this.rod.userData.tip.getWorldPosition(out);
  }

  showHeld(speciesId, variant, weight, seconds = 3) {
    this.clearHeld();
    if (!speciesId) return;
    this.held = buildFish(speciesId, variant, weight);
    this.held.rotation.set(0, Math.PI / 2, 0);
    this.scene.add(this.held);
    this.heldTimer = seconds;
  }
  clearHeld() { if (this.held) { this.scene.remove(this.held); this.held = null; } }

  /**
   * s: { x, y, z, yaw, mode, pose, moving, bobber: {x,z,dunk}|null, tension }
   */
  update(dt, t, s) {
    if (!this.avatar) return;
    // the detailed rod and lure models load in the background: swap them in the moment they're ready
    if (!this.gearSwapped && gearReady() && this.lastLook) { this.gearSwapped = true; this.setLook(...this.lastLook); }
    if (s.mode !== this.mode) this.setMode(s.mode);
    this.root.position.set(s.x, s.y, s.z);
    this.root.rotation.y = s.yaw;
    let pose = s.pose || 'idle';
    if (this.mode === 'boat') {
      const bob = Math.sin(t * 1.4 + s.x) * 0.04;
      const sw = waveAt(s.x, s.z);
      this.root.position.y = WATER_Y - 0.1 + bob + sw;
      // pitch and roll with the swell
      this.root.rotation.x = -(waveAt(s.x + Math.sin(s.yaw) * 0.8, s.z + Math.cos(s.yaw) * 0.8) - sw) * 0.5;
      this.root.rotation.z = Math.sin(t * 1.1) * 0.025;
      if (this.boatObj) this.boatObj.visible = !s.passenger;
      // a passenger rides in a friend's boat: same seat height, no boat or oars of their own
      this.body.position.set(0, this.boatObj.userData.seatY + 0.03 - (this.avatar.hip || 0.32), s.passenger ? 0 : -0.33); // hips on a thwart
      if (!s.passenger) animateOars(this.boatObj, t, s.moving);
      // in the boat, idle hands rest on the oars; moving, they row (passengers just sit)
      if (pose === 'idle' && !s.passenger) pose = s.moving ? 'row' : 'oars';
    } else {
      this.root.rotation.z = 0; this.root.rotation.x = 0;
      // in a chair: seated the way the boat seat works, with thighs level on the seat (their underside resting
      // on it), lower legs hanging, and the hips back against the backrest. The chair keeps its facing and
      // only the upper body turns toward the cast.
      const hip = this.avatar.hip || 0.32;
      this.body.position.set(0, s.seat ? s.seat - hip + (this.avatar.legHalf || 0.12) : 0, s.seat ? -0.07 : 0);
      this.chairBend = s.seat ? -Math.PI / 2 + 0.12 : 0;
      if (s.seat && s.seatYaw != null) {
        this.root.rotation.y = s.seatYaw;
        const d = s.yaw - s.seatYaw;
        this.twist = Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(d), Math.cos(d))));
      } else this.twist = 0;
      if (s.moving && pose === 'idle' && !s.seat) pose = s.running ? 'run' : 'walk';
      // v1.9: on a bike: sat on the saddle, feet on the pedals, hands on the bars, leaning into turns
      if (s.bike?.id) {
        if (this.bikeId !== s.bike.id) {
          if (this.bikeObj) this.root.remove(this.bikeObj);
          this.bikeObj = buildBike(s.bike.id);
          this.bikeId = s.bike.id;
          if (this.bikeObj) { this.bikeObj.scale.setScalar(BIKE_SCALE); this.bikeObj.rotation.y = -Math.PI / 2; this.root.add(this.bikeObj); }
        }
        if (this.bikeObj) { this.bikeObj.visible = true; poseBike(this.bikeObj, -(s.bike.steer || 0), s.bike.wheel || 0, s.bike.crank || 0); }
        this.body.position.set(0, BIKE_SEAT.y - (this.avatar.hip || 0.32), BIKE_SEAT.z);
        this.root.rotation.z = s.bike.lean || 0;
        pose = 'bike';
      } else if (this.bikeObj) this.bikeObj.visible = false;
    }
    if (this.held && pose === 'idle') pose = 'hold';
    const busyHands = ['wave', 'cheer', 'shrug', 'clap', 'dance', 'orange', 'run', 'sleep', 'hold', 'row', 'oars', 'dig', 'bike', 'yell', 'cry', 'roast', 'eat'].includes(pose);
    this.placeRod(s.rod === 'back' || busyHands ? 'back' : 'hand');
    this.showShovel(pose === 'dig');
    if (pose === 'dig' && this.pose !== 'dig') this.digT0 = t; // start each dig on the first stroke
    animateAvatar(this.avatar, pose, pose === 'dig' ? t - (this.digT0 || 0) : t, { power: s.power, k: s.castK, sitting: this.mode === 'boat' || !!s.seat, chair: s.seat && this.mode !== 'boat' ? this.chairBend : 0, crank: s.bike?.crank || 0, back: s.bike?.back || 0, steer: s.bike?.steer || 0 });
    // keep a hand-held rod pointing straight out even when the arm angles in for a two-handed grip
    if (this.avatar.rodHand) {
      const fishing = ['charge', 'cast', 'wait', 'reel', 'bite'].includes(pose);
      const k = (this.rodLean = (this.rodLean || 0) + ((fishing ? 1 : 0) - (this.rodLean || 0)) * Math.min(1, dt * 8));
      this.avatar.rodHand.rotation.set(Actor.ROD_TILT.x * k, Actor.ROD_TILT.y * k, -this.avatar.parts.armR.rotation.z);
    }
    // Tug & Turn: lean and swing the rod against the fish
    const lean = pose === 'reel' ? (s.lean || 0) : 0;
    this.lean = (this.lean || 0) + (lean - (this.lean || 0)) * Math.min(1, dt * 10);
    const sittingDown = this.mode === 'boat' || !!s.seat;
    if (s.seat && this.mode !== 'boat') {
      // seated: the legs stay with the chair, the torso, arms and head twist toward the water
      this.avatar.group.rotation.set(0, 0, 0);
      this.avatar.parts.body.rotation.y += (this.twist || 0) - this.lean * 0.4;
    } else {
      this.avatar.group.rotation.y = -this.lean * 0.55;
      this.avatar.group.rotation.z = -this.lean * 0.08;
    }
    // running bounces a little on each stride
    this.avatar.group.position.y = pose === 'run' ? Math.abs(Math.sin(t * 13)) * 0.035 : 0;
    // a skirt or dress drapes over the seat instead of hanging through it
    if (this.avatar.parts.skirt) this.avatar.parts.skirt.scale.y = sittingDown ? 0.32 : 1;
    this.pose = pose;

    // Bobber + line
    if (s.bobber) {
      this.bobberObj.visible = true;
      const dunk = s.bobber.dunk || 0;
      const y = s.bobber.y ?? (WATER_Y + waveAt(s.bobber.x, s.bobber.z) + Math.sin(t * 2.4) * 0.03 - dunk * 0.18);
      this.bobberObj.position.set(s.bobber.x, y, s.bobber.z);
      this.bobberObj.rotation.y = t * 0.2;
      this.rodTip(tmpV);
      this.line.line.visible = true;
      this.line.update(tmpV, this.bobberObj.position, s.bobber.flying ? 0.1 : 0.5, Math.min(1, s.tension || 0));
      this.line.setTension(pose === 'reel' ? s.tension || 0 : -1);
    } else {
      this.bobberObj.visible = false;
      this.line.line.visible = false;
    }

    // Held fish over the head
    if (this.held) {
      this.heldTimer -= dt;
      const h = this.avatar.height + (this.mode === 'boat' ? 0.3 : 0) + 0.25;
      this.held.position.set(s.x, this.root.position.y + h, s.z);
      // broadside to the camera, so the whole fish shows (nose along +X in the model)
      const cam = Actor.camera?.position;
      this.held.rotation.y = cam ? Math.atan2(cam.x - s.x, cam.z - s.z) : s.yaw;
      this.held.rotation.z = Math.sin(t * 6) * 0.15;
      if (this.heldTimer <= 0) this.clearHeld();
    }
  }

  headWorld(out = new THREE.Vector3()) {
    out.copy(this.root.position);
    out.y += (this.avatar?.height || 2) + (this.mode === 'boat' ? 0.4 : 0) + 0.25;
    return out;
  }

  dispose() {
    if (this.lantern) this.scene.remove(this.lantern.userData.pool);
    this.avatar?.dispose?.();
    this.scene.remove(this.root);
    this.scene.remove(this.line.line);
    if (this.bobberObj) this.scene.remove(this.bobberObj);
    this.clearHeld();
  }
}
