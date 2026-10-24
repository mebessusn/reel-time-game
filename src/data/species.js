// The 32 species of Cozy Cove (design doc section 6).
// shape: body profile used by the voxel fish builder.
// colors: base, belly, accent (pattern), fin.  pattern: none|stripes|spots|bars|koi|glow|speckle
// times: dawn|day|dusk|night ('any' = all). weather: optional restriction. moonBoost: x3 at full moon.

export const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

// Rarity colours: an Okabe-Ito based set that stays distinct for colour-blind players (and each tier
// also has a shape marker in Settings > Accessibility).
export const TIER_INFO = {
  common:    { name: 'Common',    color: '#8F9A95', coins: 5,   xp: 10,  points: 1,   pearlsTrade: 0 },
  uncommon:  { name: 'Uncommon',  color: '#2E9E6E', coins: 12,  xp: 20,  points: 3,   pearlsTrade: 0 },
  rare:      { name: 'Rare',      color: '#2B7BC0', coins: 30,  xp: 45,  points: 8,   pearlsTrade: 0 },
  epic:      { name: 'Epic',      color: '#8E5BC4', coins: 80,  xp: 90,  points: 20,  pearlsTrade: 0 },
  legendary: { name: 'Legendary', color: '#E8A317', coins: 250, xp: 200, points: 60,  pearlsTrade: 2 },
  mythic:    { name: 'Mythic',    color: '#D9467A', coins: 800, xp: 500, points: 200, pearlsTrade: 6 },
};

export const VARIANTS = {
  normal:  { name: 'Normal',  coinMult: 1,  pointMult: 1 },
  gold:    { name: 'Gold',    coinMult: 5,  pointMult: 3 },
  diamond: { name: 'Diamond', coinMult: 25, pointMult: 10 },
};

// Pearls for trading a Diamond fish in, by tier.
export const DIAMOND_PEARLS = { common: 5, uncommon: 5, rare: 10, epic: 10, legendary: 25, mythic: 25 };

export const BASE_TIER_ODDS = { common: 55, uncommon: 25, rare: 12, epic: 5.5, legendary: 2, mythic: 0.5 };

export const ZONES = {
  dock:     { name: 'The Dock' },
  shallows: { name: 'Reed Shallows' },
  open:     { name: 'Open Water' },
  deep:     { name: 'The Deep' },
  falls:    { name: 'Waterfall Pool' },
  ruins:    { name: 'Sunken Ruins' },
  frost:    { name: 'Frostpine Lake' },
  marsh:    { name: 'Lilymarsh' },
  pond:     { name: 'Fern Pond' },
  quarry:   { name: 'Old Quarry' },
  river:    { name: 'The Waterways' },
  cave:     { name: 'Echo Cavern' },
  cove:     { name: 'Cozy Cove' }, // v1.12: shellfish traps anywhere in the cove
  // v1.14.9 The Wild Woods: four hidden pools and the creeks
  moonwell: { name: 'Moonwell' },
  foxhollow: { name: 'Fox Hollow' },
  mirrortarn: { name: 'Mirror Tarn' },
  lantern: { name: 'Lantern Spring' },
  creek:    { name: 'The Creeks' },
};

const S = (id, name, tier, zones, times, weight, difficulty, behaviour, shape, colors, pattern, extra = {}) =>
  ({ id, name, tier, zones, times, weight, difficulty, behaviour, shape, colors, pattern, ...extra });

export const SPECIES = [
  S('bluegill', 'Bluegill', 'common', ['dock', 'shallows', 'pond', 'moonwell', 'foxhollow', 'mirrortarn', 'lantern'], ['any'], [0.2, 1], 1, 'steady', 'round',
    { base: '#4f7fa8', belly: '#e8b04a', accent: '#2c4f6e', fin: '#3d6488' }, 'bars'),
  S('perch', 'Yellow Perch', 'common', ['dock', 'shallows', 'frost', 'pond', 'mirrortarn', 'moonwell'], ['day'], [0.3, 1.5], 1, 'steady', 'slim',
    { base: '#d8c048', belly: '#f2e6b0', accent: '#4a5a2a', fin: '#e07a30' }, 'bars'),
  S('minnow', 'Fathead Minnow', 'common', ['shallows', 'frost', 'river', 'creek'], ['any'], [0.05, 0.2], 1, 'dart', 'tiny',
    { base: '#8a8f7a', belly: '#d6d6c4', accent: '#5a5f4a', fin: '#7a7f6a' }, 'none'),
  S('pumpkinseed', 'Pumpkinseed Sunfish', 'common', ['shallows', 'marsh', 'pond', 'foxhollow', 'lantern'], ['day'], [0.2, 1], 1, 'steady', 'round',
    { base: '#5f9a6a', belly: '#f0a040', accent: '#3a7ac0', fin: '#6aa070' }, 'spots'),
  S('crappie', 'Black Crappie', 'common', ['dock', 'shallows', 'marsh', 'pond', 'moonwell', 'lantern'], ['dusk', 'night'], [0.5, 2], 1, 'steady', 'round',
    { base: '#c8ccc0', belly: '#eeeee6', accent: '#3a3e36', fin: '#5a5e56' }, 'speckle'),
  S('shiner', 'Golden Shiner', 'common', ['shallows', 'pond', 'river', 'moonwell', 'foxhollow', 'mirrortarn', 'lantern', 'creek'], ['dawn', 'day'], [0.1, 0.5], 1, 'dart', 'slim',
    { base: '#e0c060', belly: '#fff0c0', accent: '#c8a040', fin: '#f0a050' }, 'none'),
  S('bullhead', 'Bullhead', 'common', ['dock', 'marsh'], ['night'], [0.5, 3], 2, 'sink', 'cat',
    { base: '#5a4a32', belly: '#d8c8a0', accent: '#3a2e1e', fin: '#4a3a26' }, 'none'),
  S('rockbass', 'Rock Bass', 'common', ['falls', 'quarry', 'river'], ['any'], [0.3, 1.5], 2, 'steady', 'round',
    { base: '#7a6a4a', belly: '#c8b890', accent: '#3a2e1a', fin: '#6a5a3a' }, 'speckle', { eye: '#c02020' }),
  S('cod', 'Blocky Cod', 'common', ['open', 'deep', 'quarry'], ['any'], [2, 8], 2, 'steady', 'big',
    { base: '#b8a078', belly: '#e8dcc0', accent: '#8a7050', fin: '#a08a68' }, 'speckle'),
  S('carp', 'Common Carp', 'common', ['shallows', 'open', 'marsh'], ['any'], [3, 20], 2, 'sink', 'big',
    { base: '#b08a40', belly: '#e8d090', accent: '#8a6a2a', fin: '#a0602a' }, 'speckle'),
  S('largemouth', 'Largemouth Bass', 'uncommon', ['dock', 'shallows', 'open', 'pond', 'river', 'foxhollow', 'mirrortarn'], ['dawn', 'dusk'], [1, 10], 2, 'jump', 'bass',
    { base: '#5a7a3a', belly: '#e8e8c8', accent: '#2e4a1e', fin: '#4a6a2e' }, 'stripes'),
  S('smallmouth', 'Smallmouth Bass', 'uncommon', ['falls', 'quarry', 'river', 'creek'], ['day'], [1, 6], 2, 'jump', 'bass',
    { base: '#8a7040', belly: '#e0d4b0', accent: '#5a4520', fin: '#7a6030' }, 'bars'),
  S('rainbowtrout', 'Rainbow Trout', 'uncommon', ['falls', 'frost', 'river', 'creek', 'mirrortarn'], ['dawn'], [1, 8], 3, 'jump', 'slim',
    { base: '#8aa0a8', belly: '#f0e8e0', accent: '#e06a8a', fin: '#7a9098' }, 'stripes'),
  S('browntrout', 'Brown Trout', 'uncommon', ['falls', 'frost', 'creek', 'foxhollow'], ['dusk'], [1, 10], 3, 'dart', 'slim',
    { base: '#a0784a', belly: '#f0d8a0', accent: '#c03a2a', fin: '#8a6038' }, 'spots'),
  S('walleye', 'Walleye', 'uncommon', ['open', 'deep', 'frost', 'quarry'], ['dusk', 'night'], [2, 12], 3, 'sink', 'slim',
    { base: '#a8a050', belly: '#f0ecd0', accent: '#5a5420', fin: '#8a8440' }, 'bars', { eye: '#f0f0a0' }),
  S('pike', 'Northern Pike', 'uncommon', ['shallows', 'open', 'marsh', 'river'], ['day'], [3, 20], 3, 'dart', 'long',
    { base: '#4a6a3a', belly: '#e0e0b0', accent: '#d0d890', fin: '#a05a3a' }, 'spots'),
  S('catfish', 'Channel Catfish', 'uncommon', ['dock', 'open', 'deep', 'marsh', 'quarry'], ['night'], [2, 25], 3, 'sink', 'cat',
    { base: '#7a8a98', belly: '#e8eef0', accent: '#3a4450', fin: '#6a7a88' }, 'speckle'),
  S('puffer', 'Pond Pufferfish', 'uncommon', ['shallows', 'marsh'], ['day'], [0.5, 2], 2, 'steady', 'puff',
    { base: '#e8c050', belly: '#f8f0d0', accent: '#6a8a3a', fin: '#d0a040' }, 'spots'),
  S('salmon', 'Sockeye Salmon', 'rare', ['falls', 'frost', 'river'], ['dawn'], [4, 15], 3, 'jump', 'slim',
    { base: '#d04030', belly: '#e87060', accent: '#3a6a3a', fin: '#3a6a3a' }, 'none'),
  S('muskie', 'Muskellunge', 'rare', ['open', 'deep', 'quarry'], ['day'], [10, 40], 4, 'dart', 'long',
    { base: '#9aa070', belly: '#e8e8c8', accent: '#4a5a30', fin: '#b06a3a' }, 'bars'),
  S('sturgeon', 'Lake Sturgeon', 'rare', ['deep', 'quarry'], ['any'], [20, 80], 4, 'sink', 'sturgeon',
    { base: '#6a7078', belly: '#c8ccd0', accent: '#3a4048', fin: '#5a6068' }, 'speckle'),
  S('koi', 'Koi', 'rare', ['shallows', 'marsh', 'pond'], ['day'], [2, 15], 3, 'steady', 'big',
    { base: '#f4f0e8', belly: '#ffffff', accent: '#e8582a', fin: '#f8e8d8' }, 'koi', { weather: ['clear'] }),
  S('char', 'Arctic Char', 'rare', ['deep', 'frost'], ['dawn'], [2, 12], 3, 'dart', 'slim',
    { base: '#4a6a80', belly: '#f08060', accent: '#f0e0e0', fin: '#e06040' }, 'spots', { weatherBoost: ['rain', 'storm'] }),
  S('gar', 'Longnose Gar', 'rare', ['shallows', 'marsh'], ['dusk'], [3, 20], 4, 'dart', 'gar',
    { base: '#8a9060', belly: '#e0e0c0', accent: '#4a4a2a', fin: '#7a7a4a' }, 'spots'),
  S('paddlefish', 'Paddlefish', 'epic', ['deep', 'quarry'], ['day'], [20, 90], 4, 'sink', 'paddle',
    { base: '#7a8a9a', belly: '#d8dee4', accent: '#4a5a6a', fin: '#6a7a8a' }, 'speckle'),
  S('gloweel', 'Glow Eel', 'epic', ['open', 'deep', 'quarry'], ['night'], [2, 10], 4, 'dart', 'eel',
    { base: '#2a5a5a', belly: '#4ae0c0', accent: '#8affe8', fin: '#3a8a80' }, 'glow', { glow: '#6affd8' }),
  S('moonfin', 'Moonfin', 'epic', ['open', 'frost'], ['night'], [3, 18], 4, 'jump', 'round',
    { base: '#c8d0f0', belly: '#f0f4ff', accent: '#8a9ae0', fin: '#e0e8ff' }, 'glow', { glow: '#d8e0ff', moonBoost: true }),
  S('ghostkoi', 'Ghost Koi', 'epic', ['shallows', 'marsh', 'pond'], ['night'], [4, 20], 5, 'steady', 'big',
    { base: '#e8f0f8', belly: '#ffffff', accent: '#a8c8e8', fin: '#d0e0f0' }, 'koi', { weather: ['rain', 'storm'], glow: '#c8e0ff' }),
  S('oldwhiskers', 'Old Whiskers', 'legendary', ['deep'], ['night'], [60, 150], 5, 'sink', 'cat',
    { base: '#4a4030', belly: '#c8b890', accent: '#2a2018', fin: '#3a3020' }, 'speckle', { scale: 1.4 }),
  S('crystalpike', 'Crystal Pike', 'legendary', ['frost'], ['dawn'], [15, 45], 5, 'dart', 'long',
    { base: '#a8e0f0', belly: '#f0faff', accent: '#68c0e0', fin: '#c8f0ff' }, 'glow', { glow: '#b0f0ff', spots: ['frost_poi'] }),
  S('stormsturgeon', 'Storm Sturgeon', 'legendary', ['quarry'], ['any'], [80, 200], 5, 'jump', 'sturgeon',
    { base: '#3a4058', belly: '#a8b0c8', accent: '#f0e060', fin: '#2a3048' }, 'stripes', { weather: ['storm'], scale: 1.4, spots: ['quarry_poi'] }),
  // ---- weather fish: only bite in their weather
  S('greyling', 'Arctic Grayling', 'uncommon', ['river', 'frost', 'falls', 'creek'], ['dawn', 'day', 'dusk'], [0.5, 3], 2, 'steady', 'slim',
    { base: '#7a8494', belly: '#d8dce4', accent: '#5a6a9a', fin: '#9a6aa8' }, 'speckle', { weather: ['overcast'] }),
  S('drizzledace', 'Drizzle Dace', 'uncommon', ['dock', 'shallows', 'river', 'pond', 'marsh', 'creek'], ['any'], [0.2, 1.2], 2, 'dart', 'slim',
    { base: '#8ab0c8', belly: '#eef6fa', accent: '#4a7a98', fin: '#a8c8d8' }, 'stripes', { weather: ['rain', 'storm'] }),
  S('rainspot', 'Rainspotted Trout', 'rare', ['river', 'frost', 'falls', 'pond', 'creek'], ['any'], [2, 9], 3, 'jump', 'long',
    { base: '#6a8a6a', belly: '#e8eedc', accent: '#2a4a8a', fin: '#8aa07a' }, 'spots', { weather: ['rain'] }),
  S('thunderbass', 'Thunder Bass', 'rare', ['open', 'dock', 'shallows', 'frost'], ['any'], [4, 14], 4, 'jump', 'round',
    { base: '#3a4060', belly: '#c8ccd8', accent: '#ffe060', fin: '#2a3050' }, 'stripes', { weather: ['storm'], glow: '#fff080' }),
  // ---- Echo Cavern: only in the flooded cave under Cavern Hill (any hour: it's always dark in there)
  S('cavefish', 'Blind Cavefish', 'common', ['cave'], ['any'], [0.1, 0.8], 1, 'steady', 'slim',
    { base: '#f0d8d0', belly: '#fff4f0', accent: '#e8b8b0', fin: '#f8e0d8' }, 'none'),
  S('glowloach', 'Glowworm Loach', 'uncommon', ['cave'], ['any'], [0.2, 1.5], 2, 'dart', 'eel',
    { base: '#2a3a4a', belly: '#6ae0ff', accent: '#9af0ff', fin: '#3a5a6a' }, 'glow', { glow: '#7ae8ff' }),
  S('albinocat', 'Albino Catfish', 'rare', ['cave'], ['any'], [3, 18], 3, 'sink', 'cat',
    { base: '#f4ece4', belly: '#ffffff', accent: '#e8c8c0', fin: '#f0e0d8' }, 'none'),
  S('geodecarp', 'Geode Carp', 'epic', ['cave'], ['any'], [6, 28], 4, 'steady', 'big',
    { base: '#5a4a7a', belly: '#c8a8f0', accent: '#a8f0e8', fin: '#7a5aa8' }, 'speckle', { glow: '#c8a0ff' }),
  S('echoeel', 'Echo Eel', 'legendary', ['cave'], ['any'], [10, 40], 5, 'dart', 'eel',
    { base: '#1a2a3a', belly: '#3ae0c8', accent: '#e8fff8', fin: '#2a4a5a' }, 'glow', { glow: '#5affe0', scale: 1.3, spots: ['cave_poi'] }),
  // ---- Blood Moon hunters: only under the red moon
  S('piranha', 'Red-Bellied Piranha', 'uncommon', ['dock', 'shallows', 'marsh', 'pond', 'river', 'open'], ['night'], [0.3, 2.5], 3, 'dart', 'round',
    { base: '#7a808a', belly: '#d83a2a', accent: '#4a4e58', fin: '#a83a2a' }, 'speckle', { bloodMoon: true }),
  S('blackpiranha', 'Black Piranha', 'rare', ['open', 'deep', 'river', 'quarry'], ['night'], [1, 6], 4, 'dart', 'round',
    { base: '#2a2a30', belly: '#8a2a2a', accent: '#e8c040', fin: '#1a1a20' }, 'none', { bloodMoon: true }),
  S('snakehead', 'Blood Snakehead', 'rare', ['marsh', 'pond', 'shallows'], ['night'], [2, 12], 4, 'sink', 'eel',
    { base: '#4a3a2a', belly: '#c88a6a', accent: '#a82a2a', fin: '#3a2a1a' }, 'spots', { bloodMoon: true }),
  S('vampirefish', 'Vampire Fish', 'epic', ['river', 'deep', 'falls', 'open'], ['night'], [3, 20], 5, 'jump', 'long',
    { base: '#c8ccd8', belly: '#f0f0f4', accent: '#c82a3a', fin: '#e85a5a' }, 'none', { bloodMoon: true, glow: '#ff5a5a' }),
  S('crimsonwolf', 'Crimson Wolf Fish', 'legendary', ['deep', 'quarry', 'open'], ['night'], [15, 50], 5, 'jump', 'big',
    { base: '#6a1a1a', belly: '#e87a6a', accent: '#ff3a2a', fin: '#4a0a0a' }, 'stripes', { bloodMoon: true, glow: '#ff3a2a', scale: 1.2 }),
  // ---- lake exclusives (v1.13): lakeFish live anywhere in their lake; spots live in its deep end or at its landmark (src/game/spots.js)
  S('millsunfish', 'Mill Sunfish', 'uncommon', ['pond'], ['day', 'dusk'], [0.3, 1.4], 2, 'steady', 'round',
    { base: '#d8a830', belly: '#f4e0a0', accent: '#2a8a8a', fin: '#c87a2a' }, 'bars', { lakeFish: true }),
  S('racerchub', 'Millrace Chub', 'rare', ['pond'], ['dawn', 'day'], [1, 4.5], 3, 'dart', 'slim',
    { base: '#7a8a6a', belly: '#e8e8d0', accent: '#3a4a2a', fin: '#c85a3a' }, 'speckle', { spots: ['pond_deep'] }),
  S('pondsage', 'Pond Sage', 'legendary', ['pond'], ['dawn'], [10, 34], 5, 'steady', 'big',
    { base: '#e8e0c8', belly: '#fffaf0', accent: '#c8902a', fin: '#d8c8a8' }, 'koi', { glow: '#ffe8a8', scale: 1.25, spots: ['pond_poi'] }),
  S('reedbowfin', 'Reed Bowfin', 'rare', ['marsh'], ['any'], [2, 10], 3, 'sink', 'long',
    { base: '#5a6a3a', belly: '#c8c8a0', accent: '#2a3a1a', fin: '#4a8a5a' }, 'spots', { lakeFish: true }),
  S('wreckeel', 'Wreck Eel', 'epic', ['marsh'], ['dusk', 'night'], [4, 18], 4, 'dart', 'eel',
    { base: '#3a3a2a', belly: '#a89a6a', accent: '#c8a040', fin: '#2a2a1a' }, 'speckle', { spots: ['marsh_deep'] }),
  S('bogking', 'Bog King', 'legendary', ['marsh'], ['any'], [30, 95], 5, 'sink', 'gar',
    { base: '#4a5a2a', belly: '#d8d0a0', accent: '#e8c040', fin: '#3a4a1a' }, 'spots', { weather: ['rain', 'storm'], scale: 1.45, spots: ['marsh_poi'] }),
  S('icefin', 'Icefin Whitefish', 'rare', ['frost'], ['any'], [1, 5], 3, 'steady', 'slim',
    { base: '#c8d8e8', belly: '#f8fcff', accent: '#8aa8c8', fin: '#e0f0ff' }, 'none', { lakeFish: true }),
  S('burbot', 'Frost Burbot', 'epic', ['frost'], ['dusk', 'night'], [3, 16], 4, 'sink', 'cat',
    { base: '#5a5a3a', belly: '#d8d8c0', accent: '#2a2a1a', fin: '#4a4a2a' }, 'speckle', { spots: ['frost_deep'] }),
  S('heir', "Leviathan's Heir", 'mythic', ['frost'], ['night'], [20, 60], 5, 'jump', 'bass',
    { base: '#d8e8f0', belly: '#ffffff', accent: '#5ac8e8', fin: '#a8e0f0' }, 'glow', { glow: '#8af0ff', scale: 1.5, spots: ['frost_poi'] }),
  S('slatebass', 'Slate Bass', 'rare', ['quarry'], ['day'], [2, 9], 3, 'jump', 'bass',
    { base: '#5a6470', belly: '#c8ccd0', accent: '#2a3038', fin: '#4a5460' }, 'bars', { lakeFish: true }),
  S('pitlurker', 'Pit Lurker', 'epic', ['quarry'], ['any'], [10, 40], 4, 'sink', 'cat',
    { base: '#2a2a30', belly: '#8a8a90', accent: '#c8a040', fin: '#1a1a20' }, 'speckle', { scale: 1.2, spots: ['quarry_deep'] }),
  S('crystaltetra', 'Crystal Tetra', 'rare', ['cave'], ['any'], [0.1, 0.6], 3, 'dart', 'tiny',
    { base: '#c8f0ff', belly: '#ffffff', accent: '#ff8ad8', fin: '#e8f8ff' }, 'glow', { glow: '#c8a0ff', lakeFish: true }),
  S('grottoghost', 'Grotto Ghost', 'epic', ['cave'], ['any'], [3, 14], 4, 'steady', 'long',
    { base: '#e8f0f4', belly: '#ffffff', accent: '#8ae0ff', fin: '#d0e8f0' }, 'glow', { glow: '#a8f0ff', spots: ['cave_deep'] }),
  // ---- v1.12 shellfish: never on a rod. Crab pots and lobster cages catch them (gear: pot | cage); `lakes`
  // are where they live and `minLevel` the level a trap starts finding them.
  S('crayfish', 'Crayfish', 'common', ['cove', 'pond', 'marsh', 'frost', 'quarry', 'river'], ['any'], [0.05, 0.3], 1, 'sink', 'shell',
    { base: '#a8452a', belly: '#e8a07a', accent: '#6a2a1a', fin: '#a8452a' }, 'none', { shell: 'pot', minLevel: 1 }),
  S('grassshrimp', 'Grass Shrimp', 'common', ['cove', 'pond', 'marsh', 'river'], ['any'], [0.01, 0.06], 1, 'sink', 'shell',
    { base: '#c8e0b0', belly: '#e8f4e0', accent: '#7aa860', fin: '#c8e0b0' }, 'none', { shell: 'pot', minLevel: 1 }),
  S('mussel', 'Freshwater Mussel', 'common', ['cove', 'pond', 'frost', 'river'], ['any'], [0.1, 0.7], 1, 'sink', 'shell',
    { base: '#1c2230', belly: '#e8dcea', accent: '#3a4a5a', fin: '#1c2230' }, 'none', { shell: 'pot', minLevel: 1 }),
  S('mudcrab', 'Mud Crab', 'uncommon', ['pond', 'marsh'], ['any'], [0.3, 1.6], 1, 'sink', 'shell',
    { base: '#6a5a3a', belly: '#d8c8a0', accent: '#3a3020', fin: '#6a5a3a' }, 'none', { shell: 'pot', minLevel: 5 }),
  S('bluecray', 'Blue Crayfish', 'rare', ['marsh', 'pond'], ['any'], [0.1, 0.5], 1, 'sink', 'shell',
    { base: '#2a6ab0', belly: '#a8d0f0', accent: '#1a3a7a', fin: '#2a6ab0' }, 'none', { shell: 'pot', minLevel: 8 }),
  S('signalcray', 'Signal Crayfish', 'uncommon', ['cove', 'frost', 'river'], ['any'], [0.2, 0.9], 1, 'sink', 'shell',
    { base: '#6a5a52', belly: '#d8c8b8', accent: '#8a3a2a', fin: '#6a5a52' }, 'none', { shell: 'cage', minLevel: 15 }),
  S('marron', 'Marron', 'rare', ['pond', 'marsh'], ['any'], [0.5, 3], 1, 'sink', 'shell',
    { base: '#1a2a3a', belly: '#7a8aa0', accent: '#0a1420', fin: '#1a2a3a' }, 'none', { shell: 'cage', minLevel: 18 }),
  S('mittencrab', 'Mitten Crab', 'rare', ['marsh', 'river'], ['any'], [0.3, 1.3], 1, 'sink', 'shell',
    { base: '#5a6a3a', belly: '#c8c89a', accent: '#3a2a1a', fin: '#5a6a3a' }, 'none', { shell: 'cage', minLevel: 20 }),
  S('noblecray', 'Noble Crayfish', 'epic', ['frost'], ['any'], [0.3, 1.1], 1, 'sink', 'shell',
    { base: '#5a3a22', belly: '#c87a5a', accent: '#b0402a', fin: '#5a3a22' }, 'none', { shell: 'cage', minLevel: 24 }),
  S('murraycray', 'Giant Murray Crayfish', 'legendary', ['quarry'], ['any'], [2, 6], 1, 'sink', 'shell',
    { base: '#2a5a5a', belly: '#d8e8e0', accent: '#f4f4f0', fin: '#2a5a5a' }, 'none', { shell: 'cage', minLevel: 35 }),
  S('ghostcray', 'Ghost Crayfish', 'epic', ['cave'], ['any'], [0.2, 0.8], 1, 'sink', 'shell',
    { base: '#e8eef4', belly: '#ffffff', accent: '#c8d8e8', fin: '#e8eef4' }, 'none', { shell: 'cage', minLevel: 36, glow: '#c8e8ff' }),
  // ---- v1.14.9 The Wild Woods: each hidden pool's own fish, and the creeks'
  S('moonsilver', 'Moonwell Silverside', 'rare', ['moonwell'], ['dusk', 'night'], [0.2, 0.9], 2, 'dart', 'slim',
    { base: '#c8d4e8', belly: '#f4f8ff', accent: '#6a7ab0', fin: '#9aa8d0' }, 'glow', { glow: '#cfe0ff', moonBoost: true , lakeFish: true }),
  S('brookie', 'Fox Hollow Brookie', 'rare', ['foxhollow'], ['dawn', 'dusk'], [0.5, 3], 2, 'jump', 'slim',
    { base: '#4a5a3a', belly: '#e87a3a', accent: '#e84a3a', fin: '#d86a3a' }, 'spots', { lakeFish: true }),
  S('cutthroat', 'Mirror Tarn Cutthroat', 'epic', ['mirrortarn'], ['day', 'dawn'], [1, 6], 3, 'jump', 'slim',
    { base: '#a89a5a', belly: '#f0dcc0', accent: '#d83a2a', fin: '#8a7a4a' }, 'speckle', { lakeFish: true }),
  S('lanterndarter', 'Lantern Darter', 'rare', ['lantern'], ['night', 'dusk'], [0.05, 0.3], 2, 'dart', 'tiny',
    { base: '#3a5a4a', belly: '#f0e6b0', accent: '#ffd060', fin: '#f0a040' }, 'glow', { glow: '#ffd060' , lakeFish: true }),
  S('riffledace', 'Riffle Dace', 'uncommon', ['creek'], ['any'], [0.1, 0.6], 1, 'dart', 'slim',
    { base: '#7a8a6a', belly: '#e8e4d0', accent: '#3a4a3a', fin: '#c87a5a' }, 'bars', { lakeFish: true }),
  S('mossback', 'Old Mossback', 'legendary', ['creek'], ['dusk', 'night'], [6, 14], 4, 'jump', 'bass',
    { base: '#4a5a2a', belly: '#d8c890', accent: '#2a3a1a', fin: '#5a6a3a' }, 'speckle', { weather: ['rain', 'storm', 'overcast'] , lakeFish: true }),
  S('lanternfish', 'Lanternfish of the Ruins', 'mythic', ['ruins'], ['night'], [5, 25], 5, 'dart', 'lantern',
    { base: '#2a1a40', belly: '#5a3a80', accent: '#ffd060', fin: '#4a2a70' }, 'glow', { glow: '#ffd060' }),
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

// Junk and treasure (8% of bites).
export const JUNK = [
  { id: 'boot', name: 'Old Boot', weight: 0.6, odds: 30 },
  { id: 'can', name: 'Tin Can', weight: 0.2, odds: 25 },
  { id: 'lilypad', name: 'Lily Pad', weight: 0.1, odds: 20 },
  { id: 'bottle', name: 'Message in a Bottle', weight: 0.4, odds: 15 },
  { id: 'chest', name: 'Treasure Chest', weight: 6, odds: 10 },
];

export const BOTTLE_MESSAGES = [
  'The heron at the shop hums when nobody is buying.',
  'If you hear frogs, the crappie are awake.',
  'Old Whiskers once ate my sandwich. I miss that sandwich.',
  'Count the stars at dusk. Then cast toward the brightest.',
  'The lighthouse keeper left for the city. The light stayed.',
  'Someone carved a fish into the dock. It is smiling.',
  'Rain makes the shy fish brave.',
  'There are stones under the deep water that were once a town.',
  'A full moon pulls the Moonfin up to say hello.',
  'Thank you for waiting with me.',
  'Gus says the best lure is patience. Gus sells lures.',
  'You are allowed to rest. The lake will be here.',
];

/** v1.12: what a rod can catch (everything but shellfish), and the shellfish (traps only). */
export const ROD_SPECIES = SPECIES.filter((s) => !s.shell);
export const SHELLFISH = SPECIES.filter((s) => s.shell);
/** Fishpedia entries: every species in normal, gold and diamond. */
export const PEDIA_SLOTS = SPECIES.length * 3;
