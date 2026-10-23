import { expect, it, vi } from 'vitest'
import { ComposerAgentCache } from './composerAgentCache'

it('keeps the first accepted list and notifies each subscriber once', () => {
  const cache = new ComposerAgentCache(),
    one = vi.fn(),
    two = vi.fn()
  cache.subscribe(one)
  const unsubscribe = cache.subscribe(two)
  expect(cache.get()).toBeUndefined()
  expect(cache.accept([{ name: 'first' }])).toEqual([{ name: 'first' }])
  expect(cache.accept([{ name: 'late' }])).toEqual([{ name: 'first' }])
  expect(one).toHaveBeenCalledOnce()
  expect(two).toHaveBeenCalledOnce()
  unsubscribe()
  cache.reset(1)
  expect(two).toHaveBeenCalledOnce()
})

it('resets once for a newer revision and ignores stale revisions', () => {
  const cache = new ComposerAgentCache(),
    listener = vi.fn()
  cache.accept([])
  cache.subscribe(listener)
  expect(cache.reset(1)).toBe(true)
  expect(cache.get()).toBeUndefined()
  expect(cache.accept([{ name: 'stale' }], 0)).toBeUndefined()
  expect(cache.accept([{ name: 'fresh' }], 1)).toEqual([{ name: 'fresh' }])
  expect(cache.reset(1)).toBe(false)
  expect(cache.reset(0)).toBe(false)
  expect(listener).toHaveBeenCalledTimes(2)
  expect(cache.get()).toEqual([{ name: 'fresh' }])
})
