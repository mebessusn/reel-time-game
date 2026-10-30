// Skye's Air Races: the front of house. Skye's race board at both hangars (pick a circuit, a mode, a class, a plane and
// its paint), the loading screen, the race itself (src/air/race.js), the results with medals and rewards, your
// records (best times, best laps, splits, shortcuts found), ghosts, the circuit boards, the paint shop, pilot ranks,
// achievements, and party races over the network (BaseNet events and the 10 Hz state while racing).
//
// Saved in ext.d.air: { medals: { 'circuit:class': 0-4 }, best: { 'circuit:class': { time, lap, splits } },
//   found: { shortcutId: 1 }, paints: { id: 1 }, plane, paint, races, wins, plats, tricks, clean, perfect, hurricane, party }
import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { CIRCUITS, CIRCUIT_BY_ID, CLASSES, MEDALS, medalFor } from './circuits.js';
import { PLANES, PLANE_LIST, PAINTS, PAINT_BY_ID, planeUnlocked } from './planes.js';
import { AirRace, fmtTime } from './race.js';
import { BOARDS } from '../north/boards.js';
import { weekId } from '../core/clock.js';
import { EngineSound } from '../north/frostmere.js';
import { cleanGhost, rankFor } from './records.js';

const CLS_LIST = ['breeze', 'gale', 'hurricane'];
const CLS_MUL = { breeze: 1, gale: 1.3, hurricane: 1.6 };
const MEDAL_ICON = ['', '●', '●', '●', '◆'];
const GHOSTS = 'ar_ghosts';
for (const c of CIRCUITS) for (const k of CLS_LIST) BOARDS[`air_${c.id}_${k}`] = { name: `${c.name} (${CLASSES[k].name})`, unit: 's', high: false };

const clipName = (s) => String(s || '').replace(/[<>]/g, '').slice(0, 20);
const num = (v) => typeof v === 'number' && isFinite(v);

export class AirRaces {
  constructor(north) {
    this.north = north; this.game = north.game;
    this.race = null; this.sound = new EngineSound(this.game.audio);
  }
  get d() { return this.game.ext.d.air || {}; }
  init() {
    this.game.ext.change((d) => { d.air = { medals: {}, best: {}, found: {}, paints: { factory: 1 }, plane: 'snowgoose', paint: 'factory', races: 0, wins: 0, plats: 0, tricks: 0, clean: 0, perfect: 0, hurricane: 0, party: 0, ...(d.air || {}) }; });
    const q = new URLSearchParams(location.search);
    // dev and browser tests: ?air=<circuit> (&airmode=race|trial|practice &aircls=breeze|gale|hurricane &airauto=1)
    if (import.meta.env.DEV && q.has('air')) setTimeout(() => this.devStart(q), 1200);
  }
  devStart(q) {
    const g = this.game; if (g.profile.level < 25) g.profile.level = 25;
    g.ext.change((d) => { d.north.flights = Math.max(1, d.north.flights || 0); });
    const c = CIRCUIT_BY_ID[q.get('air')] || CIRCUITS[0];
    this.start({ circuit: c.id, mode: q.get('airmode') || 'race', cls: q.get('aircls') || 'breeze', plane: q.get('airplane') || this.d.plane || 'snowgoose', paint: this.d.paint || 'factory' }, { auto: q.has('airauto'), cuts: q.has('aircuts') });
  }
  /** Open to you after your first flight north with Skye. */
  get unlocked() { return (this.north.d.flights || 0) >= 1; }

  // ---------------------------------------------------------------- records and unlocks
  medal(cid, cls) { return this.d.medals?.[`${cid}:${cls}`] || 0; }
  medalPoints() { return Object.values(this.d.medals || {}).reduce((a, m) => a + (m || 0), 0); }
  rank() { return rankFor(this.medalPoints()); }
  goldCircuits() { return CIRCUITS.filter((c) => CLS_LIST.some((k) => this.medal(c.id, k) >= 3)).length; }
  circuitOpen(c) {
    if (this.d.testAll) return true; // (the private test build's kit)
    if (c.locked === 'golds11') return CIRCUITS.filter((x) => x.id !== c.id && CLS_LIST.some((k) => this.medal(x.id, k) >= 3)).length >= 11;
    const medals = Object.values(this.d.medals || {}).filter((m) => m > 0).length;
    return c.tier === 1 || (c.tier === 2 && medals >= 2) || (c.tier === 3 && medals >= 6);
  }
  lockText(c) { return c.locked === 'golds11' ? 'Gold on the other eleven' : c.tier === 2 ? 'Win 2 medals' : 'Win 6 medals'; }
  classOpen(cid, cls) { return cls === 'breeze' || !!this.d.testAll || (cls === 'gale' ? this.medal(cid, 'breeze') >= 1 : this.medal(cid, 'gale') >= 1); }
  paintOwned(p) { const P = PAINT_BY_ID[p]; if (!P) return false; if (this.d.testAll) return true; if (P.unlock === 'platinum') return (this.d.plats || 0) > 0; if (P.unlock === 'aurora') return CLS_LIST.some((k) => this.medal('aurora', k) >= 3); return !P.price || !!this.d.paints?.[p]; }
  localGhost(cid, cls) { try { return cleanGhost(JSON.parse(localStorage.getItem(`rt_air_ghost_${cid}_${cls}`) || 'null')); } catch { return null; } }

  /** This week's featured circuit (the same for everyone): double coins for races on it. */
  featured() { const open = CIRCUITS.filter((c) => !c.locked); let hsh = 0; for (const ch of String(weekId())) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; return open[hsh % open.length]; }

  // ---------------------------------------------------------------- Skye's race board
  open(npc = null) {
    const g = this.game;
    if (this.race) return;
    if (!this.unlocked) { g.ui.toast('Fly north with Skye once and she\'ll open her race board to you.', { icon: 'star' }); return; }
    document.querySelector('.air-panel')?.remove();
    const sel = this.sel = this.sel || { circuit: 'firstflight', mode: 'race', cls: 'breeze', plane: this.d.plane || 'snowgoose', paint: this.d.paint || 'factory' };
    if (!planeUnlocked(sel.plane, this.d)) sel.plane = 'snowgoose';
    if (!this.paintOwned(sel.paint)) sel.paint = 'factory';
    const body = h('div');
    const close = () => { el.remove(); window.removeEventListener('keydown', esc, true); };
    const esc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
    const el = h('div.air-panel.plank', { role: 'dialog', 'aria-label': 'Skye\'s Air Races' }, body, h('button.btn.close-x.ghost.on-dark', { 'aria-label': 'Close', on: { click: close } }, icon('close')));
    const party = g.party?.inParty ? g.party : null;
    const render = () => {
      clear(body);
      const c = CIRCUIT_BY_ID[sel.circuit], R = this.rank();
      if (!this.classOpen(c.id, sel.cls)) sel.cls = 'breeze';
      const best = this.d.best?.[`${c.id}:${sel.cls}`];
      const chip = (on, label, fn, dis = false, title = '') => h(`button.ap-chip${on ? '.on' : ''}`, { disabled: dis, title, on: { click: () => { fn(); render(); } } }, label);
      body.append(
        h('div.ap-head', h('div', h('h2', 'Skye\'s Air Races'), h('div.ap-sub', 'Three laps, gates in order, rivals on your tail. Medals earn new planes; Skye\'s paint shop does the rest.')),
          h('div.ap-rank', 'Pilot rank', h('b', R.name), `${R.points} medal points${R.next ? ` · ${R.next.at - R.points} to ${R.next.name}` : ''}`)),
        h('div.ap-label', 'Circuit'),
        ...[[1, 'Easy'], [2, 'Medium'], [3, 'Hard']].flatMap(([tier, tname]) => [h(`div.ap-tier.t${tier}`, tname), h('div.ap-circuits', CIRCUITS.filter((x) => (x.tier || 1) === tier).map((x) => {
          const open = this.circuitOpen(x), md = CLS_LIST.map((k) => this.medal(x.id, k));
          return h(`button.ap-c${x.id === c.id ? '.on' : ''}`, { disabled: !open, title: open ? '' : this.lockText(x), on: { click: () => { sel.circuit = x.id; render(); } } },
            h('span.md', md.map((m) => h(`span.medal-${m}`, m ? MEDAL_ICON[m] : '○'))),
            h('b', x.name, x.id === this.featured().id ? ' ★' : ''), h('small', open ? `${x.kind === 'sky' ? 'Sky' : 'Low level'} · ${x.phase === 'night' ? 'night' : x.weather === 'storm' ? 'storm' : x.phase}` : `Locked: ${this.lockText(x)}`));
        }))]),
        h('div.ap-desc', c.id === this.featured().id ? h('div.ap-small', '★ This week\'s featured circuit: double coins for racing it.') : null, c.desc, best ? h('div.ap-small', `Your best (${CLASSES[sel.cls].name}): ${fmtTime(best.time)} · best lap ${fmtTime(best.lap)}`) : null,
          c.shortcuts.length ? h('div.ap-small', `Shortcuts found: ${c.shortcuts.filter((s) => this.d.found?.[s.id]).length}/${c.shortcuts.length}`) : null),
        h('div.ap-label', 'Mode'),
        h('div.ap-row', chip(sel.mode === 'race', 'Race (3 rivals)', () => { sel.mode = 'race'; }), chip(sel.mode === 'trial', 'Time trial (ghosts)', () => { sel.mode = 'trial'; }), chip(sel.mode === 'practice', 'Practice', () => { sel.mode = 'practice'; })),
        h('div.ap-label', 'Class'),
        h('div.ap-row', CLS_LIST.map((k) => chip(sel.cls === k, `${CLASSES[k].name}${k !== 'breeze' ? (k === 'gale' ? ' (faster, rivals use shortcuts)' : ' (fastest, more hazards)') : ''}`, () => { sel.cls = k; }, !this.classOpen(c.id, k), k === 'gale' ? 'A medal on Breeze opens Gale' : 'A medal on Gale opens Hurricane'))),
        h('div.ap-label', 'Plane'),
        h('div.ap-row', PLANE_LIST.map((P) => { const ok = planeUnlocked(P.id, this.d); return chip(sel.plane === P.id, ok ? P.name : `${P.name} (${P.unlock.text})`, () => { sel.plane = P.id; }, !ok, P.desc); })),
        h('div.ap-small', PLANES[sel.plane].desc),
        h('div.ap-label', 'Paint'),
        h('div.ap-row', PAINTS.filter((p) => this.paintOwned(p.id)).map((p) => chip(sel.paint === p.id, p.name, () => { sel.paint = p.id; }))),
        h('div.ap-go',
          h('button.btn.ghost', { on: { click: () => { close(); this.paintShop(); } } }, icon('shop'), 'Paint shop'),
          h('button.btn.ghost', { on: { click: () => { close(); this.showBoard(c.id, sel.cls); } } }, 'Best times'),
          party && sel.mode === 'race' ? h('button.btn.blue', { disabled: !party.isLeader, title: party.isLeader ? '' : 'The party leader starts party races', on: { click: () => { close(); this.startParty({ ...sel }); } } }, icon('users'), 'Race with the party') : null,
          h('button.btn.gold', { on: { click: () => { close(); this.start({ ...sel }); } } }, icon('play'), sel.mode === 'race' ? 'Race!' : sel.mode === 'trial' ? 'Start the clock' : 'Fly')));
    };
    render();
    g.ui.root.append(el);
    window.addEventListener('keydown', esc, true);
    void npc;
  }
  paintShop() {
    const g = this.game;
    import('../north/shop.js').then(({ openShop }) => openShop(g, {
      title: 'Skye\'s Paint Shop', sub: 'Paint jobs for every plane', text: 'A fresh coat for your planes. Two more come with medals: Aurora (gold on the Aurora Loop) and Gold Leaf (a platinum medal).',
      items: () => PAINTS.filter((p) => p.price).map((p) => ({ id: p.id, name: p.name, what: 'Paint and trim for all your planes', price: { coins: p.price }, owned: !!this.d.paints?.[p.id], buy: () => this.buyPaint(p) })),
    }));
  }
  async buyPaint(p) {
    const g = this.game, r = await g.save.spend('airpaint', p.id, { coins: p.price });
    if (!r?.ok) { g.ui.toast(r?.reason || 'Not enough coins.'); return false; }
    g.ext.change((d) => { d.air.paints = { ...(d.air.paints || {}), [p.id]: 1 }; });
    g.audio.sfx('purchase'); g.ui.refresh?.(); g.ui.toast(`${p.name} paint! Pick it on Skye's race board.`, { icon: 'coin' });
    return true;
  }
  showBoard(cid, cls) {
    const B = this.north.boards; B.watch();
    const key = `air_${cid}_${cls}`;
    setTimeout(() => {
      B.show(key);
      const sub = document.querySelector('.fm-board .fm-board-sub'); if (sub) sub.textContent = `Fastest race (3 laps) · ${CLASSES[cls].name} class`;
    }, 120);
  }

  // ---------------------------------------------------------------- racing
  /** Start a race: sel { circuit, mode, cls, plane, paint }; party: { rid, host, hostId, grid, start } for party races. */
  async start(sel, opt = {}) {
    const g = this.game, N = this.north;
    if (this.race || N.trip) return;
    const c = CIRCUIT_BY_ID[sel.circuit]; if (!c) return;
    if (g.fishing?.busy) g.fishing.cancel();
    if (g.chairs?.seat) g.chairs.stand();
    if (g.bikes?.riding) g.bikes.dismount();
    g.ui.closeAll?.();
    g.ext.change((d) => { d.air.plane = sel.plane; d.air.paint = sel.paint; });
    this.sel = { ...sel, mode: sel.mode, cls: sel.cls };
    const load = h('div.air-load', h('div', `${c.name}`, h('small', opt.party ? 'Party race! Skye\'s fuelling everyone up...' : 'Skye\'s fuelling up the plane...'), h('i', h('b'))));
    g.ui.root.append(load);
    const best = this.d.best?.[`${c.id}:${sel.cls}`];
    const ghosts = [];
    if (sel.mode === 'trial') {
      const mine = this.localGhost(c.id, sel.cls); if (mine) ghosts.push({ ...mine, name: 'Your best lap' });
      try { const docs = await g.shared?.find(GHOSTS, 'key', `${c.id}_${sel.cls}`, 3); const top = (docs || []).map(cleanGhost).filter(Boolean).sort((a, b) => a.lap - b.lap)[0]; if (top && (!mine || top.lap < mine.lap - 0.01)) ghosts.push({ ...top, name: `${top.name}'s record` }); } catch { /* offline: just yours */ }
    }
    const P = opt.party;
    const me = { id: g.save.userId || 'me', name: g.profile.name || 'You', me: true, human: true, plane: sel.plane, paint: sel.paint };
    const grid = P ? P.grid.map((id) => (id === me.id ? me : { id, name: g.party?.nameOf(id) || 'An angler', human: true, plane: 'snowgoose', paint: 'factory' })) : [me];
    const race = new AirRace(g, {
      circuit: c, mode: sel.mode, cls: sel.cls, plane: sel.plane, paint: sel.paint, grid, seed: P ? P.seed : (Date.now() % 100000), rid: P ? P.rid : `solo${Date.now()}`,
      host: P ? P.host : true, hostId: P?.hostId, party: !!P, start: P ? P.start : 0, ghosts, found: { ...(this.d.found || {}) },
      bestSplits: best?.splits, bestLap: best?.lap,
      peerState: (id) => g.party?.peerById?.(id)?.peer?.state?.ar || null,
      onFinish: (res) => this.finished(res), onQuit: () => this.leave(),
    });
    race.auto = !!opt.auto; race.autoCuts = !!opt.cuts;
    this.race = race;
    N.hidePlayer(true);
    try {
      await race.build((k) => { const b = load.querySelector('i b'); if (b) b.style.width = `${Math.round(k * 100)}%`; });
    } catch (e) {
      console.error('[air] build', e); load.remove(); this.race = null; N.hidePlayer(false); g.ui.toast('The race couldn\'t start. Try another circuit?'); return;
    }
    if (!P) race.opts.start = Date.now() + 4200;
    g.engine.overlay = race;
    this.sound.start(); this.sound.set(0.5);
    setTimeout(() => load.remove(), 150);
    g.pushMeta?.();
    return race;
  }
  /** Leave the race (quit, or done with the results). */
  leave() {
    const g = this.game, R = this.race; if (!R) return;
    document.querySelector('.air-panel')?.remove();
    if (g.engine.overlay === R) g.engine.overlay = null;
    R.dispose(); this.race = null;
    this.sound.stop(); this.sound = new EngineSound(g.audio);
    this.north.hidePlayer(false);
    g.pushMeta?.();
  }
  /** True while racing: the race has the controls. */
  get racing() { return !!this.race; }
  stateExtra() { const o = this.race?.stateExtra(); return o ? { ar: o } : null; }
  update(dt) {
    this.subscribe();
    if (this.race?.ready) { const f = this.race.me.f; this.sound.set(Math.min(1, 0.45 + f.throttle * 0.55)); }
  }

  // ---------------------------------------------------------------- the results
  async finished(res) {
    const g = this.game, c = CIRCUIT_BY_ID[res.circuit], key = `${res.circuit}:${res.cls}`, d0 = this.d;
    const lines = [];
    const old = this.medal(res.circuit, res.cls), platsBefore = d0.plats || 0, foundBefore = { ...(d0.found || {}) };
    const planesBefore = new Set(PLANE_LIST.filter((P) => planeUnlocked(P.id, d0)).map((P) => P.id));
    let medal = 0;
    // records: best time (races), best lap and splits (any timed mode), shortcuts found
    const best = d0.best?.[key] || {};
    const newBest = res.mode !== 'practice' && res.time && (!best.time || res.time < best.time) && res.mode === 'race';
    const newLap = res.bestLap && (!best.lap || res.bestLap < best.lap);
    if (res.mode === 'race') medal = medalFor(c, res.cls, res.time, res.place);
    g.ext.change((d) => {
      const A = d.air; A.best = A.best || {}; A.medals = A.medals || {}; A.found = A.found || {};
      const b = { ...(A.best[key] || {}) };
      if (newBest) b.time = +res.time.toFixed(2);
      if (newLap) { b.lap = +res.bestLap.toFixed(2); if (res.splits?.length >= 2) b.splits = res.splits.slice(0, 3).map((x) => +(+x).toFixed(2)); }
      A.best[key] = b;
      if (medal > (A.medals[key] || 0)) A.medals[key] = medal;
      for (const id of res.cuts || []) A.found[id] = 1;
      if (res.mode === 'race') { A.races = (A.races || 0) + 1; if (res.place === 1) A.wins = (A.wins || 0) + 1; if (res.place === 1 && res.cls === 'hurricane') A.hurricane = (A.hurricane || 0) + 1; if (res.rid && !String(res.rid).startsWith('solo')) A.party = (A.party || 0) + 1; }
      if (medal === 4) A.plats = (A.plats || 0) + 1;
      A.tricks = (A.tricks || 0) + (res.tricks || 0);
      if (res.mode === 'race' && !res.crashes && !res.missed) A.clean = (A.clean || 0) + 1;
      if (res.perfect) A.perfect = (A.perfect || 0) + 1;
    });
    // rewards: by place, circuit tier and class; and a bonus for each new, better medal
    const mul = (1 + 0.25 * ((c.tier || 1) - 1)) * (CLS_MUL[res.cls] || 1), feat = res.circuit === this.featured().id ? 2 : 1;
    if (res.mode === 'race' && res.place) {
      const coins = Math.round([80, 50, 30, 15][Math.min(3, res.place - 1)] * mul * feat), xp = Math.round([60, 40, 30, 20][Math.min(3, res.place - 1)] * mul);
      g.reward('air', `${res.rid}`, { coins, xp }, `${c.name}: ${ordinal(res.place)} place`);
      lines.push(`+${coins} coins, +${xp} XP${feat > 1 ? ' (double coins: this week\'s featured circuit)' : ''}`);
    } else if (res.mode === 'trial' && newLap) { const xp = Math.round(40 * mul); g.reward('air', `${res.rid}`, { xp }, 'A new best lap'); lines.push(`New best lap! +${xp} XP`); }
    if (medal > old) {
      const coins = Math.round((medal - old) * 100 * mul), xp = Math.round((medal - old) * 60 * mul);
      setTimeout(() => g.reward('air', `medal-${key}-${medal}`, { coins, xp }, `${MEDALS[medal]} medal: ${c.name}`), 900);
      lines.push(`${MEDALS[medal]} medal! +${coins} coins`);
      if (medal === 4 && !platsBefore) lines.push('Platinum! Skye paints you a Gold Leaf scheme.');
      if (res.circuit === 'aurora' && medal >= 3 && old < 3) lines.push('The Aurora paint is yours.');
      for (const P of PLANE_LIST) if (!planesBefore.has(P.id) && planeUnlocked(P.id, this.d)) lines.push(`New plane: the ${P.name}! Pick it on the race board.`);
    }
    for (const id of res.cuts || []) if (!foundBefore[id]) { const s = c.shortcuts.find((x) => x.id === id); if (s) lines.push(`Shortcut found: ${s.name}`); }
    if (newBest) lines.push(`New best time: ${fmtTime(res.time)}`);
    // the boards and the ghosts
    if (res.mode === 'race' && res.time) this.north.boards?.post(`air_${res.circuit}_${res.cls}`, res.time).catch?.(() => {});
    if (res.ghost && res.ghost.samples?.length > 4) this.saveGhost(res, key);
    this.syncStats();
    this.showResults(res, medal, lines);
  }
  saveGhost(res, key) {
    const g = this.game, gh = { name: g.profile.name, lap: +res.ghost.lap.toFixed(2), plane: res.plane, s: res.ghost.samples };
    const [cid, cls] = key.split(':');
    const mine = this.localGhost(cid, cls);
    if (!mine || gh.lap < mine.lap) { try { localStorage.setItem(`rt_air_ghost_${cid}_${cls}`, JSON.stringify(gh)); } catch { /* full or private: no ghost */ } }
    // the board's ghost: one per circuit and class, the fastest lap anyone's flown
    g.shared?.find(GHOSTS, 'key', `${cid}_${cls}`, 3).then((docs) => {
      const top = (docs || []).map(cleanGhost).filter(Boolean).sort((a, b) => a.lap - b.lap)[0];
      if (!top || gh.lap < top.lap) g.shared.set(GHOSTS, `${cid}_${cls}`, { key: `${cid}_${cls}`, ...gh, at: Date.now() });
    }).catch(() => {});
  }
  showResults(res, medal, lines) {
    const g = this.game, c = CIRCUIT_BY_ID[res.circuit];
    document.querySelector('.air-panel')?.remove();
    const party = res.rid && !String(res.rid).startsWith('solo');
    const el = h('div.air-panel.plank.air-results', { role: 'dialog', 'aria-label': 'Race results' },
      h('h2', res.mode === 'race' ? (res.place === 1 ? 'You won!' : `${ordinal(res.place)} place`) : res.mode === 'trial' ? 'Time trial' : 'Practice'),
      h('div.ap-sub', `${c.name} · ${CLASSES[res.cls].name} class`),
      res.mode === 'race' ? h('table', res.rows.map((r) => h(`tr${r.me ? '.me' : ''}`, h('td', `${r.place}`), h('td', clipName(r.name)), h('td', PLANES[r.plane]?.name || ''), h('td', `${fmtTime(r.time)}${r.est ? ' (est.)' : ''}${r.pen ? ` incl. +${r.pen}s` : ''}`)))) : null,
      res.laps.length ? h('div.ap-small', `Laps: ${res.laps.map(fmtTime).join(' · ')}${res.pen ? ` · penalties +${res.pen}s` : ''}`) : null,
      h(`div.ap-medal.medal-${medal}`, medal ? `${MEDAL_ICON[medal]} ${MEDALS[medal]} medal` : res.mode === 'race' ? 'No medal this time: beat the par time and finish higher up.' : ''),
      lines.length ? h('div', lines.map((l) => h('div', l))) : null,
      h('div.ap-small', `${res.tricks} tricks · ${res.nearMisses} near misses · ${res.crashes} crashes · ${res.missed} missed gates${res.strikes ? ` · ${res.strikes} bird strikes` : ''}`),
      h('div.ap-go',
        h('button.btn.ghost', { on: { click: () => { this.leave(); setTimeout(() => this.open(), 200); } } }, 'Race board'),
        !party ? h('button.btn.blue', { on: { click: () => { this.leave(); setTimeout(() => this.start(this.sel), 250); } } }, 'Race again') : null,
        h('button.btn.gold', { on: { click: () => this.leave() } }, 'Back to the hangar')));
    g.ui.root.append(el);
    if (res.mode === 'race' && res.place === 1) g.audio.sfx('cheer');
  }
  async syncStats() {
    const g = this.game, d = this.d;
    const golds = Object.values(d.medals || {}).filter((m) => m >= 3).length;
    const map = { arRaces: d.races || 0, arWins: d.wins || 0, arGolds: golds, arGoldCircuits: this.goldCircuits(), arPlat: d.plats || 0, arCuts: Object.keys(d.found || {}).length, arTricks: d.tricks || 0, arClean: d.clean || 0, arHurricane: d.hurricane || 0, arParty: d.party || 0, arPerfect: d.perfect || 0 };
    try { await g.save.setOceanStats?.(map); await g.autoClaim?.(); } catch (e) { console.warn('[air] stats', e); }
  }

  // ---------------------------------------------------------------- party races
  subscribe() {
    const net = this.game.net;
    if (!net || this.subscribed === net) return;
    this.subscribed = net;
    net.on('ev:airrace', ({ data, peer }) => this.invited(data, peer));
  }
  /** The party leader starts a race for the whole party: every member gets an invite; the rivals fill the grid to four. */
  startParty(sel) {
    const g = this.game, P = g.party;
    if (!P?.inParty || !P.isLeader) return;
    const rid = `pr${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
    const grid = P.members().slice(0, 8), start = Date.now() + 10000, seed = Math.floor(Math.random() * 1e5);
    g.net?.emitEvent?.('airrace', { rid, c: sel.circuit, cls: sel.cls, start, host: g.save.userId, grid, seed, pty: P.state?.id });
    g.chat?.system?.(`You started a party air race: ${CIRCUIT_BY_ID[sel.circuit].name}.`, 'info');
    this.start({ ...sel, mode: 'race' }, { party: { rid, host: true, hostId: g.save.userId, grid, start, seed } });
  }
  invited(data, peer) {
    const g = this.game, P = g.party;
    if (!data || typeof data !== 'object' || !P?.inParty) return;
    const host = peer?.meta?.id;
    if (!host || host !== data.host || P.state?.ld !== host || !P.state.m.includes(host)) return;
    const c = CIRCUIT_BY_ID[data.c]; if (!c || !CLASSES[data.cls] || !Array.isArray(data.grid) || !data.grid.includes(g.save.userId) || data.grid.length > 8) return;
    if (!num(data.start) || Math.abs(data.start - Date.now()) > 120000 || !num(data.seed)) return;
    if (this.race || this.north.trip) { g.ui.toast(`${P.nameOf(host)} started a party air race (you're busy).`); return; }
    const grid = data.grid.filter((id) => typeof id === 'string' && id.length < 80);
    const go = () => this.start({ circuit: c.id, mode: 'race', cls: data.cls, plane: planeUnlocked(this.d.plane, this.d) ? this.d.plane : 'snowgoose', paint: this.paintOwned(this.d.paint) ? this.d.paint : 'factory' }, { party: { rid: String(data.rid).slice(0, 40), host: false, hostId: host, grid, start: data.start, seed: data.seed } });
    if (!this.unlocked) { g.ui.toast(`${P.nameOf(host)} started a party air race. Fly north with Skye once to join her races.`); return; }
    g.dialogue.open({ npc: this.north.bases?.skye, title: 'Party air race', text: `${P.nameOf(host)} is starting a party air race on ${c.name} (${CLASSES[data.cls].name} class). The flag drops in a few seconds!`, choices: [{ label: 'Race!', primary: true, fn: go }, { label: 'Sit this one out' }] });
  }
}

const ordinal = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
