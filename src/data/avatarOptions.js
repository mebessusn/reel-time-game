// Avatar creator options (design doc section 7). Every option is available to every gender.

export const GENDERS = [
  { id: 'male', name: 'Male' },
  { id: 'female', name: 'Female' },
  { id: 'nonbinary', name: 'Nonbinary' },
];
export const FRAMES = [
  { id: 'broad', name: 'Broad', arm: 4, shoulder: 9 },
  { id: 'standard', name: 'Standard', arm: 4, shoulder: 8 },
  { id: 'slim', name: 'Slim', arm: 3, shoulder: 8 },
];
export const HEIGHTS = [
  { id: 'short', name: 'Short', leg: 10 },
  { id: 'medium', name: 'Medium', leg: 12 },
  { id: 'tall', name: 'Tall', leg: 14 },
];
export const SKINS = [
  '#fde0c8', '#f7d0b0', '#f0c09a', '#e4ac84', '#d8a070', '#c88a5c',
  '#b4784a', '#9c643c', '#845030', '#6c4026', '#58321e', '#442616',
  '#b8e0a8', '#c8b8e8', '#a8acb0',
];
export const HAIR_STYLES = [
  { id: 'buzz', name: 'Buzz' }, { id: 'crop', name: 'Short Crop' }, { id: 'sidepart', name: 'Side Part' },
  { id: 'messy', name: 'Messy' }, { id: 'curly', name: 'Curly Top' }, { id: 'afro', name: 'Afro' },
  { id: 'bob', name: 'Bob' }, { id: 'shoulder', name: 'Shoulder Length' }, { id: 'long', name: 'Long Straight' },
  { id: 'ponytail', name: 'Ponytail' }, { id: 'buns', name: 'Twin Buns' }, { id: 'braids', name: 'Braids' },
  { id: 'mohawk', name: 'Mohawk' }, { id: 'bald', name: 'Bald' }, { id: 'beaniehair', name: 'Tousled' },
  { id: 'pixie', name: 'Pixie' }, { id: 'pompadour', name: 'Pompadour' }, { id: 'undercut', name: 'Undercut' },
  { id: 'spiky', name: 'Spiky' }, { id: 'manbun', name: 'Top Knot' }, { id: 'highpony', name: 'High Ponytail' },
  { id: 'pigtails', name: 'Pigtails' }, { id: 'wavy', name: 'Long Waves' }, { id: 'hime', name: 'Hime Cut' },
  { id: 'locs', name: 'Locs' }, { id: 'cornrows', name: 'Cornrows' }, { id: 'bowl', name: 'Bowl Cut' },
  { id: 'shag', name: 'Shag' }, { id: 'sidebraid', name: 'Side Braid' }, { id: 'puffs', name: 'Afro Puffs' },
  { id: 'fauxhawk', name: 'Faux Hawk' }, { id: 'mullet', name: 'Mullet' }, { id: 'curtains', name: 'Curtain Bangs' },
];
export const HAIR_COLORS = [
  '#1e1612', '#3a2618', '#5a3a22', '#7a4e2a', '#a06a3a', '#c89058', '#e0c080', '#f0e0b0', '#8a2a1a', '#b0b0b0',
  '#f080b0', '#40c0c0', '#8a50d0', '#4070e0', '#e0e8f0', '#50b050',
];
export const EYES = [
  { id: 'round', name: 'Round' }, { id: 'sleepy', name: 'Sleepy' }, { id: 'happy', name: 'Happy Arcs' },
  { id: 'wide', name: 'Wide' }, { id: 'wink', name: 'Wink' }, { id: 'dots', name: 'Dots' },
  { id: 'lashes', name: 'Lashes' }, { id: 'sparkle', name: 'Sparkly' }, { id: 'content', name: 'Content' },
  { id: 'glance', name: 'Side Glance' }, { id: 'focused', name: 'Focused' }, { id: 'hearts', name: 'Heart Eyes' },
  { id: 'starry', name: 'Star Eyes' },
];
export const EYE_COLORS = ['#3a2a1a', '#5a3a1a', '#3a6a9a', '#3a8a5a', '#7a8a8a', '#8a5aa0', '#c08a2a', '#1a1a1a'];
export const BROWS = [{ id: 'soft', name: 'Soft' }, { id: 'bold', name: 'Bold' }, { id: 'arched', name: 'Arched' }, { id: 'straight', name: 'Straight' },
  { id: 'thick', name: 'Thick' }, { id: 'worried', name: 'Worried' }, { id: 'raised', name: 'Raised' }, { id: 'thin', name: 'Thin' }];
export const MOUTHS = [
  { id: 'smile', name: 'Smile' }, { id: 'grin', name: 'Grin' }, { id: 'neutral', name: 'Neutral' },
  { id: 'o', name: 'Open "o"' }, { id: 'smirk', name: 'Smirk' }, { id: 'toothy', name: 'Toothy' },
  { id: 'cat', name: 'Cat Smile' }, { id: 'tongue', name: 'Tongue Out' }, { id: 'lips', name: 'Lipstick' },
  { id: 'fang', name: 'Little Fang' }, { id: 'wobbly', name: 'Wobbly' }, { id: 'tiny', name: 'Tiny Smile' },
  { id: 'laugh', name: 'Big Laugh' },
];
export const FACIAL_HAIR = [
  { id: 'none', name: 'None' }, { id: 'stubble', name: 'Stubble' }, { id: 'moustache', name: 'Moustache' },
  { id: 'beard', name: 'Full Beard' }, { id: 'goatee', name: 'Goatee' },
];
export const EXTRAS = [
  { id: 'freckles', name: 'Freckles' }, { id: 'blush', name: 'Blush' }, { id: 'mark', name: 'Beauty Mark' },
  { id: 'glassesRound', name: 'Round Glasses' }, { id: 'glassesSquare', name: 'Square Glasses' }, { id: 'eyepatch', name: 'Eyepatch' },
];
export const HATS = [
  { id: 'none', name: 'None' }, { id: 'sunhat', name: 'Big Sun Hat' }, { id: 'pighat', name: 'Piggy Sun Hat' },
  { id: 'boonie', name: 'Fishing Hat' }, { id: 'bucket', name: 'Bucket Hat' }, { id: 'beanie', name: 'Beanie' },
  { id: 'cap', name: 'Cap' }, { id: 'visor', name: 'Fishing Visor' }, { id: 'cowboy', name: 'Cowboy Hat' },
  { id: 'fedora', name: 'Fedora' }, { id: 'boater', name: 'Boater' }, { id: 'sailor', name: 'Sailor Cap' },
  { id: 'beret', name: 'Beret' }, { id: 'newsboy', name: 'Newsboy Cap' }, { id: 'trapper', name: 'Trapper Hat' },
  { id: 'bandana', name: 'Bandana' }, { id: 'headband', name: 'Bow Headband' }, { id: 'flowercrown', name: 'Flower Crown' },
  { id: 'hat_straw', name: 'Straw Hat', item: 'hat_straw' }, { id: 'hat_bucket_tan', name: 'Tan Bucket Hat', item: 'hat_bucket_tan' },
  { id: 'hat_captain', name: 'Captain Hat', item: 'hat_captain' }, { id: 'hat_crown', name: 'Tiny Crown', item: 'hat_crown' },
  { id: 'hat_tophat', name: 'Top Hat', item: 'hat_tophat' }, { id: 'hat_frog', name: 'Frog Hat', item: 'hat_frog' },
  // v1.15 Open Waters: prizes for your first win at each beach game
  { id: 'hat_visor_beach', name: 'Beach Visor', item: 'hat_visor_beach' }, { id: 'hat_crab', name: 'Crab Hat', item: 'hat_crab' },
  { id: 'hat_coconut', name: 'Coconut Hat', item: 'hat_coconut' }, { id: 'hat_pail', name: 'Sand Pail Hat', item: 'hat_pail' },
  { id: 'hat_swimcap', name: 'Swim Cap', item: 'hat_swimcap' },
  // Frostmere (map 3)
  { id: 'hat_earflap', name: 'Earflap Hat', item: 'hat_earflap' }, { id: 'hat_bobble', name: 'Bobble Hat', item: 'hat_bobble' },
  { id: 'hat_aviator', name: 'Aviator Cap', item: 'hat_aviator' },
];
// 'default' keeps each hat's own colour
export const HAT_COLORS = ['default', '#c0392b', '#e8607a', '#f4a6b8', '#f0d9a0', '#e8a030', '#5f8050', '#3a7a6a', '#2e5a9a', '#7a5ab0', '#8a5a34', '#24222a', '#f4f4f0'];
export const EYEWEAR = [
  { id: 'none', name: 'None' }, { id: 'bigsunnies', name: 'Big Sunglasses' }, { id: 'aviators', name: 'Aviators' },
  { id: 'roundshades', name: 'Round Shades' }, { id: 'cateye', name: 'Cat-eye Shades' }, { id: 'heart', name: 'Heart Shades' },
  { id: 'goggles', name: 'Swim Goggles' },
  { id: 'eye_snowgoggles', name: 'Snow Goggles', item: 'eye_snowgoggles' },
];
export const SHIRTS = [
  { id: 'flannel', name: 'Flannel' }, { id: 'tee', name: 'Tee' }, { id: 'hoodie', name: 'Hoodie' },
  { id: 'sweater', name: 'Sweater' }, { id: 'raincoat', name: 'Rain Jacket' }, { id: 'overalls', name: 'Overalls Top' },
  { id: 'sundress', name: 'Sundress' }, { id: 'hawaiian', name: 'Aloha Shirt' }, { id: 'stripes', name: 'Striped Top' },
  { id: 'denim', name: 'Denim Jacket' }, { id: 'cardigan', name: 'Cardigan' }, { id: 'puffer', name: 'Puffer Jacket' },
  { id: 'tank', name: 'Tank Top' }, { id: 'polo', name: 'Polo' }, { id: 'turtleneck', name: 'Turtleneck' },
  { id: 'shirt_raincoat_yellow', name: 'Yellow Rain Jacket', item: 'shirt_raincoat_yellow' },
  { id: 'shirt_parka', name: 'Expedition Parka', item: 'shirt_parka' }, { id: 'shirt_sweater_snow', name: 'Snowflake Sweater', item: 'shirt_sweater_snow' },
  { id: 'shirt_sweater_deer', name: 'Reindeer Sweater', item: 'shirt_sweater_deer' }, { id: 'shirt_musher', name: 'Musher\'s Bib', item: 'shirt_musher' },
];
export const CLOTH_COLORS = ['#c0392b', '#3a7a3a', '#2e5a9a', '#e0d8c8', '#2a2a2a', '#e8a030', '#8a4aa0', '#4aa0a0',
  '#f2a0b8', '#f4d870', '#9ac8ec', '#b8a0e0', '#a8dcb8', '#f6f2ea', '#e87050', '#3a3a6a'];
export const PANTS = [
  { id: 'jeans', name: 'Jeans' }, { id: 'cargo', name: 'Cargo' }, { id: 'shorts', name: 'Shorts' },
  { id: 'overalls', name: 'Overalls' }, { id: 'skirt', name: 'Skirt' }, { id: 'joggers', name: 'Joggers' },
  { id: 'longskirt', name: 'Long Skirt' }, { id: 'wideleg', name: 'Wide-leg Pants' }, { id: 'waders', name: 'Chest Waders' },
];
export const PANT_COLORS = ['#3a5a8a', '#5a4a32', '#2a2a2a', '#8a8a7a', '#6a3a2a', '#3a6a4a', '#c8b48a', '#f2eee4', '#e8a0b4', '#7a5ab0'];
export const SHOES = [
  { id: 'boots', name: 'Rubber Boots' }, { id: 'sneakers', name: 'Sneakers' }, { id: 'hiking', name: 'Hiking Boots' },
  { id: 'sandals', name: 'Sandals' }, { id: 'slipons', name: 'Slip-ons' },
  { id: 'shoes_furboots', name: 'Fur-trimmed Boots', item: 'shoes_furboots' },
];
export const ACCESSORIES = [
  { id: 'none', name: 'None' },
  { id: 'satchel', name: 'Satchel' }, { id: 'lei', name: 'Flower Lei' }, { id: 'bowtie', name: 'Bow Tie' },
  { id: 'shells', name: 'Shell Necklace' }, { id: 'fannypack', name: 'Bum Bag' }, { id: 'net', name: 'Landing Net' },
  { id: 'acc_vest', name: 'Fishing Vest', item: 'acc_vest' }, { id: 'acc_scarf', name: 'Cozy Scarf', item: 'acc_scarf' },
  { id: 'acc_backpack', name: 'Backpack', item: 'acc_backpack' }, { id: 'acc_camera', name: 'Camera', item: 'acc_camera' },
  { id: 'acc_cat', name: 'Pet Cat', item: 'acc_cat' },
  { id: 'acc_mittens', name: 'Mittens', item: 'acc_mittens' }, { id: 'acc_aurora_scarf', name: 'Aurora Scarf', item: 'acc_aurora_scarf' },
];

export const DEFAULT_AVATARS = {
  male: { hair: 'crop', facialHair: 'stubble', shirt: 'flannel', shirtColor: 0, pants: 'jeans' },
  female: { hair: 'shoulder', facialHair: 'none', shirt: 'sweater', shirtColor: 3, pants: 'overalls' },
  nonbinary: { hair: 'messy', facialHair: 'none', shirt: 'hoodie', shirtColor: 7, pants: 'cargo' },
};

export function defaultAvatar(gender = 'nonbinary') {
  const d = DEFAULT_AVATARS[gender] || DEFAULT_AVATARS.nonbinary;
  return {
    gender, frame: gender === 'female' ? 'slim' : 'standard', skin: 3, height: 'medium',
    hair: d.hair, hairColor: 2, eyes: 'round', eyeColor: 0, brows: 'soft', mouth: 'smile',
    facialHair: d.facialHair, extras: [], hat: 'none', shirt: d.shirt, shirtColor: d.shirtColor,
    pants: d.pants, pantsColor: 0, shoes: 'boots', accessory: 'none', hatColor: 0, eyewear: 'none',
  };
}

const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
export function randomAvatar(r = Math.random, owned = new Set()) {
  const free = (list) => list.filter((o) => !o.item || owned.has(o.item));
  const g = pick(GENDERS, r).id;
  return {
    gender: g, frame: pick(FRAMES, r).id, skin: Math.floor(r() * 12), height: pick(HEIGHTS, r).id,
    hair: pick(HAIR_STYLES, r).id, hairColor: Math.floor(r() * HAIR_COLORS.length),
    eyes: pick(EYES, r).id, eyeColor: Math.floor(r() * EYE_COLORS.length), brows: pick(BROWS, r).id,
    mouth: pick(MOUTHS, r).id, facialHair: r() < 0.6 ? 'none' : pick(FACIAL_HAIR, r).id,
    extras: EXTRAS.filter(() => r() < 0.12).map((e) => e.id).slice(0, 2),
    hat: r() < 0.5 ? 'none' : pick(free(HATS), r).id, hatColor: r() < 0.6 ? 0 : Math.floor(r() * HAT_COLORS.length),
    eyewear: r() < 0.75 ? 'none' : pick(EYEWEAR, r).id, shirt: pick(free(SHIRTS), r).id,
    shirtColor: Math.floor(r() * CLOTH_COLORS.length), pants: pick(PANTS, r).id,
    pantsColor: Math.floor(r() * PANT_COLORS.length), shoes: pick(SHOES, r).id,
    accessory: r() < 0.7 ? 'none' : pick(free(ACCESSORIES), r).id,
  };
}
