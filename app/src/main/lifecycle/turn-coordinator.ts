// TurnCoordinator — §A 가로축(turn pipeline)의 1급 구동체. 한 SessionRuntime 의 NormalizedEvent
// 스트림을 소비(consume)하고, 턴-로컬 상태를 reduce 하며, 두 개의 *병렬 독립 sink* (persist ∥
// forward)로 팬아웃한다. retry 정책·stall 타이머·중단/실패 정착(settle)·terminal 합성도 여기서
// 소유한다. 권한은 단계가 아니라 canUseTool 재진입 콜백(request.requestApproval)이므로 코디네이터
// 는 그 콜백을 그대로 통과시키고, 승인 대기 중 stall pause(beginApprovalPause)만 중계한다.
//
// 레이어: L1 lifecycle. L3(persist·forward·title)를 import 하지 않고 turn-sinks 인터페이스로
// 주입받아 의존을 하향으로 유지한다(src/main/AGENTS.md). 컴포지션 루트(ipc/chat/send.ts)가
// concrete 를 배선한다. 0050 까지 ipc/chat/send.ts:handleChatSend 에 인라인이던 가로축을 동작
// 보존(behavior-preserving)으로 추출했다 — 0051 §A staging P1, handoff 0052.

import type { ClassifiedError, NormalizedEvent } from '../../shared/ipc'
import type { TurnRequest } from '../extensions/types'
import { makeClassifiedError } from '../runtime-errors/classifier'
import type { TurnContext } from './turn-context'
import type { RuntimeLiveTurn } from './ports'
import type { SessionRuntimeRegistry } from './session-registry'
import { createStallTimer, type StallTimer } from './timers'
import { coerceStoppedToolCompletion } from './subagent-settlement'
import { settleOpenToolRuns, settleSubagentTask, stopLiveSubagent } from './settle'
import type { TurnEventSink, TurnPersistSink, TurnTitleHook } from './turn-sinks'
import type { SteerQueue } from './steer-queue'

export const MAX_RETRIES = 2
export const RETRY_BACKOFF_MS = [1_000, 2_000] as const

// retry backoff 대기 — 턴 abort 시 즉시 reject 해 무의미한 대기를 끊는다.
export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Aborted'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('Aborted'))
      },
      { once: true }
    )
  })
}

// 코디네이터가 구동하는 런타임 표면 — OneShotSessionRuntime 이 구조적으로 만족한다.
// send() 1회 = adapter attempt 1회. retry(외부 재시도)는 코디네이터가 소유한다.
export interface CoordinatorRuntime extends RuntimeLiveTurn {
  send(req: TurnRequest): AsyncIterable<NormalizedEvent>
}

// 동시 턴 자원 회계(프로젝트별) — orchestration ConcurrencyRegistry 가 만족.
export interface ConcurrencyGate {
  increment(projectId: string | null): void
  decrement(projectId: string | null): void
}

export interface TurnCoordinatorDeps<W> {
  runtime: CoordinatorRuntime
  persist: TurnPersistSink<W>
  forward: TurnEventSink<W>
  titles: TurnTitleHook<W>
  registry: Pick<SessionRuntimeRegistry<W>, 'promote'>
  classifyError: (err: unknown, phase: string) => ClassifiedError
  concurrency: ConcurrencyGate
  backgroundSubagents: boolean
  steerQueue?: SteerQueue
}

export class TurnCoordinator<W = unknown> {
  // 현재 attempt 의 stall 타이머 — requestApproval(루프 바깥 스코프)이 승인 대기 중 pause 할 수
  // 있도록 인디렉션으로 보관한다. 동시 보류(서브에이전트 병렬 승인)는 beginPause refcount 가 처리.
  private activeStall: StallTimer | null = null

  // 모델이 대기 입력을 받아들이는 경계(claude=PostToolBatch)가 발화했다는 표식. 훅 콜백은 SDK
  // 쪽 실행 흐름이라 그 자리에서 persist 하면 아직 이 루프에 도달하지 못한 tool_result 보다
  // steer 버블이 위로 올라간다 → 플래그만 세우고 커밋은 루프가(= 단일 제어 흐름) 수행한다.
  private boundaryPending = false

  constructor(private readonly deps: TurnCoordinatorDeps<W>) {}

  cancelSteer(sessionId: string, id: string): boolean {
    const item = this.deps.steerQueue?.cancel(sessionId, id)
    return item != null
  }

  // 아직 커밋되지 않은 steer 피드백이 있는가 — 어댑터가 result→telemetry 를 continuation 으로
  // 태깅할지 판정하는 술어. 커밋되면 큐가 비므로 false 가 되어 그 턴은 정상 종료한다.
  private hasPendingSteer(turn: TurnContext<W>): boolean {
    const sessionId = turn.dbSessionId
    const { steerQueue } = this.deps
    if (!sessionId || !steerQueue) return false
    return steerQueue.pending(sessionId).length > 0
  }

  // 소비 경계에서 pending steer 를 **일반 커밋 사용자 메시지**로 굳힌다(0059 요구 3·4).
  // 큐 전체를 하나로 병합(drainForFlush)하므로 버블은 항상 1개다.
  //
  // 호출 시점이 정렬의 전부다 — 이 함수가 telemetry 의 persist∥forward **뒤**에 불려야
  // [응답-전][steer user][응답-후] 가 DB·라이브 양쪽에서 같아진다(handoff 0060 §5).
  private commitSteer(turn: TurnContext<W>): void {
    const sessionId = turn.dbSessionId
    const { steerQueue, persist, forward } = this.deps
    if (!sessionId || !steerQueue) return
    const flush = steerQueue.drainForFlush(sessionId)
    if (!flush) return
    const messageId = persist.persistSteerUserMessage?.(turn, flush.text, flush.createdAt)
    if (messageId == null) return
    forward.forward(turn.owner, {
      type: 'steer.flushed',
      sessionId,
      ids: flush.ids,
      text: flush.text,
      messageId,
      createdAt: flush.createdAt
    })
  }

  // 승인 보류 동안 stall 타이머 멈춤 — 사용자 판단 시간이 stall 로 오판돼 턴이 abort 되지 않게.
  // release 로 재개(동시 N건은 refcount 라 마지막 해소 시에만). attempt 진행 전이면 no-op.
  beginApprovalPause(): (() => void) | undefined {
    return this.activeStall?.beginPause()
  }

  // 턴 정착 — 어떤 경로로 끝나든(정상·에러·중단) 남은 pending steer 를 사용자 메시지로 커밋한다.
  // 이미 SDK 입력 스트림으로 전달된 텍스트이므로 provider transcript 에는 존재한다 → 버리면 우리
  // DB 에만 없는 desync 가 되고, 다음 턴 첫 커밋에 옛 텍스트가 섞이는 누수도 남는다(사용자 결정).
  private finalizeSteer(turn: TurnContext<W>): void {
    this.boundaryPending = false
    this.commitSteer(turn)
  }

  async run(
    turn: TurnContext<W>,
    request: TurnRequest,
    opts: { boundProjectId: string | null }
  ): Promise<void> {
    try {
      await this.runTurn(turn, request, opts)
    } finally {
      this.finalizeSteer(turn)
    }
  }

  private async runTurn(
    turn: TurnContext<W>,
    request: TurnRequest,
    opts: { boundProjectId: string | null }
  ): Promise<void> {
    const { runtime, persist, forward, titles, registry, classifyError, concurrency } = this.deps
    const { backgroundSubagents } = this.deps
    const { boundProjectId } = opts

    for (let attempt = 0; ; attempt += 1) {
      let eventsReceived = 0
      let sawTerminal = false
      const idle = createStallTimer(turn)
      this.activeStall = idle
      try {
        // send() 가 query() 를 즉시 시작하므로 try 안에서 호출 — 동기 throw 도 동일 경로로 분류.
        turn.live = runtime
        const events = runtime.send({
          ...request,
          onModelCallBoundary: () => {
            request.onModelCallBoundary?.()
            this.boundaryPending = true
          },
          hasPendingSteer: () => request.hasPendingSteer?.() ?? this.hasPendingSteer(turn)
        })
        concurrency.increment(boundProjectId)
        try {
          idle.reset()
          for await (const rawEv of events) {
            // 소비 경계가 지나갔다면 *이 이벤트를 처리하기 전에* 커밋한다 — 경계 시점까지 방출된
            // 이벤트(그 배치의 tool_result 등)는 이미 처리됐고, 이후 파트는 steer 버블 아래로 간다.
            if (this.boundaryPending) {
              this.boundaryPending = false
              this.commitSteer(turn)
            }
            const ev =
              rawEv.type === 'tool.call.completed'
                ? coerceStoppedToolCompletion(turn.stoppedSubagents, rawEv)
                : rawEv
            eventsReceived += 1
            idle.reset()
            // continuation telemetry 는 sub-turn 경계 — 턴은 아직 끝나지 않았다(handoff 0060).
            if (
              (ev.type === 'telemetry' && ev.continuation !== true) ||
              ev.type === 'error' ||
              ev.type === 'turn.aborted'
            ) {
              sawTerminal = true
            }
            // persist ∥ forward — 두 sink 는 병렬 독립. persist 가 먼저(main-side·renderer 비의존),
            // session.updated 면 그 사이에 제목 생성 트리거, forward 후 새-채팅 pending 턴 승격.
            persist.persist(turn, ev)
            if (ev.type === 'session.updated') titles.maybeStart(turn)
            forward.forward(turn.owner, ev)
            // 응답 경계 — 어시스턴트 메시지가 방금 마감(persist)되고 렌더러도 잔여 라이브 텍스트를
            // 굳힌 뒤라, 여기서 커밋해야 steer 버블이 그 응답 **뒤**에 놓인다(양쪽 동일 정렬).
            if (ev.type === 'telemetry') {
              this.boundaryPending = false
              this.commitSteer(turn)
            }
            if (ev.type === 'session.updated') {
              registry.promote(turn, ev.sessionId)
            }
            // AskUserQuestion tool 호출 도착 → id 페어링 큐 적재 + 답변 매칭 시도(answers 는 SDK
            // 가 스트림으로 안 돌려주므로 합성). tool_use id 가 답변보다 먼저 올 수도 있다.
            if (ev.type === 'tool.call.started' && ev.toolName === 'AskUserQuestion') {
              turn.askPendingIds.push(ev.toolRunId)
              persist.flushAskAnswers(turn, turn.owner)
            }
            // 서브에이전트(Task) task_id 매핑 — stopSubagent 가 toolUseId 로 찾는다. 이미 중단
            // 클릭된 서브에이전트면 도착 즉시 라이브 정지.
            if (ev.type === 'subagent.task' && ev.taskId) {
              turn.subagentTaskIds.set(ev.toolUseId, ev.taskId)
              if (turn.stoppedSubagents.has(ev.toolUseId)) {
                void stopLiveSubagent(turn.live, ev.toolUseId, ev.taskId, backgroundSubagents)
              }
            }
            // subagent_type 매핑 — 재호출 차단(blockedSubagents)에 쓸 타입.
            if (ev.type === 'subagent.task' && ev.subagentType) {
              turn.subagentTypes.set(ev.toolUseId, ev.subagentType)
            }
            // settled(foreground/background 공통 권위 종료) → 부모 Task 와 열린 child 정착.
            if (ev.type === 'subagent.task' && ev.phase === 'settled') {
              settleSubagentTask(
                turn,
                persist,
                forward,
                turn.stoppedSubagents.has(ev.toolUseId) ? { ...ev, status: 'stopped' } : ev
              )
            }
            // 열린 도구 추적 — 중단/타임아웃 시 합성 결과로 정착할 대상(settleOpenToolRuns).
            if (ev.type === 'tool.call.started') {
              turn.openToolRuns.set(
                ev.toolRunId,
                ev.parentToolRunId !== undefined ? { parentToolRunId: ev.parentToolRunId } : {}
              )
            } else if (ev.type === 'tool.call.completed') {
              turn.openToolRuns.delete(ev.toolRunId)
            }
          }
        } finally {
          concurrency.decrement(boundProjectId)
        }
        // 스트림이 terminal 없이 끝났고 abort 도 아니면 합성 telemetry 로 턴을 마감(영속+forward).
        if (!sawTerminal && !turn.controller.signal.aborted) {
          const ev = {
            type: 'telemetry',
            sessionId: turn.dbSessionId ?? request.sessionId ?? ''
          } as const
          persist.persist(turn, ev)
          forward.forward(turn.owner, ev)
        }
        return
      } catch (err) {
        if (runtime.cancelled === true && turn.controller.signal.aborted) return
        if (runtime.timedOut === true) {
          sawTerminal = true
          settleOpenToolRuns(turn, persist, forward, 'aborted')
          forward.forward(turn.owner, {
            type: 'error',
            ...(turn.dbSessionId ? { sessionId: turn.dbSessionId } : {}),
            error: makeClassifiedError('stream_error', '응답이 없어 턴을 중단했습니다.', {
              retryable: true
            })
          })
          return
        }
        const error = classifyError(err, 'sendMessage')
        if (
          error.retryable &&
          eventsReceived === 0 &&
          attempt < MAX_RETRIES &&
          !turn.controller.signal.aborted
        ) {
          forward.forward(turn.owner, {
            type: 'turn.retrying',
            ...(turn.dbSessionId ? { sessionId: turn.dbSessionId } : {}),
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            error
          })
          try {
            await abortableDelay(RETRY_BACKOFF_MS[attempt] ?? 2_000, turn.controller.signal)
          } catch {
            return
          }
          continue
        }
        // 어댑터 소유 분류기(0016) — provider 는 어댑터가 자기 id 로 채운다. 표시용, 분기 미사용.
        sawTerminal = true
        settleOpenToolRuns(turn, persist, forward, 'failed')
        forward.forward(turn.owner, {
          type: 'error',
          ...(turn.dbSessionId ? { sessionId: turn.dbSessionId } : {}),
          error
        })
        return
      } finally {
        idle.clear()
        this.activeStall = null
      }
    }
  }
}
