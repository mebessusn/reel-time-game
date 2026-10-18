// Social + lake features regression test (dev server on :5173). Three tabs share a lake over
// BroadcastChannel: lake chat, whispers reach only their target, /me, mute, rate limit, system log,
// chat bubbles, the Lake Legends board, swirling pools (boat only) and ambient fish.
// Run: node tests/social.test.mjs
import { chromium } from 'playwright';
import { launchOpts } from './browser-opts.mjs';

const BASE = process.env.RT_URL || 'http://localhost:5173/';
const browser = await chromium.launch(launchOpts({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] }));
const ctx = await browser.newContext({ viewport: { width: 760, height: 520 } });
const errors = [];
let failed = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok' : 'FAIL'} ${msg}`); if (!cond) failed++; };
const stamp = Date.now();
const opened = [];
// While a new tab boots, the open ones idle like real background tabs (engine.hidden: ~1 Hz, no render), so a 2-CPU box isn't starved
const rest = (on) => Promise.all(opened.map((q) => q.evaluate((v) => { window.__game.engine.hidden = v; }, on).catch(() => {})));
const open = async (slot, name) => {
  await rest(true);
  const p = await ctx.newPage();
  opened.push(p);
  p.on('pageerror', (e) => errors.push(`${slot}: ${e.message}`));
  await p.goto(`${BASE}?autoplay&avatar=random&t=0.42&weather=clear&nonpc&gfx=low&as=${slot}${stamp}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForFunction(() => window.__game?.chat && window.__game.net?.connected, null, { timeout: 360000, polling: 1000 });
  await p.evaluate(async (n) => { const g = window.__game; await g.setName(n); }, name);
  return p;
};
const A = await open('socA', 'Megan');
const B = await open('socB', 'Drifter Dan');
const C = await open('socC', 'Carl');
await rest(false);
await A.waitForFunction(() => window.__game.chat.people().length >= 2, null, { timeout: 20000 }).catch(() => {});
const msgs = (p, key) => p.evaluate((k) => (window.__game.chat.tabs.get(k)?.msgs || []).map((m) => `${m.sys ? 'SYS' : m.name}>${m.text}`), key);
const type = async (p, text) => { await p.keyboard.press('Enter'); await p.keyboard.type(text); await p.keyboard.press('Enter'); };

// 1. Lake chat reaches everyone, with a bubble over the speaker. Bubbles only show over anglers near you, so
// stand all three on the dock together first and wait until B sees A there (autoplay may have wandered them off).
for (const [p, dx] of [[A, 0], [B, 1.2], [C, -1.2]]) await p.evaluate((dx) => { const g = window.__game; g.player.target = null; g.player.pos.set(dx, g.player.pos.y, 38); }, dx);
await B.waitForFunction(() => { const g = window.__game; const rs = [...g.remotes.list.values()]; return rs.length >= 2 && rs.every((r) => r.pos.distanceTo(g.player.pos) < 6); }, null, { timeout: 20000 }).catch(() => {});
await A.bringToFront();
await type(A, 'hello lake!');
await B.waitForFunction(() => window.__game.chat.tabs.get('lake').msgs.some((m) => m.text === 'hello lake!'), null, { timeout: 10000 }).catch(() => {});
ok((await msgs(B, 'lake')).includes('Megan>hello lake!'), 'lake chat reaches another angler');
ok((await msgs(C, 'lake')).includes('Megan>hello lake!'), '...and a third');
const bubble = await B.waitForFunction(() => [...window.__game.remotes.list.values()].some((r) => r.bubble?.kind === 'chat' && r.bubble.text === 'hello lake!'), null, { timeout: 5000 }).then(() => true, () => false);
ok(bubble, 'a chat bubble pops over the speaker');

// 1b. /say is heard only nearby, with a bubble over the speaker
await B.evaluate(() => { const g = window.__game; g.player.pos.set(1.5, g.player.pos.y, 36); g.player.target = null; });
await C.evaluate(() => { const g = window.__game; g.player.pos.set(-60, 2, 70); g.player.target = null; });
await A.evaluate(() => { const g = window.__game; g.player.pos.set(0.5, g.player.pos.y, 38); g.player.target = null; });
await A.waitForTimeout(2500);
await A.bringToFront();
await type(A, '/say anyone want to fish the marsh?');
await B.waitForFunction(() => window.__game.chat.tabs.get('lake').msgs.some((m) => m.local), null, { timeout: 10000 }).catch(() => {});
const sayB = await B.evaluate(() => ({ line: window.__game.chat.tabs.get('lake').msgs.some((m) => m.local && m.text.includes('marsh')), bubble: [...window.__game.remotes.list.values()].some((r) => r.bubble?.kind === 'chat' && r.bubble.text.includes('marsh')) }));
await C.waitForTimeout(1000);
const sayC = await C.evaluate(() => window.__game.chat.tabs.get('lake').msgs.some((m) => m.text.includes('fish the marsh')));
const sayA = await A.evaluate(() => !!window.__game.myChat && window.__game.myChat.text.includes('marsh'));
ok(sayB.line && sayB.bubble && sayA, `/say pops a bubble for nearby anglers (${JSON.stringify(sayB)}, own bubble ${sayA})`);
ok(!sayC, 'anglers far away do not hear a /say');
await C.evaluate(() => { const g = window.__game; g.player.pos.set(-1.5, 1.5, 37); });

// 2. Whisper only reaches its target, opens a DM tab, and /r replies
await A.waitForFunction(() => window.__game.chat.people().some((p) => p.name === 'Drifter Dan'), null, { timeout: 60000, polling: 500 }).catch(() => {});
await type(A, '/w dri psst, pool by the island');
await B.waitForFunction(() => [...window.__game.chat.tabs.keys()].some((k) => k.startsWith('dm:')), null, { timeout: 10000 }).catch(() => {});
const bTabs = await B.evaluate(() => [...window.__game.chat.tabs.values()].filter((t) => t.userId).map((t) => `${t.label}:${t.msgs.map((m) => m.text).join('|')}:${t.unread}`));
ok(bTabs.length === 1 && bTabs[0].startsWith('Megan:psst, pool by the island'), `whisper lands in a DM tab (${bTabs.join(',')} | A: ${(await msgs(A, 'system')).slice(-3).join(' / ')} | A tabs ${await A.evaluate(() => [...window.__game.chat.tabs.keys()].join(','))} | A people ${await A.evaluate(() => JSON.stringify(window.__game.chat.people().map((p) => p.name)))})`);
await A.waitForTimeout(800);
const cSaw = await C.evaluate(() => [...window.__game.chat.tabs.values()].some((t) => t.msgs.some((m) => m.text?.includes('psst'))));
ok(!cSaw, 'nobody else sees the whisper');
await B.bringToFront();
await B.waitForFunction(() => window.__game.chat.people().some((p) => p.name === 'Megan'), null, { timeout: 60000, polling: 500 }).catch(() => {});
await type(B, '/r on my way');
await A.waitForFunction(() => [...window.__game.chat.tabs.values()].some((t) => t.userId && t.msgs.some((m) => m.text === 'on my way')), null, { timeout: 10000 }).catch(() => {});
ok(await A.evaluate(() => [...window.__game.chat.tabs.values()].some((t) => t.userId && t.msgs.some((m) => m.text === 'on my way' && !m.self))), '/r replies to the last whisper');

// 3. /me, /help, unknown commands, length cap, strong-language filter
await A.bringToFront();
await A.evaluate(() => window.__game.chat.select('lake'));
await type(A, '/me casts a hopeful line');
await C.waitForFunction(() => window.__game.chat.tabs.get('lake').msgs.some((m) => m.action), null, { timeout: 10000 }).catch(() => {});
ok(await C.evaluate(() => window.__game.chat.tabs.get('lake').msgs.some((m) => m.action && m.text === 'casts a hopeful line')), '/me shows as an action');
await type(A, '/help');
ok((await msgs(A, 'system')).some((t) => t.includes('/w name msg')), '/help lists commands');
await type(A, '/frobnicate');
ok((await msgs(A, 'system')).some((t) => t.includes('Unknown command')), 'unknown commands explain themselves');
ok(await A.evaluate(() => document.querySelector('.chat-input').maxLength === 160), 'messages are capped at 160 characters');
const filtered = await A.evaluate(() => window.__game.chat.show('well shit'));
ok(filtered === 'well s★★★', `strong language is softened (${filtered})`);

// 4. Mute hides someone; rate limit stops floods
await C.bringToFront();
await type(C, '/mute Megan');
await A.bringToFront();
await type(A, 'can anyone hear me');
await B.waitForFunction(() => window.__game.chat.tabs.get('lake').msgs.some((m) => m.text === 'can anyone hear me'), null, { timeout: 10000 }).catch(() => {});
await C.waitForTimeout(500);
const cl = await msgs(C, 'lake'), bl = await msgs(B, 'lake');
ok(!cl.some((t) => t.includes('can anyone hear me')) && bl.some((t) => t.includes('can anyone hear me')), `muted angler is hidden for the muter only (C: ${cl.slice(-3).join(' / ')} | B: ${bl.slice(-2).join(' / ')} | A: ${(await msgs(A, 'lake')).slice(-2).join(' / ')})`);
const sentBefore = await A.evaluate(() => window.__game.chat.tabs.get('lake').msgs.filter((m) => m.self).length);
for (let i = 0; i < 7; i++) await A.evaluate((n) => { const c = window.__game.chat; c.input.value = `spam ${n}`; c.submit(); }, i);
const sentAfter = await A.evaluate(() => window.__game.chat.tabs.get('lake').msgs.filter((m) => m.self).length);
ok(sentAfter - sentBefore <= 5 && (await msgs(A, 'lake')).some((t) => t.includes('Easy there')), `rate limit kicks in (${sentAfter - sentBefore} of 7 sent)`);

// 5. System log: joins and great catches from others
ok((await msgs(A, 'system')).some((t) => t.includes('paddled in')), 'joins show in the system log');
await A.waitForFunction(() => window.__game.chat.people().some((p) => p.name === 'Drifter Dan'), null, { timeout: 60000, polling: 500 }).catch(() => {});
await B.evaluate(() => window.__game.netEvent('catch', { speciesId: 'koi', variant: 'gold', weight: 6.5, tier: 'rare' }));
await A.waitForFunction(() => window.__game.chat.tabs.get('system').msgs.some((m) => m.text.includes('Gold Koi')), null, { timeout: 10000 }).catch(() => {});
ok((await msgs(A, 'system')).some((t) => /(Drifter Dan|Someone) landed a Gold Koi/.test(t)), `great catches from others show in the system log (${(await msgs(A, 'system')).slice(-3).join(' / ')})`);

// 6. Lake Legends: a big catch lands on the board for everyone on this device, E opens it
const legend = await A.evaluate(async () => {
  const g = window.__game;
  await g.trophies.onCatch({ id: `legend${Date.now()}`, speciesId: 'oldwhiskers', variant: 'gold', weight: 100, zone: 'deep', ts: Date.now() });
  g.player.pos.set(14.2, g.player.pos.y, 41.6); g.player.target = null; // in front of the board on the rise
  return { top: g.trophies.list[0]?.speciesId, mounted: g.engine.props.trophyBoard.children[1].children.length, acts: g.contextActions().map((a) => a.id) };
});
ok(legend.top === 'oldwhiskers' && legend.mounted >= 1, `best catch hangs on the board (${legend.top}, ${legend.mounted} mounted)`);
ok(legend.acts[0] === 'legends', `Lake Legends is the E action by the board (${legend.acts.join(',')})`);
await A.keyboard.press('e');
await A.waitForTimeout(500);
const sheet = await A.evaluate(() => ({ name: window.__game.ui.sheets.current?.name, text: document.querySelector('.sheet-body')?.textContent || '' }));
ok(sheet.name === 'legends' && sheet.text.includes('Old Whiskers') && sheet.text.includes('Caught by') && sheet.text.includes('whiskers drag'), 'E opens the board: fish, catcher, date and description');
await A.keyboard.press('Escape');
await B.evaluate(() => window.__game.trophies.local = JSON.parse(localStorage.getItem('rt_trophies')) || []).then(() => B.evaluate(() => window.__game.trophies.recompute()));
ok(await B.evaluate(() => window.__game.trophies.list[0]?.speciesId === 'oldwhiskers'), 'other tabs on the device see the same board');

// 7. Swirling pools: odds only boosted from a boat, inside the pool
const sw = await A.evaluate(() => {
  const g = window.__game;
  const p = g.swirls.pools[0];
  g.fishing.bobber = { x: p.x, z: p.z };
  const shore = g.fishing.ctx().swirl;
  g.player.launchBoat(); g.actor.setMode('boat');
  const boat = g.fishing.ctx().swirl;
  g.fishing.bobber = { x: p.x + 8, z: p.z + 8 };
  const outside = g.fishing.ctx().swirl;
  g.fishing.bobber = null;
  return { shore, boat, outside, meshes: g.swirls.meshes.size };
});
ok(!sw.shore && sw.boat && !sw.outside && sw.meshes >= 1, `swirl boost only in the pool from a boat (${JSON.stringify(sw)})`);
ok(await A.evaluate(() => { const S = window.__game.ambient.schools; const solo = S.filter((s) => s.solo); return S.length >= 8 && solo.length >= 3 && solo.length < S.length && solo.every((s) => s.fish.length === 1) && S.filter((s) => !s.solo).every((s) => s.fish.length >= 3); }), 'ambient fish: schools plus lone fish');

ok(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' / ')}` : ''}`);
await browser.close();
console.log(failed ? `social: ${failed} failed` : 'social: all passed');
process.exit(failed ? 1 : 0);
