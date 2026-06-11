import { create } from 'zustand'
import {
  chatReducer,
  initialChatState,
  type CachedSession,
  type ChatAction,
  type ChatState
} from '../reducer/chatReducer'
import { chatApi, permissionApi, sessionApi, settingsApi } from '../../../shared/api/ipc'
import { createEventCoalescer } from '../lib/eventCoalescer'
import type { NormalizedEvent } from '../../../../../shared/ipc'
import type { NormalizedPermissionMode } from '../../../../../shared/permission-mode'

// Zustand 단일 chat store — arch/frontend/state.md §1.4 채택안(selector 구독 + store 외부
// dispatch)의 chat 스코프 선행 적용. 두 슬라이스로 나뉜다:
//
//   session : 커밋 상태(messages·inflight·permissionMode…). 변경은 전부 순수 chatReducer 를
//             경유한다 — 기존 reducer 테스트/불변식(appendAssistantPart 의 identity 보존)을
//             그대로 유지하기 위해 store 는 dispatch 래퍼로만 갱신한다.
//   live    : 스트리밍 transient 버퍼(text·reasoning). message.delta 류는 reducer 에 닿지
//             않고 이 슬라이스만 갱신한다 → 델타 프레임에 session 구독자(transcript·Composer
//             ·셸)는 재렌더 0, live 구독 리프(LiveText/LiveReasoning)만 재렌더된다.
//
// Phase 4 멀티세션 외피(sessions: Record<sessionId, …> + activeSessionId)로의 확장은
// session/live 쌍을 Record 값으로 옮기고 receive 가 ev.sessionId 로 라우팅하는 기계적
// 치환이 되도록 액션을 "활성 세션 1개" 단위로 캡슐화해 둔다.

export interface LiveTurnState {
  // 스트리밍 중 누적 텍스트(구 ChatState.pendingDelta).
  text: string
  // 라이브 확장사고 누적(구 ChatState.pendingReasoning). 완성 시 message.reasoning 이
  // 영속 reasoning 파트로 굳히며 비운다.
  reasoning: string
}

export interface ChatStoreState {
  session: ChatState
  live: LiveTurnState
}

const EMPTY_LIVE: LiveTurnState = { text: '', reasoning: '' }

export const useChatStore = create<ChatStoreState>()(() => ({
  session: initialChatState,
  live: EMPTY_LIVE
}))

const { setState, getState } = useChatStore

function dispatch(action: ChatAction): void {
  setState((s) => ({ session: chatReducer(s.session, action) }))
}

function resetLive(): void {
  const live = getState().live
  if (live.text !== '' || live.reasoning !== '') setState({ live: EMPTY_LIVE })
}

// 같은 윈도우 안에서 본 적 있는 세션의 snapshot. unbounded — 단일 사용자·단일 윈도우라
// 수십 entry 이내. LRU 도입은 Phase 4 (구 useChat.cacheRef).
const sessionCache = new Map<string, CachedSession>()

// 활성 세션을 떠날 때 호출. messages 가 비어 있으면 (loading 중 또는 빈 세션)
// 의미 있는 snapshot 이 아니므로 skip.
function snapshotActiveToCache(): void {
  const cur = getState().session
  if (!cur.sessionId || cur.loadingSession || cur.messages.length === 0) return
  sessionCache.set(cur.sessionId, {
    title: cur.title,
    backend: cur.backend,
    providerKey: cur.providerKey,
    modelFamily: cur.modelFamily,
    messages: cur.messages,
    ...(cur.lastTelemetry ? { lastTelemetry: cur.lastTelemetry } : {})
  })
}

// 코얼레서가 비운 이벤트의 최종 수신부 — React 트리 밖 dispatch(state.md §4.4.2).
// 델타 2종은 live 슬라이스로, 그 외는 reducer 로 라우팅한다. live 의 클리어/커밋 폴백
// 오케스트레이션(완성·telemetry·error)도 여기서.
function receive(ev: NormalizedEvent): void {
  switch (ev.type) {
    case 'message.delta':
      setState((s) => ({ live: { ...s.live, text: s.live.text + ev.delta.text } }))
      return

    case 'message.reasoning.delta':
      setState((s) => ({ live: { ...s.live, reasoning: s.live.reasoning + ev.delta.text } }))
      return

    case 'message.completed':
      // 완성본(ev.message.text)이 text 파트로 커밋되므로 라이브 프리뷰는 비운다.
      dispatch({ type: 'RECV_EVENT', event: ev })
      if (getState().live.text !== '') setState((s) => ({ live: { ...s.live, text: '' } }))
      return

    case 'message.reasoning':
      dispatch({ type: 'RECV_EVENT', event: ev })
      if (getState().live.reasoning !== '')
        setState((s) => ({ live: { ...s.live, reasoning: '' } }))
      return

    case 'telemetry': {
      // message.completed 없이 턴이 끝난 경우 잔여 라이브 텍스트를 text 파트로 굳힌다
      // (구 reducer telemetry 케이스의 pendingDelta 폴백 — 버퍼 소유가 store 로 이동).
      const leftover = getState().live.text
      if (leftover !== '') dispatch({ type: 'COMMIT_PENDING_TEXT', text: leftover })
      dispatch({ type: 'RECV_EVENT', event: ev })
      resetLive()
      return
    }

    case 'error':
      // 턴 중단 — 미완 라이브 프리뷰는 커밋하지 않고 버린다(기존 동작 동형).
      dispatch({ type: 'RECV_EVENT', event: ev })
      resetLive()
      return

    case 'session.updated':
      dispatch({ type: 'RECV_EVENT', event: ev })
      // 어댑터가 발급한 첫 sessionId 를 영속화. opencode 가 들어오면 lastBackend
      // 도 함께 갱신해야 한다 (OQ7).
      void settingsApi.set({ lastSessionId: ev.sessionId, lastBackend: 'claude-code' })
      return

    default:
      dispatch({ type: 'RECV_EVENT', event: ev })
  }
}

// 스트리밍 델타 코얼레서 — 델타는 rAF 한 틱마다 모아 receive 로 비운다(rendering.md §1.2).
// 세션 전환/새 채팅 시 dispose 로 직전 세션의 스테일 델타를 폐기한다.
const coalescer = createEventCoalescer(receive, {
  schedule: (cb) => requestAnimationFrame(cb),
  cancel: (h) => cancelAnimationFrame(h)
})

// IPC 인바운드 이벤트 1개 라우팅(코얼레서 경유). ChatProvider 부트스트랩이 구독을 연결한다.
export function ingestChatEvent(ev: NormalizedEvent): void {
  coalescer.push(ev)
}

function send(text: string): void {
  const trimmed = text.trim()
  const cur = getState().session
  if (trimmed === '' || cur.inflight) return
  // 새 턴 시작 — 직전 턴의 잔여 라이브 버퍼 제거(구 SEND_USER_MESSAGE 의 pending 리셋).
  resetLive()
  dispatch({ type: 'SEND_USER_MESSAGE', text: trimmed })
  // 새 채팅 (sessionId=null) 첫 메시지일 때만 projectId 전달. resume 경로면 main 이
  // sessionId 로부터 직접 project_id 를 조회하므로 여기서는 null.
  void chatApi.send({
    sessionId: cur.sessionId,
    projectId: cur.sessionId ? null : cur.pendingProjectId,
    text: trimmed,
    permissionMode: cur.permissionMode,
    providerKey: cur.providerKey,
    modelFamily: cur.modelFamily
  })
}

function cancel(): void {
  const sid = getState().session.sessionId
  if (sid) void chatApi.cancel(sid)
  dispatch({ type: 'CANCEL_CHAT' })
}

function newChat(projectId: string | null = null): void {
  coalescer.dispose()
  snapshotActiveToCache()
  dispatch({ type: 'NEW_CHAT', projectId })
  resetLive()
  void settingsApi.set({ lastSessionId: null })
}

// 사이드바 항목 클릭 / 부팅 자동 복원 공통. 캐시 hit 면 IPC 생략, miss 면 IPC.
// 같은 세션을 다시 클릭하는 경우는 no-op (불필요한 reset 방지).
// title 은 사이드바 메타에서 가져오는 낙관적 값 — 메타가 아직 없는 경로(부팅 자동
// 복원)에서는 생략하면 도착한 LoadedSession.title 로 채워진다.
async function loadSession(sessionId: string, title: string | null = null): Promise<void> {
  const cur = getState().session
  if (cur.sessionId === sessionId && !cur.loadingSession) return

  // 세션 전환 — 직전 세션의 잔여 델타가 새 state 에 붙지 않도록 폐기.
  coalescer.dispose()
  snapshotActiveToCache()
  resetLive()

  const cached = sessionCache.get(sessionId)
  if (cached) {
    dispatch({ type: 'LOAD_SESSION_FROM_CACHE', sessionId, cached })
    void settingsApi.set({ lastSessionId: sessionId })
    return
  }

  dispatch({ type: 'START_LOAD_SESSION', sessionId, title })
  try {
    const session = await sessionApi.load(sessionId)
    if (!session) {
      dispatch({ type: 'LOAD_SESSION_ERROR' })
      void settingsApi.set({ lastSessionId: null })
      return
    }
    dispatch({ type: 'LOAD_SESSION', session })
    void settingsApi.set({ lastSessionId: session.id })
  } catch {
    dispatch({ type: 'LOAD_SESSION_ERROR' })
  }
}

// 활성 세션의 reducer state.title 과 메모리 캐시 entry 만 동기화. DB flush 는
// useSessions.rename 이 담당 — 셸이 두 함수를 모두 호출한다.
function renameSession(sessionId: string, title: string): void {
  const trimmed = title.trim()
  if (trimmed === '') return
  const cached = sessionCache.get(sessionId)
  if (cached) sessionCache.set(sessionId, { ...cached, title: trimmed })
  dispatch({ type: 'RENAME_SESSION', sessionId, title: trimmed })
}

function invalidateSessionCache(sessionId: string): void {
  sessionCache.delete(sessionId)
}

// 외부에서 세션이 삭제됐을 때 chat-side 정리 — 캐시 invalidation + 활성 세션이면
// 새 채팅으로 reset. project 컨텍스트가 있으면 그 프로젝트로 새 채팅을 시작.
function handleSessionDeleted(sessionId: string, fallbackProjectId?: string | null): void {
  sessionCache.delete(sessionId)
  if (getState().session.sessionId === sessionId) {
    coalescer.dispose()
    dispatch({ type: 'NEW_CHAT', projectId: fallbackProjectId ?? null })
    resetLive()
  }
}

// requestId === approvalId (router 가 두 값을 동일하게 발급). 권한 응답은 단일
// permissionApi.respond 로 통일하고, 각 도메인 후처리는 ApprovalResolution 으로 표현한다.
function answerAsk(
  requestId: string,
  answers: Record<string, string | string[]>,
  response?: string
): void {
  void permissionApi.respond({
    approvalId: requestId,
    resolution: {
      behavior: 'allow',
      updatedInput: { answers, ...(response !== undefined ? { response } : {}) }
    }
  })
  dispatch({ type: 'RESOLVE_ASK', requestId })
}

function skipAsk(requestId: string): void {
  void permissionApi.respond({ approvalId: requestId, resolution: { behavior: 'deny' } })
  dispatch({ type: 'RESOLVE_ASK', requestId })
}

function setModel(
  providerKey: string | null,
  modelFamily: string | null,
  adapter?: string | null
): void {
  dispatch({ type: 'SET_MODEL', providerKey, modelFamily, adapter })
}

function setPermissionMode(mode: NormalizedPermissionMode): void {
  dispatch({ type: 'SET_PERMISSION_MODE', mode })
  // 활성 세션이면 라이브 전환 IPC 발행 — main 이 진행 중 턴이면 즉시 Query.setPermissionMode,
  // 아니면 controller 에 기록해 다음 턴에 반영. 새 채팅(sessionId 미발급)은 send 페이로드로 전달.
  const sid = getState().session.sessionId
  if (sid) void permissionApi.setMode({ sessionId: sid, mode })
}

function approvePlan(requestId: string): void {
  void permissionApi.respond({ approvalId: requestId, resolution: { behavior: 'allow' } })
  dispatch({ type: 'RESOLVE_PLAN' })
  // 승인 = plan 모드 종료. 칩을 '편집 수락'으로 전환 → 다음 턴이 plan 모드로 재진입하지
  // 않아 ExitPlanMode 재호출(단순 질문 시 계획 카드 재출현)을 막는다.
  dispatch({ type: 'SET_PERMISSION_MODE', mode: 'accept_edits' })
}

function revisePlan(requestId: string, feedback: string): void {
  const trimmed = feedback.trim()
  if (trimmed === '') return
  // revise = deny + 피드백 메시지(어댑터가 '사용자 수정 요청: '+message 로 재작성 유도).
  void permissionApi.respond({
    approvalId: requestId,
    resolution: { behavior: 'deny', message: trimmed }
  })
  dispatch({ type: 'RESOLVE_PLAN' })
}

function rejectPlan(requestId: string): void {
  // reject = deny + interrupt(main 이 turn abort). 카드 제거 + inflight 종료.
  void permissionApi.respond({
    approvalId: requestId,
    resolution: { behavior: 'deny', interrupt: true }
  })
  dispatch({ type: 'RESOLVE_PLAN' })
  dispatch({ type: 'CANCEL_CHAT' })
}

// 위험 도구 승인 — 허용(이번만) / 세션 동안 허용 / 거부(턴 계속, 중단 아님).
function approveTool(approvalId: string): void {
  void permissionApi.respond({ approvalId, resolution: { behavior: 'allow' } })
  dispatch({ type: 'RESOLVE_TOOL_APPROVAL' })
}

function approveToolForSession(approvalId: string, toolName: string): void {
  void permissionApi.respond({
    approvalId,
    resolution: { behavior: 'allow', updatedPermissions: [{ toolName, scope: 'session' }] }
  })
  dispatch({ type: 'RESOLVE_TOOL_APPROVAL' })
}

function denyTool(approvalId: string): void {
  // 거부만 — interrupt 없이 deny 라 턴은 계속된다(에이전트가 다른 경로 모색).
  void permissionApi.respond({
    approvalId,
    resolution: { behavior: 'deny', interrupt: false }
  })
  dispatch({ type: 'RESOLVE_TOOL_APPROVAL' })
}

// 안정 액션 묶음 — 모듈 상수라 컴포넌트가 deps/메모 걱정 없이 직접 import 하거나 props 로
// 전달할 수 있다(컴포넌트는 selector / action 만 사용, state.md §1.3).
export const chatActions = {
  send,
  cancel,
  newChat,
  clearError: (): void => dispatch({ type: 'CLEAR_ERROR' }),
  loadSession,
  renameSession,
  invalidateSessionCache,
  handleSessionDeleted,
  answerAsk,
  skipAsk,
  setPermissionMode,
  setModel,
  approvePlan,
  revisePlan,
  rejectPlan,
  approveTool,
  approveToolForSession,
  denyTool,
  togglePlanTile: (): void => dispatch({ type: 'TOGGLE_PLAN_TILE' }),
  openPlanTile: (): void => dispatch({ type: 'SET_PLAN_TILE_OPEN', open: true }),
  closePlanTile: (): void => dispatch({ type: 'SET_PLAN_TILE_OPEN', open: false }),
  setPlanTileWidth: (width: number): void => dispatch({ type: 'SET_PLAN_TILE_WIDTH', width })
}

// IPC 구독·cwd 1회 조회를 연결하는 부트스트랩 — ChatProvider 의 effect 가 1회 호출한다.
// 반환 cleanup 은 구독 해제 + 코얼레서 잔여 버퍼 폐기(StrictMode 이중 mount 안전).
export function bootstrapChat(): () => void {
  // 앱 부트 시 cwd 1회 조회 — init 이벤트가 오면 같은 값으로 덮어쓰기.
  void sessionApi.cwd().then((cwd) => dispatch({ type: 'SET_CWD', cwd }))

  const unsubEvents = chatApi.onEvent(ingestChatEvent)
  const unsubTitle = sessionApi.onTitle((ev) => {
    const cached = sessionCache.get(ev.sessionId)
    if (cached) sessionCache.set(ev.sessionId, { ...cached, title: ev.title })
    if (getState().session.sessionId === ev.sessionId) {
      dispatch({ type: 'RENAME_SESSION', sessionId: ev.sessionId, title: ev.title })
    }
  })
  return () => {
    unsubEvents()
    unsubTitle()
    coalescer.dispose()
  }
}

// ── selector 훅 ──────────────────────────────────────────────────────────────

// 커밋 세션 슬라이스 구독 — 델타 프레임(live 만 변경)에는 깨어나지 않는다.
export function useChatSession<T>(selector: (s: ChatState) => T): T {
  return useChatStore((s) => selector(s.session))
}

// 라이브 스트림 리프 전용 — text 델타에만 재렌더.
export function useLiveText(): string {
  return useChatStore((s) => s.live.text)
}

// 라이브 사고 리프 전용 — reasoning 델타에만 재렌더(본문 text 델타와 격리).
export function useLiveReasoning(): string {
  return useChatStore((s) => s.live.reasoning)
}
