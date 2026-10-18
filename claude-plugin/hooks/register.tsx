// Reel Time companion for Claude Code.
// - /fish opens the game (and a small pane with its status).
// - When you submit a prompt, the game hears "Claude is working" (a timer chip appears in the HUD).
// - When the turn ends, the game hears "done": a bell rings at the dock and a golden "answer fish" bites.
//   Here, a toast and a bell ring too (for turns that took a while).
// The signal is a tiny doc in your private corner of the Reel Time artifact's database
// (data/users/me/claude), written through the ArtifactData tool. Nothing about the prompt itself is ever sent.
import { atom, read, update } from 'claude-code'
import type { Engine, Register } from 'claude-code'

import type { FishState } from '../types'

const PANE = 'reel-time'
const INITIAL: FishState = {
  isOptedIn: false, isWorking: false, startedAt: 0, lastTurnSeconds: 0, turnsWaited: 0,
  lastSignal: '', lastSignalResult: '', docVersion: 0, lastWaitFish: 0, totalWaitFish: 0,
}
const fish = atom({ plugin: 'reel-time', key: 'fish' } as const, INITIAL)

/** v0.7.0: a lake link the /reel-time:lake command accepts (any Reel Time artifact on claude.ai), cleaned of its query. */
export function lakeLink(text: string): string {
  const m = /https:\/\/claude\.ai\/(?:code\/)?artifact\/[A-Za-z0-9_-]+/.exec(String(text || ''))
  return m ? m[0] : ''
}

// The lake the user picked with /reel-time:lake (remembered in $.store across sessions); '' = the configured default.
let lakeOverride = ''

async function loadLake($: Engine): Promise<void> {
  const saved = await $.store.get('lake').catch(() => '')
  lakeOverride = lakeLink(String(saved ?? ''))
}

async function setLake($: Engine, args: string, fallback: string): Promise<{ text: string }> {
  const a = String(args || '').trim()
  const current = lakeOverride || fallback
  if (!a) return { text: `Reel Time is using ${current || 'no lake yet'}.\nTo use your own lake, run /reel-time:lake and paste its link (https://claude.ai/artifact/...). /reel-time:lake reset goes back to the default.` }
  if (/^(reset|default)$/i.test(a)) {
    await $.store.set('lake', '')
    lakeOverride = ''
    return { text: `Back to the default lake: ${fallback || 'none'}.` }
  }
  const link = lakeLink(a)
  if (!link) return { text: "That doesn't look like a lake link. Paste your Reel Time artifact's link, like https://claude.ai/artifact/AbCd123." }
  await $.store.set('lake', link)
  lakeOverride = link
  return { text: `Done. Reel Time now signals your lake at ${link}. Run /fish to open it.` }
}

export function gameLink(base: string): string {
  const url = base.trim()
  if (!url) return ''
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}src=claude`
}

/** The version number an ArtifactData result or refusal names, if any. */
export function versionIn(text: string): number {
  const m = /version["'\s:=]*?(\d+)/i.exec(text) || /current(?:ly)? (?:at )?(?:version )?v?(\d+)/i.exec(text)
  return m ? Number(m[1]) : 0
}

type Signal = { state: 'working' | 'done'; at: number; startedAt?: number; seconds?: number; aborted?: boolean; steps?: number }

// v0.4.0: how many tool steps Claude took this turn (helper agents' steps count too). A big multistep turn
// earns a coin and XP bonus in the game. This plugin's own calls to the game are not counted.
let turnSteps = 0
// v0.6.0: a long turn re-sends "working" (with its real start time) at most every HEARTBEAT_MS, on Claude's own tool
// calls, so a game opened mid-prompt still sees a fresh signal and picks up the timer where it really is.
export const HEARTBEAT_MS = 2 * 60 * 1000
let turnStartedAt = 0
let lastBeatAt = 0
let turnOpen = false
// Every status write goes through one queue, so a late "working" can never land after that turn's "done".
let writes: Promise<unknown> = Promise.resolve()
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = writes.then(fn, fn)
  writes = run.catch(() => undefined)
  return run
}
const OWN_TOOLS = new Set(['Artifact', 'ArtifactData'])

type Cfg = { artifactUrl: string }


function resultText(r: any): string {
  if (!r) return ''
  if (r.deny) return String(r.deny)
  if (typeof r.text === 'string') return r.text
  try { return JSON.stringify(r.result ?? '') } catch { return '' }
}

// Write the status doc into your private corner of the artifact's database. Pins the last version
// seen; when the write is refused naming the current version, retries once with it. Never throws:
// a failed signal must not disturb your session.
async function writeDoc($: Engine, cfg: Cfg, sig: Signal): Promise<string> {
  const s = await read($, fish)
  const write = (v: number) => $.tool.call({
    tool: 'ArtifactData', action: 'set', url: cfg.artifactUrl, collection: 'data/users/me', doc_id: 'claude',
    data: sig, ...(v ? { if_version: v } : {}),
  })
  let r: any = await write(s.docVersion)
  let text = resultText(r)
  if (r?.deny || r?.isError) {
    // v0.6.3: a write to the existing doc is refused without its current version (db_write_version_required), and
    // that refusal no longer names the version. A new chat starts with no pin, so read the doc for it, then retry once.
    let v = versionIn(text)
    if (!v || v === s.docVersion) v = await currentVersion($, cfg)
    if (v && v !== s.docVersion) { r = await write(v); text = resultText(r) }
  }
  if (r?.deny || r?.isError) return `refused: ${text.slice(0, 120)}`
  const v = versionIn(text)
  if (v) await update($, fish, (x) => ({ ...x, docVersion: v }))
  return 'sent'
}

async function currentVersion($: Engine, cfg: Cfg): Promise<number> {
  try {
    const r: any = await $.tool.call({ tool: 'ArtifactData', action: 'get', url: cfg.artifactUrl, collection: 'data/users/me', doc_id: 'claude' })
    return r?.deny || r?.isError ? 0 : versionIn(resultText(r))
  } catch { return 0 }
}

/** How many fish you caught in the game while Claude worked (the game writes claude_lake). */
/** True for this plugin's own status calls: ArtifactData on the game's artifact, in data/users/me, claude or claude_lake. */
export function isOwnStatusCall(input: unknown, artifactUrl: string): boolean {
  const i = (input ?? {}) as Record<string, unknown>
  return !!artifactUrl && i.url === artifactUrl && i.collection === 'data/users/me' && (i.doc_id === 'claude' || i.doc_id === 'claude_lake')
    && ['set', 'get'].includes(String(i.action))
}

export function lakeCounts(text: string): { waitFish: number; total: number } {
  const w = /"waitFish"\s*:\s*(\d+)/.exec(text), t = /"total"\s*:\s*(\d+)/.exec(text)
  return { waitFish: w ? Number(w[1]) : 0, total: t ? Number(t[1]) : 0 }
}

async function readLake($: Engine, cfg: Cfg, since: number): Promise<number> {
  if (!cfg.artifactUrl) return 0
  const r: any = await $.tool.call({ tool: 'ArtifactData', action: 'get', url: cfg.artifactUrl, collection: 'data/users/me', doc_id: 'claude_lake' })
  if (r?.deny || r?.isError) return 0
  const text = resultText(r)
  const at = /"at"\s*:\s*(\d+)/.exec(text)
  const c = lakeCounts(text)
  const fresh = at ? Number(at[1]) >= since : false
  await update($, fish, (x) => ({ ...x, lastWaitFish: fresh ? c.waitFish : 0, totalWaitFish: Math.max(x.totalWaitFish, c.total) }))
  return fresh ? c.waitFish : 0
}

async function finishTurn($: Engine, cfg: Cfg, sig: Signal, since: number, loud: boolean): Promise<void> {
  await sendSignal($, cfg, sig)
  const n = await readLake($, cfg, since).catch(() => 0)
  if (loud && n > 0) $.ui.toast(`You caught ${n} fish while you waited.`)
}

async function sendSignal($: Engine, cfg: Cfg, sig: Signal): Promise<void> {
  const notes: string[] = []
  if (cfg.artifactUrl) {
    try { notes.push(await writeDoc($, cfg, sig)) } catch (err) { notes.push(`error: ${String((err as Error)?.message ?? err).slice(0, 120)}`) }
  }
  await update($, fish, (x) => ({ ...x, lastSignal: sig.state, lastSignalResult: notes.join(', ') || 'off' }))
  // v0.5.0: say once per session if the game can't hear us (no beta access yet, or the artifact moved)
  if (notes.some((n) => n.startsWith('refused') || n.startsWith('error')) && !warnedThisSession) {
    warnedThisSession = true
    $.ui.toast("Reel Time can't reach your lake yet. Open the game once, and check its link with /reel-time:lake.")
  }
}
let warnedThisSession = false

// /fish is also a markdown command (commands/fish.md) so the app lists it before a session starts; the app may
// list that one as /reel-time:fish, so this hook answers both names and the markdown body is only a fallback.
async function openLake($: any, url: string) {
  await update($, fish, (s) => ({ ...s, isOptedIn: true }))
  if (!url) return { text: "Reel Time doesn't know your lake yet. Run /reel-time:lake and paste your lake's link (https://claude.ai/artifact/...). No lake? Make one in 5 minutes: https://github.com/mebessusn/reel-time-game" }
  const link = gameLink(url)

  // In the Claude app the game opens in the artifact tab beside the chat. A terminal has no such tab (or the
  // URL may be a self-hosted build), so the link below is always there as the fallback.
  let opened = false
  if (/^https:\/\/claude\.ai\/(code\/)?artifact\//.test(url)) {
    try {
      const r: any = await $.tool.call({ tool: 'Artifact', action: 'open', url } as any)
      opened = !r?.isError
    } catch { opened = false }
  }
  // v0.6.2: the status pane only opens where the game could not open beside the chat (a terminal, a self-hosted
  // URL). In the Claude app the pane took the same side slot as the game and covered it with a link to click.
  if (opened) return { text: "Gone fishin'. When Claude finishes, a golden fish bites and a bell rings." }
  await $.ui.open({ id: PANE, title: 'Reel Time' })
  return { text: `Gone fishin'. Open the lake: ${link}\nWhen Claude finishes, a golden fish bites in the game and a bell rings here.` }
}


export const register: Register = (on, options) => {
  // v0.7.0: /reel-time:lake <link> points the plugin at your own lake (your copy of the game); it overrides both
  // URL settings and is remembered across sessions.
  const defaultUrl = String(options.gameUrl ?? '')
  const defaultArtifactUrl = String(options.artifactUrl ?? '').trim()
  const lakeUrl = () => lakeOverride || defaultUrl
  const lakeArtifact = () => lakeOverride || defaultArtifactUrl
  const minSeconds = Number(options.notifyAfterSeconds ?? 15)
  const shouldRing = options.bell !== false
  const signalGame = options.signalGame !== false
  const alwaysOn = options.alwaysOn !== false
  const cfg: Cfg = { get artifactUrl() { return lakeArtifact() } }

  on('session.start', async ($, e, next) => {
    await loadLake($)
    await $.command.register({
      name: 'fish',
      description: 'Open Reel Time, the cozy fishing game, while Claude works',
    })
    await $.command.register({
      name: 'lake',
      description: 'Point Reel Time at your own lake: /reel-time:lake <your lake link>',
    })
    if (alwaysOn) await update($, fish, (s) => ({ ...s, isOptedIn: true }))

    return next(e)
  })

  on('command.run', { command: 'fish' }, async ($) => openLake($, lakeUrl()))
  on('command.run', { command: 'lake' }, async ($, e) => setLake($, e.args, defaultArtifactUrl))
  on('command.run', { command: 'reel-time:lake' }, async ($, e) => setLake($, e.args, defaultArtifactUrl)).catch(($, e, next) => next(e))
  on('command.run', { command: 'reel-time:fish' }, async ($) => openLake($, lakeUrl())).catch(($, e, next) => next(e))

  // Never let this plugin get in the way of a prompt: the signal is sent in the background,
  // and any failure passes the prompt through.
  on('prompt.submit', async ($, e, next) => {
    const now = await $.clock.now()
    turnSteps = 0
    turnStartedAt = lastBeatAt = now
    turnOpen = true
    await update($, fish, (s) => ({ ...s, isWorking: true, startedAt: now }))
    const s = await read($, fish)
    if (signalGame && s.isOptedIn) void queued(() => sendSignal($, cfg, { state: 'working', at: turnStartedAt, startedAt: turnStartedAt })).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  // v0.5.0: this plugin's own status writes never wait on a permission prompt. Only its own calls (never the
  // model's), only ArtifactData, only the two status docs in your private corner of the Reel Time artifact.
  on('tool.check', { tool: 'ArtifactData' }, ($, e, next) => {
    if (next.origin?.plugin === 'reel-time' && isOwnStatusCall(e.input, lakeArtifact())) return { decision: 'allow', reason: 'Reel Time status signal' }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    if (!OWN_TOOLS.has(String(e.tool))) {
      turnSteps++
      // heartbeat: still working (in the background, never holding up the tool call)
      const now = await $.clock.now()
      if (signalGame && turnOpen && now - lastBeatAt >= HEARTBEAT_MS) {
        lastBeatAt = now
        const s = await read($, fish)
        if (s.isOptedIn) void queued(() => turnOpen ? sendSignal($, cfg, { state: 'working', at: now, startedAt: turnStartedAt }) : Promise.resolve()).catch(() => undefined)
      }
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) return result // a helper agent's turn, not yours
    turnOpen = false
    const s = await read($, fish)
    const seconds = Math.round(e.durationMs / 1000)
    await update($, fish, (x) => ({
      ...x,
      isWorking: false,
      lastTurnSeconds: seconds,
      turnsWaited: x.isOptedIn ? x.turnsWaited + 1 : x.turnsWaited,
    }))
    if (!s.isOptedIn) return result
    // in the background: a write waiting on a permission prompt must never hold up the turn
    const loud = !e.isAborted && seconds >= minSeconds
    if (signalGame) void queued(() => finishTurn($, cfg, { state: 'done', at: Date.now(), seconds, aborted: !!e.isAborted, steps: turnSteps }, Date.now() - e.durationMs - 5000, loud)).catch(() => undefined)
    if (loud) {
      $.ui.toast("Claude's done. Reel it in!")
      if (shouldRing) await $.audio.play({ asset: 'sounds/bell.wav' }).catch(() => undefined)
    }

    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Link } = $.ui.resolve(e)
    const s = await read($, fish)
    const status = s.isWorking
      ? 'Claude is working. Cast a line!'
      : s.lastTurnSeconds
        ? `Last turn took ${s.lastTurnSeconds}s.`
        : 'Waiting for your next prompt.'

    return (
      <Box flexDirection="column">
        <Text bold>Reel Time</Text>
        {lakeUrl() ? <Link href={gameLink(lakeUrl())} label="Open the lake" /> : <Text dimColor>Run /reel-time:lake with your lake's link to get a link here.</Text>}
        <Text dimColor>{status}</Text>
        {s.lastSignal ? <Text dimColor>Game signal ({s.lastSignal}): {s.lastSignalResult}</Text> : null}
        {s.turnsWaited > 0 && <Text dimColor>Turns waited out on the lake: {s.turnsWaited}</Text>}
        {s.lastWaitFish > 0 && <Text>Fish caught during the last turn: {s.lastWaitFish}</Text>}
        {s.totalWaitFish > 0 && <Text dimColor>Fish caught while waiting, all time: {s.totalWaitFish}</Text>}
      </Box>
    )
  })
}
