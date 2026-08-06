import { describe, expect, it, vi } from 'vitest'
import { TransactionStore, runGuarded } from './transactions'
import type { AuthTarget } from '../../../shared/ipc'
import type { CancelReason } from './transactions'

const APP: AuthTarget = { kind: 'application', applicationId: 'orca' }
const WIKI: AuthTarget = { kind: 'connector', connectorId: 'wiki', connectionId: 'c1' }

describe('TransactionStore 동시성 (요구명세 §미비 보완 1)', () => {
  it('AC9 — 같은 (providerId, target) 재진입은 기존 것을 명시 취소하고 교체한다', () => {
    const cancelled: Array<{ id: string; reason: CancelReason }> = []
    const store = new TransactionStore(Date.now, (tx, reason) =>
      cancelled.push({ id: tx.id, reason })
    )

    const first = store.begin({ providerId: 'p', target: APP })
    const second = store.begin({ providerId: 'p', target: APP })

    // 조용한 덮어쓰기가 아니라 취소 통지가 난다 — OpenCode 의 "마지막 것만 남는" 동작 거부.
    expect(cancelled).toEqual([{ id: first.id, reason: 'superseded' }])
    expect(first.controller.signal.aborted).toBe(true)
    expect(store.get(first.id)).toBeUndefined()
    expect(store.get(second.id)).toBeDefined()
    expect(store.size()).toBe(1)
  })

  it('다른 target 이면 공존한다', () => {
    const store = new TransactionStore()
    store.begin({ providerId: 'p', target: APP })
    store.begin({ providerId: 'p', target: WIKI })
    expect(store.size()).toBe(2)
  })

  it('다른 provider 면 같은 target 이라도 공존한다', () => {
    const store = new TransactionStore()
    store.begin({ providerId: 'a', target: APP })
    store.begin({ providerId: 'b', target: APP })
    expect(store.size()).toBe(2)
  })

  it('타임아웃이 abort 로 수렴한다', () => {
    vi.useFakeTimers()
    try {
      const cancelled: CancelReason[] = []
      const store = new TransactionStore(Date.now, (_tx, reason) => cancelled.push(reason))
      const tx = store.begin({ providerId: 'p', target: APP, timeoutMs: 1000 })
      vi.advanceTimersByTime(1001)
      expect(cancelled).toEqual(['timeout'])
      expect(tx.controller.signal.aborted).toBe(true)
      expect(store.size()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('finish 는 취소 통지 없이 정리한다', () => {
    const cancelled: CancelReason[] = []
    const store = new TransactionStore(Date.now, (_tx, reason) => cancelled.push(reason))
    const tx = store.begin({ providerId: 'p', target: APP })
    store.finish(tx.id)
    expect(cancelled).toEqual([])
    expect(store.size()).toBe(0)
  })

  it('finish 후 타이머가 남아 뒤늦게 취소를 쏘지 않는다', () => {
    vi.useFakeTimers()
    try {
      const cancelled: CancelReason[] = []
      const store = new TransactionStore(Date.now, (_tx, reason) => cancelled.push(reason))
      const tx = store.begin({ providerId: 'p', target: APP, timeoutMs: 1000 })
      store.finish(tx.id)
      vi.advanceTimersByTime(5000)
      expect(cancelled).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('shutdown 은 모든 transaction 을 취소한다', () => {
    const cancelled: CancelReason[] = []
    const store = new TransactionStore(Date.now, (_tx, reason) => cancelled.push(reason))
    store.begin({ providerId: 'p', target: APP })
    store.begin({ providerId: 'p', target: WIKI })
    store.cancelAll('shutdown')
    expect(cancelled).toEqual(['shutdown', 'shutdown'])
    expect(store.size()).toBe(0)
  })

  it('findByTarget 으로 진행 중 transaction 을 찾는다', () => {
    const store = new TransactionStore()
    const tx = store.begin({ providerId: 'p', target: WIKI })
    expect(store.findByTarget('p', WIKI)?.id).toBe(tx.id)
    expect(store.findByTarget('p', APP)).toBeUndefined()
  })
})

describe('runGuarded', () => {
  it('정상 결과를 그대로 돌려준다', async () => {
    const signal = new AbortController().signal
    await expect(
      runGuarded(
        signal,
        async () => 'ok',
        () => 'fallback'
      )
    ).resolves.toBe('ok')
  })

  it('provider throw 를 격리해 fallback 으로 수렴시킨다', async () => {
    const signal = new AbortController().signal
    const result = await runGuarded(
      signal,
      async () => {
        throw new Error('provider 폭발')
      },
      () => 'fallback'
    )
    expect(result).toBe('fallback')
  })

  it('provider 가 signal 을 무시해도 abort 시점에 수렴한다', async () => {
    const controller = new AbortController()
    const promise = runGuarded(
      controller.signal,
      () => new Promise<string>(() => {}), // 영원히 안 끝나는 provider
      () => 'aborted'
    )
    controller.abort()
    await expect(promise).resolves.toBe('aborted')
  })

  it('이미 abort 된 signal 이면 즉시 수렴한다', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      runGuarded(
        controller.signal,
        async () => 'never',
        () => 'aborted'
      )
    ).resolves.toBe('aborted')
  })
})
