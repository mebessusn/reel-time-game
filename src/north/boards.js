// Frostmere: the shared boards. Best flight (Above the Clouds), the Sled Derby, the Long Glide skate race and the
// weekly Hearthwick Ice Derby. Kept in the lake's shared data (game/shared.js: the page's db in the artifact, this
// device elsewhere), one doc per player per board: { board, name, score, at } (+ week and species for the derby).
// Read from other players, so everything shown is sanitised and clipped.
import { h } from '../ui/dom.js';
import { NORTH_SPECIES } from '../data/northSpecies.js';
import { weekId } from '../core/clock.js';

const COL = 'fm_boards';
export const BOARDS = {
  flight: { name: 'Above the Clouds', unit: 'points', high: true },
  derby: { name: 'Frostmere Sled Derby', unit: 's', high: false },
  glide: { name: 'The Long Glide', unit: 's', high: false },
  ice: { name: 'Hearthwick Ice Derby', unit: 'lb', high: true },
  climb: { name: 'Skyline Hill Climb', unit: 's', high: false },
  toboggan: { name: 'Skyline Toboggan Run', unit: 's', high: false },
  air: { name: 'The Big Air Jump', unit: 'm', high: true },
};
const clip = (s, n) => String(s || '').replace(/[<>]/g, '').slice(0, n);

/** This week's Ice Derby fish: one of the lake's (not the sea's, not the legends), the same for everyone. */
export function derbyFish(week = weekId()) {
  const pool = NORTH_SPECIES.filter((s) => ['common', 'uncommon', 'rare'].includes(s.tier) && !s.zones.every((z) => z === 'floe'));
  let hsh = 0; for (const ch of String(week)) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[hsh % pool.length];
}

export class Boards {
  constructor(north) {
    this.north = north; this.game = north.game; this.docs = [];
    this.un = null;
  }
  watch() { if (!this.un && this.game.shared) this.un = this.game.shared.watch(COL, (docs) => { this.docs = Array.isArray(docs) ? docs : []; }, { limit: 300 }); }
  /** Top entries of a board (this week's, for the Ice Derby). */
  top(board, n = 10) {
    const B = BOARDS[board], wk = weekId();
    return this.docs.filter((d) => d && d.board === board && typeof d.score === 'number' && isFinite(d.score) && (board !== 'ice' || d.week === wk))
      .sort((a, b) => (B.high ? b.score - a.score : a.score - b.score)).slice(0, n)
      .map((d) => ({ name: clip(d.name, 20) || 'Someone', score: d.score, me: d.id?.endsWith?.(this.game.save.userId) }));
  }
  /** Post a score; keeps your best (lower is better for times). Returns true if it's your new best. */
  async post(board, score, extra = {}) {
    const g = this.game, B = BOARDS[board], uid = g.save.userId || 'me', wk = weekId();
    const id = `${board}-${board === 'ice' ? `${wk}-` : ''}${uid}`;
    const mine = this.docs.find((d) => d.id === id.replace(/[^\w-]/g, '_'));
    if (mine && (B.high ? mine.score >= score : mine.score <= score)) return false;
    await g.shared?.set(COL, id, { board, name: clip(g.profile.name, 20), score: +score.toFixed(2), at: Date.now(), ...(board === 'ice' ? { week: wk } : {}), ...extra });
    return true;
  }
  /** Show a board in a little panel. */
  show(board) {
    this.watch();
    const B = BOARDS[board], rows = this.top(board), g = this.game;
    document.querySelector('.fm-board')?.remove();
    const fmt = (s) => (B.unit === 's' ? `${s.toFixed(1)} s` : B.unit === 'lb' ? `${s.toFixed(2)} lb` : `${Math.round(s)} pts`);
    const sub = board === 'ice' ? `This week: the heaviest ${derbyFish().name}` : board === 'derby' ? 'Fastest round the sled trail. June\'s time: 48.0 s' : board === 'glide' ? 'Fastest down the frozen river on skates' : 'Best score flying north or home';
    const el = h('div.fm-board.plank', h('div.fm-board-head', h('b', B.name), h('button.btn.ghost', { on: { click: () => el.remove() } }, 'Close')), h('div.fm-board-sub', sub),
      rows.length ? h('ol.fm-board-rows', rows.map((r) => h(`li${r.me ? '.me' : ''}`, h('span', r.name), h('span', fmt(r.score))))) : h('div.fm-board-empty', 'Nobody yet. Be the first!'));
    g.ui.root.append(el);
    setTimeout(() => { const off = (e) => { if (!el.contains(e.target)) { el.remove(); document.removeEventListener('pointerdown', off); } }; document.addEventListener('pointerdown', off); }, 50);
  }
}
