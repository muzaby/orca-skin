// 만료 판정 반영 (0178 3b) — **판정과 반영은 다른 일이다.**
//
// 0178 이전에는 브라우저 세션 방식이 `expired` 를 계산해 돌려줘도 아무도 그 값을 레코드에
// 쓰지 않았다(`setStatus` 호출 부재). 그래서 세션이 끊긴 뒤에도 화면은 "연결됨" 이었고, 실패는
// 첫 요청에서야 드러났다. 여기서 고정하는 것은 그 **반영 경로**다:
//
//   revalidate()   방식에게 묻고 → 레코드에 쓰고 → 상태를 알린다
//   요청 중 401    "이 요청이 실패했다" 가 아니라 "이 레코드가 더는 유효하지 않다"

import { describe, expect, it } from 'vitest'
import { AuthBroker } from './broker'
import { AuthRegistry } from './registry'
import { createBrowserSessionMethod } from './methods/browser-session'
import { createCredentialMethod } from './methods/credential'
import { createCredentialVault } from '../../infra/auth/credential-vault'
import type { BrowserSessionCapability } from '../../contracts/auth-method'
import type { AuthPlatformState, AuthTarget } from '../../../shared/ipc'
import type { SecretStorePort } from '../../infra/config/secret-facade'

const ORIGIN = 'https://wiki.corp.invalid'
const WIKI: AuthTarget = { kind: 'connector', connectorId: 'wiki', connectionId: 'c1' }

function fakeStore(): SecretStorePort {
  const raw = new Map<string, string>()
  return {
    get: (n) => raw.get(n),
    set: (n, v) => void raw.set(n, v),
    delete: (n) => void raw.delete(n)
  }
}

function patMethod(): ReturnType<typeof createCredentialMethod> {
  return createCredentialMethod({
    id: 'pat',
    label: 'PAT',
    mechanism: 'personal_access_token',
    credentialKind: 'personal_access_token',
    fields: [{ name: 'credential', label: 'PAT', type: 'password', required: true }],
    compose: (input) => {
      const value = (input['credential'] ?? '').trim()
      return value.length === 0 ? { error: '값을 입력해 주세요' } : { value }
    }
  })
}

interface Harness {
  broker: AuthBroker
  states: AuthPlatformState[]
  probes: string[]
  sent: Array<{ url: string; method: string }>
}

function harness(options: {
  probeOk: () => boolean
  responses?: Array<{ status: number; body?: string }>
  sessionResponses?: Array<{ status: number; body?: string }>
}): Harness {
  const store = fakeStore()
  const registry = new AuthRegistry()
  const probes: string[] = []
  const sent: Array<{ url: string; method: string }> = []
  const sessionQueue = [...(options.sessionResponses ?? [])]
  const senderQueue = [...(options.responses ?? [])]

  expect(
    registry.registerMethods([
      patMethod(),
      createBrowserSessionMethod({
        id: 'sso',
        label: 'SSO',
        sessionGroup: 'corp',
        loginUrl: `${ORIGIN}/login`,
        doneUrlPrefix: `${ORIGIN}/home`,
        authenticationProbeUrl: `${ORIGIN}/me`,
        allowedOrigins: [ORIGIN]
      })
    ])
  ).toEqual([])
  expect(
    registry.register({
      connectors: [
        {
          descriptor: {
            id: 'wiki',
            label: 'Wiki',
            acceptedMethods: ['pat', 'sso'],
            baseUrl: ORIGIN,
            presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' }
          },
          start: async () => ({ health: 'ready' }),
          invoke: async () => ({ ok: true, data: null }),
          stop: async () => undefined
        }
      ]
    })
  ).toEqual([])

  const browserSessions: BrowserSessionCapability = {
    acquire: async (group) => `handle:${group}`,
    openLoginWindow: async () => ({ finalUrl: `${ORIGIN}/home` }),
    probe: async (_handleId, url) => {
      probes.push(url)
      const ok = options.probeOk()
      return { ok, status: ok ? 200 : 401, finalUrl: url }
    },
    send: async (_handleId, req) => {
      sent.push({ url: req.url, method: req.method })
      const next = sessionQueue.shift() ?? { status: 200, body: '' }
      return { status: next.status, headers: {}, body: next.body ?? '' }
    },
    clear: async () => undefined
  }

  const states: AuthPlatformState[] = []
  const broker = new AuthBroker({
    registry,
    vaultFor: (prefix) => createCredentialVault(store, prefix),
    fetchImpl: async () => new Response('', { status: 200 }),
    browserSessions,
    broadcast: (s) => states.push(s),
    sender: {
      send: async (req) => {
        sent.push({ url: req.url, method: req.method })
        const next = senderQueue.shift() ?? { status: 200, body: '' }
        return { status: next.status, headers: {}, body: next.body ?? '' }
      }
    }
  })
  return { broker, states, probes, sent }
}

async function loginPat(broker: AuthBroker): Promise<string> {
  const step = await broker.begin('pat', WIKI)
  if (step.kind !== 'collect') throw new Error('collect 가 아니다')
  const done = await broker.continue(step.transactionId, { credential: 'pat-value' })
  if (done.kind !== 'done') throw new Error('done 이 아니다')
  return done.binding.id
}

async function loginSso(broker: AuthBroker): Promise<string> {
  const done = await broker.begin('sso', WIKI)
  if (done.kind !== 'done') throw new Error('done 이 아니다')
  return done.binding.id
}

describe('revalidate — 방식의 판정을 레코드에 반영한다', () => {
  it('세션이 끊긴 SSO 레코드는 expired 로 내려가고 상태가 브로드캐스트된다', async () => {
    let alive = true
    const { broker, states } = harness({ probeOk: () => alive })
    const bindingId = await loginSso(broker)
    expect(broker.getBinding(bindingId)?.status).toBe('valid')

    alive = false
    const before = states.length
    expect(await broker.revalidate(bindingId)).toBe('expired')

    expect(broker.getBinding(bindingId)?.status).toBe('expired')
    // 화면이 "연결됨" 이라고 계속 말하지 않도록 상태가 다시 나간다.
    expect(states.length).toBe(before + 1)
  })

  it('유효한 세션은 상태를 바꾸지 않고 브로드캐스트도 하지 않는다', async () => {
    const { broker, states } = harness({ probeOk: () => true })
    const bindingId = await loginSso(broker)
    const before = states.length

    expect(await broker.revalidate(bindingId)).toBe('valid')
    expect(broker.getBinding(bindingId)?.status).toBe('valid')
    expect(states.length).toBe(before)
  })

  it('판정이 던지면 만료로 단정하지 않고 unknown 으로 남긴다', async () => {
    // 사내망 밖이면 probe 는 늘 던진다 — 그것을 "세션 만료" 로 접으면 재로그인을 강요한다.
    // 로그인은 정상 망에서 하고, 그 뒤 망이 끊긴 상황을 만든다.
    let reachable = true
    const { broker } = harness({
      probeOk: () => {
        if (!reachable) throw new Error('네트워크 없음')
        return true
      }
    })
    const bindingId = await loginSso(broker)
    expect(broker.getBinding(bindingId)?.status).toBe('valid')

    reachable = false
    expect(await broker.revalidate(bindingId)).toBe('unknown')
    expect(broker.getBinding(bindingId)?.status).toBe('unknown')
  })

  it('revalidateAll 은 모든 레코드를 훑는다', async () => {
    let alive = true
    const { broker } = harness({ probeOk: () => alive })
    const sso = await loginSso(broker)

    alive = false
    await broker.revalidateAll()
    expect(broker.getBinding(sso)?.status).toBe('expired')
  })

  it('알 수 없는 레코드는 null 이다', async () => {
    const { broker } = harness({ probeOk: () => true })
    expect(await broker.revalidate('없는-레코드')).toBeNull()
  })
})

describe('요청 경로의 401 은 레코드 만료로 반영된다', () => {
  it('401 을 받으면 레코드가 expired 로 내려간다', async () => {
    const { broker, states } = harness({ probeOk: () => true, responses: [{ status: 401 }] })
    const bindingId = await loginPat(broker)
    const before = states.length

    const res = await broker.request({ target: 'wiki', method: 'GET', path: '/rest/api/x' })

    expect(res.status).toBe(401)
    expect(broker.getBinding(bindingId)?.status).toBe('expired')
    expect(states.length).toBe(before + 1)
  })

  it('403 은 만료가 아니다 — 인증은 됐고 권한만 없는 경우가 흔하다', async () => {
    const { broker } = harness({ probeOk: () => true, responses: [{ status: 403 }] })
    const bindingId = await loginPat(broker)

    await broker.request({ target: 'wiki', method: 'GET', path: '/rest/api/x' })
    expect(broker.getBinding(bindingId)?.status).toBe('valid')
  })
})

describe('SSO 레코드의 REST 호출 (0178)', () => {
  it('세션 cookie jar 로 나가고 **응답 본문을 그대로** 돌려준다', async () => {
    // 0178 이전에는 이 경로가 probe 판정만 돌려주고 본문이 빈 문자열이었다 — 사용자가 지목한
    // 실사용("sso login 인증 rest api")이 성립하지 않던 지점이다.
    const { broker, sent } = harness({
      probeOk: () => true,
      sessionResponses: [{ status: 200, body: '{"page":"hello"}' }]
    })
    await loginSso(broker)

    const res = await broker.request({ target: 'wiki', method: 'GET', path: '/rest/api/page' })

    expect(res.status).toBe(200)
    expect(res.body).toBe('{"page":"hello"}')
    expect(sent.at(-1)).toEqual({ url: `${ORIGIN}/rest/api/page`, method: 'GET' })
  })

  it('MCP 로는 반출되지 않는다 — token 은 null 이고 요청 경로는 살아 있다', async () => {
    const { broker } = harness({ probeOk: () => true, sessionResponses: [{ status: 200 }] })
    await loginSso(broker)

    expect(broker.token('wiki')).toBeNull()
    await expect(
      broker.request({ target: 'wiki', method: 'GET', path: '/rest/api/page' })
    ).resolves.toMatchObject({ status: 200 })
  })

  it('credential 레코드는 그대로 MCP 로 반출된다', async () => {
    const { broker } = harness({ probeOk: () => true })
    await loginPat(broker)

    expect(broker.token('wiki')).toBe('pat-value')
  })

  it('인증되지 않은 대상 이름은 token 이 null 이다', async () => {
    const { broker } = harness({ probeOk: () => true })
    expect(broker.token('wiki')).toBeNull()
  })
})
