import { describe, it, expect, vi } from 'vitest'
import { ApprovalBroker, type PendingApprovalState } from './broker'
import type { AskResult } from '../../../shared/ipc'

const SKIP: AskResult = { type: 'skipped' }

describe('ApprovalBroker', () => {
  it('register → resolve 로 보류 Promise 가 응답으로 해소된다', async () => {
    const broker = new ApprovalBroker<AskResult>()
    const p = broker.register('req-1', undefined, SKIP)
    expect(broker.size).toBe(1)
    broker.resolve('req-1', { type: 'answered', answers: { Q: 'A' } })
    await expect(p).resolves.toEqual({ type: 'answered', answers: { Q: 'A' } })
    expect(broker.size).toBe(0)
  })

  it('signal abort 시 abortValue 로 해소되고 정리된다', async () => {
    const broker = new ApprovalBroker<AskResult>()
    const ac = new AbortController()
    const p = broker.register('req-2', ac.signal, SKIP)
    ac.abort()
    await expect(p).resolves.toEqual(SKIP)
    expect(broker.size).toBe(0)
  })

  it('이미 abort 된 signal 이면 즉시 abortValue', async () => {
    const broker = new ApprovalBroker<AskResult>()
    const ac = new AbortController()
    ac.abort()
    const p = broker.register('req-3', ac.signal, SKIP)
    await expect(p).resolves.toEqual(SKIP)
    expect(broker.size).toBe(0)
  })

  it('미지의 requestId · 중복 resolve 는 무해', async () => {
    const broker = new ApprovalBroker<AskResult>()
    expect(() => broker.resolve('nope', SKIP)).not.toThrow()
    const p = broker.register('req-4', undefined, SKIP)
    broker.resolve('req-4', SKIP)
    expect(() => broker.resolve('req-4', { type: 'answered', answers: {} })).not.toThrow()
    await expect(p).resolves.toEqual(SKIP)
  })

  it('abort 후 register 한 다른 요청에는 영향 없다', async () => {
    const broker = new ApprovalBroker<AskResult>()
    const ac = new AbortController()
    broker.register('a', ac.signal, SKIP)
    const pB = broker.register('b', undefined, SKIP)
    ac.abort()
    expect(broker.size).toBe(1) // b 만 남음
    broker.resolve('b', { type: 'answered', answers: { Q: 'B' } })
    await expect(pB).resolves.toEqual({ type: 'answered', answers: { Q: 'B' } })
  })

  it('제네릭 타입 — PlanDecision 도 동일하게 동작', async () => {
    const broker = new ApprovalBroker<{ type: string }>()
    const p = broker.register('p1', undefined, { type: 'rejected' })
    broker.resolve('p1', { type: 'approved' })
    await expect(p).resolves.toEqual({ type: 'approved' })
  })

  it('timeoutMs 만료 시 timeoutValue 로 해소되고 정리된다', async () => {
    vi.useFakeTimers()
    try {
      const broker = new ApprovalBroker<AskResult>()
      const TIMED_OUT: AskResult = { type: 'skipped' }
      const p = broker.register('t-1', undefined, SKIP, {
        timeoutMs: 1000,
        timeoutValue: TIMED_OUT
      })
      expect(broker.size).toBe(1)
      vi.advanceTimersByTime(1000)
      await expect(p).resolves.toEqual(TIMED_OUT)
      expect(broker.size).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('timeoutValue 미지정 시 abortValue 를 재사용한다', async () => {
    vi.useFakeTimers()
    try {
      const broker = new ApprovalBroker<AskResult>()
      const p = broker.register('t-2', undefined, SKIP, { timeoutMs: 500 })
      vi.advanceTimersByTime(500)
      await expect(p).resolves.toEqual(SKIP)
    } finally {
      vi.useRealTimers()
    }
  })

  it('만료 전 resolve 하면 타이머가 정리되어 이후 만료 콜백이 발생하지 않는다', async () => {
    vi.useFakeTimers()
    try {
      const broker = new ApprovalBroker<AskResult>()
      const states: PendingApprovalState[] = []
      const p = broker.register('t-3', undefined, SKIP, {
        timeoutMs: 1000,
        onSettle: (s) => states.push(s)
      })
      broker.resolve('t-3', { type: 'answered', answers: { Q: 'A' } })
      await expect(p).resolves.toEqual({ type: 'answered', answers: { Q: 'A' } })
      // 타이머가 살아있다면 여기서 timed_out 이 추가될 것 — 정리됐으므로 변화 없음.
      vi.advanceTimersByTime(5000)
      expect(states).toEqual(['resolved'])
      expect(broker.size).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('만료 전 abort 하면 abortValue 로 해소되고 타이머가 정리된다', async () => {
    vi.useFakeTimers()
    try {
      const broker = new ApprovalBroker<AskResult>()
      const states: PendingApprovalState[] = []
      const ac = new AbortController()
      const p = broker.register('t-4', ac.signal, SKIP, {
        timeoutMs: 1000,
        onSettle: (s) => states.push(s)
      })
      ac.abort()
      await expect(p).resolves.toEqual(SKIP)
      vi.advanceTimersByTime(5000)
      expect(states).toEqual(['aborted'])
      expect(broker.size).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('onSettle 가 종료 상태(resolved)를 통지한다', async () => {
    const broker = new ApprovalBroker<AskResult>()
    const states: PendingApprovalState[] = []
    const p = broker.register('s-1', undefined, SKIP, { onSettle: (s) => states.push(s) })
    broker.resolve('s-1', { type: 'answered', answers: {} })
    await p
    expect(states).toEqual(['resolved'])
  })

  it('이미 abort 된 signal 이면 onSettle 가 aborted 로 통지된다', async () => {
    const broker = new ApprovalBroker<AskResult>()
    const states: PendingApprovalState[] = []
    const ac = new AbortController()
    ac.abort()
    const p = broker.register('s-2', ac.signal, SKIP, { onSettle: (s) => states.push(s) })
    await expect(p).resolves.toEqual(SKIP)
    expect(states).toEqual(['aborted'])
  })
})
