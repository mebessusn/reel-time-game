// Shareable catch cards: a polaroid-style PNG of a fish with its name, weight, lake, date and angler,
// ready to save and post anywhere.
import { h } from './dom.js';
import { fishThumb } from './thumbs.js';
import { SPECIES_BY_ID, TIER_INFO, ZONES, tierOf, zoneName } from '../data/species.js';
import { album } from './selfie.js';

function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }

/** Pure-ish: draw the card on a canvas and return a PNG data URL. */
export async function drawCatchCard(c, { angler = 'Angler', label = '', filter = '' } = {}) {
  const sp = SPECIES_BY_ID[c.speciesId];
  const tier = TIER_INFO[tierOf(sp)];
  const W = 600, H = 760;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  // wood frame and paper
  x.fillStyle = '#5e3a1e'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#8a5a32'; x.fillRect(10, 10, W - 20, H - 20);
  x.fillStyle = '#f6ebd3'; x.fillRect(28, 28, W - 56, H - 56);
  // banner
  const bannerCol = c.variant === 'diamond' ? '#3ab0d0' : c.variant === 'gold' ? '#d89a20' : tier.color;
  x.fillStyle = bannerCol; x.fillRect(28, 28, W - 56, 64);
  x.fillStyle = '#fff'; x.font = 'bold 26px "Silkscreen", "Courier New", monospace'; x.textAlign = 'center';
  x.fillText(`${c.variant !== 'normal' ? `${c.variant.toUpperCase()} ` : ''}${tier.name.toUpperCase()} CATCH`, W / 2, 70);
  // picture area with sun rays
  const py = 112, ph = 330;
  const grad = x.createRadialGradient(W / 2, py + ph * 0.6, 10, W / 2, py + ph * 0.6, 300);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, c.variant === 'gold' ? '#f8d880' : c.variant === 'diamond' ? '#a8e8f8' : '#e6d4ae');
  x.fillStyle = grad; x.fillRect(48, py, W - 96, ph);
  x.save(); x.translate(W / 2, py + ph * 0.6); x.globalAlpha = 0.18; x.fillStyle = '#fff';
  for (let i = 0; i < 16; i++) { x.rotate(Math.PI / 8); x.fillRect(0, -6, 320, 12); }
  x.restore();
  const img = await loadImg(fishThumb(c.speciesId, c.variant));
  const iw = 440, ih = iw * (img.height / img.width);
  x.save();
  if (filter) x.filter = filter;
  x.drawImage(img, (W - iw) / 2, py + ph / 2 - ih / 2 + 10, iw, ih);
  x.restore();
  // text
  x.fillStyle = '#3b2a1e'; x.textAlign = 'center';
  x.font = 'bold 34px "Silkscreen", "Courier New", monospace';
  x.fillText(label || sp.name, W / 2, 500, W - 80);
  x.font = 'bold 44px "Nunito", system-ui, sans-serif';
  x.fillStyle = '#c8701a';
  x.fillText(`${c.weight < 10 ? c.weight.toFixed(2) : c.weight.toFixed(1)} lb`, W / 2, 560);
  x.fillStyle = '#6e5640'; x.font = '22px "Nunito", system-ui, sans-serif';
  const when = new Date(c.ts || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  x.fillText(`${zoneName(c.zone) || 'Five Lakes Valley'} · ${when}`, W / 2, 600);
  x.fillText(`Caught by ${angler}`, W / 2, 634);
  // footer logo
  x.fillStyle = '#8a5a32'; x.fillRect(28, H - 92, W - 56, 64);
  x.fillStyle = '#fff4d8'; x.font = 'bold 30px "Silkscreen", "Courier New", monospace';
  x.fillText('REEL TIME', W / 2, H - 50);
  x.fillStyle = '#e84a3a'; x.beginPath(); x.arc(W / 2 + 128, H - 60, 9, 0, Math.PI * 2); x.fill();
  return cv.toDataURL('image/png');
}

export async function saveImage(url, filename) {
  const blob = await (await fetch(url)).blob();
  const dl = await window.claude?.use?.('downloads').catch(() => null);
  if (dl) { try { await dl.save({ filename, data: blob }); return true; } catch (e) { if (e?.code !== 'unavailable') return false; } }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}

/** Show the card with Save / Add to album / Close. */
export async function openCatchCard(game, c) {
  const url = await drawCatchCard(c, { angler: game.profile.name, label: game.traits?.label(c), filter: game.traits?.filter(c) });
  const name = `reel-time-${SPECIES_BY_ID[c.speciesId].id}-${new Date(c.ts || Date.now()).toISOString().slice(0, 10)}.png`;
  const el = h('div.polaroid-card.catch-card', { on: { click: (e) => { if (e.target === el) el.remove(); } } },
    h('img.card-img', { src: url, alt: `Catch card: ${SPECIES_BY_ID[c.speciesId].name}` }),
    h('div.polaroid-actions',
      h('button.btn.green', { on: { click: async () => { const ok = await saveImage(url, name); game.ui.toast(ok ? 'Card saved. Share it anywhere!' : "Couldn't save the card"); game.ext.bump('cardsSaved'); } } }, 'Save card'),
      h('button.btn', { on: { click: () => { album.add({ id: `card${Date.now().toString(36)}`, url, ts: Date.now(), caption: SPECIES_BY_ID[c.speciesId].name }); game.ui.toast('Added to your photo album'); } } }, 'Add to album'),
      h('button.btn.ghost', { on: { click: () => el.remove() } }, 'Close')));
  game.ui.root.append(el);
  return url;
}
