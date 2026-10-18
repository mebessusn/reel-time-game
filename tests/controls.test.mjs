// Controls & world regression test (dev server on :5173): prop collisions, clickable context buttons,
// E to interact, Space jumps (and does not cast), Shift sprints, boat launch from the dock, fish viewer.
// Run: node tests/controls.test.mjs
import { chromium } from 'playwright';
import { launchOpts } from './browser-opts.mjs';

const BASE = process.env.RT_URL || 'http://localhost:5173/';
const browser = await chromium.launch(launchOpts({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }));
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let failed = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok' : 'FAIL'} ${msg}`); if (!cond) failed++; };
const ev = (fn, arg) => page.evaluate(fn, arg);

await page.goto(`${BASE}?autoplay&avatar=random&as=controls${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__game?.save?.profile && window.__game.engine?.running, null, { timeout: 180000 });
await page.waitForTimeout(3000);
// Level 3 so boats are available.
await ev(() => { const g = window.__game; g.profile.level = 3; g.profile.coins = 5000; });

// 1. Collision: walk straight at the cabin's side wall and stop there. Positions come from the cabin's own frame
// (it stands turned 15 degrees), and the walk is followed until the angler has stopped, however fast the machine is.
const wall = await ev(async () => {
  const g = window.__game; const P = await import('/src/world/props.js');
  const a = P.cabinPt(-3, 3), b = P.cabinPt(3.5, 3); // outside the west wall (x = 0; the other sides have solid banks of mossy stones since v1.13.17), aimed at its middle
  g.player.pos.set(a.x, g.player.pos.y, a.z); g.player.target = null; g.player.setTarget(b.x, b.z);
  const lz = () => { const C = P.CABIN_POSE, c = Math.cos(C.yaw), s = Math.sin(C.yaw); return (g.player.pos.x - C.x) * c - (g.player.pos.z - C.z) * s + C.cx; }; // depth into the cabin along its x
  let deepest = -9, last = null, still = 0;
  for (let i = 0; i < 200 && still < 10; i++) { // up to 20 s; done once it hasn't moved for 1 s
    await new Promise((r) => setTimeout(r, 100));
    deepest = Math.max(deepest, lz());
    const p = `${g.player.pos.x.toFixed(2)},${g.player.pos.z.toFixed(2)}`; still = p === last ? still + 1 : 0; last = p;
  }
  return { deepest, moved: Math.hypot(g.player.pos.x - a.x, g.player.pos.z - a.z) };
});
ok(wall.deepest < -0.3 && wall.moved > 0.8, `stopped at the cabin's west wall (got to ${wall.deepest.toFixed(2)} in the cabin's frame, wall face at -0.30, walked ${wall.moved.toFixed(2)} m)`);

// 2. A tree trunk blocks too.
const tree = await ev(() => {
  const g = window.__game;
  g.player.pos.set(-16.5, g.player.pos.y, 49); g.player.setTarget(-16.5, 44);
  return true;
});
await page.waitForTimeout(2500);
const tz = await ev(() => window.__game.player.pos.z);
ok(tree && tz > 46.5 + 0.6, `framing oak trunk blocks the path (z=${tz.toFixed(2)})`);

// 3. Context buttons are clickable: stand by the door, click "Gus's shop".
await ev(() => { const g = window.__game; g.player.pos.set(-5.5, g.player.pos.y, 44.0); g.player.target = null; });
await page.waitForTimeout(600);
const btn = page.locator('.context-btn button', { hasText: "Gus's shop" });
await btn.click({ timeout: 20000, force: true }); // the prompt follows the world, so it never sits still at test frame rates
await page.waitForTimeout(400);
ok(await ev(() => window.__game.ui.sheets.current?.name === 'shop'), 'clicking the Gus\'s shop button opens the shop');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// 4. E opens it too.
await page.keyboard.press('e');
await page.waitForTimeout(400);
ok(await ev(() => window.__game.ui.sheets.current?.name === 'shop'), 'E opens the shop');

// 5. Boat tab explains launching and buying is possible at the counter.
await page.locator('.sheet button', { hasText: 'Boats' }).first().click();
await page.waitForTimeout(300);
const boatInfo = await ev(() => document.querySelector('.sheet')?.innerText || '');
ok(/Taking a boat out/.test(boatInfo) && /Buy/.test(boatInfo), 'Boats tab shows how to launch, and Buy buttons');
await page.locator('.sheet button', { hasText: /^Buy$/ }).first().click();
await page.waitForTimeout(600);
const ownedBoats = await ev(() => window.__game.profile.owned.filter((i) => i.startsWith('boat_')).length);
ok(ownedBoats >= 2, `bought a boat (${ownedBoats} owned)`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// 6. Space jumps and does not start a cast.
await ev(() => { const g = window.__game; g.player.pos.set(0.5, g.player.pos.y, 38); g.player.target = null; });
await page.waitForTimeout(500);
const y0 = await ev(() => window.__game.player.pos.y);
await page.keyboard.down('Space');
const peak = await page.waitForFunction(() => window.__game.player.air > 0.4 && window.__game.player.air, null, { timeout: 5000 }).then((h) => h.jsonValue()).catch(() => 0);
const yUp = y0 + peak;
const fs = await ev(() => window.__game.fishing.state);
await page.keyboard.up('Space');
await page.waitForFunction(() => !window.__game.player.airborne, null, { timeout: 20000 }).catch(() => {}); // swiftshader runs ~2 fps
await page.waitForTimeout(300);
const landed = await ev(() => window.__game.player.air === 0 && window.__game.player.vy === 0);
ok(yUp > y0 + 0.4 && landed, `Space hops (+${(yUp - y0).toFixed(2)}) and lands`);
ok(fs === 'idle', `Space does not cast (fishing state ${fs})`);

// 7. Shift sprints ~35% faster (stepped directly: headless frame rates are too uneven to time).
const ratio = await ev(() => {
  const pl = window.__game.player;
  const run = (sprint) => {
    pl.pos.set(0.5, pl.pos.y, 39); pl.target = null; pl.keys = new Set(['a']); pl.sprint = sprint;
    const x0 = pl.pos.x;
    for (let i = 0; i < 5; i++) pl.update(0.05, 0, false);
    pl.keys = new Set(); pl.sprint = false;
    return Math.abs(pl.pos.x - x0);
  };
  return run(true) / run(false);
});
ok(ratio > 1.3 && ratio < 1.4, `sprint is x${ratio.toFixed(2)} walking speed`);
// and the real Shift key toggles it
await page.keyboard.down('Shift');
const sprinting = await ev(() => window.__game.player.sprint);
await page.keyboard.up('Shift');
ok(sprinting && !(await ev(() => window.__game.player.sprint)), 'holding Shift sets sprint, releasing clears it');

// 8. Launch the boat from the dock.
await ev(() => { const g = window.__game; g.player.pos.set(-0.5, 1.5, 30); g.player.target = null; });
await page.waitForTimeout(500);
await page.keyboard.press('e');
await page.waitForTimeout(500);
ok(await ev(() => window.__game.player.mode === 'boat'), 'E on the dock launches the boat');

// 9. Fish viewer from the creel.
await ev(() => { const g = window.__game; g.profile.creel.push({ id: 'viewtest', speciesId: 'lanternfish', variant: 'diamond', weight: 12.5, zone: 'ruins', ts: Date.now() }); g.ui.sheets.open('creel'); });
await page.waitForTimeout(500);
await page.locator('.sheet .inv-slot.t-mythic').first().click(); // v1.10: pick the slot, then look closer
await page.waitForTimeout(300);
await page.locator('.sheet img.zoomable').first().click();
await page.waitForTimeout(800);
ok(await ev(() => !!document.querySelector('.viewer canvas')), 'clicking a creel fish opens the 3D viewer');
const box = await page.locator('.viewer-stage').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 30, { steps: 6 }); await page.mouse.up();
await page.screenshot({ path: '/tmp/controls-viewer.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
ok(await ev(() => !document.querySelector('.viewer') && window.__game.ui.sheets.current?.name === 'creel'), 'Esc closes the viewer and leaves the creel open');

ok(!errors.length, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await browser.close();
console.log(failed ? `controls: ${failed} failed` : 'controls: all passed');
process.exit(failed ? 1 : 0);
