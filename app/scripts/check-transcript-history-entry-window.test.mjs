import assert from 'node:assert/strict'
import test from 'node:test'
import { completeEntryAttempt, recordMissedEntry } from './transcript-history/entry-window.mjs'

const first = { time: 10, top: 50, bottom: 50, opacity: 0.5, line: 'first' }
const mid = { time: 20, top: 10, bottom: 150, opacity: 1, line: 'moving' }
const last = { ...mid, time: 40, top: 150 }
const late = {
  firstPaint: [first],
  moving: [mid, last],
  unitRequest: { time: 35, top: 150, bottom: 150 },
  requests: ['withinUnit']
}

async function attempt(scenario, entry) {
  const events = []
  const result = await completeEntryAttempt(
    scenario,
    entry,
    () => events.push('wheel'),
    () => {
      events.push('release')
      return { writes: [], samples: [] }
    }
  )
  return { result, events }
}

test('a late native request is classified before either input, with its raw samples', async () => {
  for (const scenario of ['entryPrepend', 'entryCancel']) {
    const { result, events } = await attempt(scenario, late)
    assert.deepEqual(events, [])
    assert.equal(result.missedEntry, late)
  }
  assert.deepEqual((await attempt('openFrames', late)).events, ['release'])
})

test('unproven input or broken first paint remains a failed coordinate with raw data', async () => {
  for (const entry of [
    { ...late, firstPaint: [{ ...first, line: '' }] },
    { ...late, firstPaint: [{ ...first, opacity: 1 }] },
    { ...late, moving: [last] },
    { ...late, moving: [] },
    { ...late, moving: [mid], unitRequest: undefined },
    { ...late, unitRequest: { ...late.unitRequest, top: 42 } },
    { ...late, moving: [{ ...mid, time: 36 }, last] },
    { ...late, moving: [mid] }
  ]) {
    const { result, events } = await attempt('entryCancel', entry)
    assert.deepEqual(events, [])
    assert.deepEqual(result, {
      ...entry,
      error: 'No observed within-unit request during bottom movement'
    })
  }
})

test('an eligible input keeps the resulting failure and all motion samples', async () => {
  const entry = { ...late, moving: [mid], unitRequest: { ...late.unitRequest, top: 2, time: 15 } }
  for (const scenario of ['entryCancel', 'entryPrepend']) {
    const { result, events } = await attempt(scenario, entry)
    assert.deepEqual(events, scenario === 'entryCancel' ? ['wheel', 'release'] : ['release'])
    assert.deepEqual(result, { ...entry, writes: [], samples: [] })
  }
})

test('three missed windows preserve every raw attempt and fail the coordinate', () => {
  const discarded = []
  const coordinate = { run: 4, screen: 'claude-work', scenario: 'entryPrepend' }
  for (const attempt of [0, 1]) recordMissedEntry(discarded, { ...coordinate, attempt }, late)
  assert.throws(
    () => recordMissedEntry(discarded, { ...coordinate, attempt: 2 }, late),
    /Could not deliver entry input/
  )
  assert.deepEqual(
    discarded,
    [0, 1, 2].map((attempt) => ({
      ...coordinate,
      attempt,
      reason: 'within-unit-request-after-bottom',
      ...late
    }))
  )
})
