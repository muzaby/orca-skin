import { describe, expect, it } from 'vitest'
import { SteerQueue } from './steer-queue'

describe('SteerQueue', () => {
  it('held 항목은 순서 보존 + carryover 전량 병합 drain', () => {
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

  it('held 취소는 성공하고 다른 세션을 건드리지 않는다', () => {
    const q = new SteerQueue()
    q.enqueue('s', 'one', 1, 'a')
    q.enqueue('s', 'two', 2, 'b')
    q.enqueue('other', 'x', 3, 'x')
    expect(q.cancel('s', 'a')?.text).toBe('one')
    expect(q.pending('s').map((item) => item.id)).toEqual(['b'])
    expect(q.pending('other').map((item) => item.id)).toEqual(['x'])
  })

  it('flushHeld 는 held 전체를 병합 단일 배치(batch uuid)로 전이한다 (D4 1버블 구조 보장)', () => {
    const q = new SteerQueue()
    q.enqueue('s', 'first', 10, 'a')
    q.enqueue('s', 'second', 20, 'b')
    const batch = q.flushHeld('s', 'batch-1')
    expect(batch).toEqual({
      uuid: 'batch-1',
      ids: ['a', 'b'],
      text: 'first\n\nsecond',
      createdAt: 10
    })
    // held 는 비고(취소 불가 영역으로 이동), 빈 큐 재호출은 undefined(게이트 no-op).
    expect(q.pending('s')).toHaveLength(0)
    expect(q.flushHeld('s')).toBeUndefined()
  })

  it('flushed 항목의 취소는 거부된다 (D3 — un-push 불가)', () => {
    const q = new SteerQueue()
    q.enqueue('s', 'one', 1, 'a')
    q.flushHeld('s', 'batch-1')
    expect(q.cancel('s', 'a')).toBeUndefined()
    // 이후 도착한 held 는 여전히 취소 가능.
    q.enqueue('s', 'two', 2, 'b')
    expect(q.cancel('s', 'b')?.text).toBe('two')
  })

  it('markConsumed 는 batch uuid 1차, 병합 텍스트 완전일치 폴백으로 매칭한다', () => {
    const q = new SteerQueue()
    q.enqueue('s', 'same text', 1, 'a')
    q.flushHeld('s', 'batch-1')
    q.enqueue('s', 'same text', 2, 'b')
    q.flushHeld('s', 'batch-2')
    // uuid 매칭 — 뒤 배치도 직접 짚을 수 있다.
    expect(q.markConsumed('s', { uuid: 'batch-2', text: 'same text' })?.ids).toEqual(['b'])
    // text 폴백 — 미소비 중 가장 오래된 배치. trim 후 비교.
    expect(q.markConsumed('s', { text: ' same text ' })?.ids).toEqual(['a'])
    // 전부 소비되면 매칭 실패.
    expect(q.markConsumed('s', { text: 'same text' })).toBeUndefined()
    // 무관한 echo(초기 프롬프트 등)·held 항목은 매칭되지 않는다.
    q.enqueue('s', 'held only', 3, 'c')
    expect(q.markConsumed('s', { uuid: 'zzz', text: 'held only' })).toBeUndefined()
  })

  it('drainConsumed 는 소비 확정 배치만 병합 drain 하고 미소비 배치는 남긴다', () => {
    const q = new SteerQueue()
    q.enqueue('s', 'first', 10, 'a')
    q.enqueue('s', 'second', 20, 'b')
    q.flushHeld('s', 'batch-1')
    q.enqueue('s', 'third', 30, 'c')
    q.flushHeld('s', 'batch-2')
    expect(q.drainConsumed('s')).toBeUndefined() // 소비 전엔 drain 0
    q.markConsumed('s', { uuid: 'batch-1' })
    expect(q.hasConsumed('s')).toBe(true)
    expect(q.drainConsumed('s')).toEqual({
      ids: ['a', 'b'],
      text: 'first\n\nsecond',
      createdAt: 10
    })
    expect(q.hasConsumed('s')).toBe(false)
    // 미소비 배치(batch-2)는 잔존 — 이후 echo 로 소비되거나 carryover 대상.
    q.markConsumed('s', { uuid: 'batch-2' })
    expect(q.drainConsumed('s')).toEqual({ ids: ['c'], text: 'third', createdAt: 30 })
  })

  it('연속 echo 로 함께 소비된 복수 배치는 한 번에 병합 drain 된다 (같은 drain 지점 소비)', () => {
    const q = new SteerQueue()
    q.enqueue('s', 'first', 10, 'a')
    q.flushHeld('s', 'batch-1')
    q.enqueue('s', 'second', 20, 'b')
    q.flushHeld('s', 'batch-2')
    q.markConsumed('s', { uuid: 'batch-1' })
    q.markConsumed('s', { uuid: 'batch-2' })
    expect(q.drainConsumed('s')).toEqual({
      ids: ['a', 'b'],
      text: 'first\n\nsecond',
      createdAt: 10
    })
  })

  it('carryover(drainForFlush)는 미소비 flushed 배치 + held 를 시간순 병합하고 소비분은 버린다', () => {
    const q = new SteerQueue()
    q.enqueue('s', 'consumed', 5, 'z')
    q.flushHeld('s', 'batch-0')
    q.markConsumed('s', { uuid: 'batch-0' })
    q.enqueue('s', 'flushed-lost', 10, 'a')
    q.flushHeld('s', 'batch-1')
    q.enqueue('s', 'held-late', 20, 'b')
    // 소비 확정분(batch-0)은 drainConsumed 몫 — carryover 에 섞여 중복 전달되지 않는다.
    expect(q.drainForFlush('s')).toEqual({
      ids: ['a', 'b'],
      text: 'flushed-lost\n\nheld-late',
      createdAt: 10
    })
    expect(q.drainForFlush('s')).toBeUndefined()
    expect(q.pending('s')).toHaveLength(0)
  })
})
