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
        crossExpected: 'cross',
        crossClipboard: 'cross',
        reachedFirst: true,
        reachedLast: true,
        mounted: 30,
        keysBefore: ['a', 'b'],
        keysAfter: ['a', 'b', 'c'],
        outerBefore: ['message'],
        outerAfter: ['message'],
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
