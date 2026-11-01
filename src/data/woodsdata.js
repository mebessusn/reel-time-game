// v1.14.9 The Wild Woods: the words and numbers behind the forest (wildwoods.js runs it, woods.js builds it).

/** Things you can pick in the woods. They regrow every day. */
export const FORAGE = {
  chanterelle: { name: 'Chanterelles', verb: 'Pick chanterelles', n: [2, 3], sell: 14, color: '#e8a83a', desc: 'Golden mushrooms that like the shade under big trees.' },
  blackberry: { name: 'Blackberries', verb: 'Pick blackberries', n: [3, 5], sell: 8, color: '#3a2a4a', desc: 'Bramble bushes at the edges of clearings.' },
  mint: { name: 'Wild mint', verb: 'Pick wild mint', n: [2, 3], sell: 10, color: '#6ac08a', desc: 'Grows thick along the water: pools, creeks and lake shores.' },
  log: { name: 'Earthworms', verb: 'Dig for worms', bait: 'worm', n: [3, 5], desc: 'Roll a fallen log and there they are.' },
  cricket: { name: 'Crickets', verb: 'Catch crickets', bait: 'cricket', n: [2, 3], night: true, desc: 'Chirping in the long grass after dark.' },
};
export const PANTRY = ['chanterelle', 'blackberry', 'mint'];

/** A forest stew at any campfire: a Well Fed buff of its own (bites quicker, steadier hands, no one fish). */
export const STEW = { need: { chanterelle: 2, blackberry: 2, mint: 1 }, seconds: 300 };

/** The Field Guide: wildlife to photograph, in three sets. */
export const GUIDE = [
  { id: 'buck', name: 'White-tailed buck', set: 'woods', desc: 'Antlers like branches. Shy: walk, don\'t run.' },
  { id: 'doe', name: 'White-tailed doe', set: 'woods', desc: 'Grazes at the forest edge with the herd.' },
  { id: 'rabbit', name: 'Cottontail rabbit', set: 'woods', desc: 'Freezes, then zigzags. Patience.' },
  { id: 'raccoon', name: 'Raccoon', set: 'woods', desc: 'Snuffles about after dark, usually near a camp.' },
  { id: 'duck', name: 'Mallard', set: 'water', desc: 'Paddling in little groups near the shore.' },
  { id: 'heron', name: 'Great blue heron', set: 'water', desc: 'Stands so still in the shallows you\'ll walk right past it.' },
  { id: 'goose', name: 'Canada geese', set: 'water', desc: 'Flying over in a V now and then. Look up.' },
  { id: 'beaver', name: 'Beaver', set: 'water', desc: 'Swims round its lodge in Fox Hollow.' },
  { id: 'gull', name: 'Herring gull', set: 'sky', desc: 'Wheels over every lake.' },
  { id: 'hawk', name: 'Red-tailed hawk', set: 'sky', desc: 'Circles high over the woods on warm air.' },
  { id: 'owl', name: 'Barred owl', set: 'sky', desc: 'Only out at night, in the big trees by the lookout and the treehouse.' },
  { id: 'bee', name: 'Honeybees', set: 'sky', desc: 'Busy round the wild hives near Lantern Spring and the trapper\'s cabin.' },
];
export const GUIDE_SETS = {
  woods: { name: 'Woodland', reward: { coins: 600, xp: 300, pearls: 5 } },
  water: { name: 'Waterside', reward: { coins: 600, xp: 300, pearls: 5 } },
  sky: { name: 'Wings', reward: { coins: 600, xp: 300, pearls: 5 } },
};
export const GUIDE_ALL = { coins: 1500, xp: 800, pearls: 15, title: 'Naturalist' };

/** The valley journal: eight pages left round the woods by Elias Fenn, the trapper who first mapped the valley. */
export const PAGES = [
  { id: 'p1', at: 'trapper', title: 'The cabin', text: 'Built the cabin today, a day\'s walk east of the big lake. Five lakes in this valley, and not one of them on any map. I mean to change that. The fish here are the size of my arm and nobody has ever put a hook in them.' },
  { id: 'p2', at: 'tower', title: 'Up the ridge', text: 'Climbed the west ridge to see the lay of the land. Five lakes, like beads on a string, and rivers between them like someone drew them in with a finger. Strange to think water made all that on its own. I will build a lookout here one day.' },
  { id: 'p3', at: 'mirrortarn', title: 'The tarn', text: 'Found a small tarn north of the lodge site, so still it holds the sky. I saw a trout in it with a red mark at its throat, as if it had been cut. It looked at me a long while before it went down.' },
  { id: 'p4', at: 'moonwell', title: 'The well in the hills', text: 'The pool in the western hills is never lower, never higher. Rain or drought. At night silver fish come up and the water shines. The old folk say the moon drinks from it. I say it is a spring. I have not proved either.' },
  { id: 'p5', at: 'dam', title: 'The engineers', text: 'Beavers have dammed the brook below Fox Hollow. Clever animals. They built in a week what would take me a month. I have taken to sitting with them in the evenings. They do not mind me, or they are too busy to say so.' },
  { id: 'p6', at: 'plane', title: 'The mail plane', text: 'The mail plane came down in the east woods in the storm. The pilot walked out with a cut on his head and a sack of letters, laughing. "Five lakes," he said, "and I found the trees." We left her where she lies. The moss will have her.' },
  { id: 'p7', at: 'hollis', title: 'The boy in the oak', text: 'A boy has built himself a house in the old oak north of the big cold lake. Hollis, he says his name is. He knows more about the ice lake than I do. He says something enormous sleeps under it. I asked him how he knew. "It snores," he said.' },
  { id: 'p8', at: 'gate', title: 'Last page', text: 'Old now. The valley is on the map at last, with my name in the corner, and people come every summer to fish. I hope they find the quiet places too: the tarn, the well, the brook, the spring with the little lights. The lakes are for everyone. The quiet places are for whoever looks.' },
];
export const PAGES_ALL = { coins: 1200, xp: 600, pearls: 12, title: 'Lorekeeper' };

/** Secret Waters: finding all four hidden pools. */
export const SECRET_WATERS = { coins: 1000, xp: 500, pearls: 10, title: 'Pathfinder' };

/** Ranger Rhea's daily forest tasks (three a day, the same three for everyone, from the date). */
export const RANGER_TASKS = [
  { id: 'chanterelle', text: 'Pick 6 chanterelles', kind: 'forage', key: 'chanterelle', n: 6, reward: { coins: 180, xp: 120 } },
  { id: 'blackberry', text: 'Pick 10 blackberries', kind: 'forage', key: 'blackberry', n: 10, reward: { coins: 160, xp: 100 } },
  { id: 'mint', text: 'Pick 5 wild mint', kind: 'forage', key: 'mint', n: 5, reward: { coins: 160, xp: 110 } },
  { id: 'worms', text: 'Dig worms from 2 fallen logs', kind: 'forage', key: 'log', n: 2, reward: { coins: 140, xp: 90 } },
  { id: 'photo', text: 'Photograph 2 animals (any)', kind: 'photo', n: 2, reward: { coins: 200, xp: 140 } },
  { id: 'creek', text: 'Catch 3 fish in a creek', kind: 'catch', zone: 'creek', n: 3, reward: { coins: 220, xp: 160 } },
  { id: 'pool', text: 'Catch 2 fish in a hidden pool', kind: 'catch', zone: 'pool', n: 2, reward: { coins: 240, xp: 180 } },
  { id: 'loop', text: 'Ride the Ridgeback Loop once', kind: 'loop', n: 1, reward: { coins: 200, xp: 150 } },
];

/** Wren's wagon: the five stops (woods.js WOODS.wagonStops) in the order she drives them, 3 hours at each. */
export const WAGON_HOURS = 3;
export const WAGON_DISCOUNT = 0.75; // her picks are a quarter off Gus's price

export const RHEA_LOOK = { gender: 'female', skin: 3, height: 'tall', frame: 'standard', hair: 'ponytail', hairColor: 3, eyes: 'focused', eyeColor: 3, brows: 'straight', mouth: 'smile', facialHair: 'none', extras: ['freckles'], hat: 'boonie', hatColor: 6, shirt: 'flannel', shirtColor: 1, pants: 'cargo', pantsColor: 5, shoes: 'hiking', accessory: 'satchel', eyewear: 'none' };
export const HOLLIS_LOOK = { gender: 'male', skin: 2, height: 'short', frame: 'slim', hair: 'shag', hairColor: 9, eyes: 'sleepy', eyeColor: 0, brows: 'thick', mouth: 'grin', facialHair: 'beard', extras: ['glassesRound'], hat: 'trapper', hatColor: 10, shirt: 'sweater', shirtColor: 6, pants: 'overalls', pantsColor: 1, shoes: 'boots', accessory: 'none', eyewear: 'none' };
export const WREN_LOOK = { gender: 'female', skin: 5, height: 'medium', frame: 'standard', hair: 'braids', hairColor: 0, eyes: 'happy', eyeColor: 1, brows: 'arched', mouth: 'grin', facialHair: 'none', extras: [], hat: 'boater', hatColor: 4, shirt: 'cardigan', shirtColor: 9, pants: 'longskirt', pantsColor: 9, shoes: 'boots', accessory: 'bowtie', eyewear: 'none' };

export const RHEA = {
  hello: ['Morning, {you}! Tower\'s open, climb up.', 'Keep to the trails at night, {you}.', 'Seen any owls? Tell me if you do.', 'Lovely day for the woods.'],
  mutter: ['Fire danger: low. Good.', 'Somebody left a camp burning by the brook. Not you, I hope.', 'Four hidden pools in this valley. I\'ll never tell where.', 'The beavers moved the dam again.', 'Chanterelles are up after the rain.'],
  intro: 'Ranger Rhea, Ridge Lookout. I keep an eye on the woods from up top: fires, lost hikers, which way the deer went. Climb up if you like, the view\'s the best in the valley.',
  more: 'There\'s more in these woods than trees: four hidden pools with fish you won\'t find in the lakes, creeks you can wade, wild mushrooms and berries. I\'ve got a few jobs each day if you want them, and a fly rod for the creeks.',
};
export const HOLLIS = {
  hello: ['Mm? Oh. A visitor.', 'Mind the roots, {you}.', 'Shh. Listen. Hear it?', 'Bring mint? I\'ll put the kettle on.'],
  mutter: ['It snored again last night. Under the ice.', 'Fenn\'s old pages blow all over these woods.', 'Owls are back.', 'Seventy winters in this oak.'],
  intro: 'Hollis. I\'ve lived in this oak since I was a boy. Old Fenn wrote me down in his journal, you know. "The boy in the oak." Ha. The boy in the oak is eighty.',
  more: 'Bring me three sprigs of wild mint and I\'ll brew us tea, and I\'ll tell you something worth knowing: where a hidden pool is, or where one of Fenn\'s pages blew to.',
  tea: ['Ahh. Good mint. Now listen...', 'That\'s the stuff. Here\'s what I know...'],
  allKnown: 'You\'ve found everything I know about. Fenn would be proud of you.',
};
export const WREN = {
  hello: ['Wren\'s Wagon, open for business!', 'Rare things, fair prices, {you}!', 'I\'ll buy your mushrooms!', 'Three hours here, then I\'m off.'],
  mutter: ['Where did I put the good lure...', 'Mushrooms! I\'ll pay well for mushrooms.', 'Next stop... wherever the road goes.'],
  intro: 'Wren, of Wren\'s Wagon! I drive the valley\'s back roads: three hours at each stop, then on to the next. I\'ve always got a few things Gus would charge you more for, and I buy what you pick in the woods.',
};
