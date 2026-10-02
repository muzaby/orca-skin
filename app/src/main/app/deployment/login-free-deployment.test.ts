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
import type { RuntimeToolServer } from '../../adapters/runtime-tools'
import { authToolServerId, runtimeApprovalToolNames } from '../../adapters/runtime-tool-policy'
import { createAuthRuntime } from '../../features/auth/runtime'
import { createMemoryGrantPersistence } from '../../features/auth/store'
import { patSpec } from '../../features/auth/specs/credential'
import { createGate, selectGateMembers, type Gate } from '../../features/gate'
import { RuntimeToolRegistry } from '../../features/extensions/runtime-tool-registry'
import { createVault } from '../../infra/vault'
import { stripCommentsAndStrings } from '../../infra/source-scan'
import { connectionState } from '../connection-views'
import { createRuntimeModelAuthChangeHandler } from '../runtime-model-startup'
import { LOGIN_FREE_DEFINITIONS } from './auth-definitions'
import { createConnectionSources } from './connections'
import {
  createPluginBinding,
  createPluginBindings as productionPluginBindings,
  type PluginBinding,
  type PluginDeploymentDeps
} from './plugins'

// 가이드 §4 로그인 프리 레시피와 같은 타입·조립·요청 경로다.
const PUBLIC_API_PLUGIN = {
  id: 'public-api',
  label: '공개 API',
  origin: 'https://api.example.corp'
} satisfies LoginFreeDefinition
const LOCAL_PLUGIN = { id: 'local-tools', label: '로컬 도구' } satisfies LoginFreeDefinition
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
  const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    void _input
    void _init
    return new Response('result', { status })
  })
  const { runtime: auth, secretReader } = createAuthRuntime({
    definitions: [CREDENTIAL, EXPIRING],
    loginFreeDefinitions: [PUBLIC_API_PLUGIN, LOCAL_PLUGIN],
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
      const sources = createConnectionSources({
        auth: d.auth,
        gateMembers: [d.auth.bind(CREDENTIAL.id)],
        plugins: [plugin]
      })
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

  it('기본 production 배포는 로그인 프리 선언·Plugin·연결 행이 비어 있다 (AC15)', () => {
    const d = deployment()
    expect(LOGIN_FREE_DEFINITIONS).toEqual([])
    const plugins = productionPluginBindings({ auth: d.auth, registry: d.registry })
    expect(plugins).toEqual([])
    expect(createConnectionSources({ auth: d.auth, gateMembers: [], plugins })).toEqual([])
  })

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
    ).toEqual({ required: true, passed: false, bypassed: false })
    expect(d.secretReader.read(PUBLIC_API_PLUGIN.id)).toBeNull()
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
