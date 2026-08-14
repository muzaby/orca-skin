// 요청 정책 판정 (0181 — 0180 이 지운 `features/auth-platform/policy.ts` 복원·축소).
//
// **순수 함수만.** electron·fs·network 의존 0 이라 vitest 대상이다. `ProviderApi` 는 자격증명을
// 주입하기 전에 여기 전부를 통과시킨다 — 판정 지점을 한 곳에 모으는 이유는 "provider 를 늘려도
// 검사 지점이 늘지 않게" 하기 위함이다.
//
// 구 버전에서 없어진 것: `checkBindingUsable`(binding↔connector 참조 대조). `authId → Grant`
// 단일 맵이라 **참조가 어긋날 방법 자체가 없다** — 검사가 아니라 구조로 해결됐다.

// origin 판정은 브라우저 세션 경로와 **같은 구현**을 쓴다 — 두 벌이면 규칙이 갈린다
// (0157 verify r1). features → infra 는 허용 방향.
import { isAllowedOrigin } from '../../infra/browser-session-policy'

export { isAllowedOrigin }

// provider 가 직접 덮어쓰면 안 되는 헤더. 인증 헤더를 스스로 세팅해 주입을 무력화하거나 다른
// provider 의 자격증명을 흉내내는 경로를 막는다.
const RESERVED_HEADERS = ['authorization', 'cookie', 'proxy-authorization'] as const

export type PolicyDenial =
  | { reason: 'origin_not_allowed'; detail: string }
  | { reason: 'absolute_path'; detail: string }
  | { reason: 'reserved_header'; detail: string }
  | { reason: 'grant_not_valid'; detail: string }

export type PolicyResult = { ok: true } | ({ ok: false } & PolicyDenial)

const allow: PolicyResult = { ok: true }
const deny = (d: PolicyDenial): PolicyResult => ({ ok: false, ...d })

// 절대 URL 을 주면 선언의 `origin` 을 우회할 수 있으므로 거부한다. 프로토콜 상대 경로(`//host`)
// 도 같은 우회다.
export function checkRequestPath(path: string): PolicyResult {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith('//')) {
    return deny({ reason: 'absolute_path', detail: 'path 는 origin 기준 상대 경로여야 합니다' })
  }
  return allow
}

// 요청이 실은 헤더 중 예약 헤더가 있는지. 대소문자 무시.
export function checkHeaders(headers: Record<string, string> | undefined): PolicyResult {
  if (!headers) return allow
  for (const name of Object.keys(headers)) {
    if ((RESERVED_HEADERS as readonly string[]).includes(name.toLowerCase())) {
      return deny({ reason: 'reserved_header', detail: name })
    }
  }
  return allow
}

export interface OutboundRequestFacts {
  // 최종 조립된 절대 URL.
  url: string
  // 호출자가 넘긴 원본 경로.
  path: string
  headers?: Record<string, string>
  // 이 provider 가 나갈 수 있는 origin 전수(선언의 `origin` 1개 + 필요 시 확장).
  allowedOrigins: readonly string[]
  // grant 상태. 'valid' 가 아니면 요청 자체를 내지 않는다.
  grantStatus: 'none' | 'valid' | 'expired' | 'unknown'
}

// 단일 진입점. 하나라도 걸리면 **첫 거부 사유**를 돌려준다.
export function checkOutboundRequest(facts: OutboundRequestFacts): PolicyResult {
  const pathCheck = checkRequestPath(facts.path)
  if (!pathCheck.ok) return pathCheck
  const headerCheck = checkHeaders(facts.headers)
  if (!headerCheck.ok) return headerCheck
  if (facts.grantStatus !== 'valid') {
    return deny({ reason: 'grant_not_valid', detail: facts.grantStatus })
  }
  if (!isAllowedOrigin(facts.url, facts.allowedOrigins)) {
    return deny({ reason: 'origin_not_allowed', detail: safeOrigin(facts.url) })
  }
  return allow
}

// redirect 추적 시 재검사용 — manual redirect 의 Location 이 allowlist 안인지.
export function checkRedirect(location: string, allowedOrigins: readonly string[]): PolicyResult {
  return isAllowedOrigin(location, allowedOrigins)
    ? allow
    : deny({ reason: 'origin_not_allowed', detail: safeOrigin(location) })
}

// 로그·에러에 전체 URL(쿼리에 토큰이 실릴 수 있다)을 싣지 않기 위한 축약.
function safeOrigin(rawUrl: string): string {
  try {
    return new URL(rawUrl).origin
  } catch {
    return '<invalid-url>'
  }
}
