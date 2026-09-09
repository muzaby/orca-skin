import { describe, expect, it } from 'vitest'
import { modelIdentity, sameModelIdentity } from './model-identity'

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
