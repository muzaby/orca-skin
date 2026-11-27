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
  await observe(a, { ...req, observation: { owner: 'other-menu', active: true } })
  expect(watchDir).toHaveBeenCalledTimes(1)
  expect(a.watchers()).toBe(2)
  expect(b.watchers()).toBe(1)
  listeners[0]('change')
  listeners[0]('rename')
  listeners[0]('change')
  expect(changes).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(40)
  const payload = { cwd: req.cwd, relDir: req.relDir, revision: 1 }
  expect(changes).toHaveBeenCalledTimes(2)
  expect(changes).toHaveBeenCalledWith(a, payload)
  expect(changes).toHaveBeenCalledWith(b, payload)
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

it('recovers a silently moved folder and stops checking when the last owner closes', async () => {
  vi.useFakeTimers()
  const readIdentity = vi.fn(async () => 'original')
  const changes = vi.fn()
  const watchDir = vi.fn(() => Object.assign(new EventEmitter(), { close: vi.fn() }))
  const deps = {
    readIdentity,
    watch: watchDir as unknown as typeof watch,
    checkSilentMoves: true
  }
  const observe = createFolderObservations(changes, deps)
  const sender = fakeClient(1)
  await observe(sender, {
    cwd: '/workspace',
    relDir: 'active',
    observation: { owner: 'menu', active: true }
  })
  await vi.advanceTimersByTimeAsync(1000)
  expect(changes).not.toHaveBeenCalled()
  readIdentity.mockRejectedValueOnce(new Error('ENOENT'))
  await vi.advanceTimersByTimeAsync(1000)
  expect(changes).toHaveBeenCalledTimes(1)
  expect(watchDir.mock.results[0].value.close).toHaveBeenCalledOnce()
  readIdentity.mockResolvedValue('replacement')
  await vi.advanceTimersByTimeAsync(1000)
  expect(watchDir).toHaveBeenCalledTimes(2)
  expect(changes).toHaveBeenCalledTimes(2)
  // A move and recreation can both finish between checks.
  readIdentity.mockResolvedValue('second replacement')
  await vi.advanceTimersByTimeAsync(1000)
  expect(changes).toHaveBeenCalledTimes(3)
  await vi.advanceTimersByTimeAsync(1000)
  expect(watchDir).toHaveBeenCalledTimes(3)
  let finish!: (identity: string) => void
  readIdentity.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  await vi.advanceTimersByTimeAsync(1000)
  sender.close()
  finish('stale')
  await vi.advanceTimersByTimeAsync(5000)
  expect(changes).toHaveBeenCalledTimes(4)
  expect(vi.getTimerCount()).toBe(0)

  const next = fakeClient(2)
  await observe(next, {
    cwd: '/workspace',
    relDir: 'active',
    observation: { owner: 'menu', active: true }
  })
  expect(vi.getTimerCount()).toBe(1)
  next.close()
  expect(vi.getTimerCount()).toBe(0)
})
