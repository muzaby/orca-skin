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
    send: vi.fn(async () => ({ status: 200, headers: {}, body: '{}' })),
    ...overrides
  }
}

describe('SessionRunner — ① 게이트 로그인', () => {
  it('창이 완료되면 session grant 를 만든다', async () => {
    const sessions = port()
    const result = await new SessionRunner({ sessions }).login(PROVIDER, spec())
    expect(result).toEqual({ kind: 'session', sessionGroup: 'corp' })
    // 정책(allowlist)은 세션 등록 시점에 넘어간다.
    expect(sessions.register).toHaveBeenCalledWith({
      sessionGroup: 'corp',
      allowedOrigins: ['https://adfs.example.corp', 'https://portal.example.corp']
    })
  })

  // **판정은 여기 없다.** `doneUrlPrefix` 도달만으로 인증이 확정되지 않는다는 규칙은 살아
  // 있지만, 그 확인은 `LoginService` 가 grant 커밋 뒤 `Provider.probe` 로 한다(login.test.ts).
  // 이 클래스는 창을 열고 결과를 조립할 뿐이다.

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

// ─────────────────────────────────────────────────────────────────────────────
// ③ 신원 조회 (0182) — 사이드바가 표시할 principal.
//
// **실패가 로그인을 실패시키지 않는 것**이 이 블록의 핵심이다. principal 은 표시용이라,
// 못 읽었다고 인증을 되돌리면 "이름을 못 읽어서 로그인이 안 되는" 상태가 된다.
// ─────────────────────────────────────────────────────────────────────────────

function specWith(config: {
  whoami?: { path: string; valuePath: string }
  exchange?: { path: string; valuePath: string; principalPath?: string }
}): BrowserSessionSpec {
  return {
    kind: 'browser-session',
    label: '통합 인증(WIA)',
    config: {
      sessionGroup: 'corp',
      loginUrl: 'https://adfs.example.corp/adfs/ls',
      doneUrlPrefix: 'https://portal.example.corp/home',
      allowedOrigins: ['https://adfs.example.corp', 'https://portal.example.corp'],
      ...(config.whoami ? { whoami: config.whoami } : {}),
      ...(config.exchange ? { exchange: config.exchange } : {})
    }
  }
}

describe('SessionRunner — ③ 신원 조회(whoami)', () => {
  it('whoami 값을 principalId 로 싣는다 — origin 기준 상대 경로로 나간다', async () => {
    const sessions = port({
      send: vi.fn(async () => ({
        status: 200,
        headers: {},
        body: '{"user":{"email":"a@example.corp"}}'
      }))
    })
    const result = await new SessionRunner({ sessions }).login(
      PROVIDER,
      specWith({ whoami: { path: '/api/me', valuePath: 'user.email' } })
    )

    expect(result).toEqual({
      kind: 'session',
      sessionGroup: 'corp',
      principalId: 'a@example.corp'
    })
    expect(sessions.send).toHaveBeenCalledWith('handle-1', {
      url: 'https://portal.example.corp/api/me',
      method: 'GET',
      headers: { accept: 'application/json' }
    })
  })

  it('whoami 미선언이면 조회 요청을 아예 내지 않는다', async () => {
    const sessions = port()
    const result = await new SessionRunner({ sessions }).login(PROVIDER, specWith({}))

    expect(result).toEqual({ kind: 'session', sessionGroup: 'corp' })
    expect(sessions.send).not.toHaveBeenCalled()
  })

  it('whoami 실패는 로그인을 실패시키지 않는다 — grant 는 커밋되고 principal 만 빈다', async () => {
    const cases: [string, Partial<BrowserSessionPort>][] = [
      ['비-2xx', { send: vi.fn(async () => ({ status: 403, headers: {}, body: '{}' })) }],
      ['JSON 아님', { send: vi.fn(async () => ({ status: 200, headers: {}, body: '<html>' })) }],
      [
        '필드 부재',
        { send: vi.fn(async () => ({ status: 200, headers: {}, body: '{"other":1}' })) }
      ],
      [
        '문자열 아님',
        { send: vi.fn(async () => ({ status: 200, headers: {}, body: '{"mail":{}}' })) }
      ],
      [
        '전송 예외',
        {
          send: vi.fn(async () => {
            throw new Error('네트워크 끊김')
          })
        }
      ]
    ]

    for (const [label, overrides] of cases) {
      const events: string[] = []
      const result = await new SessionRunner({
        sessions: port(overrides),
        logger: (event) => void events.push(event)
      }).login(PROVIDER, specWith({ whoami: { path: '/api/me', valuePath: 'mail' } }))

      expect(result, label).toEqual({ kind: 'session', sessionGroup: 'corp' })
      expect(events, label).toContain('providers.session.whoami.failed')
    }
  })

  it('exchange 응답의 principalPath 가 있으면 추가 요청 없이 그 값을 쓴다', async () => {
    const sessions = port({
      send: vi.fn(async () => ({
        status: 200,
        headers: {},
        body: '{"data":{"token":"t-1","mail":"b@example.corp"}}'
      }))
    })
    const result = await new SessionRunner({ sessions }).login(
      PROVIDER,
      specWith({
        whoami: { path: '/api/me', valuePath: 'mail' },
        exchange: { path: '/api/token', valuePath: 'data.token', principalPath: 'data.mail' }
      })
    )

    expect(result).toMatchObject({
      kind: 'token',
      token: { token: 't-1', principalId: 'b@example.corp' }
    })
    // 교환 1회뿐 — whoami 는 부르지 않는다.
    expect(sessions.send).toHaveBeenCalledTimes(1)
  })

  it('exchange 에 principalPath 가 없으면 whoami 로 한 번 더 묻는다', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, headers: {}, body: '{"data":{"token":"t-1"}}' })
      .mockResolvedValueOnce({ status: 200, headers: {}, body: '{"mail":"c@example.corp"}' })
    const result = await new SessionRunner({ sessions: port({ send }) }).login(
      PROVIDER,
      specWith({
        whoami: { path: '/api/me', valuePath: 'mail' },
        exchange: { path: '/api/token', valuePath: 'data.token' }
      })
    )

    expect(result).toMatchObject({
      kind: 'token',
      token: { token: 't-1', principalId: 'c@example.corp' }
    })
    expect(send).toHaveBeenCalledTimes(2)
  })
})
