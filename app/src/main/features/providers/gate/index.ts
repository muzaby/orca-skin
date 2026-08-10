// 로그인 게이트 판정 (0181) — **순수 함수**. electron·fs·network 의존 0 이라 vitest 대상.
//
// ── 진리표 ───────────────────────────────────────────────────────────────────
// | 빌드 | kind:'gate' 선언 | grant 상태           | 판정 |
// |---|---|---|---|
// | prod | 0개              | —                    | **통과** ← OSS/기본 배포가 잠기지 않게 하는 안전장치 |
// | prod | N개              | 하나도 인증 안 됨     | 차단 |
// | prod | N개              | 일부만 valid         | 차단 ← 로그인이 체인이라 멤버 하나만 풀려도 인증이 아니다 |
// | prod | N개              | 전부 valid           | 통과 |
// | **DEV** | **0개**       | —                    | **차단** ← 로그인 화면을 항상 볼 수 있어야 한다 |
// | 둘 다 | N개(또는 DEV)    | (무관) bypass ON     | 통과 |
//
// ── DEV 는 왜 항상 게이트인가 (0089 → 0130 → 0181 복원) ────────────────────
// 게이트 화면은 **개발 중에 계속 보고 고쳐야 하는 화면**이다. "선언 0 → 통과" 를 DEV 에도
//적용하면 폐쇄망 실값이 없는 개발 환경에서 그 화면에 **도달할 방법이 사라진다** — 0181 이 처음
// 그렇게 만들었고, 우회 토글을 켜도 우회할 게이트가 없어 아무 일도 일어나지 않았다.
//
// 그래서 DEV 는 게이트를 항상 세우고 **`authBypass` 토글이 유일한 탈출구**다(디버그 패널이
// 로그인 화면에도 마운트되는 이유 — 우회 스위치가 게이트 뒤에 있으면 손이 닿지 않는다).
// prod 는 그대로다: 선언이 0개면 통과, 그래야 OSS 빌드가 잠기지 않는다(AC14 의 대상).
//
// 게이트는 **UX 게이트이지 보안 경계가 아니다** — 인증 전에도 main IPC 는 열려 있다.

import type { ProviderGateState, ProviderGrantStatus } from '../../../../shared/ipc'

export interface GateMember {
  providerId: string
  status: ProviderGrantStatus
}

export interface GateInput {
  // kind:'gate' 로 선언된 provider 들의 현재 상태. 선언 0 이면 빈 배열.
  members: readonly GateMember[]
  // `Settings.authBypass` — DEV 전용 우회. prod 빌드에서 켜져도 게이트만 지나갈 뿐
  // 자격증명이 생기지는 않는다(요청은 여전히 미인증으로 실패한다).
  bypass: boolean
  // 선언이 0개여도 게이트를 세운다(DEV). **호출부가 `import.meta.env.DEV` 를 넣는다** —
  // 이 모듈이 직접 읽으면 순수성이 깨지고 테스트가 빌드 모드에 묶인다.
  alwaysRequired?: boolean
}

export function evaluateGate(input: GateInput): ProviderGateState {
  const required = input.alwaysRequired === true || input.members.length > 0
  if (!required) return { required: false, passed: true, bypassed: false }
  if (input.bypass) return { required: true, passed: true, bypassed: true }
  // 선언이 0개인 DEV 에서는 통과할 방법이 bypass 뿐이다 — `every` 는 빈 배열에 true 를 주므로
  // 멤버 수를 함께 본다(안 그러면 DEV 게이트가 즉시 열려 원래 문제로 되돌아간다).
  const passed =
    input.members.length > 0 && input.members.every((member) => member.status === 'valid')
  return { required: true, passed, bypassed: false }
}
