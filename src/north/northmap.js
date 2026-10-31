// v1.16.2 The Frostmere map (M up north): the whole of the north in the map panel, laid out like the valley's map and
// Marlowe's chart. Painted once from the land itself (snow, rock, the ice, open water, thin ice), with the sled trails,
// the race courses, your holes, other anglers and you. Drag to pan, scroll or +/- to zoom, click a marker for what's
// there and how far it is.
import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { NORTH, P, kindAt, landAt, thinIce, toWorld, toLocal, inNorth, K, TRAILS, RIVER } from './geo.js';

const R = NORTH.half; // local u, v run -R..R
const PX = 2; // metres per base-map pixel
const N = Math.round((R * 2) / PX);
let BASE = null;

/** The north painted from its ground: snow on the low land, rock up high, the ice in blues, open water dark. */
function baseMap() {
  if (BASE) return BASE;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N);
  const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));
  const SNOW = [236, 242, 246], SNOW2 = [206, 218, 228], ROCK = [140, 146, 156], ICE = [168, 206, 228], RIVER_ICE = [150, 196, 226], SEAICE = [196, 222, 236], SEA = [24, 58, 92], POOL = [70, 150, 170], THIN = [96, 140, 176];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = -R + (i + 0.5) * PX, v = -R + (j + 0.5) * PX, k = kindAt(u, v);
    let col;
    if (k === K.LAND) { const y = landAt(u, v); col = y > 26 ? lerp(SNOW2, ROCK, (y - 26) / 14) : lerp(SNOW, SNOW2, (y - 2) / 24); }
    else if (k === K.SEA) col = SEA;
    else if (k === K.POOL) col = POOL;
    else { col = k === K.RIVER ? RIVER_ICE : k === K.SEAICE ? SEAICE : ICE; const t = thinIce(u, v); if (t > 0.3) col = lerp(col, THIN, (t - 0.3) / 0.7); }
    const q = (j * N + i) * 4; img.data[q] = col[0]; img.data[q + 1] = col[1]; img.data[q + 2] = col[2]; img.data[q + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const L = (u) => (u + R) / PX;
  // the sled trails, dashed red
  x.strokeStyle = 'rgba(190,60,48,0.8)'; x.lineWidth = 1.6; x.setLineDash([4, 3]);
  for (const pts of TRAILS) { x.beginPath(); pts.forEach(([u, v], n) => (n ? x.lineTo(L(u), L(v)) : x.moveTo(L(u), L(v)))); x.stroke(); }
  x.setLineDash([]);
  // the Long Glide's skate line, lantern gold
  x.strokeStyle = 'rgba(230,170,40,0.65)'; x.lineWidth = 1.2; x.beginPath(); RIVER.slice(1, 8).forEach(([u, v], n) => (n ? x.lineTo(L(u), L(v)) : x.moveTo(L(u), L(v)))); x.stroke();
  // a faint grid every 100 m
  x.strokeStyle = 'rgba(40,70,100,0.08)'; x.lineWidth = 1;
  for (let m = -300; m <= 300; m += 100) { const p = L(m); x.beginPath(); x.moveTo(p, 0); x.lineTo(p, N); x.stroke(); x.beginPath(); x.moveTo(0, p); x.lineTo(N, p); x.stroke(); }
  BASE = c;
  return c;
}

const KINDS = {
  village: { label: 'Hearthwick', icon: 'home', color: '#e0703a' },
  fishing: { label: 'Fishing', icon: 'fish', color: '#3a8ad0' },
  wild: { label: 'The wild', icon: 'compass', color: '#6a9a5a' },
  games: { label: 'Races and rides', icon: 'trophy', color: '#c9a22a' },
};
const PLACES = {
  village: ['village', 'The village: the Hearth Lodge, Pell\'s Trading Post, the smokehouse, the sauna and the green.'],
  shanties: ['village', 'Brightly painted ice shanties over the bay. Rent one for a warm hole of your own.'],
  rink: ['games', 'Rent skates at the hut and glide. Kit and Bo are usually about.'],
  strip: ['village', 'Skye\'s ice strip and hangar: the way home.'],
  kennels: ['games', 'June\'s dogs. Drive a sled, hire a ride, or run the Sled Derby.'],
  glide: ['games', 'The frozen river through the taiga: the Long Glide skate race.'],
  sledtrail: ['games', 'The Sled Derby loop over the tundra.'],
  galena: ['wild', 'An abandoned silver town in the western foothills.'],
  hollow: ['fishing', 'Hot pools in a snowy valley. Soak, and fish them.'],
  skyline: ['games', 'The chairlift, the Ring Line station and the Hill Climb start.'],
  ringhearth: ['games', 'A Ring Line station: chairs right round the map.'],
  ringaurora: ['games', 'A Ring Line station: chairs right round the map.'],
  ringshore: ['games', 'A Ring Line station: chairs right round the map.'],
  ringgalena: ['games', 'A Ring Line station: chairs right round the map.'],
  summit: ['games', 'The summit lodge, and the toboggan run.'],
  skijump: ['games', 'Bring a snowmobile.'],
  ridge: ['fishing', 'Shoved-up blue ice. Big lake trout under it, and the Glacier King in a storm. The ice beside it is thin.'],
  floe: ['fishing', 'Where the sea ice ends: open water, capelin, arctic cod and the Old Sleeper.'],
  springs: ['fishing', 'Hot springs keep the pool open. Warm up, and on aurora nights, the Aurora Char.'],
  falls: ['fishing', 'A waterfall frozen solid, and a plunge pool that never quite freezes.'],
  glacier: ['wild', 'The glacier\'s front, pink in the evening light.'],
  caves: ['wild', 'Glowing blue ice caves, and something big frozen in the wall.'],
  bearpoint: ['wild', 'Polar bears, a mother with cubs, and Old Whitepaw on aurora nights.'],
  aurorahill: ['wild', 'Standing stones and the best view of the northern lights.'],
  wreck: ['wild', 'An explorer\'s schooner frozen into the sea ice. Pages of her log are about.'],
  taiga: ['wild', 'Snow-laden spruce, caribou, and the Frost Stag at dusk in the snow.'],
  trapper: ['wild', 'Old Ansel\'s cabin and his stilt cache.'],
  station: ['wild', 'Dr. Vale\'s research hut, with the weather mast and the dome.'],
};
const places = () => Object.entries(P).filter(([id]) => PLACES[id]).map(([id, p]) => ({ id, name: p.name, u: p.u, v: p.v, kind: PLACES[id][0], desc: PLACES[id][1] }));

export function renderNorthMap(body, game, sheets) {
  const g = game, N2 = g.north, st = sheets.state;
  st.fmLayers = st.fmLayers || { village: true, fishing: true, wild: true, games: true };
  const layers = st.fmLayers, all = places();
  const side = h('aside.mv-side'), detail = h('div.mv-detail');
  const layerRow = (key, v) => h(`label.mv-layer${layers[key] ? '.on' : ''}`,
    h('input', { type: 'checkbox', checked: layers[key], on: { change: (e) => { layers[key] = e.target.checked; e.target.closest('.mv-layer').classList.toggle('on', e.target.checked); drawPins(); } } }),
    h('span.mv-dot', { style: { '--c': v.color } }, icon(v.icon)), h('span.mv-lname', v.label), h('span.mv-count.num', `${all.filter((p) => p.kind === key).length}`));
  side.append(
    h('div.mv-explored', h('div.mv-big', N2?.zoneLabel?.() || 'Frostmere'), h('div.muted', 'You are here')),
    h('div.mv-layers', ...Object.entries(KINDS).map(([k, v]) => layerRow(k, v))),
    h('div.fm-legend', h('span', h('i', { style: { background: '#a8cee4' } }), 'Ice'), h('span', h('i', { style: { background: '#608cb0' } }), 'Thin ice'), h('span', h('i', { style: { background: '#183a5c' } }), 'Open water'), h('span', h('i.dash'), 'Sled trail')),
    detail);
  const stage = h('div.mv-stage.sc-stage.fm-stage', { role: 'application', 'aria-label': 'Map of Frostmere. Drag to pan, scroll to zoom.' });
  const world = h('div.mv-world'), canvas = h('canvas.mv-canvas'), pins = h('div.mv-pins');
  world.append(pins); stage.append(canvas, world);
  stage.append(h('div.mv-zoom',
    h('button.btn.ghost.small', { 'aria-label': 'Zoom in', on: { click: () => zoomAt(1.4) } }, icon('plus')),
    h('button.btn.ghost.small', { 'aria-label': 'Zoom out', on: { click: () => zoomAt(1 / 1.4) } }, icon('minus')),
    h('button.btn.ghost.small', { 'aria-label': 'Find me', on: { click: () => { const m = me(); centerOn(m.u, m.v, Math.max(2, view.k)); } } }, icon('nav'))),
  h('div.mv-hint', 'Drag to pan · scroll to zoom · click a place for what\'s there'));
  body.append(h('div.mv-layout', side, stage));
  const me = () => { const [u, v] = toLocal(g.player.pos.x, g.player.pos.z); return { u, v }; };

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
  const L = (u) => (u + R) / PX;
  const toStage = (u, v) => ({ x: view.x + L(u) * view.base * view.k, y: view.y + L(v) * view.base * view.k });
  const centerOn = (u, v, k = view.k) => { const r = stage.getBoundingClientRect(); view.k = k; const p = toStage(u, v); view.x += r.width / 2 - p.x; view.y += r.height / 2 - p.y; apply(); };
  const zoomAt = (f, cx, cy) => { const r = stage.getBoundingClientRect(); cx ??= r.width / 2; cy ??= r.height / 2; const k0 = view.k; view.k = Math.max(1, Math.min(8, view.k * f)); const q = view.k / k0; view.x = cx - (cx - view.x) * q; view.y = cy - (cy - view.y) * q; apply(); };
  stage.addEventListener('wheel', (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; stage.setPointerCapture?.(e.pointerId); });
  stage.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) stage.classList.add('dragging'); view.x = drag.vx + dx; view.y = drag.vy + dy; apply(); });
  stage.addEventListener('pointerup', () => { stage.classList.remove('dragging'); drag = null; st.fmK = view.k; });

  let selected = st.fmSel || null;
  const select = (pl) => { selected = pl?.id || null; st.fmSel = selected; drawPins(); showDetail(pl); };
  const pct = (u) => `${(L(u) / SIZE) * 100}%`;
  function drawPins() {
    clear(pins);
    for (const pl of all) {
      if (!layers[pl.kind]) continue;
      const Kd = KINDS[pl.kind];
      pins.append(h(`button.mv-pin.sc-pin${selected === pl.id ? '.sel' : ''}`, { style: { left: pct(pl.u), top: pct(pl.v), '--c': Kd.color }, 'aria-label': pl.name, title: pl.name, on: { click: (e) => { e.stopPropagation(); select(pl); } } },
        h('span.mv-pin-in', icon(Kd.icon)), h('span.mv-label', pl.name)));
    }
  }
  function showDetail(pl) {
    clear(detail);
    if (!pl) { detail.append(h('div.mv-empty', icon('pin'), h('p', 'Pick a place to see what\'s there and how far it is. June\'s sleds will run you to the far corners.'))); return; }
    const Kd = KINDS[pl.kind], m = me(), dist = Math.round(Math.hypot(pl.u - m.u, pl.v - m.v));
    detail.append(
      h('div.mv-d-kind', { style: { '--c': Kd.color } }, icon(Kd.icon), Kd.label),
      h('h3.mv-d-name', pl.name),
      h('p.mv-d-desc', pl.desc),
      h('div.mv-d-dist', icon('nav'), dist < 25 ? 'You\'re here' : `${dist} m away`));
  }

  const ctx = canvas.getContext('2d');
  const draw = () => {
    if (!canvas.isConnected) { clearInterval(timer); return; }
    const r = stage.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const sc = view.base * view.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#183a5c'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * view.x, dpr * view.y);
    ctx.imageSmoothingEnabled = view.k < 3;
    ctx.drawImage(baseMap(), 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const X = (u) => view.x + L(u) * sc, Y = (v) => view.y + L(v) * sc, ui = Math.max(1, view.base * Math.min(view.k, 2.4) * 1.3);
    // your holes (and everyone's), little dark circles
    ctx.fillStyle = '#16324c';
    for (const hl of N2?.ice?.mine || []) { const [u, v] = toLocal(hl.x, hl.z); ctx.beginPath(); ctx.arc(X(u), Y(v), 1.6 * ui, 0, Math.PI * 2); ctx.fill(); }
    // other anglers
    for (const rm of g.remotes?.list?.values?.() || []) {
      const p = rm.pos; if (!p || !inNorth(p.x, p.z)) continue;
      const [u, v] = toLocal(p.x, p.z);
      ctx.fillStyle = '#4ac8f0'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(X(u), Y(v), 3 * ui / 2.2 + 1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // you, with an arrow for the way you're facing
    const m = me(), yaw = g.player.yaw || 0;
    ctx.fillStyle = 'rgba(233,185,73,0.3)'; ctx.beginPath(); ctx.arc(X(m.u), Y(m.v), 9 * ui / 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(X(m.u), Y(m.v)); ctx.scale(ui / 2.2, ui / 2.2); ctx.rotate(Math.PI - yaw);
    ctx.fillStyle = '#e9b949'; ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(r.width - 46, r.height - 52); ctx.fillStyle = 'rgba(255,248,230,0.85)'; ctx.strokeStyle = 'rgba(13,31,27,0.6)'; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(5, 0); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#fff8e6'; ctx.font = "800 12px 'Baloo 2', Nunito, sans-serif"; ctx.textAlign = 'center'; ctx.fillText('N', 0, -28); ctx.restore();
  };
  draw();
  const timer = setInterval(draw, 400);
  drawPins();
  showDetail(all.find((p) => p.id === selected) || null);
  requestAnimationFrame(() => { fit(); const m = me(); centerOn(m.u, m.v, st.fmK || 1.6); });
  new ResizeObserver(() => { fit(); apply(); }).observe(stage);
}
export { toWorld };
