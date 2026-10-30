// v1.15 Open Waters: the pure parts. The sea's geography, the weather-driven waves, the charter's course, the deck,
// the sea's fish (kept apart from the valley's), big-game fights, and the crew's side rooms.
import assert from 'node:assert/strict';
import { OCEAN, ISLANDS, SPOTS, inOcean, oceanSurfaceY, oceanZoneAt, oceanRegionName } from '../src/ocean/geo.js';
import { SEA, setSea, updateSea, oceanWave, waveHeight, SEA_STATES, seaClock } from '../src/ocean/waves.js';
import { route, coursePose, deckAtLocal, halfBeam, BOAT } from '../src/ocean/charterBoat.js';
import { OCEAN_SPECIES, OCEAN_ZONES, BIG_GAME, TROPICAL } from '../src/data/oceanSpecies.js';
import { DOCKS, jettyAt } from '../src/ocean/geo.js';
import { SPECIES, SPECIES_BY_ID, ZONES } from '../src/data/species.js';
import * as R from '../src/game/rules.js';
import { newTug, stepTug, makeBig, tugWon, tugLost, gaff, BIG } from '../src/game/tug.js';
import { mulberry32 } from '../src/core/rng.js';
import { LocalNet, NullNet, roomName } from '../src/net/net.js';

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log(`  ok ${name}`); };
const WATER_Y = 0.85;

await t('the ocean is far from the valley, and the islands are land in deep water', () => {
  assert.ok(OCEAN.x - OCEAN.half > 1200, 'clear of the valley (FAR_X)');
  for (const I of ISLANDS) {
    assert.ok(oceanSurfaceY(I.atoll ? I.x + I.r * 0.85 : I.x, I.z) > WATER_Y, `${I.name} rises above the sea`);
    assert.ok(oceanSurfaceY(I.x + (I.r + I.shelf + 30), I.z) < -15, `${I.name} drops off into the blue`);
  }
  assert.equal(inOcean(0, 0), false);
});
await t('every fishing spot is deep water with its own zone and fish', () => {
  for (const s of SPOTS.filter((x) => !x.dock)) {
    assert.ok(oceanSurfaceY(s.x, s.z) < -5, `${s.name} is deep`);
    assert.equal(oceanZoneAt(s.x, s.z), s.zone);
    assert.ok(OCEAN_ZONES[s.zone]);
    assert.ok(R.eligibleSpecies(null, { zone: s.zone, phase: 'day', weather: 'clear' }).length > 0, `${s.name} has fish by day`);
    assert.equal(oceanRegionName(s.x, s.z), s.name);
  }
});
await t('the sea has its own fish, and the valley never sees them', () => {
  assert.equal(OCEAN_SPECIES.length, 29); // v1.15.19: five Deep Blue fish
  assert.equal(BIG_GAME.length, 12);
  assert.equal(TROPICAL.length, 17); // v1.15.19: + tripletail, moray, lantern angelfish, emberfin, lava-glow moray
  for (const s of OCEAN_SPECIES) { assert.equal(SPECIES_BY_ID[s.id], s); assert.ok(!SPECIES.includes(s)); }
  for (const z of Object.keys(ZONES)) for (const ph of ['dawn', 'day', 'dusk', 'night']) for (const s of R.eligibleSpecies(null, { zone: z, phase: ph, weather: 'storm' })) assert.ok(!s.ocean, `${s.id} in ${z}`);
  for (const z of Object.keys(OCEAN_ZONES)) for (const s of R.eligibleSpecies(null, { zone: z, phase: 'day', weather: 'clear' })) assert.ok(s.ocean, `${s.id} at sea`);
  // every big-game fish bites somewhere, sometime
  const seen = new Set();
  for (const z of Object.keys(OCEAN_ZONES)) for (const ph of ['dawn', 'day', 'dusk', 'night']) for (const w of ['clear', 'overcast', 'rain', 'storm']) for (const spear of [false, true]) for (const s of R.eligibleSpecies(null, { zone: z, phase: ph, weather: w, spear })) { seen.add(s.id); if (s.spear) assert.ok(spear, `${s.id} is spear only`); }
  assert.equal(seen.size, OCEAN_SPECIES.length);
});
await t('bites at sea are never junk or bluegill, and big fish pay well', () => {
  const r = mulberry32(5);
  for (let i = 0; i < 4000; i++) {
    const b = R.rollBite({ zone: 'bluewater', phase: 'day', weather: 'overcast', noJunk: true, ocean: true, perks: {} }, r);
    assert.equal(b.kind, 'fish'); assert.ok(SPECIES_BY_ID[b.speciesId].ocean);
  }
  for (const s of BIG_GAME) {
    assert.ok(R.catchValue(s.id, 'normal', s.weight[1]) >= s.value.coins * 0.99);
    assert.equal(R.catchXp(s.id), s.value.xp);
  }
});
await t('a big catch counts toward its own log, not the valley goals or records', () => {
  const p = R.newProfile('T');
  R.applyCatch(p, { speciesId: 'mako', variant: 'normal', weight: 420, phase: 'day', weather: 'storm' });
  assert.equal(p.stats.speciesCaught || 0, 0);
  assert.equal(p.stats.oceanSpecies, 1);
  assert.equal(p.stats.heaviest || 0, 0);
  assert.equal(p.stats.oceanHeaviest, 420);
});
await t('waves follow the weather, and the whole crew sees the same wave', () => {
  const now = Date.UTC(2026, 9, 20, 12);
  const H = {};
  for (const w of Object.keys(SEA_STATES)) { setSea(w, now); H[w] = waveHeight(); }
  assert.ok(H.clear < H.overcast && H.overcast < H.rain && H.rain < H.storm, JSON.stringify(H));
  assert.ok(H.clear > 0.4 && H.clear < 1.4, `clear ${H.clear}`);
  assert.ok(H.storm > 3 && H.storm < 6, `storm ${H.storm}`);
  setSea('rain', now);
  const a = oceanWave(OCEAN.x + 50, OCEAN.z + 80);
  setSea('rain', now); // another angler's copy at the same moment
  assert.equal(oceanWave(OCEAN.x + 50, OCEAN.z + 80), a);
  // the sea builds slowly toward a storm, it doesn't snap
  setSea('clear', now);
  updateSea(1, 'storm', 0.8, now + 1000);
  assert.ok(waveHeight() < H.storm * 0.5);
  for (let i = 0; i < 300; i++) updateSea(1, 'storm', 0.8, now + 2000 + i * 1000);
  assert.ok(waveHeight() > H.storm * 0.8);
  // over the beach and the reefs, the waves die away
  setSea('storm', now);
  const I = ISLANDS[0];
  let deep = 0, shore = 0;
  for (let k = 0; k < 40; k++) { deep = Math.max(deep, Math.abs(oceanWave(I.x + 260, I.z + k * 3))); shore = Math.max(shore, Math.abs(oceanWave(I.x + I.r * 0.98, I.z + k * 0.2))); }
  assert.ok(shore < deep * 0.6, `shore ${shore} deep ${deep}`);
  assert.ok(seaClock(now + 5000) - seaClock(now) === 5);
});
await t('the charter steers around the islands and arrives', () => {
  for (const a of SPOTS) for (const b of SPOTS) {
    if (a === b) continue;
    const pts = route(a, b);
    for (let i = 1; i < pts.length; i++) for (let k = 0; k <= 20; k++) {
      const x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k / 20, z = pts[i - 1].z + (pts[i].z - pts[i - 1].z) * k / 20;
      assert.ok(oceanSurfaceY(x, z) < WATER_Y - (b.dock || a.dock ? 0.9 : 1.5), `${a.id} -> ${b.id} runs aground at ${x.toFixed(0)},${z.toFixed(0)}`);
    }
  }
  const from = SPOTS[0], to = SPOTS[2];
  const course = { pts: route(from, to), dep: 1000, anchorYaw: 0 };
  const mid = coursePose(course, 1000 + 15000), end = coursePose(course, 1000 + 400000);
  assert.ok(mid.moving && !mid.arrived);
  assert.ok(end.arrived && !end.moving);
  assert.ok(Math.hypot(end.x - to.x, end.z - to.z) < 0.5);
});
await t('each island has a jetty from dry sand out to water deep enough to moor', () => {
  for (const [id, D] of Object.entries(DOCKS)) {
    if (D.platform) assert.ok(oceanSurfaceY(D.x0, D.z0) < WATER_Y - 5, `${id} stands in open water`); // v1.15.19 Channel Light: a platform on piles
    else assert.ok(oceanSurfaceY(D.x0, D.z0) > WATER_Y, `${id} starts on land`);
    assert.ok(oceanSurfaceY(D.moor.x, D.moor.z) < WATER_Y - 2, `${id} mooring is deep`);
    assert.equal(jettyAt(D.x0 + D.ux * 5, D.z0 + D.uz * 5), D);
    assert.equal(jettyAt(D.moor.x, D.moor.z), null, 'the boat lies beside it, not on it');
  }
});
await t('the deck: a cockpit to stand in, rails, the salon and the chair in the way', () => {
  assert.equal(deckAtLocal(0, -3.5), BOAT.cockpitY);
  assert.equal(deckAtLocal(0, 0), null, 'inside the salon');
  assert.ok(deckAtLocal(1.85, 0) > BOAT.cockpitY, 'the side deck is a step up');
  assert.equal(deckAtLocal(halfBeam(-4) + 0.2, -4), null, 'over the side');
  assert.equal(deckAtLocal(BOAT.chair.x, BOAT.chair.z), null, 'the fighting chair');
  assert.ok(deckAtLocal(0, 5) > 1.5, 'the foredeck');
});
await t('big-game fights: long, won with patience, landed only by the gaff', () => {
  const r0 = mulberry32(9);
  const smart = (r) => r.tension < 0.7 && !(r.big.run > 0) && r.jump <= 0 && !(r.big.warn > 0) && r.big.arms > 0.15;
  let wins = 0, total = 0;
  for (let n = 0; n < 60; n++) {
    const sp = BIG_GAME[n % BIG_GAME.length];
    const r = makeBig(newTug(sp, sp.difficulty, { rand: r0 }), { weightK: r0(), rand: r0 });
    let tt = 0, sawGaff = false;
    while (tt < 600) {
      stepTug(r, 1 / 20, smart(r), -r.pull, r0);
      tt += 1 / 20;
      if (r.big.gaff) sawGaff = true;
      if (tugWon(r)) { wins++; total += tt; assert.ok(sawGaff, 'a fish is gaffed aboard'); break; }
      if (tugLost(r)) break;
    }
  }
  assert.ok(wins >= 50, `smart play lands most fish (${wins}/60)`);
  const avg = total / wins;
  assert.ok(avg > 35 && avg < 200, `fights last a while (${avg.toFixed(0)} s)`);
});
await t('the gaff: too early and the fish bolts; in the window it comes aboard', () => {
  const r = makeBig(newTug(BIG_GAME[0], 3), {});
  r.big.gaffer = 'crew';
  r.big.gaff = { t: 0.3 };
  assert.equal(gaff(r), false);
  assert.ok(!r.big.gaff && r.progress < 0.9, 'it ran again');
  r.big.gaff = { t: BIG.GAFF_OPEN + 0.5 };
  assert.equal(gaff(r), true);
  assert.ok(tugWon(r));
});
await t('stepping away mid-fight: Marlowe holds the rod for a minute, then the fish wins', () => {
  const r = makeBig(newTug(BIG_GAME[2], 6), { weightK: 1 });
  let tt = 0;
  while (tt < 200 && !tugLost(r) && !tugWon(r)) { stepTug(r, 0.05, false, 0); tt += 0.05; }
  assert.ok(tugLost(r) && r.big.lost === 'afk', `lost: ${r.big.lost}`);
  assert.ok(tt > BIG.AFK_AFTER + BIG.AFK_HOLD - 1 && tt < BIG.AFK_AFTER + BIG.AFK_HOLD + 2, `held for ${tt.toFixed(0)} s`);
});
await t('side rooms: a crew hears only the crew, and the lake only the lake', async () => {
  assert.equal(roomName('Charter-ABC 12!'), 'charter-abc12');
  globalThis.window ??= { addEventListener() {} }; // LocalNet listens for the page closing
  const lake = 'test' + Date.now();
  const mk = (id) => { const n = new LocalNet(lake); return n.connect({ id, name: id }).then(() => n); };
  const [a, b, c] = await Promise.all([mk('A'), mk('B'), mk('C')]);
  const crewA = a.joinRoom('charter-x'), crewB = b.joinRoom('charter-x');
  await crewA.connect({ id: 'A', name: 'A' }); await crewB.connect({ id: 'B', name: 'B' });
  const heard = { crewB: [], lakeC: [], lakeB: [] };
  crewB.on('chat', (e) => heard.crewB.push(e.m.x));
  c.on('chat', (e) => heard.lakeC.push(e.m.x));
  b.on('chat', (e) => heard.lakeB.push(e.m.x));
  crewA.sendChat({ n: 1, x: 'fish on!' });
  a.sendChat({ n: 2, x: 'hello lake' });
  await new Promise((res) => setTimeout(res, 120));
  assert.deepEqual(heard.crewB, ['fish on!']);
  assert.deepEqual(heard.lakeC, ['hello lake']);
  assert.ok(crewA.peers.has('B') && !crewA.peers.has('C'), 'the crew room only knows the crew');
  a.leaveRoom(); b.leaveRoom();
  for (const n of [a, b, c]) n.leave();
  const solo = new NullNet().joinRoom('x');
  assert.equal(solo.kind, 'none');
});

// ---- v1.15 stage 5: progress, achievements, trophies, the collection, sea quests
await t('stage 5: sea counters feed eight achievements, and only ever go up', async () => {
  const { oceanStats, owSetProgress, OW_SET, SPEARABLE, MOUNTS, releaseXp, BILLFISH } = await import('../src/ocean/progressData.js');
  const { ACHIEVEMENTS } = await import('../src/data/achievements.js');
  const st = oceanStats({ slams: 1, released: { sailfish: 3, marlin: 2, mahi: 9 }, speared: { lionfish: 2, snapper: 1, clownfish: 4 }, games: { crabs: { wins: 1 }, volley: { wins: 0 }, cannon: { wins: 2 } }, breach: 1 });
  assert.deepEqual(st, { owGrandSlam: 1, owBillRelease: 5, owReefSpeared: 2, owPartyWins: 2, owBreach: 1 });
  const p = { stats: { owBillRelease: 7 } };
  R.setOceanStats(p, { ...st, catches: 999, owReefSpeared: 99 });
  assert.equal(p.stats.owBillRelease, 7, 'never goes down');
  assert.equal(p.stats.owReefSpeared, 8, 'capped');
  assert.equal(p.stats.catches, undefined, 'only sea counters can be set');
  const ow = ACHIEVEMENTS.filter((a) => a.category === 'Open Waters');
  assert.equal(ow.length, 8);
  for (const a of ow) assert.ok(['owTrophy', 'oceanSpecies', ...Object.keys(R.OCEAN_STATS)].includes(a.stat), a.id);
  assert.equal(SPEARABLE.length, 8);
  for (const id of SPEARABLE) assert.ok(SPECIES_BY_ID[id], id);
  for (const id of [...BILLFISH, ...Object.keys(MOUNTS)]) assert.ok(SPECIES_BY_ID[id]?.ocean, id);
  assert.ok(releaseXp(SPECIES_BY_ID.marlin, 800) > releaseXp(SPECIES_BY_ID.sailfish, 60));
  assert.equal(OW_SET.species.length, 29); // v1.15.19: + the five Deep Blue fish
  assert.equal(owSetProgress({ mahi: {}, bluegill: {} }).have.length, 1);
  assert.equal(owSetProgress(Object.fromEntries(OW_SET.species.map((id) => [id, {}]))).done, true);
  // catching a big-game fish counts towards Trophy Hunter
  const pr = R.newProfile('X');
  R.applyCatch(pr, { id: 'c1', speciesId: 'mahi', variant: 'normal', weight: 30, zone: 'weedline', phase: 'day', weather: 'clear' });
  assert.equal(pr.stats.owTrophy, 1);
});
await t('stage 5: sea quests are the same for everyone and move with the right events', async () => {
  const { oceanDaily, oceanWeekly, oceanStep } = await import('../src/ocean/quests.js');
  assert.deepEqual(oceanDaily(20000), oceanDaily(20000));
  assert.deepEqual(oceanWeekly(2900), oceanWeekly(2900));
  const kinds = new Set(); for (let d = 0; d < 60; d++) kinds.add(oceanDaily(d).kind);
  assert.ok(kinds.size >= 4, 'a mix of requests');
  let q = { kind: 'big', n: 2, have: 0, done: false };
  q = oceanStep(q, 'catch', { speciesId: 'bluegill' }); assert.equal(q.have, 0);
  q = oceanStep(q, 'catch', { speciesId: 'clownfish' }); assert.equal(q.have, 0);
  q = oceanStep(q, 'catch', { speciesId: 'marlin' }); q = oceanStep(q, 'catch', { speciesId: 'mahi' });
  assert.equal(q.done, true);
  let k = { kind: 'kinds', n: 2, have: 0, seen: [], done: false };
  k = oceanStep(k, 'catch', { speciesId: 'mahi' }); k = oceanStep(k, 'catch', { speciesId: 'mahi' });
  assert.equal(k.have, 1, 'different kinds only');
  const b = oceanStep({ kind: 'beachwin', n: 1, have: 0, done: false }, 'beach', { won: false });
  assert.equal(b.have, 0);
});

// ---- v1.15.5: the rest of the plan, and the fixes
await t('v1.15.5: Trophy tier, Marlowe\'s tackle, the squid tows, low graphics drops the wind sea', async () => {
  const { tierOf, TIER_INFO } = await import('../src/data/species.js');
  assert.equal(tierOf(SPECIES_BY_ID.marlin), 'trophy');
  assert.equal(tierOf(SPECIES_BY_ID.clownfish), 'clownfish' in SPECIES_BY_ID ? SPECIES_BY_ID.clownfish.tier : undefined);
  assert.equal(tierOf(SPECIES_BY_ID.bluegill), 'common');
  assert.ok(TIER_INFO.trophy.points > TIER_INFO.legendary.points);
  for (const sp of BIG_GAME) assert.notEqual(sp.tier, 'trophy', 'bites still roll on the real rarity');
  const { fightGear, runningBiteMult, TACKLE } = await import('../src/ocean/tackle.js');
  assert.deepEqual(fightGear('rod_willow', {}), { lineLb: 3000, paceK: 1, armsK: 1 });
  const best = fightGear('rod_biggame', { harness: 1 });
  assert.ok(best.lineLb > 3000 && best.paceK > 1 && best.armsK < 1);
  assert.equal(runningBiteMult('lure_classic'), null);
  assert.ok(runningBiteMult('lure_troll') < 2);
  const { ITEMS_BY_ID } = await import('../src/data/items.js');
  for (const x of TACKLE) if (x.kind === 'item') assert.equal(ITEMS_BY_ID[x.id]?.source, 'charter');
  assert.ok(SPECIES_BY_ID.giantsquid.tow);
  // a harness really does save your arms
  const a = makeBig(newTug(SPECIES_BY_ID.marlin, 8, { rand: mulberry32(1) }), { armsK: 1 }), b = makeBig(newTug(SPECIES_BY_ID.marlin, 8, { rand: mulberry32(1) }), { armsK: 0.35 });
  { const ra = mulberry32(5), rb = mulberry32(5); for (let i = 0; i < 200; i++) { stepTug(a, 0.05, true, -a.pull, ra); stepTug(b, 0.05, true, -b.pull, rb); } }
  assert.ok(b.big.arms > a.big.arms);
  setSea('storm'); SEA.lite = true; updateSea(0.016, 'storm');
  assert.equal(SEA.amp[3] + SEA.amp[4] + SEA.amp[5], 0); assert.ok(SEA.amp[0] > 0);
  SEA.lite = false; updateSea(0.016, 'storm'); assert.ok(SEA.amp[3] > 0);
});
await t('v1.15.5: into and out of every jetty, the charter never crosses a jetty or the shallows', async () => {
  const { dockRoute } = await import('../src/ocean/charterBoat.js');
  const starts = SPOTS.filter((s) => !s.dock).map((s) => ({ p: { x: s.x, z: s.z }, dock: null }));
  for (const D of Object.values(DOCKS)) starts.push({ p: { x: D.moor.x, z: D.moor.z }, dock: D });
  for (const a of starts) for (const D of Object.values(DOCKS)) {
    if (a.dock === D) continue;
    const pts = dockRoute(a.p, { x: D.moor.x, z: D.moor.z }, a.dock, D);
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1], p1 = pts[i], L = Math.hypot(p1.x - p0.x, p1.z - p0.z), ux = (p1.x - p0.x) / L, uz = (p1.z - p0.z) / L;
      for (let s = 0; s <= L; s += 1) {
        const x = p0.x + ux * s, z = p0.z + uz * s;
        if ((a.dock && Math.hypot(x - a.p.x, z - a.p.z) < 8) || Math.hypot(x - D.moor.x, z - D.moor.z) < 8) continue; // (tied up)
        for (const off of [-2.3, 0, 2.3]) for (const al of [-6, 0, 6]) {
          const qx = x - uz * off + ux * al, qz = z + ux * off + uz * al;
          assert.equal(jettyAt(qx, qz), null, `hull on a jetty heading to ${D.island}`);
          assert.ok(oceanSurfaceY(qx, qz) < WATER_Y - 1.2, `hull aground heading to ${D.island}`);
        }
      }
    }
    // the last leg runs straight along the jetty (no swing round at the end)
    const n = pts.length, h = Math.atan2(pts[n - 1].x - pts[n - 2].x, pts[n - 1].z - pts[n - 2].z);
    assert.ok(Math.abs(Math.atan2(Math.sin(h - D.yaw), Math.cos(h - D.yaw))) < 0.05);
  }
});
await t('v1.15.5: the smugglers\' grotto is carved behind the arch without moving the jetty', async () => {
  const { GROTTO } = await import('../src/ocean/geo.js');
  assert.ok(Math.abs(oceanSurfaceY(GROTTO.beach.x, GROTTO.beach.z) - 1.4) < 1e-9, 'a level beach');
  assert.ok(oceanSurfaceY(GROTTO.lagoon.x, GROTTO.lagoon.z) < 0, 'a lagoon');
  const mid = { x: (GROTTO.mouth.x + GROTTO.lagoon.x) / 2, z: (GROTTO.mouth.z + GROTTO.lagoon.z) / 2 };
  assert.ok(oceanSurfaceY(mid.x, mid.z) < 0, 'a channel you can swim');
  const side = { x: GROTTO.lagoon.x + GROTTO.u.z * 6, z: GROTTO.lagoon.z - GROTTO.u.x * 6 };
  assert.ok(oceanSurfaceY(side.x, side.z) > 5, 'cliff walls round it');
  assert.ok(jettyAt(DOCKS.smuggler.x0 + DOCKS.smuggler.ux * 9, DOCKS.smuggler.z0 + DOCKS.smuggler.uz * 9));
});

await t('v1.15.6: every island is walkable from its jetty, the atoll lagoon is swimmable with a motu in the middle', async () => {
  const { ATOLL } = await import('../src/ocean/geo.js');
  const land = (x, z) => { const y = oceanSurfaceY(x, z); if (y < WATER_Y - 0.22) return false; const e = 0.35; return Math.max(Math.abs(oceanSurfaceY(x + e, z) - oceanSurfaceY(x - e, z)), Math.abs(oceanSurfaceY(x, z + e) - oceanSurfaceY(x, z - e))) / (2 * e) <= 1.2; };
  for (const I of ISLANDS) {
    const D = DOCKS[I.id], R = Math.max(I.r, I.rz) * 1.4, S = 0.5, N = Math.ceil(2 * R / S), k = (i, j) => i * N + j;
    const ok = new Uint8Array(N * N), dry = new Uint8Array(N * N); let nDry = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const x = I.x - R + i * S, z = I.z - R + j * S; if (oceanSurfaceY(x, z) > WATER_Y + 0.1) { dry[k(i, j)] = 1; nDry++; } if (land(x, z)) ok[k(i, j)] = 1; }
    const si = Math.round((D.x0 - D.ux * 1.5 - (I.x - R)) / S), sj = Math.round((D.z0 - D.uz * 1.5 - (I.z - R)) / S);
    assert.ok(ok[k(si, sj)], `${I.id}: the jetty's foot is on walkable sand`);
    const seen = new Uint8Array(N * N), q = [[si, sj]]; seen[k(si, sj)] = 1; let reach = 0;
    while (q.length) { const [i, j] = q.pop(); reach += dry[k(i, j)]; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = i + a, v = j + b; if (u < 0 || v < 0 || u >= N || v >= N || seen[k(u, v)] || !ok[k(u, v)]) continue; seen[k(u, v)] = 1; q.push([u, v]); } }
    assert.ok(reach / nDry > 0.9, `${I.id}: ${Math.round(100 * reach / nDry)}% of the island is reachable on foot`);
    assert.ok(nDry * S * S > 5000, `${I.id}: a decent size (${Math.round(nDry * S * S)} m2)`);
  }
  const T = ISLANDS.find((i) => i.atoll);
  const lag = oceanSurfaceY(T.x + T.r * 0.26, T.z);
  assert.ok(lag < WATER_Y - 2.5, `the lagoon is deep enough to swim (${lag.toFixed(1)})`);
  assert.ok(oceanSurfaceY(T.x, T.z) > WATER_Y + 0.5, 'the motu is dry land');
  assert.equal(oceanZoneAt(T.x + T.r * 0.26, T.z), 'lagoon');
  // a gentle beach into the lagoon: from dry sand to wading depth without a step
  for (let a = 0; a < 6.28; a += 0.5) {
    let wading = 0;
    for (let d = T.r * 0.2; d < T.r * 0.7; d += 0.25) { const y = oceanSurfaceY(T.x + Math.cos(a) * d, T.z + Math.sin(a) * d); if (y > WATER_Y - 0.5 && y < WATER_Y) wading += 0.25; }
    assert.ok(wading >= 3, `a strip of wading water round the lagoon (${wading} m at ${a.toFixed(1)})`);
  }
  assert.ok(ATOLL.motu > 0);
});

// v1.15.19 Deep Blue
await t('Deep Blue: the banks are diveable, the islets dry, Channel Light out at sea, and the data adds up', async () => {
  const G = await import('../src/ocean/geo.js');
  const D = await import('../src/ocean/deepblueData.js');
  for (const B of G.BANKS) { const y = oceanSurfaceY(B.x, B.z); assert.ok(y < WATER_Y - 12 && y > WATER_Y - 22, `${B.id} lies ${y.toFixed(1)} down: deep, but in a mask's reach`); }
  for (const T of G.ISLETS) assert.ok(oceanSurfaceY(T.x, T.z) > WATER_Y, `${T.id} is dry in the middle`);
  const C = G.CHANNEL;
  assert.ok(oceanSurfaceY(C.c.x, C.c.z) < WATER_Y - 6, 'Channel Light stands in open water');
  assert.ok(jettyAt(C.c.x, C.c.z), 'you can walk on the platform');
  assert.ok(oceanSurfaceY(DOCKS.ember.moor.x, DOCKS.ember.moor.z) < WATER_Y - 1.5, 'the boat floats at Emberkey\'s landing');
  assert.equal(Object.keys(D.DISCOVERIES).length, 10);
  for (const [id, X] of Object.entries(D.DISCOVERIES)) assert.ok(X.name && X.line && (X.reward.coins || X.reward.xp), `${id} has a name, a line and a reward`);
  assert.ok(D.FLOTSAM.reduce((a, b) => a + b.weight, 0) === 100, 'flotsam odds add to 100');
  for (const [k, Gr] of Object.entries(D.SEA_GEAR)) for (const z of Gr.zones) assert.ok(OCEAN_ZONES[z], `${k}: ${z} is a sea zone`);
  for (const z of ['coralhaven', 'wreck', 'vents']) assert.ok(OCEAN_SPECIES.some((s) => s.zones.includes(z)), `fish live in ${z}`);
});

// v1.15.20 Coralhaven's town
await t('Coralhaven: every room is joined to the hall by floor you can walk, with walls between', async () => {
  const M = await import('../src/ocean/coralhavenMap.js');
  assert.ok(!inOcean(M.TOWN.x, M.TOWN.z), 'the town is its own place, off the sea');
  for (const C of M.CORRIDORS) for (let k = 0; k <= 40; k++) { const x = M.TOWN.x + C.a.x + (C.b.x - C.a.x) * k / 40, z = M.TOWN.z + C.a.z + (C.b.z - C.a.z) * k / 40; assert.equal(M.townFloor(x, z), M.TOWN.y, `${C.id}: floor all the way (${k}/40)`); }
  for (const R of M.ROOMS) assert.equal(M.townFloor(M.TOWN.x + R.x, M.TOWN.z + R.z), M.TOWN.y, `${R.id} has a floor`);
  assert.equal(M.townFloor(M.TOWN.x + 20, M.TOWN.z), null, 'a wall between the hall and the cafe');
  assert.equal(M.townFloor(M.TOWN.x + M.AIRLOCK_IN.x, M.TOWN.z + M.AIRLOCK_IN.z), M.TOWN.y, 'the airlock door is reachable');
  assert.ok(/Grand Hall/.test(M.townRegion(M.TOWN.x + 3, M.TOWN.z + 3)));
});

console.log(`ocean: ${passed} passed`);
