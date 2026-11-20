import assert from 'node:assert/strict'
import test from 'node:test'
import {
  copyCapExitCode,
  deriveCopyCap,
  judgeCandidate,
  judgeConstant
} from './measure-copy-chromium.mjs'

const screens = ['claude-code', 'claude-work', 'opencode-code']
const five = (fn) => Array.from({ length: 5 }, fn)
const task = (kind, blockCount) => ({ kind, blockCount, durationMs: 50 })
function run(n, c) {
  if (n <= c) return [task('handler', n)]
  const records = [task('handler', 0)]
  for (let start = 0; start < n; start += c) records.push(task('chunk', Math.min(c, n - start)))
  return [...records, task('assemble', n)]
}
function candidate() {
  return {
    size: 25,
    ...Object.fromEntries(
      screens.map((screen) => [screen, { sync: five(() => 50), overflow: five(() => run(51, 25)) }])
    )
  }
}
function constantData(c = 120) {
  return {
    constant: c,
    cap: 150,
    candidates: { 100: { pass: true }, 150: { pass: true } },
    constantRuns: Object.fromEntries(
      [c, c + 1, 2 * c + 1, 2500, 5000].map((n) => [
        n,
        Object.fromEntries(screens.map((s) => [s, five(() => run(n, c))]))
      ])
    )
  }
}
test('h1 cap follows the sorted passing prefix', () => {
  assert.equal(
    deriveCopyCap([
      { size: 400, pass: true },
      { size: 100, pass: true },
      { size: 800, pass: false }
    ]),
    400
  )
  assert.equal(
    deriveCopyCap([
      { size: 75, pass: true },
      { size: 100, pass: false },
      { size: 150, pass: true }
    ]),
    75
  )
})
test('h2 every screen must pass', () => {
  for (const s of screens) {
    const data = candidate()
    data[s].sync[0] = 51
    assert.equal(judgeCandidate(data), false)
  }
})
test('h3 both paths must pass', () => {
  const data = candidate()
  data['claude-work'].overflow[2][1].durationMs = 51
  assert.equal(judgeCandidate(data), false)
  data['claude-work'].overflow[2][1].durationMs = 50
  data['claude-work'].sync[2] = 51
  assert.equal(judgeCandidate(data), false)
})
test('h4 inclusive task budget applies to individual samples', () => {
  const data = candidate()
  assert.ok(judgeCandidate(data))
  for (const [base, slow] of [
    [30, 50.1],
    [20, 160]
  ]) {
    data['opencode-code'].sync = [base, base, base, base, slow]
    assert.equal(judgeCandidate(data), false)
  }
})
test('h5 no passing candidate', () => {
  const cap = deriveCopyCap([
    { size: 25, pass: false },
    { size: 50, pass: false }
  ])
  assert.equal(cap, null)
  assert.equal(
    copyCapExitCode({
      verdict: judgeConstant({ ...constantData(), cap }),
      load: 1,
      cores: 1,
      env: true
    }),
    1
  )
})
test('h6 off-grid constant needs its own runs, passing lower candidates and valid environment', () => {
  const data = constantData()
  const status = (verdict, load = 1, env = true) =>
    copyCapExitCode({ verdict, load, cores: 1, env })
  assert.equal(status(judgeConstant(data)), 0)
  assert.equal(status(true, 2), 2)
  assert.equal(status(true, 1, false), 3)
  assert.equal(status(judgeConstant({ ...data, cap: 100 })), 1)
  data.constantRuns[120]['claude-code'][4][0].durationMs = 51
  assert.equal(status(judgeConstant(data)), 1)
  const failed = constantData(100)
  failed.candidates[100].pass = false
  assert.equal(status(judgeConstant(failed)), 1)
})
test('h7 all overflow task durations, count and order including long selections', () => {
  for (const mutate of [
    (r) => (r.at(-1).durationMs = 51),
    (r) => (r[0].durationMs = 51),
    (r) => r.splice(-2, 1),
    (r) => r.splice(0),
    (r) => r.reverse()
  ]) {
    const data = candidate()
    mutate(data['claude-code'].overflow[4])
    assert.equal(judgeCandidate(data), false)
  }
  for (const size of [2500, 5000]) {
    const data = constantData()
    data.constantRuns[size]['claude-work'][2].at(-2).blockCount++
    assert.equal(judgeConstant(data), false)
    data.constantRuns[size]['claude-work'][2].splice(1, 1)
    assert.equal(judgeConstant(data), false)
  }
})
test('h8 sync and overflow transition must follow the production path', () => {
  for (const [size, mutate] of [
    [120, (r) => (r[0].blockCount = 0)],
    [120, (r) => r.push(task('chunk', 1))],
    [121, (r) => (r[0].blockCount = 121)],
    [121, (r) => (r[1].blockCount = 1)]
  ]) {
    const data = constantData()
    mutate(data.constantRuns[size]['opencode-code'][1])
    assert.equal(judgeConstant(data), false)
  }
})
