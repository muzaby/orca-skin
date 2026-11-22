// `check-transcript-selection.mjs` 의 순수 판정부 (0326 ΔV2 · VP-41 · EP-24 · k1~k9).
// Electron 없이 기록을 주입해 판정이 무엇을 실패로 세는지 잠근다.
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  RUNS,
  SCENARIOS,
  SCREENS,
  judgeSelectionRuns,
  pasteMatches,
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
        cancelMs: [0.4],
        selectionText: ['', '', ''],
        clipboard: SENTINEL
      }
    case 'B2':
    case 'C4':
      return { ...base, ...copy, mountedKeys: 0, selectionText: ['x', 'x'] }
    case 'C5':
      return { ...base, mountedKeys: 4, selectionText: ['composer', 'composer'] }
    default:
      return { ...base, mountedKeys: 2, cancelMs: [1], selectionText: [''], clipboard: SENTINEL }
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

test('k2 a long task or a cancel over 50ms fails · exactly 50ms passes · a cancel scenario needs a measure', () => {
  assert.deepEqual(reasons(grid(at('claude-code', 'A1', 0, { longTasks: [51] }))), ['long task'])
  assert.equal(
    judgeSelectionRuns(grid(at('opencode-code', 'C1', 2, { cancelMs: [50] }))).verdict,
    true
  )
  assert.deepEqual(reasons(grid(at('opencode-code', 'C1', 2, { cancelMs: [50.1] }))), [
    'cancel task over budget'
  ])
  assert.deepEqual(reasons(grid(at('claude-work', 'C2', 1, { cancelMs: [] }))), [
    'cancel not measured'
  ])
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

test('k8 exit codes — no Electron 3 · harness error 1 · judged failure 1 · pass 0', () => {
  assert.equal(selectionExitCode({ env: false }), 3)
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
