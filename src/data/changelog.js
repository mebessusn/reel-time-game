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
    version: 'v1.17.19', date: 'Nov 1 2026', title: 'The Five Lakes',
    changes: { new: ['The public edition of Reel Time: the Five Lakes, your cabin, the woods and everyone on your lake.'] },
  },
];

export const GAME_VERSION = CHANGELOG[0].version;
