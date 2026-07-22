import { describe, it, expect } from 'vitest'
import {
  contextWindowFor,
  contextWindowOf,
  DEFAULT_CONTEXT_WINDOW,
  AUTOCOMPACT_BUFFER,
  nearCompaction
} from './contextWindow'

describe('contextWindowFor (폴백 휴리스틱)', () => {
  it("모델명에 '1m' 이 포함되면 1M (기존 휴리스틱 유지)", () => {
    expect(contextWindowFor('claude-sonnet-4-5-1m')).toBe(1_000_000)
    expect(contextWindowFor('claude-opus-4-1M-20251101')).toBe(1_000_000) // 대소문자 무관
  })

  it('1M 컨텍스트 현행 모델 패밀리는 1M (0134)', () => {
    expect(contextWindowFor('claude-sonnet-5')).toBe(1_000_000)
    expect(contextWindowFor('claude-sonnet-4-6')).toBe(1_000_000)
    expect(contextWindowFor('claude-opus-4-6')).toBe(1_000_000)
    expect(contextWindowFor('claude-opus-4-7')).toBe(1_000_000)
    expect(contextWindowFor('claude-opus-4-8')).toBe(1_000_000)
    expect(contextWindowFor('claude-fable-5')).toBe(1_000_000)
    // 프리픽스/스냅샷 변형(bedrock 등)도 부분 문자열 매칭으로 커버
    expect(contextWindowFor('us.anthropic.claude-sonnet-5')).toBe(1_000_000)
  })

  it('200k 모델·구형·미지 모델은 기본 200k', () => {
    expect(contextWindowFor('claude-haiku-4-5')).toBe(200_000)
    expect(contextWindowFor('claude-opus-4-5')).toBe(DEFAULT_CONTEXT_WINDOW)
    // 'sonnet-4-5' 는 'sonnet-5' 마커와 부분 문자열 오탐이 없어야 한다
    expect(contextWindowFor('claude-sonnet-4-5-20250929')).toBe(200_000)
    expect(contextWindowFor('mock-sonnet')).toBe(200_000)
    expect(contextWindowFor('unknown-model')).toBe(200_000)
  })

  it('모델 미지정이면 기본 200k', () => {
    expect(contextWindowFor()).toBe(200_000)
    expect(contextWindowFor(undefined)).toBe(200_000)
  })
})

describe('contextWindowOf (분모 단일 진입점, 0134)', () => {
  it('① top-level contextWindow 실측을 최우선', () => {
    expect(contextWindowOf({ model: 'claude-haiku-4-5', contextWindow: 500_000 })).toBe(500_000)
  })

  it('② top-level 부재 시 modelUsage[model].contextWindow', () => {
    expect(
      contextWindowOf({
        model: 'claude-haiku-4-5',
        modelUsage: { 'claude-haiku-4-5': { contextWindow: 200_000 } }
      })
    ).toBe(200_000)
  })

  it('③ 실측 부재(복원 경로)면 모델명 휴리스틱 폴백', () => {
    expect(contextWindowOf({ model: 'claude-sonnet-5' })).toBe(1_000_000)
    expect(contextWindowOf({ model: 'claude-haiku-4-5' })).toBe(200_000)
    expect(contextWindowOf({})).toBe(DEFAULT_CONTEXT_WINDOW)
  })

  it('실측 0/음수는 무시하고 폴백 (비정상 가드)', () => {
    expect(contextWindowOf({ model: 'claude-sonnet-5', contextWindow: 0 })).toBe(1_000_000)
    expect(contextWindowOf({ model: 'claude-haiku-4-5', contextWindow: -1 })).toBe(200_000)
  })

  // 0141 이후 멀티모델 턴도 claude-map 이 실사용량 최대 모델(argmax)을 top-level(model+contextWindow)로
  // 항상 승격하므로, 아래처럼 top-level 이 *부재* 한 입력은 복원/비정상 경로에서만 발생한다. 그 경우
  // 어느 모델이 메인인지 알 수 없어 폴백 기본값으로 내려가는 것이 옳다(renderer 방어).
  it('top-level model 부재 + modelUsage 다중(복원/비정상)은 폴백 기본값', () => {
    expect(
      contextWindowOf({
        modelUsage: {
          'claude-sonnet-5': { contextWindow: 1_000_000 },
          'claude-haiku-4-5': { contextWindow: 200_000 }
        }
      })
    ).toBe(DEFAULT_CONTEXT_WINDOW)
  })

  it('멀티모델이라도 top-level model 이 채워지면(0139 승격) 그 모델 window 를 쓴다', () => {
    expect(
      contextWindowOf({
        model: 'claude-sonnet-5',
        contextWindow: 1_000_000,
        modelUsage: {
          'claude-sonnet-5': { contextWindow: 1_000_000 },
          'claude-haiku-4-5': { contextWindow: 200_000 }
        }
      })
    ).toBe(1_000_000)
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
