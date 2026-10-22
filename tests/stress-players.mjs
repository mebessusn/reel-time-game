// Player stress test: how many anglers one lake (artifact) can hold.
// Fakes the artifact's `room` capability inside the page and fills it with N bot anglers whose presence
// looks like real players (meta + state at 5 Hz, some walking, some in boats, some fishing, a little chat).
// The real RoomNet, Remotes and renderer handle them, so we measure the game's own cost per player.
// Needs the dev server: npx vite --port 5173.  Usage: node tests/stress-players.mjs [base] [n,n,n...]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launchOpts } from './browser-opts.mjs';

const BASE = process.argv[2] || 'http://localhost:5173/';
const COUNTS = (process.argv[3] || '0,4,8,16,24,32,64,128,256').split(',').map(Number);
const OUT = fileURLToPath(new URL('../test-results/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });

// Runs in the page before the game: a stand-in for claude.use('room') that behaves like room.d.ts says
// (presence merged per field, onPeers at most once per animation frame with the whole snapshot).
function fakeRuntime() {
  const S = (window.__stress = { bots: [], mine: {}, sent: 0, sentBytes: 0, maxBytes: 0, peersMs: 0, peersCalls: 0, hz: 5 });
  const handlers = [];
  let snapshot = Object.freeze([]);
  let dirty = true;
  const me = () => ({ peer: 'me', by: 'me', isMe: true, sameTab: true, guest: false, presence: Object.freeze({ ...S.mine }), updatedAt: Date.now() });
  const build = () => { snapshot = Object.freeze([me(), ...S.bots.map((b) => b.peer)]); };
  const tick = () => {
    if (dirty && handlers.length) {
      const prev = S._prevIds || new Set();
      build();
      const ids = new Set(snapshot.map((p) => p.peer));
      const left = [...prev].filter((id) => !ids.has(id)).map((peer) => ({ peer, presence: {} }));
      const t0 = performance.now();
      for (const h of handlers) h({ peers: snapshot, joined: [], left, updated: snapshot });
      S.peersMs += performance.now() - t0; S.peersCalls++;
      S._prevIds = ids; dirty = false;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  S.markDirty = () => { dirty = true; };
  const room = {
    onConnection(fn) { setTimeout(() => fn({ connected: true }), 0); return () => {}; },
    onPeers(h) { handlers.push(h); dirty = true; return () => {}; },
    peers: () => snapshot,
    presence(patch) {
      for (const [k, v] of Object.entries(patch)) { if (v === null) delete S.mine[k]; else S.mine[k] = v; }
      const bytes = new TextEncoder().encode(JSON.stringify(S.mine)).length;
      S.sent++; S.sentBytes += bytes; S.maxBytes = Math.max(S.maxBytes, bytes);
      if (bytes > 4096) return Promise.reject({ code: 'invalid_argument', message: 'presence over 4 KiB' });
      dirty = true; return Promise.resolve();
    },
    emit: () => Promise.resolve(), on: () => () => {}, connected: () => true,
    join() { return room; }, leave() {},
  };
  window.claude = { use: (name) => Promise.resolve(name === 'room' ? room : null) };
}

// Bot anglers, driven from a timer in the page (5 Hz each, like a real player).
function startBots(n) {
  const S = window.__stress, g = window.__game;
  clearInterval(S.timer);
  const base = S.mine.meta; const sp = g.player.pos;
  const mk = (i) => {
    const kind = i % 10 < 6 ? 'walk' : i % 10 < 8 ? 'boat' : 'fish';
    const a = (i / Math.max(1, n)) * Math.PI * 2, r = 6 + (i % 7) * 3;
    return { i, kind, x: sp.x + Math.cos(a) * r, z: sp.z + Math.sin(a) * r, yaw: a, vx: 0, vz: 0, chatN: 0, ev: 0,
      meta: { ...base, id: `bot${i}`, name: `Bot ${i}`, avatar: { ...(base.avatar || {}), hue: (i * 37) % 360 } } };
  };
  S.bots = Array.from({ length: n }, (_, i) => ({ b: mk(i), peer: null }));
  const step = () => {
    const now = Date.now(), t0 = performance.now();
    for (const e of S.bots) {
      const b = e.b;
      if (b.kind !== 'fish') { if (Math.random() < 0.1) { b.yaw += (Math.random() - 0.5) * 1.5; } const sp2 = b.kind === 'boat' ? 0.5 : 0.3; b.x += Math.cos(b.yaw) * sp2; b.z -= Math.sin(b.yaw) * sp2; }
      const s = { x: +b.x.toFixed(2), y: +(b.kind === 'boat' ? 0.2 : sp.y).toFixed(2), z: +b.z.toFixed(2), yaw: +b.yaw.toFixed(2), mode: b.kind === 'boat' ? 'boat' : 'shore',
        pose: b.kind === 'fish' ? 'cast' : 'idle', rod: b.kind === 'walk' ? 'back' : 'hand', moving: b.kind !== 'fish', tension: b.kind === 'fish' ? +Math.random().toFixed(2) : 0, lean: 0, afk: false, seat: 0, run: 0,
        bobber: b.kind === 'fish' ? { x: +(b.x + Math.cos(b.yaw) * 8).toFixed(2), y: 0, z: +(b.z - Math.sin(b.yaw) * 8).toFixed(2), st: 'wait' } : null };
      const pr = { meta: b.meta, s, best: { speciesId: 'bluegill', weight: 0.9 } };
      if (Math.random() < 0.002) b.chatN++;
      if (b.chatN) pr.chat = Array.from({ length: Math.min(5, b.chatN) }, (_, k) => ({ n: b.chatN - k, x: 'nice catch!', at: now }));
      if (Math.random() < 0.003) b.ev++;
      if (b.ev) pr.ev = { n: b.ev, type: 'catch', data: { speciesId: 'bluegill', variant: 'normal', weight: 0.6, tier: 'common' } };
      e.peer = Object.freeze({ peer: `p${b.i}`, by: `u${b.i}`, isMe: false, sameTab: false, guest: false, presence: Object.freeze(pr), updatedAt: now });
    }
    S.markDirty();
    S.botMs = (S.botMs || 0) + performance.now() - t0;
  };
  step();
  S.timer = setInterval(step, 1000 / S.hz);
}

// Frame stats for `ms`: frame times, time in remotes.update, onPeers handler time, draw calls, heap.
async function measure(page, ms, noRender) {
  return page.evaluate(async ([ms, noRender]) => {
    const S = window.__stress, g = window.__game, R = g.remotes, rd = g.engine.renderer;
    if (!rd.__render) rd.__render = rd.render;
    rd.render = noRender ? () => {} : rd.__render;
    const sent0 = S.sent, wall0 = performance.now();
    if (!R.__wrapped) { const orig = R.update.bind(R); R.update = (dt, t) => { const t0 = performance.now(); orig(dt, t); S.remMs = (S.remMs || 0) + performance.now() - t0; }; R.__wrapped = true; }
    S.remMs = 0; S.peersMs = 0; S.peersCalls = 0; S.botMs = 0;
    const frames = []; let last = performance.now(); const end = last + ms;
    await new Promise((res) => { const f = (t) => { frames.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    frames.shift(); frames.sort((a, b) => a - b);
    const n = frames.length, avg = frames.reduce((a, b) => a + b, 0) / n;
    const info = g.engine.renderer.info.render;
    return { frames: n, fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(1), p95Ms: +frames[Math.floor(n * 0.95)].toFixed(1),
      remotesMsPerFrame: +(S.remMs / n).toFixed(2), onPeersMsPerFrame: +(S.peersMs / n).toFixed(2), onPeersCalls: S.peersCalls, botSimMsPerFrame: +(S.botMs / n).toFixed(2),
      peersKnown: g.net.peers?.size ?? null, drawCalls: info.calls, triangles: info.triangles,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(0) : null,
      botPresenceBytes: S.bots[0] ? new TextEncoder().encode(JSON.stringify(S.bots[0].peer.presence)).length : 0,
      myPresenceMaxBytes: S.maxBytes, mySendsPerSec: +((S.sent - sent0) / ((performance.now() - wall0) / 1000)).toFixed(1),
      metaBytes: new TextEncoder().encode(JSON.stringify(S.mine.meta || {})).length, stateBytes: new TextEncoder().encode(JSON.stringify(S.mine.s || {})).length };
  }, [ms, noRender]);
}

const browser = await chromium.launch(launchOpts({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] }));
const page = await (await browser.newContext({ viewport: { width: 980, height: 640 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || e.message));
await page.addInitScript(fakeRuntime);
await page.goto(`${BASE}?avatar=random&weather=clear&gfx=low&notutorial&autoplay`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__game?.engine?.running && !document.querySelector('.loading') && window.__stress?.mine?.meta, null, { timeout: 300000 });
await page.waitForTimeout(3000);
console.log('net kind:', await page.evaluate(() => window.__game.net.kind));
const rows = [];
for (const n of COUNTS) {
  await page.evaluate(startBots, n);
  await page.waitForTimeout(4000); // let actors load and settle
  const gpu = await measure(page, 6000, false);
  if (process.env.DIAG) console.log('scene', n, JSON.stringify(await page.evaluate(() => {
    const out = {}; const sc = window.__game.engine.scene;
    for (const c of sc.children) { if (!c.visible) continue; let m = 0; c.traverseVisible((o) => { if (o.isMesh || o.isLine || o.isPoints || o.isSprite) m++; }); const k = (c.name || c.type) + (c.isLine ? ':line' : '') + (c.type === 'Group' && !c.name ? ':' + (c.children.map((x) => x.name || x.type).slice(0, 3).join('/')) + (window.__game.remotes && [...window.__game.remotes.list.values()].some((r) => r.actor.root === c) ? ':ACTOR' : [...window.__game.remotes.list.values()].some((r) => r.pet?.mesh === c) ? ':PET' : [...window.__game.remotes.list.values()].some((r) => r.actor.held === c) ? ':HELD' : [...window.__game.remotes.list.values()].some((r) => r.actor.bobberObj === c) ? ':BOB' : '') : ''); out[k] = (out[k] || 0) + m; }
    const L = [...window.__game.remotes.list.values()]; out.visibleActors = L.filter((r) => r.actor.root.visible).length; out.withState = L.filter((r) => r.peer.state).length; out.lines = L.filter((r) => r.actor.line.line.visible).length; out.bobs = L.filter((r) => r.actor.bobberObj?.visible).length;
    return Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 16);
  })));
  const cpu = await measure(page, 6000, true);
  const r = { players: n + 1, drawCalls: gpu.drawCalls, triangles: gpu.triangles, swiftshaderFps: gpu.fps, ...cpu };
  delete r.drawCalls_; rows.push(r);
  console.log(JSON.stringify(r));
}
await page.evaluate(() => clearInterval(window.__stress.timer));
await page.screenshot({ path: `${OUT}stress-players.png` });
fs.writeFileSync(`${OUT}stress-players.json`, JSON.stringify({ rows, errors }, null, 1));
if (errors.length) console.log('page errors:', errors.slice(0, 5));
await browser.close();
