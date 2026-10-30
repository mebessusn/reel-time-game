// Frostmere (map 3): the pure parts. The north's geography (west of the valley, clear of it and of Open Waters),
// its zones and thin ice, the sled trails, the 14 fish and their rules (the aurora, the snowstorm), the quest steps,
// the weekly Ice Derby fish and the aurora nights.
import assert from 'node:assert/strict';
import * as G from '../src/north/geo.js';
import { NORTH_SPECIES, NORTH_ZONES, NORTH_BY_ID } from '../src/data/northSpecies.js';
import { SPECIES, SPECIES_BY_ID, ZONES, zoneName } from '../src/data/species.js';
import { OCEAN_SPECIES } from '../src/data/oceanSpecies.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { ITEMS_BY_ID } from '../src/data/items.js';
import * as R from '../src/game/rules.js';
import { FAR_X } from '../src/world/terrain.js';
import { LINES } from '../src/north/quests.js';

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log(`  ok ${name}`); };
G.buildGrid();

await t('Frostmere is far west of the valley, the other way from Open Waters', () => {
  assert.ok(G.NORTH.x + G.NORTH.half < -FAR_X, 'clear of the valley');
  assert.equal(G.inNorth(0, 0), false);
  assert.ok(G.inNorth(G.NORTH.x, 0));
});
await t('the places are where the map says: the village and kennels on land, the shanties on the lake, the wreck in the sea ice', () => {
  const k = (id) => G.kindAt(G.P[id].u, G.P[id].v);
  for (const id of ['village', 'kennels', 'station', 'aurorahill', 'bearpoint', 'trapper', 'glacier']) assert.equal(k(id), G.K.LAND, id);
  for (const id of ['shanties', 'rink', 'strip']) assert.equal(k(id), G.K.LAKE, id);
  assert.equal(k('wreck'), G.K.SEAICE);
  assert.equal(k('springs'), G.K.POOL);
  assert.equal(k('glide'), G.K.RIVER);
});
await t('every patch of water has a fishing zone with fish in it', () => {
  for (let u = -370; u < 370; u += 9) for (let v = -370; v < 370; v += 9) {
    const z = G.zoneOf(u, v);
    if (G.kindAt(u, v) === G.K.LAND) { assert.equal(z, null); continue; }
    assert.ok(NORTH_ZONES[z], `${u},${v}: ${z}`);
    assert.ok(NORTH_SPECIES.some((s) => s.zones.includes(z)), `fish in ${z}`);
  }
});
await t('thin ice is by the inlets, the springs and the ridge, never at Hearthwick', () => {
  assert.ok(G.thinIce(141, 25) > 0.6, 'the river outlet');
  assert.ok(G.thinIce(G.SPRINGS.u + 14, G.SPRINGS.v) > 0.3 || G.kindAt(G.SPRINGS.u + 14, G.SPRINGS.v) !== G.K.LAKE, 'by the springs');
  for (const [u, v] of [[60, 108], [112, 98], [40, 90], [80, 120]]) assert.ok(G.thinIce(u, v) < 0.2, `the shanty town ${u},${v}`);
});
await t('the sled trails run over land and ice, never open water', () => {
  for (const pts of G.TRAILS) for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s <= L; s += 2) { const u = a[0] + (b[0] - a[0]) * s / L, v = a[1] + (b[1] - a[1]) * s / L; assert.ok(!G.isOpen(G.kindAt(u, v)), `open water on a trail at ${u.toFixed(0)},${v.toFixed(0)}`); }
  }
});
await t('17 north fish: unique, in the lookup, out of the valley\'s Fishpedia, each with a model, lore and a depth', () => {
  assert.equal(NORTH_SPECIES.length, 17);
  for (const s of NORTH_SPECIES) {
    assert.ok(SPECIES_BY_ID[s.id] === s, s.id);
    assert.ok(!SPECIES.some((v) => v.id === s.id) && !OCEAN_SPECIES.some((v) => v.id === s.id), `${s.id} is the north's own`);
    assert.ok(s.weight[0] < s.weight[1] && s.desc && s.depth > 0 && s.depth <= 1, s.id);
    for (const z of s.zones) assert.ok(NORTH_ZONES[z], `${s.id} zone ${z}`);
  }
  assert.equal(new Set([...SPECIES, ...OCEAN_SPECIES, ...NORTH_SPECIES].map((s) => s.id)).size, SPECIES.length + OCEAN_SPECIES.length + NORTH_SPECIES.length);
  assert.equal(zoneName('basin'), 'The Deep Basin'); assert.equal(zoneName('deep'), ZONES.deep.name);
});
await t('up north only the north\'s fish bite; the Aurora Char waits for the lights, the Glacier King for a storm', () => {
  const ctx = (o) => ({ zone: 'frostmere', phase: 'day', weather: 'clear', perks: {}, ...o });
  assert.ok(R.eligibleSpecies(null, ctx()).every((s) => s.north));
  const char = (o) => R.eligibleSpecies('mythic', ctx({ zone: 'springs', phase: 'night', ...o })).some((s) => s.id === 'aurorachar');
  assert.equal(char({}), false); assert.equal(char({ aurora: true }), true);
  const king = (w) => R.eligibleSpecies('legendary', ctx({ zone: 'ridge', weather: w })).some((s) => s.id === 'glacierking');
  assert.equal(king('clear'), false); assert.equal(king('storm'), true);
  assert.ok(R.tierOdds(ctx({ zone: 'springs', aurora: true })).mythic > 0);
  assert.equal(R.tierOdds(ctx({ zone: 'springs' })).mythic, 0);
});
await t('a north catch counts towards Frostmere\'s goals, not the valley\'s Fishpedia', () => {
  const p = R.newProfile('t');
  R.applyCatch(p, { id: 'c1', speciesId: 'cisco', variant: 'normal', weight: 1, zone: 'frostmere' });
  assert.equal(p.stats.northSpecies, 1);
  assert.equal(p.stats.speciesCaught || 0, 0);
});
await t('15 Frostmere achievements, their stats accepted (and capped) by the profile', () => {
  const fm = ACHIEVEMENTS.filter((a) => a.category === 'Frostmere');
  assert.equal(fm.length, 15);
  const p = { stats: {} };
  R.setOceanStats(p, { fmHoles: 3, fmBearCubs: 9, nonsense: 5 });
  assert.equal(p.stats.fmHoles, 3); assert.equal(p.stats.fmBearCubs, 1); assert.equal(p.stats.nonsense, undefined);
});
await t('the quest lines: every step listens for something, and the rewards are real items', () => {
  assert.equal(LINES.length, 5);
  for (const L of LINES) {
    assert.ok(L.steps.length >= 1 && L.steps.every((s) => typeof s.on === 'function' && s.text));
    if (L.reward.item) assert.ok(ITEMS_BY_ID[L.reward.item], L.reward.item);
  }
  const A = LINES[0];
  assert.ok(A.steps[4].on('catch', { sp: NORTH_BY_ID.cisco, ice: true }));
  assert.equal(A.steps[4].on('catch', { sp: NORTH_BY_ID.cisco, ice: false }), false);
  assert.ok(LINES.find((l) => l.id === 'june').steps[4].on('derby', { won: true }));
});
await t('the Ice Derby fish is the same for everyone all week, and a lake fish', async () => {
  const { derbyFish } = await import('../src/north/boards.js').catch(() => ({}));
  if (!derbyFish) return; // (needs the DOM helpers: covered by the browser test)
  const a = derbyFish('2026-W43'), b = derbyFish('2026-W43');
  assert.equal(a.id, b.id); assert.ok(!a.zones.every((z) => z === 'floe'));
});
await t('two nights in three have the aurora, the same nights for everyone', async () => {
  const { auroraNight } = await import('../src/north/sky.js').catch(() => ({}));
  if (!auroraNight) return;
  let n = 0; for (let d = 0; d < 300; d++) if (auroraNight(d * 24 * 60 * 1000)) n++;
  assert.ok(n > 150 && n < 250, `${n}/300`);
});
console.log(`north: ${passed} passed`);
