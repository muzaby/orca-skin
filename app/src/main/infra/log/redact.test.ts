import { describe, expect, it } from 'vitest'
import type { LogRecord } from '../../../shared/logging'
import { LOG_STRING_MAX_LENGTH } from '../../../shared/logging'
import { REDACTED, isSensitiveKey, redactRecord, redactString } from './redact'

function record(partial: Partial<LogRecord>): LogRecord {
  return {
    schemaVersion: 1,
    timestamp: '2026-07-18T00:00:00.000Z',
    level: 'info',
    event: 'test.case.ran',
    scope: 'test',
    process: 'main',
    appVersion: '0.0.0',
    sessionId: 's',
    ...partial
  }
}

describe('isSensitiveKey', () => {
  it('민감 키 조각·정확 일치를 잡는다', () => {
    for (const key of [
      'authorization',
      'Authorization',
      'set-cookie',
      'password',
      'authToken',
      'accessToken',
      'refreshToken',
      'apiKey',
      'api_key',
      'credential',
      'privateKey',
      'pat',
      'auth',
      'key'
    ]) {
      expect(isSensitiveKey(key), key).toBe(true)
    }
  })
  it('무해 키는 통과시킨다 (pat 부분 문자열 오탐 없음)', () => {
    for (const key of ['path', 'provider', 'model', 'durationMs', 'pattern', 'keys']) {
      expect(isSensitiveKey(key), key).toBe(false)
    }
  })
})

describe('redactString (값 패턴)', () => {
  it.each([
    ['Bearer abcdef1234567890', 'Bearer'],
    ['Basic dXNlcjpwYXNzd29yZA==', 'Basic'],
    ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456', 'JWT'],
    ['-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----', 'PEM'],
    ['AKIAIOSFODNN7EXAMPLE', 'AWS'],
    ['sk-ant-api03-abcdefghijklmnop', 'sk-'],
    ['ghp_abcdefghijklmnopqrstuvwxyz012345', 'GitHub PAT']
  ])('%s → 마스킹 (%s)', (value) => {
    const out = redactString(`before ${value} after`)
    expect(out).toContain(REDACTED)
    expect(out).not.toContain(value.slice(-12))
  })

  it('8KB 초과 문자열을 절단한다', () => {
    const out = redactString('a'.repeat(LOG_STRING_MAX_LENGTH + 100))
    expect(out.length).toBe(LOG_STRING_MAX_LENGTH)
  })
})

describe('redactRecord', () => {
  it('data 의 민감 키를 재귀로 마스킹한다', () => {
    const out = redactRecord(
      record({
        data: {
          provider: 'bedrock',
          apiKey: 'super-secret',
          nested: { authorization: 'Bearer tok', list: [{ password: 'pw' }] }
        }
      })
    )
    expect(out.data).toEqual({
      provider: 'bedrock',
      apiKey: REDACTED,
      nested: { authorization: REDACTED, list: [{ password: REDACTED }] }
    })
  })

  it('무해 키의 비밀 형태 값도 값 패턴으로 마스킹한다', () => {
    const out = redactRecord(record({ data: { note: 'header was Bearer abcdef1234567890 ok' } }))
    expect(JSON.stringify(out.data)).toContain(REDACTED)
    expect(JSON.stringify(out.data)).not.toContain('abcdef1234567890')
  })

  it('error message/stack 의 비밀도 마스킹한다', () => {
    const out = redactRecord(
      record({
        error: {
          name: 'Error',
          message: 'request failed: Bearer abcdef1234567890',
          stack: 'Error: token sk-ant-api03-abcdefghijklmnop\n  at x'
        }
      })
    )
    expect(out.error?.message).toContain(REDACTED)
    expect(out.error?.stack).toContain(REDACTED)
    expect(JSON.stringify(out.error)).not.toContain('abcdef1234567890')
  })

  it('마스킹 대상이 없으면 내용을 보존한다', () => {
    const input = record({ message: 'plain', data: { durationMs: 3 } })
    const out = redactRecord(input)
    expect(out.message).toBe('plain')
    expect(out.data).toEqual({ durationMs: 3 })
    expect(out.event).toBe(input.event)
  })
})
