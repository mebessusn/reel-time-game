// Browser test for The Wild Woods (v1.14.9): the fire tower and its rail, a journal page, foraging (and crickets at
// night), a wildlife photo, Old Hollis's tea, Wren's wagon, a camp that a second angler sees and roasts at, a forest
// stew, a timed lap of the Ridgeback Loop with a jump, and a catch in a hidden pool and a creek.
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

async function open(query) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${query}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts|TUNNEL|ERR_|Failed to load/.test(m.text())) errors.push(`${query}: ${m.text()}`); });
  await page.goto(`${BASE}?autoplay&avatar=random&weather=clear&gfx=low&notutorial&fastbite${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__game?.woods?.built && window.__game.engine.running && !document.querySelector('.loading'), null, { timeout: 300000 });
  await ev(page, async () => { const T = await import('/src/world/terrain.js'); window.__T = T; window.__gy = (x, z) => T.groundY(x, z) ?? T.surfaceY(x, z); const g = window.__game; g.tutorial?.skip?.(); g.profile.coins = 50000; g.profile.xp = Math.max(g.profile.xp || 0, 20000); g.profile.level = Math.max(g.profile.level, 12); });
  return page;
}
const tp = (p, x, z, yaw = 0) => ev(p, ([x, z, yaw]) => { const g = window.__game, pl = g.player; if (g.bikes?.riding) g.bikes.dismount(); pl.mode = 'shore'; g.actor.setMode('shore'); const y = window.__gy(x, z); pl.pos.set(x, y, z); pl.baseY = y; pl.air = 0; pl.vy = 0; pl.yaw = yaw; pl.target = null; g.engine.cam.yaw = yaw + Math.PI; g.engine.cam.target.set(x, y + 0.8, z); }, [x, z, yaw]);
const acts = (p) => ev(p, () => window.__game.contextActions().map((a) => a.label));
const act = (p, re) => ev(p, (re) => { const a = window.__game.contextActions().find((x) => new RegExp(re).test(x.label)); if (a) { a.fn(); return a.label; } return null; }, re);
const W = (p) => ev(p, async () => { const m = await import('/src/world/woods.js'); return JSON.parse(JSON.stringify({ tower: m.WOODS.tower, gate: m.WOODS.gate, loop: m.WOODS.loop })); });

try {
  const A = await open(`&as=wwA${stamp}`);
  const WD = await W(A);

  // ---------- the fire tower: climb, the rail holds, a page up top, climb down
  const T = WD.tower;
  await tp(A, T.x + Math.cos(0.4) * 3.0, T.z - Math.sin(0.4) * 3.0);
  await frames(A, 3);
  ok((await acts(A)).includes('Climb the lookout'), 'the lookout can be climbed from its foot');
  await act(A, 'Climb the lookout'); await A.waitForTimeout(900);
  ok(await ev(A, () => window.__game.woods.onTower()), 'up on the deck');
  for (let i = 0; i < 8; i++) { await ev(A, () => { const pl = window.__game.player; pl.pos.x += 0.35; pl.pos.z += 0.35; }); await frames(A, 1); }
  ok(await ev(A, () => window.__game.woods.onTower()), 'the rail keeps you on the deck');
  await ev(A, ([x, z]) => { const pl = window.__game.player; pl.pos.x = x; pl.pos.z = z; }, [T.x, T.z]); await frames(A, 2);
  ok(!!(await act(A, 'Pick up the page')), 'a page of Fenn\'s journal is on the deck');
  await A.waitForTimeout(500);
  ok(await ev(A, () => window.__game.ui.sheets.current?.name === 'valleyjournal' && /Up the ridge/.test(document.querySelector('.vj-page')?.textContent || '')), 'it opens in the Valley Journal');
  await ev(A, () => window.__game.ui.sheets.close(true));
  await act(A, 'Climb down'); await A.waitForTimeout(800);
  ok(!(await ev(A, () => window.__game.woods.onTower())), 'back on the ground');

  // ---------- foraging
  for (const kind of ['chanterelle', 'blackberry', 'mint', 'log']) {
    const s = await ev(A, (k) => window.__game.woods.spotsAll().find((x) => x.kind === k), kind);
    await tp(A, s.x + 1.1, s.z + 0.5); await frames(A, 2);
    ok(!!(await act(A, 'Pick|Dig')), `forage: ${kind}`);
  }
  ok(await ev(A, () => { const w = window.__game.woods; return w.pantry('chanterelle') >= 2 && w.pantry('blackberry') >= 3 && w.pantry('mint') >= 2 && (window.__game.ext.d.bait.worm || 0) >= 3; }), 'pantry and bait tin filled');

  // ---------- a wildlife photo
  const where = () => ev(A, () => { const f = window.__game.fauna?.list?.find((x) => x.kind === 'rabbit') || window.__game.fauna?.list?.[0]; return f ? { x: f.pos.x, z: f.pos.z, kind: f.kind } : null; });
  const a = await where();
  if (a) {
    let lab = null;
    for (let i = 0; i < 4 && !lab; i++) { // (animals move: walk up to wherever it is now, and try again)
      const w = (await where()) || a;
      await tp(A, w.x + 5, w.z + 5, Math.atan2(-5, -5)); await A.waitForTimeout(1200);
      lab = await act(A, 'Photograph');
    }
    ok(!!lab, `photographed a wild animal (${lab})`);
    ok(await ev(A, () => Object.keys(window.__game.woods.d.guide).length === 1), 'it\'s in the Field Guide');
  }

  // ---------- Old Hollis: tea for three mint gives a hint
  await ev(A, () => window.__game.woods.change((d) => { d.pantry.mint = 6; d.metHollis = 1; }));
  const H = await ev(A, () => { const n = window.__game.woods.hollis; return { x: n.pos.x, z: n.pos.z }; });
  await tp(A, H.x + 1.5, H.z + 0.6); await frames(A, 3);
  await act(A, 'Hollis'); await A.waitForTimeout(1500);
  await ev(A, () => [...document.querySelectorAll('.dlg button')].find((b) => /tea/.test(b.textContent))?.click()); await A.waitForTimeout(1500);
  ok(await ev(A, () => window.__game.woods.pantry('mint') === 3 && window.__game.woods.d.hints.length === 1), 'Hollis took three mint and gave a hint');
  await ev(A, () => window.__game.dialogue.close?.());

  // ---------- Wren's wagon: buy something a quarter off, sell the pantry
  const st = await ev(A, () => { const n = window.__game.woods.wren; return { x: n.pos.x, z: n.pos.z }; });
  await tp(A, st.x + 1.4, st.z + 0.8); await frames(A, 3);
  ok((await acts(A)).some((x) => /Wagon/.test(x)), 'Wren\'s Wagon is open');
  const bought = await ev(A, async () => { const w = window.__game.woods, e = w.wagonStock.find((x) => !window.__game.profile.owned.includes(x.item.id)); const c0 = window.__game.profile.coins; await w.buyFromWagon(e); return { got: window.__game.profile.owned.includes(e.item.id), paid: c0 - window.__game.profile.coins, list: e.item.price.coins }; });
  ok(bought.got && bought.paid < bought.list, `bought from Wren for ${bought.paid} (Gus: ${bought.list})`);

  // ---------- a camp that a friend sees; a stew at its fire
  const B = await open(`&as=wwB${stamp}`);
  const cs = await ev(A, () => window.__game.woods.spotsAll().find((x) => x.kind === 'chanterelle' && window.__game.woods.canCampHere.call({ game: { player: { pos: x } }, camps: new Map(), _campT: null })));
  await tp(A, cs.x + 3, cs.z + 3); await frames(A, 3);
  if (!(await acts(A)).includes('Pitch a camp here')) { for (const d of [[6, 0], [-6, 0], [0, 6], [0, -6]]) { await tp(A, cs.x + d[0], cs.z + d[1]); await frames(A, 2); if ((await acts(A)).includes('Pitch a camp here')) break; } }
  ok(!!(await act(A, 'Pitch a camp here')), 'pitched a camp in the woods');
  const camp = await ev(A, () => window.__game.woods.d.camp);
  ok(Array.isArray(await ev(A, () => window.__game.meta().cp)), 'the camp rides in my presence');
  await tp(B, camp.x + 8, camp.z + 8);
  await B.waitForFunction(() => window.__game.woods.campList().some((c) => c.id !== 'me'), null, { timeout: 30000 });
  ok(true, 'the second angler sees the camp');
  const fire = await ev(B, () => { window.__game.woods.renderCamps(); return [...window.__game.woods.camps.values()][0]?.fire; });
  await tp(B, fire.x + 1.2, fire.z); await frames(B, 3);
  ok((await acts(B)).includes('Roast a fish'), 'the friend can roast at my fire');
  await ev(A, () => window.__game.woods.change((d) => { d.pantry = { chanterelle: 4, blackberry: 4, mint: 2 }; }));
  const af = await ev(A, () => [...window.__game.woods.camps.values()][0].fire);
  await tp(A, af.x + 1.2, af.z); await frames(A, 3);
  await act(A, 'Cook forest stew'); await A.waitForTimeout(500);
  ok(await ev(A, () => window.__game.cookout.info()?.name === 'Well Fed: Forest Stew'), 'a forest stew makes you Well Fed');
  await B.close();

  // ---------- the Ridgeback Loop: a lap, and a jump
  await ev(A, () => window.__game.ext.change((d) => { d.bikes = ['cruiser']; d.bike = 'cruiser'; }));
  const G = WD.gate;
  await tp(A, G.x - G.ux * 8, G.z - G.uz * 8, Math.atan2(G.ux, G.uz));
  await ev(A, () => window.__game.bikes.toggle()); await frames(A, 2);
  const pts = [...WD.loop, WD.loop[0], WD.loop[1]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5);
    for (let k = 0; k < n; k++) {
      await ev(A, ([x, z, yaw]) => { const g = window.__game, pl = g.player; pl.pos.x = x; pl.pos.z = z; pl.yaw = yaw; g.bikes.v = 7; }, [ax + (bx - ax) * (k / n), az + (bz - az) * (k / n), Math.atan2(bx - ax, bz - az)]);
      await frames(A, 2);
    }
  }
  ok(await ev(A, () => window.__game.woods.d.loopBest > 0 && window.__game.woods.d.laps === 1), 'a timed lap of the Ridgeback Loop');
  ok(await ev(A, () => (window.__game.woods.d.jumps || 0) >= 1), 'the dirt jumps throw the bike into the air');
  await ev(A, () => window.__game.bikes.dismount());

  // ---------- a catch in a hidden pool and in a creek
  const catchOne = async (p) => {
    for (let i = 0; i < 6; i++) {
      await ev(p, () => window.__game.primaryDown(null)); await p.waitForTimeout(700); await ev(p, () => window.__game.primaryUp());
      await p.waitForFunction(() => ['bite', 'idle'].includes(window.__game.fishing.state), null, { timeout: 60000, polling: 50 }).catch(() => {});
      if (await ev(p, () => window.__game.fishing.state) !== 'bite') continue;
      await ev(p, () => window.__game.primaryDown(null));
      const res = await ev(p, () => new Promise((resolve) => { const g = window.__game; const iv = setInterval(() => { const f = g.fishing; if (f.state === 'reeling' && f.reel && !f.reel.junk) { const r = f.reel; r.overweight = false; g.rodAim = -r.pull; f.holding = r.jump > 0 ? false : f.holding ? r.tension < 0.75 : r.tension < 0.5; } else if (f.state === 'reeling') f.holding = true; else if (f.state === 'landed' || g.ui.revealCard?.isConnected) { clearInterval(iv); resolve('caught'); } else if (f.state === 'idle' || f.state === 'charge') { clearInterval(iv); resolve('escaped'); } }, 30); setTimeout(() => { clearInterval(iv); resolve('timeout'); }, 60000); }));
      if (res !== 'caught') continue;
      await p.waitForSelector('.reveal', { timeout: 30000 }).catch(() => {});
      const c = await ev(p, () => ({ sp: window.__game.lastCatch?.speciesId, zone: window.__game.lastCatch?.zone }));
      await ev(p, () => document.querySelector('.reveal .actions button')?.click());
      await p.waitForFunction(() => window.__game.fishing.state === 'idle', null, { timeout: 15000 }).catch(() => {});
      return c;
    }
    return null;
  };
  const P = await ev(A, () => window.__T.POOLS.foxhollow);
  await tp(A, P.cx + P.rx + 1.8, P.cz, Math.atan2(-1, 0)); await frames(A, 3);
  const c1 = await catchOne(A);
  ok(c1?.zone === 'foxhollow', `caught a fish in Fox Hollow (${c1?.sp})`);
  const C = await ev(A, () => window.__T.CREEKS.hollowbrook.pts);
  const [x0, z0] = C[2], [x1, z1] = C[3], L = Math.hypot(x1 - x0, z1 - z0), nx = -(z1 - z0) / L, nz = (x1 - x0) / L;
  await tp(A, x0 + nx * 4, z0 + nz * 4, Math.atan2(-nx, -nz)); await frames(A, 3);
  const c2 = await catchOne(A);
  ok(c2?.zone === 'creek', `caught a fish in Hollow Brook (${c2?.sp})`);
  ok(await ev(A, () => (window.__game.woods.d.ranger.have['catch-pool'] || 0) >= 1 && (window.__game.woods.d.ranger.have['catch-creek'] || 0) >= 1), 'Ranger Rhea counts them');
  await A.screenshot({ path: `${OUT}/woods-creek.png` });

  // ---------- night: crickets come out
  const N = await open(`&as=wwN${stamp}&t=0.9`);
  const cr = await ev(N, () => window.__game.woods.spotsAll().find((x) => x.kind === 'cricket'));
  await tp(N, cr.x + 1, cr.z + 0.5); await frames(N, 3);
  ok(!!(await act(N, 'Catch crickets')), 'crickets to catch in the long grass at night');

  ok(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  console.log('woods e2e: all passed');
} catch (e) {
  console.error('FAIL', e.message);
  if (errors.length) console.error('page errors:', errors.slice(0, 5));
  process.exitCode = 1;
} finally {
  await browser.close();
}
