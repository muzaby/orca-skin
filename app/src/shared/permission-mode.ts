// 권한 모드 정규화 계층 (provider-runtime.md §3 정본).
//
// 순수 타입/함수만 — zod·SDK 를 import 하지 않는다. shared/ 는 preload(sandbox=true) 와
// renderer·main 이 모두 import 하므로 런타임 의존이 없어야 한다.
//
// 세 종류의 모드 어휘가 공존한다:
//   1) NormalizedPermissionMode — provider 중립 정규화(6종, snake_case). 앱 내부 SSOT 어휘.
//   2) ClaudePermissionMode     — Claude Agent SDK 의 PermissionMode 미러(6종, camelCase, sdk.d.ts:1865).
//                                 SDK 를 직접 import 하지 않고 타입만 미러해 sandbox 안전을 지킨다.
//   3) PermissionMode (./ipc) — 이전 UI 저장값을 읽는 호환 어휘(plan/acceptEdits).

import type { PermissionMode } from './ipc'
import { supportsAutoPermission } from './model-identity'
import type { AgentKind } from './agent-kind'

// provider 중립 권한 모드 (정규화 어휘). UI/IPC/controller 가 공유하는 SSOT 표현.
export type NormalizedPermissionMode =
  'default' | 'accept_edits' | 'plan' | 'dont_ask' | 'bypass' | 'auto_classified'

// Claude Agent SDK PermissionMode 미러 (sdk.d.ts:1865). SDK 직접 import 대신 타입 미러.
export type ClaudePermissionMode =
  'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto'

// Coding의 계획 승인 기본 목표. Work 목표는 planApprovedMode에서 결정한다.
export const PLAN_APPROVED_MODE: NormalizedPermissionMode = 'accept_edits'

// 미설정 요청의 선호값. 실행/표시는 반드시 모델·종류 정책으로 정착한 값을 사용한다.
export const DEFAULT_PERMISSION_MODE: NormalizedPermissionMode = 'auto_classified'

// '자동'(auto)을 지원하지 않는 모델에서 그것을 대신할 모드 (0215 D-010 — 사용자 결정).
// `PLAN_APPROVED_MODE` 와 값은 같지만 **다른 규칙**이라 상수를 나눈다 — 하나로 묶으면 계획
// 승인 목표 모드를 바꿀 때 이 강등까지 함께 끌려간다.
const AUTO_UNSUPPORTED_FALLBACK_MODE: NormalizedPermissionMode = 'accept_edits'

// 정규화 모드 전수 (UI 메뉴·검증 루프용 단일 출처).
export const NORMALIZED_MODES: readonly NormalizedPermissionMode[] = [
  'default',
  'accept_edits',
  'plan',
  'dont_ask',
  'bypass',
  'auto_classified'
] as const

// NormalizedPermissionMode → SDK PermissionMode 순수 매핑 (provider-runtime.md §3 정본).
// auto_classified = TS 전용 모델 분류기('auto'). 6종 전수 대응 — exhaustive switch 로 누락 시 컴파일 에러.
export function toClaudePermissionMode(mode: NormalizedPermissionMode): ClaudePermissionMode {
  switch (mode) {
    case 'default':
      return 'default'
    case 'accept_edits':
      return 'acceptEdits'
    case 'plan':
      return 'plan'
    case 'dont_ask':
      return 'dontAsk'
    case 'bypass':
      return 'bypassPermissions'
    case 'auto_classified':
      return 'auto'
  }
}

// 이전 UI 저장값을 정규화된 모드로 읽는 호환 브리지.
export function fromUiPermissionMode(mode: PermissionMode): NormalizedPermissionMode {
  return mode === 'plan' ? 'plan' : 'accept_edits'
}

// 종류별 선택 가능한 실제 모드. idle 선택은 이 정책만 적용하고 다음 send에서 모델을 검사한다.
export function permissionModeForAgent(
  mode: NormalizedPermissionMode,
  kind: AgentKind
): NormalizedPermissionMode {
  return kind === 'work' && (mode === 'plan' || mode === 'accept_edits' || mode === 'dont_ask')
    ? 'default'
    : mode
}

export function planApprovedMode(kind: AgentKind): NormalizedPermissionMode {
  return kind === 'work' ? 'default' : PLAN_APPROVED_MODE
}

// 메뉴·상태 전이·실제 실행이 같은 함수를 소비한다. 모드 어휘 자체는 SDK 호환 6종을 유지한다.
export function coercePermissionMode(
  mode: NormalizedPermissionMode,
  model: { alias: string; model: string | null } | null,
  kind: AgentKind = 'coding'
): NormalizedPermissionMode {
  const allowed = permissionModeForAgent(mode, kind)
  if (allowed !== 'auto_classified' || supportsAutoPermission(model?.model)) return allowed
  return kind === 'work' ? 'default' : AUTO_UNSUPPORTED_FALLBACK_MODE
}

// 실제 모델 문자열만 가진 Main 호출부의 입력 어댑터.
export function coerceAutoPermissionModeForModelName(
  mode: NormalizedPermissionMode,
  modelName: string | undefined,
  kind: AgentKind = 'coding'
): NormalizedPermissionMode {
  return coercePermissionMode(mode, { alias: '', model: modelName ?? null }, kind)
}
