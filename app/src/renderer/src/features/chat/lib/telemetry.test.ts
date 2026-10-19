import { describe, it, expect } from 'vitest'
import { contextTokens } from './telemetry'

describe('contextTokens', () => {
  it('마지막 스텝의 명시적 컨텍스트 값과 0을 우선하며 구자료는 합산으로 폴백한다', () => {
    const totals = { inputTokens: 100, cacheReadTokens: 200, cacheCreationTokens: 30 }
    expect(contextTokens({ ...totals, contextTokens: 25 })).toBe(25)
    expect(contextTokens({ ...totals, contextTokens: 0 })).toBe(0)
    expect(contextTokens({ ...totals, contextTokens: NaN })).toBe(330)
    expect(contextTokens(totals)).toBe(330)
  })
  it('입력+캐시(read·creation)를 합산하고 출력은 제외한다', () => {
    expect(
      contextTokens({
        inputTokens: 100,
        cacheReadTokens: 1000,
        cacheCreationTokens: 200,
        outputTokens: 50 // 제외
      })
    ).toBe(1300)
  })

  it('누락 필드는 0 으로 graceful 합산한다', () => {
    expect(contextTokens({ inputTokens: 100 })).toBe(100)
    expect(contextTokens({})).toBe(0)
    expect(contextTokens({ cacheReadTokens: 500 })).toBe(500)
  })
})
