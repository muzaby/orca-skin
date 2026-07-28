import { describe, expect, it } from 'vitest'
import { reconcileInterruptReceipt } from './interrupt-reconcile'

describe('reconcileInterruptReceipt (0151 AC11)', () => {
  it('영수증 미보유(undefined)는 unknown — "잔여 없음" 과 구분한다', () => {
    // 구형 CLI 는 `interrupt_receipt_v1` capability 가 없어 빈 성공 응답을 보낸다. 이를 빈 배열과
    // 뭉개면 "잔여 없음" 을 오판한다.
    expect(reconcileInterruptReceipt(undefined, ['batch-1'])).toEqual({ kind: 'unknown' })
  })

  it('빈 still_queued 는 clear', () => {
    expect(reconcileInterruptReceipt({ stillQueued: [] }, ['batch-1'])).toEqual({ kind: 'clear' })
  })

  it('우리 예약이 살아남으면 survived — uuid 와 전체 개수를 함께 보고한다', () => {
    expect(reconcileInterruptReceipt({ stillQueued: ['batch-1'] }, ['batch-1', 'batch-2'])).toEqual(
      {
        kind: 'survived',
        uuids: ['batch-1'],
        totalCount: 1
      }
    )
  })

  it('모르는 uuid 만 남으면 clear — 백그라운드 auto-resume continuation 을 잔여로 오인하지 않는다', () => {
    // sdk.d.ts:3487 — "internally-enqueued uuids the client never sent (cron triggers,
    // auto-resume continuations) … ignore unknown uuids". Orca 는 백그라운드 서브에이전트가
    // 기본(0143)이라 이 경로가 실제로 발생하며, 잔여로 오인해 런타임을 폐기하면 완료 통지가 죽는다.
    expect(
      reconcileInterruptReceipt({ stillQueued: ['cli-internal-1', 'cron-2'] }, ['batch-1'])
    ).toEqual({ kind: 'clear' })
  })

  it('혼재하면 우리 것만 골라낸다 (totalCount 는 원본 길이 유지)', () => {
    expect(
      reconcileInterruptReceipt({ stillQueued: ['cli-internal-1', 'batch-2', 'cron-3'] }, [
        'batch-1',
        'batch-2'
      ])
    ).toEqual({ kind: 'survived', uuids: ['batch-2'], totalCount: 3 })
  })

  it('우리 예약이 하나도 없으면 무엇이 남아 있든 clear', () => {
    expect(reconcileInterruptReceipt({ stillQueued: ['x', 'y'] }, [])).toEqual({ kind: 'clear' })
  })
})
