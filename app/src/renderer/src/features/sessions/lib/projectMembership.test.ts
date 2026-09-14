import { describe, expect, it } from 'vitest'
import type { SessionListItem } from '../../../../../shared/ipc'
import { reconcileProjectMembership } from './projectMembership'

function session(id: string, projectId: string | null, updatedAt: number): SessionListItem {
  return {
    id,
    projectId,
    updatedAt,
    title: id,
    agentKind: 'code',
    backend: 'claude',
    preview: null,
    cwd: null,
    pinnedAt: null
  }
}

describe('reconcileProjectMembership', () => {
  it('preserves project history, removes moved or missing IDs, deduplicates and sorts recent additions', () => {
    const current = { p: ['old', 'moved', 'missing', 'new'], q: [] }
    const byId = {
      old: session('old', 'p', 1),
      new: session('new', 'p', 3),
      moved: session('moved', 'q', 2),
      newest: session('newest', 'p', 4)
    }
    expect(reconcileProjectMembership(current, byId, ['newest', 'new', 'new', 'moved'])).toEqual({
      p: ['newest', 'new', 'old'],
      q: ['moved']
    })
    expect(current).toEqual({ p: ['old', 'moved', 'missing', 'new'], q: [] })
  })

  it('retains stable order for equal timestamps and untouched arrays for unrelated projects', () => {
    const current = { p: ['second', 'first'], empty: [] }
    const byId = {
      first: session('first', 'p', 1),
      second: session('second', 'p', 1),
      new: session('new', 'p', 1)
    }
    const result = reconcileProjectMembership(current, byId, ['first', 'new'])
    expect(result.p).toEqual(['second', 'first', 'new'])
    expect(result.empty).toBe(current.empty)
  })

  it('returns the same record and arrays when membership and order do not change', () => {
    const current = { p: ['one'], empty: [] }
    const result = reconcileProjectMembership(current, { one: session('one', 'p', 1) }, ['one'])
    expect(result).toBe(current)
    expect(result.p).toBe(current.p)
    expect(result.empty).toBe(current.empty)
  })

  it('keeps absent project keys absent even when recent contains their sessions', () => {
    const current = { empty: [] }
    expect(
      reconcileProjectMembership(current, { one: session('one', 'unqueried', 1) }, ['one'])
    ).toBe(current)
    expect(Object.hasOwn(current, 'unqueried')).toBe(false)
  })
})
