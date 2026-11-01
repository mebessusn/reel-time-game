// Privacy (v1.13.2): the short version of the privacy notice, in the game, with the full notice's address.
// Opened from the title menu, the pause menu, the Lake rules card, Settings and /privacy in chat. The full notice
// lives on the beta site (beta-site/public/privacy.html); keep the two in step.
import { h } from './dom.js';
import { icon } from './icons.js';
import { menuNav } from './menus.js';

export const PRIVACY_URL = 'https://playreeltime.com/privacy';

export const POINTS = [
  ['lock', 'Your save is private', 'Your progress, catches and settings live in a private save only your Claude account can read. We can’t read it either.'],
  ['users', 'What other anglers see', 'Your angler name, look, level and where you are on the lake, plus your chat messages, mail, friend requests and record catches.'],
  ['sparkles', 'Claude never shares your prompts', 'The Claude Code plugin only tells the game when Claude starts and finishes. It never sends what you asked or what Claude said.'],
  ['pin', 'Real weather is off unless you turn it on', 'If you switch it on, your location is rounded to about 10 km and used only to look up your weather. It isn’t saved.'],
  ['shield', 'Reports', 'Bug and player reports go to this lake’s owner and the admins they pick. Bug reports include game details (version, browser, screen) unless you untick them.'],
  ['home', 'Whose lake this is', 'Each lake is a copy of Reel Time that belongs to the Claude user who shared it with you. They are its admin; the game\u2019s maker can\u2019t see inside it.'],
  ['chat', 'Questions', 'About this lake: ask its owner. About the game itself: email meganbess+reeltime@mail.grokbot.com.'],
];

/** Shows the privacy summary. Resolves when it closes. */
export function showPrivacy(game) {
  return new Promise((resolve) => {
    const root = game.ui.root;
    const done = () => { un(); el.classList.add('out'); setTimeout(() => el.remove(), 150); game.audio?.sfx('click'); resolve(); };
    const url = h('code.privacy-url', PRIVACY_URL);
    const copy = h('button.btn', { on: { click: async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(PRIVACY_URL); ok = true; } catch { /* clipboard blocked */ }
      if (!ok) { const r = document.createRange(); r.selectNodeContents(url); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      copy.lastChild.textContent = ok ? 'Copied' : 'Selected, press Ctrl+C';
    } } }, icon('copy'), h('span', 'Copy link'));
    const open = h('a.btn', { href: PRIVACY_URL, target: '_blank', rel: 'noopener noreferrer' }, icon('link'), h('span', 'Read the full notice'));
    const ok = h('button.btn.primary', { on: { click: done } }, 'Close');
    const card = h('div.menu-card.conduct-card.privacy-card', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Privacy' },
      h('div.conduct-head', h('span.conduct-badge', icon('eye')), h('div', h('h3', 'Privacy'), h('p', 'What Reel Time keeps, and who can see it.'))),
      h('ul.conduct-list', POINTS.map(([ic, t, d]) => h('li', h('span.cr-ic', icon(ic)), h('div.cr-tx', h('b', t), h('span.cr-d', d))))),
      h('p.conduct-foot', 'We never sell your information or show you ads. The full notice: ', url),
      h('div.confirm-btns', copy, open, ok));
    const el = h('div.menu-screen.confirm-screen.conduct-screen', card);
    root.append(el);
    game.audio?.sfx('open');
    const un = menuNav(card, { onBack: done });
    requestAnimationFrame(() => ok.focus({ preventScroll: true }));
  });
}
