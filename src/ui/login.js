import { randomFact } from '../data/facts.js';
// Splash + sign in: GitHub, email magic link, or play as guest.
import { h } from './dom.js';
import { logo } from './menus.js';

const GH = '<svg class="gh" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

/**
 * opts: { cloud: boolean, onGitHub(), onEmail(email) -> Promise<string msg>, onGuest() }
 * Resolves when the person picks guest (or the page navigates away for OAuth).
 */
export function showSplash(root, opts) {
  return new Promise((resolve) => {
    const status = h('div.fine');
    const email = h('input', { type: 'email', placeholder: 'you@example.com', autocomplete: 'email' });
    const gh = h('button.btn.blue.block', { on: { click: async () => { status.textContent = 'Opening GitHub…'; try { await opts.onGitHub(); } catch (e) { status.textContent = e.message || 'GitHub sign-in failed.'; } } } });
    gh.innerHTML = `${GH}Sign in with GitHub`;
    const emailBtn = h('button.btn.block', { on: { click: async () => {
      if (!/.+@.+\..+/.test(email.value)) { status.textContent = 'Enter an email address first.'; return; }
      emailBtn.disabled = true;
      try { status.textContent = await opts.onEmail(email.value.trim()); } catch (e) { status.textContent = e.message || 'Could not send the link.'; }
      emailBtn.disabled = false;
    } } }, 'Email me a sign-in link');
    const guest = h('button.btn.primary.large.block', { on: { click: () => { el.remove(); resolve('guest'); } } }, opts.cloud ? 'Play as guest' : 'Start fishing');
    const el = h('div.splash',
      h('div.card.paper',
        logo('brand.splash-logo'), h('div.splash-tag', 'A cozy lake for the wait.'),
        h('div.stack',
          opts.cloud ? [gh, h('div.or', 'or'), email, emailBtn, h('div.or', 'or')] : null,
          guest),
        status,
        h('div.fine', opts.cloud
          ? 'Signing in keeps your progress across devices and puts you on the shared lake with everyone else.'
          : 'Online play is not configured for this build, so progress saves on this device.')));
    root.append(el);
    if (opts.message) status.textContent = opts.message;
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
