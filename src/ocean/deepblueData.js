// v1.15.19 Deep Blue: the words and numbers behind the new places at sea (deepblue.js runs them).

/** The logbook: each place counts once, with a reward and a line from Marlowe when you first find it. */
export const DISCOVERIES = {
  coralhaven: { name: 'Coralhaven', reward: { coins: 600, xp: 400, pearls: 4 }, line: 'Coralhaven! There\'s a whole village down there, lit up like a birthday cake. Take a mask and say hello.' },
  marigold: { name: 'The Marigold', reward: { coins: 500, xp: 350, pearls: 3 }, line: 'The Marigold went down in a squall forty years ago. Morays live in her portholes now. Mind your fingers.' },
  gullrock: { name: 'Gull Rock', reward: { coins: 300, xp: 200 }, line: 'Gull Rock. You\'ll smell it before you see it. The sea lions don\'t mind visitors.' },
  lonepalm: { name: 'Lone Palm', reward: { coins: 300, xp: 200 }, line: 'One palm, a few shells and nobody for miles. Best nap spot on the ocean.' },
  sandbar: { name: 'The Sandbar', reward: { coins: 300, xp: 200 }, line: 'At low tide the sandbar\'s full of clams. Bring a spade.' },
  channel: { name: 'Channel Light', reward: { coins: 400, xp: 300, pearls: 2 }, line: 'Ida keeps the Channel Light. She sells pots and lines, and she knows the sea better than I do. Don\'t tell her I said that.' },
  ember: { name: 'Emberkey', reward: { coins: 800, xp: 600, pearls: 6 }, line: 'Emberkey. She\'s still warm, you know. The water round her grows fish you won\'t see anywhere else.' },
  ghost: { name: 'The ghost ship', reward: { coins: 666, xp: 400, pearls: 3 }, line: '...Did you see that? No. No, you didn\'t. Nobody sees the Lantern Mary. Keep fishing.' },
  weed: { name: 'A drifting weed mat', reward: { coins: 150, xp: 100 }, line: 'See the weed? Cast right up against it: mahi and tripletail hide underneath.' },
  flotsam: { name: 'Flotsam', reward: { coins: 150, xp: 100 }, line: 'Grab the boat hook! Whatever falls off a ship ends up out here sooner or later.' },
};

/** What drifts in the flotsam fields. weight: how often. */
export const FLOTSAM = [
  { id: 'crate', name: 'a crate', weight: 30, coins: [60, 160] },
  { id: 'barrel', name: 'a barrel', weight: 25, coins: [40, 120] },
  { id: 'float', name: 'a glass fishing float', weight: 20, coins: [80, 200], glass: true },
  { id: 'bottle', name: 'a message in a bottle', weight: 15, coins: [20, 60], bottle: true },
  { id: 'chest', name: 'a little sea chest', weight: 10, coins: [300, 700], pearls: [1, 3] },
];

/** Coralhaven's people. */
export const SHELLY = {
  hello: ['Welcome to Coralhaven, love!', 'Lost five pearls. Silly me.', 'Mind the puddle by the airlock.'],
  intro: 'Shelly, of the Coralhaven Trading Post. We came down here when the sea came up, and we liked it. I trade a pearl for three bits of sea glass, and I\'d pay handsomely if someone found the five pearls I dropped out in the coral gardens round the town. They glow a little, if you look closely.',
  pearlsDone: 'All five! Oh, you\'re a treasure. Here, take this, and a proper title. You\'re one of us now.',
};
export const FINN = {
  hello: ['Deep fish, fair price.', 'Got anything from the Canyon?', 'Hmph. Surface folk.'],
  intro: 'Old Finn. I buy fish from deep water: the Blue, the Canyon, the Abyss and the Marigold. Half again what Gus pays. The deep ones keep better down here.',
};
export const IDA = {
  hello: ['Channel Light! Mind the gap to the boat.', 'Pots, lines and charts. Ida\'s got it.', 'Weather\'s turning. It always is.'],
  intro: 'Ida, keeper of the Channel Light. I trim the lamp, I count the ships, and I sell gear for folk who\'d rather the sea did the fishing. Pots for the reefs, longlines for the open water. Drop them from the boat and haul them up next time you\'re out.',
};
export const CLAMS = { coins: [25, 70], pearlChance: 0.06 };
export const STRONGBOX = { coins: [400, 900], pearls: [1, 4] };
export const PEARLS_QUEST = { coins: 1500, xp: 900, pearls: 12, title: 'Friend of Coralhaven' };

/** Ida's shop: gear you set from the boat and haul next trip. soak: minutes before anything's in it. */
export const SEA_GEAR = {
  pot: { name: 'Reef pot', price: { coins: 1200 }, soak: 10, zones: ['reef', 'shore', 'nearshore', 'wreck', 'coralhaven', 'vents', 'lagoon'], n: [1, 3], what: 'Drop it over a reef or the shallows; haul it next trip for reef fish.' },
  line: { name: 'Longline', price: { coins: 2200 }, soak: 15, zones: ['weedline', 'bluewater', 'openocean', 'canyon', 'nearshore'], n: [1, 2], what: 'Set it in open water; haul it next trip for pelagic fish.' },
};
export const SEA_GEAR_MAX = 4;
export const CHART_REVEAL = { coins: 3000 };
