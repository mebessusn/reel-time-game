// Signed-in save backed by Supabase. Every change goes through a server function (see supabase/migrations),
// which validates it and returns the full player state; this class mirrors that state for the UI.
import * as R from '../game/rules.js';
import { SPECIES_BY_ID, BOTTLE_MESSAGES } from '../data/species.js';
import { ITEMS_BY_ID } from '../data/items.js';
import { ACH_BY_ID } from '../data/achievements.js';

export class CloudSave {
  constructor(sb, session) {
    this.sb = sb;
    this.session = session;
    this.userId = session.user.id;
    this.isCloud = true;
    this.feedListeners = new Set();
  }

  async rpc(fn, args = {}) {
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) throw new Error(error.message || `${fn} failed`);
    return data;
  }

  applyState(st) {
    if (!st) return this.profile;
    const keepSettings = this.profile?.settings;
    const p = R.ensureProfileShape({
      name: st.name, avatar: st.avatar, level: st.level, xp: st.xp, title: st.title, titles: st.titles || [],
      coins: st.coins, pearls: st.pearls, owned: st.owned || [], equipped: st.equipped, settings: { ...(st.settings || {}), ...(this.pendingSettings || {}) },
      stats: st.stats || {}, achievements: st.achievements || {}, bottles: st.bottles || [], catchCount: st.catchCount || 0,
      creel: (st.creel || []).map(fix), storage: (st.storage || []).map(fix), fishpedia: st.fishpedia || {}, records: {},
      creelBonus: st.creelBonus || 0, xpCurve2: true, // (the server's own migration already kept their level)
    });
    if (st.ext && typeof st.ext === 'object') this.ext = st.ext;
    if (keepSettings && this.pendingSettings) p.settings = { ...keepSettings, ...this.pendingSettings };
    if (this.profile) Object.assign(this.profile, p); else this.profile = p;
    return this.profile;
  }

  async init(defaultName) {
    const r = await this.rpc('ensure_profile', { p_name: defaultName });
    this.isNew = r.created;
    this.applyState(r.state);
    this.subscribeFeed();
    return this.profile;
  }

  async importGuest(guest) { this.applyState(await this.rpc('import_guest', { p_state: guest })); }

  // ---- catches ----
  async recordCatch(c) {
    const r = await this.rpc('record_catch', {
      p_species: c.speciesId, p_variant: c.variant, p_weight: c.weight, p_zone: c.zone, p_phase: c.phase,
      p_weather: c.weather, p_full_moon: !!c.fullMoon, p_wait: !!c.waitCatch, p_away: !!c.away,
    });
    this.applyState(r.state);
    const s = r.summary;
    return { ...s, species: SPECIES_BY_ID[s.speciesId], weight: Number(s.weight) };
  }

  async recordJunk(junkId) {
    const r = await this.rpc('record_junk', { p_junk: junkId });
    this.applyState(r.state);
    const out = { ...r.out };
    if (out.messageIndex != null) out.message = BOTTLE_MESSAGES[out.messageIndex];
    return out;
  }

  async release(id) { const r = await this.rpc('release_catch', { p_id: id }); this.applyState(r.state); return r; }
  async sell(ids) { const r = await this.rpc('sell_catches', { p_ids: ids }); this.applyState(r.state); return { coins: r.coins, sold: r.sold }; }
  async trade(id) { const r = await this.rpc('trade_catch', { p_id: id }); this.applyState(r.state); return r; }
  async give(id) { const r = await this.rpc('give_catch', { p_id: id }); this.applyState(r.state); return !!r.ok; }
  async moveCatch(id, to) { const r = await this.rpc('move_catch', { p_id: id, p_to: to }); this.applyState(r.state); return r.ok; }

  // ---- rewards & spending (quests, derbies, bait, upgrades): the server caps and de-duplicates ----
  async grant(kind, key, reward) {
    const r = await this.rpc('claim_reward', { p_kind: kind, p_key: String(key).slice(0, 80), p_coins: reward.coins || 0, p_pearls: reward.pearls || 0, p_xp: reward.xp || 0, p_title: reward.title || null, p_item: reward.item || null });
    this.applyState(r.state);
    return r.ok ? { ok: true, coins: r.coins, pearls: r.pearls, xp: r.xp, levelUp: r.levelUp || 0, title: reward.title || null, item: reward.item || null } : { ok: false, reason: r.reason };
  }
  async spend(kind, key, price) {
    const r = await this.rpc('spend_coins', { p_kind: kind, p_key: String(key).slice(0, 80), p_coins: price.coins || 0, p_pearls: price.pearls || 0 });
    this.applyState(r.state);
    return r.ok ? { ok: true } : { ok: false, reason: r.reason || 'Not enough coins.' };
  }
  setCreelBonus() { /* the server derives it from your saved upgrades */ }
  async saveExt(ext) { try { await this.rpc('save_ext', { p_ext: ext }); } catch (e) { console.warn('[ext]', e.message); } }

  // ---- shop / gear ----
  async buy(itemId) {
    const r = await this.rpc('buy_item', { p_item: itemId });
    this.applyState(r.state);
    return r.ok ? { ok: true, item: ITEMS_BY_ID[itemId] } : { ok: false, reason: r.reason };
  }
  async equip(slot, itemId) { const r = await this.rpc('equip_item', { p_slot: slot, p_item: itemId }); this.applyState(r.state); return r.ok; }

  // ---- achievements / stats ----
  async claim(achId) {
    const r = await this.rpc('claim_achievement', { p_ach: achId });
    this.applyState(r.state);
    return r.ok ? ACH_BY_ID[achId] : null;
  }
  async bumpStat(key, n = 1) {
    try { this.applyState(await this.rpc('bump_stat', { p_key: key, p_n: n })); } catch (e) { console.warn(e.message); }
  }

  // ---- profile ----
  async saveAvatar(cfg) { this.profile.avatar = cfg; this.applyState(await this.rpc('save_profile', { p_patch: { avatar: cfg } })); }
  async setTitle(t) { this.applyState(await this.rpc('save_profile', { p_patch: { title: t } })); }
  async setName(n) { this.applyState(await this.rpc('save_profile', { p_patch: { name: String(n || '').slice(0, 20) } })); }
  async saveSettings(s) {
    // Apply instantly, write to the server at most every 800 ms (sliders fire a lot).
    this.profile.settings = { ...this.profile.settings, ...s };
    this.pendingSettings = { ...(this.pendingSettings || {}), ...s };
    clearTimeout(this.settingsT);
    this.settingsT = setTimeout(async () => {
      const patch = this.pendingSettings;
      this.pendingSettings = null;
      try { this.applyState(await this.rpc('save_profile', { p_patch: { settings: patch } })); } catch (e) { console.warn(e.message); }
    }, 800);
  }

  // ---- shared: board, feed, records ----
  async leaderboard(kind = 'top', period = 'week') {
    const rows = await this.rpc('leaderboard', { p_board: kind, p_period: period });
    return (rows || []).map((r) => ({ ...r, score: Number(r.score) }));
  }

  async topTrophies() { return (await this.rpc('top_trophies', {})) || []; }

  async records() {
    const { data, error } = await this.sb.from('records').select('species_id,name,weight,created_at');
    if (error) throw error;
    return Object.fromEntries((data || []).map((r) => [r.species_id, { name: r.name, weight: Number(r.weight), ts: Date.parse(r.created_at) }]));
  }

  mapFeed(r) { return { id: r.id, userId: r.user_id, name: r.name, kind: r.kind, payload: r.payload || {}, ts: Date.parse(r.created_at), reactions: r.reactions || {} }; }

  async listFeed() {
    const { data, error } = await this.sb.from('feed').select('*').order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return (data || []).map((r) => this.mapFeed(r));
  }

  subscribeFeed() {
    this.feedCh = this.sb.channel('feed-inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed' }, (payload) => {
        const e = this.mapFeed(payload.new);
        this.feedListeners.forEach((fn) => fn(e));
      })
      .subscribe();
  }

  onFeed(fn) { this.feedListeners.add(fn); return () => this.feedListeners.delete(fn); }
  postFeed() { /* the server posts great catches and gold achievements itself */ }

  async react(entryId, emoji) { try { this.applyState(await this.rpc('react_feed', { p_feed: entryId, p_emoji: emoji })); } catch (e) { console.warn(e.message); } }

  async signOut() { await this.sb.auth.signOut(); }
}

function fix(c) { return { ...c, weight: Number(c.weight) }; }
