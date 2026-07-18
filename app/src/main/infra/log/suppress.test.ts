import { describe, expect, it } from 'vitest'
import type { LogRecord } from '../../../shared/logging'
import { RepeatSuppressor, fingerprintOf } from './suppress'

function record(partial: Partial<LogRecord>): LogRecord {
  return {
    schemaVersion: 1,
    timestamp: '2026-07-18T00:00:00.000Z',
    level: 'error',
    event: 'llm.stream.failed',
    scope: 'llm',
    process: 'main',
    appVersion: '0.0.0',
    sessionId: 's',
    error: { name: 'TimeoutError', message: 'timeout', code: 'MODEL_TIMEOUT' },
    ...partial
  }
}

describe('RepeatSuppressor', () => {
  it('창 내 동일 fingerprint 반복은 첫 건만 emit 하고 나머지는 drop', () => {
    let now = 0
    const s = new RepeatSuppressor(60_000, () => now)
    expect(s.check(record({})).action).toBe('emit')
    now += 1000
    expect(s.check(record({})).action).toBe('drop')
    now += 1000
    expect(s.check(record({})).action).toBe('drop')
  })

  it('창 만료 시 suppressedCount 를 실은 summary 를 반환한다', () => {
    let now = 0
    const s = new RepeatSuppressor(60_000, () => now)
    s.check(record({}))
    s.check(record({}))
    s.check(record({}))
    now = 61_000
    const decision = s.check(record({}))
    expect(decision.action).toBe('summary')
    expect(decision.suppressedCount).toBe(2)
    expect(decision.windowMs).toBe(60_000)
  })

  it('억제 없던 창 만료 후에는 그냥 emit', () => {
    let now = 0
    const s = new RepeatSuppressor(60_000, () => now)
    s.check(record({}))
    now = 61_000
    expect(s.check(record({})).action).toBe('emit')
  })

  it('fingerprint 가 다르면 서로 억제하지 않는다', () => {
    const s = new RepeatSuppressor(60_000, () => 0)
    expect(s.check(record({})).action).toBe('emit')
    expect(s.check(record({ event: 'db.migration.failed' })).action).toBe('emit')
    expect(s.check(record({ error: { name: 'OtherError', message: 'x' } })).action).toBe('emit')
  })

  it('info/debug 는 억제 대상이 아니다', () => {
    const s = new RepeatSuppressor(60_000, () => 0)
    expect(s.check(record({ level: 'info' })).action).toBe('emit')
    expect(s.check(record({ level: 'info' })).action).toBe('emit')
    expect(s.check(record({ level: 'debug' })).action).toBe('emit')
  })

  it('fingerprint = event + error.name + error.code', () => {
    expect(fingerprintOf(record({}))).toBe('llm.stream.failed|TimeoutError|MODEL_TIMEOUT')
    expect(fingerprintOf(record({ error: undefined }))).toBe('llm.stream.failed||')
  })
})
