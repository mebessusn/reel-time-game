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
import { DIVEGEAR_MATS, DIVEGEAR_NODES } from '../data/diveGearMesh.js';
import { buildNode } from '../ocean/meshes.js';

const tmpV = new THREE.Vector3();

/** The sole of the boot in the leg's own space (avatar2's leg: LH long, the shoe's sole just under it, 4 cm forward,
 *  0.31 long), worked out from the avatar's hip height and leg depth since the leg's parts are merged into one mesh. */
function legSole(avatar) {
  const SC = (avatar.legHalf || 0.12) / 0.115, LH = (avatar.hip || 0.32) / SC;
  return { y: -LH - 0.01, z: 0.04, len: 0.31, sc: SC };
}

// v1.16.2: the skates' blades, built in the leg's own units: a steel runner with a rocker and a curled toe, two black
// stanchions and a sole plate. Shared per size; one steel and one holder material for everybody.
const BLADE_H = 0.1;
const BLADES = new Map();
let STEEL = null, HOLDER = null;
function makeBlade(len, hgt) {
  const key = `${len.toFixed(3)}|${hgt.toFixed(3)}`;
  let G = BLADES.get(key);
  if (!G) {
    const h2 = hgt, run = new THREE.Shape(), z0 = -len * 0.5, z1 = len * 0.5;
    // drawn in (z, y): the bottom rocks gently, the toe sweeps up in front of the boot
    run.moveTo(z0, -h2 * 0.78); run.quadraticCurveTo(0, -h2 * 1.04, z1 * 0.8, -h2 * 0.86);
    run.quadraticCurveTo(z1 * 1.12, -h2 * 0.7, z1 * 1.08, -h2 * 0.3); run.lineTo(z1 * 0.96, -h2 * 0.36);
    run.quadraticCurveTo(z1 * 0.96, -h2 * 0.6, z1 * 0.76, -h2 * 0.62); run.lineTo(z0, -h2 * 0.58); run.closePath();
    const t = 0.028, runner = new THREE.ExtrudeGeometry(run, { depth: t, bevelEnabled: false, curveSegments: 10 });
    runner.translate(0, 0, -t / 2); runner.rotateY(-Math.PI / 2); // (shape x -> the foot's +z, the toe forward)
    const plate = new THREE.BoxGeometry(0.09, h2 * 0.2, len * 0.86); plate.translate(0, -h2 * 0.1, 0);
    const st = [len * 0.3, -len * 0.32].map((z) => { const b = new THREE.BoxGeometry(0.05, h2 * 0.5, 0.09); b.translate(0, -h2 * 0.42, z); return b; });
    G = { runner, plate, st };
    BLADES.set(key, G);
  }
  STEEL ||= new THREE.MeshPhongMaterial({ color: '#aeb9c4', specular: '#ffffff', shininess: 120 });
  HOLDER ||= new THREE.MeshLambertMaterial({ color: '#1c2026' });
  const g = new THREE.Group(); g.name = 'skate-blade';
  g.add(new THREE.Mesh(G.runner, STEEL), new THREE.Mesh(G.plate, HOLDER), ...G.st.map((b) => new THREE.Mesh(b, HOLDER)));
  for (const m of g.children) m.castShadow = true;
  return g;
}

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
      this.diveKey = null; this.diveParts = null; // (the dive gear hangs off the old avatar's parts: rebuild it)
    }
    const gkey = `${equipped.rod}|${equipped.lure}|${equipped.boat}|${gearReady()}`; // rebuilt once the detailed models arrive
    if (gkey !== this.gearKey) {
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

  /**
   * v1.15.7 Open Waters: dive gear you can see, worn while swimming. dg: a string of what you have on:
   * m mask, t tank, f fins, p pole spear / b band speargun (in the right hand). '' takes it all off.
   */
  setDiveGear(dg = '') {
    if (dg === this.diveKey || !this.avatar) return;
    this.diveKey = dg;
    const A = this.avatar, P = A.parts;
    if (!this.diveParts) {
      const mk = (name, parent, setup) => { const o = buildNode(DIVEGEAR_MATS, DIVEGEAR_NODES, name, { shadow: false }); setup?.(o); parent.add(o); o.visible = false; return o; };
      const foot = () => { const b = legSole(A); return (o) => o.position.set(0, b.y, b.z); }; // (the sole of the shoe)
      this.diveParts = {
        m: mk('dive_mask', P.head),
        t: mk('dive_tank', P.body),
        fL: mk('dive_fin', P.legL, foot(P.legL)), fR: mk('dive_fin', P.legR, foot(P.legR)),
        p: mk('gun_pole', A.rodHand, (o) => o.rotation.set(Math.PI, 0, 0)), // (out along the arm, away from the shoulder)
        b: mk('gun_band', A.rodHand, (o) => o.rotation.set(Math.PI, 0, 0)),
      };
    }
    const D = this.diveParts;
    D.m.visible = dg.includes('m'); D.t.visible = dg.includes('t');
    D.fL.visible = D.fR.visible = dg.includes('f');
    D.p.visible = dg.includes('p'); D.b.visible = dg.includes('b');
    if (this.rod) this.rod.visible = !dg; // (the rod stays in the boat while you swim)
  }

  /** v1.16.2 Frostmere: ice skates you can see: a steel runner with a curved toe under each boot, on a black holder
   *  with two stanchions. Sized from the boot's own sole. */
  setBlades(on) {
    if (!this.avatar) return;
    if (!on && !this.blades) return;
    if (!this.blades || this.blades.avatar !== this.avatar) {
      const P = this.avatar.parts, B = [];
      for (const leg of [P.legL, P.legR]) {
        const b = legSole(this.avatar);
        const m = makeBlade(b.len * 1.05, BLADE_H / b.sc); m.position.set(0, b.y, b.z);
        leg.add(m); B.push(m);
      }
      this.blades = { avatar: this.avatar, parts: B };
    }
    for (const m of this.blades.parts) m.visible = on;
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
      this.body.position.set(0, s.seat ? s.seat - hip + (this.avatar.legHalf || 0.12) : s.blades && !s.sled ? BLADE_H : 0, s.seat ? -0.07 : 0); // (v1.16.2: up on your blades)
      this.chairBend = s.seat ? -Math.PI / 2 + 0.12 : 0;
      if (s.seat && s.seatYaw != null) {
        this.root.rotation.y = s.seatYaw;
        const d = s.yaw - s.seatYaw;
        this.twist = Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(d), Math.cos(d))));
      } else this.twist = 0;
      if (s.shiver) this.body.position.x += Math.sin(t * 52) * 0.016 * s.shiver; // (v1.17.2: freezing, up north)
      if (s.tilt) { this.root.rotation.order = 'YXZ'; this.root.rotation.x = s.tilt[0]; this.root.rotation.z = s.tilt[1]; this.tilted = true; } else if (this.tilted) { this.root.rotation.x = 0; this.root.rotation.z = 0; this.tilted = false; } // (the rider tips with the machine)
      if (s.moving && pose === 'idle' && !s.seat) pose = s.running ? 'run' : 'walk';
      if (s.skate && (pose === 'walk' || pose === 'run' || pose === 'idle')) pose = s.skate > 1 ? 'skate' : s.moving ? 'glide' : 'idle'; // Frostmere: on skates (2 pushing, 1 gliding)
      if (s.sled) pose = 'sled'; // Frostmere: driving a dog sled
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
      // v1.15 Open Waters: swimming. Treading water at the surface, lying out flat underwater
      if (s.swim) {
        this.root.rotation.order = 'YXZ';
        const want = s.swim === 2 ? 1.25 + Math.max(-0.5, Math.min(0.5, (s.swimPitch || 0) - 0.3)) : 0.25;
        this.swimTilt = (this.swimTilt ?? want) + (want - (this.swimTilt ?? want)) * Math.min(1, dt * 4);
        this.root.rotation.x = this.swimTilt;
        this.body.position.set(0, s.swim === 2 ? -0.35 : -1.05, 0);
        pose = s.moving || s.swim === 2 ? 'swim' : 'tread';
        if (/[pb]/.test(s.dg || '')) pose += 'gun'; // the speargun held out ahead
      } else if (this.mode === 'swim' && inValley(s.x)) { // v1.14.11: swimming in the valley's lakes and rivers
        this.root.rotation.order = 'YXZ';
        const want = s.moving ? 0.55 : 0.25;
        this.swimTilt = (this.swimTilt ?? want) + (want - (this.swimTilt ?? want)) * Math.min(1, dt * 4);
        this.root.rotation.x = this.swimTilt;
        this.root.position.y = WATER_Y + waveAt(s.x, s.z) + Math.sin(t * 2.2 + s.x) * 0.03;
        this.body.position.set(0, -1.05, 0);
        pose = s.moving ? 'swim' : 'tread';
      } else if (this.root.rotation.order !== 'XYZ') { this.root.rotation.order = 'XYZ'; this.swimTilt = null; }
    }
    this.setDiveGear(s.swim ? s.dg || '' : '');
    this.setBlades(!!s.blades && !s.swim && !s.sled);
    if (this.held && pose === 'idle') pose = 'hold';
    const busyHands = ['photo', 'swim', 'tread', 'swimgun', 'treadgun', 'wave', 'cheer', 'shrug', 'clap', 'dance', 'ride', 'orange', 'run', 'sleep', 'hold', 'row', 'oars', 'dig', 'bike', 'yell', 'cry', 'roast', 'eat', 'bump', 'tuck', 'throw', 'skate', 'glide', 'sled'].includes(pose);
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
