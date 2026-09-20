// ΔV2 — Auth 코어가 프로토콜 중립이 되는 세 축 (0237 AC36·AC37·AC38·AC39).
//
// 세 축 모두 **기존 HTTP 동작이 한 글자도 바뀌지 않는다**가 함께 잠겨야 한다. 넓히기만 하고
// 기존 갈래를 지키지 않으면 정책이 헐거워지는 쪽으로 회귀한다(§10 EP-21·EP-22·EP-23).

import { describe, expect, it, vi } from 'vitest'
import { isBareEndpoint, registerAuthDefinitions } from './registry'
import { AuthenticatedRequester, AuthPolicyError } from './authenticated-request'
import { AuthRegistry } from './registry'
import { AuthStore } from './store'
import { LoginService } from './login'
import { passwordSpec, patSpec } from './specs/credential'
import type { AuthDefinition, AuthVerifier } from '../../contracts/auth'

const BEARER = { location: 'header', name: 'Authorization', scheme: 'bearer' } as const

// 실제 `Vault` 포트 형상 — `read()` 는 `{state:'found'|…}` 를 돌려준다.
function vaultOf(value: string): never {
  return {
    get: () => value,
    read: () => ({ state: 'found', value }),
    set: () => undefined,
    delete: () => undefined,
    names: () => []
  } as never
}

function storeWith(value: string): AuthStore {
  return new AuthStore({
    persistence: { load: () => ({ records: {}, authoritative: true }), save: () => true },
    vault: vaultOf(value)
  })
}

describe('AC36 — endpoint 판정은 HTTP 를 그대로 두고 메일 scheme 을 받는다', () => {
  it('기존 HTTP 7케이스가 글자 그대로 유지된다', () => {
    expect(isBareEndpoint('https://wiki.example.corp')).toBe(true)
    expect(isBareEndpoint('http://localhost:3000')).toBe(true)
    expect(isBareEndpoint('https://wiki.example.corp/')).toBe(false)
    expect(isBareEndpoint('https://wiki.example.corp?a=1')).toBe(false)
    expect(isBareEndpoint('https://wiki.example.corp#x')).toBe(false)
    expect(isBareEndpoint('wiki.example.corp')).toBe(false)
    expect(isBareEndpoint('')).toBe(false)
  })

  it('메일 scheme 을 수락한다', () => {
    expect(isBareEndpoint('pop3s://pop.example.corp:995')).toBe(true)
    expect(isBareEndpoint('pop3://pop.example.corp:110')).toBe(true)
    expect(isBareEndpoint('imaps://mail.example.corp:993')).toBe(true)
  })

  it('경로·쿼리·해시·빈 host 는 scheme 과 무관하게 거부한다', () => {
    // `pathname === ''` 조건을 지우면 첫 줄이 통과한다 — 정책 기준이 헐거워지는 방향이다.
    expect(isBareEndpoint('pop3s://pop.example.corp:995/')).toBe(false)
    expect(isBareEndpoint('pop3s://pop.example.corp:995/inbox')).toBe(false)
    expect(isBareEndpoint('pop3s://pop.example.corp:995?a=1')).toBe(false)
    expect(isBareEndpoint('pop3s://pop.example.corp:995#x')).toBe(false)
    expect(isBareEndpoint('mailto:a@b')).toBe(false)
    expect(isBareEndpoint('null')).toBe(false)
  })

  it('등록이 메일 Auth 를 실제로 받아들인다', () => {
    const mail: AuthDefinition = {
      id: 'mail',
      label: '사내 메일',
      origin: 'pop3s://pop.example.corp:995',
      methods: [passwordSpec({ label: 'ID/비밀번호' })]
    }
    const result = registerAuthDefinitions([mail])
    expect(result.rejected).toEqual([])
    expect(result.definitions.map((item) => item.id)).toEqual(['mail'])
  })
})

describe('AC37 — 비-HTTP Auth 의 request() 는 fail-closed 다', () => {
  it('origin_not_allowed 로 거부하고 전송을 시도하지 않는다', async () => {
    const mail: AuthDefinition = {
      id: 'mail',
      label: '사내 메일',
      origin: 'pop3s://pop.example.corp:995',
      methods: [passwordSpec({ label: 'ID/비밀번호' })]
    }
    const fetchImpl = vi.fn<typeof fetch>()
    const store = storeWith('user:pass')
    store.put('mail', {
      kind: 'secret',
      vaultKey: 'k',
      authKind: 'password',
      createdAt: 1
    })
    const requester = new AuthenticatedRequester({
      registry: new AuthRegistry([mail]),
      store,
      fetchImpl
    })
    await expect(requester.request('mail', { path: '/x' })).rejects.toBeInstanceOf(AuthPolicyError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('AC39 — presentation 없는 값형은 HTTP 로 나가지 않는다', () => {
  it('present 를 선언하지 않은 방식의 요청이 거부된다', async () => {
    // `origin` 은 HTTP 다 — 여기서 막는 것은 origin 이 아니라 **presentation 부재**임을
    // 분리해 보이려고 일부러 통과 가능한 origin 을 쓴다.
    const definition: AuthDefinition = {
      id: 'corp',
      label: 'corp',
      origin: 'https://corp.example.corp',
      methods: [passwordSpec({ label: 'ID/비밀번호' })]
    }
    const fetchImpl = vi.fn<typeof fetch>()
    const store = storeWith('user:pass')
    store.put('corp', {
      kind: 'secret',
      vaultKey: 'k',
      authKind: 'password',
      createdAt: 1
    })
    const requester = new AuthenticatedRequester({
      registry: new AuthRegistry([definition]),
      store,
      fetchImpl
    })
    await expect(requester.request('corp', { path: '/x' })).rejects.toThrow(/자격증명 표현/)
    // **조용히 무인증으로 보내지 않는다** — optional 화가 만드는 유일한 새 위험이 이것이다.
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('present 를 선언한 방식은 그대로 나간다', async () => {
    const definition: AuthDefinition = {
      id: 'corp',
      label: 'corp',
      origin: 'https://corp.example.corp',
      methods: [patSpec({ label: 'PAT', fieldLabel: 'PAT', present: BEARER })]
    }
    const fetchImpl = vi.fn(async () =>
      Promise.resolve(new Response('ok', { status: 200 }))
    ) as unknown as typeof fetch
    const store = storeWith('token')
    store.put('corp', { kind: 'secret', vaultKey: 'k', authKind: 'pat', createdAt: 1 })
    const requester = new AuthenticatedRequester({
      registry: new AuthRegistry([definition]),
      store,
      fetchImpl
    })
    const res = await requester.request('corp', { path: '/x' })
    expect(res.status).toBe(200)
  })
})

describe('AC38 — probe 는 method 가 주면 method 것이, 없으면 기존 HTTP 경로가 돈다', () => {
  function serviceOf(
    definition: AuthDefinition,
    extras: Record<string, unknown> = {}
  ): { service: LoginService; store: AuthStore } {
    const store = storeWith('user:pass')
    const deps = {
      registry: new AuthRegistry([definition]),
      store,
      vault: vaultOf('user:pass'),
      ...extras
    }
    return { service: new LoginService(deps as never), store }
  }

  it('① verify 를 가진 방식은 verify 만 돌고 HTTP probe 는 0회다', async () => {
    const verify = vi.fn<AuthVerifier>(async () => ({ ok: true }))
    const request = vi.fn()
    const definition: AuthDefinition = {
      id: 'mail',
      label: 'mail',
      origin: 'pop3s://pop.example.corp:995',
      probe: { path: '/never' },
      methods: [{ ...passwordSpec({ label: 'ID/비밀번호' }), verify }]
    }
    const { service } = serviceOf(definition, { request })
    await service.begin('mail', 'password', { username: 'u', password: 'p' })
    expect(verify).toHaveBeenCalledOnce()
    expect(request).not.toHaveBeenCalled()
    // 후보 값이 그대로 전달된다 — `compose` 가 접은 `user:pass` 한 문자열이다.
    expect(verify.mock.calls[0][0]).toMatchObject({ authId: 'mail', secret: 'u:p' })
  })

  it('② verify 가 없고 probe 가 있으면 기존 HTTP 경로가 그대로 돈다', async () => {
    const request = vi.fn(async () => ({
      ok: true,
      status: 200,
      finalUrl: 'https://corp.example.corp/me',
      headers: {},
      body: ''
    }))
    const definition: AuthDefinition = {
      id: 'corp',
      label: 'corp',
      origin: 'https://corp.example.corp',
      probe: { path: '/me' },
      methods: [patSpec({ label: 'PAT', fieldLabel: 'PAT', present: BEARER })]
    }
    const { service } = serviceOf(definition, { request })
    await service.begin('corp', 'pat', { secret: 'token' })
    expect(request).toHaveBeenCalledOnce()
  })

  it('③ verify 의 preserveGrant 가 ProbeOutcome 으로 전달된다', async () => {
    // r2 의 `LoginDeps.verify` 는 이 항을 상수 `false` 로 접었다 — 권한 부족이 자격증명
    // 거부로 읽혀 멀쩡한 grant 가 만료됐다.
    const verify = vi.fn<AuthVerifier>(async () => ({
      ok: false,
      rejected: false,
      preserveGrant: true
    }))
    const definition: AuthDefinition = {
      id: 'mail',
      label: 'mail',
      origin: 'pop3s://pop.example.corp:995',
      methods: [{ ...passwordSpec({ label: 'ID/비밀번호' }), verify }]
    }
    const { service, store } = serviceOf(definition)
    store.put('mail', {
      kind: 'secret',
      vaultKey: 'k',
      authKind: 'password',
      createdAt: 1
    })
    await service.begin('mail', 'password', { username: 'u', password: 'p' })
    // 확인이 실패했으므로 후보는 커밋되지 않는다. **기존 grant 는 살아 있다**(preserveGrant).
    expect(store.status('mail')).toBe('valid')
    expect(verify).toHaveBeenCalledOnce()
  })
})
