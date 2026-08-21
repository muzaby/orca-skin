// `ProviderApi` 의 세션 grant 전송 경로 (0182).
//
// **막으려는 회귀**: 0181 은 `sessions.register()` 를 로그인 실행부에서만 불렀다. 그래서
// 재시작 후에는 쿠키(파티션)와 grant(파일)가 살아 있는데 group 만 미등록이라
// `acquire()` 가 `Error('등록되지 않은 session group')` 를 던졌다 — `AuthPolicyError` 가
// 아니라 401 강등도 타지 않아 재인증 지점조차 뜨지 않았다.
//
// 여기서는 **로그인을 한 번도 하지 않은 프로세스**를 흉내 낸다: 영속에서 복원된 session grant +
// 부팅 시 등록된 포트. `LoginService` 는 등장하지 않는다.

import { describe, expect, it, vi } from 'vitest'
import type { Grant, AuthDefinition } from '../../contracts/auth'
import type { SecretStorePort } from '../../infra/config/secret-store-port'
import type { PreparedRequest, SendResult } from '../../infra/net/transport'
import { createVault } from '../../infra/vault'
import { AuthenticatedRequester, AuthPolicyError } from './authenticated-request'
import { AuthRegistry } from './registry'
import { createMemoryGrantPersistence, AuthStore } from './store'
import { registerDeclaredSessions, type SessionPolicySink } from './session-policies'
import type { BrowserSessionPort } from './specs/browser-session'

const WIKI: AuthDefinition = {
  id: 'wiki',
  label: 'Wiki',
  origin: 'https://wiki.example.corp',
  methods: [
    {
      kind: 'browser-session',
      label: '통합 인증',
      config: {
        sessionGroup: 'corp',
        loginUrl: 'https://adfs.example.corp/adfs/ls',
        doneUrlPrefix: 'https://wiki.example.corp/home',
        allowedOrigins: ['https://adfs.example.corp', 'https://wiki.example.corp']
      }
    }
  ]
}

function fakeSecretStore(): SecretStorePort {
  const raw = new Map<string, string>()
  return {
    get: (name) => raw.get(name),
    set: (name, plain) => void raw.set(name, plain),
    delete: (name) => void raw.delete(name)
  }
}

// 실물 `BrowserSessionStore` 와 같은 규칙: 등록되지 않은 group 은 acquire 에서 던진다.
function fakeSessions(): BrowserSessionPort & SessionPolicySink & { sent: string[] } {
  const groups = new Set<string>()
  const sent: string[] = []
  return {
    sent,
    register: (policy) => void groups.add(policy.sessionGroup),
    acquire: (group) => {
      if (!groups.has(group)) throw new Error(`등록되지 않은 session group: ${group}`)
      return `handle-${group}`
    },
    openLoginWindow: vi.fn(async () => ({ finalUrl: '' })),
    clear: async () => undefined,
    send: vi.fn(async (_handleId: string, req: { url: string }) => {
      sent.push(req.url)
      return { status: 200, headers: {}, body: '{"ok":true}' }
    })
  }
}

// 로그인 없이 세션 grant 만 복원된 프로세스.
function restartedProcess(options: { registerAtBoot: boolean }): {
  api: AuthenticatedRequester
  sessions: ReturnType<typeof fakeSessions>
} {
  const grant: Grant = {
    kind: 'session',
    sessionGroup: 'corp',
    authKind: 'browser-session',
    createdAt: 1_000
  }
  const registry = new AuthRegistry([WIKI])
  const store = new AuthStore({
    persistence: createMemoryGrantPersistence({ wiki: grant }),
    vault: createVault(fakeSecretStore())
  })
  store.restore(registry.list().map((p) => p.id))

  const sessions = fakeSessions()
  if (options.registerAtBoot) registerDeclaredSessions(sessions, registry.list())

  const api = new AuthenticatedRequester({
    registry,
    store,
    // 세션 경로는 이 fetch 를 타지 않는다 — 타면 그 자체가 회귀다.
    fetchImpl: (() => {
      throw new Error('세션 grant 가 fetch 스택으로 샜다')
    }) as unknown as typeof fetch,
    sessions
  })
  return { api, sessions }
}

describe('AuthenticatedRequester — 세션 grant 전송', () => {
  it('복원된 세션 grant 는 status 가 valid 다 (vault 를 읽지 않는다)', () => {
    const registry = new AuthRegistry([WIKI])
    const store = new AuthStore({
      persistence: createMemoryGrantPersistence({
        wiki: {
          kind: 'session',
          sessionGroup: 'corp',
          authKind: 'browser-session',
          createdAt: 1_000
        }
      }),
      vault: createVault(fakeSecretStore())
    })
    store.restore(registry.list().map((p) => p.id))
    expect(store.status('wiki')).toBe('valid')
  })

  it('부팅 등록이 있으면 재로그인 없이 cookie jar 로 전송된다', async () => {
    const { api, sessions } = restartedProcess({ registerAtBoot: true })

    const res = await api.request('wiki', { path: '/rest/api/content' })

    expect(res.ok).toBe(true)
    expect(sessions.sent).toEqual(['https://wiki.example.corp/rest/api/content'])
  })

  it('부팅 등록이 없으면 미등록 group 으로 실패한다 — 0182 이전의 회귀', async () => {
    const { api } = restartedProcess({ registerAtBoot: false })

    await expect(api.request('wiki', { path: '/rest/api/content' })).rejects.toThrow(
      /등록되지 않은 session group/
    )
  })

  it('세션 provider 라도 grant 가 없으면 정책이 먼저 막는다', async () => {
    const registry = new AuthRegistry([WIKI])
    const store = new AuthStore({
      persistence: createMemoryGrantPersistence(),
      vault: createVault(fakeSecretStore())
    })
    store.restore(registry.list().map((p) => p.id))
    const sessions = fakeSessions()
    registerDeclaredSessions(sessions, registry.list())
    const api = new AuthenticatedRequester({
      registry,
      store,
      fetchImpl: (() => {
        throw new Error('나가면 안 된다')
      }) as unknown as typeof fetch,
      sessions
    })

    await expect(api.request('wiki', { path: '/rest/api/content' })).rejects.toBeInstanceOf(
      AuthPolicyError
    )
    expect(sessions.sent).toEqual([])
  })
})

// ── D1 회귀 (0187 r2): redirect 홉 사이에 grant 가 바뀌면 다음 홉을 보내지 않는다 ─────
//
// 0187 이 자격증명을 **요청당 1회** 해석하도록 바꾸면서(`Carrier`) 홉마다의 재평가가 사라졌다.
// 그 재평가는 성능 낭비이기도 했지만 **revoke·강등·만료를 다음 홉이 보는 유일한 경로**였다.
// 여기서 흉내 내는 것은 그 인터리빙이다 — 첫 홉이 `await` 중일 때 다른 IPC 가 store 를 민다.
//
// **carrier 마다 검사가 다르다**(변경 전 의미를 그대로 복원하기 위함):
//   session — grant identity 만. 변경 전에도 홉마다 `expiresAt` 을 보지 않았다.
//   value   — identity + expiry. 변경 전 `store.secret()` 이 만료를 다시 봤다.

const VALUE_API: AuthDefinition = {
  id: 'api',
  label: 'API',
  origin: 'https://api.example.corp',
  methods: [
    {
      kind: 'pat',
      label: 'PAT',
      fields: [{ name: 'token', label: '토큰', type: 'password', required: true }],
      present: { location: 'header', name: 'authorization', scheme: 'bearer' },
      compose: (input) => ({ value: input.token ?? '' })
    }
  ]
}

// 첫 홉에서 302 를 주기 **직전에** `mutate()` 로 store 를 민다 — 요청이 await 중인 그 순간이다.
function redirectingFetch(sent: string[], mutate: () => void): typeof fetch {
  return (async (url: string) => {
    sent.push(String(url))
    if (sent.length === 1) {
      mutate()
      return {
        status: 302,
        headers: new Headers({ location: 'https://api.example.corp/next' }),
        text: async () => ''
      }
    }
    return { status: 200, headers: new Headers(), text: async () => '{"ok":true}' }
  }) as unknown as typeof fetch
}

function valueHarness(
  mutate: (store: AuthStore) => void,
  now: () => number
): { api: AuthenticatedRequester; store: AuthStore; sent: string[] } {
  const registry = new AuthRegistry([VALUE_API])
  const secrets = fakeSecretStore()
  const vault = createVault(secrets)
  const grant: Grant = {
    kind: 'secret',
    vaultKey: 'api:pat',
    authKind: 'pat',
    createdAt: 0,
    expiresAt: 10_000
  }
  const store = new AuthStore({
    persistence: createMemoryGrantPersistence({ api: grant }),
    vault,
    clock: now
  })
  store.restore(registry.list().map((p) => p.id))
  vault.set('api:pat', 'sekret', { kind: 'pat', createdAt: 0 })

  const sent: string[] = []
  const api = new AuthenticatedRequester({
    registry,
    store,
    fetchImpl: redirectingFetch(sent, () => mutate(store))
  })
  return { api, store, sent }
}

describe('AuthenticatedRequester — 체인 도중 grant 변경 (D1)', () => {
  it('값형: 홉 사이 revoke 면 다음 홉을 보내지 않는다', async () => {
    const { api, sent } = valueHarness(
      (store) => store.revoke('api'),
      () => 1_000
    )

    await expect(api.request('api', { path: '/thing' })).rejects.toBeInstanceOf(AuthPolicyError)
    // 첫 홉만 나갔다 — 해제된 자격증명이 두 번째 홉에 실리지 않는다.
    expect(sent).toEqual(['https://api.example.corp/thing'])
  })

  it('값형: 홉 사이 401 강등이면 다음 홉을 보내지 않는다', async () => {
    const { api, sent } = valueHarness(
      (store) => store.markExpired('api'),
      () => 1_000
    )

    await expect(api.request('api', { path: '/thing' })).rejects.toBeInstanceOf(AuthPolicyError)
    expect(sent).toEqual(['https://api.example.corp/thing'])
  })

  it('값형: 홉 사이 자연 만료면 다음 홉을 보내지 않는다 (객체 identity 만으로는 못 잡는 자리)', async () => {
    // grant 객체는 **교체되지 않는다** — Map 엔트리가 그대로다. 만료만 지나간다.
    let now = 1_000
    const { api, sent, store } = valueHarness(
      () => {
        now = 20_000
      },
      () => now
    )

    await expect(api.request('api', { path: '/thing' })).rejects.toBeInstanceOf(AuthPolicyError)
    expect(sent).toEqual(['https://api.example.corp/thing'])
    // identity 는 살아 있다 — 그래서 identity 검사만으로는 이 경로가 뚫린다.
    expect(store.get('api')).toBeDefined()
  })

  it('값형: 아무것도 바뀌지 않으면 체인은 정상 완주한다', async () => {
    const { api, sent } = valueHarness(
      () => undefined,
      () => 1_000
    )

    const res = await api.request('api', { path: '/thing' })

    expect(res.ok).toBe(true)
    expect(sent).toEqual(['https://api.example.corp/thing', 'https://api.example.corp/next'])
  })

  it('세션: 홉 사이 revoke 면 다음 홉을 보내지 않는다', async () => {
    const grant: Grant = {
      kind: 'session',
      sessionGroup: 'corp',
      authKind: 'browser-session',
      createdAt: 1_000
    }
    const registry = new AuthRegistry([WIKI])
    const store = new AuthStore({
      persistence: createMemoryGrantPersistence({ wiki: grant }),
      vault: createVault(fakeSecretStore())
    })
    store.restore(registry.list().map((p) => p.id))

    const sessions = fakeSessions()
    registerDeclaredSessions(sessions, registry.list())
    // 첫 홉에서 302 + 그 순간 revoke.
    sessions.send = vi.fn(async (_handleId: string, req: PreparedRequest): Promise<SendResult> => {
      sessions.sent.push(req.url)
      if (sessions.sent.length === 1) {
        store.revoke('wiki')
        return { status: 302, headers: { location: 'https://wiki.example.corp/next' }, body: '' }
      }
      return { status: 200, headers: {}, body: '{"ok":true}' }
    })

    const api = new AuthenticatedRequester({
      registry,
      store,
      fetchImpl: (() => {
        throw new Error('세션 grant 가 fetch 스택으로 샜다')
      }) as unknown as typeof fetch,
      sessions
    })

    await expect(api.request('wiki', { path: '/rest/api/content' })).rejects.toBeInstanceOf(
      AuthPolicyError
    )
    expect(sessions.sent).toEqual(['https://wiki.example.corp/rest/api/content'])
  })
})

// ── 0195 · browser-session 교환이 만든 token grant ────────────────────────────
//
// **막으려는 회귀**: `presentationOf` 가 browser-session 에 무조건 `null` 을 돌려줬다. 그래서
// 교환이 성공해 token grant 가 커밋돼도 그 grant 로는 아무 요청도 나가지 못했고
// (`grant_not_valid`), `probe` 를 선언한 배포는 로그인 자체가 `probe_failed` 로 끝났다.
//
// 이 블록은 **선언한 `present` 가 실제 요청 헤더에 도달하는가** 를 센다 — 함수가 불렸는가가
// 아니라 나간 요청이 무엇을 실었는가다.

const EXCHANGED: AuthDefinition = {
  id: 'sso',
  label: '사내 로그인',
  origin: 'https://portal.example.corp',
  methods: [
    {
      kind: 'browser-session',
      label: '통합 인증',
      config: {
        sessionGroup: 'corp',
        loginUrl: 'https://adfs.example.corp/adfs/ls',
        doneUrlPrefix: 'https://portal.example.corp/home',
        allowedOrigins: ['https://adfs.example.corp', 'https://portal.example.corp'],
        exchange: {
          path: '/api/token',
          valuePath: 'access_token',
          code: {},
          present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
        }
      }
    }
  ]
}

// 교환이 끝난 뒤의 프로세스 — token grant 하나가 복원돼 있다.
function tokenGrantHarness(): {
  api: AuthenticatedRequester
  headers: Record<string, string>[]
} {
  const registry = new AuthRegistry([EXCHANGED])
  const vault = createVault(fakeSecretStore())
  const grant: Grant = {
    kind: 'token',
    vaultKey: 'sso:browser-session@v1',
    authKind: 'browser-session',
    createdAt: 1_000
  }
  const store = new AuthStore({
    persistence: createMemoryGrantPersistence({ sso: grant }),
    vault
  })
  store.restore(registry.list().map((p) => p.id))
  vault.set('sso:browser-session@v1', 'tok-abc', { kind: 'browser-session', createdAt: 1_000 })

  const headers: Record<string, string>[] = []
  const api = new AuthenticatedRequester({
    registry,
    store,
    fetchImpl: (async (_url: string, init: { headers: Record<string, string> }) => {
      headers.push(init.headers)
      return { status: 200, headers: new Headers(), text: async () => '{"ok":true}' }
    }) as unknown as typeof fetch
  })
  return { api, headers }
}

describe('AuthenticatedRequester — browser-session token grant (0195)', () => {
  it('선언한 present 대로 Authorization: Bearer 가 실린다', async () => {
    const { api, headers } = tokenGrantHarness()

    const res = await api.request('sso', { path: '/api/thing' })

    expect(res.ok).toBe(true)
    expect(headers).toHaveLength(1)
    expect(headers[0]?.['Authorization']).toBe('Bearer tok-abc')
  })

  it('present 를 선언하지 않은 방식은 여전히 실을 방법이 없다 — kind 로 추론하지 않는다', async () => {
    // `exchange` 없는 browser-session 선언에 token grant 가 들어오는 것은 D-006 이후 만들어질
    // 수 없는 조합이지만, 그때도 조용히 무언가를 실어 보내지 않는 것이 계약이다.
    const registry = new AuthRegistry([WIKI])
    const vault = createVault(fakeSecretStore())
    const store = new AuthStore({
      persistence: createMemoryGrantPersistence({
        wiki: {
          kind: 'token',
          vaultKey: 'wiki:browser-session@v1',
          authKind: 'browser-session',
          createdAt: 1_000
        }
      }),
      vault
    })
    store.restore(registry.list().map((p) => p.id))
    vault.set('wiki:browser-session@v1', 'tok', { kind: 'browser-session', createdAt: 1_000 })

    const api = new AuthenticatedRequester({
      registry,
      store,
      fetchImpl: (() => {
        throw new Error('present 가 없는데 나갔다')
      }) as unknown as typeof fetch
    })

    await expect(api.request('wiki', { path: '/thing' })).rejects.toBeInstanceOf(AuthPolicyError)
  })
})

// ── 0195 D-004 · 세션 grant 의 만료 판정 ──────────────────────────────────────
//
// SSO 는 세션이 죽으면 401 이 아니라 **IdP 로그인 폼을 200 으로** 준다. status 만 보면 그 200 을
// 성공으로 읽고, 세션 Auth 는 영원히 `valid` 인 채 모든 요청이 로그인 폼을 받는다.

function sessionDemotionHarness(respond: (sent: string[]) => SendResult | Promise<SendResult>): {
  api: AuthenticatedRequester
  store: AuthStore
  sessions: ReturnType<typeof fakeSessions>
  unauthorized: { authId: string; credentialChanged: boolean }[]
} {
  const grant: Grant = {
    kind: 'session',
    sessionGroup: 'corp',
    authKind: 'browser-session',
    createdAt: 1_000
  }
  const registry = new AuthRegistry([WIKI])
  const store = new AuthStore({
    persistence: createMemoryGrantPersistence({ wiki: grant }),
    vault: createVault(fakeSecretStore())
  })
  store.restore(registry.list().map((p) => p.id))

  const sessions = fakeSessions()
  registerDeclaredSessions(sessions, registry.list())
  sessions.send = vi.fn(async (_handleId: string, req: PreparedRequest): Promise<SendResult> => {
    sessions.sent.push(req.url)
    return respond(sessions.sent)
  })

  const unauthorized: { authId: string; credentialChanged: boolean }[] = []
  const api = new AuthenticatedRequester({
    registry,
    store,
    fetchImpl: (() => {
      throw new Error('세션 grant 가 fetch 스택으로 샜다')
    }) as unknown as typeof fetch,
    sessions,
    onUnauthorized: (authId, credentialChanged) =>
      void unauthorized.push({ authId, credentialChanged })
  })
  return { api, store, sessions, unauthorized }
}

describe('AuthenticatedRequester — 세션 grant 의 강등 (0195 D-004)', () => {
  it('401 이면 expired 로 강등된다', async () => {
    const { api, store, unauthorized } = sessionDemotionHarness(() => ({
      status: 401,
      headers: {},
      body: ''
    }))

    const res = await api.request('wiki', { path: '/rest/api/content' })

    expect(res.status).toBe(401)
    expect(store.status('wiki')).toBe('expired')
    expect(unauthorized).toEqual([{ authId: 'wiki', credentialChanged: true }])
  })

  it('200 이어도 체인이 origin 밖에서 끝나면 expired 이고 통지는 1회다', async () => {
    // allowedOrigins 안의 IdP 로 302 → 그 폼이 200 으로 끝난다. 홉 정책은 통과하지만
    // **인증은 성립하지 않았다**.
    const { api, store, sessions, unauthorized } = sessionDemotionHarness((sent): SendResult =>
      sent.length === 1
        ? { status: 302, headers: { location: 'https://adfs.example.corp/adfs/ls' }, body: '' }
        : { status: 200, headers: {}, body: '<html>login</html>' }
    )

    const res = await api.request('wiki', { path: '/rest/api/content' })

    expect(res.status).toBe(200)
    expect(res.finalUrl).toBe('https://adfs.example.corp/adfs/ls')
    expect(sessions.sent).toEqual([
      'https://wiki.example.corp/rest/api/content',
      'https://adfs.example.corp/adfs/ls'
    ])
    expect(store.status('wiki')).toBe('expired')
    // sink 는 하나이고 프로덕션 호출부도 하나다 — 같은 강등이 두 번 나가면 부팅 방송 상한의
    // 강등 항이 두 배가 된다(`auth.md §5.2`).
    expect(unauthorized).toEqual([{ authId: 'wiki', credentialChanged: true }])
  })

  it('체인이 origin 으로 돌아오면 강등하지 않는다', async () => {
    const { api, store, unauthorized } = sessionDemotionHarness((sent): SendResult => {
      if (sent.length === 1) {
        return { status: 302, headers: { location: 'https://adfs.example.corp/adfs/ls' }, body: '' }
      }
      if (sent.length === 2) {
        return {
          status: 302,
          headers: { location: 'https://wiki.example.corp/rest/api/content' },
          body: ''
        }
      }
      return { status: 200, headers: {}, body: '{"ok":true}' }
    })

    const res = await api.request('wiki', { path: '/rest/api/content' })

    expect(res.ok).toBe(true)
    expect(store.status('wiki')).toBe('valid')
    expect(unauthorized).toEqual([])
  })

  it('값형 grant 는 origin 판정을 받지 않는다 — 없던 정책을 새로 만들지 않는다', async () => {
    // 값형의 체인은 `redirectOrigins` 가 definition.origin 하나로 묶어 두므로 밖에서 끝날 수
    // 없다. 리다이렉트 없이 200 으로 끝나는 정상 요청이 강등되지 않는 것을 센다.
    const { api, sent } = valueHarness(
      () => undefined,
      () => 1_000
    )

    const res = await api.request('api', { path: '/thing' })

    expect(res.ok).toBe(true)
    expect(sent).toHaveLength(2)
  })
})
