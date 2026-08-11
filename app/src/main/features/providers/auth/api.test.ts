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
import type { Grant, Provider } from '../../../contracts/provider'
import type { SecretStorePort } from '../../../infra/config/secret-facade'
import { createVault } from '../../../infra/vault'
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
