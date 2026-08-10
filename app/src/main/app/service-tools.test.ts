// AC11 — `service` provider 의 `tools` 가 `RuntimeToolRegistry` 에 왕복 등록된다.
//
// 프로덕션 도달 경로는 `bootstrap` → `RuntimeToolRegistry` → `adapters/claude-runtime-tools.ts`
// → SDK `createSdkMcpServer` 다. 여기서는 그 첫 구간(등록/회수)이 grant 상태를 따라가는지 본다.
//
// **app 레이어에 있는 이유**: 실제 `RuntimeToolRegistry`(features/extensions)와 등록자
// (features/providers)를 함께 물어야 의미가 있는 테스트인데, feature 끼리는 교차 import 가
// 금지돼 있다. 둘을 합치는 것은 컴포지션 루트의 책임이므로 검증도 여기 산다.

import { describe, expect, it, vi } from 'vitest'
import type { RuntimeToolServer } from '../adapters/runtime-tools'
import type { Provider, ProviderApi } from '../contracts/provider'
import type { ProviderGrantStatus } from '../../shared/ipc'
import { RuntimeToolRegistry } from '../features/extensions/runtime-tool-registry'
import { ServiceToolRegistrar } from '../features/providers/service'

const api = {
  request: vi.fn(),
  materialize: vi.fn(),
  token: vi.fn()
} as unknown as ProviderApi

function toolServer(providerId: string): RuntimeToolServer {
  return {
    descriptor: {
      id: `${providerId}-tools`,
      connectorId: providerId,
      tools: [{ name: `${providerId}_search`, description: '검색' }]
    },
    implementations: [
      { name: `${providerId}_search`, inputSchema: {}, handler: async () => ({ content: [] }) }
    ]
  }
}

function wiki(): Provider {
  return {
    id: 'wiki',
    label: 'Wiki',
    kind: 'service',
    origin: 'https://wiki.example.corp',
    auth: [],
    tools: () => toolServer('wiki')
  }
}

describe('syncServiceTools (AC11)', () => {
  it('tools 가 registry 에 왕복 등록된다', () => {
    const registry = new RuntimeToolRegistry()
    let status: ProviderGrantStatus = 'valid'
    const provider = wiki()
    const registrar = new ServiceToolRegistrar({ registry, api, status: () => status })

    registrar.sync([provider])
    const after = registry.snapshot()
    expect([...after.servers.keys()]).toEqual(['wiki-tools'])
    expect(after.servers.get('wiki-tools')?.descriptor.tools.map((t) => t.name)).toEqual([
      'wiki_search'
    ])

    // 연결 해제 → 도구가 스냅샷에서 사라진다.
    status = 'none'
    registrar.sync([provider])
    expect([...registry.snapshot().servers.keys()]).toEqual([])
  })

  it('만료·복호화 실패도 회수 대상이다 — valid 만 등록한다', () => {
    for (const status of ['expired', 'unknown', 'none'] as const) {
      const registry = new RuntimeToolRegistry()
      new ServiceToolRegistrar({ registry, api, status: () => status }).sync([wiki()])
      expect([...registry.snapshot().servers.keys()]).toEqual([])
    }
  })

  it('tools 를 선언하지 않은 provider 는 건드리지 않는다', () => {
    const registry = new RuntimeToolRegistry()
    const bare: Provider = {
      id: 'gw',
      label: 'GW',
      kind: 'llm',
      origin: 'https://gw.example.corp',
      auth: []
    }
    new ServiceToolRegistrar({ registry, api, status: () => 'valid' }).sync([bare])
    expect(registry.snapshot().servers.size).toBe(0)
  })

  it('반복 호출은 멱등이다 — revision 이 오르지 않는다', () => {
    const registry = new RuntimeToolRegistry()
    const registrar = new ServiceToolRegistrar({
      registry,
      api,
      status: () => 'valid' as ProviderGrantStatus
    })
    const provider = wiki()
    registrar.sync([provider])
    const first = registry.snapshot().revision
    registrar.sync([provider])
    // 같은 형상을 다시 넣어도 registry 가 동등성으로 걸러낸다(불필요한 respawn 방지).
    expect(registry.snapshot().revision).toBe(first)
  })
})
