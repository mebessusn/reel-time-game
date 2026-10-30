// Skye's Air Races: the rival pilots. Each flies the racing line (a little off it, in their own lane), boosts on the
// straights, throws in the odd barrel roll for boost, steers round anything moving into their path, and from the Gale
// class up knows the shortcuts. A gentle rubber band keeps races close without being obvious.
import * as THREE from 'three';
import { PLANE_LIST, PAINTS } from './planes.js';

export const RIVALS = [
  { name: 'Skye', plane: 'snowgoose', paint: 'factory', skill: 1.02, lane: 2 },
  { name: 'Captain Pip', plane: 'cub', paint: 'sunset', skill: 0.98, lane: -4 },
  { name: 'Wren Alder', plane: 'biplane', paint: 'mint', skill: 1.0, lane: 5 },
  { name: 'Marlow Finch', plane: 'racer', paint: 'midnight', skill: 0.97, lane: -6 },
  { name: 'Juno Gale', plane: 'cub', paint: 'cherry', skill: 1.01, lane: 3 },
  { name: 'Ace Fennick', plane: 'racer', paint: 'forest', skill: 0.99, lane: -2 },
];
export { PLANE_LIST, PAINTS };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Rival {
  /** track, def (one of RIVALS), opts: { rng, shortcuts (bool), cls } */
  constructor(track, def, { rng, shortcuts, cls }) {
    this.track = track; this.def = def; this.rng = rng; this.useCuts = shortcuts; this.cls = cls;
    this.t = 0; this.lane = def.lane; this.dodge = 0; this.dodgeY = 0; this.dodgeT = 0; this.scanT = rng() * 0.3; this.boosting = false;
    this.path = null; // a shortcut being flown: [points], index
    this.wob = rng() * 10;
  }
  /** Decide whether to take shortcut s this lap (once per lap per shortcut). */
  wantsCut(s, lap) {
    if (!this.useCuts) return false;
    const k = `${s.id}:${lap}`; if (this.cutRoll?.[k] != null) return this.cutRoll[k];
    this.cutRoll = this.cutRoll || {};
    return (this.cutRoll[k] = this.rng() < 0.55 + (this.def.skill - 0.97) * 4);
  }
  /** Controls for this frame. f: the Flyer; R: the racer (next gate, lap); race: for the colliders. */
  think(dt, f, R, race) {
    const T = this.track, near = T.nearest(f.pos, this.t), L = T.length;
    this.t = near.t;
    // a shortcut? leave the line after its first gate
    if (!this.path && T.shortcuts.length) for (const s of T.shortcuts) {
      if (R.next === (s.from + 1) % T.gates.length && f.pos.distanceTo(s.a) < 70 && this.wantsCut(s, R.lap)) { this.path = { s, pts: [s.gates[0].p, s.gates[1].p, s.b], i: 0 }; break; }
    }
    let target;
    if (this.path) {
      // follow the shortcut's straight path: aim a little ahead of where you are along it (not at its far end)
      const P = this.path, A = P.s.a, B = P.s.b, ab = B.clone().sub(A), L2 = ab.lengthSq(), k = f.pos.clone().sub(A).dot(ab) / L2;
      if (k > 1.02) { this.path = null; target = null; }
      else { const k2 = Math.min(1.15, Math.max(0, k) + (f.speed * 0.9 + 10) / Math.sqrt(L2)); target = A.clone().addScaledVector(ab, k2); }
    }
    if (!target) {
      const ahead = (f.speed * 0.85 + 12) / L, fr = T.frame(near.t + ahead);
      const lane = Math.max(-3, Math.min(3, this.lane * 0.5)) * Math.sin(near.t * 31 + this.wob) + this.dodge;
      target = fr.p.clone().addScaledVector(fr.right, lane); target.y += this.dodgeY;
    }
    // look ahead along the heading for anything solid (a blimp, a train, the crane's hook) and sidestep it
    this.scanT -= dt; this.dodgeT -= dt;
    if (this.scanT <= 0 && !this.path) { // (a shortcut's path is clear: no ducking about in the narrow bits)
      this.scanT = 0.25;
      // look along the line ahead (where you're going, not where the nose points: the static things beside and over the
      // line are clear of it, so only moving things set this off): sideways, or over or under (a blimp is tall)
      const ahead = [12, 24, 38, 54, 72].map((d) => T.frame(near.t + d / L));
      const hit = (side, up = 0) => ahead.some((fr) => race.solidAt(fr.p.clone().addScaledVector(fr.right, side + this.dodge * 0).setY(fr.p.y + up), 3));
      if (hit(0)) {
        const opts = [[8, 0], [-8, 0], [0, 14], [0, -12], [14, 0], [-14, 0], [0, 22]].filter(([sd, up]) => !hit(sd, up));
        const pick = opts[0] || [this.rng() < 0.5 ? 10 : -10, 8];
        this.dodge = pick[0]; this.dodgeY = pick[1]; this.dodgeT = 1.5;
      } else if (this.dodgeT <= 0) { this.dodge *= 0.6; this.dodgeY *= 0.6; }
    }
    const want = Math.atan2(target.x - f.pos.x, -(target.z - f.pos.z)), d = wrap(want - f.yaw);
    const steer = Math.max(-1, Math.min(1, d * 2.4));
    let climb = Math.max(-1, Math.min(1, (target.y - f.pos.y) * 0.07 - f.pitch * 0.25));
    if (Math.abs(d) > 0.3 && target.y - f.pos.y > -6) climb = Math.max(climb, Math.min(0.9, Math.abs(d))); // (a hairpin: pull back in the bank. v1.17.1: not when the line dives through the turn, or you stay high)
    // boost on the straights: hold it from half a meter down to a sliver
    if (!this.boosting && f.meter > 0.5 && Math.abs(d) < 0.12) this.boosting = true;
    if (this.boosting && (f.meter < 0.12 || Math.abs(d) > 0.35)) this.boosting = false;
    // the odd barrel roll on a straight (it fills their boost, as it does yours)
    if (!f.tr && Math.abs(d) < 0.05 && f.meter < 0.5 && this.rng() < dt * 0.06) f.trick('roll', this.rng() < 0.5 ? -1 : 1);
    return { steer, climb, boost: this.boosting };
  }
}
