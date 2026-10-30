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

export function newTug(species, diff, { relaxed = false, perk = 0, reelBonus = 0, lineBonus = 0, rand = Math.random } = {}) {
  return {
    species, diff, relaxed, perk: perk + reelBonus,
    // Braided line upgrades: a wider sweet spot and more time in the red before it snaps
    goodHi: Math.min(0.88, TUG.GOOD_HI + lineBonus * 0.015), snapTime: TUG.SNAP_TIME + lineBonus * 0.08,
    t: 0, progress: 0.14, tension: 0.12, stamina: 1,
    pull: rand() < 0.5 ? -0.6 : 0.6, pullTarget: 0, surge: 0, switchT: 0.6, jump: 0,
    rodX: 0, align: 1, strain: 0, good: false, snapped: false, clean: true,
  };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---- v1.15 Open Waters: big-game fights. A long fight from the fighting chair: the fish makes runs (let it go or
// the line parts; the captain backing down on it takes the sting out), your arms tire if you never ease off (pump:
// lift and reel in bursts), the boat's heave tugs the line in a rough sea, and at the end the fish comes alongside
// for the gaff, a moment the crew (or Marlowe) has to get right.
export const BIG = {
  PACE_MIN: 0.2, PACE_MAX: 0.36, // line won per second vs. a lake fish (lower = longer fight)
  RUN_EVERY: [11, 20], RUN_LEN: [2.6, 5.2],
  ARMS_DRAIN: 0.03, ARMS_CHAIR: 0.75, ARMS_REST: 0.14,
  GAFF_OPEN: 1.0, GAFF_CLOSE: 4.6, GAFF_AI_AT: 2.1,
  AFK_AFTER: 8, AFK_HOLD: 60,
};
/** Make a tug a big-game fight. weightK: 0..1 how far up its weight range the fish is. */
export function makeBig(r, { weightK = 0.5, chair = true, paceK = 1, armsK = 1, rand = Math.random } = {}) {
  r.big = {
    pace: (BIG.PACE_MAX - (BIG.PACE_MAX - BIG.PACE_MIN) * clamp(weightK, 0, 1)) * paceK, // paceK: a marathon fish (bluefin, marlin) is slower
    runT: BIG.RUN_EVERY[0] * 0.6 + rand() * 4, run: 0, runs: 0, arms: 1, chair, armsK, // armsK: a fighting harness saves your arms
    chase: 0, captain: 'ai', spotter: false, gaffer: 'ai', heaveV: 0, seaK: 0,
    jumpIn: 0, warn: 0, gaff: null, landed: false, missed: 0, idle: 0, afk: 0, afkUsed: 0, lost: null,
  };
  r.progress = 0.08;
  return r;
}
function stepBig(r, dt, holding, rand) {
  const B = r.big;
  // the fish beside the boat: thrashing, waiting for the gaff
  if (B.gaff) {
    B.gaff.t += dt;
    r.tension += ((holding ? 0.45 : 0.2) + Math.sin(r.t * 13) * 0.08 - r.tension) * Math.min(1, dt * 6);
    r.pull = Math.sin(r.t * 3.1) * 0.6; r.surge = 0; r.jump = 0;
    if (B.gaffer === 'ai' && !B.gaff.tried && B.gaff.t >= BIG.GAFF_AI_AT) { B.gaff.tried = true; gaffTry(r, rand() < (B.gaff.aiOdds ?? 0.85)); }
    if (B.gaff && B.gaff.t > BIG.GAFF_CLOSE * (B.gaffer === 'crew' ? 1.4 : 1)) { // nobody gaffed it: it sounds again
      gaffTry(r, false);
      if (B.gaffer === 'crew') B.gaffer = 'ai'; // and Marlowe takes the gaff next time
    }
    return true;
  }
  // runs: every so often the fish turns and tears off line
  B.runT -= dt;
  if (B.run <= 0 && B.runT <= 0) {
    B.run = BIG.RUN_LEN[0] + rand() * (BIG.RUN_LEN[1] - BIG.RUN_LEN[0]) * (0.6 + 0.4 * r.stamina);
    B.runs++;
    B.runT = BIG.RUN_EVERY[0] + rand() * (BIG.RUN_EVERY[1] - BIG.RUN_EVERY[0]);
    r.pullTarget = Math.sign(r.pull || 1) * (0.85 + rand() * 0.15);
  }
  if (B.run > 0) {
    B.run -= dt;
    const chase = B.captain === 'ai' ? 0.35 : B.chase; // backing down on the fish eases a run
    r.surge = Math.max(r.surge, (0.9 - chase * 0.5) * (0.6 + 0.4 * r.stamina));
    r.progress -= dt * 0.045 * (1 - chase * 0.6) * (0.5 + 0.5 * r.stamina);
  }
  // a leap, called early by a spotter
  if (B.jumpIn > 0) { B.jumpIn -= dt; if (B.jumpIn <= 0) { r.jump = 0.95; B.warn = 0; } }
  return false;
}
function gaffTry(r, ok) {
  const B = r.big;
  if (!B.gaff) return;
  if (ok && B.gaff.t >= BIG.GAFF_OPEN) { B.landed = true; B.gaff = null; return; }
  // missed (or too early): the fish bolts for one last run
  B.missed++; B.gaff = null; r.progress = 0.8; B.run = 3.5; B.runT = 14; r.stamina = Math.max(r.stamina, 0.35);
}
/** A crew gaff (or the angler's own, solo): true if it landed the fish. */
export function gaff(r) { if (!r?.big?.gaff) return false; const ok = r.big.gaff.t >= BIG.GAFF_OPEN; gaffTry(r, ok); return ok; }

/** Advance one step. holding: reel button down. rodX: rod angle -1 (left) .. 1 (right). */
export function stepTug(r, dt, holding, rodX, rand = Math.random) {
  r.t += dt;
  if (r.big) {
    // AFK in a big fight: Marlowe takes the rod for up to a minute, then the fish wins
    if (holding || rodX !== r.lastRodX) r.big.idle = 0; else r.big.idle += dt;
    r.lastRodX = rodX;
    r.big.afk = r.big.idle > BIG.AFK_AFTER && !r.relaxed;
    if (r.big.afk) { r.big.afkUsed += dt; if (r.big.afkUsed > BIG.AFK_HOLD) { r.big.lost = 'afk'; r.snapped = true; return r; } }
    if (stepBig(r, dt, holding, rand)) { r.holding = holding; r.good = false; return r; }
  }
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
    if (b === 'jump' && rand() < 0.35) {
      if (r.big) { if (r.big.jumpIn <= 0 && r.jump <= 0) { r.big.jumpIn = r.big.spotter ? 1.1 : 0.3; r.big.warn = r.big.jumpIn; } }
      else r.jump = 0.95; // a leap: let go of the line!
    }
  }
  const turn = (b === 'dart' ? 4.5 : b === 'steady' ? 1.8 : 2.8) * (0.8 + D * 0.08);
  r.pull += (r.pullTarget - r.pull) * Math.min(1, dt * turn);
  r.surge = Math.max(0, r.surge - dt * 0.55);
  r.jump = Math.max(0, r.jump - dt);
  const strength = (0.26 + D * 0.12) * (0.5 + 0.5 * r.stamina) + r.surge * 0.6 + (b === 'sink' ? 0.06 : 0);
  r.strength = strength;

  // ---- the angler (relaxed mode steers and reels for you)
  if (r.relaxed || r.big?.afk) { rodX = -r.pull; holding = r.tension < 0.55 && r.jump <= 0 && !(r.big?.run > 0); }
  r.rodX = rodX = clamp(rodX, -1, 1);
  r.holding = holding;
  const align = 1 - Math.min(1, Math.abs(rodX + r.pull) / 1.1); // 1 = rod angled straight against the pull
  r.align = align;

  // ---- tension
  let target = holding ? 0.3 + strength * 0.78 * (1.35 - align * 0.9) : 0.04 + strength * 0.18;
  if (r.jump > 0 && holding) target += 0.75; // reeling through a leap
  if (r.big) {
    if (r.big.run > 0 && holding) target += 0.35; // reeling against a run
    if (holding) target += Math.max(0, -r.big.heaveV) * 0.12 * r.big.seaK; // the stern drops off a wave: the line snatches
  }
  r.tension += (target - r.tension) * Math.min(1, dt * (holding ? 3.4 : 5));
  r.tension = clamp(r.tension, 0, 1.1);

  // ---- line in / line out
  const goodHi = r.goodHi ?? TUG.GOOD_HI;
  r.good = holding && r.tension > TUG.GOOD_LO && r.tension < goodHi;
  if (r.good) r.progress += dt * (0.03 + align * 0.09) * (1.15 - D * 0.07) * (1 + r.perk) * (r.big ? r.big.pace * (0.3 + 0.7 * r.big.arms) * 1.5 * (r.big.afk ? 0 : 1) : 1); // (Marlowe only holds it for you)
  if (r.big) { // your arms: they tire while you crank and come back while you ease off (pump the rod)
    if (holding && !r.big.afk) r.big.arms = Math.max(0, r.big.arms - dt * BIG.ARMS_DRAIN * (r.big.chair ? BIG.ARMS_CHAIR : 1) * (r.big.armsK ?? 1) * (0.6 + r.tension));
    else r.big.arms = Math.min(1, r.big.arms + dt * BIG.ARMS_REST);
  }
  else if (!holding) r.progress -= dt * strength * 0.12 * (0.4 + r.stamina * 0.6);
  else if (r.tension >= goodHi) r.progress -= dt * strength * 0.16 * Math.min(1, (r.tension - goodHi) / 0.15); // the drag slips: line runs out
  // countering wears the fish out
  r.stamina = Math.max(0.12, r.stamina - dt * align * (holding ? 0.05 : 0.02));

  // ---- strain and snapping
  if (r.tension > TUG.SNAP_AT) { r.strain += dt; r.clean = false; } else r.strain = Math.max(0, r.strain - dt * 0.25);
  if (!holding && r.progress < 0.12) r.clean = false;
  if (r.strain >= (r.snapTime ?? TUG.SNAP_TIME)) r.snapped = true;
  if (r.relaxed) { r.strain = 0; r.snapped = false; r.progress += dt * (r.big ? 0.012 : 0.05); }
  if (r.big?.afk) { r.strain = 0; r.snapped = false; r.progress = Math.max(r.progress, 0.05); }
  r.progress = clamp(r.progress, 0, 1);
  // a big fish brought to the boat: hold it there for the gaff
  if (r.big && r.progress >= 1 && !r.big.landed) { r.big.gaff = { t: 0, aiOdds: r.big.gaffAiOdds ?? 0.85 }; r.progress = 0.97; }
  return r;
}

export const tugWon = (r) => (r.big ? r.big.landed : r.progress >= 1);
export const tugLost = (r) => r.snapped || (r.progress <= 0 && r.t > 1);
