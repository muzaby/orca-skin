import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import type { NormalizedEvent } from '../../../../../../../shared/ipc'
import { chatReducer, initialChatState, type ChatState } from '../../../reducer/chatReducer'
import { selectOpenCodeTodos } from './todoState'
import { OpenCodeTodoDock } from './TodoDock'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))

const receive = (state: ChatState, event: NormalizedEvent): ChatState =>
  chatReducer(state, { type: 'RECV_EVENT', event })
const begin = (state: ChatState): ChatState => chatReducer(state, { type: 'BEGIN_TURN' })
function write(
  state: ChatState,
  id: string,
  content: string,
  options: {
    status?: string
    error?: boolean
    parent?: string
    resultTodos?: unknown[]
    pending?: boolean
  } = {}
): ChatState {
  const args = { todos: [{ content, status: options.status ?? 'pending' }] }
  state = receive(state, {
    type: 'tool.call.started',
    sessionId: 'A',
    toolRunId: id,
    toolName: 'TodoWrite',
    args,
    providerTool: { name: 'todowrite', input: args },
    ...(options.parent ? { parentToolRunId: options.parent } : {})
  })
  return options.pending
    ? state
    : receive(state, {
        type: 'tool.call.completed',
        sessionId: 'A',
        toolRunId: id,
        result: 'ok',
        isError: options.error ?? false,
        ...(options.parent ? { parentToolRunId: options.parent } : {}),
        ...(options.resultTodos !== undefined
          ? { structuredOutput: { todos: options.resultTodos } }
          : {})
      })
}
let dom: FakeDom
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 900, innerHeight: 800 })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('OpenCode TodoDock reducer/parts integration', () => {
  it('renders metadata from successful root results, ignoring pending/failed/child writes and clearing on empty success', () => {
    let state = begin({ ...initialChatState, backend: 'opencode', sessionId: 'A' })
    state = write(state, 'root', 'fallback', {
      resultTodos: [{ content: 'metadata', status: 'in_progress' }]
    })
    const raw = JSON.stringify(state.messages)
    expect(selectOpenCodeTodos(state)).toEqual([{ text: 'metadata', status: 'in_progress' }])
    expect(JSON.stringify(state.messages)).toBe(raw)
    state = write(state, 'pending', 'not run', { pending: true })
    state = write(state, 'failed', 'error', { error: true })
    state = write(state, 'child', 'child', { parent: 'task' })
    const render = (): void =>
      dom.render(
        createElement(OpenCodeTodoDock, {
          sessionKey: 'A',
          turnKey: state.sendCount,
          todos: selectOpenCodeTodos(state),
          live: state.inflight,
          blocked: false,
          collapsed: false,
          onCollapsedChange: vi.fn()
        })
      )
    render()
    dom.advance(320)
    const list = dom.query('[data-slot="todo-list"]')!
    expect(list.textContent).toContain('metadata')
    expect(list.textContent).not.toContain('not run')
    expect(list.textContent).not.toContain('error')
    expect(list.textContent).not.toContain('child')
    state = write(state, 'clear', 'discarded', { resultTodos: [] })
    render()
    expect(dom.query('[data-slot="todo-list"]')?.textContent).toContain('metadata')
    dom.advance(320)
    expect(dom.query('[data-slot="opencode-todo-region"]')).toBeNull()
  })
  it('uses actual BEGIN_TURN boundaries before a new user echo and never resurrects a loaded/Claude list', () => {
    let state = write(begin({ ...initialChatState, backend: 'opencode' }), 'old', 'old turn')
    expect(selectOpenCodeTodos(state)).toHaveLength(1)
    state = begin(state)
    expect(selectOpenCodeTodos(state)).toEqual([])
    // Late completion for the previous turn has no current-turn call owner.
    state = receive(state, {
      type: 'tool.call.completed',
      sessionId: 'A',
      toolRunId: 'old',
      result: 'late',
      isError: false
    })
    expect(selectOpenCodeTodos(state)).toEqual([])
    state = chatReducer(state, { type: 'APPEND_COMMITTED_USER_MESSAGE', text: 'next turn' })
    state = write(state, 'new', 'new turn')
    expect(selectOpenCodeTodos(state)).toEqual([{ text: 'new turn', status: 'pending' }])
    expect(selectOpenCodeTodos({ ...state, backend: 'claude' })).toEqual([])
    expect(selectOpenCodeTodos({ ...state, sendCount: 0 })).toEqual([])
  })
  it('uses successful completion order, even when earlier calls finish last', () => {
    let state = begin({ ...initialChatState, backend: 'opencode' })
    state = write(state, 'slow', 'last completion', { pending: true })
    state = write(state, 'fast', 'first completion')
    state = receive(state, {
      type: 'tool.call.completed',
      sessionId: 'A',
      toolRunId: 'slow',
      result: 'ok',
      isError: false
    })
    expect(selectOpenCodeTodos(state)).toEqual([{ text: 'last completion', status: 'pending' }])
  })
})
