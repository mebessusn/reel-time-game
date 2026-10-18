// v1.11 party, friends and chat channels (dev server on :5173). Three tabs share a lake over BroadcastChannel.
// Run: node tests/party.e2e.mjs
import { chromium } from 'playwright';
import { launchOpts } from './browser-opts.mjs';

const BASE = process.env.RT_URL || 'http://localhost:5173/';
const OUT = process.argv[2] || '/tmp/party';
const browser = await chromium.launch(launchOpts({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] }));
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const errors = [];
let failed = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok' : 'FAIL'} ${msg}`); if (!cond) failed++; };
const stamp = Date.now();
const opened = [];
const rest = (on) => Promise.all(opened.map((q) => q.evaluate((v) => { window.__game.engine.hidden = v; }, on).catch(() => {})));
const open = async (slot, name) => {
  await rest(true);
  const p = await ctx.newPage();
  opened.push(p);
  p.on('pageerror', (e) => errors.push(`${slot}: ${e.message}`));
  await p.goto(`${BASE}?autoplay&avatar=random&t=0.42&weather=clear&nonpc&gfx=low&as=${slot}${stamp}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForFunction(() => window.__game?.chat && window.__game.net?.connected, null, { timeout: 360000, polling: 1000 });
  await p.evaluate(async (n) => { await window.__game.setName(n); }, name);
  return p;
};
const ev = (p, fn, a) => p.evaluate(fn, a);
const until = (p, fn, a, ms = 15000) => p.waitForFunction(fn, a, { timeout: ms, polling: 250 }).then(() => true).catch(() => false);
const msgs = (p) => ev(p, () => window.__game.chat.tabs.get('lake').msgs.map((m) => `${m.channel || ''}|${m.name}>${m.text}`));
const idOf = (p) => ev(p, () => window.__game.save.userId);

const A = await open('ptA', 'Megan');
const B = await open('ptB', 'Dan');
const C = await open('ptC', 'Carl');
await rest(false);
await until(A, () => window.__game.party.peers().length >= 2, null, 30000);
const [a, b, c] = [await idOf(A), await idOf(B), await idOf(C)];
// stand A and B together at the dock, C far away
const put = (p, x, z) => ev(p, ([x2, z2]) => { const g = window.__game; g.player.pos.set(x2, g.player.pos.y, z2); g.player.target = null; }, [x, z]);
await put(A, 0, 34); await put(B, 1, 35); await put(C, 0, -90);
await A.waitForTimeout(4500);

// 1. invite + accept
await ev(A, (id) => window.__game.party.invite(id), b);
ok(await until(B, () => !!document.querySelector('.invite-card')), 'B sees the party invite');
await B.screenshot({ path: `${OUT}/invite.png` });
await ev(B, () => document.querySelector('.invite-card .btn.green').click());
ok(await until(A, (id) => window.__game.party.has(id), b), 'A has B in the party');
ok(await until(B, (id) => window.__game.party.has(id) && window.__game.party.state.ld === id, a), 'B follows A as leader');
ok(await until(A, () => !document.querySelector('.party-frame').hidden), 'the party frame shows');

// 2. a stranger can't join uninvited (C fakes an accept)
await ev(C, (pid) => { const P = window.__game.party; P.acc = { pid, ld: 'x', at: Date.now() }; P.push(); }, await ev(A, () => window.__game.party.state.id));
await A.waitForTimeout(2500);
ok(!(await ev(A, (id) => window.__game.party.has(id), c)), 'an uninvited angler cannot join by claiming an accept');
await ev(C, () => { window.__game.party.acc = null; window.__game.party.push(); });

// 3. chat channels: Say is nearby only, General reaches everyone, Party only the party
await ev(A, () => window.__game.chat.say('near hello', { channel: 'say' }));
await ev(A, () => window.__game.chat.say('lake hello', { channel: 'general' }));
await ev(A, () => window.__game.chat.say('party hello', { channel: 'party' }));
await B.waitForTimeout(2500);
const mb = await msgs(B), mc = await msgs(C);
ok(mb.includes('say|Megan>near hello') && !mc.some((x) => x.includes('near hello')), `Say reaches B (near) but not C (far) [${mc.join(' ; ')}]`);
ok(mb.includes('general|Megan>lake hello') && mc.includes('general|Megan>lake hello'), 'General reaches everyone');
ok(mb.includes('party|Megan>party hello') && !mc.some((x) => x.includes('party hello')), 'Party chat reaches the party only');
ok(await ev(A, () => window.__game.chat.channel === 'say'), 'Say is the default channel');
await ev(A, () => window.__game.chat.command('/g'));
ok(await ev(A, () => window.__game.chat.channel === 'general'), '/g switches typing to General');
await ev(A, () => window.__game.chat.command('/s'));

// 4. nameplates: party members at any distance, others within ~40 yards
await put(B, 0, -95); await put(C, 2, 36);
await A.waitForTimeout(3000);
const plates = await ev(A, () => window.__game.remotePlates().filter((r) => !r.isMe && !r.npc).map((r) => `${r.name}:${r.party ? 'party' : 'other'}`));
ok(plates.includes('Dan:party'), `B's plate shows far away because B is in the party (${plates})`);
await put(C, 0, -90);
// (three software-rendered tabs can be slow to send their new spot: wait for it rather than a fixed time)
await until(A, () => !window.__game.remotePlates().some((r) => r.name === 'Carl'), null, 30000);
const plates2 = await ev(A, () => window.__game.remotePlates().filter((r) => !r.isMe && !r.npc).map((r) => r.name));
const dbg = await ev(A, () => { const g = window.__game; return JSON.stringify({ me: [g.player.pos.x, g.player.pos.z].map(Math.round), r: [...g.remotes.list.values()].map((r) => [r.peer.meta?.name, r.peer.meta?.id, Math.round(r.pos.x), Math.round(r.pos.z), r.peer.state && Math.round(r.peer.state.z)]) }); });
ok(!plates2.includes('Carl'), `a stranger's plate hides beyond ~40 yards (${plates2}) ${dbg}`);
await A.screenshot({ path: `${OUT}/far-party.png` });

// 5. the map shows the party only
await ev(A, () => window.__game.ui.sheets.open('map'));
await A.waitForTimeout(1500);
await A.screenshot({ path: `${OUT}/map.png` });
await ev(A, () => window.__game.ui.sheets.close());

// 6. boats: strangers can't hop in, party members can
const hop = (p, near) => ev(p, ([x, z]) => { const g = window.__game; g.player.pos.set(x + 1.5, g.player.pos.y, z); return g.contextActions().some((x2) => x2.id.startsWith('hopin')); }, near);
await ev(A, () => { const g = window.__game; g.player.pos.set(-0.5, 1.5, 30); g.player.target = null; g.profile.level = 5; });
await A.waitForTimeout(500);
await ev(A, () => window.__game.launchBoat?.());
await A.waitForTimeout(2500);
const boat = await ev(A, () => { const p = window.__game.player.pos; return [p.x, p.z]; });
await ev(C, ([x, z]) => { const g = window.__game; g.player.mode = 'boat'; g.actor.setMode('boat'); g.player.pos.set(x + 1.5, 0.2, z); }, boat);
await ev(B, ([x, z]) => { const g = window.__game; g.player.mode = 'boat'; g.actor.setMode('boat'); g.player.pos.set(x - 1.5, 0.2, z); }, boat);
await A.waitForTimeout(3000);
await until(B, () => window.__game.contextActions().some((x) => x.id.startsWith('hopin')), null, 30000);
const cHop = await ev(C, () => window.__game.contextActions().some((x) => x.id.startsWith('hopin')));
const bHop = await ev(B, () => window.__game.contextActions().some((x) => x.id.startsWith('hopin')));
ok(!cHop, 'a stranger gets no Hop in');
const dbg2 = await ev(B, () => { const g = window.__game; return JSON.stringify({ party: [g.party.inParty, g.party.members().length, g.party.me], me: [g.player.mode, Math.round(g.player.pos.x), Math.round(g.player.pos.z)], acts: g.contextActions().map((x) => x.id), r: [...g.remotes.list.values()].map((r) => [r.peer.meta?.name, r.peer.meta?.id, r.peer.state?.mode, Math.round(r.pos.x), Math.round(r.pos.z), g.party.has(r.peer.meta?.id)]) }); });
ok(bHop, `a party member can hop in ${bHop ? '' : dbg2}`);
void hop;

// 7. friends
await ev(A, (id) => window.__game.party.friendRequest(id), c);
ok(await until(C, () => [...document.querySelectorAll('.invite-card')].some((e) => /friends/.test(e.textContent))), 'C gets a friend request');
await ev(C, () => document.querySelector('.invite-card .btn.green').click());
ok(await until(A, (id) => window.__game.party.isFriend(id), c), 'A and C are friends');
ok(await until(C, (id) => window.__game.party.isFriend(id), a), '...both ways');
await ev(A, () => { window.__game.ui.sheets.state.socialTab = 'friends'; window.__game.ui.sheets.open('social'); });
await A.waitForTimeout(1200);
await A.screenshot({ path: `${OUT}/friends.png` });
await ev(A, () => { window.__game.ui.sheets.state.socialTab = 'party'; window.__game.ui.sheets.render(); });
await A.waitForTimeout(800);
await A.screenshot({ path: `${OUT}/party.png` });
await ev(A, () => window.__game.ui.sheets.close());

// 8. the leader leaves: B leads alone? (a party of one breaks up)
await ev(A, () => window.__game.party.leave());
ok(await until(B, () => !window.__game.party.inParty), 'when the leader of a 2-person party leaves, it breaks up');

ok(!errors.length, `no page errors ${errors.slice(0, 3).join(' | ')}`);
console.log(failed ? `party e2e: ${failed} FAILED` : 'party e2e: all passed');
await browser.close();
process.exit(failed ? 1 : 0);
