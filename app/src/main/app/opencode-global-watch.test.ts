import { afterEach, expect, it, vi } from 'vitest'
import { OpenCodeGlobalWatch } from './opencode-global-watch'

const fs = vi.hoisted(() => ({ watchFile: vi.fn(), unwatchFile: vi.fn() }))
vi.mock('node:fs', () => fs)
afterEach(() => vi.clearAllMocks())

it("fans out once per external plugin change and ignores Orca's own write", async () => {
  let fingerprint = 'original'
  const changed = vi.fn()
  const watcher = new OpenCodeGlobalWatch({
    files: ['a', 'b', 'c'],
    fingerprint: async () => fingerprint,
    reconcilePlugins: async () => {},
    changed,
    failed: vi.fn()
  })
  await watcher.check()
  expect(fs.watchFile).toHaveBeenCalledTimes(3)
  const callback = fs.watchFile.mock.calls[0][2] as () => void
  fingerprint = 'external'
  callback()
  for (let i = 0; i < 20; i++) await Promise.resolve()
  expect(changed).toHaveBeenCalledExactlyOnceWith(1)
  await watcher.change(async () => {
    fingerprint = 'own write'
  })
  callback()
  for (let i = 0; i < 20; i++) await Promise.resolve()
  expect(changed.mock.calls).toEqual([[1], [2]])
  watcher.close()
  expect(fs.unwatchFile.mock.calls.map(([file]) => file)).toEqual(['a', 'b', 'c'])
  fingerprint = 'after close'
  callback()
  for (let i = 0; i < 20; i++) await Promise.resolve()
  expect(changed).toHaveBeenCalledTimes(2)
})

it('clears a record when the plugin is re-added externally', async () => {
  let present = false,
    record = true
  const changed = vi.fn()
  const watcher = new OpenCodeGlobalWatch({
    files: [],
    fingerprint: async () => JSON.stringify(present),
    reconcilePlugins: async () => {
      if (present) record = false
    },
    changed,
    failed: vi.fn()
  })
  await watcher.check()
  present = true
  await watcher.check()
  expect(record).toBe(false)
  present = false
  await watcher.check()
  expect(record).toBe(false)
  expect(changed).toHaveBeenCalledTimes(2)
  watcher.close()
})

it('drains admitted plugin writes before closing and rejects later writes', async () => {
  const gate = Promise.withResolvers<string>()
  const write = vi.fn(async () => {})
  const watcher = new OpenCodeGlobalWatch({
    files: [],
    fingerprint: () => gate.promise,
    reconcilePlugins: async () => {},
    changed: vi.fn(),
    failed: vi.fn()
  })
  const pending = watcher.change(write)
  const drained = watcher.drain()
  await expect(watcher.change(write)).rejects.toThrow('종료')
  expect(write).not.toHaveBeenCalled()
  gate.resolve('original')
  await Promise.all([pending, drained])
  expect(write).toHaveBeenCalledOnce()
})
