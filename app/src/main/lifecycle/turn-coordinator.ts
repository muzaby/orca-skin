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

// 프로젝트별 active turn 회계 포트 — lifecycle ActiveTurnTracker 가 만족.
// RuntimeSupervisor 의 active+idle runtime cap count 와 섞지 않는다.
export interface ActiveTurnGate {
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
  activeTurns: ActiveTurnGate
  backgroundSubagents: boolean
  steerQueue?: SteerQueue
}

export class TurnCoordinator<W = unknown> {
  // 현재 attempt 의 stall 타이머 — requestApproval(루프 바깥 스코프)이 승인 대기 중 pause 할 수
  // 있도록 인디렉션으로 보관한다. 동시 보류(서브에이전트 병렬 승인)는 beginPause refcount 가 처리.
  private activeStall: StallTimer | null = null

  constructor(private readonly deps: TurnCoordinatorDeps<W>) {}

  cancelSteer(sessionId: string, id: string): boolean {
    const item = this.deps.steerQueue?.cancel(sessionId, id)
    return item != null
  }

  // pending steer 를 flush 할 turn 경계인가. agent 가 큐된 입력을 자기 컨텍스트로 흡수하는
  // 지점을 관찰로 근사한다(orca 는 SDK 서브프로세스에 agentic 루프를 위임하므로 turn head 를
  // 직접 소유하지 않고 이벤트 스트림을 관찰만 한다 — handoff 0060).
  //  - telemetry: 턴 종료(도구 없는 텍스트-only 턴의 경계).
  //  - tool.call.completed(최상위): 도구/서브에이전트 취합 완료 = agent 가 continuation 직전.
  //    서브에이전트 내부 도구(parentToolRunId 있음)는 부모 경계가 아니다(opencode §7.5 불투명성).
  //    병렬 최상위 도구 배치는 전부 settle(최상위 open 잔여 0)된 뒤에만 경계로 본다(조기 flush 방지).
  private isSteerFlushBoundary(turn: TurnContext<W>, ev: NormalizedEvent): boolean {
    if (ev.type === 'telemetry') return true
    if (ev.type !== 'tool.call.completed' || ev.parentToolRunId !== undefined) return false
    for (const info of turn.openToolRuns.values()) {
      if (info.parentToolRunId === undefined) return false
    }
    return true
  }

  private consumeSteerForInput(turn: TurnContext<W>): string | undefined {
    const sessionId = turn.dbSessionId
    const { steerQueue, persist, forward } = this.deps
    if (!sessionId || !steerQueue) return undefined
    const flush = steerQueue.drainForFlush(sessionId)
    if (!flush) return undefined
    const messageId = persist.persistSteerUserMessage?.(turn, flush.text, Date.now())
    if (messageId == null) return undefined
    forward.forward(turn.owner, {
      type: 'steer.flushed',
      sessionId,
      ids: flush.ids,
      text: flush.text,
      messageId,
      createdAt: flush.createdAt
    })
    return flush.text
  }

  // 승인 보류 동안 stall 타이머 멈춤 — 사용자 판단 시간이 stall 로 오판돼 턴이 abort 되지 않게.
  // release 로 재개(동시 N건은 refcount 라 마지막 해소 시에만). attempt 진행 전이면 no-op.
  beginApprovalPause(): (() => void) | undefined {
    return this.activeStall?.beginPause()
  }

  async run(
    turn: TurnContext<W>,
    request: TurnRequest,
    opts: { boundProjectId: string | null }
  ): Promise<void> {
    const { runtime, persist, forward, titles, registry, classifyError, activeTurns } = this.deps
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
        const events = runtime.send(request)
        activeTurns.increment(boundProjectId)
        try {
          idle.reset()
          for await (const rawEv of events) {
            const ev =
              rawEv.type === 'tool.call.completed'
                ? coerceStoppedToolCompletion(turn.stoppedSubagents, rawEv)
                : rawEv
            eventsReceived += 1
            idle.reset()
            if (ev.type === 'telemetry' || ev.type === 'error' || ev.type === 'turn.aborted') {
              sawTerminal = true
            }
            // persist ∥ forward — 두 sink 는 병렬 독립. persist 가 먼저(main-side·renderer 비의존),
            // session.updated 면 그 사이에 제목 생성 트리거, forward 후 새-채팅 pending 턴 승격.
            persist.persist(turn, ev)
            if (ev.type === 'session.updated') titles.maybeStart(turn)
            forward.forward(turn.owner, ev)
            // 핸드오프 자동 메시지 에코는 send 수리 직후(턴 시작 전)로 이동했다(0062 r4) —
            // SDK init 지연 시 압축 요약이 에코보다 먼저 렌더되는 역순을 구조적으로 차단.
            if (ev.type === 'session.updated') registry.promote(turn, ev.sessionId)
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
            // pending steer 를 agent 가 흡수하는 turn 경계에서만 flush 한다(handoff 0060).
            // 입력 push(pull) 즉시가 아니라 최상위 도구/서브에이전트 취합 완료 또는 턴 종료에서.
            // persist 이후(telemetry 는 usage messageId 링크·assistant 마감이 끝난 뒤) 실행해
            // DB 정렬 [응답][steer user][continuation] 을 보존한다.
            if (this.isSteerFlushBoundary(turn, ev)) this.consumeSteerForInput(turn)
          }
        } finally {
          activeTurns.decrement(boundProjectId)
        }
        // 스트림이 terminal 없이 끝났고 abort 도 아니면 합성 telemetry 로 턴을 마감(영속+forward).
        if (!sawTerminal && !turn.controller.signal.aborted) {
          const ev = {
            type: 'telemetry',
            sessionId: turn.dbSessionId ?? request.sessionId ?? ''
          } as const
          persist.persist(turn, ev)
          forward.forward(turn.owner, ev)
          // 도구·telemetry 경계를 못 본 채 스트림이 끝났어도 잔여 pending steer 는 flush(유실 방지).
          this.consumeSteerForInput(turn)
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
