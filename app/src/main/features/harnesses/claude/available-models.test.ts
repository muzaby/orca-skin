import { describe, expect, it } from 'vitest'
import {
  availableModelsOf,
  explicitModelOf,
  normalizeAvailableModels,
  withExplicitModel
} from './available-models'

describe('availableModels exact contract', () => {
  it('accepts only the exact camelCase string array field', () => {
    expect(availableModelsOf({ availableModels: [' a '] })).toEqual([' a '])
    expect(availableModelsOf({ AvailableModels: ['a'] })).toBeUndefined()
    expect(availableModelsOf({ availableModels: 'a' })).toBeUndefined()
    expect(availableModelsOf({ availableModels: ['a', 1] })).toBeUndefined()
  })

  it('classifies families and preserves a custom name as its self alias/model', () => {
    expect(
      normalizeAvailableModels(['Claude-SONNET-4', 'x-opus-y', 'haiku-next', 'corp/model-v1'])
    ).toEqual([
      expect.objectContaining({ alias: 'sonnet', model: 'Claude-SONNET-4', isDefault: true }),
      expect.objectContaining({ alias: 'opus', model: 'x-opus-y', isDefault: false }),
      expect.objectContaining({ alias: 'haiku', model: 'haiku-next', isDefault: false }),
      expect.objectContaining({ alias: 'custom', model: 'corp/model-v1', isCustom: true })
    ])
  })

  it('trims empties, keeps every distinct family model, and deduplicates exact names', () => {
    expect(
      normalizeAvailableModels([' ', 'sonnet-a', 'sonnet-b', 'private-v1', 'private-v1'])
    ).toEqual([
      expect.objectContaining({ alias: 'sonnet', model: 'sonnet-a' }),
      expect.objectContaining({ alias: 'sonnet', model: 'sonnet-b' }),
      expect.objectContaining({ alias: 'custom', model: 'private-v1' })
    ])
  })

  it('normalizes the [1m] suffix consistently with env-configured models', () => {
    expect(normalizeAvailableModels(['claude-sonnet-4-6[1m]'])).toEqual([
      expect.objectContaining({
        alias: 'sonnet',
        model: 'claude-sonnet-4-6',
        oneMillionContext: true
      })
    ])
  })

  it('uses the first item when every discovered model is custom', () => {
    expect(normalizeAvailableModels(['corp-a', 'corp-b'])).toEqual([
      expect.objectContaining({ model: 'corp-a', isDefault: true }),
      expect.objectContaining({ model: 'corp-b', isDefault: false })
    ])
  })
})

// 0215 VP-08·VP-11 — dedupe 축은 (모델명, 1M) 한 쌍이다.
describe('normalizeAvailableModels — [1m] 변형 (AT-08 · D-008)', () => {
  it('AT-08 — `X` 와 `X[1m]` 이 모두 있으면 두 항목 모두 남는다', () => {
    const models = normalizeAvailableModels(['claude-sonnet-4-6', 'claude-sonnet-4-6[1m]'])
    expect(models).toHaveLength(2)
    expect(models.map((m) => m.oneMillionContext)).toEqual([false, true])
    // 두 항목의 model 은 같다 — 구분은 1M 축이 한다.
    expect(new Set(models.map((m) => m.model))).toEqual(new Set(['claude-sonnet-4-6']))
  })

  it('순서가 바뀌어도 같다 — 뒤에 온 쪽이 버려지지 않는다', () => {
    const models = normalizeAvailableModels(['claude-sonnet-4-6[1m]', 'claude-sonnet-4-6'])
    expect(models.map((m) => m.oneMillionContext)).toEqual([true, false])
  })

  it('음성 짝 — 완전히 같은 항목은 여전히 1개다', () => {
    expect(normalizeAvailableModels(['x[1m]', 'x[1m]'])).toHaveLength(1)
    expect(normalizeAvailableModels(['x', 'x'])).toHaveLength(1)
  })
})

describe('withExplicitModel — 명시 모델 편입 (AT-05·AT-06 · D-005)', () => {
  const list = (raw: string[]): string[] =>
    withExplicitModel(normalizeAvailableModels(raw), explicitModelOf('claude-sonnet-4-6')).map(
      (m) => `${m.model}${m.oneMillionContext ? '[1m]' : ''}`
    )

  it('AT-05 — 목록에 없으면 뒤에 더한다', () => {
    expect(list(['corp-a'])).toEqual(['corp-a', 'claude-sonnet-4-6'])
  })

  it('AT-06 — 이미 있으면 더하지 않는다', () => {
    expect(list(['claude-sonnet-4-6'])).toEqual(['claude-sonnet-4-6'])
  })

  it('1M 축이 다르면 다른 항목이다 — base 이름이 같아도 더한다', () => {
    expect(list(['claude-sonnet-4-6[1m]'])).toEqual(['claude-sonnet-4-6[1m]', 'claude-sonnet-4-6'])
  })

  it('bare alias 로 지정하면 그 alias 항목과 중복으로 본다', () => {
    const models = withExplicitModel(
      normalizeAvailableModels(['claude-sonnet-4-6']),
      explicitModelOf('sonnet')
    )
    expect(models).toHaveLength(1)
  })

  it('명시가 없으면 배열이 그대로다 — 음성 짝', () => {
    const base = normalizeAvailableModels(['corp-a'])
    expect(withExplicitModel(base, explicitModelOf(undefined))).toBe(base)
    expect(withExplicitModel(base, explicitModelOf('   '))).toBe(base)
  })
})
