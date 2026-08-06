// Broker 통합 — application/connector 가 **같은 lifecycle** 을 타는지, 그리고 raw secret 이
// 나가는 표면이 없는지 확인한다 (AC3·4·7·8·10).

import { describe, expect, it, vi } from 'vitest'
import { AuthBroker, MAX_REDIRECT_HOPS } from './broker'
import { AuthRegistry } from './registry'
import { DEFAULT_LOGIN_TIMEOUT_MS } from './transactions'
import { createStaticCredentialProvider } from './providers/static-credential'
import { createBasicCredentialProvider } from './providers/basic-credential'
import { createAdfsWiaProvider } from './providers/corp-adfs-wia'
import { createCredentialVault } from '../../infra/auth/credential-vault'
import type { SecretStorePort } from '../../infra/config/secret-facade'
import type { AuthPlatformState, AuthStepInfo, AuthTarget } from '../../../shared/ipc'
import type {
  AuthProviderV1,
  AuthStep,
  BrowserSessionCapability
} from '../../contracts/auth-plugin'

const ORIGIN = 'https://wiki.corp.invalid'
const APP: AuthTarget = { kind: 'application', applicationId: 'orca' }
const WIKI: AuthTarget = { kind: 'connector', connectorId: 'wiki', connectionId: 'c1' }
const JIRA: AuthTarget = { kind: 'connector', connectorId: 'jira', connectionId: 'c1' }

function fakeStore(): SecretStorePort & { raw: Map<string, string> } {
  const raw = new Map<string, string>()
  return {
    raw,
    get: (n) => raw.get(n),
    set: (n, v) => void raw.set(n, v),
    delete: (n) => void raw.delete(n)
  }
}

// PAT 와 ADFS 는 **서로 다른 패키지**다. 0172 부터 한 패키지가 기여한 application provider 들은
// 하나의 로그인 체인이므로, "둘 중 아무거나로 로그인한다" 를 표현하려면 패키지를 나눠야 한다.
// (체인 자체는 아래 `chainHarness` 가 하나의 패키지로 검증한다.)

interface Harness {
  broker: AuthBroker
  store: ReturnType<typeof fakeStore>
  states: AuthPlatformState[]
  sessions: { cleared: Array<{ handleId: string; scope: string }> }
}

function harness(
  browserOverrides: Partial<BrowserSessionCapability> & {
    onBindingsEnded?: (bindingIds: readonly string[]) => Promise<void>
    patContinue?: AuthProviderV1['continue']
    patLogout?: AuthProviderV1['logout']
  } = {}
): Harness {
  const { onBindingsEnded, patContinue, patLogout, ...sessionOverrides } = browserOverrides
  const store = fakeStore()
  const registry = new AuthRegistry()
  const cleared: Array<{ handleId: string; scope: string }> = []

  const staticPat = createStaticCredentialProvider({
    id: 'pat',
    pluginId: 'corp',
    label: 'PAT',
    mechanism: 'personal_access_token'
  })
  const pat: AuthProviderV1 = {
    ...staticPat,
    ...(patContinue !== undefined ? { continue: patContinue } : {}),
    ...(patLogout !== undefined ? { logout: patLogout } : {})
  }

  const errors = registry.register({ providers: [pat] })
  expect(errors).toEqual([])
  const adfsErrors = registry.register({
    providers: [
      createAdfsWiaProvider({
        id: 'adfs',
        pluginId: 'corp-adfs',
        label: 'ADFS',
        sessionGroup: 'corp-adfs',
        loginUrl: `${ORIGIN}/login`,
        doneUrlPrefix: `${ORIGIN}/home`,
        authenticationProbeUrl: `${ORIGIN}/me`,
        allowedOrigins: [ORIGIN]
      })
    ]
  })
  expect(adfsErrors).toEqual([])

  const states: AuthPlatformState[] = []
  const deps: ConstructorParameters<typeof AuthBroker>[0] & {
    onBindingsEnded?: (bindingIds: readonly string[]) => Promise<void>
  } = {
    registry,
    vaultFor: (prefix) => createCredentialVault(store, prefix),
    fetchImpl: stubFetch,
    browserSessions: {
      acquire: async (group) => `handle:${group}`,
      openLoginWindow: async () => ({ finalUrl: `${ORIGIN}/home` }),
      probe: async () => ({ ok: true, status: 200, finalUrl: `${ORIGIN}/me` }),
      clear: async (handleId, opts) => void cleared.push({ handleId, scope: opts.scope }),
      ...sessionOverrides
    },
    broadcast: (s) => states.push(s),
    ...(onBindingsEnded !== undefined ? { onBindingsEnded } : {})
  }
  const broker = new AuthBroker(deps)
  return { broker, store, states, sessions: { cleared } }
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function loginPat(
  broker: AuthBroker,
  target: AuthTarget,
  value = 'pat-secret'
): Promise<AuthStepInfo> {
  const step = await broker.begin('pat', target)
  expect(step.kind).toBe('collect')
  if (step.kind !== 'collect') throw new Error('unreachable')
  return broker.continue(step.transactionId, { credential: value })
}

// 0173 — `fetchImpl` 은 필수다(전역 fetch 로 되돌아가지 않게). 이 스위트는 원격에
// 나가지 않으므로 빈 응답 스텁을 준다; 실제 호출을 보는 케이스는 자기 것을 주입한다.
const stubFetch: typeof fetch = async () => new Response('{}', { status: 200 })

describe('AuthBroker — application/connector 공통 lifecycle', () => {
  it('AC3 — 같은 provider·같은 메서드로 application 과 connector binding 을 만든다', async () => {
    const { broker } = harness()

    const appStep = await loginPat(broker, APP)
    const wikiStep = await loginPat(broker, WIKI)

    expect(appStep.kind).toBe('done')
    expect(wikiStep.kind).toBe('done')
    expect(broker.listBindings()).toHaveLength(2)
    // target 만 다르고 provider 는 하나다.
    expect(new Set(broker.listBindings().map((b) => b.providerId))).toEqual(new Set(['pat']))
  })

  it('AC4 — binding·status DTO 에 raw secret 이 없다', async () => {
    const { broker, store } = harness()
    await loginPat(broker, WIKI, 'super-secret-pat')

    const serialized = JSON.stringify({
      bindings: broker.listBindings(),
      status: broker.status()
    })
    expect(serialized).not.toMatch(/super-secret-pat/)
    // 값은 vault 에만 존재한다.
    expect([...store.raw.values()]).toContain('super-secret-pat')
  })

  it('브로드캐스트된 상태에도 raw secret 이 없다', async () => {
    const { broker, states } = harness()
    await loginPat(broker, APP, 'super-secret-pat')
    expect(JSON.stringify(states)).not.toMatch(/super-secret-pat/)
  })

  it('application 인증 후 게이트가 통과 상태가 된다', async () => {
    const { broker } = harness()
    expect(broker.status().required).toBe(true)
    expect(broker.status().authenticated).toBe(false)
    await loginPat(broker, APP)
    expect(broker.status().authenticated).toBe(true)
  })

  it('등록 provider 가 0개면 required=false (게이트 없음 — 신규 설치 기본값)', () => {
    const broker = new AuthBroker({
      registry: new AuthRegistry(),
      vaultFor: (prefix) => createCredentialVault(fakeStore(), prefix),
      fetchImpl: stubFetch,
      browserSessions: {
        acquire: async () => 'h',
        openLoginWindow: async () => ({ finalUrl: '' }),
        probe: async () => ({ ok: false, status: 0, finalUrl: '' }),
        clear: async () => undefined
      },
      broadcast: () => undefined
    })
    expect(broker.status().required).toBe(false)
  })

  it('선언하지 않은 target 으로는 인증할 수 없다', async () => {
    const { broker } = harness()
    const registry = new AuthRegistry()
    registry.register({
      providers: [
        createStaticCredentialProvider({
          id: 'conn-only',
          pluginId: 'x',
          label: 'C',
          mechanism: 'api_key'
        })
      ]
    })
    // static-credential 은 두 target 을 다 선언하므로 broker 레벨 거부를 직접 확인한다.
    const step = await broker.begin('unknown-provider', APP)
    expect(step.kind).toBe('failed')
  })
})

describe('AuthBroker — logout 의존성 (AC7)', () => {
  it('connector-only disconnect 는 앱 로그인과 형제 연결을 남긴다', async () => {
    const { broker } = harness()
    await loginPat(broker, APP)
    const wiki = await loginPat(broker, WIKI)
    await loginPat(broker, JIRA)
    if (wiki.kind !== 'done') throw new Error('unreachable')

    const outcome = await broker.logout(wiki.binding.id, false)

    expect(outcome.kind).toBe('logged_out')
    expect(broker.status().authenticated).toBe(true)
    expect(broker.listBindings().map((b) => b.target.kind)).toEqual(
      expect.arrayContaining(['application', 'connector'])
    )
    expect(broker.listBindings()).toHaveLength(2)
  })

  it('logout 은 해당 binding 의 vault 잔여물을 지운다', async () => {
    const { broker, store } = harness()
    const wiki = await loginPat(broker, WIKI, 'to-be-erased')
    if (wiki.kind !== 'done') throw new Error('unreachable')

    await broker.logout(wiki.binding.id, false)

    expect([...store.raw.values()]).not.toContain('to-be-erased')
  })

  it('ADFS connector 해제는 origin 쿠키만 지우고 공유 group 을 비우지 않는다', async () => {
    const { broker, sessions } = harness()
    const step = await broker.begin('adfs', WIKI)
    expect(step.kind).toBe('done')
    if (step.kind !== 'done') throw new Error('unreachable')

    await broker.logout(step.binding.id, false)

    expect(sessions.cleared).toEqual([{ handleId: 'handle:corp-adfs', scope: 'origin' }])
  })

  it('ADFS 앱 로그아웃은 session group 전체를 정리한다', async () => {
    const { broker, sessions } = harness()
    const step = await broker.begin('adfs', APP)
    if (step.kind !== 'done') throw new Error('unreachable')

    await broker.logout(step.binding.id, true)

    expect(sessions.cleared).toEqual([{ handleId: 'handle:corp-adfs', scope: 'group' }])
  })
})

describe('AuthBroker — ADFS 세션 공유 (AC6)', () => {
  it('같은 session group 을 쓰는 두 대상이 같은 handle 을 공유한다', async () => {
    const acquire = vi.fn(async (group: string) => `handle:${group}`)
    const { broker } = harness({ acquire })

    const app = await broker.begin('adfs', APP)
    const wiki = await broker.begin('adfs', WIKI)

    expect(app.kind).toBe('done')
    expect(wiki.kind).toBe('done')
    if (app.kind !== 'done' || wiki.kind !== 'done') throw new Error('unreachable')
    expect(app.binding.artifact).toEqual(wiki.binding.artifact)
    // 두 번째 로그인은 창을 다시 띄우지 않는다 — 살아 있는 세션을 재사용한다.
    expect(acquire).toHaveBeenCalledTimes(2)
  })

  it('세션이 없으면 로그인 창을 열고, 있으면 열지 않는다', async () => {
    let authenticated = false
    const openLoginWindow = vi.fn(async () => {
      authenticated = true
      return { finalUrl: `${ORIGIN}/home` }
    })
    const { broker } = harness({
      openLoginWindow,
      probe: async () => ({ ok: authenticated, status: authenticated ? 200 : 401, finalUrl: '' })
    })

    await broker.begin('adfs', APP)
    expect(openLoginWindow).toHaveBeenCalledTimes(1)

    // 두 번째 서비스 연결은 재입력 없이 통과한다.
    await broker.begin('adfs', WIKI)
    expect(openLoginWindow).toHaveBeenCalledTimes(1)
  })
})

describe('AuthBroker — MCP binding 해석 (AC10)', () => {
  it('valid binding 의 credential 을 돌려준다', async () => {
    const { broker } = harness()
    const wiki = await loginPat(broker, WIKI, 'mcp-token')
    if (wiki.kind !== 'done') throw new Error('unreachable')
    expect(broker.resolveBindingCredential(wiki.binding.id)).toBe('mcp-token')
  })

  it('알 수 없는 binding 은 null', () => {
    const { broker } = harness()
    expect(broker.resolveBindingCredential('nope')).toBeNull()
  })

  it('browser session binding 은 값으로 전달할 수 없다', async () => {
    const { broker } = harness()
    const step = await broker.begin('adfs', WIKI)
    if (step.kind !== 'done') throw new Error('unreachable')
    expect(broker.resolveBindingCredential(step.binding.id)).toBeNull()
  })

  it('logout 된 binding 은 해석되지 않는다', async () => {
    const { broker } = harness()
    const wiki = await loginPat(broker, WIKI, 'mcp-token')
    if (wiki.kind !== 'done') throw new Error('unreachable')
    await broker.logout(wiki.binding.id, false)
    expect(broker.resolveBindingCredential(wiki.binding.id)).toBeNull()
  })
})

describe('AuthBroker — 입력 검증', () => {
  it('빈 credential 을 거부한다', async () => {
    const { broker } = harness()
    const step = await broker.begin('pat', WIKI)
    if (step.kind !== 'collect') throw new Error('unreachable')
    const result = await broker.continue(step.transactionId, { credential: '   ' })
    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') expect(result.reason).toBe('invalid_input')
  })

  it('만료·취소된 transaction 을 거부한다', async () => {
    const { broker } = harness()
    const result = await broker.continue('tx_does_not_exist', {})
    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') expect(result.reason).toBe('cancelled')
  })
})

// 0157 verify r1 / D3 — authenticatedFetch 의 주입 경로가 실제로 도는지 확인한다.
// `applyPresentation` 단위 검증은 `infra/auth/authenticated-fetch.test.ts` 가 담당하고,
// 여기서는 **broker 가 그것을 올바른 입력으로 부르는지** 를 본다.
describe('AuthBroker — authenticatedFetch (AC8 경로)', () => {
  function connectorHarness(): {
    broker: AuthBroker
    sent: Array<{ url: string; headers: Record<string, string> }>
  } {
    const store = fakeStore()
    const registry = new AuthRegistry()
    const sent: Array<{ url: string; headers: Record<string, string> }> = []
    const errors = registry.register({
      providers: [
        createStaticCredentialProvider({
          id: 'pat',
          pluginId: 'corp',
          label: 'PAT',
          mechanism: 'personal_access_token'
        })
      ],
      connectors: [
        {
          descriptor: {
            id: 'wiki',
            pluginId: 'corp',
            label: 'Wiki',
            acceptedAuthProviders: ['pat'],
            baseUrl: ORIGIN,
            presentation: { location: 'header', name: 'PRIVATE-TOKEN' }
          },
          start: async () => ({ health: 'ready' }),
          invoke: async () => ({ ok: true, data: null }),
          stop: async () => undefined
        }
      ]
    })
    expect(errors).toEqual([])
    const broker = new AuthBroker({
      registry,
      vaultFor: (prefix) => createCredentialVault(store, prefix),
      fetchImpl: stubFetch,
      browserSessions: {
        acquire: async (g) => `handle:${g}`,
        openLoginWindow: async () => ({ finalUrl: '' }),
        probe: async () => ({ ok: true, status: 200, finalUrl: '' }),
        clear: async () => undefined
      },
      broadcast: () => undefined,
      sender: {
        send: async (r) => {
          sent.push({ url: r.url, headers: r.headers })
          return { status: 200, headers: {}, body: '{}' }
        }
      }
    })
    return { broker, sent }
  }

  it('connector manifest 의 presentation 대로 주입한다 — kind 에서 추론하지 않는다', async () => {
    const { broker, sent } = connectorHarness()
    const target: AuthTarget = { kind: 'connector', connectorId: 'wiki', connectionId: 'c1' }
    const begun = await broker.begin('pat', target)
    if (begun.kind !== 'collect') throw new Error('unreachable')
    const done = await broker.continue(begun.transactionId, { credential: 'pat-value' })
    if (done.kind !== 'done') throw new Error('unreachable')

    await broker.authenticatedFetch({
      bindingId: done.binding.id,
      connectorId: 'wiki',
      method: 'GET',
      path: '/rest/api/content'
    })

    // PAT 인데 Bearer 가 아니라 manifest 가 선언한 전용 header 로 나간다.
    expect(sent[0].headers['PRIVATE-TOKEN']).toBe('pat-value')
    expect(sent[0].headers.Authorization).toBeUndefined()
    expect(sent[0].url).toBe(`${ORIGIN}/rest/api/content`)
  })

  it('connector 가 Authorization 을 직접 실으면 거부한다 (header spoofing)', async () => {
    const { broker } = connectorHarness()
    const target: AuthTarget = { kind: 'connector', connectorId: 'wiki', connectionId: 'c1' }
    const begun = await broker.begin('pat', target)
    if (begun.kind !== 'collect') throw new Error('unreachable')
    const done = await broker.continue(begun.transactionId, { credential: 'pat-value' })
    if (done.kind !== 'done') throw new Error('unreachable')

    await expect(
      broker.authenticatedFetch({
        bindingId: done.binding.id,
        connectorId: 'wiki',
        method: 'GET',
        path: '/x',
        headers: { Authorization: 'Bearer stolen' }
      })
    ).rejects.toThrow(/reserved_header/)
  })

  it('절대 URL 로 baseUrl 을 우회하려는 요청을 거부한다', async () => {
    const { broker } = connectorHarness()
    const target: AuthTarget = { kind: 'connector', connectorId: 'wiki', connectionId: 'c1' }
    const begun = await broker.begin('pat', target)
    if (begun.kind !== 'collect') throw new Error('unreachable')
    const done = await broker.continue(begun.transactionId, { credential: 'pat-value' })
    if (done.kind !== 'done') throw new Error('unreachable')

    await expect(
      broker.authenticatedFetch({
        bindingId: done.binding.id,
        connectorId: 'wiki',
        method: 'GET',
        path: 'https://evil.invalid/steal'
      })
    ).rejects.toThrow(/absolute_path/)
  })
})

// ── 0160: redirect 추종 + mechanism 별 presentation ────────────────────────────
//
// `createSender` 는 `redirect:'manual'` 인데 0160 이전에는 `checkRedirect` 의 **프로덕션
// 호출자가 0개**였다 — 302 가 빈 본문 응답으로 그대로 반환되어 첨부 다운로드가 빈 파일로
// 끝났다. 여기서 그 배선을 고정한다.
describe('AuthBroker — redirect 추종과 mechanism 별 presentation (0160)', () => {
  interface Sent {
    url: string
    method: string
    headers: Record<string, string>
  }

  function harness(opts: {
    responses: Array<{ status: number; headers?: Record<string, string>; body?: string }>
    presentations?: Record<string, unknown>
  }): { broker: AuthBroker; sent: Sent[] } {
    const store = fakeStore()
    const registry = new AuthRegistry()
    const sent: Sent[] = []
    const errors = registry.register({
      providers: [
        createStaticCredentialProvider({
          id: 'pat',
          pluginId: 'corp',
          label: 'PAT',
          mechanism: 'personal_access_token',
          // 서비스 연결 전용 — application 을 열면 앱 로그인 게이트가 켜진다.
          targets: ['connector']
        }),
        createBasicCredentialProvider({ id: 'idpw', pluginId: 'corp', label: 'ID/PW' })
      ],
      connectors: [
        {
          descriptor: {
            id: 'wiki',
            pluginId: 'corp',
            label: 'Wiki',
            acceptedAuthProviders: ['pat', 'idpw'],
            baseUrl: ORIGIN,
            presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' },
            ...(opts.presentations !== undefined
              ? { presentations: opts.presentations as never }
              : {})
          },
          start: async () => ({ health: 'ready' }),
          invoke: async () => ({ ok: true, data: null }),
          stop: async () => undefined
        }
      ]
    })
    expect(errors).toEqual([])

    let hop = 0
    const broker = new AuthBroker({
      registry,
      vaultFor: (prefix) => createCredentialVault(store, prefix),
      fetchImpl: stubFetch,
      browserSessions: {
        acquire: async (g) => `handle:${g}`,
        openLoginWindow: async () => ({ finalUrl: '' }),
        probe: async () => ({ ok: true, status: 200, finalUrl: '' }),
        clear: async () => undefined
      },
      broadcast: () => undefined,
      sender: {
        send: async (r) => {
          sent.push({ url: r.url, method: r.method, headers: { ...r.headers } })
          const canned = opts.responses[Math.min(hop, opts.responses.length - 1)]
          hop += 1
          return { status: canned.status, headers: canned.headers ?? {}, body: canned.body ?? '' }
        }
      }
    })
    return { broker, sent }
  }

  async function bindPat(broker: AuthBroker): Promise<string> {
    const begun = await broker.begin('pat', WIKI)
    if (begun.kind !== 'collect') throw new Error('unreachable')
    const done = await broker.continue(begun.transactionId, { credential: 'pat-value' })
    if (done.kind !== 'done') throw new Error('unreachable')
    return done.binding.id
  }

  async function bindBasic(broker: AuthBroker): Promise<string> {
    const begun = await broker.begin('idpw', WIKI)
    if (begun.kind !== 'collect') throw new Error('unreachable')
    const done = await broker.continue(begun.transactionId, {
      username: 'alice',
      password: 's3cret'
    })
    if (done.kind !== 'done') throw new Error('unreachable')
    return done.binding.id
  }

  it('허용 origin 내 redirect 를 추종한다', async () => {
    const { broker, sent } = harness({
      responses: [
        { status: 302, headers: { location: `${ORIGIN}/download/final` } },
        { status: 200, body: 'payload' }
      ]
    })
    const bindingId = await bindPat(broker)
    const res = await broker.authenticatedFetch({
      bindingId,
      connectorId: 'wiki',
      method: 'GET',
      path: '/rest/api/attachment/data'
    })

    expect(res.status).toBe(200)
    expect(res.body).toBe('payload')
    expect(sent.map((s) => s.url)).toEqual([
      `${ORIGIN}/rest/api/attachment/data`,
      `${ORIGIN}/download/final`
    ])
    // credential 은 같은 origin 안이므로 두 홉 모두에 실린다.
    expect(sent[1].headers.Authorization).toBe('Bearer pat-value')
  })

  it('상대 경로 Location 도 현재 URL 기준으로 해석한다', async () => {
    const { broker, sent } = harness({
      responses: [{ status: 302, headers: { Location: '/download/rel' } }, { status: 200 }]
    })
    const bindingId = await bindPat(broker)
    await broker.authenticatedFetch({
      bindingId,
      connectorId: 'wiki',
      method: 'GET',
      path: '/rest/api/x'
    })
    expect(sent[1].url).toBe(`${ORIGIN}/download/rel`)
  })

  it('허용 밖 redirect 를 거부한다 — 그 origin 으로 요청을 보내지 않는다', async () => {
    const { broker, sent } = harness({
      responses: [{ status: 302, headers: { location: 'https://evil.invalid/steal' } }]
    })
    const bindingId = await bindPat(broker)
    await expect(
      broker.authenticatedFetch({
        bindingId,
        connectorId: 'wiki',
        method: 'GET',
        path: '/rest/api/x'
      })
    ).rejects.toThrow(/origin_not_allowed/)

    // 전송자는 첫 홉만 봤다 — credential 이 evil.invalid 로 나가지 않았다.
    expect(sent).toHaveLength(1)
    expect(sent[0].url).toBe(`${ORIGIN}/rest/api/x`)
  })

  it('홉 상한을 넘으면 실패한다', async () => {
    const { broker, sent } = harness({
      responses: [{ status: 302, headers: { location: `${ORIGIN}/loop` } }]
    })
    const bindingId = await bindPat(broker)
    await expect(
      broker.authenticatedFetch({
        bindingId,
        connectorId: 'wiki',
        method: 'GET',
        path: '/rest/api/x'
      })
    ).rejects.toThrow(/too_many_redirects/)
    // 초기 요청 + 상한만큼의 재시도에서 멈춘다(무한 루프 아님).
    expect(sent).toHaveLength(MAX_REDIRECT_HOPS + 1)
  })

  it('303 은 POST 를 GET 으로 낮춰 재요청한다', async () => {
    const { broker, sent } = harness({
      responses: [{ status: 303, headers: { location: `${ORIGIN}/after` } }, { status: 200 }]
    })
    const bindingId = await bindPat(broker)
    await broker.authenticatedFetch({
      bindingId,
      connectorId: 'wiki',
      method: 'POST',
      path: '/rest/api/x',
      body: '{}'
    })
    expect(sent[0].method).toBe('POST')
    expect(sent[1].method).toBe('GET')
  })

  it('304 는 redirect 로 보지 않는다', async () => {
    const { broker, sent } = harness({
      responses: [{ status: 304, headers: { location: `${ORIGIN}/nope` } }]
    })
    const bindingId = await bindPat(broker)
    const res = await broker.authenticatedFetch({
      bindingId,
      connectorId: 'wiki',
      method: 'GET',
      path: '/rest/api/x'
    })
    expect(res.status).toBe(304)
    expect(sent).toHaveLength(1)
  })

  it('mechanism 별 presentation 을 선택한다', async () => {
    const presentations = {
      personal_access_token: { location: 'header', name: 'Authorization', scheme: 'Bearer' },
      basic: { location: 'header', name: 'Authorization', scheme: 'BasicPair' }
    }
    const { broker, sent } = harness({ responses: [{ status: 200 }], presentations })
    const bindingId = await bindBasic(broker)
    await broker.authenticatedFetch({
      bindingId,
      connectorId: 'wiki',
      method: 'GET',
      path: '/rest/api/x'
    })
    // basic binding 이므로 Bearer 기본값이 아니라 BasicPair 로 나간다.
    expect(sent[0].headers.Authorization).toBe(
      `Basic ${Buffer.from('alice:s3cret').toString('base64')}`
    )
  })

  it('미선언 mechanism 은 기본 presentation 을 쓴다', async () => {
    // basic 만 선언 — PAT binding 은 fallback 으로 기본 Bearer 를 탄다.
    const presentations = {
      basic: { location: 'header', name: 'Authorization', scheme: 'BasicPair' }
    }
    const { broker, sent } = harness({ responses: [{ status: 200 }], presentations })
    const bindingId = await bindPat(broker)
    await broker.authenticatedFetch({
      bindingId,
      connectorId: 'wiki',
      method: 'GET',
      path: '/rest/api/x'
    })
    expect(sent[0].headers.Authorization).toBe('Bearer pat-value')
  })

  it('presentations 를 아예 선언하지 않은 connector 는 기존대로 동작한다', async () => {
    const { broker, sent } = harness({ responses: [{ status: 200 }] })
    const bindingId = await bindBasic(broker)
    await broker.authenticatedFetch({
      bindingId,
      connectorId: 'wiki',
      method: 'GET',
      path: '/rest/api/x'
    })
    expect(sent[0].headers.Authorization).toBe('Bearer alice:s3cret')
  })

  it('responseType 과 maxBytes 를 전송자에게 전달한다', async () => {
    const store = fakeStore()
    const registry = new AuthRegistry()
    const options: Array<unknown> = []
    registry.register({
      providers: [
        createStaticCredentialProvider({
          id: 'pat',
          pluginId: 'corp',
          label: 'PAT',
          mechanism: 'personal_access_token',
          // manifest 선언(`targets: ['connector']`)과 같아야 한다 — 0164 verify D4.
          targets: ['connector']
        }),
        createBasicCredentialProvider({ id: 'idpw', pluginId: 'corp', label: 'ID/PW' })
      ],
      connectors: [
        {
          descriptor: {
            id: 'wiki',
            pluginId: 'corp',
            label: 'Wiki',
            acceptedAuthProviders: ['pat', 'idpw'],
            baseUrl: ORIGIN,
            presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' }
          },
          start: async () => ({ health: 'ready' }),
          invoke: async () => ({ ok: true, data: null }),
          stop: async () => undefined
        }
      ]
    })
    const broker = new AuthBroker({
      registry,
      vaultFor: (prefix) => createCredentialVault(store, prefix),
      fetchImpl: stubFetch,
      browserSessions: {
        acquire: async (g) => `handle:${g}`,
        openLoginWindow: async () => ({ finalUrl: '' }),
        probe: async () => ({ ok: true, status: 200, finalUrl: '' }),
        clear: async () => undefined
      },
      broadcast: () => undefined,
      sender: {
        send: async (_r, _s, o) => {
          options.push(o)
          return { status: 200, headers: {}, body: '', bodyBytes: new Uint8Array([7]) }
        }
      }
    })
    const bindingId = await bindPat(broker)
    const res = await broker.authenticatedFetch({
      bindingId,
      connectorId: 'wiki',
      method: 'GET',
      path: '/rest/api/x',
      responseType: 'binary',
      maxBytes: 1024
    })
    expect(options[0]).toEqual({ responseType: 'binary', maxBytes: 1024 })
    expect(res.bodyBytes).toEqual(new Uint8Array([7]))
  })
})

describe('AuthBroker ended-binding callback (AC14~16)', () => {
  it('removes locally, awaits the callback, then publishes and returns the successful logout', async () => {
    const callback = deferred<void>()
    const callbackStarted = deferred<void>()
    const ended: string[][] = []
    const { broker, states } = harness({
      onBindingsEnded: async (bindingIds) => {
        ended.push([...bindingIds])
        callbackStarted.resolve(undefined)
        await callback.promise
      }
    })
    const wiki = await loginPat(broker, WIKI)
    if (wiki.kind !== 'done') throw new Error('unreachable')
    const publishCountBeforeLogout = states.length

    const logout = broker.logout(wiki.binding.id, false)
    await callbackStarted.promise

    expect(broker.listBindings()).toEqual([])
    expect(ended).toEqual([[wiki.binding.id]])
    expect(states).toHaveLength(publishCountBeforeLogout)

    callback.resolve(undefined)

    await expect(logout).resolves.toEqual({
      kind: 'logged_out',
      endedBindingIds: [wiki.binding.id]
    })
    expect(states).toHaveLength(publishCountBeforeLogout + 1)
  })

  it('awaits callback cleanup and removes locally when provider logout fails or throws', async () => {
    const ended: string[][] = []
    const { broker } = harness({
      patLogout: async () => {
        throw new Error('provider unavailable')
      },
      onBindingsEnded: async (bindingIds) => {
        ended.push([...bindingIds])
      }
    })
    const wiki = await loginPat(broker, WIKI)
    if (wiki.kind !== 'done') throw new Error('unreachable')

    const outcome = await broker.logout(wiki.binding.id, false)
    expect(outcome.kind).toBe('failed')
    if (outcome.kind === 'failed') expect(outcome.message).toContain('provider unavailable')

    expect(broker.listBindings()).toEqual([])
    expect(ended).toEqual([[wiki.binding.id]])
  })

  it('passes every actually removed root and dependent id to one cascade callback', async () => {
    const parent = { bindingId: undefined as string | undefined }
    const ended: string[][] = []
    const { broker } = harness({
      patContinue: async (ctx) => ({
        kind: 'done',
        binding: {
          mechanism: 'personal_access_token',
          artifact: {
            kind: 'vault_credential',
            handleId: 'test-credential',
            credentialKind: 'personal_access_token'
          },
          ...(ctx.target.kind === 'connector' && ctx.target.connectorId === JIRA.connectorId
            ? { parentBindingId: parent.bindingId }
            : {})
        }
      }),
      onBindingsEnded: async (bindingIds) => {
        ended.push([...bindingIds])
      }
    })
    const root = await loginPat(broker, APP)
    if (root.kind !== 'done') throw new Error('unreachable')
    parent.bindingId = root.binding.id
    const dependent = await loginPat(broker, JIRA)
    if (dependent.kind !== 'done') throw new Error('unreachable')

    await expect(broker.logout(root.binding.id, true)).resolves.toEqual({
      kind: 'logged_out',
      endedBindingIds: [root.binding.id, dependent.binding.id]
    })

    expect(broker.listBindings()).toEqual([])
    expect(ended).toEqual([[root.binding.id, dependent.binding.id]])
  })

  it('keeps local cleanup, publishes state, and returns failed when callback cleanup fails', async () => {
    const { broker, states } = harness({
      onBindingsEnded: async () => {
        throw new Error('connector cleanup failed')
      }
    })
    const wiki = await loginPat(broker, WIKI)
    if (wiki.kind !== 'done') throw new Error('unreachable')
    const publishCountBeforeLogout = states.length

    await expect(broker.logout(wiki.binding.id, false)).resolves.toEqual({
      kind: 'failed',
      message: 'connector cleanup failed'
    })

    expect(broker.listBindings()).toEqual([])
    expect(states).toHaveLength(publishCountBeforeLogout + 1)
  })

  it('preserves both provider and callback failures in the failed logout message', async () => {
    const { broker } = harness({
      patLogout: async () => ({ kind: 'failed', message: 'provider logout failed' }),
      onBindingsEnded: async () => {
        throw new Error('connector cleanup failed')
      }
    })
    const wiki = await loginPat(broker, WIKI)
    if (wiki.kind !== 'done') throw new Error('unreachable')

    const outcome = await broker.logout(wiki.binding.id, false)

    expect(outcome.kind).toBe('failed')
    if (outcome.kind === 'failed') {
      expect(outcome.message).toContain('provider logout failed')
      expect(outcome.message).toContain('connector cleanup failed')
    }
    expect(broker.listBindings()).toEqual([])
  })
})

describe('AuthBroker cascade logout linearization', () => {
  it('fails closed when a dependent completion races a deferred root provider logout', async () => {
    const root = { bindingId: '' }
    const providerLogoutStarted = deferred<void>()
    const releaseProviderLogout = deferred<void>()
    const providerLogoutIds: string[] = []
    const callbackIds: string[][] = []
    const { broker, store } = harness({
      patContinue: async (ctx) => {
        const credential = ctx.input.credential ?? ''
        ctx.vault.set('secret', credential, {
          kind: 'personal_access_token',
          createdAt: ctx.clock()
        })
        return {
          kind: 'done',
          binding: {
            mechanism: 'personal_access_token',
            artifact: {
              kind: 'vault_credential',
              handleId: 'secret',
              credentialKind: 'personal_access_token'
            },
            ...(ctx.target.kind === 'connector' ? { parentBindingId: root.bindingId } : {})
          }
        }
      },
      patLogout: async (_ctx, binding) => {
        providerLogoutIds.push(binding.id)
        if (binding.id === root.bindingId) {
          providerLogoutStarted.resolve(undefined)
          await releaseProviderLogout.promise
        }
        return { kind: 'logged_out' }
      },
      onBindingsEnded: async (bindingIds) => {
        callbackIds.push([...bindingIds])
      }
    })
    const app = await loginPat(broker, APP, 'root-secret')
    if (app.kind !== 'done') throw new Error('unreachable')
    root.bindingId = app.binding.id
    const pendingDependent = await broker.begin('pat', JIRA)
    if (pendingDependent.kind !== 'collect') throw new Error('unreachable')

    const logout = broker.logout(root.bindingId, true)
    await providerLogoutStarted.promise
    const dependent = await broker.continue(pendingDependent.transactionId, {
      credential: 'late-secret'
    })

    expect(dependent).toMatchObject({ kind: 'failed', reason: 'policy_denied' })
    expect(broker.listBindings()).toEqual([])
    expect([...store.raw.values()]).not.toContain('late-secret')

    releaseProviderLogout.resolve(undefined)

    await expect(logout).resolves.toEqual({
      kind: 'logged_out',
      endedBindingIds: [root.bindingId]
    })
    expect(providerLogoutIds).toEqual([root.bindingId])
    expect(callbackIds).toEqual([[root.bindingId]])
  })

  it('does not create an orphan when a dependent transaction finishes after its parent is removed', async () => {
    const root = { bindingId: '' }
    const { broker, store } = harness({
      patContinue: async (ctx) => {
        const credential = ctx.input.credential ?? ''
        ctx.vault.set('secret', credential, {
          kind: 'personal_access_token',
          createdAt: ctx.clock()
        })
        return {
          kind: 'done',
          binding: {
            mechanism: 'personal_access_token',
            artifact: {
              kind: 'vault_credential',
              handleId: 'secret',
              credentialKind: 'personal_access_token'
            },
            ...(ctx.target.kind === 'connector' ? { parentBindingId: root.bindingId } : {})
          }
        }
      }
    })
    const app = await loginPat(broker, APP, 'root-secret')
    if (app.kind !== 'done') throw new Error('unreachable')
    root.bindingId = app.binding.id
    const pendingDependent = await broker.begin('pat', JIRA)
    if (pendingDependent.kind !== 'collect') throw new Error('unreachable')

    await expect(broker.logout(root.bindingId, true)).resolves.toEqual({
      kind: 'logged_out',
      endedBindingIds: [root.bindingId]
    })
    await expect(
      broker.continue(pendingDependent.transactionId, { credential: 'late-secret' })
    ).resolves.toMatchObject({ kind: 'failed', reason: 'policy_denied' })

    expect(broker.listBindings()).toEqual([])
    expect([...store.raw.values()]).not.toContain('late-secret')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 0172 — 한 패키지의 application provider 다수 = 하나의 로그인 체인
// ══════════════════════════════════════════════════════════════════════════════

const CHAIN_PLUGIN = 'chain'

interface ChainHarness {
  broker: AuthBroker
  store: ReturnType<typeof fakeStore>
  states: AuthPlatformState[]
  sessions: { cleared: Array<{ handleId: string; scope: string }> }
}

function chainHarness(providers: readonly AuthProviderV1[]): ChainHarness {
  const store = fakeStore()
  const registry = new AuthRegistry()
  const cleared: Array<{ handleId: string; scope: string }> = []

  const errors = registry.register({ providers })
  expect(errors).toEqual([])

  const states: AuthPlatformState[] = []
  const broker = new AuthBroker({
    registry,
    vaultFor: (prefix) => createCredentialVault(store, prefix),
    fetchImpl: stubFetch,
    browserSessions: {
      acquire: async (group) => `handle:${group}`,
      openLoginWindow: async () => ({ finalUrl: `${ORIGIN}/home` }),
      probe: async () => ({ ok: true, status: 200, finalUrl: `${ORIGIN}/me` }),
      clear: async (handleId, opts) => void cleared.push({ handleId, scope: opts.scope })
    },
    broadcast: (s) => states.push(s)
  })
  return { broker, store, states, sessions: { cleared } }
}

// collect → continue 로 끝나는 단순 멤버. logout 호출을 기록한다.
function credentialMember(
  id: string,
  logoutCalls: string[],
  opts: { failContinue?: boolean } = {}
): AuthProviderV1 {
  const base = createStaticCredentialProvider({
    id,
    pluginId: CHAIN_PLUGIN,
    label: id.toUpperCase(),
    mechanism: 'personal_access_token',
    targets: ['application']
  })
  return {
    ...base,
    ...(opts.failContinue === true
      ? {
          continue: async (): Promise<AuthStep> => ({
            kind: 'failed',
            reason: 'invalid_credentials',
            message: '자격증명이 거부되었습니다'
          })
        }
      : {}),
    logout: async (ctx, ref) => {
      logoutCalls.push(id)
      return base.logout(ctx, ref)
    }
  }
}

// begin() 안에서 끝나는 브라우저 멤버(ADFS/WIA).
function browserMember(id: string, logoutCalls: string[]): AuthProviderV1 {
  const base = createAdfsWiaProvider({
    id,
    pluginId: CHAIN_PLUGIN,
    label: id.toUpperCase(),
    sessionGroup: 'chain-adfs',
    loginUrl: `${ORIGIN}/login`,
    doneUrlPrefix: `${ORIGIN}/home`,
    authenticationProbeUrl: `${ORIGIN}/me`,
    allowedOrigins: [ORIGIN]
  })
  return {
    ...base,
    logout: async (ctx, ref) => {
      logoutCalls.push(id)
      return base.logout(ctx, ref)
    }
  }
}

async function submit(
  broker: AuthBroker,
  step: AuthStepInfo,
  value: string
): Promise<AuthStepInfo> {
  if (step.kind !== 'collect') throw new Error(`collect 가 아니다: ${step.kind}`)
  return broker.continue(step.transactionId, { credential: value })
}

describe('AuthBroker — 로그인 체인 (0172)', () => {
  it('체인 중간 done 은 노출되지 않고 다음 멤버의 step 이 온다', async () => {
    const logoutCalls: string[] = []
    const { broker } = chainHarness([
      credentialMember('one', logoutCalls),
      credentialMember('two', logoutCalls)
    ])

    const first = await broker.begin('one', APP)
    expect(first.kind).toBe('collect')

    const afterFirst = await submit(broker, first, 'secret-1')
    // 멤버1 이 done 을 냈지만 renderer 는 멤버2 의 입력 단계를 받는다.
    expect(afterFirst.kind).toBe('collect')
    // 아직 인증이 아니다 — 보류 중이다.
    expect(broker.status().authenticated).toBe(false)
    expect(broker.listBindings()).toHaveLength(0)
  })

  it('체인 진행 정보를 step 에 싣는다', async () => {
    const logoutCalls: string[] = []
    const { broker } = chainHarness([
      credentialMember('one', logoutCalls),
      credentialMember('two', logoutCalls)
    ])

    const first = await broker.begin('one', APP)
    expect(first.kind === 'collect' && first.chain).toEqual({ index: 1, total: 2, label: 'ONE' })

    const second = await submit(broker, first, 'secret-1')
    expect(second.kind === 'collect' && second.chain).toEqual({ index: 2, total: 2, label: 'TWO' })
  })

  it('단일 provider 로그인의 step 에는 chain 이 없다', async () => {
    const logoutCalls: string[] = []
    const { broker } = chainHarness([credentialMember('solo', logoutCalls)])

    const step = await broker.begin('solo', APP)
    expect(step.kind).toBe('collect')
    expect(step.kind === 'collect' ? step.chain : 'missing').toBeUndefined()

    // 그리고 기존과 같은 결과 — binding 1개와 done.
    const done = await submit(broker, step, 'secret')
    expect(done.kind).toBe('done')
    expect(broker.listBindings()).toHaveLength(1)
    expect(broker.status().authenticated).toBe(true)
  })

  it('체인 전체 성공이면 binding 2개(root+child)와 authenticated 다', async () => {
    const logoutCalls: string[] = []
    const { broker } = chainHarness([
      credentialMember('one', logoutCalls),
      credentialMember('two', logoutCalls)
    ])

    const first = await broker.begin('one', APP)
    const second = await submit(broker, first, 'secret-1')
    const done = await submit(broker, second, 'secret-2')

    expect(done.kind).toBe('done')
    const bindings = broker.listBindings()
    expect(bindings.map((b) => b.providerId)).toEqual(['one', 'two'])
    expect(bindings[0].parentBindingId).toBeUndefined()
    expect(bindings[1].parentBindingId).toBe(bindings[0].id)
    expect(done.kind === 'done' && done.binding.id).toBe(bindings[0].id)
    expect(broker.status().authenticated).toBe(true)
    expect(logoutCalls).toEqual([])
  })

  it('멤버 하나가 실패하면 로그인 전체가 실패하고 보류분이 정리된다', async () => {
    const logoutCalls: string[] = []
    const { broker, store } = chainHarness([
      credentialMember('one', logoutCalls),
      credentialMember('two', logoutCalls, { failContinue: true })
    ])

    const first = await broker.begin('one', APP)
    const second = await submit(broker, first, 'secret-1')
    const failed = await submit(broker, second, 'secret-2')

    expect(failed.kind).toBe('failed')
    expect(broker.listBindings()).toHaveLength(0)
    expect(broker.status().authenticated).toBe(false)
    // 성공했던 멤버1 에게 정리 기회를 준다.
    expect(logoutCalls).toEqual(['one'])
    // 그리고 보류 secret 이 남지 않는다.
    expect(store.raw.size).toBe(0)
  })

  it('브라우저 멤버가 성공한 뒤 실패하면 세션 그룹까지 정리한다', async () => {
    const logoutCalls: string[] = []
    const { broker, sessions, store } = chainHarness([
      browserMember('adfs-first', logoutCalls),
      credentialMember('two', logoutCalls, { failContinue: true })
    ])

    // 브라우저 멤버는 begin 안에서 끝나므로 곧바로 멤버2 의 입력 단계가 온다.
    const second = await broker.begin('adfs-first', APP)
    expect(second.kind).toBe('collect')
    const failed = await submit(broker, second, 'secret-2')

    expect(failed.kind).toBe('failed')
    expect(logoutCalls).toEqual(['adfs-first'])
    // application 로그인의 롤백이므로 origin 이 아니라 session group 전체를 지운다.
    expect(sessions.cleared).toEqual([{ handleId: 'handle:chain-adfs', scope: 'group' }])
    expect(store.raw.size).toBe(0)
    expect(broker.status().authenticated).toBe(false)
  })

  it('타임아웃이 보류분을 정리한다', async () => {
    vi.useFakeTimers()
    try {
      const logoutCalls: string[] = []
      const { broker, store } = chainHarness([
        credentialMember('one', logoutCalls),
        credentialMember('two', logoutCalls)
      ])

      const first = await broker.begin('one', APP)
      await submit(broker, first, 'secret-1')
      // 멤버2 의 입력을 기다리는 동안 만료된다.
      await vi.advanceTimersByTimeAsync(DEFAULT_LOGIN_TIMEOUT_MS + 1)

      expect(logoutCalls).toEqual(['one'])
      expect(store.raw.size).toBe(0)
      expect(broker.status().authenticated).toBe(false)
      expect(broker.listBindings()).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('재로그인은 이전 체인을 통째로 축출하고 그 secret 도 지운다', async () => {
    const logoutCalls: string[] = []
    const { broker, store } = chainHarness([
      credentialMember('one', logoutCalls),
      credentialMember('two', logoutCalls)
    ])

    const first = await broker.begin('one', APP)
    const second = await submit(broker, first, 'secret-1')
    await submit(broker, second, 'secret-2')
    const firstRound = broker.listBindings().map((b) => b.id)
    expect([...store.raw.values()]).toEqual(expect.arrayContaining(['secret-1', 'secret-2']))

    const again = await broker.begin('one', APP)
    const againSecond = await submit(broker, again, 'secret-3')
    await submit(broker, againSecond, 'secret-4')

    const secondRound = broker.listBindings()
    expect(secondRound).toHaveLength(2)
    expect(secondRound.map((b) => b.id)).not.toEqual(expect.arrayContaining(firstRound))
    // 옛 로그인의 값이 vault 에 남지 않는다.
    const values = [...store.raw.values()]
    expect(values).toEqual(expect.arrayContaining(['secret-3', 'secret-4']))
    expect(values).not.toContain('secret-1')
    expect(values).not.toContain('secret-2')
    expect(broker.status().authenticated).toBe(true)
  })

  it('connector target 은 체인을 타지 않는다', async () => {
    const logoutCalls: string[] = []
    // 같은 패키지의 provider 2종이지만 connector 연결은 지정한 하나만 실행한다.
    const both = createStaticCredentialProvider({
      id: 'both',
      pluginId: CHAIN_PLUGIN,
      label: 'BOTH',
      mechanism: 'personal_access_token',
      targets: ['application', 'connector']
    })
    const { broker } = chainHarness([
      { ...both, logout: async (ctx, ref) => both.logout(ctx, ref) },
      credentialMember('two', logoutCalls)
    ])

    const step = await broker.begin('both', WIKI)
    expect(step.kind).toBe('collect')
    expect(step.kind === 'collect' ? step.chain : 'missing').toBeUndefined()

    const done = await submit(broker, step, 'connector-secret')
    expect(done.kind).toBe('done')
    expect(broker.listBindings()).toHaveLength(1)
    expect(broker.listBindings()[0].providerId).toBe('both')
  })

  it('체인 로그아웃은 cascade 로 전 멤버를 끊는다', async () => {
    const logoutCalls: string[] = []
    const { broker, store } = chainHarness([
      credentialMember('one', logoutCalls),
      credentialMember('two', logoutCalls)
    ])

    const first = await broker.begin('one', APP)
    const second = await submit(broker, first, 'secret-1')
    const done = await submit(broker, second, 'secret-2')
    if (done.kind !== 'done') throw new Error('unreachable')

    const outcome = await broker.logout(done.binding.id, true)
    expect(outcome.kind).toBe('logged_out')
    expect(logoutCalls.sort()).toEqual(['one', 'two'])
    expect(broker.listBindings()).toHaveLength(0)
    expect(store.raw.size).toBe(0)
    expect(broker.status().authenticated).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 0173 — provider 의 ctx.fetch 도 주입 구현(프로덕션 = Chromium net.fetch)을 탄다
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthBroker — ctx.fetch 전송 구현 주입 (0173)', () => {
  const PROBE_PLUGIN = 'probe-pkg'

  // probeUrl 을 준 static-credential 은 continue() 에서 ctx.fetch 로 자격증명을 검증한다.
  function probeHarness(allowedOrigins: readonly string[]): {
    broker: AuthBroker
    calls: Array<{ url: string; init?: RequestInit }>
  } {
    const registry = new AuthRegistry()
    const provider = createStaticCredentialProvider({
      id: 'probe',
      pluginId: PROBE_PLUGIN,
      label: 'PROBE',
      mechanism: 'personal_access_token',
      targets: ['connector'],
      probeUrl: `${ORIGIN}/me`,
      allowedOrigins
    })
    const errors = registry.register({
      providers: [provider]
    })
    expect(errors).toEqual([])

    const calls: Array<{ url: string; init?: RequestInit }> = []
    const broker = new AuthBroker({
      registry,
      vaultFor: (prefix) => createCredentialVault(fakeStore(), prefix),
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), ...(init !== undefined ? { init } : {}) })
        return new Response('{}', { status: 200 })
      },
      browserSessions: {
        acquire: async () => 'h',
        openLoginWindow: async () => ({ finalUrl: '' }),
        probe: async () => ({ ok: true, status: 200, finalUrl: '' }),
        clear: async () => undefined
      },
      broadcast: () => undefined
    })
    return { broker, calls }
  }

  it('ctx.fetch 는 주입 구현으로 나간다 — 전역 fetch 를 쓰지 않는다', async () => {
    const globalSpy = vi.fn(async () => new Response('전역', { status: 200 }))
    vi.stubGlobal('fetch', globalSpy)
    const { broker, calls } = probeHarness([ORIGIN])

    const step = await broker.begin('probe', WIKI)
    if (step.kind !== 'collect') throw new Error('collect 가 아니다')
    const done = await broker.continue(step.transactionId, { credential: 'pat-1' })

    expect(done.kind).toBe('done')
    expect(calls.map((c) => c.url)).toEqual([`${ORIGIN}/me`])
    // redirect 는 수동 유지 — 스택이 바뀌어도 정책은 그대로다.
    expect(calls[0].init?.redirect).toBe('manual')
    expect(globalSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('주입 구현으로 바꿔도 미선언 origin 은 여전히 거부된다', async () => {
    // allowlist 를 비우면 probe 가 나가기 전에 막혀야 한다 — 강제 지점이 전송자 앞에 남아 있다.
    const { broker, calls } = probeHarness([])

    const step = await broker.begin('probe', WIKI)
    if (step.kind !== 'collect') throw new Error('collect 가 아니다')
    const failed = await broker.continue(step.transactionId, { credential: 'pat-1' })

    expect(failed.kind).toBe('failed')
    // 요청 자체가 만들어지지 않았다.
    expect(calls).toEqual([])
  })
})
