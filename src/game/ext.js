// Extended player state: everything newer than the original save format (away gear, bait, upgrades,
// quests, story, fish traits and nicknames, collections, waystones, home decor, derbies, settings like
// key bindings). Kept on this device (localStorage, per player) and, for signed-in players, mirrored to
// the server's `ext` column through save_ext so it follows you between devices.
import { Emitter } from '../core/events.js';
import { loadSafe, writeJSON } from '../save/store.js';

export function extDefaults() {
  return {
    v: 1,
    updatedAt: 0,
    gear: [], // placed away gear: { id, kind, x, z, zone, placedAt, lastRoll, items: [bite] }
    gearOwned: { pot: 0, setline: 0 },
    bait: {}, // bait id -> count
    activeBait: null,
    upgrades: { reel: 0, line: 0, hull: 0, hold: 0, holders: 0 },
    traits: {}, // catch id -> { size, scar, hue, shift }
    names: {}, // catch id -> nickname
    locked: [], // catch ids you've locked (never sold in bulk)
    quests: { day: -1, list: [], npc: null },
    story: { step: 0, log: [] },
    story2: { step: 0, log: [] }, // The Valley Expedition (v1.8)
    clips: {}, // tutorial clips you've seen (src/ui/clips.js)
    saga: { lines: {}, unlocks: {} }, // v1.17.5 the primary quest lines (src/game/saga.js)
    milestones: {}, // collection quest id -> claimed timestamp
    treasure: { active: false, found: 0 },
    collections: {}, // set id -> claimed timestamp
    waystones: ['cove'],
    tutorial: { done: false, step: 0 },
    home: { decor: [], placed: {}, tank: [], wall: 'pine', floor: 'oak' },
    bottle: { lastDay: -1 },
    derby: { best: {}, wins: 0, claimed: {} },
    festival: { claimed: {} },
    keymap: {},
    found: {}, // map: place id -> when you discovered it
    seen: '', // map: explored cells ('1' = seen)
    waypoint: null, // map: { x, z, name }
    stats: {},
  };
}

function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = merge(base[k], v);
    else if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Make `target` equal `source` without replacing it or the objects inside it. */
function restoreInto(target, source) {
  for (const k of Object.keys(target)) if (!(k in source)) delete target[k];
  for (const [k, v] of Object.entries(source)) {
    const t = target[k];
    if (Array.isArray(v) && Array.isArray(t)) { t.length = 0; t.push(...v); }
    else if (v && typeof v === 'object' && !Array.isArray(v) && t && typeof t === 'object' && !Array.isArray(t)) restoreInto(t, v);
    else target[k] = v;
  }
  return target;
}

export class Ext extends Emitter {
  constructor() {
    super();
    this.d = extDefaults();
    this.save = null;
  }

  load(save) {
    clearTimeout(this.localT); clearTimeout(this.cloudT);
    this.save = save;
    // a save that keeps its state somewhere else entirely (save.cloudOnly) has no copy on this device: nothing is
    // read from here and nothing is written here, so it can never mix with the angler this device does keep
    this.key = save.cloudOnly ? null : `rt_ext_${save.userId}`;
    const { value: local, status } = this.key ? loadSafe(this.key) : { value: null, status: 'ok' }; // v1.17.18: a damaged ext is kept, never written over
    this.loadStatus = status;
    const cloud = save.ext;
    const pick = cloud && (!local || (cloud.updatedAt || 0) > (local.updatedAt || 0)) ? cloud : local;
    this.d = merge(extDefaults(), pick || {});
    return this.d;
  }

  /** Change the state: ext.change((d) => { d.bait.worm-- }) */
  change(fn) {
    fn(this.d);
    this.d.updatedAt = Date.now();
    this.emit('change', this.d);
    clearTimeout(this.localT);
    if (this.frozen) return;
    if (this.key) this.localT = setTimeout(() => writeJSON(this.key, this.d), 150);
    if (this.save?.saveExt) {
      clearTimeout(this.cloudT);
      this.cloudDue = true;
      this.cloudT = setTimeout(() => { this.cloudDue = false; this.save.saveExt(this.d); }, 4000);
    }
  }

  flush() {
    clearTimeout(this.localT);
    if (this.frozen) return;
    if (this.key) writeJSON(this.key, this.d);
    if (this.cloudDue && this.save?.saveExt) { clearTimeout(this.cloudT); this.cloudDue = false; this.save.saveExt(this.d); } // (don't leave the last few seconds behind)
  }
  /** The save's own copy replaces this one (its keeper said so), in place: the game holds on to the objects in it. */
  replace(data, into = restoreInto) { into(this.d, merge(extDefaults(), data || {})); this.emit('change', this.d); }
  /** The same for a few sections only ({ section: value }). */
  patch(part, into = restoreInto) { for (const [k, v] of Object.entries(part || {})) { if (this.d[k] && typeof this.d[k] === 'object' && v && typeof v === 'object') into(this.d[k], v); else this.d[k] = v; } this.emit('change', this.d); }
  /** v1.17.18: stop writing (a save is being imported over this one; the game restarts straight after). */
  freeze(on = true) { this.frozen = on; clearTimeout(this.localT); clearTimeout(this.cloudT); }
  bump(stat, n = 1) { this.change((d) => { d.stats[stat] = (d.stats[stat] || 0) + n; }); }
}
