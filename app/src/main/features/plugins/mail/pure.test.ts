import { describe, expect, it } from 'vitest'
import { isFresh } from './freshness'
import { isExpired } from './retention'
import { buildMailQuery } from './query-builder'
import { reconcileUidls } from './reconcile'
import {
  CONFIRM_OBSERVATIONS,
  PROTECTION_MIN_SAMPLE,
  PROTECTION_RATIO,
  decideProtection
} from './protection'
import { normalizeMail } from './normalize'

describe('mail pure policy modules', () => {
  it('freshness is bounded at five minutes and requires a prior sync', () => {
    expect(isFresh({ now: 1000, lastSyncAt: null })).toBe(false)
    expect(isFresh({ now: 1000 + 5 * 60 * 1000, lastSyncAt: 1000 })).toBe(true)
    expect(isFresh({ now: 1000 + 5 * 60 * 1000 + 1, lastSyncAt: 1000 })).toBe(false)
  })

  it('retention uses header date when present and firstSeenAt otherwise', () => {
    const day = 24 * 60 * 60 * 1000
    expect(isExpired({ now: 14 * day, headerDate: 0, firstSeenAt: 10 * day })).toBe(false)
    expect(isExpired({ now: 14 * day + 1, headerDate: 0, firstSeenAt: 10 * day })).toBe(true)
    expect(isExpired({ now: 14 * day + 1, headerDate: null, firstSeenAt: 0 })).toBe(true)
  })

  it('uses LIKE for short fragments and escaped MATCH tokens for longer text', () => {
    expect(buildMailQuery('일정')).toEqual({
      mode: 'like',
      expression: 'LIKE ?',
      parameter: '%일정%'
    })
    expect(buildMailQuery('a_b')).toMatchObject({ mode: 'match', expression: 'MATCH ?' })
    expect(buildMailQuery('회의 안내').parameter).toBe('"회의" AND "안내"')
  })

  it('reconciles fresh, known and missing UIDLs without deleting mail rows', () => {
    const result = reconcileUidls(
      [
        { uidl: 'old', state: 'active' },
        { uidl: 'gone', state: 'active' },
        { uidl: 'retained-missing', state: 'missing' }
      ],
      ['old', 'new']
    )
    expect(result.fresh).toEqual(['new'])
    expect(result.known).toEqual(['old'])
    expect(result.missing).toEqual(['gone'])
    expect(result.retainedRatio).toBe(0.5)
  })

  it('protects bulk loss below the ratio/sample thresholds and releases on recovery or confirmation', () => {
    const first = decideProtection({
      retainedRatio: PROTECTION_RATIO - 0.01,
      activeLedgerCount: PROTECTION_MIN_SAMPLE,
      now: 1,
      remoteFingerprint: 'a',
      previous: { kind: 'none' }
    })
    expect(first.ingest).toBe(false)
    expect(first.state.observations).toBe(1)
    const second = decideProtection({
      retainedRatio: PROTECTION_RATIO - 0.01,
      activeLedgerCount: PROTECTION_MIN_SAMPLE,
      now: 2,
      remoteFingerprint: 'a',
      previous: first.state
    })
    expect(second.ingest).toBe(true)
    expect(CONFIRM_OBSERVATIONS).toBe(2)
    const reset = decideProtection({
      retainedRatio: PROTECTION_RATIO - 0.01,
      activeLedgerCount: PROTECTION_MIN_SAMPLE,
      now: 2,
      remoteFingerprint: 'b',
      previous: first.state
    })
    expect(reset.ingest).toBe(false)
    expect(reset.state.observations).toBe(1)
    expect(
      decideProtection({
        retainedRatio: PROTECTION_RATIO,
        activeLedgerCount: PROTECTION_MIN_SAMPLE,
        now: 3,
        remoteFingerprint: 'c',
        previous: first.state
      }).ingest
    ).toBe(true)
  })

  it('normalizes sender/recipient, date, body and attachment metadata', () => {
    const document = normalizeMail(
      {
        date: '2026-01-02T03:04:05Z',
        from: { name: 'A', address: 'a@example.com' },
        to: [{ name: 'B', address: 'b@example.com' }],
        cc: [],
        subject: '제목',
        text: '본문',
        attachments: [
          { filename: '../a.txt', mimeType: 'text/plain', content: new Uint8Array([1, 2]) }
        ]
      } as never,
      { uidl: 'u1', messageNumber: 1, firstSeenAt: 0, sizeBytes: 123 }
    )
    expect(document.fromAddr).toBe('a@example.com')
    expect(document.toAddrs).toBe('b@example.com')
    expect(document.sizeBytes).toBe(123)
    expect(document.attachments[0]).toMatchObject({ filename: '../a.txt', sizeBytes: 2 })
  })
})
