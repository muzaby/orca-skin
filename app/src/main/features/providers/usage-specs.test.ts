import { describe, expect, it } from 'vitest'
import type { Provider } from '../../contracts/provider'
import { usageProviderKey, usageSpecs } from './usage-specs'

const MAP = (): null => null

function provider(over: Partial<Provider> & Pick<Provider, 'id'>): Provider {
  return {
    label: over.id,
    kind: 'service',
    origin: 'https://gw.example.corp',
    auth: [],
    ...over
  } as Provider
}

describe('usageProviderKey', () => {
  it('llm 좌표에서 파생한다 — 배포가 키를 두 번 적지 않는다', () => {
    const key = usageProviderKey(
      provider({
        id: 'corp-gateway',
        kind: 'llm',
        llm: { adapter: 'claude', provider: 'corp', envKey: 'CORP_TOKEN' },
        usage: { operation: '/api/usage', map: MAP }
      })
    )
    expect(key).toBe('claude-corp')
  })

  it('명시값이 llm 파생보다 우선한다', () => {
    const key = usageProviderKey(
      provider({
        id: 'corp-gateway',
        kind: 'llm',
        llm: { adapter: 'claude', provider: 'corp', envKey: 'CORP_TOKEN' },
        usage: { providerKey: 'claude-anthropic', operation: '/api/usage', map: MAP }
      })
    )
    expect(key).toBe('claude-anthropic')
  })

  it('service provider 는 명시값으로만 대상을 정한다', () => {
    expect(
      usageProviderKey(
        provider({ id: 'portal', usage: { providerKey: 'claude-corp', operation: '/u', map: MAP } })
      )
    ).toBe('claude-corp')
    expect(
      usageProviderKey(provider({ id: 'portal', usage: { operation: '/u', map: MAP } }))
    ).toBeNull()
  })
})

describe('usageSpecs', () => {
  it('usage 를 선언한 provider 만 뽑고 호출 대상은 선언 주체다', () => {
    const result = usageSpecs([
      provider({ id: 'wiki' }),
      provider({
        id: 'portal',
        usage: { providerKey: 'claude-corp', operation: '/api/usage', map: MAP }
      })
    ])
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]).toMatchObject({ providerKey: 'claude-corp', providerId: 'portal' })
    expect(result.rejected).toEqual([])
  })

  it('usage 미선언이면 목록이 비어 있다', () => {
    expect(usageSpecs([provider({ id: 'wiki' })]).entries).toEqual([])
  })

  it('대상을 못 정한 선언은 거부로 돌려준다 — 조용히 버리지 않는다 (0183)', () => {
    const result = usageSpecs([
      provider({ id: 'portal', usage: { operation: '/api/usage', map: MAP } })
    ])
    expect(result.entries).toEqual([])
    expect(result.rejected).toEqual([{ providerId: 'portal', reason: 'no_provider_key' }])
  })

  it('공백만 있는 providerKey 는 명시로 치지 않는다', () => {
    const result = usageSpecs([
      provider({
        id: 'gw',
        kind: 'llm',
        llm: { adapter: 'claude', provider: 'corp', envKey: 'K' },
        usage: { providerKey: '   ', operation: '/api/usage', map: MAP }
      })
    ])
    expect(result.entries[0]?.providerKey).toBe('claude-corp')
  })
})
