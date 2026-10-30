// Open Waters v1.15.10: island evenings.
// - The fire pits on Palm Key and Turtle Atoll burn, with log benches round them. Sit on one and "Roast a fish" (the
//   valley's cookout, game/cookout.js); with a crewmate by the same fire, Well Fed lasts half as long again.
// - After dusk Makoa plays the drum by the Palm Key fire, and the music turns to a fireside song while you're near.
// - Turn in at a hut's door after dusk to sleep till dawn: the charter's clock jumps to sunrise (core/clock.js
//   setTimeShift), and the whole crew wakes up together, since the shift rides in the charter's state.
import { defaultAvatar } from '../data/avatarOptions.js';
import { dayFraction, shiftTo, setTimeShift } from '../core/clock.js';
import { TALKS } from './islanders.js';

export const DAWN = 0.235; // where you wake: just after sunrise
const MAKOA = { ...defaultAvatar('male'), skin: 6, frame: 'broad', hair: 'locs', hairColor: 0, facialHair: 'beard', hat: 'flowercrown', shirt: 'hawaiian', shirtColor: 5, pants: 'shorts', pantsColor: 3, shoes: 'sandals', accessory: 'lei', mouth: 'grin', eyes: 'content' };
TALKS.makoa = [
  'Aloha! Every evening I play for the fire. My grandmother carved this drum from a breadfruit log, and it\'s older than the jetty.',
  'Cook a fish on the fire with your crew and it sits better: you stay well fed longer. And if you\'re tired, any hut will take you in till morning.',
];

export class Evenings {
  constructor(game, ow) { this.game = game; this.ow = ow; this.makoa = null; this.t = 0; }
  get evening() { const ph = this.game.engine.sky?.state?.phase; return ph === 'dusk' || ph === 'night'; }

  build() {
    const g = this.game, D = this.ow.islands.drum;
    if (this.makoa || !D || !g.npcs) return;
    this.makoa = g.npcs.add({ id: 'isle-makoa', name: 'Makoa', title: 'Plays the fireside drum', look: MAKOA, kind: 'stand', x: D.at.x, z: D.at.z, yaw: D.yaw, talk: 'makoa',
      hello: ['Pull up a log, {you}!', 'Fire\'s hot, fish is fresh.', 'This one\'s for the sailors.', 'Aloha ahiahi! Good evening!'] });
    if (this.makoa) this.ow.islanders.list.push(this.makoa);
  }

  /** The island fire you're sitting by, if any (a cookout seat), or the nearest within reach. */
  fireNear(p = this.game.player.pos, reach = 6) {
    let best = null, bd = reach;
    for (const f of this.ow.islands.fires || []) { const d = Math.hypot(p.x - f.x, p.z - f.z); if (d < bd) { bd = d; best = f; } }
    return best;
  }
  /** How many crewmates are round the same island fire as you (for the cookout's shared-meal bonus). */
  company() {
    const g = this.game;
    if (!this.ow.atSea) return 0;
    const f = this.fireNear();
    if (!f) return 0;
    let n = 0;
    const id = this.ow.charter?.id;
    for (const r of g.remotes?.list?.values?.() || []) if (r.peer?.meta?.chtr?.id === id && Math.hypot(r.pos.x - f.x, r.pos.z - f.z) < 6) n++;
    return n;
  }
  /** 0..1 how close you are to an island fire (for the crackle). */
  nearFire() {
    if (!this.ow.atSea) return 0;
    const f = this.fireNear(this.game.player.pos, 9);
    return f ? Math.max(0, 1 - Math.hypot(this.game.player.pos.x - f.x, this.game.player.pos.z - f.z) / 9) : 0;
  }
  /** The music's region: by the Palm Key fire while Makoa plays. */
  musicRegion() {
    const D = this.ow.islands.drum;
    if (!D || !this.ow.atSea || !this.evening) return null;
    const p = this.game.player.pos;
    return Math.hypot(p.x - D.fire.x, p.z - D.fire.z) < 16 ? 'Fireside' : null;
  }

  // ---------------------------------------------------------------- sleeping till dawn
  hutDoor(p = this.game.player.pos) { return (this.ow.islands.hutDoors || []).find((d) => Math.hypot(p.x - d.x, p.z - d.z) < 2.4) || null; }
  contextActions() {
    const g = this.game, ow = this.ow;
    if (!ow.charter || !ow.atSea || g.player.mode !== 'shore' || ow.dive.on) return [];
    const d = this.hutDoor();
    if (!d) return [];
    if (!this.evening) return [{ id: 'hutday', label: 'Hut (sleep after dusk)', fn: () => g.ui.toast('The huts are for sleeping. Come back after dusk and turn in till dawn.', { icon: 'moon' }) }];
    return [{ id: 'sleep', label: 'Sleep till dawn', color: 'blue', at: { x: d.x, z: d.z, y: g.player.pos.y, h: 2.2 }, fn: () => this.sleep() }];
  }
  async sleep() {
    const g = this.game, ow = this.ow, c = ow.charter;
    if (!c || !this.evening) return;
    if (ow.fight.active || ow.fight.helping) { g.ui.toast('Not with a fish on! Help land it first.', { icon: 'fish' }); return; }
    if (g.fishing.busy) g.fishing.cancel();
    if (g.chairs.seat) g.chairs.stand();
    ow.games.cancel?.('Everyone\'s turning in for the night.');
    const el = document.createElement('div');
    el.className = 'ow-night-fade';
    el.innerHTML = '<span>z z z</span>';
    g.ui.root.append(el);
    g.audio.sfx('page');
    await new Promise((r) => setTimeout(r, 1300));
    const ts = Math.round((c.ts || 0) + shiftTo(dayFraction(), DAWN));
    Object.assign(c, { ts, v: (c.v || 1) + 1, by: g.save.userId });
    setTimeShift(ts);
    g.ext.bump('hutNights');
    g.pushMeta();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 1400); }, 900);
    g.audio.sfx('gulls');
    g.chat.system('You slept like a log in the hut, and woke to the sun coming up over the water. Bonefish feed on the flats at dawn.', 'info', { popup: true });
  }
  /** A crewmate's newer charter state moved the clock (they slept till dawn, or it's a night charter). */
  adoptShift(c, me) {
    if ((c.ts || 0) === (me.ts || 0)) return;
    me.ts = c.ts || 0;
    setTimeShift(me.ts);
    const who = String(me.names?.[c.by] || 'A crewmate').slice(0, 20);
    if (c.by !== this.game.save.userId) this.game.chat.system(`${who} turned in for the night, and the whole crew slept till dawn.`, 'info');
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0 || !this.makoa) return;
    this.t = 1;
    this.makoa.idlePose = this.evening ? 'drum' : null;
  }
}
