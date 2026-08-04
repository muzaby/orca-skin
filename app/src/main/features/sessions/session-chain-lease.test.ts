import { describe, expect, it, vi } from 'vitest'
import type { ManagedRuntime } from '../../contracts/ports'
import type { TurnContext } from '../../contracts/turn'
import { SessionChainLeaseRegistry, clientLeaseKey, sessionLeaseKey } from './session-chain-lease'

const runtime = (): ManagedRuntime =>
  ({
    reusable: true,
    state: 'live',
    close: vi.fn()
  }) as unknown as ManagedRuntime

const turn = (name: string): TurnContext<string> => ({ name }) as unknown as TurnContext<string>

describe('SessionChainLeaseRegistry', () => {
  it('논리 세션 키 CAS로 준비 중 중복 체인을 막고 provisional 키도 같은 규칙을 쓴다', () => {
    const registry = new SessionChainLeaseRegistry<string>()
    const first = registry.acquire({
      logicalKey: clientLeaseKey('draft-1'),
      sessionId: null,
      owner: 'window-a',
      requestedProviderKey: 'claude'
    })
    const duplicate = registry.acquire({
      logicalKey: clientLeaseKey('draft-1'),
      sessionId: null,
      owner: 'window-a',
      requestedProviderKey: 'claude'
    })

    expect(first.acquired).toBe(true)
    expect(first.lease.kind).toBe('preparing')
    expect(first.lease.admittedAt).toEqual(expect.any(Number))
    expect(duplicate).toEqual({ lease: first.lease, acquired: false })
    expect(registry.all()).toHaveLength(1)
  })

  it('provisional lease를 session key로 승격하고 같은 lease 안에서 child만 원자 교체한다', () => {
    const registry = new SessionChainLeaseRegistry<string>()
    const acquired = registry.acquire({
      logicalKey: clientLeaseKey('draft-1'),
      sessionId: null,
      owner: 'window-a',
      requestedProviderKey: null
    }).lease
    const firstTurn = turn('first')
    const nextTurn = turn('next')
    const live = runtime()

    expect(registry.promote(acquired.leaseId, 'session-1')).toBe(true)
    const active = registry.activate(acquired.leaseId, live, 'claude', firstTurn)
    expect(active?.logicalKey).toBe(sessionLeaseKey('session-1'))
    expect(registry.swapChild(acquired.leaseId, firstTurn, nextTurn)).toBe(true)
    expect(registry.getBySession('session-1')?.activeChild).toBe(nextTurn)
    expect(registry.getBySession('session-1')?.control).toBe(acquired.control)
  })

  it('closing은 런타임 참조를 보존해 종료 주체가 닫은 뒤 release하도록 한다', () => {
    const registry = new SessionChainLeaseRegistry<string>()
    const acquired = registry.acquire({
      logicalKey: sessionLeaseKey('s'),
      sessionId: 's',
      owner: 'window-a',
      requestedProviderKey: null
    }).lease
    const live = runtime()
    registry.activate(acquired.leaseId, live, 'claude', turn('active'))

    const closing = registry.beginClosing(acquired.leaseId, 'discard')
    expect(closing?.kind).toBe('closing')
    expect(closing?.runtime).toBe(live)
    expect(closing?.controller.signal.aborted).toBe(true)
    expect(
      registry.acquire({
        logicalKey: sessionLeaseKey('s'),
        sessionId: 's',
        owner: 'window-b',
        requestedProviderKey: null
      }).acquired
    ).toBe(false)

    registry.release(acquired.leaseId)
    expect(registry.getBySession('s')).toBeUndefined()
  })
})
