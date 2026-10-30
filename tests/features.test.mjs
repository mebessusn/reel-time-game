// Unit tests for the newer systems: away gear, bait, upgrades, quests, story, traits, collections,
// derbies, the community meter, bottles, world events, real weather mapping, key bindings.
import assert from 'node:assert/strict';
import * as R from '../src/game/rules.js';
import { SPECIES, SPECIES_BY_ID } from '../src/data/species.js';
import { BAITS, UPGRADES, upgradeEffects } from '../src/data/bait.js';
import { GEAR, rollGearCatch, gearCount } from '../src/game/awaygear.js';
import { dailyQuests, questStep, STORY, weeklyQuest, weeklyStep, thisWeek, weekEnds, WEEKLY_PEARLS } from '../src/game/quests.js';
import { rollTraits, traitWords } from '../src/game/traits.js';
import { SETS, setProgress } from '../src/game/collections.js';
import { derbyAt, derbyScore, derbyBoard, nextDerby, DERBY_MS } from '../src/game/derby.js';
import { communityTotal, COMMUNITY_GOAL } from '../src/game/community.js';
import { flagHolder, cleanCountry, COUNTRIES } from '../src/data/flags.js';
import { checkBottle, readableBottles } from '../src/game/bottles.js';
import { eventFor } from '../src/game/worldevents.js';
import { mapWeatherCode } from '../src/game/realweather.js';
import { newTug, stepTug, tugWon, tugLost } from '../src/game/tug.js';
import { Keymap, ACTIONS } from '../src/game/controls.js';
import { homeLayout, sanitizeLayout, DECOR, HOME_TIERS, tierNeeds, clampFloor, DEN, ROOM } from '../src/game/home.js';
import { mulberry32 } from '../src/core/rng.js';
import { SEASONS, seasonFor, seasonBoost } from '../src/data/seasons.js';
import { rainbowNow } from '../src/game/living.js';
import { fishOfWeek } from '../src/game/social.js';
import { GOALS } from '../src/game/ladder.js';
import { PETS, buildPet } from '../src/game/pet.js';
import { Juice } from '../src/game/juice.js';
import { FISH_FACTS } from '../src/data/facts.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('  ok', name); };

t('away gear fills on the clock and caps at its size', () => {
  const g = { id: 'pot-x', kind: 'pot', x: 0, z: 30, zone: 'dock', placedAt: 1_000_000 };
  assert.equal(gearCount(g, g.placedAt + 1000), 0);
  assert.equal(gearCount(g, g.placedAt + GEAR.pot.every * 2 + 1), 2);
  assert.equal(gearCount(g, g.placedAt + GEAR.pot.every * 99), GEAR.pot.holds);
  // v1.9.7: the soak ends, and nothing fills after it
  const fresh = { ...g, setAt: g.placedAt }, late = { ...fresh, placedAt: fresh.setAt + GEAR.pot.life - GEAR.pot.every * 1.5 };
  assert.equal(gearCount(late, late.placedAt + GEAR.pot.every * 10), 1);
  assert.ok(GEAR.pot.life / (GEAR.pot.every * GEAR.pot.holds) >= 3 && GEAR.pot.life <= 20 * 60000);
});

t('gear catches are deterministic, plausible, and fit the lake', () => {
  for (const zone of ['dock', 'frost', 'marsh', 'pond', 'quarry', 'river']) {
    const g = { id: `pot-${zone}`, kind: 'pot', zone, placedAt: 5_000_000 };
    for (let i = 0; i < 4; i++) {
      const a = rollGearCatch(g, i, 5), b = rollGearCatch(g, i, 5);
      assert.deepEqual(a, b);
      if (a.kind === 'fish') {
        const sp = SPECIES_BY_ID[a.speciesId];
        assert.ok(['common', 'uncommon'].includes(sp.tier), `${zone}: pot caught ${sp.tier}`);
        assert.ok(a.weight >= sp.weight[0] && a.weight <= sp.weight[1]);
      } else assert.ok(['chest', 'bottle'].includes(a.junkId));
    }
  }
  const sl = { id: 'set-1', kind: 'setline', zone: 'open', placedAt: 7_000_000 };
  const tiers = new Set();
  for (let k = 0; k < 400; k++) { const c = rollGearCatch({ ...sl, id: `s${k}`, placedAt: sl.placedAt + k * 3_600_000 }, 0, 30); if (c.kind === 'fish') tiers.add(SPECIES_BY_ID[c.speciesId].tier); }
  assert.ok(tiers.has('rare'), 'set lines can bring up rares');
});

t('bait changes what bites', () => {
  const ctx = { zone: 'open', phase: 'day', weather: 'clear', perks: {}, noJunk: true };
  const count = (bait, pred, c = ctx) => { const r = mulberry32(42); let n = 0; for (let i = 0; i < 4000; i++) { const b = R.rollBite({ ...c, bait }, r); if (pred(SPECIES_BY_ID[b.speciesId])) n++; } return n; };
  const dawnRiver = { ...ctx, zone: 'river', phase: 'dawn' };
  const jumpPlain = count(null, (s) => s.behaviour === 'jump', dawnRiver), jumpCricket = count('cricket', (s) => s.behaviour === 'jump', dawnRiver);
  assert.ok(jumpCricket > jumpPlain * 1.4, `crickets favour jumpers ${jumpCricket} vs ${jumpPlain}`);
  const sinkPlain = count(null, (s) => s.behaviour === 'sink'), sinkDough = count('dough', (s) => s.behaviour === 'sink');
  assert.ok(sinkDough > sinkPlain * 1.3, `dough favours bottom feeders ${sinkDough} vs ${sinkPlain}`);
  assert.ok(R.biteDelay({ ...ctx, bait: 'worm' }, () => 0.5) < R.biteDelay(ctx, () => 0.5), 'worms bite faster');
  for (const [id, b] of Object.entries(BAITS)) assert.ok(b.pack > 0 && (b.price.coins || b.price.pearls), id);
});

t('rod upgrades make Tug & Turn kinder, boat upgrades row faster and hold more', () => {
  const sp = SPECIES_BY_ID.muskie;
  // a sloppy angler: barely steers and reels into the red
  const play = (up) => {
    let won = 0, time = 0;
    for (let k = 0; k < 300; k++) {
      const rand = mulberry32(1000 + k);
      const e = upgradeEffects(up);
      const r = newTug(sp, 5, { rand, reelBonus: e.reelBonus, lineBonus: e.lineBonus });
      let holding = false;
      for (let i = 0; i < 3600 && !tugWon(r) && !tugLost(r); i++) { holding = holding ? r.tension < 0.97 : r.tension < 0.6; stepTug(r, 1 / 30, holding, -r.pull * 0.3, rand); }
      if (tugWon(r)) { won++; time += r.t; }
    }
    return { won, avg: time / Math.max(1, won) };
  };
  const base = play({}), maxed = play({ reel: 3, line: 3 });
  assert.ok(maxed.won > base.won, `upgrades save more fish: ${maxed.won} vs ${base.won}`);
  assert.ok(maxed.avg < base.avg, `and land them faster: ${maxed.avg.toFixed(1)}s vs ${base.avg.toFixed(1)}s`);
  console.log(`    sloppy angler, hard fish: ${base.won}/300 -> ${maxed.won}/300 with maxed rod`);
  const e = upgradeEffects({ hull: 2, hold: 3 });
  assert.equal(e.rowMult, 1.24);
  assert.equal(e.creelBonus, 15);
  const p = R.newProfile('x'); p.creelBonus = 15;
  assert.equal(R.creelMax(p), 35);
  assert.equal(Object.keys(UPGRADES).length, 5);
});

t('rewards and spending', () => {
  const p = R.newProfile('x');
  p.coins = 100;
  assert.equal(R.spend(p, { coins: 150 }), false);
  assert.equal(R.spend(p, { coins: 60 }), true);
  assert.equal(p.coins, 40);
  const r = R.grantReward(p, { coins: 99999, xp: 120, title: 'Lantern Keeper', item: 'lure_lantern' });
  assert.equal(r.coins, 5000, 'capped');
  assert.ok(p.titles.includes('Lantern Keeper'));
  assert.ok(p.owned.includes('lure_lantern'));
  p.creel.push({ id: 'c1', speciesId: 'perch', variant: 'normal', weight: 1 });
  assert.ok(R.giveCatch(p, 'c1'));
  assert.equal(p.creel.length, 0);
});

t('daily quests: three a day, the same for everyone, and they progress', () => {
  const a = dailyQuests(20000), b = dailyQuests(20000), c = dailyQuests(20001);
  assert.equal(a.length, 3);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map((q) => q.text), c.map((q) => q.text));
  for (let d = 19000; d < 19100; d++) for (const q of dailyQuests(d)) { assert.ok(q.text && q.reward.coins > 0 && q.n >= 1, q.text); }
  assert.equal(questStep({ kind: 'species', speciesId: 'perch' }, 'catch', { speciesId: 'perch' }), 1);
  assert.equal(questStep({ kind: 'catchAt', lake: 'frost' }, 'catch', { zone: 'frost' }), 1);
  assert.equal(questStep({ kind: 'catchAt', lake: 'frost' }, 'catch', { zone: 'pond' }), 0);
  assert.equal(questStep({ kind: 'weight', speciesId: 'carp', min: 8 }, 'catch', { speciesId: 'carp', weight: 7.9 }), 0);
  assert.equal(questStep({ kind: 'bait', bait: 'worm' }, 'catch', { bait: 'worm' }), 1);
});

t('v1.10: modest dailies, and one weekly quest worth 5 pearls', () => {
  for (let d = 19000; d < 19200; d++) for (const q of dailyQuests(d, 20)) { assert.ok(!q.reward.pearls, `no pearls on dailies: ${q.text}`); assert.ok(q.reward.coins <= 100, q.text); }
  const wk = thisWeek(Date.UTC(2026, 9, 15)); // a Thursday
  assert.equal(thisWeek(Date.UTC(2026, 9, 12)), wk); // Monday, same week
  assert.equal(thisWeek(Date.UTC(2026, 9, 11, 23)), wk - 1); // Sunday night, the week before
  assert.equal(weekEnds(wk), Date.UTC(2026, 9, 19));
  assert.deepEqual(weeklyQuest(wk), weeklyQuest(wk));
  for (let w = 2800; w < 2860; w++) assert.equal(weeklyQuest(w).reward.pearls, WEEKLY_PEARLS);
  let q = { ...weeklyQuest(wk), kind: 'lakes', n: 4, seen: [], have: 0 };
  q = weeklyStep(q, 'catch', { zone: 'dock' }); q = weeklyStep(q, 'catch', { zone: 'open' });
  assert.equal(q.have, 1, 'two cove catches count as one lake');
  for (const z of ['frost', 'river', 'marsh', 'pond']) q = weeklyStep(q, 'catch', { zone: z });
  assert.equal(q.have, 4); assert.ok(q.done);
  let k = { ...weeklyQuest(wk), kind: 'kinds', n: 2, seen: [], have: 0 };
  k = weeklyStep(k, 'catch', { speciesId: 'perch' }); k = weeklyStep(k, 'catch', { speciesId: 'perch' });
  assert.equal(k.have, 1);
});

t('the story runs from the cove to the Lanternfish', () => {
  assert.equal(STORY.length, 6);
  assert.ok(STORY[0].test('catch', { zone: 'dock' }));
  assert.ok(STORY[2].test('reach', { place: 'ruins', phase: 'night' }));
  assert.ok(!STORY[2].test('reach', { place: 'ruins', phase: 'day' }));
  assert.ok(STORY[5].test('catch', { speciesId: 'lanternfish' }));
  assert.equal(STORY[5].reward.title, 'Lantern Keeper');
});

t('one-of-a-kind fish: traits are rare, stable and sensible', () => {
  let any = 0, giants = 0;
  for (let i = 0; i < 2000; i++) {
    const c = { id: `id${i}`, speciesId: 'carp', variant: 'normal', weight: 3 + (i % 100) / 100 * 17 };
    const tr = rollTraits(c);
    assert.deepEqual(tr, rollTraits(c));
    if (tr) any++;
    if (tr?.size === 'giant') giants++;
  }
  assert.ok(any > 100 && any < 600, `traits on ${any}/2000`);
  assert.ok(giants > 0);
  assert.deepEqual(traitWords({ size: 'tiny', scar: 2 }), ['Tiny', 'Battle-scarred']);
});

t('collections: every listed fish exists and can be caught where the set says', () => {
  for (const [id, set] of Object.entries(SETS)) {
    for (const sid of set.species) assert.ok(SPECIES_BY_ID[sid], `${id}: ${sid}`);
    assert.ok(set.title && set.reward.coins > 0);
  }
  const ped = Object.fromEntries(SETS.pond.species.map((s) => [s, { normal: 1 }]));
  assert.ok(setProgress(SETS.pond, ped).done);
  assert.equal(setProgress(SETS.frost, ped).done, false);
});

t('derbies: on the hour for 10 minutes, scored by weight, untrusted scores filtered', () => {
  const hour = 490000 * 3600000;
  assert.ok(derbyAt(hour + 60000));
  assert.equal(derbyAt(hour + DERBY_MS + 1), null);
  assert.equal(nextDerby(hour + 5), hour + 3600000);
  const d = derbyAt(hour + 1);
  assert.equal(d.speciesId, null, 'even hours: any fish');
  assert.equal(derbyScore(d, { speciesId: 'carp', weight: 12.345 }), 12.35);
  assert.equal(derbyScore(d, { speciesId: 'carp', weight: 12, away: true }), 0, 'away gear does not count');
  const odd = derbyAt(hour + 3600000 + 1);
  assert.ok(odd.speciesId);
  assert.equal(derbyScore(odd, { speciesId: odd.speciesId === 'carp' ? 'bluegill' : 'carp', weight: 3 }), 0);
  const board = derbyBoard([{ id: d.id, w: 5 }, { id: d.id, w: 9999 }, { id: 'h1', w: 7 }, { id: d.id, w: NaN }, { id: d.id, w: 6 }], d.id);
  assert.deepEqual(board.map((x) => x.w), [6, 5]);
});

t('community meter sums this week only and ignores junk data', () => {
  const docs = [{ week: 'w1', n: 10 }, { week: 'w1', n: '5' }, { week: 'w0', n: 100 }, { week: 'w1', n: 1e9 }, { week: 'w1', n: -4 }, null];
  assert.equal(communityTotal(docs, 'w1'), 10 + 5 + 2000);
  assert.ok(COMMUNITY_GOAL > 0);
});

t('open water swaps ~30% of too-heavy fish for ones the line holds; deep water and schools untouched', () => {
  const rnd = mulberry32(42);
  const run = (ctx) => { let a = 0, b = 0; for (let i = 0; i < 6000; i++) { const x = R.rollBite({ ...ctx, noJunk: true }, rnd); if (x.kind !== 'fish') continue; if (x.weight > 8) a++; if (R.easeOverweight(x, ctx, 8, rnd).weight > 8) b++; } return [a, b]; };
  const [o1, o2] = run({ zone: 'open', phase: 'day', weather: 'clear', level: 1 });
  assert.ok(o1 > 100 && o2 / o1 > 0.62 && o2 / o1 < 0.78, `${o1} -> ${o2}`);
  const [d1, d2] = run({ zone: 'deep', phase: 'day', weather: 'clear', level: 5 });
  assert.equal(d1, d2);
  const [s1, s2] = run({ zone: 'open', phase: 'day', weather: 'clear', level: 1, swirl: true });
  assert.equal(s1, s2);
});

t('Well Fed: the fish you ate bites far more often where it lives', () => {
  const rnd = mulberry32(7);
  const ctx = { zone: 'dock', phase: 'day', weather: 'clear', level: 5, noJunk: true };
  const count = (c) => { let n = 0; for (let i = 0; i < 3000; i++) if (R.rollBite(c, rnd).speciesId === 'perch') n++; return n; };
  const base = count(ctx), fed = count({ ...ctx, craving: 'perch' });
  assert.ok(fed > base + 0.2 * (3000 - base), `perch ${base} -> ${fed}`); // about 30% of the other bites become perch
  assert.equal(count({ ...ctx, zone: 'frost', craving: 'nope' }) >= 0, true);
});

t('Frostpine flag goes to the heaviest fish this week and ignores junk docs', () => {
  const docs = [{ id: 'a', week: 'w1', w: 4.2, sp: 'pike', name: 'Ann', cc: 'US', at: 5 }, { id: 'b', week: 'w1', w: 6.1, sp: 'nope', name: 'Bo', cc: '<x>', at: 9 },
    { id: 'c', week: 'w0', w: 99, cc: 'FR' }, { id: 'd', week: 'w1', w: 1e9, cc: 'JP' }, { id: 'e', week: 'w1', w: 'x' }, null];
  const h = flagHolder(docs, 'w1');
  assert.equal(h.id, 'b'); assert.equal(h.cc, 'XX'); assert.equal(h.sp, null);
  assert.equal(flagHolder(docs, 'w2'), null);
  assert.equal(cleanCountry('US'), 'US'); assert.equal(cleanCountry('__proto__'), null);
  assert.ok(COUNTRIES.length > 50 && COUNTRIES.at(-1).code === 'XX');
});

t('bottles: short, kind, no links/numbers, and two reports sink one', () => {
  assert.ok(checkBottle('Hope your line is tight today!').text);
  assert.ok(checkBottle('visit www.example.com').error);
  assert.ok(checkBottle('call 555-123-4567').error);
  assert.ok(checkBottle('mail me a@b.co').error);
  assert.ok(checkBottle('x'.repeat(200)).error);
  assert.ok(checkBottle('you are a b i t c h').error);
  assert.ok(checkBottle('hi').error);
  const docs = [{ id: 'a', text: 'Nice day', reports: 0 }, { id: 'b', text: 'Nice day', reports: 2 }, { id: 'c', text: 'go to discord now', reports: 0 }, { id: 'd', text: 'Mine', reports: 0 }];
  assert.deepEqual(readableBottles(docs, new Set(['d'])).map((x) => x.id), ['a']);
});

t('world events: nights and dawns only, about the right frequency', () => {
  const counts = { meteor: 0, fog: 0, migration: 0 };
  for (let day = 0; day < 1000; day++) {
    for (const phase of ['dawn', 'day', 'dusk', 'night']) {
      const e = eventFor({ day, phase, weather: 'clear' });
      if (e) counts[e]++;
      if (phase === 'day' || phase === 'dusk') assert.equal(e, null);
    }
  }
  assert.ok(counts.meteor > 100 && counts.meteor < 300, JSON.stringify(counts));
  assert.ok(counts.fog > 50 && counts.migration > 100, JSON.stringify(counts));
  const ctx = { zone: 'ruins', phase: 'night', weather: 'clear', perks: {} };
  assert.ok(R.tierOdds({ ...ctx, event: 'fog' }).mythic > R.tierOdds(ctx).mythic);
  assert.ok(R.tierOdds({ ...ctx, zone: 'open', event: 'meteor' }).rare > R.tierOdds({ ...ctx, zone: 'open' }).rare);
});

t('real weather codes map onto the game sky', () => {
  assert.equal(mapWeatherCode(0), 'clear');
  assert.equal(mapWeatherCode(3), 'overcast');
  assert.equal(mapWeatherCode(61), 'rain');
  assert.equal(mapWeatherCode(73), 'rain');
  assert.equal(mapWeatherCode(95), 'storm');
});

t('key bindings: rebind swaps, menus keys are reserved, reset restores', () => {
  const ext = { d: { keymap: {} }, change(fn) { fn(this.d); } };
  const km = new Keymap(ext);
  assert.equal(km.action('c'), 'creel');
  assert.equal(km.action('arrowup'), 'up');
  assert.equal(km.bind('creel', 'm'), null);
  assert.equal(km.action('m'), 'creel');
  assert.equal(km.action('c'), 'map', 'the old owner gets the freed key');
  assert.ok(km.bind('creel', 'escape'));
  km.reset();
  assert.equal(km.action('c'), 'creel');
  assert.equal(new Set(ACTIONS.map((a) => a.key)).size, ACTIONS.length, 'default keys are unique');
});

t('cabin layouts: small to share, and junk from peers is dropped', () => {
  const ext = { home: { decor: ['rug', 'lamp', 'nope'], tank: [{ id: 'a', speciesId: 'koi', variant: 'gold' }], wall: 'moss', floor: 'slate' } };
  const prof = { creel: [{ speciesId: 'carp', variant: 'normal', weight: 12 }], storage: [] };
  const l = homeLayout(ext, prof);
  assert.ok(JSON.stringify(l).length < 300);
  const s = sanitizeLayout(l);
  assert.deepEqual(s.d, ['rug', 'lamp']);
  assert.equal(s.t[0].variant, 'gold');
  const bad = sanitizeLayout({ d: ['rug', '<script>'], t: [['shark', 'g'], ['koi', 'x']], w: 'lava', f: 1, m: ['carp', 'n', 1e9] });
  assert.deepEqual(bad.d, ['rug']);
  assert.equal(bad.t.length, 1);
  assert.equal(bad.w, 'pine');
  assert.equal(bad.m.weight, SPECIES_BY_ID.carp.weight[1]);
  assert.ok(Object.keys(DECOR).length >= 10);
});

t('bigger homes: the Cottage needs a level and two collections, adds a den, and its seconds stay out of a cabin', () => {
  assert.equal(HOME_TIERS[1].id, 'cottage');
  assert.deepEqual(tierNeeds(1, { level: 12 }, { collections: { cove: 1, frost: 1 } }), []);
  assert.equal(tierNeeds(1, { level: 4 }, { collections: { cove: 1 } }).length, 2);
  assert.ok(HOME_TIERS[1].alt.pearls > 0 && HOME_TIERS[1].price.coins > 0, 'coins, or pearls instead');
  // a cabin can't show the den's pieces (from your own save or a peer's presence)
  const cabin = homeLayout({ home: { decor: ['rug', 'rug2'], tank: [], tier: 0 } }, { creel: [], storage: [] });
  assert.deepEqual(cabin.d, ['rug']); assert.equal(cabin.h, 0);
  assert.deepEqual(sanitizeLayout({ h: 0, d: ['rug2'] }).d, []);
  const cot = sanitizeLayout(homeLayout({ home: { decor: ['rug', 'rug2', 'lamp2'], tank: [], tier: 1, pos: { rug2: [8, -1, 0] } } }, { creel: [], storage: [] }));
  assert.equal(cot.h, 1); assert.deepEqual(cot.d, ['rug', 'rug2', 'lamp2']); assert.deepEqual(cot.p.rug2, [8, -1, 0]);
  // furniture stays in the room it's in: the den in a Cottage, the main room otherwise
  assert.deepEqual(clampFloor(9, 3, 0.5, 0.5, 1), [9, DEN.z1 - 0.5]);
  assert.deepEqual(clampFloor(9, 0, 0.5, 0.5, 0), [ROOM.x1 - 0.5, 0]);
  assert.equal(sanitizeLayout({ h: 1, d: ['rug2'], p: { rug2: [40, 9, 0] } }).p.rug2[0], DEN.x1 - 0.4);
});

t('seasons turn weekly and favour their own fish', () => {
  const W = 7 * 86400000;
  const seen = new Set();
  for (let i = 0; i < 8; i++) seen.add(seasonFor(i * W + 1000));
  assert.equal(seen.size, 4);
  assert.notEqual(seasonFor(0), seasonFor(W));
  for (const [id, sn] of Object.entries(SEASONS)) for (const f of sn.fish) assert.ok(SPECIES_BY_ID[f], `${id}: ${f}`);
  assert.equal(seasonBoost('autumn', 'pike'), 2);
  assert.equal(seasonBoost('autumn', 'koi'), 1);
  const ctx = { zone: 'shallows', phase: 'day', weather: 'clear', perks: {}, noJunk: true };
  const count = (season) => { const r = mulberry32(9); let n = 0; for (let i = 0; i < 3000; i++) if (R.rollBite({ ...ctx, season }, r).speciesId === 'pike') n++; return n; };
  assert.ok(count('autumn') > count('spring') * 1.4, 'autumn pike');
});

t('a rainbow only after rain, on a clear day', () => {
  let found = false;
  for (let day = 0; day < 200 && !found; day++) {
    const wt = { day, phase: 'day', f: 0.4, weather: 'clear' };
    if (rainbowNow(wt)) found = true;
    assert.equal(rainbowNow({ ...wt, weather: 'rain' }), false);
    assert.equal(rainbowNow({ ...wt, phase: 'night' }), false);
  }
  assert.ok(found);
});

t('fish of the week: steady for a week, varies between weeks', () => {
  assert.equal(fishOfWeek('2026-10-05').id, fishOfWeek('2026-10-05').id);
  const ids = new Set(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'].map((w) => fishOfWeek(w).id));
  assert.ok(ids.size >= 3);
  assert.ok(['common', 'uncommon', 'rare'].includes(fishOfWeek('x').tier));
});

t('goal ladder: twelve goals with sensible rewards', () => {
  assert.equal(GOALS.length, 12);
  assert.equal(new Set(GOALS.map((g) => g.id)).size, 12);
  for (const g of GOALS) assert.ok(g.reward.coins > 0 && g.reward.coins <= 150 && (g.reward.pearls || 0) <= 3 && g.n >= 1, g.id);
});

t('pets build and every pet has a price', () => {
  for (const [id, p] of Object.entries(PETS)) { assert.ok(p.price.coins || p.price.pearls, id); assert.ok(buildPet(id).children.length > 0); }
  assert.equal(buildPet('dragon'), null);
});

t('hit-stop slows time briefly, then lets go', () => {
  const j = new Juice({ profile: { settings: {} }, engine: { cam: {} } });
  j.hit({ stop: 0.1, shake: 0, zoom: 1 });
  assert.ok(j.scale(0.016) < 0.002);
  for (let i = 0; i < 10; i++) j.scale(0.016);
  assert.equal(j.scale(0.016), 0.016);
  assert.ok(FISH_FACTS.length >= 15);
});

console.log(`features: ${passed} passed`);

// ---- v1.8: weather fish, Blood Moon, line ratings, whirlpool budgets
{
  const { eligibleSpecies: el } = await import('../src/game/rules.js');
  const { lineRating } = await import('../src/data/bait.js');
  const night = { zone: 'shallows', phase: 'night', weather: 'clear' };
  const ids = (c) => el(null, c).map((s) => s.id);
  console.assert(!ids(night).includes('piranha'), 'no piranhas on an ordinary night');
  if (ids(night).includes('piranha')) throw new Error('piranha without blood moon');
  if (!ids({ ...night, bloodMoon: true }).includes('piranha')) throw new Error('piranha missing under the blood moon');
  if (!ids({ zone: 'dock', phase: 'day', weather: 'rain' }).includes('drizzledace')) throw new Error('drizzle dace missing in rain');
  if (ids({ zone: 'dock', phase: 'day', weather: 'clear' }).includes('drizzledace')) throw new Error('drizzle dace in clear weather');
  if (lineRating('rod_willow', {}) !== 8 || lineRating('rod_willow', { line: 2 }) !== 14) throw new Error('line rating maths');
  const sw = await import('../src/world/swirls.js');
  const pools = sw.activePools(1.8e12);
  if (pools.length) {
    for (let i = 0; i < sw.SWIRL_CASTS; i++) sw.noteSwirlCast(pools[0].id);
    const after = sw.activePools(1.8e12)[0];
    if (after.id === pools[0].id) throw new Error('a spent whirlpool should move');
  }
  console.log('features: v1.8 weather, blood moon, line rating, whirlpool budget ok');
}
