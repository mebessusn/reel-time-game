// Skye's Air Races (v1.17.1): flocks of birds that turn up along the course as you fly it, either coming straight down
// the line at you or crossing it just ahead. They're yours alone (each player's own sky), they come more often on the
// harder circuits and in the faster classes, and flying into one is a bird strike (a slowdown, not a crash).
// All the birds are two instanced meshes (bodies and wings), so a sky full of them is two draw calls.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

const MAX_FLOCKS = 3, PER = 8, SCALE = 2.4, HIT = 4.2;
const EVERY = { 1: 17, 2: 11, 3: 7 }; // (seconds between flocks, on average, by tier, before the class's hazard factor)

export class Flocks {
  constructor(scene, track, { tier = 1, hazards = 1, seed = 1 } = {}) {
    this.track = track; this.rng = mulberry32(seed * 977 + 13);
    this.every = (EVERY[tier] || 12) / Math.max(0.5, hazards);
    this.wait = 6 + this.rng() * 4; // (none right off the start)
    const body = new THREE.CapsuleGeometry(0.16, 0.5, 3, 8); body.rotateX(Math.PI / 2);
    const wing = new THREE.BoxGeometry(1.1, 0.03, 0.32); wing.translate(0.55, 0, 0); // (hinged at the shoulder)
    this.bodies = new THREE.InstancedMesh(body, new THREE.MeshLambertMaterial({ color: '#f2f2ee' }), MAX_FLOCKS * PER);
    this.wings = new THREE.InstancedMesh(wing, new THREE.MeshLambertMaterial({ color: '#9aa2ac' }), MAX_FLOCKS * PER * 2);
    for (const m of [this.bodies, this.wings]) { m.frustumCulled = false; m.count = 0; scene.add(m); }
    this.flocks = [];
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(0, 0, 0, 'YXZ'); this.s = new THREE.Vector3(SCALE, SCALE, SCALE); this.v = new THREE.Vector3();
  }
  /** One flock, `ahead` metres down the line from track position t: head-on (down the line at you) or crossing it. */
  spawn(R) {
    const f = R.f, T = this.track, ahead = 260 + this.rng() * 140, t = (R.nt ?? 0) + ahead / T.length;
    const F = T.frame(t), y = f.pos.y + (this.rng() - 0.5) * 10, headOn = this.rng() < 0.5;
    const at = F.p.clone().setY(y).addScaledVector(F.right, (this.rng() - 0.5) * 16);
    let pos, vel;
    if (headOn) { pos = at; vel = F.f.clone().setY(0).normalize().multiplyScalar(-(18 + this.rng() * 8)); }
    else {
      const side = this.rng() < 0.5 ? -1 : 1, off = 70 + this.rng() * 40, arrive = ahead / Math.max(30, f.speed); // (timed to cross the line about when you get there)
      pos = at.clone().addScaledVector(F.right, side * off); vel = F.right.clone().multiplyScalar(-side * off / arrive);
    }
    const birds = [];
    for (let i = 0; i < PER; i++) birds.push({ o: new THREE.Vector3((this.rng() - 0.5) * 14, (this.rng() - 0.5) * 5, (this.rng() - 0.5) * 12), ph: this.rng() * 6 });
    this.flocks.push({ pos, vel, birds, life: 16, hit: false, warned: false });
    if (this.flocks.length > MAX_FLOCKS) this.flocks.shift();
  }
  /** Each frame, for your racer R (race: for the strike and the call-outs). */
  update(dt, t, R, race) {
    if (R && race.phase === 'race' && !R.fin && !(R.crashT > 0)) { this.wait -= dt; if (this.wait <= 0) { this.wait = this.every * (0.6 + this.rng() * 0.8); this.spawn(R); } }
    let nb = 0, nw = 0;
    for (const F of this.flocks) {
      F.life -= dt; F.pos.addScaledVector(F.vel, dt);
      const yaw = Math.atan2(F.vel.x, F.vel.z);
      for (const b of F.birds) {
        const p = this.v.copy(b.o).applyAxisAngle(UP, yaw).add(F.pos); p.y += Math.sin(t * 1.3 + b.ph) * 0.8;
        if (F.life <= 0) continue;
        this.e.set(0, yaw, 0); this.q.setFromEuler(this.e); this.m.compose(p, this.q, this.s); this.bodies.setMatrixAt(nb++, this.m);
        const fl = Math.sin(t * 11 + b.ph) * 0.65;
        for (const sd of [-1, 1]) { this.e.set(0, yaw + (sd < 0 ? Math.PI : 0), fl); this.q.setFromEuler(this.e); this.m.compose(p, this.q, this.s); this.wings.setMatrixAt(nw++, this.m); }
        if (R && !F.hit && !(R.safeT > 0) && !(R.crashT > 0) && p.distanceTo(R.f.pos) < HIT) { F.hit = true; race.birdStrike(R); }
      }
      if (R && !F.warned && F.pos.distanceTo(R.f.pos) < 150) { F.warned = true; race.pop?.('BIRDS!', '#fff2c8'); }
    }
    this.flocks = this.flocks.filter((F) => F.life > 0);
    this.bodies.count = nb; this.wings.count = nw;
    this.bodies.instanceMatrix.needsUpdate = true; this.wings.instanceMatrix.needsUpdate = true;
  }
  dispose() { for (const m of [this.bodies, this.wings]) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); } }
}
const UP = new THREE.Vector3(0, 1, 0);
