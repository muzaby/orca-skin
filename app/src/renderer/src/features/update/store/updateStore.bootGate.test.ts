import { afterEach, expect, it, vi } from 'vitest'
vi.hoisted(() => {
  vi.stubGlobal('__APP_VERSION__', '0.0.0')
})
import { initUpdate, useUpdateStore } from './updateStore'

afterEach(() => vi.unstubAllGlobals())

it.each([true, false])('0304 update lookup waits for readiness (%s)', async (success) => {
  let ready!: () => void
  let fail!: (reason: Error) => void
  const pending = new Promise<void>((resolve, reject) => {
    ready = resolve
    fail = reject
  })
  const next = { status: 'idle' as const, currentVersion: '3.4.5', canInstall: false }
  const state = vi.fn().mockResolvedValue(next)
  useUpdateStore.setState({ dummyMode: false, actionError: null })
  vi.stubGlobal('window', { oo: { boot: { whenReady: () => pending }, update: { state } } })
  const initialized = initUpdate()
  expect(state).not.toHaveBeenCalled()
  await Promise.resolve()
  await Promise.resolve()
  expect(state).not.toHaveBeenCalled()
  if (success) ready()
  else fail(new Error('boot failed'))
  await initialized
  expect(state).toHaveBeenCalledTimes(success ? 1 : 0)
  expect(useUpdateStore.getState().actionError).toBeNull()
  if (success) expect(useUpdateStore.getState().state).toEqual(next)
})
