import type { ChatActivitySnapshot } from '../../../shared/ipc'
import { parseLeaseKey } from '../../../shared/lease-key'
import type { PendingMessageQueue, PendingQueueMutation } from './pending-message-queue'
import type { BackgroundTaskTracker } from './background-tasks'

type Foreground = ChatActivitySnapshot['foreground']

export interface ActivityLeaseSource {
  foreground(sessionId: string, transport: ChatActivitySnapshot['transport']): Foreground
  subscribe(listener: (logicalKey: string) => void): () => void
}

export interface SessionActivityProjectorDeps {
  queue: PendingMessageQueue
  backgroundTasks: BackgroundTaskTracker
  leases: ActivityLeaseSource
  emit(snapshot: ChatActivitySnapshot): void
}

export class SessionActivityProjector {
  private readonly snapshots = new Map<string, ChatActivitySnapshot>()
  private readonly revisions = new Map<string, number>()
  private readonly transport = new Map<string, ChatActivitySnapshot['transport']>()
  private readonly residualAttempts = new Map<string, Set<string>>()
  // client key가 session key로 승격된 뒤에도 supervisor가 이전 키의 수명 전이를 한 번 더 알릴
  // 수 있다. 별칭으로 흡수해 provisional snapshot/revision이 다시 생기지 않게 한다.
  private readonly aliases = new Map<string, string>()
  // 세션 삭제 뒤 지각 lease release/transport 종료가 빈 snapshot을 되살리지 못하게 한다.
  // session id는 재사용하지 않지만 promote는 방어적으로 tombstone을 해제한다.
  private readonly cleared = new Set<string>()
  private readonly pending = new Set<string>()
  private flushScheduled = false
  private disposed = false
  private readonly unsubscribe: Array<() => void>

  constructor(private readonly deps: SessionActivityProjectorDeps) {
    this.unsubscribe = [
      deps.queue.subscribe((mutation) => this.onQueueMutation(mutation)),
      deps.backgroundTasks.subscribe((sessionId) => this.recompute(sessionId)),
      deps.leases.subscribe((logicalKey) => {
        const activityKey = activityKeyFromLogicalKey(logicalKey)
        if (activityKey) this.recompute(activityKey)
      })
    ]
  }

  setTransport(sessionId: string, transport: ChatActivitySnapshot['transport']): void {
    sessionId = this.canonicalKey(sessionId)
    if ((this.transport.get(sessionId) ?? 'idle') === transport) return
    if (transport === 'idle') this.transport.delete(sessionId)
    else this.transport.set(sessionId, transport)
    this.recompute(sessionId)
  }

  setResidualAttempts(sessionId: string, attemptIds: readonly string[]): void {
    sessionId = this.canonicalKey(sessionId)
    if (attemptIds.length === 0) this.residualAttempts.delete(sessionId)
    else this.residualAttempts.set(sessionId, new Set(attemptIds))
    this.recompute(sessionId)
  }

  current(sessionId: string): ChatActivitySnapshot {
    const key = this.canonicalKey(sessionId)
    this.flushOne(key, false)
    return this.snapshots.get(key)!
  }

  promote(oldKey: string, sessionId: string): void {
    if (oldKey === sessionId) return
    const source = this.canonicalKey(oldKey)
    const target = this.canonicalKey(sessionId)
    if (source === target) return
    this.cleared.delete(target)
    this.aliases.set(oldKey, target)
    this.aliases.set(source, target)
    const previous = this.snapshots.get(source)
    const revision = Math.max(this.revisions.get(source) ?? 0, this.revisions.get(target) ?? 0)
    this.snapshots.delete(source)
    this.revisions.delete(source)
    this.pending.delete(source)
    this.revisions.set(target, revision)
    const transport = this.transport.get(source)
    if (transport) this.transport.set(target, transport)
    this.transport.delete(source)
    const residual = this.residualAttempts.get(source)
    if (residual) this.residualAttempts.set(target, residual)
    this.residualAttempts.delete(source)
    if (previous) this.recompute(target)
  }

  clear(sessionId: string): void {
    sessionId = this.canonicalKey(sessionId)
    this.cleared.add(sessionId)
    this.snapshots.delete(sessionId)
    this.revisions.delete(sessionId)
    this.transport.delete(sessionId)
    this.residualAttempts.delete(sessionId)
    this.pending.delete(sessionId)
    for (const [alias, target] of this.aliases) {
      if (alias === sessionId || target === sessionId) this.aliases.delete(alias)
    }
  }

  dispose(): void {
    this.disposed = true
    for (const unsubscribe of this.unsubscribe.splice(0)) unsubscribe()
    this.snapshots.clear()
    this.revisions.clear()
    this.transport.clear()
    this.residualAttempts.clear()
    this.aliases.clear()
    this.cleared.clear()
    this.pending.clear()
  }

  private onQueueMutation(mutation: PendingQueueMutation): void {
    if (mutation.kind === 'rekey') {
      this.promote(mutation.oldKey, mutation.newKey)
      return
    }
    this.recompute(mutation.sessionId)
  }

  private recompute(sessionId: string): void {
    if (this.disposed) return
    const key = this.canonicalKey(sessionId)
    if (this.cleared.has(key)) return
    this.pending.add(key)
    if (this.flushScheduled) return
    this.flushScheduled = true
    queueMicrotask(() => {
      if (this.disposed) return
      this.flushScheduled = false
      const sessions = [...this.pending]
      this.pending.clear()
      for (const key of sessions) this.flushOne(key, true)
    })
  }

  private canonicalKey(key: string): string {
    let current = key
    const seen = new Set<string>()
    while (this.aliases.has(current) && !seen.has(current)) {
      seen.add(current)
      current = this.aliases.get(current)!
    }
    return current
  }

  private flushOne(sessionId: string, emit: boolean): void {
    this.pending.delete(sessionId)
    const previous = this.snapshots.get(sessionId)
    const candidate = this.compute(
      sessionId,
      previous?.revision ?? this.revisions.get(sessionId) ?? 0
    )
    if (previous && sameActivity(previous, candidate)) return
    const revision = (this.revisions.get(sessionId) ?? 0) + 1
    const next = { ...candidate, revision }
    this.revisions.set(sessionId, revision)
    this.snapshots.set(sessionId, next)
    if (emit) this.deps.emit(next)
  }

  private compute(sessionId: string, revision: number): ChatActivitySnapshot {
    const transport = this.transport.get(sessionId) ?? 'idle'
    const foreground = this.deps.leases.foreground(sessionId, transport)
    const counts = this.deps.queue.counts(sessionId)
    const attempts = this.residualAttempts.get(sessionId) ?? new Set<string>()
    const residualCount = this.deps.queue.messageCountForAttempts(sessionId, attempts)
    if (attempts.size > 0 && residualCount === 0) this.residualAttempts.delete(sessionId)
    const backgroundTaskCount = this.deps.backgroundTasks.count(sessionId)
    return {
      type: 'chat.activity',
      sessionId,
      revision,
      foreground,
      transport,
      queuedCount: counts.queuedCount,
      deliveryPendingCount: counts.deliveryPendingCount,
      residualCount,
      backgroundTaskCount
    }
  }
}

function activityKeyFromLogicalKey(logicalKey: string): string | undefined {
  // 접두사를 손으로 떼지 않는다 — 키를 만드는 쪽(features/sessions)과 같은 코덱을 쓴다.
  return parseLeaseKey(logicalKey)?.id
}

function sameActivity(a: ChatActivitySnapshot, b: ChatActivitySnapshot): boolean {
  return (
    a.foreground === b.foreground &&
    a.transport === b.transport &&
    a.queuedCount === b.queuedCount &&
    a.deliveryPendingCount === b.deliveryPendingCount &&
    a.residualCount === b.residualCount &&
    a.backgroundTaskCount === b.backgroundTaskCount
  )
}
