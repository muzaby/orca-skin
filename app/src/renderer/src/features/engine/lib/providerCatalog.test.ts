import { describe, expect, it } from 'vitest'
import {
  PROVIDER_OPTIONS,
  providerOption,
  validateProviderName,
  validateSettingsJson
} from './providerCatalog'

describe('validateSettingsJson', () => {
  it('빈 입력은 거부', () => {
    const r = validateSettingsJson('   ')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorKey).toBe('engine.validation.jsonRequired')
  })

  it('파싱 실패는 사유 키(줄/열 params)와 함께 거부', () => {
    const r = validateSettingsJson('{ "env": }')
    expect(r.ok).toBe(false)
    // 위치 검출 여부에 따라 jsonSyntaxAt(줄/열 params) 또는 jsonSyntax(원문 통과).
    if (!r.ok) expect(r.errorKey).toMatch(/^engine\.validation\.jsonSyntax/)
  })

  it('비객체 최상위(배열/원시값)는 거부', () => {
    for (const text of ['[]', '42', 'null']) {
      const r = validateSettingsJson(text)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errorKey).toBe('engine.validation.topLevelObject')
    }
  })

  it('객체 최상위는 통과', () => {
    expect(validateSettingsJson('{ "env": { "A": "1" } }').ok).toBe(true)
  })
})

describe('validateProviderName', () => {
  it('빈 값 거부', () => {
    const r = validateProviderName('')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorKey).toBe('engine.validation.nameRequired')
  })

  it('허용 문자만 통과', () => {
    expect(validateProviderName('my-gateway_1').ok).toBe(true)
    expect(validateProviderName('bad name').ok).toBe(false)
    expect(validateProviderName('한글').ok).toBe(false)
  })
})

describe('provider catalog', () => {
  it('모든 템플릿은 유효한 객체 JSON', () => {
    for (const p of PROVIDER_OPTIONS) {
      expect(validateSettingsJson(p.template).ok).toBe(true)
    }
  })

  it('custom 만 직접 입력 플래그를 갖는다', () => {
    expect(providerOption('custom')?.custom).toBe(true)
    expect(providerOption('anthropic')?.custom).toBe(false)
    expect(providerOption('nope')).toBeUndefined()
  })
})
