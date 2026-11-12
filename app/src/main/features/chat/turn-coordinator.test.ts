import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ClassifiedError, DiffRequirementAnchor, NormalizedEvent } from '../../../shared/ipc'
import type { TurnRequest } from '../../adapters/common/turn'
import type { ProviderMessageBatch } from '../../adapters/common/types'
import type { TurnContext } from '../../contracts/turn'
import {
  TurnCoordinator,
  type CoordinatorRuntime,
  type TurnCoordinatorDeps
} from './turn-coordinator'
import { turnPolicyFor } from './turn-policy'
import { BackgroundTaskTracker } from './background-tasks'
import { TypedBus } from '../../infra/bus'
import type { OoBusEvents } from '../../contracts/bus-events'
import { PendingMessageQueue } from './pending-message-queue'
import { setRootLogger } from '../../infra/log/registry'

type W = string

function makeTurn(): TurnContext<W> {
  return {
    agentKind: 'code',
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

it('carries native IDs separately from queue UUIDs for matched echoes and automatic input', async () => {
  const queue = new PendingMessageQueue()
  queue.enqueue('s1', { text: 'next' }, 1, 'steer')
  const batch = queue.reserveHeld('s1')!
  queue.commitMany('s1', [batch])
  const deps = makeDeps(
    fakeRuntime([
      [
        {
          type: 'input.echo',
          sessionId: 's1',
          uuid: batch.uuid,
          nativeMessageId: 'native-user',
          text: 'next'
        },
        {
          type: 'input.received',
          sessionId: 's1',
          uuid: 'queue-receipt',
          nativeMessageId: 'native-auto',
          text: 'reminder',
          origin: { kind: 'automatic' }
        },
        {
          type: 'message.completed',
          sessionId: 's1',
          nativeMessageId: 'native-assistant',
          message: { text: 'done' }
        },
        { type: 'telemetry', sessionId: 's1' }
      ]
    ]),
    { pendingMessages: queue }
  )
  const commit = vi.fn(() => 42)
  deps.persist.commitUserMessage = commit
  const turn = makeTurn()
  turn.dbSessionId = 's1'
  await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
  expect(commit.mock.calls).toEqual([
    [turn, expect.objectContaining({ text: 'next', nativeMessageId: 'native-user' })],
    [turn, expect.objectContaining({ text: 'reminder', nativeMessageId: 'native-auto' })]
  ])
  expect(turn.nativeInputIds?.size).toBe(0)
  expect(
    vi
      .mocked(deps.persist.persist)
      .mock.calls.some(
        ([, event]) =>
          event.type === 'message.completed' && event.nativeMessageId === 'native-assistant'
      )
  ).toBe(true)
})

it('commits a received scheduled prompt before its response without consuming a queued user prompt', async () => {
  const runtime = fakeRuntime([
    [
      {
        type: 'input.received',
        sessionId: 's1',
        text: 'check now',
        uuid: 'cron-event',
        origin: { kind: 'scheduled' }
      },
      { type: 'message.completed', sessionId: 's1', message: { text: 'checked' } },
      { type: 'telemetry', sessionId: 's1' }
    ]
  ])
  const deps = makeDeps(runtime)
  const commit = vi.fn(() => 42)
  deps.persist.commitUserMessage = commit
  const turn = makeTurn()
  turn.dbSessionId = 's1'
  turn.agentKind = 'work'
  await new TurnCoordinator(deps).run(turn, REQUEST, { kind: 'listen', sharedPathProjectId: null })
  expect(commit).toHaveBeenCalledWith(
    turn,
    expect.objectContaining({ text: 'check now', origin: { kind: 'scheduled' } })
  )
  const forwarded = vi.mocked(deps.forward.forward).mock.calls.map((call) => call[1])
  expect(forwarded[0]).toMatchObject({
    type: 'message.committed',
    ids: [],
    messageId: 42,
    origin: { kind: 'scheduled' }
  })
  expect(forwarded.some((event) => event.type === 'input.received')).toBe(false)
  expect(forwarded.findIndex((event) => event.type === 'message.completed')).toBeGreaterThan(0)
})

it('does not replay channel-owned schedule state through a delayed turn frame', async () => {
  const runtime = fakeRuntime([
    [
      {
        type: 'session.schedules',
        sessionId: 's1',
        schedules: [{ id: 'old', schedule: '* * * * *', recurring: true, prompt: 'check' }]
      },
      { type: 'telemetry', sessionId: 's1' }
    ]
  ])
  const deps = makeDeps(runtime)
  const turn = makeTurn()
  turn.dbSessionId = 's1'
  await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
  const forwarded = vi.mocked(deps.forward.forward).mock.calls.map((call) => call[1])
  expect(forwarded.some((event) => event.type === 'session.schedules')).toBe(false)
})

it.each(['system-reminder', 'tagged', 'plain'] as const)(
  'records a provider-owned %s input during listen without sending it back',
  async (format) => {
    const origin = { kind: 'automatic' as const, format }
    const text = format === 'plain' ? 'Continue.' : `<${format}>Continue.</${format}>`
    const runtime = fakeRuntime([
      [
        { type: 'input.received', sessionId: 's1', text, uuid: 'provider-input', origin },
        { type: 'message.completed', sessionId: 's1', message: { text: 'continued' } },
        { type: 'turn.ended', sessionId: 's1' }
      ]
    ])
    const send = vi.spyOn(runtime, 'send')
    const listen = vi.spyOn(runtime, 'listen')
    const deps = makeDeps(runtime)
    const commit = vi.fn(() => 43)
    deps.persist.commitUserMessage = commit
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    await new TurnCoordinator(deps).run(turn, REQUEST, {
      kind: 'listen',
      sharedPathProjectId: null
    })
    expect(listen).toHaveBeenCalledTimes(1)
    expect(send).not.toHaveBeenCalled()
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledWith(turn, expect.objectContaining({ text, origin }))
    const forwarded = vi.mocked(deps.forward.forward).mock.calls.map((call) => call[1])
    expect(forwarded[0]).toMatchObject({
      type: 'message.committed',
      ids: [],
      text,
      origin,
      messageId: 43
    })
    expect(forwarded.some((event) => event.type === 'input.received')).toBe(false)
  }
)

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
    bus: new TypedBus<OoBusEvents<W>>(),
    persist: { persist: vi.fn(() => order.push('history')), flushAskAnswers: vi.fn() },
    forward: { forward: vi.fn(() => order.push('relay')) },
    registry: { promote: vi.fn() },
    classifyError: vi.fn(
      () => ({ kind: 'stream_error', message: 'x', retryable: false }) as unknown as ClassifiedError
    ),
    activeTurns: { begin: vi.fn(), confirm: vi.fn(), end: vi.fn() },
    backgroundTasks: new BackgroundTaskTracker(),
    persistResponseBoundaries: (kind) => kind === 'work',
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

describe('0243 execution lifetime', () => {
  const started: NormalizedEvent = {
    type: 'tool.call.started',
    sessionId: 's1',
    toolRunId: 'long-tool',
    toolName: 'Bash',
    args: {}
  }
  const received = (deps: CoordDeps): NormalizedEvent[] =>
    vi.mocked(deps.forward.forward).mock.calls.map((call) => call[1])

  it.each(['user', 'continuation', 'listen'] as const)(
    'AC1: %s waits 30 minutes without output',
    async (kind) => {
      vi.useFakeTimers()
      let finish!: () => void
      const waiting = new Promise<void>((resolve) => {
        finish = resolve
      })
      const runtime = fakeRuntime([])
      const markAborted = vi.fn()
      runtime.markAborted = markAborted
      runtime.send = runtime.listen = async function* () {
        yield started
        await waiting
        yield telemetry
      }
      const turn = makeTurn()
      turn.agentKind = 'work'
      turn.dbSessionId = 's1'
      const deps = makeDeps(runtime)
      const run = new TurnCoordinator(deps).run(turn, REQUEST, { kind, sharedPathProjectId: null })
      try {
        await vi.advanceTimersByTimeAsync(30 * 60_000)
        expect(turn.controller.signal.aborted).toBe(false)
        expect(markAborted).not.toHaveBeenCalled()
        finish()
        await run
        expect(received(deps).filter((ev) => ev.type === 'turn.aborted')).toEqual([])
        expect(received(deps).at(-1)).toMatchObject({
          type: 'response.boundary',
          boundary: { outcome: 'ended' }
        })
      } finally {
        finish()
        await run
        vi.useRealTimers()
      }
    }
  )

  it.each(['return', 'throw', 'finalize-failure'] as const)(
    'AC4/5/13: %s settles before one abort terminal',
    async (mode) => {
      const turn = makeTurn()
      turn.agentKind = 'work'
      turn.dbSessionId = 's1'
      const runtime = fakeRuntime([])
      runtime.send = async function* () {
        yield started
        turn.controller.abort()
        if (mode === 'throw') throw new Error('aborted stream')
      }
      const deps = makeDeps(runtime)
      const order: string[] = []
      vi.mocked(deps.forward.forward).mockImplementation((_owner, ev) => {
        order.push(ev.type)
      })
      const finalize = vi.fn(() => {
        order.push('finalize')
        if (mode === 'finalize-failure') throw new Error('database unavailable')
      })
      deps.persist.finalizeTurn = finalize
      await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
      const events = received(deps)
      expect(events.filter((ev) => ev.type === 'turn.aborted')).toEqual([
        { type: 'turn.aborted', sessionId: 's1', reason: 'interrupted' }
      ])
      expect(events.filter((ev) => ev.type === 'error')).toEqual([])
      expect(events.find((ev) => ev.type === 'tool.call.completed')).toMatchObject({
        result: { reason: 'aborted' }
      })
      expect(finalize).toHaveBeenCalledTimes(1)
      expect(order.indexOf('tool.call.completed')).toBeLessThan(order.indexOf('finalize'))
      expect(order.indexOf('finalize')).toBeLessThan(order.indexOf('turn.aborted'))
      expect(events.at(-1)).toMatchObject({
        type: 'response.boundary',
        boundary: { outcome: 'aborted' }
      })
    }
  )

  it('AC5: abort during retry backoff sends one interrupted terminal', async () => {
    vi.useFakeTimers()
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    const runtime = fakeRuntime([
      () => {
        throw new Error('retry')
      }
    ])
    const deps = makeDeps(runtime, {
      classifyError: () => ({ category: 'stream_error', message: 'retry', retryable: true })
    })
    deps.persist.finalizeTurn = vi.fn()
    const run = new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    try {
      await vi.advanceTimersByTimeAsync(0)
      expect(received(deps).some((ev) => ev.type === 'turn.retrying')).toBe(true)
      turn.controller.abort()
      await run
      expect(received(deps).filter((ev) => ev.type === 'turn.aborted')).toEqual([
        { type: 'turn.aborted', sessionId: 's1', reason: 'interrupted' }
      ])
      expect(deps.persist.finalizeTurn).toHaveBeenCalledTimes(1)
      expect(runtime.sendCount).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it.each(['telemetry', 'error'] as const)(
    'AC7: forwarded %s prevents a second terminal',
    async (type) => {
      const turn = makeTurn()
      turn.dbSessionId = 's1'
      const runtime = fakeRuntime([])
      runtime.send = async function* () {
        yield type === 'telemetry'
          ? telemetry
          : {
              type: 'error',
              sessionId: 's1',
              error: { category: 'stream_error', message: 'failed', retryable: false }
            }
        turn.controller.abort()
      }
      const deps = makeDeps(runtime)
      deps.persist.finalizeTurn = vi.fn()
      await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
      expect(received(deps).filter((ev) => ev.type === 'turn.aborted')).toEqual([])
      expect(deps.persist.finalizeTurn).not.toHaveBeenCalled()
    }
  )

  it('AC3: pre-aborted turn never sends; finished run detaches its abort listener', async () => {
    const runtime = fakeRuntime([[telemetry]])
    const markAborted = vi.fn()
    runtime.markAborted = markAborted
    const deps = makeDeps(runtime)
    const coordinator = new TurnCoordinator(deps)
    const before = makeTurn()
    before.controller.abort()
    await coordinator.run(before, REQUEST, { sharedPathProjectId: null })
    expect(runtime.sendCount).toBe(0)
    expect(received(deps).filter((ev) => ev.type === 'turn.aborted')).toHaveLength(1)
    const finished = makeTurn()
    await coordinator.run(finished, REQUEST, { sharedPathProjectId: null })
    finished.controller.abort()
    expect(markAborted).not.toHaveBeenCalled()
  })
})

describe('Work response boundaries', () => {
  const text: NormalizedEvent = {
    type: 'message.completed',
    sessionId: 's1',
    message: { text: 'answer' }
  }
  const forwarded = (deps: CoordDeps): NormalizedEvent[] =>
    vi.mocked(deps.forward.forward).mock.calls.map((call) => call[1])

  it('uses the injected response-boundary policy', async () => {
    const deps = makeDeps(fakeRuntime([[text, telemetry]]), {
      persistResponseBoundaries: () => false
    })
    const turn = makeTurn()
    turn.agentKind = 'work'
    turn.dbSessionId = 's1'
    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    expect(forwarded(deps).filter((ev) => ev.type === 'response.boundary')).toEqual([])
  })

  it.each([
    ['ended', [text, telemetry]],
    ['unknown', [text]],
    [
      'failed',
      [
        text,
        {
          type: 'error',
          sessionId: 's1',
          error: { category: 'stream_error', message: 'failed', retryable: false }
        }
      ]
    ],
    ['aborted', [text, { type: 'turn.aborted', sessionId: 's1' }, telemetry]]
  ] as const)(
    'closes %s once without treating synthetic telemetry as completion',
    async (outcome, script) => {
      const deps = makeDeps(fakeRuntime([[...script] as NormalizedEvent[]]))
      const turn = makeTurn()
      turn.agentKind = 'work'
      turn.dbSessionId = 's1'
      await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
      const events = forwarded(deps)
      const boundaries = events.filter((ev) => ev.type === 'response.boundary')
      expect(boundaries).toHaveLength(2)
      expect(boundaries[0]).toEqual({
        type: 'response.boundary',
        sessionId: 's1',
        boundary: { phase: 'begin', id: expect.any(String) }
      })
      expect(boundaries[1]).toEqual({
        type: 'response.boundary',
        sessionId: 's1',
        boundary: { phase: 'end', id: boundaries[0]!.boundary.id, outcome }
      })
      expect(events.indexOf(boundaries[0]!)).toBeLessThan(events.indexOf(text))
      expect(events.at(-1)).toBe(boundaries[1])
    }
  )

  it.each(['code', 'work'] as const)(
    'does not create an empty %s listen segment',
    async (agentKind) => {
      const deps = makeDeps(fakeRuntime([[telemetry]]))
      const turn = makeTurn()
      turn.agentKind = agentKind
      turn.dbSessionId = 's1'
      await new TurnCoordinator(deps).run(turn, REQUEST, {
        sharedPathProjectId: null,
        kind: 'listen'
      })
      expect(forwarded(deps).filter((ev) => ev.type === 'response.boundary')).toEqual([])
    }
  )

  it('leaves Code display events unchanged', async () => {
    const deps = makeDeps(fakeRuntime([[text, telemetry]]))
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    expect(forwarded(deps)).toEqual([text, telemetry])
  })

  it('does not open a main response for a child-only listen frame', async () => {
    const childText: NormalizedEvent = { ...text, parentToolRunId: 'parent' }
    const childTool: NormalizedEvent = {
      type: 'tool.call.started',
      sessionId: 's1',
      toolRunId: 'child',
      toolName: 'Read',
      args: {},
      parentToolRunId: 'parent'
    }
    const childResult: NormalizedEvent = {
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 'child',
      result: 'done',
      isError: false,
      parentToolRunId: 'parent'
    }
    const deps = makeDeps(fakeRuntime([[childText, childTool, childResult, telemetry]]))
    const turn = makeTurn()
    turn.agentKind = 'work'
    turn.dbSessionId = 's1'
    await new TurnCoordinator(deps).run(turn, REQUEST, {
      sharedPathProjectId: null,
      kind: 'listen'
    })
    expect(forwarded(deps)).toEqual([childText, childTool, childResult, telemetry])
  })

  it.each(['failed', 'aborted'] as const)(
    'closes a thrown %s stream after settlement',
    async (outcome) => {
      const turn = makeTurn()
      turn.agentKind = 'work'
      turn.dbSessionId = 's1'
      const runtime = fakeRuntime([[text]])
      runtime.send = async function* () {
        yield text
        if (outcome === 'aborted') turn.controller.abort()
        throw new Error('stream failed')
      }
      const deps = makeDeps(runtime)
      await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
      const boundaries = forwarded(deps).filter((ev) => ev.type === 'response.boundary')
      expect(boundaries).toHaveLength(2)
      expect(boundaries.at(-1)).toMatchObject({ boundary: { phase: 'end', outcome } })
    }
  )

  it('does not create additional segments for an internal retry before output', async () => {
    vi.useFakeTimers()
    try {
      const turn = makeTurn()
      turn.agentKind = 'work'
      turn.dbSessionId = 's1'
      const runtime = fakeRuntime([
        () => {
          throw new Error('retry')
        },
        [text, telemetry]
      ])
      const deps = makeDeps(runtime, {
        classifyError: () => ({ category: 'stream_error', message: 'retry', retryable: true })
      })
      const run = new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
      await vi.advanceTimersByTimeAsync(1000)
      await run
      expect(runtime.sendCount).toBe(2)
      expect(forwarded(deps).filter((ev) => ev.type === 'response.boundary')).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a critical end persistence failure without claiming an emitted end', async () => {
    const turn = makeTurn()
    turn.agentKind = 'work'
    turn.dbSessionId = 's1'
    const deps = makeDeps(fakeRuntime([[text, telemetry]]), {
      persist: {
        persist: (_turn, event) => {
          if (event.type === 'response.boundary' && event.boundary.phase === 'end')
            throw new Error('disk full')
        },
        flushAskAnswers: vi.fn()
      }
    })
    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    expect(forwarded(deps).filter((ev) => ev.type === 'response.boundary')).toHaveLength(1)
    expect(forwarded(deps).at(-1)).toMatchObject({ type: 'error' })
  })

  it('closes the old segment before the confirmed steer user row and opens a fresh segment', async () => {
    const queue = new PendingMessageQueue()
    queue.enqueue('s1', { text: 'next' }, 1, 'steer')
    const batch = queue.reserveHeld('s1')!
    queue.commitMany('s1', [batch])
    const deps = makeDeps(
      fakeRuntime([
        [
          text,
          { type: 'input.echo', sessionId: 's1', text: batch.text, uuid: batch.uuid },
          text,
          telemetry
        ]
      ]),
      { pendingMessages: queue }
    )
    deps.persist.commitUserMessage = vi.fn(() => {
      expect(forwarded(deps).at(-1)).toMatchObject({
        type: 'response.boundary',
        boundary: { phase: 'end', outcome: 'unknown' }
      })
      return 42
    })
    const turn = makeTurn()
    turn.agentKind = 'work'
    turn.dbSessionId = 's1'
    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    const events = forwarded(deps)
    const boundaries = events.filter((ev) => ev.type === 'response.boundary')
    expect(boundaries.map((ev) => ev.boundary.phase)).toEqual(['begin', 'end', 'begin', 'end'])
    expect(boundaries[2]!.boundary.id).not.toBe(boundaries[0]!.boundary.id)
    expect(events.findIndex((ev) => ev.type === 'message.committed')).toBeGreaterThan(
      events.indexOf(boundaries[1]!)
    )
  })

  it('supplies the host kind on session confirmation without mutating the adapter event', async () => {
    const raw: NormalizedEvent = {
      type: 'session.updated',
      sessionId: 's1',
      patch: { agentKind: 'code' }
    }
    const deps = makeDeps(fakeRuntime([[raw]]))
    const turn = makeTurn()
    turn.agentKind = 'work'
    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    expect(forwarded(deps)[0]).toMatchObject({ patch: { agentKind: 'work' } })
    expect(raw.patch?.agentKind).toBe('code')
  })
})

describe('runtime tool session confirmation', () => {
  it('confirms only after history and promotion have completed', async () => {
    const order: string[] = []
    const runtime = fakeRuntime([[sessionUpdated, telemetry]])
    runtime.confirmRuntimeToolSession = (id) => order.push(`confirmed:${id}`)
    const deps = makeDeps(runtime, {
      persist: {
        persist: (_turn, event) => {
          if (event.type === 'session.updated') order.push('persisted')
        },
        flushAskAnswers: vi.fn()
      },
      registry: { promote: () => order.push('promoted') }
    })
    await new TurnCoordinator(deps).run(makeTurn(), REQUEST, { sharedPathProjectId: null })
    expect(order).toEqual(['persisted', 'promoted', 'confirmed:s1'])
  })

  it('does not confirm when the history subscriber fails', async () => {
    const runtime = fakeRuntime([[sessionUpdated]])
    runtime.confirmRuntimeToolSession = vi.fn()
    const deps = makeDeps(runtime, {
      persist: {
        persist: (_turn, event) => {
          if (event.type === 'session.updated') throw new Error('insert session failed')
        },
        flushAskAnswers: vi.fn()
      }
    })
    await new TurnCoordinator(deps).run(makeTurn(), REQUEST, { sharedPathProjectId: null })
    expect(runtime.confirmRuntimeToolSession).not.toHaveBeenCalled()
  })
})

describe('TurnCoordinator requirement commit', () => {
  it('preserves merged requirements in both persistence and renderer events', async () => {
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
    const batch = pendingMessages.reserveHeld('s1')!
    pendingMessages.commitMany('s1', [batch])
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
      { sharedPathProjectId: null }
    )
    expect(commitUserMessage).toHaveBeenCalledWith(turn, expect.objectContaining({ requirements }))
    expect(deps.forward.forward).toHaveBeenCalledWith(
      'owner',
      expect.objectContaining({
        type: 'message.committed',
        ids: ['req-0', 'req-1'],
        requirements
      })
    )
  })
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

describe('TurnCoordinator.run — consume → reduce → persist ∥ forward', () => {
  it('이벤트마다 persist 와 forward 를 모두 호출하고, terminal 관찰 시 합성하지 않는다', async () => {
    const runtime = fakeRuntime([[sessionUpdated, telemetry]])
    const deps = makeDeps(runtime)
    const turn = makeTurn()

    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })

    expect(deps.persist.persist).toHaveBeenCalledTimes(2)
    expect(deps.forward.forward).toHaveBeenCalledTimes(2)
    // 제목 트리거는 session.updated 와 telemetry 모두에서(title 구독자) — 2회. 실 구현 maybeStart 는
    // titleGenerationStarted 가드로 2번째를 no-op 하지만 스파이는 호출 횟수만 센다.
    expect(deps.titles.maybeStart).toHaveBeenCalledTimes(2)
    expect(deps.registry.promote).toHaveBeenCalledWith(turn, 's1')
    // active turn 회계는 증가/감소 짝이 맞아야 한다
    expect(deps.activeTurns.begin).toHaveBeenCalledTimes(1)
    expect(deps.activeTurns.end).toHaveBeenCalledTimes(1)
  })

  it('telemetry 팬아웃은 usage→history→title→relay 등록 순서로 소비된다(순서 계약)', async () => {
    const runtime = fakeRuntime([[telemetry]])
    const deps = makeDeps(runtime)

    await new TurnCoordinator(deps).run(makeTurn(), REQUEST, { sharedPathProjectId: null })

    // usage 가 history 의 currentAssistantMessageId reset 전에, title 이 relay 전에 실행된다는
    // 불변식은 bootstrap 의 버스 등록 순서가 소유한다(동기·등록순 emit).
    expect(deps.order).toEqual(['usage', 'history', 'title', 'relay'])
  })

  it('terminal 없는 스트림은 합성 telemetry 로 마감한다', async () => {
    const runtime = fakeRuntime([[sessionUpdated]])
    const deps = makeDeps(runtime)
    const turn = makeTurn()

    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })

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

    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })

    expect(turn.askPendingIds).toContain('a1')
    expect(deps.persist.flushAskAnswers).toHaveBeenCalledWith(turn, 'owner')
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
      const batch = pendingMessages.reserveHeld('s1', item.id)!
      pendingMessages.commitMany('s1', [batch])
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
    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
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
    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
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
      const batch = pendingMessages.reserveItem('s1', id)!
      pendingMessages.commitMany('s1', [batch])
      return batch
    })
    pendingMessages.enqueue('s1', { text: 'hello' }, Date.now(), 'p1')
    const mainBatch = pendingMessages.reserveItem('s1', 'p1')!
    pendingMessages.commitMany('s1', [mainBatch])
    for (const id of opts.steerIds ?? []) {
      pendingMessages.enqueue('s1', { text: `steer-${id}` }, Date.now(), id)
      const batch = pendingMessages.reserveHeld('s1', id)!
      pendingMessages.commitMany('s1', [batch])
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
    await new TurnCoordinator(deps).run(turn, request, { sharedPathProjectId: null })
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

    const p = new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    await vi.advanceTimersByTimeAsync(1_000)
    await p

    const types = (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[1] as NormalizedEvent).type
    )
    expect(types).toContain('turn.retrying')
    expect(types).toContain('telemetry')
    expect(runtime.sendCount).toBe(2)
    // 두 attempt 모두 active turn 짝이 맞아야 한다(누수 없음)
    expect(deps.activeTurns.begin).toHaveBeenCalledTimes(2)
    expect(deps.activeTurns.end).toHaveBeenCalledTimes(2)
  })
})

// 0314 — coordinator 는 `subagent.task`·도구 결과로 백그라운드 상태를 만들지 않는다(AR-02). 상태의
// 원천은 provider 경로가 넘긴 정본 이벤트뿐이고, coordinator 는 선택자만 읽는다.
const backgroundCall = (
  toolUseId: string,
  mode: 'foreground' | 'background'
): Parameters<BackgroundTaskTracker['observe']>[0] => ({
  type: 'background.call',
  sessionId: 's1',
  toolUseId,
  phase: 'returned',
  patch: { mode, status: mode === 'background' ? 'async_launched' : 'completed' },
  source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false }
})
const settledBackgroundFlags = (deps: CoordDeps): Array<boolean | undefined> =>
  (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls
    .map((c) => c[1] as NormalizedEvent)
    .filter((ev) => ev.type === 'subagent.task' && ev.phase === 'settled')
    .map((ev) => (ev as { background?: boolean }).background)

describe('TurnCoordinator — 백그라운드 상태를 짐작하지 않는다 (0314)', () => {
  it('subagent.task·런치 영수증·권위 결과는 tracker 상태를 만들지 않는다', async () => {
    const receipt = {
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 'a1',
      result: { status: 'async_launched', agentId: 'x' },
      isError: false
    } as unknown as NormalizedEvent
    const completed = {
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 'a3',
      result: { summary: 'done' },
      isError: false
    } as unknown as NormalizedEvent
    const runtime = fakeRuntime([
      [
        subagentStarted('a1'),
        receipt,
        subagentStarted('a2'),
        subagentSettled('a2'),
        subagentStarted('a3'),
        completed,
        telemetry
      ]
    ])
    const tracker = new BackgroundTaskTracker()
    const changed = vi.fn()
    tracker.subscribe(changed)
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'

    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    expect(changed).not.toHaveBeenCalled()
    expect(tracker.hasCanonical('s1')).toBe(false)
    expect(tracker.hasPending('s1')).toBe(false)
    expect(tracker.count('s1')).toBe(0)
    expect(tracker.isAsyncLaunched('s1', 'a1')).toBe(false)
  })
})

// 0314 EP-02·EP-07 — coordinator 의 정본 읽기 자리. 중단·실패 정착은 정본이 백그라운드로 본 호출의
// 후손을 덮지 않고, 중단 클릭 뒤 도착한 task id 의 라이브 정지는 정본 판정으로 분기한다.
describe('TurnCoordinator — 정본 선택자 소비 자리 (0314)', () => {
  const toolStarted = (id: string, parent?: string): NormalizedEvent => ({
    type: 'tool.call.started',
    sessionId: 's1',
    toolRunId: id,
    toolName: 'Bash',
    args: {},
    ...(parent ? { parentToolRunId: parent } : {})
  })
  const settledToolRuns = (deps: CoordDeps): string[] =>
    (deps.forward.forward as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[1] as NormalizedEvent)
      .flatMap((ev) => (ev.type === 'tool.call.completed' ? [ev.toolRunId] : []))

  it.each(['abort', 'fail'] as const)(
    '%s 정착은 정본 백그라운드 호출의 후손을 남기고 나머지 열린 실행만 마감한다',
    async (mode) => {
      const tracker = new BackgroundTaskTracker()
      tracker.observe(backgroundCall('bg', 'background'))
      const turn = makeTurn()
      turn.dbSessionId = 's1'
      const runtime = fakeRuntime([])
      runtime.send = async function* () {
        yield toolStarted('bg-child', 'bg')
        yield toolStarted('plain')
        if (mode === 'abort') turn.controller.abort()
        else throw new Error('stream failed')
      }
      const deps = makeDeps(runtime, { backgroundTasks: tracker })
      deps.persist.finalizeTurn = vi.fn()

      await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
      expect(settledToolRuns(deps)).toEqual(['plain'])
      expect([...turn.openToolRuns.keys()]).toEqual(['bg-child'])
    }
  )

  it.each([
    ['background', []],
    ['foreground', ['a1']]
  ] as const)(
    '중단 클릭 뒤 task id 가 도착하면 정본이 %s 로 본 태스크는 backgroundTask 선행이 %j 다',
    async (mode, expectedBackgroundCalls) => {
      const tracker = new BackgroundTaskTracker()
      tracker.observe(backgroundCall('a1', mode))
      const runtime = fakeRuntime([
        [{ ...subagentStarted('a1'), taskId: 'task-9' } as NormalizedEvent, telemetry]
      ])
      const backgroundTask = vi.fn<(toolUseId: string) => Promise<boolean>>(async () => true)
      const stopTask = vi.fn(async () => {})
      Object.assign(runtime, { backgroundTask, stopTask })
      const deps = makeDeps(runtime, { backgroundTasks: tracker })
      const turn = makeTurn()
      turn.dbSessionId = 's1'
      turn.stoppedSubagents.add('a1')

      await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
      await vi.waitFor(() => expect(stopTask).toHaveBeenCalledWith('task-9'))
      expect(backgroundTask.mock.calls.map((call) => call[0])).toEqual(expectedBackgroundCalls)
    }
  )
})

describe('TurnCoordinator — settled background enrich + listen 회계 (0143)', () => {
  it('정본이 백그라운드로 본 태스크의 settled 는 background:true 로 emit 된다(통지 게이팅)', async () => {
    const runtime = fakeRuntime([[subagentStarted('a1'), subagentSettled('a1'), telemetry]])
    const tracker = new BackgroundTaskTracker()
    tracker.observe(backgroundCall('a1', 'background'))
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'

    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    expect(settledBackgroundFlags(deps)).toEqual([true])
  })

  it('정본이 포그라운드로 본 태스크와 정본에 없는 태스크의 settled 는 background 미부여', async () => {
    const runtime = fakeRuntime([
      [
        subagentStarted('a1'),
        subagentSettled('a1'),
        subagentStarted('a2'),
        subagentSettled('a2'),
        telemetry
      ]
    ])
    const tracker = new BackgroundTaskTracker()
    tracker.observe(backgroundCall('a1', 'foreground'))
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'

    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    expect(settledBackgroundFlags(deps)).toEqual([undefined, undefined])
  })

  // 0204 §10 EP-06(2) — 사용자가 중단한 태스크는 완료 통지를 만들지 않는다(0143 결정).
  it('사용자가 중단한 태스크의 settled 는 정본이 백그라운드로 봤어도 background 미부여', async () => {
    const runtime = fakeRuntime([[subagentStarted('a1'), subagentSettled('a1'), telemetry]])
    const tracker = new BackgroundTaskTracker()
    tracker.observe(backgroundCall('a1', 'background'))
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    // 사용자가 중단 버튼을 눌렀다 — 확정이 도착하기 전 상태.
    turn.stoppedSubagents.add('a1')

    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    expect(settledBackgroundFlags(deps)).toEqual([undefined])
  })

  // 중단 표식은 태스크별이다 — 같은 턴의 중단하지 않은 백그라운드 태스크는 그대로 받는다.
  it('중단하지 않은 태스크는 같은 조건에서 background:true 를 받는다', async () => {
    const runtime = fakeRuntime([
      [
        subagentStarted('a1'),
        subagentSettled('a1'),
        subagentStarted('a2'),
        subagentSettled('a2'),
        telemetry
      ]
    ])
    const tracker = new BackgroundTaskTracker()
    tracker.observe(backgroundCall('a1', 'background'))
    tracker.observe({
      ...backgroundCall('a2', 'background'),
      source: { generation: 'g', sequence: 2, receivedAt: 2, replay: false }
    })
    const deps = makeDeps(runtime, { backgroundTasks: tracker })
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    turn.stoppedSubagents.add('a1')

    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    expect(settledBackgroundFlags(deps)).toEqual([undefined, true])
  })

  it('listen 턴은 activeTurns 회계에 계상하지 않는다', async () => {
    const runtime = fakeRuntime([[telemetry]])
    const deps = makeDeps(runtime)

    await new TurnCoordinator(deps).run(
      makeTurn(),
      { ...REQUEST, text: '' },
      { sharedPathProjectId: null, kind: 'listen' }
    )
    expect(deps.activeTurns.begin).not.toHaveBeenCalled()
    expect(deps.activeTurns.end).not.toHaveBeenCalled()
  })

  it('listen 턴은 send 가 아니라 runtime.listen 으로 프레임을 연다 (0149)', async () => {
    const runtime = fakeRuntime([[telemetry]])
    const sendSpy = vi.spyOn(runtime, 'send')
    const listenSpy = vi.spyOn(runtime, 'listen')
    const deps = makeDeps(runtime)

    await new TurnCoordinator(deps).run(
      makeTurn(),
      { ...REQUEST, text: '' },
      { sharedPathProjectId: null, kind: 'listen' }
    )
    expect(listenSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).not.toHaveBeenCalled()
  })
})

// 턴 종류별 동시 턴 계상과 입력 전달 정책은 turn-policy가 소유한다.
describe('turnPolicyFor — 턴 종류별 정책', () => {
  it('listen 턴은 동시 턴 미계상 · 입력 미push', () => {
    expect(turnPolicyFor('listen')).toEqual({
      countsAsActive: false,
      pushesInput: false
    })
  })

  it('user·continuation 턴은 동시 턴 계상 · 입력 push', () => {
    for (const kind of ['user', 'continuation'] as const) {
      expect(turnPolicyFor(kind)).toEqual({
        countsAsActive: true,
        pushesInput: true
      })
    }
  })
})

describe('TurnCoordinator — listen 턴 종료 후 수명', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('listen 턴이 종료된 뒤 시간이 지나도 abort 하지 않는다', async () => {
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    const deps = makeDeps(fakeRuntime([[telemetry]]))

    await new TurnCoordinator(deps).run(
      turn,
      { ...REQUEST, text: '' },
      {
        sharedPathProjectId: null,
        kind: 'listen'
      }
    )
    vi.advanceTimersByTime(30 * 60_000)
    expect(turn.controller.signal.aborted).toBe(false)
  })
})

// 0239 — 결과 없이 끝난 도구의 terminal·철회 정착(AC1·AC2·AC4 · SD-01·SD-02 · §10 EP-02·EP-03 ④).
describe('0239 — 결과 없이 끝난 도구 정착', () => {
  const started = (id: string, parent?: string): NormalizedEvent => ({
    type: 'tool.call.started',
    sessionId: 's1',
    toolRunId: id,
    toolName: 'Bash',
    args: {},
    ...(parent ? { parentToolRunId: parent } : {})
  })
  const completed = (id: string): NormalizedEvent => ({
    type: 'tool.call.completed',
    sessionId: 's1',
    toolRunId: id,
    result: 'ok',
    isError: false
  })
  const error: NormalizedEvent = {
    type: 'error',
    sessionId: 's1',
    error: { category: 'stream_error', message: 'failed', retryable: false }
  } as NormalizedEvent
  const forwarded = (deps: CoordDeps): NormalizedEvent[] =>
    vi.mocked(deps.forward.forward).mock.calls.map((call) => call[1])
  const persisted = (deps: CoordDeps): NormalizedEvent[] =>
    vi.mocked(deps.persist.persist).mock.calls.map((call) => call[1])
  const shape = (ev: NormalizedEvent): string =>
    ev.type === 'tool.call.completed'
      ? `completed:${ev.toolRunId}:${ev.nonExecution?.source === 'host' ? ev.nonExecution.kind : 'real'}`
      : ev.type === 'tool.call.started'
        ? `started:${ev.toolRunId}`
        : ev.type
  const run = async (events: NormalizedEvent[], deps?: CoordDeps): Promise<CoordDeps> => {
    const d = deps ?? makeDeps(fakeRuntime([events]))
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    await new TurnCoordinator(d).run(turn, REQUEST, { sharedPathProjectId: null })
    return d
  }

  it('AC1 — telemetry 직전에 결과 없는 실행을 no_result 로 정착한다(버스 순서)', async () => {
    const deps = await run([started('a'), started('b'), completed('b'), telemetry])
    expect(forwarded(deps).map(shape)).toEqual([
      'started:a',
      'started:b',
      'completed:b:real',
      'completed:a:no_result',
      'telemetry'
    ])
    // history 도 같은 순서로 받는다 — finalize(telemetry) 전에 결과가 영속된다.
    expect(persisted(deps).map(shape)).toEqual(forwarded(deps).map(shape))
    expect(forwarded(deps)[3]).toMatchObject({
      isError: true,
      result: { reason: 'not_executed' },
      nonExecution: { source: 'host', kind: 'no_result' }
    })
  })

  it('AC2 — error terminal 도 방출 전에 정착하고, 뒤따른 terminal 에서 다시 정착하지 않는다', async () => {
    const deps = await run([started('a'), telemetry, error])
    expect(forwarded(deps).map(shape)).toEqual([
      'started:a',
      'completed:a:no_result',
      'telemetry',
      'error'
    ])
    const onlyError = await run([started('a'), error])
    expect(forwarded(onlyError).map(shape)).toEqual(['started:a', 'completed:a:no_result', 'error'])
  })

  it('AC2 — terminal 없이 끝난 스트림은 합성 telemetry 전에 정착한다', async () => {
    const deps = await run([started('a')])
    expect(forwarded(deps).map(shape)).toEqual(['started:a', 'completed:a:no_result', 'telemetry'])
  })

  it('AC2 — error 정착은 소비된 steer의 message.committed보다 먼저 이전 응답을 닫는다', async () => {
    const pendingMessages = new PendingMessageQueue()
    pendingMessages.enqueue('s1', { text: 'next instruction' }, Date.now(), 'steer-1')
    const batch = pendingMessages.reserveHeld('s1', 'steer-1')!
    pendingMessages.commitMany('s1', [batch])
    const deps = makeDeps(
      fakeRuntime([
        [
          started('a'),
          { type: 'input.echo', sessionId: 's1', text: 'next instruction', uuid: 'steer-1' },
          error
        ]
      ]),
      { pendingMessages }
    )
    deps.persist.commitUserMessage = vi.fn(() => 42)
    await run([], deps)
    expect(forwarded(deps).map(shape)).toEqual([
      'started:a',
      'completed:a:no_result',
      'message.committed',
      'error'
    ])
    expect(deps.persist.commitUserMessage).toHaveBeenCalledOnce()
    expect(pendingMessages.takeForRespawn('s1')).toEqual([])
  })

  it('AC3 경로 — coordinator 는 정본 상태로 보존 집합을 판정한다', async () => {
    const tracker = new BackgroundTaskTracker()
    tracker.observe({
      type: 'background.call',
      sessionId: 's1',
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
      toolUseId: 'bg',
      phase: 'returned',
      patch: { mode: 'background', status: 'async_launched' }
    })
    const deps = makeDeps(
      fakeRuntime([[started('bg-child', 'bg'), started('orphan-child', 'gone'), telemetry]]),
      { backgroundTasks: tracker }
    )
    await run([], deps)
    expect(forwarded(deps).map(shape)).toEqual([
      'started:bg-child',
      'started:orphan-child',
      'completed:orphan-child:no_result',
      'telemetry'
    ])
  })

  // 0314 — 정본 유무로 경로를 가르지 않는다. 정본 이벤트를 못 본 세션은 빈 상태라 보존할
  // 백그라운드 호출이 없고, 부모 있는 실행도 결과 없이 끝난 도구로 정착한다(plan §10 경계 1).
  it('AC3 경로 — 정본 이벤트가 없는 세션은 빈 상태로 판정해 부모 있는 실행도 정착한다', async () => {
    const deps = await run([started('p'), started('child', 'p'), telemetry])
    expect(forwarded(deps).map(shape)).toEqual([
      'started:p',
      'started:child',
      'completed:p:no_result',
      'completed:child:no_result',
      'telemetry'
    ])
  })

  // 0314 ΔV1 EP-02′ — terminal 없이 끝난 스트림의 정착(합성 telemetry 직전)도 같은 정본 상태를
  // 받는다. 정본 백그라운드 호출의 후손은 남기고(빈 상태와 구별), 부모가 정본에 없는 실행은
  // 정착한다(`undefined` 와 구별).
  it('AC3 경로 — terminal 없이 끝난 스트림도 정본 상태로 보존 집합을 판정한다', async () => {
    const tracker = new BackgroundTaskTracker()
    tracker.observe({
      type: 'background.call',
      sessionId: 's1',
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
      toolUseId: 'bg',
      phase: 'returned',
      patch: { mode: 'background', status: 'async_launched' }
    })
    const deps = makeDeps(
      fakeRuntime([[started('bg-child', 'bg'), started('orphan-child', 'gone')]]),
      { backgroundTasks: tracker }
    )
    await run([], deps)
    expect(forwarded(deps).map(shape)).toEqual([
      'started:bg-child',
      'started:orphan-child',
      'completed:orphan-child:no_result',
      'telemetry'
    ])
  })

  it('AC3 경로 — terminal 없이 끝난 스트림에서 정본 없는 세션은 부모 있는 실행도 정착한다', async () => {
    const deps = await run([started('p'), started('child', 'p')])
    expect(forwarded(deps).map(shape)).toEqual([
      'started:p',
      'started:child',
      'completed:p:no_result',
      'completed:child:no_result',
      'telemetry'
    ])
  })

  it('AC4 — 철회는 열린 id 만 즉시 정착하고 내부 이벤트는 버스에 닿지 않는다', async () => {
    const deps = await run([
      started('a'),
      started('b'),
      completed('b'),
      { type: 'tool.call.retracted', sessionId: 's1', toolRunIds: ['a', 'b'] },
      started('c'),
      telemetry
    ])
    expect(forwarded(deps).map(shape)).toEqual([
      'started:a',
      'started:b',
      'completed:b:real',
      'completed:a:retracted',
      'started:c',
      'completed:c:no_result',
      'telemetry'
    ])
    expect(persisted(deps).some((ev) => ev.type === 'tool.call.retracted')).toBe(false)
    expect(forwarded(deps).some((ev) => ev.type === 'tool.call.retracted')).toBe(false)
  })

  it('이미 중단된 턴은 스트림을 시작하거나 도구를 열지 않는다', async () => {
    const runtime = fakeRuntime([[started('a')]])
    const deps = makeDeps(runtime)
    const turn = makeTurn()
    turn.dbSessionId = 's1'
    turn.controller.abort()
    await new TurnCoordinator(deps).run(turn, REQUEST, { sharedPathProjectId: null })
    expect(forwarded(deps).some((ev) => ev.type === 'tool.call.completed')).toBe(false)
    expect([...turn.openToolRuns.keys()]).toEqual([])
    expect(runtime.sendCount).toBe(0)
  })
})

describe('TurnCoordinator.run — retry reopen gate (0301)', () => {
  const retryable = (err: unknown): ClassifiedError =>
    ({
      category: 'stream_error',
      message: err instanceof Error ? err.message : String(err),
      retryable: true
    }) as ClassifiedError
  type Step = 'throw' | 'event-then-throw' | 'ok'
  let order: string[]
  let warn: ReturnType<typeof vi.fn<(event: string, data?: Record<string, unknown>) => void>>
  beforeEach(() => {
    vi.useFakeTimers()
    order = []
    warn = vi.fn<(event: string, data?: Record<string, unknown>) => void>()
    const logger = {
      debug: () => {},
      info: () => {},
      warn,
      error: () => {},
      child: () => logger
    }
    setRootLogger(logger)
  })
  afterEach(() => {
    setRootLogger(null)
    vi.useRealTimers()
  })
  function scripted(
    steps: Step[],
    failures: Error[] = []
  ): CoordinatorRuntime & {
    sendCount: number
  } {
    const runtime = fakeRuntime([[telemetry]])
    let count = 0
    const send = (): AsyncIterable<NormalizedEvent> => {
      const step = steps[count] ?? 'ok'
      const failure = failures[count] ?? new Error(`failure-${count + 1}`)
      count += 1
      order.push('send')
      return (async function* () {
        if (step === 'event-then-throw') yield sessionUpdated
        if (step !== 'ok') throw failure
        yield telemetry
      })()
    }
    return Object.defineProperties(runtime, {
      send: { value: send },
      listen: { value: send },
      sendCount: { get: () => count }
    })
  }
  function request(
    can: boolean,
    reopen: boolean
  ): TurnRequest & {
    canReopenInitialSubmission: ReturnType<typeof vi.fn>
    reopenInitialSubmission: ReturnType<typeof vi.fn>
  } {
    return {
      ...REQUEST,
      canReopenInitialSubmission: vi.fn(() => {
        order.push('canReopen')
        return can
      }),
      reopenInitialSubmission: vi.fn(() => {
        order.push('reopen')
        return reopen
      })
    }
  }
  async function run(
    runtime: CoordinatorRuntime,
    req: TurnRequest,
    opts: { kind?: 'listen'; afterRetrying?: (turn: TurnContext<W>) => void } = {}
  ): Promise<{ events: NormalizedEvent[]; deps: CoordDeps }> {
    const deps = makeDeps(runtime, { classifyError: vi.fn(retryable) })
    const turn = makeTurn()
    vi.mocked(deps.forward.forward).mockImplementation((_owner, ev) => {
      order.push(ev.type)
      if (ev.type === 'turn.retrying') opts.afterRetrying?.(turn)
    })
    const p = new TurnCoordinator(deps).run(turn, req, {
      sharedPathProjectId: null,
      ...(opts.kind ? { kind: opts.kind } : {})
    })
    await vi.runAllTimersAsync()
    await p
    return {
      events: vi.mocked(deps.forward.forward).mock.calls.map((call) => call[1] as NormalizedEvent),
      deps
    }
  }
  const types = (events: NormalizedEvent[]): string[] => events.map((ev) => ev.type)
  const errorMessage = (events: NormalizedEvent[]): string | undefined =>
    (events.find((ev) => ev.type === 'error') as { error?: ClassifiedError } | undefined)?.error
      ?.message

  it('B1 asks before backoff, reopens after backoff, then sends again', async () => {
    const runtime = scripted(['throw'])
    const req = request(true, true)
    const deps = makeDeps(runtime, { classifyError: vi.fn(retryable) })
    vi.mocked(deps.forward.forward).mockImplementation((_owner, ev) => {
      order.push(ev.type)
    })
    const p = new TurnCoordinator(deps).run(makeTurn(), req, { sharedPathProjectId: null })
    await vi.advanceTimersByTimeAsync(999)
    expect(order).toEqual(['send', 'canReopen', 'turn.retrying'])
    expect(req.reopenInitialSubmission).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect(order.slice(0, 5)).toEqual(['send', 'canReopen', 'turn.retrying', 'reopen', 'send'])
    expect(types(vi.mocked(deps.forward.forward).mock.calls.map((c) => c[1]))).not.toContain(
      'error'
    )
    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(
      'chat.turn.retrying',
      expect.objectContaining({
        attempt: 1,
        maxRetries: 2,
        category: 'stream_error',
        message: 'failure-1'
      })
    )
  })

  it('B2 does not retry when the reservation can no longer be reopened', async () => {
    const runtime = scripted(['throw'])
    const req = request(false, true)
    const { events } = await run(runtime, req)
    expect(types(events)).not.toContain('turn.retrying')
    expect(req.reopenInitialSubmission).not.toHaveBeenCalled()
    expect(errorMessage(events)).toBe('failure-1')
    expect(runtime.sendCount).toBe(1)
    expect(warn).not.toHaveBeenCalled()
  })

  it('B3 ends with the original error when the reopen after backoff fails', async () => {
    const runtime = scripted(['throw'])
    const { events } = await run(runtime, request(true, false))
    expect(types(events).filter((type) => type === 'turn.retrying')).toHaveLength(1)
    expect(errorMessage(events)).toBe('failure-1')
    expect(runtime.sendCount).toBe(1)
  })

  it.each([
    ['B4 after an event arrived', ['event-then-throw'] as Step[], [new Error('late')], retryable],
    [
      'B5 for a stale submission',
      ['throw'] as Step[],
      [new Error('submission_stale:before-spawn')],
      retryable
    ],
    [
      'B6 for a non-retryable error',
      ['throw'] as Step[],
      [new Error('fatal')],
      (err: unknown) => ({ ...retryable(err), retryable: false })
    ]
  ])('does not ask to reopen %s', async (_name, steps, failures, classify) => {
    const runtime = scripted(steps, failures)
    const req = request(true, true)
    const deps = makeDeps(runtime, { classifyError: vi.fn(classify) })
    const p = new TurnCoordinator(deps).run(makeTurn(), req, { sharedPathProjectId: null })
    await vi.runAllTimersAsync()
    await p
    expect(req.canReopenInitialSubmission).not.toHaveBeenCalled()
    expect(req.reopenInitialSubmission).not.toHaveBeenCalled()
    expect(runtime.sendCount).toBe(1)
  })

  it('B7 does not ask on the last attempt and reports the last original error', async () => {
    const runtime = scripted(['throw', 'throw', 'throw'])
    const req = request(true, true)
    const { events } = await run(runtime, req)
    expect(req.canReopenInitialSubmission).toHaveBeenCalledTimes(2)
    expect(req.reopenInitialSubmission).toHaveBeenCalledTimes(2)
    expect(runtime.sendCount).toBe(3)
    expect(types(events).filter((type) => type === 'turn.retrying')).toHaveLength(2)
    expect(errorMessage(events)).toBe('failure-3')
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('B8 a listen turn pushes no input, so it retries without the delegates', async () => {
    const runtime = scripted(['throw'])
    const req = request(false, false)
    const { events } = await run(runtime, req, { kind: 'listen' })
    expect(req.canReopenInitialSubmission).not.toHaveBeenCalled()
    expect(req.reopenInitialSubmission).not.toHaveBeenCalled()
    expect(runtime.sendCount).toBe(2)
    expect(types(events)).toContain('turn.retrying')
  })

  it('B10 a Stop during backoff skips the reopen and the second send', async () => {
    const runtime = scripted(['throw'])
    const req = request(true, true)
    await run(runtime, req, { afterRetrying: (turn) => turn.controller.abort() })
    expect(req.canReopenInitialSubmission).toHaveBeenCalledOnce()
    expect(req.reopenInitialSubmission).not.toHaveBeenCalled()
    expect(runtime.sendCount).toBe(1)
  })
})
