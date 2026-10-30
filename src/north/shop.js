// v1.16.2 Frostmere's shop panel: a vendor's whole stock in one list that stays open while you buy, so you can pick
// up an auger, a flasher and a set of tip-ups in one go. Close it (X, Esc or "Done") when you're finished.
import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

/** opts: { title, sub, text, items: () => [{ id, name, what, price, owned, buy: async () => bool }] } */
export function openShop(game, opts) {
  const g = game;
  document.querySelector('.fm-shop')?.remove();
  const list = h('div.fm-shop-list'), coins = h('span.fm-shop-coins');
  const close = () => { el.remove(); window.removeEventListener('keydown', esc, true); };
  const esc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  const el = h('div.ow-modal.plank.fm-shop', { role: 'dialog', 'aria-label': opts.title },
    h('div.ow-head', h('span.ow-badge', icon('shop')), h('div', h('b', opts.title), h('span', opts.sub || ''))),
    opts.text ? h('p.fm-shop-text', opts.text) : null,
    list,
    h('div.ow-acts', coins, h('button.btn.blue', { on: { click: close } }, 'Done')),
    h('button.btn.close-x.ghost.on-dark', { 'aria-label': 'Close', on: { click: close } }, icon('close')));
  let busy = false;
  const render = () => {
    clear(list);
    coins.textContent = `${(g.profile.coins || 0).toLocaleString()} coins`;
    for (const it of opts.items()) {
      const afford = (g.profile.coins || 0) >= (it.price?.coins || 0);
      list.append(h(`div.fm-shop-row${it.owned ? '.owned' : ''}`,
        h('div.grow', h('div.ttl', it.name), it.what ? h('div.meta', it.what) : null),
        it.owned ? h('span.fm-shop-own', icon('check'), 'Owned')
          : h(`button.btn.small${afford ? '.gold' : ''}`, { disabled: busy || !afford, title: afford ? '' : 'Not enough coins', on: { click: async () => { if (busy) return; busy = true; render(); try { await it.buy(); } finally { busy = false; if (el.isConnected) render(); } } } }, `${(it.price?.coins || 0).toLocaleString()} coins`)));
    }
  };
  render();
  g.ui.root.append(el);
  window.addEventListener('keydown', esc, true);
  return { close, render };
}
