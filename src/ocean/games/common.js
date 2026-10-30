// Open Waters stage 4: the beach games' shared maths. Pure functions (no Three.js, no DOM), so tests/beach.test.mjs
// can check them, and every client in a round computes the same answer from the same seed.
import { mulberry32 } from '../../core/rng.js';

export const GRAV = 9.81;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** A stable number from a string (round ids, player ids). */
export function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/** A seeded generator for one part of a round: rngFor(seed, 'crabs', 2) is the same on every client. */
export const rngFor = (seed, ...keys) => mulberry32((seed ^ hashStr(keys.join('|'))) >>> 0);

// ---------------------------------------------------------------- flight
/** A thrown thing: o + v t + ½ a t², a = wind (x, z) and gravity. */
export function flyAt(o, v, wind, t) {
  const wx = wind?.x || 0, wz = wind?.z || 0;
  return { x: o.x + v.x * t + 0.5 * wx * t * t, y: o.y + v.y * t - 0.5 * GRAV * t * t, z: o.z + v.z * t + 0.5 * wz * t * t };
}
/** When a throw comes back down to height y (the later root), or null if it never gets there. */
export function landTime(o, v, y) {
  const a = -0.5 * GRAV, b = v.y, c = o.y - y, disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  return (-b - Math.sqrt(disc)) / (2 * a);
}
/** A volleyball arc: from a to b (each {x, y, z}) in T seconds, rising H above the straight line. */
export function arcAt(arc, now) {
  const s = clamp((now - arc.t0) / (arc.T * 1000), 0, 1.4);
  return { x: lerp(arc.a.x, arc.b.x, s), y: lerp(arc.a.y, arc.b.y, s) + 4 * arc.H * s * (1 - s), z: lerp(arc.a.z, arc.b.z, s), s };
}

// ---------------------------------------------------------------- results and prizes
/** Sort scores high to low; equal scores share a place. In: [{ id, s }]. Out: the same rows with place (1-based). */
export function rank(rows) {
  const out = [...rows].sort((a, b) => b.s - a.s);
  let place = 0, last = null;
  out.forEach((r, i) => { if (r.s !== last) { place = i + 1; last = r.s; } r.place = place; });
  return out;
}
/** Coins and XP for a place in a round of n players (everyone who plays gets something). */
export function prizeFor(place, n) {
  const table = [{ coins: 300, xp: 260 }, { coins: 160, xp: 170 }, { coins: 90, xp: 110 }, { coins: 60, xp: 80 }];
  const p = table[clamp(place, 1, 4) - 1];
  const k = n <= 1 ? 0.5 : 1; // (a round alone with nobody to beat pays half)
  return { coins: Math.round(p.coins * k), xp: Math.round(p.xp * k) };
}

// ---------------------------------------------------------------- crab races
export const CRAB_TRACK = 10; // metres from the start line to the finish
/** How far crab i has run t seconds after the gun (before cheers), the same on every client. rain: crabs love it. */
export function crabRun(seed, i, t, rain = false) {
  if (t <= 0) return 0;
  const r = rngFor(seed, 'crab', i);
  const base = 0.42 + r() * 0.08, k = rain ? 1.15 : 1;
  // bursts and stops: a few sine terms with seeded phases (always moving forward)
  const p1 = r() * 6.28, p2 = r() * 6.28, f1 = 0.7 + r() * 0.5, f2 = 1.6 + r() * 0.8;
  const wob = (Math.sin(t * f1 + p1) - Math.sin(p1)) / f1 * 0.16 + (Math.sin(t * f2 + p2) - Math.sin(p2)) / f2 * 0.08;
  return Math.max(0, (base * t + wob) * k);
}
/** A cheer's push: on the beat is worth the most. off: seconds from the nearest beat. */
export function cheerPush(off) { const a = Math.abs(off); return a < 0.09 ? 0.2 : a < 0.18 ? 0.11 : 0.03; }
export const CHEER_BEAT = 0.6; // a beat every 0.6 s
/** An islander's cheering, the same everywhere: metres of push after t seconds. */
export function aiCheer(seed, i, t) { if (t <= 0) return 0; const r = rngFor(seed, 'aicheer', i); return t * (0.11 + r() * 0.12); }

// ---------------------------------------------------------------- coconut toss
export const BUCKETS = [{ d: 4, pts: 1, r: 0.36 }, { d: 7, pts: 2, r: 0.4 }, { d: 10, pts: 3, r: 0.46 }];
/** Where buckets sit, along the throwing direction u from the line's centre o, with a seeded sideways nudge. */
export function bucketSpots(seed, o, u) {
  const r = rngFor(seed, 'buckets'), sx = -u.z, sz = u.x;
  return BUCKETS.map((b) => { const off = (r() - 0.5) * 2.2; return { ...b, x: o.x + u.x * b.d + sx * off, z: o.z + u.z * b.d + sz * off }; });
}
/** A throw's speed from the power meter (0..1): 4 to 12 m/s at 45 degrees. */
export const throwSpeed = (power) => 4 + clamp(power, 0, 1) * 8;
/** Throw a coconut: { o, v, land: {x, y, z, t}, hit: bucket or null }. yaw: 0 = +z. y0: the sand under the line. */
export function coconutThrow(from, yaw, power, wind, y0, buckets) {
  const sp = throwSpeed(power), c = Math.SQRT1_2;
  const o = { x: from.x, y: y0 + 1.6, z: from.z };
  const v = { x: Math.sin(yaw) * sp * c, y: sp * c, z: Math.cos(yaw) * sp * c };
  const rim = y0 + 0.44;
  const t = landTime(o, v, rim) ?? 0;
  const p = flyAt(o, v, wind, t);
  const hit = buckets.find((b) => Math.hypot(p.x - b.x, p.z - b.z) < b.r) || null;
  const t2 = hit ? t : (landTime(o, v, y0 + 0.08) ?? t);
  return { o, v, wind: { x: wind?.x || 0, z: wind?.z || 0 }, land: { ...flyAt(o, v, wind, t2), t: t2 }, hit };
}
/** An islander's five throws, the same everywhere: an array of points per throw. */
export function aiThrows(seed, i, n = 5) {
  const r = rngFor(seed, 'aithrow', i), skill = 0.35 + r() * 0.35;
  return Array.from({ length: n }, () => { const x = r(); return x < skill * 0.45 ? 3 : x < skill * 0.9 ? 2 : x < skill + 0.25 ? 1 : 0; });
}

// ---------------------------------------------------------------- sandcastles
// A plot is 3 x 3 cells; a cell is a stack of piece codes (bottom first). k: keep, t: tower, w: wall, m: moat,
// f: flag, s: shells. Moats only on bare sand; flags and shells only on top; stacks up to maxH (4 in wet sand).
export const PIECES = [
  { c: 'k', id: 'bg_keep', name: 'Mound', h: 0.4 },
  { c: 't', id: 'bg_tower', name: 'Tower', h: 0.55 },
  { c: 'w', id: 'bg_wall', name: 'Wall', h: 0.38 },
  { c: 'm', id: 'bg_moat', name: 'Moat', h: 0 },
  { c: 'f', id: 'bg_flag', name: 'Flag', h: 0 },
  { c: 's', id: 'bg_shells', name: 'Shells', h: 0 },
];
export const PIECE_BY_C = Object.fromEntries(PIECES.map((p) => [p.c, p]));
/** May piece c go on this stack? Returns null if so, or the reason not. */
export function canPlace(stack, c, maxH = 3) {
  const top = stack[stack.length - 1];
  if (!PIECE_BY_C[c]) return 'Unknown piece';
  if (top === 'f' || top === 's') return 'That one\'s finished: nothing goes on a flag or shells.';
  if (top === 'm') return 'You can\'t build on a moat.';
  if (c === 'm' && stack.length) return 'Dig moats in bare sand.';
  const solid = stack.filter((x) => x === 'k' || x === 't' || x === 'w').length;
  if ((c === 'k' || c === 't' || c === 'w') && solid >= maxH) return maxH > 3 ? 'That\'s as tall as it goes.' : 'Dry sand won\'t stack any higher.';
  return null;
}
/** A castle's look, as a judge sees it: height, variety, symmetry, finishing touches. */
export function castleScore(cells) {
  const flat = cells.flat(), kinds = new Set(flat);
  const solid = (s) => s.filter((x) => x === 'k' || x === 't' || x === 'w').length;
  const heights = cells.map(solid);
  const tallest = Math.max(0, ...heights), built = heights.filter((x) => x > 0).length;
  let sym = 0; // mirror left to right (cells 0..8 in rows of three)
  for (const [a, b] of [[0, 2], [3, 5], [6, 8]]) if (cells[a].join() === cells[b].join() && cells[a].length) sym++;
  const flags = flat.filter((x) => x === 'f').length, moats = flat.filter((x) => x === 'm').length, shells = flat.filter((x) => x === 's').length;
  return Math.round(tallest * 6 + built * 2.5 + kinds.size * 3 + sym * 4 + Math.min(3, flags) * 2 + Math.min(2, moats) * 2 + Math.min(2, shells) * 1.5);
}
/** An islander's castle after `t` seconds of a build of length T: grows piece by piece, the same everywhere. */
export function aiCastle(seed, i, t, T, maxH = 3) {
  const r = rngFor(seed, 'castle', i);
  const plan = [];
  const style = Math.floor(r() * 3);
  const centre = style === 0 ? ['k', 't', 't', 'f'] : style === 1 ? ['k', 'k', 't', 'f'] : ['t', 't', 'f'];
  for (const c of centre) plan.push([4, c]);
  const ring = style === 2 ? [1, 3, 5, 7] : [0, 2, 6, 8];
  for (const k of ring) plan.push([k, 'w']);
  if (r() < 0.7) for (const k of ring) plan.push([k, style === 1 ? 't' : 'w']);
  for (const k of [1, 7]) if (r() < 0.6) plan.push([k, 'm']);
  if (r() < 0.6) plan.push([ring[0], 's']), plan.push([ring[3], 's']);
  const cells = Array.from({ length: 9 }, () => []);
  const n = Math.floor(plan.length * clamp(t / (T * 0.9), 0, 1) * (0.75 + r() * 0.25));
  for (const [k, c] of plan.slice(0, n)) if (!canPlace(cells[k], c, maxH)) cells[k].push(c);
  return cells;
}
/** Pack and unpack a castle for the network ("kt,w,,..."). */
export const packCastle = (cells) => cells.map((s) => s.join('')).join(',');
export const unpackCastle = (str) => { const a = String(str || '').split(',').slice(0, 9).map((s) => [...s.slice(0, 5)].filter((c) => PIECE_BY_C[c])); while (a.length < 9) a.push([]); return a; };

// ---------------------------------------------------------------- cannonball
/** Judge a cannonball. apex: metres above the water at the top; tuck: seconds after the apex you tucked (null: never);
 *  fall: seconds from apex to the water. Returns { splash 0..10, cards: [three judges' 1..10] }. */
export function cannonScore(apex, tuck, fall, seed = 0, n = 0) {
  let k;
  if (tuck == null) k = 0.25; // a pencil dive: tidy, tiny splash
  else if (tuck < -0.15) k = 0.55; // tucked on the way up: you lost height
  else { const late = tuck / Math.max(0.2, fall); k = late < 0.45 ? 1 : late < 0.75 ? 0.8 : late < 0.95 ? 0.55 : 0.3; }
  const splash = clamp((apex / 5.5) * 7.5 * k + k * 2.5, 0, 10);
  const r = rngFor(seed, 'judge', n);
  const cards = [0, 1, 2].map(() => clamp(Math.round(splash + (r() - 0.5) * 2), 1, 10));
  return { splash: Math.round(splash * 10) / 10, cards, total: cards.reduce((a, b) => a + b, 0) };
}
/** An islander's best jump: a total out of 30, the same everywhere. */
export function aiCannon(seed, i, n) {
  const r = rngFor(seed, 'aicannon', i, n);
  const apex = 4.6 + r() * 1.6, tuck = r() < 0.15 ? null : (r() - 0.2) * 0.6;
  return cannonScore(apex, tuck, 1, seed, 100 + i * 10 + n);
}
