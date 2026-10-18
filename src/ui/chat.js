// Social: lake chat, whispers (DMs), and the system log. Wooden-plank panel in the game's style.
// Enter opens/sends, / starts a command, Esc leaves the box. Messages travel over whatever net
// the game uses (Supabase broadcast, artifact room presence, or tabs on this device).
import { h, clear } from './dom.js';
import { icon } from './icons.js';

const MAX_LEN = 160;
import { NEAR_RANGE } from '../game/party.js';
export const SAY_RANGE = NEAR_RANGE; // metres (about 40 yards): how far /say carries
// v1.11 channels: Say (nearby, the default), General (the whole lake), Party, and whispers
export const CHANNELS = { say: { label: 'Say', cmd: '/s', color: '#f4efe6' }, general: { label: 'General', cmd: '/g', color: '#8fd0ff' }, party: { label: 'Party', cmd: '/p', color: '#8ad86a' } };
const KEEP = 150; // messages kept per tab
const RATE_N = 5, RATE_MS = 8000; // you can send 5 lines per 8 s
const IN_RATE_N = 8, IN_RATE_MS = 10000; // drop floods from one sender
const EMOJI = ['\u{1F44B}', '\u{1F602}', '\u{1F60D}', '\u{1F41F}', '\u{1F3A3}', '\u{1F389}', '\u{1F44D}', '❤️', '\u{1F62E}', '\u{1F634}', '☀️', '\u{1F327}️'];
export const STRONG = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'asshole', 'bastard', 'slut', 'whore', 'fag', 'nigg', 'retard'];

export const SYSTEM_COLORS = {
  info: '#6e5640', join: '#3a78c2', leave: '#8a7a6a', catch: '#4a90e2', achievement: '#d89a20', level: '#d89a20',
  weather: '#4a7a9a', swirl: '#9b59d0', claude: '#c8701a', quest: '#5a8a2a', derby: '#c8503a', festival: '#d8507a', event: '#6a5ac8', trophy: '#c8901a', error: '#c8503a', record: '#9b59d0',
};

const clean = (s) => String(s || '')
  // strip control, zero-width and bidi characters
  .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁯﻿]/g, '')
  .replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);

function filterStrong(text) {
  let out = text;
  for (const w of STRONG) out = out.replace(new RegExp(w, 'gi'), (m) => m[0] + '★'.repeat(m.length - 1));
  return out;
}

const hhmm = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

const safe = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

export class Chat {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.n = Math.floor(Math.random() * 1000);
    this.tabs = new Map(); // key -> { key, label, msgs: [], unread, userId }
    this.active = 'lake';
    this.channel = 'say'; // v1.11: what plain typing goes to (sticky: /g, /p and /s switch it)
    this.sent = [];
    this.inLog = new Map(); // sender -> timestamps
    this.lastDmFrom = null;
    this.muted = new Set(safe.get('rt_muted', []));
    this.open = false; // v1.10: every session starts with the chat collapsed (a click or Enter opens it)
    this.history = []; this.histIdx = -1;
    this.addTab('lake', 'Chat');
    this.addTab('system', 'System');
    this.build();
  }

  get me() { return this.game.save?.userId; }
  get myName() { return this.game.profile?.name || 'Angler'; }
  settings() { return this.game.profile?.settings || {}; }

  setChannel(c, quiet = false) {
    if (c === 'party' && !this.game.party?.inParty) { this.system("You're not in a party. Invite someone from Friends & Party (or /invite name).", 'error'); return; }
    this.channel = c;
    if (this.tabs.get(this.active)?.userId) this.select('lake');
    this.updateCounter();
    if (!quiet) this.game.audio?.sfx?.('click');
  }
  cycleChannel() {
    const order = ['say', 'general', ...(this.game.party?.inParty ? ['party'] : [])];
    this.setChannel(order[(order.indexOf(this.channel) + 1) % order.length]);
    this.input.focus();
  }

  // ---------------- tabs ----------------
  addTab(key, label, userId = null) {
    if (!this.tabs.has(key)) this.tabs.set(key, { key, label, msgs: [], unread: 0, userId });
    return this.tabs.get(key);
  }
  dmKey(userId) { return `dm:${userId}`; }

  // ---------------- DOM ----------------
  /** v1.12: drag the grip in the chat's top-right corner to make it bigger or smaller (remembered on this device;
   * double-click it to go back to the normal size). The chat is pinned bottom-left, so up is taller, right is wider. */
  resizeGrip() {
    const KEY = 'rt_chat_size';
    const narrow = () => innerWidth <= 520;
    const apply = (sz) => {
      if (!this.panel) return;
      if (!sz || narrow()) { this.panel.style.width = ''; this.panel.style.height = ''; return; }
      const sc = this.panel.offsetWidth ? this.panel.getBoundingClientRect().width / this.panel.offsetWidth : 1;
      const w = Math.max(280, Math.min(sz.w, (innerWidth - 24) / sc, 900)), hh = Math.max(170, Math.min(sz.h, (innerHeight * 0.8) / sc, 760));
      this.panel.style.width = `${Math.round(w)}px`; this.panel.style.height = `${Math.round(hh)}px`;
    };
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* storage blocked */ }
    requestAnimationFrame(() => apply(saved));
    addEventListener('resize', () => apply(saved));
    let d = null;
    const grip = h('button.chat-grip', { type: 'button', title: 'Drag to resize chat (double-click to reset)', 'aria-label': 'Resize chat',
      on: {
        pointerdown: (e) => {
          e.preventDefault(); e.stopPropagation();
          const r = this.panel.getBoundingClientRect(), sc = r.width / this.panel.offsetWidth || 1;
          d = { x: e.clientX, y: e.clientY, w: this.panel.offsetWidth, h: this.panel.offsetHeight, sc };
          grip.setPointerCapture?.(e.pointerId);
          this.panel.classList.add('resizing');
        },
        pointermove: (e) => {
          if (!d) return;
          saved = { w: d.w + (e.clientX - d.x) / d.sc, h: d.h - (e.clientY - d.y) / d.sc };
          apply(saved);
          this.list.scrollTop = this.list.scrollHeight;
        },
        pointerup: () => {
          if (!d) return;
          d = null; this.panel.classList.remove('resizing');
          saved = { w: this.panel.offsetWidth, h: this.panel.offsetHeight };
          try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* ignore */ }
        },
        lostpointercapture: () => { if (d) { d = null; this.panel.classList.remove('resizing'); } },
        dblclick: () => { saved = null; apply(null); try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
        keydown: (e) => { // keyboard: arrows grow and shrink it
          const k = { ArrowUp: [0, 24], ArrowDown: [0, -24], ArrowRight: [32, 0], ArrowLeft: [-32, 0] }[e.key];
          if (!k) return;
          e.preventDefault(); e.stopPropagation();
          saved = { w: this.panel.offsetWidth + k[0], h: this.panel.offsetHeight + k[1] }; apply(saved);
          saved = { w: this.panel.offsetWidth, h: this.panel.offsetHeight };
          try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* ignore */ }
        },
      } });
    grip.innerHTML = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M1 4.5 7.5 11M1 1l10 10M4.5 1 11 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>';
    return grip;
  }

  build() {
    this.tabRow = h('div.chat-tabs');
    this.list = h('div.chat-list', { role: 'log', 'aria-live': 'polite' });
    this.input = h('input.chat-input', { type: 'text', maxLength: MAX_LEN, placeholder: 'Say something…  (Enter)', 'aria-label': 'Chat message', autocomplete: 'off', spellcheck: true });
    this.counter = h('span.chat-count', '');
    this.emojiBox = h('div.chat-emoji.paper.hidden', EMOJI.map((e) => h('button', { type: 'button', on: { click: () => { this.insert(e); this.emojiBox.classList.add('hidden'); } } }, e)));
    const emojiBtn = h('button.btn.ghost.small.chat-emoji-btn', { type: 'button', title: 'Emoji', on: { click: () => this.emojiBox.classList.toggle('hidden') } }, '\u{263A}');
    const sendBtn = h('button.btn.green.small', { type: 'button', on: { click: () => this.submit() } }, 'Send');
    this.chanBtn = h('button.chat-chan', { type: 'button', title: 'Channel (click to switch, or type /s, /g, /p)', on: { click: () => this.cycleChannel() } });
    this.target = h('div.chat-target.hidden');
    this.panel = h('div.chat-panel.plank',
      h('div.chat-head', icon('chat'), this.tabRow, this.resizeGrip(), h('button.chat-min', { type: 'button', title: 'Collapse chat (Enter opens it)', 'aria-label': 'Collapse chat', on: { click: () => this.setOpen(false) } }, icon('down'))),
      h('div.chat-body.paper', this.list, this.target),
      h('div.chat-row', this.chanBtn, emojiBtn, this.input, this.counter, sendBtn),
      this.emojiBox);
    this.peek = h('div.chat-peek');
    this.barTxt = h('span.chat-bar-txt', h('span.chat-bar-hint', 'Press Enter to chat'));
    this.barN = h('span.chat-bar-n.hidden');
    this.bar = h('button.chat-bar.plank', { type: 'button', 'aria-label': 'Open chat', on: { click: () => { this.setOpen(true); this.input.focus(); } } }, icon('chat'), this.barTxt, this.barN);
    this.menu = null;
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); this.submit(); this.input.blur(); } // back to the lake after sending
      else if (e.key === 'Escape') { e.preventDefault(); this.input.blur(); if (!this.input.value) this.setOpen(this.open); }
      else if (e.key === 'ArrowUp' && this.history.length) { e.preventDefault(); this.histIdx = Math.min(this.history.length - 1, this.histIdx + 1); this.input.value = this.history[this.histIdx]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this.histIdx = Math.max(-1, this.histIdx - 1); this.input.value = this.histIdx >= 0 ? this.history[this.histIdx] : ''; }
      else if (e.key === 'Tab') { e.preventDefault(); this.completeName(); }
    });
    this.input.addEventListener('keyup', (e) => e.stopPropagation());
    this.input.addEventListener('input', () => this.updateCounter());
    this.input.addEventListener('focus', () => { this.game.player?.keys.clear(); this.game.player && (this.game.player.sprint = false); this.panel.classList.add('typing'); });
    this.input.addEventListener('blur', () => this.panel.classList.remove('typing'));
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.append(this.peek, this.bar, this.panel);
    this.panel.addEventListener('pointermove', () => this.wake());
    this.renderTabs();
    this.renderList();
    this.setOpen(this.open, false);
    window.addEventListener('resize', () => this.measure());
    requestAnimationFrame(() => this.measure());
  }

  setOpen(v, save = true) {
    this.open = v;
    this.panel.classList.toggle('hidden', !v);
    this.peek.classList.toggle('hidden', v);
    this.bar.classList.toggle('hidden', v);
    this.wake();
    this.measure();
    if (v) { this.markRead(this.active); this.scrollDown(); }
    if (save) safe.set('rt_chat_open2', v); // kept for older builds; no longer read on load
    this.game.ui?.setChatBadge?.(this.totalUnread());
  }
  toggle() { this.setOpen(!this.open); }
  // The open panel fades back after a while with nothing new; new lines, hovering or typing wake it.
  wake() {
    this.panel.classList.remove('idle');
    clearTimeout(this.idleT);
    this.idleT = setTimeout(() => this.panel.classList.add('idle'), 7000);
  }
  // Lets the feed pop-ups sit above the open chat panel.
  measure() {
    const top = this.open ? Math.max(0, window.innerHeight - this.panel.getBoundingClientRect().top) : 0;
    document.documentElement.style.setProperty('--chat-top', `${Math.round(top)}px`);
  }

  // Enter from the game: open the box and focus it (optionally pre-filled).
  focus(prefill = '') {
    if (!this.open) this.setOpen(true);
    this.input.focus();
    if (prefill && !this.input.value) this.input.value = prefill;
    this.updateCounter();
  }
  get typing() { return document.activeElement === this.input; }

  insert(text) {
    const i = this.input.selectionStart ?? this.input.value.length;
    this.input.value = (this.input.value.slice(0, i) + text + this.input.value.slice(i)).slice(0, MAX_LEN);
    this.input.focus();
    this.updateCounter();
  }

  updateCounter() {
    const left = MAX_LEN - this.input.value.length;
    this.counter.textContent = left < 30 ? String(left) : '';
    const t = this.tabs.get(this.active);
    const dm = t?.userId ? t : null;
    if (this.channel === 'party' && !this.game.party?.inParty) this.channel = 'say';
    const ch = CHANNELS[this.channel];
    if (this.chanBtn) { this.chanBtn.textContent = dm ? 'Whisper' : ch.label; this.chanBtn.style.setProperty('--cc', dm ? '#e8a6ff' : ch.color); }
    this.input.placeholder = dm ? `Whisper to ${dm.label}…` : this.active === 'system' ? 'Type /help for commands' : this.channel === 'say' ? 'Say something to anglers nearby…' : this.channel === 'general' ? 'Talk to the whole lake…' : 'Talk to your party…';
  }

  renderTabs() {
    clear(this.tabRow);
    for (const t of this.tabs.values()) {
      const b = h(`button.chat-tab${t.key === this.active ? '.on' : ''}${t.userId ? '.dm' : ''}`, { type: 'button', on: { click: () => this.select(t.key) } },
        t.userId ? '@' : '', t.label, t.unread ? h('span.chat-unread', String(Math.min(99, t.unread))) : null);
      if (t.userId) b.append(h('span.chat-x', { title: 'Close', on: { click: (e) => { e.stopPropagation(); this.closeTab(t.key); } } }, '×'));
      this.tabRow.append(b);
    }
  }

  select(key) {
    this.active = key;
    this.markRead(key);
    this.renderTabs();
    this.renderList();
    this.updateCounter();
  }
  closeTab(key) {
    this.tabs.delete(key);
    if (this.active === key) this.active = 'lake';
    this.renderTabs(); this.renderList();
  }
  markRead(key) {
    const t = this.tabs.get(key);
    if (t && t.unread) { t.unread = 0; this.renderTabs(); }
    this.game.ui?.setChatBadge?.(this.totalUnread());
  }
  totalUnread() { let n = 0; for (const t of this.tabs.values()) if (t.key !== 'system') n += t.unread; return n; }

  renderList() {
    clear(this.list);
    const t = this.tabs.get(this.active);
    if (!t) return;
    if (!t.msgs.length) this.list.append(h('div.chat-empty', t.key === 'lake' ? 'Nobody has said anything yet. Say hi! Type /help for commands.' : t.key === 'system' ? 'Joins, big catches, weather and more show up here.' : `Whispers with ${t.label} are only shown to the two of you.`));
    for (const m of t.msgs) this.list.append(this.line(m));
    this.scrollDown();
  }
  scrollDown() { this.list.scrollTop = this.list.scrollHeight; }

  line(m) {
    const time = h('span.chat-time', { title: new Date(m.at).toLocaleString() }, hhmm(m.at));
    if (m.sys) return h('div.chat-line.sys', { style: { '--c': SYSTEM_COLORS[m.kind] || SYSTEM_COLORS.info } }, time, h('span.chat-text', m.text));
    const name = h('button.chat-name', { type: 'button', style: { color: m.self ? '#2e6a1e' : nameColor(m.userId) }, on: { click: (e) => this.nameMenu(e, m) } }, m.name);
    const tag = m.channel === 'general' || m.channel === 'party' ? h(`span.chat-ch.ch-${m.channel}`, CHANNELS[m.channel].label) : null;
    if (m.action) return h(`div.chat-line.act${m.channel === 'party' ? '.party' : ''}`, time, tag, h('span.chat-text', '* ', name, ` ${m.text}`));
    if (m.channel === 'party') return h('div.chat-line.party', time, tag, name, h('span.chat-colon', ':'), h('span.chat-text', ` ${m.text}`));
    if (m.local) return h('div.chat-line.say', time, name, h('span.chat-w', 'says'), h('span.chat-colon', ':'), h('span.chat-text', ` “${m.text}”`));
    const whisper = m.to ? h('span.chat-w', m.self ? `to ${m.toName || 'them'}` : 'whispers') : null;
    return h(`div.chat-line${m.to ? '.dm' : ''}`, time, m.to ? null : tag, name, whisper, h('span.chat-colon', ':'), h('span.chat-text', ` ${m.text}`));
  }

  nameMenu(e, m) {
    e.stopPropagation();
    this.menu?.remove();
    if (m.self || m.npc) return;
    const muted = this.muted.has(m.userId);
    const mod = this.game?.mod;
    const peer = [...(this.game?.net?.peers?.values() || [])].find((p) => (p.meta?.id || p.id) === m.userId || p.id === m.userId);
    const target = peer && mod ? { id: mod.idOf(peer), peer: peer.id, name: m.name } : null;
    const close = () => { this.menu?.remove(); this.menu = null; document.removeEventListener('pointerdown', close, true); };
    this.menu = h('div.chat-menu.paper',
      h('b', m.name),
      h('button.btn.blue.small', { on: { click: () => { close(); this.openDm(m.userId, m.name); } } }, 'Whisper'),
      // v1.11: party and friends
      peer && !this.game.party?.has(m.userId) ? h('button.btn.green.small', { on: { click: () => { close(); this.game.party.invite(m.userId); } } }, icon('users'), 'Invite to party') : null,
      peer && !this.game.party?.isFriend(m.userId, peer.by) ? h('button.btn.ghost.small', { on: { click: () => { close(); this.game.party.friendRequest(m.userId); } } }, icon('heart'), 'Add friend') : null,
      h(`button.btn.${muted ? 'green' : 'ghost'}.small`, { on: { click: () => { close(); muted ? this.unmute(m.userId, m.name) : this.mute(m.userId, m.name); } } }, muted ? 'Unmute' : 'Mute'),
      // v1.10: report to the admins; admins can moderate straight from here
      mod && target ? h('button.btn.ghost.small', { on: { click: () => { close(); mod.openReport(target); } } }, icon('shield'), 'Report') : null,
      mod?.isAdmin && target?.id ? h('button.btn.red.small', { on: { click: () => { close(); this.game.ui.sheets.state.adminTab = 'players'; this.game.ui.sheets.state.adminOpen = peer.id; this.game.ui.sheets.open('admin'); } } }, icon('gavel'), 'Moderate') : null);
    const r = this.panel.getBoundingClientRect();
    this.menu.style.left = `${Math.min(e.clientX - r.left, r.width - 120)}px`;
    this.menu.style.bottom = `${r.bottom - e.clientY + 6}px`;
    this.panel.append(this.menu);
    setTimeout(() => document.addEventListener('pointerdown', (ev) => { if (!this.menu?.contains(ev.target)) close(); }, { capture: true, once: true }), 0);
  }

  openDm(userId, name) {
    const t = this.addTab(this.dmKey(userId), name, userId);
    t.label = name;
    this.select(t.key);
    this.focus();
  }

  // ---------------- people ----------------
  people() {
    const out = [];
    for (const p of this.game.net?.peers?.values?.() || []) {
      const id = p.meta?.id; if (!id || id === this.me) continue;
      out.push({ userId: id, name: String(p.meta?.name || 'Angler').slice(0, 24), key: p.id });
    }
    return out;
  }
  // Longest-name match at the start of `rest` (names can contain spaces).
  matchName(rest) {
    const low = rest.toLowerCase();
    const ppl = this.people().sort((a, b) => b.name.length - a.name.length);
    let hit = ppl.find((p) => low === p.name.toLowerCase() || low.startsWith(`${p.name.toLowerCase()} `));
    if (hit) return { person: hit, rest: rest.slice(hit.name.length).trim() };
    const word = low.split(' ')[0];
    const pref = ppl.filter((p) => p.name.toLowerCase().startsWith(word));
    if (pref.length === 1) return { person: pref[0], rest: rest.slice(word.length).trim() };
    return { person: null, ambiguous: pref.length > 1, rest };
  }
  completeName() {
    const v = this.input.value;
    const m = v.match(/^(\/(?:w|whisper|dm|msg|tell|mute|unmute|invite|inv|kick|friend|report)\s+)(\S*)$/i);
    if (!m) return;
    const hit = this.people().find((p) => p.name.toLowerCase().startsWith(m[2].toLowerCase()));
    if (hit) this.input.value = `${m[1]}${hit.name} `;
  }

  mute(userId, name) {
    this.muted.add(userId); safe.set('rt_muted', [...this.muted]);
    this.system(`Muted ${name}. You won't see their messages or bubbles. /unmute ${name} to undo.`);
  }
  unmute(userId, name) {
    this.muted.delete(userId); safe.set('rt_muted', [...this.muted]);
    this.system(`Unmuted ${name}.`);
  }
  isMuted(userId) { return this.muted.has(userId); }

  // ---------------- sending ----------------
  submit() {
    const raw = clean(this.input.value);
    this.input.value = '';
    this.updateCounter();
    if (!raw) { this.input.blur(); return; }
    this.history.unshift(raw); this.history = this.history.slice(0, 30); this.histIdx = -1;
    if (raw.startsWith('/')) { this.command(raw); return; }
    const t = this.tabs.get(this.active);
    if (t?.userId) this.say(raw, { to: t.userId, toName: t.label });
    else this.say(raw, { channel: this.channel });
  }

  rateOk() {
    const now = Date.now();
    this.sent = this.sent.filter((t) => now - t < RATE_MS);
    if (this.sent.length >= RATE_N) { this.system(`Easy there! Wait ${Math.ceil((RATE_MS - (now - this.sent[0])) / 1000)}s before sending more.`, 'error'); return false; }
    this.sent.push(now);
    return true;
  }

  say(text, { to = null, toName = null, action = false, local = false, channel = null } = {}) {
    if (!this.rateOk()) return;
    const at = Date.now();
    const pp = this.game.player?.pos;
    const ch = to ? 'whisper' : channel || (local ? 'say' : 'general');
    const P = this.game.party;
    if (ch === 'party' && !P?.inParty) { this.system("You're not in a party.", 'error'); this.channel = 'say'; this.updateCounter(); return; }
    const m = { n: ++this.n, x: text, to, me: action || undefined, at, nm: this.myName };
    // Say: spoken out loud, only anglers within earshot hear it (a bubble pops over your head)
    if (ch === 'say' && pp) { m.say = 1; m.p = [Math.round(pp.x), Math.round(pp.z)]; }
    if (ch === 'general') m.g = 1;
    if (ch === 'party') m.pt = P.state.id;
    if (ch === 'general' && this.lastLake && this.lastLake.x === text && at - this.lastLake.at < 10000) { this.system('You just said that.', 'error'); return; }
    if (ch === 'general') this.lastLake = m;
    this.game.net?.sendChat?.(m);
    const msg = { at, userId: this.me, name: this.myName, text: this.show(text), to, toName, action, self: true, local: ch === 'say', channel: ch };
    if (to) this.push(this.dmKey(to), msg, toName); else this.push('lake', msg);
    if (!to && !action && ch !== 'general') this.game.onChatSaid?.(text, { force: true });
    if (!this.game.net?.connected || !this.game.net.peers?.size) this.system(to ? "You're the only one here right now, so nobody got that whisper." : "You're fishing solo right now. Messages will reach others once they join.", 'info', { once: 'solo' });
    else if (ch === 'say' && pp && !this.game.remotes?.within?.(pp, SAY_RANGE)) this.system('Nobody is close enough to hear you. Type /g to talk to the whole lake.', 'info', { once: 'say-alone' });
  }

  show(text) { return this.settings().chatFilter === false ? text : filterStrong(text); }

  command(raw) {
    const [cmdRaw, ...parts] = raw.slice(1).split(' ');
    const cmd = cmdRaw.toLowerCase();
    const rest = parts.join(' ').trim();
    switch (cmd) {
      case 'rules': case 'conduct':
        import('./conduct.js').then((m) => m.showConduct(this.game));
        break;
      case 'privacy':
        import('./privacy.js').then((m) => m.showPrivacy(this.game));
        break;
      case 'bug': case 'bugs':
        import('../game/reports.js').then((m) => m.openBugReport(this.game));
        break;
      case 'admin': case 'mod':
        if (this.game.mod?.isAdmin) this.game.ui.sheets.open('admin'); else this.system('Only lake admins can open the admin panel.', 'error');
        break;
      case 'report': {
        const r = this.matchName(rest);
        const person = r?.person;
        if (!person) { this.system('Who? Use /report name (Tab completes), or click their name in chat.', 'error'); break; }
        const peer = [...(this.game.net?.peers?.values() || [])].find((p) => (p.meta?.id || p.id) === person.userId || p.id === person.userId);
        this.game.mod?.openReport({ id: peer ? this.game.mod.idOf(peer) : null, peer: peer?.id, name: person.name });
        break;
      }
      case 'help': case '?':
        this.system('Chat: /s msg (Say, anglers within about 40 yards; the default) · /g msg (General, the whole lake) · /p msg (Party) · /w name msg (whisper) · /r msg (reply). /s, /g and /p alone switch where you type.');
        this.system('Party & friends: /invite name · /leave · /kick name · /friend name · /friends. Other: /rules · /report name · /bug · /me action · /who · /roll [max] · /mute name · /unmute name · /muted · /clear · /shrug. Tab completes names, ↑ recalls.');
        if (this.game.net?.kind === 'room') this.system('Whispers only show for you and the other angler, but they travel through the shared lake, so keep secrets out of them.');
        break;
      case 'w': case 'whisper': case 'dm': case 'msg': case 'tell': {
        const r = this.matchName(rest);
        if (!r.person) { this.system(r.ambiguous ? 'More than one angler matches that name. Type a bit more of it.' : `Nobody called “${rest.split(' ')[0] || '?'}” is on the lake right now.`, 'error'); break; }
        if (!r.rest) { this.openDm(r.person.userId, r.person.name); break; }
        this.addTab(this.dmKey(r.person.userId), r.person.name, r.person.userId);
        this.say(r.rest, { to: r.person.userId, toName: r.person.name });
        this.select(this.dmKey(r.person.userId));
        break;
      }
      case 'r': case 'reply': {
        if (!this.lastDmFrom) { this.system('No whispers to reply to yet.', 'error'); break; }
        if (!rest) { this.openDm(this.lastDmFrom.userId, this.lastDmFrom.name); break; }
        this.say(rest, { to: this.lastDmFrom.userId, toName: this.lastDmFrom.name });
        break;
      }
      case 'say': case 's': case 'local':
        this.setChannel('say', true);
        if (rest) this.say(rest, { channel: 'say' }); else this.system('Now talking in Say: anglers within about 40 yards hear you.', 'info');
        break;
      case 'g': case 'general': case 'lake': case 'yell':
        this.setChannel('general', true);
        if (rest) this.say(rest, { channel: 'general' }); else this.system('Now talking in General: the whole lake hears you.', 'info');
        break;
      case 'p': case 'party': {
        if (!this.game.party?.inParty) { this.system("You're not in a party. Invite someone with /invite name.", 'error'); break; }
        this.setChannel('party', true);
        if (rest) this.say(rest, { channel: 'party' }); else this.system('Now talking in Party.', 'info');
        break;
      }
      case 'invite': case 'inv': {
        const r = this.matchName(rest);
        if (!r.person) { this.system('Who? Use /invite name (Tab completes).', 'error'); break; }
        this.game.party?.invite(r.person.userId);
        break;
      }
      case 'leave': case 'leaveparty': if (this.game.party?.inParty) this.game.party.leave(); else this.system("You're not in a party.", 'error'); break;
      case 'kick': {
        const r = this.matchName(rest);
        if (!r.person || !this.game.party?.has(r.person.userId)) { this.system('Who? Use /kick name for someone in your party.', 'error'); break; }
        if (!this.game.party.isLeader) { this.system('Only the party leader can remove people.', 'error'); break; }
        this.game.party.kick(r.person.userId);
        break;
      }
      case 'friend': case 'addfriend': {
        const r = this.matchName(rest);
        if (r.person) { this.game.party?.friendRequest(r.person.userId); break; }
        if (!rest.trim()) { this.system('Who? Use /friend name (Tab completes).', 'error'); break; }
        // v1.12: not on the lake right now? look them up and leave a request waiting for them
        this.game.party?.requestByName(rest.trim()).then((res) => { if (res && !res.ok) this.system(res.msg, 'error'); });
        break;
      }
      case 'friends': this.game.ui.sheets.state.socialTab = 'friends'; this.game.ui.sheets.open('social'); break;
      case 'me': case 'emote':
        if (!rest) { this.system('Try: /me casts a hopeful line', 'error'); break; }
        this.say(rest, { action: true });
        break;
      case 'shrug': this.say(`${rest ? `${rest} ` : ''}¯\\_(ツ)_/¯`); break;
      case 'roll': {
        const max = Math.max(2, Math.min(1000, parseInt(rest, 10) || 100));
        this.say(`rolls ${1 + Math.floor(Math.random() * max)} (1-${max})`, { action: true });
        break;
      }
      case 'who': case 'online': {
        const ppl = this.people();
        this.system(ppl.length ? `On the lake (${ppl.length + 1}): you, ${ppl.map((p) => p.name).join(', ')}` : "It's just you on the lake right now.");
        break;
      }
      case 'mute': case 'block': case 'ignore': {
        const r = this.matchName(rest);
        if (!r.person) { this.system('Who? Use /mute name (Tab completes).', 'error'); break; }
        this.mute(r.person.userId, r.person.name);
        break;
      }
      case 'unmute': case 'unblock': case 'unignore': {
        if (rest.toLowerCase() === 'all') { this.muted.clear(); safe.set('rt_muted', []); this.system('Unmuted everyone.'); break; }
        const r = this.matchName(rest);
        if (!r.person) { this.system(this.muted.size ? 'They need to be on the lake to unmute by name. /unmute all clears everyone.' : 'Nobody is muted.', 'error'); break; }
        this.unmute(r.person.userId, r.person.name);
        break;
      }
      case 'muted': this.system(this.muted.size ? `You've muted ${this.muted.size} angler${this.muted.size > 1 ? 's' : ''}. /unmute all clears the list.` : 'Nobody is muted.'); break;
      case 'clear': { const t = this.tabs.get(this.active); if (t) { t.msgs = []; this.renderList(); } break; }
      default: this.system(`Unknown command /${cmd}. Type /help.`, 'error');
    }
  }

  // ---------------- receiving ----------------
  receive({ from, peer, m, history }) {
    if (!m || typeof m.x !== 'string') return;
    const userId = peer?.meta?.id || from;
    if (this.isMuted(userId)) return;
    if (peer && this.game?.mod?.blockedPeer(peer)) return;
    const text = clean(m.x);
    if (!text) return;
    if (m.to && m.to !== this.me) return; // someone else's whisper
    const now = Date.now();
    const log = (this.inLog.get(userId) || []).filter((t) => now - t < IN_RATE_MS);
    if (!history && log.length >= IN_RATE_N) return;
    log.push(now); this.inLog.set(userId, log);
    const name = clean(peer?.meta?.name || m.nm || 'Angler').slice(0, 24) || 'Angler';
    const local = !!m.say;
    const P = this.game.party;
    if (m.pt) {
      // party chat: only for your own party, from someone in it
      if (!P?.inParty || m.pt !== P.state.id || !P.has(userId)) return;
    }
    const channel = m.to ? 'whisper' : m.pt ? 'party' : local ? 'say' : 'general';
    if (local) {
      // out of earshot? then you never heard it
      const me = this.game.player?.pos;
      const sp = this.game.remotes?.list.get(from)?.pos;
      const sx = sp ? sp.x : Array.isArray(m.p) ? Number(m.p[0]) : NaN, sz = sp ? sp.z : Array.isArray(m.p) ? Number(m.p[1]) : NaN;
      if (!me || !(Math.hypot(me.x - sx, me.z - sz) <= SAY_RANGE)) return;
    }
    const msg = { at: Math.min(now, Number(m.at) || now), userId, name, text: this.show(text), to: m.to || null, action: !!m.me, history, local, channel };
    if (m.to) {
      this.lastDmFrom = { userId, name };
      this.push(this.dmKey(userId), msg, name);
      if (!history) { this.game.audio?.sfx?.('click'); this.game.ui?.addFeed?.({ kind: 'system', payload: { text: `${name} whispers: ${text.slice(0, 60)}`, color: '#3a78c2' } }); }
    } else {
      this.push('lake', msg);
      // bubbles only over anglers near you (general chat stays in the chat box)
      if (!history && channel !== 'general' && this.game.remotes?.near?.(from, SAY_RANGE)) this.game.showChatBubble?.(from, msg.action ? `* ${msg.text}` : msg.text, { force: true });
    }
  }

  push(key, msg, label = null) {
    const t = this.tabs.get(key) || this.addTab(key, label || key, key.startsWith('dm:') ? key.slice(3) : null);
    if (label && t.userId) t.label = label;
    t.msgs.push(msg);
    if (t.msgs.length > KEEP) t.msgs.splice(0, t.msgs.length - KEEP);
    const visible = this.open && this.active === key;
    // v1.13.7: only other anglers' messages count as unread; NPC chatter shows in the log without a red badge.
    if (!visible && !msg.self && !msg.npc && !msg.sys) { t.unread++; this.renderTabs(); }
    if (this.active === key) {
      this.list.querySelector('.chat-empty')?.remove();
      const near = this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight < 40;
      this.list.append(this.line(msg));
      while (this.list.children.length > KEEP) this.list.firstChild.remove();
      if (near || msg.self) this.scrollDown();
    }
    if (!this.open && !msg.sys) this.peekLine(msg);
    if (!msg.sys) { clear(this.barTxt).append(h('b', `${msg.name || 'Someone'}: `), h('span', msg.text || '')); }
    const un = this.totalUnread();
    this.barN.textContent = un > 99 ? '99+' : String(un); this.barN.classList.toggle('hidden', !un);
    this.wake();
    this.game.ui?.setChatBadge?.(un);
  }

  peekLine(msg) {
    const el = this.line(msg);
    el.classList.add('peek');
    this.peek.append(el);
    while (this.peek.children.length > 3) this.peek.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), 9000);
    setTimeout(() => el.remove(), 10000);
  }

  // A local (NPC) speaking out loud nearby.
  npcSay(name, text) {
    this.push('lake', { at: Date.now(), userId: `npc:${name}`, name, text, local: true, npc: true });
  }

  // System message: logged in the System tab (and the lake tab for the important ones).
  system(text, kind = 'info', opts = {}) {
    if (opts.once) { this.onceKeys = this.onceKeys || new Set(); if (this.onceKeys.has(opts.once)) return; this.onceKeys.add(opts.once); }
    const msg = { sys: true, kind, text, at: Date.now() };
    const t = this.tabs.get('system');
    t.msgs.push(msg);
    if (t.msgs.length > KEEP) t.msgs.splice(0, t.msgs.length - KEEP);
    if (this.active === 'system') { this.list.querySelector('.chat-empty')?.remove(); this.list.append(this.line(msg)); this.scrollDown(); }
    // Replies to your own commands, and lake-wide news while the chat is open, also show inline where you're looking.
    const inline = kind === 'error' || kind === 'info' || opts.inline || (opts.popup && this.open);
    if (this.active !== 'system' && inline) {
      const at = this.tabs.get(this.active);
      at.msgs.push(msg);
      this.list.querySelector('.chat-empty')?.remove();
      this.list.append(this.line(msg)); this.scrollDown();
    }
    if (opts.popup && !this.open) this.game.ui?.addFeed?.({ kind: 'system', payload: { text, color: SYSTEM_COLORS[kind] || SYSTEM_COLORS.info } });
  }
}

function nameColor(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hues = ['#2e6aa8', '#8a3aa8', '#b0542a', '#2a8a7a', '#a83a5a', '#5a6a1e', '#3a4aa8', '#8a5a1e'];
  return hues[h % hues.length];
}
