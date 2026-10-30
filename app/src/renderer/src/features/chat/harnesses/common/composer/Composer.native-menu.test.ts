import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useDeferredValue: <T>(value: T): T => value,
  // Native focus/caret effects are outside this fake DOM; the input and its children are real.
  useImperativeHandle: () => {}
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
  useChatSession: (select: (value: typeof fixture) => unknown) => select(fixture),
  // 입력 의도 준비(openCodeInputIntent)는 이 파일의 관심 밖 — 활성 세션 없음으로 no-op.
  useChatStore: { getState: () => ({ sessions: {}, activeKey: '' }) }
}))
vi.mock('../../../../../shared/i18n', () => {
  const tr = (key: string): string => key
  return { useI18n: () => ({ tr }) }
})
import { createElement } from 'react'
import type { BackgroundEvent } from '../../../../../../../shared/background-task'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { composerHarness } from '../../registries/composer'
import { ComposerInputController } from './ComposerInputController'
let dom: FakeDom
const read = vi.fn()
const observe = vi.fn()
const onSend = vi.fn<(text: string) => boolean>(() => true)
let background: (event: BackgroundEvent) => void
let resourcesChanged: (
  event: import('../../../../../../../shared/native-resources').NativeResourcesChanged
) => void
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
  observe.mockReset().mockResolvedValue({ state: 'disconnected', items: [] })
  fixture.sessionId = 'session-B'
  Object.assign(window, {
    orca: {
      session: {
        nativeResources: (request: unknown, observation?: unknown) =>
          observation ? observe(request, observation) : read(request),
        onNativeResourcesChanged: (listener: typeof resourcesChanged) => {
          resourcesChanged = listener
          return () => {}
        }
      },
      chat: {
        onBackgroundEvent: (listener: typeof background) => {
          background = listener
          return () => {}
        }
      },
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
function render(initialDraft = 'preserved draft'): void {
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
      initialDraft,
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
  'offers the observed managed MCP alias to @ selection and send in %s',
  async (backend) => {
    fixture.backend = backend
    const items = [
      {
        id: 'orca_b_builtin',
        mentionId: 'wiki',
        name: 'Wiki',
        kind: 'mcp',
        origin: 'orca',
        managedSource: { kind: 'builtin', sourceId: 'wiki' },
        status: 'connected',
        enabled: true,
        canToggle: false
      },
      {
        id: 'orca_u_user',
        mentionId: 'orca_u_user',
        name: 'User documents',
        kind: 'mcp',
        origin: 'orca',
        managedSource: { kind: 'user', sourceId: 'user-docs' },
        status: 'connected',
        enabled: true,
        canToggle: false
      },
      {
        id: 'not-connected',
        name: 'Unavailable documents',
        kind: 'mcp',
        origin: 'orca',
        status: 'failed',
        enabled: true,
        canToggle: false
      }
    ]
    read.mockResolvedValue({
      state: 'connected',
      generation: 'managed-generation',
      items,
      commands: []
    })
    render('@orca_u')
    await settle()
    const options = dom.queryAll('[role="option"]')
    expect(options).toHaveLength(1)
    expect(options[0].textContent).toContain('User documents')
    dom.act(() =>
      (options[0].props.onMouseDown as (event: { preventDefault(): void }) => void)({
        preventDefault: vi.fn()
      })
    )
    await settle()
    const input = dom.query('[aria-label="chat.composer.inputAria"]')!
    expect(input.props.value).toBe('@orca_u_user ')
    expect(
      (dom.query('[data-composer-decoration-projection]')?.children ?? []).map(
        (node) => node.textContent
      )
    ).toContain('@orca_u_user')
    expect(onSend).not.toHaveBeenCalled()
    dom.act(() =>
      (input.props.onKeyDown as (event: Record<string, unknown>) => void)({
        key: 'Enter',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        nativeEvent: { isComposing: false },
        currentTarget: { value: input.props.value, selectionStart: 13, selectionEnd: 13 }
      })
    )
    await settle()
    expect(onSend.mock.calls[0]?.[0]).toBe('@orca_u_user ')
  }
)
it.each(['claude', 'opencode'] as const)(
  'highlights selected native @ plugins in the real %s composer and refreshes their membership',
  async (backend) => {
    fixture.backend = backend
    const nativeId = 'plugin:docs'
    const items = [
      {
        id: nativeId,
        name: 'Native documents',
        kind: 'mcp',
        status: 'connected',
        enabled: true,
        canToggle: true
      },
      {
        id: 'off',
        name: 'Disabled MCP',
        kind: 'mcp',
        status: 'disabled',
        enabled: false,
        canToggle: true
      }
    ]
    read.mockResolvedValue({ state: 'connected', generation: 'g1', items, commands: [] })
    render()
    await settle()
    dom.click(dom.query('[title="chat.composer.attachMenuTitle"]')!)
    await settle()
    clickLabel('chat.composer.attachMenu.plugins')
    const brand = dom
      .queryAll('[viewBox]')
      .find((node) => node.props.viewBox === (backend === 'claude' ? '0 0 248 248' : '0 0 16 20'))
    expect(brand?.props.className).toContain(backend === 'claude' ? 'text-spinner' : 'text-oc-ink')
    expect(
      dom.queryAll('[role="menuitem"]').some((node) => node.textContent === 'Disabled MCP')
    ).toBe(false)
    clickLabel('Native documents')
    await settle()
    const input = dom.query('[aria-label="chat.composer.inputAria"]')!
    expect(input.props.value).toBe('preserved draft @plugin:docs ')
    const highlights = (): string[] =>
      (dom.query('[data-composer-decoration-projection]')?.children ?? [])
        .filter((node) => String(node.props.className).includes('bg-emerald-500/15'))
        .map((node) => node.textContent)
    expect(highlights()).toEqual(['@plugin:docs'])
    expect(dom.query('[title="chat.composer.attachMenuTitle"]')?.props['aria-expanded']).toBe(false)
    expect(onSend).not.toHaveBeenCalled()
    dom.act(() =>
      resourcesChanged({
        sessionId: 'session-B',
        resources: {
          state: 'connected',
          generation: 'g1',
          items: [{ ...items[0], enabled: false, status: 'disabled' }] as never,
          commands: []
        }
      })
    )
    await settle()
    expect(highlights()).toEqual([])
    expect(dom.query('[aria-label="chat.composer.inputAria"]')!.props.value).toBe(
      'preserved draft @plugin:docs '
    )
    expect(onSend).not.toHaveBeenCalled()
  }
)

it.each(['claude', 'opencode'] as const)(
  'keeps a quoted native plugin id highlighted after selection in %s',
  async (backend) => {
    fixture.backend = backend
    read.mockResolvedValue({
      state: 'connected',
      items: [
        { id: 'docs team', name: 'Team documents', kind: 'mcp', status: 'connected', enabled: true }
      ],
      commands: []
    })
    render()
    await settle()
    dom.click(dom.query('[title="chat.composer.attachMenuTitle"]')!)
    await settle()
    clickLabel('chat.composer.attachMenu.plugins')
    clickLabel('Team documents')
    await settle()
    expect(dom.query('[aria-label="chat.composer.inputAria"]')!.props.value).toBe(
      'preserved draft @"docs team" '
    )
    expect(
      (dom.query('[data-composer-decoration-projection]')?.children ?? []).some(
        (node) =>
          node.textContent === '@"docs team"' &&
          String(node.props.className).includes('bg-emerald-500/15')
      )
    ).toBe(true)
  }
)
it('reflects session-enabled plugin commands in real autocomplete and decoration without changing the draft', async () => {
  fixture.backend = 'claude'
  read.mockResolvedValue({ state: 'connected', generation: 'g1', items: [], commands: [] })
  const name = 'superpowers:using-superpowers'
  render(`/${name}`)
  await settle()
  const chips = (): string[] =>
    (dom.query('[data-composer-decoration-projection]')?.children ?? [])
      .filter((node) => String(node.props.className).includes('bg-blue-500/15'))
      .map((node) => node.textContent)
  expect(chips()).toEqual([])
  expect(dom.queryAll('[role="option"]')).toHaveLength(0)
  dom.act(() =>
    resourcesChanged({
      sessionId: 'session-B',
      resources: {
        state: 'connected',
        generation: 'g1',
        items: [],
        commands: [
          {
            name,
            source: 'plugin',
            description: 'Session enabled only',
            argumentHint: '[question]'
          }
        ]
      }
    })
  )
  await settle()
  expect(chips()).toEqual([`/${name}`])
  expect(
    dom
      .queryAll('[role="option"]')
      .map((node) => node.textContent)
      .join(' ')
  ).toContain(`/${name}`)
  expect(dom.query('[aria-label="chat.composer.inputAria"]')?.props.value).toBe(`/${name}`)
  dom.act(() =>
    resourcesChanged({
      sessionId: 'session-B',
      resources: {
        state: 'connected',
        generation: 'g1',
        items: [],
        commands: []
      }
    })
  )
  await settle()
  expect(chips()).toEqual([])
  expect(dom.queryAll('[role="option"]')).toHaveLength(0)
  expect(dom.query('[aria-label="chat.composer.inputAria"]')?.props.value).toBe(`/${name}`)
  expect(onSend).not.toHaveBeenCalled()
})

it.each(['claude', 'opencode'] as const)(
  'keeps Orca file skill autocomplete scoped to extension-enabled %s inputs',
  async (backend) => {
    fixture.backend = backend
    window.orca.skills.list = async () =>
      [
        {
          name: 'local-skill',
          sourceId: 'orca',
          sourceLabel: 'Orca',
          enabled: true,
          description: 'Orca file skill'
        }
      ] as never
    render('/local-skill')
    await settle()
    const expected = backend === 'claude' ? ['/local-skill'] : []
    const chips = (dom.query('[data-composer-decoration-projection]')?.children ?? [])
      .filter((node) => String(node.props.className).includes('bg-blue-500/15'))
      .map((node) => node.textContent)
    expect(chips).toEqual(expected)
    expect(dom.queryAll('[role="option"]')).toHaveLength(expected.length)
  }
)

it.each(['claude', 'opencode'] as const)(
  'loads %s native commands from +, inserts without sending, reuses on reentry and refreshes on reconnect',
  async (backend) => {
    fixture.backend = backend
    render()
    await settle()
    expect(read).toHaveBeenCalledExactlyOnceWith('session-B')
    const owner = observe.mock.calls[0][1].owner
    expect(observe).toHaveBeenCalledExactlyOnceWith('session-B', { owner, active: true })
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
    expect(dom.query('[aria-label="chat.composer.inputAria"]')!.props.value).toBe(
      '/session-B:review preserved draft'
    )
    expect(
      (dom.query('[data-composer-decoration-projection]')?.children ?? []).some(
        (node) =>
          node.textContent === '/session-B:review' &&
          String(node.props.className).includes('bg-blue-500/15')
      )
    ).toBe(true)
    expect(onSend).not.toHaveBeenCalled()
    fixture.sessionId = 'session-C'
    render()
    await settle()
    expect(read).toHaveBeenCalledWith('session-C')
    expect(observe).toHaveBeenCalledWith('session-B', { owner, active: false })
    fixture.sessionId = 'session-B'
    render()
    await settle()
    open()
    await settle()
    expect(read.mock.calls.filter(([id]) => id === 'session-B')).toHaveLength(1)
    expect(observe.mock.calls.filter(([id, state]) => id === 'session-B' && state.active)).toEqual([
      ['session-B', { owner, active: true }],
      ['session-B', { owner, active: true }]
    ])
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
    expect(read.mock.calls.filter(([id]) => id === 'session-B')).toHaveLength(1)
    background({
      type: 'background.connection',
      sessionId: 'session-B',
      state: 'connected',
      source: { generation: 'resumed', sequence: 1, receivedAt: 1, replay: false }
    })
    await settle()
    expect(read.mock.calls.filter(([id]) => id === 'session-B')).toHaveLength(2)
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
      expect(read).toHaveBeenCalledWith({
        backend: 'claude',
        cwd: null,
        projectId: 'project-B',
        agentKind: 'code'
      })
    clickLabel('frontend-design::frontend-design')
    await settle()
    expect(dom.query('[aria-label="chat.composer.inputAria"]')!.props.value).toBe(
      '/frontend-design:frontend-design preserved draft'
    )
    expect(onSend).not.toHaveBeenCalled()
  }
)

it.each(['claude', 'opencode'] as const)(
  'shows all source groups directly for %s and keeps draft text on selection — puts the Orcinus orca group first in both panels',
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
    const orcaMark = dom.query('[aria-label="Orcinus orca"]')!
    expect(orcaMark).not.toBeNull()
    const tokens = String(orcaMark.props.className).split(/\s+/)
    expect(tokens).toEqual(expect.arrayContaining(['h-3.5', 'w-auto', 'shrink-0']))
    expect(tokens.filter((token) => /^(size-|w-(?!auto$))/.test(token))).toEqual([])
    expect(dom.queryAll('[data-menu-heading]').map((node) => node.textContent)).toEqual([
      'Orcinus orca',
      backend === 'claude' ? 'Claude' : 'OpenCode'
    ])
    expect(dom.queryAll('[viewBox]').map((node) => node.props.viewBox)).toContain(
      backend === 'claude' ? '0 0 248 248' : '0 0 16 20'
    )
    expect(
      dom
        .queryAll('[viewBox]')
        .filter(
          (node) => node.props.viewBox === (backend === 'claude' ? '0 0 248 248' : '0 0 16 20')
        )
        .every((node) =>
          String(node.props.className).includes(
            backend === 'claude' ? 'text-spinner' : 'text-oc-ink'
          )
        )
    ).toBe(true)
    clickLabel('design::review')
    await settle()
    expect(dom.query('[aria-label="chat.composer.inputAria"]')!.props.value).toBe(
      '/design:review preserved draft'
    )
    open()
    await settle()
    clickLabel('chat.composer.attachMenu.plugins')
    expect(dom.queryAll('[data-cascade-level="1"]').map((row) => row.textContent)).toEqual(
      // Orcinus orca 그룹은 두 패널 모두 첫 그룹이다(0291 D-017).
      backend === 'claude'
        ? ['Connected Orca MCP', 'Jira', 'Native MCP']
        : ['Connected Orca MCP', 'Native MCP']
    )
    expect(dom.queryAll('[data-menu-heading]').map((node) => node.textContent)).toEqual(
      backend === 'claude' ? ['Orcinus orca', 'Claude'] : ['Orcinus orca', 'OpenCode']
    )
    clickLabel('Native MCP')
    await settle()
    const highlightedPlugins = (): string[] =>
      (dom.query('[data-composer-decoration-projection]')?.children ?? [])
        .filter((node) => String(node.props.className).includes('bg-emerald-500/15'))
        .map((node) => node.textContent)
    expect(highlightedPlugins()).toContain('@native')
    if (backend === 'claude') {
      for (const [label, token] of [
        ['Connected Orca MCP', '@plugin:orcinus-orca:custom'],
        ['Jira', '@jira']
      ]) {
        open()
        await settle()
        clickLabel('chat.composer.attachMenu.plugins')
        clickLabel(label)
        await settle()
        expect(highlightedPlugins()).toContain(token)
      }
    } else {
      open()
      await settle()
      clickLabel('chat.composer.attachMenu.plugins')
      clickLabel('Connected Orca MCP')
      await settle()
      expect(highlightedPlugins()).toContain('@plugin:orcinus-orca:custom')
      expect(highlightedPlugins()).not.toContain('@jira')
    }
    expect(onSend).not.toHaveBeenCalled()
  }
)
