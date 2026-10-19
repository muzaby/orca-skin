import { describe, expect, it } from 'vitest'
import { planGitSnapshotQuery } from './useGitSnapshot'

const start = { statusKey: 'repo', summaryKey: 'session', tick: 0, refreshTick: 0 }
describe('snapshot query plan', () => {
  it('initial and cwd changes fetch status only; session-only switches do not query', () => {
    expect(planGitSnapshotQuery(null, start)).toEqual({ includeSummary: false })
    expect(
      planGitSnapshotQuery(start, { ...start, statusKey: 'new', summaryKey: 'new', tick: 8 })
    ).toEqual({ includeSummary: false })
    expect(planGitSnapshotQuery(start, { ...start, summaryKey: 'new', tick: 8 })).toBeNull()
  })
  it('turn end and manual refresh fetch both once; idle/busy changes do not query', () => {
    expect(planGitSnapshotQuery(start, { ...start, tick: 1 })).toEqual({ includeSummary: true })
    expect(planGitSnapshotQuery(start, { ...start, refreshTick: 1 })).toEqual({
      includeSummary: true
    })
    expect(planGitSnapshotQuery(start, { ...start, refreshTick: 1, tick: 1 })).toEqual({
      includeSummary: true
    })
    expect(planGitSnapshotQuery(start, start)).toBeNull()
    const busy = { ...start, busy: true }
    expect(planGitSnapshotQuery(busy, { ...start })).toBeNull()
  })
})
