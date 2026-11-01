import { expect, it, vi } from 'vitest'
import { FingerprintWatch } from './fingerprint-watch'

it('serializes checks, notifies once for a changed fingerprint and releases every file on close', async () => {
  let value = 'initial'
  const callbacks: Array<() => void> = []
  const stop = vi.fn()
  const changed = vi.fn()
  const watcher = new FingerprintWatch({
    files: ['one', 'two'],
    interval: 250,
    watch: (_file, callback) => {
      callbacks.push(callback)
      return stop
    },
    fingerprint: async () => value,
    changed,
    failed: vi.fn()
  })
  await watcher.check()
  callbacks[0]()
  callbacks[1]()
  await watcher.check()
  expect(changed).not.toHaveBeenCalled()
  value = 'changed'
  callbacks[0]()
  callbacks[1]()
  await watcher.check()
  expect(changed).toHaveBeenCalledExactlyOnceWith(1)
  watcher.close()
  watcher.close()
  expect(stop).toHaveBeenCalledTimes(2)
  value = 'closed'
  callbacks[0]()
  await watcher.check()
  expect(changed).toHaveBeenCalledTimes(1)
})
