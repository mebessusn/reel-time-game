// The valley's achievements (design doc section 10); another map adds its own with addAchievements. Data-driven: { id, name, desc, category, tier, stat, threshold, reward, secret }
// stat names are counters kept in profile.stats (see game/rules.js).
import { SPECIES } from './species.js';

// The Fishpedia goals count the valley's own fish, straight from the species list, so the words and the targets can
// never drift from it again (they said 10 / 8 / 6 / 4 / 32 long after the valley had 76). Another map's fish are added
// with addSpecies and never land in SPECIES, so they don't move these. A goal claimed at an old, lower count stays claimed.
const inTier = (tier) => SPECIES.filter((s) => s.tier === tier).length;
const VALLEY = { common: inTier('common'), uncommon: inTier('uncommon'), rare: inTier('rare'), epic: inTier('epic'), all: SPECIES.length };

export const achievement = (id, name, desc, category, tier, stat, threshold, reward, extra = {}) =>
  ({ id, name, desc, category, tier, stat, threshold, reward, ...extra });

export const ACHIEVEMENTS = [
  // First steps
  achievement('first_bite', 'First Bite', 'Catch any fish', 'First steps', 'bronze', 'catches', 1, { coins: 50 }),
  achievement('sea_legs', 'Sea Legs', 'Launch your boat', 'First steps', 'bronze', 'boatLaunches', 1, { coins: 50 }),
  achievement('dressed', 'Dressed for It', 'Finish the avatar creator', 'First steps', 'bronze', 'avatarSaves', 1, { item: 'hat_bucket_tan' }),
  achievement('shop_friend', "Shopkeeper's Friend", 'Buy your first item', 'First steps', 'bronze', 'purchases', 1, { coins: 25 }),
  // Volume
  achievement('busy_bobber', 'Busy Bobber', 'Catch 100 fish', 'Volume', 'bronze', 'catches', 100, { coins: 200 }),
  achievement('busy_bobber_2', 'Busy Bobber II', 'Catch 250 fish', 'Volume', 'silver', 'catches', 250, { coins: 400 }),
  achievement('lake_regular', 'Lake Regular', 'Catch 1,000 fish', 'Volume', 'silver', 'catches', 1000, { pearls: 3 }),
  achievement('busy_bobber_3', 'Busy Bobber III', 'Catch 5,000 fish', 'Volume', 'gold', 'catches', 5000, { pearls: 10 }),
  achievement('lifelong', 'Lifelong Angler', 'Catch 10,000 fish', 'Volume', 'gold', 'catches', 10000, { title: 'Lifelong Angler', item: 'boat_oars_gold' }),
  achievement('while_you_wait', 'While You Wait', 'Catch 50 fish while Claude works', 'Volume', 'silver', 'waitCatches', 50, { item: 'lure_spark' }, { claude: true }), // (only where Claude can be linked: see achievementsFor)
  // Collection
  achievement('pedia_common', 'Fishpedia: Commons', `Catch all ${VALLEY.common} Common species`, 'Collection', 'bronze', 'species_common', VALLEY.common, { coins: 150 }),
  achievement('pedia_uncommon', 'Fishpedia: Uncommons', `Catch all ${VALLEY.uncommon} Uncommon species`, 'Collection', 'silver', 'species_uncommon', VALLEY.uncommon, { coins: 400 }),
  achievement('pedia_rare', 'Fishpedia: Rares', `Catch all ${VALLEY.rare} Rare species`, 'Collection', 'silver', 'species_rare', VALLEY.rare, { pearls: 5 }),
  achievement('pedia_epic', 'Fishpedia: Epics', `Catch all ${VALLEY.epic} Epic species`, 'Collection', 'gold', 'species_epic', VALLEY.epic, { pearls: 10 }),
  achievement('pedia_complete', 'Fishpedia: Complete', `Catch all ${VALLEY.all} species of the Five Lakes`, 'Collection', 'gold', 'speciesCaught', VALLEY.all, { pearls: 25, title: 'Lake Scholar' }),
  achievement('gilded', 'Gilded', 'Catch 10 Gold variants', 'Collection', 'silver', 'golds', 10, { item: 'lure_spinner' }),
  achievement('first_diamond', 'First Diamond', 'Catch any Diamond variant', 'Collection', 'silver', 'diamonds', 1, { pearls: 5 }),
  achievement('diamond_hoard', 'Diamond Hoard', 'Catch 10 Diamond variants', 'Collection', 'gold', 'diamonds', 10, { pearls: 30 }),
  achievement('jewel_case', 'The Jewel Case', 'Catch 32 different species in Diamond', 'Collection', 'gold', 'diamondSpecies', 32, { item: 'boat_crystal', title: 'Jeweller of the Deep' }, { secret: true }),
  // Skill
  achievement('perfect_cast', 'Perfect Cast', 'Make 25 perfect casts', 'Skill', 'bronze', 'perfectCasts', 25, { coins: 100 }),
  achievement('perfect_cast_2', 'Perfect Cast II', 'Make 250 perfect casts', 'Skill', 'silver', 'perfectCasts', 250, { pearls: 3 }),
  achievement('never_let_go', 'Never Let Go', 'Finish 20 reels without slipping', 'Skill', 'silver', 'cleanReels', 20, { pearls: 3 }),
  achievement('big_one', 'The Big One', 'Catch a fish in the top 5% of its weight range', 'Skill', 'silver', 'bigOnes', 1, { pearls: 3 }),
  achievement('record_breaker', 'Record Breaker', 'Set a lake weight record', 'Skill', 'gold', 'records', 1, { pearls: 5, title: 'Record Breaker' }),
  achievement('old_whiskers', 'Whisker Tamer', 'Catch Old Whiskers', 'Skill', 'gold', 'sp_oldwhiskers', 1, { title: 'Whisker Tamer' }),
  achievement('mythic', 'Light in the Deep', 'Catch the Lanternfish of the Ruins', 'Skill', 'gold', 'sp_lanternfish', 1, { pearls: 10, title: 'Ruin Diver' }),
  // Time & weather
  achievement('early_bird', 'Early Bird', 'Catch 10 fish at dawn', 'Time & weather', 'bronze', 'dawnCatches', 10, { item: 'hat_straw' }),
  achievement('night_owl', 'Night Owl', 'Catch 25 fish at night', 'Time & weather', 'bronze', 'nightCatches', 25, { coins: 150 }),
  achievement('night_owl_2', 'Night Owl II', 'Catch 250 fish at night', 'Time & weather', 'silver', 'nightCatches', 250, { pearls: 3 }),
  achievement('rain', 'Singing in the Rain', 'Catch 15 fish in the rain', 'Time & weather', 'silver', 'rainCatches', 15, { item: 'shirt_raincoat_yellow' }),
  achievement('storm_chaser', 'Storm Chaser', 'Catch the Storm Sturgeon', 'Time & weather', 'gold', 'sp_stormsturgeon', 1, { item: 'rod_lightning' }),
  achievement('moonstruck', 'Moonstruck', 'Catch a Moonfin under a full moon', 'Time & weather', 'silver', 'fullMoonMoonfin', 1, { pearls: 5 }),
  // Social
  achievement('good_company', 'Good Company', 'Fish near 3 or more players', 'Social', 'bronze', 'goodCompany', 1, { item: 'emote_clap' }),
  achievement('raft_up', 'Raft Up', 'Tie boats with a friend 10 times', 'Social', 'silver', 'raftUps', 10, { coins: 500 }),
  achievement('release', 'Catch & Release', 'Release 100 fish', 'Social', 'silver', 'releases', 100, { title: 'Good Karma' }),
  achievement('top_board', 'Top of the Board', 'Hold #1 on a weekly board', 'Social', 'gold', 'weeklyWins', 1, { title: 'Champion', pearls: 10 }),
  achievement('cheer', 'Cheerleader', 'React to 25 great catches', 'Social', 'bronze', 'reactions', 25, { coins: 100 }),
  // Secrets & misc
  achievement('messages', 'Message Received', 'Find all 12 bottle messages', 'Secrets', 'gold', 'bottleMessages', 12, { pearls: 10 }, { secret: true }),
  achievement('boots', 'Boot Collector', 'Catch 50 old boots', 'Secrets', 'silver', 'boots', 50, { title: 'Boot Collector' }, { secret: true }),
  achievement('treasure', 'Treasure Hunter', 'Open 10 treasure chests', 'Secrets', 'silver', 'chests', 10, { pearls: 5 }),

];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export function addAchievements(list) { for (const a of list) { ACHIEVEMENTS.push(a); ACH_BY_ID[a.id] = a; } }
/** The achievements this player sees and counts: one that needs Claude linked (`claude: true`) is left out where
 *  linking isn't possible (the standalone game), unless they earned it already. */
export const achievementsFor = (p, claudeHere) => ACHIEVEMENTS.filter((a) => !a.claude || claudeHere || !!p?.achievements?.[a.id]);
export const ACH_TIER_COLOR = { bronze: '#c08a5a', silver: '#c8d0d8', gold: '#f2c040' };
