import { expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'

it('keeps OpenCode todo collapse for new turns and same-session hydration, but resets new sessions', () => {
  const collapsed = chatReducer(
    { ...initialChatState, sessionId: 's', backend: 'opencode' },
    { type: 'SET_OPENCODE_TODO_COLLAPSED', collapsed: true }
  )
  expect(collapsed.openCodeTodoCollapsed).toBe(true)
  expect(chatReducer(collapsed, { type: 'BEGIN_TURN' }).openCodeTodoCollapsed).toBe(true)
  expect(chatReducer(collapsed, { type: 'NEW_CHAT' }).openCodeTodoCollapsed).toBe(false)
  for (const id of ['s', 'other']) {
    expect(
      chatReducer(collapsed, {
        type: 'LOAD_SESSION',
        session: { id, title: null, backend: 'opencode', agentKind: 'code', messages: [] }
      }).openCodeTodoCollapsed
    ).toBe(id === 's')
  }
  expect(
    chatReducer(collapsed, {
      type: 'SET_OPENCODE_TODO_COLLAPSED',
      collapsed: false
    }).openCodeTodoCollapsed
  ).toBe(false)
})

it('ignores OpenCode todo presentation actions for Claude', () => {
  const before: ChatState = { ...initialChatState, backend: 'claude' }
  expect(chatReducer(before, { type: 'SET_OPENCODE_TODO_COLLAPSED', collapsed: true })).toBe(before)
})

it('starts each todo projection at the current turn and excludes hydrated history', () => {
  const before: ChatState = {
    ...initialChatState,
    backend: 'opencode',
    messages: [{ role: 'user' as const, createdAt: 1, parts: [] }]
  }
  const next = chatReducer(before, { type: 'BEGIN_TURN' })
  expect(next.openCodeTodoTurnStartIndex).toBe(1)
  expect(next.sendCount).toBe(1)
  expect(chatReducer(next, { type: 'NEW_CHAT' }).openCodeTodoTurnStartIndex).toBe(0)
  const loaded = chatReducer(next, {
    type: 'LOAD_SESSION',
    session: {
      id: 's',
      title: null,
      backend: 'opencode',
      agentKind: 'code',
      messages: before.messages
    }
  })
  expect(loaded.openCodeTodoTurnStartIndex).toBe(1)
  expect(loaded.sendCount).toBe(0)
})
