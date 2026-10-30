// Open Waters: Marlowe's tackle locker. Every charter comes with his big-game rods and reels (rented, a 3,000 lb line,
// nothing to buy). To keep: the Big Game Rod (a stronger line out here, a little faster in a fight, and the heaviest
// rod in the valley too), a Trolling Skirt lure (fish while the boat runs between spots) and a Fighting Harness (your
// arms tire much more slowly).
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

export const RENTAL_LB = 3000, BIGROD_LB = 3600;
export const TACKLE = [
  { id: 'rod_biggame', kind: 'item', name: 'Big Game Rod', price: 18000, what: `A 3,600 lb line at sea (the rental is ${RENTAL_LB.toLocaleString()}), fights 12% quicker, and lands 200 lb fish in the valley.` },
  { id: 'lure_troll', kind: 'item', name: 'Trolling Skirt', price: 2500, what: 'Keep fishing while the boat runs between spots. Trolled baits draw strikes almost as fast as anchored ones.' },
  { id: 'harness', kind: 'gear', name: 'Fighting Harness', price: 6000, what: 'Takes the fish on your back, not your arms: they tire a third as fast, in the chair or at the rail.' },
];
/** Pure: what your gear does in a big fight. */
export function fightGear(equippedRod, gear = {}) {
  return { lineLb: equippedRod === 'rod_biggame' ? BIGROD_LB : RENTAL_LB, paceK: equippedRod === 'rod_biggame' ? 1.12 : 1, armsK: gear.harness ? 0.35 : 1 };
}
/** Pure: how much slower bites come while the boat is running (lines up, unless you troll). */
export const runningBiteMult = (lure) => (lure === 'lure_troll' ? 1.15 : null);

export class Tackle {
  constructor(game, ow) { this.game = game; this.ow = ow; }
  owns(t) { const g = this.game; return t.kind === 'item' ? g.profile.owned.includes(t.id) : !!g.ext.d.ocean?.gear?.[t.id]; }
  get trolling() { return this.game.profile.equipped.lure === 'lure_troll'; }
  fight() { return fightGear(this.game.profile.equipped.rod, this.game.ext.d.ocean?.gear); }
  async buy(t) {
    const g = this.game;
    if (this.owns(t)) return;
    if (g.profile.level < 20) { g.ui.toast('Marlowe only sells to anglers who can sail (level 20).', { icon: 'lock' }); return; }
    if (g.profile.coins < t.price) { g.ui.toast(`${t.name} is ${t.price.toLocaleString()} coins.`, { icon: 'coin' }); return; }
    const r = await g.save.spend('tackle', `${t.id}${Date.now()}`, { coins: t.price });
    if (!r?.ok) { g.ui.toast(r?.reason || 'Not enough coins.', { icon: 'coin' }); return; }
    if (t.kind === 'item') await g.save.grant('tackle', t.id, { item: t.id });
    else g.ext.change((d) => { d.ocean.gear = { ...(d.ocean.gear || {}), [t.id]: Date.now() }; });
    g.audio.sfx('coin');
    g.ui.refresh?.();
    g.ui.toast(t.kind === 'item' ? `${t.name} is yours. Equip it from your Tackle Box.` : `${t.name} is yours. Marlowe buckles you in whenever a big one's on.`, { icon: 'rod', ms: 5000 });
    this.card();
  }
  card() {
    const g = this.game;
    const rows = TACKLE.map((t) => {
      const own = this.owns(t);
      return h('div.ow-role.ow-tackle', h('div.grow', h('b', t.name), h('small', t.what)),
        own ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Owned') : h('button.btn.gold.small', { disabled: g.profile.coins < t.price, on: { click: () => this.buy(t) } }, icon('coin'), t.price.toLocaleString()));
    });
    this.ow.ui.openModal('ow-tacklecard', h('div.ow-head', h('span.ow-badge', icon('rod')), h('div', h('b', "Marlowe's tackle locker"), h('span', `Every charter comes with my rods and reels: a ${RENTAL_LB.toLocaleString()} lb line, no charge.`))),
      h('div.ow-tackles', rows), h('p.ow-note', `You have ${g.profile.coins.toLocaleString()} coins.`));
  }
}
