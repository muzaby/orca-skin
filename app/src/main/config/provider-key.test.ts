import { describe, expect, it } from 'vitest'
import { parseProviderKey, providerKeyOf } from './provider-key'

describe('provider key helpers', () => {
  it('providerKeyOf 는 trim/lowercase 합성 키를 만들고 공백 provider 는 adapter 단독', () => {
    expect(providerKeyOf('claude-code', '  BedRock ')).toBe('claude-code-bedrock')
    expect(providerKeyOf('claude-code', 'anthropic')).toBe('claude-code-anthropic')
    expect(providerKeyOf('claude-code', '   ')).toBe('claude-code')
  })

  it('parseProviderKey 는 알려진 adapter 최장 접두 매칭으로 분해한다 (adapter 자체 하이픈 허용)', () => {
    const adapters = ['claude-code', 'opencode']
    expect(parseProviderKey('claude-code-bedrock', adapters)).toEqual({
      adapter: 'claude-code',
      provider: 'bedrock'
    })
    expect(parseProviderKey('opencode-local', adapters)).toEqual({
      adapter: 'opencode',
      provider: 'local'
    })
    // provider 가 하이픈을 포함해도 나머지 전체가 provider 다.
    expect(parseProviderKey('claude-code-my-gateway', adapters)).toEqual({
      adapter: 'claude-code',
      provider: 'my-gateway'
    })
  })

  it('parseProviderKey 는 adapter 단독 키와 미지/공백 키를 구분한다', () => {
    const adapters = ['claude-code']
    expect(parseProviderKey('claude-code', adapters)).toEqual({ adapter: 'claude-code' })
    expect(parseProviderKey('unknown-bedrock', adapters)).toBeUndefined()
    expect(parseProviderKey(null, adapters)).toBeUndefined()
    expect(parseProviderKey('', adapters)).toBeUndefined()
    // 빈 provider 조각('claude-code-')은 매칭 실패로 undefined.
    expect(parseProviderKey('claude-code-', adapters)).toBeUndefined()
  })
})
