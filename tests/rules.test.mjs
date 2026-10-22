// Unit tests for game rules: odds, economy, progression, achievements.
import assert from 'node:assert/strict';
import * as R from '../src/game/rules.js';
import { scatterSpots } from '../src/world/terrain.js';
import { SPOTS, spotAt, gateAt, nextUnlock, unlocksAt, LAKE_LEVELS, LAKE_ORDER } from '../src/game/spots.js';
import { shellPool } from '../src/game/awaygear.js';
import { SPECIES, SPECIES_BY_ID, ZONES } from '../src/data/species.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { ITEMS } from '../src/data/items.js';
import { mulberry32 } from '../src/core/rng.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('  ok', name); };

t('species: unique ids, valid zones/weights', () => {
  assert.ok(SPECIES.length >= 41);
  assert.equal(new Set(SPECIES.map((s) => s.id)).size, SPECIES.length);
  for (const s of SPECIES) assert.ok(s.weight[0] < s.weight[1], s.id);
});

t('40 achievements with unique ids', () => {
  assert.equal(ACHIEVEMENTS.length, 40);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, 40);
});

t('v1.13: lakes climb base, deep end, landmark; a rod never catches shellfish', () => {
  const ctx = { zone: 'pond', phase: 'dawn', weather: 'clear' };
  assert.ok(!R.eligibleSpecies(null, ctx).some((s) => s.spots || s.shell));
  assert.ok(R.eligibleSpecies(null, { ...ctx, phase: 'day' }).some((s) => s.id === 'millsunfish'));
  assert.ok(R.eligibleSpecies(null, { ...ctx, spot: 'pond_poi' }).some((s) => s.id === 'pondsage'));
  assert.ok(R.eligibleSpecies(null, { zone: 'frost', phase: 'night', weather: 'clear', spot: 'frost_poi' }).some((s) => s.id === 'heir'));
  assert.ok(R.tierOdds({ zone: 'frost', spotKind: 'mythic' }).mythic > 0 && R.tierOdds({ zone: 'frost' }).mythic === 0);
  assert.equal(spotAt(-152, 166)?.id, 'pond_poi');
  // every lake: base < deep end < landmark, and each spot really sits in its lake
  for (const lake of LAKE_ORDER) { const L = LAKE_LEVELS[lake]; assert.ok(L.base < L.deep.level && L.deep.level < L.poi.level, lake); }
  for (const sp of SPOTS) { const gt = gateAt(sp.x, sp.z); assert.equal(gt.lake, sp.lake, sp.id); assert.equal(gt.level, sp.level, sp.id); }
  assert.equal(gateAt(0, -12).level, 20); assert.equal(gateAt(0, -4).level, 10); assert.equal(gateAt(0.4, 30).level, 1);
  assert.equal(gateAt(-130, 150).level, 5); assert.equal(gateAt(104, 32).level, 1); // a river is open to everyone
  assert.deepEqual(shellPool('cage', 'quarry', 34).map((s) => s.id), []);
  assert.ok(shellPool('cage', 'quarry', 35).some((s) => s.id === 'murraycray'));
  assert.ok(nextUnlock(1).level > 1 && unlocksAt(15).some((u) => u.what === 'Lobster Cage'));
});

t('every species is catchable somewhere', () => {
  const phases = ['dawn', 'day', 'dusk', 'night'];
  const weathers = ['clear', 'overcast', 'rain', 'storm'];
  const zones = Object.keys(ZONES);
  const seen = new Set();
  const spots = [null, ...SPOTS.map((x) => x.id)];
  for (const z of zones) for (const ph of phases) for (const w of weathers) for (const bloodMoon of [false, true]) for (const spot of spots)
    for (const s of R.eligibleSpecies(null, { zone: z, phase: ph, weather: w, bloodMoon, spot })) seen.add(s.id);
  // v1.12: shellfish come from traps, at a lake where they live, from their level
  for (const s of SPECIES.filter((x) => x.shell)) if (s.zones.some((lake) => shellPool(s.shell, lake, 50).includes(s))) seen.add(s.id);
  assert.equal(seen.size, SPECIES.length, `missing: ${SPECIES.filter((s) => !seen.has(s.id)).map((s) => s.id)}`);
});

t('tier and variant distribution is sane (100k rolls at the dock and the deep)', () => {
  const r = mulberry32(42);
  for (const zone of ['dock', 'deep']) {
    const tiers = {}; const variants = { normal: 0, gold: 0, diamond: 0 }; let junk = 0;
    const N = 100000;
    for (let i = 0; i < N; i++) {
      const b = R.rollBite({ zone, phase: 'night', weather: 'clear', perks: {} }, r);
      if (b.kind === 'junk') { junk++; continue; }
      const s = SPECIES_BY_ID[b.speciesId];
      tiers[s.tier] = (tiers[s.tier] || 0) + 1;
      variants[b.variant]++;
      assert.ok(b.weight >= s.weight[0] && b.weight <= s.weight[1]);
    }
    const fish = N - junk;
    console.log(`    ${zone}: junk ${(junk / N * 100).toFixed(1)}%`, Object.fromEntries(Object.entries(tiers).map(([k, v]) => [k, (v / fish * 100).toFixed(1) + '%'])),
      `gold 1/${Math.round(fish / variants.gold)} diamond 1/${Math.round(fish / variants.diamond)}`);
    assert.ok(junk / N > 0.06 && junk / N < 0.1);
    assert.ok(fish / variants.diamond > 180 && fish / variants.diamond < 340);
    assert.ok(fish / variants.gold > 30 && fish / variants.gold < 50);
  }
});

t('first ever bite is a quick bluegill', () => {
  const b = R.rollBite({ zone: 'dock', phase: 'day', weather: 'clear', firstEver: true, noJunk: true });
  assert.equal(b.speciesId, 'bluegill');
  assert.ok(R.biteDelay({ firstEver: true }) <= 4);
});

t('level gates', () => {
  assert.equal(R.effectiveZone('deep', 5, 'day'), 'open');
  assert.equal(R.effectiveZone('deep', 10, 'day'), 'deep');
  assert.equal(R.effectiveZone('ruins', 20, 'day'), 'deep');
  assert.equal(R.effectiveZone('ruins', 20, 'night'), 'ruins');
  assert.equal(R.levelForXp(0), 1);
  assert.equal(R.levelForXp(R.xpForLevel(2)), 2);
  assert.equal(R.levelForXp(R.xpForLevel(3) - 1), 2);
  assert.equal(R.levelForXp(R.xpForLevel(3)), 3);
});

t('v1.13.9 balance: the curve, level protection and level-locked items', () => {
  // early levels about as quick as before, the top much steeper
  assert.ok(R.xpForLevel(5) < R.oldXpForLevel(5) * 1.1);
  assert.ok(R.xpForLevel(50) > R.oldXpForLevel(50) * 2.5);
  for (let L = 2; L <= 50; L++) assert.ok(R.xpForLevel(L) > R.xpForLevel(L - 1), `curve rises at ${L}`);
  // a saved player keeps the level the old curve gave them, once
  const old = R.ensureProfileShape({ name: 'Old', xp: R.oldXpForLevel(30) + 10 });
  assert.equal(old.level, 30);
  assert.equal(old.xpCurve2, true);
  const again = R.ensureProfileShape({ ...old });
  assert.equal(again.xp, old.xp); // not lifted a second time
  // a cloud profile (already migrated on the server) is left alone
  const cloud = R.ensureProfileShape({ name: 'Cloud', xp: 1234, xpCurve2: true });
  assert.equal(cloud.xp, 1234);
  // top items need the level as well as the price
  const p = R.newProfile('Rich'); p.pearls = 5000; p.level = 20;
  const dia = ITEMS.find((i) => i.id === 'rod_diamond');
  assert.ok(dia.level >= 40 && dia.price.pearls >= 400);
  assert.equal(R.buyItem(p, 'rod_diamond').ok, false);
  p.level = dia.level; assert.equal(R.buyItem(p, 'rod_diamond').ok, true);
});

t('catch -> keep -> sell -> buy -> achievements', () => {
  const p = R.newProfile('Tester');
  const c = { id: 'c1', speciesId: 'bluegill', variant: 'normal', weight: 0.5, zone: 'dock', phase: 'day', weather: 'clear', ts: Date.now() };
  const res = R.applyCatch(p, c);
  assert.ok(res.newSpecies && res.xp > 0);
  assert.equal(p.coins, 25); // daily bonus
  assert.equal(R.keepCatch(p, c), 'creel');
  const claim = R.claimableAchievements(p).map((a) => a.id);
  assert.deepEqual(claim, ['first_bite']);
  R.claimAchievement(p, 'first_bite');
  assert.equal(p.coins, 75);
  const sold = R.sellCatches(p, ['c1']);
  assert.ok(sold.coins > 0 && p.creel.length === 0);
  p.coins = 1000;
  assert.equal(R.buyItem(p, 'rod_birch').ok, true);
  assert.equal(R.buyItem(p, 'rod_birch').ok, false);
  assert.equal(R.buyItem(p, 'boat_blue').ok, false); // level too low
  assert.ok(R.equip(p, 'rod', 'rod_birch'));
  assert.equal(R.perksOf(p).hookWindow, 0.1);
});

t('diamond trade pays pearls', () => {
  const p = R.newProfile('T');
  const c = { id: 'd1', speciesId: 'koi', variant: 'diamond', weight: 5, zone: 'shallows', phase: 'day', weather: 'clear' };
  R.applyCatch(p, c); R.keepCatch(p, c);
  const pearlsBefore = p.pearls;
  const r = R.tradeCatch(p, 'd1');
  assert.equal(r.ok, true);
  assert.equal(p.pearls - pearlsBefore, 10);
  assert.equal(R.tradeCatch(p, 'nope').ok, false);
});

t('shop prices exist for shop items', () => {
  for (const i of ITEMS.filter((x) => x.source === 'shop')) assert.ok(i.price && (i.price.coins || i.price.pearls), i.id);
});

t('balance: casual player can afford a coin rod in week 1', () => {
  const r = mulberry32(7);
  const p = R.newProfile('Casual');
  for (let day = 0; day < 7; day++) for (let i = 0; i < 10; i++) {
    const b = R.rollBite({ zone: 'dock', phase: 'day', weather: 'clear', perks: {} }, r);
    if (b.kind !== 'fish') continue;
    const c = { id: `${day}-${i}`, ...b, zone: 'dock', phase: 'day', weather: 'clear' };
    R.applyCatch(p, c, Date.now() + day * 86400000); R.sellNow(p, c);
  }
  for (const a of R.claimableAchievements(p)) R.claimAchievement(p, a.id);
  console.log(`    after 70 dock catches: ${p.coins} coins, ${p.pearls} pearls, level ${p.level}`);
  assert.ok(p.coins >= 150);
});

await t('swirling pools boost rare odds and sit beyond cast range of land', async () => {
  const base = R.tierOdds({ zone: 'open', phase: 'day', weather: 'clear' });
  const sw = R.tierOdds({ zone: 'open', phase: 'day', weather: 'clear', swirl: true });
  assert.ok(sw.rare > base.rare * 2 && sw.epic > base.epic * 2 && sw.common < base.common);
  const { poolsForEpoch, swirlAt, SWIRL_MS } = await import('../src/world/swirls.js');
  const { heightAt, onDock, HALF, zoneAt } = await import('../src/world/terrain.js');
  // v1.8.2: the small waters (quarry, pond) are too narrow for 20; their schools keep a smaller margin
  const margin = (p) => ({ quarry: 6, pond: 10, frost: 20, marsh: 20 })[zoneAt(p.x, p.z)] ?? 11; // (v1.14.6: the Cove keeps 12 m)
  const { LIGHTHOUSE_ISLE } = await import('../src/world/terrain.js');
  const islet = (x, z) => Math.hypot(x - LIGHTHOUSE_ISLE.x, z - LIGHTHOUSE_ISLE.z) < 14; // (boat-only: pools keep 17 off it instead)
  const lakes = new Set();
  for (let e = 1000; e < 1010; e++) {
    const pools = poolsForEpoch(e);
    assert.ok(pools.length >= 1);
    assert.deepEqual(pools, poolsForEpoch(e), 'same pools for every client');
    for (const p of pools) {
      for (let x = -HALF; x < HALF; x++) for (let z = -HALF; z < HALF; z++) {
        if ((heightAt(x, z) > 0 && !islet(x, z)) || onDock(x, z)) assert.ok(Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z) >= margin(p), `pool ${p.x},${p.z} too close to land at ${x},${z}`);
      }
      assert.ok(Math.hypot(p.x - LIGHTHOUSE_ISLE.x, p.z - LIGHTHOUSE_ISLE.z) >= 17, 'clear of the lighthouse islet');
      const zn = zoneAt(p.x, p.z); lakes.add(['frost', 'marsh', 'pond', 'quarry'].includes(zn) ? zn : 'cove');
    }
    const mid = e * SWIRL_MS + SWIRL_MS / 2;
    assert.ok(swirlAt(pools[0].x, pools[0].z, mid));
  }
  // v1.14.5: every lake gets its schools (Cozy Cove lost them when the lighthouse islet moved in)
  for (const lake of ['cove', 'frost', 'marsh', 'pond', 'quarry']) assert.ok(lakes.has(lake), `${lake} has feeding schools`);
  // v1.14.6: and the Cove's schools move around (they had nearly all gathered on one spot)
  const cells = new Map(); let n = 0;
  for (let e = 2000; e < 2200; e++) for (const p of poolsForEpoch(e)) {
    const zn = zoneAt(p.x, p.z); if (['frost', 'marsh', 'pond', 'quarry'].includes(zn)) continue;
    n++; const k = `${Math.round(p.x / 4)},${Math.round(p.z / 4)}`; cells.set(k, (cells.get(k) || 0) + 1);
  }
  assert.ok(cells.size >= 30, `Cove schools use ${cells.size} spots`);
  assert.ok(Math.max(...cells.values()) / n < 0.12, `no Cove spot gets more than 12% of schools (${Math.max(...cells.values())}/${n})`);
});

await t('lake legends ranks rarity first, then weight, and rejects junk data', async () => {
  const { trophyScore, sanitizeTrophy } = await import('../src/game/trophies.js');
  const a = { id: 'a', speciesId: 'koi', variant: 'normal', weight: 6, name: 'A', ts: 1 };
  const b = { id: 'b', speciesId: 'bluegill', variant: 'diamond', weight: 0.5, name: 'B', ts: 1 };
  const c = { id: 'c', speciesId: 'koi', variant: 'normal', weight: 7, name: 'C', ts: 1 };
  assert.ok(trophyScore(b) > trophyScore(a), 'diamond common (10x1) beats a normal rare (8)');
  assert.ok(trophyScore(c) > trophyScore(a), 'heavier wins a tie');
  assert.equal(sanitizeTrophy({ ...a, speciesId: 'nope' }), null);
  assert.equal(sanitizeTrophy({ ...a, weight: 9999 }), null);
  assert.equal(sanitizeTrophy({ ...a, variant: 'platinum' }), null);
  assert.equal(sanitizeTrophy({ ...a, name: 'x'.repeat(80) }).name.length, 24);
});

t('every valley lake has its own fish at every time of day', () => {
  for (const zone of ['frost', 'marsh', 'pond', 'quarry', 'river']) {
    const all = new Set();
    for (const phase of ['dawn', 'day', 'dusk', 'night']) for (const s of R.eligibleSpecies(null, { zone, phase, weather: 'clear' })) all.add(s.id);
    assert.ok(all.size >= 6, `${zone}: ${all.size}`);
    for (const phase of ['dawn', 'day', 'dusk', 'night']) assert.ok(R.eligibleSpecies(null, { zone, phase, weather: 'clear' }).length >= 1, `${zone} ${phase}`);
  }
  assert.equal(R.effectiveZone('quarry', 3, 'day'), 'open');
  assert.equal(R.effectiveZone('quarry', 12, 'day'), 'quarry');
});

t('v1.14.3: trees and reeds are scattered, not planted in rows', () => {
  const pts = scatterSpots(99, 900, () => true);
  assert.equal(pts.length, 900);
  // the direction to each point's nearest neighbour: rows make one direction win; a scatter spreads them out
  const bins = new Array(18).fill(0);
  for (const p of pts) { let b = null, bd = 1e9; for (const q of pts) { if (q === p) continue; const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < bd) { bd = d; b = q; } } let a = Math.atan2(b.z - p.z, b.x - p.x); if (a < 0) a += Math.PI; bins[Math.min(17, Math.floor(a / Math.PI * 18))]++; }
  assert.ok(Math.max(...bins) / pts.length < 0.12, 'no favoured direction');
  assert.deepEqual(scatterSpots(99, 50, () => true), scatterSpots(99, 50, () => true), 'the same for everyone');
});

console.log(`rules: ${passed} passed`);
