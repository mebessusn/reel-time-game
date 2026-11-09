// v1.17.15 the ending moment. When every primary quest line is finished (every line registered in src/data/saga.js, so the
// Five Lakes edition counts only its own), the townsfolk write you a letter, leave a trophy in your cabin and put on a
// fireworks night over Cozy Cove. It happens once: ext.saga.finale keeps when (at), whether you've read the letter (read)
// and whether the fireworks have been (fw). A save that had already finished everything gets it on its next load, quietly:
// the letter waits on the notice board, the trophy is in the cabin, and the fireworks come the next night.
// Everything here is on your screen alone; nothing goes over the network.
import * as THREE from 'three';
import { SAGA } from '../data/saga.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { WATER_Y } from '../world/terrain.js';

export const FINALE_DECOR = 'trophy_saga';
const SHOW_SECS = 80; // how long the fireworks night lasts
const COLORS = ['#ff6a8a', '#f2c040', '#8ae0ff', '#a0f080', '#d8a0ff', '#ffffff', '#ff9a40'];

/** Pure: has this saga state finished every line? (Needs at least one line.) */
export function sagaComplete(saga, lines = SAGA) { return lines.length > 0 && lines.every((L) => !!saga?.lines?.[L.id]?.done); }

/** Pure: the letter's words, from the lines and the angler's name. Each finished line's `thanks` ({ who, text }) adds a note. */
export function letterText(name, lines = SAGA, fireworks = true) {
  const notes = lines.filter((L) => L.thanks).map((L) => ({ who: L.thanks.who || L.giver?.name, text: L.thanks.text }));
  const names = [...new Set(lines.flatMap((L) => [L.giver?.name, L.thanks?.who]).filter(Boolean))];
  return {
    to: `Dear ${name || 'friend'},`,
    open: `Word gets round on the water. Every story we asked you to help with is finished, and not one of us could have done it without you. So we have all put our names to this.`,
    notes,
    close: `${fireworks ? 'Look out over Cozy Cove when it gets dark: the sky is yours tonight. ' : ''}And mind your cabin floor. We left you something to remember us by.`,
    sign: 'With love, from all your friends on the water',
    names,
  };
}

export class Finale {
  constructor(game) { this.game = game; this.show = 0; this.next = 0; this.letterAt = 0; }
  get d() { return this.game.ext.d.saga?.finale || null; }
  /** At start: a save that already finished everything gets its ending now, quietly. */
  init() { this.check(false); }
  /** Grant the ending if it's due. live: you just finished the last line (the letter opens once the moment's toasts are done). */
  check(live = false) {
    const g = this.game;
    if (this.d || !sagaComplete(g.ext.d.saga)) return false;
    g.ext.change((d) => {
      d.saga.finale = { at: Date.now(), read: 0, fw: 0 };
      const H = d.home; H.owned = [...new Set([...(H.owned || []), FINALE_DECOR])]; if (!H.decor.includes(FINALE_DECOR)) H.decor.push(FINALE_DECOR);
    });
    g.ext.bump?.('sagaFinale');
    if (g.home?.active) g.home.rebuild?.();
    if (live) this.letterAt = performance.now() + 7000;
    else g.ui.toast('A letter from the townsfolk is waiting for you on the notice board (B), and there is something new in your cabin.', { title: 'You\'ve got mail', icon: 'scroll', ms: 9000 });
    return true;
  }
  /** Every frame: the letter when it's due, and the fireworks on the first night after. */
  update(dt) {
    const g = this.game, F = this.d;
    if (!F) return;
    if (this.letterAt && performance.now() > this.letterAt && !g.ui.modalOpen && g.fishing.state === 'idle') { this.letterAt = 0; this.openLetter(); }
    if (F.fw) return;
    const night = g.engine.sky.state?.phase === 'night', home = g.saga?.map() === 'valley';
    if (!this.show && (!(night && home) || this.letterAt || this.el)) return; // (the show starts once the letter's put down)
    if (!this.show) {
      this.show = 0.001;
      g.ui.toast('Fireworks over Cozy Cove, from everyone on the water. Thank you!', { title: 'A night for you', icon: 'star', ms: 7000 });
    }
    if (!home) return; // (it waits while you're away, and carries on when you're back)
    this.show += dt; this.next -= dt;
    const C = g.community;
    if (this.next <= 0 && C) {
      const finale = this.show > SHOW_SECS - 12, n = finale ? 3 : Math.random() < 0.3 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const at = new THREE.Vector3((Math.random() - 0.5) * 56, WATER_Y + 14 + Math.random() * 12, -22 + (Math.random() - 0.5) * 24);
        const col = COLORS[Math.floor(Math.random() * COLORS.length)], ring = Math.random() < 0.5 ? COLORS[Math.floor(Math.random() * COLORS.length)] : null;
        C.launch(at, col, { n: 70 + Math.floor(Math.random() * 50), speed: 6 + Math.random() * 3, ring });
      }
      this.next = finale ? 0.35 + Math.random() * 0.3 : 0.8 + Math.random() * 1.1;
    }
    if (this.show > SHOW_SECS) { this.show = 0; g.ext.change((d) => { d.saga.finale.fw = Date.now(); }); g.audio.sfx('achievement'); }
  }
  /** The letter, on paper. Opened once by itself; after that from the notice board's Mail tab. */
  openLetter() {
    const g = this.game, F = this.d; if (!F) return;
    this.closeLetter();
    const T = letterText(g.profile.name, SAGA, !F.fw);
    const keep = h('button.btn.gold', { on: { click: () => this.closeLetter() } }, 'Keep it');
    this.el = h('div.finale-letter', { role: 'dialog', 'aria-label': 'A letter from the townsfolk' },
      h('div.fl-paper',
        h('div.fl-stamp', icon('star')),
        h('p.fl-to', T.to), h('p', T.open),
        h('div.fl-notes', T.notes.map((q) => h('p.fl-note', h('b', `${q.who}: `), q.text))),
        h('p', T.close),
        h('p.fl-sign', T.sign), h('p.fl-names', T.names.join(', ')),
        h('div.fl-actions', keep)));
    g.ui.root.append(this.el);
    g.audio.sfx('page');
    requestAnimationFrame(() => keep.focus({ preventScroll: true })); // (for a controller's A; the letter stays scrolled to its top)
    if (!F.read) g.ext.change((d) => { d.saga.finale.read = Date.now(); });
  }
  /** Close the letter if it's open (true when it was). */
  closeLetter() { if (!this.el) return false; this.el.remove(); this.el = null; this.game.audio.sfx('close'); return true; }
}
