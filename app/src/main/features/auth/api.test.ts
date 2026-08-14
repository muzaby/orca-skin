// `ProviderApi` 의 세션 grant 전송 경로 (0182).
//
// **막으려는 회귀**: 0181 은 `sessions.register()` 를 로그인 실행부에서만 불렀다. 그래서
// 재시작 후에는 쿠키(파티션)와 grant(파일)가 살아 있는데 group 만 미등록이라
// `acquire()` 가 `Error('등록되지 않은 session group')` 를 던졌다 — `ProviderPolicyError` 가
// 아니라 401 강등도 타지 않아 재인증 지점조차 뜨지 않았다.
//
// 여기서는 **로그인을 한 번도 하지 않은 프로세스**를 흉내 낸다: 영속에서 복원된 session grant +
// 부팅 시 등록된 포트. `LoginService` 는 등장하지 않는다.

import { describe, expect, it, vi } from 'vitest'
import type { Grant, Provider } from '../../contracts/auth'
import type { SecretStorePort } from '../../infra/config/secret-store-port'
import type { PreparedRequest, SendResult } from '../../infra/net/transport'
import { createVault } from '../../infra/vault'
import { ProviderApiImpl, ProviderPolicyError } from './api'
import { ProviderRegistry } from './registry'
import { createMemoryGrantPersistence, ProviderStore } from './store'
import { registerDeclaredSessions, type SessionPolicySink } from './session-policies'
import type { BrowserSessionPort } from './specs/browser-session'

const WIKI: Provider = {
  id: 'wiki',
  label: 'Wiki',
  kind: 'service',
  origin: 'https://wiki.example.corp',
  auth: [
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
    send: vi.fn(async (_handleId: string, req: { url: string }) => {
      sent.push(req.url)
      return { status: 200, headers: {}, body: '{"ok":true}' }
    })
  }
}

// 로그인 없이 세션 grant 만 복원된 프로세스.
function restartedProcess(options: { registerAtBoot: boolean }): {
  api: ProviderApiImpl
  sessions: ReturnType<typeof fakeSessions>
} {
  const grant: Grant = {
    kind: 'session',
    sessionGroup: 'corp',
    authKind: 'browser-session',
    createdAt: 1_000
  }
  const registry = new ProviderRegistry([WIKI])
  const store = new ProviderStore({
    persistence: createMemoryGrantPersistence({ wiki: grant }),
    vault: createVault(fakeSecretStore())
  })
  store.restore(registry.list().map((p) => p.id))

  const sessions = fakeSessions()
  if (options.registerAtBoot) registerDeclaredSessions(sessions, registry.list())

  const api = new ProviderApiImpl({
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

describe('ProviderApiImpl — 세션 grant 전송', () => {
  it('복원된 세션 grant 는 status 가 valid 다 (vault 를 읽지 않는다)', () => {
    const registry = new ProviderRegistry([WIKI])
    const store = new ProviderStore({
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
    const registry = new ProviderRegistry([WIKI])
    const store = new ProviderStore({
      persistence: createMemoryGrantPersistence(),
      vault: createVault(fakeSecretStore())
    })
    store.restore(registry.list().map((p) => p.id))
    const sessions = fakeSessions()
    registerDeclaredSessions(sessions, registry.list())
    const api = new ProviderApiImpl({
      registry,
      store,
      fetchImpl: (() => {
        throw new Error('나가면 안 된다')
      }) as unknown as typeof fetch,
      sessions
    })

    await expect(api.request('wiki', { path: '/rest/api/content' })).rejects.toBeInstanceOf(
      ProviderPolicyError
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

const VALUE_API: Provider = {
  id: 'api',
  label: 'API',
  kind: 'service',
  origin: 'https://api.example.corp',
  auth: [
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
  mutate: (store: ProviderStore) => void,
  now: () => number
): { api: ProviderApiImpl; store: ProviderStore; sent: string[] } {
  const registry = new ProviderRegistry([VALUE_API])
  const secrets = fakeSecretStore()
  const vault = createVault(secrets)
  const grant: Grant = {
    kind: 'secret',
    vaultKey: 'api:pat',
    authKind: 'pat',
    createdAt: 0,
    expiresAt: 10_000
  }
  const store = new ProviderStore({
    persistence: createMemoryGrantPersistence({ api: grant }),
    vault,
    clock: now
  })
  store.restore(registry.list().map((p) => p.id))
  vault.set('api:pat', 'sekret', { kind: 'pat', createdAt: 0 })

  const sent: string[] = []
  const api = new ProviderApiImpl({
    registry,
    store,
    fetchImpl: redirectingFetch(sent, () => mutate(store))
  })
  return { api, store, sent }
}

describe('ProviderApiImpl — 체인 도중 grant 변경 (D1)', () => {
  it('값형: 홉 사이 revoke 면 다음 홉을 보내지 않는다', async () => {
    const { api, sent } = valueHarness(
      (store) => store.revoke('api'),
      () => 1_000
    )

    await expect(api.request('api', { path: '/thing' })).rejects.toBeInstanceOf(ProviderPolicyError)
    // 첫 홉만 나갔다 — 해제된 자격증명이 두 번째 홉에 실리지 않는다.
    expect(sent).toEqual(['https://api.example.corp/thing'])
  })

  it('값형: 홉 사이 401 강등이면 다음 홉을 보내지 않는다', async () => {
    const { api, sent } = valueHarness(
      (store) => store.markExpired('api'),
      () => 1_000
    )

    await expect(api.request('api', { path: '/thing' })).rejects.toBeInstanceOf(ProviderPolicyError)
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

    await expect(api.request('api', { path: '/thing' })).rejects.toBeInstanceOf(ProviderPolicyError)
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
    const registry = new ProviderRegistry([WIKI])
    const store = new ProviderStore({
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

    const api = new ProviderApiImpl({
      registry,
      store,
      fetchImpl: (() => {
        throw new Error('세션 grant 가 fetch 스택으로 샜다')
      }) as unknown as typeof fetch,
      sessions
    })

    await expect(api.request('wiki', { path: '/rest/api/content' })).rejects.toBeInstanceOf(
      ProviderPolicyError
    )
    expect(sessions.sent).toEqual(['https://wiki.example.corp/rest/api/content'])
  })
})
