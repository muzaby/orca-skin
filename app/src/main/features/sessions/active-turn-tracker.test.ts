import { describe, expect, it } from 'vitest'
import { ActiveTurnTracker } from './active-turn-tracker'

describe('ActiveTurnTracker', () => {
  it('tracks per-project counts and emits changes', () => {
    const events: Array<[string, number]> = []
    const registry = new ActiveTurnTracker((projectId, count) => events.push([projectId, count]))

    expect(registry.getCount('p1')).toBe(0)
    registry.increment('p1')
    registry.increment('p1')
    registry.increment('p2')
    expect(registry.getCount('p1')).toBe(2)
    expect(registry.getCount('p2')).toBe(1)

    registry.decrement('p1')
    registry.decrement('p1')
    registry.decrement('p1')
    expect(registry.getCount('p1')).toBe(0)
    expect(events).toEqual([
      ['p1', 1],
      ['p1', 2],
      ['p2', 1],
      ['p1', 1],
      ['p1', 0],
      ['p1', 0]
    ])
  })
})
