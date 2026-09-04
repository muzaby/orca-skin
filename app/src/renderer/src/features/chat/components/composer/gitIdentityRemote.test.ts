import { expect, it, vi } from 'vitest'
import { queryGitIdentityRemote } from './useGitIdentityRemote'

it('reads the current cwd instead of using a cached empty URL', async () => {
  const load = vi.fn().mockResolvedValue({ githubUrl: 'https://github.com/owner/repo' })
  const result = vi.fn()
  queryGitIdentityRemote('/repo', load, result)
  await vi.waitFor(() =>
    expect(result).toHaveBeenCalledWith({ phase: 'ready', url: 'https://github.com/owner/repo' })
  )
  expect(load).toHaveBeenCalledExactlyOnceWith('/repo')
})

it('distinguishes failed lookup from unsupported/missing GitHub URL and ignores closed menus', async () => {
  const failed = vi.fn()
  queryGitIdentityRemote('/repo', () => Promise.reject(Error('failed')), failed)
  await vi.waitFor(() => expect(failed).toHaveBeenCalledWith({ phase: 'error', url: null }))
  const unsupported = vi.fn()
  queryGitIdentityRemote('/repo', () => Promise.resolve({ githubUrl: null }), unsupported)
  await vi.waitFor(() =>
    expect(unsupported).toHaveBeenCalledWith({ phase: 'unavailable', url: null })
  )
  const late = vi.fn()
  let resolve!: (value: { githubUrl: string }) => void
  const cancel = queryGitIdentityRemote(
    '/old',
    () =>
      new Promise((done) => {
        resolve = done
      }),
    late
  )
  await Promise.resolve()
  cancel()
  resolve({ githubUrl: 'https://github.com/old/repo' })
  await Promise.resolve()
  expect(late).not.toHaveBeenCalled()
})
