// Five Lakes Valley + camera/emote/rod regression test (dev server on :5173).
// Run: node tests/valley.test.mjs
import { chromium } from 'playwright';
import { launchOpts } from './browser-opts.mjs';

const BASE = process.env.RT_URL || 'http://localhost:5173/';
const browser = await chromium.launch(launchOpts({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }));
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let failed = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok' : 'FAIL'} ${msg}`); if (!cond) failed++; };
const ev = (fn, arg) => page.evaluate(fn, arg);
// headless WebGL renders at ~2 fps, so wait for frame-driven state instead of sleeping
const until = (fn, arg, timeout = 10000) => page.waitForFunction(fn, arg, { timeout }).then(() => true).catch(() => false);

await page.goto(`${BASE}?autoplay&avatar=random&t=0.42&weather=clear&as=valley${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__game?.selfie && window.__game.engine?.terrain, null, { timeout: 120000 });
await page.waitForTimeout(4000);

// 1. The v1.8 valley: 448x448, every lake (and the cavern) its own zone, all joined by rowable waterways,
// with a walkable footbridge wherever a trail crosses one
const world = await ev(async () => {
  const T = await import('/src/world/terrain.js');
  let unrowable = 0;
  for (const R of Object.values(T.RIVERS)) for (let i = 0; i < R.pts.length - 1; i++) for (let k = 0; k <= 10; k++) {
    const [a, b] = R.pts[i], [c, d] = R.pts[i + 1];
    if (!T.boatable(a + (c - a) * k / 10, b + (d - b) * k / 10)) unrowable++;
  }
  return { half: T.HALF, jetties: T.JETTIES.length, zones: ['frost', 'marsh', 'pond', 'quarry', 'cave'].map((z) => T.zoneAt(T.LAKES[z].cx, T.LAKES[z].cz)), river: T.zoneAt(...T.RIVERS.frostrun.pts[3]), unrowable, bridges: T.BRIDGES.map((B) => T.groundY(B.cx, B.cz)) };
});
ok(world.half === 224 && world.jetties === 4, `valley is 448x448 with 4 jetties (${JSON.stringify(world)})`);
ok(world.zones.join() === 'frost,marsh,pond,quarry,cave' && world.river === 'river', 'each lake, the cavern and the waterways are their own zones');
ok(world.unrowable === 0, `every waterway is rowable end to end (${world.unrowable} dry points)`);
ok(world.bridges.length >= 3 && world.bridges.every((y) => y > 1.6), `every footbridge is walkable (decks ${world.bridges.map((y) => y?.toFixed(2))})`);

// 2. No green cast button; casting is the mouse
ok(await ev(() => !document.querySelector('.cast-btn')), 'the "Hold to cast" button is gone');

// 3. Walk onto the Frostpine jetty and launch a boat there
const frost = await ev(async () => {
  const g = window.__game; const T = await import('/src/world/terrain.js');
  g.profile.level = 3;
  const j = T.JETTIES.find((x) => x.lake === 'frost');
  g.player.pos.set((j.x0 + j.x1) / 2, 1.5, (j.z0 + j.z1) / 2); g.player.target = null;
  const acts = g.contextActions().map((a) => a.id);
  g.launchBoat();
  return { acts, mode: g.player.mode, zone: T.zoneAt(g.player.pos.x, g.player.pos.z), label: g.currentZoneLabel() };
});
ok(frost.acts.includes('launch') && frost.mode === 'boat' && frost.zone === 'frost', `launch from the Frostpine jetty (${JSON.stringify(frost)})`);
const home = await ev(async () => { const T = await import('/src/world/terrain.js'); return { body: T.waterBody(T.LAKES.frost.cx, T.LAKES.frost.cz), cove: T.waterBody(0, -2), noRowButton: !window.__game.contextActions().some((x) => x.id === 'home') }; });
ok(home.body === home.cove && home.noRowButton, `Frostpine joins the cove by water, and no "Row to dock" button floats overhead (${JSON.stringify(home)})`);

// 4. Rod: on your back in the boat, and on your back on shore too unless you take it out (v1.14.4); T toggles
const boatBack = await until(() => window.__game.actor.rodPlace === 'back');
await ev(() => { const g = window.__game; g.disembark(); g.player.pos.set(0.5, 1.5, 38); g.player.target = null; });
await page.waitForTimeout(1500);
const shoreBack = await ev(() => window.__game.actor.rodPlace === 'back' && !!window.__game.rodStowed);
ok(boatBack && shoreBack, `rod rides on your back in the boat and, stowed by default, on shore (${JSON.stringify({ boat: boatBack, shore: shoreBack })})`);
await page.keyboard.press('t');
await until(() => window.__game.actor.rodPlace === 'hand');
const out = await ev(() => ({ place: window.__game.actor.rodPlace, stowed: !!window.__game.rodStowed }));
ok(out.place === 'hand' && !out.stowed, `T takes the rod out (${JSON.stringify(out)})`);
await page.keyboard.press('t');
await until(() => window.__game.actor.rodPlace === 'back');
const stow = await ev(() => ({ place: window.__game.actor.rodPlace, stowed: !!window.__game.rodStowed, mode: window.__game.player.mode, fishing: window.__game.fishing.state }));
ok(stow.place === 'back' && stow.stowed, `T stows it again (${JSON.stringify(stow)})`);
await page.waitForTimeout(300);

// 5. Every emote button fires on one click and shows (rod goes on the back while emoting)
await ev(() => { const g = window.__game; g.profile.owned.push('emote_clap', 'emote_dance'); g.lastCatch = { speciesId: 'bluegill', variant: 'normal', weight: 0.5 }; });
const labels = await ev(() => { window.__game.ui.toggleWheel(); const l = [...document.querySelectorAll('.wheel button')].map((b) => b.textContent); window.__game.ui.toggleWheel(); return l; });
let fired = 0; const shown = [];
for (let i = 0; i < labels.length; i++) {
  await ev(() => { window.__game.myEmote = null; });
  await page.keyboard.press('r');
  // the wheel pops in with a short animation: click once it has settled
  await page.waitForFunction(() => { const w = document.querySelector('.wheel'); return w && w.getAnimations().every((a) => a.playState === 'finished'); }, null, { timeout: 20000 });
  await page.waitForTimeout(100);
  const box = await page.locator('.wheel button').nth(i).boundingBox();
  // what is actually under the click point (logged if it isn't this button, to explain a missed click)
  const under = await ev(([x, y, i]) => { const el = document.elementFromPoint(x, y); const btn = document.querySelectorAll('.wheel button')[i]; return btn?.contains(el) ? null : (el ? `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent || '').trim().slice(0, 40)}"` : 'nothing'); }, [box.x + box.width / 2, box.y + box.height / 2, i]);
  if (under) console.log(`  note: emote ${i} click point is covered by ${under}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await until((want) => { const g = window.__game; const e = g.myEmote?.id; return e && (g.actor.pose === (e === 'showoff' ? 'hold' : e)) && g.actor.rodPlace === 'back'; }, null, 20000);
  const st = await ev(() => ({ e: window.__game.myEmote?.id, pose: window.__game.actor.pose, rod: window.__game.actor.rodPlace }));
  if (st.e) fired++;
  shown.push(`${st.e}:${st.pose}:${st.rod}`);
}
ok(fired === labels.length, `all ${labels.length} emotes fire on the first click`);
ok(shown.every((s) => { const [e, pose, r] = s.split(':'); return (e === 'showoff' ? pose === 'hold' : pose === e) && r === 'back'; }), `each emote animates with the rod stowed (${shown.join(' ')})`);
// emote while the bobber is out reels in instead of being ignored
const mid = await ev(async () => {
  const g = window.__game; g.myEmote = null;
  g.fishing.state = 'waiting'; g.fishing.bobber = { x: 0.5, z: 30, y: 0.85 };
  g.emote('wave');
  return { state: g.fishing.state };
});
mid.pose = (await until(() => window.__game.actor.pose === 'wave')) ? 'wave' : await ev(() => window.__game.actor.pose);
ok(mid.state === 'idle' && mid.pose === 'wave', `emoting while waiting reels in and waves (${JSON.stringify(mid)})`);

// 6. Selfie camera: P opens it, Space snaps a polaroid into the album
await ev(() => { window.__game.myEmote = null; window.__game.lastCatch = { speciesId: 'koi', variant: 'gold', weight: 8.5, zone: 'pond' }; });
await page.keyboard.press('p');
await until(() => window.__game.selfie.active && window.__game.actor.pose === 'hold');
const mode = await ev(() => ({ active: window.__game.selfie.active, held: !!window.__game.actor.held, pose: window.__game.actor.pose }));
ok(mode.active && mode.held && mode.pose === 'hold', `P opens the selfie camera holding the catch up (${JSON.stringify(mode)})`);
await page.keyboard.press('Space');
await page.waitForTimeout(1500);
const shot = await ev(() => ({ card: !!document.querySelector('.polaroid-card img.polaroid'), album: JSON.parse(localStorage.getItem('rt_album') || '[]').length, caption: JSON.parse(localStorage.getItem('rt_album') || '[]').slice(-1)[0]?.caption || '' }));
ok(shot.card && shot.album >= 1 && shot.caption.includes('Gold Koi'), `Space snaps a polaroid into the album (${shot.caption})`);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
ok(await ev(() => !window.__game.selfie.active && !document.querySelector('.selfie')), 'Esc leaves the selfie camera');

// 7. Map (M) and the photo album sheet
await page.keyboard.press('m');
await page.waitForTimeout(600);
ok(await ev(() => window.__game.ui.sheets.current?.name === 'map' && !!document.querySelector('canvas.mv-canvas')), 'M opens the valley map');
await ev(() => window.__game.ui.sheets.open('album'));
await page.waitForTimeout(400);
ok(await ev(() => document.querySelectorAll('.album-item').length >= 1), 'the album shows saved photos');
await page.keyboard.press('Escape');

// Locals: 2-3 strollers per area, 1-3 anglers at every lake and the river; they greet and congratulate.
const npc = await ev(async () => {
  const g = window.__game;
  const by = {};
  for (const n of g.npcs.list) { if (n.kind === 'scene' || n.kind === 'stand') continue; /* the trailer park's scripted pair; locals who keep a post (the woods' ranger, hermit and merchant) */ by[n.area] ||= { r: 0, f: 0 }; by[n.area][n.kind === 'fisher' ? 'f' : 'r']++; }
  g.lastGreat = { id: 'test-great', at: Date.now(), label: 'Gold Koi' };
  const n = g.npcs.list.find((x) => x.area === 'pond' && x.kind === 'roamer');
  g.player.pos.set(n.pos.x + 2, n.pos.y, n.pos.z + 2); g.player.target = null;
  // wait (up to 30 s, software GL is slow) for the local to notice you
  for (let i = 0; i < 60 && !(n.bubble?.text || '').includes('Gold Koi'); i++) { g.player.pos.set(n.pos.x + 2, n.pos.y, n.pos.z + 2); await new Promise((r) => setTimeout(r, 500)); }
  return { by, said: n.bubble?.text || '', emote: n.emote?.id || '', chat: g.chat.tabs.get('lake').msgs.some((m) => m.npc && m.text.includes('Gold Koi')), dbg: { modal: g.ui.modalOpen, sheet: g.ui.sheets.current?.name || null, menu: !!g.menus?.open, greet: Math.round(performance.now() - n.lastGreet), any: Math.round(performance.now() - g.npcs.lastAnyGreet), congrats: n.congrats || null, d: +Math.hypot(n.pos.x - g.player.pos.x, n.pos.z - g.player.pos.z).toFixed(1), vis: n.actor.root.visible, mode: g.player.mode } };
});
const areasOk = Object.entries(npc.by).every(([a, c]) => c.r >= 2 && c.r <= 3 && (a === 'lodge' || (c.f >= 1 && c.f <= 4)));
ok(areasOk && Object.keys(npc.by).length >= 7, `every area has 2-3 locals strolling and 1-4 fishing (${JSON.stringify(npc.by)})`);
ok((npc.said.includes('Gold Koi') && npc.emote === 'cheer') || (npc.dbg.congrats === 'test-great' && npc.chat), `a local cheers for your recent great catch ("${npc.said}" ${JSON.stringify(npc.dbg)})`);

// v1.14.11: bridge railings: you can't step off (or climb on) over the side of a footbridge, only at its ends
const rails = await ev(async () => {
  const T = await import('/src/world/terrain.js'), g = window.__game, pl = g.player, out = [];
  for (const B of T.BRIDGES) {
    const px = B.cx, pz = B.cz, sx = -B.uz, sz = B.ux; // across the deck
    pl.pos.set(px, T.bridgeY(px, pz), pz); pl.baseY = pl.pos.y;
    const side = pl.canStand(px + sx * 1.3, pz + sz * 1.3), along = pl.canStand(px + B.ux * 0.4, pz + B.uz * 0.4);
    // and from the bank or water beside the deck, onto it
    pl.pos.set(px + sx * 1.4, 1, pz + sz * 1.4);
    const climb = pl.canStand(px + sx * 0.6, pz + sz * 0.6);
    // walking across the deck for a second keeps you on it
    pl.pos.set(px, T.bridgeY(px, pz), pz); pl.baseY = pl.pos.y; pl.setTarget(px + sx * 6, pz + sz * 6);
    await new Promise((r) => setTimeout(r, 1200));
    out.push({ side, along, climb, stillOn: T.onBridge(pl.pos.x, pl.pos.z) });
    pl.target = null;
  }
  return out;
});
ok(rails.length > 0 && rails.every((r) => !r.side && r.along && !r.climb && r.stillOn), `bridge railings hold (${JSON.stringify(rails)})`);

// v1.14.11: swimming: off the side of the cove dock into a swim (no casting), and out again at the beach
const swim = await ev(async () => {
  const T = await import('/src/world/terrain.js'), g = window.__game, pl = g.player;
  pl.target = null; pl.mode = 'shore'; pl.pos.set(0.5, 1.5, 30); pl.baseY = 1.5;
  const into = pl.canStand(2.3, 30); pl.pos.set(2.4, 1.5, 30);
  await new Promise((r) => setTimeout(r, 800));
  const r = { into, mode: pl.mode, y: +pl.pos.y.toFixed(2), water: T.WATER_Y, cast: g.fishing.startCharge() };
  pl.setTarget(0.5, 44);
  for (let i = 0; i < 200 && pl.mode === 'swim'; i++) await new Promise((q) => setTimeout(q, 100));
  r.out = pl.mode;
  return r;
});
ok(swim.into && swim.mode === 'swim' && Math.abs(swim.y - swim.water) < 0.05 && swim.cast === false && swim.out === 'shore', `swimming in the lake (${JSON.stringify(swim)})`);

ok(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' / ')}` : ''}`);
await browser.close();
console.log(failed ? `valley: ${failed} failed` : 'valley: all passed');
process.exit(failed ? 1 : 0);
