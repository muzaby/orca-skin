import { afterEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
import { createElement, useLayoutEffect } from 'react'
import { installFakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { useNativeMcpCatalog } from './useNativeMcpCatalog'
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
  Object.assign(window, { orca: { session: { nativeResources: read, openNativePlugin: open } } })
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
})
