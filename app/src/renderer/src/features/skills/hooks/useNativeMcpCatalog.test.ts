import { afterEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../shared/i18n')>()),
  useI18n: () => ({
    tr: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}(${options.count})`,
    locale: 'ko'
  })
}))
import { createElement, useLayoutEffect } from 'react'
import { installFakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { useNativeMcpCatalog } from './useNativeMcpCatalog'
import { CustomizeList } from '../components/customize/CustomizeList'
import type {
  NativeResources,
  SetGlobalNativeResourceResult
} from '../../../../../shared/native-resources'
import { useConfirmStore } from '../../../shared/ui/confirmDialogStore'
import { errorToastStore } from '../../../shared/errors/errorToastStore'
let dom: ReturnType<typeof installFakeDom>
afterEach(() => {
  dom?.unmount()
  useConfirmStore.getState().close()
  for (const toast of errorToastStore.getState().toasts)
    errorToastStore.getState().dismiss(toast.id)
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
const applied = (resources: NativeResources): SetGlobalNativeResourceResult => ({
  status: 'applied',
  resources
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
  const write = vi.fn(async () => applied(catalog(false)))
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
  const write = vi.fn(async () => applied(plugin('claude', true)))
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

it('reports a choice write failure once and releases the queue for a retry', async () => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  const plugins = (enabled = true): NativeResources => ({
    ...catalog(enabled),
    items: catalog(enabled).items.map((item) => ({ ...item, kind: 'plugin' }))
  })
  const write = vi
    .fn()
    .mockRejectedValueOnce(new Error('disk locked'))
    .mockResolvedValueOnce(applied(plugins(false)))
  const logged = vi.fn()
  Object.assign(window, {
    orca: {
      session: { globalExtensions: async () => plugins(), setGlobalExtension: write },
      log: { error: logged }
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
  const resource = result.list[0].resource
  await result.toggle('claude', resource)
  await flush()
  expect(write).toHaveBeenLastCalledWith({
    backend: 'claude',
    id: 'docs',
    kind: 'plugin',
    enabled: false
  })
  expect(logged).toHaveBeenCalledTimes(1)
  expect(logged.mock.calls[0].slice(0, 2)).toEqual([
    'skills.native.toggle-failed',
    'native-resources'
  ])
  expect(errorToastStore.getState().toasts).toMatchObject([
    { title: 'saveFailed', detail: 'disk locked' }
  ])
  expect(result.list[0].resource.enabled).toBe(true)
  await result.toggle('claude', resource)
  await flush()
  expect(result.list[0].resource.enabled).toBe(false)
  expect(write).toHaveBeenCalledTimes(2)
})

function claudePluginHarness(results: SetGlobalNativeResourceResult[]): {
  write: ReturnType<typeof vi.fn>
  result: () => ReturnType<typeof useNativeMcpCatalog>
} {
  const rows = (backend: string, enabled = true): NativeResources => ({
    state: 'disconnected',
    items: [
      backend === 'claude'
        ? {
            id: 'superpowers',
            name: 'superpowers@market',
            kind: 'plugin',
            enabled,
            status: enabled ? 'configured' : 'disabled',
            canToggle: true
          }
        : {
            id: 'docs',
            name: 'docs',
            kind: 'mcp',
            enabled,
            status: enabled ? 'configured' : 'disabled',
            canToggle: true
          }
    ]
  })
  const write = vi.fn()
  for (const value of results) write.mockResolvedValueOnce(value)
  write.mockImplementation(async (request: { backend: string; enabled: boolean }) =>
    applied(rows(request.backend, request.enabled))
  )
  Object.assign(window, {
    orca: {
      session: {
        globalExtensions: async (backend: string) => rows(backend),
        setGlobalExtension: write
      }
    }
  })
  let current!: ReturnType<typeof useNativeMcpCatalog>
  function Probe(): null {
    const value = useNativeMcpCatalog()
    useLayoutEffect(() => {
      current = value
    }, [value])
    return null
  }
  dom.render(createElement(Probe))
  return { write, result: () => current }
}

it('applies a Claude plugin change without a dialog when no Claude session is busy', async () => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  const { write, result } = claudePluginHarness([])
  await flush()
  const claude = result().list.find((item) => item.backend === 'claude')!
  await result().toggle('claude', claude.resource)
  await flush()
  expect(write).toHaveBeenCalledExactlyOnceWith({
    backend: 'claude',
    id: 'superpowers',
    kind: 'plugin',
    enabled: false
  })
  expect(useConfirmStore.getState().request).toBeNull()
  expect(result().list.find((item) => item.backend === 'claude')!.resource.enabled).toBe(false)
})

it('confirms before closing busy Claude sessions and applies only after the change is confirmed', async () => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  const confirm: SetGlobalNativeResourceResult = {
    status: 'confirm',
    reason: 'claude-processes',
    sessions: 2
  }
  const { write, result } = claudePluginHarness([confirm, confirm])
  await flush()
  const claude = (): NonNullable<ReturnType<typeof useNativeMcpCatalog>['list'][number]> =>
    result().list.find((item) => item.backend === 'claude')!
  const request = { backend: 'claude', id: 'superpowers', kind: 'plugin', enabled: false }

  await result().toggle('claude', claude().resource)
  await flush()
  expect(write).toHaveBeenCalledExactlyOnceWith(request)
  expect(useConfirmStore.getState().request).toMatchObject({
    title: 'chat.nativeResources.claudeCloseTitle',
    message: 'chat.nativeResources.claudeCloseBody(2)',
    confirmLabel: 'chat.nativeResources.claudeCloseConfirm',
    cancelLabel: 'common.cancel'
  })
  expect(claude().resource.enabled).toBe(true)
  // [취소] — the host only closes the store; no second request and the row stays.
  useConfirmStore.getState().close()
  await flush()
  expect(write).toHaveBeenCalledTimes(1)
  expect(claude().resource.enabled).toBe(true)

  await result().toggle('claude', claude().resource)
  await flush()
  expect(write).toHaveBeenCalledTimes(2)
  useConfirmStore.getState().request!.onConfirm()
  await flush()
  expect(write).toHaveBeenCalledTimes(3)
  expect(write).toHaveBeenLastCalledWith({ ...request, confirmed: true })
  expect(claude().resource.enabled).toBe(false)
})

it('never opens the Claude dialog for OpenCode MCP toggles', async () => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  const { write, result } = claudePluginHarness([])
  await flush()
  const docs = result().list.find((item) => item.backend === 'opencode')!
  await result().toggle('opencode', docs.resource)
  await flush()
  expect(write).toHaveBeenCalledExactlyOnceWith({
    backend: 'opencode',
    id: 'docs',
    kind: 'mcp',
    enabled: false
  })
  expect(useConfirmStore.getState().request).toBeNull()
  expect(result().list.find((item) => item.backend === 'opencode')!.resource.enabled).toBe(false)
})
