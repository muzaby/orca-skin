import { describe, expect, it } from 'vitest'
import { classifyOpenCodeError } from './errors'

describe('OpenCode 1.x provider errors', () => {
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
