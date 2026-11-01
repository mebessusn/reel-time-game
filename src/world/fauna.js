// Wild animals between the lakes and towns (v1.9.7). Modelled in Blender (art/fauna.blend -> art/fauna.glb ->
// src/data/faunaMesh.js via scripts/glb-to-js.mjs), each kind a few nodes named <kind>_<part> pivoting at
// their joints, facing +X, standing on y = 0:
//   buck and doe (white-tailed deer): graze, wander, and bound away with a flash of white tail if you come close
//   rabbit: nibbles, hops about in short bursts, and zigzags off when startled
//   raccoon: waddles and snuffles about, ringed tail swaying, and shuffles off if you get too near
//   gull: wheels and glides over the lakes; hawk: circles slowly high over the woods
// Placed from a fixed seed in the open country between places, kept off trails, water, docks and clearings.
// Only animals near the camera are animated (and drawn).
import * as THREE from 'three';
import { FAUNA_MATS, FAUNA_NODES } from '../data/faunaMesh.js';
import { HALF, LAKES, CLEARINGS, heightAt, surfaceY, isWater, groundY, gentleAt, trailDist, onDock, WATER_Y } from './terrain.js';
import { blocked } from './colliders.js';
import { leviathanAt } from './frostbones.js';
import { mulberry32 } from '../core/rng.js';

const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
let mats = null;
const geos = new Map();
function materials() {
  mats ??= FAUNA_MATS.map((m) => new THREE.MeshLambertMaterial({ color: lin(m.color) }));
  return mats;
}
function geometries(n) {
  if (!geos.has(n.name)) {
    geos.set(n.name, n.prims.map((p) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(p.nrm), 3, true));
      geo.setIndex(Math.max(...p.idx) > 65535 ? new THREE.Uint32BufferAttribute(p.idx, 1) : new THREE.Uint16BufferAttribute(p.idx, 1));
      return [geo, p.m];
    }));
  }
  return geos.get(n.name);
}
/** One animal as a group (facing +X); userData.parts holds its jointed nodes by part name. */
export function buildFauna(kind, shadows = true) {
  const body = FAUNA_NODES.find((n) => n.name === `${kind}_body`);
  if (!body) return null;
  const g = new THREE.Group();
  g.name = kind;
  const parts = {};
  for (const n of FAUNA_NODES) {
    if (!n.name.startsWith(kind + '_')) continue;
    const node = new THREE.Group();
    node.position.set(n.t[0] - body.t[0], n.t[1] - body.t[1], n.t[2] - body.t[2]);
    node.quaternion.fromArray(n.r);
    for (const [geo, m] of geometries(n)) { const mesh = new THREE.Mesh(geo, materials()[m]); mesh.castShadow = shadows; node.add(mesh); }
    g.add(node);
    parts[n.name.slice(kind.length + 1)] = node;
  }
  g.userData.parts = parts;
  return g;
}

// how each kind behaves: walk / run speeds, how far it roams, how close you can get before it bolts
const KINDS = {
  buck: { walk: 1.1, run: 7.5, roam: 18, shy: 10, stride: 1.3, runStride: 3.6, scale: 1.0 },
  doe: { walk: 1.1, run: 7.5, roam: 18, shy: 10, stride: 1.2, runStride: 3.4, scale: 1.0 },
  rabbit: { walk: 1.4, run: 5.5, roam: 8, shy: 5, stride: 0.5, scale: 1.25, hop: true },
  raccoon: { walk: 0.8, run: 2.6, roam: 10, shy: 4, stride: 0.45, scale: 1.1 },
};

/** Good open ground for an animal: dry, level-ish, off trails, docks, clearings and the lake shores. */
export function wildGround(x, z, pad = 0) {
  if (Math.abs(x) > HALF - 18 || Math.abs(z) > HALF - 18) return false;
  if (isWater(x, z) || groundY(x, z) == null || heightAt(x, z) > 5) return false;
  if (surfaceY(x, z) < WATER_Y + 0.25) return false;
  if (trailDist(x, z) < 3 + pad || onDock(x, z) || !gentleAt(x, z, 0.5, 1)) return false;
  for (const c of Object.values(CLEARINGS)) if (Math.hypot(x - c.x, z - c.z) < c.r + 6) return false;
  if (Math.hypot(x, z - 20) < 60) return false; // Cozy Cove's busy shores and the cabin
  if (leviathanAt(x, z, 2)) return false;
  return !blocked(x, z, 0.5);
}

export class Fauna {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.birds = [];
    const r = mulberry32(4242);
    const spot = (pad) => { for (let i = 0; i < 400; i++) { const x = (r() * 2 - 1) * (HALF - 24), z = (r() * 2 - 1) * (HALF - 24); if (wildGround(x, z, pad)) return { x, z }; } return null; };
    const add = (kind, at) => {
      const mesh = buildFauna(kind);
      if (!mesh) return null;
      const K = KINDS[kind];
      mesh.scale.setScalar(K.scale);
      mesh.visible = false;
      scene.add(mesh);
      const a = { kind, K, mesh, parts: mesh.userData.parts, home: { ...at }, pos: new THREE.Vector3(at.x, surfaceY(at.x, at.z), at.z), yaw: r() * 6.28, target: null, wait: r() * 6, speed: 0, flee: 0, phase: r() * 10, graze: 0, r };
      this.list.push(a);
      return a;
    };
    // deer in little groups (a buck with a doe or two), rabbits here and there, a few raccoons
    for (let g = 0; g < 5; g++) {
      const c = spot(4); if (!c) continue;
      add(g % 2 ? 'doe' : 'buck', c);
      for (let k = 0; k < 1 + (g % 2); k++) { const o = { x: c.x + (r() - 0.5) * 8, z: c.z + (r() - 0.5) * 8 }; if (wildGround(o.x, o.z)) add('doe', o); }
    }
    for (let i = 0; i < 16; i++) { const c = spot(1); if (c) add('rabbit', c); }
    for (let i = 0; i < 7; i++) { const c = spot(2); if (c) add('raccoon', c); }
    // gulls over the lakes, hawks over the woods
    const lakes = [{ cx: 0, cz: -2, rx: 40 }, LAKES.marsh, LAKES.frost, LAKES.pond, LAKES.quarry];
    lakes.forEach((L, li) => {
      for (let i = 0; i < (li === 0 ? 4 : 2); i++) this.addBird('gull', { x: L.cx, z: L.cz, R: Math.min(35, (L.rx || 30) * 0.55) * (0.6 + r() * 0.6), h: 11 + r() * 7, w: (0.25 + r() * 0.2) * (r() < 0.5 ? 1 : -1), a: r() * 6.28 }, r);
    });
    for (const [x, z] of [[-90, 40], [90, -60], [-40, -130], [40, 120]]) this.addBird('hawk', { x, z, R: 26 + r() * 14, h: 26 + r() * 8, w: 0.12 + r() * 0.05, a: r() * 6.28 }, r);
  }

  addBird(kind, orbit, r) {
    const mesh = buildFauna(kind, false);
    if (!mesh) return;
    mesh.scale.setScalar(kind === 'hawk' ? 1.3 : 1.1);
    this.scene.add(mesh);
    this.birds.push({ kind, mesh, parts: mesh.userData.parts, orbit, phase: r() * 10, flap: 0, wob: r() * 6 });
  }

  update(dt, t, player, camera) {
    const cam = camera.position;
    for (const a of this.list) {
      const d2 = (a.pos.x - cam.x) ** 2 + (a.pos.z - cam.z) ** 2;
      const near = d2 < 75 * 75;
      a.mesh.visible = near;
      if (!near) continue;
      this.step(a, dt, t, player);
    }
    for (const b of this.birds) this.fly(b, dt, t, cam);
  }

  step(a, dt, t, player) {
    const K = a.K, me = player;
    const dme = Math.hypot(a.pos.x - me.x, a.pos.z - me.z);
    // startled: run straight away from you for a few seconds
    if (dme < K.shy && a.flee <= 0) { a.flee = 2.5 + a.r() * 2; a.zig = 0; }
    let tx, tz, sp;
    if (a.flee > 0) {
      a.flee -= dt;
      const ax = (a.pos.x - me.x) / (dme || 1), az = (a.pos.z - me.z) / (dme || 1);
      a.zig = (a.zig || 0) + dt;
      const zz = K.hop ? Math.sin(a.zig * 5) * 0.7 : 0; // rabbits zigzag
      tx = a.pos.x + (ax - az * zz) * 5; tz = a.pos.z + (az + ax * zz) * 5;
      sp = K.run;
    } else {
      if (!a.target) {
        a.wait -= dt;
        if (a.wait <= 0) {
          for (let i = 0; i < 8 && !a.target; i++) {
            const ang = a.r() * 6.28, dist = 2 + a.r() * K.roam * 0.5;
            const x = a.home.x + Math.cos(ang) * Math.min(K.roam, dist + Math.hypot(a.pos.x - a.home.x, a.pos.z - a.home.z) * 0.3), z = a.home.z + Math.sin(ang) * Math.min(K.roam, dist);
            if (wildGround(x, z)) a.target = { x, z };
          }
          a.wait = 3 + a.r() * 8;
          if (K.hop && a.target) { const hx = a.target.x - a.pos.x, hz = a.target.z - a.pos.z, L = Math.hypot(hx, hz); if (L > 2.5) a.target = { x: a.pos.x + hx / L * 2.5, z: a.pos.z + hz / L * 2.5 }; }
        }
      }
      if (a.target) { tx = a.target.x; tz = a.target.z; sp = K.walk; }
    }
    let moving = false;
    if (tx != null) {
      const dx = tx - a.pos.x, dz = tz - a.pos.z, L = Math.hypot(dx, dz);
      if (L < 0.2) a.target = null;
      else {
        const step = Math.min(L, sp * dt), nx = a.pos.x + dx / L * step, nz = a.pos.z + dz / L * step;
        if (wildGround(nx, nz) || (a.flee > 0 && !isWater(nx, nz) && groundY(nx, nz) != null && !blocked(nx, nz, 0.4))) {
          a.pos.x = nx; a.pos.z = nz; moving = true;
          let dy = Math.atan2(-dz, dx) - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          a.yaw += dy * Math.min(1, dt * (a.flee > 0 ? 10 : 4));
        } else { a.target = null; if (a.flee > 0) a.flee = 0; }
      }
    }
    a.speed += ((moving ? sp : 0) - a.speed) * Math.min(1, dt * 6);
    a.pos.y = surfaceY(a.pos.x, a.pos.z);
    // ---- animate
    const P = a.parts, v = a.speed, run = Math.min(1, Math.max(0, (v - K.walk) / (K.run - K.walk)));
    // v1.12: the stride lengthens with speed (a running deer covers 3-4 m a bound, about two bounds a second),
    // so the legs no longer blur at full speed
    const stride = K.stride + ((K.runStride || K.stride) - K.stride) * run;
    a.phase += (v / stride) * Math.PI * 2 * dt;
    const ph = a.phase, amp = Math.min(1, v / K.walk) * (0.45 + run * (K.runStride ? 0.6 : 0.35));
    let lift = 0, pitch = 0;
    if (K.hop) {
      // rabbits hop: front and back pairs together, the body bouncing
      const s = Math.sin(ph);
      for (const k of ['legFL', 'legFR']) if (P[k]) P[k].rotation.z = -s * 0.6 * amp;
      for (const k of ['legBL', 'legBR']) if (P[k]) P[k].rotation.z = s * 0.8 * amp;
      lift = Math.max(0, s) * 0.12 * amp;
    } else {
      // walk: diagonal pairs; run (deer): a bounding gallop, the body lifting on each stride
      const tr = { legFL: Math.sin(ph), legBR: Math.sin(ph), legFR: -Math.sin(ph), legBL: -Math.sin(ph) };
      // bound: front pair together, back pair together half a beat later; front legs reach further forward than
      // they sweep back, back legs drive further back than they reach (a deer pushes off from behind)
      const reach = (x, fwd, back) => (x > 0 ? x * fwd : x * back);
      const ga = { legFL: reach(Math.sin(ph), 1.15, 0.7), legFR: reach(Math.sin(ph + 0.35), 1.15, 0.7), legBL: reach(Math.sin(ph + 3.0), 0.75, 1.2), legBR: reach(Math.sin(ph + 3.35), 0.75, 1.2) };
      for (const k of ['legFL', 'legFR', 'legBL', 'legBR']) if (P[k]) P[k].rotation.z = (tr[k] * (1 - run) + ga[k] * run) * amp;
      if (K.runStride) {
        // one floating leap a stride (legs gathered), nose up as the back legs push, nose down onto the front legs
        lift = run * Math.max(0, Math.sin(ph + 1.6)) * 0.42 * (a.K.scale || 1);
        pitch = run * Math.sin(ph + 0.2) * 0.13;
      } else lift = run * Math.abs(Math.sin(ph)) * 0.18;
    }
    // grazing / sniffing: the head dips down now and then while standing
    if (P.head) {
      a.graze += dt;
      const down = !moving && Math.sin(a.graze * 0.35 + a.phase * 0.01) > 0.2 ? 1 : 0;
      a.headK = (a.headK || 0) + ((a.kind === 'raccoon' ? 0.4 : down) - (a.headK || 0)) * Math.min(1, dt * 2);
      P.head.rotation.z = -a.headK * (a.kind === 'rabbit' ? 0.4 : a.kind === 'raccoon' ? 0.3 + Math.sin(t * 6) * 0.05 : 1.0) + (moving ? Math.sin(ph * 2) * 0.05 : 0);
    }
    if (P.tail) P.tail.rotation.z = a.flee > 0 && a.kind !== 'raccoon' ? 0.9 : Math.sin(t * (a.kind === 'raccoon' ? 2 : 3) + a.home.x) * 0.15; // deer flag their tails when they run
    a.mesh.position.set(a.pos.x, a.pos.y + lift, a.pos.z);
    a.mesh.rotation.y = a.yaw;
    a.mesh.rotation.z = pitch;
  }

  fly(b, dt, t, cam) {
    const o = b.orbit;
    o.a += o.w * dt;
    const wob = Math.sin(t * 0.3 + b.wob);
    const x = o.x + Math.cos(o.a) * o.R * (1 + wob * 0.15), z = o.z + Math.sin(o.a) * o.R;
    const y = o.h + Math.sin(t * 0.5 + b.wob) * 1.5;
    const near = (x - cam.x) ** 2 + (z - cam.z) ** 2 < 140 * 140;
    b.mesh.visible = near;
    if (!near) return;
    // heading along the circle, banking into the turn
    const hx = -Math.sin(o.a) * Math.sign(o.w), hz = Math.cos(o.a) * Math.sign(o.w);
    b.mesh.position.set(x, y, z);
    b.mesh.rotation.set(0, 0, 0);
    b.mesh.rotation.y = Math.atan2(-hz, hx);
    b.mesh.rotateX(-Math.sign(o.w) * (b.kind === 'hawk' ? 0.35 : 0.25));
    // flap in bursts, glide in between (hawks mostly soar)
    const cyc = (t + b.phase) % (b.kind === 'hawk' ? 9 : 4.5);
    const flapping = cyc < (b.kind === 'hawk' ? 1.2 : 1.8);
    b.flap = flapping ? Math.sin(t * (b.kind === 'hawk' ? 7 : 11)) * 0.6 : b.flap * Math.max(0, 1 - dt * 4) + 0.12 * dt * 4;
    const w = flapping ? b.flap : 0.12 + Math.sin(t * 1.3 + b.wob) * 0.04;
    if (b.parts.wingL) b.parts.wingL.rotation.x = w;
    if (b.parts.wingR) b.parts.wingR.rotation.x = -w;
  }
}
