// AC7 — 인증된 요청이 미선언 origin · 절대 URL · 예약 헤더 덮어쓰기를 거부한다.
// 0180 이 지운 `features/auth-platform/policy.test.ts`(128줄)의 이식이며, 순수 판정 단위와
// **실제 요청 경로**(`AuthenticatedRequester`) 양쪽에서 확인한다 — 판정 함수만 통과하고 호출부가
// 부르지 않으면 아무것도 막지 못한다.

import { describe, expect, it, vi } from 'vitest'
import type { AuthDefinition } from '../../contracts/auth'
import { createVault } from '../../infra/vault'
import type { SecretStorePort } from '../../infra/config/secret-store-port'
import { AuthenticatedRequester, AuthPolicyError } from './authenticated-request'
import {
  checkHeaders,
  checkOutboundRequest,
  checkRedirect,
  checkRequestPath,
  isAllowedOrigin
} from './policy'
import { AuthRegistry } from './registry'
import { createAuthSecretReader } from './secret-access'
import { createMemoryGrantPersistence, AuthStore } from './store'

describe('정책 순수 판정', () => {
  it('절대 URL·프로토콜 상대 경로를 거부한다', () => {
    expect(checkRequestPath('/rest/api/content')).toEqual({ ok: true })
    expect(checkRequestPath('rest/api/content')).toEqual({ ok: true })
    expect(checkRequestPath('https://evil.example/x')).toMatchObject({
      ok: false,
      reason: 'absolute_path'
    })
    expect(checkRequestPath('//evil.example/x')).toMatchObject({
      ok: false,
      reason: 'absolute_path'
    })
    expect(checkRequestPath('HTTP://evil.example/x')).toMatchObject({ ok: false })
  })

  it('예약 헤더 3종을 대소문자 무시로 거부한다', () => {
    expect(checkHeaders({ accept: 'application/json' })).toEqual({ ok: true })
    expect(checkHeaders(undefined)).toEqual({ ok: true })
    for (const name of ['Authorization', 'authorization', 'Cookie', 'PROXY-AUTHORIZATION']) {
      expect(checkHeaders({ [name]: 'x' })).toMatchObject({
        ok: false,
        reason: 'reserved_header',
        detail: name
      })
    }
  })

  it('origin 은 정확 일치만 — 서브도메인 자동 허용이 없다', () => {
    const allowed = ['https://wiki.example.corp']
    expect(isAllowedOrigin('https://wiki.example.corp/rest', allowed)).toBe(true)
    expect(isAllowedOrigin('https://evil.wiki.example.corp/rest', allowed)).toBe(false)
    expect(isAllowedOrigin('http://wiki.example.corp/rest', allowed)).toBe(false)
    expect(isAllowedOrigin('https://wiki.example.corp:8443/rest', allowed)).toBe(false)
    expect(isAllowedOrigin('not a url', allowed)).toBe(false)
  })

  it('미인증 grant 는 요청 자체를 막는다', () => {
    const base = {
      url: 'https://wiki.example.corp/rest',
      path: '/rest',
      allowedOrigins: ['https://wiki.example.corp']
    } as const
    expect(checkOutboundRequest({ ...base, grantStatus: 'valid' })).toEqual({ ok: true })
    for (const grantStatus of ['none', 'expired', 'unknown'] as const) {
      expect(checkOutboundRequest({ ...base, grantStatus })).toMatchObject({
        ok: false,
        reason: 'grant_not_valid',
        detail: grantStatus
      })
    }
  })

  it('첫 거부 사유를 돌려준다 (경로 → 헤더 → grant → origin 순)', () => {
    expect(
      checkOutboundRequest({
        url: 'https://evil.example/x',
        path: 'https://evil.example/x',
        headers: { Authorization: 'Bearer x' },
        allowedOrigins: ['https://wiki.example.corp'],
        grantStatus: 'none'
      })
    ).toMatchObject({ reason: 'absolute_path' })
  })

  it('redirect 재검사는 allowlist 밖 Location 을 막고 origin 만 남긴다', () => {
    expect(checkRedirect('https://wiki.example.corp/next', ['https://wiki.example.corp'])).toEqual({
      ok: true
    })
    // 로그·에러에 전체 URL(쿼리에 토큰이 실릴 수 있다)을 싣지 않는다.
    expect(
      checkRedirect('https://evil.example/x?token=abc', ['https://wiki.example.corp'])
    ).toEqual({ ok: false, reason: 'origin_not_allowed', detail: 'https://evil.example' })
  })
})

// ── 실제 요청 경로에서의 강제 ────────────────────────────────────────────────

function fakeSecretStore(): SecretStorePort {
  const raw = new Map<string, string>()
  return {
    get: (name) => raw.get(name),
    set: (name, plain) => {
      raw.set(name, plain)
    },
    delete: (name) => {
      raw.delete(name)
    }
  }
}

const WIKI: AuthDefinition = {
  id: 'wiki',
  label: 'Wiki',
  origin: 'https://wiki.example.corp',
  methods: [
    {
      kind: 'pat',
      label: 'PAT',
      fields: [{ name: 'secret', label: 'PAT', type: 'password', required: true }],
      present: { location: 'header', name: 'Authorization', scheme: 'bearer' },
      compose: (input) => ({ value: input.secret ?? '' })
    }
  ]
}

function harness(options: { authenticated?: boolean; respond?: typeof fetch } = {}): {
  api: AuthenticatedRequester
  fetchImpl: ReturnType<typeof vi.fn>
  store: AuthStore
} {
  const vault = createVault(fakeSecretStore())
  const store = new AuthStore({ persistence: createMemoryGrantPersistence(), vault })
  const registry = new AuthRegistry([WIKI])
  store.restore(['wiki'])
  if (options.authenticated !== false) {
    vault.set('wiki:pat', 'pat-value', { kind: 'pat', createdAt: 0 })
    store.put('wiki', { kind: 'secret', vaultKey: 'wiki:pat', authKind: 'pat', createdAt: 0 })
  }
  const fetchImpl = vi.fn(
    options.respond ??
      (async () => new Response('{}', { status: 200, headers: { 'content-type': 'text/plain' } }))
  )
  const api = new AuthenticatedRequester({
    registry,
    store,
    fetchImpl: fetchImpl as unknown as typeof fetch
  })
  return { api, fetchImpl, store }
}

describe('ProviderApi.request 강제 (AC7)', () => {
  it('미선언 origin 으로 나가는 절대 URL 을 거부한다', async () => {
    const { api, fetchImpl } = harness()
    await expect(
      api.request('wiki', { path: 'https://evil.example/steal' })
    ).rejects.toBeInstanceOf(AuthPolicyError)
    // 요청 자체가 나가지 않는다 — 판정이 전송보다 앞이다.
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('예약 헤더 덮어쓰기를 거부한다', async () => {
    const { api, fetchImpl } = harness()
    await expect(
      api.request('wiki', { path: '/rest', headers: { Authorization: 'Bearer stolen' } })
    ).rejects.toMatchObject({ name: 'AuthPolicyError' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('미인증이면 요청을 내지 않는다', async () => {
    const { api, fetchImpl } = harness({ authenticated: false })
    await expect(api.request('wiki', { path: '/rest' })).rejects.toMatchObject({
      name: 'AuthPolicyError'
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('통과한 요청에는 선언된 방식으로 자격증명이 실린다', async () => {
    const { api, fetchImpl } = harness()
    const res = await api.request('wiki', { path: '/rest/api/content' })
    expect(res.ok).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe('https://wiki.example.corp/rest/api/content')
    expect((init as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer pat-value'
    )
    // 암묵적 쿠키 전송을 켜지 않는다 — 인증은 명시 주입으로만 한다.
    expect((init as RequestInit).credentials).toBe('omit')
    expect((init as RequestInit).redirect).toBe('manual')
  })

  it('allowlist 밖으로의 redirect 를 따라가지 않는다', async () => {
    const { api } = harness({
      respond: (async () =>
        new Response('', {
          status: 302,
          headers: { location: 'https://evil.example/steal' }
        })) as unknown as typeof fetch
    })
    await expect(api.request('wiki', { path: '/rest' })).rejects.toMatchObject({
      name: 'AuthPolicyError'
    })
  })

  it('401 은 grant 를 expired 로 강등해 GUI 에 재인증 지점을 만든다', async () => {
    const { api, store } = harness({
      respond: (async () => new Response('', { status: 401 })) as unknown as typeof fetch
    })
    expect(store.status('wiki')).toBe('valid')
    const res = await api.request('wiki', { path: '/rest' })
    expect(res.ok).toBe(false)
    expect(store.status('wiki')).toBe('expired')
    // grant 는 남는다 — 무엇을 다시 인증해야 하는지 화면이 보여줘야 한다.
    expect(store.get('wiki')).toBeDefined()
  })
})

// 0188 — `materialize()` 는 제거됐다. 그 두 책임은 각각 다음으로 옮겨 **같은 행동을 계속**
// 검증한다:
//   header presentation → 실제 outbound 요청 헤더(위 request 테스트가 이미 단언한다)
//   raw 조회            → trusted-main `AuthSecretReader`
describe('AuthSecretReader (구 ProviderApi.token)', () => {
  it('미인증이면 null 이다 (빈 문자열 치환 금지)', () => {
    const { store } = harness({ authenticated: false })
    expect(createAuthSecretReader(store).read('wiki')).toBeNull()
  })

  it('선언되지 않은 Auth 도 null 이다', () => {
    const { store } = harness()
    expect(createAuthSecretReader(store).read('nope')).toBeNull()
  })

  it('인증된 값형은 raw 값을 준다 — MCP `${BINDING:<id>}` 와 direct-credential augmenter 전용', () => {
    const { store } = harness()
    expect(createAuthSecretReader(store).read('wiki')).toBe('pat-value')
  })
})
