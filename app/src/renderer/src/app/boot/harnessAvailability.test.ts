import { afterEach, expect, it, vi } from 'vitest'
import type { HarnessAvailability } from '../../../../shared/ipc'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})
it('applies production harness API pushes and preserves a newer push over a deferred backend list', async () => {
  vi.resetModules()
  const list = Promise.withResolvers<{ backends: HarnessAvailability[] }>()
  let push!: (state: HarnessAvailability) => void
  vi.stubGlobal('window', {
    oo: {
      backend: { list: vi.fn(() => list.promise) },
      harness: {
        onAvailability: vi.fn((handler) => {
          push = handler
          return () => {}
        })
      }
    }
  })
  const { useHarnessAvailabilityStore: store } =
    await import('../../shared/stores/harnessAvailabilityStore')
  const { initBackend } = await import('../../features/backend/store/backendStore')
  const pending = initBackend()
  const unsupported: HarnessAvailability = {
    id: 'opencode',
    installed: true,
    version: '2.0.0',
    usable: false,
    unavailableReason: 'unsupported'
  }
  push(unsupported)
  expect(store.getState().byId.opencode).toEqual(unsupported)
  const usable: HarnessAvailability = {
    id: 'opencode',
    installed: true,
    version: '1.19.0',
    usable: true
  }
  push(usable)
  expect(store.getState().byId.opencode).toEqual(usable)
  list.resolve({
    backends: [{ id: 'opencode', installed: false, usable: false, unavailableReason: 'missing' }]
  })
  await pending
  expect(store.getState().byId.opencode).toEqual(usable)
  expect(window.oo.harness.onAvailability).toHaveBeenCalledOnce()
})
