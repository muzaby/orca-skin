import { test } from 'node:test'
import assert from 'node:assert/strict'
import { imageLane } from './measure-stage-d.mjs'

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
