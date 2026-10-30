// Browser test for Skye's Air Races (v1.17): Skye's race board at the hangar (circuits, modes, classes, planes and
// paint, the locks), a full race against three rivals (the countdown and a perfect start, gates, laps and splits,
// boost rings, a crash and the respawn, a missed gate, the wrong way, the finish, the results, a medal, rewards and
// the board), a shortcut found, a time trial and its ghost, the paint shop, every circuit built and flown (nothing
// blocking the line, no errors, draw calls and triangles), and a party race between two players (the invite, the
// shared start, each other's planes, the rivals flown by the host, and both finishing).
// Needs the dev server: npx vite --port 5173
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launchOpts } from './browser-opts.mjs';

const BASE = process.argv[2] || 'http://localhost:5173/';
const OUT = fileURLToPath(new URL('../test-results/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(launchOpts({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] }));
const context = await browser.newContext({ viewport: { width: 980, height: 640 } });
const errors = [];
let step = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); console.log(`  [${++step}] ok`, msg); };
const ev = (p, fn, a) => p.evaluate(fn, a);
const stamp = Date.now();
const frames = (p, n = 2) => ev(p, (n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const until = (p, fn, arg, ms = 60000) => p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);

async function open(query) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${query}: ${e.message}`));
  page.on('console', (m) => { if ((m.type() === 'error' && !/fonts|TUNNEL|ERR_|Failed to load/.test(m.text())) || /\[air\] took out/.test(m.text())) errors.push(`${query}: ${m.text()}`); });
  await page.goto(`${BASE}?autoplay&avatar=random&gfx=low&notutorial&nonpc${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__game?.engine.running && window.__game.north?.air && !document.querySelector('.loading'), null, { timeout: 300000, polling: 500 });
  await ev(page, () => { const g = window.__game; g.tutorial?.skip?.(); g.profile.coins = 50000; if (g.profile.level < 25) g.profile.level = 25; });
  return page;
}
/** Run the race on (race time, fixed steps, no drawing) until fn() or the time's up. */
const sim = (p, sec, until2 = null) => ev(p, ([sec, src]) => { const R = window.__game.north.air.race, f = src ? new Function('R', `return (${src})(R)`) : null; for (let k = 0; k < sec * 30 && !(f && f(R)); k++) R.sim(1 / 30); return R.rt; }, [sec, until2 ? until2.toString() : null]);

const A = await open(`&as=airA${stamp}`);
console.log('Skye\'s race board');
ok(await ev(A, () => !window.__game.north.air.unlocked), 'the races are locked before your first flight north');
await ev(A, () => window.__game.north.talkSkye(false));
ok(!(await ev(A, () => [...document.querySelectorAll('.dlg-choice')].some((b) => /Air Races/.test(b.textContent)))), 'Skye doesn\'t offer them yet');
await ev(A, () => { window.__game.dialogue.close?.(); window.__game.ext.change((d) => { d.north.flights = 1; }); window.__game.north.talkSkye(false); });
ok(await until(A, () => [...document.querySelectorAll('.dlg-choice')].some((b) => /Air Races/.test(b.textContent)), null, 5000), 'after a flight north, Skye offers her air races');
await ev(A, () => [...document.querySelectorAll('.dlg-choice')].find((b) => /Air Races/.test(b.textContent)).click());
ok(await until(A, () => document.querySelectorAll('.air-panel .ap-c').length === 12, null, 5000), 'the board lists all twelve circuits');
ok(await ev(A, () => [...document.querySelectorAll('.air-panel .ap-circuits')].map((r) => r.children.length).join() === '4,4,4'), 'in three rows of four: easy, medium and hard');
const locks = await ev(A, () => [...document.querySelectorAll('.air-panel .ap-c')].map((b) => b.disabled));
ok(locks.filter((x) => !x).length === 4 && locks[locks.length - 1], `four tier-one (easy) circuits open, the rest (and the Gauntlet) locked (${locks.map((x) => (x ? 'L' : 'o')).join('')})`);
ok(await ev(A, () => [...document.querySelectorAll('.air-panel .ap-chip')].filter((b) => /Cub|Baron|Bluebolt/.test(b.textContent)).every((b) => b.disabled)), 'the medal planes are locked');
ok(await ev(A, () => [...document.querySelectorAll('.air-panel .ap-chip')].some((b) => /Gale/.test(b.textContent) && b.disabled)), 'Gale and Hurricane need a medal on the class below');
await A.screenshot({ path: `${OUT}air-board.png` });

console.log('A race: Flyway, Breeze, three rivals');
await ev(A, () => { [...document.querySelectorAll('.air-panel .ap-c')].find((b) => /Five Lakes/.test(b.textContent)).click(); });
await ev(A, () => [...document.querySelectorAll('.air-panel .btn.gold')].find((b) => /Race/.test(b.textContent)).click());
ok(await until(A, () => window.__game.north.air.race?.ready && window.__game.engine.overlay === window.__game.north.air.race, null, 120000), 'the race loads and takes over the view');
await ev(A, () => { window.__game.north.air.race.opts.start = Date.now() + 600000; }); // (hold the grid while we look round)
ok(await ev(A, () => window.__game.north.air.race.phase === 'grid'), 'on the grid, the countdown running');
ok(await ev(A, () => window.__game.north.air.race.racers.length === 4 && window.__game.north.air.race.racers.filter((r) => r.ai).length === 3), 'four on the grid: you and three rivals');
ok(await ev(A, () => window.__game.north.hidden && window.__game.north.control(0.016, 0)), 'your angler is hidden and the race has the controls');
await frames(A, 3);
await A.screenshot({ path: `${OUT}air-grid.png` });
ok(await ev(A, () => window.__game.north.air.race.blocked.length === 0), 'nothing blocks the course');
// the countdown, and boost right on GO
// (the frames are slow here, so press boost "a tenth of a second before GO" directly rather than racing the clock)
await ev(A, () => { const R = window.__game.north.air.race; R.opts.start = Date.now() + 1500; R.auto = true; R.boostPressT = -0.1; R.boosting = true; });
ok(await until(A, () => window.__game.north.air.race.phase === 'race', null, 20000), 'GO!');
await sim(A, 1);
ok(await ev(A, () => window.__game.north.air.race.me.perfect), 'a perfect start (boost on GO)');
await ev(A, () => { window.__game.north.air.race.boosting = false; });
await sim(A, 12, (R) => R.me.passed >= 3);
ok(await ev(A, () => window.__game.north.air.race.me.lap === 1 && window.__game.north.air.race.me.passed >= 3), 'through the start line and the first gates, in order');
// a boost ring
const ringT0 = await ev(A, () => window.__game.north.air.race.me.taken.size);
await sim(A, 40, (R) => R.me.taken.size > 0);
ok(await ev(A, () => window.__game.north.air.race.me.taken.size > 0), `a boost ring taken (${ringT0} before)`);
// a crash, and the respawn at the last gate
const pre = await ev(A, () => { const R = window.__game.north.air.race; return { next: R.me.next, passed: R.me.passed }; });
await ev(A, () => { const R = window.__game.north.air.race; R.crash(R.me, 'test'); });
ok(await ev(A, () => window.__game.north.air.race.me.crashT > 0 && /CRASH/.test(document.querySelector('.ar-banner').textContent)), 'a crash');
await sim(A, 2);
ok(await ev(A, ([n]) => { const R = window.__game.north.air.race, G = R.track.gates[(n - 1 + R.track.gates.length) % R.track.gates.length]; return R.me.crashT <= 0 && R.me.safeT > 0 && R.me.f.pos.distanceTo(G.p) < 80; }, [pre.next]), 'back in the air at the last gate, with a moment\'s grace');
// a missed gate (fly past one outside the ring): +2 s
const pen0 = await ev(A, () => window.__game.north.air.race.me.pen);
await ev(A, () => { const R = window.__game.north.air.race, me = R.me, G = R.track.gates[me.next], right = G.d.clone().cross({ x: 0, y: 1, z: 0 }).normalize(); const p = G.p.clone().addScaledVector(right, 40).addScaledVector(G.d, -2); me.f.prev.copy(p); me.f.pos.copy(p).addScaledVector(G.d, 4); R.gates(me); });
ok(await ev(A, (p0) => window.__game.north.air.race.me.pen === p0 + 2, pen0), 'missing a gate costs 2 seconds');
// the wrong way
await ev(A, () => { const R = window.__game.north.air.race; R.auto = false; R.me.f.yaw += Math.PI; R.me.safeT = 9; });
await sim(A, 1.6);
ok(await ev(A, () => window.__game.north.air.race.me.wrongT > 1.2 && /WRONG WAY/.test(document.querySelector('.ar-banner').textContent)), 'WRONG WAY when you turn round');
await ev(A, () => { const R = window.__game.north.air.race; R.auto = true; });
await frames(A, 2);
await A.screenshot({ path: `${OUT}air-race.png` });
const hud = await ev(A, () => ({ lap: document.querySelector('.ar-lap').textContent, pos: document.querySelector('.ar-pos').textContent, time: document.querySelector('.ar-time').textContent, rows: document.querySelectorAll('.ar-board div').length }));
ok(/LAP \d\/3/.test(hud.lap) && /\d(st|nd|rd|th)\/4/.test(hud.pos) && /\d:\d\d\.\d\d/.test(hud.time) && hud.rows === 4, `the HUD: ${hud.lap}, ${hud.pos}, ${hud.time}, standings`);
// the finish
await sim(A, 400, (R) => R.done);
ok(await ev(A, () => window.__game.north.air.race.done), 'everyone home: the race is over');
ok(await until(A, () => !!document.querySelector('.air-results'), null, 10000), 'the results');
const res = await ev(A, () => { const r = window.__game.north.air.race.result, d = window.__game.ext.d.air; return { place: r.place, time: r.time, laps: r.laps.length, splits: r.splits.length, rows: r.rows.length, races: d.races, best: d.best['flyway:breeze'], medal: d.medals['flyway:breeze'] || 0 }; });
ok(res.laps === 3 && res.rows === 4 && res.races === 1 && res.best?.time > 0 && res.best?.lap > 0 && res.best?.splits?.length >= 2, `3 laps, 4 racers, your best time, lap and splits kept (${JSON.stringify(res)})`);
ok(res.medal >= 1 || res.place === 4, `a medal for a good finish (${res.place}, medal ${res.medal})`);
await A.screenshot({ path: `${OUT}air-results.png` });
await A.waitForTimeout(1500);
ok(await ev(A, () => window.__game.profile.achievements.ar_first), 'First Wings');
ok(await ev(A, () => (window.__game.north.boards.docs || []).some((d) => d.board === 'air_flyway_breeze') || !!localStorage.getItem('rt_shared_fm_boards')), 'your time on the circuit\'s board');
await ev(A, () => [...document.querySelectorAll('.air-results .btn')].find((b) => /hangar/.test(b.textContent)).click());
ok(await until(A, () => !window.__game.north.air.race && !window.__game.engine.overlay && !window.__game.north.hidden, null, 5000), 'back at the hangar: the lake again, your angler back');

console.log('Shortcuts, Gale class');
await ev(A, () => window.__game.ext.change((d) => { d.air.medals['islands:breeze'] = 1; d.air.medals['flyway:breeze'] = 3; }));
await ev(A, () => { window.__game.north.air.start({ circuit: 'flyway', mode: 'race', cls: 'gale', plane: 'snowgoose', paint: 'factory' }, { auto: true, cuts: true }); });
ok(await until(A, () => window.__game.north.air.race?.ready, null, 120000), 'a Gale race');
await ev(A, () => { window.__game.north.air.race.opts.start = Date.now() - 50; });
await sim(A, 420, (R) => R.done);
const cut = await ev(A, () => ({ found: Object.keys(window.__game.ext.d.air.found || {}), ai: window.__game.north.air.race.racers.filter((r) => r.ai).map((r) => r.cuts) }));
ok(cut.found.includes('millrace'), `the mill race shortcut found and remembered (${cut.found})`);
ok(cut.ai.some((n) => n > 0), `rivals take shortcuts from Gale up (${cut.ai})`);
await ev(A, () => window.__game.north.air.leave());

console.log('Time trial and its ghost');
await ev(A, () => { window.__game.north.air.start({ circuit: 'firstflight', mode: 'trial', cls: 'breeze', plane: 'snowgoose', paint: 'factory' }, { auto: true }); });
ok(await until(A, () => window.__game.north.air.race?.ready, null, 120000), 'a time trial: no rivals');
ok(await ev(A, () => window.__game.north.air.race.racers.length === 1), 'just you');
await ev(A, () => { window.__game.north.air.race.opts.start = Date.now() - 50; });
await sim(A, 300, (R) => R.done);
ok(await ev(A, () => { const g = JSON.parse(localStorage.getItem('rt_air_ghost_firstflight_breeze') || 'null'); return g && g.s.length > 50 && g.lap > 0; }), 'your best lap kept as a ghost');
await ev(A, () => window.__game.north.air.leave());
await ev(A, () => { window.__game.north.air.start({ circuit: 'firstflight', mode: 'trial', cls: 'breeze', plane: 'snowgoose', paint: 'factory' }, { auto: true }); });
ok(await until(A, () => window.__game.north.air.race?.ready, null, 120000), 'another trial');
ok(await ev(A, () => window.__game.north.air.race.ghosts.length >= 1), 'with your ghost to race');
await ev(A, () => { window.__game.north.air.race.opts.start = Date.now() - 50; });
await sim(A, 20, (R) => R.me.lap >= 1 && R.rt > 8);
ok(await ev(A, () => window.__game.north.air.race.ghosts[0].model.group.visible), 'the ghost flies the lap with you');
await ev(A, () => window.__game.north.air.leave());

console.log('Paint shop and planes');
await ev(A, () => window.__game.north.air.paintShop());
ok(await until(A, () => document.querySelectorAll('.fm-shop-row').length >= 5, null, 5000), 'Skye\'s paint shop');
const coins0 = await ev(A, () => window.__game.profile.coins);
await ev(A, () => [...document.querySelectorAll('.fm-shop-row')].find((r) => /Sunset/.test(r.textContent)).querySelector('button').click());
ok(await until(A, () => !!window.__game.ext.d.air.paints?.sunset, null, 5000), 'Sunset paint bought');
ok(await ev(A, (c0) => window.__game.profile.coins === c0 - 400, coins0), 'for 400 coins');
await ev(A, () => document.querySelector('.fm-shop .btn.blue')?.click());
await ev(A, () => window.__game.ext.change((d) => { d.air.medals = { ...d.air.medals, 'a:breeze': 2, 'b:breeze': 1 }; }));
await ev(A, () => window.__game.north.air.open());
ok(await ev(A, () => { const b = [...document.querySelectorAll('.air-panel .ap-chip')].find((x) => /Yellow Cub/.test(x.textContent)); return b && !b.disabled; }), 'four medal points: the Yellow Cub');
ok(await ev(A, () => [...document.querySelectorAll('.air-panel .ap-chip')].some((x) => /Sunset/.test(x.textContent))), 'your Sunset paint on the board');
await ev(A, () => document.querySelector('.air-panel .close-x')?.click());

console.log('Every circuit: built, flown, nothing in the way');
const perf = [];
for (const id of ['firstflight', 'cloudcanyon', 'thermal', 'stormfront', 'aurora', 'skyharbour', 'flyway', 'fjords', 'taiga', 'islands', 'redrock', 'gauntlet']) {
  const t0 = Date.now();
  await ev(A, (id) => { window.__game.north.air.start({ circuit: id, mode: 'race', cls: 'hurricane', plane: 'racer', paint: 'midnight' }, { auto: true, cuts: true }); }, id);
  await until(A, () => window.__game.north.air.race?.ready, null, 120000);
  const build = Date.now() - t0;
  await ev(A, () => { window.__game.north.air.race.opts.start = Date.now() - 50; });
  await sim(A, 30);
  await frames(A, 3);
  const info = await ev(A, () => { const R = window.__game.north.air.race, i = window.__game.engine.renderer.info.render; return { blocked: R.blocked, calls: i.calls, tris: i.triangles, passed: R.racers.map((r) => r.passed), crashes: R.crashes || 0 }; });
  await A.screenshot({ path: `${OUT}air-${id}.png` });
  perf.push({ id, build, ...info });
  ok(info.blocked.length === 0 && info.passed.every((n) => n >= 3), `${id}: built in ${build} ms, nothing blocking, everyone racing (${info.passed}); ${info.calls} draw calls, ${Math.round(info.tris / 1000)}k triangles`);
  ok(info.calls < 450 && info.tris < 2500000, `${id}: within the draw budget`);
  await ev(A, () => window.__game.north.air.leave());
}
fs.writeFileSync(`${OUT}air-perf.json`, JSON.stringify(perf, null, 1));

console.log('Party race: two players');
const B = await open(`&as=airB${stamp}`);
await until(A, () => window.__game.party.peers().length >= 1, null, 60000);
const [ia, ib] = [await ev(A, () => window.__game.save.userId), await ev(B, () => window.__game.save.userId)];
await ev(B, () => window.__game.ext.change((d) => { d.north.flights = 1; }));
await ev(A, (id) => window.__game.party.invite(id), ib);
ok(await until(B, () => !!document.querySelector('.invite-card'), null, 30000), 'B gets the party invite');
await ev(B, () => document.querySelector('.invite-card .btn.green').click());
ok(await until(A, (id) => window.__game.party.has(id), ib, 30000), 'A and B are a party');
await ev(A, () => window.__game.north.air.open());
ok(await ev(A, () => [...document.querySelectorAll('.air-panel .btn.blue')].some((b) => /party/.test(b.textContent))), 'the leader can start a party race');
await ev(A, () => { [...document.querySelectorAll('.air-panel .ap-c')].find((b) => /First Flight/.test(b.textContent)).click(); });
await ev(A, () => [...document.querySelectorAll('.air-panel .btn.blue')].find((b) => /party/.test(b.textContent)).click());
ok(await until(B, () => [...document.querySelectorAll('.dlg-choice')].some((b) => /Race!/.test(b.textContent)), null, 30000), 'B is invited to the party race');
await ev(B, () => [...document.querySelectorAll('.dlg-choice')].find((b) => /Race!/.test(b.textContent)).click());
ok(await until(A, () => window.__game.north.air.race?.ready, null, 120000) && await until(B, () => window.__game.north.air.race?.ready, null, 120000), 'both on the grid');
const grid = await ev(A, () => window.__game.north.air.race.racers.map((r) => `${r.human ? 'H' : 'AI'}:${r.name}`));
ok(grid.length === 4 && grid.filter((x) => x.startsWith('H')).length === 2, `two players and two rivals (${grid})`);
const startA = await ev(A, () => window.__game.north.air.race.opts.start);
ok(await ev(B, (s) => window.__game.north.air.race.opts.start === s && !window.__game.north.air.race.opts.host, startA), 'B races to the host\'s clock, with the host\'s rivals');
// fly it for real (both pages, drawing): wait for GO, then a few seconds of racing on each
await ev(A, () => { window.__game.north.air.race.auto = true; }); await ev(B, () => { window.__game.north.air.race.auto = true; });
ok(await until(A, () => window.__game.north.air.race.phase === 'race', null, 60000) && await until(B, () => window.__game.north.air.race.phase === 'race', null, 60000), 'the flag drops for both');
await A.waitForTimeout(6000);
ok(await until(A, (id) => { const R = window.__game.north.air.race.racers.find((r) => r.id === id); return R && R.net.at > 0 && R.f.pos.distanceTo(window.__game.north.air.race.track.gates[0].p) < 600; }, ib, 30000), 'A sees B\'s plane flying');
ok(await until(B, () => window.__game.north.air.race.racers.filter((r) => r.ai).every((r) => r.aiAt > 0), null, 30000), 'B sees the host\'s rivals');
await A.screenshot({ path: `${OUT}air-party-A.png` }); await B.screenshot({ path: `${OUT}air-party-B.png` });
// finish: each runs its own race on to the end (B's last reported progress shows up on A's results)
await sim(B, 300, (R) => R.me.fin); await sim(A, 300, (R) => R.me.fin);
await B.waitForTimeout(1500); await A.waitForTimeout(500);
await sim(A, 20, (R) => R.done); await sim(B, 20, (R) => R.done);
ok(await until(A, () => !!window.__game.north.air.race?.done, null, 30000) && await until(B, () => !!window.__game.north.air.race?.done, null, 30000), 'both finish');
const pr = await ev(A, (id) => window.__game.north.air.race.result.rows.find((r) => r.id === id), ib);
ok(pr && pr.human, `B is on A's results (${JSON.stringify(pr)})`);
ok(await ev(A, () => window.__game.ext.d.air.party >= 1), 'a party race counted (Wingmates)');

console.log('errors:', errors.length ? errors.join('\n') : 'none');
ok(errors.length === 0, 'no errors');
await browser.close();
console.log(`\nair e2e: ${step} checks passed`);
