import { afterEach, expect, it, vi } from 'vitest'
import { OpenCodeGlobalWatch } from './opencode-global-watch'

const fs = vi.hoisted(() => ({ watchFile: vi.fn(), unwatchFile: vi.fn() }))
vi.mock('node:fs', () => fs)
afterEach(() => vi.clearAllMocks())
const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

it('fans out once per external plugin change and ignores unchanged polls', async () => {
  let fingerprint = 'original'
  const changed = vi.fn()
  const dirty = vi.fn()
  const watcher = new OpenCodeGlobalWatch({
    files: ['a', 'b', 'c'],
    fingerprint: async () => fingerprint,
    changed,
    dirty,
    failed: vi.fn()
  })
  await watcher.check()
  expect(fs.watchFile).toHaveBeenCalledTimes(3)
  const callback = fs.watchFile.mock.calls[0][2] as () => void
  fingerprint = 'external'
  callback()
  await flush()
  expect(changed).toHaveBeenCalledExactlyOnceWith(1)
  callback()
  await flush()
  expect(changed).toHaveBeenCalledTimes(1)
  // A general config edit still invalidates discovery even when plugin entries are unchanged.
  expect(dirty).toHaveBeenCalledTimes(3)
  fingerprint = 'removed'
  callback()
  await flush()
  expect(changed.mock.calls).toEqual([[1], [2]])
  watcher.close()
  expect(fs.unwatchFile.mock.calls.map(([file]) => file)).toEqual(['a', 'b', 'c'])
  fingerprint = 'after close'
  callback()
  await flush()
  expect(changed).toHaveBeenCalledTimes(2)
})

it('does not publish an in-flight read after closing', async () => {
  const gate = Promise.withResolvers<string>()
  const changed = vi.fn()
  const fingerprint = vi.fn().mockResolvedValueOnce('initial').mockReturnValue(gate.promise)
  const watcher = new OpenCodeGlobalWatch({
    files: ['config'],
    fingerprint,
    changed,
    failed: vi.fn()
  })
  const pending = watcher.check()
  await flush()
  expect(fingerprint).toHaveBeenCalledTimes(2)
  watcher.close()
  gate.resolve('changed')
  await pending
  expect(changed).not.toHaveBeenCalled()
  await watcher.check()
  expect(fingerprint).toHaveBeenCalledTimes(2)
})

it('reports a failed poll and observes the next successful change', async () => {
  const changed = vi.fn(),
    failed = vi.fn()
  const fingerprint = vi
    .fn()
    .mockResolvedValueOnce('initial')
    .mockRejectedValueOnce(new Error('unreadable'))
    .mockResolvedValue('next')
  const watcher = new OpenCodeGlobalWatch({ files: [], fingerprint, changed, failed })
  await watcher.check()
  expect(failed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'unreadable' }))
  expect(changed).not.toHaveBeenCalled()
  await watcher.check()
  expect(changed).toHaveBeenCalledExactlyOnceWith(1)
  watcher.close()
})
