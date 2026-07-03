// PermissionBridge 헬퍼 — provider 중립 권한 요청/정책 (provider-runtime.md §3).
//
// 권한 요청의 보류·해소(approvalId ↔ Promise)는 ask/broker.ts 의 InteractionBroker 가 이미
// 담당한다(approvalId 로 키잉되는 PendingApprovalStateMachine). 본 파일은 그 위의 두 순수 조각:
//   ① agentPermissionRequest — AskUserQuestion·ExitPlanMode·일반 도구를 단일 permission.requested 로 합성.
//   ② AppCommandPolicy — 앱이 합성한 명령(slash command 등)의 3분기 분류(현재 seam).
// 둘 다 electron 비의존 순수 함수라 단위 테스트 대상.

import type { NormalizedEvent, PermissionAction } from '../../../shared/ipc'

// 위험 도구 게이트 화이트리스트(provider-runtime.md §3). 상태를 변경하는 도구만 승인 카드로
// surface 하고, 안전 도구(Read/Glob/Grep 등)는 자동 통과한다(Claude Code 웹/CLI 기본 패턴과
// 일치). 단일 상수라 확장이 쉽다 — 새 위험 도구는 여기에만 추가한다.
export const RISKY_TOOLS: ReadonlySet<string> = new Set([
  'Bash',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit'
])

// 도구 이름이 위험 도구 화이트리스트에 드는지. 화이트리스트 외(또는 안전 도구)는 게이트 미적용.
export function isRiskyTool(name: string): boolean {
  return RISKY_TOOLS.has(name)
}

// 에이전트 발화 권한 요청 이벤트 합성(origin:'agent'). 종류는 action.kind 로 구분된다.
// 코어 중립(0016): 이벤트는 provider 를 싣지 않는다 — 세션↔어댑터 바인딩에서 파생.
// sessionId 는 renderer chatStore.receive 가 올바른 세션 엔트리로 라우팅하는 키 — 없으면
// activeKey 폴백이라 멀티세션에서 카드/우측패널이 다른 대화로 샌다(권한 요청은 항상 소유
// 세션이 있으므로 호출부가 turn.dbSessionId 를 넘긴다). 미전달 시 키 생략(폴백 유지).
export function agentPermissionRequest(
  approvalId: string,
  action: PermissionAction,
  sessionId?: string
): Extract<NormalizedEvent, { type: 'permission.requested' }> {
  return {
    type: 'permission.requested',
    ...(sessionId ? { sessionId } : {}),
    approvalId,
    origin: 'agent',
    action
  }
}

// AppCommandPolicy — 앱이 합성한 명령의 3분기 분류(provider-runtime.md §3). 현재 Orca 는
// app-origin 명령을 합성하지 않으므로 기본은 보수적(require_approval). slash command / OpenCode
// 편입 시 표를 채운다(seam). 표에 없는 명령은 항상 require_approval.
export type AppCommandClass = 'allow_immediate' | 'require_approval' | 'forbidden'

const APP_COMMAND_POLICY: Record<string, AppCommandClass> = {}

export function classifyAppCommand(name: string): AppCommandClass {
  return APP_COMMAND_POLICY[name] ?? 'require_approval'
}
