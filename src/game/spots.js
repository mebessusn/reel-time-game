// Lake progression (v1.13): every lake climbs in three steps, with nothing floating on the water to mark them.
//   base: the level you need to fish anywhere in the lake at all
//   deep: the lake's deep end, a little higher
//   poi:  its landmark (each lake's answer to Cozy Cove's Sunken Ruins), small and the highest of the three
// Cast below the level and the line comes back (fishing.js -> game.lakeGateFailed). The levels show on the map
// and in the Journal's Lakes section. Cozy Cove's own ladder (the Deep 10, the Ruins 20) is zone-based (rules.js).
import { BOAT_LEVEL, DEEP_LEVEL, RUINS_LEVEL } from './rules.js';
import { zoneAt } from '../world/terrain.js';

export const LAKE_NAMES = { cove: 'Cozy Cove', pond: 'Fern Pond', marsh: 'Lilymarsh', frost: 'Frostpine Lake', quarry: 'Old Quarry', cave: 'Echo Cavern' };
export const LAKE_ORDER = ['cove', 'pond', 'marsh', 'frost', 'quarry', 'cave'];

// kind: deep (a deep end), legend (a landmark with a legend), mythic (a landmark whose fish include a mythic)
export const SPOTS = [
  { id: 'pond_deep', lake: 'pond', tier: 'deep', name: 'the deep end', kind: 'deep', level: 8, x: -170, z: 155, r: 8 },
  { id: 'pond_poi', lake: 'pond', tier: 'poi', name: 'the Drowned Mill', kind: 'legend', level: 15, x: -152, z: 166, r: 6, hint: 'at dawn',
    desc: 'An old watermill that slid into Fern Pond, wheel and all. The Pond Sage circles its millstone at dawn.' },
  { id: 'marsh_deep', lake: 'marsh', tier: 'deep', name: 'the deep end', kind: 'deep', level: 16, x: 131.2, z: 159.6, r: 17 },
  { id: 'marsh_poi', lake: 'marsh', tier: 'poi', name: "the Bog King's Crown", kind: 'legend', level: 25, x: 172, z: 172, r: 6, hint: 'in the rain',
    desc: 'A giant mossy stone crown sunk in the lilies. Nobody knows whose head it was carved for. The Bog King rises there in the rain.' },
  { id: 'frost_deep', lake: 'frost', tier: 'deep', name: 'the deep end', kind: 'deep', level: 24, x: -186, z: -140, r: 12 },
  { id: 'frost_poi', lake: 'frost', tier: 'poi', name: "the Leviathan's Ribs", kind: 'mythic', level: 32, x: -143, z: -140, r: 13, hint: 'at dawn, or at night for its heir',
    desc: 'Fish the cold water between the Frozen Leviathan\'s ribs. The Crystal Pike rises at dawn; at night, something of the Leviathan\'s own blood.' },
  { id: 'quarry_deep', lake: 'quarry', tier: 'deep', name: 'the deep end', kind: 'deep', level: 34, x: 150, z: -166, r: 7 },
  { id: 'quarry_poi', lake: 'quarry', tier: 'poi', name: 'the Drowned Digger', kind: 'legend', level: 40, x: 170, z: -145, r: 6, hint: 'in a storm',
    desc: 'The quarry\'s old steam shovel, left behind when the water came up. Its rusty bucket still hangs over the Storm Sturgeon\'s hole.' },
  { id: 'cave_deep', lake: 'cave', tier: 'deep', name: 'the deep end', kind: 'deep', level: 40, x: 75, z: -153, r: 6 },
  { id: 'cave_poi', lake: 'cave', tier: 'poi', name: 'the Sunken Bell', kind: 'legend', level: 44, x: 58, z: -164, r: 5,
    desc: 'A great bronze bell lying on its side in the cavern pool. Ring the water near it and the Echo Eel answers.' },
];
export const SPOT_BY_ID = Object.fromEntries(SPOTS.map((s) => [s.id, s]));

// Each lake's three levels (Cozy Cove's deep end and landmark are its zones).
export const LAKE_LEVELS = {
  cove: { base: 1, deep: { name: 'the deep end', level: DEEP_LEVEL }, poi: { name: 'the Sunken Ruins', level: RUINS_LEVEL, hint: 'at night' } },
  pond: { base: 5 }, marsh: { base: 12 }, frost: { base: 20 }, quarry: { base: 30 }, cave: { base: 36 },
};
for (const s of SPOTS) LAKE_LEVELS[s.lake][s.tier] = s;
/** Pure: "5–15" for a lake. */
export const lakeRange = (lake) => { const L = LAKE_LEVELS[lake]; return L ? `${L.base}–${L.poi.level}` : ''; };

const COVE_ZONES = new Set(['dock', 'shallows', 'open', 'deep', 'ruins', 'falls']);
/** Pure: which lake a zone belongs to (rivers and creeks belong to none: open to everyone). */
export const lakeOfZone = (zone) => (COVE_ZONES.has(zone) ? 'cove' : LAKE_LEVELS[zone] ? zone : null);

/** Pure: the marked deep end or landmark at (x, z), if any (landmarks win where they overlap a deep end). */
export function spotAt(x, z) {
  let hit = null;
  for (const s of SPOTS) if (Math.hypot(x - s.x, z - s.z) <= s.r && (!hit || s.tier === 'poi')) hit = s;
  return hit;
}

/** Pure: the level water at (x, z) asks for: { lake, level, name, tier }. Level 1 for rivers and creeks. */
export function gateAt(x, z, zone = zoneAt(x, z)) {
  const lake = lakeOfZone(zone);
  if (!lake) return { lake: null, level: 1, name: '', tier: 'base' };
  const L = LAKE_LEVELS[lake];
  if (lake === 'cove') {
    if (zone === 'ruins') return { lake, level: L.poi.level, name: 'the Sunken Ruins', tier: 'poi' };
    if (zone === 'deep') return { lake, level: L.deep.level, name: 'the deep end', tier: 'deep' };
    return { lake, level: 1, name: LAKE_NAMES.cove, tier: 'base' };
  }
  const sp = spotAt(x, z);
  if (sp && sp.lake === lake) return { lake, level: sp.level, name: sp.name, tier: sp.tier, spot: sp };
  return { lake, level: L.base, name: LAKE_NAMES[lake], tier: 'base' };
}

// Everything levels open, in order (Cozy Cove's zones, every spot, the lobster cage and level rewards).
export const UNLOCKS = [
  { level: BOAT_LEVEL, what: 'Rowboats', text: 'Rowboats: row out to the Cove\'s open water and feeding schools.' },
  { level: DEEP_LEVEL, what: 'The Deep', text: 'The Deep in the middle of Cozy Cove.' },
  { level: 15, what: 'Lobster Cage', text: "Lobster cages at Gus's shop: they catch the big crayfish and crabs." },
  { level: RUINS_LEVEL, what: 'The Sunken Ruins', text: 'The Sunken Ruins under Cozy Cove, at night.' },
  ...LAKE_ORDER.filter((l) => l !== 'cove').map((l) => ({ level: LAKE_LEVELS[l].base, what: LAKE_NAMES[l], lake: l, text: `${LAKE_NAMES[l]}: you can fish anywhere in it.` })),
  ...SPOTS.map((s) => ({ level: s.level, spot: s.id, what: s.tier === 'poi' ? s.name.replace(/^the /, 'The ') : `${LAKE_NAMES[s.lake]}'s deep end`, text: s.tier === 'poi' ? `${s.name.replace(/^the /, 'The ')}, the landmark of ${LAKE_NAMES[s.lake]}${s.hint ? ` (bites ${s.hint})` : ''}.` : `The deep end of ${LAKE_NAMES[s.lake]}.` })),
].sort((a, b) => a.level - b.level);

/** Pure: what opens exactly at this level. */
export const unlocksAt = (level) => UNLOCKS.filter((u) => u.level === level);
/** Pure: the next thing to open above this level. */
export const nextUnlock = (level) => UNLOCKS.find((u) => u.level > level) || null;

// Level rewards every 5 levels from 25 (on top of the normal level-up).
export const LEVEL_REWARDS = {
  25: { coins: 1000, pearls: 5, title: 'Lake Wanderer' },
  30: { coins: 1500, pearls: 8, title: 'Deep Water Angler' },
  35: { coins: 2000, pearls: 10, title: 'Quarry Master' },
  40: { coins: 3000, pearls: 15, title: 'Old Pro' },
  45: { coins: 4000, pearls: 20, title: 'Cavern Diver' },
  50: { coins: 6000, pearls: 40, title: 'Valley Master' },
};
