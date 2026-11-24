import { test } from 'node:test'
import assert from 'node:assert/strict'
import { imageLane } from './measure-stage-d.mjs'
import {
  compatibleRun,
  distribution,
  hostDecision,
  rendererDecision
} from './stage-d/measurement.mjs'

test('R-W uses the per-job percentile and includes the threshold', () => {
  const jobs = [{ imageTimesMs: [...Array(18).fill(10), 50, 70] }]
  assert.deepEqual(imageLane(jobs, 50), { p95: 50, max: 70, lane: 'image' })
  assert.deepEqual(imageLane(jobs, 51), { p95: 50, max: 70, lane: 'compute' })
})

test('R-W stays unmeasured when work timing or the threshold is missing', () => {
  assert.equal(imageLane([], 50), null)
  assert.equal(imageLane([{}], 50), null)
  assert.equal(imageLane([{ imageTimesMs: [10, undefined] }], 50), null)
  assert.equal(imageLane([{ imageTimesMs: [10] }], undefined), null)
})

const sample = {
  T1: 40,
  T2: 20,
  T3: 10,
  T4: 10,
  T5: 20,
  T6: null,
  C1: 8_000_000,
  C2: 10_000,
  longTasks: []
}

test('R-H uses elapsed host and window time without adding byte and row counts', () => {
  assert.equal(hostDecision([sample], 50).decision, 'on')
  assert.equal(hostDecision([{ ...sample, T5: 50 }], 50).decision, 'off')
  assert.equal(hostDecision([{ ...sample, T1: 29 }], 50).decision, 'off')
  assert.equal(hostDecision([{ ...sample, T1: 30, T5: 29 }], 50).decision, 'on')
  assert.equal(hostDecision([{ ...sample, T5: 40 }], 50).decision, 'off')
})

test('missing timing makes R-H and host-related R-R unavailable', () => {
  const missing = { ...sample, T2: null }
  assert.deepEqual(hostDecision([missing], 50), { decision: 'unavailable', missing: ['T2'] })
  assert.deepEqual(rendererDecision([missing], 50), { decision: 'unavailable', missing: ['T2'] })
})

test('R-R uses task duration and synchronous processing, independent of RAF wait', () => {
  assert.equal(rendererDecision([{ ...sample, longTasks: [50] }], 50).decision, 'on')
  assert.equal(rendererDecision([{ ...sample, longTasks: [49] }], 50).decision, 'off')
  assert.equal(rendererDecision([{ ...sample, T3: 50, longTasks: null }], 50).decision, 'on')
  assert.equal(rendererDecision([{ ...sample, T4: 50, longTasks: null }], 50).decision, 'on')
  assert.equal(rendererDecision([{ ...sample, T5: 80 }], 50).decision, 'off')
})

test('summaries retain the median, p95 and maximum and distinguish missing samples', () => {
  assert.deepEqual(distribution([12, 3, 6, 2]), { median: 4.5, p95: 12, max: 12 })
  assert.equal(distribution([2, null]), null)
  assert.equal(distribution([]), null)
})

test('comparison checks build provenance, input size and actual/diagnostic producer identity', () => {
  const before = {
    baseline: true,
    sha: 'base',
    environment: 'linux-electron',
    electron: '39.8.10',
    measurements: [{ id: 'S-D8', size: 0, source: 'actual-install' }]
  }
  const after = { ...before, baseline: false, sha: 'candidate' }
  assert.equal(compatibleRun(before, after), true)
  assert.equal(compatibleRun(before, { ...after, sha: 'base' }), false)
  assert.equal(compatibleRun(before, { ...after, electron: '40' }), false)
  assert.equal(compatibleRun(before, { ...after, measurements: [null] }), false)
  assert.equal(
    compatibleRun(before, {
      ...after,
      measurements: [{ ...after.measurements[0], size: 1 }]
    }),
    false
  )
  assert.equal(
    compatibleRun(before, {
      ...after,
      measurements: [{ ...after.measurements[0], source: 'diagnostic-install' }]
    }),
    false
  )
})
