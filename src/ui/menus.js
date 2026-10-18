// Main menus: the title screen (over the live lake), the pause menu (Esc), the friends panel and a
// small confirm dialog. All of them are keyboard and controller friendly: arrows / d-pad move, Enter / A
// picks, Esc / B backs out.
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import { randomFact } from '../data/facts.js';
import { CHANGELOG, CHANGE_KINDS, GAME_VERSION } from '../data/changelog.js';

const VERSION = GAME_VERSION;

// "Reel Time" with a bobber for the dot on the i.
export function logo(cls = 'brand') {
  return h(`div.${cls}`, { 'aria-label': 'Reel Time', role: 'img' },
    h('span.brand-word', 'Reel'), ' ',
    h('span.brand-word', 'T', h('span.brand-i', 'ı', h('i.brand-bob')), 'me'));
}

/** Arrow-key / d-pad movement through a vertical list of buttons. */
export function menuNav(container, { onBack } = {}) {
  const items = () => [...container.querySelectorAll('button:not(:disabled), [data-nav]')].filter((b) => b.offsetParent !== null);
  const key = (e) => {
    if (!container.isConnected) { window.removeEventListener('keydown', key, true); return; }
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    const list = items();
    const i = list.indexOf(document.activeElement);
    const range = e.target instanceof HTMLInputElement && e.target.type === 'range';
    const fwd = e.key === 'ArrowDown' || (e.key === 'ArrowRight' && !range), back = e.key === 'ArrowUp' || (e.key === 'ArrowLeft' && !range);
    if (fwd || back) {
      e.preventDefault(); e.stopPropagation();
      const n = list.length; if (!n) return;
      const next = list[(i < 0 ? 0 : i + (fwd ? 1 : n - 1)) % n];
      next.focus();
    } else if (e.key === 'Escape' && onBack) { e.preventDefault(); e.stopPropagation(); onBack(); }
  };
  window.addEventListener('keydown', key, true);
  return () => window.removeEventListener('keydown', key, true);
}

export class Menus {
  constructor(game) {
    this.game = game;
    this.layer = null;
  }

  get root() { return this.game.uiRoot; }
  get open() { return !!this.layer?.isConnected; }

  close() {
    if (!this.layer) return;
    const el = this.layer; this.layer = null;
    this.unnav?.(); this.unnav = null;
    el.classList.add('out');
    setTimeout(() => el.remove(), 160);
    this.game.audio?.sfx('close');
  }

  // ---------------- title screen ----------------
  /** Resolves when the player picks Continue / Start. `first` = a brand-new angler. */
  title({ name = '', first = false } = {}) {
    const g = this.game;
    return new Promise((resolve) => {
      const go = () => {
        if (!el.isConnected) return;
        g.audio?.unlock?.(); g.audio?.sfx?.('plop');
        un(); el.classList.add('out');
        setTimeout(() => { el.remove(); resolve(); }, 420);
      };
      const item = (label, ic, fn, cls = '') => h(`button.title-item${cls}`, { on: { click: () => { g.audio?.unlock?.(); fn(); } } }, h('i.title-mark'), icon(ic), h('span', label));
      const fact = h('div.title-fact', `Did you know? ${randomFact()}`);
      // v1.13.7: single player (just you) or multiplayer (the shared lake), remembered on this device
      const modeBtn = (mode, label, ic, desc) => h(`button.title-mode-btn${g.playMode === mode ? '.on' : ''}`, { 'aria-pressed': String(g.playMode === mode), title: desc,
        on: { click: (e) => { g.audio?.unlock?.(); g.audio?.sfx?.('click'); for (const btn of modeRow.querySelectorAll('button')) { const on = btn === e.currentTarget; btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', String(on)); } modeNote.textContent = MODE_NOTE[mode]; g.setPlayMode(mode); } } }, icon(ic), h('span', label));
      const MODE_NOTE = { multi: 'Fish alongside everyone on the shared lake.', solo: 'Just you on the lake: no other anglers, no chat.' };
      const modeRow = h('div.title-mode', { role: 'group', 'aria-label': 'Play mode' }, modeBtn('multi', 'Multiplayer', 'users', MODE_NOTE.multi), modeBtn('solo', 'Single player', 'user', MODE_NOTE.solo));
      const modeNote = h('div.title-mode-note', MODE_NOTE[g.playMode]);
      const menu = h('nav.title-menu', { 'aria-label': 'Main menu' },
        modeRow, modeNote,
        item(first ? 'Start fishing' : 'Continue', 'play', go, '.main'),
        item('Play with friends', 'users', () => this.friends({ fromTitle: true })),
        item('Customize angler', 'shirt', async () => { g.prepareMenus?.(); el.classList.add('away'); await g.openCreator(); el.classList.remove('away'); menu.querySelector('.title-item.main')?.focus(); }),
        item('Settings', 'gear', () => { g.prepareMenus?.(); g.ui.sheets.open('settings'); }),
        item('Changelog', 'history', () => this.changelog({ fromTitle: true })),
        item('Feedback', 'chat', () => { g.prepareMenus?.(); import('../game/reports.js').then((m) => m.openFeedback(g)); }),
        item('Report a bug', 'bug', () => { g.prepareMenus?.(); import('../game/reports.js').then((m) => m.openBugReport(g)); }),
        item('Privacy', 'eye', () => { g.prepareMenus?.(); import('./privacy.js').then((m) => m.showPrivacy(g)); }));
      const el = h('div.title-screen',
        h('div.title-col',
          logo('brand.title-logo'),
          h('div.title-tag', 'A cozy lake for the wait.'),
          menu,
          h('div.title-foot', h('div.title-sub', name ? (first ? `Welcome to the lake, ${name}.` : `Welcome back, ${name}.`) : 'Welcome to the lake.'), fact)),
        h('button.title-ver', { 'aria-label': `Version ${VERSION}: open the changelog`, on: { click: () => this.changelog({ fromTitle: true }) } }, VERSION));
      this.root.append(el);
      const un = menuNav(menu);
      // Enter with nothing focused starts too (and every key path the old title had)
      const enter = (e) => { if (!el.isConnected) { window.removeEventListener('keydown', enter); return; } if (e.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement) && !document.querySelector('.sheet, .creator, .menu-screen')) { e.preventDefault(); go(); } };
      window.addEventListener('keydown', enter);
      requestAnimationFrame(() => menu.querySelector('.title-item.main')?.focus({ preventScroll: true })); // (Continue, not the mode switch above it)
      // swap the fact every so often
      const swap = setInterval(() => { if (!el.isConnected) { clearInterval(swap); return; } fact.classList.add('swap'); setTimeout(() => { fact.textContent = `Did you know? ${randomFact()}`; fact.classList.remove('swap'); }, 400); }, 9000);
    });
  }

  // ---------------- pause menu ----------------
  pause() {
    const g = this.game;
    if (this.open) { this.close(); return; }
    g.ui.closeAll?.();
    const peers = [...(g.net?.peers?.values?.() || [])].filter((p) => p.meta?.name);
    const item = (label, ic, fn, cls = '') => h(`button.pause-item${cls}`, { on: { click: () => { g.audio.sfx('click'); fn(); } } }, icon(ic), h('span', label));
    const list = h('nav.pause-list', { 'aria-label': 'Menu' },
      item('Resume', 'play', () => this.close(), '.main'),
      item('Settings', 'gear', () => { this.close(); g.ui.sheets.open('settings'); }),
      item('Friends & party', 'users', () => { this.close(); g.ui.sheets.open('social'); }),
      item('Play with friends (invites)', 'link', () => { this.close(); this.friends(); }),
      item('How to play', 'help', () => { this.close(); g.ui.sheets.state.settingsTab = 'controls'; g.ui.sheets.open('settings'); }),
      item('Photo album', 'camera', () => { this.close(); g.ui.sheets.open('album'); }),
      item('Changelog', 'history', () => { this.close(); this.changelog(); }),
      item('Send feedback', 'chat', () => { this.close(); import('../game/reports.js').then((m) => m.openFeedback(g)); }),
      item('Report a bug', 'bug', () => { this.close(); import('../game/reports.js').then((m) => m.openBugReport(g)); }),
      item('Report a player', 'shield', () => { this.close(); import('../game/reports.js').then((m) => m.openPlayerPicker(g)); }),
      item('Privacy', 'eye', () => { this.close(); import('./privacy.js').then((m) => m.showPrivacy(g)); }),
      item('Back to title', 'exit', () => { this.close(); this.backToTitle(); }));
    // Everything from the hotbar, for narrow windows where the hotbar folds away.
    const quick = (label, ic, fn) => h('button.quick-btn', { on: { click: () => { this.close(); fn(); } } }, icon(ic), h('span', label));
    const grid = h('div.quick-grid', { role: 'group', 'aria-label': 'Quick menu' },
      quick('Inventory', 'backpack', () => g.ui.sheets.open('creel')), quick('Tackle box', 'package', () => g.ui.sheets.open('tackle')), quick('Fishpedia', 'book', () => g.ui.sheets.open('fishpedia')), quick('Journal', 'star', () => g.ui.sheets.open('journal')),
      quick('Map', 'map', () => g.ui.sheets.open('map')), quick('Board', 'scroll', () => g.ui.sheets.open('board')), h('button.quick-btn.nav-off', { 'aria-disabled': 'true', title: 'Shop' }, icon('shop'), h('span', 'Shop')),
      quick('Cabin', 'home', () => g.home.open()), quick('Emotes', 'smile', () => g.ui.toggleWheel()), quick('Selfie', 'camera', () => g.selfie.start()),
      quick(g.rodStowed ? 'Rod out' : 'Stow rod', 'rod', () => g.toggleRod()), quick('Chat', 'chat', () => g.chat?.focus()));
    const card = h('div.menu-card.pause-card', { role: 'dialog', 'aria-label': 'Menu' },
      grid,
      h('div.pause-head', logo('brand.pause-logo'), h('div.pause-where', icon('pin'), h('span', g.currentZoneLabel?.() || 'Cozy Cove'), h('span.dotsep'), icon('users'), h('span', g.playMode === 'solo' ? 'Single player' : `${peers.length + 1} on the lake`))),
      list,
      h('div.pause-hint', h('kbd', 'Esc'), ' to resume'));
    this.layer = h('div.menu-screen.pause-screen', { on: { click: (e) => { if (e.target === this.layer) this.close(); } } }, card);
    this.root.append(this.layer);
    g.audio.sfx('open');
    this.unnav = menuNav(list, { onBack: () => this.close() });
    requestAnimationFrame(() => list.querySelector('button')?.focus({ preventScroll: true }));
  }

  async backToTitle() {
    const g = this.game;
    g.fishing?.cancel?.();
    g.ui.setVisible(false);
    await this.title({ name: g.profile?.name });
    g.ui.setVisible(true);
  }

  // ---------------- friends ----------------
  friends({ fromTitle = false } = {}) {
    const g = this.game;
    if (this.open) this.close();
    const kind = g.net?.kind || (window.claude?.use ? 'room' : 'local');
    const peers = [...(g.net?.peers?.values?.() || [])].filter((p) => p.meta?.name);
    const room = new URLSearchParams(location.search).get('room') || 'main';
    const body = h('div.friends-body');
    if (g.playMode === 'solo') {
      // v1.13.7: single player: one tap back to the shared lake
      body.append(h('p', 'You\'re playing single player, so nobody else is on your lake.'),
        h('button.btn.blue', { on: { click: async () => { await g.setPlayMode('multi'); this.close(); this.friends({ fromTitle }); } } }, icon('users'), 'Switch to multiplayer'));
    } else if (kind === 'room' && g.net?.solo) {
      body.append(h('p', 'You are fishing solo right now: this copy of the game can\'t reach the shared lake.'),
        h('p.muted', 'Ask whoever sent you the game to open Share in Claude, turn off "Anyone with the link", and invite the email you sign in to Claude with as an Editor. Then open the game from that invite while signed in, and reload.'),
        h('p.muted.small', `Connection check: ${g.net.soloReason || 'unknown'}`));
    } else if (kind === 'room') {
      body.append(h('p', 'Everyone you invite fishes on this lake with you, at the same time.'),
        h('ol.muted', h('li', 'Open Share at the top of this page in Claude and set general access to "Only you".'),
          h('li', 'Invite your friend by email as an Editor: the address they sign in to Claude with.'),
          h('li', 'They open the game from the invite, signed in, and paddle right in.')),
        h('p.muted', 'While "Anyone with the link" is on, friends from outside your organization fish solo.'));
    } else {
      const link = new URL(location.href);
      for (const k of ['as', 'autoplay', 'avatar', 't', 'weather', 'gfx']) link.searchParams.delete(k);
      const copy = h('button.btn.blue', { on: { click: async () => { try { await navigator.clipboard.writeText(link.toString()); copy.lastChild.textContent = 'Link copied'; } catch { copy.lastChild.textContent = 'Copy failed: select the link'; } } } }, icon('copy'), h('span', 'Copy invite link'));
      body.append(h('p', room === 'main' ? 'You are on the main lake with everyone else.' : `You are in the private cove "${room}". Only people with the link can join.`),
        h('div.friends-link', h('input.field', { value: link.toString(), readOnly: true, 'aria-label': 'Invite link', on: { focus: (e) => e.target.select() } }), copy),
        h('div.friends-row', h('button.btn.ghost', { on: { click: () => { const code = Math.random().toString(36).slice(2, 7); const u = new URL(location.href); u.searchParams.set('room', code); location.href = u.toString(); } } }, icon('tent'), 'Start a private cove'),
          room !== 'main' ? h('button.btn.ghost', { on: { click: () => { const u = new URL(location.href); u.searchParams.delete('room'); location.href = u.toString(); } } }, icon('waves'), 'Back to the main lake') : null));
    }
    if (!fromTitle) {
      body.append(h('h4', peers.length ? `On the lake now (${peers.length})` : 'On the lake now'),
        peers.length ? h('div.row-list', peers.slice(0, 12).map((p) => h('div.list-row', icon('user'), h('div.grow', h('div.ttl', p.meta.name), h('div.meta', [p.meta.lvl ? `Level ${p.meta.lvl}` : '', p.meta.title || ''].filter(Boolean).join(', '))),
          h('button.btn.small.ghost', { on: { click: () => { this.close(); g.chat?.focus(`/w ${p.meta.name} `); } } }, icon('chat'), 'Whisper'),
          h('button.btn.small.ghost', { 'aria-label': `Report ${p.meta.name}`, title: 'Report', on: { click: () => { this.close(); g.mod?.openReport({ id: g.mod.idOf(p), peer: p.id, name: p.meta.name }); } } }, icon('shield')))))
          : h('div.empty', 'Nobody else is here right now. The lake is all yours.'));
    }
    const card = h('div.menu-card.friends-card', { role: 'dialog', 'aria-label': 'Play with friends' },
      h('div.menu-card-head', h('h2', 'Play with friends'), h('button.btn.close-x.ghost', { 'aria-label': 'Close', on: { click: () => this.close() } }, icon('close'))),
      body);
    this.layer = h('div.menu-screen', { on: { click: (e) => { if (e.target === this.layer) this.close(); } } }, card);
    this.root.append(this.layer);
    g.audio?.sfx('open');
    this.unnav = menuNav(card, { onBack: () => this.close() });
    requestAnimationFrame(() => card.querySelector('button.btn:not(.close-x)')?.focus({ preventScroll: true }));
  }

  // ---------------- changelog ----------------
  /** Every release, newest first, as collapsible sections with itemized changes grouped by kind. */
  changelog({ fromTitle = false } = {}) {
    const g = this.game;
    if (this.open) this.close();
    const release = (r, i) => {
      const count = Object.values(r.changes).reduce((n, l) => n + l.length, 0);
      const groups = Object.entries(r.changes).map(([kind, items]) => {
        const k = CHANGE_KINDS[kind] || CHANGE_KINDS.new;
        return h(`section.cl-group.cl-${kind}`,
          h('h4.cl-kind', icon(k.icon), h('span', k.label), h('span.cl-n.num', String(items.length))),
          h('ul.cl-list', items.map((t) => h('li', t))));
      });
      const det = h('details.cl-release', { open: i === 0 },
        h('summary.cl-sum', { 'data-nav': '' },
          h('span.cl-ver.num', r.version),
          h('span.cl-title', h('b', r.title), h('small', `${r.date} · ${count} change${count === 1 ? '' : 's'}`)),
          i === 0 ? h('span.cl-latest', 'Latest') : null,
          h('span.cl-chev', icon('down'))),
        h('div.cl-body', groups));
      det.addEventListener('toggle', () => g.audio?.sfx(det.open ? 'open' : 'close'));
      return det;
    };
    const card = h('div.menu-card.changelog-card', { role: 'dialog', 'aria-label': 'Changelog' },
      h('div.menu-card-head', h('h2', icon('history'), 'Changelog'), h('button.btn.close-x.ghost', { 'aria-label': 'Close', on: { click: () => this.close() } }, icon('close'))),
      h('p.cl-intro', `You're on ${VERSION}. Everything we've changed on the lake, newest first.`),
      h('div.cl-releases', CHANGELOG.map(release)));
    this.layer = h('div.menu-screen.changelog-screen', { on: { click: (e) => { if (e.target === this.layer) this.close(); } } }, card);
    this.root.append(this.layer);
    g.audio?.sfx('open');
    this.unnav = menuNav(card, { onBack: () => this.close() });
    requestAnimationFrame(() => card.querySelector('summary')?.focus({ preventScroll: true }));
    void fromTitle;
  }

  // ---------------- confirm ----------------
  confirm({ title, text, ok = 'OK', cancel = 'Cancel', icon: ic = 'help' }) {
    return new Promise((resolve) => {
      const done = (v) => { un(); el.classList.add('out'); setTimeout(() => el.remove(), 150); resolve(v); };
      const okBtn = h('button.btn.primary', { on: { click: () => done(true) } }, ok);
      const card = h('div.menu-card.confirm-card', { role: 'alertdialog', 'aria-label': title },
        h('div.confirm-ic', icon(ic)), h('h3', title), text ? h('p', text) : null,
        h('div.confirm-btns', h('button.btn.ghost', { on: { click: () => done(false) } }, cancel), okBtn));
      const el = h('div.menu-screen.confirm-screen', { on: { click: (e) => { if (e.target === el) done(false); } } }, card);
      this.root.append(el);
      this.game.audio?.sfx('open');
      const un = menuNav(card, { onBack: () => done(false) });
      requestAnimationFrame(() => okBtn.focus({ preventScroll: true }));
    });
  }
}

export { clear };
