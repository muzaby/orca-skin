// AC8 의 핵심 검증 (0157 verify r1 / D3) — **credential kind 에서 presentation 을 추론하지 않는다.**
//
// 요구명세 §Static credential 와 HTTP presentation 의 요지: 같은 PAT 를 서비스별로 Bearer /
// Basic password / 전용 header 로 다르게 붙일 수 있어야 한다. 그 "다르게" 를 한 곳에서 대조한다.

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyPresentation,
  createSender,
  ResponseTooLargeError,
  type PreparedRequest
} from './authenticated-fetch'
import type { CredentialPresentation } from '../../../shared/ipc'

const PAT = 'glpat-EXAMPLE-TOKEN'

function req(): PreparedRequest {
  return { url: 'https://wiki.corp.invalid/rest/api/content', method: 'GET', headers: {} }
}

describe('applyPresentation — 같은 credential, 다른 표현 (AC8)', () => {
  // 이 표가 AC8 그 자체다: **하나의 PAT** 가 선언에 따라 4가지로 나간다.
  const cases: Array<{ label: string; presentation: CredentialPresentation; expect: string }> = [
    {
      label: 'Bearer (GitHub·일반 REST)',
      presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' },
      expect: `Bearer ${PAT}`
    },
    {
      label: 'Basic password (일부 Atlassian 배포)',
      presentation: { location: 'header', name: 'Authorization', scheme: 'Basic' },
      expect: `Basic ${Buffer.from(`:${PAT}`).toString('base64')}`
    },
    {
      label: 'BasicPair (ID/비밀번호 — secret 자체가 user:pass)',
      presentation: { location: 'header', name: 'X-Basic-Pair', scheme: 'BasicPair' },
      expect: `Basic ${Buffer.from(PAT).toString('base64')}`
    },
    {
      label: 'Token (일부 사내 게이트웨이)',
      presentation: { location: 'header', name: 'Authorization', scheme: 'Token' },
      expect: `Token ${PAT}`
    },
    {
      label: '전용 header (GitLab PRIVATE-TOKEN)',
      presentation: { location: 'header', name: 'PRIVATE-TOKEN' },
      expect: PAT
    }
  ]

  for (const c of cases) {
    it(`${c.label} 로 붙인다`, () => {
      const out = applyPresentation(req(), c.presentation, PAT)
      expect(out.headers[c.presentation.name as string]).toBe(c.expect)
    })
  }

  it('다섯 가지 표현이 서로 다르다 — kind 하나에 표현이 고정되지 않는다', () => {
    const rendered = cases.map((c) => {
      const out = applyPresentation(req(), c.presentation, PAT)
      return `${c.presentation.name}: ${out.headers[c.presentation.name as string]}`
    })
    expect(new Set(rendered).size).toBe(5)
  })

  // 0160 — 두 Basic 계열은 **다른 규칙**이다. 하나로 뭉개면 ID/비밀번호가 `:user:pass` 로 나간다.
  it('BasicPair 는 secret 전체를 base64 하고, Basic 은 빈 사용자명 형식을 유지한다', () => {
    const pair = 'alice:s3cret'
    const asPair = applyPresentation(
      req(),
      { location: 'header', name: 'Authorization', scheme: 'BasicPair' },
      pair
    )
    const asBasic = applyPresentation(
      req(),
      { location: 'header', name: 'Authorization', scheme: 'Basic' },
      pair
    )
    expect(asPair.headers.Authorization).toBe(
      `Basic ${Buffer.from('alice:s3cret').toString('base64')}`
    )
    expect(asBasic.headers.Authorization).toBe(
      `Basic ${Buffer.from(':alice:s3cret').toString('base64')}`
    )
    expect(asPair.headers.Authorization).not.toBe(asBasic.headers.Authorization)
  })

  it('scheme 미지정(Raw)은 값을 그대로 넣는다', () => {
    const out = applyPresentation(req(), { location: 'header', name: 'X-API-Key' }, 'key123')
    expect(out.headers['X-API-Key']).toBe('key123')
  })

  it("scheme 'Raw' 를 명시해도 동일하다", () => {
    const out = applyPresentation(
      req(),
      { location: 'header', name: 'X-API-Key', scheme: 'Raw' },
      'key123'
    )
    expect(out.headers['X-API-Key']).toBe('key123')
  })
})

describe('applyPresentation — cookie / query', () => {
  it('cookie 는 기존 Cookie 헤더를 덮어쓰지 않고 덧붙인다', () => {
    const base: PreparedRequest = { ...req(), headers: { Cookie: 'existing=1' } }
    const out = applyPresentation(base, { location: 'cookie', name: 'session' }, PAT)
    expect(out.headers.Cookie).toBe(`existing=1; session=${PAT}`)
  })

  it('기존 Cookie 가 없으면 새로 만든다', () => {
    const out = applyPresentation(req(), { location: 'cookie', name: 'session' }, PAT)
    expect(out.headers.Cookie).toBe(`session=${PAT}`)
  })

  it('query 는 URL 에 실리고 헤더는 건드리지 않는다', () => {
    const out = applyPresentation(
      req(),
      { location: 'query', name: 'access_token', restricted: true },
      PAT
    )
    expect(new URL(out.url).searchParams.get('access_token')).toBe(PAT)
    expect(out.headers).toEqual({})
  })

  it('query 는 기존 쿼리 파라미터를 보존한다', () => {
    const base: PreparedRequest = { ...req(), url: 'https://wiki.corp.invalid/x?page=2' }
    const out = applyPresentation(
      base,
      { location: 'query', name: 'access_token', restricted: true },
      PAT
    )
    const params = new URL(out.url).searchParams
    expect(params.get('page')).toBe('2')
    expect(params.get('access_token')).toBe(PAT)
  })
})

// ── createSender — 바이너리 수신 · 크기 상한 (0160) ─────────────────────────────
//
// 0160 이전에는 `res.text()` 하나뿐이라 **바이너리 수신 경로가 존재하지 않았다** — 첨부를
// 내려받으면 UTF-8 로 디코드되어 손상됐다. 상한도 없어 대용량 첨부가 main 메모리를 통째로 먹었다.

function stubFetch(res: Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => res)
  )
}

function bytesResponse(bytes: Uint8Array, headers: Record<string, string> = {}): Response {
  // Uint8Array<ArrayBufferLike> 는 BodyInit 에 직접 안 맞는다 — 버퍼를 떼어 넘긴다.
  return new Response(bytes.buffer as ArrayBuffer, { status: 200, headers })
}

describe('createSender — 전송 구현 주입 (0173)', () => {
  it('전역 fetch 가 아니라 주입된 구현으로 보낸다', async () => {
    // 전역이 호출되면 사내 프록시·사설 CA 를 안 타는 Node 스택으로 나간 것이다.
    const globalSpy = vi.fn(async () => new Response('전역', { status: 500 }))
    vi.stubGlobal('fetch', globalSpy)
    const injected = vi.fn(async () => new Response('주입', { status: 200 }))

    const out = await createSender(injected as unknown as typeof fetch).send(req())

    expect(injected).toHaveBeenCalledOnce()
    expect(globalSpy).not.toHaveBeenCalled()
    expect(out.status).toBe(200)
    expect(out.body).toBe('주입')
  })

  it('주입 구현에 method·headers·body 와 정책 옵션을 그대로 넘긴다', async () => {
    const injected = vi.fn(async () => new Response(null, { status: 204 }))
    await createSender(injected as unknown as typeof fetch).send({
      url: 'https://wiki.corp.invalid/rest',
      method: 'POST',
      headers: { Authorization: 'Bearer x' },
      body: '{"q":1}'
    })

    const [url, init] = injected.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://wiki.corp.invalid/rest')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Authorization: 'Bearer x' })
    expect(init.body).toBe('{"q":1}')
    // 스택을 바꿔도 정책은 그대로다 — 쿠키 미전송 + redirect 수동.
    expect(init.credentials).toBe('omit')
    expect(init.redirect).toBe('manual')
  })
})

describe('createSender — responseType', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('binary 요청은 bodyBytes 를 채운다', async () => {
    // 유효한 UTF-8 이 아닌 바이트열 — text 경로였다면 U+FFFD 로 뭉개진다.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe])
    stubFetch(bytesResponse(png))
    const out = await createSender(fetch).send(req(), undefined, { responseType: 'binary' })
    expect(out.bodyBytes).toEqual(png)
    expect(out.body).toBe('')
  })

  it('미지정 responseType 은 text 로 동작한다', async () => {
    stubFetch(new Response('hello', { status: 200 }))
    const out = await createSender(fetch).send(req())
    expect(out.body).toBe('hello')
    expect(out.bodyBytes).toBeUndefined()
  })

  it("명시한 'text' 도 text 로 동작한다", async () => {
    stubFetch(new Response('hello', { status: 200 }))
    const out = await createSender(fetch).send(req(), undefined, { responseType: 'text' })
    expect(out.body).toBe('hello')
    expect(out.bodyBytes).toBeUndefined()
  })
})

describe('createSender — maxBytes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('선언 길이 초과를 거부한다', async () => {
    stubFetch(bytesResponse(new Uint8Array(50), { 'content-length': '5000' }))
    await expect(
      createSender(fetch).send(req(), undefined, { responseType: 'binary', maxBytes: 100 })
    ).rejects.toThrow(ResponseTooLargeError)
  })

  it('선언 없이 초과 누적되면 중단한다', async () => {
    // content-length 없이 상한을 넘는 본문 — 서버가 길이를 안 주거나 속이는 경우.
    stubFetch(bytesResponse(new Uint8Array(500)))
    await expect(
      createSender(fetch).send(req(), undefined, { responseType: 'binary', maxBytes: 100 })
    ).rejects.toThrow(ResponseTooLargeError)
  })

  it('상한 이내 바이너리는 그대로 통과한다', async () => {
    stubFetch(bytesResponse(new Uint8Array([1, 2, 3])))
    const out = await createSender(fetch).send(req(), undefined, {
      responseType: 'binary',
      maxBytes: 100
    })
    expect(out.bodyBytes).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('텍스트 응답도 상한을 넘으면 거부한다 (바이트 기준)', async () => {
    // 한글 3자 = 9바이트 — 문자 수(3)로 재면 상한 5 를 통과해버린다.
    stubFetch(new Response('가나다', { status: 200 }))
    await expect(createSender(fetch).send(req(), undefined, { maxBytes: 5 })).rejects.toThrow(
      ResponseTooLargeError
    )
  })

  it('상한 미지정이면 큰 응답도 받는다', async () => {
    stubFetch(bytesResponse(new Uint8Array(10_000)))
    const out = await createSender(fetch).send(req(), undefined, { responseType: 'binary' })
    expect(out.bodyBytes?.byteLength).toBe(10_000)
  })
})

describe('applyPresentation — 불변성', () => {
  it('입력 요청을 변형하지 않는다 (원본에 secret 이 남지 않는다)', () => {
    const base = req()
    applyPresentation(base, { location: 'header', name: 'Authorization', scheme: 'Bearer' }, PAT)
    expect(base.headers).toEqual({})
    expect(JSON.stringify(base)).not.toContain(PAT)
  })

  it('다른 헤더는 보존한다', () => {
    const base: PreparedRequest = { ...req(), headers: { Accept: 'application/json' } }
    const out = applyPresentation(
      base,
      { location: 'header', name: 'Authorization', scheme: 'Bearer' },
      PAT
    )
    expect(out.headers.Accept).toBe('application/json')
  })
})
