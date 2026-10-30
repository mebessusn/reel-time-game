// Skye's Air Races: the pure bits of your record (no game, no DOM): pilot ranks, and cleaning up a ghost lap that may
// have come from another player's copy of the game (only numbers, in order, of a sane size get through).
import { PLANES } from './planes.js';

export const RANKS = [{ at: 0, name: 'Student Pilot' }, { at: 8, name: 'Bush Pilot' }, { at: 24, name: 'Ace' }, { at: 60, name: 'Sky Legend' }];
/** Your rank from your medal points (1 bronze ... 4 platinum, per circuit and class). */
export function rankFor(points) { let r = RANKS[0]; for (const k of RANKS) if (points >= k.at) r = k; const nx = RANKS[RANKS.indexOf(r) + 1]; return { ...r, points, next: nx || null }; }

const num = (v) => typeof v === 'number' && isFinite(v);
/** A ghost: { name, lap, plane, s: [[t, x, y, z, yaw, bank], ...] } -> { name, lap, plane, samples } or null. */
export function cleanGhost(g) {
  if (!g || !Array.isArray(g.s) || g.s.length < 5 || g.s.length > 2000 || !num(g.lap) || g.lap <= 0 || g.lap > 900) return null;
  const s = []; let last = -1;
  for (const r of g.s) { if (!Array.isArray(r) || r.length !== 6 || !r.every(num) || r[0] < last || Math.abs(r[1]) > 1e5 || Math.abs(r[2]) > 1e4 || Math.abs(r[3]) > 1e5) return null; last = r[0]; s.push(r); }
  return { name: String(g.name || '').replace(/[<>]/g, '').slice(0, 20) || 'Someone', lap: g.lap, plane: PLANES[g.plane] ? g.plane : 'snowgoose', samples: s };
}
