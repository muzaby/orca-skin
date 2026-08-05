// Chromium 네트워크 스택 전송자 (0174) — `net.request` 기반.
//
// ── 왜 `net.fetch` 로는 안 되는가 ────────────────────────────────────────────
// Electron 의 `redirect:'manual'` 은 **웹 fetch 규약과 의미가 다르다**:
//
//   "When mode is `manual` the redirection **will be cancelled** unless `request.followRedirect`
//    is invoked **synchronously** during the `redirect` event."  — electron.d.ts (ClientRequest)
//
// `net.fetch`/`Session.fetch` 는 그 `redirect` 이벤트를 호출자에게 노출하지 않는다. 그래서
// manual 로 요청하면 3xx 가 오는 순간 **요청이 취소**되고 3xx 응답을 받을 방법이 없다 —
// SSO probe 가 "cancelled" 로 죽던 원인이고, 커넥터의 리다이렉트 추종이 끊기던 원인이다.
//
// `net.request` 는 그 이벤트를 준다. 따라가지 않고 **이벤트 인자로 3xx 를 재구성**해 돌려준다.
//
// ── 이 파일을 테스트가 import 하지 않는다 (P29) ──────────────────────────────
// `vitest.config.ts` 에 electron alias 가 없어 electron 을 무는 모듈은 테스트에서 즉시 죽는다.
// 판정·변환은 전부 `net-response.ts`(순수)에 있고 여기는 이벤트 배선만 한다.
//
// ── 호출 시점 ────────────────────────────────────────────────────────────────
// `net.request` 는 **app ready 이후**에만 동작한다. 여기 export 는 함수이므로 모듈 로드 시점에는
// 아무것도 하지 않는다 — 요청하는 순간에만 `net` 에 닿는다.

import { net, type Session } from 'electron'
import { flattenHeaders, toResponse, type NetResponseFacts } from './net-response'

export interface SendOnceOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  // 이 세션의 cookie jar·자격증명으로 보낸다. 미지정이면 기본 세션.
  session?: Session
  credentials?: 'include' | 'omit' | 'same-origin'
  signal?: AbortSignal
}

export interface SendOnceResult {
  facts: NetResponseFacts
  body: Uint8Array | null
}

// 요청을 **한 번** 보낸다. 리다이렉트는 따라가지 않고 3xx 를 그대로 돌려준다 —
// 홉을 도는 것은 호출자(정책 검사를 아는 쪽)의 몫이다.
export function sendOnce(opts: SendOnceOptions): Promise<SendOnceResult> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      url: opts.url,
      method: opts.method ?? 'GET',
      ...(opts.session !== undefined ? { session: opts.session } : {}),
      ...(opts.credentials !== undefined ? { credentials: opts.credentials } : {}),
      // 우리가 3xx 를 직접 받기 위한 모드. followRedirect 를 부르지 않으므로 취소되지만,
      // 그 전에 'redirect' 이벤트가 status·Location 을 준다.
      redirect: 'manual',
      // 외부 요청이 앱의 `app://` 커스텀 프로토콜 핸들러로 말려들지 않게 한다.
      bypassCustomProtocolHandlers: true
    })

    let settled = false
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      fn()
    }

    for (const [name, value] of Object.entries(opts.headers ?? {})) {
      request.setHeader(name, value)
    }

    const onAbort = (): void => {
      finish(() => {
        request.abort()
        reject(new Error('요청이 취소되었습니다'))
      })
    }
    if (opts.signal) {
      if (opts.signal.aborted) return onAbort()
      opts.signal.addEventListener('abort', onAbort, { once: true })
    }

    // 리다이렉트를 **따라가지 않는다** — 이벤트 인자만으로 3xx 응답을 만든다.
    request.on('redirect', (statusCode, _method, redirectUrl, responseHeaders) => {
      finish(() => {
        request.abort()
        resolve({
          facts: {
            status: statusCode,
            headers: { ...flattenHeaders(responseHeaders), location: redirectUrl }
          },
          body: null
        })
      })
    })

    request.on('response', (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => void chunks.push(chunk))
      response.on('end', () => {
        finish(() =>
          resolve({
            facts: { status: response.statusCode, headers: response.headers },
            body: new Uint8Array(Buffer.concat(chunks))
          })
        )
      })
      response.on('error', (error: Error) => finish(() => reject(error)))
    })

    // abort() 뒤에도 error 가 뒤늦게 올 수 있다 — settled 가드가 그것을 흡수한다.
    request.on('error', (error) => finish(() => reject(error)))

    if (opts.body !== undefined) request.write(opts.body)
    request.end()
  })
}

// `sendOnce` 를 표준 `Response` 로 감싼 어댑터. `redirect:'manual'` 계약을 **실제로** 지킨다.
export async function sendOnceAsResponse(opts: SendOnceOptions): Promise<Response> {
  const { facts, body } = await sendOnce(opts)
  return toResponse(facts, body)
}
