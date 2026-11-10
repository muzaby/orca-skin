import { expect, it } from 'vitest'
import { joinsRunningSync, normalizeSyncMode, syncPlan } from './sync-mode'

it('normalizes untrusted modes and plans both independent full operations', () => {
  expect(normalizeSyncMode('full')).toBe('full')
  for (const value of ['incremental', undefined, 'all', '', 1, null])
    expect(normalizeSyncMode(value)).toBe('incremental')
  expect(syncPlan('incremental')).toEqual({ bypassFreshness: false, refetchKnown: false })
  expect(syncPlan('full')).toEqual({ bypassFreshness: true, refetchKnown: true })
})

it('joins only a running mode that satisfies the request', () => {
  expect(joinsRunningSync('incremental', 'incremental')).toBe(true)
  expect(joinsRunningSync('full', 'incremental')).toBe(true)
  expect(joinsRunningSync('full', 'full')).toBe(true)
  expect(joinsRunningSync('incremental', 'full')).toBe(false)
})
