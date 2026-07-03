// RuntimeSupervisor — §A 세로축 unit #3 "Runtime Supervisor/Registry"의 1급 모듈(0051 §A,
// handoff 0053). SessionRuntime 집합의 소유자다: 턴 핸들의 등록·승격·조회(내부 키잉은
// SessionRuntimeRegistry 에 위임)와, 산재해 있던 teardown(finish)·abort 를 **단일 멱등 경로**로
// 통합한다.
//
// 0054(Persistent governance): Persistent close 정책 핸들의 **cross-turn 재사용 + idle 보존/회수**를
// 더한다(RuntimePool 합성). 핵심 분리 = **turn teardown(release) ≠ runtime close(releaseRuntime)**.
// OneShot 은 매 턴 fresh·즉시 close(동작 보존), Persistent 만 풀에 idle 로 살아남아 IdleCloseTimer 로
// 회수된다.
//
// 0055(Resource governance): cap count 대상은 SessionRuntime population(active registry + idle pool)이고,
// eviction victim 은 idle runtime only 다. active 턴 핸들을 닫아 cap 을 맞추지 않는다(reject/queue 는
// 0056 admission 소관). 프로젝트별 active turn 회계(런타임 cap count 와 별개)는 0061 에서 lifecycle 로
// 접혀 Supervisor 소유의 단일 진실원이 됐고, 0061 verify 에서 기능을 드러내는 이름 ActiveTurnTracker 로
// 정정했다(IPC/UX 경계 어휘 "concurrency"는 보존).

import type { TurnContext } from '../../contracts/turn'
import type { ManagedRuntime } from '../../contracts/ports'
import { SessionRuntimeRegistry } from './session-registry'
import { RuntimePool } from './runtime-pool'
import { UnlimitedRuntimeCapPolicy, type RuntimeCapPolicy } from './runtime-cap-policy'
import { ActiveTurnTracker } from './active-turn-tracker'

// 단일 abort 프리미티브 — 0054 에서 별도 모듈(./abort)로 분리(supervisor→runtime-pool→timers→
// supervisor 순환 회피). 기존 import 경로(./supervisor) 호환을 위한 무회귀 re-export.
export { abortTurn } from './abort'

export interface RuntimePopulation {
  active: number
  idle: number
  total: number
}

export interface RuntimeSupervisorOptions<W = unknown> {
  registry?: SessionRuntimeRegistry<W>
  pool?: RuntimePool
  activeTurns?: ActiveTurnTracker
  capPolicy?: RuntimeCapPolicy
  capacity?: number | null
}

export class RuntimeSupervisor<W = unknown> {
  // release 멱등 가드 — 같은 턴의 teardown 이 2회 이상 와도 1회만 효력.
  private readonly released = new WeakSet<TurnContext<W>>()
  private readonly registry: SessionRuntimeRegistry<W>
  private readonly pool: RuntimePool
  private readonly activeTurnTracker: ActiveTurnTracker
  private readonly capPolicy: RuntimeCapPolicy
  private readonly capacity: number | null

  constructor(options: RuntimeSupervisorOptions<W> = {}) {
    this.registry = options.registry ?? new SessionRuntimeRegistry<W>()
    this.pool = options.pool ?? new RuntimePool()
    this.activeTurnTracker = options.activeTurns ?? new ActiveTurnTracker()
    this.capPolicy = options.capPolicy ?? new UnlimitedRuntimeCapPolicy()
    this.capacity = options.capacity ?? null
  }

  get activeTurns(): ActiveTurnTracker {
    return this.activeTurnTracker
  }

  // 진입(admission) — resume/새-채팅 턴을 레지스트리에 등록. active 초과 reject/queue 는 0056.
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

  getRuntimePopulation(): RuntimePopulation {
    const active = this.registry.size
    const idle = this.pool.size
    return { active, idle, total: active + idle }
  }

  // 단일 멱등 teardown — 턴 핸들을 레지스트리에서 제거한다. 2회 이상 호출돼도 1회만 효력.
  // **runtime 의 수명은 건드리지 않는다**(releaseRuntime 이 close 정책으로 별도 판정) — turn 은
  // 매 턴 새로 생성되는 일시 핸들이고, Persistent runtime 은 턴을 넘어 살아남기 때문.
  release(turn: TurnContext<W>): void {
    if (this.released.has(turn)) return
    this.released.add(turn)
    this.registry.finish(turn)
  }

  // 런타임 인출 — Persistent idle 핸들이 세션 키로 풀에 있으면 재사용(타이머 정지)하고, 없으면
  // factory()로 생성한다. factory 전 cap hook 은 idle eviction 만 수행하고 active 는 닫지 않는다.
  acquireRuntime<RT extends ManagedRuntime>(sessionId: string | null, factory: () => RT): RT {
    const reused = this.pool.take(sessionId) as RT | undefined
    if (reused) return reused
    this.enforceCap()
    return factory()
  }

  // 런타임 반납 — 정상 종료(state==='live')한 reusable 핸들만 idle 보존(IdleCloseTimer 무장).
  // 그 외(에러·중단·OneShot·sessionId 미확정)는 즉시 close. turn teardown(release)과 분리된 경로.
  releaseRuntime(sessionId: string | null, runtime: ManagedRuntime): void {
    if (runtime.reusable && runtime.state === 'live' && this.pool.keepIdle(sessionId, runtime)) {
      this.enforceCap()
      return
    }
    runtime.close()
  }

  // 앱 종료 정리 — idle 보존 핸들 일괄 close(진행 턴 정리는 all()+abort 가 담당).
  closeIdleRuntimes(): void {
    this.pool.closeAll()
  }

  private enforceCap(): void {
    const population = this.getRuntimePopulation()
    if (this.capPolicy.admit({ ...population, capacity: this.capacity }) !== 'evict-idle') return
    if (this.capacity === null) return
    const idleTargetCapacity = Math.max(0, this.capacity - population.active)
    this.pool.evictToCapacity(idleTargetCapacity)
  }
}
