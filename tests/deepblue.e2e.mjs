// v1.15.19 Open Waters, Deep Blue (dev server on :5173): a solo charter, then each new place in turn: Coralhaven (a pearl,
// the sea floor, holding depth, the airlock, the town inside with its shops and people), the Marigold's strongbox, Channel Light (Ida sells a pot), setting and hauling the pot, sandbar clams,
// weed mats, flotsam, Marlowe's chart with its fog, and the logbook. Prints draw calls and update cost at four places.
// Run: node tests/deepblue.e2e.mjs [outDir]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { launchOpts } from './browser-opts.mjs';
const BASE = process.env.RT_URL || 'http://localhost:5173/';
const OUT = process.argv[2] || '/tmp/deepblue';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(launchOpts({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }));
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let failed = 0;
const ok = (c, m) => { console.log(`  ${c ? 'ok' : 'FAIL'} ${m}`); if (!c) failed++; };
const ev = (fn, a) => page.evaluate(fn, a);
const until = (fn, a, ms = 30000) => page.waitForFunction(fn, a, { timeout: ms, polling: 250 }).then(() => true).catch(() => false);
const frames = (n) => ev((n2) => new Promise((r) => { let k = 0; const f = () => (++k >= n2 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

await page.goto(BASE + '?autoplay&avatar=random&t=0.42&weather=clear&nonpc&gfx=low&as=deep' + Date.now() + '&ocean=coralhaven', { waitUntil: 'domcontentloaded', timeout: 120000 });
ok(await until(() => window.__game?.ocean?.atSea && window.__game.ocean.charter, null, 300000), 'at sea on a charter');
await ev(() => { const g = window.__game; g.tutorial?.skip?.(); g.profile.coins = 50000; g.profile.level = 30; });
ok(await until(() => window.__game.ocean.deep.built, null, 60000), 'Deep Blue built');
const put = (x, z, y) => ev(([x2, z2, y2]) => { const g = window.__game; g.player.pos.set(x2, y2 ?? g.player.pos.y, z2); g.player.target = null; }, [x, z, y]);
const acts = () => ev(() => window.__game.ocean.contextActions().map((a) => a.id));
const L = (lx, lz) => ({ x: 3000 + lx, z: lz });

// boat actions
await frames(10);
const a0 = await acts();
ok(a0.includes('logbook') && a0.indexOf('logbook') > a0.indexOf('chart'), `logbook on deck, after the chart (${a0.join(',')})`);

// 1. Coralhaven: dive, see Shelly, pick a pearl, breathe in a dome
const info = await ev(() => { const d = window.__game.ocean.deep; return { pearls: d.pearls.map((p) => [p.x, p.y, p.z]), door: d.town.door, box: d.strongbox, clams: d.clams?.length, sites: d.sites.length, mats: d.mats.length }; });
console.log('  info', JSON.stringify({ sites: info.sites, mats: info.mats, clams: info.clams }));
await ev(() => window.__game.ocean.dive.enter(window.__game.player.pos.x, window.__game.player.pos.z));
ok(await ev(() => window.__game.ocean.dive.on), 'swimming');
const [px, py, pz] = info.pearls[0];
await put(px + 0.5, pz, py + 0.3); await frames(6);
let a = await acts();
ok(a.includes('pearl-0'), `pearl in reach (${a.join(',')})`);
if (a.includes('pearl-0')) await ev(() => window.__game.ocean.contextActions().find((x) => x.id === 'pearl-0').fn());
ok(await ev(() => !!window.__game.ext.d.ocean.deep?.pearls?.[0]), 'pearl saved');
ok(await ev(() => window.__game.ocean.dive.bed?.visible), 'the sea floor is drawn');
// v1.15.22: right-drag turns the camera underwater (the tint over the view used to catch the mouse)
for (let k = 0; k < 2; k++) {
  const y0 = await ev(() => window.__game.engine.cam.yaw);
  await page.mouse.move(500, 300); await page.mouse.down({ button: 'right' });
  for (let i = 1; i <= 6; i++) { await page.mouse.move(500 + i * 15, 300); await page.waitForTimeout(25); }
  await page.mouse.up({ button: 'right' });
  ok(Math.abs((await ev(() => window.__game.engine.cam.yaw)) - y0) > 0.3, `right-drag turns the camera underwater (try ${k + 1})`);
}
{ const y0 = await ev(() => window.__game.player.pos.y); await page.waitForTimeout(2000); const y1 = await ev(() => window.__game.player.pos.y); ok(Math.abs(y1 - y0) < 0.3, `you hold your depth without swimming (${y0.toFixed(2)} -> ${y1.toFixed(2)})`); }
// v1.15.20: the town: in through the airlock, round the shops, and out again
const D = info.door;
ok(await ev(([x, y, z]) => window.__game.ocean.deep.town.solidAt(x + 10, y, z), [D.x, D.y, D.z]), 'the town\'s domes are solid to a diver');
await put(D.x, D.z, D.y); await frames(4);
a = await acts();
ok(a.includes('town-in'), `Enter Coralhaven at the airlock (${a.join(',')})`);
await ev(() => { window.__game.ocean.dive.o2 = 3; });
await ev(() => window.__game.ocean.contextActions().find((x) => x.id === 'town-in')?.fn()); await page.waitForTimeout(1200); await frames(6);
ok(await ev(() => { const g = window.__game; return g.ocean.deep.town.inside && g.player.mode === 'shore' && !g.ocean.dive.on; }), 'inside the town, out of the water');
for (const [who, id] of [['shelly', 'shelly'], ['finn', 'finn'], ['coral', 'coral'], ['marina', 'marina'], ['pip', 'pip']]) {
  const k = await ev((n) => { const p = window.__game.ocean.deep.town[n]; return { x: p.pos.x, z: p.pos.z }; }, who);
  const T = await ev(async () => (await import('/src/ocean/coralhavenMap.js')).TOWN);
  const L = Math.hypot(k.x - T.x, k.z - T.z) || 1;
  await ev(([x, z]) => { window.__game.player.pos.set(x, 3, z); }, [k.x - (k.x - T.x) / L * 2.2, k.z - (k.z - T.z) / L * 2.2]); await frames(2);
  a = await acts(); ok(a.includes(id), `${who} at work (${a.join(',')})`);
}
const tea0 = await ev(() => window.__game.ocean.dive.maxO2);
await ev(() => window.__game.ocean.deep.town.buyTea()); await page.waitForTimeout(400);
ok((await ev(() => window.__game.ocean.dive.maxO2)) > tea0, 'bubble tea gives more air');
await ev(async () => { const M = await import('/src/ocean/coralhavenMap.js'); window.__game.player.pos.set(M.TOWN.x - 6, 3, M.TOWN.z + 6); window.__game.engine.cam.yaw = 2.2; window.__game.engine.cam.pitch = 0.35; });
await page.waitForTimeout(800); await frames(4);
await page.screenshot({ path: `${OUT}/town.png` });
await ev(async () => { const M = await import('/src/ocean/coralhavenMap.js'); window.__game.player.pos.set(M.TOWN.x + M.AIRLOCK_IN.x + 1, 3, M.TOWN.z); }); await frames(3);
a = await acts(); ok(a.includes('town-out'), `the airlock lets you out (${a.join(',')})`);
await ev(() => window.__game.ocean.contextActions().find((x) => x.id === 'town-out')?.fn()); await page.waitForTimeout(1200); await frames(4);
ok(await ev(() => { const g = window.__game; return g.ocean.dive.on && !g.ocean.deep.town.inside && g.ocean.dive.o2 >= g.ocean.dive.maxO2 - 1; }), 'back in the sea at the door, with full air');
await ev(() => { const g = window.__game; g.engine.camera.position.set(g.player.pos.x + 8, g.player.pos.y + 3, g.player.pos.z + 8); });
await frames(10);
await page.screenshot({ path: `${OUT}/coralhaven.png` });
ok(await ev(() => !!window.__game.ext.d.ocean.deep?.disc?.coralhaven), 'logbook: Coralhaven');

// 2. the Marigold strongbox
const B = info.box;
await put(B.x + 1, B.z, B.y + 0.8); await frames(8);
a = await acts();
ok(a.includes('strongbox'), `strongbox in reach (${a.join(',')})`);
const coins0 = await ev(() => window.__game.profile.coins);
if (a.includes('strongbox')) { await ev(() => window.__game.ocean.contextActions().find((x) => x.id === 'strongbox').fn()); await page.waitForTimeout(500); }
ok((await ev(() => window.__game.profile.coins)) > coins0, 'strongbox paid out');
await frames(6);
await page.screenshot({ path: `${OUT}/marigold.png` });
await ev(() => window.__game.ocean.dive.toBoat());

ok(!(await ev(() => window.__game.ocean.dive.on)), 'back aboard');
const sail = async (id) => { await ev((i) => { const o = window.__game.ocean; o.sailTo(i); o.charter.dep -= 600000; o.course = o.makeCourse(o.charter); }, id); return until(() => !window.__game.ocean.boat.pose.moving, null, 30000); };
// 3. Channel Light: tie up, climb on, Ida sells a pot
ok(await sail('channeldock'), 'sailed to Channel Light');
await ev(() => window.__game.ocean.toCockpit()); await frames(10);
a = await acts();
ok(a.includes('ashore'), `climb up offered (${a.join(',')})`);
if (a.includes('ashore')) await ev(() => window.__game.ocean.goAshore());
await frames(10);
const ip = await ev(() => window.__game.ocean.deep.ida.pos.toArray());
const onDeck = await ev(() => { const g = window.__game; return { y: g.player.pos.y, x: g.player.pos.x, z: g.player.pos.z }; });
console.log('  ashore at', JSON.stringify(onDeck), 'ida', ip.map((v) => v.toFixed(1)).join(','));
await put(ip[0] + 1.2, ip[2] + 1, ip[1] + 0.05); await frames(10);
a = await acts();
ok(a.includes('ida'), `Ida in reach (${a.join(',')})`);
await ev(() => { const g = window.__game; g.engine.camera.position.set(g.player.pos.x + 10, g.player.pos.y + 6, g.player.pos.z + 10); g.engine.camera.lookAt(g.player.pos); });
await frames(4);
await page.screenshot({ path: `${OUT}/channel.png` });
await ev(() => window.__game.ocean.deep.buyGear('pot')); await page.waitForTimeout(400);
ok(await ev(() => window.__game.ext.d.ocean.gearOwned?.pot === 1), 'bought a reef pot');
ok(await ev(() => !!window.__game.ext.d.ocean.deep?.disc?.channel), 'logbook: Channel Light');
await ev(() => window.__game.ocean.toCockpit()); await frames(6);
// 4. set the pot at Coralhaven, haul it
ok(await sail('coralhaven'), 'sailed to Coralhaven');
await ev(() => window.__game.ocean.toCockpit()); await frames(8);
a = await acts();
ok(a.includes('set-pot'), `set a pot offered (${a.join(',')})`);
if (a.includes('set-pot')) await ev(() => window.__game.ocean.contextActions().find((x) => x.id === 'set-pot').fn());
await frames(4);
ok(await ev(() => (window.__game.ext.d.ocean.seaGear || []).length === 1 && window.__game.ocean.deep.buoys.size === 1), 'pot set, buoy in the water');
await ev(() => { window.__game.ext.change((d) => { d.ocean.seaGear[0].at -= 3600000; }); });
const creel0 = await ev(() => window.__game.profile.creel.length);
await ev(() => window.__game.ocean.contextActions().find((x) => x.id === 'haul')?.fn()); await page.waitForTimeout(1500);
ok((await ev(() => window.__game.profile.creel.length)) > creel0 && (await ev(() => (window.__game.ext.d.ocean.seaGear || []).length === 0)), 'hauled fish into the backpack');
// 5. islets: the sandbar clams at low tide; Gull Rock props
const cl = await ev(() => window.__game.ocean.deep.clams[0]);
await ev(() => { Object.defineProperty(window.__game.ocean.tides, 'low', { get: () => true, configurable: true }); });
await ev(([x, z, y]) => { const g = window.__game; g.ocean.boat.visible; g.player.pos.set(x + 0.5, y + 0.1, z); }, [cl.x, cl.z, cl.y]); await frames(8);
a = await ev(() => window.__game.ocean.deep.shoreActions().map((x) => x.id));
ok(a.includes('clam-0'), `dig for clams (${a.join(',')})`);
await ev(() => window.__game.ocean.deep.shoreActions().find((x) => x.id === 'clam-0')?.fn()); await page.waitForTimeout(400);
ok(await ev(() => window.__game.ext.d.ocean.deep?.dug === 1), 'clams dug');
// 6. weed mats, flotsam, chart, logbook
const wb = await ev(() => { const d = window.__game.ocean.deep, q = d.matPos(d.mats[0]); const ctx = {}; const b = d.boost(ctx, { x: q.x + 2, z: q.z }); return { b, w: ctx.weedmat, far: d.boost({}, { x: q.x + 60, z: q.z }) }; });
ok(wb.w && wb.b?.tripletail > 1 && !wb.far, 'weed mat boosts tripletail and mahi only nearby');
const fl = await ev(() => { const o = window.__game.ocean; return o.deep.flotsamFor(o.charter).length; });
ok(fl >= 15, `flotsam fields for this trip (${fl} pieces)`);
const f0 = await ev(() => { const o = window.__game.ocean, f = o.deep.flot[0]; o.deep.hook(f); return f.id; });
await page.waitForTimeout(600);
ok(await ev((id) => window.__game.ext.d.ocean.deep?.flot?.got?.includes(id), f0), 'hooked a piece of flotsam');
await ev(() => window.__game.ocean.ui.chart()); await page.waitForTimeout(800);
const chart = await ev(() => ({ open: !!document.querySelector('.sc-stage canvas'), pins: document.querySelectorAll('.sc-pin').length }));
ok(chart.open && chart.pins >= 10, `the big chart opens with markers (${JSON.stringify(chart)})`);
await ev(() => { const s = document.querySelector('.sc-stage'), r = s.getBoundingClientRect(); s.dispatchEvent(new WheelEvent('wheel', { deltaY: -200, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true })); });
await page.waitForTimeout(300);
await ev(() => [...document.querySelectorAll('.sc-pin')].find((b) => /Reef Edge/.test(b.title))?.click()); await page.waitForTimeout(200);
ok(await ev(() => /Set a course/.test(document.querySelector('.mv-detail')?.textContent || '')), 'a marker offers a course');
await page.screenshot({ path: `${OUT}/chart.png` });
await ev(() => window.__game.ui.sheets.close());
await ev(() => window.__game.ocean.deep.logbook()); await frames(2);
ok(await ev(() => document.querySelectorAll('.ow-logbook .ow-crew').length === 10), 'logbook lists ten places');
await page.screenshot({ path: `${OUT}/logbook.png` });
await ev(() => window.__game.ocean.ui.closeModal());
// 7. perf at four places
const perf = await ev(async () => {
  const g = window.__game, d = g.ocean.deep, out = {};
  const T = [['spawn-boat', g.ocean.boat.pose.x, g.ocean.boat.pose.z], ['coralhaven', 2940, -20], ['ember', 3430, -330], ['channel', 2620, 90]];
  for (const [n, x, z] of T) {
    g.player.pos.set(x, 1, z); d.cullT = 0;
    await new Promise((r) => { let k = 0; const f = () => (++k >= 6 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const ri = g.engine.renderer.info.render; let vis = 0; d.root.traverseVisible((o) => { if (o.isMesh || o.isSprite) vis++; });
    const t0 = performance.now(); for (let i = 0; i < 50; i++) d.update(0.016, performance.now() / 1000); const ms = (performance.now() - t0) / 50;
    out[n] = { calls: ri.calls, deepVisible: vis, updateMs: +ms.toFixed(3) };
  }
  return out;
});
console.log('  perf', JSON.stringify(perf));
await browser.close().catch(() => {});
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n') : 'no page errors');
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed || errors.some((e) => !/Failed to load resource/.test(e)) ? 1 : 0);
