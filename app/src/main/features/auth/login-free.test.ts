import { describe, expect, it, vi } from 'vitest'
import type {
  AuthChange,
  AuthDefinition,
  GateAuthDefinition,
  LoginFreeDefinition,
  LoginFreePluginAuth,
  PluginAuth
} from '../../contracts/auth'
import type { SecretStorePort } from '../../infra/config/secret-store-port'
import { ResponseTooLargeError } from '../../infra/net/transport'
import { createVault } from '../../infra/vault'
import { createAuthRuntime, type CreatedAuthRuntime } from './runtime'
import { createMemoryGrantPersistence, type GrantPersistencePort } from './store'

const PUBLIC: LoginFreeDefinition = {
  id: 'public-api',
  label: '공개 API',
  origin: 'https://public.example'
}
const CREDENTIAL: AuthDefinition = {
  id: 'credential-api',
  label: '인증 API',
  origin: 'https://credential.example',
  methods: []
}

function build(respond: typeof fetch = async () => new Response('ok')): CreatedAuthRuntime & {
  fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>
  changes: AuthChange[]
  persistence: GrantPersistencePort
  raw: Map<string, string>
} {
  const raw = new Map<string, string>()
  const secretStore: SecretStorePort = {
    get: (key) => raw.get(key),
    set: (key, value) => void raw.set(key, value),
    delete: (key) => void raw.delete(key)
  }
  const fetchImpl = vi.fn(respond)
  const persistence = createMemoryGrantPersistence()
  const created = createAuthRuntime({
    definitions: [CREDENTIAL],
    loginFreeDefinitions: [
      PUBLIC,
      { id: 'host-exe', label: '호스트' },
      { id: 'non-http', label: 'authority', origin: 'orca://local' }
    ],
    persistence,
    vault: createVault(secretStore),
    fetchImpl
  })
  const changes: AuthChange[] = []
  created.runtime.subscribe((change) => changes.push(change))
  return { ...created, fetchImpl, changes, persistence, raw }
}

describe('로그인 프리 런타임 — lifecycle 분리 (0248 AC4·AC8·AC9)', () => {
  it('자격증명 binder·secret reader는 로그인 프리 id를 해석하지 않는다', async () => {
    const { runtime, secretReader, fetchImpl, persistence, raw } = build()
    expect(runtime.tryBind(PUBLIC.id)).toBeNull()
    expect(secretReader.read(PUBLIC.id)).toBeNull()
    expect(runtime.bind(PUBLIC.id).snapshot().status).toBe('none')
    await expect(runtime.bind(PUBLIC.id).request({ path: '/' })).rejects.toMatchObject({
      name: 'AuthPolicyError',
      reason: 'unknown_auth'
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(persistence.load().records).toEqual({})
    expect(raw.size).toBe(0)
  })

  it('같은 id의 예전 영속 grant·vault 값도 자격증명 경로에 복원하지 않는다 (AC4)', async () => {
    const raw = new Map<string, string>()
    const vault = createVault({
      get: (key) => raw.get(key),
      set: (key, value) => void raw.set(key, value),
      delete: (key) => void raw.delete(key)
    })
    vault.set('old-key', 'old-value', { kind: 'oauth', createdAt: 0, expiresAt: 5_000 })
    const persistence = createMemoryGrantPersistence({
      [PUBLIC.id]: {
        kind: 'token',
        authKind: 'oauth',
        vaultKey: 'old-key',
        createdAt: 0,
        expiresAt: 5_000
      }
    })
    const fetchImpl = vi.fn(async () => new Response('ok'))
    const { runtime, secretReader } = createAuthRuntime({
      definitions: [],
      loginFreeDefinitions: [PUBLIC],
      persistence,
      vault,
      fetchImpl,
      clock: () => 1_000
    })
    const changes: AuthChange[] = []
    runtime.subscribe((change) => changes.push(change))
    expect(runtime.tryBind(PUBLIC.id)).toBeNull()
    expect(secretReader.read(PUBLIC.id)).toBeNull()
    expect(runtime.bind(PUBLIC.id).snapshot().status).toBe('none')
    await expect(runtime.bind(PUBLIC.id).request({ path: '/' })).rejects.toMatchObject({
      name: 'AuthPolicyError',
      reason: 'unknown_auth'
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    runtime.revoke(PUBLIC.id)
    expect(runtime.bindLoginFreePlugin(PUBLIC.id).snapshot()).toEqual({
      authId: PUBLIC.id,
      status: 'valid',
      verified: true,
      credentialRevision: 0
    })
    expect(changes.filter((change) => change.kind === 'snapshot')).toEqual([])
  })

  it('체계가 다른 plugin binder와 미등록 id는 실패한다', () => {
    const { runtime } = build()
    expect(() => runtime.bindForPlugin(PUBLIC.id)).toThrow(/bindLoginFreePlugin/)
    expect(() => runtime.bindLoginFreePlugin(CREDENTIAL.id)).toThrow(/bindForPlugin/)
    expect(() => runtime.bindLoginFreePlugin('missing')).toThrow(/unknown login-free auth/)
    const port = runtime.bindLoginFreePlugin(PUBLIC.id)
    expect('withCredential' in port).toBe(false)
    expect(port.snapshot()).toEqual({
      authId: PUBLIC.id,
      status: 'valid',
      verified: true,
      credentialRevision: 0
    })
    // 소비자의 변조가 이후 snapshot에 남지 않는다.
    port.snapshot().status = 'expired'
    expect(port.snapshot().status).toBe('valid')
  })

  it('describe는 두 체계를 구분하고 로그인 프리 methods가 항상 비어 있다', () => {
    const { runtime } = build()
    expect(runtime.describe(PUBLIC.id)).toEqual({
      scheme: 'login-free',
      authId: PUBLIC.id,
      label: PUBLIC.label,
      origin: PUBLIC.origin,
      methods: []
    })
    expect(runtime.describe('host-exe')).toEqual({
      scheme: 'login-free',
      authId: 'host-exe',
      label: '호스트',
      methods: []
    })
    expect(runtime.describe(CREDENTIAL.id)).toEqual({
      scheme: 'login-required',
      authId: CREDENTIAL.id,
      label: CREDENTIAL.label,
      origin: CREDENTIAL.origin,
      methods: []
    })
    expect(() => runtime.describe('missing')).toThrow(/unknown auth/)
  })

  it('login·reauth는 unknown_provider이고 revoke는 snapshot을 내지 않는다', async () => {
    const { runtime, changes } = build()
    const before = runtime.bindLoginFreePlugin(PUBLIC.id).snapshot()
    expect(await runtime.login(PUBLIC.id)).toMatchObject({
      kind: 'failed',
      reason: 'unknown_provider'
    })
    expect(await runtime.reauth(PUBLIC.id)).toMatchObject({
      kind: 'failed',
      reason: 'unknown_provider'
    })
    runtime.revoke(PUBLIC.id)
    await runtime.resume(PUBLIC.id)
    expect(runtime.bindLoginFreePlugin(PUBLIC.id).snapshot()).toEqual(before)
    expect(changes.filter((change) => change.kind === 'snapshot')).toEqual([])
  })
})

describe('로그인 프리 request — 런타임 경유 (0248 AC5·AC6·AC7)', () => {
  it('앱 인증 헤더를 주입하지 않고 URL·query·signal·body를 그대로 전송한다 (AC5)', async () => {
    const { runtime, fetchImpl } = build()
    const signal = new AbortController().signal
    const response = await runtime.bindLoginFreePlugin(PUBLIC.id).request(
      {
        path: '/items?existing=yes',
        query: { q: '가 나' },
        method: 'POST',
        body: 'payload'
      },
      signal
    )
    expect(response).toEqual({
      ok: true,
      status: 200,
      finalUrl: 'https://public.example/items?existing=yes&q=%EA%B0%80+%EB%82%98',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: 'ok'
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(response.finalUrl)
    expect(init).toEqual({
      method: 'POST',
      body: 'payload',
      headers: {},
      credentials: 'omit',
      redirect: 'manual',
      signal
    })
    const headers = new Headers(init?.headers)
    expect(headers.has('authorization')).toBe(false)
    expect(headers.has('cookie')).toBe(false)
  })

  it('플러그인의 Authorization·Cookie·Proxy-Authorization·임의 헤더를 통과시킨다 (AC5)', async () => {
    const { runtime, fetchImpl } = build()
    const headers = {
      Authorization: 'Bearer local-key',
      Cookie: 'local=value',
      'Proxy-Authorization': 'Local proxy-key',
      'X-Plugin': 'plugin-value'
    }
    await runtime.bindLoginFreePlugin(PUBLIC.id).request({ path: '/', headers })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]![1]?.headers).toEqual(headers)
    expect(fetchImpl.mock.calls[0]![1]?.headers).not.toBe(headers)
    expect(fetchImpl.mock.calls[0]![1]?.credentials).toBe('omit')
  })

  it.each(['https://outside.example/steal', '//outside.example/steal'])(
    '절대 경로 %s는 전송 없이 거부한다 (AC6)',
    async (path) => {
      const { runtime, fetchImpl } = build()
      await expect(runtime.bindLoginFreePlugin(PUBLIC.id).request({ path })).rejects.toMatchObject({
        name: 'AuthPolicyError',
        reason: 'absolute_path'
      })
      expect(fetchImpl).not.toHaveBeenCalled()
    }
  )

  it('origin 밖 redirect는 다음 홉 없이 거부한다 (AC6)', async () => {
    const { runtime, fetchImpl } = build(
      async () =>
        new Response('', {
          status: 302,
          headers: { location: 'https://outside.example/steal?key=local' }
        })
    )
    await expect(
      runtime.bindLoginFreePlugin(PUBLIC.id).request({
        path: '/',
        headers: { Authorization: 'Bearer local-key' }
      })
    ).rejects.toMatchObject({ name: 'AuthPolicyError', reason: 'origin_not_allowed' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('같은 origin redirect를 따라 finalUrl에 반영한다 (AC6)', async () => {
    let calls = 0
    const { runtime, fetchImpl } = build(async () =>
      ++calls === 1
        ? new Response('', { status: 302, headers: { location: '/next' } })
        : new Response('done')
    )
    const headers = { Authorization: 'Bearer local-key' }
    const response = await runtime
      .bindLoginFreePlugin(PUBLIC.id)
      .request({ path: '/first', headers })
    expect(response).toMatchObject({
      ok: true,
      status: 200,
      finalUrl: 'https://public.example/next',
      body: 'done'
    })
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://public.example/first',
      'https://public.example/next'
    ])
    expect(fetchImpl.mock.calls.map(([, init]) => init?.headers)).toEqual([headers, headers])
  })

  it('redirect는 첫 요청 + 5홉으로 멈춘다 (AC6)', async () => {
    const { runtime, fetchImpl } = build(
      async () => new Response('', { status: 302, headers: { location: '/loop' } })
    )
    const response = await runtime.bindLoginFreePlugin(PUBLIC.id).request({ path: '/' })
    expect(fetchImpl).toHaveBeenCalledTimes(6)
    expect(response).toMatchObject({
      ok: false,
      status: 302,
      finalUrl: 'https://public.example/loop'
    })
  })

  it('origin 미선언·비-HTTP origin은 전송 없이 거부한다 (AC6)', async () => {
    const { runtime, fetchImpl } = build()
    await expect(
      runtime.bindLoginFreePlugin('host-exe').request({ path: '/' })
    ).rejects.toMatchObject({ name: 'AuthPolicyError', reason: 'origin_not_declared' })
    await expect(runtime.bindLoginFreePlugin('non-http').request({ path: '/' })).rejects.toThrow(
      'HTTP request requires an HTTP origin'
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each(['text', 'binary'] as const)(
    'maxBytes는 %s 응답을 제한한다 (AC6)',
    async (responseType) => {
      const { runtime } = build(async () => new Response('12345'))
      await expect(
        runtime.bindLoginFreePlugin(PUBLIC.id).request({
          path: '/',
          responseType,
          maxBytes: 4
        })
      ).rejects.toBeInstanceOf(ResponseTooLargeError)
    }
  )

  it('binary 응답도 같은 포트 형상으로 반환한다', async () => {
    const { runtime } = build(async () => new Response(new Uint8Array([1, 2, 3])))
    expect(
      await runtime.bindLoginFreePlugin(PUBLIC.id).request({ path: '/', responseType: 'binary' })
    ).toEqual({
      ok: true,
      status: 200,
      finalUrl: 'https://public.example/',
      headers: {},
      body: '',
      bodyBytes: new Uint8Array([1, 2, 3])
    })
  })

  it.each([401, 403])(
    '%s와 authFailureStatuses에도 snapshot·change·저장소가 불변이다 (AC7)',
    async (status) => {
      const { runtime, changes, persistence, raw } = build(
        async () => new Response('denied', { status })
      )
      const auth = runtime.bindLoginFreePlugin(PUBLIC.id)
      const before = auth.snapshot()
      expect(await auth.request({ path: '/', authFailureStatuses: [401, 403] })).toMatchObject({
        ok: false,
        status,
        body: 'denied'
      })
      expect(auth.snapshot()).toEqual(before)
      expect(changes).toEqual([])
      expect(persistence.load().records).toEqual({})
      expect(raw.size).toBe(0)
    }
  )
})

// tsc가 계약 격리를 본다. 실행 시에는 대입/네트워크를 하지 않는다.
function assertContractSeparation(
  loginFree: LoginFreeDefinition,
  credential: AuthDefinition,
  port: LoginFreePluginAuth
): void {
  // @ts-expect-error 로그인 프리는 methods가 없어 자격증명 목록에 들어갈 수 없다.
  const authDefinitions: AuthDefinition[] = [loginFree]
  // @ts-expect-error 로그인 프리는 probe도 없어 gate 목록에 들어갈 수 없다.
  const gateDefinitions: GateAuthDefinition[] = [loginFree]
  // @ts-expect-error 자격증명 methods는 로그인 프리 선언의 never와 충돌한다.
  const loginFreeDefinitions: LoginFreeDefinition[] = [credential]
  // @ts-expect-error 로그인 프리 포트에는 withCredential이 없다.
  const credentialPort: PluginAuth = port
  void [authDefinitions, gateDefinitions, loginFreeDefinitions, credentialPort]
}
void assertContractSeparation

// ── 0291 — 로그인 프리 호스트 연결 ──────────────────────────────────────────────
describe('로그인 프리 호스트 연결 — 런타임 경유 (0291)', () => {
  const host = {
    installed: async () => ({ installed: true }),
    listModels: async () => []
  }

  function buildConnect(run: (context: unknown) => Promise<unknown>): CreatedAuthRuntime & {
    changes: AuthChange[]
    persistence: GrantPersistencePort
    raw: Map<string, string>
  } {
    const raw = new Map<string, string>()
    const persistence = createMemoryGrantPersistence()
    const created = createAuthRuntime({
      definitions: [CREDENTIAL],
      loginFreeDefinitions: [PUBLIC, { id: 'opencode-llm', label: 'OpenCode', connect: { run } }],
      persistence,
      vault: createVault({
        get: (key) => raw.get(key),
        set: (key, value) => void raw.set(key, value),
        delete: (key) => void raw.delete(key)
      }),
      fetchImpl: vi.fn<typeof fetch>(),
      loginFreeHost: host
    })
    const changes: AuthChange[] = []
    created.runtime.subscribe((change) => changes.push(change))
    return { ...created, changes, persistence, raw }
  }

  it('connect 선언 포트는 연결 상태를, 무선언 포트는 상수를 돌려준다', async () => {
    const { runtime } = buildConnect(async () => ['m'])
    const declared = runtime.bindLoginFreePlugin('opencode-llm')
    const plain = runtime.bindLoginFreePlugin(PUBLIC.id)
    expect(declared.snapshot()).toMatchObject({ status: 'none', connection: { state: 'idle' } })
    expect(plain.snapshot()).toEqual({
      authId: PUBLIC.id,
      status: 'valid',
      verified: true,
      credentialRevision: 0
    })
    await runtime.connect('opencode-llm')
    expect(declared.snapshot()).toMatchObject({
      status: 'valid',
      verified: true,
      credentialRevision: 1,
      connection: { state: 'connected' }
    })
  })

  it('snapshot은 두 체계와 미등록 id를 같은 형상으로 읽는다', async () => {
    const { runtime } = buildConnect(async () => ['m'])
    expect(runtime.snapshot(PUBLIC.id)).toEqual({
      authId: PUBLIC.id,
      status: 'valid',
      verified: true,
      credentialRevision: 0
    })
    expect(runtime.snapshot('opencode-llm')).toMatchObject({
      status: 'none',
      connection: { state: 'idle' }
    })
    expect(runtime.snapshot(CREDENTIAL.id)).toMatchObject({ status: 'none', verified: false })
    expect(runtime.snapshot(CREDENTIAL.id)).not.toHaveProperty('connection')
    expect(runtime.snapshot('missing')).toMatchObject({ authId: 'missing', status: 'none' })
    await runtime.connect('opencode-llm')
    expect(runtime.snapshot('opencode-llm')).toMatchObject({ status: 'valid', verified: true })
    expect(runtime.connectionValue('opencode-llm')).toEqual(['m'])
  })

  it('connect 실행 context는 signal과 주입한 host만 갖는다', async () => {
    const run = vi.fn<(context: unknown) => Promise<unknown>>(async () => null)
    const { runtime } = buildConnect(run)
    await runtime.connect('opencode-llm')
    const context = run.mock.calls[0]![0] as Record<string, unknown>
    expect(Object.keys(context).sort()).toEqual(['host', 'signal'])
    expect(context.host).toBe(host)
    expect(context.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([PUBLIC.id, CREDENTIAL.id, 'missing'])(
    'connect 선언이 없는 %s 의 connect 는 던진다',
    async (id) => {
      const { runtime } = buildConnect(async () => null)
      await expect(runtime.connect(id)).rejects.toThrow('login-free connect is not declared')
    }
  )

  it('연결 경로는 디스크를 쓰지 않는다 — 새 runtime 은 idle 에서 시작한다 (D-008)', async () => {
    const first = buildConnect(async () => ['m'])
    await first.runtime.connect('opencode-llm')
    await first.runtime.connectAll()
    expect(first.raw.size).toBe(0)
    expect(first.persistence.load().records).toEqual({})
    // 같은 저장소로 다시 만든 runtime(재시작)도 연결은 idle 이다.
    const second = createAuthRuntime({
      definitions: [CREDENTIAL],
      loginFreeDefinitions: [
        { id: 'opencode-llm', label: 'OpenCode', connect: { run: async () => [] } }
      ],
      persistence: first.persistence,
      vault: createVault({
        get: (key) => first.raw.get(key),
        set: (key, value) => void first.raw.set(key, value),
        delete: (key) => void first.raw.delete(key)
      }),
      fetchImpl: vi.fn<typeof fetch>(),
      loginFreeHost: host
    })
    expect(second.runtime.snapshot('opencode-llm').connection).toEqual({ state: 'idle' })
  })

  it('연결 전이는 Auth change 로 흐르고 무선언 대상은 change 를 내지 않는다', async () => {
    const { runtime, changes } = buildConnect(async () => ['m'])
    await runtime.connectAll()
    expect(
      changes.map((change) =>
        change.kind === 'snapshot' ? [change.authId, change.cause, change.credentialChanged] : null
      )
    ).toEqual([
      ['opencode-llm', 'connection-started', false],
      ['opencode-llm', 'connection-succeeded', true]
    ])
  })
})
