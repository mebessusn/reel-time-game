// Multiplayer transport. LocalNet: BroadcastChannel between tabs (guest mode + tests).
// RoomNet: the Claude artifact's room (everyone with the lake open). NullNet: single player.
import { Emitter } from '../core/events.js';

const PEER_TIMEOUT = 9000;

class BaseNet extends Emitter {
  constructor() {
    super();
    this.peers = new Map();
    this.me = null;
  }
  // v1.13.7: once you leave (switching to single player), a net goes quiet for good, even if its transport
  // keeps reporting peers (the artifact room's presence listener can't be removed)
  emit(type, data) { if (this.left) return; super.emit(type, data); }
  _upsertPeer(id, patch) {
    if (!id || id === this.me?.id) return null;
    const isNew = !this.peers.has(id);
    const p = this.peers.get(id) || { id, meta: {}, state: null, last: 0 };
    Object.assign(p, patch, { last: Date.now() });
    // v1.10: banned and suspended anglers never join your lake (the game sets this filter)
    if (this.isBlocked?.(p)) { if (!isNew) this._removePeer(id); return null; }
    this.peers.set(id, p);
    if (isNew) this.emit('peer:join', p);
    return p;
  }
  _removePeer(id) {
    const p = this.peers.get(id);
    if (p) { this.peers.delete(id); this.emit('peer:leave', p); }
  }
  sweep() {
    const now = Date.now();
    for (const [id, p] of this.peers) if (now - p.last > PEER_TIMEOUT) this._removePeer(id);
  }
  _handle(msg) {
    if (!msg || msg.id === this.me?.id) return;
    switch (msg.t) {
      case 'hello': {
        const known = this.peers.has(msg.id);
        this._upsertPeer(msg.id, { meta: msg.meta });
        if (known) this.emit('peer:meta', this.peers.get(msg.id));
        // answer a newcomer's hello, or anyone asking for our details again (they lost us after a stall)
        if ((!known && !msg.reply) || msg.ask) this._send({ t: 'hello', id: this.me.id, meta: this.me, reply: true });
        break;
      }
      case 'meta': this._upsertPeer(msg.id, { meta: msg.meta }); this.emit('peer:meta', this.peers.get(msg.id)); break;
      case 'state': {
        const p = this.peers.get(msg.id);
        if (!p) { this._upsertPeer(msg.id, { state: msg.s }); this._send({ t: 'hello', id: this.me.id, meta: this.me, reply: false, ask: true }); }
        else { p.prev = p.state; p.prevAt = p.stateAt; p.state = msg.s; p.stateAt = performance.now(); p.last = Date.now(); }
        break;
      }
      case 'ev': this.peers.has(msg.id) && (this.peers.get(msg.id).last = Date.now()); this.emit(`ev:${msg.type}`, { from: msg.id, data: msg.data, peer: this.peers.get(msg.id) }); break;
      case 'chat': {
        const p = this.peers.get(msg.id);
        if (p) p.last = Date.now();
        this.emit('chat', { from: msg.id, peer: p, m: msg.m });
        break;
      }
      case 'bye': this._removePeer(msg.id); break;
      default: break;
    }
  }
  setMeta(meta) { this.me = { ...this.me, ...meta }; this._send({ t: 'meta', id: this.me.id, meta: this.me }); }
  sendState(s) { this._send({ t: 'state', id: this.me.id, s }); }
  emitEvent(type, data) { this._send({ t: 'ev', id: this.me.id, type, data }); }
  // Chat: m = { n, x: text, to: userId|null, me: bool (action), at, nm: sender name }
  sendChat(m) { this._send({ t: 'chat', id: this.me.id, m }); }
  // v1.15 Open Waters: a named side room for a group (a charter's crew). joinRoom returns another net (same
  // interface, same events) whose peers are only the others who joined that name; the game switches to it while
  // the group is together and back with leaveRoom(). Transports without side rooms give a quiet (solo) one.
  joinRoom(name) { this.leaveRoom(); this.sub = this._subNet(roomName(name)); return this.sub; }
  leaveRoom() { const s = this.sub; this.sub = null; try { s?.leave(); } catch { /* already gone */ } }
  _subNet() { return new NullNet(); }
}
/** A side room's name: lowercase letters, digits, dot, dash and underscore (the artifact room's rule). */
export const roomName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').replace(/^[^a-z0-9]+/, '').slice(0, 44) || 'crew';

export class LocalNet extends BaseNet {
  constructor(room = 'main') { super(); this.room = room; this.kind = 'local'; }
  async connect(me) {
    this.me = me;
    try { this.bc = new BroadcastChannel(`rt_lake_${this.room}`); } catch { this.bc = null; return false; }
    this.bc.onmessage = (e) => this._handle(e.data);
    this._send({ t: 'hello', id: me.id, meta: me });
    this.sweepTimer = setInterval(() => this.sweep(), 2000);
    window.addEventListener('beforeunload', () => this.leave());
    this.connected = true;
    return true;
  }
  _send(msg) { try { this.bc?.postMessage(msg); } catch { /* ignore */ } }
  leave() { this._send({ t: 'bye', id: this.me?.id }); clearInterval(this.sweepTimer); this.bc?.close(); this.connected = false; this.left = true; }
  _subNet(name) { return new LocalNet(`${this.room}~${name}`); }
}

export class NullNet extends BaseNet {
  constructor() { super(); this.kind = 'none'; }
  async connect(me) { this.me = me; return false; }
  _send() {}
  leave() {}
}

// Inside a published Claude artifact: everyone viewing the artifact shares the lake through the
// artifact runtime's `room` presence. State and the latest event ride in each viewer's presence,
// so even view-only viewers (who cannot emit room topics) are seen fishing.
export class RoomNet extends BaseNet {
  constructor(parent = null, name = null) { super(); this.kind = 'room'; this.evN = 0; this.seenEv = new Map(); this.chatRing = []; this.seenChat = new Map(); this.parent = parent; this.subName = name; }
  async connect(me) {
    this.me = me;
    // a side room (joinRoom) is a named room inside the lake's room; the lake itself is the artifact's room
    const room = this.parent ? await this.parent.join(`rt-${this.subName}`).catch(() => null) : await window.claude?.use?.('room').catch(() => null);
    // A viewer the platform doesn't admit to the room (here by an "Anyone with the link" share, or signed out)
    // gets null or a not_granted error: they fish solo. `solo` lets the UI say so instead of failing silently.
    if (!room) { this.solo = true; this.soloReason = 'room-null'; this.emit('solo', {}); return false; }
    this.room = room;
    const dead = (e) => { if (['not_granted', 'revoked', 'capability_disabled', 'capability_removed'].includes(e?.code) && !this.solo) { this.solo = true; this.soloReason = e.code; this.connected = false; this.emit('solo', { code: e.code }); } };
    room.onConnection(() => {}, dead);
    room.onPeers(({ peers, left }) => {
      if (this.left) return;
      for (const p of left) this._removePeer(p.peer);
      for (const p of peers) {
        if (p.isMe || p.sameTab) continue;
        const pr = p.presence || {};
        if (!pr.meta) continue;
        const peer = this._upsertPeer(p.peer, { meta: pr.meta, by: p.by || null, guest: !!p.guest });
        if (!peer) continue;
        peer.best = pr.best || null;
        if (pr.s) { peer.prev = peer.state; peer.state = pr.s; peer.stateAt = performance.now(); }
        // Chat rides in presence too: each viewer keeps their last few lines there, so view-only
        // viewers can talk and late joiners see the last couple of minutes.
        if (Array.isArray(pr.chat)) {
          const seen = this.seenChat.get(p.peer);
          let maxN = seen ?? -1;
          for (const m of pr.chat) {
            if (!m || typeof m.n !== 'number' || typeof m.x !== 'string') continue;
            if (m.n <= maxN && seen !== undefined) continue;
            if (seen === undefined && !(Date.now() - (m.at || 0) < 180000)) continue;
            this.emit('chat', { from: p.peer, peer, m, history: seen === undefined });
          }
          for (const m of pr.chat) if (m && m.n > maxN) maxN = m.n;
          this.seenChat.set(p.peer, maxN);
        }
        const ev = pr.ev;
        if (ev && ev.n !== this.seenEv.get(p.peer)) {
          const first = !this.seenEv.has(p.peer);
          this.seenEv.set(p.peer, ev.n);
          if (!first) this.emit(`ev:${ev.type}`, { from: p.peer, data: ev.data, peer });
        }
      }
    }, (e) => { console.warn('[room]', e.code, e.message); dead(e); });
    await room.presence({ meta: me, s: null, ev: null }).catch(dead);
    if (this.solo) return false;
    this.sweepTimer = setInterval(() => { for (const p of this.peers.values()) p.last = Date.now(); }, 3000);
    this.connected = true;
    return true;
  }
  _send() {}
  setMeta(meta) { this.me = { ...this.me, ...meta }; this.room?.presence({ meta: this.me }).catch(() => {}); }
  sendState(s) { this.room?.presence({ s }).catch(() => {}); }
  emitEvent(type, data) { this.evN++; this.room?.presence({ ev: { n: this.evN, type, data } }).catch(() => {}); }
  setBest(b) { this.room?.presence({ best: b }).catch(() => {}); }
  sendChat(m) {
    this.chatRing = [...this.chatRing, m].slice(-5);
    const push = (ring) => this.room?.presence({ chat: ring }).catch((e) => {
      if (e?.code === 'invalid_argument' && ring.length > 1) { this.chatRing = ring.slice(-Math.max(1, ring.length - 2)); push(this.chatRing); }
    });
    push(this.chatRing);
  }
  leave() {
    clearInterval(this.sweepTimer);
    this.room?.presence({ meta: null, s: null, ev: null, chat: null, best: null }).catch(() => {});
    if (this.parent) this.room?.leave?.().catch?.(() => {});
    this.connected = false; this.left = true;
  }
  _subNet(name) { return this.room ? new RoomNet(this.room, name) : new NullNet(); }
}
