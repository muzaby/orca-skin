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
import { wireLog } from '../../infra/ipc/wire-log'
import { getLogger } from '../../infra/log/registry'
import type { TurnContext } from '../../contracts/turn'
import type { GovernedLiveTurn } from '../../contracts/ports'
import { createStallTimer, type StallTimer } from './timers'
import { turnPolicyFor, type TurnKind } from './turn-policy'
import type { BackgroundTaskPort } from './background-tasks'
import { isAsyncLaunchedPayload } from '../../../shared/subagent'
import { coerceStoppedToolCompletion } from './subagent-settlement'
import { settleOpenToolRuns, settleSubagentTask, stopLiveSubagent } from './settle'
import type { TurnEventSink, TurnPersistSink } from './turn-sinks'
import type { MainBus, TurnEmit } from '../../contracts/bus-events'
import type { PendingMessageQueue } from './pending-message-queue'

export const MAX_RETRIES = 2
export const RETRY_BACKOFF_MS = [1_000, 2_000] as const

// "응답이 시작됐다" 판정 집합(0069) — 턴-시작 배치(프렐류드+프롬프트)의 소비 앵커. 델타
// (transient)도 포함한다: 소비 *증거* 는 영속 여부와 무관하고, 커밋은 어차피 같은 이벤트의
// persist 직전(commitConsumed)에 돈다. 서브에이전트 child 출력은 부모 tool.call.started
// (집합 포함)보다 늦으므로 앵커 누락이 없다.
const MODEL_OUTPUT_EVENTS = new Set<string>([
  'message.delta',
  'message.reasoning.delta',
  'message.reasoning',
  'message.completed',
  'tool.call.started'
])

// listen 턴(0136)용 no-op stall 타이머 — 백그라운드 태스크 대기는 장시간 무이벤트가 정상이라
// stall abort 로 오판하지 않는다. 회수는 사용자 취소(중단 버튼)·busy-send 릴리즈 밸브·owner
// 소멸 경로가 담당한다.
const NOOP_STALL_TIMER: StallTimer = {
  reset: () => {},
  clear: () => {},
  beginPause: () => () => {}
}

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
// `interrupt` 는 ManagedRuntime 과 같은 이유로 좁힌다(0151) — 런타임 거버넌스의 중단은 "턴 중단
// 표시" 이고, SDK 영수증(still_queued)은 onInterruptReceipt 위임으로 별도 전달된다.
export interface CoordinatorRuntime extends GovernedLiveTurn {
  send(req: TurnRequest): AsyncIterable<NormalizedEvent>
  // listen 턴(0136) — 입력을 push 하지 않고 살아있는 채널의 프레임만 열어 CLI 가 스스로 여는
  // 자동 턴(백그라운드 서브에이전트 진행·task_notification·완료 알림 턴)을 소비한다. 어댑터
  // 계약(TurnRequest)의 모드 플래그가 아니라 런타임의 1급 능력이다(0149) — 어댑터가 결코 읽지
  // 않는 `listen` 불리언을 TurnRequest 에 싣는 대신 별도 메서드로 분리한다.
  listen(req: TurnRequest): AsyncIterable<NormalizedEvent>
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
  pendingMessages?: PendingMessageQueue
  // 세션별 미정착 백그라운드 서브에이전트 추적 포트(0136) — started/settled 를 이벤트 루프에서
  // 갱신하고, chat-turn 의 턴-후 루프가 listen 턴 개시 조건으로 조회한다.
  backgroundTasks: BackgroundTaskPort
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
      getLogger()
        .child('chat')
        .warn('chat.turn-event.emit-failed', {
          isolated: true,
          phase: 'settle',
          message: String(err)
        })
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
    // 0151 — 신호를 종류로 실어 보낸다. 큐가 origin(steer/turn-open)과 대조해 **짝이 맞는 배치만**
    // 확정하므로, 늦게 도착한 턴-시작 echo 가 무해한 것이 우연이 아니라 구조적 거부가 된다.
    // uuid 가 실려 오면 큐는 uuid 로만 판정한다(텍스트 동일 배치 오확정 차단).
    this.deps.pendingMessages?.confirm(sessionId, {
      kind: 'echo',
      ...(ev.uuid !== undefined ? { uuid: ev.uuid } : {}),
      text: ev.text
    })
  }

  // 소비 확정 배치를 배치 단위로 커밋(persist∥forward) — echo 배치가 끝난 지점에서 호출된다.
  // 턴 프롬프트·프렐류드·steer 게이트 배치가 전부 이 단일 경로로 user row 영속 + renderer
  // 승격(message.committed)된다(0067 AC6). 미소비 pending 은 남긴다(D2: 모델이 못 본 텍스트를
  // committed 로 굳히지 않는다).
  private commitConsumed(turn: TurnContext<W>): void {
    const sessionId = turn.dbSessionId
    const { pendingMessages, persist, forward } = this.deps
    if (!sessionId || !pendingMessages) return
    for (const batch of pendingMessages.drainConfirmed(sessionId)) {
      const messageId = persist.commitUserMessage?.(turn, {
        text: batch.text,
        createdAt: batch.createdAt,
        ...(batch.attachmentViews ? { attachmentViews: batch.attachmentViews } : {})
      })
      if (messageId == null) continue
      forward.forward(turn.owner, {
        type: 'message.committed',
        sessionId,
        ids: batch.ids,
        text: batch.text,
        ...(batch.attachmentViews ? { attachmentViews: batch.attachmentViews } : {}),
        messageId,
        createdAt: batch.createdAt
      })
    }
  }

  // 승인 보류 동안 stall 타이머 멈춤 — 사용자 판단 시간이 stall 로 오판돼 턴이 abort 되지 않게.
  // release 로 재개(동시 N건은 refcount 라 마지막 해소 시에만). attempt 진행 전이면 no-op.
  beginApprovalPause(): (() => void) | undefined {
    return this.activeStall?.beginPause()
  }

  async run(
    turn: TurnContext<W>,
    request: TurnRequest,
    opts: { boundProjectId: string | null; kind?: TurnKind }
  ): Promise<void> {
    const { runtime, persist, forward, registry, classifyError, activeTurns } = this.deps
    const { boundProjectId } = opts
    // 턴 종류별 정책은 turn-policy 단일 지점이 소유한다(0149) — stall 무장·동시 턴 계상·입력 push.
    const kind: TurnKind = opts.kind ?? 'user'
    const policy = turnPolicyFor(kind)

    // chat 턴 경계(0124 카탈로그) — started/completed/failed/cancelled 메타만 기록(원문 금지).
    // correlationId 는 chat-turn 의 runWithLogContext 컨텍스트에서 자동 주입된다(AC4).
    const log = getLogger().child('chat')
    const turnStartedAt = Date.now()
    let lastUsage: { model?: string; inputTokens?: number; outputTokens?: number } | undefined
    const turnMeta = (): Record<string, unknown> => ({
      ...((turn.dbSessionId ?? request.sessionId)
        ? { sessionId: turn.dbSessionId ?? request.sessionId }
        : {}),
      durationMs: Date.now() - turnStartedAt
    })
    log.info('chat.turn.started', {
      ...(request.sessionId ? { sessionId: request.sessionId } : {}),
      ...(request.model !== undefined ? { model: request.model } : {}),
      // listen 턴(0136) — 입력 없는 백그라운드 소비 턴 관측 구분.
      ...(kind === 'listen' ? { listen: true } : {})
    })

    // 턴-시작 배치(프렐류드+프롬프트)는 **응답 시작 = 소비 증거**(0069, 사용자 확정) — 모델이
    // 출력을 냈다는 것은 턴을 연 입력을 이미 봤다는 뜻이다(CLI 는 턴 시작에 프렐류드+프롬프트를
    // coalesce 소비, 명세 C9). echo 를 기다리지 않으므로 user row 가 항상 첫 영속 어시스턴트
    // 파트보다 먼저 커밋된다(도구-first 턴의 재로드 정렬 창 소멸 — 0068 실측: echo 는 모델 출력
    // 시작 이후 도착). steer(mid-turn 게이트 flush)는 응답 진행이 소비 증거가 못 되므로(D2)
    // echo 가 유일한 신호로 유지된다. 늦게 도착하는 턴-시작 echo 는 consumed 배치 매칭 실패로
    // 무해(markConsumed 는 미소비만 매칭).
    const turnOpenUuids = [
      ...(request.preludes?.map((batch) => batch.uuid) ?? []),
      ...(request.promptUuid !== undefined ? [request.promptUuid] : [])
    ]
    let turnOpenConsumed = turnOpenUuids.length === 0

    for (let attempt = 0; ; attempt += 1) {
      let eventsReceived = 0
      let sawTerminal = false
      // listen 턴은 stall 미무장(0136) — 백그라운드 대기의 장시간 침묵을 '응답 없음'으로 오판해
      // 채널을 interrupt 하지 않는다.
      const idle = policy.armStall ? createStallTimer(turn) : NOOP_STALL_TIMER
      this.activeStall = idle
      try {
        // send() 가 query() 를 즉시 시작하므로 try 안에서 호출 — 동기 throw 도 동일 경로로 분류.
        turn.live = runtime
        const events = policy.pushesInput ? runtime.send(request) : runtime.listen(request)
        // listen 턴(0143)은 동시 턴 회계에 계상하지 않는다 — 백그라운드 대기는 사용자 관점의
        // "진행 중 작업" 이 아니라 수신 대기라, 프로젝트 동시 턴 경고를 오점화하지 않는다.
        if (policy.countsAsActive) activeTurns.increment(boundProjectId)
        try {
          idle.reset()
          for await (const rawEv of events) {
            const coerced =
              rawEv.type === 'tool.call.completed'
                ? coerceStoppedToolCompletion(turn.stoppedSubagents, rawEv)
                : rawEv
            // settled background enrich(0143) — async_launched 영수증이 관측된 태스크의 권위
            // 정착에 background:true 를 실어 renderer 완료 통지·writer 영속(subagent_notice)의
            // 권위 신호로 삼는다. 트래커 해제(아래)보다 먼저 판정해야 하며, 해제 후 지각 도착한
            // 중복 settled 는 관측이 이미 사라져 미부여된다(통지 중복 차단).
            const ev =
              coerced.type === 'subagent.task' &&
              coerced.phase === 'settled' &&
              turn.dbSessionId &&
              this.deps.backgroundTasks.isAsyncLaunched(turn.dbSessionId, coerced.toolUseId)
                ? { ...coerced, background: true }
                : coerced
            eventsReceived += 1
            idle.reset()
            // input.echo — main 내부 steer 커밋 신호(renderer 미전달·미영속). 소비 표시만 하고
            // 다음 이벤트로 넘어간다. echo 는 drain 배치 동안 연속으로 오므로(명세 §6.2), 실제
            // flush 는 배치가 끝난 첫 비-echo 이벤트에서 일괄 수행된다(0059 요구 4 단일 버블 유지).
            if (ev.type === 'input.echo') {
              // input.echo 는 renderer 미전달이라 sendChatEvent 의 wire 기록(ipc.wire.event)에 안
              // 잡힌다 — echo↔어시스턴트 스트림 순서 실측(0068 AC7)을 위해 여기서 직접 남긴다.
              wireLog('input.echo', { uuid: ev.uuid, text: ev.text.slice(0, 80) })
              this.markSteerConsumed(turn, ev)
              continue
            }
            // 턴-시작 배치 소비 판정(0069) — 첫 모델 출력 관측 시 프렐류드+프롬프트를 일괄
            // 소비 표시한다. 바로 아래 commitConsumed 가 같은 이벤트의 persist 전에 커밋한다.
            if (!turnOpenConsumed && turn.dbSessionId && MODEL_OUTPUT_EVENTS.has(ev.type)) {
              this.deps.pendingMessages?.confirm(turn.dbSessionId, {
                kind: 'model-output',
                uuids: turnOpenUuids
              })
              turnOpenConsumed = true
            }
            // echo 배치 종료 지점 — 소비 확정분을 이 이벤트의 persist *전에* flush 해 DB 정렬
            // [응답-전][steer user][응답-후] 를 보존한다(persistSteerUserMessage 가 진행 중
            // assistant 를 마감·리셋). telemetry 만 예외로 persist 후 flush — usage messageId
            // 링크·assistant 마감이 끝난 뒤여야 한다(0060).
            if (ev.type !== 'telemetry') this.commitConsumed(turn)
            if (ev.type === 'telemetry' || ev.type === 'error' || ev.type === 'turn.aborted') {
              sawTerminal = true
            }
            if (ev.type === 'telemetry' && ev.usage) {
              lastUsage = {
                ...(ev.usage.model !== undefined ? { model: ev.usage.model } : {}),
                ...(ev.usage.inputTokens !== undefined
                  ? { inputTokens: ev.usage.inputTokens }
                  : {}),
                ...(ev.usage.outputTokens !== undefined
                  ? { outputTokens: ev.usage.outputTokens }
                  : {})
              }
            }
            // 단일 팬아웃 — 버스가 등록순(usage→history→title→relay)으로 동기 소비한다. usage 가
            // history 의 reset 전에 messageId 를 읽고, title 이 relay 전에 트리거되는 순서 불변식은
            // bootstrap 의 등록 순서가 소유한다. promote 는 emit 반환 후(=relay 후) 실행 — 동기
            // emit 이라 "forward 후 새-채팅 pending 턴 승격" 순서가 자동 보존된다.
            // 핸드오프 자동 메시지 에코는 send 수리 직후(턴 시작 전)에 처리한다(0064 r4) —
            // SDK init 지연 시 압축 요약이 에코보다 먼저 렌더되는 역순을 구조적으로 차단.
            this.emit(turn, ev)
            if (ev.type === 'session.updated') {
              // 세션 id 확정 — 새 세션의 pending queue 키(clientKey)를 실 id 로 재바인딩해
              // 이후 echo 매칭(markSteerConsumed = dbSessionId 키)이 성립하게 한다(0067 AC9).
              if (turn.queueKey && turn.queueKey !== ev.sessionId) {
                this.deps.pendingMessages?.rekey(turn.queueKey, ev.sessionId)
              }
              registry.promote(turn, ev.sessionId)
            }
            // AskUserQuestion tool 호출 도착 → id 페어링 큐 적재 + 답변 매칭 시도(answers 는 SDK
            // 가 스트림으로 안 돌려주므로 합성). tool_use id 가 답변보다 먼저 올 수도 있다.
            if (ev.type === 'tool.call.started' && ev.toolName === 'AskUserQuestion') {
              turn.askPendingIds.push(ev.toolRunId)
              persist.flushAskAnswers(turn, turn.owner)
            }
            // 백그라운드 태스크 추적(0136) — started 등록 / settled 해제. chat-turn 턴-후 루프의
            // listen 턴 개시 조건 소스. foreground 태스크도 started→settled 가 턴 안에서 왕복해
            // 자연 소거된다.
            if (ev.type === 'subagent.task' && turn.dbSessionId) {
              if (ev.phase === 'started') {
                this.deps.backgroundTasks.started(turn.dbSessionId, ev.toolUseId)
              } else if (ev.phase === 'settled') {
                this.deps.backgroundTasks.settled(turn.dbSessionId, ev.toolUseId)
              }
            }
            // 서브에이전트(Task) task_id 매핑 — stopSubagent 가 toolUseId 로 찾는다. 이미 중단
            // 클릭된 서브에이전트면 도착 즉시 라이브 정지.
            if (ev.type === 'subagent.task' && ev.taskId) {
              turn.subagentTaskIds.set(ev.toolUseId, ev.taskId)
              if (turn.stoppedSubagents.has(ev.toolUseId)) {
                void stopLiveSubagent(
                  turn.live,
                  ev.toolUseId,
                  ev.taskId,
                  // per-task 관측(0143) — 영수증이 확인된 태스크만 backgroundTask 선행을 생략.
                  turn.dbSessionId
                    ? this.deps.backgroundTasks.isAsyncLaunched(turn.dbSessionId, ev.toolUseId)
                    : false
                )
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
              // 부모 Task 의 권위 결과(비-런치 영수증) 도착도 정착으로 본다(0136) — foreground
              // 에이전트가 task_notification 없이 끝나는 경로의 추적 고착 방지. 일반 도구 id 는
              // 추적에 없어 no-op. 런치 영수증(async_launched)은 아직 실행 중 — 해제하지 않고
              // **background 확정 관측**으로 기록한다(0143 — stop 분기·settled enrich 의 신호).
              if (turn.dbSessionId) {
                if (isAsyncLaunchedPayload(ev.result)) {
                  this.deps.backgroundTasks.markAsyncLaunched(turn.dbSessionId, ev.toolRunId)
                } else {
                  this.deps.backgroundTasks.settled(turn.dbSessionId, ev.toolRunId)
                }
              }
            }
            // telemetry(턴 종료)는 persist 이후에 소비 확정분을 flush — usage messageId 링크와
            // assistant 마감을 보존한다. 미소비 pending 은 여기서도 flush 하지 않는다(D2).
            if (ev.type === 'telemetry') this.commitConsumed(turn)
          }
        } finally {
          if (policy.countsAsActive) activeTurns.decrement(boundProjectId)
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
          this.commitConsumed(turn)
        }
        if (turn.controller.signal.aborted) log.info('chat.turn.cancelled', turnMeta())
        else log.info('chat.turn.completed', { ...turnMeta(), ...lastUsage })
        return
      } catch (err) {
        if (runtime.cancelled === true && turn.controller.signal.aborted) {
          log.info('chat.turn.cancelled', turnMeta())
          return
        }
        if (runtime.timedOut === true) {
          sawTerminal = true
          settleOpenToolRuns(turn, this.settleEmit, 'aborted')
          log.error('chat.turn.failed', undefined, { ...turnMeta(), reason: 'stall' })
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
        // ClassifiedError 의 category/message 만 — 원문 cause 는 serializeError 경유(redaction 통과).
        log.error('chat.turn.failed', err, { ...turnMeta(), category: error.category })
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
