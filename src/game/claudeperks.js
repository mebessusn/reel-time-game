// v1.12.1: what working alongside Claude is worth. Pure rules (tested in tests/answer.test.mjs); game.js applies them.
//  - Patient Angler: while Claude works on your prompt, bites come faster and the reel zone is a touch wider.
//  - Turn bonus: a big multistep turn (5+ tool steps, a minute or more) pays coins and XP on top of the answer fish.
//  - Answer streak: land 3 answer fish in a row (none lost or left to expire) for a pearl.
//  - Caps: Claude's signals are self-reported, so at most 6 Claude rewards an hour (the server caps them per day too).

export const PATIENT = { name: 'Patient Angler', maxSeconds: 2 * 3600, perks: { biteSpeed: 0.2, reelZone: 0.05 } };
export const CLAUDE_REWARDS_PER_HOUR = 6;
export const ANSWER_STREAK = 3;

/** Coins and XP for a finished turn, or null for a small one. `steps` = tool calls Claude made in the turn. */
export function turnBonus(seconds, steps) {
  const s = Math.max(0, Number(seconds) || 0), n = Math.max(0, Math.floor(Number(steps) || 0));
  if (n < 5 || s < 60) return null;
  const mins = Math.min(s, 3600) / 60;
  return { coins: Math.min(120, Math.round(10 + n * 2 + mins)), xp: Math.min(80, Math.round(5 + n + mins / 1.5)) };
}

/** The reward times still inside the last hour (oldest dropped). */
export function recentRewards(times, now = Date.now()) {
  return (Array.isArray(times) ? times : []).filter((t) => Number.isFinite(t) && t <= now && now - t < 3600000).slice(-CLAUDE_REWARDS_PER_HOUR * 2);
}

/** Whether another Claude reward fits under the hourly cap. */
export function canReward(times, now = Date.now()) { return recentRewards(times, now).length < CLAUDE_REWARDS_PER_HOUR; }
