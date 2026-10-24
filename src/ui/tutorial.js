// Gus's guided tour (v1.14.10): on a brand-new game a welcome card asks whether you'd like to be shown around (about
// three minutes) or skip it. Then short steps, one at a time, from looking around to your first fish, your backpack,
// the map and the journal. The HUD button a step talks about glows; the dock gets a beam of light to walk to.
// Skippable at any step; replay it from the menu (Menu > Replay the tutorial).
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import { DOCK } from '../world/terrain.js';

const FISHING = ['flying', 'waiting', 'nibble', 'bite', 'reeling'];
const STEPS = [
  { id: 'look', say: 'Welcome to Cozy Cove! I\'m Gus. First, have a look around: drag with the RIGHT mouse button (or two fingers) to turn the camera, and scroll to zoom.', done: (g, t) => Math.abs(g.engine.cam.yaw - t.yaw0) > 0.5 || Math.abs(g.engine.cam.zoom - t.zoom0) > 0.2 },
  { id: 'walk', say: 'Now walk out onto my dock, where the light is shining: WASD, or click the boards to walk there.', beam: true, done: (g) => g.player.onDock && g.player.pos.z < DOCK.z1 - 4 },
  { id: 'cast', say: 'Lovely. Face the water, HOLD the left mouse button to charge, and let go to cast. A long cast lands when the bar is near full.', done: (g) => FISHING.includes(g.fishing.state) },
  { id: 'wait', say: 'Now we wait. Watch the bobber. When it dips and a "!" pops up over your head, CLICK fast to hook it.', done: (g) => g.fishing.state === 'reeling', back: (g) => (g.fishing.state === 'idle' ? 'cast' : null) },
  { id: 'fight', say: 'Fish on! HOLD to reel. Move the mouse the OPPOSITE way the fish pulls (the arrows show which way). If the dial goes red or it leaps, LET GO.', done: (g) => g.fishing.state === 'landed' || !!g.ui.revealCard?.isConnected, back: (g) => (g.fishing.state === 'idle' && !g.ui.revealCard?.isConnected ? 'cast' : null) },
  { id: 'keep', say: 'Beautiful! Keep it, and it goes in your backpack.', done: (g) => !g.ui.revealCard?.isConnected && g.fishing.state === 'idle' },
  { id: 'creel', say: 'Open your backpack: press C, or the glowing button. Everything you keep is in here, and you can sell it at my counter.', glow: 'creel', done: (g) => g.ui.sheets.current?.name === 'creel' },
  { id: 'map', say: 'Now the map: press M, or the glowing button. The lakes, shops and every place you find go on it. Right-click it to drop a waypoint.', glow: 'map', done: (g) => g.ui.sheets.current?.name === 'map' },
  { id: 'journal', say: 'Last one: your Journal (J). Quests, collections and the woods\' Field Guide live here.', glow: 'journal', done: (g) => g.ui.sheets.current?.name === 'journal' },
  { id: 'end', say: 'That\'s all there is to it! Buy bait and gear at my counter, check the notice board (B) for requests, and explore the woods between the lakes. Here\'s 50 coins to start. Tight lines!', final: true, done: () => false },
];

export class Tutorial {
  constructor(game) { this.game = game; this.el = null; }
  get d() { return this.game.ext.d.tutorial; }
  get active() { return !!this.el; }

  maybeStart() {
    const g = this.game;
    if (this.d.done || (g.profile.catchCount || 0) > 0 || new URLSearchParams(location.search).has('notutorial')) return false;
    if (new URLSearchParams(location.search).has('autoplay')) this.start(); // (dev and browser tests: straight to the steps, nothing in the middle of the screen)
    else this.welcome();
    return true;
  }

  /** The first card: show me around, or skip. */
  welcome() {
    const g = this.game;
    this.el = h('div.tut-welcome.paper', { role: 'dialog', 'aria-label': 'Welcome' },
      h('div.tut-w-badge', icon('fish')),
      h('h2', 'Welcome to Reel Time!'),
      h('p', 'Gus can show you the ropes: how to look around, cast, hook and reel in your first fish, and where everything is. It takes about three minutes.'),
      h('div.tut-w-acts',
        h('button.btn.green', { on: { click: () => { this.el.remove(); this.start(); } } }, icon('play'), 'Show me around'),
        h('button.btn.ghost', { on: { click: () => this.finish(false) } }, 'Skip, I know how to fish')));
    g.ui.root.append(this.el);
  }

  /** From the menu: run it again (no reward the second time). */
  replay() {
    this.clear();
    this.again = !!this.d?.completed;
    this.start();
  }

  start() {
    const g = this.game;
    this.i = 0;
    this.yaw0 = g.engine.cam.yaw; this.zoom0 = g.engine.cam.zoom;
    this.el = h('div.tutorial.paper', { role: 'dialog', 'aria-label': 'Tutorial' });
    g.ui.root.append(this.el);
    this.render();
  }

  render() {
    const g = this.game, s = STEPS[this.i];
    const dots = h('div.tut-dots', STEPS.map((x, k) => h(`span${k < this.i ? '.done' : k === this.i ? '.on' : ''}`)));
    clear(this.el).append(
      h('div.tut-head', icon('bell'), h('b', 'Gus'), h('span.tut-step', `${this.i + 1}/${STEPS.length}`)),
      h('div.tut-text', s.say), dots,
      h('div.tut-actions', s.final
        ? h('button.btn.green.small', { on: { click: () => this.finish(true) } }, 'Thanks, Gus!')
        : h('button.btn.ghost.small', { on: { click: () => this.finish(false) } }, 'Skip tutorial')));
    // the button this step is about glows; the dock gets a beam of light
    document.querySelectorAll('.tut-glow').forEach((b) => b.classList.remove('tut-glow'));
    if (s.glow) document.querySelector(`.hotbar [data-act="${s.glow}"]`)?.classList.add('tut-glow');
    g.waypoint?.tutorialBeam?.(s.beam ? { x: (DOCK.x0 + DOCK.x1) / 2, z: DOCK.z1 - 7 } : null);
  }

  update() {
    if (!this.el || this.i == null || !this.el.classList.contains('tutorial')) return;
    const g = this.game, s = STEPS[this.i];
    const back = s.back?.(g);
    if (back) { this.i = STEPS.findIndex((x) => x.id === back); this.render(); return; }
    if (s.done(g, this)) { this.i++; g.audio.sfx('page'); this.render(); }
  }

  clear() {
    this.el?.remove(); this.el = null; this.i = null;
    document.querySelectorAll('.tut-glow').forEach((b) => b.classList.remove('tut-glow'));
    this.game.waypoint?.tutorialBeam?.(null);
  }

  async finish(completed) {
    this.clear();
    const again = this.again; this.again = false;
    this.game.ext.change((d) => { d.tutorial = { done: true, completed: completed || !!d.tutorial?.completed, at: Date.now() }; });
    if (completed && !again) await this.game.reward('tutorial', 'first', { coins: 50, xp: 20 }, 'Tutorial');
  }
}
