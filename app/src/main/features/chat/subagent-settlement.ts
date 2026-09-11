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
      // `message` 는 건드리지 않는다 — 사용자 중단 행의 표시 문구는 UI 가 소유하고(0204 AT-31
      // 이 그것을 잠갔다) 여기 문장은 transcript 용 기본값이다.
      //
      // SDK 가 준 사유는 **별도 키**로 싣는다(0212 AT-21). `killed` 는 사용자가 멈춘 것이
      // 아니라서 `patch.error` 가 유일한 원인 서술인데, 그것을 `message` 에 덮으면 사용자
      // 중단 행까지 생산자 문장으로 바뀐다 — 두 사건이 같은 자리를 쓰면 하나가 다른 하나를
      // 가린다. 키를 가르면 소비자가 "UI 문구가 기본, 사유가 있으면 사유" 를 표현할 수 있다.
      return {
        result: {
          reason: 'aborted',
          message: '서브에이전트가 중단되었습니다.',
          ...(ev.summary !== undefined ? { cause: ev.summary } : {})
        },
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

// 부모 도구 결과를 **합성해도 되는** 종류인가(0230 §10 EP-06).
//
// 에이전트는 자기 결과가 런치 영수증(`async_launched`)이라 종료 시점에 권위 결과를 합성해야
// 한다. 셸·감시·워크플로는 **이미 자기 tool_result 를 돌려줬다** — stdout·`taskId`·`runId` 가
// 거기 있고, 같은 `toolRunId` 로 결과를 한 번 더 내면 `resultMap` 이 마지막을 이겨 그것들을
// `{summary:''}` 로 덮는다.
//
// **판정은 "에이전트인가" 가 아니라 "에이전트가 아님이 확인됐는가" 다.** 종류 미확인
// (`taskKind` 부재 · `'unknown'`)에서 합성을 막으면 종류를 못 읽은 에이전트 카드가 영원히
// 실행 중으로 남는다 — 그 회귀는 이 게이트가 막으려는 결함보다 나쁘다. 미확인은 현행(합성)을
// 유지하고, 셸을 셸로 읽었을 때만 비운다.
function settlementOverwritesOwnResult(task: SubagentSettlementInput['task']): boolean {
  return task.taskKind === 'shell' || task.taskKind === 'monitor' || task.taskKind === 'workflow'
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
  const emitsParentResult = !settlementOverwritesOwnResult(task)
  const events: Extract<NormalizedEvent, { type: 'tool.call.completed' }>[] = emitsParentResult
    ? [
        {
          type: 'tool.call.completed',
          sessionId,
          toolRunId: parentId,
          result: parent.result,
          isError: parent.isError,
          ...subagentMetaFrom(task)
        }
      ]
    : []

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
