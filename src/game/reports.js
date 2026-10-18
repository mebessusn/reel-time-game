// Bug reports and player reports (v1.10.1). Both go to the lake's admins:
//  - In the published artifact the page can't reach the internet (its sandbox blocks every outside request), so
//    a report is saved to the artifact's own database (`bugs/<your id>`, `reports/<your id>`, readable by admins
//    only) and a scheduled forwarder emails new ones to the inbox. Admins also see them in the Admin panel.
//  - On the web build (and the dev server) the game posts straight to the beta site's /api/report function
//    (VITE_REPORT_URL), which emails them with Resend.
//  - If neither works (a view-only share, offline), the form offers "Copy report" so nothing typed is lost.
import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { GAME_VERSION } from '../data/changelog.js';

export const REPORT_URL = import.meta.env?.VITE_REPORT_URL || '';
// v1.13.11: player feedback (ideas, likes, gripes) rides the same road as bug reports, marked type 'feedback'
export const FEEDBACK_KINDS = [['idea', 'An idea or wish'], ['love', 'Something I love'], ['gripe', 'Something that bugs me'], ['balance', 'Prices, levels or rewards'], ['other', 'Something else']];
export const FEEDBACK_MOODS = [[1, '😞', 'Not having fun'], [2, '🙁', 'Meh'], [3, '😐', 'Okay'], [4, '🙂', 'Good'], [5, '😄', 'Loving it']];
export const BUG_KINDS = [['gameplay', 'Gameplay or fishing'], ['visual', 'Graphics or the world'], ['ui', 'Menus, buttons or text'], ['multi', 'Multiplayer or chat'], ['crash', 'Freeze, crash or slowdown'], ['other', 'Something else']];
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, n);

// the last few errors on this page, attached to bug reports (only if the player leaves "Include details" ticked)
const ERRORS = [];
if (typeof window !== 'undefined') {
  const keep = (m) => { ERRORS.push({ m: clip(m, 200), at: Date.now() }); if (ERRORS.length > 8) ERRORS.shift(); };
  window.addEventListener('error', (e) => keep(`${e.message} @ ${String(e.filename || '').split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => keep(`promise: ${e.reason?.message || e.reason}`));
}

/** What the game was doing: version, browser, screen, place, mode, players. No personal data. */
export function diagnostics(g) {
  const p = g?.player?.pos;
  const ua = navigator.userAgent;
  const v = (re, name) => { const m = ua.match(re); return m ? `${name} ${m[1]}` : null; };
  const browser = v(/Edg\/(\d+)/, 'Edge') || v(/Chrome\/(\d+)/, 'Chrome') || v(/Firefox\/(\d+)/, 'Firefox') || v(/Version\/(\d+).*Safari/, 'Safari') || 'other';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'other';
  return {
    version: GAME_VERSION, browser, os, screen: `${innerWidth}x${innerHeight}@${devicePixelRatio || 1}`,
    where: g?.started ? `${g.currentZoneLabel?.() || '?'} (${p ? `${p.x.toFixed(1)}, ${p.z.toFixed(1)}` : '?'})` : 'title screen',
    mode: g?.started ? `${g.player?.mode || '?'} / fishing ${g.fishing?.state || '?'}` : '-',
    gfx: g?.profile?.settings?.gfx || '-', net: `${g?.net?.kind || 'none'}${g?.net?.solo ? ' (solo)' : ''}, ${g?.net?.peers?.size || 0} others`,
    fps: Math.round(g?.engine?.fps || 0) || undefined, level: g?.profile?.level,
    errors: ERRORS.map((e) => e.m),
  };
}

/** Plain-text version of a report (the email body, and what "Copy report" copies). */
export function reportText(kind, r) {
  if (kind === 'feedback' || r?.type === 'feedback') {
    const mood = FEEDBACK_MOODS.find(([n]) => n === r.mood);
    return [`Reel Time feedback (${r.kindLabel || r.cat})`, `From: ${r.from || 'an angler'}`, mood ? `Enjoying it: ${r.mood}/5 (${mood[2]})` : '', `Title: ${r.title}`, '', r.text, '',
      r.diag ? `Version ${r.diag.version} · ${r.diag.browser} on ${r.diag.os} · level ${r.diag.level ?? '?'}` : `Version ${GAME_VERSION}`].filter((x) => x !== '').join('\n');
  }
  if (kind === 'bug') {
    const d = r.diag || {};
    return [`Reel Time bug report (${r.kindLabel || r.cat})`, `From: ${r.from || 'an angler'}`, `Title: ${r.title}`, '', r.text, '', r.steps ? `Steps to reproduce:\n${r.steps}\n` : '',
      r.diag ? `Version ${d.version} · ${d.browser} on ${d.os} · ${d.screen}\nWhere: ${d.where} · ${d.mode}\nGraphics: ${d.gfx} · Net: ${d.net}${d.fps ? ` · ${d.fps} fps` : ''}${d.errors?.length ? `\nRecent errors:\n- ${d.errors.join('\n- ')}` : ''}` : 'No game details attached.'].filter((x) => x !== '').join('\n');
  }
  return [`Reel Time player report: ${r.reasonLabel || r.reason}`, `Reported angler: ${r.name}${r.target ? ` (id ${r.target})` : ''}`, `From: ${r.from || 'an angler'}`, '', r.text || '(no details)', '', `Version ${GAME_VERSION}`].join('\n');
}

/** Web build: email it through the beta site. Resolves true when the server took it. */
export async function postReport(kind, r) {
  if (!REPORT_URL || (typeof window !== 'undefined' && window.claude?.use)) return false;
  try {
    const res = await fetch(REPORT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, report: r, text: reportText(kind, r) }) });
    return res.ok;
  } catch { return false; }
}

/** Saves a bug report: artifact db (forwarded to the inbox), or the web route; false if neither worked. */
export async function sendBug(g, r) {
  const viaWeb = await postReport(r.type === 'feedback' ? 'feedback' : 'bug', r);
  let viaDb = false;
  const mod = g.mod;
  try {
    await g.shared?.init?.();
    const id = await mod?.ensureId?.();
    if (id && g.shared) {
      mod.myBugs = [...(mod.myBugs || []), r].slice(-15);
      // outside the artifact this lands on the device only (dev server); in the artifact it needs the db
      viaDb = (await g.shared.set('bugs', id, { list: mod.myBugs, from: r.from, at: r.at })) !== false && (!!g.shared.db || !window.claude?.use);
    }
  } catch { /* fall through */ }
  return viaWeb || viaDb;
}

function modal(root, card, onClose) {
  const el = h('div.menu-screen.confirm-screen.report-screen', { on: { click: (e) => { if (e.target === el) close(); } } }, card);
  const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const close = () => { window.removeEventListener('keydown', esc, true); el.remove(); onClose?.(); };
  window.addEventListener('keydown', esc, true);
  root.append(el);
  return close;
}

/** Shown when a report couldn't be delivered: copy it so it can be sent another way. */
function fallback(card, text, close) {
  clear(card);
  const copy = h('button.btn.primary', { on: { click: async () => { try { await navigator.clipboard.writeText(text); copy.lastChild.textContent = 'Copied'; } catch { area.select(); copy.lastChild.textContent = 'Select and copy below'; } } } }, icon('copy'), h('span', 'Copy report'));
  const area = h('textarea.report-text', { rows: 7, readOnly: true }, text);
  card.append(h('h3', "Couldn't send it from here"),
    h('p.muted', "This copy of the game can't save reports (it may be shared with you view-only, or you're offline). Copy the report and send it to whoever shared Reel Time with you."),
    area, h('div.confirm-btns', h('button.btn.ghost', { on: { click: close } }, 'Close'), copy));
}

/** The bug report form. Works from the title screen and in game. */
export function openBugReport(g) {
  const root = g.ui?.root || document.body;
  let cat = null;
  const title = h('input.report-input', { maxLength: 80, placeholder: 'Short summary, e.g. "Boat gets stuck at the Quarry Cut"', 'aria-label': 'Summary' });
  const text = h('textarea.report-text', { maxLength: 1500, rows: 4, placeholder: 'What happened? What did you expect to happen?', 'aria-label': 'What happened' });
  const steps = h('textarea.report-text', { maxLength: 800, rows: 3, placeholder: 'Steps to make it happen again (optional)', 'aria-label': 'Steps to reproduce' });
  const diag = h('input', { type: 'checkbox', checked: true });
  const ready = () => { send.disabled = !(cat && title.value.trim().length >= 4 && text.value.trim().length >= 10); };
  title.addEventListener('input', ready); text.addEventListener('input', ready);
  const send = h('button.btn.primary', { disabled: true, on: { click: async () => {
    send.disabled = true; send.lastChild.textContent = 'Sending…';
    const r = { id: Date.now().toString(36), cat, kindLabel: BUG_KINDS.find(([k]) => k === cat)?.[1], title: clip(title.value, 80), text: clip(text.value, 1500), steps: clip(steps.value, 800), from: clip(g.profile?.name, 24), at: Date.now(), diag: diag.checked ? diagnostics(g) : null };
    const ok = await sendBug(g, r);
    if (ok) { close(); g.audio?.sfx?.('achievement'); g.ui?.toast?.('Thanks! Your bug report is on its way.', { icon: 'check', ms: 4500 }); }
    else fallback(card, reportText('bug', r), close);
  } } }, icon('mail'), h('span', 'Send bug report'));
  const card = h('div.menu-card.report-card.bug-card', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Report a bug' },
    h('div.menu-card-head', h('h2', icon('bug'), 'Report a bug'), h('button.btn.close-x.ghost', { 'aria-label': 'Close', on: { click: () => close() } }, icon('close'))),
    h('p.muted', 'Something broken, stuck or odd? Tell us and we\'ll take a look.'),
    h('div.report-label', 'What kind of problem?'),
    h('div.report-reasons', BUG_KINDS.map(([k, l]) => h('label', h('input', { type: 'radio', name: 'bugkind', value: k, on: { change: () => { cat = k; ready(); } } }), l))),
    h('div.report-label', 'Summary'), title,
    h('div.report-label', 'What happened'), text, steps,
    h('label.report-check', diag, h('span', 'Include game details (version, browser, screen size, where you are, recent errors). Nothing personal.')),
    h('div.confirm-btns', h('button.btn.ghost', { on: { click: () => close() } }, 'Cancel'), send));
  const close = modal(root, card);
  g.audio?.sfx?.('open');
  requestAnimationFrame(() => card.querySelector('input[type=radio]')?.focus({ preventScroll: true }));
}

/** v1.13.11: the feedback form, from the title menu and the pause menu. Same delivery as a bug report. */
export function openFeedback(g) {
  const root = g.ui?.root || document.body;
  let cat = null, mood = null;
  const title = h('input.report-input', { maxLength: 80, placeholder: 'In a few words, e.g. "Let me paint my boat"', 'aria-label': 'Summary' });
  const text = h('textarea.report-text', { maxLength: 1500, rows: 5, placeholder: 'Tell us more: what you like, what you would change, what you wish the valley had.', 'aria-label': 'Your feedback' });
  const ready = () => { send.disabled = !(cat && text.value.trim().length >= 10); };
  text.addEventListener('input', ready);
  const moods = h('div.feedback-moods', FEEDBACK_MOODS.map(([n, e, l]) => {
    const b = h('button.feedback-mood', { type: 'button', title: l, 'aria-label': l, 'aria-pressed': 'false', on: { click: () => { mood = n; moods.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); } } }, e);
    return b;
  }));
  const send = h('button.btn.primary', { disabled: true, on: { click: async () => {
    send.disabled = true; send.lastChild.textContent = 'Sending…';
    const label = FEEDBACK_KINDS.find(([k]) => k === cat)?.[1];
    const r = { id: Date.now().toString(36), type: 'feedback', cat, kindLabel: label, mood, title: clip(title.value, 80) || clip(text.value, 60), text: clip(text.value, 1500), from: clip(g.profile?.name, 24), at: Date.now(), diag: { version: GAME_VERSION, ...pick(diagnostics(g)) } };
    const ok = await sendBug(g, r);
    if (ok) { close(); g.audio?.sfx?.('achievement'); g.ui?.toast?.('Thank you! Your feedback is on its way.', { icon: 'check', ms: 4500 }); }
    else fallback(card, reportText('feedback', r), close);
  } } }, icon('mail'), h('span', 'Send feedback'));
  const card = h('div.menu-card.report-card.feedback-card', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Send feedback' },
    h('div.menu-card-head', h('h2', icon('chat'), 'Send feedback'), h('button.btn.close-x.ghost', { 'aria-label': 'Close', on: { click: () => close() } }, icon('close'))),
    h('p.muted', 'Ideas, favourite bits, things that annoy you: it all helps shape the valley. We read every one.'),
    h('div.report-label', 'How are you enjoying Reel Time? (optional)'), moods,
    h('div.report-label', 'What is it about?'),
    h('div.report-reasons', FEEDBACK_KINDS.map(([k, l]) => h('label', h('input', { type: 'radio', name: 'fbkind', value: k, on: { change: () => { cat = k; ready(); } } }), l))),
    h('div.report-label', 'Summary (optional)'), title,
    h('div.report-label', 'Your feedback'), text,
    h('div.confirm-btns', h('button.btn.ghost', { on: { click: () => close() } }, 'Cancel'), send));
  const close = modal(root, card);
  g.audio?.sfx?.('open');
  requestAnimationFrame(() => card.querySelector('.feedback-mood')?.focus({ preventScroll: true }));
}
// feedback carries only the non-identifying basics: version, browser, OS, level
const pick = (d) => ({ browser: d.browser, os: d.os, level: d.level });

/** Pick who to report: everyone on the lake right now. */
export function openPlayerPicker(g) {
  const root = g.ui.root, mod = g.mod;
  const people = mod?.people?.() || [];
  const card = h('div.menu-card.report-card', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Report a player' },
    h('div.menu-card-head', h('h2', icon('shield'), 'Report a player'), h('button.btn.close-x.ghost', { 'aria-label': 'Close', on: { click: () => close() } }, icon('close'))),
    h('p.muted', 'For misconduct, cheating or exploiting, or a rude name or outfit. Reports go to the lake admins only.'),
    people.length ? h('div.row-list.report-people', people.map((p) => h('div.list-row', icon('user'),
      h('div.grow', h('div.ttl', p.name), h('div.meta', p.guest ? 'Guest' : 'On the lake now')),
      h('button.btn.small', { on: { click: () => { close(); mod.openReport(p); } } }, icon('shield'), 'Report'))))
      : h('div.empty', 'Nobody else is on the lake right now. To report someone who left, type /report name in chat while they\'re here, or describe it in a bug report.'));
  const close = modal(root, card);
  g.audio?.sfx?.('open');
}
