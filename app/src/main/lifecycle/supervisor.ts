// RuntimeSupervisor — §A 세로축 unit #3 "Runtime Supervisor/Registry"의 1급 모듈(0051 §A,
// handoff 0053). SessionRuntime 집합의 소유자다: 턴 핸들의 등록·승격·조회(내부 키잉은
// SessionRuntimeRegistry 에 위임)와, 산재해 있던 teardown(finish)·abort 를 **단일 멱등 경로**로
// 통합한다. 0053 척추 증분은 동작 보존(behavior-preserving) — 정책(cap/LRU/idle-close) 은 더하지
// 않는다.
//
// 0054(Persistent governance) seam — 아래 항목이 모두 이 소유자에 붙는다. 그래서 teardown 을
// 지금 단일 멱등 경로(release)로 세워 둔다:
//   · cap admission — startResume/startNew 진입에서 한도 초과 시 reject/queue.
//   · idle/LRU eviction — 내부 registry.evictIdle() 구동(현재 예약 no-op).
//   · IdleCloseTimer 해제 + self-idle close vs LRU eviction 의 release 합류.
//   · ConcurrencyRegistry 소유 이관(현재는 컴포지션 루트가 코디네이터에 직접 주입).

import type { TurnContext } from './turn-context'
import type { AbortCause } from './session-state'
import { SessionRuntimeRegistry } from './session-registry'

// 단일 abort 프리미티브 — 진행 턴을 멈춘다: 라이브 핸들에 중단 원인을 표시(markAborted)하고
// AbortController 를 끊어 SDK 스트림/서브프로세스를 종료시킨다. 0052 까지 chatCancel 핸들러
// (ipc/chat/send.ts)와 stall 타임아웃(lifecycle/timers.ts)에 동일 코드로 중복돼 있던 것을 한 곳으로
// 모은다. live 가 아직 없으면(턴 시작 전) markAborted 는 no-op 이고 controller.abort 만 효력.
export function abortTurn(
  turn: Pick<TurnContext, 'live' | 'controller'>,
  cause: Exclude<AbortCause, null>
): void {
  turn.live?.markAborted?.(cause)
  turn.controller.abort()
}

export class RuntimeSupervisor<W = unknown> {
  // release 멱등 가드 — 같은 턴의 teardown 이 2회 이상 와도 1회만 효력. 0054 에서 self-idle close
  // 와 LRU eviction 이 같은 턴에 합류할 때 이중 정리를 막는 단일 지점.
  private readonly released = new WeakSet<TurnContext<W>>()

  constructor(
    private readonly registry: SessionRuntimeRegistry<W> = new SessionRuntimeRegistry<W>()
  ) {}

  // 진입(admission) — resume/새-채팅 턴을 레지스트리에 등록. 0054 cap seam: 한도 초과 시 여기서
  // reject/queue 한다(현재는 무제한 pass-through).
  startResume(sessionId: string, turn: TurnContext<W>): void {
    this.registry.startResume(sessionId, turn)
  }

  startNew(owner: W, turn: TurnContext<W>): void {
    this.registry.startNew(owner, turn)
  }

  // 새-채팅 pending 턴을 session.updated 도착 시 sessionId 키로 승격(코디네이터가 호출).
  promote(turn: TurnContext<W>, sessionId: string): void {
    this.registry.promote(turn, sessionId)
  }

  getBySession(sessionId: string): TurnContext<W> | undefined {
    return this.registry.getBySession(sessionId)
  }

  hasSession(sessionId: string): boolean {
    return this.registry.hasSession(sessionId)
  }

  hasPending(owner: W): boolean {
    return this.registry.hasPending(owner)
  }

  // 진행 중 모든 턴(세션 키 + pending owner) — 앱 종료 정리(router.shutdown) 순회용.
  all(): TurnContext<W>[] {
    return this.registry.all()
  }

  get size(): number {
    return this.registry.size
  }

  // 단일 멱등 teardown — 턴 핸들을 레지스트리에서 제거한다. 2회 이상 호출돼도 1회만 효력.
  // 현재 동작 = registry.finish(turn) 와 동일(턴 종료 finally 의 유일 호출자). 0054: runtime.close()
  // 와 IdleCloseTimer 해제, self-idle close vs LRU eviction 합류가 모두 이 경로로 모인다.
  release(turn: TurnContext<W>): void {
    if (this.released.has(turn)) return
    this.released.add(turn)
    this.registry.finish(turn)
  }
}
