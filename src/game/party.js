// Friends and parties (v1.11).
//
// No server: everything rides in each angler's presence `meta`, so it works the same over the artifact room,
// Supabase and tabs on one device. Ids are anglers' meta ids (`save.userId`); friends also remember the
// platform id (`by`) where there is one, so a friend is recognised on any device.
//
//   meta.pty  { id, ld, m: [ids] }       the party you're in. The leader's copy is the roster everyone follows.
//   meta.inv  [{ to, pid, at }]          party invites you've sent (expire after INVITE_MS)
//   meta.acc  { pid, ld, at }            you accepted an invite to party `pid` (the leader adds you)
//   meta.fr   [{ to, at }]               friend requests you've sent
//   meta.fra  [{ to, at }]               friend requests you've accepted (the asker adds you back)
//
// Parties hold up to PARTY_MAX. If the leader leaves, the next member on the roster takes over. Everything
// read from other anglers' meta is untrusted: rosters are capped, ids are strings, and nobody can put you in a
// party you didn't accept.
export const PARTY_MAX = 4;
export const NEAR_RANGE = 37; // metres: about 40 yards. Say chat and other people's nameplates reach this far.
export const INVITE_MS = 60000;
export const PARTY_COLORS = ['#f2c040', '#5ec8e8', '#f07ab0', '#8ad86a'];
const str = (v, n = 80) => (typeof v === 'string' ? v.slice(0, n) : '');
const ids = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x).slice(0, PARTY_MAX).map((x) => x.slice(0, 80)) : []);

/** Pure: reads a party from someone's meta (or null). */
export function readParty(meta) {
  const p = meta?.pty;
  if (!p || typeof p !== 'object') return null;
  const id = str(p.id), ld = str(p.ld), m = [...new Set(ids(p.m))];
  if (!id || !ld || !m.includes(ld)) return null;
  return { id, ld, m };
}

/**
 * Pure: given my id, my current party and everyone else's meta, what's my party now?
 * Rules: follow the roster published by my party's leader (if it still lists me); if the leader is gone or has
 * left the party, the first remaining member who is still here leads. A leader only adds anglers it invited
 * who accepted. `peers` = [{ id, meta }]; `acc` = my own pending accept; `invited` = ids I've invited.
 */
const PRESENCE_GRACE_MS = 12000;
export function resolveParty(me, mine, peers, { now = Date.now(), acc = null, invited = [] } = {}) {
  if (!mine) return null;
  const by = new Map(peers.map((p) => [p.id, p]));
  const leader = by.get(mine.ld);
  const lp = leader ? readParty(leader.meta) : null;
  if (mine.ld !== me) {
    if (lp && lp.id === mine.id && lp.ld === mine.ld) {
      if (lp.m.includes(me)) return lp; // follow the leader
      const waiting = acc && acc.pid === mine.id && now - (Number(acc.at) || 0) < INVITE_MS;
      return waiting ? mine : null; // just accepted (wait to be added), or kicked
    }
    if (leader && !lp && acc && acc.pid === mine.id && now - (Number(acc.at) || 0) < 5000) return mine; // the leader hasn't caught up
    // the leader left the party or the lake: the next member here takes over
    const rest = mine.m.filter((x) => x !== mine.ld && (x === me || by.has(x)));
    if (rest.length < 2) return null;
    const heir = rest[0];
    if (heir === me) return { id: mine.id, ld: me, m: rest };
    const hp = by.get(heir) ? readParty(by.get(heir).meta) : null;
    if (hp && hp.id === mine.id && hp.ld === heir) return hp.m.includes(me) ? hp : null;
    return { id: mine.id, ld: heir, m: rest }; // wait for the heir to publish
  }
  // I lead: add anyone I invited who accepted, drop anyone who left (or went away), keep the cap
  const m = mine.m.filter((x) => x === me || (by.has(x) && !leftParty(by.get(x).meta, mine.id)));
  for (const p of peers) {
    const a = p.meta?.acc;
    if (!a || str(a.pid) !== mine.id || m.includes(p.id) || m.length >= PARTY_MAX || !invited.includes(p.id)) continue;
    if (now - (Number(a.at) || 0) > INVITE_MS * 2) continue;
    m.push(p.id);
  }
  if (m.length > 1) return { id: mine.id, ld: me, m };
  return mine.solo && invited.length ? { id: mine.id, ld: me, m, solo: true } : null; // still inviting, or everyone left
}
function leftParty(meta, pid) {
  // a member who now shows another party, or none after having been in ours, has left
  const p = readParty(meta);
  if (p && p.id !== pid) return true;
  if (!p && meta?.acc?.pid !== pid) return true;
  return false;
}

export class Party {
  constructor(game) {
    this.game = game;
    this.state = null; // { id, ld, m }
    this.invites = []; // invites I sent: { to, pid, at }
    this.acc = null;
    this.prompted = new Set(); // invites/requests already shown
    this.fr = []; this.fra = [];
    this.t = 0;
  }
  get me() { return this.game.save?.userId; }
  get d() { return this.game.ext.d; }
  get friends() { return this.d.friends || {}; }

  // ---------------- meta ----------------
  meta() {
    const now = Date.now();
    this.invites = this.invites.filter((i) => now - i.at < INVITE_MS);
    this.fr = this.fr.filter((i) => now - i.at < INVITE_MS * 5);
    this.fra = this.fra.filter((i) => now - i.at < INVITE_MS * 5);
    return {
      pty: this.state ? { id: this.state.id, ld: this.state.ld, m: this.state.m } : null,
      inv: this.invites.length ? this.invites : null,
      acc: this.acc,
      fr: this.fr.length ? this.fr : null,
      fra: this.fra.length ? this.fra : null,
    };
  }
  push() { this.game.pushMeta(); }

  peers() {
    const out = [];
    for (const p of this.game.net?.peers?.values?.() || []) {
      const id = p.meta?.id;
      if (typeof id === 'string' && id && id !== this.me && !this.game.mod?.blockedPeer?.(p)) out.push({ id, meta: p.meta, peer: p });
    }
    return out;
  }
  peerById(id) { return this.peers().find((p) => p.id === id) || null; }
  nameOf(id) { return id === this.me ? this.game.profile.name : str(this.peerById(id)?.meta?.name, 24) || this.d.friends?.[id]?.name || 'An angler'; }

  // ---------------- queries ----------------
  get inParty() { return !!(this.state && this.state.m.length > 1); }
  get isLeader() { return this.inParty && this.state.ld === this.me; }
  members() { return this.inParty ? this.state.m : []; }
  /** Is this angler (meta id) in my party? */
  has(id) { return !!id && this.inParty && id !== this.me && this.state.m.includes(id); }
  hasPeer(peer) { return this.has(peer?.meta?.id); }
  color(id) { const i = this.members().indexOf(id); return PARTY_COLORS[Math.max(0, i) % PARTY_COLORS.length]; }

  // ---------------- party actions ----------------
  invite(id) {
    const g = this.game, name = this.nameOf(id);
    if (!id || id === this.me) return;
    if (this.has(id)) { g.ui.toast(`${name} is already in your party.`); return; }
    if (this.inParty && !this.isLeader) { g.ui.toast('Only the party leader can invite.'); return; }
    if (this.inParty && this.state.m.length >= PARTY_MAX) { g.ui.toast(`Parties hold up to ${PARTY_MAX} anglers.`); return; }
    const theirs = readParty(this.peerById(id)?.meta);
    if (theirs && theirs.m.length > 1) { g.ui.toast(`${name} is already in a party.`); return; }
    if (!this.state) this.state = { id: `${this.me}-${Date.now().toString(36)}`.slice(0, 80), ld: this.me, m: [this.me], solo: true };
    this.invites = [...this.invites.filter((i) => i.to !== id), { to: id, pid: this.state.id, at: Date.now() }];
    this.push();
    g.chat?.system(`You invited ${name} to your party.`, 'join');
    g.audio?.sfx('click');
  }
  accept(from, pid) {
    const g = this.game;
    if (this.inParty) this.leave(true);
    this.acc = { pid, ld: from, at: Date.now() };
    this.state = { id: pid, ld: from, m: [from, this.me] }; // until the leader's roster arrives
    this.push();
    g.chat?.system(`You joined ${this.nameOf(from)}'s party. Type /p to talk to your party.`, 'join');
    g.audio?.sfx('achievement');
  }
  leave(quiet = false) {
    if (!this.state) return;
    const was = this.inParty;
    this.state = null; this.acc = null; this.invites = [];
    this.push();
    if (was && !quiet) { this.game.chat?.system('You left the party.', 'leave'); this.game.ui?.renderParty?.(); }
    if (this.game.riding && !quiet) this.game.hopOut('You left the party, so you hopped out of their boat.');
  }
  kick(id) {
    if (!this.isLeader || !this.has(id)) return;
    this.state = { ...this.state, m: this.state.m.filter((x) => x !== id) };
    this.kicked = { id, at: Date.now() };
    this.push();
    this.game.chat?.system(`You removed ${this.nameOf(id)} from the party.`, 'leave');
  }
  promote(id) {
    if (!this.isLeader || !this.has(id)) return;
    this.state = { ...this.state, ld: id, m: [id, ...this.state.m.filter((x) => x !== id)] };
    this.push();
    this.game.chat?.system(`${this.nameOf(id)} leads the party now.`, 'join');
  }

  // ---------------- friends ----------------
  isFriend(id, by) {
    const f = this.friends;
    if (id && f[id]) return true;
    return !!by && Object.values(f).some((x) => x.by === by);
  }
  friendRequest(id) {
    const g = this.game, p = this.peerById(id);
    if (!p) return;
    if (this.isFriend(id, p.peer.by)) { g.ui.toast(`${this.nameOf(id)} is already your friend.`); return; }
    // they asked me first? then this is an accept
    if ((Array.isArray(p.meta.fr) ? p.meta.fr : []).some((r) => r?.to === this.me)) { this.acceptFriend(id); return; }
    this.fr = [...this.fr.filter((r) => r.to !== id), { to: id, at: Date.now() }];
    this.push();
    g.chat?.system(`Friend request sent to ${this.nameOf(id)}.`, 'join');
  }
  addFriend(id) {
    const p = this.peerById(id);
    this.game.ext.change((d) => { d.friends = { ...(d.friends || {}), [id]: { name: str(p?.meta?.name, 24) || 'Angler', by: str(p?.peer?.by) || null, at: Date.now() } }; });
    this.game.ui?.sheets?.current?.name === 'social' && this.game.ui.sheets.render();
  }
  acceptFriend(id) {
    for (const r of (this.pending || []).filter((x) => x.from === id)) this.closeMail(r.id);
    this.addFriend(id);
    this.fra = [...this.fra.filter((r) => r.to !== id), { to: id, at: Date.now() }];
    this.push();
    this.game.chat?.system(`You and ${this.nameOf(id)} are friends now.`, 'join');
    this.game.audio?.sfx('achievement');
  }
  removeFriend(id) {
    const name = this.friends[id]?.name || 'them';
    this.game.ext.change((d) => { const f = { ...(d.friends || {}) }; delete f[id]; d.friends = f; });
    this.game.chat?.system(`Removed ${name} from your friends.`, 'leave');
  }
  // ---------------- v1.12: friends by name, even when they're offline ----------------
  // Every angler lists themselves in `anglers/<id>` ({ name, key: lowercase name, lvl, at }) so a name typed in
  // the Friends tab can be found. A request is a `mail` doc { kind: 'friend', to, from, fromName, at }; the
  // answer is { kind: 'friendok' }. Each angler watches the mail addressed to them, so a request sent while
  // they were away is waiting when they log on. Everything read here was written by other players: clipped.
  initMail() {
    const g = this.game;
    if (this.mailOn || !g.shared || !this.me) return;
    this.mailOn = true;
    this.pending = [];
    this.listMe();
    this.unMail = g.shared.watchWhere('mail', 'to', this.me, (docs) => {
      const handled = new Set(g.ext.d.friendMailSeen || []);
      const reqs = [];
      for (const d of docs) {
        if (!d || d.claimed || handled.has(d.id)) continue;
        const from = str(d.from, 80);
        if (!from || from === this.me) continue;
        if (d.kind === 'friendok') {
          if (!this.isFriend(from)) { this.addFriendRecord(from, str(d.fromName, 24) || 'Angler'); g.chat?.system(`${str(d.fromName, 24) || 'An angler'} accepted your friend request.`, 'join'); }
          this.closeMail(d.id);
        } else if (d.kind === 'friend') {
          if (this.isFriend(from)) { this.closeMail(d.id); continue; }
          reqs.push({ id: d.id, from, name: str(d.fromName, 24) || 'An angler', at: Number(d.at) || 0 });
        }
      }
      const fresh = reqs.filter((r) => !this.pending.some((p) => p.id === r.id));
      this.pending = reqs.sort((a, b) => b.at - a.at);
      if (fresh.length) {
        g.audio?.sfx('bell');
        if (fresh.length === 1) g.ui?.askInvite?.({ kind: 'friend', from: fresh[0].from, name: fresh[0].name, yes: () => this.answerRequest(fresh[0], true) });
        else g.ui?.toast?.(`${fresh.length} friend requests are waiting in Friends & Party.`, { icon: 'heart', ms: 6000 });
      }
      g.ui?.sheets?.current?.name === 'social' && g.ui.sheets.render();
    }, { limit: 60 });
  }
  /** Keeps my directory entry current (on log-on, and when my name or level changes). */
  listMe() {
    const g = this.game, name = str(g.profile?.name, 24);
    if (!name || !this.me) return;
    const sig = `${name}|${g.profile.level}`;
    if (sig === this.listed) return;
    this.listed = sig;
    g.shared.set('anglers', this.me, { name, key: name.trim().toLowerCase(), lvl: g.profile.level || 1, at: Date.now() });
  }
  closeMail(id) {
    this.game.ext.change((d) => { d.friendMailSeen = [...(d.friendMailSeen || []), id].slice(-200); });
    this.game.shared.update('mail', id, { claimed: true });
    this.pending = (this.pending || []).filter((p) => p.id !== id);
  }
  addFriendRecord(id, name, by = null) {
    this.game.ext.change((d) => { d.friends = { ...(d.friends || {}), [id]: { name: str(name, 24) || 'Angler', by: by || null, at: Date.now() } }; });
    this.game.ui?.sheets?.current?.name === 'social' && this.game.ui.sheets.render();
  }
  /** Accept or decline a request from the mailbox. */
  answerRequest(r, yes) {
    const g = this.game;
    this.closeMail(r.id);
    if (yes) {
      this.addFriendRecord(r.from, r.name);
      g.shared.set('mail', `fok_${r.from}_${this.me}`, { kind: 'friendok', to: r.from, from: this.me, fromName: str(g.profile.name, 24), at: Date.now(), claimed: false });
      g.chat?.system(`You and ${r.name} are friends now.`, 'join');
      g.audio?.sfx('achievement');
    }
    g.ui?.sheets?.current?.name === 'social' && g.ui.sheets.render();
  }
  /** Send a friend request to an angler by name, online or not. Resolves { ok, msg }. */
  async requestByName(raw) {
    const g = this.game, name = String(raw || '').trim().slice(0, 24);
    if (!name) return { msg: 'Type an angler name first.' };
    if (name.toLowerCase() === str(g.profile.name, 24).trim().toLowerCase()) return { msg: "That's you!" };
    // someone on the lake right now: the live request (they see it straight away)
    const here = this.peers().find((p) => str(p.meta?.name, 24).trim().toLowerCase() === name.toLowerCase());
    if (here) {
      if (this.isFriend(here.id, here.peer.by)) return { msg: `${name} is already your friend.` };
      this.friendRequest(here.id);
    }
    const found = (await g.shared.find('anglers', 'key', name.toLowerCase(), 10)).filter((d) => d.id !== this.me && !g.mod?.banOf?.(d.id));
    if (!found.length && !here) return { msg: `No angler called “${name}” has fished here yet.` };
    const target = here ? { id: here.id, name: str(here.meta?.name, 24) } : found.sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0)).map((d) => ({ id: d.id, name: str(d.name, 24) || name }))[0];
    if (this.isFriend(target.id)) return { msg: `${target.name} is already your friend.` };
    // they already asked me? then this is a yes
    const theirs = (this.pending || []).find((p) => p.from === target.id);
    if (theirs) { this.answerRequest(theirs, true); return { ok: true, msg: `You and ${target.name} are friends now.` }; }
    const ok = await g.shared.set('mail', `fr_${target.id}_${this.me}`, { kind: 'friend', to: target.id, from: this.me, fromName: str(g.profile.name, 24), at: Date.now(), claimed: false });
    if (!ok) return { msg: "Couldn't send that request (this view can't send mail)." };
    if (!here) g.chat?.system(`Friend request sent to ${target.name}. They'll see it next time they're on the lake.`, 'join');
    return { ok: true, msg: `Friend request sent to ${target.name}.` };
  }

  /** Friends list with who's on the lake right now. */
  friendList() {
    const here = this.peers();
    return Object.entries(this.friends).map(([id, f]) => {
      const p = here.find((x) => x.id === id || (f.by && x.peer.by === f.by));
      return { id: p?.id || id, name: str(p?.meta?.name, 24) || f.name, online: !!p, peer: p?.peer || null, at: f.at };
    }).sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
  }

  // ---------------- every half second ----------------
  tick(dt) {
    this.t += dt;
    if (this.t < 0.5) return;
    this.t = 0;
    if (this.mailOn && (this.listT = (this.listT || 0) + 1) % 20 === 0) this.listMe(); // name or level changed
    const g = this.game, me = this.me, peers = this.peers(), now = Date.now();
    // 1. my party, following the leader (or leading)
    const before = JSON.stringify(this.state && { ld: this.state.ld, m: this.state.m });
    const wasIn = this.inParty, oldM = this.members();
    this.invites = this.invites.filter((i) => now - i.at < INVITE_MS);
    // v1.13.1: someone whose presence blinks out for a moment (a busy tab, a hiccup on the line) still counts for
    // a few seconds, so a party doesn't break up over a stutter
    this.seen = this.seen || new Map();
    for (const p of peers) this.seen.set(p.id, { p, at: now });
    const steady = [...peers];
    for (const [id, s] of this.seen) { if (now - s.at > PRESENCE_GRACE_MS) this.seen.delete(id); else if (!peers.some((p) => p.id === id)) steady.push(s.p); }
    this.state = resolveParty(me, this.state, steady, { now, acc: this.acc, invited: this.invites.map((i) => i.to) });
    if (this.state && this.state.ld === me && this.acc) this.acc = null; // I lead now: my old accept is spent
    const after = JSON.stringify(this.state && { ld: this.state.ld, m: this.state.m });
    if (before !== after) {
      const nowM = this.members();
      for (const id of nowM) if (id !== me && wasIn && !oldM.includes(id)) g.chat?.system(`${this.nameOf(id)} joined the party.`, 'join');
      for (const id of oldM) if (id !== me && !nowM.includes(id) && this.state) g.chat?.system(`${this.nameOf(id)} left the party.`, 'leave');
      if (wasIn && !this.inParty) { g.chat?.system('Your party broke up.', 'leave'); if (g.riding) g.hopOut('Your party broke up, so you hopped out.'); }
      // invites I sent that are now answered
      this.invites = this.invites.filter((i) => !this.members().includes(i.to));
      this.push();
      g.ui?.renderParty?.();
    }
    this.frameT = (this.frameT || 0) + 1;
    if (this.frameT % 2 === 0) g.ui?.renderParty?.(); // distances and places, once a second
    // 2. invites and friend requests addressed to me
    for (const p of peers) {
      for (const inv of Array.isArray(p.meta.inv) ? p.meta.inv.slice(0, 4) : []) {
        if (inv?.to !== me || now - (Number(inv.at) || 0) > INVITE_MS) continue;
        const key = `inv:${p.id}:${str(inv.pid)}`;
        if (this.prompted.has(key) || this.state?.id === str(inv.pid)) continue;
        this.prompted.add(key);
        g.ui?.askInvite?.({ kind: 'party', from: p.id, name: this.nameOf(p.id), pid: str(inv.pid), yes: () => this.accept(p.id, str(inv.pid)) });
      }
      for (const r of Array.isArray(p.meta.fr) ? p.meta.fr.slice(0, 8) : []) {
        if (r?.to !== me || this.isFriend(p.id, p.peer.by)) continue;
        const key = `fr:${p.id}:${r.at}`;
        if (this.prompted.has(key)) continue;
        this.prompted.add(key);
        g.ui?.askInvite?.({ kind: 'friend', from: p.id, name: this.nameOf(p.id), yes: () => this.acceptFriend(p.id) });
      }
      // they accepted my friend request
      if ((Array.isArray(p.meta.fra) ? p.meta.fra : []).some((r) => r?.to === me) && this.fr.some((r) => r.to === p.id) && !this.isFriend(p.id, p.peer.by)) {
        this.addFriend(p.id); this.fr = this.fr.filter((r) => r.to !== p.id); this.push();
        g.chat?.system(`${this.nameOf(p.id)} accepted your friend request.`, 'join');
      }
    }
  }
}
