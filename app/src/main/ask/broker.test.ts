import { describe, it, expect } from 'vitest'
import { InteractionBroker } from './broker'
import type { AskResult } from '../../shared/ipc'

const SKIP: AskResult = { type: 'skipped' }

describe('InteractionBroker', () => {
  it('register → resolve 로 보류 Promise 가 응답으로 해소된다', async () => {
    const broker = new InteractionBroker<AskResult>()
    const p = broker.register('req-1', undefined, SKIP)
    expect(broker.size).toBe(1)
    broker.resolve('req-1', { type: 'answered', answers: { Q: 'A' } })
    await expect(p).resolves.toEqual({ type: 'answered', answers: { Q: 'A' } })
    expect(broker.size).toBe(0)
  })

  it('signal abort 시 abortValue 로 해소되고 정리된다', async () => {
    const broker = new InteractionBroker<AskResult>()
    const ac = new AbortController()
    const p = broker.register('req-2', ac.signal, SKIP)
    ac.abort()
    await expect(p).resolves.toEqual(SKIP)
    expect(broker.size).toBe(0)
  })

  it('이미 abort 된 signal 이면 즉시 abortValue', async () => {
    const broker = new InteractionBroker<AskResult>()
    const ac = new AbortController()
    ac.abort()
    const p = broker.register('req-3', ac.signal, SKIP)
    await expect(p).resolves.toEqual(SKIP)
    expect(broker.size).toBe(0)
  })

  it('미지의 requestId · 중복 resolve 는 무해', async () => {
    const broker = new InteractionBroker<AskResult>()
    expect(() => broker.resolve('nope', SKIP)).not.toThrow()
    const p = broker.register('req-4', undefined, SKIP)
    broker.resolve('req-4', SKIP)
    expect(() => broker.resolve('req-4', { type: 'answered', answers: {} })).not.toThrow()
    await expect(p).resolves.toEqual(SKIP)
  })

  it('abort 후 register 한 다른 요청에는 영향 없다', async () => {
    const broker = new InteractionBroker<AskResult>()
    const ac = new AbortController()
    broker.register('a', ac.signal, SKIP)
    const pB = broker.register('b', undefined, SKIP)
    ac.abort()
    expect(broker.size).toBe(1) // b 만 남음
    broker.resolve('b', { type: 'answered', answers: { Q: 'B' } })
    await expect(pB).resolves.toEqual({ type: 'answered', answers: { Q: 'B' } })
  })

  it('제네릭 타입 — PlanDecision 도 동일하게 동작', async () => {
    const broker = new InteractionBroker<{ type: string }>()
    const p = broker.register('p1', undefined, { type: 'rejected' })
    broker.resolve('p1', { type: 'approved' })
    await expect(p).resolves.toEqual({ type: 'approved' })
  })
})
