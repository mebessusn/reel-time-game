// v1.15 Open Waters: a charter end to end (dev server on :5173). Three tabs share a lake over BroadcastChannel:
// A books a charter for the party, B gets the invite and boards, C stays on the lake. Out at sea A and B see each
// other on the same boat and chat only with each other, B gaffs A's fish as the crew's gaffer, the boat sails to
// Palm Key for both, they race crabs against two islanders (stage 4's beach games), and A calls everyone home.
// Run: node tests/charter.e2e.mjs [outDir]
import { chromium } from 'playwright';
import { launchOpts } from './browser-opts.mjs';

const BASE = process.env.RT_URL || 'http://localhost:5173/';
const OUT = process.argv[2] && !/^https?:/.test(process.argv[2]) ? process.argv[2] : '/tmp/charter'; // (a URL here is the page, not the output folder: it once wrote screenshots into 'http:/', which Windows can't check out)
const browser = await chromium.launch(launchOpts({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] }));
const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
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
  await p.evaluate(async (n) => { const g = window.__game; await g.setName(n); g.tutorial?.skip?.(); const p2 = g.profile; p2.xp = Math.max(p2.xp || 0, 200000); p2.level = 22; p2.coins = 12000; g.pushMeta(); }, name);
  return p;
};
const ev = (p, fn, a) => p.evaluate(fn, a);
const until = (p, fn, a, ms = 20000) => p.waitForFunction(fn, a, { timeout: ms, polling: 250 }).then(() => true).catch(() => false);
const idOf = (p) => ev(p, () => window.__game.save.userId);
const msgs = (p) => ev(p, () => [...window.__game.chat.tabs.values()].flatMap((t) => t.msgs.map((m) => `${m.name}>${m.text}`)));

const A = await open('chA', 'Megan');
const B = await open('chB', 'Dan');
const C = await open('chC', 'Carl');
await rest(false);
await until(A, () => window.__game.party.peers().length >= 2, null, 40000);
const [a, b, c] = [await idOf(A), await idOf(B), await idOf(C)];
const put = (p, x, z) => ev(p, ([x2, z2]) => { const g = window.__game; g.player.pos.set(x2, g.player.pos.y, z2); g.player.target = null; }, [x, z]);
await put(A, 18, 31); await put(B, 17, 32); await put(C, 0, 36);

// 1. a party, then the charter card at Marlowe's pier
await ev(A, (id) => window.__game.party.invite(id), b);
ok(await until(B, () => !!document.querySelector('.invite-card')), 'B sees the party invite');
await ev(B, () => document.querySelector('.invite-card .btn.green').click());
ok(await until(A, (id) => window.__game.party.has(id), b), 'A and B are a party');
ok(await ev(A, () => window.__game.ocean.contextActions().some((x) => x.id === 'marlowe')), 'Captain Marlowe is at his pier');
await ev(A, () => window.__game.ocean.ui.charterCard());
ok(await until(A, () => document.querySelectorAll('.ow-charter .ow-crew').length === 2), 'the charter card lists both of us');
await A.screenshot({ path: `${OUT}/card.png` });

// 2. A sets sail; B gets the invite and boards; C stays on the lake
await ev(A, () => document.querySelector('.ow-charter .btn.gold').click());
ok(await until(A, () => window.__game.ocean.atSea && !!window.__game.ocean.crewNet, null, 30000), 'A is at sea, in the crew room');
const invited = await until(B, () => !!document.querySelector('.ow-invite'), null, 90000);
ok(invited, 'B gets the invite to board');
if (!invited) console.log('  B sees:', JSON.stringify(await ev(B, () => { const g = window.__game; return { modal: g.ui.modalOpen, modals: [...document.querySelectorAll('.ow-modal, .invite-card, .dlg, .level-card')].map((e) => e.className), peers: g.party.peers().map((p) => ({ id: p.id, chtr: !!p.meta?.chtr, crew: p.meta?.chtr?.crew })), me: g.save.userId }; })));
await ev(B, () => document.querySelector('.ow-invite .btn.gold').click());
ok(await until(B, () => window.__game.ocean.atSea && !!window.__game.ocean.crewNet, null, 30000), 'B boards the same charter');
ok(await ev(A, () => window.__game.ext.d.ocean.freeUsed && window.__game.profile.coins === 12000), 'A\'s first trip was free');
ok(await until(A, (id) => { const r = window.__game.remotes.list.get([...window.__game.net.peers.values()].find((p) => p.meta?.id === id)?.id); return !!r && r.actor.root.visible; }, b, 30000), 'A sees B at sea');
ok(await until(B, () => { const g = window.__game; return [...g.remotes.list.values()].some((r) => r.actor.root.visible && Math.hypot(r.pos.x - g.player.pos.x, r.pos.z - g.player.pos.z) < 12); }, null, 30000), 'B sees A on the same boat, a few steps away');
ok(await until(C, (ids) => { const g = window.__game; return ids.every((id) => { const p = [...g.net.peers.values()].find((q) => q.meta?.id === id); return p && p.meta?.away?.k === 'charter' && !p.state; }); }, [a, b], 30000), 'the lake sees them away on a charter (no position)');
await A.screenshot({ path: `${OUT}/aboard.png` });

// 3. chat: the crew hears the crew, the lake hears the lake
await ev(A, () => window.__game.chat.say('fish on soon', { channel: 'general' }));
await ev(C, () => window.__game.chat.say('anyone here?', { channel: 'general' }));
await B.waitForTimeout(3000);
const mb = await msgs(B), mc = await msgs(C);
ok(mb.some((x) => x.includes('fish on soon')) && !mb.some((x) => x.includes('anyone here?')), 'B hears the crew, not the lake');
ok(!mc.some((x) => x.includes('fish on soon')), 'C on the lake doesn\'t hear the crew');

// 4. a big-game fight with B as the gaffer
await ev(B, () => window.__game.ocean.fight.setRole('gaffer'));
await A.waitForTimeout(1500);
await ev(A, () => {
  const g = window.__game, o = g.ocean, st = o.boat.toWorld(0, -14);
  g.player.faceToward(st.x, st.z);
  const cast = () => { g.player.faceToward(st.x, st.z); g.fishing.startCharge(null); g.fishing.power = 0.8; g.fishing.releaseCharge(); };
  cast();
  window.__pol = setInterval(() => {
    const f = g.fishing;
    if (window.__pausePol) return;
    if (f.state === 'idle' && !window.__landedOne) cast(); // (a reef fish off Marlowe's mooring: let it go and cast again)
    if (f.state === 'reeling' && f.reel && !f.reel.big) { f.cancel(); return; }
    if (f.state === 'waiting' && f.timer > 2) f.timer = 1.7;
    if (f.state === 'bite') { if (!window.__landedOne) f.forcedBite = { kind: 'fish', speciesId: 'sailfish', variant: 'normal', weight: 80 }; f.hook(); } // a sure big-game bite (the mooring's bites are mostly reef fish)
    const r = f.reel;
    if (f.state === 'reeling' && r?.big) {
      if (window.__skip && r.progress < 0.9 && !r.big.gaff) r.progress = 0.93; // skip ahead to the end of the fight (after the rod has changed hands: a fish alongside can't be handed over)
      f.holding = r.tension < 0.65 && !(r.big.run > 0) && r.jump <= 0;
      g.rodAim = -r.pull;
    }
  }, 100);
});
ok(await until(A, () => !!window.__game.fishing.reel?.big, null, 240000), 'A hooks a big-game fish');
ok(await until(A, () => window.__game.chairs.seat?.kind === 'fight', null, 5000), 'A goes to the fighting chair');
ok(await until(B, () => !!window.__game.ocean.fight.helping, null, 20000), 'B sees A\'s fight');
await B.screenshot({ path: `${OUT}/helping.png` });
// take the rod: B takes over A's fight where it stands, then hands it back (v1.15.5)
await ev(A, () => { window.__pausePol = true; });
await ev(B, () => window.__game.ocean.fight.askTake());
ok(await until(B, () => !!window.__game.fishing.reel?.big, null, 45000), 'B takes the rod mid-fight'); // (state crawls at software frame rates)
ok(await until(A, () => window.__game.fishing.state !== 'reeling', null, 10000), 'A hands it over');
ok(await until(A, () => !!window.__game.ocean.fight.helping, null, 45000), 'A now helps B');
await ev(A, () => window.__game.ocean.fight.askTake());
const back = await until(A, () => !!window.__game.fishing.reel?.big, null, 45000);
ok(back, 'and takes it back');
if (!back) console.log('  takeback:', JSON.stringify(await ev(A, () => { const f = window.__game.ocean.fight; return { takeReq: f.takeReq, helping: f.helping?.id, seen: f.seenHand, state: window.__game.fishing.state }; })), JSON.stringify(await ev(B, () => { const g = window.__game, f = g.ocean.fight, r = g.fishing.reel; return { state: g.fishing.state, big: !!r?.big, p: r?.progress, gaff: !!r?.big?.gaff, handoff: f.handoff, crewTk: f.crew().map((m) => m.state?.tk) }; })));
await ev(A, () => { window.__pausePol = false; window.__skip = true; });
ok(await until(B, () => window.__game.ocean.fight.helping?.f?.g >= 1, null, 60000), 'B sees the fish alongside');
// B's gaffer presses the crew key when the gaff shows green (pressing early just misses, like a player would)
await ev(B, () => { const g = window.__game; window.__gaffer = setInterval(() => { const f = g.ocean.fight.helping?.f; if (f?.g === 2) g.ocean.fight.crewKey(true); }, 300); });
ok(await until(A, () => Object.keys(window.__game.ext.d.ocean.catches || {}).length > 0, null, 90000), 'B gaffed it and A landed the fish');
await ev(A, () => { window.__landedOne = true; });
ok(await until(A, () => !!window.__game.profile.achievements.ow_trophy, null, 15000), 'A earns Trophy Hunter (stage 5)');
await ev(A, () => document.querySelector('.ow-release .btn.ghost')?.click());
await ev(A, () => clearInterval(window.__pol));
await ev(B, () => clearInterval(window.__gaffer));
await A.screenshot({ path: `${OUT}/landed.png` });
await ev(A, () => document.querySelector('.reveal .btn, .catch-card .btn')?.click?.());

// 5. sailing: A sets a course for Palm Key and B's copy of the boat goes too
await A.waitForTimeout(3000);
await ev(A, () => { const g = window.__game; g.ui.closeAll(); g.ocean.ui.closeModal(); g.ocean.sailTo('palmdock'); });
ok(await until(B, () => window.__game.ocean.charter?.spot === 'palmdock', null, 20000), 'B\'s boat sets the same course');
ok(await until(B, () => window.__game.ocean.boat.pose.moving || !!window.__game.ocean.moored(), null, 20000), 'and gets under way (it\'s a short hop from the mooring)');

// 6. beach games on Palm Key: A hosts the crab races, B joins from the invite, both get the same podium
ok(await until(A, () => !!window.__game.ocean.moored(), null, 180000), 'the boat moors at Palm Key');
await until(B, () => !!window.__game.ocean.moored(), null, 30000);
await ev(A, () => { const g = window.__game; g.ui.closeAll(); g.ocean.ui.closeModal(); g.ocean.goAshore(); });
await ev(B, () => { const g = window.__game; g.ui.closeAll(); g.ocean.ui.closeModal(); g.ocean.goAshore(); });
await A.waitForTimeout(1500);
await ev(A, () => window.__game.ocean.games.host('crabs'));
ok(await until(B, () => !!document.querySelector('.bg-invite'), null, 30000), 'B is invited to A\'s crab races');
await ev(B, () => document.querySelector('.bg-invite .btn.gold').click());
ok(await until(A, (id) => window.__game.ocean.games.lobby?.ps.some((p) => p[0] === id), b, 20000), 'B joins A\'s lobby');
await ev(A, () => window.__game.ocean.games.start());
ok(await until(B, () => window.__game.ocean.games.round?.g === 'crabs', null, 20000), 'B is in the same race');
ok(await ev(B, (ids) => { const r = window.__game.ocean.games.round; return r.ps.length === 4 && ids.every((id) => r.ps.some((p) => p[0] === id)); }, [a, b]), 'two of us and two islanders');
await ev(B, () => { const I = window.__game.ocean.games.round.inst; I.pick = 3; I.drawPicker(); });
ok(await until(A, (id) => window.__game.ocean.games.round?.ctx.state(id)?.pk === 3, b, 15000), 'A sees which crab B backed');
const cheer = () => { window.__cheer = setInterval(() => { const I = window.__game.ocean.games.round?.inst; if (I && I.raceT() > 0 && (I.raceT() % 0.6) < 0.1) I.cheer(); }, 40); };
await ev(A, cheer); await ev(B, cheer);
if (process.env.RT_TRACE) await ev(B, () => { const bg = window.__game.ocean.games; window.__trace = []; let last = ''; window.__tr = setInterval(() => { const r = bg.round; if (!r) return; const hs = bg.peerBg(r.host), m = bg.crew().find((x) => x.id === r.host); const k = `${r.host === bg.me ? 'ME' : 'them'} hs=${hs ? Object.keys(hs).join('+') : 'null'} crew=${m ? (m.fresh ? 'fresh' : 'stale') : 'absent'} n=${bg.crew().length}`; if (k !== last) { window.__trace.push(`${r.ctx.time().toFixed(1)}s ${k}`); last = k; } }, 100); });
await A.screenshot({ path: `${OUT}/crabs.png` });
ok(await until(A, () => !window.__game.ocean.games.round, null, 90000), 'A\'s race finishes');
ok(await until(B, () => !window.__game.ocean.games.round, null, 30000), 'B\'s race finishes');
const [ra, rb] = [await ev(A, () => window.__game.ocean.games.last), await ev(B, () => window.__game.ocean.games.last)];
ok(ra && rb && ra.id === rb.id && JSON.stringify(ra.res) === JSON.stringify(rb.res), 'both see the same podium');
if (!(ra && rb && JSON.stringify(ra.res) === JSON.stringify(rb.res))) console.log('  podiums:', JSON.stringify(ra), JSON.stringify(rb));
if (process.env.RT_TRACE) console.log('  B trace:', JSON.stringify(await ev(B, () => window.__trace)));
ok(await ev(B, () => (window.__game.ext.d.ocean.games?.crabs?.played || 0) === 1), 'B\'s game counts');
await ev(A, () => clearInterval(window.__cheer)); await ev(B, () => clearInterval(window.__cheer));
await A.screenshot({ path: `${OUT}/podium.png` });

// 7. home: A calls everyone home
await ev(A, () => window.__game.ocean.callHome());
ok(await until(A, () => !window.__game.ocean.charter && window.__game.player.pos.x < 100, null, 30000), 'A is back at the cove');
ok(await until(B, () => !window.__game.ocean.charter && window.__game.player.pos.x < 100, null, 30000), 'B is back at the cove too');
ok(await until(C, (id) => { const p = [...window.__game.net.peers.values()].find((q) => q.meta?.id === id); return p && !p.meta?.away && !!p.state; }, b, 30000), 'the lake sees B back');
ok(await ev(A, () => !window.__game.ocean.crewNet && window.__game.net.kind !== 'none'), 'A is back on the lake\'s net');

for (const e of errors) console.log(`  page error: ${e}`);
ok(errors.length === 0, 'no page errors');
await browser.close();
console.log(failed ? `charter: ${failed} FAILED` : 'charter: all passed');
process.exit(failed ? 1 : 0);
