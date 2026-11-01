// Lake rules (code of conduct), v1.10. Shown once, the first time someone starts the game; after they agree it
// never shows again (remembered on this device and in their save). /rules in chat opens it again to read.
import { h } from './dom.js';
import { icon } from './icons.js';
import { menuNav } from './menus.js';

const KEY = 'rt_conduct_v1';

export const RULES = [
  ['heart', 'Be kind', 'No harassment, bullying, threats or hate, in chat or anywhere else on the lake.'],
  ['chat', 'Keep chat friendly', 'Reel Time is for everyone. No sexual content, slurs or spam.'],
  ['shield', 'Play fair', 'No cheats, exploits, bots or modified game files. Found a bug? Report it instead of farming it.'],
  ['eye', 'Respect privacy', "Don't share anyone's personal details, and keep your own to yourself too."],
  ['user', 'Keep names and looks friendly', 'Your angler name and outfit should be fine for all ages.'],
  ['gavel', 'Rules are enforced', "The lake's admins can mute, suspend or ban anglers who break them."],
];

export function conductAccepted(game) {
  try { if (localStorage.getItem(KEY)) return true; } catch { /* storage blocked */ }
  return !!game?.ext?.d?.conductAt;
}

/** Shows the rules. With `firstTime`, the only way out is "I agree", which is remembered. */
export function showConduct(game, { firstTime = false } = {}) {
  return new Promise((resolve) => {
    const root = game.ui.root;
    const done = () => {
      if (firstTime) {
        try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
        game.ext?.change?.((d) => { d.conductAt = Date.now(); });
      }
      un(); el.classList.add('out'); setTimeout(() => el.remove(), 150);
      game.audio?.sfx('click');
      resolve(true);
    };
    const ok = h('button.btn.primary', { on: { click: done } }, firstTime ? 'I agree, let me fish' : 'Close');
    const card = h('div.menu-card.conduct-card', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Lake rules' },
      h('div.conduct-head', h('span.conduct-badge', icon('rules')), h('div', h('h3', 'Lake rules'), h('p', firstTime ? 'Before you cast your first line, here is how we keep the lake cozy for everyone.' : 'How we keep the lake cozy for everyone.'))),
      h('ul.conduct-list', RULES.map(([ic, t, d]) => h('li', h('span.cr-ic', icon(ic)), h('div.cr-tx', h('b', t), h('span.cr-d', d))))),
      h('p.conduct-foot', 'Someone breaking the rules? Click their name in chat to mute or report them. ',
        h('button.link-btn', { type: 'button', on: { click: () => import('./privacy.js').then((m) => m.showPrivacy(game)) } }, 'How we handle your data')),
      h('div.confirm-btns', ok));
    const el = h('div.menu-screen.confirm-screen.conduct-screen', card);
    root.append(el);
    game.audio?.sfx('open');
    const un = menuNav(card, { onBack: () => { if (!firstTime) done(); } });
    requestAnimationFrame(() => ok.focus({ preventScroll: true }));
  });
}
