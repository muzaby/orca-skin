import { afterEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' })
}))
import { createElement, useLayoutEffect } from 'react'
import { installFakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { useNativeMcpCatalog } from './useNativeMcpCatalog'
import { CustomizeList } from '../components/customize/CustomizeList'
import type { NativeResources } from '../../../../../shared/native-resources'
let dom: ReturnType<typeof installFakeDom>
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const catalog = (enabled = true): NativeResources => ({
  state: 'disconnected',
  items: [
    {
      id: 'docs',
      name: 'docs',
      kind: 'mcp',
      status: enabled ? 'configured' : 'disabled',
      enabled,
      canToggle: true,
      canOpen: true
    }
  ]
})
const flush = async (): Promise<void> => {
  for (let i = 0; i < 16; i++) await Promise.resolve()
  dom.act(() => {})
}

it('queries explicit global scope without owning runtime observations, retains good rows on failure and ignores stale reads', async () => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  const read = vi.fn<(backend: string) => Promise<NativeResources>>(async () => catalog())
  const open = vi.fn(async () => {})
  const write = vi.fn(async () => ({ status: 'applied', resources: catalog(false) }))
  const runtimeRead = vi.fn(),
    observe = vi.fn()
  Object.assign(window, {
    orca: {
      session: {
        globalExtensions: read,
        openGlobalExtension: open,
        setGlobalExtension: write,
        nativeResources: runtimeRead,
        onNativeResourcesChanged: observe
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
  await flush()
  expect(read.mock.calls.map(([backend]) => backend)).toEqual(['claude', 'opencode'])
  expect(runtimeRead).not.toHaveBeenCalled()
  expect(observe).not.toHaveBeenCalled()
  expect(result.list).toHaveLength(2)
  await result.open('opencode', result.list[1].resource)
  expect(open).toHaveBeenCalledWith({ backend: 'opencode', id: 'docs', kind: 'mcp' })
  read.mockImplementation(async (backend) => {
    if (backend === 'opencode') throw new Error('private')
    return catalog()
  })
  await result.refresh()
  await flush()
  expect(result.failed).toBe(true)
  expect(result.list).toHaveLength(2)
  const delayed = Promise.withResolvers<NativeResources>()
  read.mockImplementation((backend) =>
    backend === 'claude' ? delayed.promise : Promise.resolve(catalog())
  )
  const loading = result.refresh()
  await result.toggle('claude', result.list[0].resource)
  await flush()
  expect(result.list[0].resource.enabled).toBe(false)
  delayed.resolve(catalog(true))
  await loading
  await flush()
  expect(result.list[0].resource.enabled).toBe(false)
  expect(write).toHaveBeenCalledWith({ backend: 'claude', id: 'docs', kind: 'mcp', enabled: false })
  expect(result.failed).toBe(false)
  dom.unmount()
  const calls = read.mock.calls.length
  await vi.advanceTimersByTimeAsync(10_000)
  expect(read).toHaveBeenCalledTimes(calls)
})

it('renders native plugin capabilities and updates the actual row through its toggle', async () => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  const plugin = (backend: string, enabled = false): NativeResources => ({
    state: 'disconnected',
    items: [
      {
        id: `${backend}-plugin`,
        name: `${backend}-plugin`,
        kind: 'plugin',
        enabled,
        status: enabled ? 'configured' : 'disabled',
        canToggle: backend === 'claude',
        canOpen: false
      }
    ]
  })
  const write = vi.fn(async () => ({ status: 'applied', resources: plugin('claude', true) }))
  Object.assign(window, {
    orca: {
      session: {
        globalExtensions: async (backend: string) => plugin(backend),
        setGlobalExtension: write
      }
    }
  })
  function Catalog(): React.ReactElement {
    const native = useNativeMcpCatalog()
    return createElement(CustomizeList, {
      tab: 'providers',
      skills: [],
      mcpServers: [],
      providers: [],
      nativeMcp: native.list,
      onNativeToggle: native.toggle,
      onSelect: vi.fn()
    })
  }
  dom.render(createElement(Catalog))
  await flush()
  const switches = dom.queryAll('[role="switch"]')
  expect(switches).toHaveLength(2)
  expect(switches.map((node) => [node.props.disabled, node.props['aria-checked']])).toEqual([
    [false, false],
    [true, false]
  ])
  expect(dom.query('[title="claude-plugin"]')?.props.className).not.toContain('text-ink3')
  expect(dom.query('[title="opencode-plugin"]')?.props.className).toContain('text-ink3')
  dom.click(switches[0])
  await flush()
  expect(write).toHaveBeenCalledExactlyOnceWith({
    backend: 'claude',
    kind: 'plugin',
    id: 'claude-plugin',
    enabled: true
  })
  expect(dom.queryAll('[role="switch"]')[0].props['aria-checked']).toBe(true)
  expect(dom.queryAll('[role="switch"]')[1].props['aria-checked']).toBe(false)
})
