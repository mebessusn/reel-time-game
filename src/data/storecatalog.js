// The Store's catalogue (v1.17.22): PLACEHOLDER items to lay out the shop before the real cosmetics are made.
// Nothing here can be bought yet. Each entry borrows art that already exists (an item, pet, cabin piece or emote
// pose) under a store name. The money model (Nov 2 2026): pay once, plus optional cosmetics, never pay-to-win, so
// every rod and boat here is a look only: it fishes exactly like the one you have equipped.
// When the real catalogue is decided, ids become the store product ids (src/standalone/store.js COSMETIC_PRODUCTS on
// the mobile branch) and must match Apple, Google and Steam.

export const STORE_TABS = [
  ['featured', 'Featured', 'sparkles'], ['emote', 'Emotes', 'smile'], ['wear', 'Clothing', 'shirt'], ['rod', 'Rods', 'rod'],
  ['boat', 'Boats', 'boat'], ['more', 'Pets & more', 'paw'], ['bundle', 'Bundles', 'package'],
];

// ('cheer' renders an empty picture in a thumbnail: its bounce reads a part the thumbnail avatar doesn't have)
// art: { item } an ITEMS id, { pet } a pet id, { decor } a cabin piece, { pose } an emote pose
const e = (id, kind, name, price, rarity, art, desc, extra = {}) => ({ id: `rt.cos.${id}`, kind, name, price, rarity, art, desc, ...extra });

export const STORE_ITEMS = [
  // emotes
  e('emote.victory', 'emote', 'Victory Splash', 1.99, 'epic', { pose: 'orange' }, 'Both arms up for the catch of the day.', { featured: true }),
  e('emote.bigwave', 'emote', 'Big Hello', 0.99, 'common', { pose: 'wave' }, 'A wave they can see from the far shore.'),
  e('emote.brag', 'emote', 'Catch Brag', 1.99, 'rare', { pose: 'showoff' }, 'Hold it up. Let them look.'),
  e('emote.nap', 'emote', 'Lakeside Nap', 0.99, 'uncommon', { pose: 'sleep' }, 'Forty winks while the bobber floats.'),
  e('emote.party', 'emote', 'Dock Party', 2.99, 'legendary', { pose: 'dance' }, 'Moves that scare the fish (they come back).', { featured: true }),
  e('emote.slowclap', 'emote', 'Slow Clap', 0.99, 'common', { pose: 'clap' }, 'For the one that got away.'),
  e('emote.shrug', 'emote', 'Shrug It Off', 0.99, 'common', { pose: 'shrug' }, 'Snagged again? Happens.'),
  // clothing
  e('hat.admiral', 'wear', "Admiral's Cap", 2.99, 'rare', { item: 'hat_captain' }, 'Gold braid for the captain of the cove.'),
  e('hat.crown', 'wear', 'Royal Angler Crown', 4.99, 'legendary', { item: 'hat_crown' }, 'Rule the lake. Or just look like it.', { featured: true }),
  e('hat.sunset', 'wear', 'Sunset Straw Hat', 1.99, 'uncommon', { item: 'hat_straw' }, 'Shade for long afternoons on the dock.'),
  e('hat.gentle', 'wear', 'Gentle Angler Top Hat', 2.99, 'rare', { item: 'hat_tophat' }, 'Formal fishing attire.'),
  e('hat.frog', 'wear', 'Froggy Hood', 1.99, 'uncommon', { item: 'hat_frog' }, 'Ribbit.'),
  e('shirt.slicker', 'wear', 'Storm Slicker', 2.99, 'rare', { item: 'shirt_raincoat_yellow' }, 'Bright yellow, bone dry.'),
  e('acc.pack', 'wear', 'Trail Pack', 1.99, 'uncommon', { item: 'acc_backpack' }, 'Room for snacks and a spare reel.'),
  e('acc.cat', 'wear', 'Shoulder Cat', 2.99, 'epic', { item: 'acc_cat' }, 'Supervises every cast.'),
  e('acc.scarf', 'wear', 'Cozy Scarf', 0.99, 'common', { item: 'acc_scarf' }, 'For frosty mornings.'),
  // rod looks
  e('rod.aurora', 'rod', 'Aurora Rod', 3.99, 'epic', { item: 'rod_neon' }, 'Glows like the northern lights.', { featured: true }),
  e('rod.molten', 'rod', 'Molten Rod', 3.99, 'epic', { item: 'rod_obsidian' }, 'Volcanic glass, cool to the touch.'),
  e('rod.prism', 'rod', 'Prism Rod', 4.99, 'legendary', { item: 'rod_diamond' }, 'Catches the light on every cast.'),
  e('rod.storm', 'rod', 'Stormcaller', 4.99, 'legendary', { item: 'rod_lightning' }, 'Crackles when a big one bites.'),
  e('rod.blossom', 'rod', 'Cherry Blossom Rod', 2.99, 'rare', { item: 'rod_cherry' }, 'Spring on the water, all year round.'),
  // boat looks
  e('boat.jolly', 'boat', 'Jolly Roger', 5.99, 'legendary', { item: 'boat_pirate' }, 'Fly the flag. Plunder the perch.', { featured: true }),
  e('boat.swan', 'boat', 'Swan Song', 4.99, 'epic', { item: 'boat_swan' }, 'Graceful, white and very proud.'),
  e('boat.lily', 'boat', 'Lily Pad Lounger', 3.99, 'rare', { item: 'boat_lily' }, 'Drift like a frog on a summer pond.'),
  e('boat.crystal', 'boat', 'Crystal Skiff', 6.99, 'legendary', { item: 'boat_crystal' }, 'See the fish right through the hull.'),
  e('boat.ducky', 'boat', 'Rubber Ducky', 3.99, 'rare', { item: 'boat_duck' }, 'Squeaks. Floats. Perfect.'),
  // pets, lure looks, cabin
  e('pet.otter', 'more', 'Otter Pal', 4.99, 'epic', { pet: 'otter' }, 'Follows you along the shore and naps by your rod.'),
  e('pet.cat', 'more', 'Lake Cat', 3.99, 'rare', { pet: 'cat' }, 'Will absolutely steal your catch.'),
  e('lure.firefly', 'more', 'Firefly Glow Lure', 0.99, 'uncommon', { item: 'lure_firefly' }, 'A lure look that twinkles at dusk.'),
  e('lure.crystal', 'more', 'Crystal Lure', 1.99, 'rare', { item: 'lure_crystal' }, 'A lure look that sparkles underwater.'),
  e('cabin.stove', 'more', 'Wood Stove Deluxe', 2.99, 'rare', { decor: 'stove' }, 'Warms the cabin and the soul.'),
  e('cabin.chair', 'more', 'Reading Armchair', 1.99, 'uncommon', { decor: 'armchair' }, 'For fish books and long naps.'),
  // bundles (art: the first piece; `has` lists what's inside)
  e('bundle.captain', 'bundle', "Captain's Bundle", 7.99, 'legendary', { item: 'boat_pirate' }, "Admiral's Cap, the Jolly Roger and Victory Splash.", { has: ['rt.cos.hat.admiral', 'rt.cos.boat.jolly', 'rt.cos.emote.victory'], featured: true, hero: true }),
  e('bundle.cabin', 'bundle', 'Cozy Cabin Bundle', 5.99, 'epic', { decor: 'stove' }, 'Wood Stove Deluxe, Reading Armchair and a Lake Cat.', { has: ['rt.cos.cabin.stove', 'rt.cos.cabin.chair', 'rt.cos.pet.cat'] }),
  e('bundle.starter', 'bundle', 'Starter Pack', 3.99, 'rare', { item: 'hat_straw' }, 'Sunset Straw Hat, Cherry Blossom Rod and Big Hello.', { has: ['rt.cos.hat.sunset', 'rt.cos.rod.blossom', 'rt.cos.emote.bigwave'] }),
];

export const STORE_BY_ID = Object.fromEntries(STORE_ITEMS.map((i) => [i.id, i]));
/** What a bundle's pieces would cost one by one. */
export const bundleWorth = (b) => (b.has || []).reduce((n, id) => n + (STORE_BY_ID[id]?.price || 0), 0);
export const money = (n) => `$${n.toFixed(2)}`;
