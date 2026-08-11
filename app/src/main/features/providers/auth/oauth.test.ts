import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { OAuthStart, Provider } from '../../../contracts/provider'
import { LoopbackCancelledError } from '../../../infra/loopback-callback'
import type { OAuthSpec } from './login'
import {
  AUTHORIZATION_TTL_MS,
  base64Url,
  challengeFor,
  createMemoryOAuthStatePersistence,
  createPkce,
  createState,
  OAuthStateStore,
  parseCallbackUrl,
  statesMatch,
  type OAuthStatePersistencePort
} from './oauth'
import { OAuthRunner } from './oauth-runner'

const PROVIDER: Provider = {
  id: 'gw',
  label: '게이트웨이',
  kind: 'llm',
  origin: 'https://gw.example.corp',
  auth: []
}

// 배포 선언이 하는 일을 그대로 흉내낸다 — ctx 에서 pkce·state 를 받아 URL 에 싣고,
// exchange 는 코어가 넘겨준 verifier 를 쓴다.
function oauthSpec(
  options: {
    redirect?: OAuthStart['redirect']
    exchange?: (code: string, verifier: string) => Promise<{ token: string }>
    seen?: { challenge?: string; state?: string; redirectUri?: string }
    // 명세에 `state` 가 없는 SP 를 상대하는 선언 — `ctx.state()` 를 부르지 않고 URL 에도 안 싣는다.
    omitState?: boolean
  } = {}
): OAuthSpec {
  return {
    kind: 'oauth',
    label: '사내 계정',
    present: { location: 'header', name: 'Authorization', scheme: 'bearer' },
    authorize: async (ctx) => {
      const pkce = ctx.pkce()
      const state = options.omitState ? null : ctx.state()
      const redirectUri = ctx.loopbackRedirectUri(0)
      if (options.seen) {
        options.seen.challenge = pkce.challenge
        if (state !== null) options.seen.state = state
        options.seen.redirectUri = redirectUri
      }
      const url = new URL('https://gw.example.corp/oauth/authorize')
      url.searchParams.set('code_challenge', pkce.challenge)
      url.searchParams.set('code_challenge_method', pkce.method)
      if (state !== null) url.searchParams.set('state', state)
      return {
        url: url.toString(),
        redirect: options.redirect ?? { kind: 'manual' },
        exchange:
          options.exchange ??
          (async (code, verifier) => ({ token: `token:${code}:${verifier.slice(0, 6)}` }))
      }
    }
  }
}

describe('PKCE (AC3)', () => {
  it('code_challenge 는 verifier 의 S256 이다', () => {
    const pkce = createPkce()
    expect(pkce.method).toBe('S256')
    // RFC 7636 §4.1 — verifier 는 43~128자 unreserved.
    expect(pkce.verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/)
    // 독립 계산으로 대조한다(구현을 그대로 다시 부르지 않는다).
    const expected = createHash('sha256')
      .update(pkce.verifier, 'ascii')
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(pkce.challenge).toBe(expected)
    // base64url 이므로 `+`·`/`·패딩이 없다.
    expect(pkce.challenge).not.toMatch(/[+/=]/)
  })

  it('RFC 7636 부록 B 의 시험 벡터를 재현한다', () => {
    // 부록 B: verifier `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`
    //         → challenge `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`
    expect(challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    )
  })

  it('verifier 는 호출마다 달라진다', () => {
    const values = new Set(Array.from({ length: 20 }, () => createPkce().verifier))
    expect(values.size).toBe(20)
  })

  it('base64Url 은 URL 안전 알파벳만 낸다', () => {
    expect(base64Url(Buffer.from([251, 255, 190]))).toBe('-_--')
  })
})

describe('state 대조 (AC3)', () => {
  it('state 불일치 콜백을 거부한다', async () => {
    const states = new OAuthStateStore(createMemoryOAuthStatePersistence())
    const seen: { state?: string } = {}
    const exchange = vi.fn(async () => ({ token: 'never' }))
    const runner = new OAuthRunner({
      states,
      openExternal: async () => undefined,
      // 인가 서버가 **다른** state 를 달고 돌아온 상황.
      window: {
        open: async () => 'https://gw.example.corp/cb?code=abc&state=someone-elses-state'
      }
    })

    const result = await runner.begin(
      PROVIDER,
      oauthSpec({ redirect: { kind: 'window', isDone: () => true }, exchange, seen })
    )

    expect(result).toEqual({
      kind: 'failed',
      reason: 'state_mismatch',
      message: expect.any(String)
    })
    // 교환은 시도조차 하지 않는다 — 대조가 먼저다.
    expect(exchange).not.toHaveBeenCalled()
    // pending 은 소비돼 재사용될 수 없다.
    expect(states.pendingFor('gw')).toBeNull()
    expect(seen.state).toBeTruthy()
  })

  it('state 를 보냈는데 안 돌아온 콜백은 거부한다', async () => {
    const runner = new OAuthRunner({
      states: new OAuthStateStore(createMemoryOAuthStatePersistence()),
      openExternal: async () => undefined,
      window: { open: async () => 'https://gw.example.corp/cb?code=abc' }
    })
    expect(
      await runner.begin(PROVIDER, oauthSpec({ redirect: { kind: 'window', isDone: () => true } }))
    ).toMatchObject({ reason: 'state_mismatch' })
  })

  it('state 가 일치하면 verifier 로 교환한다', async () => {
    const states = new OAuthStateStore(createMemoryOAuthStatePersistence())
    const seen: { state?: string; challenge?: string } = {}
    const exchange = vi.fn(async (code: string, verifier: string) => ({
      token: `t:${code}:${verifier}`
    }))
    let callbackUrl = ''
    const runner = new OAuthRunner({
      states,
      openExternal: async () => undefined,
      window: { open: async () => callbackUrl }
    })
    const spec = oauthSpec({
      redirect: {
        kind: 'window',
        isDone: (url) => url.startsWith('https://gw.example.corp/cb')
      },
      exchange,
      seen
    })
    // authorize 가 실제로 발급한 state 를 콜백에 실어 준다.
    const original = spec.authorize.bind(spec)
    spec.authorize = async (ctx) => {
      const start = await original(ctx)
      callbackUrl = `https://gw.example.corp/cb?code=xyz&state=${encodeURIComponent(seen.state ?? '')}`
      return start
    }

    const result = await runner.begin(PROVIDER, spec)
    const seenChallenge = seen.challenge
    expect(result).toMatchObject({ kind: 'token' })
    expect(exchange).toHaveBeenCalledTimes(1)
    const [code, verifier] = exchange.mock.calls[0] ?? []
    expect(code).toBe('xyz')
    // 교환에 넘어간 verifier 가 authorize 에 실린 challenge 의 원본이다.
    expect(challengeFor(verifier ?? '')).toBe(seenChallenge)
    expect(states.pendingFor('gw')).toBeNull()
  })

  it('statesMatch 는 길이가 달라도 던지지 않는다', () => {
    expect(statesMatch('abc', 'abc')).toBe(true)
    expect(statesMatch('abc', 'abcd')).toBe(false)
    expect(statesMatch('abc', '')).toBe(false)
  })
})

// 명세에 `state` 가 없는 SP — 선언이 `ctx.state()` 를 부르지 않아 인가 요청에 state 가 실리지
// 않는다. 이때 콜백에 state 를 요구하면 그 SP 로는 영원히 로그인할 수 없다.
describe('state 를 안 보낸 인가', () => {
  const windowRedirect = { kind: 'window', isDone: () => true } as const

  it('state 없는 콜백으로 교환까지 간다', async () => {
    const states = new OAuthStateStore(createMemoryOAuthStatePersistence())
    const exchange = vi.fn(async () => ({ token: 'ok' }))
    const runner = new OAuthRunner({
      states,
      openExternal: async () => undefined,
      window: { open: async () => 'https://gw.example.corp/cb?code=abc' }
    })

    const result = await runner.begin(
      PROVIDER,
      oauthSpec({ redirect: windowRedirect, exchange, omitState: true })
    )

    expect(result).toMatchObject({ kind: 'token', token: { token: 'ok' } })
    expect(exchange).toHaveBeenCalledTimes(1)
    // 대조를 건너뛰어도 pending 은 1회용이다 — 같은 인가가 두 번 소비되지 않는다.
    expect(states.pendingFor('gw')).toBeNull()
  })

  it('loopback 분기에서도 같다', async () => {
    const states = new OAuthStateStore(createMemoryOAuthStatePersistence())
    const runner = new OAuthRunner({
      states,
      openExternal: async () => undefined,
      listen: async ({ port }) => `http://127.0.0.1:${port}/callback?code=lb`
    })
    expect(
      await runner.begin(
        PROVIDER,
        oauthSpec({ redirect: { kind: 'loopback', port: 9323 }, omitState: true })
      )
    ).toMatchObject({ kind: 'token' })
    expect(states.pendingFor('gw')).toBeNull()
  })

  it('보낸 적 없는 state 가 실려 오면 통과시키되 기록한다', async () => {
    const events: string[] = []
    const runner = new OAuthRunner({
      states: new OAuthStateStore(createMemoryOAuthStatePersistence()),
      openExternal: async () => undefined,
      window: { open: async () => 'https://gw.example.corp/cb?code=abc&state=unasked' },
      logger: (event) => events.push(event)
    })

    // 대조할 기준이 우리에게 없다 — 판정에 쓰지 않고 로그로만 남긴다.
    expect(
      await runner.begin(PROVIDER, oauthSpec({ redirect: windowRedirect, omitState: true }))
    ).toMatchObject({ kind: 'token' })
    expect(events).toContain('providers.oauth.state.unsolicited')
    expect(events).not.toContain('providers.oauth.state.mismatch')
  })
})

describe('state 파일 보관 (AC4)', () => {
  it('재시작 후에도 state 가 대조된다', async () => {
    // 파일 영속을 흉내내는 백킹 — 같은 레코드 위에 store 를 새로 만든다.
    let backing: Record<string, unknown> = {}
    const persistence = (): OAuthStatePersistencePort => ({
      load: () => JSON.parse(JSON.stringify(backing)),
      save: (records) => {
        backing = JSON.parse(JSON.stringify(records))
      }
    })

    // ① 인가 발급 — 여기서 앱이 죽는다고 가정한다.
    const issuing = new OAuthStateStore(persistence())
    const issued = issuing.issue({ providerId: 'gw', state: 'st-1', verifier: 'vf-1' })
    expect(issued.state).toBe('st-1')
    expect(Object.keys(backing)).toEqual(['st-1'])

    // ② 앱 재시작 — 완전히 새 인스턴스가 같은 파일을 읽는다.
    const restarted = new OAuthStateStore(persistence())
    const consumed = restarted.consume({ state: 'st-1', providerId: 'gw' })
    expect(consumed).toMatchObject({ providerId: 'gw', verifier: 'vf-1' })
    // 1회용이라 두 번째 소비는 실패한다(재생 공격 차단).
    expect(restarted.consume({ state: 'st-1', providerId: 'gw' })).toBeNull()
    expect(backing).toEqual({})
  })

  it('provider 당 진행 중 인가는 1건이다', () => {
    const store = new OAuthStateStore(createMemoryOAuthStatePersistence())
    store.issue({ providerId: 'gw', state: 'a', verifier: 'v1' })
    store.issue({ providerId: 'gw', state: 'b', verifier: 'v2' })
    // 새로 시작하면 이전 것이 사라진다 — 조용한 누적이 없다.
    expect(store.consume({ state: 'a', providerId: 'gw' })).toBeNull()
    expect(store.consume({ state: 'b', providerId: 'gw' })).toMatchObject({ verifier: 'v2' })
  })

  it('다른 provider 의 state 로는 소비되지 않는다', () => {
    const store = new OAuthStateStore(createMemoryOAuthStatePersistence())
    store.issue({ providerId: 'gw', state: 'a', verifier: 'v1' })
    expect(store.consume({ state: 'a', providerId: 'other' })).toBeNull()
    expect(store.consume({ state: 'a', providerId: 'gw' })).not.toBeNull()
  })

  it('TTL 이 지난 pending 은 정리된다', () => {
    let now = 1_000
    const store = new OAuthStateStore(createMemoryOAuthStatePersistence(), () => now)
    store.issue({ providerId: 'gw', state: 'a', verifier: 'v1' })
    now += AUTHORIZATION_TTL_MS + 1
    expect(store.consume({ state: 'a', providerId: 'gw' })).toBeNull()
    expect(store.pendingFor('gw')).toBeNull()
  })
})

describe('콜백 URL 파싱', () => {
  it('query 와 fragment 를 모두 본다', () => {
    expect(parseCallbackUrl('http://127.0.0.1:9000/callback?code=a&state=b')).toEqual({
      kind: 'code',
      code: 'a',
      state: 'b'
    })
    expect(parseCallbackUrl('http://127.0.0.1:9000/callback#code=a&state=b')).toEqual({
      kind: 'code',
      code: 'a',
      state: 'b'
    })
  })

  it('인가 서버의 명시적 거부를 error 로 낸다', () => {
    expect(
      parseCallbackUrl('http://127.0.0.1:9000/cb?error=access_denied&error_description=nope')
    ).toEqual({ kind: 'error', error: 'access_denied', description: 'nope' })
  })

  it('code 도 error 도 없으면 unrelated 다', () => {
    expect(parseCallbackUrl('http://127.0.0.1:9000/favicon.ico')).toEqual({ kind: 'unrelated' })
    expect(parseCallbackUrl('not a url')).toEqual({ kind: 'unrelated' })
  })
})

describe('redirect 3분기', () => {
  it('manual 은 code-required 로 멈추고, 붙여 넣은 code 로 교환한다', async () => {
    const states = new OAuthStateStore(createMemoryOAuthStatePersistence())
    const runner = new OAuthRunner({ states, openExternal: async () => undefined })
    const spec = oauthSpec({ redirect: { kind: 'manual' } })

    const started = await runner.begin(PROVIDER, spec)
    expect(started).toMatchObject({ kind: 'code-required' })
    expect(states.pendingFor('gw')).not.toBeNull()

    const done = await runner.complete(PROVIDER, spec, 'pasted-code')
    expect(done).toMatchObject({ kind: 'token' })
    expect((done as { token: { token: string } }).token.token).toContain('pasted-code')
    // 소비 후에는 같은 code 로 다시 못 넣는다.
    expect(await runner.complete(PROVIDER, spec, 'pasted-code')).toMatchObject({
      reason: 'cancelled'
    })
  })

  it('loopback 은 리스너의 콜백 URL 로 이어진다', async () => {
    const states = new OAuthStateStore(createMemoryOAuthStatePersistence())
    const seen: { state?: string; redirectUri?: string } = {}
    const opened: string[] = []
    const runner = new OAuthRunner({
      states,
      openExternal: async (url) => {
        opened.push(url)
      },
      listen: async ({ port }) =>
        `http://127.0.0.1:${port}/callback?code=lb&state=${encodeURIComponent(seen.state ?? '')}`
    })
    const result = await runner.begin(
      PROVIDER,
      oauthSpec({ redirect: { kind: 'loopback', port: 9321 }, seen })
    )
    expect(result).toMatchObject({ kind: 'token' })
    // 기본 브라우저로 authorize URL 을 연다(앱 내부 창이 아니다).
    expect(opened[0]).toContain('https://gw.example.corp/oauth/authorize')
    expect(seen.redirectUri).toBe('http://127.0.0.1:0/callback')
  })

  it('loopback 취소·타임아웃은 cancelled 로 접힌다', async () => {
    const runner = new OAuthRunner({
      states: new OAuthStateStore(createMemoryOAuthStatePersistence()),
      openExternal: async () => undefined,
      listen: async () => {
        throw new LoopbackCancelledError('timeout')
      }
    })
    expect(
      await runner.begin(PROVIDER, oauthSpec({ redirect: { kind: 'loopback', port: 9322 } }))
    ).toMatchObject({ kind: 'failed', reason: 'cancelled' })
  })

  it('window 실행기가 없으면 조용히 대체하지 않고 unsupported 로 실패한다', async () => {
    const runner = new OAuthRunner({
      states: new OAuthStateStore(createMemoryOAuthStatePersistence()),
      openExternal: async () => undefined
    })
    expect(
      await runner.begin(PROVIDER, oauthSpec({ redirect: { kind: 'window', isDone: () => true } }))
    ).toMatchObject({ kind: 'failed', reason: 'unsupported' })
  })

  it('창을 닫으면 cancelled 다', async () => {
    const runner = new OAuthRunner({
      states: new OAuthStateStore(createMemoryOAuthStatePersistence()),
      openExternal: async () => undefined,
      window: { open: async () => null }
    })
    expect(
      await runner.begin(PROVIDER, oauthSpec({ redirect: { kind: 'window', isDone: () => true } }))
    ).toMatchObject({ kind: 'failed', reason: 'cancelled' })
  })

  it('교환 실패는 exchange_failed 로 표면화된다', async () => {
    const runner = new OAuthRunner({
      states: new OAuthStateStore(createMemoryOAuthStatePersistence()),
      openExternal: async () => undefined
    })
    const spec = oauthSpec({
      redirect: { kind: 'manual' },
      exchange: async () => {
        throw new Error('502 bad gateway')
      }
    })
    await runner.begin(PROVIDER, spec)
    expect(await runner.complete(PROVIDER, spec, 'c')).toEqual({
      kind: 'failed',
      reason: 'exchange_failed',
      message: '502 bad gateway'
    })
  })

  it('선언이 ctx 를 안 불러도 코어가 PKCE·state 를 채운다', async () => {
    const states = new OAuthStateStore(createMemoryOAuthStatePersistence())
    const runner = new OAuthRunner({ states, openExternal: async () => undefined })
    const lazy: OAuthSpec = {
      kind: 'oauth',
      label: '느슨한 선언',
      present: { location: 'header', name: 'Authorization' },
      authorize: async () => ({
        url: 'https://gw.example.corp/authorize',
        redirect: { kind: 'manual' },
        exchange: async (_code, verifier) => ({ token: verifier })
      })
    }
    await runner.begin(PROVIDER, lazy)
    const pending = states.pendingFor('gw')
    expect(pending?.verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/)
    expect(pending?.state).toBeTruthy()
  })
})

describe('createState', () => {
  it('호출마다 다른 값을 낸다', () => {
    expect(new Set(Array.from({ length: 20 }, () => createState())).size).toBe(20)
  })
})
