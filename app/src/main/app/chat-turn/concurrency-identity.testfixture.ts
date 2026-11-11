import { vi } from 'vitest'
import type { WebContents } from 'electron'
import {
  CHANNELS,
  type ChatActivitySnapshot,
  type NormalizedEvent,
  type ConcurrencyEvent,
  type ClassifiedError
} from '../../../shared/ipc'
import { sessionLeaseKey } from '../../../shared/lease-key'
import type { TurnContext } from '../../contracts/turn'
import type { SteerFlushBatch, TurnRequest } from '../../adapters/common/turn'
import type { LiveTurn, ProviderMessageBatch } from '../../adapters/common/types'
import { SessionRuntime } from '../../features/sessions/session-runtime'
import { RuntimeSupervisor } from '../../features/sessions/supervisor'
import { ActiveTurnTracker } from '../../features/sessions/active-turn-tracker'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import {
  SessionActivityProjector,
  sessionForeground
} from '../../features/chat/session-activity-projector'
import { TurnCoordinator } from '../../features/chat/turn-coordinator'
import { TypedBus } from '../../infra/bus'
import type { OoBusEvents } from '../../contracts/bus-events'
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
vi.mock('../../infra/ipc/send', () => ({
  sendChatEvent: vi.fn(),
  broadcastBackgroundEvent: vi.fn()
}))
import { registerChatHandlers } from './index'
import { runTurnWithContinuations } from './post-turn'
import { sendChatEvent } from '../../infra/ipc/send'
import { buildTurnRequest } from './turn-request'
import { reserveOnBusySession } from './enqueue'

// 실제 runtime/coordinator/lease를 잇는다. SDK 스트림과 디스크 영속만 메모리 경계로 대체한다.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function concurrencyFixture(
  options: {
    sharedPathProjectId?: string | null
    classifyError?: (error: unknown) => ClassifiedError
    /** A real reserved initial prompt (enqueue + reserveItem), as `chat:send` makes for a turn. */
    initial?: string
  } = {}
) {
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
  const concurrency: ConcurrencyEvent[] = []
  const supervisor = new RuntimeSupervisor<WebContents>({
    activeTurns: new ActiveTurnTracker((event) => concurrency.push(event))
  })
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
    isNewSession: false,
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
  const bus = new TypedBus<OoBusEvents<WebContents>>()
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
    classifyError:
      options.classifyError ?? ((error) => makeClassifiedError('stream_error', String(error)))
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
  if (options.initial !== undefined) {
    pendingMessages.enqueue('s1', { text: options.initial }, 1, 'initial-message')
    initialBatches = [pendingMessages.reserveItem('s1', 'initial-message', lease.chainId)!]
  }
  const request: TurnRequest = buildTurnRequest(
    {
      wc: owner,
      pendingMessages,
      activity,
      queueKey: 's1',
      getActiveTurn: () => activeTurn,
      getInitialBatches: () => initialBatches,
      settleDeadBackgroundTasks: async () => {}
    },
    {
      sessionId: 's1',
      text: options.initial ?? 'initial',
      ...(initialBatches[0] ? { promptUuid: initialBatches[0].uuid } : {}),
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
        },
        getInitialBatches: () => initialBatches
      },
      turn,
      request,
      options.sharedPathProjectId === undefined ? 'p1' : options.sharedPathProjectId
    )
  return {
    runtime,
    coordinator,
    request,
    concurrency,
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
    initialBatches: () => initialBatches,
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
