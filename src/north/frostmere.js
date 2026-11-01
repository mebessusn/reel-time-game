// The public edition is the Five Lakes: this stands in for what isn't part of it, so the game's shared code runs unchanged.
const none = () => undefined;
export class NorthMap {
  constructor() {
    Object.assign(this, {
      here: false, builtExtras: false, d: { quests: {} },
      ice: { has: () => false, waiting: () => false, jig: none, tryDrop: () => false, onIce: () => false },
      snowballs: { tryThrow: () => false, clickThrows: () => false }, sky: { auroraOn: false }, skate: { on: false, pose: () => 0 }, sleds: { riding: null }, warmth: { shiver: 0 }, village: { fires: [] },
    });
  }
  init() {} update() {} stateExtra(s = {}) { return s; } meta(m = {}) { return m; } ctxExtra(c) { return c; } contextActions() { return []; } control() { return false; }
  canCast() { return true; } camera() { return false; } primary() { return false; } nearFire() { return 0; } musicRegion() { return null; } rideSeat() { return null; }
}
