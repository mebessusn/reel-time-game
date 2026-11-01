// v1.14.6: move a save between computers or browsers. Export writes every piece of the angler's own progress kept in
// browser storage (the profile, album, trophies, settings and tips: every `rt_` key) to a small .json file; Import reads
// one back, replacing this browser's save, and restarts the game. Lake-wide data (the shared lake store, feed, board and
// records) stays with the lake and isn't moved.
const SKIP = /^rt_(shared_|feed|board|records)/;
const APP = 'reel-time-save';

export function collectSave() {
  const keys = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('rt_') && !SKIP.test(k)) keys[k] = localStorage.getItem(k);
    }
  } catch { /* storage blocked */ }
  return { app: APP, v: 1, at: new Date().toISOString(), keys };
}

/** Download the save as a file. Returns true when it went. */
export async function exportSave(name = 'angler') {
  const data = collectSave();
  if (!Object.keys(data.keys).length) return false;
  const safeName = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'angler';
  const filename = `reel-time-save-${safeName}-${data.at.slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const dl = await window.claude?.use?.('downloads').catch(() => null);
  if (dl) { try { await dl.save({ filename, data: blob }); return true; } catch (e) { if (e?.code !== 'unavailable') return false; } }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}

/** Check a save file's text. Returns { ok, keys, at, error }. */
export function parseSave(text) {
  let d;
  try { d = JSON.parse(text); } catch { return { ok: false, error: "That file isn't a Reel Time save." }; }
  if (!d || d.app !== APP || typeof d.keys !== 'object' || !d.keys) return { ok: false, error: "That file isn't a Reel Time save." };
  const keys = {};
  for (const [k, v] of Object.entries(d.keys)) if (typeof k === 'string' && k.startsWith('rt_') && !SKIP.test(k) && typeof v === 'string') keys[k] = v;
  if (!Object.keys(keys).some((k) => k.startsWith('rt_profile_'))) return { ok: false, error: 'That save has no angler in it.' };
  return { ok: true, keys, at: d.at };
}

/** Replace this browser's save with `keys` (from parseSave). The caller restarts the game straight after. */
export function applySave(keys) {
  const old = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('rt_') && !SKIP.test(k)) old.push(k); }
  for (const k of old) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
}
