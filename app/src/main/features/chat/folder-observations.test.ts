import { EventEmitter } from 'node:events'
import type { FSWatcher, watch } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { fakeClient } from '../../infra/ipc/client.testfixture'
import { createFolderObservations } from './folder-observations'

afterEach(() => vi.useRealTimers())

it('rechecks a renamed directory by identity, reopens it once, and detaches all owners', async () => {
  vi.useFakeTimers()
  let identity = 'first'
  const changes = vi.fn()
  const listeners: Array<(event: string) => void> = []
  const watchers: Array<EventEmitter & { close: ReturnType<typeof vi.fn> }> = []
  const watchDir = vi.fn((_path: string, _options: unknown, listener: (event: string) => void) => {
    const watcher = Object.assign(new EventEmitter(), { close: vi.fn() })
    watchers.push(watcher)
    listeners.push(listener)
    return watcher as unknown as FSWatcher
  })
  const observe = createFolderObservations(changes, {
    readIdentity: async () => identity,
    watch: watchDir as unknown as typeof watch
  })
  const a = fakeClient(1),
    b = fakeClient(2)
  const req = { cwd: '/workspace', relDir: 'foo', observation: { owner: 'composer', active: true } }
  await observe(a, req)
  await observe(b, req)
  expect(watchDir).toHaveBeenCalledTimes(1)
  expect(a.watchers()).toBe(1)
  expect(b.watchers()).toBe(1)
  listeners[0]('rename')
  await vi.advanceTimersByTimeAsync(40)
  expect(watchers[0].close).not.toHaveBeenCalled()
  a.close()
  changes.mockClear()
  identity = 'replacement'
  listeners[0]('rename')
  await vi.advanceTimersByTimeAsync(40)
  expect(watchers[0].close).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1000)
  expect(watchDir).toHaveBeenCalledTimes(2)
  expect(changes.mock.calls.map(([target]) => target)).toEqual([b, b])
  changes.mockClear()
  listeners[0]('change')
  await vi.advanceTimersByTimeAsync(40)
  expect(changes).not.toHaveBeenCalled()
  await observe(b, { ...req, observation: { owner: 'composer', active: false } })
  expect(watchers[1].close).toHaveBeenCalledOnce()
  expect(b.watchers()).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
})
