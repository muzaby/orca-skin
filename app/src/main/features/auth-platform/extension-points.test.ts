// 확장점 충분성 (0178, 사용자 결정 2026-08-06) — **폐쇄망 구현자 시점**에서 쓴다.
//
// 사용자 결정: 비용추적의 `sso → code → token` 과 llm 토큰 발급은 **실제 폐쇄망 환경에서
// 구현자가 확장**하고, 코어는 **기본 함수와 진입점만** 제공한다.
//
// 그러면 이 파일이 답해야 하는 질문은 하나다 — **그 진입점으로 정말 붙일 수 있는가.**
// 0178 이 걷어낸 1,603줄이 정확히 이 질문에 답하지 못한 코드였다: 확장점은 크고 화려했는데
// 사용자가 지목한 실사용 4종 중 3종이 동작하지 않았다. 그래서 여기서는 **코어를 한 줄도 고치지
// 않고** 두 흐름을 실제로 조립해 돌려 본다. 이 테스트가 도는 한 진입점은 살아 있다.
//
// 아래 방식·대상은 **저장소에 등록하지 않는다**(내장 목록에 없다) — 폐쇄망 포크가 자기
// `modules/` 와 `methods/` 에 두는 코드의 대역이다.

import { describe, expect, it } from 'vitest'
import { AuthBroker } from './broker'
import { AuthRegistry } from './registry'
import { createCredentialVault } from '../../infra/auth/credential-vault'
import type { AuthContext, AuthMethod, AuthRecordRef } from '../../contracts/auth-method'
import type { ConnectorRuntime } from '../../contracts/connector'
import type { AuthTarget } from '../../../shared/ipc'
import type { SecretStorePort } from '../../infra/config/secret-facade'

const SSO_ORIGIN = 'https://sso.corp.invalid'
const API_ORIGIN = 'https://portal.corp.invalid'
const COST: AuthTarget = { kind: 'connector', connectorId: 'cost', connectionId: 'c1' }

function fakeStore(): SecretStorePort {
  const raw = new Map<string, string>()
  return {
    get: (n) => raw.get(n),
    set: (n, v) => void raw.set(n, v),
    delete: (n) => void raw.delete(n)
  }
}

// ── 폐쇄망 구현자가 쓸 법한 인증 방식 (코어 수정 0) ──────────────────────────
//
// `sso → code → token`: 로그인 창이 `?code=` 를 달고 돌아오면 그 code 를 사내 창구에서 토큰으로
// **교환**하고, 토큰만 vault 에 봉인한다. 이후 요청은 대상의 presentation 대로 헤더에 실린다.
function createCodeExchangeMethod(opts: { id: string; tokenPath: string }): AuthMethod {
  return {
    descriptor: {
      id: opts.id,
      groupId: 'corp-cost',
      label: '사내 SSO(코드 교환)',
      targets: ['connector'],
      mechanisms: ['auth_token'],
      // 로그인 창이 도는 origin 과 교환 창구 origin **둘 다** 선언해야 한다.
      allowedOrigins: [SSO_ORIGIN, API_ORIGIN],
      sessionGroup: 'corp'
    },

    async authenticate(ctx: AuthContext) {
      const handleId = await ctx.browserSessions.acquire('corp')
      const { finalUrl } = await ctx.browserSessions.openLoginWindow(handleId, {
        url: `${SSO_ORIGIN}/authorize`,
        isDone: (url) => url.includes('code=')
      })
      const code = new URL(finalUrl).searchParams.get('code')
      if (code === null) {
        return { kind: 'failed', reason: 'invalid_credentials', message: 'code 를 받지 못했습니다' }
      }

      // **교환 — 이 한 줄이 `ctx.fetch` 진입점이 존재해야 하는 이유다.**
      const res = await ctx.fetch(`${API_ORIGIN}${opts.tokenPath}`, {
        method: 'POST',
        body: JSON.stringify({ code })
      })
      if (res.status !== 200) {
        return { kind: 'failed', reason: 'invalid_credentials', message: `교환 실패 ${res.status}` }
      }
      const payload = (await res.json()) as { access_token: string; expires_in: number }

      ctx.vault.set('secret', payload.access_token, {
        kind: 'auth_token',
        createdAt: ctx.clock()
      })
      return {
        kind: 'authenticated',
        record: {
          mechanism: 'auth_token',
          artifact: { kind: 'vault_credential', handleId: 'secret', credentialKind: 'auth_token' },
          // 만료를 레코드에 싣는다 — 아래 `status()` 가 이 값으로 판정하고, 코어의 `revalidate`
          // 가 그 판정을 레코드에 반영한다(0178 3b).
          expiresAt: ctx.clock() + payload.expires_in * 1000
        }
      }
    },

    async status(ctx: AuthContext, record: AuthRecordRef) {
      if (record.expiresAt === undefined) return 'unknown'
      return record.expiresAt <= ctx.clock() ? 'expired' : 'valid'
    },

    async revoke(ctx: AuthContext) {
      ctx.vault.delete('secret')
    }
  }
}

function costTarget(methodId: string): ConnectorRuntime {
  return {
    descriptor: {
      id: 'cost',
      label: '비용 추적',
      acceptedMethods: [methodId],
      baseUrl: API_ORIGIN,
      presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' }
    },
    start: async () => ({ health: 'ready' }),
    invoke: async () => ({ ok: true, data: null }),
    stop: async () => undefined
  }
}

interface Harness {
  broker: AuthBroker
  exchanges: Array<{ url: string; body: string }>
  sent: Array<{ url: string; headers: Record<string, string> }>
  advance: (ms: number) => void
}

function harness(options: {
  method: AuthMethod
  loginUrl?: string
  exchangeStatus?: number
}): Harness {
  const store = fakeStore()
  const registry = new AuthRegistry()
  const exchanges: Array<{ url: string; body: string }> = []
  const sent: Array<{ url: string; headers: Record<string, string> }> = []
  let now = 1_700_000_000_000

  expect(registry.registerMethods([options.method])).toEqual([])
  expect(registry.register({ connectors: [costTarget(options.method.descriptor.id)] })).toEqual([])
  expect(registry.validateCrossReferences()).toEqual([])

  const broker = new AuthBroker({
    registry,
    vaultFor: (prefix) => createCredentialVault(store, prefix),
    clock: () => now,
    // 인증 방식의 `ctx.fetch` 가 타는 전송자.
    fetchImpl: async (url, init) => {
      exchanges.push({ url: String(url), body: String(init?.body ?? '') })
      const status = options.exchangeStatus ?? 200
      return new Response(JSON.stringify({ access_token: 'tok-1', expires_in: 3600 }), { status })
    },
    browserSessions: {
      acquire: async (group) => `handle:${group}`,
      openLoginWindow: async () => ({
        finalUrl: options.loginUrl ?? `${API_ORIGIN}/callback?code=abc123`
      }),
      probe: async () => ({ ok: true, status: 200, finalUrl: '' }),
      send: async () => ({ status: 200, headers: {}, body: '' }),
      clear: async () => undefined
    },
    broadcast: () => undefined,
    // 대상 요청 전송자 — 헤더 주입 결과를 여기서 본다.
    sender: {
      send: async (req) => {
        sent.push({ url: req.url, headers: req.headers })
        return { status: 200, headers: {}, body: 'ok' }
      }
    }
  })
  return { broker, exchanges, sent, advance: (ms) => void (now += ms) }
}

describe('비용추적 흐름 — sso → code → token 을 코어 수정 없이 붙인다', () => {
  const method = createCodeExchangeMethod({ id: 'corp-cost-sso', tokenPath: '/oauth/token' })

  it('로그인 창이 준 code 를 교환하고, 교환된 토큰으로 REST 가 나간다', async () => {
    const { broker, exchanges, sent } = harness({ method })

    const done = await broker.begin('corp-cost-sso', COST)
    expect(done.kind).toBe('done')

    // 교환이 실제로 일어났다 — `ctx.fetch` 진입점이 없으면 여기가 성립하지 않는다.
    expect(exchanges).toHaveLength(1)
    expect(exchanges[0].url).toBe(`${API_ORIGIN}/oauth/token`)
    expect(JSON.parse(exchanges[0].body)).toEqual({ code: 'abc123' })

    await broker.request({ target: 'cost', method: 'GET', path: '/v1/quota' })
    expect(sent[0].headers.Authorization).toBe('Bearer tok-1')
  })

  it('교환된 토큰의 만료가 레코드에 반영된다 — status() 판정을 코어가 받아 쓴다', async () => {
    const { broker, advance } = harness({ method })
    const done = await broker.begin('corp-cost-sso', COST)
    if (done.kind !== 'done') throw new Error('done 이 아니다')
    expect(broker.getBinding(done.binding.id)?.status).toBe('valid')

    advance(3600 * 1000 + 1)
    expect(await broker.revalidate(done.binding.id)).toBe('expired')
    expect(broker.getBinding(done.binding.id)?.status).toBe('expired')
  })

  it('교환이 실패하면 인증이 실패로 수렴하고 레코드가 생기지 않는다', async () => {
    const { broker, sent } = harness({ method, exchangeStatus: 500 })

    const failed = await broker.begin('corp-cost-sso', COST)
    expect(failed.kind).toBe('failed')
    expect(broker.listBindings()).toEqual([])
    expect(sent).toEqual([])
  })

  it('code 가 없이 돌아온 로그인은 실패다 — 빈 토큰으로 진행하지 않는다', async () => {
    const { broker, exchanges } = harness({ method, loginUrl: `${API_ORIGIN}/callback` })

    expect((await broker.begin('corp-cost-sso', COST)).kind).toBe('failed')
    expect(exchanges).toEqual([])
  })

  it('선언하지 않은 origin 으로는 교환할 수 없다 — 요청 자체가 만들어지지 않는다', async () => {
    // 확장점이 열려 있다고 해서 아무 데나 나갈 수 있는 것은 아니다. allowlist 강제 지점은
    // 전송자 **앞**에 있으므로, 스택이 바뀌어도 이 성질은 옮겨가지 않는다.
    const leaky = createCodeExchangeMethod({ id: 'leaky', tokenPath: '/oauth/token' })
    const outsider: AuthMethod = {
      ...leaky,
      descriptor: { ...leaky.descriptor, id: 'leaky', allowedOrigins: [SSO_ORIGIN] }
    }
    const { broker, exchanges } = harness({ method: outsider })

    expect((await broker.begin('leaky', COST)).kind).toBe('failed')
    expect(exchanges).toEqual([])
  })
})

describe('llm 토큰 발급 흐름 — sso 세션 쿠키로 REST 를 부른다', () => {
  // 이쪽은 교환이 없다. 로그인으로 만든 **세션 쿠키를 그대로 실어** 발급 endpoint 를 부른다.
  // 코어가 주는 것은 `browserSessions.send` 이고, 응답 본문이 그대로 돌아온다(0178 3b).
  function createSessionMethod(): AuthMethod {
    return {
      descriptor: {
        id: 'corp-sso-session',
        groupId: 'corp',
        label: '사내 SSO(세션)',
        targets: ['connector'],
        mechanisms: ['adfs_browser_session'],
        allowedOrigins: [API_ORIGIN],
        sessionGroup: 'corp'
      },
      authenticate: async (ctx) => ({
        kind: 'authenticated',
        record: {
          mechanism: 'adfs_browser_session',
          artifact: {
            kind: 'browser_session',
            handleId: await ctx.browserSessions.acquire('corp'),
            sessionGroup: 'corp'
          }
        }
      }),
      status: async () => 'valid',
      revoke: async () => undefined
    }
  }

  it('발급 응답 본문이 호출자에게 그대로 온다 — 값 주입 없이 쿠키로 나간다', async () => {
    const store = fakeStore()
    const registry = new AuthRegistry()
    const method = createSessionMethod()
    expect(registry.registerMethods([method])).toEqual([])
    expect(registry.register({ connectors: [costTarget(method.descriptor.id)] })).toEqual([])

    const injected: Array<Record<string, string>> = []
    const broker = new AuthBroker({
      registry,
      vaultFor: (prefix) => createCredentialVault(store, prefix),
      fetchImpl: async () => new Response('', { status: 200 }),
      browserSessions: {
        acquire: async (group) => `handle:${group}`,
        openLoginWindow: async () => ({ finalUrl: '' }),
        probe: async () => ({ ok: true, status: 200, finalUrl: '' }),
        send: async (_handleId, req) => {
          injected.push(req.headers)
          return { status: 200, headers: {}, body: '{"model_token":"mt-1"}' }
        },
        clear: async () => undefined
      },
      broadcast: () => undefined
    })

    expect((await broker.begin('corp-sso-session', COST)).kind).toBe('done')
    const res = await broker.request({ target: 'cost', method: 'POST', path: '/v1/model-token' })

    expect(res.body).toBe('{"model_token":"mt-1"}')
    // 세션 경로는 값을 주입하지 않는다 — 인증은 cookie jar 가 진다.
    expect(injected[0].Authorization).toBeUndefined()
  })

  it('세션 발급 결과는 MCP 로 반출되지 않는다 — 대상 이름으로 물어도 null 이다', async () => {
    const store = fakeStore()
    const registry = new AuthRegistry()
    const method = createSessionMethod()
    registry.registerMethods([method])
    registry.register({ connectors: [costTarget(method.descriptor.id)] })
    const broker = new AuthBroker({
      registry,
      vaultFor: (prefix) => createCredentialVault(store, prefix),
      fetchImpl: async () => new Response('', { status: 200 }),
      browserSessions: {
        acquire: async (group) => `handle:${group}`,
        openLoginWindow: async () => ({ finalUrl: '' }),
        probe: async () => ({ ok: true, status: 200, finalUrl: '' }),
        send: async () => ({ status: 200, headers: {}, body: '' }),
        clear: async () => undefined
      },
      broadcast: () => undefined
    })

    expect((await broker.begin('corp-sso-session', COST)).kind).toBe('done')
    expect(broker.token('cost')).toBeNull()
  })

  // 대조군 — **교환형은 반출된다.** 값이 vault 에 있는 레코드라 MCP 가 받아갈 수 있다.
  // 두 흐름의 차이가 여기서 갈린다: 쿠키는 값이 아니고, 교환 토큰은 값이다.
  it('교환형 토큰은 MCP 로 반출된다', async () => {
    const { broker } = harness({
      method: createCodeExchangeMethod({ id: 'corp-cost-sso', tokenPath: '/oauth/token' })
    })
    expect((await broker.begin('corp-cost-sso', COST)).kind).toBe('done')
    expect(broker.token('cost')).toBe('tok-1')
  })
})
