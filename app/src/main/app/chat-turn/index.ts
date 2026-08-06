// chat 턴 파이프라인 진입(orca:chat:send / steerCancel / discardSession / cancel / stopSubagent)의
// 컴포지션 루트(L3). 가로축 구동(스트림 소비→reduce→persist∥forward + retry/settle/stall)은
// TurnCoordinator(L1)가 1급으로 소유하고(0052, 0051 §A), 여기서는 **배선만** 한다.
//
// 0179 에서 892줄짜리 `handleChatSend` 를 단계 모듈로 갈랐다 — 판정 `admission.ts`, 조립
// `turn-context.ts`·`turn-request.ts`·`continuation.ts`, 승인 `approval.ts`, 실행 `post-turn.ts`,
// 순서 `send.ts`. 이 파일은 그 앞의 IPC 등록과 턴-공통 헬퍼만 남긴다.
//
// **배럴이자 진입점이다** — 기존 `import { registerChatHandlers } from './chat-turn'` 이 그대로
// 해석되도록 디렉토리 index 로 둔다(무회귀 분해, `src/main/AGENTS.md §작업 규칙`).

import type { WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { CHANNELS } from '../../../shared/ipc'
import {
  CancelChatSchema,
  CancelSteerSchema,
  DiscardSessionSchema,
  StopSubagentSchema
} from '../../../shared/protocol'
import type { TurnEmit } from '../../contracts/bus-events'
import type { TurnContext } from '../../contracts/turn'
import { abortTurn } from '../../features/chat/abort'
import {
  settleOpenToolRuns,
  settleSubagentTask,
  settleTrackedTasks,
  stopLiveSubagent
} from '../../features/chat/settle'
import { handle, handlePlain } from '../../infra/ipc/handle'
import { sendChatEvent } from '../../infra/ipc/send'
import { getLogger, runWithLogContext } from '../../infra/log'
import { reserveOnBusySession } from './busy-reserve'
import type { ChatDeps, ChatRuntimeDeps } from './deps'
import { handleChatSend } from './send'
import { sendSubmitted } from './turn-setup'

export type { ChatDeps } from './deps'

export function registerChatHandlers(deps: ChatDeps): void {
  const { supervisor, bus, persistence, pendingMessages, backgroundTasks, activity } = deps

  // settle(취소·서브에이전트 중단) 정착 이벤트를 turn.event 버스로 방출 — 스트리밍과 동일
  // 파이프라인. fault-isolated: 정리 중 구독자 throw 가 핸들러를 깨지 않게 격리한다.
  const emitTurn: TurnEmit<WebContents> = (turn, ev) => {
    try {
      bus.emit('turn.event', { turn, ev })
    } catch (err) {
      getLogger()
        .child('chat')
        .warn('chat.turn-event.emit-failed', { isolated: true, message: String(err) })
    }
  }

  // 0136 — 세션별 미정착 백그라운드 서브에이전트 추적(coordinator 가 갱신, 턴-후 루프가 조회)
  // + listen 턴 릴리즈 밸브(세션 키 — busy send 예약이 listen 프레임을 닫아 즉시 연속 턴 전환).
  const listenRelease = new Map<string, () => void>()

  // 0136 — 채널이 내려간 세션에 미정착 백그라운드 태스크가 남으면(in-process 라 채널과 함께
  // 소멸) 합성 settled(failed)로 부모 Task/열린 child 를 정착해 '실행 중' 영구 고착을 막고
  // 추적을 비운다. 정착 이벤트는 turn.event 버스로 흐르므로 재로드 복원까지 일관된다.
  const settleDeadBackgroundTasks = (
    turn: TurnContext<WebContents>,
    sessionId: string
  ): Promise<void> =>
    settleTrackedTasks(turn, emitTurn, sessionId, backgroundTasks, {
      status: 'failed',
      summary: '채널이 종료되어 서브에이전트가 중단되었습니다.',
      stopLive: false
    })

  // listen 대기 중 사용자 중단(0143, 사용자 확정) — 대기만 끊지 않고 실행 중 백그라운드 태스크도
  // 함께 중단한다(stopTask + 합성 stopped 정착). 대안(태스크 유지)은 다음 send 의 draining
  // teardown 으로 태스크가 어차피 소리 없이 죽어 '실행 중' 거짓 표시만 남긴다.
  const stopAndSettleAbortedTasks = (
    turn: TurnContext<WebContents>,
    sessionId: string
  ): Promise<void> =>
    settleTrackedTasks(turn, emitTurn, sessionId, backgroundTasks, {
      status: 'stopped',
      summary: '사용자가 대기를 중단해 백그라운드 서브에이전트를 중지했습니다.',
      stopLive: true
    })

  const runtimeDeps: ChatRuntimeDeps = {
    ...deps,
    settleDeadBackgroundTasks,
    stopAndSettleAbortedTasks,
    reserveOnBusySession: (event, queueKey, sessionId, lease, data, na) =>
      reserveOnBusySession(
        { pendingMessages, listenRelease },
        event,
        queueKey,
        sessionId,
        lease,
        data,
        na
      ),
    listenRelease
  }

  // chatSend 는 검증 실패를 reject 가 아닌 error 이벤트로 회신하는 특례 — handlePlain 으로
  // 등록하고 핸들러 서두에서 직접 safeParse 한다(admission.ts). 턴 진입을 runWithLogContext 로
  // 감싸(0124 AC4) 이 턴의 비동기 흐름(chat/engine/db)에서 emit 되는 로그가 동일 correlationId
  // 로 묶인다.
  handlePlain(CHANNELS.chatSend, (raw, event) =>
    runWithLogContext({ correlationId: randomUUID() }, () =>
      handleChatSend(runtimeDeps, event, raw)
    )
  )

  // held 단건 취소(pending 버블 hover) — flushed(주입 완료) 항목은 거부(무이벤트), 이후 echo
  // 커밋이 버블을 복원한다(D3 정직 화해). 구 chat:steer 채널은 chat:send 로 흡수됐다(0067 AC5).
  handle(CHANNELS.chatSteerCancel, CancelSteerSchema, 'reject', (req, event): void => {
    const removed = pendingMessages.cancel(req.sessionId, req.id)
    if (!removed) {
      // 0151 AC12 — 거부를 침묵하지 않는다. 예약된 항목은 이미 소유권이 넘어갔으므로 그 사실을
      // 돌려줘 renderer 가 버블을 "전달됨"(취소 버튼 없음)으로 재동기화한다.
      sendSubmitted(event.sender, req.sessionId, [req.id], true)
      return
    }
    sendChatEvent(event.sender, {
      type: 'message.cancelled',
      sessionId: req.sessionId,
      ids: [req.id]
    })
  })

  // 세션 전체 중단(0151 r2 / OQ1 결정) — Stop 뒤에도 CLI 큐에 살아남은 **우리** 예약을 없애는
  // 유일한 수단. 공개 SDK 에 provider 큐 개별 취소 표면이 없으므로 런타임(서브프로세스)을 폐기해
  // 큐를 통째로 소멸시킨다. **백그라운드 서브에이전트도 함께 죽으므로** 자동화하지 않고 사용자가
  // 명시적으로 고를 때만 실행된다(renderer 는 chat.activity 의 residualCount 가 있을 때만 제시).
  handle(CHANNELS.chatDiscardSession, DiscardSessionSchema, 'reject', (req, event): void => {
    const residual = activity.residualAttemptIds(req.sessionId)
    activity.setResidualAttempts(req.sessionId, [])
    // 진행 중 턴이 남아 있으면 먼저 끊는다 — 그래야 런타임이 풀로 반납돼 폐기 대상이 된다.
    const turn = supervisor.getBySession(req.sessionId)
    if (turn) abortTurn(turn, 'user_cancelled')
    supervisor.discardRuntime(req.sessionId)
    // 큐 잔여를 되돌려준다 — 서브프로세스와 함께 CLI 큐가 사라졌으므로 이 예약들은 확실히
    // 실행되지 않는다. 텍스트는 draft 로 복원해 사용자가 재전송을 정한다.
    const discarded = pendingMessages.discardSubmitted(req.sessionId, residual)
    const ids = discarded.flatMap((batch) => batch.ids)
    if (ids.length > 0) {
      sendChatEvent(event.sender, { type: 'message.cancelled', sessionId: req.sessionId, ids })
    }
    getLogger()
      .child('chat')
      .info('chat.session.discarded', { sessionId: req.sessionId, discarded: ids.length })
  })

  handle(CHANNELS.chatCancel, CancelChatSchema, 'reject', (req, event): void => {
    // 중단 버튼 = 턴 interrupt + held 전량 취소(0067 확정 5). renderer 는 message.cancelled 의
    // 잔존 항목 텍스트를 composer draft 로 복원한다(편집 가능). flushed 분은 회수 불가(D3) —
    // 소비되면 echo 커밋으로 정직 화해. controller abort 가 자동 연속 루프도 차단한다.
    const removed = pendingMessages.cancelAllHeld(req.sessionId)
    if (removed.length > 0) {
      sendChatEvent(event.sender, {
        type: 'message.cancelled',
        sessionId: req.sessionId,
        ids: removed.map((item) => item.id)
      })
    }
    supervisor.cancelChain(req.sessionId)
    const turn = supervisor.getBySession(req.sessionId)
    if (!turn) return
    abortTurn(turn, 'user_cancelled')
    // 진행 중이던 도구(최상위 + 서브에이전트 child)를 중단 결과로 정착 — 안 하면 결과가
    // 영영 안 와 "실행 중"으로 무한 렌더되고 부모 Task 가 "진행 중"으로 남는다. turn.aborted 전에.
    settleOpenToolRuns(turn, emitTurn, 'aborted')
    // 중단 턴은 버스 telemetry 없이 끝난다 — 진행 중 assistant 메시지의 content(FTS 캐시)를
    // 여기서 마감 기록한다(0107). settle 의 합성 tool_result 영속 뒤에 와야 한다.
    persistence.finalizeTurn(turn)
    sendChatEvent(turn.owner, {
      type: 'turn.aborted',
      sessionId: req.sessionId,
      reason: 'user_cancelled'
    })
  })

  // 서브에이전트(Task) 단위 중단 — turn 전체가 아니라 한 Agent 도구 호출만 멈춘다(turn 계속).
  // 클릭 즉시 부모/child transcript 를 aborted 로 낙관 정착하고, SDK task_notification(stopped)이
  // 도착하면 같은 toolUseId 로 권위 메타를 보강한다. stopTask 는 task_id 기반 제어 신호일 뿐
  // UI 상태 SSOT 는 합성 tool_result 다.
  handle(CHANNELS.chatStopSubagent, StopSubagentSchema, 'reject', async (req): Promise<void> => {
    const turn = supervisor.getBySession(req.sessionId)
    if (!turn) return
    const taskId = turn.subagentTaskIds.get(req.toolUseId)
    const subagentType = turn.subagentTypes.get(req.toolUseId)
    if (subagentType) turn.blockedSubagents.add(subagentType)
    turn.stoppedSubagents.add(req.toolUseId)
    const trackerSessionId = turn.dbSessionId ?? req.sessionId
    // per-task background 관측(0143) — settled(추적 해제)가 관측까지 지우므로 **해제 전에** 읽는다.
    const alreadyBackground = backgroundTasks.isAsyncLaunched(trackerSessionId, req.toolUseId)
    // 0136 — 사용자 중단은 즉시 추적 해제(아래 합성 settled 는 버스 직행이라 coordinator 의
    // 추적 훅을 지나지 않는다). 늦게 오는 SDK task_notification(stopped)의 해제는 멱등.
    backgroundTasks.settled(trackerSessionId, req.toolUseId)

    // 사용자 자기 행위의 통지는 소음(0143 설계 결정) — background 플래그를 싣지 않아
    // subagent_notice 미생성. 행 상태('중단')와 패널이 이미 결과를 보여준다.
    settleSubagentTask(turn, emitTurn, {
      type: 'subagent.task',
      sessionId: trackerSessionId,
      toolUseId: req.toolUseId,
      phase: 'settled',
      status: 'stopped'
    })

    await stopLiveSubagent(turn.live, req.toolUseId, taskId, alreadyBackground)
  })
}
