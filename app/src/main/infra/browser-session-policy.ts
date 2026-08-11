// Browser session 판정의 **순수 부분** (0157 verify r1 / D1·D7 → 0181 복원).
//
// `browser-session.ts` 는 최상단에서 `electron` 을 import 하므로 그 파일에 순수 함수를 두면
// 테스트가 electron 바이너리를 요구한다(egress 차단 환경에서 실행 불가). 판정 로직만 여기로
// 분리해 electron 비의존으로 만든다 — vitest 대상.
//
// **인증 판정(probe)은 여기 없다.** 방식마다 다르던 판정을 `Provider.probe` 하나로 통일하면서
// `classifyProbeChain`·`classifyProbeResponse` 는 소비자가 사라져 제거했다. 0174 가 실기로
// 교정한 규칙(**2xx + 체인이 provider origin 으로 복귀**)은 그대로 살아 있다 —
// `features/providers/auth/login.ts` 의 `probeOk` 와 `contracts/provider.ts` 의
// `ProviderResponse.finalUrl` 주석이 그 자리다. 홉별 allowlist 검사는 `send()` 의
// `isAllowedOrigin` + `auth/policy.ts` 의 `checkRedirect` 가 두 겹으로 맡는다.

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
