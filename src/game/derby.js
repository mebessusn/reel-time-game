// Derbies: every hour on the hour (UTC), a 10-minute contest. Even hours: the heaviest fish of any
// kind. Odd hours: the heaviest of one species everyone can catch anywhere. Scores ride in each
// player's presence, so whoever is on the lake competes live.
import { SPECIES_BY_ID } from '../data/species.js';

export const DERBY_MS = 10 * 60000;
const HOUR = 3600000;
const SPECIES_POOL = ['bluegill', 'carp', 'rockbass', 'minnow', 'cod'];
const TEST_DERBY = typeof location !== 'undefined' && new URLSearchParams(location.search).has('derby');

/** Pure: the derby at a moment, or null. { id, start, end, speciesId|null, name } */
export function derbyAt(now = Date.now()) {
  const hour = Math.floor(now / HOUR);
  const start = hour * HOUR;
  if (!TEST_DERBY && now - start >= DERBY_MS) return null;
  const speciesId = hour % 2 && !TEST_DERBY ? SPECIES_POOL[hour % SPECIES_POOL.length] : null;
  return { id: `h${hour}`, start, end: TEST_DERBY ? now + DERBY_MS : start + DERBY_MS, speciesId, name: speciesId ? `${SPECIES_BY_ID[speciesId].name} Derby` : 'Big Fish Derby' };
}
/** The next derby's start time. */
export function nextDerby(now = Date.now()) { return (Math.floor(now / HOUR) + 1) * HOUR; }

/** Pure: does a catch count, and for how much? */
export function derbyScore(d, c) {
  if (!d || !c || c.away) return 0;
  if (d.speciesId && c.speciesId !== d.speciesId) return 0;
  return Math.round(Number(c.weight) * 100) / 100;
}

/** Pure: rank untrusted presence scores for one derby. */
export function derbyBoard(entries, id) {
  return entries
    .filter((e) => e && e.id === id && Number.isFinite(e.w) && e.w > 0 && e.w < 500)
    .sort((a, b) => b.w - a.w);
}

export class Derby {
  constructor(game) { this.game = game; this.current = null; this.best = 0; }

  myEntry() { return this.current && this.best > 0 ? { id: this.current.id, w: this.best } : null; }

  board() {
    const g = this.game;
    const list = [];
    for (const p of g.net?.peers?.values?.() || []) {
      const e = p.meta?.derby;
      if (e) list.push({ id: e.id, w: Number(e.w), name: String(p.meta.name || 'Angler').slice(0, 20), me: false });
    }
    const mine = this.myEntry();
    if (mine) list.push({ ...mine, name: g.profile.name, me: true });
    return derbyBoard(list, this.current?.id);
  }

  tick() {
    const g = this.game;
    const d = derbyAt();
    if (d && (!this.current || this.current.id !== d.id)) {
      this.current = d;
      this.best = g.ext.d.derby.best[d.id] || 0;
      g.audio.sfx('derby');
      g.chat?.system(`${d.name} starts now! ${d.speciesId ? `Heaviest ${SPECIES_BY_ID[d.speciesId].name} wins.` : 'Heaviest fish of any kind wins.'} You have 10 minutes.`, 'derby', { popup: true });
    } else if (!d && this.current) {
      this.finish(this.current);
      this.current = null;
    }
  }

  async finish(d) {
    const g = this.game;
    const rows = this.board();
    const meIdx = rows.findIndex((r) => r.me);
    g.pushMeta();
    if (meIdx < 0 || g.ext.d.derby.claimed[d.id]) { if (rows.length) g.chat?.system(`${d.name} is over. Winner: ${rows[0].name} (${rows[0].w} lb).`, 'derby'); return; }
    const place = meIdx + 1, field = rows.length;
    const reward = place === 1 ? { coins: field > 1 ? 250 : 120, pearls: field > 1 ? 2 : 1, xp: 120 } : place <= 3 ? { coins: 100, xp: 70 } : { coins: 40, xp: 40 };
    g.chat?.system(`${d.name} is over! You placed #${place} of ${field} with ${this.best} lb.`, 'derby', { popup: true });
    g.ext.change((x) => { x.derby.claimed[d.id] = place; if (place === 1) x.derby.wins = (x.derby.wins || 0) + 1; });
    await g.reward('derby', d.id, reward, `${d.name} (#${place})`);
  }

  onCatch(c) {
    const g = this.game;
    const s = derbyScore(this.current, c);
    if (!s || s <= this.best) return;
    this.best = s;
    g.ext.change((x) => { x.derby.best = { [this.current.id]: s }; });
    g.pushMeta();
    const rank = this.board().findIndex((r) => r.me) + 1;
    g.ui.toast(`Derby: ${s} lb! You're #${rank}.`, { icon: 'trophy', title: this.current.name });
  }

  /** For the HUD. */
  status(now = Date.now()) {
    if (!this.current) return null;
    const left = Math.max(0, Math.ceil((this.current.end - now) / 1000));
    return { name: this.current.name, left, best: this.best, rank: this.board().findIndex((r) => r.me) + 1, field: this.board().length };
  }
}
