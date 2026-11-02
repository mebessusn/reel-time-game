// The door every expansion (another map) comes in through. The shared game never names an
// expansion: it asks these hooks, and each expansion's controller answers the ones it cares about. The list of
// expansions an edition carries is src/expansions.js (empty in the Five Lakes edition), and their content (fish,
// achievements, gear, music, home pieces) registers itself with the shared data when that list is imported.
//
// Hooks a controller may implement (all optional):
//   init() / preUpdate(dt) / update(dt, t)          every frame, preUpdate before the player moves
//   control(dt, t, lock) -> bool                    it has the controls this frame (a ride, a swim, a game, a flight)
//   camera() -> bool                                it has the camera this frame
//   cameraFocus(focus)                              nudge the camera's focus point
//   pointerPress(e) -> down | null                  a press it takes before the fishing button (down.own = itself)
//   pointerPressLate(e, hit) -> down | null         a press it takes when the fishing button didn't
//   pointerRelease(down)                            the end of a press it took
//   keyDown(act, e) -> bool / keyUp(act)            keys (its own actions are added with addActions in controls.js)
//   press(down) -> bool                             the fishing button, before fishing gets it
//   poseFor() -> pose | null                        what you look like you're doing
//   rodBusy() -> bool                               your hands are full (the rod goes on your back)
//   actorLook() -> {}                               extra fields for your own figure (rg, rl, shiver...)
//   netState() / meta()                             extra fields for the state and profile others see
//   sendRate() -> seconds | null                    send state faster (a race)
//   nearFire() -> 0..1 / musicRegion() / ambience() -> { play(audio, scene, t, set, R, phase, rain) }
//   zoneText() -> string | null                     the zone label
//   contextActions() -> []                          the context buttons
//   onCatch(c, sp) / onLevelUp() / onAnswerFish()
//   ownsNet(net) -> bool                            a side room it opened (it reports going solo itself)
//   rideToggle() / rideSwap() -> bool, canRideSwap(), rideSeat(), rideInfo()
//   fishing: canCast(), castDrop() -> bool, castNoWater(aim) -> bool, noWaterText(), fishCtx(c) -> c, jig(),
//            waitingTick(dt, f) -> bool,
//            biteFor(c), speciesPool(c, all), lineRating(), biteMult(c), bobberSplash(x, z),
//            fightHook(reel, bite, sp), fightStep(r, dt), fightEscape(reel, snapped), fightLand(reel), fightCancel()
//   ui: winter() -> bool, skyKey(), closeModal() -> bool
//   panels: sheetOpened(name), mapSheet(c, sheets) -> bool, pediaTabs(c, p, sheets), pediaTab(tab, c, sheets) -> bool,
//           journalExtra(c, sheets), journalTabs() -> [[id, label, icon, alert]], journalTab(tab, c, sheets) -> bool
//   world: fires() -> [], company() -> n, remoteAt(r, s)
export class Expansions {
  constructor(game, list = []) { this.list = list.map((E) => new E(game)); }
  /** Calls the hook on every expansion. */
  each(name, ...a) { for (const x of this.list) x[name]?.(...a); }
  /** The first expansion's answer that isn't null, undefined or false. */
  first(name, ...a) { for (const x of this.list) { const r = x[name]?.(...a); if (r != null && r !== false) return r; } return null; }
  /** Every expansion's answers, flattened. */
  all(name, ...a) { return this.list.flatMap((x) => x[name]?.(...a) || []); }
  /** Every expansion's answer merged into one object. */
  merge(name, ...a) { return Object.assign({}, ...this.list.map((x) => x[name]?.(...a) || {})); }
  /** The largest number any expansion answers (0 when none do). */
  max(name, ...a) { return Math.max(0, ...this.list.map((x) => x[name]?.(...a) || 0)); }
  /** Hands a value through every expansion's hook in turn (each may return a new one). */
  pipe(name, v, ...a) { for (const x of this.list) if (x[name]) v = x[name](v, ...a) ?? v; return v; }
  /** False if any expansion answers false. */
  every(name, ...a) { return this.list.every((x) => x[name]?.(...a) !== false); }
}
