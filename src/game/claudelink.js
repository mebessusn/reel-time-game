// Claude link: the game knows when your Claude is working and when its answer is ready.
// The Reel Time plugin for Claude Code writes a tiny status doc on every prompt and every finished
// turn: in the artifact, into your private corner of the page's database (data/users/<you>/claude);
// on this device (dev server, tests), other tabs can
// signal through BroadcastChannel('rt_claude') (handy for testing), and tests call __claudeSignal().
//
// Signal shape: { state: 'working' | 'done', at: ms, startedAt?, seconds?, aborted?, turn?, steps? (v1.12.1: tool calls in the turn) }
// v1.13.2 (plugin 0.6.0): during a long turn the plugin re-sends "working" every couple of minutes with the turn's
// real startedAt, so `at` stays fresh and a game opened mid-prompt picks the timer up where it really is.
import { Emitter } from '../core/events.js';

const FRESH_MS = 10 * 60 * 1000; // a "done" older than this is history, not news

export class ClaudeLink extends Emitter {
  constructor(game) {
    super();
    this.game = game;
    this.state = 'idle'; // idle | working | ready
    this.startedAt = 0;
    this.lastDoneAt = 0;
    this.lastSignalAt = 0;
    this.source = null;
    this.turns = 0;
    if (typeof window !== 'undefined') window.__claudeSignal = (s) => this.signal(s, 'test');
  }

  async init() {
    try {
      this.bc = new BroadcastChannel('rt_claude');
      this.bc.onmessage = (e) => this.signal(e.data, 'tab');
    } catch { /* no BroadcastChannel */ }
    // Artifact: your private status doc
    const db = await window.claude?.use?.('db').catch(() => null);
    const user = await window.claude?.use?.('user').catch(() => null);
    const id = await user?.id?.().catch?.(() => null);
    if (db && id) {
      this.db = db; this.uid = id;
      try {
        const ref = db.collection(`data/users/${id}`).doc('claude');
        this.unsub = ref.onSnapshot((snap) => {
          if (snap.exists) this.signal(snap.data(), 'artifact');
        }, () => {});
        this.source = 'artifact';
        // v1.13.2: opened mid-prompt? Read the status once as well, so a prompt that was already running shows up
        // straight away with its real start time (the live listener can miss a doc written before it attached).
        ref.get().then((snap) => { if (snap?.exists) this.signal(snap.data(), 'artifact'); }).catch(() => {});
      } catch { /* db unavailable here */ }
    }
  }

  get linked() { return !!this.lastSignalAt; }
  get working() { return this.state === 'working'; }
  elapsed() { return this.state === 'working' ? Math.max(0, (Date.now() - this.startedAt) / 1000) : 0; }

  signal(s, via = 'test') {
    if (!s || typeof s !== 'object') return;
    const at = Number(s.at) || Date.now();
    if (at < this.lastSignalAt) return; // out of order
    if (at === this.lastSignalAt && s.state === this.lastState) return; // the same doc twice (listener + first read)
    this.lastState = s.state;
    this.lastSignalAt = at;
    // v1.13.2: remember that this angler's Claude is linked, so the "Link Claude" hint never shows again
    if (s.state === 'working' || s.state === 'done') {
      const ext = this.game.ext;
      if (ext?.d && !ext.d.claudeLinkedAt) ext.change((d) => { d.claudeLinkedAt = Date.now(); });
    }
    if (s.state === 'working') {
      if (Date.now() - at > FRESH_MS * 3) return; // a stale "working" left behind by a closed session
      const first = this.state !== 'working';
      this.state = 'working';
      this.startedAt = Math.min(Number(s.startedAt) || at, Date.now()); // v1.12.1: a start time in the future (a wrong clock) would freeze the timer at 0:00
      // a prompt that was already running when the game opened keeps its real start, so the timer (and the
      // Patient Angler buff, and the answer's reward) count the time you already waited
      if (first) { this.waitFish = 0; this.emit('working', { via, elapsed: this.elapsed() }); }
    } else if (s.state === 'done') {
      const wasNew = at > this.lastDoneAt;
      this.lastDoneAt = at;
      this.state = 'idle';
      if (wasNew && Date.now() - at < FRESH_MS && !s.aborted) {
        this.turns++;
        this.state = 'ready';
        this.emit('ready', { seconds: Number(s.seconds) || 0, steps: Math.max(0, Math.min(10000, Math.floor(Number(s.steps) || 0))), via });
      } else this.emit('idle', {});
    }
  }

  // Fish caught while Claude worked: kept for the game and written next to the status doc, so the
  // Claude Code plugin can say "you caught 2 fish while you waited".
  async reportLake(waitFish, total) {
    if (!this.db || !this.uid) return;
    try { await this.db.collection(`data/users/${this.uid}`).doc('claude_lake').set({ waitFish, total, at: Date.now() }); } catch { /* best effort */ }
  }

  // The answer fish was landed (or the notice dismissed)
  consume() { if (this.state === 'ready') { this.state = 'idle'; this.emit('idle', {}); } }
}
