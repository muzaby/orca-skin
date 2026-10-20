import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useDeferredValue: <T>(value: T): T => value
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
const fixture = vi.hoisted(() => ({
  sessionId: 'session-B' as string | null,
  pendingProjectId: 'project-B',
  backend: 'claude' as 'claude' | 'opencode',
  agentKind: 'code' as const
}))
vi.mock('../../../store/chatStore', () => ({
  useChatSession: (select: (value: typeof fixture) => unknown) => select(fixture)
}))
vi.mock('../../../../../shared/i18n', () => {
  const tr = (key: string): string => key
  return { useI18n: () => ({ tr }) }
})
vi.mock('./ComposerInputSurface', async () => {
  const { createElement } = await import('react')
  return {
    ComposerInputSurface: ({ snapshot }: { snapshot: { text: string } }) =>
      createElement('textarea', { 'data-native-draft': true, value: snapshot.text })
  }
})
import { createElement } from 'react'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { composerHarness } from '../../registries/composer'
import { ComposerInputController } from './ComposerInputController'
let dom: FakeDom
const read = vi.fn()
const onSend = vi.fn(() => true)
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
  read.mockReset().mockImplementation(async (id: string) => ({
    state: 'connected',
    items: [],
    commands: [
      {
        name: `${id}:review`,
        source: 'plugin',
        description: 'Review current code',
        argumentHint: ''
      }
    ]
  }))
  onSend.mockClear()
  fixture.sessionId = 'session-B'
  Object.assign(window, {
    orca: {
      session: { nativeResources: read },
      mcp: { list: async () => [] },
      skills: { list: async () => [] },
      provider: { state: async () => ({ providers: [] }), onState: () => () => {} }
    }
  })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
  dom.act(() => {})
}
function render(): void {
  dom.render(
    createElement(ComposerInputController, {
      presentation: composerHarness(fixture.backend),
      active: true,
      backendLabel: fixture.backend,
      canAbort: true,
      inflight: false,
      steerBlocked: false,
      toolApprovalPending: false,
      cwd: null,
      initialDraft: 'preserved draft',
      onSend,
      onCancel: () => {},
      controlsStart: null,
      controlsEnd: null,
      diffRequirementSnapshot: {
        sessionKey: fixture.sessionId ?? 'draft-B',
        sessionId: fixture.sessionId,
        ids: [],
        revision: 0,
        anchors: []
      },
      onClearDiffRequirementsIfUnchanged: () => {}
    })
  )
}
function clickLabel(label: string): void {
  const button = dom
    .queryAll('[role="menuitem"]')
    .find((item) => item.textContent.startsWith(label))
  expect(button, label).toBeDefined()
  dom.click(button!)
}
it.each(['claude', 'opencode'] as const)(
  'loads %s native commands from +, inserts without sending and reloads on reentry',
  async (backend) => {
    fixture.backend = backend
    render()
    await settle()
    expect(read).toHaveBeenCalledExactlyOnceWith('session-B')
    const open = (): void => dom.click(dom.query('[title="chat.composer.attachMenuTitle"]')!)
    open()
    await settle()
    expect(read).toHaveBeenCalledWith('session-B')
    clickLabel('chat.composer.attachMenu.skills')
    const command = dom
      .queryAll('[role="menuitem"]')
      .find((item) => item.textContent === 'session-B::review')!
    expect(command.props.title).toBe('Review current code')
    expect(command.textContent).not.toContain('Review current code')
    clickLabel('session-B::review')
    await settle()
    expect(dom.query('[data-native-draft]')!.props.value).toBe('/session-B:review preserved draft')
    expect(onSend).not.toHaveBeenCalled()
    fixture.sessionId = 'session-C'
    render()
    await settle()
    expect(read).toHaveBeenCalledWith('session-C')
    fixture.sessionId = 'session-B'
    render()
    await settle()
    open()
    await settle()
    expect(read.mock.calls.filter(([id]) => id === 'session-B')).toHaveLength(4)
    clickLabel('chat.composer.attachMenu.skills')
    expect(
      dom
        .queryAll('[role="menuitem"]')
        .some((item) => item.textContent === 'chat.nativeResources.refresh')
    ).toBe(false)
    dom.keyDown('Escape')
    let finishRefresh!: (value: unknown) => void
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve
        })
    )
    open()
    await settle()
    expect(read.mock.calls.filter(([id]) => id === 'session-B')).toHaveLength(5)
    expect(dom.query('[title="chat.composer.attachMenuTitle"]')!.props['aria-expanded']).toBe(true)
    clickLabel('chat.composer.attachMenu.skills')
    expect(
      dom
        .queryAll('[role="menu"]')
        .some((menu) => menu.textContent.includes('chat.nativeResources.refreshing'))
    ).toBe(false)
    expect(
      dom
        .queryAll('[role="menuitem"]')
        .some((item) => item.textContent.startsWith('session-B::review'))
    ).toBe(true)
    finishRefresh({ state: 'connected', items: [], commands: [] })
    await settle()
    expect(
      dom
        .queryAll('[role="menuitem"]')
        .some((item) => item.textContent.startsWith('session-B::review'))
    ).toBe(false)
  }
)

it.each(['saved', 'draft'])(
  'offers an installed frontend-design skill before the Claude runtime starts (%s)',
  async (mode) => {
    if (mode === 'draft') fixture.sessionId = null
    fixture.backend = 'claude'
    read.mockResolvedValue({
      state: 'disconnected',
      items: [],
      commands: [
        {
          name: 'frontend-design:frontend-design',
          description: 'Create a distinctive interface',
          argumentHint: '[brief]',
          source: 'plugin'
        }
      ]
    })
    render()
    await settle()
    dom.click(dom.query('[title="chat.composer.attachMenuTitle"]')!)
    await settle()
    clickLabel('chat.composer.attachMenu.skills')
    const row = dom
      .queryAll('[role="menuitem"]')
      .find((item) => item.textContent === 'frontend-design::frontend-design')!
    expect(row.props.title).toBe('Create a distinctive interface\n[brief]')
    if (mode === 'draft')
      expect(read).toHaveBeenCalledWith({ backend: 'claude', cwd: null, projectId: 'project-B' })
    clickLabel('frontend-design::frontend-design')
    await settle()
    expect(dom.query('[data-native-draft]')!.props.value).toBe(
      '/frontend-design:frontend-design preserved draft'
    )
    expect(onSend).not.toHaveBeenCalled()
  }
)

it.each(['claude', 'opencode'] as const)(
  'shows all source groups directly for %s and keeps draft text on selection',
  async (backend) => {
    fixture.backend = backend
    window.orca.skills.list = async () =>
      [
        {
          name: 'orca-skill',
          sourceId: 'orca',
          sourceLabel: 'Orca skills',
          description: 'Local skill'
        }
      ] as never
    window.orca.mcp.list = async () =>
      [
        {
          id: 'custom',
          name: 'Custom MCP',
          description: 'Custom tools',
          enabled: true
        },
        {
          id: 'disabled',
          name: 'Disabled MCP',
          description: '',
          enabled: false
        }
      ] as never
    window.orca.provider.state = async () =>
      ({
        providers: [
          { id: 'jira', label: 'Jira', tools: ['issue'], status: 'valid' },
          { id: 'expired', label: 'Expired', tools: ['issue'], status: 'expired' }
        ]
      }) as never
    read.mockResolvedValue({
      state: 'connected',
      generation: 'generation-B',
      items: [
        { id: 'native', name: 'Native MCP', kind: 'mcp', status: 'connected', enabled: true },
        {
          id: 'plugin:orcinus-orca:custom',
          name: 'Connected Orca MCP',
          kind: 'mcp',
          origin: 'orca',
          status: 'connected',
          enabled: true
        },
        {
          id: 'configured',
          name: 'Configured only',
          kind: 'mcp',
          status: 'configured',
          enabled: true
        }
      ],
      commands: [
        { name: 'design:review', source: 'plugin', description: 'Design review', argumentHint: '' }
      ]
    })
    render()
    await settle()
    const open = (): void => dom.click(dom.query('[title="chat.composer.attachMenuTitle"]')!)
    open()
    await settle()
    clickLabel('chat.composer.attachMenu.skills')
    const rows = dom.queryAll('[data-cascade-level="1"]')
    expect(rows.map((row) => row.textContent)).toEqual(['orca-skill', 'design::review'])
    expect(rows.every((row) => !row.props['aria-haspopup'])).toBe(true)
    expect(rows[0].props.disabled).toBe(backend === 'opencode')
    expect(dom.query('[aria-label="Orcinus orca"]')).not.toBeNull()
    expect(dom.queryAll('[viewBox]').map((node) => node.props.viewBox)).toContain(
      backend === 'claude' ? '0 0 248 248' : '0 0 16 20'
    )
    clickLabel('design::review')
    await settle()
    expect(dom.query('[data-native-draft]')!.props.value).toBe('/design:review preserved draft')
    open()
    await settle()
    clickLabel('chat.composer.attachMenu.plugins')
    expect(dom.queryAll('[data-cascade-level="1"]').map((row) => row.textContent)).toEqual(
      backend === 'claude' ? ['Native MCP', 'Connected Orca MCP', 'Jira'] : ['Native MCP']
    )
    expect(
      dom
        .queryAll('[role="menu"]')
        .map((row) => row.textContent)
        .join('')
    ).toContain(`${backend === 'claude' ? 'Claude' : 'OpenCode'} MCP`)
    expect(onSend).not.toHaveBeenCalled()
  }
)
