// Open Waters (v1.15): the sea's fish. Kept apart from SPECIES (the valley's Fishpedia, collections and
// "catch every fish" goals count those), but registered in SPECIES_BY_ID so a caught one works everywhere a
// fish does: the creel, selling, the catch card, the trophy wall.
//
// big: a big-game fish, fought from the fighting chair with the crew (src/ocean/bigfight.js).
// value: coins and XP at the top weight (big fish pay for the charter); weatherBoost: twice as likely then.
// Zones: nearshore (Marlowe's Mooring), weedline, bluewater (the Deep Blue), openocean (between spots), and in
// stage 2 canyon, reef, lagoon and shore.
export const OCEAN_ZONES = {
  nearshore: { name: "Marlowe's Mooring" },
  weedline: { name: 'The Weed Line' },
  bluewater: { name: 'The Deep Blue' },
  openocean: { name: 'Open Ocean' },
  canyon: { name: 'The Canyon' },
  abyss: { name: 'The Abyss' }, // v1.15.12: Marlowe's deepest water, once he trusts you
  reef: { name: 'Reef Edge' },
  lagoon: { name: 'Turtle Lagoon' },
  shore: { name: 'Island Shallows' },
  // v1.15.19 Deep Blue
  coralhaven: { name: 'Coralhaven' },
  wreck: { name: 'The Marigold' },
  vents: { name: 'Emberkey Vents' },
};

const S = (id, name, tier, zones, times, weight, difficulty, behaviour, shape, colors, pattern, extra = {}) =>
  ({ id, name, tier, zones, times, weight, difficulty, behaviour, shape, colors, pattern, ocean: true, ...extra });

export const OCEAN_SPECIES = [
  // ---- stage 1: the big six
  S('mahi', 'Mahi-mahi', 'uncommon', ['weedline', 'openocean', 'nearshore'], ['dawn', 'day', 'dusk'], [8, 60], 4, 'jump', 'mahi',
    { base: '#2f9e6e', belly: '#f2d03a', accent: '#2f78c8', fin: '#2a8ac8' }, 'spots',
    { big: true, value: { coins: 220, xp: 150 }, weatherBoost: ['clear', 'overcast'], scale: 1.5, fact: 'Lit up green, gold and blue in the water; the colours fade fast once it is landed. They love floating weed.' }),
  S('wahoo', 'Wahoo', 'rare', ['weedline', 'bluewater', 'openocean'], ['dawn', 'dusk'], [15, 110], 5, 'dart', 'wahoo',
    { base: '#2a5f92', belly: '#d6dde2', accent: '#1a3560', fin: '#244a70' }, 'bars',
    { big: true, value: { coins: 300, xp: 200 }, weatherBoost: ['overcast', 'rain'], scale: 1.7, fact: 'One of the fastest fish in the sea: the first run strips line off the reel in seconds.' }),
  S('yellowfin', 'Yellowfin Tuna', 'rare', ['bluewater', 'openocean', 'abyss'], ['dawn', 'day', 'dusk'], [30, 300], 6, 'sink', 'tuna',
    { base: '#1f3d6e', belly: '#d8dde4', accent: '#f2c230', fin: '#f0c020' }, 'none',
    { big: true, value: { coins: 420, xp: 280 }, weatherBoost: ['overcast', 'rain'], scale: 1.9, fact: 'A tuna never stops swimming. Hooked, it dives deep and circles under the boat: a long, dogged fight.' }),
  S('gt', 'Giant Trevally', 'rare', ['nearshore', 'reef', 'vents'], ['any'], [15, 140], 6, 'steady', 'jack',
    { base: '#8a9298', belly: '#d8dcdc', accent: '#30343a', fin: '#2a2e34' }, 'speckle',
    { big: true, value: { coins: 380, xp: 260 }, weatherBoost: ['storm'], scale: 1.6, fact: 'The bully of the reef. It bulldogs for the rocks the moment it feels the hook.' }),
  S('sailfish', 'Sailfish', 'epic', ['weedline', 'bluewater'], ['day'], [40, 140], 7, 'jump', 'billfish',
    { base: '#1d3f7a', belly: '#e2e6ec', accent: '#6aa8e0', fin: '#2a4f9a' }, 'bars',
    { big: true, value: { coins: 600, xp: 400 }, weatherBoost: ['clear'], scale: 2.1, fact: 'Raises its great blue sail to herd baitfish, and tail-walks across the surface when hooked.' }),
  S('mako', 'Shortfin Mako', 'epic', ['bluewater', 'canyon', 'abyss'], ['any'], [80, 500], 8, 'jump', 'shark',
    { base: '#2f5a9a', belly: '#eef0f2', accent: '#22406e', fin: '#2c4e86' }, 'none',
    { big: true, value: { coins: 600, xp: 400 }, weatherBoost: ['rain', 'storm'], scale: 2.2, fact: 'The fastest shark there is, and a famous leaper: makos have cleared a boat\'s rail.' }),
  // ---- stage 2: the other six big-game fish
  S('bluefin', 'Bluefin Tuna', 'legendary', ['bluewater', 'canyon', 'abyss'], ['dawn', 'day'], [180, 900], 9, 'sink', 'tuna',
    { base: '#1a2c52', belly: '#dfe3ea', accent: '#c8d0dc', fin: '#f0c020' }, 'none',
    { big: true, pace: 0.6, value: { coins: 900, xp: 600 }, weatherBoost: ['overcast'], scale: 2.4, fact: 'The giant of the tunas, warm-blooded and built like a torpedo. A marathon fight: bring the whole crew.' }),
  S('marlin', 'Blue Marlin', 'legendary', ['bluewater', 'abyss'], ['day', 'dusk'], [300, 1200], 8, 'jump', 'billfish',
    { base: '#14306a', belly: '#e6eaf0', accent: '#5aa0e8', fin: '#203f80' }, 'bars',
    { big: true, pace: 0.6, value: { coins: 1200, xp: 800 }, weatherBoost: ['clear'], scale: 2.7, fact: 'The headline catch of big-game fishing. It lights up neon blue when it hunts and greyhounds across the waves when hooked.' }),
  S('swordfish', 'Swordfish', 'epic', ['canyon', 'bluewater', 'abyss'], ['night'], [150, 700], 9, 'sink', 'sword',
    { base: '#3a3048', belly: '#c8c4cc', accent: '#2a2236', fin: '#2e2638' }, 'none',
    { deep: true, big: true, pace: 0.7, value: { coins: 750, xp: 480 }, scale: 2.4, fact: 'Hunts in the deep by day and rises at night. It warms its eyes and brain with a special organ to see in the cold.' }),
  S('hammerhead', 'Great Hammerhead', 'epic', ['nearshore', 'reef'], ['dusk'], [200, 900], 8, 'steady', 'hammer',
    { base: '#7d8a92', belly: '#e8ecee', accent: '#5a666e', fin: '#6a767e' }, 'none',
    { big: true, pace: 0.75, value: { coins: 700, xp: 450 }, weatherBoost: ['overcast'], scale: 2.4, fact: 'The hammer is a wide-set pair of eyes and a sense for buried rays. It cruises the island edges at dusk.' }),
  S('greatwhite', 'Great White Shark', 'legendary', ['bluewater', 'openocean', 'canyon', 'nearshore', 'abyss'], ['any'], [800, 2500], 9, 'jump', 'shark',
    { base: '#5d6a74', belly: '#f2f2f0', accent: '#46525a', fin: '#55626c' }, 'none',
    { big: true, pace: 0.7, weather: ['storm'], value: { coins: 1500, xp: 1000 }, scale: 3.1, fact: 'Only shows itself in a storm out here. The hardest fight in the game, and the one everybody talks about after.' }),
  S('giantsquid', 'Giant Squid', 'legendary', ['canyon', 'abyss'], ['night'], [200, 600], 9, 'sink', 'squid',
    { base: '#b8443a', belly: '#e8b0a0', accent: '#7a1f1a', fin: '#b8443a' }, 'none',
    { deep: true, big: true, pace: 0.6, mesh: 'ceph', ink: true, tow: true, value: { coins: 1000, xp: 700 }, scale: 2.4, fact: 'Eyes the size of dinner plates. It squirts ink and hauls on the line hard enough to tow the boat.' }),
  // ---- stage 2: the islands' tropical fish (from the beach, the jetties and the boat near the reefs)
  S('clownfish', 'Clownfish', 'common', ['lagoon', 'reef', 'coralhaven'], ['any'], [0.05, 0.4], 1, 'dart', 'tiny',
    { base: '#f07a1e', belly: '#f6a050', accent: '#ffffff', fin: '#e06010' }, 'bars', { tropical: true, fact: 'Lives safe among the stinging arms of an anemone.' }),
  S('bluetang', 'Blue Tang', 'common', ['lagoon', 'reef', 'shore', 'coralhaven'], ['day', 'dawn', 'dusk'], [0.2, 1.4], 1, 'dart', 'tang',
    { base: '#1f5fd0', belly: '#3a7ae0', accent: '#0e2050', fin: '#f2d02a' }, 'none', { tropical: true, fact: 'A sharp little scalpel by its tail gives it the name surgeonfish.' }),
  S('snapper', 'Red Snapper', 'common', ['shore', 'reef', 'nearshore', 'wreck', 'coralhaven'], ['any'], [2, 25], 2, 'steady', 'bass',
    { base: '#d84a3a', belly: '#f6c0b0', accent: '#a02a20', fin: '#e06050' }, 'none', { tropical: true, fact: 'Snaps at anything that moves near the reef ledges.' }),
  S('parrotfish', 'Parrotfish', 'uncommon', ['reef', 'lagoon', 'coralhaven'], ['day'], [2, 20], 2, 'steady', 'parrot',
    { base: '#2ab0a0', belly: '#f0a0c0', accent: '#e05aa0', fin: '#2a90d0' }, 'speckle', { tropical: true, fact: 'Bites coral with a beak of fused teeth. Much of the white sand on the beach went through a parrotfish.' }),
  S('triggerfish', 'Triggerfish', 'uncommon', ['reef', 'coralhaven', 'wreck'], ['day', 'dusk'], [1, 8], 3, 'steady', 'trigger',
    { base: '#5a6a3a', belly: '#e8d878', accent: '#2a6ad0', fin: '#f0a020' }, 'spots', { tropical: true, fact: 'Locks its front spine upright to wedge itself into a hole in the reef.' }),
  S('moorishidol', 'Moorish Idol', 'rare', ['lagoon', 'reef', 'coralhaven'], ['day'], [0.2, 1.2], 2, 'dart', 'idol',
    { base: '#f4f0e0', belly: '#ffffff', accent: '#1a1a1a', fin: '#f2c020' }, 'bars', { tropical: true, fact: 'Trails a long white streamer from its back fin like a banner.' }),
  S('bonefish', 'Bonefish', 'rare', ['lagoon', 'shore'], ['dawn', 'dusk'], [2, 14], 4, 'dart', 'slim',
    { base: '#c8d4dc', belly: '#f4f8fa', accent: '#8a9aa4', fin: '#a8b8c0' }, 'none', { tropical: true, fact: 'The grey ghost of the flats: tails in the shallows, then runs like a rocket.' }),
  S('barracuda', 'Great Barracuda', 'rare', ['reef', 'shore', 'nearshore', 'wreck'], ['any'], [5, 60], 5, 'dart', 'cuda',
    { base: '#7a8a94', belly: '#e4eaee', accent: '#2a3238', fin: '#4a5860' }, 'bars', { tropical: true, fact: 'Hangs motionless, then strikes faster than the eye. All teeth and curiosity.' }),
  S('tarpon', 'Tarpon', 'epic', ['shore', 'lagoon'], ['dusk', 'night'], [40, 200], 7, 'jump', 'tarpon',
    { base: '#8a9aa8', belly: '#f2f4f6', accent: '#3a4a58', fin: '#5a6a78' }, 'none',
    { tropical: true, big: true, pace: 0.8, value: { coins: 500, xp: 340 }, scale: 1.8, fact: 'The silver king: scales like coins, and it leaps clear of the water again and again.' }),
  // spear only (stage 3: diving at Turtle Atoll and Smuggler's Rock)
  S('lionfish', 'Lionfish', 'rare', ['reef'], ['any'], [0.4, 2.6], 2, 'steady', 'lion',
    { base: '#c8402a', belly: '#f2e0d0', accent: '#fff4ea', fin: '#d86a50' }, 'bars', { tropical: true, spear: true, fact: 'Beautiful, venomous and eats everything on the reef. Spear one and the reef thanks you.' }),
  S('grouper', 'Goliath Grouper', 'epic', ['reef', 'wreck'], ['any'], [40, 400], 6, 'sink', 'grouper',
    { base: '#6a5a3a', belly: '#b8a880', accent: '#3a2e1a', fin: '#5a4a2e' }, 'spots', { tropical: true, spear: true, scale: 2.0, fact: 'Lives in caves and wrecks and can weigh as much as a piano.' }),
  S('octopus', 'Reef Octopus', 'uncommon', ['reef', 'lagoon', 'coralhaven', 'wreck'], ['dusk', 'night'], [1, 15], 3, 'sink', 'octo',
    { base: '#b06a4a', belly: '#e8b8a0', accent: '#6a3a2a', fin: '#b06a4a' }, 'none', { tropical: true, spear: true, mesh: 'ceph', fact: 'Changes colour and shape in a blink, and squeezes through any gap bigger than its beak.' }),
  // ---- v1.15.19 Deep Blue: the weed mats, the Marigold, Coralhaven and Emberkey's warm water
  S('tripletail', 'Tripletail', 'uncommon', ['weedline'], ['dawn', 'day', 'dusk'], [3, 25], 3, 'steady', 'round',
    { base: '#7a6a3a', belly: '#c8b480', accent: '#4a3e22', fin: '#6a5a30' }, 'speckle', { tropical: true, value: { coins: 140, xp: 90 }, fact: 'Floats on its side under drifting weed, pretending to be a dead leaf, then pounces.' }),
  S('moray', 'Green Moray', 'rare', ['wreck', 'reef'], ['any'], [4, 30], 4, 'sink', 'eel',
    { base: '#3a6a3a', belly: '#6a8a4a', accent: '#1a3a1a', fin: '#3a6a3a' }, 'none', { tropical: true, spear: true, scale: 1.6, fact: 'Lives in the wreck\'s portholes and opens and shuts its mouth to breathe. It isn\'t angry, just breathing.' }),
  S('lanternangel', 'Lantern Angelfish', 'rare', ['coralhaven'], ['dusk', 'night'], [0.3, 2], 2, 'dart', 'round',
    { base: '#2a3a8a', belly: '#f2c040', accent: '#ffd060', fin: '#3a5ad0' }, 'glow', { tropical: true, glow: '#ffd060', fact: 'Coralhaven\'s own fish. The village lamps are said to be copied from its glow.' }),
  S('emberfin', 'Emberfin Snapper', 'rare', ['vents'], ['any'], [3, 30], 4, 'steady', 'bass',
    { base: '#c8402a', belly: '#f2a050', accent: '#5a1a10', fin: '#e8702a' }, 'spots', { tropical: true, value: { coins: 260, xp: 170 }, fact: 'Lives where the volcano\'s warm springs seep into the sea: the warmer the water, the redder the fish.' }),
  S('lavamoray', 'Lava-glow Moray', 'epic', ['vents'], ['night'], [8, 45], 6, 'sink', 'eel',
    { base: '#2a1a1a', belly: '#5a2a1a', accent: '#ff7a2a', fin: '#3a1a10' }, 'glow', { tropical: true, glow: '#ff7a2a', value: { coins: 700, xp: 450 }, scale: 1.8, fact: 'Glows along its back like a crack in cooling lava. Only comes out of the rocks after dark.' }),
];
export const OCEAN_BY_ID = Object.fromEntries(OCEAN_SPECIES.map((s) => [s.id, s]));
export const BIG_GAME = OCEAN_SPECIES.filter((s) => s.big && !s.tropical);
export const TROPICAL = OCEAN_SPECIES.filter((s) => s.tropical);
