import { describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import { CHANNELS, type ChatActivitySnapshot, type NormalizedEvent } from '../../../shared/ipc'
import { sessionLeaseKey } from '../../../shared/lease-key'
import type { TurnContext } from '../../contracts/turn'
import type { SteerFlushBatch, TurnRequest } from '../../adapters/turn'
import type { LiveTurn, ProviderMessageBatch } from '../../adapters/types'
import { SessionRuntime } from '../../features/sessions/session-runtime'
import { RuntimeSupervisor } from '../../features/sessions/supervisor'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import {
  SessionActivityProjector,
  sessionForeground
} from '../../features/chat/session-activity-projector'
import { TurnCoordinator } from '../../features/chat/turn-coordinator'
import { TypedBus } from '../../infra/bus'
import type { OrcaBusEvents } from '../../contracts/bus-events'
import { makeClassifiedError } from '../../infra/errors'
import { setRootLogger } from '../../infra/log/registry'
import type { AppLogger } from '../../infra/log/log-manager'
import type { BackgroundEvent } from '../../../shared/background-task'

const ipc = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, raw: unknown) => Promise<void>>()
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (key: string, handler: (event: unknown, raw: unknown) => Promise<void>) =>
      ipc.handlers.set(key, handler)
  }
}))
vi.mock('../../infra/ipc/send', () => ({
  sendChatEvent: vi.fn(),
  broadcastBackgroundEvent: vi.fn()
}))
import { registerChatHandlers } from './index'
import { runTurnWithContinuations } from './post-turn'
import { sendChatEvent } from '../../infra/ipc/send'
import { buildTurnRequest } from './turn-request'
import { reserveOnBusySession } from './enqueue'

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const schedules = [{ id: 'cron1', schedule: '*/5 * * * *', recurring: true, prompt: 'check' }]

// 실제 runtime/coordinator/lease를 잇는다. SDK 스트림과 디스크 영속만 메모리 경계로 대체한다.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fixture(options: { activeChain?: boolean } = {}) {
  const queue: ProviderMessageBatch[] = []
  let wake: (() => void) | undefined
  let closed = false
  let sequence = 0
  const pushed: string[] = []
  const eventsAtPush: Array<Array<{ type: string }>> = []
  const live: LiveTurn = {
    eventBatches: (async function* () {
      while (!closed) {
        while (queue.length) yield queue.shift()!
        if (!closed)
          await new Promise<void>((resolve) => {
            wake = resolve
          })
      }
    })(),
    close: () => {
      closed = true
      wake?.()
    },
    pushTurn: async (input) => {
      eventsAtPush.push(vi.mocked(sendChatEvent).mock.calls.map((call) => call[1]))
      pushed.push(input.text)
      return { kind: 'accepted' }
    },
    interrupt: vi.fn(async () => undefined),
    setPermissionMode: async () => {},
    setModel: async () => {},
    stopTask: async () => {},
    backgroundTask: async () => false
  }
  const sendMessage = vi.fn(() => live)
  const runtime = new SessionRuntime({
    id: 'claude',
    sendMessage,
    complete: async () => '',
    classifyError: (error) => makeClassifiedError('stream_error', String(error))
  })
  const owner = { id: 1 } as WebContents
  const supervisor = new RuntimeSupervisor<WebContents>()
  const lease = supervisor.acquireChain({
    agentKind: 'work',
    logicalKey: sessionLeaseKey('s1'),
    sessionId: 's1',
    owner,
    requestedProviderKey: null
  }).lease
  const turn = {
    agentKind: 'work',
    controller: new AbortController(),
    owner,
    live: null,
    dbSessionId: 's1',
    cwd: '/w',
    extraDirs: [],
    openToolRuns: new Map(),
    askPendingIds: [],
    pendingAskAnswers: [],
    askResolved: new Map(),
    subagentTaskIds: new Map(),
    subagentTypes: new Map(),
    blockedSubagents: new Set(),
    stoppedSubagents: new Set()
  } as unknown as TurnContext<WebContents>
  supervisor.startResume('s1', turn)
  if (options.activeChain !== false) supervisor.activateChain(lease.leaseId, runtime, null, turn)
  const pendingMessages = new PendingMessageQueue()
  const backgroundTasks = new BackgroundTaskTracker()
  const activityEvents: ChatActivitySnapshot[] = []
  const activity = new SessionActivityProjector({
    queue: pendingMessages,
    backgroundTasks,
    leases: {
      foreground: (sessionId, transport) =>
        sessionForeground(supervisor.getChainBySession(sessionId), transport),
      subscribe: (listener) => supervisor.subscribeLeases(listener)
    },
    emit: (snapshot) => activityEvents.push(snapshot)
  })
  const events: NormalizedEvent[] = []
  const bus = new TypedBus<OrcaBusEvents<WebContents>>()
  bus.on('turn.event', ({ ev }) => {
    events.push(ev)
  })
  const persistence = {
    persist: () => {},
    flushAskAnswers: () => {},
    finalizeTurn: vi.fn(),
    commitUserMessage: () => 42
  }
  const coordinator = new TurnCoordinator({
    runtime,
    bus,
    persist: persistence,
    forward: {
      forward: (_owner, ev) => {
        events.push(ev)
      }
    },
    registry: supervisor,
    pendingMessages,
    backgroundTasks,
    activeTurns: supervisor.activeTurns,
    persistResponseBoundaries: () => true,
    classifyError: (error) => makeClassifiedError('stream_error', String(error))
  })
  registerChatHandlers({
    ctx: {},
    supervisor,
    bus,
    persistence,
    pendingMessages,
    backgroundTasks,
    activity,
    approvals: {},
    permissionModes: {},
    isUpdateInstallPending: () => false
  } as never)
  let activeTurn = turn
  let initialBatches: SteerFlushBatch[] = []
  const request: TurnRequest = buildTurnRequest(
    {
      wc: owner,
      pendingMessages,
      activity,
      chainId: lease.chainId,
      queueKey: 's1',
      getActiveTurn: () => activeTurn,
      getInitialBatches: () => initialBatches,
      settleDeadBackgroundTasks: async () => {}
    },
    {
      sessionId: 's1',
      text: 'initial',
      cwd: '/w',
      extensions: { skills: [], hooks: { normalized: {} } }
    }
  )
  let beforePrepare: (() => Promise<void>) | undefined
  const listenRelease = new Map<string, () => void>()
  const stopAndSettleAbortedTasks = vi.fn(async () => {})
  const run = (): Promise<void> =>
    runTurnWithContinuations(
      {
        coordinator,
        runtime,
        lease,
        supervisor,
        activity,
        pendingMessages,
        backgroundTasks,
        listenRelease,
        prepareContinuation: async () => {
          await beforePrepare?.()
          return {
            extensions: request.extensions,
            prepared: { runtimeEnvFingerprint: 'runtime-test', envFingerprint: 'env-test' },
            shouldRespawn: false
          }
        },
        settleDeadBackgroundTasks: async () => {},
        stopAndSettleAbortedTasks,
        getActiveTurn: () => activeTurn,
        setActiveTurn: (next) => {
          activeTurn = next
        },
        setInitialBatches: (batches) => {
          initialBatches = batches
        }
      },
      turn,
      request,
      null
    )
  return {
    runtime,
    supervisor,
    lease,
    turn,
    activity,
    activityEvents,
    backgroundTasks,
    events,
    persistence,
    live,
    sendMessage,
    eventsAtPush,
    stopAndSettleAbortedTasks,
    pushed,
    pendingMessages,
    listenRelease,
    run,
    warm: async (text = request.text) => {
      for await (const event of runtime.send({ ...request, text })) {
        void event
      }
    },
    active: () => activeTurn,
    beforePrepare: (callback: () => Promise<void>) => {
      beforePrepare = callback
    },
    emit: (...batch: NormalizedEvent[]) => {
      queue.push({ sequence: sequence++, events: batch })
      wake?.()
    },
    stop: () => ipc.handlers.get(CHANNELS.chatCancel)!({ sender: owner }, { sessionId: 's1' }),
    sendNow: (raw: unknown = { sessionId: 's1' }) =>
      ipc.handlers.get(CHANNELS.chatSteerSendNow)!({ sender: owner }, raw),
    queueHeld: (text: string, id: string) => {
      reserveOnBusySession(
        { pendingMessages, listenRelease },
        { sender: owner } as never,
        's1',
        's1',
        supervisor.getChainBySession('s1')!,
        { text, clientRequestId: id },
        { attachmentTexts: [], attachmentImages: [] }
      )
    },
    cleanup: () => {
      lease.controller.abort()
      activeTurn.controller.abort()
      runtime.close()
      activity.dispose()
    }
  }
}

describe('0250 queued input and send now through real runtime and handlers', () => {
  it('ST-01 — 도구 배치 세 번 동안 held를 유지하고 terminal 뒤 입력 순서대로 병합한다', async () => {
    vi.mocked(sendChatEvent).mockClear()
    const f = fixture()
    const running = f.run()
    try {
      await tick()
      f.queueHeld('first', 'first-id')
      f.queueHeld('second', 'second-id')
      for (let index = 0; index < 3; index++) {
        f.emit(
          {
            type: 'tool.call.started',
            sessionId: 's1',
            toolRunId: `tool${index}`,
            toolName: 'Read',
            args: {}
          },
          {
            type: 'tool.call.completed',
            sessionId: 's1',
            toolRunId: `tool${index}`,
            result: 'done',
            isError: false
          }
        )
        await tick()
        expect(f.pendingMessages.pending('s1').map((item) => item.id)).toEqual([
          'first-id',
          'second-id'
        ])
        expect(f.pushed).toEqual([])
      }
      f.emit({ type: 'telemetry', sessionId: 's1' })
      await tick()
      expect(f.pushed).toEqual(['first\n\nsecond'])
      expect(f.events.filter((event) => event.type === 'message.committed')).toEqual([])
      f.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'next answer' } })
      await tick()
      expect(f.events.filter((event) => event.type === 'message.committed')).toEqual([
        expect.objectContaining({ text: 'first\n\nsecond', ids: ['first-id', 'second-id'] })
      ])
      f.emit({ type: 'telemetry', sessionId: 's1' })
      await running
    } finally {
      f.cleanup()
      await running
    }
  })

  it('ST-02 — 즉시 보내기는 응답만 한 번 끊고 tail 이후 같은 채널로 held 전부를 보낸다', async () => {
    vi.mocked(sendChatEvent).mockClear()
    const f = fixture()
    const running = f.run()
    try {
      f.emit({
        type: 'tool.call.started',
        sessionId: 's1',
        toolRunId: 'foreground',
        toolName: 'Bash',
        args: {}
      })
      await tick()
      f.queueHeld('first', 'first-id')
      f.queueHeld('second', 'second-id')
      await f.sendNow()
      await f.sendNow()
      expect(f.live.interrupt).toHaveBeenCalledTimes(1)
      expect(f.persistence.finalizeTurn).toHaveBeenCalledTimes(1)
      expect(
        vi.mocked(sendChatEvent).mock.calls.filter((call) => call[1].type === 'turn.aborted')
      ).toHaveLength(1)
      expect(
        vi.mocked(sendChatEvent).mock.calls.filter((call) => call[1].type === 'message.cancelled')
      ).toEqual([])
      expect(f.events.find((event) => event.type === 'tool.call.completed')).toMatchObject({
        toolRunId: 'foreground',
        result: { reason: 'aborted' }
      })
      expect(f.lease.controller.signal.aborted).toBe(false)
      expect(f.pendingMessages.pending('s1')).toHaveLength(2)
      await tick()
      expect(f.pushed).toEqual([])
      f.emit(
        { type: 'message.delta', sessionId: 's1', delta: { text: 'cancelled tail' } },
        { type: 'telemetry', sessionId: 's1' }
      )
      await tick()
      expect(f.pushed).toEqual(['first\n\nsecond'])
      expect(f.sendMessage).toHaveBeenCalledTimes(1)
      expect(f.eventsAtPush[0]).toContainEqual(
        expect.objectContaining({ type: 'turn.aborted', reason: 'user_cancelled' })
      )
      expect(f.events).not.toContainEqual(
        expect.objectContaining({ type: 'message.delta', delta: { text: 'cancelled tail' } })
      )
      expect(f.active().abortContinuation).toBeUndefined()
      f.emit(
        { type: 'message.delta', sessionId: 's1', delta: { text: 'new answer' } },
        { type: 'telemetry', sessionId: 's1' }
      )
      await running
    } finally {
      f.cleanup()
      await running
    }
  })

  it.each(['response', 'listen'] as const)(
    'ST-02/ST-04 — %s 응답에서 send-now는 백그라운드를 유지하고 Stop은 한 번 중지한다',
    async (phase) => {
      for (const action of ['send-now', 'stop'] as const) {
        vi.mocked(sendChatEvent).mockClear()
        const f = fixture()
        f.backgroundTasks.started('s1', 'background1')
        const running = f.run()
        try {
          if (phase === 'listen') {
            f.emit({ type: 'telemetry', sessionId: 's1' })
            await tick()
            expect(f.runtime.responding).toBe(false)
          }
          f.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'working' } })
          await tick()
          expect(f.runtime.responding).toBe(true)
          f.queueHeld('continue', 'held1')
          if (action === 'send-now') await f.sendNow()
          else await f.stop()
          expect(f.live.interrupt).toHaveBeenCalledTimes(1)
          expect(f.persistence.finalizeTurn).toHaveBeenCalledTimes(1)
          expect(
            vi.mocked(sendChatEvent).mock.calls.filter((call) => call[1].type === 'turn.aborted')
          ).toHaveLength(1)
          expect(f.lease.controller.signal.aborted).toBe(false)
          f.emit({ type: 'telemetry', sessionId: 's1' })
          await tick()
          expect(f.stopAndSettleAbortedTasks).toHaveBeenCalledTimes(action === 'stop' ? 1 : 0)
          expect(f.backgroundTasks.hasPending('s1')).toBe(true)
          expect(f.pushed).toEqual(action === 'send-now' ? ['continue'] : [])
          if (action === 'send-now') {
            f.emit(
              { type: 'message.delta', sessionId: 's1', delta: { text: 'continued' } },
              { type: 'telemetry', sessionId: 's1' }
            )
            await tick()
          }
        } finally {
          f.cleanup()
          await running
        }
      }
    }
  )

  it('IT-01 — 신규 채널은 등록되며 무효 payload는 reject하고 대기 0건이면 무중단이다', async () => {
    vi.mocked(sendChatEvent).mockClear()
    const f = fixture()
    const running = f.run()
    try {
      expect(ipc.handlers.has(CHANNELS.chatSteerSendNow)).toBe(true)
      await expect(f.sendNow({})).rejects.toBeDefined()
      await expect(f.sendNow({ sessionId: '' })).rejects.toBeDefined()
      await tick()
      await expect(f.sendNow()).resolves.toBeUndefined()
      expect(f.live.interrupt).not.toHaveBeenCalled()
      expect(
        vi.mocked(sendChatEvent).mock.calls.filter((call) => call[1].type === 'turn.aborted')
      ).toEqual([])
    } finally {
      f.cleanup()
      await running
    }
  })

  it.each(['listen', 'flush'] as const)(
    '0250 subsequent Stop — %s 준비 중 후속 Stop은 즉시 보내기의 태스크 유지 정책을 바꾼다',
    async (step) => {
      const f = fixture()
      f.backgroundTasks.started('s1', 'background1')
      let release!: () => void
      const preparing = new Promise<void>((resolve) => {
        release = resolve
      })
      let preparationCount = 0
      let preparedStep: 'listen' | 'flush' | undefined
      f.beforePrepare(async () => {
        if (++preparationCount !== 1) return
        preparedStep =
          f.pendingMessages.pending('s1').length > 0 && !f.runtime.channelBusy ? 'flush' : 'listen'
        await preparing
      })
      const running = f.run()
      try {
        f.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'working' } })
        await tick()
        f.queueHeld('continue', 'held1')
        const sendNow = f.sendNow()
        if (step === 'listen') f.pendingMessages.cancel('s1', 'held1')
        f.emit({ type: 'telemetry', sessionId: 's1' })
        await sendNow
        await tick()
        expect(preparedStep).toBe(step)
        expect(f.active()).toBe(f.turn)
        expect(f.active().controller.signal.aborted).toBe(true)
        expect(f.active().abortContinuation).toBeUndefined()
        await f.stop()
        expect(f.active().abortContinuation).toBe('reception')
        expect(f.lease.controller.signal.aborted).toBe(false)
        release()
        await tick()
        expect(f.stopAndSettleAbortedTasks).toHaveBeenCalledTimes(1)
        expect(f.active()).not.toBe(f.turn)
        expect(f.active().controller.signal.aborted).toBe(false)
        expect(f.pushed).toEqual([])
      } finally {
        release()
        f.cleanup()
        await running
      }
    }
  )

  it('IT-01 — flush 준비 await의 턴 사이는 끊지 않고 기존 경로로 전달한다', async () => {
    vi.mocked(sendChatEvent).mockClear()
    const f = fixture()
    let release!: () => void
    const preparing = new Promise<void>((resolve) => {
      release = resolve
    })
    f.beforePrepare(() => preparing)
    const running = f.run()
    try {
      await tick()
      f.queueHeld('next', 'held1')
      f.emit({ type: 'telemetry', sessionId: 's1' })
      await tick()
      expect(f.runtime.responding).toBe(false)
      await f.sendNow()
      expect(f.live.interrupt).not.toHaveBeenCalled()
      expect(
        vi.mocked(sendChatEvent).mock.calls.filter((call) => call[1].type === 'turn.aborted')
      ).toEqual([])
      expect(f.pendingMessages.pending('s1')).toHaveLength(1)
      release()
      await tick()
      expect(f.pushed).toEqual(['next'])
      f.emit(
        { type: 'message.delta', sessionId: 's1', delta: { text: 'answer' } },
        { type: 'telemetry', sessionId: 's1' }
      )
      await running
    } finally {
      release()
      f.cleanup()
      await running
    }
  })

  it('IT-01 — 준비 중 체인과 수신 유휴는 held가 있어도 끊지 않는다', async () => {
    for (const phase of ['preparing', 'idle'] as const) {
      vi.mocked(sendChatEvent).mockClear()
      const f = fixture({ activeChain: phase !== 'preparing' })
      const running = f.run()
      try {
        if (phase === 'idle') {
          f.emit(
            { type: 'session.schedules', sessionId: 's1', schedules },
            { type: 'telemetry', sessionId: 's1' }
          )
        }
        await tick()
        // 유휴 수신은 enqueue 직후 릴리즈되어 전달한다. 판정 시점만 held로 구성해 무중단을 관측한다.
        f.pendingMessages.enqueue('s1', { text: 'next' }, Date.now(), 'held1')
        await f.sendNow()
        expect(f.live.interrupt).not.toHaveBeenCalled()
        expect(
          vi.mocked(sendChatEvent).mock.calls.filter((call) => call[1].type === 'turn.aborted')
        ).toEqual([])
      } finally {
        f.cleanup()
        await running
      }
    }
  })
})

describe('0243 interruption delivery through real runtime and handlers', () => {
  it.each(['cancel', 'discard', 'controller', 'chain', 'database-failure'] as const)(
    '%s closes the active response exactly once',
    async (source) => {
      vi.mocked(sendChatEvent).mockClear()
      const f = fixture()
      const interrupt = vi.spyOn(f.runtime, 'markAborted')
      const running = f.run()
      try {
        f.emit({
          type: 'tool.call.started',
          sessionId: 's1',
          toolRunId: 'long',
          toolName: 'Bash',
          args: {}
        })
        await tick()
        if (source === 'database-failure') {
          f.persistence.finalizeTurn.mockImplementation(() => {
            throw new Error('database unavailable')
          })
        }
        if (source === 'cancel') await f.stop()
        else if (source === 'discard') {
          await ipc.handlers.get(CHANNELS.chatDiscardSession)!(
            { sender: f.turn.owner },
            { sessionId: 's1' }
          )
        } else if (source === 'chain') f.supervisor.cancelChain('s1')
        else f.turn.controller.abort()
        await running
        const all = [...f.events, ...vi.mocked(sendChatEvent).mock.calls.map((call) => call[1])]
        expect(all.filter((ev) => ev.type === 'turn.aborted')).toEqual([
          {
            type: 'turn.aborted',
            sessionId: 's1',
            reason: source === 'cancel' ? 'user_cancelled' : 'interrupted'
          }
        ])
        expect(all.filter((ev) => ev.type === 'error')).toEqual([])
        expect(f.events.find((ev) => ev.type === 'tool.call.completed')).toMatchObject({
          result: { reason: 'aborted' }
        })
        expect(f.events.at(-1)).toMatchObject({
          type: 'response.boundary',
          boundary: { outcome: 'aborted' }
        })
        expect(f.persistence.finalizeTurn).toHaveBeenCalledTimes(1)
        expect(interrupt).toHaveBeenCalledTimes(1)
      } finally {
        f.cleanup()
        await running
      }
    }
  )
})

describe('scheduled reception after Stop', () => {
  it('예약 없이 백그라운드 작업만 기다려도 ready이며 즉시 재개한다', async () => {
    const f = fixture()
    f.backgroundTasks.started('s1', 'background1')
    const running = f.run()
    try {
      f.emit({ type: 'telemetry', sessionId: 's1' })
      await tick()
      expect(f.activity.current('s1')).toMatchObject({
        transport: 'ready',
        foreground: 'idle',
        backgroundTaskCount: 1
      })
      f.pendingMessages.enqueue('s1', { text: 'continue' }, Date.now(), 'continue1')
      f.listenRelease.get('s1')?.()
      await tick()
      expect(f.pushed).toEqual(['continue'])
      expect(f.activity.current('s1').transport).toBe('listening')
      f.emit({ type: 'telemetry', sessionId: 's1' })
      await tick()
      expect(f.activity.current('s1').transport).toBe('ready')
    } finally {
      f.cleanup()
      await running
    }
  })

  it('유휴 예약 수신은 ready이고 자동 응답 시작과 종료에 맞춰 전환한다', async () => {
    const f = fixture()
    const running = f.run()
    try {
      f.emit(
        { type: 'session.schedules', sessionId: 's1', schedules },
        { type: 'telemetry', sessionId: 's1' }
      )
      await tick()
      expect(f.activity.current('s1').transport).toBe('ready')
      expect(f.activity.current('s1').foreground).toBe('idle')
      expect(f.activityEvents.at(-1)).toMatchObject({ transport: 'ready', foreground: 'idle' })
      f.emit({
        type: 'tool.call.started',
        sessionId: 's1',
        toolRunId: 'child',
        toolName: 'Read',
        args: {},
        parentToolRunId: 'parent'
      })
      await tick()
      expect(f.activity.current('s1').transport).toBe('ready')
      f.emit({
        type: 'input.received',
        sessionId: 's1',
        text: 'scheduled check',
        origin: { kind: 'scheduled' }
      })
      await tick()
      expect(f.activity.current('s1').transport).toBe('listening')
      expect(f.activity.current('s1').foreground).toBe('streaming')
      expect(f.activityEvents.at(-1)).toMatchObject({
        transport: 'listening',
        foreground: 'streaming'
      })
      f.emit(
        { type: 'message.completed', sessionId: 's1', message: { text: 'done' } },
        { type: 'telemetry', sessionId: 's1' }
      )
      await tick()
      expect(f.activity.current('s1').transport).toBe('ready')
      expect(f.runtime.channelAlive).toBe(true)
      f.emit(
        { type: 'session.schedules', sessionId: 's1', schedules: [] },
        { type: 'telemetry', sessionId: 's1' }
      )
      await running
      expect(f.activity.current('s1').transport).toBe('idle')
    } finally {
      f.cleanup()
      await running
    }
  })

  it.each([false, true])(
    'ready 입력의 자동 응답 레이스(%s)는 이전 terminal 뒤 한 번만 전송한다',
    async (autoStarted) => {
      const f = fixture()
      const running = f.run()
      try {
        f.emit(
          { type: 'session.schedules', sessionId: 's1', schedules },
          { type: 'telemetry', sessionId: 's1' }
        )
        await tick()
        expect(f.activity.current('s1').transport).toBe('ready')
        if (autoStarted) {
          f.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'automatic answer' } })
          await tick()
        }
        f.pendingMessages.enqueue('s1', { text: 'resume now' }, Date.now(), 'resume1')
        f.listenRelease.get('s1')?.()
        await tick()
        if (autoStarted) {
          expect(f.pushed).toEqual([])
          expect(f.activity.current('s1').transport).toBe('listening')
          f.emit({ type: 'telemetry', sessionId: 's1' })
          await tick()
        }
        expect(f.pushed).toEqual(['resume now'])
        expect(f.activity.current('s1').transport).toBe('listening')
        expect(f.runtime.channelAlive).toBe(true)
        f.emit({ type: 'telemetry', sessionId: 's1' })
        await tick()
        expect(f.activity.current('s1').transport).toBe('ready')
      } finally {
        f.cleanup()
        await running
      }
    }
  )

  it('첫 wakeup의 예약 목록을 받기 전 Stop도 수신 lease와 다음 자동 응답을 보존한다', async () => {
    const f = fixture()
    const running = f.run()
    try {
      f.emit({
        type: 'session.schedules',
        sessionId: 's1',
        schedules: [],
        pendingWakeup: true
      })
      await tick()
      const stoppedChild = f.active()
      await f.stop()
      expect(f.lease.controller.signal.aborted).toBe(false)
      f.emit({ type: 'telemetry', sessionId: 's1' })
      await tick()
      expect(f.active()).not.toBe(stoppedChild)
      expect(f.active().controller.signal.aborted).toBe(false)
      f.emit(
        {
          type: 'input.received',
          sessionId: 's1',
          text: 'first wakeup',
          origin: { kind: 'automatic' }
        },
        { type: 'message.completed', sessionId: 's1', message: { text: 'wakeup answer' } },
        { type: 'telemetry', sessionId: 's1' }
      )
      await tick()
      expect(f.events).toContainEqual(
        expect.objectContaining({ type: 'message.committed', text: 'first wakeup' })
      )
      expect(f.events).toContainEqual(
        expect.objectContaining({
          type: 'message.completed',
          message: { text: 'wakeup answer' }
        })
      )
      expect(f.pushed).toEqual([])
    } finally {
      f.cleanup()
      await running
    }
  })

  it('준비 중 취소된 최초 prompt는 push하지 않고 살아 있는 예약 수신부터 연다', async () => {
    const f = fixture()
    const warm = f.warm()
    f.emit(
      { type: 'session.schedules', sessionId: 's1', schedules },
      { type: 'telemetry', sessionId: 's1' }
    )
    await warm
    f.turn.controller.abort()
    f.turn.abortContinuation = 'reception'
    const running = f.run()
    try {
      await tick()
      expect(f.pushed).toEqual([])
      expect(f.active()).not.toBe(f.turn)
      f.emit(
        {
          type: 'input.received',
          sessionId: 's1',
          text: 'still receiving',
          origin: { kind: 'scheduled' }
        },
        { type: 'telemetry', sessionId: 's1' }
      )
      await tick()
      expect(f.events).toContainEqual(
        expect.objectContaining({ type: 'message.committed', text: 'still receiving' })
      )
    } finally {
      f.cleanup()
      await running
    }
  })
  it.each(['response', 'idle'] as const)(
    '%s 중 Stop은 체인을 유지하고 새 수신 child로 다음 예약을 전달한다',
    async (phase) => {
      const f = fixture()
      const running = f.run()
      try {
        f.emit({ type: 'session.schedules', sessionId: 's1', schedules })
        if (phase === 'idle') f.emit({ type: 'telemetry', sessionId: 's1' })
        await tick()
        const stoppedChild = f.active()
        await f.stop()
        expect(f.lease.controller.signal.aborted).toBe(false)
        if (phase === 'response') f.emit({ type: 'telemetry', sessionId: 's1' })
        await tick()
        expect(f.active()).not.toBe(stoppedChild)
        expect(f.active().controller.signal.aborted).toBe(false)
        expect(
          f.supervisor.acquireChain({
            logicalKey: sessionLeaseKey('s1'),
            sessionId: 's1',
            owner: f.turn.owner,
            requestedProviderKey: null
          }).acquired
        ).toBe(false)
        f.emit(
          { type: 'input.received', sessionId: 's1', text: 'check', origin: { kind: 'scheduled' } },
          { type: 'message.completed', sessionId: 's1', message: { text: 'scheduled answer' } },
          { type: 'telemetry', sessionId: 's1' }
        )
        await tick()
        expect(f.events).toContainEqual(
          expect.objectContaining({ type: 'message.committed', text: 'check' })
        )
        expect(f.events).toContainEqual(
          expect.objectContaining({
            type: 'message.completed',
            message: { text: 'scheduled answer' }
          })
        )
        expect(f.pushed).toEqual([])
      } finally {
        f.cleanup()
        await running
      }
    }
  )

  it('예약 없는 Stop은 기존처럼 체인까지 취소한다', async () => {
    const f = fixture()
    const running = f.run()
    try {
      await tick()
      await f.stop()
      await running
      expect(f.lease.controller.signal.aborted).toBe(true)
    } finally {
      f.cleanup()
      await running
    }
  })

  it('다음 수신 준비 await 중 Stop도 취소된 child를 다음 예약에 재사용하지 않는다', async () => {
    const f = fixture()
    let release!: () => void
    const preparing = new Promise<void>((resolve) => {
      release = resolve
    })
    f.beforePrepare(() => preparing)
    const running = f.run()
    try {
      f.emit(
        { type: 'session.schedules', sessionId: 's1', schedules },
        { type: 'telemetry', sessionId: 's1' }
      )
      await tick()
      await f.stop()
      release()
      await tick()
      expect(f.active()).not.toBe(f.turn)
      expect(f.active().controller.signal.aborted).toBe(false)
      f.emit(
        {
          type: 'input.received',
          sessionId: 's1',
          text: 'after preparation',
          origin: { kind: 'scheduled' }
        },
        { type: 'telemetry', sessionId: 's1' }
      )
      await tick()
      expect(f.events).toContainEqual(
        expect.objectContaining({ type: 'message.committed', text: 'after preparation' })
      )
    } finally {
      release()
      f.cleanup()
      await running
    }
  })

  it('Stop 직후 held 입력은 취소 tail을 비운 뒤 같은 채널로 한 번 전송한다', async () => {
    const f = fixture()
    const running = f.run()
    try {
      f.emit(
        { type: 'session.schedules', sessionId: 's1', schedules },
        { type: 'message.delta', sessionId: 's1', delta: { text: 'working' } }
      )
      await tick()
      await f.stop()
      await tick()
      f.pendingMessages.enqueue('s1', { text: 'after stop' }, Date.now(), 'held1')
      f.listenRelease.get('s1')?.()
      await tick()
      expect(f.pushed).toEqual([])
      f.emit(
        { type: 'message.delta', sessionId: 's1', delta: { text: 'cancelled tail' } },
        { type: 'telemetry', sessionId: 's1' }
      )
      await tick()
      expect(f.pushed).toEqual(['after stop'])
      expect(f.runtime.hasSchedules).toBe(true)
      expect(f.events).not.toContainEqual(
        expect.objectContaining({ type: 'message.delta', delta: { text: 'cancelled tail' } })
      )
      f.emit({ type: 'telemetry', sessionId: 's1' })
    } finally {
      f.cleanup()
      await running
    }
  })

  it('owner/discard의 lease abort는 예약이 있어도 수신을 다시 열지 않는다', async () => {
    const f = fixture()
    const running = f.run()
    try {
      f.emit(
        { type: 'session.schedules', sessionId: 's1', schedules },
        { type: 'telemetry', sessionId: 's1' }
      )
      await tick()
      const child = f.active()
      await f.stop()
      f.lease.controller.abort()
      await running
      expect(f.active()).toBe(child)
    } finally {
      f.cleanup()
      await running
    }
  })
})

// 0239 AC12·AC13 · SD-03 · §10 EP-05 ③④ · EP-09 — 포그라운드 태스크는 턴 후 대기와 Stop 을 붙잡지 않는다.
describe('0239 — 포그라운드 태스크와 턴 후 판정', () => {
  let sequence = 0
  const taskStarted = (taskId: string, isBackgrounded: boolean): BackgroundEvent => ({
    type: 'background.task',
    sessionId: 's1',
    source: { generation: 'g1', sequence: ++sequence, receivedAt: sequence, replay: false },
    taskId,
    toolUseId: `tool-${taskId}`,
    phase: 'started',
    patch: { status: 'running', taskType: 'local_agent', isBackgrounded }
  })
  const spyLogger = (): { logger: AppLogger; steps: Array<Record<string, unknown>> } => {
    const steps: Array<Record<string, unknown>> = []
    const logger: AppLogger = {
      debug: () => {},
      warn: () => {},
      error: () => {},
      info: (event: string, fields?: Record<string, unknown>) => {
        if (event === 'chat.postturn.step') steps.push(fields ?? {})
      },
      child: () => logger
    } as unknown as AppLogger
    return { logger, steps }
  }

  it('AC12·AC13 — 포그라운드 태스크만 남으면 break 하고 로그 haveTasks 는 판정 값과 같다', async () => {
    const { logger, steps } = spyLogger()
    setRootLogger(logger)
    const f = fixture()
    f.backgroundTasks.observe(taskStarted('fg', false))
    const running = f.run()
    try {
      f.emit({ type: 'telemetry', sessionId: 's1' })
      await tick()
      expect(f.activity.current('s1').transport).toBe('idle')
      await running
      expect(f.lease.controller.signal.aborted).toBe(false)
      expect(steps.at(-1)).toMatchObject({ step: 'break', haveTasks: false })
      // 표시 수(`count`)는 판정과 별개 필드다 — live 집합 기준이라 포그라운드는 0 이다.
      expect(steps.at(-1)).toMatchObject({ taskCount: f.backgroundTasks.count('s1') })
    } finally {
      setRootLogger(null)
      f.cleanup()
      await running
    }
  })

  it('대조 — 백그라운드 태스크가 남으면 수신을 연다(ready)', async () => {
    const f = fixture()
    f.backgroundTasks.observe(taskStarted('bg', true))
    const running = f.run()
    try {
      f.emit({ type: 'telemetry', sessionId: 's1' })
      await tick()
      expect(f.activity.current('s1').transport).toBe('ready')
    } finally {
      f.cleanup()
      await running
    }
  })

  it('AC12 — 포그라운드 태스크만 남은 Stop은 끝나고 다음 입력을 즉시 전달한다', async () => {
    const f = fixture()
    f.backgroundTasks.observe(taskStarted('fg', false))
    const running = f.run()
    try {
      await tick()
      await f.stop()
      expect(f.lease.controller.signal.aborted).toBe(true)
      await running
      expect(f.activity.current('s1').transport).toBe('idle')
      // send.ts의 finally 경계: post-turn이 끝나야 lease 회수가 실행된다.
      f.supervisor.releaseChain(f.lease.leaseId)
      const next = f.supervisor.acquireChain({
        logicalKey: sessionLeaseKey('s1'),
        sessionId: 's1',
        owner: f.turn.owner,
        requestedProviderKey: null
      })
      expect(next.acquired).toBe(true)
      f.emit({ type: 'telemetry', sessionId: 's1' })
      await tick()
      const sent = f.warm('after stop')
      await tick()
      expect(f.pushed).toEqual(['after stop'])
      f.emit({ type: 'telemetry', sessionId: 's1' })
      await sent
      f.supervisor.releaseChain(next.lease.leaseId)
    } finally {
      f.cleanup()
      await running
    }
  })

  it('대조 — 백그라운드 태스크가 남은 Stop 은 수신을 잇는다(0143)', async () => {
    const f = fixture()
    f.backgroundTasks.observe(taskStarted('bg', true))
    const running = f.run()
    try {
      await tick()
      await f.stop()
      await tick()
      expect(f.lease.controller.signal.aborted).toBe(false)
    } finally {
      f.cleanup()
      await running
    }
  })
})
