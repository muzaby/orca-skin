import { describe, expect, it } from 'vitest'
import { isHaikuModel, modelIdentity, sameModelIdentity } from './model-identity'

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

describe('isHaikuModel — 두 축을 모두 본다 (AT-11 · D-009)', () => {
  it('alias 축 — 이름에 haiku 가 없어도 haiku 계열이면 참이다', () => {
    expect(isHaikuModel({ alias: 'haiku', model: 'corp-fast-1' })).toBe(true)
  })

  it('이름 축 — alias 가 custom 이어도 이름에 haiku 가 있으면 참이다', () => {
    expect(isHaikuModel({ alias: 'custom', model: 'bedrock/anthropic.claude-HAIKU-4-5' })).toBe(
      true
    )
  })

  it('음성 짝 — 어느 축도 아니면 거짓이다', () => {
    expect(isHaikuModel({ alias: 'sonnet', model: 'claude-sonnet-4-6' })).toBe(false)
    expect(isHaikuModel({ alias: 'custom', model: null })).toBe(false)
  })
})
