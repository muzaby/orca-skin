import { errorToastStore } from '../errors/errorToastStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTweakStore } from './TweakProvider'
import { bootApi, settingsApi } from '../api/ipc'
import { SettingsSchema } from '../../../../shared/protocol'

vi.mock('../api/ipc', () => ({
  settingsApi: { get: vi.fn(), set: vi.fn() },
  bootApi: { whenReady: vi.fn() }
}))

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
  vi.mocked(bootApi.whenReady).mockReset().mockResolvedValue(undefined)
  for (const { id } of errorToastStore.getState().toasts) errorToastStore.getState().dismiss(id)
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
    expect(errorToastStore.getState().toasts[0]).toMatchObject({
      title: 'saveFailed',
      detail: 'save failed'
    })
    for (const { id } of errorToastStore.getState().toasts) errorToastStore.getState().dismiss(id)
    expect(vi.mocked(settingsApi.set).mock.calls).toEqual([
      [{ theme: 'dark' }],
      [{ uiLocale: 'en' }]
    ])
  })

  // 0244 — 재시작 직후 첫 읽기가 거절돼도(부팅 중 핸들러 미등록) 저장값이 적용돼야 한다.
  it('retries once after main boot when the first read fails, then applies the saved settings', async () => {
    const store = createTweakStore()
    const initial = store.getState().t
    const ready = deferred<void>()
    vi.mocked(bootApi.whenReady).mockReturnValueOnce(ready.promise)
    vi.mocked(settingsApi.get)
      .mockRejectedValueOnce(new Error("No handler registered for 'orca:settings:get'"))
      .mockResolvedValueOnce({ ...SettingsSchema.parse({}), ...initial, theme: 'dark' })
    const cleanup = store.load()
    await Promise.resolve()
    await Promise.resolve()
    // 부팅 완료 전에는 재시도하지 않는다.
    expect(settingsApi.get).toHaveBeenCalledTimes(1)
    expect(store.getState().t).toBe(initial)
    ready.resolve()
    await vi.waitFor(() => expect(store.getState().t.theme).toBe('dark'))
    expect(settingsApi.get).toHaveBeenCalledTimes(2)
    expect(bootApi.whenReady).toHaveBeenCalledOnce()
    expect(errorToastStore.getState().toasts).toHaveLength(0)
    cleanup()
  })

  it('reports loadFailed and keeps the defaults when the retry also fails', async () => {
    const store = createTweakStore()
    const initial = store.getState().t
    vi.mocked(settingsApi.get)
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
    const cleanup = store.load()
    await vi.waitFor(() =>
      expect(errorToastStore.getState().toasts[0]).toMatchObject({
        title: 'loadFailed',
        detail: 'second'
      })
    )
    expect(store.getState().t).toBe(initial)
    expect(settingsApi.get).toHaveBeenCalledTimes(2)
    cleanup()
  })

  it('reports loadFailed without a second read when main boot itself fails', async () => {
    const store = createTweakStore()
    const initial = store.getState().t
    vi.mocked(settingsApi.get).mockRejectedValueOnce(new Error('first'))
    vi.mocked(bootApi.whenReady).mockRejectedValueOnce(new Error('boot failed'))
    const cleanup = store.load()
    await vi.waitFor(() =>
      expect(errorToastStore.getState().toasts[0]).toMatchObject({
        title: 'loadFailed',
        detail: 'boot failed'
      })
    )
    expect(settingsApi.get).toHaveBeenCalledOnce()
    expect(store.getState().t).toBe(initial)
    cleanup()
  })

  it('stops the retry chain once the provider is disposed', async () => {
    const store = createTweakStore()
    const initial = store.getState().t
    const ready = deferred<void>()
    vi.mocked(bootApi.whenReady).mockReturnValueOnce(ready.promise)
    vi.mocked(settingsApi.get)
      .mockRejectedValueOnce(new Error('first'))
      .mockResolvedValueOnce({ ...SettingsSchema.parse({}), ...initial, theme: 'dark' })
    const cleanup = store.load()
    await vi.waitFor(() => expect(bootApi.whenReady).toHaveBeenCalledOnce())
    cleanup()
    ready.resolve()
    await ready.promise
    await Promise.resolve()
    expect(settingsApi.get).toHaveBeenCalledOnce()
    expect(store.getState().t).toBe(initial)
    expect(errorToastStore.getState().toasts).toHaveLength(0)
  })
})
