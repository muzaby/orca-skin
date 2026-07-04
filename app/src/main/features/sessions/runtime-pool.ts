// RuntimePool — Persistent(close-policy) SessionRuntime 핸들을 세션 키로 보관하고 IdleCloseTimer 로
// 회수하는 보관소(0051 §A 세로축 "Runtime Supervisor 가 SessionRuntime 집합 소유"의 저장 계층,
// handoff 0054). **정책-자유**: reusable(persistent) 핸들만 들어오고, OneShot 은 애초에 여기 닿지
// 않는다(Supervisor.releaseRuntime 이 즉시 close). idle 타이머 소유를 런타임이 아니라 풀(소유자)에
// 둔 이유 = 자원 회수 정책을 실행 핸들에 결합하지 않기 위함.
//
// 0055: cap/LRU 정책은 EvictionPolicy 로 추출했다. 이 풀은 Map 삽입순을 idle LRU 의 SSOT 로
// 사용한다(앞 = 가장 오래전에 idle 진입, take 후 keepIdle 재진입 = recency refresh).

import {
  createIdleCloseTimer,
  IDLE_CLOSE_TIMEOUT_MS,
  type IdleCloseTimer
} from './idle-close-timer'
import type { ManagedRuntime } from '../../contracts/ports'
import { LruEvictionPolicy, type EvictionPolicy, type IdleRuntimeEntry } from './eviction-policy'

interface RuntimePoolEntry<RT extends ManagedRuntime> {
  runtime: RT
  timer: IdleCloseTimer
  onReap: () => void
}

export class RuntimePool<RT extends ManagedRuntime = ManagedRuntime> {
  private readonly idle = new Map<string, RuntimePoolEntry<RT>>()

  constructor(
    private readonly idleTimeoutMs: number = IDLE_CLOSE_TIMEOUT_MS,
    private readonly evictionPolicy: EvictionPolicy<RT> = new LruEvictionPolicy<RT>()
  ) {}

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

  // 턴 종료 후 idle 보존 — IdleCloseTimer 무장(만료 시 단일 closeEntry 로 runtime.close()+drop+onReap).
  // sessionId 가 없으면 보존 불가(false → 호출측이 close). 같은 키에 이전 핸들이 남아 있으면 정리.
  keepIdle(sessionId: string | null, runtime: RT, onReap: () => void = () => {}): boolean {
    if (!sessionId) return false
    if (this.idle.has(sessionId)) this.closeEntry(sessionId)
    const timer = createIdleCloseTimer(() => {
      this.closeEntry(sessionId)
    }, this.idleTimeoutMs)
    this.idle.set(sessionId, { runtime, timer, onReap })
    timer.reset()
    return true
  }

  has(sessionId: string): boolean {
    return this.idle.has(sessionId)
  }

  get size(): number {
    return this.idle.size
  }

  // policy 는 Map 을 직접 보지 않는다. RuntimePool 이 삽입순 snapshot 을 만들고 victim key 만 받는다.
  evictToCapacity(capacity: number): number {
    const victims = this.evictionPolicy.selectVictims(this.snapshot(), capacity)
    let evicted = 0
    for (const sessionId of victims) {
      if (this.closeEntry(sessionId)) evicted += 1
    }
    return evicted
  }

  // 앱 종료 정리 — 모든 idle 핸들 타이머 해제 + close. closeEntry 가 Map 을 변경하므로 key snapshot.
  closeAll(): void {
    for (const sessionId of Array.from(this.idle.keys())) {
      this.closeEntry(sessionId)
    }
  }

  private snapshot(): IdleRuntimeEntry<RT>[] {
    return Array.from(this.idle.entries(), ([sessionId, { runtime }]) => ({ sessionId, runtime }))
  }

  // 모든 idle close 경로(prev 교체·timer self-reap·closeAll·LRU eviction)의 단일 멱등 helper.
  // Map 선제거 후 close 하므로 timer 와 eviction 이 거의 동시에 들어와도 두 번째 호출은 no-op.
  private closeEntry(sessionId: string): boolean {
    const entry = this.idle.get(sessionId)
    if (!entry) return false
    entry.timer.clear()
    this.idle.delete(sessionId)
    entry.runtime.close()
    entry.onReap()
    return true
  }
}
