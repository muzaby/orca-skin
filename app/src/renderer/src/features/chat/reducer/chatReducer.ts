import type {
  AskQuestionRequest,
  NormalizedEvent,
  ClassifiedError,
  LoadedSession,
  PermissionMode,
  PlanReviewRequest
} from '../../../../../shared/ipc'

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
  // 사이드바 메타 (또는 LoadedSession.title) 에서 즉시 채워지는 세션 제목. 사용자가
  // 세션을 클릭한 순간부터 헤더에 표시되며, 메시지 도착 시점에 한 번 더 reconcile.
  title: string | null
  // 새 채팅 첫 메시지의 소속 프로젝트. ProjectDetail 진입 시 NEW_CHAT 액션에서 세팅되고,
  // 첫 메시지 send → init 이벤트 시점에 sessionId 가 발급되면 사실상 역할 종료. send 시
  // 함께 IPC 페이로드에 실어 main 으로 보낸다.
  pendingProjectId: string | null
  // 어댑터가 발급한 세션의 working directory (`init` 이벤트). Composer 의 `@`
  // 파일 자동완성이 이 경로 기준으로 디렉토리를 리스팅한다.
  cwd: string | null
  messages: Message[]
  pendingDelta: string
  inflight: boolean
  // 사이드바 세션 클릭 또는 부팅 시 lastSessionId 자동 복원으로 메시지를 비동기 로드하는
  // 동안 true. ChatPane 이 인디케이터를 표시한다.
  loadingSession: boolean
  turnStartedAt: number | null
  pendingInputTokens?: number
  error?: ClassifiedError
  // Claude 가 AskUserQuestion 으로 던진 미응답 질문 묶음 큐. canUseTool 이 query 를 일시
  // 중지한 채 응답을 기다리므로 보통 길이 0~1 이지만, 안전하게 큐로 모델링해 앞에서 소비한다.
  pendingAsks: AskQuestionRequest[]
  // Composer 모드 버튼이 정하는 이 대화의 권한 모드. send 시 IPC 페이로드로 실린다.
  // 새 대화마다 기본값 'plan' 으로 리셋(initialChatState).
  permissionMode: PermissionMode
  // plan 모드에서 에이전트가 제출한 계획(ExitPlanMode). canUseTool 직렬화로 동시 1개.
  // 승인/수정/거부 시 null. (백엔드 중립 — SDK 를 모름.) 우측 계획 타일의 액션바
  // (승인/수정/거부) 노출 여부 + requestId 의 소스.
  pendingPlanReview: PlanReviewRequest | null
  // 우측 계획 타일(분할 tile)의 가시성. plan_review 도착 시 자동 true(auto-trigger),
  // 헤더 토글 버튼/닫기 X 로 수동 제어.
  planTileOpen: boolean
  // 우측 계획 타일의 폭(px). 분리선 드래그로 조절, clamp 280–640.
  planTileWidth: number
  // 우측 계획 타일에 표시할 마지막 계획 마크다운. 승인/거부 후에도 유지해 읽기전용으로
  // 계속 보여준다(= pendingPlanReview 와 수명 분리). 세션 전환/새 대화 시 비움.
  planContent: string | null
  // 위험 도구(Bash/Write/Edit 등) 실행 승인 게이트. permission.requested(tool_approval)
  // 도착 시 세팅, 허용/세션허용/거부 응답 시 null. canUseTool 직렬화로 동시 1개.
  pendingToolApproval: { approvalId: string; toolName: string; input: unknown } | null
}

export const initialChatState: ChatState = {
  sessionId: null,
  title: null,
  pendingProjectId: null,
  cwd: null,
  messages: [],
  pendingDelta: '',
  inflight: false,
  loadingSession: false,
  turnStartedAt: null,
  pendingAsks: [],
  permissionMode: 'plan',
  pendingPlanReview: null,
  planTileOpen: false,
  planTileWidth: 360,
  planContent: null,
  pendingToolApproval: null
}

// 계획 타일 폭 clamp 범위.
export const PLAN_TILE_MIN_WIDTH = 280
export const PLAN_TILE_MAX_WIDTH = 640

// 메모리 캐시에 저장하는 한 세션의 snapshot. useChat 의 cacheRef 가 다룬다.
export interface CachedSession {
  title: string | null
  messages: Message[]
}

export type ChatAction =
  | { type: 'SEND_USER_MESSAGE'; text: string }
  | { type: 'RECV_EVENT'; event: NormalizedEvent }
  | { type: 'NEW_CHAT'; projectId?: string | null }
  | { type: 'CANCEL_CHAT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_CWD'; cwd: string }
  | { type: 'START_LOAD_SESSION'; sessionId: string; title: string | null }
  | { type: 'LOAD_SESSION'; session: LoadedSession }
  | { type: 'LOAD_SESSION_FROM_CACHE'; sessionId: string; cached: CachedSession }
  | { type: 'LOAD_SESSION_ERROR' }
  | { type: 'RENAME_SESSION'; sessionId: string; title: string }
  // 사용자가 질문에 답하거나 건너뛰어 해당 requestId 의 카드를 큐에서 제거.
  | { type: 'RESOLVE_ASK'; requestId: string }
  // Composer 모드 버튼 선택 (계획 / 편집 수락).
  | { type: 'SET_PERMISSION_MODE'; mode: PermissionMode }
  // 계획 카드 응답(승인/수정/거부) 후 액션 게이트 제거(타일 내용은 유지).
  | { type: 'RESOLVE_PLAN' }
  // 위험 도구 승인 카드 응답(허용/세션허용/거부) 후 게이트 제거.
  | { type: 'RESOLVE_TOOL_APPROVAL' }
  // 우측 계획 타일 가시성 토글(헤더 버튼).
  | { type: 'TOGGLE_PLAN_TILE' }
  // 우측 계획 타일 가시성 명시 설정(닫기 X).
  | { type: 'SET_PLAN_TILE_OPEN'; open: boolean }
  // 우측 계획 타일 폭 설정(분리선 드래그). clamp 는 리듀서가 적용.
  | { type: 'SET_PLAN_TILE_WIDTH'; width: number }

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
        case 'session.updated':
          // sessionId 발급 시점(claude init) → pendingProjectId 역할 종료(binding 완료). cwd 갱신.
          return {
            ...state,
            sessionId: ev.sessionId,
            cwd: ev.patch.cwd ?? state.cwd,
            pendingProjectId: null
          }

        case 'message.delta':
          return { ...state, pendingDelta: state.pendingDelta + ev.delta.text }

        case 'message.completed': {
          // pendingDelta 가 있으면 그것을 최종본으로 교체하고, 아니면 신규 메시지 추가
          const last = state.messages[state.messages.length - 1]
          if (state.pendingDelta && last?.role === 'assistant' && last.content === '') {
            const next = state.messages.slice()
            next[next.length - 1] = { ...last, content: ev.message.text, createdAt: Date.now() }
            return { ...state, messages: next, pendingDelta: '' }
          }
          return {
            ...state,
            messages: [
              ...state.messages,
              { role: 'assistant', content: ev.message.text, createdAt: Date.now() }
            ],
            pendingDelta: ''
          }
        }

        case 'tool.call.started':
          return {
            ...state,
            messages: upsertToolCall(state.messages, {
              toolUseId: ev.toolRunId,
              name: ev.toolName,
              input: ev.args
            })
          }

        case 'tool.call.completed':
          return {
            ...state,
            messages: updateToolResult(state.messages, ev.toolRunId, {
              output: ev.result,
              isError: ev.isError,
              durationMs: ev.durationMs
            })
          }

        case 'telemetry': {
          const inputTokens = ev.usage?.inputTokens
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

        case 'permission.requested':
          // 권한 요청을 종류별 UI 상태로 분기. ask/plan 은 approvalId === action.request.requestId,
          // tool 은 ev.approvalId 를 키로 단일 permissionRespond 채널로 회신한다.
          if (ev.action.kind === 'ask_question') {
            return { ...state, pendingAsks: [...state.pendingAsks, ev.action.request] }
          }
          if (ev.action.kind === 'plan_review') {
            // 계획 도착 → 액션 게이트 설정 + 우측 타일에 내용 표시 + 자동 오픈(auto-trigger).
            return {
              ...state,
              pendingPlanReview: ev.action.request,
              planContent: ev.action.request.plan,
              planTileOpen: true
            }
          }
          // tool_approval — 위험 도구 실행 승인 게이트. approvalId 로 응답을 라우팅한다.
          return {
            ...state,
            pendingToolApproval: {
              approvalId: ev.approvalId,
              toolName: ev.action.toolName,
              input: ev.action.input
            }
          }

        case 'permission.resolved':
          // 해소 이벤트는 audit/telemetry 용 — 카드는 respond 시 로컬 RESOLVE_* 로 이미 닫힌다.
          return state

        case 'error':
          // 턴이 끊기면 보류 게이트(질문/계획/도구)는 main 이 broker abort 로 정리하므로 카드도 비운다.
          return {
            ...state,
            error: ev.error,
            inflight: false,
            turnStartedAt: null,
            pendingAsks: [],
            pendingPlanReview: null,
            pendingToolApproval: null
          }
      }
      return state
    }

    case 'NEW_CHAT':
      // cwd 는 새 세션에서도 동일 (main 의 단일 default). 새 대화 즉시 `@` picker
      // 가 동작하도록 보존 — init 이벤트가 와도 같은 값으로 덮어쓰기만 함.
      // projectId 가 명시되면 새 세션이 해당 프로젝트에 binding 될 준비.
      return { ...initialChatState, cwd: state.cwd, pendingProjectId: action.projectId ?? null }

    case 'SET_CWD':
      return { ...state, cwd: action.cwd }

    case 'CANCEL_CHAT':
      // 턴 취소 시 main 의 broker 가 보류 게이트를 해소하므로 카드(질문/계획/도구)도 함께 비운다.
      return {
        ...state,
        inflight: false,
        turnStartedAt: null,
        pendingAsks: [],
        pendingPlanReview: null,
        pendingToolApproval: null
      }

    case 'CLEAR_ERROR':
      return { ...state, error: undefined }

    // 사이드바 클릭 또는 부팅 시 자동 복원으로 비동기 load 가 시작된 시점. sessionId
    // 와 title 을 낙관적으로 세팅해 사이드바 selected 강조 + 헤더 제목을 메시지 도착
    // 전에도 즉시 표시한다. title 이 null 인 경우는 부팅 자동 복원 (사이드바 메타가
    // 아직 도착 안 한 시점) 뿐 — IPC 응답의 LoadedSession.title 로 reconcile.
    case 'START_LOAD_SESSION':
      return {
        ...initialChatState,
        cwd: state.cwd,
        sessionId: action.sessionId,
        title: action.title,
        loadingSession: true
      }

    // 사이드바에서 과거 대화를 선택했을 때 IPC 응답 (LoadedSession) 으로 state 를 통째로 교체.
    // cwd 는 main 의 단일 default 가 진실이므로 보존한다.
    case 'LOAD_SESSION': {
      const messages: Message[] = action.session.messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        ...(m.toolCalls && m.toolCalls.length > 0
          ? {
              toolCalls: m.toolCalls.map((tc) => ({
                toolUseId: tc.toolUseId,
                name: tc.name,
                input: tc.input,
                ...(tc.result ? { result: tc.result } : {})
              }))
            }
          : {})
      }))
      return {
        ...initialChatState,
        cwd: state.cwd,
        sessionId: action.session.id,
        title: action.session.title,
        messages
      }
    }

    // 메모리 캐시 hit — IPC 없이 즉시 교체. loadingSession 도 즉시 false.
    case 'LOAD_SESSION_FROM_CACHE':
      return {
        ...initialChatState,
        cwd: state.cwd,
        sessionId: action.sessionId,
        title: action.cached.title,
        messages: action.cached.messages
      }

    // DB 에 row 가 없거나 IPC 실패. 빈 ChatPane 으로 fallback — lastSessionId 같은
    // 영속값은 호출 측에서 정리한다.
    case 'LOAD_SESSION_ERROR':
      return { ...initialChatState, cwd: state.cwd }

    // 활성 세션의 제목이 변경된 경우에만 reducer state 갱신. 다른 세션의 rename
    // 은 useChat 의 cacheRef 가 처리하므로 reducer 무관 (no-op).
    case 'RENAME_SESSION':
      if (state.sessionId !== action.sessionId) return state
      return { ...state, title: action.title }

    case 'RESOLVE_ASK':
      return {
        ...state,
        pendingAsks: state.pendingAsks.filter((a) => a.requestId !== action.requestId)
      }

    case 'SET_PERMISSION_MODE':
      return { ...state, permissionMode: action.mode }

    case 'RESOLVE_PLAN':
      // 액션 게이트만 닫는다 — planContent/planTileOpen 은 유지(검토 후 읽기전용 표시).
      return { ...state, pendingPlanReview: null }

    case 'RESOLVE_TOOL_APPROVAL':
      // 위험 도구 승인 카드 응답 후 게이트 제거 → Composer 입력창 복귀.
      return { ...state, pendingToolApproval: null }

    case 'TOGGLE_PLAN_TILE':
      return { ...state, planTileOpen: !state.planTileOpen }

    case 'SET_PLAN_TILE_OPEN':
      return { ...state, planTileOpen: action.open }

    case 'SET_PLAN_TILE_WIDTH':
      return {
        ...state,
        planTileWidth: clampPlanTileWidth(action.width)
      }
  }
}

const clampPlanTileWidth = (n: number): number =>
  Math.max(PLAN_TILE_MIN_WIDTH, Math.min(PLAN_TILE_MAX_WIDTH, Math.round(n)))
