// The angler's save: browser storage + rules.js.
// Feed, board and lake records are shared between tabs on this device (handy for testing multiplayer locally).
import * as R from '../game/rules.js';
import { SPECIES_BY_ID } from '../data/species.js';

const safe = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

let uid = 0;
export const newId = () => `${Date.now().toString(36)}${(uid++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export class LocalSave {
  constructor(slot = 'guest') {
    this.slot = slot;
    this.key = `rt_profile_${slot}`;
    this.userId = safe.get(`rt_uid_${slot}`) || `guest-${newId()}`;
    safe.set(`rt_uid_${slot}`, this.userId);
    this.feedListeners = new Set();
    try {
      this.bc = new BroadcastChannel('rt_feed');
      this.bc.onmessage = (e) => this.feedListeners.forEach((fn) => fn(e.data));
    } catch { this.bc = null; }
  }

  async init(defaultName = 'Guest') {
    const stored = safe.get(this.key);
    this.isNew = !stored;
    this.profile = R.ensureProfileShape(stored || R.newProfile(defaultName));
    this.persist();
    return this.profile;
  }

  persist() {
    this.profile.updatedAt = Date.now();
    safe.set(this.key, this.profile);
    this.updateBoard();
  }

  reset() { safe.del(this.key); }

  // ---- catches ----
  async recordCatch(c) {
    const p = this.profile;
    c.id = c.id || newId();
    c.ts = c.ts || Date.now();
    // Lake record (shared across tabs on this device)
    const records = safe.get('rt_records') || {};
    const prev = records[c.speciesId];
    if (!prev || c.weight > prev.weight) {
      records[c.speciesId] = { userId: this.userId, name: p.name, weight: c.weight, ts: c.ts };
      safe.set('rt_records', records);
      if (prev && prev.userId !== this.userId) { c.record = true; R.bumpStat(p, 'records'); }
    }
    const summary = R.applyCatch(p, c);
    summary.record = !!c.record;
    let where = R.keepCatch(p, c);
    if (!where) { summary.autoSold = R.sellNow(p, c).coins; where = 'sold'; }
    summary.where = where;
    summary.catchId = c.id;
    this.persist();
    if (R.isGreatCatch(c)) this.postFeed('catch', { speciesId: c.speciesId, variant: c.variant, weight: c.weight, zone: c.zone, record: !!c.record });
    return summary;
  }

  async recordJunk(junkId) {
    const out = R.applyJunk(this.profile, junkId);
    this.persist();
    return out;
  }

  async release(id) { const r = R.releaseCatch(this.profile, id); this.persist(); return r; }
  async sell(ids) { const r = R.sellCatches(this.profile, ids); this.persist(); return r; }
  async trade(id) { const r = R.tradeCatch(this.profile, id); this.persist(); return r; }
  async give(id) { const c = R.giveCatch(this.profile, id); this.persist(); return !!c; }
  async moveCatch(id, to) { const r = R.moveCatch(this.profile, id, to); this.persist(); return r; }

  // ---- rewards & spending (quests, derbies, bait, upgrades) ----
  async grant(kind, key, reward) { const r = R.grantReward(this.profile, reward); this.persist(); return { ok: true, ...r }; }
  async spend(kind, key, price) { const ok = R.spend(this.profile, price); if (ok) this.persist(); return ok ? { ok: true } : { ok: false, reason: 'Not enough coins.' }; }
  setCreelBonus(n) { this.profile.creelBonus = n; this.persist(); }

  // ---- shop / gear ----
  async buy(itemId) { const r = R.buyItem(this.profile, itemId); this.persist(); return r; }
  async equip(slot, itemId) { const ok = R.equip(this.profile, slot, itemId); this.persist(); return ok; }

  // ---- achievements / stats ----
  async claim(achId) {
    const a = R.claimAchievement(this.profile, achId);
    if (a) { this.persist(); if (a.tier === 'gold') this.postFeed('achievement', { achId }); }
    return a;
  }
  async bumpStat(key, n = 1) { R.bumpStat(this.profile, key, n); this.persist(); }
  async setOceanStats(map) { R.setOceanStats(this.profile, map); this.persist(); }

  // ---- profile ----
  async saveAvatar(cfg) { this.profile.avatar = cfg; R.bumpStat(this.profile, 'avatarSaves'); this.persist(); }
  async saveSettings(s) { this.profile.settings = { ...this.profile.settings, ...s }; this.persist(); }
  async setTitle(t) { if (t === '' || this.profile.titles.includes(t)) { this.profile.title = t; this.persist(); } }
  async setName(n) { this.profile.name = String(n || 'Guest').slice(0, 20); this.persist(); }

  // ---- shared: board, feed, records ----
  updateBoard() {
    const board = safe.get('rt_board') || {};
    board[this.userId] = { ...R.boardEntry(this.profile), id: this.userId, ts: Date.now() };
    safe.set('rt_board', board);
  }

  async leaderboard(kind = 'top', period = 'week') {
    const board = safe.get('rt_board') || {};
    const rows = Object.values(board).map((e) => ({ id: e.id, name: e.name, level: e.level, title: e.title, score: e[kind]?.[period] ?? 0, me: e.id === this.userId }));
    rows.sort((a, b) => b.score - a.score);
    rows.forEach((r, i) => { r.rank = i + 1; });
    const top = rows.slice(0, 10);
    const mine = rows.find((r) => r.me);
    if (mine && !top.includes(mine)) top.push(mine);
    return top;
  }

  async records() { return safe.get('rt_records') || {}; }

  postFeed(kind, payload) {
    const entry = { id: newId(), userId: this.userId, name: this.profile.name, kind, payload, ts: Date.now(), reactions: {} };
    const feed = safe.get('rt_feed') || [];
    feed.unshift(entry);
    safe.set('rt_feed', feed.slice(0, 50));
    this.feedListeners.forEach((fn) => fn(entry));
    this.bc?.postMessage(entry);
    return entry;
  }

  async listFeed() {
    const week = Date.now() - 7 * 86400000;
    return (safe.get('rt_feed') || []).filter((e) => e.ts > week);
  }

  onFeed(fn) { this.feedListeners.add(fn); return () => this.feedListeners.delete(fn); }

  async react(entryId, emoji) {
    const feed = safe.get('rt_feed') || [];
    const e = feed.find((x) => x.id === entryId);
    if (!e) return;
    e.reactions[emoji] = (e.reactions[emoji] || 0) + 1;
    safe.set('rt_feed', feed);
    R.bumpStat(this.profile, 'reactions');
    this.persist();
  }

  async signOut() {}
}

export { safe };
export function speciesName(id) { return SPECIES_BY_ID[id]?.name || id; }
