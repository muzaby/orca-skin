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

import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AuthDefinition,
  AuthId,
  AuthRuntime,
  BoundAuth,
  GateAuthDefinition
} from '../../contracts/auth'
import { createVault } from '../../infra/vault'
import type { SecretStorePort } from '../../infra/config/secret-store-port'
import { createAuthRuntime } from '../../features/auth/runtime'
import { createMemoryGrantPersistence } from '../../features/auth/store'
import { patSpec } from '../../features/auth/specs/credential'
import { createGate, selectGateMembers } from '../../features/gate'
import { RuntimeToolRegistry } from '../../features/extensions/runtime-tool-registry'
import type { RuntimeToolServer } from '../../adapters/runtime-tools'
import { authToolServerId } from '../../adapters/runtime-tool-policy'
import { createHarnessRuntimeConfigService } from '../../features/harnesses/runtime-config'
import { prepareHarnessConfig, type SpawnEnvInjector } from '../../adapters/harness-config'
import { stripCommentsAndStrings } from '../../infra/source-scan'
import { SPAWN_ENV_INJECTOR } from './spawn-env'
import type { UsageFetcher } from '../../features/usage/fetcher'
import { connectionState } from '../connection-views'
import type { ConnectionViewSource } from '../connection-views'
import {
  createPluginBinding,
  createPluginBindings as productionPluginBindings,
  type PluginBinding,
  type PluginDeploymentDeps
} from './plugins'
import {
  createConnectionSources as productionConnectionSources,
  gateRows,
  pluginRows,
  type ConnectionDeploymentDeps
} from './connections'
import {
  createConfigApiAugmenters as productionConfigApiAugmenters,
  createDirectCredentialAugmenters as productionDirectCredentialAugmenters,
  createRuntimeConfigAugmenters as productionRuntimeConfigAugmenters,
  mergeAugmenters as productionMergeAugmenters,
  type HarnessConfigApiDeps,
  type HarnessDirectCredentialDeps
} from './harness-runtime'
import {
  createUsageFetcher as productionUsageFetcher,
  type UsageDeploymentDeps
} from './usage-fetcher'
import type { RuntimeConfigAugmenters } from '../../features/harnesses/runtime-config'
import { mailTools } from '../../features/plugins/mail/tools'
import { jiraTools } from '../../features/plugins/jira/tools'
import { JIRA_CATALOG_PRESENTATION_INPUT } from '../../features/plugins/jira/source'
import {
  JIRA_AUTH_FAILURE_STATUSES,
  JIRA_REQUEST_HEADERS,
  normalizeJiraApiBasePath
} from '../../features/plugins/jira/rest'

const BEARER = { location: 'header', name: 'Authorization', scheme: 'bearer' } as const
const CLAUDE_CORP_KEY = 'claude-corp'

// ── 가상 배포 선언 (auth-definitions.ts 를 채운 모습) ─────────────────────────
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

// 가이드 §4-b Jira recipe. 실제 배포는 origin/context path만 자기 환경 값으로 바꾼다.
const JIRA_API_BASE_PATH = normalizeJiraApiBasePath('/rest')
const jiraAuthDefinition = (apiBasePath: string): AuthDefinition => ({
  id: 'jira-dc',
  label: 'Jira Data Center',
  origin: 'https://jira.example.corp',
  probe: {
    path: `${normalizeJiraApiBasePath(apiBasePath)}/api/2/myself`,
    headers: JIRA_REQUEST_HEADERS,
    authFailureStatuses: JIRA_AUTH_FAILURE_STATUSES
  },
  methods: [patSpec({ label: 'PAT', fieldLabel: 'PAT', present: BEARER })]
})
const JIRA_AUTH = jiraAuthDefinition(JIRA_API_BASE_PATH)

const CORP_USAGE_AUTH = {
  id: 'corp-usage',
  label: '사내 사용량',
  origin: 'https://usage.example.corp',
  probe: { path: '/api/me' },
  methods: [patSpec({ label: 'PAT', fieldLabel: 'PAT', present: BEARER })]
} satisfies AuthDefinition

// POP3 전용 — 칠 HTTP endpoint 가 없어 `probe` 를 선언하지 않는다(0237 D-032). 계정 식별용
// origin 만 두고, 자격증명 증명은 연결 시점의 verifier 가 한다(D-040).
const MAIL_AUTH = {
  id: 'mail-corp',
  label: '사내 메일',
  origin: 'https://mail.example.corp',
  methods: [patSpec({ label: '비밀번호', fieldLabel: '비밀번호', present: BEARER })]
} satisfies AuthDefinition

const AUTH_DEFINITIONS: readonly AuthDefinition[] = [
  CORP_SSO_AUTH,
  CORP_LLM_AUTH,
  CONFLUENCE_AUTH,
  JIRA_AUTH,
  MAIL_AUTH,
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

// Bootstrap 이 만드는 것과 같은 스택. 선언한 Auth를 모두 인증된 상태로 seed 한다.
function deployment(options: { jiraProbeStatus?: number; jiraApiBasePath?: string } = {}): {
  auth: AuthRuntime
  secretFor: (authId: AuthId) => () => string | null
  registry: RuntimeToolRegistry
  requests: string[]
  requestHeaders: Headers[]
} {
  const requests: string[] = []
  const requestHeaders: Headers[] = []
  const vault = createVault(fakeSecretStore())
  const grants: Record<string, never> = {} as Record<string, never>
  const jiraAuth = jiraAuthDefinition(options.jiraApiBasePath ?? JIRA_API_BASE_PATH)
  const definitions = AUTH_DEFINITIONS.map((definition) =>
    definition.id === JIRA_AUTH.id ? jiraAuth : definition
  )
  for (const definition of definitions) {
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
    definitions,
    persistence: createMemoryGrantPersistence(grants),
    vault,
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push(url)
      requestHeaders.push(new Headers(init?.headers))
      const status = url.endsWith(jiraAuth.probe?.path ?? '')
        ? (options.jiraProbeStatus ?? 200)
        : 200
      return new Response(JSON.stringify({ token: 'llm-token' }), { status })
    }) as unknown as typeof fetch
  })
  return {
    auth: created.runtime,
    secretFor: (authId) => () => created.secretReader.read(authId),
    registry: new RuntimeToolRegistry(),
    requests,
    requestHeaders
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
//
// **인자 타입은 실제 `PluginDeploymentDeps` 로 못 박는다** (r4). 인라인 타입으로 두면 이 테스트가
// 검증하는 것이 "이 fixture 가 스스로 정한 인자로 조립된다" 로 좁아져, 정작 잠그려던 사실
// — **Bootstrap 이 주입하는 능력만으로 배포가 조립된다** — 을 놓친다. 배포 factory 의 능력이
// 줄면 여기서 컴파일이 깨져야 한다.
const createPluginBindings = (deps: PluginDeploymentDeps): PluginBinding[] => {
  const confluenceAuth = deps.auth.bindForPlugin(CONFLUENCE_AUTH.id)
  return [
    createPluginBinding({
      auth: confluenceAuth,
      server: confluenceServer(confluenceAuth.authId),
      registry: deps.registry
    })
  ]
}

// Bootstrap 이 넘기는 **능력** 한 벌. 배포는 이것만으로 조립해야 한다 — 여기 없는 것을 쓰면
// 범용 `bootstrap.ts` 를 고쳐야 한다는 뜻이고, 그것이 0188 r3·0237 r2 가 깬 경계다.
const pluginDeps = (
  base: Pick<PluginDeploymentDeps, 'auth' | 'registry'>,
  overrides: Partial<PluginDeploymentDeps> = {}
): PluginDeploymentDeps => ({
  ...base,
  credentialFor: () => () => null,
  userDataRoot: 'C:/Users/tester/AppData/Roaming/orca',
  ...overrides
})

const createJiraPluginBinding = (
  deps: PluginDeploymentDeps,
  apiBasePath = JIRA_API_BASE_PATH
): PluginBinding => {
  const jiraAuth = deps.auth.bindForPlugin(JIRA_AUTH.id)
  const server = jiraTools(jiraAuth, { apiBasePath })
  return createPluginBinding({
    auth: jiraAuth,
    server,
    registry: deps.registry,
    catalog: JIRA_CATALOG_PRESENTATION_INPUT
  })
}

describe('가상 배포 — Plugin 경계', () => {
  it('주입 인자만으로 조립되고 도구가 registry 에 등록된다', () => {
    const { auth, registry } = deployment()

    const plugins = createPluginBindings(pluginDeps({ auth, registry }))
    for (const plugin of plugins) plugin.sync()

    expect(registry.snapshot().servers.size).toBe(1)
    expect(plugins[0]?.toolNames()).toEqual(['mcp__confluence-tools__confluence_search'])
  })

  it('Jira PAT recipe는 probe, catalog, 14 tools와 BoundAuth request를 끝까지 잇는다', async () => {
    const { auth, registry, requests } = deployment()
    const binding = createJiraPluginBinding(pluginDeps({ auth, registry }))
    binding.sync()

    expect(JIRA_AUTH.probe?.path).toBe('/rest/api/2/myself')
    expect(binding.catalog).toMatchObject({
      icon: 'electrical_services',
      attribution: { source: '@atlassian-dc-mcp/jira', version: '0.34.0' }
    })
    expect(binding.server.descriptor.tools).toHaveLength(14)
    expect(registry.snapshot().servers.get('jira-dc-tools')?.implementations[0]?.handler).toBe(
      binding.server.implementations[0]?.handler
    )

    const search = binding.server.implementations.find((tool) => tool.name === 'jira_searchIssues')!
    const result = await search.handler({ jql: 'project = QA' })
    expect(result.structuredContent).toMatchObject({ ok: true, tool: 'jira_searchIssues' })
    expect(requests.some((url) => url.includes('/rest/api/2/search'))).toBe(true)
  })

  it('Jira probe 403은 공통 headers로 전송하고 grant와 tool registry를 유지한다', async () => {
    const { auth, registry, requests, requestHeaders } = deployment({ jiraProbeStatus: 403 })
    const binding = createJiraPluginBinding(pluginDeps({ auth, registry }))
    binding.sync()
    const unsubscribe = auth.subscribe((change) => {
      if (change.kind === 'snapshot' && change.authId === JIRA_AUTH.id) binding.sync()
    })

    await auth.resume(JIRA_AUTH.id)
    unsubscribe()

    const probeIndex = requests.findIndex((url) => url.endsWith('/rest/api/2/myself'))
    expect(probeIndex).toBeGreaterThanOrEqual(0)
    expect(requestHeaders[probeIndex]?.get('User-Agent')).toBe('Orcinus-Orca-Jira/0.34.0')
    expect(requestHeaders[probeIndex]?.get('X-Atlassian-Token')).toBe('no-check')
    expect(auth.bind(JIRA_AUTH.id).snapshot()).toMatchObject({ status: 'valid', verified: false })
    expect(registry.snapshot().servers.has('jira-dc-tools')).toBe(true)
  })

  it('Jira probe 401은 grant를 만료시키고 tool registry에서 회수한다', async () => {
    const { auth, registry } = deployment({ jiraProbeStatus: 401 })
    const binding = createJiraPluginBinding(pluginDeps({ auth, registry }))
    binding.sync()
    const unsubscribe = auth.subscribe((change) => {
      if (change.kind === 'snapshot' && change.authId === JIRA_AUTH.id) binding.sync()
    })

    await auth.resume(JIRA_AUTH.id)
    unsubscribe()

    expect(auth.bind(JIRA_AUTH.id).snapshot()).toMatchObject({ status: 'expired', verified: false })
    expect(registry.snapshot().servers.has('jira-dc-tools')).toBe(false)
  })

  it('Jira context path는 같은 API base에서 probe와 tools request path를 파생한다', async () => {
    const apiBasePath = normalizeJiraApiBasePath('/company/jira/rest/')
    const { auth, registry, requests } = deployment({ jiraApiBasePath: apiBasePath })
    const binding = createJiraPluginBinding(pluginDeps({ auth, registry }), apiBasePath)
    binding.sync()

    await auth.resume(JIRA_AUTH.id)
    const search = binding.server.implementations.find((tool) => tool.name === 'jira_searchIssues')!
    await search.handler({ jql: 'project = QA' })

    expect(requests).toContain('https://jira.example.corp/company/jira/rest/api/2/myself')
    expect(requests).toContain('https://jira.example.corp/company/jira/rest/api/2/search')
  })

  it('해제하면 도구가 회수되고 카탈로그 이름은 남는다', () => {
    const { auth, registry } = deployment()
    const plugins = createPluginBindings(pluginDeps({ auth, registry }))
    for (const plugin of plugins) plugin.sync()

    auth.revoke(CONFLUENCE_AUTH.id)
    for (const plugin of plugins) plugin.sync()

    expect(registry.snapshot().servers.size).toBe(0)
    expect(plugins[0]?.toolNames()).toHaveLength(1)
  })
})

// 가이드 §4 의 두 augmenter 방식. **인자 타입은 실제 `HarnessRuntimeDeploymentDeps`** 다 (r4) —
// config API 방식은 `auth` 만, direct credential 방식은 `secretFor` 만 쓴다는 경계까지 여기서
// 함께 잠근다.
const createConfigApiAugmenters = (deps: HarnessConfigApiDeps): RuntimeConfigAugmenters => {
  const corpAuth = deps.auth.bind(CORP_LLM_AUTH.id)
  return {
    [CLAUDE_CORP_KEY]: {
      async resolve(_input, signal) {
        const response = await corpAuth.request({ path: '/api/llm/config' }, signal)
        if (!response.ok) throw new Error(`llm config request failed: ${response.status}`)
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
}

const createDirectCredentialAugmenters = (
  deps: HarnessDirectCredentialDeps
): RuntimeConfigAugmenters => {
  // Bootstrap 이 **선언된 id 에 대해서만** 만들어 준 닫힌 closure. 선언 안 한 Auth 는 키가 없다.
  const readSecret = deps.secrets[CORP_LLM_AUTH.id] ?? (() => null)
  return {
    [CLAUDE_CORP_KEY]: {
      async resolve() {
        const token = readSecret()
        if (token === null) throw new Error('credential unavailable')
        return { runtimeEnv: { ANTHROPIC_AUTH_TOKEN: token } }
      }
    }
  }
}

describe('가상 배포 — Harness 실행 구성', () => {
  it('config API augmenter 가 BoundAuth 만으로 전체 env overlay 를 만든다', async () => {
    const { auth, requests } = deployment()
    const service = createHarnessRuntimeConfigService({
      settings: { resolve: async () => undefined },
      // config API 방식은 `auth` 만 받는다 — `secretFor` 는 이 deps 타입에 없다(r5 D-048).
      augmenters: createConfigApiAugmenters({ auth })
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
    const service = createHarnessRuntimeConfigService({
      settings: { resolve: async () => undefined },
      augmenters: createDirectCredentialAugmenters({
        secrets: { [CORP_LLM_AUTH.id]: secretFor(CORP_LLM_AUTH.id) }
      })
    })

    const config = await service.resolve({
      key: CLAUDE_CORP_KEY,
      harnessId: 'claude',
      modelProviderId: 'corp'
    })

    expect(config.runtimeEnv).toEqual({ ANTHROPIC_AUTH_TOKEN: 'secret-corp-llm' })
  })
})

// 가이드 §4 의 usage 예제. 인자 타입은 실제 `UsageDeploymentDeps` 다 (r4).
const createUsageFetcher = (deps: UsageDeploymentDeps): UsageFetcher => {
  const usageAuth = deps.auth.bind(CORP_USAGE_AUTH.id)
  return {
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
}

describe('가상 배포 — Usage', () => {
  it('BoundAuth 만으로 fetcher 를 만들 수 있고 supports 가 게이트다', async () => {
    const { auth } = deployment()
    const fetcher = createUsageFetcher({ auth })

    expect(fetcher.supports(CLAUDE_CORP_KEY)).toBe(true)
    expect(fetcher.supports('claude-anthropic')).toBe(false)
    const snapshot = await fetcher.fetchUsage(CLAUDE_CORP_KEY)
    expect(snapshot).toMatchObject({ providerKey: CLAUDE_CORP_KEY })
    // 배포가 watermark 를 확인하지 않았으면 미지정 = false 로 접힌다(fail-closed).
    expect(snapshot?.baselineUsable).toBeUndefined()
  })
})

// 배포가 `app/deployment/connections.ts` 에서 조립하는 모습. 인자 타입은 실제
// `ConnectionDeploymentDeps` 다 (r4) — Bootstrap 이 넘기는 gate 멤버·plugin binding·`auth` 만으로
// 네 category 가 전부 만들어져야 한다.
const createConnectionSources = (
  deps: ConnectionDeploymentDeps
): readonly ConnectionViewSource[] => [
  ...gateRows(deps.gateMembers),
  {
    category: 'harness',
    auth: deps.auth.bind(CORP_LLM_AUTH.id),
    harnessModelProviderKey: CLAUDE_CORP_KEY
  },
  ...pluginRows(deps.plugins),
  { category: 'usage', auth: deps.auth.bind(CORP_USAGE_AUTH.id) }
]

describe('가상 배포 — 카탈로그 row', () => {
  it('gate·harness·plugin·usage 네 category 가 모두 행으로 나온다', () => {
    const { auth, registry } = deployment()
    const gateSelection = selectGateMembers(GATE_AUTH_DEFINITIONS, (id) => auth.tryBind(id))
    const plugins = createPluginBindings(pluginDeps({ auth, registry }))
    const gate = createGate({ members: gateSelection.members, bypass: () => false })

    const connections = createConnectionSources({
      auth,
      gateMembers: gateSelection.members,
      plugins
    })

    const state = connectionState(auth, gate, connections, false)

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

// ── production factory 자체를 부른다 (r5) ─────────────────────────────────────
//
// 위 describe 들은 배포가 **채웠을 때**의 조립을 태운다. 그 fixture 는 production factory 와
// 같은 이름·같은 형상이지만 **다른 함수**라, production 구현이 깨져도 통과할 수 있었다
// (r4 리뷰 P2). 여기서는 `app/deployment/*` 의 실제 export 를 그대로 부른다.
//
// 기본 배포의 계약은 "비어 있다" 다 — 그것이 곧 **기본 빌드에서 network 0·도구 0·행 0** 이라는
// 제품 약속이고, 무심코 채우면 OSS 기본 배포가 사내 endpoint 를 두드리게 된다.
describe('production 배포 factory — 기본 배포 계약', () => {
  it('createPluginBindings 는 기본 배포에서 비어 있다', () => {
    const { auth, registry } = deployment()

    const bindings = productionPluginBindings(pluginDeps({ auth, registry }))

    expect(bindings).toEqual([])
    expect(registry.snapshot().servers.size).toBe(0)
  })

  it('createConnectionSources 는 gate·plugin row 만 만든다', () => {
    const { auth, registry } = deployment()
    const gateSelection = selectGateMembers(GATE_AUTH_DEFINITIONS, (id) => auth.tryBind(id))
    const plugins = productionPluginBindings(pluginDeps({ auth, registry }))

    const rows = productionConnectionSources({
      auth,
      gateMembers: gateSelection.members,
      plugins
    })

    // gate 선언 1건 + plugin 0건. harness·usage 는 배포가 더한다(레시피 B).
    expect(rows.map((row) => row.category)).toEqual(['gate'])
  })

  it('augmenter factory 3종은 기본 배포에서 비어 있다', () => {
    const { auth, secretFor } = deployment()

    const secrets = { [CORP_LLM_AUTH.id]: secretFor(CORP_LLM_AUTH.id) }
    expect(productionConfigApiAugmenters({ auth })).toEqual({})
    expect(productionDirectCredentialAugmenters({ secrets })).toEqual({})
    expect(productionRuntimeConfigAugmenters({ auth, secrets })).toEqual({})
  })

  it('두 augmenter 방식이 같은 key 를 보강하면 던진다 — production 규칙을 직접 부른다', () => {
    // r6 은 이 규칙을 **테스트 안에 다시 구현**해서, production 가드를 지워도 통과했다.
    // 이제 합류 규칙(`mergeAugmenters`)을 직접 부른다.
    const augmenter = { resolve: async () => ({ runtimeEnv: {} }) }

    expect(() =>
      productionMergeAugmenters({ [CLAUDE_CORP_KEY]: augmenter }, { [CLAUDE_CORP_KEY]: augmenter })
    ).toThrow(/collision/)
    expect(productionMergeAugmenters({ [CLAUDE_CORP_KEY]: augmenter }, {})).toHaveProperty(
      CLAUDE_CORP_KEY
    )
    expect(productionMergeAugmenters({}, { [CLAUDE_CORP_KEY]: augmenter })).toHaveProperty(
      CLAUDE_CORP_KEY
    )
  })

  it('createUsageFetcher 는 기본 배포에서 undefined 다 — 오류가 아니라 정상 구성', () => {
    const { auth } = deployment()

    expect(productionUsageFetcher({ auth })).toBeUndefined()
  })
})

// ── 배포는 인증 lifecycle 에 도달할 수 없다 (0190 AC11) ───────────────────────
//
// 타입이 좁아졌다는 **구조적 사실**만으로는 능력이 닫혔다고 말할 수 없다 — 좁힌 타입을 아무도
// 쓰지 않으면 그만이다. 그래서 "이 호출은 컴파일되지 않는다" 를 단언한다. `@ts-expect-error` 는
// 오류가 사라지면 그 자체로 실패하므로, 누군가 deps 를 `AuthRuntime` 으로 되돌리면 여기가 깨진다.
describe('배포 factory 의 능력 경계 (0190)', () => {
  it('config API deps 로는 login/revoke/resume/subscribe 에 도달할 수 없다', () => {
    const stub: BoundAuth = {
      authId: 'corp',
      snapshot: () => ({ authId: 'corp', status: 'valid', verified: true, credentialRevision: 1 }),
      request: () => Promise.reject(new Error('not used'))
    }
    const deps: HarnessConfigApiDeps = {
      auth: {
        bind: () => stub,
        bindForPlugin: () => ({ ...stub, label: 'Corp', origin: 'https://corp.example' })
      }
    }

    // 허용된 능력.
    expect(deps.auth.bind('corp').authId).toBe('corp')

    // @ts-expect-error 배포는 인증을 시작하지 않는다.
    expect(deps.auth.login).toBeUndefined()
    // @ts-expect-error 배포는 인증을 해제하지 않는다.
    expect(deps.auth.revoke).toBeUndefined()
    // @ts-expect-error 배포는 부팅 복원 순서를 소유하지 않는다.
    expect(deps.auth.resume).toBeUndefined()
    // @ts-expect-error 배포는 변경 구독을 소유하지 않는다.
    expect(deps.auth.subscribe).toBeUndefined()
  })

  it('direct credential deps 에는 request 능력이 없다 — 닫힌 closure 만 받는다', () => {
    const deps: HarnessDirectCredentialDeps = { secrets: { corp: () => 'k' } }

    expect(deps.secrets['corp']?.()).toBe('k')
    // @ts-expect-error 이 방식은 API 요청을 낼 수 없다(D-048 의 두 능력 분리).
    expect(deps.auth).toBeUndefined()
  })
})

// ── 폐쇄망 spawn env 주입점 (0207) ───────────────────────────────────────────
//
// 세 가지를 서로 다른 축에서 잠근다: **가이드 예제가 실제 타입에 대입되는가**(컴파일러),
// **기본 배포가 비어 있는가**(값), **컴포지션 루트가 실제로 넘기는가**(배선).

// `docs/guides/closed-network-extensions.md` §3-d 의 예제를 **그대로** 옮긴 것이다. 여기서
// 컴파일되지 않으면 배포자가 따라 쓸 수 없는 예제를 문서가 들고 있다는 뜻이다(0190 A1).
const CORP_SPAWN_ENV: SpawnEnvInjector = ({ target, hostEnv }) => {
  // 프록시·사설 CA 는 모든 key 에 건다.
  const env: Record<string, string> = {
    HTTPS_PROXY: 'http://proxy.corp.example:8080',
    NO_PROXY: 'localhost,127.0.0.1,.corp.example',
    NODE_EXTRA_CA_CERTS: 'C:\\ProgramData\\corp\\ca-bundle.pem'
  }
  // 장비별로 운영자가 덮을 여지를 남긴다 — host 값이 있으면 그것을 쓴다.
  const override = hostEnv['CORP_PROXY_OVERRIDE']
  if (override) env.HTTPS_PROXY = override
  // 특정 게이트웨이에만 거는 값은 **함수 안에서** 좁힌다. 등록 자체는 모든 key 에 걸린다.
  if (target.resolved && target.harnessId === 'claude' && target.modelProviderId === 'corp') {
    env.ANTHROPIC_BASE_URL = 'https://llm.corp.example'
  }
  return env
}

describe('폐쇄망 spawn env 주입점 (0207)', () => {
  it('가이드 예제가 실제 타입으로 동작한다 — 전역값·host 파생·대상 좁히기', () => {
    const everywhere = CORP_SPAWN_ENV({ target: { resolved: false }, hostEnv: {} })
    expect(everywhere).toMatchObject({ HTTPS_PROXY: 'http://proxy.corp.example:8080' })
    expect(everywhere).not.toHaveProperty('ANTHROPIC_BASE_URL')

    const overridden = CORP_SPAWN_ENV({
      target: { resolved: false },
      hostEnv: { CORP_PROXY_OVERRIDE: 'http://alt.corp.example:3128' }
    })
    expect(overridden.HTTPS_PROXY).toBe('http://alt.corp.example:3128')

    const narrowed = CORP_SPAWN_ENV({
      target: {
        resolved: true,
        key: CLAUDE_CORP_KEY,
        harnessId: 'claude',
        modelProviderId: 'corp'
      },
      hostEnv: {}
    })
    expect(narrowed.ANTHROPIC_BASE_URL).toBe('https://llm.corp.example')
  })

  it('기본 배포는 주입점을 비워 둔다 — 오류가 아니라 정상 구성', () => {
    expect(SPAWN_ENV_INJECTOR).toBeUndefined()
  })

  // injector 는 **세 번째 배포 능력**이고, 앞의 둘과 달리 credential·network 를 받지 않는다
  // (D-006). 좁힌 타입을 아무도 쓰지 않으면 그만이므로 "이 접근은 컴파일되지 않는다" 를 단언한다.
  it('injector 입력에는 signal·auth·secrets 능력이 없다', () => {
    const input: Parameters<SpawnEnvInjector>[0] = { target: { resolved: false }, hostEnv: {} }

    expect(input.target.resolved).toBe(false)
    // @ts-expect-error 동기 함수다 — 취소 지점이 없다.
    expect(input.signal).toBeUndefined()
    // @ts-expect-error 원격 호출은 RuntimeConfigAugmenter 의 책임이다.
    expect(input.auth).toBeUndefined()
    // @ts-expect-error raw secret 은 이 능력이 읽지 않는다.
    expect(input.secrets).toBeUndefined()
  })
})

// ── 배선 잠금 (0207 VP-21) ───────────────────────────────────────────────────
//
// provider 해석은 `resolve-turn.ts`가 소유한다. 실제 조립 경로의 배선을 보지 않으면
// **두 호출부에서 인자를 지워도 위 테스트가 전부 통과한다** — 조립부는 injector 없이도 정상
// 동작하기 때문이다. 그래서 소스를 문자열로 읽어 잠근다(`no-node-fetch.test.ts` 와 같은 방식).
//
// 개수를 `2` 로 박지 않는다. **모든 조립 호출부가 injector 를 넘긴다**가 불변식이므로, 호출부가
// 늘면 분모도 함께 늘어야 한다 — 상수로 박으면 세 번째 호출부가 조용히 배선 없이 추가된다.
const TURN_RESOLUTION = join(__dirname, '..', 'chat-turn', 'resolve-turn.ts')
const PREPARE_CALL = /prepare(?:Unresolved)?HarnessConfig\s*\(/g
const INJECTOR_ARG = /customEnv:\s*SPAWN_ENV_INJECTOR\b/g

const countOf = (source: string, pattern: RegExp): number => source.match(pattern)?.length ?? 0

describe('resolve-turn 이 배포 injector 를 두 조립 경로에 넘긴다 (0207)', () => {
  it('조립 호출부 수와 injector 인자 수가 같다', () => {
    const source = stripCommentsAndStrings(readFileSync(TURN_RESOLUTION, 'utf8'))
    const calls = countOf(source, PREPARE_CALL)

    expect(calls).toBeGreaterThan(0)
    expect(countOf(source, INJECTOR_ARG)).toBe(calls)
  })

  // 가드 자신이 맞게 도는지 — 인자를 지운 호출부를 실제로 잡는지 본다. 이게 없으면 정규식이
  // 아무것도 못 잡는 상태로 "통과" 할 수 있다.
  it('인자가 빠진 호출부를 잡는다', () => {
    const wired = 'prepareHarnessConfig({ config, customEnv: SPAWN_ENV_INJECTOR })'
    const bare = 'prepareUnresolvedHarnessConfig({ baseEnv: processEnvRecord })'

    expect(countOf(wired, PREPARE_CALL)).toBe(1)
    expect(countOf(wired, INJECTOR_ARG)).toBe(1)
    expect(countOf(bare, PREPARE_CALL)).toBe(1)
    expect(countOf(bare, INJECTOR_ARG)).toBe(0)
    // import 줄의 이름만으로는 배선으로 세지 않는다.
    expect(
      countOf("import { SPAWN_ENV_INJECTOR } from '../deployment/spawn-env'", INJECTOR_ARG)
    ).toBe(0)
  })
})

// ── 배포 경계: bootstrap 은 plugin 고유 어휘를 모른다 (0237 ΔV2 — D-051) ────────
//
// `plugins.ts:74-76` 이 잠근 불변식이다: "배포가 이 시그니처를 바꾸면 안 된다 — 바꾸는 순간
// 배포가 범용 `bootstrap.ts` 까지 고쳐야 하고, '배포가 고치는 파일은 `app/deployment/` 묶음뿐'
// 이라는 경계가 깨진다". 0188 r3 과 0237 r2 가 실제로 그렇게 깼다.
//
// **음성 스윕 단독은 배선 삭제에 침묵한다.** 그래서 같은 describe 안에 양성 케이스를 짝지어,
// `app/deployment/` 형상만으로 mail 이 끝까지 조립되는지 함께 본다.
describe('배포 경계 — 컴포지션 루트는 plugin 고유 어휘를 모른다 (0237 D-051)', () => {
  const GENERIC_ROOT = join(__dirname, '..')
  const PLUGIN_VOCABULARY = /\b(mail|Mail|MAIL|pop3|Pop3|POP3)\b/

  it.each([
    ['bootstrap.ts', join(GENERIC_ROOT, 'bootstrap.ts')],
    ['index.ts', join(GENERIC_ROOT, '..', 'index.ts')]
  ])('%s 에 plugin 고유 어휘가 0건이다', (_name, path) => {
    const source = readFileSync(path, 'utf8')

    const hits = source.split('\n').filter((line) => PLUGIN_VOCABULARY.test(line))

    expect(hits).toEqual([])
  })

  // 가드 자신이 도는지 — 어휘가 들어 있는 소스를 실제로 잡는지 본다. 이게 없으면 정규식이
  // 아무것도 못 잡는 상태로 "0건" 이 될 수 있다.
  it('가드는 plugin 고유 어휘를 실제로 잡는다', () => {
    const reintroduced = "import { createPop3Socket } from '../infra/net/pop3-socket'"

    expect(PLUGIN_VOCABULARY.test(reintroduced)).toBe(true)
  })

  // 양성 — Bootstrap 이 넘기는 **능력만으로** 비-HTTP Plugin 이 조립된다. 여기서 쓰는 것이
  // `PluginDeploymentDeps` 에 없으면 컴파일이 깨진다.
  it('app/deployment 형상만으로 mail Plugin 이 조립되고 secret 이 전송까지 닿는다', () => {
    const { auth, registry } = deployment()
    const secrets: Record<string, string> = { [MAIL_AUTH.id]: 'pop3-password' }
    const deps = pluginDeps(
      { auth, registry },
      {
        credentialFor: (authId) => () =>
          secrets[authId]
            ? { kind: 'password' as const, username: 'alice@corp', password: secrets[authId] }
            : null
      }
    )

    // 폐쇄망 배포가 `app/deployment/plugins.ts` 안에 적는 것과 같은 코드다.
    const mailAuth = deps.auth.bindForPlugin(MAIL_AUTH.id)
    const transport = {
      credential: deps.credentialFor(MAIL_AUTH.id),
      root: deps.userDataRoot,
      socketFactory: vi.fn()
    }
    const binding = createPluginBinding({
      auth: mailAuth,
      server: mailTools(mailAuth, transport, {
        accountId: MAIL_AUTH.id,
        host: 'pop.example.corp',
        port: 995,
        tls: true
      }),
      registry: deps.registry
    })
    binding.sync()

    expect(binding.server.descriptor.connectorId).toBe(MAIL_AUTH.id)
    expect(binding.toolNames()).toEqual([
      'mcp__mail-corp-tools__mail_sync',
      'mcp__mail-corp-tools__mail_search',
      'mcp__mail-corp-tools__mail_getAttachment'
    ])
    expect(registry.snapshot().servers.size).toBe(1)
    // AuthId 를 닫은 closure 가 실제 값을 돌려준다 — 배포가 `AuthSecretReader` 를 만지지 않는다.
    expect(transport.credential()).toEqual({
      kind: 'password',
      username: 'alice@corp',
      password: 'pop3-password'
    })
    expect(transport.root).toBe(deps.userDataRoot)
    // 조립만으로는 소켓이 열리지 않는다(부팅 단계를 바꾸지 않는다 — D-030·§10 EP-06).
    expect(transport.socketFactory).not.toHaveBeenCalled()
  })

  it('bindForPlugin 은 선언되지 않은 Plugin Auth 를 조립 시점에 거부한다', () => {
    const { auth, registry } = deployment()
    const deps = pluginDeps({ auth, registry })

    expect(() => deps.auth.bindForPlugin('never-declared')).toThrow('unknown auth: never-declared')
  })
})

// ── 조립 표면: 세 Plugin 이 같은 형상이다 (0237 ΔV2 — D-049·D-050 / AC35 / EP-21) ──
describe('Plugin factory 조립 표면 (0237 D-049)', () => {
  it('confluence·jira 는 auth 포트 하나로 조립된다 — label·origin 재기입이 없다', () => {
    const { auth, registry } = deployment()
    const deps = pluginDeps({ auth, registry })

    const confluenceAuth = deps.auth.bindForPlugin(CONFLUENCE_AUTH.id)
    const jiraAuth = deps.auth.bindForPlugin(JIRA_AUTH.id)

    // 선언이 곧 포트다 — 배포가 옮겨 적을 자리가 없다.
    expect(confluenceAuth.label).toBe(CONFLUENCE_AUTH.label)
    expect(confluenceAuth.origin).toBe(CONFLUENCE_AUTH.origin)
    expect(jiraTools(jiraAuth).descriptor.connectorId).toBe(JIRA_AUTH.id)
    expect(jiraTools(jiraAuth).descriptor.tools[0]?.description).toContain(JIRA_AUTH.label)
  })

  // 음성 — 배포 소스 어디에도 `label:`·`origin:` 을 손으로 옮겨 적는 자리가 없다. 어긋나면
  // 도구는 모델에 보이는데 호출은 인증 대상을 못 찾고, 컴파일러도 등록 검사도 잡지 못한다.
  it('배포 소스가 label·origin 을 다시 적지 않는다', () => {
    const source = stripCommentsAndStrings(readFileSync(join(__dirname, 'plugins.ts'), 'utf8'))

    expect(source).not.toMatch(/\blabel\s*:/)
    expect(source).not.toMatch(/\borigin\s*:/)
  })
})

// ── 문서 계약: 레시피 정본이 실제 시그니처와 갈리지 않는다 (0237 AC39) ─────────
//
// `closed-network-extensions.md` 는 배포자가 읽는 **유일한 진입 경로**다(가이드 §1 "레시피 정본은
// 이 문서다"). 표가 낡으면 배포자는 없는 능력으로 조립을 시도하거나, 있는 능력을 모른 채
// `bootstrap.ts` 를 연다 — 0237 r2 가 정확히 그 상태였다(`mail`·`credentialRejectionReporter` 를
// 추가하고 표는 `auth · registry · logger?` 로 남겨 뒀다).
describe('문서 계약 — 가이드 factory 표가 실제 능력을 전부 적는다 (0237 D-053)', () => {
  const GUIDE = join(__dirname, '../../../../../docs/guides/closed-network-extensions.md')

  // `PluginDeploymentDeps` 의 키를 타입이 아니라 **값**으로 고정한다. 키를 늘리면 여기가 먼저
  // 깨지므로 표를 고치지 않고 지나갈 수 없다.
  const CAPABILITIES: Record<keyof PluginDeploymentDeps, true> = {
    auth: true,
    registry: true,
    logger: true,
    credentialFor: true,
    userDataRoot: true,
    credentialRejectionReporter: true
  }

  it('createPluginBindings 행이 모든 능력을 명시한다', () => {
    const row = readFileSync(GUIDE, 'utf8')
      .split('\n')
      .find((line) => line.includes('`createPluginBindings(deps)`'))

    expect(row).toBeDefined()
    const missing = Object.keys(CAPABILITIES).filter((key) => !row!.includes(key))
    expect(missing).toEqual([])
  })

  it('레시피가 구 조립 형상을 더 이상 시연하지 않는다', () => {
    const guide = readFileSync(GUIDE, 'utf8')

    // 구 형상: 배포가 label·origin 을 손으로 옮겨 적던 ctx 객체.
    expect(guide).not.toContain('label: CONFLUENCE_AUTH.label')
    expect(guide).not.toContain('label: JIRA_AUTH.label')
    // 구 형상: bootstrap 이 알던 mail 슬롯.
    expect(guide).not.toContain('createPluginBindings({ auth, registry, mail })')
  })

  it('plugins.ts 헤더가 HTTP Plugin 한정을 말하고 불변식이 어휘 금지를 말한다', () => {
    const source = readFileSync(join(__dirname, 'plugins.ts'), 'utf8')

    expect(source).toContain('HTTP 가 아닌')
    expect(source).toContain('plugin 고유 어휘는 넣지')
  })
})
