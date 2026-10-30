// Open Waters (v1.17.2): the jet ski (art/jetski.blend, sold at Kai's tiki bar). It floats on the same waves the boats ride
// (oceanWave): buoyancy pulls the hull to the surface, crests throw it into the air, and it pitches and rolls with the slope
// under it. It carves: the nose turns first and the wake follows. Spray fans off the sides and a rooster tail stands up behind.
import * as THREE from 'three';
import { mergedMesh, addLibrary } from '../north/instancing.js';
import { JETSKI_MATS, JETSKI_NODES } from '../data/jetskiMesh.js';
import { EngineSound } from '../north/frostmere.js';
import { SoftSpray } from '../render/softspray.js';
import { oceanWave, oceanSlope } from './waves.js';
import { oceanSurfaceY, OCEAN, islandAt, jettyAt } from './geo.js';

addLibrary(JETSKI_MATS, JETSKI_NODES);
export const JET = { price: 6000, max: 26, boost: 32, reverse: 4, accel: 9, brake: 14, drag: 1.6, grav: 13, seat: 0.84, back: 0.6, dip: 0.12 };
const WATER_Y = 0.85;

export class JetSki {
  constructor(ow) { this.ow = ow; this.game = ow.game; this.on = false; this.v = 0; this.vy = 0; this.y = 0; this.steer = 0; this.sound = new EngineSound(this.game.audio); this.remote = new Map(); this.pitch = 0; this.roll = 0; this.air = false; }
  get owned() { return !!this.ow.dive.gear.jetski; }
  get fx() { return (this.sprayFx ??= new SoftSpray(this.game.engine.scene, '#eef8fc')); }
  get mesh() { if (!this.m) { this.m = mergedMesh('jetski'); this.m.visible = false; this.game.engine.scene.add(this.m); } return this.m; }
  surface(x, z) { return WATER_Y + oceanWave(x, z); }
  deep(x, z) { return oceanSurfaceY(x, z) < WATER_Y - 0.35 && !jettyAt(x, z); }
  toggle() {
    const g = this.game;
    if (this.on) { this.dismount(); return; }
    if (!this.owned) { g.ui.toast('Kai sells jet skis at the tiki bar on Palm Key.', { icon: 'star', ms: 4500 }); return; }
    this.mount();
  }
  /** Launch from where you are: the water right here, or the nearest deep water if you're ashore or aboard. */
  mount() {
    const g = this.game, p = g.player, ow = this.ow;
    if (this.on || g.ui.modalOpen || ow.games.busy) return false;
    let x = p.pos.x, z = p.pos.z, ok = this.deep(x, z) && !ow.boat.footprint?.(x, z);
    for (let r = 2; !ok && r < 34; r += 2) for (let a = 0; a < 6.28 && !ok; a += 0.5) { const qx = p.pos.x + Math.cos(a) * r, qz = p.pos.z + Math.sin(a) * r; if (this.deep(qx, qz) && !ow.boat.footprint?.(qx, qz)) { x = qx; z = qz; ok = true; } }
    if (!ok) { g.ui.toast('Get closer to the water.', { icon: 'waves' }); return false; }
    if (g.fishing.busy) g.fishing.cancel();
    if (g.chairs.seat) g.chairs.stand();
    if (ow.dive.on) { ow.dive.on = false; ow.dive.exit?.(x, WATER_Y, z); }
    p.mode = 'shore'; g.actor.setMode('shore'); p.target = null; p.pos.set(x, this.surface(x, z), z);
    this.on = true; this.v = 0; this.vy = 0; this.y = p.pos.y; this.air = false; this.mesh.visible = true; this.sound.start();
    g.audio.sfx('splashRemote');
    if (!g.ext.d.ocean?.jetHelp) { g.ext.change((d) => { d.ocean.jetHelp = 1; }); g.ui.toast('W for throttle, S to brake, A and D to carve, Shift for a burst. The waves button (or your ride key) hops off.', { title: 'Jet ski', icon: 'star', ms: 6000 }); }
    return true;
  }
  /** Off: ashore or back on deck if one's close, otherwise into the water for a swim. */
  dismount() {
    const g = this.game, p = g.player, ow = this.ow;
    if (!this.on) return;
    this.on = false; this.mesh.visible = false; this.sound.stop();
    const x = p.pos.x, z = p.pos.z;
    for (let r = 1; r < 9; r += 1) for (let a = 0; a < 6.28; a += 0.5) {
      const qx = x + Math.cos(a) * r, qz = z + Math.sin(a) * r, deck = ow.boat.deckY?.(qx, qz);
      if (deck != null || (oceanSurfaceY(qx, qz) > WATER_Y + 0.1 && (islandAt(qx, qz, 1.1) || jettyAt(qx, qz)))) { const y = deck ?? oceanSurfaceY(qx, qz); p.pos.set(qx, y, qz); p.baseY = y; p.vy = 0; return; }
    }
    ow.dive.enter(x, z);
  }
  control(dt) {
    if (!this.on) return false;
    const g = this.game, p = g.player, ow = this.ow;
    let f = 0, r = 0;
    if (!g.ui.modalOpen) {
      f = (p.held('up') ? 1 : 0) - (p.held('down') ? 1 : 0); r = (p.held('right') ? 1 : 0) - (p.held('left') ? 1 : 0);
      if (p.stick) { if (Math.abs(p.stick.y) > 0.1) f = -p.stick.y; if (Math.abs(p.stick.x) > 0.1) r = p.stick.x; }
      if (f || r) p.touch();
    }
    const top = p.sprint ? JET.boost : JET.max;
    if (!this.air) {
      if (f > 0) this.v = Math.min(top, this.v + JET.accel * f * dt);
      else if (f < 0) this.v = this.v > 0 ? Math.max(0, this.v + JET.brake * f * dt) : Math.max(-JET.reverse, this.v + JET.accel * 0.4 * f * dt);
      this.v -= this.v * 0.12 * JET.drag * dt * (f > 0 ? 0.2 : 1);
    }
    this.steer += (r - this.steer) * Math.min(1, dt * 5);
    const sp = Math.abs(this.v);
    p.yaw -= this.steer * Math.min(1.7, 0.5 + sp * 0.09) * (this.air ? 0.3 : 1) * dt;
    // it carves: travel swings round after the nose
    this.dir = this.dir ?? p.yaw; { const d = Math.atan2(Math.sin(p.yaw - this.dir), Math.cos(p.yaw - this.dir)); this.dir += d * Math.min(1, dt * (this.air ? 0.5 : 3.2)); }
    const nx = p.pos.x + Math.sin(this.dir) * this.v * dt, nz = p.pos.z + Math.cos(this.dir) * this.v * dt;
    const fromC = Math.hypot(nx - OCEAN.x, nz - OCEAN.z);
    if (this.deep(nx, nz) && fromC < OCEAN.edge && !ow.boat.footprint?.(nx, nz)) { p.pos.x = nx; p.pos.z = nz; }
    else { if (sp > 5) { g.audio.sfx('flop'); g.engine.shake = Math.max(g.engine.shake || 0, 0.4); } this.v *= -0.25; }
    // buoyancy: the hull rides the water; a crest at speed throws it
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), w = this.surface(p.pos.x, p.pos.z), lift = 1 + Math.min(1, sp / JET.max) * 0.5;
    if (this.y > w + 0.03) { this.vy -= JET.grav * dt; if (!this.air && this.vy < -0.4) { this.air = true; this.airT = 0; } if (this.air) this.airT += dt; }
    else {
      if (this.air && this.airT > 0.2) { g.audio.sfx('splashRemote'); g.engine.shake = Math.max(g.engine.shake || 0, Math.min(0.5, -this.vy * 0.05)); g.fx.splash(new THREE.Vector3(p.pos.x, WATER_Y, p.pos.z), Math.min(1.4, 0.5 - this.vy * 0.08)); }
      this.air = false; this.vy += (w - this.y) * 120 * lift * dt; this.vy *= Math.exp(-10 * dt);
    }
    this.y += this.vy * dt;
    if (this.y < w - 0.1) { this.y = w - 0.1; this.vy = Math.max(this.vy, 0); }
    // tilt with the water, nose up under power, lean into the turn
    const s = oceanSlope(p.pos.x, p.pos.z, 1.1), along = s.sx * fx + s.sz * fz, across = s.sx * fz - s.sz * fx;
    const wantP = (this.air ? -Math.atan2(this.vy, Math.max(5, sp)) * 0.8 : -Math.atan(along) ) - (f > 0 && !this.air ? 0.07 * (1 - sp / top) + 0.03 : 0);
    const wantR = Math.atan(across) * (this.air ? 0.4 : 1) - this.steer * Math.min(1, sp / 12) * 0.42;
    this.pitch += (wantP - this.pitch) * Math.min(1, dt * 6); this.roll += (wantR - this.roll) * Math.min(1, dt * 6);
    p.pos.y = this.y - JET.dip; p.baseY = p.pos.y; p.vy = 0; p.moving = false; p.target = null; p.dir.set(fx, 0, fz);
    const M = this.mesh; M.position.set(p.pos.x + fx * JET.back, p.pos.y, p.pos.z + fz * JET.back); M.rotation.order = 'YXZ'; M.rotation.set(this.pitch, p.yaw, this.roll);
    this.sound.set(0.2 + Math.min(1, sp / JET.max) * 0.75 * (f > 0 ? 1 : 0.55));
    if (!this.air && sp > 2) this.spray(dt, sp, fx, fz);
    g.engine.cam.target.set(p.pos.x, p.pos.y + 1, p.pos.z);
    if (this.v > 3 && performance.now() - (g.camDragAt || 0) > 1500) { let d = p.yaw + Math.PI - g.engine.cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); g.engine.cam.yaw += d * Math.min(1, dt * 2); }
    this.speed = sp;
    return true;
  }
  spray(dt, sp, fx, fz) {
    const g = this.game, p = g.player, ux = fz, uz = -fx, k = Math.min(1, sp / JET.max), y = WATER_Y + oceanWave(p.pos.x, p.pos.z) + 0.05;
    this.sprayT = (this.sprayT || 0) + dt * (30 + sp * 3.5);
    while (this.sprayT > 1) {
      this.sprayT -= 1;
      if (Math.random() < 0.6) { // the rooster tail, straight back from the nozzle
        const a = (Math.random() - 0.5) * 0.7; this.fx.puff(p.pos.x - fx * 1.1, y, p.pos.z - fz * 1.1, -fx * (1 + sp * 0.16) + ux * a, 1.2 + k * (2.4 + Math.random() * 2.4), -fz * (1 + sp * 0.16) + uz * a, 0.55 + Math.random() * 0.4, 0.26 + k * 0.28);
      } else { // a fan off each side of the bow
        const s = Math.random() < 0.5 ? -1 : 1, q = 0.1 + Math.random() * 1.2; this.fx.puff(p.pos.x + fx * q + ux * s * 0.6, y, p.pos.z + fz * q + uz * s * 0.6, ux * s * (1.2 + sp * 0.14) + fx * sp * 0.3, 0.8 + k * (1.1 + Math.random()), uz * s * (1.2 + sp * 0.14) + fz * sp * 0.3, 0.35 + Math.random() * 0.3, 0.2 + k * 0.18);
      }
    }
    this.ripT = (this.ripT || 0) - dt; if (this.ripT <= 0) { this.ripT = 0.16; g.engine.water?.ripple?.(p.pos.x - fx * 1.2, p.pos.z - fz * 1.2, 0.8); }
  }
  seat() { return this.on ? { h: JET.seat, yaw: this.game.player.yaw } : null; }
  contextActions() { return this.on ? [{ id: 'jet-off', label: 'Hop off the jet ski', color: 'green', fn: () => this.dismount() }] : []; }
  stateExtra() { const p = this.game.player; return this.on ? { js: [+p.pos.x.toFixed(1), +p.pos.z.toFixed(1), +p.yaw.toFixed(2), +p.pos.y.toFixed(2)] } : null; }
  update(dt = 1 / 60) {
    this.sprayFx?.update(dt, this.game.engine.renderer);
    const seen = new Set();
    for (const r of this.game.remotes?.list?.values?.() || []) {
      const s = r.peer?.state?.js; if (!Array.isArray(s)) continue;
      seen.add(r);
      let m = this.remote.get(r);
      if (!m) { m = mergedMesh('jetski'); this.game.engine.scene.add(m); this.remote.set(r, m); }
      m.position.set(s[0] + Math.sin(s[2]) * JET.back, s[3], s[1] + Math.cos(s[2]) * JET.back); m.rotation.y = s[2];
    }
    for (const [r, m] of this.remote) if (!seen.has(r)) { this.game.engine.scene.remove(m); this.remote.delete(r); }
  }
}
