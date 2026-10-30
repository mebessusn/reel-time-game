// Frostmere (v1.17.2): the wilds change. After a blizzard the wind leaves crates uncovered out on the snow. Things lie frozen in
// the lake ice: cut them out for your collection. On a Great Aurora the whole sky moves, the Spirit Whitefish rise, and glowing
// tracks lead from Aurora Hill to something left in the snow. And more to photograph: ibex on the hills, hares in the taiga.
import * as THREE from 'three';
import { toWorld, P, ICE_Y, isIce, kindAt, toLocal } from './geo.js';
import { QuadPack } from './quads.js';
import { POLYANIMAL_HIPS } from '../data/polyanimalMesh.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { polyforkModel } from '../world/polyfork.js';
import { natureMaterial } from '../world/nature.js';
import { blocked } from '../world/colliders.js';
import { northSfx } from './sounds.js';
import { weekId } from '../core/clock.js';

export const ICE_FINDS = [
  { id: 'bottle', name: 'Message in a bottle', note: 'The ink has run. All you can read is "...not the fish, the ICE..."' },
  { id: 'skate', name: 'Antique skate', note: 'Whalebone runner, leather strap, a name burned in: "M. Lund".' },
  { id: 'lantern', name: 'Ship\'s lantern', note: 'VALIANT stamped on the base. The glass is still whole.' },
  { id: 'horn', name: 'Narwhal tusk tip', note: 'Polished smooth by a very long time under the ice.' },
  { id: 'coin', name: 'Galena silver dollar', note: 'Struck at the mine. Nobody ever spent it.' },
  { id: 'lure', name: 'Hand-carved lure', note: 'Torvald\'s work, or his father\'s. He\'ll want this back.' },
  { id: 'compass', name: 'Brass compass', note: 'It still points somewhere. Not quite north.' },
  { id: 'doll', name: 'Rag doll', note: 'Frozen mid-wave. Someone in Hearthwick is sixty years older now.' },
  { id: 'tooth', name: 'Enormous tooth', note: 'From what, you would rather not think about.' },
  { id: 'watch', name: 'Stopped pocket watch', note: 'Stopped at 4:17. Every clock in Galena says the same.' },
];
const CACHE_SPOTS = [[-60, 150], [10, 200], [120, 250], [230, 200], [300, 70], [250, 10], [210, -120], [-100, 220], [-190, 180], [-130, -170], [40, -196], [150, -190]];
const CACHE_LOOT = [{ coins: 120, xp: 60 }, { coins: 200, xp: 80 }, { coins: 80, xp: 120 }, { coins: 300, xp: 60 }, { coins: 60, xp: 60, pearls: 1 }];
const TRAIL = [[255, -80], [272, -74], [284, -60], [298, -58], [310, -44], [316, -28]];
const dayKey = () => Math.floor(Date.now() / 86400000);
/** One night in three is a Great Aurora (the same for everybody). */
export const greatNight = (day = dayKey()) => ((day * 2654435761) >>> 0) % 3 === 0;

export class Wilds {
  constructor(north) { this.north = north; this.game = north.game; this.caches = []; this.lastWx = null; this.finds = []; this.cut = null; this.great = false; }
  ground(x, z) { return this.north.groundAt(x, z) ?? ICE_Y; }
  build(group) {
    const G = this.group = new THREE.Group(); G.name = 'north-wilds'; group.add(G);
    // ---- crates: one mesh, spare ones hidden
    const crate = polyforkModel('cargo-crate').body;
    this.crates = CACHE_SPOTS.map(([u, v]) => { const w = toWorld(u, v), m = new THREE.Mesh(crate, natureMaterial()); m.position.set(w.x, this.ground(w.x, w.z) - 0.25, w.z); m.rotation.set(0.15, u, 0.2); m.visible = false; m.castShadow = true; G.add(m); return { x: w.x, z: w.z, m, on: false }; });
    // ---- ice finds: a dark shape under the ice with a glint, six this week out of the ten
    let seed = 0; for (const ch of String(weekId())) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const shadow = new THREE.MeshBasicMaterial({ color: '#142430', transparent: true, opacity: 0.55, depthWrite: false }), glint = new THREE.MeshBasicMaterial({ color: '#dff4ff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    const blob = new THREE.CircleGeometry(0.55, 7).rotateX(-Math.PI / 2).scale(1.4, 1, 0.8), ring = new THREE.RingGeometry(0.8, 0.9, 18).rotateX(-Math.PI / 2);
    this.glint = glint;
    for (const f of [...ICE_FINDS].sort(() => rnd() - 0.5).slice(0, 6)) {
      let u = 0, v = 0; for (let i = 0; i < 80; i++) { u = -180 + rnd() * 340; v = -70 + rnd() * 170; if (isIce(kindAt(u, v))) break; }
      const w = toWorld(u, v), a = new THREE.Mesh(blob, shadow), b = new THREE.Mesh(ring, glint);
      a.position.set(w.x, ICE_Y + 0.03, w.z); b.position.set(w.x, ICE_Y + 0.04, w.z); a.rotation.y = rnd() * 6; G.add(a, b);
      this.finds.push({ ...f, x: w.x, z: w.z, a, b });
    }
    // ---- the aurora's tracks, and what they lead to
    const pts = []; for (let i = 0; i < TRAIL.length - 1; i++) for (let k = 0; k < 8; k++) { const t = k / 8, u = TRAIL[i][0] + (TRAIL[i + 1][0] - TRAIL[i][0]) * t, v = TRAIL[i][1] + (TRAIL[i + 1][1] - TRAIL[i][1]) * t, w = toWorld(u + (k % 2 ? 0.5 : -0.5), v); pts.push(new THREE.Vector3(w.x, this.ground(w.x, w.z) + 0.06, w.z)); }
    this.trailMat = new THREE.MeshBasicMaterial({ color: '#8affd0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.trail = new THREE.InstancedMesh(new THREE.CircleGeometry(0.34, 8).rotateX(-Math.PI / 2), this.trailMat, pts.length);
    pts.forEach((p, i) => this.trail.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    this.trail.frustumCulled = false; this.trail.visible = false; G.add(this.trail);
    const e = TRAIL[TRAIL.length - 1], ew = toWorld(e[0], e[1]);
    this.shard = { x: ew.x, z: ew.z, y: this.ground(ew.x, ew.z) };
    this.shardM = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0).scale(0.7, 1.5, 0.7), new THREE.MeshBasicMaterial({ color: '#b0ffe0' })); this.shardM.position.set(ew.x, this.shard.y + 1.1, ew.z); this.shardM.visible = false; G.add(this.shardM);
    // ---- ibex on the eastern hills, hares round the taiga
    const kind = (k, rate, stride) => ({ body: `pa_${k}_body`, leg: `pa_${k}_leg`, hips: POLYANIMAL_HIPS[k], rate, stride });
    const herd = (key, n, c, r, k = {}) => { const pack = new QuadPack(G, kind(key, k.rate || 1, k.stride || 1), n, {}); return { pack, ai: pack.list.map((a) => { const t = Math.random() * 6.28, d = Math.random() * r, w = toWorld(c[0] + Math.cos(t) * d, c[1] + Math.sin(t) * d); a.x = w.x; a.z = w.z; a.y = this.ground(w.x, w.z); a.yaw = t; return { a, home: toWorld(c[0], c[1]), r, t: Math.random() * 5, tgt: null }; }), speed: k.speed || 1.5, hop: k.hop }; };
    this.herds = [herd('alpine_ibex', 5, [262, -92], 34, { speed: 1.6 }), herd('alpine_ibex', 3, [176, 342], 26, { speed: 1.6 }), herd('mountain_hare', 7, [-160, 226], 50, { rate: 1.8, stride: 0.8, speed: 3, hop: true })];
  }
  /** The storm blew itself out: a few crates are showing. */
  stormEnded() {
    for (const c of this.crates) { c.on = false; c.m.visible = false; }
    const pool = [...this.crates].sort(() => Math.random() - 0.5).slice(0, 4);
    for (const c of pool) { c.on = true; c.m.visible = true; }
    this.game.ui.toast('The storm has moved through, and the wind has uncovered a few old crates out on the snow.', { title: 'After the blizzard', icon: 'star', ms: 6000 });
  }
  update(dt, t) {
    const g = this.game, N = this.north, me = g.player.pos, wx = g.engine.sky.state?.weather, sk = N.sky;
    if (this.lastWx === 'storm' && wx && wx !== 'storm') this.stormEnded();
    this.lastWx = wx;
    this.glint.opacity = 0.3 + Math.sin(t * 2.4) * 0.2;
    const found = N.d.finds || {};
    for (const f of this.finds) { const v = !found[f.id] && Math.abs(f.x - me.x) < 130 && Math.abs(f.z - me.z) < 130; f.a.visible = v; f.b.visible = v; } // (they're small: drawn only when you're near)
    // the Great Aurora
    const great = !!sk?.auroraOn && (greatNight() || sk.forceGreat);
    if (great && !this.great) { g.ui.toast('The whole sky is moving. Something is happening on Aurora Hill.', { title: 'A Great Aurora', icon: 'star', ms: 7000 }); northSfx(g.audio, 'bell', { vol: 0.5 }); }
    this.great = great; sk && (sk.boost = great ? 1.7 : 1);
    const taken = N.d.shardDay === dayKey();
    this.trailMat.opacity += ((great && !taken ? 0.85 : 0) - this.trailMat.opacity) * Math.min(1, dt);
    this.trail.visible = this.trailMat.opacity > 0.02;
    this.shardM.visible = great && !taken; if (this.shardM.visible) { this.shardM.rotation.y = t; this.shardM.position.y = this.shard.y + 1.1 + Math.sin(t * 1.5) * 0.12; }
    // cutting something out of the ice
    if (this.cut) { this.cut.t += dt; if (this.cut.t >= 1.8) this.finishCut(); else if (Math.random() < dt * 14) g.fx.spawn(this.cut.f.x, ICE_Y + 0.1, this.cut.f.z, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, '#e8f4fc', 0.5, -5); }
    // the herds
    for (const H of this.herds) {
      const near = Math.hypot(H.ai[0].home.x - me.x, H.ai[0].home.z - me.z) < 170;
      H.pack.visible = near;
      if (!near) continue;
      for (const B of H.ai) {
        const a = B.a; B.t -= dt;
        if (B.tgt) {
          const dx = B.tgt.x - a.x, dz = B.tgt.z - a.z, l = Math.hypot(dx, dz);
          if (l < 0.5 || B.t <= 0) { B.tgt = null; a.gait = 'stand'; B.t = 2 + Math.random() * 6; a.hop = 0; continue; }
          let dy = Math.atan2(dx, dz) - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 4);
          const s = H.speed * dt, nx = a.x + Math.sin(a.yaw) * s, nz = a.z + Math.cos(a.yaw) * s;
          B.tick = ((B.tick || 0) + 1) % 8; // (a look ahead every few frames: the collider list is long)
          if (N.groundAt(nx, nz) != null && (B.tick || !blocked(nx, nz, 0.3))) { a.x = nx; a.z = nz; a.y = this.ground(nx, nz); } else { B.tgt = null; a.gait = 'stand'; a.hop = 0; B.t = 1 + Math.random() * 3; } // (blocked: stop, don't walk on the spot)
          if (H.hop) a.hop = Math.abs(Math.sin(t * 7 + a.i)) * 0.14;
        } else if (B.t <= 0) {
          const q = Math.random() * 6.28, d = Math.random() * B.r; B.tgt = { x: B.home.x + Math.cos(q) * d, z: B.home.z + Math.sin(q) * d }; a.gait = H.hop ? 'trot' : 'walk'; B.t = 12;
          if (Math.hypot(me.x - a.x, me.z - a.z) < 7) { const aw = Math.atan2(a.x - me.x, a.z - me.z); B.tgt = { x: a.x + Math.sin(aw) * 12, z: a.z + Math.cos(aw) * 12 }; a.gait = 'run'; } // (shy)
        }
      }
      H.pack.update(dt);
    }
  }
  /** Fauna.photoTarget's list of candidates. */
  photoCands(look) { for (const [i, id] of [[0, 'ibex'], [1, 'ibex'], [2, 'hare']]) for (const B of this.herds[i].ai) look(id, B.a.x, B.a.y + 0.5, B.a.z, id === 'hare' ? 14 : 26); }
  finishCut() {
    const f = this.cut.f, g = this.game, N = this.north; this.cut = null;
    g.ext.change((d) => { d.north.finds = { ...(d.north.finds || {}), [f.id]: Date.now() }; });
    g.audio.sfx('coin'); g.ui.toast(f.note, { title: f.name, icon: 'star', ms: 7000 });
    g.reward('north', `find-${f.id}`, { coins: 150, xp: 120 }, 'Found in the ice');
    if (Object.keys(N.d.finds || {}).length >= ICE_FINDS.length) g.reward('north', 'finds-all', { coins: 1500, xp: 1000, pearls: 12, title: 'Ice Cutter' }, 'Every find in the ice');
  }
  open(c) {
    const g = this.game; c.on = false; c.m.visible = false;
    const loot = CACHE_LOOT[Math.floor(Math.random() * CACHE_LOOT.length)];
    g.audio.sfx('creak'); g.ext.change((d) => { d.north.crates = (d.north.crates || 0) + 1; });
    g.reward('north', `crate-${Date.now()}`, loot, 'A storm-blown crate');
  }
  contextActions() {
    const g = this.game, me = g.player.pos, N = this.north, out = [], near = (q, r) => Math.hypot(q.x - me.x, q.z - me.z) < r, found = N.d.finds || {};
    for (const c of this.crates) if (c.on && near(c, 2.6)) out.push({ id: 'crate', label: 'Dig out the crate', color: 'gold', fn: () => this.open(c) });
    for (const f of this.finds) if (!found[f.id] && near(f, 1.9) && !this.cut) out.push({ id: `find-${f.id}`, label: 'Cut it out of the ice', color: 'gold', fn: () => { this.cut = { f, t: 0 }; northSfx(g.audio, 'drill'); } });
    if (this.shardM.visible && near(this.shard, 2.6)) out.push({ id: 'shard', label: 'Take the aurora shard', color: 'gold', fn: () => { const dk = dayKey(); g.ext.change((d) => { d.north.shardDay = dk; d.north.shards = (d.north.shards || 0) + 1; }); g.reward('north', `shard-${dk}`, { coins: 600, xp: 400, pearls: 5 }, 'An aurora shard'); } });
    return out;
  }
}
export { toLocal, mergeGeometries };
