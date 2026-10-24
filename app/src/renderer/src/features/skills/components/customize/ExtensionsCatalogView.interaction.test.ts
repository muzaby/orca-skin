import { createElement, Fragment } from 'react'
import type { StateCreator } from 'zustand/vanilla'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { ExtensionsCatalogView } from './ExtensionsCatalogView'
import { useConfirmStore } from '../../../../shared/ui/confirmDialogStore'
import { ConfirmDialogHost } from '../../../../shared/ui/ConfirmDialogHost'
import { i18n } from '../../../../shared/i18n'
import type { NativeResource, NativeResources } from '../../../../../../shared/native-resources'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => 'catalog-fixture'
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
// Keep the real store actions/subscriptions; adapt only the React binding to the harness.
vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { fakeHooks } = await import('../../../../shared/ui/renderHarness.testfixture')
  const create = (initializer?: StateCreator<unknown>): unknown => {
    if (!initializer) return create
    const store = actual.createStore(initializer)
    return Object.assign(
      (selector: (state: unknown) => unknown = (state) => state) =>
        fakeHooks.useSyncExternalStore(store.subscribe, () => selector(store.getState())),
      store
    )
  }
  return { ...actual, create }
})
vi.mock('../../../../shared/i18n', async (original) => {
  const source = await original<typeof import('../../../../shared/i18n')>()
  return { ...source, useI18n: () => ({ tr: source.i18n.t.bind(source.i18n), locale: 'ko' }) }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
const api = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  skillList: vi.fn(),
  providers: vi.fn()
}))
vi.mock('../../../../shared/api/ipc', async (original) => ({
  ...(await original<typeof import('../../../../shared/api/ipc')>()),
  skillApi: { list: api.skillList },
  mcpApi: { list: async () => [] },
  providerApi: { state: api.providers, onState: () => () => {} },
  sessionApi: { globalExtensions: api.read, setGlobalExtension: api.write }
}))

let dom: FakeDom
const resource = (name: string, kind: 'plugin' | 'mcp' = 'plugin'): NativeResource => ({
  id: name,
  name,
  kind,
  status: 'installed' as const,
  enabled: true,
  canToggle: true,
  canOpen: false
})
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 900 })
  api.read.mockReset().mockImplementation(async (backend: string) => ({
    state: 'disconnected',
    items: [
      { ...resource(backend), canToggle: backend === 'claude' },
      resource(`${backend}-mcp`, 'mcp')
    ]
  }))
  api.skillList.mockResolvedValue(
    [
      'orca',
      'agents',
      'adapter:claude',
      'adapter:opencode',
      'plugin:claude',
      'plugin:opencode'
    ].map((sourceId) => ({
      name: 'review',
      sourceId,
      sourceLabel: sourceId,
      sourceKind: sourceId === 'orca' ? 'orca' : 'adapter',
      enabled: true,
      canToggle: sourceId === 'orca',
      canRemove: false,
      description: '',
      skillDir: '/fixture',
      skillPath: '/fixture/SKILL.md'
    }))
  )
  api.providers.mockResolvedValue({
    providers: ['service', 'llm', 'gate'].map((kind) => ({
      id: kind,
      label: kind,
      kind,
      authScheme: 'login-free',
      auth: [],
      activeAuthKind: null,
      status: 'valid',
      tools: [],
      principal: null,
      expiresAt: null,
      origin: ''
    })),
    step: null
  })
  api.write.mockReset()
})
afterEach(async () => {
  dom.unmount()
  useConfirmStore.getState().close()
  vi.useRealTimers()
  vi.clearAllMocks()
  await i18n.changeLanguage('ko')
})
const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) await Promise.resolve()
  dom.act(() => {})
}
const tab = (index: number): void => {
  dom.click(dom.queryAll('[role="tab"]')[index])
}
const rows = (): unknown[] =>
  dom.queryAll('[data-extensions-row]').map((row) => row.props['data-extensions-row'])

const renderWithDialog = (): void => {
  dom.render(
    createElement(
      Fragment,
      null,
      createElement(ExtensionsCatalogView),
      createElement(ConfirmDialogHost)
    )
  )
}
const dialogButton = (label: string): void => {
  const button = dom.queryAll('[type="button"]').find((node) => node.textContent === label)
  expect(button).toBeDefined()
  dom.click(button!)
}
const dialogTitle = (): string | undefined =>
  dom
    .query('[role="dialog"]')
    ?.querySelectorAll('[class]')
    .find((node) => node.tag === 'span' && String(node.props.className).includes('font-serif'))
    ?.textContent
const dialogBody = (): string | undefined =>
  dom
    .query('[role="dialog"]')
    ?.querySelectorAll('[class]')
    .find((node) => node.tag === 'p')?.textContent

it('confirms a busy Claude plugin change through the shared dialog', async () => {
  api.write.mockImplementation(async (request) =>
    request.confirmed
      ? {
          status: 'applied',
          resources: { state: 'disconnected', items: [{ ...resource('claude'), enabled: false }] }
        }
      : { status: 'confirm', reason: 'claude-processes', sessions: 2 }
  )
  renderWithDialog()
  await flush()
  dom.click(dom.queryAll('[role="switch"]')[0])
  await flush()
  expect(api.write).toHaveBeenCalledExactlyOnceWith({
    backend: 'claude',
    kind: 'plugin',
    id: 'claude',
    enabled: false
  })
  expect(dialogTitle()).toBe('Claude 세션 종료')
  expect(dialogBody()).toContain('Claude 세션이 2개 있습니다.')
  expect(dom.queryAll('[type="button"]').map((node) => node.textContent)).toEqual(
    expect.arrayContaining(['변경', '취소'])
  )
  expect(useConfirmStore.getState().request?.danger).toBeUndefined()
  dialogButton('취소')
  await flush()
  expect(dom.query('[role="dialog"]')).toBeNull()
  expect(api.write).toHaveBeenCalledTimes(1)
  expect(dom.queryAll('[role="switch"]')[0].props['aria-checked']).toBe(true)

  dom.click(dom.queryAll('[role="switch"]')[0])
  await flush()
  dom.click(dom.query('[data-context="overlay"]')!)
  await flush()
  expect(dom.query('[role="dialog"]')).toBeNull()
  expect(api.write).toHaveBeenCalledTimes(2)
  expect(dom.queryAll('[role="switch"]')[0].props['aria-checked']).toBe(true)

  dom.click(dom.queryAll('[role="switch"]')[0])
  await flush()
  dialogButton('변경')
  await flush()
  expect(api.write).toHaveBeenCalledTimes(4)
  expect(api.write).toHaveBeenLastCalledWith({
    backend: 'claude',
    kind: 'plugin',
    id: 'claude',
    enabled: false,
    confirmed: true
  })
  expect(dom.query('[role="dialog"]')).toBeNull()
  expect(dom.queryAll('[role="switch"]')[0].props['aria-checked']).toBe(false)
})

it('renders the Claude close dialog in English with singular and plural counts', async () => {
  await i18n.changeLanguage('en')
  api.write
    .mockResolvedValueOnce({ status: 'confirm', reason: 'claude-processes', sessions: 1 })
    .mockResolvedValueOnce({ status: 'confirm', reason: 'claude-processes', sessions: 2 })
  renderWithDialog()
  await flush()
  for (const [count, prefix] of [
    [1, '1 Claude session is'],
    [2, '2 Claude sessions are']
  ] as const) {
    dom.click(dom.queryAll('[role="switch"]')[0])
    await flush()
    expect(dialogTitle()).toBe('Close Claude sessions')
    expect(dialogBody()?.startsWith(prefix)).toBe(true)
    expect(dom.queryAll('[type="button"]').map((node) => node.textContent)).toEqual(
      expect.arrayContaining(['Change', 'Cancel'])
    )
    expect(useConfirmStore.getState().request?.danger).toBeUndefined()
    dialogButton('Cancel')
    await flush()
    expect(api.write).toHaveBeenCalledTimes(count)
    expect(dom.queryAll('[role="switch"]')[0].props['aria-checked']).toBe(true)
  }
})

it('moves native plugins to the plugin tab after provider groups', async () => {
  dom.render(createElement(ExtensionsCatalogView))
  await flush()
  expect(rows()).toEqual(['gate', 'llm', 'service', 'claude:claude', 'opencode:opencode'])
  expect(dom.queryAll('[role="switch"]')).toHaveLength(2)
})

it('hides native plugin skills from the skills tab', async () => {
  dom.render(createElement(ExtensionsCatalogView))
  await flush()
  tab(1)
  expect(rows()).toEqual([
    'adapter:claude/review',
    'adapter:opencode/review',
    'agents/review',
    'orca/review'
  ])
  expect(dom.queryAll('[role="switch"]')).toHaveLength(1)
})

it('scopes native loading and failure to plugin and MCP tabs', async () => {
  api.providers.mockResolvedValue({ providers: [], step: null })
  const pending = Promise.withResolvers<NativeResources>()
  api.read.mockReturnValue(pending.promise)
  dom.render(createElement(ExtensionsCatalogView))
  await flush()
  expect(rows()).toEqual([])
  expect(dom.queryAll('[role="status"]').map((node) => node.textContent)).toEqual(['불러오는 중…'])
  tab(1)
  expect(rows()).toContain('orca/review')
  pending.reject(new Error('offline'))
  await flush()
  expect(
    dom
      .queryAll('[role="status"]')
      .map((node) => node.textContent)
      .join()
  ).not.toContain('불러오')
  expect(dom.queryAll('[role="status"]')).toHaveLength(0)
  tab(0)
  expect(dom.queryAll('[role="status"]')).toHaveLength(1)
  tab(2)
  expect(dom.queryAll('[role="status"]')).toHaveLength(1)
})

it('shows OpenCode plugin rows as fixed native state and sends no toggle', async () => {
  dom.render(createElement(ExtensionsCatalogView))
  await flush()
  const toggle = dom.queryAll('[role="switch"]')[1]
  expect(toggle.props.disabled).toBe(true)
  expect(toggle.props['aria-checked']).toBe(true)
  expect(dom.query('[title="opencode"]')?.props.className).toContain('text-ink3')
  dom.click(toggle)
  await flush()
  expect(api.write).not.toHaveBeenCalled()
  expect(useConfirmStore.getState().request).toBeNull()
  tab(2)
  const mcp = dom.queryAll('[role="switch"]')[1]
  expect(mcp.props.disabled).toBe(false)
  api.write.mockResolvedValue({
    status: 'applied',
    resources: {
      state: 'disconnected',
      items: [{ ...resource('opencode-mcp', 'mcp'), enabled: false }]
    }
  })
  dom.click(mcp)
  await flush()
  expect(api.write).toHaveBeenCalledExactlyOnceWith({
    backend: 'opencode',
    id: 'opencode-mcp',
    kind: 'mcp',
    enabled: false
  })
})

it.each(['present', 'loading', 'failed'] as const)(
  'shows the empty skills state when native resources are %s',
  async (state) => {
    api.skillList.mockResolvedValue([])
    if (state === 'loading') api.read.mockReturnValue(new Promise(() => {}))
    if (state === 'failed') api.read.mockRejectedValue(new Error('offline'))
    dom.render(createElement(ExtensionsCatalogView))
    await flush()
    tab(1)
    expect(rows()).toEqual([])
    const status = dom.queryAll('[role="status"]')
    expect(status).toHaveLength(1)
    expect(status[0].textContent).not.toContain('불러오')
    expect(status[0].textContent).toContain('스킬')
  }
)
