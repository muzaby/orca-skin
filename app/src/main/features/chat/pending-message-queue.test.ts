import { describe, expect, it } from 'vitest'
import { PendingMessageQueue } from './pending-message-queue'

const msg = (text: string): { text: string } => ({ text })

function accept(
  q: PendingMessageQueue,
  sessionId: string,
  batch: NonNullable<ReturnType<PendingMessageQueue['reserveHeld']>>
): typeof batch {
  expect(q.commit(sessionId, batch.attemptId!, batch.chainId)).toBe(true)
  return batch
}

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
    q.reserveHeld('s', 'steer', 'batch-0') // 예약분은 대상 아님
    q.enqueue('s', msg('three'), 3, 'c')
    const removed = q.cancelAllHeld('s')
    expect(removed.map((item) => item.text)).toEqual(['three'])
    expect(q.pending('s')).toHaveLength(0)
  })

  it('reserveHeld 는 held 전체를 병합 단일 배치(batch uuid)로 전이한다 (D4 1버블 구조 보장)', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg(' first '), 10, 'a')
    q.enqueue('s', msg('second'), 20, 'b')
    const batch = q.reserveHeld('s', 'steer', 'batch-1', 'chain-1')
    expect(batch).toEqual({
      uuid: 'batch-1',
      attemptId: 'batch-1',
      chainId: 'chain-1',
      ids: ['a', 'b'],
      text: 'first\n\nsecond',
      createdAt: 10
    })
    // 공개 배치에는 추적 필드(origin/state/items)가 새지 않는다.
    expect(Object.keys(batch!).sort()).toEqual([
      'attemptId',
      'chainId',
      'createdAt',
      'ids',
      'text',
      'uuid'
    ])
    // held 는 비고(취소 불가 영역으로 이동), 빈 큐 재호출은 undefined(게이트 no-op).
    expect(q.pending('s')).toHaveLength(0)
    expect(q.reserveHeld('s', 'steer')).toBeUndefined()
  })

  it('잔여 held + 신규 send 를 병합하면 시간순이 보존된다 (0152 — 입력 순서 역전 방어)', () => {
    // 이전 턴이 남긴 예약(stranded)이 있는 상태에서 사용자가 새 메시지를 보낸 상황.
    // 새 항목만 예약하면(reserveItem) 새 메시지가 턴 프롬프트로 먼저 들어가고 잔여는 나중에
    // 흘러 순서가 뒤집힌다. reserveHeld 는 적재 순서(=시간 순)대로 병합해 잔여를 앞세운다.
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('이전 턴에서 남은 것'), 10, 'stranded')
    q.enqueue('s', msg('방금 보낸 것'), 20, 'fresh')
    const batch = q.reserveHeld('s', 'turn-open')!
    expect(batch.ids).toEqual(['stranded', 'fresh'])
    expect(batch.text).toBe('이전 턴에서 남은 것\n\n방금 보낸 것')
    // createdAt 은 가장 오래된 항목 기준 — transcript 정렬이 대화 흐름을 따른다.
    expect(batch.createdAt).toBe(10)
    expect(q.pending('s')).toHaveLength(0)
  })

  it('reserveItem 은 지정 아이템만 자기 배치(uuid=item id)로 전이한다 (턴 프롬프트, 0067)', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('steer'), 10, 'a')
    q.enqueue('s', { text: 'prompt', attachmentViews: [{ id: 'v1' }] as never }, 20, 'b')
    const batch = q.reserveItem('s', 'b', 'turn-open')
    expect(batch).toMatchObject({ uuid: 'b', ids: ['b'], text: 'prompt' })
    expect(batch?.attachmentViews).toHaveLength(1)
    // 다른 held(steer)는 남는다 — 게이트 flush 몫.
    expect(q.pending('s').map((item) => item.id)).toEqual(['a'])
  })

  it('예약된 항목의 취소는 거부된다 (D3 — un-push 불가)', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('one'), 1, 'a')
    q.reserveHeld('s', 'steer', 'batch-1')
    expect(q.cancel('s', 'a')).toBeUndefined()
    // 이후 도착한 held 는 여전히 취소 가능.
    q.enqueue('s', msg('two'), 2, 'b')
    expect(q.cancel('s', 'b')?.text).toBe('two')
  })

  // ── 0151 AC4: 예약 롤백 ──────────────────────────────────────────────────────
  describe('rollback (AC4)', () => {
    it('예약을 held 로 되돌려 다시 취소 가능해진다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('one'), 1, 'a')
      q.enqueue('s', msg('two'), 2, 'b')
      const batch = q.reserveHeld('s', 'steer', 'batch-1')!
      expect(q.cancel('s', 'a')).toBeUndefined() // 예약 중엔 취소 거부

      expect(q.rollback('s', batch.uuid)).toBe(true)
      expect(q.pending('s').map((item) => item.id)).toEqual(['a', 'b'])
      expect(q.cancel('s', 'a')?.text).toBe('one') // 다시 취소 가능
    })

    it('복원 항목은 그 사이 들어온 신규 held 와 createdAt 순으로 다시 섞인다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('early'), 10, 'early')
      const batch = q.reserveHeld('s', 'steer', 'batch-1')!
      q.enqueue('s', msg('late'), 20, 'late')
      q.enqueue('s', msg('mid'), 15, 'mid')

      q.rollback('s', batch.uuid)
      expect(q.pending('s').map((item) => item.id)).toEqual(['early', 'mid', 'late'])
    })

    it('롤백 후 재예약하면 같은 항목이 새 배치로 정상 주입된다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('one'), 1, 'a')
      const first = q.reserveHeld('s', 'steer', 'batch-1')!
      q.rollback('s', first.uuid)

      const second = accept(q, 's', q.reserveHeld('s', 'steer', 'batch-2')!)
      expect(second).toMatchObject({ uuid: 'batch-2', ids: ['a'], text: 'one' })
      expect(q.confirm('s', { kind: 'echo', uuid: 'batch-2' }).map((b) => b.ids)).toEqual([['a']])
    })

    it('확정된 배치의 롤백은 거부된다 (커밋 경로 진입분 보호)', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('one'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      q.confirm('s', { kind: 'echo', uuid: 'batch-1' })
      expect(q.rollback('s', 'batch-1')).toBe(false)
      expect(q.pending('s')).toHaveLength(0)
    })

    it('orphaned 배치의 롤백은 거부된다 (CLI 가 나중에 실행할 수 있어 이중 전달 위험)', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('one'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      q.orphanUnconfirmed('s')
      expect(q.rollback('s', 'batch-1')).toBe(false)
    })

    it('모르는 uuid 롤백은 false', () => {
      const q = new PendingMessageQueue()
      expect(q.rollback('s', 'nope')).toBe(false)
    })
  })

  // ── 0151 AC5·AC6: 확정 신호 검증 ─────────────────────────────────────────────
  describe('confirm — origin ↔ 신호 대조 (AC5) / uuid 우선 (AC6)', () => {
    it('echo 는 turn-open 배치도 확정한다 — CLI drain 영수증은 배치 성격과 무관하다', () => {
      // r1 회귀 방어: 모델 출력이 하나도 없는 턴(handoff 도착 턴 등)에서는 echo 가 turn-open
      // 배치의 **유일한** 확정 신호다. 여기서 거부하면 사용자 메시지가 영영 커밋되지 않는다.
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('prompt'), 1, 'p')
      accept(q, 's', q.reserveItem('s', 'p', 'turn-open')!)
      expect(q.confirm('s', { kind: 'echo', uuid: 'p', text: 'prompt' }).map((b) => b.ids)).toEqual(
        [['p']]
      )
      expect(q.drainConfirmed('s').map((b) => b.ids)).toEqual([['p']])
    })

    it('첫 모델 출력으로도 turn-open 배치가 확정된다 (0069 기본 앵커)', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('prompt'), 1, 'p')
      accept(q, 's', q.reserveItem('s', 'p', 'turn-open')!)
      expect(q.confirm('s', { kind: 'model-output', uuids: ['p'] }).map((b) => b.ids)).toEqual([
        ['p']
      ])
    })

    it('이미 확정된 배치는 다른 신호가 늦게 와도 두 번 확정되지 않는다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('prompt'), 1, 'p')
      accept(q, 's', q.reserveItem('s', 'p', 'turn-open')!)
      q.confirm('s', { kind: 'model-output', uuids: ['p'] })
      expect(q.confirm('s', { kind: 'echo', uuid: 'p' })).toEqual([])
      expect(q.drainConfirmed('s')).toHaveLength(1)
    })

    it('첫 모델 출력은 turn-open 배치만 확정한다 — steer 배치는 거부', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('steer'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      expect(q.confirm('s', { kind: 'model-output', uuids: ['batch-1'] })).toEqual([])
      expect(q.confirm('s', { kind: 'echo', uuid: 'batch-1' }).map((b) => b.ids)).toEqual([['a']])
    })

    it('uuid 가 실려 오면 uuid 로만 판정한다 — 텍스트가 같아도 폴백하지 않는다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('same text'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      // uuid 불일치 + 텍스트 일치 → 구 구현은 여기서 batch-1 을 오확정했다.
      expect(q.confirm('s', { kind: 'echo', uuid: 'zzz', text: 'same text' })).toEqual([])
      expect(q.drainConfirmed('s')).toEqual([])
    })

    it('uuid 부재 replay 만 텍스트 완전일치 폴백을 탄다 (trim 후 비교)', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('same text'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      expect(q.confirm('s', { kind: 'echo', text: ' same text ' }).map((b) => b.ids)).toEqual([
        ['a']
      ])
      // 이미 확정된 배치는 다시 매칭되지 않는다.
      expect(q.confirm('s', { kind: 'echo', text: 'same text' })).toEqual([])
    })

    it('model-output 은 여러 turn-open 배치(프렐류드+프롬프트)를 일괄 확정한다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('prelude'), 1, 'p1')
      accept(q, 's', q.reserveItem('s', 'p1', 'turn-open')!)
      q.enqueue('s', msg('prompt'), 2, 'p2')
      accept(q, 's', q.reserveItem('s', 'p2', 'turn-open')!)
      const confirmed = q.confirm('s', { kind: 'model-output', uuids: ['p1', 'p2', 'unknown'] })
      expect(confirmed.map((b) => b.ids)).toEqual([['p1'], ['p2']])
    })

    it('held 항목과 무관한 echo 는 확정되지 않는다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('held only'), 3, 'c')
      expect(q.confirm('s', { kind: 'echo', uuid: 'zzz', text: 'held only' })).toEqual([])
      expect(q.confirm('nosuch', { kind: 'echo', uuid: 'x' })).toEqual([])
    })
  })

  it('drainConfirmed 는 확정 배치를 배치 단위로 회수하고 미확정은 남긴다', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('prompt'), 5, 'p')
    accept(q, 's', q.reserveItem('s', 'p', 'turn-open')!)
    q.enqueue('s', msg('first'), 10, 'a')
    q.enqueue('s', msg('second'), 20, 'b')
    accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
    expect(q.drainConfirmed('s')).toEqual([]) // 확정 전엔 0
    q.confirm('s', { kind: 'model-output', uuids: ['p'] })
    q.confirm('s', { kind: 'echo', uuid: 'batch-1' })
    const drained = q.drainConfirmed('s')
    // 배치 단위 유지 — 프롬프트(자기 버블)와 게이트 병합 배치가 병합되지 않는다(0067).
    expect(drained.map((batch) => batch.ids)).toEqual([['p'], ['a', 'b']])
    expect(drained.map((batch) => batch.text)).toEqual(['prompt', 'first\n\nsecond'])
    expect(q.drainConfirmed('s')).toEqual([])
  })

  // ── 0151 AC7: orphaned ──────────────────────────────────────────────────────
  describe('orphanUnconfirmed (AC7)', () => {
    it('미확정 예약만 orphaned 로 내린다 — 확정분은 건드리지 않는다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('confirmed'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      q.confirm('s', { kind: 'echo', uuid: 'batch-1' })
      q.enqueue('s', msg('lost'), 2, 'b')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-2')!)

      const orphaned = q.orphanUnconfirmed('s')
      expect(orphaned.map((b) => b.uuid)).toEqual(['batch-2'])
      // 확정분은 여전히 커밋 대상.
      expect(q.drainConfirmed('s').map((b) => b.ids)).toEqual([['a']])
    })

    // 0165 AC11 — 체인 종료 강등은 **자기 체인만** 건드린다. 인자 없이 호출하면 스코프가
    // 무력화되므로(구 테스트가 전부 그랬다) chainId 를 실제로 넘겨 격리를 고정한다.
    it('chainId 를 주면 그 체인의 미확정만 강등한다 — 다른 체인은 submitted 로 남는다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('체인 A'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'attempt-a', 'chain-A')!)
      q.enqueue('s', msg('체인 B'), 2, 'b')
      accept(q, 's', q.reserveHeld('s', 'steer', 'attempt-b', 'chain-B')!)

      const orphaned = q.orphanUnconfirmed('s', 'chain-A')
      expect(orphaned.map((b) => b.ids)).toEqual([['a']])
      // 다른 체인 것은 여전히 submitted — 영수증 대조·재강등 대상으로 남아야 한다.
      expect(q.submittedUuids('s')).toEqual(['attempt-b'])
      expect(q.hasSubmitted('s')).toBe(true)
    })

    // 0166 D8 — commit fence 가 어긋나 `submitting` 에 남은 배치는 **이미 stdin 으로 나간 것**이다
    // (push 실패는 게이트 훅이 rollback 했고, 초기 배치는 outer finally 가 먼저 rollback 한다).
    // 여기서 제외하면 confirm 대상도(open 술어 제외) orphan 대상도 아니라 **영원히 갇히고**,
    // 그러면서 open 카운트에는 계속 잡혀 세션이 영구히 busy 로 보인다(실기 보고).
    it('commit 을 못 받은 submitting 배치도 체인 종료 시 orphaned 로 내린다 (영구 고착 차단)', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('commit 실패'), 1, 'a')
      q.reserveHeld('s', 'steer', 'batch-1', 'chain-1') // commit 없이 남는다 = submitting
      expect(q.hasSubmitted('s')).toBe(false) // submitted 가 아니라 판정에서 안 보였다
      expect(q.counts('s').deliveryPendingCount).toBe(1) // 그런데 open 카운트에는 잡힌다

      const orphaned = q.orphanUnconfirmed('s', 'chain-1')
      expect(orphaned.map((b) => b.ids)).toEqual([['a']])
      // 이제 늦은 echo 로 확정되거나(커밋 유실 방지) respawn 이월·discard 로 회수될 수 있다.
      expect(q.confirm('s', { kind: 'echo', uuid: 'batch-1' }).map((b) => b.ids)).toEqual([['a']])
      expect(q.drainConfirmed('s').map((b) => b.ids)).toEqual([['a']])
      expect(q.counts('s').deliveryPendingCount).toBe(0)
    })

    it('다른 체인의 submitting 은 건드리지 않는다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('내 체인'), 1, 'a')
      q.reserveHeld('s', 'steer', 'batch-1', 'chain-1')
      q.enqueue('s', msg('다른 체인'), 2, 'b')
      q.reserveHeld('s', 'steer', 'batch-2', 'chain-2')

      expect(q.orphanUnconfirmed('s', 'chain-1').map((b) => b.ids)).toEqual([['a']])
      // chain-2 는 아직 진행 중일 수 있다 — rollback 가능한 submitting 으로 남아야 한다.
      expect(q.rollback('s', 'batch-2')).toBe(true)
    })

    it('takeForRespawn 이 새 chainId 를 붙이면 이전 체인의 강등이 그것을 건드리지 못한다 (ABA 차단)', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('이월 대상'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'attempt-1', 'chain-old')!)
      // 채널 사망 → 새 체인으로 이월(attemptId·chainId 재발급, messageIds 보존).
      const carried = q.takeForRespawn('s', 'chain-new')
      expect(carried.map((b) => b.ids)).toEqual([['a']])
      for (const batch of carried) q.commit('s', batch.attemptId!, batch.chainId)

      // 뒤늦게 끝난 **이전** 체인의 강등은 새 체인 예약을 orphaned 로 내리면 안 된다.
      expect(q.orphanUnconfirmed('s', 'chain-old')).toEqual([])
      expect(q.submittedUuids('s')).toEqual(carried.map((b) => b.uuid))
    })

    it('두 번 호출해도 같은 배치를 다시 세지 않는다 (멱등)', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('lost'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      expect(q.orphanUnconfirmed('s')).toHaveLength(1)
      expect(q.orphanUnconfirmed('s')).toHaveLength(0)
    })

    it('지각 도착한 확정 신호는 orphaned 도 확정한다 (커밋 유실 방지)', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('late echo'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      q.orphanUnconfirmed('s')
      expect(q.confirm('s', { kind: 'echo', uuid: 'batch-1' }).map((b) => b.ids)).toEqual([['a']])
      expect(q.drainConfirmed('s').map((b) => b.ids)).toEqual([['a']])
    })
  })

  // ── 0154: orphaned 는 폐기 대상이 아니다 (0151 OQ2 실측 철회) ──────────────────
  describe('orphaned 잔존 계약 (0154)', () => {
    it('orphaned 는 큐에 남아 takeForRespawn 으로 이월된다 — 채널 사망이 유일한 회수 시점', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('CLI 큐에 살아있음'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'orphan-1')!)
      q.orphanUnconfirmed('s')
      // 폐기되지 않았으므로 respawn 이 그대로 이월한다(유실 없음).
      expect(q.takeForRespawn('s').map((b) => b.ids)).toEqual([['a']])
    })

    it('orphaned 인 채로도 늦은 echo 가 정상 커밋시킨다 — CLI 가 다음 턴에 소비하는 경우', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('777'), 1, 'a')
      q.enqueue('s', msg('888'), 2, 'b')
      accept(q, 's', q.reserveHeld('s', 'steer', 'orphan-1')!)
      q.orphanUnconfirmed('s')
      expect(q.confirm('s', { kind: 'echo', uuid: 'orphan-1' }).map((x) => x.ids)).toEqual([
        ['a', 'b']
      ])
      expect(q.drainConfirmed('s').map((x) => x.ids)).toEqual([['a', 'b']])
    })
  })

  describe('discardSubmitted (OQ1 — 세션 전체 중단)', () => {
    it('지정 uuid 의 예약만 폐기한다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('one'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      q.enqueue('s', msg('two'), 2, 'b')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-2')!)

      const discarded = q.discardSubmitted('s', ['batch-1'])
      expect(discarded.map((x) => x.ids)).toEqual([['a']])
      expect(q.submittedUuids('s')).toEqual(['batch-2'])
    })

    // 0165 AC13 — open 정본 3상태(submitting|submitted|orphaned)를 전부 폐기한다. 체인 종료
    // 강등이 orphaned 를 늘리므로, 여기서 상쇄하지 않으면 '세션 전체 중단' 이 조용히 무력화된다.
    it('orphaned 로 강등된 배치도 폐기한다 (open 정본 3상태)', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('강등됨'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1', 'chain-1')!)
      q.orphanUnconfirmed('s', 'chain-1')
      expect(q.submittedUuids('s')).toEqual([]) // 더 이상 submitted 가 아니다
      expect(q.counts('s').deliveryPendingCount).toBe(1) // 그러나 open 이라 표시에는 남는다

      const discarded = q.discardSubmitted('s', ['batch-1'])
      expect(discarded.map((b) => b.ids)).toEqual([['a']])
      expect(q.counts('s').deliveryPendingCount).toBe(0)
    })

    it('submitting(제출 중) 배치도 폐기 대상이다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('제출 중'), 1, 'a')
      q.reserveHeld('s', 'steer', 'batch-1', 'chain-1') // commit 전 = submitting
      expect(q.discardSubmitted('s', ['batch-1']).map((b) => b.ids)).toEqual([['a']])
      expect(q.counts('s').deliveryPendingCount).toBe(0)
    })

    it('모르는 uuid·확정된 배치는 건드리지 않는다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('one'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      q.confirm('s', { kind: 'echo', uuid: 'batch-1' })
      expect(q.discardSubmitted('s', ['batch-1', 'unknown'])).toEqual([])
      // 확정분은 커밋 경로에 그대로 남는다.
      expect(q.drainConfirmed('s').map((x) => x.ids)).toEqual([['a']])
    })

    it('빈 목록이면 no-op', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('one'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      expect(q.discardSubmitted('s', [])).toEqual([])
      expect(q.submittedUuids('s')).toEqual(['batch-1'])
    })

    it('discard가 제출 직전 끼어들면 canCommit fence가 push를 막고 늦은 commit도 실패한다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('one'), 1, 'a')
      const batch = q.reserveHeld('s', 'turn-open', 'attempt-1', 'chain-1')!
      const attempt = {
        messageIds: batch.ids,
        attemptId: batch.attemptId!,
        chainId: batch.chainId!
      }
      expect(q.canCommitMany('s', [attempt])).toBe(true)
      q.discardSubmitted('s', ['attempt-1'])
      expect(q.canCommitMany('s', [attempt])).toBe(false)
      expect(q.commitMany('s', [attempt])).toBe(false)
    })
  })

  // ── 0151 AC11: 영수증 대조용 uuid 집합 ───────────────────────────────────────
  describe('submittedUuids (AC11)', () => {
    it('예약 중(submitted)인 배치만 열거한다', () => {
      const q = new PendingMessageQueue()
      expect(q.submittedUuids('s')).toEqual([])
      q.enqueue('s', msg('one'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      expect(q.submittedUuids('s')).toEqual(['batch-1'])

      q.enqueue('s', msg('two'), 2, 'b')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-2')!)
      expect(q.submittedUuids('s').sort()).toEqual(['batch-1', 'batch-2'])

      // 확정·orphan 전이분은 "지금 CLI 큐에 있을 수 있는 우리 것" 이 아니다.
      q.confirm('s', { kind: 'echo', uuid: 'batch-1' })
      q.orphanUnconfirmed('s')
      expect(q.submittedUuids('s')).toEqual([])
    })
  })

  it('takeForRespawn 은 미확정 예약 재전달 + held 아이템 배치를 시간순으로 회수한다', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('confirmed'), 5, 'z')
    accept(q, 's', q.reserveHeld('s', 'steer', 'batch-0')!)
    q.confirm('s', { kind: 'echo', uuid: 'batch-0' })
    q.enqueue('s', msg('flushed-lost'), 10, 'a')
    accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
    q.enqueue('s', msg('held-late'), 20, 'b')
    const batches = q.takeForRespawn('s', 'respawn-chain')
    // 확정분(batch-0)은 커밋 몫 — 재전달에 섞이지 않는다. 재주입 attempt는 이전 provider
    // 화신의 receipt와 충돌하지 않도록 새 uuid를 받되 message ids는 보존한다.
    expect(batches.map((batch) => batch.ids)).toEqual([['a'], ['b']])
    expect(batches.map((batch) => batch.uuid)).not.toContain('batch-1')
    expect(batches.map((batch) => batch.uuid)).not.toContain('b')
    expect(batches.every((batch) => batch.chainId === 'respawn-chain')).toBe(true)
    expect(batches.map((batch) => batch.text)).toEqual(['flushed-lost', 'held-late'])
    expect(q.pending('s')).toHaveLength(0)
    // 재전달분은 새 턴의 프렐류드/프롬프트가 되므로 origin 이 turn-open 으로 재스탬프된다(AC1).
    // 재스탬프가 필요한 이유는 **첫 모델 출력을 확정 신호로 열어야** 하기 때문이다 — steer 로
    // 남겨두면 model-output 이 확정하지 못해(D2 비대칭) 새 턴이 이 배치를 영영 커밋하지 못한다.
    expect(
      q.commitMany(
        's',
        batches.map((batch) => ({
          messageIds: batch.ids,
          attemptId: batch.attemptId!,
          chainId: batch.chainId!
        }))
      )
    ).toBe(true)
    expect(
      q
        .confirm('s', {
          kind: 'model-output',
          uuids: batches.map((batch) => batch.uuid)
        })
        .map((b) => b.ids)
    ).toEqual([['a'], ['b']])
    expect(q.drainConfirmed('s').map((batch) => batch.ids)).toEqual([['a'], ['b']])
  })

  it('takeForRespawn 은 orphaned 예약도 회수한다', () => {
    const q = new PendingMessageQueue()
    q.enqueue('s', msg('orphan'), 1, 'a')
    accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
    q.orphanUnconfirmed('s')
    const [retried] = q.takeForRespawn('s')
    expect(retried.ids).toEqual(['a'])
    expect(retried.uuid).not.toBe('batch-1')
  })

  it('rekey 는 held/예약분을 새 세션 키로 재바인딩한다 (clientKey→session id, 0067 AC9)', () => {
    const q = new PendingMessageQueue()
    q.enqueue('draft-1', msg('prompt'), 1, 'p')
    accept(q, 'draft-1', q.reserveItem('draft-1', 'p', 'turn-open')!)
    q.enqueue('draft-1', msg('early steer'), 2, 'e')
    q.rekey('draft-1', 'session-1')
    expect(q.pending('session-1').map((item) => item.id)).toEqual(['e'])
    expect(
      q.confirm('session-1', { kind: 'model-output', uuids: ['p'] }).map((b) => b.ids)
    ).toEqual([['p']])
    expect(q.pending('draft-1')).toHaveLength(0)
  })

  it('구조 페이로드 — 첨부가 배치 병합 시 함께 이월된다', () => {
    const q = new PendingMessageQueue()
    const at = { id: 't1', name: 'a.txt' } as never
    const img = { id: 'i1', name: 'b.png' } as never
    q.enqueue('s', { text: 'one', attachmentTexts: [at] }, 1, 'a')
    q.enqueue('s', { text: 'two', attachmentImages: [img] }, 2, 'b')
    const batch = q.reserveHeld('s', 'steer', 'batch-1')
    expect(batch?.attachmentTexts).toHaveLength(1)
    expect(batch?.attachmentImages).toHaveLength(1)
  })

  // ── 0151 AC8: 수명 정리 ─────────────────────────────────────────────────────
  describe('dispose / disposeAll (AC8)', () => {
    it('세션 전량을 제거하고 payload 를 스크럽한다 (첨부 base64 고착 해소)', () => {
      const q = new PendingMessageQueue()
      const img = { id: 'i1', name: 'b.png', data: 'BIGBASE64' } as never
      q.enqueue('s', { text: 'held', attachmentImages: [img] }, 1, 'h')
      q.enqueue('s', { text: 'reserved', attachmentImages: [img] }, 2, 'r')
      q.reserveItem('s', 'r', 'steer')
      // 큐가 붙들고 있는 실제 아이템 참조 — 이것이 세션 런타임 수명 내내 base64 를 pin 하던 것.
      const heldItem = q.pending('s')[0]

      q.dispose('s')

      // 큐가 더는 아무것도 보유하지 않는다.
      expect(q.pending('s')).toHaveLength(0)
      expect(q.submittedUuids('s')).toEqual([])
      expect(q.takeForRespawn('s')).toEqual([])
      // 큐가 보유하던 아이템 내용은 덮어써진다(맵 제거만으로는 다른 참조가 살릴 수 있다).
      expect(heldItem.text).toBe('')
      expect(heldItem.attachmentImages).toEqual([])
    })

    it('다른 세션은 건드리지 않는다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('a', msg('keep'), 1, 'x')
      q.enqueue('b', msg('drop'), 1, 'y')
      q.dispose('b')
      expect(q.pending('a').map((i) => i.id)).toEqual(['x'])
      expect(q.pending('b')).toHaveLength(0)
    })

    it('disposeAll 은 전 세션을 비운다 (프로그램 종료)', () => {
      const q = new PendingMessageQueue()
      q.enqueue('a', msg('one'), 1, 'x')
      q.enqueue('b', msg('two'), 2, 'y')
      q.reserveHeld('b', 'steer', 'batch-1')
      q.disposeAll()
      expect(q.pending('a')).toHaveLength(0)
      expect(q.pending('b')).toHaveLength(0)
      expect(q.submittedUuids('b')).toEqual([])
    })
  })

  // ── 0151 AC9: 종료 admission freeze ─────────────────────────────────────────
  describe('freeze (AC9)', () => {
    it('freeze 후 enqueue 는 app_closing 으로 거부된다', () => {
      const q = new PendingMessageQueue()
      q.freeze()
      expect(q.isFrozen).toBe(true)
      expect(() => q.enqueue('s', msg('late'), 1, 'a')).toThrow('app_closing')
    })

    it('freeze 후 예약은 조용히 no-op — 종료 중 게이트 flush 가 뒤늦게 제출하지 않는다', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('one'), 1, 'a')
      q.freeze()
      expect(q.reserveHeld('s', 'steer')).toBeUndefined()
      expect(q.reserveItem('s', 'a', 'turn-open')).toBeUndefined()
      // held 는 그대로 남아 disposeAll 이 스크럽한다.
      expect(q.pending('s').map((i) => i.id)).toEqual(['a'])
    })

    it('freeze 는 취소·확정·drain 경로를 막지 않는다 (진행 중 정리는 계속돼야 한다)', () => {
      const q = new PendingMessageQueue()
      q.enqueue('s', msg('one'), 1, 'a')
      accept(q, 's', q.reserveHeld('s', 'steer', 'batch-1')!)
      q.enqueue('s', msg('two'), 2, 'b')
      q.freeze()
      expect(q.cancel('s', 'b')?.text).toBe('two')
      expect(q.confirm('s', { kind: 'echo', uuid: 'batch-1' }).map((x) => x.ids)).toEqual([['a']])
      expect(q.drainConfirmed('s').map((x) => x.ids)).toEqual([['a']])
    })
  })
})
