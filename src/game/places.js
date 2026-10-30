// Places on the map: lakes, landmarks, waystones, shops and homes. Each is discovered the first time you
// come near it (waystones when you light them) and only then shows on the map. New places (more shops,
// friends' homes, new buildings) are added by pushing to PLACES; the map and discovery pick them up.
// The map also remembers which parts of the valley you have explored (a coarse fog of war).
import { LAKES, DEEP_C, FALLS_C, HALF, CLEARINGS } from '../world/terrain.js';
import { CABIN, BOARD, TROPHY, LIGHTHOUSE, CAMPFIRE, CAMP_FIRE, HOME_DOOR } from '../world/props.js';
import { WAYSTONES } from './waystones.js';
import { SPOTS } from './spots.js';

export const KINDS = {
  lake: { label: 'Lakes and rivers', icon: 'waves', color: '#2f7f86' },
  poi: { label: 'Points of interest', icon: 'pin', color: '#e8a317' },
  waystone: { label: 'Waystones', icon: 'compass', color: '#7cc3c2' },
  vendor: { label: 'Shops', icon: 'shop', color: '#e0483a' },
  home: { label: 'Homes', icon: 'home', color: '#3f9a5b' },
};

export const PLACES = [
  { id: 'cove', kind: 'lake', name: 'Cozy Cove', x: 0, z: -2, r: 40, desc: 'The home lake: the dock, the lighthouse and the Deep in the middle.' },
  { id: 'frost', kind: 'lake', name: 'Frostpine Lake', x: LAKES.frost.cx, z: LAKES.frost.cz, r: 60, desc: 'Cold, clear water under the pines. Trout and char.' },
  { id: 'marsh', kind: 'lake', name: 'Lilymarsh', x: LAKES.marsh.cx, z: LAKES.marsh.cz, r: 60, desc: 'Lily pads, reeds and muddy shallows full of sunfish.' },
  { id: 'pond', kind: 'lake', name: 'Fern Pond', x: LAKES.pond.cx, z: LAKES.pond.cz, r: 36, desc: 'A small, quiet pond ringed with ferns.' },
  { id: 'quarry', kind: 'lake', name: 'Old Quarry', x: LAKES.quarry.cx, z: LAKES.quarry.cz, r: 30, desc: 'A flooded quarry. Deep, dark and strange things at the bottom.' },
  { id: 'river', kind: 'lake', name: 'Willow River', x: 104, z: 32, r: 22, desc: 'Runs from the cove to Lilymarsh. Boats can row it.' },
  { id: 'frostrun', kind: 'lake', name: 'Frostrun Creek', x: -74, z: -70, r: 18, desc: 'A cold creek from the cove up to Frostpine Lake. Row it all the way.' },
  { id: 'fernbrook', kind: 'lake', name: 'Fern Brook', x: -78, z: 66, r: 18, desc: 'A slow brook through the ferns, from the cove to Fern Pond.' },
  { id: 'quarrycut', kind: 'lake', name: 'Quarry Cut', x: 78, z: -98, r: 18, desc: 'The old barge canal from the cove to the quarry. A spur turns off into the hill.' },
  { id: 'cave', kind: 'lake', name: 'Echo Cavern', x: LAKES.cave.cx, z: LAKES.cave.cz, r: 26, desc: 'A flooded cave under Cavern Hill. Row in up the spur off the Quarry Cut. Glowing fish live in the dark.' },
  { id: 'gus', kind: 'vendor', name: "Gus's Tackle & Tide", x: CABIN.door.x, z: CABIN.door.z, r: 14, desc: 'Bait, rods, lures, boats, clothes and cabin decor. Sell your catch here.' },
  { id: 'home', kind: 'home', name: 'Your cottage', x: HOME_DOOR.x, z: HOME_DOOR.z + 2, r: 16, enter: true, desc: 'Your own place up the hill. Walk in, sit by the window, set out your trophies.' },
  { id: 'charter', kind: 'vendor', name: "Marlowe's Charters", x: 19, z: 30.8, r: 12, desc: 'Captain Marlowe takes your party out past the lighthouse to Open Waters for big-game fishing. Everyone aboard needs level 20.' }, // v1.15
  { id: 'dock', kind: 'poi', name: 'The Dock', x: 0.5, z: 30, r: 12, desc: 'Where every angler starts. Boats launch here.' },
  { id: 'board', kind: 'poi', name: 'Notice board', x: BOARD.x, z: BOARD.z, r: 10, desc: 'Daily requests, the Lake Gazette, mail and derbies.' },
  { id: 'legends', kind: 'poi', name: 'Lake Legends', x: TROPHY.x, z: TROPHY.z, r: 10, desc: 'The three best fish ever pulled from the cove.' },
  { id: 'campfire', kind: 'poi', name: 'Campfire', x: CAMPFIRE.x, z: CAMPFIRE.z, r: 10, desc: 'Logs to sit on and a fire that never goes out.' },
  { id: 'lighthouse', kind: 'poi', name: 'Lighthouse', x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, r: 16, desc: 'Its beam sweeps the cove every night.' },
  { id: 'falls', kind: 'poi', name: 'Waterfall Pool', x: FALLS_C.x, z: FALLS_C.z, r: 16, desc: 'Churning water at the foot of the falls. Good fishing.' },
  { id: 'ruins', kind: 'poi', name: 'Sunken Ruins', x: DEEP_C.x, z: DEEP_C.z, r: 10, desc: 'Old stones under the Deep. They glow on foggy nights. Fishing here takes level 20, and they only stir at night.' },
  { id: 'leviathan', kind: 'poi', name: 'The Frozen Leviathan', x: -143, z: -140, r: 28, desc: 'The skeleton of an enormous ancient bass, frozen into a slab of ice in the middle of Frostpine Lake. Fishing between its ribs takes level 32.' },
  { id: 'wreck', kind: 'poi', name: 'The Old Wreck', x: 131.2, z: 159.6, r: 22, desc: 'A big old ship cracked in two in the middle of Lilymarsh. The water round it is the marsh\'s deep end: level 16.' },
  // v1.13: each lake's landmark (its answer to the Sunken Ruins)
  ...SPOTS.filter((s) => s.tier === 'poi' && s.lake !== 'frost').map((s) => ({ id: s.id, kind: 'poi', name: s.name.replace(/^the /, 'The '), x: s.x, z: s.z, r: 14, desc: `${s.desc} Fishing here takes level ${s.level}.` })),
  { id: 'lodge', kind: 'poi', name: 'Pinewood Lodge', x: CLEARINGS.lodge.x, z: CLEARINGS.lodge.z, r: 18, desc: 'A lodge and two cabins in the southern woods.' },
  { id: 'camp', kind: 'poi', name: 'Fern Camp', x: CAMP_FIRE.x, z: CAMP_FIRE.z, r: 14, desc: 'Tents and a campfire in the far west.' },
  { id: 'park', kind: 'poi', name: "Sundae's Trailer Park", x: CLEARINGS.park.x, z: CLEARINGS.park.z, r: 16, desc: 'Five trailers under string lights, east of Fern Pond. Sundae runs a tight ship.' },
  { id: 'fernview', kind: 'poi', name: 'Fernview Campground', x: CLEARINGS.fernview.x, z: CLEARINGS.fernview.z, r: 13, desc: 'Tents round a campfire on the north shore of Fern Pond.' },
  { id: 'bog', kind: 'poi', name: 'Bog Hut', x: CLEARINGS.bog.x, z: CLEARINGS.bog.z, r: 12, desc: 'A lonely hut past the marsh.' },
  { id: 'shed', kind: 'poi', name: 'Quarry Shed', x: CLEARINGS.shed.x, z: CLEARINGS.shed.z, r: 12, desc: 'The old quarry workers’ shed.' },
  ...WAYSTONES.map((w) => ({ id: `ws-${w.id}`, kind: 'waystone', name: `${w.name} waystone`, x: w.at.x, z: w.at.z, r: 0, waystone: w.id, desc: 'Light it by walking past. Stand at a lit waystone and press E to travel to another.' })),
];

const CELL = 8, N = Math.ceil((HALF * 2) / CELL);

export class Places {
  constructor(game) { this.game = game; this.t = 0; this.quiet = true; } // quiet: no toasts for what's around you when you arrive

  get d() { const e = this.game.ext.d; e.found = e.found || {}; e.seen = e.seen || ''; return e; }

  found(p) {
    if (p.kind === 'waystone') return this.game.waystones?.lit.has(p.waystone);
    return !!this.d.found[p.id];
  }
  list() { return PLACES.filter((p) => this.found(p)); }
  count(kind) { const all = PLACES.filter((p) => p.kind === kind); return { have: all.filter((p) => this.found(p)).length, total: all.length }; }

  // explored cells (fog of war)
  seenCell(i, j) { const s = this.d.seen; return s.charCodeAt(j * N + i) === 49; }
  get grid() { return { N, CELL }; }

  update(dt) {
    this.t -= dt;
    if (this.t > 0 || !this.game.ext?.d) return;
    this.t = 0.5;
    const g = this.game, p = g.player.pos;
    // reveal the map around you
    let seen = this.d.seen;
    if (seen.length !== N * N) seen = '0'.repeat(N * N);
    let changed = false;
    const R = 26;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const cx = -HALF + (i + 0.5) * CELL, cz = -HALF + (j + 0.5) * CELL;
      if (Math.hypot(cx - p.x, cz - p.z) < R && seen.charCodeAt(j * N + i) !== 49) { seen = seen.slice(0, j * N + i) + '1' + seen.slice(j * N + i + 1); changed = true; }
    }
    // discover places
    const fresh = [];
    for (const pl of PLACES) {
      if (pl.kind === 'waystone' || this.d.found[pl.id]) continue;
      if (Math.hypot(pl.x - p.x, pl.z - p.z) < pl.r) fresh.push(pl);
    }
    if (changed || fresh.length) {
      g.ext.change((d) => { d.seen = seen; d.found = d.found || {}; for (const pl of fresh) d.found[pl.id] = Date.now(); });
      for (const pl of fresh) {
        if (!this.quiet) { g.ui.toast(pl.name, { title: 'New place on your map', icon: KINDS[pl.kind].icon, ms: 3600 }); g.chat?.system(`Discovered ${pl.name}. It's on your map (M).`, 'info'); }
      }
    }
    this.quiet = false;
  }
}

export const MAP_GRID = { N, CELL };
