import { describe, it, expect } from 'vitest'
import { AskUserQuestionBroker } from './broker'

describe('AskUserQuestionBroker', () => {
  it('register → resolve 로 보류 Promise 가 응답으로 해소된다', async () => {
    const broker = new AskUserQuestionBroker()
    const p = broker.register('req-1')
    expect(broker.size).toBe(1)
    broker.resolve('req-1', { type: 'answered', answers: { Q: 'A' } })
    await expect(p).resolves.toEqual({ type: 'answered', answers: { Q: 'A' } })
    expect(broker.size).toBe(0)
  })

  it('signal abort 시 skipped 로 해소되고 정리된다', async () => {
    const broker = new AskUserQuestionBroker()
    const ac = new AbortController()
    const p = broker.register('req-2', ac.signal)
    ac.abort()
    await expect(p).resolves.toEqual({ type: 'skipped' })
    expect(broker.size).toBe(0)
  })

  it('이미 abort 된 signal 이면 즉시 skip', async () => {
    const broker = new AskUserQuestionBroker()
    const ac = new AbortController()
    ac.abort()
    const p = broker.register('req-3', ac.signal)
    await expect(p).resolves.toEqual({ type: 'skipped' })
    expect(broker.size).toBe(0)
  })

  it('미지의 requestId · 중복 resolve 는 무해', async () => {
    const broker = new AskUserQuestionBroker()
    expect(() => broker.resolve('nope', { type: 'skipped' })).not.toThrow()
    const p = broker.register('req-4')
    broker.resolve('req-4', { type: 'skipped' })
    // 두 번째 resolve 는 이미 제거돼 무시된다.
    expect(() => broker.resolve('req-4', { type: 'answered', answers: {} })).not.toThrow()
    await expect(p).resolves.toEqual({ type: 'skipped' })
  })

  it('abort 후 register 한 다른 요청에는 영향 없다', async () => {
    const broker = new AskUserQuestionBroker()
    const ac = new AbortController()
    broker.register('a', ac.signal)
    const pB = broker.register('b')
    ac.abort()
    expect(broker.size).toBe(1) // b 만 남음
    broker.resolve('b', { type: 'answered', answers: { Q: 'B' } })
    await expect(pB).resolves.toEqual({ type: 'answered', answers: { Q: 'B' } })
  })
})
