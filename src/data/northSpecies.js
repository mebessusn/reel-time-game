// Frostmere (map 3): the north's fish. Like the sea's (oceanSpecies.js) they're kept out of SPECIES (the valley's
// Fishpedia and "catch every fish" goals count those) but registered in SPECIES_BY_ID, so a caught one works
// everywhere a fish does. Fished through the ice (src/north/ice.js), or in the open water at the Floe Edge, the
// springs and the falls' pool.
//
// Zones (src/north/geo.js zoneOf): bay (Hearthwick's shallow bay), frostmere (the open lake), basin (the deep
// basins), ridge (along the pressure ridge, thin ice), rivermouth, glide (the Long Glide river), floe (the Floe
// Edge, the sea), springs (Steamhole Springs), fallspool (the Frozen Falls' pool).
// aurora: only bites while the aurora is out. glowFlasher: shows as a glowing mark on the flasher.
export const NORTH_ZONES = {
  bay: { name: 'Hearthwick Bay' },
  frostmere: { name: 'Frostmere' },
  basin: { name: 'The Deep Basin' },
  ridge: { name: 'The Pressure Ridge' },
  rivermouth: { name: 'The River Mouth' },
  glide: { name: 'The Long Glide' },
  floe: { name: 'The Floe Edge' },
  springs: { name: 'Steamhole Springs' },
  fallspool: { name: 'The Frozen Falls' },
  hollow: { name: 'Ember Hollow' },
};

const S = (id, name, tier, zones, times, weight, difficulty, behaviour, shape, colors, pattern, extra = {}) =>
  ({ id, name, tier, zones, times, weight, difficulty, behaviour, shape, colors, pattern, north: true, ...extra });

export const NORTH_SPECIES = [
  S('stickleback', 'Ninespine Stickleback', 'common', ['bay', 'frostmere', 'glide'], ['any'], [0.02, 0.12], 1, 'dart', 'tiny',
    { base: '#7a8a5a', belly: '#d8dcc0', accent: '#3a4428', fin: '#8a9468' }, 'bars',
    { depth: 0.25, desc: 'A tiny, spiny scrap of a fish that lives where nothing else will. Nine little spines along its back, and the nerve of a fish ten times its size.' }),
  S('cisco', 'Cisco', 'common', ['frostmere', 'basin', 'bay'], ['any'], [0.2, 1.4], 1, 'dart', 'slim',
    { base: '#a8b8c4', belly: '#eef2f4', accent: '#4a6a84', fin: '#8aa0b0' }, 'none',
    { depth: 0.6, school: true, desc: 'The lake herring: silver, schooling, and the reason the lake trout get so big. On the flasher a cisco school looks like rain falling upward.' }),
  S('capelin', 'Capelin', 'common', ['floe'], ['any'], [0.03, 0.12], 1, 'dart', 'slim',
    { base: '#6a8a6a', belly: '#e8ece4', accent: '#2a4a3a', fin: '#7a9a80' }, 'none',
    { depth: 0.4, school: true, desc: 'Little silver-green smelt that come in from the sea in clouds. Everything up here eats them: cod, seals, whales and Grandma Elsi.' }),
  S('roundwhitefish', 'Round Whitefish', 'uncommon', ['frostmere', 'glide', 'bay', 'rivermouth'], ['dawn', 'day', 'dusk'], [0.5, 2.5], 2, 'steady', 'slim',
    { base: '#b8a888', belly: '#f2ece0', accent: '#6a5a40', fin: '#a89878' }, 'speckle',
    { depth: 0.85, desc: 'A round-bodied whitefish with a little pointed snout, built for grubbing along the bottom. Smoked, it\'s the best thing in Hearthwick.' }),
  S('sculpin', 'Fourhorn Sculpin', 'uncommon', ['floe', 'basin'], ['any'], [0.2, 1.2], 2, 'sink', 'cat',
    { base: '#6a5a48', belly: '#c8b898', accent: '#2a2018', fin: '#7a6a50' }, 'speckle',
    { depth: 0.98, desc: 'A big-headed, bony-knobbed bottom fish with four little horns on its head. It sits on the mud looking cross and eats whatever comes past.' }),
  S('arcticcod', 'Arctic Cod', 'uncommon', ['floe'], ['any'], [0.2, 1.5], 2, 'steady', 'big',
    { base: '#8a8478', belly: '#e4e0d6', accent: '#4a443a', fin: '#7a7468' }, 'speckle',
    { depth: 0.7, desc: 'The little cod of the sea ice, with antifreeze in its blood. It hides in the cracks under the floes, and half the north lives on it.' }),
  S('dollyvarden', 'Dolly Varden', 'rare', ['fallspool', 'glide'], ['dawn', 'dusk'], [1, 6], 3, 'jump', 'slim',
    { base: '#5a6a5a', belly: '#f0c8a0', accent: '#e85a5a', fin: '#d86a48' }, 'spots',
    { depth: 0.6, desc: 'A char named after a dress: olive green with pink and red spots, like the calico gowns of a Dickens character. It loves cold, fast water.' }),
  S('laketrout', 'Lake Trout', 'rare', ['basin', 'ridge', 'frostmere'], ['any'], [3, 18], 4, 'sink', 'slim',
    { base: '#4a5a52', belly: '#e8e4d8', accent: '#c8ccbc', fin: '#6a7268' }, 'speckle',
    { depth: 0.95, desc: 'The grey ghost of the deep basin. Pale spots on dark olive, a forked tail, and a fight that goes straight down. They live for decades.' }),
  S('sheefish', 'Sheefish', 'rare', ['rivermouth', 'glide'], ['day', 'dusk'], [3, 20], 4, 'jump', 'tarpon',
    { base: '#c8ccd0', belly: '#f4f6f8', accent: '#6a7480', fin: '#a8b0b8' }, 'none',
    { depth: 0.5, desc: 'The inconnu, "the unknown one": a huge silver whitefish with a jutting jaw that hunts like a tarpon of the north. It leaps when hooked.' }),
  S('halibut', 'Greenland Halibut', 'epic', ['floe'], ['dusk', 'night'], [5, 40], 5, 'sink', 'grouper',
    { base: '#3a3a3e', belly: '#5a5a62', accent: '#1a1a1e', fin: '#2a2a2e' }, 'none',
    { depth: 1.0, desc: 'A dark flatfish of the cold deep that swims upright, unlike its cousins, with one eye slowly drifting to the top of its head. Comes up from far below the floe edge.' }),
  S('ghostcisco', 'Ghostlight Cisco', 'epic', ['frostmere', 'basin'], ['night'], [0.5, 3], 4, 'dart', 'slim',
    { base: '#c8e8f0', belly: '#ffffff', accent: '#6af0ff', fin: '#a0f4ff' }, 'glow',
    { depth: 0.55, glow: '#7af4ff', glowFlasher: true, desc: 'A cisco that glows a faint blue-white on the darkest nights. On the flasher it shows as a bright, shimmering mark. Nobody knows why it glows, and it isn\'t telling.' }),
  S('glacierking', 'Glacier King', 'legendary', ['ridge'], ['any'], [25, 60], 6, 'sink', 'slim',
    { base: '#2a3a44', belly: '#d8e8f0', accent: '#8adcff', fin: '#4a6a7a' }, 'glow',
    { depth: 1.0, weather: ['storm', 'rain'], glow: '#9ae4ff', desc: 'A lake trout older than the village, as long as a man, with frost-blue spots that glitter like the glacier. It comes up under the pressure ridge only in a snowstorm. Torvald saw it once.' }),
  S('oldsleeper', 'The Old Sleeper', 'legendary', ['floe'], ['night', 'dawn'], [80, 400], 6, 'sink', 'shark',
    { base: '#4a4e52', belly: '#6a6e72', accent: '#2a2e32', fin: '#3a3e42' }, 'speckle',
    { depth: 1.0, desc: 'A Greenland shark, slow as a dream and hundreds of years old. It was swimming under this ice before the Valiant came. Hooking it is easy; landing it takes everything you have.' }),
  S('emberperch', 'Ember Perch', 'uncommon', ['hollow'], ['any'], [0.4, 2.5], 2, 'dart', 'slim',
    { base: '#b8683a', belly: '#f2d8b0', accent: '#7a3418', fin: '#d88a4a' }, 'bars',
    { depth: 0.4, desc: 'A little copper perch that has never once felt cold. It lives in the warm pools of Ember Hollow and sulks if the water drops below a bath.' }),
  S('steameel', 'Steam Eel', 'epic', ['hollow'], ['dusk', 'night'], [2, 9], 4, 'sink', 'slim',
    { base: '#5a3a44', belly: '#d8a8a0', accent: '#e8703a', fin: '#8a4a4a' }, 'glow',
    { depth: 0.7, glow: '#ff9a5a', desc: 'A long dark eel that winds along the vents under the pools, faintly lit from inside like a coal.' }),
  S('spiritwhitefish', 'Spirit Whitefish', 'mythic', ['frostmere', 'basin', 'floe'], ['night'], [3, 14], 5, 'sink', 'slim',
    { base: '#7ae8c8', belly: '#f0fff8', accent: '#c87aff', fin: '#9affd8' }, 'glow',
    { depth: 0.8, aurora: true, great: true, glow: '#8affc8', glowFlasher: true, desc: 'Only ever seen on a Great Aurora night, when the whole sky moves. Half fish and half light. Hold one up and you can see the stars through it.' }),
  S('aurorachar', 'Aurora Char', 'mythic', ['springs'], ['night'], [2, 10], 5, 'jump', 'slim',
    { base: '#2a6a5a', belly: '#f0a0c8', accent: '#7aff9a', fin: '#c87aff' }, 'glow',
    { depth: 0.5, aurora: true, glow: '#7affb0', desc: 'A char that only rises in the steaming springs while the northern lights are out. Its sides ripple green and violet like the sky above it. The rarest fish in the north.' }),
];
export const NORTH_BY_ID = Object.fromEntries(NORTH_SPECIES.map((s) => [s.id, s]));
