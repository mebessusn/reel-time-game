// Lake Legends: the three best fish anyone has caught (rarity x variant first, weight breaks ties).
// Sources, merged and de-duplicated:
//   - Supabase: the server's top_trophies() over every catch ever recorded.
//   - Artifact: the page's shared `db` collection `trophies` (writers add qualifying catches),
//     plus each live viewer's personal best riding in room presence (view-only viewers too).
//   - Always: this device's own list (guest mode, tabs on one device).
import { Emitter } from '../core/events.js';
import { SPECIES_BY_ID, TIER_INFO, VARIANTS } from '../data/species.js';

const KEY = 'rt_trophies';
const safe = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

export function trophyScore(t) {
  const sp = SPECIES_BY_ID[t.speciesId];
  if (!sp) return -1;
  return TIER_INFO[sp.tier].points * (VARIANTS[t.variant]?.pointMult || 1) * 1000 + Number(t.weight || 0);
}

// Shared data is untrusted: keep only well-formed, plausible entries.
export function sanitizeTrophy(t) {
  if (!t || typeof t !== 'object') return null;
  const sp = SPECIES_BY_ID[t.speciesId];
  if (!sp || !['normal', 'gold', 'diamond'].includes(t.variant)) return null;
  const w = Number(t.weight);
  if (!(w >= sp.weight[0] * 0.99 && w <= sp.weight[1] * 1.01)) return null;
  const id = String(t.id || '').slice(0, 64);
  if (!id) return null;
  const name = String(t.name || 'Angler').replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, '').slice(0, 24) || 'Angler';
  const ts = Math.min(Date.now(), Number(t.ts) || Date.now());
  return { id, speciesId: sp.id, variant: t.variant, weight: Math.round(w * 100) / 100, name, userId: String(t.userId || '').slice(0, 64), ts, zone: typeof t.zone === 'string' ? t.zone.slice(0, 16) : '' };
}

const top3 = (list) => {
  const seen = new Set();
  return list.map(sanitizeTrophy).filter(Boolean)
    .sort((a, b) => trophyScore(b) - trophyScore(a) || a.ts - b.ts)
    .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .slice(0, 3);
};

export class Trophies extends Emitter {
  constructor(game) {
    super();
    this.game = game;
    this.cloud = [];
    this.shared = [];
    this.local = top3(safe.get(KEY, []));
    this.list = this.local;
    this.db = null;
    this.myBest = null;
  }

  async init() {
    const g = this.game;
    if (g.save?.isCloud && g.save.topTrophies) {
      await this.refreshCloud();
      this.cloudTimer = setInterval(() => this.refreshCloud(), 60000);
    }
    if (g.net?.kind === 'room') {
      // Personal best rides in presence so everyone (even view-only viewers) contributes.
      this.myBest = this.local.find((t) => t.userId === g.save.userId) || null;
      if (this.myBest) g.net.setBest?.(this.myBest);
      const db = await window.claude?.use?.('db').catch(() => null);
      if (db) {
        this.db = db;
        try {
          this.unsub = db.collection('trophies').orderBy('score', 'desc').limit(6).onSnapshot((snap) => {
            this.shared = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
            this.recompute();
          }, () => { this.db = null; });
        } catch { this.db = null; }
      }
    }
    this.recompute(true);
    this.ready = true;
  }

  async refreshCloud() {
    try { this.cloud = await this.game.save.topTrophies(); this.recompute(); } catch (e) { console.warn('[trophies]', e.message); }
  }

  presenceBests() {
    const out = [];
    for (const p of this.game.net?.peers?.values?.() || []) if (p.best) out.push(p.best);
    return out;
  }

  recompute(initial = false) {
    const next = top3([...this.cloud, ...this.shared, ...this.local, ...this.presenceBests(), ...(this.myBest ? [this.myBest] : [])]);
    const before = this.list.map((t) => t.id).join('|');
    const after = next.map((t) => t.id).join('|');
    const prevIds = new Set(this.list.map((t) => t.id));
    this.list = next;
    if (before !== after) {
      this.emit('change', next);
      if (this.ready && !initial) for (const t of next) if (!prevIds.has(t.id)) this.emit('new', { t, rank: next.indexOf(t) + 1 });
    }
  }

  // Called after one of your own catches is recorded.
  async onCatch(c) {
    const g = this.game;
    const entry = sanitizeTrophy({ id: c.id, speciesId: c.speciesId, variant: c.variant, weight: c.weight, name: g.profile.name, userId: g.save.userId, ts: c.ts || Date.now(), zone: c.zone });
    if (!entry) return;
    const score = trophyScore(entry);
    // this device
    const local = top3([...safe.get(KEY, []), entry]);
    safe.set(KEY, local);
    this.local = local;
    // presence (artifact room)
    if (g.net?.kind === 'room' && (!this.myBest || score > trophyScore(this.myBest))) {
      this.myBest = entry;
      g.net.setBest?.(entry);
    }
    // shared db (artifact): only write catches that would make the board
    const third = this.list[2];
    if (this.db && (!third || score > trophyScore(third))) {
      try { await this.db.collection('trophies').doc(entry.id.replace(/[^\w-]/g, '_')).set({ ...entry, score }); } catch { /* view-only viewers can't write; presence covers them */ }
    }
    if (g.save?.isCloud) await this.refreshCloud();
    this.recompute();
  }

  tick() { if (this.game.net?.kind === 'room') this.recompute(); }
}
