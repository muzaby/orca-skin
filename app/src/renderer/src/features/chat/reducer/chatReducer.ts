import type {
  AppMessagePart,
  AskQuestionRequest,
  AttachmentView,
  NormalizedEvent,
  ClassifiedError,
  LoadedSession,
  PlanReviewRequest,
  ProviderReportedTelemetry,
  SubagentTaskMeta,
  Backend,
  EffortLevel
} from '../../../../../shared/ipc'
import type { NormalizedPermissionMode } from '../../../../../shared/permission-mode'
import { contextTokens } from '../lib/telemetry'
import { settleOrphanToolParts } from '../lib/parts'
import type { RightPanelTileId } from '../lib/rightPanelTiles'
import {
  addTileColumnMajor,
  columnsContain,
  removeTileFromColumns,
  type RightPanelColumns
} from '../lib/rightPanelLayout'

// transcript 렌더가 쓰는 도구 호출 view — parts 의 tool_call+tool_result 를 toolRunId 로
// 페어링한 결과(lib/parts.ts partsToolCalls). 더 이상 Message 의 필드가 아니다.
export interface ToolCall {
  toolUseId: string
  name: string
  input: unknown
  result?: {
    output: unknown
    isError: boolean
    durationMs?: number
    parentToolRunId?: string
    // 부모 Task tool_result 면 서브에이전트 영속 메타(모델·시간·도구수) — 재로드 후 카드/행 복원.
    subagentMeta?: SubagentTaskMeta
  }
  parentToolRunId?: string
}

// 계획 패널 인라인 코멘트 1건(휘발성 — 세션 상태). quote=선택 본문 스냅샷, start/end=계획
// 본문 textContent 기준 오프셋(하이라이트 매핑·문서 순서), body=사용자 의견. 전송 시 IPC
// PlanFeedbackComment 로 변환(lib/planComments.ts toPlanFeedback).
export interface PlanComment {
  id: string
  quote: string
  start: number
  end: number
  body: string
  createdAt: number
}

// 메시지 = 순서 보존 parts 목록(provider-runtime.md §7). text 는 lib/parts.ts 셀렉터로 합치고,
// tool_call/tool_result 는 toolRunId 로 페어링해 렌더한다.
export interface Message {
  role: 'user' | 'assistant'
  createdAt: number
  parts: AppMessagePart[]
  incomplete?: boolean
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
  projectId: string | null
  backend: Backend | null
  providerKey: string | null
  modelFamily: string | null
  effort: EffortLevel
  // 어댑터가 발급한 세션의 working directory (`init` 이벤트). Composer 의 `@`
  // 파일 자동완성이 이 경로 기준으로 디렉토리를 리스팅한다.
  cwd: string | null
  // 커밋된 transcript 메시지(SSOT 는 DB, 이 배열은 그 미러). 스트리밍 라이브 텍스트/사고는
  // 여기 없다 — chatStore 의 live 슬라이스(transient)가 담당하고, 완성 시 parts 로 커밋된다.
  messages: Message[]
  // 이 세션 뷰에서 사용자가 라이브로 전송한 횟수(단조 증가, 세션 전환/새 채팅 시 0 리셋).
  // useScrollAnchor 가 "새 user 메시지 앵커" 트리거로 쓴다 — 메시지 배열 휴리스틱(로드된
  // 세션의 마지막 user 메시지 등 오탐) 없이 SEND 만 정확히 감지하기 위한 카운터.
  sendCount: number
  inflight: boolean
  // 사이드바 세션 클릭 또는 부팅 시 lastSessionId 자동 복원으로 메시지를 비동기 로드하는
  // 동안 true. ChatPane 이 인디케이터를 표시한다.
  loadingSession: boolean
  turnStartedAt: number | null
  // 마지막 턴의 provider-reported 통계(model·토큰·캐시 분해). 컨텍스트 도넛 + TelemetryPanel(입력·
  // 캐시·윈도우·사용%)의 소스. 턴 종료(telemetry) 시 세팅, 세션 로드 시 turn_usage 최신 행에서
  // 복원, 새 대화에서만 비움. SEND 는 비우지 않아 턴 진행 중에도 도넛이 유지된다.
  // 비용/지연은 패널에서 빠졌고 비용은 turn_usage 원장(집계)이 SSOT 라 state 에 두지 않는다.
  lastTelemetry?: ProviderReportedTelemetry
  error?: ClassifiedError
  retry?: { attempt: number; max: number; category: string }
  // Claude 가 AskUserQuestion 으로 던진 미응답 질문 묶음 큐. canUseTool 이 query 를 일시
  // 중지한 채 응답을 기다리므로 보통 길이 0~1 이지만, 안전하게 큐로 모델링해 앞에서 소비한다.
  pendingAsks: AskQuestionRequest[]
  // Composer 모드 버튼이 정하는 이 대화의 권한 모드. send 시 IPC 페이로드로 실린다.
  // 새 대화마다 기본값 'plan' 으로 리셋(initialChatState).
  permissionMode: NormalizedPermissionMode
  // plan 모드에서 에이전트가 제출한 계획(ExitPlanMode). canUseTool 직렬화로 동시 1개.
  // 승인/수정/거부 시 null. (백엔드 중립 — SDK 를 모름.) 우측 계획 타일의 액션바
  // (승인/수정/거부) 노출 여부 + requestId 의 소스.
  pendingPlanReview: PlanReviewRequest | null
  // 우측 패널 안의 활성 타일. 열 구조(열당 최대 ROWS_PER_COL)를 직접 들고 있어 제거 시
  // 다른 열로 리플로우되지 않는다(rightPanelLayout 참고). 추가는 column-major 로 채운다.
  rightPanelTiles: RightPanelColumns
  // 우측 패널 타일별 사용자 라벨 오버라이드. 값이 없으면 tile registry 의 기본 라벨을 쓴다.
  rightPanelTileLabels: Partial<Record<RightPanelTileId, string>>
  // 우측 패널 열별 폭(px). 분리선 드래그로 조절, clamp 280–640.
  rightPanelColWidths: number[]
  // 우측 패널 열 내부의 상단 행 비율. 행 분리선 드래그로 조절, clamp 0.2–0.8.
  rightPanelRowSplits: number[]
  // 우측 서브에이전트 타일에서 상세로 표시할 부모 Task toolRunId. null 이면 목록 view.
  selectedSubagentTaskId: string | null
  // 우측 계획 타일에 표시할 마지막 계획 마크다운. 승인/거부 후에도 유지해 읽기전용으로
  // 계속 보여준다(= pendingPlanReview 와 수명 분리). 세션 전환/새 대화 시 비움.
  planContent: string | null
  // 계획 검토 중(pendingPlanReview) 사용자가 본문에 남긴 인라인 코멘트(휘발성). 계획 해소
  // (RESOLVE_PLAN)·새 대화·세션 전환 시 비운다. revise 전송 시 구조화 태그로 직렬화된다.
  planComments: PlanComment[]
  // 패널↔composer 조정용 — 편집 대상 코멘트(패널이 해당 코멘트 팝오버를 열고 스크롤).
  // selectedSubagentTaskId 와 동형의 UI 선택 상태.
  activePlanCommentId: string | null
  // 위험 도구(Bash/Write/Edit 등) 실행 승인 게이트 큐. permission.requested(tool_approval)
  // 도착마다 append, 응답(허용/세션허용/거부) 시 해당 approvalId 만 제거. 서브에이전트·병렬
  // tool_use 는 canUseTool 을 동시 호출해 여러 승인이 겹칠 수 있으므로 큐로 모델링한다(단일
  // 슬롯이면 직전 카드가 덮어써져 사라지고 해당 broker 보류가 영구 inflight 로 고착).
  pendingToolApprovals: { approvalId: string; toolName: string; input: unknown }[]
}

export const initialChatState: ChatState = {
  sessionId: null,
  title: null,
  pendingProjectId: null,
  projectId: null,
  backend: null,
  providerKey: null,
  modelFamily: null,
  effort: 'high',
  cwd: null,
  messages: [],
  sendCount: 0,
  inflight: false,
  loadingSession: false,
  turnStartedAt: null,
  pendingAsks: [],
  permissionMode: 'plan',
  pendingPlanReview: null,
  rightPanelTiles: [],
  rightPanelTileLabels: {},
  rightPanelColWidths: [],
  rightPanelRowSplits: [],
  selectedSubagentTaskId: null,
  planContent: null,
  planComments: [],
  activePlanCommentId: null,
  pendingToolApprovals: []
}

// 우측 패널 열 폭/행 분할 clamp 범위.
export const PANEL_MIN_WIDTH = 280
export const PANEL_MAX_WIDTH = 640
export const PANEL_DEFAULT_WIDTH = 360
export const PANEL_MIN_ROW_SPLIT = 0.2
export const PANEL_MAX_ROW_SPLIT = 0.8
export const PANEL_DEFAULT_ROW_SPLIT = 0.5

export type ChatAction =
  | { type: 'SEND_USER_MESSAGE'; text: string; attachmentViews?: AttachmentView[] }
  | { type: 'APPEND_COMMITTED_USER_MESSAGE'; text: string; createdAt?: number }
  | {
      type: 'SET_MODEL'
      providerKey: string | null
      modelFamily: string | null
      adapter?: string | null
    }
  | { type: 'SET_EFFORT'; effort: EffortLevel }
  | { type: 'RECV_EVENT'; event: NormalizedEvent }
  // 턴이 message.completed 없이 끝났을 때(telemetry 도착 시점) live 버퍼의 잔여 텍스트를
  // text 파트로 굳힌다. 버퍼 소유자는 chatStore — reducer 는 텍스트만 받는다.
  | { type: 'COMMIT_PENDING_TEXT'; text: string }
  | { type: 'NEW_CHAT'; projectId?: string | null }
  | { type: 'CANCEL_CHAT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_CWD'; cwd: string }
  | { type: 'START_LOAD_SESSION'; sessionId: string; title: string | null }
  | { type: 'LOAD_SESSION'; session: LoadedSession }
  | { type: 'RENAME_SESSION'; sessionId: string; title: string }
  // 사용자가 질문에 답하거나 건너뛰어 해당 requestId 의 카드를 큐에서 제거.
  | { type: 'RESOLVE_ASK'; requestId: string }
  // Composer 모드 버튼 선택 (계획 / 편집 수락).
  | { type: 'SET_PERMISSION_MODE'; mode: NormalizedPermissionMode }
  // 계획 카드 응답(승인/수정/거부) 후 액션 게이트 제거(타일 내용은 유지).
  | { type: 'RESOLVE_PLAN' }
  // 계획 패널 인라인 코멘트 추가/편집/삭제 + 편집 대상 선택.
  | { type: 'ADD_PLAN_COMMENT'; comment: PlanComment }
  | { type: 'UPDATE_PLAN_COMMENT'; id: string; body: string }
  | { type: 'REMOVE_PLAN_COMMENT'; id: string }
  | { type: 'SET_ACTIVE_PLAN_COMMENT'; id: string | null }
  // 위험 도구 승인 카드 응답(허용/세션허용/거부) 후 게이트 제거.
  | { type: 'RESOLVE_TOOL_APPROVAL'; approvalId: string }
  // 우측 패널 타일 활성 상태/라벨/레이아웃 조작.
  | { type: 'TOGGLE_RIGHT_PANEL_TILE'; id: RightPanelTileId }
  | { type: 'SET_RIGHT_PANEL_TILE_ACTIVE'; id: RightPanelTileId; active: boolean }
  | { type: 'RENAME_RIGHT_PANEL_TILE'; id: RightPanelTileId; label: string }
  | { type: 'REMOVE_RIGHT_PANEL_TILE'; id: RightPanelTileId }
  | { type: 'SELECT_SUBAGENT_TASK'; toolRunId: string | null }
  | { type: 'OPEN_SUBAGENT_TASK'; toolRunId: string }
  | { type: 'SET_RIGHT_PANEL_COL_WIDTH'; col: number; width: number }
  | { type: 'SET_RIGHT_PANEL_ROW_SPLIT'; col: number; frac: number }

// 현재 assistant 메시지에 파트를 누적한다. 마지막 메시지가 user 면(턴 시작) 새 assistant
// 메시지를 만들고, assistant 면 그 parts 끝에 붙인다 — 한 턴의 reasoning/text/tool_*/error
// 가 같은 메시지로 묶인다(main persist 와 동형).
function appendAssistantPart(messages: Message[], part: AppMessagePart): Message[] {
  const last = messages[messages.length - 1]
  if (!last || last.role === 'user') {
    return [...messages, { role: 'assistant', createdAt: Date.now(), parts: [part] }]
  }
  const next = messages.slice()
  next[next.length - 1] = { ...last, parts: [...last.parts, part] }
  return next
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SEND_USER_MESSAGE': {
      const userParts: AppMessagePart[] = [{ type: 'text', text: action.text }]
      if (action.attachmentViews && action.attachmentViews.length > 0) {
        userParts.push({ type: 'attachment', attachments: action.attachmentViews })
      }
      return {
        ...state,
        messages: [...state.messages, { role: 'user', createdAt: Date.now(), parts: userParts }],
        sendCount: state.sendCount + 1,
        inflight: true,
        turnStartedAt: Date.now(),
        // lastTelemetry 는 비우지 않는다 — 컨텍스트 도넛이 턴 진행 중에도 직전 값을 유지.
        error: undefined,
        retry: undefined
      }
    }

    case 'APPEND_COMMITTED_USER_MESSAGE':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: 'user',
            createdAt: action.createdAt ?? Date.now(),
            parts: [{ type: 'text', text: action.text }]
          }
        ]
      }

    case 'RECV_EVENT': {
      const ev = action.event
      switch (ev.type) {
        case 'session.updated':
          // sessionId 발급 시점(claude init) → pendingProjectId 역할 종료(binding 완료). cwd 갱신.
          return {
            ...state,
            sessionId: ev.sessionId,
            backend: 'claude',
            cwd: ev.patch.cwd ?? state.cwd,
            pendingProjectId: null,
            projectId: state.pendingProjectId ?? state.projectId,
            retry: undefined
          }

        // message.delta · message.reasoning.delta 는 reducer 에 도달하지 않는다 —
        // chatStore.receive 가 live 슬라이스(transient)로 라우팅해 커밋 상태(이 reducer)는
        // 델타 프레임에 불변으로 남는다(델타당 transcript 재렌더 0).

        case 'message.reasoning':
          // 완성 사고 블록 → 영속 reasoning 파트. 라이브 프리뷰(live.reasoning)는 store 가 비운다.
          return {
            ...state,
            retry: undefined,
            messages: appendAssistantPart(state.messages, {
              type: 'reasoning',
              text: ev.text,
              ...(ev.signature !== undefined ? { signature: ev.signature } : {})
            })
          }

        case 'message.completed':
          // 스트리밍 델타는 라이브 리프가 보여줬으니, 완성본을 text 파트로 굳힌다.
          // (live.text 클리어는 store 가 담당.)
          return {
            ...state,
            retry: undefined,
            messages: appendAssistantPart(state.messages, {
              type: 'text',
              text: ev.message.text,
              ...(ev.parentToolRunId !== undefined ? { parentToolRunId: ev.parentToolRunId } : {})
            })
          }

        case 'tool.call.started':
          return {
            ...state,
            retry: undefined,
            messages: appendAssistantPart(state.messages, {
              type: 'tool_call',
              toolRunId: ev.toolRunId,
              toolName: ev.toolName,
              args: ev.args,
              ...(ev.parentToolRunId !== undefined ? { parentToolRunId: ev.parentToolRunId } : {})
            })
          }

        case 'tool.call.completed':
          return {
            ...state,
            retry: undefined,
            messages: appendAssistantPart(state.messages, {
              type: 'tool_result',
              toolRunId: ev.toolRunId,
              result: ev.result,
              isError: ev.isError,
              ...(ev.durationMs !== undefined ? { durationMs: ev.durationMs } : {}),
              ...(ev.parentToolRunId !== undefined ? { parentToolRunId: ev.parentToolRunId } : {})
            })
          }

        case 'turn.retrying':
          return {
            ...state,
            retry: { attempt: ev.attempt, max: ev.maxRetries, category: ev.error.category }
          }

        case 'telemetry': {
          const telemetry = ev.usage
          // 잔여 라이브 텍스트(message.completed 없이 끝난 턴)의 커밋은 store 가 telemetry 직전에
          // COMMIT_PENDING_TEXT 로 선행 dispatch 한다 — 버퍼 소유가 store 로 이동했기 때문.
          return {
            ...state,
            inflight: false,
            turnStartedAt: null,
            retry: undefined,
            // 도넛/패널은 lastTelemetry 파생(컨텍스트 사용량 소스). 비용/지연 누산은 제거 —
            // 비용은 main 의 turn_usage 원장(집계)이 SSOT. 컨텍스트 0인 턴(/context 등 로컬
            // 슬래시 명령 — 모델 미호출)은 직전 도넛 값을 덮어쓰지 않게 스킵한다.
            ...(telemetry && contextTokens(telemetry) > 0 ? { lastTelemetry: telemetry } : {})
          }
        }

        case 'permission.requested':
          // 권한 요청을 종류별 UI 상태로 분기. ask/plan 은 approvalId === action.request.requestId,
          // tool 은 ev.approvalId 를 키로 단일 permissionRespond 채널로 회신한다.
          if (ev.action.kind === 'ask_question') {
            return {
              ...state,
              retry: undefined,
              pendingAsks: [...state.pendingAsks, ev.action.request]
            }
          }
          if (ev.action.kind === 'plan_review') {
            // 계획 도착 → 액션 게이트 설정 + 우측 타일에 내용 표시 + 자동 오픈(auto-trigger).
            return {
              ...state,
              retry: undefined,
              pendingPlanReview: ev.action.request,
              planContent: ev.action.request.plan,
              rightPanelTiles: addTileColumnMajor(state.rightPanelTiles, 'plan')
            }
          }
          // tool_approval — 위험 도구 실행 승인 게이트. approvalId 로 응답을 라우팅한다.
          // 동시 요청(서브에이전트·병렬 tool_use)은 덮어쓰지 않고 큐에 append 한다.
          return {
            ...state,
            retry: undefined,
            pendingToolApprovals: [
              ...state.pendingToolApprovals,
              {
                approvalId: ev.approvalId,
                toolName: ev.action.toolName,
                input: ev.action.input
              }
            ]
          }

        case 'permission.resolved':
          // 보통 카드는 사용자 respond 시 로컬 RESOLVE_* 로 이미 닫힌다(아래 filter 는 idempotent).
          // 단 SDK 가 권한요청을 *취소*하면(사용자 클릭 없이) 이 이벤트만 오므로, approvalId 로
          // 남은 카드(ask/plan/tool)를 정리해 "먹통 카드"가 남지 않게 한다.
          return {
            ...state,
            retry: undefined,
            pendingAsks: state.pendingAsks.filter((a) => a.requestId !== ev.approvalId),
            pendingToolApprovals: state.pendingToolApprovals.filter(
              (a) => a.approvalId !== ev.approvalId
            ),
            ...(state.pendingPlanReview?.requestId === ev.approvalId
              ? { pendingPlanReview: null }
              : {})
          }

        case 'turn.aborted':
          return {
            ...state,
            inflight: false,
            turnStartedAt: null,
            retry: undefined,
            pendingAsks: [],
            pendingPlanReview: null,
            pendingToolApprovals: []
          }

        case 'error':
          // 턴이 끊기면 보류 게이트(질문/계획/도구)는 main 이 broker abort 로 정리하므로 카드도 비운다.
          return {
            ...state,
            error: ev.error,
            inflight: false,
            turnStartedAt: null,
            retry: undefined,
            pendingAsks: [],
            pendingPlanReview: null,
            pendingToolApprovals: []
          }
      }
      return state
    }

    case 'COMMIT_PENDING_TEXT':
      // telemetry 폴백 — 빈 텍스트는 빈 파트를 만들지 않는다.
      if (action.text === '') return state
      return {
        ...state,
        messages: appendAssistantPart(state.messages, { type: 'text', text: action.text })
      }

    case 'NEW_CHAT':
      // cwd 는 새 세션에서도 동일 (main 의 단일 default). 새 대화 즉시 `@` picker
      // 가 동작하도록 보존 — init 이벤트가 와도 같은 값으로 덮어쓰기만 함.
      // projectId 가 명시되면 새 세션이 해당 프로젝트에 binding 될 준비.
      return {
        ...initialChatState,
        cwd: state.cwd,
        pendingProjectId: action.projectId ?? null,
        projectId: action.projectId ?? null
      }

    case 'SET_CWD':
      return { ...state, cwd: action.cwd }

    case 'CANCEL_CHAT':
      // 턴 취소 시 main 의 broker 가 보류 게이트를 해소하므로 카드(질문/계획/도구)도 함께 비운다.
      return {
        ...state,
        inflight: false,
        turnStartedAt: null,
        retry: undefined,
        pendingAsks: [],
        pendingPlanReview: null,
        pendingToolApprovals: []
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
    // cwd 는 세션 영속값이 있으면 우선하고, 레거시 세션은 현재 baseline 을 보존한다.
    case 'LOAD_SESSION': {
      const messages: Message[] = action.session.messages.map((m) => ({
        role: m.role,
        createdAt: m.createdAt,
        // 미완료(crash/quit)로 남은 메시지의 열린 도구는 'aborted' 로 정착해 "실행 중" 잔재를
        // 막는다. 라이브 경로(RECV_EVENT)는 미경유 — incomplete 한정이라 스트리밍 무영향.
        parts: m.incomplete ? settleOrphanToolParts(m.parts) : m.parts,
        ...(m.incomplete ? { incomplete: true } : {})
      }))
      return {
        ...initialChatState,
        cwd: action.session.cwd ?? state.cwd,
        sessionId: action.session.id,
        projectId: action.session.projectId ?? null,
        backend: action.session.backend,
        title: action.session.title,
        providerKey: action.session.providerKey ?? null,
        messages,
        // 컨텍스트 도넛/패널을 세션 수명 동안 유지 — turn_usage 최신 행에서 복원.
        ...(action.session.lastTelemetry ? { lastTelemetry: action.session.lastTelemetry } : {})
      }
    }

    // 이 엔트리의 세션 제목 갱신. store 가 sessionId 키로 라우팅하므로 보통 일치하지만,
    // 새-채팅 엔트리(sessionId null) 등 불일치 시 no-op 가드.
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

    case 'SET_MODEL':
      if (state.sessionId && state.backend && action.adapter && action.adapter !== state.backend) {
        return state
      }
      return { ...state, providerKey: action.providerKey, modelFamily: action.modelFamily }

    case 'SET_EFFORT':
      return { ...state, effort: action.effort }

    case 'RESOLVE_PLAN':
      // 액션 게이트를 닫고 코멘트를 비운다(승인/수정/거부 후 코멘트 소비 완료) — planContent/
      // 계획 타일 활성 상태는 유지(검토 후 읽기전용 표시).
      return {
        ...state,
        pendingPlanReview: null,
        planComments: [],
        activePlanCommentId: null
      }

    case 'ADD_PLAN_COMMENT':
      // 작성 직후 편집 팝오버를 자동으로 열지 않는다(작성 팝오버만 닫힘) — activeId 는 null 유지.
      return {
        ...state,
        planComments: [...state.planComments, action.comment],
        activePlanCommentId: null
      }

    case 'UPDATE_PLAN_COMMENT':
      return {
        ...state,
        planComments: state.planComments.map((c) =>
          c.id === action.id ? { ...c, body: action.body } : c
        )
      }

    case 'REMOVE_PLAN_COMMENT':
      return {
        ...state,
        planComments: state.planComments.filter((c) => c.id !== action.id),
        activePlanCommentId:
          state.activePlanCommentId === action.id ? null : state.activePlanCommentId
      }

    case 'SET_ACTIVE_PLAN_COMMENT':
      return { ...state, activePlanCommentId: action.id }

    case 'RESOLVE_TOOL_APPROVAL':
      // 위험 도구 승인 카드 응답 후 해당 approvalId 만 큐에서 제거(나머지 동시 요청은 유지).
      return {
        ...state,
        pendingToolApprovals: state.pendingToolApprovals.filter(
          (a) => a.approvalId !== action.approvalId
        )
      }

    case 'TOGGLE_RIGHT_PANEL_TILE':
      return columnsContain(state.rightPanelTiles, action.id)
        ? removeTile(state, action.id)
        : { ...state, rightPanelTiles: addTileColumnMajor(state.rightPanelTiles, action.id) }

    case 'SET_RIGHT_PANEL_TILE_ACTIVE':
      return action.active
        ? { ...state, rightPanelTiles: addTileColumnMajor(state.rightPanelTiles, action.id) }
        : removeTile(state, action.id)

    case 'RENAME_RIGHT_PANEL_TILE': {
      const label = action.label.trim()
      const nextLabels = { ...state.rightPanelTileLabels }
      if (label) nextLabels[action.id] = label
      else delete nextLabels[action.id]
      return { ...state, rightPanelTileLabels: nextLabels }
    }

    case 'REMOVE_RIGHT_PANEL_TILE': {
      const nextLabels = { ...state.rightPanelTileLabels }
      delete nextLabels[action.id]
      const removed = removeTile(state, action.id)
      return {
        ...removed,
        rightPanelTileLabels: nextLabels,
        ...(action.id === 'subagent' ? { selectedSubagentTaskId: null } : {})
      }
    }

    case 'SELECT_SUBAGENT_TASK':
      return { ...state, selectedSubagentTaskId: action.toolRunId }

    case 'OPEN_SUBAGENT_TASK':
      return {
        ...state,
        selectedSubagentTaskId: action.toolRunId,
        rightPanelTiles: addTileColumnMajor(state.rightPanelTiles, 'subagent')
      }

    case 'SET_RIGHT_PANEL_COL_WIDTH': {
      if (action.col < 0) return state
      const nextWidths = state.rightPanelColWidths.slice()
      nextWidths[action.col] = clampPanelWidth(action.width)
      return { ...state, rightPanelColWidths: nextWidths }
    }

    case 'SET_RIGHT_PANEL_ROW_SPLIT': {
      if (action.col < 0) return state
      const nextSplits = state.rightPanelRowSplits.slice()
      nextSplits[action.col] = clampPanelRowSplit(action.frac)
      return { ...state, rightPanelRowSplits: nextSplits }
    }
  }
}

// 타일 제거 — 열 구조에서 해당 타일만 떼어낸다. 그 결과 열이 비면 열을 드롭하면서, 열 인덱스를
// 키로 쓰는 폭(rightPanelColWidths)·행분할(rightPanelRowSplits) 도 같은 인덱스에서 splice 해
// 정합을 맞춘다(열이 2→1 로 줄 때는 열이 유지되므로 그대로).
function removeTile(state: ChatState, id: RightPanelTileId): ChatState {
  const { columns, removedCol } = removeTileFromColumns(state.rightPanelTiles, id)
  if (columns === state.rightPanelTiles) return state
  if (removedCol === null) return { ...state, rightPanelTiles: columns }
  return {
    ...state,
    rightPanelTiles: columns,
    rightPanelColWidths: state.rightPanelColWidths.filter((_, i) => i !== removedCol),
    rightPanelRowSplits: state.rightPanelRowSplits.filter((_, i) => i !== removedCol)
  }
}

const clampPanelWidth = (n: number): number =>
  Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, Math.round(n)))

const clampPanelRowSplit = (n: number): number =>
  Math.max(PANEL_MIN_ROW_SPLIT, Math.min(PANEL_MAX_ROW_SPLIT, n))
