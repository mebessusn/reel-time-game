import { expect, mock, test } from 'claude-code/testing'

import { gameLink, isOwnStatusCall, lakeCounts, lakeLink, versionIn } from './register'

const TURN = { answer: 'done', isAborted: false, turnId: 't1', reason: 'answer' as const }
const ART = 'https://claude.ai/artifact/TEST'
// The plugin sends its signal in the background; let that settle before looking.
const settle = () => new Promise((r) => setTimeout(r, 30))

function engine(on: any, lake: { waitFish: number; total: number } | null = null, noAccess = false, panes: any[] = [], db: { start?: number; quiet?: boolean } = {}) {
  const calls: any[] = []
  const gets: any[] = []
  const toasts: string[] = []
  const rings = { n: 0 }
  let version = db.start ?? 0
  on('command.register', () => ({ value: undefined }))
  on('ui.open', (_$: any, e: any) => { panes.push(e); return { value: { isPlaced: true } } })
  on('ui.toast', (_$: any, e: any) => { toasts.push(e.text); return { value: undefined } })
  on('audio.play', () => { rings.n++; return { value: undefined } })
  on('turn.complete', (_$: any, e: any) => ({ text: e.answer }))
  on('prompt.submit', (_$: any, e: any) => ({ text: e.text }))
  // Stands in for the artifact database: refuses an unpinned or stale write to an existing doc.
  on('tool.call', { tool: 'ArtifactData' }, (_$: any, e: any) => {
    if (noAccess) return { result: {}, text: 'You do not have access to this artifact.', isError: true }
    if (e.action === 'get') {
      gets.push(e)
      if (e.doc_id === 'claude') {
        if (!version) return { result: {}, text: 'No document "claude" in collection "data/users/me".', isError: true }
        return { result: {}, text: JSON.stringify({ id: 'claude', data: { state: 'done' }, version }) }
      }
      if (!lake) return { result: {}, text: 'No document "claude_lake" in collection "data/users/me".', isError: true }
      return { result: {}, text: JSON.stringify({ id: 'claude_lake', data: { ...lake, at: Date.now() }, version: 3 }) }
    }
    calls.push(e)
    if (version && e.if_version !== version) {
      return db.quiet
        ? { result: {}, text: 'db_write_version_required: this document already exists; read it and pass its version as if_version.', isError: true }
        : { result: {}, text: `Document data/users/me/claude already exists at version ${version}; pass if_version.`, isError: true }
    }
    version++
    return { result: { version }, text: JSON.stringify({ ok: true, version }) }
  })
  return { calls, gets, toasts, rings }
}

test('gameLink tags the URL so the game knows it came from Claude', () => {
  expect(gameLink('https://x.dev/rt/')).toBe('https://x.dev/rt/?src=claude')
  expect(gameLink('https://x.dev/rt/?room=team')).toBe('https://x.dev/rt/?room=team&src=claude')
  expect(gameLink('https://x.dev/rt/', 'abc123defg')).toBe('https://x.dev/rt/?src=claude&pair=abc123defg')
  expect(gameLink('  ')).toBe('')
})

test('versionIn reads the version a result or refusal names', () => {
  expect(versionIn('{"ok":true,"version":7}')).toBe(7)
  expect(versionIn('already exists at version 12; pass if_version')).toBe(12)
  expect(versionIn('nothing here')).toBe(0)
})

test('a prompt signals working; the finished turn signals done, rings and toasts', { options: { gameUrl: ART, artifactUrl: ART, notifyAfterSeconds: 10 } }, async ($, on) => {
  mock.clock(on)
  const k = engine(on)
  await $.command.run({ command: 'fish', args: '' })

  await $.prompt.submit({ text: 'refactor the parser' } as any)
  await $.turn.complete({ ...TURN, durationMs: 42000 })

  const states = k.calls.map((c) => c.data.state)
  expect(states).toEqual(['working', 'done'])
  expect(k.calls[0].collection).toBe('data/users/me')
  expect(k.calls[0].doc_id).toBe('claude')
  expect(k.calls[0].url).toBe(ART)
  expect(k.calls[0].data.text).toBe(undefined) // the prompt itself never leaves
  expect(k.calls[1].if_version).toBe(1) // pinned to the version the first write returned
  expect(k.calls[1].data.seconds).toBe(42)
  expect(k.toasts).toEqual(["Claude's done. Reel it in!"])
  expect(k.rings.n).toBe(1)
})

test('a stale pin is retried once with the version the refusal names', { options: { gameUrl: ART, artifactUrl: ART } }, async ($, on) => {
  const k = engine(on)
  await $.command.run({ command: 'fish', args: '' })
  await $.turn.complete({ ...TURN, durationMs: 1000 })
  await settle()
  // a reload forgets the pin: simulate by a fresh doc version bump outside the plugin
  await $.tool.call({ tool: 'ArtifactData', action: 'set', url: ART, collection: 'data/users/me', doc_id: 'claude', data: {}, if_version: 1 } as any)
  await $.turn.complete({ ...TURN, durationMs: 1000 })
  await settle()
  const last = k.calls.slice(-2)
  expect(last[0].if_version).toBe(1) // stale pin refused
  expect(last[1].if_version).toBe(2) // retried with the named version
})

test('short and aborted turns stay quiet, helper agents send nothing', { options: { gameUrl: ART, artifactUrl: ART, notifyAfterSeconds: 10 } }, async ($, on) => {
  const k = engine(on)
  await $.command.run({ command: 'fish', args: '' })
  await $.turn.complete({ ...TURN, durationMs: 3000 })
  await $.turn.complete({ ...TURN, durationMs: 60000, isAborted: true })
  expect(k.rings.n).toBe(0)
  expect(k.calls.map((c) => c.data.aborted)).toEqual([false, true])
  await settle() // (the aborted turn's write may retry once in the background)
  const before = k.calls.length
  await $.turn.complete({ ...TURN, durationMs: 60000, agentId: 'helper' } as any)
  await settle()
  expect(k.calls.length).toBe(before)
})

test('a finished turn reports how many tool steps Claude took (not counting its own game writes)', { options: { gameUrl: ART, artifactUrl: ART, notifyAfterSeconds: 1 } }, async ($, on) => {
  const k = engine(on)
  on('tool.call', { tool: 'Bash' }, () => ({ result: {}, text: 'ok' }))
  on('tool.call', { tool: 'Edit' }, () => ({ result: {}, text: 'ok' }))
  await $.command.run({ command: 'fish', args: '' })
  await $.prompt.submit({ text: 'do the thing' } as any)
  await settle()
  for (let i = 0; i < 4; i++) await $.tool.call({ tool: 'Bash', command: 'ls' } as any)
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Edit', file_path: 'a', old_string: 'x', new_string: 'y' } as any)
  await $.turn.complete({ ...TURN, durationMs: 90000 })
  await settle()
  const done = k.calls.filter((c) => c.data?.state === 'done').at(-1)
  expect(done.data.steps).toBe(7)
})

test('signalGame off: bell only, no database writes', { options: { gameUrl: ART, artifactUrl: ART, signalGame: false, notifyAfterSeconds: 1 } }, async ($, on) => {
  const k = engine(on)
  await $.command.run({ command: 'fish', args: '' })
  await $.turn.complete({ ...TURN, durationMs: 5000 })
  expect(k.calls.length).toBe(0)
  expect(k.rings.n).toBe(1)
})

test('a refused write never breaks the turn', { options: { gameUrl: ART, artifactUrl: ART, notifyAfterSeconds: 1 } }, async ($, on) => {
  const k = engine(on)
  on('tool.call', { tool: 'ArtifactData' }, () => ({ deny: 'The user declined this write.' }))
  await $.command.run({ command: 'fish', args: '' })
  const r = await $.turn.complete({ ...TURN, durationMs: 5000 })
  expect(r.text).toBe('done')
  expect(k.rings.n).toBe(1)
})

test("lakeCounts reads the game's fish-while-waiting doc", () => {
  expect(lakeCounts('{"data":{"waitFish":3,"total":17,"at":1}}')).toEqual({ waitFish: 3, total: 17 })
  expect(lakeCounts('nothing')).toEqual({ waitFish: 0, total: 0 })
})

test('after a long turn the plugin tells you how many fish you caught while waiting', { options: { gameUrl: ART, artifactUrl: ART, notifyAfterSeconds: 10 } }, async ($, on) => {
  const k = engine(on, { waitFish: 2, total: 9 })
  await $.command.run({ command: 'fish', args: '' })
  await $.turn.complete({ ...TURN, durationMs: 60000 })
  await settle()
  expect(k.gets.length).toBe(1)
  expect(k.gets[0].doc_id).toBe('claude_lake')
  expect(k.toasts).toContain('You caught 2 fish while you waited.')
})

test('no game doc: no extra toast, nothing breaks', { options: { gameUrl: ART, artifactUrl: ART, notifyAfterSeconds: 10 } }, async ($, on) => {
  const k = engine(on)
  await $.command.run({ command: 'fish', args: '' })
  await $.turn.complete({ ...TURN, durationMs: 60000 })
  await settle()
  expect(k.toasts).toEqual(["Claude's done. Reel it in!"])
})

test('without a URL /fish explains how to set it', { options: { gameUrl: '' } }, async ($, on) => {
  engine(on)
  const ran = await $.command.run({ command: 'fish', args: '' })
  expect(ran.text).toContain('/config')
})

test('/fish opens the game in the artifact tab, and falls back to the link when it cannot', { options: { gameUrl: ART, artifactUrl: ART } }, async ($, on) => {
  const panes: any[] = []
  engine(on, null, false, panes)
  const opens: any[] = []
  let fail = false
  on('tool.call', { tool: 'Artifact' }, (_$: any, e: any) => {
    opens.push(e)
    return fail ? { result: {}, text: 'no artifact pane here', isError: true } : { result: {}, text: 'opened' }
  })
  const a: any = await $.command.run({ command: 'fish', args: '' })
  expect(opens.length).toBe(1)
  expect(opens[0].action).toBe('open')
  expect(opens[0].url).toBe(ART)
  // v0.6.2: in the app the game opens beside the chat with no link to click and no status pane covering it.
  expect(a.text).toContain('Gone fishin')
  expect(a.text).not.toContain('http')
  expect(panes.length).toBe(0)

  fail = true
  const b: any = await $.command.run({ command: 'fish', args: '' })
  expect(b.text).toContain('Open the lake: ' + ART)
  expect(panes.length).toBe(1)
})

test('/fish does not try the artifact tab for a self-hosted game URL', { options: { gameUrl: 'https://x.dev/rt/', artifactUrl: ART } }, async ($, on) => {
  engine(on)
  const opens: any[] = []
  on('tool.call', { tool: 'Artifact' }, (_$: any, e: any) => { opens.push(e); return { result: {}, text: 'opened' } })
  const a: any = await $.command.run({ command: 'fish', args: '' })
  expect(opens.length).toBe(0)
  expect(a.text).toContain('Open the lake: https://x.dev/rt/?src=claude')
})

test('v0.5.0: only its own status calls are pre-approved', () => {
  expect(isOwnStatusCall({ url: ART, collection: 'data/users/me', doc_id: 'claude', action: 'set' }, ART)).toBe(true)
  expect(isOwnStatusCall({ url: ART, collection: 'data/users/me', doc_id: 'claude_lake', action: 'get' }, ART)).toBe(true)
  expect(isOwnStatusCall({ url: ART, collection: 'data/users/me', doc_id: 'claude', action: 'delete' }, ART)).toBe(false)
  expect(isOwnStatusCall({ url: ART, collection: 'reports', doc_id: 'claude', action: 'set' }, ART)).toBe(false)
  expect(isOwnStatusCall({ url: 'https://claude.ai/artifact/OTHER', collection: 'data/users/me', doc_id: 'claude', action: 'set' }, ART)).toBe(false)
  expect(isOwnStatusCall({ url: ART, collection: 'data/users/me', doc_id: 'claude', action: 'set' }, '')).toBe(false)
})

test('v0.5.0: a game it cannot reach is mentioned once a session, and the turn still finishes', { options: { gameUrl: ART, artifactUrl: ART, notifyAfterSeconds: 1 } }, async ($, on) => {
  mock.clock(on)
  const k = engine(on, null, true)
  await $.command.run({ command: 'fish', args: '' })
  await $.prompt.submit({ text: 'hi' } as any)
  await settle()
  const r = await $.turn.complete({ ...TURN, durationMs: 5000 })
  await settle()
  await $.prompt.submit({ text: 'again' } as any)
  await $.turn.complete({ ...TURN, durationMs: 5000 })
  await settle()
  expect(r.text).toBe('done')
  expect(k.toasts.filter((t) => t.startsWith("Reel Time can't reach")).length).toBe(1)
})

test('a long turn re-sends working with its real start time, and done still lands last', { options: { gameUrl: ART, artifactUrl: ART, notifyAfterSeconds: 1 } }, async ($, on) => {
  const clock = mock.clock(on)
  const k = engine(on)
  on('tool.call', { tool: 'Bash' }, () => ({ result: {}, text: 'ok' }))
  await $.command.run({ command: 'fish', args: '' })
  const start = clock.now()
  await $.prompt.submit({ text: 'a long one' } as any)
  await clock.advance(30 * 1000)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as any) // too soon for a heartbeat
  await clock.advance(2 * 60 * 1000)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as any) // heartbeat
  await clock.advance(10 * 1000)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as any) // throttled
  await $.turn.complete({ ...TURN, durationMs: 160000 })
  await settle()
  const states = k.calls.map((c) => c.data.state)
  expect(states).toEqual(['working', 'working', 'done'])
  expect(k.calls[0].data.startedAt).toBe(start)
  expect(k.calls[1].data.startedAt).toBe(start)
  expect(k.calls[1].data.at).toBe(start + 150000)
})

test('v0.6.3: a new chat reads the doc version when the refusal does not name it, then writes', { options: { gameUrl: ART, artifactUrl: ART } }, async ($, on) => {
  // the doc already exists from an earlier chat (version 10), and the refusal carries no version number
  mock.clock(on)
  const k = engine(on, null, false, [], { start: 10, quiet: true })
  await $.command.run({ command: 'fish', args: '' })
  await $.prompt.submit({ text: 'hello' } as any)
  await $.turn.complete({ ...TURN, durationMs: 42000 })
  for (let i = 0; i < 20 && k.calls.length < 3; i++) await new Promise((r) => setTimeout(r, 10)) // the signals are queued in the background
  expect(k.calls[0].if_version).toBeUndefined() // first try has no pin
  expect(k.gets.some((g: any) => g.doc_id === 'claude')).toBe(true) // so it reads the doc
  expect(k.calls[1].if_version).toBe(10) // and retries pinned to the version it read
  expect(k.calls[2].if_version).toBe(11) // the done signal stays pinned
  expect(k.toasts.some((x: string) => x.includes("can't reach"))).toBe(false)
})

const MINE = 'https://claude.ai/artifact/MyOwnLake9'

test('v0.7.0: lakeLink accepts a Reel Time artifact link and drops the rest', () => {
  expect(lakeLink(MINE)).toBe(MINE)
  expect(lakeLink(`  ${MINE}?src=claude `)).toBe(MINE)
  expect(lakeLink('https://claude.ai/code/artifact/abc-123/')).toBe('https://claude.ai/code/artifact/abc-123')
  expect(lakeLink('https://evil.example/artifact/x')).toBe('')
  expect(lakeLink('my lake')).toBe('')
})

test('v0.7.0: /reel-time:lake points the signal and /fish at your own lake, and reset goes back', { options: { gameUrl: ART, artifactUrl: ART, notifyAfterSeconds: 1 } }, async ($, on) => {
  mock.clock(on)
  const k = engine(on)
  const mem: Record<string, unknown> = {}
  on('store.set', (_$: any, e: any) => { mem[e.key] = e.value; return { value: undefined } })
  on('store.get', (_$: any, e: any) => ({ value: mem[e.key] }))
  const opens: any[] = []
  on('tool.call', { tool: 'Artifact' }, (_$: any, e: any) => { opens.push(e); return { result: {}, text: 'opened' } })
  const bad: any = await $.command.run({ command: 'lake', args: 'not a link' })
  expect(bad.text).toContain("doesn't look like")
  const set: any = await $.command.run({ command: 'lake', args: MINE })
  expect(set.text).toContain(MINE)
  await $.command.run({ command: 'fish', args: '' })
  expect(opens[0].url).toBe(MINE)
  await $.prompt.submit({ text: 'hi' } as any)
  await $.turn.complete({ ...TURN, durationMs: 3000 })
  await settle()
  expect(k.calls.map((c) => c.url)).toEqual([MINE, MINE])
  const shown: any = await $.command.run({ command: 'lake', args: '' })
  expect(shown.text).toContain(MINE)
  expect(mem.lake).toBe(MINE) // remembered for the next session
  const back: any = await $.command.run({ command: 'lake', args: 'reset' })
  expect(back.text).toContain(ART)
  expect(mem.lake).toBe('')
})
