// Game feel: hit-stop, camera shake and zoom pulses, big pop-up words, catch streaks.
import { h } from '../ui/dom.js';

export class Juice {
  constructor(game) {
    this.game = game;
    this.stop = 0; // seconds of hit-stop left (real time)
    this.streak = 0;
    this.best = 0;
  }

  /** Scale the frame's dt: almost frozen during a hit-stop. */
  scale(dt) {
    if (this.stop <= 0) return dt;
    this.stop -= dt;
    return dt * 0.06;
  }

  hit({ stop = 0.08, shake = 0.4, zoom = 0.9 } = {}) {
    const reduced = this.game.profile?.settings?.reducedMotion;
    this.stop = Math.max(this.stop, stop);
    if (!reduced) this.game.engine.shake = Math.max(this.game.engine.shake || 0, shake);
    this.game.engine.cam.pulse = Math.min(this.game.engine.cam.pulse ?? 1, reduced ? 1 : zoom);
  }

  /** A big word that pops in the middle of the screen. */
  pop(text, { color = '#fff4d8', size = 34, ms = 900, cls = '' } = {}) {
    const el = h(`div.pop-word${cls ? `.${cls}` : ''}`, { style: { color, fontSize: `${size}px` } }, text);
    this.game.ui.root.append(el);
    setTimeout(() => el.remove(), ms);
    return el;
  }

  // ---- streaks: consecutive fish landed without one getting away
  landed() {
    this.streak++;
    this.best = Math.max(this.best, this.streak);
    const g = this.game;
    if (this.streak >= 3) {
      g.ui.setStreak?.(this.streak);
      if (this.streak % 3 === 0) {
        this.pop(`${this.streak} in a row!`, { color: '#ffb040', size: 28, cls: 'streak' });
        const coins = Math.min(30, 5 * (this.streak / 3) + 5);
        g.reward('streak', `s${Date.now()}`, { coins, xp: 10 }, `Streak ×${this.streak}`);
      }
    }
    g.ext?.change((d) => { d.stats.bestStreak = Math.max(d.stats.bestStreak || 0, this.streak); });
  }
  broke() {
    if (this.streak >= 3) this.game.ui.toast(`Streak over at ${this.streak}. Go again!`, { ms: 2200 });
    this.streak = 0;
    this.game.ui.setStreak?.(0);
  }
}
