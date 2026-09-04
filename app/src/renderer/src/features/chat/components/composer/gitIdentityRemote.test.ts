import { expect, it, vi } from 'vitest'
import { createGitIdentityRemoteCache } from './useGitIdentityRemote'

const url = 'https://company.github.com/owner/repo'

it('reuses a completed lookup when the repository or branch menu is reopened', async () => {
  const load = vi.fn().mockResolvedValue({ githubUrl: url })
  const cache = createGitIdentityRemoteCache('/repo', load)
  await cache.ensure()
  const ready = cache.getSnapshot()
  expect(ready).toEqual({ phase: 'ready', url })
  await cache.ensure()
  await cache.ensure()
  expect(cache.getSnapshot()).toBe(ready)
  expect(load).toHaveBeenCalledExactlyOnceWith('/repo')
})

it('shares an in-flight lookup across close/reopen and keeps the completed result', async () => {
  let resolve!: (value: { githubUrl: string }) => void
  const load = vi.fn(
    () =>
      new Promise<{ githubUrl: string }>((done) => {
        resolve = done
      })
  )
  const cache = createGitIdentityRemoteCache('/repo', load)
  const listener = vi.fn()
  const unsubscribe = cache.subscribe(listener)
  const first = cache.ensure()
  await Promise.resolve()
  unsubscribe()
  expect(cache.ensure()).toBe(first)
  resolve({ githubUrl: url })
  await first
  expect(listener).not.toHaveBeenCalled()
  expect(cache.getSnapshot()).toEqual({ phase: 'ready', url })
  await cache.ensure()
  expect(load).toHaveBeenCalledTimes(1)
})

it('caches a completed missing or unsupported remote until the owner is refreshed', async () => {
  const load = vi.fn().mockResolvedValue({ githubUrl: null })
  const cache = createGitIdentityRemoteCache('/repo', load)
  await cache.ensure()
  await cache.ensure()
  expect(cache.getSnapshot()).toEqual({ phase: 'unavailable', url: null })
  expect(load).toHaveBeenCalledTimes(1)
  load.mockResolvedValue({ githubUrl: url })
  const refreshed = createGitIdentityRemoteCache('/repo', load)
  await refreshed.ensure()
  expect(refreshed.getSnapshot()).toEqual({ phase: 'ready', url })
  expect(load).toHaveBeenCalledTimes(2)
})

it('retries a failed lookup on the next menu open', async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(Error('failed'))
    .mockResolvedValueOnce({ githubUrl: url })
  const cache = createGitIdentityRemoteCache('/repo', load)
  await cache.ensure()
  expect(cache.getSnapshot()).toEqual({ phase: 'error', url: null })
  const retry = cache.ensure()
  expect(cache.getSnapshot()).toEqual({ phase: 'loading', url: null })
  await retry
  expect(cache.getSnapshot()).toEqual({ phase: 'ready', url })
  expect(load).toHaveBeenCalledTimes(2)
})

it('an old context completion cannot notify or overwrite the new context', async () => {
  let resolve!: (value: { githubUrl: string }) => void
  const old = createGitIdentityRemoteCache(
    '/old',
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const oldListener = vi.fn()
  const unsubscribe = old.subscribe(oldListener)
  const pending = old.ensure()
  await Promise.resolve()
  unsubscribe()
  const current = createGitIdentityRemoteCache('/new', async () => ({ githubUrl: url }))
  await current.ensure()
  resolve({ githubUrl: 'https://github.com/old/repo' })
  await pending
  expect(current.getSnapshot()).toEqual({ phase: 'ready', url })
  expect(oldListener).not.toHaveBeenCalled()
})
