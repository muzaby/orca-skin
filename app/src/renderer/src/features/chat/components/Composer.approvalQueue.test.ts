import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../../../../shared/ipc'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../shared/ui/renderHarness.testfixture'
import { installChatStoreHarness } from '../store/chatStore.testHarness'
import { ingestChatEvent, useChatStore, chatActions } from '../store/chatStore'
import { chatReducer, initialChatState } from '../reducer/chatReducer'
import { Composer } from './Composer'

// Real Composer, docks, controller, attachment hook, store and reducer; replace only the
// React/browser runtime and external data services. Zustand subscriptions still drive rendering.
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  return {
    ...actual,
    ...fakeHooks,
    useDeferredValue: (value: unknown) => value,
    useDebugValue: () => {},
    useId: () => fakeHooks.useMemo(() => 'test-id', []),
    useSyncExternalStore: (subscribe: (fn: () => void) => () => void, get: () => unknown) => {
      const [, force] = fakeHooks.useState(0)
      fakeHooks.useEffect(() => subscribe(() => force((value: number) => value + 1)), [subscribe])
      return get()
    },
    useImperativeHandle: (
      ref: { current: unknown } | null,
      create: () => unknown,
      deps: unknown[]
    ) =>
      fakeHooks.useLayoutEffect(() => {
        if (ref) ref.current = create()
      }, deps)
  }
})
vi.mock(
  'react-dom',
  async () => (await import('../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
// Zustand's externalized React binding bypasses Vitest's React runtime replacement.
// Retain its real vanilla store and adapt only subscriptions to the fake React hooks.
vi.mock('zustand', async () => {
  const { createStore } = await import('zustand/vanilla')
  const { useSyncExternalStore } = await import('react')
  const createImpl = <T>(
    initialize: import('zustand').StateCreator<T>
  ): (<U>(select: (state: T) => U) => U) & import('zustand').StoreApi<T> => {
    const api = createStore(initialize)
    const useBoundStore = <U>(select: (state: T) => U): U =>
      useSyncExternalStore(api.subscribe, () => select(api.getState()))
    return Object.assign(useBoundStore, api)
  }
  return {
    create: <T>(initialize?: import('zustand').StateCreator<T>) =>
      initialize ? createImpl(initialize) : createImpl<T>
  }
})
vi.mock('zustand/react/shallow', async () => {
  const { shallow } = await import('zustand/shallow')
  const { useRef } = await import('react')
  return {
    useShallow: <T, U>(select: (state: T) => U) => {
      const previous = useRef<U>(undefined)
      return (state: T): U => {
        const next = select(state)
        return shallow(previous.current, next) ? (previous.current as U) : (previous.current = next)
      }
    }
  }
})
vi.mock('../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' })
}))
const catalog = vi.hoisted(() => ({
  agents: [] as import('../../../../../shared/ipc').AgentEnvironment[]
}))
vi.mock('../../../shared/hooks/useAgents', () => ({ useAgents: () => catalog.agents }))
vi.mock('../../../shared/hooks/useSkills', () => ({ useSkills: () => [] }))

let dom: FakeDom
let permissionRespond: ReturnType<typeof installChatStoreHarness>['permissionRespond']
const all = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(all)]
const find = (key: string, value: unknown): FakeNode | undefined =>
  all(dom.body).find((node) => node.props[key] === value)
const button = (label: string): FakeNode => {
  const result = all(dom.body).find(
    (node) =>
      node.tag === 'button' &&
      (node.textContent === label || node.textContent.startsWith(`${label}Ctrl`))
  )
  expect(result, label).toBeDefined()
  return result!
}
const render = (): void =>
  dom.render(createElement(Composer, { backendLabel: 'OpenCode', canAbort: true }))
const head = (): string | null =>
  dom.query('[data-slot="composer-input-replacement"]')?.getAttribute('data-request-id') ?? null
const receive = (event: NormalizedEvent): void => dom.act(() => ingestChatEvent(event))
const settle = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve()
    dom.act(() => {})
  }
}

function question(id: string, sessionId = 's'): NormalizedEvent {
  return {
    type: 'permission.requested',
    sessionId,
    approvalId: id,
    origin: 'agent',
    action: {
      kind: 'ask_question',
      request: {
        requestId: id,
        questions: [
          {
            header: id,
            question: `Question ${id}`,
            multiSelect: false,
            options: [
              { label: 'Alpha', description: 'First' },
              { label: 'Beta', description: 'Second' }
            ]
          }
        ]
      }
    }
  }
}
function permission(id: string, sessionId = 's'): NormalizedEvent {
  return {
    type: 'permission.requested',
    sessionId,
    approvalId: id,
    origin: 'agent',
    action: { kind: 'tool_approval', toolName: 'Read', input: { path: `File ${id}` } }
  }
}
const resolved = (approvalId: string, sessionId = 's'): NormalizedEvent => ({
  type: 'permission.resolved',
  sessionId,
  approvalId,
  resolution: { behavior: 'deny' }
})

beforeEach(() => {
  catalog.agents = []
  vi.useFakeTimers()
  ;({ permissionRespond } = installChatStoreHarness({ backend: 'opencode', agentKind: 'code' }))
  const orca = window.orca
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
  Object.assign(window, {
    orca: {
      ...orca,
      files: { pathForFile: () => '/note.txt' },
      provider: { onState: () => () => {}, state: async () => ({ providers: [] }) }
    }
  })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('OpenCode replacement request queue', () => {
  it.each([true, false])(
    'renders only the earliest mixed request in the replacement slot: question first=%s',
    (firstQuestion) => {
      render()
      receive(firstQuestion ? question('z') : permission('z'))
      receive(firstQuestion ? permission('m') : question('m'))
      receive(firstQuestion ? question('a') : permission('a'))
      expect(head()).toBe('z')
      expect(dom.queryAll('[data-component="opencode-dock-prompt"]')).toHaveLength(1)
      expect(dom.queryAll('[data-request-id]')).toHaveLength(1)
      expect(find('aria-label', 'chat.composer.inputAria')).toBeUndefined()
      expect(dom.body.textContent).not.toContain('Question m')
      expect(dom.body.textContent).not.toContain('File m')
      expect(dom.body.textContent).not.toContain('Question a')
      expect(dom.body.textContent).not.toContain('File a')
      expect(useChatStore.getState().sessions.s.session.pendingRequestOrder).toHaveLength(3)
    }
  )

  it('consumes question and permission requests in arrival order', () => {
    render()
    for (const event of [
      question('q1'),
      permission('p1'),
      question('q2'),
      permission('p2'),
      permission('p3')
    ])
      receive(event)
    dom.click(dom.queryAll('[role="radio"]').find((node) => node.textContent.includes('Beta'))!)
    receive(question('q3'))
    expect(dom.query('[role="radio"][aria-checked="true"]')?.textContent).toContain('Beta')
    dom.click(button('chat.ask.submit'))
    expect(permissionRespond).toHaveBeenLastCalledWith({
      approvalId: 'q1',
      resolution: { behavior: 'allow', updatedInput: { answers: { 'Question q1': 'Beta' } } }
    })
    expect(head()).toBe('p1')
    dom.click(button('chat.approval.allow'))
    expect(permissionRespond).toHaveBeenLastCalledWith({
      approvalId: 'p1',
      resolution: { behavior: 'allow' }
    })
    expect(head()).toBe('q2')
    dom.click(button('chat.ask.skip'))
    expect(permissionRespond).toHaveBeenLastCalledWith({
      approvalId: 'q2',
      resolution: { behavior: 'deny' }
    })
    expect(head()).toBe('p2')
    dom.click(button('chat.approval.deny'))
    expect(permissionRespond).toHaveBeenLastCalledWith({
      approvalId: 'p2',
      resolution: { behavior: 'deny', interrupt: false }
    })
    expect(head()).toBe('p3')
    dom.click(button('chat.approval.allowSession'))
    expect(permissionRespond).toHaveBeenLastCalledWith({
      approvalId: 'p3',
      resolution: {
        behavior: 'allow',
        updatedPermissions: [{ toolName: 'Read', scope: 'session' }]
      }
    })
    expect(head()).toBe('q3')
    dom.click(button('chat.ask.skip'))
    expect(head()).toBeNull()
    expect(permissionRespond).toHaveBeenCalledTimes(6)
    expect(find('aria-label', 'chat.composer.inputAria')).toBeDefined()
  })

  it('keeps the draft and attachments until the mixed queue is empty', async () => {
    render()
    const input = find('aria-label', 'chat.composer.inputAria')!
    dom.act(() =>
      (input.props.onChange as (event: unknown) => void)({
        currentTarget: { value: 'keep this draft', selectionStart: 15, selectionEnd: 15 }
      })
    )
    const composer = find('data-harness', 'opencode')!
    dom.act(() =>
      (composer.props.onDrop as (event: unknown) => void)({
        preventDefault: () => {},
        dataTransfer: { files: [{ name: 'note.txt', type: 'text/plain', size: 8 }] }
      })
    )
    await settle()
    expect(find('title', 'note.txt')).toBeDefined()
    receive(permission('p'))
    receive(question('q'))
    expect(find('aria-label', 'chat.composer.inputAria')).toBeUndefined()
    expect(find('title', 'note.txt')).toBeUndefined()
    dom.click(button('chat.approval.deny'))
    expect(find('aria-label', 'chat.composer.inputAria')).toBeUndefined()
    dom.click(button('chat.ask.skip'))
    expect(find('aria-label', 'chat.composer.inputAria')?.props.value).toBe('keep this draft')
    expect(find('title', 'note.txt')).toBeDefined()
  })

  it('applies external resolution only to its session and request', () => {
    useChatStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        other: {
          session: {
            ...initialChatState,
            backend: 'opencode',
            agentKind: 'code',
            sessionId: 'other'
          },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      }
    }))
    render()
    for (const event of [question('q'), permission('p'), question('tail')]) receive(event)
    receive(permission('other-p', 'other'))
    receive(resolved('tail'))
    expect(head()).toBe('q')
    receive(resolved('other-p', 'other'))
    expect(head()).toBe('q')
    receive(question('other-q', 'other'))
    dom.act(() => useChatStore.setState({ activeKey: 'other' }))
    expect(head()).toBe('other-q')
    receive(resolved('q'))
    expect(head()).toBe('other-q')
    dom.act(() => useChatStore.setState({ activeKey: 's' }))
    expect(head()).toBe('p')
    receive(resolved('p'))
    expect(head()).toBeNull()
    expect(find('aria-label', 'chat.composer.inputAria')).toBeDefined()
    expect(permissionRespond).not.toHaveBeenCalled()
  })

  it('retains Claude approval and question layout', () => {
    useChatStore.setState((state) => ({
      sessions: {
        s: {
          ...state.sessions.s,
          session: {
            ...state.sessions.s.session,
            backend: 'claude',
            inflight: true
          }
        }
      }
    }))
    render()
    for (const event of [question('q'), permission('p1'), permission('p2'), permission('p3')])
      receive(event)
    expect(head()).toBeNull()
    expect(dom.queryAll('[data-component="opencode-dock-prompt"]')).toHaveLength(0)
    expect(
      all(dom.body).filter(
        (node) => node.tag === 'button' && node.textContent === 'chat.approval.deny'
      )
    ).toHaveLength(3)
    expect(dom.body.textContent).toContain('Question q')
    expect(find('aria-label', 'chat.composer.inputAria')).toBeDefined()
    expect(find('aria-label', 'common.stop')).toBeDefined()
  })

  it('overlaps the live Todo dock with the input and restores its collapse after mixed requests', () => {
    useChatStore.setState((state) => ({
      sessions: {
        s: {
          ...state.sessions.s,
          session: chatReducer(state.sessions.s.session, { type: 'BEGIN_TURN' })
        }
      }
    }))
    render()
    const args = { todos: [{ content: 'Current task', status: 'in_progress' }] }
    receive({
      type: 'tool.call.started',
      sessionId: 's',
      toolRunId: 'todo',
      toolName: 'TodoWrite',
      args,
      providerTool: { name: 'todowrite', input: args }
    })
    receive({
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'todo',
      result: 'ok',
      isError: false
    })
    dom.advance(320)
    const region = dom.query('[data-slot="opencode-todo-region"]')!
    const input = find('aria-label', 'chat.composer.inputAria')!
    expect(region).not.toBeNull()
    expect(input).toBeDefined()
    expect(region.props.style).toMatchObject({ marginBottom: -36 })
    expect(dom.query('[data-slot="todo-list"]')?.textContent).toContain('Current task')
    dom.click(dom.query('[data-slot="todo-toggle"]')!)
    expect(useChatStore.getState().sessions.s.session.openCodeTodoCollapsed).toBe(true)
    expect(dom.query('[data-slot="todo-list"]')).toBeNull()
    expect(dom.query('[data-slot="todo-summary"]')?.textContent).toBe('Current task')
    receive(question('q'))
    receive(permission('p'))
    expect(dom.query('[data-slot="opencode-todo-region"]')).toBeNull()
    expect(find('aria-label', 'chat.composer.inputAria')).toBeUndefined()
    dom.click(button('chat.ask.skip'))
    expect(head()).toBe('p')
    expect(dom.query('[data-slot="opencode-todo-region"]')).toBeNull()
    dom.click(button('chat.approval.deny'))
    dom.advance(320)
    expect(head()).toBeNull()
    expect(find('aria-label', 'chat.composer.inputAria')).toBeDefined()
    expect(dom.query('[data-slot="todo-toggle"]')?.getAttribute('aria-expanded')).toBe('false')
    expect(dom.query('[data-slot="todo-summary"]')?.textContent).toBe('Current task')
    expect(dom.query('[data-slot="opencode-todo-region"]')?.props.style).toMatchObject({
      marginBottom: -36
    })
  })

  it('keeps todo collapse independently in cached sessions', () => {
    useChatStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        other: {
          ...state.sessions.s,
          session: { ...state.sessions.s.session, sessionId: 'other' }
        }
      }
    }))
    chatActions.setOpenCodeTodoCollapsed(true)
    useChatStore.setState({ activeKey: 'other' })
    expect(useChatStore.getState().sessions.other.session.openCodeTodoCollapsed).toBe(false)
    useChatStore.setState({ activeKey: 's' })
    expect(useChatStore.getState().sessions.s.session.openCodeTodoCollapsed).toBe(true)
  })
})

it('does not hydrate a Claude model before an OpenCode session finishes loading', async () => {
  catalog.agents = [
    {
      adapter: 'claude',
      key: 'claude-local',
      supported: true,
      models: [
        {
          alias: 'sonnet',
          model: 'sonnet',
          isCustom: false,
          isDefault: true,
          oneMillionContext: false
        }
      ]
    }
  ]
  let resolve!: (session: import('../../../../../shared/ipc').LoadedSession) => void
  Object.assign(window.orca, {
    session: {
      load: () =>
        new Promise<import('../../../../../shared/ipc').LoadedSession>((yes) => {
          resolve = yes
        }),
      refresh: async () => ({ status: 'unchanged' })
    }
  })
  const operation = chatActions.loadSession('restore')
  render()
  expect(useChatStore.getState().sessions.restore.session).toMatchObject({
    loadingSession: true,
    backend: null,
    providerKey: null
  })
  resolve({
    id: 'restore',
    backend: 'opencode',
    agentKind: 'code',
    title: 'restored',
    messages: []
  })
  await operation
  dom.act(() => {})
  expect(useChatStore.getState().sessions.restore.session).toMatchObject({
    loadingSession: false,
    backend: 'opencode',
    providerKey: null
  })
  expect(dom.queryAll('[data-harness="opencode"]')).toHaveLength(1)
})
