// Extended player state: everything newer than the original save format (away gear, bait, upgrades,
// quests, story, fish traits and nicknames, collections, waystones, home decor, derbies, settings like
// key bindings). Kept on this device (localStorage, per player) and, for signed-in players, mirrored to
// the server's `ext` column through save_ext so it follows you between devices.
import { Emitter } from '../core/events.js';

const safe = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

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

export class Ext extends Emitter {
  constructor() {
    super();
    this.d = extDefaults();
    this.save = null;
  }

  load(save) {
    this.save = save;
    this.key = `rt_ext_${save.userId}`;
    const local = safe.get(this.key);
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
    this.localT = setTimeout(() => safe.set(this.key, this.d), 150);
    if (this.save?.saveExt) {
      clearTimeout(this.cloudT);
      this.cloudT = setTimeout(() => this.save.saveExt(this.d), 4000);
    }
  }

  flush() { clearTimeout(this.localT); if (this.key) safe.set(this.key, this.d); }
  bump(stat, n = 1) { this.change((d) => { d.stats[stat] = (d.stats[stat] || 0) + n; }); }
}
