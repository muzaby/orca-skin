import { describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import { CHANNELS, type ChatActivitySnapshot, type NormalizedEvent } from '../../../shared/ipc'
import { sessionLeaseKey } from '../../../shared/lease-key'
import type { TurnContext } from '../../contracts/turn'
import type { TurnRequest } from '../../adapters/turn'
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

const ipc = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, raw: unknown) => Promise<void>>()
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (key: string, handler: (event: unknown, raw: unknown) => Promise<void>) =>
      ipc.handlers.set(key, handler)
  }
}))
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))
import { registerChatHandlers } from './index'
import { runTurnWithContinuations } from './post-turn'

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const schedules = [{ id: 'cron1', schedule: '*/5 * * * *', recurring: true, prompt: 'check' }]

// 실제 runtime/coordinator/lease를 잇는다. SDK 스트림과 디스크 영속만 메모리 경계로 대체한다.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fixture() {
  const queue: ProviderMessageBatch[] = []
  let wake: (() => void) | undefined
  let closed = false
  let sequence = 0
  const pushed: string[] = []
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
      pushed.push(input.text)
      return { kind: 'accepted' }
    },
    interrupt: async () => undefined,
    setPermissionMode: async () => {},
    setModel: async () => {},
    stopTask: async () => {},
    backgroundTask: async () => false
  }
  const runtime = new SessionRuntime({
    id: 'claude',
    sendMessage: () => live,
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
  supervisor.activateChain(lease.leaseId, runtime, null, turn)
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
    finalizeTurn: () => {},
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
  const request: TurnRequest = {
    sessionId: 's1',
    text: 'initial',
    cwd: '/w',
    extensions: { skills: [], hooks: { normalized: {} } },
    onSessionSchedules: (id, values, pendingWakeup) =>
      activity.setSchedules(id, values, pendingWakeup)
  }
  let activeTurn = turn
  let beforePrepare: (() => Promise<void>) | undefined
  const listenRelease = new Map<string, () => void>()
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
        stopAndSettleAbortedTasks: async () => {},
        getActiveTurn: () => activeTurn,
        setActiveTurn: (next) => {
          activeTurn = next
        },
        setInitialBatches: () => {}
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
    pushed,
    pendingMessages,
    listenRelease,
    run,
    warm: async () => {
      for await (const event of runtime.send(request)) {
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
    cleanup: () => {
      lease.controller.abort()
      activeTurn.controller.abort()
      runtime.close()
      activity.dispose()
    }
  }
}

describe('scheduled reception after Stop', () => {
  it('예약 없이 백그라운드 작업만 기다려도 ready이며 즉시 재개한다', async () => {
    const f = fixture()
    f.backgroundTasks.started('s1', 'background1')
    // 0231 D-104 — 배지 세기는 런치 영수증 관측분이다. 이 케이스의 주어는 "실제로 백그라운드로
    // 도는 작업" 이므로 영수증까지 모형한다(추적 등록만으로는 foreground 일 수 있다).
    f.backgroundTasks.markAsyncLaunched('s1', 'background1')
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
    f.turn.resumeScheduledReception = true
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
