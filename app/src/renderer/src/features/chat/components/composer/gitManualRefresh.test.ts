import { expect, it, vi } from 'vitest'
import {
  createGitSnapshotQueryOwner,
  gitStatusQueryReason,
  gitSummaryQueryReason
} from './useGitSnapshot'

it('manual refresh requests status and summary before the first turn; remount stays quiet', () => {
  const previous = { identity: 'repo', tick: 0, refreshTick: 0 }
  const next = { ...previous, refreshTick: 1 }
  expect(gitSummaryQueryReason(null, previous)).toBeNull()
  expect(gitSummaryQueryReason(previous, next)).toBe('manual')
  expect(gitStatusQueryReason(previous, next)).toBe('manual')
  expect(gitSummaryQueryReason(next, next)).toBeNull()
})

it('a failed current request is reported and can be retried', async () => {
  const fail = vi.fn()
  const start = vi.fn()
  const owner = createGitSnapshotQueryOwner()
  owner.run('repo', () => Promise.reject(new Error('offline')), start, vi.fn(), fail)
  await Promise.resolve()
  await Promise.resolve()
  expect(fail).toHaveBeenCalledWith(start.mock.calls[0][0])
})
