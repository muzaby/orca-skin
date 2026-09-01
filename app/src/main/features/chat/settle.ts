// 턴 정착(settle) — 턴이 정상 완료 없이 끊길 때(중단·타임아웃·에러·앱 종료) 아직 열려 있는
// 도구 실행/서브에이전트를 합성 tool_result 로 마감한다. 결과가 영영 안 오면 렌더가 "실행 중"
// 으로 무한 렌더되고 부모 Task 가 "진행 중"으로 남기 때문. 0050 까지 ipc/chat/send.ts 에
// 있었으나 TurnCoordinator(reduce 단계)와 cancel/stopSubagent 핸들러·앱 종료 정리(router)가
// 공유하므로 L1 로 내리고 persist/forward 를 주입받는 순수 함수로 만든다(0052).

import type { NormalizedEvent } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import type { TurnEmit } from '../../contracts/bus-events'
import { createSubagentSettlementEvents } from './subagent-settlement'
import type { GovernedLiveTurn } from '../../contracts/ports'

// 턴 중단/실패 시 아직 열린 도구 실행을 abort/failed 마커 tool_result 로 정착시킨다.
// AskUserQuestion tool_result 합성(flushAskAnswers)과 동형의 보정 — toolRunId 멱등(upsert).
// 합성 이벤트는 turn.event 버스로 방출된다(history 영속 ∥ renderer 중계) — 스트리밍 이벤트와 동일
// 파이프라인. emit 의 fault-isolation(등록순·critical)은 버스가 소유하고, settle 은 순서만 보존한다.
export function settleOpenToolRuns<W>(
  turn: TurnContext<W>,
  emit: TurnEmit<W>,
  kind: 'aborted' | 'failed'
): void {
  if (turn.openToolRuns.size === 0) return
  const result =
    kind === 'aborted'
      ? { reason: 'aborted', message: '사용자가 중단했습니다' }
      : { reason: 'failed', message: '오류로 중단되었습니다' }
  for (const [toolRunId, info] of turn.openToolRuns) {
    const ev = {
      type: 'tool.call.completed',
      sessionId: turn.dbSessionId ?? '',
      toolRunId,
      result,
      isError: true,
      ...(info.parentToolRunId !== undefined ? { parentToolRunId: info.parentToolRunId } : {})
    } as const
    emit(turn, ev)
  }
  turn.openToolRuns.clear()
}

// subagent.task settled(stopped/failed/completed) 수신 또는 사용자 중단 클릭 시 부모 Task 와
// 해당 부모 아래 열린 child 도구를 transcript 권위 tool_result 로 정착한다. SDK stopTask 는 제어
// 신호이고, 이 정착 이벤트들이 루트/전용 transcript 의 UI 상태 SSOT 다.
export function settleSubagentTask<W>(
  turn: TurnContext<W>,
  emit: TurnEmit<W>,
  ev: Extract<NormalizedEvent, { type: 'subagent.task' }>
): void {
  const events = createSubagentSettlementEvents({
    sessionId: turn.dbSessionId ?? ev.sessionId,
    task: ev,
    openToolRuns: turn.openToolRuns
  })
  for (const out of events) {
    emit(turn, out)
    turn.openToolRuns.delete(out.toolRunId)
  }
}

// 추적 중인 백그라운드 서브에이전트 전체를 한 상태로 정착시킨다(0149 — 구 chat-turn 의
// settleDeadBackgroundTasks/stopAndSettleAbortedTasks 쌍둥이 통합). 두 경로의 차이는
// status/summary 와 "실행 중인 태스크를 실제로 중지하는가" 뿐이라 옵션으로 받는다.
//
// 합성 settled 는 **두 번** 흘린다: settleSubagentTask 가 부모 Task/열린 child 를 권위
// tool_result 로 마감하고, 이어지는 emit 이 settled 자체를 버스로 보내 writer 의
// subagent_notice 영속과 renderer transient 메타 갱신이 라이브 경로와 같은 길을 타게 한다.
// 이 순서·쌍 방출이 두 경로에서 갈라지지 않도록 여기 한 곳이 소유한다.
export async function settleTrackedTasks<W>(
  turn: TurnContext<W>,
  emit: TurnEmit<W>,
  sessionId: string,
  tracker: BackgroundTaskSettleSource,
  opts: { status: 'failed' | 'stopped'; summary: string; stopLive: boolean }
): Promise<void> {
  const ids = [...tracker.ids(sessionId)]
  if (ids.length === 0) return
  await settleTaskSubset(turn, emit, sessionId, tracker, ids, opts)
  tracker.clear(sessionId)
}

/**
 * 추적 중인 태스크 **일부**를 정착시킨다 — 나머지 추적은 그대로 남는다(0212 R-04 레벨 REPLACE).
 * 전량 정착(`settleTrackedTasks`)과 방출 순서·쌍을 공유해야 두 경로가 갈라지지 않으므로 같은
 * 루프를 쓴다. 차이는 마감 범위뿐이다 — 여기서는 `clear` 대신 id 별 `settled` 를 부른다.
 */
export async function settleTaskSubset<W>(
  turn: TurnContext<W>,
  emit: TurnEmit<W>,
  sessionId: string,
  tracker: SubsetSettleSource,
  ids: readonly string[],
  opts: { status: 'failed' | 'stopped'; summary: string; stopLive: boolean }
): Promise<void> {
  for (const toolUseId of ids) {
    if (opts.stopLive) {
      await stopLiveSubagent(
        turn.live,
        toolUseId,
        turn.subagentTaskIds.get(toolUseId),
        tracker.isAsyncLaunched(sessionId, toolUseId)
      )
    }
    const settled = {
      type: 'subagent.task',
      sessionId,
      toolUseId,
      phase: 'settled',
      status: opts.status,
      // 턴-후 루프까지 살아남은 추적 = 백그라운드 대기물(0143) — 완료 통지 게이팅.
      background: true,
      summary: opts.summary
    } as const
    settleSubagentTask(turn, emit, settled)
    emit(turn, settled)
    tracker.settled(sessionId, toolUseId)
  }
}

// 부분집합 정착이 트래커에게 요구하는 최소 표면. 대상 id 를 호출부가 주므로 `ids`/`clear` 는
// 필요 없다 — coordinator 의 `BackgroundTaskPort` 가 그대로 만족한다(구조적 포트).
interface SubsetSettleSource {
  isAsyncLaunched(sessionId: string, toolUseId: string): boolean
  settled(sessionId: string, toolUseId: string): void
}

// 전량 정착이 요구하는 표면(구현은 BackgroundTaskTracker).
interface BackgroundTaskSettleSource extends SubsetSettleSource {
  ids(sessionId: string): ReadonlySet<string>
  clear(sessionId: string): void
}

// foreground Task 는 먼저 background control-request 로 루트 턴에서 분리해야 stopTask 가 실제
// 작업 취소로 이어진다. 이미 background 로 시작된 경우에는 불필요한 backgroundTask 를 건너뛴다.
// alreadyBackground(0143) — 전역 플래그가 아니라 **per-task async_launched 영수증 관측 여부**
// (BackgroundTaskTracker.isAsyncLaunched)를 받는다: 관측됨 = 이미 백그라운드 task 로 분리돼
// stopTask 직행, 미관측(foreground 또는 영수증 이전) = backgroundTask 선행(보수적 현행 동작).
export async function stopLiveSubagent(
  live: GovernedLiveTurn | null,
  toolUseId: string,
  taskId: string | undefined,
  alreadyBackground: boolean
): Promise<void> {
  if (!live) return
  if (!alreadyBackground) {
    await live.backgroundTask(toolUseId).catch(() => false)
  }
  if (!taskId) return
  await live.stopTask(taskId).catch(() => undefined)
}
