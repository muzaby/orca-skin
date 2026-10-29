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
import { openConfirmDialog, useConfirmStore } from '../../../shared/ui/confirmDialogStore'
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
  // The failed write released the harness lock, so the retry is sent.
  expect([...result.locked]).toEqual([])
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

  // The toggle stays pending while the dialog is open.
  void result().toggle('claude', claude().resource)
  await flush()
  expect(write).toHaveBeenCalledExactlyOnceWith(request)
  expect(useConfirmStore.getState().request).toMatchObject({
    title: 'chat.nativeResources.claudeCloseTitle',
    message: 'chat.nativeResources.claudeCloseBody(2)',
    confirmLabel: 'chat.nativeResources.claudeCloseConfirm',
    cancelLabel: 'common.cancel'
  })
  expect(claude().resource.enabled).toBe(true)
  expect([...result().locked]).toEqual(['claude'])
  // [취소] — the host cancels the store; no second request, the row stays and the lock lifts.
  useConfirmStore.getState().cancel()
  await flush()
  expect(write).toHaveBeenCalledTimes(1)
  expect(claude().resource.enabled).toBe(true)
  expect([...result().locked]).toEqual([])

  void result().toggle('claude', claude().resource)
  await flush()
  expect(write).toHaveBeenCalledTimes(2)
  useConfirmStore.getState().request!.onConfirm()
  useConfirmStore.getState().close()
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

/** Stateful main: global choices per harness, busy Claude sessions that a confirmed change closes. */
function nativeMain(sessions = 0): {
  read: ReturnType<typeof vi.fn>
  write: ReturnType<typeof vi.fn>
  choices: Record<string, boolean>
  hold(on: boolean): void
  release(): void
} {
  const choices: Record<string, boolean> = {
    'claude:a': true,
    'claude:b': true,
    'opencode:c': true
  }
  let busy = sessions
  let holding = false
  const held: (() => void)[] = []
  const rows = (backend: string): NativeResources => ({
    state: 'disconnected',
    items: Object.entries(choices)
      .filter(([key]) => key.startsWith(`${backend}:`))
      .map(([key, enabled]) => ({
        id: key.split(':')[1],
        name: key.split(':')[1],
        kind: 'plugin' as const,
        enabled,
        status: enabled ? ('configured' as const) : ('disabled' as const),
        canToggle: true
      }))
  })
  const read = vi.fn(async (backend: string) => rows(backend))
  const write = vi.fn(
    async (request: { backend: string; id: string; enabled: boolean; confirmed?: true }) => {
      if (holding) await new Promise<void>((resolve) => held.push(resolve))
      if (request.backend === 'claude' && busy > 0 && !request.confirmed)
        return { status: 'confirm', reason: 'claude-processes', sessions: busy }
      choices[`${request.backend}:${request.id}`] = request.enabled
      if (request.backend === 'claude') busy = 0
      return applied(rows(request.backend))
    }
  )
  Object.assign(window, {
    orca: { session: { globalExtensions: read, setGlobalExtension: write } }
  })
  return {
    read,
    write,
    choices,
    hold: (on) => {
      holding = on
    },
    release: () => {
      for (const resolve of held.splice(0)) resolve()
    }
  }
}

type Catalog = ReturnType<typeof useNativeMcpCatalog>
function renderCatalog(): { result: () => Catalog; renders: Catalog['list'][] } {
  const renders: Catalog['list'][] = []
  let current!: Catalog
  function View(): React.ReactElement {
    const native = useNativeMcpCatalog()
    current = native
    renders.push(native.list)
    return createElement(CustomizeList, {
      tab: 'providers',
      skills: [],
      mcpServers: [],
      providers: [],
      nativeMcp: native.list,
      nativeLocked: native.locked,
      onNativeToggle: native.toggle,
      onSelect: vi.fn()
    })
  }
  dom.render(createElement(View))
  return { result: () => current, renders }
}
const row = (catalog: Catalog, id: string): Catalog['list'][number]['resource'] =>
  catalog.list.find((item) => item.resource.id === id)!.resource
const switches = (): { disabled: boolean; checked: boolean }[] =>
  dom.queryAll('[role="switch"]').map((node) => ({
    disabled: Boolean(node.props.disabled),
    checked: Boolean(node.props['aria-checked'])
  }))

it('ignores toggles for a locked harness and keeps the other harness available', async () => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  const main = nativeMain()
  const { result } = renderCatalog()
  await flush()
  main.hold(true)
  void result().toggle('claude', row(result(), 'a'))
  await flush()
  expect([...result().locked]).toEqual(['claude'])
  void result().toggle('claude', row(result(), 'b'))
  void result().toggle('claude', row(result(), 'a'))
  await flush()
  expect(main.write).toHaveBeenCalledTimes(1)
  // The periodic refresh skips the locked harness only.
  const reads = (backend: string): number =>
    main.read.mock.calls.filter(([value]) => value === backend).length
  const before = { claude: reads('claude'), opencode: reads('opencode') }
  dom.advance(5000)
  await flush()
  expect({ claude: reads('claude'), opencode: reads('opencode') }).toEqual({
    claude: before.claude,
    opencode: before.opencode + 1
  })
  void result().toggle('opencode', row(result(), 'c'))
  await flush()
  expect(main.write.mock.calls.map(([request]) => `${request.backend}:${request.id}`)).toEqual([
    'claude:a',
    'opencode:c'
  ])
  main.hold(false)
  main.release()
  await flush()
  expect([...result().locked]).toEqual([])
  expect(main.choices).toEqual({ 'claude:a': false, 'claude:b': true, 'opencode:c': false })
  await result().toggle('claude', row(result(), 'b'))
  await flush()
  expect(main.choices['claude:b']).toBe(false)
})

it('keeps the harness locked through the Claude confirmation and releases it on every resolution', async () => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  const main = nativeMain(2)
  const { result } = renderCatalog()
  await flush()
  const requests = (): string[] =>
    main.write.mock.calls.map(([request]) => `${request.id}${request.confirmed ? '!' : ''}`)

  void result().toggle('claude', row(result(), 'a'))
  await flush()
  expect(useConfirmStore.getState().request).not.toBeNull()
  expect([...result().locked]).toEqual(['claude'])
  useConfirmStore.getState().cancel()
  await flush()
  expect([...result().locked]).toEqual([])

  void result().toggle('claude', row(result(), 'a'))
  await flush()
  expect([...result().locked]).toEqual(['claude'])
  // Another feature's dialog replaces this one: the replaced request counts as cancelled.
  openConfirmDialog({ title: 'other', message: 'other', onConfirm: vi.fn() })
  await flush()
  expect([...result().locked]).toEqual([])
  useConfirmStore.getState().close()

  void result().toggle('claude', row(result(), 'a'))
  await flush()
  main.hold(true)
  useConfirmStore.getState().request!.onConfirm()
  useConfirmStore.getState().close()
  await flush()
  // The confirmed request runs under the same lock.
  expect([...result().locked]).toEqual(['claude'])
  main.hold(false)
  main.release()
  await flush()
  expect([...result().locked]).toEqual([])
  expect(requests()).toEqual(['a', 'a', 'a', 'a!'])
  expect(main.choices['claude:a']).toBe(false)
  expect(row(result(), 'a').enabled).toBe(false)
})

it('disables every native switch of the toggling harness until the write settles', async () => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  const main = nativeMain()
  renderCatalog()
  await flush()
  expect(switches()).toEqual([
    { disabled: false, checked: true },
    { disabled: false, checked: true },
    { disabled: false, checked: true }
  ])
  main.hold(true)
  dom.click(dom.queryAll('[role="switch"]')[0])
  await flush()
  // Claude a, Claude b, OpenCode c.
  expect(switches().map(({ disabled }) => disabled)).toEqual([true, true, false])
  main.hold(false)
  main.release()
  await flush()
  expect(switches()).toEqual([
    { disabled: false, checked: false },
    { disabled: false, checked: true },
    { disabled: false, checked: true }
  ])
})

it('applies consecutive Claude plugin toggles one at a time without disturbing other rows', async () => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  const main = nativeMain(2)
  const { renders } = renderCatalog()
  await flush()
  const click = (index: number): void => dom.click(dom.queryAll('[role="switch"]')[index])

  click(0)
  await flush()
  expect(useConfirmStore.getState().request).not.toBeNull()
  // B is locked while A's dialog is open: no second request, no second dialog.
  click(1)
  await flush()
  expect(main.write).toHaveBeenCalledTimes(1)
  useConfirmStore.getState().request!.onConfirm()
  useConfirmStore.getState().close()
  await flush()
  click(1)
  await flush()
  expect(useConfirmStore.getState().request).toBeNull()
  expect(
    main.write.mock.calls.map(([request]) => `${request.id}${request.confirmed ? '!' : ''}`)
  ).toEqual(['a', 'a!', 'b'])
  expect(main.choices).toEqual({ 'claude:a': false, 'claude:b': false, 'opencode:c': true })
  // Every rendered list: OpenCode untouched, and B never changes before A.
  const states = renders
    .filter((list) => list.length === 3)
    .map((list) =>
      list.map(({ resource }) => `${resource.id}:${resource.enabled}:${resource.status}`).join(' ')
    )
  expect([...new Set(states)]).toEqual([
    'a:true:configured b:true:configured c:true:configured',
    'a:false:disabled b:true:configured c:true:configured',
    'a:false:disabled b:false:disabled c:true:configured'
  ])
})
