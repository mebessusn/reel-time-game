// End-to-end playthrough in headless Chromium against the dev server (npm run dev).
// Plays real catches with a reeling bot, opens every menu, and checks two clients share a lake.
// Usage: node tests/e2e.test.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launchOpts } from './browser-opts.mjs';

const BASE = process.argv[2] || 'http://localhost:5173/';
const OUT = process.argv[3] || '/tmp/e2e';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(launchOpts({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }));
const context = await browser.newContext({ viewport: { width: 420, height: 640 } });
const errors = [];
let step = 0;
const log = (...a) => console.log(`  [${++step}]`, ...a);

async function openPage(query) {
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL') && !m.text().includes('fonts.g')) errors.push(`${query}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${query} pageerror: ${e.message}`));
  await page.goto(`${BASE}${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__game?.save?.profile && window.__game.engine.running && !document.querySelector('.loading'), null, { timeout: 300000 });
  await page.waitForTimeout(800);
  return page;
}

// One full catch using the reeling bot. Returns 'caught' | 'escaped' | 'junk' | 'missed'.
async function catchOne(page, { keep = 'keep' } = {}) {
  await page.evaluate(() => { window.__game.primaryDown(null); });
  await page.waitForTimeout(650);
  await page.evaluate(() => window.__game.primaryUp());
  await page.waitForFunction(() => ['bite', 'idle'].includes(window.__game.fishing.state) && window.__game.fishing.state !== 'flying', null, { timeout: 40000, polling: 50 });
  const st = await page.evaluate(() => window.__game.fishing.state);
  if (st === 'idle') return 'missed';
  await page.evaluate(() => window.__game.primaryDown(null)); // hook
  // Bot: plays Tug & Turn.
  const result = await page.evaluate(() => new Promise((resolve) => {
    const g = window.__game;
    const t0 = performance.now();
    const iv = setInterval(() => {
      const f = g.fishing;
      if (performance.now() - t0 > 90000) { clearInterval(iv); resolve('stuck:' + f.state + ':' + JSON.stringify(f.reel ? { t: f.reel.tension, p: f.reel.progress, j: f.reel.junk } : null)); try { f.cancel(); } catch {} return; }
      if (f.state === 'reeling' && f.reel && !f.reel.junk) {
        const r = f.reel; // Tug & Turn bot: angle against the pull, reel while tension is comfortable, let go on leaps
        g.rodAim = -r.pull;
        f.holding = r.jump > 0 ? false : f.holding ? r.tension < 0.75 : r.tension < 0.5;
      } else if (f.state === 'landed') { clearInterval(iv); resolve('caught'); }
      else if (f.state === 'idle' || f.state === 'charge') { clearInterval(iv); f.cancel(); resolve('escaped'); }
    }, 30);
  }));
  if (result !== 'caught') return result;
  await page.waitForSelector('.reveal', { timeout: 60000 });
  await page.evaluate(() => document.querySelectorAll('.treasure-card').forEach((e) => e.remove())); // a treasure map from an earlier catch
  const isJunk = await page.evaluate(() => !document.querySelector('.reveal .stats span') || document.querySelector('.reveal .banner').textContent.match(/Junk|Treasure|message/i));
  const btns = await page.$$('.reveal .actions button');
  let target = btns[0];
  for (const b of btns) {
    const t = (await b.textContent()).toLowerCase();
    if (keep === 'sell' && t.startsWith('sell')) target = b;
    if (keep === 'release' && t.startsWith('release')) target = b;
  }
  await target.click();
  await page.waitForFunction(() => window.__game.fishing.state === 'idle', null, { timeout: 10000 });
  return isJunk ? 'junk' : 'caught';
}

try {
  // ---------- Player one ----------
  const p1 = await openPage('?autoplay&as=e2e_a&avatar=random&t=0.42&weather=clear&gfx=low&fastbite');
  await p1.screenshot({ path: `${OUT}/01-hud.png` });
  let prof = await p1.evaluate(() => ({ lvl: window.__game.profile.level, coins: window.__game.profile.coins, n: window.__game.profile.catchCount }));
  assert.equal(prof.n, 0);
  log('game loaded; HUD visible');

  // First catch: guaranteed bluegill, screenshot reveal (retry if the bot fumbles at low test fps)
  for (let attempt = 0; attempt < 4; attempt++) {
  await p1.evaluate(() => { window.__game.primaryDown(null); });
  await p1.waitForTimeout(500);
  await p1.screenshot({ path: `${OUT}/02-charging.png` });
  await p1.evaluate(() => window.__game.primaryUp());
  await p1.waitForFunction(() => window.__game.fishing.state === 'waiting', null, { timeout: 10000 });
  await p1.waitForTimeout(300);
  await p1.screenshot({ path: `${OUT}/03-waiting.png` });
  await p1.waitForFunction(() => window.__game.fishing.state === 'bite', null, { timeout: 15000, polling: 50 });
  await p1.evaluate(() => window.__game.primaryDown(null));
  if (attempt === 0) await p1.screenshot({ path: `${OUT}/04-hooked.png` });
  await p1.waitForTimeout(400);
  await p1.screenshot({ path: `${OUT}/05-reeling.png` });
  const r1 = await p1.evaluate(() => new Promise((resolve) => {
    const g = window.__game;
    const iv = setInterval(() => {
      const f = g.fishing;
      if (f.state === 'reeling' && f.reel && !f.reel.junk) { const r = f.reel; g.rodAim = -r.pull; f.holding = r.jump > 0 ? false : f.holding ? r.tension < 0.75 : r.tension < 0.5; }
      else if (f.state === 'landed') { clearInterval(iv); resolve('caught'); }
      else if (f.state === 'idle' || f.state === 'charge') { clearInterval(iv); f.cancel(); resolve('escaped'); }
    }, 30);
  }));
  if (r1 === 'caught') break;
  log(`first catch attempt ${attempt + 1} escaped at low fps; retrying`);
  await p1.waitForTimeout(500);
  }
  await p1.waitForSelector('.reveal', { timeout: 60000 });
  await p1.waitForTimeout(700);
  await p1.screenshot({ path: `${OUT}/06-reveal.png` });
  const revealName = await p1.textContent('.reveal h3');
  assert.match(revealName, /Bluegill/);
  await p1.click('.reveal .actions button.green');
  await p1.waitForTimeout(800);
  prof = await p1.evaluate(() => { const p = window.__game.profile; return { n: p.catchCount, creel: p.creel.length, coins: p.coins, ach: Object.keys(p.achievements), pedia: Object.keys(p.fishpedia) }; });
  assert.equal(prof.n, 1); assert.equal(prof.creel, 1); assert.ok(prof.ach.includes('first_bite')); assert.ok(prof.coins >= 75);
  log(`first catch: ${revealName}; creel ${prof.creel}, coins ${prof.coins}, achievements ${prof.ach}`);
  await p1.screenshot({ path: `${OUT}/07-after-first.png` });

  // A run of catches with the bot
  const results = {};
  for (let i = 0; i < 8; i++) {
    const r = await catchOne(p1, { keep: i % 3 === 0 ? 'sell' : 'keep' });
    if (String(r).startsWith('stuck')) log('bot stuck: ' + r);
    results[r] = (results[r] || 0) + 1;
  }
  prof = await p1.evaluate(() => { const p = window.__game.profile; return { n: p.catchCount, lvl: p.level, coins: p.coins, creel: p.creel.length }; });
  log(`8 more casts: ${JSON.stringify(results)}; catches ${prof.n}, level ${prof.lvl}, coins ${prof.coins}`);
  assert.ok((results.caught || 0) + (results.junk || 0) >= 5, 'bot should land most fish');

  // Audio: unlock with a real click, play every sound id, make sure nothing throws
  await p1.mouse.click(60, 300);
  const audio = await p1.evaluate(async () => {
    const a = window.__game.audio;
    a.unlock();
    for (const id of ['charge', 'whoosh', 'plop', 'plip', 'bite', 'hook', 'reelin', 'flop', 'miss', 'coin', 'purchase', 'click', 'page', 'open', 'close', 'row', 'achievement', 'levelup', 'diamond', 'remoteGreat', 'bell', 'thunder', 'clap', 'whistle', 'yawn', 'cheer', 'splashRemote']) a.sfx(id);
    a.sfx('reveal', { tier: 'legendary', variant: 'diamond' });
    a.reelLoop(true, 1); a.reelLoop(false);
    await new Promise((r) => setTimeout(r, 2500));
    return { state: a.ctx?.state, track: a.trackName || null };
  });
  assert.equal(audio.state, 'running');
  log(`audio running; music track: ${audio.track}`);

  // Every menu
  for (const [key, name] of [['c', 'creel'], ['f', 'fishpedia'], ['b', 'board'], ['j', 'journal']]) {
    await p1.keyboard.press(key);
    await p1.waitForSelector('.sheet');
    await p1.waitForTimeout(600);
    await p1.screenshot({ path: `${OUT}/08-${name}.png` });
    const title = await p1.textContent('.sheet h2');
    await p1.keyboard.press('Escape');
    await p1.waitForTimeout(250);
    log(`opened ${name}: "${title}"`);
  }
  // Shop: walk to the cabin, then buy a rod if affordable
  await p1.evaluate(() => { const g = window.__game; g.player.pos.set(-5.5, 2, 44.0); });
  await p1.waitForTimeout(400);
  const acts = await p1.evaluate(() => window.__game.contextActions().map((a) => a.id));
  assert.ok(acts.includes('shop'), 'shop action near cabin');
  await p1.evaluate(() => { window.__game.save.profile.coins += 200; });
  await p1.evaluate(() => window.__game.ui.sheets.open('shop'));
  await p1.waitForTimeout(800);
  await p1.screenshot({ path: `${OUT}/09-shop.png` });
  const bought = await p1.evaluate(async () => (await window.__game.buy('rod_birch'))?.ok);
  assert.equal(bought, true);
  const eq = await p1.evaluate(() => window.__game.profile.equipped.rod);
  assert.equal(eq, 'rod_birch');
  log('shop: bought and equipped Birch Classic');
  await p1.keyboard.press('Escape');
  await p1.evaluate(() => window.__game.ui.sheets.open('settings'));
  await p1.waitForTimeout(400);
  await p1.screenshot({ path: `${OUT}/10-settings.png` });
  await p1.keyboard.press('Escape');

  // Boat: level up quickly, launch from the rack
  await p1.evaluate(() => { const g = window.__game; g.save.profile.xp = 400; g.save.profile.level = 3; g.player.pos.set(0.5, 1.5, 30); });
  await p1.waitForTimeout(300);
  const acts2 = await p1.evaluate(() => window.__game.contextActions().map((a) => a.id));
  assert.ok(acts2.includes('launch'), 'launch action on the dock');
  await p1.evaluate(() => window.__game.launchBoat());
  await p1.evaluate(() => window.__game.player.setTarget(4.5, 14));
  await p1.waitForTimeout(3500);
  await p1.screenshot({ path: `${OUT}/11-boat.png` });
  const bpos = await p1.evaluate(() => ({ mode: window.__game.player.mode, z: window.__game.player.pos.z }));
  assert.equal(bpos.mode, 'boat'); assert.ok(bpos.z < 26, `boat should row north, z=${bpos.z}`);
  log(`boat launched and rowed to z=${bpos.z.toFixed(1)}`);
  const rb = await catchOne(p1);
  log(`catch from the boat: ${rb}`);

  // ---------- Player two (same browser => shared BroadcastChannel lake) ----------
  const p2 = await openPage('?autoplay&as=e2e_b&avatar=random&t=0.42&weather=clear&gfx=low&fastbite');
  await p2.waitForTimeout(1500);
  // software GL can stall a fresh page for several seconds while shaders compile, and a silent peer is
  // swept after 9 s, so poll until each side has seen the other rather than reading once
  const sees = (p) => p.waitForFunction(() => window.__game.remotes.count() === 1, null, { timeout: 45000, polling: 250 }).then(() => 1).catch(() => p.evaluate(() => window.__game.remotes.count()));
  const [peers1, peers2] = await Promise.all([sees(p1), sees(p2)]);
  assert.equal(peers1, 1, 'p1 sees p2'); assert.equal(peers2, 1, 'p2 sees p1');
  log('two clients see each other');
  // p2 walks onto the dock and waves; p1 should get the emote
  await p2.evaluate(() => window.__game.emote('wave'));
  await p2.waitForTimeout(600);
  await p2.screenshot({ path: `${OUT}/12-multiplayer-p2.png` });
  // p1 rows back near the dock so they're close
  await p1.evaluate(() => { const g = window.__game; g.player.pos.set(3.5, 0.85, 27); });
  await p1.waitForTimeout(1500);
  await p2.evaluate(() => { window.__game.engine.cam.yaw = 0.5; });
  await p2.waitForTimeout(800);
  await p2.screenshot({ path: `${OUT}/13-multiplayer-near.png` });
  // Great catch on p2 shows in p1's feed
  await p2.evaluate(() => window.__game.save.postFeed('catch', { speciesId: 'koi', variant: 'diamond', weight: 9.2, zone: 'shallows' }));
  await p1.waitForTimeout(800);
  const feedText = await p1.evaluate(() => [...document.querySelectorAll('.feed-item')].map((e) => e.textContent).join(' | '));
  assert.match(feedText, /Diamond Koi/);
  log(`feed on p1: ${feedText.slice(0, 120)}`);
  await p1.screenshot({ path: `${OUT}/14-feed.png` });

  // Night + rain look (fresh page after closing the others; swiftshader struggles with many WebGL pages)
  await p1.close(); await p2.close();
  const p3 = await openPage('?autoplay&as=e2e_c&avatar=random&t=0.92&weather=rain&gfx=low');
  await p3.waitForTimeout(1500);
  await p3.screenshot({ path: `${OUT}/15-night-rain.png` });
  log('night/rain scene rendered');

  assert.deepEqual(errors, [], `console errors:\n${errors.join('\n')}`);
  console.log(`e2e: all ${step} steps passed. Screenshots in ${OUT}`);
} catch (e) {
  console.error('E2E FAILED:', e.message);
  for (const [i, pg] of context.pages().entries()) { try { await pg.screenshot({ path: `${OUT}/fail-${i}.png`, timeout: 20000 }); console.error('fail state', i, await pg.evaluate(() => ({ st: window.__game?.fishing?.state, reveal: !!document.querySelector('.reveal'), modal: [...document.querySelectorAll('.modal, .overlay, .reveal')].map((n) => n.className) })).catch(() => '?')); } catch {} }
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
