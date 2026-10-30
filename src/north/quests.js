// Frostmere: the five quest lines (journal: the North tab, src/north/ui.js).
//   1. North of Everything (Astrid): arriving, the first hole, the first fish, the sauna.
//   2. The Old Man and the Ice (Old Torvald): the flasher, tip-ups, the ridge, lake trout, a shanty, the Glacier King.
//   3. Mush! (June): feed the dogs, drive a sled, a ride to the Floe Edge, the Sled Derby, beating June.
//   4. Lights in the Sky (Dr. Ingrid Vale): bears, cubs, the aurora from Aurora Hill, a log page, Old Whitepaw, the
//      Aurora Char.
//   5. The Valiant's Log (Grandma Elsi): the five lost pages of Captain Hale's log.
// Every step listens for one kind of event (Frostmere.onEvent): when it happens the step ticks over, with a toast.
// Lines 2-5 start when you talk to the one who gives them; line 1 starts when you land.
import { SPECIES_BY_ID } from '../data/species.js';
import { toLocal, P } from './geo.js';

const S = (text, on, n = 1) => ({ text, on, n });
const isNorth = (d) => !!d.sp?.north;
export const LINES = [
  { id: 'arrive', name: 'North of Everything', giver: 'astrid', auto: true,
    intro: 'Welcome to Hearthwick! First things first: you can\'t fish up here without a hole in the ice.',
    steps: [
      S('Fly north to Frostmere with Skye', (k) => k === 'arrive'),
      S('Meet Astrid at the Hearth Lodge', (k, d) => k === 'talk' && d.who === 'astrid'),
      S('Get an auger from Pell at the trading post', (k, d) => k === 'auger' || (k === 'buy' && /auger/.test(d.k))),
      S('Drill your first hole on the bay', (k) => k === 'drill'),
      S('Catch a fish through the ice', (k, d) => k === 'catch' && isNorth(d) && d.ice),
      S('Warm up in the sauna by the shore', (k) => k === 'sauna'),
    ],
    reward: { coins: 400, xp: 300, item: 'hat_earflap' }, rewardText: 'the Earflap Hat and 400 coins' },
  { id: 'torvald', name: 'The Old Man and the Ice', giver: 'torvald',
    intro: 'Sixty winters on this ice and I\'ll teach you what I know. Patience first. The rest follows.',
    steps: [
      S('Read the flasher: buy one from Pell', (k, d) => (k === 'buy' && d.k === 'flasher') || k === 'hasflasher'),
      S('Set a tip-up in one of your holes', (k) => k === 'tipupSet'),
      S('Land a fish from a tip-up flag', (k, d) => k === 'catch' && d.tipup),
      S('Fish along the Pressure Ridge (careful: thin ice)', (k, d) => k === 'catch' && d.c?.zone === 'ridge'),
      S('Catch a lake trout', (k, d) => k === 'catch' && d.c?.speciesId === 'laketrout'),
      S('Rent a shanty on the bay', (k) => k === 'shanty'),
      S('Catch the Glacier King (under the ridge, in a snowstorm)', (k, d) => k === 'catch' && d.c?.speciesId === 'glacierking'),
    ],
    reward: { coins: 1500, xp: 1200, pearls: 15, title: 'Ice King' }, rewardText: 'a Power Auger, 1,500 coins, 15 pearls and the title Ice King', gear: 'auger_power' },
  { id: 'june', name: 'Mush!', giver: 'june',
    intro: 'Want to learn to drive a team? The dogs will tell you if you\'re any good. Start by making friends: they love fish.',
    steps: [
      S('Feed the dogs: give June a fish', (k) => k === 'feeddogs'),
      S('Take a sled out from the kennels', (k, d) => k === 'sled' && d.mode === 'drive'),
      S('Hire a ride to the Floe Edge', (k, d) => k === 'hire' && d.route === 'floe'),
      S('Finish the Frostmere Sled Derby', (k) => k === 'derby'),
      S('Beat June\'s time in the Derby (48 s)', (k, d) => k === 'derby' && d.won),
    ],
    reward: { coins: 1000, xp: 800, pearls: 8, item: 'shirt_musher' }, rewardText: 'the Musher\'s Bib, 1,000 coins and 8 pearls' },
  { id: 'ingrid', name: 'Lights in the Sky', giver: 'ingrid',
    intro: 'I could use a field assistant. Bears and lights: the two most beautiful things in the north, and the two hardest to find.',
    steps: [
      S('Photograph a polar bear', (k, d) => k === 'photo' && d.id === 'bear'),
      S('Visit the Floe Edge', (k) => k === 'floe'),
      S('Photograph the bear cubs at Bear Point', (k, d) => k === 'photo' && d.id === 'cubs'),
      S('Watch the aurora from Aurora Hill', (k) => k === 'aurorahill'),
      S('Find a page of the Valiant\'s log', (k) => k === 'page'),
      S('See Old Whitepaw at Bear Point on an aurora night', (k, d) => k === 'legend' && d.id === 'whitepaw'),
      S('Catch the Aurora Char in Steamhole Springs', (k, d) => k === 'catch' && d.c?.speciesId === 'aurorachar'),
    ],
    reward: { coins: 2000, xp: 1500, pearls: 20, item: 'acc_aurora_scarf', title: 'Northern Light' }, rewardText: 'the Aurora Scarf, 2,000 coins, 20 pearls and the title Northern Light' },
  { id: 'elsi', name: 'The Valiant\'s Log', giver: 'elsi',
    intro: 'My grandmother\'s captain kept a log, and the wind took it page by page. Five pages, scattered by the old places. Bring them home, dear.',
    steps: [S('Find the five pages of the Valiant\'s log', (k) => k === 'page', 5)],
    reward: { coins: 1200, xp: 900, pearls: 12, title: 'Keeper of the Log' }, rewardText: '1,200 coins, 12 pearls and the title Keeper of the Log' },
];
export const LINE_BY_ID = Object.fromEntries(LINES.map((l) => [l.id, l]));

export class NorthQuests {
  constructor(north) { this.north = north; this.game = north.game; }
  get q() { return this.north.d.quests || {}; }
  state(id) { return this.q[id] || null; }
  change(fn) { this.game.ext.change((d) => { d.north.quests = d.north.quests || {}; fn(d.north.quests); }); }
  start(id) {
    if (this.state(id)) return;
    this.change((q) => { q[id] = { step: 0, have: 0, done: false, claimed: false, at: Date.now() }; });
    const L = LINE_BY_ID[id];
    this.game.ui.toast(`New quest: ${L.name}. ${L.steps[0].text}.`, { title: 'Frostmere', icon: 'scroll', ms: 5500 });
    this.catchUp(id);
  }
  /** Steps you've already done before the quest started (you own a flasher, you've got pages...). */
  catchUp(id) {
    const N = this.north, d = N.d;
    if (id === 'torvald' && d.gear?.flasher) this.event('hasflasher');
    if (id === 'elsi') { const n = Object.keys(d.pages || {}).length; for (let i = 0; i < n; i++) this.event('page', {}, id); }
    if (id === 'arrive') this.event('arrive', {}, id);
  }
  /** Something happened up here: move every quest it fits. */
  event(kind, data = {}, only = null) {
    const g = this.game;
    // the catch carries where and how
    if (kind === 'catch') data = { ...data, ice: !!g.fishing.lastIce, tipup: !!g.fishing.lastTipup };
    for (const L of LINES) {
      if (only && L.id !== only) continue;
      const st = this.state(L.id);
      if (!st || st.done) continue;
      const step = L.steps[st.step];
      if (!step || !step.on(kind, data)) continue;
      const have = (st.have || 0) + 1;
      if (have < step.n) { this.change((q) => { q[L.id].have = have; }); g.ui.toast(`${L.name}: ${step.text} (${have}/${step.n})`, { icon: 'scroll', ms: 3000 }); continue; }
      const next = st.step + 1, done = next >= L.steps.length;
      this.change((q) => { q[L.id].step = next; q[L.id].have = 0; q[L.id].done = done; });
      g.audio.sfx(done ? 'achievement' : 'page');
      if (done) g.ui.toast(`${L.name}: complete! See ${L.giver === 'astrid' ? 'Astrid' : L.giver === 'torvald' ? 'Old Torvald' : L.giver === 'june' ? 'June' : L.giver === 'ingrid' ? 'Dr. Vale' : 'Grandma Elsi'} for your reward (or claim it in your journal).`, { title: 'Quest complete', icon: 'star', ms: 6000 });
      else g.ui.toast(`${step.text}: done! Next: ${L.steps[next].text}.`, { title: L.name, icon: 'scroll', ms: 4500 });
    }
  }
  async claim(id) {
    const g = this.game, L = LINE_BY_ID[id], st = this.state(id);
    if (!st?.done || st.claimed) return;
    this.change((q) => { q[id].claimed = Date.now(); });
    if (L.gear) g.ext.change((d) => { d.north.gear = { ...(d.north.gear || {}), [L.gear]: 1 }; });
    await g.reward('north', `quest-${id}`, L.reward, L.name);
    if (L.reward.item) g.ui.toast('Your new outfit is in the wardrobe: change into it any time.', { icon: 'star', ms: 4000 });
  }
  /** Each second or so: places you've been (the Floe Edge, Aurora Hill under the lights). */
  tick() {
    const p = this.game.player.pos, [u, v] = toLocal(p.x, p.z);
    if (!this.north.here) return;
    if (Math.hypot(u - P.floe.u, v - P.floe.v) < 60 || v < -240) this.event('floe');
    if (this.north.sky?.auroraOn && Math.hypot(u - P.aurorahill.u, v - P.aurorahill.v) < 25) this.event('aurorahill');
  }
  /** What a giver says about their quest, and the choice to start or claim it. */
  talkChoices(n) {
    const L = LINES.find((x) => x.giver === n.talk);
    if (!L) return [];
    const st = this.state(L.id);
    if (!st && !L.auto) return [{ label: `Any work for me? (${L.name})`, primary: true, fn: () => setTimeout(() => this.offer(n, L), 150) }];
    if (st?.done && !st.claimed) return [{ label: `I've done it! (${L.name})`, primary: true, fn: () => setTimeout(() => this.claim(L.id), 150) }];
    return [];
  }
  offer(n, L) {
    const g = this.game;
    g.dialogue.open({ npc: n, title: n.title, text: `${L.intro} Reward: ${L.rewardText}.`, choices: [{ label: 'I\'m in!', primary: true, fn: () => this.start(L.id) }, { label: 'Maybe later' }] });
  }
}
export { SPECIES_BY_ID };
