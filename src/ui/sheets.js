// Bottom sheets: Creel, Fishpedia, Shop, Leaderboard, Journal (achievements), Settings.
import { openFishViewer } from './viewer.js';
import { SHOVEL_PRICE } from '../game/treasure.js';
import { h, clear, fmt, lb, ago } from './dom.js';
import { icon, iconURL } from './icons.js';
import { fishThumb, itemThumb, avatarThumb } from './thumbs.js';
import { baitThumb, upgradeThumb, gearThumb, decorThumb, petThumb, wearThumb, emoteThumb } from './shopthumbs.js';
// v1.12: every shop item gets a picture
const anyThumb = (it, av) => itemThumb(it) || (it.kind === 'emote' ? emoteThumb(it, av) : wearThumb(it, av));
import { SPECIES, SPECIES_BY_ID, TIER_INFO, ZONES, TIERS, BOTTLE_MESSAGES, PEDIA_SLOTS } from '../data/species.js';
import { ITEMS, ITEMS_BY_ID, PERK_TEXT, featuredItems } from '../data/items.js';
import { ACHIEVEMENTS, ACH_TIER_COLOR } from '../data/achievements.js';
import { catchValue, canTrade, tradePearls, creelMax, STORAGE_MAX, achievementProgress, countSlots, BOAT_LEVEL } from '../game/rules.js';
import { BAITS, UPGRADES, MAX_UPGRADE, ROD_LB, lineRating } from '../data/bait.js';
import { GEAR, PER_LAKE, OWN_MAX, gearCount, gearEnds } from '../game/awaygear.js';
import { DECOR } from '../game/home.js';
import { STORY, STORY2, WEEKLY_PEARLS, DAILY_BONUS, weekEnds } from '../game/quests.js';
import { FLAG_LAKES } from '../game/lakeflag.js';
import { PARTY_MAX } from '../game/party.js';
import { SPOTS, LAKE_NAMES, LAKE_LEVELS, LAKE_ORDER, lakeRange, nextUnlock, LEVEL_REWARDS } from '../game/spots.js';
import { drawFlag, COUNTRY_BY_CODE } from '../data/flags.js';
import { SETS } from '../game/collections.js';
import { COMMUNITY_GOAL } from '../game/community.js';
import { nextDerby } from '../game/derby.js';
import { WAYSTONES } from '../game/waystones.js';
import { ACTIONS, keyName } from '../game/controls.js';
import { BOTTLE_MAX } from '../game/bottles.js';
import { regionName } from '../world/terrain.js';
import { PETS } from '../game/pet.js';
import { openCatchCard } from './catchcard.js';
import { fishOfWeek } from '../game/social.js';
import { dayIndex } from '../core/clock.js';
import { SEASONS } from '../data/seasons.js';
import { FISH_LORE, VARIANT_LORE } from '../data/fishlore.js';
import { FUN_FACTS, EXTRA_LORE } from '../data/funfacts.js';
import { renderMapView } from './mapview.js';
import { album, photoButtons } from './selfie.js';

const priceEl = (price) => price ? h('span.price', h('img', { src: iconURL(price.coins ? 'coin' : 'pearl') }), fmt(price.coins || price.pearls)) : null;
// Shop rarity frame, from how the item is earned and what it costs.
const itemRarity = (it) => it.source === 'achievement' ? 'epic' : !it.price ? 'common' : it.price.pearls ? (it.price.pearls > 70 ? 'legendary' : it.price.pearls > 30 ? 'epic' : 'rare') : it.price.coins >= 1000 ? 'rare' : it.price.coins >= 300 ? 'uncommon' : 'common';
const perkText = (item) => {
  const perks = item.perk ? Object.entries(item.perk).map(([k, v]) => PERK_TEXT[k]?.(v) || k) : [];
  if (item.kind === 'rod' && ROD_LB[item.id]) perks.unshift(`Lands fish up to ${ROD_LB[item.id]} lb`);
  return perks.length ? perks.join(', ') : 'Cosmetic';
};
const SHEET_ICON = { social: 'users', admin: 'shield', settings: 'gear', creel: 'backpack', tackle: 'package', fishpedia: 'book', shop: 'shop', board: 'scroll', journal: 'star', map: 'map', legends: 'trophy', album: 'camera', bikes: 'bike' };
const TIME_LABEL = { any: 'Any time', dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' };
// Colour-blind markers: a shape per tier, shown next to the colour when the setting is on.
export const TIER_MARK = { common: '●', uncommon: '▲', rare: '◆', epic: '★', legendary: '♛', mythic: '✦' };
const tierPill = (tier) => h('span.pill', { style: { '--c': TIER_INFO[tier].color }, 'data-mark': TIER_MARK[tier] }, TIER_INFO[tier].name);

export class Sheets {
  constructor(ui, game) {
    this.ui = ui; this.game = game;
    this.current = null;
    this.state = { creelTab: 'creel', shopTab: 'rod', board: 'requests', lb: 'lakes', period: 'week', pediaSel: null, pediaTab: 'fish', tackleTab: 'rod', creelSort: 'rarity', creelFilter: 'all', mapTab: 'map' };
  }

  close(instant = false) {
    if (!this.current) return;
    const { el, scrim } = this.current;
    this.current = null;
    this.game.ui?.focusReturn?.();
    if (instant || document.body.classList.contains('reduced')) { el.remove(); scrim.remove(); return; }
    el.classList.add('out'); scrim.classList.add('out');
    setTimeout(() => { el.remove(); scrim.remove(); }, 140);
  }

  open(name) {
    if (this.current?.name === name) { this.close(); return; }
    const had = !!this.current;
    this.close(true);
    this.game.audio?.sfx(had ? 'page' : 'open');
    const body = h('div.sheet-body');
    const tabs = h('div.tabs', { role: 'tablist' });
    const title = h('h2', { id: `sheet-${name}` });
    const foot = h('div.sheet-foot');
    const head = h('div.sheet-head', h('span.sheet-ic', icon(SHEET_ICON[name] || 'book')), title,
      h('button.btn.close-x', { 'aria-label': 'Close', on: { click: () => { this.game.audio.sfx('close'); this.close(); } } }, icon('close')));
    const el = h(`div.sheet.plank${name === 'settings' ? '.sheet-full' : name === 'map' ? '.sheet-full.sheet-map' : name === 'fishpedia' ? '.sheet-wide' : ''}`, { role: 'dialog', 'aria-labelledby': `sheet-${name}` }, head, tabs, body, foot);
    if (name === 'settings') { this.settingsSnap = JSON.parse(JSON.stringify(this.game.profile.settings)); }
    const scrim = h(`div.scrim${name === 'settings' || name === 'map' ? '.scrim-top' : ''}`, { on: { click: () => this.close() } });
    this.ui.root.append(scrim, el);
    this.current = { name, el, scrim, body, tabs, title, foot };
    this.render();
    this.game.ui?.focusFirst?.(el);
  }

  refresh() { if (this.current) this.render(); }

  render() {
    const c = this.current;
    clear(c.body); clear(c.tabs); clear(c.foot);
    const fn = this[`render_${c.name}`];
    if (fn) fn.call(this, c);
    if (this.swapIn) { this.swapIn = false; c.body.classList.remove('tab-in'); void c.body.offsetWidth; c.body.classList.add('tab-in'); c.body.scrollTop = 0; }
  }

  tab(c, id, label, key) {
    const on = this.state[key] === id;
    c.tabs.append(h(`button.tab${on ? '.on' : ''}`, { role: 'tab', 'aria-selected': String(on), on: { click: () => { this.state[key] = id; this.game.audio.sfx('page'); this.swapIn = true; this.render(); } } }, label));
  }

  // ---------------- Photo album ----------------
  render_album(c) {
    c.title.textContent = 'Photo Album';
    const photos = album.list().slice().reverse();
    c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, `Selfies live in this browser (up to 12). Save the ones you love. Press P or the camera button to take one.`));
    if (!photos.length) { c.body.append(h('div.empty', 'No photos yet. Catch something and strike a pose!')); return; }
    const grid = h('div.album-grid');
    for (const ph of photos) {
      grid.append(h('figure.album-item',
        h('img', { src: ph.url, alt: ph.caption, title: ph.caption, on: { click: () => this.ui.root.append(this.photoView(ph)) } }),
        h('div.album-btns',
          ...photoButtons(ph, this.game),
          h('button.btn.ghost.small', { on: { click: () => { album.remove(ph.id); this.render(); } } }, 'Delete'))));
    }
    c.body.append(grid);
  }

  photoView(ph) {
    const el = h('div.polaroid-card', { on: { click: (e) => { if (e.target === el) el.remove(); } } },
      h('img.polaroid', { src: ph.url, alt: ph.caption }),
      h('div.polaroid-actions',
        ...photoButtons(ph, this.game, { big: true }),
        h('button.btn', { on: { click: () => el.remove() } }, 'Close')));
    return el;
  }

  // ---------------- World map ----------------
  render_map(c) {
    c.title.textContent = 'Five Lakes Valley';
    this.tab(c, 'map', 'Map', 'mapTab');
    // v1.9.9: no fast travel from the map itself: the stones only work while you stand at one
    const atStone = this.game.waystones.near(3.5);
    if (atStone) this.tab(c, 'travel', 'Waystone travel', 'mapTab');
    else if (this.state.mapTab === 'travel') this.state.mapTab = 'map';
    if (this.state.mapTab === 'travel') {
      const lit = this.game.waystones.lit;
      c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, `You're at the ${atStone?.name || ''} waystone. Lit stones carry you to each other in a blink; light more by walking past them.`));
      c.body.append(h('div.row-list', WAYSTONES.map((w) => h('div.list-row', icon('map'),
        h('div.grow', h('div.ttl', w.name), h('div.meta', lit.has(w.id) ? 'Lit' : 'Not found yet')),
        lit.has(w.id) ? h('button.btn.blue.small', { on: { click: () => this.confirmTravel(w) } }, 'Travel') : h('button.btn.small', { disabled: true }, 'Unlit')))));
      return;
    }
    renderMapView(c.body, this.game, this);
  }

  // v1.8.2: picking a place travels straight there (no confirmation): the map closes and you arrive
  confirmTravel(w) {
    if (!this.game.waystones.near(3.5)) { this.game.ui.toast('Waystones only carry you from one stone to another. Walk, row or ride to a waystone first.'); return; }
    this.close();
    this.game.waystones.travel(w.id);
  }


  // ---------------- Lake Legends (trophy board) ----------------
  render_legends(c) {
    c.title.textContent = 'Lake Legends';
    const list = this.game.trophies?.list || [];
    c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, 'The three best fish anyone has pulled from Cozy Cove. Rarer beats bigger: Diamond and Gold variants count extra, and weight breaks ties.'));
    const medals = [['#f2c040', '1st'], ['#c8ccd8', '2nd'], ['#c87a40', '3rd']];
    for (let i = 0; i < 3; i++) {
      const t = list[i];
      const [col, place] = medals[i];
      if (!t) { c.body.append(h('div.legend.paper.empty', h('span.legend-medal', { style: { '--c': col } }, place), h('div.grow', h('div.ttl', 'An empty hook'), h('div.meta', 'Waiting for a legend. Catch something rare and it might hang here.')))); continue; }
      const sp = SPECIES_BY_ID[t.speciesId];
      const tier = TIER_INFO[sp.tier];
      const v = t.variant === 'diamond' ? 'Diamond ' : t.variant === 'gold' ? 'Gold ' : '';
      const when = new Date(t.ts);
      const pic = h(`button.legend-pic${t.variant !== 'normal' ? `.${t.variant}` : ''}`, { title: 'Look closer', on: { click: () => openFishViewer(this.ui.root, { speciesId: t.speciesId, variant: t.variant, weight: t.weight, sub: `Caught by ${t.name}` }) } }, h('img', { src: fishThumb(t.speciesId, t.variant) }));
      c.body.append(h('div.legend.paper',
        h('span.legend-medal', { style: { '--c': col } }, place),
        pic,
        h('div.grow',
          h('div.ttl', `${v}${sp.name}`),
          h('div.legend-tags', h('span.pill', { style: { '--c': t.variant === 'diamond' ? '#3ab0d0' : t.variant === 'gold' ? '#d89a20' : tier.color } }, v ? `${v}${tier.name}` : tier.name), h('span', lb(t.weight)), t.zone && ZONES[t.zone] ? h('span', ZONES[t.zone].name) : null),
          h('div.legend-desc', FISH_LORE[t.speciesId] || '', t.variant !== 'normal' ? ` ${VARIANT_LORE[t.variant]}` : ''),
          h('div.meta', 'Caught by ', h('b', t.name), ` · ${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} (${ago(t.ts)})`))));
    }
  }

  // ---------------- Inventory (v1.10: the creel became a backpack grid) ----------------
  // Fish fill the backpack's slots (its size is your creel limit); cooked food, the treasure map and tools ride
  // along in their own pockets at the front. Hover a slot for what it is and what it's worth; click it for actions.
  invItems(where) {
    const g = this.game, p = g.profile, d = g.ext.d, out = [];
    if (where === 'creel') {
      const m = g.treasure?.map;
      if (m) out.push({ key: 'map', kind: 'map', name: 'Treasure map', desc: `A soggy sketch of a spot near ${m.place}. Find the X and dig with a shovel.`, value: 'Priceless', art: 'map' });
      if (d.tools?.shovel) out.push({ key: 'shovel', kind: 'tool', name: 'Shovel', desc: 'For digging up buried treasure. Stand on the X and press E.', value: 'Tool', art: 'shovel' });
      // v1.12.1: traps you own but haven't set live in the backpack; place them from here (no more pop-up prompt)
      for (const id of Object.keys(GEAR)) {
        const n = g.gear.owned(id) - g.gear.inUse(id);
        if (n > 0) out.push({ key: `gear-${id}`, kind: 'gear', gk: id, n, name: `${GEAR[id].name}${n > 1 ? ` ×${n}` : ''}`, desc: `${GEAR[id].desc} Face open water from the shore or your boat, then place it.`, value: 'Gear' });
      }
      (d.snacks || []).forEach((sn, i) => { const sp = SPECIES_BY_ID[sn.sp]; out.push({ key: `snack${i}`, kind: 'snack', i, sp: sn.sp, name: `Roasted ${sp?.name || 'fish'}`, desc: `Cooked over a campfire. Eat it for Well Fed: ${sp?.name || 'that fish'} bite far more often for a while.`, value: 'Food', art: 'snack' }); });
    }
    for (const x of p[where]) out.push({ key: x.id, kind: 'fish', c: x });
    return out;
  }

  render_creel(c) {
    const g = this.game, p = g.profile, d = g.ext.d;
    c.title.textContent = 'Inventory';
    this.tab(c, 'creel', `Backpack ${p.creel.length}/${creelMax(p)}`, 'creelTab');
    this.tab(c, 'storage', `Storage ${p.storage.length}/${STORAGE_MAX}`, 'creelTab');
    const where = this.state.creelTab;
    const list = p[where];
    const locked = new Set(d.locked);
    const sellable = list.filter((x) => !locked.has(x.id));
    const total = sellable.reduce((a, x) => a + catchValue(x.speciesId, x.variant, x.weight), 0);
    const commons = sellable.filter((x) => x.variant === 'normal' && ['common', 'uncommon'].includes(SPECIES_BY_ID[x.speciesId].tier) && !g.traits.of(x) && !g.traits.name(x));
    const sel = (key, opts) => h('select.mini', { on: { change: (e) => { this.state[key] = e.target.value; this.render(); } } }, opts.map(([v, t]) => h('option', { value: v, selected: this.state[key] === v }, t)));
    c.body.append(h('div.creel-tools',
      h('button.btn.gold.small', { disabled: !sellable.length, on: { click: () => this.act(() => g.sell(sellable.map((x) => x.id))) } }, `Sell all unlocked (${fmt(total)}c)`),
      commons.length ? h('button.btn.small', { title: 'Plain common and uncommon fish (keeps locked, named and one-of-a-kind fish)', on: { click: () => this.act(() => g.sell(commons.map((x) => x.id))) } }, `Sell commons (${commons.length})`) : null,
      h('span.grow'),
      sel('creelSort', [['rarity', 'Sort: rarity'], ['weight', 'Sort: weight'], ['value', 'Sort: value'], ['newest', 'Sort: newest'], ['name', 'Sort: A–Z']]),
      sel('creelFilter', [['all', 'Everything'], ['locked', 'Locked'], ['unique', 'One of a kind'], ['variant', 'Gold & diamond'], ...TIERS.map((t) => [t, TIER_INFO[t].name])])));
    const f = this.state.creelFilter;
    const sorters = {
      rarity: (a, b) => TIERS.indexOf(SPECIES_BY_ID[b.speciesId].tier) - TIERS.indexOf(SPECIES_BY_ID[a.speciesId].tier) || (b.variant !== 'normal') - (a.variant !== 'normal'),
      weight: (a, b) => b.weight - a.weight,
      value: (a, b) => catchValue(b.speciesId, b.variant, b.weight) - catchValue(a.speciesId, a.variant, a.weight),
      newest: (a, b) => (b.ts || 0) - (a.ts || 0),
      name: (a, b) => SPECIES_BY_ID[a.speciesId].name.localeCompare(SPECIES_BY_ID[b.speciesId].name),
    };
    const fishOk = (x) => f === 'all' || (f === 'locked' ? locked.has(x.id) : f === 'unique' ? !!(g.traits.of(x) || g.traits.name(x)) : f === 'variant' ? x.variant !== 'normal' : SPECIES_BY_ID[x.speciesId].tier === f);
    const all = this.invItems(where);
    const items = all.filter((it) => it.kind !== 'fish' && f === 'all');
    const fish = all.filter((it) => it.kind === 'fish' && fishOk(it.c)).sort((a, b) => (sorters[this.state.creelSort] || sorters.rarity)(a.c, b.c));
    const cap = where === 'creel' ? creelMax(p) : STORAGE_MAX;
    const empty = f === 'all' ? Math.max(0, cap - list.length) : 0;
    if (!all.length) c.body.append(h('div.empty', where === 'creel' ? 'Your backpack is empty. Go catch something!' : 'Nothing in storage yet.'));
    else if (!items.length && !fish.length) c.body.append(h('div.empty', 'Nothing matches that filter.'));

    // the hover card (one, moved between slots)
    const tip = h('div.inv-tip', { role: 'tooltip', hidden: true });
    const showTip = (el, it) => {
      clear(tip);
      if (it.kind === 'fish') {
        const x = it.c, sp = SPECIES_BY_ID[x.speciesId];
        tip.append(h('div.it-name', g.traits.label(x)), h('div.it-sub', tierPill(sp.tier), ` ${lb(x.weight)} · ${ZONES[x.zone]?.name || ''}`),
          h('p', FISH_LORE[sp.id] || sp.desc || ''), h('div.it-val', icon('coin'), `${fmt(catchValue(x.speciesId, x.variant, x.weight))} coins`, canTrade(x) ? h('span', ' · ', icon('pearl'), `${tradePearls(x.speciesId, x.variant)} pearls`) : null, locked.has(x.id) ? h('span.it-lock', icon('lock'), 'Locked') : null));
      } else tip.append(h('div.it-name', it.name), h('p', it.desc), h('div.it-val', it.value));
      tip.hidden = false;
      const r = el.getBoundingClientRect(), host = c.body.getBoundingClientRect();
      const left = Math.min(Math.max(4, r.left - host.left + r.width / 2 - 130), host.width - 272);
      tip.style.left = `${left}px`;
      tip.style.top = `${r.bottom - host.top + c.body.scrollTop + 6}px`;
    };
    const hideTip = () => { tip.hidden = true; };
    const pick = (it) => { this.state.invSel = this.state.invSel === it.key ? null : it.key; g.audio?.sfx('click'); this.render(); };
    const slot = (it) => {
      const on = this.state.invSel === it.key;
      let art, cls = '';
      if (it.kind === 'fish') {
        const x = it.c, filt = g.traits.filter(x);
        cls = `.t-${SPECIES_BY_ID[x.speciesId].tier}${x.variant !== 'normal' ? `.v-${x.variant}` : ''}${locked.has(x.id) ? '.locked' : ''}`;
        art = [h('img', { src: fishThumb(x.speciesId, x.variant), alt: '', style: filt ? { filter: filt } : {} }), h('span.slot-w', lb(x.weight)), locked.has(x.id) ? h('span.slot-lock', icon('lock')) : null];
      } else if (it.kind === 'snack') { cls = '.k-snack'; art = [h('img.cooked', { src: fishThumb(it.sp, 'normal'), alt: '' }), h('span.slot-badge', icon('flame'))]; }
      else if (it.kind === 'gear') { cls = '.k-gear'; art = [h('img', { src: gearThumb(it.gk), alt: '' }), it.n > 1 ? h('span.slot-w', `×${it.n}`) : null]; }
      else { cls = `.k-${it.kind}`; art = [h('span.slot-ico', icon(it.art))]; }
      return h(`button.inv-slot${cls}${on ? '.sel' : ''}`, { 'aria-label': it.kind === 'fish' ? g.traits.label(it.c) : it.name, 'aria-pressed': String(on),
        on: { click: () => pick(it), mouseenter: (e) => showTip(e.currentTarget, it), mouseleave: hideTip, focus: (e) => showTip(e.currentTarget, it), blur: hideTip } }, art);
    };
    if (all.length) {
      c.body.append(h('div.inv-wrap', h('div.inv-grid', items.map(slot), fish.map(slot), Array.from({ length: Math.min(empty, 60) }, () => h('div.inv-slot.empty', { 'aria-hidden': 'true' }))), tip));
    }
    // the picked slot's actions
    const it = all.find((x) => x.key === this.state.invSel);
    if (!it) { if (all.length) c.body.append(h('div.inv-hint.muted', 'Hover a slot to see what it is. Click it to sell, store, name, lock or use it.')); return; }
    if (it.kind === 'snack') {
      c.body.append(h('div.list-row.inv-detail', h('img.cooked', { src: fishThumb(it.sp, 'normal'), alt: '' }), h('div.grow', h('div.ttl', it.name), h('div.meta', it.desc)),
        h('div.row-btns', h('button.btn.green.small', { on: { click: () => { this.state.invSel = null; g.cookout.eatSnack(it.i); this.render(); } } }, icon('flame'), 'Eat it'))));
      return;
    }
    if (it.kind === 'map') {
      c.body.append(h('div.list-row.inv-detail', h('span.slot-ico', icon('map')), h('div.grow', h('div.ttl', it.name), h('div.meta', it.desc)),
        h('div.row-btns', h('button.btn.gold.small', { on: { click: () => g.treasure.open() } }, 'Read the map'), h('button.btn.ghost.small', { on: { click: () => { g.treasure.mark(); g.ui.toast('The X is on your map (M) and your waypoint points to it.', { icon: 'pin' }); } } }, icon('pin'), 'Mark it'))));
      return;
    }
    if (it.kind === 'gear') {
      const ahead = !!g.gear.spotAhead();
      c.body.append(h('div.list-row.inv-detail', h('img.row-thumb', { src: gearThumb(it.gk), alt: '' }), h('div.grow', h('div.ttl', it.name), h('div.meta', ahead ? 'Open water is right in front of you.' : 'Face open water (on the shore or in your boat) to place it.')),
        h('div.row-btns', h('button.btn.blue.small', { disabled: !ahead, on: { click: () => { this.state.invSel = null; this.close(); g.gear.place(it.gk); } } }, icon('anchor'), 'Place it'))));
      return;
    }
    if (it.kind === 'tool') { c.body.append(h('div.list-row.inv-detail', h('span.slot-ico', icon(it.art)), h('div.grow', h('div.ttl', it.name), h('div.meta', it.desc)))); return; }
    const x = it.c, sp = SPECIES_BY_ID[x.speciesId], isLocked = locked.has(x.id), filt = g.traits.filter(x);
    const lockBtn = h(`button.btn.ghost.small.lock-btn${isLocked ? '.on' : ''}`, { title: isLocked ? 'Unlock' : 'Lock (never sold by Sell all)', 'aria-pressed': String(isLocked), on: { click: () => { g.ext.change((dd) => { dd.locked = isLocked ? dd.locked.filter((id) => id !== x.id) : [...dd.locked, x.id]; }); this.render(); } } }, icon(isLocked ? 'lock' : 'unlock'), isLocked ? 'Locked' : 'Lock');
    const rename = h('button.btn.ghost.small', { title: 'Give it a name', on: { click: () => {
      const inp = h('input.name-fish', { value: g.traits.name(x), maxLength: 20, placeholder: 'Name', on: { change: (e) => { g.traits.setName(x, e.target.value); this.render(); }, blur: () => this.render() } });
      rename.replaceWith(inp); inp.focus();
    } } }, 'Name');
    const after = (fn) => () => this.act(async () => { await fn(); this.state.invSel = null; });
    c.body.append(h(`div.list-row.inv-detail${isLocked ? '.locked-row' : ''}`,
      h('img.zoomable', { src: fishThumb(x.speciesId, x.variant), style: filt ? { filter: filt } : {}, title: 'Look closer', on: { click: () => this.view(x.speciesId, x.variant, x.weight, ZONES[x.zone]?.name) } }),
      h('div.grow', h('div.ttl', g.traits.label(x)), h('div.meta', tierPill(sp.tier), ` ${lb(x.weight)} · ${ZONES[x.zone]?.name || ''}`)),
      h('div.row-btns',
        lockBtn,
        h('button.btn.gold.small', { disabled: isLocked, on: { click: after(() => g.sell([x.id])) } }, `Sell ${fmt(catchValue(x.speciesId, x.variant, x.weight))}c`),
        canTrade(x) ? h('button.btn.blue.small', { disabled: isLocked, on: { click: after(() => g.trade(x.id)) } }, `${tradePearls(x.speciesId, x.variant)} pearls`) : null,
        h('button.btn.ghost.small', { on: { click: after(() => g.moveCatch(x.id, where === 'creel' ? 'storage' : 'creel')) } }, where === 'creel' ? 'Store' : 'To backpack'),
        rename,
        h('button.btn.ghost.small', { title: 'Shareable catch card', on: { click: () => openCatchCard(g, x) } }, 'Card'),
        h('button.btn.ghost.small', { disabled: isLocked, on: { click: after(() => g.release(x.id)) } }, 'Release'))));
  }

  view(speciesId, variant, weight, sub) { openFishViewer(this.game.ui.root, { speciesId, variant, weight, sub }); }

  async act(fn) {
    await fn();
    this.render();
  }

  // ---------------- Fishpedia ----------------
  render_fishpedia(c) {
    const p = this.game.profile;
    c.title.textContent = 'Fishpedia';
    this.tab(c, 'fish', 'Fish', 'pediaTab');
    this.tab(c, 'sets', `Collections${this.game.collections.claimable().length ? ' !' : ''}`, 'pediaTab');
    if (this.state.pediaTab === 'sets') { this.renderSets(c); return; }
    const slots = countSlots(p);
    const sel = this.state.pediaSel && SPECIES_BY_ID[this.state.pediaSel];
    const have = Object.keys(p.fishpedia).length, pct = Math.round((slots / PEDIA_SLOTS) * 100);
    c.body.append(h('div.pedia-head',
      h('div.pedia-ring', { style: { '--p': `${pct}%` } }, h('span.num', `${pct}%`)),
      h('div.grow', h('div.pedia-big', `${have} of ${SPECIES.length} species`), h('div.muted', `${slots} of ${PEDIA_SLOTS} entries, counting gold and diamond variants`), h('div.progress', h('i', { style: { width: `${(have / SPECIES.length) * 100}%` } })))));
    // filters: where, when, season
    const f = this.state.pediaFilter || { zone: 'all', time: 'all', season: 'all', show: 'all' };
    this.state.pediaFilter = f;
    const fsel = (key, label, opts) => h('select.mini', { 'aria-label': label, on: { change: (e) => { f[key] = e.target.value; this.render(); } } }, opts.map(([v, t]) => h('option', { value: v, selected: f[key] === v }, t)));
    const season = this.game.living?.season;
    const view = this.state.pediaView || 'book';
    c.body.append(h('div.chip-filter.pedia-views', [['book', 'Book', 'book'], ['contents', 'Contents', 'menu']].map(([v, t, ic]) => h(`button${view === v ? '.on' : ''}`, { on: { click: () => { this.state.pediaView = v; this.render(); } } }, icon(ic), t))));
    if (view === 'contents') c.body.append(h('div.shop-tools',
      h('div.chip-filter', [['all', 'All'], ['caught', 'Caught'], ['missing', 'Still to find']].map(([v, t]) => h(`button${f.show === v ? '.on' : ''}`, { on: { click: () => { f.show = v; this.render(); } } }, t))),
      fsel('zone', 'Where', [['all', 'Anywhere'], ...Object.entries(ZONES).map(([id, z]) => [id, z.name])]),
      fsel('time', 'When', [['all', 'Any time'], ['dawn', 'Dawn'], ['day', 'Day'], ['dusk', 'Dusk'], ['night', 'Night']]),
      fsel('season', 'Season', [['all', 'Any season'], ...Object.entries(SEASONS).map(([id, x]) => [id, `${x.name}${id === season ? ' (now)' : ''}`])])));
    const shown = SPECIES.filter((sp) => {
      const e = p.fishpedia[sp.id];
      if (f.show === 'caught' && !e) return false;
      if (f.show === 'missing' && e) return false;
      if (f.zone !== 'all' && !sp.zones.includes(f.zone)) return false;
      if (f.time !== 'all' && !sp.times.includes('any') && !sp.times.includes(f.time)) return false;
      if (f.season !== 'all' && !SEASONS[f.season].fish.includes(sp.id)) return false;
      return true;
    });
    if (!shown.length) { if (view !== 'contents') { this.state.pediaView = 'contents'; this.render(); return; } c.body.append(h('div.empty', 'No fish match those filters.')); return; }
    // v1.10: the Fishpedia is a book. Contents is the grid (with the filters); every species has its own two-page spread.
    if (view === 'contents') {
      c.body.append(h('div.grid', shown.map((sp) => {
        const e = p.fishpedia[sp.id];
        const t = TIER_INFO[sp.tier];
        return h(`button.tile${e ? '' : '.locked'}${this.state.pediaSel === sp.id ? '.sel' : ''}`, { 'aria-label': e ? sp.name : 'Not caught yet', on: { click: () => { this.state.pediaSel = sp.id; this.state.pediaView = 'book'; this.state.pediaTurn = 'next'; this.game.audio.sfx('page'); this.render(); } } },
          h('i.tier', { style: { background: t.color }, 'data-mark': TIER_MARK[sp.tier] }),
          h('img', { src: fishThumb(sp.id, e?.diamond ? 'diamond' : e?.gold ? 'gold' : 'normal') }),
          h('div.nm', e ? sp.name : '???'),
          h('div.vdots', h(`i.n${e?.normal ? '.on' : ''}`), h(`i.g${e?.gold ? '.on' : ''}`), h(`i.d${e?.diamond ? '.on' : ''}`)));
      })));
      return;
    }
    let at = shown.findIndex((x) => x.id === this.state.pediaSel);
    if (at < 0) { at = 0; this.state.pediaSel = shown[0].id; }
    const sp = shown[at], e = p.fishpedia[sp.id], t = TIER_INFO[sp.tier];
    const go = (d) => { const n = (at + d + shown.length) % shown.length; this.state.pediaSel = shown[n].id; this.state.pediaTurn = d > 0 ? 'next' : 'prev'; this.game.audio.sfx('page'); this.render(); };
    const best = e?.diamond ? 'diamond' : e?.gold ? 'gold' : 'normal';
    const facts = FUN_FACTS[sp.id] || [];
    const lore = FISH_LORE[sp.id] || EXTRA_LORE[sp.id] || '';
    const seasons = Object.entries(SEASONS).filter(([, x]) => x.fish.includes(sp.id)).map(([, x]) => x.name);
    const when = sp.times.map((x) => TIME_LABEL[x]).join(', ') + (sp.weather ? ` (${sp.weather.join(' or ')} only)` : '') + (sp.moonBoost ? ' · loves a full moon' : '') + (sp.bloodMoon ? ' · Blood Moon only' : '');
    const left = h('div.page.page-l',
      h('div.pg-tier', { style: { '--c': t.color } }, h('span', TIER_MARK[sp.tier]), t.name),
      h(`div.pg-pic${e ? '.zoomable' : '.unknown'}`, { title: e ? 'Look closer' : '', on: e ? { click: () => this.view(sp.id, best, e.best, 'your best') } : {} },
        h('img', { src: fishThumb(sp.id, best), alt: e ? sp.name : '', style: e ? {} : { filter: 'brightness(0) opacity(0.3)' } })),
      h('h3.pg-name', e ? sp.name : '???'),
      h('div.pg-variants', [['normal', 'Normal', e?.normal], ['gold', 'Gold', e?.gold], ['diamond', 'Diamond', e?.diamond]].map(([k, l, n]) => h(`span.pv.pv-${k}${n ? '.on' : ''}`, `${l}${n ? ` ×${n}` : ''}`))),
      h('div.kv.pg-kv',
        h('b', 'Weight'), h('span', `${sp.weight[0]}–${sp.weight[1]} lb`),
        h('b', 'Your best'), h('span', e ? lb(e.best) : 'Not caught yet'),
        h('b', 'Lake record'), h('span.rec', '…')),
      h('div.pg-num', `${at + 1} / ${shown.length}`));
    const right = h('div.page.page-r',
      h('div.pg-head', 'Field guide'),
      h('p.pg-lore', e ? lore : 'You haven\'t caught one yet, so this page is still blank. Here is where to look:'),
      h('div.kv.pg-kv',
        h('b', 'Where'), h('span', sp.spots ? sp.spots.map((id) => { const x = SPOTS.find((q) => q.id === id); return x ? `${x.tier === 'deep' ? 'The deep end' : x.name.replace(/^the /, 'The ')}, ${LAKE_NAMES[x.lake]} (level ${x.level})` : ''; }).join('; ') : sp.zones.map((z) => ZONES[z]?.name || z).join(', ')),
        sp.shell ? [h('b', 'Caught in'), h('span', sp.shell === 'cage' ? `A lobster cage (level ${Math.max(15, sp.minLevel || 15)}+)` : `A crab pot${(sp.minLevel || 1) > 1 ? ` (level ${sp.minLevel}+)` : ''}`)] : null,
        h('b', 'When'), h('span', when),
        seasons.length && seasons.length < 4 ? [h('b', 'Season'), h('span', seasons.join(', '))] : null),
      h('div.pg-head', 'Fun facts'),
      e ? h('ul.pg-facts', facts.map((x) => { const isLore = x.startsWith('Valley lore: '); return h(`li${isLore ? '.lore' : ''}`, icon(isLore ? 'sparkles' : 'info'), h('span', isLore ? x.slice(13) : x)); }))
        : h('p.pg-locked', icon('lock'), 'Catch one to unlock its fun facts.'),
      h('div.pg-num', `No. ${String(SPECIES.indexOf(sp) + 1).padStart(2, '0')}`));
    const book = h(`div.pedia-book${this.state.pediaTurn ? `.turn-${this.state.pediaTurn}` : ''}`, { tabindex: '0', 'aria-label': `Fishpedia page ${at + 1} of ${shown.length}`,
      on: { keydown: (ev) => { if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.stopPropagation(); go(1); } else if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.stopPropagation(); go(-1); } } } },
      h('div.spread', left, h('div.spine'), right), h('div.leaf', { 'aria-hidden': 'true' }));
    this.state.pediaTurn = null;
    c.body.append(book,
      h('div.book-nav',
        h('button.btn.ghost.small', { 'aria-label': 'Previous page', on: { click: () => go(-1) } }, icon('left'), 'Prev'),
        h('span.muted', `Page ${at + 1} of ${shown.length}${shown.length < SPECIES.length ? ' (filtered)' : ''}`),
        h('button.btn.ghost.small', { 'aria-label': 'Next page', on: { click: () => go(1) } }, 'Next', icon('right'))));
    requestAnimationFrame(() => { if (document.activeElement === document.body || !document.activeElement) book.focus({ preventScroll: true }); });
    this.game.records().then((recs) => {
      const r = recs[sp.id];
      const span = book.querySelector('.rec');
      if (span) span.textContent = r ? `${lb(r.weight)} by ${r.name}` : 'None yet';
    }).catch(() => {});
  }

  renderSets(c) {
    const g = this.game;
    c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, 'Catch every fish on a lake’s list for its title, a reward, and a statue on that lake’s shore.'));
    c.body.append(h('div.row-list', Object.entries(SETS).map(([id, set]) => {
      const pr = g.collections.progress(id);
      const claimed = g.ext.d.collections[id];
      return h('div.list-row.set-row',
        h('div.grow', h('div.ttl', set.name, claimed ? h('span.pill', { style: { '--c': '#5eae3e', marginLeft: '6px' } }, set.title) : null),
          h('div.set-fish', set.species.map((sid) => h(`img${pr.have.includes(sid) ? '' : '.missing'}`, { src: fishThumb(sid), title: pr.have.includes(sid) ? SPECIES_BY_ID[sid].name : '???' }))),
          h('div.progress', h('i', { style: { width: `${(pr.have.length / pr.total) * 100}%` } })),
          h('div.meta', `${pr.have.length}/${pr.total} · reward: ${set.reward.coins} coins${set.reward.pearls ? ` + ${set.reward.pearls} pearls` : ''}, title “${set.title}”, a statue by the lake and a plaque for your cabin`)),
        claimed ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Done') : pr.done ? h('button.btn.gold.small', { on: { click: () => this.act(() => g.collections.claim(id)) } }, 'Claim') : null);
    })));
  }

  // ---------------- Tackle box: swap the gear you own, anywhere ----------------
  render_tackle(c) {
    const g = this.game, p = g.profile;
    c.title.textContent = 'Tackle Box';
    for (const [id, label] of [['rod', 'Rods'], ['lure', 'Lures'], ['boat', 'Boats']]) this.tab(c, id, label, 'tackleTab');
    const kind = this.state.tackleTab;
    const busy = !['idle', undefined].includes(g.fishing?.state);
    c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, busy
      ? 'Reel in or cancel your cast to swap gear.'
      : kind === 'boat' ? 'Your equipped boat is the one you launch from the shore.' : 'Pick what to fish with. You can swap any time you are not mid-cast.'));
    if (kind === 'rod') c.body.append(h('div.list-row', { style: { marginBottom: '8px', background: '#e4f0fa' } }, icon('rod'),
      h('div.grow', h('div.ttl', `Your line rating: ${lineRating(p.equipped.rod, g.ext?.d?.upgrades)} lb`),
        h('div.meta', 'Fish heavier than this break the line. Stronger rods and the Braided line upgrade raise it.'))));
    const own = ITEMS.filter((i) => i.kind === kind && (p.owned.includes(i.id) || p.equipped[kind] === i.id));
    const eqId = p.equipped[kind];
    own.sort((a, b) => (b.id === eqId) - (a.id === eqId) || a.name.localeCompare(b.name));
    const list = h('div.row-list');
    for (const it of own) {
      const on = it.id === eqId, r = itemRarity(it), th = itemThumb(it);
      list.append(h(`div.list-row.tackle-row${on ? '.me' : ''}`, { style: { '--c': TIER_INFO[r].color } },
        h('span.ic-frame.tb-pic', th ? h('img', { src: th, alt: '' }) : icon(kind === 'boat' ? 'boat' : 'rod')),
        h('div.grow', h('div.ttl', it.name, ' ', h('span.pill', { style: { '--c': TIER_INFO[r].color }, 'data-mark': TIER_MARK[r] }, TIER_INFO[r].name)), h('div.meta', perkText(it))),
        h('div.row-btns', on
          ? h('button.btn.small', { disabled: true }, 'Equipped')
          : h('button.btn.green.small', { disabled: busy, title: busy ? 'Finish your cast first' : '', on: { click: () => this.act(() => g.equip(kind, it.id)) } }, 'Equip'))));
    }
    c.body.append(list);
    const more = ITEMS.filter((i) => i.kind === kind && !own.includes(i)).length;
    if (more) c.foot.append(h('div.grow.muted', `${more} more ${kind === 'boat' ? 'boats' : kind + 's'} to find at Gus's shop or from achievements.`),
      h('button.btn.ghost.small', { on: { click: () => { this.close(); g.walkToCabin(); } } }, icon('shop'), "Walk to Gus's shop"));
  }

  // ---------------- Shop ----------------
  render_shop(c) {
    const g = this.game, p = g.profile;
    c.title.textContent = "Gus's Tackle & Tide";
    const near = g.nearCabin();
    c.tabs.classList.add('tabs-wrap'); // 11 tabs: two rows, so none hide past the panel's edge (v1.13.15)
    for (const [id, label] of [['bait', 'Bait'], ['upgrade', 'Upgrades'], ['gear', 'Away gear'], ['rod', 'Rods'], ['lure', 'Lures'], ['boat', 'Boats'], ['decor', 'Cabin'], ['pets', 'Pets'], ['wear', 'Clothes'], ['emote', 'Emotes'], ['box', 'Gear box']]) this.tab(c, id, label, 'shopTab');
    if (!near) c.body.append(h('div.list-row', { style: { marginBottom: '8px', background: '#fff1c8' } }, icon('shop'), h('div.grow', h('div.ttl', 'Gus is at the cabin'), h('div.meta', 'You can equip gear here, but buying happens at the shop counter.')), h('button.btn.green.small', { on: { click: () => { this.close(); g.walkToCabin(); } } }, 'Walk there')));
    else c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, '“Welcome in! Prized fish make for prized gear.” — Gus the heron'));
    const featured = featuredItems(dayIndex());
    const kind = this.state.shopTab;
    c.foot.append(h('div.foot-wallet', h('span', h('img', { src: iconURL('coin'), alt: '' }), h('span.num', fmt(p.coins)), ' coins'), h('span', h('img', { src: iconURL('pearl'), alt: '' }), h('span.num', fmt(p.pearls)), ' pearls')));
    if (['bait', 'upgrade', 'gear', 'decor', 'box', 'pets'].includes(kind)) { this.renderTackle(c, kind, near); return; }
    if (kind === 'boat') {
      const ready = p.level >= BOAT_LEVEL;
      const canLaunch = ready && g.canLaunchHere();
      c.body.append(h('div.list-row', { style: { marginBottom: '8px', background: '#e4f0fa' } }, icon('boat'),
        h('div.grow', h('div.ttl', ready ? 'Taking a boat out' : `Boats unlock at level ${BOAT_LEVEL}`),
          h('div.meta', ready
            ? 'Walk to any shore with open water and press E (or the Launch boat button) to take your equipped boat out.'
            : 'Keep fishing from the dock; every boat here becomes buyable at that level.')),
        canLaunch ? h('button.btn.blue.small', { on: { click: () => { this.close(); g.launchBoat(); } } }, 'Launch now') : null));
    }
    const kinds = kind === 'wear' ? ['hat', 'shirt', 'accessory'] : [kind];
    let items = ITEMS.filter((i) => kinds.includes(i.kind));
    const owns = (it) => p.owned.includes(it.id);
    const afford = (it) => !it.price || ((it.price.coins ? p.coins >= it.price.coins : p.pearls >= it.price.pearls) && p.level >= (it.level || 1));
    const cost = (it) => (it.price?.pearls ? 1e5 + it.price.pearls * 100 : 0) + (it.price?.coins || 0);
    // toolbar: sort and filter
    const sort = this.state.shopSort || 'featured', filt = this.state.shopFilter || 'all';
    const sel = (key, val, opts) => h('select.mini', { 'aria-label': key === 'shopSort' ? 'Sort' : 'Show', on: { change: (e) => { this.state[key] = e.target.value; this.render(); } } }, opts.map(([v, t]) => h('option', { value: v, selected: val === v }, t)));
    c.body.append(h('div.shop-tools',
      h('div.chip-filter', [['all', 'All'], ['afford', 'Can afford'], ['new', 'Not owned'], ['owned', 'Owned']].map(([v, t]) => h(`button${filt === v ? '.on' : ''}`, { on: { click: () => { this.state.shopFilter = v; this.render(); } } }, t))),
      sel('shopSort', sort, [['featured', 'Featured first'], ['low', 'Price: low to high'], ['high', 'Price: high to low'], ['name', 'Name']])));
    items = items.filter((it) => filt === 'all' || (filt === 'owned' ? owns(it) : filt === 'new' ? !owns(it) : !owns(it) && it.source === 'shop' && afford(it)));
    const sorters = { featured: (a, b) => (featured.includes(b.id) - featured.includes(a.id)) || cost(a) - cost(b), low: (a, b) => cost(a) - cost(b), high: (a, b) => cost(b) - cost(a), name: (a, b) => a.name.localeCompare(b.name) };
    items.sort(sorters[sort] || sorters.featured);
    if (!items.length) { c.body.append(h('div.empty', 'Nothing here matches that filter.')); return; }
    // the selected item gets a detail panel with a comparison to what you have equipped
    const selKey = `shopSel_${kind}`;
    let selId = this.state[selKey];
    if (!items.some((i) => i.id === selId)) selId = (items.find((i) => !owns(i) && i.source === 'shop' && afford(i)) || items.find((i) => !owns(i)) || items[0]).id;
    this.state[selKey] = selId;
    const it = items.find((i) => i.id === selId);
    c.body.append(this.itemDetail(it, { near, featured: featured.includes(it.id), owns: owns(it), afford: afford(it) }));
    c.body.append(h('div.shop-grid', items.map((x) => {
      const r = itemRarity(x), eq = p.equipped[x.kind] === x.id, th = anyThumb(x, p.avatar);
      return h(`button.item-card${x.id === selId ? '.sel' : ''}${owns(x) ? '.owned' : ''}`, { style: { '--c': TIER_INFO[r].color }, 'aria-pressed': String(x.id === selId), title: x.name, on: { click: () => { this.state[selKey] = x.id; this.game.audio.sfx('page'); this.render(); } } },
        h('span.ic-frame', th ? h('img', { src: th, alt: '' }) : icon(x.kind === 'emote' ? 'smile' : 'shirt')),
        h('span.ic-name', x.name),
        eq ? h('span.ic-tag.eq', 'Equipped') : owns(x) ? h('span.ic-tag', 'Owned') : x.source !== 'shop' ? h('span.ic-tag', 'Achievement') : x.level && p.level < x.level ? h('span.ic-tag', icon('lock'), `Lv ${x.level}`) : priceEl(x.price),
        featured.includes(x.id) ? h('span.ic-flag', 'Featured') : null);
    })));
  }

  itemDetail(it, { near, featured, owns, afford }) {
    const g = this.game, p = g.profile;
    const equipped = p.equipped[it.kind] === it.id;
    const r = itemRarity(it);
    let btn;
    if (owns) {
      if (['rod', 'lure', 'boat'].includes(it.kind)) btn = equipped ? h('button.btn.small', { disabled: true }, 'Equipped') : h('button.btn.green', { on: { click: () => this.act(() => g.equip(it.kind, it.id)) } }, 'Equip');
      else if (it.kind === 'emote') btn = h('button.btn.small', { disabled: true }, 'Owned');
      else btn = h('button.btn.green', { on: { click: () => { this.close(); g.openCreator(); } } }, 'Wear');
    } else if (it.source !== 'shop') btn = h('button.btn.small', { disabled: true, title: 'Earned from an achievement' }, 'Earned from an achievement');
    else {
      const need = Math.max(it.kind === 'boat' ? BOAT_LEVEL : 1, it.level || 1);
      const lvlLock = p.level < need;
      const why = lvlLock ? `Unlocks at level ${need}` : !afford ? 'Need more' : !near ? 'Buy at the cabin' : 'Buy';
      btn = h('button.btn.gold', { disabled: !near || !afford || lvlLock, title: lvlLock ? `Unlocks at level ${need}` : !afford ? 'Not enough yet' : !near ? 'Buy at the counter by the cabin' : '', on: { click: () => this.act(() => g.buy(it.id)) } }, why);
    }
    // compare with what you use now
    let compare = null;
    if (['rod', 'lure', 'boat'].includes(it.kind) && !equipped) {
      const cur = ITEMS_BY_ID[p.equipped[it.kind]];
      if (cur) compare = h('div.compare', h('div.cmp-col', h('span.cmp-l', 'You use now'), h('b', cur.name), h('span', perkText(cur))), icon('right'), h('div.cmp-col.new', h('span.cmp-l', 'This one'), h('b', it.name), h('span', perkText(it))));
    }
    const th = anyThumb(it, p.avatar);
    return h('div.item-detail', { style: { '--c': TIER_INFO[r].color } },
      h('div.id-pic', th ? h('img', { src: th, alt: '' }) : icon(it.kind === 'emote' ? 'smile' : 'shirt')),
      h('div.id-main',
        h('div.id-name', it.name),
        h('div.id-tags', h('span.pill', { style: { '--c': TIER_INFO[r].color }, 'data-mark': TIER_MARK[r] }, TIER_INFO[r].name), featured ? h('span.pill', { style: { '--c': '#c8503a' } }, 'Featured today') : null, equipped ? h('span.pill', { style: { '--c': '#2f7f86' } }, 'Equipped') : null),
        h('div.id-perk', perkText(it)),
        compare,
        h('div.id-buy', !owns && it.price ? h('span.id-price', priceEl(it.price)) : null, btn)));
  }

  renderTackle(c, kind, near) {
    const g = this.game, t = g.tackle;
    const buyBtn = (price, fn, label = 'Buy') => {
      const p = g.profile;
      const afford = price.coins ? p.coins >= price.coins : p.pearls >= price.pearls;
      return h('button.btn.gold.small', { disabled: !afford || !near, title: !near ? 'Buy at the counter by the cabin' : !afford ? 'Not enough yet' : '', on: { click: () => this.act(fn) } }, !near ? 'At cabin' : !afford ? 'Need more' : label);
    };
    const B = h('div.row-list');
    if (kind === 'bait') {
      c.body.append(h('div.muted', { style: { marginBottom: '6px' } }, 'One bait goes on each fish you hook. Bait changes what bites. Press V (or tap the bait chip) to switch.'));
      for (const [id, b] of Object.entries(BAITS)) {
        const on = t.active === id;
        B.append(h(`div.list-row${on ? '.me' : ''}`, h('img.row-thumb', { src: baitThumb(id), alt: '' }),
          h('div.grow', h('div.ttl', b.name, h('span.muted', ` · you have ${t.count(id)}`)), h('div.meta', b.desc), h('div', priceEl(b.price), h('span.muted', ` for ${b.pack}`))),
          h('div.row-btns', t.count(id) ? h(`button.btn.small${on ? '' : '.green'}`, { on: { click: () => { t.use(on ? null : id); this.render(); } } }, on ? 'Take off' : 'Use') : null, buyBtn(b.price, () => t.buyBait(id)))));
      }
    } else if (kind === 'upgrade') {
      c.body.append(h('div.muted', { style: { marginBottom: '6px' } }, 'Rod upgrades help in Tug & Turn, Braided line lands heavier fish, and Rod holders let you fish several rods at once. Boat upgrades row faster and carry more.'));
      for (const [id, u] of Object.entries(UPGRADES)) {
        const lvl = t.level(id), price = t.nextPrice(id);
        B.append(h('div.list-row', h('img.row-thumb', { src: upgradeThumb(id), alt: '' }), h('div.grow', h('div.ttl', `${u.name} `, h('span.lvl-pips', Array.from({ length: Math.min(MAX_UPGRADE, u.prices.length) }, (_, i) => h(`i${i < lvl ? '.on' : ''}`)))), h('div.meta', `${u.what}: ${u.per}`), price ? priceEl(price) : null),
          price ? buyBtn(price, () => t.upgrade(id), `Level ${lvl + 1}`) : h('span.pill', { style: { '--c': '#5eae3e' } }, 'Maxed')));
      }
    } else if (kind === 'gear') {
      c.body.append(h('div.muted', { style: { marginBottom: '6px' } }, `Gear keeps fishing while you're away (even with this panel closed). Each piece soaks for a while, then hauls itself in. Up to ${PER_LAKE} of each kind per lake (own up to ${OWN_MAX}). Set it by facing water and pressing E.`));
      for (const [id, it] of Object.entries(GEAR)) {
        const locked = it.level && g.profile.level < it.level;
        B.append(h('div.list-row', h('img.row-thumb', { src: gearThumb(id), alt: '' }), h('div.grow', h('div.ttl', it.name, h('span.muted', ` · own ${g.gear.owned(id)}, set ${g.gear.inUse(id)}`)), h('div.meta', it.desc), priceEl(it.price)),
          locked ? h('span.pill', { style: { '--c': '#8a93a0' } }, `Level ${it.level}`) : buyBtn(it.price, () => g.gear.buy(id))));
      }
      // v1.8.1: the shovel, for digging up treasure maps' chests
      B.append(h('div.list-row', h('img.row-thumb', { src: gearThumb('shovel'), alt: '' }), h('div.grow', h('div.ttl', 'Shovel', g.treasure.hasShovel ? h('span.muted', ' · owned') : null), h('div.meta', 'For digging up buried treasure. Treasure maps turn up on hooks now and then; stand on the X and press E.'), g.treasure.hasShovel ? null : priceEl(SHOVEL_PRICE)),
        g.treasure.hasShovel ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Owned') : buyBtn(SHOVEL_PRICE, () => g.treasure.buyShovel())));
      if (g.gear.placed.length) {
        B.append(h('div.section-title', 'Out in the water'));
        for (const p of g.gear.placed) B.append(h('div.list-row', h('div.grow', h('div.ttl', GEAR[p.kind].name), h('div.meta', `${regionName(p.x, p.z)} · ${gearCount(p)}/${GEAR[p.kind].holds} caught · ${Math.max(0, Math.ceil((gearEnds(p) - Date.now()) / 60000))} min left`))));
      }
    } else if (kind === 'decor') {
      c.body.append(h('div.muted', { style: { marginBottom: '6px' } }, 'Things for your cabin (H). They are delivered straight there.'));
      const owned = new Set(g.ext.d.home.owned || []);
      for (const [id, it] of Object.entries(DECOR).filter(([, x]) => !x.earned)) B.append(h('div.list-row', h('img.row-thumb', { src: decorThumb(id), alt: '' }), h('div.grow', h('div.ttl', it.name), h('div.meta', it.desc || 'Decor'), owned.has(id) ? null : priceEl(it.price)), owned.has(id) ? h('button.btn.small', { on: { click: () => { this.close(); g.home.open(); } } }, 'Owned') : buyBtn(it.price, () => g.home.buyDecor(id))));
    } else if (kind === 'pets') {
      c.body.append(h('div.muted', { style: { marginBottom: '6px' } }, 'A fishing buddy follows you everywhere, sits with you while you fish, and now and then brings back something it found.'));
      const owned = new Set(g.ext.d.pets || []);
      for (const [id, p] of Object.entries(PETS)) {
        const mine = owned.has(id), active = g.ext.d.pet === id;
        B.append(h(`div.list-row${active ? '.me' : ''}`, h('img.row-thumb', { src: petThumb(id), alt: '' }), h('div.grow', h('div.ttl', p.name), h('div.meta', p.desc), mine ? null : priceEl(p.price)),
          mine ? h(`button.btn.small${active ? '' : '.green'}`, { on: { click: () => { if (active) { g.ext.change((d) => { d.pet = null; }); g.pet.sync(); } else g.pet.choose(id); this.render(); } } }, active ? 'Send home' : 'Bring along')
            : buyBtn(p.price, () => g.pet.buy(id), 'Adopt')));
      }
    } else if (kind === 'box') {
      c.body.append(h('div.muted', { style: { marginBottom: '6px' } }, `The gear box on the dock is shared by everyone on the lake. Leave spare bait for others; take a handful once a day.${t.canTake() ? '' : ' (You took your handful today.)'}`));
      for (const [id, b] of Object.entries(BAITS)) {
        const n = t.box[id] || 0;
        B.append(h('div.list-row', h('img.row-thumb', { src: baitThumb(id), alt: '' }), h('div.grow', h('div.ttl', b.name), h('div.meta', `${n} in the box · you have ${t.count(id)}`)),
          h('div.row-btns', h('button.btn.green.small', { disabled: t.count(id) < 5, on: { click: () => this.act(() => t.leave(id)) } }, 'Leave 5'), h('button.btn.blue.small', { disabled: !n || !t.canTake(), on: { click: () => this.act(() => t.take(id)) } }, 'Take'))));
      }
    }
    c.body.append(B);
  }

  // ---------------- Leaderboard ----------------
  render_admin(c) { this.game.mod.render(c, this); }

  // ---------------- v1.11 Friends & party ----------------
  render_social(c) {
    const g = this.game, P = g.party;
    c.title.textContent = 'Friends & Party';
    const fl = P.friendList();
    for (const [id, label] of [['party', P.inParty ? `Party ${P.members().length}/${PARTY_MAX}` : 'Party'], ['friends', `Friends${fl.length ? ` (${fl.filter((f) => f.online).length}/${fl.length})` : ''}${P.pending?.length ? ` · ${P.pending.length} new` : ''}`], ['nearby', 'On the lake']]) this.tab(c, id, label, 'socialTab');
    const tab = this.state.socialTab || 'party';
    const me = g.player.pos;
    const where = (peer) => { const r = peer ? g.remotes.list.get(peer.id) : null; return r?.peer.state ? `${regionName(r.pos.x, r.pos.z)} · ${Math.round(Math.hypot(r.pos.x - me.x, r.pos.z - me.z))} m` : 'On the lake'; };
    const btn = (cls, ic, label, fn, title) => h(`button.btn.small${cls}`, { title: title || label, on: { click: () => { fn(); setTimeout(() => this.render(), 600); } } }, ic ? icon(ic) : null, label);
    if (tab === 'party') {
      if (!P.inParty) {
        c.body.append(h('div.social-empty', icon('users'), h('b', "You're not in a party"), h('p', `Parties hold up to ${PARTY_MAX} anglers. Party members see each other anywhere on the lake and on the map, share Party chat (/p) and can hop into each other's boats.`), h('p.muted', 'Invite someone from the On the lake tab, click a name in chat, or type /invite name.')));
        const pend = P.invites.filter((i) => Date.now() - i.at < 60000);
        if (pend.length) c.body.append(h('div.muted', { style: { marginTop: '8px' } }, `Waiting on: ${pend.map((i) => P.nameOf(i.to)).join(', ')}`));
        return;
      }
      c.body.append(h('div.row-list', P.members().map((id) => {
        const self = id === P.me, pe = P.peerById(id)?.peer;
        return h('div.list-row', h('span.social-dot', { style: { background: P.color(id) } }),
          h('div.grow', h('div.ttl', P.nameOf(id), self ? ' (you)' : '', P.state.ld === id ? h('span.pill', { style: { '--c': '#d89a20', marginLeft: '6px' } }, 'Leader') : null), h('div.meta', self ? (g.currentZoneLabel?.() || '') : where(pe))),
          self ? null : btn('.ghost', 'chat', '', () => g.chat.openDm(id, P.nameOf(id)), 'Whisper'),
          !self && P.isLeader ? btn('.ghost', 'crown', '', () => P.promote(id), 'Make leader') : null,
          !self && P.isLeader ? btn('.ghost', 'userx', '', () => P.kick(id), 'Remove from party') : null);
      })));
      c.body.append(h('div.social-actions', btn('.green', 'chat', 'Party chat', () => { this.close(); g.chat.setChannel('party'); g.chat.focus(); }), btn('.ghost', 'exit', 'Leave party', () => P.leave())));
      return;
    }
    if (tab === 'friends') {
      // v1.12: add anyone by name, even if they're not on the lake right now
      // (the sheet redraws now and then: the typed name and the last answer live in sheet state so they survive it)
      const st = this.state;
      const hadFocus = document.activeElement?.classList?.contains('friend-add-in');
      const inp = h('input.friend-add-in', { type: 'text', maxlength: 24, placeholder: 'Angler name', 'aria-label': 'Angler name to add', autocomplete: 'off', spellcheck: 'false' });
      inp.value = st.friendDraft || '';
      inp.addEventListener('input', () => { st.friendDraft = inp.value; });
      const fm = st.friendMsg && Date.now() - st.friendMsg.at < 8000 ? st.friendMsg : null;
      const msg = h(`div.friend-add-msg${fm ? (fm.ok ? '.ok' : '.err') : ''}`, { 'aria-live': 'polite' }, fm ? fm.text : '');
      const send = async () => {
        const v = inp.value.trim(); if (!v) { inp.focus(); return; }
        go.disabled = true; msg.textContent = 'Looking…'; msg.className = 'friend-add-msg';
        const r = await P.requestByName(v);
        st.friendMsg = { text: r.msg, ok: !!r.ok, at: Date.now() };
        if (r.ok) st.friendDraft = '';
        this.render();
      };
      if (hadFocus) requestAnimationFrame(() => { inp.focus({ preventScroll: true }); inp.setSelectionRange(inp.value.length, inp.value.length); });
      const go = h('button.btn.small.green', { on: { click: send } }, icon('heart'), 'Add friend');
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); });
      inp.addEventListener('keyup', (e) => e.stopPropagation());
      c.body.append(h('div.friend-add', h('label.friend-add-l', 'Add a friend by name'), h('div.friend-add-row', inp, go), msg));
      const pend = P.pending || [];
      if (pend.length) {
        c.body.append(h('div.friend-sub', `Friend requests (${pend.length})`));
        c.body.append(h('div.row-list', pend.map((r) => h('div.list-row', h('span.social-dot', { style: { background: '#d8507a' } }),
          h('div.grow', h('div.ttl', r.name), h('div.meta', 'Wants to be friends')),
          btn('.green', 'check', 'Accept', () => P.answerRequest(r, true)),
          btn('.ghost', 'close', '', () => P.answerRequest(r, false), 'Decline')))));
      }
      if (!fl.length) { c.body.append(h('div.social-empty', icon('heart'), h('b', 'No friends yet'), h('p', 'Add someone by name above, from the On the lake tab, a name in chat, or /friend name. They don\'t need to be on the lake: they\'ll see your request when they log on.'))); return; }
      if (pend.length) c.body.append(h('div.friend-sub', 'Friends'));
      c.body.append(h('div.row-list', fl.map((f) => h(`div.list-row${f.online ? '' : '.offline'}`, h('span.social-dot', { style: { background: f.online ? '#5eae3e' : '#9aa5ad' } }),
        h('div.grow', h('div.ttl', f.name, P.has(f.id) ? h('span.pill', { style: { '--c': '#5eae3e', marginLeft: '6px' } }, 'In your party') : null), h('div.meta', f.online ? where(f.peer) : 'Not on the lake')),
        f.online ? btn('.ghost', 'chat', '', () => g.chat.openDm(f.id, f.name), 'Whisper') : null,
        f.online && !P.has(f.id) ? btn('.green', 'users', 'Invite', () => P.invite(f.id)) : null,
        btn('.ghost', 'close', '', () => P.removeFriend(f.id), 'Remove friend')))));
      return;
    }
    const ppl = P.peers().map((p) => ({ ...p, d: (() => { const r = g.remotes.list.get(p.peer.id); return r ? Math.hypot(r.pos.x - me.x, r.pos.z - me.z) : 9999; })() })).sort((a, b) => a.d - b.d);
    c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, 'Everyone fishing on the lake right now, nearest first.'));
    if (!ppl.length) { c.body.append(h('div.empty', "It's just you on the lake right now.")); return; }
    c.body.append(h('div.row-list', ppl.map((p) => {
      const friend = P.isFriend(p.id, p.peer.by), inP = P.has(p.id), name = String(p.meta.name || 'Angler').slice(0, 24);
      const asked = P.fr.some((r) => r.to === p.id), invited = P.invites.some((i) => i.to === p.id);
      return h('div.list-row', icon('user'),
        h('div.grow', h('div.ttl', name, friend ? h('span.pill', { style: { '--c': '#d8507a', marginLeft: '6px' } }, 'Friend') : null), h('div.meta', `${p.meta.lvl ? `Lv ${p.meta.lvl} · ` : ''}${where(p.peer)}`)),
        inP ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Party') : btn(invited ? '.ghost' : '.green', 'users', invited ? 'Invited' : 'Invite', () => P.invite(p.id)),
        friend ? null : btn('.ghost', 'heart', asked ? 'Asked' : 'Add friend', () => P.friendRequest(p.id)),
        btn('.ghost', 'chat', '', () => g.chat.openDm(p.id, name), 'Whisper'));
    })));
  }

  render_board(c) {
    const g = this.game;
    c.title.textContent = 'Notice Board';
    for (const [id, label] of [['requests', 'Requests'], ['gazette', 'Gazette'], ['mail', `Mail${g.social?.inbox().length ? ` (${g.social.inbox().length})` : ''}`], ['lake', 'Lake goal'], ['derby', 'Derby'], ['leaders', 'Leaderboard']]) this.tab(c, id, label, 'board');
    const b = this.state.board;
    if (b === 'requests') { this.renderRequests(c); return; }
    if (b === 'lake') { this.renderLake(c); return; }
    if (b === 'gazette') { this.renderGazette(c); return; }
    if (b === 'mail') { this.renderMail(c); return; }
    if (b === 'derby') { this.renderDerby(c); return; }
    c.body.append(h('div.chooser', { style: { marginBottom: '6px' } }, [['lakes', 'Lakes'], ['top', 'Top Angler'], ['diamonds', 'Diamonds'], ['heaviest', 'Heaviest'], ['pedia', 'Fishpedia'], ['records', 'Records']].map(([id, label]) => h(`button${this.state.lb === id ? '.on' : ''}`, { on: { click: () => { this.state.lb = id; this.render(); } } }, label))));
    if (this.state.lb === 'records') { this.renderRecords(c); return; }
    if (this.state.lb === 'lakes') { this.renderLakeBoards(c); return; }
    if (this.state.lb !== 'pedia') {
      c.body.append(h('div', { style: { display: 'flex', gap: '4px', marginBottom: '8px' } },
        ['week', 'all'].map((pid) => h(`button.btn.small${this.state.period === pid ? '.blue' : '.ghost'}`, { on: { click: () => { this.state.period = pid; this.render(); } } }, pid === 'week' ? 'This week' : 'All time'))));
    }
    const list = h('div.row-list', h('div.empty', 'Loading…'));
    c.body.append(list);
    const fmtScore = (s) => (this.state.lb === 'heaviest' ? lb(s) : this.state.lb === 'pedia' ? `${s}/${PEDIA_SLOTS}` : fmt(s));
    g.leaderboard(this.state.lb, this.state.lb === 'pedia' ? 'all' : this.state.period).then((rows) => {
      clear(list);
      if (!rows.length) { list.append(h('div.empty', 'No anglers on the board yet.')); return; }
      for (const r of rows) {
        list.append(h(`div.list-row${r.me ? '.me' : ''}`,
          h('div.pixel', { style: { width: '28px', textAlign: 'center', fontSize: '14px', color: r.rank === 1 ? '#d89a20' : 'inherit' } }, r.rank === 1 ? icon('trophy') : `#${r.rank}`),
          h('div.grow', h('div.ttl', r.name, r.me ? ' (you)' : ''), h('div.meta', `Lv ${r.level || 1}${r.title ? ` · ${r.title}` : ''}`)),
          h('div.pixel', { style: { fontSize: '13px' } }, fmtScore(r.score))));
      }
    }).catch(() => { clear(list).append(h('div.empty', 'Could not load the board. Try again in a moment.')); });
  }

  // v1.10: the Leaderboard opens on the five lakes, each with its flag holder (heaviest fish landed there this week)
  renderLakeBoards(c) {
    const g = this.game, lf = g.lakeFlag;
    c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, 'The heaviest fish landed at each lake this week plants that angler\'s flag on its cairn. Boards reset Monday (UTC).'));
    const grid = h('div.lake-boards');
    for (const lake of Object.keys(FLAG_LAKES)) {
      const st = lf.standings(lake), top = st.holder;
      const cv = h('canvas.lb-flag', { width: 96, height: 64 });
      drawFlag(cv.getContext('2d'), top?.cc || 'XX', 96, 64);
      const land = top && top.cc !== 'XX' ? COUNTRY_BY_CODE[top.cc]?.name : null;
      const sp = top?.sp ? SPECIES_BY_ID[top.sp] : null;
      grid.append(h('div.lake-board',
        h('header', h('span.lb-lake', st.name), st.last && top ? h('span.pill', { style: { '--c': '#8a93a0' } }, 'Last week') : null),
        top ? h('div.lb-top', cv,
          h('div.grow', h('div.lb-name', top.name, top.id === lf.docId(lake) ? ' (you)' : ''), h('div.meta', land || 'No flag chosen'),
            h('div.lb-catch', sp ? h('img', { src: fishThumb(sp.id), alt: '' }) : null, h('span', `${top.w.toFixed(1)} lb ${sp?.name || 'fish'}`))),
          h('span.lb-crown', icon('trophy')))
          : h('div.lb-top.unclaimed', cv, h('div.grow', h('div.lb-name', 'Unclaimed'), h('div.meta', st.loaded ? `Land any fish at ${st.name} to plant your flag.` : 'Loading…'))),
        st.rows.length > 1 ? h('ol.lb-rest', st.rows.slice(1).map((r, i) => h(`li${r.me ? '.me' : ''}`, h('span.lb-rank', `#${i + 2}`), h('span.grow', r.name), h('span.pixel', `${r.w.toFixed(1)} lb`)))) : null));
    }
    c.body.append(grid);
  }

  renderRequests(c) {
    const g = this.game, q = g.ext.d.quests;
    g.quests.refresh();
    const wk = g.quests.weekly(), left = Math.max(0, weekEnds(wk.week) - Date.now()), dLeft = Math.floor(left / 86400000), hLeft = Math.ceil((left % 86400000) / 3600000);
    c.body.append(h('div.section-title', 'Weekly quest'));
    c.body.append(h(`div.list-row.weekly${wk.done && !wk.claimed ? '.me' : ''}`, h('span.wk-pearl', icon('pearl')),
      h('div.grow', h('div.ttl', wk.text), h('div.progress', h('i', { style: { width: `${(wk.have / wk.n) * 100}%` } })), h('div.meta', `${wk.have}/${wk.n} · ${WEEKLY_PEARLS} pearls, ${wk.reward.coins} coins, ${wk.reward.xp} XP · ${dLeft ? `${dLeft}d ` : ''}${hLeft}h left`)),
      wk.claimed ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Done') : wk.done ? h('button.btn.gold.small', { on: { click: () => this.act(() => g.quests.claimWeekly()) } }, 'Claim') : null));
    c.body.append(h('div.section-title', 'Daily requests'));
    c.body.append(h('div.muted', { style: { marginBottom: '6px' } }, 'Three new requests every day (midnight UTC). The story continues in your Journal (J).'));
    c.body.append(h('div.row-list', q.list.map((x) => h(`div.list-row${x.done && !x.claimed ? '.me' : ''}`, icon('scroll'),
      h('div.grow', h('div.ttl', x.text), h('div.progress', h('i', { style: { width: `${(x.have / x.n) * 100}%` } })), h('div.meta', `${x.have}/${x.n} · ${x.reward.coins} coins, ${x.reward.xp} XP`)),
      x.claimed ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Done') : x.done ? h('button.btn.gold.small', { on: { click: () => this.act(() => g.quests.claim(x.id)) } }, 'Claim') : null))));
    // finish all three for a bonus
    c.body.append(h(`div.list-row${g.quests.dailyBonusReady() ? '.me' : ''}`, { style: { marginTop: '6px' } }, icon('gift'),
      h('div.grow', h('div.ttl', 'Daily bonus'), h('div.meta', q.bonus ? 'Claimed today. New requests at midnight UTC.' : `Claim all three requests for ${DAILY_BONUS.coins} coins and ${DAILY_BONUS.xp} XP.`)),
      q.bonus ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Done') : g.quests.dailyBonusReady() ? h('button.btn.gold.small', { on: { click: () => this.act(() => g.quests.claimDailyBonus()) } }, 'Claim') : null));
    const n = q.npc;
    if (n) {
      c.body.append(h('div.section-title', 'A local is asking'));
      c.body.append(h('div.list-row', icon('user'), h('div.grow', h('div.ttl', `${n.name}: “${n.ask}”`), h('div.meta', n.done ? 'Delivered. Thank you!' : n.accepted ? `Accepted: bring a ${SPECIES_BY_ID[n.speciesId].name} to ${n.name} and press E to talk. Reward: ${n.reward.coins} coins.` : `${n.name} has a request: walk up (look for the ✉ over their head) and press E to talk. Reward: ${n.reward.coins} coins.`)),
        n.done ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Done') : null));
    }
  }

  renderGazette(c) {
    const g = this.game, z = g.social.gazette();
    c.body.append(h('div.gazette-head', h('div.gz-title', 'The Lake Gazette'), h('div.gz-date', new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }))));
    c.body.append(h('div.list-row.fotw', h('img', { src: fishThumb(z.fotw.id) }),
      h('div.grow', h('div.ttl', `Fish of the Week: ${z.fotw.name}`), h('div.meta', z.caught ? 'You caught yours this week. Nice!' : `Catch one this week for a 120-coin bonus. Look in: ${z.fotw.zones.map((x) => ZONES[x].name).join(', ')}.`)),
      z.caught ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Done') : null));
    c.body.append(h('div.gz-lines', z.lines.map((l) => { const [head, ...rest] = l.split(': '); return h('p', h('b', `${head}: `), rest.join(': ')); })));
  }

  renderMail(c) {
    const g = this.game, s = g.social;
    const inbox = s.inbox();
    c.body.append(h('div.section-title', 'Your mailbox'));
    if (!inbox.length) c.body.append(h('div.empty', 'No mail right now.'));
    c.body.append(h('div.row-list', inbox.map((m) => h('div.list-row', icon(m.kind === 'fish' ? 'fish' : 'worm'),
      h('div.grow', h('div.ttl', `From ${m.fromName || 'a friend'}: ${m.kind === 'fish' ? `a ${SPECIES_BY_ID[m.speciesId]?.name || 'fish'}` : `${m.n} ${BAITS[m.bait]?.name || 'bait'}`}`), m.note ? h('div.meta', `“${m.note}”`) : null),
      h('button.btn.green.small', { on: { click: () => this.act(() => s.open(m)) } }, 'Open')))));
    // send a gift to someone on the lake
    c.body.append(h('div.section-title', 'Send a gift'));
    const peers = [...(g.net?.peers?.values?.() || [])].filter((p) => p.meta?.id && p.meta?.name);
    if (!peers.length) { c.body.append(h('div.empty', 'Gifts go to anglers who are on the lake right now. Nobody else is here yet.')); return; }
    const who = h('select.mini', peers.map((p) => h('option', { value: p.meta.id }, p.meta.name)));
    const bait = Object.keys(BAITS).filter((k) => g.tackle.count(k) >= 5);
    const fish = [...g.profile.creel, ...g.profile.storage].filter((x) => !g.ext.d.locked.includes(x.id)).slice(0, 40);
    const what = h('select.mini', [...bait.map((k) => h('option', { value: `bait:${k}` }, `5 ${BAITS[k].name}`)), ...fish.map((x) => h('option', { value: `fish:${x.id}` }, `${g.traits.label(x)} (${lb(x.weight)})`))]);
    const note = h('input.name-fish', { maxLength: 140, placeholder: 'A short note (optional)', style: { maxWidth: '100%', margin: '4px 0' } });
    const msg = h('div.meta');
    if (!bait.length && !fish.length) { c.body.append(h('div.empty', 'Catch a fish or buy some bait to send a gift.')); return; }
    c.body.append(h('div.gift-row', who, what), note, h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
      h('button.btn.blue.small', { on: { click: async () => {
        const [kind, id] = what.value.split(':');
        const p = peers.find((x) => x.meta.id === who.value);
        const r = await s.send(who.value, p?.meta.name, kind === 'bait' ? { kind, id, n: 5, note: note.value } : { kind, catchId: id, note: note.value });
        if (r.error) msg.textContent = r.error; else { g.ui.toast(`Gift on its way to ${p?.meta.name}!`, { icon: 'chat' }); this.render(); }
      } } }, 'Send'), msg));
  }

  renderLake(c) {
    const g = this.game, cm = g.community;
    c.body.append(h('div.muted', { style: { marginBottom: '6px' } }, `Every catch by anyone on this lake fills the meter. At ${COMMUNITY_GOAL} this week the Lantern Festival begins: fireworks every night and a gift for everyone who helped.`));
    c.body.append(h('div.lake-meter', h('i', { style: { width: `${cm.progress * 100}%` } }), h('span', `${fmt(cm.total)} / ${COMMUNITY_GOAL}`)));
    c.body.append(h('div.meta', { style: { margin: '6px 0' } }, `You've added ${cm.mine} this week.`));
    if (cm.festival) c.body.append(h('div.list-row.me', icon('star'), h('div.grow', h('div.ttl', 'The Lantern Festival is on!'), h('div.meta', 'Fireworks over the cove every night until the week ends.')),
      cm.canClaim() ? h('button.btn.gold.small', { on: { click: () => this.act(() => cm.claim()) } }, 'Claim gift') : h('span.muted', cm.mine ? 'Gift claimed' : 'Catch a fish to join in')));
  }

  renderDerby(c) {
    const g = this.game, d = g.derby, st = d.status();
    if (!st) {
      const next = nextDerby();
      c.body.append(h('div.empty', `No derby right now. The next one starts at ${new Date(next).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} and runs 10 minutes. Derbies start every hour on the hour.`));
      c.body.append(h('div.meta', `Derbies won: ${g.ext.d.derby.wins || 0}`));
      return;
    }
    c.body.append(h('div.ttl', `${st.name} · ${Math.floor(st.left / 60)}:${String(st.left % 60).padStart(2, '0')} left`));
    c.body.append(h('div.muted', { style: { marginBottom: '6px' } }, d.current.speciesId ? `Heaviest ${SPECIES_BY_ID[d.current.speciesId].name} wins.` : 'Heaviest fish of any kind wins.'));
    const rows = d.board();
    if (!rows.length) c.body.append(h('div.empty', 'No entries yet. Be the first!'));
    c.body.append(h('div.row-list', rows.map((r, i) => h(`div.list-row${r.me ? '.me' : ''}`, h('div.pixel', { style: { width: '28px', textAlign: 'center' } }, `#${i + 1}`), h('div.grow', h('div.ttl', r.name, r.me ? ' (you)' : '')), h('div.pixel', lb(r.w))))));
  }

  renderRecords(c) {
    const list = h('div.row-list', h('div.empty', 'Loading…'));
    c.body.append(list);
    this.game.records().then((recs) => {
      clear(list);
      const rows = SPECIES.filter((s) => recs[s.id]);
      if (!rows.length) { list.append(h('div.empty', 'No lake records yet. Every first catch sets one!')); return; }
      for (const sp of rows) {
        const r = recs[sp.id];
        list.append(h('div.list-row', h('img.zoomable', { src: fishThumb(sp.id), on: { click: () => this.view(sp.id, 'normal', r.weight, `record by ${r.name}`) } }), h('div.grow', h('div.ttl', sp.name), h('div.meta', `${r.name}${r.ts ? ` · ${ago(r.ts)}` : ''}`)), h('div.pixel', { style: { fontSize: '12px' } }, lb(r.weight))));
      }
    });
  }

  // ---------------- Journal ----------------
  // v1.13.7: one page per tab, never a long scroll. Lists that can grow page with arrows instead of scrolling.
  pager(key, items, per) {
    const pages = Math.max(1, Math.ceil(items.length / per));
    const at = Math.min(this.state[key] || 0, pages - 1);
    this.state[key] = at;
    const go = (d) => { this.state[key] = Math.max(0, Math.min(pages - 1, at + d)); this.game.audio.sfx('page'); this.render(); };
    const nav = pages > 1 ? h('div.j-pager', h('button.btn.ghost.small', { disabled: at === 0, 'aria-label': 'Previous page', on: { click: () => go(-1) } }, icon('left')),
      h('span.muted', `${at + 1} / ${pages}`), h('button.btn.ghost.small', { disabled: at === pages - 1, 'aria-label': 'Next page', on: { click: () => go(1) } }, icon('right'))) : null;
    return { slice: items.slice(at * per, at * per + per), nav };
  }

  chips(key, opts, dot = () => false) {
    const cur = this.state[key] ?? opts[0][0];
    return h('div.chooser.j-chips', opts.map(([id, label]) => h(`button${cur === id ? '.on' : ''}`, { on: { click: () => { this.state[key] = id; this.state[`${key}Page`] = 0; this.game.audio.sfx('page'); this.render(); } } }, label, dot(id) ? h('span.j-dot') : null)));
  }

  render_journal(c) {
    const g = this.game, p = g.profile;
    c.title.textContent = 'Journal';
    const owed = Object.keys(LEVEL_REWARDS).map(Number).filter((L) => p.level >= L && !g.ext.d.levelRewards?.[L]);
    const sd = g.ext.d.story, s2 = g.ext.d.story2 || { step: 0, log: [] };
    const miles = g.quests.milestones();
    const claimable = ACHIEVEMENTS.filter((a) => !p.achievements[a.id] && (p.stats[a.stat] || 0) >= a.threshold);
    const TABS = [
      ['climb', 'Climb', 'star', owed.length > 0],
      ['lakes', 'Lakes', 'map', false],
      ['quests', 'Quests', 'scroll', !!(sd.ready || s2.ready)],
      ['collect', 'Collect', 'book', miles.some((m) => m.have >= m.n && !m.claimed)],
      ['ach', 'Awards', 'trophy', claimable.length > 0],
      ['bottles', 'Bottles', 'chat', false],
    ];
    const cur = this.state.journalTab || 'climb';
    for (const [id, label, ic, dot] of TABS) {
      const on = cur === id;
      c.tabs.append(h(`button.tab.j-tab${on ? '.on' : ''}`, { role: 'tab', 'aria-selected': String(on), 'aria-label': label, title: label, on: { click: () => { this.state.journalTab = id; this.game.audio.sfx('page'); this.swapIn = true; this.render(); } } }, icon(ic), h('span.j-tab-l', label), dot ? h('span.j-dot') : null));
    }
    const B = c.body;
    B.classList.add('j-page');

    if (cur === 'climb') {
      // your climb: the next thing a level opens, and level rewards you're owed
      const nu = nextUnlock(p.level);
      B.append(h('div.section-title', 'Your climb'));
      B.append(h('div.list-row.climb', icon('star'),
        h('div.grow', h('div.ttl', nu ? `Level ${nu.level}: ${nu.what}` : 'Every spot in the valley is open to you'), h('div.meta', nu ? `${nu.text} You're level ${p.level}.` : 'Now chase the legends and finish your Fishpedia.')),
        nu?.spot ? h('button.btn.small', { on: { click: () => g.markSpot(nu.spot) } }, icon('pin'), 'Waypoint') : null));
      if (owed.length) {
        B.append(h('div.section-title', 'Rewards waiting'));
        const { slice, nav } = this.pager('journalOwedPage', owed, 3);
        for (const L of slice) B.append(h('div.list-row.me', icon('gift'), h('div.grow', h('div.ttl', `Level ${L} reward`), h('div.meta', `${LEVEL_REWARDS[L].coins} coins, ${LEVEL_REWARDS[L].pearls} pearls and the title “${LEVEL_REWARDS[L].title}”`)),
          h('button.btn.gold.small', { on: { click: () => this.act(() => g.claimLevelReward(L)) } }, 'Claim')));
        if (nav) B.append(nav);
      }
      const tm = g.ext.d.treasure;
      B.append(h('div.section-title', 'Treasure'));
      if (tm?.active) B.append(h('div.list-row.me', icon('map'), h('div.grow', h('div.ttl', 'Treasure map'), h('div.meta', `A spot near ${tm.place}. ${g.treasure.marked ? `Marked on your map for ${Math.ceil(g.treasure.markLeft() / 60)} more min.` : 'Not on your map any more: look at it to mark it again.'} Find it and press E to dig.`)), h('button.btn.gold.small', { on: { click: () => { this.close(); g.treasure.open(); } } }, 'Look at it')));
      else B.append(h('div.muted', tm?.found ? `Treasure chests dug up: ${tm.found}. Maps turn up on hooks now and then.` : 'No map in your pocket. Maps turn up on hooks now and then.'));
    }

    if (cur === 'lakes') {
      // the lakes and their three levels (anywhere, the deep end, the landmark), one lake at a time
      g.sawLakeLevels?.();
      const fishOf = (test) => SPECIES.filter((x) => !x.shell && test(x)).map((x) => (p.fishpedia[x.id] ? x.name : '???')).join(', ');
      if (!this.state.journalLake) this.state.journalLake = LAKE_ORDER[0];
      B.append(this.chips('journalLake', LAKE_ORDER.map((lake) => [lake, LAKE_NAMES[lake]])));
      const lake = this.state.journalLake, L = LAKE_LEVELS[lake];
      const tier = (lv, label, fish, spot) => h(`div.list-row${p.level >= lv ? '' : '.offline'}`, icon(p.level >= lv ? 'check' : 'lock'),
        h('div.grow', h('div.ttl', `${p.level >= lv ? '' : `Lv ${lv} · `}${label}`), fish ? h('div.meta', fish) : null),
        spot && p.level >= lv ? h('button.btn.ghost.small', { title: 'Set your waypoint here', on: { click: () => g.markSpot(spot) } }, icon('pin'), 'Waypoint') : null);
      const deepId = L.deep.id, poiId = L.poi.id;
      B.append(h('div.section-title', `${LAKE_NAMES[lake]} · Lv ${lakeRange(lake)}`),
        tier(L.base, 'Anywhere in the lake', lake === 'cove' ? '' : fishOf((x) => x.lakeFish && x.zones.includes(lake))),
        tier(L.deep.level, 'The deep end', deepId ? fishOf((x) => x.spots?.includes(deepId)) : '', deepId),
        tier(L.poi.level, `${L.poi.name.replace(/^the /, 'The ')}, the landmark${L.poi.hint ? ` (bites ${L.poi.hint})` : ''}`, poiId ? fishOf((x) => x.spots?.includes(poiId)) : fishOf((x) => x.zones.includes('ruins') && !x.zones.includes('deep')), poiId));
    }

    if (cur === 'quests') {
      if (!this.state.journalQuest) this.state.journalQuest = 'ruins';
      B.append(this.chips('journalQuest', [['ruins', 'The Sunken Ruins'], ['valley', 'The Valley Expedition']], (id) => (id === 'ruins' ? sd.ready : s2.ready)));
      const ruins = this.state.journalQuest === 'ruins';
      const lines = ruins ? STORY : STORY2, d = ruins ? sd : s2, st = lines[d.step];
      if (st) {
        B.append(h('div.list-row.story', h('div.grow', h('div.ttl', ruins ? `Chapter ${d.step + 1}: ${st.title}` : `Part ${d.step + 1} of ${STORY2.length}: ${st.title}`), h('div.story-text', st.text), h('div.meta', `Goal: ${st.goal}${st.n > 1 ? ` (${Math.min(d.have || 0, st.n)}/${st.n})` : ''}`)),
          d.ready ? h('button.btn.gold.small', { on: { click: () => this.act(() => (ruins ? g.quests.claimStory() : g.quests.claimStory2())) } }, ruins ? 'Read on' : 'Claim') : null));
      } else if (ruins) B.append(h('div.list-row.story', h('div.grow', h('div.ttl', 'The end… for now'), h('div.story-text', 'The lantern glows on your line. The ruins are quiet again, and the lake remembers you.'))));
      else B.append(h('div.list-row.story', h('div.grow', h('div.ttl', 'Expedition complete'), h('div.story-text', 'You\'ve rowed every water in the valley and heard the cavern answer. Valley Legend.'))));
      const log = (d.log || []).slice().reverse();
      if (log.length) {
        B.append(h('div.section-title', `Done so far (${log.length})`));
        const { slice, nav } = this.pager(ruins ? 'journalRuinsPage' : 'journalValleyPage', log, 4);
        B.append(h('div.row-list', slice.map((e) => h('div.story-done', `✓ ${lines[e.step].title}`))));
        if (nav) B.append(nav);
      }
    }

    if (cur === 'collect') {
      // Fishpedia milestones and the lake collections
      const { slice, nav } = this.pager('journalCollectPage', miles, 4);
      B.append(h('div.row-list', slice.map((m) => h(`div.list-row${m.have >= m.n && !m.claimed ? '.me' : ''}`, icon('book'),
        h('div.grow', h('div.ttl', m.text), h('div.progress', h('i', { style: { width: `${(m.have / m.n) * 100}%` } })), h('div.meta', `${m.have}/${m.n} · ${[m.reward.coins ? `${m.reward.coins} coins` : '', m.reward.pearls ? `${m.reward.pearls} pearls` : '', m.reward.title ? `title “${m.reward.title}”` : ''].filter(Boolean).join(', ')}`)),
        m.claimed ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Done') : m.have >= m.n ? h('button.btn.gold.small', { on: { click: () => this.act(() => g.quests.claimMilestone(m.id)) } }, 'Claim') : null))));
      if (nav) B.append(nav);
    }

    if (cur === 'ach') {
      const done = Object.keys(p.achievements).length;
      B.append(h('div.j-head', h('span.muted', `${done}/${ACHIEVEMENTS.length} achievements`),
        claimable.length ? h('button.btn.gold.small', { on: { click: () => this.act(() => g.claimAll()) } }, `Claim ${claimable.length} reward${claimable.length > 1 ? 's' : ''}`) : null));
      const cats = [...new Set(ACHIEVEMENTS.map((a) => a.category))];
      if (!this.state.journalCat) this.state.journalCat = cats[0];
      B.append(this.chips('journalCat', cats.map((x) => [x, x]), (cat) => claimable.some((a) => a.category === cat)));
      const list = ACHIEVEMENTS.filter((a) => a.category === this.state.journalCat);
      const { slice, nav } = this.pager('journalCatPage', list, 4);
      B.append(h('div.row-list', slice.map((a) => {
        const got = p.achievements[a.id];
        const prog = achievementProgress(p, a);
        const hidden = a.secret && !got && prog < 1;
        const reward = a.reward.coins ? `${a.reward.coins} coins` : a.reward.pearls ? `${a.reward.pearls} pearls` : a.reward.item ? ITEMS_BY_ID[a.reward.item]?.name : '';
        const rewardTxt = [reward, a.reward.title ? `title “${a.reward.title}”` : ''].filter(Boolean).join(' + ');
        return h('div.list-row', { style: got ? { background: '#f4fbe8' } : {} },
          h('div', { style: { width: '10px', height: '34px', borderRadius: '3px', background: ACH_TIER_COLOR[a.tier], flex: 'none' } }),
          h('div.grow', h('div.ttl', hidden ? '???' : a.name), h('div.meta', hidden ? 'A secret. Keep fishing.' : `${a.desc} · ${rewardTxt}`),
            !got && !hidden ? h('div.progress', h('i', { style: { width: `${prog * 100}%` } })) : null),
          got ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Done') : prog >= 1 ? h('button.btn.gold.small', { on: { click: () => this.act(() => g.claim(a.id)) } }, 'Claim') : h('span.muted', `${Math.min(p.stats[a.stat] || 0, a.threshold)}/${a.threshold}`));
      })));
      if (nav) B.append(nav);
    }

    if (cur === 'bottles') {
      if (p.titles.length) {
        B.append(h('div.section-title', 'Your title'));
        const opts = ['', ...p.titles];
        const { slice, nav } = this.pager('journalTitlePage', opts, 8);
        B.append(h('div.chooser', slice.map((t) => h(`button${(p.title || '') === t ? '.on' : ''}`, { on: { click: () => this.act(() => g.setTitle(t)) } }, t || 'None'))));
        if (nav) B.append(nav);
      }
      // Write a bottle for another angler to find
      B.append(h('div.section-title', 'Send a message in a bottle'));
      if (g.bottles.canWrite()) {
        const ta = h('textarea.bottle-input', { maxLength: BOTTLE_MAX, rows: 2, placeholder: 'Something kind for a stranger to find (no names, links or numbers)…' });
        const msg = h('div.meta');
        B.append(ta, h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' } },
          h('button.btn.blue.small', { on: { click: async () => { const r = await g.bottles.write(ta.value); if (r.error) msg.textContent = r.error; else { g.ui.toast('Your bottle bobs away across the lake.', { icon: 'chat' }); this.render(); } } } }, 'Toss it in'), msg));
      } else B.append(h('div.meta', 'Your bottle is out on the water. You can send another tomorrow.'));
      if (p.bottles.length) {
        B.append(h('div.section-title', `Bottles you found ${p.bottles.length}/12`));
        const { slice, nav } = this.pager('journalBottlePage', p.bottles, 3);
        B.append(h('div.row-list', slice.map((i) => h('div.list-row', h('i', { style: { fontSize: '13px' } }, `“${BOTTLE_MESSAGES[i]}”`)))));
        if (nav) B.append(nav);
      }
    }
  }

  renderControls() {
    const g = this.game;
    const wrap = h('div.controls');
    for (const a of ACTIONS) {
      const btn = h('button.btn.small.keycap', { on: { click: () => {
        btn.textContent = 'Press a key…';
        g.rebinding = (k) => { g.rebinding = null; const err = g.keymap.bind(a.id, k); if (err) g.ui.toast(err); this.render(); };
      } } }, keyName(g.keymap.keyFor(a.id)));
      wrap.append(h('div.control-row', h('span', a.label), btn));
    }
    wrap.append(h('div', { style: { display: 'flex', gap: '6px', marginTop: '4px' } }, h('button.btn.ghost.small', { on: { click: () => { g.keymap.reset(); this.render(); } } }, 'Reset keys'),
      h('span.muted', g.pads.connected ? 'Controller connected.' : 'Plug in a controller and press any button.')));
    return wrap;
  }

  // ---------------- Settings: full screen, tabbed, every change previews live; Revert undoes them ----------------
  render_settings(c) {
    const g = this.game, p = g.profile, s = p.settings;
    c.title.textContent = 'Settings';
    const TABS = [['graphics', 'Graphics', 'monitor'], ['audio', 'Audio', 'volume'], ['controls', 'Controls', 'keyboard'], ['access', 'Accessibility', 'access'], ['play', 'Gameplay', 'fish'], ['account', 'Account', 'user']];
    const cur = this.state.settingsTab || 'graphics';
    for (const [id, label, ic] of TABS) {
      const on = cur === id;
      c.tabs.append(h(`button.tab${on ? '.on' : ''}`, { role: 'tab', 'aria-selected': String(on), on: { click: () => { this.state.settingsTab = id; this.game.audio.sfx('page'); this.swapIn = true; this.render(); } } }, icon(ic), label));
    }
    const save = (patch) => { g.saveSettings(patch); this.updateRevert(); };
    const row = (label, desc, control) => h('label.set-row', h('span.set-l', h('span.set-name', label), desc ? h('span.set-desc', desc) : null), control);
    const slider = (key, label, desc) => {
      const v = Math.round((s[key] ?? 1) * 100);
      const val = h('span.val', `${v}`);
      const inp = h('input', { type: 'range', min: 0, max: 100, value: v, style: { '--fill': `${v}%` }, 'aria-label': label, on: { input: (e) => { e.target.style.setProperty('--fill', `${e.target.value}%`); val.textContent = e.target.value; save({ [key]: e.target.value / 100 }); } } });
      return row(label, desc, h('span.set-range', inp, val));
    };
    const toggle = (key, label, desc, def = false, after) => row(label, desc, h('input', { type: 'checkbox', checked: s[key] == null ? def : !!s[key], 'aria-label': label, on: { change: async (e) => { if (after) await after(e); else save({ [key]: e.target.checked }); } } }));
    const choice = (key, label, desc, opts) => row(label, desc, h('span.seg', { role: 'radiogroup', 'aria-label': label }, opts.map(([v, t]) => h(`button${s[key] === v ? '.on' : ''}`, { type: 'button', role: 'radio', 'aria-checked': String(s[key] === v), on: { click: (e) => { e.preventDefault(); save({ [key]: v }); this.render(); } } }, t))));
    const B = c.body;
    if (cur === 'graphics') {
      B.append(h('div.set-group', h('h3', 'Graphics'),
        choice('graphics', 'Quality', 'Low runs smoothly in a side panel. High adds shadows, reflections and more trees.', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]),
        toggle('autoRes', 'Smooth frame rate', 'If the game starts to stutter, it draws at a slightly lower resolution until it runs smoothly again.', true),
        toggle('reducedMotion', 'Reduced motion', 'Calms camera shake, pop-ups and animated menus.')));
    } else if (cur === 'audio') {
      B.append(h('div.set-group', h('h3', 'Volume'), slider('master', 'Master'), slider('music', 'Music'), slider('sfx', 'Effects'), slider('ambience', 'Ambience', 'Water, birds, wind and weather.'), slider('others', 'Other players', 'Splashes and cheers from anglers nearby.')),
        h('div.set-group', h('h3', 'Focus'), toggle('muteUnfocused', 'Mute in the background', 'Goes quiet while you are working in another tab or window.')));
    } else if (cur === 'controls') {
      B.append(h('div.set-group', h('h3', 'Keys'), h('div.muted', { style: { marginBottom: '8px' } }, 'Click a key, then press the new one.'), this.renderControls()),
        h('div.set-group', h('h3', 'How to play'), h('div.howto',
          h('p', h('b', 'Cast: '), 'hold the left mouse button, release near the top of the bar for a long cast.'),
          h('p', h('b', 'Hook: '), 'when the bobber dips and "!" appears, click fast.'),
          h('p', h('b', 'Reel (Tug & Turn): '), 'hold to reel and move the mouse against the fish’s pull. Let go when the line turns red or the fish leaps.'),
          h('p', h('b', 'Move: '), 'click the ground, use WASD, or hold both mouse buttons to walk forward and steer with the mouse. Shift sprints, Space hops, E uses whatever is nearby. Right-drag or Q/X turns the camera; scroll zooms.'),
          h('p', h('b', 'Controller: '), 'A casts and reels, X uses, B backs out, Y opens your inventory. The d-pad moves through menus.'))));
    } else if (cur === 'access') {
      const ui = Math.round((s.uiScale || 1) * 100), tx = Math.round((s.textScale || 1) * 100);
      const scaleRow = (key, label, desc, v, min, max) => { const val = h('span.val', `${v}%`); return row(label, desc, h('span.set-range', h('input', { type: 'range', min, max, step: 5, value: v, style: { '--fill': `${((v - min) / (max - min)) * 100}%` }, 'aria-label': label, on: { input: (e) => { e.target.style.setProperty('--fill', `${((e.target.value - min) / (max - min)) * 100}%`); val.textContent = `${e.target.value}%`; save({ [key]: e.target.value / 100 }); } } }), val)); };
      B.append(h('div.set-group', h('h3', 'Reading'),
        scaleRow('textScale', 'Text size', 'Makes the words in menus and the HUD bigger without changing the layout.', tx, 90, 150),
        scaleRow('uiScale', 'Interface size', 'Scales the whole interface.', ui, 80, 140)),
        h('div.set-group', h('h3', 'Seeing and hearing'),
          toggle('colorBlind', 'Colour-blind markers', 'Adds a shape next to every rarity colour (● ▲ ◆ ★ ♛ ✦).'),
          toggle('captions', 'Sound captions', 'Shows a short line for important sounds: bites, the bell, thunder.', false, (e) => { save({ captions: e.target.checked }); g.ui.captions.on = e.target.checked; }),
          toggle('reducedMotion', 'Reduced motion', 'Calms camera shake, pop-ups and animated menus.')));
    } else if (cur === 'play') {
      B.append(h('div.set-group', h('h3', 'Fishing'),
        toggle('relaxedReel', 'Relaxed reel', 'Skips the Tug & Turn mini-game: hold to reel and the fish comes in.'),
        toggle('tips', 'Tips from Gus', 'Short hints while you learn the ropes.', true),
        toggle('realWeather', 'Use my real weather', 'Matches the lake’s weather to yours. Asks for your location, rounds it to about 10 km and doesn’t save it.', false, async (e) => { if (e.target.checked) { const ok = await g.realWeather.enable(); save({ realWeather: ok }); if (!ok) e.target.checked = false; } else { g.realWeather.disable(); save({ realWeather: false }); } })),
        h('div.set-group', h('h3', 'Other anglers'),
          toggle('showNames', "Show other players' names"),
          toggle('showFeed', 'Show the catch feed', 'Great catches from around the lake, bottom left.'),
          toggle('chatBubbles', 'Chat bubbles over heads', '', true),
          toggle('chatFilter', 'Filter strong language', '', true),
          row('Muted anglers', `${g.chat?.muted.size || 0} muted. Click a name in chat to mute or unmute.`, h('button.btn.ghost.small', { type: 'button', on: { click: (e) => { e.preventDefault(); g.chat?.command('/unmute all'); this.render(); } } }, 'Unmute all'))));
    } else if (cur === 'account') {
      const nameIn = h('input.field', { value: p.name, maxLength: 20, 'aria-label': 'Angler name', on: { change: (e) => g.setName(e.target.value) } });
      B.append(h('div.set-group', h('h3', 'Angler'),
        h('div.list-row', h('img', { src: avatarThumb(p.avatar), style: { width: '44px', height: '44px' } }), h('div.grow', h('div.ttl', p.name), h('div.meta', g.net?.kind === 'room' ? 'Your progress saves to this lake.' : 'Progress saves on this device.')),
          h('button.btn.small', { on: { click: () => { this.close(); g.openCreator(); } } }, icon('shirt'), 'Edit look')),
        h('div.set-name-row', nameIn)),
        h('div.set-group', h('h3', 'About'), h('div.muted', `Reel Time · ${g.net?.kind === 'local' ? 'Local lake (tabs on this device)' : g.net?.kind === 'room' ? 'Shared lake (everyone viewing this page)' : 'Offline'} · Now playing: ${g.audio.trackName || 'nothing'}`)));
    }
    this.revertBtn = h('button.btn.ghost.on-dark', { disabled: true, on: { click: () => { if (this.settingsSnap) { g.saveSettings(JSON.parse(JSON.stringify(this.settingsSnap))); g.ui.captions.on = !!this.settingsSnap.captions; this.render(); } } } }, icon('undo'), 'Revert changes');
    c.foot.append(this.revertBtn, h('button.btn.primary', { on: { click: () => { this.game.audio.sfx('close'); this.close(); } } }, icon('check'), 'Done'));
    this.updateRevert();
  }

  updateRevert() {
    if (!this.revertBtn || !this.settingsSnap) return;
    const now = this.game.profile.settings;
    this.revertBtn.disabled = Object.keys({ ...now, ...this.settingsSnap }).every((k) => JSON.stringify(now[k]) === JSON.stringify(this.settingsSnap[k]));
  }
}
