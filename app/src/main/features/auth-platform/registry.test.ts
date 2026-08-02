import { describe, expect, it } from 'vitest'
import { AuthRegistry } from './registry'
import type { AuthProviderV1 } from '../../contracts/auth-plugin'
import type { ConnectorRuntimeV1 } from '../../contracts/connector-plugin'
import type { RuntimeToolContribution } from '../../adapters/runtime-tools'
import type { AuthMechanism, AuthTargetKind } from '../../../shared/ipc'

function provider(
  id: string,
  opts: {
    pluginId?: string
    apiVersion?: number
    mechanism?: AuthMechanism
    targets?: AuthTargetKind[]
  } = {}
): AuthProviderV1 {
  return {
    descriptor: {
      id,
      pluginId: opts.pluginId ?? 'pkg',
      apiVersion: (opts.apiVersion ?? 1) as 1,
      label: id,
      targets: opts.targets ?? ['connector'],
      mechanisms: [opts.mechanism ?? 'api_key'],
      capabilities: [],
      allowedOrigins: []
    },
    begin: async () => ({ kind: 'not_supported' }),
    continue: async () => ({ kind: 'not_supported' }),
    status: async () => ({ kind: 'not_supported' }),
    refresh: async () => ({ kind: 'not_supported' }),
    logout: async () => ({ kind: 'not_supported' })
  }
}

function manifest(id: string, providerIds: string[], apiVersion = 1): unknown {
  return {
    schemaVersion: 1,
    id,
    version: '1.0.0',
    contributes: {
      authProviders: providerIds.map((pid) => ({
        id: pid,
        apiVersion,
        label: pid,
        targets: ['connector'],
        mechanisms: ['api_key']
      }))
    }
  }
}

function connector(
  id: string,
  opts: Partial<ConnectorRuntimeV1['descriptor']> = {}
): ConnectorRuntimeV1 {
  return {
    descriptor: {
      id,
      pluginId: 'pkg',
      apiVersion: 1,
      label: id,
      acceptedAuthProviders: ['auth-a', 'auth-b'],
      baseUrl: 'https://connector.example.invalid',
      presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' },
      ...opts
    },
    start: async () => ({ health: 'ready' }),
    invoke: async () => ({ ok: true, data: null }),
    stop: async () => undefined
  }
}

function runtimeTool(
  id: string,
  opts: Partial<RuntimeToolContribution['descriptor']> = {}
): RuntimeToolContribution {
  return {
    descriptor: {
      id,
      pluginId: 'pkg',
      connectorId: 'connector-a',
      apiVersion: 1,
      alwaysLoad: true,
      instructions: 'Use these tools for the configured connector.',
      tools: [
        {
          name: 'read-item',
          description: 'Reads one item.',
          annotations: { readOnlyHint: true, idempotentHint: true }
        },
        {
          name: 'write-item',
          description: 'Writes one item.',
          annotations: { destructiveHint: false, openWorldHint: false }
        }
      ],
      ...opts
    },
    create: () => []
  }
}

function pluginManifest(
  id: string,
  connectors: readonly Record<string, unknown>[],
  runtimeTools: readonly Record<string, unknown>[]
): unknown {
  return {
    schemaVersion: 1,
    id,
    version: '1.0.0',
    contributes: { authProviders: [], connectors, runtimeTools }
  }
}

function connectorDeclaration(id = 'connector-a'): Record<string, unknown> {
  return {
    id,
    apiVersion: 1,
    label: id,
    acceptedAuthProviders: ['auth-a', 'auth-b'],
    baseUrl: 'https://connector.example.invalid',
    presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' }
  }
}

function runtimeToolDeclaration(id = 'server-a'): Record<string, unknown> {
  return {
    id,
    connectorId: 'connector-a',
    apiVersion: 1,
    alwaysLoad: true,
    instructions: 'Use these tools for the configured connector.',
    tools: [
      {
        name: 'read-item',
        description: 'Reads one item.',
        annotations: { readOnlyHint: true, idempotentHint: true }
      },
      {
        name: 'write-item',
        description: 'Writes one item.',
        annotations: { destructiveHint: false, openWorldHint: false }
      }
    ]
  }
}

describe('AuthRegistry 등록 위생', () => {
  it('정상 패키지를 등록한다', () => {
    const registry = new AuthRegistry()
    const errors = registry.register({
      manifest: manifest('pkg', ['a']),
      providers: [provider('a')]
    })
    expect(errors).toEqual([])
    expect(registry.getProvider('a')).toBeDefined()
  })

  it('같은 provider id 의 중복 등록을 거부한다 (last-writer-wins override 금지)', () => {
    const registry = new AuthRegistry()
    const first = registry.register({
      manifest: manifest('pkg1', ['dup']),
      providers: [provider('dup', { pluginId: 'pkg1' })]
    })
    expect(first).toEqual([])
    const errors = registry.register({
      manifest: manifest('pkg2', ['dup']),
      providers: [provider('dup', { pluginId: 'pkg2' })]
    })
    expect(errors.map((e) => e.message).join()).toMatch(/이미 등록된 auth provider id/)
    // 첫 번째 등록이 살아남는다 — 나중 것이 이기지 않는다.
    expect(registry.getProvider('dup')?.descriptor.pluginId).toBe('pkg1')
  })

  it('apiVersion 불일치를 등록 단계에서 거부한다', () => {
    const registry = new AuthRegistry()
    const errors = registry.register({
      manifest: manifest('pkg', ['old'], 2),
      providers: [provider('old', { apiVersion: 2 })]
    })
    expect(errors.length).toBeGreaterThan(0)
    expect(registry.getProvider('old')).toBeUndefined()
  })

  it('manifest 에 선언되지 않은 구현을 거부한다 (capability 검사 우회 차단)', () => {
    const registry = new AuthRegistry()
    const errors = registry.register({
      manifest: manifest('pkg', ['declared']),
      providers: [provider('declared'), provider('sneaky')]
    })
    expect(errors.map((e) => e.message).join()).toMatch(/선언되지 않은 auth provider 구현/)
    expect(registry.getProvider('sneaky')).toBeUndefined()
  })

  it('선언만 있고 구현이 없으면 거부한다', () => {
    const registry = new AuthRegistry()
    const errors = registry.register({
      manifest: manifest('pkg', ['a', 'ghost']),
      providers: [provider('a')]
    })
    expect(errors.map((e) => e.message).join()).toMatch(/구현이 없습니다/)
  })

  it('패키지에 문제가 하나라도 있으면 그 패키지 전체를 거부한다 (반쯤 등록 금지)', () => {
    const registry = new AuthRegistry()
    registry.register({
      manifest: manifest('pkg', ['good', 'ghost']),
      providers: [provider('good')]
    })
    expect(registry.getProvider('good')).toBeUndefined()
  })

  it('5메서드 중 하나라도 없으면 거부한다', () => {
    const registry = new AuthRegistry()
    const broken = provider('broken') as unknown as Record<string, unknown>
    delete broken.refresh
    const errors = registry.register({
      manifest: manifest('pkg', ['broken']),
      providers: [broken as unknown as AuthProviderV1]
    })
    expect(errors.map((e) => e.message).join()).toMatch(/refresh 가 구현되지 않았습니다/)
  })

  it('descriptor.pluginId 가 manifest 와 다르면 거부한다', () => {
    const registry = new AuthRegistry()
    const errors = registry.register({
      manifest: manifest('pkg', ['a']),
      providers: [provider('a', { pluginId: 'other' })]
    })
    expect(errors.map((e) => e.message).join()).toMatch(
      /descriptor.pluginId 가 manifest 와 다릅니다/
    )
  })

  it('손상된 manifest 를 거부한다', () => {
    const registry = new AuthRegistry()
    const errors = registry.register({ manifest: { schemaVersion: 99 }, providers: [] })
    expect(errors.length).toBeGreaterThan(0)
  })

  it('AC1 — 서로 다른 mechanism 의 provider 2개가 동시 등록되고 양쪽 target 을 지원한다', () => {
    const registry = new AuthRegistry()
    registry.register({
      manifest: {
        schemaVersion: 1,
        id: 'corp',
        version: '1.0.0',
        contributes: {
          authProviders: [
            {
              id: 'adfs',
              apiVersion: 1,
              label: 'ADFS',
              targets: ['application', 'connector'],
              mechanisms: ['adfs_browser_session'],
              capabilities: ['browser_session'],
              sessionGroup: 'corp-adfs'
            },
            {
              id: 'pat',
              apiVersion: 1,
              label: 'PAT',
              targets: ['application', 'connector'],
              mechanisms: ['personal_access_token']
            }
          ]
        }
      },
      providers: [
        provider('adfs', {
          pluginId: 'corp',
          mechanism: 'adfs_browser_session',
          targets: ['application', 'connector']
        }),
        provider('pat', {
          pluginId: 'corp',
          mechanism: 'personal_access_token',
          targets: ['application', 'connector']
        })
      ]
    })
    expect(registry.listProviders()).toHaveLength(2)
    expect(registry.providersForTarget('application')).toHaveLength(2)
    expect(registry.providersForTarget('connector')).toHaveLength(2)
    // 서로 다른 mechanism 임을 확인 — 같은 것 두 개가 아니다.
    expect(new Set(registry.listProviders().map((p) => p.descriptor.mechanisms[0])).size).toBe(2)
  })

  it('describeProviders 는 allowedOrigins 를 renderer 로 내보내지 않는다', () => {
    const registry = new AuthRegistry()
    registry.register({ manifest: manifest('pkg', ['a']), providers: [provider('a')] })
    const described = JSON.stringify(registry.describeProviders())
    expect(described).not.toMatch(/allowedOrigins/)
  })
  it('runtime tool 선언과 descriptor 전체를 이름 정규화 후 대조한다', () => {
    const registry = new AuthRegistry()
    const implementation = runtimeTool('server-a', {
      tools: [
        {
          name: 'write-item',
          description: 'Writes one item.',
          annotations: { destructiveHint: false, openWorldHint: false }
        },
        {
          name: 'read-item',
          description: 'Reads one item.',
          annotations: { readOnlyHint: true, idempotentHint: true }
        }
      ]
    })

    const errors = registry.register({
      manifest: pluginManifest('pkg', [connectorDeclaration()], [runtimeToolDeclaration()]),
      connectors: [connector('connector-a', { acceptedAuthProviders: ['auth-b', 'auth-a'] })],
      runtimeTools: [implementation]
    })

    expect(errors).toEqual([])
  })

  it('runtime tool descriptor 필드 하나라도 선언과 다르면 package 전체를 거부한다', () => {
    const registry = new AuthRegistry()
    const errors = registry.register({
      manifest: pluginManifest('pkg', [connectorDeclaration()], [runtimeToolDeclaration()]),
      connectors: [connector('connector-a')],
      runtimeTools: [runtimeTool('server-a', { instructions: 'Drifted instructions.' })]
    })

    expect(errors.map((error) => error.message).join()).toMatch(/runtime tool descriptor/)
    expect(registry.getConnector('connector-a')).toBeUndefined()
  })

  it('runtime tool 선언과 구현의 1대1 불일치를 거부한다', () => {
    const declaredOnly = new AuthRegistry().register({
      manifest: pluginManifest('pkg', [connectorDeclaration()], [runtimeToolDeclaration()]),
      connectors: [connector('connector-a')]
    })
    const implementationOnly = new AuthRegistry().register({
      manifest: pluginManifest('pkg', [connectorDeclaration()], []),
      connectors: [connector('connector-a')],
      runtimeTools: [runtimeTool('server-a')]
    })

    expect(declaredOnly.map((error) => error.message).join()).toMatch(
      /runtime tool.*implementation/
    )
    expect(implementationOnly.map((error) => error.message).join()).toMatch(
      /runtime tool.*declaration/
    )
  })

  it('connector 선언과 구현 descriptor 전체를 대조한다', () => {
    const registry = new AuthRegistry()
    const errors = registry.register({
      manifest: pluginManifest('pkg', [connectorDeclaration()], []),
      connectors: [connector('connector-a', { label: 'Drifted label' })]
    })

    expect(errors.map((error) => error.message).join()).toMatch(/connector descriptor/)
    expect(registry.getConnector('connector-a')).toBeUndefined()
  })

  it('runtime tool connector 교차 참조와 중복을 등록 단계에서 검증한다', () => {
    const missingConnector = new AuthRegistry().register({
      manifest: pluginManifest('pkg', [connectorDeclaration()], [runtimeToolDeclaration()]),
      connectors: [connector('connector-a')],
      runtimeTools: [runtimeTool('server-a', { connectorId: 'missing' })]
    })
    const duplicateToolName = new AuthRegistry().register({
      manifest: pluginManifest('pkg', [connectorDeclaration()], [runtimeToolDeclaration()]),
      connectors: [connector('connector-a')],
      runtimeTools: [
        runtimeTool('server-a', {
          tools: [
            { name: 'same', description: 'First.' },
            { name: 'same', description: 'Second.' }
          ]
        })
      ]
    })
    const registry = new AuthRegistry()
    expect(
      registry.register({
        manifest: pluginManifest('pkg-a', [connectorDeclaration()], [runtimeToolDeclaration()]),
        connectors: [connector('connector-a', { pluginId: 'pkg-a' })],
        runtimeTools: [runtimeTool('server-a', { pluginId: 'pkg-a' })]
      })
    ).toEqual([])
    const duplicateServer = registry.register({
      manifest: pluginManifest('pkg-b', [connectorDeclaration('connector-b')], [
        { ...runtimeToolDeclaration(), connectorId: 'connector-b' }
      ]),
      connectors: [connector('connector-b', { pluginId: 'pkg-b' })],
      runtimeTools: [runtimeTool('server-a', { pluginId: 'pkg-b', connectorId: 'connector-b' })]
    })

    expect(missingConnector.map((error) => error.message).join()).toMatch(/connectorId/)
    expect(duplicateToolName.map((error) => error.message).join()).toMatch(/tool name/)
    expect(duplicateServer.map((error) => error.message).join()).toMatch(/runtime tool id/)
    expect(registry.getConnector('connector-b')).toBeUndefined()
  })
})
