import { expect, it } from 'vitest'
import { NativeResourceState } from './nativeResourceState'

it('retains a failed live Composer read only within the same generation and accepts authoritative removal', () => {
  const cache = new NativeResourceState('session')
  const composer = {
    agents: [{ name: 'plugin-review' }],
    models: [{ id: 'team/model', variants: ['low'] }]
  }
  cache.accept({ state: 'connected', generation: 'one', items: [], composer })
  const before = cache.getSnapshot()
  const unsubscribe = cache.subscribe(() => undefined)
  unsubscribe()
  expect(cache.getSnapshot()).toBe(before)
  cache.accept({ state: 'connected', generation: 'one', items: [], partial: true })
  let view = cache.getSnapshot().view
  expect(view.status === 'ready' && view.value.composer).toEqual(composer)
  cache.accept({
    state: 'connected',
    generation: 'one',
    items: [],
    composer: { agents: [], models: [] }
  })
  view = cache.getSnapshot().view
  expect(view.status === 'ready' && view.value.composer).toEqual({ agents: [], models: [] })
  cache.accept({ state: 'connected', generation: 'two', items: [], partial: true })
  view = cache.getSnapshot().view
  expect(view.status === 'ready' && view.value.composer).toBeUndefined()
  cache.accept({ state: 'connected', generation: 'one', items: [], composer })
  expect(cache.getSnapshot().view).toBe(view)
})
