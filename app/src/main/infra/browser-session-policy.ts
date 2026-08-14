// Browser session 판정의 **순수 부분** (0157 verify r1 / D1·D7 → 0181 복원).
//
// `browser-session.ts` 는 최상단에서 `electron` 을 import 하므로 그 파일에 순수 함수를 두면
// 테스트가 electron 바이너리를 요구한다(egress 차단 환경에서 실행 불가). 판정 로직만 여기로
// 분리해 electron 비의존으로 만든다 — vitest 대상.
//
// **인증 판정(probe)은 여기 없다.** 방식마다 다르던 판정을 `Provider.probe` 하나로 통일하면서
// `classifyProbeChain`·`classifyProbeResponse` 는 소비자가 사라져 제거했다. 0174 가 실기로
// 교정한 규칙(**2xx + 체인이 provider origin 으로 복귀**)은 그대로 살아 있다 —
// `features/auth/login.ts` 의 `probeOk` 와 `contracts/auth.ts` 의
// `ProviderResponse.finalUrl` 주석이 그 자리다. 홉별 allowlist 검사는 `send()` 의
// `isAllowedOrigin` + `auth/policy.ts` 의 `checkRedirect` 가 두 겹으로 맡는다.

// 한 cookie jar(`sessionGroup`)의 정책. **여기가 유일한 선언**이다 — 0182 까지 `browser-session.ts`
// (infra) · `auth/session-policies.ts`(선언 → 정책) · `auth/specs/browser-session.ts`
// (`BrowserSessionPort`) 세 곳에 같은 모양이 손으로 적혀 있었고, 그중 하나는
// `allowIntegratedAuthDomains` 를 빠뜨려 필드를 늘려도 그 경로만 조용히 빠졌다.
//
// 이 파일이 제자리인 이유는 `isAllowedOrigin` 과 같다: `browser-session.ts` 는 최상단에서
// electron 을 물어 타입만 빌려도 소비자가 electron 을 요구하게 된다(P29). 여기는 순수하다.
export interface SessionGroupPolicy {
  sessionGroup: string
  // 이 창이 navigate 할 수 있는 origin. 밖으로 나가는 redirect 는 차단된다.
  allowedOrigins: readonly string[]
  // WIA(Negotiate/NTLM) 자동 자격증명을 허용할 도메인. ADFS 호스트로 제한하며 wildcard 금지.
  //
  // ⚠️ Electron 에서 통합 인증 허용 도메인은 per-session `allowNTLMCredentialsForDomains()` 와
  // 프로세스 전역 `--auth-server-allowlist` 스위치가 서로 다른 층위로 존재한다. 여기서는
  // per-session API 만 쓴다 — group 별 분리가 실제로 성립하는지는 실기 확인 항목이며,
  // 분리가 불가능하면 이 필드는 전역 합집합 의미로 강등된다(0157 plan §게이트).
  allowIntegratedAuthDomains?: readonly string[]
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
