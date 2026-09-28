import { describe, expect, it } from 'vitest'
import type { AppErrorReport } from '../../../../shared/app-error'
import { applyErrorReport } from './errorToastModel'

const report = (id: string, detail = id): AppErrorReport => ({
  id,
  title: 'unexpected',
  detail,
  origin: 'renderer'
})

describe('error toast model', () => {
  it('replaces a merged target including removal without changing the key, id or card count', () => {
    let state = applyErrorReport(
      [],
      { ...report('a'), target: { kind: 'page', path: '/plugins' } },
      0
    ).state
    const key = state[0].key
    const next = { kind: 'settings', tab: 'usage' } as const
    expect(applyErrorReport(state, { ...report('b', 'a'), target: next }, 500).state).toBe(state)
    state = applyErrorReport(state, { ...report('b', 'a'), target: next }, 1200).state
    expect(state).toHaveLength(1)
    expect(state[0]).toMatchObject({ id: 'a', key, target: next, seq: 1 })
    state = applyErrorReport(state, report('c', 'a'), 2400).state
    expect(state).toHaveLength(1)
    expect(state[0]).toMatchObject({ id: 'a', key, seq: 2 })
    expect(state[0].target).toBeUndefined()
  })
  it('keeps the newest three in order', () => {
    let state = applyErrorReport([], report('a'), 0).state
    for (const id of ['b', 'c', 'd']) state = applyErrorReport(state, report(id), 0).state
    expect(state.map((r) => r.id)).toEqual(['d', 'c', 'b'])
  })
  it('merges by title and detail, restarts after cooldown, and ignores rapid hits', () => {
    const initial = applyErrorReport([], report('a', 'same'), 0)
    expect(applyErrorReport(initial.state, report('b', 'same'), 500)).toEqual({
      state: initial.state,
      expire: []
    })
    const next = applyErrorReport(initial.state, report('c', 'same'), 1200)
    expect(next.state).toHaveLength(1)
    expect(next.state[0]).toMatchObject({ id: 'a', seq: 1, lastHitAt: 1200 })
    expect(next.expire).toEqual([{ id: 'a', at: 5800 }])
    expect(
      applyErrorReport(next.state, { ...report('d', 'same'), title: 'loadFailed' }, 1200).state
    ).toHaveLength(2)
  })
})
