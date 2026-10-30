// Set dressing that gives each outer fishing spot its own personality (v1.8):
//   Frostpine Lake: alpine. Ice floes, snow-capped boulders, a trapper's hut, fish drying racks, a canoe, a cairn.
//   Lilymarsh: a boggy wetland. Weeping willows with hanging moss, a stilted boardwalk, cattails, lily pads.
//   Fern Pond: a quiet garden pond. Giant ferns, mossy stepping stones, a gazebo, flower beds.
//   Old Quarry: industrial ruin. A rusty crane, stacks of cut stone, a mine cart on rails.
//   The waterways: mooring posts and reeds along the banks.
// Everything is built with the soft-block kit and merged per lake. Solid things get colliders.
import * as THREE from 'three';
import { Kit, noisy, planksAlong, planksAcross, bark, stone } from './softprops.js';
import { tone, hash } from '../render/soft.js';
import { LAKES, RIVERS, CLEARINGS, heightAt, surfaceY, WATER_Y, trailDist, onDock, deckHit, mainland, addWalkway, gentleAt } from './terrain.js';
import { addCircle, addBox, blocked } from './colliders.js';
import { mulberry32 } from '../core/rng.js';
import { splitByTiles } from '../render/cull.js';
import { buildFerns } from './ferns.js';
import { camperAt } from './campers.js';
import { leviathanAt } from './frostbones.js';

// A point on a lake's shore at angle a: walk out from the centre to the first dry block, then `inland` more.
function shore(L, a, inland = 0) {
  const ux = Math.cos(a), uz = Math.sin(a);
  for (let d = 0; d < Math.max(L.rx, L.rz) * 1.8; d += 0.5) {
    const x = L.cx + ux * d, z = L.cz + uz * d;
    if (heightAt(x, z) > 0) return { x: x + ux * inland, z: z + uz * inland, a, ux, uz };
  }
  return null;
}
// the first MAINLAND shore along a ray from the lake's middle (skips islands), as shore() returns it
function mainShore(L, a) {
  const ux = Math.cos(a), uz = Math.sin(a);
  let wasLand = false;
  for (let d = 0; d < Math.max(L.rx, L.rz) * 1.8; d += 0.5) {
    const x = L.cx + ux * d, z = L.cz + uz * d, land = heightAt(x, z) > 0;
    if (land && !wasLand && mainland(x, z)) return { x, z, a, ux, uz };
    wasLand = land;
  }
  return null;
}
// ... and a point out on the water, `out` blocks from the shore
function onWater(L, a, out) {
  const s = shore(L, a, 0);
  if (!s) return null;
  const x = s.x - s.ux * out, z = s.z - s.uz * out;
  return heightAt(x, z) <= 0 ? { x, z } : null;
}
const dryOk = (x, z, pad = 1) => !leviathanAt(x, z, pad + 1) && heightAt(x, z) > 0 && heightAt(x, z) <= 6 && gentleAt(x, z, 0.6) && !blocked(x, z, pad) && trailDist(x, z) > 2.2 && !onDock(x, z);
const y0 = (x, z) => surfaceY(x, z);

/** Each lake's flag cairn: where its pennant hangs (set while dressing). v1.9.3 Frostpine, v1.9.4 every lake. */
export const CAIRNS = {};
/** A stack of stones with a pole, at (x, z); the flag itself is the lake's record holder's (src/game/lakeflag.js). */
function cairnAt(k, lake, x, z) {
  const y = y0(x, z);
  [[1.1, 0.4], [0.85, 0.35], [0.6, 0.3], [0.4, 0.25]].reduce((h, [s, t]) => { k.box(s, t, s * 0.9, t * 0.4, { all: noisy('#9a9a96', 0.1, 7) }, x, y + h + t / 2, z, 0, h * 3); return h + t; }, 0);
  k.box(0.05, 2.2, 0.05, 0.02, { all: bark('#5a3e24') }, x, y + 2.3, z); // v1.9.4: taller, so the flag hangs below the finial (lakeflag.js)
  addCircle(x, z, 0.7);
  CAIRNS[lake] = { x, y: y + 2.95, z, top: y + 3.4 };
}
// a cairn a few blocks up the bank, at the first angle (of a few) with level, open ground
function cairnOnShore(k, lake, L, angles, inland = 6) {
  // (off the trails, clear of docks and jetties; chairs.js keeps its chairs away from the cairns in turn)
  for (const inl of [inland, inland + 2, inland + 4]) {
    for (const a of [...angles, ...Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2)]) {
      const c = shore(L, a, inl);
      if (c && dryOk(c.x, c.z, 1.5) && trailDist(c.x, c.z) > 4 && !deckHit(c.x, c.z, 4)) { cairnAt(k, lake, c.x, c.z); return; }
    }
  }
}
function cairns(k) {
  cairnOnShore(k, 'marsh', LAKES.marsh, [Math.PI * 1.35, Math.PI * 1.1, Math.PI * 0.9, Math.PI * 1.6, Math.PI * 0.6]);
  cairnOnShore(k, 'pond', LAKES.pond, [Math.PI * 1.25, Math.PI * 1.05, Math.PI * 0.85, Math.PI * 1.5]);
  cairnOnShore(k, 'quarry', LAKES.quarry, [Math.PI * 0.62, Math.PI * 0.8, Math.PI * 0.45, Math.PI * 1.0], 4);
  cairnOnShore(k, 'cove', { cx: 0, cz: -2, rx: 40, rz: 40 }, [Math.PI * 0.62, Math.PI * 0.7, Math.PI * 0.78, Math.PI * 0.55, Math.PI * 0.86], 5);
}

// ---------------------------------------------------------------- Frostpine Lake
function frostpine(k, r) {
  const L = LAKES.frost;
  const iceTop = (f) => f.fill((x, y) => (hash(x, y, 91) > 0.9 ? '#ffffff' : hash(x >> 1, y >> 1, 92) > 0.7 ? '#dff0fa' : '#cfe6f2'));
  // ice floes drifting near the shore
  for (let i = 0; i < 26; i++) {
    const p = onWater(L, r() * Math.PI * 2, 2 + r() * 9);
    if (!p) continue;
    const w = 1 + r() * 2.2, d = 0.8 + r() * 1.6;
    k.box(w, 0.18, d, 0.08, { top: iceTop, all: (f) => f.fill('#b8d8e8') }, p.x, WATER_Y + 0.04, p.z, 0, r() * 3, 0);
  }
  // snow-capped boulders on the beach
  for (let i = 0; i < 18; i++) {
    const s = shore(L, r() * Math.PI * 2, 1.5 + r() * 5);
    if (!s || !dryOk(s.x, s.z, 1.2)) continue;
    if (Math.hypot(s.x - CLEARINGS.seabase.x, s.z - CLEARINGS.seabase.z) < CLEARINGS.seabase.r + 8) continue; // (v1.17.1: none in the seaplane base's yard or on its dock path)
    const sz = 0.8 + r() * 1.2, y = y0(s.x, s.z);
    k.box(sz * 1.3, sz, sz, sz * 0.3, { all: noisy('#8a8f96', 0.08, 5), top: (f) => f.fill((x, yy) => (hash(x, yy, 93) > 0.85 ? '#e8f2f8' : '#ffffff')) }, s.x, y + sz * 0.35, s.z, 0, r() * 3, 0);
    addCircle(s.x, s.z, sz * 0.62, { top: y + sz * 0.85 });
  }
  // the trapper's hut, a drying rack of fish, an upturned canoe, a stone cairn with a flag
  const hut = shore(L, -2.2, 7);
  if (hut && dryOk(hut.x, hut.z, 2.5)) {
    const y = y0(hut.x, hut.z), ry = Math.atan2(-hut.ux, -hut.uz);
    const logs = (c) => (f) => f.fill((x, yy) => (yy % 6 === 5 ? tone(c, -0.3) : yy % 6 === 0 ? tone(c, 0.12) : c));
    k.box(4, 2.2, 3.4, 0.15, { all: logs('#7a5232') }, hut.x, y + 1.1, hut.z, 0, ry);
    k.box(4.8, 0.35, 4.2, 0.12, { all: (f) => f.fill((x, yy) => (hash(x, yy, 94) > 0.8 ? '#e8f0f6' : '#ffffff')) }, hut.x, y + 2.45, hut.z, 0, ry);
    k.box(0.5, 1.2, 0.5, 0.1, { all: stone('#7a7470') }, hut.x + 1.2, y + 3, hut.z, 0, ry);
    addCircle(hut.x, hut.z, 2.3);
    // rack: two posts and a pole hung with fish
    const rx = hut.x + hut.uz * 4, rz = hut.z - hut.ux * 4, ry2 = y0(rx, rz);
    if (dryOk(rx, rz, 1)) {
      for (const s of [-1, 1]) k.box(0.14, 1.6, 0.14, 0.05, { all: bark('#5a3e24') }, rx + hut.ux * s * 1.2, ry2 + 0.8, rz + hut.uz * s * 1.2);
      k.box(0.08, 0.08, 2.6, 0.03, { all: bark('#6a4a2a') }, rx, ry2 + 1.55, rz, 0, Math.atan2(hut.ux, hut.uz));
      for (let f = -2; f <= 2; f++) k.box(0.08, 0.5, 0.2, 0.06, { all: (ff) => ff.fill((x, yy) => (yy < 2 ? '#c8a070' : '#a0806a')) }, rx + hut.ux * f * 0.45, ry2 + 1.22, rz + hut.uz * f * 0.45);
      addCircle(rx, rz, 0.8);
    }
  }
  const canoe = shore(L, -1.6, 2.5);
  if (canoe && dryOk(canoe.x, canoe.z, 1.5)) {
    const y = y0(canoe.x, canoe.z);
    k.box(0.9, 0.45, 3.6, 0.3, { all: (f) => f.fill((x, yy) => (yy < 2 ? '#e8e0d0' : '#c84a32')) }, canoe.x, y + 0.22, canoe.z, 0, canoe.a);
    addCircle(canoe.x, canoe.z, 1.1);
  }
  const cairn = shore(L, -0.9, 6);
  if (cairn && dryOk(cairn.x, cairn.z, 1)) cairnAt(k, 'frost', cairn.x, cairn.z);
}

// ---------------------------------------------------------------- Lilymarsh
function lilymarsh(k, r, extraPads) {
  const L = LAKES.marsh;
  // weeping willows with hanging moss along the banks
  const willow = k.template((t) => {
    t.box(0.55, 2.4, 0.55, 0.15, { all: bark('#5a4a32') }, 0, 1.2, 0);
    t.box(3.2, 1.2, 3.2, 0.5, { all: noisy('#6a9a48', 0.1, 11) }, 0, 2.8, 0);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, d = 1.25 + (i % 3) * 0.12;
      t.box(0.22, 1.6 + (i % 4) * 0.3, 0.22, 0.08, { all: (f) => f.fill((x, y) => (hash(x, y, 12) > 0.6 ? '#8ab060' : '#7aa050')) }, Math.cos(a) * d, 1.9 - (i % 4) * 0.15, Math.sin(a) * d);
    }
    for (let i = 0; i < 6; i++) t.box(0.08, 1.1, 0.08, 0.03, { all: (f) => f.fill('#9aa88a') }, Math.cos(i) * 0.9, 1.9, Math.sin(i) * 0.9); // moss strands
  });
  for (let i = 0; i < 16; i++) {
    const s = shore(L, r() * Math.PI * 2, 1.5 + r() * 4);
    if (!s || !dryOk(s.x, s.z, 1.6)) continue;
    k.stamp(willow, s.x, y0(s.x, s.z), s.z, r() * 3, 0.85 + r() * 0.35);
    addCircle(s.x, s.z, 0.5);
  }
  willow.dispose();
  // a stilted boardwalk out over the shallows (decor: you look along it from the shore)
  // v1.8.1: it starts on the mainland (never on an island) and you can walk it and tie up your boat at it
  let bw = null;
  for (let i = 0; i < 40 && !bw; i++) {
    const a = Math.PI * 0.85 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.06;
    const c = mainShore(L, a);
    // open water for the whole boardwalk and a boat's length beyond (no islands in the way)
    if (c && Array.from({ length: 18 }, (_, t) => t + 1).every((t) => heightAt(c.x - c.ux * t, c.z - c.uz * t) <= 0)) bw = c;
  }
  if (bw) {
    const ry = Math.atan2(-bw.ux, -bw.uz), N = 13, step = 1.1, deckY = WATER_Y + 0.6;
    const sx = bw.x + bw.ux * 2.2, sz = bw.z + bw.uz * 2.2; // starts a couple of steps up the bank
    for (let i = 0; i < N; i++) {
      const x = sx - bw.ux * i * step, z = sz - bw.uz * i * step;
      const g = surfaceY(x, z), y = Math.max(deckY, g + 0.06);
      k.box(1.6, 0.12, 1.05, 0.03, { top: planksAcross('#9a7a50', 5, 8), all: planksAlong('#7a5a3a', 4, 3) }, x, y - 0.06, z, 0, ry);
      if (i % 2 === 0) for (const s of [-1, 1]) {
        const px = x + bw.uz * s * 0.7, pz = z - bw.ux * s * 0.7, foot = Math.min(surfaceY(px, pz), WATER_Y) - 0.6;
        k.box(0.14, y - foot, 0.14, 0.05, { all: bark('#4a3a24') }, px, (y + foot) / 2, pz);
        if (surfaceY(px, pz) < WATER_Y) addCircle(px, pz, 0.12, { water: true }); // boats tie up beside it, not through it
      }
    }
    const len = (N - 1) * step;
    addWalkway({ cx: sx - bw.ux * len / 2, cz: sz - bw.uz * len / 2, ux: -bw.ux, uz: -bw.uz, half: len / 2 + 0.55, w: 1.6, y: deckY });
    // a lantern at the end so you can find it at night
    const ex = sx - bw.ux * len, ez = sz - bw.uz * len;
    k.box(0.12, 1.2, 0.12, 0.04, { all: bark('#4a3a24') }, ex + bw.uz * 0.7, deckY + 0.6, ez - bw.ux * 0.7);
    k.box(0.26, 0.3, 0.26, 0.08, { all: (f) => f.fill((x, y) => (x === 0 || y === 0 || x === f.w - 1 || y === f.h - 1 ? '#3a2a1a' : '#ffd88a')) }, ex + bw.uz * 0.7, deckY + 1.3, ez - bw.ux * 0.7);
  }
  // cattails at the water's edge
  for (let i = 0; i < 70; i++) {
    const s = shore(L, r() * Math.PI * 2, -0.5 + r() * 1.2);
    if (!s) continue;
    const by = Math.max(surfaceY(s.x, s.z), WATER_Y - 0.4);
    for (let j = 0; j < 3; j++) {
      const ox = (r() - 0.5) * 0.7, oz = (r() - 0.5) * 0.7, h = 0.9 + r() * 0.6;
      k.box(0.05, h, 0.05, 0.02, { all: (f) => f.fill('#6a9a3a') }, s.x + ox, by + h / 2, s.z + oz, 0, 0, (r() - 0.5) * 0.2, { seg: 1 });
      k.box(0.09, 0.26, 0.09, 0.04, { all: (f) => f.fill((x, y) => (y % 3 === 0 ? '#5a3418' : '#6a4020')) }, s.x + ox, by + h - 0.1, s.z + oz, 0, 0, 0, { seg: 1 });
    }
  }
  for (let i = 0; i < 90; i++) { const p = onWater(L, r() * Math.PI * 2, 1 + r() * 10); if (p) extraPads.push({ x: p.x - 0.5, z: p.z - 0.5, r: Math.floor(r() * 1e6) }); }
}

const FERN_SPOTS = [];
// ---------------------------------------------------------------- Fern Pond
function fernpond(k, r) {
  const L = LAKES.pond;
  // v1.9.4: real ferns (src/world/ferns.js), kept off the campground, the trailer park and anything solid
  for (let i = 0; i < 90; i++) {
    const s = shore(L, r() * Math.PI * 2, 1 + r() * 9);
    if (!s || !dryOk(s.x, s.z, 0.6)) continue;
    const ry = r() * 6, sc = 0.8 + r() * 0.8; // (drawn as before, so the rest of the pond's dressing stays put)
    if (camperAt(s.x, s.z, 1.2) || blocked(s.x, s.z, 0.9)) continue;
    FERN_SPOTS.push({ x: s.x, y: y0(s.x, s.z) - 0.02, z: s.z, ry, s: sc });
  }
  // mossy stepping stones out into the pond
  const st = shore(L, Math.PI * 1.65, 0);
  if (st) for (let i = 1; i < 7; i++) {
    const x = st.x - st.ux * i * 1.4 + (r() - 0.5) * 0.5, z = st.z - st.uz * i * 1.4 + (r() - 0.5) * 0.5;
    k.box(0.9, 0.5, 0.8, 0.2, { all: noisy('#7a7e78', 0.1, 21), top: (f) => f.fill((x2, y2) => (hash(x2, y2, 22) > 0.55 ? '#6a9a48' : '#7a8e70')) }, x, WATER_Y - 0.08, z, 0, r() * 3, 0);
  }
  // a little gazebo by the water
  const gz = shore(L, Math.PI * 0.25, 5);
  if (gz && dryOk(gz.x, gz.z, 2.6)) {
    const y = y0(gz.x, gz.z);
    k.box(3.6, 0.2, 3.6, 0.06, { top: planksAcross('#c8a070', 5, 9), all: planksAlong('#a07a50', 4, 4) }, gz.x, y + 0.1, gz.z);
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { k.box(0.18, 2.2, 0.18, 0.06, { all: (f) => f.fill('#f0ece0') }, gz.x + dx, y + 1.2, gz.z + dz); addCircle(gz.x + dx, gz.z + dz, 0.15); }
    k.box(4.2, 0.3, 4.2, 0.12, { all: (f) => f.fill((x, yy) => (x % 4 === 0 ? '#7a4a5a' : '#9a5a6a')) }, gz.x, y + 2.4, gz.z);
    k.box(2.6, 0.6, 2.6, 0.3, { all: (f) => f.fill('#9a5a6a') }, gz.x, y + 2.85, gz.z, 0, Math.PI / 4, 0);
  }
  // flower beds
  for (let i = 0; i < 40; i++) {
    const s = shore(L, r() * Math.PI * 2, 2 + r() * 8);
    if (!s || !dryOk(s.x, s.z, 0.4)) continue;
    const c = ['#f0d040', '#f07090', '#a080e0', '#ffffff', '#f09040'][i % 5], y = y0(s.x, s.z);
    for (let j = 0; j < 4; j++) k.box(0.13, 0.06, 0.13, 0.03, { all: (f) => f.fill(c) }, s.x + (r() - 0.5) * 0.8, y + 0.22, s.z + (r() - 0.5) * 0.8, 0, r() * 3, 0, { seg: 1 });
  }
}

// ---------------------------------------------------------------- Old Quarry
function quarry(k, r) {
  const L = LAKES.quarry;
  const rust = (f) => f.fill((x, y) => (hash(x, y, 31) > 0.8 ? '#8a3a1a' : hash(x >> 1, y >> 1, 32) > 0.6 ? '#a85a2a' : '#9a4a22'));
  // the old crane on the rim, its boom reaching out over the water
  const c = shore(L, -0.6, 3);
  if (c) {
    const y = y0(c.x, c.z), ry = Math.atan2(-c.ux, -c.uz);
    k.box(1.6, 0.5, 1.6, 0.08, { all: stone('#8a8478') }, c.x, y + 0.25, c.z);
    k.box(0.5, 7, 0.5, 0.06, { all: rust }, c.x, y + 3.9, c.z);
    for (let i = 0; i < 7; i++) k.box(0.62, 0.08, 0.08, 0.02, { all: rust }, c.x, y + 1 + i, c.z, 0, ry + (i % 2) * 0.6, 0.6);
    // v1.9: a level boom from just behind the post out over the water, the hook line hanging from its tip
    k.box(0.35, 0.35, 8, 0.05, { all: rust }, c.x - c.ux * 2.5, y + 7.2, c.z - c.uz * 2.5, 0, ry);
    const hx = c.x - c.ux * 6.1, hz = c.z - c.uz * 6.1;
    k.box(0.05, 2.85, 0.05, 0.01, { all: (f) => f.fill('#3a3a3a') }, hx, y + 7.02 - 1.42, hz);
    k.box(0.5, 0.4, 0.2, 0.08, { all: rust }, hx, y + 4.0, hz, 0, ry);
    addCircle(c.x, c.z, 1);
  }
  // stacks of cut stone blocks
  for (let i = 0; i < 14; i++) {
    const s = shore(L, r() * Math.PI * 2, 2 + r() * 8);
    if (!s || !dryOk(s.x, s.z, 1.4)) continue;
    const y = y0(s.x, s.z), ry = r() * 3, n = 1 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) k.box(1.4, 0.7, 0.9, 0.06, { all: noisy('#b8b0a0', 0.07, 33 + j) }, s.x + (r() - 0.5) * 0.3, y + 0.35 + j * 0.7, s.z + (r() - 0.5) * 0.3, 0, ry + j * 0.3);
    addCircle(s.x, s.z, 0.9);
  }
  // a mine cart on a short run of rails
  const m = shore(L, 1.2, 5);
  if (m && dryOk(m.x, m.z, 1.2)) {
    const y = y0(m.x, m.z), ry = Math.atan2(m.uz, -m.ux);
    for (let i = -3; i <= 3; i++) k.box(1.2, 0.08, 0.2, 0.02, { all: bark('#5a3e24') }, m.x + Math.cos(ry) * i * 0.6, y + 0.05, m.z - Math.sin(ry) * i * 0.6, 0, ry + Math.PI / 2);
    for (const s of [-0.4, 0.4]) k.box(0.06, 0.08, 4.4, 0.02, { all: (f) => f.fill('#6a6a70') }, m.x - Math.sin(ry) * s, y + 0.12, m.z - Math.cos(ry) * s, 0, ry + Math.PI / 2);
    k.box(1.1, 0.7, 0.85, 0.08, { all: rust, top: (f) => f.fill((x, yy) => (hash(x, yy, 35) > 0.4 ? '#4a4a48' : '#5a5a56')) }, m.x, y + 0.6, m.z, 0, ry);
    addCircle(m.x, m.z, 0.8);
  }
}

// ---------------------------------------------------------------- the waterways
function waterways(k, r) {
  const post = (x, z) => { k.box(0.22, 1.5, 0.22, 0.08, { all: bark('#5a3e24') }, x, WATER_Y + 0.2, z); k.box(0.3, 0.12, 0.3, 0.05, { all: (f) => f.fill('#4a3a2a') }, x, WATER_Y + 0.98, z); };
  for (const R of Object.values(RIVERS)) {
    if (R === RIVERS.cavespur) continue;
    for (let i = 1; i < R.pts.length - 1; i++) {
      const [ax, az] = R.pts[i], [bx, bz] = R.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      if (r() < 0.6) { // a mooring post just off the bank
        const side = r() < 0.5 ? -1 : 1;
        for (let d = R.w - 0.6; d > 0; d -= 0.3) { const x = ax + ux * len * 0.5 - uz * side * d, z = az + uz * len * 0.5 + ux * side * d; if (heightAt(x, z) <= 0) { post(x, z); break; } }
      }
      for (let j = 0; j < 6; j++) { // reeds on the banks
        const t = r(), side = r() < 0.5 ? -1 : 1, x = ax + ux * len * t - uz * side * (R.w + 0.6), z = az + uz * len * t + ux * side * (R.w + 0.6);
        if (heightAt(x, z) <= 0 || heightAt(x, z) > 3) continue;
        const by = surfaceY(x, z);
        for (let q = 0; q < 3; q++) k.box(0.05, 0.8 + r() * 0.4, 0.05, 0.02, { all: (f) => f.fill('#6a9a3a') }, x + (r() - 0.5) * 0.5, by + 0.45, z + (r() - 0.5) * 0.5, 0, 0, (r() - 0.5) * 0.3, { seg: 1 });
      }
    }
  }
}

/** Build all the dressing. Returns { group, pads } (pads: extra lily pad spots for the marsh). */
export function buildDressing(scene) {
  const r = mulberry32(8080);
  const group = new THREE.Group();
  group.name = 'lake-dressing';
  const extraPads = [];
  // (the cairns go first, so nothing else is planted on them)
  const parts = [['cairns', (k) => cairns(k)], ['frostpine', (k) => frostpine(k, r)], ['lilymarsh', (k) => lilymarsh(k, r, extraPads)], ['fernpond', (k) => fernpond(k, r)], ['quarry', (k) => quarry(k, r)], ['waterways', (k) => waterways(k, r)]];
  for (const [name, fn] of parts) {
    const k = new Kit(2048);
    fn(k);
    if (k.geos.length) group.add(splitByTiles(k.mesh(name), 40));
  }
  if (FERN_SPOTS.length) group.add(buildFerns(FERN_SPOTS));
  scene.add(group);
  return { group, pads: extraPads };
}
