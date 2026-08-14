// 비어 있지 않은 **가상 배포**로 배포 경계를 끝까지 태운다 (0188 r3 신설).
//
// ── 왜 이 파일이 필요한가 ────────────────────────────────────────────────────
// 기본 배포는 선언이 전부 비어 있다. 그래서 CI 가 green 이어도 **배포 경로는 한 번도 실행되지
// 않는다** — r2 가 그 상태로 두 결함을 통과시켰다:
//
//   ① 배포 factory 3종이 인자를 받지 않아, 가이드대로 구현하면 배포가 범용 `bootstrap.ts` 를
//      고쳐야 했다("배포가 고치는 파일은 `app/deployment/` 묶음뿐" 위반).
//   ② `ConnectionViewSource` 가 harness·usage 를 지원하는데 그 row 를 만들 자리가 없어,
//      Harness/Usage 인증을 선언한 배포는 **카탈로그에 행이 뜨지 않아 로그인이 불가능**했다.
//
// 여기서는 실제 배포가 쓸 형태 그대로 4종 Auth 를 세우고, Bootstrap 이 주입하는 것과 같은
// 능력만으로 Plugin·Harness·Usage·카탈로그가 끝까지 이어지는지 확인한다.
//
// `bootstrap.ts` 자체는 electron 을 물어 vitest 대상이 아니다. 그래서 **Bootstrap 이 넘기는
// 의존성 형태**(`AuthRuntime`·`RuntimeToolSink`·AuthId 를 닫은 secret closure)를 그대로 재현한다.

import { describe, expect, it } from 'vitest'
import type { AuthDefinition, AuthId, AuthRuntime, GateAuthDefinition } from '../../contracts/auth'
import { createVault } from '../../infra/vault'
import type { SecretStorePort } from '../../infra/config/secret-store-port'
import { createAuthRuntime } from '../../features/auth/runtime'
import { createMemoryGrantPersistence } from '../../features/auth/store'
import { patSpec } from '../../features/auth/specs/credential'
import { createGate, selectGateMembers } from '../../features/gate'
import { RuntimeToolRegistry } from '../../features/extensions/runtime-tool-registry'
import type { RuntimeToolServer, RuntimeToolSink } from '../../adapters/runtime-tools'
import { authToolServerId } from '../../adapters/runtime-tool-policy'
import { createHarnessRuntimeConfigService } from '../../features/harnesses/runtime-config'
import { prepareHarnessConfig } from '../../features/harnesses/prepared-config'
import type { UsageFetcher } from '../../features/usage/fetcher'
import { connectionState } from '../connection-views'
import type { ConnectionViewSource } from '../connection-views'
import { createPluginBinding, type PluginBinding } from './plugins'
import { gateRows, pluginRows } from './connections'

const BEARER = { location: 'header', name: 'Authorization', scheme: 'bearer' } as const
const CLAUDE_CORP_KEY = 'claude-corp'

// ── 가상 배포 선언 4종 (auth-definitions.ts 를 채운 모습) ──────────────────────
const CORP_SSO_AUTH = {
  id: 'corp-sso',
  label: '사내 로그인',
  origin: 'https://portal.example.corp',
  probe: { path: '/api/me' },
  methods: [patSpec({ label: 'PAT', fieldLabel: 'PAT', present: BEARER })]
} satisfies GateAuthDefinition

const CORP_LLM_AUTH = {
  id: 'corp-llm',
  label: '사내 모델 게이트웨이',
  origin: 'https://llm.example.corp',
  probe: { path: '/api/me' },
  methods: [patSpec({ label: 'API 키', fieldLabel: 'API 키', present: BEARER })]
} satisfies AuthDefinition

const CONFLUENCE_AUTH = {
  id: 'confluence',
  label: 'Confluence',
  origin: 'https://wiki.example.corp',
  probe: { path: '/confluence/rest/api/user/current' },
  methods: [patSpec({ label: 'PAT', fieldLabel: 'PAT', present: BEARER })]
} satisfies AuthDefinition

const CORP_USAGE_AUTH = {
  id: 'corp-usage',
  label: '사내 사용량',
  origin: 'https://usage.example.corp',
  probe: { path: '/api/me' },
  methods: [patSpec({ label: 'PAT', fieldLabel: 'PAT', present: BEARER })]
} satisfies AuthDefinition

const AUTH_DEFINITIONS: readonly AuthDefinition[] = [
  CORP_SSO_AUTH,
  CORP_LLM_AUTH,
  CONFLUENCE_AUTH,
  CORP_USAGE_AUTH
]
const GATE_AUTH_DEFINITIONS: readonly GateAuthDefinition[] = [CORP_SSO_AUTH]

function fakeSecretStore(): SecretStorePort {
  const map = new Map<string, string>()
  return {
    get: (key) => map.get(key),
    set: (key, value) => void map.set(key, value),
    delete: (key) => void map.delete(key)
  }
}

// Bootstrap 이 만드는 것과 같은 스택. 네 Auth 모두 인증된 상태로 seed 한다.
function deployment(): {
  auth: AuthRuntime
  secretFor: (authId: AuthId) => () => string | null
  registry: RuntimeToolRegistry
  requests: string[]
} {
  const requests: string[] = []
  const vault = createVault(fakeSecretStore())
  const grants: Record<string, never> = {} as Record<string, never>
  for (const definition of AUTH_DEFINITIONS) {
    vault.set(`${definition.id}:pat`, `secret-${definition.id}`, {
      kind: 'pat',
      createdAt: 0
    })
    Object.assign(grants, {
      [definition.id]: {
        kind: 'secret',
        vaultKey: `${definition.id}:pat`,
        authKind: 'pat',
        createdAt: 0
      }
    })
  }
  const created = createAuthRuntime({
    definitions: AUTH_DEFINITIONS,
    persistence: createMemoryGrantPersistence(grants),
    vault,
    fetchImpl: (async (input: RequestInfo | URL) => {
      requests.push(String(input))
      return new Response(JSON.stringify({ token: 'llm-token' }), { status: 200 })
    }) as unknown as typeof fetch
  })
  return {
    auth: created.runtime,
    secretFor: (authId) => () => created.secretReader.read(authId),
    registry: new RuntimeToolRegistry(),
    requests
  }
}

function confluenceServer(authId: string): RuntimeToolServer {
  return {
    descriptor: {
      id: authToolServerId(authId),
      connectorId: authId,
      tools: [{ name: 'confluence_search', annotations: { readOnlyHint: true } }]
    },
    implementations: [{ name: 'confluence_search', inputSchema: {}, handler: async () => ({}) }]
  } as unknown as RuntimeToolServer
}

// 가이드 §4 의 `createPluginBindings` 예제를 주입 인자만으로 구현할 수 있는가.
function createPluginBindings(deps: {
  auth: AuthRuntime
  registry: RuntimeToolSink
}): PluginBinding[] {
  const confluenceAuth = deps.auth.bind(CONFLUENCE_AUTH.id)
  return [
    createPluginBinding({
      auth: confluenceAuth,
      server: confluenceServer(confluenceAuth.authId),
      registry: deps.registry
    })
  ]
}

describe('가상 배포 — Plugin 경계', () => {
  it('주입 인자만으로 조립되고 도구가 registry 에 등록된다', () => {
    const { auth, registry } = deployment()

    const plugins = createPluginBindings({ auth, registry })
    for (const plugin of plugins) plugin.sync()

    expect(registry.snapshot().servers.size).toBe(1)
    expect(plugins[0]?.toolNames()).toEqual(['mcp__confluence-tools__confluence_search'])
  })

  it('해제하면 도구가 회수되고 카탈로그 이름은 남는다', () => {
    const { auth, registry } = deployment()
    const plugins = createPluginBindings({ auth, registry })
    for (const plugin of plugins) plugin.sync()

    auth.revoke(CONFLUENCE_AUTH.id)
    for (const plugin of plugins) plugin.sync()

    expect(registry.snapshot().servers.size).toBe(0)
    expect(plugins[0]?.toolNames()).toHaveLength(1)
  })
})

describe('가상 배포 — Harness 실행 구성', () => {
  it('config API augmenter 가 BoundAuth 만으로 전체 env overlay 를 만든다', async () => {
    const { auth, requests } = deployment()
    const corpAuth = auth.bind(CORP_LLM_AUTH.id)
    const service = createHarnessRuntimeConfigService({
      settings: { resolve: async () => undefined },
      augmenters: {
        [CLAUDE_CORP_KEY]: {
          async resolve(_input, signal) {
            const response = await corpAuth.request({ path: '/api/llm/config' }, signal)
            expect(response.ok).toBe(true)
            return {
              runtimeEnv: {
                ANTHROPIC_AUTH_TOKEN: 'llm-token',
                ANTHROPIC_BASE_URL: 'https://llm.example.corp',
                ANTHROPIC_DEFAULT_OPUS_MODEL: 'corp-opus'
              }
            }
          }
        }
      }
    })

    const config = await service.resolve({
      key: CLAUDE_CORP_KEY,
      harnessId: 'claude',
      modelProviderId: 'corp'
    })
    const prepared = prepareHarnessConfig({ config, baseEnv: () => ({ PATH: '/usr/bin' }) })

    // credential 한 값이 아니라 URL·모델 변수까지 실린다 — 구 `envKey` 로는 표현 불가였다.
    expect(prepared.env).toMatchObject({
      ANTHROPIC_AUTH_TOKEN: 'llm-token',
      ANTHROPIC_BASE_URL: 'https://llm.example.corp',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'corp-opus'
    })
    expect(requests.some((url) => url.includes('/api/llm/config'))).toBe(true)
  })

  it('direct-credential augmenter 는 AuthId 가 닫힌 closure 만 받는다', async () => {
    const { secretFor } = deployment()
    // Bootstrap 이 넘기는 것과 같은 형태 — 전체 reader 가 아니다.
    const readSecret = secretFor(CORP_LLM_AUTH.id)
    const service = createHarnessRuntimeConfigService({
      settings: { resolve: async () => undefined },
      augmenters: {
        [CLAUDE_CORP_KEY]: {
          async resolve() {
            const token = readSecret()
            if (token === null) throw new Error('credential unavailable')
            return { runtimeEnv: { ANTHROPIC_AUTH_TOKEN: token } }
          }
        }
      }
    })

    const config = await service.resolve({
      key: CLAUDE_CORP_KEY,
      harnessId: 'claude',
      modelProviderId: 'corp'
    })

    expect(config.runtimeEnv).toEqual({ ANTHROPIC_AUTH_TOKEN: 'secret-corp-llm' })
  })
})

describe('가상 배포 — Usage', () => {
  it('BoundAuth 만으로 fetcher 를 만들 수 있고 supports 가 게이트다', async () => {
    const { auth } = deployment()
    const usageAuth = auth.bind(CORP_USAGE_AUTH.id)
    const fetcher: UsageFetcher = {
      supports: (key) => key === CLAUDE_CORP_KEY,
      async fetchUsage(key, signal) {
        const response = await usageAuth.request({ path: '/api/usage' }, signal)
        if (!response.ok) throw new Error(`usage request failed: ${response.status}`)
        return {
          providerKey: key,
          asOf: null,
          fetchedAt: 0,
          limitUsd: null,
          usedUsd: null,
          remainingUsd: null,
          raw: response.body
        }
      }
    }

    expect(fetcher.supports(CLAUDE_CORP_KEY)).toBe(true)
    expect(fetcher.supports('claude-anthropic')).toBe(false)
    const snapshot = await fetcher.fetchUsage(CLAUDE_CORP_KEY)
    expect(snapshot).toMatchObject({ providerKey: CLAUDE_CORP_KEY })
    // 배포가 watermark 를 확인하지 않았으면 미지정 = false 로 접힌다(fail-closed).
    expect(snapshot?.baselineUsable).toBeUndefined()
  })
})

describe('가상 배포 — 카탈로그 row', () => {
  it('gate·harness·plugin·usage 네 category 가 모두 행으로 나온다', () => {
    const { auth, registry } = deployment()
    const gateSelection = selectGateMembers(GATE_AUTH_DEFINITIONS, (id) => auth.tryBind(id))
    const plugins = createPluginBindings({ auth, registry })
    const gate = createGate({ members: gateSelection.members, bypass: () => false })

    // 배포가 `app/deployment/connections.ts` 에서 조립하는 모습.
    const connections: readonly ConnectionViewSource[] = [
      ...gateRows(gateSelection.members),
      {
        category: 'harness',
        auth: auth.bind(CORP_LLM_AUTH.id),
        harnessModelProviderKey: CLAUDE_CORP_KEY
      },
      ...pluginRows(plugins),
      { category: 'usage', auth: auth.bind(CORP_USAGE_AUTH.id) }
    ]

    const state = connectionState(auth, gate, connections)

    // r2 는 harness·usage row 를 만들 자리가 없어 이 둘이 통째로 빠졌다 — 카탈로그에 없으면
    // 사용자가 로그인할 방법이 없다.
    expect(state.providers.map((row) => row.id)).toEqual([
      'corp-sso',
      'corp-llm',
      'confluence',
      'corp-usage'
    ])
    // wire compat 매핑이 유지된다.
    expect(state.providers.map((row) => row.kind)).toEqual(['gate', 'llm', 'service', 'service'])
    // Plugin row 만 도구 이름을 싣는다.
    expect(state.providers.map((row) => row.tools.length)).toEqual([0, 0, 1, 0])
  })
})
