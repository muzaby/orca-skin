// SSO 로그인 로직의 단일 진입점. 현재는 **항상 실패** 스텁이다 — 실제 SSO 백엔드가
// 준비되면 이 함수 본문만 교체하면 게이트/뷰(store.attemptSso)가 그대로 동작한다.

const SSO_LATENCY_MS = 800

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// SSO 인증 결과 — 성공 시 사용자 이메일을 넘긴다(사이드바 사용자 버튼 표기용).
export interface SsoResult {
  email: string
}

// 항상 실패. inflight 애니메이션이 보이도록 실제 네트워크 왕복을 흉내낸 지연 후 throw.
export async function runSso(): Promise<SsoResult> {
  await delay(SSO_LATENCY_MS)
  // TODO(sso): 실제 SSO 인증 로직으로 교체. 성공 시 { email } resolve, 실패 시 throw.
  throw new Error('SSO not implemented')
}

// 디버그 패널 "SSO 개발 버튼" — 사용자의 로직 실험용. 콘솔 출력만 한다.
export function ssoDevProbe(): void {
  console.log('[sso-dev] SSO 개발 버튼 클릭 — 여기에 실험 로직을 배선하세요.')
}
