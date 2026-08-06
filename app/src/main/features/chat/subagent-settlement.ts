// 서브에이전트 종료 → transcript 권위 tool_result 이벤트 빌더 (순수). 0050 까지 ipc/chat 에
// 있었으나, TurnCoordinator(L1 가로축 구동체, 0052)가 reduce 단계에서 직접 소비하므로 L1
// lifecycle 로 내린다 — L1 은 L3(ipc)를 import 할 수 없기 때문. 기존 import 경로는 ipc/chat
// 의 배럴 re-export 로 무회귀 유지.

import type { NormalizedEvent } from '../../../shared/ipc'

type OpenToolRunInfo = { parentToolRunId?: string }
type OpenToolRunEntries = Iterable<[string, OpenToolRunInfo]>

interface SubagentSettlementInput {
  sessionId: string
  task: Extract<NormalizedEvent, { type: 'subagent.task' }>
  openToolRuns: OpenToolRunEntries
}

function subagentParentResult(
  ev: Extract<NormalizedEvent, { type: 'subagent.task' }>
): { result: unknown; isError: boolean } | null {
  switch (ev.status) {
    case 'stopped':
      return {
        result: { reason: 'aborted', message: '서브에이전트가 중단되었습니다.' },
        isError: true
      }
    case 'failed':
      return {
        result: { reason: 'failed', message: ev.summary ?? '서브에이전트가 실패했습니다.' },
        isError: true
      }
    case 'completed':
      return { result: { summary: ev.summary ?? '' }, isError: false }
    default:
      return null
  }
}

function subagentMetaFrom(ev: Extract<NormalizedEvent, { type: 'subagent.task' }>): {
  subagentMeta?: { durationMs?: number; toolUses?: number }
} {
  if (ev.durationMs === undefined && ev.toolUses === undefined) return {}
  return {
    subagentMeta: {
      ...(ev.durationMs !== undefined ? { durationMs: ev.durationMs } : {}),
      ...(ev.toolUses !== undefined ? { toolUses: ev.toolUses } : {})
    }
  }
}

// 서브에이전트 종료를 transcript 의 권위 tool_result 이벤트들로 변환한다.
// 부모 Agent/Task 는 항상 정착시키고, stopped/failed 인 경우 해당 부모 아래 열린 child 도구도
// aborted 로 정착해 전용 transcript 와 루트 transcript 의 inflight 고착을 동시에 해소한다.
export function createSubagentSettlementEvents({
  sessionId,
  task,
  openToolRuns
}: SubagentSettlementInput): Extract<NormalizedEvent, { type: 'tool.call.completed' }>[] {
  const parent = subagentParentResult(task)
  if (!parent) return []

  const parentId = task.toolUseId
  const events: Extract<NormalizedEvent, { type: 'tool.call.completed' }>[] = [
    {
      type: 'tool.call.completed',
      sessionId,
      toolRunId: parentId,
      result: parent.result,
      isError: parent.isError,
      ...subagentMetaFrom(task)
    }
  ]

  if (!parent.isError) return events

  for (const [toolRunId, info] of openToolRuns) {
    if (toolRunId === parentId || info.parentToolRunId !== parentId) continue
    events.push({
      type: 'tool.call.completed',
      sessionId,
      toolRunId,
      result: { reason: 'aborted', message: '서브에이전트 중단으로 종료됨' },
      isError: true,
      parentToolRunId: parentId
    })
  }

  return events
}

export function coerceStoppedToolCompletion(
  stoppedSubagents: ReadonlySet<string>,
  ev: Extract<NormalizedEvent, { type: 'tool.call.completed' }>
): Extract<NormalizedEvent, { type: 'tool.call.completed' }> {
  if (
    !stoppedSubagents.has(ev.toolRunId) &&
    (ev.parentToolRunId === undefined || !stoppedSubagents.has(ev.parentToolRunId))
  ) {
    return ev
  }
  return {
    ...ev,
    result: { reason: 'aborted', message: '서브에이전트 중단으로 종료됨' },
    isError: true
  }
}
