import { describe, expect, it } from 'vitest'
import { AuthRegistry } from '../../registry'
import { createUsageConnectorPackage } from './index'
import { USAGE_CONNECTORS } from './servers'
import type { UsageConnectorConfig } from './spec'

function config(id: string, baseUrl: string): UsageConnectorConfig {
  return {
    id,
    label: id,
    baseUrl,
    operations: { quota: { method: 'GET', path: '/v1/quota' } }
  }
}

describe('createUsageConnectorPackage', () => {
  it('서버 2개 설정이 오류 없이 등록된다', () => {
    const pkg = createUsageConnectorPackage([
      config('usage-corp', 'https://llm.corp'),
      config('usage-lab', 'https://llm-lab.corp')
    ])
    const registry = new AuthRegistry()
    const errors = registry.register({
      ...(pkg.providers !== undefined ? { providers: pkg.providers } : {}),
      ...(pkg.connectors !== undefined ? { connectors: pkg.connectors } : {})
    })

    expect(errors).toEqual([])
    expect(registry.validateCrossReferences()).toEqual([])
    expect(
      registry
        .listConnectors()
        .map((c) => c.descriptor.id)
        .sort()
    ).toEqual(['usage-corp', 'usage-lab'])
  })

  it('기본 설정은 connector 0개이고 로그인 게이트를 켜지 않는다', () => {
    expect(USAGE_CONNECTORS).toEqual([])

    const pkg = createUsageConnectorPackage(USAGE_CONNECTORS)
    const registry = new AuthRegistry()
    const errors = registry.register({
      ...(pkg.providers !== undefined ? { providers: pkg.providers } : {})
    })

    expect(errors).toEqual([])
    expect(registry.listConnectors()).toEqual([])
    expect(registry.listProviders().length).toBe(2)
    // `targets:['application']` 을 하나라도 선언하면 prod 앱 로그인 게이트가 켜진다(0164 D1).
    expect(registry.providersForTarget('application')).toEqual([])
    expect(registry.providersForTarget('connector').length).toBe(2)
  })
})
