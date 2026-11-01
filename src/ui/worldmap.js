// World map (M): a pixel-art top-down render of Five Lakes Valley with live markers.
import { HALF, heightAt, LAKES, TRAILS, JETTIES, CLEARINGS, trailDist, valleyWater, DOCK } from '../world/terrain.js';
import { HUTS } from '../world/props.js';
import { WAYSTONES } from '../game/waystones.js';

const S = 2; // canvas px per block
let base = null;

export function baseMap() {
  if (base) return base;
  const N = HALF * 2;
  const c = document.createElement('canvas');
  c.width = c.height = N * S;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  for (let z = -HALF; z < HALF; z++) for (let x = -HALF; x < HALF; x++) {
    const h = heightAt(x, z);
    let col;
    if (h <= 0) col = h >= -1 ? [96, 190, 200] : h >= -3 ? [58, 150, 182] : h >= -6 ? [36, 112, 150] : [22, 74, 104];
    else if (h <= 4 && trailDist(x + 0.5, z + 0.5) < 0.95) col = [176, 128, 80];
    else if (h === 1) col = [232, 212, 150];
    else if (h >= 12) col = [240, 244, 248];
    else if (h >= 9) col = [138, 134, 128];
    else if (h >= 6) col = valleyWater(x, z).zone === 'quarry' ? [130, 126, 120] : [86, 140, 66];
    else col = (x * 7 + z * 13) % 11 === 0 ? [98, 166, 70] : [110, 178, 76];
    // hill shading from the north-west
    if (h > 0) { const d = (heightAt(x - 1, z - 1) - h) * -0.07; col = col.map((v) => v * (1 + Math.max(-0.25, Math.min(0.25, d)))); }
    const i = ((z + HALF) * N + (x + HALF)) * 4;
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
  }
  const small = document.createElement('canvas');
  small.width = small.height = N;
  small.getContext('2d').putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; // soft edges, like the smooth world
  g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, N * S, N * S);
  // docks, jetties and buildings
  g.fillStyle = '#8a5a32';
  const P = (x) => (x + HALF) * S;
  g.fillRect(P(DOCK.x0), P(DOCK.z0), (DOCK.x1 + 1 - DOCK.x0) * S, (DOCK.z1 + 1 - DOCK.z0) * S);
  for (const j of JETTIES) g.fillRect(P(j.x0), P(j.z0), (j.x1 - j.x0) * S, (j.z1 - j.z0) * S);
  g.fillStyle = '#c4603c';
  for (const hut of HUTS) g.fillRect(P(hut.x) - hut.w, P(hut.z) - hut.d, hut.w * S, hut.d * S);
  g.fillRect(P(-14.5), P(37), 7 * S, 6 * S); // Gus's cabin
  base = c;
  return base;
}

const LABELS = [
  ['Cozy Cove', 0, -2], ['Frostpine Lake', -72, -70], ['Lilymarsh', 66, 82], ['Fern Pond', -76, 74], ['Old Quarry', 80, -94],
  ['Willow River', 74, 26], ['Pinewood Lodge', 0, -110 + 3], ["Gus's", -11, 34],
];

export function renderWorldMap(container, game, { onWaystone } = {}) {
  const N = HALF * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N * S;
  canvas.className = 'world-map';
  container.append(canvas);
  const g = canvas.getContext('2d');
  const P = (v) => (v + HALF) * S;
  const draw = () => {
    if (!canvas.isConnected) { clearInterval(timer); return; }
    g.imageSmoothingEnabled = false;
    g.drawImage(baseMap(), 0, 0);
    g.font = "800 12px 'Baloo 2', Nunito, system-ui, sans-serif";
    g.textAlign = 'center';
    for (const [t, x, z] of LABELS) {
      g.lineWidth = 3; g.strokeStyle = 'rgba(13,31,27,0.85)'; g.strokeText(t, P(x), P(z)); g.fillStyle = '#f8f7f1'; g.fillText(t, P(x), P(z));
    }
    // waystones: lit ones glow and can be clicked to travel
    const lit = game.waystones?.lit || new Set();
    for (const w of WAYSTONES) {
      const x = P(w.at.x), z = P(w.at.z), on = lit.has(w.id);
      g.save(); g.translate(x, z); g.rotate(Math.PI / 4);
      g.fillStyle = on ? '#7cc3c2' : '#8f9a95'; g.strokeStyle = on ? '#f8f7f1' : 'rgba(13,31,27,0.7)'; g.lineWidth = 1.5;
      if (on) { g.shadowColor = '#7cc3c2'; g.shadowBlur = 8; }
      g.fillRect(-4, -4, 8, 8); g.strokeRect(-4, -4, 8, 8);
      g.restore();
    }
    // feeding schools
    for (const p of game.swirls?.pools || []) {
      schoolIcon(g, P(p.x), P(p.z));
    }
    // a treasure map's X (v1.8.2), while it's marked
    { const tm = game.ext?.d?.treasure; if (tm?.active && tm.markedUntil > Date.now()) treasureX(g, P(tm.x), P(tm.z)); }
    // other anglers
    for (const r of game.remotes?.list?.values?.() || []) {
      const s = r.peer.state; if (!s || !game.party?.has(r.peer.meta?.id)) continue; // v1.11: your party only
      g.fillStyle = game.party.color(r.peer.meta.id); g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(P(s.x), P(s.z), 3.5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    // you
    const me = game.player.pos;
    g.save(); g.translate(P(me.x), P(me.z)); g.rotate(-game.player.yaw + Math.PI);
    g.fillStyle = '#f2c040'; g.strokeStyle = '#3b2a1e'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2.5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke();
    g.restore();
  };
  draw();
  const timer = setInterval(draw, 400);
  enableZoom(container, canvas, game, (wx, wz) => {
    const lit = game.waystones?.lit || new Set();
    let best = null, bd = 6;
    for (const w of WAYSTONES) { const d = Math.hypot(w.at.x - wx, w.at.z - wz); if (d < bd) { best = w; bd = d; } }
    if (best && onWaystone) onWaystone(best, lit.has(best.id));
  });
  return canvas;
}

// Zoom (wheel, buttons, pinch-free +/-) and drag-to-pan on the map; a click without dragging picks a spot.
function enableZoom(wrap, canvas, game, onPick) {
  const N = HALF * 2 * S;
  const st = { k: 1, x: 0, y: 0 };
  const apply = () => {
    const W = wrap.clientWidth || 1, base = W / N;
    st.k = Math.max(1, Math.min(6, st.k));
    const maxX = 0, minX = W - W * st.k; // content width at this zoom is W * k
    st.x = Math.min(maxX, Math.max(minX, st.x)); st.y = Math.min(0, Math.max(W - W * st.k, st.y));
    canvas.style.transform = `translate(${st.x}px, ${st.y}px) scale(${st.k})`;
    wrap.dataset.zoom = st.k.toFixed(2);
    void base;
  };
  const zoomAt = (f, cx, cy) => { const k0 = st.k; st.k = Math.max(1, Math.min(6, st.k * f)); const r = st.k / k0; st.x = cx - (cx - st.x) * r; st.y = cy - (cy - st.y) * r; apply(); };
  const center = (wx, wz, k = st.k) => { const W = wrap.clientWidth; st.k = k; const px = ((wx + HALF) * S / N) * W * st.k, py = ((wz + HALF) * S / N) * W * st.k; st.x = W / 2 - px; st.y = W / 2 - py; apply(); };
  wrap.addEventListener('wheel', (e) => { e.preventDefault(); const r = wrap.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let drag = null;
  wrap.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; drag = { x: e.clientX, y: e.clientY, sx: st.x, sy: st.y, moved: false }; wrap.setPointerCapture?.(e.pointerId); });
  wrap.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) drag.moved = true; st.x = drag.sx + dx; st.y = drag.sy + dy; apply(); });
  wrap.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved) {
      const r = wrap.getBoundingClientRect(), W = wrap.clientWidth;
      const px = (e.clientX - r.left - st.x) / (W * st.k), py = (e.clientY - r.top - st.y) / (W * st.k);
      onPick(px * HALF * 2 - HALF, py * HALF * 2 - HALF);
    }
    drag = null;
  });
  const btn = (label, ic, fn) => { const b = document.createElement('button'); b.className = 'btn ghost small'; b.setAttribute('aria-label', label); b.title = label; b.innerHTML = ic; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const svg = (d) => `<svg viewBox="0 0 24 24" class="ico" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">${d}</svg>`;
  const zoom = document.createElement('div');
  zoom.className = 'map-zoom';
  zoom.append(
    btn('Zoom in', svg('<path d="M12 5v14M5 12h14"/>'), () => { const W = wrap.clientWidth; zoomAt(1.5, W / 2, W / 2); }),
    btn('Zoom out', svg('<path d="M5 12h14"/>'), () => { const W = wrap.clientWidth; zoomAt(1 / 1.5, W / 2, W / 2); }),
    btn('Find me', svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'), () => center(game.player.pos.x, game.player.pos.z, Math.max(2.5, st.k))));
  wrap.append(zoom);
  requestAnimationFrame(apply);
}

export { LABELS as MAP_LABELS, LAKES, TRAILS, CLEARINGS };

/** A leaping fish and two splash drops: the map mark for a feeding school. */
export function schoolIcon(g, x, y, k = 1) {
  g.save(); g.translate(x, y); g.scale(k, k);
  g.fillStyle = '#5fb4cf'; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(0, 0, 5.5, 3, -0.35, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-4.5, 1.6); g.lineTo(-8.5, -1.4); g.lineTo(-8, 4.2); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#e8f6ff';
  for (const [dx, dy] of [[5, 5], [8, 2]]) { g.beginPath(); g.arc(dx, dy, 1.4, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

/** v1.8.2: the red X for a treasure spot on the map canvases. */
export function treasureX(g, x, y, k = 1) {
  g.save(); g.translate(x, y); g.scale(k, k);
  g.lineCap = 'round';
  g.strokeStyle = '#ffffff'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(-6, -6); g.lineTo(6, 6); g.moveTo(6, -6); g.lineTo(-6, 6); g.stroke();
  g.strokeStyle = '#c8281c'; g.lineWidth = 3.5;
  g.beginPath(); g.moveTo(-6, -6); g.lineTo(6, 6); g.moveTo(6, -6); g.lineTo(-6, 6); g.stroke();
  g.restore();
}
