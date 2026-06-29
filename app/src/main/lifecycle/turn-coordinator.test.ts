import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ClassifiedError, NormalizedEvent } from '../../shared/ipc'
import type { TurnRequest } from '../extensions/types'
import type { TurnContext } from './turn-context'
import {
  TurnCoordinator,
  type CoordinatorRuntime,
  type TurnCoordinatorDeps
} from './turn-coordinator'

type W = string

function makeTurn(): TurnContext<W> {
  return {
    controller: new AbortController(),
    owner: 'owner',
    live: null,
    dbSessionId: null,
    openToolRuns: new Map(),
    askPendingIds: [],
    pendingAskAnswers: [],
    askResolved: new Map(),
    subagentTaskIds: new Map(),
    subagentTypes: new Map(),
    blockedSubagents: new Set(),
    stoppedSubagents: new Set()
  } as unknown as TurnContext<W>
}

const REQUEST = { sessionId: null, text: 'hi' } as unknown as TurnRequest

// 스크립트된 이벤트 리스트(또는 attempt 별 동작)를 yield 하는 가짜 런타임.
function fakeRuntime(
  scripts: Array<NormalizedEvent[] | (() => never)>
): CoordinatorRuntime & { sendCount: number } {
  let sendCount = 0
  const stub = async (): Promise<void> => {}
  const emptyEvents: AsyncIterable<NormalizedEvent> = {
    [Symbol.asyncIterator]: () => ({
      next: async () => ({ done: true, value: undefined as never })
    })
  }
  return {
    get sendCount() {
      return sendCount
    },
    cancelled: false,
    timedOut: false,
    events: emptyEvents,
    close: () => {},
    setPermissionMode: stub,
    interrupt: stub,
    setModel: stub,
    stopTask: stub,
    backgroundTask: async () => false,
    markAborted: () => {},
    send: () => {
      const script = scripts[sendCount] ?? scripts[scripts.length - 1]
      sendCount += 1
      return (async function* () {
        if (typeof script === 'function') {
          script() // 동기 throw — 첫 .next() 에서 터진다
          return
        }
        for (const ev of script) yield ev
      })()
    }
  } as unknown as CoordinatorRuntime & { sendCount: number }
}

function makeDeps(
  runtime: CoordinatorRuntime,
  overrides: Partial<TurnCoordinatorDeps<W>> = {}
): TurnCoordinatorDeps<W> {
  return {
    runtime,
    persist: { persist: vi.fn(), flushAskAnswers: vi.fn() },
    forward: { forward: vi.fn() },
    titles: { maybeStart: vi.fn() },
    registry: { promote: vi.fn() },
    classifyError: vi.fn(
      () => ({ kind: 'stream_error', message: 'x', retryable: false }) as unknown as ClassifiedError
    ),
    concurrency: { increment: vi.fn(), decrement: vi.fn() },
    backgroundSubagents: false,
    ...overrides
  }
}

const sessionUpdated = { type: 'session.updated', sessionId: 's1' } as unknown as NormalizedEvent
const telemetry = { type: 'telemetry', sessionId: 's1' } as unknown as NormalizedEvent

describe('TurnCoordinator.run — consume → reduce → persist ∥ forward', () => {
  it('이벤트마다 persist 와 forward 를 모두 호출하고, terminal 관찰 시 합성하지 않는다', async () => {
    const runtime = fakeRuntime([[sessionUpdated, telemetry]])
    const deps = makeDeps(runtime)
    const turn = makeTurn()

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })

    expect(deps.persist.persist).toHaveBeenCalledTimes(2)
    expect(deps.forward.forward).toHaveBeenCalledTimes(2)
    // session.updated → 제목 트리거 + pending 턴 승격
    expect(deps.titles.maybeStart).toHaveBeenCalledTimes(1)
    expect(deps.registry.promote).toHaveBeenCalledWith(turn, 's1')
    // concurrency 회계는 증가/감소 짝이 맞아야 한다
    expect(deps.concurrency.increment).toHaveBeenCalledTimes(1)
    expect(deps.concurrency.decrement).toHaveBeenCalledTimes(1)
  })

  it('terminal 없는 스트림은 합성 telemetry 로 마감한다', async () => {
    const runtime = fakeRuntime([[sessionUpdated]])
    const deps = makeDeps(runtime)
    const turn = makeTurn()

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })

    // session.updated(1) + 합성 telemetry(1) = 2
    expect(deps.persist.persist).toHaveBeenCalledTimes(2)
    const last = (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1]
    expect((last as NormalizedEvent).type).toBe('telemetry')
  })

  it('AskUserQuestion tool.call.started 는 askPendingIds 적재 + flushAskAnswers 한다', async () => {
    const ask = {
      type: 'tool.call.started',
      sessionId: 's1',
      toolRunId: 'a1',
      toolName: 'AskUserQuestion'
    } as unknown as NormalizedEvent
    const runtime = fakeRuntime([[ask, telemetry]])
    const deps = makeDeps(runtime)
    const turn = makeTurn()

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })

    expect(turn.askPendingIds).toContain('a1')
    expect(deps.persist.flushAskAnswers).toHaveBeenCalledWith(turn, 'owner')
  })

  it('beginApprovalPause 는 진행 중 attempt 의 stall 을 pause 하는 release 를 돌려준다', async () => {
    const runtime = fakeRuntime([[sessionUpdated, telemetry]])
    let pauseHandle: (() => void) | undefined
    const coord = new TurnCoordinator(
      makeDeps(runtime, {
        // 이벤트 처리 중(activeStall 설정됨) 첫 forward 에서 pause 핸들을 캡처
        forward: {
          forward: vi.fn(() => {
            if (!pauseHandle) pauseHandle = coord.beginApprovalPause()
          })
        }
      })
    )
    // 진행 전에는 활성 stall 이 없다
    expect(coord.beginApprovalPause()).toBeUndefined()

    await coord.run(makeTurn(), REQUEST, { boundProjectId: null })

    expect(typeof pauseHandle).toBe('function')
    // 종료 후에는 다시 비활성
    expect(coord.beginApprovalPause()).toBeUndefined()
  })
})

describe('TurnCoordinator.run — retry', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('재시도성 에러 + 첫 이벤트 전이면 turn.retrying 후 재시도해 다음 attempt 로 성공한다', async () => {
    const runtime = fakeRuntime([
      () => {
        throw new Error('transient')
      },
      [telemetry]
    ])
    const deps = makeDeps(runtime, {
      classifyError: vi.fn(
        () =>
          ({ kind: 'stream_error', message: 'x', retryable: true }) as unknown as ClassifiedError
      )
    })
    const turn = makeTurn()

    const p = new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })
    await vi.advanceTimersByTimeAsync(1_000)
    await p

    const types = (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[1] as NormalizedEvent).type
    )
    expect(types).toContain('turn.retrying')
    expect(types).toContain('telemetry')
    expect(runtime.sendCount).toBe(2)
    // 두 attempt 모두 concurrency 짝이 맞아야 한다(누수 없음)
    expect(deps.concurrency.increment).toHaveBeenCalledTimes(2)
    expect(deps.concurrency.decrement).toHaveBeenCalledTimes(2)
  })
})
