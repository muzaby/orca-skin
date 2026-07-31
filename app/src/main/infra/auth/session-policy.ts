// Browser session 판정의 **순수 부분** (0157 verify r1 / D1·D7).
//
// `browser-session-store.ts` 는 최상단에서 `electron` 을 import 하므로 그 파일에 순수 함수를 두면
// 테스트가 electron 바이너리를 요구한다(egress 차단 환경에서 실행 불가). 판정 로직만 여기로
// 분리해 electron 비의존으로 만든다 — vitest 대상.

export interface BrowserProbeResult {
  ok: boolean
  status: number
  finalUrl: string
}

export function partitionFor(sessionGroup: string): string {
  return `persist:auth.${sessionGroup}`
}

// origin 단위 비교. 서브도메인 자동 허용 없음.
export function isAllowedOrigin(rawUrl: string, allowed: readonly string[]): boolean {
  try {
    return allowed.includes(new URL(rawUrl).origin)
  } catch {
    return false
  }
}

export interface ProbeResponseFacts {
  status: number
  ok: boolean
  location: string | null
  requestUrl: string
  finalUrl?: string
  allowedOrigins: readonly string[]
}

export interface ProbeVerdict {
  result: BrowserProbeResult
  redirectOutsideAllowlist: boolean
}

// probe 응답 판정.
//
// 핵심 규칙: **3xx = 미인증.** ADFS 는 미인증 요청을 로그인 페이지로 302 하고 그 페이지는 200 을
// 준다. redirect 를 따라가면 그 200 을 "인증됨" 으로 오독해, 인증되지 않았는데 valid binding 을
// 만든다(0157 verify r1 / D1 — 구 구현의 실제 결함).
export function classifyProbeResponse(facts: ProbeResponseFacts): ProbeVerdict {
  const isRedirect = facts.status >= 300 && facts.status < 400
  if (!isRedirect) {
    return {
      result: {
        ok: facts.ok,
        status: facts.status,
        finalUrl: facts.finalUrl || facts.requestUrl
      },
      redirectOutsideAllowlist: false
    }
  }
  let outside = false
  if (facts.location) {
    try {
      // 상대 Location 도 허용되므로 요청 URL 기준으로 절대화한 뒤 판정한다.
      outside = !isAllowedOrigin(
        new URL(facts.location, facts.requestUrl).toString(),
        facts.allowedOrigins
      )
    } catch {
      outside = true
    }
  }
  return {
    result: { ok: false, status: facts.status, finalUrl: facts.requestUrl },
    redirectOutsideAllowlist: outside
  }
}
