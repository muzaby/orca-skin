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

  it('연결된 도구 서버가 3개 도구를 노출한다', async () => {
    const registry = registered()
    const { host: pluginHost, servers } = host(registry)
    await pluginHost.connect({ connectorId: 'confluence-dc', bindingId: 'bind-basic' })
    const server = servers.get(confluenceToolServerId('confluence-dc'))
    expect(server?.implementations.map((i) => i.name).sort()).toEqual(
      [
        CONFLUENCE_TOOL_NAMES.downloadAttachments,
        CONFLUENCE_TOOL_NAMES.getPage,
        CONFLUENCE_TOOL_NAMES.search
      ].sort()
    )
  })
})

describe('createConfluencePackage — 승인 정책', () => {
  it('쓰기 도구를 readOnlyHint:false 로 선언한다', async () => {
    const registry = registered()
    const { host: pluginHost, servers } = host(registry)
    await pluginHost.connect({ connectorId: 'confluence-dc', bindingId: 'bind-basic' })

    const serverId = confluenceToolServerId('confluence-dc')
    const approval = runtimeApprovalToolNames({ revision: 1, servers })

    // 검색은 자동 허용, 파일을 쓰는 둘은 승인 카드를 거친다.
    expect(approval.has(`mcp__${serverId}__${CONFLUENCE_TOOL_NAMES.search}`)).toBe(false)
    expect(approval.has(`mcp__${serverId}__${CONFLUENCE_TOOL_NAMES.getPage}`)).toBe(true)
    expect(approval.has(`mcp__${serverId}__${CONFLUENCE_TOOL_NAMES.downloadAttachments}`)).toBe(
      true
    )
  })
})
