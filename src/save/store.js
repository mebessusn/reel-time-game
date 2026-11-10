// v1.17.18 save safety: the one place the angler's save is read from and written to browser storage.
// - A save that won't parse is never written over: the damaged text is kept (rt_bad_<key>) and the last good copy
//   (rt_bak_<key>, taken each time the game starts with a readable save) is loaded instead.
// - A write that fails (storage full or blocked) is reported to the game, which tells the player, instead of being
//   ignored. Before giving up, things that can be dropped (the oldest photos) make room for progress.

const noticeListeners = new Set();
const evictors = [];

/** Listen for save trouble: { kind: 'failed', key, quota } or { kind: 'evicted', what }. Returns an unsubscribe. */
export function onSaveNotice(fn) { noticeListeners.add(fn); return () => noticeListeners.delete(fn); }
const notify = (n) => { for (const fn of noticeListeners) { try { fn(n); } catch { /* a listener's problem */ } } };

/** Register something that can give up its storage to make room for the save. `fn()` frees some space and returns
 *  a short description of what went (e.g. 'your oldest photo'), or false when it has nothing left to give. */
export function addEvictor(fn) { evictors.push(fn); }

export const bakKey = (key) => `rt_bak_${key.replace(/^rt_/, '')}`;
export const badKey = (key) => `rt_bad_${key.replace(/^rt_/, '')}`;

function getRaw(key) { try { return localStorage.getItem(key); } catch { return null; } }
function setRaw(key, s, { evict = false } = {}) {
  for (let tries = 0; ; tries++) {
    try { localStorage.setItem(key, s); return true; } catch (e) {
      if (evict && tries < 8) {
        let what = false;
        for (const fn of evictors) { try { what = fn(); } catch { what = false; } if (what) break; }
        if (what) { notify({ kind: 'evicted', what }); continue; }
      }
      return { error: e };
    }
  }
}
const isSave = (v) => !!v && typeof v === 'object';
function parse(raw) { try { const v = JSON.parse(raw); return isSave(v) ? v : undefined; } catch { return undefined; } }

/**
 * Read a save key. Returns { value, status }:
 *  'ok'       the save read fine (and a backup of it was taken)
 *  'empty'    there is no save yet
 *  'restored' the save was damaged; value is the last good copy; the damaged text is kept
 *  'lost'     the save was damaged and there's no good copy; value is null; the damaged text is kept
 */
export function loadSafe(key) {
  const raw = getRaw(key);
  if (raw == null) return { value: null, status: 'empty' };
  const value = parse(raw);
  if (value) { setRaw(bakKey(key), raw); return { value, status: 'ok' }; }
  setRaw(badKey(key), raw, { evict: true });
  const bak = parse(getRaw(bakKey(key)));
  if (bak) return { value: bak, status: 'restored' };
  return { value: null, status: 'lost' };
}

/** Write a save key. Returns true when it's stored; on failure the game is told and it returns false. */
export function writeJSON(key, value) {
  let s;
  try { s = JSON.stringify(value); } catch (e) { notify({ kind: 'failed', key, quota: false, error: e }); return false; }
  const r = setRaw(key, s, { evict: true });
  if (r === true) return true;
  notify({ kind: 'failed', key, quota: /quota/i.test(`${r.error?.name} ${r.error?.message}`), error: r.error });
  return false;
}
