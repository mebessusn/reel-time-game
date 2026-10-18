// HUD, meters, reveal card, toasts, feed, nameplates, context buttons, emote wheel.
import { openFishViewer, viewerOpen, closeViewer } from './viewer.js';
import { h, clear, fmt, lb } from './dom.js';
import { icon, iconURL, WEATHER_ICON, PHASE_ICON } from './icons.js';
import { fishThumb, junkThumb, avatarThumb } from './thumbs.js';
import { TIER_INFO, ZONES, JUNK, SPECIES_BY_ID } from '../data/species.js';
import { ACH_TIER_COLOR } from '../data/achievements.js';
import { PHASE_LABEL, WEATHER_LABEL, WEATHER_FISHING } from '../core/clock.js';
import { xpForLevel, MAX_LEVEL, canTrade, tradePearls } from '../game/rules.js';
import { Sheets } from './sheets.js';
import { keyName } from '../game/controls.js';
import { Chat } from './chat.js';
import { Tips } from './tips.js';
import { Captions } from './captions.js';
import { openCatchCard } from './catchcard.js';
import { BAITS } from '../data/bait.js';
import { traitWords } from '../game/traits.js';
import { EVENT_INFO } from '../game/worldevents.js';
import { SEASONS } from '../data/seasons.js';
import { regionName } from '../world/terrain.js';

export const EMOTES = [
  { id: 'wave', label: 'Wave', sym: '\u{1F44B}', icon: 'hand' },
  { id: 'cheer', label: 'Cheer', sym: '\u{1F389}', icon: 'party' },
  { id: 'shrug', label: 'Shrug', sym: '\u{1F937}', icon: 'meh' },
  { id: 'showoff', label: 'Show Off', sym: '\u{1F41F}', icon: 'fish' },
  { id: 'sleep', label: 'Nap', sym: '\u{1F4A4}', icon: 'bed' },
  { id: 'clap', label: 'Clap', sym: '\u{1F44F}', item: 'emote_clap', icon: 'sparkles' },
  { id: 'dance', label: 'Dance', sym: '\u{1F57A}', item: 'emote_dance', icon: 'music' },
  { id: 'orange', label: 'Orange Shuffle', sym: '\u{1F34A}', icon: 'citrus' },
];

// Tug & Turn HUD: a tension dial (slack / sweet spot / danger), rod-angle track with the "aim here" marker,
// and the spool of line won back. Built once, updated every frame.
// v1.13.11: the Inventory button's tooltip carries how full the bag is, in place of the old count badge
function creelBtnTip(root, n) {
  const b = root?.querySelector?.('[data-act="creel"]');
  if (b) b.dataset.tip = n ? `Inventory (${n})` : 'Inventory';
}

function buildTugHud() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 108');
  svg.classList.add('tug-dial');
  const arc = (a0, a1, col, w = 16) => {
    const p = (a) => [100 + Math.cos(Math.PI * (1 - a)) * 78, 96 - Math.sin(Math.PI * (1 - a)) * 78];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M ${x0} ${y0} A 78 78 0 0 1 ${x1} ${y1}`);
    path.setAttribute('stroke', col); path.setAttribute('stroke-width', w); path.setAttribute('fill', 'none');
    return path;
  };
  svg.append(arc(0, 1, '#3e2412', 22), arc(0, 0.2, '#a8d0e8'), arc(0.2, 0.62, '#f2c040'), arc(0.62, 0.82, '#f08a30'), arc(0.82, 1, '#d8402e'));
  const needle = document.createElementNS(NS, 'g');
  needle.classList.add('tug-needle');
  const ln = document.createElementNS(NS, 'path');
  ln.setAttribute('d', 'M 97 96 L 100 26 L 103 96 Z'); ln.setAttribute('fill', '#f6ebd3'); ln.setAttribute('stroke', '#3e2412'); ln.setAttribute('stroke-width', '2');
  needle.append(ln);
  const hub = document.createElementNS(NS, 'circle');
  hub.setAttribute('cx', '100'); hub.setAttribute('cy', '96'); hub.setAttribute('r', '8'); hub.setAttribute('fill', '#8a5a32'); hub.setAttribute('stroke', '#3e2412'); hub.setAttribute('stroke-width', '3');
  svg.append(needle, hub);
  return h('div.tug.plank.hidden',
    h('div.tug-top', h('span.tug-left', '◀'), svg, h('span.tug-right', '▶')),
    h('div.tug-word', 'Reel!'),
    h('div.tug-aim', h('i.tug-pull', { title: 'Aim the rod here' }), h('i.tug-rod')),
    h('div.tug-spool', h('i'), h('img.tug-fish', { alt: '' })),
    h('div.tug-stamina', h('i')));
}

export class UI {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.sheets = new Sheets(this, game);
    this.build();
    this.last = {};
    this.plates = new Map();
  }

  build() {
    const g = this.game;
    // ---- status cluster (top left): level ring, where you are, time of day
    const NS = 'http://www.w3.org/2000/svg';
    const ring = document.createElementNS(NS, 'svg');
    ring.setAttribute('viewBox', '0 0 44 44'); ring.setAttribute('class', 'lvl-ring');
    ring.innerHTML = '<circle cx="22" cy="22" r="19" class="track"/><circle cx="22" cy="22" r="19" class="fill" pathLength="100"/>';
    this.lvlBox = h('div.lvl', { title: 'Level' }, ring, h('span.lv.num'), h('span.ttl.hidden'), h('div.xpbar.hidden', h('i')));
    this.zoneLabel = h('div.zone-label');
    this.timeChip = h('div.chip.time-chip');
    this.status = h('div.status.plank', this.lvlBox, h('div.status-text', this.zoneLabel, this.timeChip));
    this.claudeChip = h('button.chip.plank.claude-chip.hidden', { title: 'Claude status (from the Reel Time plugin)', on: { click: () => (this.claudeChip.classList.contains('unlinked') ? this.claudeHelp() : this.game.claude?.consume()) } });
    this.eventChip = h('div.chip.plank.event-chip.hidden');
    this.streakChip = h('div.chip.plank.streak-chip.hidden');
    this.buffChip = h('div.chip.buff-chip.hidden');
    this.fedChip = h('div.chip.buff-chip.fed-chip.hidden'); // v1.9.5 Well Fed
    this.patientChip = h('div.chip.buff-chip.patient-chip.hidden'); // v1.12.1 Patient Angler (while Claude works)
    this.roastBar = h('div.roast-bar.plank.hidden', h('span.rb-label', icon('flame'), 'Roasting'), h('div.rb-track', h('div.rb-fill')));
    this.derbyChip = h('button.chip.plank.derby-chip.hidden', { title: 'Derby standings', on: { click: () => { this.sheets.state.board = 'derby'; this.sheets.open('board'); } } });
    this.baitChip = h('button.chip.bait-chip.plank.hidden', { title: 'Bait on your hook (V to switch)', on: { click: () => this.game.tackle.cycle() } });
    // ---- wallet (top right): one pill for both currencies
    this.coinChip = h('div.money', { title: 'Coins' }, icon('coin'), h('span.v.num', '0'));
    this.pearlChip = h('div.money', { title: 'Pearls' }, icon('pearl'), h('span.v.num', '0'));
    this.wallet = h('div.wallet.plank', this.coinChip, h('i.sep'), this.pearlChip);
    this.goalEl = h('button.goal-chip.paper.hidden', { on: { click: () => this.game.ladder.claim() } });
    this.top = h('div.hud-top',
      h('div.hud-left', this.status, h('div.chips', this.buffChip, this.patientChip, this.fedChip, this.eventChip, this.derbyChip, this.streakChip), this.goalEl),
      h('div.hud-center', this.claudeChip, this.wpChip = h('button.chip.plank.wp-chip.hidden', { title: 'Your waypoint (opens the map)', on: { click: () => this.sheets.open('map') } }, h('span.wp-arrow', icon('nav')), h('span.wp-name'), h('span.wp-dist.num'))),
      h('div.hud-right', this.wallet, this.baitChip));

    // ---- hotbar: grouped icon buttons with a tooltip that names the key
    const ib = (name, label, action, fn) => h('button.btn.icon-btn', { 'aria-label': label, 'data-tip': label, 'data-act': action || '', on: { click: () => { this.game.audio.unlock(); fn(); } } }, icon(name));
    this.journalBadge = h('span.badge.hidden', '!');
    this.chatBadge = h('span.badge.hidden', '0');
    const creelBtn = ib('backpack', 'Inventory', 'creel', () => this.sheets.open('creel'));
    // v1.13.11: no count badge on Inventory; you don't need telling that a fish went in your bag
    const journalBtn = ib('star', 'Journal', 'journal', () => this.sheets.open('journal'));
    journalBtn.appendChild(this.journalBadge);
    const chatBtn = ib('chat', 'Chat', 'chat', () => this.chat.toggle());
    chatBtn.appendChild(this.chatBadge);
    this.rodBtn = ib('rod', 'Stow rod', 'rod', () => this.game.toggleRod());
    const group = (label, ...btns) => h('div.hb-group', { role: 'group', 'aria-label': label }, btns);
    this.iconRow = h('div.icon-row.hotbar.plank', { role: 'toolbar', 'aria-label': 'Game menu' },
      group('Inventory', creelBtn, ib('package', 'Tackle box', 'tackle', () => this.sheets.open('tackle')), ib('book', 'Fishpedia', 'pedia', () => this.sheets.open('fishpedia')), journalBtn),
      group('World', ib('map', 'Map', 'map', () => this.sheets.open('map')), ib('scroll', 'Notice board', 'board', () => this.sheets.open('board')), this.shopOff = ib('shop', 'Shop', 'shop-off', () => {}), ib('home', 'Your cabin', 'home', () => this.game.home.open()), ib('bike', 'Bike (hop on / off)', 'bike', () => this.game.bikes.toggle())),
      group('Social', chatBtn, ib('users', 'Friends & party (O)', 'social', () => this.sheets.open('social')), ib('smile', 'Emotes', 'emotes', () => this.toggleWheel()), ib('camera', 'Camera (selfies and group shots)', 'selfie', () => this.game.selfie.start())),
      group('System', this.rodBtn, (this.adminBtn = ib('shield', 'Admin', 'admin', () => this.sheets.open('admin'))), ib('menu', 'Menu', 'pause', () => this.openPause())));
    this.adminBtn.hidden = true; // v1.10: shown to the lake's admins only (see showAdmin)
    // v1.10: the Shop button is switched off for now (a future shop lives here); buying happens at Gus's counter
    this.shopOff.classList.add('nav-off'); this.shopOff.setAttribute('aria-disabled', 'true');
    // ---- hover cards for the status chips (v1.8.2): what a buff or streak actually does
    this.chipTip = h('div.chip-tip.hidden', { role: 'tooltip' });
    const fmtLeft = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    const tips = {
      buff: () => {
        const b = this.game.buffInfo?.();
        if (!b) return null;
        return [h('div.ct-head', icon('sparkles'), h('b', b.name), h('span.ct-time.num', `${fmtLeft(b.left)} left`)), h('ul', b.lines.map((l) => h('li', l))), h('div.ct-foot', b.from)];
      },
      fed: () => {
        const b = this.game.cookout?.info();
        if (!b) return null;
        return [h('div.ct-head', icon('flame'), h('b', b.name), h('span.ct-time.num', `${fmtLeft(b.left)} left`)), h('ul', b.lines.map((l) => h('li', l))), h('div.ct-foot', b.from)];
      },
      patient: () => {
        const b = this.game.patientInfo?.();
        if (!b) return null;
        return [h('div.ct-head', icon('clock'), h('b', b.name), h('span.ct-time.num', `${fmtLeft(b.elapsed)} so far`)), h('ul', b.lines.map((l) => h('li', l))), h('div.ct-foot', b.from)];
      },
      streak: () => {
        const n = this.game.juice?.streak || 0;
        return [h('div.ct-head', icon('flame'), h('b', `Catch streak ×${n}`)), h('ul', h('li', 'Fish landed in a row without one getting away'), h('li', 'Every 3rd fish in a row pays bonus coins')), h('div.ct-foot', 'A fish that escapes ends the streak.')];
      },
    };
    const showChipTip = (el, kind) => {
      const parts = tips[kind]?.();
      if (!parts) return;
      clear(this.chipTip).append(...parts);
      const r = el.getBoundingClientRect(), rr = this.root.getBoundingClientRect();
      this.chipTip.style.left = `${r.left - rr.left}px`;
      this.chipTip.style.top = `${r.bottom - rr.top + 8}px`;
      this.chipTip.classList.remove('hidden');
      this.chipTipFor = { el, kind };
    };
    const hideChipTip = () => { this.chipTip.classList.add('hidden'); this.chipTipFor = null; };
    for (const [el, kind] of [[this.buffChip, 'buff'], [this.patientChip, 'patient'], [this.fedChip, 'fed'], [this.streakChip, 'streak']]) {
      el.tabIndex = 0;
      el.setAttribute('aria-haspopup', 'true');
      el.addEventListener('pointerenter', () => showChipTip(el, kind));
      el.addEventListener('focus', () => showChipTip(el, kind));
      el.addEventListener('pointerleave', hideChipTip);
      el.addEventListener('blur', hideChipTip);
    }
    this.refreshChipTip = () => { if (this.chipTipFor) { if (this.chipTipFor.el.classList.contains('hidden')) hideChipTip(); else showChipTip(this.chipTipFor.el, this.chipTipFor.kind); } };
    this.hbTip = h('div.hb-tip.hidden');
    const showTip = (btn) => {
      const act = btn.dataset.act;
      const key = act === 'chat' ? 'Enter' : act === 'pause' ? 'Esc' : act && this.game.keymap ? keyName(this.game.keymap.keyFor(act) || '') : '';
      clear(this.hbTip).append(...[h('span', btn.dataset.tip), key ? h('kbd', key) : null].filter(Boolean)); // append(null) would print "null"
      const r = btn.getBoundingClientRect(), rr = this.root.getBoundingClientRect();
      this.hbTip.style.left = `${r.left + r.width / 2 - rr.left}px`;
      this.hbTip.style.top = `${r.top - rr.top - 8}px`;
      this.hbTip.classList.remove('hidden');
    };
    const hideTip = () => this.hbTip.classList.add('hidden');
    for (const b of this.iconRow.querySelectorAll('.icon-btn')) {
      b.addEventListener('pointerenter', () => showTip(b));
      b.addEventListener('focus', () => showTip(b));
      b.addEventListener('pointerleave', hideTip);
      b.addEventListener('blur', hideTip);
      b.addEventListener('click', hideTip);
    }
    // the "more" button for narrow screens: opens the whole menu as a sheet of big buttons
    this.moreBtn = h('button.btn.icon-btn.more-btn', { 'aria-label': 'More', 'data-tip': 'More', on: { click: () => this.openPause() } }, icon('menu'));
    this.compactBar = h('div.compact-bar.plank', ib('backpack', 'Inventory', 'creel', () => this.sheets.open('creel')), ib('chat', 'Chat', 'chat', () => this.chat.toggle()), this.moreBtn);

    // ---- world prompt: the E action floats over the thing it acts on
    this.contextBox = h('div.context-btn', { on: { pointerenter: () => { this.promptHover = true; }, pointerleave: () => { this.promptHover = false; } } });
    this.bottom = h('div.hud-bottom', this.iconRow, this.compactBar);

    this.power = h('div.power.plank.hidden', h('i'), h('div.sweet'), h('div.super'));
    this.reelEl = buildTugHud();
    this.reelHint = h('div.reel-hint.hidden', 'Hold to reel. Move the mouse ◀ ▶ against the fish’s pull. Let go when the line turns red or the fish leaps.');
    this.bang = h('div.bang.hidden', '!');
    this.toasts = h('div.toasts', { role: 'status', 'aria-live': 'polite' });
    this.feedEl = h('div.feed');
    this.plateLayer = h('div.passthrough.plate-layer', { style: { position: 'absolute', inset: '0' } });
    this.hintEl = h('div.hint.hidden');
    this.partyFrame = h('div.party-frame', { hidden: true, role: 'group', 'aria-label': 'Your party' });

    this.hud = h('div.passthrough.hud', { style: { position: 'absolute', inset: '0' } },
      this.plateLayer, this.top, this.partyFrame, this.feedEl, this.contextBox, this.power, this.reelEl, this.reelHint, this.bang, this.bottom, this.hintEl, this.hbTip, this.chipTip);
    this.root.append(this.hud, this.toasts);
    this.chatLayer = h('div.chat-layer');
    this.hud.append(this.chatLayer);
    this.chat = new Chat(this.game, this.chatLayer);
    this.tips = new Tips(this.game, this.root);
    this.captions = new Captions(this.root);
  }

  openPause() { this.game.menus?.pause(); }

  // Keyboard / controller users get focus moved into new panels (and back out when they close).
  focusFirst(el) {
    this.lastFocus = document.activeElement;
    if (!document.body.classList.contains('kb-nav')) return;
    requestAnimationFrame(() => el.querySelector('.tab.on, button:not(:disabled), [tabindex="0"]')?.focus({ preventScroll: true }));
  }
  focusReturn() {
    const f = this.lastFocus; this.lastFocus = null;
    if (f && f.isConnected && document.body.classList.contains('kb-nav')) f.focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement !== document.body && !(document.activeElement instanceof HTMLInputElement)) document.activeElement.blur();
  }

  setRodButton(stowed) {
    if (!this.rodBtn) return;
    this.rodBtn.classList.toggle('on', !!stowed);
    this.rodBtn.dataset.tip = stowed ? 'Take rod out' : 'Stow rod';
    this.rodBtn.setAttribute('aria-label', this.rodBtn.dataset.tip);
  }

  /** Golden Line countdown chip (v1.8.1). left: seconds remaining (0 hides it). */
  setBuffLeft(left) {
    const on = left > 0;
    this.buffChip.classList.toggle('hidden', !on);
    if (!on) { this.buffText = null; if (this.chipTipFor?.kind === 'buff') this.refreshChipTip(); return; }
    const txt = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    if (txt === this.buffText) return;
    this.buffText = txt;
    clear(this.buffChip).append(icon('sparkles'), h('span', 'Golden Line '), h('span.num', txt));
    if (this.chipTipFor?.kind === 'buff') this.refreshChipTip();
    this.buffChip.classList.toggle('ending', left < 10);
  }

  /** v1.12.1: the Patient Angler chip, on while Claude works on your prompt (elapsed seconds, or null to hide). */
  setPatient(elapsed) {
    const on = elapsed != null;
    this.patientChip.classList.toggle('hidden', !on);
    if (!on) { this.patientText = null; return; }
    const txt = `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
    if (txt === this.patientText) return;
    this.patientText = txt;
    clear(this.patientChip).append(icon('clock'), h('span', 'Patient Angler '), h('span.num', txt));
    if (this.chipTipFor?.kind === 'patient') this.refreshChipTip();
  }
  /** v1.9.5: the Well Fed chip (seconds left; 0 hides it). */
  setFedLeft(left, fed) {
    const on = left > 0;
    this.fedChip.classList.toggle('hidden', !on);
    if (!on) { this.fedText = null; return; }
    const txt = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    if (txt === this.fedText) return;
    this.fedText = txt;
    clear(this.fedChip).append(icon('flame'), h('span', 'Well Fed '), h('span.num', txt));
    if (this.chipTipFor?.kind === 'fed') this.refreshChipTip();
    this.fedChip.classList.toggle('ending', left < 15);
  }
  /** v1.9.5: the roasting progress bar (0..1, or null to hide). */
  setRoast(p) {
    if (!this.roastBar.isConnected) this.root.append(this.roastBar);
    this.roastBar.classList.toggle('hidden', p == null);
    if (p != null) { this.roastBar.querySelector('.rb-fill').style.width = `${Math.round(p * 100)}%`; this.roastBar.querySelector('.rb-label').lastChild.textContent = p < 0.35 ? 'Warming up' : p < 0.75 ? 'Sizzling' : 'Nearly roasted'; }
  }

  setStreak(n) {
    this.streakChip.classList.toggle('hidden', n < 3);
    if (n >= 3) { clear(this.streakChip).append(icon('flame'), h('span.num', `×${n}`)); this.streakChip.classList.remove('bump'); void this.streakChip.offsetWidth; this.streakChip.classList.add('bump'); }
  }

  setChatBadge(n) {
    if (!this.chatBadge) return;
    this.chatBadge.textContent = n > 99 ? '99+' : String(n);
    this.chatBadge.classList.toggle('hidden', !n);
  }

  setVisible(v) { this.hud.classList.toggle('hidden', !v); }

  // ---------- per-frame ----------
  update() {
    const g = this.game, p = g.profile, wt = g.engine.sky.state;
    if (!p) return;
    const season = g.living?.season;
    const key = `${wt.phase}|${wt.weather}|${wt.fullMoon}|${wt.bloodMoon}|${season}`;
    if (key !== this.last.time) {
      clear(this.timeChip).append(...[icon(PHASE_ICON[wt.phase]), wt.weather !== 'clear' ? icon(WEATHER_ICON[wt.weather]) : null].filter(Boolean), h('span', [PHASE_LABEL[wt.phase], wt.bloodMoon ? 'Blood Moon' : wt.fullMoon && wt.phase === 'night' ? 'Full moon' : '', season ? SEASONS[season].name : ''].filter(Boolean).join(', ')));
      this.timeChip.classList.toggle('blood', !!wt.bloodMoon);
      const wf = WEATHER_FISHING[wt.bloodMoon ? 'bloodmoon' : wt.weather]?.note;
      this.timeChip.title = `${PHASE_LABEL[wt.phase]}, ${wt.bloodMoon ? 'Blood Moon' : WEATHER_LABEL[wt.weather]}.${wf ? ` ${wf}` : ''} One in-game day is 24 minutes.${season ? ` ${SEASONS[season].blurb}` : ''}`;
      this.last.time = key;
    }
    if (p.coins !== this.last.coins) { this.tick(this.coinChip, this.last.coins, p.coins); this.last.coins = p.coins; }
    if (p.pearls !== this.last.pearls) { this.tick(this.pearlChip, this.last.pearls, p.pearls); this.last.pearls = p.pearls; }
    const lk = `${p.level}|${p.xp}|${p.title}`;
    if (lk !== this.last.lvl) {
      this.lvlBox.querySelector('.lv').textContent = String(p.level);
      this.lvlBox.querySelector('.ttl').textContent = p.title || '';
      const a = xpForLevel(p.level), b = xpForLevel(Math.min(MAX_LEVEL, p.level + 1));
      const pct = p.level >= MAX_LEVEL ? 100 : Math.max(0, Math.min(100, ((p.xp - a) / (b - a)) * 100));
      this.lvlBox.querySelector('.xpbar > i').style.width = `${pct}%`;
      this.lvlBox.querySelector('.fill').style.strokeDashoffset = String(100 - pct);
      this.lvlBox.title = `Level ${p.level}${p.title ? `, ${p.title}` : ''}. ${fmt(p.xp)} XP${p.level < MAX_LEVEL ? `, ${fmt(b - p.xp)} to level ${p.level + 1}` : ''}`;
      this.last.lvl = lk;
    }
    const cc = p.creel.length;
    if (cc !== this.last.creel) { creelBtnTip(this.root, cc); this.last.creel = cc; }
    const claim = g.claimableCount();
    if (claim !== this.last.claim) { this.journalBadge.classList.toggle('hidden', !claim); this.last.claim = claim; }

    // Claude status chip
    const cl = g.claude;
    // v1.13.2: until this angler's Claude has ever signalled, a quiet "Link Claude" chip explains how (after a minute
    // on the lake, and not for a week once they hide it)
    const xd = g.ext?.d || {};
    const unlinked = (!cl || cl.state === 'idle') && !xd.claudeLinkedAt && !(xd.claudeHintHiddenUntil > Date.now()) && (performance.now() - (this.bootAt ??= performance.now())) > 60000;
    const ck = unlinked ? 'unlinked' : cl ? (cl.state === 'working' ? `w${Math.floor(cl.elapsed())}|${cl.waitFish || 0}` : cl.state) : 'idle';
    if (ck !== this.last.claude) {
      this.last.claude = ck;
      const show = unlinked || (cl && cl.state !== 'idle');
      this.claudeChip.classList.toggle('hidden', !show);
      this.claudeChip.classList.toggle('unlinked', unlinked);
      this.claudeChip.classList.toggle('ready', !unlinked && cl?.state === 'ready');
      if (unlinked) { clear(this.claudeChip).append(icon('sparkles'), h('span', 'Link Claude for golden fish')); this.claudeChip.title = 'How to make a golden fish bite when Claude finishes'; }
      if (show && !unlinked) {
        const e = Math.floor(cl.elapsed());
        clear(this.claudeChip).append(icon('sparkles'), cl.state === 'working' ? h('span', 'Claude is thinking ', h('span.num', `${Math.floor(e / 60)}:${String(e % 60).padStart(2, '0')}`), cl.waitFish ? `, ${cl.waitFish} fish so far` : '') : h('span', 'Answer ready. Reel it in!'));
      }
    }

    // Goal ladder
    const gl = g.ladder?.current();
    const gk = gl ? `${gl.id}|${gl.have}|${gl.done}` : 'none';
    if (gk !== this.last.goal && g.ext?.key) {
      this.last.goal = gk;
      this.goalEl.classList.toggle('hidden', !gl || g.tutorial?.active);
      if (gl) {
        clear(this.goalEl).append(...[h('span.goal-n', `Goal ${gl.index + 1}`), h('span.goal-t', gl.text), gl.n > 1 && !gl.done ? h('span.goal-p', ` ${gl.have}/${gl.n}`) : null, gl.done ? h('span.goal-claim', 'Claim!') : null].filter(Boolean));
        this.goalEl.classList.toggle('done', gl.done);
      }
    }
    if (g.tutorial?.active && !this.goalEl.classList.contains('hidden')) this.goalEl.classList.add('hidden');

    // World event, derby and bait chips
    const ev = g.events?.current;
    if (ev !== this.last.ev) { this.last.ev = ev; this.eventChip.classList.toggle('hidden', !ev); if (ev) { clear(this.eventChip).append(icon('sparkles'), h('span', EVENT_INFO[ev].name)); this.eventChip.title = EVENT_INFO[ev].blurb; } }
    const ds = g.derby?.status();
    const dk = ds ? `${ds.left}|${ds.best}|${ds.rank}|${ds.field}` : '';
    if (dk !== this.last.derby) {
      this.last.derby = dk;
      this.derbyChip.classList.toggle('hidden', !ds);
      if (ds) clear(this.derbyChip).append(icon('flag'), h('span', ds.name), h('span.num', `${Math.floor(ds.left / 60)}:${String(ds.left % 60).padStart(2, '0')}`), ...(ds.best ? [h('span.sub', `${ds.best} lb, #${ds.rank} of ${ds.field}`)] : []));
    }
    const bait = g.tackle?.active;
    const bk = bait ? `${bait}${g.tackle.count(bait)}` : '';
    if (bk !== this.last.bait) {
      this.last.bait = bk;
      this.baitChip.classList.toggle('hidden', !bait);
      if (bait) { clear(this.baitChip).append(h('i.bait-dot', { style: { background: BAITS[bait].color } }), h('span', BAITS[bait].name), h('span.num', `×${g.tackle.count(bait)}`)); }
    }

    // Waypoint chip: name, distance, and an arrow that points the way
    const wi = g.wpInfo;
    this.wpChip.classList.toggle('hidden', !wi);
    if (wi) {
      const wk = `${wi.name}|${wi.dist}`;
      if (wk !== this.last.wp) { this.wpChip.querySelector('.wp-name').textContent = wi.name; this.wpChip.querySelector('.wp-dist').textContent = `${wi.dist} m`; this.last.wp = wk; }
      this.wpChip.querySelector('.wp-arrow').style.transform = `rotate(${(-wi.rel * 180) / Math.PI - 45}deg)`; // the icon itself points up-right
    }

    // Zone label
    const zone = g.currentZoneLabel();
    if (zone !== this.last.zone) { this.zoneLabel.textContent = zone; this.last.zone = zone; }

    // World prompt: the E action floats over whatever it acts on (or over your head)
    const acts = g.contextActions();
    const ak = acts.map((a) => `${a.id}:${a.label}`).join('|');
    if (ak !== this.last.acts) {
      clear(this.contextBox);
      const ek = g.keymap ? keyName(g.keymap.keyFor('interact') || 'e') : 'E';
      acts.forEach((a, i) => this.contextBox.append(h(`button.prompt-btn.${a.color || 'blue'}${i === 0 ? '.main' : ''}`, { on: { click: () => { g.audio.unlock(); a.fn(); } } }, i === 0 ? h('kbd', ek) : null, h('span', a.label))));
      this.contextBox.classList.toggle('hidden', !acts.length);
      this.last.acts = ak;
    }
    if (acts.length) this.placePrompt(acts[0]);
    // Quiet HUD: fade the chrome while you fish or sit idle; any input brings it back
    const idle = performance.now() - (g.player.lastInput || 0) > 6000;
    const quiet = (g.fishing.state !== 'idle' || idle) && !this.modalOpen;
    if (quiet !== this.last.quiet) { this.hud.classList.toggle('quiet', quiet); this.last.quiet = quiet; }

    // "!" over the player's head
    if (!this.bang.classList.contains('hidden')) {
      const s = g.engine.toScreen(g.actor.headWorld());
      if (s) { this.bang.style.left = `${s.x}px`; this.bang.style.top = `${s.y}px`; }
    }
    this.updatePlates();
  }

  // Keep the prompt over its anchor, inside the screen.
  placePrompt(a) {
    const g = this.game;
    // v1.12.1: your own actions (go ashore, sit, launch...) sit in a fixed dock above the hotbar, out of the way of
    // where you click to cast; only actions on a thing (Gus, a shop, a trap) float over that thing
    this.contextBox.classList.toggle('docked', !a.at);
    if (!a.at) {
      const W = this.root.clientWidth || window.innerWidth, H = this.root.clientHeight || window.innerHeight;
      const bar = this.hud?.querySelector?.('.hud-bottom')?.getBoundingClientRect?.();
      const y = bar && bar.top > H * 0.5 ? bar.top - 12 : H - 110;
      if (this.promptAt?.docked && Math.abs(this.promptAt.y - y) < 4) return;
      this.promptAt = { x: W / 2, y, docked: true };
      this.contextBox.style.left = `${Math.round(W / 2)}px`;
      this.contextBox.style.top = `${Math.round(y)}px`;
      return;
    }
    const at = a.at ? { x: a.at.x, y: (a.at.y ?? g.player.pos.y) + (a.at.h ?? 1.6), z: a.at.z } : null;
    let s = null;
    if (at) s = g.engine.toScreen(at);
    if (!s) { const hw = g.actor.headWorld(); s = g.engine.toScreen({ x: hw.x, y: hw.y + 0.9, z: hw.z }); }
    const W = this.root.clientWidth || window.innerWidth, H = this.root.clientHeight || window.innerHeight;
    const bw = this.contextBox.offsetWidth || 160, bh = this.contextBox.offsetHeight || 40;
    const x = s ? Math.max(bw / 2 + 8, Math.min(W - bw / 2 - 8, s.x)) : W / 2;
    const y = s ? Math.max(bh + 70, Math.min(H - 90, s.y)) : H - 120;
    // a small dead zone, and no moving at all while the pointer is on it, so it is easy to click
    const lx = this.promptAt?.x ?? -1e9, ly = this.promptAt?.y ?? -1e9;
    if (this.promptHover || (Math.abs(x - lx) < 4 && Math.abs(y - ly) < 4)) return;
    this.promptAt = { x, y };
    this.contextBox.style.left = `${Math.round(x)}px`;
    this.contextBox.style.top = `${Math.round(y)}px`;
  }

  // Count a number up (or down) to its new value.
  tick(chip, from, to) {
    const v = chip.querySelector('.v');
    if (from == null || Math.abs(to - from) < 1 || document.body.classList.contains('reduced')) { v.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 650;
    chip.classList.toggle('gain', to > from); chip.classList.toggle('spend', to < from);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      v.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else { v.textContent = fmt(to); setTimeout(() => chip.classList.remove('gain', 'spend'), 300); }
    };
    requestAnimationFrame(step);
  }

  // ---------- nameplates & bubbles over remote players (and you) ----------
  updatePlates() {
    const g = this.game;
    const seen = new Set();
    const show = g.profile.settings.showNames;
    for (const r of g.remotePlates()) {
      seen.add(r.id);
      let el = this.plates.get(r.id);
      if (!el) {
        el = { plate: h('div.nameplate'), extra: h('div.bubble.hidden'), key: '' };
        this.plateLayer.append(el.plate, el.extra);
        this.plates.set(r.id, el);
      }
      const pt = r.party;
      const k = `${r.name}|${r.title}|${r.level}|${r.crown}|${pt ? `${pt.color}|${pt.leader}|${pt.dist >= 60 ? Math.round(pt.dist / 10) : 'near'}|${pt.edge != null}` : ''}`;
      if (k !== el.key) {
        // v1.11: party members get a coloured marker over their heads, and how far away they are
        clear(el.plate).append(...[
          pt ? h('span.party-mark', { style: { '--pc': pt.color } }, pt.leader ? icon('crown') : h('i')) : null,
          r.name,
          h('small', pt && pt.dist >= 60 ? `${pt.dist} m away` : [r.level ? `Lv ${r.level}` : '', r.title ? ` · ${r.title}` : ''].join(''))].filter(Boolean));
        el.plate.classList.toggle('gold', !!r.crown);
        el.plate.classList.toggle('party', !!pt);
        el.plate.classList.toggle('edge', pt?.edge != null);
        if (pt) el.plate.style.setProperty('--pc', pt.color);
        el.key = k;
      }
      const s = r.screen;
      el.plate.style.display = s && (show || pt) && !r.isMe ? 'block' : 'none';
      if (s) { el.plate.style.left = `${s.x}px`; el.plate.style.top = `${s.y - 6}px`; }
      if (pt?.edge != null) el.plate.style.setProperty('--edge', `${pt.edge}rad`);
      // emote / show-off bubble
      if (r.bubble && s) {
        const bk = `${r.bubble.kind}|${r.bubble.key}`;
        if (el.bubbleKey !== bk) {
          clear(el.extra);
          el.extra.className = r.bubble.kind === 'showoff' ? 'showoff paper' : r.bubble.kind === 'zzz' ? 'zzz' : r.bubble.kind === 'chat' ? 'chat-bubble paper' : 'bubble';
          if (r.bubble.kind === 'showoff') el.extra.append(h('img', { src: fishThumb(r.bubble.speciesId, r.bubble.variant) }));
          else el.extra.textContent = r.bubble.text;
          el.bubbleKey = bk;
        }
        el.extra.classList.remove('hidden');
        el.extra.style.left = `${s.x}px`;
        el.extra.style.top = `${s.y - (r.isMe ? (r.bubble.kind === 'chat' ? 10 : 4) : 30)}px`;
      } else { el.extra.classList.add('hidden'); el.bubbleKey = ''; }
    }
    for (const [id, el] of this.plates) if (!seen.has(id)) { el.plate.remove(); el.extra.remove(); this.plates.delete(id); }
  }

  // ---------- meters ----------
  setPower(p) {
    this.power.classList.remove('hidden');
    this.power.firstChild.style.width = `${Math.round(p * 100)}%`;
    clearTimeout(this.powerHide);
    this.powerHide = setTimeout(() => this.power.classList.add('hidden'), 250);
  }
  showBang() { this.bang.classList.remove('hidden'); }
  hideBang() { this.bang.classList.add('hidden'); }
  showReel(reel, bite) {
    this.reelEl.classList.remove('hidden');
    this.reelEl.classList.toggle('junk', !!reel.junk);
    if (!reel.junk) this.reelEl.querySelector('.tug-fish').src = fishThumb(bite.speciesId, bite.variant);
    if ((this.game.profile.catchCount || 0) < 4 && !reel.relaxed && !reel.junk) this.reelHint.classList.remove('hidden');
    // the line rating, and a warning when this fish is past it
    let lim = this.reelEl.querySelector('.tug-limit');
    if (!lim) { lim = h('div.tug-limit'); this.reelEl.append(lim); }
    lim.textContent = reel.junk || !reel.rating ? '' : reel.overweight ? `Too heavy for your ${reel.rating} lb line!` : `Line rating ${reel.rating} lb`;
    lim.classList.toggle('warn', !!reel.overweight);
    this.updateReel(reel);
  }
  updateReel(r) {
    const el = this.reelEl;
    if (r.junk) { el.querySelector('.tug-spool > i').style.width = `${Math.min(1, r.progress) * 100}%`; return; }
    const T = Math.min(1, r.tension);
    el.querySelector('.tug-needle').setAttribute('transform', `rotate(${-90 + T * 180} 100 96)`);
    const state = r.strain > 0.05 || T >= 0.82 ? 'danger' : T >= 0.62 ? 'high' : T >= 0.2 ? 'good' : 'slack';
    if (state !== el.dataset.state) {
      el.dataset.state = state;
      el.querySelector('.tug-word').textContent = { danger: 'Ease off!', high: 'Steady…', good: r.align > 0.75 ? 'Sweet spot!' : 'Reeling', slack: r.holding ? 'Reel!' : 'Slack line' }[state];
    }
    if (state === 'good') el.querySelector('.tug-word').textContent = r.align > 0.75 ? 'Sweet spot!' : 'Reeling';
    // which way to angle the rod: against the pull
    const want = -r.pull;
    const miss = 1 - r.align;
    el.querySelector('.tug-left').classList.toggle('on', want < -0.2 && miss > 0.25);
    el.querySelector('.tug-right').classList.toggle('on', want > 0.2 && miss > 0.25);
    el.querySelector('.tug-rod').style.left = `${50 + r.rodX * 40}%`;
    el.querySelector('.tug-pull').style.left = `${50 - r.pull * 40}%`;
    el.querySelector('.tug-spool > i').style.width = `${Math.max(0, Math.min(1, r.progress)) * 100}%`;
    el.querySelector('.tug-fish').style.left = `${Math.max(0, Math.min(1, r.progress)) * 100}%`;
    el.querySelector('.tug-stamina > i').style.width = `${r.stamina * 100}%`;
    el.classList.toggle('shake', r.strain > 0.05);
  }
  tugCue(kind) {
    if (kind !== 'leap') return;
    const c = h('div.tug-cue', 'It leaps! Let go!');
    this.reelEl.append(c);
    setTimeout(() => c.remove(), 1100);
  }
  hideReel() { this.reelEl.classList.add('hidden'); this.reelHint.classList.add('hidden'); }

  hint(text, ms = 0) {
    this.hintEl.textContent = text;
    this.hintEl.classList.toggle('hidden', !text);
    clearTimeout(this.hintT);
    if (ms) this.hintT = setTimeout(() => this.hintEl.classList.add('hidden'), ms);
  }

  // ---------- toasts ----------
  // One queue, top centre: an icon by type, repeats merge into one line with a count.
  toast(text, opts = {}) {
    const key = `${opts.title || ''}|${text}`;
    const same = [...this.toasts.children].find((t) => t.dataset.key === key);
    const ms = opts.ms || 3200;
    if (same) {
      const n = (+same.dataset.n || 1) + 1;
      same.dataset.n = n;
      let c = same.querySelector('.toast-n');
      if (!c) { c = h('span.toast-n.num'); same.append(c); }
      c.textContent = `×${n}`;
      clearTimeout(same._t); same._t = setTimeout(() => this.dropToast(same), ms);
      same.classList.remove('bump'); void same.offsetWidth; same.classList.add('bump');
      return;
    }
    const kind = opts.cls === 'ach' ? 'ach' : opts.icon === 'coin' || opts.icon === 'pearl' ? 'money' : opts.kind || 'info';
    const ic = opts.icon || (kind === 'ach' ? 'trophy' : 'info');
    const el = h(`div.toast.paper.t-${kind}${opts.cls ? `.${opts.cls}` : ''}`, { 'data-key': key }, h('span.toast-ic', icon(ic)), h('div.toast-txt', opts.title ? h('span.t', opts.title) : null, h('span', text)));
    this.toasts.append(el);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    el._t = setTimeout(() => this.dropToast(el), ms);
  }
  dropToast(el) { el.classList.add('out'); setTimeout(() => el.remove(), 200); }

  achievementToast(a) {
    this.toast(a.name, { title: `${a.tier[0].toUpperCase()}${a.tier.slice(1)} achievement`, icon: 'trophy', cls: 'ach', ms: 4200 });
  }

  // ---------- feed ----------
  addFeed(entry, live = true) {
    if (!this.game.profile.settings.showFeed) return;
    const p = entry.payload || {};
    let color = '#b8b8b8', text;
    if (entry.kind === 'catch') {
      const sp = SPECIES_BY_ID[p.speciesId];
      if (!sp) return;
      color = p.variant === 'diamond' ? '#7ae0f0' : p.variant === 'gold' ? '#f2c040' : TIER_INFO[sp.tier].color;
      const vname = p.variant === 'normal' ? '' : `${p.variant === 'diamond' ? 'Diamond' : 'Gold'} `;
      text = [h('b', entry.name), ` landed a ${vname}${sp.name} (${lb(p.weight)})${p.record ? ' — lake record!' : ''}`];
    } else if (entry.kind === 'achievement') {
      color = ACH_TIER_COLOR.gold;
      text = [h('b', entry.name), ' earned a gold achievement'];
    } else if (entry.kind === 'champion') {
      color = '#f2c040';
      text = [h('b', entry.name), ' was crowned Top Angler of the week!'];
    } else if (entry.kind === 'join') { text = [h('b', entry.name), ' paddled in.']; color = '#8ac0e0'; }
    else if (entry.kind === 'leave') { text = [h('b', entry.name), ' headed home.']; color = '#8a8a8a'; }
    else if (entry.kind === 'system') { text = p.text; color = p.color || '#b8b8b8'; }
    else return;
    const thumb = entry.kind === 'catch' ? h('img.zoomable', { src: fishThumb(p.speciesId, p.variant), style: { width: '30px', height: '20px', imageRendering: 'pixelated' }, on: { click: () => openFishViewer(this.root, { speciesId: p.speciesId, variant: p.variant, weight: p.weight, sub: entry.name ? `caught by ${entry.name}` : '' }) } }) : null;
    const rx = entry.kind === 'catch' && entry.userId !== this.game.save.userId && entry.id
      ? h('span.rx', ['\u{1F44F}', '\u{1F62E}', '❤️'].map((e) => h('button', { on: { click: (ev) => { ev.stopPropagation(); this.game.react(entry, e); ev.target.disabled = true; } } }, e))) : null;
    const el = h('div.feed-item', { style: { '--c': color } }, thumb, h('span', text), rx);
    this.feedEl.prepend(el);
    while (this.feedEl.children.length > 5) this.feedEl.lastChild.remove();
    setTimeout(() => el.classList.add('fade'), live ? 12000 : 6000);
    setTimeout(() => el.remove(), live ? 13200 : 7200);
  }

  // ---------- reveal card ----------
  countUp(el, w, big) {
    const t0 = performance.now(), dur = big ? 1300 : 900;
    el.classList.add('counting');
    let lastTick = 0;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = lb(w * e);
      if (now - lastTick > 70 && k < 1) { lastTick = now; this.game.audio.sfx('tick'); }
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
      else { el.textContent = lb(w); el.classList.remove('counting'); el.classList.add('landed'); if (big) this.game.audio.sfx('coin'); }
    };
    requestAnimationFrame(step);
  }

  showReveal(summary, c) {
    let weightEl;
    return new Promise((resolve) => {
      const sp = summary.species;
      const tier = TIER_INFO[sp.tier];
      const variant = c.variant;
      const vname = variant === 'diamond' ? 'Diamond ' : variant === 'gold' ? 'Gold ' : '';
      const bannerColor = variant === 'diamond' ? '#3ab0d0' : variant === 'gold' ? '#d89a20' : tier.color;
      const tags = [];
      if (summary.newSpecies) tags.push(['New species', '#c8503a']);
      else if (summary.newSlot && variant !== 'normal') tags.push(['New variant', '#c8503a']);
      if (summary.record) tags.push(['Lake record', '#8e5bc4']);
      else if (summary.personalBest && !summary.newSpecies) tags.push(['Personal best', '#4a90e2']);
      if (summary.bigOne) tags.push(['Big one!', '#5eae3e']);
      if (summary.levelUp) tags.push([`Level ${summary.levelUp}!`, '#d89a20']);
      if (summary.daily) tags.push(['Daily bonus: 25 coins and a pearl', '#6e5640']);
      if (c.answer) tags.push(["Claude's Catch", '#c8901a']);
      for (const w of traitWords(c.traits)) tags.push([`One of a kind: ${w}`, '#7a5ac8']);
      if (c.bait && BAITS[c.bait]) tags.push([`on ${BAITS[c.bait].name}`, '#6e5640']);
      const filt = this.game.traits?.filter(c) || '';
      const ti = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].indexOf(sp.tier);
      const pic = h(`div.pic.zoomable${variant !== 'normal' ? `.${variant}` : ''}${ti >= 2 || variant !== 'normal' ? '.rays' : ''}`, { title: 'Look closer', on: { click: () => openFishViewer(this.root, { speciesId: sp.id, variant, weight: c.weight, sub: ZONES[c.zone]?.name }) } }, h('img', { src: fishThumb(sp.id, variant), style: filt ? { filter: filt } : {} }));
      const nameIn = h('input.name-fish', { placeholder: 'Name this fish (optional)', maxLength: 20, on: { change: (e) => { const n = this.game.traits.setName(c, e.target.value); if (n) this.game.ext.bump('named'); } } });
      const close = (action) => { this.game.audio.sfx('click'); card.remove(); scrim.remove(); resolve(action); };
      // One clear primary (keep), money choices beside each other, the rest as quiet extras.
      const actions = [], extras = [];
      if (summary.where === 'creel' || summary.where === 'storage') {
        actions.push(h('button.btn.green.large', { on: { click: () => close('keep') } }, icon('check'), summary.where === 'creel' ? 'Keep it' : 'Send to storage'));
        actions.push(h('button.btn.gold', { on: { click: () => close('sell') } }, 'Sell', h('span.price', h('img', { src: iconURL('coin') }), fmt(summary.value))));
        if (canTrade(c)) actions.push(h('button.btn.blue', { on: { click: () => close('trade') } }, 'Trade', h('span.price', h('img', { src: iconURL('pearl') }), tradePearls(c.speciesId, c.variant))));
        actions.push(h('button.btn.ghost', { on: { click: () => close('release') } }, icon('waves'), 'Release', h('span.xp', '+5 XP')));
        extras.push(h('button.btn.ghost.small.selfie-btn', { title: 'Keep it and take a selfie with it', on: { click: () => close('selfie') } }, icon('camera'), 'Selfie'));
        extras.push(h('button.btn.ghost.small.card-btn', { title: 'Make a shareable catch card', on: { click: () => openCatchCard(this.game, c) } }, icon('star'), 'Catch card'));
      } else actions.push(h('button.btn.green.large', { on: { click: () => close('keep') } }, `Sold for ${fmt(summary.autoSold || 0)} coins (backpack full)`));
      const card = h('div.reveal.paper', { role: 'dialog', 'aria-label': `You caught a ${vname}${sp.name}` },
        h('div.banner', { style: { background: bannerColor }, 'data-mark': ({ common: '●', uncommon: '▲', rare: '◆', epic: '★', legendary: '♛', mythic: '✦' })[sp.tier] }, `${vname}${tier.name}`),
        pic,
        h('h3', `${vname}${sp.name}`),
        h('div.stats', (weightEl = h('span.weight', lb(c.weight))), h('span', ZONES[c.zone]?.name || ''), h('span', `+${summary.xp} XP`)),
        h('div.tags', tags.map(([t, col]) => h('span.pill', { style: { '--c': col } }, t))),
        summary.where === 'creel' || summary.where === 'storage' ? nameIn : null,
        h('div.actions', actions),
        extras.length ? h('div.more-acts', extras) : null);
      const scrim = h('div.scrim', { style: { background: 'rgba(20,12,6,0.15)' } });
      this.root.append(scrim, card);
      if (variant !== 'normal' || ['legendary', 'mythic'].includes(sp.tier)) this.sparkles(pic, variant === 'diamond' ? '#a0f0ff' : '#ffe080');
      // big fish: the scale counts up like a slot machine
      const rel = (c.weight - sp.weight[0]) / (sp.weight[1] - sp.weight[0]);
      if (rel >= 0.6 || ti >= 3) this.countUp(weightEl, c.weight, summary.bigOne || rel >= 0.9);
      this.revealCard = card;
      this.focusFirst(card);
    });
  }

  showJunk(out) {
    return new Promise((resolve) => {
      const j = JUNK.find((x) => x.id === out.junkId);
      const lines = [];
      if (out.coins) lines.push(`+${out.coins} coins`);
      if (out.pearls) lines.push(`+${out.pearls} pearls`);
      const close = () => { this.game.audio.sfx('click'); card.remove(); scrim.remove(); resolve(); };
      const card = h('div.reveal.paper',
        h('div.banner', { style: { background: out.junkId === 'chest' ? '#d89a20' : '#8a7a6a' } }, out.junkId === 'chest' ? 'Treasure!' : out.junkId === 'bottle' ? 'A message!' : 'Junk'),
        h('div.pic', h('img', { src: junkThumb(out.junkId) })),
        h('h3', j?.name || 'Something'),
        out.message ? h('div.message', `“${out.message}”`) : null,
        out.playerBottle ? h('div.bottle-from', 'Written by another angler. ', h('button.btn.ghost.small', { on: { click: (e) => { this.game.bottles.report(out.playerBottle); e.target.disabled = true; e.target.textContent = 'Reported. Thanks!'; } } }, 'Report')) : null,
        lines.length ? h('div.stats', lines.join(' · ')) : null,
        h('div.actions', h('button.btn.green.large', { on: { click: close } }, icon('check'), 'Nice')));
      const scrim = h('div.scrim', { style: { background: 'rgba(20,12,6,0.15)' } });
      this.root.append(scrim, card);
    });
  }

  sparkles(el, color) {
    for (let i = 0; i < 24; i++) {
      const s = h('i.sparkle', { style: { left: `${40 + Math.random() * 20}%`, top: `${45 + Math.random() * 20}%`, background: i % 2 ? color : '#fff', '--dx': `${(Math.random() - 0.5) * 220}px`, '--dy': `${(Math.random() - 0.7) * 160}px`, animationDelay: `${Math.random() * 0.4}s` } });
      el.append(s);
      setTimeout(() => s.remove(), 1800);
    }
  }

  /** v1.11: the party frame (left side): who's in your party, where they are, and how far. */
  renderParty() {
    const g = this.game, P = g.party, el = this.partyFrame;
    if (!el) return;
    el.hidden = !P?.inParty;
    if (el.hidden) return;
    clear(el);
    const me = g.player.pos;
    el.append(h('div.pf-head', h('span', `Party ${P.members().length}/4`), h('button', { title: 'Leave the party (/leave)', on: { click: () => P.leave() } }, 'Leave')));
    for (const id of P.members()) {
      const self = id === P.me;
      const r = self ? null : g.remotes.byMeta(id);
      const where = self ? g.currentZoneLabel?.() : r?.peer.state ? regionName(r.pos.x, r.pos.z) : 'On the way';
      const d = r ? Math.round(Math.hypot(r.pos.x - me.x, r.pos.z - me.z)) : 0;
      el.append(h('button.pf-row', { style: { '--pc': P.color(id) }, title: self ? 'You' : `Open ${P.nameOf(id)} in Friends & Party`, on: { click: () => { this.sheets.state.socialTab = 'party'; this.sheets.open('social'); } } },
        P.state.ld === id ? icon('crown') : null,
        h('span.grow', self ? `${P.nameOf(id)} (you)` : P.nameOf(id), h('small', `${where || ''}${!self && d ? ` · ${d} m` : ''}`))));
    }
  }

  /** v1.12: the level-up card: what just opened, and what's next. */
  levelCard(level, opened, next) {
    this.levelEl?.remove();
    const g = this.game;
    const close = () => { el.remove(); if (this.levelEl === el) this.levelEl = null; };
    const el = h('div.level-card.plank', { role: 'status' },
      h('div.lc-head', h('span.lc-badge', String(level)), h('div', h('b', `Level ${level}!`), h('span', opened.length ? 'New places to fish:' : next ? `Next: level ${next.level}` : 'You\'ve opened the whole valley.'))),
      opened.length ? h('ul.lc-list', opened.map((u) => h('li', icon(u.spot ? 'pin' : 'sparkles'), h('span', u.text), u.spot ? h('button.btn.ghost.on-dark.small', { on: { click: () => { g.markSpot(u.spot); close(); } } }, 'Show me') : null))) : null,
      opened.length && next ? h('div.lc-next', `Next at level ${next.level}: ${next.what}`) : null,
      h('button.btn.close-x.ghost.on-dark', { 'aria-label': 'Close', on: { click: close } }, icon('close')));
    this.levelEl = el;
    this.root.append(el);
    setTimeout(close, opened.length ? 12000 : 5000);
  }

  /** v1.13: a cast into water above your level came back: say which level it takes and where the lake's levels are. */
  gateCard(gate, lakeLevels, lakeName) {
    this.gateEl?.remove();
    const g = this.game, me = g.profile.level, L = lakeLevels;
    const close = () => { el.remove(); if (this.gateEl === el) this.gateEl = null; clearTimeout(t); };
    const nm = gate.name.replace(/^the /, 'The ');
    const why = gate.tier === 'base' ? `Nothing in ${lakeName} will bite for you yet, so your line came back. Fishing anywhere here takes level ${gate.level}.`
      : gate.tier === 'deep' ? `The fish in ${lakeName}'s deep end only bite for level ${gate.level}+ anglers, so your line came back.`
        : `${nm} is ${lakeName}'s landmark. Only level ${gate.level}+ anglers can fish there, so your line came back.`;
    const row = (lv, txt) => h('li', h('span.gc-lv', me >= lv ? icon('check') : `Lv ${lv}`), h('span', txt));
    const el = h('div.level-card.gate-card.plank', { role: 'alertdialog', 'aria-label': `Needs fishing level ${gate.level}` },
      h('div.lc-head', h('span.lc-badge.gate', String(gate.level)), h('div', h('b', `Needs fishing level ${gate.level}`), h('span', `You're level ${me}.`))),
      h('p.gc-why', why),
      h('ul.lc-list', row(L.base, `${lakeName}: anywhere in the lake`), row(L.deep.level, 'The deep end'), row(L.poi.level, `${L.poi.name.replace(/^the /, 'The ')}: the landmark`)),
      h('div.gc-acts', h('button.btn.ghost.on-dark.small', { on: { click: () => { close(); this.sheets.open('map'); } } }, icon('map'), 'Open the map'), h('button.btn.green.small', { on: { click: close } }, 'Got it')),
      h('button.btn.close-x.ghost.on-dark', { 'aria-label': 'Close', on: { click: close } }, icon('close')));
    this.gateEl = el;
    this.root.append(el);
    const t = setTimeout(close, 20000);
  }

  /** v1.13.2: how to link Claude, so the game hears when Claude is thinking and when the answer is ready. */
  claudeHelp() {
    this.claudeHelpEl?.remove();
    const g = this.game;
    const CMD = '/plugin install reel-time --marketplace mebessusn/reel-time-plugin';
    const close = () => { el.remove(); if (this.claudeHelpEl === el) this.claudeHelpEl = null; };
    const code = h('code.ch-cmd', CMD);
    const copy = h('button.btn.green.small', { on: { click: async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(CMD); ok = true; } catch { /* the panel may not allow the clipboard */ }
      if (!ok) { const r = document.createRange(); r.selectNodeContents(code); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
      copy.textContent = ok ? 'Copied' : 'Selected: press Ctrl+C';
    } } }, icon('check'), 'Copy');
    const el = h('div.level-card.claude-help.plank', { role: 'dialog', 'aria-label': 'Link Claude' },
      h('div.lc-head', h('span.lc-badge.gate', icon('sparkles')), h('div', h('b', 'A golden fish for every answer'), h('span', 'Link Claude once and it just works from then on.'))),
      h('ol.ch-steps',
        h('li', 'In Claude Code (a terminal, or the Code tab in the Claude desktop app), run:', h('div.ch-row', code, copy)),
        h('li', 'Choose your user scope when it asks, so it works in every session.'),
        h('li', 'Playing on your own lake (your own copy of Reel Time)? Run /reel-time:lake and paste this lake\'s link, so the signal reaches it.'),
        h('li', 'Send Claude any prompt. A "Claude is thinking" timer appears up here, and when Claude finishes, a bell rings and your next cast hooks a golden fish.')),
      h('p.gc-why', 'Plain Claude chats can\'t tell the game when Claude is thinking yet, so golden fish need Claude Code.'),
      h('div.gc-acts', h('button.btn.ghost.on-dark.small', { on: { click: () => { g.ext.change((d) => { d.claudeHintHiddenUntil = Date.now() + 7 * 86400000; }); close(); } } }, 'Hide this for a week'), h('button.btn.green.small', { on: { click: close } }, 'Got it')),
      h('button.btn.close-x.ghost.on-dark', { 'aria-label': 'Close', on: { click: close } }, icon('close')));
    this.claudeHelpEl = el;
    this.root.append(el);
  }

  /** v1.11: a party invite or friend request: Accept / Decline, gone after 30 s. */
  askInvite({ kind, name, yes }) {
    this.inviteCard?.remove();
    const done = () => { card.remove(); if (this.inviteCard === card) this.inviteCard = null; clearTimeout(t); };
    const card = h('div.invite-card.plank', { role: 'alertdialog', 'aria-label': kind === 'party' ? 'Party invite' : 'Friend request' },
      icon(kind === 'party' ? 'users' : 'heart'),
      h('div.ic-txt', h('b', kind === 'party' ? `${name} invited you to their party` : `${name} wants to be friends`), h('span', kind === 'party' ? 'Party members see each other anywhere, share party chat and can ride in each other\'s boats.' : 'Friends show up in your Friends list whenever they\'re on the lake.')),
      h('button.btn.green.small', { on: { click: () => { done(); yes(); } } }, icon('check'), 'Accept'),
      h('button.btn.ghost.on-dark.small', { on: { click: () => done() } }, 'Decline'),
      h('div.ic-bar', h('i', { style: { animationDuration: '30s' } })));
    this.inviteCard = card;
    this.root.append(card);
    this.game.audio?.sfx('bell');
    const t = setTimeout(done, 30000);
  }

  /** v1.10: the Admin button appears for the owner, Editors and the staff list. */
  showAdmin(on) { if (this.adminBtn) this.adminBtn.hidden = !on; }

  // ---------- emote wheel (v1.10: a proper radial menu) ----------
  // Point at a slice (mouse direction from the middle picks it), click to play. Number keys 1-8 play one
  // straight away, arrow keys move around the ring, Enter plays, Esc or R closes.
  toggleWheel() {
    if (this.wheel) { this.wheel.remove(); this.wheelScrim.remove(); this.wheel = null; window.removeEventListener('keydown', this.wheelKeys, true); return; }
    const owned = new Set(this.game.profile.owned);
    const list = EMOTES.map((e) => ({ ...e, locked: !!(e.item && !owned.has(e.item)) }));
    const n = list.length, S = 320, C = S / 2, R1 = 64, R2 = 150, gap = 0.035;
    const NS = 'http://www.w3.org/2000/svg';
    const pt = (r, a) => `${(C + Math.cos(a) * r).toFixed(2)} ${(C + Math.sin(a) * r).toFixed(2)}`;
    const slice = (i) => {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n + gap, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n - gap;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      return `M ${pt(R1, a0)} L ${pt(R2, a0)} A ${R2} ${R2} 0 ${large} 1 ${pt(R2, a1)} L ${pt(R1, a1)} A ${R1} ${R1} 0 ${large} 0 ${pt(R1, a0)} Z`;
    };
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${S} ${S}`); svg.setAttribute('class', 'wheel-ring'); svg.setAttribute('aria-hidden', 'true');
    const paths = list.map((e, i) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', slice(i)); p.setAttribute('class', `seg${e.locked ? ' locked' : ''}`); svg.append(p); return p; });
    const hubIcon = h('span.hub-ico'), hubName = h('b.hub-name'), hubHint = h('span.hub-hint');
    const hub = h('div.wheel-hub', hubIcon, hubName, hubHint);
    let sel = -1;
    const play = (i) => {
      const e = list[i];
      if (!e) return;
      if (e.locked) { this.game.audio.sfx('miss'); this.toast(`${e.label} is sold at Gus's shop.`, { icon: 'shop' }); return; }
      this.toggleWheel(); this.game.emote(e.id);
    };
    const pick = (i) => {
      if (i === sel) return;
      sel = i;
      paths.forEach((p, k) => p.classList.toggle('on', k === i));
      buttons.forEach((b, k) => b.classList.toggle('on', k === i));
      const e = list[i];
      clear(hubIcon); clear(hubName); clear(hubHint);
      if (!e) { hubIcon.append(icon('smile')); hubName.textContent = 'Emotes'; hubHint.textContent = 'Point at one and click'; return; }
      hubIcon.append(icon(e.locked ? 'lock' : e.icon)); hubName.textContent = e.label; hubHint.textContent = e.locked ? "Buy it at Gus's shop" : `Click or press ${i + 1}`;
      this.game.audio.sfx('tick', { vol: 0.35 });
    };
    const buttons = list.map((e, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2, r = (R1 + R2) / 2;
      return h(`button.wheel-opt${e.locked ? '.locked' : ''}`, { 'aria-label': e.locked ? `${e.label} (locked)` : e.label, style: { left: `${C + Math.cos(a) * r}px`, top: `${C + Math.sin(a) * r}px` },
        on: { click: (ev) => { ev.stopPropagation(); play(i); }, mouseenter: () => pick(i), focus: () => pick(i) } },
        h('span.wo-ico', icon(e.locked ? 'lock' : e.icon)), h('span.wo-name', e.label), h('kbd', String(i + 1)));
    });
    this.wheelScrim = h('div.scrim.wheel-scrim', { on: { click: () => this.toggleWheel() } });
    this.wheel = h('div.wheel', { role: 'menu', 'aria-label': 'Emotes',
      on: {
        pointermove: (ev) => {
          const r = this.wheel.getBoundingClientRect(), dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
          if (Math.hypot(dx, dy) < R1 * (r.width / S) * 0.8) { pick(-1); return; }
          const a = Math.atan2(dy, dx) + Math.PI / 2 + Math.PI / n;
          pick(((Math.floor((a / (Math.PI * 2)) * n) % n) + n) % n);
        },
        click: (ev) => { if (ev.target.closest('.wheel-opt')) return; if (sel >= 0) play(sel); else this.toggleWheel(); },
      } }, svg, buttons, hub);
    this.wheelKeys = (ev) => {
      if (!this.wheel) return;
      const k = ev.key;
      if (/^[1-9]$/.test(k) && +k <= n) { ev.preventDefault(); ev.stopPropagation(); play(+k - 1); }
      else if (k === 'ArrowRight' || k === 'ArrowDown') { ev.preventDefault(); ev.stopPropagation(); pick(((sel < 0 ? -1 : sel) + 1) % n); }
      else if (k === 'ArrowLeft' || k === 'ArrowUp') { ev.preventDefault(); ev.stopPropagation(); pick(((sel < 0 ? 0 : sel) - 1 + n) % n); }
      else if (k === 'Enter' && sel >= 0) { ev.preventDefault(); ev.stopPropagation(); play(sel); }
    };
    window.addEventListener('keydown', this.wheelKeys, true);
    this.root.append(this.wheelScrim, this.wheel);
    pick(-1);
  }

  closeAll() {
    if (this.game.dialogue?.active) { this.game.dialogue.close(null); return; }
    if (this.game.selfie?.active) { this.game.selfie.stop(); return; }
    if (viewerOpen()) { closeViewer(); return; }
    if (this.wheel) this.toggleWheel();
    this.sheets.close();
  }

  get modalOpen() { return !!(this.game.dialogue?.active || this.game.menus?.open || document.querySelector('.menu-screen, .title-screen') || this.game.home?.active || this.game.selfie?.active || viewerOpen() || this.sheets.current || this.wheel || this.revealCard?.isConnected || document.querySelector('.creator') || document.querySelector('.splash')); }
}

export { avatarThumb };
