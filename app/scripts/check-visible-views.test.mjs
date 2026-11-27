import assert from 'node:assert/strict'
import test from 'node:test'
import { SCREENS, judgeVisibleViews, main } from './check-visible-views.mjs'
import { selectionExitCode } from './check-transcript-selection.mjs'
function grid() {
  return SCREENS.flatMap((screen) =>
    ['c1', 'c2', 'c5', ...(['git-inline', 'transcript-diff'].includes(screen) ? ['c4'] : [])].map(
      (scenario) => ({
        screen,
        scenario,
        expected: 'row',
        clipboard: scenario === 'c2' ? 'unchanged' : 'row',
        ...(screen.startsWith('transcript-') &&
          scenario === 'c1' && { crossExpected: 'cross', crossClipboard: 'cross' }),
        reachedFirst: true,
        reachedLast: true,
        mounted: 30,
        keysBefore: ['a', 'b'],
        keysAfter: ['a', 'b', 'c'],
        ...(screen.startsWith('transcript-') &&
          scenario === 'c2' && {
            outerBefore: ['message', 'next'],
            outerAfter: ['message', 'next']
          }),
        endpointsConnected: true,
        selectionBefore: 'row',
        selectionAfter: scenario === 'c2' ? '' : 'row'
      })
    )
  )
}
test('vv1 complete grid', () =>
  assert.deepEqual(judgeVisibleViews(grid()), { verdict: true, failures: [] }))
test('vv2 missing record', () =>
  assert.equal(judgeVisibleViews(grid().slice(1)).failures[0].reason, 'missing record'))
test('vv3 unknown record', () =>
  assert.equal(
    judgeVisibleViews([...grid(), { screen: 'other', scenario: 'c1' }]).failures[0].reason,
    'unknown record'
  ))
for (const [name, scenario, change] of [
  ['vv4 no added key', 'c2', { keysAfter: ['b'] }],
  ['vv5 disconnected endpoints', 'c2', { endpointsConnected: false }],
  ['vv6 surviving selection', 'c2', { selectionAfter: 'row' }],
  ['vv7 clipboard overwritten', 'c2', { clipboard: '' }],
  ['vv8 copy mismatch', 'c1', { clipboard: 'other' }],
  ['vv9 oversized mount', 'c5', { mounted: 150 }],
  ['vv9 fresh copy mismatch', 'c5', { clipboard: 'other' }],
  ['vv10 other panel clears selection', 'c4', { selectionAfter: '' }]
]) {
  test(name, () => {
    const records = grid()
    Object.assign(
      records.find((r) => r.scenario === scenario),
      change
    )
    assert.equal(judgeVisibleViews(records).failures.length, 1)
  })
}
for (const [name, screen, scenario, change] of [
  ['vv4b missing baseline keys', 'git-inline', 'c2', { keysBefore: [] }],
  ['vv6b no original selection', 'git-inline', 'c2', { selectionBefore: '' }],
  ['vv8b empty copy text', 'git-inline', 'c1', { expected: '', clipboard: '' }],
  ['vv9b zero rows', 'git-inline', 'c5', { mounted: 0 }],
  ['vv9c missing row count', 'git-inline', 'c5', { mounted: undefined }],
  ['vv9c noninteger row count', 'git-inline', 'c5', { mounted: 1.5 }],
  [
    'vv10b no selection to isolate',
    'git-inline',
    'c4',
    { selectionBefore: '', selectionAfter: '', clipboard: '' }
  ],
  ['vv12 replaced outer key', 'transcript-file', 'c2', { outerAfter: ['message', 'other'] }],
  ['vv12 reordered outer keys', 'transcript-file', 'c2', { outerAfter: ['next', 'message'] }],
  ['vv12 added outer key', 'transcript-file', 'c2', { outerAfter: ['message', 'next', 'other'] }],
  ['vv12b missing outer baseline', 'transcript-file', 'c2', { outerBefore: undefined }],
  ['vv12b empty outer baseline', 'transcript-file', 'c2', { outerBefore: [], outerAfter: [] }],
  ['vv12 missing outer result', 'transcript-file', 'c2', { outerAfter: undefined }],
  ['vv13 cross-panel copy mismatch', 'transcript-file', 'c1', { crossClipboard: 'other' }],
  [
    'vv13b missing cross-selection text',
    'transcript-file',
    'c1',
    { crossExpected: undefined, crossClipboard: undefined }
  ],
  ['vv14 no new key in other panel', 'git-inline', 'c4', { keysAfter: ['a', 'b'] }],
  ['vv15 first row unreachable', 'git-inline', 'c1', { reachedFirst: false }],
  ['vv15b last row unreachable', 'git-inline', 'c1', { reachedLast: false }],
  ['vv16 clipboard alone differs', 'git-inline', 'c4', { clipboard: 'other' }]
]) {
  test(name, () => {
    const records = grid()
    Object.assign(
      records.find((r) => r.screen === screen && r.scenario === scenario),
      change
    )
    assert.deepEqual(judgeVisibleViews(records), {
      verdict: false,
      failures: [{ screen, scenario, reason: scenario + ' evidence' }]
    })
  })
}
test('vv11 exit codes and launcher arguments', async () => {
  const deps = {
    resolveElectron: () => '/electron',
    serveProbe: async () => ({ origin: 'origin', close: async () => {} }),
    runElectron: async (...args) => {
      assert.deepEqual(args, ['/electron', 'origin', 'visible-views', SCREENS, 1])
      return { records: grid() }
    }
  }
  assert.equal(selectionExitCode(await main(deps)), 0)
  assert.equal(
    selectionExitCode(
      await main({
        ...deps,
        resolveElectron() {
          throw Error('absent')
        }
      })
    ),
    3
  )
  assert.equal(
    selectionExitCode(
      await main({
        ...deps,
        runElectron() {
          throw Error('launch')
        }
      })
    ),
    1
  )
  assert.equal(selectionExitCode(await main({ ...deps, runElectron: () => ({ records: [] }) })), 1)
})
