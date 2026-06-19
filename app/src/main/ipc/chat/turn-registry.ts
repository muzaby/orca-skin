// 진행 중 턴 레지스트리 — 세션 키잉(멀티세션 토대).
//
// 구 모델은 Map<WebContents, InflightTurn>(창당 1턴)이라 서로 다른 세션의 동시 턴이 구조적으로
// 불가능했다. 이제 확정 세션 턴은 sessionId 로 키잉하고, 아직 sessionId 가 발급되지 않은
// 새-채팅 턴만 창(pending key)당 1개 슬롯에 보관한다 — claude 의 system/init(session.updated)
// 이 도착하면 promote() 로 sessionId 키로 승격된다.
//
// electron 비의존(순수 TS) — pending 키를 제네릭으로 두어 vitest 가 임의 객체로 검증한다.
// 실사용은 W = WebContents.

import type { LiveTurn, SessionAdapter } from '../../adapters/types'
import type { ResolvedProviderSettings } from '../../settings/provider-settings'

export interface InflightTurn {
  controller: AbortController
  // 이 턴의 라이브 핸들 (PR③). orca:permission:setMode 가 진행 중 턴이면 여기로 모드를 즉시
  // 전환한다(Query.setPermissionMode). sendMessage 직후 채워진다.
  live: LiveTurn | null
  titleAdapter: SessionAdapter
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
}

export class TurnRegistry<W = unknown> {
  private readonly bySession = new Map<string, InflightTurn>()
  private readonly pendingByOwner = new Map<W, InflightTurn>()

  getBySession(sessionId: string): InflightTurn | undefined {
    return this.bySession.get(sessionId)
  }

  hasSession(sessionId: string): boolean {
    return this.bySession.has(sessionId)
  }

  hasPending(owner: W): boolean {
    return this.pendingByOwner.has(owner)
  }

  // resume 턴 시작 — 같은 세션의 중복 턴은 호출 전 hasSession 으로 가드한다.
  startResume(sessionId: string, turn: InflightTurn): void {
    this.bySession.set(sessionId, turn)
  }

  // 새-채팅 턴 시작 — sessionId 발급 전까지 owner(창)당 1개 슬롯.
  startNew(owner: W, turn: InflightTurn): void {
    this.pendingByOwner.set(owner, turn)
  }

  // session.updated(sessionId 발급) 시점 — pending 턴을 sessionId 키로 승격.
  // resume 턴(이미 bySession 키)이거나 pending 이 없으면 무해한 no-op.
  promote(owner: W, sessionId: string): void {
    const turn = this.pendingByOwner.get(owner)
    if (!turn) return
    this.pendingByOwner.delete(owner)
    this.bySession.set(sessionId, turn)
  }

  // 턴 종료 — 어느 맵에 있든 값 동일성으로 제거(승격 전 실패한 pending 턴 포함).
  finish(turn: InflightTurn): void {
    for (const [k, v] of this.bySession) {
      if (v === turn) this.bySession.delete(k)
    }
    for (const [k, v] of this.pendingByOwner) {
      if (v === turn) this.pendingByOwner.delete(k)
    }
  }

  // 진단/테스트용 — 현재 진행 중 턴 수.
  get size(): number {
    return this.bySession.size + this.pendingByOwner.size
  }
}
