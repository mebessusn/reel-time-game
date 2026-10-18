// Sound captions: short text lines for sounds that matter (a bite, the dock bell, thunder, a loon),
// shown bottom-left when Settings > Accessibility > Sound captions is on.
import { h } from './dom.js';

const TEXT = {
  bite: 'Splash! Something bit', hook: 'Line zips', miss: 'Fish got away', flop: 'Fish flops on the deck', reveal: 'Catch fanfare',
  bell: 'Dock bell rings', thunder: 'Thunder rumbles', remoteGreat: 'Distant chime: a great catch nearby', splashRemote: 'Splash nearby',
  achievement: 'Achievement chime', levelup: 'Level up jingle', coin: 'Coins clink', purchase: 'Coins clink', diamond: 'Crystal chimes',
  cheer: 'Cheering', clap: 'Clapping', whistle: 'Whistle', loon: 'A loon calls across the lake', frog: 'Frogs croak', owl: 'An owl hoots',
  firework: 'Fireworks pop', meteor: 'A shooting star whooshes', derby: 'Derby horn', drip: 'Water drips in the quarry', flap: 'Wings flap: birds take off', honk: 'Geese honk overhead', plop: 'Bobber plops in', whoosh: 'Line whooshes out',
};
// Sounds that repeat a lot get rate-limited
const QUIET = { plop: 2000, whoosh: 2000, coin: 1500, splashRemote: 4000, frog: 15000, loon: 15000, owl: 20000, drip: 20000, cheer: 3000, flap: 6000, honk: 60000 };

export class Captions {
  constructor(root) {
    this.root = root;
    this.el = h('div.captions', { 'aria-live': 'polite' });
    root.append(this.el);
    this.last = {};
    this.on = false;
  }
  show(id) {
    if (!this.on) return;
    const text = TEXT[id];
    if (!text) return;
    const now = performance.now();
    if (now - (this.last[id] || 0) < (QUIET[id] || 900)) return;
    this.last[id] = now;
    const line = h('div.caption', `[${text}]`);
    this.el.append(line);
    while (this.el.children.length > 4) this.el.firstChild.remove();
    setTimeout(() => line.classList.add('fade'), 2600);
    setTimeout(() => line.remove(), 3200);
  }
}
