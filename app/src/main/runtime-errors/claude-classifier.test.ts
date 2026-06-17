import { describe, it, expect } from 'vitest'
import { claudeErrorClassifier, errorEvent } from './claude-classifier'
import { sanitizeCause, makeClassifiedError } from './classifier'

const ctx = { provider: 'claude' as const, phase: 'sendMessage' }

describe('claudeErrorClassifier.classify', () => {
  it('401/unauthorized/OAuth/expired → auth_error (안내 문구 + retryable false)', () => {
    for (const m of ['401 Unauthorized', 'OAuth token invalid', 'session expired']) {
      const c = claudeErrorClassifier.classify(new Error(m), ctx)
      expect(c.category).toBe('auth_error')
      expect(c.message).toBe('Claude Code 인증이 만료되었습니다.')
      expect(c.retryable).toBe(false)
      expect(c.provider).toBe('claude')
    }
  })

  it('ENOENT/spawn/not found → provider_connection_error (retryable true)', () => {
    for (const m of ['spawn claude ENOENT', 'spawn failed', 'binary not found']) {
      const c = claudeErrorClassifier.classify(new Error(m), ctx)
      expect(c.category).toBe('provider_connection_error')
      expect(c.retryable).toBe(true)
    }
  })

  it('일반 오류 → stream_error (원문 보존 + retryable true)', () => {
    const c = claudeErrorClassifier.classify(new Error('boom'), ctx)
    expect(c.category).toBe('stream_error')
    expect(c.message).toBe('boom')
    expect(c.retryable).toBe(true)
  })

  it('abort/AbortError/cancelled → user_cancelled (seam — 어댑터는 emit 안 함)', () => {
    const abortErr = new Error('The operation was aborted')
    abortErr.name = 'AbortError'
    expect(claudeErrorClassifier.classify(abortErr, ctx).category).toBe('user_cancelled')
    expect(claudeErrorClassifier.classify(new Error('request cancelled'), ctx).category).toBe(
      'user_cancelled'
    )
    // 취소는 인증 패턴보다 먼저 매칭돼야 한다(취소가 우선).
    expect(claudeErrorClassifier.classify(new Error('aborted: 401'), ctx).category).toBe(
      'user_cancelled'
    )
  })

  it('비-Error 값도 문자열화해 분류한다', () => {
    expect(claudeErrorClassifier.classify('401 boom', ctx).category).toBe('auth_error')
    expect(claudeErrorClassifier.classify('plain string', ctx).category).toBe('stream_error')
  })

  it('cause 는 IPC 안전값으로 평탄화된다 (Error → {name, message})', () => {
    const err = new Error('boom')
    const c = claudeErrorClassifier.classify(err, ctx)
    expect(c.cause).toEqual({ name: 'Error', message: 'boom' })
    // structuredClone 안전성: throw 없이 복제 가능해야 한다.
    expect(() => structuredClone(c)).not.toThrow()
  })
})

describe('errorEvent', () => {
  it('sessionId 가 있으면 envelope 에 포함', () => {
    const e = makeClassifiedError('stream_error', 'x', { provider: 'claude' })
    expect(errorEvent(e, 's1')).toEqual({
      type: 'error',
      sessionId: 's1',
      error: e
    })
  })

  it("sessionId 가 '' 이면 생략", () => {
    const e = makeClassifiedError('stream_error', 'x')
    const ev = errorEvent(e, '')
    expect(ev).toEqual({ type: 'error', error: e })
    expect('sessionId' in ev).toBe(false)
  })
})

describe('makeClassifiedError / sanitizeCause', () => {
  it('category 기본 retryable 매핑 (connection/stream=true, 그 외=false)', () => {
    expect(makeClassifiedError('provider_connection_error', 'x').retryable).toBe(true)
    expect(makeClassifiedError('stream_error', 'x').retryable).toBe(true)
    expect(makeClassifiedError('auth_error', 'x').retryable).toBe(false)
    expect(makeClassifiedError('schema_validation_error', 'x').retryable).toBe(false)
    expect(makeClassifiedError('user_cancelled', 'x').retryable).toBe(false)
  })

  it('opts.retryable 로 기본값을 override', () => {
    expect(makeClassifiedError('schema_validation_error', 'x', { retryable: true }).retryable).toBe(
      true
    )
    expect(
      makeClassifiedError('provider_connection_error', 'x', { retryable: false }).retryable
    ).toBe(false)
  })

  it('provider/cause 부재 시 키 자체를 생략', () => {
    const e = makeClassifiedError('stream_error', 'x')
    expect('provider' in e).toBe(false)
    expect('cause' in e).toBe(false)
  })

  it('sanitizeCause: Error → 평탄화, 원시값 보존, 함수 → 문자열, 객체 → JSON round-trip', () => {
    expect(sanitizeCause(new TypeError('t'))).toEqual({ name: 'TypeError', message: 't' })
    expect(sanitizeCause('s')).toBe('s')
    expect(sanitizeCause(42)).toBe(42)
    expect(sanitizeCause(null)).toBe(null)
    expect(typeof sanitizeCause(() => {})).toBe('string')
    // 함수를 품은 객체는 JSON round-trip 으로 함수가 떨어져 나간다.
    const cleaned = sanitizeCause({ a: 1, fn: () => {} }) as Record<string, unknown>
    expect(cleaned).toEqual({ a: 1 })
    expect(() => structuredClone(cleaned)).not.toThrow()
  })
})
