import { randomUUID } from 'node:crypto'
import type { ManagedRuntime } from '../../contracts/ports'
import type { TurnContext } from '../../contracts/turn'
// 논리 키 형식의 정본은 shared 다 — 읽는 쪽(features/chat)이 같은 코덱을 쓴다.
import { clientLeaseKey, sessionLeaseKey } from '../../../shared/lease-key'

export { clientLeaseKey, sessionLeaseKey }

export interface SessionControl {
  taskIds: Map<string, string>
  subagentTypes: Map<string, string>
  stoppedSubagents: Set<string>
  blockedSubagents: Set<string>
  cancelled: boolean
}

interface LeaseBase<W> {
  leaseId: string
  chainId: string
  // 최초 요청이 논리 체인을 선점한 시각. 준비 await 중 합류한 입력이 같은 millisecond에
  // 생성돼도 leader보다 앞서지 않도록 queue 정렬의 하한으로 쓴다.
  admittedAt: number
  logicalKey: string
  sessionId: string | null
  owner: W
  controller: AbortController
  control: SessionControl
  requestedProviderKey: string | null
}

export type SessionChainLease<W> =
  | (LeaseBase<W> & { kind: 'preparing'; activeChild: null; runtime?: undefined })
  | (LeaseBase<W> & {
      kind: 'active'
      activeChild: TurnContext<W> | null
      runtime: ManagedRuntime
      providerKey: string | null
    })
  | (LeaseBase<W> & {
      kind: 'closing'
      activeChild: TurnContext<W> | null
      runtime?: ManagedRuntime
      providerKey?: string | null
      reason: 'discard' | 'shutdown'
    })

export interface AcquireLeaseInput<W> {
  logicalKey: string
  sessionId: string | null
  owner: W
  requestedProviderKey: string | null
}

export class SessionChainLeaseRegistry<W> {
  private readonly byKey = new Map<string, SessionChainLease<W>>()
  private readonly byId = new Map<string, SessionChainLease<W>>()

  acquire(input: AcquireLeaseInput<W>): { lease: SessionChainLease<W>; acquired: boolean } {
    const existing = this.byKey.get(input.logicalKey)
    if (existing) return { lease: existing, acquired: false }
    const lease: SessionChainLease<W> = {
      kind: 'preparing',
      leaseId: randomUUID(),
      chainId: randomUUID(),
      admittedAt: Date.now(),
      logicalKey: input.logicalKey,
      sessionId: input.sessionId,
      owner: input.owner,
      controller: new AbortController(),
      requestedProviderKey: input.requestedProviderKey,
      activeChild: null,
      control: {
        taskIds: new Map(),
        subagentTypes: new Map(),
        stoppedSubagents: new Set(),
        blockedSubagents: new Set(),
        cancelled: false
      }
    }
    this.byKey.set(input.logicalKey, lease)
    this.byId.set(lease.leaseId, lease)
    return { lease, acquired: true }
  }

  getByKey(key: string): SessionChainLease<W> | undefined {
    return this.byKey.get(key)
  }

  getBySession(sessionId: string): SessionChainLease<W> | undefined {
    return this.byKey.get(sessionLeaseKey(sessionId))
  }

  getById(leaseId: string): SessionChainLease<W> | undefined {
    return this.byId.get(leaseId)
  }

  promote(leaseId: string, sessionId: string): boolean {
    const lease = this.byId.get(leaseId)
    if (!lease || lease.kind === 'closing') return false
    const nextKey = sessionLeaseKey(sessionId)
    const occupied = this.byKey.get(nextKey)
    if (occupied && occupied.leaseId !== leaseId) return false
    this.byKey.delete(lease.logicalKey)
    lease.logicalKey = nextKey
    lease.sessionId = sessionId
    this.byKey.set(nextKey, lease)
    return true
  }

  activate(
    leaseId: string,
    runtime: ManagedRuntime,
    providerKey: string | null,
    activeChild: TurnContext<W>
  ): SessionChainLease<W> | undefined {
    const current = this.byId.get(leaseId)
    if (!current || current.kind !== 'preparing' || current.controller.signal.aborted)
      return undefined
    const active: SessionChainLease<W> = {
      ...current,
      kind: 'active',
      runtime,
      providerKey,
      activeChild
    }
    this.replace(current, active)
    return active
  }

  swapChild(
    leaseId: string,
    previous: TurnContext<W> | null,
    next: TurnContext<W> | null
  ): boolean {
    const lease = this.byId.get(leaseId)
    if (!lease || lease.kind !== 'active' || lease.activeChild !== previous) return false
    lease.activeChild = next
    return true
  }

  beginClosing(leaseId: string, reason: 'discard' | 'shutdown'): SessionChainLease<W> | undefined {
    const current = this.byId.get(leaseId)
    if (!current) return undefined
    current.controller.abort()
    current.control.cancelled = true
    const closing: SessionChainLease<W> = {
      ...current,
      kind: 'closing',
      reason,
      activeChild: current.activeChild,
      ...(current.kind === 'active'
        ? { runtime: current.runtime, providerKey: current.providerKey }
        : {})
    }
    this.replace(current, closing)
    return closing
  }

  release(leaseId: string): SessionChainLease<W> | undefined {
    const lease = this.byId.get(leaseId)
    if (!lease) return undefined
    this.byId.delete(leaseId)
    if (this.byKey.get(lease.logicalKey)?.leaseId === leaseId) this.byKey.delete(lease.logicalKey)
    lease.control.taskIds.clear()
    lease.control.subagentTypes.clear()
    lease.control.stoppedSubagents.clear()
    lease.control.blockedSubagents.clear()
    return lease
  }

  all(): SessionChainLease<W>[] {
    return [...this.byId.values()]
  }

  private replace(previous: SessionChainLease<W>, next: SessionChainLease<W>): void {
    this.byId.set(next.leaseId, next)
    if (this.byKey.get(previous.logicalKey)?.leaseId === previous.leaseId) {
      this.byKey.set(next.logicalKey, next)
    }
  }
}
