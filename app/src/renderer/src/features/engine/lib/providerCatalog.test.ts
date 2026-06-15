import { describe, expect, it } from 'vitest'
import {
  PROVIDER_OPTIONS,
  providerOption,
  validateProviderName,
  validateSettingsJson
} from './providerCatalog'

describe('validateSettingsJson', () => {
  it('빈 입력은 거부', () => {
    expect(validateSettingsJson('   ').ok).toBe(false)
  })

  it('파싱 실패는 사유와 함께 거부', () => {
    const r = validateSettingsJson('{ "env": }')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('JSON')
  })

  it('비객체 최상위(배열/원시값)는 거부', () => {
    expect(validateSettingsJson('[]').ok).toBe(false)
    expect(validateSettingsJson('42').ok).toBe(false)
    expect(validateSettingsJson('null').ok).toBe(false)
  })

  it('객체 최상위는 통과', () => {
    expect(validateSettingsJson('{ "env": { "A": "1" } }').ok).toBe(true)
  })
})

describe('validateProviderName', () => {
  it('빈 값 거부', () => {
    expect(validateProviderName('').ok).toBe(false)
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
