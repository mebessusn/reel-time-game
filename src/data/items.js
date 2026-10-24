// Shop items (design doc section 9). price: { coins } or { pearls }. perk: small functional stat.
// level: the level you need to buy it (v1.13.9 balance pass: prices and levels tuned for ~80 hours to the best gear).
// source: 'starter' (owned by everyone), 'shop', 'achievement' (granted by an achievement only).

export const PERK_TEXT = {
  hookWindow: (v) => `Hook window +${v}s`,
  castDistance: (v) => `Cast distance +${v}`,
  reelZone: (v) => `Reel zone +${Math.round(v * 100)}%`,
  biteSpeed: (v) => `Bite speed +${Math.round(v * 100)}%`,
  deepBite: (v) => `Bite speed +${Math.round(v * 100)}% in The Deep`,
  diamondOdds: (v) => `Diamond odds +${Math.round(v * 100)}%`,
  goldOdds: (v) => `Gold odds +${Math.round(v * 100)}%`,
  shallowsBite: (v) => `Shallows bite speed +${Math.round(v * 100)}%`,
  nightBite: (v) => `Night bite speed +${Math.round(v * 100)}%`,
  ruinsNight: () => 'Unlocks the Ruins bonus at night',
  flowBite: (v) => `Creek and river bites +${Math.round(v * 100)}%, trout rise to it`,
};

const I = (id, kind, name, price, extra = {}) => ({ id, kind, name, price, source: 'shop', ...extra });

export const ITEMS = [
  // Rods
  I('rod_willow', 'rod', 'Willow Stick', null, { source: 'starter', colors: ['#8a6a3a', '#6a4a2a'] }),
  I('rod_birch', 'rod', 'Birch Classic', { coins: 150 }, { perk: { hookWindow: 0.1 }, colors: ['#e8e0d0', '#3a3a3a'] }),
  I('rod_bamboo', 'rod', 'Bamboo Sprout', { coins: 1500 }, { level: 5, perk: { castDistance: 2 }, colors: ['#b8c860', '#6a8a30'] }),
  I('rod_copper', 'rod', 'Copper Caster', { coins: 8000 }, { level: 12, perk: { hookWindow: 0.2 }, colors: ['#c87840', '#8a4a20'] }),
  I('rod_cherry', 'rod', 'Cherry Blossom', { pearls: 90 }, { level: 18, perk: { reelZone: 0.05 }, colors: ['#f0a0c0', '#8a4a5a'], trail: 'petals' }),
  I('rod_neon', 'rod', 'Neon Synth', { pearls: 150 }, { level: 24, perk: { reelZone: 0.05 }, colors: ['#40f0e0', '#f040c0'], glow: true }),
  I('rod_obsidian', 'rod', 'Obsidian Deep', { pearls: 260 }, { level: 30, perk: { deepBite: 0.1 }, colors: ['#2a1a3a', '#6a40a0'] }),
  I('rod_diamond', 'rod', 'Diamond Rod', { pearls: 500 }, { level: 40, perk: { diamondOdds: 0.25 }, colors: ['#9af0ff', '#e0ffff'], glow: true }),
  // v1.14.9: Ranger Rhea's fly rod, for the creeks and rivers (sold at Ridge Lookout and by Wren's wagon)
  I('rod_fly', 'rod', 'Willowbend Fly Rod', { coins: 2400 }, { level: 6, perk: { flowBite: 0.3, castDistance: 2 }, colors: ['#5a7a4a', '#c8a050'], vendor: 'ranger' }),
  I('rod_lightning', 'rod', 'Lightning Rod', null, { source: 'achievement', perk: { biteSpeed: 0.05 }, colors: ['#f0e040', '#3a4058'], glow: true }),

  // Lures / bobbers
  I('lure_classic', 'lure', 'Red-White Classic', null, { source: 'starter', colors: ['#e03030', '#ffffff'] }),
  I('lure_duck', 'lure', 'Duck Bobber', { coins: 100 }, { colors: ['#f0d030', '#f08020'] }),
  I('lure_frog', 'lure', 'Frog', { coins: 900 }, { level: 5, perk: { shallowsBite: 0.1 }, colors: ['#5ab040', '#2a6a20'] }),
  I('lure_firefly', 'lure', 'Firefly', { coins: 4000 }, { level: 10, perk: { nightBite: 0.1 }, colors: ['#f0f060', '#3a3a20'], glow: true }),
  I('lure_spinner', 'lure', 'Golden Spinner', { pearls: 60 }, { level: 15, perk: { goldOdds: 0.25 }, colors: ['#f2c040', '#c08a20'] }),
  I('lure_spark', 'lure', 'Little Spark', null, { source: 'achievement', colors: ['#e8784a', '#fff0e0'], glow: true }),
  I('lure_crystal', 'lure', 'Crystal Jig', { pearls: 280 }, { level: 32, perk: { diamondOdds: 0.1 }, colors: ['#a0f0ff', '#ffffff'], glow: true }),
  I('lure_lantern', 'lure', 'Lantern Lure', { pearls: 350 }, { level: 22, perk: { ruinsNight: 1 }, colors: ['#ffd060', '#4a2a70'], glow: true }),

  // Boats (cosmetic only)
  I('boat_oak', 'boat', 'Plain Oak', null, { source: 'starter', colors: ['#a0703e', '#7a5230', '#c8a070'] }),
  I('boat_blue', 'boat', 'Painted Blue', { coins: 800 }, { level: 3, colors: ['#4a7ac0', '#f0f0f0', '#a0703e'] }),
  I('boat_birch', 'boat', 'Birch with Flowers', { coins: 3500 }, { level: 8, colors: ['#e8e0d0', '#f08ab0', '#c8b890'] }),
  I('boat_canoe', 'boat', 'Striped Canoe', { coins: 20000 }, { level: 16, colors: ['#d04a30', '#f0e0c0', '#8a4a20'] }),
  I('boat_duck', 'boat', 'Duck Boat', { pearls: 80 }, { level: 10, colors: ['#f0d030', '#f08020', '#f8f0c0'] }),
  I('boat_lily', 'boat', 'Lily Pad Float', { pearls: 140 }, { level: 18, colors: ['#5ab040', '#f0a0c0', '#3a8a30'] }),
  I('boat_pirate', 'boat', 'Pirate Dinghy', { pearls: 240 }, { level: 26, colors: ['#3a2a20', '#e0e0d0', '#a02020'] }),
  I('boat_swan', 'boat', 'Golden Swan', { pearls: 350 }, { level: 36, colors: ['#f2c040', '#fff0c0', '#c08a20'] }),
  I('boat_crystal', 'boat', 'Crystal Swan', null, { source: 'achievement', colors: ['#a0f0ff', '#ffffff', '#60c0e0'] }),
  I('boat_oars_gold', 'boat', 'Golden Oars Rowboat', null, { source: 'achievement', colors: ['#a0703e', '#f2c040', '#c8a070'] }),

  // Clothing sold in the shop (everything else in the creator is free)
  I('hat_captain', 'hat', 'Captain Hat', { coins: 1500 }),
  I('hat_crown', 'hat', 'Tiny Crown', { pearls: 150 }, { level: 20 }),
  I('hat_straw', 'hat', 'Straw Hat', null, { source: 'achievement' }),
  I('hat_bucket_tan', 'hat', 'Tan Bucket Hat', null, { source: 'achievement' }),
  I('shirt_raincoat_yellow', 'shirt', 'Yellow Rain Jacket', null, { source: 'achievement' }),
  I('acc_vest', 'accessory', 'Fishing Vest', { coins: 1000 }),
  I('acc_scarf', 'accessory', 'Cozy Scarf', { coins: 600 }),
  I('acc_backpack', 'accessory', 'Backpack', { coins: 800 }),
  I('acc_cat', 'accessory', 'Pet Cat (shoulder)', { pearls: 120 }),
  I('hat_tophat', 'hat', 'Top Hat', { coins: 1800 }),
  I('hat_frog', 'hat', 'Frog Hat', { pearls: 70 }),
  I('acc_camera', 'accessory', 'Camera', { coins: 1200 }),

  // Emotes
  I('emote_clap', 'emote', 'Clap', null, { source: 'achievement' }),
  I('emote_dance', 'emote', 'Little Dance', { coins: 1000 }),
];

export const ITEMS_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const STARTER_ITEMS = ITEMS.filter((i) => i.source === 'starter').map((i) => i.id);

// Daily featured rotation: three shop items, seeded by day.
export function featuredItems(dayIndex) {
  const pool = ITEMS.filter((i) => i.source === 'shop');
  const out = [];
  let s = (dayIndex * 2654435761) >>> 0;
  while (out.length < 3) {
    s = (s * 1103515245 + 12345) >>> 0;
    const it = pool[s % pool.length];
    if (!out.includes(it.id)) out.push(it.id);
  }
  return out;
}
