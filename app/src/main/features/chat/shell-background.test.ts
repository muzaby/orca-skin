// 0230 VP-02 · VP-04 · VP-07 (R-02·R-04 ↔ AT-03·AT-04·AT-07 · §10 EP-03·EP-06)
//
// 두 불변식을 잠근다.
//   ① 셸 런치 영수증은 추적을 **해제하지 않는다** — 해제하면 턴-후 루프가 종료를 안 기다린다.
//   ② 셸 정착은 부모 `tool.call.completed` 를 **합성하지 않는다** — 합성하면 stdout 을 덮는다.

import { describe, expect, it } from 'vitest'
import { BackgroundTaskTracker } from './background-tasks'
import { createSubagentSettlementEvents } from './subagent-settlement'
import { stopSubagentTask } from './stop-subagent'
import { readLaunchReceipt } from '../../../shared/task-kind'
import type { NormalizedEvent } from '../../../shared/ipc'

const SESSION = 's1'

// `turn-coordinator` 의 `tool.call.completed` 분기와 **같은 술어**를 같은 순서로 돈다.
// 코디네이터 전체를 세우지 않고 그 판정만 재현한다 — 판정이 EP-03 의 대상이다.
function applyToolCompletion(
  tracker: BackgroundTaskTracker,
  ev: { toolRunId: string; result?: unknown; structuredOutput?: unknown }
): void {
  if (readLaunchReceipt(ev)) tracker.markAsyncLaunched(SESSION, ev.toolRunId)
  else tracker.settled(SESSION, ev.toolRunId)
}

describe('0230 AT-03/AT-04 — 셸 영수증은 추적을 유지한다', () => {
  it('AT-03: backgroundTaskId 결과가 도착해도 추적이 줄지 않는다', () => {
    const tracker = new BackgroundTaskTracker()
    tracker.started(SESSION, 'sh1', 'shell')
    expect(tracker.count(SESSION)).toBe(1)

    applyToolCompletion(tracker, {
      toolRunId: 'sh1',
      result: 'partial stdout',
      structuredOutput: { shellBackground: { taskId: 'bg-1' } }
    })

    expect(tracker.count(SESSION)).toBe(1)
    expect(tracker.isAsyncLaunched(SESSION, 'sh1')).toBe(true)
  })

  it('AT-04: 이어서 정착이 오면 그때 추적에서 빠진다', () => {
    const tracker = new BackgroundTaskTracker()
    tracker.started(SESSION, 'sh1', 'shell')
    applyToolCompletion(tracker, {
      toolRunId: 'sh1',
      result: 'partial stdout',
      structuredOutput: { shellBackground: { taskId: 'bg-1' } }
    })

    tracker.settled(SESSION, 'sh1')

    expect(tracker.count(SESSION)).toBe(0)
  })

  it('음성 대조: 영수증 없는 셸 결과는 현행대로 추적을 해제한다', () => {
    const tracker = new BackgroundTaskTracker()
    tracker.started(SESSION, 'sh2', 'shell')

    applyToolCompletion(tracker, { toolRunId: 'sh2', result: 'done' })

    expect(tracker.count(SESSION)).toBe(0)
  })

  it('회귀: 에이전트 영수증(async_launched)은 종전대로 추적을 유지한다', () => {
    const tracker = new BackgroundTaskTracker()
    tracker.started(SESSION, 'ag1', 'agent')

    applyToolCompletion(tracker, { toolRunId: 'ag1', result: { status: 'async_launched' } })

    expect(tracker.count(SESSION)).toBe(1)
    expect(tracker.isAsyncLaunched(SESSION, 'ag1')).toBe(true)
  })

  it('kindOf 는 started 가 실은 종류를 돌려주고, 미관측이면 undefined 다', () => {
    const tracker = new BackgroundTaskTracker()
    tracker.started(SESSION, 'sh3', 'shell')
    tracker.started(SESSION, 'nk1')
    expect(tracker.kindOf(SESSION, 'sh3')).toBe('shell')
    expect(tracker.kindOf(SESSION, 'nk1')).toBeUndefined()
  })

  it('종류는 뒤늦게 채워지되 덮어쓰이지 않는다(순서 역전)', () => {
    const tracker = new BackgroundTaskTracker()
    tracker.started(SESSION, 'sh4')
    tracker.started(SESSION, 'sh4', 'shell')
    expect(tracker.kindOf(SESSION, 'sh4')).toBe('shell')
    tracker.started(SESSION, 'sh4', 'agent')
    expect(tracker.kindOf(SESSION, 'sh4')).toBe('shell')
  })
})

const settled = (
  taskKind: 'agent' | 'shell' | 'monitor' | 'workflow' | 'unknown' | undefined,
  status: 'completed' | 'failed' | 'stopped'
): Extract<NormalizedEvent, { type: 'subagent.task' }> => ({
  type: 'subagent.task',
  sessionId: SESSION,
  toolUseId: 'p1',
  phase: 'settled',
  status,
  ...(taskKind !== undefined ? { taskKind } : {})
})

describe('0230 AT-07 — 셸 정착은 부모 결과를 합성하지 않는다', () => {
  it('AT-07: shell 정착의 부모 이벤트가 0건이다', () => {
    const events = createSubagentSettlementEvents({
      sessionId: SESSION,
      task: settled('shell', 'completed'),
      openToolRuns: []
    })
    expect(events.filter((e) => e.toolRunId === 'p1')).toHaveLength(0)
  })

  it('실패 정착에서도 부모 결과는 없고, 열린 child 는 종전대로 정착한다', () => {
    const events = createSubagentSettlementEvents({
      sessionId: SESSION,
      task: settled('shell', 'failed'),
      openToolRuns: [['c1', { parentToolRunId: 'p1' }]]
    })
    expect(events.filter((e) => e.toolRunId === 'p1')).toHaveLength(0)
    expect(events.filter((e) => e.toolRunId === 'c1')).toHaveLength(1)
  })

  it('monitor·workflow 도 자기 결과를 이미 돌려줬으므로 같다', () => {
    for (const kind of ['monitor', 'workflow'] as const) {
      const events = createSubagentSettlementEvents({
        sessionId: SESSION,
        task: settled(kind, 'completed'),
        openToolRuns: []
      })
      expect(events.filter((e) => e.toolRunId === 'p1')).toHaveLength(0)
    }
  })

  it('회귀: agent 정착은 종전대로 부모 결과를 합성한다', () => {
    const events = createSubagentSettlementEvents({
      sessionId: SESSION,
      task: settled('agent', 'completed'),
      openToolRuns: []
    })
    expect(events.filter((e) => e.toolRunId === 'p1')).toHaveLength(1)
  })

  it('종류 미확인은 합성을 막지 않는다 — 에이전트 카드 고착이 더 나쁜 회귀다', () => {
    for (const kind of [undefined, 'unknown'] as const) {
      const events = createSubagentSettlementEvents({
        sessionId: SESSION,
        task: settled(kind, 'completed'),
        openToolRuns: []
      })
      expect(events.filter((e) => e.toolRunId === 'p1')).toHaveLength(1)
    }
  })
})

describe('0230 §10 EP-06 전수 — 정착 생산 지점이 모두 종류를 싣는다', () => {
  // 게이트(`createSubagentSettlementEvents`)가 옳아도 **종류를 안 실어 보내는 생산자**가 하나
  // 있으면 그 경로에서만 stdout 이 덮인다. 실제로 `stop-subagent.ts` 의 watchdog 정착이
  // 그랬다 — 구현 턴의 전수 재열거에서 발견했다(§10 지점을 4로 늘린 근거).
  it('watchdog 정착이 종류를 싣는다', async () => {
    const emitted: { phase?: string; taskKind?: string }[] = []
    const turn = {
      owner: 'o',
      dbSessionId: SESSION,
      live: { backgroundTask: async () => true, stopTask: async () => undefined },
      openToolRuns: new Map(),
      subagentTaskIds: new Map([['p1', 'task-1']]),
      subagentTypes: new Map(),
      stoppedSubagents: new Set<string>(),
      blockedSubagents: new Set<string>()
    }
    await stopSubagentTask(turn as never, { sessionId: SESSION, toolUseId: 'p1' }, {
      tracker: {
        isAsyncLaunched: () => true,
        settled: () => {},
        kindOf: () => 'shell' as const,
        waitForTask: async () => 'timeout' as const
      },
      settle: (_t: unknown, ev: unknown) => emitted.push(ev as { phase?: string }),
      timeoutMs: 1
    } as never)
    const settledEv = emitted.find((e) => e.phase === 'settled')
    expect(settledEv?.taskKind).toBe('shell')
  })
})
