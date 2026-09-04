import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ClassifiedError, DiffRequirementAnchor, NormalizedEvent } from '../../../shared/ipc'
import type { TurnRequest } from '../../adapters/turn'
import type { ProviderMessageBatch } from '../../adapters/types'
import type { TurnContext } from '../../contracts/turn'
import {
  TurnCoordinator,
  type CoordinatorRuntime,
  type TurnCoordinatorDeps
} from './turn-coordinator'
import { turnPolicyFor } from './turn-policy'
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
  const emptyEvents: AsyncIterable<ProviderMessageBatch> = {
    [Symbol.asyncIterator]: () => ({
      next: async () => ({ done: true, value: undefined as never })
    })
  }
  const nextScript = (): AsyncIterable<NormalizedEvent> => {
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
  return {
    get sendCount() {
      return sendCount
    },
    cancelled: false,
    timedOut: false,
    eventBatches: emptyEvents,
    close: () => {},
    setPermissionMode: stub,
    interrupt: stub,
    setModel: stub,
    stopTask: stub,
    backgroundTask: async () => false,
    markAborted: () => {},
    send: nextScript,
    // listen 턴도 같은 스크립트를 소비한다 — 코디네이터 관점에서 프레임 소스만 다르다.
    listen: nextScript
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
    backgroundTasks: new BackgroundTaskTracker(),
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

describe('TurnCoordinator requirement commit', () => {
  it.each(['turn-open', 'steer'] as const)(
    'preserves %s merged requirements in both persistence and renderer events',
    async (origin) => {
      const requirements: DiffRequirementAnchor[] = ['a.ts', 'b.ts'].map((filePath, index) => ({
        sessionId: 's1',
        baselineCommit: 'base',
        filePath,
        oldLine: null,
        newLine: index + 1,
        hunkHeader: '@@ -0,0 +1 @@',
        contextBefore: [],
        contextAfter: [],
        comment: `comment ${index}`,
        createdAt: index
      }))
      const pendingMessages = new PendingMessageQueue()
      requirements.forEach((requirement, index) =>
        pendingMessages.enqueue(
          's1',
          {
            text: `message ${index}`,
            requirements: [requirement]
          },
          index,
          `req-${index}`
        )
      )
      const batch = pendingMessages.reserveHeld('s1', origin)!
      pendingMessages.commit('s1', batch.attemptId!, batch.chainId)
      const runtime = fakeRuntime([
        [{ type: 'input.echo', sessionId: 's1', text: batch.text, uuid: batch.uuid }, telemetry]
      ])
      const commitUserMessage = vi.fn(() => 42)
      const deps = makeDeps(runtime, {
        pendingMessages,
        persist: { persist: vi.fn(), flushAskAnswers: vi.fn(), commitUserMessage }
      })
      const turn = makeTurn()
      turn.dbSessionId = 's1'
      await new TurnCoordinator(deps).run(
        turn,
        { ...REQUEST, sessionId: 's1', text: batch.text, promptUuid: batch.uuid },
        { boundProjectId: null }
      )
      expect(commitUserMessage).toHaveBeenCalledWith(
        turn,
        expect.objectContaining({ requirements })
      )
      expect(deps.forward.forward).toHaveBeenCalledWith(
        'owner',
        expect.objectContaining({
          type: 'message.committed',
          ids: ['req-0', 'req-1'],
          requirements
        })
      )
    }
  )
})
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
const backgroundSet = (toolUseIds: string[]): NormalizedEvent =>
  ({
    type: 'subagent.backgroundSet',
    sessionId: 's1',
    toolUseIds
  }) as unknown as NormalizedEvent

// forward 스파이가 받은 정착(subagent.task settled) 이벤트만 뽑는다 — 코디네이터가 버스로 낸
// 것을 그대로 읽는 관측이라 `applyLiveSet` 반환값과 달리 배선을 건너뛸 수 없다.
function settledForwards(deps: CoordDeps): NormalizedEvent[] {
  return (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls
    .map((c) => c[1] as NormalizedEvent)
    .filter((ev) => ev.type === 'subagent.task' && ev.phase === 'settled')
}

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
      const batch = pendingMessages.reserveHeld('s1', 'steer', item.id)!
      pendingMessages.commit('s1', batch.attemptId!, batch.chainId)
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
      const batch = pendingMessages.reserveItem('s1', id, 'turn-open')!
      pendingMessages.commit('s1', batch.attemptId!, batch.chainId)
      return batch
    })
    pendingMessages.enqueue('s1', { text: 'hello' }, Date.now(), 'p1')
    const mainBatch = pendingMessages.reserveItem('s1', 'p1', 'turn-open')!
    pendingMessages.commit('s1', mainBatch.attemptId!, mainBatch.chainId)
    for (const id of opts.steerIds ?? []) {
      pendingMessages.enqueue('s1', { text: `steer-${id}` }, Date.now(), id)
      const batch = pendingMessages.reserveHeld('s1', 'steer', id)!
      pendingMessages.commit('s1', batch.attemptId!, batch.chainId)
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

  // 0204 §10 EP-06(2) — 사용자가 중단한 태스크는 완료 통지를 만들지 않는다(0143 결정).
  // 구 경로에서는 중단 클릭이 트래커를 즉시 해제해 이 조건이 부수적으로 거짓이 됐다. D-005 가
  // 확정까지 추적을 유지하면서 그 부수 효과가 사라져 명시 게이트가 필요해졌다.
  it('사용자가 중단한 태스크의 settled 는 영수증이 관측됐어도 background 미부여', async () => {
    // 영수증은 **중단 클릭 이전에** 관측됐다 — 그래서 tracker 에 직접 심는다. 스트림 안에
    // receipt 이벤트를 두면 coerceStoppedToolCompletion 이 그것을 먼저 aborted 로 바꿔
    // markAsyncLaunched 자체가 일어나지 않고, 그러면 이 게이트가 판정에 참여하지 못한다.
    const runtime = fakeRuntime([[subagentStarted('a1'), subagentSettled('a1'), telemetry]])
    const tracker = new BackgroundTaskTracker()
    tracker.markAsyncLaunched('s1', 'a1')
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    // 사용자가 중단 버튼을 눌렀다 — 확정이 도착하기 전 상태.
    turn.stoppedSubagents.add('a1')

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })
    const settledForwards = (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[1] as NormalizedEvent)
      .filter((ev) => ev.type === 'subagent.task' && ev.phase === 'settled')
    expect(settledForwards).toHaveLength(1)
    expect((settledForwards[0] as { background?: boolean }).background).toBeUndefined()
  })

  // 같은 조건에서 중단만 없으면 background:true 다 — 위 단언이 게이트 때문임을 고정하는 양성 짝.
  it('중단하지 않은 태스크는 같은 조건에서 background:true 를 받는다', async () => {
    const runtime = fakeRuntime([[subagentStarted('a1'), subagentSettled('a1'), telemetry]])
    const tracker = new BackgroundTaskTracker()
    tracker.markAsyncLaunched('s1', 'a1')
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })
    const settledForwards = (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[1] as NormalizedEvent)
      .filter((ev) => ev.type === 'subagent.task' && ev.phase === 'settled')
    expect((settledForwards[0] as { background?: boolean }).background).toBe(true)
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
      { ...REQUEST, text: '' },
      { boundProjectId: null, kind: 'listen' }
    )
    expect(deps.activeTurns.increment).not.toHaveBeenCalled()
    expect(deps.activeTurns.decrement).not.toHaveBeenCalled()
  })

  it('listen 턴은 send 가 아니라 runtime.listen 으로 프레임을 연다 (0149)', async () => {
    const runtime = fakeRuntime([[telemetry]])
    const sendSpy = vi.spyOn(runtime, 'send')
    const listenSpy = vi.spyOn(runtime, 'listen')
    const deps = makeDeps(runtime)

    await new TurnCoordinator(deps).run(
      makeTurn(),
      { ...REQUEST, text: '' },
      { boundProjectId: null, kind: 'listen' }
    )
    expect(listenSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).not.toHaveBeenCalled()
  })
})

// 0149 — 턴 종류별 정책이 turn-policy 단일 지점으로 올라갔다(구 stallTimerFor + 산재한
// `request.listen !== true` 판정). stall 무장·동시 턴 계상 규칙을 여기서 고정한다.
describe('turnPolicyFor — 턴 종류별 정책 (0149, 구 0136 stallTimerFor)', () => {
  it('listen 턴은 stall 미무장 · 동시 턴 미계상 · 입력 미push', () => {
    expect(turnPolicyFor('listen')).toEqual({
      armStall: false,
      countsAsActive: false,
      pushesInput: false
    })
  })

  it('user·continuation 턴은 stall 무장 · 동시 턴 계상 · 입력 push', () => {
    for (const kind of ['user', 'continuation'] as const) {
      expect(turnPolicyFor(kind)).toEqual({
        armStall: true,
        countsAsActive: true,
        pushesInput: true
      })
    }
  })
})

// 0212 AC14·AC15(ΔV1) — **관측 지점은 coordinator 가 내는 정착이다.** `applyLiveSet` 반환값만
// 읽는 tracker 단위 단언은 이 블록을 통째로 지워도 초록이라 두 AC 를 닫지 못한다(r1 verify D2:
// MV-3 조인 삭제에 229파일 2410케이스가 침묵했다).
describe('TurnCoordinator — background_tasks_changed 레벨 정착 (0212 R-04)', () => {
  // stopLive:false 를 관측하는 자리 — 참이면 stopLiveSubagent 가 이 둘을 부른다.
  function spiedRuntime(scripts: NormalizedEvent[][]): ReturnType<typeof fakeRuntime> & {
    backgroundTask: ReturnType<typeof vi.fn>
    stopTask: ReturnType<typeof vi.fn>
  } {
    const runtime = fakeRuntime(scripts)
    return Object.assign(runtime, {
      backgroundTask: vi.fn(async () => false),
      stopTask: vi.fn(async () => {})
    })
  }

  it('첫 payload 는 기준선이라 아무것도 정착시키지 않는다 (AT-15)', async () => {
    // a1 은 추적 중이고 첫 payload 는 빈 집합이다 — 기준선이 아니면 여기서 정착한다.
    const runtime = spiedRuntime([[subagentStarted('a1'), backgroundSet([]), telemetry]])
    const tracker = new BackgroundTaskTracker()
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })

    expect(settledForwards(deps)).toHaveLength(0)
    expect([...tracker.ids('s1')]).toEqual(['a1'])
  })

  it('둘째 payload 에서 빠진 추적 항목이 failed 로 정착한다 (AT-14 — AT-15 의 양성 짝)', async () => {
    const runtime = spiedRuntime([
      [
        subagentStarted('a1'),
        subagentStarted('a2'),
        backgroundSet(['a1', 'a2']), // 기준선
        backgroundSet(['a2']), // a1 이 살아 있는 집합에서 사라졌다
        telemetry
      ]
    ])
    const tracker = new BackgroundTaskTracker()
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })

    const settled = settledForwards(deps)
    expect(settled).toHaveLength(1)
    expect(settled[0]).toMatchObject({
      toolUseId: 'a1',
      status: 'failed',
      summary: '완료 통지 없이 백그라운드 작업 목록에서 사라졌습니다.'
    })
    // 집합에 남은 a2 는 건드리지 않는다.
    expect([...tracker.ids('s1')]).toEqual(['a2'])
  })

  it('레벨 정착은 stopLive:false — 이미 목록에 없는 태스크에 제어 요청을 보내지 않는다', async () => {
    const runtime = spiedRuntime([
      [subagentStarted('a1'), backgroundSet(['a1']), backgroundSet([]), telemetry]
    ])
    const tracker = new BackgroundTaskTracker()
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    // taskId 가 있어도 부르지 않는다 — 없어서 안 부른 것과 구분한다.
    turn.subagentTaskIds.set('a1', 'task-1')

    await new TurnCoordinator(deps).run(turn, REQUEST, { boundProjectId: null })

    expect(settledForwards(deps)).toHaveLength(1)
    expect(runtime.backgroundTask).not.toHaveBeenCalled()
    expect(runtime.stopTask).not.toHaveBeenCalled()
  })
})

describe('TurnCoordinator — listen 턴 stall 미무장 (0136)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('listen 턴은 STALL_TIMEOUT 경과에도 abort 하지 않는다', async () => {
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    const deps = makeDeps(fakeRuntime([[telemetry]]))

    await new TurnCoordinator(deps).run(
      turn,
      { ...REQUEST, text: '' },
      {
        boundProjectId: null,
        kind: 'listen'
      }
    )
    vi.advanceTimersByTime(STALL_TIMEOUT_MS + 1_000)
    expect(turn.controller.signal.aborted).toBe(false)
  })
})
