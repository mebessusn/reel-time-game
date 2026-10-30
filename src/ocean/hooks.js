// Open Waters: plugs the ocean into the valley's terrain lookups (world/terrain.js setFarWorld), so walking,
// casting, bites, regions and the camera all work out at sea with no special cases in those systems.
// The charter boat's deck is solid ground; the islands are land; everything else is deep water.
import { setFarWorld, WATER_Y } from '../world/terrain.js';
import { inOcean, oceanSurfaceY, oceanHeightAt, oceanZoneAt, oceanRegionName, jettyAt } from './geo.js';
import { inTown, townFloor, townRegion } from './coralhavenMap.js';

const WALK_SLOPE = 1.2, WALK_TOP = 30;

export function installFarWorld(getBoats) {
  // the boat's deck first, then the island jetties (stage 2)
  const deck = (x, z) => { for (const b of getBoats()) { const y = b.deckY(x, z); if (y != null) return y; } const j = jettyAt(x, z); return j ? Math.max(j.y, oceanSurfaceY(x, z)) : null; };
  const hull = (x, z) => getBoats().some((b) => b.footprint(x, z));
  const land = (x, z, wade = 0.22) => {
    const s = oceanSurfaceY(x, z);
    if (s < WATER_Y - wade || s > WALK_TOP) return null;
    const e = 0.35;
    const gx = Math.abs(oceanSurfaceY(x + e, z) - oceanSurfaceY(x - e, z)) / (2 * e);
    const gz = Math.abs(oceanSurfaceY(x, z + e) - oceanSurfaceY(x, z - e)) / (2 * e);
    return Math.max(gx, gz) > WALK_SLOPE ? null : s;
  };
  setFarWorld({
    // v1.15.20: Coralhaven's town (its own sealed place off the map, coralhavenMap.js) is dry floor with walls round it
    surfaceY(x, z) { if (inTown(x, z)) return townFloor(x, z) ?? 30; if (!inOcean(x, z)) return 30; return deck(x, z) ?? oceanSurfaceY(x, z); },
    heightAt(x, z) { if (inTown(x, z)) return townFloor(x, z) != null ? 2 : 30; if (!inOcean(x, z)) return 30; if (hull(x, z) || jettyAt(x, z)) return 2; return oceanHeightAt(x, z); },
    groundY(x, z) { if (inTown(x, z)) return townFloor(x, z); if (!inOcean(x, z)) return null; const d = deck(x, z); if (d != null) return d; return land(x, z, 0); },
    walkY(x, z, wade) { if (inTown(x, z)) return townFloor(x, z); if (!inOcean(x, z)) return null; const d = deck(x, z); if (d != null) return d; return land(x, z, wade); },
    zoneAt(x, z) { if (inTown(x, z) || !inOcean(x, z) || hull(x, z) || jettyAt(x, z)) return null; return oceanZoneAt(x, z); },
    boatable() { return false; }, // no rowboats out here: the charter does the driving
    regionName(x, z) { if (inTown(x, z)) return townRegion(x, z); return inOcean(x, z) ? oceanRegionName(x, z) : 'Open Waters'; },
    onDeck(x, z) { return hull(x, z) || !!jettyAt(x, z); }, // (no casting through a hull or a jetty; v1.15.23: not the town, whose furniture must stay solid: casting indoors is stopped in canCast)
  });
}
