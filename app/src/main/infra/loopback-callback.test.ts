// 루프백 리스너는 node `http` 만 쓰므로 **실제 포트에 바인딩해** 검증한다 — 리스너를 흉내내면
// 정작 확인해야 할 것(주소 바인딩·1회성·정리)이 검증되지 않는다.

import { describe, expect, it } from 'vitest'
import {
  awaitLoopbackCallback,
  loopbackRedirectUri,
  LoopbackCancelledError,
  DEFAULT_CALLBACK_PATH
} from './loopback-callback'

// 포트 충돌을 피하기 위해 매번 다른 고정 포트를 쓴다(0 은 못 쓴다 — 인가 서버에 등록된
// redirect_uri 가 고정 포트를 담는 것이 실제 계약이라, 그 경로를 그대로 시험한다).
let nextPort = 45211
const port = (): number => nextPort++

describe('awaitLoopbackCallback', () => {
  it('콜백 요청의 전체 URL 을 돌려주고 서버를 닫는다', async () => {
    const p = port()
    const pending = awaitLoopbackCallback({ port: p })
    const response = await fetch(`http://127.0.0.1:${p}${DEFAULT_CALLBACK_PATH}?code=abc&state=xy`)
    expect(response.status).toBe(200)

    const url = await pending
    expect(new URL(url).searchParams.get('code')).toBe('abc')
    expect(new URL(url).searchParams.get('state')).toBe('xy')

    // 서버가 닫혔으므로 같은 포트에 다시 바인딩할 수 있다(포트를 물고 있지 않다).
    const second = awaitLoopbackCallback({ port: p, timeoutMs: 50 })
    await expect(second).rejects.toBeInstanceOf(LoopbackCancelledError)
  })

  it('경로가 다른 요청(favicon 등)은 흘려보내고 계속 기다린다', async () => {
    const p = port()
    const pending = awaitLoopbackCallback({ port: p })
    const ignored = await fetch(`http://127.0.0.1:${p}/favicon.ico`)
    expect(ignored.status).toBe(404)

    await fetch(`http://127.0.0.1:${p}${DEFAULT_CALLBACK_PATH}?code=late`)
    expect(new URL(await pending).searchParams.get('code')).toBe('late')
  })

  it('응답 본문에 쿼리 값을 반영하지 않는다 (반사형 XSS 표면 제거)', async () => {
    const p = port()
    const pending = awaitLoopbackCallback({ port: p })
    const response = await fetch(
      `http://127.0.0.1:${p}${DEFAULT_CALLBACK_PATH}?code=%3Cscript%3Ealert(1)%3C/script%3E`
    )
    const body = await response.text()
    expect(body).not.toContain('<script>')
    await pending
  })

  it('타임아웃은 LoopbackCancelledError 로 끝난다', async () => {
    await expect(awaitLoopbackCallback({ port: port(), timeoutMs: 30 })).rejects.toMatchObject({
      name: 'LoopbackCancelledError'
    })
  })

  it('abort 는 즉시 정리한다', async () => {
    const controller = new AbortController()
    const p = port()
    const pending = awaitLoopbackCallback({ port: p, signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toBeInstanceOf(LoopbackCancelledError)
    // 정리가 끝났으므로 같은 포트를 다시 잡을 수 있다.
    const again = awaitLoopbackCallback({ port: p, timeoutMs: 30 })
    await expect(again).rejects.toBeInstanceOf(LoopbackCancelledError)
  })
})

describe('loopbackRedirectUri', () => {
  it('인가 서버 등록값과 글자까지 같은 형식을 만든다', () => {
    // `localhost` 가 아니라 **127.0.0.1** — IPv6/IPv4 해석이 환경마다 갈리지 않게.
    expect(loopbackRedirectUri(9321)).toBe('http://127.0.0.1:9321/callback')
    expect(loopbackRedirectUri(9321, '/oauth/done')).toBe('http://127.0.0.1:9321/oauth/done')
  })
})
