// Tug & Turn: Reel Time's own reeling game.
// The hooked fish swims left and right out in the water, pulling the line. Hold to reel in; angle the rod
// (mouse left/right, or A/D) AGAINST the fish's pull. A good angle keeps tension in the safe band and tires
// the fish; a bad angle or reeling through a leap spikes tension until the line snaps. Ease off (let go)
// and the fish takes line back.
//
// Pure state machine so the game and the balance tests share it.
export const TUG = {
  GOOD_LO: 0.2, // below: slack, no line comes in
  GOOD_HI: 0.82, // above: danger
  SNAP_AT: 0.94, // tension above this builds strain...
  SNAP_TIME: 0.75, // ...and this much strain snaps the line
};

export function newTug(species, diff, { relaxed = false, perk = 0, reelBonus = 0, lineBonus = 0, rand = Math.random, moves = true } = {}) {
  const fight = moves && species.fight ? species.fight : null;
  return {
    // a signature fight (species.fight, see MOVES below); fish without one carry none of this and fight exactly as before
    ...(fight ? { fight, phase: 0, seq: 0, move: null, moveT: fight.first ?? 3.2, rally: 0, ease: false, cue: null, cues: 0 } : null),
    species, diff, relaxed, perk: perk + reelBonus,
    // Braided line upgrades: a wider sweet spot and more time in the red before it snaps
    goodHi: Math.min(0.88, TUG.GOOD_HI + lineBonus * 0.015), snapTime: TUG.SNAP_TIME + lineBonus * 0.08,
    t: 0, progress: 0.14, tension: 0.12, stamina: 1,
    pull: rand() < 0.5 ? -0.6 : 0.6, pullTarget: 0, surge: 0, switchT: 0.6, jump: 0,
    rodX: 0, align: 1, strain: 0, good: false, snapped: false, clean: true,
  };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Another kind of fight (an expansion's: a big-game fish from the fighting chair) is a style on the tug: r.style, with its
// own state wherever it likes on r. Its hooks, all optional:
//   pre(r, dt, holding, rodX, rand) -> true   it has this step (the fish alongside, the fish lost)
//   leap(r) -> true                           it handles a leap its own way (a spotter calls it early)
//   auto(r) -> true                           someone else has the rod: reel for the angler, as in relaxed mode
//   holdOff(r) -> true                        don't reel just now (a run)
//   tension(r, holding) -> extra tension      pace(r) -> line-won multiplier
//   lineOut(r, dt, holding) -> true           it decides what happens to line while you ease off (and your arms)
//   relaxedRate                               line won per second in relaxed mode
//   end(r)                                    after the step (the fish comes alongside)
//   won(r) -> bool
export const step = (r, hook, ...a) => r.style?.[hook]?.(r, ...a);

// ---------------------------------------------------------------- signature moves
// The top fish fight with a pattern of their own: species.fight = { open, tired, at, every, first, k }.
//   open   the moves it cycles through, in order, while it is fresh (so a fish can be learned)
//   tired  the moves it switches to once its stamina is below "at" (default 0.6): the phase change
//          (near: for a long fight, change instead once this much of the line is in, 0..1)
//   every  seconds between moves (default 6.5, a quarter either way); first: seconds before the first one (3.2)
//   k      how hard the moves hit (default 1; an epic's single mild move is about 0.6). Relaxed reel halves it.
// Every move is telegraphed (r.cue is set to its name for one step and r.move.on is false for "tell" seconds while
// the fish shows what is coming), and every move is answered with something the angler already does:
//   feint     darts one way, then runs hard the other.            Don't chase the dart; swing back with it.
//   shake     stops and shakes its head: fast tension spikes.     Ease off until it stops.
//   run       turns and strips line.                              Let it go, then win the line back.
//   dive      comes at you and crosses under: the pull flips.     Swing the rod to the other side.
//   sulk      goes heavy and still; reeling only strains.         Wait, then reel the moment it gives ('give' cue).
//   tailwalk  leaps again and again.                              Stay off the reel until it is back down.
// A move weathered without the line going into the red leaves the fish winded: line comes in faster for RALLY
// seconds. r.ease says "off the reel now" (relaxed mode and the simulated anglers read it; so can a HUD).
// No Three.js here, and no randomness but the rand passed in, so a server can run the same fight.
export const MOVES = {
  feint: { tell: 0.5, dur: 0.9 },
  shake: { tell: 0.6, dur: 1.4 },
  run: { tell: 0.7, dur: 2.0 },
  dive: { tell: 0.65, dur: 0.8 },
  sulk: { tell: 0.5, dur: 1.9, give: 0.9 },
  tailwalk: { tell: 0.55, hops: 3, hop: 0.5, gap: 0.42 }, // (a mild one, k < 1, and a relaxed one are two hops)
};
export const MOVE_TUNE = { RELAXED: 0.5, EVERY: 6.5, AT: 0.6, RALLY: 2.2, RALLY_PACE: 0.6 };
const NO_FX = Object.freeze({ turn: 1, add: 0, pace: 1, slack: 1, strip: 0, tire: 0 });

function stepMove(r, dt, rand) {
  const F = r.fight;
  r.cue = null;
  r.rally = Math.max(0, r.rally - dt);
  if (!r.move) {
    r.ease = false;
    // the phase change: tired, it changes its tricks
    if (!r.phase && F.tired && (F.near != null ? r.progress >= F.near : r.stamina < (F.at ?? MOVE_TUNE.AT))) { r.phase = 1; r.seq = 0; r.cue = 'tired'; r.cues++; r.moveT = Math.max(r.moveT, 1.2); }
    r.moveT -= dt;
    // not during a leap or another fight style's own run, and not with the fish at your feet or nearly gone
    if (r.moveT > 0 || r.jump > 0 || r.progress > 0.9 || r.progress < 0.1 || step(r, 'holdOff')) return NO_FX;
    const list = (r.phase && F.tired) || F.open;
    const kind = list[r.seq++ % list.length], M = MOVES[kind];
    r.move = { kind, t: 0, tell: M.tell * (r.relaxed ? 1.3 : 1), dur: kind === 'tailwalk' ? (M.hops - ((F.k ?? 1) < 1 || r.relaxed ? 1 : 0)) * (M.hop + M.gap) : M.dur * (kind === 'run' ? 0.7 + 0.3 * r.stamina : 1), side: Math.sign(r.pull) || 1, on: false, give: false, hops: 0, red: false, hit: false };
    r.cue = kind; r.cues++;
  }
  const m = r.move, M = MOVES[m.kind], k = (F.k ?? 1) * (r.relaxed ? MOVE_TUNE.RELAXED : 1);
  const fx = (r.fx ||= { ...NO_FX });
  Object.assign(fx, NO_FX);
  m.t += dt;
  const started = !m.on && m.t >= m.tell;
  if (started) m.on = true;
  const a = m.t - m.tell; // seconds into the move proper
  r.switchT = Math.max(r.switchT, 0.3); // the move has the fish: its ordinary turns wait
  r.ease = false;
  switch (m.kind) {
    case 'feint':
      r.pullTarget = (m.on ? 1 : -0.85) * m.side; fx.turn = m.on ? 2.6 : 2.2;
      if (started) r.surge = Math.max(r.surge, 0.5 * k);
      break;
    case 'shake':
      if (!m.on) r.pullTarget = m.side * 0.25;
      else { fx.add = k * 0.45 * (0.55 + 0.45 * Math.sin(a * 24)); fx.slack = 0.25; fx.tire = 0.04; }
      r.ease = m.t > m.tell - 0.2;
      break;
    case 'run':
      r.pullTarget = m.side * 0.9;
      if (m.on) { fx.add = 0.5 * k; fx.pace = 0; fx.slack = 0; fx.strip = 0.028 * k; fx.tire = 0.05; }
      r.ease = m.t > m.tell - 0.2;
      break;
    case 'dive':
      r.pullTarget = (m.on ? -1 : 0.9) * m.side;
      // coming at you the line goes soft; once it is across (a beat to swing the rod) a rod left behind is snatched
      fx.add = !m.on || a < 0.3 ? -0.12 : 0.3 * k * (1 - (r.align ?? 1));
      if (m.on) fx.turn = 2.4;
      break;
    case 'sulk':
      r.pullTarget = m.side * 0.1; fx.turn = 2;
      if (m.on && a < m.dur) { fx.add = 0.45 * k; fx.pace = 0; fx.slack = 0; r.ease = true; }
      else if (m.on) { if (!m.give) { m.give = true; r.cue = 'give'; r.cues++; } fx.slack = 0; } // it gives: reel now (the reward is in stepTug)
      else r.ease = m.t > m.tell - 0.2;
      break;
    case 'tailwalk':
      r.pullTarget = m.side * 0.6; fx.slack = 0.15; fx.tire = 0.05;
      r.ease = m.t > m.tell - 0.2;
      if (m.on && r.jump <= 0 && a >= m.hops * (M.hop + M.gap) && a < m.dur - M.hop * 0.5) { m.hops++; if (!step(r, 'leap')) r.jump = M.hop; }
      break;
    default: break;
  }
  if (m.t >= m.tell + m.dur + (m.kind === 'sulk' ? M.give : 0)) {
    if (!m.red) r.rally = MOVE_TUNE.RALLY; // weathered cleanly: the fish is winded
    r.move = null; r.ease = false;
    r.moveT = (F.every ?? MOVE_TUNE.EVERY) * (0.75 + rand() * 0.5);
  }
  return fx;
}

/** Advance one step. holding: reel button down. rodX: rod angle -1 (left) .. 1 (right). */
export function stepTug(r, dt, holding, rodX, rand = Math.random) {
  r.t += dt;
  if (step(r, 'pre', dt, holding, rodX, rand)) return r;
  const D = r.diff;
  const b = r.species.behaviour;
  // ---- the fish
  r.switchT -= dt;
  if (r.switchT <= 0) {
    const side = Math.sign(r.pullTarget || r.pull || 1);
    const flip = rand() < (b === 'dart' ? 0.8 : b === 'steady' ? 0.5 : 0.62);
    r.pullTarget = (flip ? -side : side) * (0.45 + rand() * 0.55);
    const base = b === 'dart' ? 1.0 : b === 'steady' ? 2.3 : b === 'sink' ? 1.9 : 1.5;
    r.switchT = (base + rand() * 1.1) / (0.75 + D * 0.12) * (1.6 - r.stamina * 0.6);
    if (rand() < 0.12 + D * 0.1) r.surge = 0.3 + rand() * 0.7 * (D / 5);
    if (b === 'jump' && rand() < 0.35 && !step(r, 'leap')) r.jump = 0.95; // a leap: let go of the line!
  }
  const mv = r.fight ? stepMove(r, dt, rand) : NO_FX;
  const turn = (b === 'dart' ? 4.5 : b === 'steady' ? 1.8 : 2.8) * (0.8 + D * 0.08) * mv.turn;
  r.pull += (r.pullTarget - r.pull) * Math.min(1, dt * turn);
  r.surge = Math.max(0, r.surge - dt * 0.55);
  r.jump = Math.max(0, r.jump - dt);
  const strength = (0.26 + D * 0.12) * (0.5 + 0.5 * r.stamina) + r.surge * 0.6 + (b === 'sink' ? 0.06 : 0);
  r.strength = strength;

  // ---- the angler (relaxed mode steers and reels for you)
  if (r.relaxed || step(r, 'auto')) { rodX = -r.pull; holding = (r.tension < 0.55 || !!r.move?.give) && r.jump <= 0 && !step(r, 'holdOff') && !r.ease; }
  r.rodX = rodX = clamp(rodX, -1, 1);
  r.holding = holding;
  const align = 1 - Math.min(1, Math.abs(rodX + r.pull) / 1.1); // 1 = rod angled straight against the pull
  r.align = align;

  // ---- tension
  let target = holding ? 0.3 + strength * 0.78 * (1.35 - align * 0.9) : 0.04 + strength * 0.18;
  if (r.jump > 0 && holding) target += 0.75; // reeling through a leap
  target += step(r, 'tension', holding) || 0;
  if (holding) target += mv.add;
  r.tension += (target - r.tension) * Math.min(1, dt * (holding ? 3.4 : 5));
  r.tension = clamp(r.tension, 0, 1.1);

  // ---- line in / line out
  const goodHi = r.goodHi ?? TUG.GOOD_HI;
  r.good = holding && r.tension > TUG.GOOD_LO && r.tension < goodHi;
  if (r.good) r.progress += dt * (0.03 + align * 0.09) * (1.15 - D * 0.07) * (1 + r.perk) * (step(r, 'pace') ?? 1) * mv.pace * (r.rally > 0 ? 1 + MOVE_TUNE.RALLY_PACE : 1);
  if (step(r, 'lineOut', dt, holding)) { /* its own way */ }
  else if (!holding) r.progress -= dt * strength * 0.12 * (0.4 + r.stamina * 0.6) * mv.slack;
  else if (r.tension >= goodHi) r.progress -= dt * strength * 0.16 * Math.min(1, (r.tension - goodHi) / 0.15); // the drag slips: line runs out
  if (r.move) {
    const m = r.move;
    r.progress -= dt * mv.strip; // a run takes line whatever you do
    if (!holding) r.stamina = Math.max(0.12, r.stamina - dt * mv.tire); // and a fish left to thrash tires itself
    if (r.tension > TUG.SNAP_AT) m.red = true;
    if (m.give && holding && !m.hit) { m.hit = true; r.progress += 0.03; r.stamina = Math.max(0.12, r.stamina - 0.06); r.cue = 'heave'; r.cues++; } // the sulk broken
  }
  // countering wears the fish out
  r.stamina = Math.max(0.12, r.stamina - dt * align * (holding ? 0.05 : 0.02));

  // ---- strain and snapping
  if (r.tension > TUG.SNAP_AT) { r.strain += dt; r.clean = false; } else r.strain = Math.max(0, r.strain - dt * 0.25);
  if (!holding && r.progress < 0.12) r.clean = false;
  if (r.strain >= (r.snapTime ?? TUG.SNAP_TIME)) r.snapped = true;
  if (r.relaxed) { r.strain = 0; r.snapped = false; r.progress += dt * (r.style?.relaxedRate ?? 0.05); }
  r.progress = clamp(r.progress, 0, 1);
  step(r, 'end');
  return r;
}

export const tugWon = (r) => (r.style?.won ? r.style.won(r) : r.progress >= 1);
export const tugLost = (r) => r.snapped || (r.progress <= 0 && r.t > 1);
