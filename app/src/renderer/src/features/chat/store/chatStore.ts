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
import { steerBlockedByProviderBoundary } from '../lib/steerGate'
import {
  chatApi,
  concurrencyApi,
  permissionApi,
  sessionApi,
  settingsApi
} from '../../../shared/api/ipc'
import { createEventCoalescer, type DeltaEvent } from '../lib/eventCoalescer'
import type {
  AttachmentView,
  ComposerAttachment,
  EffortLevel,
  NormalizedEvent,
  SendChatMessage
} from '../../../../../shared/ipc'
import {
  PLAN_APPROVED_MODE,
  type NormalizedPermissionMode
} from '../../../../../shared/permission-mode'
import { continuityLangFor, continuityTitle } from '../../../../../shared/continuity-lang'
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
  // 소유권(0151) — true 면 stdin 주입이 끝나 **취소 불가**(main 이 취소를 거부한다). 버블은
  // 취소 버튼을 감추고 "전달됨" 으로 보인다. 예약 롤백(닫힌 입력 스트림)이면 다시 false 로 돌아온다.
  submitted?: boolean
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
  // 중단 버튼의 held 전량 취소(0067 확정 5) — main 의 message.cancelled 에서 잔존 항목 텍스트를
  // 모아 여기 실으면 ChatTile 이 구독해 Composer draft 로 복원한다(편집 가능). seq 로 중복 소비 방지.
  draftRestore: { key: string; seq: number; text: string } | null
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
  concurrencyByProjectId: {},
  draftRestore: null
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

// 턴-시작 낙관 커밋(0068) 합류 판정 — 해당 세션의 messages 에 같은 clientId 의 user 버블이
// 이미 있으면 main 의 queued/committed 이벤트는 표시를 중복 생성하지 않는다.
function hasCommittedClientId(key: string, id: string): boolean {
  const entry = getState().sessions[key]
  if (!entry) return false
  return entry.session.messages.some((m) => m.role === 'user' && m.clientId === id)
}

function isTerminalWithoutSession(ev: NormalizedEvent): boolean {
  if ('sessionId' in ev && ev.sessionId) return false
  return ev.type === 'error' || ev.type === 'turn.aborted' || ev.type === 'telemetry'
}

// 자동 연속 턴(0067 AC7) — renderer 의 send 없이 main 이 시작한 턴도 활동 이벤트가 오면
// inflight 로 전이해 도넛/중단 버튼/스크롤 앵커가 정상 동작하게 한다.
const TURN_ACTIVITY_EVENTS = new Set<NormalizedEvent['type']>([
  'message.delta',
  'message.reasoning.delta',
  'message.completed',
  'message.reasoning',
  'tool.call.started'
])

// 이 이벤트가 유휴 세션의 턴을 열어야 하는가.
//
// 0143: 서브에이전트 child 이벤트(parentToolRunId)는 제외 — listen 대기 중 백그라운드 child
// 스트림이 메인 inflight 를 점멸시키지 않는다(대기 표시는 listening 레벨 상태가 담당).
// foreground(메인 턴 내) child 는 inflight 가 이미 true 라 제외해도 무영향.
//
// 0149: 델타가 코얼레서 배치 경로로 갈라지면서 이 규칙이 두 벌이 됐고, 0143 의 child 제외가
// receive 쪽에만 붙어 라이브 델타에는 실효되지 않았다 — 두 경로가 같은 술어를 쓴다.
function shouldBeginTurn(ev: NormalizedEvent, session: { inflight: boolean }): boolean {
  return (
    TURN_ACTIVITY_EVENTS.has(ev.type) &&
    (ev as { parentToolRunId?: string }).parentToolRunId === undefined &&
    session.inflight === false
  )
}

// sessionId 를 가진 이벤트의 라우팅 키 — 엔트리가 있으면 그 키, 없으면 pending new-chat
// draft 로 폴백(승격이 늦거나 어긋나도 그 턴이 draft 에 보이게 한다, r2 견고화).
// 둘 다 아니면 삭제된 세션의 늦은 이벤트로 보고 폐기(null).
function resolveSessionKey(
  sessions: Record<string, { session: { sessionId: string | null } }>,
  pendingNewChatKey: string | null,
  sessionId: string
): { key: string | null; pendingFallback: boolean } {
  if (sessions[sessionId]) return { key: sessionId, pendingFallback: false }
  if (pendingNewChatKey && sessions[pendingNewChatKey]?.session.sessionId == null) {
    return { key: pendingNewChatKey, pendingFallback: true }
  }
  return { key: null, pendingFallback: false }
}

// 한 scheduler window의 모든 live delta를 단일 Zustand transaction으로 반영한다.
// session 커밋 슬라이스 identity는 BEGIN_TURN이 필요한 첫 활동을 제외하고 그대로 유지된다.
function receiveDeltaBatch(events: readonly DeltaEvent[]): void {
  if (events.length === 0) return
  setState((state) => {
    let sessions = state.sessions
    for (const event of events) {
      // 라우팅·턴 시작 판정은 receive 와 같은 술어를 쓴다(0149) — 두 경로가 갈라지지 않는다.
      const { key } = resolveSessionKey(sessions, state.pendingNewChatKey, event.sessionId)
      if (!key) continue
      const entry = sessions[key]
      if (!entry) continue

      const session = shouldBeginTurn(event, entry.session)
        ? chatReducer(entry.session, { type: 'BEGIN_TURN' })
        : entry.session
      const live =
        event.type === 'message.delta'
          ? { ...entry.live, text: entry.live.text + event.delta.text }
          : { ...entry.live, reasoning: entry.live.reasoning + event.delta.text }

      if (sessions === state.sessions) sessions = { ...sessions }
      sessions[key] = { ...entry, session, live }
    }
    return sessions === state.sessions ? state : { sessions }
  })
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

// 코얼레서가 비운 비-delta 이벤트의 최종 수신부 — React 트리 밖 dispatch(state.md §4.4.2).
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
  if (evSessionId) {
    const resolved = resolveSessionKey(
      getState().sessions,
      getState().pendingNewChatKey,
      evSessionId
    )
    key = resolved.key
    pendingFallback = resolved.pendingFallback
  } else {
    // sessionId 없는 message.queued = 새 세션 send 의 pending 등록(0067 — 핸드오프 자동 메시지
    // 포함, 턴 시작 전 발행). startHandoff/send 가 방금 세운 pendingNewChatKey(draft)로
    // 라우팅해야 사용자가 그 사이 다른 세션으로 이동해도 활성 화면을 오염하지 않는다.
    key =
      isTerminalWithoutSession(ev) || ev.type === 'message.queued'
        ? (getState().pendingNewChatKey ?? getState().activeKey)
        : getState().activeKey
  }
  if (!key) return // 미지 세션의 늦은 이벤트 — 폐기

  const entrySession = getState().sessions[key]?.session
  if (entrySession && shouldBeginTurn(ev, entrySession)) {
    dispatchTo(key, { type: 'BEGIN_TURN' })
  }

  // 델타(message.delta·message.reasoning.delta)는 여기 오지 않는다 — 코얼레서가 전량
  // receiveDeltaBatch 로 라우팅한다(sink.emit=receive 는 비-델타 전용).
  switch (ev.type) {
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
      // 우측 패널·AgentTaskRow 표시용 transient 메타 흡수 + **백그라운드 완료 통지**(0143) —
      // settled+background(main 권위 게이팅)만 reducer 로 넘겨 subagent_notice 파트를 커밋한다
      // (writer 영속과 동형 — 라이브·재로드 렌더 일치. 그 외 phase 는 종전대로 reducer 미경유).
      patchSubagentMeta(key, ev)
      if (ev.phase === 'settled' && ev.background === true) {
        dispatchTo(key, { type: 'RECV_EVENT', event: ev })
      }
      return

    case 'message.queued':
      // steer 예약·핸드오프 자동 메시지의 pending 버블(0067 AC8) — id(clientRequestId)로
      // 낙관 항목과 합류(upsert). 턴-시작 send 는 이미 낙관 커밋 버블(0068)이므로 skip —
      // pending 이중 표시를 만들지 않는다.
      if (hasCommittedClientId(key, ev.id)) return
      patchPendingSteer(key, (pending) =>
        pending.some((item) => item.id === ev.id)
          ? pending.map((item) =>
              item.id === ev.id ? { id: ev.id, text: ev.text, createdAt: ev.createdAt } : item
            )
          : [...pending, { id: ev.id, text: ev.text, createdAt: ev.createdAt }]
      )
      return

    case 'message.committed':
      // 소비 확정(echo 관측) — pending 항목(steer 등)은 일반 커밋 사용자 메시지로 승격하고,
      // 턴-시작 낙관 커밋 분(0068)은 clientId 멱등(reducer 가드 + ids 스킵)으로 화해만 한다.
      // echo 없이 남은 pending 은 큐(held/CLI 큐)에 살아있는 진행 상태 그대로다 — 자동 연속
      // 턴이나 respawn 재전달로 커밋된다.
      patchPendingSteer(key, (pending) => pending.filter((item) => !ev.ids.includes(item.id)))
      if (ev.ids.some((id) => hasCommittedClientId(key, id))) return
      dispatchTo(key, {
        type: 'APPEND_COMMITTED_USER_MESSAGE',
        text: ev.text,
        createdAt: ev.createdAt,
        clientId: ev.ids[0],
        ...(ev.attachmentViews ? { attachmentViews: ev.attachmentViews } : {})
      })
      return

    case 'message.submitted':
      // 소유권 전이(0151) — held(취소 가능) ↔ submitted(전달됨). 취소 버튼 노출만 바뀌고 버블
      // 자체는 그대로다(커밋은 여전히 message.committed 가 한다).
      patchPendingSteer(key, (pending) => {
        let changed = false
        const next = pending.map((item) => {
          if (!ev.ids.includes(item.id) || (item.submitted ?? false) === ev.submitted) return item
          changed = true
          return { ...item, submitted: ev.submitted }
        })
        return changed ? next : pending
      })
      return

    case 'message.cancelled': {
      // held 취소 동기화. 아직 pending 에 남아있는 항목(=중단 버튼 전량 취소)의 텍스트는
      // composer draft 로 복원한다(0067 확정 5 — 편집 가능). hover 단건 취소는 renderer 가
      // 이미 낙관 제거+복원했으므로 잔존 항목이 없어 자연히 no-op 이 된다.
      const present = (getState().sessions[key]?.pendingSteer ?? []).filter((item) =>
        ev.ids.includes(item.id)
      )
      patchPendingSteer(key, (pending) => pending.filter((item) => !ev.ids.includes(item.id)))
      if (present.length > 0) {
        setState({
          draftRestore: {
            key,
            seq: Date.now(),
            text: present.map((item) => item.text).join('\n\n')
          }
        })
      }
      return
    }

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

// 스트리밍 델타 코얼레서 — 델타는 rAF 한 틱마다 모아 receiveDeltaBatch로 비운다.
// 단일 FIFO 버퍼가 세션 간 순서도 보존하며, 키 라우팅이 스테일 오염을 막으므로 세션
// 전환 시 dispose 하지 않는다(비활성 세션의 백그라운드 누적 유지). dispose 는 언마운트만.
const coalescer = createEventCoalescer(
  { emit: receive, emitDeltaBatch: receiveDeltaBatch },
  {
    schedule: (cb) => requestAnimationFrame(cb),
    cancel: (h) => cancelAnimationFrame(h)
  }
)

// IPC 인바운드 이벤트 1개 라우팅(코얼레서 경유). ChatProvider 부트스트랩이 구독을 연결한다.
export function ingestChatEvent(ev: NormalizedEvent): void {
  coalescer.push(ev)
}

// 단일 send(0067 AC5 → 0068 표시 계약 수정) — 예약(held)/즉시 flush 판정은 여전히 main
// 소관이지만, *표시* 는 턴 상태로 가른다: 턴을 여는 메시지(idle·새 세션)는 **낙관 커밋**
// (정식 버블 즉시, clientId 로 echo 커밋과 멱등 합류), busy 예약(steer)만 pending 항목
// (연회색/기울임)으로 시작해 echo 커밋이 승격한다. 0067 의 전면 pending-first 는 랜딩 전환
// 지연·답변 중 위치 점프를 만들어 폐기(0068 버그 리포트).
function send(
  text: string,
  attachments: ComposerAttachment[] = [],
  attachmentViews: AttachmentView[] = []
): boolean {
  const trimmed = text.trim()
  const cur = getActiveChatSession()
  if (trimmed === '') return false

  if (cur.sessionId == null) {
    // 새 세션 첫 턴 진행 중(id 미발급)엔 예약 큐 키가 없다 — main 가드와 대칭으로 거부.
    if (cur.inflight) return false
    const activeKey = getState().activeKey
    const draftKey = `draft:${crypto.randomUUID()}`
    const requestId = crypto.randomUUID()
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
      // 0067 AC9 — draft 키를 main 의 세션-이전 큐 키로 전달(init 에서 실 id 로 rekey).
      clientKey: draftKey,
      clientRequestId: requestId,
      // fork draft(0064) 첫 전송 = 물질화 트리거. main 이 SDK forkSession 으로 새 id 를
      // 발급받고 display 복사 + lineage 를 남긴다.
      ...(cur.forkFrom != null ? { forkFrom: cur.forkFrom } : {}),
      // 0127 — draft 생성 시점 언어 스냅샷 동봉: main initialTitle 이 draft 제목과 같은 언어로
      // 조립되게 한다(생성↔전송 사이 settings.language 변경 race 차단).
      ...(cur.forkFrom != null && cur.continuityLang != null
        ? { continuityLang: cur.continuityLang }
        : {})
    }
    let shouldDispatch = false
    setState((s) => {
      const entry = s.sessions[activeKey]
      if (!entry || entry.session.sessionId != null) return s
      const nextEntry: SessionEntry = {
        ...entry,
        // 낙관 커밋(0068) — 첫 메시지가 즉시 정식 버블로 서고 랜딩→transcript 전환을
        // 트리거한다. echo 커밋(message.committed)은 clientId 멱등으로 합류만 한다.
        session: chatReducer(chatReducer(entry.session, { type: 'BEGIN_TURN' }), {
          type: 'APPEND_COMMITTED_USER_MESSAGE',
          text: trimmed,
          clientId: requestId,
          ...(attachmentViews.length > 0 ? { attachmentViews: [...attachmentViews] } : {})
        }),
        live: EMPTY_LIVE,
        pendingSteer: entry.pendingSteer ?? []
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

  const sendKey = getState().activeKey
  const requestId = crypto.randomUUID()
  // 0143: listen 대기(listening) 중에도 main 세션은 busy(턴-후 루프 진행 중) — steer 예약
  // 경로로 보내야 낙관 커밋 vs message.queued 이중 렌더가 없다(main 은 held 로 수용 후
  // 릴리즈 밸브/유예를 거쳐 연속 턴으로 커밋한다).
  const busy = cur.inflight || cur.listening
  // 0119: busy 중 provider 경계를 넘는 모델이 선택돼 있으면 steer 예약을 거부한다 —
  // 진행 턴의 채널은 낡은 provider env 라 경계 너머 메시지를 실을 수 없다(Composer 게이트의
  // main-호출 직전 이중 방어). 본래 provider 로 되돌리면 통과.
  if (
    steerBlockedByProviderBoundary({
      inflight: busy,
      turnProviderKey: cur.turnProviderKey,
      selectedProviderKey: cur.providerKey
    })
  ) {
    return false
  }
  if (!busy) {
    // 턴을 여는 send — 잔여 라이브 버퍼 제거 + inflight 전이 + **낙관 커밋**(0068): 정식
    // user 버블이 즉시 서서 다음 어시스턴트 스트림이 올바른 턴 경계 아래로 흐른다. echo
    // 커밋(message.committed)은 clientId 멱등으로 화해만 한다.
    resetLive(sendKey)
    dispatchActive({ type: 'BEGIN_TURN' })
    dispatchActive({
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: trimmed,
      clientId: requestId,
      ...(attachmentViews.length > 0 ? { attachmentViews: [...attachmentViews] } : {})
    })
  } else {
    // busy 예약(steer) — pending 항목(연회색/기울임)으로 시작, 진행 중 턴 상태는 불변.
    patchPendingSteer(sendKey, (pending) => [
      ...pending,
      { id: requestId, text: trimmed, createdAt: Date.now() }
    ])
  }
  // fire-and-forget — 정상 턴 에러는 main 이 chat:error 이벤트로 surface 한다. invoke 자체가
  // 거부되면(큐 미적재 = echo 없음) 낙관 버블/pending 항목을 되물려 유령 버블을 막는다.
  void chatApi
    .send({
      sessionId: cur.sessionId,
      projectId: null,
      text: trimmed,
      permissionMode: cur.permissionMode,
      providerKey: cur.providerKey,
      modelFamily: cur.modelFamily,
      effort: cur.effort,
      attachments,
      attachmentViews,
      cwd: null,
      clientRequestId: requestId
    })
    .catch((err) => {
      if (busy) {
        patchPendingSteer(sendKey, (pending) => pending.filter((item) => item.id !== requestId))
      } else {
        dispatchTo(sendKey, { type: 'DROP_UNCOMMITTED_USER', clientId: requestId })
      }
      console.error('[chat] send invoke rejected', err)
    })
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

// 구 steer() 는 send() 로 흡수(0067 AC5) — busy/idle 판정은 main 소관, renderer 는 단일 send.

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

// ── 0064 continuity — fork draft / handoff ──────────────────────────────────

const isContinuityDraft = (e: SessionEntry): boolean =>
  e.session.sessionId == null && (e.session.forkFrom != null || e.session.handoffFrom != null)

// nav(최근 대화)에서 draft 행을 클릭해 활성화한다(0064 r4). 반환값 = 부모 세션 id —
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

// 제목 마커 — **영속 데이터라 uiLocale i18n 비대상**(0097 D3 유지). 0127 부터 언어는 draft
// 생성 시점의 settings.language 스냅샷(ko/en 2종)으로 결정하고, 마커·조립은 main 과 공용인
// shared/continuity-lang 의 continuityTitle 단일 조립점을 쓴다. draft↔물질화의 문자열 일치는
// send payload 의 continuityLang 스냅샷(부재 시 main 이 settings 파생 폴백)으로 보장한다.

// 선호 언어(settings.language) 캐시 — 부트스트랩 1회 조회(cwdCache 동형). draft 생성 시점
// 스냅샷 소스이며, 미시드(부트 직후 수 ms)면 ko 폴백(스키마 기본 '한국어' 정합).
let languageCache: string | null = null

// fork/handoff draft 공통 시드 — 원본 세션의 정체성·설정 메타 승계 + 마커 제목(0065 dedup).
// 제목은 main 의 DB 초기 제목(initialTitle)과 같은 형식이어야 물질화 후 표시가 이어진다.
function continuityDraftSession(src: ChatState, kind: 'fork' | 'handoff'): ChatState {
  const lang = continuityLangFor(languageCache ?? undefined)
  return {
    ...initialChatState,
    title: continuityTitle(kind, lang, src.title?.trim() || src.sessionId!.slice(0, 8)),
    continuityLang: lang,
    cwd: src.cwd,
    pendingProjectId: src.projectId,
    projectId: src.projectId,
    providerKey: src.providerKey,
    modelFamily: src.modelFamily,
    effort: src.effort,
    permissionMode: src.permissionMode,
    lineageParentTitle: src.title
  }
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
      ...continuityDraftSession(src, 'fork'),
      // fork 는 원본 컨텍스트를 그대로 갖고 시작하므로 도넛(lastTelemetry)도 승계한다.
      lastTelemetry: src.lastTelemetry,
      // 프리필 원본 이력 끝에 '분기된 지점' 구분선을 합성한다(r5 피드백 3) — 물질화 시
      // main(materializeContinuityArrival)이 같은 위치에 fork_boundary 파트를 영속하므로
      // 라이브 draft 와 재로드 표시가 일치한다.
      messages: [
        ...src.messages,
        ...(src.messages.length > 0
          ? [
              {
                role: 'assistant' as const,
                createdAt: Date.now(),
                parts: [{ type: 'fork_boundary' as const }]
              }
            ]
          : [])
      ],
      forkFrom: src.sessionId
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
// 자동 메시지는 message.queued(pending)→echo 커밋(message.committed)으로, 압축 완료는
// session.compacted 로 transcript 에 커밋된다(0067).
function startHandoff(): boolean {
  const s = getState()
  const src = s.sessions[s.activeKey]?.session
  // 가드: 확정 세션 + 턴 비진행 + 사용자 턴 2회 이상(Composer 비활성 가드와 이중 방어).
  // 0149 — listen 대기(main 의 턴-후 루프 진행 중)도 busy 로 센다(sessionBusy 단일 정의):
  // 백그라운드 서브에이전트를 기다리는 동안 핸드오프가 열리던 구멍을 막는다.
  if (!src?.sessionId || sessionBusy(src) || src.loadingSession) return false
  if (src.messages.filter((m) => m.role === 'user').length < 2) return false
  // 다른 새-채팅 전송이 pending 이면 조용한 큐 대기 대신 거부 — silent stuck 방지(r2).
  if (s.pendingNewChatKey != null) return false
  pruneUnsentContinuityDrafts(src.sessionId)
  const sourceSessionId = src.sessionId
  const draftKey = `draft:${crypto.randomUUID()}`
  // 시드를 payload 앞에 조립 — 생성 시점 언어 스냅샷(continuityLang)을 payload 에 동봉한다(0127).
  const seed = continuityDraftSession(src, 'handoff')
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
    handoffFrom: sourceSessionId,
    ...(seed.continuityLang != null ? { continuityLang: seed.continuityLang } : {}),
    // 0067 AC9 — draft 키 = 세션-이전 큐 키(자동 메시지의 pending 등록·echo 커밋 매칭).
    clientKey: draftKey
  }
  const draft: SessionEntry = {
    session: {
      ...seed,
      inflight: true,
      turnStartedAt: Date.now(),
      handoffFrom: sourceSessionId
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
  // 않아 ExitPlanMode 재호출(단순 질문 시 계획 카드 재출현)을 막는다. 여기는 낙관적 UI 갱신이고,
  // SDK 세션 전환은 어댑터가 같은 allow 응답의 updatedPermissions 로 원자 처리한다
  // (adapters/claude.ts) — 그래서 setPermissionMode() 처럼 별도 IPC 를 발행하지 않는다.
  dispatchActive({ type: 'SET_PERMISSION_MODE', mode: PLAN_APPROVED_MODE })
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

  // 선호 언어 1회 조회(0127) — continuity draft 의 언어 스냅샷 소스. 시드 전 draft 는 ko 폴백.
  void settingsApi.get().then((s) => {
    languageCache = s.language ?? null
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

// 세션이 "작업 중" 인가 — inflight(턴 진행) ‖ listening(백그라운드 서브에이전트 완료 대기).
//
// 0143 이 listening 을 두 번째 불리언으로 들이면서 소비처마다 `inflight || listening` 을 손으로
// 유도했고, 그 결과 일부가 누락돼 판정이 갈렸다(startHandoff·useChatSessionsSync·
// ProjectLandingPage 는 inflight 만 봤다). 0149: busy 정의를 스토어가 단독 소유한다 — 다음
// busy 하위 상태(압축 대기·승인 대기 등)가 생겨도 여기 한 곳만 고치면 된다.
// listening 자체는 PendingAssistant 의 경과시간 앵커 전용으로만 직접 읽는다.
export function useChatBusy(): boolean {
  return useChatSession(sessionBusy)
}

export function sessionBusy(s: Pick<ChatState, 'inflight' | 'listening'>): boolean {
  return s.inflight || s.listening
}

export function usePendingSteer(): PendingSteerState[] {
  return useChatStore((s) => s.sessions[s.activeKey].pendingSteer ?? EMPTY_PENDING_STEER)
}

// 서브에이전트(Task) 라이브 메타 — 진행 중 모델/경과시간/현재도구/도구수 표시용. 해당
// toolUseId 엔트리가 갱신될 때만 재렌더(stored 참조 안정).
export function useSubagentMeta(toolUseId: string): SubagentMetaState | undefined {
  return useChatStore((s) => s.sessions[s.activeKey].subagentMeta[toolUseId])
}

// nav '최근 대화' 에 즉시 노출할 draft 행(0064 r4 fork/handoff → 0065 '새 대화' 통일).
// continuity draft 는 존재하는 동안 항상(생존 라이프사이클), '새 대화' 슬롯은 **첫 전송
// 순간부터**(r2 사용자 피드백 — 클릭/진입만으로는 노출하지 않는다) 세션 id 승격까지의 창에
// 최상단 노출된다 — 승격 시 pendingNewChatKey 해제와 함께 DB 행으로 자연 교체. 제목 null 은
// SessionRow 의 '새 대화' 폴백을 재사용하고, parentSessionId=null 이 새-대화 행 판별자.
// sessions 는 델타 프레임마다 identity 가 바뀌므로, 행을 원시 문자열로 인코딩해 useShallow 로
// draft 집합이 실제로 변할 때만 재렌더한다(제목/프로젝트 변경 포함). 최신 draft 가 위로.
const DRAFT_ROW_SEP = String.fromCharCode(0)

// '새 대화' 슬롯이 nav 행으로 보일 조건 — 전송돼 세션 id 발급을 기다리는 중(pending/queue).
const isNewChatRowVisible = (s: ChatStoreState): boolean =>
  s.pendingNewChatKey === NEW_CHAT_KEY || s.newChatQueue.some((q) => q.key === NEW_CHAT_KEY)

export interface DraftRow {
  key: string
  title: string | null
  projectId: string | null
  parentSessionId: string | null
}

export function useDraftSessionRows(): DraftRow[] {
  const encoded = useChatStore(
    useShallow((s) => {
      const rows = Object.entries(s.sessions)
        .filter(([, e]) => isContinuityDraft(e))
        .map(([key, e]) =>
          [
            key,
            e.session.title ?? '',
            e.session.projectId ?? '',
            e.session.forkFrom ?? e.session.handoffFrom ?? ''
          ].join(DRAFT_ROW_SEP)
        )
        .reverse()
      if (isNewChatRowVisible(s)) {
        const cur = s.sessions[NEW_CHAT_KEY].session
        rows.unshift([NEW_CHAT_KEY, '', cur.pendingProjectId ?? '', ''].join(DRAFT_ROW_SEP))
      }
      return rows
    })
  )
  return useMemo(
    () =>
      encoded.map((row) => {
        const [key, title, projectId, parentSessionId] = row.split(DRAFT_ROW_SEP)
        return {
          key,
          title: title || null,
          projectId: projectId || null,
          parentSessionId: parentSessionId || null
        }
      }),
    [encoded]
  )
}

// 활성 엔트리가 draft 행(continuity draft 또는 전송 중 '새 대화' 슬롯)이면 그 키 — nav 활성
// 강조가 URL(부모 세션) 행이 아니라 draft 행에 붙도록 셸이 참조한다.
export function useActiveDraftKey(): string | null {
  return useChatStore((s) => {
    if (s.activeKey === NEW_CHAT_KEY) return isNewChatRowVisible(s) ? NEW_CHAT_KEY : null
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
