import { describe, expect, it } from 'vitest'
import { formatTokens } from './usageFormat'

describe('formatTokens', () => {
  it('0.1M 이상은 백만 단위 소수 1자리', () => {
    expect(formatTokens(190_500_000)).toBe('190.5M')
    expect(formatTokens(1_000_000)).toBe('1.0M')
    expect(formatTokens(100_000)).toBe('0.1M')
  })

  it('0.1M 미만 1천 이상은 천 단위 폴백', () => {
    expect(formatTokens(99_999)).toBe('100.0K')
    expect(formatTokens(42_300)).toBe('42.3K')
    expect(formatTokens(1_000)).toBe('1.0K')
  })

  it('1천 미만은 원시값', () => {
    expect(formatTokens(999)).toBe('999')
    expect(formatTokens(0)).toBe('0')
  })
})
