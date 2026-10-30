// Frostmere (v1.17.2): Skyline, a little ski hill on the south range. Ride the chairlift (src/north/lifts.js) up to the summit lodge, take a
// toboggan down (A/D to steer, the hill does the rest), race the snowmobile up the Hill Climb, or send it off the Big Air Jump.
// The Hill Climb, toboggan and jump each have a board (src/north/boards.js).
import * as THREE from 'three';
import { toWorld, P, JUMP } from './geo.js';
import { SKYLINE, JUMP_PIECES, buildSite } from './sites.js';
import { polyforkModel } from '../world/polyfork.js';
import { natureMaterial } from '../world/nature.js';
import { blocked } from '../world/colliders.js';
import { northSfx } from './sounds.js';

const GRAV = 9;

export class Resort {
  constructor(north) { this.north = north; this.game = north.game; this.sledRun = null; this.climb = null; this.jump = null; }
  ground(x, z) { return this.north.groundAt(x, z) ?? 0; }
  build(group) {
    const G = this.group = new THREE.Group(); G.name = 'north-resort'; group.add(G);
    const g = (x, z) => this.ground(x, z);
    buildSite(G, 'north-skyline', SKYLINE, g);
    buildSite(G, 'north-bigair', JUMP_PIECES, g);
    const S = toWorld(P.skyline.u, P.skyline.v), T = toWorld(P.summit.u, P.summit.v), J = toWorld(JUMP.u, JUMP.v);
    this.climbStart = { x: S.x + 9, z: S.z + 9 }; this.toTop = { x: T.x + 10, z: T.z - 14 }; this.jumpLip = J;
    this.tob = new THREE.Mesh(polyforkModel('wooden-toboggan').body, natureMaterial()); this.tob.visible = false; this.tob.scale.setScalar(1.6); this.tob.castShadow = true; G.add(this.tob);
  }
  update(dt, t) {
    this.group.visible = Math.hypot(this.toTop.x - this.game.player.pos.x, this.toTop.z - this.game.player.pos.z) < 300;
    if (this.climb) { this.climb.t += dt; const me = this.game.player.pos; if (this.north.sno.on && Math.hypot(me.x - this.toTop.x, me.z - this.toTop.z) < 16) this.finishClimb(); else if (!this.north.sno.on) { this.climb = null; this.game.ui.toast('Hill Climb called off.', { icon: 'star' }); } }
  }
  /** While the lift or the toboggan has you. */
  control(dt) {
    const R = this.sledRun, g = this.game, p = g.player;
    if (!R) return false;
    R.t += dt;
    const r = (p.held('right') ? 1 : 0) - (p.held('left') ? 1 : 0) + (p.stick?.x || 0);
    const gr = (x, z) => this.ground(x, z), fx = Math.sin(R.yaw), fz = Math.cos(R.yaw), y0 = gr(p.pos.x, p.pos.z), slope = (y0 - gr(p.pos.x + fx * 1.5, p.pos.z + fz * 1.5)) / 1.5;
    R.v = Math.max(0, Math.min(19, R.v + (slope * GRAV - 0.8 - R.v * 0.04) * dt));
    R.yaw -= r * 1.2 * dt;
    if (!r) R.yaw += Math.atan2(Math.sin(Math.PI - R.yaw), Math.cos(Math.PI - R.yaw)) * Math.min(1, dt * 0.7); // (left alone, a toboggan finds the fall line)
    const nx = p.pos.x + Math.sin(R.yaw) * R.v * dt, nz = p.pos.z + Math.cos(R.yaw) * R.v * dt;
    if (blocked(nx, nz, 0.5)) { R.v *= 0.3; R.yaw += Math.PI * 0.35; g.audio.sfx('flop'); } else { p.pos.x = nx; p.pos.z = nz; }
    const y = gr(p.pos.x, p.pos.z);
    p.pos.y = y + 0.3; p.baseY = p.pos.y; p.yaw = R.yaw; p.moving = false; p.target = null;
    this.tob.position.set(p.pos.x, y, p.pos.z); this.tob.rotation.y = R.yaw;
    if (R.v > 3 && Math.random() < dt * R.v) g.fx.spawn(p.pos.x, y + 0.1, p.pos.z, (Math.random() - 0.5) * 1.5, 0.7 + Math.random(), (Math.random() - 0.5) * 1.5, '#f4f8fc', 0.6, -4);
    g.engine.cam.target.set(p.pos.x, p.pos.y + 0.8, p.pos.z);
    { let d = R.yaw + Math.PI - g.engine.cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); g.engine.cam.yaw += d * Math.min(1, dt * 2); }
    if ((R.v < 0.4 && R.t > 3 && slope < 0.1) || R.t > 60) this.endToboggan();
    return true;
  }
  endToboggan() {
    const R = this.sledRun, g = this.game, p = g.player; if (!R) return;
    this.sledRun = null; this.tob.visible = false; p.baseY = p.pos.y = this.ground(p.pos.x, p.pos.z);
    const down = this.toTop.z - p.pos.z; // (the summit is at the high-v end: distance down the hill)
    if (down > 45) { const t = +R.t.toFixed(1); this.north.boards.post('toboggan', t); g.ui.toast(`${t} seconds, summit to the bottom.`, { title: 'Toboggan run', icon: 'trophy' }); g.reward('north', 'toboggan', { coins: 150, xp: 120 }, 'Your first toboggan run'); }
  }
  startToboggan() {
    const g = this.game, p = g.player, q = this.toTop;
    this.north.sno.dismount();
    p.pos.set(q.x, this.ground(q.x, q.z) + 0.3, q.z); this.sledRun = { t: 0, v: 4, yaw: Math.PI }; this.tob.visible = true;
    g.ui.toast('A and D to steer. Hold on!', { title: 'Toboggan', icon: 'star', ms: 3500 });
  }
  startClimb() {
    const g = this.game, N = this.north, p = g.player, q = this.climbStart;
    if (!N.sno.owned) { g.ui.toast('You need a snowmobile for the Hill Climb. Pell sells them.', { icon: 'lock' }); return; }
    p.pos.set(q.x, this.ground(q.x, q.z), q.z); p.yaw = 0;
    if (!N.sno.on) N.sno.mount();
    N.sno.y = this.ground(q.x, q.z); N.sno.v = 0;
    this.climb = { t: 0 }; northSfx(g.audio, 'bell', { vol: 0.7 });
    g.ui.toast('Go! First to the summit gate.', { title: 'Hill Climb', icon: 'trophy', ms: 3000 });
  }
  finishClimb() {
    const g = this.game, t = +this.climb.t.toFixed(1); this.climb = null;
    northSfx(g.audio, 'bell', { vol: 0.9 }); this.north.boards.post('climb', t);
    g.ui.toast(`${t} seconds to the summit.`, { title: 'Hill Climb', icon: 'trophy', ms: 5000 });
    g.reward('north', 'hillclimb', { coins: 300, xp: 250 }, 'The Hill Climb');
  }
  tookOff(at) { this.jump = Math.hypot(at.x - this.jumpLip.x, at.z - this.jumpLip.z) < 16 ? { x: at.x, z: at.z } : null; }
  landed(air, at) {
    const J = this.jump; this.jump = null;
    if (!J) return;
    const d = +Math.hypot(at.x - J.x, at.z - J.z).toFixed(1), g = this.game;
    if (d < 8) return;
    this.north.boards.post('air', d);
    g.ui.toast(`${d} m, ${air.toFixed(1)} s in the air!`, { title: 'Big Air', icon: 'trophy', ms: 4500 });
    if (d >= 30) g.reward('north', 'bigair', { coins: 500, xp: 350, pearls: 3 }, 'Big Air: 30 metres');
  }
  contextActions() {
    const me = this.game.player.pos, near = (q, r) => Math.hypot(q.x - me.x, q.z - me.z) < r, out = [];
    if (near(this.toTop, 4)) out.push({ id: 'toboggan', label: 'Take a toboggan down', color: 'gold', fn: () => this.startToboggan() });
    if (near(this.climbStart, 4) && !this.climb) out.push({ id: 'hillclimb', label: 'Start the Hill Climb', color: 'gold', fn: () => this.startClimb() });
    return out;
  }
}
