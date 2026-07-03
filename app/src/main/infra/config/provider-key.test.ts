import { describe, expect, it } from 'vitest'
import { parseProviderKey, providerKeyOf } from './provider-key'

describe('provider key helpers', () => {
  it('providerKeyOf 는 trim/lowercase 합성 키를 만들고 공백 provider 는 adapter 단독', () => {
    expect(providerKeyOf('claude', '  BedRock ')).toBe('claude-bedrock')
    expect(providerKeyOf('claude', 'anthropic')).toBe('claude-anthropic')
    expect(providerKeyOf('claude', '   ')).toBe('claude')
  })

  it('parseProviderKey 는 알려진 adapter 최장 접두 매칭으로 분해한다 (adapter 자체 하이픈 허용)', () => {
    const adapters = ['claude', 'opencode']
    expect(parseProviderKey('claude-bedrock', adapters)).toEqual({
      adapter: 'claude',
      provider: 'bedrock'
    })
    expect(parseProviderKey('opencode-local', adapters)).toEqual({
      adapter: 'opencode',
      provider: 'local'
    })
    // provider 가 하이픈을 포함해도 나머지 전체가 provider 다.
    expect(parseProviderKey('claude-my-gateway', adapters)).toEqual({
      adapter: 'claude',
      provider: 'my-gateway'
    })
  })

  it('parseProviderKey 는 adapter 단독 키와 미지/공백 키를 구분한다', () => {
    const adapters = ['claude']
    expect(parseProviderKey('claude', adapters)).toEqual({ adapter: 'claude' })
    expect(parseProviderKey('unknown-bedrock', adapters)).toBeUndefined()
    expect(parseProviderKey(null, adapters)).toBeUndefined()
    expect(parseProviderKey('', adapters)).toBeUndefined()
    // 빈 provider 조각('claude-')은 매칭 실패로 undefined.
    expect(parseProviderKey('claude-', adapters)).toBeUndefined()
  })
})
