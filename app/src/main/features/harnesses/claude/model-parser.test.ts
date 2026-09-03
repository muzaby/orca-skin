import { describe, expect, it } from 'vitest'
import { parseClaudeModels, type ParsedModel } from './model-parser'
import { normalizeAvailableModels } from './available-models'

function byAlias(models: ParsedModel[]): Record<string, ParsedModel> {
  return Object.fromEntries(models.map((m) => [m.alias, m]))
}

function defaults(models: ParsedModel[]): string[] {
  return models.filter((m) => m.isDefault).map((m) => m.alias)
}

describe('parseClaudeModels — 노출 + default 불변식', () => {
  it('settings와 runtime 배열에 공유 default 규칙을 적용한다', () => {
    const availableModels = ['claude-opus-4-1', 'claude-sonnet-4-5', 'claude-haiku-3-5']
    const settings = parseClaudeModels({ availableModels })
    const runtime = normalizeAvailableModels(availableModels)

    expect(settings.find((model) => model.isDefault)?.model).toBe('claude-sonnet-4-5')
    expect(runtime.find((model) => model.isDefault)?.model).toBe('claude-sonnet-4-5')
  })
  it('env family 모델을 먼저 구성하고 availableModels를 모두 뒤에 추가한다', () => {
    const models = parseClaudeModels({
      availableModels: ['claude-sonnet-corp', 'orca-private-v1'],
      env: { ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-default' }
    })
    expect(models).toEqual([
      expect.objectContaining({ alias: 'opus', model: 'claude-opus-default' }),
      expect.objectContaining({ alias: 'sonnet', model: 'claude-sonnet-corp' }),
      expect.objectContaining({ alias: 'custom', model: 'orca-private-v1' })
    ])
  })

  it('env 기본 모델이 같은 family의 discovery 모델보다 default 우선권을 유지한다', () => {
    const models = parseClaudeModels({
      env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-env' },
      availableModels: ['claude-sonnet-first', 'claude-sonnet-last']
    })
    expect(models.map((model) => model.model)).toEqual([
      'claude-sonnet-env',
      'claude-sonnet-first',
      'claude-sonnet-last'
    ])
    expect(models.find((model) => model.isDefault)?.model).toBe('claude-sonnet-env')
  })
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
      isCustom: false,
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

  it('명시 모델의 [1m] 은 별개 항목이다 — base 항목이 default 를 가져가지 않는다 (0215 D-008)', () => {
    const models = parseClaudeModels({
      env: {
        ANTHROPIC_MODEL: 'claude-opus-4-6[1m]',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6'
      }
    })
    expect(defaults(models)).toEqual(['opus'])
    // 1M 을 지정했으므로 default 는 **1M 항목**이다. base 항목이 가져가면 1M 이 조용히 사라진다.
    const chosen = models.find((m) => m.isDefault)
    expect(chosen).toMatchObject({ model: 'claude-opus-4-6', oneMillionContext: true })
  })

  it('불변식 — env-only 노출 length 1~3, isDefault 정확히 1, family 설정은 model을 보존', () => {
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
      expect(models.every((m) => m.alias !== 'custom')).toBe(true)
    }
  })
})

// 0215 VP-05·VP-08 — settings 경로의 두 축: ANTHROPIC_MODEL 편입 · 교차 필터의 1M 축.
describe('parseClaudeModels — ANTHROPIC_MODEL 편입 (AT-05·AT-06 · D-005·D-006)', () => {
  it('AT-05 — env.ANTHROPIC_MODEL 이 노출 목록에 나타나고 default 가 된다', () => {
    const models = parseClaudeModels({ env: { ANTHROPIC_MODEL: 'corp-x' } })
    expect(models.map((m) => m.model)).toEqual([null, null, null, 'corp-x'])
    expect(models.find((m) => m.isDefault)?.model).toBe('corp-x')
  })

  it('AT-06 — availableModels 와 중복이면 항목 수가 늘지 않는다', () => {
    const models = parseClaudeModels({
      availableModels: ['corp-a', 'corp-x'],
      env: { ANTHROPIC_MODEL: 'corp-x' }
    })
    expect(models.map((m) => m.model)).toEqual(['corp-a', 'corp-x'])
    expect(models.find((m) => m.isDefault)?.model).toBe('corp-x')
  })

  it('env family 와 중복이어도 늘지 않는다', () => {
    const models = parseClaudeModels({
      env: { ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6', ANTHROPIC_MODEL: 'claude-opus-4-6' }
    })
    expect(models.map((m) => m.model)).toEqual(['claude-opus-4-6'])
  })

  it('D-006 — top-level `model` 은 목록에 넣지 않는다 (default 선정 전용)', () => {
    const models = parseClaudeModels({ model: 'corp-y' })
    expect(models.map((m) => m.model)).toEqual([null, null, null])
    // 목록 안에서 매칭되지 않으므로 alias 폴백이 default 를 잡는다.
    expect(defaults(models)).toEqual(['sonnet'])
  })

  it('AT-15 — 어떤 조합에서도 default 는 정확히 1개다', () => {
    for (const settings of [
      { env: { ANTHROPIC_MODEL: 'corp-x' } },
      { availableModels: ['a', 'a[1m]'], env: { ANTHROPIC_MODEL: 'a[1m]' } },
      { env: { ANTHROPIC_DEFAULT_HAIKU_MODEL: 'h', ANTHROPIC_MODEL: 'corp-x' } }
    ]) {
      expect(parseClaudeModels(settings).filter((m) => m.isDefault)).toHaveLength(1)
    }
  })
})

describe('parseClaudeModels — env family ↔ discovery 교차 필터 (AT-22 · D-008)', () => {
  it('AT-22 — env family `X` + availableModels `X[1m]` 이면 두 항목 모두 노출된다', () => {
    const models = parseClaudeModels({
      env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6' },
      availableModels: ['claude-sonnet-4-6[1m]']
    })
    expect(models).toHaveLength(2)
    expect(models.map((m) => m.oneMillionContext)).toEqual([false, true])
  })

  it('음성 짝 — 1M 축까지 같으면 여전히 1개다', () => {
    const models = parseClaudeModels({
      env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6' },
      availableModels: ['claude-sonnet-4-6']
    })
    expect(models).toHaveLength(1)
  })
})
