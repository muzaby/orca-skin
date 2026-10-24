import { createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { openCodeTileById } from './tileRegistry'
import type { NativeResource } from '../../../../../../../shared/native-resources'
import type {
  ComposerCatalogRequest,
  ComposerCatalogResult,
  ComposerCatalogInvalidated
} from '../../../../../../../shared/composer-catalog'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { fakeHooks } = await import('../../../../../shared/ui/renderHarness.testfixture')
  return {
    ...actual,
    useStore: <T, U>(store: import('zustand').StoreApi<T>, select: (state: T) => U): U =>
      fakeHooks.useSyncExternalStore(store.subscribe, () => select(store.getState())) as U
  }
})
vi.mock('../../../../../shared/i18n', async (original) => {
  const value = await original<typeof import('../../../../../shared/i18n')>()
  return { ...value, useI18n: () => ({ tr: value.i18n.t.bind(value.i18n), locale: 'ko' }) }
})
const f = vi.hoisted(() => ({
  session: {
    sessionId: null as string | null,
    backend: 'opencode',
    cwd: 'C:/A',
    projectId: 'A',
    pendingProjectId: null,
    providerKey: 'team',
    agentKind: 'code'
  },
  read: vi.fn(),
  catalog: vi.fn(),
  release: vi.fn(),
  open: vi.fn(),
  write: vi.fn()
}))
vi.mock('../../../store/chatStore', () => ({
  useChatSession: (select: (state: typeof f.session) => unknown) => select(f.session),
  chatActions: { removeRightPanelTile: vi.fn() }
}))
let dom: FakeDom
let invalidated: (event: ComposerCatalogInvalidated) => void
const tile = (): React.ReactElement => createElement(openCodeTileById('nativeStatus').Content)
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve()
  dom.act(() => {})
}
const resource = (id: string, kind: 'mcp' | 'plugin' = 'mcp'): NativeResource => ({
  id,
  name: id,
  kind,
  status: kind === 'mcp' ? ('connected' as const) : ('enabled' as const),
  enabled: true,
  canToggle: false
})
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  Object.assign(f.session, { sessionId: null, cwd: 'C:/A', projectId: 'A', providerKey: 'team' })
  dom = installFakeDom({ innerWidth: 1100, innerHeight: 800 })
  f.read.mockResolvedValue({ state: 'disconnected', items: [] })
  f.release.mockResolvedValue(undefined)
  Object.assign(window, {
    orca: {
      session: {
        nativeResources: f.read,
        composerCatalog: f.catalog,
        releaseComposerCatalog: f.release,
        onNativeResourcesChanged: () => () => {},
        onComposerCatalogInvalidated: (fn: typeof invalidated) => {
          invalidated = fn
          return () => {}
        },
        openNativePlugin: f.open,
        setNativeResource: f.write
      }
    }
  })
})
afterEach(async () => {
  dom.unmount()
  await vi.runOnlyPendingTimersAsync()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('renders prepared plugins before MCP, supports retry without restart, and delegates after the first message', async () => {
  const mcp = Promise.withResolvers<ComposerCatalogResult>()
  f.catalog.mockImplementation(async (r: ComposerCatalogRequest) =>
    r.part === 'mcp'
      ? mcp.promise
      : {
          part: r.part,
          generation: 'A-generation',
          value: r.part === 'plugins' ? [resource('Superpowers', 'plugin')] : []
        }
  )
  dom.render(tile())
  await settle()
  expect(dom.query('[data-native-status]')?.textContent).toContain('Superpowers')
  expect(dom.queryAll('[data-status-tone]').map((n) => n.props['data-status-tone'])).toEqual([
    'green'
  ])
  expect(dom.query('[role="switch"]')).toBeNull()
  mcp.resolve({ part: 'mcp', value: [resource('dynamic-mcp')], generation: 'A-generation' })
  await settle()
  expect(dom.query('[data-native-status]')?.textContent).toContain('dynamic-mcp')
  const dynamic = dom.queryAll('[data-cascade-index]').find((n) => n.textContent === 'dynamic-mcp')!
  expect(dynamic.props.disabled ?? dynamic.props['aria-disabled']).toBeTruthy()
  expect(dynamic.props.title).toBeUndefined()
  dom.click(dynamic)
  expect(f.open).not.toHaveBeenCalled()
  const refresh = dom.query('[aria-label="새로고침"]')!
  expect(refresh).not.toBeNull()
  dom.click(refresh)
  await settle()
  expect(f.catalog.mock.calls.filter(([r]) => r.part === 'mcp')).toHaveLength(2)
  expect(f.catalog.mock.calls.filter(([r]) => r.part === 'plugins')).toHaveLength(2)
  const owners = new Set(f.catalog.mock.calls.map(([r]) => r.owner))
  expect(owners.size).toBe(1)
  const before = f.catalog.mock.calls.length
  f.session.sessionId = 'saved-A'
  f.read.mockResolvedValue({
    state: 'connected',
    generation: 'runtime-A',
    items: [resource('live-mcp')]
  })
  dom.render(tile())
  await settle()
  expect(dom.query('[data-native-status]')?.textContent).toContain('live-mcp')
  expect(f.catalog).toHaveBeenCalledTimes(before)
})

it('discards the previous directory and removes connected state after generation invalidation', async () => {
  const old = Promise.withResolvers<ComposerCatalogResult>()
  f.catalog.mockImplementation(async (r: ComposerCatalogRequest) =>
    r.scope.cwd === 'C:/A' && r.part === 'mcp'
      ? old.promise
      : {
          part: r.part,
          value: r.part === 'mcp' ? [resource('B-only')] : [],
          generation: r.scope.cwd
        }
  )
  dom.render(tile())
  await settle()
  Object.assign(f.session, { cwd: 'C:/B', projectId: 'B', providerKey: 'team-B' })
  dom.render(tile())
  await settle()
  old.resolve({ part: 'mcp', value: [resource('A-late')], generation: 'C:/A' })
  await settle()
  expect(dom.query('[data-native-status]')?.textContent).toContain('B-only')
  expect(dom.query('[data-native-status]')?.textContent).not.toContain('A-late')
  const current = f.catalog.mock.calls.find(([r]) => r.scope.cwd === 'C:/B')![0]
  expect(current.scope.providerKey).toBe('team-B')
  dom.act(() => invalidated({ owner: current.owner, generation: 'C:/B' }))
  await settle()
  expect(dom.queryAll('[data-status-tone="green"]')).toHaveLength(0)
})

it('offers only the fixed refresh button when both prepared and configured draft reads fail', async () => {
  f.read.mockRejectedValue(new Error('configuration unavailable'))
  f.catalog.mockImplementation(async (r: ComposerCatalogRequest) => ({
    part: r.part,
    status: 'error',
    failure: { stage: 'acquire', reason: 'unavailable' }
  }))
  dom.render(tile())
  await settle()
  const refresh = dom.query('[aria-label="새로고침"]')!
  expect(refresh).not.toBeNull()
  expect(dom.queryAll('[type="button"]')).toEqual([refresh])
  const before = f.catalog.mock.calls.length
  dom.click(refresh)
  await settle()
  expect(
    f.catalog.mock.calls
      .slice(before)
      .map(([r]) => r.part)
      .sort()
  ).toEqual(['mcp', 'plugins'])
  expect(dom.queryAll('[type="button"]')).toEqual([dom.query('[aria-label="새로고침"]')])
})
