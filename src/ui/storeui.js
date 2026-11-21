// The Store (v1.17.22): cosmetics for real money, laid out with PLACEHOLDER items (src/data/storecatalog.js). It
// reuses Gus's shop look (item cards, the detail panel, rarity colours) so it sits with the rest of the menus.
// Nothing can be bought yet: Buy explains that, and nothing is charged. When purchases arrive they go through the
// platform store and the server (src/standalone/store.js and iap.js on the mobile branch), never granted here.
import { h } from './dom.js';
import { icon } from './icons.js';
import { itemThumb } from './thumbs.js';
import { wearThumb, petThumb, decorThumb, poseThumb } from './shopthumbs.js';
import { ITEMS_BY_ID } from '../data/items.js';
import { TIER_INFO } from '../data/species.js';
import { STORE_TABS, STORE_ITEMS, STORE_BY_ID, bundleWorth, money } from '../data/storecatalog.js';

const TIER_MARK = { common: '●', uncommon: '▲', rare: '◆', epic: '★', legendary: '♛' };
const LOOK_ONLY = { rod: 'A look only: it fishes exactly like the rod you have equipped.', boat: 'A look only: same speed and seats as the boat you have equipped.', more: '' };

function thumb(it, avatar) {
  const a = it.art || {};
  try {
    if (a.pose) return poseThumb(a.pose, avatar);
    if (a.pet) return petThumb(a.pet);
    if (a.decor) return decorThumb(a.decor);
    const base = ITEMS_BY_ID[a.item];
    return base ? itemThumb(base) || wearThumb(base, avatar) : null;
  } catch { return null; }
}
const fallbackIcon = (it) => icon(STORE_TABS.find(([id]) => id === it.kind)?.[2] || 'shop');
const pic = (it, avatar) => { const th = thumb(it, avatar); return th ? h('img', { src: th, alt: '' }) : fallbackIcon(it); };
const save = (b) => { const w = bundleWorth(b); return w > b.price ? Math.round((1 - b.price / w) * 100) : 0; };

/** Draws the Store into a sheet (`S` is the Sheets instance, `c` its current panel). */
export function renderStore(S, c) {
  const g = S.game, av = g.profile.avatar, st = S.state;
  c.title.textContent = 'Store';
  c.tabs.classList.add('tabs-wrap');
  for (const [id, label] of STORE_TABS) S.tab(c, id, label, 'storeTab');
  const tab = st.storeTab || 'featured';
  st.storeTab = tab;

  const buy = (it) => {
    g.audio?.sfx?.('click');
    g.ui.toast(`${it.name}: the Store is a preview for now, so nothing can be bought yet and nothing was charged.`, { title: 'Coming soon', icon: 'shop', ms: 4200 });
  };
  const select = (it) => { st[`storeSel_${tab}`] = it.id; g.audio?.sfx?.('page'); S.render(); };

  c.body.append(h('div.list-row.store-note', icon('sparkles'),
    h('div.grow', h('div.ttl', 'Looks, never power'), h('div.meta', 'Everything here changes how you look, not how you fish. These are placeholder items while the Store is being built.'))));

  const items = tab === 'featured' ? STORE_ITEMS.filter((i) => i.featured && !i.hero) : STORE_ITEMS.filter((i) => i.kind === tab);

  // Featured: one big bundle up top
  if (tab === 'featured') {
    const hero = STORE_ITEMS.find((i) => i.hero);
    if (hero) {
      const off = save(hero);
      c.body.append(h('button.store-hero', { style: { '--c': TIER_INFO[hero.rarity].color }, on: { click: () => { st.storeTab = 'bundle'; st.storeSel_bundle = hero.id; S.swapIn = true; S.render(); } } },
        h('span.sh-pic', pic(hero, av)),
        h('span.sh-main', h('span.sh-kicker', 'Featured bundle'), h('span.sh-name', hero.name), h('span.sh-desc', hero.desc),
          h('span.sh-price', h('b', money(hero.price)), off ? h('s.muted', money(bundleWorth(hero))) : null, off ? h('span.pill', { style: { '--c': '#c8503a' } }, `Save ${off}%`) : null))));
    }
  }

  // the selected item's detail panel
  const key = `storeSel_${tab}`;
  const sel = items.find((i) => i.id === st[key]) || items[0];
  if (sel) {
    st[key] = sel.id;
    const r = sel.rarity, off = sel.kind === 'bundle' ? save(sel) : 0;
    const inside = sel.has ? h('div.store-inside', sel.has.map((id) => STORE_BY_ID[id]).filter(Boolean).map((x) => h('span.store-piece', { style: { '--c': TIER_INFO[x.rarity].color } }, h('span.sp-pic', pic(x, av)), h('span', x.name)))) : null;
    c.body.append(h('div.item-detail', { style: { '--c': TIER_INFO[r].color } },
      h('div.id-pic', pic(sel, av)),
      h('div.id-main',
        h('div.id-name', sel.name),
        h('div.id-tags', h('span.pill', { style: { '--c': TIER_INFO[r].color }, 'data-mark': TIER_MARK[r] }, TIER_INFO[r].name),
          h('span.pill', { style: { '--c': '#2f7f86' } }, sel.kind === 'bundle' ? 'Bundle' : 'Cosmetic'),
          sel.featured ? h('span.pill', { style: { '--c': '#c8503a' } }, 'Featured') : null),
        h('div.id-perk', sel.desc),
        LOOK_ONLY[sel.kind] ? h('div.id-perk.muted', LOOK_ONLY[sel.kind]) : null,
        inside,
        h('div.id-buy',
          off ? h('span.muted', h('s', money(bundleWorth(sel))), ` Save ${off}%`) : null,
          h('span.id-price.store-price', money(sel.price)),
          h('button.btn.gold', { on: { click: () => buy(sel) } }, icon('shop'), 'Buy')))));
  }

  // the grid
  if (!items.length) { c.body.append(h('div.empty', 'Nothing here yet.')); return; }
  c.body.append(h('div.shop-grid', items.map((x) => h(`button.item-card${x.id === sel?.id ? '.sel' : ''}`, { style: { '--c': TIER_INFO[x.rarity].color }, 'aria-pressed': String(x.id === sel?.id), title: x.name, on: { click: () => select(x) } },
    h('span.ic-frame', pic(x, av)),
    h('span.ic-name', x.name),
    h('span.price.store-price', money(x.price)),
    x.kind === 'bundle' ? h('span.ic-flag', save(x) ? `-${save(x)}%` : 'Bundle') : tab !== 'featured' && x.featured ? h('span.ic-flag', 'Featured') : null))));

  c.foot.append(h('span.muted.foot-note', 'Prices are placeholders. Purchases open with the full game.'));
}
