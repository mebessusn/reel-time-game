// Open Waters v1.15.9 "Fish On": three things around a trip.
// - Fish on! When Claude finishes your prompt while you're aboard, Marlowe shouts it and the golden answer fish is a
//   big-game fish (fishing.answerBite asks bigAnswer()). The news and the reward caps stay game.answerReady's.
// - The trip report: every charter keeps a log (fish, what they're worth, the best fight, spearfishing, beach games,
//   whales), and heading home shows a card: worth against the fee, the best fight and a snapshot taken when your
//   heaviest fish came aboard. Save or copy it like a selfie (it goes in the photo album too).
// - The first-trip lesson: on your free first charter Marlowe walks you through it step by step (the chart, a cast, the
//   chair, the gaff, a dive, back aboard). His first fish for you is a mahi, the starter big-game fish. Skip it any
//   time; "Show me the ropes" at the pier runs it again on your next trip.
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { SPECIES_BY_ID, tierOf, TIER_INFO } from '../data/species.js';
import { catchValue } from '../game/rules.js';
import { album, savePhoto, copyPhoto } from '../ui/selfie.js';

import { LESSON, LESSON_IDX, STARTER, tripSummary } from './voyageData.js';
export { LESSON, tripSummary };
const SNAP_W = 480, SNAP_H = 270;

export class Voyage {
  constructor(game, ow) {
    this.game = game; this.ow = ow;
    this.log = null;
    this.lesson = null; // { i, said } while the first-trip lesson runs
    this.el = null;
    this.t = 0;
  }
  get o() { return this.game.ext.d.ocean || {}; }

  // ---------------------------------------------------------------- the trip log
  start(fee) {
    const o = this.o;
    this.log = { start: Date.now(), fee: fee || 0, fish: [], best: null, speared: 0, games: [], w0: o.whales || 0, d0: o.dolphins || 0, snap: null, snapW: 0 };
    // the lesson: on the free first trip, or when asked for at the pier
    if ((!o.lessonDone && !(o.trips > 0) && !this.ow.noLesson) || o.lessonAgain) {
      this.game.ext.change((d) => { d.ocean.lessonAgain = false; });
      this.lesson = { i: 0, said: -1, at: performance.now() };
    } else this.lesson = null;
  }
  onCatch(c, sp, L) {
    const log = this.log;
    if (!log || !sp) return;
    const big = !!sp.big;
    log.fish.push({ sp: sp.id, w: c.weight, v: c.variant || 'normal', big, val: catchValue(sp.id, c.variant, c.weight), speared: !!c.speared });
    if (L && big && (!log.best || L.secs > log.best.secs)) log.best = { sp: sp.id, w: c.weight, secs: L.secs, runs: L.runs || 0 };
    if (c.weight > log.snapW) { log.snapW = c.weight; setTimeout(() => this.snap(), 900); } // the heaviest fish, held up on deck
    if (this.lesson && big) this.mark('gaff');
  }
  onSpear() { if (this.log) this.log.speared++; }
  onGame(name, won, coins) { if (this.log) this.log.games.push({ name, won: !!won, coins: coins || 0 }); }

  /** A small snapshot of the scene right now (the renderer doesn't keep its buffer, so render, then copy). */
  snap() {
    const log = this.log, eng = this.game.engine;
    if (!log || !eng?.renderer) return;
    try {
      eng.renderer.render(eng.scene, eng.camera);
      const src = eng.renderer.domElement;
      const c = document.createElement('canvas'); c.width = SNAP_W; c.height = SNAP_H;
      const k = Math.min(src.width / SNAP_W, src.height / SNAP_H);
      const sw = SNAP_W * k, sh = SNAP_H * k;
      c.getContext('2d').drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, SNAP_W, SNAP_H);
      log.snap = c.toDataURL('image/jpeg', 0.82);
    } catch (e) { console.warn('[open waters] trip snapshot', e); }
  }

  /** Heading home: close the log and show the report (if anything happened). */
  finish() {
    const log = this.log;
    this.log = null;
    this.endLesson(false);
    if (!log) return;
    const o = this.o;
    log.end = Date.now(); log.whales = Math.max(0, (o.whales || 0) - log.w0); log.dolphins = Math.max(0, (o.dolphins || 0) - log.d0);
    this.last = log;
    const S = tripSummary(log);
    this.ow.addTrust?.(S); // v1.15.12: Marlowe's trust grows with every good trip
    // v1.15.13: a live well aboard your own boat keeps the catch fresh: 15% of its worth on top, paid as you dock
    if (this.ow.charter?.bt?.up?.livewell && S.worth > 0) { log.livewell = Math.round(S.worth * 0.15); this.game.reward?.('livewell', `lw${log.start}`, { coins: log.livewell }, 'Live well'); }
    this.game.ext.change((d) => {
      d.ocean.reports = [...(d.ocean.reports || []), { at: log.end, n: S.n, worth: S.worth + S.prizes, fee: S.fee, best: S.best?.sp || null }].slice(-20);
    });
    setTimeout(() => this.reportCard(log), 1300);
  }

  reportCard(log) {
    const g = this.game, S = tripSummary(log), ui = this.ow.ui;
    const name = (id) => SPECIES_BY_ID[id]?.name || 'fish';
    const counts = {};
    for (const f of log.fish) counts[f.sp] = (counts[f.sp] || 0) + 1;
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => {
      const sp = SPECIES_BY_ID[id], t = TIER_INFO[tierOf(sp)];
      return h('li.ow-rep-fish', h('b', `${n}× ${sp?.name || id}`), h('small', { style: { color: t?.color } }, t?.name || ''));
    });
    const mm = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
    const verdict = !S.n && !S.games.length ? 'Quiet one. The sea\'s like that some days.'
      : S.fee === 0 ? 'Your first trip was on the house, so every fish is profit.'
      : S.net >= 0 ? `That trip paid for itself, with ${S.net.toLocaleString()} coins to spare.`
      : `The fish didn't quite cover the fee this time (${Math.abs(S.net).toLocaleString()} short). The big ones pay best.`;
    const photo = { id: `trip${log.start.toString(36)}`, url: null, ts: log.end, caption: '' };
    const kids = [
      h('div.ow-head', h('span.ow-badge', icon('anchor')), h('div', h('b', 'Trip report'), h('span', `${S.mins} min at sea with Captain Marlowe`))),
      log.snap ? h('img.ow-rep-snap', { src: log.snap, alt: 'Your heaviest catch, on deck' }) : null,
      h('div.ow-rep-nums',
        h('div', h('b', String(S.n)), h('small', S.n === 1 ? 'fish' : 'fish')),
        h('div', h('b', String(S.trophies)), h('small', 'trophy')),
        h('div', h('b', (S.worth + S.prizes).toLocaleString()), h('small', 'coins worth')),
        h('div', h('b', S.fee ? `-${S.fee.toLocaleString()}` : 'free'), h('small', 'charter fee'))),
      h(`p.ow-rep-verdict${S.net >= 0 || !S.fee ? '.up' : '.down'}`, verdict),
      log.livewell ? h('p.ow-note', icon('coin'), ` Live well: +${log.livewell.toLocaleString()} coins for a fresh catch.`) : null,
      S.best ? h('p.ow-note', icon('fish'), ` Best fight: a ${Math.round(S.best.w)} lb ${name(S.best.sp)}, ${mm(S.best.secs)}${S.best.runs ? ` and ${S.best.runs} run${S.best.runs > 1 ? 's' : ''}` : ''}.`) : null,
      rows.length ? h('ul.ow-rep-list', rows) : null,
      S.speared || S.games.length || S.whales || S.dolphins ? h('p.ow-note', [
        S.speared ? `${S.speared} speared` : null,
        S.games.length ? `${S.games.filter((x) => x.won).length}/${S.games.length} beach games won` : null,
        S.whales ? `${S.whales} whale${S.whales > 1 ? 's' : ''} spotted` : null,
        S.dolphins ? `${S.dolphins} dolphin pod${S.dolphins > 1 ? 's' : ''}` : null,
      ].filter(Boolean).join(' · ')) : null,
      h('p.ow-note.dim', 'Coins worth is what the shop pays for these fish. Sell them there as usual.'),
      h('div.ow-acts',
        h('button.btn.green', { on: { click: async (e) => { photo.url = photo.url || this.card(log, S); const r = await savePhoto(photo); e.currentTarget.textContent = r === 'saved' ? 'Saved!' : 'Couldn\'t save'; } } }, icon('down'), 'Save card'),
        h('button.btn.blue', { on: { click: async (e) => { photo.url = photo.url || this.card(log, S); const ok = await copyPhoto(photo).catch(() => false); e.currentTarget.textContent = ok !== false ? 'Copied!' : 'Couldn\'t copy'; } } }, icon('copy'), 'Copy'),
        h('button.btn.ghost.on-dark', { on: { click: () => ui.closeModal() } }, 'Done')),
    ].filter(Boolean);
    // wait for any catch card or dialogue to clear first
    const show = (tries = 0) => {
      if ((g.ui.modalOpen || ui.modal || g.ui.revealCard?.isConnected) && tries < 40) { setTimeout(() => show(tries + 1), 500); return; }
      ui.openModal('ow-report-card', ...kids);
      g.audio.sfx('reveal', { tier: 'rare' });
      try { photo.url = this.card(log, S); photo.caption = `Trip report: ${S.n} fish`; album.add({ ...photo }); } catch (e) { console.warn('[open waters] report card', e); }
    };
    show();
  }

  /** The report as a picture (a postcard): snapshot on top, the numbers underneath. Returns a data: URL. */
  card(log, S) {
    const W = 640, H = log.snap ? 640 : 340, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#f2ead8'; x.fillRect(0, 0, W, H);
    let y = 24;
    if (log.snap) {
      const img = new Image(); img.src = log.snap;
      try { x.drawImage(img, 24, 24, W - 48, (W - 48) * SNAP_H / SNAP_W); } catch { /* not decoded yet: just the text */ }
      y = 24 + (W - 48) * SNAP_H / SNAP_W + 18;
    }
    x.fillStyle = '#16505a'; x.textAlign = 'center';
    x.font = '800 32px Nunito, system-ui, sans-serif';
    x.fillText(`${this.game.profile.name}'s trip to Open Waters`, W / 2, y + 30, W - 40);
    x.font = '700 22px Nunito, system-ui, sans-serif'; x.fillStyle = '#4a4036';
    const line = `${S.n} fish · ${S.trophies} trophy · ${(S.worth + S.prizes).toLocaleString()} coins worth${S.fee ? ` · fee ${S.fee.toLocaleString()}` : ''}`;
    x.fillText(line, W / 2, y + 68, W - 40);
    if (S.best) x.fillText(`Best fight: ${Math.round(S.best.w)} lb ${SPECIES_BY_ID[S.best.sp]?.name || ''}`, W / 2, y + 100, W - 40);
    else if (S.heaviest) x.fillText(`Heaviest: ${S.heaviest.w.toFixed(1)} lb ${SPECIES_BY_ID[S.heaviest.sp]?.name || ''}`, W / 2, y + 100, W - 40);
    x.font = '16px Silkscreen, monospace'; x.fillStyle = '#b8a888';
    x.fillText(`REEL TIME · ${new Date(log.end || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`, W / 2, H - 20);
    return c.toDataURL('image/jpeg', 0.86);
  }

  // ---------------------------------------------------------------- the first-trip lesson
  mark(id) {
    const L = this.lesson;
    if (!L) return;
    const k = LESSON_IDX[id];
    if (k == null || k < L.i) return;
    L.i = k + 1;
    this.game.audio.sfx('pop');
    if (L.i >= LESSON.length) this.endLesson(true);
  }
  endLesson(done) {
    const g = this.game, L = this.lesson;
    if (!L) return;
    this.lesson = null;
    this.el?.remove(); this.el = null;
    g.ext.change((d) => { d.ocean.lessonDone = Date.now(); });
    if (done) {
      g.chat.npcSay?.('Captain Marlowe', 'That\'s the lot! You\'re a proper deckhand now. Sail anywhere on the chart, and the islands are worth a wander.');
      g.reward?.('lesson', 'ow-lesson', { coins: 250, xp: 60 }, 'Marlowe\'s lesson');
    }
  }
  skipLesson() { this.endLesson(false); this.game.ui.toast('Lesson skipped. Ask Marlowe at the pier to show you the ropes again.', { icon: 'anchor' }); }

  /** Is the lesson waiting on your first cast? Then the first bite is Marlowe's mahi, small enough to learn on. */
  lessonBite() {
    const L = this.lesson;
    if (!L || L.i > LESSON_IDX.chair || L.fish) return null;
    const sp = SPECIES_BY_ID[STARTER];
    if (!sp) return null;
    L.fish = true;
    return { kind: 'fish', speciesId: STARTER, variant: 'normal', weight: Math.round((sp.weight[0] + (sp.weight[1] - sp.weight[0]) * 0.15) * 100) / 100 };
  }

  update(dt) {
    const g = this.game, ow = this.ow, L = this.lesson;
    this.t -= dt;
    if (!L || !ow.charter || !ow.atSea) { if (this.el && !L) { this.el.remove(); this.el = null; } return; }
    if (this.t > 0) return;
    this.t = 0.4;
    const st = g.fishing.state;
    if (L.i === LESSON_IDX.cast && ['waiting', 'nibble', 'bite', 'reeling'].includes(st)) this.mark('cast');
    if (L.i <= LESSON_IDX.chair && ow.fight.active) { if (L.i < LESSON_IDX.chair) L.i = LESSON_IDX.chair; this.mark('chair'); }
    if (L.i === LESSON_IDX.dive && ow.dive.on) this.mark('dive');
    if (L.i === LESSON_IDX.aboard && !ow.dive.on && ow.boat.deckY(g.player.pos.x, g.player.pos.z) != null) this.mark('aboard');
    if (!this.lesson) return;
    if (L.said !== L.i && !g.ui.modalOpen) { L.said = L.i; g.chat.npcSay?.('Captain Marlowe', LESSON[L.i].say); }
    this.render();
  }
  render() {
    const L = this.lesson, g = this.game;
    if (!this.el) {
      this.el = h('div.ow-lesson', h('div.ow-lesson-top', h('b', 'Marlowe\'s lesson'), h('button.btn.small.ghost.on-dark', { on: { click: () => this.skipLesson() } }, 'Skip')), h('ol'));
      g.ui.root.append(this.el);
    }
    const ol = this.el.querySelector('ol');
    const key = String(L.i);
    if (ol.dataset.k === key) return;
    ol.dataset.k = key;
    ol.replaceChildren(...LESSON.map((s, i) => h(`li${i < L.i ? '.done' : i === L.i ? '.now' : ''}`, i < L.i ? icon('check') : h('i', String(i + 1)), h('span', s.hint))));
  }

  // ---------------------------------------------------------------- Claude: fish on!
  /** Your answer is ready while you're aboard: Marlowe calls it and the golden fish is a big one. */
  fishOn() {
    const g = this.game, ow = this.ow;
    if (!ow.charter || !ow.atSea) return false;
    const aboard = ow.boat.deckY(g.player.pos.x, g.player.pos.z) != null;
    this.bigAnswer = aboard;
    g.audio.sfx('run');
    g.juice?.pop('FISH ON!', { color: '#ffd060', size: 44, ms: 1600 });
    const lines = aboard
      ? ['FISH ON! Something golden just hit the long line. Grab a rod and get a lure out there!', 'There goes the reel! A golden one, and it\'s big. Cast, cast!', 'Look at that boil off the stern! Golden fish, big as a door. Get a line in!']
      : ['Fish on! A golden one just boiled off the beach. Get a line in the water!'];
    g.chat.npcSay?.('Captain Marlowe', lines[Math.floor(Math.random() * lines.length)]);
    return true;
  }
  /** fishing.answerBite: should the golden fish be a big-game fish? (Once.) */
  takeBigAnswer() { const b = !!this.bigAnswer && this.ow.atSea; this.bigAnswer = false; return b; }
}
