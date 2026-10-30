// Frostmere: four-legged animals drawn as instances (like the sled dogs, src/north/dogs.js): one draw for every body
// of a kind and one for every leg. Each animal has a gait ('stand', 'walk', 'trot', 'run', 'sit', 'rear'), a scale
// (bear cubs, Old Whitepaw) and a coat tint.
import * as THREE from 'three';
import { merged, MERGED_MATS } from './instancing.js';

export class QuadPack {
  /** kind: { body, leg, hips: [[x, y, z] x4 front l/r, back l/r], stride (swing), rate }, n animals. */
  constructor(parent, kind, n, { tints = [], scales = [] } = {}) {
    this.kind = kind;
    const body = merged(kind.body), leg = merged(kind.leg);
    this.body = new THREE.InstancedMesh(body.solid, MERGED_MATS.solid, n);
    this.legs = new THREE.InstancedMesh(leg.solid, MERGED_MATS.solid, n * 4);
    this.glow = body.glow ? new THREE.InstancedMesh(body.glow, MERGED_MATS.glow, n) : null;
    for (const m of [this.body, this.legs, this.glow]) if (m) { m.frustumCulled = false; m.castShadow = m !== this.glow; m.name = `quad:${kind.body}`; parent.add(m); }
    const c = new THREE.Color();
    this.list = Array.from({ length: n }, (_, i) => {
      const a = { i, x: 0, y: -999, z: 0, yaw: 0, gait: 'stand', phase: i * 1.37, sit: 0, rear: 0, s: scales[i] ?? 1, visible: true, hop: 0 };
      if (tints[i]) { c.set(tints[i]); this.body.setColorAt(i, c); for (let k = 0; k < 4; k++) this.legs.setColorAt(i * 4 + k, c); }
      return a;
    });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._h = new THREE.Matrix4(); this._l = new THREE.Matrix4();
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }
  set visible(v) { this.body.visible = v; this.legs.visible = v; if (this.glow) this.glow.visible = v; }
  update(dt) {
    const K = this.kind, { _m: m, _q: q, _e: e, _p: p, _s: s, _h: hm, _l: lm } = this;
    for (const a of this.list) {
      if (!a.visible) { this.body.setMatrixAt(a.i, this.zero); this.glow?.setMatrixAt(a.i, this.zero); for (let k = 0; k < 4; k++) this.legs.setMatrixAt(a.i * 4 + k, this.zero); continue; }
      const rate = (a.gait === 'run' ? 9 : a.gait === 'trot' ? 6.5 : a.gait === 'walk' ? 4 : 0) * (K.rate || 1) / Math.sqrt(a.s);
      a.phase += dt * rate;
      a.sit += ((a.gait === 'sit' ? 1 : 0) - a.sit) * Math.min(1, dt * 3);
      a.rear += ((a.gait === 'rear' ? 1 : 0) - a.rear) * Math.min(1, dt * 3);
      const sw = (a.gait === 'run' ? 0.8 : a.gait === 'trot' ? 0.55 : a.gait === 'walk' ? 0.35 : 0) * (K.stride || 1);
      const bob = (a.gait === 'run' ? Math.abs(Math.sin(a.phase)) * 0.08 : a.gait !== 'stand' && a.gait !== 'sit' && a.gait !== 'rear' ? Math.abs(Math.sin(a.phase)) * 0.025 : Math.sin(a.phase * 0.15 + a.i) * 0.005) * a.s;
      const pitch = -a.sit * 0.38 - a.rear * 1.05 + (a.gait === 'run' ? Math.sin(a.phase) * 0.05 : 0);
      e.set(pitch, a.yaw, 0); q.setFromEuler(e);
      // rearing up lifts the front: pivot about the hind hips
      const hipZ = K.hips[2][2] * a.s, lift = a.rear * Math.abs(hipZ) * 0.6;
      p.set(a.x - Math.sin(a.yaw) * lift * 0.3, a.y + bob + a.hop - a.sit * 0.15 * a.s + lift * 0.5, a.z - Math.cos(a.yaw) * lift * 0.3);
      s.setScalar(a.s);
      m.compose(p, q, s);
      this.body.setMatrixAt(a.i, m); this.glow?.setMatrixAt(a.i, m);
      K.hips.forEach(([hx, hy, hz], k) => {
        const front = k < 2, left = k % 2 === 0;
        const off = a.gait === 'run' ? (front ? 0 : Math.PI) + (left ? 0 : 0.4) : (front === left ? 0 : Math.PI);
        let ang = Math.sin(a.phase + off) * sw;
        if (!front) ang -= a.sit * 1.2 - a.rear * 0.9; else ang += a.sit * 0.2 + a.rear * 0.9 + (a.rear ? Math.sin(a.phase * 2 + k) * 0.2 * a.rear : 0);
        hm.makeTranslation(hx, hy, hz); lm.makeRotationX(ang);
        hm.multiply(lm); hm.premultiply(m);
        this.legs.setMatrixAt(a.i * 4 + k, hm);
      });
    }
    this.body.instanceMatrix.needsUpdate = true; this.legs.instanceMatrix.needsUpdate = true; if (this.glow) this.glow.instanceMatrix.needsUpdate = true;
  }
}

export const KINDS = {
  bear: { body: 'fw_bear', leg: 'fw_bear_leg', hips: [[-0.28, 0.85, 0.55], [0.28, 0.85, 0.55], [-0.28, 0.85, -0.68], [0.28, 0.85, -0.68]], rate: 0.8 },
  fox: { body: 'fw_fox', leg: 'fw_fox_leg', hips: [[-0.06, 0.25, 0.15], [0.06, 0.25, 0.15], [-0.06, 0.25, -0.17], [0.06, 0.25, -0.17]], rate: 1.6 },
  caribou: { body: 'fw_caribou', leg: 'fw_caribou_leg', hips: [[-0.17, 0.8, 0.5], [0.17, 0.8, 0.5], [-0.17, 0.8, -0.55], [0.17, 0.8, -0.55]], rate: 1 },
  muskox: { body: 'fw_muskox', leg: 'fw_muskox_leg', hips: [[-0.26, 0.52, 0.45], [0.26, 0.52, 0.45], [-0.26, 0.52, -0.5], [0.26, 0.52, -0.5]], rate: 1, stride: 0.7 },
  stag: { body: 'fw_stag', leg: 'fw_stag_leg', hips: [[-0.2, 1.02, 0.62], [0.2, 1.02, 0.62], [-0.2, 1.02, -0.7], [0.2, 1.02, -0.7]], rate: 0.9 },
};
