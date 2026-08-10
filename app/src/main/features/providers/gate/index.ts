// 로그인 게이트 판정 (0181) — **순수 함수**. electron·fs·network 의존 0 이라 vitest 대상.
//
// ── 진리표 ───────────────────────────────────────────────────────────────────
// | kind:'gate' 선언 | grant 상태            | 판정 |
// |---|---|---|
// | 0개              | —                     | **통과** ← dev/OSS 빌드가 잠기지 않게 하는 안전장치 |
// | N개              | 하나도 인증 안 됨      | 차단 |
// | N개              | 일부만 valid          | 차단 ← 로그인이 체인이라 멤버 하나만 풀려도 인증이 아니다 |
// | N개              | 전부 valid            | 통과 |
// | N개              | (무관) dev bypass ON  | 통과 |
//
// **"선언 0 → 통과" 를 회귀로 고정하는 것이 이 모듈의 존재 이유의 절반이다.** 게이트가 강제로
// 바뀌면서 기본 빌드가 로그인 화면에 갇히는 사고를 0180 이 지적했고, AC14 가 그것을 막는다.
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
}

export function evaluateGate(input: GateInput): ProviderGateState {
  const required = input.members.length > 0
  if (!required) return { required: false, passed: true, bypassed: false }
  if (input.bypass) return { required: true, passed: true, bypassed: true }
  const passed = input.members.every((member) => member.status === 'valid')
  return { required: true, passed, bypassed: false }
}
