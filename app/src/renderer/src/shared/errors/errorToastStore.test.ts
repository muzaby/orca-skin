import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppErrorReport } from '../../../../shared/app-error'
import { createErrorToastStore } from './errorToastStore'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
const report = (id: string, detail = id): AppErrorReport => ({
  id,
  title: 'unexpected',
  detail,
  origin: 'renderer'
})

describe('error toast lifetime', () => {
  it('removes at 4600ms, not 4599ms', () => {
    const store = createErrorToastStore()
    store.getState().push(report('a'))
    vi.advanceTimersByTime(4599)
    expect(store.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(store.getState().toasts).toEqual([])
  })
  it('restarts expiry for merged hits and clears timers on dismiss and eviction', () => {
    const store = createErrorToastStore()
    store.getState().push(report('a'))
    vi.advanceTimersByTime(1200)
    store.getState().push(report('b', 'a'))
    vi.advanceTimersByTime(3400)
    expect(store.getState().toasts[0].seq).toBe(1)
    vi.advanceTimersByTime(1200)
    expect(store.getState().toasts).toEqual([])
    for (const id of ['a', 'b', 'c', 'd']) store.getState().push(report(id))
    expect(vi.getTimerCount()).toBe(3)
    for (const { id } of store.getState().toasts) store.getState().dismiss(id)
    expect(store.getState().toasts).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })
})
