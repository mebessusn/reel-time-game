// Voxel avatar built from swappable parts (design doc section 7). Minecraft proportions, 1 px = 1/17 block.
import * as THREE from 'three';
import { VoxelGrid, voxelMesh, shadeHex } from '../render/voxel.js';
import { SKINS, HAIR_COLORS, EYE_COLORS, CLOTH_COLORS, PANT_COLORS, FRAMES, HEIGHTS, defaultAvatar } from '../data/avatarOptions.js';
import { ITEMS_BY_ID } from '../data/items.js';

export const PX = 1 / 17;

const SHOE = {
  boots: { rows: 4, color: '#3e6a3a', sole: '#2a2a2a' },
  sneakers: { rows: 2, color: '#f0f0f0', sole: '#c0392b' },
  hiking: { rows: 3, color: '#6a4a2a', sole: '#2a2a2a' },
  sandals: { rows: 1, color: '#8a5a2a', sole: '#8a5a2a', skinTop: true },
  slipons: { rows: 2, color: '#2a2a3a', sole: '#e0e0e0' },
};

function legGrid(cfg, legH, side) {
  const g = new VoxelGrid();
  const skin = SKINS[cfg.skin] || SKINS[3];
  const pants = PANT_COLORS[cfg.pantsColor] || PANT_COLORS[0];
  const shoe = SHOE[cfg.shoes] || SHOE.boots;
  const pantsRows = cfg.pants === 'shorts' ? 5 : cfg.pants === 'skirt' ? 3 : legH;
  for (let y = 0; y < legH; y++) for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) {
    const fromTop = legH - 1 - y;
    let c;
    if (y < shoe.rows) c = y === 0 ? shoe.sole : shoe.color;
    else if (fromTop < pantsRows) {
      c = pants;
      if (cfg.pants === 'jeans' && x === (side ? 0 : 3) && z === 3) c = shadeHex(pants, 0.15);
      if (cfg.pants === 'cargo' && fromTop >= 4 && fromTop <= 6 && x === (side ? 0 : 3)) c = shadeHex(pants, -0.15);
      if (cfg.pants === 'joggers' && y === shoe.rows) c = shadeHex(pants, -0.2);
      if (cfg.pants === 'overalls' && y === shoe.rows) c = shadeHex(pants, 0.1);
    } else c = skin;
    if (cfg.shoes === 'sandals' && y === 1) c = (x + z) % 2 ? '#8a5a2a' : skin;
    g.set(x, y, z, c);
  }
  return g;
}

function torsoGrid(cfg, W) {
  const g = new VoxelGrid();
  const skin = SKINS[cfg.skin] || SKINS[3];
  let shirt = CLOTH_COLORS[cfg.shirtColor] ?? CLOTH_COLORS[0];
  if (cfg.shirt === 'shirt_raincoat_yellow') shirt = '#f0c020';
  const dark = shadeHex(shirt, -0.25), light = shadeHex(shirt, 0.2);
  const pants = PANT_COLORS[cfg.pantsColor] || PANT_COLORS[0];
  const H = 12;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let z = 0; z < 4; z++) {
    let c = shirt;
    const front = z === 3;
    switch (cfg.shirt) {
      case 'flannel': c = ((x >> 1) + (y >> 1)) % 2 ? shirt : dark; if ((x + y) % 4 === 0) c = light; break;
      case 'tee': if (y >= H - 1 && front && x >= W / 2 - 1 && x <= W / 2) c = skin; break;
      case 'hoodie': if (front && y >= 2 && y <= 4 && x >= 2 && x <= W - 3) c = dark; if (front && y === H - 2 && (x === W / 2 - 1 || x === W / 2)) c = '#f0f0f0'; break;
      case 'sweater': if (y >= 6 && y <= 7) c = light; if (y === 0) c = dark; break;
      case 'raincoat': case 'shirt_raincoat_yellow': if (front && (x === W / 2 - 1 || x === W / 2)) c = dark; if (front && x === W / 2 && y % 3 === 1) c = '#2a2a2a'; break;
      case 'overalls': c = '#f0f0f0'; if ((y + x) % 3 === 0) c = '#e0e0f0'; break;
      default: break;
    }
    if (y < 2) c = cfg.shirt === 'tee' || cfg.shirt === 'overalls' ? pants : c; // waistband / tuck
    if (y === 2 && cfg.shirt === 'tee') c = '#5a3a20'; // belt
    // Overalls bib and straps
    if (cfg.pants === 'overalls' || cfg.shirt === 'overalls') {
      if ((front || z === 0) && y < 8 && x >= 2 && x <= W - 3) c = pants;
      if ((front || z === 0) && y >= 8 && (x === 2 || x === W - 3)) c = pants;
      if (front && y === 7 && (x === 2 || x === W - 3)) c = '#e0c040';
      if (y < 2) c = pants;
    }
    g.set(x, y, z, c);
  }
  // Skirt flares out below the waist
  if (cfg.pants === 'skirt') {
    for (let y = -4; y < 2; y++) for (let x = -1; x <= W; x++) for (let z = -1; z <= 4; z++) {
      const edge = x === -1 || x === W || z === -1 || z === 4;
      if (!edge && y >= 0) continue;
      if (y < -3 && (x + z) % 2) continue;
      g.set(x, y, z, (x + y) % 3 ? pants : shadeHex(pants, -0.15));
    }
  }
  // Accessories
  if (cfg.accessory === 'acc_vest') {
    for (let y = 3; y < H; y++) for (let x = 0; x < W; x++) {
      if (x >= W / 2 - 1 && x <= W / 2) continue;
      g.set(x, y, 4, (y === 6 || y === 9) && (x === 1 || x === W - 2) ? '#5a4a2a' : '#7a8a5a');
    }
  }
  if (cfg.accessory === 'acc_scarf') {
    for (let x = -1; x <= W; x++) for (let z = -1; z <= 4; z++) {
      if (x > -1 && x < W && z > -1 && z < 4) continue;
      g.set(x, H - 1, z, x % 2 ? '#c0392b' : '#e8d8c0');
    }
    for (let y = H - 5; y < H - 1; y++) g.set(1, y, 4, y % 2 ? '#c0392b' : '#e8d8c0');
  }
  if (cfg.accessory === 'acc_backpack') {
    for (let y = 3; y < 11; y++) for (let x = 1; x < W - 1; x++) for (let z = -3; z < 0; z++) g.set(x, y, z, y === 10 || z === -3 && y === 7 ? '#8a5a2a' : '#c87a3a');
  }
  return g;
}

function armGrid(cfg, AW, side) {
  const g = new VoxelGrid();
  const skin = SKINS[cfg.skin] || SKINS[3];
  let shirt = CLOTH_COLORS[cfg.shirtColor] ?? CLOTH_COLORS[0];
  if (cfg.shirt === 'shirt_raincoat_yellow') shirt = '#f0c020';
  if (cfg.shirt === 'overalls') shirt = '#f0f0f0';
  const dark = shadeHex(shirt, -0.25);
  const sleeve = cfg.shirt === 'tee' || cfg.shirt === 'overalls' ? 4 : 10;
  for (let y = 0; y < 12; y++) for (let x = 0; x < AW; x++) for (let z = 0; z < 4; z++) {
    const fromTop = 11 - y;
    let c = fromTop < sleeve ? shirt : skin;
    if (cfg.shirt === 'flannel' && fromTop < sleeve) c = ((x >> 1) + (y >> 1)) % 2 ? shirt : dark;
    if (cfg.shirt === 'sweater' && fromTop === sleeve - 1) c = dark;
    if (cfg.shirt === 'hoodie' && fromTop === sleeve - 1) c = dark;
    g.set(x, y, z, c);
  }
  return g;
}

const hairFns = {
  buzz(set) { for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) set(x, 8, z); },
  crop(set) { hairFns.buzz(set); for (let x = 0; x < 8; x++) { set(x, 7, 8); } for (let z = 0; z < 8; z++) for (let y = 5; y < 8; y++) { set(-1, y, z); set(8, y, z); } for (let x = 0; x < 8; x++) for (let y = 4; y < 8; y++) set(x, y, -1); },
  sidepart(set) { hairFns.crop(set); for (let x = 0; x < 5; x++) set(x, 9, 4 + (x % 2)); set(0, 7, 8); set(1, 7, 8); set(2, 6, 8); },
  messy(set) { hairFns.crop(set); [[1, 9, 2], [4, 9, 5], [6, 9, 1], [2, 9, 6], [7, 8, 8], [0, 6, 8], [5, 7, 8]].forEach((p) => set(...p)); },
  curly(set) { for (let x = -1; x < 9; x++) for (let z = -1; z < 9; z++) { set(x, 8, z); if ((x + z) % 2) set(x, 9, z); } for (let x = 0; x < 8; x++) if (x % 2) set(x, 7, 8); for (let y = 4; y < 8; y++) for (let z = -1; z < 8; z++) { set(-1, y, z); set(8, y, z); } },
  afro(set) { for (let x = -2; x < 10; x++) for (let z = -2; z < 10; z++) for (let y = 4; y < 12; y++) { const inside = x >= 0 && x < 8 && z >= 0 && z < 9 && y < 8; if (inside) continue; const d = Math.hypot(x - 3.5, (y - 7) * 1.1, z - 3.5); if (d < 6.2 && !(z >= 8 && y < 8)) set(x, y, z); } },
  bob(set) { hairFns.crop(set); for (let y = 2; y < 8; y++) for (let z = -1; z < 8; z++) { set(-1, y, z); set(8, y, z); } for (let x = 0; x < 8; x++) for (let y = 2; y < 8; y++) set(x, y, -1); for (let x = 0; x < 8; x++) set(x, 7, 8); },
  shoulder(set) { hairFns.bob(set); for (let x = -1; x < 9; x++) for (let y = -3; y < 2; y++) set(x, y, -1); for (let y = -3; y < 2; y++) for (let z = 0; z < 4; z++) { set(-1, y, z); set(8, y, z); } },
  long(set) { hairFns.shoulder(set); for (let x = -1; x < 9; x++) for (let y = -8; y < -3; y++) set(x, y, -1); },
  ponytail(set) { hairFns.crop(set); for (let y = -4; y < 7; y++) set(3, y, -2), set(4, y, -2); set(3, 6, -1); set(4, 6, -1); },
  buns(set) { hairFns.crop(set); for (const bx of [-1, 7]) for (let x = bx; x < bx + 3; x++) for (let y = 8; y < 11; y++) for (let z = 2; z < 5; z++) set(x, y, z); },
  braids(set) { hairFns.bob(set); for (const bx of [-1, 8]) for (let y = -7; y < 2; y++) set(bx, y, 6 + (y % 2 ? 0 : 0)); },
  mohawk(set) { for (let z = -1; z < 9; z++) for (let y = 8; y < 11; y++) { set(3, y, z); set(4, y, z); } },
  bald() {},
  beaniehair(set) { hairFns.messy(set); for (let x = 0; x < 8; x++) set(x, 6, 8); },
};

function headGrid(cfg) {
  const g = new VoxelGrid();
  const skin = SKINS[cfg.skin] || SKINS[3];
  const hair = HAIR_COLORS[cfg.hairColor] || HAIR_COLORS[2];
  const eye = EYE_COLORS[cfg.eyeColor] || EYE_COLORS[0];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) g.set(x, y, z, skin);
  const F = 7; // front face z
  const face = (x, y, c) => g.set(x, y, F, c);
  const out = (x, y, c) => g.set(x, y, F + 1, c);
  // Eyes
  const eyeL = 1, eyeR = 5;
  const drawEye = (ex, style) => {
    switch (style) {
      case 'sleepy': face(ex, 3, eye); face(ex + 1, 3, eye); face(ex, 4, shadeHex(skin, -0.2)); face(ex + 1, 4, shadeHex(skin, -0.2)); break;
      case 'happy': face(ex, 3, eye); face(ex + 1, 4, eye); face(ex + 1, 3, skin); break;
      case 'wide': face(ex, 3, '#ffffff'); face(ex + 1, 3, eye); face(ex, 4, '#ffffff'); face(ex + 1, 4, eye); break;
      case 'dots': face(ex + 1, 3, eye); break;
      default: face(ex, 3, '#ffffff'); face(ex + 1, 3, eye); face(ex, 4, '#ffffff'); face(ex + 1, 4, eye);
    }
  };
  drawEye(eyeL, cfg.eyes);
  if (cfg.eyes === 'wink') { face(eyeR, 3, eye); face(eyeR + 1, 3, eye); } else drawEye(eyeR, cfg.eyes === 'wink' ? 'round' : cfg.eyes);
  if (cfg.eyes === 'wink') drawEye(eyeL, 'round');
  // Brows
  const browC = shadeHex(hair, -0.1);
  if (cfg.brows === 'bold') { [1, 2, 5, 6].forEach((x) => face(x, 5, browC)); }
  else if (cfg.brows === 'arched') { face(1, 5, browC); face(2, 6, browC); face(5, 6, browC); face(6, 5, browC); }
  else if (cfg.brows === 'straight') { [1, 2, 5, 6].forEach((x) => face(x, 6, browC)); }
  else { face(2, 5, browC); face(5, 5, browC); }
  // Mouth
  const lip = shadeHex(skin, -0.35);
  switch (cfg.mouth) {
    case 'grin': [2, 3, 4, 5].forEach((x) => face(x, 1, lip)); face(2, 2, lip); face(5, 2, lip); break;
    case 'neutral': [3, 4].forEach((x) => face(x, 1, lip)); break;
    case 'o': face(3, 1, '#5a2a2a'); face(4, 1, '#5a2a2a'); face(3, 2, lip); face(4, 2, lip); break;
    case 'smirk': [3, 4].forEach((x) => face(x, 1, lip)); face(5, 2, lip); break;
    case 'toothy': [2, 5].forEach((x) => face(x, 1, lip)); face(3, 1, '#ffffff'); face(4, 1, '#ffffff'); break;
    default: [3, 4].forEach((x) => face(x, 1, lip)); face(2, 2, lip); face(5, 2, lip);
  }
  // Extras
  const ex = new Set(cfg.extras || []);
  if (ex.has('freckles')) { face(1, 2, shadeHex(skin, -0.25)); face(6, 2, shadeHex(skin, -0.25)); face(2, 2, shadeHex(skin, -0.18)); }
  if (ex.has('blush')) { face(1, 2, '#f0909a'); face(6, 2, '#f0909a'); }
  if (ex.has('mark')) face(6, 1, '#3a2a1a');
  // Facial hair
  const fh = shadeHex(hair, -0.05);
  if (cfg.facialHair === 'stubble') for (let x = 1; x < 7; x++) for (let y = 0; y < 2; y++) if ((x + y) % 2) face(x, y, shadeHex(skin, -0.22));
  if (cfg.facialHair === 'moustache') { [2, 3, 4, 5].forEach((x) => face(x, 2, fh)); }
  if (cfg.facialHair === 'goatee') { [3, 4].forEach((x) => { face(x, 0, fh); }); face(2, 2, fh); face(5, 2, fh); [3, 4].forEach((x) => face(x, 2, fh)); }
  if (cfg.facialHair === 'beard') { for (let x = 0; x < 8; x++) for (let y = 0; y < 3; y++) if (!(y === 1 && x >= 3 && x <= 4)) face(x, y, fh); for (let x = 0; x < 8; x++) g.set(x, -1, F, fh), g.set(x, -1, F - 1, fh); for (let z = 3; z < 8; z++) { g.set(0, 0, z, fh); g.set(7, 0, z, fh); g.set(0, 1, z, fh); g.set(7, 1, z, fh); } }
  // Glasses / eyepatch (stick out 1 voxel)
  if (ex.has('glassesRound') || ex.has('glassesSquare')) {
    const fc = ex.has('glassesRound') ? '#5a3a20' : '#2a2a2a';
    for (const gx of [0, 4]) { out(gx, 3, fc); out(gx + 3, 3, fc); out(gx, 4, fc); out(gx + 3, 4, fc); if (ex.has('glassesSquare')) { out(gx + 1, 5, fc); out(gx + 2, 5, fc); out(gx + 1, 2, fc); out(gx + 2, 2, fc); } }
    out(3, 4, fc); out(4, 4, fc);
  }
  if (ex.has('eyepatch')) { out(5, 3, '#1a1a1a'); out(6, 3, '#1a1a1a'); out(5, 4, '#1a1a1a'); out(6, 4, '#1a1a1a'); for (let x = 0; x < 8; x++) if (x < 5) out(x, 5, '#1a1a1a'); }
  // Hair
  const hairSet = (x, y, z) => {
    if (x >= 0 && x < 8 && y >= 0 && y < 8 && z >= 0 && z < 8) return;
    g.set(x, y, z, ((x * 7 + y * 3 + z * 5) % 5 === 0) ? shadeHex(hair, 0.12) : hair);
  };
  (hairFns[cfg.hair] || hairFns.crop)(hairSet);
  // Hats
  const hat = cfg.hat;
  const hatBox = (x0, y0, z0, x1, y1, z1, c) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { g.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c); } };
  if (hat === 'bucket' || hat === 'hat_bucket_tan') {
    const c = hat === 'bucket' ? '#5a7a4a' : '#c8b088';
    hatBox(-1, 8, -1, 8, 9, 8, c); hatBox(-2, 7, -2, 9, 7, 9, shadeHex(c, -0.1));
  } else if (hat === 'beanie') {
    hatBox(-1, 6, -1, 8, 9, 8, (x, y) => (y === 6 ? '#a03a2a' : '#c0392b')); hatBox(3, 10, 3, 4, 10, 4, '#f0f0f0');
  } else if (hat === 'cap') {
    hatBox(-1, 8, -1, 8, 9, 8, '#2e5a9a'); hatBox(0, 8, 9, 7, 8, 11, '#24487a');
  } else if (hat === 'visor') {
    hatBox(-1, 7, -1, 8, 7, 8, '#e0e0e0'); hatBox(0, 7, 9, 7, 7, 11, '#3a8a5a');
  } else if (hat === 'hat_straw') {
    hatBox(0, 8, 0, 7, 10, 7, '#e8c870'); hatBox(-3, 8, -3, 10, 8, 10, (x, y, z) => ((x + z) % 2 ? '#e8c870' : '#d8b860')); hatBox(0, 8, 0, 7, 8, 7, '#a04030');
  } else if (hat === 'hat_captain') {
    hatBox(-1, 8, -1, 8, 10, 8, '#f0f0f0'); hatBox(-1, 8, -1, 8, 8, 8, '#2a2a3a'); hatBox(0, 8, 9, 7, 8, 10, '#2a2a3a'); hatBox(3, 9, 9, 4, 9, 9, '#e0c040');
  } else if (hat === 'hat_crown') {
    hatBox(1, 8, 1, 6, 8, 6, '#f2c040'); for (const [x, z] of [[1, 1], [6, 1], [1, 6], [6, 6], [3, 1], [4, 6]]) hatBox(x, 9, z, x, 10, z, '#f2c040'); g.set(3, 9, 1, '#c03040');
  }
  return g;
}

function catGrid() {
  const g = new VoxelGrid();
  g.box(0, 0, 0, 5, 3, 3, '#e8a050');
  g.box(4, 3, 0, 7, 6, 3, '#e8a050');
  g.set(4, 7, 0, '#e8a050'); g.set(7, 7, 0, '#e8a050'); g.set(4, 7, 3, '#e8a050'); g.set(7, 7, 3, '#e8a050');
  g.set(8, 5, 1, '#2a2a2a'); g.set(8, 5, 2, '#2a2a2a'); g.set(8, 4, 1, '#f8c8b0');
  for (let y = 1; y < 6; y++) g.set(-1, y, 1, '#d08a3a');
  for (let x = 1; x < 5; x += 2) g.set(x, 2, 0, '#c07030');
  return g;
}

/**
 * Builds an avatar group. Returns { group, parts: { head, body, armL, armR, legL, legR }, rodHand, height }.
 * Local axes: avatar faces +z.
 */
export function buildAvatar(cfgIn) {
  const cfg = { ...defaultAvatar(cfgIn?.gender), ...(cfgIn || {}) };
  const frame = FRAMES.find((f) => f.id === cfg.frame) || FRAMES[1];
  const height = HEIGHTS.find((h) => h.id === cfg.height) || HEIGHTS[1];
  const W = frame.id === 'broad' ? 10 : 8;
  const AW = frame.arm;
  const legH = height.leg;
  const root = new THREE.Group();
  const s = PX;

  const mk = (grid, center) => voxelMesh(grid, { scale: s, center, noise: 0.04, receiveShadow: false });

  // Legs pivot at hip
  const legL = new THREE.Group(), legR = new THREE.Group();
  const lm = mk(legGrid(cfg, legH, 0), [2, legH, 2]);
  const rm = mk(legGrid(cfg, legH, 1), [2, legH, 2]);
  legL.add(lm); legR.add(rm);
  legL.position.set(-2 * s, legH * s, 0);
  legR.position.set(2 * s, legH * s, 0);

  const body = new THREE.Group();
  const torso = mk(torsoGrid(cfg, W), [W / 2, 0, 2]);
  body.add(torso);
  body.position.set(0, legH * s, 0);

  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.add(mk(armGrid(cfg, AW, 0), [AW / 2, 12, 2]));
  armR.add(mk(armGrid(cfg, AW, 1), [AW / 2, 12, 2]));
  armL.position.set(-(W / 2 + AW / 2) * s, 12 * s, 0);
  armR.position.set((W / 2 + AW / 2) * s, 12 * s, 0);
  body.add(armL, armR);

  const head = new THREE.Group();
  head.add(mk(headGrid(cfg), [4, 0, 4]));
  head.position.set(0, 12 * s, 0);
  body.add(head);

  if (cfg.accessory === 'acc_cat') {
    const cat = mk(catGrid(), [4, 0, 2]);
    cat.position.set(-(W / 2 + 1) * s, 12 * s, -0.5 * s);
    cat.rotation.y = Math.PI / 2;
    body.add(cat);
  }

  // Rod socket in the right hand
  const rodHand = new THREE.Group();
  rodHand.position.set(0, -11 * s, 2 * s);
  armR.add(rodHand);

  root.add(legL, legR, body);
  const totalH = (legH + 12 + 8) * s;
  return { group: root, parts: { head, body, armL, armR, legL, legR }, rodHand, height: totalH, cfg };
}

// Both hands on the rod: arms angled in so the hands meet in front of the chest. The rod socket in the
// right hand counter-rotates (see Actor) so the rod still points straight out.
function twoHands(p, pitch, lower) {
  p.armR.rotation.set(pitch, 0, -0.34);
  p.armL.rotation.set(pitch + lower, 0, 0.5);
}

// Pose/animate an avatar. state: idle|walk|cast|wait|reel|sit|row|emote, t seconds
export function animateAvatar(av, state, t, extra = {}) {
  const p = av.parts;
  const sw = Math.sin(t * 9);
  p.legL.rotation.set(0, 0, 0); p.legR.rotation.set(0, 0, 0);
  p.armL.rotation.set(0, 0, 0); p.armR.rotation.set(0, 0, 0);
  p.head.rotation.set(0, 0, 0);
  p.body.rotation.set(0, 0, 0);
  const sitting = extra.sitting || state === 'row' || state === 'oars';
  if (sitting) {
    const bend = extra.chair || -Math.PI / 2; // in a low chair the legs angle down to the ground
    p.legL.rotation.x = bend + (extra.dangle ? Math.sin(t * 2) * 0.15 : 0);
    p.legR.rotation.x = bend + (extra.dangle ? Math.sin(t * 2 + 1.4) * 0.15 : 0);
  }
  switch (state) {
    case 'swim': { // v1.15: a front crawl with a flutter kick
      const k = Math.sin(t * 7), a = t * 2.4;
      p.legL.rotation.x = k * 0.35; p.legR.rotation.x = -k * 0.35;
      p.armL.rotation.set(-Math.PI + Math.sin(a) * 1.1, 0, 0.25); p.armR.rotation.set(-Math.PI + Math.sin(a + Math.PI) * 1.1, 0, -0.25);
      p.head.rotation.x = -0.7;
      break;
    }
    case 'swimgun': { // v1.15.7: swimming with a speargun, the gun held out ahead in the right hand, a one-armed stroke
      const k = Math.sin(t * 7), a = t * 2.4;
      p.legL.rotation.x = k * 0.35; p.legR.rotation.x = -k * 0.35;
      p.armL.rotation.set(-Math.PI + Math.sin(a) * 1.1, 0, 0.25); p.armR.rotation.set(-Math.PI + 0.12, 0, -0.08);
      p.head.rotation.x = -0.7;
      break;
    }
    case 'treadgun': { // treading water with a speargun: the gun held out in front, the free hand sculling
      const k = Math.sin(t * 3);
      p.legL.rotation.x = k * 0.3; p.legR.rotation.x = -k * 0.3;
      p.armL.rotation.set(-0.5, 0, 0.9 + k * 0.25); p.armR.rotation.set(-Math.PI / 2 + 0.15, 0, -0.1);
      break;
    }
    case 'tread': { // treading water: slow kicks, hands sculling
      const k = Math.sin(t * 3);
      p.legL.rotation.x = k * 0.3; p.legR.rotation.x = -k * 0.3;
      p.armL.rotation.set(-0.5, 0, 0.9 + k * 0.25); p.armR.rotation.set(-0.5, 0, -0.9 - k * 0.25);
      break;
    }
    case 'walk':
      p.legL.rotation.x = sw * 0.6; p.legR.rotation.x = -sw * 0.6;
      p.armL.rotation.x = -sw * 0.5; p.armR.rotation.x = sw * 0.5;
      break;
    case 'skate': { // Frostmere: skating, long side-pushing strides, leaning forward, arms swinging across
      const k = Math.sin(t * 4.2), a = Math.max(0, k), b = Math.max(0, -k);
      p.legL.rotation.set(-a * 0.25, 0, -0.08 - a * 0.42); p.legR.rotation.set(-b * 0.25, 0, 0.08 + b * 0.42);
      p.armL.rotation.set(-0.3 + k * 0.5, 0, -0.25); p.armR.rotation.set(-0.3 - k * 0.5, 0, 0.25);
      p.body.rotation.set(0.32, -k * 0.12, 0);
      p.head.rotation.x = -0.25;
      break;
    }
    case 'glide': { // Frostmere: gliding on skates, both blades down, a slight crouch and the arms out for balance
      p.legL.rotation.set(-0.15, 0, -0.06); p.legR.rotation.set(0.1, 0, 0.06);
      p.armL.rotation.set(-0.2, 0, -0.55 + Math.sin(t * 1.3) * 0.05); p.armR.rotation.set(-0.2, 0, 0.55 - Math.sin(t * 1.3) * 0.05);
      p.body.rotation.set(0.2, 0, 0);
      p.head.rotation.x = -0.15;
      break;
    }
    case 'sled': { // Frostmere: driving a dog sled, standing on the runners, both hands on the handlebar
      const k = Math.sin(t * 6) * 0.04;
      p.legL.rotation.set(-0.12, 0, -0.04); p.legR.rotation.set(-0.12, 0, 0.04);
      p.armL.rotation.set(-1.15 + k, 0, 0.12); p.armR.rotation.set(-1.15 - k, 0, -0.12);
      p.body.rotation.set(0.22, 0, 0);
      p.head.rotation.x = -0.18;
      break;
    }
    case 'run': {
      // a light jog: longer, quicker strides, arms pumping a little bent forward, a small forward lean
      const sr = Math.sin(t * 13);
      p.legL.rotation.x = sr * 0.85; p.legR.rotation.x = -sr * 0.85;
      p.armL.rotation.set(-sr * 0.7 - 0.3, 0, -0.1); p.armR.rotation.set(sr * 0.7 - 0.3, 0, 0.1);
      p.body.rotation.set(0.13, sr * 0.06, 0);
      p.head.rotation.x = -0.09;
      break;
    }
    // Fishing poses hold the rod in BOTH hands, in front of the body's centre: the right hand on the
    // grip, the left hand just above it on the butt (or cranking the reel while fighting a fish).
    case 'charge':
      twoHands(p, -2.6 - (extra.power || 0) * 0.5, 0.1);
      break;
    case 'cast':
      twoHands(p, -1.2 + Math.min(1, extra.k || 0) * 0.2, 0.15);
      break;
    case 'wait':
    case 'bite':
      twoHands(p, -1.0 + Math.sin(t * 1.5) * 0.03, 0.18);
      p.head.rotation.x = Math.sin(t * 0.7) * 0.05;
      break;
    case 'reel':
      twoHands(p, -1.25 + Math.sin(t * 14) * 0.05, 0.12 + Math.cos(t * 14) * 0.12);
      p.body.rotation.x = -0.08;
      break;
    case 'row':
    case 'oars': {
      // hands on the oar grips: arms spread wide and reaching forward; when rowing they pull back and
      // forth in time with the oars (animateOars uses the same sin(t * 3) stroke) and the body leans into it
      const st = state === 'row' ? Math.sin(t * 3) : 0.3;
      p.armL.rotation.set(-1.15 + st * 0.45, 0, -0.62 - st * 0.08);
      p.armR.rotation.set(-1.15 + st * 0.45, 0, 0.62 + st * 0.08);
      p.body.rotation.x = state === 'row' ? -st * 0.12 : 0;
      p.head.rotation.x = state === 'row' ? st * 0.08 : 0;
      break;
    }
    case 'dig': {
      // Digging with a shovel held in both hands: drive the blade in, lever it back, and toss the dirt
      // over your shoulder. One stroke every DIG_STROKE seconds (treasure.js times its sounds to this).
      const ph = (t % 1.1) / 1.1;
      let a, lean, twist, knee;
      if (ph < 0.35) { const k = ph / 0.35; a = -1.05 + k * 0.55; lean = 0.1 + k * 0.32; twist = 0; knee = k * 0.35; } // drive down
      else if (ph < 0.6) { const k = (ph - 0.35) / 0.25; a = -0.5 - k * 0.55; lean = 0.42 - k * 0.3; twist = 0; knee = 0.35 - k * 0.2; } // lever up
      else if (ph < 0.8) { const k = (ph - 0.6) / 0.2; a = -1.05 - k * 0.5; lean = 0.12 - k * 0.1; twist = k * 0.55; knee = 0.15; } // toss
      else { const k = (ph - 0.8) / 0.2; a = -1.55 + k * 0.5; lean = 0.02 + k * 0.08; twist = 0.55 * (1 - k); knee = 0.15 * (1 - k); } // swing back
      p.armR.rotation.set(a, 0, -0.3);
      p.armL.rotation.set(a - 0.35, 0, 0.42);
      p.body.rotation.set(lean, twist, 0);
      p.legL.rotation.x = -knee; p.legR.rotation.x = knee * 0.4;
      p.head.rotation.x = -lean * 0.4;
      break;
    }
    case 'ride': { // v1.17.2: astride a snowmobile or jet ski: leaning in, both hands on the bars
      p.body.rotation.set(0.42, 0, 0); p.armL.rotation.set(-1.32, 0, 0.1); p.armR.rotation.set(-1.32, 0, -0.1); p.head.rotation.set(-0.3, 0, 0);
      break;
    }
    case 'bike': {
      // on a bike (v1.9): legs push the pedals round (opposite legs, half a turn apart), body leans over the
      // bars, hands on the grips turning a touch with the steering; backing up, you look over your shoulder
      const c = extra.crank || 0, back = extra.back || 0, st = extra.steer || 0;
      p.legL.rotation.x = -0.32 - Math.sin(c) * 0.32; p.legR.rotation.x = -0.32 + Math.sin(c) * 0.32;
      p.body.rotation.set(0.2 - back * 0.08, back * 0.45, 0);
      p.armL.rotation.set(-0.78 + st * 0.25, 0, 0.16); p.armR.rotation.set(-0.78 - st * 0.25, 0, -0.16);
      p.head.rotation.set(-0.12, back * 1.1 + st * 0.35, 0);
      break;
    }
    case 'photo': {
      // v1.14.10: an instant camera up at the eye, both hands on it; a little nod as the shutter goes
      const nod = Math.max(0, Math.sin(t * 6)) * 0.03;
      p.armR.rotation.set(-1.78 - nod, 0, -0.42); p.armL.rotation.set(-1.78 - nod, 0, 0.42);
      p.head.rotation.x = 0.06; p.body.rotation.x = 0.04;
      break;
    }
    case 'hold':
      p.armL.rotation.x = -2.6; p.armR.rotation.x = -2.6; p.armL.rotation.z = 0.2; p.armR.rotation.z = -0.2;
      break;
    case 'wave':
      p.armR.rotation.z = 2.6 + Math.sin(t * 10) * 0.35;
      break;
    case 'cheer':
      p.armL.rotation.z = -2.7; p.armR.rotation.z = 2.7; p.body.position.y = av.parts.body.userData.baseY + Math.abs(Math.sin(t * 8)) * 0.15;
      break;
    case 'bump': // v1.15 beach volleyball: arms together, out in front and low
      p.armL.rotation.set(-1.0, 0, -0.32); p.armR.rotation.set(-1.0, 0, 0.32);
      p.legL.rotation.x = -0.35; p.legR.rotation.x = -0.35; p.body.rotation.x = 0.18;
      break;
    case 'tuck': // v1.15 cannonball: knees up, arms hugging them
      p.legL.rotation.x = -1.9; p.legR.rotation.x = -1.9;
      p.armL.rotation.set(-1.5, 0, 0.35); p.armR.rotation.set(-1.5, 0, -0.35); p.head.rotation.x = 0.4;
      break;
    case 'throw': // v1.15 coconut toss: the throwing arm back (power winds it further)
      p.armR.rotation.set(-2.4 - (extra.power || 0) * 0.6, 0, 0.2); p.armL.rotation.set(-0.8, 0, -0.2);
      break;
    case 'shrug':
      p.armL.rotation.z = -0.5; p.armR.rotation.z = 0.5; p.armL.rotation.x = -0.6; p.armR.rotation.x = -0.6; p.head.rotation.z = 0.15;
      break;
    case 'clap':
      p.armL.rotation.x = -1.3; p.armR.rotation.x = -1.3; p.armL.rotation.y = -0.5 + Math.abs(Math.sin(t * 12)) * 0.3; p.armR.rotation.y = 0.5 - Math.abs(Math.sin(t * 12)) * 0.3;
      break;
    case 'dance':
      p.legL.rotation.x = Math.sin(t * 8) * 0.4; p.legR.rotation.x = -Math.sin(t * 8) * 0.4; p.armL.rotation.z = -1.5 + Math.sin(t * 8) * 0.5; p.armR.rotation.z = 1.5 + Math.sin(t * 8) * 0.5; p.body.rotation.y = Math.sin(t * 4) * 0.3;
      break;
    case 'orange': {
      // Orange Shuffle: both arms swing side to side together while the legs take turns kicking out,
      // with a little hop on every beat
      const b = Math.sin(t * 7), step = Math.sin(t * 7 + Math.PI / 2);
      p.armL.rotation.set(-0.25, 0, -0.25 + b * 0.75); p.armR.rotation.set(-0.25, 0, 0.25 + b * 0.75);
      p.legL.rotation.set(Math.max(0, step) * -0.5, 0, Math.max(0, step) * -0.35);
      p.legR.rotation.set(Math.max(0, -step) * -0.5, 0, Math.max(0, -step) * 0.35);
      p.body.rotation.set(0, -b * 0.18, b * 0.08);
      p.head.rotation.z = -b * 0.1;
      break;
    }
    case 'sleep':
      p.head.rotation.x = 0.35; p.armL.rotation.x = -0.3; p.armR.rotation.x = -0.9;
      break;
    case 'yell': {
      // v1.9.4: telling someone off: leaning in, one finger jabbing the air on every word, the other hand
      // on the hip, head bobbing forward with the shouting
      const j = Math.max(0, Math.sin(t * 9)), w = Math.sin(t * 2.3);
      p.body.rotation.set(0.16 + j * 0.05, w * 0.12, 0);
      p.head.rotation.set(-0.12 + j * 0.1, w * 0.1, 0);
      p.armR.rotation.set(-1.45 - j * 0.35, 0, 0.12);
      p.armL.rotation.set(0.15, 0, -0.75);
      break;
    }
    case 'drum': {
      // v1.15.10: the fireside player on Palm Key: both hands beating a standing drum in front, one then the other,
      // swaying with the rhythm
      const L = Math.max(0, Math.sin(t * 7.2)), R = Math.max(0, Math.sin(t * 7.2 + Math.PI)), sway = Math.sin(t * 1.8);
      p.armL.rotation.set(-0.95 + L * 0.45, 0, 0.35); p.armR.rotation.set(-0.95 + R * 0.45, 0, -0.35);
      p.body.rotation.set(0.12, sway * 0.08, sway * 0.05);
      p.head.rotation.set(0.1 + Math.max(L, R) * 0.06, sway * 0.15, 0);
      break;
    }
    case 'roast': {
      // v1.9.5/6: both hands together out in front, holding a roasting stick toward the fire, turning it
      const tw = Math.sin(t * 2.6) * 0.05;
      p.armL.rotation.set(-1.22 + tw, 0, 0.5); p.armR.rotation.set(-1.22 - tw, 0, -0.5);
      p.head.rotation.x = 0.16;
      break;
    }
    case 'eat': {
      // v1.9.6: both hands up at the mouth holding the roasted fish, a chomp at a time
      const ch = Math.max(0, Math.sin(t * 11.4));
      // v1.13.11: hands at mouth height (they were up at the eyes, so the fish sat on the nose)
      p.armL.rotation.set(-1.7 + ch * 0.1, 0, 0.62); p.armR.rotation.set(-1.7 + ch * 0.1, 0, -0.62);
      p.head.rotation.x = 0.05 + ch * 0.12;
      p.body.rotation.x = 0.04;
      break;
    }
    case 'cry': {
      // v1.9.4: crying into both hands: head bowed, hands up over the face, shoulders shaking with sobs
      const sob = Math.sin(t * 13) * (0.6 + 0.4 * Math.max(0, Math.sin(t * 1.7)));
      p.head.rotation.set(0.6 + sob * 0.03, 0, sob * 0.02);
      p.body.rotation.set(0.22, 0, sob * 0.03);
      p.armL.rotation.set(-1.95 + sob * 0.05, 0, 0.55);
      p.armR.rotation.set(-1.95 - sob * 0.05, 0, -0.55);
      break;
    }
    default: // idle
      p.armL.rotation.x = Math.sin(t * 1.6) * 0.04; p.armR.rotation.x = -Math.sin(t * 1.6) * 0.04;
  }
  if (p.body.userData.baseY == null) p.body.userData.baseY = p.body.position.y;
  if (state !== 'cheer') p.body.position.y = p.body.userData.baseY + (state === 'idle' ? Math.sin(t * 1.6) * 0.008 : state === 'orange' ? Math.abs(Math.sin(t * 7)) * 0.05 : state === 'cry' ? Math.abs(Math.sin(t * 13)) * 0.012 : 0);
}

export function rodColorsFor(itemId) {
  return ITEMS_BY_ID[itemId]?.colors || ['#8a6a3a', '#6a4a2a'];
}
