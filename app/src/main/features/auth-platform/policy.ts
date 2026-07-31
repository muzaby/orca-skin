// 인증 정책 판정 (0157) — **순수 함수만**. electron·fs·network 의존 0 이라 vitest 대상.
//
// broker 는 credential 을 주입하기 전에 여기 전부를 통과시킨다. 판정 지점을 한 곳에 모으는 이유는
// "provider 를 늘려도 검사 지점이 늘지 않게" 하기 위함이다 (AUTH-PLAT-001·013).

import type { AuthTarget } from '../../../shared/ipc'
// origin 판정은 browser session 경로와 **같은 구현**을 쓴다 — 두 벌이면 규칙이 갈린다
// (0157 verify r1). features → infra 는 허용 방향.
import { isAllowedOrigin } from '../../infra/auth/session-policy'

export { isAllowedOrigin }

// connector 가 직접 덮어쓰면 안 되는 헤더. 인증 헤더를 스스로 세팅해 broker 의 주입을
// 무력화하거나 다른 binding 의 credential 을 흉내내는 경로를 막는다.
const RESERVED_HEADERS = ['authorization', 'cookie', 'proxy-authorization'] as const

export type PolicyDenial =
  | { reason: 'origin_not_allowed'; detail: string }
  | { reason: 'absolute_path'; detail: string }
  | { reason: 'reserved_header'; detail: string }
  | { reason: 'binding_mismatch'; detail: string }
  | { reason: 'binding_not_valid'; detail: string }

export type PolicyResult = { ok: true } | ({ ok: false } & PolicyDenial)

const allow: PolicyResult = { ok: true }
const deny = (d: PolicyDenial): PolicyResult => ({ ok: false, ...d })

// origin 단위 비교. 서브도메인 자동 허용 없음 — allowlist 에 없는 host 는 거부한다.
export function isOriginAllowed(rawUrl: string, allowedOrigins: readonly string[]): boolean {
  try {
    return allowedOrigins.includes(new URL(rawUrl).origin)
  } catch {
    return false
  }
}

// connector 요청 경로 검사. 절대 URL 을 주면 manifest 의 baseUrl 을 우회할 수 있으므로 거부한다.
export function checkRequestPath(path: string): PolicyResult {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith('//')) {
    return deny({ reason: 'absolute_path', detail: 'path 는 baseUrl 기준 상대 경로여야 합니다' })
  }
  return allow
}

// connector 가 실은 헤더 중 예약 헤더가 있는지. 대소문자 무시.
export function checkHeaders(headers: Record<string, string> | undefined): PolicyResult {
  if (!headers) return allow
  for (const name of Object.keys(headers)) {
    if ((RESERVED_HEADERS as readonly string[]).includes(name.toLowerCase())) {
      return deny({ reason: 'reserved_header', detail: name })
    }
  }
  return allow
}

export interface BindingFacts {
  id: string
  target: AuthTarget
  status: 'valid' | 'expired' | 'revoked' | 'unknown'
}

// binding 이 이 connector 의 것인지 + 지금 쓸 수 있는 상태인지.
export function checkBindingUsable(binding: BindingFacts, connectorId: string): PolicyResult {
  if (binding.target.kind !== 'connector') {
    return deny({ reason: 'binding_mismatch', detail: 'connector binding 이 아닙니다' })
  }
  if (binding.target.connectorId !== connectorId) {
    return deny({ reason: 'binding_mismatch', detail: binding.target.connectorId })
  }
  if (binding.status !== 'valid') {
    return deny({ reason: 'binding_not_valid', detail: binding.status })
  }
  return allow
}

export interface OutboundRequestFacts {
  url: string
  path: string
  headers?: Record<string, string>
  connectorId: string
  binding: BindingFacts
  allowedOrigins: readonly string[]
}

// broker 가 부르는 단일 진입점. 하나라도 걸리면 첫 거부 사유를 돌려준다.
export function checkOutboundRequest(facts: OutboundRequestFacts): PolicyResult {
  const pathCheck = checkRequestPath(facts.path)
  if (!pathCheck.ok) return pathCheck
  const headerCheck = checkHeaders(facts.headers)
  if (!headerCheck.ok) return headerCheck
  const bindingCheck = checkBindingUsable(facts.binding, facts.connectorId)
  if (!bindingCheck.ok) return bindingCheck
  if (!isOriginAllowed(facts.url, facts.allowedOrigins)) {
    return deny({ reason: 'origin_not_allowed', detail: safeOrigin(facts.url) })
  }
  return allow
}

// redirect 추적 시 재검사용 — manual redirect 의 Location 이 allowlist 안인지.
export function checkRedirect(location: string, allowedOrigins: readonly string[]): PolicyResult {
  return isOriginAllowed(location, allowedOrigins)
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
