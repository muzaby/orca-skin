// 권한 모드 정규화 계층 (provider-runtime.md §3 정본).
//
// 순수 타입/함수만 — zod·SDK 를 import 하지 않는다. shared/ 는 preload(sandbox=true) 와
// renderer·main 이 모두 import 하므로 런타임 의존이 없어야 한다.
//
// 세 종류의 모드 어휘가 공존한다:
//   1) NormalizedPermissionMode — provider 중립 정규화(6종, snake_case). 앱 내부 SSOT 어휘.
//   2) ClaudePermissionMode     — Claude Agent SDK 의 PermissionMode 미러(6종, camelCase, sdk.d.ts:1865).
//                                 SDK 를 직접 import 하지 않고 타입만 미러해 sandbox 안전을 지킨다.
//   3) PermissionMode (./ipc)   — 현 Composer UI 가 노출하는 2종(plan/acceptEdits). 1)의 부분집합.
//                                 PR③ 에서 6종으로 확장 예정.

import type { PermissionMode } from './ipc'
import { isHaikuModel } from './model-identity'

// provider 중립 권한 모드 (정규화 어휘). UI/IPC/controller 가 공유하는 SSOT 표현.
export type NormalizedPermissionMode =
  'default' | 'accept_edits' | 'plan' | 'dont_ask' | 'bypass' | 'auto_classified'

// Claude Agent SDK PermissionMode 미러 (sdk.d.ts:1865). SDK 직접 import 대신 타입 미러.
export type ClaudePermissionMode =
  'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto'

// 계획 승인(ExitPlanMode allow) = plan 모드 종료 시 들어갈 모드. 렌더러 칩(chatStore.approvePlan)·
// SDK 세션(adapters/claude.ts 의 updatedPermissions)·main 세션 SSOT(app/chat-turn.ts) 세 곳이
// 같은 값을 읽도록 단일 정의로 둔다 — 셋이 어긋나면 "칩은 편집 수락인데 SDK 는 plan" 이 된다.
export const PLAN_APPROVED_MODE: NormalizedPermissionMode = 'accept_edits'

// 미설정 세션의 기본 권한 모드 (D-012). **렌더러 초기 상태와 main 미설정 조회가 이 상수 하나를
// 읽는다** — 양쪽에 리터럴을 두면 한쪽만 옮겼을 때 칩과 main 이 서로 다른 모드를 진실로 삼는다.
export const DEFAULT_PERMISSION_MODE: NormalizedPermissionMode = 'auto_classified'

// '자동'(auto)을 지원하지 않는 모델에서 그것을 대신할 모드 (0215 D-010 — 사용자 결정).
// `PLAN_APPROVED_MODE` 와 값은 같지만 **다른 규칙**이라 상수를 나눈다 — 하나로 묶으면 계획
// 승인 목표 모드를 바꿀 때 이 강등까지 함께 끌려간다.
export const AUTO_UNSUPPORTED_FALLBACK_MODE: NormalizedPermissionMode = 'accept_edits'

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

// 현 UI 2종(PermissionMode) → 정규화 모드 브리지. UI 가 보낸 per-turn 모드를 controller 의
// 정규화 어휘로 올린다. PR③ 에서 UI 가 6종을 보내면 이 함수 호출처는 직접 NormalizedPermissionMode 사용.
export function fromUiPermissionMode(mode: PermissionMode): NormalizedPermissionMode {
  return mode === 'plan' ? 'plan' : 'accept_edits'
}

// 선택 모델이 '자동'을 지원하지 않으면 모드를 내려앉힌다 (0215 D-009·D-010).
//
// 규칙은 이 함수 하나가 갖고 renderer 메뉴·reducer·main 턴 조립이 모두 이것을 부른다 —
// 세 곳에 조건을 복붙하면 한 곳만 고쳐졌을 때 칩과 SDK 세션이 서로 다른 모드를 주장한다.
// `auto_classified` 가 아니면 손대지 않는다(다른 모드는 haiku 에서도 유효하다).
export function coerceAutoPermissionMode(
  mode: NormalizedPermissionMode,
  model: { alias: string; model: string | null }
): NormalizedPermissionMode {
  if (mode !== 'auto_classified') return mode
  return isHaikuModel(model) ? AUTO_UNSUPPORTED_FALLBACK_MODE : mode
}

// 모델 문자열만 아는 호출부(main 턴 조립 — alias 를 갖지 않는다)를 위한 얇은 래퍼(0215 D-011).
// alias 축은 renderer 가 이미 닫았고 여기는 이름 축의 2차 방어다.
export function coerceAutoPermissionModeForModelName(
  mode: NormalizedPermissionMode,
  modelName: string | undefined
): NormalizedPermissionMode {
  return coerceAutoPermissionMode(mode, { alias: '', model: modelName ?? null })
}
