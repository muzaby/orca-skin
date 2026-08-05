// Chromium 전송 결과의 **순수 변환부** (0174) — electron 비의존이라 단위 테스트가 된다.
//
// `net.request` 의 `'redirect'` 이벤트는 `(statusCode, method, redirectUrl, responseHeaders)` 를
// 주고, 그 자리에서 `followRedirect()` 를 부르지 않으면 요청이 취소된다. 우리는 **따라가지 않고
// 그 인자만으로 3xx 응답을 재구성**한다 — `net.fetch` 로는 불가능한 부분이 정확히 이것이다.

export interface NetResponseFacts {
  status: number
  // Electron 은 헤더 값을 배열로 준다.
  headers: Record<string, string[] | string>
}

// 헤더를 소문자 단일 값으로 평탄화한다. 다중 값은 콤마로 잇는다(HTTP 규약).
// `set-cookie` 만 예외로 첫 값을 쓴다 — 콤마로 이으면 파싱 불가능한 문자열이 되기 때문이다.
// (우리는 쿠키를 읽지 않는다. cookie jar 는 Electron 세션이 소유한다.)
export function flattenHeaders(raw: Record<string, string[] | string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(raw)) {
    const key = name.toLowerCase()
    if (typeof value === 'string') {
      out[key] = value
      continue
    }
    if (value.length === 0) continue
    out[key] = key === 'set-cookie' ? value[0] : value.join(', ')
  }
  return out
}

// 리다이렉트 이벤트 → 3xx 응답 사실. `location` 은 이벤트가 준 **절대 URL** 로 덮어쓴다 —
// 원본 헤더의 상대 경로보다 Chromium 이 해석한 절대 URL 이 정확하고 호출자가 바로 쓸 수 있다.
export function redirectFacts(
  statusCode: number,
  redirectUrl: string,
  responseHeaders: Record<string, string[] | string>
): NetResponseFacts {
  return {
    status: statusCode,
    headers: { ...flattenHeaders(responseHeaders), location: redirectUrl }
  }
}

// `Response` 합성.
//
// **주의**: `Response` 생성자는 204·205·304 에 본문을 허용하지 않고, status 가 200~599 밖이면
// 던진다. Chromium 이 주는 값을 그대로 넣기 전에 접어 준다.
export function toResponse(facts: NetResponseFacts, body: Uint8Array | null): Response {
  const status = facts.status >= 200 && facts.status <= 599 ? facts.status : 500
  const nullBody = status === 204 || status === 205 || status === 304 || body === null
  return new Response(nullBody ? null : (body as unknown as BodyInit), {
    status,
    // Electron 은 배열 헤더를 주므로 Response 에 넣기 전에 평탄화한다.
    headers: flattenHeaders(facts.headers)
  })
}

// 다음 홉 URL. 상대 `Location` 도 현재 URL 기준으로 절대화한다. 304 는 재요청 대상이 아니다.
export function locationOf(facts: NetResponseFacts, currentUrl: string): string | null {
  if (facts.status < 300 || facts.status >= 400 || facts.status === 304) return null
  const raw = facts.headers['location']
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    return new URL(raw, currentUrl).toString()
  } catch {
    return null
  }
}
