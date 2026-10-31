// Player-facing changelog, newest first. Every change we ship gets an itemized line here, grouped by kind.
// Kinds: new (features), world, look (wardrobe and avatars), gear, ui, fix.
// The first entry's version is the one shown on the title screen.

export const CHANGE_KINDS = {
  new: { label: 'New', icon: 'sparkles' },
  world: { label: 'World', icon: 'leaf' },
  look: { label: 'Wardrobe', icon: 'shirt' },
  gear: { label: 'Rods and lures', icon: 'rod' },
  ui: { label: 'Menus and HUD', icon: 'sliders' },
  fix: { label: 'Fixes', icon: 'wrench' },
};

export const CHANGELOG = [
  {
    version: 'v1.17.3', date: 'Oct 30 2026', title: 'Round the Ring',
    changes: {
      ui: [
        'Change your outfit from the Esc menu: Dress your angler sits right under Resume.',
      ],
      fix: [
        'The Ring Line works: press E at a station, pick a stop, and you wait for the next chair. It joins the Skyline lift without getting off, signs and map pins mark the stations, stations are solid, and while riding you can choose to get off at the next stop.',
        'Three pieces of cold-weather gear now stop the cold entirely (one slows it, two slow it more).',
        'Footprints, skate lines and tracks fade after a few seconds.',
        'You stay put on the jet ski, the snowmobile and Marlowe\'s deck, and you lean in with your hands on the bars. The jet ski\'s handlebars are back within reach.',
        'The plane keeps clear of the Leviathan, the shore trees and the Ring Line. The sun sets behind the Frostmere mountains, not into them.',
        'Pell\'s Trading Post has a wall under the back of its roof, the Palm Key signpost no longer blocks the Beach Games board, and the hangar lettering sits on its board.',
      ],
    },
  },
  {
    version: 'v1.17.2', date: 'Oct 30 2026', title: 'Out on the Snow',
    changes: {
      new: [
        'Snowmobile: buy one from Pell, press your ride key anywhere on the snow, and go. It\'s the fastest thing up north, and it leaves the ground over crests.',
        'Jet ski: buy one from Kai at the tiki bar and ride the swells between the islands. It floats on the real waves, jumps off crests, leans into its turns and throws spray.',
        'One-dog sled: ask June, and Pepper will pull you round the north for a fraction of the price.',
        'Skyline, a little ski hill on the south range: ride the chairlift to the summit, take a toboggan down, race the Hill Climb, and send your snowmobile off the Big Air Jump. All three have boards.',
        'Galena, an abandoned silver town in the western foothills. Relight the street lamps, read what was left behind, and find out what happened at Shaft 2.',
        'Ember Hollow, a valley of hot pools. Soak until you\'re warm, and fish for Ember Perch and Steam Eels.',
        'Climb aboard the Valiant: a rope ladder up her side, her deck to walk, and her hold and galley to search. The captain\'s chest wants every page of the log.',
        'Six trail huts across the north. Light each stove for warmth and a line in the ledger.',
        'The Ring Line: a chairlift right round the map, with stations at Hearthwick, Skyline, Aurora Hill, the North Shore and Galena. Get on a chair as it comes through, and it takes the short way round.',
        'Great Auroras: some nights the whole sky moves, glowing tracks lead from Aurora Hill to an aurora shard, and the Spirit Whitefish rises.',
        'Things lie frozen in the lake ice, different ones each week. Cut them out for your collection.',
        'When a blizzard blows through, it leaves old crates uncovered out on the snow.',
        'New in the Field Guide: Alpine ibex on the hills and mountain hares round the taiga.',
      ],
      ui: [
        'Smoother frames and better night lighting, on a newer version of the graphics engine (three.js r187).',
        'The cold is hard to miss now: your first landing explains it, and as you chill you shiver, frost closes in, your breath shows, and warnings tell you the nearest warmth before you pass out.',
        'The ride button on the bar follows you: the bike in the valley, your snowmobile or one-dog sled up north.',
      ],
      fix: [
        'The sign on Pell\'s Trading Post sits squarely on its board, the Hearthwick sign faces the ice, the boards\' lamps stand clear of them, and the hangar signs hang out in front of the roofs.',
      ],
      world: [
        'Every bridge in the valley now lines up with its trail at both ends.',
        'The shore ice is natural now: broken, leaning chunks with snow on top, not blocks.',
        'New husky sled dogs, at the kennels and in the teams.',
        'The snow has a shape now: drifts and swells you ride over, ripples and glazed crust that catch the sun, and blue in the hollows and shadows.',
      ],
    },
  }, {
    version: 'v1.17.1', date: 'Oct 27 2026', title: 'The Blue Caves',
    changes: {
      new: [
        'The Blue Caves are open: walk in through the ice cliff at the glacier\'s snout, down a passage into a domed hall of blue glacier ice with a frozen pool (and something very big frozen in it), a side chamber where the mammoth sleeps in a wall of clear ice, and a grotto full of glowing crystals. The log page is in there now.',
        'Ice fishing camps: drilling a hole pops up a little shelter on a sled and a bucket stool beside the hole. Sit on the stool to fish; the shelter and the stool are solid.',
        'Hearthwick\'s bonfire benches are seats now: sit by the fire and roast a fish.',
        'Old Hollis\'s treehouse is rebuilt: a broad old oak whose roots run into the ground, real limbs and a layered crown, a railed deck that wraps round the trunk on six braced posts, a free-standing board-and-batten hut at the deck\'s end (clear of the trunk) with a shingled roof, a door, shuttered windows and a stovepipe, and a straight ladder with its rungs on its rails up to a gap in the railing. Hollis sits on his bench at his tea table now (not inside it), and everything at the foot is solid.',
        'Five Lakes Valley looks sharper: smooth, curving shorelines and creek banks instead of the grid\'s saw-tooth, crisper ground up close, natural ragged edges between grass, sand and dirt, and soft light and dark drifts across the meadows.',
        'Bigger homes: grow your cabin into the Cottage (in your home\'s new Bigger home tab). A doorway through the east wall opens into a den with a quilted patchwork bed you can sit on, two more windows, and room for a second rug, armchair, lamp, fern and bookshelf, which you can arrange anywhere in either room. It needs level 10 and two lake collections, and costs 25,000 coins (or 150 pearls instead of the coins). Friends who visit see your den too.',
        'Air race circuits are now Easy, Medium and Hard, four of each. The hard ones (Stormfront, Sky Harbour, Red Rock Canyon, The Gauntlet) climb and dive steeply, through tighter gaps with more in the way, and the medium ones roll up and down more than before.',
        'Birds on the air race courses: flocks turn up ahead of you, flying straight at you or across the line, more often on harder circuits and in faster classes. Fly into one and it\'s a bird strike.',
        'Fly the race planes with the mouse: move it and it becomes a joystick (centre of the screen is centre stick, with a small dead zone); hold the left button to boost. The keys take over again as soon as you press one.',
        'Air races start on proper lights: red, then yellow, then green for GO, each with its own tone, on a gantry above the start arch and on your screen.',
        'Air race crowds: both grandstands are full and people line the start straight. They clap, wave both arms, pump their fists and wave flags, and they go wild at the start and the finish.',
        'Spearfishing: land a fish over 30 lb and you tow it home: swim it back to Marlowe\'s boat (or climb aboard) before you can spear the next one.',
        'Camps tidy themselves: walk away from your camp for five minutes and it\'s packed up for you.',
      ],
      world: [
        'Keep an eye on the horizon from the Floe Edge. Sometimes, far out to sea, something long-necked rises from the water, drifts a while and sinks again.',
        'A little log cabin stands in its own clearing in the woods off the Lilymarsh trail, its door facing the path and its window lit at night.',
        'Fernview Campground is a proper campground: canvas tents and a dome tent round the fire with camp chairs, a camp kitchen with a dutch oven and a water jug, a cooking grate over the fire, a lantern on the picnic table, a bear-proof food locker, a notice board and rail fence at the way in, a hammock, a woodpile, and a canoe rack, a canoe and a rowboat down on the beach.',
        'A ranger station stands below the Ridge Lookout fire tower, its window lit at night, with a trail map, a signpost, a birdhouse, a picnic table, a woodshed and an outhouse.',
        'An A-frame cabin looks out over Frostpine Lake from up the bank of its north shore, with a deck, a fire pit and chairs, a well, a woodpile, and a canoe and a rowboat pulled up on the beach.',
        'New tents, chairs and gear at Fern Camp, in the camps you pitch in the Wild Woods (a dome tent, a stone fire pit, camp chairs, a cooler, firewood and a dutch oven), and sturdy timber picnic tables at Sundae\'s Trailer Park.',
        'Every lake has its own water now: Frostpine is clear and icy, Lilymarsh peaty green-brown, Fern Pond weedy green and the Old Quarry turquoise, blending into each other along the rivers.',
        'Ripples ring out properly when your bobber lands, a fish bites or something splashes: a bright ring with two smaller ones behind it, catching the sun as they spread.',
        'Little waves wash up the beaches and drain back, leaving the sand dark where they reached until it dries. They run further up the sand when the wind blows.',
        'Underwater in Open Waters, look up to see a bright circle of sky with the sun glowing through it, and beyond it the surface turning into a rippling mirror of the deep. Light shafts reach down by day, and specks drift in the water around you.',
        'A mountain refuge hut stands on the flat below the glacier near the Blue Caves, its window lit, a woodpile at its side and a toboggan by the door.',
        'Stone cairns mark the high ground between the Frozen Falls and the Blue Caves, and someone has left an ice axe and crampons in the snow at the cave mouth.',
        'Icefalls hang on the bank above the plunge pool under the Frozen Falls, and a snow fence runs below the standing stones on Aurora Hill.',
        'Hearthwick has a bench by the sauna, snowy log piles by the smokehouse and behind the Hearth Lodge, and a toboggan by one of the cabins.',
        'Snow has a surface now: wind ripples catching the low sun, drifts and hollows in faint blue, and a fine grain up close.',
        'Ten kinds of snowy spruce in Frostmere (and the snowy race circuits): tall and narrow, broad and old, wind-bent, broken-topped, heavy with snow or nearly bare.',
        'The race circuits\' land has detail up close: grass in patches and tufts, dry spots, rock in strata and cracks on the steep faces, and a bumpy surface the sun picks out.',
        'New rocks on every circuit: mossy granite, snow-capped boulders, banded sandstone stacks and black basalt columns.',
        'People live along the circuits: farms with barns, silos, hay bales and striped fields, stone cottages and a chapel, log cabins, red fishing huts on stilts with jetties, adobe houses and wind pumps, stilt huts and canoes on the beaches.',
        'Fish under the ice look like fish: pike, trout, perch, burbot and whitefish each have their own shape, they swim forward (never sideways), turn smoothly and glide.',
        'Hearthwick\'s ice sculptures are carved properly now: a trout leaping out of a curling wave, a polar bear mid-stride with a paw raised, and a snowy owl with its wings half spread, each on a frosted plinth with a name plaque.',
        'Pell\'s Trading Post is a proper frontier storefront: the false front stands clear above the roof, with a cornice and brackets, and the sign isn\'t crossed by the roof any more.',
        'The sled dogs look like huskies: deep chests, ruffs, pointed ears, masks and curled tails, with proper hind legs. And they don\'t walk into each other.',
        'The snowy spruce are whole trees: the branch tiers overlap down a solid core, with snow lying on them.',
        'Crash Clearing\'s plane is a real bush plane now (Skye\'s kind, in faded yellow), nose down in the ferns with a bent prop.',
        'The fallen log by Pip\'s spot in Cozy Cove has moved out onto the sand, and the cove\'s waystone lost the stick at its foot.',
        'Open Waters: wherever you jump in, fish turn up around you (reef fish roam out over the deep water too).',
      ],
      ui: [
        'Jigging is clearer: a beat bar under the flasher shows when to jig ("wait...", "JIG NOW", "jig!"), and the flasher tells you what the fish are doing.',
        'Look around while Skye flies you north or home: drag (or use the right stick) to turn the camera round the plane on the take-off and the landing, and the wheel zooms. The view keeps your angle as the plane turns.',
      ],
      fix: [
        "Skye's plane flies smoothly now: it eases away from its mooring, turns wide, speeds up and slows down gently, leans into its turns, lifts off and touches down without a jolt, and no longer snaps round when it parks (it swings round at Hearthwick, and comes alongside the dock in a slow U-turn at home).",
        "Skye's plane no longer taxis through an ice shanty on its way to park at Hearthwick: the shanty town keeps a clear lane along the plane's path (and clear of the windsock).",
        'Building porches and steps in Hearthwick are solid: you climb the steps onto the porch, and nobody walks through the railings.',
        'Snowball fights: every click throws a snowball now (quick clicks used to walk you instead). Click again while you\'re still throwing and the next one goes as soon as you can.',
        'Holes you drill close up and go when you\'ve walked away and haven\'t fished them for a while (a tip-up keeps its hole open).',
        'You can\'t cast through things any more: a lamp post, a tree, a wall, a piling or a person in the way stops the line short (it still flies over rocks you could step on).',
        'The Blue Caves: the entrance is clean (no forest of icicles), the cliff around the mouth is glacier ice with no gaps, the frozen mammoth and the ice columns are solid, and the frozen pool glows blue from deep under the ice (no more still fish shadow, no flicker).',
        'Rented ice shanties: inside is a proper cosy room now (floor boards with a hatch over the hole, the stove, a bench, shelves), and you can move about inside without getting thrown out.',
        'The sauna is solid and has its gable walls under the roof, front and back.',
        'Hal and the other shanty regulars stand beside their holes, not half inside a shanty.',
        'Using Hearthwick\'s notice board looks at the board, not at Astrid.',
        'Getting off Marlowe\'s boat at Palm Key no longer drops you in the sea 100 m away.',
        'The bikes on Spokes & Sprockets\' rack stand on the ground, not sunk into it.',
        'The little footbridges over Tarn Run and Hollow Brook sit down on their banks.',
        'Frostpine Lake\'s south-west corner is deeper: no more running aground rowing out from the bank.',
        'Ridge Lookout\'s fire tower: a clean frame (one brace per panel, no stray beams), and the stairs zigzag up one side in three proper flights of evenly spaced steps on sloping stringers, with landings, and they and the tower are solid, so you can\'t walk through it onto the deck any more. Press E at the foot of the stairs to climb.',
        'The trail up to Pinewood Lodge no longer takes a hard right turn below the lodge: it sweeps round in a long, gentle bend.',
        'The Tarn Run footbridge by the seaplane base moved upstream, with dry banks at both ends: you don\'t step off it into the lake any more.',
        'The creeks run a little deeper, so their water stays put instead of flickering in and out as it ripples (you can still wade them).',
        'The seaplane hangar\'s sign says FROSTPINE AIR again, on its board over the door. The snowy boulder by the dock is gone from the path, and the fuel shed has moved inland behind the hangar (and is solid, pump and drums too).',
        'Frostmere is smoother and more detailed: the snow meets the ice (and the sea ice meets the open sea) along clean curves instead of a jagged saw-tooth, the Frozen Falls\' ravine and the pools have rounded banks, the snowfields are drawn finer and shaded smoothly, and the land has more life: shore ice heaved up on the banks (solid), storm-killed snags, more boulders, drifts and dry grass poking through the snow.',
        'Skye\'s seaplane hangar sits on dry land, clear of the pond behind it, and its sign hangs on the front, not up in the roof.',
      ],
    },
  },
  {
    version: 'v1.17.0', date: 'Oct 27 2026', title: 'Skye\'s Air Races',
    changes: {
      new: [
        'Skye\'s Air Races: twelve looping circuits, three laps each, against three rival pilots. Talk to Skye at either hangar after your first flight north and pick a circuit, a mode, a class and a plane.',
        'Six sky circuits above the clouds (cloud towers, thermals, a stormfront with lightning, an aurora night loop, a harbour of blimps) and six low-level circuits over big landscapes of their own: the Five Lakes valley, glacier fjords, the taiga, tropical islands, a red rock canyon and the Gauntlet.',
        'Big obstacles: fly under stone viaducts and through rock arches, a hangar and an ice arch, over a dam and its canyon, past wind turbines, a sweeping crane, a drawbridge that opens, a train on a trestle, blimps, balloons, geysers, power lines and gusts.',
        'A hidden shortcut on eleven circuits (two on the Gauntlet): a cave, a tunnel behind a waterfall, a crack in a mesa, the eye of the storm, a cargo blimp\'s bay... Find one and it\'s marked on your map from then on.',
        'Racing features: a grid start with a countdown (boost right on GO for a perfect start), gates in order (miss one: +2 seconds), sector splits against your best, boost rings, ground effect and slipstream to fill your boost, tricks for boost, crashes with a quick respawn, wrong-way and position read-outs, a mini map and three camera views (C), with a look back (B).',
        'Three modes: Race, Time trial (race your best lap\'s ghost, and the circuit record holder\'s) and Practice. Three classes: Breeze, Gale (rivals use the shortcuts) and Hurricane (fastest, more hazards).',
        'Medals (bronze, silver, gold, and platinum for beating Skye\'s own time), pilot ranks, best-time boards for every circuit, and fourteen new achievements.',
        'Planes to earn: the Yellow Cub (nimble), the Red Baron biplane (quick tricks) and the Bluebolt Racer (fast, wide turns). Skye\'s paint shop sells paint jobs; two more come with medals.',
        'Party races: the party leader starts one and everyone in the party races together, with rivals filling the grid to four.',
      ],
    },
  },
  {
    version: 'v1.16.3', date: 'Oct 27 2026', title: 'Boost',
    changes: {
      new: ['Boost on the flight: hold Shift (or the Boost button). The view widens, the edges blur, speed lines rush past. Updrafts top the boost up.'],
      fix: ['A dog team that starts beside a lamp post pulls clear instead of getting stuck.'],
      world: [
        'The clouds up there are big, fluffy heaps now: bumpy, sunlit tops, shaded undersides and soft wispy edges. High cirrus streaks the sky and cloud banks line the horizon.',
        'Updrafts are a stream of wind spiralling upward, and they lift you as you fly through.',
        'Flocks of gulls cross the course: fly into birds and you slow right down for a moment (feathers everywhere, no birds hurt).',
      ],
    },
  },
  {
    version: 'v1.16.2', date: 'Oct 27 2026', title: 'Inside the Hearth Lodge',
    changes: {
      new: [
        'The Hearth Lodge has a big inside: a roaring stone fireplace, armchairs to sink into, Hilde\'s counter with hot food that keeps the cold off, villagers eating and playing cards, a darts board, and a trophy wall with your biggest catches from up north. Go in by the front door on the porch.',
        'Plane tricks on the flight: Q and E for barrel rolls, Space for a loop the loop (they add to your score).',
        'A map of Frostmere (M up north): the village, the fishing spots, the wild places, the sled trails, thin ice, your holes and other anglers.',
      ],
      world: [
        'The ice looks like real lake ice: frosty blues, clear patches you can see down into, air bubbles frozen in it, and fish gliding past underneath.',
        'The flight has edges now (it steers you back toward the course), and you can dive down into the clouds.',
        'Everything up north is solid: the parked plane, the race posts, the strip lamps, and the people of Hearthwick.',
        'Marlowe\'s chart in Open Waters is far more detailed: depth contours, surf on the shores, the islands in relief with trees, and smoother zooming.',
      ],
      gear: ['Skates have real steel blades now.', 'The hand auger and the power auger are rebuilt in much more detail.'],
      ui: [
        'The Sled Derby and the Long Glide show a glowing pillar on the next gate, an arrow over your head pointing to it, and how far it is.',
        'Pell\'s shop stays open while you buy: pick up as much as you like, then close it.',
        'At sea, setting a course from the chart while you\'re ashore says it will call you back aboard.',
      ],
      fix: [
        'Lacing up skates no longer leaves you stuck on fast monitors (144 Hz and up).',
        'You can step off a dog sled any time, even moving (and quit the Derby the same way).',
        'Landing up north, the plane no longer sinks into the ice; landing at home, it no longer appears off to the side of the camera.',
        'Dive fins sit on your feet properly again.',
      ],
    },
  },
  {
    version: 'v1.16.1', date: 'Oct 26 2026', title: 'Camera Unfrozen',
    changes: {
      fix: ['Holding the right mouse button turns the camera again. Frostmere\'s frost overlay was invisibly covering the game view and swallowing the mouse.'],
    },
  },
  {
    version: 'v1.16.0', date: 'Oct 26 2026', title: 'Frostmere',
    changes: {
      new: [
        'Frostmere, a frozen north far west of the valley. From level 25, Skye Halloran flies you there in the Snow Goose (fly through the rings on the way for a better score).',
        'Ice fishing: drill holes with an auger, jig over the flasher dial, and set tip-ups that pop a flag when a fish takes the bait. Old holes skin over; chip them open again.',
        '14 new fish that only live up north, including the Aurora Char (only under the northern lights) and the Glacier King (only in a snowstorm).',
        'Stay warm: a warmth meter that drains in the cold. The bonfire, porches, shanties, cocoa and warm clothes help. Try the sauna, then the polar plunge.',
        'Thin ice by the inlets and the springs: stand still on it too long and you go through.',
        'Rent a shanty with a stove and a hole in the floor, rent skates at the rink, and ride dog sleds: drive your own team, or hire a ride along the trails.',
        'Races: the Sled Derby and the Long Glide (a skate race down the frozen river against Kit and Bo), with shared boards at the lodge for the Ice Derby, the races and the flight.',
        'Snowball fights with Kit and Bo, first to five.',
        'Five quest lines from the people of Hearthwick, and 15 Frostmere achievements.',
        'Wildlife to photograph for the Field Guide (bears and cubs, foxes, caribou, muskox, seals, walrus, narwhals and more), plus three legends to find.',
        'Find the five pages of the schooner Valiant\'s log scattered round the north\'s landmarks.',
      ],
      world: [
        'Hearthwick village: the Hearth Lodge, the trading post, the smokehouse, the sauna, the kennels, a skating rink and a shanty town on the lake.',
        'Snow, blizzards, diamond dust, and the northern lights on two nights in three (the same nights for everyone).',
        'Six new music tracks for the north.',
      ],
      look: ['Northern clothes from Pell\'s trading post: the Expedition Parka, earflap, bobble and aviator hats, snow goggles, mittens, snow sweaters, a musher\'s bib, an aurora scarf and fur boots.'],
      ui: ['A Frostmere tab in the Fishpedia, and a North tab in the journal for the quests, the Field Guide and the log pages.'],
      fix: ['Smoother with lots of people around: each person is fewer draw calls, villagers\' rods are one piece, and only the nearest 16 are drawn.'],
    },
  },
  {
    version: 'v1.15.24', date: 'Oct 24 2026', title: 'Feet on the Pier',
    changes: {
      fix: [
        'Coming home from Open Waters while you were swimming or diving no longer leaves you swimming under the charter pier: you always step off onto the pier.',
        'Coming home from inside Coralhaven puts the view distance and lights back the way they were at the cove.',
      ],
    },
  },
  {
    version: 'v1.15.23', date: 'Oct 24 2026', title: 'Coralhaven, Polished',
    changes: {
      world: [
        'Coralhaven has real lights now: warm lamps light the rooms and corridors around you, so walls, floors and furniture have proper shading instead of looking flat.',
        'Every doorway is arched to match its corridor; the square cut-outs (and the gaps above the arches) are gone.',
        'The corridor portholes have polished gold rims with rivets.',
        'The windows sit properly in the curved walls, frames and all.',
        'The Glass Gallery\'s tank is full of water, and its fish swim long lazy laps like the ones in your cabin aquarium.',
        'Every shopkeeper sits on a tall chair behind the counter, up where you can see them.',
        'The Tidewater Inn has six beds, three down each side, spaced out and clear of Pip\'s desk.',
        'Old Finn\'s ice tables are spread round the sides of the market instead of crowding his counter.',
        'The airlock is tidied up: one ship\'s wheel in the middle of the hatch, no hazard stripes or puddle, just a welcome mat. Nerissa, in her smart navy uniform, greets you as you come in.',
      ],
      fix: [
        'Coralhaven\'s furniture, fountain and counters are solid again (you could walk straight through them), and you can\'t cast indoors.',
        'On a charter boat, you, your crew and Captain Marlowe stay planted on deck as she rolls and pitches, instead of sliding back and forth.',
      ],
    },
  },
  {
    version: 'v1.15.22', date: 'Oct 24 2026', title: 'Look Around',
    changes: {
      fix: [
        'Underwater, dragging with the right mouse button turns the camera again, every time (the blue tint over the view was catching the mouse once you were under).',
        'The "Open Waters" title card no longer catches clicks while it fades.',
      ],
    },
  },
  {
    version: 'v1.15.21', date: 'Oct 24 2026', title: 'White Water',
    changes: {
      world: [
        'Seafoam at sea: white water laps along every beach, rock and reef edge, a bright line where the sea meets the land with lace rolling in toward it.',
      ],
      fix: [
        'You no longer arrive on the charter riding your bike, and you can\'t get back on it at sea: bikes stay parked at the cove.',
      ],
    },
  },
  {
    version: 'v1.15.20', date: 'Oct 24 2026', title: 'Under the Dome',
    changes: {
      new: [
        'Coralhaven is a real town now. On the sea floor it\'s a cluster of coral-stone domes joined by tunnels, windows glowing. Swim to the airlock and go inside, where there\'s air and dry floor: the Grand Hall with its shell fountain and giant clam, Shelly\'s Trading Post, Old Finn\'s Fish Market, the Kelp & Kettle, the Glass Gallery (a whole wall of aquarium), Marina\'s Dive Locker and the Tidewater Inn. Townsfolk wander between them.',
        'The Kelp & Kettle\'s bubble tea: half as much air again on your dives for 20 minutes.',
        'Sleep till dawn at the Tidewater Inn (after dusk), and buy dive gear from Marina without sailing back to Kai.',
        'Marlowe\'s chart is the big map panel now, like the valley\'s: drag it, zoom in, click a place for what\'s there and set a course from it. Places you discover are added once you find them.',
      ],
      world: [
        'A sea floor everywhere you dive: sand, gravel and weed, all the way down.',
        'Nobody stands about on the sea floor without a mask any more: the townsfolk live inside.',
      ],
      fix: [
        'Underwater you hold your depth when you stop swimming (Space to go up, Shift to go down), instead of floating back up.',
        'Dolphins keep to deep water: no more leaping onto the beach or under the jetty.',
        'You can\'t pitch a camp on an island (camps are for the valley\'s woods).',
      ],
    },
  },
  {
    version: 'v1.15.19', date: 'Oct 24 2026', title: 'Deep Blue',
    changes: {
      new: [
        'Coralhaven: a whole village on a bank 17 metres down. Coral cottages with glowing windows, lamps on kelp stalks, and three glass air domes: swim into one and your air fills right up. Shelly trades a pearl for three bits of sea glass (and five of her pearls are lost round the village), and Old Finn pays half again for fish from deep water.',
        'The Marigold: a freighter wreck on its own bank, broken in two, with morays in her portholes. Her strongbox fills up again every day. Nobody knows how.',
        'Channel Light: a light on a platform out in the open sea. Tie up, climb on and meet Ida the keeper. She sells reef pots and longlines: set them from the boat at anchor and haul them up next trip for fish you didn\'t have to catch.',
        'Emberkey: a young volcano, with black sand, steam rising from the slopes and a crater that glows. The warm water round it has fish of its own.',
        'Three islets to swim out to: Gull Rock (sea lions and gulls), Lone Palm, and the Sandbar, where you can dig for clams at low tide (sometimes with a pearl inside).',
        'Drifting weed mats: cast up against one and mahi and tripletail come out from underneath, and bite faster.',
        'Flotsam: crates, barrels, glass floats, bottles with messages and the odd sea chest float about on every trip. Steer alongside and hook them from the deck.',
        'Ships go by: a trawler with gulls in her wake, a sailing race round the middle of the sea, and on foggy nights... something else.',
        'The logbook: ten places to find, each with a reward and a word from Marlowe. Open it from the deck.',
      ],
      world: [
        'Five new sea fish: the tripletail (under the weed), the green moray (wrecks and reefs, and you can spear it), the lantern angelfish (Coralhaven at dusk and night), the emberfin snapper and the lava-glow moray (night, by the volcano).',
        'Marlowe\'s chart shows the whole sea now, with the islets and Channel Light on it. Places you haven\'t sailed near yet stay misty until you do, or until Ida copies her chart into yours.',
      ],
      fix: [
        'Clear water underwater: you can see 50 metres before the blue closes in (100 metres before it\'s solid), so spearfishing is much easier. Storms and rain still cut it down a little.',
      ],
    },
  },
  {
    version: 'v1.15.18', date: 'Oct 23 2026', title: 'Speak Up',
    changes: {
      ui: [
        'The Talk button no longer covers what someone is saying: it moves up above their speech bubble and name tag while they talk, and back down when they finish.',
      ],
    },
  },
  {
    version: 'v1.15.17', date: 'Oct 23 2026', title: 'Bob Talks to Himself',
    changes: {
      world: [
        'Hang around the crab races and Bob talks to himself every 15 to 20 seconds: 22 new lines about systems that don\'t work, crabs that won\'t win, and the sandals he lost on Yellow. You hear every line once before any repeat.',
      ],
    },
  },
  {
    version: 'v1.15.16', date: 'Oct 22 2026', title: 'Bob\'s Big Day',
    changes: {
      world: [
        'Meet Bob at the crab races on Palm Key. He runs the track from the finish line, he\'s sure his luck is about to turn, and he\'ll ask you for a few coins every time you pass.',
        'Talk to Bob to hear how the races work, or spare him 10 coins and find out which crab he blows it on. He always bets it straight away. Keep stopping by: he notices who does.',
      ],
    },
  },
  {
    version: 'v1.15.15', date: 'Oct 22 2026', title: 'Sharp Shooter',
    changes: {
      gear: [
        'The speargun hits what the crosshair is on. While you hold one, the camera looks over your shoulder so the crosshair sits on the water ahead of you, and the spear flies to it.',
        'Aim assist: when a fish is lined up the crosshair turns green, and the spear leads a moving fish.',
        'Longer reach and faster spears: the pole spear reaches 10 m (was 6) and the band speargun 16 m (was 11). At the surface, shots go just under the water instead of steeply down into the sand.',
      ],
      fix: ['Captain Marlowe no longer stands in the middle of Cozy Cove behind the title screen: he\'s on his pier from the start.'],
    },
  },
  {
    version: 'v1.15.14', date: 'Oct 21 2026', title: 'Open Waters',
    changes: {
      ui: ['An Open Waters title fades into the middle of the screen as you arrive at sea, in the Reel Time logo\'s font: a life ring rocks in place of the O, and the letters ride a gentle swell over a rolling wave. It also says whose boat you\'re on, or that it\'s a night charter.'],
      fix: ['A trip on your own boat no longer uses up your free first charter with Marlowe.'],
    },
  },
  {
    version: 'v1.15.13', date: 'Oct 21 2026', title: 'Your Own Boat',
    changes: {
      new: [
        'A boat of your own: after three charters, once Marlowe calls you his Mate, he\'ll sell you a sportfisher of your own (40,000 coins). Ask him at the pier.',
        'Name her (the name goes on the transom) and paint the hull, the stripe and the cushions.',
        'Upgrades: outriggers (bites come about 15% quicker at anchor), a live well (15% of your catch\'s worth on top when you dock) and twin engines (31 knots instead of 21).',
        'Tick "Take my boat" when you book and the trip is free, for you and your whole crew. Crewmates see your boat, paint and name included. Marlowe still takes the wheel.',
      ],
      fix: [
        'On low graphics the island fires show their embers and glow without the flame effect, which keeps slower devices smooth.',
        'The game is a third smaller to download (about 7 MB instead of 11.6 MB): the 3D models are stored compactly, with no change to how they look.',
      ],
    },
  },
  {
    version: 'v1.15.12', date: 'Oct 21 2026', title: 'The Abyss',
    changes: {
      new: [
        'Marlowe\'s trust: every trip earns his trust, and a trip with a trophy fish earns double. You rise from Deckhand to Mate, First Mate and Old Salt. He says where you stand at the pier, and each rank unlocks a new story ("Tell me a story").',
        'The Abyss: once you\'re his First Mate, Marlowe will take you out past the Deep Blue to water so deep the bottom drops away. Few small fish live there, but plenty of monsters, and swordfish and giant squid bite any time of day.',
        'Bait balls: now and then a boil of baitfish comes up close to the boat, with birds diving into it. Cast into it and bites come three times as fast, with mahi, tuna, wahoo and trevally right behind.',
        'Waterspouts: in rain and storms a grey funnel sometimes walks across the horizon.',
        'Fog banks: the sea closes in grey for a few minutes. Marlowe sounds the horn so you can find the boat (the strip at the top says which way), and makos and great whites come up in the fog.',
      ],
    },
  },
  {
    version: 'v1.15.11', date: 'Oct 21 2026', title: 'Derby Week',
    changes: {
      new: [
        'The Billfish Derby: every week (Monday to Sunday, UTC) the lake keeps a board of everyone\'s heaviest sailfish, blue marlin or swordfish. The winner gets the Derby Cup for their cottage wall, plus 1,500 coins and 3 pearls. Second and third place get 600 coins. See the board at Marlowe\'s pier or on the chart.',
        'Tides: two a day at sea, low at dawn and dusk. At low tide rock pools come up out of the water along the island beaches, with something glinting in them. Search each one once a tide for a shell, a piece of sea glass, or now and then a pearl.',
        'At high tide the reef fish crowd in, and spearfishing turns up more of them, big grouper and lionfish included.',
      ],
      look: [
        'New cottage pieces: the Derby Cup, a Shell Shadow Box (find all six shells) and a Sea Glass Jar (find all five colours).',
      ],
      ui: ['The sea strip at the top shows the tide.'],
      fix: ['The marlin bill, shark jaw and ship in a bottle hang flat on the cottage wall (they stuck out of it).'],
    },
  },
  {
    version: 'v1.15.10', date: 'Oct 21 2026', title: 'Island Nights',
    changes: {
      new: [
        'Night charters: tick "Night charter" on Marlowe\'s booking card and the trip sets out after dark. The whole crew shares the same night sky.',
        'Squid lights: at anchor after dark, Marlowe hangs floodlights off the stern. Little squid dart about in the pool of light, and giant squid and swordfish bite more often from the stern.',
        'Glowing plankton: at night the wake, the bow wave, your bobber\'s splash and anyone swimming light up blue-green.',
        'Sleep till dawn: after dusk, turn in at any hut door on Palm Key and wake to the sunrise. Your crew wakes up with you.',
      ],
      world: [
        'The fire pits on Palm Key and Turtle Atoll burn now, with log benches round them. Sit down and roast a fish like at the valley campfires. Cook with a crewmate by the same fire and Well Fed lasts half as long again.',
        'After dusk, Makoa plays the drum by the Palm Key fire, and the music turns to a fireside song (marimba, flute and brushes) while you\'re near.',
      ],
    },
  },
  {
    version: 'v1.15.9', date: 'Oct 21 2026', title: 'Fish On',
    changes: {
      new: [
        'Fish on! When Claude finishes your prompt while you\'re out on a charter, Marlowe shouts it, and the golden answer fish is a big-game fish.',
        'Trip report: when you head home, a card shows your catch, what it\'s worth against the fee, your best fight, and a snapshot from the moment your heaviest fish came aboard. Save or copy it, and it goes in your photo album too.',
        'Marlowe\'s lesson: on your free first charter he walks you through it step by step (the chart, a cast, the fighting chair, landing a fish, a dive and back aboard), and the first fish is a mahi to learn on. Skip it any time, or ask him at the pier to show you the ropes again.',
      ],
    },
  },
  {
    version: 'v1.15.8', date: 'Oct 20 2026', title: 'Island Polish',
    changes: {
      world: [
        'The islands have the valley\'s soft grass now, not the old spiky tufts.',
        'New huts on Palm Key: a porch with rails, slatted walls with shuttered windows, an open door, layered thatch, and steps that come down off the porch the right way.',
        'Kai\'s Tiki Bar is rebuilt: carved tiki posts, a lower counter with bottles, cups and a pineapple, stools out front, torches, and a hanging sign that says KAI\'S TIKI BAR. Kai stands on a step behind the counter, so you can see her properly.',
        'New beach loungers with striped cushions, a pillow and a towel, under umbrellas with a scalloped edge.',
        'The sea floor is smooth sand when you dive, with no jagged edges.',
      ],
      gear: [
        'The scuba tank gives you 5 minutes of air, and the mask alone gives 1 minute.',
        'The speargun fires the moment you press, at the surface too (aimed down into the water). You see the spear fly on its line, feel a kick, hear it, and it reels back if you miss. The crosshair flashes while it reloads.',
      ],
      fix: [
        'Huts, loungers, umbrellas, the tiki bar and other island props are solid now: you walk round them, not through them.',
        'Palm trees no longer have a twist in their trunks.',
        'Island paths no longer run through huts or props.',
      ],
    },
  },
  {
    version: 'v1.15.7', date: 'Oct 20 2026', title: 'Suit Up',
    changes: {
      look: [
        'Your dive gear shows when you\'re in the water: the mask on your face, the scuba tank on your back, fins on your feet, and your speargun held out in front of you. Crewmates see it too.',
      ],
      ui: [
        'The air meter counts down in seconds, and above it a row shows what you have on (mask or tank, fins, speargun). A note says what you put on each time you go in.',
        'Kai\'s dive shop says it plainly: gear is yours to keep and you put it on whenever you go in the water.',
      ],
      fix: [
        'Island props: the beach towel lies flat, the cannon sits on its carriage, and the research tent\'s canvas makes a proper A-frame.',
      ],
    },
  },
  {
    version: 'v1.15.6', date: 'Oct 20 2026', title: 'Island Life',
    changes: {
      world: [
        'All three islands are bigger and you can walk all over them. Smuggler\'s Rock has a path from the jetty beach up to an old lookout and two cannons on the cliff top, with its cliffs round the far side.',
        'Turtle Atoll\'s ring of dunes is wide enough to stroll round on its path, and its lagoon is deep enough to swim: wade in off the lagoon beach and swim out to the motu in the middle (there\'s a hammock).',
        'The islands use the valley\'s own ground: trodden paths, grass, bright coral sand and rock, with grass tufts, bushes, ferns, hibiscus, banana plants and sea grape on the grass, and driftwood, shells, coconuts and tide pools along the beaches.',
        'Palm Key has a little village of huts round a fire pit, canoes pulled up on the sand, a net rack and signposts. Torches and fires glow after dark.',
        'Turtle Atoll has a marine biologist\'s research tent and a fire on the dunes. Smuggler\'s Rock\'s cliffs are broken rock now, not a smooth wall.',
      ],
      new: [
        'Islanders: Leilani runs the beach games, Old Mo fishes the jetty, Nani, Ben and Ivy wander Palm Key, Rua fishes the beach; Dr. Marina Reyes counts turtles, Kalani guides bonefish and Sam snorkels on Turtle Atoll; Salty Pete keeps the lookout and Jun hunts treasure on Smuggler\'s Rock. They say hello, cheer your catches, and some have stories: Talk to them.',
        'Walk off a beach or a jetty into deep water and you start swimming; swim back to the sand and you walk out.',
      ],
      fix: [
        'Marlowe\'s swordfish sign stands square along the beach beside his pier, not angled across the front of it.',
        'Beach games: a guest always follows the host\'s round, so everyone sees the same podium (a moment\'s lag used to make a guest score it on their own).',
      ],
    },
  },
  {
    version: 'v1.15.5', date: 'Oct 2026', title: 'Open Waters: Finishing Touches',
    changes: {
      new: [
        'Big-game fish are now Trophy fish: a new tier above Legendary, with its own colour and marker everywhere fish are shown.',
        'Captain Marlowe\'s tackle locker (ask him at the pier, or Crew & roles at sea). Every charter still comes with his rods and reels; to keep, there\'s a Big Game Rod (a 3,600 lb line, quicker fights, and 200 lb fish in the valley), a Trolling Skirt lure (keep fishing while the boat runs) and a Fighting Harness (your arms tire a third as fast).',
        'Take the rod: when a crewmate\'s marathon fish is wearing them out, walk up and take over the fight where they left it.',
        'A fish finder on the charter: the sea floor and the depth scroll by under the hull, with marks for what\'s down there. Big arches mean big game; near the islands at dusk, watch for a big dark shadow (a hammerhead).',
        'The giant squid fights dirty: now and then it tows the whole boat after it.',
        'Smuggler\'s Rock has a secret: swim through the rock arch into a hidden grotto with a lagoon and a pocket beach. Search the smugglers\' crates by the jetty (once a trip), or fish round the rock, and you may find a smugglers\' map. Dig up the X (bring a shovel) for a much richer chest than the valley\'s.',
        'Spotted eagle rays glide round Turtle Atoll\'s lagoon with the turtles.',
        'Below level 20, a chain and padlock hang across Marlowe\'s pier. They come down when you can sail.',
      ],
      ui: ['Low graphics quality is lighter at sea: the long swell without the choppy wind sea, no foam, caustics or spray.'],
      fix: [
        'Sitting in the fighting chair no longer drops you into the sea under the boat, and swimmers can no longer get stuck under the hull.',
        'In the water, dragging with the mouse turns the camera again (the crosshair was catching the mouse) and a click fires your speargun. Beach games take the mouse too.',
        'Swimming into an island: you wade out where you can stand, and rock and cliffs are a wall. No more swimming through the ground; anyone already stuck is put back on the beach or aboard.',
        'The charter lines up with a jetty and comes straight in alongside it (and pulls away and turns before it leaves), instead of cutting across the jetty. Turns through every waypoint are smooth now.',
      ],
    },
  },
  {
    version: 'v1.15.4', date: 'Oct 2026', title: 'Open Waters: Polish',
    changes: {
      new: [
        'Eight Open Waters achievements in the Journal: Trophy Hunter, Big Game Angler, Grand Slam (a sailfish, a blue marlin and a swordfish on one charter), Let Them Run, Reef Ranger, Beach Champion, Whale Watcher, and Old Salt for catching all 24 sea fish.',
        'Tag and release: land a sailfish or a blue marlin and Marlowe can tag it and let it go, for bonus XP and a Released badge in the Fishpedia.',
        'An Open Waters tab in the Fishpedia: the sea\'s 24 fish, your best of each, how many you\'ve landed, and the Open Waters collection. Finish it for 3,000 coins, 30 pearls, the title Old Salt and a ship in a bottle for your cottage.',
        'Trophies for your cottage: your first blue marlin sends home its bill, your first shark a set of jaws, and your first giant squid comes home in a jar.',
        'Bonus sea requests on the notice board for anglers who can sail: one a day and one a week. They never count towards the daily bonus, so nobody has to go to sea to finish their day.',
      ],
      fix: [
        'Beach games: against islanders alone the prizes are a little smaller, and after eight rounds in a day they shrink until tomorrow. Guests now wait for the host\'s results, so everyone sees the same podium.',
      ],
    },
  },
  {
    version: 'v1.15.3', date: 'Oct 2026', title: 'Open Waters: Beach Games',
    changes: {
      new: [
        'Beach Games on Palm Key: a board by the jetty lists five party games for up to four. Host one and your crew get an invite; islanders Lani, Keo and Pua fill any empty places, so you can play on your own too. Every place pays coins and XP, and your first win at each game earns a title and a prize hat.',
        'Beach volleyball, one on one or two on two: a ring on the sand shows where the ball comes down. Get under it and press Space (or click) as it lands; the closer to the moment, the nastier your return. First to 5.',
        'Crab races: back one of four crabs in the paddock, then cheer it down the track. Cheering on the beat gives it the biggest push.',
        'Coconut toss: five coconuts, three buckets, and the further bucket scores more. Aim with the camera, hold to wind up, let go to throw.',
        'Sandcastle contest: two minutes to build on your plot with mounds, towers, walls, moats, flags and shells, then everyone (Kai too) votes for their favourite castle that isn\'t their own.',
        'Cannonball contest off the new diving tower at the end of the jetty: bounce, jump, and tuck just after the top for the biggest splash. Kai, Marlowe and a very serious gull hold up the scores.',
        'The weather joins in: the wind pushes balls and coconuts about, the rain makes crabs run faster and sand stack a level higher (and makes the ball slippery), and Kai packs the games away in a storm.',
        'A hammock up the beach past the loungers.',
      ],
      look: ['Five prize hats from the beach games: the Beach Visor, Crab Hat, Coconut Hat, Sand Pail Hat and Swim Cap.'],
      fix: ['Gaffing a crewmate\'s fish: the help bar now says "Wait for it…" while the fish is alongside and turns to "NOW!" when the gaff will hold. After two misses Marlowe takes the gaff himself.'],
    },
  },
  {
    version: 'v1.15.2', date: 'Oct 2026', title: 'Open Waters: Under the Sea',
    changes: {
      new: [
        'Swimming and diving: dive in from the boat\'s swim platform or off the end of a jetty. W swims where you look (look down to dive), Space swims up, Shift swims down, and you can wade out onto any beach.',
        'Air: one breath lasts 30 seconds; surface to refill. Run out and Marlowe hauls you aboard (no harm done).',
        'Under the water: the world turns blue-green and closes in with depth, at night and in rough weather; light ripples across the sand and coral, sunbeams slant down by day, the surface shimmers overhead, and every sound goes muffled.',
        'Reefs to explore round every island and at Reef Edge: brain and staghorn coral, sea fans, anemones with clownfish, kelp, sponges and giant clams, with schools of tangs and idols, sea turtles, and an old wreck lying off Smuggler\'s Rock where the goliath groupers hide.',
        'Spearfishing: Kai sells a Pole spear and a Band speargun at the tiki bar. Aim at the crosshair and lead moving fish. Lionfish, goliath grouper and octopus only come to a spear, and every lionfish earns a reef cleanup bonus. Kai also sells a dive mask (45 s of air), a scuba tank (90 s) and fins.',
      ],
    },
  },
  {
    version: 'v1.15.1', date: 'Oct 2026', title: 'Open Waters: Island Time',
    changes: {
      new: [
        'Three islands to walk on. Sail to one on the chart and Marlowe ties up at its jetty: Go ashore, fish from the beach and the jetty, and come Back aboard when you\'re done (the horn calls everyone back before the boat leaves).',
        'Palm Key: a long beach with palms, loungers and huts, and Kai\'s Tiki Bar. Kai grills a fish from your backpack island-style; eat it and its relatives come looking for you. Reef fish keep you going twice as long.',
        'Turtle Atoll: a ring of sand round a turquoise lagoon, with sea turtles paddling about. Smuggler\'s Rock: cliffs, a rock arch over the cave mouth, and the smugglers\' leftover crates.',
        'Twelve tropical fish: clownfish, blue tang, red snapper, parrotfish, triggerfish, Moorish idol, bonefish, great barracuda and the leaping tarpon from the shore, plus lionfish, goliath grouper and octopus for the speargun (coming with diving).',
        'Six more big-game fish: bluefin tuna and blue marlin (marathon fights of several minutes: bring the crew), swordfish at night in the Canyon, great hammerheads round the islands at dusk, the giant squid (it squirts ink), and the great white, which only shows itself in a storm.',
        'The Canyon and Reef Edge open on the chart.',
      ],
    },
  },
  {
    version: 'v1.15.0', date: 'Oct 2026', title: 'Open Waters: Set Sail',
    changes: {
      new: [
        'Captain Marlowe runs charters from a new pier on the east side of Cozy Cove, by the lighthouse. Talk to him to book: your party (up to 4) gets an invite to board, and you can always go solo. Everyone aboard needs level 20. A trip is 5,000 coins each, and your first one is free.',
        'Open Waters: a real ocean past the lighthouse, with three islands on the horizon, a weed line, Marlowe\'s mooring and the Deep Blue. Open the chart (M) to sail between spots; anyone aboard can take the wheel.',
        'Real sea, real weather: long swells and wind waves that build and ease with the weather. A clear day rocks you gently; a storm throws up 4-metre seas with breaking whitecaps, spray over the bow and a grey wall of rain. The weather changes the bites, the fight, how far you can see, the sound of the sea and what turns up around the boat.',
        'Six big-game fish: mahi-mahi, wahoo, yellowfin tuna, giant trevally, sailfish and shortfin mako. Hook one and you go to the fighting chair: let it run, rest your arms (reel in bursts), and bring it alongside for the gaff. Fights take a minute or two, and a big fish pays for the trip.',
        'Crew roles: the captain backs the boat down on a run, the gaffer lands the fish, and the spotter calls jumps and birds working bait (press Y). Fishing alone? Marlowe covers every role. Step away mid-fight and he holds the rod for a minute.',
        'Whales and dolphins: humpbacks (and now and then a blue whale) blow, roll and lift their flukes far off the boat, and pods of dolphins come to ride the bow. Everyone aboard sees the same ones. Just scenery: nothing to catch.',
        'Out at sea your crew has its own room: you see and chat with each other only, and the lake shows you as away on a charter until you\'re back.',
      ],
      world: [
        'The sea has its own music (marimba, flute and vibes, no guitar) and sound: the wash along the hull, the wind in the rigging, gulls, whale blows and dolphin whistles.',
      ],
    },
  },
  {
    version: 'v1.14.11', date: 'Oct 24 2026', title: 'Take a Dip',
    changes: {
      new: [
        'Swimming! Walk out past your depth in any lake, river or pool (or step off the side of a dock) and you swim: tread water when you stop, a front crawl when you move. Swim under the footbridges, and walk into the shallows to climb out. No casting while you\'re in the water.',
      ],
      fix: [
        'Footbridge railings are solid: you can no longer walk off the side of a bridge into the water (or climb on over the side). On and off at the ends, like a real bridge.',
      ],
    },
  },
  {
    version: 'v1.14.10', date: 'Oct 24 2026', title: 'Say Cheese',
    changes: {
      new: [
        'A proper welcome: on a new game Gus offers to show you around (about three minutes), or you can skip it. Ten short steps, from looking around and your first fish to your backpack, the map and your journal. The button each step talks about glows, and a beam of light shows you where his dock is. Replay it any time from the Menu.',
        'Photographing wildlife for the Field Guide: you raise a little instant camera to your eye, the shutter clicks, and a polaroid of what you shot slides onto the screen as it develops. It goes into your photo album too.',
      ],
      world: [
        'Camps got a lot nicer: a canvas A-frame tent that billows between its poles, with guy ropes, stakes, the door tied back, a bedroll inside and a lantern out front; a fire ring of stones with a log teepee, embers, smoke and a pot on a tripod; two camp chairs, a woodpile with an axe in the block, a cooler and a pack.',
        'Seafoam: white water laps along every shore, a bright line where the water meets the sand with lacy foam rolling in toward it.',
      ],
      fix: [
        'Picking a reply in a conversation no longer swings the camera away and back: it stays on whoever you\'re talking to until the conversation ends.',
        'A camp\'s fire no longer sits off to one side of its stones, and its glow is soft by day and warm at night.',
      ],
    },
  },
  {
    version: 'v1.14.9', date: 'Oct 24 2026', title: 'The Wild Woods',
    changes: {
      new: [
        'Four hidden pools in the woods, each with a fish of its own: Moonwell in the western hills (silversides at night), Fox Hollow (brook trout, and a beaver lodge), Mirror Tarn (an epic cutthroat) and Lantern Spring (tiny glowing darters). Find all four for the Pathfinder title.',
        'Two creeks to wade, Tarn Run and Hollowbrook, with riffle dace and the legendary Old Mossback (dusk and night, in the rain). Rhea sells a fly rod, the Willowbend: fish bite faster in moving water and jumpers come to it twice as often.',
        'Foraging: chanterelles, blackberries and wild mint grow through the woods, and they come back every day. Roll a fallen log for worms, or catch crickets after dark, for free bait. Cook two chanterelles, two blackberries and a sprig of mint at any fire for forest stew: Well Fed for five minutes.',
        'The Field Guide: photograph twelve animals (deer, rabbits, raccoons, herons, beavers, owls, hawks, honeybees and more) to fill three sets, each with a reward, and all of them for the Naturalist title.',
        'Ridge Lookout: climb Ranger Rhea\'s fire tower for the best view in the valley. Rhea has three forest jobs a day.',
        'The valley journal: eight pages from Elias Fenn, the trapper who first mapped the valley, blown about the woods. Find them all for the Lorekeeper title. Old Hollis in his treehouse brews mint tea and tells you where to look.',
        'Wren\'s Wagon: a travelling merchant who moves to a new spot in the woods every three hours. Rare gear at a quarter off, and she buys your mushrooms and berries.',
        'The Ridgeback Loop: a bike trail with jumps round the eastern ridge. Ride a lap for your time and a place on the lake\'s leaderboard.',
        'Pitch a camp: put up a tent and a campfire anywhere in the woods. Your friends see it too, and you can cook at it.',
      ],
      world: [
        'The woods between the lakes are full of life now: the trapper\'s cabin, a bush plane that came down in a storm, footbridges, a beaver dam, wild hives, fairy rings that glow at night, a pumpkin patch, owls in the big trees at night and bees in the daytime.',
      ],
    },
  },
  {
    version: 'v1.14.8', date: 'Oct 22 2026', title: 'Room for Everyone',
    changes: {
      fix: [
        'Busy lakes use far less memory: anglers further away than the nearest 16 are no longer built in full until they come close. With 250 anglers on the lake the game used about 500 MB less.',
        'A fish another angler holds up no longer hangs in the air after they wander out of view, and their line, float and lantern glow go with them.',
        'A catch from an angler on another version of the game, naming a fish yours doesn\'t know, is ignored instead of throwing errors.',
      ],
    },
  },
  {
    version: 'v1.14.7', date: 'Oct 22 2026', title: 'Take It With You',
    changes: {
      new: [
        'Settings > Account > Save file: Export save writes your progress to a small file, and Import save loads it on another computer or browser (it replaces the progress there, and the game restarts).',
      ],
    },
  },
  {
    version: 'v1.14.6', date: 'Oct 22 2026', title: 'Schools on the Move',
    changes: {
      fix: [
        'Cozy Cove\'s feeding schools move around the whole Cove again. Since the lighthouse island moved in, nearly every school had gathered on the same spot.',
        'Feeding schools no longer vanish for one angler while a friend still sees them: everyone counts each school\'s catches the same way. On a busy lake, older records could crowd out the current ones.',
        'When a school is fished out, the next one gathers in about half a minute (it was a minute), well away from the last.',
        'Rosie no longer stands in the middle of Cozy Cove behind the title screen: she\'s behind her bike shop counter from the start.',
      ],
    },
  },
  {
    version: 'v1.14.5', date: 'Oct 20 2026', title: 'Schools Are Back',
    changes: {
      fix: [
        'Cozy Cove\'s feeding schools are back. Moving the lighthouse island into the middle of the Cove had left no water far enough from land for them; the islet (boat-only) no longer counts, and schools keep clear of it.',
      ],
    },
  },
  {
    version: 'v1.14.4', date: 'Oct 20 2026', title: 'Rod on Your Back',
    changes: {
      gear: [
        'Your rod rides on your back while you walk about, and comes out when you cast. Press T (or the rod button) if you\'d rather carry it in your hand.',
      ],
    },
  },
  {
    version: 'v1.14.3', date: 'Oct 20 2026', title: 'The Lighthouse Moves In',
    changes: {
      world: [
        'The lighthouse island has moved in from the east bank toward the middle of Cozy Cove (still clear of the deep end and the Sunken Ruins), and the lighthouse stands 30% taller.',
        'Trees, reeds, flowers and fireflies are scattered naturally across the valley. They used to line up in rows.',
        "Gus's cabin keeps a clear yard all the way round: no tree or boulder grows against its walls.",
      ],
    },
  },
  {
    version: 'v1.14.2', date: 'Oct 18 2026', title: 'Just the Lake',
    changes: {
      fix: [
        'The old website version (sign in with GitHub or email, cloud saves) is gone: Reel Time is one thing now, a lake that lives in Claude. The first-time splash is just Start fishing, and Settings no longer offers a sign-in that went nowhere.',
        'Plugin 0.7.2: the unused web-build settings (Supabase URL and key) are gone from /config, and the plugin no longer points at the maker\'s own lake by default. /fish asks for your lake\'s link (/reel-time:lake) the first time, so nobody lands on a lake they can\'t open.',
        'Plugin 0.7.3: /fish in the claude.ai web app opens your own lake (it looks up your Reel Time artifact) instead of the maker\'s, and points you to the 5-minute setup if you don\'t have one yet.',
      ],
    },
  },
  {
    version: 'v1.14.1', date: 'Oct 18 2026', title: 'One Place',
    changes: {
      ui: [
        'Everything lives in one place now: the game, the make-your-own-lake guide, the source and the Claude Code plugin are all at github.com/mebessusn/reel-time-game. The Link Claude card installs the plugin from there.',
      ],
    },
  },
  {
    version: 'v1.14.0', date: 'Oct 18 2026', title: 'Your Own Lake',
    changes: {
      new: [
        'Reel Time is free for every Claude user: anyone can make their own lake (a private copy of the game on their own Claude account), invite friends and be its admin. The how-to is at github.com/mebessusn/reel-time-game.',
        'Plugin 0.7.0: /reel-time:lake points the golden-fish signal at your own lake. Paste your lake\'s link once and it remembers it.',
      ],
      ui: [
        'The Privacy card says whose lake you are in: each lake belongs to the person who shared it, and they are its admin. The Link Claude card has the new /reel-time:lake step, and the Admin panel\'s bug list points to where the game\'s maker takes bug reports.',
      ],
    },
  },
  {
    version: 'v1.13.21', date: 'Oct 18 2026', title: 'Out of Sight',
    changes: {
      fix: [
        'Faster long views across the valley: lily pads, campers, fire pits, waystones, the drowned mill, the shipwreck and Gus are no longer drawn when they\'re far past the haze (up to half the work in some views).',
      ],
    },
  },
  {
    version: 'v1.13.20', date: 'Oct 18 2026', title: 'Pebbles, Not Boulders',
    changes: {
      world: [
        'The two big boulders by Gus\'s lantern and barrels are smaller stones now.',
      ],
    },
  },
  {
    version: 'v1.13.19', date: 'Oct 18 2026', title: 'Lighter on Its Feet',
    changes: {
      ui: [
        'Settings > Graphics > Smooth frame rate (on by default): if the game starts to stutter, it draws at a slightly lower resolution until it runs smoothly again.',
      ],
      fix: [
        'Faster drawing all round: shadows redraw at half rate on Medium, small things only cast shadows near you, and lamps and campfires no longer cost anything in daylight.',
        'Fish swimming under the water, far-off reeds, flowers and twigs, and the clouds are cheaper to draw, with no visible change.',
        'Loading is quicker (the fish are painted once you are playing), and dusk or reaching a new area for the first time no longer stutters while the game prepares its lighting.',
      ],
    },
  },
  {
    version: 'v1.13.18', date: 'Oct 18 2026', title: 'Rock Solid',
    changes: {
      fix: [
        'Every stone round Gus\'s shop is fully solid now, big or small, including the low ones by the water you could walk into.',
      ],
      world: [
        'Fewer stones crowd the corner by Gus\'s barrels.',
      ],
    },
  },
  {
    version: 'v1.13.17', date: 'Oct 17 2026', title: 'Solid Ground',
    changes: {
      world: [
        'More mossy stones of all sizes bank up round the front of Gus\'s shop, along its windowed side and under the porch, so you can no longer see under the cabin.',
      ],
      fix: [
        'The mossy stones round Gus\'s shop are solid now; you can no longer walk through them.',
        '"Walk to Gus\'s shop" stops in front of the porch stones, close enough to shop.',
      ],
    },
  },
  {
    version: 'v1.13.16', date: 'Oct 17 2026', title: 'The Old Grove',
    changes: {
      world: [
        'The valley\'s trees, bushes, ferns, reeds, flowers, willows and lily pads are back to their classic look.',
      ],
      ui: [
        'The Plants setting is gone from Settings > Graphics, since there is only one style again.',
      ],
    },
  },
  {
    version: 'v1.13.15', date: 'Oct 17 2026', title: 'Every Shelf in Sight',
    changes: {
      ui: [
        'Gus\'s shop tabs wrap onto a second row, so Pets, Clothes, Emotes and Gear box are no longer hidden past the edge of the panel.',
      ],
    },
  },
  {
    version: 'v1.13.14', date: 'Oct 17 2026', title: 'Leaves All the Way Out',
    changes: {
      world: [
        'The detailed trees now show at every distance; far-off hills no longer swap back to the old simple trees.',
      ],
    },
  },
  {
    version: 'v1.13.13', date: 'Oct 17 2026', title: 'Leaf by Leaf',
    changes: {
      world: [
        'The valley\'s plants are rebuilt: pines with tiers of needle sprays, oaks and autumn trees with real boughs and clumps of painted leaves, apple trees hung with apples, white birches with their black marks, and furrowed bark on every trunk.',
        'Snow is back on the pines round Frostpine Lake, dusted along the needles.',
        'Weeping willows let their curtains hang to the water at Lilymarsh; cattails, reeds, berry bushes, ferns, wildflowers, toadstools and lily pads (some in bloom) are all new too.',
      ],
      new: [
        'Settings > Graphics > Plants: Detailed (the new plants) or Classic (the earlier simple shapes). Switch any time; it applies when the game restarts.',
      ],
    },
  },
  {
    version: 'v1.13.12', date: 'Oct 17 2026', title: 'Every Fish Its Own',
    changes: {
      new: [
        'All 59 fish are rebuilt from scratch: real fish shapes instead of blocks, each one its own. Rows of scales that catch the light, fins with fanned rays, glossy eyes, gill covers and a lateral line.',
        'Each species looks like itself: the bluegill\'s dark ear flap, the largemouth\'s jagged stripe and big jaw, the rainbow trout\'s pink band, the pike\'s bean spots and duckbill, the catfish\'s whiskers, the sturgeon\'s armoured plates, the puffer\'s spikes, the piranha\'s underbite, the koi\'s patches and the lanternfish\'s glowing lure.',
        'The legends shine: glowing lines and spots on the eels, crystal shards on the Crystal Pike, a lightning stripe on the Storm Sturgeon and Thunder Bass, the Moonfin\'s crescent.',
        'Gold and diamond fish keep every detail, cast in gold or ice.',
      ],
      fix: [
        'The new fish are no heavier on your computer than the old ones. Their skins are painted while the game loads ("Painting the fish"), so a new catch never stops to paint.',
      ],
    },
  },
  {
    version: 'v1.13.11', date: 'Oct 17 2026', title: 'Overnight Catch',
    changes: {
      new: [
        'Your pet rides along: hop on a bike with a front basket (Meadow Cruiser) or a crate on the back (Angler\'s Tourer) and your pet jumps in and peers over the rim.',
        'Send feedback: a new Feedback button on the main menu (and Send feedback in the pause menu). Tell us what you love, what bugs you, or what you wish the valley had.',
      ],
      world: [
        'Every waystone is now its own hand-made monument: a barnacled sea stack at Cozy Cove, an ice spire at Frostpine, a mossy cairn at Fern Pond, a leaning reed-wrapped slab at Lilymarsh, an iron-banded obelisk at the Old Quarry, a carved post with a lantern at Pinewood Lodge, a standing stone and lantern crook at Fern Camp and a little stone arch at Willow River Bridge. Their runes still glow once you have lit them.',
        'Your cottage furniture is all new and far more detailed: a braided oval rug, a button-backed armchair with a throw and cushion, a wrought-iron lantern lamp, a leafy fern in a terracotta pot, a bookshelf crammed with books (and a duck decoy), a cast-iron stove with a kettle and a glowing fire door, a framed lake painting with a sailboat, a fish banner with tassels, an oval trophy board, a ginger cat curled asleep in its bed, and lake plaques with a raised fish in each lake\'s colour. The aquarium has a panelled cabinet, gravel, rocks, waving plants and a tiny treasure chest, and the window seat has drawers, pillows and a blanket.',
      ],
      fix: [
        'Inside your cabin, and in its editor, nothing from the lake outside shows: no anglers\' names, chat bubbles, catch feed or pop-ups.',
        'The Inventory button no longer shows a count badge every time something goes in your bag.',
        'Rowing the waterways between lakes is 50% faster, so travelling by boat no longer drags. The boat eases up to speed as you enter a river and back down as you reach a lake.',
        'Eating a roasted fish: your angler now holds it level across their mouth and bites from there, instead of pressing it against their nose.',
      ],
    },
  },
  {
    version: 'v1.13.10', date: 'Oct 17 2026', title: 'Speak Up',
    changes: {
      fix: [
        'Chat bubbles over nearby anglers no longer go missing: the game now checks where they really are, not where their angler was last drawn.',
        'Pop-up messages no longer block clicks underneath them: the top emote on the wheel (and anything else under a toast) works on the first click.',
      ],
    },
  },
  {
    version: 'v1.13.9', date: 'Oct 17 2026', title: 'The Long Haul',
    changes: {
      new: [
        'A balance pass so the valley lasts: the best rods and boats are now real goals, about 80 hours of regular fishing to reach level 50 and the top gear. Anything you already own, and the level you\'ve reached, stays yours.',
      ],
      gear: [
        'The top gear needs a level now as well as the price: the Diamond Rod at level 40 (500 pearls), the Golden Swan at 36 (350 pearls), Obsidian Deep at 30, the Crystal Jig at 32, the Lantern Lure at 22, and more. The shop shows the level on anything still locked.',
        'Prices rise across the shop, bikes, traps, cottage decor, pets and tackle upgrades, so there\'s always something worth saving for.',
      ],
      fix: [
        'Campfire cookouts: your fish now roasts just above the flame tips, where you can watch it brown, instead of hiding inside the fire, and the roasting stick is a clearly green one.',
        'Levels: the first few come as quickly as before, the later ones take real time.',
        'Treasure maps turn up about a quarter as often, and chests hold fewer pearls (1-4) and coins (150-450). They were handing out more pearls than everything else put together.',
      ],
    },
  },
  {
    version: 'v1.13.8', date: 'Oct 16 2026', title: 'Fresh Cut',
    changes: {
      new: [
        'A new local legend potters about the meadow on the trail north-west of the cove: a pig with a crisp buzz cut and a very serious face. He stops to stare when you walk up. Press E to pet him.',
      ],
    },
  },
  {
    version: 'v1.13.7', date: 'Oct 16 2026', title: 'Lights in the Windows',
    changes: {
      new: [
        'Single player or multiplayer: choose on the title screen. Single player is just you on the lake: no other anglers, no chat, nobody else\'s catches in your feed. Switch back any time, right from the title screen or Play with friends.',
      ],
      world: [
        'Every building\'s windows light up after dark, like Pinewood Lodge: your cottage, the Bog Hut, the Quarry shed, Gus\'s Tackle & Tide, the lighthouse and the trailers at Sundae\'s.',
        'Feeding schools now gather on each lake\'s open water almost every time, clear of the deep end and the landmark, so you can fish them as soon as you can fish the lake. At Cozy Cove more than half of them used to sit over the deep end or the Sunken Ruins.',
      ],
      ui: [
        'The Journal is split into tabs (Climb, Lakes, Quests, Collect, Awards, Bottles) and every one fits on a single page. Long lists turn pages with arrows, one lake, quest line or achievement category at a time, and a red dot shows which tab has something to claim.',
        'Cottage editor: the painting, the banner and the trophy mount move too. Drag them along the back or left wall, or nudge them with the arrows (up and down raises and lowers them). They keep clear of the window and the door.',
      ],
      fix: [
        'Locals chatting nearby no longer light up the red chat badge. Only messages from other anglers count as unread.',
      ],
    },
  },
  {
    version: 'v1.13.6', date: 'Oct 16 2026', title: 'Ring the Bell Now',
    changes: {
      fix: [
        'When Claude finishes, the bell rings and "Claude\'s done" pops up straight away, whatever you\'re doing, even in the middle of reeling one in or with a catch card open. It used to wait until that fish was landed, so you could miss that your answer was ready.',
        'The golden answer fish still waits politely: it starts circling your line once the fish you\'re fighting is in.',
      ],
    },
  },
  {
    version: 'v1.13.5', date: 'Oct 16 2026', title: 'Golden Line Restored',
    changes: {
      fix: [
        'Reel Time plugin 0.6.3: "Claude is thinking" and the golden answer fish work again. Since a database change, every new chat\'s first signal was turned away and the game never heard from Claude. The plugin now looks up where your lake\'s status stands before it writes.',
        'Typing /fish as the very first message of a new chat no longer warns that the plugin did not load. It just opens the lake.',
      ],
    },
  },
  {
    version: 'v1.13.4', date: 'Oct 16 2026', title: 'Straight to the Lake',
    changes: {
      fix: [
        'Reel Time plugin 0.6.2: /fish in the Claude app now opens the game straight in the side panel. A small status panel with an "Open the lake" link used to open on top of it, so you had to click through.',
      ],
    },
  },
  {
    version: 'v1.13.3', date: 'Oct 16 2026', title: 'Find the Fish',
    changes: {
      fix: [
        'Reel Time plugin 0.6.1: /fish now shows in the slash menu in a brand-new chat, before you send anything. It used to appear only once the chat had started.',
      ],
    },
  },
  {
    version: 'v1.13.2', date: 'Oct 16 2026', title: 'Link Claude',
    changes: {
      fix: [
        'Started a prompt before opening the game? It now shows up straight away: "Claude is thinking" picks up the timer from when your prompt really started, and the time you already waited counts toward Patient Angler and your answer fish. Long prompts stay visible too (the plugin checks in every couple of minutes while Claude works).',
      ],
      ui: [
        'Privacy: a short, plain summary of what the game keeps and who can see it, from the title screen, the pause menu, the Lake rules card or /privacy in chat, with a link to the full notice.',
        'The real-weather setting now says how your location is used: rounded to about 10 km and never saved.',
        'New anglers see a small "Link Claude for golden fish" chip after a minute on the lake. Tap it for the one-line install that makes a golden fish bite every time Claude finishes. Once your Claude has linked, it never shows again (or hide it for a week).',
      ],
      new: [
        'Reel Time plugin 0.6.0 for Claude Code: install it once from its public marketplace and it signals the game in every session, with no /fish needed and no approval prompts for its own status updates. If the game can\'t hear it (no beta access yet), it tells you once.',
      ],
    },
  },
  {
    version: 'v1.13.1', date: 'Oct 16 2026', title: 'Soft Light',
    changes: {
      world: [
        'Pollen, petals, leaves, snow, fireflies and sparkles are soft round glows now, not little squares.',
        'Fireflies glow a touch brighter at dusk and at night.',
        'Thunderstorms have real lightning now: a jagged bolt with forks out over the water, and a double flicker that lights up the whole lake.',
        'Rainy days are a little greyer and gloomier.',
      ],
      fix: [
        'A party no longer breaks up when a member\'s connection stutters for a moment; it waits a few seconds first.',
        'The Sunken Bell no longer lights the whole valley with an extra lamp (smoother frames everywhere).',
      ],
    },
  },
  {
    version: 'v1.13.0', date: 'Oct 16 2026', title: 'Lake Levels',
    changes: {
      world: [
        'No more rings of floats on the water. Every lake now climbs in three steps instead, like Cozy Cove: a level to fish anywhere in it, a higher level for its deep end, and the highest for its one named landmark.',
        'Every lake has a landmark of its own, its answer to the Sunken Ruins: the Drowned Mill in Fern Pond, the Bog King\'s Crown in Lilymarsh, the Leviathan\'s Ribs on Frostpine Lake, the Drowned Digger in the Old Quarry and the Sunken Bell in Echo Cavern.',
        'Lake levels: Fern Pond 5 to 15, Lilymarsh 12 to 25, Frostpine Lake 20 to 32, Old Quarry 30 to 40, Echo Cavern 36 to 44. Cozy Cove stays 1, with the Deep at 10 and the Ruins at 20. Rivers and creeks are open to everyone.',
        'Each lake\'s own fish moved with it: its common exclusive bites anywhere in the lake, the next one lives in the deep end, and its legends live at the landmark.',
      ],
      ui: [
        'Cast into water above your level and your line comes straight back. The first time at each lake, a card tells you the level it takes and lists the lake\'s three levels; after that a short note does.',
        'The map shows each lake\'s level range under its name, and picking a lake lists its three levels. The landmarks are on the map too.',
        'The Journal\'s new Lakes section lists every lake\'s levels and the fish at each, with a waypoint button for the deep ends and landmarks you can fish.',
      ],
    },
  },
  {
    version: 'v1.12.1', date: 'Oct 16 2026', title: 'Worth the Wait',
    changes: {
      gear: [
        'Claude\'s answer fish now follows a slower curve: a gold Rare for short prompts, Rare or Epic from 2 minutes, Epic from 10 minutes, and Legendary from 30 minutes.',
        'Diamond answer fish are now rare treats for long runs only: a 10% chance from 30 minutes, 25% from an hour (it used to be 30% from 5 minutes).',
        'The extra weight on answer fish builds over a full hour instead of 15 minutes.',
      ],
      new: [
        'Patient Angler: while Claude works on your prompt, fish bite 20% faster and the reel zone is 5% wider. A gold chip on the HUD shows how long Claude has been working.',
        'Big turns pay: when Claude finishes a multistep turn (5 or more steps, a minute or longer) you get bonus coins and XP on top of the answer fish. More steps, more bonus (up to 120 coins and 80 XP).',
        'Answer streaks: land 3 answer fish in a row without losing one or letting it swim off, and earn a pearl.',
        'Claude rewards are capped at 6 an hour; past that the bell still rings to tell you your answer is ready.',
        'Reel Time plugin 0.4.0 for Claude Code: tells the game how many steps Claude took each turn.',
      ],
      world: [
        'More mossy boulders around Gus\'s shop: a full bank along the lake side that reaches right up to the stone foundation, rocks along the porch front, and smaller stones sloping down to the sand, so no gap shows under the building.',
      ],
      ui: [
        'Action buttons for yourself (Go ashore, Sit, Launch the boat, emptying a trap) now sit in a fixed spot above the hotbar instead of over your head, so they no longer get in the way when you click to cast.',
        'No more "Put out Crab Pot" pop-up every time you face water: crab pots, set lines and lobster cages wait in your backpack (B) with a Place button.',
      ],
      fix: [
        'The "Claude is thinking" timer no longer sticks at 0:00 when a start time arrives from a clock that runs ahead.',
      ],
    },
  },
  {
    version: 'v1.12.0', date: 'Oct 16 2026', title: 'The Valley Climb',
    changes: {
      new: [
        'Every lake now has a ladder like Cozy Cove\'s. Its shore is open to everyone; its best water is a set of marked spots (rings of floats with a level sign) that open as you level up: Fern Pond from level 5, Lilymarsh from 12, Frostpine from 20, the Old Quarry from 30 and Echo Cavern from 36.',
        '13 new fish that live only in those spots, among them the Pond Sage, the Wreck Eel, the Bog King, the Frost Burbot, the Pit Lurker, the Grotto Ghost and a second mythic, the Leviathan\'s Heir (Frostpine, level 45, at night).',
        'The Crystal Pike, the Storm Sturgeon and the Echo Eel moved to their own lakes\' legend spots.',
        'Shellfish: 11 crayfish, crabs, shrimp and mussels that never take a hook. Crab pots now catch mostly shellfish, and the new Lobster Cage (level 15, Gus\'s shop) catches the big ones: Signal Crayfish, Marron, Mitten Crab, Noble Crayfish, Ghost Crayfish and the Giant Murray Crayfish of the Old Quarry.',
        'Level-up card: shows what just opened, with a Show me button that sets your waypoint there.',
        'Rewards at levels 25, 30, 35, 40, 45 and 50: coins, pearls and a new title each.',
        'Journal: Your climb shows the next unlock, any level rewards you are owed and every marked spot (with its fish).',
        'Add friends by name, even when they are offline: type their name in the Friends tab (or /friend name). They see your request the next time they log on, and it waits in a Friend requests list until they answer.',
      ],
      world: [
        'Pinewood Lodge lights up after dark: iron lanterns by every door, warm windows and a pool of light out front.',
        'Mossy boulders now bank the lake side of Gus\'s shop, so it no longer floats over the sand.',
        'The boulder that had landed on the bike shop\'s display rack has rolled off to one side.',
        'Deer run properly now: long bounding strides with all four legs gathered mid-leap, instead of tiny frantic steps.',
      ],
      ui: [
        'Cabin editor: hover a piece of furniture to highlight it, then click and drag to move it (dragging didn\'t work before). Q and E turn the room (X still works).',
        'The chat box can be resized: drag the grip in its top-right corner (double-click it to reset). Your size is remembered.',
        'Lake rules are much easier to read (light text on the dark card), with each icon lined up with its rule.',
        'The bike shop\'s sign is now a carved board like the trailer park\'s, and SPOKES & SPROCKETS fits on it.',
        'Everything in Gus\'s shop has a picture now: bait, upgrades, away gear, cabin decor, pets, clothes and emotes.',
        'The map shows every marked spot, with its level until you reach it.',
        'The Fishpedia says which spot a fish lives in, and which trap catches each shellfish.',
      ],
      fix: [
        'Only the lake\'s owner and the admins they add can see the Admin button (people with edit access to the page no longer do).',
        'Clicking the floor in the cabin editor no longer throws an error.',
      ],
    },
  },
  {
    version: 'v1.11.0', date: 'Oct 16 2026', title: 'Fishing Buddies',
    changes: {
      new: [
        'Parties: team up with up to 4 anglers. Party members get a coloured marker over their heads and their nameplate shows however far away they are (pinned to the edge of your screen when they are off it), and a party frame on the left shows where everyone is.',
        'Friends list: add friends from a name in chat, the On the lake list or /friend name. Friends show up whenever they are on the lake, with one-click whisper and party invite.',
        'Friends & Party panel (O, or the people button on the bar): your party, your friends and everyone on the lake.',
        'Chat channels: Say (the default) only reaches anglers within about 40 yards; General (/g) reaches the whole lake; Party (/p) reaches your party; whispers (/w name) reach one angler. Click the channel button by the chat box to switch.',
        'New commands: /invite name, /leave, /kick name, /friend name, /friends, /g, /p.',
      ],
      ui: [
        'Nameplates over other anglers and the locals only show within about 40 yards, so busy lakes stay readable. Your party is the exception.',
        'The map only shows your party now (in their party colours), not every angler on the lake.',
      ],
      fix: [
        'Only your party can hop into your boat; strangers can no longer climb aboard.',
      ],
    },
  },
  {
    version: 'v1.10.1', date: 'Oct 16 2026', title: 'Tell Us',
    changes: {
      new: [
        'Report a bug: from the main menu, the pause menu (Esc) or /bug in chat. Pick what kind of problem it is, describe it, and optionally attach game details (version, browser, where you were, recent errors). Reports go straight to the Reel Time team.',
        'Report a player: from the pause menu, the Play with friends list, a name in chat, or /report name. Choose misconduct, cheating or exploiting, or an inappropriate name or outfit, and add details. The player is never told who reported them.',
        'Admins get a Bugs tab in the Admin panel with every bug report.',
      ],
      fix: [
        'If a report can\'t be sent from your copy of the game (for example a view-only share), the form lets you copy it instead of losing what you typed.',
      ],
    },
  },
  {
    version: 'v1.10.0', date: 'Oct 16 2026', title: 'Lake Rules',
    changes: {
      new: [
        'Lake rules: the first time you start Reel Time, a short code of conduct shows once (be kind, keep chat friendly, play fair). Read it again any time with /rules.',
        'Report and moderate: click a name in chat to Report them to the lake\'s admins (or type /report name).',
        'Admin panel for the lake\'s owner and admins: see who is fishing, suspend anglers for 1 hour to 7 days or ban them, lift bans early, read reports, and manage the staff list. Banned anglers can\'t join the lake and vanish from everyone else\'s. Your Claude account is the admin login.',
        'Weekly quest on the notice board: one bigger job each week (Monday to Sunday, UTC) worth 5 pearls, with a countdown to the next one.',
        'The Fishpedia is now a book: flip page by page (arrows, buttons or the ← → keys) with a big picture, your catches, where and when to look, and two fun facts for every one of the 46 species. Contents shows the old grid.',
        'The Leaderboard opens on the five lakes: each lake has its own board with this week\'s top angler, their catch, their country\'s flag and the runners-up.',
      ],
      ui: [
        'The Creel is now your Inventory, a backpack grid: fish, roasted snacks, your treasure map and your shovel each get a slot. Hover a slot to see what it is and what it\'s worth; click it to sell, store, lock, name, eat or read it.',
        'Daily requests are always three, with modest rewards (coins and XP; pearls now come from the weekly quest). The daily bonus is 100 coins and 80 XP.',
        'Avatar creator: every hair, face, outfit and body option shows a picture of your angler wearing it.',
        'A new emote wheel: point at a slice and click, or press 1 to 8. Emotes you haven\'t bought show with a lock.',
        'Chat starts tucked away for everyone; open it with Enter or the chat button.',
        'The bike button is a white outline like the others.',
        'The Shop button is switched off for now: walk to Gus\'s counter to buy things in person.',
        'Your cottage: turn the camera with Q / X or the new on-screen arrows (in both views, even sitting down), and reset it with one click.',
        'Cottage editor: click a piece to pick it, then nudge it 10 cm at a time (arrow keys or buttons, Shift for 50 cm), turn it to any angle with the dial or 15° steps (R / Shift+R), type exact positions, or switch on snap to grid.',
      ],
      world: [
        'Gus\'s shop now stands fully on dry land, a few steps back from the water and turned to face the cove.',
        'The Frozen Leviathan has been turned around on its ice floe.',
      ],
    },
  },
  {
    version: 'v1.9.14', date: 'Oct 15 2026', title: 'Five Lakes Valley',
    changes: {
      world: [
        'The valley has a new name to match its five lakes: Three Lakes Valley is now Five Lakes Valley (on the map, the catch cards and the place names as you wander).',
      ],
    },
  },
  {
    version: 'v1.9.13', date: 'Oct 14 2026', title: 'Out on the Ice',
    changes: {
      world: [
        'The Frozen Leviathan has drifted out to the middle of Frostpine Lake: the whole skeleton now lies on a thick slab of lake ice floating in open water, its bass skull gaping toward the west shore. Row out to see it up close (boats bump against the ice).',
        'Deep-water fishing spots no longer form under the Leviathan\'s ice.',
      ],
    },
  },
  {
    version: 'v1.9.12', date: 'Oct 14 2026', title: 'Bass Bones',
    changes: {
      world: [
        'The Frozen Leviathan has a new head: a giant largemouth bass skull with a high crested forehead, deep round eye sockets, a broad gaping jaw jutting out past the upper lip, fanned gill covers and rows of sharp, back-curved teeth. Its chin now rests on a heap of ice.',
        'The Cozy Cove campfire moved down onto the level ground near the shore, so it no longer sinks into the hillside.',
      ],
      fix: [
        'Trailer windows are plain tinted glass now, without the flickering stripes.',
      ],
    },
  },
  {
    version: 'v1.9.11', date: 'Oct 14 2026', title: 'The Frozen Leviathan',
    changes: {
      world: [
        'The Frozen Leviathan: the skeleton of a giant ancient fish lies frozen on the north shore of Frostpine Lake. Its ribs arch high enough to walk under, its tail is locked in a block of clear ice, and its great toothed skull gapes over a frozen pool, all frosted, snow-dusted and hung with icicles. It is marked on the map.',
      ],
      fix: [
        'The corner where the Quarry Cut meets the Echo Cavern channel is now a deep, round pool with steep banks, so boats can turn the corner without running aground on a gentle slope.',
      ],
    },
  },
  {
    version: 'v1.9.10', date: 'Oct 14 2026', title: 'End of the Rainbow',
    changes: {
      new: [
        'A pot of gold at the end of the rainbow: when a rainbow shows up after rain, one of its feet lands on dry ground beside a lake, and a little iron pot brimming with gold coins and pearls glows there. Find it first and press E for 300 coins, 3 pearls and some XP (one pot per rainbow).',
      ],
      world: [
        'Rainbows stand still: each one picks a spot over one of the lakes (the same spot for everyone that day) and stays put, instead of turning to follow you around.',
      ],
    },
  },
  {
    version: 'v1.9.9', date: 'Oct 14 2026', title: 'Flag Relay',
    changes: {
      fix: [
        'No more fast travel from the map: waystones only carry you from one stone to another while you stand at one (press E). Walk, row or ride your bike to get around.',
        'The Cozy Cove campfire and its log benches moved off the walking trail, onto the grass beside it.',
        'Lake flags count everyone: anglers whose copy of the game can\'t save to the shared board (shared view-only) now have their catches recorded by whoever they\'re fishing with, so a 53 lb catch plants their flag like it should. They also get a note explaining why.',
      ],
    },
  },
  {
    version: 'v1.9.7', date: 'Oct 14 2026', title: 'Wild Things',
    changes: {
      new: [
        'Wildlife between the lakes and towns, all modelled in Blender: white-tailed deer (bucks with antlers, does) grazing in little groups, rabbits nibbling and hopping about, and raccoons with masks and ringed tails snuffling through the grass.',
        'Get too close and they bolt: deer bound away flashing their white tails, rabbits zigzag off, and raccoons shuffle away.',
        'Birds overhead: seagulls wheel and glide over every lake, and hawks circle slowly high above the woods.',
      ],
      gear: [
        'Crab pots and set lines now soak for a set time, then haul themselves in: their catch goes to your creel and the gear back to your tackle. Crab pots soak 18 minutes and set lines 20, and the prompt shows the minutes left.',
        'They fill much faster to make up for it: a crab pot catches something every 75 seconds (full in 5 minutes, 3 to 4 full loads a soak), a set line every 2.5 minutes.',
        'Up to 3 crab pots and 3 set lines per lake at a time, and you can own up to 6 of each.',
      ],
    },
  },
  {
    version: 'v1.9.6', date: 'Oct 14 2026', title: 'Second Helpings',
    changes: {
      new: [
        'Eating a roasted fish is a little scene now: the fish appears in both hands at your mouth and you eat it a bite at a time, with crumbs, before Well Fed kicks in.',
      ],
      fix: [
        'The roasting stick is held in both hands, running from your grip out over the flames.',
        'The lighthouse lens flare is half the size when a beam points at you.',
        'The dome tent at Fernview has a proper doorway: a rounded arch with a zipped trim and a dark opening, instead of the odd flap.',
      ],
    },
  },
  {
    version: 'v1.9.5', date: 'Oct 14 2026', title: 'Campfire Cookout',
    changes: {
      new: [
        'Campfire cookouts: sit on a log by any campfire and press E to "Roast a fish". Pick one from your creel and hold it over the flames on a stick. It browns from raw to golden to roasted, sizzling, with smoke curling off it.',
        'When it\'s done, eat it right off the stick or pack it in your snack bag. Packed fish show at the top of your creel; eat one any time.',
        'New buff, Well Fed: Smells Like (your fish). You smell so much like that fish that its relatives come looking for it. For 3 to 6 minutes (bigger fish last longer), that species bites far more often, every bite comes a little sooner, and your hands are steadier on the reel. Hover the chip to see it.',
      ],
      fix: [
        'Pets ride properly in your boat: they sit on the floor and rise, pitch and roll with it on every wave instead of the hull clipping through them.',
        'When a friend hops into your boat, your pet moves to the back, behind you, so nobody sits on top of it.',
        'Sign lettering shrinks to fit, so "Fernview Campground" fits on its sign, and signs are sharper.',
      ],
    },
  },
  {
    version: 'v1.9.4', date: 'Oct 14 2026', title: "Sundae's Trailer Park",
    changes: {
      new: [
        'Every lake has a flag now: Cozy Cove, Lilymarsh, Fern Pond and the Old Quarry each get a stone cairn on the bank, flying the flag of whoever lands the heaviest fish there this week (just like Frostpine).',
        "Meet Sundae, owner of Sundae's Trailer Park, and his tenant Maria Lopez. He's out by site 2 yelling at her about the rent, jabbing a finger with every word, while she cries into her hands.",
      ],
      world: [
        "Sundae's Trailer Park, east of Fern Pond: five trailers modelled in Blender (silver Airstreams with striped awnings, a two-tone 50s canned ham and a little red teardrop) on gravel pads with picnic tables, numbered posts and string lights, with a sign over the way in.",
        'Fernview Campground off the north shore of Fern Pond: canvas A-frame and dome tents round a campfire with log benches you can sit on, a picnic table and a sign.',
        'Both are on the map and the "Now entering" banner.',
        'New Blender tents at Fernview: canvas ridge tents with porch awnings, guy lines and ground mats, a round bell tent with bunting, and a proper two-pole dome tent with a front porch.',
        'Fern Pond\'s ferns are real plants now: clumps of arching fronds lined with tapering leaflets that sway in the breeze.',
        'Sundae wears a maroon cap with a white lone star.',
      ],
      fix: [
        'Grass, ferns and bushes no longer grow through the trailers, tents, picnic tables or the campfire.',
        "Both posts of the Sundae's Trailer Park sign stand the same height, up past the board.",
        'The lake flag poles are taller, with a brass ball on top and the flag hanging just below it.',
      ],
    },
  },
  {
    version: 'v1.9.3', date: 'Oct 14 2026', title: 'Flags Over Frostpine',
    changes: {
      new: [
        'Pick your country of origin: a new Country tab in the angler creator, with 60 flags and a search box. New anglers choose one before they head out, and anglers from before today are asked once when they arrive.',
        'The Frostpine flag: whoever lands the heaviest fish at Frostpine Lake this week gets their country\'s flag planted on the stone cairn by the shore. It flutters in the wind, the chat calls out each new record holder, and "Read the cairn" tells you whose flag it is and what fish to beat. Last week\'s flag stays up until someone claims this week.',
        'Talking to locals is a little scene now: the camera swings round over your shoulder, they turn to face you, and a dialogue box at the bottom of the screen types out what they say. Accept or turn down their request (click, 1/2, or Enter), and press Escape to walk away at any time.',
      ],
      world: [
        'The fallen log by the trail from the bridge to Gus\'s cabin has moved toward the shore, out of the way of the path.',
        'The cairn at Frostpine Lake no longer flies a French flag (it now flies the record holder\'s).',
      ],
      fix: [
        'A fish too heavy for your line snaps it the moment it\'s hooked, with a tip about which rod to get, instead of breaking at the end of a long fight.',
        'Fewer too-big fish in plain open water: about 30% of the fish your line couldn\'t hold are swapped for ones it can, so new anglers aren\'t snapping line on half their casts. Deep water and feeding schools are unchanged.',
        'Hop on your bike anywhere but water: bridges, docks, jetties and boardwalks included.',
        'Accepting a local\'s request works: the "Talk to" prompt opens the conversation instead of sitting over their speech bubble.',
        'Locals always have a request each day, even if they arrive after the day\'s goals are set.',
        'Closed the seam on Echo Cavern\'s arch where you could see inside the rock.',
      ],
    },
  },
  {
    version: 'v1.9.2', date: 'Oct 14 2026', title: 'Fairy Tunes',
    changes: {
      new: [
        'A gift for testers: everyone who plays today gets 1,000 coins once, to try pets and bikes.',
        'The soundtrack goes whimsical: a soft fantasy wooden flute sings the gentle tunes and the bridges, a glockenspiel sparkle runs up the scale as each part begins, and chords get a dreamy, storybook ninth with arpeggios that climb past the octave.',
        'A real lighthouse light: a rotating lens throws two soft beams of light that fade along their length and into the fog, shimmer in the night haze, flare when they swing past you, and sweep a pool of light across the water.',
        'Three new Cozy Cove songs (Cove Morning, Little Dock Song, Lazy Bobber): kalimba, marimba and celesta tunes over soft felt piano.',
      ],
      fix: [
        'No more synth guitar or heavy bass anywhere in the music: songs that used them now use felt piano and marimba, and the bass is a soft low piano note.',
        'The music never cuts out when you wander between places: a song keeps playing wherever it fits, and a change crossfades straight into the next song with no silence. Gaps between songs are short, and notes are no longer dropped when the game is busy.',
        'Bikes ride over every bridge (a lantern under the Frostrun bridge was blocking the deck; bridge decks now ignore anything on the ground below, and no lantern stands next to a bridge).',
        'No boulder sits on the Cozy Cove pier (big rocks keep their whole width off docks and bridges).',
        'Echo Cavern\'s entrance is one solid piece of rock: the arch\'s ends are bevelled into big rounded lips, its feet sink into the ground instead of showing a cut edge, the ridge over the tunnel rises gently from the mouth, and nothing pokes into the tunnel\'s ceiling or walls. Boulders of all sizes sit along the line where the rock meets the grass.',
        'The Old Quarry jetty is turned 30 degrees toward the stream, so boats can pull straight in, and its waystone stands up on the grass.',
        'Pets pace themselves: a short-stepped walk beside you, a trot when you run, and long loping strides beside your bike instead of a frantic scramble.',
        'Frostpine\'s pines are plain green for now: the low-poly snow looked like unfinished textures.',
      ],
    },
  },
  {
    version: 'v1.9.1', date: 'Oct 14 2026', title: 'Songs of the Valley',
    changes: {
      new: [
        'A new soundtrack, 18 cozy songs composed live as you play: soft piano, felt piano, nylon guitar, kalimba, marimba, music box, vibraphone, celesta, electric piano and upright bass, with brushed drums. Every place has its own songs (Cozy Cove, Frostpine, Lilymarsh, the Quarry, Pinewood Lodge\'s fireside waltz, Echo Cavern\'s glowworm lullaby), and the time of day and the rain change the mood.',
        'Songs are written fresh each time from their melody, chords and style, so they never repeat exactly. They crossfade when you move somewhere new, with quiet spells of birdsong and water in between.',
      ],
      look: [
        'Pets run properly now: they trot with their legs at a walk and gallop when they have to hurry (the duckling waddles), and they keep up with you on your bike.',
        'Pets sit with their front legs straight and their back legs tucked under, in your boat and beside you while you fish.',
        'The Lab pup no longer has pink cheeks.',
      ],
      world: [
        'Feeding schools are easy to spot from across the lake: a deep blue pool of darker water spreads out from the middle with slow rings, under the splashes and leaping fish.',
        'The Blood Moon is properly red: a deep crimson moon and halo, red sky and haze, and red moonlight.',
        'The Old Wreck: a big old wooden ship lies cracked in two in the middle of Lilymarsh, ribs showing at the break, its mast snapped and the fallen top lying across the gap with a torn sail. Modelled in Blender, and on your map once you find it.',
        'Trees and marsh willows no longer grow out of cliffs and steep rock faces.',
        'Echo Cavern\'s rock is just a skirt round the dome and the tunnel now; the grass and trees come back right up to it.',
      ],
      fix: [
        'Stalactites hang from the inside of the cavern roof and no longer poke out through the top.',
        'The quarry crane\'s hook line hangs from the end of its boom.',
      ],
    },
  },
  {
    version: 'v1.9', date: 'Oct 14 2026', title: 'Spokes & Sprockets',
    changes: {
      new: [
        'Bikes! Rosie Spokes runs a bike stall at Pinewood Lodge with four bikes, modelled in Blender: the Meadow Cruiser (mint, whitewalls, a basket of wildflowers), the Red Rocket (drop bars, the quickest), the Ridge Runner (knobby tyres and a suspension fork, climbs hills without slowing) and the Angler\'s Tourer (a crate, a rod tube and a headlamp).',
        'Press N (or the bike button on the hotbar) to hop on or off anywhere on dry ground. W pedals, S brakes and backs up (slowly, looking back over your shoulder), A/D steer. Both mouse buttons pedal toward where the camera looks.',
        'The handlebars and front wheel turn the way you steer, the wheels roll and the pedals go round with your speed, and you lean into the turns. Top speed is well past a sprint, but not silly.',
        'Every bike has a bell: the fishing button rings it while you ride, and anglers nearby hear it ding-ding. Friends see your bike, your pedalling and your steering.',
      ],
      world: [
        'Echo Cavern is limestone now, the classic cave rock: warm cream, tan and ochre in soft layers, with darker bedding lines, pale drip streaks and a fine pitted grain (no more dark goo). The stalactites match.',
        'You walk on top of the cavern\'s rock, and the dome and the tunnel arch are solid: no more walking into them.',
      ],
      fix: [
        'Cave crystals only grow on the walls: none float in the air at the tunnel mouth any more.',
        'Locals keep well clear of bridges when they fish, so no line crosses one.',
        'Building signs sit on the wall under the eaves, so the roof no longer hides any letters.',
      ],
    },
  },
  {
    version: 'v1.8.2', date: 'Oct 13, 2026', title: 'Feeding Schools',
    changes: {
      world: [
        'Whirlpools are gone: the hot spots out on the water are feeding schools again. The water churns and glitters, fish circle just under the surface with their backs breaking it, and every few moments one leaps clear with a splash and a ring.',
        'Feeding schools work as before: cast into one from your boat for better odds on rare fish. Cozy Cove, Lilymarsh and Frostpine Lake always have two.',
        'A feeding school only scatters after 8 fish are caught out of it (shared by everyone on the water). Casts that miss, lose the fish or snag junk don\'t use it up. A new school gathers on that water a minute after one scatters.',
        'The Old Quarry and Fern Pond get a feeding school of their own (one each), out of reach from the shore.',
        'Every bridge arches higher in the middle, so you row under with room to spare, and only the posts at each end touch the ground: the water underneath is clear.',
        'Echo Cavern is one piece of dark obsidian, inside and out: a smooth, rounded dome rising out of a rough-but-smooth obsidian skirt where the hill was, with the tunnel arch running into it. No boulders and no spiky rock anywhere.',
        'Grass blades are the same bright green on both sides: no more half-dark tufts depending on which way you look.',
        'The wild ducks are cute little mallards now (green-headed drakes and speckled-brown hens, modelled in Blender): round bodies, big shiny eyes, and they tip bottoms-up to dabble.',
        'Inside Echo Cavern the obsidian dome comes right down to the water all the way round, stalactites hang from the ceiling, and bioluminescent bugs drift and pulse in teal, green and blue through the cave and the tunnel.',
      ],
      ui: [
        'Feeding schools show on the map as a leaping fish. Tips, toasts, chat and the daily request all say feeding school now.',
        'Treasure maps mark themselves: a new map puts a big red X on your valley map and points your waypoint at it. The X stays until you dig the chest up or 10 minutes pass; open the map from the Journal to mark it again.',
        'Hover over (or tab to) the Golden Line chip to see exactly what it does and how long is left; the streak chip explains itself too.',
        'Group photos put your friends\' names on their own line of the polaroid ("with Buddy & Pip"), and friends who walk up while the camera is open are framed in automatically.',
        'Group shots live inside the camera now: open the camera (P) and the Group shot button is always there, lighting up when friends are close. The separate Group selfie button is gone.',
      ],
      look: [
        'New pets, modelled in Blender and made to be very cute: a round orange tabby with a curly tail, a golden Lab pup with floppy ears and a red collar, an otter with a big fluffy tail, and a fuzzy yellow duckling. They look around and tilt their heads while you fish.',
        'Gus has his colours back: a blue-grey heron in an olive bucket hat and green apron, with soft feather mottling and a woven look on his hat and apron (no more washed-out cream under the lanterns).',
        'The sun is a soft, glowing disc and the moon is smoothly shaded with gentle craters and a soft-edged phase, instead of pixel squares.',
        'Echo Cavern: the tunnel is thick, solid rock. No more thin edges, from outside or looking out, and no stars or sky showing through the roof.',
        'Lake Legends now faces the trail in front of it, and the notice board stands beside your cottage, facing the cove.',
        'The cove crossroads signpost is now two taller posts, one beside each trail (Lilymarsh and Quarry one way, Fern Pond and Frostpine the other), clear of the campfire and the path.',
        'Cottages and huts have proper triangular gable ends under the roof, instead of rectangles poking through it.',
      ],
      fix: [
        'Hotbar tooltips no longer say "Shop null".',
        'Boats can\'t row through the cove dock, the lake jetties or the Lilymarsh boardwalk any more (bridges are still high enough to row under).',
        'Riding in a friend\'s boat: the passenger sits still on the front seat on both screens, facing where the boat goes, instead of trailing behind it or spinning in place.',
        'Pets sit properly in your boat (and beside you while you fish): haunches down, chest up, head level.',
        'The map stays sharp when you zoom all the way in: the terrain draws as crisp squares and the names, pins and icons stay crisp and readable.',
        'You and the locals can\'t walk into the Lake Legends board any more.',
        'A treasure map you catch opens after you close the catch card, not on top of it.',
        'The map\'s Clear waypoint button has black, bold text so you can read it.',
        'Shore chairs and fishing locals sit and stand on visibly dry ground everywhere: no more chairs or anglers in the shallows along the smoothed shorelines.',
        'Lines can\'t pass through solid things: your cast stops short of a bridge, dock or jetty in the way, and locals no longer fish through bridges.',
        'The sunken ruins\' glow on fog nights is a soft shaft of light that fades into the fog, not a solid bright block on the water.',
        'Fast travel is one click: pick a place and you\'re there, no confirmation screen (a line in the water is reeled in).',
        'M closes the map again (and C, J, G, B and the Fishpedia key close their own panels, or switch straight to another one).',
        'The camera inside Echo Cavern stays inside the dome.',
        'Echo Cavern\'s crystals sit on the walls just above the waterline instead of floating or hiding in the rock.',
        'Trail lanterns only stand on dry ground (no more lantern standing in the river).',
        'Shore chairs only go on level, dry ground at the water\'s edge (no more chair stuck in the side of a hill).',
      ],
    },
  },
  {
    version: 'v1.8.1', date: 'Oct 13, 2026', title: 'Shovels and Swirls',
    changes: {
      new: [
        'Treasure needs a shovel now: Gus sells one in the shop\'s Away gear tab. You dig with it in both hands: the blade bites, you lever it up and toss the dirt over your shoulder, and a mound grows beside you.',
        'A treasure compass pops up when you are near a map\'s X. The red needle points to the spot from where you are looking (up is straight ahead), the dial keeps north on N, and it shows how far you have to go. "Dig here!" when you are on it.',
        'Treasure chests push up out of the ground, rattle, then the lid flips back and real coins and pearls burst out, bounce and spin, and zip into your pockets one by one.',
        'Golden Line: a Super Cast gives you a 75-second buff (faster bites, an easier reel, more gold fish, longer casts). A timer chip counts it down; another Super Cast tops it up.',
      ],
      world: [
        'New trees and bushes, modelled in Blender: natural low-poly pines (snowy around Frostpine), round oaks, autumn trees, birches, apple trees, and leafy bushes with berries.',
        'Whirlpools are real vortices now: the water sinks into a funnel, spins faster toward the middle and winds into foam spirals, and leaves, twigs and foam ride the current around and down the drain.',
        'Cozy Cove, Lilymarsh and Frostpine Lake always have two whirlpools spinning. When one is used up, a new one opens on that water a minute later.',
        'Echo Cavern is much bigger inside (a wider lake, a higher dome and a wider tunnel), and the camera stays inside the cave instead of clipping through the rock.',
        'Every footbridge now crosses the water straight from bank to bank, with an arched deck and no posts in the water, so boats row underneath. The Frostpine creek bridge no longer runs along the creek.',
        'The Lilymarsh boardwalk starts on the mainland (not the little island), you can walk it, and you can tie up your boat beside it and step out.',
        'Every jetty starts on dry land: the Old Quarry pier no longer floats off the shore.',
      ],
      ui: [
        'Super Casts are harder: the gold band at the top of the power bar is half as wide.',
      ],
      fix: [
        'Getting out of the boat on a coast no longer leaves you stuck in the water: you land where you can walk, and you can wade out of knee-deep water (a bit slower).',
        'Rocks are as tall as they look: jump onto them, stand on them, or hop over them, instead of hitting an invisible pillar.',
        'Claude\'s bell, "Claude\'s done" message and golden splash are only ever for you: nothing about your Claude turns is sent to other players.',
      ],
    },
  },
  {
    version: 'v1.8', date: 'Oct 13, 2026', title: 'The Big Valley',
    changes: {
      new: [
        'Super Cast: let go in the shimmering gold at the very top of the power bar. A chime, a golden burst and a sparkling flight; it flies further, and fish bite faster with better odds.',
        'Rod holders (new upgrade): cast, then press E to prop the rod up on the bank and cast another. A bell rings and a "!" floats over a propped rod when it bites. Get to it and press E.',
        'Ride together: walk up beside a friend\'s boat and press E to hop in. They row, you sit up front and fish. Press E to hop out.',
        'Group selfies: the new Group selfie button frames you and every friend nearby, and their games tell them to smile. Everyone\'s name goes on the polaroid.',
        'Treasure maps: now and then a fish comes up with a soggy map. Read the sketch, find the spot (the map warms as you get close), and press E to dig up a chest of coins, pearls and sometimes gear.',
        'A new quest line, the Valley Expedition: eight parts that take you up every waterway, into Echo Cavern, under the Blood Moon and after the Echo Eel.',
        'Collection quests in the Journal: rewards for 10, 20, 30, 40 and every kind of fish, your first epic and legendary, and five gold fish.',
        'New daily requests (Super Casts, swirling pools, rod holders, the waterways, rare fish), and a daily bonus for finishing all three.',
      ],
      world: [
        'The valley is twice as big beyond Cozy Cove: Frostpine Lake, Lilymarsh, Fern Pond and the Old Quarry each have four times the water.',
        'Every lake is now joined by water: Willow River, Frostrun Creek, Fern Brook and the Quarry Cut. Row anywhere from the cove.',
        'Echo Cavern: a flooded cave under Cavern Hill. Row up the spur off the Quarry Cut and into the dark: glowing crystals, glowworms and five cave-only fish.',
        'Each lake has its own character now: ice floes, snowy boulders and a trapper\'s hut at Frostpine; willows, a boardwalk and cattails in Lilymarsh; giant ferns, stepping stones and a gazebo at Fern Pond; an old crane, cut stone and a mine cart at the Quarry.',
        'Footbridges stand wherever a trail crosses a waterway, arched so boats row underneath.',
        'Weather matters: fish fight harder in rain and storms, and each weather brings its own fish (Grayling, Drizzle Dace, Rainspotted Trout, Thunder Bass).',
        'The Blood Moon: about one night in seven the moon rises red. Piranhas and other hunters bite (fast bites, fierce fights), including the legendary Crimson Wolf Fish.',
        'New collections: Echoes in the Dark, Fair Weather Friends and the Blood Moon Bestiary.',
        'Gus has a whole new look: a proper heron with a bucket hat, round spectacles, a bow tie and his green apron.',
      ],
      gear: [
        'Every rod has a line rating now: the heaviest fish it can land (the Willow Stick holds 8 lb, the Diamond Rod 160 lb). Heavier fish break the line partway through the fight, and the reel shows the rating.',
        'Braided line raises the rating by 35% per level, and upgrades now go to level 5.',
        'Upgrades cost more (about 2.5x), with two new top levels for each.',
        'The Tackle Box shows your current line rating.',
      ],
      ui: [
        'Hold both mouse buttons to walk (or row) forward and steer with the mouse.',
        'Saving a photo now gives feedback: a click, a flash, the button turns green and says where it went. Photos save to your computer, and there\'s a Copy button (and Share, where your device has one) for posting.',
        'Ambience is half as loud by default, and rain is softer and more soothing: a gentle patter, a low hush and the odd drop on the leaves.',
        'The "Row to dock" button no longer floats over your head while you row.',
        'Swirling pools now last 12 casts (shared by everyone), then spin out and a new one opens somewhere else.',
      ],
      fix: [
        'No more invisible walls: where you can walk follows the ground you see. Gentle slopes and plateau tops are open, you can wade a step into the shallows, and only real cliffs and deep water stop you.',
        'Rocks are solid where they look solid: colliders now match each boulder\'s shape, and mid-sized rocks block you too.',
        'Faster drawing on the bigger map: trees, plants and ground cover far away are skipped, and the water uses fewer triangles.',
      ],
    },
  },
  {
    version: 'v1.7.2', date: 'Oct 13, 2026', title: 'Share your lake',
    changes: {
      new: [
        'Tackle Box: swap your rods, lures and boats from anywhere. Press G or tap the box button on the hotbar; it lists everything you own with an Equip button.',
        'With the Reel Time plugin, /fish in a Claude chat opens the lake right in the tab beside the chat. In a terminal you still get a link.',
      ],
      fix: [
        'The game can be shared with friends again: it no longer packs in font or model files that Claude\'s sharing check could not review.',
        'Rods and lures are now built from plain model data inside the game, and look exactly as before.',
        'Fonts load from Google Fonts. If they can\'t load, the game falls back to similar system fonts.',
        'If your copy of the game can\'t reach the shared lake, it now tells you you\'re fishing solo and how to get invited, instead of quietly leaving you alone.',
      ],
      ui: [
        'The shop\'s boat tab no longer mentions the old boat rack: launch from any shore.',
        'Play with friends explains how to invite people: set Share to Only you, invite them by email as an Editor, and they open it signed in. While "Anyone with the link" is on, outside friends fish solo.',
        'A solo player\'s Play with friends panel shows a short connection check, to help sort out invites.',
      ],
    },
  },
  {
    version: 'v1.7.1', date: 'Oct 12, 2026', title: 'Lush meadows',
    changes: {
      world: [
        'Lush grass grows wherever the ground is grassy, and it sways in the wind.',
        'Bushes dot the meadows, some with red, purple or orange berries.',
        'Big mossy boulders sit half-buried around the valley, with pebbles around the larger ones. The big ones are solid.',
        'Fallen branches and twigs lie scattered on the ground.',
        'Every waystone keeps a clear patch around it, so nothing blocks your way to it.',
        'The Lake Legends board moved up onto the grassy rise above the beach, out of the shallows, still facing the dock.',
        'The lighthouse island is much bigger, roughly three times the size: a wide sandy beach with a raised middle, big enough to walk around, camp out and fish from.',
      ],
      ui: [
        'Graphics quality sets how far around you the grass is drawn: far on High, nearby on Medium. Low skips the grass so older laptops stay smooth.',
        'Grass fills in a little at a time as you walk, so it never stutters.',
      ],
    },
  },
  {
    version: 'v1.7', date: 'Oct 12, 2026', title: 'A smooth valley',
    changes: {
      world: [
        'The whole valley is smooth now: rolling hills, round mountains, and lakes, ponds and the river with curved, natural edges instead of blocky steps.',
        'Ground materials blend into each other: grass, sand, dirt, rock, snow, mud and lake bed, with soft painted textures instead of pixel tiles.',
        'Dirt paths curve along the trails with soft edges.',
        'Steep slopes turn to bare rock. The waterfall and its boulders sit on the hillside.',
        'Water edges, shore foam and light ripples are smooth too, and so is the map.',
      ],
      new: [
        'Launch your boat from any stretch of shore: walk to the water and press E. The boat rack is gone.',
        'Look around inside your cottage: drag to turn the camera and scroll to zoom. Walls fade out when they are in the way, instead of the camera squeezing in.',
      ],
      look: [
        'Dresses and skirts join the body properly: no gap at the waist from any angle.',
      ],
      fix: [
        'A short cast from the dock carries on past the planks to open water, instead of failing.',
        'Walking controls in the cottage stay steady as you turn.',
        'Friends who drop out for a moment (a slow tab, a sleeping laptop) come back with their name, look and cottage, not as a blank angler.',
      ],
    },
  },
  {
    version: 'v1.6.2', date: 'Oct 12, 2026', title: 'Sit, run, dance, and a tidier pier',
    changes: {
      new: [
        'A real run when you hold Shift: quicker strides, pumping arms and a small forward lean. Your rod goes on your back while you run.',
        'Sit in chairs properly: hips on the seat, legs out, and a dress drapes over the seat. Only your upper body turns as you fish.',
        'New emote: the Orange Shuffle.',
        'Locals answer your emotes. Wave, cheer, clap or dance near one and they turn and reply in kind.',
      ],
      gear: [
        'Rods now sit in your hands where they should, so the line starts right at the rod tip.',
        'While fishing, the rod leans forward and out over the water, clear of big hat brims.',
        'A rod stowed on your back no longer pokes into the ground.',
      ],
      look: [
        'Hair stays tucked under every hat. No hairstyle pokes through any hat now.',
        'The belt lantern sits on the front of your right hip, and it is 20% softer.',
      ],
      world: [
        'The lighthouse sits right on its sandy island, without the block of grass and dirt.',
      ],
      fix: [
        'You can only cast when there is water within reach in front of you. Away from water, the game tells you to face the water instead.',
        'You can no longer walk through the rail at the end of the dock.',
        'Casts can no longer land under the dock, a jetty or the bridge, so the line no longer goes through them.',
      ],
    },
  },
  {
    version: 'v1.6.1', date: 'Oct 12, 2026', title: 'Gear that shows up, and this changelog',
    changes: {
      new: [
        'A Changelog on the main menu and the pause menu, with every change listed by release.',
      ],
      fix: [
        'The new detailed rods and lures now load in the published game. Before, they quietly fell back to the old blocky gear.',
        'If the models finish loading after you spawn, your rod and bobber swap to them straight away.',
        'The game page is smaller, so it loads a little faster.',
        'Play with friends, opened from the title screen, now shows on top instead of hiding behind it.',
      ],
    },
  },
  {
    version: 'v1.6', date: 'Oct 12, 2026', title: 'Map, cottage, wardrobe and Blender gear',
    changes: {
      new: [
        'A full-screen map in the middle of the screen, with pins for lakes, landmarks, waystones, shops and homes.',
        'Places appear on the map as you discover them, and the map clears as you explore.',
        'Drop a waypoint by right-clicking the map. A beam marks it in the world and an arrow on the HUD points the way.',
        'Walk into your cottage up the hill, wander around and sit in the armchair or on the window bench.',
        'Editor view in the cottage: pan and orbit the room, and drag furniture into place (R rotates).',
        'Sit on the logs by either campfire.',
        'A little belt lantern lights every angler after dark.',
      ],
      world: [
        'The lighthouse is rebuilt as one smooth striped tower, with a gallery, lantern room and dome.',
        'Lanterns line every trail between places, and they glow at night.',
        'New campfire flames, glowing coals and drifting smoke.',
        'Boulders hide the top of the waterfall, and the falls are a solid sheet of water.',
        'The rainbow after rain stays over the lake instead of following you.',
        'Waves on the water grow with the wind. Boats pitch on the swell and bobbers ride it.',
      ],
      look: [
        '15 new hats, including a Big Sun Hat, Piggy Sun Hat, Fishing Hat, Cowboy, Fedora, Boater, Beret, Flower Crown, Top Hat and Frog Hat.',
        'Hats can be recoloured.',
        'Eyewear: Big Sunglasses, Aviators, Round, Cat-eye, Heart Shades and Swim Goggles.',
        'New tops: Sundress, Aloha Shirt, Striped Top, Denim Jacket, Cardigan, Puffer, Tank, Polo and Turtleneck. Plus 8 new pastel colours.',
        'New bottoms: Long Skirt, Wide-leg Pants and Chest Waders.',
        'New accessories: Satchel, Flower Lei, Bow Tie, Shell Necklace, Bum Bag, Landing Net and Camera.',
        '33 hairstyles, rebuilt in more detail. The afro and curly fronts now render.',
        '7 new eyes, 4 new brows and 7 new mouths.',
      ],
      gear: [
        'All 9 rods are new, detailed models with real reels (spool, bail and crank), guides and line wraps.',
        'Each rod has its own touch: blossoms on Cherry, glowing bands on Neon, crystal shards on Obsidian, and more.',
        'All 8 lures are new models: a two-tone classic, rubber duck, frog, firefly, golden spinner, spark, crystal jig and a tiny lantern.',
      ],
      fix: [
        'Name tags and chat bubbles no longer shake as you walk past.',
        'A fish held up for a photo is shown side-on, so you see the whole fish.',
      ],
    },
  },
  {
    version: 'v1.5', date: 'Oct 12, 2026', title: 'The big menu and HUD makeover',
    changes: {
      ui: [
        'A title screen over the live lake, a pause menu, and a Play with friends panel.',
        'Full-screen Settings with tabs, live preview and Revert.',
        'A cleaner HUD: a level ring, one wallet, a grouped hotbar and floating E prompts.',
        'A shop card grid with compare, sort and filter, and a clearer catch card.',
        'Works in narrow windows like the Claude side panel, and with a keyboard or controller everywhere.',
      ],
    },
  },
  {
    version: 'v1.4', date: 'Oct 12, 2026', title: 'World polish',
    changes: {
      world: [
        'A new waterfall with a stream, layered curtains, mist and splashes.',
        'The footbridge sits flush on the banks.',
        'Shooting stars on clear nights.',
        'Point the camera straight up at the sky.',
      ],
      new: [
        'Camp chairs at every fishing spot. Press E to sit and fish from them.',
        'Anglers hold the rod in both hands and row with arms spread on the oars.',
      ],
    },
  },
  {
    version: 'v1.3', date: 'Oct 12, 2026', title: 'Catch feel and a living lake',
    changes: {
      new: [
        'Catches hit harder: a pause, a shake, pop-up words, a flip as the fish lands, and catch streaks.',
        'Wildlife, jumping fish, swaying plants, rainbows after rain, and seasons that turn each week.',
        'The Lake Gazette, catch cards, mail, tandem catches and pets.',
      ],
    },
  },
  {
    version: 'v1.2', date: 'Oct 11, 2026', title: 'The feature pass',
    changes: {
      new: [
        'Crab pots, set lines, bait, rod and boat upgrades.',
        'Daily requests, the Sunken Ruins story, one-of-a-kind fish you can name.',
        'Waystones for fast travel, the Lantern Festival, hourly derbies and messages in bottles.',
        'Controller support, key rebinding, colour-blind markers and sound captions.',
      ],
    },
  },
  {
    version: 'v1.1', date: 'Oct 11, 2026', title: 'Three Lakes Valley',
    changes: {
      world: [
        'A whole valley: Frostpine Lake, Old Quarry, Willow River, Lilymarsh, Fern Pond and Pinewood Lodge.',
        'The soft-block look: rounded blocks and 16-bit textures everywhere.',
      ],
      new: [
        'Tug & Turn fishing: angle the rod against the fish and keep the line in the sweet spot.',
      ],
    },
  },
  {
    version: 'v1.0', date: 'Oct 10, 2026', title: 'Opening day at Cozy Cove',
    changes: {
      new: [
        'Cast, reel and collect fish at Cozy Cove, with friends on the same lake.',
        'Gus’s tackle shop, the Fishpedia, the notice board and Lake Legends.',
      ],
    },
  },
];

export const GAME_VERSION = CHANGELOG[0].version;
