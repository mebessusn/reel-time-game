// Open Waters v1.15.13: your own boat. Once you've been out with Marlowe a few times and he calls you his Mate, he'll
// sell you a sportfisher of your own (40,000 coins). Paint the hull, the stripe and the cushions, name her (the name goes
// on the transom), and fit upgrades: outriggers (quicker bites at anchor), a live well (15% of your catch's worth on
// top at the end of a trip) and twin engines (faster between spots). Taking your own boat out costs nothing, for you or
// your crew, so you go when you like. Marlowe still comes along at the wheel: he wouldn't miss it.
// The boat's look rides in the charter's state (c.bt), so the crew see the same boat.
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { PAINTS } from './charterBoat.js';
import { OWN_BOAT, UPGRADES, canBuyBoat, boatName, boatLook } from './voyageData.js';

export class OwnBoat {
  constructor(game, ow) { this.game = game; this.ow = ow; }
  get b() { return this.game.ext.d.ocean?.boat || null; }
  get owned() { return !!this.b?.owned; }
  look() { return boatLook(this.b); }

  async buy() {
    const g = this.game, ow = this.ow;
    const can = canBuyBoat({ trips: ow.d.trips || 0, rank: ow.trust().i, coins: g.profile.coins, owned: this.owned });
    if (!can.ok) { g.ui.toast(can.why, { icon: 'lock' }); return; }
    const r = await g.save.spend('boat', `boat${Date.now()}`, { coins: OWN_BOAT.price });
    if (!r?.ok) { g.ui.toast(r?.reason || 'Not enough coins.', { icon: 'coin' }); return; }
    g.ext.change((d) => { d.ocean.boat = { owned: Date.now(), hull: 0, stripe: 0, trim: 0, name: 'Sea Biscuit', up: {} }; });
    g.audio.sfx('achievement');
    g.ui.refresh?.();
    g.chat.npcSay?.('Captain Marlowe', 'She\'s yours! Give her a name and a lick of paint. When you book, tick "Take my boat" and the trip\'s free. I\'ll still take the wheel, mind.');
    this.card();
  }
  async upgrade(u) {
    const g = this.game;
    if (this.b?.up?.[u.id]) return;
    if (g.profile.coins < u.price) { g.ui.toast(`${u.name} is ${u.price.toLocaleString()} coins.`, { icon: 'coin' }); return; }
    const r = await g.save.spend('boatup', `${u.id}${Date.now()}`, { coins: u.price });
    if (!r?.ok) { g.ui.toast(r?.reason || 'Not enough coins.', { icon: 'coin' }); return; }
    g.ext.change((d) => { d.ocean.boat.up = { ...(d.ocean.boat.up || {}), [u.id]: Date.now() }; });
    g.audio.sfx('coin');
    g.ui.refresh?.();
    g.ui.toast(`${u.name} fitted!`, { icon: 'anchor' });
    this.card();
  }
  set(k, v) {
    this.game.ext.change((d) => { d.ocean.boat[k] = v; });
    if (this.ow.charter?.bt && this.ow.charter.ld === this.game.save.userId) { /* (the look changes on the next trip) */ }
  }

  card() {
    const g = this.game, ow = this.ow, ui = ow.ui, B = this.b;
    if (!this.owned) {
      const can = canBuyBoat({ trips: ow.d.trips || 0, rank: ow.trust().i, coins: g.profile.coins });
      ui.openModal('ow-boat',
        h('div.ow-head', h('span.ow-badge', icon('boat')), h('div', h('b', 'A boat of your own'), h('span', 'A 46-foot sportfisher, like Marlowe\'s'))),
        h('p.ow-note', `Paint her and name her, fit outriggers, a live well and twin engines, and take her out whenever you like: trips on your own boat are free for you and your crew. ${OWN_BOAT.price.toLocaleString()} coins.`),
        h('p.ow-fee', can.ok ? `You have ${g.profile.coins.toLocaleString()} coins.` : can.why),
        h('div.ow-acts',
          h('button.btn.gold', { disabled: !can.ok, on: { click: () => this.buy() } }, icon('coin'), `Buy her (${OWN_BOAT.price.toLocaleString()})`),
          h('button.btn.ghost.on-dark', { on: { click: () => ui.closeModal() } }, 'Not yet')));
      return;
    }
    const sw = (k) => h('div.ow-swatches', PAINTS[k].map((c, i) => h(`button.ow-sw${B[k] === i ? '.on' : ''}`, { style: { background: c }, 'aria-label': `${k} colour ${i + 1}`, on: { click: () => { this.set(k, i); this.card(); } } })));
    const name = h('input.ow-name', { value: B.name || '', maxlength: 18, placeholder: 'Sea Biscuit', on: { change: (e) => { this.set('name', boatName(e.target.value) || 'Sea Biscuit'); } } });
    ui.openModal('ow-boat',
      h('div.ow-head', h('span.ow-badge', icon('boat')), h('div', h('b', B.name || 'Your boat'), h('span', 'Tick "Take my boat" when you book: the trip is free'))),
      h('label.ow-field', h('span', 'Name'), name),
      h('div.ow-field', h('span', 'Hull'), sw('hull')),
      h('div.ow-field', h('span', 'Stripe'), sw('stripe')),
      h('div.ow-field', h('span', 'Cushions'), sw('trim')),
      h('ul.ow-list', UPGRADES.map((u) => h(`li.ow-crew${B.up?.[u.id] ? '' : '.off'}`, h('span.ow-lv', B.up?.[u.id] ? icon('check') : icon('coin')), h('b', u.name), h('small', u.what),
        B.up?.[u.id] ? null : h('button.btn.small.gold', { on: { click: () => this.upgrade(u) } }, u.price.toLocaleString())))),
      h('div.ow-acts', h('button.btn.ghost.on-dark', { on: { click: () => ui.closeModal() } }, 'Done')));
  }
}
