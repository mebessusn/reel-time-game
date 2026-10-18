// 40 achievements (design doc section 10). Data-driven: { id, name, desc, category, tier, stat, threshold, reward, secret }
// stat names are counters kept in profile.stats (see game/rules.js).

const A = (id, name, desc, category, tier, stat, threshold, reward, extra = {}) =>
  ({ id, name, desc, category, tier, stat, threshold, reward, ...extra });

export const ACHIEVEMENTS = [
  // First steps
  A('first_bite', 'First Bite', 'Catch any fish', 'First steps', 'bronze', 'catches', 1, { coins: 50 }),
  A('sea_legs', 'Sea Legs', 'Launch your boat', 'First steps', 'bronze', 'boatLaunches', 1, { coins: 50 }),
  A('dressed', 'Dressed for It', 'Finish the avatar creator', 'First steps', 'bronze', 'avatarSaves', 1, { item: 'hat_bucket_tan' }),
  A('shop_friend', "Shopkeeper's Friend", 'Buy your first item', 'First steps', 'bronze', 'purchases', 1, { coins: 25 }),
  // Volume
  A('busy_bobber', 'Busy Bobber', 'Catch 100 fish', 'Volume', 'bronze', 'catches', 100, { coins: 200 }),
  A('busy_bobber_2', 'Busy Bobber II', 'Catch 250 fish', 'Volume', 'silver', 'catches', 250, { coins: 400 }),
  A('lake_regular', 'Lake Regular', 'Catch 1,000 fish', 'Volume', 'silver', 'catches', 1000, { pearls: 3 }),
  A('busy_bobber_3', 'Busy Bobber III', 'Catch 5,000 fish', 'Volume', 'gold', 'catches', 5000, { pearls: 10 }),
  A('lifelong', 'Lifelong Angler', 'Catch 10,000 fish', 'Volume', 'gold', 'catches', 10000, { title: 'Lifelong Angler', item: 'boat_oars_gold' }),
  A('while_you_wait', 'While You Wait', 'Catch 50 fish while Claude works', 'Volume', 'silver', 'waitCatches', 50, { item: 'lure_spark' }),
  // Collection
  A('pedia_common', 'Fishpedia: Commons', 'Catch all 10 Common species', 'Collection', 'bronze', 'species_common', 10, { coins: 150 }),
  A('pedia_uncommon', 'Fishpedia: Uncommons', 'Catch all 8 Uncommon species', 'Collection', 'silver', 'species_uncommon', 8, { coins: 400 }),
  A('pedia_rare', 'Fishpedia: Rares', 'Catch all 6 Rare species', 'Collection', 'silver', 'species_rare', 6, { pearls: 5 }),
  A('pedia_epic', 'Fishpedia: Epics', 'Catch all 4 Epic species', 'Collection', 'gold', 'species_epic', 4, { pearls: 10 }),
  A('pedia_complete', 'Fishpedia: Complete', 'Catch all 32 species', 'Collection', 'gold', 'speciesCaught', 32, { pearls: 25, title: 'Lake Scholar' }),
  A('gilded', 'Gilded', 'Catch 10 Gold variants', 'Collection', 'silver', 'golds', 10, { item: 'lure_spinner' }),
  A('first_diamond', 'First Diamond', 'Catch any Diamond variant', 'Collection', 'silver', 'diamonds', 1, { pearls: 5 }),
  A('diamond_hoard', 'Diamond Hoard', 'Catch 10 Diamond variants', 'Collection', 'gold', 'diamonds', 10, { pearls: 30 }),
  A('jewel_case', 'The Jewel Case', 'Catch every species in Diamond', 'Collection', 'gold', 'diamondSpecies', 32, { item: 'boat_crystal', title: 'Jeweller of the Deep' }, { secret: true }),
  // Skill
  A('perfect_cast', 'Perfect Cast', 'Make 25 perfect casts', 'Skill', 'bronze', 'perfectCasts', 25, { coins: 100 }),
  A('perfect_cast_2', 'Perfect Cast II', 'Make 250 perfect casts', 'Skill', 'silver', 'perfectCasts', 250, { pearls: 3 }),
  A('never_let_go', 'Never Let Go', 'Finish 20 reels without slipping', 'Skill', 'silver', 'cleanReels', 20, { pearls: 3 }),
  A('big_one', 'The Big One', 'Catch a fish in the top 5% of its weight range', 'Skill', 'silver', 'bigOnes', 1, { pearls: 3 }),
  A('record_breaker', 'Record Breaker', 'Set a lake weight record', 'Skill', 'gold', 'records', 1, { pearls: 5, title: 'Record Breaker' }),
  A('old_whiskers', 'Whisker Tamer', 'Catch Old Whiskers', 'Skill', 'gold', 'sp_oldwhiskers', 1, { title: 'Whisker Tamer' }),
  A('mythic', 'Light in the Deep', 'Catch the Lanternfish of the Ruins', 'Skill', 'gold', 'sp_lanternfish', 1, { pearls: 10, title: 'Ruin Diver' }),
  // Time & weather
  A('early_bird', 'Early Bird', 'Catch 10 fish at dawn', 'Time & weather', 'bronze', 'dawnCatches', 10, { item: 'hat_straw' }),
  A('night_owl', 'Night Owl', 'Catch 25 fish at night', 'Time & weather', 'bronze', 'nightCatches', 25, { coins: 150 }),
  A('night_owl_2', 'Night Owl II', 'Catch 250 fish at night', 'Time & weather', 'silver', 'nightCatches', 250, { pearls: 3 }),
  A('rain', 'Singing in the Rain', 'Catch 15 fish in the rain', 'Time & weather', 'silver', 'rainCatches', 15, { item: 'shirt_raincoat_yellow' }),
  A('storm_chaser', 'Storm Chaser', 'Catch the Storm Sturgeon', 'Time & weather', 'gold', 'sp_stormsturgeon', 1, { item: 'rod_lightning' }),
  A('moonstruck', 'Moonstruck', 'Catch a Moonfin under a full moon', 'Time & weather', 'silver', 'fullMoonMoonfin', 1, { pearls: 5 }),
  // Social
  A('good_company', 'Good Company', 'Fish near 3 or more players', 'Social', 'bronze', 'goodCompany', 1, { item: 'emote_clap' }),
  A('raft_up', 'Raft Up', 'Tie boats with a friend 10 times', 'Social', 'silver', 'raftUps', 10, { coins: 500 }),
  A('release', 'Catch & Release', 'Release 100 fish', 'Social', 'silver', 'releases', 100, { title: 'Good Karma' }),
  A('top_board', 'Top of the Board', 'Hold #1 on a weekly board', 'Social', 'gold', 'weeklyWins', 1, { title: 'Champion', pearls: 10 }),
  A('cheer', 'Cheerleader', 'React to 25 great catches', 'Social', 'bronze', 'reactions', 25, { coins: 100 }),
  // Secrets & misc
  A('messages', 'Message Received', 'Find all 12 bottle messages', 'Secrets', 'gold', 'bottleMessages', 12, { pearls: 10 }, { secret: true }),
  A('boots', 'Boot Collector', 'Catch 50 old boots', 'Secrets', 'silver', 'boots', 50, { title: 'Boot Collector' }, { secret: true }),
  A('treasure', 'Treasure Hunter', 'Open 10 treasure chests', 'Secrets', 'silver', 'chests', 10, { pearls: 5 }),
];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const ACH_TIER_COLOR = { bronze: '#c08a5a', silver: '#c8d0d8', gold: '#f2c040' };
