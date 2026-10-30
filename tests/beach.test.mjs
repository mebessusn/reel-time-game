// v1.15 Open Waters stage 4: the beach games' pure parts. Palm Key's level sand, the throws and arcs, the crab race,
// coconut buckets, sandcastle rules and judging, the cannonball judges, and places and prizes.
import assert from 'node:assert/strict';
import { PADS, PAD_BY_ID, padAt, oceanSurfaceY, DOCKS, ISLAND_BY_ID, jettyAt } from '../src/ocean/geo.js';
import * as C from '../src/ocean/games/common.js';
import { ITEMS_BY_ID } from '../src/data/items.js';
import { HATS } from '../src/data/avatarOptions.js';

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log(`  ok ${name}`); };
const WATER_Y = 0.85;

await t('the beach games sit on level, dry sand on Palm Key, clear of the jetty', () => {
  const P = ISLAND_BY_ID.palm, D = DOCKS.palm;
  for (const p of PADS) {
    for (let a = 0; a < Math.PI * 2; a += 0.4) for (const r of [0, p.r * 0.5, p.r * 0.98]) {
      const y = oceanSurfaceY(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
      assert.ok(Math.abs(y - p.y) < 1e-6, `${p.id} is flat`);
    }
    assert.ok(p.y > WATER_Y + 0.5, `${p.id} is above the tide`);
    assert.ok(Math.hypot(p.x - P.x, p.z - P.z) < 60, `${p.id} is on Palm Key`);
    assert.ok(Math.hypot(p.x - D.x0, p.z - D.z0) > p.r + 8, `${p.id} is clear of the jetty`);
    assert.equal(padAt(p.x, p.z)?.id, p.id);
  }
  // the jetty is where it always was (the pads don't move it)
  assert.ok(jettyAt(D.x0 + D.ux * 9, D.z0 + D.uz * 9));
  assert.equal(padAt(D.x0, D.z0), null);
});

await t('a thrown thing falls with gravity and drifts with the wind', () => {
  const o = { x: 0, y: 2, z: 0 }, v = { x: 3, y: 4, z: 0 };
  const T = C.landTime(o, v, 0);
  assert.ok(T > 0.8 && T < 1.3);
  const p = C.flyAt(o, v, { x: 0, z: 0 }, T);
  assert.ok(Math.abs(p.y) < 1e-9);
  const pw = C.flyAt(o, v, { x: 0, z: 1.5 }, T);
  assert.ok(pw.z > 0.5, 'the wind pushes it sideways');
  assert.equal(C.landTime({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 5), null, 'never reaches 5 m up');
});

await t('a volleyball arc starts and ends where it should and peaks in the middle', () => {
  const arc = { a: { x: 0, y: 1, z: 0 }, b: { x: 10, y: 1, z: 2 }, t0: 1000, T: 2, H: 3 };
  assert.deepEqual(C.arcAt(arc, 1000), { x: 0, y: 1, z: 0, s: 0 });
  const end = C.arcAt(arc, 3000);
  assert.ok(Math.abs(end.x - 10) < 1e-9 && Math.abs(end.y - 1) < 1e-9 && end.s === 1);
  assert.ok(Math.abs(C.arcAt(arc, 2000).y - 4) < 1e-9, 'apex = H above the line');
});

await t('crab races run the same on every client, and the rain makes them quicker', () => {
  const seed = 12345;
  for (let i = 0; i < 4; i++) {
    let last = 0;
    for (let s = 0; s <= 30; s += 0.25) { const d = C.crabRun(seed, i, s); assert.ok(d >= last - 1e-9, 'never runs backwards'); last = d; }
    assert.equal(C.crabRun(seed, i, 17.3), C.crabRun(seed, i, 17.3));
    assert.ok(C.crabRun(seed, i, 20, true) > C.crabRun(seed, i, 20, false));
    // a race lasts a sensible time: every crab finishes 10 m within 15-30 s on its own
    const t10 = [...Array(400).keys()].map((k) => k * 0.1).find((s) => C.crabRun(seed, i, s) >= C.CRAB_TRACK);
    assert.ok(t10 > 15 && t10 < 30, `crab ${i} takes ${t10} s`);
  }
  assert.notEqual(C.crabRun(1, 0, 10), C.crabRun(2, 0, 10), 'each round has its own race');
  // cheering on the beat beats mashing off it
  assert.ok(C.cheerPush(0.02) > C.cheerPush(0.15) && C.cheerPush(0.15) > C.cheerPush(0.3));
  assert.ok(C.aiCheer(7, 1, 10) > 0 && C.aiCheer(7, 1, 10) === C.aiCheer(7, 1, 10));
});

await t('coconut toss: buckets down the beach, power sets the distance, a good throw scores', () => {
  const o = { x: 0, z: 0 }, u = { x: 1, z: 0 };
  const B = C.bucketSpots(99, o, u);
  assert.deepEqual(B.map((b) => b.pts), [1, 2, 3]);
  B.forEach((b, i) => assert.ok(Math.abs(b.x - C.BUCKETS[i].d) < 1e-9 && Math.abs(b.z) < 1.2));
  const yaw = Math.PI / 2; // along +x
  const short = C.coconutThrow({ x: -0.4, z: 0 }, yaw, 0, null, 1.7, B), long = C.coconutThrow({ x: -0.4, z: 0 }, yaw, 1, null, 1.7, B);
  assert.ok(long.land.x > short.land.x + 6, 'more power, further');
  // search for a power that drops one in the far bucket (aim straight at it)
  const far = B[2], aim = Math.atan2(far.x + 0.4, far.z);
  let hit = null, pw = 0;
  for (let p = 0; p <= 1 && !hit; p += 0.002) { const th = C.coconutThrow({ x: -0.4, z: 0 }, aim, p, null, 1.7, B); if (th.hit?.pts === 3) { hit = th; pw = p; } }
  assert.ok(hit, 'the far bucket is reachable');
  // a cross wind blows that same throw out of the bucket
  const windy = C.coconutThrow({ x: -0.4, z: 0 }, aim, pw, { x: 0, z: 2.5 }, 1.7, B);
  assert.notEqual(windy.hit?.pts, 3, 'the wind matters');
  const ai = C.aiThrows(5, 1);
  assert.equal(ai.length, 5); assert.ok(ai.every((x) => [0, 1, 2, 3].includes(x)));
  assert.deepEqual(C.aiThrows(5, 1), ai);
});

await t('sandcastles: the stacking rules, wet sand, judging and packing', () => {
  assert.equal(C.canPlace([], 'm'), null);
  assert.ok(C.canPlace(['k'], 'm'), 'moats only in bare sand');
  assert.ok(C.canPlace(['m'], 't'), 'nothing on a moat');
  assert.ok(C.canPlace(['k', 'f'], 't'), 'nothing on a flag');
  assert.ok(C.canPlace(['k', 't', 't'], 't', 3), 'dry sand: three high');
  assert.equal(C.canPlace(['k', 't', 't'], 't', 4), null, 'wet sand: four high');
  assert.equal(C.canPlace(['k', 't', 't'], 'f', 3), null, 'a flag can still top it');
  const empty = Array.from({ length: 9 }, () => []);
  const nice = [['w'], ['m'], ['w'], ['t'], ['k', 't', 't', 'f'], ['t'], ['w', 's'], ['m'], ['w', 's']];
  assert.ok(C.castleScore(nice) > C.castleScore(empty) + 30);
  assert.equal(C.castleScore(empty), C.castleScore(empty));
  const packed = C.packCastle(nice);
  assert.deepEqual(C.unpackCastle(packed), nice);
  assert.deepEqual(C.unpackCastle('zz,kt'), [[], ['k', 't'], [], [], [], [], [], [], []], 'junk is dropped');
  // islanders' castles grow over the build and obey the rules
  const early = C.aiCastle(3, 1, 10, 120), late = C.aiCastle(3, 1, 120, 120);
  assert.ok(late.flat().length > early.flat().length);
  for (const st of late) { const solid = st.filter((x) => 'ktw'.includes(x)).length; assert.ok(solid <= 3); }
  assert.deepEqual(C.aiCastle(3, 1, 60, 120), C.aiCastle(3, 1, 60, 120));
});

await t('cannonball: tuck at the top for the big splash; judges agree within a point or so', () => {
  const best = C.cannonScore(6, 0.1, 1.1, 1, 0), early = C.cannonScore(6, -0.4, 1.1, 1, 0), pencil = C.cannonScore(6, null, 1.1, 1, 0), late = C.cannonScore(6, 1.05, 1.1, 1, 0);
  assert.ok(best.splash > early.splash && best.splash > late.splash && best.splash > pencil.splash);
  assert.ok(C.cannonScore(3, 0.1, 0.8).splash < best.splash, 'a higher jump, a bigger splash');
  for (const r of [best, early, pencil, late]) {
    assert.equal(r.cards.length, 3);
    assert.ok(r.cards.every((c) => c >= 1 && c <= 10 && Math.abs(c - r.splash) <= 1.5));
    assert.equal(r.total, r.cards[0] + r.cards[1] + r.cards[2]);
  }
  assert.deepEqual(C.aiCannon(4, 2, 1), C.aiCannon(4, 2, 1));
});

await t('places share ties, and every place pays something', () => {
  const r = C.rank([{ id: 'a', s: 3 }, { id: 'b', s: 5 }, { id: 'c', s: 3 }, { id: 'd', s: 1 }]);
  assert.deepEqual(r.map((x) => [x.id, x.place]), [['b', 1], ['a', 2], ['c', 2], ['d', 4]]);
  let last = Infinity;
  for (let p = 1; p <= 4; p++) { const z = C.prizeFor(p, 4); assert.ok(z.coins > 0 && z.xp > 0 && z.coins < last); last = z.coins; }
  assert.ok(C.prizeFor(1, 1).coins < C.prizeFor(1, 4).coins, 'alone pays less');
});

await t('every first-win prize hat is a real item with a creator option', async () => {
  const { FIRST_WIN } = await import('../src/ocean/games/prizes.js');
  for (const [gid, w] of Object.entries(FIRST_WIN)) {
    assert.ok(ITEMS_BY_ID[w.item], `${gid}: ${w.item} is an item`);
    assert.equal(ITEMS_BY_ID[w.item].source, 'beach');
    assert.ok(HATS.some((x) => x.id === w.item && x.item === w.item), `${w.item} is in the creator`);
    assert.ok(w.title && w.title.length <= 24);
  }
});

console.log(`beach: ${passed} passed`);
