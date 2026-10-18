// Bait (consumable, one per hooked fish) and tackle/boat upgrades sold by Gus.
// Bait changes WHAT bites: each kind favours some fish over others.

export const BAITS = {
  worm: { name: 'Earthworms', pack: 10, price: { coins: 40 }, color: '#d87a8a', desc: 'Everything likes a worm. Bites come a little faster.',
    likes: (s) => (s.tier === 'common' || s.tier === 'uncommon' ? 1.3 : 1), biteSpeed: 0.12 },
  cricket: { name: 'Crickets', pack: 10, price: { coins: 70 }, color: '#5a7a3a', desc: 'Surface feeders that jump for bugs: bass, trout, salmon, Moonfin.',
    likes: (s) => (s.behaviour === 'jump' ? 2.4 : 0.8) },
  minnow: { name: 'Live Minnows', pack: 8, price: { coins: 110 }, color: '#9aa8b0', desc: 'Predators can’t resist: pike, walleye, gar, muskie. Rare odds up a little.',
    likes: (s) => (s.behaviour === 'dart' || ['long', 'gar', 'slim'].includes(s.shape) ? 2.2 : 0.7), rare: 1.2 },
  dough: { name: 'Corn Dough', pack: 10, price: { coins: 60 }, color: '#f0d070', desc: 'Bottom feeders: carp, catfish, bullhead, koi, sturgeon.',
    likes: (s) => (s.behaviour === 'sink' || ['big', 'cat', 'sturgeon'].includes(s.shape) ? 2.4 : 0.7) },
  glowgrub: { name: 'Glow Grubs', pack: 5, price: { pearls: 3 }, color: '#8affd8', desc: 'Glowing fish and night hunters crowd in. Epic odds up.',
    likes: (s) => (s.pattern === 'glow' ? 3 : s.times.includes('night') ? 1.6 : 0.8), rare: 1.15, epic: 1.4 },
};

// Upgrades: [level 1..5] prices (v1.8 roughly 2.5x the old ones, plus two new top levels).
// Effects are applied in tug.js (rod), rules.lineRating (weight limit) and player.js / rules (boat).
export const UPGRADES = {
  reel: { name: 'Reel gears', what: 'Reel speed', per: '+7% line won back per level', prices: [{ coins: 3000 }, { coins: 8000 }, { coins: 18000 }, { pearls: 150 }, { pearls: 270 }] },
  line: { name: 'Braided line', what: 'Line rating', per: '+35% to the heaviest fish your rod can land, holds a red line longer', prices: [{ coins: 3500 }, { coins: 9000 }, { coins: 20000 }, { pearls: 180 }, { pearls: 300 }] },
  hull: { name: 'Sanded hull', what: 'Boat speed', per: '+12% rowing speed per level', prices: [{ coins: 2500 }, { coins: 7000 }, { coins: 16000 }, { pearls: 120 }, { pearls: 220 }] },
  holders: { name: 'Rod holders', what: 'Extra rods', per: 'Prop up one more rod on the bank and fish several at once (press E after you cast)', prices: [{ coins: 5000 }, { coins: 14000 }, { pearls: 140 }] },
  hold: { name: 'Bigger hold', what: 'Backpack space', per: '+5 backpack slots per level', prices: [{ coins: 4000 }, { coins: 10000 }, { coins: 22000 }, { pearls: 150 }, { pearls: 270 }] },
};
export const MAX_UPGRADE = 5;

// The heaviest fish (lb) each rod can land on a plain line. Braided line multiplies it (lineRating in rules.js).
export const ROD_LB = { rod_willow: 8, rod_birch: 14, rod_bamboo: 22, rod_copper: 35, rod_cherry: 45, rod_neon: 60, rod_lightning: 90, rod_obsidian: 110, rod_diamond: 160 };
export const lineRating = (rodId, up = {}) => Math.round((ROD_LB[rodId] || 10) * (1 + 0.35 * (up.line || 0)));

export function upgradeEffects(up = {}) {
  return {
    reelBonus: 0.07 * (up.reel || 0),
    lineBonus: up.line || 0,
    rowMult: 1 + 0.12 * (up.hull || 0),
    creelBonus: 5 * (up.hold || 0),
  };
}
