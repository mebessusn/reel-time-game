// Frostmere (v1.17.2): getting across the snow. Two things you can own and call up anywhere with the ride key (the bike's):
//   The snowmobile (Pell's, 2,400 coins): the fastest way over the snow. W to go, S to brake and back up, A/D to steer. It
//   leaves the ground over crests and comes down with a thump (src/north/resort.js times the climb and the jump with it).
//   The one-dog sled (June's, 500 coins): Pepper and a little sled, slower and friendlier (src/north/sleds.js, mode 'solo').
// Other anglers see your machine from your state (`sm`), like the bike.
import * as THREE from 'three';
import { mergedMesh } from './instancing.js';
import { polyforkModel } from '../world/polyfork.js';
import { EngineSound } from './frostmere.js';
import { toLocal, inNorth, kindAt, isOpen } from './geo.js';
import { blocked } from '../world/colliders.js';
import { walkY } from '../world/terrain.js';
import { natureMaterial } from '../world/nature.js';
import { northSfx } from './sounds.js';
import { SoftSpray } from '../render/softspray.js';

const SEAT_BACK = 0.6; // (you sit on the bench, this far behind the machine's middle)
export const SNO = { max: 24, boost: 29, reverse: 5, accel: 11, brake: 22, coast: 4, grav: 15, price: 2400, pup: 500 };

function build() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(polyforkModel('snowmobile').body, natureMaterial());
  m.castShadow = true; g.add(m);
  return g;
}

export class Snowmobile {
  constructor(north) {
    this.north = north; this.game = north.game; this.on = false; this.v = 0; this.vy = 0; this.steer = 0; this.air = false; this.airT = 0;
    this.sound = new EngineSound(this.game.audio); this.remote = new Map(); this.boostT = 0;
  }
  get owned() { return !!this.north.d.sno; }
  get fx() { return (this.sprayFx ??= new SoftSpray(this.north.world.group, '#f2f7fb')); }
  get mesh() {
    if (!this.m) {
      this.m = build(); this.m.visible = false; this.north.world.group.add(this.m);
      // the headlight: a wide soft cone, a real spot light (always in the scene, dark until you ride: switching one on and
      // off would make every material recompile)
      const L = this.lamp = new THREE.SpotLight('#fff2dc', 0, 48, 0.82, 1, 1.05);
      L.userData.lbSkip = true; this.north.world.group.add(L, L.target);
    }
    return this.m;
  }
  open(x, z) { const [u, v] = toLocal(x, z); return isOpen(kindAt(u, v)); }
  ok(x, z) { return inNorth(x, z) && this.north.groundAt(x, z) != null && !this.open(x, z) && !this.north.holeAt(x, z) && !blocked(x, z, 0.6) && (walkY(x, z, 0.3) != null || this.north.groundAt(x, z) < 40); }
  mount() {
    const g = this.game, p = g.player, N = this.north;
    if (this.on || N.trip || N.sleds.riding || g.ui.modalOpen || N.lodge?.inside || N.shanty?.inside) return false;
    if (g.fishing.busy) g.fishing.cancel();
    N.skate?.set(false);
    const y = N.groundAt(p.pos.x, p.pos.z);
    if (y == null) return false;
    this.on = true; this.v = 0; this.vy = 0; this.y = y; this.air = false; this.mesh.visible = true;
    p.target = null; this.sound.start();
    if (!N.d.snoHelp) { g.ext.change((d) => { d.north.snoHelp = 1; }); g.ui.toast('W to go, S to brake, A and D to steer, Shift for a burst. Press the snowflake button (or your ride key) to hop off.', { title: 'Snowmobile', icon: 'star', ms: 6000 }); }
    return true;
  }
  dismount() {
    const g = this.game, p = g.player, N = this.north;
    if (!this.on) return;
    this.on = false; this.mesh.visible = false; this.lamp.intensity = 0; this.sound.stop();
    const c = Math.cos(p.yaw) * 1.3, s = -Math.sin(p.yaw) * 1.3;
    for (const [dx, dz] of [[c, s], [-c, -s], [0, 0]]) { const x = p.pos.x + dx, z = p.pos.z + dz; if (walkY(x, z) != null && !blocked(x, z, 0.3)) { p.pos.x = x; p.pos.z = z; break; } }
    const y = N.groundAt(p.pos.x, p.pos.z) ?? p.pos.y; p.pos.y = y; p.baseY = y; p.vy = 0;
  }
  /** Each frame while riding. */
  control(dt) {
    if (!this.on) return false;
    const g = this.game, p = g.player, N = this.north;
    if (N.trip) { this.dismount(); return false; }
    let f = 0, r = 0;
    if (!g.ui.modalOpen) {
      f = (p.held('up') ? 1 : 0) - (p.held('down') ? 1 : 0); r = (p.held('right') ? 1 : 0) - (p.held('left') ? 1 : 0);
      if (p.stick) { if (Math.abs(p.stick.y) > 0.1) f = -p.stick.y; if (Math.abs(p.stick.x) > 0.1) r = p.stick.x; }
      if (f || r) p.touch();
    }
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), gy0 = N.groundAt(p.pos.x, p.pos.z) ?? this.y;
    // hills: a climb slows it a little, a run downhill speeds it up
    const grade = Math.max(-0.6, Math.min(0.7, ((N.groundAt(p.pos.x + fx * 1.2, p.pos.z + fz * 1.2) ?? gy0) - gy0) / 1.2));
    const top = (p.sprint ? SNO.boost : SNO.max) * (grade > 0 ? 1 - grade * 0.45 : 1 - grade * 0.2);
    if (!this.air) {
      if (f > 0) this.v = Math.min(top, this.v + SNO.accel * f * dt * (this.v < 0 ? 2 : 1));
      else if (f < 0) this.v = this.v > 0.05 ? Math.max(0, this.v - SNO.brake * -f * dt) : Math.max(-SNO.reverse, this.v - SNO.accel * 0.5 * -f * dt);
      else this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), SNO.coast * dt);
      if (this.v > top) this.v = Math.max(top, this.v - SNO.brake * 0.4 * dt);
    }
    this.steer += (r - this.steer) * Math.min(1, dt * 6);
    const sp = Math.abs(this.v);
    if (sp > 0.05) p.yaw -= this.steer * Math.min(1.9, 0.5 + sp * 0.12) * (this.air ? 0.35 : 1) * dt * Math.sign(this.v);
    if (sp > 0.001) {
      const step = this.v * dt, nx = p.pos.x + Math.sin(p.yaw) * step, nz = p.pos.z + Math.cos(p.yaw) * step;
      if (this.ok(nx, nz)) { p.pos.x = nx; p.pos.z = nz; }
      else if (this.ok(nx, p.pos.z)) { p.pos.x = nx; this.v *= 0.75; }
      else if (this.ok(p.pos.x, nz)) { p.pos.z = nz; this.v *= 0.75; }
      else { if (sp > 5) { g.audio.sfx('flop'); g.engine.shake = Math.max(g.engine.shake || 0, 0.4); } this.v = -this.v * 0.2; }
    }
    // the ground, or the air: over a crest the machine carries on and drops back down
    const gy = N.groundAt(p.pos.x, p.pos.z) ?? this.y, climb = (gy - gy0) / Math.max(1e-3, dt);
    if (this.air) {
      this.vy -= SNO.grav * dt; this.y += this.vy * dt; this.airT += dt;
      if (this.y <= gy) {
        const hit = -this.vy; this.y = gy; this.air = false; this.vy = 0;
        if (hit > 3) { g.audio.sfx('flop'); g.engine.shake = Math.max(g.engine.shake || 0, Math.min(0.7, hit * 0.06)); }
        N.resort?.landed(this.airT, p.pos); this.airT = 0;
      }
    } else if (this.y - gy > 0.25 && sp > 8) { this.air = true; this.airT = 0; this.vy = this.lastClimb ?? 0; N.resort?.tookOff(p.pos); } else { this.y = gy; this.lastClimb = climb; }
    p.pos.y = this.y; p.baseY = p.pos.y; p.vy = 0; p.moving = false; p.target = null; p.dir.set(fx, 0, fz);
    const M = this.mesh, nose = N.groundAt(p.pos.x + fx * 1.2, p.pos.z + fz * 1.2) ?? gy, tail = N.groundAt(p.pos.x - fx * 1.2, p.pos.z - fz * 1.2) ?? gy;
    const pitch = this.air ? -Math.atan2(this.vy, Math.max(4, sp)) * 0.7 : Math.atan2(tail - nose, 2.4);
    this.pitch = (this.pitch ?? 0) + (pitch - (this.pitch ?? 0)) * Math.min(1, dt * 8);
    this.lean = (this.lean ?? 0) + ((-this.steer * Math.min(1, sp / 12) * 0.2) - (this.lean ?? 0)) * Math.min(1, dt * 5);
    M.position.set(p.pos.x + fx * SEAT_BACK, this.y, p.pos.z + fz * SEAT_BACK); M.rotation.order = 'YXZ'; M.rotation.set(this.pitch, p.yaw, this.lean);
    { const L = this.lamp, e = g.engine.sky.night || 0; L.intensity = e * 34; // (a little above the nose, aimed down the snow ahead)
      L.position.set(M.position.x + fx * 1.3, this.y + 1.05, M.position.z + fz * 1.3); L.target.position.set(M.position.x + fx * 15, this.y - 0.4, M.position.z + fz * 15); L.target.updateMatrixWorld(); }
    this.sound.set(0.15 + Math.min(1, sp / SNO.max) * 0.8 * (f ? 1 : 0.6));
    // the track throws a plume of snow up behind it: more at speed, a burst when you land
    if (sp > 2.5 && !this.air) {
      this.spray = (this.spray || 0) + dt * (24 + sp * 3);
      while (this.spray > 1) {
        this.spray -= 1;
        const b = SEAT_BACK - 1.35 - Math.random() * 0.3, s = (Math.random() - 0.5) * 0.6, ux = Math.cos(p.yaw), uz = -Math.sin(p.yaw), k = Math.min(1, sp / 16);
        this.fx.puff(p.pos.x + fx * b + ux * s, this.y + 0.15, p.pos.z + fz * b + uz * s, -fx * (1 + sp * 0.14) + ux * s * 2.5, 1 + k * (1.8 + Math.random() * 1.8), -fz * (1 + sp * 0.14) + uz * s * 2.5, 0.5 + Math.random() * 0.45, 0.24 + k * 0.26);
      }
    }
    g.engine.cam.target.set(p.pos.x, p.pos.y + 0.9, p.pos.z);
    if (this.v > 2 && performance.now() - (g.camDragAt || 0) > 1500) { let d = p.yaw + Math.PI - g.engine.cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); g.engine.cam.yaw += d * Math.min(1, dt * 1.8); }
    this.speed = sp;
    return true;
  }
  contextActions() { return this.on ? [{ id: 'sno-off', label: 'Hop off the snowmobile', color: 'green', fn: () => this.dismount() }] : []; }
  stateExtra() { const p = this.game.player; return this.on ? { sm: [+p.pos.x.toFixed(1), +p.pos.z.toFixed(1), +p.yaw.toFixed(2), +this.y.toFixed(1)] } : null; }
  update(dt = 1 / 60) {
    this.sprayFx?.update(dt, this.game.engine.renderer, -7);
    const seen = new Set();
    for (const r of this.game.remotes?.list?.values?.() || []) {
      const s = r.peer?.state?.sm; if (!Array.isArray(s) || !inNorth(s[0], s[1])) continue;
      seen.add(r);
      let m = this.remote.get(r);
      if (!m) { m = build(); this.north.world.group.add(m); this.remote.set(r, m); }
      m.position.set(s[0] + Math.sin(s[2]) * SEAT_BACK, s[3], s[1] + Math.cos(s[2]) * SEAT_BACK); m.rotation.y = s[2];
    }
    for (const [r, m] of this.remote) if (!seen.has(r)) { this.north.world.group.remove(m); this.remote.delete(r); }
  }
}

/** The ride key up north: on or off whichever ride you've got. */
export function toggleRide(north) {
  const g = north.game, S = north.sno, L = north.sleds;
  if (!north.here) return false;
  if (S.on) { S.dismount(); return true; }
  if (L.riding?.mode === 'solo') { L.stop(); return true; }
  if (L.riding || north.races?.active) return true;
  const want = north.d.ride || (S.owned ? 'sno' : north.d.pup ? 'pup' : null);
  if (want === 'sno' && S.owned) { if (S.mount()) northSfx(g.audio, 'crack', { vol: 0.2 }); return true; }
  if (want === 'pup' && north.d.pup) { L.solo(); return true; }
  g.ui.toast('Your bike\'s back at the cove. Up here you want a snowmobile (Pell sells them) or a one-dog sled (ask June).', { icon: 'star', ms: 5000 });
  return true;
}
export { mergedMesh };
