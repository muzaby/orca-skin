import { describe, it, expect } from 'vitest'
import { contextTokens } from './telemetry'

describe('contextTokens', () => {
  it('입력+캐시(read·creation)+출력을 합산한다', () => {
    expect(
      contextTokens({
        inputTokens: 100,
        cacheReadTokens: 1000,
        cacheCreationTokens: 200,
        outputTokens: 50
      })
    ).toBe(1350)
  })

  it('누락 필드는 0 으로 graceful 합산한다', () => {
    expect(contextTokens({ inputTokens: 100 })).toBe(100)
    expect(contextTokens({})).toBe(0)
    expect(contextTokens({ cacheReadTokens: 500, outputTokens: 25 })).toBe(525)
  })
})
