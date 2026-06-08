import { describe, it, expect } from 'vitest'
import { contextWindowFor, DEFAULT_CONTEXT_WINDOW } from './contextWindow'

describe('contextWindowFor', () => {
  it("모델명에 '1m' 이 포함되면 1M", () => {
    expect(contextWindowFor('claude-sonnet-4-5-1m')).toBe(1_000_000)
    expect(contextWindowFor('claude-opus-4-1M-20251101')).toBe(1_000_000) // 대소문자 무관
  })

  it('그 외 모델은 기본 200k', () => {
    expect(contextWindowFor('claude-opus-4-5')).toBe(DEFAULT_CONTEXT_WINDOW)
    expect(contextWindowFor('claude-haiku-4-5')).toBe(200_000)
  })

  it('모델 미지정이면 기본 200k', () => {
    expect(contextWindowFor()).toBe(200_000)
    expect(contextWindowFor(undefined)).toBe(200_000)
  })
})
