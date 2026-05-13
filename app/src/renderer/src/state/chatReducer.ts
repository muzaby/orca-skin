import type { ChatEvent, ErrorCode } from '../../../shared/ipc'

export interface ToolCall {
  toolUseId: string
  name: string
  input: unknown
  result?: { output: unknown; isError: boolean; durationMs?: number }
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
}

export interface ChatState {
  sessionId: string | null
  messages: Message[]
  pendingDelta: string
  inflight: boolean
  error?: { code: ErrorCode; message: string; recoverable: boolean }
}

export const initialChatState: ChatState = {
  sessionId: null,
  messages: [],
  pendingDelta: '',
  inflight: false
}

export type ChatAction =
  | { type: 'SEND_USER_MESSAGE'; text: string }
  | { type: 'RECV_EVENT'; event: ChatEvent }
  | { type: 'NEW_CHAT' }
  | { type: 'CANCEL_CHAT' }
  | { type: 'CLEAR_ERROR' }

function upsertToolCall(messages: Message[], tc: ToolCall): Message[] {
  // 마지막 assistant 메시지에 부착. 없으면 새로 만든다.
  const idx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i
    }
    return -1
  })()
  if (idx === -1) {
    return [...messages, { role: 'assistant', content: '', toolCalls: [tc] }]
  }
  const next = messages.slice()
  const m = next[idx]
  const calls = m.toolCalls ?? []
  const existing = calls.findIndex((c) => c.toolUseId === tc.toolUseId)
  if (existing >= 0) {
    const merged = { ...calls[existing], ...tc }
    next[idx] = { ...m, toolCalls: calls.map((c, i) => (i === existing ? merged : c)) }
  } else {
    next[idx] = { ...m, toolCalls: [...calls, tc] }
  }
  return next
}

function updateToolResult(
  messages: Message[],
  toolUseId: string,
  result: NonNullable<ToolCall['result']>
): Message[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m.toolCalls) continue
    const callIdx = m.toolCalls.findIndex((c) => c.toolUseId === toolUseId)
    if (callIdx >= 0) {
      const next = messages.slice()
      const updated = { ...m.toolCalls[callIdx], result }
      next[i] = {
        ...m,
        toolCalls: m.toolCalls.map((c, idx) => (idx === callIdx ? updated : c))
      }
      return next
    }
  }
  return messages
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SEND_USER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, { role: 'user', content: action.text }],
        pendingDelta: '',
        inflight: true,
        error: undefined
      }

    case 'RECV_EVENT': {
      const ev = action.event
      switch (ev.type) {
        case 'init':
          return { ...state, sessionId: ev.data.sessionId }

        case 'assistant_delta':
          return { ...state, pendingDelta: state.pendingDelta + ev.data.text }

        case 'assistant_message': {
          // pendingDelta 가 있으면 그것을 최종본으로 교체하고, 아니면 신규 메시지 추가
          const last = state.messages[state.messages.length - 1]
          if (state.pendingDelta && last?.role === 'assistant' && last.content === '') {
            const next = state.messages.slice()
            next[next.length - 1] = { ...last, content: ev.data.text }
            return { ...state, messages: next, pendingDelta: '' }
          }
          return {
            ...state,
            messages: [...state.messages, { role: 'assistant', content: ev.data.text }],
            pendingDelta: ''
          }
        }

        case 'tool_use':
          return {
            ...state,
            messages: upsertToolCall(state.messages, {
              toolUseId: ev.data.toolUseId,
              name: ev.data.name,
              input: ev.data.input
            })
          }

        case 'tool_result':
          return {
            ...state,
            messages: updateToolResult(state.messages, ev.data.toolUseId, {
              output: ev.data.output,
              isError: ev.data.isError,
              durationMs: ev.data.durationMs
            })
          }

        case 'result': {
          // pendingDelta 가 아직 남아있으면 최종 메시지로 굳힌다
          if (state.pendingDelta) {
            return {
              ...state,
              messages: [...state.messages, { role: 'assistant', content: state.pendingDelta }],
              pendingDelta: '',
              inflight: false
            }
          }
          return { ...state, inflight: false }
        }

        case 'error':
          return { ...state, error: ev.data, inflight: false }
      }
      return state
    }

    case 'NEW_CHAT':
      return { ...initialChatState }

    case 'CANCEL_CHAT':
      return { ...state, inflight: false }

    case 'CLEAR_ERROR':
      return { ...state, error: undefined }
  }
}
