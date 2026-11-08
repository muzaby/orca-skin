import { describe, expect, it, vi } from 'vitest'
import { ActiveTurnTracker } from './active-turn-tracker'

const r1 = { sessionId: null, clientKey: 'draft:a' }
const r2 = { sessionId: 's2', clientKey: null }
const r3 = { sessionId: 's3', clientKey: null }

describe('ActiveTurnTracker', () => {
  it('T1 ignores missing projects and duplicate tokens, keeps begin order and projects separate', () => {
    const changed = vi.fn()
    const tracker = new ActiveTurnTracker(changed)
    const t1 = {},
      t2 = {},
      t3 = {}
    tracker.begin(t1, null, r1)
    tracker.begin(t1, undefined, r1)
    expect(changed).not.toHaveBeenCalled()
    tracker.begin(t1, 'p1', r1)
    tracker.begin(t1, 'p2', r2)
    expect(changed).toHaveBeenCalledTimes(1)
    tracker.begin(t2, 'p1', r2)
    tracker.begin(t3, 'p2', r3)
    expect(changed.mock.calls.map(([event]) => event)).toEqual([
      { projectId: 'p1', turns: [r1] },
      { projectId: 'p1', turns: [r1, r2] },
      { projectId: 'p2', turns: [r3] }
    ])
    expect(tracker.turns('p1')).toEqual([r1, r2])
    expect(tracker.turns('p2')).toEqual([r3])
  })

  it('T2 confirms a pending identity once, preserving its client key', () => {
    const changed = vi.fn()
    const tracker = new ActiveTurnTracker(changed)
    const t1 = {},
      t2 = {}
    tracker.confirm({}, 'missing')
    expect(changed).not.toHaveBeenCalled()
    tracker.begin(t1, 'p1', r1)
    tracker.begin(t2, 'p2', r2)
    changed.mockClear()
    tracker.confirm(t1, 's1')
    expect(changed).toHaveBeenCalledExactlyOnceWith({
      projectId: 'p1',
      turns: [{ sessionId: 's1', clientKey: 'draft:a' }]
    })
    tracker.confirm(t1, 's1')
    tracker.confirm(t1, 'different')
    tracker.confirm(t2, 'different')
    expect(changed).toHaveBeenCalledTimes(1)
    expect(tracker.turns('p2')).toEqual([r2])
  })

  it('T3 removes only its token, retains order and emits the final empty list once', () => {
    const changed = vi.fn()
    const tracker = new ActiveTurnTracker(changed)
    const t1 = {},
      t2 = {},
      t3 = {}
    tracker.end({})
    expect(changed).not.toHaveBeenCalled()
    tracker.begin(t1, 'p1', r1)
    tracker.begin(t2, 'p1', r2)
    tracker.begin(t3, 'p1', r3)
    tracker.end(t2)
    expect(tracker.turns('p1')).toEqual([r1, r3])
    tracker.end(t1)
    tracker.end(t3)
    expect(changed).toHaveBeenLastCalledWith({ projectId: 'p1', turns: [] })
    const count = changed.mock.calls.length
    tracker.end(t3)
    expect(changed).toHaveBeenCalledTimes(count)
    // The token may be reused on a retry after finally removed it.
    tracker.begin(t1, 'p1', r1)
    expect(tracker.turns('p1')).toEqual([r1])
  })

  it('T4 returns snapshots detached from input, output and emitted references', () => {
    const changed = vi.fn()
    const tracker = new ActiveTurnTracker(changed)
    expect(tracker.turns(null)).toEqual([])
    expect(tracker.turns(undefined)).toEqual([])
    expect(tracker.turns('missing')).toEqual([])
    const input = { ...r1 }
    tracker.begin({}, 'p1', input)
    input.clientKey = 'changed'
    const output = tracker.turns('p1')
    output[0].clientKey = 'changed'
    output.push(r2)
    changed.mock.calls[0][0].turns[0].sessionId = 'changed'
    expect(tracker.turns('p1')).toEqual([r1])
  })
})
