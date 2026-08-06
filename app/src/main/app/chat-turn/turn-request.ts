// 최초 턴의 TurnRequest 조립 — 게이트 콜백 6종 + 중단 영수증 화해 (0179 에서 분해).
//
// **활성 턴과 초기 배치를 값이 아니라 게터로 받는다.** 두 값은 자동 연속 턴과 finally 정리가
// 함께 보는 가변 상태다 — 값으로 캡처하면 연속 턴에서 콜백이 옛 턴을 보고(0067 AC7) 롤백
// fence 가 어긋난다(0166 D7 과 같은 결함).

import type { WebContents } from 'electron'
import type { InterruptReceipt, SteerFlushBatch, TurnRequest } from '../../adapters/turn'
import type { TurnContext } from '../../contracts/turn'
import type { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import type { SessionActivityProjector } from '../../features/chat/session-activity-projector'
import { reconcileInterruptReceipt } from '../../features/chat/interrupt-reconcile'
import { getLogger } from '../../infra/log'
import { sendSubmitted } from './turn-setup'

interface TurnRequestDeps {
  wc: WebContents
  pendingMessages: PendingMessageQueue
  activity: SessionActivityProjector
  chainId: string
  /** 세션 id 확정 전의 큐 키(renderer clientKey 파생). */
  queueKey: string
  getActiveTurn: () => TurnContext<WebContents>
  getInitialBatches: () => SteerFlushBatch[]
  /** 채널이 내려갔을 때 미정착 백그라운드 태스크를 정착·정리한다. */
  settleDeadBackgroundTasks: (turn: TurnContext<WebContents>, sessionId: string) => Promise<void>
}

// 중단 영수증 화해(0151 AC11) — still_queued 에는 우리가 보낸 적 없는 내부 uuid(cron 트리거·
// 백그라운드 auto-resume continuation)가 섞이므로 **우리 예약과의 교집합만** 취한다. 모르는
// uuid 를 잔여로 오인해 런타임을 폐기하면 0143 백그라운드 완료 통지가 죽는다.
//
// 교집합이 비지 않으면 **사용자에게 알리고 선택지를 준다**(0151 r2 / OQ1 결정). 공개 SDK 로는
// 잔여를 취소할 수 없고 남은 수단은 런타임 폐기뿐인데 그건 백그라운드 태스크를 함께 죽인다.
// 그 비용을 앱이 몰래 치르지 않고 사용자가 고르게 한다.
function reconcileInterrupt(
  activity: SessionActivityProjector,
  sessionId: string,
  receipt: InterruptReceipt | undefined,
  submittedAtInterrupt: readonly string[]
): void {
  const outcome = reconcileInterruptReceipt(receipt, submittedAtInterrupt)
  const log = getLogger().child('chat')
  if (outcome.kind === 'unknown') {
    // capability 미보유(구형 CLI) — "잔여 없음" 이 아니라 "잔여 미상". 폐기하지 않는다.
    log.info('chat.interrupt.receipt-absent', { sessionId })
    return
  }
  if (outcome.kind === 'clear') {
    activity.setResidualAttempts(sessionId, [])
    return
  }
  log.info('chat.interrupt.still-queued', {
    sessionId,
    ourCount: outcome.uuids.length,
    totalCount: outcome.totalCount
  })
  activity.setResidualAttempts(sessionId, outcome.uuids)
}

export function buildTurnRequest(
  deps: TurnRequestDeps,
  fields: Omit<
    TurnRequest,
    | 'takeSteerFlush'
    | 'rollbackSteerFlush'
    | 'commitSteerFlush'
    | 'canSubmitInitial'
    | 'commitInitialSubmission'
    | 'rollbackInitialSubmission'
    | 'captureInterruptReceipt'
    | 'onChannelRetired'
    | 'isSubagentBlocked'
  >
): TurnRequest {
  const { pendingMessages, activity, chainId, queueKey } = deps

  // 소유권 표시(0151 AC12) — 세 예약 경로(게이트 flush·롤백·연속 턴)가 같은 인자로 부르게 한다.
  const sendOwnership = (sessionId: string, ids: string[], submitted: boolean): void => {
    sendSubmitted(deps.wc, sessionId, ids, submitted)
  }
  const batchClaims = (): Array<{
    messageIds: string[]
    attemptId: string
    chainId: string
  }> =>
    deps.getInitialBatches().map((batch) => ({
      messageIds: batch.ids,
      attemptId: batch.attemptId ?? batch.uuid,
      chainId: batch.chainId ?? chainId
    }))

  return {
    ...fields,
    // 게이트 훅(PostToolBatch) 시점에 로컬 홀드 pending 을 병합 단일 배치로 회수(0060 D3·D4).
    // 활성 턴의 dbSessionId 를 훅 발화 시점에 동적으로 읽는다 — 새 세션 턴은 session.updated
    // 전까지 null(그동안 예약 자체가 불가능하므로 빈 회수가 옳다).
    takeSteerFlush: () => {
      const sid = deps.getActiveTurn().dbSessionId
      if (!sid) return undefined
      return pendingMessages.reserveHeld(sid, 'steer', undefined, chainId)
    },
    // 입력 채널이 배치를 거부하면(closed stream / push 예외) 예약을 held 로 되돌린다(AC4).
    rollbackSteerFlush: (batch) => {
      const sid = deps.getActiveTurn().dbSessionId
      if (!sid) return
      if (pendingMessages.rollback(sid, batch.uuid)) sendOwnership(sid, batch.ids, false)
    },
    commitSteerFlush: (batch) => {
      const sid = deps.getActiveTurn().dbSessionId
      if (!sid) return false
      const committed = pendingMessages.commit(sid, batch.attemptId ?? batch.uuid, chainId)
      if (committed) sendOwnership(sid, batch.ids, true)
      return committed
    },
    canSubmitInitial: () =>
      pendingMessages.canCommitMany(deps.getActiveTurn().dbSessionId ?? queueKey, batchClaims()),
    commitInitialSubmission: () => {
      const activeTurn = deps.getActiveTurn()
      const sid = activeTurn.dbSessionId ?? queueKey
      const committed = pendingMessages.commitMany(sid, batchClaims())
      if (committed && activeTurn.dbSessionId) {
        for (const batch of deps.getInitialBatches()) {
          sendOwnership(activeTurn.dbSessionId, batch.ids, true)
        }
      }
      return committed
    },
    rollbackInitialSubmission: () => {
      const activeTurn = deps.getActiveTurn()
      const sid = activeTurn.dbSessionId ?? queueKey
      for (const batch of deps.getInitialBatches()) {
        if (
          pendingMessages.rollback(sid, batch.attemptId ?? batch.uuid) &&
          activeTurn.dbSessionId
        ) {
          sendOwnership(activeTurn.dbSessionId, batch.ids, false)
        }
      }
    },
    captureInterruptReceipt: () => {
      const sid = deps.getActiveTurn().dbSessionId
      if (!sid) return undefined
      const submittedAtInterrupt = pendingMessages.submittedUuids(sid)
      return (receipt) => reconcileInterrupt(activity, sid, receipt, submittedAtInterrupt)
    },
    onChannelRetired: () => {
      const activeTurn = deps.getActiveTurn()
      const sid = activeTurn.dbSessionId
      if (sid) void deps.settleDeadBackgroundTasks(activeTurn, sid)
    },
    isSubagentBlocked: (st) => st !== undefined && deps.getActiveTurn().blockedSubagents.has(st)
  }
}
