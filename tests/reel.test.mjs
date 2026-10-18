// Balance check for Tug & Turn: a simulated angler with human reaction time steers the rod against
// the fish's pull, reels while tension is comfortable and lets go when the fish leaps.
import assert from 'node:assert/strict';
import { newTug, stepTug, tugWon, tugLost } from '../src/game/tug.js';
import { SPECIES } from '../src/data/species.js';
import { mulberry32 } from '../src/core/rng.js';

function play(sp, diff, { reaction = 0.22, skill = 1, relaxed = false, seed = 1, lazy = false }) {
  const rand = mulberry32(seed);
  const r = newTug(sp, diff, { relaxed, rand });
  const dt = 1 / 60;
  const hist = [];
  let holding = false, rodX = 0;
  for (let i = 0; i < 60 * 90; i++) {
    hist.push({ pull: r.pull, tension: r.tension, jump: r.jump });
    const seen = hist[Math.max(0, hist.length - 1 - Math.round(reaction / dt))];
    // Steer toward the opposite of the pull (mouse moves take a moment), with some sloppiness.
    const want = lazy ? 0 : -seen.pull + (rand() - 0.5) * 0.5 / skill;
    rodX += (want - rodX) * Math.min(1, dt * 6);
    holding = seen.jump > 0 ? false : holding ? seen.tension < 0.78 : seen.tension < 0.55;
    stepTug(r, dt, holding, rodX, rand);
    if (tugWon(r)) return { ok: true, t: r.t, clean: r.clean };
    if (tugLost(r)) return { ok: false, t: r.t, snapped: r.snapped };
  }
  return { ok: false, t: 90 };
}

const byDiff = {};
for (const sp of SPECIES) {
  for (let i = 0; i < 100; i++) {
    const res = play(sp, sp.difficulty, { seed: i * 977 + sp.id.length });
    const d = (byDiff[sp.difficulty] ||= { n: 0, ok: 0, t: 0 });
    d.n++; if (res.ok) { d.ok++; d.t += res.t; }
  }
}
for (const [d, v] of Object.entries(byDiff)) console.log(`  difficulty ${d}: win ${(v.ok / v.n * 100).toFixed(0)}%, avg ${(v.t / Math.max(1, v.ok)).toFixed(1)}s`);
assert.ok(byDiff[1].ok / byDiff[1].n >= 0.9, 'easy fish should almost always land');
assert.ok(byDiff[5].ok / byDiff[5].n >= 0.35, 'hardest fish should still be landable');
assert.ok(byDiff[5].ok / byDiff[5].n <= 0.92, 'hardest fish should be a challenge');
// Steering matters: an angler who never angles the rod does clearly worse on hard fish
const hard = SPECIES.filter((s) => s.difficulty >= 4);
let lazyOk = 0, goodOk = 0;
for (let i = 0; i < 200; i++) { const sp = hard[i % hard.length]; if (play(sp, sp.difficulty, { seed: i, lazy: true }).ok) lazyOk++; if (play(sp, sp.difficulty, { seed: i }).ok) goodOk++; }
console.log(`  hard fish: steering ${goodOk / 2}% vs never steering ${lazyOk / 2}%`);
assert.ok(goodOk > lazyOk * 1.4, 'steering against the pull should matter');
// Relaxed mode always lands
for (let i = 0; i < 50; i++) assert.ok(play(SPECIES[31], 5, { relaxed: true, seed: i }).ok);
console.log('reel: balance ok');
