// 인증된 요청의 전송부 (0181 — 0180 이 지운 `infra/auth/authenticated-fetch.ts` 의 전송 절반).
//
// **왜 infra 인가**: `browser-session.ts`(infra) 와 `features/providers/auth`(feature) 가 같은
// 요청 형상·상한 규칙을 쓴다. feature 에 두면 infra → feature 라는 DAG 역방향이 생기므로,
// 도메인 타입을 모르는 전송 조각만 여기로 내렸다. 자격증명을 **넣는** 쪽(`Presentation` 적용)은
// contracts 를 알아야 하므로 feature 에 남는다(`features/providers/auth/present.ts`).

export interface PreparedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
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
