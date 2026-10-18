// Runs the Supabase migration on an in-process Postgres (PGlite) with a stand-in auth schema,
// then exercises every server function as two different players.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.on('unhandledRejection', (e) => { console.error('SQL TEST FAILED:', e.message, e.where ? `\n  where: ${e.where}` : '', e.position ? `\n  position: ${e.position}` : ''); process.exit(1); });
const db = new PGlite();
const read = (f) => fs.readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8');
let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log('  ok', name); };

// --- Supabase stand-ins: auth schema, auth.uid() from a session setting, roles, realtime publication
await db.exec(`
  create schema if not exists auth;
  create table auth.users (id uuid primary key);
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  do $$ begin create role anon; exception when others then null; end $$;
  do $$ begin create role authenticated; exception when others then null; end $$;
`);
await db.exec(read('0001_reel_time.sql'));
await db.exec(read('0002_seed.sql'));
await db.exec(read('0003_lake_legends.sql'));
await db.exec(read('0004_three_lakes.sql'));
await db.exec(read('0005_extended.sql'));
await db.exec(read('0006_sprint_rewards.sql'));
await db.exec(read('0007_v18_economy.sql'));
await db.exec(read('0008_weekly_quest.sql'));
await db.exec(read('0009_lake_progression.sql'));
await db.exec(read('0010_claude_rewards.sql'));
await db.exec(read('0011_balance.sql'));

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
await db.exec(`insert into auth.users values ('${A}'), ('${B}')`);
const as = async (uid, sql, params = []) => {
  await db.query(`select set_config('test.uid', $1, false)`, [uid || '']);
  const r = await db.query(sql, params);
  return r.rows;
};
const rpc = async (uid, fn, args = []) => {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await as(uid, `select public.${fn}(${ph}) as r`, args);
  return rows[0].r;
};

await t('seed loaded', async () => {
  const [{ n }] = await as(A, 'select count(*)::int as n from public.species');
  assert.equal(n, 70); // v1.12: 0009 brings the server's species up to date with the game
  const [{ m }] = await as(A, 'select count(*)::int as m from public.achievement_defs');
  assert.equal(m, 40);
});

await t('anonymous callers are rejected', async () => {
  await assert.rejects(() => rpc(null, 'get_state'), /sign in/);
});

await t('ensure_profile creates once', async () => {
  const r1 = await rpc(A, 'ensure_profile', ['Megan']);
  assert.equal(r1.created, true);
  assert.equal(r1.state.name, 'Megan');
  assert.deepEqual(r1.state.owned, ['rod_willow', 'lure_classic', 'boat_oak']);
  const r2 = await rpc(A, 'ensure_profile', ['Other']);
  assert.equal(r2.created, false);
  assert.equal(r2.state.name, 'Megan');
  await rpc(B, 'ensure_profile', ['Dev Two']);
});

let firstCatchId;
await t('record_catch validates and rewards', async () => {
  const r = await rpc(A, 'record_catch', ['bluegill', 'normal', 0.5, 'dock', 'day', 'clear', false, true]);
  assert.equal(r.summary.newSpecies, true);
  assert.equal(r.summary.where, 'creel');
  assert.ok(r.summary.xp > 0);
  assert.deepEqual(r.summary.daily, { coins: 25, pearls: 1 });
  assert.equal(r.state.creel.length, 1);
  assert.equal(r.state.stats.catches, 1);
  assert.equal(r.state.stats.waitCatches, 1);
  assert.equal(r.state.fishpedia.bluegill.normal, 1);
  firstCatchId = r.summary.catchId;
  await assert.rejects(() => rpc(A, 'record_catch', ['bluegill', 'normal', 99, 'dock', 'day', 'clear', false, false]), /Weight out of range/);
  await assert.rejects(() => rpc(A, 'record_catch', ['nessie', 'normal', 1, 'dock', 'day', 'clear', false, false]), /Unknown species/);
  await assert.rejects(() => rpc(A, 'record_catch', ['salmon', 'normal', 5, 'dock', 'day', 'clear', false, false]), /does not live/);
  await assert.rejects(() => rpc(A, 'record_catch', ['sturgeon', 'normal', 30, 'deep', 'day', 'clear', false, false]), /level 10/);
  await assert.rejects(() => rpc(A, 'record_catch', ['koi', 'normal', 5, 'shallows', 'day', 'rain', false, false]), /different weather|not biting/);
});

await t('lake records and the feed', async () => {
  const r = await rpc(B, 'record_catch', ['bluegill', 'gold', 0.9, 'shallows', 'day', 'clear', false, false]);
  assert.equal(r.summary.record, true, 'beating A\'s bluegill is a lake record');
  const rec = await as(B, `select name, weight from public.records where species_id = 'bluegill'`);
  assert.equal(rec[0].name, 'Dev Two');
  const feed = await as(A, 'select name, kind, payload from public.feed order by created_at desc');
  assert.equal(feed[0].kind, 'catch');
  assert.equal(feed[0].payload.variant, 'gold');
});

await t('rate limit: 6 catches per minute', async () => {
  for (let i = 0; i < 4; i++) await rpc(A, 'record_catch', ['perch', 'normal', 0.5, 'dock', 'day', 'clear', false, false]).catch(async (e) => {
    // perch only bites by day; fall back to any-time species if the server clock says otherwise
    if (/not biting/.test(e.message)) await rpc(A, 'record_catch', ['bluegill', 'normal', 0.4, 'dock', 'day', 'clear', false, false]); else throw e;
  });
  await rpc(A, 'record_catch', ['bluegill', 'normal', 0.3, 'dock', 'day', 'clear', false, false]);
  await assert.rejects(() => rpc(A, 'record_catch', ['bluegill', 'normal', 0.3, 'dock', 'day', 'clear', false, false]), /Too many catches/);
  await as(A, `update public.catches set created_at = now() - interval '2 minutes' where user_id = '${A}'`);
});

await t('players cannot write tables directly (RLS + grants)', async () => {
  await db.query(`set role authenticated`);
  await db.query(`select set_config('test.uid', $1, false)`, [A]);
  await assert.rejects(() => db.query(`update public.profiles set coins = 999999 where id = '${A}'`), /permission denied/);
  await assert.rejects(() => db.query(`insert into public.catches (user_id, species_id, variant, weight, zone, phase, weather) values ('${A}', 'koi', 'diamond', 5, 'shallows', 'day', 'clear')`), /permission denied/);
  const other = await db.query(`select count(*)::int as n from public.catches where user_id = '${B}'`);
  assert.equal(other.rows[0].n, 0, 'cannot read another player\'s catches');
  await db.query(`reset role`);
});

await t('sell, release, trade, move', async () => {
  let s = await rpc(A, 'get_state');
  const before = s.coins;
  const ids = s.creel.slice(0, 2).map((c) => c.id);
  const sold = await rpc(A, 'sell_catches', [ids]);
  assert.equal(sold.sold, 2);
  assert.equal(sold.state.coins, before + sold.coins);
  const rel = await rpc(A, 'release_catch', [sold.state.creel[0].id]);
  assert.equal(rel.state.stats.releases, 1);
  // Trade: a diamond koi needs a creel entry; insert as the server would
  await as(A, `insert into public.catches (user_id, species_id, variant, weight, zone, phase, weather, status) values ('${A}', 'koi', 'diamond', 5, 'shallows', 'day', 'clear', 'creel')`);
  s = await rpc(A, 'get_state');
  const koi = s.creel.find((c) => c.speciesId === 'koi');
  const tr = await rpc(A, 'trade_catch', [koi.id]);
  assert.equal(tr.ok, true); assert.equal(tr.pearls, 10);
  const tr2 = await rpc(A, 'trade_catch', [tr.state.creel[0].id]);
  assert.equal(tr2.ok, false, 'normal common fish cannot be traded');
  const mv = await rpc(A, 'move_catch', [tr2.state.creel[0].id, 'storage']);
  assert.equal(mv.ok, true); assert.equal(mv.state.storage.length, 1);
});

await t('shop: buy, equip, guards', async () => {
  let r = await rpc(A, 'buy_item', ['hat_captain']);
  assert.equal(r.ok, false); assert.match(r.reason, /coins/);
  await as(A, `update public.profiles set coins = 1000 where id = '${A}'`);
  r = await rpc(A, 'buy_item', ['rod_birch']);
  assert.equal(r.ok, true); assert.equal(r.state.coins, 850);
  r = await rpc(A, 'buy_item', ['rod_birch']);
  assert.equal(r.ok, false);
  r = await rpc(A, 'buy_item', ['boat_blue']);
  assert.match(r.reason, /level 3/);
  r = await rpc(A, 'buy_item', ['rod_lightning']);
  assert.match(r.reason, /Not for sale/);
  r = await rpc(A, 'equip_item', ['rod', 'rod_birch']);
  assert.equal(r.ok, true); assert.equal(r.state.equipped.rod, 'rod_birch');
  r = await rpc(A, 'equip_item', ['rod', 'rod_diamond']);
  assert.equal(r.ok, false);
});

await t('v1.13.9 balance: the server curve matches the game, top items need their level', async () => {
  const { xpForLevel } = await import('../src/game/rules.js');
  for (const L of [2, 5, 10, 20, 30, 40, 50]) {
    const [{ x }] = await as(A, 'select public._xp_for_level($1) as x', [L]);
    assert.equal(x, xpForLevel(L), `level ${L}`);
  }
  await db.query(`update public.profiles set pearls = 5000, level = 20, xp = public._xp_for_level(20) where id = '${A}'`);
  let r = await rpc(A, 'buy_item', ['rod_diamond']);
  assert.equal(r.ok, false); assert.match(r.reason, /level 40/);
  await db.query(`update public.profiles set level = 40, xp = public._xp_for_level(40) where id = '${A}'`);
  r = await rpc(A, 'buy_item', ['rod_diamond']);
  assert.equal(r.ok, true);
  await assert.rejects(() => rpc(A, 'spend_coins', ['upgrade', 'hold1', 2500, 0]), /Bad price/);
});

await t('achievements: claim once, only when earned', async () => {
  let r = await rpc(A, 'claim_achievement', ['first_bite']);
  assert.equal(r.ok, true);
  r = await rpc(A, 'claim_achievement', ['first_bite']);
  assert.equal(r.ok, false);
  r = await rpc(A, 'claim_achievement', ['lifelong']);
  assert.equal(r.ok, false);
  r = await rpc(A, 'claim_achievement', ['release']);
  assert.equal(r.ok, false);
  const s = await rpc(A, 'bump_stat', ['perfectCasts', 50]);
  assert.equal(s.stats.perfectCasts, 1, 'bump_stat caps at 1 per call');
  await assert.rejects(() => rpc(A, 'bump_stat', ['catches', 1]), /Unknown stat/);
});

await t('profile edits', async () => {
  let s = await rpc(A, 'save_profile', [{ name: '  Chef  ', avatar: { gender: 'female', hair: 'bob' }, settings: { music: 0.2 } }]);
  assert.equal(s.name, 'Chef');
  assert.equal(s.avatar.hair, 'bob');
  assert.equal(s.settings.music, 0.2);
  assert.equal(s.stats.avatarSaves, 1);
  s = await rpc(A, 'save_profile', [{ title: 'Emperor' }]);
  assert.equal(s.title, '', 'cannot pick an unearned title');
});

await t('leaderboard ranks and marks me', async () => {
  const rows = await rpc(A, 'leaderboard', ['top', 'week']);
  assert.ok(rows.length >= 2);
  assert.equal(rows[0].rank, 1);
  assert.ok(rows.some((r) => r.me && r.name === 'Chef'));
  const pedia = await rpc(B, 'leaderboard', ['pedia', 'all']);
  assert.ok(pedia.length >= 1);
  const anon = await rpc(null, 'leaderboard', ['heaviest', 'all']);
  assert.ok(anon.length >= 1 && anon.every((r) => r.me === false));
});

await t('feed reactions count once per player', async () => {
  const [{ id }] = await as(A, `select id from public.feed where user_id = '${B}' limit 1`);
  await rpc(A, 'react_feed', [id, '👏']);
  await rpc(A, 'react_feed', [id, '👏']);
  const [{ reactions }] = await as(A, `select reactions from public.feed where id = '${id}'`);
  assert.equal(reactions['👏'], 1);
});

await t('junk and bottles', async () => {
  await as(A, `update public.catches set created_at = now() - interval '2 minutes' where user_id = '${A}'`);
  const r = await rpc(A, 'record_junk', ['bottle']);
  assert.ok(r.out.messageIndex >= 0 && r.out.messageIndex < 12);
  assert.equal(r.state.stats.bottleMessages, 1);
  const c = await rpc(A, 'record_junk', ['chest']);
  assert.ok(c.out.coins >= 50);
});

await t('guest import is capped and one-time', async () => {
  const C = '33333333-3333-3333-3333-333333333333';
  await as(null, `insert into auth.users values ('${C}')`);
  await rpc(C, 'ensure_profile', ['Guesty']);
  const s = await rpc(C, 'import_guest', [{ xp: 999999, coins: 999999, pearls: 999, catchCount: 12, stats: { catches: 12, diamonds: 4000 }, fishpedia: { koi: { normal: 2, gold: 1, diamond: 0, best: 9999 }, fake: { normal: 1 } }, avatar: { hair: 'afro' } }]);
  assert.equal(s.level, 10); assert.equal(s.coins, 2000); assert.equal(s.pearls, 20);
  assert.equal(s.stats.diamonds, 500);
  assert.equal(s.fishpedia.koi.best, 15);
  assert.ok(!s.fishpedia.fake);
  const again = await rpc(C, 'import_guest', [{ coins: 5 }]);
  assert.equal(again.coins, 2000);
});

await t('lake legends lists the three best catches', async () => {
  const rows = await rpc(null, 'top_trophies');
  assert.ok(Array.isArray(rows) && rows.length >= 1 && rows.length <= 3);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].rank > rows[i - 1].rank);
  assert.ok(rows[0].name && rows[0].speciesId && rows[0].ts > 0);
  const [{ best }] = await as(A, 'select max(points) as best from public.catches');
  const [{ pts }] = await as(A, `select points as pts from public.catches where id = '${rows[0].id}'`);
  assert.equal(pts, best);
});

await t('valley lakes are real zones (and the quarry bottom is gated)', async () => {
  await as(null, `update public.catches set created_at = now() - interval '5 minutes'`);
  const r = await rpc(A, 'record_catch', ['minnow', 'normal', 0.1, 'frost', 'day', 'clear', false, false]);
  assert.ok(r.summary || r.state || r, 'frost catch recorded');
  await assert.rejects(() => rpc(A, 'record_catch', ['koi', 'normal', 3, 'frost', 'day', 'clear', false, false]), /does not live in/);
  await as(null, `update public.catches set created_at = now() - interval '5 minutes'`);
  await as(null, `update public.profiles set level = 3 where id = '${A}'`);
  await assert.rejects(() => rpc(A, 'record_catch', ['sturgeon', 'normal', 30, 'quarry', 'day', 'clear', false, false]), /quarry/);
});

await t('close_week crowns the top angler', async () => {
  await as(null, `update public.catches set created_at = public._week_start() - interval '2 days'`);
  const w = await as(null, 'select public.close_week() as w');
  assert.ok(w[0].w);
});

await t('0005: ext saves and comes back in get_state', async () => {
  await rpc(A, 'save_ext', [{ v: 1, bait: { worm: 5 }, home: { decor: ['rug'] } }]);
  const st = await rpc(A, 'get_state');
  assert.equal(st.ext.bait.worm, 5);
  assert.equal(st.creelBonus, 0);
  await assert.rejects(() => rpc(A, 'save_ext', ['"nope"']), /Bad data/);
});

await t('0005: rewards are capped, unique per key and limited per day', async () => {
  const before = (await rpc(A, 'get_state')).coins;
  const r = await rpc(A, 'claim_reward', ['quest', 'd1-0', 99999, 50, 100, null, null]);
  assert.equal(r.ok, true);
  assert.equal(r.coins, 200, 'quest coins capped');
  assert.equal(r.pearls, 2, 'quest pearls capped at 2 (v1.8 dailies can pay a pearl or two)');
  assert.equal(r.state.coins, before + 200);
  const again = await rpc(A, 'claim_reward', ['quest', 'd1-0', 100, 0, 0, null, null]);
  assert.equal(again.ok, false);
  await rpc(A, 'claim_reward', ['quest', 'd1-1', 100, 0, 0, null, null]);
  await rpc(A, 'claim_reward', ['quest', 'd1-2', 100, 0, 0, null, null]);
  const bonus = await rpc(A, 'claim_reward', ['quest', 'bonus1', 200, 2, 120, null, null]);
  assert.equal(bonus.ok, true, 'the daily bonus is a fourth claim');
  const fifth = await rpc(A, 'claim_reward', ['quest', 'd9-9', 100, 0, 0, null, null]);
  assert.equal(fifth.ok, false, 'three quests and the bonus a day');
  await assert.rejects(() => rpc(A, 'claim_reward', ['cheat', 'x', 1, 0, 0, null, null]), /Unknown reward/);
  await assert.rejects(() => rpc(A, 'claim_reward', ['story', 'story99', 1, 0, 0, null, null]), /story chapter/);
  await assert.rejects(() => rpc(A, 'claim_reward', ['story', 'story5', 1, 0, 0, 'Supreme Overlord', null]), /Unknown title/);
  const s5 = await rpc(A, 'claim_reward', ['story', 'story5', 500, 25, 300, 'Lantern Keeper', 'lure_lantern']);
  assert.ok(s5.state.titles.includes('Lantern Keeper'));
  assert.ok(s5.state.owned.includes('lure_lantern'));
});

await t('0005: spending, hold upgrades raise the creel limit, gear catches skip the clock', async () => {
  await as(null, `update public.profiles set coins = 5000, pearls = 50 where id = '${A}'`);
  const poor = await rpc(B, 'spend_coins', ['bait', 'worm', 40, 0]);
  assert.equal(poor.ok, false);
  const bait = await rpc(A, 'spend_coins', ['bait', 'worm', 40, 0]);
  assert.equal(bait.ok, true);
  assert.equal(bait.state.coins, 4960);
  // v1.8: hold costs more and goes to level 5 (v1.13.9 floors: 4000 / 10000 / 22000 coins, 150 / 270 pearls)
  await assert.rejects(() => rpc(A, 'spend_coins', ['upgrade', 'hold2', 10000, 0]), /in order/);
  await assert.rejects(() => rpc(A, 'spend_coins', ['upgrade', 'hold1', 400, 0]), /Bad price/);
  const h1 = await rpc(A, 'spend_coins', ['upgrade', 'hold1', 4000, 0]);
  assert.equal(h1.state.creelBonus, 5);
  const dup = await rpc(A, 'spend_coins', ['upgrade', 'hold1', 4000, 0]);
  assert.equal(dup.ok, false);
  // crappie only bites at dusk/night, but a crab pot emptied at noon may hold one
  await as(null, `update public.catches set created_at = now() - interval '5 minutes'`);
  const night = ['crappie', 'normal', 1, 'dock', 'night', 'clear', false, true, true];
  const ok = await rpc(A, 'record_catch', night).catch((e) => e);
  assert.ok(!(ok instanceof Error), `away catch recorded: ${ok.message || ''}`);
  const give = await rpc(A, 'give_catch', [ok.summary.catchId]);
  assert.equal(give.ok, true);
  assert.ok(!give.state.creel.some((c) => c.id === ok.summary.catchId));
});

await t('0006: streak, goal, tandem and fish-of-the-week rewards are capped', async () => {
  const s = await rpc(B, 'claim_reward', ['streak', 's1', 999, 9, 99, null, null]);
  assert.equal(s.ok, true); assert.equal(s.coins, 30); assert.equal(s.pearls, 0);
  const goal = await rpc(B, 'claim_reward', ['goal', 'catch5', 30, 0, 20, null, null]);
  assert.equal(goal.ok, true);
  await assert.rejects(() => rpc(B, 'claim_reward', ['goal', 'free-money', 30, 0, 20, null, null]), /Bad goal/);
  const f1 = await rpc(B, 'claim_reward', ['fotw', 'w1', 120, 0, 60, null, null]);
  const f2 = await rpc(B, 'claim_reward', ['fotw', 'w2', 120, 0, 60, null, null]);
  assert.equal(f1.ok, true); assert.equal(f2.ok, false, 'one fish-of-the-week bonus a day');
});

await t('0008: the weekly quest pays 5 pearls at most, once per week key', async () => {
  const w = await rpc(B, 'claim_reward', ['weekly', 'w2859', 999, 99, 999, null, null]);
  assert.equal(w.ok, true); assert.equal(w.pearls, 5); assert.equal(w.coins, 150);
  const again = await rpc(B, 'claim_reward', ['weekly', 'w2859', 150, 5, 200, null, null]);
  assert.equal(again.ok, false);
  await assert.rejects(() => rpc(B, 'claim_reward', ['weekly', 'pearls-please', 150, 5, 200, null, null]), /Bad week/);
});

await t('0009: level rewards and the new species', async () => {
  const lv = await rpc(B, 'claim_reward', ['level', 'lv25', 99999, 99, 0, 'Lake Wanderer', null]);
  assert.equal(lv.ok, true); assert.equal(lv.pearls, 40); assert.equal(lv.coins, 6000);
  await assert.rejects(() => rpc(B, 'claim_reward', ['level', 'lv99', 10, 0, 0, null, null]), /Bad level reward/);
  const n = await as(A, `select count(*)::int as n from public.species where id in ('crayfish', 'murraycray', 'heir', 'echoeel')`);
  assert.equal(n[0].n, 4);
  const z = await as(A, `select zones from public.species where id = 'crayfish'`);
  assert.ok(z[0].zones.includes('dock') && z[0].zones.includes('quarry'));
});

await t('0010: Claude turn bonus and answer streak, capped', async () => {
  const c = await rpc(B, 'claim_reward', ['claude', 't1', 99999, 50, 99999, null, null]);
  assert.equal(c.ok, true); assert.equal(c.coins, 120); assert.equal(c.pearls, 0); assert.equal(c.xp, 80);
  const s = await rpc(B, 'claim_reward', ['answerstreak', 'a1', 500, 9, 999, null, null]);
  assert.equal(s.ok, true); assert.equal(s.coins, 0); assert.equal(s.pearls, 1); assert.equal(s.xp, 25);
  for (let i = 2; i <= 4; i++) await rpc(B, 'claim_reward', ['answerstreak', `a${i}`, 0, 1, 25, null, null]);
  const over = await rpc(B, 'claim_reward', ['answerstreak', 'a5', 0, 1, 25, null, null]).catch((e) => ({ ok: false, err: String(e) }));
  assert.equal(over.ok, false); // 4 a day
});

console.log(`sql: ${passed} passed`);
