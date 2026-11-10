// The hotbar grows with the angler. A brand-new angler starts with the essentials (inventory, journal, map, menu);
// each other button joins the bar the first time its feature is unlocked or used, with a small "new" pulse until it's
// clicked. A save that already has some history keeps every button: nothing a player has used is ever taken away.
//
// It's a table, not code: REVEALS maps a button's action (its data-act in ui.js) to "when does this show up". A button
// with no row is always there. Buttons for multiplayer only (LIVE) follow the play mode instead of being remembered.
// Kept in the save (ext.d.hotbar): { all: true } for a save with history, or { on: { action: 0 | 1 } } (0 = new, 1 = clicked).
const caught = (g) => g.profile.catchCount || 0;
const online = (g) => !g.solo;

export const REVEALS = {
  pedia: (g) => caught(g) >= 1, // your first fish is the Fishpedia's first page
  rod: (g) => caught(g) >= 1 || !g.rodStowed,
  tackle: (g) => g.profile.level >= 2 || Object.values(g.ext.d.bait || {}).some((n) => n > 0) || g.profile.owned.some((id) => /^(rod|lure)_/.test(id) && id !== 'rod_willow' && id !== 'lure_classic'),
  board: (g) => g.profile.level >= 2, // Gus points you at the notice board when the tour ends
  home: (g) => g.profile.level >= 3 || !!g.home?.active,
  bike: (g) => g.profile.level >= 2 || !!g.bikes?.riding,
  selfie: (g) => caught(g) >= 3 || !!g.selfie?.active,
  emotes: (g) => online(g) || g.profile.level >= 2 || !!g.ui.wheel,
  social: (g) => online(g),
  'shop-off': () => false, // (a placeholder for a future shop: no use to a new angler)
};
/** Shown while there's someone to talk to, hidden in single player; never remembered. */
export const LIVE = { chat: online };
/** Opening a sheet any other way (a key, a sign, a counter) counts as using its button. */
const SHEET_ACT = { tackle: 'tackle', fishpedia: 'pedia', board: 'board', social: 'social' };

export class HotbarReveal {
  constructor(game, bars) {
    this.game = game;
    this.bars = bars; // the hotbar and the compact bar: any element holding [data-act] buttons
    this.t = 0;
    for (const bar of bars) bar.addEventListener('click', (e) => { const b = e.target.closest?.('[data-act]'); if (b) this.used(b.dataset.act); });
  }

  get state() { return this.game.ext?.d?.hotbar; }
  buttons(act) { return this.bars.flatMap((bar) => [...bar.querySelectorAll(`[data-act="${act}"]`)]); }

  /** Once the save is loaded: a save with history keeps everything, a new angler starts small. */
  init() {
    const g = this.game, p = g.profile;
    if (!this.state) {
      const q = new URLSearchParams(location.search);
      const veteran = caught(g) > 0 || p.level > 1 || !!g.ext.d.tutorial?.done || q.has('autoplay'); // (tests and dev links skip first-run things)
      g.ext.change((d) => { d.hotbar = veteran ? { all: true } : { on: {} }; });
    }
    this.ready = true;
    this.apply(false);
  }

  /** Start over as a new angler would (tests; nothing in the game calls this). */
  reset() { this.game.ext.change((d) => { d.hotbar = { on: {} }; }); this.apply(false); }

  used(act) {
    const s = this.state;
    if (!this.ready || !s || s.all || !(act in REVEALS) || s.on[act] === 1) return;
    this.game.ext.change((d) => { d.hotbar.on[act] = 1; });
    for (const b of this.buttons(act)) b.classList.remove('hb-new');
    this.apply(false);
  }
  sheetOpened(name) { if (SHEET_ACT[name]) this.used(SHEET_ACT[name]); }

  /** Checked a few times a second (and right away when something is used). */
  update() {
    const now = performance.now();
    if (now - this.t < 400) return;
    this.t = now;
    if (!this.ready) this.init(); else this.apply(true);
  }

  apply(live) {
    const g = this.game, s = this.state;
    if (!s || !g.profile) return;
    for (const [act, when] of Object.entries(LIVE)) { const on = !!when(g); for (const b of this.buttons(act)) b.classList.toggle('hb-wait', !on); }
    for (const [act, when] of Object.entries(REVEALS)) {
      let on = s.all || act in s.on;
      if (!on && when(g)) {
        on = true;
        g.ext.change((d) => { d.hotbar.on[act] = 0; });
        if (live) g.audio?.sfx?.('page');
      }
      for (const b of this.buttons(act)) { b.classList.toggle('hb-wait', !on); b.classList.toggle('hb-new', on && !s.all && s.on[act] === 0); }
    }
    // a group with nothing showing takes its divider with it
    for (const bar of this.bars) for (const grp of bar.querySelectorAll('.hb-group')) grp.classList.toggle('hb-empty', ![...grp.children].some((b) => !b.hidden && !b.classList.contains('hb-wait')));
  }
}
