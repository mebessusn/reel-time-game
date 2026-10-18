// Seasons turn every real week; each brings its own fish, particles, tint and wind.
const WEEK = 7 * 86400000;
const FORCED_SEASON = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('season') : null;
export const SEASONS = {
  spring: { name: 'Spring', fish: ['rainbowtrout', 'salmon', 'shiner', 'crappie', 'koi'], particle: '#f8c0d8', tint: '#fff4f6', wind: 0.35, blurb: 'Blossoms drift over the water. Trout, salmon and koi are lively.' },
  summer: { name: 'Summer', fish: ['largemouth', 'smallmouth', 'bluegill', 'pumpkinseed', 'carp', 'gar'], particle: '#f8f080', tint: '#fffaf0', wind: 0.22, blurb: 'Long warm days. Bass, sunfish and carp are biting.' },
  autumn: { name: 'Autumn', fish: ['pike', 'muskie', 'walleye', 'browntrout', 'catfish'], particle: '#e08a3a', tint: '#fff0dc', wind: 0.5, blurb: 'Leaves fall and the predators feed up for winter: pike, muskie, walleye.' },
  winter: { name: 'Winter', fish: ['char', 'perch', 'cod', 'sturgeon', 'crystalpike'], particle: '#ffffff', tint: '#eef4ff', wind: 0.45, blurb: 'Snow on the docks. Cold-water fish come up: char, perch, cod, sturgeon.' },
};
const ORDER = ['spring', 'summer', 'autumn', 'winter'];

/** Pure: the season for a moment (each lasts one real week). */
export function seasonFor(now = Date.now()) {
  if (FORCED_SEASON && SEASONS[FORCED_SEASON]) return FORCED_SEASON;
  return ORDER[Math.floor(now / WEEK) % 4];
}

/** Pure: weight multiplier for a species this season. */
export function seasonBoost(season, speciesId) { return SEASONS[season]?.fish.includes(speciesId) ? 2 : 1; }

