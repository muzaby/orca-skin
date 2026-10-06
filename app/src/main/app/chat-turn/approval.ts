// 단일 권한 승인 위임 (0179 에서 분해).
//
// 어댑터의 canUseTool 이 ask_question·plan_review·tool_approval 중 하나를 PermissionAction 으로
// 넘기면, approvalId 를 발급해 permission.requested 이벤트로 renderer 에 surface 하고 broker 가
// 응답(또는 turn abort)까지 Promise 를 보류한다.
//
// **활성 턴을 값이 아니라 게터로 받는다.** 자동 연속 턴(0067 AC7)이 같은 채널에서 후속
// TurnContext 로 이어지므로, 고정 turn 을 캡처하면 연속 턴에서 승인이 옛 턴에 붙는다.

import type { WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import type { ApprovalResolution, PermissionAction } from '../../../shared/ipc'
import { planApprovedMode } from '../../../shared/permission-mode'
import { planReviewToolInput } from '../../../shared/plan-review-input'
import { agentPermissionRequest } from '../../features/approvals/permission-bridge'
import type { ApprovalCoordinator } from '../../features/approvals/coordinator'
import type { PermissionModeController } from '../../features/approvals/permission-mode-controller'
import type { HistoryWriter } from '../../features/history/writer'
import type { TurnContext } from '../../contracts/turn'
import { sendChatEvent } from '../../infra/ipc/send'

interface ApprovalRequesterDeps {
  wc: WebContents
  approvals: ApprovalCoordinator
  permissionModes: PermissionModeController
  persistence: HistoryWriter
  /** 세션-레벨 인디렉션 — 호출 시점의 활성 턴을 읽는다. */
  getActiveTurn: () => TurnContext<WebContents>
}

export function createApprovalRequester(
  deps: ApprovalRequesterDeps
): (action: PermissionAction, sdkSignal?: AbortSignal) => Promise<ApprovalResolution> {
  const { wc, approvals, permissionModes, persistence } = deps

  return async (action: PermissionAction, sdkSignal?: AbortSignal): Promise<ApprovalResolution> => {
    const turn = deps.getActiveTurn()
    const controller = turn.controller
    // main 요청은 턴+SDK 신호를 함께 따르고, 독립 수명의 child 요청은 SDK 권한요청 신호만
    // 따른다. 진입 전에 취소된 요청은 승인 카드·이력을 만들지 않는다.
    const childRequest = action.providerRequest?.agentId !== undefined
    const regSignal = childRequest
      ? (sdkSignal ?? controller.signal)
      : sdkSignal
        ? AbortSignal.any([controller.signal, sdkSignal])
        : controller.signal
    if (regSignal.aborted) return { behavior: 'deny' }
    // 세션 자동 허용된 위험 도구는 카드 미surface — 즉시 통과.
    if (action.kind === 'tool_approval') {
      const sid = turn.dbSessionId
      if (sid && approvals.isSessionAllowed(sid, action.toolName)) {
        return { behavior: 'allow' }
      }
    }
    const approvalId = randomUUID()
    // 어댑터가 넘긴 request.requestId 는 비어 있으므로 approvalId 를 주입한다 — renderer 의
    // 카드(pendingAsks/pendingPlanReview)가 이 id 로 permissionRespond 회신할 수 있게.
    const outbound: PermissionAction =
      action.kind === 'tool_approval'
        ? action
        : action.kind === 'ask_question'
          ? { ...action, request: { ...action.request, requestId: approvalId } }
          : { ...action, request: { ...action.request, requestId: approvalId } }
    // control callback은 iterator의 session.updated보다 먼저 실행될 수 있다. 세션 확정
    // 전 요청은 renderer의 pending draft가 소유하며 승격 때 같은 승인 상태가 이동한다.
    // resolved는 확정된 sessionId 또는 approvalId로 해당 요청 소유자에게 라우팅된다.
    const requested = agentPermissionRequest(approvalId, outbound, turn.dbSessionId ?? undefined)
    // 승인 콜백과 started 스트림은 독립 진행한다. 저장·late started 보정을 먼저 등록해
    // 화면과 재로드가 같은 승인 시점 입력을 사용하게 한다.
    if (planReviewToolInput(outbound)) persistence.persist(turn, requested)
    sendChatEvent(wc, requested)
    // 진입 뒤 SDK control_cancel_request가 해당 signal을 abort하면 broker deny로 해소된다.
    const resolution = await approvals.register(approvalId, turn, regSignal)
    sendChatEvent(wc, {
      type: 'permission.resolved',
      ...(turn.dbSessionId ? { sessionId: turn.dbSessionId } : {}),
      approvalId,
      resolution
    })
    // ask_question 후처리 — 답변을 큐에 적재 후 즉시 페어링 시도(tool_use id 가 먼저 와
    // 있을 수도 있다). SDK 가 answers 를 메시지 스트림으로 안 돌려주므로 router 가 합성한다.
    if (action.kind === 'ask_question' && resolution.behavior === 'allow') {
      const ui = (resolution.updatedInput ?? {}) as {
        answers?: Record<string, string | string[]>
        response?: unknown
      }
      const toolUseId = action.providerRequest?.toolUseId
      if (toolUseId) {
        turn.pendingAskAnswers.push({
          toolUseId,
          answers: ui.answers ?? {},
          ...(typeof ui.response === 'string' ? { response: ui.response } : {})
        })
        persistence.flushAskAnswers(turn, wc)
      }
    }
    // 계획 승인 후처리 — SDK 세션은 어댑터가 allow 응답의 updatedPermissions 로 이미 전환했다
    // (adapters/claude.ts). 여기서는 main 세션 SSOT 를 같은 값으로 맞춰, 다음 턴 send 페이로드가
    // 도착하기 전 구간에도 controller 가 plan 이라고 답하지 않게 한다.
    if (
      action.kind === 'plan_review' &&
      !childRequest &&
      resolution.behavior === 'allow' &&
      turn.dbSessionId
    ) {
      void permissionModes.setMode(turn.dbSessionId, planApprovedMode(turn.agentKind))
    }
    return resolution
  }
}
