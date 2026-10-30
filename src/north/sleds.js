// Frostmere: dog sleds. June's teams: six huskies in pairs on a gangline, the sled behind them, you on the runners.
//   - Drive one yourself: W to mush (faster), S to brake, A/D to steer the lead dogs. The team follows the leaders'
//     track and the sled follows the team, so it swings wide round corners like a real one.
//   - Hire a ride (June): the team runs one of the trails (geo.js SLED_ROUTES) to a far corner of the map on its own.
//   - The Sled Derby (src/north/races.js) uses a driven sled with checkpoints.
// Other anglers see your team too (a lighter copy follows the position you send, `sl` in your state).
import * as THREE from 'three';
import { mergedMesh } from './instancing.js';
import { DogPack } from './dogs.js';
import { toWorld, toLocal, inNorth, ICE_Y, kindAt, isOpen } from './geo.js';
import { blocked } from '../world/colliders.js';
import { walkY } from '../world/terrain.js';
import { northSfx } from './sounds.js';

const PAIR = 1.7, SLED_BACK = 1.5, RIDER_BACK = 1.55;

/** One team: dogs, gangline and sled, laid out along a breadcrumb track behind the lead pair. */
class Team {
  constructor(parent, groundAt, solo = false) {
    this.groundAt = groundAt; this.solo = solo; this.pairs = solo ? 1 : 3;
    this.group = new THREE.Group(); this.group.name = 'sled-team'; parent.add(this.group);
    this.sled = mergedMesh('hw_sled'); this.group.add(this.sled);
    this.pack = new DogPack(this.group, solo ? 1 : 6);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    this.line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#c8302a' })); this.line.frustumCulled = false; this.group.add(this.line);
    this.track = []; // lead positions, newest first: { x, z }
    this.visible = false; this.group.visible = false;
  }
  set show(v) { this.visible = v; this.group.visible = v; }
  reset(x, z, yaw) {
    this.track = [];
    for (let d = 0; d < 16; d += 0.25) this.track.push({ x: x - Math.sin(yaw) * d, z: z - Math.cos(yaw) * d });
  }
  push(x, z) {
    const h = this.track[0];
    if (!h || Math.hypot(h.x - x, h.z - z) > 0.25) { this.track.unshift({ x, z }); if (this.track.length > 120) this.track.pop(); }
  }
  /** A point d metres back along the track, and the direction of travel there. */
  at(d) {
    let acc = 0;
    for (let i = 0; i < this.track.length - 1; i++) {
      const a = this.track[i], b = this.track[i + 1], l = Math.hypot(a.x - b.x, a.z - b.z) || 1e-3;
      if (acc + l >= d) { const t = (d - acc) / l; return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(a.x - b.x, a.z - b.z) }; }
      acc += l;
    }
    const a = this.track[this.track.length - 1] || { x: 0, z: 0 }, b = this.track[this.track.length - 2] || a;
    return { x: a.x, z: a.z, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  /** Lay the dogs, the line and the sled out along the track. Returns the sled's pose. */
  layout(dt, speed) {
    const gait = speed > 7 ? 'run' : speed > 0.6 ? 'trot' : 'stand';
    const pos = this.line.geometry.attributes.position;
    let n = 0;
    for (let k = 0; k < this.pairs; k++) {
      const c = this.at(k * PAIR + 0.2), sx = Math.cos(c.yaw), sz = -Math.sin(c.yaw);
      for (let s = 0; s < (this.solo ? 1 : 2); s++) {
        const d = this.pack.dogs[k * 2 + s], side = this.solo ? 0 : s ? 0.38 : -0.38;
        d.x = c.x + sx * side; d.z = c.z + sz * side; d.y = this.groundAt(d.x, d.z) ?? ICE_Y; d.yaw = c.yaw; d.gait = gait;
      }
      pos.setXYZ(n++, c.x, (this.groundAt(c.x, c.z) ?? ICE_Y) + 0.62, c.z);
    }
    const sp = this.at(this.pairs * PAIR + SLED_BACK), sy = this.groundAt(sp.x, sp.z) ?? ICE_Y;
    const front = this.at(this.pairs * PAIR + 0.2);
    pos.setXYZ(n++, front.x, sy + 0.5, front.z);
    const nose = { x: sp.x + Math.sin(sp.yaw) * 1.4, z: sp.z + Math.cos(sp.yaw) * 1.4 };
    pos.setXYZ(n++, nose.x, sy + 0.32, nose.z);
    for (; n < 8; n++) pos.setXYZ(n, nose.x, sy + 0.32, nose.z);
    pos.needsUpdate = true;
    // the sled pitches with the ground under its runners
    const fy = this.groundAt(nose.x, nose.z) ?? sy, by = this.groundAt(sp.x - Math.sin(sp.yaw) * 1.2, sp.z - Math.cos(sp.yaw) * 1.2) ?? sy;
    this.sled.position.set(sp.x, sy, sp.z);
    this.sled.rotation.set(Math.atan2(by - fy, 2.6), sp.yaw, 0, 'YXZ');
    this.pack.update(dt);
    return { ...sp, y: sy };
  }
}

export class Sleds {
  constructor(north) {
    this.north = north; this.game = north.game;
    this.riding = null; // { mode: 'drive'|'hire'|'derby', team, lead: {x,z,yaw,v}, route, wp, onDone }
    this.teams = []; this.remote = new Map();
  }
  groundAt(x, z) { return this.north.groundAt(x, z); }
  openWater(x, z) { const [u, v] = toLocal(x, z); return isOpen(kindAt(u, v)); }
  /** v1.17.2: your one-dog sled, called up wherever you stand. */
  solo() {
    const g = this.game, p = g.player, y = p.yaw;
    if (this.riding) return;
    if (!this.soloTeam) this.soloTeam = new Team(this.north.world.group, (x, z) => this.groundAt(x, z), true);
    g.fishing.cancel(); this.north.skate?.set(false);
    const t = this.soloTeam; t.show = true;
    const lead = { x: p.pos.x + Math.sin(y) * (PAIR + SLED_BACK + 0.5), z: p.pos.z + Math.cos(y) * (PAIR + SLED_BACK + 0.5), yaw: y, v: 0 };
    t.reset(lead.x, lead.z, y);
    this.riding = { mode: 'solo', team: t, lead, route: null, wp: 1, onDone: null, t: 0, barkT: 1 };
    northSfx(g.audio, 'bark');
  }
  team() { const t = this.teams.find((q) => !q.visible) || (this.teams.push(new Team(this.north.world.group, (x, z) => this.groundAt(x, z))), this.teams[this.teams.length - 1]); return t; }

  /** Start a ride from the kennels' gate. mode: 'drive' | 'hire' | 'derby'. */
  start(mode, { route = null, onDone = null, at = null } = {}) {
    const g = this.game;
    if (this.riding) return;
    g.fishing.cancel(); this.north.skate?.set(false);
    const K = this.north.village.kennelCenter;
    const p0 = at || (route ? toWorld(route[1][0], route[1][1]) : { x: K.x + 4, z: K.z - 12 });
    const s = at || toWorld(route?.[0][0] ?? 150, route?.[0][1] ?? 158);
    const yaw = at?.yaw ?? Math.atan2(p0.x - s.x, p0.z - s.z);
    const team = this.team(); team.show = true;
    const lead = { x: s.x + Math.sin(yaw) * (3 * PAIR + SLED_BACK + 0.5), z: s.z + Math.cos(yaw) * (3 * PAIR + SLED_BACK + 0.5), yaw, v: 0 };
    team.reset(lead.x, lead.z, yaw);
    this.riding = { mode, team, lead, route: route ? route.map(([u, v]) => toWorld(u, v)) : null, wp: 1, onDone, t: 0, barkT: 1 };
    this.north.onEvent('sled', { mode });
    northSfx(g.audio, 'bark'); setTimeout(() => northSfx(g.audio, 'bark'), 300);
    if (mode === 'drive') g.ui.toast('Mush! W to speed up, S to brake, A and D to steer the lead dogs. E to step off any time.', { title: 'Dog sled', icon: 'star', ms: 6500 });
  }
  stop(quiet = false) {
    const R = this.riding; if (!R) return;
    const g = this.game, pl = g.player;
    R.team.show = false;
    this.riding = null;
    // step off beside the sled
    const sp = R.team.sled.position, side = { x: Math.cos(R.team.sled.rotation.y) * 1.4, z: -Math.sin(R.team.sled.rotation.y) * 1.4 };
    let x = sp.x + side.x, z = sp.z + side.z;
    if (walkY(x, z) == null || blocked(x, z, 0.3)) { x = sp.x - side.x; z = sp.z - side.z; }
    pl.pos.set(x, this.groundAt(x, z) ?? pl.pos.y, z); pl.baseY = pl.pos.y; pl.target = null;
    if (!quiet) g.audio.sfx('click');
    R.onDone?.(R);
  }
  /** Each frame while riding: returns true (the sled has the controls). */
  control(dt) {
    const R = this.riding; if (!R) return false;
    const g = this.game, pl = g.player, L = R.lead;
    R.t += dt;
    let steer = 0, want = 7;
    if (R.mode === 'hire') {
      // the team runs the route on its own
      const tgt = R.route[Math.min(R.wp, R.route.length - 1)];
      const dx = tgt.x - L.x, dz = tgt.z - L.z, dist = Math.hypot(dx, dz);
      if (dist < 6) { R.wp++; if (R.wp >= R.route.length) want = 0; }
      let d = Math.atan2(dx, dz) - L.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      steer = -Math.max(-1, Math.min(1, d * 2)); // (steer is screen-right: a smaller heading)
      want = R.wp >= R.route.length ? 0 : 11;
      if (R.wp >= R.route.length && L.v < 0.3) { this.arrive(); return true; }
    } else if (!g.ui.modalOpen) {
      const up = pl.held('up') || (pl.stick && -pl.stick.y > 0.3), down = pl.held('down') || (pl.stick && -pl.stick.y < -0.3);
      steer = (pl.held('right') ? 1 : 0) - (pl.held('left') ? 1 : 0) + (pl.stick ? pl.stick.x : 0);
      // (the camera looks back over the sled: steering is relative to the team's heading, so left is left)
      want = down ? 0 : R.mode === 'solo' ? (up ? 13 : 5) : up ? (pl.sprint ? 14 : 12) : R.mode === 'derby' ? 9 : 6;
      if (R.mode === 'derby' && R.t < (R.hold || 0)) want = 0; // (the countdown)
    }
    L.v += Math.max(-8, Math.min(3.2, want - L.v)) * dt * (want < L.v ? 1.6 : 1);
    L.yaw -= steer * dt * (0.6 + Math.min(1, L.v / 8) * 0.9);
    const nx = L.x + Math.sin(L.yaw) * L.v * dt, nz = L.z + Math.cos(L.yaw) * L.v * dt;
    const stuck = blocked(L.x, L.z, 0.45); // (started on top of a post or a lamp: let the team pull clear)
    const free = (x, z) => inNorth(x, z) && this.groundAt(x, z) != null && !this.north.holeAt(x, z) && (stuck || !blocked(x, z, 0.45)) && !this.openWater(x, z); // (sleds take the river banks that walkers can't)
    if (free(nx, nz)) { L.x = nx; L.z = nz; }
    else if (R.mode === 'hire') { L.x = nx; L.z = nz; } // (a hired team knows its trail: it never balks)
    else { L.v *= 0.2; L.yaw += (Math.random() < 0.5 ? -1 : 1) * 0.3; if (R.t - (R.bumpT || -9) > 1) { R.bumpT = R.t; northSfx(g.audio, 'bark'); } }
    R.team.push(L.x, L.z);
    const S = R.team.layout(dt, L.v);
    // you, on the runners behind the handlebar
    const rx = S.x - Math.sin(S.yaw) * RIDER_BACK, rz = S.z - Math.cos(S.yaw) * RIDER_BACK;
    pl.pos.set(rx, (this.groundAt(rx, rz) ?? S.y) + 0.12, rz); pl.baseY = pl.pos.y; pl.yaw = S.yaw; pl.moving = false; pl.target = null;
    g.engine.cam.target.set(rx, pl.pos.y + 0.9, rz);
    // the camera swings round behind the team
    let cd = (S.yaw + Math.PI) - g.engine.cam.yaw; cd = Math.atan2(Math.sin(cd), Math.cos(cd));
    if (L.v > 2) g.engine.cam.yaw += cd * Math.min(1, dt * 1.5);
    // snow off the runners, barks, the occasional howl
    if (L.v > 4 && Math.random() < dt * L.v * 1.5) g.fx.spawn(rx, pl.pos.y - 0.1, rz, (Math.random() - 0.5) * 1.5, 0.6 + Math.random(), (Math.random() - 0.5) * 1.5, '#f4f8fc', 0.6, -4);
    R.barkT -= dt; if (R.barkT <= 0) { R.barkT = 3 + Math.random() * 6; northSfx(g.audio, 'bark', { vol: 0.7 }); }
    R.speed = L.v;
    return true;
  }
  arrive() {
    const R = this.riding, g = this.game, name = R.routeName;
    this.stop(true);
    g.ui.toast(`${name ? `${name[0].toUpperCase()}${name.slice(1)}` : 'Here we are'}! June's team trots home on its own. Hire another ride at the kennels.`, { title: 'Dog sled', icon: 'star', ms: 5000 });
  }
  hire(routeKey, route) {
    this.start('hire', { route: route.pts });
    this.riding.routeName = route.name;
    this.north.onEvent('hire', { route: routeKey });
  }
  contextActions() {
    const R = this.riding;
    if (!R) return [];
    if (R.mode === 'hire') return [{ id: 'sled-hop', label: 'Hop off here', fn: () => this.stop() }];
    // (any time, at any speed: the team pulls up and you hop off; in the Derby it calls the race off)
    return [{ id: 'sled-off', label: R.mode === 'derby' ? 'Quit the race and step off' : 'Step off the sled', color: 'green', fn: () => { if (R.mode === 'derby') this.north.races?.abort(); this.stop(); } }];
  }
  /** What other anglers need to draw your team: the lead's position and heading. */
  stateExtra() { const R = this.riding; return R ? { sl: [+R.lead.x.toFixed(1), +R.lead.z.toFixed(1), +R.lead.yaw.toFixed(2), +R.lead.v.toFixed(1)] } : null; }
  /** Other anglers' teams, from their `sl` state. */
  updateRemotes(dt) {
    const seen = new Set();
    for (const r of this.game.remotes?.list?.values?.() || []) {
      const sl = r.peer?.state?.sl; if (!Array.isArray(sl) || !inNorth(sl[0], sl[1])) continue;
      seen.add(r);
      let t = this.remote.get(r);
      if (!t) { t = this.team(); t.show = true; t.reset(sl[0], sl[1], sl[2]); this.remote.set(r, t); }
      t.push(sl[0], sl[1]); t.layout(dt, sl[3] || 0);
    }
    for (const [r, t] of this.remote) if (!seen.has(r)) { t.show = false; this.remote.delete(r); }
  }
  update(dt) { if (this.north.here) this.updateRemotes(dt); }
}
export { toLocal };
