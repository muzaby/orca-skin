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
import { PLAN_APPROVED_MODE } from '../../../shared/permission-mode'
import { agentPermissionRequest } from '../../features/approvals/permission-bridge'
import type { ApprovalCoordinator } from '../../features/approvals/coordinator'
import type { PermissionModeController } from '../../features/approvals/permission-mode-controller'
import type { HistoryWriter } from '../../features/history/writer'
import type { TurnContext } from '../../contracts/turn'
import { getLogger } from '../../infra/log'
import { sendChatEvent } from '../../infra/ipc/send'

export interface ApprovalRequesterDeps {
  wc: WebContents
  approvals: ApprovalCoordinator
  permissionModes: PermissionModeController
  persistence: HistoryWriter
  /** 승인 대기 동안 stall 타이머를 멈춘다 — 사람 판단 시간이 stall 로 오판되지 않게. */
  beginApprovalPause: () => (() => void) | undefined
  /** 세션-레벨 인디렉션 — 호출 시점의 활성 턴을 읽는다. */
  getActiveTurn: () => TurnContext<WebContents>
}

export function createApprovalRequester(
  deps: ApprovalRequesterDeps
): (action: PermissionAction, sdkSignal?: AbortSignal) => Promise<ApprovalResolution> {
  const { wc, approvals, permissionModes, persistence } = deps

  return async (action, sdkSignal) => {
    const turn = deps.getActiveTurn()
    const controller = turn.controller
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
          ? { kind: 'ask_question', request: { ...action.request, requestId: approvalId } }
          : { kind: 'plan_review', request: { ...action.request, requestId: approvalId } }
    // permission.requested 에 소유 세션을 실어 renderer 가 activeKey 폴백 없이 정확한
    // 세션 엔트리로 라우팅하게 한다. 불변식: 권한 요청은 session.updated(turn.dbSessionId
    // set, persist.ts) 이후라 dbSessionId 가 채워져 있다. 깨지면(provider/adapter 변경 등)
    // 조용한 오배선 대신 dev warn 으로 가시화 — 이벤트는 sessionId 없이 폴백 라우팅된다.
    if (!turn.dbSessionId) {
      getLogger().child('chat').warn('chat.permission.session-missing', {
        approvalId,
        kind: action.kind,
        reason: 'permission.requested without dbSessionId — falling back to activeKey'
      })
    }
    sendChatEvent(wc, agentPermissionRequest(approvalId, outbound, turn.dbSessionId ?? undefined))
    // 승인 보류 동안 stall 타이머를 멈춘다 — 사용자 판단 시간이 stall 로 오판돼 턴이 abort 되지
    // 않게. release 로 재개(동시 N건은 refcount). broker 는 턴 signal + (있으면) SDK 권한요청
    // 취소 signal 양쪽으로 해소된다 — SDK 가 control_cancel_request 로 취소하면 sdkSignal abort
    // → broker deny → 무한 await 방지. 턴 abort 도 그대로 동작.
    const releaseIdle = deps.beginApprovalPause()
    const regSignal = sdkSignal
      ? AbortSignal.any([controller.signal, sdkSignal])
      : controller.signal
    let resolution: ApprovalResolution
    try {
      resolution = await approvals.register(approvalId, turn, regSignal)
    } finally {
      releaseIdle?.()
    }
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
      turn.pendingAskAnswers.push({
        answers: ui.answers ?? {},
        ...(typeof ui.response === 'string' ? { response: ui.response } : {})
      })
      persistence.flushAskAnswers(turn, wc)
    }
    // 계획 승인 후처리 — SDK 세션은 어댑터가 allow 응답의 updatedPermissions 로 이미 전환했다
    // (adapters/claude.ts). 여기서는 main 세션 SSOT 를 같은 값으로 맞춰, 다음 턴 send 페이로드가
    // 도착하기 전 구간에도 controller 가 plan 이라고 답하지 않게 한다.
    if (action.kind === 'plan_review' && resolution.behavior === 'allow' && turn.dbSessionId) {
      void permissionModes.setMode(turn.dbSessionId, PLAN_APPROVED_MODE)
    }
    return resolution
  }
}
