import { useMemo } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  chatReducer,
  initialChatState,
  type ChatAction,
  type ChatState,
  type PlanComment
} from '../reducer/chatReducer'
import { toPlanFeedback } from '../lib/planComments'
import {
  chatApi,
  concurrencyApi,
  permissionApi,
  sessionApi,
  settingsApi
} from '../../../shared/api/ipc'
import { createEventCoalescer } from '../lib/eventCoalescer'
import type {
  AttachmentView,
  ComposerAttachment,
  EffortLevel,
  NormalizedEvent,
  SendChatMessage
} from '../../../../../shared/ipc'
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

// 서브에이전트(Task) 라이브 메타 — subagent.task 이벤트(SDK task_*/child model)로 누적되는
// 진행 중 표시 값. reducer 미경유 transient(메인 transcript 파트 비오염), toolUseId 키.
// 영속/재로드 복원은 부모 Task tool_result.subagentMeta 가 담당.
export interface PendingSteerState {
  id: string
  text: string
  createdAt: number
}

export interface SubagentMetaState {
  taskId?: string
  model?: string
  subagentType?: string
  durationMs?: number
  toolUses?: number
  lastToolName?: string
  status?: 'completed' | 'failed' | 'stopped'
  // 진행 중 경과시간 로컬 틱 앵커(첫 비-settled 이벤트 수신 시각).
  startedAtMs?: number
}

export interface SessionEntry {
  session: ChatState
  live: LiveTurnState
  subagentMeta: Record<string, SubagentMetaState>
  pendingSteer?: PendingSteerState[]
}

interface QueuedNewChat {
  key: string
  payload: SendChatMessage
}

export interface ChatStoreState {
  sessions: Record<string, SessionEntry>
  activeKey: string
  pendingNewChatKey: string | null
  newChatQueue: QueuedNewChat[]
  recentsEpoch: number
  concurrencyByProjectId: Record<string, number>
}

// 새-채팅(아직 sessionId 미발급) 엔트리의 예약 키. 창당 1개 — main 의 pending 슬롯과 대칭.
export const NEW_CHAT_KEY = '__new__'

const EMPTY_LIVE: LiveTurnState = { text: '', reasoning: '' }
const EMPTY_PENDING_STEER: PendingSteerState[] = []
const EMPTY_SUBAGENT_META: Record<string, SubagentMetaState> = {}

// main 의 단일 default cwd — 부트스트랩 1회 조회 캐시. 새 엔트리 생성 시 주입해
// 새 대화에서도 `@` 파일 자동완성이 즉시 동작한다(init 이벤트가 같은 값으로 덮어쓰기만).
let cwdCache: string | null = null

function freshEntry(projectId: string | null = null): SessionEntry {
  return {
    session: { ...initialChatState, cwd: cwdCache, pendingProjectId: projectId },
    live: EMPTY_LIVE,
    subagentMeta: EMPTY_SUBAGENT_META,
    pendingSteer: []
  }
}

export const useChatStore = create<ChatStoreState>()(() => ({
  sessions: { [NEW_CHAT_KEY]: freshEntry() },
  activeKey: NEW_CHAT_KEY,
  pendingNewChatKey: null,
  newChatQueue: [],
  recentsEpoch: 0,
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

function patchPendingSteer(
  key: string,
  patch: (pending: PendingSteerState[]) => PendingSteerState[]
): void {
  setState((s) => {
    const entry = s.sessions[key]
    if (!entry) return s
    const prev = entry.pendingSteer ?? EMPTY_PENDING_STEER
    const next = patch(prev)
    if (next === prev) return s
    return { sessions: { ...s.sessions, [key]: { ...entry, pendingSteer: next } } }
  })
}

// subagent.task 이벤트를 해당 엔트리의 transient subagentMeta[toolUseId] 에 병합한다 — 정의된
// 필드만 갱신하고, 진행 중 경과시간 앵커(startedAtMs)는 첫 비-settled 이벤트에서 1회 기록.
function patchSubagentMeta(
  key: string,
  ev: Extract<NormalizedEvent, { type: 'subagent.task' }>
): void {
  setState((s) => {
    const entry = s.sessions[key]
    if (!entry) return s
    const prev = entry.subagentMeta[ev.toolUseId] ?? {}
    const next: SubagentMetaState = { ...prev }
    if (ev.taskId !== undefined) next.taskId = ev.taskId
    if (ev.model !== undefined) next.model = ev.model
    if (ev.subagentType !== undefined) next.subagentType = ev.subagentType
    if (ev.durationMs !== undefined) next.durationMs = ev.durationMs
    if (ev.toolUses !== undefined) next.toolUses = ev.toolUses
    if (ev.lastToolName !== undefined) next.lastToolName = ev.lastToolName
    if (ev.status !== undefined) next.status = ev.status
    if (ev.phase !== 'settled' && next.startedAtMs === undefined) next.startedAtMs = Date.now()
    return {
      sessions: {
        ...s.sessions,
        [key]: {
          ...entry,
          subagentMeta: { ...entry.subagentMeta, [ev.toolUseId]: next }
        }
      }
    }
  })
}

function isTerminalWithoutSession(ev: NormalizedEvent): boolean {
  if ('sessionId' in ev && ev.sessionId) return false
  return ev.type === 'error' || ev.type === 'turn.aborted' || ev.type === 'telemetry'
}

function sendNewChatPayload(payload: SendChatMessage): void {
  void chatApi.send(payload).catch((err) => console.error('[chat] send invoke rejected', err))
}

function releaseNewChatGate(expectedKey: string): void {
  let nextPayload: SendChatMessage | null = null
  setState((s) => {
    if (s.pendingNewChatKey !== expectedKey) return s
    const [next, ...restQueue] = s.newChatQueue
    nextPayload = next?.payload ?? null
    return {
      pendingNewChatKey: next?.key ?? null,
      newChatQueue: restQueue
    }
  })
  if (nextPayload) sendNewChatPayload(nextPayload)
}

// 새-채팅 pending draft 를 발급된 sessionId 키로 승격(re-key). 엔트리 객체 동일성을
// 보존해 진행 중 라이브 버퍼·메시지가 그대로 따라간다. main 의 promote(turn, sessionId)
// 신원가드가 resume session.updated 의 오승격을 차단하고, renderer 의 기존 sessionId
// 가드는 같은 세션 재방출을 방어한다(handoff 0040).
function promotePendingNewChat(sessionId: string): void {
  let nextPayload: SendChatMessage | null = null
  let missingPending = false
  setState((s) => {
    if (s.sessions[sessionId]) return s
    const pendingKey = s.pendingNewChatKey
    if (!pendingKey) {
      missingPending = true
      return s
    }
    const entry = s.sessions[pendingKey]
    if (!entry) {
      missingPending = true
      return { pendingNewChatKey: null }
    }
    const rest = { ...s.sessions }
    delete rest[pendingKey]
    const [next, ...restQueue] = s.newChatQueue
    nextPayload = next?.payload ?? null
    return {
      sessions: { ...rest, [sessionId]: entry },
      pendingNewChatKey: next?.key ?? null,
      newChatQueue: restQueue,
      recentsEpoch: s.recentsEpoch + 1,
      ...(s.activeKey === pendingKey ? { activeKey: sessionId } : {})
    }
  })
  if (missingPending)
    console.warn('[chat] session.updated without pending new-chat slot', sessionId)
  if (nextPayload) sendNewChatPayload(nextPayload)
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
  const evSessionId = 'sessionId' in ev ? ev.sessionId || null : null

  // session.updated = sessionId 발급/확정 시점 — main 에 진입한 pending draft 를 sessionId 키로 승격.
  if (ev.type === 'session.updated' && !getState().sessions[ev.sessionId]) {
    promotePendingNewChat(ev.sessionId)
  }

  let key: string | null = null
  // sessionId 이벤트가 pending draft 로 폴백 라우팅됐는가 — 터미널 이벤트 시 게이트 해제용.
  let pendingFallback = false
  if (evSessionId && getState().sessions[evSessionId]) key = evSessionId
  else if (evSessionId) {
    // entry 없는 sessionId — 폐기 전에 pending new-chat draft 로 폴백 라우팅(r2 견고화).
    // 승격(promote)이 어긋나거나 늦어도 그 턴의 에코(message.user)·에러·telemetry 가
    // draft 에 보이게 한다. pending draft 조차 없으면 삭제된 세션의 늦은 이벤트로 보고 폐기.
    const pendingKey = getState().pendingNewChatKey
    if (pendingKey && getState().sessions[pendingKey]?.session.sessionId == null) {
      key = pendingKey
      pendingFallback = true
    }
  } else {
    // sessionId 없는 message.user = 핸드오프 자동 메시지 조기 에코(0062 r4, 턴 시작 전 발행).
    // startHandoff 가 방금 세운 pendingNewChatKey(draft)로 라우팅해야 사용자가 그 사이 다른
    // 세션으로 이동해도 에코가 활성 화면을 오염하지 않는다(터미널 이벤트 폴백과 동형).
    key =
      isTerminalWithoutSession(ev) || ev.type === 'message.user'
        ? (getState().pendingNewChatKey ?? getState().activeKey)
        : getState().activeKey
  }
  if (!key) return // 미지 세션의 늦은 이벤트 — 폐기

  switch (ev.type) {
    case 'message.delta':
      patchLive(key, (live) => ({ ...live, text: live.text + ev.delta.text }))
      return

    case 'message.reasoning.delta':
      patchLive(key, (live) => ({ ...live, reasoning: live.reasoning + ev.delta.text }))
      return

    case 'message.completed':
      // 완성본(ev.message.text)이 text 파트로 커밋되므로 라이브 프리뷰는 비운다. 단,
      // 서브에이전트(Task) child 텍스트(parentToolRunId)는 메인 스트리밍이 아니므로 메인
      // 라이브 프리뷰를 건드리지 않는다(우측 패널 child 트랜스크립트 전용).
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      if (ev.parentToolRunId === undefined) {
        patchLive(key, (live) => (live.text !== '' ? { ...live, text: '' } : live))
      }
      return

    case 'message.reasoning':
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      patchLive(key, (live) => (live.reasoning !== '' ? { ...live, reasoning: '' } : live))
      return

    case 'turn.retrying':
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      return

    case 'subagent.task':
      // reducer 미경유 — 우측 패널·AgentTaskRow 표시용 transient 메타로만 흡수.
      patchSubagentMeta(key, ev)
      return

    case 'steer.queued':
      patchPendingSteer(key, (pending) =>
        pending.some((item) => item.id === ev.id)
          ? pending.map((item) =>
              item.id === ev.id ? { id: ev.id, text: ev.text, createdAt: ev.createdAt } : item
            )
          : [...pending, { id: ev.id, text: ev.text, createdAt: ev.createdAt }]
      )
      return

    case 'steer.flushed':
      // 소비 확정 = 즉시 일반 커밋 사용자 메시지로 굳힌다(연회색/기울임 pending → 정상 폰트).
      // 직전 어시스턴트 message.completed 뒤(producer-pull FIFO)에 도착하므로 messages 는
      // [어시스턴트 응답-전][steer user] 순이 되고, 이후 어시스턴트 파트는 appendAssistantPart
      // 가 새 메시지(그 아래)로 형성한다. main 도 같은 경계에서 DB row 를 분리해 재로드 정합.
      patchPendingSteer(key, (pending) => pending.filter((item) => !ev.ids.includes(item.id)))
      dispatchTo(key, {
        type: 'APPEND_COMMITTED_USER_MESSAGE',
        text: ev.text,
        createdAt: ev.createdAt
      })
      return

    case 'steer.cancelled':
      patchPendingSteer(key, (pending) => pending.filter((item) => item.id !== ev.id))
      return

    case 'message.user':
      // main 조립 발화 에코(0062 handoff 자동 메시지) — 렌더러 낙관 렌더가 없는 user 발화를
      // 커밋 메시지로 굳힌다(steer.flushed 와 동형).
      dispatchTo(key, {
        type: 'APPEND_COMMITTED_USER_MESSAGE',
        text: ev.text,
        createdAt: ev.createdAt
      })
      return

    case 'telemetry': {
      // message.completed 없이 턴이 끝난 경우 잔여 라이브 텍스트를 text 파트로 굳힌다.
      const leftover = getState().sessions[key]?.live.text ?? ''
      if (leftover !== '') dispatchTo(key, { type: 'COMMIT_PENDING_TEXT', text: leftover })
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      resetLive(key)
      if (!evSessionId || pendingFallback) releaseNewChatGate(key)
      return
    }

    case 'turn.aborted':
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      resetLive(key)
      if (!evSessionId || pendingFallback) releaseNewChatGate(key)
      return

    case 'error':
      // 턴 중단 — 미완 라이브 프리뷰는 커밋하지 않고 버린다(기존 동작 동형).
      // 폴백 라우팅(승격 실패)으로 끝난 턴도 새-채팅 게이트를 해제한다(r2).
      dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      resetLive(key)
      if (!evSessionId || pendingFallback) releaseNewChatGate(key)
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

function send(
  text: string,
  attachments: ComposerAttachment[] = [],
  attachmentViews: AttachmentView[] = []
): boolean {
  const trimmed = text.trim()
  const cur = getActiveChatSession()
  if (trimmed === '' || cur.inflight) return false

  if (cur.sessionId == null) {
    const activeKey = getState().activeKey
    const draftKey = `draft:${crypto.randomUUID()}`
    const payload: SendChatMessage = {
      sessionId: null,
      projectId: cur.pendingProjectId,
      text: trimmed,
      permissionMode: cur.permissionMode,
      providerKey: cur.providerKey,
      modelFamily: cur.modelFamily,
      effort: cur.effort,
      attachments: [...attachments],
      attachmentViews: [...attachmentViews],
      cwd: cur.cwd,
      // fork draft(0062) 첫 전송 = 물질화 트리거. main 이 SDK forkSession 으로 새 id 를
      // 발급받고 display 복사 + lineage 를 남긴다.
      ...(cur.forkFrom != null ? { forkFrom: cur.forkFrom } : {})
    }
    let shouldDispatch = false
    setState((s) => {
      const entry = s.sessions[activeKey]
      if (!entry || entry.session.sessionId != null) return s
      const nextEntry: SessionEntry = {
        ...entry,
        session: chatReducer(entry.session, {
          type: 'SEND_USER_MESSAGE',
          text: trimmed,
          attachmentViews
        }),
        live: EMPTY_LIVE
      }
      const sessions = { ...s.sessions }
      delete sessions[activeKey]
      sessions[draftKey] = nextEntry
      // 새-채팅 슬롯에서 보낸 경우에만 슬롯을 재생성한다 — fork draft(draft: 키) 전송이
      // 기존 __new__ 슬롯(사용자의 모델/모드 선택)을 리셋하지 않게.
      if (activeKey === NEW_CHAT_KEY) sessions[NEW_CHAT_KEY] = freshEntry(cur.pendingProjectId)
      if (s.pendingNewChatKey == null) {
        shouldDispatch = true
        return {
          sessions,
          activeKey: draftKey,
          pendingNewChatKey: draftKey
        }
      }
      return {
        sessions,
        activeKey: draftKey,
        newChatQueue: [...s.newChatQueue, { key: draftKey, payload }]
      }
    })
    if (shouldDispatch) sendNewChatPayload(payload)
    return true
  }

  // 새 턴 시작 — 직전 턴의 잔여 라이브 버퍼 제거(구 SEND_USER_MESSAGE 의 pending 리셋).
  resetLive(getState().activeKey)
  dispatchActive({ type: 'SEND_USER_MESSAGE', text: trimmed, attachmentViews })
  // 새 채팅 (sessionId=null) 첫 메시지일 때만 projectId 전달. resume 경로면 main 이
  // sessionId 로부터 직접 project_id 를 조회하므로 여기서는 null.
  // fire-and-forget — 정상 턴 에러는 main 이 chat:error 이벤트로 surface 한다. invoke 자체가
  // 거부되는 경우(pre-turn throw)는 main 에서 chat:error 로 변환하지만, 누락 방지 방어선으로
  // 여기서도 거부를 삼켜 unhandled rejection 콘솔 노이즈를 막는다.
  void chatApi
    .send({
      sessionId: cur.sessionId,
      projectId: cur.sessionId ? null : cur.pendingProjectId,
      text: trimmed,
      permissionMode: cur.permissionMode,
      providerKey: cur.providerKey,
      modelFamily: cur.modelFamily,
      effort: cur.effort,
      attachments,
      attachmentViews,
      cwd: null
    })
    .catch((err) => console.error('[chat] send invoke rejected', err))
  return true
}

function setPendingCwd(cwd: string): void {
  setState((s) => {
    const entry = s.sessions[s.activeKey]
    if (!entry || entry.session.sessionId != null) return s
    return {
      sessions: {
        ...s.sessions,
        [s.activeKey]: { ...entry, session: chatReducer(entry.session, { type: 'SET_CWD', cwd }) }
      }
    }
  })
}

function steer(text: string): boolean {
  const trimmed = text.trim()
  const cur = getActiveChatSession()
  if (trimmed === '' || !cur.inflight || !cur.sessionId) return false
  const key = getState().activeKey
  const id = crypto.randomUUID()
  patchPendingSteer(key, (pending) => [...pending, { id, text: trimmed, createdAt: Date.now() }])
  void chatApi
    .steer({ sessionId: cur.sessionId, text: trimmed, clientRequestId: id })
    .catch((err) => {
      patchPendingSteer(key, (pending) => pending.filter((item) => item.id !== id))
      console.error('[chat] steer invoke rejected', err)
    })
  return true
}

function cancelSteer(id: string): string | null {
  const cur = getActiveChatSession()
  if (!cur.sessionId) return null
  const key = getState().activeKey
  let text: string | null = null
  patchPendingSteer(key, (pending) => {
    const found = pending.find((item) => item.id === id)
    text = found?.text ?? null
    return pending.filter((item) => item.id !== id)
  })
  void chatApi
    .cancelSteer({ sessionId: cur.sessionId, id })
    .catch((err) => console.error('[chat] cancelSteer invoke rejected', err))
  return text
}

function cancel(): void {
  const s = getState()
  const activeKey = s.activeKey
  if (s.newChatQueue.some((item) => item.key === activeKey)) {
    setState((st) => {
      const sessions = { ...st.sessions }
      delete sessions[activeKey]
      return {
        sessions: { ...sessions, [NEW_CHAT_KEY]: sessions[NEW_CHAT_KEY] ?? freshEntry() },
        activeKey: NEW_CHAT_KEY,
        newChatQueue: st.newChatQueue.filter((item) => item.key !== activeKey)
      }
    })
    void settingsApi.set({ lastSessionId: null })
    return
  }

  const sid = getActiveChatSession().sessionId
  if (sid) void chatApi.cancel(sid)
  dispatchActive({ type: 'CANCEL_CHAT' })
}

// 서브에이전트(Task) 단위 중단 — 활성 세션의 진행 중 턴에서 한 Agent 도구만 멈춘다(turn 계속).
// main 이 toolUseId→task_id 를 찾아 SDK stopTask 호출하고, 클릭 즉시 합성 aborted tool_result 를 전파한다.
function stopSubagent(toolUseId: string): void {
  const sid = getActiveChatSession().sessionId
  if (sid) void chatApi.stopSubagent(sid, toolUseId)
}

function newChat(projectId: string | null = null): void {
  setState((s) => ({
    sessions: { ...s.sessions, [NEW_CHAT_KEY]: freshEntry(projectId) },
    activeKey: NEW_CHAT_KEY
  }))
  void settingsApi.set({ lastSessionId: null })
}

// ── 0062 continuity — fork draft / handoff ──────────────────────────────────

const isContinuityDraft = (e: SessionEntry): boolean =>
  e.session.sessionId == null && (e.session.forkFrom != null || e.session.handoffFrom != null)

// nav(최근 대화)에서 draft 행을 클릭해 활성화한다(0062 r4). 반환값 = 부모 세션 id —
// 호출자(app 셸)가 /chat/<부모> 로 navigate 해 라우트 싱크의 draft 가드(소스-URL 한정)와
// 정합을 맞춘다. draft 가 아니거나 없으면 null.
function activateContinuityDraft(key: string): string | null {
  const s = getState()
  const e = s.sessions[key]
  if (!e || !isContinuityDraft(e)) return null
  if (s.activeKey !== key) setState({ activeKey: key })
  return e.session.forkFrom ?? e.session.handoffFrom
}

// nav 행 삭제 = draft 폐기(메모리 전용 — 영속 흔적 0). 전송 진행/대기(pending·queue) 중이면
// 승격 게이트가 꼬이므로 거부한다. 활성 draft 였다면 부모 세션 엔트리로 복귀한다 —
// draft 는 /chat/<부모> URL 위에 얹힌 파생 뷰라 URL 은 이미 부모를 가리킨다(라우트 불변).
function discardContinuityDraft(key: string): boolean {
  const s = getState()
  const e = s.sessions[key]
  if (!e || !isContinuityDraft(e)) return false
  if (s.pendingNewChatKey === key || s.newChatQueue.some((q) => q.key === key)) return false
  const parent = e.session.forkFrom ?? e.session.handoffFrom
  setState((st) => {
    const rest = { ...st.sessions }
    delete rest[key]
    if (st.activeKey !== key) return { sessions: rest }
    if (parent && rest[parent]) return { sessions: rest, activeKey: parent }
    return {
      sessions: { ...rest, [NEW_CHAT_KEY]: rest[NEW_CHAT_KEY] ?? freshEntry() },
      activeKey: NEW_CHAT_KEY
    }
  })
  return true
}

// 같은 부모의 미전송 draft 를 새 draft 생성 전에 정리한다(중복 nav 행 방지) — 활성/전송
// 대기(pending·queue) 엔트리는 보존. r4 부터 draft 는 다른 세션으로 이탈해도 nav 행으로
// 살아남고(fork 클릭 = nav 즉시 추가), 폐기는 명시 삭제(discard) 또는 같은 부모 재생성
// 교체로만 일어난다. 취소 = no-op 불변식은 유지 — draft 는 메모리 전용이라 영속 흔적 0.
function pruneUnsentContinuityDrafts(parentSessionId: string): void {
  setState((s) => {
    const stale = Object.entries(s.sessions).filter(
      ([key, e]) =>
        key !== s.activeKey &&
        key !== s.pendingNewChatKey &&
        !s.newChatQueue.some((q) => q.key === key) &&
        e.session.sessionId == null &&
        (e.session.forkFrom === parentSessionId || e.session.handoffFrom === parentSessionId)
    )
    if (stale.length === 0) return s
    const sessions = { ...s.sessions }
    for (const [key] of stale) delete sessions[key]
    return { sessions }
  })
}

// 분기(fork) draft 생성 — 활성(확정) 세션의 transcript 를 읽기전용 clone 으로 프리필한
// draft 엔트리를 만들고 전환만 한다. DB·런타임·IPC 0(뷰만) — 물질화는 첫 보내기(send 의
// forkFrom 분기)에서. 생성 즉시 nav '최근 대화' 에 draft 행으로 노출된다(r4) — 이탈해도
// 살아남고, 같은 부모의 이전 미전송 draft 는 여기서 교체 정리된다.
function startForkDraft(): boolean {
  const s = getState()
  const src = s.sessions[s.activeKey]?.session
  if (!src?.sessionId || src.loadingSession) return false
  pruneUnsentContinuityDrafts(src.sessionId)
  const draftKey = `draft:${crypto.randomUUID()}`
  const draft: SessionEntry = {
    session: {
      ...initialChatState,
      // 클릭 즉시 새 세션 정체성(r3) — main 의 DB 초기 제목과 같은 마커 형식.
      title: `[분기] ${src.title?.trim() || src.sessionId.slice(0, 8)}`,
      cwd: src.cwd,
      pendingProjectId: src.projectId,
      projectId: src.projectId,
      providerKey: src.providerKey,
      modelFamily: src.modelFamily,
      effort: src.effort,
      permissionMode: src.permissionMode,
      lastTelemetry: src.lastTelemetry,
      messages: [...src.messages],
      forkFrom: src.sessionId,
      lineageParentTitle: src.title
    },
    live: EMPTY_LIVE,
    subagentMeta: EMPTY_SUBAGENT_META,
    pendingSteer: []
  }
  setState((st) => ({
    sessions: { ...st.sessions, [draftKey]: draft },
    activeKey: draftKey
  }))
  return true
}

// 핸드오프 — 클릭 = 즉시 물질화(사용자 정정, plan r2). 빈 draft 엔트리로 전환하고
// handoffFrom send 를 즉시 발행한다(text 는 main 이 /compact 자동 메시지로 조립·대체).
// 자동 메시지는 message.user 에코로, 압축 완료는 session.compacted 로 transcript 에 커밋된다.
function startHandoff(): boolean {
  const s = getState()
  const src = s.sessions[s.activeKey]?.session
  // 가드: 확정 세션 + 턴 비진행 + 사용자 턴 2회 이상(Composer 비활성 가드와 이중 방어).
  if (!src?.sessionId || src.inflight || src.loadingSession) return false
  if (src.messages.filter((m) => m.role === 'user').length < 2) return false
  // 다른 새-채팅 전송이 pending 이면 조용한 큐 대기 대신 거부 — silent stuck 방지(r2).
  if (s.pendingNewChatKey != null) return false
  pruneUnsentContinuityDrafts(src.sessionId)
  const sourceSessionId = src.sessionId
  const draftKey = `draft:${crypto.randomUUID()}`
  const payload: SendChatMessage = {
    sessionId: null,
    projectId: src.projectId,
    text: '',
    permissionMode: src.permissionMode,
    providerKey: src.providerKey,
    modelFamily: src.modelFamily,
    effort: src.effort,
    attachments: [],
    attachmentViews: [],
    cwd: null,
    handoffFrom: sourceSessionId
  }
  const draft: SessionEntry = {
    session: {
      ...initialChatState,
      // 클릭 즉시 새 세션 정체성(r3) — main 의 DB 초기 제목과 같은 마커 형식.
      title: `[핸드오프] ${src.title?.trim() || sourceSessionId.slice(0, 8)}`,
      cwd: src.cwd,
      pendingProjectId: src.projectId,
      projectId: src.projectId,
      providerKey: src.providerKey,
      modelFamily: src.modelFamily,
      effort: src.effort,
      permissionMode: src.permissionMode,
      inflight: true,
      turnStartedAt: Date.now(),
      handoffFrom: sourceSessionId,
      lineageParentTitle: src.title
    },
    live: EMPTY_LIVE,
    subagentMeta: EMPTY_SUBAGENT_META,
    pendingSteer: []
  }
  setState((st) => ({
    sessions: { ...st.sessions, [draftKey]: draft },
    activeKey: draftKey,
    pendingNewChatKey: draftKey
  }))
  sendNewChatPayload(payload)
  return true
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
    sessions: {
      ...st.sessions,
      [sessionId]: { session: loadingSession, live: EMPTY_LIVE, subagentMeta: EMPTY_SUBAGENT_META }
    },
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

// 인라인 코멘트 묶음(+선택 메모)으로 계획 수정 요청. main 이 구조화 태그(ORCA_PLAN_FEEDBACK)로
// 직렬화한다(prompts/plan-feedback.ts). 보낼 내용이 없으면 no-op.
function revisePlanWithComments(requestId: string, comments: PlanComment[], note: string): void {
  const feedback = toPlanFeedback(comments, note)
  if (feedback.comments.length === 0 && feedback.note === undefined) return
  void permissionApi.respond({
    approvalId: requestId,
    resolution: { behavior: 'deny', planFeedback: feedback }
  })
  dispatchActive({ type: 'RESOLVE_PLAN' })
}

function rejectPlan(requestId: string): void {
  // reject = deny(중단 안내 메시지). interrupt 없이 보내야 deny 가 모델에 전달된다 —
  // interrupt 는 approvals.respond 에서 broker.resolve(deny=마이크로태스크) 직후 동기 abort 라
  // deny 가 SDK 까지 전파되기 전 쿼리를 죽여 PLAN_REJECT_MESSAGE 가 유실된다. clean deny 면
  // 모델이 거부를 인지하고 짧게 응답한 뒤 턴이 자연 종료된다(skipAsk/denyTool 과 동일 패턴).
  void permissionApi.respond({
    approvalId: requestId,
    resolution: { behavior: 'deny' }
  })
  dispatchActive({ type: 'RESOLVE_PLAN' })
}

// 위험 도구 승인 — 허용(이번만) / 세션 동안 허용 / 거부(턴 계속, 중단 아님).
function approveTool(approvalId: string): void {
  void permissionApi.respond({ approvalId, resolution: { behavior: 'allow' } })
  dispatchActive({ type: 'RESOLVE_TOOL_APPROVAL', approvalId })
}

function approveToolForSession(approvalId: string, toolName: string): void {
  void permissionApi.respond({
    approvalId,
    resolution: { behavior: 'allow', updatedPermissions: [{ toolName, scope: 'session' }] }
  })
  dispatchActive({ type: 'RESOLVE_TOOL_APPROVAL', approvalId })
}

function denyTool(approvalId: string): void {
  // 거부만 — interrupt 없이 deny 라 턴은 계속된다(에이전트가 다른 경로 모색).
  void permissionApi.respond({
    approvalId,
    resolution: { behavior: 'deny', interrupt: false }
  })
  dispatchActive({ type: 'RESOLVE_TOOL_APPROVAL', approvalId })
}

// 안정 액션 묶음 — 모듈 상수라 컴포넌트가 deps/메모 걱정 없이 직접 import 하거나 props 로
// 전달할 수 있다(컴포넌트는 selector / action 만 사용, state.md §1.3).
export const chatActions = {
  send,
  steer,
  cancelSteer,
  cancel,
  newChat,
  startForkDraft,
  startHandoff,
  activateContinuityDraft,
  discardContinuityDraft,
  setPendingCwd,
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
  revisePlanWithComments,
  rejectPlan,
  addPlanComment: (comment: PlanComment): void =>
    dispatchActive({ type: 'ADD_PLAN_COMMENT', comment }),
  updatePlanComment: (id: string, body: string): void =>
    dispatchActive({ type: 'UPDATE_PLAN_COMMENT', id, body }),
  removePlanComment: (id: string): void => dispatchActive({ type: 'REMOVE_PLAN_COMMENT', id }),
  setActivePlanComment: (id: string | null): void =>
    dispatchActive({ type: 'SET_ACTIVE_PLAN_COMMENT', id }),
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
  selectSubagentTask: (toolRunId: string | null): void =>
    dispatchActive({ type: 'SELECT_SUBAGENT_TASK', toolRunId }),
  openSubagentTask: (toolRunId: string): void =>
    dispatchActive({ type: 'OPEN_SUBAGENT_TASK', toolRunId }),
  stopSubagent,
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

export function usePendingSteer(): PendingSteerState[] {
  return useChatStore((s) => s.sessions[s.activeKey].pendingSteer ?? EMPTY_PENDING_STEER)
}

// 서브에이전트(Task) 라이브 메타 — 진행 중 모델/경과시간/현재도구/도구수 표시용. 해당
// toolUseId 엔트리가 갱신될 때만 재렌더(stored 참조 안정).
export function useSubagentMeta(toolUseId: string): SubagentMetaState | undefined {
  return useChatStore((s) => s.sessions[s.activeKey].subagentMeta[toolUseId])
}

// nav '최근 대화' 에 즉시 노출할 continuity draft 행(0062 r4 — fork 클릭 = nav 즉시 추가).
// sessions 는 델타 프레임마다 identity 가 바뀌므로, 행을 원시 문자열로 인코딩해 useShallow 로
// draft 집합이 실제로 변할 때만 재렌더한다(제목/프로젝트 변경 포함). 최신 draft 가 위로.
export interface ContinuityDraftRow {
  key: string
  title: string | null
  projectId: string | null
  parentSessionId: string
}

export function useContinuityDraftRows(): ContinuityDraftRow[] {
  const encoded = useChatStore(
    useShallow((s) =>
      Object.entries(s.sessions)
        .filter(([, e]) => isContinuityDraft(e))
        .map(([key, e]) =>
          [
            key,
            e.session.title ?? '',
            e.session.projectId ?? '',
            e.session.forkFrom ?? e.session.handoffFrom ?? ''
          ].join('\u0000')
        )
    )
  )
  return useMemo(
    () =>
      encoded
        .map((row) => {
          const [key, title, projectId, parentSessionId] = row.split('\u0000')
          return {
            key,
            title: title || null,
            projectId: projectId || null,
            parentSessionId
          }
        })
        .reverse(),
    [encoded]
  )
}

// 활성 엔트리가 continuity draft 면 그 키 — nav 활성 강조가 URL(부모 세션) 행이 아니라
// draft 행에 붙도록 셸이 참조한다.
export function useActiveContinuityDraftKey(): string | null {
  return useChatStore((s) => {
    const e = s.sessions[s.activeKey]
    return e && isContinuityDraft(e) ? s.activeKey : null
  })
}

export function useNewChatPending(key?: string): boolean {
  return useChatStore((s) => {
    const target = key ?? s.activeKey
    return s.newChatQueue.some((item) => item.key === target)
  })
}

export function useChatRecentsEpoch(): number {
  return useChatStore((s) => s.recentsEpoch)
}

// 라이브 사고 리프 전용 — 활성 세션의 reasoning 델타에만 재렌더(본문 text 델타와 격리).
export function useLiveReasoning(): string {
  return useChatStore((s) => s.sessions[s.activeKey].live.reasoning)
}

export function useProjectConcurrencyCount(projectId: string | null): number {
  return useChatStore((s) => (projectId ? (s.concurrencyByProjectId[projectId] ?? 0) : 0))
}
