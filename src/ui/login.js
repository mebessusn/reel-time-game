import { randomFact } from '../data/facts.js';
// Splash for a brand-new angler: the logo and one button.
import { h } from './dom.js';
import { logo } from './menus.js';

/** Resolves when the person picks Start fishing. */
export function showSplash(root) {
  return new Promise((resolve) => {
    const start = h('button.btn.primary.large.block', { on: { click: () => { el.remove(); resolve('guest'); } } }, 'Start fishing');
    const el = h('div.splash',
      h('div.card.paper',
        logo('brand.splash-logo'), h('div.splash-tag', 'A cozy lake for the wait.'),
        h('div.stack', start)));
    root.append(el);
  });
}

// Loading screen: the logo, a real progress bar that steps through boot, and fish facts that rotate.
// Fixed sizes everywhere so nothing jumps as the text changes.
export function showLoading(root, text = 'Getting the lake ready') {
  const bar = h('i');
  const step = h('div.ld-step', text);
  const fact = h('div.loading-fact', `Did you know? ${randomFact()}`);
  const el = h('div.loading', { role: 'status', 'aria-live': 'polite' }, h('div', logo('brand.ld-logo'), h('div.ld-bar', bar), step, fact));
  root.append(el);
  const swap = setInterval(() => { fact.classList.add('swap'); setTimeout(() => { fact.textContent = `Did you know? ${randomFact()}`; fact.classList.remove('swap'); }, 400); }, 5000);
  const hide = () => { clearInterval(swap); el.remove(); };
  hide.step = (k, label) => { bar.style.width = `${Math.round(k * 100)}%`; if (label) step.textContent = label; };
  hide.step(0.08);
  return hide;
}
