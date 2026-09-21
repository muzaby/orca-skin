import { describe, expect, it } from 'vitest'
import { INGEST_GRACE, RETENTION_DAYS, decideIngest, retentionCutoff } from './retention-window'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_700_000_000_000

describe('retentionCutoff — 14일 경계의 단일 사본', () => {
  it('기본값은 14일이고 retentionDays가 경계를 움직인다', () => {
    expect(RETENTION_DAYS).toBe(14)
    expect(retentionCutoff(NOW)).toBe(NOW - 14 * DAY)
    expect(retentionCutoff(NOW, undefined)).toBe(NOW - 14 * DAY)
    expect(retentionCutoff(NOW, 30)).toBe(NOW - 30 * DAY)
    expect(retentionCutoff(NOW, 1)).toBe(NOW - DAY)
  })
})

describe('decideIngest — 연속 카운트 (D-062)', () => {
  const cutoff = retentionCutoff(NOW)

  it('경계 ±1ms에서 갈린다', () => {
    expect(decideIngest({ headerDate: cutoff, cutoff, consecutiveOld: 0 }).action).toBe('fetch')
    expect(decideIngest({ headerDate: cutoff + 1, cutoff, consecutiveOld: 0 }).action).toBe('fetch')
    expect(decideIngest({ headerDate: cutoff - 1, cutoff, consecutiveOld: 0 }).action).toBe('skip')
  })

  it('날짜를 읽지 못한 메일은 건너뛰지 않는다', () => {
    expect(decideIngest({ headerDate: null, cutoff, consecutiveOld: 49 })).toEqual({
      action: 'fetch',
      consecutiveOld: 0
    })
  })

  it('경계 안의 메일을 만나면 카운터를 0으로 리셋한다', () => {
    expect(decideIngest({ headerDate: NOW, cutoff, consecutiveOld: 49 })).toEqual({
      action: 'fetch',
      consecutiveOld: 0
    })
  })

  it('경계 밖이면 카운터가 오르고 grace에 닿을 때만 stop이다', () => {
    const old = cutoff - 1
    expect(decideIngest({ headerDate: old, cutoff, consecutiveOld: 0 })).toEqual({
      action: 'skip',
      consecutiveOld: 1
    })
    expect(decideIngest({ headerDate: old, cutoff, consecutiveOld: INGEST_GRACE - 2 })).toEqual({
      action: 'skip',
      consecutiveOld: INGEST_GRACE - 1
    })
    expect(decideIngest({ headerDate: old, cutoff, consecutiveOld: INGEST_GRACE - 1 })).toEqual({
      action: 'stop',
      consecutiveOld: INGEST_GRACE
    })
  })

  it('흩어진 옛 메일은 grace에 닿지 못한다 — 누적이면 닿는다', () => {
    // 옛 메일 1건 뒤에 최근 메일 1건이 번갈아 오는 사서함. 누적 카운트라면 grace를 넘긴다.
    let consecutiveOld = 0
    let stopped = false
    for (let i = 0; i < INGEST_GRACE * 4; i += 1) {
      const headerDate = i % 2 === 0 ? cutoff - 1 : NOW
      const decision = decideIngest({ headerDate, cutoff, consecutiveOld })
      consecutiveOld = decision.consecutiveOld
      if (decision.action === 'stop') stopped = true
    }
    expect(stopped).toBe(false)
    expect(consecutiveOld).toBe(0)
  })

  it('grace는 호출자가 좁힐 수 있다', () => {
    expect(
      decideIngest({ headerDate: cutoff - 1, cutoff, consecutiveOld: 0, grace: 1 }).action
    ).toBe('stop')
  })
})
