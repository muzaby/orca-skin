// 0230 VP-02 · VP-04 · VP-07 (R-02·R-04 ↔ AT-03·AT-04·AT-07 · §10 EP-03·EP-06)
//
// 두 불변식을 잠근다.
//   ① 셸 런치 영수증은 추적을 **해제하지 않는다** — 해제하면 턴-후 루프가 종료를 안 기다린다.
//   ② 셸 정착은 부모 `tool.call.completed` 를 **합성하지 않는다** — 합성하면 stdout 을 덮는다.

import { describe, expect, it } from 'vitest'
import { BackgroundTaskTracker } from './background-tasks'
import { createSubagentSettlementEvents } from './subagent-settlement'
import { stopSubagentTask } from './stop-subagent'
import { settleTaskSubset } from './settle'
import { TurnCoordinator, type CoordinatorRuntime } from './turn-coordinator'
import { TypedBus } from '../../infra/bus'
import type { OrcaBusEvents } from '../../contracts/bus-events'
import type { NormalizedEvent } from '../../../shared/ipc'

const SESSION = 's1'

// **프로덕션 코디네이터를 실제로 돌린다**(r2 · D1). r1 은 여기서 코디네이터의 분기를 로컬로
// 재구현했고, 그래서 `turn-coordinator.ts` 의 호출부를 구 술어로 되돌려도 전 스위트가 초록이었다
// — 술어는 잠기고 **배선은 잠기지 않았다**. 판정이 사는 자리를 테스트가 직접 지나야 한다.
async function runCoordinator(
  tracker: BackgroundTaskTracker,
  events: NormalizedEvent[]
): Promise<void> {
  const stream = (): AsyncIterable<NormalizedEvent> =>
    (async function* () {
      for (const ev of events) yield ev
    })()
  const runtime = {
    cancelled: false,
    timedOut: false,
    eventBatches: {
      [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) })
    },
    close: () => {},
    setPermissionMode: async () => {},
    interrupt: async () => {},
    setModel: async () => {},
    stopTask: async () => {},
    backgroundTask: async () => false,
    markAborted: () => {},
    send: stream,
    listen: stream
  } as unknown as CoordinatorRuntime
  const coordinator = new TurnCoordinator<string>({
    runtime,
    bus: new TypedBus<OrcaBusEvents<string>>(),
    persist: { persist: () => {}, flushAskAnswers: () => {} },
    forward: { forward: () => {} },
    registry: { promote: () => {} },
    classifyError: () => ({ category: 'stream_error', message: 'x' }) as never,
    activeTurns: { increment: () => {}, decrement: () => {} },
    backgroundTasks: tracker,
    persistResponseBoundaries: () => false
  } as never)
  const turn = {
    owner: 'o',
    dbSessionId: SESSION,
    controller: new AbortController(),
    openToolRuns: new Map(),
    subagentTaskIds: new Map(),
    subagentTypes: new Map(),
    stoppedSubagents: new Set<string>(),
    blockedSubagents: new Set<string>(),
    askPendingIds: [],
    agentKind: 'code'
  }
  await coordinator.run(turn as never, { sessionId: SESSION } as never, { boundProjectId: null })
}

// 셸 백그라운드 런치 영수증이 실린 `tool.call.completed` 한 건.
const shellReceipt = (toolRunId: string): NormalizedEvent =>
  ({
    type: 'tool.call.completed',
    sessionId: SESSION,
    toolRunId,
    result: 'partial stdout',
    isError: false,
    structuredOutput: { shellBackground: { taskId: 'bg-1' } }
  }) as NormalizedEvent

describe('0230 AT-03/AT-04 — 셸 영수증은 추적을 유지한다', () => {
  it('AT-03: backgroundTaskId 결과가 코디네이터를 지나도 추적이 줄지 않는다', async () => {
    const tracker = new BackgroundTaskTracker()
    tracker.started(SESSION, 'sh1', 'shell')
    expect(tracker.count(SESSION)).toBe(1)

    await runCoordinator(tracker, [shellReceipt('sh1')])

    expect(tracker.count(SESSION)).toBe(1)
    expect(tracker.isAsyncLaunched(SESSION, 'sh1')).toBe(true)
  })

  it('AT-04: 이어서 정착이 오면 그때 추적에서 빠진다', async () => {
    const tracker = new BackgroundTaskTracker()
    tracker.started(SESSION, 'sh1', 'shell')
    await runCoordinator(tracker, [
      shellReceipt('sh1'),
      {
        type: 'subagent.task',
        sessionId: SESSION,
        toolUseId: 'sh1',
        phase: 'settled',
        status: 'completed',
        taskKind: 'shell'
      } as NormalizedEvent
    ])

    expect(tracker.count(SESSION)).toBe(0)
  })

  it('음성 대조: 영수증 없는 셸 결과는 코디네이터에서 추적을 해제한다', async () => {
    const tracker = new BackgroundTaskTracker()
    tracker.started(SESSION, 'sh2', 'shell')

    await runCoordinator(tracker, [
      {
        type: 'tool.call.completed',
        sessionId: SESSION,
        toolRunId: 'sh2',
        result: 'done',
        isError: false
      } as NormalizedEvent
    ])

    expect(tracker.count(SESSION)).toBe(0)
  })

  it('회귀: 에이전트 영수증(async_launched)은 종전대로 추적을 유지한다', async () => {
    const tracker = new BackgroundTaskTracker()
    tracker.started(SESSION, 'ag1', 'agent')

    await runCoordinator(tracker, [
      {
        type: 'tool.call.completed',
        sessionId: SESSION,
        toolRunId: 'ag1',
        result: { status: 'async_launched' },
        isError: false
      } as NormalizedEvent
    ])

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

describe('0230 r2 — 시작 배선이 종류를 트래커에 넣는다 (W2)', () => {
  // `turn-coordinator.ts:445` 가 `started(sessionId, toolUseId, ev.taskKind)` 로 **종류를
  // 넘기는** 지점. 세 번째 인자를 떨어뜨려도 `started` 는 성공하고 추적 수도 같다 — 어긋남은
  // 정착 시점에야 드러난다(종류 미상 → 셸 stdout 이 `{summary:''}` 로 덮인다). D1 과 같은 축이라
  // 여기도 프로덕션 코디네이터를 지나서 본다.
  it('started 이벤트의 taskKind 가 트래커에 기록된다', async () => {
    const tracker = new BackgroundTaskTracker()
    await runCoordinator(tracker, [
      {
        type: 'subagent.task',
        sessionId: SESSION,
        toolUseId: 'sh8',
        phase: 'started',
        taskKind: 'shell'
      } as NormalizedEvent
    ])
    expect(tracker.kindOf(SESSION, 'sh8')).toBe('shell')
  })

  it('회귀: 에이전트 started 도 같은 경로로 종류를 싣는다', async () => {
    const tracker = new BackgroundTaskTracker()
    await runCoordinator(tracker, [
      {
        type: 'subagent.task',
        sessionId: SESSION,
        toolUseId: 'ag8',
        phase: 'started',
        taskKind: 'agent'
      } as NormalizedEvent
    ])
    expect(tracker.kindOf(SESSION, 'ag8')).toBe('agent')
  })
})

describe('0230 r2 — 정착 배선이 종류를 나른다 (W3)', () => {
  // `settleTaskSubset` 이 트래커에서 종류를 읽어 정착 이벤트에 싣는 **배선**을 본다. 빌더의
  // 게이트가 옳아도 여기서 종류를 안 실으면 채널 사망·레벨 제외 경로에서만 stdout 이 덮인다.
  it('레벨 제외 정착이 트래커의 종류를 실어 보낸다', async () => {
    const tracker = new BackgroundTaskTracker()
    tracker.started(SESSION, 'sh9', 'shell')
    const emitted: { type?: string; toolRunId?: string; taskKind?: string; phase?: string }[] = []
    const turn = {
      dbSessionId: SESSION,
      live: null,
      openToolRuns: new Map(),
      subagentTaskIds: new Map()
    }
    await settleTaskSubset(
      turn as never,
      (_t, ev) => emitted.push(ev as never),
      SESSION,
      tracker,
      ['sh9'],
      { status: 'failed', summary: '사라짐', stopLive: false }
    )
    const settledEv = emitted.find((e) => e.phase === 'settled')
    expect(settledEv?.taskKind).toBe('shell')
    // 그리고 그 종류 덕분에 부모 결과가 합성되지 않는다 — 배선과 게이트가 한 경로에서 만난다.
    expect(
      emitted.filter((e) => e.type === 'tool.call.completed' && e.toolRunId === 'sh9')
    ).toHaveLength(0)
  })

  it('에이전트는 같은 경로에서 종전대로 부모 결과를 받는다', async () => {
    const tracker = new BackgroundTaskTracker()
    tracker.started(SESSION, 'ag9', 'agent')
    const emitted: { type?: string; toolRunId?: string }[] = []
    const turn = {
      dbSessionId: SESSION,
      live: null,
      openToolRuns: new Map(),
      subagentTaskIds: new Map()
    }
    await settleTaskSubset(
      turn as never,
      (_t, ev) => emitted.push(ev as never),
      SESSION,
      tracker,
      ['ag9'],
      { status: 'failed', summary: '사라짐', stopLive: false }
    )
    expect(
      emitted.filter((e) => e.type === 'tool.call.completed' && e.toolRunId === 'ag9')
    ).toHaveLength(1)
  })
})
