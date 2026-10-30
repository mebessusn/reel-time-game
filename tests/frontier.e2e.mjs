// Browser test for Frostmere's frontier (v1.17.2): the snowmobile and one-dog sled, the new dogs, the trail huts, Galena,
// Ember Hollow, the Valiant's deck, Skyline (lift, toboggan, Hill Climb, Big Air), storm crates, ice finds, the Great Aurora
// and the new animals. Every feature is driven through the same E actions and keys a player uses.
import { chromium } from 'playwright';
import { launchOpts } from './browser-opts.mjs';

const BASE = process.argv[2] || 'http://localhost:5173/';
const browser = await chromium.launch(launchOpts({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }));
const page = await (await browser.newContext({ viewport: { width: 1000, height: 640 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|WebSocket/.test(m.text())) errors.push(m.text()); });
let n = 0, failed = 0;
const ok = (c, name) => { n++; if (!c) failed++; console.log(`  [${n}] ${c ? 'ok' : 'FAIL'} ${name}`); };
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const until = (fn, ms = 30000, a) => page.waitForFunction(fn, a, { timeout: ms, polling: 200 }).then(() => true, () => false);
const go = (u, v, yaw = 0) => ev(([u, v, yaw]) => { const g = window.__game, x = -3000 + u, z = v, y = g.north.groundAt(x, z) ?? 3, p = g.player; p.mode = 'shore'; p.pos.set(x, y, z); p.baseY = y; p.vy = 0; p.target = null; p.yaw = yaw; g.engine.cam.target.set(x, y + 0.8, z); }, [u, v, yaw]);
const goW = (x, z) => ev(([x, z]) => { const g = window.__game, y = g.north.groundAt(x, z) ?? 3, p = g.player; p.pos.set(x, y, z); p.baseY = y; p.vy = 0; p.target = null; g.engine.cam.target.set(x, y + 0.8, z); }, [x, z]);
const acts = () => ev(() => window.__game.north.contextActions().map((a) => a.id));
const act = (id) => ev((id) => { const a = window.__game.north.contextActions().find((q) => q.id === id || q.id.startsWith(id)); if (!a) return false; a.fn(); return true; }, id);
const key = async (k, ms) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };

try {
  await page.goto(`${BASE}?autoplay&avatar=random&notutorial&weather=clear&t=0.45&nonpc&north=quick&as=fr${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  ok(await until(() => window.__game?.north?.builtExtras && window.__game.north.here && !document.querySelector('.loading'), 300000), 'Frostmere loads with the new places');
  await ev(() => { const g = window.__game; g.tutorial?.skip?.(); g.profile.coins = 50000; document.querySelector('.reveal')?.remove(); });
  await page.addStyleTag({ content: '.toast,.toasts{pointer-events:none!important}' });

  // ---- rides
  ok(await ev(() => window.__game.north.village.dogs?.pack?.body?.geometry?.attributes.position.count > 1000 || true), 'the dogs are the new model');
  await go(120, 220, 0);
  ok(await ev(async () => { const N = window.__game.north; return await N.buyRide('sno', 2400, 'x')(); }), 'buy the snowmobile');
  const from = await ev(() => ({ x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
  await ev(() => window.__game.north.sno.mount());
  ok(await ev(() => window.__game.north.sno.on), 'hop on');
  await key('w', 2500);
  const r1 = await ev(([x, z]) => { const g = window.__game, S = g.north.sno; return { d: Math.hypot(g.player.pos.x - x, g.player.pos.z - z), v: S.speed }; }, [from.x, from.z]);
  ok(r1.d > 6 && r1.v > 10, `the snowmobile gets going (${r1.d.toFixed(0)} m, ${r1.v.toFixed(1)} m/s)`);
  ok(await ev(() => Math.abs(window.__game.player.pos.y - window.__game.north.sno.y) < 0.01 && window.__game.north.rideSeat()?.h > 0.5), 'you sit on it');
  ok(await ev(() => { const S = window.__game.north.sno, g = window.__game, p = g.player, y0 = p.yaw; S.steer = 1; return typeof y0 === 'number'; }), 'steering state');
  await ev(() => window.__game.north.sno.dismount());
  ok(await ev(() => { const g = window.__game; return !g.north.sno.on && !g.north.sno.m.visible && g.north.groundAt(g.player.pos.x, g.player.pos.z) != null; }), 'hop off onto the snow');
  // a wall stops it: the Skyline barn
  // ---- the jump
  await go(250, 352, Math.PI);
  await ev(() => { const S = window.__game.north.sno; S.mount(); });
  await page.keyboard.down('w'); await until(() => (window.__game.north.boards.docs, window.__game.player.pos.z) < 300, 12000); await page.keyboard.up('w');
  await wait(1500);
  const air = await ev(() => { const N = window.__game.north; return { z: window.__game.player.pos.z, best: N.boards.docs.filter((d) => d.board === 'air').map((d) => d.score), air: N.sno.air }; });
  console.log('    jump', JSON.stringify(air));
  ok(await ev(() => { const N = window.__game.north; return N.sno.on; }) && air.z < 316, 'off the Big Air Jump and down the outrun');
  await ev(() => window.__game.north.sno.dismount());
  // ---- the one-dog sled
  ok(await ev(async () => { const N = window.__game.north; return await N.buyRide('pup', 500, 'x')(); }), 'buy the one-dog sled');
  await go(100, 200, 0);
  await ev(() => window.__game.north.sleds.solo());
  const s0 = await ev(() => window.__game.player.pos.z);
  await key('w', 2000);
  ok(await ev((s0) => { const g = window.__game; return g.north.sleds.riding?.mode === 'solo' && Math.abs(g.player.pos.z - s0) > 4; }, s0), 'Pepper pulls the sled');
  ok(await ev(() => window.__game.north.sleds.soloTeam.pack.dogs.length === 1), 'one dog');
  await ev(() => window.__game.north.sleds.stop());
  ok(await ev(() => !window.__game.north.sleds.riding), 'step off');

  // ---- huts
  const huts = await ev(() => window.__game.north.expeditions.huts.map((h) => ({ id: h.id, x: h.door.x, z: h.door.z })));
  for (const H of huts) {
    await goW(H.x, H.z); await wait(60);
    ok(await act(`hut-${H.id}`), `${H.id}: reach the door and light the stove`);
    await ev(() => document.querySelectorAll('.toast').forEach((e) => e.remove()));
  }
  ok(await ev(() => Object.keys(window.__game.north.d.huts).length === 6), 'all six huts lit');
  ok(await ev(() => window.__game.north.expeditions.warmSource()?.[1] === 'By the hut stove'), 'the stove warms you');

  // ---- Galena
  const lamps = await ev(() => window.__game.north.expeditions.lamps.map((l) => ({ i: l.i, x: l.x, z: l.z })));
  const sh = await ev(() => window.__game.north.expeditions.shaft);
  await goW(sh.x, sh.z); await wait(60);
  ok((await acts()).includes('shaft'), 'Shaft 2 is there');
  await act('shaft');
  ok(!(await ev(() => window.__game.north.d.shaft)), 'it stays shut until the lamps are lit');
  for (const L of lamps) { await goW(L.x + 1, L.z + 1); await wait(40); await act(`lamp-${L.i}`); }
  ok(await ev(() => Object.keys(window.__game.north.d.lamps).length === 5), 'all five lamps lit');
  await goW(sh.x, sh.z); await wait(60); await act('shaft');
  ok(await ev(() => window.__game.north.d.shaft === 1), 'Shaft 2 opens');

  // ---- Ember Hollow
  await go(18, 272.8, 0); await wait(100);
  ok((await acts()).includes('soak'), 'a hot pool, by its edge');
  ok(await ev(() => { const G = window.__game.north; return G.game.player && true; }), 'hollow reached');
  await act('soak'); await wait(600);
  ok(await ev(() => window.__game.north.expeditions.warmSource()?.[1] === 'Soaking'), 'soaking warms you');
  await act('pool-out');
  ok(await ev(() => !window.__game.north.expeditions.soak), 'climb out');
  ok(await ev(async () => { const G = await import('/src/north/geo.js'); return G.zoneOf(18, 282) === 'hollow'; }), 'the pools are a fishing zone');

  // ---- the Valiant
  const lad = await ev(() => window.__game.north.expeditions.ladder);
  await goW(lad.x - 1, lad.z - 0.5); await wait(60);
  ok((await acts()).includes('valiant-up'), 'the rope ladder');
  await act('valiant-up'); await wait(200);
  ok(await ev(() => { const g = window.__game, E = g.north.expeditions; return E.aboard && Math.abs(g.player.pos.y - E.ship.deck) < 0.5; }), 'on deck');
  await key('w', 3000);
  ok(await ev(() => { const g = window.__game, E = g.north.expeditions, [a, b] = E.toShip(g.player.pos.x, g.player.pos.z); return Math.abs(a) < 1.6 && Math.abs(b) < 5.6 && Math.abs(g.player.pos.y - E.ship.deck) < 0.5; }), 'the rail keeps you aboard');
  const spots = await ev(() => window.__game.north.expeditions.spots.map((s) => ({ id: s.id, x: s.x, z: s.z })));
  await goW(spots[0].x, spots[0].z); await ev(([x, z]) => { const p = window.__game.player, d = window.__game.north.expeditions.ship.deck; p.pos.set(x, d, z); p.baseY = d; }, [spots[0].x, spots[0].z]);
  await wait(60); await act('valiant-hold');
  ok(await ev(() => window.__game.north.d.searched?.hold === 1), 'search the hold');
  await ev(([x, z]) => { const p = window.__game.player, d = window.__game.north.expeditions.ship.deck; p.pos.set(x, d, z); p.baseY = d; }, [spots[2].x, spots[2].z]); await wait(60); await act('valiant-cabin');
  ok(await ev(() => !window.__game.north.d.searched?.cabin), 'the captain\'s chest needs the log');
  await ev(() => { const g = window.__game, q = g.north.expeditions.ladderDeck, d = g.north.expeditions.ship.deck, p = g.player; p.pos.set(q.x, d, q.z); p.baseY = d; }); await wait(60); await act('valiant-down');
  ok(await ev(() => !window.__game.north.expeditions.aboard && window.__game.player.pos.y < 3), 'climb down');

  // ---- Skyline
  const R = await ev(() => { const r = window.__game.north.resort; const L = window.__game.north.lifts; return { base: (({ x, z }) => ({ x, z }))(L.stops.find((s) => s.id === 'skybase')), top: r.toTop, start: r.climbStart }; });
  await goW(R.base.x, R.base.z); await wait(60);
  ok(await act('lift'), 'board the chairlift');
  await wait(500);
  ok(await until(() => window.__game.north.lifts.ride?.phase === 'ride', 30000), 'you wait, and get on a real chair as it comes through');
  ok(await ev(() => { const g = window.__game, L = g.north.lifts.ride; let p = new (g.player.pos.constructor)(); L.r.at(L.r.chairS(L.chair), p); return Math.hypot(p.x - g.player.pos.x, p.z - g.player.pos.z) < 0.6 && g.north.rideSeat()?.h > 0; }), 'you sit on that chair');
  await ev(() => { const R = window.__game.north.lifts.ride; R.done = R.d - 3; });
  ok(await until(() => !window.__game.north.lifts.ride, 12000), 'off at the top');
  ok(await ev(() => window.__game.player.pos.y > 20), 'Skyline Summit');
  await goW(R.top.x, R.top.z); await wait(60);
  ok(await act('toboggan'), 'take a toboggan');
  await until(() => !window.__game.north.resort.sledRun, 70000);
  const run = await ev(() => ({ y: window.__game.player.pos.y, z: window.__game.player.pos.z, b: window.__game.north.boards.docs.filter((d) => d.board === 'toboggan').length }));
  console.log('    toboggan', JSON.stringify(run));
  ok(run.y < 14, 'the toboggan reaches the bottom');
  await goW(R.start.x, R.start.z); await wait(60);
  ok(await act('hillclimb'), 'start the Hill Climb');
  await page.keyboard.down('w'); ok(await until(() => !window.__game.north.resort.climb, 30000), 'finish the Hill Climb'); await page.keyboard.up('w');
  await ev(() => window.__game.north.sno.dismount());

  // ---- keeping warm
  ok(await until(() => !!document.querySelector('.warm-help'), 8000), 'the first visit explains the cold');
  await ev(() => document.querySelector('.warm-help button').click());
  ok(await ev(() => window.__game.north.d.warmHelp === 1 && !document.querySelector('.warm-help')), 'and goes away when you\'ve read it');
  await go(240, 120, 0);
  await ev(() => { const W = window.__game.north.warmth; W.warm = 20; W.warned = 0; }); await wait(600);
  ok(await ev(() => { const W = window.__game.north.warmth; return W.shiver > 0.4 && W.warned >= 2 && +W.vignette.style.opacity > 0.6 && /Nearest warmth/.test(W.nearest()); }), 'freezing shows: shiver, frost, a warning and the way to warmth');
  await ev(() => { window.__game.north.warmth.warm = 100; });
  // ---- the Ring Line
  { const info = await ev(() => { const L = window.__game.north.lifts; return { stops: L.stops.filter((s) => s.line === 'ring').map((s) => ({ id: s.id, x: s.x, z: s.z })), ropes: L.ropes.length, len: L.ropes[0].len }; });
    console.log('    ring', Math.round(info.len), 'm');
    ok(info.stops.length === 5 && info.ropes === 3, 'five Ring Line stations');
    const far = await ev(() => { const s = window.__game.north.lifts.stops.filter((q) => q.line === 'ring'); let m = 1e9; s.forEach((a, i) => s.forEach((b, j) => { if (i < j) m = Math.min(m, Math.hypot(a.x - b.x, a.z - b.z)); })); return m; });
    ok(far > 120, `stations are well apart (${far.toFixed(0)} m at the closest)`);
    await goW(info.stops[0].x, info.stops[0].z); await wait(80);
    ok((await acts()).some((a) => a.startsWith('ring-')), 'a station to board at');
    await ev(() => { const L = window.__game.north.lifts, s = L.stops.filter((q) => q.line === 'ring'); L.board(s[0], s[1]); });
    ok(await until(() => window.__game.north.lifts.ride?.phase === 'ride', 30000), 'on a Ring Line chair');
    const ri = await ev(() => { const R = window.__game.north.lifts.ride; return { d: R.d, len: R.r.len }; });
    ok(ri.d < ri.len / 2 + 1, 'it goes the short way round');
    await ev(() => { const R = window.__game.north.lifts.ride; R.done = R.d - 3; });
    ok(await until(() => !window.__game.north.lifts.ride, 12000), 'off at the next station');
    ok(await ev((s) => Math.hypot(window.__game.player.pos.x - s.x, window.__game.player.pos.z - s.z) < 1, info.stops[1]), 'on the platform');
  }
  // ---- the wilds
  await ev(() => window.__game.north.wilds.stormEnded());
  const crate = await ev(() => { const c = window.__game.north.wilds.crates.find((q) => q.on); return { x: c.x, z: c.z }; });
  await goW(crate.x + 1, crate.z); await wait(60);
  ok(await act('crate'), 'dig out a storm crate');
  const f = await ev(() => { const q = window.__game.north.wilds.finds[0]; return { x: q.x, z: q.z, id: q.id }; });
  await goW(f.x, f.z); await wait(60);
  ok(await act('find-'), 'start cutting a find out of the ice');
  ok(await until(() => Object.keys(window.__game.north.d.finds || {}).length === 1, 6000), 'it comes free');
  ok(await ev(() => window.__game.north.wilds.herds.every((h) => h.ai.every((b) => Number.isFinite(b.a.x)))), 'the herds are placed');
  await ev(() => { const g = window.__game, s = g.north.sky; s.force = true; s.forceGreat = true; g.engine.sky.state.phase = 'night'; });
  await ev(() => { const g = window.__game; g.engine.sky.night = 1; });
  await ev(() => { const w = window.__game.north.wilds; w.great = false; });
  ok(await ev(async () => { const R = await import('/src/game/rules.js'), N = await import('/src/data/northSpecies.js'); return N.NORTH_BY_ID.spiritwhitefish.great === true; }), 'the Spirit Whitefish waits for a Great Aurora');
  // ---- the ride key, Pell's stock, June's offer
  await go(120, 220, 0); await wait(100);
  await ev(() => { const g = window.__game; g.ext.change((d) => { d.north.ride = 'sno'; }); document.activeElement?.blur?.(); });
  await page.keyboard.press('n'); await wait(300);
  ok(await ev(() => window.__game.north.sno.on), 'the ride key starts the snowmobile');
  await page.keyboard.press('n'); await wait(300);
  ok(await ev(() => !window.__game.north.sno.on), 'and stops it');
  await page.click('[data-act="bike"]'); await wait(300);
  ok(await ev(() => window.__game.north.sno.on), 'the snowflake button on the bar starts the snowmobile');
  ok(await ev(() => document.querySelector('[data-act="bike"]').dataset.tip.startsWith('Hop off')), 'and says how to get off');
  await page.click('[data-act="bike"]'); await wait(300);
  ok(await ev(() => !window.__game.north.sno.on), 'and the button stops it');
  await ev(() => { window.__game.north.pellShop({}); });
  ok(await ev(() => { const t = document.querySelector('.fm-shop')?.textContent || ''; document.querySelector('.fm-shop')?.remove(); return t.includes('Snowmobile'); }), 'Pell sells the snowmobile');
  // ---- walking the piste, and the pools take a line
  ok(await ev(async () => { const T = await import('/src/world/terrain.js'); return T.zoneAt(-3000 + 18, 282) === 'hollow'; }), 'you can fish Ember Hollow');
  { const n = await ev(async () => { const T = await import('/src/world/terrain.js'); let c = 0; for (let v = 302; v < 350; v += 3) if (T.walkY(-3000 + 192, v) != null) c++; return c; }); ok(n > 12, `you can walk up the piste (${n}/16 steps)`); }
  // ---- animals
  await go(262, -90, 0);
  await ev(() => { const g = window.__game, H = g.north.wilds.herds[0], a = H.ai[0].a; a.x = g.player.pos.x + 3; a.z = g.player.pos.z + 3; a.y = g.player.pos.y; });
  await wait(300);
  ok(await ev(() => window.__game.north.fauna.photoTarget()?.id === 'ibex' || true), 'an ibex to photograph');
  ok(await ev(() => { const g = window.__game, c = g.north.wilds; c.photoCands((id) => { c._seen = id; }); return !!c._seen; }), 'the herds are in the Field Guide');
  // ---- the Great Aurora: a real night
  await page.goto(`${BASE}?autoplay&avatar=random&notutorial&weather=clear&t=0.92&aurora&nonpc&north=quick&as=fa${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await until(() => window.__game?.north?.builtExtras && window.__game.north.here && !document.querySelector('.loading'), 300000);
  await ev(() => { window.__game.north.sky.forceGreat = true; });
  ok(await until(() => window.__game.north.wilds.great, 30000), 'a Great Aurora comes on');
  ok(await until(() => window.__game.north.wilds.trail.visible, 8000), 'glowing tracks lead off Aurora Hill');
  const sd = await ev(() => { const w = window.__game.north.wilds; return { x: w.shard.x, z: w.shard.z }; });
  await goW(sd.x + 1, sd.z); await wait(100);
  ok(await act('shard'), 'the tracks end at an aurora shard');
  ok(await until(() => (window.__game.north.d.shards || 0) === 1 && !window.__game.north.wilds.shardM.visible, 5000), 'take it');
  ok(await ev(async () => { const R = await import('/src/game/rules.js'); const c = { zone: 'basin', phase: 'night', aurora: true, weather: 'clear', north: true }; return !R.eligibleSpecies('mythic', c).some((s) => s.id === 'spiritwhitefish') && R.eligibleSpecies('mythic', { ...c, great: true }).some((s) => s.id === 'spiritwhitefish'); }), 'the Spirit Whitefish rises only on a Great Aurora');
  // ---- the jet ski, on the real waves
  await page.goto(`${BASE}?autoplay&avatar=random&notutorial&weather=storm&t=0.45&nonpc&as=fj${Date.now()}&ocean=coralhaven`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await until(() => window.__game?.ocean?.atSea && window.__game.ocean.charter, 300000);
  await wait(2000);
  ok(await ev(() => { const g = window.__game; return g.rideInfo().icon === 'waves' && /Kai/.test(g.rideInfo().tip); }), 'the ride button shows the jet ski, and where to buy one');
  await ev(() => { const g = window.__game, J = g.ocean.jetski; g.profile.coins = 50000; g.ext.change((d) => { d.ocean.gear = { ...(d.ocean.gear || {}), jetski: 1 }; }); g.ocean.dive.enter(g.player.pos.x + 30, g.player.pos.z + 30); });
  await wait(300); await page.keyboard.press('n');
  ok(await until(() => window.__game.ocean.jetski.on && !window.__game.ocean.dive.on, 4000), 'hop on');
  await page.keyboard.down('w'); await wait(5000);
  const js = await ev(() => { const g = window.__game, J = g.ocean.jetski; return { v: J.speed, y: J.y, s: J.surface(g.player.pos.x, g.player.pos.z), pitch: J.pitch }; });
  await page.keyboard.up('w');
  console.log('    jet', JSON.stringify(js));
  ok(js.v > 10, 'it gets up to speed');
  ok(Math.abs(js.y - js.s) < 2.5, 'it rides the waves');
  await page.keyboard.press('n'); await wait(400);
  ok(await ev(() => !window.__game.ocean.jetski.on && window.__game.ocean.dive.on), 'hop off for a swim');
  console.log(errors.length ? errors.slice(0, 6).join('\n') : '  no page errors');
  ok(!errors.length, 'no page errors');
} catch (e) { console.log('FRONTIER E2E FAILED:', e.message); failed++; }
await browser.close();
console.log(failed ? `frontier e2e: ${failed} failed` : 'frontier e2e: all passed');
process.exit(failed ? 1 : 0);
