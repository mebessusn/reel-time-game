// Gus's guided first catch: a few short steps that take a new angler from the shop to their first
// fish in about three minutes. Skippable; never shown again once done or skipped.
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import { DOCK } from '../world/terrain.js';

const STEPS = [
  { id: 'walk', say: "Welcome to Cozy Cove! I'm Gus. Let's catch your first fish. Walk out onto the dock: WASD, or click the boards.", done: (g) => g.player.onDock && g.player.pos.z < DOCK.z1 - 4 },
  { id: 'cast', say: 'Lovely. Now face the water, HOLD the left mouse button to charge, and let go to cast. A long cast lands when the bar is near full.', done: (g) => ['flying', 'waiting', 'nibble', 'bite', 'reeling'].includes(g.fishing.state) },
  { id: 'wait', say: 'Now we wait. Watch the bobber. When it dips and a "!" pops up over your head, CLICK fast to hook it.', done: (g) => g.fishing.state === 'reeling', back: (g) => g.fishing.state === 'idle' ? 'cast' : null },
  { id: 'fight', say: "Fish on! HOLD to reel. Move the mouse the OPPOSITE way the fish pulls (the arrows show which way). If the dial goes red or it leaps, LET GO.", done: (g) => g.fishing.state === 'landed' || !!g.ui.revealCard?.isConnected, back: (g) => g.fishing.state === 'idle' && !g.ui.revealCard?.isConnected ? 'cast' : null },
  { id: 'keep', say: 'Beautiful! Keep it, and it goes in your backpack. Press C (or the backpack button) to look inside.', done: (g) => g.ui.sheets.current?.name === 'creel' },
  { id: 'end', say: "That's all there is to it. Sell fish to me at the cabin, buy bait and gear, and check the notice board (B) for requests. Here's 50 coins to start. Tight lines!", done: () => false, final: true },
];

export class Tutorial {
  constructor(game) { this.game = game; this.el = null; }
  get d() { return this.game.ext.d.tutorial; }
  get active() { return !!this.el; }

  maybeStart() {
    const g = this.game;
    if (this.d.done || (g.profile.catchCount || 0) > 0 || new URLSearchParams(location.search).has('notutorial')) return false;
    this.start();
    return true;
  }

  start() {
    this.i = 0;
    this.el = h('div.tutorial.paper', { role: 'dialog', 'aria-label': 'Tutorial' });
    this.game.ui.root.append(this.el);
    this.render();
  }

  render() {
    const s = STEPS[this.i];
    clear(this.el).append(
      h('div.tut-head', icon('bell'), h('b', 'Gus'), h('span.tut-step', `${this.i + 1}/${STEPS.length}`)),
      h('div.tut-text', s.say),
      h('div.tut-actions', s.final
        ? h('button.btn.green.small', { on: { click: () => this.finish(true) } }, 'Thanks, Gus!')
        : h('button.btn.ghost.small', { on: { click: () => this.finish(false) } }, 'Skip tutorial')));
  }

  update() {
    if (!this.el) return;
    const g = this.game, s = STEPS[this.i];
    const back = s.back?.(g);
    if (back) { this.i = STEPS.findIndex((x) => x.id === back); this.render(); return; }
    if (s.done(g)) { this.i++; g.audio.sfx('page'); this.render(); }
  }

  async finish(completed) {
    this.el?.remove();
    this.el = null;
    this.game.ext.change((d) => { d.tutorial = { done: true, completed, at: Date.now() }; });
    if (completed) await this.game.reward('tutorial', 'first', { coins: 50, xp: 20 }, 'Tutorial');
  }
}
