// Frostmere: tracks in the snow. Everyone up north leaves footprints that fade over a minute or two; skates leave
// thin lines on the ice and sleds leave a pair of runner grooves. One instanced draw for the lot (a pool of quads,
// recycled oldest first; a mark shrinks away at the end of its life). Also deep snow: off the paths and trails you
// wade (a little slower) unless you've got snowshoes on.
import * as THREE from 'three';
import { toLocal, inNorth, kindAt, isIce, K, P, ICE_Y, trailDist } from './geo.js';

const MAX = 700, LIFE = 100;

export class Tracks {
  constructor(north) {
    this.north = north; this.game = north.game;
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: '#b8c8d6', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), MAX);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 1; this.mesh.name = 'tracks';
    this.marks = []; this.walkers = new Map(); this.next = 0;
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    this.dirty = true;
  }
  attach(group) { group.add(this.mesh); }
  /** A mark at (x, y, z), facing yaw: kind 'foot' | 'skate' | 'runner'. */
  add(x, y, z, yaw, kind, side = 0) {
    const m = { x, y: y + 0.03, z, yaw, kind, side, t: this.time || 0 };
    if (this.marks.length < MAX) this.marks.push(m); else { this.marks[this.next] = m; this.next = (this.next + 1) % MAX; }
    this.dirty = true;
  }
  /** Lay marks behind anyone moving up north (you, other anglers, the sled teams). */
  step(id, x, y, z, yaw, kind) {
    let w = this.walkers.get(id);
    if (!w) { w = { x, z, side: 1 }; this.walkers.set(id, w); return; }
    const d = Math.hypot(x - w.x, z - w.z), gap = kind === 'foot' ? 0.62 : kind === 'skate' ? 0.9 : kind === 'tread' ? 1 : 0.7;
    if (d > 6) { w.x = x; w.z = z; return; } // (a jump: the plane, a teleport)
    if (d < gap) return;
    w.x = x; w.z = z; w.side = -w.side;
    const sx = Math.cos(yaw), sz = -Math.sin(yaw);
    if (kind === 'tread') { this.add(x, y, z, yaw, 'tread'); for (const s of [-1, 1]) this.add(x + sx * 0.42 * s + Math.sin(yaw) * 1.8, y, z + sz * 0.42 * s + Math.cos(yaw) * 1.8, yaw, 'runner'); }
    else if (kind === 'runner') for (const s of [-1, 1]) this.add(x + sx * 0.35 * s, y, z + sz * 0.35 * s, yaw, kind);
    else this.add(x + sx * 0.12 * w.side, y, z + sz * 0.12 * w.side, yaw, kind, w.side);
  }
  /** Deep snow off the paths: true where you'd wade. */
  deepSnow(x, z) {
    const [u, v] = toLocal(x, z);
    if (kindAt(u, v) !== K.LAND) return false;
    if (Math.hypot(u - P.village.u, v - P.village.v) < 58 || Math.hypot(u - P.kennels.u, v - P.kennels.v) < 22) return false;
    return trailDist(u, v) > 4;
  }
  update(dt) {
    const g = this.game, N = this.north;
    this.time = (this.time || 0) + dt;
    if (!N.here) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const pl = g.player, p = pl.pos;
    // you
    if (N.sno?.on) { if (!N.sno.air) this.step('me', p.x, N.sno.y, p.z, pl.yaw, 'tread'); } // (a snowmobile leaves its track and two ski lines)
    else if (pl.mode === 'shore' && !pl.airborne && !N.sleds.riding && !N.hidden && !N.rideSeat()) {
      const [u, v] = toLocal(p.x, p.z), ice = isIce(kindAt(u, v));
      this.step('me', p.x, p.y, p.z, pl.yaw, pl.skating ? 'skate' : 'foot');
      // deep snow slows you (snowshoes don't sink)
      if (!ice && !pl.skating && this.deepSnow(p.x, p.z) && !N.ice?.has('snowshoes')) {
        pl.speedMult = (pl.speedMult ?? 1) * 0.8;
        if (!this.warned && pl.moving) { this.warned = true; g.ui.toast('Deep snow off the paths slows you down. Pell sells snowshoes!', { icon: 'waves', ms: 3500 }); }
      }
    }
    // other anglers and the sled teams
    for (const r of g.remotes?.list?.values?.() || []) {
      const s = r.peer.state; if (!s || !r.actor.root.visible || !inNorth(r.pos.x, r.pos.z) || s.sl) continue;
      if (s.sm) this.step(r.peer.id, s.sm[0], s.sm[3], s.sm[1], s.sm[2], 'tread');
      else if (s.moving) this.step(r.peer.id, r.pos.x, r.pos.y, r.pos.z, r.yaw ?? 0, s.sk ? 'skate' : 'foot');
    }
    for (const t of [...N.sleds.teams, ...(N.sleds.soloTeam ? [N.sleds.soloTeam] : [])]) if (t.visible) this.step(t, t.sled.position.x, t.sled.position.y, t.sled.position.z, t.sled.rotation.y, 'runner');
    // redraw (cheaply: the pool only changes when a mark is added, and once a second as old ones shrink)
    this.redrawT = (this.redrawT || 0) - dt;
    if (!this.dirty && this.redrawT > 0) return;
    this.dirty = false; this.redrawT = 1;
    let n = 0;
    for (const m of this.marks) {
      const age = this.time - m.t;
      if (age > LIFE) continue;
      const k = age > LIFE * 0.7 ? 1 - (age - LIFE * 0.7) / (LIFE * 0.3) : 1;
      const [w, l] = m.kind === 'foot' ? [0.13, 0.26] : m.kind === 'skate' ? [0.03, 0.85] : m.kind === 'tread' ? [0.44, 1.05] : [0.06, m.kind === 'runner' ? 1.05 : 0.8];
      this.e.set(0, m.yaw, 0); this.q.setFromEuler(this.e);
      this.v.set(m.x, m.y, m.z); this.s.set(w * k, 1, l * k);
      this.m4.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(n++, this.m4);
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
}
export { ICE_Y };
