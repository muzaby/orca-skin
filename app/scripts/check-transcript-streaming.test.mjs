import test from 'node:test'
import assert from 'node:assert/strict'
import { judgeStreamingRuns, main } from './check-transcript-streaming.mjs'
import { SCREENS, RUNS, selectionExitCode } from './check-transcript-selection.mjs'
import { STEPS } from './transcript-streaming/steps.mjs'

function grid() {
  return SCREENS.flatMap((screen) =>
    ['P1', 'U1'].flatMap((scenario) =>
      Array.from({ length: RUNS }, (_, run) => ({
        screen,
        scenario,
        run,
        preconditions: { tailBelow: true, rowTopAbove: true },
        steps: STEPS.map((s, i) => ({
          ...s,
          stableBlocks: i < 5 ? 40 : 41,
          missing: [],
          duplicated: [],
          latestPresent: true,
          latestVisible: true,
          bottomDistance: 0,
          offset: 5
        }))
      }))
    )
  )
}
test('ks1/ks12: 18개 기록과 8단계를 검사하고 완료 뒤에는 스크롤을 판정하지 않는다', () => {
  const records = grid()
  for (const r of records)
    Object.assign(r.steps.at(-1), { bottomDistance: 300, offset: 300, latestVisible: false })
  assert.deepEqual(judgeStreamingRuns(records), { verdict: true, failures: [] })
})
for (const [label, change] of [
  ['ks2 missing run', (rs) => rs.pop()],
  ['unknown record', (rs) => rs.push(rs[0])],
  ['ks3 pin tolerance', (rs) => (rs[0].steps[1].bottomDistance = 1.5)],
  ['ks4 unpin tolerance', (rs) => (rs[3].steps[1].offset += 1.5)],
  ['ks5 duplicate marker', (rs) => rs[0].steps[1].duplicated.push('T00001')],
  ['ks6 missing parsed view', (rs) => (rs[0].steps[2].view = 'raw')],
  ['ks7 wrong length', (rs) => (rs[0].steps[1].tailLength = 4002)],
  ['ks8 missing precondition', (rs) => (rs[3].preconditions.tailBelow = false)],
  ['ks10 stale parsed length', (rs) => (rs[0].steps[3].parsedChars = 4001)],
  ['ks11 missing completion', (rs) => rs[0].steps.pop()],
  ['ks11 completion with tail', (rs) => (rs[0].steps.at(-1).view = 'parsed')]
])
  test(label, () => {
    const rs = grid()
    change(rs)
    assert.equal(judgeStreamingRuns(rs).verdict, false)
  })
test('ks9: 바이너리 부재와 실행 실패를 구분한다', async () => {
  const fail = () => {
    throw Error('missing')
  }
  assert.equal(selectionExitCode(await main({ resolveElectron: fail })), 3)
  assert.equal(
    selectionExitCode(
      await main({
        resolveElectron: () => '/binary',
        serveProbe: async () => ({ close: async () => {} }),
        runElectron: fail
      })
    ),
    1
  )
})
