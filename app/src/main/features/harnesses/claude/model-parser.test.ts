import { describe, expect, it } from 'vitest'
import { parseClaudeModels, type ParsedModel } from './model-parser'

function byAlias(models: ParsedModel[]): Record<string, ParsedModel> {
  return Object.fromEntries(models.map((m) => [m.alias, m]))
}

function defaults(models: ParsedModel[]): string[] {
  return models.filter((m) => m.isDefault).map((m) => m.alias)
}

describe('parseClaudeModels — 노출 + default 불변식', () => {
  it('빈 설정 → 3개 alias 노출, model null, sonnet default', () => {
    const models = parseClaudeModels({})
    expect(models.map((m) => m.alias)).toEqual(['sonnet', 'opus', 'haiku'])
    expect(models.every((m) => m.model === null && !m.isCustom && !m.oneMillionContext)).toBe(true)
    expect(defaults(models)).toEqual(['sonnet'])
  })

  it('env 블록만 있고 모델 키 전무 → 3개 alias 노출, sonnet default', () => {
    const models = parseClaudeModels({ env: { OTHER: 'x' } })
    expect(models.map((m) => m.alias)).toEqual(['sonnet', 'opus', 'haiku'])
    expect(defaults(models)).toEqual(['sonnet'])
  })

  it('명시 model 만(opus, DEFAULT 키 전무) → "설정 없음" 3개 노출, opus default', () => {
    const models = parseClaudeModels({ model: 'opus' })
    expect(models.map((m) => m.alias)).toEqual(['sonnet', 'opus', 'haiku'])
    expect(defaults(models)).toEqual(['opus'])
  })

  it('단일 커스텀(opus) + 명시 없음 → opus 만 노출, opus default', () => {
    const models = parseClaudeModels({
      env: { ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6' }
    })
    expect(models.map((m) => m.alias)).toEqual(['opus'])
    expect(byAlias(models).opus).toMatchObject({
      model: 'claude-opus-4-6',
      isCustom: true,
      oneMillionContext: false,
      isDefault: true
    })
  })

  it('[1m] 접미사 분리 + oneMillionContext 보존', () => {
    const models = parseClaudeModels({
      env: { ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6[1m]' }
    })
    expect(byAlias(models).opus).toMatchObject({
      model: 'claude-opus-4-6',
      oneMillionContext: true
    })
  })

  it('케이스 #4 — model=sonnet + DEFAULT_OPUS 만 → opus 만 노출, default 재선정(opus)', () => {
    const models = parseClaudeModels({
      model: 'sonnet',
      env: { ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6' }
    })
    expect(models.map((m) => m.alias)).toEqual(['opus'])
    expect(defaults(models)).toEqual(['opus'])
  })

  it('케이스 #3 — 명시 alias 가 커스텀 항목과 일치 → 그 커스텀 default', () => {
    const models = parseClaudeModels({
      model: 'opus',
      env: {
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6'
      }
    })
    expect(models.map((m) => m.alias)).toEqual(['sonnet', 'opus'])
    expect(defaults(models)).toEqual(['opus'])
  })

  it('케이스 #8 — 명시 모델명이 커스텀 model 값과 직접 일치 → 그 항목 default', () => {
    const models = parseClaudeModels({
      model: 'claude-opus-4-6',
      env: {
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6'
      }
    })
    expect(defaults(models)).toEqual(['opus'])
  })

  it('케이스 #9 — env.ANTHROPIC_MODEL 이 top-level model 보다 우선', () => {
    const models = parseClaudeModels({
      model: 'opus',
      env: {
        ANTHROPIC_MODEL: 'sonnet',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6'
      }
    })
    expect(defaults(models)).toEqual(['sonnet'])
  })

  it('다중 커스텀 + 명시 없음 → sonnet→haiku→opus 폴백 순서로 default', () => {
    const models = parseClaudeModels({
      env: {
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6'
      }
    })
    expect(models.map((m) => m.alias)).toEqual(['opus', 'haiku'])
    // sonnet 미커스텀 → haiku 가 폴백 1순위.
    expect(defaults(models)).toEqual(['haiku'])
  })

  it('명시 모델의 [1m] 접미사를 스트립한 base 로 매칭', () => {
    const models = parseClaudeModels({
      env: {
        ANTHROPIC_MODEL: 'claude-opus-4-6[1m]',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6'
      }
    })
    expect(defaults(models)).toEqual(['opus'])
  })

  it('불변식 — 노출 length 1~3, isDefault 정확히 1, 비커스텀은 model null', () => {
    for (const settings of [
      {},
      { model: 'haiku' },
      { env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'x' } },
      { env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'x', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'y' } }
    ]) {
      const models = parseClaudeModels(settings)
      expect(models.length).toBeGreaterThanOrEqual(1)
      expect(models.length).toBeLessThanOrEqual(3)
      expect(models.filter((m) => m.isDefault)).toHaveLength(1)
      expect(models.every((m) => m.isCustom || m.model === null)).toBe(true)
    }
  })
})
