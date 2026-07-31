// Broker 통합 — application/connector 가 **같은 lifecycle** 을 타는지, 그리고 raw secret 이
// 나가는 표면이 없는지 확인한다 (AC3·4·7·8·10).

import { describe, expect, it, vi } from 'vitest'
import { AuthBroker } from './broker'
import { AuthRegistry } from './registry'
import { createStaticCredentialProvider } from './providers/static-credential'
import { createAdfsWiaProvider } from './providers/corp-adfs-wia'
import { createCredentialVault } from '../../infra/auth/credential-vault'
import type { SecretStorePort } from '../../infra/config/secret-facade'
import type { AuthPlatformState, AuthStepInfo, AuthTarget } from '../../../shared/ipc'
import type { BrowserSessionCapability } from '../../contracts/auth-plugin'

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

const MANIFEST = {
  schemaVersion: 1,
  id: 'corp',
  version: '1.0.0',
  contributes: {
    authProviders: [
      {
        id: 'pat',
        apiVersion: 1,
        label: 'PAT',
        targets: ['application', 'connector'],
        mechanisms: ['personal_access_token'],
        capabilities: ['logout']
      },
      {
        id: 'adfs',
        apiVersion: 1,
        label: 'ADFS',
        targets: ['application', 'connector'],
        mechanisms: ['adfs_browser_session'],
        capabilities: ['browser_session', 'status', 'logout'],
        allowedOrigins: [ORIGIN],
        sessionGroup: 'corp-adfs'
      }
    ]
  }
}

interface Harness {
  broker: AuthBroker
  store: ReturnType<typeof fakeStore>
  states: AuthPlatformState[]
  sessions: { cleared: Array<{ handleId: string; scope: string }> }
}

function harness(browserOverrides: Partial<BrowserSessionCapability> = {}): Harness {
  const store = fakeStore()
  const registry = new AuthRegistry()
  const cleared: Array<{ handleId: string; scope: string }> = []

  const errors = registry.register({
    manifest: MANIFEST,
    providers: [
      createStaticCredentialProvider({
        id: 'pat',
        pluginId: 'corp',
        label: 'PAT',
        mechanism: 'personal_access_token'
      }),
      createAdfsWiaProvider({
        id: 'adfs',
        pluginId: 'corp',
        label: 'ADFS',
        sessionGroup: 'corp-adfs',
        loginUrl: `${ORIGIN}/login`,
        doneUrlPrefix: `${ORIGIN}/home`,
        authenticationProbeUrl: `${ORIGIN}/me`,
        allowedOrigins: [ORIGIN]
      })
    ]
  })
  expect(errors).toEqual([])

  const states: AuthPlatformState[] = []
  const broker = new AuthBroker({
    registry,
    vaultFor: (prefix) => createCredentialVault(store, prefix),
    browserSessions: {
      acquire: async (group) => `handle:${group}`,
      openLoginWindow: async () => ({ finalUrl: `${ORIGIN}/home` }),
      probe: async () => ({ ok: true, status: 200, finalUrl: `${ORIGIN}/me` }),
      clear: async (handleId, opts) => void cleared.push({ handleId, scope: opts.scope }),
      ...browserOverrides
    },
    exec: async () => ({ code: 0, stdout: '', stderr: '' }),
    broadcast: (s) => states.push(s)
  })
  return { broker, store, states, sessions: { cleared } }
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
      browserSessions: {
        acquire: async () => 'h',
        openLoginWindow: async () => ({ finalUrl: '' }),
        probe: async () => ({ ok: false, status: 0, finalUrl: '' }),
        clear: async () => undefined
      },
      exec: async () => ({ code: 0, stdout: '', stderr: '' }),
      broadcast: () => undefined
    })
    expect(broker.status().required).toBe(false)
  })

  it('선언하지 않은 target 으로는 인증할 수 없다', async () => {
    const { broker } = harness()
    const registry = new AuthRegistry()
    registry.register({
      manifest: {
        schemaVersion: 1,
        id: 'x',
        version: '1.0.0',
        contributes: {
          authProviders: [
            {
              id: 'conn-only',
              apiVersion: 1,
              label: 'C',
              targets: ['connector'],
              mechanisms: ['api_key']
            }
          ]
        }
      },
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
  const CONNECTOR_MANIFEST = {
    schemaVersion: 1,
    id: 'corp',
    version: '1.0.0',
    contributes: {
      authProviders: [
        {
          id: 'pat',
          apiVersion: 1,
          label: 'PAT',
          targets: ['application', 'connector'],
          mechanisms: ['personal_access_token'],
          capabilities: ['logout']
        }
      ],
      connectors: [
        {
          id: 'wiki',
          apiVersion: 1,
          label: 'Wiki',
          acceptedAuthProviders: ['pat'],
          baseUrl: ORIGIN,
          presentation: { location: 'header', name: 'PRIVATE-TOKEN' }
        }
      ]
    }
  }

  function connectorHarness(): {
    broker: AuthBroker
    sent: Array<{ url: string; headers: Record<string, string> }>
  } {
    const store = fakeStore()
    const registry = new AuthRegistry()
    const sent: Array<{ url: string; headers: Record<string, string> }> = []
    const errors = registry.register({
      manifest: CONNECTOR_MANIFEST,
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
            apiVersion: 1,
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
      browserSessions: {
        acquire: async (g) => `handle:${g}`,
        openLoginWindow: async () => ({ finalUrl: '' }),
        probe: async () => ({ ok: true, status: 200, finalUrl: '' }),
        clear: async () => undefined
      },
      exec: async () => ({ code: 0, stdout: '', stderr: '' }),
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
