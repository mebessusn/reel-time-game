// The goal ladder: one clear next thing to do, from your first fish to your first collection.
// Shown under the top-left chips; tap it to claim when it's done.
export const GOALS = [
  { id: 'catch5', text: 'Catch 5 fish', have: (g) => g.profile.catchCount || 0, n: 5, reward: { coins: 30, xp: 20 } },
  { id: 'sell', text: 'Sell a fish to Gus (open your inventory, C)', have: (g) => g.profile.stats.sold || 0, n: 1, reward: { coins: 30, xp: 15 } },
  { id: 'bait', text: 'Buy some bait from Gus', have: (g) => g.ext.d.stats.baitBought || 0, n: 1, reward: { coins: 40, xp: 20 } },
  { id: 'baitcatch', text: 'Catch a fish using bait', have: (g) => g.ext.d.stats.baitCatches || 0, n: 1, reward: { coins: 40, xp: 25 } },
  { id: 'level3', text: 'Reach level 3', have: (g) => g.profile.level, n: 3, reward: { coins: 60, xp: 0 } },
  { id: 'boat', text: 'Launch a boat (the rack by the beach, or the dock)', have: (g) => g.profile.stats.boatLaunches || 0, n: 1, reward: { coins: 50, xp: 30 } },
  { id: 'frost', text: 'Walk the trail to Frostpine Lake and light its waystone', have: (g) => (g.ext.d.waystones.includes('frost') ? 1 : 0), n: 1, reward: { coins: 70, xp: 40 } },
  { id: 'request', text: 'Finish a request from the notice board (B)', have: (g) => g.ext.d.stats.questsDone || 0, n: 1, reward: { coins: 60, xp: 40 } },
  { id: 'gear', text: 'Empty a crab pot or set line', have: (g) => g.ext.d.stats.gearCatches || 0, n: 1, reward: { coins: 80, xp: 40 } },
  { id: 'decor', text: 'Decorate your cabin (H)', have: (g) => g.ext.d.home.decor.length, n: 1, reward: { coins: 60, xp: 30 } },
  { id: 'rare', text: 'Land a rare fish', have: (g) => g.profile.stats.species_rare || 0, n: 1, reward: { coins: 100, pearls: 1, xp: 60 } },
  { id: 'collection', text: 'Complete a lake collection (Fishpedia, F)', have: (g) => Object.keys(g.ext.d.collections).length, n: 1, reward: { coins: 150, pearls: 3, xp: 100 } },
];

export class Ladder {
  constructor(game) { this.game = game; }
  get claimed() { return this.game.ext.d.ladder || 0; }
  current() {
    const goal = GOALS[this.claimed];
    if (!goal) return null;
    const have = Math.min(goal.n, goal.have(this.game) || 0);
    return { ...goal, have, done: have >= goal.n, index: this.claimed };
  }
  async claim() {
    const c = this.current();
    if (!c || !c.done || this.busy) return;
    this.busy = true;
    const r = await this.game.reward('goal', c.id, c.reward, `Goal: ${c.text}`);
    if (r?.ok !== false) this.game.ext.change((d) => { d.ladder = (d.ladder || 0) + 1; });
    else if (/Already/.test(r?.reason || '')) this.game.ext.change((d) => { d.ladder = (d.ladder || 0) + 1; });
    this.busy = false;
  }
}
