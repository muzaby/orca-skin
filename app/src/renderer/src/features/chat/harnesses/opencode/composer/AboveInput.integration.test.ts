import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { LoadedMessage } from '../../../../../../../shared/ipc'
import { installFakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { chatReducer, initialChatState } from '../../../reducer/chatReducer'
import { chatActions, ingestChatEvent } from '../../../store/chatStore'
import { harnessSession, installChatStoreHarness } from '../../../store/chatStore.testHarness'
import { AboveInput } from './AboveInput'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { fakeHooks } = await import('../../../../../shared/ui/renderHarness.testfixture')
  const create = (initializer?: import('zustand').StateCreator<unknown>): unknown => {
    if (!initializer) return create
    const store = actual.createStore(initializer)
    return Object.assign(
      (select: (state: unknown) => unknown = (state) => state) =>
        fakeHooks.useSyncExternalStore(store.subscribe, () => select(store.getState())),
      store
    )
  }
  return { ...actual, create }
})
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))

afterEach(() => vi.unstubAllGlobals())

it.each(['before send', 'empty current turn', 'current write'] as const)(
  'renders only current-turn TODOs across accepted and rejected history pages (%s)',
  (phase) => {
    const tail: LoadedMessage = { id: 'tail', role: 'user', createdAt: 3, parts: [] }
    const olderUser: LoadedMessage = { ...tail, id: 'older-user' }
    const olderTodo: LoadedMessage = {
      id: 'older-todo',
      role: 'assistant',
      createdAt: 2,
      parts: [
        {
          type: 'tool_call',
          toolRunId: 'past',
          toolName: 'TodoWrite',
          args: { todos: [{ content: 'old', status: 'in_progress' }] }
        },
        { type: 'tool_result', toolRunId: 'past', result: 'ok', isError: false }
      ]
    }
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      complete: false,
      session: { id: 's', backend: 'opencode', agentKind: 'code', title: null, messages: [tail] }
    })
    installChatStoreHarness(
      phase === 'before send' ? loaded : chatReducer(loaded, { type: 'BEGIN_TURN' })
    )
    const dom = installFakeDom({ innerWidth: 900, innerHeight: 800 })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        disconnect = vi.fn()
      }
    )
    try {
      dom.render(createElement(AboveInput, { inflight: true }))
      if (phase === 'current write') {
        dom.act(() => {
          ingestChatEvent({
            type: 'tool.call.started',
            sessionId: 's',
            toolRunId: 'now',
            toolName: 'TodoWrite',
            args: { todos: [{ content: 'new', status: 'in_progress' }] }
          })
          ingestChatEvent({
            type: 'tool.call.completed',
            sessionId: 's',
            toolRunId: 'now',
            result: 'ok',
            isError: false
          })
        })
      }
      const items = (): string[] => dom.queryAll('[data-status]').map((item) => item.textContent)
      const expected = phase === 'current write' ? ['new'] : []
      expect(items()).toEqual(expected)
      dom.act(() =>
        chatActions.prependHistory('s', [olderUser, olderTodo, tail], { reachedStart: false })
      )
      expect(
        harnessSession()
          .messages.slice(0, 3)
          .map((message) => message.id)
      ).toEqual(['older-user', 'older-todo', 'tail'])
      expect(items()).toEqual(expected)
      const accepted = harnessSession()
      dom.act(() => chatActions.prependHistory('s', [tail, olderUser], { reachedStart: true }))
      expect(harnessSession()).toBe(accepted)
      expect(items()).toEqual(expected)
    } finally {
      dom.unmount()
    }
  }
)
