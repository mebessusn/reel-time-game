// v1.15.20 Coralhaven, the town inside: where its rooms and corridors are, and where you can walk. Pure data (no
// three.js) so the terrain hooks and the tests can use it. The town is a sealed place of its own a little way off the
// map (like your cottage is its own room), reached through the airlock on the sea floor at the Coralhaven bank.
//
//                 Shelly's Trading Post
//      Tidewater Inn         |          Old Finn's Fish Market
//               \            |           /
//     Airlock ---- Grand Hall (fountain) ----
//               /            |           \
//    Marina's Dive Locker    |          The Kelp & Kettle
//                     The Glass Gallery
//
// The rooms outside on the sea floor are laid out the same way, so the domes you swim past are the rooms you walk in.

export const TOWN = { x: 4300, z: 0, y: 3 }; // (outside the ocean's square: nothing else is out here)
export const TOWN_R = 60; // everything is inside this radius of TOWN

/** Rooms: centre (local), radius, wall height. kind picks the furnishing. */
export const ROOMS = [
  { id: 'hall', name: 'the Grand Hall', x: 0, z: 0, r: 16, h: 11, kind: 'hall' },
  { id: 'trading', name: "Shelly's Trading Post", x: 0, z: -36, r: 9, h: 6.5, kind: 'trading' },
  { id: 'market', name: "Old Finn's Fish Market", x: 31, z: -18, r: 9, h: 6.5, kind: 'market' },
  { id: 'cafe', name: 'the Kelp & Kettle', x: 31, z: 18, r: 9, h: 6.5, kind: 'cafe' },
  { id: 'gallery', name: 'the Glass Gallery', x: 0, z: 37, r: 10, h: 7, kind: 'gallery' },
  { id: 'locker', name: "Marina's Dive Locker", x: -31, z: 18, r: 8, h: 6, kind: 'locker' },
  { id: 'inn', name: 'the Tidewater Inn', x: -31, z: -18, r: 8, h: 6, kind: 'inn' },
  { id: 'airlock', name: 'the Airlock', x: -38, z: 0, r: 5.5, h: 6, kind: 'airlock' },
];
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
/** Corridors: every room joins the Grand Hall. w: walkable width. */
export const CORRIDOR_W = 5;
export const CORRIDORS = ROOMS.filter((r) => r.id !== 'hall').map((r) => ({ id: r.id, a: { x: 0, z: 0 }, b: { x: r.x, z: r.z } }));
/** The inside of the airlock door (where you arrive), local; and the door's bearing (it faces west, out to sea). */
export const AIRLOCK_IN = { x: -40.5, z: 0 };

function segD(px, pz, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / L2));
  return Math.hypot(px - a.x - dx * t, pz - a.z - dz * t);
}
/** Is (x, z) (world) inside the town at all? */
export const inTown = (x, z) => Math.abs(x - TOWN.x) < TOWN_R && Math.abs(z - TOWN.z) < TOWN_R;
/** The floor you stand on at (x, z) (world), or null where there's a wall. */
export function townFloor(x, z) {
  if (!inTown(x, z)) return null;
  const lx = x - TOWN.x, lz = z - TOWN.z;
  for (const R of ROOMS) if (Math.hypot(lx - R.x, lz - R.z) < R.r - 0.45) return TOWN.y;
  for (const C of CORRIDORS) if (segD(lx, lz, C.a, C.b) < CORRIDOR_W / 2 - 0.4) return TOWN.y;
  return null;
}
/** Which room (world x, z), or the corridor. */
export function townRoom(x, z) {
  const lx = x - TOWN.x, lz = z - TOWN.z;
  for (const R of ROOMS) if (Math.hypot(lx - R.x, lz - R.z) < R.r) return R;
  return null;
}
export const townRegion = (x, z) => `Coralhaven · ${(townRoom(x, z)?.name || 'a corridor').replace(/^the /, 'The ')}`;
export const W = (lx, lz) => ({ x: TOWN.x + lx, z: TOWN.z + lz });
