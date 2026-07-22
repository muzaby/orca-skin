import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ClassifiedError, NormalizedEvent } from '../../../shared/ipc'
import type { TurnRequest } from '../../adapters/turn'
import type { TurnContext } from '../../contracts/turn'
import {
  TurnCoordinator,
  stallTimerFor,
  type CoordinatorRuntime,
  type TurnCoordinatorDeps
} from './turn-coordinator'
import { STALL_TIMEOUT_MS } from './timers'
import { BackgroundTaskTracker } from './background-tasks'
import { TypedBus } from '../../infra/bus'
import type { OrcaBusEvents } from '../../contracts/bus-events'
import { PendingMessageQueue } from './pending-message-queue'

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

// bootstrap(router.register)과 동일한 순서로 turn.event 버스에 구독자를 배선한 deps 를 만든다:
// usage → history(persist) → title → relay(forward). 코디네이터는 이 버스로 emit 하므로, 스파이는
// 구독을 통해 호출된다 — 팬아웃 순서 불변식까지 함께 검증된다(order 로그). persist/forward 는
// 버스를 안 타는 경로(steer·Ask·합성 error)를 위해 deps 에도 남는다(production 과 동일 인스턴스).
type CoordDeps = TurnCoordinatorDeps<W> & {
  titles: { maybeStart: ReturnType<typeof vi.fn> }
  usage: ReturnType<typeof vi.fn>
  order: string[]
}

function makeDeps(
  runtime: CoordinatorRuntime,
  overrides: Partial<TurnCoordinatorDeps<W>> = {}
): CoordDeps {
  const order: string[] = []
  const usage = vi.fn(() => order.push('usage'))
  const titles = {
    maybeStart: vi.fn<(turn: TurnContext<W>) => void>(() => {
      order.push('title')
    })
  }
  const base: TurnCoordinatorDeps<W> = {
    runtime,
    bus: new TypedBus<OrcaBusEvents<W>>(),
    persist: { persist: vi.fn(() => order.push('history')), flushAskAnswers: vi.fn() },
    forward: { forward: vi.fn(() => order.push('relay')) },
    registry: { promote: vi.fn() },
    classifyError: vi.fn(
      () => ({ kind: 'stream_error', message: 'x', retryable: false }) as unknown as ClassifiedError
    ),
    activeTurns: { increment: vi.fn(), decrement: vi.fn() },
    ...overrides
  }
  base.bus.on(
    'turn.event',
    ({ ev }) => {
      if (ev.type === 'telemetry') usage()
    },
    { critical: true }
  )
  base.bus.on('turn.event', ({ turn, ev }) => base.persist.persist(turn, ev), { critical: true })
  base.bus.on('turn.event', ({ turn, ev }) => {
    if (ev.type === 'session.updated' || ev.type === 'telemetry') titles.maybeStart(turn)
  })
  base.bus.on('turn.event', ({ turn, ev }) => base.forward.forward(turn.owner, ev))
  return { ...base, titles, usage, order }
}

const sessionUpdated = { type: 'session.updated', sessionId: 's1' } as unknown as NormalizedEvent
const telemetry = { type: 'telemetry', sessionId: 's1' } as unknown as NormalizedEvent
const subagentStarted = (toolUseId: string): NormalizedEvent =>
  ({
    type: 'subagent.task',
    sessionId: 's1',
    toolUseId,
    phase: 'started'
  }) as unknown as NormalizedEvent
const subagentSettled = (toolUseId: string): NormalizedEvent =>
  ({
    type: 'subagent.task',
    sessionId: 's1',
    toolUseId,
    phase: 'settled',
    status: 'completed'
  }) as unknown as NormalizedEvent

describe('TurnCoordinator.run — consume → reduce → persist ∥ forward', () => {
  it('이벤트마다 persist 와 forward 를 모두 호출하고, terminal 관찰 시 합성하지 않는다', async () => {
    const runtime = fakeRuntime([[sessionUpdated, telemetry]])
    const deps = makeDeps(runtime)
    const turn = makeTurn()

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })

    expect(deps.persist.persist).toHaveBeenCalledTimes(2)
    expect(deps.forward.forward).toHaveBeenCalledTimes(2)
    // 제목 트리거는 session.updated 와 telemetry 모두에서(title 구독자) — 2회. 실 구현 maybeStart 는
    // titleGenerationStarted 가드로 2번째를 no-op 하지만 스파이는 호출 횟수만 센다.
    expect(deps.titles.maybeStart).toHaveBeenCalledTimes(2)
    expect(deps.registry.promote).toHaveBeenCalledWith(turn, 's1')
    // active turn 회계는 증가/감소 짝이 맞아야 한다
    expect(deps.activeTurns.increment).toHaveBeenCalledTimes(1)
    expect(deps.activeTurns.decrement).toHaveBeenCalledTimes(1)
  })

  it('telemetry 팬아웃은 usage→history→title→relay 등록 순서로 소비된다(순서 계약)', async () => {
    const runtime = fakeRuntime([[telemetry]])
    const deps = makeDeps(runtime)

    await new TurnCoordinator(deps).run(makeTurn(), REQUEST, { boundProjectId: null })

    // usage 가 history 의 currentAssistantMessageId reset 전에, title 이 relay 전에 실행된다는
    // 불변식은 bootstrap 의 버스 등록 순서가 소유한다(동기·등록순 emit).
    expect(deps.order).toEqual(['usage', 'history', 'title', 'relay'])
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

describe('TurnCoordinator.run — steer 커밋 (user echo 기반, handoff 0060 D1·D2)', () => {
  const toolStarted = (id: string, parent?: string): NormalizedEvent =>
    ({
      type: 'tool.call.started',
      sessionId: 's1',
      toolRunId: id,
      toolName: 'Bash',
      ...(parent !== undefined ? { parentToolRunId: parent } : {})
    }) as unknown as NormalizedEvent
  const toolCompleted = (id: string, parent?: string): NormalizedEvent =>
    ({
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: id,
      result: 'ok',
      isError: false,
      ...(parent !== undefined ? { parentToolRunId: parent } : {})
    }) as unknown as NormalizedEvent
  const text = {
    type: 'message.completed',
    sessionId: 's1',
    message: { text: 'x' }
  } as unknown as NormalizedEvent
  const echo = (t: string, uuid?: string): NormalizedEvent =>
    ({
      type: 'input.echo',
      sessionId: 's1',
      text: t,
      ...(uuid !== undefined ? { uuid } : {})
    }) as unknown as NormalizedEvent

  // 게이트 flush 된 steer 배치가 큐에 있는 상태로 코디네이터를 돌리고, forward 된 이벤트 타입
  // 순서를 돌려준다. 항목마다 flushHeld 를 호출해 "게이트 훅이 항목 단위 배치(uuid=id)로 stdin
  // 주입한 뒤" 를 시뮬레이트한다 — echo 는 flushed 배치에만 매칭된다(0060 D3).
  async function runSteer(
    script: NormalizedEvent[],
    items: Array<{ id: string; text: string }> = [{ id: 'steer-1', text: 'my feedback' }]
  ): Promise<{
    types: string[]
    persistSteer: ReturnType<typeof vi.fn>
    pendingMessages: PendingMessageQueue
  }> {
    const runtime = fakeRuntime([script])
    const pendingMessages = new PendingMessageQueue()
    for (const item of items) {
      pendingMessages.enqueue('s1', { text: item.text }, Date.now(), item.id)
      pendingMessages.flushHeld('s1', item.id)
    }
    const persistSteer = vi.fn(() => 42)
    const deps = makeDeps(runtime, {
      pendingMessages,
      persist: {
        persist: vi.fn(),
        flushAskAnswers: vi.fn(),
        commitUserMessage: persistSteer
      } as unknown as TurnCoordinatorDeps<W>['persist']
    })
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })
    const types = (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[1] as NormalizedEvent).type
    )
    return { types, persistSteer, pendingMessages }
  }

  it('echo(uuid 매칭) 후 첫 비-echo 이벤트에서 flush 하고, echo 자체는 forward 되지 않는다', async () => {
    const { types, persistSteer, pendingMessages } = await runSteer([
      sessionUpdated,
      toolStarted('t1'),
      toolCompleted('t1'),
      echo('my feedback', 'steer-1'),
      text,
      telemetry
    ])
    expect(persistSteer).toHaveBeenCalledTimes(1)
    expect(types).not.toContain('input.echo')
    // 도구 취합 → echo(소비 확정) 직후, continuation 텍스트(message.completed) 이전에 커밋.
    const flushIdx = types.indexOf('message.committed')
    expect(flushIdx).toBeGreaterThan(types.indexOf('tool.call.completed'))
    expect(flushIdx).toBeLessThan(types.lastIndexOf('message.completed'))
    expect(pendingMessages.takeForRespawn('s1')).toEqual([])
  })

  it('echo 없이는 최상위 도구 경계·telemetry 에서도 flush 하지 않는다 — pending 잔존(다음 send 이월)', async () => {
    const { types, persistSteer, pendingMessages } = await runSteer([
      sessionUpdated,
      toolStarted('t1'),
      toolCompleted('t1'),
      text,
      telemetry
    ])
    expect(persistSteer).not.toHaveBeenCalled()
    expect(types).not.toContain('message.committed')
    // 미소비 flushed 배치는 carryover(다음 send 이월) 대상으로 잔존한다.
    expect(pendingMessages.takeForRespawn('s1').flatMap((b) => b.ids)).toEqual(['steer-1'])
  })

  it('echo 의 uuid 가 미보존이면 text 완전일치로 폴백 매칭한다', async () => {
    const { persistSteer, pendingMessages } = await runSteer([
      sessionUpdated,
      echo('my feedback'),
      text,
      telemetry
    ])
    expect(persistSteer).toHaveBeenCalledTimes(1)
    expect(pendingMessages.takeForRespawn('s1')).toEqual([])
  })

  it('다건 pending 중 echo 된 항목만 flush 하고 나머지는 잔존한다', async () => {
    const { persistSteer, pendingMessages } = await runSteer(
      [sessionUpdated, echo('first', 'a'), text, telemetry],
      [
        { id: 'a', text: 'first' },
        { id: 'b', text: 'second' }
      ]
    )
    expect(persistSteer).toHaveBeenCalledTimes(1)
    expect((persistSteer.mock.calls[0][1] as { text: string }).text).toBe('first')
    expect(pendingMessages.takeForRespawn('s1').flatMap((b) => b.ids)).toEqual(['b'])
  })

  it('연속 echo 로 소비된 복수 배치는 각자 커밋된다 (배치 단위 유지, 0067)', async () => {
    const { persistSteer, pendingMessages } = await runSteer(
      [sessionUpdated, echo('first', 'a'), echo('second', 'b'), text, telemetry],
      [
        { id: 'a', text: 'first' },
        { id: 'b', text: 'second' }
      ]
    )
    expect(persistSteer).toHaveBeenCalledTimes(2)
    expect(persistSteer.mock.calls.map((c) => (c[1] as { text: string }).text)).toEqual([
      'first',
      'second'
    ])
    expect(pendingMessages.takeForRespawn('s1')).toEqual([])
  })

  it('echo 직후 스트림이 telemetry 로 끝나면 telemetry persist 후 flush 된다', async () => {
    const { types, persistSteer } = await runSteer([
      sessionUpdated,
      echo('my feedback', 'steer-1'),
      telemetry
    ])
    expect(persistSteer).toHaveBeenCalledTimes(1)
    expect(types.indexOf('message.committed')).toBeGreaterThan(types.indexOf('telemetry'))
  })

  it('매칭되지 않는 echo(초기 프롬프트 등)는 무시한다', async () => {
    const { persistSteer, pendingMessages } = await runSteer([
      sessionUpdated,
      echo('unrelated prompt text'),
      telemetry
    ])
    expect(persistSteer).not.toHaveBeenCalled()
    expect(pendingMessages.takeForRespawn('s1').flatMap((b) => b.ids)).toEqual(['steer-1'])
  })

  it('pending steer 가 없으면 echo/경계에서도 flush(persist) 하지 않는다', async () => {
    const runtime = fakeRuntime([
      [sessionUpdated, toolStarted('t1'), toolCompleted('t1'), echo('stray'), telemetry]
    ])
    const persistSteer = vi.fn(() => 42)
    const deps = makeDeps(runtime, {
      pendingMessages: new PendingMessageQueue(),
      persist: {
        persist: vi.fn(),
        flushAskAnswers: vi.fn(),
        commitUserMessage: persistSteer
      } as unknown as TurnCoordinatorDeps<W>['persist']
    })
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })
    expect(persistSteer).not.toHaveBeenCalled()
  })
})

describe('TurnCoordinator.run — 턴-시작 배치 소비 (응답 시작 증거, 0069)', () => {
  const output = {
    type: 'message.completed',
    sessionId: 's1',
    message: { text: 'answer' }
  } as unknown as NormalizedEvent
  const toolFirst = {
    type: 'tool.call.started',
    sessionId: 's1',
    toolRunId: 't1',
    toolName: 'Bash'
  } as unknown as NormalizedEvent
  const echo = (t: string, uuid: string): NormalizedEvent =>
    ({ type: 'input.echo', sessionId: 's1', text: t, uuid }) as unknown as NormalizedEvent

  // 턴 프롬프트(uuid=p1, flushItem)와 선택적 프렐류드/steer 배치를 큐에 세팅하고 코디네이터를
  // 돌린다 — request 에 promptUuid(+preludes)를 실어 chat-turn 배선을 시뮬레이트한다.
  async function runTurnOpen(
    script: NormalizedEvent[],
    opts: { preludeIds?: string[]; steerIds?: string[] } = {}
  ): Promise<{
    types: string[]
    commitUser: ReturnType<typeof vi.fn>
    pendingMessages: PendingMessageQueue
  }> {
    const runtime = fakeRuntime([script])
    const pendingMessages = new PendingMessageQueue()
    const preludes = (opts.preludeIds ?? []).map((id) => {
      pendingMessages.enqueue('s1', { text: `carry-${id}` }, Date.now(), id)
      return pendingMessages.flushItem('s1', id)!
    })
    pendingMessages.enqueue('s1', { text: 'hello' }, Date.now(), 'p1')
    const mainBatch = pendingMessages.flushItem('s1', 'p1')!
    for (const id of opts.steerIds ?? []) {
      pendingMessages.enqueue('s1', { text: `steer-${id}` }, Date.now(), id)
      pendingMessages.flushHeld('s1', id)
    }
    const commitUser = vi.fn(() => 42)
    const deps = makeDeps(runtime, {
      pendingMessages,
      persist: {
        persist: vi.fn(),
        flushAskAnswers: vi.fn(),
        commitUserMessage: commitUser
      } as unknown as TurnCoordinatorDeps<W>['persist']
    })
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    const request = {
      sessionId: 's1',
      text: mainBatch.text,
      promptUuid: mainBatch.uuid,
      ...(preludes.length > 0 ? { preludes } : {})
    } as unknown as TurnRequest
    await new TurnCoordinator(deps).run(turn, request, { boundProjectId: null })
    const types = (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[1] as NormalizedEvent).type
    )
    return { types, commitUser, pendingMessages }
  }

  it('echo 없이 첫 모델 출력에서 턴 프롬프트가 커밋된다 — 출력 이벤트 forward 이전', async () => {
    const { types, commitUser, pendingMessages } = await runTurnOpen([
      sessionUpdated,
      output,
      telemetry
    ])
    expect(commitUser).toHaveBeenCalledTimes(1)
    expect((commitUser.mock.calls[0][1] as { text: string }).text).toBe('hello')
    expect(types.indexOf('message.committed')).toBeLessThan(types.indexOf('message.completed'))
    expect(pendingMessages.takeForRespawn('s1')).toEqual([])
  })

  it('도구-first 턴 — tool.call.started 앵커로 user row 가 도구 파트보다 먼저 커밋된다', async () => {
    const { types, commitUser } = await runTurnOpen([sessionUpdated, toolFirst, telemetry])
    expect(commitUser).toHaveBeenCalledTimes(1)
    expect(types.indexOf('message.committed')).toBeLessThan(types.indexOf('tool.call.started'))
  })

  it('모델 출력이 없으면 소비하지 않는다 — respawn 이월 잔존(D2)', async () => {
    const { commitUser, pendingMessages } = await runTurnOpen([sessionUpdated, telemetry])
    expect(commitUser).not.toHaveBeenCalled()
    expect(pendingMessages.takeForRespawn('s1').flatMap((b) => b.ids)).toEqual(['p1'])
  })

  it('늦은 턴-시작 echo 는 무해 — 이중 커밋 없음', async () => {
    const { commitUser } = await runTurnOpen([
      sessionUpdated,
      output,
      echo('hello', 'p1'),
      telemetry
    ])
    expect(commitUser).toHaveBeenCalledTimes(1)
  })

  it('프렐류드 배치도 첫 출력에서 프롬프트와 함께 개별 배치로 커밋된다', async () => {
    const { commitUser, pendingMessages } = await runTurnOpen([sessionUpdated, output, telemetry], {
      preludeIds: ['c1', 'c2']
    })
    expect(commitUser).toHaveBeenCalledTimes(3)
    expect(commitUser.mock.calls.map((c) => (c[1] as { text: string }).text)).toEqual([
      'carry-c1',
      'carry-c2',
      'hello'
    ])
    expect(pendingMessages.takeForRespawn('s1')).toEqual([])
  })

  it('mid-turn 게이트 flush(steer)는 모델 출력로 소비되지 않는다 — echo 만(D2 보존)', async () => {
    const { commitUser, pendingMessages } = await runTurnOpen([sessionUpdated, output, telemetry], {
      steerIds: ['sA']
    })
    expect(commitUser).toHaveBeenCalledTimes(1) // 턴 프롬프트만
    expect(pendingMessages.takeForRespawn('s1').flatMap((b) => b.ids)).toEqual(['sA'])
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
    // 두 attempt 모두 active turn 짝이 맞아야 한다(누수 없음)
    expect(deps.activeTurns.increment).toHaveBeenCalledTimes(2)
    expect(deps.activeTurns.decrement).toHaveBeenCalledTimes(2)
  })
})

describe('TurnCoordinator — 백그라운드 태스크 추적 (0136)', () => {
  it('subagent.task started→settled 를 tracker 에 반영한다', async () => {
    const runtime = fakeRuntime([
      [subagentStarted('a1'), subagentStarted('a2'), subagentSettled('a1'), telemetry]
    ])
    const tracker = new BackgroundTaskTracker()
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })
    // a1 은 settled, a2 는 미정착으로 남는다.
    expect([...tracker.ids('s1')]).toEqual(['a2'])
  })

  it('부모 Task 의 권위 결과(비-런치 영수증) tool.call.completed 도 정착으로 본다', async () => {
    const started = subagentStarted('a1')
    const completed = {
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 'a1',
      result: { summary: 'done' },
      isError: false
    } as unknown as NormalizedEvent
    const runtime = fakeRuntime([[started, completed, telemetry]])
    const tracker = new BackgroundTaskTracker()
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })
    expect(tracker.ids('s1').size).toBe(0)
  })

  it('런치 영수증(async_launched) tool.call.completed 는 추적을 해제하지 않고 background 관측을 기록한다', async () => {
    const started = subagentStarted('a1')
    const receipt = {
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 'a1',
      result: { status: 'async_launched', agentId: 'x' },
      isError: false
    } as unknown as NormalizedEvent
    const runtime = fakeRuntime([[started, receipt, telemetry]])
    const tracker = new BackgroundTaskTracker()
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })
    // 런치 영수증은 "실행 중" — settled 로 오해하지 않는다. 0143: background 확정 관측 기록.
    expect([...tracker.ids('s1')]).toEqual(['a1'])
    expect(tracker.isAsyncLaunched('s1', 'a1')).toBe(true)
  })
})

describe('TurnCoordinator — settled background enrich + listen 회계 (0143)', () => {
  it('영수증 관측 태스크의 settled 는 background:true 로 emit 된다(통지 게이팅)', async () => {
    const receipt = {
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 'a1',
      result: { status: 'async_launched', agentId: 'x' },
      isError: false
    } as unknown as NormalizedEvent
    const runtime = fakeRuntime([
      [subagentStarted('a1'), receipt, subagentSettled('a1'), telemetry]
    ])
    const tracker = new BackgroundTaskTracker()
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })
    const settledForwards = (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[1] as NormalizedEvent)
      .filter((ev) => ev.type === 'subagent.task' && ev.phase === 'settled')
    expect(settledForwards).toHaveLength(1)
    expect((settledForwards[0] as { background?: boolean }).background).toBe(true)
    expect(tracker.ids('s1').size).toBe(0)
  })

  it('영수증 미관측(foreground) 태스크의 settled 는 background 미부여', async () => {
    const runtime = fakeRuntime([[subagentStarted('a1'), subagentSettled('a1'), telemetry]])
    const tracker = new BackgroundTaskTracker()
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })
    const settledForwards = (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[1] as NormalizedEvent)
      .filter((ev) => ev.type === 'subagent.task' && ev.phase === 'settled')
    expect(settledForwards).toHaveLength(1)
    expect((settledForwards[0] as { background?: boolean }).background).toBeUndefined()
  })

  it('추적 해제 후 지각 도착한 중복 settled 는 background 미부여(통지 중복 차단)', async () => {
    const receipt = {
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 'a1',
      result: { status: 'async_launched', agentId: 'x' },
      isError: false
    } as unknown as NormalizedEvent
    const runtime = fakeRuntime([
      [subagentStarted('a1'), receipt, subagentSettled('a1'), subagentSettled('a1'), telemetry]
    ])
    const tracker = new BackgroundTaskTracker()
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })
    const flags = (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[1] as NormalizedEvent)
      .filter((ev) => ev.type === 'subagent.task' && ev.phase === 'settled')
      .map((ev) => (ev as { background?: boolean }).background)
    expect(flags).toEqual([true, undefined])
  })

  it('listen 턴은 activeTurns 회계에 계상하지 않는다', async () => {
    const runtime = fakeRuntime([[telemetry]])
    const deps = makeDeps(runtime)

    await new TurnCoordinator(deps).run(
      makeTurn(),
      { ...REQUEST, listen: true, text: '' },
      { boundProjectId: null }
    )
    expect(deps.activeTurns.increment).not.toHaveBeenCalled()
    expect(deps.activeTurns.decrement).not.toHaveBeenCalled()
  })
})

describe('stallTimerFor — listen 턴 stall 미무장 (0136)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('listen=true 는 no-op 타이머 — reset 후 STALL_TIMEOUT 경과에도 abort 하지 않는다', () => {
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    const timer = stallTimerFor(true, turn)
    timer.reset()
    vi.advanceTimersByTime(STALL_TIMEOUT_MS + 1_000)
    expect(turn.controller.signal.aborted).toBe(false)
  })

  it('listen 아님(undefined) 은 실제 stall 타이머 — 경과 시 abort 한다', () => {
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    const timer = stallTimerFor(undefined, turn)
    timer.reset()
    vi.advanceTimersByTime(STALL_TIMEOUT_MS + 1_000)
    expect(turn.controller.signal.aborted).toBe(true)
    timer.clear()
  })
})
