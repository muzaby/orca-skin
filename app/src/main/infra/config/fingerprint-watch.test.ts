import { expect, it, vi } from 'vitest'
import { FingerprintWatch } from './fingerprint-watch'

it('compares a supplied consumer baseline on startup and cancels startup work on close', async () => {
  vi.useFakeTimers()
  const changed = vi.fn()
  const fingerprint = vi.fn(async () => 'new')
  const watcher = new FingerprintWatch({
    files: ['config'],
    initialFingerprint: 'old',
    fingerprint,
    watch: () => () => undefined,
    changed,
    failed: vi.fn()
  })
  try {
    await watcher.ready
    expect(fingerprint).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(changed).toHaveBeenCalledExactlyOnceWith(1)
    await watcher.check()
    expect(changed).toHaveBeenCalledTimes(1)
    const closed = new FingerprintWatch({
      files: ['config'],
      initialFingerprint: 'old',
      fingerprint,
      watch: () => () => undefined,
      changed,
      failed: vi.fn()
    })
    closed.close()
    await vi.advanceTimersByTimeAsync(100)
    expect(changed).toHaveBeenCalledTimes(1)
  } finally {
    watcher.close()
    vi.useRealTimers()
  }
})

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
