// Soft-block fish: every species built from rounded, pixel-painted blocks (body segments, alpha-cut fin
// cards, snouts, whiskers, lures). One merged geometry + one atlas material per species/variant.
// Fish space: length along +X (nose at +X), y up, z across; total body length is about 1 unit.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Atlas, softBox, tone, mix, hash, atlasTexture } from '../render/soft.js';
import { SPECIES_BY_ID } from '../data/species.js';

const DF = 48; // fish texel density (pixels per fish-length)

// Body profiles: H height / length, T thickness / length, tail style, extras.
export const SOFT_SHAPES = {
  tiny: { H: 0.36, T: 0.2, tail: 'fork' },
  slim: { H: 0.3, T: 0.17, tail: 'fork' },
  round: { H: 0.6, T: 0.17, tail: 'fan', headH: 0.8 },
  big: { H: 0.38, T: 0.22, tail: 'fork', barbels: true },
  bass: { H: 0.37, T: 0.2, tail: 'fan', bigMouth: true },
  long: { H: 0.2, T: 0.15, tail: 'fork', snout: 0.12, dorsalBack: true },
  cat: { H: 0.25, T: 0.26, tail: 'fan', flatHead: true, whiskers: true },
  puff: { H: 0.62, T: 0.52, tail: 'fan', spikes: true, headH: 0.95 },
  sturgeon: { H: 0.2, T: 0.2, tail: 'hetero', snout: 0.11, scutes: true },
  eel: { H: 0.11, T: 0.1, tail: 'none', eel: true },
  gar: { H: 0.16, T: 0.13, tail: 'fan', snout: 0.26, dorsalBack: true },
  paddle: { H: 0.22, T: 0.2, tail: 'hetero', paddle: 0.36 },
  lantern: { H: 0.46, T: 0.26, tail: 'fan', lure: true, bigMouth: true, headH: 1.0 },
};

// Hero touches per species (on top of the shape).
const HERO = {
  oldwhiskers: { longBarbels: true, scale: 1 },
  crystalpike: { shards: true },
  stormsturgeon: { lightning: true },
  lanternfish: { teeth: true },
  gloweel: { ribbon: true },
  moonfin: { crescent: true, tallFins: true },
  ghostkoi: { veil: true },
  koi: { veil: false },
  paddlefish: {},
};

const GOLD_RAMP = ['#7a5410', '#b8841c', '#e0b030', '#f8d860', '#fff4b0'];
const DIAMOND_RAMP = ['#2a7a9a', '#4ab8d8', '#7ae0f0', '#b8f4ff', '#ffffff'];

const cache = new Map();

/** Merged soft fish geometry + material for a species/variant (cached). */
export function legacyFishModel(speciesId, variant = 'normal') {
  const key = `${speciesId}:${variant}`;
  if (cache.has(key)) return cache.get(key);
  const sp = SPECIES_BY_ID[speciesId];
  const shape = SOFT_SHAPES[sp.shape] || SOFT_SHAPES.slim;
  const hero = HERO[sp.id] || {};
  const atlas = new Atlas(256);
  const geos = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const add = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
    m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), one);
    geo.applyMatrix4(m4);
    geos.push(geo);
  };
  const col = sp.colors;
  const H = shape.H, T = shape.T;
  const half = H / 2;

  // ---------------- skin colour field (world coordinates -> colour)
  const accent = col.accent, belly = col.belly, base = col.base;
  const backC = tone(base, -0.16);
  const colorAt = (wx, wy, top = false) => {
    const qx = Math.floor(wx * DF), qy = Math.floor(wy * DF);
    const rel = wy / half; // -1 belly .. +1 back
    let c = rel > 0.5 ? backC : rel < -0.3 ? belly : rel < -0.05 ? mix(base, belly, 0.5) : base;
    if (top) c = backC;
    switch (sp.pattern) {
      case 'stripes':
        if (hero.lightning) {
          const zig = [0, 1, 2, 1, 0, -1, -2, -1][((qx % 8) + 8) % 8] / (H * DF) * 1.6;
          if (Math.abs(rel - 0.05 - zig) < 0.12) c = accent;
        } else if (Math.abs(rel - 0.12) < 0.13) c = accent;
        break;
      case 'bars': if (((qx % 7) + 7) % 7 < 2 && rel > -0.35) c = tone(accent, rel > 0.5 ? -0.1 : 0); break;
      case 'spots': if (hash(Math.floor(qx / 2), Math.floor(qy / 2), 11) > 0.8 && rel > -0.25) c = accent; break;
      case 'speckle': if (hash(qx, qy, 12) > 0.72) c = tone(c, -0.2); if (hash(qx, qy, 13) > 0.93) c = accent; break;
      case 'koi': {
        const n = hash(Math.floor(qx / 4), Math.floor((qy + 40) / 3), 14);
        if (rel > -0.2 && n > 0.48) c = hash(qx, qy, 15) > 0.2 ? accent : tone(accent, 0.15);
        break;
      }
      case 'glow':
        if (Math.abs(rel + 0.05) < 0.09 && ((qx % 4) + 4) % 4 < 2) c = tone(accent, 0.25);
        if (rel < -0.6 && ((qx % 3) + 3) % 3 === 0) c = sp.glow || accent;
        if (hero.shards && rel > 0.3 && hash(qx, qy, 16) > 0.8) c = tone(accent, 0.3);
        break;
      default: if (hash(qx, qy, 17) > 0.93) c = tone(c, -0.05);
    }
    if (hero.crescent) {
      const dx = wx + 0.05, dy = wy - 0.02;
      const r1 = Math.hypot(dx, dy), r2 = Math.hypot(dx - 0.05, dy - 0.04);
      if (r1 < 0.15 && r2 > 0.13) c = '#fff6c8';
    }
    return c;
  };

  // Paint a body segment centred at (cx, cy) with size w x h: sides sample the colour field.
  const segPaint = (cx, cy, w, h, extra) => ({
    front: (f) => sidePaint(f, cx, cy, w, h, false, extra),
    back: (f) => sidePaint(f, cx, cy, w, h, true, extra),
    top: (f) => f.fill((x, y) => colorAt(cx - w / 2 + ((x + 0.5) / f.w) * w, half, true)),
    bottom: (f) => f.fill(() => belly),
    right: (f) => f.fill((x, y) => colorAt(cx + w / 2, cy + h / 2 - ((y + 0.5) / f.h) * h)),
    left: (f) => f.fill((x, y) => colorAt(cx - w / 2, cy + h / 2 - ((y + 0.5) / f.h) * h)),
  });
  function sidePaint(f, cx, cy, w, h, mirrored, extra) {
    f.fill((x, y) => {
      const u = (x + 0.5) / f.w;
      const wx = cx + (mirrored ? 0.5 - u : u - 0.5) * w;
      const wy = cy + h / 2 - ((y + 0.5) / f.h) * h;
      return colorAt(wx, wy);
    });
    extra?.(f, mirrored, (wx, wy) => ({ // world -> pixel helper
      x: Math.floor((mirrored ? 0.5 - (wx - cx) / w : (wx - cx) / w + 0.5) * f.w),
      y: Math.floor(((cy + h / 2 - wy) / h) * f.h),
    }));
  }

  // ---------------- body
  const headH = (shape.headH || 0.86) * H;
  const eyeC = sp.eye || '#1a1a1a';
  const eyeAt = shape.flatHead ? 0.06 : 0.1;
  const faceExtra = (f, mirrored, toPx) => {
    // gill line
    const g = toPx(0.2, 0);
    for (let y = Math.floor(f.h * 0.2); y < Math.floor(f.h * 0.8); y++) f.px(g.x + (Math.abs(y - f.h / 2) > f.h * 0.22 ? (mirrored ? -1 : 1) : 0), y, tone(base, -0.3));
    // eye: dark disc, coloured iris ring, two highlights
    // a soft square eye: iris ring, dark pupil, glossy highlight toward the nose
    const n = Math.max(4, Math.round(H * DF * 0.17));
    const c = toPx(0.36, headH * eyeAt * 1.5);
    const x0 = c.x - (n >> 1), y0 = c.y - (n >> 1);
    const ring = eyeC === '#1a1a1a' ? '#f0e8c8' : eyeC;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const corner = (x === 0 || x === n - 1) && (y === 0 || y === n - 1);
      if (corner) continue;
      const edge = x === 0 || y === 0 || x === n - 1 || y === n - 1;
      f.px(x0 + x, y0 + y, edge ? ring : '#141418');
    }
    const hx = mirrored ? x0 + 1 : x0 + n - 2;
    f.px(hx, y0 + 1, '#ffffff');
    if (n > 4) f.px(mirrored ? x0 + n - 2 : x0 + 1, y0 + n - 2, '#5a6878');
  };
  const nosePaint = (f) => {
    f.fill((x, y) => colorAt(0.5, headH / 2 - ((y + 0.5) / f.h) * headH));
    const my = Math.floor(f.h * (shape.bigMouth ? 0.62 : 0.66));
    f.rect(1, my, f.w - 2, shape.bigMouth ? 2 : 1, tone(base, -0.45));
    if (hero.teeth) for (let x = 1; x < f.w - 1; x += 2) f.px(x, my - 1, '#f4efe0');
  };

  if (shape.eel) {
    // chain of soft segments with a gentle S
    const n = 8, segL = 1 / n;
    for (let i = 0; i < n; i++) {
      const cx = -0.5 + segL * (i + 0.5);
      const zOff = Math.sin(i * 0.9) * 0.05 * (1 - i / n);
      const hh = H * (i === n - 1 ? 0.9 : i === 0 ? 0.6 : 1);
      const paint = segPaint(cx, 0, segL * 1.5, hh, i === n - 1 ? faceExtra : null);
      if (i === n - 1) paint.right = nosePaint;
      add(softBox(atlas, segL * 1.5, hh, T, Math.min(hh, T) * 0.3, paint, { D: DF }), cx, 0, zOff);
    }
  } else {
    const segs = shape.spikes || sp.shape === 'round' ? [
      { x0: -0.5, x1: -0.2, h: H * 0.55, d: T * 0.7 },
      { x0: -0.34, x1: 0.5, h: H, d: T, head: true },
    ] : [
      { x0: -0.5, x1: -0.17, h: H * 0.6, d: T * 0.74 },
      { x0: -0.26, x1: 0.24, h: H, d: T },
      { x0: 0.14, x1: 0.5, h: headH, d: T * (shape.flatHead ? 1.06 : 0.92), head: true },
    ];
    if (shape.flatHead) segs[2].y = -H * 0.08;
    for (const s of segs) {
      const w = s.x1 - s.x0, cx = (s.x0 + s.x1) / 2, cy = s.y || 0;
      const paint = segPaint(cx, cy, w, s.h, s.head ? faceExtra : null);
      if (s.head) paint.right = nosePaint;
      add(softBox(atlas, w, s.h, s.d, Math.min(s.h, s.d) * 0.38, paint, { D: DF }), cx, cy, 0);
    }
    // peduncle
    add(softBox(atlas, 0.12, H * 0.3, T * 0.5, Math.min(H * 0.3, T * 0.5) * 0.4, segPaint(-0.55, 0, 0.12, H * 0.3), { D: DF }), -0.55, 0, 0);
  }

  // ---------------- fins (alpha-cut cards; their thin edges are transparent)
  const finC = col.fin;
  const ray = (x, y) => (x % 3 === 0 ? tone(finC, -0.18) : y % 5 === 0 ? tone(finC, 0.1) : finC);
  const card = (w, h, inside, tint = ray, edgeTint) => {
    const paintFace = (mirror) => (f) => {
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
        const u = (x + 0.5) / f.w, v = (y + 0.5) / f.h;
        const uu = mirror ? 1 - u : u;
        if (inside(uu, v)) {
          const nearEdge = !inside(uu + 1.5 / f.w, v) || !inside(uu - 1.5 / f.w, v) || !inside(uu, v - 1.5 / f.h) || !inside(uu, v + 1.5 / f.h);
          f.px(x, y, nearEdge && edgeTint ? edgeTint : tint(x, y));
        } else f.px(x, y, 'clear');
      }
    };
    return softBox(atlas, w, h, 0.012, 0.004, { front: paintFace(false), back: paintFace(true), all: (f) => f.fill('clear') }, { D: DF * 1.2, seg: 1, shade: false });
  };
  // tail
  const tailLen = hero.veil ? 0.42 : 0.24, tailH = hero.veil ? H * 1.5 : H * 1.05;
  if (shape.tail !== 'none') {
    const tailShape = {
      fork: (u, v) => { const a = 0.18 + 0.82 * (1 - u); if (Math.abs(v - 0.5) > a / 2) return false; return !(u < 0.55 && Math.abs(v - 0.5) < (0.55 - u) * 0.75); },
      fan: (u, v) => { const a = 0.3 + 0.7 * (1 - u) ** 0.7; return Math.abs(v - 0.5) < a / 2 && !(u < 0.12 && Math.abs(v - 0.5) < 0.12); },
      hetero: (u, v) => { const top = v < 0.5; const a = top ? 0.5 * (1 - u) ** 0.5 + 0.08 : 0.3 * (1 - u) + 0.05; return top ? 0.5 - v < a : v - 0.5 < a * (u > 0.3 ? 1 : 0.4); },
    }[hero.veil ? 'fan' : shape.tail];
    const veilTint = (x, y) => (y % 4 === 0 ? tone(finC, 0.2) : x % 4 === 0 ? tone(finC, -0.1) : finC);
    add(card(tailLen, tailH, (u, v) => tailShape(u, v), hero.veil ? veilTint : ray, tone(finC, hero.veil ? 0.35 : -0.2)), -0.61 - tailLen / 2 + 0.02, 0, 0);
  }
  // dorsal + anal fins
  const dorsalH = H * (hero.tallFins ? 0.75 : 0.36);
  const dX = shape.dorsalBack ? -0.3 : -0.02, dL = shape.eel ? 0.85 : hero.tallFins ? 0.3 : 0.32;
  const sickle = (u, v) => { const prof = hero.tallFins ? Math.max(0, Math.sin(Math.PI * Math.min(1, u * 1.2))) ** 0.6 * (0.4 + 0.6 * u) : Math.max(0, Math.sin(Math.PI * u)) ** 0.6 * (0.55 + 0.45 * u); return 1 - v < prof; };
  if (shape.eel) {
    add(card(0.88, H * 0.6, (u, v) => 1 - v < 0.75 * Math.min(1, u * 4), ray, sp.glow || tone(finC, 0.3)), -0.08, H / 2 + H * 0.22, 0);
    add(card(0.6, H * 0.45, (u, v) => v < 0.75 * Math.min(1, u * 4), ray, sp.glow || tone(finC, 0.3)), -0.22, -H / 2 - H * 0.16, 0);
  } else {
    add(card(dL, dorsalH, sickle, ray, tone(finC, -0.22)), dX, H / 2 + dorsalH / 2 - 0.02, 0);
    const aH = H * (hero.tallFins ? 0.6 : 0.24);
    add(card(hero.tallFins ? 0.26 : 0.18, aH, (u, v) => v < (hero.tallFins ? Math.sin(Math.PI * Math.min(1, u * 1.2)) ** 0.6 : Math.sin(Math.PI * u) ** 0.7), ray, tone(finC, -0.22)), -0.28, -H * 0.6 / 2 - aH / 2 + 0.02, 0);
  }
  // pectoral fins: small soft paddles on both flanks
  const pecL = hero.veil ? 0.2 : 0.11;
  const pecShape = (u, v) => { const a = 0.35 + 0.65 * (1 - u); return Math.abs(v - 0.5) < a / 2; };
  for (const s of [-1, 1]) {
    // a small fan card that flares out from the flank behind the gills
    add(card(pecL, pecL * 0.75, pecShape, ray, tone(finC, -0.2)), 0.16 - pecL / 2, -H * 0.12, s * (T / 2 + 0.012), 0, s * 0.55, 0.25);
  }

  // ---------------- shape extras
  if (shape.snout) {
    const sL = shape.snout;
    add(softBox(atlas, sL, H * 0.22, T * 0.36, Math.min(H * 0.22, T * 0.36) * 0.4, { all: (f) => f.fill((x, y) => (y > f.h * 0.55 ? belly : tone(base, -0.05))) }, { D: DF }), 0.5 + sL / 2 - 0.02, -H * 0.12, 0);
  }
  if (shape.paddle) {
    const pL = shape.paddle;
    add(softBox(atlas, pL, 0.022, T * 0.6, 0.01, { all: (f) => f.fill((x, y) => (hash(x, y, 21) > 0.82 ? tone(base, -0.25) : tone(base, 0.06))) }, { D: DF }), 0.5 + pL / 2 - 0.02, -H * 0.05, 0);
  }
  if (shape.whiskers || hero.longBarbels) {
    const wc = tone(base, -0.45);
    const long = hero.longBarbels ? 0.34 : 0.16;
    for (const s of [-1, 1]) {
      add(softBox(atlas, long, 0.018, 0.018, 0.008, { all: (f) => f.fill(wc) }, { D: DF, seg: 1 }), 0.5 + long * 0.35, -H * 0.18, s * T * 0.38, 0, s * 0.55, -0.45);
      add(softBox(atlas, long * 0.6, 0.016, 0.016, 0.007, { all: (f) => f.fill(wc) }, { D: DF, seg: 1 }), 0.46, -H * 0.36, s * T * 0.22, 0, s * 0.3, -0.9);
    }
  }
  if (shape.barbels || hero.veil) {
    for (const s of [-1, 1]) add(softBox(atlas, 0.07, 0.014, 0.014, 0.006, { all: (f) => f.fill(tone(belly, -0.15)) }, { D: DF, seg: 1 }), 0.52, -H * 0.2, s * T * 0.22, 0, s * 0.4, -0.6);
  }
  if (shape.spikes) {
    // little nubs poking out of the back, belly and flanks
    for (let i = 0; i < 6; i++) {
      const x = -0.22 + i * 0.12;
      add(softBox(atlas, 0.035, 0.06, 0.035, 0.012, { all: (f) => f.fill(accent) }, { D: DF, seg: 1 }), x, H / 2 + 0.02, 0);
      add(softBox(atlas, 0.035, 0.05, 0.035, 0.012, { all: (f) => f.fill(accent) }, { D: DF, seg: 1 }), x, -H / 2 - 0.015, 0);
      for (const s of [-1, 1]) if (i % 2) add(softBox(atlas, 0.03, 0.03, 0.05, 0.01, { all: (f) => f.fill(accent) }, { D: DF, seg: 1 }), x, H * 0.08, s * (T / 2 + 0.02));
    }
  }
  if (shape.scutes) {
    for (let i = 0; i < 7; i++) add(softBox(atlas, 0.045, 0.035, 0.045, 0.015, { all: (f) => f.fill(tone(base, 0.35)) }, { D: DF, seg: 1 }), -0.4 + i * 0.13, H / 2 + 0.01, 0, 0, 0.78, 0);
  }
  if (shape.lure) {
    const stalk = [[0.36, H * 0.55, -0.3], [0.44, H * 0.72, 0.4], [0.55, H * 0.78, 1.1]];
    for (const [x, y, rz] of stalk) add(softBox(atlas, 0.03, 0.12, 0.03, 0.012, { all: (f) => f.fill(tone(finC, 0.1)) }, { D: DF, seg: 1 }), x, y, 0, 0, 0, rz);
    add(softBox(atlas, 0.08, 0.09, 0.08, 0.035, { all: (f) => f.fill((x, y) => (x + y < 3 ? '#fff8d8' : '#ffd060')) }, { D: DF }), 0.64, H * 0.66, 0);
  }
  if (hero.shards) {
    for (const [x, h, r] of [[-0.18, 0.1, 0.2], [-0.06, 0.15, -0.1], [0.06, 0.12, 0.25], [0.17, 0.08, -0.2]]) {
      add(softBox(atlas, 0.035, h, 0.035, 0.008, { all: (f) => f.fill((px, py) => (py < 2 ? '#ffffff' : px === 0 ? '#d8f8ff' : '#88d8f0')) }, { D: DF, seg: 1 }), x, H / 2 + h / 2 - 0.01, 0, 0, 0.78, r);
    }
  }

  const geo = mergeGeometries(geos.map((g) => g.index ? g.toNonIndexed() : g));
  for (const g of geos) g.dispose();
  geo.computeBoundingSphere();
  geo.computeBoundingBox();

  if (variant !== 'normal') recolorAtlas(atlas, variant === 'gold' ? GOLD_RAMP : DIAMOND_RAMP, variant === 'gold' ? 0.45 : 0.3);
  const tex = atlasTexture(atlas);
  const emissive = variant === 'diamond' ? '#a0f0ff' : variant === 'gold' ? '#ffcc40' : sp.glow ? mix(base, sp.glow, 0.6) : '#000000';
  const emissiveIntensity = variant === 'diamond' ? 0.3 : variant === 'gold' ? 0.18 : sp.glow ? 0.1 : 0;
  const material = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, emissive, emissiveIntensity });
  const out = { geometry: geo, material, length: 1 + (shape.snout || 0) + (shape.paddle || 0) + (shape.tail === 'none' ? 0 : tailLen) };
  cache.set(key, out);
  return out;
}

// Gold / Diamond: map every opaque pixel through a 5-tone ramp by luminance (eyes stay dark).
function recolorAtlas(atlas, ramp, bias = 0) {
  const { data: d, size } = atlas;
  const rgb = ramp.map((h) => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; });
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    if (l < 0.1) continue;
    const p = i / 4;
    const k = Math.min(ramp.length - 1, Math.max(0, Math.round(l * (ramp.length - 1) + bias + (hash(p % size, Math.floor(p / size), 5) - 0.5) * 0.45)));
    d[i] = rgb[k][0]; d[i + 1] = rgb[k][1]; d[i + 2] = rgb[k][2];
  }
}
