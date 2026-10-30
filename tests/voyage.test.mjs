// Open Waters v1.15.9+: the pure parts of the expansion's later additions (trip reports, the lesson, and on).
import assert from 'node:assert/strict';
import { LESSON, LESSON_IDX, tripSummary, weekId, weekEnds, billfishBoard, derbyPrize, tideLevel, tideName, lowTideId, forageRoll, SHELLS, SEAGLASS, trustRank, tripTrust, ABYSS_RANK, seaEventAt, OWN_BOAT, UPGRADES, canBuyBoat, boatName, boatLook } from '../src/ocean/voyageData.js';
import { SPOT_BY_ID, oceanZoneAt, oceanSurfaceY } from '../src/ocean/geo.js';
import { SPECIES_BY_ID } from '../src/data/species.js';
import { shiftTo, setTimeShift, dayFraction, phaseName, DAY_MS } from '../src/core/clock.js';
import * as R from '../src/game/rules.js';
import { packInts, unpackInts, packNodes, unpackNodes } from '../src/core/meshpack.js';
import { SEALIFE_NODES } from '../src/data/sealifeMesh.js';

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log(`  ok ${name}`); };

await t('a trip report adds up the fish, the prizes and the fee', () => {
  const log = { start: 0, end: 30 * 60000, fee: 5000, fish: [{ sp: 'mahi', w: 30, val: 2000, big: true }, { sp: 'snapper', w: 4, val: 300 }], games: [{ name: 'Crab races', won: true, coins: 200 }], best: { sp: 'mahi', w: 30, secs: 70 } };
  const S = tripSummary(log);
  assert.equal(S.n, 2); assert.equal(S.trophies, 1); assert.equal(S.worth, 2300); assert.equal(S.prizes, 200);
  assert.equal(S.net, 2500 - 5000); assert.equal(S.mins, 30); assert.equal(S.heaviest.sp, 'mahi');
});
await t('an empty or free trip report is safe', () => {
  const S = tripSummary({ start: Date.now(), fish: [] });
  assert.equal(S.n, 0); assert.equal(S.net, 0); assert.equal(S.heaviest, null);
  assert.equal(tripSummary(null).n, 0);
});
await t('Marlowe\'s lesson runs chart, cast, chair, gaff, dive, aboard', () => {
  assert.deepEqual(LESSON.map((s) => s.id), ['chart', 'cast', 'chair', 'gaff', 'dive', 'aboard']);
  assert.equal(LESSON_IDX.dive, 4);
  assert.ok(SPECIES_BY_ID.mahi?.big, 'the lesson fish is a big-game mahi');
});

await t('a charter clock shift moves the sky forward to the time asked, and only while set', () => {
  const now = 7 * DAY_MS + DAY_MS * 0.75; // dusk
  const f = dayFraction(now);
  const ms = shiftTo(f, 0.235);
  assert.ok(ms > 0 && ms < DAY_MS);
  setTimeShift(ms);
  assert.equal(phaseName(dayFraction(now)), 'dawn');
  setTimeShift(0);
  assert.equal(phaseName(dayFraction(now)), 'dusk');
  assert.equal(shiftTo(0.5, 0.5), 0);
});
await t('a bite boost favours the boosted fish (squid lights)', () => {
  const ctx = { zone: 'canyon', phase: 'night', weather: 'clear', ocean: true, noJunk: true, perks: {} };
  let a = 0, b = 0;
  for (let i = 0; i < 4000; i++) {
    if (R.rollBite(ctx, Math.random).speciesId === 'swordfish') a++;
    if (R.rollBite({ ...ctx, boost: { swordfish: 6 } }, Math.random).speciesId === 'swordfish') b++;
  }
  assert.ok(b > a, `boosted ${b} vs ${a}`);
});

await t('the Billfish Derby week runs Monday to Sunday (UTC)', () => {
  const mon = Date.UTC(2026, 9, 19, 0, 0, 1), sun = Date.UTC(2026, 9, 25, 23, 59), nextMon = Date.UTC(2026, 9, 26, 0, 0, 1);
  assert.equal(weekId(mon), weekId(sun));
  assert.notEqual(weekId(sun), weekId(nextMon));
  assert.equal(weekEnds(mon), Date.UTC(2026, 9, 26));
});
await t('the derby board keeps each angler\'s best billfish and throws out junk', () => {
  const wk = 'wk1';
  const rows = billfishBoard([
    { wk, u: 'a', sp: 'marlin', w: 400, n: 'Ann' }, { wk, u: 'a', sp: 'sailfish', w: 90, n: 'Ann' },
    { wk, u: 'b', sp: 'swordfish', w: 520, n: 'Bo' }, { wk, u: 'c', sp: 'mahi', w: 50 }, { wk, u: 'd', sp: 'marlin', w: 1e9 },
    { wk: 'wk0', u: 'e', sp: 'marlin', w: 600 }, { wk, u: 'f', sp: 'marlin', w: 'lots' }, null,
  ], wk, () => 1300);
  assert.deepEqual(rows.map((r) => [r.u, r.w]), [['b', 520], ['a', 400]]);
  assert.ok(derbyPrize(1, 5).cup && derbyPrize(1, 5).pearls === 3);
  assert.ok(!derbyPrize(2, 5).cup && derbyPrize(2, 5).coins === 600);
});
await t('two tides a day: low at dawn and dusk, high at noon and midnight', () => {
  assert.equal(tideName(tideLevel(0.25)), 'low'); assert.equal(tideName(tideLevel(0.75)), 'low');
  assert.equal(tideName(tideLevel(0.5)), 'high'); assert.equal(tideName(tideLevel(0)), 'high');
  assert.notEqual(lowTideId(3, 0.25), lowTideId(3, 0.75));
});
await t('a tide pool gives a pearl now and then, else sea glass or a shell', () => {
  assert.equal(forageRoll(0.01, 0.5).kind, 'pearl');
  assert.equal(forageRoll(0.2, 0.5).kind, 'glass');
  assert.equal(forageRoll(0.9, 0.0).kind, 'shell');
  assert.equal(forageRoll(0.9, 0.999).id, 'nautilus');
  assert.equal(SHELLS.length, 6); assert.equal(SEAGLASS.length, 5);
});

await t('Marlowe\'s trust: ranks by points, a trophy trip counts double, the Abyss at First Mate', () => {
  assert.equal(trustRank(0).name, 'Deckhand'); assert.equal(trustRank(3).name, 'Mate'); assert.equal(trustRank(6).i, ABYSS_RANK); assert.equal(trustRank(99).name, 'Old Salt');
  assert.equal(trustRank(4).toNext, 2);
  assert.equal(tripTrust({ n: 3, trophies: 1 }), 2); assert.equal(tripTrust({ n: 2, trophies: 0 }), 1); assert.equal(tripTrust({ n: 0, trophies: 0, games: [] }), 0);
  assert.equal(SPOT_BY_ID.abyss.trust, ABYSS_RANK);
});
await t('the Abyss is deep water with monsters in it, any time of day', () => {
  const A = SPOT_BY_ID.abyss;
  assert.equal(oceanZoneAt(A.x, A.z), 'abyss');
  assert.ok(oceanSurfaceY(A.x, A.z) < -60);
  const day = R.eligibleSpecies(null, { zone: 'abyss', phase: 'day', weather: 'clear' }).map((s) => s.id);
  assert.ok(day.includes('giantsquid') && day.includes('swordfish') && day.includes('marlin'));
  assert.ok(!R.eligibleSpecies(null, { zone: 'canyon', phase: 'day', weather: 'clear' }).some((s) => s.id === 'giantsquid'), 'the Canyon\'s squid still only at night');
});
await t('sea events: the same for everyone on a charter, and the weather decides which', () => {
  for (let s = 0; s < 50; s++) assert.deepEqual(seaEventAt(99, s, 'rain'), seaEventAt(99, s, 'rain'));
  let spouts = 0, fogs = 0;
  for (let s = 0; s < 4000; s++) { const e = seaEventAt(7, s, 'clear'); if (e?.kind === 'spout') spouts++; const f = seaEventAt(7, s, 'storm'); if (f?.kind === 'fog') fogs++; }
  assert.equal(spouts, 0, 'no waterspouts on a clear day'); assert.equal(fogs, 0, 'no fog in a storm');
});

await t('your own boat: who can buy one, a safe name, and the look the crew sees', () => {
  assert.equal(canBuyBoat({ trips: 1, rank: 1, coins: 1e6 }).ok, false);
  assert.equal(canBuyBoat({ trips: 5, rank: 0, coins: 1e6 }).ok, false);
  assert.equal(canBuyBoat({ trips: 5, rank: 1, coins: OWN_BOAT.price - 1 }).ok, false);
  assert.equal(canBuyBoat({ trips: 5, rank: 1, coins: OWN_BOAT.price }).ok, true);
  assert.equal(canBuyBoat({ trips: 5, rank: 1, coins: 1e9, owned: true }).ok, false);
  assert.equal(boatName('  Reel Deal  '), 'Reel Deal');
  assert.equal(boatName('x'.repeat(40)).length, 18);
  assert.equal(boatLook(null), null);
  const L = boatLook({ owned: 1, hull: 99, stripe: 2, trim: -1, name: '', up: { engine: 1 } });
  assert.deepEqual([L.hull, L.stripe, L.trim, L.name, L.up.engine, L.up.livewell], [0, 2, 0, 'Sea Biscuit', true, false]);
  assert.deepEqual(UPGRADES.map((u) => u.id), ['outriggers', 'livewell', 'engine']);
});

await t('packed meshes round-trip exactly (ints, deltas, a real model)', () => {
  const ints = [0, 1, -1, 31, 32, -32, 1023, -1024, 123456789, -98765, 0];
  assert.deepEqual(unpackInts(packInts(ints)), ints);
  assert.deepEqual(unpackInts(packInts(ints, 3), 3), ints);
  const again = unpackNodes(packNodes(SEALIFE_NODES));
  assert.equal(JSON.stringify(again), JSON.stringify(SEALIFE_NODES));
  assert.ok(SEALIFE_NODES[0].prims[0].pos.length > 0 && Number.isInteger(SEALIFE_NODES[0].prims[0].idx[5]));
});

console.log(`voyage: ${passed} passed`);
