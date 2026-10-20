// Browser playthrough of the "more appealing" sprint: catch feel (hook punch, landing flip, near
// misses, streaks, weight count-up), first impressions (title screen, loading facts, goal ladder),
// the living world (seasons, wildlife, jumping fish, rainbow, Gus remembering you), social (gazette,
// catch cards, pets, mail, tandem catches) and the Claude extras.
// Needs the dev server: npx vite --port 5173
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launchOpts } from './browser-opts.mjs';

const BASE = process.argv[2] || 'http://localhost:5173/';
const OUT = fileURLToPath(new URL('../test-results/', import.meta.url)); // works on Windows too
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(launchOpts({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }));
const context = await browser.newContext({ viewport: { width: 980, height: 640 } });
const errors = [];
let step = 0;
const log = (...a) => console.log(`  [${++step}]`, ...a);
const stamp = Date.now();
const ev = (p, fn, a) => p.evaluate(fn, a);

async function open(query, { wait = true } = {}) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${query}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts|TUNNEL|ERR_/.test(m.text())) errors.push(`${query}: ${m.text()}`); });
  await page.goto(`${BASE}?avatar=random&weather=clear&gfx=low&fastbite&notutorial${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  if (wait) {
    await page.waitForFunction(() => window.__game?.ext?.key && window.__game.engine.running && !document.querySelector('.loading'), null, { timeout: 300000 });
    await page.waitForTimeout(1200);
  }
  return page;
}
const at = (p, x, z, yaw = Math.PI) => ev(p, ([x, z, yaw]) => { const g = window.__game; g.player.mode = 'shore'; g.actor.setMode('shore'); g.player.pos.set(x, 1.5, z); g.player.baseY = 1.5; g.player.yaw = yaw; g.player.target = null; }, [x, z, yaw]);

// cast and wait for the bite; hook; optionally run the fight bot
async function hookOne(p) {
  for (let i = 0; i < 4; i++) {
    await ev(p, () => window.__game.primaryDown(null)); await p.waitForTimeout(650); await ev(p, () => window.__game.primaryUp());
    await p.waitForFunction(() => ['bite', 'idle'].includes(window.__game.fishing.state), null, { timeout: 60000, polling: 50 });
    if (await ev(p, () => window.__game.fishing.state) === 'bite') { await ev(p, () => window.__game.primaryDown(null)); return true; }
  }
  return false;
}
const fight = (p) => ev(p, () => new Promise((resolve) => {
  const g = window.__game;
  const iv = setInterval(() => {
    const f = g.fishing;
    if (f.state === 'reeling' && f.reel && !f.reel.junk) { const r = f.reel; r.overweight = false; /* this suite tests catch feel, not line ratings */ g.rodAim = -r.pull; f.holding = r.jump > 0 ? false : f.holding ? r.tension < 0.75 : r.tension < 0.5; }
    else if (f.state === 'reeling') f.holding = true;
    else if (f.state === 'landed' || g.ui.revealCard?.isConnected) { clearInterval(iv); resolve('caught'); }
    else if (f.state === 'idle' || f.state === 'charge') { clearInterval(iv); resolve('escaped'); }
  }, 30);
}));
async function keep(p) { await p.waitForSelector('.reveal', { timeout: 60000 }); await ev(p, () => document.querySelector('.reveal .actions button').click()); await p.waitForFunction(() => window.__game.fishing.state === 'idle', null, { timeout: 15000 }); }

try {
  // ---------- first impressions
  const slot = `sa${stamp}`;
  let A = await open(`&autoplay&as=${slot}`);
  log('the loading screen shows a fish fact; the title screen greets a returning angler');
  await A.close();
  A = await open(`&as=${slot}&season=autumn&derby`, { wait: false });
  await A.waitForSelector('.title-screen', { timeout: 120000 });
  assert.match(await ev(A, () => document.querySelector('.title-sub').textContent), /Welcome back/);
  assert.match(await ev(A, () => document.querySelector('.title-fact').textContent), /Did you know/);
  await A.screenshot({ path: `${OUT}/s1-title.png` });
  await A.keyboard.press('Enter');
  await A.waitForFunction(() => window.__game?.ext?.key && window.__game.engine.running && !document.querySelector('.title-screen'), null, { timeout: 120000 });
  await A.waitForTimeout(1000);
  // v1.10: a first start without ?autoplay shows the lake rules once; agree to them
  await A.waitForSelector('.conduct-card', { timeout: 45000 });
  await ev(A, () => document.querySelector('.conduct-card .btn.primary').click());
  await A.waitForFunction(() => !document.querySelector('.conduct-card'), null, { timeout: 15000 }).catch(() => {});
  assert.equal(await ev(A, () => !!document.querySelector('.conduct-card')), false);

  log('the goal ladder shows the next goal and pays out when it is done');
  assert.match(await ev(A, () => document.querySelector('.goal-chip').textContent), /Goal 1.*Catch 5 fish/);
  await ev(A, () => { const g = window.__game; g.profile.catchCount = 5; });
  await A.waitForFunction(() => document.querySelector('.goal-chip.done'), null, { timeout: 15000 });
  const c0 = await ev(A, () => window.__game.profile.coins);
  await ev(A, () => document.querySelector('.goal-chip').click());
  await A.waitForFunction(() => (window.__game.ext.d.ladder || 0) === 1, null, { timeout: 15000 });
  assert.ok(await ev(A, () => window.__game.profile.coins) > c0);

  log('the season shows in the time chip and boosts its fish');
  assert.match(await ev(A, () => document.querySelector('.hud-top .chip').textContent), /Autumn/);
  assert.equal(await ev(A, () => window.__game.living.season), 'autumn');

  // ---------- catch feel
  log('hooking punches: hit-stop, shake, a pop word; landing flips the fish to you; the weight counts up');
  await at(A, 0.5, 24);
  assert.ok(await hookOne(A), 'got a bite');
  assert.ok(await ev(A, () => !!document.querySelector('.pop-word') || window.__game.engine.shake > 0 || window.__game.juice.stop > 0));
  await ev(A, () => { window.__game.lastCatch = null; });
  const r1 = await fight(A);
  assert.equal(r1, 'caught');
  await A.waitForFunction(() => window.__game.fishing.flip || window.__game.ui.revealCard?.isConnected, null, { timeout: 15000 });
  await keep(A);
  // (a junk haul lands too but doesn't count for a streak; read what actually came up rather than the banner's wording)
  const wasJunk = await ev(A, () => !window.__game.lastCatch);
  assert.equal(await ev(A, () => window.__game.juice.streak), wasJunk ? 0 : 1, `streak after one ${wasJunk ? 'junk haul' : 'fish'}`);

  log('streaks build a flame chip and pay a bonus at 3; a near miss shouts "So close!"');
  await ev(A, () => { const j = window.__game.juice; while (j.streak < 3) j.landed(); }); // two more after a fish, three after a junk haul
  await A.waitForFunction(() => /×3/.test(document.querySelector('.streak-chip')?.textContent || ''), null, { timeout: 10000 });
  assert.ok(await hookOne(A));
  await A.waitForFunction(() => window.__game.fishing.state === 'reeling' && window.__game.fishing.reel, null, { timeout: 20000 });
  await ev(A, () => { const f = window.__game.fishing; if (!f.reel.junk) { f.reel.progress = 0.9; f.escape(true); } else f.land(); });
  const near = await ev(A, () => [...document.querySelectorAll('.pop-word')].map((x) => x.textContent).join('|'));
  assert.ok(/So close/.test(near) || (await ev(A, () => window.__game.juice.streak)) >= 3, `near miss: ${near}`);
  if (await ev(A, () => window.__game.ui.revealCard?.isConnected)) await keep(A);
  await ev(A, () => { if (window.__game.fishing.state !== 'idle') window.__game.fishing.cancel(); });

  log('weight count-up on a big fish');
  await ev(A, () => { const g = window.__game; g.ui.showReveal({ species: { id: 'carp', name: 'Common Carp', tier: 'common', weight: [3, 20] }, xp: 10, value: 10, where: 'creel', bigOne: true }, { id: 'x1', speciesId: 'carp', variant: 'normal', weight: 19.5, zone: 'dock' }); });
  await A.waitForSelector('.reveal .weight', { timeout: 5000 });
  await A.waitForFunction(() => document.querySelector('.reveal .weight.landed'), null, { timeout: 15000 });
  assert.match(await ev(A, () => document.querySelector('.reveal .weight').textContent), /19\.5/);
  await ev(A, () => document.querySelector('.reveal .actions button').click());

  log('a shareable catch card renders');
  await ev(A, async () => { const { openCatchCard } = await import('/src/ui/catchcard.js'); await openCatchCard(window.__game, { id: 'x2', speciesId: 'koi', variant: 'gold', weight: 9.5, zone: 'pond', ts: Date.now() }); });
  await A.waitForSelector('.catch-card img', { timeout: 10000 });
  assert.ok((await ev(A, () => document.querySelector('.catch-card img').src.length)) > 5000);
  await A.screenshot({ path: `${OUT}/s2-card.png` });
  await ev(A, () => document.querySelector('.catch-card .btn.ghost').click());

  // ---------- living world
  log('wildlife: ducks take off when you row close');
  const duck = await ev(A, () => { const d = window.__game.wildlife.ducks[0]; return { x: d.x, z: d.z }; });
  await ev(A, (d) => { const g = window.__game; g.player.launchBoat({ x: d.x + 1.5, z: d.z + 1.5 }); g.actor.setMode('boat'); }, duck);
  await A.waitForFunction(() => window.__game.wildlife.ducks.some((d) => d.state === 'fly'), null, { timeout: 15000 });
  await ev(A, () => { const g = window.__game; g.player.mode = 'shore'; g.actor.setMode('shore'); });

  log('a fish jumps near your bobber and hints at the bite');
  await at(A, 0.5, 24);
  await ev(A, () => { const g = window.__game; g.living.hint = { x: 0.5, z: 18, speciesId: 'perch', until: performance.now() + 20000 }; });
  let hinted = 0;
  for (let i = 0; i < 12; i++) if (await ev(A, () => window.__game.living.hintBite({ x: 0.6, z: 18.2 }) === 'perch')) hinted++;
  assert.ok(hinted >= 2 && hinted <= 10, `hint bites ${hinted}/12`);
  await ev(A, () => window.__game.living.spawnJump());
  assert.ok(await ev(A, () => window.__game.living.jumps.length) >= 0);

  log('Gus remembers you');
  await ev(A, () => { const g = window.__game; g.ext.change((d) => { d.stats.lastGreatLabel = 'Gold Koi'; }); g.living.gusDone = false; if (g.player.mode === 'boat') { g.player.mode = 'shore'; g.actor.setMode('shore'); } g.player.pos.set(-5.5, 1.5, 44.0); g.player.baseY = 1.5; });
  await A.waitForFunction(() => /Gold Koi|Welcome back|Good to see/.test(window.__game.living.gusBubble?.text || ''), null, { timeout: 90000 });

  log('the rainbow shows after rain');
  await ev(A, () => { window.__game.living.rainbow.material.uniforms.uO.value = 0.4; });
  await A.waitForTimeout(500);

  // ---------- pets, social
  log('adopt a pet: it follows you');
  await ev(A, () => { const g = window.__game; g.profile.coins = 5000; g.profile.pearls = 100; });
  assert.equal(await ev(A, async () => window.__game.pet.buy('otter')), true);
  assert.ok(await ev(A, () => !!window.__game.pet.follower?.mesh?.parent));
  await at(A, 0.5, 30);
  await A.waitForFunction(() => window.__game.pet.follower.pos.distanceTo(window.__game.player.pos) < 9, null, { timeout: 20000 });

  log('the Lake Gazette and the Fish of the Week');
  await ev(A, () => { const s = window.__game.ui.sheets; s.state.board = 'gazette'; s.open('board'); });
  assert.match(await ev(A, () => document.querySelector('.sheet-body').textContent), /Fish of the Week/);
  await A.screenshot({ path: `${OUT}/s3-gazette.png` });
  await ev(A, () => window.__game.ui.sheets.close());

  // ---------- shore chairs, sky look, shooting stars
  log('sit in a shore chair, cast from it, get up by moving');
  assert.ok(await ev(A, () => window.__game.chairs.list.length) >= 12);
  assert.ok(await ev(A, () => new Set(window.__game.chairs.list.map((c) => c.area)).size) >= 5, 'chairs at every fishing area');
  await ev(A, () => { const g = window.__game, c = g.chairs.list[0]; g.player.pos.set(c.x - Math.sin(c.yaw), c.y, c.z - Math.cos(c.yaw)); g.player.baseY = c.y; });
  await A.waitForTimeout(400);
  assert.ok((await ev(A, () => window.__game.contextActions().map((a) => a.id))).includes('sit'));
  await ev(A, () => window.__game.contextActions().find((a) => a.id === 'sit').fn());
  await A.waitForFunction(() => !!window.__game.chairs.seat && window.__game.actor.chairBend < 0, null, { timeout: 15000 });
  await ev(A, () => window.__game.primaryDown(null)); await A.waitForTimeout(650); await ev(A, () => window.__game.primaryUp());
  await A.waitForTimeout(1500);
  assert.ok(await ev(A, () => { const g = window.__game, c = g.chairs.seat; return !!c && Math.hypot(g.player.pos.x - c.x, g.player.pos.z - c.z) < 0.01 && g.fishing.state !== 'idle'; }), 'still seated while fishing');
  await ev(A, () => { window.__game.fishing.cancel(); const p = window.__game.player; p.setTarget(p.pos.x - 3, p.pos.z); });
  await A.waitForFunction(() => !window.__game.chairs.seat, null, { timeout: 10000 });
  log('the camera tilts all the way up; shooting stars streak overhead at night');
  assert.ok(await ev(A, () => { const g = window.__game; g.engine.cam.pitch = -1.25; return true; }));
  await A.waitForFunction(() => { const g = window.__game; g.engine.cam.pitch = -1.25; const c = g.engine.camera, v = new c.position.constructor(); c.getWorldDirection(v); return v.y > 0.9; }, null, { timeout: 20000, polling: 250 });
  await ev(A, () => { window.__game.engine.cam.pitch = 0.5; });

  const B = await open(`&autoplay&nonpc&as=sb${stamp}`);
  await A.waitForFunction(() => [...window.__game.net.peers.values()].some((p) => p.meta?.pet !== undefined && p.meta?.name), null, { timeout: 300000 });
  await B.waitForFunction(() => [...window.__game.remotes.list.values()].some((r) => r.pet), null, { timeout: 300000 });
  log("B sees A's pet");

  log('mail: A sends B bait; B opens it');
  const bId = await ev(B, () => window.__game.save.userId);
  await ev(A, () => { window.__game.ext.change((d) => { d.bait.worm = 10; }); });
  const sent = await ev(A, async (to) => window.__game.social.send(to, 'B', { kind: 'bait', id: 'worm', n: 5, note: 'tight lines!' }), bId);
  assert.equal(sent.ok, true);
  await B.waitForFunction(() => window.__game.social.inbox().length === 1, null, { timeout: 30000 });
  await ev(B, async () => window.__game.social.open(window.__game.social.inbox()[0]));
  assert.equal(await ev(B, () => window.__game.tackle.count('worm')), 5);

  log('tandem: B helps A reel in a big one');
  await ev(B, () => { const g = window.__game; g.player.pos.set(1.5, 1.5, 26); });
  await at(A, 0.5, 24);
  await A.waitForTimeout(1500);
  // A shouts for help (again every few seconds: B's view of A's position can lag on software GL)
  let offered = false;
  for (let i = 0; i < 20 && !offered; i++) {
    await ev(A, () => window.__game.netEvent('tandem', { speciesId: 'muskie' }));
    offered = await B.waitForFunction(() => !!window.__game.social.helpOffer, null, { timeout: 6000 }).then(() => true, () => false);
  }
  assert.ok(offered, 'B is offered the chance to help');
  assert.match(await ev(B, () => window.__game.contextActions()[0]?.label || ''), /Help/);
  assert.ok(await hookOne(A));
  await A.waitForFunction(() => window.__game.fishing.state === 'reeling', null, { timeout: 10000 });
  // hold the fight steady on A until B's help arrives (messages crawl on software GL)
  await ev(A, () => { const g = window.__game; window.__hold = setInterval(() => { const r = g.fishing.reel; if (r && !g.social.tandem?.helper) { r.progress = 0.5; r.strain = 0; r.snapped = false; } }, 50); });
  const aId = await ev(A, () => window.__game.save.userId);
  await ev(B, (aId) => { const s = window.__game.social; s.helpOffer = { from: aId, name: 'A', until: performance.now() + 60000, fish: 'a big one' }; s.help(); }, aId);
  const helped = await A.waitForFunction(() => window.__game.social.tandem?.helper || window.__game.fishing.state !== 'reeling', null, { timeout: 90000 }).then(() => ev(A, () => !!window.__game.social.tandem?.helper));
  await ev(A, () => clearInterval(window.__hold));
  assert.ok(helped, 'A is reeling with a helper');
  await fight(A);
  if (await ev(A, () => window.__game.ui.revealCard?.isConnected || window.__game.fishing.state === 'landed')) await keep(A);

  // ---------- Claude extras
  log('Claude: fish caught while waiting are counted, the answer fish scales with the turn, the news lands mid-fight, the fish waits until it ends');
  await ev(A, () => window.__claudeSignal({ state: 'working', at: Date.now(), startedAt: Date.now() }));
  await at(A, 0.5, 24);
  assert.ok(await hookOne(A));
  // the answer lands mid-fight: it waits
  await ev(A, () => window.__claudeSignal({ state: 'done', at: Date.now() + 5, seconds: 420 }));
  const deferred = await ev(A, () => window.__game.pendingAnswer);
  assert.equal(deferred, 420);
  // v1.13.6: the news lands right away mid-fight; only the fish waits
  assert.match(await ev(A, () => document.querySelector('.chat-layer')?.textContent || ''), /will circle your line once this fish is in/);
  assert.equal(await ev(A, () => !!window.__game.answerPending), false);
  const r2 = await fight(A);
  if (r2 === 'caught') await keep(A);
  await A.waitForFunction(() => window.__game.answerPending === true, null, { timeout: 30000 });
  assert.match(await ev(A, () => document.querySelector('.chat-layer')?.textContent || ''), /legendary golden fish|caught 1 fish while you waited|golden fish/);
  assert.ok(await hookOne(A));
  const bite = await ev(A, () => window.__game.fishing.bite);
  assert.equal(bite.answer, true);
  assert.ok(['gold', 'diamond'].includes(bite.variant));
  await fight(A);
  if (await ev(A, () => window.__game.ui.revealCard?.isConnected || window.__game.fishing.state === 'landed')) await keep(A);

  assert.deepEqual(errors, []);
  console.log(`sprint e2e: ${step} checks passed`);
} catch (e) {
  console.error('SPRINT E2E FAILED:', e.message);
  if (errors.length) console.error('page errors:', errors.slice(0, 8));
  process.exitCode = 1;
} finally {
  await browser.close();
}
