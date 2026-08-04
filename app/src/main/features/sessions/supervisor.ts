// RuntimeSupervisor — §A 세로축 unit #3 "Runtime Supervisor/Registry"의 1급 모듈(0051 §A,
// handoff 0053). SessionRuntime 집합의 소유자다: 턴 핸들의 등록·승격·조회(내부 키잉은
// SessionRuntimeRegistry 에 위임)와, 산재해 있던 teardown(finish)·abort 를 **단일 멱등 경로**로
// 통합한다.
//
// 0054(Persistent governance): Persistent close 정책 핸들의 **cross-turn 재사용 + idle 보존/회수**를
// 더한다(RuntimePool 합성). 핵심 분리 = **turn teardown(release) ≠ runtime close(releaseRuntime)**.
// 0067: 세션 수명 = 프로그램 종료 or LRU 축출만(IdleCloseTimer 폐기) — idle 핸들은 cap 초과 시
// LRU eviction 으로만 회수된다(기본 cap 5, bootstrap 주입).
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
import {
  SessionChainLeaseRegistry,
  type AcquireLeaseInput,
  type SessionChainLease
} from './session-chain-lease'

// 단일 abort 프리미티브 — 0054 에서 별도 모듈(./abort)로 분리(supervisor→runtime-pool→timers→
// supervisor 순환 회피). 기존 import 경로(./supervisor) 호환을 위한 무회귀 re-export.

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
  leases?: SessionChainLeaseRegistry<W>
}

export class RuntimeSupervisor<W = unknown> {
  // release 멱등 가드 — 같은 턴의 teardown 이 2회 이상 와도 1회만 효력.
  private readonly released = new WeakSet<TurnContext<W>>()
  private readonly registry: SessionRuntimeRegistry<W>
  private readonly pool: RuntimePool
  private readonly activeTurnTracker: ActiveTurnTracker
  private readonly capPolicy: RuntimeCapPolicy
  private readonly capacity: number | null
  private readonly leases: SessionChainLeaseRegistry<W>
  private readonly leaseListeners = new Set<(logicalKey: string) => void>()

  constructor(options: RuntimeSupervisorOptions<W> = {}) {
    this.registry = options.registry ?? new SessionRuntimeRegistry<W>()
    this.pool = options.pool ?? new RuntimePool()
    this.activeTurnTracker = options.activeTurns ?? new ActiveTurnTracker()
    this.capPolicy = options.capPolicy ?? new UnlimitedRuntimeCapPolicy()
    this.capacity = options.capacity ?? null
    this.leases = options.leases ?? new SessionChainLeaseRegistry<W>()
  }

  get activeTurns(): ActiveTurnTracker {
    return this.activeTurnTracker
  }

  // 진입(admission) — resume/새-채팅 턴을 레지스트리에 등록. active 초과 reject/queue 는 0056.
  startResume(sessionId: string, turn: TurnContext<W>): void {
    this.registry.startResume(sessionId, turn)
    const lease = this.leases.getBySession(sessionId)
    if (lease?.kind === 'active') {
      const previous = lease.activeChild
      this.leases.swapChild(lease.leaseId, previous, turn)
      this.emitLease(lease.logicalKey)
    }
  }

  startNew(owner: W, turn: TurnContext<W>): void {
    this.registry.startNew(owner, turn)
  }

  // 새-채팅 pending 턴을 session.updated 도착 시 sessionId 키로 승격(코디네이터가 호출).
  promote(turn: TurnContext<W>, sessionId: string): void {
    this.registry.promote(turn, sessionId)
    const lease = this.leases.all().find((candidate) => candidate.activeChild === turn)
    if (lease) this.promoteChain(lease.leaseId, sessionId)
  }

  getBySession(sessionId: string): TurnContext<W> | undefined {
    return this.leases.getBySession(sessionId)?.activeChild ?? this.registry.getBySession(sessionId)
  }

  hasSession(sessionId: string): boolean {
    return this.leases.getBySession(sessionId) !== undefined || this.registry.hasSession(sessionId)
  }

  hasPending(owner: W): boolean {
    return this.registry.hasPending(owner)
  }

  // 진행 중 모든 턴(세션 키 + pending owner) — 앱 종료 정리(router.shutdown) 순회용.
  all(): TurnContext<W>[] {
    const leased = this.leases
      .all()
      .flatMap((lease) => (lease.activeChild ? [lease.activeChild] : []))
    return [...new Set([...leased, ...this.registry.all()])]
  }

  allLeases(): SessionChainLease<W>[] {
    return this.leases.all()
  }

  acquireChain(input: AcquireLeaseInput<W>): { lease: SessionChainLease<W>; acquired: boolean } {
    const result = this.leases.acquire(input)
    if (result.acquired) this.emitLease(result.lease.logicalKey)
    return result
  }

  getChainByKey(logicalKey: string): SessionChainLease<W> | undefined {
    return this.leases.getByKey(logicalKey)
  }

  getChainBySession(sessionId: string): SessionChainLease<W> | undefined {
    return this.leases.getBySession(sessionId)
  }

  activateChain(
    leaseId: string,
    runtime: ManagedRuntime,
    providerKey: string | null,
    child: TurnContext<W>
  ): boolean {
    const lease = this.leases.activate(leaseId, runtime, providerKey, child)
    if (!lease) return false
    this.emitLease(lease.logicalKey)
    return true
  }

  promoteChain(leaseId: string, sessionId: string): boolean {
    const before = this.leases.getById(leaseId)?.logicalKey
    if (!this.leases.promote(leaseId, sessionId)) return false
    if (before) this.emitLease(before)
    this.emitLease(`session:${sessionId}`)
    return true
  }

  swapChainChild(
    leaseId: string,
    previous: TurnContext<W> | null,
    next: TurnContext<W> | null
  ): boolean {
    if (!this.leases.swapChild(leaseId, previous, next)) return false
    const lease = this.leases.getById(leaseId)
    if (lease) this.emitLease(lease.logicalKey)
    return true
  }

  closeChain(leaseId: string, reason: 'discard' | 'shutdown'): SessionChainLease<W> | undefined {
    const lease = this.leases.beginClosing(leaseId, reason)
    if (lease) this.emitLease(lease.logicalKey)
    return lease
  }

  cancelChain(sessionId: string): SessionChainLease<W> | undefined {
    const lease = this.leases.getBySession(sessionId)
    if (!lease) return undefined
    lease.control.cancelled = true
    lease.controller.abort()
    lease.activeChild?.controller.abort()
    this.emitLease(lease.logicalKey)
    return lease
  }

  releaseChain(leaseId: string): void {
    const key = this.leases.getById(leaseId)?.logicalKey
    if (!this.leases.release(leaseId)) return
    if (key) this.emitLease(key)
  }

  subscribeLeases(listener: (logicalKey: string) => void): () => void {
    this.leaseListeners.add(listener)
    return () => this.leaseListeners.delete(listener)
  }

  get size(): number {
    return Math.max(this.registry.size, this.leases.all().length)
  }

  getRuntimePopulation(): RuntimePopulation {
    const leaseChildren = new Set(
      this.leases.all().flatMap((lease) => (lease.activeChild ? [lease.activeChild] : []))
    )
    const leasedSessionIds = new Set(
      this.leases.all().flatMap((lease) => (lease.sessionId !== null ? [lease.sessionId] : []))
    )
    const leasedPendingOwners = new Set(
      this.leases.all().flatMap((lease) => (lease.sessionId === null ? [lease.owner] : []))
    )
    const active =
      this.leases.all().filter((lease) => lease.kind === 'active').length +
      this.registry
        .all()
        .filter(
          (turn) =>
            !leaseChildren.has(turn) &&
            !(turn.dbSessionId && leasedSessionIds.has(turn.dbSessionId)) &&
            !(!turn.dbSessionId && leasedPendingOwners.has(turn.owner))
        ).length
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
    const lease = this.leases.all().find((candidate) => candidate.activeChild === turn)
    if (lease?.kind === 'active') {
      this.leases.swapChild(lease.leaseId, turn, null)
      this.emitLease(lease.logicalKey)
    }
  }

  // 런타임 인출 — Persistent idle 핸들이 세션 키로 풀에 있으면 재사용(타이머 정지)하고, 없으면
  // factory()로 생성한다. factory 전 cap hook 은 idle eviction 만 수행하고 active 는 닫지 않는다.
  acquireRuntime<RT extends ManagedRuntime>(sessionId: string | null, factory: () => RT): RT {
    const reused = this.pool.take(sessionId) as RT | undefined
    if (reused) return reused
    this.enforceCap()
    return factory()
  }

  // 런타임 반납 — reusable 핸들의 idle 보존. 'live'(정상 종료)에 더해 'interrupting'(취소 직후 —
  // interrupt 잔여 드레인이 배경에서 terminal 로 live 복귀, 0067 AC3 "취소 후 같은 채널 재사용")도
  // 보존한다. 그 외(에러·OneShot·sessionId 미확정)는 즉시 close. turn teardown(release)과 분리.
  releaseRuntime(sessionId: string | null, runtime: ManagedRuntime): void {
    if (
      runtime.reusable &&
      (runtime.state === 'live' || runtime.state === 'interrupting') &&
      this.pool.keepIdle(sessionId, runtime)
    ) {
      this.enforceCap()
      return
    }
    runtime.close()
  }

  // 앱 종료 정리 — idle 보존 핸들 일괄 close(진행 턴 정리는 all()+abort 가 담당).
  closeIdleRuntimes(): void {
    this.pool.closeAll()
  }

  // 세션 런타임 폐기(0151 r2 — "세션 전체 중단"). 사용자가 명시적으로 고른 경우에만 호출된다:
  // 공개 SDK 에 provider 큐의 개별 메시지를 취소하는 표면이 없으므로, Stop 뒤에도 CLI 큐에
  // 살아남은 우리 예약을 없애는 유일한 수단이 서브프로세스 폐기다. **백그라운드 서브에이전트도
  // 함께 죽는다** — 그래서 자동화하지 않고 사용자 결정으로 남긴다.
  // 진행 중 턴의 런타임은 풀 밖(active)이라 여기서 잡히지 않는다 — 호출자가 abortTurn 을 먼저
  // 태워 idle 로 반납되게 하거나, 반납 실패 시 다음 send 가 콜드 스폰으로 자연 복구한다.
  discardRuntime(sessionId: string): boolean {
    const lease = this.leases.getBySession(sessionId)
    if (lease) {
      const closing = this.leases.beginClosing(lease.leaseId, 'discard')
      closing?.activeChild?.controller.abort()
      closing?.runtime?.close()
      this.emitLease(lease.logicalKey)
      return closing?.runtime !== undefined
    }
    return this.pool.close(sessionId)
  }

  closeAllLeaseRuntimes(): void {
    for (const lease of this.leases.all()) {
      const closing = this.leases.beginClosing(lease.leaseId, 'shutdown')
      closing?.activeChild?.controller.abort()
      closing?.runtime?.close()
      this.emitLease(lease.logicalKey)
    }
  }

  private emitLease(logicalKey: string): void {
    for (const listener of this.leaseListeners) listener(logicalKey)
  }

  private enforceCap(): void {
    const population = this.getRuntimePopulation()
    if (this.capPolicy.admit({ ...population, capacity: this.capacity }) !== 'evict-idle') return
    if (this.capacity === null) return
    const idleTargetCapacity = Math.max(0, this.capacity - population.active)
    this.pool.evictToCapacity(idleTargetCapacity)
  }
}
