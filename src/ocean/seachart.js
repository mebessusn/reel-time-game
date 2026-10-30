// v1.15.20 Marlowe's chart, the big one: the whole sea in the map panel (M at sea, or Chart on deck), laid out like
// the valley's map. Drag to pan, scroll or +/- to zoom, click a marker for what's there and "Set a course". The sea's
// depths are painted once from the sea floor itself; squares you haven't sailed near are misty (Deep Blue's logbook),
// and the places you discover only go on the chart once you've found them or charted their square.
import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { OCEAN, ISLANDS, ISLETS, SPOT_BY_ID, CHANNEL, BANK_BY_ID, ISLAND_BY_ID, oceanSurfaceY, islandE } from './geo.js';
import { TRUST } from './voyageData.js';

const WATER = 0.85;
const R = 560; // the chart shows the sea out to where the charter may sail
const PX = 2; // metres per base-map pixel (v1.16.2: finer, 2 m)
const N = Math.round((R * 2) / PX);
let BASE = null;

/** The sea painted from its floor (v1.16.2: a proper chart): shallows bright over the sand, deeps dark, depth contours
 *  every 4 m, white surf where the sea meets the shore, and the islands in relief (lit from the north-west), with
 *  sand, grass, rock and Emberkey's black sand. */
function baseMap() {
  if (BASE) return BASE;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N), E = ISLAND_BY_ID.ember;
  const H = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = oceanSurfaceY(OCEAN.x - R + (i + 0.5) * PX, OCEAN.z - R + (j + 0.5) * PX);
  const hAt = (i, j) => H[Math.max(0, Math.min(N - 1, j)) * N + Math.max(0, Math.min(N - 1, i))];
  const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * Math.max(0, Math.min(1, t)));
  const SH = [140, 228, 216], MID = [46, 166, 182], DEEP = [18, 82, 110], ABY = [8, 40, 66], SAND = [236, 220, 170], WETSAND = [206, 190, 140], GRASS = [104, 158, 78], GRASS2 = [70, 124, 60], BLACK = [70, 62, 58], ROCK = [150, 142, 128];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const y = H[j * N + i], wx = OCEAN.x - R + (i + 0.5) * PX, wz = OCEAN.z - R + (j + 0.5) * PX;
    let col;
    if (y > WATER + 0.15) {
      const volcano = islandE(E, wx, wz) < 1.15;
      col = volcano ? lerp(BLACK, [124, 64, 42], (y - 18) / 10) : y < WATER + 0.6 ? WETSAND : y < WATER + 1.6 ? SAND : y > 14 ? lerp(GRASS2, ROCK, (y - 14) / 6) : lerp(GRASS, GRASS2, (y - 1.6) / 10);
      // relief: light from the north-west
      const dx = hAt(i + 1, j) - hAt(i - 1, j), dz = hAt(i, j + 1) - hAt(i, j - 1), shade = Math.max(-0.35, Math.min(0.35, -(dx + dz) * 0.35));
      col = col.map((v) => v * (1 + shade));
      // trees: little dark crowns scattered over the grass
      if (!volcano && y > WATER + 1.8 && y < 14) { const hh = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453, t = hh - Math.floor(hh); if (t > 0.86) col = col.map((v) => v * 0.62); }
    } else {
      const d = WATER - y;
      col = d < 3 ? lerp(SH, MID, d / 3) : d < 14 ? lerp(MID, DEEP, (d - 3) / 11) : lerp(DEEP, ABY, (d - 14) / 20);
      // a little texture on the sea floor in the shallows (sand ripples), fading with depth
      if (d < 6) { const n = Math.sin(wx * 0.9 + Math.sin(wz * 0.3) * 2) * Math.sin(wz * 0.7) * 6 * (1 - d / 6); col = col.map((v) => v + n); }
      // the open sea isn't flat: long swell lines and patches of light and shade
      { const sw = Math.sin((wx * 0.6 + wz * 0.8) * 0.12 + Math.sin(wz * 0.02) * 3) * 0.5 + Math.sin(wx * 0.013 + wz * 0.017) * 0.5; col = col.map((v, q) => v * (1 + sw * 0.06) + (q === 2 ? sw * 4 : 0)); }
      // depth contours every 4 m
      const band = (h) => Math.floor((WATER - h) / 4);
      if (d > 1 && (band(hAt(i + 1, j)) !== band(y) || band(hAt(i, j + 1)) !== band(y))) col = col.map((v) => v * 0.82 + 255 * 0.06);
      // the surf: a white line where the water meets the shore
      if (d < 0.9 && (hAt(i + 1, j) > WATER + 0.15 || hAt(i - 1, j) > WATER + 0.15 || hAt(i, j + 1) > WATER + 0.15 || hAt(i, j - 1) > WATER + 0.15)) col = lerp(col, [250, 252, 250], 0.75);
    }
    const k = (j * N + i) * 4; img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // a chart's grid every 100 m, with the sea's own lettering on the edges
  x.strokeStyle = 'rgba(255,255,255,0.1)'; x.lineWidth = 1;
  for (let m = -500; m <= 500; m += 100) { const p = (m + R) / PX; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, N); x.stroke(); x.beginPath(); x.moveTo(0, p); x.lineTo(N, p); x.stroke(); }
  x.fillStyle = 'rgba(255,255,255,0.35)'; x.font = '700 9px sans-serif';
  'ABCDEFGHIJK'.split('').forEach((L, k) => { const p = (-500 + k * 100 + R) / PX; x.fillText(L, p + 3, 10); x.fillText(String(k + 1), 3, p - 3); });
  BASE = c;
  return c;
}

const KINDS = {
  island: { label: 'Islands', icon: 'leaf', color: '#6aa84f' },
  fishing: { label: 'Fishing grounds', icon: 'fish', color: '#e9b949' },
  dive: { label: 'Dive sites', icon: 'waves', color: '#4ac8f0' },
  landmark: { label: 'Landmarks', icon: 'compass', color: '#e8907a' },
};

/** Everything on the chart. disc: a Deep Blue logbook id (hidden until found or charted). spot: where "Set a course" goes. */
function chartPlaces() {
  const P = [];
  const desc = {
    palm: 'Kai\'s tiki bar, the village, beach games and the reef. The boat ties up at the jetty.',
    turtle: 'An atoll round a warm lagoon: wade, swim and fish the lagoon.',
    smuggler: 'Cliffs, the lookout, and the smugglers\' grotto behind the arch.',
    ember: 'A young volcano: black sand, steam, and fish of its own in the warm water.',
    harbor: 'Marlowe\'s Mooring: a calm start, mixed fish close in.',
    weedline: 'The weed line: mahi, tripletail and wahoo under the drifting weed.',
    deepblue: 'Blue water: tuna, sailfish and marlin.',
    canyon: 'The Canyon: deep drops for swordfish and the big ones.',
    reefedge: 'Reef Edge: the reef drops away; groupers, snapper and divers\' fish.',
    abyss: 'The Abyss: deep, dark and strange. For Marlowe\'s trusted crew.',
    coralhaven: 'A town under the sea, 17 m down. Swim to the airlock to go inside.',
    marigold: 'An old freighter on the bottom, morays in her portholes, and a strongbox.',
    gullrock: 'Sea lions and gulls. Swim ashore.',
    lonepalm: 'One palm and a few shells. Swim ashore.',
    sandbar: 'Clams at low tide. Swim ashore.',
    channel: 'Ida keeps the light, and sells pots, longlines and her chart.',
  };
  for (const I of ISLANDS) P.push({ id: I.id, kind: 'island', name: I.name, x: I.x, z: I.z, spot: `${I.id}dock`, desc: desc[I.id], disc: I.id === 'ember' ? 'ember' : null });
  for (const id of ['harbor', 'weedline', 'deepblue', 'canyon', 'reefedge', 'abyss']) { const s = SPOT_BY_ID[id]; P.push({ id, kind: 'fishing', name: s.name, x: s.x, z: s.z, spot: id, desc: desc[id] }); }
  for (const id of ['coralhaven', 'marigold']) { const B = BANK_BY_ID[id], s = SPOT_BY_ID[id]; P.push({ id, kind: 'dive', name: s.name, x: B.x, z: B.z, spot: id, desc: desc[id], disc: id }); }
  for (const T of ISLETS) P.push({ id: T.id, kind: 'island', name: SPOT_BY_ID[T.id]?.name || T.name, x: T.x, z: T.z, spot: T.id, desc: desc[T.id], disc: T.id, small: true });
  P.push({ id: 'channel', kind: 'landmark', name: 'Channel Light', x: CHANNEL.c.x, z: CHANNEL.c.z, spot: 'channeldock', desc: desc.channel, disc: 'channel' });
  return P;
}

export function renderSeaChart(body, game, sheets) {
  const g = game, ow = g.ocean, deep = ow.deep, st = sheets.state;
  st.seaLayers = st.seaLayers || { island: true, fishing: true, dive: true, landmark: true };
  const layers = st.seaLayers;
  const dd = () => deep?.dd || {};
  const cell = (x, z) => `${Math.floor((x - OCEAN.x) / 40)},${Math.floor((z - OCEAN.z) / 40)}`;
  const known = (pl) => !pl.disc || dd().chartAll || dd().disc?.[pl.disc] || (dd().seen || []).includes(cell(pl.x, pl.z));
  const places = () => chartPlaces().filter(known);
  const charted = () => (dd().chartAll ? 100 : Math.min(100, Math.round(((dd().seen || []).length / 784) * 100)));

  // ---- side panel
  const side = h('aside.mv-side');
  const detail = h('div.mv-detail');
  const all = chartPlaces();
  const layerRow = (key, v) => h(`label.mv-layer${layers[key] ? '.on' : ''}`,
    h('input', { type: 'checkbox', checked: layers[key], on: { change: (e) => { layers[key] = e.target.checked; e.target.closest('.mv-layer').classList.toggle('on', e.target.checked); drawPins(); } } }),
    h('span.mv-dot', { style: { '--c': v.color } }, icon(v.icon)), h('span.mv-lname', v.label), h('span.mv-count.num', `${places().filter((p) => p.kind === key).length}/${all.filter((p) => p.kind === key).length}`));
  const c = ow.charter, leader = ow.isLeader?.();
  side.append(
    h('div.mv-explored', h('div.mv-big', `${charted()}%`), h('div.muted', 'of the sea charted')),
    ow.ui.seaReport?.() || null,
    h('div.mv-layers', ...Object.entries(KINDS).map(([k, v]) => layerRow(k, v))),
    detail,
    c ? h('div.sc-acts',
      h('button.btn.small', { on: { click: () => { sheets.close(); deep?.logbook(); } } }, icon('book'), 'Logbook'),
      leader ? h('button.btn.gold.small', { on: { click: () => { sheets.close(); ow.callHome(); } } }, icon('home'), 'Everyone home') : null,
      h('button.btn.ghost.small', { on: { click: () => { sheets.close(); ow.headHome('me'); } } }, icon('exit'), 'Back to the cove (just me)'),
      h('button.btn.ghost.small', { on: { click: () => { sheets.close(); setTimeout(() => ow.billfish.card(), 200); } } }, icon('trophy'), 'Billfish Derby')) : null);

  // ---- the stage
  const stage = h('div.mv-stage.sc-stage', { role: 'application', 'aria-label': 'Sea chart. Drag to pan, scroll to zoom.' });
  const world = h('div.mv-world'), canvas = h('canvas.mv-canvas'), pins = h('div.mv-pins');
  world.append(pins); stage.append(canvas, world);
  stage.append(h('div.mv-zoom',
    h('button.btn.ghost.small', { 'aria-label': 'Zoom in', on: { click: () => zoomAt(1.4) } }, icon('plus')),
    h('button.btn.ghost.small', { 'aria-label': 'Zoom out', on: { click: () => zoomAt(1 / 1.4) } }, icon('minus')),
    h('button.btn.ghost.small', { 'aria-label': 'Find the boat', on: { click: () => centerOn(boatAt().x, boatAt().z, Math.max(2, view.k)) } }, icon('nav'))),
  h('div.mv-hint', 'Drag to pan · scroll to zoom · click a place to set a course'));
  body.append(h('div.mv-layout', side, stage));
  const boatAt = () => (ow.charter ? ow.boat.pose : { x: g.player.pos.x, z: g.player.pos.z });

  // ---- view: chart px (base-map px) -> stage px
  const SIZE = N, view = { k: 1, x: 0, y: 0, base: 1 };
  let redraw = 0;
  const fit = () => { const r = stage.getBoundingClientRect(); view.base = Math.max(r.height, 200) / SIZE; };
  const apply = () => {
    const r = stage.getBoundingClientRect(); view.k = Math.max(1, Math.min(8, view.k));
    const sz = SIZE * view.base * view.k;
    view.x = Math.min(r.width * 0.5, Math.max(r.width * 0.5 - sz, view.x)); view.y = Math.min(r.height * 0.5, Math.max(r.height * 0.5 - sz, view.y));
    world.style.width = world.style.height = `${sz}px`; world.style.transform = `translate(${view.x}px, ${view.y}px)`;
    stage.classList.toggle('zoomed', view.k >= 1.8);
    if (!redraw) redraw = requestAnimationFrame(() => { redraw = 0; draw(); });
  };
  const P = (v, o) => (v - o + R) / PX; // world -> chart px
  const toStage = (wx, wz) => ({ x: view.x + P(wx, OCEAN.x) * view.base * view.k, y: view.y + P(wz, OCEAN.z) * view.base * view.k });
  const centerOn = (wx, wz, k = view.k) => { const r = stage.getBoundingClientRect(); view.k = k; const p = toStage(wx, wz); view.x += r.width / 2 - p.x; view.y += r.height / 2 - p.y; apply(); };
  const zoomAt = (f, cx, cy) => { const r = stage.getBoundingClientRect(); cx ??= r.width / 2; cy ??= r.height / 2; const k0 = view.k; view.k = Math.max(1, Math.min(8, view.k * f)); const q = view.k / k0; view.x = cx - (cx - view.x) * q; view.y = cy - (cy - view.y) * q; apply(); };
  stage.addEventListener('wheel', (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; stage.setPointerCapture?.(e.pointerId); });
  stage.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) stage.classList.add('dragging'); view.x = drag.vx + dx; view.y = drag.vy + dy; apply(); });
  stage.addEventListener('pointerup', () => { stage.classList.remove('dragging'); drag = null; st.seaK = view.k; });

  // ---- markers
  let selected = st.seaSel || null;
  const select = (pl) => { selected = pl?.id || null; st.seaSel = selected; drawPins(); showDetail(pl); };
  const pct = (v, o) => `${(P(v, o) / SIZE) * 100}%`;
  function drawPins() {
    clear(pins);
    for (const pl of places()) {
      if (!layers[pl.kind]) continue;
      const K = KINDS[pl.kind], here = ow.charter?.spot === pl.spot;
      pins.append(h(`button.mv-pin.sc-pin${selected === pl.id ? '.sel' : ''}${here ? '.here' : ''}${pl.small ? '.small' : ''}`, { style: { left: pct(pl.x, OCEAN.x), top: pct(pl.z, OCEAN.z), '--c': K.color }, 'aria-label': pl.name, title: pl.name, on: { click: (e) => { e.stopPropagation(); select(pl); } } },
        h('span.mv-pin-in', icon(K.icon)), h('span.mv-label', pl.name)));
    }
  }
  function showDetail(pl) {
    clear(detail);
    if (!pl) { detail.append(h('div.mv-empty', icon('pin'), h('p', 'Pick a place to see what\'s there and set a course. Places you discover go on the chart once you find them.'))); return; }
    const K = KINDS[pl.kind], b = boatAt(), dist = Math.round(Math.hypot(pl.x - b.x, pl.z - b.z)), s = SPOT_BY_ID[pl.spot];
    const acts = [];
    if (ow.charter && s) {
      const trusted = !s.trust || ow.trust().i >= s.trust;
      if (ow.charter.spot === pl.spot) acts.push(h('div.sc-here', icon('anchor'), ow.boat.pose.moving ? 'On our way here' : 'We\'re here'));
      else if (!trusted) acts.push(h('div.sc-here', icon('lock'), `Marlowe only takes a ${TRUST[s.trust].name} out here`));
      else {
        // (v1.16.2: ashore, setting a course calls you back aboard first: say so on the button, so it's no surprise)
        const ashore = !ow.dive.on && ow.boat.deckY(g.player.pos.x, g.player.pos.z) == null;
        acts.push(h('button.btn.blue', { on: { click: () => { sheets.close(); ow.sailTo(pl.spot); } } }, icon('compass'), ashore ? 'Set a course here (back aboard first)' : 'Set a course here'));
        if (ashore) acts.push(h('div.muted', { style: { fontSize: '12px', marginTop: '4px' } }, 'You\'re ashore: Marlowe will sound the horn and you\'ll hop back aboard before the boat leaves.'));
      }
    }
    detail.append(
      h('div.mv-d-kind', { style: { '--c': K.color } }, icon(K.icon), K.label.replace(/s$/, '')),
      h('h3.mv-d-name', pl.name),
      pl.desc ? h('p.mv-d-desc', pl.desc) : null,
      h('div.mv-d-dist', icon('nav'), dist < 30 ? 'The boat is here' : `${dist} m from the boat`),
      h('div.mv-d-acts', acts));
  }

  // ---- drawing
  const ctx = canvas.getContext('2d');
  const G = 28, fog = document.createElement('canvas'); fog.width = fog.height = G;
  const fogCtx = fog.getContext('2d');
  let fogKey = null;
  const draw = () => {
    if (!canvas.isConnected) { clearInterval(timer); return; }
    const r = stage.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const sc = view.base * view.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0a2e40'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * view.x, dpr * view.y);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(baseMap(), 0, 0);
    // the mist over squares you haven't sailed near (40 m squares; one pixel each, scaled up softly)
    const seen = dd().seen || [], key = dd().chartAll ? 'all' : `${seen.length}`;
    if (key !== fogKey) {
      fogKey = key; const S2 = new Set(seen), img = fogCtx.createImageData(G, G);
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const k = (j * G + i) * 4, open = dd().chartAll || S2.has(`${i - 14},${j - 14}`); img.data[k] = 214; img.data[k + 1] = 226; img.data[k + 2] = 220; img.data[k + 3] = open ? 0 : 125; }
      fogCtx.putImageData(img, 0, 0);
    }
    ctx.imageSmoothingEnabled = true;
    const f0 = P(OCEAN.x - 14 * 40, OCEAN.x);
    ctx.drawImage(fog, 0, 0, G, G, f0, f0, (G * 40) / PX, (G * 40) / PX);
    // screen-space things: the course, crew, the boat, you
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const X = (v) => view.x + P(v, OCEAN.x) * sc, Y = (v) => view.y + P(v, OCEAN.z) * sc, ui = Math.max(1, view.base * Math.min(view.k, 2.4) * 1.3);
    const b = boatAt();
    if (ow.charter && ow.boat.pose.moving && ow.charter.to) { ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(b.x), Y(b.z)); ctx.lineTo(X(ow.charter.to.x), Y(ow.charter.to.z)); ctx.stroke(); ctx.setLineDash([]); }
    if (ow.charter) {
      const yaw = ow.boat.pose.yaw;
      ctx.save(); ctx.translate(X(b.x), Y(b.z)); ctx.scale(ui, ui); ctx.rotate(-yaw + Math.PI);
      ctx.fillStyle = '#e0483a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(5, -2); ctx.lineTo(5, 8); ctx.lineTo(-5, 8); ctx.lineTo(-5, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    const me = g.player.pos;
    if (Math.hypot(me.x - OCEAN.x, me.z - OCEAN.z) < R * 1.5 && (!ow.charter || Math.hypot(me.x - b.x, me.z - b.z) > 10)) {
      ctx.fillStyle = 'rgba(233,185,73,0.3)'; ctx.beginPath(); ctx.arc(X(me.x), Y(me.z), 8 * ui / 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e9b949'; ctx.beginPath(); ctx.arc(X(me.x), Y(me.z), 3.5 * ui / 2.2, 0, Math.PI * 2); ctx.fill();
    }
    // a compass rose in the corner
    ctx.save(); ctx.translate(r.width - 46, r.height - 52); ctx.fillStyle = 'rgba(255,248,230,0.85)'; ctx.strokeStyle = 'rgba(13,31,27,0.6)'; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(5, 0); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#fff8e6'; ctx.font = "800 12px 'Baloo 2', Nunito, sans-serif"; ctx.textAlign = 'center'; ctx.fillText('N', 0, -28); ctx.restore();
  };
  draw();
  const timer = setInterval(draw, 400);
  drawPins();
  showDetail(places().find((p) => p.id === selected) || null);
  requestAnimationFrame(() => { fit(); const b = boatAt(); centerOn(b.x, b.z, st.seaK || 1.4); });
  new ResizeObserver(() => { fit(); apply(); }).observe(stage);
}
