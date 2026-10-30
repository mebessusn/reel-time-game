// 40 achievements (design doc section 10), plus 8 for Open Waters (v1.15). Data-driven: { id, name, desc, category, tier, stat, threshold, reward, secret }
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
  // v1.15 Open Waters
  A('ow_trophy', 'Trophy Hunter', 'Land your first big-game fish in Open Waters', 'Open Waters', 'bronze', 'owTrophy', 1, { coins: 500 }),
  A('ow_trophies', 'Big Game Angler', 'Land 50 big-game fish', 'Open Waters', 'silver', 'owTrophy', 50, { pearls: 10, title: 'Big Game Angler' }),
  A('ow_slam', 'Grand Slam', 'Land a sailfish, a blue marlin and a swordfish on one charter', 'Open Waters', 'gold', 'owGrandSlam', 1, { pearls: 20, title: 'Grand Slammer' }),
  A('ow_release', 'Let Them Run', 'Tag and release 10 billfish', 'Open Waters', 'silver', 'owBillRelease', 10, { pearls: 8, title: 'Billfish Friend' }),
  A('ow_reef', 'Reef Ranger', 'Spear every kind of reef fish a speargun can take (8)', 'Open Waters', 'gold', 'owReefSpeared', 8, { pearls: 12, title: 'Reef Ranger' }),
  A('ow_party', 'Beach Champion', 'Win every one of the five beach games on Palm Key', 'Open Waters', 'gold', 'owPartyWins', 5, { pearls: 15, title: 'Beach Champion' }),
  A('ow_whale', 'Whale Watcher', 'See a humpback breach', 'Open Waters', 'silver', 'owBreach', 1, { coins: 400 }),
  A('ow_all', 'Old Salt', 'Catch all 24 fish of Open Waters', 'Open Waters', 'gold', 'oceanSpecies', 24, { pearls: 25, title: 'Old Salt' }),
  // Frostmere (map 3)
  A('fm_hole', 'First Hole', 'Drill a hole through the ice', 'Frostmere', 'bronze', 'fmHoles', 1, { coins: 150 }),
  A('fm_cheese', 'Swiss Cheese', 'Drill 50 holes in the ice', 'Frostmere', 'silver', 'fmHoles', 50, { pearls: 6, title: 'Swiss Cheese' }),
  A('fm_flag', 'Flag!', 'Land a fish from a tip-up', 'Frostmere', 'bronze', 'fmFlags', 1, { coins: 200 }),
  A('fm_triple', 'Triple Flag', 'Have all three of your tip-up flags up at once', 'Frostmere', 'silver', 'fmTriple', 1, { pearls: 6 }),
  A('fm_through', 'Gone Through', 'Fall through thin ice', 'Frostmere', 'bronze', 'fmThrough', 1, { coins: 150, title: 'Soggy' }, { secret: true }),
  A('fm_sauna', 'Sauna Regular', 'Take 5 saunas in Hearthwick', 'Frostmere', 'bronze', 'fmSaunas', 5, { coins: 300 }),
  A('fm_plunge', 'Polar Plunge', 'Plunge through the ice hole straight after a sauna', 'Frostmere', 'silver', 'fmPlunge', 1, { pearls: 5, title: 'Polar Plunger' }),
  A('fm_glide', 'Glider', 'Finish the Long Glide skate race', 'Frostmere', 'bronze', 'fmGlide', 1, { coins: 300 }),
  A('fm_mush', 'Mush!', 'Finish the Frostmere Sled Derby', 'Frostmere', 'bronze', 'fmDerby', 1, { coins: 300 }),
  A('fm_topdog', 'Top Dog', 'Beat June\'s time in the Sled Derby', 'Frostmere', 'gold', 'fmTopDog', 1, { pearls: 12, title: 'Top Dog' }),
  A('fm_bears', 'Bear Aware', 'Photograph a polar bear and its cubs', 'Frostmere', 'silver', 'fmBearCubs', 1, { pearls: 6 }),
  A('fm_aurora', 'Aurora Watcher', 'See the northern lights on 5 nights', 'Frostmere', 'silver', 'fmAuroras', 5, { pearls: 8, title: 'Northern Light' }),
  A('fm_all', 'Frostmere Complete', 'Catch all 14 fish of Frostmere', 'Frostmere', 'gold', 'northSpecies', 14, { pearls: 25, title: 'Ice King' }),
  A('fm_legends', 'Legends of the North', 'Catch the Glacier King, the Old Sleeper and the Aurora Char', 'Frostmere', 'gold', 'northLegends', 3, { pearls: 30, title: 'Legend of the North' }),
  A('fm_flight', 'Above the Clouds', 'Score three stars on a flight with Skye', 'Frostmere', 'silver', 'fmFlight3', 1, { pearls: 6, title: 'Cloud Skipper' }),
  // v1.17 Skye's Air Races
  A('ar_first', 'First Wings', 'Finish an air race', 'Air Races', 'bronze', 'arRaces', 1, { coins: 200 }),
  A('ar_frequent', 'Frequent Flyer', 'Finish 25 air races', 'Air Races', 'silver', 'arRaces', 25, { pearls: 6 }),
  A('ar_win', 'Top of the Podium', 'Win an air race', 'Air Races', 'bronze', 'arWins', 1, { coins: 300 }),
  A('ar_champ', 'Sky Champion', 'Win 25 air races', 'Air Races', 'gold', 'arWins', 25, { pearls: 15, title: 'Sky Champion' }),
  A('ar_golds', 'Golden Wings', 'Win 6 gold medals', 'Air Races', 'silver', 'arGolds', 6, { pearls: 8 }),
  A('ar_allgold', 'Sky Legend', 'Win gold on all twelve circuits', 'Air Races', 'gold', 'arGoldCircuits', 12, { pearls: 30, title: 'Sky Legend' }),
  A('ar_plat', 'Platinum Pilot', 'Beat Skye\'s own time and win (a platinum medal)', 'Air Races', 'gold', 'arPlat', 1, { pearls: 12, title: 'Platinum Pilot' }),
  A('ar_cuts', 'Shortcut Sleuth', 'Find 3 shortcuts', 'Air Races', 'bronze', 'arCuts', 3, { coins: 400 }),
  A('ar_secrets', 'Secret Skies', 'Find all 12 shortcuts', 'Air Races', 'gold', 'arCuts', 12, { pearls: 15, title: 'Pathfinder' }),
  A('ar_tricks', 'Stunt Pilot', 'Pull 100 tricks in air races', 'Air Races', 'silver', 'arTricks', 100, { pearls: 5, title: 'Stunt Pilot' }),
  A('ar_clean', 'Clean Air', 'Finish a race without a crash or a missed gate', 'Air Races', 'bronze', 'arClean', 1, { coins: 300 }),
  A('ar_hurricane', 'Eye of the Storm', 'Win a race in the Hurricane class', 'Air Races', 'gold', 'arHurricane', 1, { pearls: 10 }),
  A('ar_party', 'Wingmates', 'Finish a party air race', 'Air Races', 'bronze', 'arParty', 1, { coins: 300 }),
  A('ar_perfect', 'Lightning Reflexes', 'Make 10 perfect starts', 'Air Races', 'silver', 'arPerfect', 10, { pearls: 5 }),
];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const ACH_TIER_COLOR = { bronze: '#c08a5a', silver: '#c8d0d8', gold: '#f2c040' };
