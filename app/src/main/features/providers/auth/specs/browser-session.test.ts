// 게이트 인증 방식(ADFS/WIA) — 사용자 결정 "둘 다 필요" 의 두 갈래를 확인한다:
// ① 세션에서 끝나는 경우 ② 그 세션으로 사내 API 를 불러 토큰까지 받는 경우.
//
// `BrowserSessionPort` 를 fake 로 두므로 electron 없이 돈다(실제 창·쿠키는 사람 실기 AC13).

import { describe, expect, it, vi } from 'vitest'
import type { Provider } from '../../../../contracts/provider'
import type { BrowserSessionSpec } from '../login'
import {
  normalizeExpiry,
  pickPath,
  SessionRunner,
  type BrowserSessionPort
} from './browser-session'

const PROVIDER: Provider = {
  id: 'corp-sso',
  label: '사내 로그인',
  kind: 'gate',
  origin: 'https://portal.example.corp',
  auth: []
}

function spec(exchange?: {
  path: string
  valuePath: string
  expiresAtPath?: string
}): BrowserSessionSpec {
  return {
    kind: 'browser-session',
    label: '통합 인증(WIA)',
    config: {
      sessionGroup: 'corp',
      loginUrl: 'https://adfs.example.corp/adfs/ls',
      doneUrlPrefix: 'https://portal.example.corp/home',
      authenticationProbeUrl: 'https://portal.example.corp/api/me',
      allowedOrigins: ['https://adfs.example.corp', 'https://portal.example.corp'],
      ...(exchange ? { exchange } : {})
    }
  }
}

function port(overrides: Partial<BrowserSessionPort> = {}): BrowserSessionPort {
  return {
    register: vi.fn(),
    acquire: vi.fn(() => 'handle-1'),
    openLoginWindow: vi.fn(async () => ({ finalUrl: 'https://portal.example.corp/home' })),
    probe: vi.fn(async () => ({
      ok: true,
      status: 200,
      finalUrl: 'https://portal.example.corp/api/me'
    })),
    send: vi.fn(async () => ({ status: 200, headers: {}, body: '{}' })),
    ...overrides
  }
}

describe('SessionRunner — ① 게이트 로그인', () => {
  it('창 완료 + probe 성공이면 session grant 를 만든다', async () => {
    const sessions = port()
    const result = await new SessionRunner({ sessions }).login(PROVIDER, spec())
    expect(result).toEqual({ kind: 'session', sessionGroup: 'corp' })
    // 정책(allowlist)은 세션 등록 시점에 넘어간다.
    expect(sessions.register).toHaveBeenCalledWith({
      sessionGroup: 'corp',
      allowedOrigins: ['https://adfs.example.corp', 'https://portal.example.corp']
    })
  })

  it('doneUrlPrefix 도달만으로 성공을 선언하지 않는다 — probe 가 거부하면 실패다', async () => {
    const sessions = port({
      probe: vi.fn(async () => ({
        ok: false,
        status: 302,
        finalUrl: 'https://adfs.example.corp/ls'
      }))
    })
    expect(await new SessionRunner({ sessions }).login(PROVIDER, spec())).toMatchObject({
      kind: 'failed',
      reason: 'cancelled'
    })
  })

  it('사용자가 창을 닫으면 cancelled 다', async () => {
    const sessions = port({
      openLoginWindow: vi.fn(async () => {
        throw new Error('사용자가 로그인 창을 닫았습니다')
      })
    })
    expect(await new SessionRunner({ sessions }).login(PROVIDER, spec())).toEqual({
      kind: 'failed',
      reason: 'cancelled',
      message: '사용자가 로그인 창을 닫았습니다'
    })
  })

  it('완료 판정은 doneUrlPrefix 접두사로 한다', async () => {
    const sessions = port()
    await new SessionRunner({ sessions }).login(PROVIDER, spec())
    const call = (sessions.openLoginWindow as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
    const opts = call[1] as { url: string; isDone(url: string): boolean }
    expect(opts.url).toBe('https://adfs.example.corp/adfs/ls')
    expect(opts.isDone('https://portal.example.corp/home?x=1')).toBe(true)
    expect(opts.isDone('https://adfs.example.corp/adfs/ls?wa=1')).toBe(false)
  })
})

describe('SessionRunner — ② 세션으로 토큰 교환', () => {
  it('exchange 가 선언되면 token grant 로 승격한다', async () => {
    const sessions = port({
      send: vi.fn(async () => ({
        status: 200,
        headers: {},
        body: JSON.stringify({ data: { token: 'tok-1', expires_in: 1_700_000_000 } })
      }))
    })
    const result = await new SessionRunner({ sessions }).login(
      PROVIDER,
      spec({ path: '/api/token', valuePath: 'data.token', expiresAtPath: 'data.expires_in' })
    )
    expect(result).toEqual({
      kind: 'token',
      token: { token: 'tok-1', expiresAt: 1_700_000_000_000 }
    })
    // origin 밖으로 나가지 않는다 — path 는 provider.origin 기준 상대 경로다.
    const [, req] = (sessions.send as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
    expect((req as { url: string }).url).toBe('https://portal.example.corp/api/token')
  })

  it('교환 실패·형식 불일치는 exchange_failed 로 표면화된다', async () => {
    const cases: Array<[string, Partial<BrowserSessionPort>]> = [
      ['비-2xx', { send: vi.fn(async () => ({ status: 500, headers: {}, body: '' })) }],
      ['JSON 아님', { send: vi.fn(async () => ({ status: 200, headers: {}, body: 'nope' })) }],
      [
        '경로에 값 없음',
        { send: vi.fn(async () => ({ status: 200, headers: {}, body: '{"other":1}' })) }
      ]
    ]
    for (const [, overrides] of cases) {
      const result = await new SessionRunner({ sessions: port(overrides) }).login(
        PROVIDER,
        spec({ path: '/api/token', valuePath: 'data.token' })
      )
      expect(result).toMatchObject({ kind: 'failed', reason: 'exchange_failed' })
    }
  })
})

describe('응답 파싱 헬퍼', () => {
  it('점 경로로 값을 꺼낸다 (실값 미정이라 경로가 선언이다)', () => {
    expect(pickPath({ access_token: 'a' }, 'access_token')).toBe('a')
    expect(pickPath({ data: { token: 'b' } }, 'data.token')).toBe('b')
    expect(pickPath({ data: null }, 'data.token')).toBeUndefined()
    expect(pickPath(undefined, 'a.b')).toBeUndefined()
  })

  it('만료 표기가 초·밀리초·ISO 로 갈려도 밀리초로 모은다', () => {
    expect(normalizeExpiry(1_700_000_000)).toBe(1_700_000_000_000)
    expect(normalizeExpiry(1_700_000_000_000)).toBe(1_700_000_000_000)
    expect(normalizeExpiry('2026-08-10T00:00:00Z')).toBe(Date.parse('2026-08-10T00:00:00Z'))
    expect(normalizeExpiry('nope')).toBeUndefined()
    expect(normalizeExpiry(null)).toBeUndefined()
  })
})
