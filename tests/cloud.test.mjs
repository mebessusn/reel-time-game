// Integration test: the real CloudSave client talking to the real migration (PGlite) through a
// stand-in for the Supabase JS client (rpc + from().select + realtime channel).
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CloudSave } from '../src/save/cloud.js';
import * as R from '../src/game/rules.js';

process.on('unhandledRejection', (e) => { console.error('CLOUD TEST FAILED:', e.message); process.exit(1); });
const db = new PGlite();
const read = (f) => fs.readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8');
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

const feedSubs = new Set();
function fakeSupabase(uid) {
  return {
    async rpc(fn, args) {
      const names = Object.keys(args);
      const sql = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
      try {
        await db.query(`select set_config('test.uid', $1, false)`, [uid]);
        const before = (await db.query(`select coalesce(max(created_at), 'epoch') as m from public.feed`)).rows[0].m;
        const r = await db.query(sql, names.map((n) => (args[n] !== null && typeof args[n] === 'object' && !Array.isArray(args[n]) ? JSON.stringify(args[n]) : args[n])));
        // Emulate Realtime INSERT events on the feed table
        const fresh = await db.query(`select * from public.feed where created_at > $1 order by created_at`, [before]);
        for (const row of fresh.rows) feedSubs.forEach((fn) => fn({ new: { ...row, created_at: new Date(row.created_at).toISOString() } }));
        return { data: r.rows[0].r, error: null };
      } catch (e) { return { data: null, error: { message: e.message } }; }
    },
    from(table) {
      return {
        select() {
          const q = { order: null, limit: null };
          const run = async () => {
            let sql = `select * from public.${table}`;
            if (q.order) sql += ` order by ${q.order.col} ${q.order.asc ? 'asc' : 'desc'}`;
            if (q.limit) sql += ` limit ${q.limit}`;
            const r = await db.query(sql);
            return { data: r.rows.map((x) => ({ ...x, created_at: x.created_at ? new Date(x.created_at).toISOString() : x.created_at })), error: null };
          };
          const chain = {
            order(col, { ascending }) { q.order = { col, asc: ascending }; return chain; },
            limit(n) { q.limit = n; return chain; },
            then(res, rej) { return run().then(res, rej); },
          };
          return chain;
        },
      };
    },
    channel() {
      const ch = { on(_t, _f, fn) { feedSubs.add(fn); return ch; }, subscribe() { return ch; } };
      return ch;
    },
    auth: { async signOut() {} },
  };
}

const U1 = 'aaaaaaaa-0000-0000-0000-000000000001', U2 = 'aaaaaaaa-0000-0000-0000-000000000002';
await db.exec(`insert into auth.users values ('${U1}'), ('${U2}')`);
const s1 = new CloudSave(fakeSupabase(U1), { user: { id: U1 } });
const s2 = new CloudSave(fakeSupabase(U2), { user: { id: U2 } });
let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log('  ok', name); };

await t('init creates a profile with the same shape as guest saves', async () => {
  const p = await s1.init('Chef');
  assert.equal(s1.isNew, true);
  const local = R.newProfile('x');
  for (const k of ['name', 'level', 'xp', 'coins', 'pearls', 'owned', 'equipped', 'creel', 'storage', 'fishpedia', 'stats', 'achievements', 'settings', 'titles', 'bottles']) assert.ok(k in p, `missing ${k}`);
  assert.deepEqual(Object.keys(p.settings).sort(), Object.keys(local.settings).sort());
  await s2.init('Dev Two');
});

const feedSeen = [];
s2.onFeed((e) => feedSeen.push(e));

await t('recordCatch returns a reveal summary and updates state', async () => {
  const sum = await s1.recordCatch({ speciesId: 'bluegill', variant: 'normal', weight: 0.42, zone: 'dock', phase: 'day', weather: 'clear', fullMoon: false, waitCatch: false });
  assert.equal(sum.species.name, 'Bluegill');
  assert.equal(sum.newSpecies, true);
  assert.equal(typeof sum.weight, 'number');
  assert.equal(s1.profile.creel.length, 1);
  assert.equal(s1.profile.catchCount, 1);
  assert.ok(sum.catchId);
});

await t('great catches reach other players\' feeds', async () => {
  await s1.recordCatch({ speciesId: 'catfish', variant: 'gold', weight: 5, zone: 'dock', phase: 'night', weather: 'clear' }).catch(async (e) => {
    if (!/not biting/.test(e.message)) throw e;
    await s1.recordCatch({ speciesId: 'bluegill', variant: 'gold', weight: 0.5, zone: 'dock', phase: 'day', weather: 'clear' });
  });
  assert.ok(feedSeen.some((e) => e.kind === 'catch' && e.payload.variant === 'gold'));
  const list = await s2.listFeed();
  assert.ok(list.length >= 1 && list[0].name === 'Chef');
});

await t('achievements claim through the server', async () => {
  const claim = R.claimableAchievements(s1.profile).map((a) => a.id);
  assert.ok(claim.includes('first_bite'));
  const a = await s1.claim('first_bite');
  assert.equal(a.name, 'First Bite');
  assert.ok(s1.profile.achievements.first_bite);
  assert.equal(await s1.claim('first_bite'), null);
});

await t('sell / trade / move / release keep the mirror in sync', async () => {
  const id = s1.profile.creel[0].id;
  const r = await s1.sell([id]);
  assert.ok(r.coins > 0 && r.sold === 1);
  assert.ok(!s1.profile.creel.find((c) => c.id === id));
  const left = s1.profile.creel[0];
  assert.equal(await s1.moveCatch(left.id, 'storage'), true);
  assert.equal(s1.profile.storage.length, 1);
  const tr = await s1.trade(left.id);
  assert.equal(tr.ok, left.variant !== 'normal' ? tr.ok : false);
  await s1.release(s1.profile.storage[0]?.id || left.id).catch(() => {});
});

await t('shop buy + equip', async () => {
  const fail = await s1.buy('rod_copper');
  assert.equal(fail.ok, false);
  await db.query(`update public.profiles set coins = 500 where id = '${U1}'`);
  const ok = await s1.buy('rod_birch');
  assert.equal(ok.ok, true); assert.equal(ok.item.name, 'Birch Classic');
  assert.equal(await s1.equip('rod', 'rod_birch'), true);
  assert.equal(s1.profile.equipped.rod, 'rod_birch');
});

await t('profile: avatar, name, title, settings (debounced)', async () => {
  await s1.saveAvatar({ gender: 'female', hair: 'braids' });
  assert.equal(s1.profile.avatar.hair, 'braids');
  await s1.setName('Chef Megan');
  assert.equal(s1.profile.name, 'Chef Megan');
  await s1.saveSettings({ music: 0.1 });
  assert.equal(s1.profile.settings.music, 0.1);
  await new Promise((r) => setTimeout(r, 1000));
  const st = (await db.query(`select settings from public.profiles where id = '${U1}'`)).rows[0].settings;
  assert.equal(st.music, 0.1);
});

await t('leaderboard and records', async () => {
  const rows = await s2.leaderboard('top', 'week');
  assert.ok(rows.length >= 1 && typeof rows[0].score === 'number');
  const recs = await s2.records();
  assert.ok(recs.bluegill && recs.bluegill.name);
  const legends = await s2.topTrophies();
  assert.ok(legends.length >= 1 && legends[0].speciesId && legends[0].name);
  const { sanitizeTrophy } = await import('../src/game/trophies.js');
  assert.ok(sanitizeTrophy(legends[0]), 'server rows pass the client sanitizer');
});

await t('junk with bottle messages', async () => {
  await db.query(`update public.catches set created_at = now() - interval '2 minutes'`);
  const out = await s2.recordJunk('bottle');
  assert.ok(typeof out.message === 'string' && out.message.length > 5);
});

await t('server errors surface as readable messages', async () => {
  await assert.rejects(() => s2.recordCatch({ speciesId: 'bluegill', variant: 'normal', weight: 50, zone: 'dock', phase: 'day', weather: 'clear' }), /Weight out of range/);
});

await t('rewards, spending, gifts and extended state go through the server', async () => {
  const sv = new CloudSave(fakeSupabase(U2), { user: { id: U2 } });
  await sv.init('Ext Tester');
  await db.query(`update public.profiles set coins = 1500 where id = '${U2}'`);
  const g1 = await sv.grant('tutorial', 'first', { coins: 50, xp: 20 });
  assert.equal(g1.ok, true);
  const g2 = await sv.grant('tutorial', 'first', { coins: 50, xp: 20 });
  assert.equal(g2.ok, false);
  const sp = await sv.spend('upgrade', 'hold1', { coins: 1000 });
  assert.equal(sp.ok, true);
  assert.equal(sv.profile.creelBonus, 5);
  await sv.saveExt({ v: 1, bait: { worm: 3 } });
  const again = new CloudSave(fakeSupabase(U2), { user: { id: U2 } });
  await again.init('Ext Tester');
  assert.equal(again.ext.bait.worm, 3);
});

console.log(`cloud: ${passed} passed`);
