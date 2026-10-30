// Open Waters stage 5: the pure parts of progress.js (tested in tests/ocean.test.mjs).
import { OCEAN_SPECIES } from '../data/oceanSpecies.js';

export const BILLFISH = new Set(['sailfish', 'marlin']);
export const SLAM = ['sailfish', 'marlin', 'swordfish'];
export const SHARKS = new Set(['mako', 'hammerhead', 'greatwhite']);
export const SPEARABLE = ['snapper', 'barracuda', 'triggerfish', 'grouper', 'lionfish', 'octopus', 'gt', 'bonefish'];
export const MOUNTS = { marlin: 'ow_bill', mako: 'ow_jaw', hammerhead: 'ow_jaw', greatwhite: 'ow_jaw', giantsquid: 'ow_squid' };
export const OW_SET = { name: 'Open Waters', title: 'Old Salt', species: OCEAN_SPECIES.map((s) => s.id), reward: { coins: 3000, pearls: 30, xp: 1500 }, decor: 'ow_bottle' };
/** Bonus XP for letting a billfish go (on top of what the catch already paid). */
export const releaseXp = (sp, w) => Math.round((sp.value?.xp || 200) * 0.6 + Math.min(300, w * 0.4));

/** Pure: the achievement counters from the sea's save data. */
export function oceanStats(o = {}) {
  const rel = o.released || {};
  return {
    owGrandSlam: o.slams || 0,
    owBillRelease: [...BILLFISH].reduce((a, id) => a + (rel[id] || 0), 0),
    owReefSpeared: SPEARABLE.filter((id) => (o.speared?.[id] || 0) > 0).length,
    owPartyWins: Object.values(o.games || {}).filter((x) => (x?.wins || 0) > 0).length,
    owBreach: o.breach || 0,
  };
}
/** Pure: progress on the Open Waters collection from the Fishpedia. */
export function owSetProgress(pedia = {}) {
  const have = OW_SET.species.filter((id) => pedia[id]);
  return { have, total: OW_SET.species.length, done: have.length === OW_SET.species.length };
}

