export type FishState = {
  /** /fish was run this session (or Always on is set): signal, ring and toast. */
  isOptedIn: boolean
  /** A prompt is running. */
  isWorking: boolean
  /** When the running turn started (ms, engine clock). */
  startedAt: number
  /** How long the last turn took, in seconds. */
  lastTurnSeconds: number
  /** Turns finished while fishing. */
  turnsWaited: number
  /** The last signal the game was sent: 'working' | 'done' | '' */
  lastSignal: string
  /** How that signal went: 'sent', 'no-tool', or the error text. */
  lastSignalResult: string
  /** The status doc's version, so the next write can pin it. */
  docVersion: number
  /** Fish caught in the game during the last turn (read back from the game). */
  lastWaitFish: number
  /** Fish caught while waiting, all time (as the game reports it). */
  totalWaitFish: number
}

declare module 'claude-code' {
  interface PluginState {
    'reel-time': { fish: FishState }
  }
}
