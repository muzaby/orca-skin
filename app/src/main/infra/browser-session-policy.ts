// Browser session 판정의 **순수 부분** (0157 verify r1 / D1·D7 → 0181 복원).
//
// `browser-session.ts` 는 최상단에서 `electron` 을 import 하므로 그 파일에 순수 함수를 두면
// 테스트가 electron 바이너리를 요구한다(egress 차단 환경에서 실행 불가). 판정 로직만 여기로
// 분리해 electron 비의존으로 만든다 — vitest 대상.
//
// 0181 은 이 파일을 **글자 그대로 복원**한다. 0174 가 실기로 교정한 판정(체인 최종 origin)이라
// 다시 유도하면 같은 실패를 반복한다.

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

// probe 홉 상한. ADFS 왕복은 보통 2~4홉이고 그보다 길면 로그인 루프다.
export const MAX_PROBE_HOPS = 5

export interface ProbeChainFacts {
  // 최초 요청 URL — 보호 리소스의 origin 이 여기서 나온다.
  probeUrl: string
  // 리다이렉트를 따라간 끝에 도달한 URL.
  finalUrl: string
  // 마지막 응답 status.
  status: number
  hops: number
  // 추종을 중단한 이유(있으면 완주하지 못한 것이다).
  stopped?: 'outside_allowlist' | 'too_many_hops'
}

// **체인 판정 (0174)** — 0157 D1 의 "3xx = 미인증" 을 대체한다.
//
// D1 이 막으려던 것은 *리다이렉트 자체* 가 아니라 **"ADFS 로그인 폼의 200 을 인증됨으로 오독"**
// 이었다. 그런데 실기 결과 이 배포는 **인증에 성공해도 probe 가 302 로 로그인 URL 을 가리킨다** —
// WS-Fed/SAML 왕복을 다시 태우고 그 체인이 자동 완주해야 보호 리소스에 닿는 구조다. 3xx 를 곧
// 미인증으로 접으면 **어떤 경우에도 인증 성공 판정이 나오지 않는다**(실제로 그랬다).
//
// 그래서 판별자를 **최종 origin** 으로 바꾼다:
//   - 체인이 **probe URL 의 origin 으로 돌아와 2xx** → SP 가 세션을 세웠다 = 인증됨.
//   - 체인이 **IdP·로그인 origin 에 머문 채 끝남** → 로그인 폼 앞이다 = 미인증(D1 이 막던 경우).
// D1 의 *목적* 은 그대로 두고 *수단* 만 바꾼 것이다.
export function classifyProbeChain(facts: ProbeChainFacts): ProbeVerdict {
  // 중단했으면 그 자체가 미인증이다 — 끝까지 가보지 못했으므로 "됐다" 고 말할 수 없다.
  if (facts.stopped !== undefined) {
    return {
      result: { ok: false, status: facts.status, finalUrl: facts.finalUrl },
      redirectOutsideAllowlist: facts.stopped === 'outside_allowlist'
    }
  }
  const settled = facts.status >= 200 && facts.status < 300
  const returned = sameOrigin(facts.finalUrl, facts.probeUrl)
  return {
    result: { ok: settled && returned, status: facts.status, finalUrl: facts.finalUrl },
    redirectOutsideAllowlist: false
  }
}

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin
  } catch {
    return false
  }
}

// `loadURL` 이 던지는 **ERR_ABORTED(-3)** 는 실패가 아니다 (0174).
//
// "이 내비게이션이 다른 내비게이션으로 대체됐다" 는 뜻이고, 리다이렉트가 잦은 SSO 로그인에서는
// 정상 경로다. 이것을 치명으로 보고 창을 닫았기 때문에 **로그인 창이 아예 뜨지 않았다**.
// 결말은 내비게이션 이벤트·타임아웃·사용자 닫기가 정한다.
export function isAbortedNavigationError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { errno?: unknown; code?: unknown }
  return candidate.errno === -3 || candidate.code === 'ERR_ABORTED'
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
