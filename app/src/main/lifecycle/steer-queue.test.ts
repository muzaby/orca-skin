import { describe, expect, it } from 'vitest'
import { SteerQueue } from './steer-queue'

describe('SteerQueue', () => {
  it('preserves order and drains multiple pending inputs as one flush', () => {
    const q = new SteerQueue()
    q.enqueue('s', ' first ', 10, 'a')
    q.enqueue('s', 'second', 20, 'b')
    expect(q.drainForFlush('s')).toEqual({
      ids: ['a', 'b'],
      text: 'first\n\nsecond',
      createdAt: 10
    })
    expect(q.drainForFlush('s')).toBeUndefined()
  })

  it('cancels one item without touching other sessions', () => {
    const q = new SteerQueue()
    q.enqueue('s', 'one', 1, 'a')
    q.enqueue('s', 'two', 2, 'b')
    q.enqueue('other', 'x', 3, 'x')
    expect(q.cancel('s', 'a')?.text).toBe('one')
    expect(q.pending('s').map((item) => item.id)).toEqual(['b'])
    expect(q.pending('other').map((item) => item.id)).toEqual(['x'])
  })

  it('markConsumed 는 uuid(=id) 1차, text 완전일치 폴백으로 미소비 항목을 매칭한다', () => {
    const q = new SteerQueue()
    q.enqueue('s', 'same text', 1, 'a')
    q.enqueue('s', 'same text', 2, 'b')
    // uuid 매칭 — 뒤 항목(b)도 직접 짚을 수 있다.
    expect(q.markConsumed('s', { uuid: 'b', text: 'same text' })?.id).toBe('b')
    // text 폴백 — 미소비 중 가장 오래된 것(a). trim 후 비교.
    expect(q.markConsumed('s', { text: ' same text ' })?.id).toBe('a')
    // 전부 소비되면 매칭 실패.
    expect(q.markConsumed('s', { text: 'same text' })).toBeUndefined()
    // 무관한 echo(초기 프롬프트 등)는 매칭되지 않는다.
    expect(q.markConsumed('s', { uuid: 'zzz', text: 'unrelated' })).toBeUndefined()
  })

  it('drainConsumed 는 소비 확정분만 병합 drain 하고 미소비는 남긴다', () => {
    const q = new SteerQueue()
    q.enqueue('s', 'first', 10, 'a')
    q.enqueue('s', 'second', 20, 'b')
    q.enqueue('s', 'third', 30, 'c')
    expect(q.drainConsumed('s')).toBeUndefined() // 소비 전엔 drain 0
    q.markConsumed('s', { uuid: 'a' })
    q.markConsumed('s', { uuid: 'b' })
    expect(q.hasConsumed('s')).toBe(true)
    expect(q.drainConsumed('s')).toEqual({
      ids: ['a', 'b'],
      text: 'first\n\nsecond',
      createdAt: 10
    })
    // 미소비(c)는 잔존 — 다음 send 이월(carryover) 대상.
    expect(q.pending('s').map((item) => item.id)).toEqual(['c'])
    expect(q.hasConsumed('s')).toBe(false)
    // 전량 drain(carryover)은 소비 여부와 무관하게 비운다.
    expect(q.drainForFlush('s')).toEqual({ ids: ['c'], text: 'third', createdAt: 30 })
    expect(q.pending('s')).toHaveLength(0)
  })
})
