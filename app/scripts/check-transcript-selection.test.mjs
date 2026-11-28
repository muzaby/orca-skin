// `check-transcript-selection.mjs` 의 순수 판정부 (0326 ΔV2 · VP-41 · EP-24 · k1~k10).
// Electron 없이 기록을 주입해 판정이 무엇을 실패로 세는지 잠근다.
import { strict as assert } from 'node:assert'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import {
  RUNS,
  SCENARIOS,
  SCREENS,
  judgeSelectionRuns,
  launchFailure,
  main,
  pasteMatches,
  runElectron,
  selectionExitCode
} from './check-transcript-selection.mjs'

const SENTINEL = 's'
const multi = {
  start: ' alpha',
  end: 'M1a al',
  markers: ['M0b', 'Q1'],
  forbid: ['RESULT-0-body'],
  multi: true
}
const goodPaste = ' alpha bravo\nf0.ts\nM0b foxtrot\nQ1 question\nM1a al'

function record(screen, scenario, run) {
  const base = { screen, scenario, run, sentinel: SENTINEL, longTasks: [], cancelMs: [] }
  const copy = { copyPrevented: false, expected: multi, pasted: goodPaste }
  switch (scenario) {
    case 'A1':
    case 'A2':
    case 'A3':
      return { ...base, ...copy, selectionText: ['x'] }
    case 'B1':
      return {
        ...base,
        ...copy,
        mountedKeys: 3,
        endsMounted: true,
        cancelMs: [0.4],
        selectionText: ['', '', ''],
        clipboard: SENTINEL
      }
    case 'B2':
      return { ...base, ...copy, mountedKeys: 0, scrolled: 1, selectionText: ['x', 'x'] }
    case 'C4':
      return { ...base, ...copy, mountedKeys: 0, selectionText: ['x', 'x'] }
    case 'C5':
      return { ...base, mountedKeys: 4, selectionText: ['composer', 'composer'] }
    default:
      return {
        ...base,
        mountedKeys: 2,
        endsMounted: true,
        cancelMs: [1],
        selectionText: [''],
        clipboard: SENTINEL
      }
  }
}

function grid(edit = (r) => r) {
  const out = []
  for (const screen of SCREENS)
    for (const scenario of SCENARIOS)
      for (let run = 0; run < RUNS; run++) out.push(edit(record(screen, scenario, run)))
  return out
}

const at = (screen, scenario, run, patch) => (r) =>
  r.screen === screen && r.scenario === scenario && r.run === run ? { ...r, ...patch } : r

const reasons = (records) => judgeSelectionRuns(records).failures.map((f) => f.reason)

test('k1 every expected record passing → verdict true · failures 0', () => {
  assert.deepEqual(judgeSelectionRuns(grid()), { verdict: true, failures: [] })
})

test('k2′ long tasks and cancel times are recorded only — any value leaves the verdict unchanged (D-108)', () => {
  for (const patch of [{ longTasks: [400] }, { cancelMs: [999] }, { cancelMs: [] }]) {
    assert.deepEqual(judgeSelectionRuns(grid(at('claude-work', 'C2', 1, patch))), {
      verdict: true,
      failures: []
    })
  }
})

test('k3 a prevented copy fails', () => {
  assert.deepEqual(reasons(grid(at('claude-code', 'A2', 1, { copyPrevented: true }))), [
    'copy default prevented or not observed'
  ])
  assert.deepEqual(reasons(grid(at('claude-code', 'A2', 1, { copyPrevented: null }))), [
    'copy default prevented or not observed'
  ])
})

test('k4 pasted text — missing or reordered marker, empty, single line, forbidden card body', () => {
  assert.equal(pasteMatches(goodPaste, multi), true)
  assert.equal(pasteMatches(goodPaste.replace('M0b foxtrot\n', ''), multi), false)
  assert.equal(pasteMatches(' alpha\nQ1 question\nM0b foxtrot\nM1a al', multi), false)
  assert.equal(pasteMatches('', multi), false)
  assert.equal(pasteMatches(' alpha M0b Q1 M1a al', multi), false)
  assert.equal(pasteMatches(goodPaste.replace('f0.ts', 'RESULT-0-body'), multi), false)
  assert.equal(pasteMatches(goodPaste + 'x', multi), false)
  assert.deepEqual(reasons(grid(at('claude-work', 'A3', 0, { pasted: '' }))), ['pasted text'])
})

test('k5 a cancel scenario must prove the mount, clear the selection and keep the clipboard', () => {
  assert.deepEqual(reasons(grid(at('claude-code', 'B1', 0, { mountedKeys: 0 }))), [
    'no row mounted'
  ])
  assert.deepEqual(reasons(grid(at('claude-code', 'C3', 0, { selectionText: ['left'] }))), [
    'selection survived'
  ])
  assert.deepEqual(reasons(grid(at('claude-code', 'B1', 0, { selectionText: ['', 'revived'] }))), [
    'selection survived'
  ])
  assert.deepEqual(reasons(grid(at('claude-code', 'C1', 1, { clipboard: 'copied' }))), [
    'clipboard changed after cancel'
  ])
  // ΔV2 rev 3: the selected rows must stay mounted, or Chromium drops the selection by itself.
  assert.deepEqual(reasons(grid(at('claude-work', 'C1', 0, { endsMounted: false }))), [
    'selected rows unmounted'
  ])
  assert.deepEqual(reasons(grid(at('opencode-code', 'B1', 2, { endsMounted: undefined }))), [
    'selected rows unmounted'
  ])
  assert.deepEqual(reasons(grid(at('claude-code', 'C2', 1, { endsMounted: true }))), [])
})

test('k6 a control scenario must mount nothing and keep the selection', () => {
  assert.deepEqual(reasons(grid(at('opencode-code', 'B2', 0, { mountedKeys: 1 }))), [
    'control mounted a row'
  ])
  assert.deepEqual(reasons(grid(at('opencode-code', 'B2', 0, { selectionText: ['x', ''] }))), [
    'selection changed'
  ])
  assert.deepEqual(reasons(grid(at('opencode-code', 'C4', 2, { selectionText: ['x', 'y'] }))), [
    'selection changed'
  ])
  assert.deepEqual(reasons(grid(at('opencode-code', 'C5', 2, { mountedKeys: 0 }))), [
    'no row mounted'
  ])
})

test('k6′ the scroll control must move the transcript (0331 D-033)', () => {
  assert.deepEqual(reasons(grid(at('claude-work', 'B2', 1, { scrolled: 0 }))), [
    'control did not scroll'
  ])
  assert.deepEqual(reasons(grid(at('claude-work', 'B2', 1, { scrolled: undefined }))), [
    'control did not scroll'
  ])
})

test('k7 fail-closed grid — a missing cell, an unknown scenario and no records fail', () => {
  const missing = grid().filter(
    (r) => !(r.screen === 'claude-work' && r.scenario === 'C4' && r.run === 1)
  )
  assert.deepEqual(judgeSelectionRuns(missing).failures, [
    { screen: 'claude-work', scenario: 'C4', run: 1, reason: 'missing record' }
  ])
  assert.deepEqual(reasons([...grid(), { ...record('claude-code', 'A1', 0), scenario: 'Z9' }]), [
    'unknown record'
  ])
  const empty = judgeSelectionRuns([])
  assert.equal(empty.verdict, false)
  assert.equal(empty.failures.length, SCREENS.length * SCENARIOS.length * RUNS)
  assert.equal(judgeSelectionRuns(undefined).verdict, false)
})

test('k8′ exit codes — no Electron binary 3 · failed launch 1 · harness error 1 · judged failure 1 · pass 0 (D-107)', () => {
  assert.equal(selectionExitCode({ env: false }), 3)
  const launch = launchFailure(new Error('electron exited 4294967295 without result'))
  assert.deepEqual(launch, {
    env: true,
    verdict: false,
    error: 'Error: electron exited 4294967295 without result'
  })
  assert.equal(selectionExitCode(launch), 1)
  assert.equal(selectionExitCode({ env: true, error: 'boom', verdict: true }), 1)
  assert.equal(selectionExitCode({ env: true, verdict: false }), 1)
  assert.equal(selectionExitCode({ env: true, verdict: true }), 0)
})

test('k9 each failing record is reported with screen, scenario, run and reason', () => {
  const result = judgeSelectionRuns(grid(at('opencode-code', 'A1', 2, { error: 'timeout' })))
  assert.deepEqual(result.failures, [
    { screen: 'opencode-code', scenario: 'A1', run: 2, reason: 'harness: timeout' }
  ])
})

// k10 · VP-41 ⑤′ (ΔV2 rev 5): every result `main()` returns, with the outside world injected.
// Each seat gets its own error text so swapping two catches shows.
function deps(overrides = {}) {
  const calls = { serve: 0, close: 0 }
  return {
    calls,
    deps: {
      resolveElectron: () => '/fake/electron',
      serveProbe: async () => {
        calls.serve++
        return { origin: 'http://127.0.0.1:1', close: async () => void calls.close++ }
      },
      runElectron: async () => ({ env: true, records: grid() }),
      ...overrides
    }
  }
}

test('k10 E1 no Electron binary → env false · exit 3 · nothing served', async () => {
  const { calls, deps: d } = deps({
    resolveElectron: () => {
      throw new Error('no-electron')
    }
  })
  const result = await main(d)
  assert.equal(result.env, false)
  assert.equal(result.reason, '환경 없음')
  assert.match(result.error, /no-electron/)
  assert.equal(selectionExitCode(result), 3)
  assert.equal(calls.serve, 0)
})

test('k10 E2 a failed bundle or server → env true · its error · exit 1', async () => {
  const { deps: d } = deps({
    serveProbe: async () => {
      throw new Error('bundle-x')
    }
  })
  const result = await main(d)
  assert.equal(result.env, true)
  assert.equal(result.verdict, false)
  assert.match(result.error, /bundle-x/)
  assert.doesNotMatch(result.error, /launch-y/)
  assert.equal(selectionExitCode(result), 1)
})

test('k10 E3 a failed Electron launch → launchFailure · exit 1 · the server is closed', async () => {
  const { calls, deps: d } = deps({
    runElectron: async () => {
      throw new Error('launch-y')
    }
  })
  const result = await main(d)
  assert.deepEqual(result, launchFailure(new Error('launch-y')))
  assert.doesNotMatch(result.error, /bundle-x/)
  assert.equal(selectionExitCode(result), 1)
  assert.equal(calls.close, 1)
})

test('k10 E4 a harness error result → env true · verdict false · exit 1', async () => {
  const { deps: d } = deps({ runElectron: async () => ({ error: 'harness-z' }) })
  const result = await main(d)
  assert.equal(result.env, true)
  assert.equal(result.verdict, false)
  assert.equal(result.error, 'harness-z')
  assert.equal(selectionExitCode(result), 1)
})

test('k10 E5 the records are judged — a passing grid exits 0, one failing record exits 1', async () => {
  const pass = await main(deps().deps)
  assert.equal(pass.env, true)
  assert.equal(pass.verdict, true)
  assert.deepEqual(pass.failures, [])
  assert.equal(selectionExitCode(pass), 0)
  const { deps: d } = deps({
    runElectron: async () => ({
      env: true,
      records: grid(at('claude-code', 'C1', 1, { clipboard: 'copied' }))
    })
  })
  const fail = await main(d)
  assert.equal(fail.verdict, false)
  assert.ok(fail.failures.length >= 1)
  assert.equal(selectionExitCode(fail), 1)
})

for (const channel of ['stdout', 'stderr']) {
  test(`runElectron preserves UTF-8 split between ${channel} chunks`, async () => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough()
    })
    const result = runElectron(
      'electron',
      'http://localhost',
      'transcript-history',
      SCREENS,
      1,
      () => child
    )
    const message = 'Question 2 — fixture'
    const bytes = Buffer.from(
      channel === 'stdout' ? 'OO_RESULT ' + JSON.stringify({ message }) + '\n' : message
    )
    const split = bytes.indexOf(Buffer.from('—')) + 2
    child[channel].write(bytes.subarray(0, split))
    child[channel].end(bytes.subarray(split))
    child.emit('close', channel === 'stdout' ? 0 : 1)
    if (channel === 'stdout') assert.deepEqual(await result, { message })
    else await assert.rejects(result, { message: 'electron exited 1 without result: ' + message })
  })
}
