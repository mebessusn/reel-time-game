// Fish skins (v1.13.12): each species' texture is painted in code when it is first needed, so the detail costs no
// download and no extra triangles. One 256 x 128 atlas per species/variant (about 25 ms to paint):
//   body    x 0-256,   y 0-80    u = the body's ring (nose 0 .. tail root 1), v = around the body (0 top, 0.5 belly)
//   caudal  x 0-128,   y 80-104  u = up the tail root, v = out toward the edge
//   fins    x 128-256, y 80-104  the other fins, same layout
//   eye     x 0-64,    y 104-120 u = around, v = out from the pupil
//   white   x 248-256, y 120-128 for parts that keep their own vertex colours (teeth, whiskers, spikes)
// A second canvas (same layout) holds the glow: what shines in the dark.
import * as THREE from 'three';

export const ATLAS = { W: 256, H: 128, body: [0, 0, 256, 80], caudal: [0, 80, 128, 24], fins: [128, 80, 128, 24], eye: [0, 104, 64, 16], white: [248, 120, 8, 8] };

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const tone = (c, k) => (k > 0 ? mix(c, [255, 255, 255], k) : mix(c, [0, 0, 0], -k));
function hash(x, y, s = 0) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash(xi, yi, s), hash(xi + 1, yi, s), u), lerp(hash(xi, yi + 1, s), hash(xi + 1, yi + 1, s), u), v);
}
const fbm = (x, y, s) => 0.55 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1, y * 2.1, s + 1) + 0.15 * vnoise(x * 4.3, y * 4.3, s + 2);
/** Distance to the nearest jittered dot on a grid (cells of 1), and that dot's random value. */
function worley(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let best = 9, val = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = xi + dx, cy = yi + dy;
    const px = cx + 0.2 + 0.6 * hash(cx, cy, s), py = cy + 0.2 + 0.6 * hash(cx, cy, s + 7);
    const d = Math.hypot(x - px, y - py);
    if (d < best) { best = d; val = hash(cx, cy, s + 13); }
  }
  return [best, val];
}

/** Paint one species' atlas. sp: species data; paint: { ex: [...extras], gt: gill position, R: body rings }. */
export function paintFishSkin(sp, paint, variant = 'normal') {
  if (typeof document === 'undefined') return null; // tests in node: plain vertex colours
  const { W, H } = ATLAS;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const gv = document.createElement('canvas'); gv.width = W; gv.height = H;
  const ctx = cv.getContext('2d'), gtx = gv.getContext('2d');
  const img = ctx.createImageData(W, H), glow = gtx.createImageData(W, H);
  const D = img.data, G = glow.data;
  const ex = new Set(paint?.ex || []), gt = paint?.gt ?? 0.24;
  const C = sp.colors;
  const base = hex(C.base), belly = hex(C.belly), acc = hex(C.accent), fin = hex(C.fin), back = tone(base, -0.25);
  const glowC = hex(sp.glow || C.accent);
  const seed = [...sp.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const pat = sp.pattern || 'none';
  const put = (x, y, c, a = 255) => { const i = (y * W + x) * 4; D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = a; };
  const shine = (x, y, c, k = 1) => { const i = (y * W + x) * 4; G[i] = c[0] * k; G[i + 1] = c[1] * k; G[i + 2] = c[2] * k; G[i + 3] = 255; };
  const scaled = !ex.has('translucent') && !['eel'].includes(sp.shape) && !['gloweel', 'echoeel', 'wreckeel', 'glowloach', 'snakehead', 'burbot', 'catfish', 'bullhead', 'oldwhiskers', 'albinocat', 'pitlurker', 'sturgeon', 'stormsturgeon', 'paddlefish'].includes(sp.id);
  const smoothSkin = !scaled;

  // ---------------------------------------------------------------- body
  const [bx, by, bw, bh] = ATLAS.body;
  for (let py = 0; py < bh; py++) {
    const phi = ((py + 0.5) / bh) * Math.PI * 2;
    const ph = phi <= Math.PI ? phi : Math.PI * 2 - phi; // both sides alike
    const rel = Math.cos(phi); // +1 back .. -1 belly
    for (let px = 0; px < bw; px++) {
      const u = (px + 0.5) / bw, t = Math.pow(u, 1.35); // rings bunch toward the head, as the model's do
      // countershading: dark back, the species' colour on the flanks, a pale belly with a soft sheen line
      let c = mix(belly, base, smooth(-0.6, -0.05, rel));
      c = mix(c, back, smooth(0.3, 0.9, rel));
      c = mix(c, tone(belly, 0.25), 0.35 * Math.exp(-(((rel + 0.42) / 0.06) ** 2)));
      const X = t * 34, Y = ph * 7; // pattern space: about square on the flank
      let lit = 0, a = 255;
      // -------- the species' pattern
      if (pat === 'bars') {
        const f = (t * 6.5 + 0.06 * Math.sin(ph * 3) + 0.04 * (fbm(t * 10, ph * 3, seed) - 0.5)) % 1;
        const k = smooth(0.42, 0.30, Math.abs(f - 0.25) * 2 - 0.0) * smooth(-0.55, -0.15, rel) * smooth(0.1, 0.18, t) * smooth(0.98, 0.9, t);
        c = mix(c, acc, 0.85 * k);
      } else if (pat === 'stripes') {
        if (ex.has('lightning')) {
          const zig = 0.18 * (Math.abs(((t * 9) % 2) - 1) * 2 - 1);
          const k = smooth(0.11, 0.07, Math.abs(rel - 0.05 - zig)) * smooth(0.12, 0.2, t);
          c = mix(c, ex.has('glow_stripe') ? glowC : acc, k); if (ex.has('glow_stripe')) lit = k;
        } else {
          const w = 0.12 + 0.06 * fbm(t * 12, 0, seed);
          const k = smooth(w, w - 0.04, Math.abs(rel - 0.08 + 0.03 * Math.sin(t * 20))) * smooth(0.14, 0.24, t);
          c = mix(c, acc, 0.9 * k);
        }
      } else if (pat === 'spots') {
        const [d, v] = worley(X * 0.9, Y * 0.9, seed);
        const r = 0.18 + 0.12 * v;
        const k = smooth(r, r - 0.06, d) * smooth(-0.45, -0.15, rel) * smooth(0.12, 0.2, t);
        if (ex.has('halo_spots') && d < r + 0.1) c = mix(c, tone(belly, 0.3), smooth(r + 0.1, r + 0.04, d) * smooth(-0.45, -0.15, rel) * smooth(0.12, 0.2, t));
        c = mix(c, acc, 0.92 * k);
      } else if (pat === 'speckle') {
        const n = hash(px * 2, py * 2, seed);
        if (n > 0.86) c = tone(c, -0.22 - 0.1 * hash(px, py, seed + 1));
        const [d] = worley(X * 2.2, Y * 2.2, seed + 3);
        c = mix(c, tone(acc, -0.1), 0.6 * smooth(0.12, 0.06, d) * smooth(-0.6, -0.2, rel));
      } else if (pat === 'koi') {
        const n = fbm(t * 6 + 3, ph * 1.8 + 1, seed);
        const k = smooth(0.50, 0.53, n) * smooth(-0.55, -0.35, rel);
        c = mix(c, acc, k);
        if (sp.id === 'koi') c = mix(c, [24, 22, 28], smooth(0.66, 0.69, fbm(t * 8 + 11, ph * 2.6, seed + 5)) * smooth(0.0, 0.2, rel));
      } else if (pat === 'glow') {
        const k1 = smooth(0.07, 0.04, Math.abs(rel + 0.02)) * (((t * 28) % 1) < 0.62 ? 1 : 0) * smooth(0.14, 0.2, t);
        const [d] = worley(t * 46, ph * 4, seed + 2);
        const k2 = smooth(0.2, 0.1, d) * smooth(-0.45, -0.7, rel);
        const k = Math.max(k1, k2);
        c = mix(c, glowC, k); lit = Math.max(lit, k);
      }
      // -------- scales: rows of overlapping scales, a dark rear edge and a pale front glint on each
      if (scaled && t > gt + 0.015) {
        const sx = t * 52, sy = ph * 9 + (Math.floor(t * 52) % 2) * 0.5;
        const fx = sx - Math.floor(sx), fy = sy - Math.floor(sy);
        const d = Math.hypot(fx - 0.15, (fy - 0.5) * 1.2);
        const edge = smooth(0.5, 0.58, d) * smooth(0.95, 0.75, d);
        c = tone(c, -0.17 * edge * (ex.has('scales') ? 1.6 : 1));
        c = tone(c, 0.10 * smooth(0.35, 0.1, Math.hypot(fx - 0.5, fy - 0.35)) * smooth(-0.3, 0.2, rel));
      } else if (smoothSkin) {
        c = tone(c, (vnoise(px * 0.7, py * 0.7, seed) - 0.5) * 0.12); // a soft, leathery mottle
      }
      // -------- lateral line: a row of pale pores along the flank
      const ll = 0.28 - 0.06 * smooth(gt, 0.9, t);
      if (t > gt + 0.02 && Math.abs(rel - ll) < 0.018) c = tone(c, (Math.floor(t * 90) % 2 ? 0.18 : 0.06));
      // -------- extras
      if (ex.has('lateral_bright') && Math.abs(rel - 0.05) < 0.05 && t > 0.2) c = mix(c, tone(acc, 0.4), 0.8);
      if (ex.has('lateral_pale') && Math.abs(rel - 0.15 - 0.12 * Math.sin(t * 3)) < 0.03 && t > 0.2) c = tone(belly, 0.25);
      if (ex.has('glow_line') && Math.abs(rel) < 0.045 && t > 0.12) { c = glowC; lit = 1; }
      if (ex.has('glow_belly') && rel < -0.6 && t > 0.15 && t < 0.85) { const k = smooth(-0.6, -0.8, rel); c = mix(c, glowC, 0.7 * k); lit = Math.max(lit, k * 0.8); }
      if (ex.has('glow_rings') && ((t * 16) % 1) < 0.16 && t > 0.1) { c = glowC; lit = 1; }
      if (ex.has('glow_dots')) { const [d] = worley(t * 40, ph * 6, seed + 3); if (d < 0.14 && rel < 0.5) { c = glowC; lit = 1; } }
      if (ex.has('glow_veins') && Math.abs(fbm(t * 9, ph * 2.5, seed + 9) - 0.5) < 0.012 && rel > -0.5) { c = glowC; lit = 1; }
      if (ex.has('pepper') && hash(px, py, seed + 2) > 0.94 && rel > -0.2) c = [28, 26, 30];
      if (ex.has('bean_spots')) { const [d] = worley(t * 26, ph * 5, seed + 4); if (d < 0.24 && rel > -0.45 && t > 0.12) c = mix(c, acc, 0.85); }
      if (ex.has('marbled')) c = mix(c, acc, 0.65 * smooth(0.5, 0.58, fbm(t * 12, ph * 4, seed)));
      if (ex.has('blotches')) c = mix(c, acc, 0.85 * smooth(0.55, 0.6, fbm(t * 8, ph * 2.2, seed + 6)) * smooth(-0.6, -0.4, rel));
      if (ex.has('gold_flecks') && hash(px, py, seed + 8) > 0.965) c = acc;
      if (ex.has('glitter') && hash(px, py, seed + 7) > 0.95 && rel > -0.3) c = tone(c, 0.5);
      if (ex.has('rain_drops')) { const [d] = worley(t * 30, ph * 6, seed + 2); if (d < 0.12 && rel > 0) c = tone(acc, 0.3); }
      if (ex.has('teal_lines') && t < gt + 0.04 && Math.abs(((rel * 6 + t * 10) % 1) - 0.5) < 0.1) c = acc;
      if (ex.has('cheeklines') && t < gt + 0.04 && Math.abs(((rel * 5 + t * 8) % 1) - 0.5) < 0.1 && rel > -0.4) c = [78, 150, 215];
      if (ex.has('green_head') && t < gt + 0.03) c = mix(c, acc, 0.9);
      if (ex.has('moss') && rel > 0.4 && fbm(t * 14, ph * 5, seed + 1) > 0.52) c = [72, 104, 42];
      if (ex.has('warts') && hash(px, py, seed + 1) > 0.97) c = tone(c, 0.25);
      if (ex.has('scars') && Math.abs(fbm(t * 4, ph * 1.4, seed + 12) - 0.5) < 0.008) c = tone(belly, 0.3);
      if (ex.has('shoulder_spot') && Math.hypot((t - 0.3) * 3, rel - 0.2) < 0.16) c = [26, 24, 30];
      if (ex.has('tail_eyespot')) { const d = Math.hypot((t - 0.93) * 3.5, rel - 0.25); if (d < 0.2) c = [12, 12, 14]; else if (d < 0.27) c = [235, 160, 40]; }
      if (ex.has('crescent') && ph > 0.4 && ph < 2.7) {
        const d1 = Math.hypot((t - 0.42) * 2.2, rel - 0.1), d2 = Math.hypot((t - 0.38) * 2.2, rel - 0.22);
        if (d1 < 0.42 && d2 > 0.36) { c = [255, 246, 200]; lit = 1; }
      }
      if (ex.has('slate_plates') && (((t * 18) % 1) > 0.88 || ((ph * 5) % 1) > 0.9)) c = tone(c, -0.15);
      if (ex.has('translucent')) c = mix(c, [255, 255, 255], 0.12);
      // -------- head: smooth skin, a darker crown, the gill cover's curved edge with a pale rim
      if (t < gt + 0.02) c = tone(c, rel > 0.2 ? -0.06 : 0.02);
      const gc = gt + 0.035 * (rel * rel) - 0.01;
      const gd = t - gc;
      if (Math.abs(rel) < 0.85) {
        if (gd > -0.007 && gd < 0.0) c = tone(c, -0.42);
        else if (gd >= 0 && gd < 0.006) c = tone(c, 0.12);
        const pre = gc - 0.045; if (Math.abs(t - pre) < 0.003 && rel < 0.5) c = tone(c, -0.15);
      }
      if (ex.has('pink_gills') && gd > -0.03 && gd < 0 && Math.abs(rel) < 0.6) c = mix(c, [240, 140, 150], 0.7);
      if (ex.has('earflap') && Math.hypot((t - gt) * 4, rel - 0.18) < 0.16) c = [16, 16, 30];
      if (ex.has('earflap_red')) { const d = Math.hypot((t - gt) * 4, rel - 0.18); if (d < 0.14) c = [16, 16, 26]; else if (d < 0.2) c = [230, 50, 40]; }
      if (ex.has('eyebars') && t < gt && Math.abs(((t * 22 - rel * 2) % 3) - 1.5) < 0.3 && rel > -0.4) c = tone(acc, -0.2);
      put(bx + px, by + py, c, a);
      if (lit > 0.05) shine(bx + px, by + py, glowC, lit);
    }
  }

  // ---------------------------------------------------------------- fins
  const finPaint = ([fx, fy, fw, fh], rays, kind) => {
    for (let py = 0; py < fh; py++) {
      const r = (py + 0.5) / fh; // 0 base .. 1 edge
      for (let px = 0; px < fw; px++) {
        const s = (px + 0.5) / fw;
        let c = mix(fin, tone(fin, 0.38), r * 0.75);
        // rays: thin dark lines fanning out, jointed with pale dots
        const rf = s * rays, rd = Math.abs(rf - Math.round(rf));
        const ray = smooth(0.12, 0.04, rd);
        c = tone(c, -0.28 * ray);
        if (ray > 0.5 && ((r * 14) % 1) < 0.18) c = tone(c, 0.25);
        let a = 255;
        // a soft, slightly ragged edge; spiny edges notch between the rays
        // a soft edge with shallow scallops between the rays (no ragged feathering)
        if (r > 0.93 - 0.05 * smooth(0.25, 0.5, rd) + 0.02 * (vnoise(s * 24, 3, seed) - 0.5)) a = 0;
        if (pat === 'koi' || ex.has('veil')) c = mix(c, [255, 255, 255], 0.35 * r);
        if (ex.has('red_fins')) c = mix(c, [215, 64, 40], 0.75);
        if (ex.has('frost_fins') && r > 0.55) c = mix(c, [234, 246, 255], 0.75);
        if (ex.has('white_edges') && s < 0.1 && kind === 'fins') c = [244, 244, 236];
        if (kind === 'caudal' && ex.has('tail_white') && r > 0.78 && s < 0.2) c = [240, 240, 232];
        if (kind === 'caudal' && ex.has('tail_band') && r > 0.78) c = [12, 12, 14];
        if (kind === 'fins' && ex.has('sail_spots') && worley(s * 12, r * 4, seed)[0] < 0.18) c = [240, 120, 170];
        if (pat === 'spots' && !['pike', 'gar', 'bogking'].includes(sp.id) && worley(s * 10, r * 3, seed + 5)[0] < 0.14 && r < 0.8) c = mix(c, acc, 0.8);
        if (pat === 'glow' && r > 0.75) { c = mix(c, glowC, 0.6); shine(fx + px, fy + py, glowC, 0.6); }
        put(fx + px, fy + py, c, a);
      }
    }
  };
  finPaint(ATLAS.caudal, 12, 'caudal');
  finPaint(ATLAS.fins, 8, 'fins');

  // ---------------------------------------------------------------- eye
  {
    const [ex0, ey0, ew, eh] = ATLAS.eye;
    const iris = sp.eye ? hex(sp.eye) : ex.has('red_eye') ? [210, 30, 26] : ex.has('pink_eye') ? [240, 128, 140] : ex.has('glass_eye') ? [226, 232, 200] : [236, 196, 92];
    for (let py = 0; py < eh; py++) {
      const v = (py + 0.5) / eh; // 0 pupil centre .. 1 back of the eyeball
      for (let px = 0; px < ew; px++) {
        const u = (px + 0.5) / ew;
        let c;
        if (v < 0.2) c = [8, 8, 12];
        else if (v < 0.44) c = mix(iris, tone(iris, -0.35), hash(Math.floor(u * 40), 2, seed) * 0.6 + (v - 0.2) * 0.8); // streaky iris
        else if (v < 0.5) c = tone(iris, -0.6);
        else c = tone(base, -0.3);
        if (v > 0.16 && v < 0.3 && Math.abs(u - 0.12) < 0.06) c = [255, 255, 255]; // the glint
        put(ex0 + px, ey0 + py, c);
      }
    }
  }
  // white patch for vertex-coloured parts
  { const [wx, wy, ww, wh] = ATLAS.white; for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) put(wx + x, wy + y, [255, 255, 255]); }

  // ---------------------------------------------------------------- gold / diamond
  if (variant !== 'normal') {
    const ramp = (variant === 'gold' ? ['#6a4808', '#a8761a', '#d8a828', '#f4d050', '#fff0a0'] : ['#256f8c', '#45acd0', '#78dcef', '#b8f2ff', '#ffffff']).map(hex);
    for (let i = 0; i < D.length; i += 4) {
      if (D[i + 3] === 0) continue;
      const l = (D[i] * 0.3 + D[i + 1] * 0.59 + D[i + 2] * 0.11) / 255;
      if (l < 0.06) continue; // pupils stay dark
      const k = l * (ramp.length - 1), k0 = Math.floor(k), k1 = Math.min(ramp.length - 1, k0 + 1);
      const c = mix(ramp[k0], ramp[k1], k - k0);
      D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2];
    }
  }
  ctx.putImageData(img, 0, 0);
  let anyGlow = false;
  for (let i = 3; i < G.length; i += 4) if (G[i]) { anyGlow = true; break; }
  const map = new THREE.CanvasTexture(cv);
  let emissiveMap = null;
  if (anyGlow) { gtx.putImageData(glow, 0, 0); emissiveMap = new THREE.CanvasTexture(gv); }
  for (const tx of [map, emissiveMap]) if (tx) { tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; }
  return { map, emissiveMap };
}
