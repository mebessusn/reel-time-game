// An angler in the world: avatar + rod + bobber + line + optional rowboat. Used for you and for remote players.
import * as THREE from 'three';
import { buildShovel } from '../entities/treasureModels.js';
import { buildBike, poseBike, BIKE_SCALE, BIKE_SEAT } from '../entities/bikeModels.js';
import { makeLantern } from './nightlights.js';
import { buildAvatar, animateAvatar } from '../entities/avatar2.js';
import { buildRod, buildBobber, buildBoat, FishingLine, animateOars } from '../entities/gear.js';
import { gearReady } from '../entities/gearModels.js';
import { buildFish } from '../entities/fish.js';
import { WATER_Y, inValley } from '../world/terrain.js';
import { waveAt } from '../world/water.js';

const tmpV = new THREE.Vector3();

/** The sole of the boot in the leg's own space (avatar2's leg: LH long, the shoe's sole just under it, 4 cm forward,
 *  0.31 long), worked out from the avatar's hip height and leg depth since the leg's parts are merged into one mesh. */
export function legSole(avatar) {
  const SC = (avatar.legHalf || 0.12) / 0.115, LH = (avatar.hip || 0.32) / SC;
  return { y: -LH - 0.01, z: 0.04, len: 0.31, sc: SC };
}

/** What another map puts on the figure (addActorLook): each look is { busy: [poses that need both hands], reset(actor) (a new avatar), pose(actor, s, pose) -> pose, swim(actor, s, dt) -> pose
 *  (it has the swim), lift(s) -> metres (up on blades), gear(actor, s) (what it wears this frame) }, all optional. */
const LOOKS = [];
/** Poses that need both hands (the rod goes on your back): another map adds its own with addActorLook({ busy: [...] }). */
const BUSY_HANDS = new Set();
export function addActorLook(look) { LOOKS.push(look); for (const p of look.busy || []) BUSY_HANDS.add(p); }

export class Actor {
  static camera = null; // set by the game so held fish can turn to face it
  // While fishing, the rod leans forward over the water and out to the casting side, clear of big hat brims.
  static ROD_TILT = { x: 0.45, y: 0.45 };
  static SHOVEL = { scale: 0.62, y: 0.0, rx: 0.75 };
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); this.root.name = 'actor'; // (v1.17.12: people, so the collision sweep knows them)
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
      for (const L of LOOKS) L.reset?.(this); // (another map's gear hangs off the old avatar's parts: rebuild it)
    }
    const gkey = `${equipped.rod}|${equipped.lure}|${equipped.boat}|${gearReady()}`; // rebuilt once the detailed models arrive
    if (gkey !== this.gearKey) {
      this.freeRodBend();
      if (this.rod) this.rod.parent?.remove(this.rod);
      this.rod = buildRod(equipped.rod, this.lite); // (lite: villagers' rods are one draw call)
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
  /** v1.14.10: a little instant camera in your hands (the Field Guide's photo pose). Its lens faces the way the hand
   *  points (the hand's -y), so with the arm raised it looks where you look. */
  showCamera(on) {
    if (!this.avatar?.rodHand) return;
    if (on && !this.camProp) {
      const g = new THREE.Group(), M = (c, e) => new THREE.MeshLambertMaterial({ color: c, emissive: e || '#000000' });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.15), M('#f2ece0')); g.add(body);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.202, 0.03, 0.03), M('#e8603a')); stripe.position.set(0, -0.046, 0.03); g.add(stripe);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 12), M('#2a2e34')); lens.position.set(0.02, -0.065, 0); g.add(lens);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 12), M('#6ab0d8', '#204060')); glass.position.set(0.02, -0.092, 0); g.add(glass);
      const flash = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.03), M('#f8f8ff', '#808080')); flash.position.set(-0.06, -0.046, -0.045); g.add(flash);
      g.position.set(-0.05, -0.02, 0.02);
      this.camProp = g;
    }
    if (!this.camProp) return;
    if (on && this.camProp.parent !== this.avatar.rodHand) this.avatar.rodHand.add(this.camProp);
    this.camProp.visible = on;
  }

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

  /** Bend the rod toward the line under tension (k: 0 straight .. 1 doubled over; toward: the bobber, in the world).
   *  The rod's parts get their own copy of the geometry the first time (the models share theirs), and its vertices
   *  are curved along its length from just above the grip; the tip (where the line ties on) moves with them. */
  bendRod(dt, k, toward) {
    const rod = this.rod;
    if (!rod?.userData.tip || this.lite) return;
    let B = this.rodBend;
    if (!B || B.rod !== rod) {
      if (!(k > 0.01)) return; // never bent: nothing to do (most rods never are)
      this.freeRodBend();
      rod.updateWorldMatrix(true, true);
      const inv = new THREE.Matrix4().copy(rod.matrixWorld).invert(), parts = [];
      rod.traverse((o) => {
        if (!o.isMesh || !o.geometry?.attributes.position) return;
        const src = o.geometry.attributes.position, n = src.count, base = new Float32Array(n * 3);
        const to = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), from = to.clone().invert();
        for (let i = 0; i < n; i++) { tmpV.fromBufferAttribute(src, i).applyMatrix4(to); base[i * 3] = tmpV.x; base[i * 3 + 1] = tmpV.y; base[i * 3 + 2] = tmpV.z; } // (in the rod's own space)
        const shared = o.geometry, geo = shared.clone();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); // (the models' positions are packed integers: bend in floats)
        o.geometry = geo;
        parts.push({ o, shared, geo, base, from });
      });
      B = this.rodBend = { rod, parts, k: 0, shown: -1, dx: 0, dz: 1, len: rod.userData.tip.position.y, tipY: rod.userData.tip.position.y };
    }
    B.k += (Math.max(0, Math.min(1, k)) - B.k) * Math.min(1, dt * 12);
    if (toward && B.k > 0.005) { // which way is "toward the fish", across the rod
      rod.updateWorldMatrix(true, false);
      tmpV.copy(toward); rod.worldToLocal(tmpV);
      const l = Math.hypot(tmpV.x, tmpV.z);
      if (l > 1e-4) { B.dx += (tmpV.x / l - B.dx) * Math.min(1, dt * 8); B.dz += (tmpV.z / l - B.dz) * Math.min(1, dt * 8); }
    }
    if (B.k < 0.004) B.k = 0;
    if (Math.abs(B.k - B.shown) < 0.004 && B.k !== 0) return;
    if (B.k === 0 && B.shown === 0) return;
    B.shown = B.k;
    const L = B.len, y0 = L * 0.22, span = L - y0, bow = B.k * 0.3 * L; // the tip swings up to 30% of the rod's length
    for (const p of B.parts) {
      const arr = p.geo.attributes.position.array, base = p.base;
      for (let i = 0; i < base.length; i += 3) {
        const u = Math.max(0, (base[i + 1] - y0) / span), d = bow * u * u;
        tmpV.set(base[i] + B.dx * d, base[i + 1] - (2 / 3) * bow * bow * u * u * u / span, base[i + 2] + B.dz * d).applyMatrix4(p.from); // (the curve keeps its length: the tip drops a little)
        arr[i] = tmpV.x; arr[i + 1] = tmpV.y; arr[i + 2] = tmpV.z;
      }
      p.geo.attributes.position.needsUpdate = true;
    }
    rod.userData.tip.position.set(B.dx * bow, B.tipY - (2 / 3) * bow * bow / span, B.dz * bow);
  }
  /** Give a bent rod its shared geometry back (before it is rebuilt or thrown away). */
  freeRodBend() {
    const B = this.rodBend;
    if (!B) return;
    for (const p of B.parts) { p.o.geometry = p.shared; p.geo.dispose(); }
    B.rod.userData.tip?.position.set(0, B.tipY, 0);
    this.rodBend = null;
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
      this.body.position.set(0, s.seat ? s.seat - hip + (this.avatar.legHalf || 0.12) : LOOKS.reduce((h, L) => Math.max(h, L.lift?.(s) || 0), 0), s.seat ? -0.07 : 0); // (another map's lift: up on blades)
      this.chairBend = s.seat ? -Math.PI / 2 + 0.12 : 0;
      if (s.seat && s.seatYaw != null) {
        this.root.rotation.y = s.seatYaw;
        const d = s.yaw - s.seatYaw;
        this.twist = Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(d), Math.cos(d))));
      } else this.twist = 0;
      if (s.shiver) this.body.position.x += Math.sin(t * 52) * 0.016 * s.shiver; // (shivering with cold)
      if (s.tilt) { this.root.rotation.order = 'YXZ'; this.root.rotation.x = s.tilt[0]; this.root.rotation.z = s.tilt[1]; this.tilted = true; } else if (this.tilted) { this.root.rotation.x = 0; this.root.rotation.z = 0; this.tilted = false; } // (the rider tips with the machine)
      if (s.moving && pose === 'idle' && !s.seat) pose = s.running ? 'run' : 'walk';
      for (const L of LOOKS) pose = L.pose?.(this, s, pose) ?? pose; // (another map's: on skates, on a sled)
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
      const swum = LOOKS.reduce((q, L) => q || L.swim?.(this, s, dt) || null, null); // (another map's own swimming)
      if (swum) pose = swum;
      else if (this.mode === 'swim' && inValley(s.x)) { // v1.14.11: swimming in the valley's lakes and rivers
        this.root.rotation.order = 'YXZ';
        const want = s.moving ? 0.55 : 0.25;
        this.swimTilt = (this.swimTilt ?? want) + (want - (this.swimTilt ?? want)) * Math.min(1, dt * 4);
        this.root.rotation.x = this.swimTilt;
        this.root.position.y = WATER_Y + waveAt(s.x, s.z) + Math.sin(t * 2.2 + s.x) * 0.03;
        this.body.position.set(0, -1.05, 0);
        pose = s.moving ? 'swim' : 'tread';
      } else if (this.root.rotation.order !== 'XYZ' && !s.tilt) { this.root.rotation.order = 'XYZ'; this.swimTilt = null; }
    }
    for (const L of LOOKS) L.gear?.(this, s); // (another map's gear)
    if (this.held && pose === 'idle') pose = 'hold';
    const busyHands = BUSY_HANDS.has(pose) || ['photo', 'swim', 'tread', 'wave', 'cheer', 'shrug', 'clap', 'dance', 'ride', 'orange', 'run', 'sleep', 'hold', 'row', 'oars', 'dig', 'bike', 'yell', 'cry', 'roast', 'eat', 'throw'].includes(pose);
    this.placeRod(s.rod === 'back' || busyHands ? 'back' : 'hand');
    this.showShovel(pose === 'dig');
    if (pose === 'photo' || this.camProp) this.showCamera(pose === 'photo');
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
      this.bendRod(dt, pose === 'reel' ? Math.pow(Math.min(1, s.tension || 0), 1.2) : 0, this.bobberObj.position); // the rod bows with the line's tension
      this.rodTip(tmpV);
      this.line.line.visible = true;
      this.line.update(tmpV, this.bobberObj.position, s.bobber.flying ? 0.1 : 0.5, Math.min(1, s.tension || 0));
      this.line.setTension(pose === 'reel' ? s.tension || 0 : -1);
    } else {
      this.bobberObj.visible = false;
      this.line.line.visible = false;
      if (this.rodBend) this.bendRod(dt, 0, null);
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
    this.freeRodBend();
    this.avatar?.dispose?.();
    this.scene.remove(this.root);
    this.scene.remove(this.line.line);
    if (this.bobberObj) this.scene.remove(this.bobberObj);
    this.clearHeld();
  }
}
