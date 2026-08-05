// 0174 — Chromium 전송 결과 변환. `net.fetch` 가 못 하는 "3xx 를 돌려주기" 의 순수부.

import { describe, expect, it } from 'vitest'
import { flattenHeaders, locationOf, redirectFacts, toResponse } from './net-response'

describe('flattenHeaders', () => {
  it('배열 헤더를 소문자 단일 값으로 평탄화한다', () => {
    expect(flattenHeaders({ 'Content-Type': ['text/html'], LOCATION: ['/next'] })).toEqual({
      'content-type': 'text/html',
      location: '/next'
    })
  })

  it('다중 값은 콤마로 잇되 set-cookie 는 첫 값만 쓴다', () => {
    // 쿠키를 콤마로 이으면 파싱 불가능한 문자열이 된다. 우리는 쿠키를 읽지 않는다(세션이 소유).
    const out = flattenHeaders({ Vary: ['Accept', 'Cookie'], 'Set-Cookie': ['a=1', 'b=2'] })
    expect(out['vary']).toBe('Accept, Cookie')
    expect(out['set-cookie']).toBe('a=1')
  })

  it('빈 배열 헤더는 싣지 않는다', () => {
    expect(flattenHeaders({ 'X-Empty': [] })).toEqual({})
  })
})

describe('redirect 이벤트 → 3xx 응답 합성', () => {
  it('status 와 절대 Location 을 담는다', () => {
    const facts = redirectFacts(302, 'https://adfs.corp/adfs/ls?wa=wsignin1.0', {
      Location: ['/adfs/ls?wa=wsignin1.0'],
      'Content-Length': ['0']
    })

    expect(facts.status).toBe(302)
    // 이벤트가 준 **절대 URL** 이 원본 상대 경로를 덮는다 — 호출자가 바로 다음 홉으로 쓴다.
    expect(facts.headers['location']).toBe('https://adfs.corp/adfs/ls?wa=wsignin1.0')
    expect(facts.headers['content-length']).toBe('0')
  })

  it('합성한 Response 가 3xx status 와 Location 을 그대로 노출한다', () => {
    // 이게 성립해야 broker 의 홉 루프(sendFollowingRedirects)가 다음 홉을 만들 수 있다.
    const res = toResponse(redirectFacts(302, 'https://wiki.corp/home', {}), null)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://wiki.corp/home')
  })

  it('본문 없는 status(204·304)에 본문을 싣지 않는다', () => {
    // Response 생성자가 던지는 조합이라 접어야 한다.
    expect(toResponse({ status: 204, headers: {} }, new Uint8Array([1, 2])).status).toBe(204)
    expect(toResponse({ status: 304, headers: {} }, new Uint8Array([1])).status).toBe(304)
  })

  it('범위를 벗어난 status 는 500 으로 접는다', () => {
    // Chromium 이 0 을 주는 경우가 있고, Response 는 200~599 밖이면 던진다.
    expect(toResponse({ status: 0, headers: {} }, null).status).toBe(500)
  })

  it('2xx 본문은 그대로 실린다', async () => {
    const res = toResponse({ status: 200, headers: {} }, new TextEncoder().encode('본문'))
    expect(res.status).toBe(200)
    await expect(res.text()).resolves.toBe('본문')
  })

  it('배열 헤더를 그대로 넘겨도 Response 가 만들어진다', () => {
    // Electron 응답 헤더는 배열이다 — 평탄화 없이 넣으면 Response 가 던진다.
    const res = toResponse({ status: 200, headers: { 'X-Multi': ['a', 'b'] } }, null)
    expect(res.headers.get('x-multi')).toBe('a, b')
  })
})

describe('locationOf', () => {
  it('상대 Location 을 현재 URL 기준으로 절대화한다', () => {
    const facts = { status: 302, headers: { location: '/adfs/ls' } }
    expect(locationOf(facts, 'https://wiki.corp/me')).toBe('https://wiki.corp/adfs/ls')
  })

  it('절대 Location 은 그대로 쓴다', () => {
    const facts = { status: 302, headers: { location: 'https://adfs.corp/ls' } }
    expect(locationOf(facts, 'https://wiki.corp/me')).toBe('https://adfs.corp/ls')
  })

  it('3xx 가 아니면 다음 홉이 없다', () => {
    expect(locationOf({ status: 200, headers: { location: '/x' } }, 'https://wiki.corp')).toBeNull()
    // 304 는 재요청 대상이 아니다.
    expect(locationOf({ status: 304, headers: { location: '/x' } }, 'https://wiki.corp')).toBeNull()
  })

  it('Location 이 없거나 해석 불가면 null 이다', () => {
    expect(locationOf({ status: 302, headers: {} }, 'https://wiki.corp')).toBeNull()
    expect(locationOf({ status: 302, headers: { location: '::' } }, 'not-a-url')).toBeNull()
  })
})
