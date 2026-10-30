// Skye's Air Races: a race, as an overlay scene (engine.overlay) like "Above the Clouds": the lake keeps running
// underneath while this is drawn instead. Three laps of a looping circuit against rivals (and party friends):
// a grid start with a countdown (boost right on GO for a perfect start), gates in order (miss one: +2 s), three timing
// sectors with splits, boost rings, tricks, ground effect and slipstream to fill the boost, hidden shortcuts, big
// obstacles and moving hazards, crashes with a quick respawn at the last gate, wrong-way and edge warnings, a mini
// map, positions, and the finish. Time trials replay ghosts; practice has no clock.
import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { mulberry32 } from '../core/rng.js';
import { Track } from './track.js';
import { Region, BIOMES, addAirLibraries } from './region.js';
import { buildObstacle, buildShortcutPiece, hitCollider } from './obstacles.js';
import { buildPlane, PLANES } from './planes.js';
import { Flyer } from './flyer.js';
import { Rival, RIVALS } from './rivals.js';
import { paletteFor, skyDome, stars, aurora, rain, updateRain } from './sky.js';
import { CLASSES } from './circuits.js';
import { mergedMesh, sharedGeometries, MERGED_MATS } from '../north/instancing.js';
import { puffMaterial, cloudClusters, makeWisps, layoutWrapped, cirrus, horizonBanks, speedLines, updateSpeedLines, Puffs } from '../north/flightfx.js';
import { Crowd } from './crowd.js';
import { Flocks } from './flocks.js';

import { stickOf } from './stick.js';
import './air.css';

const UP = new THREE.Vector3(0, 1, 0);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const fmtTime = (s) => { if (!isFinite(s)) return '--:--.--'; const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`; };
const ORD = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const DOT = ['#ffffff', '#ff7a5a', '#7ad8ff', '#ffd24a', '#b88aff', '#7aff9a', '#ff9ad8', '#c8c8c8'];
const MISS_PEN = 2, RESPAWN_T = 1.6, SAFE_T = 2.2;

/** A name tag (a sprite that keeps its size on screen). */
function tag(text, color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = 'bold 30px "Baloo 2", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(10,20,34,0.75)'; x.strokeText(text, 128, 32); x.fillStyle = color; x.fillText(text, 128, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: false, fog: false }));
  s.scale.set(0.2, 0.05, 1); s.renderOrder = 10; return s;
}

export class AirRace {
  /**
   * opts: { circuit, mode 'race'|'trial'|'practice', cls, plane, paint, grid: [{ id, name, me, human, plane, paint }]
   *         (AI fill the rest), seed, rid, host (bool: this client runs the rivals), start (ms epoch for GO, parties),
   *         ghosts: [{ name, lap, samples }], onFinish(result), onQuit() }
   */
  constructor(game, opts) {
    this.game = game; this.opts = opts; this.c = opts.circuit; this.cls = CLASSES[opts.cls] || CLASSES.breeze;
    this.mode = opts.mode || 'race';
    addAirLibraries();
    this.track = new Track(this.c);
    this.rng = mulberry32(opts.seed || 7);
    this.rt = -4; this.t = 0; this.phase = 'grid'; this.camMode = 0; this.shakeK = 0; this.done = false;
    this.ready = false;
  }

  // ================================================================ building
  async build(progress = () => {}) {
    const c = this.c, g = this.game, q = g.engine.quality || 'high';
    const land = c.kind === 'land', B = land ? BIOMES[c.biome] : null;
    const P = this.pal = paletteFor(c, B);
    const sc = this.scene = new THREE.Scene();
    sc.fog = new THREE.Fog(P.fog, land ? 260 : 160, land ? 1700 : 1200);
    this.camera = new THREE.PerspectiveCamera(62, g.engine.width / g.engine.height, 0.5, 3200);
    this.sky = skyDome(P); sc.add(this.sky);
    if (c.phase === 'night') { this.stars = stars(); sc.add(this.stars); this.aur = aurora(); sc.add(this.aur); }
    if (c.weather === 'storm') { this.rain = rain(q === 'low' ? 700 : 1400); sc.add(this.rain); }
    sc.add(new THREE.HemisphereLight(P.mid, land ? (B.col.grass2 || P.shade) : P.shade, P.hemi));
    const sun = this.sunLight = new THREE.DirectionalLight(P.sun, P.sunI);
    sun.castShadow = q !== 'low';
    if (sun.castShadow) { sun.shadow.mapSize.set(1024, 1024); const S = sun.shadow.camera; S.left = S.bottom = -70; S.right = S.top = 70; S.near = 10; S.far = 700; sun.shadow.bias = -0.0006; }
    sc.add(sun); sc.add(sun.target);
    this.cirrus = cirrus(P); sc.add(this.cirrus);
    this.banks = horizonBanks(P); this.banks.scale.set(1.6, 1, 1.6); sc.add(this.banks);
    this.lines = speedLines(); sc.add(this.lines);
    // wingtip vortices: two thin white trails off your wingtips in hard turns and pulls
    this.vort = { n: 36, pts: [[], []] };
    this.vortLine = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    this.vortLine.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 35 * 2 * 3), 3)); this.vortLine.frustumCulled = false; sc.add(this.vortLine);
    this.puffs = new Puffs(sc);
    progress(0.1);
    if (land) {
      this.region = new Region(this.track, c);
      await new Promise((r) => setTimeout(r, 0));
      this.land = new THREE.Group(); this.land.name = 'air-region'; sc.add(this.land);
      this.regionInfo = this.region.build(this.land, q);
      this.land.traverse((o) => { if (o.isMesh && o.name === 'air-land') o.receiveShadow = q !== 'low'; });
    } else {
      // the sea of cloud below (from Above the Clouds), recycled round the camera
      this.TILE = 1600; this.cloudData = cloudClusters(this.TILE, mulberry32(c.id.length * 7 + 3));
      this.cloudMat = puffMaterial(P, new THREE.Vector3(0.4, 0.55, -0.7));
      this.clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, q === 'low' ? 3 : 4), this.cloudMat, this.cloudData.length);
      this.clouds.frustumCulled = false; sc.add(this.clouds);
      this.wisps = makeWisps(sc, P, this.cloudData, this.TILE);
    }
    progress(0.6);
    await new Promise((r) => setTimeout(r, 0));
    this.ctx = { track: this.track, region: this.region, P, cls: this.cls, time: () => this.rt };
    this.obs = [];
    for (const o of c.obstacles || []) { if (o.type === 'gorge') continue; try { this.addObstacle(buildObstacle(o, this.ctx)); } catch (e) { console.warn('[air] obstacle', o.type, e); } }
    for (const s of this.track.shortcuts) { try { this.addObstacle(buildShortcutPiece(s, this.ctx)); } catch (e) { console.warn('[air] shortcut piece', s.id, e); } }
    this.buildGates();
    // v1.17.1: birds along the course, more often on the harder circuits and in the faster classes
    this.flocks = new Flocks(this.scene, this.track, { tier: c.tier || 1, hazards: this.cls.hazards, seed: (this.opts.seed || 1) + (c.id.length * 7) });
    this.validate();
    progress(0.85);
    this.addRacers();
    this.buildHud();
    this.ready = true;
    progress(1);
  }
  addObstacle(O) {
    this.scene.add(O.group);
    O.group.traverse((m) => { if (m.isMesh) { m.castShadow = m.castShadow && this.game.engine.quality === 'high'; } });
    // a bounding sphere for the broad phase (the moving bits stay within a padded one)
    const b = new THREE.Box3().setFromObject(O.group);
    O.bc = b.isEmpty() ? new THREE.Vector3() : b.getCenter(new THREE.Vector3()); O.br = b.isEmpty() ? 0 : b.getSize(new THREE.Vector3()).length() / 2 + 140;
    if (O.group.userData.cloud) this.cloudCols = [...(this.cloudCols || []), O.group.userData.cloud];
    this.obs.push(O);
  }
  /** The line (and each shortcut) must be flyable: anything that blocks it at every moment we look is taken out (and
   *  reported: the tests fail on it, so the circuits' own data gets fixed). Moving things only block it some of the time. */
  validate() {
    const T = this.track, times = [0, 4, 9, 15, 22, 30], report = [];
    const paths = [Array.from({ length: Math.ceil(T.length / 5) }, (_, k) => T.pointAt(k / Math.ceil(T.length / 5)))];
    for (const S of T.shortcuts) { const P = [S.a, S.gates[0].p, S.gates[1].p, S.b], q = []; for (let j = 0; j < 3; j++) for (let k = 0; k <= 16; k++) q.push(P[j].clone().lerp(P[j + 1], k / 16)); paths.push(q); }
    for (const O of [...this.obs]) {
      if (!O.colliders.length) continue;
      let always = true;
      for (const tm of times) { O.update?.(0.016, tm + 5); if (!paths.some((q) => q.some((p) => O.colliders.some((C) => hitCollider(C, p, 2.2))))) { always = false; break; } }
      if (always) { report.push(O.o?.type || 'piece'); this.scene.remove(O.group); this.obs.splice(this.obs.indexOf(O), 1); }
    }
    this.blocked = report;
    if (report.length) console.warn('[air] took out obstacles blocking the course:', this.c.id, report.join(', '));
  }
  /** Anything solid at p (radius r)? (the rivals look ahead with this) */
  solidAt(p, r = 2) {
    for (const O of this.obs) { if (!O.colliders.length || p.distanceToSquared(O.bc) > O.br * O.br) continue; for (const C of O.colliders) if (hitCollider(C, p, r)) return true; }
    for (const C of this.fixedCols) if (hitCollider(C, p, r)) return true;
    return this.region ? !!this.region.hits(p, r) : false;
  }

  buildGates() {
    const T = this.track, sc = this.scene, land = !!this.region;
    this.fixedCols = [];
    const ringGeo = new THREE.TorusGeometry(T.gateR, 0.75, 10, 56);
    this.gateM = T.gates.map((G, i) => {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshLambertMaterial({ color: '#ffd24a', emissive: '#c88a10', emissiveIntensity: 0.6, transparent: true, opacity: 0.95 }));
      m.position.copy(G.p); m.lookAt(G.p.clone().add(G.d)); sc.add(m);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(T.gateR - 0.6, 40), new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      m.add(halo); m.userData.halo = halo;
      // on land, a pair of race pylons stands under each gate (where the ground's near enough)
      const busy = (this.c.obstacles || []).some((o) => o.type !== 'gorge' && T.pointAt(o.t).distanceTo(G.p) < 70);
      if (land && i > 0 && !busy && !T.shortcuts.some((S) => S.from === i || S.to === i)) {
        const right = new THREE.Vector3().crossVectors(G.d, UP).normalize();
        for (const sd of [-1, 1]) {
          const p = G.p.clone().addScaledVector(right, sd * (T.gateR + 10)); const gy = this.region.height(p.x, p.z);
          if (G.p.y - gy > 40 || gy < this.region.water - 1) continue;
          const py = mergedMesh('ar_pylon'); py.position.set(p.x, gy, p.z); const s = Math.max(1, (G.p.y + 4 - gy) / 18); py.scale.setScalar(s); sc.add(py);
          this.fixedCols.push({ k: 'cap', a: new THREE.Vector3(p.x, gy, p.z), b: new THREE.Vector3(p.x, gy + 18 * s, p.z), r: 2.2 * s });
        }
      }
      return m;
    });
    // the start / finish arch round gate 0 (and the grandstand beside it on land)
    const G0 = T.gates[0], s = 1.5, base = G0.p.clone().setY(G0.p.y - 14 * s);
    const arch = mergedMesh('ar_start_arch'); arch.position.copy(base); arch.rotation.y = Math.atan2(G0.d.x, G0.d.z); arch.scale.setScalar(s); sc.add(arch);
    const right0 = new THREE.Vector3().crossVectors(G0.d, UP).normalize();
    for (const sd of [-1, 1]) { const a = base.clone().addScaledVector(right0, sd * 20.5 * s); this.fixedCols.push({ k: 'cap', a: land ? a.clone().setY(this.region.height(a.x, a.z)) : a, b: a.clone().setY(base.y + 24 * s), r: 2.2 * s }); }
    this.fixedCols.push({ k: 'cap', a: base.clone().addScaledVector(right0, -21 * s).setY(base.y + 24.5 * s), b: base.clone().addScaledVector(right0, 21 * s).setY(base.y + 24.5 * s), r: 1.8 * s });
    if (land) {
      const leg = (sd) => { const a = base.clone().addScaledVector(right0, sd * 20.5 * s), gy = this.region.height(a.x, a.z); if (gy < base.y) { const m = new THREE.Mesh(new THREE.BoxGeometry(3 * s, base.y - gy + 1, 3 * s), new THREE.MeshLambertMaterial({ color: '#e8e2d4' })); m.position.set(a.x, (base.y + gy) / 2, a.z); m.rotation.y = arch.rotation.y; sc.add(m); } };
      leg(-1); leg(1);
      const gs = mergedMesh('ar_grandstand'), gp = G0.p.clone().addScaledVector(right0, 80).addScaledVector(G0.d, -20); gp.y = this.region.height(gp.x, gp.z);
      gs.position.copy(gp); gs.rotation.y = Math.atan2(-right0.x, -right0.z); gs.scale.setScalar(1.6); sc.add(gs);
      // v1.17.1: the crowd: both grandstands full, and people lining the start straight either side of the arch
      const crowd = this.crowd = new Crowd(); crowd.fillStand(gs);
      const gp2 = G0.p.clone().addScaledVector(right0, -80).addScaledVector(G0.d, -20); gp2.y = this.region.height(gp2.x, gp2.z);
      if (gp2.y > this.region.water + 0.5) { const gs2 = mergedMesh('ar_grandstand'); gs2.position.copy(gp2); gs2.rotation.y = Math.atan2(right0.x, right0.z); gs2.scale.setScalar(1.6); sc.add(gs2); crowd.fillStand(gs2); }
      const hy = (x, z) => Math.max(this.region.height(x, z), this.region.water + 0.2);
      for (const sd of [-1, 1]) {
        const c = base.clone().addScaledVector(right0, sd * 44).addScaledVector(G0.d, -6);
        if (hy(c.x, c.z) > this.region.water + 0.5) crowd.fillGround(sc, c, G0.d, right0.clone().multiplyScalar(-sd), 46, 34, 7, hy);
      }
    } else {
      // a floating start platform under the arch (an island of cloud-white boards), with a crowd out on it
      const isle = mergedMesh('ar_floating_isle'); isle.position.copy(base).setY(base.y - 1.5); isle.rotation.y = arch.rotation.y; isle.scale.setScalar(1.7); sc.add(isle);
      const crowd = this.crowd = new Crowd(), top = base.y - 1.5 + 2.4;
      for (const sd of [-1, 1]) crowd.fillGround(sc, base.clone().addScaledVector(right0, sd * 24), G0.d, right0.clone().multiplyScalar(-sd), 34, 22, 6, () => top);
    }
    this.crowd.build();
    // v1.17.1: the start lights: a gantry under the arch's beam, facing the grid (red, then yellow, then green)
    {
      const gan = new THREE.Group(), hy0 = base.y + 25.6 * s; // (on top of the banner beam, clear of the gate)
      gan.position.copy(base).setY(hy0); gan.rotation.y = Math.atan2(-G0.d.x, -G0.d.z);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(9.5, 3.4, 1.6), new THREE.MeshLambertMaterial({ color: '#1c1e22' })); gan.add(housing);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(9.9, 0.25, 1.8), new THREE.MeshLambertMaterial({ color: '#f2c21a' })); trim.position.y = -1.8; gan.add(trim);
      for (const sd of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), new THREE.MeshLambertMaterial({ color: '#9aa2ac' })); rod.position.set(sd * 3.6, -2.2, 0); gan.add(rod); }
      const COLS = ['#ff2a1a', '#ffc21a', '#2aff5a'];
      this.lamps = COLS.map((col, i) => {
        const hood = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.7, 20, 1, true), new THREE.MeshLambertMaterial({ color: '#2a2c30', side: THREE.DoubleSide })); hood.rotation.x = Math.PI / 2; hood.position.set((i - 1) * 3, 0, 1.05); gan.add(hood);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), new THREE.MeshBasicMaterial({ color: col })); lens.position.set((i - 1) * 3, 0, 0.82); gan.add(lens);
        const glow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.set((i - 1) * 3, 0, 0.9); gan.add(glow);
        return { lens, glow, col: new THREE.Color(col), on: false };
      });
      sc.add(gan); this.gantry = gan; this.setLights(-1);
    }
    // boost rings: cyan, spinning, on the line
    const bGeo = new THREE.TorusGeometry(6, 0.55, 8, 36);
    this.boostM = T.boost.map((B) => { const m = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: '#6af2ff', transparent: true, opacity: 0.9 })); m.position.copy(B.p); m.lookAt(B.p.clone().add(B.d)); const ch = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.4, 3), new THREE.MeshBasicMaterial({ color: '#c8faff', transparent: true, opacity: 0.6 })); ch.rotation.x = Math.PI / 2; m.add(ch); sc.add(m); return m; });
    // the shortcuts' hidden gates: barely there until you're close
    this.cutM = T.shortcuts.map((S) => S.gates.map((G) => { const m = new THREE.Mesh(new THREE.TorusGeometry(G.r, 0.4, 8, 40), new THREE.MeshBasicMaterial({ color: '#c8f0ff', transparent: true, opacity: 0, depthWrite: false })); m.position.copy(G.p); m.lookAt(G.p.clone().add(G.d)); sc.add(m); return m; }));
    // the guide arrow (floats ahead of your plane, pointing at the next gate)
    const ar = new THREE.Group(), am = new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.85, depthTest: false });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 4), am); cone.rotation.x = Math.PI / 2; cone.position.z = 0.4; ar.add(cone);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 1.0), am); stem.position.z = -0.6; ar.add(stem);
    ar.renderOrder = 9; this.arrow = ar; this.arrowMat = am; sc.add(ar);
  }

  addRacers() {
    const o = this.opts, T = this.track, G0 = T.gates[0], right = new THREE.Vector3().crossVectors(G0.d, UP).normalize();
    const yaw0 = Math.atan2(G0.d.x, -G0.d.z);
    const grid = [...(o.grid || [{ id: 'me', name: this.game.profile?.name || 'You', me: true, human: true, plane: o.plane, paint: o.paint }])];
    if (this.mode === 'race') { const pool = RIVALS.slice(); let k = 0; while (grid.length < 4) { const d = pool[(k + (o.seed || 0)) % pool.length]; k++; if (grid.some((x) => x.name === d.name)) continue; grid.push({ id: `ai${k}`, name: d.name, ai: d, plane: d.plane, paint: d.paint }); } }
    this.racers = grid.map((e, i) => {
      const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
      const pos = G0.p.clone().addScaledVector(G0.d, -(42 + row * 22)).addScaledVector(right, side * 10);
      const S = PLANES[e.plane] || PLANES.snowgoose;
      const f = new Flyer(S, this.cls, { pos, yaw: yaw0 });
      const model = buildPlane(e.plane || 'snowgoose', e.paint || 'factory'); this.scene.add(model.group);
      const R = { ...e, i, f, model, lap: 0, next: 0, passed: 0, prog: 0, fin: 0, pen: 0, lapStart: 0, laps: [], splits: [], crashT: 0, safeT: 0, sc: null, place: i + 1, dot: DOT[i % DOT.length], taken: new Set(), wrongT: 0, cuts: 0, tricks: 0, perfect: false };
      if (e.ai) { R.rival = new Rival(T, e.ai, { rng: mulberry32((o.seed || 1) * 31 + i), shortcuts: this.cls.shortcuts, cls: this.cls }); f.skill = e.ai.skill * this.cls.ai; R.remote = !o.host && o.party; }
      if (!e.me) { R.label = tag(e.name, e.human ? '#bff0ff' : '#ffffff'); this.scene.add(R.label); }
      if (e.human && !e.me) { R.remote = true; R.net = { p: pos.clone(), yaw: yaw0, bank: 0, pitch: 0, at: 0 }; }
      return R;
    });
    this.me = this.racers.find((r) => r.me);
    // ghosts (time trial): a see-through copy of a plane flying a recorded lap
    this.ghosts = (o.ghosts || []).filter((gh) => gh && gh.samples?.length > 4).map((gh) => {
      const m = buildPlane(gh.plane || 'snowgoose', 'factory');
      m.group.traverse((x) => { if (x.isMesh) { x.material = x.material.clone(); x.material.transparent = true; x.material.opacity = 0.35; x.material.depthWrite = false; x.castShadow = false; } });
      this.scene.add(m.group); const lb = tag(`${gh.name} (ghost)`, '#c8e8ff'); this.scene.add(lb);
      return { ...gh, model: m, label: lb };
    });
    this.rec = []; this.recT = 0;
  }

  // ================================================================ the HUD
  buildHud() {
    const g = this.game, T = this.track;
    const btn = (cls, label, on) => h(`button.btn.ghost.small.${cls}`, { on }, label);
    this.el = h('div.air-hud', { role: 'region', 'aria-label': 'Air race' },
      h('div.ar-left', h('div.ar-lap', ''), h('div.ar-pos', ''), h('div.ar-board')),
      h('div.ar-mid', h('div.ar-time', '0:00.00'), h('div.ar-best', ''), h('div.ar-split', '')),
      h('canvas.ar-map', { width: 170, height: 170 }),
      h('div.ar-banner', ''), h('div.ar-count', ''),
      h('div.ar-lights', h('i.red'), h('i.yellow'), h('i.green')),
      h('div.ar-meter', h('span', 'BOOST'), h('i', h('b')), h('em.ar-spd', '')),
      h('div.ar-stick', h('i')),
      h('div.ar-tags', h('span.ar-ge', 'GROUND EFFECT'), h('span.ar-slip', 'SLIPSTREAM')),
      h('div.ar-tip', `${this.c.name}: ${this.mode === 'trial' ? 'time trial' : this.mode === 'practice' ? 'practice' : `${this.cls.name} class`}. A/D to turn (pull back with W in a bank for a tight turn), W/S climb and dive, Shift boost (or move the mouse to fly with it, left button to boost), Q/E roll, Space loop, C camera, B look back.`),
      h('div.ar-btns', btn('ar-b-roll', 'Roll', { click: () => this.trickMe('roll', -1) }), btn('ar-b-loop', 'Loop', { click: () => this.trickMe('loop') }),
        h('button.btn.gold.small.ar-b-boost', { on: { pointerdown: () => { this.boosting = true; this.boostPressT = this.rt; }, pointerup: () => { this.boosting = false; }, pointerleave: () => { this.boosting = false; } } }, 'Boost'),
        btn('ar-b-cam', 'Camera', { click: () => { this.camMode = (this.camMode + 1) % 3; } })),
      h('div.fl-blur'),
      h('button.btn.ghost.small.ar-quit', { on: { click: () => this.quit() } }, icon('close'), 'Quit'));
    g.ui.root.append(this.el); g.ui.root.classList.add('airracing');
    this.$ = (s) => this.el?.querySelector(s) || null;
    // the mini map: the track drawn once, the racers on top every few frames
    const bx = T.box, pad = 40, W = Math.max(bx.max.x - bx.min.x, bx.max.z - bx.min.z) + pad * 2;
    this.mapK = 150 / W; this.mapO = { x: (bx.min.x + bx.max.x) / 2, z: (bx.min.z + bx.max.z) / 2 };
    const base = document.createElement('canvas'); base.width = base.height = 170; const x = base.getContext('2d');
    x.fillStyle = 'rgba(16,28,44,0.55)'; x.beginPath(); x.arc(85, 85, 84, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 3.5; x.lineJoin = 'round'; x.beginPath();
    T.table.forEach((q, i) => { const [u, v] = this.mapXY(q.p); if (i) x.lineTo(u, v); else x.moveTo(u, v); }); x.closePath(); x.stroke();
    x.setLineDash([3, 4]); x.strokeStyle = 'rgba(200,240,255,0.55)'; x.lineWidth = 2;
    for (const S of T.shortcuts) if (this.opts.found?.[S.id]) { const [a, b] = [this.mapXY(S.a), this.mapXY(S.b)]; x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke(); }
    x.setLineDash([]); const [su, sv] = this.mapXY(T.gates[0].p); x.fillStyle = '#ffd24a'; x.fillRect(su - 4, sv - 4, 8, 8);
    this.mapBase = base; this.mapT = 0;
    // v1.17.1: mouse flying. Move the mouse and it becomes a joystick (the middle of the screen is centre stick, with a
    // small dead zone); it stays on until you steer with the keys. Hold the left button to boost.
    this.onMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const r = g.engine.renderer.domElement.getBoundingClientRect(), m = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
      if (!this.mouseMode) { if (this.mouse0 && Math.hypot(e.clientX - this.mouse0[0], e.clientY - this.mouse0[1]) > 40) this.mouseMode = true; else if (!this.mouse0) this.mouse0 = [e.clientX, e.clientY]; }
      this.mouse = m;
    };
    window.addEventListener('pointermove', this.onMove);
    this.onPDown = (e) => { if (e.pointerType !== 'mouse' || e.button !== 0 || !this.mouseMode || e.target?.closest?.('button, .panel')) return; if (!this.boosting) this.boostPressT = this.rt; this.boosting = this.mouseBoost = true; };
    this.onPUp = (e) => { if (e.button === 0 && this.mouseBoost) { this.boosting = this.mouseBoost = false; } };
    window.addEventListener('pointerdown', this.onPDown); window.addEventListener('pointerup', this.onPUp);
    this.onKey = (e) => {
      if (this.done || e.target?.closest?.('input, textarea')) return;
      const k = e.key.toLowerCase(), down = e.type === 'keydown';
      if (k === 'shift') { if (down && !this.boosting) this.boostPressT = this.rt; this.boosting = down; return; }
      if (k === 'b') { this.lookBack = down; return; }
      if (down && ['a', 'd', 'w', 's', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) { this.mouseMode = false; this.mouse0 = null; }
      if (!down || e.repeat) return;
      if (k === 'q' || k === 'e') { e.preventDefault(); e.stopImmediatePropagation(); this.trickMe('roll', k === 'q' ? -1 : 1); }
      else if (k === ' ' || k === 'r') { e.preventDefault(); e.stopImmediatePropagation(); this.trickMe('loop'); }
      else if (k === 'c') { this.camMode = (this.camMode + 1) % 3; }
    };
    window.addEventListener('keydown', this.onKey, true); window.addEventListener('keyup', this.onKey, true);
  }
  mapXY(p) { return [85 + (p.x - this.mapO.x) * this.mapK, 85 + (p.z - this.mapO.z) * this.mapK]; }
  banner(text, cls = '', ms = 1400) {
    const b = this.$('.ar-banner'); if (!b) return;
    b.textContent = text; b.className = `ar-banner on ${cls}`; clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { if (b.textContent === text) b.className = 'ar-banner'; }, ms);
  }
  pop(text, color = '#fff4c8') { this.game.juice?.pop(text, { color, size: 28, ms: 900 }); }
  sfx(n, o) { this.game.audio?.sfx?.(n, o); }
  /** The start lights, in the world and on the HUD: -1 all dark, 0 red, 1 yellow, 2 green (one lamp at a time). */
  setLights(k) {
    this.lightK = k;
    for (const [i, L] of (this.lamps || []).entries()) { const on = i === k; L.lens.material.color.copy(L.col).multiplyScalar(on ? 1.6 : 0.16); L.glow.material.opacity = on ? 0.55 : 0; }
    const els = this.$?.('.ar-lights')?.children; if (els) [...els].forEach((e, i) => e.classList.toggle('lit', i === k));
  }
  shake(k) { this.shakeK = Math.max(this.shakeK, k); }

  // ================================================================ your controls
  trickMe(kind, dir = 1) {
    const R = this.me; if (!R || this.phase !== 'race' || R.crashT > 0 || R.fin) return;
    if (R.f.trick(kind, dir, this.region ? Infinity : 320)) this.sfx('whoosh');
  }
  myInput() {
    const pl = this.game.player;
    let steer = (pl.held('right') ? 1 : 0) - (pl.held('left') ? 1 : 0);
    let climb = (pl.held('up') ? 1 : 0) - (pl.held('down') ? 1 : 0);
    if (!steer && !climb && this.mouseMode && this.mouse) { const st = stickOf(this.mouse); steer = st.x; climb = -st.y; }
    if (pl.stick) { steer = pl.stick.x; climb = -pl.stick.y; }
    return { steer, climb, boost: !!this.boosting };
  }

  // ================================================================ per frame
  update(dt, t) {
    if (!this.ready) return;
    dt = Math.min(dt, 0.05);
    const g = this.game;
    this.t += dt;
    this.camera.aspect = g.engine.width / g.engine.height;
    // the clock: a countdown to GO (shared with the party), then the race
    if (this.phase === 'grid') {
      if (this.opts.start) this.rt = (Date.now() - this.opts.start) / 1000; else this.rt += dt;
      const n = Math.ceil(-this.rt);
      // v1.17.1: the lights: "Get ready", then red, then yellow, then green for GO (each with its own tone)
      if (n !== this.lastCount) {
        this.lastCount = n; const el = this.$('.ar-count');
        if (n >= 3) { el.textContent = 'Get ready'; el.className = 'ar-count on small'; this.setLights(-1); this.$('.ar-lights')?.classList.add('on'); }
        else if (n === 2) { el.className = 'ar-count'; this.setLights(0); this.sfx('lightRed'); this.crowd?.cheer(0.55); }
        else if (n === 1) { this.setLights(1); this.sfx('lightYellow'); this.crowd?.cheer(0.75); }
      }
      if (this.rt >= 0) this.go();
    } else this.rt += dt;
    // the world moves on (moving obstacles run on the race clock, the same for everyone in a party)
    for (const O of this.obs) O.update?.(dt, Math.max(0, this.rt) + 5);
    this.region?.update(dt, this.t);
    this.crowd?.update(dt, this.t);
    this.flocks?.update(dt, this.t, this.auto ? null : this.me, this);
    // the racers
    for (const R of this.racers) this.stepRacer(R, dt);
    for (const G of this.ghosts) this.stepGhost(G);
    if (this.phase !== 'grid') this.positions();
    this.view(dt);
    this.env(dt);
    this.hud(dt);
    if (this.phase === 'race' && this.me.fin && !this.finishing) this.finishing = { t: this.rt };
    if (this.finishing && !this.done && (this.racers.every((r) => r.fin || r.gone) || this.rt - this.finishing.t > 14 || this.mode !== 'race')) this.finishRace();
  }
  /** Tests and tools: run the race on for `sec` seconds of race time without drawing (fixed steps). */
  sim(sec, step = 1 / 30) { const n = Math.round(sec / step); for (let i = 0; i < n && !this.done; i++) { if (this.phase === 'grid' && this.opts.start) this.opts.start -= step * 1000; this.update(step, this.t + step); } return this.done; }
  go() {
    this.phase = 'race'; this.rt = Math.max(0, this.rt);
    const el = this.$('.ar-count'); el.textContent = 'GO!'; el.className = 'ar-count on go'; setTimeout(() => { el.className = 'ar-count'; }, 900);
    this.setLights(2); this.sfx('lightGreen'); this.sfx('crowd', { vol: 1.1, dur: 3.6 }); this.crowd?.cheer(1);
    setTimeout(() => { this.$?.('.ar-lights')?.classList.remove('on'); }, 2200);
    if (this.mode === 'race') this.game.chat?.npcSay?.('Skye Halloran', ['And they\'re off!', 'Green light, go go go!', 'Wheels up and racing!'][Math.floor(this.rng() * 3)]);
    setTimeout(() => { const tip = this.$?.('.ar-tip'); if (tip) tip.textContent = ''; }, 9000);
    for (const R of this.racers) {
      R.lapStart = 0;
      // a perfect start: boost pressed right on GO (rivals usually nail it)
      // (boost pressed in the last quarter second before GO, or just after it: a perfect start; pressed sooner: a stall)
      if (R.me) { const p = this.boostPressT ?? -9; if (p > -0.9 && p < -0.25) { R.early = true; R.f.slowT = 1.2; this.banner('Too early!', 'warn'); } else if (p >= -0.25) this.perfectStart(R); }
      else if (R.rival && this.rng() < 0.6) R.f.burst = 12;
    }
    this.goPressWatch = 0.35;
  }
  perfectStart(R) { R.f.burst = 16; R.perfect = true; this.banner('PERFECT START!', 'good'); this.sfx('superland'); }

  stepRacer(R, dt) {
    const f = R.f;
    if (R.remote && !R.ai) return this.stepRemote(R, dt);
    if (R.remote && R.ai) { if (this.stepRemoteAI(R, dt)) return; }
    if (this.phase === 'grid') {
      R.model.animate(dt, { throttle: 0.4 }); f.pose(R.model.group, this.t); this.placeLabel(R); return;
    }
    if (R.me && this.goPressWatch > 0) { this.goPressWatch -= dt; if ((this.boostPressT ?? -9) >= 0 && !R.perfect && !R.early) this.perfectStart(R); }
    if (R.crashT > 0) { R.crashT -= dt; if (R.crashT <= 0) this.respawn(R); R.model.group.visible = false; this.placeLabel(R); return; }
    R.safeT = Math.max(0, R.safeT - dt);
    // controls: you, a rival, or (after your finish, or in tests) the autopilot
    let inp;
    if (R.me && !R.fin && !this.auto) inp = this.myInput();
    else { if (!R.rival) R.rival = new Rival(this.track, { name: R.name, skill: 1, lane: 0 }, { rng: mulberry32(5), shortcuts: !!this.autoCuts, cls: this.cls }); inp = R.rival.think(dt, f, R, this); }
    // bounds: soft walls either side of the line turn you back, a hard one stops you leaving; a ceiling and a floor
    const near = this.track.nearest(f.pos, R.nt ?? null); R.nt = near.t; R.near = near;
    const soft = this.region ? 230 : 260;
    // (the walls are measured from the line or a shortcut, whichever's nearer: a shortcut can run a long way from the line)
    let bd = near.dist;
    for (const S of this.track.shortcuts) { const ab = S.b.clone().sub(S.a).setY(0), q = f.pos.clone().sub(S.a).setY(0), k = Math.max(0, Math.min(1, q.dot(ab) / ab.lengthSq())); bd = Math.min(bd, q.sub(ab.multiplyScalar(k)).length()); }
    near.wall = bd;
    if (bd > soft && !f.tr) {
      const want = Math.atan2(near.p.x - f.pos.x, -(near.p.z - f.pos.z)); inp.steer = Math.max(-1, Math.min(1, wrap(want - f.yaw) * 2));
      if (R.me && !R.edgeWarned) { R.edgeWarned = true; this.banner('Turning back to the course', 'info'); }
    } else if (bd < soft - 40) R.edgeWarned = false;
    // rubber band (gentle, and never in a party: everyone must see the same rivals)
    if (R.rival && !R.me && this.mode === 'race' && !this.opts.party && this.me && !this.me.fin) {
      const gap = R.prog - this.me.prog; f.speedMul *= gap > 0.7 ? 0.93 : gap < -1.0 ? 1.07 : gap < -0.4 ? 1.03 : 1;
    }
    // ground effect (skim the ground or water) and slipstream (tuck in behind another plane): both fill the boost
    R.ge = false; R.slip = false;
    if (this.region) { const gy = Math.max(this.region.height(f.pos.x, f.pos.z), this.region.water); if (f.pos.y - gy < 9) { R.ge = true; f.meter = Math.min(1, f.meter + dt * 0.11); } }
    for (const O of this.racers) { if (O === R || O.crashT > 0 || !O.f) continue; const d = O.f.pos.clone().sub(f.pos); const L = d.length(); if (L < 32 && L > 4 && d.dot(f.fwd) / L > 0.93) { R.slip = true; f.meter = Math.min(1, f.meter + dt * 0.13); f.speedMul *= 1.04; if (R.me && L < 14) this.shake(0.12); break; } } // (right in someone's wake, it's a little bumpy)
    for (const O of this.obs) if (O.effect && f.pos.distanceToSquared(O.bc) < O.br * O.br) O.effect(f, dt, this.api(R));
    const trickDone = f.step(dt, inp);
    if (trickDone) { R.tricks++; if (R.me) { this.pop(trickDone === 'loop' ? 'LOOP THE LOOP! +BOOST' : 'BARREL ROLL! +BOOST', '#ffd0f0'); this.myTricks = (this.myTricks || 0) + 1; } }
    const ceil = this.region ? near.p.y + 160 : 330, floor = this.region ? -999 : -30;
    if (f.pos.y > ceil) f.pos.y = ceil; if (f.pos.y < floor) f.pos.y = floor;
    if (bd > soft + 90 && near.dist > soft + 90) { const k = (soft + 90) / near.dist; f.pos.x = near.p.x + (f.pos.x - near.p.x) * k; f.pos.z = near.p.z + (f.pos.z - near.p.z) * k; }
    // wrong way?
    if (R.me) { const dot = f.fwd.dot(near.d.clone().setY(0).normalize()); R.wrongT = dot < -0.3 && !R.sc && !f.tr ? R.wrongT + dt : 0; }
    // collisions (not just after a respawn)
    if (!R.safeT && this.phase === 'race') {
      const what = this.collide(f.pos, 1.6);
      if (what) this.crash(R, what);
      // a near miss (within a few metres of something solid, and through): a little boost and a cheer
      else if (R.me && this.t - (this.nearT || -9) > 1.5 && this.collide(f.pos, 5.5) && !this.region?.hits(f.pos, 5.5)) { this.nearT = this.t; f.meter = Math.min(1, f.meter + 0.08); this.pop('NEAR MISS! +BOOST', '#c8f4ff'); this.nearMisses = (this.nearMisses || 0) + 1; }
    }
    if (R.crashT > 0) return;
    if (!R.fin) { this.gates(R); this.rings(R); }
    R.model.group.visible = !(R.safeT > 0 && Math.floor(this.t * 10) % 2);
    f.pose(R.model.group, this.t, R.me ? this.stormShake || 0 : 0);
    R.model.animate(dt, { throttle: f.throttle });
    this.placeLabel(R);
    if (R.me && this.mode === 'trial' && !R.fin) { this.recT -= dt; if (this.recT <= 0) { this.recT = 0.2; this.rec.push([+(this.rt - R.lapStart).toFixed(2), +f.pos.x.toFixed(1), +f.pos.y.toFixed(1), +f.pos.z.toFixed(1), +f.yaw.toFixed(2), +f.bank.toFixed(2)]); } }
  }
  /** What a hazard can do to a racer (only yours gets the pop-ups and the shake). */
  api(R) {
    const me = R.me, race = this;
    return { t: this.rt, shake: (k) => { if (me) race.shake(k); }, pop: (s, c) => { if (me) race.pop(s, c); }, crash: (why) => race.crash(R, why), birdStrike: () => race.birdStrike(R) };
  }
  collide(p, r) {
    for (const O of this.obs) { if (!O.colliders.length || p.distanceToSquared(O.bc) > O.br * O.br) continue; for (const C of O.colliders) if (hitCollider(C, p, r)) return O.o?.type || 'scenery'; }
    for (const C of this.fixedCols) if (hitCollider(C, p, r)) return 'pylon';
    return this.region?.hits(p, r) || null;
  }
  birdStrike(R) {
    const f = R.f; f.slowT = 2.5; f.burst = 0; f.meter = Math.max(0, f.meter - 0.2);
    this.puffs.burst(f.pos.clone().addScaledVector(f.fwd, 3), 45);
    if (R.me) { this.banner('BIRD STRIKE!', 'warn'); this.sfx('flap'); this.shake(0.6); this.strikes = (this.strikes || 0) + 1; }
  }
  crash(R, what) {
    if (R.crashT > 0 || R.safeT > 0 || R.fin) return;
    R.crashT = RESPAWN_T; R.f.tr = null;
    this.puffs.burst(R.f.pos.clone(), 70, '#6a6a6a');
    if (R.me) { this.banner(what === 'lightning' ? 'ZAPPED!' : 'CRASH!', 'bad'); this.sfx('chestburst'); this.shake(1.2); this.crashes = (this.crashes || 0) + 1; }
  }
  /** Back at the last gate you passed, facing on, a moment's grace. */
  respawn(R) {
    const T = this.track, n = T.gates.length;
    let G = T.gates[(R.next - 1 + n) % n];
    if (R.sc) { G = T.gates[R.sc.from]; R.sc = null; }
    if (R.passed === 0) G = { p: T.gates[0].p.clone().addScaledVector(T.gates[0].d, -40), d: T.gates[0].d };
    const f = R.f; f.pos.copy(G.p); f.prev.copy(G.p); f.yaw = Math.atan2(G.d.x, -G.d.z); f.pitch = 0; f.bank = 0; f.dive = 0; f.burst = 6; f.slowT = 0;
    R.safeT = SAFE_T; R.model.group.visible = true; R.nt = G.t ?? R.nt;
    if (R.rival) R.rival.path = null;
  }

  // ---------------------------------------------------------------- gates, laps, shortcuts, boost rings
  gates(R) {
    const T = this.track, n = T.gates.length, f = R.f, a = f.prev, b = f.pos;
    // a shortcut's hidden gates (you have to have just passed the gate it leaves from)
    for (const S of T.shortcuts) {
      if (R.sc === S) { if (R.scI < S.gates.length && Track.crossed(a, b, S.gates[R.scI], 1.3)) R.scI++; continue; }
      if (R.next !== (S.from + 1) % n || R.sc) continue;
      if (Track.crossed(a, b, S.gates[0], 1.3)) {
        R.sc = S; R.scI = 1; R.cuts++;
        if (R.me) { const first = !this.opts.found?.[S.id]; this.banner(first ? `SHORTCUT FOUND! ${S.name}` : `Shortcut: ${S.name}`, 'cut', 2200); this.sfx(first ? 'diamond' : 'whoosh'); (this.foundNow = this.foundNow || new Set()).add(S.id); if (this.opts.found) this.opts.found[S.id] = 1; }
      }
    }
    // the line's gates: the next one, or (missing some) one of the two after it; on a shortcut, the gate it rejoins at
    const cand = R.sc ? [R.sc.to] : [R.next, (R.next + 1) % n, (R.next + 2) % n];
    for (const k of cand) {
      const G = T.gates[k];
      const da = a.clone().sub(G.p).dot(G.d), db = b.clone().sub(G.p).dot(G.d);
      if (!(da < 0 && db >= 0)) continue;
      const hit = a.clone().lerp(b, da / (da - db)), off = hit.distanceTo(G.p);
      if (off < G.r * 1.15) { this.passGate(R, k); return; }
      if (k === R.next && off < 150 && !R.sc) { this.missGate(R, k); return; }
    }
  }
  passGate(R, k) {
    const T = this.track, n = T.gates.length;
    // any gates flown past without going through: missed (unless a shortcut skipped them)
    let skipped = (k - R.next + n) % n;
    if (R.sc) { R.passed += skipped; skipped = 0; R.sc = null; }
    for (let s = 0; s < skipped; s++) this.penalise(R);
    R.passed += skipped + 1; R.next = (k + 1) % n;
    if (R.me) { this.gateM[k].userData.flash = 1; this.sfx('coin', { vol: 0.5 }); }
    if (k === 0) this.lapLine(R);
    else if (T.sectors.includes(k)) this.split(R, T.sectors.indexOf(k));
  }
  missGate(R, k) {
    const n = this.track.gates.length;
    this.penalise(R); R.passed++; R.next = (k + 1) % n;
    if (k === 0) this.lapLine(R);
  }
  penalise(R) {
    if (this.mode === 'practice') { if (R.me) this.banner('Missed a gate', 'warn'); return; }
    R.pen += MISS_PEN; if (R.me) { this.banner(`MISSED GATE  +${MISS_PEN}s`, 'bad'); this.sfx('miss'); this.missed = (this.missed || 0) + 1; }
  }
  split(R, i, at = null) {
    const lapT = at ?? this.rt - R.lapStart; R.splits[i] = lapT;
    if (!R.me) return;
    const best = this.opts.bestSplits?.[i];
    if (best) { const d = lapT - best; const el = this.$('.ar-split'); el.textContent = `${d <= 0 ? '' : '+'}${d.toFixed(2)}`; el.className = `ar-split on ${d <= 0 ? 'good' : 'bad'}`; clearTimeout(this.splitT); this.splitT = setTimeout(() => { el.className = 'ar-split'; }, 2600); }
  }
  lapLine(R) {
    const laps = this.mode === 'practice' ? Infinity : this.c.laps;
    if (R.lap === 0) { R.lap = 1; R.lapStart = this.rt; R.taken.clear(); if (R.me) this.rec = []; return; }
    const lt = this.rt - R.lapStart; R.laps.push(lt); R.lapStart = this.rt; R.taken.clear();
    if (R.me) {
      const best = Math.min(...R.laps);
      this.split(R, 2, lt); // (the third split is the lap itself)
      (R.lapSplits = R.lapSplits || []).push(R.splits.slice(0, 3)); R.splits = [];
      if (this.mode === 'trial' && this.rec.length) { const samples = this.rec; this.rec = []; if (lt <= best) this.bestLapRec = { lap: lt, samples }; }
      if (this.mode === 'practice') this.banner(`Lap ${fmtTime(lt)}${lt <= best ? '  (best)' : ''}`, 'info', 2000);
    }
    if (R.lap >= laps) { R.fin = this.rt + R.pen; R.finRaw = this.rt; if (R.me) this.sfx('superland'); return; }
    R.lap++;
    if (R.me && R.lap === laps) { this.banner('FINAL LAP!', 'info', 1800); this.sfx('bell'); }
  }
  rings(R) {
    const T = this.track, f = R.f;
    T.boost.forEach((B, i) => {
      if (R.taken.has(i)) return;
      if (Track.crossed(f.prev, f.pos, B, 1.3)) { R.taken.add(i); f.burst = 14; f.meter = Math.min(1, f.meter + 0.3); if (R.me) { this.sfx('whoosh'); this.pop('BOOST!', '#9af6ff'); this.boostM[i].userData.flash = 1; } }
    });
  }

  // ---------------------------------------------------------------- the others, over the net
  stepRemote(R, dt) {
    const st = this.opts.peerState?.(R.id);
    if (st && st.r === this.opts.rid && Array.isArray(st.p)) {
      R.net.p.set(st.p[0], st.p[1], st.p[2]); R.net.yaw = st.y || 0; R.net.bank = st.b || 0; R.net.pitch = st.pi || 0; R.net.at = this.t;
      R.prog = +st.pr || 0; R.lap = st.l || 0; if (st.f) R.fin = st.f; R.crashT = st.c ? 1 : 0;
    } else if (this.t - R.net.at > 6) R.gone = true;
    const f = R.f; f.pos.lerp(R.net.p, Math.min(1, dt * 8)); f.yaw += wrap(R.net.yaw - f.yaw) * Math.min(1, dt * 8); f.bank += (R.net.bank - f.bank) * Math.min(1, dt * 6); f.pitch += (R.net.pitch - f.pitch) * Math.min(1, dt * 6);
    R.model.group.visible = !R.crashT && !R.gone;
    f.pose(R.model.group, this.t); R.model.animate(dt, { throttle: 0.85 }); this.placeLabel(R);
  }
  /** A rival flown by the party's host: follow the host's copy (or fly it here if the host's gone quiet). */
  stepRemoteAI(R, dt) {
    const st = this.opts.peerState?.(this.opts.hostId), a = st && st.r === this.opts.rid && Array.isArray(st.ai) ? st.ai[R.i] : null;
    if (!a) { if (this.t - (R.aiAt ?? this.t) > 3) { R.remote = false; return false; } R.aiAt = R.aiAt ?? this.t; return true; }
    R.aiAt = this.t;
    const f = R.f, p = new THREE.Vector3(a[0], a[1], a[2]); f.prev.copy(f.pos); f.pos.lerp(p, Math.min(1, dt * 8)); f.yaw += wrap(a[3] - f.yaw) * Math.min(1, dt * 8); f.bank += (a[4] - f.bank) * Math.min(1, dt * 6);
    R.prog = a[5]; if (a[6]) R.fin = a[6]; R.lap = a[7] || R.lap; R.next = a[8] ?? R.next; R.passed = a[9] ?? R.passed; R.crashT = 0;
    f.pose(R.model.group, this.t); R.model.animate(dt, { throttle: 0.85 }); R.model.group.visible = !a[10]; this.placeLabel(R);
    return true;
  }
  placeLabel(R) { if (!R.label) return; R.label.position.copy(R.f.pos).add(new THREE.Vector3(0, 4.2, 0)); R.label.visible = R.model.group.visible && R.f.pos.distanceTo(this.camera.position) < 600; }
  stepGhost(G) {
    const me = this.me; if (!me || me.lap < 1 || me.fin) { G.model.group.visible = false; G.label.visible = false; return; }
    const lt = this.rt - me.lapStart, S = G.samples;
    let i = 0; while (i < S.length - 2 && S[i + 1][0] < lt) i++;
    const a = S[i], b = S[i + 1], k = Math.max(0, Math.min(1, (lt - a[0]) / Math.max(0.01, b[0] - a[0])));
    if (lt > S[S.length - 1][0] + 0.5) { G.model.group.visible = false; G.label.visible = false; return; }
    const gp = G.model.group; gp.visible = true; gp.position.set(a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k);
    gp.rotation.order = 'YXZ'; gp.rotation.set(0, Math.PI - (a[4] + wrap(b[4] - a[4]) * k), -(a[5] + (b[5] - a[5]) * k) * 0.65);
    G.model.animate(0.016, { throttle: 0.8 }); G.label.position.copy(gp.position).add(new THREE.Vector3(0, 4, 0)); G.label.visible = true;
  }

  // ---------------------------------------------------------------- the order
  positions() {
    const T = this.track, n = T.gates.length;
    for (const R of this.racers) {
      if ((R.remote && !R.ai) || (R.remote && R.ai && R.aiAt === this.t)) continue;
      const last = T.gates[(R.next - 1 + n) % n], nx = T.gates[R.next];
      const span = T.arcLength(last.t, nx.t) || 1, along = R.nt == null ? 0 : T.arcLength(last.t, R.nt);
      R.prog = R.passed + Math.max(0, Math.min(0.99, along > span * 1.5 ? 0 : along / span));
    }
    const live = this.racers.filter((r) => !r.gone);
    live.sort((a, b) => (a.fin && b.fin ? a.fin - b.fin : a.fin ? -1 : b.fin ? 1 : b.prog - a.prog));
    live.forEach((r, i) => { r.place = i + 1; });
  }

  // ---------------------------------------------------------------- camera, sky, effects
  view(dt) {
    const R = this.me, f = R.f, cam = this.camera;
    if (this.phase === 'grid') {
      // a sweep round the grid while the lights count down
      const a = this.t * 0.25 + 2.4, c = f.pos.clone().add(new THREE.Vector3(Math.sin(a) * 34, 9, Math.cos(a) * 34));
      cam.position.lerp(c, this.camInit ? Math.min(1, dt * 2) : 1); this.camInit = true; cam.lookAt(f.pos.x, f.pos.y + 1, f.pos.z);
    } else if (this.done) {
      const a = this.t * 0.18, c = f.pos.clone().add(new THREE.Vector3(Math.sin(a) * 26, 8, Math.cos(a) * 26)); cam.position.lerp(c, Math.min(1, dt * 1.5)); cam.lookAt(f.pos);
    } else {
      const fw = f.fwd, back = fw.clone().negate(), dist = [19, 32, 0][this.camMode], up = [5.5, 10, 1.6][this.camMode];
      let want;
      if (this.camMode === 2) want = f.pos.clone().addScaledVector(fw, 2.5).add(new THREE.Vector3(0, 1.6, 0));
      else want = f.pos.clone().addScaledVector(this.lookBack ? fw : back, dist).add(new THREE.Vector3(0, up - f.pitch * 2, 0));
      if (this.region) { const gy = Math.max(this.region.height(want.x, want.z), this.region.water) + 2.5; if (want.y < gy) want.y = gy; }
      if (R.crashT > 0) want = cam.position.clone();
      cam.position.lerp(want, this.camMode === 2 ? 1 : Math.min(1, dt * (f.tr ? 2.5 : 4)));
      if (f.tr?.kind === 'loop' && this.camMode !== 2) cam.lookAt(f.pos.x, f.pos.y + 1, f.pos.z);
      else if (this.lookBack) cam.lookAt(f.pos.clone().addScaledVector(back, 20));
      else cam.lookAt(f.pos.x + fw.x * 24, f.pos.y + (this.camMode === 2 ? 1.4 : 1.5) + f.pitch * (this.camMode === 2 ? 8 : 0), f.pos.z + fw.z * 24);
      if (this.camMode === 2) cam.rotateZ(-f.bank * 0.5 - f.roll);
    }
    if (this.shakeK > 0) { cam.position.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), 0).multiplyScalar(this.shakeK)); this.shakeK = Math.max(0, this.shakeK - dt * 2.5); }
    const boostK = Math.max(f.boostK, Math.min(1, f.burst / 16));
    cam.fov = 62 + boostK * 16; cam.updateProjectionMatrix();
    updateSpeedLines(this.lines, cam, dt, f.speed, this.phase === 'race' ? boostK : 0);
    this.blur = boostK;
    // the guide arrow: a little ahead of the plane, pointing at the next gate (red when you're going the wrong way)
    const T = this.track, next = R.sc ? T.gates[R.sc.to] : T.gates[R.next];
    const tgt = R.sc && R.scI < R.sc.gates.length ? R.sc.gates[R.scI].p : next.p;
    this.arrow.visible = this.phase === 'race' && !R.fin && R.crashT <= 0 && this.camMode !== 2;
    this.arrow.position.copy(f.pos).addScaledVector(f.fwd, 9).add(new THREE.Vector3(0, 3.2, 0)); this.arrow.lookAt(tgt);
    this.arrowMat.color.set(R.wrongT > 1.2 ? '#ff5a4a' : '#ffd24a');
  }
  env(dt) {
    const cam = this.camera, f = this.me.f;
    this.sky.position.copy(cam.position); if (this.stars) this.stars.position.copy(cam.position);
    if (this.aur) { this.aur.position.set(cam.position.x, 0, cam.position.z); for (const m of this.aur.userData.mats) m.uniforms.uT.value = this.t; }
    this.cirrus.position.set(cam.position.x, this.region ? 520 : 420, cam.position.z); this.cirrus.material.uniforms.uT.value = this.t; this.cirrus.material.uniforms.uOff.value.set(cam.position.x / 3600, cam.position.z / 3600);
    this.banks.position.set(cam.position.x, this.region ? 60 : 40, cam.position.z);
    this.sunLight.position.set(f.pos.x + 260, f.pos.y + 380, f.pos.z - 480); this.sunLight.target.position.copy(f.pos);
    if (this.rain) updateRain(this.rain, cam.position, dt, f.fwd.clone().multiplyScalar(f.speed));
    this.puffs.update(dt);
    { // wingtip vortices
      const V = this.vort, side = new THREE.Vector3(Math.cos(f.yaw), 0, Math.sin(f.yaw)), k = Math.min(1, Math.max(0, Math.abs(f.bank) - 0.55) * 2.5 + Math.max(0, f.pitch - 0.6) * 2 + (f.tr ? 1 : 0));
      V.k = (V.k || 0) + (k - (V.k || 0)) * Math.min(1, dt * 4);
      const span = this.me.model.kind === 'biplane' ? 4.4 : 5.6;
      [-1, 1].forEach((sd, i) => { V.pts[i].unshift(f.pos.clone().addScaledVector(side, sd * span).add(new THREE.Vector3(0, 0.6 - sd * f.bank * 1.5, 0))); if (V.pts[i].length > V.n) V.pts[i].pop(); });
      const a = this.vortLine.geometry.attributes.position; let w = 0;
      for (const P of V.pts) for (let j = 0; j < 35; j++) { const p = P[j] || f.pos, q = P[j + 1] || p; a.setXYZ(w++, p.x, p.y, p.z); a.setXYZ(w++, q.x, q.y, q.z); }
      a.needsUpdate = true; this.vortLine.material.opacity = V.k * 0.5 * (this.me.crashT > 0 ? 0 : 1);
    }
    // in a cloud (the cloud sea below, a column) the fog closes in
    let inCloud = 0;
    if (!this.region) {
      inCloud = f.pos.y < 6 ? Math.min(1, (6 - f.pos.y) / 5) : 0;
      this.cloudT = (this.cloudT || 0) - dt;
      if (this.cloudT <= 0) { this.cloudT = 0.2; layoutWrapped(this.clouds, this.cloudData, cam.position, this.TILE); layoutWrapped(this.wisps.im, this.wisps.items, cam.position, this.TILE, () => 1); }
      this.cloudMat.uniforms.uT.value = this.t;
    }
    for (const C of this.cloudCols || []) { const d = Math.hypot(f.pos.x - C.c.x, f.pos.z - C.c.z); if (d < C.r && f.pos.y > C.c.y - 60 && f.pos.y < C.c.y + 160) inCloud = Math.max(inCloud, 1 - d / C.r * 0.6); }
    this.cloudK = (this.cloudK || 0) + (inCloud - (this.cloudK || 0)) * Math.min(1, dt * 3);
    const near0 = this.region ? 260 : 160, far0 = this.region ? 1700 : 1200;
    this.scene.fog.near = near0 - this.cloudK * (near0 - 4); this.scene.fog.far = far0 - this.cloudK * (far0 - 70);
    if (this.cloudMat) for (const m of [this.cloudMat, this.wisps.im.material]) { m.uniforms.uFogNear.value = this.scene.fog.near; m.uniforms.uFogFar.value = this.scene.fog.far; }
    for (const O of this.obs) { const m = O.group.userData.mat || O.group.children[0]?.userData?.mat; if (m?.uniforms?.uFogNear) { m.uniforms.uFogNear.value = this.scene.fog.near; m.uniforms.uFogFar.value = this.scene.fog.far; } }
    this.stormShake = 0;
    // gates: the next one glows gold, the one after is pale, the rest are faint; passed ones flash and shrink away
    const R = this.me, n = this.track.gates.length;
    this.gateM.forEach((m, i) => {
      const rel = (i - R.next + n) % n, mat = m.material;
      if (m.userData.flash) { m.userData.flash = Math.max(0, m.userData.flash - dt * 2); m.scale.setScalar(1 + (1 - m.userData.flash) * 0.4); mat.opacity = m.userData.flash; return; }
      m.scale.setScalar(1);
      const fin = R.fin || this.phase === 'grid' && i !== 0;
      if (rel === 0 && !R.sc && !fin) { mat.color.set(i === 0 ? '#ffffff' : '#ffd24a'); mat.emissive.set(i === 0 ? '#c8c8c8' : '#c88a10'); mat.emissiveIntensity = 0.7 + Math.sin(this.t * 6) * 0.25; mat.opacity = 0.95; m.userData.halo.material.opacity = 0.14; }
      else if (rel === 1 && !fin) { mat.color.set('#fff6d8'); mat.emissive.set('#806a30'); mat.emissiveIntensity = 0.3; mat.opacity = 0.55; m.userData.halo.material.opacity = 0.04; }
      else { mat.color.set('#e8e2d4'); mat.emissive.set('#000000'); mat.opacity = 0.22; m.userData.halo.material.opacity = 0; }
    });
    this.boostM.forEach((m, i) => { m.rotation.z += dt * 2; if (m.userData.flash) { m.userData.flash = Math.max(0, m.userData.flash - dt * 1.5); m.scale.setScalar(1 + (1 - m.userData.flash)); m.material.opacity = m.userData.flash * 0.9; } else { const t2 = R.taken.has(i); m.scale.setScalar(1); m.material.opacity = t2 ? 0.15 : 0.9; } });
    this.cutM.forEach((pair, si) => pair.forEach((m) => { const d = m.position.distanceTo(f.pos), found = this.opts.found?.[this.track.shortcuts[si].id]; m.material.opacity = Math.max(0, Math.min(found ? 0.55 : 0.3, (90 - d) / 90 * (found ? 0.8 : 0.4))) + (found ? 0.08 : 0); }));
  }
  hud(dt) {
    const R = this.me, f = R.f;
    if (!this.el) return;
    const stk = this.$('.ar-stick');
    if (stk) { const on = !!(this.mouseMode && this.mouse && !R.fin); stk.classList.toggle('on', on); if (on) { const st = stickOf(this.mouse); stk.firstChild.style.transform = `translate(${(st.x * 46).toFixed(1)}px, ${(st.y * 46).toFixed(1)}px)`; stk.classList.toggle('boost', !!this.mouseBoost); } }
    const laps = this.c.laps, time = this.phase === 'grid' ? 0 : (R.fin ? R.finRaw : this.rt);
    this.$('.ar-lap').textContent = this.mode === 'practice' ? `LAP ${Math.max(1, R.lap)}` : `LAP ${Math.min(laps, Math.max(1, R.lap))}/${laps}`;
    this.$('.ar-pos').textContent = this.mode === 'race' ? `${ORD(R.place)}/${this.racers.filter((r) => !r.gone).length}` : '';
    this.$('.ar-time').textContent = this.mode === 'practice' ? fmtTime(this.phase === 'grid' ? 0 : this.rt - R.lapStart) : `${fmtTime(time)}${R.pen ? `  +${R.pen}s` : ''}`;
    const bl = R.laps.length ? Math.min(...R.laps) : this.opts.bestLap;
    this.$('.ar-best').textContent = bl ? `Best lap ${fmtTime(bl)}` : '';
    this.$('.ar-meter b').style.width = `${Math.round(f.meter * 100)}%`;
    this.$('.ar-meter').classList.toggle('on', f.boostK > 0.5);
    this.$('.ar-spd').textContent = `${Math.round(f.speed * 3.6)} km/h`;
    this.$('.ar-ge').classList.toggle('on', !!R.ge); this.$('.ar-slip').classList.toggle('on', !!R.slip);
    this.$('.fl-blur').style.opacity = (this.blur * 0.9).toFixed(2);
    if (R.wrongT > 1.2 && !this.wrongShown) { this.wrongShown = true; this.banner('WRONG WAY!', 'bad', 1800); }
    else if (R.wrongT === 0) this.wrongShown = false;
    this.mapT -= dt;
    if (this.mapT <= 0) {
      this.mapT = 0.1;
      const cv = this.$('.ar-map'), x = cv.getContext('2d'); x.clearRect(0, 0, 170, 170); x.drawImage(this.mapBase, 0, 0);
      const ng = this.track.gates[R.next]; if (ng) { const [u, v] = this.mapXY(ng.p); x.strokeStyle = '#ffd24a'; x.lineWidth = 2; x.beginPath(); x.arc(u, v, 5, 0, Math.PI * 2); x.stroke(); }
      for (const O of [...this.racers].reverse()) { if (O.gone) continue; const [u, v] = this.mapXY(O.f.pos); x.fillStyle = O.me ? '#ffffff' : O.dot; x.beginPath(); x.arc(u, v, O.me ? 5 : 3.6, 0, Math.PI * 2); x.fill(); if (O.me) { x.strokeStyle = '#1a2a40'; x.lineWidth = 1.5; x.stroke(); } }
      // the standings, top left
      if (this.mode === 'race') {
        const rows = [...this.racers].filter((r) => !r.gone).sort((a, b) => a.place - b.place).map((r) => `<div class="${r.me ? 'me' : ''}"><i style="background:${r.me ? '#fff' : r.dot}"></i>${r.place}. ${String(r.name).replace(/[<>&]/g, '').slice(0, 16)}${r.fin ? ' ✓' : ''}</div>`).join('');
        if (rows !== this.lastRows) { this.lastRows = rows; this.$('.ar-board').innerHTML = rows; }
      }
    }
  }

  // ---------------------------------------------------------------- the end
  /** Everyone's result: finished racers by time; the rest estimated from where they are (shown as such). */
  results() {
    const T = this.track, n = T.gates.length, total = (this.c.laps * n) + 1;
    const rows = this.racers.filter((r) => !r.gone).map((r) => {
      if (r.fin) return { id: r.id, name: r.name, me: !!r.me, human: !!r.human, plane: r.plane, time: r.fin, pen: r.pen, est: false, laps: r.laps };
      const left = Math.max(0, total - r.prog) * (T.length / n), v = Math.max(20, r.f.base * (r.f.skill || 1));
      return { id: r.id, name: r.name, me: !!r.me, human: !!r.human, plane: r.plane, time: this.rt + r.pen + left / v, pen: r.pen, est: true, laps: r.laps };
    }).sort((a, b) => a.time - b.time);
    rows.forEach((r, i) => { r.place = i + 1; });
    return rows;
  }
  finishRace() {
    if (this.done) return;
    this.done = true;
    const R = this.me, rows = this.results(), mine = rows.find((r) => r.me);
    this.$('.ar-tip').textContent = '';
    this.el.classList.add('finished');
    this.sfx(mine?.place === 1 ? 'cheer' : 'superland'); this.sfx('crowd', { vol: 0.8, dur: 3 }); this.crowd?.cheer(1);
    const res = { nearMisses: this.nearMisses || 0, circuit: this.c.id, cls: this.cls.id, mode: this.mode, rows, place: mine?.place || 0, time: R.fin || 0, raw: R.finRaw || 0, pen: R.pen, laps: R.laps.slice(), bestLap: R.laps.length ? Math.min(...R.laps) : 0, splits: R.lapSplits?.length ? R.lapSplits[R.laps.indexOf(Math.min(...R.laps))] || [] : [], tricks: this.myTricks || 0, crashes: this.crashes || 0, missed: this.missed || 0, strikes: this.strikes || 0, cuts: [...(this.foundNow || [])], perfect: R.perfect, ghost: this.bestLapRec || null, plane: this.opts.plane, rid: this.opts.rid };
    this.result = res;
    this.opts.onFinish?.(res);
  }
  quit() { if (this.closed) return; this.quitting = true; this.opts.onQuit?.(); }
  /** For the party: where you are (and, from the host, where the rivals are). */
  stateExtra() {
    const R = this.me; if (!R || !this.opts.party) return null;
    const f = R.f, o = { r: this.opts.rid, p: [+f.pos.x.toFixed(1), +f.pos.y.toFixed(1), +f.pos.z.toFixed(1)], y: +f.yaw.toFixed(2), b: +f.bank.toFixed(2), pi: +f.pitch.toFixed(2), pr: +R.prog.toFixed(2), l: R.lap, f: R.fin ? +R.fin.toFixed(2) : 0, c: R.crashT > 0 ? 1 : 0 };
    if (this.opts.host) o.ai = this.racers.map((r) => (r.ai && !r.remote ? [+r.f.pos.x.toFixed(1), +r.f.pos.y.toFixed(1), +r.f.pos.z.toFixed(1), +r.f.yaw.toFixed(2), +r.f.bank.toFixed(2), +r.prog.toFixed(2), r.fin ? +r.fin.toFixed(2) : 0, r.lap, r.next, r.passed, r.crashT > 0 ? 1 : 0] : null));
    return o;
  }
  dispose() {
    this.closed = true;
    window.removeEventListener('pointermove', this.onMove); window.removeEventListener('pointerdown', this.onPDown); window.removeEventListener('pointerup', this.onPUp);
    window.removeEventListener('keydown', this.onKey, true); window.removeEventListener('keyup', this.onKey, true);
    clearTimeout(this.bannerT); clearTimeout(this.splitT);
    this.el?.remove(); this.el = null;
    this.game.ui.root.classList.remove('airracing');
    // free the race's own geometry, materials and textures; the shared model geometry (merged per node) and the model
    // libraries' materials stay cached for the next race
    const keep = sharedGeometries(), seen = new Set();
    this.scene?.traverse((o) => {
      if (o.geometry && !keep.has(o.geometry) && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        if (seen.has(m) || m === MERGED_MATS.solid || m === MERGED_MATS.glow || (m.userData?.matIndex != null && !m.userData.clone) || m.userData?.keep) continue;
        seen.add(m); m.map?.dispose?.(); m.dispose();
      }
    });
    this.sunLight?.shadow?.map?.dispose?.();
    this.scene = null;
  }
}
