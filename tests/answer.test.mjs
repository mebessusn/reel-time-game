// v1.12.1: the answer fish's reward curve (Claude's Catch) stays slow, with diamonds only on long runs.
import assert from 'node:assert/strict';
import { answerTiers, answerDiamondChance } from '../src/game/fishing.js';
import { ClaudeLink } from '../src/game/claudelink.js';
import { turnBonus, canReward, recentRewards, CLAUDE_REWARDS_PER_HOUR, PATIENT } from '../src/game/claudeperks.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`  ok ${name}`); };
ok('short turns give a gold rare only', () => { for (const s of [0, 20, 119]) assert.deepEqual(answerTiers(s), ['rare']); });
ok('2 to 10 min give rare or epic', () => { for (let i = 0; i < 50; i++) { const t = answerTiers(300); assert.ok(t.includes('rare') && t.includes('epic') && !t.includes('legendary')); } });
ok('10 to 30 min give epic first', () => assert.deepEqual(answerTiers(900), ['epic', 'rare']));
ok('30 min or more reach legendary', () => assert.equal(answerTiers(1800)[0], 'legendary'));
ok('no diamonds under 30 min', () => { for (const s of [0, 300, 900, 1799]) assert.equal(answerDiamondChance(s), 0); });
ok('diamond odds 10% from 30 min, 25% from an hour', () => { assert.equal(answerDiamondChance(1800), 0.1); assert.equal(answerDiamondChance(3600), 0.25); });
ok('small or quick turns earn no turn bonus', () => { assert.equal(turnBonus(30, 20), null); assert.equal(turnBonus(600, 4), null); });
ok('a big multistep turn pays coins and XP, more for more steps', () => {
  const a = turnBonus(120, 6), b = turnBonus(1200, 40);
  assert.ok(a.coins > 0 && a.xp > 0); assert.ok(b.coins > a.coins && b.xp > a.xp);
});
ok('the turn bonus is capped', () => { const c = turnBonus(99999, 99999); assert.ok(c.coins <= 120 && c.xp <= 80); });
ok('at most 6 Claude rewards an hour', () => {
  const now = 1e12, times = Array.from({ length: CLAUDE_REWARDS_PER_HOUR }, (_, i) => now - i * 60000);
  assert.equal(canReward(times, now), false);
  assert.equal(canReward(times.slice(1), now), true);
  assert.equal(canReward(times, now + 3600001), true); // an hour on, they have all aged out
});
ok('junk and future reward times are ignored', () => assert.equal(recentRewards(['x', NaN, 1e12 + 5], 1e12).length, 0));
ok('Patient Angler is a modest buff', () => assert.ok(PATIENT.perks.biteSpeed <= 0.25 && PATIENT.perks.reelZone <= 0.08));

// v1.13.2: opening the game mid-prompt picks the timer up from the prompt's real start
ok('a game opened mid-prompt counts the time already waited', () => {
  const fake = { ext: { d: { claudeLinkedAt: 1 }, change() {} } };
  const now = Date.now(), seen = [];
  const l = new ClaudeLink(fake); l.on('working', (e) => seen.push(e));
  l.signal({ state: 'working', at: now - 20000, startedAt: now - 40 * 60000 }, 'artifact'); // a heartbeat, 40 min into the turn
  assert.equal(l.state, 'working');
  assert.ok(Math.abs(l.elapsed() - 2400) < 2);
  assert.equal(seen.length, 1); assert.ok(seen[0].elapsed >= 2399);
  l.signal({ state: 'working', at: now - 20000, startedAt: now - 40 * 60000 }, 'artifact'); // same doc again (listener + read)
  assert.equal(seen.length, 1);
});
ok('a working left behind by a closed session is ignored', () => {
  const l = new ClaudeLink({ ext: { d: { claudeLinkedAt: 1 }, change() {} } });
  l.signal({ state: 'working', at: Date.now() - 45 * 60000, startedAt: Date.now() - 50 * 60000 }, 'artifact');
  assert.equal(l.state, 'idle');
});
console.log(`answer: ${n} passed`);
