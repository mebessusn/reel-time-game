// Shared lake data (community meter, bottle messages, the dock's gear box).
// In the published artifact it lives in the page's `db` (everyone who opens the page shares it);
// elsewhere it falls back to this device (localStorage + BroadcastChannel, so tabs share it).
// Everything read here was written by other players: callers sanitize it.

const safe = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

export class Shared {
  constructor() {
    this.db = null;
    this.kind = 'local';
    try { this.bc = new BroadcastChannel('rt_shared'); this.bc.onmessage = (e) => this.localNotify(e.data?.name); } catch { this.bc = null; }
    this.watchers = new Map(); // name -> Set(fn)
  }

  async init() {
    if (typeof window === 'undefined' || !window.claude?.use) return this;
    const db = await window.claude.use('db').catch(() => null);
    if (db) { this.db = db; this.kind = 'db'; }
    return this;
  }

  // ---- local fallback
  localAll(name) { return safe.get(`rt_shared_${name}`, {}); }
  localNotify(name) { if (!name) return; const docs = Object.entries(this.localAll(name)).map(([id, d]) => ({ id, ...d })); this.watchers.get(name)?.forEach((fn) => fn(docs)); }

  /** Live list of docs in a collection: fn([{ id, ...data }]). Returns an unsubscribe. */
  watch(name, fn, { limit = 200 } = {}) {
    if (this.db) {
      try {
        return this.db.collection(name).limit(limit).onSnapshot((snap) => fn(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => fn([]));
      } catch { /* fall through to local */ }
    }
    if (!this.watchers.has(name)) this.watchers.set(name, new Set());
    this.watchers.get(name).add(fn);
    setTimeout(() => this.localNotify(name), 0);
    return () => this.watchers.get(name)?.delete(fn);
  }

  /** v1.12: live list of docs where `field == value` (e.g. mail addressed to me). */
  watchWhere(name, field, value, fn, { limit = 100 } = {}) {
    if (this.db) {
      try {
        return this.db.collection(name).where(field, '==', value).limit(limit).onSnapshot((snap) => fn(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => fn([]));
      } catch { /* fall through to local */ }
    }
    return this.watch(name, (docs) => fn(docs.filter((d) => d && d[field] === value).slice(0, limit)), { limit });
  }

  /** v1.12: one-off read of docs where `field == value`. */
  async find(name, field, value, limit = 20) {
    if (this.db) {
      try { const snap = await this.db.collection(name).where(field, '==', value).limit(limit).get(); return snap.docs.map((d) => ({ id: d.id, ...d.data() })); } catch { return []; }
    }
    return Object.entries(this.localAll(name)).map(([id, d]) => ({ id, ...d })).filter((d) => d[field] === value).slice(0, limit);
  }

  async set(name, id, data) {
    const docId = String(id).replace(/[^\w-]/g, '_').slice(0, 120);
    if (this.db) {
      try { await this.db.collection(name).doc(docId).set(data); return true; } catch { return false; }
    }
    const all = this.localAll(name);
    all[docId] = data;
    safe.set(`rt_shared_${name}`, all);
    this.localNotify(name);
    this.bc?.postMessage({ name });
    return true;
  }

  async update(name, id, patch) {
    const docId = String(id).replace(/[^\w-]/g, '_').slice(0, 120);
    if (this.db) {
      try { await this.db.collection(name).doc(docId).update(patch); return true; } catch { return false; }
    }
    const all = this.localAll(name);
    if (!all[docId]) return false;
    all[docId] = { ...all[docId], ...patch };
    safe.set(`rt_shared_${name}`, all);
    this.localNotify(name);
    this.bc?.postMessage({ name });
    return true;
  }
}
