import { expect, it, vi } from 'vitest'
import type { OpenCodePluginsChanged } from '../../../../../../../shared/native-resources'
import { createComposerAgentStore } from './composerAgentStore'

vi.mock('../../../../../shared/api/ipc', () => ({
  sessionApi: { onOpenCodePluginsChanged: vi.fn() }
}))

it('keeps the first list accepted at the current revision and notifies subscribers once', () => {
  const store = createComposerAgentStore(vi.fn())
  const one = vi.fn(),
    two = vi.fn()
  store.subscribe(one)
  const unsubscribe = store.subscribe(two)
  expect(store.getState().agents).toBeUndefined()
  store.getState().accept([{ name: 'first' }], 0)
  store.getState().accept([{ name: 'late' }], 0)
  expect(store.getState().agents).toEqual([{ name: 'first' }])
  expect(one).toHaveBeenCalledOnce()
  expect(two).toHaveBeenCalledOnce()
  unsubscribe()
  store.getState().invalidate(1)
  expect(two).toHaveBeenCalledOnce()
})

it('invalidates only for a newer revision and ignores results captured at an older revision', () => {
  const store = createComposerAgentStore(vi.fn()),
    listener = vi.fn()
  store.getState().accept([], 0)
  store.subscribe(listener)
  store.getState().invalidate(3)
  expect(store.getState().agents).toBeUndefined()
  store.getState().accept([{ name: 'stale' }], 0)
  expect(store.getState().agents).toBeUndefined()
  store.getState().accept([{ name: 'future' }], 4)
  expect(store.getState().agents).toBeUndefined()
  store.getState().accept([{ name: 'fresh' }], 3)
  store.getState().invalidate(3)
  store.getState().invalidate(2)
  expect(listener).toHaveBeenCalledTimes(2)
  expect(store.getState().agents).toEqual([{ name: 'fresh' }])
  expect(store.getState().revision).toBe(3)
})

it('subscribes to plugin changes once at creation and clears agents without any view', () => {
  let changed!: (event: OpenCodePluginsChanged) => void
  const subscribe = vi.fn((handler) => {
    changed = handler
    return vi.fn()
  })
  const store = createComposerAgentStore(subscribe)
  expect(subscribe).toHaveBeenCalledOnce()
  store.getState().accept([{ name: 'old' }], 0)
  changed({ revision: 2 })
  expect(store.getState()).toMatchObject({ agents: undefined, revision: 2 })
  const one = store.subscribe(vi.fn()),
    two = store.subscribe(vi.fn())
  one()
  two()
  store.getState().accept([{ name: 'new' }], 2)
  changed({ revision: 7 })
  expect(store.getState()).toMatchObject({ agents: undefined, revision: 7 })
  expect(subscribe).toHaveBeenCalledOnce()
})
