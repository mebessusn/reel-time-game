// Browser playthrough of the newer systems: tutorial, bait, away gear, quests and a local's request,
// the cabin (and visiting a friend's), derby scores shared between players, the community meter,
// player-written bottles, waystones, a controller, world events, settings and every new menu.
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
await context.addInitScript(() => {
  const pad = { id: 'Test Pad (STANDARD GAMEPAD)', connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  window.__pad = pad;
  navigator.getGamepads = () => [pad];
});
const errors = [];
let step = 0;
const log = (...a) => console.log(`  [${++step}]`, ...a);
const stamp = Date.now();

async function open(query) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${query}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts|TUNNEL|ERR_/.test(m.text())) errors.push(`${query}: ${m.text()}`); });
  await page.goto(`${BASE}?autoplay&avatar=random&weather=clear&gfx=low&fastbite&fastgear${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  // a second tab boots slowly in software GL while the first keeps rendering: give it room
  await page.waitForFunction(() => window.__game?.save?.profile && window.__game.engine.running && window.__game.ext?.key && !document.querySelector('.loading'), null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  return page;
}
const ev = (p, fn, a) => p.evaluate(fn, a);
const at = (p, x, z, yaw = Math.PI) => ev(p, ([x, z, yaw]) => { const g = window.__game; g.player.mode = 'shore'; g.player.pos.set(x, 1.5, z); g.player.baseY = 1.5; g.player.yaw = yaw; g.player.target = null; }, [x, z, yaw]);

async function catchOne(p) {
  await ev(p, () => window.__game.primaryDown(null)); await p.waitForTimeout(650); await ev(p, () => window.__game.primaryUp());
  await p.waitForFunction(() => ['bite', 'idle'].includes(window.__game.fishing.state), null, { timeout: 60000, polling: 50 });
  if (await ev(p, () => window.__game.fishing.state) === 'idle') return 'missed';
  await ev(p, () => window.__game.primaryDown(null));
  const res = await ev(p, () => new Promise((resolve) => {
    const g = window.__game;
    const iv = setInterval(() => {
      const f = g.fishing;
      if (f.state === 'reeling' && f.reel && !f.reel.junk) { const r = f.reel; g.rodAim = -r.pull; f.holding = r.jump > 0 ? false : f.holding ? r.tension < 0.75 : r.tension < 0.5; }
      else if (f.state === 'landed') { clearInterval(iv); resolve('caught'); }
      else if (f.state === 'idle' || f.state === 'charge') { clearInterval(iv); f.cancel(); resolve('escaped'); }
    }, 30);
  }));
  if (res === 'caught') {
    await p.waitForSelector('.reveal', { timeout: 60000 });
    await ev(p, () => document.querySelector('.reveal .actions button').click());
    await p.waitForFunction(() => window.__game.fishing.state === 'idle', null, { timeout: 15000 });
  }
  return res;
}

try {
  // ---------- Player A: a brand new angler
  const A = await open(`&derby&as=fa${stamp}`);
  log('tutorial greets a new angler');
  assert.ok(await ev(A, () => !!document.querySelector('.tutorial')));
  assert.match(await ev(A, () => document.querySelector('.tut-text').textContent), /Gus/);
  await at(A, 0.5, 30);
  await A.waitForFunction(() => document.querySelector('.tut-step')?.textContent.startsWith('2/'), null, { timeout: 30000 });
  await ev(A, () => document.querySelector('.tutorial .btn').click());
  assert.equal(await ev(A, () => window.__game.ext.d.tutorial.done), true);

  log('Gus sells bait, gear, upgrades and decor');
  await ev(A, () => { const g = window.__game; g.profile.coins = 20000; g.profile.pearls = 200; g.profile.xp = 200000; g.profile.level = 30; g.save.persist(); });
  await at(A, -5.5, 44.0);
  const buys = await ev(A, async () => { const g = window.__game; return [await g.tackle.buyBait('worm'), await g.tackle.buyBait('cricket'), await g.gear.buy('pot'), await g.tackle.upgrade('hold'), await g.tackle.upgrade('hull')]; });
  assert.deepEqual(buys, [true, true, true, true, true]);
  assert.equal(await ev(A, () => window.__game.profile.creelBonus), 5);
  assert.ok(await ev(A, () => window.__game.player.rowMult) > 1.1);

  log('every new menu opens');
  const sheets = await ev(A, () => {
    const g = window.__game, s = g.ui.sheets, out = {};
    const all = { shop: ['shopTab', ['bait', 'upgrade', 'gear', 'decor', 'box']], board: ['board', ['requests', 'lake', 'derby', 'leaders']], fishpedia: ['pediaTab', ['sets']], map: ['mapTab', ['travel']], journal: [null, [null]], settings: [null, [null]] };
    for (const [name, [key, vals]] of Object.entries(all)) for (const v of vals) { if (key) s.state[key] = v; s.close(); s.open(name); out[`${name}:${v}`] = s.current?.body.textContent.length || 0; }
    s.close();
    return out;
  });
  for (const [k, n] of Object.entries(sheets)) assert.ok(n > 40, `${k} rendered (${n})`);

  log('a crab pot fills on the clock and empties into the creel');
  await at(A, 0.5, 23.5);
  // v1.12.1: no pop-up prompt for traps any more; the pot waits in the backpack with a Place button
  assert.doesNotMatch(await ev(A, () => window.__game.contextActions().map((a) => a.label).join('|')), /Put out/);
  assert.ok(await ev(A, () => window.__game.ui.sheets.invItems('creel').some((it) => it.kind === 'gear' && it.gk === 'pot')));
  assert.ok(await ev(A, () => !!window.__game.gear.spotAhead()));
  await ev(A, () => window.__game.gear.place('pot'));
  await A.waitForFunction(() => /Empty Crab Pot/.test(window.__game.contextActions().map((a) => a.label).join('|')), null, { timeout: 60000 });
  const before = await ev(A, () => window.__game.profile.creel.length + window.__game.profile.catchCount);
  const potGot = await ev(A, async () => { const g = window.__game; return (await g.gear.collect(g.gear.near(6))).map((b) => b.kind || 'fish'); });
  assert.ok(potGot.length > 0, 'the pot gave something back');
  // a pot can bring up a little treasure (junk) instead of a fish; only fish land in the creel
  if (potGot.some((k) => k !== 'junk')) assert.ok(await ev(A, () => window.__game.profile.creel.length + window.__game.profile.catchCount) > before);
  await A.screenshot({ path: `${OUT}/f1-gear.png` });

  log('bait is used up per fish and the catch counts for the derby and the lake meter');
  await ev(A, () => window.__game.tackle.use('worm'));
  let res = 'missed';
  // (a junk haul lands too but isn't a fish, so keep going until a real fish is in)
  for (let i = 0; i < 6 && !(res === 'caught' && await ev(A, () => !!window.__game.lastCatch)); i++) res = await catchOne(A);
  assert.equal(res, 'caught');
  const worms = await ev(A, () => window.__game.tackle.count('worm'));
  assert.ok(worms <= 9 && worms >= 4, `worms used up per fish (${worms})`);
  assert.equal(await ev(A, () => window.__game.lastCatch.bait), 'worm');
  assert.ok(await ev(A, () => window.__game.derby.best) > 0);
  // the rod catch, plus whatever the pot brought up that wasn't junk (junk never counts for the lake meter)
  assert.ok(await ev(A, () => window.__game.community.total) >= 1 + Math.min(1, potGot.filter((k) => k !== 'junk').length));

  log('creel: lock a fish and Sell all leaves it alone');
  const keepId = await ev(A, () => { const g = window.__game; const c = g.profile.creel[0]; g.ext.change((d) => { d.locked = [c.id]; }); g.traits.setName(c, 'Lucky'); return c.id; });
  await ev(A, () => { const s = window.__game.ui.sheets; s.state.creelTab = 'creel'; s.open('creel'); });
  await ev(A, () => [...document.querySelectorAll('.creel-tools button')][0].click());
  await A.waitForTimeout(500);
  assert.deepEqual(await ev(A, () => window.__game.profile.creel.map((c) => c.id)), [keepId]);
  assert.ok(await ev(A, () => !!document.querySelector('.sheet .inv-slot.locked[aria-label*="Lucky"]')), 'the locked, named fish stays in its backpack slot');
  await ev(A, () => window.__game.ui.sheets.close());

  log("a local's request: bring the fish, get paid");
  const req = await ev(A, () => { const g = window.__game; g.quests.refresh(); return g.ext.d.quests.npc; });
  assert.ok(req && req.speciesId);
  const paid = await ev(A, async (req) => {
    const g = window.__game;
    const npc = g.npcs.list.find((n) => n.id === req.id);
    g.profile.creel.push({ id: `gift${Date.now()}`, speciesId: req.speciesId, variant: 'normal', weight: 1, zone: 'dock', ts: Date.now() });
    g.player.pos.set(npc.pos.x + 1, npc.pos.y, npc.pos.z); npc.target = null; npc.wait = 99;
    // v1.9.3: talking opens a little dialogue: accept the request, then talk again to hand the fish over
    const talk = () => g.contextActions().find((a) => a.label.startsWith('Talk to'));
    if (!talk()) return `no talk action: ${g.contextActions().map((a) => a.label).join('|')}`;
    talk().fn();
    if (!g.dialogue.active) return 'no dialogue';
    g.dialogue.close(g.dialogue.active.choices[0]); // "Sure, I'll find one!"
    if (!g.ext.d.quests.npc.accepted) return 'not accepted';
    const coins = g.profile.coins;
    talk().fn();
    const give = g.dialogue.active?.choices[0];
    if (!give?.label.startsWith('Give')) return `no give choice: ${give?.label}`;
    g.dialogue.close(give);
    for (let i = 0; i < 50 && g.profile.coins === coins; i++) await new Promise((r) => setTimeout(r, 100));
    return g.profile.coins - coins;
  }, req);
  assert.equal(paid, req.reward.coins);

  log('quests and the story pay out once');
  await ev(A, () => { const g = window.__game; g.ext.change((d) => { d.quests.list[0].have = d.quests.list[0].n; d.quests.list[0].done = true; d.story.ready = true; }); });
  const c0 = await ev(A, () => window.__game.profile.coins);
  await ev(A, async () => { const g = window.__game; await g.quests.claim(g.ext.d.quests.list[0].id); await g.quests.claim(g.ext.d.quests.list[0].id); await g.quests.claimStory(); });
  const gained = (await ev(A, () => window.__game.profile.coins)) - c0;
  assert.ok(gained > 0 && gained < 1000, `quest + story coins ${gained}`);
  assert.equal(await ev(A, () => window.__game.ext.d.story.step), 1);

  log('your cabin: decor and an aquarium, shared in your presence');
  await ev(A, async () => { const g = window.__game; g.home.open(); for (const id of ['rug', 'lamp', 'plant', 'armchair']) await g.home.buyDecor(id); g.ext.change((d) => { d.home.tank = g.profile.creel.slice(0, 1).map((c) => ({ id: c.id, speciesId: c.speciesId, variant: c.variant, weight: c.weight })); }); g.home.rebuild(); });
  await A.waitForTimeout(1500);
  assert.ok(await ev(A, () => window.__game.engine.overlay === window.__game.home.scene));
  assert.equal(await ev(A, () => window.__game.home.scene.fish.length), 1);
  await A.screenshot({ path: `${OUT}/f2-cabin.png` });
  await ev(A, () => window.__game.home.close());
  assert.equal(await ev(A, () => window.__game.meta().home.d.length), 4);

  log('a bottle goes out, and bad ones are refused');
  assert.match(await ev(A, async () => (await window.__game.bottles.write('find me at www.spam.com')).error), /links/);
  assert.equal(await ev(A, async () => (await window.__game.bottles.write('The fish here are friendly. Have a lovely day!')).ok), true);
  assert.match(await ev(A, async () => (await window.__game.bottles.write('a second one today')).error), /tomorrow/);

  // ---------- Player B in another tab: shared lake
  const B = await open(`&derby&nonpc&notutorial&as=fb${stamp}`);
  await B.waitForFunction(() => [...window.__game.net.peers.values()].some((p) => p.meta?.home), null, { timeout: 120000 });

  log("B finds A's bottle");
  const found = await ev(B, () => window.__game.bottles.find());
  assert.equal(found?.text, 'The fish here are friendly. Have a lovely day!');
  await ev(B, (b) => window.__game.bottles.report(b), found);

  log("B visits A's cabin");
  await ev(B, () => { const g = window.__game; const p = [...g.net.peers.values()].find((x) => x.meta?.home); g.home.open({ id: p.id, name: p.meta.name, layout: p.meta.home }); });
  await B.waitForTimeout(1500);
  assert.equal(await ev(B, () => window.__game.home.scene.layout.d.length), 4);
  await B.screenshot({ path: `${OUT}/f3-visit.png` });
  await ev(B, () => window.__game.home.close());

  log('derby standings include both players; the lake meter is shared');
  await ev(B, () => { const g = window.__game; g.profile.catchCount = 5; g.player.pos.set(0.5, 1.5, 23.5); g.player.yaw = Math.PI; });
  res = 'missed';
  for (let i = 0; i < 4 && res !== 'caught'; i++) res = await catchOne(B);
  assert.equal(res, 'caught');
  // today's derby may be for one species, so log a matching catch for both players (the bot's catch is random)
  for (const [P, w] of [[A, 2.4], [B, 3.1]]) await ev(P, (wt) => { const d = window.__game.derby; if (!d.myEntry() && d.current) d.onCatch({ speciesId: d.current.speciesId || 'bluegill', weight: wt }); }, w);
  await ev(B, () => window.__game.pushMeta());
  await A.waitForFunction(() => window.__game.derby.board().length >= 2, null, { timeout: 60000 });
  // the shared lake meter syncs between players on its own schedule: wait for it rather than read it once
  // (shared = B's meter counts more than B's own catches; how many A logged earlier depends on luck, e.g. junk in the pot)
  await B.waitForFunction(() => { const c = window.__game.community; return c.total > c.mine; }, null, { timeout: 30000 }).catch(() => {});
  { const m = await ev(B, () => ({ total: window.__game.community.total, mine: window.__game.community.mine })); assert.ok(m.total > m.mine, `lake meter on B is shared (counts catches B didn't make): ${JSON.stringify(m)}`); }

  log('waystones light up and fast travel works');
  await at(A, -40, -30);
  await ev(A, () => { const g = window.__game; const w = g.waystones.meshes.get('frost').position; g.player.pos.set(w.x + 2, w.y, w.z); });
  await A.waitForFunction(() => window.__game.ext.d.waystones.includes('frost'), null, { timeout: 30000 });
  await ev(A, () => window.__game.waystones.travel('cove'));
  await A.waitForTimeout(1200);
  assert.ok(await ev(A, () => Math.hypot(window.__game.player.pos.x - 6.5, window.__game.player.pos.z - 47.5) < 4));

  log('a controller moves you and casts');
  await A.bringToFront();
  await at(A, 0.5, 38);
  await ev(A, () => { window.__game.engine.cam.yaw = 0; });
  const p0 = await ev(A, () => ({ x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
  await ev(A, () => { window.__pad.axes[1] = -1; });
  await A.waitForFunction((p0) => Math.hypot(window.__game.player.pos.x - p0.x, window.__game.player.pos.z - p0.z) > 0.5, p0, { timeout: 20000 });
  await ev(A, () => { window.__pad.axes[1] = 0; });
  await at(A, 0.5, 23.5);
  await ev(A, () => { window.__pad.buttons[0].pressed = true; });
  await A.waitForFunction(() => window.__game.fishing.state === 'charge', null, { timeout: 20000 });
  await A.waitForTimeout(700);
  await ev(A, () => { window.__pad.buttons[0].pressed = false; });
  await A.waitForFunction(() => ['flying', 'waiting', 'nibble', 'bite'].includes(window.__game.fishing.state), null, { timeout: 20000 });
  // B reels the line back in
  await ev(A, () => { window.__pad.buttons[1].pressed = true; });
  await A.waitForFunction(() => window.__game.fishing.state === 'idle' || window.__game.fishing.state === 'flying', null, { timeout: 20000 });
  await ev(A, () => { window.__pad.buttons[1].pressed = false; });

  log('settings: key rebinding, interface size, colour-blind markers, captions');
  await ev(A, () => window.__game.saveSettings({ uiScale: 1.2, colorBlind: true, captions: true }));
  assert.equal(await ev(A, () => document.body.classList.contains('cb')), true);
  await ev(A, () => window.__game.audio.onSound('bell'));
  assert.match(await ev(A, () => document.querySelector('.captions').textContent), /bell/i);
  await ev(A, () => window.__game.keymap.bind('creel', 'n'));
  await A.keyboard.press('n');
  await A.waitForTimeout(400);
  assert.equal(await ev(A, () => window.__game.ui.sheets.current?.name), 'creel');
  await A.keyboard.press('Escape');

  log('world events: a fog night lights the ruins');
  await B.close(); await A.close(); // three software-GL pages at once is too slow to load reliably
  const E = await open(`&event=fog&t=0.95&nonpc&notutorial&as=fe${stamp}`);
  assert.equal(await ev(E, () => window.__game.events.current), 'fog');
  await E.waitForTimeout(3000);
  assert.ok(await ev(E, () => window.__game.events.glow.intensity) > 0.5);
  await E.screenshot({ path: `${OUT}/f4-fog.png` });

  assert.deepEqual(errors, []);
  console.log(`features e2e: ${step} checks passed`);
} catch (e) {
  console.error('FEATURES E2E FAILED:', e.message);
  if (errors.length) console.error('page errors:', errors.slice(0, 8));
  process.exitCode = 1;
} finally {
  await browser.close();
}
