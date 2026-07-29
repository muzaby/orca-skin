// RuntimePool — Persistent(close-policy) SessionRuntime 핸들을 세션 키로 보관하는 저장소(0051 §A
// 세로축 "Runtime Supervisor 가 SessionRuntime 집합 소유"의 저장 계층, handoff 0054). **정책-자유**:
// reusable(persistent) 핸들만 들어오고, OneShot 은 애초에 여기 닿지 않는다(Supervisor.releaseRuntime
// 이 즉시 close).
//
// 0055: cap/LRU 정책은 EvictionPolicy 로 추출했다. 이 풀은 Map 삽입순을 idle LRU 의 SSOT 로
// 사용한다(앞 = 가장 오래전에 idle 진입, take 후 keepIdle 재진입 = recency refresh).
// 0067: IdleCloseTimer 폐기 — 세션 수명 = 프로그램 종료 or LRU 축출만(사용자 확정). idle 핸들은
// 시간 경과로 회수되지 않는다.

import type { ManagedRuntime } from '../../contracts/ports'
import { LruEvictionPolicy, type EvictionPolicy, type IdleRuntimeEntry } from './eviction-policy'

export class RuntimePool<RT extends ManagedRuntime = ManagedRuntime> {
  private readonly idle = new Map<string, RT>()

  constructor(private readonly evictionPolicy: EvictionPolicy<RT> = new LruEvictionPolicy<RT>()) {}

  // 재사용 가능한 idle 핸들 인출 — 있으면 풀에서 꺼낸다(턴 동안은 풀 밖). 키가 없거나
  // (신규 세션 first turn = sessionId null) 보관 중 핸들이 이미 closed 면 정리 후 undefined.
  take(sessionId: string | null): RT | undefined {
    if (!sessionId) return undefined
    const runtime = this.idle.get(sessionId)
    if (!runtime) return undefined
    this.idle.delete(sessionId)
    if (runtime.state === 'closed') return undefined
    return runtime
  }

  // 턴 종료 후 idle 보존 — sessionId 가 없으면 보존 불가(false → 호출측이 close). 같은 키에
  // 이전 핸들이 남아 있으면 정리. 회수는 LRU eviction(evictToCapacity)과 closeAll 뿐(0067).
  keepIdle(sessionId: string | null, runtime: RT): boolean {
    if (!sessionId) return false
    if (this.idle.has(sessionId)) this.closeEntry(sessionId)
    this.idle.set(sessionId, runtime)
    return true
  }

  // 지정 세션의 idle 핸들 폐기(0151 r2 — "세션 전체 중단"). LRU 축출과 달리 **사용자 의도**로
  // 서브프로세스를 죽여 CLI 입력 큐 잔여를 통째로 소멸시킨다. 없으면 false.
  close(sessionId: string): boolean {
    return this.closeEntry(sessionId)
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

  // 앱 종료 정리 — 모든 idle 핸들 close. closeEntry 가 Map 을 변경하므로 key snapshot.
  closeAll(): void {
    for (const sessionId of Array.from(this.idle.keys())) {
      this.closeEntry(sessionId)
    }
  }

  private snapshot(): IdleRuntimeEntry<RT>[] {
    return Array.from(this.idle.entries(), ([sessionId, runtime]) => ({ sessionId, runtime }))
  }

  // 모든 idle close 경로(prev 교체·closeAll·LRU eviction·사용자 의도 폐기 close)의 단일 멱등 helper.
  // Map 선제거 후 close 하므로 경합 시 두 번째 호출은 no-op.
  private closeEntry(sessionId: string): boolean {
    const runtime = this.idle.get(sessionId)
    if (!runtime) return false
    this.idle.delete(sessionId)
    runtime.close()
    return true
  }
}
