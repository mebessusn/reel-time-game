// "Soft-block" avatar: chunky, stout parts with rounded edges and corners, wrapped in 16-bit style
// pixel textures (about twice the detail of the classic 1/17 voxel avatar). One canvas atlas and one
// material per avatar. Same API as avatar.js: buildAvatar(cfg) -> { group, parts, rodHand, height, cfg }.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Atlas, softBox, tone, mix, hash, atlasMaterial, place, latheGeo } from '../render/soft.js';
import { SKINS, HAIR_COLORS, EYE_COLORS, CLOTH_COLORS, PANT_COLORS, HAT_COLORS, FRAMES, HEIGHTS, defaultAvatar } from '../data/avatarOptions.js';

const SCALE = 1.08; // whole-avatar scale so the stout build stands about 1.5 blocks tall

// ---------------------------------------------------------------- face (16 px tall)
function paintFace(f, cfg, skin) {
  const eye = EYE_COLORS[cfg.eyeColor] || EYE_COLORS[0];
  const hair = HAIR_COLORS[cfg.hairColor] || HAIR_COLORS[2];
  const ex = new Set(cfg.extras || []);
  f.fill((x, y) => (hash(x, y, 3) > 0.93 ? tone(skin, -0.03) : skin));
  const W = f.w, cx = Math.floor(W / 2);
  const eyeY = Math.round(f.h * 0.44);
  const eL = cx - 6, eR = cx + 3; // each eye 3 px wide
  const lash = tone(eye, -0.55);
  const drawEye = (x0, style, side = x0 < cx ? -1 : 1) => {
    const out = side < 0 ? x0 - 1 : x0 + 3; // the pixel just past the outer corner
    switch (style) {
      case 'lashes':
        drawEye(x0, 'round', side);
        f.px(out, eyeY - 1, lash); f.px(out, eyeY, lash); f.px(side < 0 ? x0 : x0 + 2, eyeY - 1, lash);
        break;
      case 'sparkle':
        f.rect(x0, eyeY, 3, 4, eye); f.rect(x0, eyeY, 3, 1, lash); f.px(out, eyeY, lash);
        f.px(x0, eyeY + 1, '#ffffff'); f.px(x0 + 1, eyeY + 1, '#ffffff'); f.px(x0, eyeY + 2, '#ffffff');
        f.px(x0 + 2, eyeY + 3, tone(eye, 0.55)); f.px(x0 + 1, eyeY + 3, tone(eye, -0.3));
        break;
      case 'content': f.px(x0, eyeY + 1, lash); f.px(x0 + 1, eyeY + 2, lash); f.px(x0 + 2, eyeY + 1, lash); f.px(out, eyeY + 1, tone(lash, 0.3)); break;
      case 'hearts':
        f.px(x0, eyeY + 1, '#e04870'); f.px(x0 + 2, eyeY + 1, '#e04870'); f.rect(x0, eyeY + 2, 3, 1, '#e04870'); f.px(x0 + 1, eyeY + 3, '#e04870');
        f.px(x0, eyeY + 1, '#ff9ab8');
        break;
      case 'glance': {
        f.rect(x0, eyeY, 3, 4, '#fbfbf8'); f.rect(x0, eyeY, 3, 1, lash);
        const ix = x0 + 1; // both look to the same side
        f.rect(ix, eyeY + 1, 2, 3, eye); f.px(ix + 1, eyeY + 2, tone(eye, -0.35)); f.px(ix, eyeY + 1, '#ffffff');
        break;
      }
      case 'starry': {
        const st = '#f4c030';
        f.px(x0 + 1, eyeY, st); f.rect(x0, eyeY + 1, 3, 1, st);
        f.px(x0 + 1, eyeY + 2, st); f.px(x0, eyeY + 3, st); f.px(x0 + 2, eyeY + 3, st); f.px(x0 + 1, eyeY + 1, '#fff4c0');
        break;
      }
      case 'focused':
        f.rect(x0, eyeY + 1, 3, 3, eye); f.px(x0 + 1, eyeY + 2, tone(eye, -0.35)); f.px(x0, eyeY + 2, '#ffffff');
        f.rect(x0, eyeY + 1, 3, 1, lash); f.px(side < 0 ? x0 + 2 : x0, eyeY + 2, lash); f.px(side < 0 ? x0 + 3 : x0 - 1, eyeY + 1, lash);
        break;
      case 'happy': f.px(x0, eyeY + 2, lash); f.px(x0 + 1, eyeY + 1, lash); f.px(x0 + 2, eyeY + 1, lash); f.px(x0 + 3, eyeY + 2, lash); break;
      case 'sleepy': f.rect(x0, eyeY + 1, 3, 1, lash); f.rect(x0, eyeY + 2, 3, 1, eye); f.px(x0 + 1, eyeY + 2, tone(eye, 0.25)); break;
      case 'dots': f.rect(x0 + 1, eyeY + 1, 2, 2, lash); f.px(x0 + 1, eyeY + 1, tone(eye, 0.3)); break;
      case 'wide':
        f.rect(x0 - 1, eyeY, 5, 4, '#fbfbf8'); f.rect(x0, eyeY, 3, 4, eye); f.rect(x0 - 1, eyeY, 5, 1, lash);
        f.px(x0, eyeY + 1, '#ffffff'); f.px(x0 + 1, eyeY + 2, tone(eye, -0.35)); break;
      default: // round: a tall glossy 3x4 eye with a lash line and two highlights
        f.rect(x0, eyeY, 3, 4, eye);
        f.rect(x0, eyeY, 3, 1, lash);
        f.px(x0 + 1, eyeY + 2, tone(eye, -0.35)); f.px(x0 + 1, eyeY + 3, tone(eye, -0.2));
        f.px(x0, eyeY + 1, '#ffffff'); f.px(x0 + 2, eyeY + 3, tone(eye, 0.45));
    }
  };
  if (cfg.eyes === 'wink') { drawEye(eL, 'round'); drawEye(eR, 'happy'); } else { drawEye(eL, cfg.eyes); drawEye(eR, cfg.eyes); }
  // brows
  const bc = tone(hair, -0.18), by = eyeY - 2;
  const brow = {
    bold: () => { f.rect(eL, by - 1, 3, 1, bc); f.rect(eL - 1, by, 3, 1, bc); f.rect(eR, by - 1, 3, 1, bc); f.rect(eR + 1, by, 3, 1, bc); },
    arched: () => { f.rect(eL, by - 1, 2, 1, bc); f.px(eL - 1, by, bc); f.px(eL + 2, by, bc); f.rect(eR + 1, by - 1, 2, 1, bc); f.px(eR, by, bc); f.px(eR + 3, by, bc); },
    straight: () => { f.rect(eL - 1, by - 1, 4, 1, bc); f.rect(eR, by - 1, 4, 1, bc); },
    soft: () => { f.rect(eL, by, 3, 1, tone(bc, 0.2)); f.rect(eR, by, 3, 1, tone(bc, 0.2)); },
    thick: () => { f.rect(eL - 1, by - 1, 4, 2, bc); f.rect(eR, by - 1, 4, 2, bc); },
    worried: () => { f.rect(eL - 1, by, 2, 1, bc); f.px(eL + 1, by - 1, bc); f.px(eL + 2, by - 1, bc); f.px(eR, by - 1, bc); f.px(eR + 1, by - 1, bc); f.rect(eR + 2, by, 2, 1, bc); },
    raised: () => { f.rect(eL, by - 2, 3, 1, bc); f.px(eL - 1, by - 1, bc); f.rect(eR, by - 2, 3, 1, bc); f.px(eR + 3, by - 1, bc); },
    thin: () => { f.rect(eL, by - 1, 3, 1, tone(bc, 0.35)); f.rect(eR, by - 1, 3, 1, tone(bc, 0.35)); },
  };
  (brow[cfg.brows] || brow.soft)();
  // nose + cheeks
  f.px(cx - 1, eyeY + 4, tone(skin, -0.12)); f.px(cx, eyeY + 4, tone(skin, -0.06));
  const blush = mix(skin, '#f06070', ex.has('blush') ? 0.5 : 0.18);
  f.rect(eL - 1, eyeY + 4, 3, 1, blush); f.rect(eR + 1, eyeY + 4, 3, 1, blush);
  if (ex.has('blush')) { f.px(eL, eyeY + 5, mix(skin, '#f06070', 0.3)); f.px(eR + 2, eyeY + 5, mix(skin, '#f06070', 0.3)); }
  if (ex.has('freckles')) for (const [x, y] of [[eL - 1, 5], [eL + 1, 6], [eL, 7], [eR + 1, 6], [eR + 3, 5], [eR + 2, 7]]) f.px(x, eyeY + y, tone(skin, -0.3));
  if (ex.has('mark')) f.px(eR + 3, eyeY + 6, '#4a2a1a');
  // mouth
  const my = eyeY + 6, lip = tone(skin, -0.5), inner = '#7a2e36';
  const mouth = {
    smile: () => { f.px(cx - 2, my, lip); f.rect(cx - 1, my + 1, 2, 1, lip); f.px(cx + 1, my, lip); },
    grin: () => { f.rect(cx - 2, my, 4, 1, lip); f.rect(cx - 1, my + 1, 2, 1, inner); f.px(cx - 3, my - 1, lip); f.px(cx + 2, my - 1, lip); },
    neutral: () => f.rect(cx - 1, my, 2, 1, lip),
    o: () => { f.rect(cx - 1, my, 2, 2, inner); f.px(cx - 1, my, tone(inner, -0.3)); },
    smirk: () => { f.rect(cx - 1, my, 2, 1, lip); f.px(cx + 1, my - 1, lip); },
    cat: () => { f.px(cx - 2, my, lip); f.px(cx - 1, my + 1, lip); f.px(cx, my, lip); f.px(cx + 1, my + 1, lip); f.px(cx + 2, my, lip); },
    tongue: () => { f.px(cx - 2, my, lip); f.rect(cx - 1, my + 1, 3, 1, lip); f.px(cx + 2, my, lip); f.rect(cx, my + 2, 2, 1, '#e86a7a'); },
    lips: () => { const lc = '#c8405a'; f.rect(cx - 2, my, 4, 1, lc); f.rect(cx - 1, my + 1, 2, 1, tone(lc, -0.15)); f.px(cx - 1, my, tone(lc, 0.25)); },
    fang: () => { f.px(cx - 2, my, lip); f.rect(cx - 1, my + 1, 3, 1, lip); f.px(cx + 2, my, lip); f.px(cx + 1, my + 2, '#ffffff'); },
    wobbly: () => { f.px(cx - 2, my + 1, lip); f.px(cx - 1, my, lip); f.px(cx, my + 1, lip); f.px(cx + 1, my, lip); },
    tiny: () => f.px(cx - 1, my, lip),
    laugh: () => { f.rect(cx - 2, my, 5, 1, lip); f.rect(cx - 2, my + 1, 5, 1, inner); f.rect(cx - 1, my + 2, 3, 1, inner); f.rect(cx - 1, my + 1, 3, 1, '#ffffff'); f.px(cx, my + 2, '#e86a7a'); },
    toothy: () => { f.rect(cx - 2, my, 4, 2, inner); f.rect(cx - 1, my, 2, 1, '#ffffff'); f.px(cx - 2, my, lip); f.px(cx + 1, my, lip); f.rect(cx - 1, my + 2, 2, 1, tone(skin, -0.15)); },
  };
  (mouth[cfg.mouth] || mouth.smile)();
  // facial hair
  const fh = tone(hair, -0.04);
  if (cfg.facialHair === 'stubble') for (let y = my - 1; y < f.h; y++) for (let x = 2; x < W - 2; x++) if (hash(x, y, 9) > 0.55 && !(y >= my && y <= my + 1 && x >= cx - 2 && x <= cx + 1)) f.px(x, y, mix(skin, hair, 0.35));
  if (cfg.facialHair === 'moustache') { f.rect(cx - 3, my - 1, 6, 1, fh); f.px(cx - 3, my, fh); f.px(cx + 2, my, fh); }
  if (cfg.facialHair === 'goatee') { f.rect(cx - 2, my - 1, 4, 1, fh); f.rect(cx - 1, my + 2, 2, 3, fh); }
  if (cfg.facialHair === 'beard') {
    for (let y = my - 3; y < f.h; y++) for (let x = 0; x < W; x++) {
      if (y >= my - 1 && y <= my + 1 && x >= cx - 3 && x <= cx + 2) continue; // keep the mouth clear
      if (y < my - 1 && x > 2 && x < W - 3) continue; // only sideburns up the cheeks
      f.px(x, y, hash(x, y, 4) > 0.72 ? tone(fh, 0.12) : fh);
    }
    f.rect(cx - 3, my - 1, 6, 1, fh);
    (mouth[cfg.mouth] || mouth.smile)();
  }
  // glasses + eyepatch over the eyes
  if (ex.has('glassesRound') || ex.has('glassesSquare')) {
    const fc = ex.has('glassesRound') ? '#6a4024' : '#26222a';
    for (const x0 of [eL, eR]) {
      f.rect(x0 - 1, eyeY - 1, 5, 1, fc); f.rect(x0 - 1, eyeY + 4, 5, 1, fc);
      f.rect(x0 - 2, eyeY, 1, 4, fc); f.rect(x0 + 3, eyeY, 1, 4, fc);
      if (ex.has('glassesSquare')) { f.px(x0 - 2, eyeY - 1, fc); f.px(x0 + 3, eyeY - 1, fc); f.px(x0 - 2, eyeY + 4, fc); f.px(x0 + 3, eyeY + 4, fc); }
    }
    f.rect(eL + 3, eyeY, eR - eL - 3, 1, fc);
  }
  if (ex.has('eyepatch')) { f.rect(eR - 1, eyeY - 1, 5, 5, '#1c1a20'); for (let x = 0; x < eR - 1; x++) f.px(x, eyeY - 3 + Math.round(x * 0.2), '#1c1a20'); }
}

function paintEars(f, skin, side) {
  f.fill((x, y) => (hash(x, y, 7) > 0.94 ? tone(skin, -0.03) : skin));
  const ex = side === 'right' ? Math.floor(f.w * 0.45) : Math.floor(f.w * 0.55) - 3;
  const ey = Math.round(f.h * 0.5);
  f.rect(ex, ey, 3, 4, tone(skin, -0.08));
  f.rect(ex + 1, ey + 1, 1, 2, tone(skin, -0.2));
}

// ---------------------------------------------------------------- hair
function hairPainter(hair, cfg) {
  const hl = tone(hair, 0.22), sh = tone(hair, -0.22), deep = tone(hair, -0.38);
  const strand = (x, y) => {
    const r = hash(x, 0, 21);
    if (y === 2 && r > 0.3) return hl; // glossy highlight band
    if (y === 3 && r > 0.65) return hl;
    if (r > 0.8) return sh;
    if (hash(x, y, 22) > 0.9) return deep;
    return hair;
  };
  // curls: little 2x2 clumps, lit on the top-left, shadowed bottom-right
  const curly = (x, y) => {
    const cx = (x + (Math.floor(y / 2) % 2)) >> 1, cy = y >> 1;
    const lx = (x + (Math.floor(y / 2) % 2)) & 1, ly = y & 1;
    const n = hash(cx, cy, 23);
    if (lx === 0 && ly === 0) return n > 0.62 ? mix(hair, hl, 0.6) : hair;
    if (lx === 1 && ly === 1) return n > 0.3 ? sh : mix(sh, deep, 0.5);
    return n > 0.85 ? sh : hair;
  };
  // waves: soft diagonal bands
  const wave = (x, y) => { const b = (y + Math.round(Math.sin(x * 0.7) * 1.5)) % 5; return b === 0 ? hl : b === 3 ? sh : hash(x, y, 24) > 0.92 ? deep : hair; };
  return { strand: cfg.hair === 'curly' || cfg.hair === 'afro' || cfg.hair === 'puffs' ? curly : cfg.hair === 'wavy' ? wave : strand, hl, sh, deep };
}

// Front edge of the hair cap: how far the fringe hangs down in each column (in px from the cap bottom).
const FRINGES = {
  crop: (x) => (x % 5 === 2 ? 3 : 2),
  buzz: () => 0,
  sidepart: (x, w) => (x < w * 0.62 ? 4 - Math.floor((x / (w * 0.62)) * 3) : 1),
  messy: (x) => [3, 1, 4, 2, 3, 1, 2, 4, 1, 3][x % 10],
  curly: (x) => (x % 3 === 0 ? 3 : 2),
  bob: (x, w) => (x < 2 || x > w - 3 ? 7 : 3),
  shoulder: (x, w) => (x < 2 || x > w - 3 ? 7 : x % 5 === 2 ? 4 : 3),
  long: (x, w) => (x < 2 || x > w - 3 ? 8 : 3),
  ponytail: (x) => (x % 5 === 0 ? 2 : 1),
  buns: (x) => (x % 4 === 0 ? 3 : 2),
  braids: (x, w) => (x < 2 || x > w - 3 ? 6 : 2),
  beaniehair: (x) => [2, 3, 1, 3, 2][x % 5],
  afro: () => 2,
  pixie: (x, w) => (x < w * 0.7 ? 5 - Math.floor((x / (w * 0.7)) * 4) : 1),
  pompadour: () => 0,
  undercut: (x, w) => (x > w * 0.45 ? 4 - Math.floor(((w - x) / (w * 0.55)) * 3) : 0),
  spiky: (x) => [2, 3, 1, 3, 2, 4][x % 6],
  manbun: () => 0,
  highpony: (x) => (x % 6 === 3 ? 2 : 1),
  pigtails: (x, w) => (Math.abs(x - w / 2) < 1 ? 0 : 2),
  wavy: (x, w) => (x < 2 || x > w - 3 ? 8 : x % 4 === 1 ? 4 : 3),
  hime: (x, w) => (x < 3 || x > w - 4 ? 9 : 5),
  locs: (x) => (x % 3 === 0 ? 4 : 2),
  cornrows: () => 0,
  bowl: () => 5,
  shag: (x) => [4, 2, 5, 3, 4, 2, 3][x % 7],
  sidebraid: (x, w) => (x > w * 0.4 ? 4 - Math.floor(((x - w * 0.4) / (w * 0.6)) * 3) : 1),
  puffs: (x, w) => (Math.abs(x - w / 2) < 1 ? 0 : 1),
  fauxhawk: (x, w) => (Math.abs(x - w / 2) < w * 0.15 ? 2 : 0),
  mullet: (x) => (x % 5 === 2 ? 3 : 2),
  curtains: (x, w) => { const d = Math.abs(x - w / 2) / (w / 2); return d < 0.12 ? 1 : Math.round(2 + d * 5); },
};
const STUBBLE = new Set(['buzz', 'undercut', 'fauxhawk', 'cornrows', 'mohawk']);

function buildHair(atlas, cfg, head, hatted = false) {
  const meshes = [];
  const style = cfg.hair;
  if (style === 'bald') return meshes;
  const hair = HAIR_COLORS[cfg.hairColor] || HAIR_COLORS[2];
  const P = hairPainter(hair, cfg);
  const { w: HW, h: HH, d: HD } = head;
  const strand = { all: (f) => f.fill(P.strand) };
  const tie = (c = '#e05a6a') => ({ all: (f) => f.fill(c) });
  // Close-cropped styles: a thin shell over the whole skull (top, sides and back) cut at the hairline,
  // with a stubbly mix of hair and skin so it reads as short hair, not a helmet or a bald head.
  if (STUBBLE.has(style)) {
    const skin = SKINS[cfg.skin] || SKINS[3];
    const stub = (f) => f.fill((x, y) => { const n = hash(x, y, 27); return n > 0.55 ? hair : n > 0.25 ? mix(hair, skin, 0.35) : mix(hair, skin, 0.55); });
    const rows = (f) => f.fill((x, y) => (x % 4 === 0 ? mix(hair, skin, 0.6) : (y + x) % 3 === 0 ? P.hl : hair));
    const tex = style === 'cornrows' ? rows : stub;
    meshes.push(place(softBox(atlas, HW + 0.035, 0.42, HD + 0.035, 0.1, {
      all: tex,
      front: (f) => { tex(f); for (let x = 0; x < f.w; x++) { const keep = Math.round(f.h * 0.32) + (FRINGES[style]?.(x, f.w) ?? 0); for (let y = keep; y < f.h; y++) f.px(x, y, 'clear'); } },
      right: (f) => { tex(f); for (let y = Math.round(f.h * 0.55); y < f.h; y++) for (let x = Math.round(f.w * 0.3); x < f.w; x++) f.px(x, y, 'clear'); },
      left: (f) => { tex(f); for (let y = Math.round(f.h * 0.55); y < f.h; y++) for (let x = 0; x < Math.round(f.w * 0.7); x++) f.px(x, y, 'clear'); },
      bottom: (f) => f.fill('clear'),
    }), 0, HH - 0.16, -0.005));
    if (style === 'mohawk' && !hatted) {
      for (let i = 0; i < 5; i++) { const sp = place(softBox(atlas, 0.12, 0.2 - Math.abs(i - 1.5) * 0.02, 0.13, 0.05, strand), 0, HH + 0.1, HD / 2 - 0.08 - i * 0.11); sp.rotation.x = -0.25 - i * 0.12; meshes.push(sp); }
    }
    if (style === 'fauxhawk' && !hatted) {
      for (let i = 0; i < 4; i++) { const sp = place(softBox(atlas, 0.16 - i * 0.015, 0.14, 0.12, 0.05, strand), 0, HH + 0.06, HD / 2 - 0.1 - i * 0.12); sp.rotation.x = -0.3; meshes.push(sp); }
    }
    if (style === 'undercut') {
      // a long top swept to one side, falling over the brow
      meshes.push(place(softBox(atlas, HW * 0.86, 0.12, HD * 0.92, 0.05, strand), 0.02, HH + 0.04, 0));
      const flop = place(softBox(atlas, HW * 0.55, 0.08, 0.2, 0.035, strand), HW * 0.16, HH - 0.02, HD / 2 - 0.02); flop.rotation.set(0.5, 0, -0.25); meshes.push(flop);
    }
    return meshes;
  }
  // Curly top and afro: the volume sits ON the head (its bottom edge at the hairline, so nothing has to be
  // cut away to show the face) and a band of curl clumps runs along the forehead, so the front reads as
  // hair from every angle.
  if (style === 'afro' || style === 'curly') {
    const big = style === 'afro';
    const curls = { all: (f) => f.fill(P.strand) };
    const hairline = HH - (big ? 0.13 : 0.12); // where the fringe ends on the forehead
    const pw = HW + (big ? 0.3 : 0.08), pd = HD + (big ? 0.28 : 0.08), ph = big ? 0.44 : 0.22;
    const py = big ? HH + 0.08 : HH + 0.0;
    meshes.push(place(softBox(atlas, pw, ph, pd, big ? 0.17 : 0.09, curls), 0, py, big ? -0.04 : -0.01));
    // sides and back of the head: down over the ears for the afro, a short nape for the curly top
    const sideH = big ? 0.4 : 0.22, sideY = big ? HH - 0.14 : HH - 0.16;
    for (const s of [-1, 1]) meshes.push(place(softBox(atlas, big ? 0.16 : 0.07, sideH, HD * (big ? 0.8 : 0.62), big ? 0.07 : 0.03, curls), s * (HW / 2 + (big ? 0.05 : 0.0)), sideY, -HD * (big ? 0.12 : 0.18)));
    meshes.push(place(softBox(atlas, HW + (big ? 0.24 : 0.04), big ? 0.46 : 0.3, big ? 0.16 : 0.09, big ? 0.07 : 0.04, curls), 0, HH - (big ? 0.12 : 0.15), -HD / 2 - (big ? 0.04 : 0.0)));
    // the curls along the forehead: a row of round clumps, alternating a little in height and depth
    const n = big ? 6 : 5, cw = (HW + (big ? 0.2 : 0.06)) / n;
    for (let i = 0; i < n; i++) {
      const x = -((HW + (big ? 0.2 : 0.06)) / 2) + cw * (i + 0.5);
      const drop = (i % 2 ? 0.02 : 0) + (i === 0 || i === n - 1 ? -0.04 : 0);
      const clump = place(softBox(atlas, cw * 1.18, big ? 0.16 : 0.13, big ? 0.14 : 0.11, big ? 0.065 : 0.05, curls), x, hairline + 0.04 - drop, HD / 2 + (big ? 0.06 : 0.02) - (i % 2) * 0.015);
      meshes.push(clump);
    }
    // a second, higher row of clumps for the afro so the front has depth
    if (big) for (let i = 0; i < 5; i++) meshes.push(place(softBox(atlas, (HW + 0.2) / 5 * 1.2, 0.16, 0.13, 0.065, curls), -((HW + 0.2) / 2) + (HW + 0.2) / 5 * (i + 0.5), hairline + 0.17 + (i % 2) * 0.03, HD / 2 + 0.09));
    return meshes;
  }
  const afro = style === 'afro';
  const capW = HW + (afro ? 0.24 : style === 'curly' ? 0.07 : 0.05);
  const capD = HD + (afro ? 0.22 : style === 'curly' ? 0.07 : 0.05);
  const capH = afro ? 0.48 : style === 'buzz' ? 0.14 : 0.3;
  const capY = HH - capH / 2 + (afro ? 0.17 : style === 'buzz' ? 0.03 : 0.07);
  const fringe = FRINGES[style] || FRINGES.crop;
  const sideLen = { bob: 0.62, shoulder: 0.72, long: 0.72, braids: 0.6, wavy: 0.86, hime: 0.9, shag: 0.5, pixie: 0, sidebraid: 0.42 }[style] || 0;
  const paint = {
    all: (f) => f.fill(P.strand),
    front: (f) => {
      f.fill(P.strand);
      // cut the fringe: everything below the fringe line becomes transparent so the face shows through
      for (let x = 0; x < f.w; x++) {
        const hang = afro ? 3 : fringe(x, f.w);
        const keep = Math.round(f.h * (style === 'buzz' ? 0.4 : 0.42)) + hang;
        for (let y = keep; y < f.h; y++) f.px(x, y, 'clear');
        if (keep - 1 >= 0 && keep - 1 < f.h) f.px(x, keep - 1, P.sh);
      }
    },
    top: (f) => { f.fill(P.strand); if (style === 'sidepart') { const px = Math.round(f.w * 0.3); for (let y = Math.round(f.h * 0.25); y < f.h; y++) f.px(px, y, tone(hair, -0.45)); } },
    right: (f) => sideCut(f, 'right'),
    left: (f) => sideCut(f, 'left'),
  };
  function sideCut(f, side) {
    f.fill(P.strand);
    if (sideLen || afro) return;
    // sideburn: keep a strip near the front, clear an ear window
    const front = side === 'right' ? (x) => x < f.w * 0.35 : (x) => x > f.w * 0.65;
    for (let y = Math.round(f.h * 0.55); y < f.h; y++) for (let x = 0; x < f.w; x++) if (!front(x) || y > f.h * 0.8) f.px(x, y, 'clear');
  }
  meshes.push(place(softBox(atlas, capW, capH, capD, afro ? 0.16 : 0.09, paint), 0, capY, -0.005));
  // nape: hair down the back of the head to just above the neck (short styles; long ones have a back panel)
  if (!sideLen && !afro && style !== 'buzz') {
    const napeH = HH * 0.62;
    meshes.push(place(softBox(atlas, HW - 0.03, napeH, 0.1, 0.045, {
      all: (f) => f.fill(P.strand),
      back: (f) => { f.fill(P.strand); for (let x = 0; x < f.w; x++) for (let y = f.h - (x % 3 ? 1 : 2); y < f.h; y++) f.px(x, y, 'clear'); },
    }), 0, HH - napeH / 2 - 0.1, -(HD / 2 - 0.03)));
  }
  // long styles: a back panel and side curtains
  if (sideLen) {
    const backH = sideLen;
    meshes.push(place(softBox(atlas, capW, backH, 0.12, 0.05, {
      all: (f) => f.fill(P.strand),
      back: (f) => { f.fill(P.strand); if (style !== 'braids') for (let x = 0; x < f.w; x++) for (let y = f.h - (x % 3 === 0 ? 1 : 2); y < f.h; y++) f.px(x, y, 'clear'); },
    }), 0, HH + 0.04 - backH / 2, -HD / 2 - 0.02));
    if (style !== 'braids' && style !== 'sidebraid') for (const s of [-1, 1]) {
      // side curtains run from the back of the head to just behind the face, so there is no gap
      const depth = style === 'bob' ? HD * 0.82 : HD * 0.7;
      const len = style === 'bob' ? backH * 0.92 : backH * 0.82;
      meshes.push(place(softBox(atlas, 0.08, len, depth, 0.035, {
        all: (f) => f.fill(P.strand),
        right: (f) => { f.fill(P.strand); if (style === 'shag' || style === 'wavy') for (let x = 0; x < f.w; x++) for (let y = f.h - [1, 3, 2, 4][x % 4]; y < f.h; y++) f.px(x, y, 'clear'); },
        left: (f) => { f.fill(P.strand); if (style === 'shag' || style === 'wavy') for (let x = 0; x < f.w; x++) for (let y = f.h - [1, 3, 2, 4][x % 4]; y < f.h; y++) f.px(x, y, 'clear'); },
      }), s * (capW / 2 - 0.02), HH + 0.04 - len / 2, -HD / 2 + depth / 2 - 0.02));
    }
  }
  if (style === 'braids') for (const s of [-1, 1]) {
    meshes.push(place(softBox(atlas, 0.1, 0.5, 0.1, 0.045, { all: (f) => f.fill((x, y) => ((y + (x % 2)) % 3 === 0 ? P.sh : y % 3 === 1 ? P.hl : hair)) }), s * (capW / 2 + 0.01), HH * 0.25, HD * 0.18));
    meshes.push(place(softBox(atlas, 0.12, 0.06, 0.12, 0.03, { all: (f) => f.fill('#e05a6a') }), s * (capW / 2 + 0.01), HH * 0.25 - 0.27, HD * 0.18));
  }
  if (style === 'buns' && !hatted) for (const s of [-1, 1]) {
    meshes.push(place(softBox(atlas, 0.2, 0.19, 0.2, 0.09, { all: (f) => f.fill(P.strand) }), s * (HW / 2 - 0.02), HH + 0.12, -0.02));
  }
  if (style === 'ponytail') {
    meshes.push(place(softBox(atlas, 0.14, 0.12, 0.12, 0.05, { all: (f) => f.fill('#e05a6a') }), 0, HH * 0.62, -HD / 2 - 0.06));
    const tail = place(softBox(atlas, 0.15, 0.42, 0.13, 0.065, { all: (f) => f.fill(P.strand) }), 0, HH * 0.4, -HD / 2 - 0.12);
    tail.rotation.x = 0.25;
    meshes.push(tail);
  }
  // ---- the newer styles: silhouettes built from a few extra pieces on top of the cap
  if (style === 'pompadour' && !hatted) {
    const q = place(softBox(atlas, HW * 0.86, 0.22, 0.34, 0.09, strand), 0, HH + 0.12, HD / 2 - 0.12); q.rotation.x = -0.32; meshes.push(q);
    meshes.push(place(softBox(atlas, HW * 0.8, 0.1, HD * 0.6, 0.045, strand), 0, HH + 0.08, -0.08));
  }
  if (style === 'spiky' && !hatted) {
    for (const [x, z, rx, rz, l] of [[0, 0.16, -0.7, 0, 0.24], [-0.16, 0.08, -0.4, 0.55, 0.22], [0.16, 0.08, -0.4, -0.55, 0.22], [-0.2, -0.1, 0.3, 0.7, 0.2], [0.2, -0.1, 0.3, -0.7, 0.2], [0, -0.16, 0.7, 0, 0.22], [0, 0, 0, 0, 0.26], [-0.09, -0.02, 0.1, 0.25, 0.24], [0.09, -0.02, 0.1, -0.25, 0.24]]) {
      const sp = place(softBox(atlas, 0.11, l, 0.11, 0.035, strand), x, HH + 0.1, z); sp.rotation.set(rx, 0, rz); meshes.push(sp);
    }
  }
  if ((style === 'manbun') && !hatted) {
    meshes.push(place(softBox(atlas, 0.22, 0.2, 0.2, 0.09, strand), 0, HH + 0.06, -HD / 2 + 0.02));
    meshes.push(place(softBox(atlas, 0.16, 0.05, 0.16, 0.02, tie('#3a2a20')), 0, HH - 0.02, -HD / 2 + 0.04));
  }
  if (style === 'highpony') {
    meshes.push(place(softBox(atlas, 0.15, 0.1, 0.12, 0.04, tie()), 0, HH + 0.02, -HD / 2 + 0.02));
    const t1 = place(softBox(atlas, 0.17, 0.3, 0.15, 0.07, strand), 0, HH - 0.08, -HD / 2 - 0.1); t1.rotation.x = 0.55; meshes.push(t1);
    const t2 = place(softBox(atlas, 0.14, 0.32, 0.12, 0.06, strand), 0, HH - 0.32, -HD / 2 - 0.2); t2.rotation.x = 0.2; meshes.push(t2);
  }
  if (style === 'pigtails') for (const sx of [-1, 1]) {
    meshes.push(place(softBox(atlas, 0.12, 0.1, 0.12, 0.04, tie('#f0c040')), sx * (HW / 2 + 0.04), HH * 0.5, -HD * 0.1));
    const t = place(softBox(atlas, 0.15, 0.42, 0.14, 0.065, strand), sx * (HW / 2 + 0.07), HH * 0.12, -HD * 0.12); t.rotation.z = sx * -0.12; meshes.push(t);
  }
  if (style === 'locs') {
    for (let i = 0; i < 11; i++) {
      const a = -1.2 + (i / 10) * 2.4; // around the back and sides
      const x = Math.sin(a) * (HW / 2 + 0.03), z = -Math.cos(a) * (HD / 2 + 0.03) * 0.95;
      const len = 0.42 + (i % 3) * 0.06;
      const l = place(softBox(atlas, 0.07, len, 0.07, 0.03, { all: (f) => f.fill((x2, y) => (y % 3 === 0 ? P.sh : hair)) }), x, HH * 0.42 - len / 2 + 0.2, z);
      meshes.push(l);
      if (i % 3 === 1) meshes.push(place(softBox(atlas, 0.08, 0.05, 0.08, 0.02, tie('#e8c040')), x, HH * 0.42 - len + 0.21, z));
    }
  }
  if (style === 'bowl') meshes.push(place(softBox(atlas, HW + 0.1, 0.18, HD + 0.1, 0.08, strand), 0, HH - 0.16, -0.01));
  if (style === 'sidebraid') {
    for (let i = 0; i < 5; i++) {
      const b = place(softBox(atlas, 0.12 - i * 0.008, 0.12, 0.11, 0.045, { all: (f) => f.fill((x, y) => ((x + y) % 3 === 0 ? P.sh : y === 1 ? P.hl : hair)) }), HW / 2 - 0.02, HH * 0.42 - i * 0.1, HD * 0.18 + i * 0.012);
      b.rotation.z = (i % 2 ? 0.25 : -0.25); meshes.push(b);
    }
    meshes.push(place(softBox(atlas, 0.1, 0.05, 0.1, 0.02, tie('#7a50c0')), HW / 2 - 0.02, HH * 0.42 - 0.5, HD * 0.18 + 0.06));
  }
  if (style === 'puffs' && !hatted) {
    const curl = { all: (f) => f.fill((x, y) => (hash(x >> 1, y >> 1, 23) > 0.6 ? P.hl : (x + y) % 3 === 0 ? P.sh : hair)) };
    for (const sx of [-1, 1]) {
      meshes.push(place(softBox(atlas, 0.3, 0.28, 0.3, 0.13, curl), sx * (HW / 2 - 0.02), HH + 0.12, -0.04));
      meshes.push(place(softBox(atlas, 0.18, 0.05, 0.18, 0.02, tie('#e8508a')), sx * (HW / 2 - 0.06), HH - 0.0, -0.04));
    }
  }
  if (style === 'mullet') meshes.push(place(softBox(atlas, HW * 0.86, 0.36, 0.12, 0.05, { all: strand.all, back: (f) => { f.fill(P.strand); for (let x = 0; x < f.w; x++) for (let y = f.h - (x % 2 ? 2 : 1); y < f.h; y++) f.px(x, y, 'clear'); } }), 0, HH * 0.14, -HD / 2 - 0.03));
  if (style === 'curtains' || style === 'hime') for (const sx of [-1, 1]) {
    // locks in front of the ears, framing the face
    const len = style === 'hime' ? 0.46 : 0.32;
    meshes.push(place(softBox(atlas, 0.08, len, 0.12, 0.035, strand), sx * (HW / 2 + 0.01), HH - 0.08 - len / 2, HD / 2 - 0.1));
  }
  if (style === 'wavy') for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const w = place(softBox(atlas, 0.1, 0.18, 0.2, 0.05, strand), sx * (HW / 2 + 0.04 + (i % 2) * 0.02), HH * 0.2 - i * 0.16, -HD * 0.12);
    meshes.push(w);
  }
  if ((style === 'messy' || style === 'beaniehair') && !hatted) for (const [x, z, s, rx, ry, rz] of [[-0.13, 0.06, 0.12, -0.5, 0.15, 0.6], [0.12, -0.04, 0.13, 0.45, 0.25, -0.5], [0, 0.16, 0.11, -0.7, 0, 0.15], [0.05, -0.16, 0.1, 0.6, 0, 0.3]]) {
    // flat, swept spikes (box depth runs front-to-back)
    const tuft = place(softBox(atlas, s * 0.7, s * 0.45, s * 1.5, s * 0.2, { all: (f) => f.fill(P.strand) }), x, HH + 0.1, z);
    tuft.rotation.set(rx, ry, rz);
    meshes.push(tuft);
  }

  return meshes;
}

// ---------------------------------------------------------------- hats
// Round hats are lathes painted in bands (u: round the hat, rows: along the profile), so a brim, a ribbon
// and a crown are one smooth piece in the same pixel style as the rest of the angler.
const ELL = 0.9; // heads are a little shallower than wide: hats are squashed front to back to match
export const HATTED = new Set(['beanie', 'bucket', 'hat_bucket_tan', 'cap', 'cap_star', 'hat_straw', 'hat_captain',
  'sunhat', 'pighat', 'boonie', 'cowboy', 'fedora', 'hat_tophat', 'boater', 'sailor', 'beret', 'newsboy', 'hat_frog', 'trapper', 'bandana',
  'hat_crab', 'hat_coconut', 'hat_pail', 'hat_swimcap', // (v1.15 beach games prizes)
  'hat_earflap', 'hat_bobble', 'hat_aviator']); // (Frostmere)

// What each crown-covering hat hides: hair above the hat's seat is pulled inside this shape, so no hairstyle
// pokes through a hat. round: [crown base radius, crown height above the seat]; box: [width, depth, top above seat].
const SEAT_DROP = 0.04; // round hats sit this far below the top of the head
const COVER = {
  sunhat: { round: [0.39, 0.265] }, pighat: { round: [0.39, 0.265] }, boonie: { round: [0.39, 0.23] },
  bucket: { round: [0.385, 0.22] }, hat_bucket_tan: { round: [0.385, 0.22] }, hat_straw: { round: [0.385, 0.2] },
  cowboy: { round: [0.385, 0.25] }, fedora: { round: [0.385, 0.24] }, hat_tophat: { round: [0.38, 0.48] },
  boater: { round: [0.39, 0.17] }, sailor: { round: [0.385, 0.2] }, beret: { round: [0.39, 0.16] },
  newsboy: { round: [0.395, 0.21] }, hat_frog: { round: [0.39, 0.28] }, trapper: { round: [0.4, 0.26] },
  hat_crab: { round: [0.39, 0.22] }, hat_coconut: { round: [0.395, 0.22] }, hat_pail: { round: [0.39, 0.34] }, hat_swimcap: { round: [0.4, 0.2] },
  hat_earflap: { round: [0.4, 0.27] }, hat_bobble: { round: [0.4, 0.42] }, hat_aviator: { round: [0.4, 0.26] },
  beanie: { box: [0.68, 0.62, 0.17 + SEAT_DROP], seat: 0.13 }, cap: { box: [0.66, 0.6, 0.14 + SEAT_DROP], seat: 0.06 }, cap_star: { box: [0.66, 0.6, 0.14 + SEAT_DROP], seat: 0.06 },
  hat_captain: { box: [0.68, 0.62, 0.17 + SEAT_DROP], seat: 0.05 }, bandana: { box: [0.66, 0.6, 0.065 + SEAT_DROP], seat: 0.065 },
};

/** Bakes each hair mesh into head space and pulls any part above the hat seat inside the hat's crown. */
function tuckHair(meshes, hat, head) {
  const c = COVER[hat];
  if (!c) return;
  const seat = head.h - (c.seat ?? SEAT_DROP);
  const v = new THREE.Vector3();
  for (const m of meshes) {
    m.updateMatrix();
    const g = m.geometry;
    g.applyMatrix4(m.matrix);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const h = v.y - seat;
      if (h <= 0) continue;
      if (c.round) {
        const [r0, top] = c.round;
        const y = Math.min(h, top * 0.9);
        const rMax = r0 * 0.94 * Math.sqrt(Math.max(0.02, 1 - (y / top) ** 4));
        const rr = Math.hypot(v.x, v.z / ELL);
        if (rr > rMax) { v.x *= rMax / rr; v.z *= rMax / rr; }
        v.y = seat + y;
      } else {
        const [w, d, top] = c.box;
        v.x = Math.max(-w * 0.46, Math.min(w * 0.46, v.x));
        v.z = Math.max(-d * 0.46, Math.min(d * 0.46, v.z));
        v.y = seat + Math.min(h, top * 0.9);
      }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true;
    g.computeBoundingSphere();
  }
}

function flowerPaint(petal, mid = '#f4d040') {
  return (f) => f.fill((x, y) => {
    const cx = (f.w - 1) / 2, cy = (f.h - 1) / 2, d = Math.hypot(x - cx, y - cy);
    if (d < 0.9) return mid;
    if (d > Math.min(f.w, f.h) / 2 + 0.1) return 'clear';
    const a = Math.atan2(y - cy, x - cx);
    return Math.cos(a * 5) > -0.2 || d < 1.8 ? (d > Math.min(f.w, f.h) / 2 - 1 ? tone(petal, -0.12) : petal) : 'clear';
  });
}

function buildHat(atlas, cfg, head) {
  const { w: HW, h: HH, d: HD } = head;
  const out = [];
  const knit = (c) => (f) => f.fill((x, y) => ((x + (y >> 1)) % 2 ? c : tone(c, -0.1)));
  const solid = (c, k = 0.06) => (f) => f.fill((x, y) => (hash(x, y, 31) > 0.85 ? tone(c, -k) : c));
  const band = (c, bc, rows = 3) => (f) => { solid(c)(f); f.rect(0, f.h - rows, f.w, rows, bc); };
  const pick = HAT_COLORS[cfg.hatColor];
  const main = (def) => (pick && pick !== 'default' ? pick : def);
  const weave = (base) => (x, y) => ((x + y) % 3 === 0 ? tone(base, -0.1) : (x - y + 40) % 4 === 0 ? tone(base, 0.12) : base);
  const Y0 = HH - 0.04; // hat seat on the head
  const lathe = (prof, colors, opts = {}) => {
    const geo = latheGeo(atlas, prof, (key, x, row, k) => {
      const c = colors[key];
      return typeof c === 'function' ? c(x, row, k) : c ?? '#ff00ff';
    }, { segs: 20, rps: 3, pw: 60, ...opts });
    const m = place(geo, opts.x || 0, Y0 + (opts.y || 0), opts.z || 0);
    m.scale.set(1, 1, opts.ell ?? ELL);
    if (opts.rz) m.rotation.z = opts.rz;
    if (opts.rx) m.rotation.x = opts.rx;
    out.push(m);
    return m;
  };
  const bit = (w, h, d, r, paint, x, y, z, rot) => {
    const m = place(softBox(atlas, w, h, d, r, typeof paint === 'function' ? { all: paint } : paint), x, y, z);
    if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    out.push(m); return m;
  };
  // a point on the crown at angle a (0 = front), radius r, height y above the seat
  const onCrown = (a, r, y) => [Math.sin(a) * r, Y0 + y, Math.cos(a) * r * ELL];
  const stitch = (c) => (x, row) => (row === 1 && x % 3 === 0 ? tone(c, 0.18) : hash(x, row, 77) > 0.9 ? tone(c, -0.06) : c);
  const shade = (c, k) => (x, row) => (hash(x, row, 9) > 0.86 ? tone(c, -0.05) : tone(c, k));

  switch (cfg.hat) {
    case 'bucket': case 'hat_bucket_tan': {
      const c = main(cfg.hat === 'bucket' ? '#5f8050' : '#c8b088');
      lathe([[0.385, 0], [0.55, -0.075, 'u'], [0.565, -0.055, 'b'], [0.4, 0.03, 'b'], [0.395, 0.07, 'r'], [0.38, 0.16, 'c'], [0.33, 0.215, 'c'], [0, 0.225, 'c']].map((p, i, a) => (i === 0 ? [p[0], p[1], 'u'] : p)),
        { u: shade(c, -0.2), b: stitch(c), r: tone(c, -0.22), c: shade(c, 0) });
      break;
    }
    case 'beanie':
      out.push(place(softBox(atlas, HW + 0.08, 0.3, HD + 0.08, 0.12, { all: knit(main('#c0392b')), front: (f) => { knit(main('#c0392b'))(f); f.rect(0, f.h - 3, f.w, 3, tone(main('#c0392b'), -0.2)); } }), 0, HH + 0.02, 0));
      out.push(place(softBox(atlas, 0.13, 0.13, 0.13, 0.06, { all: knit('#f4f0e8') }), 0, HH + 0.22, 0));
      break;
    case 'cap': {
      const c = main('#2e5a9a');
      out.push(place(softBox(atlas, HW + 0.06, 0.2, HD + 0.06, 0.09, { all: solid(c), front: (f) => { solid(c)(f); f.rect(Math.floor(f.w / 2) - 2, 2, 4, 3, '#f0e8d0'); } }), 0, HH + 0.04, 0));
      out.push(place(softBox(atlas, HW * 0.8, 0.04, 0.22, 0.02, { all: solid(tone(c, -0.15)) }), 0, HH - 0.03, HD / 2 + 0.1));
      break;
    }
    case 'cap_star': { // v1.9.4: Sundae's maroon cap (its lone star is a crisp decal added in buildAvatar)
      const c = '#5c1220';
      out.push(place(softBox(atlas, HW + 0.06, 0.2, HD + 0.06, 0.09, { all: solid(c) }), 0, HH + 0.04, 0));
      out.push(place(softBox(atlas, HW * 0.8, 0.04, 0.22, 0.02, { all: solid(tone(c, -0.15)) }), 0, HH - 0.03, HD / 2 + 0.1));
      break;
    }
    case 'visor':
      out.push(place(softBox(atlas, HW + 0.06, 0.07, HD + 0.06, 0.03, { all: solid('#e6e6e0') }), 0, HH - 0.06, 0));
      out.push(place(softBox(atlas, HW * 0.8, 0.035, 0.24, 0.015, { all: solid(main('#3a8a5a')) }), 0, HH - 0.08, HD / 2 + 0.11));
      break;
    case 'hat_straw': {
      const s = '#e8c870';
      lathe([[0.385, 0, 'u'], [0.72, -0.02, 'u'], [0.73, 0.005, 'b'], [0.4, 0.03, 'b'], [0.395, 0.08, 'r'], [0.37, 0.17, 'c'], [0.3, 0.2, 'c'], [0, 0.2, 'c']],
        { u: weave(tone(s, -0.15)), b: weave(s), r: main('#b04030'), c: weave(s) });
      break;
    }
    case 'hat_captain':
      out.push(place(softBox(atlas, HW + 0.08, 0.22, HD + 0.08, 0.06, { all: band('#f4f4f0', '#26263a', 2), front: (f) => { band('#f4f4f0', '#26263a', 2)(f); f.rect(Math.floor(f.w / 2) - 1, 2, 3, 3, '#e0c040'); } }), 0, HH + 0.06, 0));
      out.push(place(softBox(atlas, HW * 0.8, 0.035, 0.18, 0.015, { all: solid('#26263a') }), 0, HH - 0.03, HD / 2 + 0.08));
      break;
    case 'hat_crown': {
      const gold = (f) => { f.fill((x, y) => (y === 0 ? '#fff0a0' : (x + y) % 5 === 0 ? '#d89a20' : '#f2c040')); for (let x = 0; x < f.w; x++) { const tip = x % 4; if (tip === 0 || tip === 3) for (let y = 0; y < 3; y++) f.px(x, y, 'clear'); } f.px(Math.floor(f.w / 2), 4, '#d03050'); };
      out.push(place(softBox(atlas, HW * 0.62, 0.16, HD * 0.62, 0.03, { all: gold, top: (f) => f.fill('clear') }, { shade: false }), 0, HH + 0.08, 0));
      break;
    }
    // ---- v1.15 Open Waters: the beach games' prize hats
    case 'hat_visor_beach': // Spike Master: a teal sun visor with a white band
      out.push(place(softBox(atlas, HW + 0.06, 0.08, HD + 0.06, 0.03, { all: band('#f4f4f0', main('#2fa8a0'), 2) }), 0, HH - 0.06, 0));
      out.push(place(softBox(atlas, HW * 0.85, 0.035, 0.28, 0.015, { all: solid(main('#2fa8a0')) }), 0, HH - 0.08, HD / 2 + 0.13));
      break;
    case 'hat_crab': { // Crab Whisperer: a red crab shell with claws and stalk eyes
      const c = main('#e2483a');
      lathe([[0.395, -0.01, 'r'], [0.41, 0.06, 'c'], [0.37, 0.15, 'c'], [0.24, 0.21, 'c'], [0, 0.225, 'c']], { r: tone(c, -0.22), c: (x, row) => (hash(x, row, 5) > 0.88 ? tone(c, 0.15) : c) });
      for (const s of [-1, 1]) {
        bit(0.05, 0.12, 0.05, 0.02, (f) => f.fill(c), s * 0.1, Y0 + 0.27, 0.16);
        bit(0.07, 0.07, 0.07, 0.03, { all: (f) => f.fill('#ffffff'), front: (f) => { f.fill('#ffffff'); f.rect(Math.floor(f.w / 2) - 1, Math.floor(f.h / 2) - 1, 2, 2, '#1a1a1a'); } }, s * 0.1, Y0 + 0.35, 0.17);
        bit(0.1, 0.06, 0.1, 0.03, (f) => f.fill(c), s * 0.43, Y0 + 0.02, 0.12, [0, 0, s * 0.5]);
        bit(0.11, 0.08, 0.14, 0.04, (f) => f.fill(tone(c, -0.08)), s * 0.5, Y0 + 0.08, 0.22, [0, s * 0.3, s * 0.3]);
      }
      break;
    }
    case 'hat_coconut': { // Coconut Sniper: half a coconut shell, white rim, a paper umbrella
      const c = main('#6a4a2a');
      lathe([[0.4, -0.015, 'w'], [0.415, 0.02, 'w'], [0.41, 0.06, 'c'], [0.36, 0.15, 'c'], [0.22, 0.21, 'c'], [0, 0.225, 'c']], { w: '#f4efe2', c: (x, row) => (hash(x, row, 17) > 0.7 ? tone(c, 0.18) : hash(x, row, 3) > 0.8 ? tone(c, -0.15) : c) });
      bit(0.015, 0.22, 0.015, 0.005, (f) => f.fill('#e8e0c8'), 0.12, Y0 + 0.32, -0.02, [0, 0, -0.3]);
      bit(0.24, 0.05, 0.24, 0.04, (f) => f.fill((x, y) => ((x >> 1) % 2 ? '#f07860' : '#f2c84a')), 0.16, Y0 + 0.42, -0.02, [0, 0, -0.3]);
      break;
    }
    case 'hat_pail': { // Sand Architect: an upside-down sand pail with a yellow rim and a handle
      const c = main('#e04a3a');
      lathe([[0.415, -0.02, 'y'], [0.42, 0.03, 'y'], [0.41, 0.04, 'c'], [0.33, 0.3, 'c'], [0.32, 0.32, 't'], [0, 0.33, 't']], { y: '#f0c030', c: (x, row) => (hash(x, row, 23) > 0.9 ? tone(c, 0.12) : c), t: tone(c, -0.12) });
      for (const s of [-1, 1]) bit(0.025, 0.2, 0.025, 0.01, (f) => f.fill('#c8ccd0'), s * 0.36, Y0 - 0.06, 0, [0, 0, s * 0.15]);
      break;
    }
    case 'hat_swimcap': { // Big Splash: a white rubber swim cap with a pink flower
      const c = main('#f4f4f0');
      lathe([[0.405, -0.06, 'e'], [0.41, -0.02, 'c'], [0.4, 0.08, 'c'], [0.33, 0.17, 'c'], [0.18, 0.21, 'c'], [0, 0.215, 'c']], { e: tone(c, -0.1), c: (x, row) => (hash(x, row, 41) > 0.82 ? tone(c, -0.05) : c) });
      bit(0.16, 0.16, 0.03, 0.01, flowerPaint('#f080a8'), 0.2, Y0 + 0.12, 0.3, [0, 0.5, 0]);
      break;
    }
    // ---- new hats
    case 'sunhat': case 'pighat': {
      const pig = cfg.hat === 'pighat';
      const c = main(pig ? '#f4a6b8' : '#f0d9a0');
      const rib = pig ? '#e0607e' : '#e87a9a';
      const body = pig ? shade(c, 0) : weave(c);
      lathe([[0.385, 0, 'u'], [0.62, -0.04, 'u'], [0.86, -0.12, 'u'], [0.875, -0.095, 'e'], [0.63, -0.015, 'b'], [0.4, 0.025, 'r'], [0.395, 0.085, 'c'], [0.385, 0.16, 'c'], [0.34, 0.235, 'c'], [0.2, 0.265, 'c'], [0, 0.27, 'c']],
        { u: pig ? tone(c, -0.12) : weave(tone(c, -0.14)), e: tone(c, -0.08), b: body, r: rib, c: body },
        { deform: (v) => { const r = Math.hypot(v.x, v.z); if (r > 0.42) v.y += Math.sin(Math.atan2(v.z, v.x) * 3) * 0.05 * (r - 0.42) / 0.45; } });
      if (pig) {
        // ears, snout and two little eyes on the crown
        const earP = (f) => f.fill((x, y) => (Math.abs(x - (f.w - 1) / 2) > (y + 1) * (f.w / 2) / f.h ? 'clear' : y > f.h * 0.45 && Math.abs(x - (f.w - 1) / 2) < (y - f.h * 0.4) * 0.5 ? '#f07a98' : c));
        for (const s of [-1, 1]) bit(0.15, 0.15, 0.04, 0.012, earP, s * 0.22, Y0 + 0.31, 0.02, [0.15, 0, -s * 0.35]);
        const [sx, sy, sz] = onCrown(0, 0.4, 0.12);
        bit(0.16, 0.11, 0.06, 0.04, { all: (f) => f.fill(tone(c, -0.05)), front: (f) => { f.fill(tone(c, -0.05)); f.rect(1, 1, f.w - 2, f.h - 2, '#f490aa'); f.rect(Math.floor(f.w / 2) - 2, Math.floor(f.h / 2) - 1, 1, 2, '#8a3048'); f.rect(Math.floor(f.w / 2) + 1, Math.floor(f.h / 2) - 1, 1, 2, '#8a3048'); } }, sx, sy, sz + 0.02);
        for (const s of [-1, 1]) { const [ex, ey, ez] = onCrown(s * 0.42, 0.37, 0.2); bit(0.035, 0.035, 0.02, 0.01, (f) => f.fill('#2a1a20'), ex, ey, ez + 0.01, [0, s * 0.42, 0]); }
      } else {
        const [fx, fy, fz] = onCrown(0.75, 0.41, 0.055);
        bit(0.13, 0.13, 0.04, 0.01, flowerPaint('#f8f4ec'), fx, fy, fz, [0, 0.75, 0]);
        const [gx, gy, gz] = onCrown(0.98, 0.41, 0.045);
        bit(0.1, 0.1, 0.035, 0.01, flowerPaint('#f6a0b8'), gx, gy, gz, [0, 0.98, 0]);
      }
      break;
    }
    case 'boonie': {
      const c = main('#7a8455');
      lathe([[0.385, 0, 'u'], [0.6, -0.085, 'u'], [0.615, -0.062, 'b'], [0.4, 0.03, 'r'], [0.395, 0.085, 'c'], [0.385, 0.17, 'c'], [0.34, 0.225, 'c'], [0, 0.235, 'c']],
        { u: shade(c, -0.2), b: stitch(c), r: tone(c, -0.3), c: (x, row) => (x % 10 === 0 ? tone(c, -0.12) : shade(c, 0)(x, row)) });
      // flies and lures hooked on the band
      const lure = [['#e8402a', '#f4f0e8'], ['#f4c030', '#3a6a2a'], ['#3a8ad0', '#f4f0e8'], ['#f070a0', '#f4c030']];
      lure.forEach(([a, b2], i) => {
        const ang = 0.5 + i * 0.42;
        const [x, y, z] = onCrown(ang, 0.415, 0.06);
        bit(0.05, 0.1, 0.03, 0.012, (f) => f.fill((px, py) => (py < f.h / 2 ? a : b2)), x, y - 0.02, z, [0, ang, 0.2 - i * 0.12]);
      });
      const [hx, hy, hz] = onCrown(-0.6, 0.415, 0.06);
      bit(0.04, 0.06, 0.03, 0.01, (f) => f.fill('#c8c8d0'), hx, hy, hz, [0, -0.6, 0.4]);
      break;
    }
    case 'cowboy': {
      const c = main('#8a5a34');
      lathe([[0.38, 0, 'u'], [0.68, 0, 'u'], [0.7, 0.025, 'b'], [0.395, 0.03, 'r'], [0.39, 0.08, 'c'], [0.375, 0.2, 'c'], [0.33, 0.28, 'c'], [0.16, 0.255, 'c'], [0, 0.235, 'c']],
        { u: shade(c, -0.18), b: shade(c, 0.04), r: (x) => (x % 15 === 0 ? '#d8d8e0' : '#3a2418'), c: shade(c, 0) },
        { deform: (v) => { const r = Math.hypot(v.x, v.z); if (r > 0.4) v.y += 1.6 * Math.max(0, Math.abs(v.x) - 0.36) ** 2 - 0.05 * Math.max(0, v.z) * (r - 0.4); } });
      break;
    }
    case 'fedora': {
      const c = main('#5a5a68');
      lathe([[0.38, 0, 'u'], [0.58, -0.01, 'u'], [0.59, 0.015, 'b'], [0.395, 0.025, 'r'], [0.39, 0.085, 'c'], [0.37, 0.21, 'c'], [0.31, 0.27, 'c'], [0.12, 0.235, 'c'], [0, 0.225, 'c']],
        { u: shade(c, -0.2), b: shade(c, 0.03), r: '#24242c', c: shade(c, 0) },
        { deform: (v) => { const r = Math.hypot(v.x, v.z); if (r > 0.4 && v.z < 0) v.y += 0.5 * (r - 0.4) * (-v.z / r); if (v.y > 0.2 && v.z > 0.1) v.x *= 1 - (v.z - 0.1) * 0.6; } });
      const [fx, fy, fz] = onCrown(-1.4, 0.41, 0.07);
      bit(0.04, 0.2, 0.025, 0.012, (f) => f.fill((x, y) => (x === Math.floor(f.w / 2) ? '#f4f0e8' : y < f.h * 0.6 ? '#3a8a7a' : '#c84030')), fx, fy + 0.06, fz, [0, -1.4, -0.35]);
      break;
    }
    case 'hat_tophat': {
      const c = main('#24222a');
      lathe([[0.37, 0, 'u'], [0.55, 0, 'u'], [0.56, 0.025, 'b'], [0.385, 0.03, 'r'], [0.38, 0.11, 'c'], [0.395, 0.46, 'c'], [0.4, 0.5, 't'], [0, 0.5, 't']],
        { u: tone(c, -0.1), b: tone(c, 0.05), r: '#9a2a3a', c: (x, row) => (x % 6 === 0 ? tone(c, 0.12) : c), t: tone(c, 0.08) },
        { deform: (v) => { const r = Math.hypot(v.x, v.z); if (r > 0.4) v.y += 1.8 * Math.max(0, Math.abs(v.x) - 0.38) ** 2; } });
      const [fx, fy, fz] = onCrown(0.9, 0.39, 0.07);
      bit(0.1, 0.1, 0.035, 0.01, flowerPaint('#f4f0e8', '#e8c040'), fx, fy, fz, [0, 0.9, 0]);
      break;
    }
    case 'boater': {
      const s = main('#ecd28c');
      lathe([[0.385, 0, 'u'], [0.6, 0, 'u'], [0.61, 0.025, 'b'], [0.4, 0.028, 'r'], [0.395, 0.1, 'c'], [0.39, 0.16, 'c'], [0.38, 0.175, 't'], [0, 0.175, 't']],
        { u: weave(tone(s, -0.15)), b: weave(s), r: (x, row) => (row === 1 ? '#f4f0e8' : '#2a3a6a'), c: weave(s), t: weave(tone(s, 0.06)) });
      break;
    }
    case 'sailor': {
      const c = main('#f4f4f0');
      lathe([[0.36, 0, 'u'], [0.46, 0.03, 'u'], [0.49, 0.135, 'e'], [0.465, 0.145, 'b'], [0.4, 0.05, 'b'], [0.385, 0.14, 'c'], [0.31, 0.2, 'c'], [0, 0.21, 'c']],
        { u: tone(c, -0.12), e: '#2a3a6a', b: (x, row) => (row === 0 ? '#2a3a6a' : tone(c, -0.04)), c: shade(c, 0) });
      break;
    }
    case 'beret': {
      const c = main('#b0303a');
      lathe([[0.39, -0.01, 'r'], [0.395, 0.035, 'c'], [0.46, 0.1, 'c'], [0.45, 0.15, 'c'], [0.32, 0.195, 'c'], [0, 0.205, 'c']],
        { r: tone(c, -0.25), c: shade(c, 0) }, { rz: -0.14, x: 0.03 });
      bit(0.03, 0.06, 0.03, 0.01, (f) => f.fill(tone(c, -0.2)), 0.06, Y0 + 0.23, 0);
      break;
    }
    case 'newsboy': {
      const c = main('#8a7a62');
      const tweed = (x, row) => ((x + row) % 4 === 0 ? tone(c, -0.18) : (x - row + 40) % 5 === 0 ? tone(c, 0.14) : c);
      lathe([[0.39, -0.005, 'r'], [0.4, 0.06, 'c'], [0.44, 0.13, 'c'], [0.41, 0.19, 'c'], [0.26, 0.225, 'c'], [0, 0.23, 'c']],
        { r: tone(c, -0.22), c: tweed }, { z: 0.02 });
      bit(HW * 0.78, 0.035, 0.2, 0.015, (f) => f.fill((x, y) => tweed(x, y)), 0, Y0 + 0.01, HD / 2 + 0.11, [0.18, 0, 0]);
      bit(0.05, 0.03, 0.05, 0.015, (f) => f.fill(tone(c, -0.2)), 0, Y0 + 0.235, 0.02);
      break;
    }
    case 'hat_frog': {
      const c = main('#5aa040');
      lathe([[0.39, -0.01, 'r'], [0.4, 0.1, 'c'], [0.36, 0.2, 'c'], [0.25, 0.27, 'c'], [0, 0.29, 'c']],
        { r: tone(c, -0.2), c: (x, row) => (hash(x, row, 21) > 0.92 ? tone(c, -0.2) : c) });
      for (const s of [-1, 1]) {
        bit(0.15, 0.13, 0.13, 0.055, { all: (f) => f.fill(c), front: (f) => { f.fill(c); f.rect(1, 1, f.w - 2, f.h - 2, '#f8f6ee'); f.rect(Math.floor(f.w / 2) - 1, Math.floor(f.h / 2) - 1, 2, 3, '#1e1a1a'); f.px(Math.floor(f.w / 2) - 1, Math.floor(f.h / 2) - 1, '#ffffff'); } }, s * 0.15, Y0 + 0.29, 0.13);
        bit(0.07, 0.035, 0.02, 0.01, (f) => f.fill('#f49ab0'), s * 0.26, Y0 + 0.12, 0.33, [0, s * 0.6, 0]);
      }
      bit(0.22, 0.025, 0.02, 0.01, (f) => f.fill('#2e5a22'), 0, Y0 + 0.16, 0.355);
      break;
    }
    case 'trapper': {
      const c = main('#a03a2a');
      const fur = (x, row) => (hash(x, row, 13) > 0.6 ? '#f4ead8' : '#ddd0b8');
      const plaid = (x, row) => ((x % 6 < 2) && (row % 3 === 0) ? tone(c, -0.42) : (x % 6 < 2) || (row % 3 === 0) ? tone(c, -0.22) : c);
      lathe([[0.395, -0.03, 'f'], [0.42, 0.06, 'f'], [0.4, 0.085, 'c'], [0.38, 0.19, 'c'], [0.27, 0.255, 'c'], [0, 0.265, 'c']], { f: fur, c: plaid });
      const furF = (f) => f.fill((x, y) => fur(x, y));
      for (const s of [-1, 1]) bit(0.07, 0.24, 0.26, 0.03, { all: (f) => f.fill((x, y) => plaid(x, y)), [s > 0 ? 'right' : 'left']: (f) => { f.fill((x, y) => plaid(x, y)); f.rect(0, f.h - 3, f.w, 3, '#ddd0b8'); }, bottom: furF }, s * (HW / 2 + 0.035), Y0 - 0.1, -0.01);
      break;
    }
    // ---- Frostmere
    case 'hat_earflap': { // a Fair Isle earflap hat with braided ties and a bobble on top
      const c = main('#b8302a'), cream = '#f2ead8';
      const fair = (x, row) => (row % 6 === 2 && x % 4 === 1 ? cream : row % 6 === 3 && x % 4 !== 3 && x % 2 === 0 ? cream : row % 6 === 5 ? tone(c, -0.2) : c);
      lathe([[0.4, -0.02, 'r'], [0.412, 0.05, 'r'], [0.398, 0.08, 'k'], [0.372, 0.19, 'k'], [0.26, 0.26, 'k'], [0, 0.272, 'k']], { r: (x) => (x % 2 ? cream : tone(cream, -0.1)), k: fair });
      for (const sd of [-1, 1]) {
        bit(0.07, 0.22, 0.2, 0.04, (f) => f.fill((x, y) => fair(x, y)), sd * (HW / 2 + 0.03), Y0 - 0.12, 0.0);
        bit(0.03, 0.2, 0.03, 0.012, (f) => f.fill((x, y) => (y % 2 ? cream : c)), sd * (HW / 2 + 0.035), Y0 - 0.34, 0.0);
      }
      bit(0.13, 0.13, 0.13, 0.065, knit(cream), 0, Y0 + 0.3, 0);
      break;
    }
    case 'hat_bobble': { // a tall striped bobble hat with a big pompom
      const c = main('#2c6aa0');
      lathe([[0.4, -0.02, 'r'], [0.405, 0.08, 'r'], [0.385, 0.1, 'k'], [0.35, 0.25, 'k'], [0.24, 0.35, 'k'], [0.1, 0.41, 'k'], [0, 0.42, 'k']], { r: (x) => (x % 2 ? tone(c, -0.15) : tone(c, -0.28)), k: (x, row) => (row % 4 < 2 ? c : '#f4f0e8') });
      bit(0.2, 0.2, 0.2, 0.1, knit('#f4f0e8'), 0, Y0 + 0.49, 0);
      break;
    }
    case 'hat_aviator': { // Skye's aviator cap: brown leather, fleece trim, goggles pushed up on the brow
      const c = main('#6a4024'), fleece = '#efe4cc';
      lathe([[0.4, -0.04, 'f'], [0.415, 0.05, 'f'], [0.395, 0.08, 'c'], [0.37, 0.2, 'c'], [0.25, 0.26, 'c'], [0, 0.27, 'c']], { f: (x, row) => (hash(x, row, 21) > 0.5 ? fleece : tone(fleece, -0.08)), c: (x, row) => (x % 10 === 0 ? tone(c, -0.25) : hash(x, row, 5) > 0.85 ? tone(c, 0.1) : c) });
      for (const sd of [-1, 1]) bit(0.06, 0.24, 0.24, 0.04, { all: (f) => f.fill(c), bottom: (f) => f.fill(fleece) }, sd * (HW / 2 + 0.03), Y0 - 0.1, 0);
      for (const sd of [-1, 1]) bit(0.14, 0.1, 0.04, 0.03, (f) => f.fill((x, y) => (x === 0 || y === 0 || x === f.w - 1 || y === f.h - 1 ? '#c8a050' : y < f.h / 2 ? '#8ad0e8' : '#5aa0c0')), sd * 0.12, Y0 + 0.13, HD / 2 + 0.035);
      bit(HW + 0.04, 0.04, 0.04, 0.015, (f) => f.fill('#3a2a1a'), 0, Y0 + 0.13, HD / 2 + 0.01);
      break;
    }
    case 'bandana': {
      const c = main('#c0392b');
      const pais = (f) => f.fill((x, y) => ((x * 3 + y * 5) % 11 === 0 ? '#f4f0e8' : (x + y * 2) % 13 === 0 ? tone(c, -0.3) : c));
      bit(HW + 0.06, 0.13, HD + 0.06, 0.06, { all: pais, bottom: (f) => f.fill('clear') }, 0, HH + 0.0, 0);
      bit(0.1, 0.08, 0.06, 0.03, pais, 0, HH - 0.02, -HD / 2 - 0.05);
      bit(0.07, 0.15, 0.03, 0.015, pais, -0.04, HH - 0.12, -HD / 2 - 0.06, [0, 0, 0.3]);
      bit(0.07, 0.13, 0.03, 0.015, pais, 0.04, HH - 0.12, -HD / 2 - 0.06, [0, 0, -0.25]);
      break;
    }
    case 'headband': {
      const c = main('#e8607a');
      bit(HW + 0.05, 0.08, HD + 0.05, 0.035, { all: solid(c), top: (f) => f.fill('clear'), bottom: (f) => f.fill('clear') }, 0, HH - 0.075, 0);
      for (const s of [-1, 1]) bit(0.15, 0.13, 0.05, 0.02, (f) => f.fill((x, y) => (Math.abs(y - (f.h - 1) / 2) > 1 + Math.abs(x - (s > 0 ? 0 : f.w - 1)) * 0.6 ? 'clear' : (x + y) % 3 ? c : tone(c, 0.2))), 0.17 + s * 0.085, HH + 0.04, 0.12, [0, 0.35, 0]);
      bit(0.05, 0.06, 0.06, 0.02, (f) => f.fill(tone(c, -0.15)), 0.17, HH + 0.04, 0.12);
      break;
    }
    case 'flowercrown': {
      const cols = ['#f6a0b8', '#f8f4ec', '#f4d040', '#b89ae8', '#f6a0b8', '#f8f4ec'];
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.sin(a) * 0.36, z = Math.cos(a) * 0.33;
        if (i % 2 === 1) { bit(0.09, 0.05, 0.02, 0.01, (f) => f.fill((px, py) => (Math.abs(py - (f.h - 1) / 2) > 2 - Math.abs(px - (f.w - 1) / 2) * 0.4 ? 'clear' : '#4a8a3a')), x, HH - 0.015, z, [0, a + Math.PI / 2, 0]); continue; }
        bit(0.15, 0.15, 0.04, 0.01, flowerPaint(cols[(i / 2) % cols.length | 0]), x, HH + 0.025, z, [-0.35, a, 0]);
      }
      break;
    }
    default: break;
  }
  return out;
}

// ---------------------------------------------------------------- eyewear (3D, sits proud of the face)
function buildEyewear(atlas, cfg, head) {
  const out = [];
  const E = { y: 0.255, x: 0.142, z: head.d / 2 + 0.018 };
  const lens = (w, h, frame, glass, shape, opts = {}) => {
    const paint = (f) => f.fill((x, y) => {
      const u = (x + 0.5) / f.w * 2 - 1, v = (y + 0.5) / f.h * 2 - 1; // -1..1, v down
      const inside = shape(u, v);
      if (inside > 1) return 'clear';
      if (inside > (opts.rim ?? 0.72)) return (x + y) % 5 === 0 ? tone(frame, 0.2) : frame;
      if (u < -0.2 && v < -0.1 && u - v < 0.2 && u - v > -0.4) return tone(glass, 0.45); // glint
      return v < 0 ? glass : tone(glass, opts.grad ?? 0.12);
    });
    return softBox(atlas, w, h, 0.025, 0.006, { front: paint, back: paint, all: (f) => f.fill(frame) }, { shade: false });
  };
  const pair = (w, h, frame, glass, shape, opts = {}) => {
    for (const s of [-1, 1]) {
      const m = place(lens(w, h, frame, glass, opts.mirror && s < 0 ? (u, v) => shape(-u, v) : shape, opts), s * (opts.sep ?? E.x), E.y + (opts.dy || 0), E.z);
      if (opts.tilt) m.rotation.z = s * opts.tilt;
      out.push(m);
    }
    const gap = 2 * (opts.sep ?? E.x) - w;
    if (gap > 0.005) out.push(place(softBox(atlas, gap + 0.02, 0.022, 0.02, 0.008, { all: (f) => f.fill(frame) }), 0, E.y + (opts.dy || 0) + h * (opts.bridge ?? 0.22), E.z));
    // temples back to the ears
    for (const s of [-1, 1]) out.push(place(softBox(atlas, 0.02, 0.025, head.d * 0.62, 0.008, { all: (f) => f.fill(frame) }), s * (head.w / 2 + 0.012), E.y + (opts.dy || 0) + h * 0.22, E.z - head.d * 0.31));
  };
  const round = (u, v) => Math.hypot(u, v);
  const rbox = (u, v) => (Math.abs(u) ** 4 + Math.abs(v) ** 4) ** 0.25;
  switch (cfg.eyewear) {
    case 'bigsunnies': pair(0.24, 0.2, '#5a3420', '#2c2434', rbox, { sep: 0.15, dy: 0.005, rim: 0.78, grad: 0.16 }); break;
    case 'aviators': pair(0.19, 0.16, '#d8b450', '#6a4a30', (u, v) => Math.max(Math.hypot(u * (1 + Math.max(0, v) * 0.3), v), -v * 1.08), { rim: 0.86, grad: 0.22, tilt: 0.05 }); break;
    case 'heart': {
      const inH = (u, v, k) => { const x = u * 1.12 / k, y = (-v * 1.15 + 0.2) / k; const q = x * x + y * y - 1; return q * q * q - x * x * y * y * y <= 0; };
      pair(0.18, 0.17, '#e04870', '#f05a8a', (u, v) => (!inH(u, v, 1) ? 1.5 : !inH(u, v, 0.8) ? 0.9 : 0.5), { rim: 0.72, grad: 0.1 });
      break;
    }
    case 'roundshades': pair(0.15, 0.15, '#26222a', '#1e2a2e', round, { rim: 0.8, grad: 0.1 }); break;
    case 'cateye': pair(0.19, 0.14, '#e86a9a', '#3a2a3a', (u, v) => rbox(u, v * 1.1) - 0.3 * Math.max(0, u) * Math.max(0, -v), { rim: 0.74, mirror: true }); break;
    case 'eye_snowgoggles': { // Frostmere: one wide amber lens in a white frame, a thick strap
      const g0 = place(lens(0.5, 0.17, '#f2f2f0', '#e8a030', (u, v) => (Math.abs(u) ** 6 + Math.abs(v * 1.1) ** 3) ** (1 / 3), { rim: 0.8, grad: -0.18 }), 0, E.y + 0.01, E.z + 0.01);
      out.push(g0);
      out.push(place(softBox(atlas, head.w + 0.03, 0.06, head.d + 0.02, 0.03, { all: (f) => f.fill((x) => (x % 5 === 0 ? '#2c6aa0' : '#1e2a3a')), top: (f) => f.fill('clear'), bottom: (f) => f.fill('clear') }), 0, E.y + 0.01, -0.005));
      break;
    }
    case 'goggles': {
      pair(0.18, 0.15, '#3a3a44', '#5ac0e0', rbox, { rim: 0.72, grad: -0.12, sep: 0.13 });
      out.push(place(softBox(atlas, head.w + 0.03, 0.05, head.d + 0.02, 0.025, { all: (f) => f.fill((x) => (x % 4 === 0 ? '#e85a3a' : '#2a2a32')), top: (f) => f.fill('clear'), bottom: (f) => f.fill('clear') }), 0, E.y + 0.03, -0.005));
      break;
    }
    default: break;
  }
  return out;
}

// ---------------------------------------------------------------- clothes
function shirtColour(cfg) {
  if (cfg.shirt === 'shirt_raincoat_yellow') return '#f0c020';
  if (cfg.shirt === 'shirt_parka') return '#c8442a'; // (Frostmere: the expedition parka is always signal red)
  if (cfg.shirt === 'shirt_musher') return '#2c4060';
  if (cfg.shirt === 'overalls') return '#f0eee8';
  if (cfg.shirt === 'denim') return '#4a6a9a';
  return CLOTH_COLORS[cfg.shirtColor] ?? CLOTH_COLORS[0];
}

function shirtPattern(cfg, c) {
  const dark = tone(c, -0.25), light = tone(c, 0.2), deep = tone(c, -0.42);
  switch (cfg.shirt) {
    case 'flannel': return (x, y) => {
      const vx = (x % 6) < 2, hy = (y % 6) < 2;
      if (vx && hy) return deep;
      if (vx || hy) return dark;
      return (x + y) % 6 === 3 ? light : c;
    };
    case 'sweater': return (x, y) => ((y % 4 === 1) && (x % 2) ? light : (x % 3 === 0 && y % 2 === 0) ? tone(c, -0.08) : c);
    case 'overalls': return (x, y) => ((x + y) % 4 === 0 ? '#e4e2ea' : c);
    case 'sundress': return floral(c);
    case 'hawaiian': return (x, y) => {
      const fx = (x + (Math.floor(y / 7) % 2) * 4) % 8, fy = y % 7;
      if (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4) return fx === 3 && fy === 3 ? '#f4d040' : (fx + fy) % 2 ? '#f8f4ec' : '#f6b0c4';
      if ((fx === 6 || fx === 7) && fy === 5) return '#3a8a4a';
      if (fx === 6 && fy === 6) return '#2a6a3a';
      return hash(x, y, 43) > 0.92 ? tone(c, -0.06) : c;
    };
    case 'stripes': return (x, y) => (y % 4 < 2 ? '#f4f1e8' : c);
    case 'denim': return (x, y) => ((x + y * 2) % 7 === 0 ? tone(c, 0.12) : hash(x, y, 47) > 0.85 ? tone(c, -0.08) : c);
    case 'cardigan': return (x, y) => ((x % 2) ? c : tone(c, -0.08));
    case 'puffer': case 'shirt_musher': return (x, y) => (y % 5 === 4 ? tone(c, -0.3) : y % 5 === 0 ? tone(c, 0.16) : c);
    case 'shirt_parka': return (x, y) => (y % 6 === 5 ? tone(c, -0.22) : hash(x, y, 33) > 0.9 ? tone(c, -0.06) : c);
    case 'shirt_sweater_snow': return (x, y) => { // Fair Isle: a band of snowflakes over plain knit
      const yb = y % 12; const cream = '#f2ead8';
      if (yb === 0 || yb === 10) return tone(c, -0.3);
      if (yb >= 3 && yb <= 7) { const xx = x % 8, yy = yb - 3; const flake = (xx === 3 && yy !== 2) || (yy === 2 && xx !== 3 && xx !== 7) || (Math.abs(xx - 3) === Math.abs(yy - 2) && xx !== 7); return flake ? cream : c; }
      return (x + y) % 2 ? c : tone(c, -0.06);
    };
    case 'shirt_sweater_deer': return (x, y) => { // a band of reindeer and a zigzag
      const yb = y % 14, cream = '#f2ead8';
      if (yb === 1 || yb === 12) return cream;
      if (yb === 2 || yb === 11) return (x % 4 < 2) === (yb === 2) ? cream : c;
      if (yb >= 4 && yb <= 9) { const xx = x % 12, yy = yb - 4; const deer = (yy >= 2 && yy <= 3 && xx >= 3 && xx <= 8) || (yy >= 4 && (xx === 3 || xx === 8)) || (yy <= 2 && xx === 9) || (yy === 0 && (xx === 8 || xx === 10)); return deer ? cream : c; }
      return (x + y) % 2 ? c : tone(c, -0.06);
    };
    case 'turtleneck': return (x) => (x % 2 ? tone(c, -0.1) : c);
    default: return (x, y) => (hash(x, y, 41) > 0.9 ? tone(c, -0.05) : c);
  }
}

function paintTorso(f, side, cfg, skin) {
  const c = shirtColour(cfg);
  const pat = shirtPattern(cfg, c);
  const pants = PANT_COLORS[cfg.pantsColor] || PANT_COLORS[0];
  const dark = tone(c, -0.25);
  f.fill(pat);
  const W = f.w, H = f.h, cx = Math.floor(W / 2);
  const front = side === 'front', back = side === 'back';
  // tuck / waistband
  const dress = DRESS.has(cfg.shirt);
  const tucked = !dress && cfg.pants !== 'waders' && (cfg.shirt === 'tee' || cfg.shirt === 'overalls' || cfg.shirt === 'polo' || cfg.pants === 'overalls');
  if (tucked && side !== 'top') { f.rect(0, H - 3, W, 3, pants); f.rect(0, H - 3, W, 1, tone(pants, -0.2)); }
  if (cfg.shirt === 'tee' && side !== 'top') { f.rect(0, H - 4, W, 1, '#5a3a20'); if (front) f.rect(cx - 1, H - 4, 2, 1, '#d8b040'); }
  if (side === 'top') {
    if (cfg.shirt === 'tee') f.rect(cx - 3, Math.floor(f.h / 2) - 2, 6, 4, skin);
    if (SLEEVELESS.has(cfg.shirt)) { f.fill(skin); for (const x0 of [cx - 6, cx + 4]) f.rect(x0, 0, 2, f.h, cfg.shirt === 'tank' ? c : tone(c, -0.15)); }
    if (cfg.shirt === 'turtleneck' || cfg.shirt === 'puffer' || cfg.shirt === 'shirt_parka' || cfg.shirt === 'shirt_musher') f.fill(pat);
    return;
  }
  switch (cfg.shirt) {
    case 'tee':
      if (front) {
        f.rect(cx - 2, 0, 4, 2, skin); f.px(cx - 3, 0, tone(c, -0.18)); f.px(cx + 2, 0, tone(c, -0.18));
        for (const [x, y] of [[-2, 5], [-1, 5], [0, 5], [-1, 4], [-1, 6], [1, 4], [1, 6]]) f.px(cx + x, y, '#f4f0e0'); // tiny fish print
        f.px(cx - 2, 5, '#2a2a2a');
      }
      break;
    case 'hoodie':
      if (front) { f.rect(cx - 4, H - 7, 8, 4, dark); f.rect(cx - 4, H - 7, 8, 1, tone(dark, -0.15)); f.rect(cx - 2, 0, 1, 6, '#f0f0f0'); f.rect(cx + 1, 0, 1, 6, '#f0f0f0'); f.px(cx - 2, 6, '#c0c0c0'); f.px(cx + 1, 6, '#c0c0c0'); f.rect(cx - 3, 0, 6, 1, dark); }
      f.rect(0, H - 2, W, 2, dark);
      break;
    case 'sweater': f.rect(0, H - 2, W, 2, dark); if (front) { f.rect(cx - 3, 0, 6, 2, dark); } break;
    case 'raincoat': case 'shirt_raincoat_yellow':
      if (front) { f.rect(cx - 1, 0, 2, H, dark); for (let y = 2; y < H - 1; y += 3) f.px(cx, y, '#2a2a2a'); f.rect(1, H - 6, 4, 2, dark); f.rect(W - 5, H - 6, 4, 2, dark); }
      f.rect(0, 0, W, 2, tone(c, -0.12));
      break;
    case 'sundress': case 'tank': {
      // bare shoulders, two straps, a sweetheart (dress) or scoop (tank) neckline
      const neck = Math.round(H * (cfg.shirt === 'tank' ? 0.25 : 0.32));
      for (let y = 0; y < neck + 2; y++) for (let x = 0; x < W; x++) {
        let top = neck;
        if (front || back) top = cfg.shirt === 'tank' ? neck - (Math.abs(x - cx + 0.5) > 4 ? 0 : 0) + (Math.abs(x - cx + 0.5) < 4 ? 2 : 0) : neck + (Math.abs(Math.abs(x - cx + 0.5) - 3) < 1.6 ? -1 : Math.abs(x - cx + 0.5) < 1.5 ? 1 : 0);
        if (y < top) f.px(x, y, skin);
      }
      if (front || back) for (const x0 of [cx - 6, cx + 4]) f.rect(x0, 0, 2, neck + 1, cfg.shirt === 'tank' ? c : tone(c, -0.15));
      if (cfg.shirt === 'sundress') {
        f.rect(0, neck, W, 1, tone(c, -0.2));
        const waist = Math.round(H * 0.72);
        f.rect(0, waist, W, 2, '#f8f4ec'); // a little sash
        if (front) { f.rect(cx - 1, waist - 1, 3, 4, '#f8f4ec'); f.px(cx, waist, tone('#f8f4ec', -0.15)); }
      }
      break;
    }
    case 'hawaiian':
      if (front) { for (let y = 0; y < 5; y++) for (let x = cx - 3 + y; x < cx + 3 - y; x++) f.px(x, y, skin); f.rect(cx - 5, 0, 2, 3, tone(c, 0.15)); f.rect(cx + 3, 0, 2, 3, tone(c, 0.15)); for (let y = 6; y < H - 1; y += 3) f.px(cx, y, '#f4f0e0'); }
      f.rect(0, H - 1, W, 1, tone(c, -0.2));
      break;
    case 'stripes':
      if (front) { f.rect(cx - 3, 0, 6, 1, skin); f.rect(cx - 2, 1, 4, 1, skin); }
      break;
    case 'denim': {
      const inner = CLOTH_COLORS[cfg.shirtColor] ?? '#f4f1e8';
      if (front) {
        f.rect(cx - 2, 0, 4, H - 2, inner); f.rect(cx - 2, 0, 4, 1, skin);
        f.rect(cx - 3, 0, 1, H, tone(c, -0.25)); f.rect(cx + 2, 0, 1, H, tone(c, -0.25));
        for (const x0 of [cx - 8, cx + 4]) { f.rect(x0, 3, 4, 3, tone(c, -0.15)); f.rect(x0, 3, 4, 1, tone(c, 0.12)); f.px(x0 + 1, 4, '#c8a050'); }
        for (let y = 3; y < H - 2; y += 3) f.px(cx - 4, y, '#c8a050');
      }
      f.rect(0, 0, W, 1, tone(c, -0.15)); f.rect(0, H - 2, W, 2, tone(c, -0.18));
      for (let x = 0; x < W; x += 2) f.px(x, H - 3, tone(c, 0.15));
      break;
    }
    case 'cardigan':
      if (front) {
        f.rect(cx - 2, 0, 4, H, '#f4f1e8'); f.rect(cx - 2, 0, 4, 1, skin);
        f.rect(cx - 3, 0, 1, H, tone(c, -0.2)); f.rect(cx + 2, 0, 1, H, tone(c, -0.2));
        for (let y = 2; y < H - 1; y += 3) f.px(cx - 3, y, '#e8d8a8');
        for (const x0 of [2, W - 6]) { f.rect(x0, H - 6, 4, 3, tone(c, -0.14)); f.rect(x0, H - 6, 4, 1, tone(c, -0.25)); }
      }
      f.rect(0, H - 2, W, 2, tone(c, -0.18));
      break;
    case 'puffer':
      if (front) { f.rect(cx, 0, 1, H, '#d8d8e0'); f.px(cx, 2, '#9a9aa8'); }
      f.rect(0, 0, W, 2, tone(c, -0.15));
      break;
    case 'shirt_parka': // the expedition parka: a long zip, snap pockets, a reflective band
      if (front) { f.rect(cx, 0, 1, H, '#2a2a2a'); for (let y = 2; y < H; y += 3) f.px(cx - 1, y, '#d8d8e0'); for (const x0 of [2, W - 7]) { f.rect(x0, H - 7, 5, 4, tone(c, -0.18)); f.rect(x0, H - 7, 5, 1, tone(c, -0.32)); f.px(x0 + 2, H - 7, '#d8d8e0'); } }
      f.rect(0, Math.round(H * 0.42), W, 1, '#e8eef0');
      f.rect(0, H - 2, W, 2, tone(c, -0.25));
      break;
    case 'shirt_musher': // a race bib over a puffer
      if (front || back) { f.rect(2, 2, W - 4, H - 5, '#f4f2ee'); f.rect(2, 2, W - 4, 1, '#c8302a'); for (const [x, y] of [[0, 0], [1, 0], [2, 0], [2, 1], [1, 2], [0, 3], [0, 4], [1, 4], [2, 4]]) f.px(cx - 4 + x, 5 + y, '#1e2a3a'); for (const [x, y] of [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [2, 3], [2, 4], [1, 4], [0, 4]]) f.px(cx + 1 + x, 5 + y, '#1e2a3a'); }
      break;
    case 'shirt_sweater_snow': case 'shirt_sweater_deer': f.rect(0, H - 2, W, 2, tone(c, -0.25)); if (front) f.rect(cx - 3, 0, 6, 2, tone(c, -0.25)); break;
    case 'polo':
      if (front) {
        f.rect(cx - 5, 0, 4, 2, tone(c, 0.2)); f.rect(cx + 1, 0, 4, 2, tone(c, 0.2)); f.px(cx - 2, 2, tone(c, 0.2)); f.px(cx + 1, 2, tone(c, 0.2));
        f.rect(cx - 1, 0, 2, 5, tone(c, -0.12)); f.px(cx - 1, 2, '#f4f0e0'); f.px(cx - 1, 4, '#f4f0e0');
        f.rect(cx + 3, 4, 2, 1, '#f4f0e0'); f.px(cx + 5, 4, '#f4f0e0');
      }
      f.rect(0, 0, W, 1, tone(c, 0.2));
      break;
    case 'turtleneck': f.rect(0, H - 2, W, 2, tone(c, -0.2)); break;
    case 'flannel': if (front) { f.rect(cx, 0, 1, H - 1, deep(c)); for (let y = 2; y < H - 1; y += 3) f.px(cx - 1, y, '#f0ead8'); f.rect(cx - 3, 0, 2, 2, tone(c, 0.15)); f.rect(cx + 1, 0, 2, 2, tone(c, 0.15)); f.rect(2, 4, 4, 3, tone(c, -0.3)); f.rect(2, 4, 4, 1, tone(c, -0.12)); } break;
    default: break;
  }
  // overalls bib & straps
  if (cfg.pants === 'waders') {
    const wc = '#4a5a3a', top = Math.round(H * 0.3);
    if (front || back) {
      f.rect(2, top, W - 4, H - top, wc); f.rect(2, top, W - 4, 1, tone(wc, 0.18));
      f.rect(3, 0, 2, top, '#2a2a2a'); f.rect(W - 5, 0, 2, top, '#2a2a2a');
      if (front) { f.rect(cx - 3, top + 3, 6, 4, tone(wc, -0.15)); f.rect(cx - 3, top + 3, 6, 1, tone(wc, 0.1)); f.px(3, top, '#c8c8d0'); f.px(W - 4, top, '#c8c8d0'); }
    } else f.rect(0, Math.round(H * 0.42), W, H, wc);
  } else if (!dress && (cfg.pants === 'overalls' || cfg.shirt === 'overalls')) {
    if (front || back) {
      f.rect(3, Math.floor(H * 0.35), W - 6, H - Math.floor(H * 0.35), pants);
      f.rect(3, Math.floor(H * 0.35), W - 6, 1, tone(pants, 0.15));
      f.rect(3, 0, 2, Math.floor(H * 0.35), pants); f.rect(W - 5, 0, 2, Math.floor(H * 0.35), pants);
      if (front) { f.px(4, Math.floor(H * 0.35), '#e8c040'); f.px(W - 5, Math.floor(H * 0.35), '#e8c040'); f.rect(cx - 2, Math.floor(H * 0.55), 4, 3, tone(pants, -0.15)); }
    } else f.rect(0, Math.floor(H * 0.55), W, H, pants);
  }
  if (cfg.accessory === 'acc_vest' && (front || side === 'left' || side === 'right')) {
    const v = '#7a8a5a';
    for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) if (!front || Math.abs(x - cx + 0.5) > 2.5) f.px(x, y, hash(x, y, 5) > 0.85 ? tone(v, -0.1) : v);
    if (front) {
      for (const x0 of [1, W - 6]) { const y0 = Math.round(H * 0.45); f.rect(x0, y0, 5, 4, tone(v, -0.2)); f.rect(x0, y0, 5, 1, tone(v, 0.1)); f.px(x0 + 2, y0 + 1, '#d8c060'); }
      f.px(cx + 4, 3, '#e8c040'); f.px(cx + 5, 3, '#c03030'); // a lure clipped to the vest
    }
  }
}
const deep = (c) => tone(c, -0.42);
// little flowers on a coloured ground (sundress)
function floral(c) {
  const petal = '#f8f4ec', alt = c === '#f2a0b8' || c === '#e8607a' ? '#f4d040' : '#f6b0c4';
  return (x, y) => {
    const fx = (x + (Math.floor(y / 5) % 2) * 3) % 6, fy = y % 5;
    if (fx === 2 && fy === 2) return '#f4c040';
    if ((Math.abs(fx - 2) + Math.abs(fy - 2)) === 1) return (Math.floor(x / 6) + Math.floor(y / 5)) % 2 ? alt : petal;
    return hash(x, y, 44) > 0.92 ? tone(c, -0.06) : c;
  };
}
const DRESS = new Set(['sundress']);
const SLEEVELESS = new Set(['sundress', 'tank']);
const SHORT_SLEEVE = new Set(['tee', 'overalls', 'hawaiian', 'polo']);

function paintArm(f, side, cfg, skin) {
  const c = shirtColour(cfg);
  const pat = shirtPattern(cfg, c);
  const short = SHORT_SLEEVE.has(cfg.shirt);
  const H = f.h;
  const hand = 3;
  if (SLEEVELESS.has(cfg.shirt)) { f.fill((x, y) => (hash(x, y, 8) > 0.94 ? tone(skin, -0.03) : skin)); f.rect(0, H - 1, f.w, 1, tone(skin, -0.12)); return; }
  if (side === 'top') { f.fill(pat); return; }
  if (side === 'bottom') { f.fill(skin); return; }
  const sleeveEnd = short ? Math.round(H * 0.32) : H - hand;
  f.fill((x, y) => (y < sleeveEnd ? pat(x, y) : skin));
  if (cfg.shirt === 'puffer' || cfg.shirt === 'shirt_musher') for (let y = 4; y < sleeveEnd; y += 5) f.rect(0, y, f.w, 1, tone(c, -0.3));
  if (cfg.accessory === 'acc_mittens') { const m = '#c8302a'; f.rect(0, sleeveEnd, f.w, H - sleeveEnd, m); if (side === 'front') f.rect(0, sleeveEnd + 1, f.w, 1, '#f2ead8'); return; } // (Frostmere: knitted mittens)
  if (cfg.shirt === 'stripes') f.fill((x, y) => (y < Math.round(H * 0.7) ? pat(x, y) : skin));
  if (!short) f.rect(0, sleeveEnd - 1, f.w, 1, tone(c, -0.28)); // cuff
  else f.rect(0, sleeveEnd - 1, f.w, 1, tone(c, -0.15));
  f.rect(0, H - 1, f.w, 1, tone(skin, -0.12)); // knuckles
}

function paintLeg(f, side, cfg, skin, legPx) {
  const waders = cfg.pants === 'waders';
  const pants = waders ? '#4a5a3a' : PANT_COLORS[cfg.pantsColor] || PANT_COLORS[0];
  const H = f.h;
  const bare = DRESS.has(cfg.shirt) || cfg.pants === 'skirt' || cfg.pants === 'longskirt';
  const rows = waders ? H : cfg.pants === 'shorts' ? Math.round(H * 0.45) : bare ? 0 : H;
  const pat = (x, y) => {
    if (cfg.pants === 'jeans') return (x + y * 2) % 7 === 0 ? tone(pants, 0.12) : hash(x, y, 51) > 0.85 ? tone(pants, -0.08) : pants;
    return hash(x, y, 52) > 0.88 ? tone(pants, -0.06) : pants;
  };
  if (side === 'top') { f.fill(DRESS.has(cfg.shirt) ? tone(shirtColour(cfg), -0.25) : bare ? skin : pants); return; }
  f.fill((x, y) => (y < rows ? pat(x, y) : skin));
  if (waders) { f.rect(0, Math.round(H * 0.55), f.w, 1, tone(pants, -0.2)); if (side === 'front') f.rect(1, Math.round(H * 0.55) + 1, f.w - 2, 2, tone(pants, -0.1)); }
  if (cfg.pants === 'wideleg') { f.rect(0, H - 1, f.w, 1, tone(pants, -0.2)); if (side === 'front') f.rect(Math.floor(f.w / 2), 0, 1, H, tone(pants, -0.12)); }
  if (rows < H && rows > 0) f.rect(0, rows - 1, f.w, 1, tone(pants, -0.2)); // hem
  if (cfg.pants === 'jeans' && (side === 'right' || side === 'left')) f.rect(Math.floor(f.w / 2), 0, 1, rows, tone(pants, -0.18)); // seam
  if (cfg.pants === 'cargo' && (side === 'right' || side === 'left')) { f.rect(1, Math.round(H * 0.35), f.w - 2, 4, tone(pants, -0.15)); f.rect(1, Math.round(H * 0.35), f.w - 2, 1, tone(pants, 0.1)); }
  if (cfg.pants === 'joggers') f.rect(0, H - 2, f.w, 2, tone(pants, -0.22));
  if ((cfg.pants === 'skirt') && !DRESS.has(cfg.shirt) && side === 'front') { f.rect(0, H - 4, f.w, 3, '#f4f0e8'); f.rect(0, H - 4, f.w, 1, '#d84a5a'); } // socks over the boots
}

const SHOES = {
  boots: { c: '#3e6a3a', sole: '#2a2a2a', h: 0.17 },
  shoes_furboots: { c: '#7a5434', sole: '#2a2a2a', h: 0.22, fur: '#efe4cc' }, // (Frostmere: mukluks with a fur cuff)
  sneakers: { c: '#f2f2f0', sole: '#c0392b', h: 0.11 },
  hiking: { c: '#6a4a2a', sole: '#2a2a2a', h: 0.14, lace: '#d8c090' },
  sandals: { c: '#8a5a2a', sole: '#6a4020', h: 0.06 },
  slipons: { c: '#2a2a3a', sole: '#e0e0e0', h: 0.1 },
};

function paintShoe(f, side, cfg) {
  const s = SHOES[cfg.shoes] || SHOES.boots;
  if (side === 'bottom') { f.fill(s.sole); return; }
  f.fill((x, y) => (hash(x, y, 61) > 0.88 ? tone(s.c, -0.08) : s.c));
  if (side !== 'top') { f.rect(0, f.h - 1, f.w, 1, s.sole); f.rect(0, 0, f.w, 1, tone(s.c, 0.15)); }
  if (side === 'top' && s.lace) for (let y = 1; y < f.h - 2; y += 2) f.rect(Math.floor(f.w / 2) - 1, y, 2, 1, s.lace);
  if (side === 'top' && cfg.shoes === 'sneakers') f.rect(Math.floor(f.w / 2) - 1, 1, 2, f.h - 3, '#c0392b');
  if (s.fur && side !== 'top' && side !== 'bottom') { f.rect(0, 0, f.w, 3, s.fur); for (let x = 0; x < f.w; x += 2) f.px(x, 3, s.fur); f.rect(0, Math.floor(f.h * 0.6), f.w, 1, '#c8302a'); }
}

// ---------------------------------------------------------------- assembly helpers

/** Merge a group's direct child meshes (same material, not in `keep`) into one mesh, added last. */
function mergeChildren(g, mat, all, keep) {
  const ms = g.children.filter((o) => o.isMesh && o.material === mat && !keep.has(o));
  if (ms.length < 2) return;
  const geos = ms.map((m) => { m.updateMatrix(); const geo = (m.geometry.index ? m.geometry : m.geometry).clone(); geo.applyMatrix4(m.matrix); return geo.index ? geo.toNonIndexed() : geo; });
  const names = Object.keys(geos[0].attributes);
  if (!geos.every((q) => Object.keys(q.attributes).length === names.length && names.every((n) => q.attributes[n]))) return;
  const merged = mergeGeometries(geos, false);
  for (const q of geos) q.dispose();
  if (!merged) return;
  const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = false;
  for (const m of ms) { g.remove(m); m.geometry.dispose(); const i = all.indexOf(m); if (i >= 0) all.splice(i, 1); }
  g.add(mesh); all.push(mesh);
}

function finish(meshes, mat) {
  for (const m of meshes) { m.material = mat; m.castShadow = true; m.receiveShadow = false; }
  return meshes;
}

/**
 * Builds an avatar group. Returns { group, parts: { head, body, armL, armR, legL, legR }, rodHand, height }.
 * Local axes: avatar faces +z. Same contract as the classic voxel avatar.
 */
export function buildAvatar(cfgIn) {
  const cfg = { ...defaultAvatar(cfgIn?.gender), ...(cfgIn || {}) };
  const frame = FRAMES.find((f) => f.id === cfg.frame) || FRAMES[1];
  const height = HEIGHTS.find((h) => h.id === cfg.height) || HEIGHTS[1];
  const skin = SKINS[cfg.skin] || SKINS[3];
  const atlas = new Atlas(512);

  // Stout proportions (world units before SCALE)
  const TW = { broad: 0.6, standard: 0.54, slim: 0.48 }[frame.id] || 0.54;
  const TH = 0.44, TD = 0.32;
  const AW = { broad: 0.19, standard: 0.17, slim: 0.15 }[frame.id] || 0.17;
  const AH = 0.4;
  const LW = 0.21, LD = 0.23;
  const LH = { short: 0.24, medium: 0.3, tall: 0.38 }[height.id] || 0.3;
  const head = { w: 0.6, h: 0.54, d: 0.54 };

  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(SCALE);
  root.add(inner);
  const all = [];

  // legs (pivot at hip) with chunky shoes
  const shoe = SHOES[cfg.shoes] || SHOES.boots;
  const mkLeg = (sx) => {
    const g = new THREE.Group();
    const wide = cfg.pants === 'wideleg' ? 0.035 : cfg.pants === 'waders' ? 0.02 : 0;
    const legGeo = softBox(atlas, LW + wide, LH, LD + wide, 0.06, { all: (f, s) => paintLeg(f, s, cfg, skin) });
    const leg = place(legGeo, 0, -LH / 2, 0);
    const sh = place(softBox(atlas, LW + 0.03, shoe.h, LD + 0.08, Math.min(0.06, shoe.h / 2.2), { all: (f, s) => paintShoe(f, s, cfg) }), 0, -LH + shoe.h / 2 - 0.01, 0.04);
    g.add(leg, sh); all.push(leg, sh);
    g.position.set(sx * (LW / 2 + 0.015), LH, 0);
    return g;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);

  const body = new THREE.Group();
  body.position.set(0, LH, 0);
  const torso = place(softBox(atlas, TW, TH, TD, 0.08, { all: (f, s) => paintTorso(f, s, cfg, skin) }), 0, TH / 2, 0);
  body.add(torso); all.push(torso);
  // skirts and dresses: one flared lathe, squashed to the torso's depth
  let skirtMesh = null;
  const dress = DRESS.has(cfg.shirt);
  if (dress || cfg.pants === 'skirt' || cfg.pants === 'longskirt') {
    const long = cfg.pants === 'longskirt' && !dress;
    const c = dress ? shirtColour(cfg) : PANT_COLORS[cfg.pantsColor] || PANT_COLORS[0];
    const hemY = long ? -LH + 0.06 : dress ? -LH * 0.62 : -LH * 0.42;
    const flare = long ? 0.4 : dress ? 0.44 : 0.4;
    const pat = dress ? floral(c) : (x) => (x % 4 === 0 ? tone(c, -0.14) : x % 4 === 1 ? tone(c, 0.06) : c);
    const hem = dress ? '#f8f4ec' : tone(c, -0.22);
    // the waistband rides up over the torso's rounded bottom edge so there is never a gap above the skirt
    const prof = [[0.285, 0.2, 'w'], [0.3, 0.06, 's'], [(0.3 + flare) / 2 + 0.01, (0.05 + hemY) / 2, 's'], [flare, hemY + 0.03, 'h'], [flare + 0.005, hemY, 'i'], [flare - 0.03, hemY + 0.01, 'i'], [0.27, 0.0, 'i']];
    const geo = latheGeo(atlas, prof, (key, x, row) => (key === 'w' ? (dress ? tone(c, -0.12) : tone(c, -0.18)) : key === 'h' ? (row === 0 ? hem : pat(x, row + 40)) : key === 'i' ? tone(c, -0.3) : pat(x, row + (key === 's' ? 7 : 0))), { segs: 22, rps: 6, pw: 66 });
    const sk = place(geo, 0, 0, 0);
    sk.scale.set(TW / 0.54, 1, (TD + 0.04) / 0.56);
    body.add(sk); all.push(sk);
    skirtMesh = sk;
  }
  if (cfg.shirt === 'turtleneck' || cfg.shirt === 'puffer' || cfg.shirt === 'shirt_musher') {
    const c = shirtColour(cfg);
    const neck = place(softBox(atlas, TW * (cfg.shirt === 'turtleneck' ? 0.62 : 0.82), 0.09, TD * 0.8, 0.04, { all: (f) => f.fill((x) => (x % 2 ? tone(c, -0.1) : c)), top: (f) => { f.fill(tone(c, -0.3)); } }), 0, TH + 0.01, 0);
    body.add(neck); all.push(neck);
  }
  if (cfg.shirt === 'shirt_parka') { // the parka's fur-ruffed hood, down on the shoulders
    const fur = (f) => f.fill((x, y) => (hash(x, y, 17) > 0.55 ? '#efe4cc' : '#cbbca0'));
    const ruff = place(softBox(atlas, TW * 0.95, 0.12, TD + 0.08, 0.06, { all: fur, top: (f) => f.fill('#5a3a24') }), 0, TH + 0.02, -0.02);
    const hood = place(softBox(atlas, TW * 0.7, 0.18, 0.13, 0.06, { all: (f) => f.fill('#a8361e'), top: fur }), 0, TH - 0.02, -TD / 2 - 0.05);
    body.add(ruff, hood); all.push(ruff, hood);
  }
  if (cfg.shirt === 'hoodie') {
    const c = shirtColour(cfg);
    const hood = place(softBox(atlas, TW * 0.75, 0.16, 0.12, 0.05, { all: (f) => f.fill(tone(c, -0.12)) }), 0, TH - 0.02, -TD / 2 - 0.02);
    body.add(hood); all.push(hood);
  }
  if (cfg.accessory === 'acc_backpack') {
    const bp = place(softBox(atlas, TW * 0.78, TH * 0.82, 0.18, 0.07, { all: (f) => { f.fill('#c87a3a'); f.rect(0, 0, f.w, 2, '#8a5a2a'); }, back: (f) => { f.fill('#c87a3a'); f.rect(2, Math.floor(f.h * 0.5), f.w - 4, Math.floor(f.h * 0.35), '#b06a30'); f.rect(0, 0, f.w, 2, '#8a5a2a'); f.px(Math.floor(f.w / 2), Math.floor(f.h * 0.5), '#e0c040'); } }), 0, TH * 0.5, -TD / 2 - 0.09);
    body.add(bp); all.push(bp);
    for (const sx of [-1, 1]) { const st = place(softBox(atlas, 0.05, TH * 0.9, 0.03, 0.012, { all: (f) => f.fill('#8a5a2a') }), sx * TW * 0.25, TH * 0.5, TD / 2 + 0.005); body.add(st); all.push(st); }
  }
  if (cfg.accessory === 'acc_aurora_scarf') { // Frostmere: knitted in the colours of the northern lights
    const knit = (f) => f.fill((x, y) => ['#3ae08a', '#2ab8a0', '#5a7ae8', '#9a5ae8', '#c85ac8'][((x >> 1) + (y >> 2)) % 5]);
    const ring = place(softBox(atlas, TW + 0.07, 0.12, TD + 0.07, 0.055, { all: knit }), 0, TH - 0.02, 0);
    const tail = place(softBox(atlas, 0.11, 0.3, 0.05, 0.025, { all: knit }), TW * 0.2, TH - 0.18, TD / 2 + 0.035);
    const tail2 = place(softBox(atlas, 0.1, 0.26, 0.05, 0.025, { all: knit }), -TW * 0.05, TH - 0.12, -TD / 2 - 0.035);
    body.add(ring, tail, tail2); all.push(ring, tail, tail2);
  }
  if (cfg.accessory === 'acc_scarf') {
    const knit = (f) => f.fill((x, y) => ((x >> 1) % 2 ? '#c0392b' : '#e8d8c0'));
    const ring = place(softBox(atlas, TW + 0.06, 0.1, TD + 0.06, 0.05, { all: knit }), 0, TH - 0.02, 0);
    const tail = place(softBox(atlas, 0.1, 0.24, 0.05, 0.025, { all: knit }), -TW * 0.2, TH - 0.15, TD / 2 + 0.03);
    body.add(ring, tail); all.push(ring, tail);
  }

  // ---- more accessories
  const A = (w, h, d, r, paint, x, y, z, rot) => {
    const m = place(softBox(atlas, w, h, d, r, typeof paint === 'function' ? { all: paint } : paint), x, y, z);
    if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    body.add(m); all.push(m); return m;
  };
  const leather = (f) => f.fill((x, y) => (hash(x, y, 71) > 0.85 ? '#7a4a28' : '#8a5a32'));
  switch (cfg.accessory) {
    case 'satchel': {
      const L = Math.hypot(TW, TH) * 0.98, ang = Math.atan2(TH, TW) * 0.92;
      A(0.05, L, 0.025, 0.01, (f) => f.fill('#6a4024'), 0, TH * 0.5, TD / 2 + 0.012, [0, 0, -ang * 0 - (Math.PI / 2 - ang)]);
      A(0.05, L, 0.025, 0.01, (f) => f.fill('#6a4024'), 0, TH * 0.5, -TD / 2 - 0.012, [0, 0, Math.PI / 2 - ang]);
      A(0.12, 0.2, 0.24, 0.035, { all: leather, right: (f) => { leather(f); f.rect(0, 0, f.w, Math.floor(f.h * 0.45), '#6a4024'); f.px(Math.floor(f.w / 2), Math.floor(f.h * 0.45), '#d8b040'); } }, TW / 2 + 0.07, 0.04, 0.02);
      break;
    }
    case 'lei': {
      const cols = ['#f05a7a', '#f4d040', '#f8f4ec', '#f08a3a', '#b070e0'];
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const front = Math.max(0, Math.cos(a));
        A(0.085, 0.085, 0.085, 0.035, flowerPaint(cols[i % cols.length]), Math.sin(a) * (TW / 2 + 0.02) * (1 - front * 0.3), TH - 0.005 - front * 0.12, Math.cos(a) * (TD / 2 + 0.035));
      }
      break;
    }
    case 'bowtie': {
      const c = CLOTH_COLORS[(cfg.shirtColor + 3) % 8] || '#c0392b';
      const wing = (sx) => (f) => f.fill((x, y) => { const t = sx > 0 ? x / (f.w - 1) : 1 - x / (f.w - 1); return Math.abs(y - (f.h - 1) / 2) > 1 + t * (f.h / 2 - 1) ? 'clear' : (x + y) % 3 ? c : tone(c, -0.15); });
      for (const sx of [-1, 1]) A(0.09, 0.08, 0.03, 0.01, wing(sx), sx * 0.05, TH - 0.04, TD / 2 + 0.025);
      A(0.035, 0.04, 0.035, 0.012, (f) => f.fill(tone(c, -0.2)), 0, TH - 0.04, TD / 2 + 0.03);
      break;
    }
    case 'shells': {
      const n = 9;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) * 2 - 1;
        A(0.035, 0.035, 0.03, 0.014, (f) => f.fill(i % 2 ? '#f4ecd8' : '#e8c8b0'), t * TW * 0.3, TH - 0.03 - (1 - t * t) * 0.1, TD / 2 + 0.012);
      }
      A(0.08, 0.07, 0.03, 0.012, (f) => f.fill((x, y) => (Math.abs(x - (f.w - 1) / 2) > (y + 1.5) * 0.6 ? 'clear' : x % 2 ? '#f6b8a0' : '#f8dccc')), 0, TH - 0.18, TD / 2 + 0.016);
      break;
    }
    case 'fannypack': {
      A(TW + 0.03, 0.04, TD + 0.03, 0.02, { all: (f) => f.fill('#2a2a32'), top: (f) => f.fill('clear'), bottom: (f) => f.fill('clear') }, 0, 0.06, 0);
      A(0.26, 0.12, 0.1, 0.045, { all: (f) => f.fill('#4aa0a0'), front: (f) => { f.fill('#4aa0a0'); f.rect(0, 2, f.w, 1, '#d8d8e0'); f.rect(2, 4, f.w - 4, 3, '#3a8a8a'); f.px(f.w - 3, 2, '#e8c040'); } }, 0.06, 0.06, TD / 2 + 0.05);
      break;
    }
    case 'net': {
      const g = new THREE.Group();
      const hp = place(softBox(atlas, 0.04, 0.5, 0.04, 0.015, { all: (f) => f.fill((x, y) => (y % 6 < 2 ? '#3a3a40' : '#a07040')) }), 0, -0.1, 0);
      const ring = place(softBox(atlas, 0.34, 0.3, 0.03, 0.12, { all: (f) => f.fill((x, y) => (x === 0 || y === 0 || x === f.w - 1 || y === f.h - 1 ? '#5a5a62' : (x + y) % 3 === 0 || (x - y + 30) % 3 === 0 ? '#e8e2d0' : 'clear')) }, { shade: false }), 0, 0.29, 0);
      g.add(hp, ring); all.push(hp, ring);
      // hung on the left hip, hoop down
      g.position.set(-TW / 2 - 0.04, TH * 0.55, -0.06);
      g.rotation.set(0, Math.PI / 2, Math.PI - 0.12);
      body.add(g);
      break;
    }
    case 'acc_camera': {
      const L = 0.26;
      for (const s of [-1, 1]) A(0.03, L, 0.02, 0.008, (f) => f.fill('#2a2a2a'), s * 0.08, TH - L / 2 + 0.01, TD / 2 + 0.012, [0, 0, s * 0.35]);
      A(0.2, 0.13, 0.09, 0.03, { all: (f) => { f.fill('#2a2a30'); f.rect(0, 0, f.w, 2, '#c8c8d0'); }, front: (f) => { f.fill('#2a2a30'); f.rect(0, 0, f.w, 2, '#c8c8d0'); f.px(1, 3, '#e04040'); } }, 0, TH - 0.27, TD / 2 + 0.05);
      A(0.08, 0.08, 0.06, 0.035, { all: (f) => f.fill('#3a3a42'), front: (f) => { f.fill('#1a1a20'); f.px(1, 1, '#8ab0e0'); } }, 0, TH - 0.28, TD / 2 + 0.11);
      break;
    }
    default: break;
  }

  const mkArm = (sx) => {
    const g = new THREE.Group();
    const arm = place(softBox(atlas, AW, AH, AW, 0.06, { all: (f, s) => paintArm(f, s, cfg, skin) }), 0, -AH / 2, 0);
    g.add(arm); all.push(arm);
    g.position.set(sx * (TW / 2 + AW / 2 + 0.005), TH - 0.04, 0);
    return g;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  body.add(armL, armR);

  const headG = new THREE.Group();
  headG.position.set(0, TH - 0.02, 0);
  const headMesh = place(softBox(atlas, head.w, head.h, head.d, 0.1, {
    front: (f) => paintFace(f, cfg, skin),
    right: (f) => paintEars(f, skin, 'right'),
    left: (f) => paintEars(f, skin, 'left'),
    all: (f) => f.fill((x, y) => (hash(x, y, 8) > 0.94 ? tone(skin, -0.03) : skin)),
  }), 0, head.h / 2, 0);
  headG.add(headMesh); all.push(headMesh);
  if (cfg.facialHair === 'beard') {
    const hair = HAIR_COLORS[cfg.hairColor] || HAIR_COLORS[2];
    const jaw = place(softBox(atlas, head.w * 0.78, 0.11, 0.1, 0.045, { all: (f) => f.fill((x, y) => (hash(x, y, 4) > 0.7 ? tone(hair, 0.1) : tone(hair, -0.05))) }), 0, 0, head.d / 2 - 0.035);
    headG.add(jaw); all.push(jaw);
  }
  const hatOn = cfg.hat && cfg.hat !== 'none';
  // Hats that cover the crown flatten whatever would poke through them (buns, tufts, mohawk, afro).
  const hatted = hatOn && HATTED.has(cfg.hat);
  const hairCfg = hatted && cfg.hair === 'afro' ? { ...cfg, hair: 'curly' } : hatted && cfg.hair === 'mohawk' ? { ...cfg, hair: 'buzz' } : cfg;
  const hairMeshes = buildHair(atlas, hairCfg, head, hatted);
  if (hatted) tuckHair(hairMeshes, cfg.hat, head);
  for (const m of hairMeshes) { headG.add(m); all.push(m); }
  for (const m of buildHat(atlas, cfg, head)) { headG.add(m); all.push(m); }
  for (const m of buildEyewear(atlas, cfg, head)) { headG.add(m); all.push(m); }
  body.add(headG);

  if (cfg.accessory === 'acc_cat') {
    const cat = buildCat(atlas);
    cat.position.set(-(TW / 2 + 0.1), TH + 0.02, -0.04);
    cat.rotation.y = Math.PI / 2;
    body.add(cat);
    cat.traverse((o) => { if (o.isMesh) all.push(o); });
  }

  // Texture + one material for the whole avatar
  const mat = atlasMaterial(atlas);
  const tex = mat.map;
  finish(all, mat);
  if (cfg.hat === 'cap_star') headG.add(starDecal(head));

  // Rod socket in the right hand
  const rodHand = new THREE.Group();
  rodHand.position.set(0, -AH + 0.04, 0.05);
  armR.add(rodHand);
  // Rod socket across the back (stowed rod, or while emoting/rowing)
  const rodBack = new THREE.Group();
  rodBack.position.set(0.12, TH * 0.08, -TD / 2 - 0.07);
  rodBack.rotation.z = 0.62;
  body.add(rodBack);

  inner.add(legL, legR, body);
  // Perf (Frostmere v1): each limb's pieces share one material, so bake them into one mesh per moving part: a whole
  // angler draws in about six calls instead of twenty to forty (hair, hats, scarves, shoes...).
  for (const g of [legL, legR, body, headG, armL, armR]) mergeChildren(g, mat, all, new Set([skirtMesh]));
  const totalH = (LH + TH + head.h + 0.05) * SCALE;
  return { group: root, parts: { head: headG, body, armL, armR, legL, legR, skirt: skirtMesh }, rodHand, rodBack, height: totalH, hip: LH * SCALE, legHalf: (LD / 2) * SCALE, cfg, dispose: () => { tex.dispose(); mat.dispose(); for (const m of all) m.geometry.dispose(); } };
}

/** A sharp white lone star (with a thin outline) on the front of the maroon cap: its own 128 px texture. */
let starTex = null;
function starDecal(head) {
  if (!starTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const path = (R, r) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; c.lineTo(64 + Math.cos(a) * rr, 68 + Math.sin(a) * rr); } c.closePath(); };
    path(58, 23); c.fillStyle = '#c9c2b4'; c.fill();
    path(52, 20.5); c.fillStyle = '#f7f3ea'; c.fill();
    starTex = new THREE.CanvasTexture(cv); starTex.colorSpace = THREE.SRGBColorSpace; starTex.anisotropy = 4;
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshLambertMaterial({ map: starTex, transparent: true, alphaTest: 0.4 }));
  m.position.set(0, head.h + 0.045, (head.d + 0.06) / 2 + 0.003);
  return m;
}

function buildCat(atlas) {
  const g = new THREE.Group();
  const fur = (f) => f.fill((x, y) => ((x + y * 2) % 5 === 0 ? '#c87830' : '#e8a050'));
  g.add(place(softBox(atlas, 0.24, 0.14, 0.13, 0.05, { all: fur }), 0, 0.07, 0));
  g.add(place(softBox(atlas, 0.16, 0.14, 0.14, 0.05, { all: fur, front: (f) => { fur(f); f.px(1, 2, '#2a2a2a'); f.px(f.w - 2, 2, '#2a2a2a'); f.px(Math.floor(f.w / 2), 3, '#f8a8a0'); } }), 0.13, 0.15, 0));
  const tail = place(softBox(atlas, 0.04, 0.16, 0.04, 0.015, { all: fur }), -0.13, 0.13, 0);
  tail.rotation.z = 0.4;
  g.add(tail);
  for (const z of [-0.04, 0.04]) g.add(place(softBox(atlas, 0.04, 0.05, 0.03, 0.01, { all: fur }), 0.15, 0.24, z));
  g.children.forEach((m) => { m.rotation.y = 0; });
  // the cat's "front" is +x; soft boxes paint front on +z, so turn the head box
  g.children[1].rotation.y = Math.PI / 2;
  return g;
}

export { animateAvatar, rodColorsFor } from './avatar.js';
