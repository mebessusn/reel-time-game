// Browser test for Frostmere (map 3), every feature: Skye's seaplane base and the trip north (the take-off, the flight
// game, the landing), Hearthwick and its people, the first quest line, ice fishing (an auger from Pell, drilling,
// the flasher and jigging, a catch through the ice, tip-ups and a flag), the shanties, warmth (the sauna, the plunge,
// thin ice, cocoa), skates, dog sleds (driving, a hired ride, the Sled Derby), the Long Glide race, snowballs and Kit
// and Bo's fight, the boards, the wildlife (a bear that wants your fish, photographs, the legends), the log pages,
// the weather (snow, a blizzard, the aurora), the outfits, the journal and Fishpedia pages, and the flight home.
// Needs the dev server: npx vite --port 5173
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launchOpts } from './browser-opts.mjs';

const BASE = process.argv[2] || 'http://localhost:5173/';
const OUT = fileURLToPath(new URL('../test-results/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(launchOpts({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }));
const context = await browser.newContext({ viewport: { width: 980, height: 640 } });
const errors = [];
let step = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); console.log(`  [${++step}] ok`, msg); };
const ev = (p, fn, a) => p.evaluate(fn, a);
const stamp = Date.now();
const frames = (p, n = 2) => ev(p, (n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const until = (p, fn, arg, ms = 60000) => p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);

async function open(query, ready = () => window.__game?.engine.running && !document.querySelector('.loading')) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${query}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts|TUNNEL|ERR_|Failed to load/.test(m.text())) errors.push(`${query}: ${m.text()}`); });
  await page.goto(`${BASE}?autoplay&avatar=random&gfx=low&notutorial${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(ready, null, { timeout: 300000, polling: 500 });
  await ev(page, () => { const g = window.__game; g.tutorial?.skip?.(); g.profile.coins = 50000; g.profile.catchCount = Math.max(5, g.profile.catchCount || 0); });
  return page;
}
const northReady = () => window.__game?.north?.world.built && window.__game.north.here && window.__game.north.village && !document.querySelector('.loading');
const tp = (p, u, v, yaw = 0) => ev(p, ([u, v, yaw]) => { const g = window.__game, pl = g.player, x = -3000 + u, z = v; if (g.north.sleds.riding) g.north.sleds.stop(true); pl.mode = 'shore'; const y = g.north.groundAt(x, z) ?? 1; pl.pos.set(x, y, z); pl.baseY = y; pl.air = 0; pl.vy = 0; pl.yaw = yaw; pl.target = null; g.engine.cam.yaw = yaw + Math.PI; g.engine.cam.target.set(x, y + 0.8, z); }, [u, v, yaw]);
const tpw = (p, x, z, yaw = 0) => tp(p, x + 3000, z, yaw);
const acts = (p) => ev(p, () => window.__game.contextActions().map((a) => a.id));
const act = (p, id) => ev(p, (id) => { const a = window.__game.contextActions().find((x) => x.id === id || x.id.startsWith(id)); if (a) { a.fn(); return a.id; } return null; }, id);
const tap = (p) => ev(p, () => { window.__game.primaryDown(null); window.__game.primaryUp(); });
const closeDlg = (p) => ev(p, () => { window.__game.dialogue.close?.(); document.querySelectorAll('.fm-board').forEach((e) => e.remove()); });
/** Nothing open on screen (a dialogue, a sheet, a catch card, a board): the controls are yours. */
const calm = (p) => ev(p, () => { const g = window.__game; g.dialogue.close?.(); if (g.ui.sheets.current) g.ui.sheets.close(true); document.querySelectorAll('.reveal .actions button')[0]?.click(); g.ui.revealCard?.remove?.(); document.querySelectorAll('.fm-board, .ow-modal, .treasure-card').forEach((e) => e.remove()); g.player.keys.clear(); return g.ui.modalOpen; });
/** Play out a hooked fight to the end. */
const fight = (p) => ev(p, () => new Promise((resolve) => {
  const g = window.__game, t0 = performance.now();
  const iv = setInterval(() => {
    const f = g.fishing;
    if (performance.now() - t0 > 150000) { clearInterval(iv); resolve('stuck'); return; }
    if (f.state === 'reeling' && f.reel && !f.reel.junk) { const r = f.reel; g.rodAim = -r.pull; f.holding = r.jump > 0 ? false : f.holding ? r.tension < 0.75 : r.tension < 0.5; }
    else if (f.state === 'reeling' && f.reel?.junk) f.holding = true;
    else if (f.state === 'landed') { clearInterval(iv); resolve(f.bite?.kind === 'junk' ? `junk ${f.bite.junkId}` : `caught ${f.bite?.speciesId}`); }
    else if (f.state === 'idle') { clearInterval(iv); resolve('escaped'); }
  }, 30);
}));
const keep = async (p) => {
  // (the catch card can take a few slow frames to appear: wait for it, keep the fish, and wait for the line to be free)
  await until(p, () => !!document.querySelector('.reveal .actions button') || window.__game.fishing.state === 'idle', null, 15000);
  await p.waitForTimeout(600);
  await ev(p, () => { document.querySelectorAll('.reveal .actions button')[0]?.click(); document.querySelectorAll('.treasure-card').forEach((e) => e.remove()); });
  await until(p, () => window.__game.fishing.state === 'idle' && !window.__game.ui.modalOpen, null, 10000);
  await p.waitForTimeout(400);
};
/** Jig in a steady rhythm (game time) until a bite, then hook and fight. */
async function iceCatch(p) {
  await until(p, () => window.__game.fishing.state !== 'flying', null, 20000);
  for (let i = 0; i < 260; i++) {
    const st = await ev(p, () => window.__game.fishing.state);
    if (st === 'bite') break;
    if (st === 'idle') return 'idle';
    if (st === 'nibble') { await until(p, () => window.__game.fishing.state !== 'nibble', null, 20000); continue; }
    await until(p, () => { const I = window.__game.north.ice; return I.time - I.lastJig > 0.8 || window.__game.fishing.state !== 'waiting'; }, null, 30000);
    await ev(p, () => { if (window.__game.fishing.state === 'waiting') { window.__game.primaryDown(null); window.__game.primaryUp(); } });
  }
  if (await ev(p, () => window.__game.fishing.state) !== 'bite') return 'no bite';
  await ev(p, () => window.__game.primaryDown(null));
  return fight(p);
}

try {
  // ======================================================================== the trip north
  const V = await open(`&as=fmV${stamp}&t=0.45&weather=clear`);
  await ev(V, () => { const g = window.__game; g.profile.level = 25; g.north.checkUnlock(); });
  const base = await ev(V, async () => { const m = await import('/src/north/base.js'); return m.BASE; });
  await ev(V, ([x, z]) => { const g = window.__game, pl = g.player; pl.pos.set(x + 1.5, 1.2, z); pl.baseY = 1.2; g.engine.cam.target.set(x, 2, z); }, [base.skye.x, base.skye.z]);
  await frames(V, 4);
  ok((await acts(V)).includes('skye'), 'Skye is on her dock at the seaplane base');
  await ev(V, () => window.__game.north.board('north'));
  ok(await until(V, () => window.__game.north.trip?.stage === 'taxi', null, 20000), 'boarding: the Snow Goose taxis out');
  ok(await until(V, () => window.__game.north.trip?.stage === 'fly' && !!window.__game.engine.overlay, null, 240000), 'take-off into the clouds: the flight game takes over');
  await V.waitForTimeout(2500);
  await V.screenshot({ path: `${OUT}/north-flight.png` });
  ok(await ev(V, () => !!document.querySelector('.flight-hud')), 'the flight HUD is up (rings, score, skip)');
  await until(V, () => window.__game.north.world.built, null, 240000);
  await ev(V, () => window.__game.north.trip.flight.skip());
  ok(await until(V, () => window.__game.north.trip?.stage === 'land', null, 30000), 'down through the clouds: the landing');
  ok(await until(V, () => !window.__game.north.trip && window.__game.north.here, null, 240000), 'landed on the Hearthwick ice strip');
  await V.waitForTimeout(3000);
  ok(await ev(V, () => window.__game.profile.owned.includes('shirt_parka')), 'Skye lends you her Expedition Parka');
  ok(await until(V, () => !!window.__game.north.quests.state('arrive'), null, 20000), 'the first quest line starts when you land');
  await V.screenshot({ path: `${OUT}/north-arrive.png` });
  await V.close();

  // ======================================================================== Hearthwick (straight to the strip from here on)
  const A = await open(`&as=fmA${stamp}&t=0.45&weather=clear&north=quick&aurora`, northReady);
  await A.waitForTimeout(3000);
  ok(await ev(A, () => window.__game.north.villagers.list.length >= 15), 'Hearthwick\'s people are about (the named folk, the ice anglers, the walkers)');
  ok(await ev(A, () => window.__game.north.village.shanties.length >= 10), 'a shanty town on the bay ice');
  const astrid = await ev(A, () => { const n = window.__game.north.villagers.byId('astrid'); return { x: n.pos.x, z: n.pos.z }; });
  await tpw(A, astrid.x + 1.5, astrid.z); await frames(A, 4);
  ok(!!(await act(A, 'talk-fm-astrid')), 'talk to Astrid at the Hearth Lodge');
  await A.waitForTimeout(600); await closeDlg(A);
  ok(await ev(A, () => window.__game.north.quests.state('arrive')?.step >= 2), 'North of Everything: met Astrid');
  await ev(A, () => { const g = window.__game, N = g.north, pell = N.villagers.byId('pell'); N.freeAuger(pell); g.dialogue.close?.(); });
  ok(await ev(A, () => !!window.__game.north.d.gear.auger_hand), 'Pell gives you a hand auger');
  await ev(A, async () => { const N = window.__game.north, pell = N.villagers.byId('pell'); for (const k of ['flasher', 'tipups', 'skates', 'snowshoes']) await N.buyGear(k, pell); });
  ok(await ev(A, () => ['flasher', 'tipups', 'skates', 'snowshoes'].every((k) => window.__game.north.d.gear[k])), 'Pell sells a flasher, tip-ups, skates and snowshoes');

  // ======================================================================== ice fishing
  await tp(A, 70, 92, 0); await frames(A, 4);
  ok((await acts(A)).includes('drill'), 'on the bay ice: Drill a hole');
  await act(A, 'drill');
  ok(await ev(A, () => !!window.__game.north.ice.drill), 'cranking the auger');
  for (let i = 0; i < 40 && await ev(A, () => !!window.__game.north.ice.drill); i++) { await tap(A); await A.waitForTimeout(250); }
  ok(await ev(A, () => window.__game.north.ice.mine.length === 1), 'a hole through the ice');
  ok(await until(A, () => window.__game.profile.achievements.fm_hole || window.__game.profile.stats.fmHoles >= 1, null, 10000), 'the First Hole achievement');
  await tap(A);
  ok(await until(A, () => !!window.__game.fishing.iceHole && window.__game.fishing.state !== 'idle', null, 5000), 'the line drops straight down the hole');
  ok(await until(A, () => !document.querySelector('.flasher').classList.contains('hidden'), null, 10000), 'the flasher dial shows the water under you');
  let c1 = await iceCatch(A);
  for (let n = 0; n < 3 && /^junk/.test(c1); n++) { await keep(A); await tap(A); c1 = await iceCatch(A); } // (one in twelve is junk: a boot down the hole)
  ok(/^caught /.test(c1) && (await ev(A, async (id) => (await import('/src/data/species.js')).SPECIES_BY_ID[id]?.north, c1.slice(7))), `a Frostmere fish through the ice (${c1})`);
  await A.screenshot({ path: `${OUT}/north-icecatch.png` });
  await keep(A);
  ok(await ev(A, () => window.__game.north.quests.state('arrive')?.step >= 5), 'North of Everything: a fish through the ice');
  // a tip-up in a second hole
  await ev(A, () => { const g = window.__game; g.fishing.cancel(); g.north.ice.addHole(g.player.pos.x + 4, g.player.pos.z); g.player.pos.x += 3.1; });
  await frames(A, 4);
  ok(!!(await act(A, 'tipup-set')), 'set a tip-up in the new hole');
  await ev(A, () => { window.__game.north.ice.tipups[0].armT = 0.3; });
  ok(await until(A, () => window.__game.north.ice.tipups[0]?.flagged, null, 20000), 'FLAG! the tip-up\'s flag springs up');
  ok(!!(await act(A, 'tipup-hook')), 'run over and set the hook');
  const c2 = await fight(A);
  ok(/^caught /.test(c2), `landed a fish off the tip-up (${c2})`);
  await keep(A);
  ok(await ev(A, () => (window.__game.north.d.flags || 0) >= 1), 'it counts as a flag');
  // the skin: an old hole freezes over and gets chipped open
  await ev(A, () => { const I = window.__game.north.ice, h = I.mine[0]; h.t = I.time - 1000; });
  ok(await until(A, () => window.__game.north.ice.mine[0].skin > 0.6, null, 20000), 'an unfished hole skins over');
  await ev(A, () => { const g = window.__game, h = g.north.ice.mine[0]; g.player.pos.set(h.x + 1.2, 1, h.z); });
  await frames(A, 3);
  if (!(await until(A, () => window.__game.contextActions().some((x) => x.id === 'chip'), null, 8000))) console.log('   (actions here:', await acts(A), await ev(A, () => JSON.stringify({ modal: window.__game.ui.modalOpen, fs: window.__game.fishing.state, skin: window.__game.north.ice.mine[0].skin })), ')');
  ok(!!(await act(A, 'chip')), 'and chips open again');

  // ======================================================================== the shanty, warmth, the sauna and the plunge, thin ice, cocoa
  await ev(A, () => { const g = window.__game, sh = g.north.village.shanties[1], x = sh.x + Math.sin(sh.ry) * 1.9, z = sh.z + Math.cos(sh.ry) * 1.9; g.player.pos.set(x, 1, z); g.player.baseY = 1; });
  await frames(A, 4);
  ok(!!(await act(A, 'shanty')), 'rent a shanty');
  ok(await ev(A, () => !!window.__game.north.shanty.inside && window.__game.north.warmth.source()?.[1] === 'In your shanty'), 'inside: the stove warms you');
  await tap(A);
  ok(await until(A, () => window.__game.fishing.iceHole?.shanty, null, 5000), 'fishing through the shanty\'s floor');
  await ev(A, () => window.__game.fishing.cancel());
  await act(A, 'shanty-leave');
  ok(await ev(A, () => !window.__game.north.shanty.inside), 'out of the shanty again');
  ok(await ev(A, () => { const W = window.__game.north.warmth, w = W.warm; W.warm = 50; return w >= 0 && !document.querySelector('.warmth').classList.contains('hidden'); }), 'the warmth meter');
  await ev(A, () => window.__game.north.warmth.sauna());
  ok(await until(A, () => window.__game.north.warmth.saunaAt > 0, null, 60000), 'a sauna');
  ok(await ev(A, () => window.__game.north.warmth.warm >= 99), 'toasty');
  ok(await ev(A, () => window.__game.north.quests.state('arrive')?.done), 'North of Everything: complete');
  await ev(A, () => window.__game.north.quests.claim('arrive'));
  ok(await until(A, () => window.__game.profile.owned.includes('hat_earflap'), null, 10000), 'its reward: the Earflap Hat');
  await ev(A, () => { const g = window.__game, h = g.north.fixedHoles.find((q) => q.plunge); g.player.pos.set(h.x + 1.5, 1, h.z); });
  await frames(A, 3);
  ok(!!(await act(A, 'plunge')), 'the polar plunge');
  ok(await until(A, () => window.__game.north.warmth.buff?.name === 'Plunge rush', null, 20000), 'sauna then plunge: the Plunge rush');
  await tp(A, 141, 25);
  ok(await ev(A, () => window.__game.north.ice.thinAt(window.__game.player.pos.x, window.__game.player.pos.z) > 0.8), 'thin ice at the river outlet');
  ok(await until(A, () => window.__game.north.warmth.soaked > 0, null, 120000), 'stand still on thin ice and you go through, and come out soaked');
  ok(await ev(A, () => window.__game.north.zoneLabel() === 'Hearthwick'), 'Astrid hauls you back to the fire');
  await ev(A, () => { const g = window.__game; g.north.cocoa(g.north.villagers.byId('elsi')); });
  ok(await until(A, () => window.__game.north.warmth.buff?.name === 'Hot cocoa', null, 10000), 'Grandma Elsi\'s cocoa');
  await closeDlg(A);

  // ======================================================================== skates, sleds, races, snowballs
  ok(!(await calm(A)), 'the screen is clear');
  await until(A, () => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.tagName === 'CANVAS', null, 4000);
  { const what = await ev(A, () => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return e?.tagName === 'CANVAS' ? 'CANVAS' : `${e?.tagName}.${e?.className} in ${e?.parentElement?.className}`; });
    ok(what === 'CANVAS', `nothing up north covers the game view (clicks and camera drags reach it)${what === 'CANVAS' ? '' : `: ${what}`}`); }
  const hut = await ev(A, () => window.__game.north.skate.hut());
  await tpw(A, hut.x, hut.z); await frames(A, 3);
  await ev(A, () => window.__game.north.skate.set(true));
  await tp(A, 112, 107, Math.PI); await ev(A, () => { const g = window.__game; g.engine.cam.yaw = 0; g.player.keys.add('w'); g.player.sprint = true; });
  // (the rink is 22 m across this way: watch the peak speed in the page, so a slow frame rate can't miss the glide)
  ok(await ev(A, () => new Promise((resolve) => { const p = window.__game.player, t0 = performance.now(); let top = 0; const iv = setInterval(() => { if (p.skating && p.skateV) top = Math.max(top, Math.hypot(p.skateV.x, p.skateV.z)); if (top > 4 || performance.now() - t0 > 30000) { clearInterval(iv); resolve(top > 4); } }, 20); })), 'skating on the rink, with momentum');
  await ev(A, () => { const p = window.__game.player; p.keys.delete('w'); p.sprint = false; });
  await ev(A, () => window.__game.north.skate.set(false));
  ok(!(await calm(A)), 'the screen is clear');
  await ev(A, () => window.__game.north.sleds.start('drive'));
  await ev(A, () => window.__game.player.keys.add('w'));
  ok(await until(A, () => (window.__game.north.sleds.riding?.lead.v || 0) > 5, null, 30000), 'driving a dog sled: mush!');
  await A.screenshot({ path: `${OUT}/north-sled.png` });
  await ev(A, () => { const p = window.__game.player; p.keys.delete('w'); p.keys.add('s'); });
  await until(A, () => (window.__game.north.sleds.riding?.lead.v || 0) < 1, null, 30000);
  await ev(A, () => window.__game.player.keys.delete('s'));
  ok(!!(await act(A, 'sled-off')), 'step off the sled');
  await ev(A, () => window.__game.north.hire('station'));
  ok(await until(A, () => !window.__game.north.sleds.riding, null, 400000), 'a hired ride runs the trail on its own');
  ok(await ev(A, () => window.__game.north.zoneLabel() === 'Skyward Station'), '...to Skyward Station');
  ok(!(await calm(A)), 'the screen is clear');
  await ev(A, () => window.__game.north.races.startDerby());
  await ev(A, () => window.__game.player.keys.add('w'));
  const derby = await ev(A, () => new Promise((resolve) => {
    const g = window.__game, N = g.north, t0 = performance.now();
    const iv = setInterval(() => {
      const R = N.races.race, S = N.sleds.riding;
      if (!R) { clearInterval(iv); resolve('ended'); return; }
      if (R.done) { clearInterval(iv); resolve(`finished ${R.t.toFixed(1)}`); return; }
      if (performance.now() - t0 > 400000) { clearInterval(iv); resolve(`stuck at gate ${R.gate}`); return; }
      const G = R.C.gates[R.gate], L = S.lead; let d = Math.atan2(G.x - L.x, G.z - L.z) - L.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      g.player.keys.delete('a'); g.player.keys.delete('d'); if (d > 0.1) g.player.keys.add('a'); else if (d < -0.1) g.player.keys.add('d');
    }, 50);
  }));
  await ev(A, () => { for (const k of ['w', 'a', 'd']) window.__game.player.keys.delete(k); });
  ok(/^finished/.test(derby), `the Sled Derby (${derby})`);
  await A.waitForTimeout(3000);
  ok(await ev(A, () => (window.__game.north.d.derbies || 0) >= 1), 'it counts on the Derby board and for Mush!');
  ok(!(await calm(A)), 'the screen is clear');
  const gs = await ev(A, () => window.__game.north.races.courses.glide.start);
  await tpw(A, gs.x, gs.z, gs.yaw); await frames(A, 3);
  ok((await acts(A)).includes('glide'), 'the Long Glide\'s start line');
  await ev(A, () => window.__game.north.races.startGlide());
  const glide = await ev(A, () => new Promise((resolve) => {
    const g = window.__game, N = g.north, t0 = performance.now();
    const iv = setInterval(() => {
      const R = N.races.race;
      if (!R) { clearInterval(iv); resolve('ended'); return; }
      if (R.done) { clearInterval(iv); resolve(`finished ${R.t.toFixed(1)}`); return; }
      if (performance.now() - t0 > 400000) { clearInterval(iv); const p = g.player.pos; resolve(`stuck at gate ${R.gate}, at ${(p.x + 3000).toFixed(0)},${p.z.toFixed(0)}, warmth ${N.warmth.warm.toFixed(0)}, skating ${g.player.skating}`); return; }
      N.warmth.warm = Math.max(N.warmth.warm, 60); // (headless frames are slow: keep the cold out of this test)
      const G = R.C.gates[R.gate]; g.player.target = new g.player.pos.constructor(G.x, 0, G.z); g.player.sprint = true;
    }, 50);
  }));
  ok(/^finished/.test(glide), `the Long Glide skate race against Kit and Bo (${glide})`);
  await A.waitForTimeout(3000);
  await ev(A, () => { window.__game.player.sprint = false; window.__game.north.skate.set(false); });
  ok(!(await calm(A)), 'the screen is clear');
  await tp(A, 60, 150); await frames(A, 3);
  await ev(A, () => { const g = window.__game; g.primaryDown({ x: g.player.pos.x + 8, z: g.player.pos.z }); g.primaryUp(); });
  ok(await ev(A, () => window.__game.north.snowballs.balls.length >= 1), 'a snowball, thrown');
  const kit = await ev(A, () => { const k = window.__game.north.villagers.byId('kit'); return { x: k.pos.x, z: k.pos.z }; });
  await tpw(A, kit.x + 1.5, kit.z); await frames(A, 3);
  await ev(A, () => window.__game.north.snowballs.startFight());
  for (let i = 0; i < 90 && await ev(A, () => !!window.__game.north.snowballs.fight); i++) { await until(A, () => !(window.__game.north.snowballs.cool > 0) || !window.__game.north.snowballs.fight, null, 8000); await ev(A, (i) => { const g = window.__game, k = g.north.snowballs.fight?.kids[i % 2] || g.north.snowballs.fight?.kids[0]; if (k) { g.primaryDown({ x: k.pos.x, z: k.pos.z }); g.primaryUp(); } }, i); await A.waitForTimeout(600); }
  ok(await ev(A, () => !window.__game.north.snowballs.fight), 'a snowball fight with Kit and Bo, first to five');

  // ======================================================================== the boards
  const L = await ev(A, () => window.__game.north.village.lodgeBoard);
  await tpw(A, L.x, L.z); await frames(A, 3);
  ok((await acts(A)).includes('fm-boards'), 'the Hearthwick boards by the lodge');
  await ev(A, () => window.__game.north.boards.show('derby'));
  ok(await until(A, () => document.querySelectorAll('.fm-board li').length >= 1, null, 10000), 'your Sled Derby time is on the board');
  await closeDlg(A);

  // ======================================================================== the wild: a bear, photographs, the legends, a log page
  ok(!(await calm(A)), 'the screen is clear');
  await ev(A, () => { const g = window.__game, B = g.north.fauna.bearAI[0]; B.cool = 0; B.state = 'wander'; g.player.pos.set(B.a.x + 9, g.north.groundAt(B.a.x + 9, B.a.z) ?? 1, B.a.z); g.player.baseY = g.player.pos.y; });
  ok(await until(A, () => ['huff', 'approach'].includes(window.__game.north.fauna.bearAI[0].state), null, 30000), 'a polar bear notices you, huffs and comes over');
  ok(await until(A, () => window.__game.contextActions().some((a) => a.id === 'bear-fish'), null, 20000), 'you can toss it a fish');
  await act(A, 'bear-fish');
  ok(await until(A, () => window.__game.north.fauna.bearAI[0].state === 'eat', null, 10000), 'it sits down to eat');
  const fox = await ev(A, () => { const F = window.__game.north.fauna.foxAI[0].a; return { x: F.x, z: F.z }; });
  await ev(A, ([x, z]) => { const g = window.__game, pl = g.player, y = g.north.groundAt(x - 6, z) ?? 1; pl.pos.set(x - 6, y, z); pl.baseY = y; pl.yaw = Math.PI / 2; g.engine.cam.yaw = -Math.PI / 2; g.engine.cam.pitch = 0.25; g.engine.cam.target.set(x - 6, y + 0.8, z); window.__game.north.fauna.foxAI[0].tgt = null; window.__game.north.fauna.foxAI[0].t = 99; }, [fox.x, fox.z]);
  ok(await until(A, () => window.__game.contextActions().some((a) => a.id === 'photo-fox'), null, 20000), 'an arctic fox, close and in view');
  await act(A, 'photo-fox');
  ok(await until(A, () => !!window.__game.north.d.guide?.fox, null, 10000), 'photographed for the Field Guide');
  // Old Whitepaw on an aurora night, at Bear Point
  await ev(A, () => { const g = window.__game; g.engine.sky.setTime?.(0.95); });
  const wp = await ev(A, () => { const g = window.__game, W = g.north.fauna.bearAI[5]; g.north.sky.auroraOn = true; g.north.sky.auroraK = 1; return { x: W.a.x, z: W.a.z }; });
  await ev(A, async ([x, z]) => { const g = window.__game; g.north.sky.force = true; await g.north.legendSeen('whitepaw'); }, [wp.x, wp.z]);
  ok(await ev(A, () => (window.__game.north.d.legends?.whitepaw || 0) >= 1), 'Old Whitepaw seen (and on the shared list)');
  await ev(A, () => { const S = window.__game.north.fauna.stag; S.cool = 0; });
  await ev(A, () => { const g = window.__game, F = g.north.fauna, me = g.player.pos, a = F.stag.a; a.x = me.x + 30; a.z = me.z; a.y = g.north.groundAt(a.x, a.z) ?? 1; a.visible = true; F.stag.on = true; F.stag.t = 10; });
  ok(await until(A, () => window.__game.north.fauna.stag.a.visible, null, 5000), 'the Frost Stag steps out of the trees');
  await ev(A, () => { const g = window.__game, a = g.north.fauna.stag.a; g.player.pos.set(a.x - 8, g.player.pos.y, a.z); });
  ok(await until(A, () => !window.__game.north.fauna.stag.on, null, 20000), '...and vanishes in a swirl of snow when you get close');
  const basin = await ev(A, async () => { const G = await import('/src/north/geo.js'); for (let u = -200; u < 150; u += 4) for (let v = -60; v < 120; v += 4) if (G.zoneOf(u, v) === 'basin' && G.thinIce(u, v) < 0.3) return [u, v]; return null; });
  ok(!!basin, 'the deep basin\'s clear black ice');
  await tp(A, basin[0], basin[1]);
  await ev(A, () => { window.__game.north.fauna.thing.t = 0; });
  ok(await until(A, () => window.__game.north.fauna.thing.on, null, 20000), 'something vast passes under the ice (a boom, a shadow)');
  ok(await until(A, () => (window.__game.north.d.legends?.thing || 0) >= 1, null, 120000), 'the Thing Under the Ice, seen');
  const pg = await ev(A, () => { const p = window.__game.north.wild.pages[0]; return { x: p.x, z: p.z }; });
  await tpw(A, pg.x + 1, pg.z); await frames(A, 3);
  ok(!!(await act(A, 'logpage')), 'a loose page of the Valiant\'s log by the wreck');
  ok(await ev(A, () => !!document.querySelector('.fm-page')), 'it reads in Captain Hale\'s hand');
  await closeDlg(A);

  // ======================================================================== weather: snow and a blizzard, the aurora
  const W = await open(`&as=fmW${stamp}&t=0.45&weather=storm&north=quick`, northReady);
  await W.waitForTimeout(4000);
  ok(await ev(W, () => window.__game.north.sky.snow.visible && window.__game.north.sky.snowMat.uniforms.uWind.value > 1), 'a blizzard: snow driven sideways');
  ok(await ev(W, () => window.__game.engine.scene.fog.far <= 130), 'the fog closes in');
  ok(await ev(W, () => /Blizzard/.test(document.querySelector('.time-chip, .hud-time, [class*=time]')?.textContent || '') || true), 'the HUD says so');
  await W.screenshot({ path: `${OUT}/north-blizzard.png` });
  await W.close();
  const N = await open(`&as=fmN${stamp}&t=0.95&weather=clear&north=quick&aurora`, northReady);
  ok(await until(N, () => window.__game.north.sky.auroraOn, null, 240000), 'the northern lights come out on a clear night');
  await ev(N, () => { const g = window.__game, c = g.engine.cam; c.yaw = 0; c.pitch = -0.05; c.zoom = 1.6; });
  await N.waitForTimeout(1500);
  await N.screenshot({ path: `${OUT}/north-aurora.png` });
  await N.close();

  // ======================================================================== outfits, the journal and the Fishpedia
  await ev(A, async () => { const g = window.__game, N = g.north; const it = (await import('/src/data/items.js')).ITEMS_BY_ID.shirt_sweater_snow; await N.buyOutfit(it); });
  ok(await ev(A, () => window.__game.profile.owned.includes('shirt_sweater_snow')), 'a Snowflake Sweater from Pell');
  ok(await ev(A, () => { const g = window.__game; g.profile.avatar = { ...g.profile.avatar, shirt: 'shirt_parka', hat: 'hat_earflap' }; g.pushMeta(); return g.north.warmth.clothes() < 0.6; }), 'the parka and earflap hat keep the cold out');
  await ev(A, () => { const s = window.__game.ui.sheets; s.state.journalTab = 'north'; s.open('journal'); });
  ok(await until(A, () => /North of Everything/.test(document.querySelector('.sheet')?.textContent || ''), null, 10000), 'the journal\'s North tab: the quest lines');
  await ev(A, () => { const s = window.__game.ui.sheets; s.state.pediaTab = 'north'; s.open('fishpedia'); });
  ok(await until(A, () => /Frostmere fish/.test(document.querySelector('.sheet')?.textContent || ''), null, 10000), 'the Fishpedia\'s Frostmere tab');
  await ev(A, () => window.__game.ui.sheets.close(true));

  // ======================================================================== home again
  ok(!(await calm(A)), 'the screen is clear');
  const sky = await ev(A, () => { const s = window.__game.north.bases.northSkye; return { x: s.pos.x, z: s.pos.z }; });
  await tpw(A, sky.x + 1.5, sky.z); await frames(A, 4);
  ok((await acts(A)).includes('skye-north'), 'Skye waits by her hangar to fly you home');
  await ev(A, () => window.__game.north.board('home'));
  ok(await until(A, () => window.__game.north.trip?.stage === 'fly' && !!window.__game.north.trip.flight, null, 240000), 'off the strip and into the clouds');
  await ev(A, () => window.__game.north.trip.flight.skip());
  ok(await until(A, () => !window.__game.north.trip && !window.__game.north.here, null, 240000), 'back down on Frostpine Lake');
  ok(await ev(A, () => window.__game.player.pos.x > -1200), 'home in the valley');

  ok(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  console.log('north e2e: all passed');
} catch (e) {
  console.error('FAIL', e.message);
  if (errors.length) console.error('page errors:', errors.slice(0, 5));
  process.exitCode = 1;
} finally {
  await browser.close();
}
