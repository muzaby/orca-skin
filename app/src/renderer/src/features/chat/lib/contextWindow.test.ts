import { describe, it, expect } from 'vitest'
import {
  contextWindowFor,
  DEFAULT_CONTEXT_WINDOW,
  AUTOCOMPACT_BUFFER,
  nearCompaction
} from './contextWindow'

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

describe('nearCompaction', () => {
  const window = DEFAULT_CONTEXT_WINDOW // 200k
  const effectiveLimit = window - AUTOCOMPACT_BUFFER // 167k
  const threshold = effectiveLimit * 0.835 // ≈ 139.4k

  it('임계 직전이면 false', () => {
    expect(nearCompaction(Math.floor(threshold) - 1, window)).toBe(false)
  })

  it('임계 직후/도달이면 true', () => {
    expect(nearCompaction(Math.ceil(threshold), window)).toBe(true)
    expect(nearCompaction(effectiveLimit, window)).toBe(true)
    expect(nearCompaction(window, window)).toBe(true)
  })

  it('윈도우가 버퍼 이하면(유효 한계 ≤ 0) false 가드', () => {
    expect(nearCompaction(0, AUTOCOMPACT_BUFFER)).toBe(false)
    expect(nearCompaction(100_000, AUTOCOMPACT_BUFFER - 1)).toBe(false)
  })

  it('used 0 이면 false', () => {
    expect(nearCompaction(0, window)).toBe(false)
  })
})
