// Open Waters: the ocean map's geography. The ocean lives in the same scene as the valley, far to the east
// (centred on OCEAN.x, OCEAN.z), so every game system (the player, fishing, other anglers, the sky) works there
// unchanged. The terrain lookups in world/terrain.js ask this module first for any point in the ocean's square.
//
// Coordinates here are world coordinates. Islands are smooth radial shapes with a little noise; everything else is
// open water OCEAN_DEPTH deep, shallowing over reefs and the island shelves. Zones (where fish live) come from
// named spots: the weed line, the deep blue, the canyon, reef edges and island lagoons.

export const OCEAN = { x: 3000, z: 0, half: 640, edge: 560 }; // edge: the charter never leaves this radius
export const OCEAN_DEPTH = -30;
const WATER_Y0 = 0.85; // the still water line (terrain.js WATER_Y) // block height of the open sea floor (the valley's water blocks are <= 0)

/** Is (x, z) in the ocean map's square? (the valley spans -224..223, so this never overlaps it) */
export const inOcean = (x, z) => Math.abs(x - OCEAN.x) < OCEAN.half && Math.abs(z - OCEAN.z) < OCEAN.half;

const L = (lx, lz) => ({ x: OCEAN.x + lx, z: OCEAN.z + lz });
const ABYSS_AT = L(340, -110);

// v1.15 Open Waters: the three islands (stage 2 makes them walkable; their shapes are here from the start so the
// charter sails around them and the sea floor shallows near them). r: beach radius, peak: hill height.
// v1.15.6: all three are bigger and walkable end to end (gentle slopes everywhere you're meant to go): Turtle Atoll's
// ring is wide enough to stroll and its lagoon is deep enough to swim, with a little islet (a motu) in the middle;
// Smuggler's Rock climbs gently from its jetty beach to a grassy top, with its cliffs on the far side.
export const ISLANDS = [
  { id: 'palm', name: 'Palm Key', ...L(-230, -170), r: 56, rz: 42, peak: 9, seed: 3, shelf: 70 },
  { id: 'turtle', name: 'Turtle Atoll', ...L(150, -300), r: 52, rz: 50, peak: 2.4, seed: 7, shelf: 90, atoll: true },
  { id: 'smuggler', name: "Smuggler's Rock", ...L(-320, 260), r: 46, rz: 40, peak: 15, seed: 11, shelf: 55, cliffs: true },
  // v1.15.19 Deep Blue: Emberkey, a young volcano far out to the north-east: black sand, steam vents, a glowing crater
  { id: 'ember', name: 'Emberkey', ...L(430, -330), r: 44, rz: 40, peak: 26, seed: 19, shelf: 50, volcano: true },
];
// v1.15.19 Deep Blue: little islets you swim ashore to (no jetty), and two banks where the sea floor rises to diving
// depth: Coralhaven's sunken village and the wreck of the Marigold.
export const ISLETS = [
  { id: 'gullrock', name: 'Gull Rock', ...L(-450, -40), r: 10, rz: 8, peak: 6, seed: 23, rocky: true },
  { id: 'lonepalm', name: 'Lone Palm', ...L(430, 170), r: 8, rz: 7, peak: 1.3, seed: 29 },
  { id: 'sandbar', name: 'The Sandbar', ...L(-120, 330), r: 30, rz: 6, peak: 0.25, seed: 31, flat: true },
];
export const ISLET_BY_ID = Object.fromEntries(ISLETS.map((i) => [i.id, i]));
export const BANKS = [
  { id: 'coralhaven', name: 'Coralhaven', ...L(-60, -20), r: 40, y: -16.5 },
  { id: 'marigold', name: 'The Marigold', ...L(230, 250), r: 30, y: -18.5 },
];
export const BANK_BY_ID = Object.fromEntries(BANKS.map((b) => [b.id, b]));
// Atoll shape (as a fraction of the radius): the ring of sand runs RING.in..1, the lagoon beach slopes into
// wading water and then swimming depth, and the motu rises in the middle.
export const ATOLL = { in: 0.6, wade: 0.44, deep: 0.34, motu: 0.17, floor: -2.3 };
export const ISLAND_BY_ID = Object.fromEntries(ISLANDS.map((i) => [i.id, i]));

// Named fishing spots (where the charter anchors). zone: the fishing zone; r: radius of the zone.
export const SPOTS = [
  { id: 'harbor', name: 'Marlowe\'s Mooring', ...L(-150, -90), zone: 'nearshore', r: 60, stage: 1 },
  { id: 'weedline', name: 'The Weed Line', ...L(-40, 120), zone: 'weedline', r: 70, stage: 1 },
  { id: 'deepblue', name: 'The Deep Blue', ...L(260, 40), zone: 'bluewater', r: 110, stage: 1 },
  { id: 'canyon', name: 'The Canyon', ...L(330, 330), zone: 'canyon', r: 90, stage: 2 },
  { id: 'reefedge', name: 'Reef Edge', ...L(60, -250), zone: 'reef', r: 60, stage: 2 },
  { id: 'abyss', name: 'The Abyss', ...L(340, -110), zone: 'abyss', r: 80, stage: 2, trust: 2 }, // v1.15.12: once Marlowe trusts you (First Mate)
  // v1.15.19 Deep Blue: anchorages by the islets and over the banks
  { id: 'coralhaven', name: 'Coralhaven', ...L(-60, -20), zone: 'coralhaven', r: 42, stage: 2 },
  { id: 'marigold', name: 'The Marigold', ...L(230, 250), zone: 'wreck', r: 32, stage: 2 },
  { id: 'gullrock', name: 'Gull Rock', ...L(-428, -40), zone: 'shore', r: 12, stage: 2 }, // (anchored off the rock: swim ashore)
  { id: 'lonepalm', name: 'Lone Palm', ...L(430, 188), zone: 'shore', r: 10, stage: 2 },
  { id: 'sandbar', name: 'The Sandbar', ...L(-76, 338), zone: 'shore', r: 12, stage: 2 },
];
export const SPOT_BY_ID = Object.fromEntries(SPOTS.map((s) => [s.id, s]));

// ---- noise (cheap, deterministic)
function hash(x, z, s) { let h = (x * 374761393 + z * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi, s), b = hash(xi + 1, zi, s), c = hash(xi, zi + 1, s), d = hash(xi + 1, zi + 1, s);
  return (a * (1 - u) + b * u) * (1 - w) + (c * (1 - u) + d * u) * w;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// v1.15 stage 4: level patches of sand on Palm Key for the beach games (centres local to the island). Inside r the sand
// is flat at y; it blends back into the island over PAD_BLEND metres.
const PAD_BLEND = 9; // (v1.15.6: wider, so the sand is let into the hill gently instead of a steep bank)
const P0 = { x: OCEAN.x - 230, z: OCEAN.z - 170 }; // Palm Key's centre (ISLANDS[0])
export const PADS = [
  { id: 'court', x: P0.x - 3, z: P0.z + 29, r: 8.5, y: 1.55 },
  { id: 'crabs', x: P0.x - 12, z: P0.z - 27, r: 7, y: 1.6 },
  { id: 'coconut', x: P0.x + 14, z: P0.z - 24, r: 7.5, y: 1.7 },
  { id: 'castles', x: P0.x - 38, z: P0.z + 4, r: 6.5, y: 1.65 },
];
export const PAD_BY_ID = Object.fromEntries(PADS.map((p) => [p.id, p]));
// v1.15.5: the smugglers' grotto on Smuggler's Rock. Through the rock arch (islands.js puts it on the shore, round the
// headland from the jetty), a channel runs into the cliff to a hidden lagoon and a little beach under a rock roof.
// (Fixed numbers, not DOCKS, so carving it can never move the jetty.)
const SMUG = { x: OCEAN.x - 320, z: OCEAN.z + 260, r: 46, rz: 40 }; // = ISLANDS[2]
const GB = Math.atan2(-120, 60) + 1.1, GUX = Math.cos(GB), GUZ = Math.sin(GB); // outward, through the arch
const gAt = (d, s = 0) => ({ x: SMUG.x + GUX * SMUG.r * 1.02 - GUX * d - GUZ * s, z: SMUG.z + GUZ * SMUG.rz * 1.02 - GUZ * d + GUX * s });
export const GROTTO = { mouth: gAt(0), lagoon: gAt(11), beach: gAt(15.5), u: { x: GUX, z: GUZ }, yaw: Math.atan2(GUX, GUZ) };
function grottoY(x, z) {
  const M = GROTTO.mouth, dx = x - M.x, dz = z - M.z;
  const d = -(dx * GUX + dz * GUZ), s = -dx * GUZ + dz * GUX; // d: metres in from the mouth; s: across
  if (d < -3 || d > 19 || Math.abs(s) > 6) return null;
  const B = GROTTO.beach;
  if (Math.hypot(x - B.x, z - B.z) < 3.2) return 1.4; // the pocket beach (dry, level)
  if (Math.hypot(x - GROTTO.lagoon.x, z - GROTTO.lagoon.z) < 3.8) return -0.9; // the lagoon
  if (d < 12 && Math.abs(s) < 1.7) return -1.1; // the channel through the arch
  return null;
}
/** The beach-games pad at (x, z) (pad: extra metres round it), if any. */
export const padAt = (x, z, pad = 0) => PADS.find((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad) || null;

/** Normalised distance from an island's centre: < 1 is on the island (beach line at 1). */
export function islandE(I, x, z) {
  const dx = (x - I.x) / I.r, dz = (z - I.z) / I.rz;
  const ang = Math.atan2(dz, dx);
  const wob = 1 + (vnoise(Math.cos(ang) * 2 + I.seed, Math.sin(ang) * 2, I.seed) - 0.5) * 0.35;
  return Math.hypot(dx, dz) / wob;
}

// Turtle Atoll: dunes along the ring, a sandy beach down into the lagoon (wading, then swimming depth), the motu.
function atollY(I, e, x, z) {
  const A = ATOLL, mid = (A.in + 1) / 2, hw = (1 - A.in) / 2;
  if (e >= A.in) {
    const t = 1 - Math.abs(e - mid) / hw; // 0 at both beaches, 1 along the crest
    return 1.25 + I.peak * smooth(0, 1, t) * (0.75 + vnoise(x * 0.09, z * 0.09, I.seed) * 0.5);
  }
  if (e >= A.wade) return WATER_Y0 - 0.45 + (1.25 - WATER_Y0 + 0.45) * smooth(A.wade, A.in, e); // the lagoon beach: dry sand into the shallows
  const lag = A.floor + (vnoise(x * 0.2, z * 0.2, I.seed + 3) - 0.5) * 0.5;
  if (e >= A.deep) return lag + (WATER_Y0 - 0.45 - lag) * smooth(A.deep, A.wade, e); // shelving into swimming depth
  if (e > A.motu + 0.06) return lag;
  return lag + (1.75 - lag) * smooth(A.motu + 0.06, A.motu * 0.35, e); // the motu, a sandy islet in the middle
}
// Smuggler's Rock: a hill you can climb from the jetty side, and sheer cliffs round the far side (with the arch).
const SMUG_CLIFF = Math.atan2(-120, 60) + 1.9; // the cliffs face this way (the jetty's bearing turned well round)
function rockY(I, e, x, z) {
  const base = 1.25 + I.peak * smooth(0.9, 0.3, e) + (vnoise(x * 0.1, z * 0.1, I.seed) - 0.5) * 1.2 * smooth(0.95, 0.75, e);
  const ang = Math.atan2((z - I.z) / I.rz, (x - I.x) / I.r);
  let da = ang - SMUG_CLIFF; da = Math.atan2(Math.sin(da), Math.cos(da));
  const cw = smooth(1.45, 0.95, Math.abs(da)); // how much cliff here
  if (cw <= 0) return base;
  // a ragged edge: the cliff line wanders in and out, and the face is broken into ledges
  const j = (vnoise(ang * 4 + 7, 0.5, I.seed + 2) - 0.5) * 0.12 + (vnoise(ang * 11, 2.5, I.seed + 4) - 0.5) * 0.05;
  const ledge = Math.round(smooth(1.0 + j, 0.88 + j, e) * 4) / 4;
  const wall = 1.25 + I.peak * (0.55 + vnoise(ang * 2, 1.5, I.seed + 5) * 0.3) * (smooth(1.0 + j, 0.88 + j, e) * 0.6 + ledge * 0.4) + (vnoise(x * 0.3, z * 0.3, I.seed + 1) - 0.5) * 1.5;
  return base + cw * Math.max(0, wall - base);
}

// v1.15.19 Emberkey: a cone of black rock and ash with a crater on top; a black-sand beach all round its foot
function volcanoY(I, e, x, z) {
  const cone = 1.25 + I.peak * Math.pow(smooth(0.98, 0.12, e), 1.25) + (vnoise(x * 0.12, z * 0.12, I.seed) - 0.5) * 1.4 * smooth(0.95, 0.6, e);
  const crater = smooth(0.2, 0.08, e) * 7; // the bowl at the top
  return cone - crater;
}
/** An islet's height (gentle mounds; Gull Rock is a jumble of rock), or null when it's not here. */
function isletY(T, x, z) {
  const dx = (x - T.x) / T.r, dz = (z - T.z) / T.rz, d = Math.hypot(dx, dz);
  if (d > 2.4) return null;
  if (d < 1) {
    if (T.flat) return 1.05 + (vnoise(x * 0.3, z * 0.3, T.seed) - 0.5) * 0.12; // the sandbar: just clear of the water
    const rock = T.rocky ? (vnoise(x * 0.5, z * 0.5, T.seed) - 0.3) * 2.2 : 0;
    return 1.15 + T.peak * Math.pow(1 - d, 1.3) + rock * (1 - d);
  }
  return 1.15 - (d - 1) * Math.max(T.r, T.rz) * 0.35 - smooth(1.2, 2.2, d) * 10;
}

/** Smooth ground height at (x, z) in the ocean (world y; the water surface is at WATER_Y = 0.85). */
export function oceanSurfaceY(x, z) {
  let best = OCEAN_DEPTH + 4 * vnoise(x * 0.01, z * 0.01, 5); // rolling sea floor
  { const A = ABYSS_AT, d = Math.hypot(x - A.x, z - A.z); if (d < 110) best -= 45 * smooth(110, 30, d); } // v1.15.12: the Abyss drops away
  for (const I of ISLANDS) {
    const e = islandE(I, x, z);
    if (e > I.shelf / I.r + 1) continue;
    let h;
    if (I.atoll && e < 1) h = atollY(I, e, x, z);
    else if (I.volcano && e < 1) h = volcanoY(I, e, x, z);
    else if (I.cliffs && e < 1) h = rockY(I, e, x, z);
    else if (e < 1) {
      const hill = Math.pow(1 - e, 1.6) * I.peak;
      h = 1.25 + hill + (vnoise(x * 0.12, z * 0.12, I.seed) - 0.5) * 0.8 * smooth(1, 0.85, e);
    } else {
      // the shelf: sand slopes down then drops off into the blue
      const d = (e - 1) * I.r;
      h = 1.25 - d * 0.22 - smooth(14, 40, d) * 14;
    }
    best = Math.max(best, h);
  }
  // v1.15.19: the islets, and the banks rising to diving depth
  for (const T of ISLETS) { if (Math.abs(x - T.x) > T.r * 2.5 || Math.abs(z - T.z) > T.rz * 2.5 + 20) continue; const h = isletY(T, x, z); if (h != null) best = Math.max(best, h); }
  for (const B of BANKS) {
    const d = Math.hypot(x - B.x, z - B.z);
    if (d > B.r + 30) continue;
    const top = B.y + (vnoise(x * 0.08, z * 0.08, 41) - 0.5) * 1.6;
    best = Math.max(best, top + (best - top) * smooth(B.r, B.r + 30, d));
  }
  const gy = grottoY(x, z);
  if (gy != null) best = gy;
  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d > p.r + PAD_BLEND) continue;
    const w = 1 - smooth(p.r, p.r + PAD_BLEND, d);
    best = best * (1 - w) + p.y * w;
  }
  return best;
}

/** Block height (the valley's convention: <= 0 is water, deeper is more negative). */
export function oceanHeightAt(x, z) {
  const s = oceanSurfaceY(x, z);
  return s > 0.85 ? Math.max(1, Math.round(s)) : Math.min(0, Math.round(s - 0.85));
}

/** Which named spot (if any) contains (x, z). */
export function spotAt(x, z) {
  let best = null, bd = Infinity;
  for (const s of SPOTS) { const d = Math.hypot(x - s.x, z - s.z); if (d < s.r && d < bd) { bd = d; best = s; } }
  return best;
}

/** Fishing zone in the ocean: island lagoons and shores, reef, named spots, or open water. */
export function oceanZoneAt(x, z) {
  const y = oceanSurfaceY(x, z);
  if (y > 0.85) return null;
  for (const I of ISLANDS) {
    const e = islandE(I, x, z);
    if (I.atoll && e < ATOLL.in) return 'lagoon';
    if (I.volcano && e < 1.9) return 'vents'; // v1.15.19: warm water off Emberkey
    if (e < 1.6) return y > -4 ? 'reef' : 'shore';
  }
  for (const B of BANKS) if (Math.hypot(x - B.x, z - B.z) < B.r + 6) return B.id === 'marigold' ? 'wreck' : 'coralhaven';
  for (const T of ISLETS) if (Math.hypot((x - T.x) / T.r, (z - T.z) / T.rz) < 2.6) return 'shore';
  const s = spotAt(x, z);
  if (s) return s.zone;
  return 'openocean';
}

export function oceanRegionName(x, z) {
  for (const I of ISLANDS) if (islandE(I, x, z) < 1.5) return I.name;
  for (const T of ISLETS) if (Math.hypot((x - T.x) / T.r, (z - T.z) / T.rz) < 2.6) return T.name;
  for (const B of BANKS) if (Math.hypot(x - B.x, z - B.z) < B.r + 10) return B.name;
  const s = spotAt(x, z);
  return s ? s.name : 'Open Waters';
}

/** The island at (x, z), if you're on or by one. */
export function islandAt(x, z, pad = 1.3) { return ISLANDS.find((I) => islandE(I, x, z) < pad) || ISLETS.find((T) => Math.hypot((x - T.x) / T.r, (z - T.z) / T.rz) < pad) || null; }
/** Everything the charter steers round: the islands and the islets (as rough circles). */
export const ROUTE_ISLES = () => [...ISLANDS, ...ISLETS.map((T) => ({ ...T, shelf: 14 }))];

// ---- v1.15 stage 2: a jetty on each island and the charter's mooring beside it. dir: the way the jetty runs out to
// sea (a bearing in radians, x = cos, z = sin). The jetty starts on the sand and runs JETTY_LEN out over the shelf.
export const JETTY_LEN = 18, JETTY_W = 2.3, JETTY_Y = WATER_Y0 + 0.6;
function makeDock(I, bearing) {
  const ux = Math.cos(bearing), uz = Math.sin(bearing);
  const h = (d) => oceanSurfaceY(I.x + ux * d, I.z + uz * d);
  let d = I.atoll ? I.r * ATOLL.in * 0.9 : 0; // (an atoll: start in the lagoon, past the motu)
  while (d < 200 && h(d) <= WATER_Y0) d += 0.5; // out of an atoll's lagoon onto its ring
  while (d < 200 && h(d) > WATER_Y0 - 0.15) d += 0.5; // to the water's edge
  let b = d;
  while (b > d - 6 && h(b) < WATER_Y0 + 0.35) b -= 0.25; // back up the beach to dry sand (not up a cliff)
  const x0 = I.x + ux * b, z0 = I.z + uz * b;
  const sx = -uz, sz = ux; // the boat lies to this side of the jetty
  const end = { x: x0 + ux * JETTY_LEN, z: z0 + uz * JETTY_LEN };
  const moor = { x: x0 + ux * (JETTY_LEN - 4.5) + sx * 3.55, z: z0 + uz * (JETTY_LEN - 4.5) + sz * 3.55 };
  return { island: I.id, x0, z0, ux, uz, len: JETTY_LEN, w: JETTY_W, y: JETTY_Y, end, moor, side: { x: sx, z: sz }, yaw: Math.atan2(ux, uz) + Math.PI };
}
export const DOCKS = Object.fromEntries([
  ['palm', ISLAND_BY_ID.palm, Math.atan2(SPOT_BY_ID.harbor.z - ISLAND_BY_ID.palm.z, SPOT_BY_ID.harbor.x - ISLAND_BY_ID.palm.x)],
  ['turtle', ISLAND_BY_ID.turtle, Math.atan2(40, -100)],
  ['smuggler', ISLAND_BY_ID.smuggler, Math.atan2(-120, 60)],
  ['ember', ISLAND_BY_ID.ember, Math.atan2(30, -100)], // v1.15.19: Emberkey's landing faces home
].map(([id, I, b]) => [id, makeDock(I, b)]));
// v1.15.19 Channel Light: a buoy-light platform on piles out in the open sea, with the keeper's hut on it. It works like a
// jetty (you walk on it, the boat ties up alongside), only wide and with nothing round it but water.
export const CHANNEL = (() => {
  const c = L(-380, 90), ux = Math.cos(0.6), uz = Math.sin(0.6), len = 12, w = 9;
  const x0 = c.x - ux * len / 2, z0 = c.z - uz * len / 2, sx = -uz, sz = ux;
  return { island: 'channel', name: 'Channel Light', platform: true, x0, z0, ux, uz, len, w, y: WATER_Y0 + 2.2, end: { x: x0 + ux * len, z: z0 + uz * len }, moor: { x: c.x + sx * (w / 2 + 3.2), z: c.z + sz * (w / 2 + 3.2) }, side: { x: sx, z: sz }, yaw: Math.atan2(ux, uz) + Math.PI, c };
})();
DOCKS.channel = CHANNEL;
/** A dock's name: its island's, or the platform's own. */
export const dockName = (D) => D?.name || ISLAND_BY_ID[D?.island]?.name || 'the landing';
/** The jetty under (x, z), if any. */
export function jettyAt(x, z) {
  for (const D of Object.values(DOCKS)) {
    const dx = x - D.x0, dz = z - D.z0, along = dx * D.ux + dz * D.uz, across = dx * D.side.x + dz * D.side.z;
    if (along > -0.3 && along < D.len && Math.abs(across) < D.w / 2) return D;
  }
  return null;
}
// the islands as places to sail to (the boat moors at the jetty)
for (const [id, D] of Object.entries(DOCKS)) SPOTS.push({ id: `${id}dock`, name: dockName(D), x: D.moor.x, z: D.moor.z, zone: null, r: 0, stage: 2, dock: id });
SPOTS.forEach((s) => { SPOT_BY_ID[s.id] = s; });
