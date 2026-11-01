// Bait, upgrades, and the dock's shared gear box.
import { BAITS, UPGRADES, MAX_UPGRADE, upgradeEffects } from '../data/bait.js';
import { today } from './quests.js';

export class Tackle {
  constructor(game) { this.game = game; this.box = {}; }
  get d() { return this.game.ext.d; }

  init() {
    this.apply();
    // The dock gear box: anglers leave spare bait for each other.
    this.unsub = this.game.shared.watch('gearbox', (docs) => {
      const box = {};
      for (const doc of docs) if (BAITS[doc.id]) box[doc.id] = Math.max(0, Math.min(999, Math.floor(Number(doc.n) || 0)));
      this.box = box;
      this.game.ui.sheets.current?.name === 'shop' && this.game.ui.sheets.refresh();
    });
  }

  // ---- bait
  get active() { const b = this.d.activeBait; return b && (this.d.bait[b] || 0) > 0 ? b : null; }
  count(id) { return this.d.bait[id] || 0; }

  async buyBait(id) {
    const b = BAITS[id];
    const r = await this.game.save.spend('bait', id, b.price);
    if (!r.ok) { this.game.ui.toast(r.reason || 'Not enough yet.'); return false; }
    this.game.ext.change((d) => { d.stats.baitBought = (d.stats.baitBought || 0) + 1; d.bait[id] = (d.bait[id] || 0) + b.pack; if (!d.activeBait || !(d.bait[d.activeBait] > 0)) d.activeBait = id; });
    this.game.audio.sfx('purchase');
    this.game.ui.toast(`+${b.pack} ${b.name}. ${this.active === id ? 'On your hook now.' : 'Press V to switch bait.'}`, { icon: 'worm' });
    return true;
  }

  use(id) {
    if (id && !this.count(id)) return;
    this.game.ext.change((d) => { d.activeBait = id; });
    this.game.ui.toast(id ? `${BAITS[id].name} on the hook (${this.count(id)} left).` : 'No bait. Plain hook.', { icon: 'worm', ms: 1800 });
  }

  // V / D-pad right: next bait you have, then none.
  cycle() {
    const have = Object.keys(BAITS).filter((k) => this.count(k) > 0);
    if (!have.length) { this.game.ui.toast('No bait yet. Gus sells it at the cabin.'); return; }
    const opts = [...have, null];
    const i = opts.indexOf(this.active);
    this.use(opts[(i + 1) % opts.length]);
  }

  /** One bait goes on each hooked fish. Returns the bait used. */
  consume() {
    const b = this.active;
    if (!b) return null;
    this.game.ext.change((d) => { d.bait[b] = Math.max(0, (d.bait[b] || 0) - 1); });
    if (!this.count(b)) this.game.ui.toast(`That was your last ${BAITS[b].name}.`, { icon: 'worm' });
    return b;
  }

  // ---- upgrades
  level(kind) { return this.d.upgrades[kind] || 0; }
  nextPrice(kind) { const l = this.level(kind); return l < Math.min(MAX_UPGRADE, UPGRADES[kind].prices.length) ? UPGRADES[kind].prices[l] : null; }

  async upgrade(kind) {
    const price = this.nextPrice(kind);
    if (!price) return false;
    const r = await this.game.save.spend('upgrade', `${kind}${this.level(kind) + 1}`, price);
    if (!r.ok) { this.game.ui.toast(r.reason || 'Not enough yet.'); return false; }
    this.game.ext.change((d) => { d.upgrades[kind] = (d.upgrades[kind] || 0) + 1; });
    this.apply();
    this.game.audio.sfx('levelup');
    this.game.ui.toast(`${UPGRADES[kind].name} level ${this.level(kind)}!`, { icon: 'star' });
    return true;
  }

  effects() { return upgradeEffects(this.d.upgrades); }

  apply() {
    const e = this.effects();
    this.game.player.rowMult = e.rowMult;
    if ((this.game.profile.creelBonus || 0) !== e.creelBonus) this.game.save.setCreelBonus?.(e.creelBonus);
    this.game.profile.creelBonus = e.creelBonus;
  }

  // ---- gear box
  async leave(id, n = 5) {
    if (this.count(id) < n) { this.game.ui.toast(`You need ${n} ${BAITS[id].name} to leave some.`); return; }
    this.game.ext.change((d) => { d.bait[id] -= n; });
    await this.game.shared.set('gearbox', id, { n: (this.box[id] || 0) + n, at: Date.now() });
    this.game.ext.bump('baitShared', n);
    this.game.ui.toast(`Left ${n} ${BAITS[id].name} in the gear box. Someone will be glad.`, { icon: 'worm' });
  }
  canTake() { return this.d.stats.boxDay !== today(); }
  async take(id, n = 5) {
    if (!this.canTake()) { this.game.ui.toast('One handful a day from the box. Leave some for the others!'); return; }
    const have = this.box[id] || 0;
    if (have < 1) return;
    const k = Math.min(n, have);
    const ok = await this.game.shared.set('gearbox', id, { n: have - k, at: Date.now() });
    if (!ok) { this.game.ui.toast("The box is stuck (this view can't change shared things)."); return; }
    this.game.ext.change((d) => { d.bait[id] = (d.bait[id] || 0) + k; d.stats.boxDay = today(); });
    this.game.ui.toast(`Took ${k} ${BAITS[id].name} from the gear box.`, { icon: 'worm' });
  }
}
