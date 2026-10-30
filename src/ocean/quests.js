// Open Waters stage 5: a bonus request each day and a bonus job each week, for anglers who can sail (level 20). They
// sit beside the valley's requests on the notice board but never count towards the daily bonus, so nobody has to go
// to sea to finish their day.
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { mulberry32 } from '../core/rng.js';
import { SPECIES_BY_ID } from '../data/species.js';
const LEVEL = 20; // (OW.LEVEL: who can sail)

const day = (now = Date.now()) => Math.floor(now / 86400000);
const week = (now = Date.now()) => Math.floor((day(now) + 3) / 7);

/** Pure: the day's sea request (the same for everyone). */
export function oceanDaily(d) {
  const r = mulberry32(d * 4241 + 77);
  const opts = [
    { kind: 'big', n: 1, text: 'Land a big-game fish in Open Waters', reward: { coins: 400, xp: 300 } },
    { kind: 'tropical', n: 3, text: 'Catch 3 reef or island fish', reward: { coins: 250, xp: 200 } },
    { kind: 'spear', n: 2, text: 'Spear 2 fish on a dive', reward: { coins: 300, xp: 220 } },
    { kind: 'beach', n: 1, text: 'Play a beach game on Palm Key', reward: { coins: 200, xp: 180 } },
    { kind: 'whale', n: 1, text: 'Spot a whale from the charter', reward: { coins: 250, xp: 200 } },
  ];
  return { id: `od${d}`, day: d, have: 0, done: false, claimed: false, ...opts[Math.floor(r() * opts.length)] };
}
/** Pure: the week's sea job. */
export function oceanWeekly(w) {
  const r = mulberry32(w * 6151 + 3);
  const opts = [
    { kind: 'big', n: 8, text: 'Land 8 big-game fish this week' },
    { kind: 'beachwin', n: 3, text: 'Win 3 beach games this week' },
    { kind: 'spear', n: 10, text: 'Spear 10 fish this week' },
    { kind: 'kinds', n: 8, text: 'Catch 8 different kinds of sea fish this week' },
    { kind: 'release', n: 2, text: 'Tag and release 2 billfish this week' },
  ];
  return { id: `ow${w}`, week: w, have: 0, seen: [], done: false, claimed: false, ...opts[Math.floor(r() * opts.length)], reward: { coins: 1200, pearls: 6, xp: 800 } };
}
/** Pure: how far an event moves a sea quest. type: catch | spear | beach | whale | release. */
export function oceanStep(q, type, data = {}) {
  if (!q || q.done) return q;
  const sp = SPECIES_BY_ID[data.speciesId];
  let k = 0;
  switch (q.kind) {
    case 'big': k = type === 'catch' && sp?.ocean && sp.big ? 1 : 0; break;
    case 'tropical': k = type === 'catch' && sp?.ocean && !sp.big ? 1 : 0; break;
    case 'spear': k = type === 'spear' ? 1 : 0; break;
    case 'beach': k = type === 'beach' ? 1 : 0; break;
    case 'beachwin': k = type === 'beach' && data.won ? 1 : 0; break;
    case 'whale': k = type === 'whale' ? 1 : 0; break;
    case 'release': k = type === 'release' ? 1 : 0; break;
    case 'kinds': if (type === 'catch' && sp?.ocean && !q.seen.includes(sp.id)) { q = { ...q, seen: [...q.seen, sp.id] }; k = 1; } break;
    default: break;
  }
  if (!k) return q;
  const have = Math.min(q.n, q.have + k);
  return { ...q, have, done: have >= q.n };
}

export class OceanQuests {
  constructor(game) { this.game = game; }
  get on() { return this.game.profile.level >= LEVEL; }
  state() {
    const g = this.game, d0 = day(), w0 = week(), s = g.ext.d.ocean?.quests || {};
    if (s.daily?.day === d0 && s.weekly?.week === w0) return s;
    g.ext.change((d) => {
      const q = d.ocean.quests || {};
      d.ocean.quests = { daily: q.daily?.day === d0 ? q.daily : oceanDaily(d0), weekly: q.weekly?.week === w0 ? q.weekly : oceanWeekly(w0) };
    });
    return g.ext.d.ocean.quests;
  }
  progress(type, data = {}) {
    if (!this.on) return;
    const g = this.game, s = this.state();
    const dn = oceanStep(s.daily, type, data), wn = oceanStep(s.weekly, type, data);
    if (dn === s.daily && wn === s.weekly) return;
    g.ext.change((d) => { d.ocean.quests.daily = dn; d.ocean.quests.weekly = wn; });
    for (const [a, b] of [[s.daily, dn], [s.weekly, wn]]) if (!a.done && b.done) { g.chat.system(`Sea request done: ${b.text}. Claim it at the notice board (B).`, 'quest', { popup: true }); g.audio.sfx('achievement'); }
  }
  async claim(which) {
    const g = this.game, q = this.state()[which];
    if (!q?.done || q.claimed) return;
    const r = await g.reward('owquest', q.id, q.reward, q.text);
    if (r?.ok !== false) g.ext.change((d) => { d.ocean.quests[which].claimed = true; });
  }
  /** The notice board's Open Waters section (only for anglers who can sail). */
  render(c, sheet) {
    if (!this.on) return;
    const s = this.state();
    c.body.append(h('div.section-title', 'Open Waters (bonus)'));
    c.body.append(h('div.muted', { style: { marginBottom: '6px' } }, 'Extra requests for the sea. They never count towards the daily bonus.'));
    const row = (q, which, ic) => h(`div.list-row${q.done && !q.claimed ? '.me' : ''}`, icon(ic),
      h('div.grow', h('div.ttl', q.text), h('div.progress', h('i', { style: { width: `${(q.have / q.n) * 100}%` } })), h('div.meta', `${q.have}/${q.n} · ${q.reward.coins} coins${q.reward.pearls ? `, ${q.reward.pearls} pearls` : ''}, ${q.reward.xp} XP · ${which === 'daily' ? 'today' : 'this week'}`)),
      q.claimed ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Done') : q.done ? h('button.btn.gold.small', { on: { click: () => sheet.act(() => this.claim(which)) } }, 'Claim') : null);
    c.body.append(h('div.row-list', row(s.daily, 'daily', 'anchor'), row(s.weekly, 'weekly', 'pearl')));
  }
}
