// Derbies: every hour on the hour (UTC), a 10-minute contest. Even hours: the heaviest fish of any
// kind. Odd hours: the heaviest of one species everyone can catch anywhere. Scores ride in each
// player's presence, so whoever is on the lake competes live.
//
// Who gets one (derbyAllowed): nobody in single player (alone, the only entrant "won" every hour: a contest with no one
// in it), nobody in their first 15 minutes of play (a derby used to start over a brand-new angler's welcome card), and
// never while a card, a menu or Gus's tour is on the screen: it starts when that closes, if there is still time to fish it.
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
/** A new angler's quiet time: no derby and no world event until they have played this long. */
export const QUIET_MS = 15 * 60000;
/** A derby that could only start with less than this left is skipped. */
export const LATE_MS = 2 * 60000;
/** Pure: has this angler played long enough for timed events? */
export const settledIn = (playedMs) => (playedMs || 0) >= QUIET_MS;
/** Pure: may a derby start for this angler now? { solo, playedMs, blocked (a card or the tour is up), left (ms of it left), forced (?derby) } */
export function derbyAllowed({ solo = false, playedMs = 0, blocked = false, left = DERBY_MS, forced = false } = {}) {
  if (forced) return true;
  return !solo && settledIn(playedMs) && !blocked && left >= LATE_MS;
}
/** Pure: the play time a save starts counting from: an angler who had fished before play time was counted is past the quiet time. */
export const playedAtFirst = (saved, profile) => (Number.isFinite(saved) ? saved : (profile?.catchCount || 0) > 0 || (profile?.level || 1) > 1 ? QUIET_MS : 0);
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
  constructor(game) { this.game = game; this.current = null; this.best = 0; this.played = null; }

  /** Counts play time (tick runs every couple of seconds while the game does), saved once a minute until the quiet time is over. */
  count(now = Date.now()) {
    const g = this.game, x = g.ext?.d?.derby; if (!x) return;
    if (this.played == null) { this.played = playedAtFirst(x.played, g.profile); this.savedPlayed = x.played; this.last = now; }
    const dt = Math.max(0, Math.min(5000, now - this.last)); this.last = now;
    if (this.played < QUIET_MS && !(typeof document !== 'undefined' && document.hidden)) this.played += dt;
    if (this.savedPlayed == null || (this.savedPlayed < QUIET_MS && (this.played >= QUIET_MS || this.played - this.savedPlayed >= 60000))) {
      this.savedPlayed = Math.min(QUIET_MS, Math.round(this.played));
      g.ext.change((d) => { d.derby.played = this.savedPlayed; });
    }
  }
  /** Past the first 15 minutes of play? */
  get settled() { return settledIn(this.played); }
  /** Is something on the screen that an announcement would land on top of (a card, a menu, a conversation, Gus's tour)? */
  blocked() {
    const g = this.game;
    return !!(g.tutorial?.active || g.clips?.open || g.ui?.modalOpen || (typeof document !== 'undefined' && document.querySelector('.tut-welcome, .conduct-card, .loading')));
  }
  /** World events wait for the same things a derby does (they still happen in single player: nobody loses one). */
  holdEvents() { return !this.settled || this.blocked(); }
  /** Does this angler get derbies at all? (For the board's "next derby" line.) */
  get offered() { return TEST_DERBY || !this.game.solo; }

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
    const g = this.game, now = Date.now();
    this.count(now);
    const d = derbyAt(now);
    if (d && (!this.current || this.current.id !== d.id)) {
      if (!derbyAllowed({ solo: !!g.solo, playedMs: this.played, blocked: this.blocked(), left: d.end - now, forced: TEST_DERBY })) return;
      const mins = Math.max(1, Math.round((d.end - now) / 60000));
      this.current = d;
      this.best = g.ext.d.derby.best[d.id] || 0;
      g.audio.sfx('derby');
      g.chat?.system(`${d.name} ${mins >= 10 ? 'starts now' : 'is on'}! ${d.speciesId ? `Heaviest ${SPECIES_BY_ID[d.speciesId].name} wins.` : 'Heaviest fish of any kind wins.'} You have ${mins} minute${mins > 1 ? 's' : ''}.`, 'derby', { popup: true });
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
