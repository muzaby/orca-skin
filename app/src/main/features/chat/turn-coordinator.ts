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

import type { ClassifiedError, NormalizedEvent } from '../../../shared/ipc'
import type { TurnRequest } from '../../adapters/turn'
import { makeClassifiedError } from '../../infra/errors'
import type { TurnContext } from '../../contracts/turn'
import type { RuntimeLiveTurn } from '../../contracts/ports'
import { createStallTimer, type StallTimer } from './timers'
import { coerceStoppedToolCompletion } from './subagent-settlement'
import { settleOpenToolRuns, settleSubagentTask, stopLiveSubagent } from './settle'
import type { TurnEventSink, TurnPersistSink } from './turn-sinks'
import type { MainBus, TurnEmit } from '../../contracts/bus-events'
import type { PendingMessageQueue } from './pending-message-queue'

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
  // 스트리밍/합성 이벤트의 단일 팬아웃 — usage 집계·history 영속·renderer 중계 구독자가 등록순 소비.
  bus: MainBus<W>
  // persist/forward 는 버스를 타지 않는 경로에만 직접 쓴다: steer flush·Ask 답변 합성(persist),
  // 합성 error·turn.retrying·steer.flushed(forward, 영속 안 함).
  persist: TurnPersistSink<W>
  forward: TurnEventSink<W>
  // 세션 승격 포트 — 새 세션 첫 턴의 pending→bySession 전환만 필요(전체 레지스트리 아님).
  // 구조적 타입으로 features/sessions 직접 참조를 끊는다(수직 슬라이스 경계, 0062).
  registry: { promote(turn: TurnContext<W>, sessionId: string): void }
  classifyError: (err: unknown, phase: string) => ClassifiedError
  activeTurns: ActiveTurnGate
  backgroundSubagents: boolean
  pendingMessages?: PendingMessageQueue
}

export class TurnCoordinator<W = unknown> {
  // 현재 attempt 의 stall 타이머 — requestApproval(루프 바깥 스코프)이 승인 대기 중 pause 할 수
  // 있도록 인디렉션으로 보관한다. 동시 보류(서브에이전트 병렬 승인)는 beginPause refcount 가 처리.
  private activeStall: StallTimer | null = null

  constructor(private readonly deps: TurnCoordinatorDeps<W>) {}

  // 스트리밍/합성 이벤트를 turn.event 버스로 방출한다. critical 구독자(usage·history) throw 는
  // 그대로 전파돼 턴 실패(catch → settle → error)로 이어진다 — persist 실패=턴 실패 현행 보존.
  private emit(turn: TurnContext<W>, ev: NormalizedEvent): void {
    this.deps.bus.emit('turn.event', { turn, ev })
  }

  // settle(중단/실패 정착) 경로용 fault-isolated emit — 이미 에러 처리/종료 정리 중이라
  // 구독자 throw 를 격리해 정착 루프가 끊기지 않게 한다(shutdown 의 try/catch 와 동형).
  private readonly settleEmit: TurnEmit<W> = (turn, ev) => {
    try {
      this.emit(turn, ev)
    } catch (err) {
      console.warn('[settle] turn.event 방출 실패(격리):', err)
    }
  }

  cancelSteer(sessionId: string, id: string): boolean {
    const item = this.deps.pendingMessages?.cancel(sessionId, id)
    return item != null
  }

  // user echo(input.echo) 관측 → 해당 steer 배치를 소비로 표시한다. echo 는 CLI 가 stdin
  // 주입 입력을 자기 컨텍스트로 흡수(drain)한 순간의 유일한 정밀 신호(명세 §6.1, handoff 0060
  // D1) — 0060 의 경계 관찰 근사(최상위 tool.call.completed settle/telemetry)를 대체한다.
  // uuid(게이트 flush 시 실은 pending queue 배치 uuid, D3·D4) 매칭 1차, echo 의 uuid 미보존 대비
  // 병합 텍스트 폴백. 매칭 실패(초기 프롬프트 echo 등)는 무시 — 허위 커밋이 구조적으로 불가능하다.
  private markSteerConsumed(turn: TurnContext<W>, ev: { uuid?: string; text: string }): void {
    const sessionId = turn.dbSessionId
    if (!sessionId) return
    this.deps.pendingMessages?.markConsumed(sessionId, {
      ...(ev.uuid !== undefined ? { uuid: ev.uuid } : {}),
      text: ev.text
    })
  }

  // 소비 확정분만 병합 flush(persist∥forward). echo 배치가 끝난 지점에서 호출된다 — 미소비
  // pending 은 남겨 턴 종료 후 다음 chat:send 이월(carryover)로 넘긴다(0060 D2: 모델이 못 본
  // 텍스트를 committed 로 굳히지 않는다).
  private flushConsumedSteer(turn: TurnContext<W>): void {
    const sessionId = turn.dbSessionId
    const { pendingMessages, persist, forward } = this.deps
    if (!sessionId || !pendingMessages) return
    const flush = pendingMessages.drainConsumed(sessionId)
    if (!flush) return
    const messageId = persist.persistSteerUserMessage?.(turn, flush.text, Date.now())
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

  async run(
    turn: TurnContext<W>,
    request: TurnRequest,
    opts: { boundProjectId: string | null }
  ): Promise<void> {
    const { runtime, persist, forward, registry, classifyError, activeTurns } = this.deps
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
            // input.echo — main 내부 steer 커밋 신호(renderer 미전달·미영속). 소비 표시만 하고
            // 다음 이벤트로 넘어간다. echo 는 drain 배치 동안 연속으로 오므로(명세 §6.2), 실제
            // flush 는 배치가 끝난 첫 비-echo 이벤트에서 일괄 수행된다(0059 요구 4 단일 버블 유지).
            if (ev.type === 'input.echo') {
              this.markSteerConsumed(turn, ev)
              continue
            }
            // echo 배치 종료 지점 — 소비 확정분을 이 이벤트의 persist *전에* flush 해 DB 정렬
            // [응답-전][steer user][응답-후] 를 보존한다(persistSteerUserMessage 가 진행 중
            // assistant 를 마감·리셋). telemetry 만 예외로 persist 후 flush — usage messageId
            // 링크·assistant 마감이 끝난 뒤여야 한다(0060).
            if (ev.type !== 'telemetry') this.flushConsumedSteer(turn)
            if (ev.type === 'telemetry' || ev.type === 'error' || ev.type === 'turn.aborted') {
              sawTerminal = true
            }
            // 단일 팬아웃 — 버스가 등록순(usage→history→title→relay)으로 동기 소비한다. usage 가
            // history 의 reset 전에 messageId 를 읽고, title 이 relay 전에 트리거되는 순서 불변식은
            // bootstrap 의 등록 순서가 소유한다. promote 는 emit 반환 후(=relay 후) 실행 — 동기
            // emit 이라 "forward 후 새-채팅 pending 턴 승격" 순서가 자동 보존된다.
            // 핸드오프 자동 메시지 에코는 send 수리 직후(턴 시작 전)에 처리한다(0064 r4) —
            // SDK init 지연 시 압축 요약이 에코보다 먼저 렌더되는 역순을 구조적으로 차단.
            this.emit(turn, ev)
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
                this.settleEmit,
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
            // telemetry(턴 종료)는 persist 이후에 소비 확정분을 flush — usage messageId 링크와
            // assistant 마감을 보존한다. 미소비 pending 은 여기서도 flush 하지 않는다(D2).
            if (ev.type === 'telemetry') this.flushConsumedSteer(turn)
          }
        } finally {
          activeTurns.decrement(boundProjectId)
        }
        // 스트림이 terminal 없이 끝났고 abort 도 아니면 합성 telemetry 로 턴을 마감(버스 팬아웃).
        if (!sawTerminal && !turn.controller.signal.aborted) {
          const ev = {
            type: 'telemetry',
            sessionId: turn.dbSessionId ?? request.sessionId ?? ''
          } as const
          this.emit(turn, ev)
          // 스트림이 경계 없이 끝났어도 *소비 확정분* 은 flush 한다. 미소비 pending 은 큐에
          // 남긴다 — 모델이 못 본 텍스트를 committed 로 굳히지 않고 다음 chat:send 로 이월(D2).
          this.flushConsumedSteer(turn)
        }
        return
      } catch (err) {
        if (runtime.cancelled === true && turn.controller.signal.aborted) return
        if (runtime.timedOut === true) {
          sawTerminal = true
          settleOpenToolRuns(turn, this.settleEmit, 'aborted')
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
        settleOpenToolRuns(turn, this.settleEmit, 'failed')
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
