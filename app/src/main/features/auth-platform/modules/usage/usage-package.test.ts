import { describe, expect, it } from 'vitest'
import { AuthRegistry } from '../../registry'
import { AUTH_METHODS } from '../../methods'
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
    // 인증 방식은 **내장 목록**이 준다 (0178) — 패키지가 만들지 않는다.
    expect(registry.registerMethods(AUTH_METHODS)).toEqual([])
    const errors = registry.register(pkg)

    expect(errors).toEqual([])
    expect(registry.validateCrossReferences()).toEqual([])
    expect(
      registry
        .listConnectors()
        .map((c) => c.descriptor.id)
        .sort()
    ).toEqual(['usage-corp', 'usage-lab'])
  })

  it('기본 설정은 connector 0개다 — 내장 인증 방식만 남는다', () => {
    expect(USAGE_CONNECTORS).toEqual([])

    const pkg = createUsageConnectorPackage(USAGE_CONNECTORS)
    const registry = new AuthRegistry()
    // 인증 방식은 **내장 목록**이 준다 (0178) — 패키지가 만들지 않는다.
    expect(registry.registerMethods(AUTH_METHODS)).toEqual([])
    const errors = registry.register(pkg)

    expect(errors).toEqual([])
    expect(registry.listConnectors()).toEqual([])
    // `targets:['application']` 을 하나라도 선언하면 prod 앱 로그인 게이트가 켜진다(0164 D1).
    expect(registry.methodsForTarget('application')).toEqual([])
    expect(registry.methodsForTarget('connector').length).toBe(AUTH_METHODS.length)
  })
})
