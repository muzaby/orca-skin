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
    label?: string
    capabilities?: AuthProviderV1['descriptor']['capabilities']
  } = {}
): AuthProviderV1 {
  return {
    descriptor: {
      id,
      pluginId: opts.pluginId ?? 'pkg',
      apiVersion: (opts.apiVersion ?? 1) as 1,
      label: opts.label ?? id,
      targets: opts.targets ?? ['connector'],
      mechanisms: [opts.mechanism ?? 'api_key'],
      capabilities: opts.capabilities ?? [],
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
          label: 'ADFS',
          mechanism: 'adfs_browser_session',
          capabilities: ['browser_session'],
          targets: ['application', 'connector']
        }),
        provider('pat', {
          pluginId: 'corp',
          label: 'PAT',
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

  // 0164 verify D4 — connector·runtimeTools 는 전 필드를 대조하는데 provider 만 id 존재 여부만
  // 봤다. 그 틈으로 "manifest 는 connector 전용인데 구현은 application 까지 여는" 불일치가
  // 통과했고, 결과적으로 앱 로그인 게이트가 의도치 않게 켜졌다(D1).
  it('provider 선언과 descriptor 가 다르면 거부한다 (targets·label·capabilities)', () => {
    const mismatches: Array<[string, AuthProviderV1]> = [
      ['targets', provider('a', { targets: ['application', 'connector'] })],
      ['label', provider('a', { label: '다른 이름' })],
      ['capabilities', provider('a', { capabilities: ['status'] })]
    ]
    for (const [field, impl] of mismatches) {
      const registry = new AuthRegistry()
      const errors = registry.register({ manifest: manifest('pkg', ['a']), providers: [impl] })
      expect(errors.map((e) => e.message).join(), field).toMatch(
        /auth provider descriptor 가 manifest 와 다릅니다/
      )
      // 반쯤 등록되지 않는다 — 패키지 전체가 거부된다.
      expect(registry.getProvider('a')).toBeUndefined()
    }
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

  // 0160 — presentations 는 "어떤 인증 방식이 어떤 헤더로 나가는가" 를 선언한다. 선언과 구현이
  // 갈리면 문서를 읽고 예상한 헤더와 실제로 나가는 헤더가 달라진다.
  it('presentations 를 선언·구현 대조한다', () => {
    const presentations = {
      personal_access_token: { location: 'header', name: 'Authorization', scheme: 'Bearer' },
      basic: { location: 'header', name: 'Authorization', scheme: 'BasicPair' }
    }
    const registry = new AuthRegistry()
    const errors = registry.register({
      manifest: pluginManifest('pkg', [{ ...connectorDeclaration(), presentations }], []),
      connectors: [connector('connector-a', { presentations: presentations as never })]
    })
    expect(errors).toEqual([])
    expect(registry.getConnector('connector-a')?.descriptor.presentations).toEqual(presentations)
  })

  it('presentations 불일치 패키지를 거부한다', () => {
    const declared = {
      basic: { location: 'header', name: 'Authorization', scheme: 'BasicPair' }
    }
    const implemented = {
      basic: { location: 'header', name: 'X-Other', scheme: 'BasicPair' }
    }
    const drifted = new AuthRegistry().register({
      manifest: pluginManifest('pkg', [{ ...connectorDeclaration(), presentations: declared }], []),
      connectors: [connector('connector-a', { presentations: implemented as never })]
    })
    expect(drifted.map((e) => e.message).join()).toMatch(/connector descriptor/)

    // 한쪽만 선언해도 거부한다 — 있는지 없는지가 곧 규칙의 유무다.
    const declaredOnly = new AuthRegistry().register({
      manifest: pluginManifest('pkg', [{ ...connectorDeclaration(), presentations: declared }], []),
      connectors: [connector('connector-a')]
    })
    expect(declaredOnly.map((e) => e.message).join()).toMatch(/connector descriptor/)

    const implementedOnly = new AuthRegistry().register({
      manifest: pluginManifest('pkg', [connectorDeclaration()], []),
      connectors: [connector('connector-a', { presentations: declared as never })]
    })
    expect(implementedOnly.map((e) => e.message).join()).toMatch(/connector descriptor/)
  })

  it('presentations 미선언 패키지를 그대로 받는다 (기존 패키지 무변경 통과)', () => {
    const registry = new AuthRegistry()
    const errors = registry.register({
      manifest: pluginManifest('pkg', [connectorDeclaration()], []),
      connectors: [connector('connector-a')]
    })
    expect(errors).toEqual([])
    expect(registry.getConnector('connector-a')?.descriptor.presentations).toBeUndefined()
  })

  // 0161 — 사용자가 만든 connector 인스턴스를 지우는 경로. 등록이 all-or-nothing 이듯
  // 제거도 4곳 일괄이어야 "목록에는 없는데 도구는 살아 있는" 상태가 안 생긴다.
  it('패키지 기여를 전부 제거한다', () => {
    const registry = new AuthRegistry()
    expect(
      registry.register({
        manifest: pluginManifest('pkg', [connectorDeclaration()], [runtimeToolDeclaration()]),
        connectors: [connector('connector-a')],
        runtimeTools: [runtimeTool('server-a')]
      })
    ).toEqual([])

    expect(registry.unregister('pkg')).toBe(true)
    expect(registry.getConnector('connector-a')).toBeUndefined()
    expect(registry.listConnectors()).toEqual([])
    expect(registry.listRuntimeTools()).toEqual([])
    expect(registry.listRuntimeToolsForConnector('connector-a')).toEqual([])
  })

  it('다른 패키지 기여를 남긴다', () => {
    // 인스턴스 제거가 템플릿 공용 provider 를 지우면 나머지 인스턴스가 전부 죽는다.
    const registry = new AuthRegistry()
    expect(
      registry.register({
        manifest: manifest('shared', ['auth-a']),
        providers: [provider('auth-a', { pluginId: 'shared' })]
      })
    ).toEqual([])
    expect(
      registry.register({
        manifest: pluginManifest('inst-1', [connectorDeclaration('connector-a')], []),
        connectors: [connector('connector-a', { pluginId: 'inst-1' })]
      })
    ).toEqual([])
    expect(
      registry.register({
        manifest: pluginManifest('inst-2', [connectorDeclaration('connector-b')], []),
        connectors: [connector('connector-b', { pluginId: 'inst-2' })]
      })
    ).toEqual([])

    expect(registry.unregister('inst-1')).toBe(true)
    expect(registry.getConnector('connector-a')).toBeUndefined()
    // 공용 provider 와 다른 인스턴스는 그대로다.
    expect(registry.getProvider('auth-a')).toBeDefined()
    expect(registry.getConnector('connector-b')).toBeDefined()
  })

  it('제거한 pluginId 를 재등록할 수 있다', () => {
    // 삭제 후 같은 주소로 다시 만드는 흐름이 성립하려면 필요하다.
    const registry = new AuthRegistry()
    const pkg = {
      manifest: pluginManifest('pkg', [connectorDeclaration()], []),
      connectors: [connector('connector-a')]
    }
    expect(registry.register(pkg)).toEqual([])
    registry.unregister('pkg')
    expect(registry.register(pkg)).toEqual([])
    expect(registry.getConnector('connector-a')).toBeDefined()
  })

  it('없는 pluginId 제거는 false 를 준다', () => {
    expect(new AuthRegistry().unregister('nope')).toBe(false)
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
      manifest: pluginManifest(
        'pkg-b',
        [connectorDeclaration('connector-b')],
        [{ ...runtimeToolDeclaration(), connectorId: 'connector-b' }]
      ),
      connectors: [connector('connector-b', { pluginId: 'pkg-b' })],
      runtimeTools: [runtimeTool('server-a', { pluginId: 'pkg-b', connectorId: 'connector-b' })]
    })

    expect(missingConnector.map((error) => error.message).join()).toMatch(/connectorId/)
    expect(duplicateToolName.map((error) => error.message).join()).toMatch(/tool name/)
    expect(duplicateServer.map((error) => error.message).join()).toMatch(/runtime tool id/)
    expect(registry.getConnector('connector-b')).toBeUndefined()
  })

  it('connector별 runtime tool contribution을 읽기 전용으로 조회한다', () => {
    const registry = new AuthRegistry()
    expect(
      registry.register({
        manifest: pluginManifest('pkg', [connectorDeclaration()], [runtimeToolDeclaration()]),
        connectors: [connector('connector-a')],
        runtimeTools: [runtimeTool('server-a')]
      })
    ).toEqual([])

    expect(
      registry.listRuntimeToolsForConnector('connector-a').map((tool) => tool.descriptor.id)
    ).toEqual(['server-a'])
    expect(registry.listRuntimeToolsForConnector('missing')).toEqual([])
  })
})

// 0172 — 한 패키지가 선언한 application provider 들이 하나의 로그인 체인이다.
describe('AuthRegistry — 로그인 체인 해석', () => {
  function appManifest(
    id: string,
    entries: Array<{ id: string; targets: AuthTargetKind[] }>
  ): unknown {
    return {
      schemaVersion: 1,
      id,
      version: '1.0.0',
      contributes: {
        authProviders: entries.map((entry) => ({
          id: entry.id,
          apiVersion: 1,
          label: entry.id,
          targets: entry.targets,
          mechanisms: ['api_key']
        }))
      }
    }
  }

  it('loginChainFor 는 manifest 선언 순서로 체인을 만든다', () => {
    const registry = new AuthRegistry()
    // 등록 순서를 선언 순서와 **반대로** 준다 — 체인 순서가 Map 삽입 순서가 아니라 manifest 를
    // 따르는지 확인하기 위해서다.
    expect(
      registry.register({
        manifest: appManifest('pkg', [
          { id: 'first', targets: ['application'] },
          { id: 'second', targets: ['application'] }
        ]),
        providers: [
          provider('second', { targets: ['application'] }),
          provider('first', { targets: ['application'] })
        ]
      })
    ).toEqual([])

    expect(registry.loginChainFor('first').map((p) => p.descriptor.id)).toEqual(['first', 'second'])
    // 중간 멤버로 시작해도 같은 체인을 준다 — 로그인은 헤드부터 다시 돈다.
    expect(registry.loginChainFor('second').map((p) => p.descriptor.id)).toEqual([
      'first',
      'second'
    ])
  })

  it('connector 전용 provider 는 체인 멤버가 아니다', () => {
    const registry = new AuthRegistry()
    expect(
      registry.register({
        manifest: appManifest('pkg', [
          { id: 'conn', targets: ['connector'] },
          { id: 'app', targets: ['application'] }
        ]),
        providers: [
          provider('conn', { targets: ['connector'] }),
          provider('app', { targets: ['application'] })
        ]
      })
    ).toEqual([])

    expect(registry.loginChainFor('app').map((p) => p.descriptor.id)).toEqual(['app'])
    // connector 전용 provider 로 물으면 자기 자신만 — 연결은 방식 하나를 고르는 흐름이다.
    expect(registry.loginChainFor('conn').map((p) => p.descriptor.id)).toEqual(['conn'])
  })

  it('다른 패키지의 application provider 는 체인에 섞이지 않는다', () => {
    const registry = new AuthRegistry()
    registry.register({
      manifest: appManifest('pkg-a', [{ id: 'a1', targets: ['application'] }]),
      providers: [provider('a1', { pluginId: 'pkg-a', targets: ['application'] })]
    })
    registry.register({
      manifest: appManifest('pkg-b', [{ id: 'b1', targets: ['application'] }]),
      providers: [provider('b1', { pluginId: 'pkg-b', targets: ['application'] })]
    })

    expect(registry.loginChainFor('a1').map((p) => p.descriptor.id)).toEqual(['a1'])
    expect(registry.loginChainFor('b1').map((p) => p.descriptor.id)).toEqual(['b1'])
  })

  it('알 수 없는 provider 의 체인은 비어 있다', () => {
    expect(new AuthRegistry().loginChainFor('nope')).toEqual([])
  })
})
