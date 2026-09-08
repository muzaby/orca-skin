import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTweakStore } from './TweakProvider'
import { settingsApi } from '../api/ipc'
import { SettingsSchema } from '../../../../shared/protocol'

vi.mock('../api/ipc', () => ({ settingsApi: { get: vi.fn(), set: vi.fn() } }))

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.mocked(settingsApi.get).mockReset()
  vi.mocked(settingsApi.set).mockReset().mockResolvedValue(SettingsSchema.parse({}))
})

describe('provider-owned Tweaks store', () => {
  it('starts with the existing defaults and isolates provider instances', () => {
    const first = createTweakStore()
    const second = createTweakStore()
    expect(first.getState().t).toEqual({
      theme: 'white',
      density: 'normal',
      sidebarCollapsed: false,
      sidebarWidth: 248,
      appFont: 'sans',
      uiLocale: 'ko',
      notifyOnComplete: false,
      spendingLimitUsd: 90
    })
    const patch = first.getState().setTweak
    patch('sidebarWidth', 300)
    expect(first.getState().t.sidebarWidth).toBe(300)
    expect(second.getState().t.sidebarWidth).toBe(248)
    expect(first.getState().setTweak).toBe(patch)
    expect(settingsApi.set).toHaveBeenCalledExactlyOnceWith({ sidebarWidth: 300 })
    expect(settingsApi.get).not.toHaveBeenCalled()
  })

  it('loads the settings projection, cancels only that request, and supports effect remount', async () => {
    const first = deferred<Awaited<ReturnType<typeof settingsApi.get>>>()
    const next = deferred<Awaited<ReturnType<typeof settingsApi.get>>>()
    vi.mocked(settingsApi.get).mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise)
    const store = createTweakStore()
    const initial = store.getState().t
    const cleanup = store.load()
    cleanup()
    const cleanupNext = store.load()
    first.resolve({ ...SettingsSchema.parse({}), ...initial, theme: 'dark' })
    await first.promise
    expect(store.getState().t).toBe(initial)
    next.resolve({
      ...SettingsSchema.parse({}),
      ...initial,
      uiLocale: 'en',
      sidebarWidth: 400,
      lastSessionId: 'outside-tweaks-projection'
    })
    await next.promise
    expect(store.getState().t).toEqual({ ...initial, uiLocale: 'en', sidebarWidth: 400 })
    expect(settingsApi.get).toHaveBeenCalledTimes(2)
    cleanupNext()
  })

  it('preserves whole previous snapshot rollback and one IPC per patch', async () => {
    const first = deferred<Awaited<ReturnType<typeof settingsApi.set>>>()
    vi.mocked(settingsApi.set).mockReturnValueOnce(first.promise)
    const store = createTweakStore()
    const previous = store.getState().t
    store.getState().setTweak('theme', 'dark')
    store.getState().setTweak('uiLocale', 'en')
    expect(store.getState().t).toEqual({ ...previous, theme: 'dark', uiLocale: 'en' })
    first.reject(new Error('save failed'))
    await first.promise.catch(() => {})
    expect(store.getState().t).toBe(previous)
    expect(vi.mocked(settingsApi.set).mock.calls).toEqual([
      [{ theme: 'dark' }],
      [{ uiLocale: 'en' }]
    ])
  })
})
