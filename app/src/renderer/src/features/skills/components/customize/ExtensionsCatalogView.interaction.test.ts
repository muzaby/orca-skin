import { createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { ExtensionsCatalogView } from './ExtensionsCatalogView'
import { useConfirmStore } from '../../../../shared/ui/confirmDialogStore'
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
    items: [resource(backend), resource(`${backend}-mcp`, 'mcp')]
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
afterEach(() => {
  dom.unmount()
  useConfirmStore.getState().close()
  vi.useRealTimers()
  vi.clearAllMocks()
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

it('asks before changing an OpenCode plugin while sessions run and applies only after confirmation', async () => {
  api.write
    .mockResolvedValueOnce({ status: 'confirm', reason: 'opencode-restart', sessions: 2 })
    .mockResolvedValueOnce({ status: 'confirm', reason: 'opencode-restart', sessions: 2 })
    .mockResolvedValueOnce({
      status: 'applied',
      resources: {
        state: 'disconnected',
        items: [{ ...resource('opencode'), enabled: false, status: 'disabled' }]
      }
    })
  dom.render(createElement(ExtensionsCatalogView))
  await flush()
  dom.click(dom.queryAll('[role="switch"]')[1])
  await flush()
  expect(useConfirmStore.getState().request?.title).toBe('OpenCode 서버 재시작')
  expect(dom.queryAll('[role="switch"]')[1].props['aria-checked']).toBe(true)
  useConfirmStore.getState().close()
  expect(api.write).toHaveBeenCalledTimes(1)
  dom.click(dom.queryAll('[role="switch"]')[1])
  await flush()
  useConfirmStore.getState().request!.onConfirm()
  await flush()
  expect(api.write).toHaveBeenLastCalledWith({
    backend: 'opencode',
    id: 'opencode',
    kind: 'plugin',
    enabled: false,
    confirmed: true
  })
  expect(dom.queryAll('[role="switch"]')[1].props['aria-checked']).toBe(false)
})
