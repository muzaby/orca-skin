// PermissionBridge 헬퍼 — provider 중립 권한 요청/정책 (provider-runtime.md §3).
//
// 권한 요청의 보류·해소(approvalId ↔ Promise)는 ask/broker.ts 의 ApprovalBroker 가 이미
// 담당한다(approvalId 로 키잉되는 PendingApprovalStateMachine). 본 파일은 그 위의 두 순수 조각:
//   ① agentPermissionRequest — AskUserQuestion·ExitPlanMode·일반 도구를 단일 permission.requested 로 합성.
//   ② AppCommandPolicy — 앱이 합성한 명령(slash command 등)의 3분기 분류(현재 seam).
// 둘 다 electron 비의존 순수 함수라 단위 테스트 대상.

import type { NormalizedEvent, PermissionAction } from '../../../shared/ipc'

// 위험 도구 게이트(RISKY_TOOLS·isRiskyTool)는 어댑터의 canUseTool 이 소비하므로 adapters 포트
// (`adapters/risky-tools.ts`)로 이관됐다. 본 파일은 approvals 슬라이스의 권한 이벤트 합성·정책만.

// 에이전트 발화 권한 요청 이벤트 합성(origin:'agent'). 종류는 action.kind 로 구분된다.
// 코어 중립(0016): 이벤트는 provider 를 싣지 않는다 — 세션↔어댑터 바인딩에서 파생.
// sessionId는 확정된 소유 세션의 라우팅 키다. control callback이 초기화보다 먼저 오면
// 아직 ID가 없으므로 키를 생략하고 renderer가 진행 중 pending draft에 보관한다.
// 승격 때 같은 승인 상태를 실제 세션으로 옮긴다.
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
type AppCommandClass = 'allow_immediate' | 'require_approval' | 'forbidden'

const APP_COMMAND_POLICY: Record<string, AppCommandClass> = {}

export function classifyAppCommand(name: string): AppCommandClass {
  return APP_COMMAND_POLICY[name] ?? 'require_approval'
}
