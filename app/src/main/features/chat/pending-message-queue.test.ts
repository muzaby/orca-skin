import { describe, expect, it } from 'vitest'
import { PendingMessageQueue } from './pending-message-queue'

const msg = (text: string): { text: string } => ({ text })

describe('PendingMessageQueue', () => {
  it('held 취소는 성공하고 다른 세션을 건드리지 않는다', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('one'), 1, 'a')
    q.enqueue('s', msg('two'), 2, 'b')
    q.enqueue('other', msg('x'), 3, 'x')
    expect(q.cancel('s', 'a')?.text).toBe('one')
    expect(q.pending('s').map((item) => item.id)).toEqual(['b'])
    expect(q.pending('other').map((item) => item.id)).toEqual(['x'])
  })

  it('cancelAllHeld 는 held 전량을 회수한다(중단 버튼 draft 복원, 0067 확정 5)', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('one'), 1, 'a')
    q.enqueue('s', msg('two'), 2, 'b')
    q.flushHeld('s', 'batch-0') // flushed 는 대상 아님
    q.enqueue('s', msg('three'), 3, 'c')
    const removed = q.cancelAllHeld('s')
    expect(removed.map((item) => item.text)).toEqual(['three'])
    expect(q.pending('s')).toHaveLength(0)
  })

  it('flushHeld 는 held 전체를 병합 단일 배치(batch uuid)로 전이한다 (D4 1버블 구조 보장)', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg(' first '), 10, 'a')
    q.enqueue('s', msg('second'), 20, 'b')
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

  it('flushItem 은 지정 아이템만 자기 배치(uuid=item id)로 전이한다 (턴 프롬프트, 0067)', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('steer'), 10, 'a')
    q.enqueue('s', { text: 'prompt', attachmentViews: [{ id: 'v1' }] as never }, 20, 'b')
    const batch = q.flushItem('s', 'b')
    expect(batch).toMatchObject({ uuid: 'b', ids: ['b'], text: 'prompt' })
    expect(batch?.attachmentViews).toHaveLength(1)
    // 다른 held(steer)는 남는다 — 게이트 flush 몫.
    expect(q.pending('s').map((item) => item.id)).toEqual(['a'])
  })

  it('flushed 항목의 취소는 거부된다 (D3 — un-push 불가)', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('one'), 1, 'a')
    q.flushHeld('s', 'batch-1')
    expect(q.cancel('s', 'a')).toBeUndefined()
    // 이후 도착한 held 는 여전히 취소 가능.
    q.enqueue('s', msg('two'), 2, 'b')
    expect(q.cancel('s', 'b')?.text).toBe('two')
  })

  it('markConsumed 는 batch uuid 1차, 병합 텍스트 완전일치 폴백으로 매칭한다', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('same text'), 1, 'a')
    q.flushHeld('s', 'batch-1')
    q.enqueue('s', msg('same text'), 2, 'b')
    q.flushHeld('s', 'batch-2')
    // uuid 매칭 — 뒤 배치도 직접 짚을 수 있다.
    expect(q.markConsumed('s', { uuid: 'batch-2', text: 'same text' })?.ids).toEqual(['b'])
    // text 폴백 — 미소비 중 가장 오래된 배치. trim 후 비교.
    expect(q.markConsumed('s', { text: ' same text ' })?.ids).toEqual(['a'])
    // 전부 소비되면 매칭 실패.
    expect(q.markConsumed('s', { text: 'same text' })).toBeUndefined()
    // 무관한 echo(초기 프롬프트 등)·held 항목은 매칭되지 않는다.
    q.enqueue('s', msg('held only'), 3, 'c')
    expect(q.markConsumed('s', { uuid: 'zzz', text: 'held only' })).toBeUndefined()
  })

  it('drainConsumedBatches 는 소비 확정 배치를 배치 단위로 회수하고 미소비는 남긴다', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('prompt'), 5, 'p')
    q.flushItem('s', 'p')
    q.enqueue('s', msg('first'), 10, 'a')
    q.enqueue('s', msg('second'), 20, 'b')
    q.flushHeld('s', 'batch-1')
    expect(q.drainConsumedBatches('s')).toEqual([]) // 소비 전엔 0
    q.markConsumed('s', { uuid: 'p' })
    q.markConsumed('s', { uuid: 'batch-1' })
    const drained = q.drainConsumedBatches('s')
    // 배치 단위 유지 — 프롬프트(자기 버블)와 게이트 병합 배치가 병합되지 않는다(0067).
    expect(drained.map((batch) => batch.ids)).toEqual([['p'], ['a', 'b']])
    expect(drained.map((batch) => batch.text)).toEqual(['prompt', 'first\n\nsecond'])
    expect(q.drainConsumedBatches('s')).toEqual([])
  })

  it('takeForRespawn 은 미소비 flushed 재전달 + held 아이템 배치를 시간순으로 회수한다', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('consumed'), 5, 'z')
    q.flushHeld('s', 'batch-0')
    q.markConsumed('s', { uuid: 'batch-0' })
    q.enqueue('s', msg('flushed-lost'), 10, 'a')
    q.flushHeld('s', 'batch-1')
    q.enqueue('s', msg('held-late'), 20, 'b')
    const batches = q.takeForRespawn('s')
    // 소비 확정분(batch-0)은 커밋 몫 — 재전달에 섞이지 않는다. uuid 는 보존(renderer 정합).
    expect(batches.map((batch) => batch.uuid)).toEqual(['batch-1', 'b'])
    expect(batches.map((batch) => batch.text)).toEqual(['flushed-lost', 'held-late'])
    expect(q.pending('s')).toHaveLength(0)
    // 재전달분은 flushed 로 등록돼 echo 시 markConsumed→drain 커밋된다.
    expect(q.markConsumed('s', { uuid: 'b' })?.ids).toEqual(['b'])
    expect(q.drainConsumedBatches('s').map((batch) => batch.ids)).toEqual([['b']])
  })

  it('rekey 는 held/flushed 를 새 세션 키로 재바인딩한다 (clientKey→session id, 0067 AC9)', () => {
    const q = new PendingMessageQueue()
    q.enqueue('draft-1', msg('prompt'), 1, 'p')
    q.flushItem('draft-1', 'p')
    q.enqueue('draft-1', msg('early steer'), 2, 'e')
    q.rekey('draft-1', 'session-1')
    expect(q.pending('session-1').map((item) => item.id)).toEqual(['e'])
    expect(q.markConsumed('session-1', { uuid: 'p' })?.ids).toEqual(['p'])
    expect(q.pending('draft-1')).toHaveLength(0)
  })

  it('구조 페이로드 — 첨부가 배치 병합 시 함께 이월된다', () => {
    const q = new PendingMessageQueue()
    const at = { id: 't1', name: 'a.txt' } as never
    const img = { id: 'i1', name: 'b.png' } as never
    q.enqueue('s', { text: 'one', attachmentTexts: [at] }, 1, 'a')
    q.enqueue('s', { text: 'two', attachmentImages: [img] }, 2, 'b')
    const batch = q.flushHeld('s', 'batch-1')
    expect(batch?.attachmentTexts).toHaveLength(1)
    expect(batch?.attachmentImages).toHaveLength(1)
  })
})
