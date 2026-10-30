// Open Waters stage 3: Under the Sea. Swim, dive the reefs and the wreck, and spearfish.
// - Swim mode: dive in from the boat's swim platform or a jetty's end. W swims where the camera looks (look down to
//   dive), Space swims up, Shift swims down. Climb back out at the boat, a jetty or any beach.
// - Oxygen: 30 s on one breath, a minute with a dive mask, five minutes with a scuba tank; it refills at the surface. Run out and
//   you black out and come to on deck (cozy: no harm done, the fish just get away).
// - Underwater: clear water (v1.15.19): a light blue-green tint over the view, and fog only from about 50 m out (closer
//   in storms and after dark) so spearfishing is easy to aim; caustics on the sand and the coral; light shafts by day; sound muffled; the surface a bright ripple overhead.
// - Spearfishing: two spearguns from Kai's tiki bar. Aim at the crosshair and lead moving fish. Some reef fish are
//   spear only (lionfish, goliath grouper, octopus); lionfish earn a reef cleanup bonus. The pretty reef fish
//   (clownfish, tangs, idols) are just to look at.
// - Dive sites: coral on the reefs round every island and at Reef Edge, and an old wreck off Smuggler's Rock.
import { JET } from './jetski.js';
import { SPEARABLE as SPEAR_LIST } from './progressData.js';
import { walkY } from '../world/terrain.js';
import * as THREE from 'three';
import { REEF_MATS, REEF_NODES } from '../data/reefMesh.js';
import { WRECK_MATS, WRECK_NODES } from '../data/wreckMesh.js';
import { buildNode } from './meshes.js';
import { ISLANDS, ISLAND_BY_ID, SPOT_BY_ID, DOCKS, oceanSurfaceY, oceanZoneAt, inOcean, jettyAt } from './geo.js';
import { oceanWave, SEA } from './waves.js';
import { buildFish } from '../entities/fish.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { eligibleSpecies, rollWeight } from '../game/rules.js';
import { applyCaustics } from '../world/caustics.js';
import { mulberry32 } from '../core/rng.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { BOAT } from './charterBoat.js';

const WATER_Y = 0.85;
export const DIVE = { O2: 30, MASK: 60, TANK: 300, SPEED: 2.3, FAST: 3.4 }; // (v1.15.8: a tank lasts 5 minutes, a mask a minute)
export const SPEARGUNS = {
  // v1.15.15: longer reach and faster spears (6 m and 11 m were shorter than fish usually swim from you)
  pole: { name: 'Pole spear', range: 10, reload: 1.0, speed: 20, price: 2500, what: 'Short range, quick to reload. Get close.' },
  band: { name: 'Band speargun', range: 16, reload: 1.5, speed: 28, price: 9000, what: 'Half again the reach and a faster spear.' },
};
export const DIVE_GEAR = {
  mask: { name: 'Dive mask', price: 1500, what: `Hold your breath for a minute (${DIVE.MASK} s, from ${DIVE.O2} s).` },
  tank: { name: 'Scuba tank', price: 7000, what: `Five minutes of air underwater (${DIVE.TANK} s).` },
  fins: { name: 'Fins', price: 1200, what: 'Swim half again as fast.' },
};
const TOW_LB = 30; // v1.17.1: a speared fish heavier than this has to be towed back to the boat before the next shot
// fish a spear can take (spear-only ones plus a few the rod can catch too); the rest of the reef is to look at
const SPEARABLE = new Set([...SPEAR_LIST, 'moray']); // v1.15.19: the Marigold's morays too (not counted for Reef Ranger)
const SCHOOLERS = new Set(['bluetang', 'clownfish', 'moorishidol', 'parrotfish']);

export class Dive {
  constructor(game, ow) {
    this.game = game; this.ow = ow;
    this.on = false; this.o2 = DIVE.O2; this.vel = new THREE.Vector3();
    this.fish = []; this.spears = []; this.reload = 0;
    this.built = false;
    this.wasUnder = false;
  }
  get gear() { return this.game.ext.d.ocean?.gear || {}; }
  get maxO2() { return Math.round((this.gear.tank ? DIVE.TANK : this.gear.mask ? DIVE.MASK : DIVE.O2) * (this.ow.deep?.town?.airMult?.() || 1)); } // (v1.15.20: Coral's bubble tea, x1.5)
  get gun() { return this.gear.band ? SPEARGUNS.band : this.gear.pole ? SPEARGUNS.pole : null; }
  /** What you have on in the water (for the avatar): m mask, t tank, f fins, and your best speargun (b or p). */
  get wearing() { const G = this.gear; return `${G.mask || G.tank ? 'm' : ''}${G.tank ? 't' : ''}${G.fins ? 'f' : ''}${G.band ? 'b' : G.pole ? 'p' : ''}`; }
  surfaceAt(x, z) { return WATER_Y + oceanWave(x, z); }
  /** Is the player's head under the water? */
  get under() { const p = this.game.player.pos; return this.on && p.y < this.surfaceAt(p.x, p.z) - 0.55; }

  // ---------------------------------------------------------------- in and out of the water
  enter(x, z) {
    const g = this.game, pl = g.player;
    if (g.fishing.busy) g.fishing.cancel();
    if (g.chairs.seat) g.chairs.stand();
    this.build();
    // never start under the hull: come up just off the swim platform instead
    if (this.ow.boat.visible && this.ow.boat.footprint(x, z)) { const w = this.ow.boat.toWorld(0, BOAT.Z0 - 1.6); x = w.x; z = w.z; }
    pl.mode = 'swim'; g.actor.setMode('swim');
    pl.pos.set(x, this.surfaceAt(x, z) - 0.3, z); pl.target = null;
    this.vel.set(0, -1.5, 0);
    this.on = true; this.o2 = this.maxO2;
    g.audio.sfx('splashRemote');
    g.fx.splash(new THREE.Vector3(x, WATER_Y, z), 1.2);
    g.engine.water.ripple(x, z, 1.5);
    const G = this.gear, on = [G.tank ? 'scuba tank' : G.mask ? 'mask' : null, G.fins ? 'fins' : null, this.gun ? this.gun.name.toLowerCase() : null].filter(Boolean);
    if (on.length && this.game.ext.d.ocean?.dived) g.ui.toast(`On: your ${on.join(', ').replace(/, ([^,]*)$/, ' and $1')}. ${this.gun ? 'Dive under and click to fire.' : ''}`, { icon: 'waves', ms: 3500 });
    if (!this.game.ext.d.ocean?.dived) {
      g.ext.change((d) => { d.ocean.dived = Date.now(); });
      g.ui.toast(`W swims where you look (look down to dive), Space swims up, Shift swims down. Watch your air. ${this.gun ? 'Click to fire your speargun.' : 'Kai sells spearguns at the tiki bar on Palm Key.'}`, { icon: 'waves', title: 'Swimming', ms: 8000 });
    }
    g.ext.bump('dives');
  }
  exit(x, y, z, why = '') {
    const g = this.game, pl = g.player;
    this.on = false;
    pl.mode = 'shore'; g.actor.setMode('shore');
    pl.pos.set(x, y, z); pl.baseY = y; pl.air = 0; pl.vy = 0; pl.target = null;
    g.engine.cam.target.set(x, y + 0.8, z);
    g.audio.setUnderwater?.(false);
    this.clearFish();
    if (why) g.ui.toast(why, { icon: 'waves', ms: 4500 });
  }
  /** Back on deck (climbing the swim platform, or after blacking out). */
  toBoat(why = '') {
    const b = this.ow.boat;
    const w = b.toWorld(0, -5.8), y = b.deckY(w.x, w.z) ?? WATER_Y + 1.2;
    this.exit(w.x, y, w.z, why);
  }

  // ---------------------------------------------------------------- per frame (instead of the player's own update)
  update(dt, camYaw, pitch, locked) {
    const g = this.game, pl = g.player;
    const surf = this.surfaceAt(pl.pos.x, pl.pos.z);
    const floor = oceanSurfaceY(pl.pos.x, pl.pos.z) + 0.35;
    // input: where the camera looks, plus straight up and down
    let f = 0, r = 0, up = 0;
    if (!locked) {
      f = (pl.held('up') ? 1 : 0) - (pl.held('down') ? 1 : 0);
      r = (pl.held('right') ? 1 : 0) - (pl.held('left') ? 1 : 0);
      if (pl.stick) { f = -pl.stick.y; r = pl.stick.x; }
      up = (this.upKey ? 1 : 0) - (pl.sprint ? 1 : 0);
    }
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const fx = -Math.sin(camYaw) * cp, fz = -Math.cos(camYaw) * cp, fy = -sp; // look direction
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const atSurface = pl.pos.y > surf - 0.8;
    const want = new THREE.Vector3(fx * f + rx * r, (atSurface && f > 0 && fy > -0.25 ? 0 : fy * f) + up, fz * f + rz * r);
    if (want.lengthSq() > 1) want.normalize();
    const speed = (this.gear.fins ? DIVE.FAST : DIVE.SPEED) * (pl.sprint && !up ? 1 : 1);
    this.vel.lerp(want.multiplyScalar(speed), Math.min(1, dt * 2.2));
    if (f || r || up) pl.touch();
    // v1.15.20: neutral buoyancy: stop swimming and you hold your depth (Space up, Shift down)
    // the swell rocks you at the surface (more in a big sea)
    const next = pl.pos.clone().addScaledVector(this.vel, dt);
    // the hull and the jetties are solid near the surface
    const solid = (x, z, y) => (this.ow.boat.footprint(x, z) && y > WATER_Y - 1.4) || (jettyAt(x, z) && y > WATER_Y - 0.6) || !!this.ow.deep?.town?.solidAt(x, y, z); // (v1.15.20: and Coralhaven's domes)
    if (solid(next.x, next.z, next.y) && !solid(pl.pos.x, pl.pos.z, pl.pos.y)) { /* (already in the way? let them swim out) */ next.x = pl.pos.x; next.z = pl.pos.z; if (solid(next.x, next.z, next.y)) next.y = pl.pos.y; this.vel.x *= -0.2; this.vel.z *= -0.2; this.vel.y *= -0.2; }
    if (!inOcean(next.x, next.z)) { next.x = pl.pos.x; next.z = pl.pos.z; }
    // the shore: wade out where you can stand; otherwise land is a wall (never swim through the ground)
    const landAhead = oceanSurfaceY(next.x, next.z) > WATER_Y + 0.15; // (dry ground, not the shallows)
    if (landAhead) {
      const out = this.walkOut(next.x, next.z);
      if (out) { this.exit(out.x, out.y, out.z); g.audio.sfx('splashRemote'); return; }
      next.x = pl.pos.x; next.z = pl.pos.z; this.vel.x = 0; this.vel.z = 0;
    }
    // stuck inside the ground (from before this fix, or a wave): step out onto the nearest shore, or back aboard
    if (oceanSurfaceY(pl.pos.x, pl.pos.z) > this.surfaceAt(pl.pos.x, pl.pos.z) - 0.1) {
      const out = this.walkOut(pl.pos.x, pl.pos.z, 12);
      if (out) { this.exit(out.x, out.y, out.z); return; }
      if (this.ow.charter) { this.toBoat('You scrambled back aboard.'); return; }
    }
    const nSurf = this.surfaceAt(next.x, next.z) - 0.3, nFloor = oceanSurfaceY(next.x, next.z) + 0.35;
    next.y = Math.min(nSurf, Math.max(nFloor, next.y));
    if (next.y >= nSurf - 0.02) this.vel.y = Math.min(this.vel.y, 0);
    pl.pos.copy(next);
    pl.moving = (f || r || up) !== 0;
    if (f || r) {
      const ty = Math.atan2(want.x, want.z);
      let d = ty - pl.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      pl.yaw += d * Math.min(1, dt * 6);
    }
    // wade out onto a beach: the sand comes up to meet you
    if (nFloor > nSurf - 0.45 && next.y < nSurf) {
      const out = this.walkOut(next.x, next.z);
      if (out) { this.exit(out.x, out.y, out.z); g.audio.sfx('splashRemote'); return; }
    }
    // air
    const under = this.under;
    if (under) this.o2 = Math.max(0, this.o2 - dt);
    else this.o2 = Math.min(this.maxO2, this.o2 + dt * this.maxO2 / 3);
    if (under !== this.wasUnder) {
      this.wasUnder = under;
      g.audio.setUnderwater?.(under);
      if (!under) { g.audio.sfx('splashRemote'); g.fx.splash(new THREE.Vector3(pl.pos.x, WATER_Y, pl.pos.z), 0.5); }
    }
    if (under && Math.random() < dt * 1.5) g.fx.bubbles(new THREE.Vector3(pl.pos.x + Math.sin(pl.yaw) * 0.6, pl.pos.y + 0.3, pl.pos.z + Math.cos(pl.yaw) * 0.6));
    if (this.o2 <= 0) { this.blackout(); return; }
    if (this.o2 < 8 && under && !this.warned) { this.warned = true; g.ui.toast('Running out of air! Swim up!', { icon: 'waves', ms: 2500 }); g.audio.sfx('bell'); }
    if (this.o2 > 10) this.warned = false;
    this.reload = Math.max(0, this.reload - dt);
    this.updateSpears(dt);
    this.updateFish(dt); this.updateTow();
  }
  /** Somewhere to stand up near (x, z): ahead of you first, then all round. Returns { x, y, z } or null. */
  walkOut(x, z, around = 0) {
    const g = this.game, yaw = g.player.yaw;
    const tries = [[0, 0], [0.6, 0], [1.2, 0]];
    for (let r = 1; r <= around; r += 1) for (let a = 0; a < 12; a++) tries.push([r, (a / 12) * Math.PI * 2]);
    for (const [d, ang] of tries) {
      const px = x + Math.sin(yaw + ang) * d, pz = z + Math.cos(yaw + ang) * d;
      const y = walkY(px, pz); // ground you can stand on (the same test that keeps you out of the water on foot)
      if (y != null && y < WATER_Y + 2.5) return { x: px, y, z: pz };
    }
    return null;
  }
  blackout() {
    const g = this.game;
    g.ext.bump('blackouts');
    const el = document.createElement('div');
    el.className = 'travel-fade ow-spray';
    g.ui.root.append(el);
    setTimeout(() => { if (this.ow.charter) this.toBoat('You blacked out and Marlowe hauled you aboard. Surface for air before the bar runs out!'); else this.exit(this.game.player.pos.x, WATER_Y + 1, this.game.player.pos.z); }, 380);
    setTimeout(() => el.remove(), 950);
    this.on = false;
  }

  // ---------------------------------------------------------------- the look
  /** Under the water the world turns blue-green and closes in. Call after the sky has set its fog. */
  look(sky) {
    const g = this.game, cam = g.engine.camera.position;
    const camUnder = cam.x > 1200 && cam.y < this.surfaceAt(cam.x, cam.z) - 0.05;
    const m = this.ow.surface.mesh;
    if (m) m.material.uniforms.uUnder.value = camUnder ? 1 : 0;
    this.camUnder = camUnder;
    if (this.shafts) this.shafts.visible = camUnder && (sky.state?.phase === 'day' || sky.state?.phase === 'dawn');
    if (this.snow) this.snow.visible = camUnder;
    // v1.15.19: a soft tint over the whole view says "underwater" without hiding anything close by
    if (camUnder && !this.tintEl) { this.tintEl = document.createElement('div'); this.tintEl.className = 'ow-uw-tint'; this.tintEl.style.pointerEvents = 'none'; /* (v1.15.22: never in the way of the mouse: it covered the canvas, so right-drag stopped turning the camera underwater) */ g.ui.root.prepend(this.tintEl); }
    if (this.tintEl) this.tintEl.classList.toggle('on', camUnder);
    this.seabed(cam, camUnder || this.on);
    if (!camUnder) return;
    const f = sky.scene.fog, wt = sky.state || {};
    const depth = Math.max(0, WATER_Y - cam.y);
    const dark = (wt.phase === 'night' ? 0.25 : wt.phase === 'dusk' || wt.phase === 'dawn' ? 0.6 : 1) * (wt.weather === 'storm' ? 0.55 : wt.weather === 'rain' ? 0.7 : wt.weather === 'overcast' ? 0.85 : 1);
    const col = new THREE.Color('#2a9aaa').lerp(new THREE.Color('#0e4a66'), Math.min(1, depth / 40)).multiplyScalar(0.4 + 0.6 * dark);
    f.color.copy(col); sky.scene.background.copy(col);
    // v1.15.19: clear water. Fog starts 50 m out on a calm day (a little closer in rain, storms and at night) and
    // the view ends by 100 m: close enough to keep the deep mysterious, far enough that every fish you can spear is sharp
    const w = wt.weather === 'storm' ? 0.75 : wt.weather === 'rain' ? 0.88 : 1;
    f.near = Math.round(50 * w * (0.8 + 0.2 * dark));
    f.far = Math.round(100 * w * (0.85 + 0.15 * dark));
    if (this.tintEl) this.tintEl.style.opacity = String(Math.min(0.5, 0.18 + depth / 120) * (0.6 + 0.4 * dark) / 0.5);
    const t = performance.now() / 1000;
    if (this.shafts) { this.shafts.position.set(cam.x, WATER_Y, cam.z); this.shafts.rotation.y = t * 0.02; const u = this.shafts.userData.mat.uniforms; u.uT.value = t; u.uK.value = 0.075 * dark * (1 - Math.min(0.6, depth / 40)); }
    if (this.snow) { const u = this.snow.material.uniforms; u.uT.value = t; u.uCam.value.copy(cam); u.uK.value = 0.35 + 0.65 * dark; }
  }
  /** v1.15.20: the sea floor. A 200 m patch of sand, gravel and weed that follows the diver (the islands and banks
   *  paint their own ground on top; this lies a hair below so they win). Rebuilt when you swim 30 m from its middle. */
  seabed(cam, on) {
    if (!on) { if (this.bed) this.bed.visible = false; return; }
    const S = 2.5, N = 81, H = (N - 1) * S / 2;
    if (!this.bed) {
      const geo = new THREE.PlaneGeometry(H * 2, H * 2, N - 1, N - 1); geo.rotateX(-Math.PI / 2);
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * N * 3), 3));
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true }); applyCaustics(mat);
      this.bed = new THREE.Mesh(geo, mat); this.bed.name = 'seabed'; this.bed.receiveShadow = true; this.bed.frustumCulled = false;
      this.game.engine.scene.add(this.bed); this.bedAt = null;
    }
    this.bed.visible = true;
    const cx = Math.round(cam.x / 10) * 10, cz = Math.round(cam.z / 10) * 10;
    if (this.bedAt && Math.hypot(cx - this.bedAt.x, cz - this.bedAt.z) < 30) return;
    this.bedAt = { x: cx, z: cz };
    const pos = this.bed.geometry.attributes.position, col = this.bed.geometry.attributes.color;
    const sand = new THREE.Color('#d8c89a'), grit = new THREE.Color('#a89c80'), weed = new THREE.Color('#6a8a5a'), deep = new THREE.Color('#8a8a7c'), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = cx + pos.getX(i), z = cz + pos.getZ(i);
      const y = oceanSurfaceY(x, z);
      pos.setY(i, Math.min(y, WATER_Y - 0.6) - 0.08);
      const n = Math.sin(x * 0.13 + Math.sin(z * 0.07) * 2) * 0.5 + Math.sin(z * 0.11 - x * 0.05) * 0.5;
      c.copy(sand).lerp(y < WATER_Y - 20 ? deep : grit, Math.min(1, Math.max(0, (WATER_Y - 6 - y) / 18)));
      if (n > 0.55) c.lerp(weed, 0.45); else if (n < -0.6) c.lerp(grit, 0.5);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    this.bed.position.set(cx, 0, cz);
    pos.needsUpdate = true; col.needsUpdate = true;
    this.bed.geometry.computeVertexNormals(); this.bed.geometry.computeBoundingSphere();
  }
  /** Where the camera may go: under the water only while you're under it too. */
  camFloor(x, z) {
    const pl = this.game.player;
    const surf = this.surfaceAt(x, z);
    if (this.on && pl.pos.y < this.surfaceAt(pl.pos.x, pl.pos.z) - 0.4) return Math.min(surf - 0.5, oceanSurfaceY(x, z) + 0.6);
    return surf + 1.3;
  }

  // ---------------------------------------------------------------- the reefs and the wreck
  build() {
    if (this.built) return;
    this.built = true;
    const scene = this.game.engine.scene;
    const root = new THREE.Group(); root.name = 'reefs';
    this.root = root; scene.add(root);
    const kinds = ['reef_brain', 'reef_branch', 'reef_table', 'reef_fan', 'reef_anemone', 'reef_kelp', 'reef_sponge', 'reef_clam'];
    // one shared material set with caustics
    const opts = {};
    const proto = {};
    for (const k of kinds) proto[k] = buildNode(REEF_MATS, REEF_NODES, k, { shadow: false });
    for (const k of kinds) proto[k].traverse((o) => { if (o.material && !o.material.userData.c) { o.material = o.material.clone(); applyCaustics(o.material); o.material.userData.c = true; } });
    const r = mulberry32(4242);
    const place = (k, x, z, s) => {
      const y = oceanSurfaceY(x, z);
      if (y > WATER_Y - 0.9 || y < WATER_Y - 12) return false;
      const m = proto[k].clone();
      m.position.set(x, y - 0.05, z); m.rotation.y = r() * 6.28; m.scale.setScalar(s);
      root.add(m);
      if (k === 'reef_anemone') this.anemones.push(m.position.clone());
      if (k === 'reef_kelp') this.kelp.push(m);
      return true;
    };
    this.anemones = []; this.kelp = [];
    for (const I of ISLANDS) {
      const n = I.atoll ? 260 : I.id === 'palm' ? 180 : 110;
      for (let i = 0, t = 0; i < n && t < n * 6; t++) {
        const a = r() * 6.28, e = I.atoll ? (r() < 0.5 ? 0.15 + r() * 0.6 : 1.05 + r() * 0.9) : 1.05 + r() * 0.8;
        const x = I.x + Math.cos(a) * I.r * e, z = I.z + Math.sin(a) * I.rz * e;
        if (place(kinds[Math.floor(r() * kinds.length)], x, z, 0.8 + r() * 1.2)) i++;
      }
    }
    const re = SPOT_BY_ID.reefedge;
    for (let i = 0; i < 160; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * re.r; place(kinds[Math.floor(r() * kinds.length)], re.x + Math.cos(a) * d, re.z + Math.sin(a) * d, 1 + r() * 1.4); }
    // the wreck: an old ship on the sand off Smuggler's Rock, groupers in its shadow
    const I = ISLAND_BY_ID.smuggler, D = DOCKS.smuggler;
    const ang = Math.atan2(D.uz, D.ux) - 0.9;
    let wx = I.x, wz = I.z;
    for (let d = I.r; d < I.r + 120; d += 2) { wx = I.x + Math.cos(ang) * d; wz = I.z + Math.sin(ang) * d; if (oceanSurfaceY(wx, wz) < WATER_Y - 9) break; }
    const mats = WRECK_MATS.map((m) => { const mm = new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(m.color[0] * 0.75, m.color[1] * 0.8, m.color[2] * 0.75, THREE.LinearSRGBColorSpace), side: m.name === 'sail' ? THREE.DoubleSide : THREE.FrontSide }); applyCaustics(mm); return mm; });
    const wreck = new THREE.Group(); wreck.name = 'ocean-wreck';
    for (const n of WRECK_NODES) {
      const node = new THREE.Group(); node.position.fromArray(n.t); node.quaternion.fromArray(n.r); node.scale.fromArray(n.s);
      for (const p of n.prims) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(p.nrm), 3, true));
        geo.setIndex(p.idx.length && Math.max(...p.idx) > 65535 ? new THREE.Uint32BufferAttribute(p.idx, 1) : new THREE.Uint16BufferAttribute(p.idx, 1));
        node.add(new THREE.Mesh(geo, mats[p.m]));
      }
      wreck.add(node);
    }
    wreck.position.set(wx, oceanSurfaceY(wx, wz) + 0.3, wz); wreck.rotation.set(0.12, ang + 1.2, 0.18); wreck.scale.setScalar(1.3);
    root.add(wreck);
    this.wreck = { x: wx, z: wz };
    // light shafts from the surface (by day, under the water). v1.17.1: soft beams, brightest just under the surface
    // and fading into the depths, their edges feathered (seen side-on they fade out), each one shimmering in its own time
    const shaftMat = new THREE.ShaderMaterial({
      uniforms: { uK: { value: 0.06 }, uT: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */ `
        varying float vY; varying float vEdge; varying float vSeed;
        void main() {
          vY = uv.y; vSeed = modelMatrix[3].x * 0.37 + modelMatrix[3].z * 0.11;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec3 n = normalize(mat3(modelMatrix) * normal), v = normalize(cameraPosition - wp.xyz);
          vEdge = abs(dot(n, v));
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uK; uniform float uT;
        varying float vY; varying float vEdge; varying float vSeed;
        void main() {
          float a = uK * smoothstep(0.0, 0.85, vY) * smoothstep(1.0, 0.92, vY) * smoothstep(0.05, 0.6, vEdge);
          a *= 0.7 + 0.3 * sin(uT * 0.8 + vSeed) * sin(uT * 1.3 + vSeed * 2.1);
          gl_FragColor = vec4(vec3(0.85, 0.97, 1.0) * a, 1.0);
        }`,
    });
    const shafts = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5 + r() * 0.5, 2.2 + r() * 1.4, 24, 10, 1, true), shaftMat);
      m.position.set((r() - 0.5) * 28, -12, (r() - 0.5) * 28); m.rotation.z = 0.22 + (r() - 0.5) * 0.08; m.rotation.x = (r() - 0.5) * 0.2;
      shafts.add(m);
    }
    shafts.visible = false; shafts.userData.mat = shaftMat;
    // v1.17.1: marine snow, specks drifting in the water round you (one draw; they wrap round a 30 m box that follows you)
    const SN = 600, sp = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) { sp[i * 3] = r() * 30; sp[i * 3 + 1] = r() * 30; sp[i * 3 + 2] = r() * 30; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const snowMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSurf: { value: WATER_Y }, uK: { value: 1 } },
      transparent: true, depthWrite: false, fog: false,
      vertexShader: /* glsl */ `
        uniform float uT; uniform vec3 uCam; uniform float uSurf; varying float vA;
        void main() {
          vec3 p = position + vec3(uT * 0.05, -uT * 0.08, uT * 0.03) + vec3(sin(uT * 0.4 + position.y) * 0.3, 0.0, cos(uT * 0.3 + position.x) * 0.3);
          p = mod(p - uCam + 15.0, 30.0) - 15.0 + uCam;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vA = (1.0 - smoothstep(6.0, 15.0, d)) * smoothstep(uSurf - 0.1, uSurf - 0.6, p.y); // near you, and only under the water
          gl_PointSize = clamp(42.0 / d, 1.0, 5.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uK; varying float vA;
        void main() { vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(c)) * vA * 0.55 * uK; gl_FragColor = vec4(vec3(0.85, 0.95, 0.95) * uK, a); }`,
    });
    const snow = new THREE.Points(sg, snowMat); snow.frustumCulled = false; snow.visible = false;
    this.snow = snow; scene.add(snow);
    this.shafts = shafts; scene.add(shafts);
  }

  // ---------------------------------------------------------------- reef fish around you
  clearFish() { for (const f of this.fish) this.game.engine.scene.remove(f.mesh); this.fish = []; for (const s of this.spears) { this.game.engine.scene.remove(s.mesh); if (s.line) this.game.engine.scene.remove(s.line); } this.spears = []; }
  spawnFish() {
    const g = this.game, pl = g.player.pos, wt = g.engine.sky.state;
    const a = Math.random() * 6.28, d = 10 + Math.random() * 14;
    const x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
    const floor = oceanSurfaceY(x, z), surf = WATER_Y - 0.6;
    if (floor > surf - 0.5 || !inOcean(x, z)) return;
    let zone = oceanZoneAt(x, z) || 'openocean';
    const nearWreck = this.wreck && Math.hypot(x - this.wreck.x, z - this.wreck.z) < 25;
    const ctx = { zone: nearWreck ? 'reef' : zone, phase: wt.phase, weather: wt.weather, spear: true };
    let pool = eligibleSpecies(null, ctx).filter((s) => s.tropical || SPEARABLE.has(s.id));
    if (pool.length < 3) pool = [...pool, ...eligibleSpecies(null, { ...ctx, zone: 'reef' }).filter((s) => s.tropical || SPEARABLE.has(s.id))]; // (v1.17.1: open water's never empty: reef fish roam out over the deep too)
    if (nearWreck && Math.random() < 0.4) pool = [SPECIES_BY_ID.grouper];
    // v1.15.11: high tide brings the big reef fish in over the flats and into the lagoon
    else if (this.ow.tides?.high && (zone === 'lagoon' || zone === 'reef') && Math.random() < 0.3) pool = pool.filter((s) => SPEARABLE.has(s.id)).length ? pool.filter((s) => SPEARABLE.has(s.id)) : pool;
    if (!pool.length) return;
    const sp = pool[Math.floor(Math.random() * pool.length)];
    const school = SCHOOLERS.has(sp.id) ? 3 + Math.floor(Math.random() * 5) : 1;
    const y = sp.id === 'octopus' ? floor + 0.25 : floor + 0.6 + Math.random() * Math.max(0.2, Math.min(6, surf - floor - 1));
    for (let i = 0; i < school && this.fish.length < (this.ow.tides?.high ? 30 : 22); i++) {
      const w = rollWeight(sp), variant = Math.random() < 1 / 40 ? 'gold' : 'normal';
      const mesh = buildFish(sp.id, variant, w);
      mesh.position.set(x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 0.8, z + (Math.random() - 0.5) * 2);
      g.engine.scene.add(mesh);
      const s0 = mesh.scale.x;
      this.fish.push({ sp, w, mesh, heading: Math.random() * 6.28, speed: sp.id === 'octopus' ? 0.15 : 0.5 + Math.random() * 0.6, turn: 0, flee: 0, r: Math.max(0.35, s0 * 0.45), variant, spearable: SPEARABLE.has(sp.id), home: { x, z } });
    }
  }
  updateFish(dt) {
    const g = this.game, pl = g.player.pos;
    if (!this.under) { if (this.fish.length) this.clearFish(); return; }
    this.spawnT = (this.spawnT || 0) - dt;
    const cap = this.ow.tides?.high ? 26 : 18; // (more fish about at high tide)
    if (this.spawnT <= 0 && this.fish.length < cap) { this.spawnT = this.fish.length < 8 ? 0.2 : this.ow.tides?.high ? 0.45 : 0.7; this.spawnFish(); } // (v1.17.1: wherever you jump in, some fish turn up fast)
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i], m = f.mesh;
      if (f.caught) continue;
      const d = m.position.distanceTo(pl);
      if (d > 40) { g.engine.scene.remove(m); this.fish.splice(i, 1); continue; }
      // wander, keep near home and off the sand, scatter from a diver who comes too close
      f.turn += (Math.random() - 0.5) * dt * 2;
      f.turn *= 0.95;
      let tgt = f.heading + f.turn * dt;
      const hx = f.home.x - m.position.x, hz = f.home.z - m.position.z;
      if (hx * hx + hz * hz > 64) tgt = Math.atan2(hz, hx);
      if (d < 3.2 && f.sp.id !== 'octopus') { f.flee = 1.4; tgt = Math.atan2(m.position.z - pl.z, m.position.x - pl.x); }
      f.flee = Math.max(0, f.flee - dt);
      let dd = tgt - f.heading; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      f.heading += dd * Math.min(1, dt * (f.flee ? 5 : 1.2));
      const v = f.speed * (f.flee ? 4 : 1);
      m.position.x += Math.cos(f.heading) * v * dt; m.position.z += Math.sin(f.heading) * v * dt;
      const floor = oceanSurfaceY(m.position.x, m.position.z) + 0.3;
      m.position.y = Math.max(floor, Math.min(WATER_Y - 0.6, m.position.y + Math.sin(performance.now() / 700 + i) * dt * 0.1));
      m.rotation.set(0, -f.heading, Math.sin(performance.now() / 160 + i) * 0.08);
    }
    for (const k of this.kelp) k.rotation.z = Math.sin(performance.now() / 1500 + k.position.x) * 0.08;
  }

  // ---------------------------------------------------------------- spears
  /** v1.15.8: fires the moment you press, anywhere you're swimming (at the surface it fires down into the water
   *  the way you're looking). You see the spear fly on its line, hear the band snap, and the view kicks. */
  shoot() {
    const g = this.game, gun = this.gun;
    if (!gun) { g.ui.toast("You need a speargun. Kai sells them at the tiki bar on Palm Key.", { icon: 'fish' }); return; }
    if (this.towing) { g.ui.toast(`You're towing your ${this.towing.name.toLowerCase()} (${Math.round(this.towing.w)} lb). Swim it back to Marlowe's boat before you spear another.`, { icon: 'fish', ms: 4500 }); return; } // (v1.17.1)
    if (this.reload > 0) { this.hudEl?.querySelector('.ow-cross')?.classList.add('nope'); setTimeout(() => this.hudEl?.querySelector('.ow-cross')?.classList.remove('nope'), 250); return; }
    this.reload = gun.reload;
    if (!this.game.ext.d.ocean?.spearTip) { this.game.ext.change((x) => { x.ocean.spearTip = 1; }); this.game.ui.toast('Spear the big reef fish: snapper, grouper, barracuda, triggerfish, lionfish, octopus, trevally and bonefish. The little ones (tangs, clownfish, parrotfish) are protected. The crosshair goes green when one is lined up.', { icon: 'fish', ms: 9000 }); }
    // v1.15.15: the spear flies to what's under the crosshair, not just along the camera's direction (the camera is
    // behind and above you, so a parallel shot went somewhere else). A fish close to the crosshair is the target, and
    // the spear leads it.
    const aim = this.aimAt(), dir = new THREE.Vector3();
    const muzzle = g.player.pos.clone().add(new THREE.Vector3(0, 0.25, 0));
    muzzle.y = Math.min(muzzle.y, WATER_Y - 0.35);
    let T = aim.point;
    if (aim.fish) { const f = aim.fish, v = f.speed * (f.flee ? 4 : 1), t = f.mesh.position.distanceTo(muzzle) / gun.speed; T = f.mesh.position.clone().add(new THREE.Vector3(Math.cos(f.heading) * v * t, 0, Math.sin(f.heading) * v * t)); }
    dir.subVectors(T, muzzle).normalize();
    if (!this.under && dir.y > -0.06) { dir.y = -0.06; dir.normalize(); } // (at the surface: just under it, never up out of the water)
    g.player.yaw = Math.atan2(dir.x, dir.z); // (you turn to face your shot)
    const from = muzzle.clone().addScaledVector(dir, 0.7);
    from.y = Math.min(from.y, WATER_Y - 0.35);
    const mesh = buildNode(REEF_MATS, REEF_NODES, 'reef_spear', { shadow: false });
    mesh.scale.setScalar(1.6); // (big enough to follow with your eye)
    mesh.position.copy(from); mesh.lookAt(from.clone().add(dir));
    g.engine.scene.add(mesh);
    // the spear's line, back to your gun
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from.clone(), from.clone()]), new THREE.LineBasicMaterial({ color: '#f4f0e0', transparent: true, opacity: 0.8 }));
    line.frustumCulled = false;
    g.engine.scene.add(line);
    this.spears.push({ mesh, line, dir, from: from.clone(), travelled: 0, gun });
    g.audio.sfx('whoosh'); g.audio.sfx('click');
    g.fx.bubbles(from); g.fx.bubbles(from.clone().addScaledVector(dir, 0.4));
    g.engine.shake = Math.max(g.engine.shake || 0, 0.18); // the kick
    g.engine.cam.pulse = 0.96;
  }
  /** What the crosshair is on: the spearable fish nearest the crosshair's line (within about 8 degrees and in range),
   *  else the point the line reaches at the gun's range. { fish, point } */
  aimAt() {
    const g = this.game, gun = this.gun, cam = g.engine.camera, o = cam.position.clone(), d = new THREE.Vector3();
    cam.getWorldDirection(d);
    const pl = g.player.pos, ahead = Math.max(0, pl.clone().sub(o).dot(d)); // (the swimmer is this far along the line)
    let best = null, bestA = 0.14, prot = null, protA = 0.1;
    for (const f of this.fish) {
      if (f.caught) continue;
      if (!f.spearable) { // (the little reef fish are left alone: note one on the crosshair so the shot isn't a mystery)
        const v = f.mesh.position.clone().sub(o), along = v.dot(d);
        if (along > ahead + 0.5 && f.mesh.position.distanceTo(pl) < (gun?.range || 10)) { const ang = Math.acos(Math.min(1, along / (v.length() || 1))); if (ang < protA) { protA = ang; prot = f; } }
        continue;
      }
      const v = f.mesh.position.clone().sub(o), along = v.dot(d);
      if (along < ahead + 0.5 || f.mesh.position.distanceTo(pl) > (gun?.range || 10)) continue;
      const ang = Math.acos(Math.min(1, along / (v.length() || 1)));
      if (ang < bestA) { bestA = ang; best = f; }
    }
    return { fish: best, reef: best ? null : prot, point: o.addScaledVector(d, ahead + (gun?.range || 10)) };
  }
  updateSpears(dt) {
    const g = this.game;
    for (let i = this.spears.length - 1; i >= 0; i--) {
      const s = this.spears[i];
      const muzzle = g.player.pos.clone().add(new THREE.Vector3(0, 0.25, 0));
      if (s.hit) {
        s.t -= dt;
        // a miss: the line reels the spear back in
        if (s.miss && s.t < 0.5) s.mesh.position.lerp(muzzle, Math.min(1, dt * 7)); // (stuck a moment, then reeled back)
        s.line.geometry.setFromPoints([muzzle, s.mesh.position]);
        if (s.t <= 0) { g.engine.scene.remove(s.mesh); g.engine.scene.remove(s.line); s.line.geometry.dispose(); this.spears.splice(i, 1); }
        continue;
      }
      const step = s.gun.speed * dt;
      const a = s.mesh.position.clone();
      s.mesh.position.addScaledVector(s.dir, step);
      s.travelled += step;
      if (Math.random() < 0.5) g.fx.bubbles(s.mesh.position);
      // a fish on the line between where the spear was and where it is now
      let hitF = null;
      for (const f of this.fish) {
        if (!f.spearable || f.caught) continue;
        const p = f.mesh.position, ab = s.mesh.position.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
        if (a.clone().addScaledVector(ab, t).distanceTo(p) < f.r + 0.3) { hitF = f; break; } // (v1.15.15: a little forgiving)
      }
      s.line.geometry.setFromPoints([muzzle, s.mesh.position]);
      if (hitF) { s.hit = true; s.t = 0.8; this.land(hitF); continue; }
      const floor = oceanSurfaceY(s.mesh.position.x, s.mesh.position.z);
      if (s.travelled > s.gun.range || s.mesh.position.y < floor || s.mesh.position.y > WATER_Y) {
        s.hit = true; s.miss = true; s.t = 1.0;
        if (s.mesh.position.y < floor + 0.2) { g.fx.bubbles(s.mesh.position); g.audio.sfx('dirt'); } // (a puff of sand)
      }
    }
  }
  async land(f) {
    const g = this.game;
    f.caught = true;
    g.audio.sfx('hook');
    g.juice?.pop(f.sp.spear ? 'SPEARED!' : 'GOT IT!', { color: '#8ae0ff', size: 32 });
    setTimeout(() => { g.engine.scene.remove(f.mesh); this.fish = this.fish.filter((x) => x !== f); }, 600);
    const wt = g.engine.sky.state;
    const zone = oceanZoneAt(f.mesh.position.x, f.mesh.position.z) || 'reef';
    g.ext.bump('speared');
    this.ow.progress.onSpear(f.sp.id);
    this.ow.voyage?.onSpear();
    this.ow.quests.progress('spear', { speciesId: f.sp.id });
    await g.onLanded({ kind: 'fish', speciesId: f.sp.id, variant: f.variant, weight: f.w, speared: true }, { zone, phase: wt.phase, weather: wt.weather, spear: true });
    if (f.sp.id === 'lionfish') g.reward('reefclean', `lion${Date.now()}`, { coins: 60 }, 'Reef cleanup bonus');
    // v1.17.1: a big one (over 30 lb) is yours to tow home: back to Marlowe's boat before the next shot
    if (f.w > TOW_LB && this.ow.charter) { this.towing = { name: f.sp.name, w: f.w }; g.ui.toast(`A ${Math.round(f.w)} lb ${f.sp.name.toLowerCase()}! Tow it back to Marlowe's boat (and drop it off) before you spear another.`, { icon: 'fish', title: 'Big one!', ms: 6000 }); }
  }
  /** Towing a big fish: dropped off when you reach the boat (swimming alongside, or climbing aboard). */
  updateTow() {
    if (!this.towing) return;
    const g = this.game, B = this.ow.boat, p = g.player.pos;
    if (!this.ow.charter) { this.towing = null; return; }
    const near = B?.visible !== false && (B.footprint(p.x, p.z) || Math.hypot(p.x - B.pose.x, p.z - B.pose.z) < 9 || B.deckY(p.x, p.z) != null);
    if (near) { const t = this.towing; this.towing = null; g.audio.sfx('splash'); g.chat?.system?.(`Marlowe hauled your ${Math.round(t.w)} lb ${t.name.toLowerCase()} aboard. Good to go again.`, 'catch'); g.ui.toast(`Marlowe hauls your ${t.name.toLowerCase()} aboard. Spear away!`, { icon: 'fish', ms: 3500 }); }
  }

  // ---------------------------------------------------------------- E: dive in, climb out
  contextActions() {
    const g = this.game, pl = g.player, out = [], ow = this.ow;
    if (!ow.charter || !ow.atSea) return out;
    if (this.on) {
      const b = ow.boat, st = b.toWorld(0, BOAT.Z0 - 0.6);
      if (Math.hypot(pl.pos.x - st.x, pl.pos.z - st.z) < 3.5 && !this.under) out.push({ id: 'climb', label: 'Climb aboard', color: 'blue', fn: () => this.toBoat() });
      for (const D of Object.values(DOCKS)) if (Math.hypot(pl.pos.x - D.end.x, pl.pos.z - D.end.z) < 3.5 && !this.under) out.push({ id: 'climbj', label: 'Climb onto the jetty', color: 'blue', fn: () => this.exit(D.end.x - D.ux * 1.2, D.y, D.end.z - D.uz * 1.2) });
      return out;
    }
    if (pl.mode !== 'shore' || g.fishing.busy || ow.boat.pose.moving) return out;
    const l = ow.boat.toLocal(pl.pos.x, pl.pos.z);
    if (ow.boat.deckY(pl.pos.x, pl.pos.z) != null && l.z < -5.6) { const w = ow.boat.toWorld(l.x * 0.5, BOAT.Z0 - 2.2); out.push({ id: 'divein', label: 'Dive in', color: 'blue', fn: () => this.enter(w.x, w.z) }); }
    for (const D of Object.values(DOCKS)) if (Math.hypot(pl.pos.x - D.end.x, pl.pos.z - D.end.z) < 2.6) out.push({ id: 'diveinj', label: 'Dive in', color: 'blue', fn: () => this.enter(D.end.x + D.ux * 2, D.end.z + D.uz * 2) });
    return out;
  }

  // ---------------------------------------------------------------- Kai's dive shop
  shop() {
    const g = this.game, ow = this.ow, have = this.gear;
    const row = (id, it) => h(`button.ow-role${have[id] ? '.on' : ''}`, { disabled: !!have[id], on: { click: async () => {
      if (have[id]) return;
      const r = await g.save.spend('gear', `ocean_${id}`, { coins: it.price });
      if (!r?.ok) { g.ui.toast(r?.reason || 'Not enough coins.', { icon: 'coin' }); return; }
      g.ext.change((d) => { d.ocean.gear = { ...(d.ocean.gear || {}), [id]: Date.now() }; });
      g.audio.sfx('purchase'); g.ui.refresh?.();
      g.ui.toast(`${it.name}: yours! ${it.what}`, { icon: 'star' });
      this.shop();
    } } }, h('b', `${it.name}${have[id] ? ' (yours)' : ''}`), h('small', `${it.what} ${have[id] ? '' : `${it.price.toLocaleString()} coins`}`));
    ow.ui.openModal('ow-shop', h('div.ow-head', h('span.ow-badge', icon('waves')), h('div', h('b', "Kai's dive gear"), h('span', `You have ${g.profile.coins.toLocaleString()} coins. Gear is yours to keep, and you put it on whenever you go in the water.`))),
      h('div.ow-roles', [...Object.entries(SPEARGUNS), ...Object.entries(DIVE_GEAR), ['jetski', { name: 'Jet ski', price: JET.price, what: 'Ride the swells between the islands. Use the waves button on the bar (or your ride key) anywhere on the water.' }]].map(([id, it]) => row(id, it))),
      h('p.ow-note', 'Dive in from the boat\'s swim platform at the stern, or off the end of a jetty. Lionfish, goliath grouper and octopus only come to a spear.'));
  }

  // ---------------------------------------------------------------- the HUD: air and the crosshair
  hud() {
    const g = this.game;
    if (this.on && !this.hudEl) {
      const G = this.gear, have = [G.tank ? 'Scuba tank' : G.mask ? 'Dive mask' : null, G.fins ? 'Fins' : null, this.gun ? `${this.gun.name} (click to fire)` : null].filter(Boolean);
      this.hudEl = h('div.ow-dive', h('div.ow-air', h('span', 'Air'), h('div.ow-meter', h('i')), h('small.ow-air-s', '')), h('div.ow-gear', have.length ? have.map((x) => h('span', x)) : h('span', 'No dive gear yet: Kai sells it at the tiki bar')), h('div.ow-cross'));
      g.ui.root.append(this.hudEl);
    }
    if (!this.on && this.hudEl) { this.hudEl.remove(); this.hudEl = null; }
    if (!this.hudEl) return;
    const k = this.o2 / this.maxO2;
    this.hudEl.querySelector('.ow-air i').style.width = `${Math.round(k * 100)}%`;
    this.hudEl.querySelector('.ow-air-s').textContent = `${Math.ceil(this.o2)}s`;
    this.hudEl.querySelector('.ow-air').classList.toggle('low', k < 0.3);
    this.hudEl.querySelector('.ow-cross').classList.toggle('hidden', !this.gun);
    { let tw = this.hudEl.querySelector('.ow-tow'); if (this.towing && !tw) { tw = h('div.ow-tow'); this.hudEl.append(tw); } if (tw) { tw.textContent = this.towing ? `Towing: ${this.towing.name} ${Math.round(this.towing.w)} lb. Swim back to the boat.` : ''; tw.classList.toggle('hidden', !this.towing); } }
    this.hudEl.querySelector('.ow-cross').classList.toggle('loading', this.reload > 0);
    const A = this.gun ? this.aimAt() : null, X = this.hudEl.querySelector('.ow-cross');
    X.classList.toggle('lock', !!A?.fish && this.reload <= 0); // (a fish lined up: green)
    X.classList.toggle('reef', !!A?.reef);
    X.dataset.tip = A?.reef ? `Leave it: ${A.reef.sp.name.toLowerCase()}s are protected` : '';
  }
}
