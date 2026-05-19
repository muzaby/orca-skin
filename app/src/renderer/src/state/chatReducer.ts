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
  createdAt: number
  toolCalls?: ToolCall[]
}

export interface ChatState {
  sessionId: string | null
  // 어댑터가 발급한 세션의 working directory (`init` 이벤트). Composer 의 `@`
  // 파일 자동완성이 이 경로 기준으로 디렉토리를 리스팅한다.
  cwd: string | null
  messages: Message[]
  pendingDelta: string
  inflight: boolean
  turnStartedAt: number | null
  pendingInputTokens?: number
  error?: { code: ErrorCode; message: string; recoverable: boolean }
}

export const initialChatState: ChatState = {
  sessionId: null,
  cwd: null,
  messages: [],
  pendingDelta: '',
  inflight: false,
  turnStartedAt: null
}

export type ChatAction =
  | { type: 'SEND_USER_MESSAGE'; text: string }
  | { type: 'RECV_EVENT'; event: ChatEvent }
  | { type: 'NEW_CHAT' }
  | { type: 'CANCEL_CHAT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESTORE_SESSION'; sessionId: string }
  | { type: 'SET_CWD'; cwd: string }

function upsertToolCall(messages: Message[], tc: ToolCall): Message[] {
  // 마지막 assistant 메시지에 부착. 없으면 새로 만든다.
  const idx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i
    }
    return -1
  })()
  if (idx === -1) {
    return [...messages, { role: 'assistant', content: '', createdAt: Date.now(), toolCalls: [tc] }]
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
        messages: [
          ...state.messages,
          { role: 'user', content: action.text, createdAt: Date.now() }
        ],
        pendingDelta: '',
        inflight: true,
        turnStartedAt: Date.now(),
        pendingInputTokens: undefined,
        error: undefined
      }

    case 'RECV_EVENT': {
      const ev = action.event
      switch (ev.type) {
        case 'init':
          return { ...state, sessionId: ev.data.sessionId, cwd: ev.data.cwd }

        case 'assistant_delta':
          return { ...state, pendingDelta: state.pendingDelta + ev.data.text }

        case 'assistant_message': {
          // pendingDelta 가 있으면 그것을 최종본으로 교체하고, 아니면 신규 메시지 추가
          const last = state.messages[state.messages.length - 1]
          if (state.pendingDelta && last?.role === 'assistant' && last.content === '') {
            const next = state.messages.slice()
            next[next.length - 1] = { ...last, content: ev.data.text, createdAt: Date.now() }
            return { ...state, messages: next, pendingDelta: '' }
          }
          return {
            ...state,
            messages: [
              ...state.messages,
              { role: 'assistant', content: ev.data.text, createdAt: Date.now() }
            ],
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
          const inputTokens = ev.data.usage?.inputTokens
          const base = {
            ...state,
            inflight: false,
            turnStartedAt: null,
            ...(inputTokens != null ? { pendingInputTokens: inputTokens } : {})
          }
          // pendingDelta 가 아직 남아있으면 최종 메시지로 굳힌다
          if (state.pendingDelta) {
            return {
              ...base,
              messages: [
                ...state.messages,
                { role: 'assistant', content: state.pendingDelta, createdAt: Date.now() }
              ],
              pendingDelta: ''
            }
          }
          return base
        }

        case 'error':
          return { ...state, error: ev.data, inflight: false, turnStartedAt: null }
      }
      return state
    }

    case 'NEW_CHAT':
      // cwd 는 새 세션에서도 동일 (main 의 단일 default). 새 대화 즉시 `@` picker
      // 가 동작하도록 보존 — init 이벤트가 와도 같은 값으로 덮어쓰기만 함.
      return { ...initialChatState, cwd: state.cwd }

    case 'SET_CWD':
      return { ...state, cwd: action.cwd }

    case 'CANCEL_CHAT':
      return { ...state, inflight: false, turnStartedAt: null }

    case 'CLEAR_ERROR':
      return { ...state, error: undefined }

    // 앱 부트 시 영속화된 lastSessionId 를 주입. 메시지 히스토리는 비어 있는 채로
    // 다음 사용자 턴이 SDK 에 sessionId 를 전달하면 어댑터가 resume 한다.
    case 'RESTORE_SESSION':
      if (state.sessionId || state.messages.length > 0) return state
      return { ...state, sessionId: action.sessionId }
  }
}
