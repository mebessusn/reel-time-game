// v1.17.15 bigger homes, outside: your cabin up the hill grows with the home you own (src/game/home.js HOME_TIERS), and
// the Lakehouse adds a house of its own on Cozy Cove's west shore with a deck and a dock you can walk out on and fish
// from. Homes are your own (inside, a visitor builds your rooms from your presence), so out here each player sees their
// own: the pieces are built once, shown by tier, and their colliders and walkways only count while they're shown.
//   Cottage (1): a den, a lean-to on the cabin's east end with a window on three sides.
//   Lodge (2): a great room, a cross wing behind the cabin with a stone chimney (the fireplace inside) and tall windows.
//   Lakehouse (3): the shore house (HOME_PLOT in terrain.js), its deck, steps down to the beach and a dock.
import * as THREE from 'three';
import { Kit, planksAlong, planksAcross, stone, paintText } from './softprops.js';
import { tone, hash } from '../render/soft.js';
import { heightAt, surfaceY, addWalkway, WATER_Y } from './terrain.js';
import { addBox, addCircle } from './colliders.js';
import { nightWindows } from './nightwindows.js';
import { HUTS } from './props.js';
import { homeTier } from '../game/home.js';

const HOME = HUTS.find((h) => h.name === 'home');
const PITCH = 0.55, TAN = Math.tan(PITCH);
const logs = (c) => (f) => f.fill((x, yy) => (yy % 6 === 5 ? tone(c, -0.3) : yy % 6 === 0 ? tone(c, 0.12) : hash(Math.floor(x / 5), Math.floor(yy / 6), 3) > 0.8 ? tone(c, -0.08) : c));
const boards = (c) => (f) => f.fill((x, yy) => (x % 7 === 6 ? tone(c, -0.22) : x % 7 === 0 ? tone(c, 0.1) : hash(Math.floor(x / 7), Math.floor(yy / 9), 8) > 0.82 ? tone(c, -0.06) : c));
const shingles = (c) => (f) => f.fill((x, yy) => (yy % 4 === 3 ? tone(c, -0.3) : (x + Math.floor(yy / 4) * 3) % 7 === 0 ? tone(c, -0.2) : hash(Math.floor(x / 3), Math.floor(yy / 4), 5) > 0.8 ? tone(c, 0.1) : c));
/** A face painter: the wall's own paint, then windows (u, v from the face's left and top, w, h: fractions). */
const withWindows = (base, wins, glass = '#ffe0a0', frame = '#3a2a1a') => (f) => {
  base(f);
  for (const [u, v, w, h] of wins) {
    const x0 = Math.floor(f.w * u), y0 = Math.floor(f.h * v), ww = Math.max(3, Math.floor(f.w * w)), hh = Math.max(3, Math.floor(f.h * h));
    f.rect(x0, y0, ww, hh, frame); f.rect(x0 + 1, y0 + 1, ww - 2, hh - 2, glass);
    f.rect(x0 + Math.floor(ww / 2), y0 + 1, 1, hh - 2, frame); // (a glazing bar)
  }
};
/** A flat triangle (a gable end or a lean-to's side), points in the plane's own (u, v), 0.18 thick, log-striped. */
function wallTri(pts, color, striped = true) {
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 30;
  const cx = cv.getContext('2d');
  for (let yy = 0; yy < 30; yy++) { const r = yy % 6; cx.fillStyle = striped ? (r === 5 ? tone(color, -0.3) : r === 0 ? tone(color, 0.12) : color) : color; cx.fillRect(0, yy, 16, 1); }
  if (!striped) for (let x = 6; x < 16; x += 7) { cx.fillStyle = tone(color, -0.22); cx.fillRect(x, 0, 1, 30); }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1 / 1.9, 1 / 1.9); tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v))), { depth: 0.18, bevelEnabled: false });
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- the cabin's wings (world coordinates)
const Y0 = heightAt(HOME.x, HOME.z); // (where props.js stands the cabin)
const EAST = HOME.x + HOME.w / 2; // the cabin's east gable wall, x
const BACK = HOME.z + HOME.d / 2; // its back wall (the side away from the cove), z
/** The den: a lean-to on the east end. Walls x EAST..x1, z z0..z1, 2.15 m; the roof falls from under the cabin's eave. */
export const DEN_WING = { x0: EAST, x1: EAST + 3.5, z0: HOME.z - 1.7, z1: HOME.z + 1.7, h: 2.15, hi: 2.75 };
/** The great room: a cross wing off the back wall, ridge running away from the cove, with a chimney on its east side. */
export const GREAT_WING = { x0: HOME.x - 1.8, x1: HOME.x + 1.8, z0: BACK - 0.1, z1: BACK + 5, h: 2.6 };
const CHIMNEY = { x0: GREAT_WING.x1, x1: GREAT_WING.x1 + 1.12, z0: HOME.z + 4.3, z1: HOME.z + 5.3 };

function buildDen() {
  const D = DEN_WING, k = new Kit(512), wall = HOME.wall, cx = (D.x0 + D.x1) / 2, cz = (D.z0 + D.z1) / 2, lx = D.x1 - D.x0 + 0.15, lz = D.z1 - D.z0;
  const win = [[0.36, 0.22, 0.28, 0.36]];
  k.box(lx, D.h, lz, 0.14, { all: logs(wall), right: withWindows(logs(wall), win), front: withWindows(logs(wall), [[0.45, 0.22, 0.26, 0.36]]), back: withWindows(logs(wall), [[0.45, 0.22, 0.26, 0.36]]) }, cx - 0.075, D.h / 2, cz);
  // the roof: one slab from under the cabin's eave out past the east wall. Its underside runs from hi at the cabin's
  // wall down to h (the walls' top) at the east wall, and on 0.25 m past it.
  const xa = D.x0 - 0.05, xb = D.x1 + 0.25, m = (D.hi - D.h) / (D.x1 - xa), a = Math.atan(m), under = (x) => D.hi - (x - xa) * m;
  k.box(Math.hypot(xb - xa, under(xa) - under(xb)), 0.16, lz + 0.5, 0.05, { top: shingles(HOME.roof), all: (f) => f.fill(tone(HOME.roof, -0.35)) }, (xa + xb) / 2, under((xa + xb) / 2) + 0.08 / Math.cos(a), cz, 0, 0, -a);
  const g = new THREE.Group(); g.name = 'home-den';
  g.add(k.mesh('home-den'));
  // the triangles between the side walls' tops and the sloping roof (north and south)
  const top = (x) => under(x) + 0.02; // (just into the roof slab, so no gap shows)
  for (const z of [D.z0, D.z1 - 0.18]) {
    const t = wallTri([[0, 0], [D.x1 - D.x0 - 0.04, 0], [D.x1 - D.x0 - 0.04, Math.max(0.01, top(D.x1) - D.h)], [0, top(D.x0) - D.h]], wall);
    t.position.set(D.x0, D.h - 0.01, z); g.add(t);
  }
  // night: the three windows glow
  const pane = (w, h, x, y, z, ry) => { const p = nightWindows.pane(w, h); p.position.set(x, y, z); p.rotation.y = ry; g.add(p); };
  pane(lx * 0.28 - 0.06, D.h * 0.36 - 0.06, D.x1 + 0.012, D.h * (1 - 0.22 - 0.18), cz + lz * (0.5 - 0.36 - 0.14), Math.PI / 2); // (right face: u runs from +z to -z)
  for (const [z, ry] of [[D.z1 + 0.012, 0], [D.z0 - 0.012, Math.PI]]) pane(lx * 0.26 - 0.06, D.h * 0.36 - 0.06, cx - 0.075 + (ry ? -1 : 1) * lx * (0.45 + 0.13 - 0.5), D.h * (1 - 0.22 - 0.18), z, ry);
  return g;
}

function buildGreatWing() {
  const G = GREAT_WING, wall = HOME.wall, len = G.z1 - G.z0, wid = G.x1 - G.x0, half = wid / 2 + 0.4, slab = half / Math.cos(PITCH), cz = (G.z0 + G.z1) / 2;
  // built in its own frame, like a hut turned a quarter: local x runs along the ridge (world -z), local +z is world +x
  const k = new Kit(1024), north = 2.0, south = 0.3; // (the roof runs on past the north end, up under the cabin's roof, to close the join)
  const tall = [[0.14, 0.12, 0.16, 0.62], [0.42, 0.12, 0.16, 0.62], [0.7, 0.12, 0.16, 0.62]];
  // faces in local terms: front (+z) is the world east side, back (-z) world west, left (-x) the south gable end
  k.box(len, G.h, wid, 0.16, { all: logs(wall), back: withWindows(logs(wall), tall), front: withWindows(logs(wall), [[0.12, 0.2, 0.14, 0.38]]), left: withWindows(logs(wall), [[0.3, 0.12, 0.4, 0.6]]) }, 0, G.h / 2, 0);
  const lx0 = -len / 2 - south, lx1 = len / 2 + north;
  for (const s of [-1, 1]) k.box(lx1 - lx0, 0.16, slab, 0.06, { top: shingles(HOME.roof), all: (f) => f.fill(tone(HOME.roof, -0.35)) }, (lx0 + lx1) / 2, G.h + TAN * half / 2 + 0.05, s * half / 2, s * PITCH, 0, 0);
  // the chimney on the east side (local +z), a breast up the wall and a stack outside the eave
  const C = CHIMNEY, ccz = (C.z0 + C.z1) / 2, clx = cz - ccz;
  k.box(C.z1 - C.z0, 2.3, 0.44, 0.06, { all: stone('#8a8478') }, clx, 1.15, wid / 2 + 0.22);
  k.box(C.z1 - C.z0, G.h + 2.2, 0.66, 0.08, { all: stone('#8a8478') }, clx, (G.h + 2.2) / 2, wid / 2 + 0.44 + 0.33 + 0.02);
  k.box(C.z1 - C.z0 + 0.12, 0.14, 0.78, 0.04, { all: stone('#6a655c') }, clx, G.h + 2.2 + 0.05, wid / 2 + 0.79);
  const g = new THREE.Group(); g.name = 'home-great';
  g.position.set(HOME.x, 0, cz); g.rotation.y = Math.PI / 2;
  g.add(k.mesh('home-great'));
  // the south gable (the north one is under the cabin's roof)
  const t = wallTri([[-wid / 2 + 0.02, 0], [wid / 2 - 0.02, 0], [0, TAN * half - 0.1]], wall);
  t.rotation.y = Math.PI / 2; t.position.set(-len / 2 + 0.02, G.h - 0.02, 0); g.add(t);
  // night: the tall windows on the west side and the gable window
  for (const u of [0.14, 0.42, 0.7]) { const p = nightWindows.pane(len * 0.16 - 0.06, G.h * 0.62 - 0.06); p.position.set(len / 2 - len * (u + 0.08), G.h * (1 - 0.12 - 0.31), -wid / 2 - 0.012); p.rotation.y = Math.PI; g.add(p); }
  { const p = nightWindows.pane(wid * 0.4 - 0.06, G.h * 0.6 - 0.06); p.position.set(-len / 2 - 0.012, G.h * (1 - 0.12 - 0.3), -wid / 2 + wid * 0.5); p.rotation.y = -Math.PI / 2; g.add(p); }
  return g;
}

// ---------------------------------------------------------------- the Lakehouse (world coordinates)
// The house stands on a stone plinth on the bank (its back on the slope, its front 0.9 m up), door to the water. In front:
// an open deck with a rail, steps down to the beach at its south end, and a dock out over the shallows.
const FLOOR = 1.95, DECK = 1.5;
export const LAKEHOUSE = {
  x0: -42, x1: -37.5, z0: 1, z1: 7, floor: FLOOR, h: 2.6,
  porch: { x0: -37.5, x1: -35.5, z0: 1.5, z1: 6.5 }, porchY: FLOOR,
  dock: { x0: -35.5, x1: -25, z0: 3.05, z1: 4.95, y: DECK, step: -35.0 },
  stairs: { x0: -36.9, x1: -35.9 },
  door: { x: -37.0, z: 4 },
};
LAKEHOUSE.dockEnd = { x: LAKEHOUSE.dock.x1 - 0.7, z: (LAKEHOUSE.dock.z0 + LAKEHOUSE.dock.z1) / 2 };
LAKEHOUSE.lantern = { x: LAKEHOUSE.dock.x1 - 1.6, z: LAKEHOUSE.dock.z0 + 0.1 };
const LH = LAKEHOUSE;
const pileTop = (x) => DECK + (x > LH.dock.x1 - 0.2 ? 0.48 : 0.25); // (the end pair carries the end rail)

function buildLakehouse() {
  const k = new Kit(1024), wallC = '#5f8296', trim = '#f2ead8', roofC = '#3e4a56', wood = '#94683e', woodD = '#6a4628';
  const cx = (LH.x0 + LH.x1) / 2, cz = (LH.z0 + LH.z1) / 2, dx = LH.x1 - LH.x0, dz = LH.z1 - LH.z0, wh = LH.h;
  // the plinth and the walls, built in the house's own frame (a hut turned a quarter: local x = world -z, local +z = world +x)
  const L = new Kit(1024);
  L.box(dz + 0.14, FLOOR - 0.4, dx + 0.14, 0.06, { all: stone('#8a8478') }, 0, (FLOOR - 0.4) / 2 + 0.4 - FLOOR, 0);
  const front = (f) => {
    withWindows(boards(wallC), [[0.08, 0.25, 0.2, 0.32], [0.72, 0.25, 0.2, 0.32]], '#ffe0a0', trim)(f);
    const dw = Math.floor(f.w * 0.17), dh = Math.floor(f.h * 0.72), x0 = Math.floor((f.w - dw) / 2);
    f.rect(x0 - 1, f.h - dh - 1, dw + 2, dh + 1, trim); f.rect(x0, f.h - dh, dw, dh, '#3e5a6e'); f.rect(x0 + 2, f.h - dh + 2, dw - 4, Math.floor(dh * 0.35), '#ffe0a0');
    f.px(x0 + dw - 3, f.h - Math.floor(dh / 2), '#f2c040');
  };
  L.box(dz, wh, dx, 0.12, { all: boards(wallC), front, left: withWindows(boards(wallC), [[0.35, 0.25, 0.3, 0.32]], '#ffe0a0', trim), right: withWindows(boards(wallC), [[0.35, 0.25, 0.3, 0.32]], '#ffe0a0', trim), back: withWindows(boards(wallC), [[0.42, 0.22, 0.16, 0.22]], '#ffe0a0', trim) }, 0, wh / 2, 0);
  const half = dx / 2 + 0.4, slab = half / Math.cos(PITCH);
  for (const s of [-1, 1]) L.box(dz + 0.6, 0.16, slab, 0.06, { top: shingles(roofC), all: (f) => f.fill(tone(roofC, -0.35)) }, 0, wh + TAN * half / 2 + 0.05, s * half / 2, s * PITCH, 0, 0);
  L.box(0.5, 1.6, 0.5, 0.1, { all: stone('#7a746c') }, dz * 0.28, wh + 1.2, -dx * 0.12); // (a chimney for the stove)
  L.box(2.0, 0.42, 0.08, 0.04, { front: (f) => { planksAlong('#4a2e18', 7, 4)(f); paintText(f, 'LAKEHOUSE', '#f8d060', '#2a1808', 2); }, all: planksAlong('#4a2e18', 7, 4) }, 0, wh - 0.3, dx / 2 + 0.07, 0, 0, 0, { D: 48 });
  for (const sx of [-1, 1]) L.box(0.12, wh, 0.12, 0.03, { all: (f) => f.fill(trim) }, sx * (dz / 2 + 0.01), wh / 2, dx / 2 + 0.01); // (corner trim)
  const house = new THREE.Group(); house.position.set(cx, FLOOR, cz); house.rotation.y = Math.PI / 2;
  house.add(L.mesh('lakehouse'));
  for (const s of [-1, 1]) { const t = wallTri([[-dx / 2 + 0.02, 0], [dx / 2 - 0.02, 0], [0, TAN * half - 0.1]], wallC, false); t.rotation.y = Math.PI / 2; t.position.set(s > 0 ? dz / 2 - 0.2 : -dz / 2 + 0.02, wh - 0.02, 0); house.add(t); }
  // night: the windows glow (front two, the sides, the back)
  const pane = (w, h, x, y, z, ry) => { const p = nightWindows.pane(w, h); p.position.set(x, y, z); p.rotation.y = ry; house.add(p); };
  for (const u of [0.08, 0.72]) pane(dz * 0.2 - 0.06, wh * 0.32 - 0.06, -dz / 2 + dz * (u + 0.1), wh * (1 - 0.25 - 0.16), dx / 2 + 0.012, 0);
  pane(dx * 0.3 - 0.06, wh * 0.32 - 0.06, dz / 2 + 0.012, wh * (1 - 0.25 - 0.16), dx / 2 - dx * 0.5, Math.PI / 2);
  pane(dx * 0.3 - 0.06, wh * 0.32 - 0.06, -dz / 2 - 0.012, wh * (1 - 0.25 - 0.16), -dx / 2 + dx * 0.5, -Math.PI / 2);
  // the deck (world frame): planks across, posts down to the ground, a rail with openings for the dock and the steps
  const P = LH.porch, D = LH.dock, deckPaint = { top: planksAcross(wood, 5, 3), all: (f) => f.fill(woodD) };
  k.box(P.x1 - P.x0, 0.12, P.z1 - P.z0, 0.03, deckPaint, (P.x0 + P.x1) / 2, FLOOR - 0.06, (P.z0 + P.z1) / 2);
  const post = (x, z, top, r = 0.14) => { const g0 = surfaceY(x, z) - 0.3; k.box(r, top - g0, r, 0.03, { all: (f) => f.fill(woodD) }, x, (top + g0) / 2, z); };
  for (const x of [P.x0 + 0.15, (P.x0 + P.x1) / 2, P.x1 - 0.1]) for (const z of [P.z0 + 0.1, cz, P.z1 - 0.1]) post(x, z, FLOOR - 0.12, 0.16);
  const railH = 0.9, rail = [];
  const railRun = (ax, az, bx, bz) => { // posts every ~1 m and a top rail between two points
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len));
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; k.box(0.1, railH, 0.1, 0.02, { all: (f) => f.fill(trim) }, x, FLOOR + railH / 2, z); }
    k.box(Math.abs(bx - ax) + 0.12, 0.08, Math.abs(bz - az) + 0.12, 0.02, { all: (f) => f.fill(trim) }, (ax + bx) / 2, FLOOR + railH, (az + bz) / 2);
    k.box(Math.abs(bx - ax) + 0.06, 0.06, Math.abs(bz - az) + 0.06, 0.02, { all: (f) => f.fill(trim) }, (ax + bx) / 2, FLOOR + railH * 0.5, (az + bz) / 2);
    rail.push([ax, az, bx, bz]);
  };
  const S = LH.stairs;
  railRun(P.x0 + 0.05, P.z0 + 0.05, P.x1 - 0.05, P.z0 + 0.05); // north side
  railRun(P.x0 + 0.05, P.z1 - 0.05, S.x0, P.z1 - 0.05); railRun(S.x1, P.z1 - 0.05, P.x1 - 0.05, P.z1 - 0.05); // south side, round the steps
  railRun(P.x1 - 0.05, P.z0 + 0.05, P.x1 - 0.05, D.z0); railRun(P.x1 - 0.05, D.z1, P.x1 - 0.05, P.z1 - 0.05); // the front, round the dock
  // the steps down to the beach at the south end
  const steps = [];
  for (let i = 1; i <= 3; i++) {
    const top = FLOOR - i * 0.28, z0 = P.z1 + (i - 1) * 0.4, z1 = z0 + 0.4, g0 = Math.min(surfaceY((S.x0 + S.x1) / 2, z0), surfaceY((S.x0 + S.x1) / 2, z1)) - 0.25;
    if (top < g0 + 0.3) break;
    k.box(S.x1 - S.x0, top - g0, 0.4, 0.03, { top: planksAcross(wood, 5, 7), all: (f) => f.fill(woodD) }, (S.x0 + S.x1) / 2, (top + g0) / 2, (z0 + z1) / 2);
    steps.push({ z0, z1, y: top });
  }
  // the dock: a step down from the deck, planks out over the shallows, posts in pairs and a low rail across the end
  k.box(D.step - D.x0, 0.12, D.z1 - D.z0, 0.03, deckPaint, (D.x0 + D.step) / 2, (FLOOR + DECK) / 2 - 0.06 + 0.02, (D.z0 + D.z1) / 2);
  k.box(D.x1 - D.step, 0.12, D.z1 - D.z0, 0.03, deckPaint, (D.step + D.x1) / 2, DECK - 0.06, (D.z0 + D.z1) / 2);
  const piles = [];
  for (let x = D.step + 0.4; x < D.x1; x += 2.4) piles.push(x);
  piles.push(D.x1 - 0.12);
  for (const x of piles) for (const z of [D.z0 - 0.02, D.z1 + 0.02]) { const g0 = Math.min(surfaceY(x, z), WATER_Y) - 0.8, t = pileTop(x); k.box(0.2, t - g0, 0.2, 0.05, { all: (f) => f.fill(woodD) }, x, (t + g0) / 2, z); }
  k.box(0.12, 0.1, D.z1 - D.z0 + 0.24, 0.02, { all: (f) => f.fill(wood) }, D.x1 - 0.12, DECK + 0.42, (D.z0 + D.z1) / 2); // (the end rail, on the two end piles)
  for (let x = D.step + 1.6; x < D.x1 - 1; x += 2.4) k.box(0.08, 0.16, D.z1 - D.z0 + 0.1, 0.02, { all: (f) => f.fill(woodD) }, x, DECK - 0.16, (D.z0 + D.z1) / 2); // (cross beams under the planks)
  // a lantern on a post near the dock's far end, and a bench on the deck under the front windows
  k.box(0.12, 1.8, 0.12, 0.03, { all: (f) => f.fill(woodD) }, LH.lantern.x, DECK + 0.9, LH.lantern.z);
  k.box(0.26, 0.32, 0.26, 0.04, { all: (f) => f.fill('#2a2a2a'), front: (f) => { f.fill('#2a2a2a'); f.rect(2, 2, f.w - 4, f.h - 4, '#ffd070'); } }, LH.lantern.x, DECK + 1.96, LH.lantern.z);
  k.box(0.42, 0.08, 1.5, 0.03, { all: planksAlong(wood, 5, 9) }, P.x0 + 0.35, FLOOR + 0.44, P.z0 + 0.95);
  for (const z of [P.z0 + 0.35, P.z0 + 1.55]) k.box(0.36, 0.44, 0.08, 0.02, { all: (f) => f.fill(woodD) }, P.x0 + 0.35, FLOOR + 0.22, z);
  const g = new THREE.Group(); g.name = 'lakehouse';
  g.add(house, k.mesh('lakehouse-deck'));
  return { group: g, rail, steps, piles };
}

/** The local player's home outside: build every piece once, then show the ones their tier has. */
export class HomePlot {
  constructor(game) { this.game = game; this.tier = 0; this.built = false; }
  init() {
    const scene = this.game.engine.scene;
    this.den = buildDen(); this.den.position.y = Y0; this.den.name = 'home-den';
    this.great = buildGreatWing(); this.great.position.y = Y0;
    const lh = buildLakehouse(); this.lake = lh.group;
    const root = this.root = new THREE.Group(); root.name = 'home-plot';
    root.add(this.den, this.great, this.lake);
    scene.add(root);
    // colliders and walkways: there always, counted only while that piece is up
    const off = (n) => () => this.tier < n;
    const D = DEN_WING, G = GREAT_WING, C = CHIMNEY;
    addBox(D.x0 - 0.05, D.z0 - 0.05, D.x1 + 0.05, D.z1 + 0.05, { skip: off(1) });
    addBox(G.x0 - 0.05, G.z0, G.x1 + 0.05, G.z1 + 0.05, { skip: off(2) });
    addBox(C.x0, C.z0 - 0.05, C.x1 + 0.05, C.z1 + 0.05, { skip: off(2) });
    addBox(LH.x0 - 0.1, LH.z0 - 0.1, LH.x1 + 0.04, LH.z1 + 0.1, { skip: off(3) });
    for (const [ax, az, bx, bz] of lh.rail) {
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3));
      for (let i = 0; i <= n; i++) addCircle(ax + (bx - ax) * i / n, az + (bz - az) * i / n, 0.1, { skip: off(3) });
    }
    const P = LH.porch, Dk = LH.dock, S = LH.stairs, on = () => this.tier >= 3;
    addWalkway({ cx: (P.x0 + P.x1) / 2, cz: (P.z0 + P.z1) / 2, ux: 1, uz: 0, half: (P.x1 - P.x0) / 2, w: P.z1 - P.z0, y: FLOOR, active: on });
    addWalkway({ cx: (Dk.x0 + Dk.step) / 2, cz: (Dk.z0 + Dk.z1) / 2, ux: 1, uz: 0, half: (Dk.step - Dk.x0) / 2, w: Dk.z1 - Dk.z0, y: (FLOOR + DECK) / 2 + 0.02, active: on });
    addWalkway({ cx: (Dk.step + Dk.x1) / 2, cz: (Dk.z0 + Dk.z1) / 2, ux: 1, uz: 0, half: (Dk.x1 - Dk.step) / 2, w: Dk.z1 - Dk.z0, y: DECK, active: on });
    for (const st of lh.steps) addWalkway({ cx: (S.x0 + S.x1) / 2, cz: (st.z0 + st.z1) / 2, ux: 0, uz: 1, half: (st.z1 - st.z0) / 2, w: S.x1 - S.x0, y: st.y, active: on });
    for (const x of lh.piles) for (const z of [Dk.z0 - 0.02, Dk.z1 + 0.02]) addCircle(x, z, 0.14, { top: pileTop(x), skip: off(3) }); // (step over them on the planks, like a jetty's)
    addCircle(LH.lantern.x, LH.lantern.z, 0.12, { skip: off(3) }); // the lantern post
    for (let z = Dk.z0 + 0.1; z <= Dk.z1 - 0.1; z += 0.35) addCircle(Dk.x1 - 0.12, z, 0.14, { top: DECK + 0.42, skip: off(3) }); // the end rail (hop it if you must)
    addBox(P.x0 + 0.1, P.z0 + 0.15, P.x0 + 0.6, P.z0 + 1.75, { skip: off(3) }); // the deck's bench
    this.built = true;
    this.refresh();
    this.game.ext.on('change', () => { if (homeTier(this.game.ext.d.home) !== this.tier) this.refresh(); });
  }
  /** Show the pieces the player's home has (called when it's bought, and on any save change that moves the tier). */
  refresh() {
    if (!this.built) return;
    this.tier = homeTier(this.game.ext.d.home);
    this.den.visible = this.tier >= 1;
    this.great.visible = this.tier >= 2;
    this.lake.visible = this.tier >= 3;
  }
  /** The Lakehouse's door, when you're on its deck (for the "Go inside" button). */
  nearLakeDoor(p) { return this.tier >= 3 && p.mode === 'shore' && p.pos.y > FLOOR - 0.3 && Math.hypot(p.pos.x - LH.door.x, p.pos.z - LH.door.z) < 1.6; }
}
