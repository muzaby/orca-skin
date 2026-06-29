// RuntimePool — Persistent(close-policy) SessionRuntime 핸들을 세션 키로 보관하고 IdleCloseTimer 로
// 회수하는 보관소(0051 §A 세로축 "Runtime Supervisor 가 SessionRuntime 집합 소유"의 저장 계층,
// handoff 0054). **정책-자유**: reusable(persistent) 핸들만 들어오고, OneShot 은 애초에 여기 닿지
// 않는다(Supervisor.releaseRuntime 이 즉시 close). idle 타이머 소유를 런타임이 아니라 풀(소유자)에
// 둔 이유 = 자원 회수 정책을 실행 핸들에 결합하지 않기 위함.
//
// 0055 seam: cap/LRU eviction(`size` 한도 초과 시 가장 오래된 idle 핸들부터 close)·ConcurrencyRegistry
// 소유 이관·true streaming-input(단일 long-lived live 재사용)은 모두 이 보관소 위에 얹는다.

import { createIdleCloseTimer, IDLE_CLOSE_TIMEOUT_MS, type IdleCloseTimer } from './timers'
import type { ManagedRuntime } from './ports'

export class RuntimePool<RT extends ManagedRuntime = ManagedRuntime> {
  private readonly idle = new Map<string, { runtime: RT; timer: IdleCloseTimer }>()

  constructor(private readonly idleTimeoutMs: number = IDLE_CLOSE_TIMEOUT_MS) {}

  // 재사용 가능한 idle 핸들 인출 — 있으면 타이머 정지 후 풀에서 꺼낸다(턴 동안은 풀 밖). 키가
  // 없거나(신규 세션 first turn = sessionId null) 보관 중 핸들이 이미 closed 면 정리 후 undefined.
  take(sessionId: string | null): RT | undefined {
    if (!sessionId) return undefined
    const entry = this.idle.get(sessionId)
    if (!entry) return undefined
    entry.timer.clear()
    this.idle.delete(sessionId)
    if (entry.runtime.state === 'closed') return undefined
    return entry.runtime
  }

  // 턴 종료 후 idle 보존 — IdleCloseTimer 무장(만료 시 runtime.close()+drop+onReap). sessionId 가
  // 없으면 보존 불가(false → 호출측이 close). 같은 키에 이전 핸들이 남아 있으면(레이스 방어) 정리.
  keepIdle(sessionId: string | null, runtime: RT, onReap: () => void = () => {}): boolean {
    if (!sessionId) return false
    const prev = this.idle.get(sessionId)
    if (prev) {
      prev.timer.clear()
      if (prev.runtime !== runtime) prev.runtime.close()
    }
    const timer = createIdleCloseTimer(() => {
      this.idle.delete(sessionId)
      runtime.close()
      onReap()
    }, this.idleTimeoutMs)
    this.idle.set(sessionId, { runtime, timer })
    timer.reset()
    return true
  }

  has(sessionId: string): boolean {
    return this.idle.has(sessionId)
  }

  get size(): number {
    return this.idle.size
  }

  // 앱 종료 정리 — 모든 idle 핸들 타이머 해제 + close.
  closeAll(): void {
    for (const { runtime, timer } of this.idle.values()) {
      timer.clear()
      runtime.close()
    }
    this.idle.clear()
  }
}
