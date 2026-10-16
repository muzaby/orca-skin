import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAutomaticFeedVisibility, setAutomaticFeedVisibility } from './automaticFeedDebug'

afterEach(() => {
  vi.stubEnv('DEV', true)
  setAutomaticFeedVisibility(false)
  vi.unstubAllEnvs()
})

describe('automatic feed debug memory', () => {
  it('starts disabled, toggles in memory, and a fresh module starts disabled again', async () => {
    expect(getAutomaticFeedVisibility()).toBe(false)
    setAutomaticFeedVisibility(true)
    expect(getAutomaticFeedVisibility()).toBe(true)
    setAutomaticFeedVisibility(false)
    expect(getAutomaticFeedVisibility()).toBe(false)
    setAutomaticFeedVisibility(true)
    vi.resetModules()
    const fresh = await import('./automaticFeedDebug')
    expect(fresh.getAutomaticFeedVisibility()).toBe(false)
  })

  it('production refuses activation even when memory was previously enabled', () => {
    setAutomaticFeedVisibility(true)
    vi.stubEnv('DEV', false)
    expect(getAutomaticFeedVisibility()).toBe(false)
    setAutomaticFeedVisibility(true)
    expect(getAutomaticFeedVisibility()).toBe(false)
  })
})
