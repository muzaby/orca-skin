import { create } from 'zustand'
import {
  chatReducer,
  initialChatState,
  type ChatAction,
  type ChatState
} from '../reducer/chatReducer'
import {
  chatApi,
  concurrencyApi,
  permissionApi,
  sessionApi,
  settingsApi
} from '../../../shared/api/ipc'
import { createEventCoalescer } from '../lib/eventCoalescer'
import type { ComposerAttachment, EffortLevel, NormalizedEvent } from '../../../../../shared/ipc'
import type { NormalizedPermissionMode } from '../../../../../shared/permission-mode'
import type { RightPanelTileId } from '../lib/rightPanelTiles'

// Zustand 단일 chat store — arch/frontend/state.md §1.4 채택안의 멀티세션 외피(handoff 0013).
//
//   sessions  : Record<key, { session, live }>. 키 = 확정 세션의 sessionId, 새 채팅은
//               NEW_CHAT_KEY 슬롯 1개 — main 의 TurnRegistry(pending 슬롯 → session.updated
//               시 sessionId 키 승격)와 거울상. 비활성 엔트리도 이벤트를 백그라운드 누적한다.
//   activeKey : 화면이 보여주는 엔트리. selector 훅은 활성 엔트리만 구독한다 — 비활성
//               세션의 스트리밍은 활성 UI 를 깨우지 않는다(§4.4.1 의 도입 명분).
//
//   session   : 커밋 상태. 변경은 전부 순수 chatReducer 경유 — reducer 는 세션-단위
//               함수로 유지하고 store 가 키 라우팅을 담당한다(테스트/불변식 보존).
//   live      : 스트리밍 transient 버퍼(text·reasoning). 델타는 reducer 에 닿지 않는다.
//
// 구 sessionCache(snapshot Map)는 sessions Record 가 흡수했다 — 본 적 있는 세션 재진입은
// IPC 없이 activeKey 전환만으로 복원된다(LRU cap 은 Future Scope).

export interface LiveTurnState {
  // 스트리밍 중 누적 텍스트(구 ChatState.pendingDelta).
  text: string
  // 라이브 확장사고 누적. 완성 시 message.reasoning 이 영속 reasoning 파트로 굳히며 비운다.
  reasoning: string
}

export interface SessionEntry {
  session: ChatState
  live: LiveTurnState
}

export interface ChatStoreState {
  sessions: Record<string, SessionEntry>
  activeKey: string
  concurrencyByProjectId: Record<string, number>
}

// 새-채팅(아직 sessionId 미발급) 엔트리의 예약 키. 창당 1개 — main 의 pending 슬롯과 대칭.
export const NEW_CHAT_KEY = '__new__'

const EMPTY_LIVE: LiveTurnState = { text: '', reasoning: '' }

// main 의 단일 default cwd — 부트스트랩 1회 조회 캐시. 새 엔트리 생성 시 주입해
// 새 대화에서도 `@` 파일 자동완성이 즉시 동작한다(init 이벤트가 같은 값으로 덮어쓰기만).
let cwdCache: string | null = null

function freshEntry(projectId: string | null = null): SessionEntry {
  return {
    session: { ...initialChatState, cwd: cwdCache, pendingProjectId: projectId },
    live: EMPTY_LIVE
  }
}

export const useChatStore = create<ChatStoreState>()(() => ({
  sessions: { [NEW_CHAT_KEY]: freshEntry() },
  activeKey: NEW_CHAT_KEY,
  concurrencyByProjectId: {}
}))

const { setState, getState } = useChatStore

// 활성 엔트리의 커밋 상태 imperative read — effect(useChatRouteSync 등)가 상태 변화에
// 재실행되지 않으면서 현재 값을 읽을 때 사용한다.
export function getActiveChatSession(): ChatState {
  const s = getState()
  return s.sessions[s.activeKey].session
}

// 키 라우팅 dispatch — 엔트리가 없으면 무해한 no-op(삭제된 세션의 늦은 이벤트 등).
function dispatchTo(key: string, action: ChatAction): void {
  setState((s) => {
    const entry = s.sessions[key]
    if (!entry) return s
    return {
      sessions: {
        ...s.sessions,
        [key]: { ...entry, session: chatReducer(entry.session, action) }
      }
    }
  })
}

function dispatchActive(action: ChatAction): void {
  dispatchTo(getState().activeKey, action)
}

function patchLive(key: string, patch: (live: LiveTurnState) => LiveTurnState): void {
  setState((s) => {
    const entry = s.sessions[key]
    if (!entry) return s
    const next = patch(entry.live)
    if (next === entry.live) return s
    return { sessions: { ...s.sessions, [key]: { ...entry, live: next } } }
  })
}

function resetLive(key: string): void {
  patchLive(key, (live) => (live.text !== '' || live.reasoning !== '' ? EMPTY_LIVE : live))
}

// 새-채팅 엔트리를 발급된 sessionId 키로 승격(re-key). 엔트리 객체 동일성을 보존해
// 진행 중 라이브 버퍼·메시지가 그대로 따라간다. 활성이 새-채팅이었다면 activeKey 도 추종
// — useChatRouteSync 방향 2(armed-ref)가 sessionId null→non-null 전이로 URL 을 승격한다.
function promoteNewChat(sessionId: string): void {
  setState((s) => {
    if (s.sessions[sessionId]) return s
    const entry = s.sessions[NEW_CHAT_KEY]
    if (!entry) return { sessions: { ...s.sessions, [sessionId]: freshEntry() } }
    const rest = { ...s.sessions }
    delete rest[NEW_CHAT_KEY]
    return {
      sessions: { ...rest, [sessionId]: entry },
      ...(s.activeKey === NEW_CHAT_KEY ? { activeKey: sessionId } : {})
    }
  })
}

// 엔트리 제거. 활성 엔트리였다면 깨끗한 새 채팅으로 전환한다.
function dropSession(sessionId: string, fallbackProjectId: string | null = null): void {
  setState((s) => {
    if (!s.sessions[sessionId]) return s
    const rest = { ...s.sessions }
    delete rest[sessionId]
    if (s.activeKey !== sessionId) return { sessions: rest }
    return {
      sessions: { ...rest, [NEW_CHAT_KEY]: freshEntry(fallbackProjectId) },
      activeKey: NEW_CHAT_KEY
    }
  })
}

// 코얼레서가 비운 이벤트의 최종 수신부 — React 트리 밖 dispatch(state.md §4.4.2).
// ev.sessionId 로 해당 엔트리에 라우팅한다: 비활성 세션의 턴도 백그라운드로 누적되고,
// 델타 2종은 그 엔트리의 live 슬라이스로만 흐른다. sessionId 가 없는 이벤트(일부 error)는
// 활성 엔트리 폴백, 미지 sessionId(엔트리 삭제 후 늦게 도착)는 폐기한다.
function receive(ev: NormalizedEvent): void {
  const evSessionId = 'sessionId' in ev ? (ev.sessionId ?? null) : null

  // session.updated = sessionId 발급/확정 시점 — 새-채팅 엔트리를 sessionId 키로 승격.
  if (ev.type === 'session.updated' && !getState().sessions[ev.sessionId]) {
    promoteNewChat(ev.sessionId)
  }

  let key: string | null = null
  if (evSessionId && getState().sessions[evSessionId]) key = evSessionId
  else if (!evSessionId) key = getState().activeKey
  if (!key) return // 미지 세션의 늦은 이벤트 — 폐기

  switch (ev.type) {
    case 'message.delta':
      patchLive(key, (live) => ({ ...live, text: live.text + ev.delta.text }))
      return

    case 'message.reasoning.delta':
      patchLive(key, (live) => ({ ...live, reasoning: live.reasoning + ev.delta.text }))
      return

    case 'message.completed':
      // 완성본(ev.message.text)이 text 파트로 커밋되므로 라이브 프리뷰는 비운다.
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      patchLive(key, (live) => (live.text !== '' ? { ...live, text: '' } : live))
      return

    case 'message.reasoning':
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      patchLive(key, (live) => (live.reasoning !== '' ? { ...live, reasoning: '' } : live))
      return

    case 'turn.retrying':
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      return

    case 'telemetry': {
      // message.completed 없이 턴이 끝난 경우 잔여 라이브 텍스트를 text 파트로 굳힌다.
      const leftover = getState().sessions[key]?.live.text ?? ''
      if (leftover !== '') dispatchTo(key, { type: 'COMMIT_PENDING_TEXT', text: leftover })
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      resetLive(key)
      return
    }

    case 'turn.aborted':
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      resetLive(key)
      return

    case 'error':
      // 턴 중단 — 미완 라이브 프리뷰는 커밋하지 않고 버린다(기존 동작 동형).
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      resetLive(key)
      return

    case 'session.updated':
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      // 마지막 활성 세션 영속화 — 백그라운드 턴이 lastSessionId 를 가로채지 않도록 활성만.
      // 코어 중립(0016): chat store 는 backend 를 모른다(이벤트에 provider 없음·레이어 경계상
      // backend store 의존 불가). lastBackend 영속은 backend store 소관 — 여기선 세션만 기록한다.
      if (key === getState().activeKey) {
        void settingsApi.set({ lastSessionId: ev.sessionId })
      }
      return

    default:
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
  }
}

// 스트리밍 델타 코얼레서 — 델타는 rAF 한 틱마다 모아 receive 로 비운다(rendering.md §1.2).
// 단일 FIFO 버퍼가 세션 간 순서도 보존하며, 키 라우팅이 스테일 오염을 막으므로 세션
// 전환 시 dispose 하지 않는다(비활성 세션의 백그라운드 누적 유지). dispose 는 언마운트만.
const coalescer = createEventCoalescer(receive, {
  schedule: (cb) => requestAnimationFrame(cb),
  cancel: (h) => cancelAnimationFrame(h)
})

// IPC 인바운드 이벤트 1개 라우팅(코얼레서 경유). ChatProvider 부트스트랩이 구독을 연결한다.
export function ingestChatEvent(ev: NormalizedEvent): void {
  coalescer.push(ev)
}

function send(text: string, attachments: ComposerAttachment[] = []): boolean {
  const trimmed = text.trim()
  const cur = getActiveChatSession()
  if (trimmed === '' || cur.inflight) return false
  // 새 턴 시작 — 직전 턴의 잔여 라이브 버퍼 제거(구 SEND_USER_MESSAGE 의 pending 리셋).
  resetLive(getState().activeKey)
  dispatchActive({ type: 'SEND_USER_MESSAGE', text: trimmed })
  // 새 채팅 (sessionId=null) 첫 메시지일 때만 projectId 전달. resume 경로면 main 이
  // sessionId 로부터 직접 project_id 를 조회하므로 여기서는 null.
  void chatApi.send({
    sessionId: cur.sessionId,
    projectId: cur.sessionId ? null : cur.pendingProjectId,
    text: trimmed,
    permissionMode: cur.permissionMode,
    providerKey: cur.providerKey,
    modelFamily: cur.modelFamily,
    effort: cur.effort,
    attachments
  })
  return true
}

function cancel(): void {
  const sid = getActiveChatSession().sessionId
  if (sid) void chatApi.cancel(sid)
  dispatchActive({ type: 'CANCEL_CHAT' })
}

function newChat(projectId: string | null = null): void {
  setState((s) => ({
    sessions: { ...s.sessions, [NEW_CHAT_KEY]: freshEntry(projectId) },
    activeKey: NEW_CHAT_KEY
  }))
  void settingsApi.set({ lastSessionId: null })
}

// 사이드바 항목 클릭 / 부팅 자동 복원 공통. 엔트리가 이미 있으면(본 적 있는 세션)
// IPC 없이 activeKey 전환만 — 구 메모리 캐시 hit 와 동일한 효과. 같은 세션 재클릭은 no-op.
// title 은 사이드바 메타에서 가져오는 낙관적 값 — 부팅 자동 복원 경로에선 생략되면
// 도착한 LoadedSession.title 로 채워진다.
async function loadSession(sessionId: string, title: string | null = null): Promise<void> {
  const s = getState()
  const existing = s.sessions[sessionId]
  if (s.activeKey === sessionId && existing && !existing.session.loadingSession) return

  if (existing && !existing.session.loadingSession) {
    setState({ activeKey: sessionId })
    void settingsApi.set({ lastSessionId: sessionId })
    return
  }

  // 미보유 세션 — 로딩 엔트리를 만들고 IPC 로 채운다. 응답은 키로 라우팅되므로
  // 사용자가 도착 전에 다른 세션으로 이동해도 올바른 엔트리에 적재된다.
  const loadingSession = chatReducer(
    { ...initialChatState, cwd: cwdCache },
    { type: 'START_LOAD_SESSION', sessionId, title }
  )
  setState((st) => ({
    sessions: { ...st.sessions, [sessionId]: { session: loadingSession, live: EMPTY_LIVE } },
    activeKey: sessionId
  }))

  try {
    const session = await sessionApi.load(sessionId)
    if (!session) {
      dropSession(sessionId)
      void settingsApi.set({ lastSessionId: null })
      return
    }
    dispatchTo(sessionId, { type: 'LOAD_SESSION', session })
    void settingsApi.set({ lastSessionId: session.id })
  } catch {
    dropSession(sessionId)
  }
}

// 세션 제목 동기화(낙관적) — 해당 엔트리가 있으면 활성/비활성 가리지 않고 갱신.
// DB flush 는 sessionsStore.rename 이 담당 — 셸이 두 함수를 모두 호출한다.
function renameSession(sessionId: string, title: string): void {
  const trimmed = title.trim()
  if (trimmed === '') return
  dispatchTo(sessionId, { type: 'RENAME_SESSION', sessionId, title: trimmed })
}

// 외부 변경(삭제 등)으로 엔트리 미러가 무효화됐을 때 폐기 — 다음 진입 시 DB 재로드.
function invalidateSessionCache(sessionId: string): void {
  dropSession(sessionId)
}

// 외부에서 세션이 삭제됐을 때 chat-side 정리 — 엔트리 제거 + 활성 세션이면 새 채팅으로
// 전환. project 컨텍스트가 있으면 그 프로젝트로 새 채팅을 시작.
function handleSessionDeleted(sessionId: string, fallbackProjectId?: string | null): void {
  dropSession(sessionId, fallbackProjectId ?? null)
}

// requestId === approvalId (router 가 두 값을 동일하게 발급). 권한 응답은 단일
// permissionApi.respond 로 통일하고, 각 도메인 후처리는 ApprovalResolution 으로 표현한다.
// 카드는 활성 엔트리에서만 상호작용 가능하므로 로컬 RESOLVE_* 는 활성으로 보낸다.
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
  dispatchActive({ type: 'RESOLVE_ASK', requestId })
}

function skipAsk(requestId: string): void {
  void permissionApi.respond({ approvalId: requestId, resolution: { behavior: 'deny' } })
  dispatchActive({ type: 'RESOLVE_ASK', requestId })
}

function setModel(
  providerKey: string | null,
  modelFamily: string | null,
  adapter?: string | null
): void {
  dispatchActive({ type: 'SET_MODEL', providerKey, modelFamily, adapter })
}

function setEffort(effort: EffortLevel): void {
  dispatchActive({ type: 'SET_EFFORT', effort })
}

function setPermissionMode(mode: NormalizedPermissionMode): void {
  dispatchActive({ type: 'SET_PERMISSION_MODE', mode })
  // 활성 세션이면 라이브 전환 IPC 발행 — main 이 진행 중 턴이면 즉시 Query.setPermissionMode,
  // 아니면 controller 에 기록해 다음 턴에 반영. 새 채팅(sessionId 미발급)은 send 페이로드로 전달.
  const sid = getActiveChatSession().sessionId
  if (sid) void permissionApi.setMode({ sessionId: sid, mode })
}

function approvePlan(requestId: string): void {
  void permissionApi.respond({ approvalId: requestId, resolution: { behavior: 'allow' } })
  dispatchActive({ type: 'RESOLVE_PLAN' })
  // 승인 = plan 모드 종료. 칩을 '편집 수락'으로 전환 → 다음 턴이 plan 모드로 재진입하지
  // 않아 ExitPlanMode 재호출(단순 질문 시 계획 카드 재출현)을 막는다.
  dispatchActive({ type: 'SET_PERMISSION_MODE', mode: 'accept_edits' })
}

function revisePlan(requestId: string, feedback: string): void {
  const trimmed = feedback.trim()
  if (trimmed === '') return
  // revise = deny + 피드백 메시지(어댑터가 '사용자 수정 요청: '+message 로 재작성 유도).
  void permissionApi.respond({
    approvalId: requestId,
    resolution: { behavior: 'deny', message: trimmed }
  })
  dispatchActive({ type: 'RESOLVE_PLAN' })
}

function rejectPlan(requestId: string): void {
  // reject = deny + interrupt(main 이 turn abort). 카드 제거 + inflight 종료.
  void permissionApi.respond({
    approvalId: requestId,
    resolution: { behavior: 'deny', interrupt: true }
  })
  dispatchActive({ type: 'RESOLVE_PLAN' })
  dispatchActive({ type: 'CANCEL_CHAT' })
}

// 위험 도구 승인 — 허용(이번만) / 세션 동안 허용 / 거부(턴 계속, 중단 아님).
function approveTool(approvalId: string): void {
  void permissionApi.respond({ approvalId, resolution: { behavior: 'allow' } })
  dispatchActive({ type: 'RESOLVE_TOOL_APPROVAL' })
}

function approveToolForSession(approvalId: string, toolName: string): void {
  void permissionApi.respond({
    approvalId,
    resolution: { behavior: 'allow', updatedPermissions: [{ toolName, scope: 'session' }] }
  })
  dispatchActive({ type: 'RESOLVE_TOOL_APPROVAL' })
}

function denyTool(approvalId: string): void {
  // 거부만 — interrupt 없이 deny 라 턴은 계속된다(에이전트가 다른 경로 모색).
  void permissionApi.respond({
    approvalId,
    resolution: { behavior: 'deny', interrupt: false }
  })
  dispatchActive({ type: 'RESOLVE_TOOL_APPROVAL' })
}

// 안정 액션 묶음 — 모듈 상수라 컴포넌트가 deps/메모 걱정 없이 직접 import 하거나 props 로
// 전달할 수 있다(컴포넌트는 selector / action 만 사용, state.md §1.3).
export const chatActions = {
  send,
  cancel,
  newChat,
  clearError: (): void => dispatchActive({ type: 'CLEAR_ERROR' }),
  loadSession,
  renameSession,
  invalidateSessionCache,
  handleSessionDeleted,
  answerAsk,
  skipAsk,
  setPermissionMode,
  setModel,
  setEffort,
  approvePlan,
  revisePlan,
  rejectPlan,
  approveTool,
  approveToolForSession,
  denyTool,
  toggleRightPanelTile: (id: RightPanelTileId): void =>
    dispatchActive({ type: 'TOGGLE_RIGHT_PANEL_TILE', id }),
  setRightPanelTileActive: (id: RightPanelTileId, active: boolean): void =>
    dispatchActive({ type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id, active }),
  renameRightPanelTile: (id: RightPanelTileId, label: string): void =>
    dispatchActive({ type: 'RENAME_RIGHT_PANEL_TILE', id, label }),
  removeRightPanelTile: (id: RightPanelTileId): void =>
    dispatchActive({ type: 'REMOVE_RIGHT_PANEL_TILE', id }),
  setRightPanelColWidth: (col: number, width: number): void =>
    dispatchActive({ type: 'SET_RIGHT_PANEL_COL_WIDTH', col, width }),
  setRightPanelRowSplit: (col: number, frac: number): void =>
    dispatchActive({ type: 'SET_RIGHT_PANEL_ROW_SPLIT', col, frac })
}

// IPC 구독·cwd 1회 조회를 연결하는 부트스트랩 — ChatProvider 의 effect 가 1회 호출한다.
// 반환 cleanup 은 구독 해제 + 코얼레서 잔여 버퍼 폐기(StrictMode 이중 mount 안전).
export function bootstrapChat(): () => void {
  // 앱 부트 시 cwd 1회 조회 — init 이벤트가 오면 같은 값으로 덮어쓰기. 이후 생성되는
  // 엔트리는 cwdCache 로 주입받는다.
  void sessionApi.cwd().then((cwd) => {
    cwdCache = cwd
    setState((s) => ({
      sessions: Object.fromEntries(
        Object.entries(s.sessions).map(([k, entry]) => [
          k,
          { ...entry, session: chatReducer(entry.session, { type: 'SET_CWD', cwd }) }
        ])
      )
    }))
  })

  const unsubEvents = chatApi.onEvent(ingestChatEvent)
  const unsubTitle = sessionApi.onTitle((ev) => {
    renameSession(ev.sessionId, ev.title)
  })
  const unsubConcurrency = concurrencyApi.onEvent((ev) => {
    setState((s) => ({
      concurrencyByProjectId: { ...s.concurrencyByProjectId, [ev.projectId]: ev.count }
    }))
  })
  return () => {
    unsubEvents()
    unsubTitle()
    unsubConcurrency()
    coalescer.dispose()
  }
}

// ── selector 훅 ──────────────────────────────────────────────────────────────

// 활성 세션의 커밋 슬라이스 구독 — 델타 프레임(live 만 변경)과 비활성 세션의 백그라운드
// 갱신에는 깨어나지 않는다.
export function useChatSession<T>(selector: (s: ChatState) => T): T {
  return useChatStore((s) => selector(s.sessions[s.activeKey].session))
}

// 라이브 스트림 리프 전용 — 활성 세션의 text 델타에만 재렌더.
export function useLiveText(): string {
  return useChatStore((s) => s.sessions[s.activeKey].live.text)
}

// 라이브 사고 리프 전용 — 활성 세션의 reasoning 델타에만 재렌더(본문 text 델타와 격리).
export function useLiveReasoning(): string {
  return useChatStore((s) => s.sessions[s.activeKey].live.reasoning)
}

export function useProjectConcurrencyCount(projectId: string | null): number {
  return useChatStore((s) => (projectId ? (s.concurrencyByProjectId[projectId] ?? 0) : 0))
}
