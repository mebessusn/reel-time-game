// Moderation (v1.10): bans, suspensions, reports and the staff list.
//
// Who is an admin: the artifact's owner, and anyone the owner sets to Editor in Claude's Share menu (the
// platform's `admin` level). Your Claude account is the admin login: there is no password to leak or guess.
// The owner can also add players to the in-game staff list, which shows them the admin panel and an Admin
// badge; their actions only save once they are Editors too (the database refuses everyone else).
//
// Data, in the artifact's db (rules declared at publish, so the server enforces who writes what):
//   bans/<id>       { kind: 'ban'|'suspend', until (ms, 0 = forever), reason, name, by, byName, at }   write: admin
//   staff/<id>      { name, at, by }                                                                write: owner
//   reports/<id>    { list: [{ target, name, reason, text, at }] } (one doc per reporter)          read: admin, each writes own
// <id> is the platform-vouched user id (`user.id()` / a room peer's `by`), which nobody can change by clearing
// their browser. Every client also drops banned anglers from its own lake, so a modified client is still shut out.
// Outside the artifact (the dev server, tests) it all runs on this device and ids are the local save ids.
//
// On the dedicated server (a net with `hasMod`, src/net/net.js) none of that is used: reports, bans, mutes, kicks and
// the staff list are the server's (server/moderation.mjs), ids are account ids, and this file keeps its panel and
// dialogs but asks the net (reportPlayer / modAction). Staff there are named in the server's settings; a banned
// account can't sign in at all, so there is no ban screen to show. "Export my data" and "Delete my account" are
// here too (exportMyData / openDeleteAccount), for the Privacy card and /mydata, /deleteaccount in chat.
import { h, clear, ago } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { postReport, reportText, BUG_KINDS } from './reports.js';

export const SUSPEND_HOURS = [1, 24, 72, 168];
export const REPORT_REASONS = [['conduct', 'Misconduct (harassment, bullying, hate, bad language)'], ['cheat', 'Cheating or exploiting bugs'], ['name', 'Inappropriate name or outfit'], ['spam', 'Spam'], ['other', 'Something else']];
const OLD_REASONS = { harass: 'Harassment or bullying', language: 'Bad language or hate' };
export const reasonLabel = (k) => REPORT_REASONS.find(([x]) => x === k)?.[1] || OLD_REASONS[k] || 'Something else';
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

/** Pure: is this ban doc in force at `now`? */
export function banActive(b, now = Date.now()) {
  if (!b || (b.kind !== 'ban' && b.kind !== 'suspend')) return false;
  const until = Number(b.until) || 0;
  if (b.kind === 'ban' && !until) return true;
  return until > now;
}
/** Pure: "Banned" / "Suspended for 3h 20m". */
export function banText(b, now = Date.now()) {
  if (!banActive(b, now)) return '';
  const until = Number(b.until) || 0;
  if (!until) return 'Banned';
  const m = Math.ceil((until - now) / 60000), d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60;
  return `Suspended for ${d ? `${d}d ` : ''}${hh ? `${hh}h ` : ''}${!d && mm ? `${mm}m` : ''}`.trim();
}
/** Pure: a ban doc, cleaned (docs are written by other people, so everything read is checked). */
export function cleanBan(d) {
  if (!d || typeof d !== 'object') return null;
  const kind = d.kind === 'ban' ? 'ban' : d.kind === 'suspend' ? 'suspend' : null;
  if (!kind) return null;
  return { id: clip(d.id, 120), kind, until: Math.max(0, Number(d.until) || 0), reason: clip(d.reason, 200), name: clip(d.name, 24), byName: clip(d.byName, 24), at: Number(d.at) || 0 };
}

export class Moderation {
  constructor(game) {
    this.game = game;
    this.bans = new Map(); // id -> ban
    this.staff = new Map(); // id -> { name, at }
    this.myId = null; this.owner = false; this.editor = false;
    this.ready = false;
  }

  async init() {
    const g = this.game;
    const user = await window.claude?.use?.('user').catch(() => null);
    if (user) {
      this.inArtifact = true;
      [this.myId, this.owner, this.editor] = await Promise.all([user.id().catch(() => null), user.isOwner().catch(() => false), user.canEdit().catch(() => false)]);
    } else {
      this.myId = g.save?.userId || null;
      // dev server / tests only: ?admin opens the panel on this device
      this.owner = this.editor = !!import.meta.env?.DEV && new URLSearchParams(location.search).has('admin'); // never in a published build
    }
    const firstBans = new Promise((res) => {
      this.unBans = g.shared.watch('bans', (docs) => {
        this.bans.clear();
        for (const d of docs) { const b = cleanBan(d); if (b) this.bans.set(d.id, { ...b, id: d.id }); }
        this.applyBans();
        res();
      }, { limit: 1000 });
      setTimeout(res, 4000);
    });
    this.unStaff = g.shared.watch('staff', (docs) => {
      this.staff.clear();
      for (const d of docs) if (d && d.id && !d.removed) this.staff.set(d.id, { name: clip(d.name, 24), at: Number(d.at) || 0 });
      g.ui?.showAdmin?.(this.isAdmin);
      g.ui?.sheets?.current?.name === 'admin' && g.ui.sheets.render();
    }, { limit: 200 });
    g.ui?.showAdmin?.(this.isAdmin);
    firstBans.then(() => { this.ready = true; });
    return this;
  }

  // ---------------- the dedicated server ----------------
  /** The net that does moderation itself, when that's what the game is on (or in a side room of). */
  get srv() { const n = this.snet; return n && !n.left && n.hasMod && (this.game.net === n || n.sub === this.game.net) ? n : null; }
  /** Called once per net (by the party code, which meets a new net first). */
  bindNet(n) {
    if (!n?.hasMod || this.snet === n) return;
    this.snet = n; this.online = null;
    const show = () => { if (this.snet === n) this.game.ui?.showAdmin?.(this.isAdmin); };
    n.on('server:social', show);
    show();
  }
  /** One staff action through the server; toasts what it said. Resolves true when it was done. */
  async serverAct(op, args, done) {
    const g = this.game, r = await this.srv?.modAction(op, args);
    if (!r?.ok) { g.ui.toast(r?.text || "That didn't go through.", { ms: 5000 }); return false; }
    if (done) g.ui.toast(done, { icon: 'gavel' });
    this.online = null; this.bansAt = 0;
    return true;
  }
  /** Everything the server stores for my account, saved as a file. Resolves the data (or null). */
  async exportMyData() {
    const g = this.game, srv = this.srv;
    if (!srv) { g.ui.toast('Your save lives on this device, not on a Reel Time server, so there is nothing to export from here.', { ms: 6000 }); return null; }
    const r = await srv.exportMyData();
    if (!r?.ok) { g.ui.toast(r?.text || "Couldn't fetch your data just now. Try again in a moment.", { ms: 6000 }); return null; }
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' }));
      const a = h('a', { href: url, download: 'reel-time-my-data.json' });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { /* no downloads here: the data is still returned */ }
    g.ui.toast('Saved a copy of your data: reel-time-my-data.json', { icon: 'check', ms: 6000 });
    return r.data;
  }
  /** "Delete my account": says what goes, asks for the word DELETE, then asks the server. */
  openDeleteAccount() {
    const g = this.game, srv = this.srv;
    if (!srv) { g.ui.toast('There is no online account to delete from here: your save lives on this device.', { ms: 6000 }); return; }
    const word = h('input.report-input', { maxLength: 12, placeholder: 'Type DELETE', 'aria-label': 'Type DELETE to confirm', autocomplete: 'off' });
    const go = h('button.btn.red', { disabled: true, on: { click: async () => {
      go.disabled = true;
      const r = await srv.deleteMyAccount(word.value.trim());
      if (!r?.ok) { note.textContent = r?.text || "That didn't go through. Try again in a moment."; go.disabled = false; return; }
      close();
      g.chat?.system('Your online account and everything the server stored for it have been deleted. You are fishing on your own now.', 'info');
      g.ui.toast('Your online account was deleted.', { icon: 'check', ms: 7000 });
    } } }, icon('ban'), 'Delete my account');
    word.addEventListener('input', () => { go.disabled = word.value.trim() !== 'DELETE'; });
    word.addEventListener('keydown', (e) => e.stopPropagation());
    const note = h('p.muted', '');
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    const close = () => { window.removeEventListener('keydown', esc, true); el.remove(); };
    const card = h('div.menu-card.report-card', { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': 'Delete my account' },
      h('div.menu-card-head', h('h2', icon('ban'), 'Delete my account'), h('button.btn.close-x.ghost', { 'aria-label': 'Close', on: { click: close } }, icon('close'))),
      h('p', 'This deletes your online account for good: your online character and progress, your chat settings and block list, and your sign-in on this device. It can\'t be undone.'),
      h('p.muted', 'Reports other players made about you are kept without your name. Want a copy of your data first? Close this and use Export my data.'),
      h('div.report-label', 'Type DELETE to confirm'), word, note,
      h('div.confirm-btns', h('button.btn.ghost', { on: { click: close } }, 'Cancel'), go));
    const el = h('div.menu-screen.confirm-screen.report-screen', { on: { click: (e) => { if (e.target === el) close(); } } }, card);
    window.addEventListener('keydown', esc, true);
    g.ui.root.append(el);
    requestAnimationFrame(() => word.focus({ preventScroll: true }));
  }

  /** You can see the panel. */
  get isAdmin() { return !!(this.owner || (this.myId && this.staff.has(this.myId)) || this.srv?.role); } // v1.12: the owner and staff they add, nobody else (artifact Editors no longer count); on the server, its staff
  /** Your actions save (the database enforces this; the UI just says so up front). */
  get canAct() { return !!(this.owner || this.editor || this.srv?.role); }
  isStaff(id) { return !!id && this.staff.has(id); }

  /** A peer's durable id: the platform's `by` in the artifact, the save id elsewhere. */
  idOf(peer) { return peer?.by || (this.inArtifact ? null : peer?.id) || null; }
  banOf(id) { const b = id && this.bans.get(id); return b && banActive(b) ? b : null; }
  blockedPeer(peer) { return !!this.banOf(this.idOf(peer)); }
  get myBan() { return this.banOf(this.myId); }

  /** Called whenever the ban list changes: you, if banned, are shown the door; banned anglers vanish from your lake. */
  applyBans() {
    const g = this.game;
    if (this.myBan && !this.isAdmin) this.showBanned(this.myBan);
    else if (this.banScreen && !this.myBan) { this.banScreen.remove(); this.banScreen = null; if (this.wasKicked) location.reload(); }
    const net = g.net;
    if (!net?.peers) return;
    for (const p of [...net.peers.values()]) if (this.blockedPeer(p)) net._removePeer(p.id);
  }

  showBanned(b) {
    const g = this.game;
    if (this.banScreen?.isConnected) { this.banScreen.querySelector('.ban-when').textContent = banText(b); return; }
    this.wasKicked = true;
    try { g.net?.leave?.(); } catch { /* ignore */ }
    this.banScreen = h('div.menu-screen.ban-screen', h('div.menu-card.ban-card', { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': 'Account restricted' },
      h('span.ban-badge', icon(b.until ? 'hourglass' : 'ban')),
      h('h3', b.until ? 'You are suspended from the lake' : 'You are banned from the lake'),
      h('p.ban-when', banText(b)),
      b.reason ? h('p', h('b', 'Reason: '), b.reason) : null,
      h('p.muted', b.until ? 'You can come back and fish again when the suspension ends. This page will let you in by itself.' : 'If you think this is a mistake, contact whoever shared Reel Time with you.'),
      h('p.muted', 'Please read the lake rules (/rules) before you come back.')));
    g.ui.root.append(this.banScreen);
    if (b.until) { clearInterval(this.banTick); this.banTick = setInterval(() => { if (!this.myBan) { clearInterval(this.banTick); location.reload(); } else this.showBanned(this.myBan); }, 30000); }
  }

  // ---------------- admin actions ----------------
  async ban(target, { hours = 0, reason = '' } = {}) {
    const g = this.game;
    if (!target?.id) { g.ui.toast("Can't tell who that is: the platform hasn't vouched for this angler yet."); return false; }
    if (target.id === this.myId) { g.ui.toast("You can't ban yourself."); return false; }
    if (this.isStaff(target.id) && !this.owner) { g.ui.toast('Only the owner can ban another admin.'); return false; }
    if (this.srv) return this.serverAct('ban', { account: target.id, hours, reason: clip(reason, 200) }, `${clip(target.name, 24) || 'That angler'} ${hours ? `is suspended for ${hours >= 24 ? `${hours / 24} day${hours > 24 ? 's' : ''}` : `${hours} hour${hours > 1 ? 's' : ''}`}` : 'is banned'}.`);
    const doc = { kind: hours ? 'suspend' : 'ban', until: hours ? Date.now() + hours * 3600000 : 0, reason: clip(reason, 200), name: clip(target.name, 24), byName: clip(g.profile.name, 24), at: Date.now() };
    const ok = await g.shared.set('bans', target.id, doc);
    if (ok === false) { g.ui.toast("That didn't save. Only the owner and Editors (set in Claude's Share menu) can ban.", { ms: 6000 }); return false; }
    g.ui.toast(`${doc.name || 'That angler'} ${hours ? `is suspended for ${hours >= 24 ? `${hours / 24} day${hours > 24 ? 's' : ''}` : `${hours} hour${hours > 1 ? 's' : ''}`}` : 'is banned'}.`, { icon: 'gavel' });
    g.chat?.system(`An admin removed ${doc.name || 'an angler'} from the lake.`, 'info');
    return true;
  }
  async unban(id) {
    const g = this.game, b = this.bans.get(id);
    if (this.srv) { const done = await this.serverAct('unban', { account: id }, `${b?.name || 'That angler'} can fish again.`); if (done) this.bans.delete(id); return done; }
    const ok = await g.shared.set('bans', id, { kind: 'none', until: 0, reason: '', name: b?.name || '', byName: clip(g.profile.name, 24), at: Date.now() });
    if (ok === false) { g.ui.toast("That didn't save. Only the owner and Editors can lift bans."); return false; }
    g.ui.toast(`${b?.name || 'That angler'} can fish again.`, { icon: 'check' });
    return true;
  }
  async setStaff(target, on) {
    const g = this.game;
    if (!this.owner) { g.ui.toast('Only the owner can change who is an admin.'); return false; }
    const ok = await g.shared.set('staff', target.id, { name: clip(target.name, 24), at: Date.now(), by: this.myId, removed: !on });
    if (ok === false) { g.ui.toast("That didn't save."); return false; }
    g.ui.toast(on ? `${target.name} is an admin. Set them to Editor in Claude's Share menu so their bans save.` : `${target.name} is no longer an admin.`, { icon: 'shield', ms: 6500 });
    return true;
  }

  // ---------------- reports (anyone) ----------------
  /** Your platform id (works before init too, e.g. from the title screen). */
  async ensureId() {
    if (this.myId) return this.myId;
    const user = await window.claude?.use?.('user').catch(() => null);
    this.myId = user ? await user.id().catch(() => null) : (this.game.save?.userId || null);
    return this.myId;
  }

  async report(target, reason, text = '') {
    const g = this.game;
    const entry = { target: clip(target.id, 120), name: clip(target.name, 24), reason: REPORT_REASONS.some(([k]) => k === reason) ? reason : 'other', text: clip(text, 500), from: clip(g.profile.name, 24), at: Date.now() };
    entry.reasonLabel = reasonLabel(entry.reason);
    const viaWeb = await postReport('player', entry);
    let viaDb = false;
    // the dedicated server keeps reports itself, with the last chat lines from both of you
    const srv = this.srv;
    if (srv) {
      const r = entry.target ? await srv.reportPlayer({ target: entry.target, name: entry.name, reason: entry.reason, text: entry.text }) : null;
      viaDb = !!r?.ok;
      if (r && !r.ok && r.text) g.ui.toast(r.text, { ms: 6000 });
      if (viaWeb || viaDb) g.ui.toast(`Thanks. The moderators will look at your report about ${entry.name}.`, { icon: 'shield', ms: 5000 });
      return (viaWeb || viaDb) ? true : reportText('player', entry);
    }
    await g.shared?.init?.().catch?.(() => {});
    const id = await this.ensureId();
    if (id && g.shared) {
      this.myReports = [...(this.myReports || []).filter((r) => r.target !== entry.target || r.reason !== entry.reason), entry].slice(-20);
      viaDb = (await g.shared.set('reports', id, { list: this.myReports, from: entry.from, at: entry.at })) !== false && (!!g.shared.db || !window.claude?.use);
    }
    if (viaWeb || viaDb) g.ui.toast(`Thanks. The admins will look at your report about ${entry.name}.`, { icon: 'shield', ms: 5000 });
    return (viaWeb || viaDb) ? true : reportText('player', entry);
  }

  /** Admins: everyone's bug reports, newest first. */
  async allBugs() {
    const g = this.game;
    return new Promise((res) => {
      let un = null;
      const done = (docs) => { un?.(); res(docs); };
      un = g.shared.watch('bugs', (docs) => {
        const out = [];
        for (const d of docs) for (const r of Array.isArray(d?.list) ? d.list : []) out.push({ reporter: d.id, ...r, from: clip(r.from || d.from, 24), title: clip(r.title, 80), text: clip(r.text, 1500), steps: clip(r.steps, 800), at: Number(r.at) || 0 });
        done(out.sort((a, b) => b.at - a.at).slice(0, 100));
      }, { limit: 500 });
      setTimeout(() => done([]), 5000);
    });
  }

  /** Admins: everyone's reports, newest first. */
  async allReports() {
    const g = this.game;
    if (this.srv) {
      const r = await this.srv.modAction('reports', { status: 'open' });
      return (Array.isArray(r?.reports) ? r.reports : []).map((x) => ({ id: clip(x.id, 40), reporter: clip(x.reporter, 120), from: clip(x.reporterName, 24), target: clip(x.target, 120), name: clip(x.targetName, 24), reason: clip(x.reason, 20), text: clip(x.text, 500), at: Number(x.at) || 0,
        chat: (Array.isArray(x.chat) ? x.chat : []).slice(-30).map((l) => ({ at: Number(l.at) || 0, name: clip(l.nm, 24), text: clip(l.x, 200), ch: clip(l.ch, 10), mine: l.id === x.reporter })) }));
    }
    return new Promise((res) => {
      let un = null;
      const done = (docs) => { un?.(); res(docs); };
      un = g.shared.watch('reports', (docs) => {
        const out = [];
        for (const d of docs) for (const r of Array.isArray(d?.list) ? d.list : []) out.push({ reporter: d.id, from: clip(r.from || d.from, 24), target: clip(r.target, 120), name: clip(r.name, 24), reason: clip(r.reason, 20), text: clip(r.text, 300), at: Number(r.at) || 0 });
        done(out.sort((a, b) => b.at - a.at).slice(0, 100));
      }, { limit: 500 });
      setTimeout(() => done([]), 5000);
    });
  }

  /** Everyone on the lake right now, with their durable ids. */
  people() {
    const net = this.game.net, out = [];
    // the server's staff see everyone online, on every instance (asked for again every few seconds while the panel is open)
    if (this.srv?.role) {
      if (!this.online || Date.now() - this.online.at > 5000) {
        const was = this.online?.list || null;
        this.online = { at: Date.now(), list: was };
        this.srv.modAction('online').then((r) => { if (!r?.ok || !this.online) return; this.online = { at: Date.now(), list: (r.online || []).filter((p) => p.account !== this.srv?.account).map((p) => ({ id: clip(p.account, 120), peer: clip(p.account, 120), name: clip(p.name, 24) || 'Angler', guest: p.via === 'guest', country: '', muted: p.mutedUntil > Date.now() })) }; const s = this.game.ui?.sheets; if (s?.current?.name === 'admin' && !was) s.render(); });
      }
      if (this.online.list) return [...this.online.list].sort((a, b) => a.name.localeCompare(b.name));
    }
    for (const p of net?.peers?.values() || []) if (p.meta?.name) out.push({ id: this.idOf(p), peer: p.id, name: clip(p.meta.name, 24), guest: !!p.guest, country: p.meta.avatar?.country || '' });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ---------------- the admin panel (a sheet) ----------------
  render(c, sheets) {
    const g = this.game;
    c.title.textContent = 'Admin';
    const tab = sheets.state.adminTab || 'players';
    for (const [id, label] of [['players', 'Players'], ['bans', `Bans${this.activeBans().length ? ` (${this.activeBans().length})` : ''}`], ['reports', 'Reports'], ['bugs', 'Bugs & feedback'], ['staff', 'Admins']]) sheets.tab(c, id, label, 'adminTab');
    if (!this.isAdmin) { c.body.append(h('div.empty', 'Only admins can open this.')); return; }
    if (!this.canAct) c.body.append(h('div.admin-warn', icon('info'), h('span', "You're on the staff list, but your actions won't save until the owner sets you to Editor in Claude's Share menu.")));
    if (tab === 'players') this.renderPlayers(c, sheets);
    else if (tab === 'bans') this.renderBans(c, sheets);
    else if (tab === 'reports') this.renderReports(c, sheets);
    else if (tab === 'bugs') this.renderBugs(c);
    else this.renderStaff(c, sheets);
  }
  activeBans() { return [...this.bans.values()].filter((b) => banActive(b)); }

  actionRow(target, sheets) {
    const why = h('input.admin-why', { placeholder: 'Reason (they will see this)', maxLength: 200, 'aria-label': 'Reason' });
    const go = (hours) => async () => { if (await this.ban(target, { hours, reason: why.value })) sheets.render(); };
    // the server's staff can also mute someone in chat for a while, or just send them off the lake
    const act = (op, args, done) => async () => { if (await this.serverAct(op, { account: target.id, reason: why.value, ...args }, done)) sheets.render(); };
    const name = clip(target.name, 24) || 'That angler';
    return h('div.admin-actions',
      why,
      this.srv ? h('div.admin-btns',
        h('button.btn.small', { on: { click: act('mute', { hours: 1 }, `${name} is muted in chat for an hour.`) } }, icon('chat'), 'Mute 1h'),
        h('button.btn.small', { on: { click: act('mute', { hours: 24 }, `${name} is muted in chat for a day.`) } }, icon('chat'), 'Mute 1d'),
        h('button.btn.small', { on: { click: act('kick', {}, `${name} was sent off the lake.`) } }, icon('close'), 'Kick')) : null,
      h('div.admin-btns',
        ...SUSPEND_HOURS.map((hh) => h('button.btn.small', { on: { click: go(hh) } }, icon('hourglass'), hh >= 24 ? `${hh / 24}d` : `${hh}h`)),
        h('button.btn.red.small', { on: { click: go(0) } }, icon('ban'), 'Ban')));
  }

  renderPlayers(c, sheets) {
    const list = this.people();
    c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, 'Everyone on the lake right now. Suspensions end on their own; bans last until you lift them.'));
    if (!list.length) { c.body.append(h('div.empty', 'Nobody else is on the lake right now.')); return; }
    const open = sheets.state.adminOpen;
    c.body.append(h('div.row-list', list.map((p) => {
      const ban = this.banOf(p.id), staff = this.isStaff(p.id), isOpen = open === p.peer;
      return h(`div.list-row.admin-row${isOpen ? '.open' : ''}`, { style: { flexWrap: 'wrap' } },
        icon(staff ? 'shield' : 'user'),
        h('div.grow', h('div.ttl', p.name, staff ? h('span.pill.admin-pill', 'Admin') : null, p.guest ? h('span.pill', { style: { '--c': '#8a93a0' } }, 'Guest') : null), h('div.meta', p.id ? (ban ? banText(ban) : 'Fishing') : 'Not vouched for yet: wait a moment')),
        p.id ? h('button.btn.ghost.small', { on: { click: () => { sheets.state.adminOpen = isOpen ? null : p.peer; sheets.render(); } } }, isOpen ? 'Close' : 'Moderate') : null,
        isOpen ? this.actionRow(p, sheets) : null);
    })));
  }

  renderBans(c, sheets) {
    // on the server the list is the server's: fetched when the tab opens, then drawn like any other
    if (this.srv && (!this.bansAt || sheets.state.adminBansAt !== this.bansAt)) {
      const stamp = this.bansAt = Date.now(); sheets.state.adminBansAt = stamp;
      c.body.append(h('div.empty', 'Loading…'));
      this.srv.modAction('bans').then((r) => {
        if (this.bansAt !== stamp) return;
        this.bans.clear();
        for (const b of Array.isArray(r?.bans) ? r.bans : []) { const id = clip(b.account || b.accountHash, 120); if (id) this.bans.set(id, { id, kind: b.until ? 'suspend' : 'ban', until: Math.max(0, Number(b.until) || 0), reason: clip(b.reason, 200), name: clip(b.name, 24) || (b.deleted ? 'A deleted account' : id), byName: 'a moderator', at: Number(b.at) || 0 }); }
        if (sheets.current?.name === 'admin') sheets.render();
      });
      return;
    }
    const list = this.activeBans().sort((a, b) => b.at - a.at);
    if (!list.length) { c.body.append(h('div.empty', 'Nobody is banned or suspended.')); return; }
    c.body.append(h('div.row-list', list.map((b) => h('div.list-row', icon(b.until ? 'hourglass' : 'ban'),
      h('div.grow', h('div.ttl', b.name || 'An angler'), h('div.meta', `${banText(b)} · by ${b.byName || 'an admin'} ${ago(b.at)}${b.reason ? ` · “${b.reason}”` : ''}`)),
      h('button.btn.green.small', { on: { click: async () => { if (await this.unban(b.id)) sheets.render(); } } }, b.until ? 'End early' : 'Lift ban')))));
  }

  renderReports(c, sheets) {
    const box = h('div.row-list', h('div.empty', 'Loading reports…'));
    c.body.append(box);
    this.allReports().then((rows) => {
      clear(box);
      if (!rows.length) { box.append(h('div.empty', 'No reports. The lake is cozy.')); return; }
      for (const r of rows) {
        const ban = this.banOf(r.target), label = reasonLabel(r.reason);
        const open = sheets.state.adminOpen === `r:${r.reporter}:${r.target}`;
        box.append(h('div.list-row.admin-row', { style: { flexWrap: 'wrap' } }, icon('scroll'),
          h('div.grow', h('div.ttl', `${r.name || 'Someone'}: ${label}`), h('div.meta', `Reported by ${r.from || 'an angler'} ${ago(r.at)}${ban ? ` · ${banText(ban)}` : ''}`), r.text ? h('div.admin-quote', `“${r.text}”`) : null,
            // (the server's reports come with what the two of them said just before)
            r.chat?.length ? h('details.bug-row', h('summary', `What they said (${r.chat.length} line${r.chat.length > 1 ? 's' : ''})`), h('pre.bug-text', r.chat.map((l) => `${l.mine ? '(reporter) ' : ''}${l.name}${l.ch === 'whisper' ? ' (whisper)' : l.ch === 'party' ? ' (party)' : ''}: ${l.text}`).join('\n'))) : null),
          r.id && this.srv ? h('button.btn.ghost.small', { on: { click: async () => { if (await this.serverAct('resolve', { id: r.id, action: 'none' }, 'Report closed.')) sheets.render(); } } }, 'Dismiss') : null,
          h('button.btn.ghost.small', { on: { click: () => { sheets.state.adminOpen = open ? null : `r:${r.reporter}:${r.target}`; sheets.render(); } } }, open ? 'Close' : 'Moderate'),
          open ? this.actionRow({ id: r.target, name: r.name }, sheets) : null));
      }
    });
  }

  renderBugs(c) {
    const box = h('div.row-list', h('div.empty', 'Loading bug reports…'));
    c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, 'Bug reports and feedback from players in this lake, newest first. Something the game\'s maker should fix? Open an issue at github.com/mebessusn/reel-time-game/issues.'), box);
    this.allBugs().then((rows) => {
      clear(box);
      if (!rows.length) { box.append(h('div.empty', 'No bug reports yet.')); return; }
      for (const r of rows) {
        const fb = r.type === 'feedback'; // v1.13.11: feedback shares the bugs inbox
        const det = h('details.bug-row', h('summary', icon(fb ? 'chat' : 'bug'), h('span.grow', h('b', r.title || '(no title)'), h('small', ` ${fb ? `Feedback: ${r.kindLabel || r.cat}` : BUG_KINDS.find(([k]) => k === r.cat)?.[1] || 'Bug'} · ${r.from || 'an angler'} · ${ago(r.at)}`))),
          h('pre.bug-text', reportText(fb ? 'feedback' : 'bug', r)));
        box.append(det);
      }
    });
  }

  renderStaff(c, sheets) {
    if (this.srv) { c.body.append(h('div.admin-help', h('p', h('b', 'Who is a moderator. '), 'Online, the staff are named in the server\'s settings (owners and admins, by account id), so they can\'t be changed from inside the game.'), h('p', `You are signed in as ${this.srv.role || 'a player'}.`))); return; }
    c.body.append(h('div.admin-help',
      h('p', h('b', 'Who is an admin. '), "The owner, and everyone set to Editor in Claude's Share menu. Your Claude account is your admin login, so there's no password to share or lose."),
      h('p', h('b', 'Making someone an admin. '), "1. Add them below so they get the Admin panel and badge. 2. In Claude, open this artifact's Share menu and set them to Editor, so their bans save.")));
    const staff = [...this.staff.entries()];
    c.body.append(h('div.section-title', 'Staff list'));
    c.body.append(h('div.row-list', staff.length ? staff.map(([id, s]) => h('div.list-row', icon('shield'), h('div.grow', h('div.ttl', s.name || 'Admin'), h('div.meta', `Added ${ago(s.at)}`)),
      this.owner ? h('button.btn.ghost.small', { on: { click: async () => { if (await this.setStaff({ id, name: s.name }, false)) sheets.render(); } } }, 'Remove') : null)) : h('div.empty', 'Nobody yet besides the owner.')));
    if (!this.owner) return;
    const here = this.people().filter((p) => p.id && !this.isStaff(p.id));
    c.body.append(h('div.section-title', 'Add someone who is on the lake'));
    c.body.append(h('div.row-list', here.length ? here.map((p) => h('div.list-row', icon('user'), h('div.grow', h('div.ttl', p.name)),
      h('button.btn.blue.small', { on: { click: async () => { if (await this.setStaff(p, true)) sheets.render(); } } }, icon('shield'), 'Make admin'))) : h('div.empty', 'The person needs to be on the lake right now.')));
  }

  // ---------------- report dialog (anyone) ----------------
  openReport(target) {
    const g = this.game;
    let reason = null;
    const send = h('button.btn.primary', { disabled: true, on: { click: async () => {
      send.disabled = true;
      const r = await this.report(target, reason, text.value);
      if (r === true) { close(); return; }
      // couldn't deliver: offer to copy it instead
      clear(card).append(h('h3', "Couldn't send it from here"), h('p.muted', "This copy of the game can't save reports (it may be shared with you view-only). Copy the report and send it to whoever shared Reel Time with you."),
        h('textarea.report-text', { rows: 7, readOnly: true }, r),
        h('div.confirm-btns', h('button.btn.ghost', { on: { click: close } }, 'Close'), h('button.btn.primary', { on: { click: (e) => { navigator.clipboard?.writeText(r).then(() => { e.currentTarget.textContent = 'Copied'; }).catch(() => {}); } } }, icon('copy'), 'Copy report')));
    } } }, icon('shield'), 'Send report');
    const text = h('textarea.report-text', { maxLength: 500, rows: 4, placeholder: 'What happened? When and where? (optional, but it helps)' });
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    const close = () => { window.removeEventListener('keydown', esc, true); el.remove(); };
    const card = h('div.menu-card.report-card', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `Report ${target.name}` },
      h('div.menu-card-head', h('h2', icon('shield'), `Report ${target.name}`), h('button.btn.close-x.ghost', { 'aria-label': 'Close', on: { click: close } }, icon('close'))),
      h('p.muted', 'Reports go to the lake admins only; the player is not told who reported them. Want them gone from your own lake right now? Mute them in chat too.'),
      h('div.report-label', 'What is the problem?'),
      h('div.report-reasons.one-col', REPORT_REASONS.map(([k, l]) => h('label', h('input', { type: 'radio', name: 'reason', value: k, on: { change: () => { reason = k; send.disabled = false; } } }), l))),
      h('div.report-label', 'Details'), text,
      h('div.confirm-btns', h('button.btn.ghost', { on: { click: close } }, 'Cancel'), send));
    const el = h('div.menu-screen.confirm-screen.report-screen', { on: { click: (e) => { if (e.target === el) close(); } } }, card);
    window.addEventListener('keydown', esc, true);
    g.ui.root.append(el);
    g.audio?.sfx?.('open');
  }
}
