// Frostmere: plugs the frozen north into the valley's terrain lookups (world/terrain.js setWestWorld), so walking,
// casting, bites, regions and the camera all work up here with no special cases in those systems.
// - Land is walkable where it isn't too steep or too high.
// - The ice (the lake, the Long Glide, the sea ice) is solid floor at ICE_Y. It's only water where a hole is drilled.
// - The open water (past the floe edge, Steamhole Springs, the Frozen Falls pool) is water you can cast into.
import { setWestWorld } from '../world/terrain.js';
import { setWestWave } from '../world/water.js';
import { WATER_Y, ICE_Y, inNorth, toLocal, landAt, kindAt, depthAt, isIce, isOpen, zoneOf, regionOf } from './geo.js';

const WALK_SLOPE = 1.1, WALK_TOP = 42;

/** holeAt(x, z) -> a hole object (or null); floors(x, z) -> a floor height for a building (or null). */
export function installWestWorld({ holeAt, floorAt, deckAt, solidAt, hallAt }) {
  const land = (u, v) => {
    const s = landAt(u, v);
    if (s > WALK_TOP) return null;
    if (s < ICE_Y + 1.5) return s; // (the low lip of a bank is always walkable, so you can't get pinned at the ice's edge)
    const e = 0.5;
    const gx = Math.abs(landAt(u + e, v) - landAt(u - e, v)) / (2 * e), gz = Math.abs(landAt(u, v + e) - landAt(u, v - e)) / (2 * e);
    return Math.max(gx, gz) > WALK_SLOPE ? null : s;
  };
  const kind = (x, z) => { const [u, v] = toLocal(x, z); return kindAt(u, v); };
  setWestWorld({
    surfaceY(x, z) {
      if (!inNorth(x, z)) return 40;
      const f = floorAt?.(x, z); if (f != null) return f;
      const [u, v] = toLocal(x, z), k = kindAt(u, v);
      if (isIce(k) && !holeAt(x, z)) return ICE_Y;
      return landAt(u, v);
    },
    heightAt(x, z) {
      if (!inNorth(x, z)) return 30;
      const [u, v] = toLocal(x, z), k = kindAt(u, v);
      if (holeAt(x, z) || isOpen(k)) return -Math.max(1, depthAt(u, v));
      if (isIce(k)) return 1;
      return Math.max(1, landAt(u, v) - WATER_Y + 1);
    },
    groundY(x, z) { return this.walkY(x, z, 0); },
    walkY(x, z) {
      if (!inNorth(x, z)) return null;
      const f = floorAt?.(x, z); if (f != null) return f;
      if (solidAt?.(x, z)) return null;
      const [u, v] = toLocal(x, z), k = kindAt(u, v);
      if (isIce(k)) return holeAt(x, z) ? null : ICE_Y;
      if (isOpen(k)) return null;
      return land(u, v);
    },
    zoneAt(x, z) {
      if (!inNorth(x, z)) return null;
      const [u, v] = toLocal(x, z), k = kindAt(u, v);
      if (!(isOpen(k) || holeAt(x, z))) return null;
      return zoneOf(u, v);
    },
    boatable() { return false; },
    regionName(x, z) { if (!inNorth(x, z)) return 'Frostmere'; if (floorAt?.(x, z) != null && hallAt?.(x, z)) return 'The Hearth Lodge'; const [u, v] = toLocal(x, z); return regionOf(u, v); },
    onDeck(x, z) { return (deckAt || floorAt)?.(x, z) != null; }, // (porches and the lodge's floors: nothing on the ground under them blocks you. v1.17.1: not the Blue Caves' floor or a shanty's boards, whose walls and furniture still block)
  });
  // open water's gentle swell (the sea past the edge rolls a little; pools and holes are still)
  setWestWave((x, z) => (kind(x, z) === 4 ? Math.sin(x * 0.11 + performance.now() / 1300) * 0.06 + Math.sin(z * 0.17 + performance.now() / 1700) * 0.04 : 0));
}
export { WATER_Y, ICE_Y };
