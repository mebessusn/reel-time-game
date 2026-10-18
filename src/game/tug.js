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

/** Advance one step. holding: reel button down. rodX: rod angle -1 (left) .. 1 (right). */
export function stepTug(r, dt, holding, rodX, rand = Math.random) {
  r.t += dt;
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
    if (b === 'jump' && rand() < 0.35) r.jump = 0.95; // a leap: let go of the line!
  }
  const turn = (b === 'dart' ? 4.5 : b === 'steady' ? 1.8 : 2.8) * (0.8 + D * 0.08);
  r.pull += (r.pullTarget - r.pull) * Math.min(1, dt * turn);
  r.surge = Math.max(0, r.surge - dt * 0.55);
  r.jump = Math.max(0, r.jump - dt);
  const strength = (0.26 + D * 0.12) * (0.5 + 0.5 * r.stamina) + r.surge * 0.6 + (b === 'sink' ? 0.06 : 0);
  r.strength = strength;

  // ---- the angler (relaxed mode steers and reels for you)
  if (r.relaxed) { rodX = -r.pull; holding = r.tension < 0.55 && r.jump <= 0; }
  r.rodX = rodX = clamp(rodX, -1, 1);
  r.holding = holding;
  const align = 1 - Math.min(1, Math.abs(rodX + r.pull) / 1.1); // 1 = rod angled straight against the pull
  r.align = align;

  // ---- tension
  let target = holding ? 0.3 + strength * 0.78 * (1.35 - align * 0.9) : 0.04 + strength * 0.18;
  if (r.jump > 0 && holding) target += 0.75; // reeling through a leap
  r.tension += (target - r.tension) * Math.min(1, dt * (holding ? 3.4 : 5));
  r.tension = clamp(r.tension, 0, 1.1);

  // ---- line in / line out
  const goodHi = r.goodHi ?? TUG.GOOD_HI;
  r.good = holding && r.tension > TUG.GOOD_LO && r.tension < goodHi;
  if (r.good) r.progress += dt * (0.03 + align * 0.09) * (1.15 - D * 0.07) * (1 + r.perk);
  else if (!holding) r.progress -= dt * strength * 0.12 * (0.4 + r.stamina * 0.6);
  else if (r.tension >= goodHi) r.progress -= dt * strength * 0.16 * Math.min(1, (r.tension - goodHi) / 0.15); // the drag slips: line runs out
  // countering wears the fish out
  r.stamina = Math.max(0.12, r.stamina - dt * align * (holding ? 0.05 : 0.02));

  // ---- strain and snapping
  if (r.tension > TUG.SNAP_AT) { r.strain += dt; r.clean = false; } else r.strain = Math.max(0, r.strain - dt * 0.25);
  if (!holding && r.progress < 0.12) r.clean = false;
  if (r.strain >= (r.snapTime ?? TUG.SNAP_TIME)) r.snapped = true;
  if (r.relaxed) { r.strain = 0; r.snapped = false; r.progress += dt * 0.05; }
  r.progress = clamp(r.progress, 0, 1);
  return r;
}

export const tugWon = (r) => r.progress >= 1;
export const tugLost = (r) => r.snapped || (r.progress <= 0 && r.t > 1);
