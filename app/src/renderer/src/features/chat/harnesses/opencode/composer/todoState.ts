import { partsToolCalls } from '../../../lib/parts'
import type { Message } from '../../../reducer/chatReducer'
import { readSuccessfulTodos, type OpenCodeTodo } from '../toolPresentation'

export const TODO_CLOSE_DELAY = 400
export const TODO_MOTION_DURATION = 300
export const TODO_OVERLAP = 36

/** The reducer records this boundary before a new user echo, so old work never flashes. */
export function selectOpenCodeTodos(state: {
  backend: string | null
  messages: Message[]
  sendCount: number
  openCodeTodoTurnStartIndex: number
}): OpenCodeTodo[] {
  if (state.backend !== 'opencode' || state.sendCount === 0) return []
  const parts = state.messages
    .slice(state.openCodeTodoTurnStartIndex)
    .filter((message) => message.role === 'assistant')
    .flatMap((message) => message.parts)
  const calls = partsToolCalls(parts)
  // Completion order, rather than call-start order, decides the latest successful write.
  const callsById = new Map(calls.map((call) => [call.toolUseId, call]))
  let latest: OpenCodeTodo[] = []
  for (const part of parts) {
    if (part.type !== 'tool_result' || part.parentToolRunId !== undefined) continue
    const call = callsById.get(part.toolRunId)
    if (!call) continue
    const todos = readSuccessfulTodos(call)
    if (todos !== undefined) latest = todos
  }
  return latest
}

export function summarizeTodos(todos: readonly OpenCodeTodo[]): {
  completed: number
  terminal: boolean
  representative: OpenCodeTodo | undefined
} {
  return {
    completed: todos.filter((todo) => todo.status === 'completed').length,
    terminal:
      todos.length > 0 &&
      todos.every((todo) => todo.status === 'completed' || todo.status === 'cancelled'),
    representative:
      todos.find((todo) => todo.status === 'in_progress') ??
      todos.find((todo) => todo.status === 'pending') ??
      [...todos].reverse().find((todo) => todo.status === 'completed') ??
      todos[0]
  }
}

export interface TodoDockState {
  key: string
  snapshot: readonly OpenCodeTodo[]
  phase: 'hidden' | 'open' | 'closing'
  closeDelay: number | null
  closingId: number
}

export interface TodoDockInput {
  key: string
  todos: readonly OpenCodeTodo[]
  live: boolean
  blocked: boolean
  reducedMotion: boolean
}

export const emptyTodoDock = (key: string): TodoDockState => ({
  key,
  snapshot: [],
  phase: 'hidden',
  closeDelay: null,
  closingId: 0
})

function sameTodos(a: readonly OpenCodeTodo[], b: readonly OpenCodeTodo[]): boolean {
  return (
    a.length === b.length &&
    a.every((todo, i) => todo.text === b[i].text && todo.status === b[i].status)
  )
}

export function updateTodoDock(previous: TodoDockState, input: TodoDockInput): TodoDockState {
  const state =
    previous.key === input.key
      ? previous
      : {
          ...emptyTodoDock(input.key),
          closingId: previous.closingId + 1
        }
  const summary = summarizeTodos(input.todos)
  let next: TodoDockState
  if (input.blocked) {
    next = { ...state, phase: 'hidden', closeDelay: null }
  } else if (input.live && input.todos.length > 0 && !summary.terminal) {
    next = { ...state, snapshot: input.todos, phase: 'open', closeDelay: null }
  } else if (state.snapshot.length > 0 && state.phase !== 'hidden' && !input.reducedMotion) {
    const delay = input.live && summary.terminal ? TODO_CLOSE_DELAY : 0
    next = {
      ...state,
      snapshot: input.todos.length > 0 ? input.todos : state.snapshot,
      phase: 'closing',
      closeDelay: Math.min(state.closeDelay ?? delay, delay),
      closingId: state.phase === 'closing' ? state.closingId : state.closingId + 1
    }
  } else {
    next = { ...emptyTodoDock(input.key), closingId: state.closingId }
  }
  return next.key === previous.key &&
    next.phase === previous.phase &&
    next.closeDelay === previous.closeDelay &&
    next.closingId === previous.closingId &&
    sameTodos(next.snapshot, previous.snapshot)
    ? previous
    : next
}
