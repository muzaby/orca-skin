// 진행 중 턴 레지스트리 — 세션 키잉(멀티세션 토대).
//
// 구 모델은 Map<WebContents, InflightTurn>(창당 1턴)이라 서로 다른 세션의 동시 턴이 구조적으로
// 불가능했다. 이제 확정 세션 턴은 sessionId 로 키잉하고, 아직 sessionId 가 발급되지 않은
// 새-채팅 턴만 창(pending key)당 1개 슬롯에 보관한다 — claude 의 system/init(session.updated)
// 이 도착하면 promote() 로 sessionId 키로 승격된다.
//
// electron 비의존(순수 TS) — pending 키를 제네릭으로 두어 vitest 가 임의 객체로 검증한다.
// 실사용은 W = WebContents.

import type { AttachmentView, Backend } from '../../shared/ipc'
import type { SessionRuntime } from './session-runtime'
import type { AbortCause } from './session-state'
import type { ResolvedProviderSettings } from '../settings/provider-settings'

export interface TitleCompletionPort {
  readonly id: Backend
  complete(req: {
    prompt: string
    model?: string
    cwd?: string
    signal?: AbortSignal
    providerSettings?: ResolvedProviderSettings
    env?: Record<string, string>
  }): Promise<string>
}

export interface InflightTurn<W = unknown> {
  controller: AbortController
  owner: W
  abortCause: AbortCause | null
  readonly cancelled: boolean
  readonly timedOut: boolean
  abort(cause: AbortCause): void
  // 이 턴의 라이브 핸들 (PR③). orca:permission:setMode 가 진행 중 턴이면 여기로 모드를 즉시
  // 전환한다(Query.setPermissionMode). sendMessage 직후 채워진다.
  live: SessionRuntime | null
  titleAdapter: TitleCompletionPort
  // 제목 생성 complete 가 본 턴과 같은 provider settings/env 를 쓰도록 보관 (handoff 0014).
  titleSettings?: ResolvedProviderSettings
  titleEnv?: Record<string, string>
  // 제목 생성용 사전 결정 모델(저가 모델 보유 시 haiku, 없으면 default). 미지정이면 SDK 기본.
  titleModel?: string
  providerKey: string | null
  // sendMessage 호출 시점에 채워두는 사용자 입력. claude 의 init 이벤트가
  // session_id 를 발급한 시점에 DB 에 user message row 로 저장한다.
  pendingUserText: string | null
  firstUserText: string
  // user 메시지에 함께 영속할 첨부 뷰(트랜스크립트 썸네일). pendingUserText 와 같은 시점에
  // attachment 파트로 저장된다(new-chat 은 init, resume 은 즉시).
  pendingAttachmentViews: AttachmentView[]
  // init 이벤트로 확정된 DB sessionId. resume 의 경우 sendMessage 인자와 같다.
  dbSessionId: string | null
  // 새 채팅 첫 메시지일 때 renderer 가 전달한 projectId. init 이벤트의 insertSession
  // 시점에 함께 row 에 박혀 별도 UPDATE 없이 binding 이 끝난다. resume 경로면 항상 null.
  pendingProjectId: string | null
  isNewSession: boolean
  cwd: string
  titleGenerationStarted: boolean
  // 현재 assistant turn 의 message row id. 한 턴의 모든 파트(reasoning/text/tool_*/error)를
  // 같은 메시지에 순서대로 누적하고, 턴 종료(telemetry) 시 reset 한다.
  currentAssistantMessageId: number | null
  // 현재 assistant 메시지의 text 파트 누적본 — messages.content(FTS5 캐시) 동기화용.
  // currentAssistantMessageId 갱신 시 함께 ''로 리셋.
  assistantText: string
  // AskUserQuestion 답변 영속. SDK 는 canUseTool 의 answers 를 메시지 스트림으로 되돌리지
  // 않으므로(answers 담은 tool_result 미발행), router 가 answer 와 tool_use id 가 모두
  // 확보되는 시점에 tool_result 를 합성한다(flushAskAnswers). 2-큐로 도착 순서 무관.
  pendingAskAnswers: Array<{ answers: Record<string, string | string[]>; response?: string }>
  // 답을 아직 못 받은 AskUserQuestion tool_use id 들(FIFO).
  askPendingIds: string[]
  // 합성 완료된 id → answers. 실제 tool_result 가 뒤늦게 와도 clobber 하지 않도록 재주입용.
  askResolved: Map<string, { answers: Record<string, string | string[]>; response?: string }>
  // 서브에이전트(Task) 단위 중단용 — Agent tool_use id → SDK task_id. subagent.task 이벤트가
  // 흐를 때 채워지고, orca:chat:stopSubagent 가 toolUseId 로 task_id 를 찾아 stopTask 호출한다.
  subagentTaskIds: Map<string, string>
  // tool.call.started ~ completed 사이의 열린 도구 실행(toolRunId → 부모 Task 표식). 중단/타임아웃/
  // 에러로 턴이 끊기면 합성 tool_result 로 정착시켜 "실행 중" 무한 렌더를 막는다(send.ts settleOpenToolRuns).
  openToolRuns: Map<string, { parentToolRunId?: string }>
  // 부모 Task toolUseId → subagent_type(예: 'Explore'). subagent.task 이벤트에서 채워지고,
  // stopSubagent 가 재호출 차단(blockedSubagents)에 쓸 타입을 찾는다.
  subagentTypes: Map<string, string>
  // 재호출 차단된 서브에이전트 타입 집합(가이드 §6-A). 사용자가 stop 한 타입을 담아 canUseTool 이 deny.
  blockedSubagents: Set<string>
  // 사용자가 명시 중단한 부모 Agent/Task toolUseId. 이후 늦은 completed notification 이 와도
  // 사용자 의도를 우선해 루트/전용 transcript 를 aborted 로 유지한다.
  stoppedSubagents: Set<string>
}

export type InflightTurnInit<W = unknown> = Omit<
  InflightTurn<W>,
  'abortCause' | 'cancelled' | 'timedOut' | 'abort'
>

export function createInflightTurn<W = unknown>(init: InflightTurnInit<W>): InflightTurn<W> {
  const turn = {
    ...init,
    abortCause: null as AbortCause | null,
    abort(cause: AbortCause): void {
      this.abortCause = cause
      this.controller.abort()
      void this.live?.interrupt(cause).catch(() => undefined)
    },
    get cancelled(): boolean {
      return this.abortCause === 'user_cancelled' || this.abortCause === 'retry'
    },
    get timedOut(): boolean {
      return this.abortCause === 'stall'
    }
  }
  return turn
}

export class SessionRuntimeRegistry<W = unknown> {
  private readonly bySession = new Map<string, InflightTurn<W>>()
  private readonly pendingByOwner = new Map<W, InflightTurn<W>>()

  getBySession(sessionId: string): InflightTurn<W> | undefined {
    return this.bySession.get(sessionId)
  }

  hasSession(sessionId: string): boolean {
    return this.bySession.has(sessionId)
  }

  hasPending(owner: W): boolean {
    return this.pendingByOwner.has(owner)
  }

  // resume 턴 시작 — 같은 세션의 중복 턴은 호출 전 hasSession 으로 가드한다.
  startResume(sessionId: string, turn: InflightTurn<W>): void {
    this.bySession.set(sessionId, turn)
  }

  // 새-채팅 턴 시작 — sessionId 발급 전까지 owner(창)당 1개 슬롯.
  startNew(owner: W, turn: InflightTurn<W>): void {
    this.pendingByOwner.set(owner, turn)
  }

  // session.updated(sessionId 발급) 시점 — pending 턴을 sessionId 키로 승격.
  // 호출한 턴과 owner 의 pending 슬롯이 같은 객체일 때만 승격한다. resume 턴도
  // session.updated 를 방출할 수 있으므로 owner 만으로 promote 하면 같은 창의 새-채팅
  // pending 턴을 resume sessionId 로 오승격할 수 있다(handoff 0040).
  promote(turn: InflightTurn<W>, sessionId: string): void {
    if (this.pendingByOwner.get(turn.owner) !== turn) return
    this.pendingByOwner.delete(turn.owner)
    this.bySession.set(sessionId, turn)
  }

  // 턴 종료 — 어느 맵에 있든 값 동일성으로 제거(승격 전 실패한 pending 턴 포함).
  finish(turn: InflightTurn<W>): void {
    for (const [k, v] of this.bySession) {
      if (v === turn) this.bySession.delete(k)
    }
    for (const [k, v] of this.pendingByOwner) {
      if (v === turn) this.pendingByOwner.delete(k)
    }
  }

  // P0 에서는 cap 정책을 적용하지 않지만, P1 핸들 cap+LRU 구현이 붙을 축출 훅을 예약한다.
  evictIdle(limit = 0): InflightTurn<W>[] {
    void limit
    return []
  }

  // 진행 중 모든 턴(세션 키 + pending owner 양쪽). 앱 종료 정리(IpcRouter.shutdown)가
  // 순회해 열린 도구를 정착하고 controller 를 abort 한다. 같은 객체가 양쪽에 동시 존재하진 않음
  // (promote 가 pending→session 으로 이동) — 중복 없음.
  all(): InflightTurn<W>[] {
    return [...this.bySession.values(), ...this.pendingByOwner.values()]
  }

  // 진단/테스트용 — 현재 진행 중 턴 수.
  get size(): number {
    return this.bySession.size + this.pendingByOwner.size
  }
}

export { SessionRuntimeRegistry as TurnRegistry }
