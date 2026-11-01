// The big map (M): a wide panel in the middle of the screen. The valley you've explored, every place
// you've discovered (lakes, landmarks, waystones, shops, homes), other anglers, you, and your waypoint.
// Scroll or +/- to zoom, drag to pan, click a marker for details, right-click (or double-click) to drop a
// waypoint that shows in the world as a beam of light.
import { LAKE_LEVELS, lakeRange } from '../game/spots.js';
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import { baseMap, MAP_LABELS, schoolIcon, treasureX } from './worldmap.js';
import { HALF } from '../world/terrain.js';
import { PLACES, KINDS, MAP_GRID } from '../game/places.js';

const S = 2; // base map px per block
const SIZE = HALF * 2 * S;

export function renderMapView(body, game, sheets) {
  const g = game, st = sheets.state;
  g.sawLakeLevels?.(); // v1.13: every lake's level range is on the map
  st.mapLayers = st.mapLayers || { lake: true, poi: true, waystone: true, vendor: true, home: true, anglers: true };
  const layers = st.mapLayers;
  const places = g.places;

  // ---- side panel
  const side = h('aside.mv-side');
  const detail = h('div.mv-detail');
  const explored = () => { const s = g.ext.d.seen || ''; let n = 0; for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 49) n++; return Math.round((n / (MAP_GRID.N * MAP_GRID.N)) * 100); };
  const layerRow = (key, label, ic, color, countTxt) => h(`label.mv-layer${layers[key] ? '.on' : ''}`,
    h('input', { type: 'checkbox', checked: layers[key], on: { change: (e) => { layers[key] = e.target.checked; e.target.closest('.mv-layer').classList.toggle('on', e.target.checked); drawPins(); } } }),
    h('span.mv-dot', { style: { '--c': color } }, icon(ic)), h('span.mv-lname', label), countTxt ? h('span.mv-count.num', countTxt) : null);
  side.append(
    h('div.mv-explored', h('div.mv-big', `${explored()}%`), h('div.muted', 'of the valley explored')),
    h('div.mv-layers', ...Object.entries(KINDS).map(([k, v]) => { const c = places.count(k); return layerRow(k, v.label, v.icon, v.color, `${c.have}/${c.total}`); }),
      layerRow('anglers', 'Your party', 'users', '#f2c040', null)),
    detail);

  // ---- the map stage
  const stage = h('div.mv-stage', { role: 'application', 'aria-label': 'Map. Drag to pan, scroll to zoom.' });
  const world = h('div.mv-world');
  // v1.8.2: the canvas is drawn at screen resolution for the current zoom (not a small image scaled up by
  // CSS), and the pins are laid out unscaled, so everything stays sharp however far you zoom in
  const canvas = h('canvas.mv-canvas');
  const pins = h('div.mv-pins');
  world.append(pins);
  stage.append(canvas, world);
  const zoomBox = h('div.mv-zoom',
    h('button.btn.ghost.small', { 'aria-label': 'Zoom in', on: { click: () => zoomAt(1.4) } }, icon('plus')),
    h('button.btn.ghost.small', { 'aria-label': 'Zoom out', on: { click: () => zoomAt(1 / 1.4) } }, icon('minus')),
    h('button.btn.ghost.small', { 'aria-label': 'Find me', on: { click: () => centerOn(g.player.pos.x, g.player.pos.z, Math.max(2, view.k)) } }, icon('nav')));
  const hint = h('div.mv-hint', 'Drag to pan · scroll to zoom · right-click to drop a waypoint');
  stage.append(zoomBox, hint);
  body.append(h('div.mv-layout', side, stage));

  // ---- view transform: map px -> stage px
  const view = { k: 1, x: 0, y: 0, base: 1 };
  let redraw = 0;
  const fit = () => { const r = stage.getBoundingClientRect(); view.base = Math.max(r.height, 200) / SIZE; };
  const apply = () => {
    const r = stage.getBoundingClientRect();
    const sz = SIZE * view.base * view.k;
    view.k = Math.max(1, Math.min(7, view.k));
    // keep some map on screen
    view.x = Math.min(r.width * 0.5, Math.max(r.width * 0.5 - sz, view.x));
    view.y = Math.min(r.height * 0.5, Math.max(r.height * 0.5 - sz, view.y));
    world.style.width = world.style.height = `${SIZE * view.base * view.k}px`;
    world.style.transform = `translate(${view.x}px, ${view.y}px)`;
    world.style.setProperty('--ik', '1');
    stage.classList.toggle('zoomed', view.k >= 1.8);
    if (!redraw) redraw = requestAnimationFrame(() => { redraw = 0; draw(); });
  };
  const toStage = (wx, wz) => ({ x: view.x + (wx + HALF) * S * view.base * view.k, y: view.y + (wz + HALF) * S * view.base * view.k });
  const toWorld = (sx, sy) => ({ x: (sx - view.x) / (S * view.base * view.k) - HALF, z: (sy - view.y) / (S * view.base * view.k) - HALF });
  const centerOn = (wx, wz, k = view.k) => { const r = stage.getBoundingClientRect(); view.k = k; const p = toStage(wx, wz); view.x += r.width / 2 - p.x; view.y += r.height / 2 - p.y; apply(); };
  const zoomAt = (f, cx, cy) => { const r = stage.getBoundingClientRect(); cx ??= r.width / 2; cy ??= r.height / 2; const k0 = view.k; view.k = Math.max(1, Math.min(7, view.k * f)); const q = view.k / k0; view.x = cx - (cx - view.x) * q; view.y = cy - (cy - view.y) * q; apply(); };

  stage.addEventListener('wheel', (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, button: e.button }; stage.setPointerCapture?.(e.pointerId); });
  stage.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) { drag.moved = true; stage.classList.add('dragging'); } view.x = drag.vx + dx; view.y = drag.vy + dy; apply(); });
  stage.addEventListener('pointerup', () => { stage.classList.remove('dragging'); drag = null; });
  const dropAt = (e) => { e.preventDefault(); if (e.target.closest('button')) return; const r = stage.getBoundingClientRect(); const w = toWorld(e.clientX - r.left, e.clientY - r.top); setWaypoint({ x: w.x, z: w.z, name: 'Your marker' }); };
  stage.addEventListener('contextmenu', dropAt);
  stage.addEventListener('dblclick', dropAt);

  // ---- waypoint
  const setWaypoint = (wp) => { g.ext.change((d) => { d.waypoint = wp; }); g.waypoint?.sync(); g.audio.sfx('plop'); drawPins(); if (wp) select({ id: 'wp', kind: 'waypoint', name: wp.name, x: wp.x, z: wp.z }); };

  // ---- markers
  let selected = st.mapSel || null;
  const select = (pl) => { selected = pl?.id || null; st.mapSel = selected; drawPins(); showDetail(pl); };
  function drawPins() {
    clear(pins);
    const wp = g.ext.d.waypoint;
    for (const pl of places.list()) {
      if (!layers[pl.kind]) continue;
      const kind = KINDS[pl.kind];
      const b = h(`button.mv-pin.k-${pl.kind}${selected === pl.id ? '.sel' : ''}`, { style: { left: `${((pl.x + HALF) / (HALF * 2)) * 100}%`, top: `${((pl.z + HALF) / (HALF * 2)) * 100}%`, '--c': kind.color }, 'aria-label': pl.name, title: pl.name, on: { click: (e) => { e.stopPropagation(); select(pl); } } },
        h('span.mv-pin-in', icon(kind.icon)), h('span.mv-label', pl.name));
      pins.append(b);
    }
    if (wp) pins.append(h(`button.mv-pin.k-wp${wp.name === 'Treasure X' ? '.k-treasure' : ''}${selected === 'wp' ? '.sel' : ''}`, { style: { left: `${((wp.x + HALF) / (HALF * 2)) * 100}%`, top: `${((wp.z + HALF) / (HALF * 2)) * 100}%`, '--c': '#e9b949' }, 'aria-label': 'Waypoint', on: { click: (e) => { e.stopPropagation(); select({ id: 'wp', kind: 'waypoint', name: wp.name, x: wp.x, z: wp.z }); } } }, wp.name === 'Treasure X' ? h('span.mv-pin-x', '\u2715') : h('span.mv-pin-in', icon('flag')), h('span.mv-label', wp.name)));
  }
  // v1.13: a lake's three levels, ticked once you've reached them
  function lakeLevelsBlock(id) {
    const L = LAKE_LEVELS[id], me = g.profile.level;
    const row = (lv, txt) => h('div', h('b', me >= lv ? '✓' : `Lv ${lv}`), h('span', txt));
    return h('div.mv-d-levels', row(L.base, `Anywhere in the lake${L.base > 1 ? ` (level ${L.base})` : ''}`), row(L.deep.level, `The deep end (level ${L.deep.level})`), row(L.poi.level, `${L.poi.name.replace(/^the /, 'The ')}, the landmark (level ${L.poi.level}${L.poi.hint ? `, bites ${L.poi.hint}` : ''})`));
  }
  function showDetail(pl) {
    clear(detail);
    if (!pl) { detail.append(h('div.mv-empty', icon('pin'), h('p', 'Pick a marker to see what’s there. Right-click the map to drop a waypoint.'))); return; }
    const me = g.player.pos, dist = Math.round(Math.hypot(pl.x - me.x, pl.z - me.z));
    const kind = pl.kind === 'waypoint' ? { label: 'Waypoint', icon: 'flag', color: '#e9b949' } : KINDS[pl.kind];
    const acts = [];
    if (pl.kind === 'waystone' && g.waystones.lit.has(pl.waystone) && g.waystones.near(3.5)) acts.push(h('button.btn.blue', { on: { click: () => sheets.confirmTravel({ id: pl.waystone, name: pl.name.replace(' waystone', '') }) } }, icon('compass'), 'Travel here')); // v1.9.9: only from a waystone
    if (pl.enter && dist < 6) acts.push(h('button.btn.green', { on: { click: () => { sheets.close(); (g.home.enter || g.home.open).call(g.home); } } }, icon('home'), 'Go inside'));
    if (pl.kind === 'waypoint') acts.push(h('button.btn.ghost.mv-clear', { on: { click: () => { setWaypoint(null); select(null); } } }, icon('close'), 'Clear waypoint'));
    else acts.push(h('button.btn.primary', { on: { click: () => setWaypoint({ x: pl.x, z: pl.z, name: pl.name }) } }, icon('flag'), 'Set as waypoint'));
    detail.append(
      h('div.mv-d-kind', { style: { '--c': kind.color } }, icon(kind.icon), kind.label),
      h('h3.mv-d-name', pl.name),
      pl.desc ? h('p.mv-d-desc', pl.desc) : null,
      LAKE_LEVELS[pl.id] ? lakeLevelsBlock(pl.id) : null,
      h('div.mv-d-dist', icon('nav'), dist < 4 ? 'You are here' : `${dist} m away`),
      h('div.mv-d-acts', acts));
  }

  // ---- drawing (terrain, fog, labels, anglers, you)
  const ctx = canvas.getContext('2d');
  const P = (v) => (v + HALF) * S;
  const { N, CELL } = MAP_GRID;
  const fog = document.createElement('canvas'); fog.width = fog.height = N;
  const fogCtx = fog.getContext('2d');
  let fogKey = null;
  const draw = () => {
    if (!canvas.isConnected) { clearInterval(timer); return; }
    const r = stage.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const sc = view.base * view.k; // screen px per map px
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // the terrain, crisp (each map pixel a sharp square), in map px
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * view.x, dpr * view.y);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(baseMap(), 0, 0);
    // fog over what you haven't explored yet
    // (one pixel per explored cell, scaled up smoothly, so the edges are soft and there are no seams)
    const seen = g.ext.d.seen || '';
    if (seen !== fogKey) {
      fogKey = seen;
      const img = fogCtx.createImageData(N, N);
      for (let i = 0; i < N * N; i++) { img.data[i * 4] = 13; img.data[i * 4 + 1] = 31; img.data[i * 4 + 2] = 27; img.data[i * 4 + 3] = seen.charCodeAt(i) === 49 ? 0 : 215; }
      fogCtx.putImageData(img, 0, 0);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fog, 0, 0, N, N, 0, 0, N * CELL * S, N * CELL * S);
    // everything else is drawn in screen px at a readable size, so text and icons are always sharp
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const X = (v) => view.x + P(v) * sc, Y = (v) => view.y + P(v) * sc;
    const ui = view.base * Math.min(view.k, 2.2); // icon scale: grows a little as you zoom, then holds
    // lake names for lakes you've found
    const fs = Math.round(13 * view.base * Math.min(view.k, 1.9));
    ctx.font = `800 ${fs}px 'Baloo 2', Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const pl of places.list().filter((x) => x.kind === 'lake')) {
      const lx = X(pl.x), ly = Y(pl.z) + 22 * ui;
      ctx.font = `800 ${fs}px 'Baloo 2', Nunito, sans-serif`;
      ctx.lineWidth = Math.max(3, fs * 0.28); ctx.strokeStyle = 'rgba(13,31,27,0.85)'; ctx.strokeText(pl.name, lx, ly); ctx.fillStyle = '#f8f7f1'; ctx.fillText(pl.name, lx, ly);
      // v1.13: the lake's level range under its name (gold once you can fish all of it)
      if (LAKE_LEVELS[pl.id]) {
        const L = LAKE_LEVELS[pl.id], fs2 = Math.round(fs * 0.78), t = `Lv ${lakeRange(pl.id)}`;
        ctx.font = `800 ${fs2}px Nunito, sans-serif`; ctx.lineWidth = Math.max(3, fs2 * 0.3);
        ctx.strokeText(t, lx, ly + fs * 0.95); ctx.fillStyle = g.profile.level >= L.poi.level ? '#e9b949' : g.profile.level >= L.base ? '#9fe0b0' : '#f4b8a8'; ctx.fillText(t, lx, ly + fs * 0.95);
      }
    }
    void MAP_LABELS;
    // feeding schools
    for (const p of g.swirls?.pools || []) schoolIcon(ctx, X(p.x), Y(p.z), 1.3 * ui);
    // a treasure map's X (v1.8.2), while it's marked
    { const tm = g.ext?.d?.treasure; if (tm?.active && tm.markedUntil > Date.now()) treasureX(ctx, X(tm.x), Y(tm.z), 1.4 * ui); }
    // other anglers
    // v1.11: only your party shows on the map, each in their party colour with their name
    if (layers.anglers) for (const rr of g.remotes?.list?.values?.() || []) {
      const s2 = rr.peer.state; if (!s2 || !g.party?.has(rr.peer.meta?.id)) continue;
      const px = X(rr.pos.x), py = Y(rr.pos.z);
      ctx.fillStyle = g.party.color(rr.peer.meta.id); ctx.strokeStyle = '#132b26'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py - 7 * ui); ctx.lineTo(px + 6 * ui, py); ctx.lineTo(px, py + 7 * ui); ctx.lineTo(px - 6 * ui, py); ctx.closePath(); ctx.fill(); ctx.stroke();
      const nm = String(rr.peer.meta?.name || '').slice(0, 20), fs2 = Math.round(11 * ui);
      ctx.font = `800 ${fs2}px 'Baloo 2', Nunito, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(13,31,27,0.85)'; ctx.strokeText(nm, px, py - 11 * ui); ctx.fillStyle = '#fff'; ctx.fillText(nm, px, py - 11 * ui);
    }
    // you: an arrow with a soft halo
    const me = g.player.pos;
    ctx.fillStyle = 'rgba(233,185,73,0.25)'; ctx.beginPath(); ctx.arc(X(me.x), Y(me.z), 11 * ui, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(X(me.x), Y(me.z)); ctx.scale(ui, ui); ctx.rotate(-g.player.yaw + Math.PI);
    ctx.fillStyle = '#e9b949'; ctx.strokeStyle = '#132b26'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  };
  draw();
  const timer = setInterval(draw, 400);
  drawPins();
  showDetail(selected === 'wp' && g.ext.d.waypoint ? { id: 'wp', kind: 'waypoint', ...g.ext.d.waypoint } : PLACES.find((p) => p.id === selected && places.found(p)) || null);
  requestAnimationFrame(() => { fit(); centerOn(g.player.pos.x, g.player.pos.z, st.mapK || 1.6); });
  new ResizeObserver(() => { fit(); apply(); }).observe(stage);
  stage.addEventListener('pointerup', () => { st.mapK = view.k; });
}
