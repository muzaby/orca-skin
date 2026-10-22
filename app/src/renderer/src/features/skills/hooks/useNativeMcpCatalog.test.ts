import { afterEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
import { createElement, useLayoutEffect } from 'react'
import { installFakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { useNativeMcpCatalog } from './useNativeMcpCatalog'
import type { NativeResourcesChanged } from '../../../../../shared/native-resources'
let dom: ReturnType<typeof installFakeDom>
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
})
it('reads both native catalogs and reveals the selected config with its original backend scope', async () => {
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  const read = vi.fn(async ({ backend }: { backend: string }) => ({
    state: 'disconnected',
    items: [
      {
        id: `${backend}-server`,
        name: 'server',
        kind: 'mcp',
        status: 'configured',
        enabled: true,
        canToggle: false
      },
      { id: 'plugin', kind: 'plugin' },
      { id: 'injected', kind: 'mcp', origin: 'orca' }
    ]
  }))
  const open = vi.fn(async () => {})
  let changed!: (event: NativeResourcesChanged) => void
  const observe = vi.fn(),
    unsubscribe = vi.fn()
  Object.assign(window, {
    orca: {
      session: {
        nativeResources: (request: { backend: string }, observation?: unknown) =>
          observation
            ? (observe(request, observation), Promise.resolve({ state: 'disconnected', items: [] }))
            : read(request),
        onNativeResourcesChanged: (callback: typeof changed) => {
          changed = callback
          return unsubscribe
        },
        openNativePlugin: open
      }
    }
  })
  let result!: ReturnType<typeof useNativeMcpCatalog>
  function Probe(): null {
    const value = useNativeMcpCatalog()
    useLayoutEffect(() => {
      result = value
    }, [value])
    return null
  }
  dom.render(createElement(Probe))
  for (let i = 0; i < 8; i++) await Promise.resolve()
  dom.act(() => {})
  expect(read.mock.calls.map(([scope]) => scope)).toEqual([
    { backend: 'claude', cwd: null, projectId: null },
    { backend: 'opencode', cwd: null, projectId: null }
  ])
  expect(result.list.map(({ backend, resource }) => [backend, resource.id])).toEqual([
    ['claude', 'claude-server'],
    ['opencode', 'opencode-server']
  ])
  await result.open(result.list[1].backend, result.list[1].resource)
  expect(open).toHaveBeenCalledWith({
    backend: 'opencode',
    cwd: null,
    projectId: null,
    id: 'opencode-server',
    kind: 'mcp'
  })
  changed({
    scope: { backend: 'claude', cwd: 'C:/other', projectId: null },
    resources: { state: 'disconnected', items: [] }
  })
  dom.act(() => {})
  expect(result.list).toHaveLength(2)
  changed({
    scope: { backend: 'claude', cwd: null, projectId: null },
    resources: { state: 'disconnected', items: [{ ...result.list[0].resource, enabled: false }] }
  })
  dom.act(() => {})
  expect(result.list.find((item) => item.backend === 'claude')?.resource.enabled).toBe(false)
  expect(read).toHaveBeenCalledTimes(2)
  dom.unmount()
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(observe.mock.calls.map(([, value]) => value.active)).toEqual([true, true, false, false])
})
