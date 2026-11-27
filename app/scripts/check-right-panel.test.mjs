import assert from 'node:assert/strict'
import { test } from 'node:test'
import { passesRightPanel, requiredMeasurements } from './check-right-panel.mjs'

const complete = [false, true].flatMap((reduced) =>
  requiredMeasurements.map((name) => ({ name, reduced, ok: true }))
)

test('requires every measurement in both motion modes', () => {
  assert.equal(new Set(requiredMeasurements).size, requiredMeasurements.length)
  assert.equal(passesRightPanel({ records: complete }), true)
  for (const reduced of [false, true]) {
    for (const name of requiredMeasurements) {
      const missing = complete.filter((row) => row.reduced !== reduced || row.name !== name)
      assert.equal(passesRightPanel({ records: missing }), false, name)
    }
  }
})

test('propagates budget, measurement and browser failures', () => {
  const failedBudget = complete.map((row) => ({ ...row, ok: row.name !== 'long-task-observation' }))
  assert.equal(passesRightPanel({ records: failedBudget }), false)
  assert.equal(
    passesRightPanel({ records: [...complete, { ok: false, error: 'Detached frame' }] }),
    false
  )
  assert.equal(passesRightPanel({ records: complete, error: 'Timed out' }), false)
  assert.equal(passesRightPanel({ records: [] }), false)
})
