import { expect, it, vi } from 'vitest'
import { nativeSettingsShutdown, registerNativeSettingsQuit } from './native-settings-lifecycle'
it('freezes admission and drains saves once before stopping owners and removing their files', async () => {
  const gate = Promise.withResolvers<void>()
  const order: string[] = []
  const shutdown = nativeSettingsShutdown({
    freeze: () => {
      order.push('freeze')
    },
    drain: async () => {
      await gate.promise
      order.push('saved')
    },
    shutdown: () => {
      order.push('runtime')
    },
    cleanup: vi.fn(async () => {
      order.push('files')
    })
  })
  const first = shutdown()
  expect(shutdown()).toBe(first)
  expect(order).toEqual(['freeze'])
  gate.resolve()
  await first
  expect(order).toEqual(['freeze', 'saved', 'runtime', 'files'])
})

it('defers actual before-quit events once until accepted saves finish, then permits final quit', async () => {
  const gate = Promise.withResolvers<void>()
  const prepare = vi.fn(() => gate.promise)
  let listener!: (event: { preventDefault(): void }) => void
  const app = {
    on: (_event: string, callback: typeof listener) => {
      listener = callback
    },
    quit: vi.fn()
  }
  const failed = vi.fn()
  registerNativeSettingsQuit(app, prepare, failed)
  const event = { preventDefault: vi.fn() }
  listener(event)
  listener(event)
  expect(prepare).toHaveBeenCalledOnce()
  expect(event.preventDefault).toHaveBeenCalledTimes(2)
  expect(app.quit).not.toHaveBeenCalled()
  gate.resolve()
  for (let i = 0; i < 10; i++) await Promise.resolve()
  expect(app.quit).toHaveBeenCalledOnce()
  listener(event)
  expect(event.preventDefault).toHaveBeenCalledTimes(2)
  expect(failed).not.toHaveBeenCalled()
})
