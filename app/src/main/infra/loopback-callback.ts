// 1회성 루프백 콜백 리스너 (0181) — RFC 8252 §7.3 의 "native app 은 127.0.0.1 리다이렉트를 쓴다".
//
// 사용자의 **기본 브라우저**가 인가 흐름을 처리하고(앱 내부 창보다 안전하다 — 사용자가 주소창과
// 인증서를 직접 본다), 완료 시 `http://127.0.0.1:<port>/<path>` 로 되돌아온다. 이 서버는 그 한
// 번의 요청만 받고 즉시 닫힌다.
//
// ── 규칙 ─────────────────────────────────────────────────────────────────────
//   - **`127.0.0.1` 에만 바인딩한다.** `localhost` 는 IPv6/IPv4 해석이 환경마다 갈리고,
//     `0.0.0.0` 은 같은 네트워크의 다른 기기에 인가 코드를 노출한다.
//   - 경로가 다른 요청은 404 로 흘려보내고 계속 기다린다 — 브라우저의 `favicon.ico` 선요청
//     하나에 로그인이 실패하면 안 된다.
//   - 타임아웃·abort 는 서버를 반드시 닫는다(포트가 물린 채 남으면 다음 시도가 EADDRINUSE).
//
// node `http` 만 쓴다 — electron 비의존이라 실제 포트 바인딩으로 단위 테스트할 수 있다.

import { createServer } from 'node:http'

export const DEFAULT_CALLBACK_PATH = '/callback'
// 사용자가 브라우저에서 로그인하는 데 걸리는 현실적인 상한. 인가 pending TTL 과 같은 급.
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000

export interface LoopbackOptions {
  port: number
  path?: string
  timeoutMs?: number
  signal?: AbortSignal
  // 브라우저 탭에 보일 완료 문구. 앱으로 돌아오라는 안내 한 줄이면 충분하다.
  doneMessage?: string
}

export class LoopbackCancelledError extends Error {
  constructor(reason: 'timeout' | 'aborted') {
    super(`loopback callback ${reason}`)
    this.name = 'LoopbackCancelledError'
  }
}

// 콜백 요청의 **전체 URL** 을 돌려준다. code·state 추출은 호출부(oauth 순수부)가 한다 —
// 이 모듈은 파싱 규칙을 몰라야 재사용된다.
export function awaitLoopbackCallback(opts: LoopbackOptions): Promise<string> {
  const path = opts.path ?? DEFAULT_CALLBACK_PATH
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const doneMessage = opts.doneMessage ?? '인증이 완료되었습니다. 앱으로 돌아가세요.'

  return new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const rawUrl = req.url ?? '/'
      const url = new URL(rawUrl, `http://127.0.0.1:${opts.port}`)
      if (url.pathname !== path) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      // 정적 문자열만 — 쿼리 값을 응답에 반영하지 않는다(반사형 XSS 표면 제거).
      res.end(`<!doctype html><meta charset="utf-8"><p>${doneMessage}</p>`)
      settle(() => resolve(url.toString()))
    })

    let settled = false
    const settle = (finish: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
      server.close(() => finish())
      // keep-alive 소켓이 남아 close 콜백을 늦추지 않게 한다.
      server.closeAllConnections?.()
    }

    const timer = setTimeout(
      () => settle(() => reject(new LoopbackCancelledError('timeout'))),
      timeoutMs
    )
    const onAbort = (): void => settle(() => reject(new LoopbackCancelledError('aborted')))
    opts.signal?.addEventListener('abort', onAbort, { once: true })

    server.on('error', (error) => settle(() => reject(error)))
    server.listen(opts.port, '127.0.0.1')
  })
}

// authorize 요청에 실을 redirect_uri. 인가 서버 등록값과 **글자까지 같아야** 하므로 조립을
// 한 곳에 모은다.
export function loopbackRedirectUri(port: number, path: string = DEFAULT_CALLBACK_PATH): string {
  return `http://127.0.0.1:${port}${path}`
}
