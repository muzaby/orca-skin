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

// provider 중립 권한 모드 (정규화 어휘). UI/IPC/controller 가 공유하는 SSOT 표현.
export type NormalizedPermissionMode =
  | 'default'
  | 'accept_edits'
  | 'plan'
  | 'dont_ask'
  | 'bypass'
  | 'auto_classified'

// Claude Agent SDK PermissionMode 미러 (sdk.d.ts:1865). SDK 직접 import 대신 타입 미러.
export type ClaudePermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan'
  | 'dontAsk'
  | 'auto'

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
