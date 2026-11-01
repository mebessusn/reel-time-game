// The public edition is the Five Lakes: this stands in for what isn't part of it, so the game's shared code runs unchanged.
const none = () => undefined;
export class OpenWaters {
  constructor() {
    Object.assign(this, {
      atSea: false, charter: null, progress: null, crewNet: null,
      dive: { on: false, under: false, gun: null, wearing: '', upKey: none, shoot: none, update: none },
      jetski: { on: false, control: () => false, toggle: none, seat: none },
      games: { busy: false, primary: () => false, control: () => false, pose: () => null, jump: none },
      fight: { onStep: none, onLand: none, onHook: none, onEscape: none, onCancel: none, crewKey: none, onCatch: none },
      evenings: { nearFire: () => 0, musicRegion: () => null, company: () => 0 },
      voyage: { takeBigAnswer: none, lessonBite: none, fishOn: none, mark: none },
      ui: { closeModal: none }, nightSea: { splash: none }, islands: { fires: [] }, quests: { render: none },
    });
  }
  init() {} update() {} preUpdate() {} stateExtra(s = {}) { return s; } meta(m = {}) { return m; } ctxExtra(c) { return c; } contextActions() { return []; }
  canCast() { return true; } audioScene() { return null; } zoneLabel() { return null; } lineRating() { return null; } remoteAt() { return null; } checkUnlock() {} biteMult() { return 1; }
}
