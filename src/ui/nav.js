// Keyboard and controller navigation for every menu.
// - Tab or the arrow keys switch on "keyboard mode" (a visible focus ring); the mouse switches it off.
// - On a controller, the d-pad / left stick move focus spatially inside whatever panel is on top,
//   A presses the focused control, and sliders move with left / right.

const LAYERS = '.menu-screen, .title-screen, .sheet, .reveal, .creator, .splash, .wheel, .polaroid-card, .viewer, .catch-card, .tutorial, .home-panel';
const visible = (el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed';

export function topLayer() {
  const all = [...document.querySelectorAll(LAYERS)].filter((el) => el.isConnected && visible(el) && !el.classList.contains('out') && !el.classList.contains('away'));
  // later in the document (and higher z-index) wins
  all.sort((a, b) => (+getComputedStyle(a).zIndex || 0) - (+getComputedStyle(b).zIndex || 0));
  return all[all.length - 1] || null;
}

export function focusables(root) {
  return [...root.querySelectorAll('button:not(:disabled), input:not([type=hidden]), select, textarea, [tabindex="0"]')].filter((el) => visible(el) && !el.closest('.hidden'));
}

export function setKbNav(on) { document.body.classList.toggle('kb-nav', on); }

/** Move focus in a direction ('up' | 'down' | 'left' | 'right') inside the top panel. */
export function moveFocus(dir) {
  const root = topLayer();
  if (!root) return false;
  const list = focusables(root);
  if (!list.length) return false;
  const cur = document.activeElement;
  if (!root.contains(cur) || cur === document.body) { list[0].focus({ preventScroll: false }); return true; }
  if (cur instanceof HTMLInputElement && cur.type === 'range' && (dir === 'left' || dir === 'right')) {
    const step = +cur.step || 1;
    cur.value = String(Math.max(+cur.min, Math.min(+cur.max, +cur.value + (dir === 'right' ? step * 5 : -step * 5))));
    cur.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  const r0 = cur.getBoundingClientRect();
  const c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 };
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const dx = c.x - c0.x, dy = c.y - c0.y;
    const main = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
    const side = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    if (main <= 2) continue;
    const score = main + side * 2.2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (!best) { // wrap around in lists
    const i = list.indexOf(cur);
    best = dir === 'down' || dir === 'right' ? list[(i + 1) % list.length] : list[(i - 1 + list.length) % list.length];
  }
  best.focus({ preventScroll: false });
  best.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  return true;
}

/** Press the focused control (or the first one in the top panel). */
export function pressFocused() {
  const root = topLayer();
  if (!root) return false;
  let el = document.activeElement;
  if (!root.contains(el) || el === document.body) el = focusables(root)[0];
  if (!el) return false;
  if (el instanceof HTMLInputElement && el.type === 'checkbox') { el.click(); return true; }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) { el.focus(); return true; }
  el.click();
  return true;
}

export function bindKeyboardMode() {
  window.addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key.startsWith('Arrow')) setKbNav(true); }, true);
  window.addEventListener('pointerdown', () => setKbNav(false), true);
}

/** One set of interface sounds for every control: a soft tick on hover, a click on press, a toggle blip. */
export function bindUiSounds(audio) {
  let lastHover = 0, lastEl = null;
  document.addEventListener('pointerover', (e) => {
    const b = e.target.closest?.('button, .tile, [role=tab]');
    if (!b || b === lastEl || b.disabled) return;
    lastEl = b;
    const now = performance.now();
    if (now - lastHover < 60) return;
    lastHover = now;
    audio.sfx('hover');
  }, true);
  document.addEventListener('pointerout', (e) => { if (e.target === lastEl) lastEl = null; }, true);
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === 'checkbox') { audio.sfx('toggle', { on: t.checked }); return; }
    const b = t.closest?.('button');
    if (b && !b.disabled && b.dataset.sfx !== 'none') audio.sfx('click');
  }, true);
  document.addEventListener('focusin', (e) => { if (document.body.classList.contains('kb-nav') && e.target.closest?.('button, [role=tab], input, select')) audio.sfx('hover'); });
}
