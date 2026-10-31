// Frostmere (v1.17.2): the chairlifts. Two lines, one system: Skyline's short lift up the hill, and the Ring Line, a chairlift
// right round the map with five stations. Chairs never stop: each rope is a closed loop with chairs spaced along it, and you
// wait on the platform and get on the next real chair as it comes through. The Ring has two ropes, one each way round (the two
// arms of every pylon), and you go whichever way is shorter. Chairs always face the way they're going.
import * as THREE from 'three';
import { toWorld, toLocal, P, RING, RING_STOPS } from './geo.js';
import { instanced } from './instancing.js';
import { polyforkModel, placeModels } from '../world/polyfork.js';
import { natureMaterial } from '../world/nature.js';
import { addCircle } from '../world/colliders.js';
import { signBoard } from './plane.js';

const ROPE_Y = 8, ARM = 1.84, SEAT_DROP = 4, HOP = 0.55; // (rope height above the ground, half the rope spacing, seat below the rope)
const NEAR = 240; // chairs are only drawn this close to you
const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1), hide = new THREE.Matrix4().makeScale(0, 0, 0), pv = new THREE.Vector3();

/** A closed rope through nodes [{x, y, z}], with n chairs moving along it. */
class Rope {
  constructor(parent, nodes, n, speed, chairGeo, mat) {
    this.nodes = nodes; this.speed = speed; this.n = n; this.cum = [0];
    for (let i = 0; i < nodes.length; i++) { const a = nodes[i], b = nodes[(i + 1) % nodes.length]; this.cum.push(this.cum[i] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)); }
    this.len = this.cum[nodes.length];
    this.mesh = new THREE.InstancedMesh(chairGeo, mat, n); this.mesh.frustumCulled = false; this.mesh.castShadow = true; parent.add(this.mesh);
    const pts = []; nodes.forEach((a, i) => { const b = nodes[(i + 1) % nodes.length]; pts.push(new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)); });
    parent.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#2c3036' })));
    this.t = 0; this.seg = 0;
  }
  /** Position on the rope at distance s, and the heading there. */
  at(s, out) {
    s = ((s % this.len) + this.len) % this.len;
    let i = this.seg; const c = this.cum;
    if (!(s >= c[i] && s < c[i + 1])) { let lo = 0, hi = c.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c[m] <= s) lo = m; else hi = m - 1; } i = lo; }
    const a = this.nodes[i], b = this.nodes[(i + 1) % this.nodes.length], k = (s - c[i]) / Math.max(1e-3, c[i + 1] - c[i]);
    out.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
    return Math.atan2(b.x - a.x, b.z - a.z);
  }
  chairS(i) { return (this.t * this.speed + i * this.len / this.n) % this.len; }
  nearest(s, tol) { // a chair within tol metres before s
    for (let i = 0; i < this.n; i++) { const gap = ((s - this.chairS(i)) % this.len + this.len) % this.len; if (gap < tol) return i; }
    return -1;
  }
  sNear(x, z) { let best = 0, bd = 1e12; for (let s = 0; s < this.len; s += 2) { this.at(s, pv); const d = (pv.x - x) ** 2 + (pv.z - z) ** 2; if (d < bd) { bd = d; best = s; } } return best; }
  draw(me) {
    for (let i = 0; i < this.n; i++) {
      const yaw = this.at(this.chairS(i), pv);
      if (Math.abs(pv.x - me.x) > NEAR || Math.abs(pv.z - me.z) > NEAR) { this.mesh.setMatrixAt(i, hide); continue; }
      pv.y -= ROPE_Y; q.setFromAxisAngle(up, yaw); m4.compose(pv, q, one); this.mesh.setMatrixAt(i, m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Lifts {
  constructor(north) { this.north = north; this.game = north.game; this.ride = null; this.stops = []; this.ropes = []; }
  ground(x, z) { return this.north.groundAt(x, z) ?? 3; }
  build(group) {
    const G = new THREE.Group(); G.name = 'north-lifts'; group.add(G);
    this.ringGeo = new THREE.RingGeometry(1.1, 1.4, 28).rotateX(-Math.PI / 2); this.ringMat = new THREE.MeshBasicMaterial({ color: '#ffd080', transparent: true, opacity: 0.6, depthWrite: false });
    const chair = polyforkModel('chairlift-chair').body, mat = natureMaterial(), node = (x, z) => ({ x, z, y: this.ground(x, z) + ROPE_Y });
    // ---- the Ring Line: a smooth closed path through RING, pylons about every 60 m
    const curve = new THREE.CatmullRomCurve3(RING.map(([u, v]) => { const w = toWorld(u, v); return new THREE.Vector3(w.x, 0, w.z); }), true, 'centripetal');
    const L = curve.getLength(), n = Math.round(L / 60), sts = RING_STOPS.map((st) => { const w = toWorld(st.u, st.v); let best = 0, bd = 1e12; for (let i = 0; i < 2000; i++) { const p = curve.getPointAt(i / 2000); const d = (p.x - w.x) ** 2 + (p.z - w.z) ** 2; if (d < bd) { bd = d; best = i / 2000; } } return { ...st, k: best }; });
    const samples = []; for (let i = 0; i < n; i++) { const k = i / n; if (sts.every((st) => Math.min(Math.abs(k - st.k), 1 - Math.abs(k - st.k)) * L > 26)) samples.push(k); }
    for (const st of sts) samples.push(st.k);
    samples.sort((a, b) => a - b);
    const frames = samples.map((k) => { const p = curve.getPointAt(k), t = curve.getTangentAt(k); return { k, x: p.x, z: p.z, yaw: Math.atan2(t.x, t.z), sx: t.z, sz: -t.x }; });
    const fw = frames.map((f) => node(f.x + f.sx * ARM, f.z + f.sz * ARM)), bk = frames.map((f) => node(f.x - f.sx * ARM, f.z - f.sz * ARM)).reverse();
    // (both ropes hang level with each other at a pylon)
    frames.forEach((f, i) => { const y = this.ground(f.x, f.z) + ROPE_Y; fw[i].y = y; bk[frames.length - 1 - i].y = y; });
    const chairs = Math.round(L / 90);
    const A = new Rope(G, fw, chairs, 14, chair, mat), B = new Rope(G, bk, chairs, 14, chair, mat); this.ropes.push(A, B);
    const pylons = frames.filter((f) => sts.every((st) => st.k !== f.k)).map((f) => ({ x: f.x, z: f.z, y: this.ground(f.x, f.z) - 0.1, ry: f.yaw + Math.PI / 2 }));
    instanced(G, 'lift-pylon', pylons, { cells: 8, half: 400, cx: -3000, cz: 0, shadow: true });
    for (const f of pylons) addCircle(f.x, f.z, 1);
    const stationItems = [];
    for (const st of sts) {
      const f = frames.find((q2) => q2.k === st.k), y = this.ground(f.x, f.z) - 0.05;
      stationItems.push({ m: 'ski-lift-base-station', x: f.x, z: f.z, ry: f.yaw + Math.PI / 2, y });
      const landX = f.x + f.sx * 8.5, landZ = f.z + f.sz * 8.5;
      this.stops.push({ id: st.id, name: st.name, line: 'ring', x: landX, z: landZ, ropes: [[A, A.sNear(f.x, f.z)], [B, B.sNear(f.x, f.z)]] });
      // a sign you can see from a way off, and a glowing ring where you wait
      const gy = this.ground(landX, landZ), yw = f.yaw, sx = landX + Math.sin(yw) * 2.4, sz = landZ + Math.cos(yw) * 2.4, board = signBoard(`RING LINE: ${st.name.toUpperCase()}`, 3.4, 0.5, { bg: '#2c4060', fg: '#f4f0e8', edge: '#e8a030' });
      board.position.set(sx, gy + 3, sz); board.rotation.y = Math.atan2(f.sx, f.sz); G.add(board);
      const board2 = board.clone(); board2.rotation.y += Math.PI; board2.position.x -= f.sx * 0.03; board2.position.z -= f.sz * 0.03; G.add(board2); // (it reads from both sides)
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3, 0.14), new THREE.MeshLambertMaterial({ color: '#3a3f46' })); post.position.set(sx, gy + 1.5, sz - 0.0); post.position.x -= Math.sin(board.rotation.y) * 0.05; post.position.z -= Math.cos(board.rotation.y) * 0.05; G.add(post); addCircle(sx, sz, 0.15);
      const rg = new THREE.Mesh(this.ringGeo, this.ringMat); rg.position.set(landX, gy + 0.08, landZ); G.add(rg);
    }
    G.add(placeModels('north-ring-stations', stationItems));
    // ---- Skyline's lift: up one arm of the pylons and down the other, round the wheels at each end
    const S = toWorld(P.skyline.u, P.skyline.v), T = toWorld(P.summit.u, P.summit.v - 2), yaw = Math.atan2(T.x - S.x, T.z - S.z), sx = Math.cos(yaw), sz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
    const span = [0, 0.25, 0.5, 0.75, 1].map((k) => ({ x: S.x + (T.x - S.x) * k, z: S.z + (T.z - S.z) * k }));
    const sky = [...span.map((p) => node(p.x + sx * ARM, p.z + sz * ARM)), node(T.x + fx * ARM, T.z + fz * ARM), ...[...span].reverse().map((p) => node(p.x - sx * ARM, p.z - sz * ARM)), node(S.x - fx * ARM, S.z - fz * ARM)];
    span.forEach((p, i) => { const y = this.ground(p.x, p.z) + ROPE_Y; sky[i].y = y; sky[sky.length - 2 - i].y = y; });
    const R = new Rope(G, sky, 8, 3.6, chair, mat); this.ropes.push(R);
    const base = { x: S.x, z: S.z + 7.5 }, top = { x: T.x - 2, z: T.z - 5.5 };
    this.stops.push({ id: 'skybase', name: 'Skyline Base', line: 'sky', ...base, ropes: [[R, 0]] }, { id: 'skytop', name: 'Skyline Summit', line: 'sky', ...top, ropes: [[R, R.cum[6]]] });
  }
  update(dt) {
    const me = this.game.player.pos;
    for (const r of this.ropes) { r.t += dt; r.draw(me); }
    const b = this.ride; if (b) this.step(dt);
  }
  /** Board at `from`, for `to`: the shorter way round, changing at Skyline between the Ring Line and the summit lift if need be. */
  board(from, to) {
    const hub = (line) => this.stops.find((s) => s.id === (line === 'ring' ? 'sky' : 'skybase'));
    this.north.sno.dismount();
    if (from.line !== to.line) {
      const out = hub(from.line), into = hub(to.line);
      if (from === out) { this.leg(into, to, null, from); return; }
      this.leg(from, out, [into, to]); return;
    }
    this.leg(from, to, null);
  }
  leg(from, to, next, walkFrom = null) {
    let best = null;
    for (const [r, s] of from.ropes) { const e = to.ropes.find(([q2]) => q2 === r); if (!e) continue; const d = ((e[1] - s) % r.len + r.len) % r.len; if (!best || d < best.d) best = { r, s, d, end: e[1] }; }
    this.ride = { phase: 'wait', ...best, to, next, chair: -1, walkFrom };
    if (!next || !walkFrom) this.game.ui.toast(`Next chair for ${(next ? next[1] : to).name} coming up.`, { title: 'Chairlift', icon: 'star', ms: 3000 });
  }
  /** The next station ahead on your rope, if it isn't already where you're getting off. */
  nextStop() {
    const R = this.ride; if (!R || R.phase !== 'ride') return null;
    let best = null, bd = 1e9;
    for (const s of this.stops) for (const [r, at] of s.ropes) { if (r !== R.r) continue; const gap = ((at - R.s) % r.len + r.len) % r.len; if (gap > R.done + 8 && gap < bd) { bd = gap; best = s; } }
    return best && best !== R.to ? { s: best, d: bd } : null;
  }
  step(dt) {
    const R = this.ride, g = this.game, p = g.player, r = R.r;
    if (R.phase === 'wait') {
      const i = r.nearest(R.s, 1.4 * r.speed * Math.max(dt, 1 / 30));
      if (i >= 0) { R.chair = i; R.phase = 'on'; R.k = 0; R.from = p.pos.clone(); R.done = 0; { const q = new THREE.Vector3(); r.at(r.chairS(i), q); R.hop = Math.max(HOP, Math.hypot(q.x - p.pos.x, q.z - p.pos.z) / 5); } g.audio.sfx('creak'); }
      return;
    }
    const yaw = r.at(r.chairS(R.chair), pv), seatY = pv.y - SEAT_DROP;
    if (R.phase === 'on') {
      R.k = Math.min(1, R.k + dt / R.hop); const e = R.k * R.k * (3 - 2 * R.k);
      p.pos.set(R.from.x + (pv.x - R.from.x) * e, R.from.y + (seatY - R.from.y) * e, R.from.z + (pv.z - R.from.z) * e);
      if (R.k >= 1) R.phase = 'ride';
    } else if (R.phase === 'ride') {
      R.done += r.speed * dt;
      p.pos.set(pv.x, seatY, pv.z);
      if (R.done >= R.d) { R.phase = 'off'; R.k = 0; R.from = p.pos.clone(); }
    } else {
      R.k = Math.min(1, R.k + dt / HOP); const e = R.k * R.k * (3 - 2 * R.k), to = R.to, y = this.ground(to.x, to.z);
      p.pos.set(R.from.x + (to.x - R.from.x) * e, R.from.y + (y - R.from.y) * e, R.from.z + (to.z - R.from.z) * e);
      if (R.k >= 1) { this.ride = null; p.baseY = y; p.vy = 0; g.engine.cam.target.set(to.x, y + 0.8, to.z); if (R.next) { this.leg(R.next[0], R.next[1], null, to); return; } if (to.line === 'ring') g.ui.toast(`${to.name}.`, { title: 'Ring Line', icon: 'star' }); else if (to.id === 'skytop') { g.ext.change((d) => { d.north.summit = 1; }); g.reward('north', 'summit', { coins: 200, xp: 200 }, 'Skyline Summit'); } return; }
    }
    p.baseY = p.pos.y; p.vy = 0; p.yaw = yaw; p.moving = false; p.target = null;
    g.engine.cam.target.set(p.pos.x, p.pos.y + 1.2, p.pos.z);
  }
  /** Riding (or hopping on or off): the lift has the controls. */
  control() { return !!this.ride && this.ride.phase !== 'wait'; }
  seat() { return this.ride && this.ride.phase !== 'wait' ? { h: 0.8, yaw: this.game.player.yaw } : null; }
  menu(stop) {
    const g = this.game, others = this.stops.filter((s) => s !== stop && s.id !== (stop.id === 'sky' ? 'skybase' : stop.id === 'skybase' ? 'sky' : ''));
    g.dialogue.open({ npc: { name: 'Ring Line', title: 'Chairlift station', look: null, pos: new THREE.Vector3(stop.x + 1.2, g.player.pos.y, stop.z), actor: { headWorld: (v) => v.set(stop.x + 1.2, g.player.pos.y + 1.6, stop.z) } }, title: `${stop.name} station`, text: 'The chairs run right round the map, and up to Skyline Summit. Where to?', choices: [...others.map((s) => ({ label: s.label || s.name, fn: () => setTimeout(() => this.board(stop, s), 150) })), { label: 'Not now' }] });
  }
  contextActions() {
    const me = this.game.player.pos, out = [];
    const R = this.ride;
    if (R) {
      if (R.phase === 'wait') return [{ id: 'lift-wait', label: 'Step back from the line', fn: () => { this.ride = null; } }];
      const n = this.nextStop();
      return n ? [{ id: 'lift-next', label: `Get off at ${n.s.label || n.s.name}`, color: 'gold', fn: () => { R.d = n.d; R.to = n.s; R.next = null; this.game.ui.toast(`Getting off at ${n.s.label || n.s.name}.`, { title: 'Chairlift', icon: 'star' }); } }] : [];
    }
    for (const s of this.stops) if (Math.hypot(s.x - me.x, s.z - me.z) < 5) out.push({ id: s.line === 'ring' ? `ring-${s.id}` : s.id === 'skybase' ? 'lift' : 'lift-down', label: 'Ride the chairlift', color: 'gold', fn: () => this.menu(s) });
    return out;
  }
}
export { toLocal };
