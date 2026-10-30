// Skye's Air Races: how a racing plane flies (yours, a rival's). The same feel as "Above the Clouds"
// (src/north/flight.js): bank to turn, the nose eases up and down, scaled by the plane's stats and the class, with a
// light energy model (dive for speed, climbing costs a little), the boost meter, launch and ring bursts, tricks.
import * as THREE from 'three';

export const LOOP_R = 26, LOOP_T = 2.5, ROLL_T = 0.85;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Flyer {
  /** S: the plane's stats (src/air/planes.js), cls: the class (src/air/circuits.js CLASSES). */
  constructor(S, cls, { pos, yaw }) {
    this.S = S; this.cls = cls;
    this.pos = pos.clone(); this.prev = pos.clone(); this.yaw = yaw; this.pitch = 0; this.bank = 0;
    this.base = S.speed * cls.speed; this.speed = this.base;
    this.meter = 0.35; this.burst = 0; this.dive = 0; this.boostK = 0; this.slowT = 0; this.speedMul = 1; this.skill = 1;
    this.tr = null; this.roll = 0; this.loopA = 0; this.throttle = 0.8;
  }
  get fwd() { return new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  /** A trick: 'roll' (dir -1 left, 1 right) or 'loop'. Returns false if one's already going. */
  trick(kind, dir = 1, ceil = Infinity) {
    if (this.tr) return false;
    if (kind === 'loop' && this.pos.y > ceil - LOOP_R * 2 - 4) return false;
    this.tr = { kind, dir, t: 0, dur: kind === 'loop' ? LOOP_T : ROLL_T / Math.min(1.5, this.S.trick), at: this.pos.clone(), yaw: this.yaw };
    return true;
  }
  /** One step. inp: { steer -1..1, climb -1..1, boost bool }. Returns the trick just finished, if any. */
  step(dt, inp) {
    const S = this.S;
    this.prev.copy(this.pos);
    let steer = inp.steer || 0, climb = inp.climb || 0;
    if (this.tr) { steer = 0; climb = 0; }
    this.bank += (steer - this.bank) * Math.min(1, dt * 2.6 * Math.sqrt(S.turn));
    this.pitch += (climb - this.pitch) * Math.min(1, dt * 2.4 * Math.sqrt(S.climb));
    // pull back in a bank and the turn tightens (and the pull goes into the turn, not the climb): the hairpin move
    this.pull = Math.max(0, climb) * Math.min(1, Math.abs(this.bank) * 1.4);
    this.yaw = wrap(this.yaw + this.bank * dt * 0.95 * S.turn * (1 + 0.6 * this.pull));
    // energy: a dive picks up speed, a climb bleeds a little
    this.dive += (-this.pitch * 8 - this.dive) * Math.min(1, dt * 0.9);
    const on = !!inp.boost && this.meter > 0.02 && !this.tr;
    this.meter = Math.max(0, Math.min(1, this.meter + (on ? -0.36 : 0.018) * dt));
    this.boostK += ((on ? 1 : 0) - this.boostK) * Math.min(1, dt * 3);
    this.burst = Math.max(0, this.burst - dt * 7);
    this.slowT = Math.max(0, this.slowT - dt);
    const slow = this.slowT > 0 ? 0.5 + 0.5 * (1 - this.slowT / 2.5) : 1;
    this.speed = (this.base * this.skill + this.dive + this.burst + this.boostK * 24 * S.boost * this.cls.speed) * slow * this.speedMul;
    this.speedMul = 1;
    this.throttle = Math.min(1, 0.75 + this.boostK * 0.25 + this.burst / 40);
    let done = null;
    this.roll = 0; this.loopA = 0;
    if (this.tr) {
      const T = this.tr; T.t += dt;
      const k = Math.min(1, T.t / T.dur), e = k * k * (3 - 2 * k);
      if (T.kind === 'roll') {
        this.roll = e * Math.PI * 2 * T.dir;
        this.pos.addScaledVector(this.fwd, this.speed * dt);
        const side = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
        this.pos.addScaledVector(side, Math.sin(k * Math.PI) * T.dir * 7 * dt);
      } else {
        this.loopA = e * Math.PI * 2;
        const fwd = LOOP_R * Math.sin(this.loopA) + this.speed * 0.35 * T.t, up = LOOP_R * (1 - Math.cos(this.loopA));
        this.pos.set(T.at.x + Math.sin(T.yaw) * fwd, T.at.y + up, T.at.z - Math.cos(T.yaw) * fwd);
      }
      if (k >= 1) {
        done = T.kind; this.tr = null; if (T.kind === 'loop') this.pitch = 0;
        this.meter = Math.min(1, this.meter + (T.kind === 'loop' ? 0.3 : 0.12) * S.trick);
      }
    } else {
      this.pos.addScaledVector(this.fwd, this.speed * dt);
      this.pos.y += this.pitch * 24 * S.climb * dt * (1 - Math.min(1, Math.abs(this.bank) * 1.2) * (this.pitch > 0 ? 0.75 : 0.3));
    }
    return done;
  }
  /** Put the plane model where the flyer is. */
  pose(group, t, shake = 0) {
    group.position.copy(this.pos);
    group.rotation.order = 'YXZ';
    group.rotation.set(-this.pitch * 0.32 + Math.sin(t * 1.7) * 0.01 - this.loopA, Math.PI - this.yaw, -this.bank * 0.65 - this.roll + (shake ? Math.sin(t * 40) * 0.08 * shake : 0));
  }
}
