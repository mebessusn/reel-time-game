// Frostmere: sled dogs. Huskies built in Blender (art/src/hearthwick.py hw_dog, hw_dog_leg), drawn as instances: one
// draw for every body and one for every leg, whatever the number of dogs. Each dog trots, runs (a gallop: the legs
// in pairs), stands or sits; the kennels' pack wanders its yard and the sled team runs in harness (src/north/sled.js).
import * as THREE from 'three';
import { merged, MERGED_MATS, addLibrary } from './instancing.js';
import { POLYANIMAL_MATS, POLYANIMAL_NODES, POLYANIMAL_HIPS } from '../data/polyanimalMesh.js';

addLibrary(POLYANIMAL_MATS, POLYANIMAL_NODES); // v1.17.2: Polyfork's dog, recoloured husky grey (scripts/animal-split.mjs)

const HIPS = POLYANIMAL_HIPS.dog; // front l/r, back l/r
const COATS = ['#7a7e86', '#3a3a40', '#a8744a', '#d8d4cc', '#5a5e66', '#8c6a4a', '#2e2e34', '#c8c0b4'];
export const DOG_NAMES = ['Pepper', 'Juniper', 'Moss', 'Biscuit', 'Koda', 'Nova', 'Tundra', 'Pip'];

export class DogPack {
  /** n dogs, drawn under `parent`. Each dog: { x, y, z, yaw, gait: 'stand'|'trot'|'run'|'sit', speed, phase }. */
  constructor(parent, n) {
    const body = merged('pa_dog_body'), leg = merged('pa_dog_leg'), hind = merged('pa_dog_hind');
    this.body = new THREE.InstancedMesh(body.solid, MERGED_MATS.solid, n);
    this.legs = new THREE.InstancedMesh(leg.solid, MERGED_MATS.solid, n * 2); // (front legs)
    this.hind = new THREE.InstancedMesh((hind.solid || leg.solid), MERGED_MATS.solid, n * 2); // (v1.17.1: hind legs have their own shape)
    for (const m of [this.body, this.legs, this.hind]) { m.castShadow = true; m.frustumCulled = false; } // (they move: no stale bounds)
    this.body.name = 'dogs'; this.legs.name = 'dog-legs'; this.hind.name = 'dog-hind-legs';
    // tint each coat (the white belly and mask stay pale: the tint multiplies the grey parts' vertex colours)
    const c = new THREE.Color(), grey = new THREE.Color(COATS[0]);
    for (let i = 0; i < n; i++) { c.set(COATS[i % COATS.length]); c.setRGB(c.r / grey.r, c.g / grey.g, c.b / grey.b).lerp(new THREE.Color(1, 1, 1), 0.15); /* (coat / the model's grey: the grey parts take the coat) */ this.body.setColorAt(i, c); for (let k = 0; k < 2; k++) { this.legs.setColorAt(i * 2 + k, c); this.hind.setColorAt(i * 2 + k, c); } }
    parent.add(this.body, this.legs, this.hind);
    this.dogs = Array.from({ length: n }, (_, i) => ({ i, name: DOG_NAMES[i % DOG_NAMES.length], x: 0, y: 0, z: 0, yaw: 0, gait: 'stand', speed: 0, phase: i * 1.7, sit: 0, pant: 0 }));
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this._h = new THREE.Matrix4(); this._l = new THREE.Matrix4();
  }
  set visible(v) { this.body.visible = v; this.legs.visible = v; this.hind.visible = v; }
  get visible() { return this.body.visible; }

  /** Pose every dog: the gait sets how fast the legs swing and how much the body bobs. */
  update(dt) {
    const { _m: m, _q: q, _e: e, _p: p, _s: s, _h: hm, _l: lm } = this;
    for (const d of this.dogs) {
      const rate = d.gait === 'run' ? 11 : d.gait === 'trot' ? 7 : 0;
      d.phase += dt * rate;
      d.sit += ((d.gait === 'sit' ? 1 : 0) - d.sit) * Math.min(1, dt * 4);
      const sw = d.gait === 'run' ? 0.85 : d.gait === 'trot' ? 0.5 : 0;
      const bob = d.gait === 'run' ? Math.abs(Math.sin(d.phase)) * 0.07 : d.gait === 'trot' ? Math.abs(Math.sin(d.phase)) * 0.03 : Math.sin(d.phase * 0.2 + d.i) * 0.004;
      const pitch = -d.sit * 0.3 + (d.gait === 'run' ? Math.sin(d.phase) * 0.06 : 0);
      e.set(pitch, d.yaw, 0); q.setFromEuler(e);
      p.set(d.x, d.y + bob - d.sit * 0.12, d.z);
      m.compose(p, q, s);
      this.body.setMatrixAt(d.i, m);
      HIPS.forEach(([hx, hy, hz], k) => {
        const front = k < 2, left = k % 2 === 0;
        // a gallop moves the legs in pairs (front together, back together, half a stride apart); a trot crosses them
        const off = d.gait === 'run' ? (front ? 0 : Math.PI) + (left ? 0 : 0.35) : (front === left ? 0 : Math.PI);
        let a = Math.sin(d.phase + off) * sw;
        if (!front) a -= d.sit * 1.25; // sitting: the back legs fold forward under
        else a += d.sit * 0.25;
        hm.makeTranslation(hx, hy, hz); lm.makeRotationX(a);
        hm.multiply(lm); hm.premultiply(m);
        (front ? this.legs : this.hind).setMatrixAt(d.i * 2 + (k % 2), hm);
      });
    }
    this.body.instanceMatrix.needsUpdate = true; this.legs.instanceMatrix.needsUpdate = true; this.hind.instanceMatrix.needsUpdate = true;
  }
}

/** The kennels' pack: dogs wander their yard, come to the fence to see you, sit about, and now and then race a lap. */
export class KennelDogs {
  constructor(parent, yard, n = 8, yAt = () => yard.y) {
    this.yard = yard; this.yAt = yAt;
    this.pack = new DogPack(parent, n);
    let seed = 7;
    this.r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const d of this.pack.dogs) {
      d.x = yard.x + (this.r() - 0.5) * yard.w * 1.6; d.z = yard.z + (this.r() - 0.5) * yard.d * 1.6; d.y = yAt(d.x, d.z);
      d.yaw = this.r() * 6.28; d.wait = this.r() * 4; d.gait = this.r() < 0.4 ? 'sit' : 'stand';
    }
  }
  update(dt, me) {
    const Y = this.yard, near = Math.hypot(me.x - Y.x, me.z - Y.z) < Y.w + 10;
    // a bark now and then (more when you're at the fence)
    this.barkT = (this.barkT ?? 2) - dt * (near ? 1.6 : 0.5);
    if (this.barkT <= 0 && Math.hypot(me.x - Y.x, me.z - Y.z) < 60) { this.barkT = 2 + this.r() * 6; this.onBark?.(Math.max(0.2, 1 - Math.hypot(me.x - Y.x, me.z - Y.z) / 60)); }
    for (const d of this.pack.dogs) {
      if (d.tx == null) {
        d.wait -= dt;
        if (d.wait <= 0) {
          const roll = this.r();
          if (near && roll < 0.35) { d.tx = Math.max(Y.x - Y.w + 1, Math.min(Y.x + Y.w - 1, me.x)); d.tz = Math.max(Y.z - Y.d + 1, Math.min(Y.z + Y.d - 1, me.z)); d.gait = 'trot'; } // to the fence, to see you
          else if (roll < 0.75) { d.tx = Y.x + (this.r() - 0.5) * (Y.w * 2 - 2); d.tz = Y.z + (this.r() - 0.5) * (Y.d * 2 - 2); d.gait = this.r() < 0.25 ? 'run' : 'trot'; }
          else { d.gait = this.r() < 0.5 ? 'sit' : 'stand'; d.wait = 3 + this.r() * 6; }
        } else if (near && d.gait !== 'sit') { // look at you
          let dy = Math.atan2(me.x - d.x, me.z - d.z) - d.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); d.yaw += dy * Math.min(1, dt * 2);
        }
      } else {
        const dx = d.tx - d.x, dz = d.tz - d.z, l = Math.hypot(dx, dz), v = d.gait === 'run' ? 5.5 : 2.2;
        if (l < 0.3) { d.tx = null; d.gait = 'stand'; d.wait = 1 + this.r() * 4; continue; }
        let dy = Math.atan2(dx, dz) - d.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); d.yaw += dy * Math.min(1, dt * 6);
        const step = Math.min(l, v * dt); d.x += Math.sin(d.yaw) * step; d.z += Math.cos(d.yaw) * step;
        // keep inside the fence
        d.x = Math.max(Y.x - Y.w + 0.8, Math.min(Y.x + Y.w - 0.8, d.x)); d.z = Math.max(Y.z - Y.d + 0.8, Math.min(Y.z + Y.d - 0.8, d.z));
        d.y = this.yAt(d.x, d.z);
      }
    }
    // v1.17.1: dogs keep a body's width apart: each pair closer than that is eased apart (and a dog heading for a spot
    // another's standing on settles beside it instead of walking into it)
    const D = this.pack.dogs, MIN = 1.25;
    for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++) {
      const a = D[i], b = D[j], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz);
      if (l >= MIN) continue;
      const ux = l > 1e-4 ? dx / l : Math.cos(i * 2.3), uz = l > 1e-4 ? dz / l : Math.sin(i * 2.3), push = Math.min(MIN - l, 2.5 * dt + (MIN - l) * 0.5);
      const ka = a.tx != null ? 0.65 : b.tx != null ? 0.35 : 0.5; // (the moving one gives way more)
      a.x -= ux * push * ka; a.z -= uz * push * ka; b.x += ux * push * (1 - ka); b.z += uz * push * (1 - ka);
      for (const d of [a, b]) { d.x = Math.max(Y.x - Y.w + 0.8, Math.min(Y.x + Y.w - 0.8, d.x)); d.z = Math.max(Y.z - Y.d + 0.8, Math.min(Y.z + Y.d - 0.8, d.z)); d.y = this.yAt(d.x, d.z); }
      for (const d of [a, b]) if (d.tx != null && Math.hypot(d.tx - d.x, d.tz - d.z) < 1.0 && D.some((o) => o !== d && o.tx == null && Math.hypot(o.x - d.tx, o.z - d.tz) < MIN)) { d.tx = null; d.gait = 'stand'; d.wait = 1 + this.r() * 3; }
    }
    this.pack.update(dt);
  }
}
