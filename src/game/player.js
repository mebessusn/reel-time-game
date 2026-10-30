// Local player controller: walking, rowing, facing, AFK.
import * as THREE from 'three';
import { groundY, walkY, surfaceY, boatable, deckHit, onBridge, railBlocks, SPAWN, HALF, onDock, WATER_Y, DOCK, COVE_LAUNCH, WADE_DEPTH, zoneAt, isWater, FAR_X, inValley } from '../world/terrain.js';
import { blocked, solidTopAt, STEP } from '../world/colliders.js';

const WALK = 3.6, ROW = 3.0, SPRINT = 1.35, SWIM = 2.0;
// v1.13.11: rowing the waterways between lakes is 50% faster, so travelling by boat doesn't drag
export const RIVER_ROW = 1.5;
const JUMP_V = 6.5, GRAVITY = 22; // a ~1 block hop that lasts about 0.6 s

export class Player {
  constructor() {
    this.pos = new THREE.Vector3(SPAWN.x, groundY(SPAWN.x, SPAWN.z) ?? 1.5, SPAWN.z);
    this.yaw = Math.PI; // facing north (-z)
    this.mode = 'shore';
    this.target = null;
    this.keys = new Set();
    this.moving = false;
    this.lastInput = performance.now();
    this.dir = new THREE.Vector3();
    this.sprint = false;
    this.baseY = this.pos.y; // ground height under the player, smoothed
    this.air = 0; // height above the ground while jumping
    this.vy = 0;
    this.stick = null; // controller left stick { x, y }
    this.rowMult = 1; // boat hull upgrades
    this.keymap = null; // set by the game: action names for keys
  }

  // Is a movement action held? Keys are stored lowercase; the keymap maps them to actions.
  held(action) {
    if (action === 'up' && this.mouseWalk) return true; // both mouse buttons held: walk forward
    for (const k of this.keys) if ((this.keymap ? this.keymap.action(k) : null) === action) return true;
    const fallback = { up: ['w', 'arrowup'], down: ['s', 'arrowdown'], left: ['a', 'arrowleft'], right: ['d', 'arrowright'] }[action];
    return !this.keymap && fallback.some((k) => this.keys.has(k));
  }

  get airborne() { return this.air > 0 || this.vy > 0; }

  jump() {
    if (this.mode !== 'shore' || this.airborne) return false; // (no jumping while swimming)
    this.vy = JUMP_V;
    this.touch();
    return true;
  }

  touch() { this.lastInput = performance.now(); }
  get afk() { return performance.now() - this.lastInput > 180000; }

  canStand(x, z) {
    if (!inValley(x)) { // v1.15 Open Waters: the deck, or an island (and Frostmere's ice and snow)
      const ok = this.mode === 'shore' && walkY(x, z, WADE_DEPTH) != null;
      if (!ok && this.mode === 'shore') this.onFarEdge?.(x, z); // (v1.15.6: wading out past your depth starts you swimming)
      if (!ok) return false;
      // v1.15.8: the islands' huts, palms, rocks and furniture are solid (not on a deck or a jetty; and if you're
      // somehow inside one already, any step is allowed so you can walk out)
      if (!onDock(x, z) && blocked(x, z, 0.28, 'shore', this.pos.y) && !blocked(this.pos.x, this.pos.z, 0.28, 'shore', this.pos.y)) return false;
      return true;
    }
    if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2) return false;
    if (this.mode === 'boat') {
      if (!boatable(x, z) || blocked(x, z, 0.8, 'boat')) return false;
      // can't row through a dock or jetty (if somehow already inside one, any move out of it is allowed)
      return !deckHit(x, z) || deckHit(this.pos.x, this.pos.z);
    }
    // v1.14.11: swimming. In the water you swim anywhere that's water (under bridges too, round rocks and pilings),
    // and climb out wherever it's shallow enough to stand
    if (this.mode === 'swim') {
      if (!onBridge(x, z) && walkY(x, z, WADE_DEPTH) != null) return !blocked(x, z, 0.28, 'shore', null);
      return this.swimmable(x, z);
    }
    if (railBlocks(this.pos.x, this.pos.z, x, z)) return false; // (v1.14.11: bridge railings: on and off only at the ends; swimmers pass under)
    // walking out past your depth (keys or stick, not a click: a click walks you to the water's edge) starts a swim
    if (this.mode === 'shore' && !this.target && !this.noSwim && walkY(x, z, WADE_DEPTH) == null && this.swimmable(x, z) && !blocked(x, z, 0.28, 'shore', this.pos.y)) return true;
    // (on a bridge deck nothing on the ground underneath can get in the way)
    if (onBridge(x, z) && walkY(x, z, WADE_DEPTH) != null) return true;
    if (walkY(x, z, WADE_DEPTH) != null && !blocked(x, z, 0.28, 'shore', this.mode === 'shore' ? this.pos.y : null)) return true;
    // Fail-safe: if you are somewhere you couldn't normally stand (dropped off a boat, pushed by a
    // collider change), any step that isn't deeper water is allowed, so you can always walk out.
    if (!this.standable(this.pos.x, this.pos.z)) {
      const here = surfaceY(this.pos.x, this.pos.z) ?? -99, there = surfaceY(x, z);
      return there != null && there >= here - 0.02 && there < 15;
    }
    return false;
  }

  /** Open water deeper than wading, not under a bridge deck you'd be walking on, clear of rocks. */
  swimmable(x, z) { return isWater(x, z) && surfaceY(x, z) < WATER_Y - WADE_DEPTH + 0.02 && !blocked(x, z, 0.35, 'boat'); }

  standable(x, z) { return walkY(x, z, WADE_DEPTH) != null && !blocked(x, z, 0.28, 'shore'); }

  /** How deep the water is where you stand (0 on dry land). */
  get wadeDepth() {
    if (this.mode !== 'shore') return 0;
    const s = surfaceY(this.pos.x, this.pos.z);
    return s == null ? 0 : Math.max(0, WATER_Y - s);
  }

  setTarget(x, z) {
    this.target = new THREE.Vector3(x, 0, z);
    this.touch();
  }

  faceToward(x, z) {
    this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  launchBoat(at = COVE_LAUNCH) {
    this.mode = 'boat';
    this.pos.set(at.x, WATER_Y, at.z);
    this.yaw = Math.PI;
    this.target = null;
    this.air = 0; this.vy = 0;
  }

  // Back to shore: nearest walkable point toward the dock area.
  disembark() {
    const tryPts = [];
    for (let r = 1; r < 14; r++) for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      tryPts.push([this.pos.x + Math.cos(ang) * r, this.pos.z + Math.sin(ang) * r]);
    }
    // v1.8.1: land where you can actually walk (the old check used the block map, which could drop you
    // onto a steep or too-deep spot and freeze you). Prefer dry land with room to move; fall back to
    // the shallows.
    const ok = (x, z, wade) => {
      if (walkY(x, z, wade) == null || blocked(x, z, 0.3, 'shore')) return false;
      let n = 0;
      for (let a = 0; a < 8; a++) { const t = (a / 8) * Math.PI * 2; if (walkY(x + Math.cos(t) * 0.8, z + Math.sin(t) * 0.8, WADE_DEPTH) != null) n++; }
      return n >= 4;
    };
    for (const wade of [0, WADE_DEPTH]) {
      for (const [x, z] of tryPts) {
        if (!ok(x, z, wade)) continue;
        const g = walkY(x, z, WADE_DEPTH);
        this.mode = 'shore'; this.pos.set(x, g, z); this.baseY = g; this.air = 0; this.vy = 0; this.target = null;
        return true;
      }
    }
    return false;
  }

  nearShore() {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      if (walkY(this.pos.x + Math.cos(ang) * 2.2, this.pos.z + Math.sin(ang) * 2.2, WADE_DEPTH) != null) return true;
    }
    return false;
  }

  update(dt, camYaw, locked) {
    const wade = this.wadeDepth;
    // in a waterway the boat picks up speed, eased in and out over about half a second
    const inRiver = this.mode === 'boat' && zoneAt(this.pos.x, this.pos.z) === 'river';
    this.riverK = (this.riverK || 0) + ((inRiver ? 1 : 0) - (this.riverK || 0)) * Math.min(1, dt * 4);
    const speed = (this.mode === 'boat' ? ROW * this.rowMult * (1 + (RIVER_ROW - 1) * this.riverK) : this.mode === 'swim' && inValley(this.pos.x) ? SWIM : WALK * (wade > 0.15 ? 0.6 : 1)) * (this.sprint ? SPRINT : 1) * (this.speedMult ?? 1); // (speedMult: Frostmere's cold and snow)
    let mx = 0, mz = 0;
    if (!locked) {
      let f = (this.held('up') ? 1 : 0) - (this.held('down') ? 1 : 0);
      let r = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
      if (this.stick) { f = -this.stick.y; r = this.stick.x; }
      if (f || r) {
        this.target = null;
        // camera-relative: camera looks toward -(sin yaw, cos yaw)
        const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
        mx = fx * f - fz * r; mz = fz * f + fx * r;
        this.touch();
      } else if (this.target) {
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.15) this.target = null;
        else { mx = dx / d; mz = dz / d; }
      }
    }
    const len = Math.hypot(mx, mz);
    this.moving = false;
    if (this.skating && this.mode === 'shore') this.skateStep(dt, mx, mz, len); // Frostmere: skates on the ice
    else if (len > 0) {
      mx /= len; mz /= len;
      const step = Math.min(speed * dt, this.target ? this.target.distanceTo(new THREE.Vector3(this.pos.x, 0, this.pos.z)) : 99);
      let nx = this.pos.x + mx * step, nz = this.pos.z + mz * step;
      if (this.canStand(nx, nz)) { this.pos.x = nx; this.pos.z = nz; this.moving = true; }
      else if (this.canStand(nx, this.pos.z)) { this.pos.x = nx; this.moving = true; }
      else if (this.canStand(this.pos.x, nz)) { this.pos.z = nz; this.moving = true; }
      else this.target = null;
      const targetYaw = Math.atan2(mx, mz);
      let d = targetYaw - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 10);
      this.dir.set(mx, 0, mz);
    }
    // into the water and out again
    // (the valley only: Open Waters' diving runs its own swim, out past FAR_X)
    if (!inValley(this.pos.x)) { /* */ } else if (this.mode === 'shore' && !this.airborne && walkY(this.pos.x, this.pos.z, WADE_DEPTH) == null && this.swimmable(this.pos.x, this.pos.z)) { this.mode = 'swim'; this.target = null; this.onSwim?.(true); }
    else if (this.mode === 'swim' && !onBridge(this.pos.x, this.pos.z) && walkY(this.pos.x, this.pos.z, WADE_DEPTH) != null) {
      this.mode = 'shore'; this.baseY = walkY(this.pos.x, this.pos.z, WADE_DEPTH); this.air = 0; this.vy = 0; this.onSwim?.(false);
    }
    if (this.mode === 'shore') {
      let g = walkY(this.pos.x, this.pos.z, WADE_DEPTH) ?? surfaceY(this.pos.x, this.pos.z);
      // standing on a boulder: once your feet are up at its top you stay on it until you step off
      const top = solidTopAt(this.pos.x, this.pos.z);
      if (top != null && g != null && top > g && this.pos.y >= top - STEP) {
        g = top;
        // mid-jump: re-base on the rock without changing your height in the air, so you land on top
        if (this.airborne && this.baseY < top) { const y = this.pos.y; this.baseY = top; this.air = Math.max(0, y - top); if (!this.air && this.vy < 0) this.vy = 0; }
      }
      if (g != null) this.baseY += (g - this.baseY) * (onDock(this.pos.x, this.pos.z) ? 1 : Math.min(1, dt * 14)); // (v1.15.23: on a deck, feet stay on the planks as a boat heaves)
      if (this.airborne) {
        this.air += this.vy * dt;
        this.vy -= GRAVITY * dt;
        if (this.air <= 0) { this.air = 0; this.vy = 0; }
      }
      this.pos.y = this.baseY + this.air;
    } else { this.pos.y = WATER_Y; this.baseY = WATER_Y; this.air = 0; this.vy = 0; }
  }

  /** Frostmere: skating. Momentum and long curving turns; pull back hard against your glide for a hockey stop. */
  skateStep(dt, mx, mz, len) {
    const v = this.skateV || (this.skateV = new THREE.Vector3());
    const max = this.sprint ? 12.5 : 9, sp0 = Math.hypot(v.x, v.z);
    this.hockeyStop = false;
    if (len > 0) {
      mx /= len; mz /= len;
      const dot = sp0 > 0.1 ? (v.x * mx + v.z * mz) / sp0 : 1;
      if (dot < -0.55 && sp0 > 3) { v.multiplyScalar(Math.max(0, 1 - dt * 5)); this.hockeyStop = true; } // the stop: blades sideways, ice spraying
      else {
        v.x += mx * dt * (this.sprint ? 9 : 6.5); v.z += mz * dt * (this.sprint ? 9 : 6.5);
        // carving: the glide swings round toward where you steer
        const sp = Math.hypot(v.x, v.z);
        if (sp > 0.5) { const k = Math.min(1, dt * 2.2); v.x += (mx * sp - v.x) * k; v.z += (mz * sp - v.z) * k; }
      }
    }
    v.multiplyScalar(Math.max(0, 1 - dt * (len > 0 ? 0.25 : 0.55))); // the ice barely slows you
    const sp = Math.hypot(v.x, v.z);
    if (sp > max) v.multiplyScalar(max / sp);
    if (sp < 0.05 && len === 0) { v.set(0, 0, 0); return; } // (only when you've let go: at 144 Hz one frame's push is under 0.05, and zeroing it froze you in place)
    const nx = this.pos.x + v.x * dt, nz = this.pos.z + v.z * dt;
    if (this.canStand(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
    else if (this.canStand(nx, this.pos.z)) { this.pos.x = nx; v.z *= -0.3; }
    else if (this.canStand(this.pos.x, nz)) { this.pos.z = nz; v.x *= -0.3; }
    else { v.multiplyScalar(-0.25); this.bumped = true; }
    this.moving = sp > 0.4; this.pushing = len > 0 && !this.hockeyStop;
    const targetYaw = Math.atan2(v.x, v.z);
    let d = targetYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 6);
    this.dir.set(v.x / Math.max(sp, 1e-3), 0, v.z / Math.max(sp, 1e-3));
    if (this.target && Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z) < 1.2) this.target = null; // (click-to-move: coast in)
  }

  get onDock() { return onDock(this.pos.x, this.pos.z); }
  nearDockEnd() { return this.onDock && this.pos.z < DOCK.z0 + 4; }
}
