// 턴 정착(settle) — 턴이 정상 완료 없이 끊길 때(중단·타임아웃·에러·앱 종료) 아직 열려 있는
// 도구 실행/서브에이전트를 합성 tool_result 로 마감한다. 결과가 영영 안 오면 렌더가 "실행 중"
// 으로 무한 렌더되고 부모 Task 가 "진행 중"으로 남기 때문. 0050 까지 ipc/chat/send.ts 에
// 있었으나 TurnCoordinator(reduce 단계)와 cancel/stopSubagent 핸들러·앱 종료 정리(router)가
// 공유하므로 L1 로 내리고 persist/forward 를 주입받는 순수 함수로 만든다(0052).

import type { NormalizedEvent } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import type { TurnEmit } from '../../contracts/bus-events'
import { createSubagentSettlementEvents } from './subagent-settlement'
import type { RuntimeLiveTurn } from '../../contracts/ports'

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

// foreground Task 는 먼저 background control-request 로 루트 턴에서 분리해야 stopTask 가 실제
// 작업 취소로 이어진다. 이미 background 로 시작된 경우에는 불필요한 backgroundTask 를 건너뛴다.
export async function stopLiveSubagent(
  live: RuntimeLiveTurn | null,
  toolUseId: string,
  taskId: string | undefined,
  backgroundSubagents: boolean
): Promise<void> {
  if (!live) return
  if (!backgroundSubagents) {
    await live.backgroundTask(toolUseId).catch(() => false)
  }
  if (!taskId) return
  await live.stopTask(taskId).catch(() => undefined)
}
