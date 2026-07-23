import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeComposerInputTrace, traceEventsFrom } from './analyze-composer-input-trace.mjs'

function input(ts, dur = 1_000, pid = 1, tid = 2) {
  return {
    name: 'EventDispatch',
    ph: 'X',
    ts,
    dur,
    pid,
    tid,
    args: { data: { type: 'input' } }
  }
}

function event(name, ts, dur = 0, pid = 1, tid = 2) {
  return { name, ph: 'X', ts, dur, pid, tid, args: {} }
}

describe('analyzeComposerInputTrace', () => {
  it('accepts raw arrays and DevTools trace objects', () => {
    const events = [input(1_000)]
    assert.equal(traceEventsFrom(events), events)
    assert.equal(traceEventsFrom({ traceEvents: events }), events)
    assert.throws(() => traceEventsFrom({}), /traceEvents/)
  })

  it('matches each input to the next paint on the renderer main thread', () => {
    const result = analyzeComposerInputTrace(
      {
        traceEvents: [
          input(1_000),
          event('Paint', 1_500),
          event('Paint', 11_000, 0, 9, 9),
          event('Paint', 12_000),
          input(20_000),
          event('Paint', 30_000)
        ]
      },
      'pr-idle'
    )

    assert.deepEqual(result, {
      label: 'pr-idle',
      metric: 'EventDispatch(input) start to next same-thread Paint start',
      inputEvents: 2,
      matchedSamples: 2,
      unmatchedSamples: 0,
      p50Ms: 10,
      p95Ms: 11,
      maxMs: 11,
      longTasksOver50Ms: 0,
      longestTaskMs: null
    })
  })

  it('reports unmatched inputs and long tasks overlapping the sample window', () => {
    const result = analyzeComposerInputTrace({
      traceEvents: [
        input(100_000),
        event('RunTask', 90_000, 60_000),
        event('Paint', 115_000),
        input(200_000),
        event('RunTask', 250_000, 80_000),
        event('RunTask', 100_000, 90_000, 7, 8)
      ]
    })

    assert.equal(result.inputEvents, 2)
    assert.equal(result.matchedSamples, 1)
    assert.equal(result.unmatchedSamples, 1)
    assert.equal(result.p95Ms, 15)
    assert.equal(result.longTasksOver50Ms, 1)
    assert.equal(result.longestTaskMs, 60)
  })
})
