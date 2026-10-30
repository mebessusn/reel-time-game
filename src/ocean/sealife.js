// Open Waters: whales, dolphins and seabirds. Scenery only: nothing here can be hooked, clicked or caught, and lines
// pass straight through them.
//
// Everyone aboard sees the same thing at the same moment: sightings come from a schedule seeded by the charter's id
// and the wall clock (20 s slots), and they're placed relative to where the charter's course puts the boat, so no
// network traffic is needed. The weather matters: whales and dolphins show more on calm days, less in a storm, and
// you can't see as far in rain.
import * as THREE from 'three';
import { SEALIFE_MATS, SEALIFE_NODES } from '../data/sealifeMesh.js';
import { buildNode } from './meshes.js';
import { buildFauna } from '../world/fauna.js';
import { oceanWave, SEA } from './waves.js';
import { coursePose } from './charterBoat.js';
import { inOcean, oceanSurfaceY, jettyAt } from './geo.js';

const WATER_Y = 0.85, SLOT = 20000;
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const seedOf = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// how often (chance per 20 s slot) by weather
const ODDS = {
  whale: { clear: 0.16, overcast: 0.12, rain: 0.07, storm: 0.035 },
  dolphins: { clear: 0.1, overcast: 0.09, rain: 0.06, storm: 0.025 },
  birds: { clear: 0.16, overcast: 0.14, rain: 0.08, storm: 0.04 },
};

function animal(kind) {
  const g = new THREE.Group();
  const body = buildNode(SEALIFE_MATS, SEALIFE_NODES, `${kind}_body`, { shadow: false });
  const tail = buildNode(SEALIFE_MATS, SEALIFE_NODES, `${kind}_tail`, { shadow: false });
  const root = { humpback: -5.2, bluewhale: -9.0, dolphin: -0.72 }[kind];
  tail.position.z = root;
  g.add(body, tail);
  g.userData.tail = tail;
  return g;
}

// v1.15.19: dolphins keep to water at least 4 m deep, away from the beaches and the jetties
const DOLPHIN_DEPTH = WATER_Y - 4;
const okDeep = (x, z) => inOcean(x, z) && oceanSurfaceY(x, z) < DOLPHIN_DEPTH && !jettyAt(x, z);
function deepNear(x, z) {
  if (okDeep(x, z)) return { x, z };
  for (let r = 4; r <= 40; r += 4) for (let a = 0; a < 12; a++) { const px = x + Math.cos(a * 0.5236) * r, pz = z + Math.sin(a * 0.5236) * r; if (okDeep(px, pz)) return { x: px, z: pz }; }
  return null;
}

export class SeaLife {
  constructor(scene, game, ow) {
    this.scene = scene; this.game = game; this.ow = ow;
    this.pool = { humpback: [], bluewhale: [], dolphin: [], gull: [] };
    this.events = new Map(); // key -> event
    this.birdsUntil = 0;
    this.seed = 0;
  }
  get(kind) {
    const free = this.pool[kind].find((m) => !m.userData.busy);
    if (free) { free.userData.busy = true; free.visible = true; return free; }
    const m = kind === 'gull' ? buildFauna('gull', false) : animal(kind);
    if (!m) return null;
    if (kind === 'gull') m.scale.setScalar(1.1);
    m.userData.busy = true;
    this.scene.add(m);
    this.pool[kind].push(m);
    return m;
  }
  put(m) { if (m) { m.userData.busy = false; m.visible = false; } }
  reset(c) { this.clear(); this.seed = seedOf(c?.id || 'x'); }
  clear() {
    for (const e of this.events.values()) for (const m of e.meshes || []) this.put(m);
    this.events.clear();
    this.birdsUntil = 0; this.flock = null;
  }
  birdsVisible() { return !!this.flock && !this.flock.called; }
  /** Birds called (by the spotter, or Marlowe): the crew bite faster for a minute and a half. */
  callBirds(mine, who = '') {
    const g = this.game;
    if (this.flock) this.flock.called = true;
    if (this.birdsUntil > Date.now()) return;
    this.birdsUntil = Date.now() + 90000;
    g.chat.system(mine ? 'You called the birds! Bait\'s getting pushed up: bites come faster for a while.' : `${who || 'Marlowe'} spotted birds working bait! Bites come faster for a while.`, 'info', { popup: true });
    if (mine) g.ext.bump('birdsCalled');
  }

  /** The boat's position at a moment (deterministic from the charter's course). */
  boatAt(ms) { const c = this.ow.course; return c ? coursePose(c, ms) : null; }

  update(dt, t, charter) {
    if (!charter || !this.ow.atSea) return;
    const now = Date.now(), wx = this.game.engine.sky.state.weather || 'clear';
    const slot = Math.floor(now / SLOT);
    // which sightings are on now: look back far enough for the longest one (a whale's 70 s, dolphins' 100 s)
    const want = new Set();
    for (let s = slot - 6; s <= slot; s++) {
      const moving = this.boatAt(s * SLOT)?.moving;
      if (s % 3 === 0 && hash(s, this.seed) < ODDS.whale[wx]) this.open(`w${s}`, 'whale', s, wx, now, want);
      if (s % 2 === 1 && hash(s, this.seed + 101) < ODDS.dolphins[wx] * (moving ? 2.2 : 1)) this.open(`d${s}`, 'dolphins', s, wx, now, want);
      if (hash(s, this.seed + 202) < ODDS.birds[wx] && !moving) this.open(`b${s}`, 'birds', s, wx, now, want);
    }
    for (const [k, e] of this.events) if (e.summoned && now < e.start + e.dur * 1000) want.add(k); // (the test kit's)
    for (const [k, e] of this.events) if (!want.has(k)) { for (const m of e.meshes) this.put(m); this.events.delete(k); if (e.kind === 'birds' && this.flock === e) this.flock = null; }
    this.updatePlumes(dt);
    for (const e of this.events.values()) this[e.kind === 'whale' ? 'whale' : e.kind === 'dolphins' ? 'dolphins' : 'birds'](e, (now - e.start) / 1000, dt, t);
  }

  /** Playtesting (the test kit): a sighting right now, whatever the schedule says. */
  summon(kind) {
    const now = Date.now(), s = Math.floor(now / 1000), want = new Set();
    const key = `x${kind}${s}`;
    this.open(key, kind, s, this.game.engine.sky.state.weather || 'clear', now, want, now);
    const e = this.events.get(key);
    if (e) e.summoned = true;
    return !!e;
  }
  open(key, kind, s, wx, now, want, startAt = null) {
    const start = startAt ?? s * SLOT + hash(s, this.seed + 7) * 6000;
    const dur = kind === 'whale' ? 62 : kind === 'dolphins' ? 40 + hash(s, this.seed + 9) * 50 : 75;
    if (now < start || now > start + dur * 1000) return;
    want.add(key);
    if (this.events.has(key)) return;
    const r = (k) => hash(s, this.seed + k);
    const at = this.boatAt(start);
    if (!at) return;
    const e = { key, kind, start, dur, r, at, meshes: [], s };
    if (kind === 'whale') {
      e.sp = r(11) < 0.18 ? 'bluewhale' : 'humpback';
      e.breach = e.sp === 'humpback' && r(12) < (wx === 'clear' ? 0.22 : 0.12);
      const bear = r(13) * Math.PI * 2, d = 160 + r(14) * 170;
      e.x = at.x + Math.cos(bear) * d; e.z = at.z + Math.sin(bear) * d;
      e.dir = bear + Math.PI / 2 * (r(15) < 0.5 ? 1 : -1); // swims across your view
      if (!inOcean(e.x, e.z) || oceanSurfaceY(e.x, e.z) > -6) return; // not in the shallows
      e.meshes.push(this.get(e.sp));
      e.spouts = 0;
    } else if (kind === 'dolphins') {
      const n = 4 + Math.floor(r(21) * 5);
      e.from = r(22) * Math.PI * 2;
      for (let i = 0; i < n; i++) e.meshes.push(this.get('dolphin'));
      e.pod = e.meshes.map((m, i) => ({ off: (i - n / 2) * 2.2 + r(30 + i) * 1.2, lane: (r(40 + i) - 0.5) * 6, ph: r(50 + i) * 10, leapT: r(60 + i) * 7 }));
    } else if (kind === 'birds') {
      const bear = r(71) * Math.PI * 2, d = 45 + r(72) * 50;
      e.x = at.x + Math.cos(bear) * d; e.z = at.z + Math.sin(bear) * d;
      for (let i = 0; i < 6; i++) e.meshes.push(this.get('gull'));
      e.ph = e.meshes.map((m, i) => ({ a: r(80 + i) * 6.28, R: 4 + r(90 + i) * 6, w: (0.6 + r(100 + i) * 0.5) * (i % 2 ? 1 : -1), dive: r(110 + i) * 6 }));
      this.flock = e;
      // no spotter aboard: Marlowe notices after a while
      e.marlowe = !this.game.ocean.fight.hasRole('spotter');
    }
    this.events.set(key, e);
  }

  // ---- a whale: blow, roll, blow again, lift the flukes and dive (or, now and then, breach)
  whale(e, s, dt, t) {
    const m = e.meshes[0]; if (!m) return;
    const g = this.game, big = e.sp === 'bluewhale';
    const speed = big ? 2.2 : 1.6;
    const x = e.x + Math.cos(e.dir) * speed * s, z = e.z + Math.sin(e.dir) * speed * s;
    const yaw = Math.atan2(Math.cos(e.dir), Math.sin(e.dir));
    const sea = WATER_Y + oceanWave(x, z);
    // the dive cycle: 0-6 s up and blowing, 6-16 a slow roll, 18-24 a second blow, 26-36 the fluke-up dive
    let y = sea - 4, pitch = 0, tailLift = 0, roll = 0;
    const surf = (a, b) => smooth(a, a + 2.5, s) * (1 - smooth(b - 2.5, b, s));
    const up = Math.max(surf(1, 16), surf(18, 26));
    y = sea - 3.8 + up * (big ? 3.35 : 3.05) + Math.sin(s * 0.7) * 0.15 * up; // the back and the little fin break the surface
    pitch = (s > 6 && s < 16 ? Math.sin((s - 6) / 10 * Math.PI) * 0.18 : 0) + (s > 18 && s < 26 ? Math.sin((s - 18) / 8 * Math.PI) * 0.12 : 0);
    if (s >= 26 && s < 40) { // the dive: arch down, the tail stock rises and the flukes lift clear
      const k = clamp01((s - 26) / 9);
      y = sea - 0.6 - k * 7; pitch = -0.5 * smooth(0, 0.6, k); tailLift = smooth(0.15, 0.7, k) * (1 - smooth(0.85, 1, k)) * 1.9;
    }
    if (e.breach && s >= 44 && s < 52) { // rarely: the whole whale out of the water
      const k = (s - 44) / 8;
      y = sea - 10 + Math.sin(k * Math.PI) * 17; pitch = 1.2 - k * 1.4; roll = k * 1.6;
      if (!e.splashed && k > 0.75) { e.splashed = true; this.splash(x, z, 4); g.audio.sfx('whaleSplash', { x, z }); this.seen('breach'); }
    } else if (s >= 40) y = sea - 12;
    m.position.set(x, y, z);
    m.rotation.set(-pitch, yaw, roll, 'YXZ');
    m.userData.tail.rotation.x = tailLift + Math.sin(t * 0.9) * 0.08 * Math.max(0, 1 - tailLift); // (+x lifts the flukes)
    m.visible = y > sea - 6;
    // blows: a column of mist, and the sound a beat later (sound is slower than light)
    for (const at of [2, 20]) if (s >= at && e.spouts < (at === 2 ? 1 : 2)) {
      e.spouts++;
      const head = { x: x + Math.cos(e.dir) * (big ? 8 : 5), z: z + Math.sin(e.dir) * (big ? 8 : 5) };
      this.spout(head.x, sea + 0.8, head.z, big ? 9 : 6);
      const d = Math.hypot(head.x - g.player.pos.x, head.z - g.player.pos.z);
      setTimeout(() => g.audio.sfx('whaleBlow', { x: head.x, z: head.z, vol: Math.max(0.25, 1 - d / 450) }), (d / 343) * 1000);
      if (at === 2) this.seen(e.sp);
    }
  }

  // ---- dolphins: race in, ride the bow (or play round the anchored boat), leap, then peel away
  dolphins(e, s, dt, t) {
    const g = this.game, P = this.ow.boat.pose;
    const moving = P.moving, moored = !!this.ow.moored?.();
    const inK = smooth(0, 8, s), outK = smooth(e.dur - 8, e.dur, s);
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), sx = Math.cos(P.yaw), sz = -Math.sin(P.yaw);
    e.pod.forEach((d, i) => {
      const m = e.meshes[i]; if (!m) return;
      // where it wants to be: off the bow when under way, circling 14-20 m out at anchor
      let lx, lz;
      if (moving) { lx = d.lane * 0.5 + Math.sin(t * 0.8 + d.ph) * 0.8; lz = 9 + d.off * 0.6 + Math.sin(t * 0.5 + d.ph) * 1.5; }
      else { const a = t * 0.18 * (i % 2 ? 1 : -1) + d.ph; const R = 15 + d.lane * 0.6; lx = Math.cos(a) * R; lz = Math.sin(a) * R; }
      // coming in from (and leaving toward) the pod's bearing
      const away = 90 * (1 - inK + outK);
      const bx = Math.cos(e.from) * away, bz = Math.sin(e.from) * away;
      let x = P.x + lx * sx + lz * fx + bx, z = P.z + lx * sz + lz * fz + bz;
      // v1.15.19: never into the shallows, a beach or a jetty: find deep water near where it wanted to be, and swim
      // there at a dolphin's pace (no jumps); with no deep water about (the boat at a jetty) it stays down out of sight
      const deep = deepNear(x, z);
      const prev = d.p || deep || { x, z };
      if (deep) { const dx = deep.x - prev.x, dz = deep.z - prev.z, L = Math.hypot(dx, dz), step = 16 * dt; x = L > step ? prev.x + dx / L * step : deep.x; z = L > step ? prev.z + dz / L * step : deep.z; }
      else { x = prev.x; z = prev.z; }
      const hidden = !deep || moored || oceanSurfaceY(x, z) > DOLPHIN_DEPTH;
      let hx = x - prev.x, hz = z - prev.z;
      if (Math.hypot(hx, hz) < 0.01) { hx = fx; hz = fz; }
      d.yaw = Math.atan2(hx, hz);
      d.p = { x, z };
      // porpoising: short arcs, and every few seconds a proper leap
      d.leapT -= dt;
      let arc = Math.max(0, Math.sin(t * 2.6 + d.ph)) * 0.55 - 0.45;
      if (d.leapT <= 0) { d.leap = 0; d.leapT = 5 + ((d.ph * 13) % 6); }
      if (d.leap != null) {
        d.leap += dt / 1.2;
        arc = Math.sin(Math.min(1, d.leap) * Math.PI) * 2.2 - 0.3;
        if (d.leap > 0.9 && !d.splashed) { d.splashed = true; if (!hidden) this.splash(x, z, 0.8); }
        if (d.leap >= 1) { d.leap = null; d.splashed = false; }
      }
      const sea = WATER_Y + oceanWave(x, z);
      m.position.set(x, sea + arc, z);
      const pitch = d.leap != null ? Math.cos(Math.min(1, d.leap) * Math.PI) * 0.9 : Math.cos(t * 2.6 + d.ph) * 0.3;
      m.rotation.set(-pitch, d.yaw, 0, 'YXZ');
      m.userData.tail.rotation.x = Math.sin(t * 7 + d.ph) * 0.35;
      m.visible = arc > -0.8 && !hidden;
    });
    if (s > 4 && !e.heard) { e.heard = true; g.audio.sfx('dolphin'); this.seen('dolphins'); }
    if (s > 4 && Math.random() < dt * 0.25) g.audio.sfx('dolphin', { vol: 0.5 });
  }

  // ---- birds working bait: gulls wheel and dive over a patch of boiling water
  birds(e, s, dt, t) {
    const g = this.game;
    e.meshes.forEach((m, i) => {
      if (!m) return;
      const p = e.ph[i];
      p.a += p.w * dt;
      p.dive -= dt;
      let h = 7 + Math.sin(t * 0.7 + i) * 1.5;
      if (p.dive < 0) { const k = clamp01(-p.dive / 1.4); h = 7 - Math.sin(k * Math.PI) * 6.5; if (k >= 1) p.dive = 3 + ((i * 7.3 + s) % 5); if (k > 0.45 && k < 0.5) this.splash(e.x + Math.cos(p.a) * p.R, e.z + Math.sin(p.a) * p.R, 0.3); }
      const x = e.x + Math.cos(p.a) * p.R, z = e.z + Math.sin(p.a) * p.R;
      m.position.set(x, WATER_Y + h, z);
      const hx = -Math.sin(p.a) * Math.sign(p.w), hz = Math.cos(p.a) * Math.sign(p.w);
      m.rotation.set(0, Math.atan2(-hz, hx), Math.sign(p.w) * 0.3); // gulls face +x: along the circle, banking in
      const flap = Math.sin(t * 11 + i) * 0.6;
      if (m.userData.parts?.wingL) m.userData.parts.wingL.rotation.x = flap;
      if (m.userData.parts?.wingR) m.userData.parts.wingR.rotation.x = -flap;
    });
    if (Math.random() < dt * 2) g.engine.water.ripple(e.x + (Math.random() - 0.5) * 8, e.z + (Math.random() - 0.5) * 8, 0.4);
    if (s > 2 && !e.cried) { e.cried = true; g.audio.sfx('gulls'); if (this.game.ocean.fight.role === 'spotter') g.ui.toast('Birds working bait! Press the crew key (Y) to call it.', { icon: 'eye', ms: 5000 }); }
    if (e.marlowe && s > 25 && !e.called) { e.called = true; this.callBirds(false, 'Captain Marlowe'); }
  }

  /** A blow: a column of mist that shoots up, spreads at the top, drifts downwind and fades. */
  spout(x, y, z, h) {
    if (!this.plumeMat) {
      this.plumeMat = new THREE.MeshBasicMaterial({ color: '#f4f8fb', transparent: true, opacity: 0.7, depthWrite: false, fog: true });
      this.plumeGeo = new THREE.SphereGeometry(1, 10, 8);
      this.plumes = [];
    }
    let p = this.plumes.find((q) => !q.visible);
    if (!p) {
      p = new THREE.Group();
      for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(this.plumeGeo, this.plumeMat.clone()); p.add(m); }
      this.scene.add(p); this.plumes.push(p);
    }
    p.visible = true; p.position.set(x, y, z); p.userData = { t: 0, h };
    this.game.fx.splash(new THREE.Vector3(x, y, z), 0.6);
  }
  updatePlumes(dt) {
    for (const p of this.plumes || []) {
      if (!p.visible) continue;
      const u = p.userData; u.t += dt;
      const k = Math.min(1, u.t / 0.7), fade = Math.max(0, 1 - Math.max(0, u.t - 0.6) / 2.4);
      p.children.forEach((m, i) => {
        const f = (i + 1) / p.children.length;
        m.position.set(u.t * 0.6 * f, u.h * k * f * 0.95, u.t * 0.3 * f);
        const r = (0.35 + f * 1.1 * k) * (1 + u.t * 0.25);
        m.scale.set(r, (u.h / p.children.length) * 0.75 * (0.6 + k * 0.4), r);
        m.material.opacity = 0.62 * fade * (1.1 - f * 0.4);
      });
      if (fade <= 0) p.visible = false;
    }
  }
  splash(x, z, k) {
    const g = this.game;
    if (!SEA.lite || k >= 3) g.fx.splash(new THREE.Vector3(x, WATER_Y + oceanWave(x, z), z), k); // (low graphics keeps only the breach)
    g.engine.water.ripple(x, z, Math.min(2, k));
  }
  /** Journal notes the first time, and the Whale Watcher achievement for a breach. */
  seen(what) {
    const g = this.game, d = g.ext.d.ocean || {};
    if (what === 'humpback' || what === 'bluewhale') {
      if (!(d.whales > 0)) { g.chat.system(`Journal: a ${what === 'bluewhale' ? 'blue whale, the biggest animal there has ever been,' : 'humpback'} surfaced off the boat! You can hear it blow.`, 'info', { popup: true }); g.audio.sfx('achievement'); }
      g.ext.change((x) => { x.ocean.whales = (x.ocean.whales || 0) + 1; });
      this.ow?.quests?.progress('whale');
    } else if (what === 'dolphins') {
      if (!(d.dolphins > 0)) g.chat.system('Journal: a pod of dolphins came to play around the boat!', 'info', { popup: true });
      g.ext.change((x) => { x.ocean.dolphins = (x.ocean.dolphins || 0) + 1; });
    } else if (what === 'breach') {
      if (!(d.breach > 0)) g.chat.system('Journal: a humpback breached, the whole whale clear of the water! Whale Watcher.', 'info', { popup: true });
      g.ext.change((x) => { x.ocean.breach = (x.ocean.breach || 0) + 1; });
      this.ow?.progress?.sync();
    }
  }
}
