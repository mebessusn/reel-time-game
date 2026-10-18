// Soft-block boats: a rounded plank floor, soft walls with a pointed bow, gunwale trim, thwarts and
// oarlocks, plus per-skin pieces (duck head, swan neck and wings, pirate mast and sail, lily pad...).
// Bow toward +Z, keel at y = 0, about 3.4 long and 1.6 wide like the old voxel rowboat.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Atlas, softBox, tone, mix, hash, atlasMaterial } from '../render/soft.js';
import { ITEMS_BY_ID } from '../data/items.js';

const SKIN = {
  boat_oak: { hull: '#a0703e', trim: '#7a5230', seat: '#c8a070', paint: null },
  boat_blue: { hull: '#4a7ac0', trim: '#f0f0f0', seat: '#a0703e', stripe: '#f0f0f0', band: '#c04030' },
  boat_birch: { hull: '#ece4d4', trim: '#f08ab0', seat: '#c8b890', birch: true, flowers: true },
  boat_canoe: { hull: '#d04a30', trim: '#f0e0c0', seat: '#8a4a20', canoe: true, stripe: '#f0e0c0', zig: '#2a2a2a' },
  boat_duck: { hull: '#f0d030', trim: '#f8e060', seat: '#f8f0c0', duck: true },
  boat_lily: { lily: true },
  boat_pirate: { hull: '#3a2a20', trim: '#c8a040', seat: '#a02020', pirate: true },
  boat_swan: { hull: '#f2c040', trim: '#fff0c0', seat: '#c08a20', swan: true, neck: '#f2c040', wing: '#f8d870', beak: '#e07020' },
  boat_crystal: { hull: '#a0f0ff', trim: '#ffffff', seat: '#60c0e0', swan: true, crystal: true, neck: '#b8f4ff', wing: '#d8faff', beak: '#60c0e0' },
  boat_oars_gold: { hull: '#a0703e', trim: '#f2c040', seat: '#c8a070', band: '#f2c040', goldOars: true },
};

const FLOOR_Y = 0.16, WALL_TOP = 0.56, HALF_W = 0.74, STERN = -1.55, BOW_Z = 0.95, TIP = 1.72;

export function buildSoftBoat(itemId) {
  const k = SKIN[itemId] ? itemId : 'boat_oak';
  const s = SKIN[k];
  const atlas = new Atlas(512);
  const geos = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const add = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => { m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz, 'YXZ')), one); geo.applyMatrix4(m4); geos.push(geo); };

  if (s.lily) return finishLily(atlas, geos, add);

  const hull = s.hull, trim = s.trim, seat = s.seat;
  // plank textures
  const planks = (base, horizontal = true) => (f) => f.fill((x, y) => {
    const a = horizontal ? y : x, b = horizontal ? x : y;
    const row = Math.floor(a / 4);
    if (a % 4 === 3) return tone(base, -0.22); // seam
    if ((b + row * 11) % 23 === 0) return tone(base, -0.3); // butt joint
    if (s.birch && hash(Math.floor(b / 3), a, 3) > 0.93) return '#2a2620'; // birch bark dashes
    const n = hash(Math.floor(b / 3), row, 5);
    return n > 0.75 ? tone(base, 0.07) : n < 0.2 ? tone(base, -0.06) : base;
  });
  const outer = (f, side) => {
    planks(hull)(f);
    if (s.stripe) f.rect(0, 1, f.w, 1, s.stripe);
    if (s.band) f.rect(0, f.h - 3, f.w, 2, s.band);
    if (s.zig) for (let x = 0; x < f.w; x++) f.px(x, 3 + [0, 1, 2, 1][x % 4], s.zig);
    if (s.pirate && (side === 'front' || side === 'back')) for (let x = 6; x < f.w - 4; x += 8) f.rect(x, 3, 3, 3, '#141010'); // gun ports
    if (s.duck) for (let x = 4; x < f.w - 4; x += 6) f.rect(x, 2, 2, f.h - 5, tone(hull, -0.12)); // feather marks
    if (s.crystal) for (let i = 0; i < f.w * f.h * 0.06; i++) { const x = Math.floor(hash(i, 1, 7) * f.w), y = Math.floor(hash(i, 2, 7) * f.h); f.px(x, y, '#ffffff'); }
  };
  const wallPaint = { front: outer, back: (f) => planks(tone(hull, -0.12))(f), top: (f) => f.fill(trim), all: (f) => planks(hull)(f) };

  // floor (rounded tub bottom) + pointed bow floor
  add(softBox(atlas, HALF_W * 2, 0.3, BOW_Z - STERN, 0.12, {
    top: planks(tone(seat, -0.1), false), bottom: (f) => f.fill(tone(hull, -0.3)), all: outer,
  }), 0, FLOOR_Y, (BOW_Z + STERN) / 2);
  const bowSide = Math.SQRT2 * HALF_W;
  add(softBox(atlas, bowSide, 0.3, bowSide, 0.1, { top: planks(tone(seat, -0.1), false), all: outer }), 0, FLOOR_Y, BOW_Z, 0, Math.PI / 4, 0);
  if (s.canoe) add(softBox(atlas, bowSide, 0.3, bowSide, 0.1, { top: planks(tone(seat, -0.1), false), all: outer }), 0, FLOOR_Y, STERN + 0.1, 0, Math.PI / 4, 0);

  // walls: sides, stern transom, two bow walls meeting at the tip
  const wallH = WALL_TOP - 0.12, wallY = 0.12 + wallH / 2, wt = 0.09;
  const sideLen = BOW_Z - STERN + (s.canoe ? -0.4 : 0);
  const sideZ = s.canoe ? (BOW_Z + STERN + 0.4) / 2 : (BOW_Z + STERN) / 2;
  for (const sx of [-1, 1]) {
    add(softBox(atlas, wt, wallH, sideLen, 0.04, { right: sx > 0 ? outer : wallPaint.back, left: sx > 0 ? wallPaint.back : outer, top: (f) => f.fill(trim), all: outer }), sx * (HALF_W - wt / 2), wallY, sideZ);
    // bow walls (and stern walls for the canoe)
    const bl = Math.hypot(HALF_W, TIP - BOW_Z) + 0.04;
    const ang = Math.atan2(HALF_W, TIP - BOW_Z);
    add(softBox(atlas, wt, wallH + (s.canoe ? 0.08 : 0.04), bl, 0.04, { right: sx > 0 ? outer : wallPaint.back, left: sx > 0 ? wallPaint.back : outer, top: (f) => f.fill(trim), all: outer }), sx * HALF_W / 2, wallY + 0.02, (BOW_Z + TIP) / 2 - 0.02, 0, -sx * ang, 0);
    if (s.canoe) add(softBox(atlas, wt, wallH + 0.08, bl, 0.04, { right: sx > 0 ? outer : wallPaint.back, left: sx > 0 ? wallPaint.back : outer, top: (f) => f.fill(trim), all: outer }), sx * HALF_W / 2, wallY + 0.02, STERN + 0.4 - (TIP - BOW_Z) / 2 + 0.02, 0, sx * ang, 0);
  }
  if (!s.canoe) add(softBox(atlas, HALF_W * 2, wallH, wt, 0.04, { back: outer, front: wallPaint.back, top: (f) => f.fill(trim), all: outer }), 0, wallY, STERN + wt / 2);
  // gunwale trim caps
  for (const sx of [-1, 1]) add(softBox(atlas, wt + 0.05, 0.05, sideLen + 0.04, 0.02, { all: (f) => f.fill((x, y) => (x % 9 === 0 ? tone(trim, -0.15) : trim)) }), sx * (HALF_W - wt / 2), WALL_TOP + 0.02, sideZ);
  // bow post
  add(softBox(atlas, 0.12, wallH + 0.14, 0.12, 0.05, { all: (f) => f.fill(trim) }), 0, wallY + 0.06, TIP - 0.08);
  // thwarts (the rower sits on the rear one)
  for (const z of [-0.35, 0.55]) add(softBox(atlas, HALF_W * 2 - 0.12, 0.07, 0.26, 0.03, { all: planks(seat, false) }), 0, 0.38, z);
  // oarlocks
  for (const sx of [-1, 1]) add(softBox(atlas, 0.06, 0.12, 0.1, 0.025, { all: (f) => f.fill(s.goldOars ? '#ffe080' : tone(trim, -0.3)) }), sx * HALF_W, WALL_TOP + 0.08, 0.2);

  // ---------------- skin extras
  if (s.flowers) for (const [sx, z, c] of [[-1, -1.1, '#f08ab0'], [1, -0.6, '#f8e070'], [-1, 0.1, '#a070e0'], [1, 0.75, '#f08ab0'], [-1, 0.85, '#ffffff']]) {
    add(softBox(atlas, 0.12, 0.1, 0.12, 0.05, { all: (f) => f.fill((x, y) => (x + y === 2 ? '#f8e070' : c)), bottom: (f) => f.fill('#4a8a30') }), sx * (HALF_W - 0.04), WALL_TOP + 0.1, z);
  }
  if (s.duck) {
    const y0 = WALL_TOP;
    add(softBox(atlas, 0.26, 0.42, 0.26, 0.1, { all: (f) => f.fill(hull) }), 0, y0 + 0.18, TIP - 0.12);
    add(softBox(atlas, 0.42, 0.38, 0.44, 0.15, {
      all: (f) => f.fill(hull),
      right: (f) => { f.fill(hull); f.rect(Math.round(f.w * 0.55), Math.round(f.h * 0.35), 3, 3, '#1a1a1a'); f.px(Math.round(f.w * 0.55), Math.round(f.h * 0.35), '#ffffff'); },
      left: (f) => { f.fill(hull); f.rect(Math.round(f.w * 0.45) - 3, Math.round(f.h * 0.35), 3, 3, '#1a1a1a'); f.px(Math.round(f.w * 0.45) - 1, Math.round(f.h * 0.35), '#ffffff'); },
    }), 0, y0 + 0.52, TIP - 0.02);
    add(softBox(atlas, 0.26, 0.1, 0.24, 0.04, { all: (f) => f.fill((x, y) => (y === 0 ? tone('#f08020', 0.2) : '#f08020')) }), 0, y0 + 0.46, TIP + 0.28);
    add(softBox(atlas, 0.3, 0.2, 0.18, 0.08, { all: (f) => f.fill(hull) }), 0, y0 + 0.08, STERN - 0.04, -0.6, 0, 0);
  }
  if (s.swan) {
    const y0 = WALL_TOP;
    const neck = [[0.06, TIP - 0.1, 0.1], [0.24, TIP - 0.02, -0.05], [0.42, TIP - 0.06, -0.3], [0.6, TIP - 0.16, -0.1], [0.78, TIP - 0.12, 0.3], [0.94, TIP - 0.02, 0.5]];
    for (const [dy, z, rx] of neck) add(softBox(atlas, 0.18, 0.22, 0.18, 0.07, { all: (f) => f.fill((x, y) => (s.crystal && (x + y) % 5 === 0 ? '#ffffff' : s.neck)) }), 0, y0 + dy, z, rx, 0, 0);
    add(softBox(atlas, 0.24, 0.22, 0.32, 0.09, {
      all: (f) => f.fill(s.neck),
      right: (f) => { f.fill(s.neck); f.rect(Math.round(f.w * 0.6), 2, 2, 2, '#1a1a1a'); },
      left: (f) => { f.fill(s.neck); f.rect(Math.round(f.w * 0.4) - 2, 2, 2, 2, '#1a1a1a'); },
    }), 0, y0 + 1.08, TIP + 0.06);
    add(softBox(atlas, 0.12, 0.08, 0.22, 0.03, { all: (f) => f.fill(s.beak) }), 0, y0 + 1.04, TIP + 0.3);
    // raised wings along both sides: feathered cards
    for (const sx of [-1, 1]) {
      const wing = (f) => {
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
          const u = x / f.w, v = y / f.h;
          const prof = 0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (1 - u * 0.35);
          if (1 - v > prof || (1 - v > prof - 0.12 && x % 4 === 0)) { f.px(x, y, 'clear'); continue; }
          f.px(x, y, (x + (y >> 1)) % 5 === 0 ? tone(s.wing, -0.12) : s.crystal && (x + y) % 7 === 0 ? '#ffffff' : s.wing);
        }
      };
      add(softBox(atlas, 0.03, 0.5, 1.9, 0.01, { right: wing, left: wing, all: (f) => f.fill('clear') }, { shade: false, seg: 1 }), sx * (HALF_W + 0.02), WALL_TOP + 0.2, -0.2, 0, 0, sx * 0.18);
    }
    add(softBox(atlas, 0.4, 0.22, 0.2, 0.08, { all: (f) => f.fill(s.wing) }), 0, WALL_TOP + 0.1, STERN - 0.05, -0.5, 0, 0);
    if (s.crystal) for (const [x, z, h] of [[-0.35, -1.25, 0.32], [0.3, -1.15, 0.24], [0, -1.35, 0.42]]) add(softBox(atlas, 0.08, h, 0.08, 0.02, { all: (f) => f.fill((px, py) => (py < 2 ? '#ffffff' : '#88e0f8')) }), x, WALL_TOP + h / 2, z, 0, 0.78, 0);
  }
  if (s.pirate) {
    add(softBox(atlas, 0.1, 2.3, 0.1, 0.04, { all: (f) => f.fill((x, y) => (y % 7 === 0 ? '#3a2416' : '#4a3020')) }), 0, 1.3, 0.85);
    add(softBox(atlas, 1.5, 0.07, 0.07, 0.03, { all: (f) => f.fill('#4a3020') }), 0, 2.15, 0.88);
    const sail = (f) => f.fill((x, y) => (y > f.h * 0.42 && y < f.h * 0.58 ? '#a02020' : (x + y) % 9 === 0 ? '#d0ccbc' : '#e8e4d4'));
    add(softBox(atlas, 1.36, 1.05, 0.03, 0.01, { front: sail, back: sail, all: (f) => f.fill('#d8d4c4') }, { seg: 1 }), 0, 1.58, 0.82, -0.08, 0, 0);
    const flag = (f) => { f.fill('#1a1a1a'); f.rect(Math.floor(f.w / 2) - 1, Math.floor(f.h / 2) - 1, 3, 2, '#f0f0f0'); };
    add(softBox(atlas, 0.03, 0.2, 0.32, 0.01, { right: flag, left: flag, all: (f) => f.fill('#1a1a1a') }, { seg: 1 }), 0, 2.38, 1.0);
    add(softBox(atlas, 0.08, 0.08, 0.6, 0.03, { all: (f) => f.fill('#4a3020') }), 0, WALL_TOP + 0.14, TIP + 0.24, -0.3, 0, 0);
  }

  const geo = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  const mat = atlasMaterial(atlas, s.crystal ? { emissive: '#a0f0ff', emissiveIntensity: 0.22 } : {});
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  return { mesh, seatY: 0.42, oarColor: s.goldOars ? '#f2c040' : tone(s.hull, -0.1), oarShaft: s.goldOars ? '#c89a30' : '#8a6a4a' };
}

function finishLily(atlas, geos, add) {
  const pad = '#5ab040', vein = '#7ad060', dark = '#3a8a30';
  const R = 1.45;
  const top = (f) => {
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const u = (x + 0.5) / f.w - 0.5, v = (y + 0.5) / f.h - 0.5;
      const d = Math.hypot(u, v) * 2;
      const ang = Math.atan2(u, v); // notch toward the stern (+v is the back of the face = -z)
      if (d > 1 || (Math.abs(ang) < 0.22 && d > 0.15)) { f.px(x, y, 'clear'); continue; }
      let c = pad;
      if (d > 0.9) c = dark;
      else if (Math.abs(u) < 0.012 || Math.abs(Math.abs(ang) - 1.3) < 0.04 || Math.abs(Math.abs(ang) - 2.3) < 0.035) c = vein;
      else if (hash(x, y, 9) > 0.92) c = tone(pad, 0.08);
      f.px(x, y, c);
    }
  };
  const side = (f) => f.fill(dark);
  add(softBox(atlas, R * 2, 0.1, R * 2, 0.04, { top, bottom: top, all: (f) => f.fill('clear') }, { D: 40, seg: 1 }), 0, 0.12, 0);
  // lotus flower and a frog friend
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(softBox(atlas, 0.14, 0.06, 0.3, 0.03, { all: (f) => f.fill((x, y) => (y < 2 ? '#f8d0e0' : '#f0a0c0')) }), 0.7 + Math.cos(a) * 0.12, 0.24, 0.85 + Math.sin(a) * 0.12, 0.5, -a + Math.PI / 2, 0);
  }
  add(softBox(atlas, 0.1, 0.1, 0.1, 0.04, { all: (f) => f.fill('#f8e070') }), 0.7, 0.3, 0.85);
  add(softBox(atlas, 0.26, 0.16, 0.24, 0.08, { all: (f) => f.fill('#3a9a30'), bottom: (f) => f.fill('#c8e8a0') }), -0.75, 0.25, -0.6);
  for (const sx of [-1, 1]) add(softBox(atlas, 0.08, 0.08, 0.08, 0.03, { all: (f) => { f.fill('#ffffff'); f.rect(1, 1, 1, 1, '#1a1a1a'); } }), -0.75 + sx * 0.07, 0.36, -0.52);
  // a cushion seat in the middle
  add(softBox(atlas, 0.6, 0.12, 0.55, 0.05, { all: (f) => f.fill((x, y) => ((x + y) % 4 < 2 ? '#f0a0c0' : '#f8b8d0')) }), 0, 0.22, -0.2);
  const geo = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  const mesh = new THREE.Mesh(geo, atlasMaterial(atlas));
  mesh.castShadow = true;
  return { mesh, seatY: 0.28, oarColor: '#5ab040', oarShaft: '#3a8a30' };
}

/** Soft oar: shaft + blade, pivoting at its inner end (+X outward). */
export function buildSoftOar(blade, shaft) {
  const atlas = new Atlas(64);
  const geos = [];
  const sh = softBox(atlas, 1.6, 0.06, 0.06, 0.025, { all: (f) => f.fill((x) => (x % 6 === 0 ? tone(shaft, -0.15) : shaft)) }, { seg: 1 });
  sh.translate(0.8, 0, 0); geos.push(sh);
  const bl = softBox(atlas, 0.42, 0.04, 0.2, 0.02, { all: (f) => f.fill((x, y) => (x === 0 ? tone(blade, -0.2) : blade)) }, { seg: 1 });
  bl.translate(1.65, 0, 0); geos.push(bl);
  const mesh = new THREE.Mesh(mergeGeometries(geos), atlasMaterial(atlas));
  mesh.castShadow = false;
  return mesh;
}
