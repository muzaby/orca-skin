import { describe, expect, it, vi, type Mock, type MockInstance } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AuthChange,
  AuthDefinition,
  AuthRuntime,
  AuthSecretReader,
  GateAuthDefinition,
  LoginFreeDefinition,
  LoginFreePluginAuth
} from '../../contracts/auth'
import type { RuntimeToolServer } from '../../adapters/common/runtime-tools'
import {
  authToolServerId,
  runtimeApprovalToolNames
} from '../../adapters/common/runtime-tool-policy'
import { createAuthRuntime } from '../../features/auth/runtime'
import { createMemoryGrantPersistence } from '../../features/auth/store'
import { patSpec } from '../../features/auth/specs/credential'
import { createGate, selectGateMembers, type Gate } from '../../features/gate'
import { RuntimeToolRegistry } from '../../features/extensions/common/runtime-tool-registry'
import { createVault } from '../../infra/vault'
import { stripCommentsAndStrings } from '../../infra/source-scan'
import { connectionState } from '../connection-views'
import { createRuntimeModelAuthChangeHandler } from '../runtime-model-startup'
import { createHarnessRuntimeConfigService } from '../../features/harnesses/common/runtime-config'
import type { RuntimeConfigAugmenters } from '../../features/harnesses/common/runtime-config'
import { prepareHarnessConfig } from '../../adapters/common/harness-config'
import type { UsageFetcher } from '../../features/usage/fetcher'
import { gateRows, harnessRows, pluginRows, usageRows } from './connections'
import { mergeAugmenters, type HarnessConfigApiDeps } from './harness-runtime'
import { createPluginBinding, type PluginBinding, type PluginDeploymentDeps } from './plugins'
import type { UsageDeploymentDeps } from './usage-fetcher'

// 가이드 §4 로그인 프리 레시피와 같은 타입·조립·요청 경로다.
const PUBLIC_API_PLUGIN = {
  id: 'public-api',
  label: '공개 API',
  origin: 'https://api.example.corp'
} satisfies LoginFreeDefinition
const LOCAL_PLUGIN = { id: 'local-tools', label: '로컬 도구' } satisfies LoginFreeDefinition
// 가이드 `### 로그인 프리 원격 사용량·config API 레시피`(0297)의 선언이다.
const USAGE_API = {
  id: 'usage-api',
  label: '사용량 API',
  origin: 'https://usage.example.corp'
} satisfies LoginFreeDefinition
const CONFIG_API = {
  id: 'llm-config-api',
  label: 'LLM 설정 API',
  origin: 'https://llm-config.example.corp'
} satisfies LoginFreeDefinition
const CORP_LLM_KEY = 'claude-corp'
const CREDENTIAL = {
  id: 'corp-sso',
  label: '사내 로그인',
  origin: 'https://portal.example.corp',
  probe: { path: '/me' },
  methods: [
    patSpec({
      label: 'PAT',
      fieldLabel: 'PAT',
      present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
    })
  ]
} satisfies GateAuthDefinition
const EXPIRING: AuthDefinition = { ...CREDENTIAL, id: 'expiring' }

function publicApiTools(auth: LoginFreePluginAuth): RuntimeToolServer {
  return {
    descriptor: {
      id: authToolServerId(auth.authId),
      connectorId: auth.authId,
      tools: [
        { name: 'public_api_health', description: 'API 상태', annotations: { readOnlyHint: true } }
      ]
    },
    implementations: [
      {
        name: 'public_api_health',
        inputSchema: {},
        handler: async (_input, context) => {
          void _input
          const response = await auth.request(
            { path: '/health', maxBytes: 64 * 1024 },
            context?.getSignal()
          )
          return {
            content: [{ type: 'text', text: response.body }],
            isError: !response.ok
          }
        }
      }
    ]
  }
}

function recipePluginBindings(deps: PluginDeploymentDeps): PluginBinding[] {
  const auth = deps.auth.bindLoginFreePlugin(PUBLIC_API_PLUGIN.id)
  return [
    createPluginBinding({
      auth,
      server: publicApiTools(auth),
      registry: deps.registry,
      logger: deps.logger
    })
  ]
}

// ── 가이드 `### 로그인 프리 원격 사용량·config API 레시피`와 같은 본문 (0297) ──────
function createUsageFetcher(deps: UsageDeploymentDeps): UsageFetcher {
  const usageApi = deps.auth.bindLoginFreePlugin(USAGE_API.id)
  return {
    supports: (providerKey) => providerKey === CORP_LLM_KEY,
    async fetchUsage(providerKey, signal) {
      const response = await usageApi.request({ path: '/api/usage', maxBytes: 64 * 1024 }, signal)
      // 401/403 은 상태를 바꾸지 않는다 — 재인증 경로가 없으므로 오류로 낸다.
      if (!response.ok) throw new Error(`usage request failed: ${response.status}`)
      return {
        providerKey,
        asOf: null,
        fetchedAt: Date.now(),
        limitUsd: null,
        usedUsd: null,
        remainingUsd: null,
        raw: response.body
      }
    }
  }
}

function createConfigApiAugmenters(deps: HarnessConfigApiDeps): RuntimeConfigAugmenters {
  const configApi = deps.auth.bindLoginFreePlugin(CONFIG_API.id)
  return {
    [CORP_LLM_KEY]: {
      async resolve(_input, signal) {
        const response = await configApi.request(
          { path: '/v1/config', maxBytes: 64 * 1024 },
          signal
        )
        // 필수 값이 없거나 실패면 부분 env 를 만들지 않고 resolve 를 실패시킨다.
        if (!response.ok) throw new Error(`llm config request failed: ${response.status}`)
        return { runtimeEnv: { CORP_LLM_CONFIG: response.body } }
      }
    }
  }
}

interface TestDeployment {
  auth: AuthRuntime
  secretReader: AuthSecretReader
  registry: RuntimeToolRegistry
  loginFree: PluginBinding
  plugins: PluginBinding[]
  gate: Gate
  changes: AuthChange[]
  add: MockInstance<RuntimeToolRegistry['add']>
  remove: MockInstance<RuntimeToolRegistry['remove']>
  fetchImpl: Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>
  requestHeaders: Headers[]
  setStatus(value: number): void
  setClock(value: number): void
}

function deployment(options: { withExpiry?: boolean } = {}): TestDeployment {
  const secretValues = new Map<string, string>()
  const vault = createVault({
    get: (key) => secretValues.get(key),
    set: (key, value) => void secretValues.set(key, value),
    delete: (key) => void secretValues.delete(key)
  })
  if (options.withExpiry) {
    vault.set('expiring:pat', 'token', { kind: 'pat', createdAt: 0, expiresAt: 100 })
  }
  let now = 1
  let status = 200
  const requestHeaders: Headers[] = []
  const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    void _input
    requestHeaders.push(new Headers(init?.headers))
    return new Response('result', { status })
  })
  const { runtime: auth, secretReader } = createAuthRuntime({
    definitions: [CREDENTIAL, EXPIRING],
    loginFreeDefinitions: [PUBLIC_API_PLUGIN, LOCAL_PLUGIN, USAGE_API, CONFIG_API],
    persistence: createMemoryGrantPersistence(
      options.withExpiry
        ? {
            expiring: {
              kind: 'token',
              vaultKey: 'expiring:pat',
              authKind: 'pat',
              createdAt: 0,
              expiresAt: 100
            }
          }
        : {}
    ),
    vault,
    fetchImpl,
    clock: () => now
  })
  const registry = new RuntimeToolRegistry()
  const add = vi.spyOn(registry, 'add')
  const remove = vi.spyOn(registry, 'remove')
  const loginFree = recipePluginBindings({ auth, registry })[0]!
  const required = createPluginBinding({
    auth: auth.bindForPlugin(CREDENTIAL.id),
    server: {
      ...loginFree.server,
      descriptor: {
        ...loginFree.server.descriptor,
        id: 'corp-sso-tools',
        connectorId: CREDENTIAL.id
      }
    },
    registry
  })
  const plugins = [loginFree, required]
  const changes: AuthChange[] = []
  const onChange = createRuntimeModelAuthChangeHandler({
    recordGateLogin: () => undefined,
    pushConnectionState: () => undefined,
    syncPlugins: (authId) => {
      for (const plugin of plugins) if (plugin.auth.authId === authId) plugin.sync()
    },
    invalidateForAuth: () => undefined,
    reconcileSnapshot: () => undefined
  })
  auth.subscribe((change) => {
    changes.push(change)
    onChange(change)
  })
  const selection = selectGateMembers([CREDENTIAL], (id) => auth.tryBind(id))
  const gate = createGate({
    members: selection.members,
    blockedMembers: selection.blocked.length,
    bypass: () => false
  })
  for (const plugin of plugins) plugin.sync()
  return {
    auth,
    secretReader,
    registry,
    loginFree,
    plugins,
    gate,
    changes,
    add,
    remove,
    fetchImpl,
    requestHeaders,
    setStatus: (value: number) => {
      status = value
    },
    setClock: (value: number) => {
      now = value
    }
  }
}

function expectAlwaysAvailable(d: ReturnType<typeof deployment>): void {
  expect(d.registry.snapshot().servers.has('public-api-tools')).toBe(true)
  expect(d.loginFree.auth.snapshot()).toEqual({
    authId: PUBLIC_API_PLUGIN.id,
    status: 'valid',
    verified: true,
    credentialRevision: 0
  })
  expect(
    d.add.mock.calls.filter(([server]) => server.descriptor.id === 'public-api-tools')
  ).toHaveLength(1)
  expect(d.remove.mock.calls.filter(([id]) => id === 'public-api-tools')).toEqual([])
  expect(
    d.changes.filter(
      (change) => change.kind === 'snapshot' && change.authId === PUBLIC_API_PLUGIN.id
    )
  ).toEqual([])
}

describe('로그인 프리 가상 배포 — 같은 Plugin 경로 (0248)', () => {
  it('첫 sync는 로그인 없이 도구를 등록하고 가이드 factory가 request까지 실행한다 (AC1·AC17)', async () => {
    const d = deployment()
    expect([CREDENTIAL.id, EXPIRING.id].map((id) => d.auth.bind(id).snapshot().status)).toEqual([
      'none',
      'none'
    ])
    expectAlwaysAvailable(d)
    const result = await d.registry
      .snapshot()
      .servers.get('public-api-tools')!
      .implementations[0]!.handler({})
    expect(result).toEqual({ content: [{ type: 'text', text: 'result' }], isError: false })
    expect(d.fetchImpl).toHaveBeenCalledTimes(1)
    expect(d.fetchImpl.mock.calls[0]?.[0]).toBe('https://api.example.corp/health')
    expect(runtimeApprovalToolNames(d.registry.snapshot())).toEqual(new Set())
  })

  it('commit·revoke·만료·401 change는 실제 handler를 거쳐도 로그인 프리 등록을 건드리지 않는다 (AC2)', async () => {
    const d = deployment({ withExpiry: true })
    await d.auth.login(CREDENTIAL.id, 'pat', { secret: 'value' })
    expectAlwaysAvailable(d)
    d.auth.revoke(CREDENTIAL.id)
    expectAlwaysAvailable(d)
    d.setClock(101)
    expect(d.auth.bind(EXPIRING.id).snapshot().status).toBe('expired')
    expectAlwaysAvailable(d)
    await d.auth.login(CREDENTIAL.id, 'pat', { secret: 'new' })
    d.setStatus(401)
    await d.auth.bind(CREDENTIAL.id).request({ path: '/api' })
    expectAlwaysAvailable(d)
    expect(
      d.changes.filter((change) => change.kind === 'snapshot').map((change) => change.cause)
    ).toEqual([
      'credential-committed',
      'revoked',
      'expired',
      'credential-committed',
      'unauthorized'
    ])
  })

  it('게이트 미통과→로그인→해제 내내 유지하고 자격증명 Plugin은 등록·회수된다 (AC3)', async () => {
    const d = deployment()
    expect(d.gate.state().passed).toBe(false)
    expect(d.registry.snapshot().servers.has('corp-sso-tools')).toBe(false)
    expectAlwaysAvailable(d)
    await d.auth.login(CREDENTIAL.id, 'pat', { secret: 'value' })
    expect(d.gate.state().passed).toBe(true)
    expect(d.registry.snapshot().servers.has('corp-sso-tools')).toBe(true)
    expectAlwaysAvailable(d)
    d.auth.revoke(CREDENTIAL.id)
    expect(d.gate.state().passed).toBe(false)
    expect(d.registry.snapshot().servers.has('corp-sso-tools')).toBe(false)
    expectAlwaysAvailable(d)
  })

  it.each([401, 403])(
    '로그인 프리 %s는 실패 결과만 반환하고 snapshot·change·registry를 유지한다 (AC7)',
    async (status) => {
      const d = deployment()
      const before = d.registry.snapshot().revision
      d.setStatus(status)
      const response = await d.loginFree.auth.request({
        path: '/api',
        authFailureStatuses: [401, 403]
      })
      expect(response).toMatchObject({ ok: false, status })
      expectAlwaysAvailable(d)
      expect(d.changes).toEqual([])
      expect(d.registry.snapshot().revision).toBe(before)
      const result = await d.loginFree.server.implementations[0]!.handler({})
      expect(result.isError).toBe(true)
      expectAlwaysAvailable(d)
    }
  )

  it.each([PUBLIC_API_PLUGIN.id, LOCAL_PLUGIN.id])(
    'wire %s는 service·login-free·빈 인증 필드를 싣는다 (AC10)',
    (id) => {
      const d = deployment()
      const port = d.auth.bindLoginFreePlugin(id)
      const plugin = createPluginBinding({
        auth: port,
        server: publicApiTools(port),
        registry: d.registry
      })
      // 배포의 기본 행 조립(`createConnectionSources`)이 아니라 행 조각으로 직접 조립한다 —
      // 폐쇄망 포크가 그 factory 에 자기 harness·usage 행을 끼우면 인덱스가 밀린다(0294 D-007).
      const sources = [...gateRows([d.auth.bind(CREDENTIAL.id)]), ...pluginRows([plugin])]
      const state = connectionState(d.auth, d.gate, sources, false)
      expect(state.providers[1]).toEqual({
        id,
        label: id === PUBLIC_API_PLUGIN.id ? PUBLIC_API_PLUGIN.label : LOCAL_PLUGIN.label,
        kind: 'service',
        authScheme: 'login-free',
        origin: id === PUBLIC_API_PLUGIN.id ? PUBLIC_API_PLUGIN.origin : '',
        auth: [],
        status: 'valid',
        activeAuthKind: null,
        principal: null,
        expiresAt: null,
        tools: [`mcp__${id}-tools__public_api_health`],
        catalog: plugin.catalog
      })
      expect(state.providers[0]?.authScheme).toBe('login-required')
    }
  )

  it('로그인 프리 id를 gate로 잘못 지정하면 unregistered로 게이트가 닫힌다 (AC4)', () => {
    const d = deployment()
    const selection = selectGateMembers([{ ...CREDENTIAL, id: PUBLIC_API_PLUGIN.id }], (id) =>
      d.auth.tryBind(id)
    )
    expect(selection.members).toEqual([])
    expect(selection.blocked).toEqual([{ authId: PUBLIC_API_PLUGIN.id, reason: 'unregistered' }])
    expect(
      createGate({
        members: selection.members,
        blockedMembers: selection.blocked.length,
        bypass: () => false
      }).state()
    ).toEqual({ required: true, passed: false, bypassed: false, dailyRelogin: [] })
    expect(d.secretReader.read(PUBLIC_API_PLUGIN.id)).toBeNull()
  })
})

// ── Usage·config API 배포 factory 의 로그인 프리 포트 (0297) ─────────────────────
//
// 배포 factory 는 Bootstrap 이 넘기는 full `AuthRuntime` 이 아니라 **실제 deps 타입**으로만 받는다 —
// `AuthBinder` 에서 `bindLoginFreePlugin` 이 빠지면 여기서 컴파일이 깨진다(VP-05).
const usageDepsOf = (auth: AuthRuntime): UsageDeploymentDeps => ({ auth })
const configApiDepsOf = (auth: AuthRuntime): HarnessConfigApiDeps => ({ auth })

// 자격증명 Auth 가 로그인된 상태 — 자격증명 포트를 잘못 쓰면 `Authorization` 이 실린다.
async function loggedIn(): Promise<TestDeployment> {
  const d = deployment()
  await d.auth.login(CREDENTIAL.id, 'pat', { secret: 'value' })
  // 기록 장치의 눈 — probe 요청에는 자격증명 헤더가 실제로 관측된다.
  expect(d.requestHeaders.at(-1)?.get('authorization')).toContain('value')
  return d
}

function expectLoginFreeUntouched(d: TestDeployment, authId: string, changesBefore: number): void {
  expect(d.changes).toHaveLength(changesBefore)
  expect(d.auth.bindLoginFreePlugin(authId).snapshot()).toEqual({
    authId,
    status: 'valid',
    verified: true,
    credentialRevision: 0
  })
  expect(d.auth.snapshot(authId)).toEqual(d.auth.bindLoginFreePlugin(authId).snapshot())
}

describe('로그인 프리 Usage — UsageDeploymentDeps 만으로 조립 (0297 AC1)', () => {
  it('(a) 200이면 선언 origin에 Authorization 없이 요청하고 snapshot을 만든다', async () => {
    const d = await loggedIn()
    const before = d.changes.length
    const fetcher = createUsageFetcher(usageDepsOf(d.auth))

    const snapshot = await fetcher.fetchUsage(CORP_LLM_KEY)

    expect(snapshot).toMatchObject({ providerKey: CORP_LLM_KEY, raw: 'result' })
    expect(d.fetchImpl.mock.calls.at(-1)?.[0]).toBe('https://usage.example.corp/api/usage')
    expect(d.requestHeaders.at(-1)?.has('authorization')).toBe(false)
    expectLoginFreeUntouched(d, USAGE_API.id, before)
  })

  it('(b) 401이면 reject하고 Auth change·로그인 프리 snapshot이 그대로다', async () => {
    const d = await loggedIn()
    const before = d.changes.length
    const fetcher = createUsageFetcher(usageDepsOf(d.auth))
    d.setStatus(401)

    await expect(fetcher.fetchUsage(CORP_LLM_KEY)).rejects.toThrow('usage request failed: 401')

    expect(d.fetchImpl.mock.calls.at(-1)?.[0]).toBe('https://usage.example.corp/api/usage')
    expect(d.requestHeaders.at(-1)?.has('authorization')).toBe(false)
    expectLoginFreeUntouched(d, USAGE_API.id, before)
    expect(d.auth.bind(CREDENTIAL.id).snapshot().status).toBe('valid')
  })

  it('(c) origin 미선언 대상은 요청 전에 origin_not_declared로 reject한다', async () => {
    const d = await loggedIn()
    const before = d.changes.length
    const calls = d.fetchImpl.mock.calls.length
    // 같은 factory 본문이 origin 없는 로그인 프리 대상을 받은 경우.
    const fetcher = createUsageFetcher({
      auth: {
        bind: (id) => d.auth.bind(id),
        bindLoginFreePlugin: () => d.auth.bindLoginFreePlugin(LOCAL_PLUGIN.id)
      }
    })

    await expect(fetcher.fetchUsage(CORP_LLM_KEY)).rejects.toMatchObject({
      reason: 'origin_not_declared'
    })
    expect(d.fetchImpl.mock.calls).toHaveLength(calls)
    expectLoginFreeUntouched(d, LOCAL_PLUGIN.id, before)
  })

  it('(d) supports는 배포가 지원하는 key만 참이다', () => {
    const d = deployment()
    const fetcher = createUsageFetcher(usageDepsOf(d.auth))
    expect(fetcher.supports(CORP_LLM_KEY)).toBe(true)
    expect(fetcher.supports('claude-anthropic')).toBe(false)
    expect(d.fetchImpl).not.toHaveBeenCalled()
  })
})

describe('로그인 프리 config API — HarnessConfigApiDeps 만으로 조립 (0297 AC2)', () => {
  const resolveFor = async (
    d: TestDeployment
  ): Promise<
    Awaited<ReturnType<ReturnType<typeof createHarnessRuntimeConfigService>['resolve']>>
  > =>
    createHarnessRuntimeConfigService({
      settings: { resolve: async () => undefined },
      augmenters: mergeAugmenters(createConfigApiAugmenters(configApiDepsOf(d.auth)), {})
    }).resolve({ key: CORP_LLM_KEY, harnessId: 'claude', modelProviderId: 'corp' })

  it('(a) 200이면 선언 origin 응답으로 runtimeEnv overlay를 만든다', async () => {
    const d = await loggedIn()
    const before = d.changes.length

    const config = await resolveFor(d)
    const prepared = prepareHarnessConfig({ config, baseEnv: () => ({ PATH: '/usr/bin' }) })

    expect(prepared.env?.CORP_LLM_CONFIG).toBe('result')
    expect(d.fetchImpl.mock.calls.at(-1)?.[0]).toBe('https://llm-config.example.corp/v1/config')
    expect(d.requestHeaders.at(-1)?.has('authorization')).toBe(false)
    expectLoginFreeUntouched(d, CONFIG_API.id, before)
  })

  it('(b) 403이면 resolve가 reject하고 Auth change가 없다', async () => {
    const d = await loggedIn()
    const before = d.changes.length
    d.setStatus(403)

    await expect(resolveFor(d)).rejects.toThrow('llm config request failed: 403')

    expect(d.fetchImpl.mock.calls.at(-1)?.[0]).toBe('https://llm-config.example.corp/v1/config')
    expectLoginFreeUntouched(d, CONFIG_API.id, before)
  })
})

describe('두 deps 의 bind 는 로그인 프리 id 를 해석하지 않는다 (0297 AC3 런타임)', () => {
  it('bind(loginFreeId).request는 unknown_auth로 reject한다', async () => {
    const d = deployment()
    await expect(
      usageDepsOf(d.auth).auth.bind(USAGE_API.id).request({ path: '/api/usage' })
    ).rejects.toMatchObject({ reason: 'unknown_auth' })
    await expect(
      configApiDepsOf(d.auth).auth.bind(CONFIG_API.id).request({ path: '/v1/config' })
    ).rejects.toMatchObject({ reason: 'unknown_auth' })
    expect(d.fetchImpl).not.toHaveBeenCalled()
    expect(d.changes).toEqual([])
  })
})

describe('로그인 프리 usage·harness row (0297 AC4)', () => {
  it('connect 무선언 로그인 프리 포트는 login-free 디스크립터·kind 매핑으로 투영된다', () => {
    const d = deployment()
    // 기본 행 조립이 아니라 행 조각으로 직접 조립한다(0294 D-007).
    const sources = [
      ...gateRows([d.auth.bind(CREDENTIAL.id)]),
      ...harnessRows([
        {
          auth: d.auth.bindLoginFreePlugin(CONFIG_API.id),
          harnessModelProviderKey: CORP_LLM_KEY
        }
      ]),
      ...usageRows([{ auth: d.auth.bindLoginFreePlugin(USAGE_API.id) }]),
      ...usageRows([{ auth: d.auth.bindLoginFreePlugin(LOCAL_PLUGIN.id) }])
    ]

    const rows = connectionState(d.auth, d.gate, sources, false).providers

    expect(rows[0]?.authScheme).toBe('login-required')
    const expected = [
      { id: CONFIG_API.id, kind: 'llm', origin: CONFIG_API.origin },
      { id: USAGE_API.id, kind: 'service', origin: USAGE_API.origin },
      { id: LOCAL_PLUGIN.id, kind: 'service', origin: '' }
    ]
    expected.forEach((want, index) => {
      const row = rows[index + 1]!
      expect(row).toMatchObject({
        ...want,
        authScheme: 'login-free',
        auth: [],
        status: 'valid'
      })
      expect('connection' in row).toBe(false)
    })
    expect(rows).toHaveLength(4)
  })
})

// 호출의 객체 인자 안에서만 이름과 값을 센다. import·주석·문자열은 배선이 아니다.
function runtimeArgs(source: string): string[] {
  const stripped = stripCommentsAndStrings(source)
  return [...stripped.matchAll(/createAuthRuntime\s*\(\s*\{/g)].map((match) => {
    const start = match.index! + match[0].length
    let depth = 1
    let end = start
    let directProperties = ''
    for (; end < stripped.length && depth > 0; end++) {
      const char = stripped[end]!
      if (char === '{') depth++
      if (depth === 1 && char !== '}') directProperties += char
      if (char === '}') {
        depth--
        directProperties += ' '
      }
    }
    return directProperties
  })
}

describe('Bootstrap 로그인 프리 선언 배선 (AC16)', () => {
  const argument = /\bloginFreeDefinitions\s*:\s*LOGIN_FREE_DEFINITIONS\b/
  it('실제 createAuthRuntime 호출마다 production LOGIN_FREE_DEFINITIONS를 넘긴다', () => {
    const calls = runtimeArgs(readFileSync(join(__dirname, '..', 'bootstrap.ts'), 'utf8'))
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) expect(call).toMatch(argument)
  })
  it('가드는 누락·빈 배열 교체·import·주석·문자열을 배선으로 세지 않는다', () => {
    expect(
      runtimeArgs('createAuthRuntime({ loginFreeDefinitions: LOGIN_FREE_DEFINITIONS })')[0]
    ).toMatch(argument)
    for (const source of [
      'createAuthRuntime({ definitions: AUTH_DEFINITIONS })',
      'createAuthRuntime({ loginFreeDefinitions: [] })',
      'createAuthRuntime({ loginFreeDefinitions: WRONG_DEFINITIONS })',
      'createAuthRuntime({ other: { loginFreeDefinitions: LOGIN_FREE_DEFINITIONS } })',
      'createAuthRuntime({ /* loginFreeDefinitions: LOGIN_FREE_DEFINITIONS */ })',
      "createAuthRuntime({ label: 'loginFreeDefinitions: LOGIN_FREE_DEFINITIONS' })",
      "import { LOGIN_FREE_DEFINITIONS } from './auth-definitions'"
    ]) {
      expect(runtimeArgs(source).some((call) => argument.test(call))).toBe(false)
    }
    expect(
      runtimeArgs(
        'createAuthRuntime({}) ; const other = { loginFreeDefinitions: LOGIN_FREE_DEFINITIONS }'
      )[0]
    ).not.toMatch(argument)
  })
})
