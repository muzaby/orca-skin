import { describe, expect, it } from 'vitest'
import { classifyOpenCodeError, openCodePreparationError } from './errors'

describe('OpenCode 1.x provider errors', () => {
  it('keeps the shared transport root cause when directory preparation is interrupted', () => {
    const root = openCodePreparationError('events', new Error('SSE failed: 503 secret body'))
    expect(openCodePreparationError('project', root).message).toContain('HTTP 503')
    expect(openCodePreparationError('commands', root).message).toContain('HTTP 503')
    expect(
      openCodePreparationError('project', new DOMException('private', 'TimeoutError')).message
    ).toContain('프로젝트 준비 시간이 초과')
  })
  it.each([
    ['commands', new DOMException('secret timeout', 'TimeoutError'), '명령 목록 준비 시간이 초과'],
    [
      'events',
      new DOMException('secret timeout', 'TimeoutError'),
      '이벤트 스트림 연결 시간이 초과'
    ],
    ['events', new Error('SSE failed: 401 secret status text'), 'HTTP 401'],
    ['events', new Error('SSE failed: 503 secret status text'), 'HTTP 503'],
    ['events', undefined, '스트림이 종료'],
    ['events', new TypeError('secret URL'), '이벤트 스트림 연결에 실패'],
    ['commands', new Error('secret body'), '명령 목록 준비에 실패']
  ] as const)('sanitizes %s preparation errors', (stage, error, message) => {
    const safe = openCodePreparationError(stage, error)
    expect(safe.message).toContain(message)
    expect(safe.message).not.toContain('secret')
    expect(safe.cause).toBeUndefined()
    expect(classifyOpenCodeError(safe, 'provider_connection_error').message).toBe(safe.message)
  })

  it.each([
    ['ProviderAuthError', undefined, 'auth_error'],
    ['APIError', 401, 'auth_error'],
    ['APIError', 403, 'permission_denied'],
    ['APIError', 429, 'provider_connection_error'],
    ['ContextOverflowError', undefined, 'stream_error'],
    ['UnknownError', undefined, 'stream_error']
  ])('classifies %s/%s without exposing provider data', (name, statusCode, category) => {
    const result = classifyOpenCodeError({
      name,
      data: {
        message: 'secret-prompt',
        statusCode,
        responseBody: 'secret-key',
        responseHeaders: { Authorization: 'secret-header' }
      }
    })
    expect(result).toMatchObject({ category, provider: 'opencode', retryable: false })
    expect(JSON.stringify(result)).not.toContain('secret-')
    expect(result).not.toHaveProperty('cause')
  })

  it('recognizes a FreeTierError body independently of the provider message wording', () => {
    expect(
      classifyOpenCodeError({
        name: 'APIError',
        data: {
          statusCode: 403,
          message: 'Forbidden',
          responseBody: JSON.stringify({
            error: {
              type: 'FreeTierError',
              message: "OpenCode's free tier can only be used from within OpenCode."
            }
          })
        }
      }).message
    ).toContain('OpenCode 무료 모델')
  })

  it('uses the SDK HTTP status with an unrecognized body without exposing Error.message', () => {
    const error = new Error('secret-http-body', { cause: { status: 401, body: 'secret-body' } })
    const result = classifyOpenCodeError(error, 'provider_connection_error')
    expect(result.category).toBe('auth_error')
    expect(JSON.stringify(result)).not.toContain('secret-')
  })
})
