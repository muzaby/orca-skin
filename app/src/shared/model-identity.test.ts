import { describe, expect, it } from 'vitest'
import {
  modelIdentity,
  sameModelIdentity,
  supportsAutoPermission,
  parseClaudeModelName
} from './model-identity'

describe('0246 AC5 — shared Claude name parser', () => {
  it.each([
    'claude-opus-5-5',
    'opus-5.5',
    'Opus 5.5',
    'us.anthropic.claude-opus-5-5-v1:0',
    'claude-opus-5-5[1m]'
  ])('reads opus 5.5 in %s', (model) => {
    expect(parseClaudeModelName(model)).toEqual({ family: 'opus', version: { major: 5, minor: 5 } })
  })
  it('reads a version before the family token', () => {
    expect(parseClaudeModelName('claude-3-5-sonnet')).toEqual({
      family: 'sonnet',
      version: { major: 3, minor: 5 }
    })
  })
  it('excludes a date from the minor version', () => {
    expect(parseClaudeModelName('claude-opus-4-20250514')).toEqual({
      family: 'opus',
      version: { major: 4, minor: 0 }
    })
  })
  it('keeps versionless families distinct from custom names', () => {
    expect(parseClaudeModelName('opus')).toEqual({ family: 'opus' })
    expect(parseClaudeModelName('myopus-5.5')).toBeUndefined()
    expect(parseClaudeModelName('gpt-5.5')).toBeUndefined()
  })
})

describe('Claude Code model name variants', () => {
  it.each([
    'claudecode-sonnet-5',
    'claudecode-opus-4.8',
    'claudecode-opus-4.8[1m]',
    'claudecode-opus-4-8[1m]'
  ])('accepts explicit supported version %s without changing identity', (model) => {
    expect(supportsAutoPermission(model)).toBe(true)
    expect(modelIdentity({ model, alias: 'claude', oneMillionContext: false })).toBe(model)
  })
  it.each([
    'claudecode-opus-4.5',
    'claudecode-opus-4-5[1m]',
    'claudecode-4',
    'claudecode-4\n8[1m]',
    'custom-claudecode-sonnet-5',
    'claudecode-unknown-5',
    'claudecode-opus4.8extra'
  ])('excludes unsupported or malformed name %s', (model) =>
    expect(supportsAutoPermission(model)).toBe(false)
  )
})

describe('r6 Claude family and dotted/hyphenated version', () => {
  for (const family of ['haiku', 'sonnet', 'opus', 'fable']) {
    it.each(['4.6', '4-6', '5', '4.6[1m]', '4-6-20260909'])(
      `${family} %s supports auto`,
      (version) => {
        expect(supportsAutoPermission(`claude-${family}-${version}`)).toBe(true)
      }
    )
    it.each(['4.5', '4-5', '4', '4.1', '4-20250514'])(`${family} %s excludes auto`, (version) => {
      expect(supportsAutoPermission(`claude-${family}-${version}`)).toBe(false)
    })
  }
  it.each([
    'custom-fable-4.6',
    'claude-unknown-4.6',
    'claude-fable-4.6-extra',
    'claude-fable-4.6.1'
  ])('rejects unconfirmed name %s', (name) => {
    expect(supportsAutoPermission(name)).toBe(false)
  })
})

// 0215 VP-15 (MD-03 ↔ UT) — 식별자·계열 판정의 단일 규칙.
describe('modelIdentity — 선택 식별자 = SDK 모델 문자열 (AT-09)', () => {
  it('1M 변형과 기본 변형이 서로 다른 식별자를 갖는다', () => {
    const base = { alias: 'sonnet', model: 'claude-sonnet-4-6', oneMillionContext: false }
    const oneM = { alias: 'sonnet', model: 'claude-sonnet-4-6', oneMillionContext: true }
    expect(modelIdentity(base)).toBe('claude-sonnet-4-6')
    expect(modelIdentity(oneM)).toBe('claude-sonnet-4-6[1m]')
    expect(sameModelIdentity(base, oneM)).toBe(false)
    // 양성 짝 — 같은 두 항목은 같다.
    expect(sameModelIdentity(base, { ...base })).toBe(true)
  })

  it('model 이 null 이면 bare alias 를 쓴다 — 모델명을 추측하지 않는다', () => {
    expect(modelIdentity({ alias: 'haiku', model: null, oneMillionContext: false })).toBe('haiku')
    expect(modelIdentity({ alias: 'opus', model: null, oneMillionContext: true })).toBe('opus[1m]')
  })
})
