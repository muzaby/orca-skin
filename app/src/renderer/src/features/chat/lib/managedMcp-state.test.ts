import { expect, it, vi } from 'vitest'
import type { NativeResources } from '../../../../../shared/native-resources'
import { nativeResourceState } from './nativeResourceState'

it('invalidates usable managed candidates and discards the old successful response through IPC', async () => {
  let changed!: (event: { revision: number }) => void
  const pending: Array<(value: NativeResources) => void> = []
  const read = vi.fn((_request: unknown, observation?: { active: boolean }) =>
    observation
      ? Promise.resolve({ state: 'disconnected', items: [] })
      : new Promise<NativeResources>((resolve) => pending.push(resolve))
  )
  vi.stubGlobal('window', {
    orca: {
      session: {
        nativeResources: read,
        onManagedMcpChanged: (callback: typeof changed) => {
          changed = callback
          return () => {}
        },
        onNativeResourcesChanged: () => () => {}
      }
    }
  })
  const state = nativeResourceState('managed-state-test', 'session-managed')
  const off = state.subscribe(vi.fn())
  const native = {
    id: 'native',
    name: 'native',
    kind: 'mcp' as const,
    status: 'connected' as const,
    enabled: true,
    canToggle: false
  }
  const managed = {
    ...native,
    id: 'old-managed',
    origin: 'orca' as const,
    managedSource: { kind: 'user' as const, sourceId: 'old-source' }
  }
  try {
    state.accept({ state: 'connected', generation: 'g1', items: [native, managed] })
    const beforeChange = state.refresh()
    changed({ revision: 2 })
    const afterChange = state.getSnapshot().view
    expect(
      afterChange.status === 'ready' && afterChange.value.items.map((item) => item.id)
    ).toEqual(['native'])
    pending[1]({
      state: 'connected',
      generation: 'g2',
      items: [
        native,
        { ...managed, id: 'new-managed', managedSource: { kind: 'user', sourceId: 'new-source' } }
      ]
    })
    await Promise.resolve()
    await Promise.resolve()
    pending[0]({ state: 'connected', generation: 'g1', items: [managed] })
    await beforeChange
    const view = state.getSnapshot().view
    expect(view.status === 'ready' && view.value.items.map((item) => item.id)).toEqual([
      'native',
      'new-managed'
    ])
  } finally {
    off()
    vi.unstubAllGlobals()
  }
  expect(read.mock.calls.at(-1)?.[1]).toMatchObject({ active: false })
})
