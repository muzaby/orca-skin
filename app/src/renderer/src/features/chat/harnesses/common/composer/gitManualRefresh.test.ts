import { expect, it, vi } from 'vitest'
import { createGitSnapshotQueryOwner } from './useGitSnapshot'

it('a failed current request is reported and can be retried', async () => {
  const fail = vi.fn()
  const start = vi.fn()
  const owner = createGitSnapshotQueryOwner()
  owner.run('repo', () => Promise.reject(new Error('offline')), start, vi.fn(), fail)
  await Promise.resolve()
  await Promise.resolve()
  expect(fail).toHaveBeenCalledWith(start.mock.calls[0][0])
})
