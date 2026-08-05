// Authenticated fetch 실행부 (0157) — credential 을 요청에 **주입하는 유일한 지점**.
//
// 정책 판정(binding·connector·origin·header spoofing)은 `features/auth-platform/policy.ts` 가
// 순수 함수로 하고, 여기서는 판정을 통과한 요청에 presentation 을 적용해 실제로 보낸다.
// 레이어 DAG 상 infra 는 feature 를 import 할 수 없으므로 credential 조회는 **주입받는다**.
//
// 여기서 만들어진 Request 는 raw secret 을 담지만, 그 값이 호출자에게 되돌아가지 않는다 —
// 반환 타입에 요청 헤더가 없다.

import type { CredentialPresentation } from '../../../shared/ipc'

export interface PreparedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

// presentation 대로 secret 을 심는다. **kind 에서 추론하지 않는다** — 같은 PAT 를 서비스별로
// Bearer / Basic password / PRIVATE-TOKEN 으로 다르게 붙이는 것이 이 함수의 존재 이유다.
//
// 순수 함수 — vitest 대상.
export function applyPresentation(
  req: PreparedRequest,
  presentation: CredentialPresentation,
  secret: string
): PreparedRequest {
  switch (presentation.location) {
    case 'header': {
      return {
        ...req,
        headers: { ...req.headers, [presentation.name]: formatScheme(presentation.scheme, secret) }
      }
    }
    case 'cookie': {
      // 기존 Cookie 헤더를 덮어쓰지 않고 덧붙인다(세션 쿠키와 공존).
      const existing = req.headers['Cookie']
      const pair = `${presentation.name}=${secret}`
      return {
        ...req,
        headers: { ...req.headers, Cookie: existing ? `${existing}; ${pair}` : pair }
      }
    }
    case 'query': {
      const url = new URL(req.url)
      url.searchParams.set(presentation.name, secret)
      return { ...req, url: url.toString() }
    }
  }
}

type HeaderScheme = 'Bearer' | 'Basic' | 'BasicPair' | 'Token' | 'Raw'

function formatScheme(scheme: HeaderScheme | undefined, secret: string): string {
  switch (scheme) {
    case 'Bearer':
      return `Bearer ${secret}`
    case 'Basic':
      // PAT 를 Basic 의 password 로 쓰는 서비스(예: 일부 Atlassian 배포) — 사용자명은 빈 값.
      return `Basic ${Buffer.from(`:${secret}`).toString('base64')}`
    case 'BasicPair':
      // secret 자체가 `user:pass` 인 경우(ID/비밀번호 로그인, 0160). `Basic` 과 분리한 이유는
      // 그쪽이 `:` 를 앞에 붙여 사용자명을 빈 값으로 만들기 때문이다 — 같은 이름으로 두 의미를
      // 겸하면 어느 배포가 어느 형식인지 선언에서 읽을 수 없다.
      return `Basic ${Buffer.from(secret).toString('base64')}`
    case 'Token':
      return `Token ${secret}`
    case 'Raw':
    case undefined:
      return secret
  }
}

export interface SendOptions {
  // 미지정 = 'text' (기존 동작).
  responseType?: 'text' | 'binary'
  // 미지정 = 상한 없음 (기존 동작).
  maxBytes?: number
}

export interface SendResult {
  status: number
  headers: Record<string, string>
  body: string
  bodyBytes?: Uint8Array
}

export interface AuthenticatedFetchDeps {
  // 실제 전송자. browser session binding 이면 Orca 소유 Session 의 fetch, static credential 이면
  // 전역 fetch 가 주입된다.
  send(req: PreparedRequest, signal?: AbortSignal, options?: SendOptions): Promise<SendResult>
}

export class ResponseTooLargeError extends Error {
  constructor(actual: number, limit: number) {
    // 값·URL 을 싣지 않는다 — 크기 두 개만으로 진단이 된다.
    super(`응답이 상한을 초과했습니다 (${actual} > ${limit} bytes)`)
    this.name = 'ResponseTooLargeError'
  }
}

// `fetchImpl` 은 **필수**다 (0173). 기본값을 두면 주입을 빠뜨린 경로가 조용히 Node 스택으로
// 되돌아가는데, 그것이 정확히 이 변경이 고치려는 버그다(사내 프록시·사설 CA 미적용).
// 프로덕션은 컴포지션 루트가 `netFetch`(Chromium 스택)를 준다.
export function createSender(fetchImpl: typeof fetch): AuthenticatedFetchDeps {
  return {
    async send(req, signal, options) {
      const res = await fetchImpl(req.url, {
        method: req.method,
        headers: req.headers,
        ...(req.body !== undefined ? { body: req.body } : {}),
        // 인증은 명시 주입으로만 한다 — 암묵적 쿠키 전송을 켜지 않는다.
        credentials: 'omit',
        // redirect 를 fetch 가 자동으로 따라가면 allowlist 밖 origin 으로 credential 이 실린
        // 요청이 나간다. 여기서 멈추고 **호출부(broker)가 policy 로 재검사한 뒤** 다음 홉을
        // 보낸다 (0160 이전에는 재검사 호출자가 없어 302 가 빈 본문으로 반환됐다).
        redirect: 'manual',
        ...(signal ? { signal } : {})
      })
      const headers = Object.fromEntries(res.headers.entries())
      const limit = options?.maxBytes
      assertDeclaredLength(headers['content-length'], limit)

      if (options?.responseType !== 'binary') {
        const body = await res.text()
        // 텍스트도 상한을 넘으면 실패다. byteLength 로 재는 이유는 상한이 바이트 단위라
        // 멀티바이트 문자에서 `length` 와 어긋나기 때문이다.
        assertWithinLimit(Buffer.byteLength(body), limit)
        return { status: res.status, headers, body }
      }

      return {
        status: res.status,
        headers,
        body: '',
        bodyBytes: await readBytesWithCap(res, limit)
      }
    }
  }
}

function assertDeclaredLength(declared: string | undefined, limit: number | undefined): void {
  if (limit === undefined || declared === undefined) return
  const length = Number(declared)
  // 서버가 길이를 안 주거나 거짓말할 수 있으므로 이 검사만으로 끝내지 않는다 —
  // 실제 누적 바이트도 아래에서 검사한다.
  if (Number.isFinite(length)) assertWithinLimit(length, limit)
}

function assertWithinLimit(actual: number, limit: number | undefined): void {
  if (limit !== undefined && actual > limit) throw new ResponseTooLargeError(actual, limit)
}

// 스트림을 읽으며 상한을 넘는 순간 중단한다 — 전부 받아놓고 재면 상한의 의미가 없다.
async function readBytesWithCap(res: Response, limit: number | undefined): Promise<Uint8Array> {
  const stream = res.body
  if (!stream) {
    const buffer = new Uint8Array(await res.arrayBuffer())
    assertWithinLimit(buffer.byteLength, limit)
    return buffer
  }

  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (limit !== undefined && total > limit) throw new ResponseTooLargeError(total, limit)
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
    // 상한 초과로 빠져나온 경우 남은 본문을 계속 받지 않는다.
    if (!stream.locked) await stream.cancel().catch(() => undefined)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}
