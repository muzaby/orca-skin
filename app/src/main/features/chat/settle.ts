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
import { isBackgroundTerminal, type BackgroundSessionState } from '../../../shared/background-task'
import type { HostNonExecutionKind } from '../../../shared/tool-outcome'

// 정착에서 제외할 열린 실행 — 현재 세대의 백그라운드·원격 호출, 태스크를 기다리는 호출,
// live 포함·`isBackgrounded:true` 태스크의 부모 호출과 그 후손(0231). 이들은 턴이 끝나도 계속
// 실행되므로 합성 결과로 덮지 않는다. 상태를 받지 못하면(세션 id 미확정) 빈 집합이다.
function preservedToolRuns<W>(
  turn: TurnContext<W>,
  background: BackgroundSessionState | undefined
): Set<string> {
  const preserved = new Set<string>()
  if (!background) return preserved
  for (const call of Object.values(background.calls)) {
    if (
      call.generation === background.generation &&
      !isBackgroundTerminal(call.status) &&
      (call.awaitingTask || call.mode === 'background' || call.mode === 'remote')
    )
      preserved.add(call.toolUseId)
  }
  for (const task of Object.values(background.tasks)) {
    if (
      task.generation === background.generation &&
      !isBackgroundTerminal(task.status) &&
      task.toolUseId &&
      (task.liveMembership === 'included' || task.isBackgrounded === true)
    )
      preserved.add(task.toolUseId)
  }
  let changed = true
  while (changed) {
    changed = false
    const links = [...turn.openToolRuns.entries()].map(
      ([id, info]) => [id, info.parentToolRunId] as const
    )
    for (const call of Object.values(background.calls))
      if (call.generation === background.generation)
        links.push([call.toolUseId, call.parentToolUseId])
    for (const [id, parent] of links)
      if (parent && preserved.has(parent) && !preserved.has(id)) {
        preserved.add(id)
        changed = true
      }
  }
  return preserved
}

// 턴 중단/실패 시 아직 열린 도구 실행을 abort/failed 마커 tool_result 로 정착시킨다.
// AskUserQuestion tool_result 합성(flushAskAnswers)과 동형의 보정 — toolRunId 멱등(upsert).
// 합성 이벤트는 turn.event 버스로 방출된다(history 영속 ∥ renderer 중계) — 스트리밍 이벤트와 동일
// 파이프라인. emit 의 fault-isolation(등록순·critical)은 버스가 소유하고, settle 은 순서만 보존한다.
export function settleOpenToolRuns<W>(
  turn: TurnContext<W>,
  emit: TurnEmit<W>,
  kind: 'aborted' | 'failed',
  background?: BackgroundSessionState
): void {
  if (turn.openToolRuns.size === 0) return
  const preserved = preservedToolRuns(turn, background)
  const result =
    kind === 'aborted'
      ? { reason: 'aborted', message: '사용자가 중단했습니다' }
      : { reason: 'failed', message: '오류로 중단되었습니다' }
  for (const [toolRunId, info] of turn.openToolRuns) {
    if (preserved.has(toolRunId)) continue
    const ev = {
      type: 'tool.call.completed',
      sessionId: turn.dbSessionId ?? '',
      toolRunId,
      result,
      isError: true,
      ...(info.parentToolRunId !== undefined ? { parentToolRunId: info.parentToolRunId } : {})
    } as const
    emit(turn, ev)
    turn.openToolRuns.delete(toolRunId)
  }
}

// 결과 없이 끝난 도구의 host 정착(0239 D-004·D-006·D-015) — 이벤트 종류만 고르는 순수 선별.
//   no_result  턴 terminal 직전. 보존 집합 밖의 열린 실행을 **부모 상태와 관계없이** 고른다.
//              상태를 받지 못하면(세션 id 미확정) 백그라운드 여부를 알 수 없어 부모 있는
//              실행은 남긴다.
//   retracted  SDK 공개 철회 신호가 지목한 id 중 **아직 열린 것만** 고른다. 결과가 이미 온 도구의
//              실행 사실은 지우지 않는다(D-006).
export function orphanToolRunIds<W>(
  turn: TurnContext<W>,
  cause: HostNonExecutionKind,
  background: BackgroundSessionState | undefined,
  only?: readonly string[]
): string[] {
  if (cause === 'retracted') {
    const wanted = new Set(only ?? [])
    return [...turn.openToolRuns.keys()].filter((id) => wanted.has(id))
  }
  const preserved = preservedToolRuns(turn, background)
  const out: string[] = []
  for (const [toolRunId, info] of turn.openToolRuns) {
    if (preserved.has(toolRunId)) continue
    if (!background && info.parentToolRunId !== undefined) continue
    out.push(toolRunId)
  }
  return out
}

// 고른 실행을 `실행되지 않음` 결과로 정착한다. 결과 본문은 고정 문구 1개이고 사유는
// `nonExecution:{source:'host'}` 가 싣는다 — 표시 분류는 사유만 본다(D-009).
export function settleOrphanToolRuns<W>(
  turn: TurnContext<W>,
  emit: TurnEmit<W>,
  cause: HostNonExecutionKind,
  background: BackgroundSessionState | undefined,
  only?: readonly string[]
): void {
  if (turn.openToolRuns.size === 0) return
  for (const toolRunId of orphanToolRunIds(turn, cause, background, only)) {
    const info = turn.openToolRuns.get(toolRunId)
    if (!info) continue
    emit(turn, {
      type: 'tool.call.completed',
      sessionId: turn.dbSessionId ?? '',
      toolRunId,
      result: { reason: 'not_executed', message: '실행되지 않았습니다' },
      isError: true,
      ...(info.parentToolRunId !== undefined ? { parentToolRunId: info.parentToolRunId } : {}),
      nonExecution: { source: 'host', kind: cause }
    })
    turn.openToolRuns.delete(toolRunId)
  }
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
// alreadyBackground(0143) — 전역 플래그가 아니라 **태스크별 정본 판정**
// (BackgroundTaskTracker.isAsyncLaunched)을 받는다: 백그라운드 = 이미 분리돼 stopTask 직행,
// 아니면(foreground 또는 정본 관측 이전) backgroundTask 선행(보수적 현행 동작).
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
