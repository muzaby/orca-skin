// 턴 실행 + 턴-후 루프 (0179 에서 분해).
//
// 최초 턴을 돌리고, 끝나면 남은 일이 있는지 판정해 **자동 연속 턴**으로 잇는다(0067 AC7·0143).
// 세 스텝뿐이다 — `listen`(백그라운드 태스크를 기다리며 프레임만 소비) · `flush`(held 예약을
// 다음 프롬프트로) · `break`(종료). 판정 자체는 순수 모듈(`features/chat/post-turn`)이 갖고,
// 여기는 그 판정에 따른 실행·정착·신호만 한다.

import type { WebContents } from 'electron'
import type { SteerFlushBatch, TurnRequest } from '../../adapters/turn'
import type { TurnContext } from '../../contracts/turn'
import type { TurnCoordinator } from '../../features/chat/turn-coordinator'
import type { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import type { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import type { SessionActivityProjector } from '../../features/chat/session-activity-projector'
import { decidePostTurnStep, postTurnHoldsSession } from '../../features/chat/post-turn'
import type { SessionRuntime } from '../../features/sessions/session-runtime'
import type { RuntimeSupervisor } from '../../features/sessions/supervisor'
import type { SessionChainLease } from '../../features/sessions/session-chain-lease'
import { getLogger } from '../../infra/log'
import { buildFlushRequest, buildListenRequest, type ContinuationSettings } from './continuation'
import { makeContinuationTurn } from './turn-context'

interface PostTurnDeps {
  coordinator: TurnCoordinator<WebContents>
  runtime: SessionRuntime
  lease: SessionChainLease<WebContents>
  supervisor: RuntimeSupervisor<WebContents>
  activity: SessionActivityProjector
  pendingMessages: PendingMessageQueue
  backgroundTasks: BackgroundTaskTracker
  /** 세션 키별 listen 프레임 릴리즈 밸브 — busy send 예약이 즉시 연속 턴으로 전환시킨다. */
  listenRelease: Map<string, () => void>
  prepareContinuation: (
    sessionId: string
  ) => Promise<ContinuationSettings & { shouldRespawn: boolean }>
  settleDeadBackgroundTasks: (turn: TurnContext<WebContents>, sessionId: string) => Promise<void>
  stopAndSettleAbortedTasks: (turn: TurnContext<WebContents>, sessionId: string) => Promise<void>
  getActiveTurn: () => TurnContext<WebContents>
  setActiveTurn: (turn: TurnContext<WebContents>) => void
  setInitialBatches: (batches: SteerFlushBatch[]) => void
}

export async function runTurnWithContinuations(
  deps: PostTurnDeps,
  turn: TurnContext<WebContents>,
  request: TurnRequest,
  boundProjectId: string | null
): Promise<void> {
  const { coordinator, runtime, lease, supervisor, activity, pendingMessages, backgroundTasks } =
    deps

  // listen phase 레벨 신호(0143) — renderer 의 listening 상태(inflight 지속·send=steer 라우팅)를
  // 구동한다. 개별 listen 턴 경계가 아니라 **턴-후 루프 스코프**로 started 1회/ended 1회 —
  // 연속 listen 턴·중간 held-flush 연속 턴을 관통해 깜빡임을 없앤다. sendChatEvent 직행(버스
  // 미경유)이라 history/usage 는 구조적으로 못 본다(미영속 — message.queued 동렬).
  let listenPhaseSessionId: string | null = null
  const beginListenPhase = (sessionId: string): void => {
    if (listenPhaseSessionId) return
    listenPhaseSessionId = sessionId
    activity.setTransport(sessionId, 'listening')
  }
  const endListenPhase = (): void => {
    if (!listenPhaseSessionId) return
    const sessionId = listenPhaseSessionId
    listenPhaseSessionId = null
    activity.setTransport(sessionId, 'idle')
  }

  try {
    await coordinator.run(turn, request, { boundProjectId })
    // 자동 연속 턴(0067 AC7) — 턴 종료 시 held 잔여(어시스턴트 턴 중 예약됐으나 게이트를 못
    // 만난 메시지)를 즉시 다음 턴으로 잇는다. 사용자 개입 없음. 명시 취소(controller abort)
    // 시에는 발동하지 않는다 — 중단 버튼이 held 를 이미 drain(draft 복원)했다.
    // 0136/0143 — held 가 없어도 미정착 백그라운드 태스크가 살아 있으면 listen 턴(입력 push
    // 없는 프레임 소비)으로 CLI 자동 턴(진행·task_notification·완료 알림 턴)을 라이브 배달한다.
    while (
      !lease.controller.signal.aborted &&
      !deps.getActiveTurn().controller.signal.aborted &&
      deps.getActiveTurn().dbSessionId
    ) {
      const activeTurn = deps.getActiveTurn()
      const sessionId = activeTurn.dbSessionId!
      // 채널이 죽었으면 in-process 백그라운드 태스크도 소멸 — 정착·정리(고착 방지, 0136).
      if (!runtime.channelAlive) {
        await deps.settleDeadBackgroundTasks(activeTurn, sessionId)
        if (lease.controller.signal.aborted) break
      }
      // 다음 스텝 판정(순수, 0143) — pushTurn 은 "CLI 유휴 + 백로그 없음" 채널에서만.
      // 미확정 예약(0154) — pending() 은 held 만 반환하므로 "CLI 에 넘겨놓고 echo 를 기다리는
      // 중" 이라는 상태는 별도로 읽어야 한다. 이 입력이 없어서 턴 체인이 그 상태를 못 보고 끊겼다.
      const haveUnconfirmed = pendingMessages.hasSubmitted(sessionId)
      const pendingMessageCount = pendingMessages.pending(sessionId).length
      const taskCount = backgroundTasks.count(sessionId)
      const channelBusy = runtime.channelBusy
      const hasBacklog = runtime.hasUnframedBacklog
      const step = decidePostTurnStep({
        havePending: pendingMessageCount > 0,
        haveTasks: taskCount > 0,
        channelAlive: runtime.channelAlive,
        channelBusy,
        hasBacklog,
        haveUnconfirmed
      })
      getLogger()
        .child('chat')
        .info('chat.postturn.step', {
          sessionId,
          step,
          havePending: pendingMessageCount > 0,
          haveTasks: taskCount > 0,
          haveUnconfirmed,
          channelBusy,
          hasBacklog,
          taskCount,
          pendingMessageCount
        })
      // 세션 점유 신호(0153 F1) — `listen` 뿐 아니라 `flush`(held 를 연속 턴으로 잇는 경로)도
      // main 은 busy 다. 구 구조는 listen 스텝에서만 신호를 보내 renderer 가 이 구간을 idle 로
      // 오판했고, 그 창의 send 가 낙관 커밋 경로를 타 **잔여보다 앞에** 렌더됐다. 판정은
      // post-turn 의 순수 함수가 소유한다.
      if (postTurnHoldsSession(step)) beginListenPhase(sessionId)

      if (step === 'break') {
        // 턴 체인 종료(0151 AC7 → 0154 개정) — 확정 신호가 오지 않은 예약을 orphaned 로 내려
        // **관측 가능하게만** 한다. 폐기하지 않는다. push 된 배치는 `priority:'next'` 로 CLI
        // 큐에 살아 있고 CLI 는 다음 턴 프롬프트로 정상 픽업한다 — 재주입(이중 전달)도
        // 폐기(유실)도 답이 아니고 옳은 것은 **기다리는 것**이다. 회수는 CLI 큐가 실제로
        // 사라지는 시점(채널 사망 → takeForRespawn / 세션 폐기 → dispose)이 맡는다.
        const orphaned = pendingMessages.orphanUnconfirmed(sessionId, lease.chainId)
        if (orphaned.length > 0) {
          getLogger()
            .child('chat')
            .info('chat.steer.orphaned', { sessionId, count: orphaned.length })
        }
        break
      }

      if (step === 'listen') {
        // 유예를 1라운드로 묶는다(0154) — listen 을 여는 김에 미확정 예약을 orphaned 로 강등한다.
        // 강등해도 늦은 echo 는 여전히 확정할 수 있고(confirm 의 open 술어가 orphaned 포함),
        // haveUnconfirmed 는 submitted 만 세므로 다음 평가에서 break 에 정상 도달한다.
        if (haveUnconfirmed) pendingMessages.orphanUnconfirmed(sessionId, lease.chainId)
        const continuation = await deps.prepareContinuation(sessionId)
        if (lease.controller.signal.aborted || deps.getActiveTurn().controller.signal.aborted) {
          break
        }
        if (continuation.shouldRespawn) runtime.teardownChannel()
        const listenTurn = makeContinuationTurn(deps.getActiveTurn())
        supervisor.startResume(sessionId, listenTurn)
        deps.setActiveTurn(listenTurn)
        const listenRequest = buildListenRequest({
          base: request,
          sessionId,
          signal: listenTurn.controller.signal,
          continuation
        })
        // busy send 릴리즈 밸브 — 예약(held) 적재 직후 listen 프레임을 닫아 즉시 전환(0136).
        // CLI 가 자동 턴 진행 중이면 no-op(0143 유예) — terminal 자연 마감 후 루프가 flush.
        deps.listenRelease.set(sessionId, () => runtime.endListenFrame())
        try {
          await coordinator.run(listenTurn, listenRequest, { boundProjectId, kind: 'listen' })
        } finally {
          deps.listenRelease.delete(sessionId)
          supervisor.release(listenTurn)
        }
        // 사용자 중단(0143, 사용자 확정) — 대기 종료와 함께 실행 중 태스크도 중지·정착한다.
        if (listenTurn.controller.signal.aborted) {
          await deps.stopAndSettleAbortedTasks(listenTurn, sessionId)
        }
        continue
      }

      // flush — 0126: 연속 턴 settings 신선도 재판정. providerKey 는 원 턴 키로 고정(선택
      // 변경은 다음 사용자 send 부터, 0119)하고 settings blob 만 재해석한다. 내용이 다르면
      // teardown — 아래 channelAlive 분기가 채널-사망 경로(takeForRespawn)로 자연 전환된다.
      const continuation = await deps.prepareContinuation(sessionId)
      if (lease.controller.signal.aborted || deps.getActiveTurn().controller.signal.aborted) break
      if (continuation.shouldRespawn) runtime.teardownChannel()
      let contPreludes: SteerFlushBatch[] = []
      let batch: SteerFlushBatch | undefined
      if (runtime.channelAlive) {
        // 채널 생존 — held 병합 단일 배치(D4 1버블)를 pushTurn 프롬프트로. 게이트 flush 와
        // 같은 메서드지만 여기서는 **턴 프롬프트**라 origin 이 다르다(0151 AC1 — 확정 신호가
        // echo 가 아니라 첫 모델 출력).
        batch = pendingMessages.reserveHeld(sessionId, 'turn-open', undefined, lease.chainId)
      } else {
        // 채널 사망 — respawn 이월 전체를 회수해 마지막을 본 프롬프트, 앞을 프렐류드로.
        const leftovers = pendingMessages.takeForRespawn(sessionId, lease.chainId)
        batch = leftovers.pop()
        contPreludes = leftovers
      }
      if (!batch) break
      deps.setInitialBatches([...contPreludes, batch])
      const contTurn = makeContinuationTurn(deps.getActiveTurn())
      supervisor.startResume(sessionId, contTurn)
      deps.setActiveTurn(contTurn)
      const contRequest = buildFlushRequest({
        base: request,
        sessionId,
        signal: contTurn.controller.signal,
        batch,
        preludes: contPreludes,
        continuation
      })
      try {
        await coordinator.run(contTurn, contRequest, { boundProjectId })
      } finally {
        supervisor.release(contTurn)
      }
    }
  } finally {
    // listen phase 종료 신호(0143) — 정상 종료·break·중단·throw 전 경로에서 renderer 의
    // listening 상태를 반드시 내린다.
    endListenPhase()
  }
}
