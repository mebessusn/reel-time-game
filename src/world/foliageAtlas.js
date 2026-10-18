// The foliage atlas (v1.13.13): one 1024 x 1024 texture, painted in code with the 2D canvas when the game loads, that
// every plant samples: bark, leaf clusters (each leaf drawn with its own shape, shade and midrib), pine needle sprays,
// fern fronds, grass blades, reeds, flowers, willow strands, mushroom caps, lily pads and petals. Transparent where a
// card has no leaf, so the cards' outlines are the leaves themselves (alphaTest in the material).
// Card UVs: u across (0 left .. 1 right), v from the card's base (0) to its tip (1); a region's tip is its top row.
import * as THREE from 'three';

export const FOLIAGE_ATLAS = 1024;
export const REGIONS = {
  bark_pine: [0, 0, 64, 256], bark_oak: [64, 0, 64, 256], bark_birch: [128, 0, 64, 256],
  stem: [192, 0, 16, 64], cattail: [208, 0, 16, 64], shroom_stem: [224, 0, 32, 64], pollen: [224, 64, 32, 32],
  needles: [256, 0, 256, 256], needles_snow: [512, 0, 256, 256], leaf_oak: [768, 0, 256, 256],
  leaf_autumn: [0, 256, 256, 256], leaf_apple: [256, 256, 256, 256], leaf_birch: [512, 256, 256, 256], leaf_bush: [768, 256, 256, 256],
  leaf_bush_red: [0, 512, 128, 128], leaf_bush_purple: [128, 512, 128, 128], leaf_bush_orange: [256, 512, 128, 128],
  leaf_willow: [384, 512, 128, 256], leaf_willow_top: [512, 512, 128, 128], fern: [640, 512, 128, 256],
  grass: [768, 512, 256, 128], reeds: [768, 640, 256, 128],
  flower_yellow: [0, 768, 128, 128], flower_pink: [128, 768, 128, 128], flower_violet: [256, 768, 128, 128], flower_white: [384, 768, 128, 128], flower_orange: [512, 768, 128, 128],
  shroom_red: [640, 768, 64, 64], shroom_brown: [704, 768, 64, 64], lilypad: [768, 768, 128, 128], petal: [896, 768, 64, 64],
};

let rnd = mulberry(1);
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = (a, b) => a + (b - a) * rnd();
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }

/** Draw one leaf: a pointed ellipse from (x, y) along angle a, length L, width W, with a paler midrib. */
function leaf(ctx, x, y, a, L, W, fill, rib) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(L * 0.35, -W, L, 0); ctx.quadraticCurveTo(L * 0.35, W, 0, 0);
  ctx.fillStyle = fill; ctx.fill();
  if (rib) { ctx.strokeStyle = rib; ctx.lineWidth = Math.max(0.6, W * 0.12); ctx.beginPath(); ctx.moveTo(L * 0.05, 0); ctx.lineTo(L * 0.85, 0); ctx.stroke(); }
  ctx.restore();
}
/** A lobed (oak) leaf: a few bumps down each side. */
function oakLeaf(ctx, x, y, a, L, W, fill, rib) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(0, 0);
  const lobes = 4;
  for (let i = 1; i <= lobes; i++) { const t = i / lobes, w = W * Math.sin(t * Math.PI) * 1.1 + W * 0.2; ctx.quadraticCurveTo(L * (t - 0.12), -w * 1.25, L * t, -w * 0.55); }
  for (let i = lobes; i >= 1; i--) { const t = i / lobes, w = W * Math.sin(t * Math.PI) * 1.1 + W * 0.2; ctx.quadraticCurveTo(L * (t - 0.12), w * 1.25, L * (t - 1 / lobes), w * 0.55 * (i > 1 ? 1 : 0)); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (rib) { ctx.strokeStyle = rib; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.85, 0); ctx.stroke(); }
  ctx.restore();
}

/** A cluster of leaves on a card: twigs from the base, then leaves filling a rounded blob, darker at the back. */
function cluster(ctx, [x0, y0, w, h], { hues, sat, light, n, size, shape = 'oval', fruit = null, berries = null, twig = '#5a4028' }) {
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  const cx = x0 + w / 2, cy = y0 + h * 0.47, rx = w * 0.34, ry = h * 0.33;
  ctx.strokeStyle = twig; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) { // twigs fanning up from the base
    ctx.lineWidth = R(1.2, 2.6) * w / 256;
    ctx.beginPath(); ctx.moveTo(cx + R(-4, 4), y0 + h); ctx.quadraticCurveTo(cx + R(-rx, rx) * 0.4, cy + ry * 0.4, cx + R(-rx, rx) * 0.8, cy + R(-ry, ry) * 0.6); ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    const layer = i / n; // back to front
    const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd());
    const x = cx + Math.cos(ang) * rx * rr, y = cy + Math.sin(ang) * ry * rr;
    const L = size * R(0.8, 1.2) * w / 256, W = L * (shape === 'birch' ? 0.42 : shape === 'oak' ? 0.36 : 0.32);
    const l = light + 14 + (layer - 0.5) * 18 + R(-5, 5) - rr * 3;
    const fill = hsl(pick(hues) + R(-6, 6), sat + R(-8, 8), l), rib = hsl(pick(hues), sat - 10, l + 12, 0.8);
    const a = ang + R(-1.2, 1.2);
    if (shape === 'oak') oakLeaf(ctx, x, y, a, L, W, fill, rib); else leaf(ctx, x, y, a, L, W, fill, rib);
  }
  if (fruit) for (let i = 0; i < 7; i++) { // apples: round, a shine, a stalk
    const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.8;
    const x = cx + Math.cos(ang) * rx * rr, y = cy + Math.sin(ang) * ry * rr, r = R(9, 13) * w / 256;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#ff8a6a'); g.addColorStop(0.5, fruit); g.addColorStop(1, '#7a1410');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - r * 0.8); ctx.lineTo(x + 2, y - r * 1.3); ctx.stroke();
  }
  if (berries) for (let i = 0; i < 26; i++) {
    const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.85;
    const x = cx + Math.cos(ang) * rx * rr, y = cy + Math.sin(ang) * ry * rr, r = R(3.5, 5.5) * w / 128;
    ctx.fillStyle = berries; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function bark(ctx, [x0, y0, w, h], base, furrow, light, kind) {
  ctx.fillStyle = base; ctx.fillRect(x0, y0, w, h);
  if (kind === 'birch') {
    for (let i = 0; i < 70; i++) { // dark lenticels: short horizontal dashes
      const y = y0 + rnd() * h, x = x0 + rnd() * w, L = R(4, 16);
      ctx.fillStyle = `rgba(30,28,26,${R(0.5, 0.9)})`; ctx.fillRect(x, y, L, R(1, 2.5));
    }
    for (let i = 0; i < 9; i++) { // black scars
      const y = y0 + rnd() * h, x = x0 + rnd() * w;
      ctx.fillStyle = 'rgba(24,22,20,0.85)'; ctx.beginPath(); ctx.ellipse(x, y, R(4, 9), R(2, 5), 0, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(200,190,170,${R(0.2, 0.5)})`; ctx.fillRect(x0 + rnd() * w, y0 + rnd() * h, R(6, 20), 1); }
    return;
  }
  for (let i = 0; i < 40; i++) { // furrows running up the trunk, wandering a little
    const x = x0 + rnd() * w;
    ctx.strokeStyle = furrow; ctx.lineWidth = R(1.5, 3.5);
    ctx.beginPath(); ctx.moveTo(x, y0 + h);
    let px = x;
    for (let y = y0 + h; y > y0; y -= 16) { px += R(-2.5, 2.5); ctx.lineTo(px, y); }
    ctx.stroke();
  }
  for (let i = 0; i < 60; i++) { ctx.fillStyle = light; ctx.fillRect(x0 + rnd() * w, y0 + rnd() * h, R(2, 5), R(4, 14)); } // ridges catching light
  if (kind === 'pine') for (let i = 0; i < 26; i++) { ctx.fillStyle = 'rgba(150,80,50,0.45)'; ctx.fillRect(x0 + rnd() * w, y0 + rnd() * h, R(6, 14), R(8, 20)); } // flaky red plates
}

function needleSpray(ctx, [x0, y0, w, h], snow) {
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  const cx = x0 + w / 2;
  const width = (v) => w * 0.44 * Math.sin(Math.min(1, v * 1.1) * Math.PI) ** 0.6; // wide in the middle, narrow at the trunk and tip
  ctx.lineCap = 'round';
  // a soft green backing in the spray's shape (so it stays solid when far away), ragged at the edge
  ctx.fillStyle = hsl(142, 34, 25);
  ctx.beginPath(); ctx.moveTo(cx, y0 + h);
  for (let i = 0; i <= 24; i++) { const v = i / 24; ctx.lineTo(cx + width(v) * 0.82 * (0.9 + 0.1 * Math.sin(i * 2.7)), y0 + h * (1 - v)); }
  for (let i = 24; i >= 0; i--) { const v = i / 24; ctx.lineTo(cx - width(v) * 0.82 * (0.9 + 0.1 * Math.cos(i * 2.3)), y0 + h * (1 - v)); }
  ctx.fill();
  ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx, y0 + h); ctx.lineTo(cx, y0 + h * 0.04); ctx.stroke();
  const shoots = [[cx, y0 + h, cx, y0 + h * 0.04]];
  for (let i = 1; i < 11; i++) {
    const v = i / 11, y = y0 + h * (1 - v), half = width(v);
    for (const s of [-1, 1]) shoots.push([cx, y, cx + s * half * 0.9, y - h * 0.07]);
  }
  ctx.lineWidth = 2;
  for (const [ax, ay, bx, by] of shoots.slice(1)) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
  // needles: thick strokes along every shoot, darker underneath, fresh pale-green growth at the tips
  for (const [ax, ay, bx, by] of shoots) {
    const n = 22, dir = Math.atan2(by - ay, bx - ax);
    for (let i = 0; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      for (const s of [-1, 1]) {
        const a = dir + s * R(0.5, 1.0), L = R(11, 18) * (1 - t * 0.3);
        ctx.strokeStyle = hsl(R(128, 150), R(34, 46), R(28, 38) + t * 16); ctx.lineWidth = R(2.4, 3.4);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
      }
    }
  }
  if (snow) for (let i = 0; i < 55; i++) { // snow lying on the spray
    const v = rnd(), y = y0 + h * (1 - v), x = cx + R(-1, 1) * width(v) * 0.75;
    const rr = R(7, 15), g = ctx.createRadialGradient(x, y, 1, x, y, rr);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.75, 'rgba(238,246,255,0.95)'); g.addColorStop(1, 'rgba(238,246,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function blades(ctx, [x0, y0, w, h], { n, hue, tall = 1, heads = false }) {
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  for (let i = 0; i < n; i++) {
    const x = x0 + w * (0.08 + 0.84 * rnd()), top = y0 + h * (1 - tall * R(0.55, 0.98)), lean = R(-0.25, 0.25) * w;
    const base = R(2.5, 5) * (w / 256), l = R(34, 50);
    const g = ctx.createLinearGradient(0, y0 + h, 0, top);
    g.addColorStop(0, hsl(hue + R(-8, 8), 40, l * 0.75)); g.addColorStop(1, hsl(hue + 10 + R(-8, 8), 48, l + 16));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - base, y0 + h); ctx.quadraticCurveTo(x + lean * 0.4, (top + y0 + h) / 2, x + lean, top); ctx.quadraticCurveTo(x + lean * 0.4 + base * 0.6, (top + y0 + h) / 2, x + base, y0 + h); ctx.fill();
    if (heads && rnd() < 0.35) { ctx.fillStyle = hsl(40, 35, R(55, 70)); ctx.beginPath(); ctx.ellipse(x + lean, top + 6, 3, 9, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

function frond(ctx, [x0, y0, w, h]) {
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  const cx = x0 + w / 2;
  ctx.strokeStyle = '#3d6a26'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, y0 + h); ctx.lineTo(cx, y0 + 2); ctx.stroke();
  const pairs = 18;
  for (let i = 1; i < pairs; i++) {
    const v = i / pairs, y = y0 + h * (1 - v);
    const L = w * 0.46 * Math.sin(Math.min(1, v * 1.1) * Math.PI) ** 0.6 * (1 - v * 0.2);
    for (const s of [-1, 1]) {
      // each pinna: a row of little lobes along a short stalk
      const a = s > 0 ? -0.45 : Math.PI + 0.45;
      const lobes = Math.max(3, Math.round(L / 6));
      for (let k = 0; k < lobes; k++) {
        const t = (k + 0.5) / lobes, px = cx + Math.cos(a) * L * t, py = y + Math.sin(a) * L * t;
        const sz = (1 - t * 0.6) * 6 * (w / 128);
        ctx.fillStyle = hsl(R(95, 110), R(45, 55), 30 + v * 18 + R(-3, 3));
        ctx.beginPath(); ctx.ellipse(px, py, sz, sz * 0.62, a, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}

function flowerPatch(ctx, [x0, y0, w, h], petal, centre) {
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  blades(ctx, [x0, y0 + h * 0.4, w, h * 0.6], { n: 12, hue: 96, tall: 1 });
  for (let i = 0; i < 7; i++) {
    const x = x0 + w * R(0.15, 0.85), y = y0 + h * R(0.12, 0.42), r = R(9, 13) * w / 128;
    ctx.strokeStyle = '#3f6a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + R(-6, 6), y0 + h); ctx.stroke();
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.fillStyle = petal; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.6, r * 0.35, a, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = centre; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Paint the whole atlas (about 0.1-0.2 s, once). Returns a CanvasTexture, or null outside a browser. */
export function paintFoliageAtlas() {
  if (typeof document === 'undefined') return null;
  rnd = mulberry(1307);
  const S = FOLIAGE_ATLAS, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const G = REGIONS;
  bark(ctx, G.bark_pine, '#5a3a26', 'rgba(30,18,10,0.7)', 'rgba(140,96,64,0.35)', 'pine');
  bark(ctx, G.bark_oak, '#5e4a36', 'rgba(32,24,16,0.75)', 'rgba(150,130,104,0.3)', 'oak');
  bark(ctx, G.bark_birch, '#ece6da', null, null, 'birch');
  ctx.fillStyle = '#5a7a32'; ctx.fillRect(...G.stem);
  { const [x, y, w, h] = G.cattail; const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#3a2414'); g.addColorStop(0.5, '#6a4426'); g.addColorStop(1, '#3a2414'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); }
  { const [x, y, w, h] = G.shroom_stem; ctx.fillStyle = '#efe6d4'; ctx.fillRect(x, y, w, h); for (let i = 0; i < 20; i++) { ctx.fillStyle = 'rgba(160,140,110,0.3)'; ctx.fillRect(x + rnd() * w, y + rnd() * h, 1, R(4, 10)); } }
  { const [x, y, w, h] = G.pollen; ctx.fillStyle = '#f4c838'; ctx.fillRect(x, y, w, h); }
  needleSpray(ctx, G.needles, false);
  needleSpray(ctx, G.needles_snow, true);
  cluster(ctx, G.leaf_oak, { hues: [92, 100, 108], sat: 46, light: 33, n: 260, size: 34, shape: 'oak' });
  cluster(ctx, G.leaf_autumn, { hues: [14, 26, 36, 46], sat: 82, light: 50, n: 260, size: 34, shape: 'oval' });
  cluster(ctx, G.leaf_apple, { hues: [96, 104], sat: 45, light: 32, n: 230, size: 30, fruit: '#d8321e' });
  cluster(ctx, G.leaf_birch, { hues: [72, 80, 88], sat: 55, light: 40, n: 300, size: 22, shape: 'birch' });
  cluster(ctx, G.leaf_bush, { hues: [100, 112, 124], sat: 42, light: 28, n: 320, size: 24 });
  cluster(ctx, G.leaf_bush_red, { hues: [104, 116], sat: 42, light: 28, n: 160, size: 24, berries: '#d02a2a' });
  cluster(ctx, G.leaf_bush_purple, { hues: [104, 116], sat: 42, light: 28, n: 160, size: 24, berries: '#6a2a8a' });
  cluster(ctx, G.leaf_bush_orange, { hues: [104, 116], sat: 42, light: 28, n: 160, size: 24, berries: '#e8862a' });
  { // willow: long hanging strands with narrow leaves, thinning toward the bottom
    const [x0, y0, w, h] = G.leaf_willow;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    for (let i = 0; i < 26; i++) {
      const x = x0 + w * R(0.05, 0.95), len = h * R(0.6, 1.0);
      ctx.strokeStyle = '#5a5a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + R(-4, 4), y0 + len); ctx.stroke();
      for (let y = y0 + 4; y < y0 + len; y += R(5, 9)) leaf(ctx, x + R(-2, 2), y, Math.PI / 2 + R(-0.6, 0.6), R(10, 16), 2.4, hsl(R(70, 90), 45, R(30, 46)), null);
    }
    ctx.restore();
  }
  cluster(ctx, G.leaf_willow_top, { hues: [74, 84], sat: 45, light: 36, n: 150, size: 22, shape: 'birch' });
  frond(ctx, G.fern);
  blades(ctx, G.grass, { n: 70, hue: 88, tall: 1 });
  blades(ctx, G.reeds, { n: 34, hue: 78, tall: 1, heads: true });
  flowerPatch(ctx, G.flower_yellow, '#f6d23a', '#a8641a');
  flowerPatch(ctx, G.flower_pink, '#f48aaa', '#f6d23a');
  flowerPatch(ctx, G.flower_violet, '#a782e6', '#f6e05a');
  flowerPatch(ctx, G.flower_white, '#fbfaf2', '#f2c22e');
  flowerPatch(ctx, G.flower_orange, '#f39a3a', '#7a3a10');
  { // mushroom caps: v runs from the rim (bottom of the region) to the crown (top)
    for (const [key, base, spot] of [['shroom_red', '#c8281e', '#fbf6ea'], ['shroom_brown', '#8a5a34', '#c8a070']]) {
      const [x, y, w, h] = G[key];
      const g = ctx.createLinearGradient(0, y + h, 0, y); g.addColorStop(0, '#efe0c8'); g.addColorStop(0.15, base); g.addColorStop(1, base); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      for (let i = 0; i < 16; i++) { ctx.fillStyle = spot; ctx.beginPath(); ctx.ellipse(x + rnd() * w, y + R(0.05, 0.75) * h, R(2, 4), R(1.5, 3), 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  { // lily pad: radial veins from the centre, a paler rim, a blush of red at the edge
    const [x, y, w, h] = G.lilypad, cx = x + w / 2, cy = y + h / 2;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, w / 2); g.addColorStop(0, '#5f9a3e'); g.addColorStop(0.85, '#3f7a2a'); g.addColorStop(1, '#8a5a3a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(170,220,120,0.55)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + Math.cos(a + 0.1) * w * 0.25, cy + Math.sin(a + 0.1) * h * 0.25, cx + Math.cos(a) * w * 0.48, cy + Math.sin(a) * h * 0.48); ctx.stroke(); }
  }
  { const [x, y, w, h] = G.petal; const g = ctx.createLinearGradient(0, y + h, 0, y); g.addColorStop(0, '#fff6f2'); g.addColorStop(1, '#f088a8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + w / 2, y + h); ctx.quadraticCurveTo(x - w * 0.05, y + h * 0.45, x + w / 2, y + 1); ctx.quadraticCurveTo(x + w * 1.05, y + h * 0.45, x + w / 2, y + h); ctx.fill();
    ctx.strokeStyle = 'rgba(220,100,140,0.4)'; ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + w / 2, y + h); ctx.lineTo(x + w / 2 + i * 5, y + 8); ctx.stroke(); } }
  return bleedTexture(ctx.getImageData(0, 0, S, S));
}

/** Transparent pixels take the colour of the leaf next to them (alpha stays 0), so shrinking the texture for distant
 *  plants doesn't darken every leaf's edge with the black around it. Rows are flipped for a DataTexture. */
function bleedTexture(img) {
  const S = img.width, d = img.data;
  let src = new Uint8ClampedArray(d), dst = new Uint8ClampedArray(d);
  const filled = new Uint8Array(S * S);
  for (let i = 0; i < S * S; i++) filled[i] = d[i * 4 + 3] > 8 ? 1 : 0;
  for (let pass = 0; pass < 6; pass++) {
    const next = filled.slice();
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x;
      if (filled[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= S || yy >= S) continue;
        const j = yy * S + xx;
        if (!filled[j]) continue;
        r += src[j * 4]; g += src[j * 4 + 1]; b += src[j * 4 + 2]; n++;
      }
      if (n) { dst[i * 4] = r / n; dst[i * 4 + 1] = g / n; dst[i * 4 + 2] = b / n; dst[i * 4 + 3] = 0; next[i] = 1; }
    }
    filled.set(next); src.set(dst);
  }
  const out = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) out.set(src.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
  const tex = new THREE.DataTexture(out, S, S, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
