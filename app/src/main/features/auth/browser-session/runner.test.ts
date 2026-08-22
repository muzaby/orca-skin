// 게이트 인증 방식(ADFS/WIA) — 사용자 결정 "둘 다 필요" 의 두 갈래를 확인한다:
// ① 세션에서 끝나는 경우 ② 그 세션으로 **final URL 의 인가 코드**를 토큰과 교환하는 경우(0195).
//
// `BrowserSessionPort` 를 fake 로 두므로 electron 없이 돈다(실제 창·쿠키는 사람 실기).

import { describe, expect, it, vi } from 'vitest'
import type { AuthDefinition, Presentation, SessionTokenExchange } from '../../../contracts/auth'
import type { BrowserSessionSpec } from '../login'
import type { PreparedRequest } from '../../../infra/net/transport'
import {
  normalizeExpiry,
  pickPath,
  pickUrlParam,
  type BrowserSessionPort
} from '../specs/browser-session'
import { SessionRunner, type SessionRunnerDeps } from './runner'

const PROVIDER: AuthDefinition = {
  id: 'corp-sso',
  label: '사내 로그인',
  origin: 'https://portal.example.corp',
  methods: []
}

const BEARER: Presentation = { location: 'header', name: 'Authorization', scheme: 'bearer' }

// 교환 선언의 필수 두 자리(`code`·`present`)를 기본값으로 채운다 — 케이스가 **자기가 바꾸는
// 축만** 적게 하려는 것이다. 두 자리는 타입이 필수로 강제하므로(0195 §10) 여기서 뺄 수 없다.
function exchangeSpec(patch: Partial<SessionTokenExchange> = {}): SessionTokenExchange {
  return {
    path: '/api/token',
    accessTokenPath: 'data.token',
    present: BEARER,
    // `code` 는 필드가 전부 선택이라 **빈 객체가 곧 표식**이다 — "이 SP 는 코드를 돌려준다".
    // 객체 자체의 필수 여부가 D-006 의 컴파일 강제를 담당한다.
    code: {},
    ...patch
  }
}

function spec(exchange?: SessionTokenExchange): BrowserSessionSpec {
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

// 창이 돌려주는 final URL. 코드는 **여기에만** 있다 — 기본값은 코드를 담은 URL 이라 교환 케이스가
// 매번 적지 않아도 된다.
const DONE_URL = 'https://portal.example.corp/home?code=auth-code-1'

function port(overrides: Partial<BrowserSessionPort> = {}): BrowserSessionPort {
  return {
    register: vi.fn(),
    acquire: vi.fn(() => 'handle-1'),
    openLoginWindow: vi.fn(async () => ({ finalUrl: DONE_URL })),
    clear: async () => undefined,
    send: vi.fn(async () => ({ status: 200, headers: {}, body: '{}' })),
    ...overrides
  }
}

// fake `sessions.send` 가 받은 요청. 교환이 **무엇을 실어 보냈는지**를 이 값으로 단언한다.
function sentRequest(sessions: BrowserSessionPort, index = 0): PreparedRequest {
  const call = (sessions.send as ReturnType<typeof vi.fn>).mock.calls[index] ?? []
  return call[1] as PreparedRequest
}

// 교환 요청이 실어 보낸 **본문**. 형상이 `application/json` 하나로 고정이라(0196 D-009) 케이스가
// 파서를 고를 필요가 없다 — 코드가 어디 실렸는지는 전부 이 값이 말한다.
function sentBody(sessions: BrowserSessionPort, index = 0): unknown {
  const { body } = sentRequest(sessions, index)
  expect(typeof body).toBe('string')
  return JSON.parse(body as string)
}

function jsonPort(body: string, finalUrl = DONE_URL): BrowserSessionPort {
  return port({
    openLoginWindow: vi.fn(async () => ({ finalUrl })),
    send: vi.fn(async () => ({ status: 200, headers: {}, body }))
  })
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
  // 있지만, 그 확인은 `LoginService` 가 grant 커밋 뒤 `AuthDefinition.probe` 로 한다(login.test.ts).
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

describe('SessionRunner — ② 인가 코드로 토큰 교환 (0195)', () => {
  it('exchange 가 선언되면 token grant 로 승격한다', async () => {
    const sessions = jsonPort(
      JSON.stringify({ data: { token: 'tok-1', expires_in: 1_700_000_000 } })
    )
    const result = await new SessionRunner({ sessions }).login(
      PROVIDER,
      spec(exchangeSpec({ expiresAtPath: 'data.expires_in' }))
    )
    expect(result).toEqual({
      kind: 'token',
      token: { token: 'tok-1', expiresAt: 1_700_000_000_000 }
    })
    // origin 밖으로 나가지 않는다 — path 는 provider.origin 기준 상대 경로다.
    expect(new URL(sentRequest(sessions).url).origin).toBe('https://portal.example.corp')
    expect(new URL(sentRequest(sessions).url).pathname).toBe('/api/token')
  })

  // AC2 (0196) — 요청 형상은 **코어가 고정한다**(D-009). 선언이 고를 수 있는 것은 이름뿐이라
  // `method`·content-type 을 단언하는 이 케이스가 곧 그 고정의 정본이다.
  it('교환 요청은 POST + application/json 이고 본문에 코드와 code.extraFields 가 함께 실린다', async () => {
    const sessions = jsonPort('{"data":{"token":"t"}}')
    await new SessionRunner({ sessions }).login(
      PROVIDER,
      spec(
        exchangeSpec({
          code: {
            bodyField: 'authorization_code',
            extraFields: { grant_type: 'authorization_code', client_id: 'orca' }
          }
        })
      )
    )

    const req = sentRequest(sessions)
    expect(req.method).toBe('POST')
    expect(req.headers['content-type']).toBe('application/json')
    expect(sentBody(sessions)).toEqual({
      authorization_code: 'auth-code-1',
      grant_type: 'authorization_code',
      client_id: 'orca'
    })
  })

  // AC3 (0196) — 코드는 **URL 어디에도** 없다. `search === ''` 하나로는 코드가 path 에 붙는 변이를
  // 못 보므로 URL 전체를 함께 본다 — 두 단언이 같은 불변식의 두 면이다. 마지막 줄이 없으면
  // "코드를 아예 안 싣는다" 는 변이도 앞의 두 줄을 통과한다.
  it('교환 요청 URL 에 쿼리가 붙지 않고 코드 값도 실리지 않는다', async () => {
    const sessions = jsonPort(
      '{"data":{"token":"t"}}',
      'https://portal.example.corp/home?code=secret-code'
    )
    await new SessionRunner({ sessions }).login(PROVIDER, spec(exchangeSpec()))

    const req = sentRequest(sessions)
    expect(new URL(req.url).search).toBe('')
    expect(req.url).not.toContain('secret-code')
    expect(sentBody(sessions)).toEqual({ code: 'secret-code' })
  })

  // AC4 — final URL 에서 코드를 **꺼낼** 이름 (D-005). ⓐ 미지정 기본값 `'code'` ⓑ 선언한 이름.
  it('code.urlParam 미지정이면 code 로 찾고, 지정하면 그 이름으로 찾는다', async () => {
    const byDefault = jsonPort(
      '{"data":{"token":"t"}}',
      'https://portal.example.corp/home?code=xyz'
    )
    await new SessionRunner({ sessions: byDefault }).login(PROVIDER, spec(exchangeSpec()))
    expect(sentBody(byDefault)).toEqual({ code: 'xyz' })

    const named = jsonPort('{"data":{"token":"t"}}', 'https://portal.example.corp/home?ticket=abc')
    await new SessionRunner({ sessions: named }).login(
      PROVIDER,
      spec(exchangeSpec({ code: { urlParam: 'ticket' } }))
    )
    expect(sentBody(named)).toEqual({ ticket: 'abc' })
  })

  // AC5 — 본문에서 코드를 **부를** 이름. 미지정이면 유효 `param`, 지정하면 그 이름이고 받은
  // 이름은 본문에 남지 않는다(`toEqual` 이 그 부재를 센다).
  it('code.bodyField 미지정이면 본문 키가 유효 urlParam 이고, 지정하면 그 이름 하나만 남는다', async () => {
    const inherited = jsonPort(
      '{"data":{"token":"t"}}',
      'https://portal.example.corp/home?ticket=abc'
    )
    await new SessionRunner({ sessions: inherited }).login(
      PROVIDER,
      spec(exchangeSpec({ code: { urlParam: 'ticket' } }))
    )
    expect(sentBody(inherited)).toEqual({ ticket: 'abc' })

    const renamed = jsonPort(
      '{"data":{"token":"t"}}',
      'https://portal.example.corp/home?ticket=abc'
    )
    await new SessionRunner({ sessions: renamed }).login(
      PROVIDER,
      spec(exchangeSpec({ code: { urlParam: 'ticket', bodyField: 'authorization_code' } }))
    )
    expect(sentBody(renamed)).toEqual({ authorization_code: 'abc' })
  })

  // AC6 (0196) — `params` 에 코드와 **같은 이름**이 있으면 실제 인가 코드가 이긴다. 0195 는 이
  // 불변식을 주석으로만 갖고 있었다(파생 D2). 전개 순서를 뒤집으면 자리표시자가 실려 실패한다.
  it('code.extraFields 에 같은 이름이 있어도 final URL 의 코드가 이긴다', async () => {
    const sessions = jsonPort('{"data":{"token":"t"}}')
    await new SessionRunner({ sessions }).login(
      PROVIDER,
      spec(exchangeSpec({ code: { extraFields: { code: 'PLACEHOLDER', grant_type: 'x' } } }))
    )

    expect(sentBody(sessions)).toEqual({ code: 'auth-code-1', grant_type: 'x' })
  })

  // AC6 — 코드가 없으면 실패다. **쿠키로 떨어지지 않는다** (D-006): 0195 이전에는 코드를 보지도
  // 않고 쿠키로 GET 했으므로, 이 케이스가 그 경로의 부재를 센다.
  it('final URL 에 그 이름이 없으면 exchange_failed 이고 요청 자체가 나가지 않는다', async () => {
    const events: Array<[string, Record<string, unknown>]> = []
    const sessions = jsonPort('{"data":{"token":"t"}}', 'https://portal.example.corp/home?other=1')
    const result = await new SessionRunner({
      sessions,
      logger: (event, data) => void events.push([event, data])
    }).login(PROVIDER, spec(exchangeSpec({ code: { urlParam: 'ticket' } })))

    expect(result).toMatchObject({ kind: 'failed', reason: 'exchange_failed' })
    expect(sessions.send).not.toHaveBeenCalled()
    const logged = events.find(([event]) => event === 'providers.session.exchange.no-code')
    expect(logged?.[1]).toEqual({ authId: 'corp-sso', urlParam: 'ticket' })
  })

  // 값이 아니라 **이름**만 남는다. 인가 코드는 자격증명이라 로그 파일에 실리면 안 된다.
  it('실패 로그에 코드 값이 실리지 않는다', async () => {
    const events: Array<[string, Record<string, unknown>]> = []
    const sessions = jsonPort(
      '{"data":{"token":"t"}}',
      'https://portal.example.corp/home?code=secret-code'
    )
    await new SessionRunner({
      sessions,
      logger: (event, data) => void events.push([event, data])
    }).login(PROVIDER, spec(exchangeSpec({ code: { urlParam: 'ticket' } })))

    expect(JSON.stringify(events)).not.toContain('secret-code')
  })

  // AC7 — 파티션·쿠키를 유지하는 전송은 `sessions.send` 하나다(D-007). `netFetch` 는 세션 인자
  // 없이 나가고 `createSender` 는 `credentials:'omit'` 을 박는다.
  it('교환은 sessions.send 로 나간다 — 그 handle 은 acquire 가 준 것이다', async () => {
    const sessions = jsonPort('{"data":{"token":"t"}}')
    await new SessionRunner({ sessions }).login(PROVIDER, spec(exchangeSpec()))

    const call = (sessions.send as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
    expect(call[0]).toBe('handle-1')
    expect(sessions.acquire).toHaveBeenCalledWith('corp')
  })

  it('SessionRunnerDeps 에 전송 포트를 하나 더 둘 자리가 없다 (D-007)', () => {
    // @ts-expect-error — `fetchImpl` 자리가 생기면 이 줄이 컴파일에 성공해 버려 실패한다.
    const deps: SessionRunnerDeps = { sessions: port(), fetchImpl: globalThis.fetch }
    expect(deps.sessions).toBeDefined()
  })

  // AC8ⓐ — 토큰의 출처는 **응답 JSON** 이다. 쿠키(= 같은 fake port·같은 handle)는 그대로인데
  // 응답 본문만 바꾸면 토큰이 따라 바뀐다. 쿠키에서 파생된다면 이 단언이 깨진다.
  it('같은 세션·다른 응답 본문이면 토큰이 응답을 따라간다', async () => {
    const first = await new SessionRunner({ sessions: jsonPort('{"data":{"token":"A"}}') }).login(
      PROVIDER,
      spec(exchangeSpec())
    )
    const second = await new SessionRunner({ sessions: jsonPort('{"data":{"token":"B"}}') }).login(
      PROVIDER,
      spec(exchangeSpec())
    )

    expect(first).toMatchObject({ kind: 'token', token: { token: 'A' } })
    expect(second).toMatchObject({ kind: 'token', token: { token: 'B' } })
  })

  // 0197 A-2 — 조립이 `compact<TokenValue>` 로 바뀌어도 **결과 객체의 키 집합은 그대로**여야
  // 한다. `toEqual` 은 `undefined` 프로퍼티를 없는 것과 같게 보므로 그것으로는 이 축을 못
  // 잡는다 — 키를 직접 센다. `refreshExpiresAt: undefined` 를 명시적으로 넘기고 있어서, 그것이
  // 지워지지 않으면 여기서 드러난다.
  it('응답이 말하지 않은 필드는 키 자체가 생기지 않는다', async () => {
    const result = await new SessionRunner({
      sessions: jsonPort('{"data":{"token":"t"}}')
    }).login(PROVIDER, spec(exchangeSpec()))

    expect(result.kind).toBe('token')
    const token = (result as Extract<typeof result, { kind: 'token' }>).token
    expect(Object.keys(token).sort()).toEqual(['token'])
  })

  // AC9 — refresh 는 **경로를 선언한 경우에만** 흡수한다(D-003 fail-closed). 갱신 기능이 없는
  // 지금 무조건 저장하면 vault 에 쓰이지 않는 비밀이 남는다.
  it('refreshTokenPath 를 선언한 경우에만 refreshToken 이 실린다', async () => {
    const body = '{"data":{"token":"t","refresh":"r-1"}}'

    const declared = await new SessionRunner({ sessions: jsonPort(body) }).login(
      PROVIDER,
      spec(exchangeSpec({ refreshTokenPath: 'data.refresh' }))
    )
    const omitted = await new SessionRunner({ sessions: jsonPort(body) }).login(
      PROVIDER,
      spec(exchangeSpec())
    )

    expect(declared).toEqual({ kind: 'token', token: { token: 't', refreshToken: 'r-1' } })
    // 키 자체가 없다 — `undefined` 를 담으면 `compact` 를 거쳐도 의미가 갈린다.
    expect(omitted).toEqual({ kind: 'token', token: { token: 't' } })
  })

  it('선언한 refreshTokenPath 에 값이 없으면 싣지 않는다', async () => {
    const result = await new SessionRunner({
      sessions: jsonPort('{"data":{"token":"t"}}')
    }).login(PROVIDER, spec(exchangeSpec({ refreshTokenPath: 'data.refresh' })))

    expect(result).toEqual({ kind: 'token', token: { token: 't' } })
  })

  it('교환 실패·형식 불일치는 exchange_failed 로 표면화된다', async () => {
    const cases: Array<[string, Partial<BrowserSessionPort>]> = [
      ['비-2xx', { send: vi.fn(async () => ({ status: 500, headers: {}, body: '' })) }],
      ['JSON 아님', { send: vi.fn(async () => ({ status: 200, headers: {}, body: 'nope' })) }],
      [
        '경로에 값 없음',
        { send: vi.fn(async () => ({ status: 200, headers: {}, body: '{"other":1}' })) }
      ],
      // 전송 예외 — `getJson` 의 catch 가 잡아 사유로 접는다. whoami 쪽에는 이 갈래의 케이스가
      // 있었지만 교환 쪽에는 없었다(0196 구현 턴 발견): 예외가 그대로 새면 로그인 호출부가
      // reject 되어 `exchange_failed` 가 아니라 처리되지 않은 예외가 된다.
      [
        '전송 실패',
        {
          send: vi.fn(async () => {
            throw new Error('네트워크 끊김')
          })
        }
      ]
    ]
    for (const [label, overrides] of cases) {
      const result = await new SessionRunner({ sessions: port(overrides) }).login(
        PROVIDER,
        spec(exchangeSpec())
      )
      expect(result, label).toMatchObject({ kind: 'failed', reason: 'exchange_failed' })
      if (label === '전송 실패') {
        expect(result).toMatchObject({ message: '네트워크 끊김' })
      }
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

  it('final URL 의 파라미터는 쿼리와 프래그먼트를 모두 본다', () => {
    expect(pickUrlParam('https://p.example.corp/home?code=a', 'code')).toBe('a')
    expect(pickUrlParam('https://p.example.corp/home#code=b', 'code')).toBe('b')
    expect(pickUrlParam('https://p.example.corp/home?ticket=c', 'ticket')).toBe('c')
    // 이름이 다르면 못 찾는다 — 이름을 선언이 정한다는 규칙이 여기서 성립한다.
    expect(pickUrlParam('https://p.example.corp/home?ticket=c', 'code')).toBeUndefined()
    // 빈 값은 값이 아니다 — 빈 코드로 교환 요청을 내면 실패 사유가 SP 응답으로 미뤄진다.
    expect(pickUrlParam('https://p.example.corp/home?code=', 'code')).toBeUndefined()
    expect(pickUrlParam('not a url', 'code')).toBeUndefined()
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
  exchange?: SessionTokenExchange
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
      clear: async () => undefined,
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
          clear: async () => undefined,
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
      clear: async () => undefined,
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
        exchange: exchangeSpec({ principalPath: 'data.mail' })
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
        exchange: exchangeSpec()
      })
    )

    expect(result).toMatchObject({
      kind: 'token',
      token: { token: 't-1', principalId: 'c@example.corp' }
    })
    expect(send).toHaveBeenCalledTimes(2)
  })
})
