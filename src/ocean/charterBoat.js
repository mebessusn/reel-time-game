// Open Waters: Captain Marlowe's charter boat. A 15 m sportfisher with a cockpit for four, a fighting chair, side
// decks up to the bow, and a flybridge where Marlowe stands at the wheel.
//
// Where it is comes from the charter's shared course (where it left from, where it's going, and when it left, by
// the wall clock), so every angler aboard sees it in the same place. How it moves comes from the sea under it:
// it heaves, pitches and rolls on the waves from waves.js, gently on a clear day and hard in a storm.
//
// Local frame: x to starboard, y up from the still waterline, z toward the bow (the model in art/src/charter.py).
import * as THREE from 'three';
import { CHARTER_MATS, CHARTER_NODES } from '../data/charterMesh.js';
import { buildNode } from './meshes.js';
import { oceanWave, SEA } from './waves.js';
import { ROUTE_ISLES } from './geo.js';
const V3 = new THREE.Vector3();

const WATER_Y = 0.85;
export const BOAT = {
  Z0: -7.4, Z1: 7.6, cockpitY: 1.2, chair: { x: 0, z: -4.9 }, helm: { x: 0.35, y: 2.95, z: 1.2 },
  speed: 11, // cruising, m/s (about 21 knots)
  // four seats besides the fighting chair: the transom bench (two places) and two on the foredeck, facing the bow.
  // y: the deck under the seat; h: the seat's height above it.
  seats: [{ id: 'tL', x: -0.7, z: -6.85, y: 1.2, h: 0.42, yaw: 0 }, { id: 'tR', x: 0.7, z: -6.85, y: 1.2, h: 0.42, yaw: 0 },
    { id: 'bL', x: -0.5, z: 5.1, y: 1.66, h: 0.28, yaw: 0, bow: true }, { id: 'bR', x: 0.5, z: 5.1, y: 1.66, h: 0.28, yaw: 0, bow: true }],
  rail: 0.18, // how close to the bulwarks you can stand
};
export function halfBeam(z) {
  if (z <= 0) return 2.25 + 0.08 * (1 - (z / BOAT.Z0) ** 2);
  return Math.max(0.06, 2.33 * (1 - (z / BOAT.Z1) ** 1.9));
}
export function deckYLocal(z) {
  if (z < -2.3) return 1.2;
  if (z < -1.8) return 1.2 + ((z + 2.3) / 0.5) * 0.3;
  return 1.5 + 0.25 * Math.max(0, z / BOAT.Z1);
}
/** Deck height at a local point, or null where you can't stand (overboard, inside the salon, the chair's post). */
export function deckAtLocal(x, z) {
  if (z < -7.15 || z > 6.9) return null;
  const hb = halfBeam(z) - 0.12 - BOAT.rail;
  if (Math.abs(x) > hb) return null;
  if (z > -2.25 && z < 3.45 && Math.abs(x) < 1.66) return null; // the salon
  if (Math.hypot(x - BOAT.chair.x, z - BOAT.chair.z) < 0.42) return null; // the chair's pedestal
  if (z < -2.25 && Math.abs(x - 1.55) < 0.56 && Math.abs(z + 2.6) < 0.36) return null; // bait station
  if (Math.abs(x + 1.55) < 0.4 && Math.abs(z + 3.3) < 0.36) return null; // cooler
  if (z < -6.62 && Math.abs(x) < 1.62) return null; // the transom bench
  for (const st of BOAT.seats) if (st.bow && Math.abs(x - st.x) < 0.36 && Math.abs(z - st.z) < 0.36) return null; // the bow seats
  return deckYLocal(z);
}

// ---------------------------------------------------------------- the course
/** A route from a to b that steers around the islands (and their reefs). */
export function route(a, b) {
  const pts = [a];
  let from = a;
  for (let guard = 0; guard < 4; guard++) {
    let hit = null, hitT = 1;
    for (const I of ROUTE_ISLES()) {
      const R = Math.max(I.r, I.rz) + I.shelf * 0.6;
      const dx = b.x - from.x, dz = b.z - from.z, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((I.x - from.x) * dx + (I.z - from.z) * dz) / L2));
      const px = from.x + dx * t, pz = from.z + dz * t;
      if (Math.hypot(px - I.x, pz - I.z) < R && t < hitT && t > 0.02 && t < 0.98) { hit = { I, R, px, pz }; hitT = t; }
    }
    if (!hit) break;
    // swing wide on the side the line already passes
    let ox = hit.px - hit.I.x, oz = hit.pz - hit.I.z;
    const ol = Math.hypot(ox, oz) || 1;
    if (ol < 1) { ox = -(b.z - from.z); oz = b.x - from.x; }
    const k = (hit.R + 25) / (Math.hypot(ox, oz) || 1);
    const w = { x: hit.I.x + ox * k, z: hit.I.z + oz * k };
    pts.push(w); from = w;
  }
  pts.push(b);
  return pts;
}
/** v1.15 fix: a course into or out of an island jetty. In: line up well out to sea and come straight in along the
 *  jetty (bow to the beach, ending where she ties up). Out: pull away from the jetty and swing round before heading off.
 *  dock: the jetty (geo.js DOCKS) at either end, or null. */
export function dockRoute(a, b, fromDock = null, toDock = null) {
  const out = (D, k, side = 0) => ({ x: D.moor.x + D.ux * k + D.side.x * side, z: D.moor.z + D.uz * k + D.side.z * side });
  const head = fromDock ? [a, out(fromDock, 10, 9), out(fromDock, 38, 6)] : [a];
  const tail = toDock ? [out(toDock, 45, 0), out(toDock, 22, 0), b] : [b];
  const mid = route(head[head.length - 1], tail[0]);
  return [...head, ...mid.slice(1, -1), ...tail].filter((p, i, all) => i === 0 || Math.hypot(p.x - all[i - 1].x, p.z - all[i - 1].z) > 0.5);
}
/** Where on a route s metres along puts you (clamped). */
function pointAt(pts, s) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    if (acc + seg >= s || i === pts.length - 1) { const k = seg ? Math.max(0, Math.min(1, (s - acc) / seg)) : 0; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * k }; }
    acc += seg;
  }
  return pts[pts.length - 1];
}
function routeLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return L; }

/** Where a course puts the boat at wall time `now` (ms): { x, z, yaw, moving, arrived, speed }. */
export function coursePose(course, now = Date.now()) {
  const { pts, dep, anchorYaw } = course;
  const L = course.len ?? (course.len = routeLen(pts));
  const t = Math.max(0, (now - dep) / 1000);
  // ease out of the mooring and into the anchorage: accelerate over 25 m, slow over the last 40 m
  const V = course.speed || BOAT.speed, ACC = V * V / (2 * 25), DEC = V * V / (2 * 40); // (v1.15.13: an owner's faster engine sets course.speed)
  const tA = V / ACC, tD = V / DEC, dA = 25, dD = 40;
  let s, v;
  const cruiseD = Math.max(0, L - dA - dD), tC = cruiseD / V;
  if (L < dA + dD) { s = Math.min(L, 0.5 * (V / 4) * t); v = V / 4; if (s >= L) v = 0; } // a short hop
  else if (t < tA) { s = 0.5 * ACC * t * t; v = ACC * t; }
  else if (t < tA + tC) { s = dA + V * (t - tA); v = V; }
  else if (t < tA + tC + tD) { const u = t - tA - tC; s = dA + cruiseD + V * u - 0.5 * DEC * u * u; v = V - DEC * u; }
  else { s = L; v = 0; }
  s = Math.min(L, s);
  let i = 1, acc = 0;
  for (; i < pts.length; i++) { const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); if (acc + seg >= s || i === pts.length - 1) break; acc += seg; }
  const a = pts[i - 1], b = pts[i];
  const seg = Math.hypot(b.x - a.x, b.z - a.z) || 1, k = Math.min(1, (s - acc) / seg);
  const x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k;
  const arrived = s >= L - 0.01;
  let yaw = Math.atan2(b.x - a.x, b.z - a.z);
  // turn smoothly through the corners: the heading is the chord from 7 m behind to 7 m ahead along the route
  if (L > 2) { const p0 = pointAt(pts, Math.max(0, s - 7)), p1 = pointAt(pts, Math.min(L, s + 7)); if (Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.5) yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z); }
  // leaving a jetty: swing from the moored heading over the first 18 m
  if (course.startYaw != null && s < 18) { const u = s / 18, k = u * u * (3 - 2 * u); let d = yaw - course.startYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw = course.startYaw + d * k; }
  if (arrived || L < 1) {
    // at anchor: bow into the swell, swinging slowly on the anchor line (moored to a jetty: tied up, no swing)
    const T = now / 1000;
    yaw = course.fixedYaw ?? anchorYaw + Math.sin(T * 0.031) * 0.12 + Math.sin(T * 0.0127 + 1.7) * 0.08;
    if (L >= 1 && !course.settled) { course.settled = true; course.arriveYaw = Math.atan2(b.x - a.x, b.z - a.z); }
    if (L >= 1 && t < tA + tC + tD + 20) { // swing round to the anchor heading over 20 s
      const u = Math.min(1, (t - tA - tC - tD) / 20), ay = course.arriveYaw ?? yaw;
      let d = yaw - ay; d = Math.atan2(Math.sin(d), Math.cos(d));
      yaw = ay + d * (u * u * (3 - 2 * u));
    }
  }
  return { x, z, yaw, moving: v > 0.3, arrived, speed: v };
}

// ---------------------------------------------------------------- the boat
export class CharterBoat {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'charter-boat';
    this.root.rotation.order = 'YXZ';
    this.hull = buildNode(CHARTER_MATS, CHARTER_NODES, 'charter_boat');
    this.root.add(this.hull);
    this.chair = buildNode(CHARTER_MATS, CHARTER_NODES, 'charter_chair');
    this.chair.position.set(BOAT.chair.x, BOAT.cockpitY, BOAT.chair.z);
    this.chair.rotation.y = Math.PI; // faces the stern, where the fish is
    this.root.add(this.chair);
    // v1.15.13: an owner's upgrades (Marlowe's own boat always carries the outriggers)
    this.outriggers = buildNode(CHARTER_MATS, CHARTER_NODES, 'charter_outriggers');
    this.root.add(this.outriggers);
    this.livewell = buildNode(CHARTER_MATS, CHARTER_NODES, 'charter_livewell');
    this.livewell.position.set(1.5, 0, -5.5); this.livewell.visible = false; // (starboard side of the cockpit, clear of the bench and the chair)
    this.root.add(this.livewell);
    this.paints = paintable(this.hull);
    // running lights after dark: red to port, green to starboard, white at the masthead
    const light = (c, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); this.root.add(m); return m; };
    this.lights = [light('#ff3a2a', -1.62, 2.82, 2.3), light('#3aff6a', 1.62, 2.82, 2.3), light('#fff6e0', 0, 5.86, 0.3)];
    this.pose = { x: 0, z: 0, yaw: 0, heave: 0, pitch: 0, roll: 0, moving: false, speed: 0, vy: 0 };
    this.prev = null;
    this.visible = false;
    this.root.visible = false;
    scene.add(this.root);
  }
  setVisible(v) { this.visible = v; this.root.visible = v; }
  /** v1.15.13: whose boat this trip is on. bt: an owner's boat { hull, stripe, trim, name, up: { outriggers, livewell, engine } }, or null for Marlowe's. */
  setLook(bt) {
    paint(this.paints, bt);
    this.outriggers.visible = !bt || !!bt.up?.outriggers;
    this.livewell.visible = !!bt?.up?.livewell;
    if (this.nameplate) { this.root.remove(this.nameplate); this.nameplate.material.map?.dispose(); this.nameplate = null; }
    const name = bt?.name || 'MARLOWE\'S PRIDE';
    const hull = new THREE.Color(bt ? PAINTS.hull[bt.hull] || PAINTS.hull[0] : PAINTS.hull[0]);
    this.nameplate = nameplate(name, hull.r * 0.3 + hull.g * 0.59 + hull.b * 0.11 < 0.45 ? '#f4efe2' : '#1e2a32'); // light letters on a dark hull
    this.nameplate.position.set(0, 1.05, BOAT.Z0 - 0.01); this.nameplate.rotation.y = Math.PI;
    this.root.add(this.nameplate);
  }

  /** Move to the course position and ride the sea. Returns how the boat moved this frame (to carry people). */
  update(dt, course, night = 0, now = Date.now()) {
    const c = coursePose(course, now);
    const P = this.pose;
    const before = this.prev ? { x: P.x, z: P.z, yaw: P.yaw } : null;
    P.x = c.x; P.z = c.z; P.yaw = c.yaw; P.moving = c.moving; P.speed = c.speed;
    // the sea under the hull: five samples (the boat bridges the short waves and rides the long ones)
    const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
    const at = (lx, lz) => oceanWave(c.x + lx * cy + lz * sy, c.z - lx * sy + lz * cy);
    const hB = at(0, 6), hS = at(0, -6), hP = at(-2.1, 0), hR = at(2.1, 0), h0 = at(0, 0);
    const heave = (h0 * 2 + hB + hS + hP + hR) / 6;
    // under way the bow lifts and she leans into the turns a little; a gale heels her over
    const run = Math.min(1.2, c.speed / BOAT.speed);
    const pitch = Math.atan2(hB - hS, 12) * 0.85 + run * 0.045;
    const roll = Math.atan2(hR - hP, 4.2) * 0.75 + Math.sin(now / 1000 * 0.9) * 0.012 * (1 + SEA.swell) + SEA.spray * 0.02;
    // a heavy hull follows the sea a beat late (critically damped springs), so she wallows rather than jitters
    const spring = (cur, vel, to, w) => { const a = w * w * (to - cur) - 2 * w * vel; vel += a * dt; return [cur + vel * dt, vel]; };
    const w = 2.6;
    [P.heave, P.vy] = spring(P.heave, P.vy, heave, w);
    [P.pitch, this.vp] = spring(P.pitch, this.vp || 0, pitch, w * 1.1);
    [P.roll, this.vr] = spring(P.roll, this.vr || 0, roll, w * 0.9);
    if (!this.prev) { P.heave = heave; P.pitch = pitch; P.roll = roll; P.vy = 0; this.vp = 0; this.vr = 0; }
    this.prev = true;
    this.root.position.set(P.x, WATER_Y + P.heave - 0.05 + run * 0.12, P.z);
    this.root.rotation.set(-P.pitch, P.yaw, P.roll);
    this.root.updateMatrixWorld();
    for (const l of this.lights) l.visible = night > 0.35;
    return before ? { dx: P.x - before.x, dz: P.z - before.z, dyaw: Math.atan2(Math.sin(P.yaw - before.yaw), Math.cos(P.yaw - before.yaw)), ox: before.x, oz: before.z } : null;
  }

  // v1.15.23: deck points go through the hull's full transform (heading, heave, pitch AND roll), so whoever stands on
  // deck stays planted on the same plank as she rolls; before, only the heading was used and people (Marlowe up on the
  // flybridge most of all) slid back and forth against the rocking deck.
  local3(lx, ly, lz) { return V3.set(lx, ly, lz).applyMatrix4(this.root.matrixWorld); }
  toLocal(wx, wz) {
    const P = this.pose, dx = wx - P.x, dz = wz - P.z, s = Math.sin(P.yaw), c = Math.cos(P.yaw);
    const l = { x: dx * c - dz * s, z: dx * s + dz * c };
    if (!this.prev) return l;
    for (let i = 0; i < 3; i++) { // (solve for the deck point that the tilted hull carries to (wx, wz))
      const f = this.toWorld(l.x, l.z), ex = wx - f.x, ez = wz - f.z;
      l.x += ex * c - ez * s; l.z += ex * s + ez * c;
    }
    return l;
  }
  toWorld(lx, lz, ly) {
    const P = this.pose;
    if (!this.prev) { const s = Math.sin(P.yaw), c = Math.cos(P.yaw); return { x: P.x + lx * c + lz * s, z: P.z - lx * s + lz * c }; }
    const w = this.local3(lx, ly ?? deckAtLocal(lx, lz) ?? BOAT.cockpitY, lz);
    return { x: w.x, z: w.z, y: w.y };
  }
  /** World height of the deck at a local point (follows heave, pitch and roll). */
  heightAtLocal(lx, lz, ly) {
    if (!this.prev) return this.root.position.y + ly;
    return this.local3(lx, ly, lz).y;
  }
  /** Where you'd stand at world (x, z) on deck, or null if that's not on deck. */
  deckY(wx, wz) {
    if (!this.visible) return null;
    const l = this.toLocal(wx, wz);
    const y = deckAtLocal(l.x, l.z);
    return y == null ? null : this.heightAtLocal(l.x, l.z, y);
  }
  /** Is (x, z) inside the hull's footprint (no casting through it, no swimming into it)? */
  footprint(wx, wz) {
    if (!this.visible) return false;
    const l = this.toLocal(wx, wz);
    return l.z > BOAT.Z0 - 0.5 && l.z < BOAT.Z1 && Math.abs(l.x) < halfBeam(Math.min(BOAT.Z1, Math.max(BOAT.Z0, l.z))) + 0.1;
  }
  chairWorld() {
    const w = this.toWorld(BOAT.chair.x, BOAT.chair.z, BOAT.cockpitY);
    return { x: w.x, z: w.z, y: this.heightAtLocal(BOAT.chair.x, BOAT.chair.z, BOAT.cockpitY), yaw: this.pose.yaw + Math.PI };
  }
  seatWorld(st) {
    const w = this.toWorld(st.x, st.z, st.y);
    return { x: w.x, z: w.z, y: this.heightAtLocal(st.x, st.z, st.y), yaw: this.pose.yaw + st.yaw };
  }
  helmWorld() {
    const w = this.toWorld(BOAT.helm.x, BOAT.helm.z, BOAT.helm.y);
    return { x: w.x, z: w.z, y: this.heightAtLocal(BOAT.helm.x, BOAT.helm.z, BOAT.helm.y), yaw: this.pose.yaw };
  }
  bowWorld() { return this.toWorld(0, BOAT.Z1); }
  sternWorld() { return this.toWorld(0, BOAT.Z0 - 0.4); }
  dispose() { this.scene.remove(this.root); }
}

/** The pier and sign at Cozy Cove (static). */
export function buildPier() { return buildNode(CHARTER_MATS, CHARTER_NODES, 'charter_pier'); }
export function buildSign() { return buildNode(CHARTER_MATS, CHARTER_NODES, 'charter_sign'); }
export function buildDockedBoat() { const g = buildNode(CHARTER_MATS, CHARTER_NODES, 'charter_boat'); const c = buildNode(CHARTER_MATS, CHARTER_NODES, 'charter_chair'); c.position.set(BOAT.chair.x, BOAT.cockpitY, BOAT.chair.z); c.rotation.y = Math.PI; g.add(c); return g; }

// ---------------------------------------------------------------- v1.15.13: your own boat's paint and name
export const PAINTS = {
  hull: ['#f2f0ea', '#2f5f8a', '#1e3550', '#8e2a26', '#2f7a5a', '#e8c040', '#2a2a2c', '#f0a0b0'],
  stripe: ['#1e3550', '#c03a2a', '#2f9a9a', '#e8642a', '#5ab88a', '#c9a24a', '#f2f0ea', '#7a5ac8'],
  trim: ['#e6dfcf', '#d8e8f0', '#f0d8c0', '#c8d8b0', '#e0c8e8', '#3a3a3c'],
};
const PAINT_MATS = { hull: 'hull_paint', stripe: 'boot_navy', trim: 'deck_cream' };
/** The meshes an owner can repaint (each gets its own material, keeping the original colour). */
function paintable(root) {
  const mats = CHARTER_MATS.map((m) => m.name), out = { hull: [], stripe: [], trim: [] };
  const shared = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const [k, name] of Object.entries(PAINT_MATS)) {
      const i = mats.indexOf(name);
      if (i < 0 || !materialIs(o.material, i)) continue;
      if (!shared.has(o.material)) { const m = o.material.clone(); m.userData.base = m.color.clone(); shared.set(o.material, m); }
      o.material = shared.get(o.material);
      if (!out[k].includes(o.material)) out[k].push(o.material);
    }
  });
  return out;
}
function materialIs(mat, i) { return mat?.userData?.matIndex === i; }
function paint(P, bt) {
  for (const k of Object.keys(PAINT_MATS)) for (const m of P[k] || []) {
    const c = bt && PAINTS[k][bt[k]] ? PAINTS[k][bt[k]] : null;
    if (c) m.color.set(c); else m.color.copy(m.userData.base);
  }
}
/** The boat's name on her transom, painted in a canvas texture. */
function nameplate(name, ink = '#1e2a32') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 96);
  g.fillStyle = ink; g.font = 'italic 800 62px "Baloo 2", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(name).toUpperCase().slice(0, 18), 256, 50, 500);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.48), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.name = 'boat-name';
  return m;
}
