// Confluence 패키지 통합 (0160) — 실제 등록 경로(`AuthRegistry`)와 연결 경로(`PluginHost`)를
// 그대로 태운다. "코드는 있는데 등록에서 거부되는" 상태를 만들지 않기 위해서다.

import { describe, expect, it } from 'vitest'
import { AuthRegistry } from '../../registry'
import { PluginHost } from '../../plugin-host'
import { createConfluencePackage, CONFLUENCE_TOOL_NAMES, confluenceToolServerId } from './index'
import { CONFLUENCE_BASIC_PROVIDER_ID, CONFLUENCE_PAT_PROVIDER_ID } from './connector'
import { CONFLUENCE_SERVERS } from './servers'
import { runtimeApprovalToolNames } from '../../../../adapters/runtime-tool-policy'
import type { RuntimeToolServer } from '../../../../adapters/runtime-tools'
import type { AuthBindingInfo, AuthMechanism } from '../../../../../shared/ipc'

const ONE_SERVER = [{ id: 'confluence-dc', label: 'Confluence', baseUrl: 'https://wiki.invalid' }]
const TWO_SERVERS = [
  ...ONE_SERVER,
  {
    id: 'confluence-lab',
    label: 'Confluence — 연구소',
    baseUrl: 'https://rnd.invalid',
    apiBasePath: '/confluence'
  }
]

function registered(servers = ONE_SERVER): AuthRegistry {
  const registry = new AuthRegistry()
  const errors = registry.register(createConfluencePackage(servers))
  expect(errors).toEqual([])
  return registry
}

function binding(connectorId: string, mechanism: AuthMechanism): AuthBindingInfo {
  return {
    id: `bind-${mechanism}`,
    pluginId: 'confluence',
    providerId: mechanism === 'basic' ? CONFLUENCE_BASIC_PROVIDER_ID : CONFLUENCE_PAT_PROVIDER_ID,
    target: { kind: 'connector', connectorId, connectionId: `conn-${connectorId}` },
    mechanism,
    artifact: { kind: 'vault_credential', handleId: 'secret', credentialKind: 'basic' },
    status: 'valid',
    createdAt: 0
  }
}

function host(registry: AuthRegistry): {
  host: PluginHost
  servers: Map<string, RuntimeToolServer>
} {
  const servers = new Map<string, RuntimeToolServer>()
  const bindings = new Map<string, AuthBindingInfo>()
  for (const mechanism of ['personal_access_token', 'basic'] as const) {
    for (const connector of registry.listConnectors()) {
      const record = binding(connector.descriptor.id, mechanism)
      bindings.set(record.id + connector.descriptor.id, record)
    }
  }
  return {
    servers,
    host: new PluginHost({
      registry,
      bindings: {
        getBinding: (id) => [...bindings.values()].find((b) => b.id === id)
      },
      connectors: {
        connect: async () => ({ health: 'ready' }),
        invoke: async () => ({ ok: true, data: null }),
        stopByBinding: async () => undefined
      },
      logout: { logout: async () => ({ kind: 'logged_out', endedBindingIds: [] }) },
      runtimeTools: {
        add: (server) => void servers.set(server.descriptor.id, server),
        remove: (id) => void servers.delete(id)
      }
    })
  }
}

describe('createConfluencePackage — 등록 위생', () => {
  it('등록 위생을 통과한다', () => {
    const registry = registered()
    expect(registry.getProvider(CONFLUENCE_PAT_PROVIDER_ID)).toBeDefined()
    expect(registry.getProvider(CONFLUENCE_BASIC_PROVIDER_ID)).toBeDefined()
    expect(registry.getConnector('confluence-dc')).toBeDefined()
    expect(registry.listRuntimeToolsForConnector('confluence-dc')).toHaveLength(1)
  })

  it('두 인증 provider 가 하나의 connector 에 함께 붙는다', () => {
    const connector = registered().getConnector('confluence-dc')
    expect(connector?.descriptor.acceptedAuthProviders).toEqual([
      CONFLUENCE_PAT_PROVIDER_ID,
      CONFLUENCE_BASIC_PROVIDER_ID
    ])
  })

  it('mechanism 별 presentation 을 선언한다', () => {
    const descriptor = registered().getConnector('confluence-dc')?.descriptor
    expect(descriptor?.presentations?.personal_access_token).toEqual({
      location: 'header',
      name: 'Authorization',
      scheme: 'Bearer'
    })
    expect(descriptor?.presentations?.basic).toEqual({
      location: 'header',
      name: 'Authorization',
      scheme: 'BasicPair'
    })
  })

  it('factory 로 서버 두 개를 등록한다', () => {
    const registry = registered(TWO_SERVERS)
    expect(
      registry
        .listConnectors()
        .map((c) => c.descriptor.id)
        .sort()
    ).toEqual(['confluence-dc', 'confluence-lab'])
    // 도구 서버 ID 가 connector 마다 달라 이름이 충돌하지 않는다.
    expect(
      registry
        .listRuntimeTools()
        .map((t) => t.descriptor.id)
        .sort()
    ).toEqual([confluenceToolServerId('confluence-dc'), confluenceToolServerId('confluence-lab')])
  })

  it('서버가 0개면 provider 만 등록된다 (저장소 기본값)', () => {
    const registry = new AuthRegistry()
    expect(registry.register(createConfluencePackage([]))).toEqual([])
    expect(registry.listConnectors()).toEqual([])
    expect(registry.getProvider(CONFLUENCE_PAT_PROVIDER_ID)).toBeDefined()
  })

  it('저장소 기본 서버 목록은 비어 있다 — placeholder 카드를 보여주지 않는다', () => {
    expect(CONFLUENCE_SERVERS).toEqual([])
  })

  // 0164 verify D1 — 이 패키지를 켜는 것만으로 **앱 로그인 게이트가 켜지면 안 된다.**
  // `broker.status().required` 는 `providersForTarget('application').length > 0` 이고,
  // prod 의 `RootGate` 는 그 값으로 앱 전체를 막는다(DEV 는 bypass 라 눈에 띄지 않는다).
  it('앱 로그인 게이트를 켜지 않는다 — provider 는 연결 전용이다', () => {
    for (const servers of [[], ONE_SERVER, TWO_SERVERS]) {
      const registry = registered(servers)
      expect(registry.providersForTarget('application')).toEqual([])
      expect(registry.providersForTarget('connector').map((p) => p.descriptor.id)).toEqual([
        CONFLUENCE_PAT_PROVIDER_ID,
        CONFLUENCE_BASIC_PROVIDER_ID
      ])
    }
  })

  // 0164 r2 — 주소 끝의 `/` 하나로 패키지가 통째로 거부되면 서버가 UI 에서 전부 사라진다.
  it('주소에 붙은 슬래시·컨텍스트 경로를 흡수해 등록에 성공한다', () => {
    const registry = registered([
      { id: 'confluence-dc', label: '사내 위키', baseUrl: 'https://wiki.invalid/' },
      { id: 'confluence-lab', label: '연구소', baseUrl: 'https://rnd.invalid/confluence' }
    ])
    expect(registry.listConnectors().map((c) => c.descriptor.baseUrl)).toEqual([
      'https://wiki.invalid',
      'https://rnd.invalid'
    ])
  })
})

describe('createConfluencePackage — 연결', () => {
  it('PAT binding 으로 연결한다', async () => {
    const registry = registered()
    const { host: pluginHost, servers } = host(registry)
    await pluginHost.connect({
      connectorId: 'confluence-dc',
      bindingId: 'bind-personal_access_token'
    })
    expect(servers.has(confluenceToolServerId('confluence-dc'))).toBe(true)
    expect(pluginHost.list()[0].connected).toBe(true)
  })

  it('basic binding 으로 연결한다', async () => {
    const registry = registered()
    const { host: pluginHost, servers } = host(registry)
    await pluginHost.connect({ connectorId: 'confluence-dc', bindingId: 'bind-basic' })
    expect(servers.has(confluenceToolServerId('confluence-dc'))).toBe(true)
  })

  it('연결된 도구 서버가 찾기·읽기 2종을 노출한다', async () => {
    const registry = registered()
    const { host: pluginHost, servers } = host(registry)
    await pluginHost.connect({ connectorId: 'confluence-dc', bindingId: 'bind-basic' })
    const server = servers.get(confluenceToolServerId('confluence-dc'))
    expect(server?.implementations.map((i) => i.name)).toEqual([
      CONFLUENCE_TOOL_NAMES.search,
      CONFLUENCE_TOOL_NAMES.getPages
    ])
  })
})

describe('createConfluencePackage — 승인 정책', () => {
  it('탐색은 자동 허용, 내려받기만 승인 카드를 거친다', async () => {
    const registry = registered()
    const { host: pluginHost, servers } = host(registry)
    await pluginHost.connect({ connectorId: 'confluence-dc', bindingId: 'bind-basic' })

    const serverId = confluenceToolServerId('confluence-dc')
    const approval = runtimeApprovalToolNames({ revision: 1, servers })

    // 0164 r3 — 찾기/읽기를 나눈 이유가 여기 있다. 검색은 아무것도 바꾸지 않고,
    // 본문·첨부를 로컬에 쓰는 getPages 만 승인 대상이다.
    expect(approval.has(`mcp__${serverId}__${CONFLUENCE_TOOL_NAMES.search}`)).toBe(false)
    expect(approval.has(`mcp__${serverId}__${CONFLUENCE_TOOL_NAMES.getPages}`)).toBe(true)
  })
})
