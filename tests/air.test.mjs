// Skye's Air Races (v1.17): the pure parts. Every circuit is a proper closed loop with gates in a sensible rhythm,
// never crossing itself; every shortcut is worth taking and clear of the line (and never skips the start line);
// the land circuits leave room to fly (the ground well under the line and every shortcut); medals, classes, planes,
// paints, ranks, ghosts, and the achievements' counters.
import assert from 'node:assert/strict';
import { CIRCUITS, CIRCUIT_BY_ID, CLASSES, medalFor } from '../src/air/circuits.js';
import { Track } from '../src/air/track.js';
import { Region, BIOMES } from '../src/air/region.js';
import { PLANES, PLANE_LIST, PAINTS, planeUnlocked } from '../src/air/planes.js';
import { RANKS, rankFor, cleanGhost } from '../src/air/records.js';
import { RIVALS } from '../src/air/rivals.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { OCEAN_STATS } from '../src/game/rules.js';

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log(`  ok ${name}`); };
const tracks = Object.fromEntries(CIRCUITS.map((c) => [c.id, new Track(c)]));

await t('twelve circuits: six in the sky, six low-level over regions of their own, three laps each', () => {
  assert.equal(CIRCUITS.length, 12);
  assert.equal(CIRCUITS.filter((c) => c.kind === 'sky').length, 6);
  assert.equal(CIRCUITS.filter((c) => c.kind === 'land').length, 6);
  assert.equal(new Set(CIRCUITS.map((c) => c.id)).size, 12);
  for (const c of CIRCUITS) {
    assert.equal(c.laps, 3, c.id);
    if (c.kind === 'land') assert.ok(BIOMES[c.biome], `${c.id} biome`);
    assert.ok(c.dev < c.par, `${c.id}: platinum is quicker than gold`);
    assert.ok(c.desc && c.name, c.id);
  }
});
await t('every circuit is a closed loop of 2.3 to 4.5 km with gates every 120 to 260 m', () => {
  for (const c of CIRCUITS) {
    const T = tracks[c.id];
    assert.ok(T.pointAt(0).distanceTo(T.pointAt(0.9999)) < 5, `${c.id} closes`);
    assert.ok(T.length > 2300 && T.length < 4500, `${c.id} length ${T.length}`);
    assert.ok(T.gates.length >= 10, c.id);
    for (let i = 0; i < T.gates.length; i++) { const d = T.arcLength(T.gates[i].t, T.gates[(i + 1) % T.gates.length].t); assert.ok(d > 120 && d < 260, `${c.id} gate ${i} spacing ${d}`); }
    assert.equal(T.sectors.length, 2);
  }
});
await t('no circuit crosses itself: far-apart stretches of the line stay well apart', () => {
  for (const c of CIRCUITS) {
    const T = tracks[c.id], N = 240, P = Array.from({ length: N }, (_, k) => T.pointAt(k / N));
    let worst = Infinity;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const arc = Math.min(j - i, N - (j - i)) * T.length / N; if (arc > 420) worst = Math.min(worst, P[i].distanceTo(P[j])); }
    assert.ok(worst > 90, `${c.id}: two stretches come within ${worst.toFixed(0)} m`);
  }
});
await t('shortcuts: each one saves at least 150 m, runs well clear of the line and never skips the start line', () => {
  let n = 0;
  for (const c of CIRCUITS) {
    const T = tracks[c.id];
    assert.equal(T.shortcuts.length, c.shortcuts.length, c.id);
    for (const S of T.shortcuts) {
      n++;
      assert.ok(S.saves >= 150, `${c.id}/${S.id} saves ${S.saves}`);
      assert.ok(S.from >= 1 && (S.to > S.from || S.to === 0), `${c.id}/${S.id} ${S.from}>${S.to}`);
      let minD = Infinity; for (let k = 2; k <= 8; k++) { const p = S.a.clone().lerp(S.b, k / 10); for (const q of T.table) minD = Math.min(minD, q.p.distanceTo(p)); }
      assert.ok(minD > 40, `${c.id}/${S.id} comes within ${minD.toFixed(0)} m of the line`);
      assert.equal(S.gates.length, 2);
    }
    if (c.id !== 'firstflight') assert.ok(T.shortcuts.length >= 1, `${c.id} has a shortcut`);
  }
  assert.equal(n, 12, 'twelve shortcuts to find (the Secret Skies achievement)');
});
await t('land regions: the ground stays at least 10 m under the line, and under every shortcut', () => {
  for (const c of CIRCUITS.filter((x) => x.kind === 'land')) {
    const T = tracks[c.id], R = new Region(T, c);
    let worst = Infinity;
    for (let k = 0; k < 1500; k++) { const p = T.pointAt(k / 1500); worst = Math.min(worst, p.y - R.height(p.x, p.z)); }
    assert.ok(worst >= 10, `${c.id}: the line's only ${worst.toFixed(1)} m up`);
    for (const S of T.shortcuts) {
      const pts = [S.a, S.gates[0].p, S.gates[1].p, S.b]; let w = Infinity;
      for (let j = 0; j < 3; j++) for (let k = 0; k <= 30; k++) { const p = pts[j].clone().lerp(pts[j + 1], k / 30); w = Math.min(w, p.y - R.height(p.x, p.z)); }
      assert.ok(w >= 6, `${c.id}/${S.id}: only ${w.toFixed(1)} m up`);
    }
    // and a real landscape round it: hills well above the line away from the corridor
    const b = T.box; let high = 0; for (let k = 0; k < 400; k++) { const x = b.min.x - 300 + (k % 20) / 19 * (b.max.x - b.min.x + 600), z = b.min.z - 300 + Math.floor(k / 20) / 19 * (b.max.z - b.min.z + 600); high = Math.max(high, R.height(x, z)); }
    assert.ok(high > (BIOMES[c.biome].islands ? 20 : 40), `${c.id}: hills ${high.toFixed(0)}`);
  }
});
await t('track lookups: the nearest point and crossing a ring', () => {
  const T = tracks.firstflight, G = T.gates[3];
  const near = T.nearest(G.p.clone().add({ x: 0, y: 5, z: 0 }));
  assert.ok(Math.abs(near.t - G.t) < 0.01 && near.dist < 6);
  const a = G.p.clone().addScaledVector(G.d, -3), b = G.p.clone().addScaledVector(G.d, 3);
  assert.ok(Track.crossed(a, b, G));
  assert.ok(!Track.crossed(b, a, G), 'the wrong way through does not count');
  const off = G.p.clone().add({ x: 0, y: 40, z: 0 });
  assert.ok(!Track.crossed(off.clone().addScaledVector(G.d, -3), off.clone().addScaledVector(G.d, 3), G), 'outside the ring');
});
await t('medals: platinum only for a win under Skye\'s time; gold for a win under par; bronze for any decent finish', () => {
  const c = CIRCUIT_BY_ID.flyway;
  assert.equal(medalFor(c, 'breeze', c.dev - 1, 1), 4);
  assert.equal(medalFor(c, 'breeze', c.dev - 1, 2), 2, 'no platinum (or gold) unless you win');
  assert.equal(medalFor(c, 'breeze', c.par - 1, 1), 3);
  assert.equal(medalFor(c, 'breeze', c.par * 1.1, 2), 2);
  assert.equal(medalFor(c, 'breeze', c.par * 1.25, 4), 1);
  assert.equal(medalFor(c, 'breeze', c.par * 2, 1), 0);
  // the faster classes scale the times
  assert.equal(medalFor(c, 'hurricane', c.par / CLASSES.hurricane.speed - 1, 1), 3);
  assert.ok(CLASSES.breeze.speed < CLASSES.gale.speed && CLASSES.gale.speed < CLASSES.hurricane.speed);
  assert.equal(CLASSES.breeze.shortcuts, false, 'rivals only take shortcuts from Gale up');
  assert.equal(CLASSES.gale.shortcuts, true);
});
await t('planes come with medals (the Snow Goose is everyone\'s); paints with coins or medals', () => {
  assert.equal(PLANE_LIST.length, 4);
  assert.ok(planeUnlocked('snowgoose', {}));
  assert.ok(!planeUnlocked('cub', { medals: { 'a:breeze': 1, 'b:breeze': 1 } }));
  assert.ok(planeUnlocked('cub', { medals: { 'a:breeze': 2, 'b:breeze': 2 } }), '4 medal points');
  assert.ok(!planeUnlocked('racer', { medals: Object.fromEntries([1, 2, 3, 4, 5].map((k) => [`c${k}:breeze`, 3])) }));
  assert.ok(planeUnlocked('racer', { medals: Object.fromEntries([1, 2, 3, 4, 5, 6].map((k) => [`c${k}:breeze`, 3])) }), '6 golds');
  const sp = PLANE_LIST.map((p) => p.speed); assert.ok(Math.max(...sp) / Math.min(...sp) < 1.12, 'no plane runs away with it');
  assert.ok(PAINTS.find((p) => p.id === 'factory').price === 0);
  assert.equal(PAINTS.filter((p) => p.unlock).length, 2);
  for (const R of RIVALS) assert.ok(PLANES[R.plane] && PAINTS.some((p) => p.id === R.paint), R.name);
});
await t('pilot ranks climb with medal points', () => {
  assert.equal(rankFor(0).name, 'Student Pilot');
  assert.equal(rankFor(8).name, 'Bush Pilot');
  assert.equal(rankFor(30).name, 'Ace');
  assert.equal(rankFor(200).name, 'Sky Legend');
  assert.equal(rankFor(5).next.name, 'Bush Pilot');
  assert.equal(rankFor(60).next, null);
  assert.equal(RANKS.length, 4);
});
await t('ghosts from other players are cleaned up: numbers only, in order, a sane size', () => {
  const s = Array.from({ length: 30 }, (_, i) => [i * 0.2, i, 30, -i, 0.1, 0]);
  assert.equal(cleanGhost({ name: '<b>Al</b>', lap: 55, plane: 'cub', s }).name, 'bAl/b');
  assert.equal(cleanGhost({ name: 'x', lap: 55, plane: 'jet', s }).plane, 'snowgoose');
  assert.equal(cleanGhost({ lap: 55, s: s.slice(0, 3) }), null, 'too short');
  assert.equal(cleanGhost({ lap: 55, s: [...s, [1, 2, 3]] }), null, 'a bad row');
  assert.equal(cleanGhost({ lap: 55, s: [...s, [0, 1, 1, 1, 0, 0]] }), null, 'time going backwards');
  assert.equal(cleanGhost({ lap: 55, s: [[0, 'x', 1, 1, 0, 0], ...s] }), null, 'not a number');
  assert.equal(cleanGhost({ lap: -1, s }), null);
  assert.equal(cleanGhost(null), null);
});
await t('fourteen air race achievements, each counter on the stats whitelist', () => {
  const ar = ACHIEVEMENTS.filter((a) => a.category === 'Air Races');
  assert.equal(ar.length, 14);
  for (const a of ar) assert.ok(a.stat in OCEAN_STATS, a.id);
  assert.equal(OCEAN_STATS.arCuts, 12);
  assert.equal(OCEAN_STATS.arGoldCircuits, 12);
});

await t('easy, medium and hard: four circuits each, and the hard ones climb and dive steeply', () => {
  for (const k of [1, 2, 3]) assert.equal(CIRCUITS.filter((c) => c.tier === k).length, 4, `tier ${k}`);
  for (const c of CIRCUITS.filter((x) => x.tier === 3)) {
    const T = new Track(c); let steep = 0;
    for (let i = 0; i < 400; i++) { const a = T.pointAt(i / 400), b = T.pointAt((i + 1) / 400); steep = Math.max(steep, Math.abs(b.y - a.y) / Math.max(0.1, Math.hypot(b.x - a.x, b.z - a.z))); }
    assert.ok(steep > 0.22, `${c.id} has a steep pitch somewhere (${steep.toFixed(2)})`);
  }
});

await t('mouse flying: a dead zone in the middle, full stick near the edge', async () => {
  const { stickOf } = await import('../src/air/stick.js');
  assert.deepEqual(stickOf({ x: 0.03, y: -0.02 }), { x: 0, y: 0 });
  const half = stickOf({ x: 0.3, y: 0 }); assert.ok(half.x > 0.3 && half.x < 0.6);
  assert.equal(stickOf({ x: 0.9, y: 0 }).x, 1); assert.ok(stickOf({ x: 0, y: -0.9 }).y <= -0.99);
});

await t('birds along the course: flocks come at you or across, and flying into one is a bird strike', async () => {
  const THREE = await import('three');
  const { Flocks } = await import('../src/air/flocks.js');
  const T = new Track(CIRCUIT_BY_ID.redrock), scene = new THREE.Scene();
  const hard = new Flocks(scene, T, { tier: 3, hazards: 1.3, seed: 4 }), easy = new Flocks(scene, T, { tier: 1, hazards: 0.7, seed: 4 });
  assert.ok(hard.every < easy.every / 2, 'far more often on a hard circuit in Hurricane');
  const p0 = T.pointAt(0.1), R = { nt: 0.1, f: { pos: p0.clone(), speed: 60 } }; let strikes = 0;
  const race = { phase: 'race', birdStrike: () => { strikes++; }, pop() {} };
  let spawned = 0; for (let i = 0; i < 60 * 30; i++) { const n = hard.flocks.length; hard.update(1 / 60, i / 60, R, race); if (hard.flocks.length > n) spawned++; }
  assert.ok(spawned >= 2, `flocks keep coming (${spawned} in 30 s)`);
  // fly straight into one
  hard.flocks = []; hard.spawn(R); const F = hard.flocks[0]; R.f.pos.copy(F.pos); hard.update(1 / 60, 0, R, race);
  assert.equal(strikes, 1, 'a bird strike'); hard.update(1 / 60, 0.02, R, race); assert.equal(strikes, 1, 'once per flock');
  assert.equal(scene.children.length, 4, 'two instanced meshes each (bodies and wings)');
});

console.log(`\nair: ${passed} passed`);
