import { afterEach, expect, it, vi } from 'vitest'
import { OpenCodeIdleBudget, OpenCodeInstances } from './instance-lifecycle'
afterEach(() => vi.useRealTimers())

it('retains until one 90000ms deadline and waits for acknowledgement plus event', async () => {
  vi.useFakeTimers()
  const ack = Promise.withResolvers<void>()
  const dispose = vi.fn(() => ack.promise)
  const actor = new OpenCodeInstances({ connect: async () => {}, dispose, retire: vi.fn() })
  const first = await actor.acquire('C:/retained')
  first.touched = true
  await actor.release(first)
  await vi.advanceTimersByTimeAsync(89_999)
  expect(dispose).not.toHaveBeenCalled()
  expect(first.controller.signal.aborted).toBe(false)
  const second = await actor.acquire('C:/retained')
  expect(second).toBe(first)
  await actor.release(second)
  await vi.advanceTimersByTimeAsync(90_000)
  expect(dispose).toHaveBeenCalledTimes(1)
  const received = vi.fn()
  const next = actor.acquire('C:/retained').then((value) => {
    received()
    return value
  })
  ack.resolve()
  await vi.advanceTimersByTimeAsync(1)
  expect(received).not.toHaveBeenCalled()
  actor.disposed('C:/retained')
  const replacement = await next
  expect(replacement.id).not.toBe(first.id)
  actor.close(new Error('shutdown'))
  expect(vi.getTimerCount()).toBe(0)
})

it('evicts only the oldest idle directory across profiles and retires idle without touching active peers', async () => {
  vi.useFakeTimers()
  const budget = new OpenCodeIdleBudget()
  const actors = Array.from(
    { length: 2 },
    () =>
      new OpenCodeInstances({
        connect: vi.fn(),
        dispose: vi.fn(),
        retire: vi.fn(),
        idleBudget: budget
      })
  )
  const active = await actors[0].acquire('C:/active')
  const scopes: import('./instance-lifecycle').OpenCodeInstance[] = []
  for (let i = 0; i < 5; i++) {
    const actor = actors[i % 2]
    const scope = await actor.acquire(`C:/idle-${i}`)
    scopes.push(scope)
    await actor.release(scope)
  }
  expect(scopes.map((scope) => scope.controller.signal.aborted)).toEqual([
    true,
    false,
    false,
    false,
    false
  ])
  expect(active.controller.signal.aborted).toBe(false)
  actors[0].retire()
  expect(scopes[2].controller.signal.aborted).toBe(true)
  expect(scopes[4].controller.signal.aborted).toBe(true)
  expect(active.controller.signal.aborted).toBe(false)
  await actors[0].release(active)
  expect(active.controller.signal.aborted).toBe(true)
  await expect(actors[0].acquire('C:/new')).rejects.toThrow()
  for (const actor of actors) actor.close(new Error('shutdown'))
  expect(vi.getTimerCount()).toBe(0)
})
