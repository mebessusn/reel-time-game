// Unit tests for The Wild Woods (v1.14.9): the hidden pools and creeks, their fish, the fly rod, and the data that
// drives the forest (pages, field guide, ranger tasks).
import assert from 'node:assert/strict';
import * as R from '../src/game/rules.js';
import * as T from '../src/world/terrain.js';
import { SPECIES_BY_ID, ZONES } from '../src/data/species.js';
import { ITEMS_BY_ID } from '../src/data/items.js';
import { PAGES, GUIDE, GUIDE_SETS, RANGER_TASKS, FORAGE, STEW } from '../src/data/woodsdata.js';
import { mulberry32 } from '../src/core/rng.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('  ok', name); };

t('every hidden pool is water, its own zone, and walkable round its banks', () => {
  for (const [id, P] of Object.entries(T.POOLS)) {
    assert.ok(T.isWater(P.cx, P.cz), `${id} centre is water`);
    assert.equal(T.zoneAt(P.cx, P.cz), id);
    assert.ok(ZONES[id], `${id} zone listed`);
    let ok = 0;
    for (let a = 0; a < 24; a++) if (T.walkY(P.cx + Math.cos(a / 24 * 6.283) * (P.rx + 3), P.cz + Math.sin(a / 24 * 6.283) * (P.rz + 3)) != null) ok++;
    assert.ok(ok >= 20, `${id}: ${ok}/24 bank points walkable`);
    assert.equal(T.boatable(P.cx, P.cz), false, `${id}: no rowing in a hidden pool`);
  }
});

t('the creeks join their pool to a waterway and you can wade across them', () => {
  for (const [id, C] of Object.entries(T.CREEKS)) {
    const [sx, sz] = C.pts[0], [ex, ez] = C.pts[C.pts.length - 1];
    assert.ok(T.isWater(sx, sz) && T.isWater(ex, ez), `${id} ends in water`);
    let wade = 0, n = 0;
    for (let i = 1; i < C.pts.length - 1; i++) { const [x, z] = C.pts[i]; if (T.zoneAt(x, z) === 'creek') { n++; if (T.walkY(x, z, T.WADE_DEPTH) != null) wade++; } }
    assert.ok(n >= C.pts.length - 3, `${id} is creek along its length`);
    assert.ok(wade >= n - 2, `${id} wadeable (${wade}/${n})`);
    assert.equal(T.regionName(C.pts[2][0], C.pts[2][1]), C.name);
  }
});

t('each hidden pool has its own fish, and the creeks have theirs', () => {
  const own = { moonwell: 'moonsilver', foxhollow: 'brookie', mirrortarn: 'cutthroat', lantern: 'lanterndarter' };
  for (const [zone, sp] of Object.entries(own)) {
    const S = SPECIES_BY_ID[sp];
    assert.deepEqual(S.zones, [zone]);
    const r = mulberry32(7); let hits = 0;
    for (let i = 0; i < 4000; i++) { const b = R.rollBite({ zone, phase: S.times[0], weather: 'clear', noJunk: true }, r); if (b.speciesId === sp) hits++; }
    assert.ok(hits > 40, `${sp} bites in ${zone} (${hits}/4000)`);
  }
  assert.ok(R.eligibleSpecies(null, { zone: 'creek', phase: 'day', weather: 'clear' }).some((s) => s.id === 'riffledace'));
  assert.ok(R.eligibleSpecies('legendary', { zone: 'creek', phase: 'dusk', weather: 'rain' }).some((s) => s.id === 'mossback'));
});

t('the fly rod: quicker bites on moving water, and trout rise to it', () => {
  const rod = ITEMS_BY_ID.rod_fly;
  assert.ok(rod && rod.perk.flowBite > 0 && rod.source === 'shop');
  const avg = (perks, zone) => { const r = mulberry32(3); let s = 0; for (let i = 0; i < 3000; i++) s += R.biteDelay({ zone, phase: 'day', weather: 'clear', perks }, r); return s / 3000; };
  assert.ok(avg({ flowBite: 0.3 }, 'creek') < avg({}, 'creek') * 0.8, 'creek bites quicker with the fly rod');
  assert.equal(Math.round(avg({ flowBite: 0.3 }, 'open')), Math.round(avg({}, 'open')), 'no change on a lake');
  const jumpers = (perks) => { const r = mulberry32(11); let j = 0; for (let i = 0; i < 4000; i++) { const b = R.rollBite({ zone: 'creek', phase: 'day', weather: 'clear', perks, noJunk: true }, r); if (SPECIES_BY_ID[b.speciesId].behaviour === 'jump') j++; } return j; };
  assert.ok(jumpers({ flowBite: 0.3 }) > jumpers({}) * 1.3, 'more trout on a fly');
});

t('the new places are on walkable ground away from water', () => {
  for (const k of ['tower', 'trapper', 'plane', 'hollis', 'wagon1', 'wagon2', 'wagon3', 'wagon4', 'wagon5']) {
    const c = T.CLEARINGS[k];
    assert.ok(T.walkY(c.x, c.z) != null, `${k} walkable`);
    for (let a = 0; a < 12; a++) assert.ok(!T.isWater(c.x + Math.cos(a) * c.r, c.z + Math.sin(a) * c.r), `${k} dry`);
  }
  for (const [x, z] of T.TRAILS.loop.pts) assert.ok(T.walkY(x, z) != null && !T.isWater(x, z), `loop point ${x},${z}`);
});

t('forest data: eight pages, twelve animals in three sets of four, ranger tasks, stew', () => {
  assert.equal(PAGES.length, 8);
  assert.equal(new Set(PAGES.map((p) => p.at)).size, 8);
  assert.equal(GUIDE.length, 12);
  for (const set of Object.keys(GUIDE_SETS)) assert.equal(GUIDE.filter((g) => g.set === set).length, 4);
  assert.ok(RANGER_TASKS.length >= 6 && RANGER_TASKS.every((x) => x.n > 0 && x.reward.coins > 0));
  for (const k of Object.keys(STEW.need)) assert.ok(FORAGE[k] && !FORAGE[k].bait);
});

console.log(`woods: ${passed} passed`);
