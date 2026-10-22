import { describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import { CHANNELS, type NormalizedEvent } from '../../../shared/ipc'
import type { BackgroundEvent, ProviderMessageEvent } from '../../../shared/background-task'
import type { TurnContext } from '../../contracts/turn'
import type { OrcaBusEvents } from '../../contracts/bus-events'
import type { SteerFlushBatch } from '../../adapters/common/turn'
import type { TurnPersistSink } from '../../features/chat/turn-sinks'
import { createOpenCodeAdapter, type OpenCodeServer } from '../../adapters/opencode'
import {
  assistantMessage,
  editTool,
  jsonResponse,
  openCodeEvent,
  textPart,
  type Event,
  type UserMessage
} from '../../adapters/opencode/v1/adapter.testfixture'
import { SessionRuntime } from '../../features/sessions/session-runtime'
import { RuntimeSupervisor } from '../../features/sessions/supervisor'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import { BackgroundController } from '../../features/chat/background-controller'
import {
  SessionActivityProjector,
  sessionForeground
} from '../../features/chat/session-activity-projector'
import { TurnCoordinator } from '../../features/chat/turn-coordinator'
import { settleTrackedTasks } from '../../features/chat/settle'
import { TypedBus } from '../../infra/bus'
import { sessionLeaseKey } from '../../../shared/lease-key'
import { buildTurnRequest } from './turn-request'
import { makeContinuationTurn } from './turn-context'
import { runTurnWithContinuations } from './post-turn'
import { registerChatHandlers } from './index'
import { reserveOnBusySession } from './enqueue'

const ipc = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, raw: unknown) => Promise<void>>()
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (key: string, handler: (event: unknown, raw: unknown) => Promise<void>) =>
      ipc.handlers.set(key, handler)
  }
}))

vi.mock('../../infra/log', async () => import('../../infra/log/registry'))
vi.mock('../../infra/ipc/send', () => ({
  sendChatEvent: vi.fn(),
  broadcastBackgroundEvent: vi.fn()
}))

vi.setConfig({ testTimeout: 15_000 })

type Prompt = { messageID: string; parts: Array<{ type: string; text?: string }> }
type UserCommit = Parameters<NonNullable<TurnPersistSink<WebContents>['commitUserMessage']>>[1]
const waitFor = (assertion: () => void): Promise<void> =>
  vi.waitFor(assertion, { timeout: 5000, interval: 10 })

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  return { promise: new Promise<void>((done) => (resolve = done)), resolve }
}

// The SDK HTTP/SSE transport and disk/IPC sinks are the only substitutes. The adapter,
// runtime pump, provider controller/tracker, queue, coordinator and post-turn loop are real.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fixture(abortEvents?: 'idle-only' | 'message-error' | 'session-error') {
  const encoder = new TextEncoder()
  const streams: Array<{
    controller: ReadableStreamDefaultController<Uint8Array>
    closed: boolean
  }> = []
  const requests: Request[] = []
  const prompts: Prompt[] = []
  let nextPromptResponse: (() => Promise<Response>) | undefined
  const emit = (event: Event, streamIndex = streams.length - 1): void => {
    const stream = streams[streamIndex]
    if (stream.closed) throw new Error('Fixture SSE stream is closed')
    stream.controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ directory: 'C:/work', payload: event })}\n\n`)
    )
  }
  const nativeUser = (id: string, sessionID = 's1'): void => {
    const info: UserMessage = {
      id,
      sessionID,
      role: 'user',
      time: { created: Date.now() },
      agent: 'build',
      model: { providerID: 'fixture', modelID: 'model' }
    }
    emit(openCodeEvent('message.updated', { sessionID, info }))
  }
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    const path = new URL(request.url).pathname
    if (path === '/config') return jsonResponse({})
    if (path === '/instance/dispose') {
      emit(openCodeEvent('server.instance.disposed', { directory: 'C:/work' }))
      return jsonResponse(true)
    }
    if (path === '/command' || path === '/agent') return jsonResponse([])
    if (path === '/provider') return jsonResponse({ all: [], connected: [], default: {} })
    if (path === '/session') return jsonResponse({ id: 's1' })
    if (path === '/global/event') {
      const streamIndex = streams.length
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            const entry = { controller, closed: false }
            streams.push(entry)
            emit(openCodeEvent('server.connected', {}), streamIndex)
            request.signal.addEventListener('abort', () => {
              if (entry.closed) return
              entry.closed = true
              try {
                controller.close()
              } catch {
                // SDK cancellation may have already closed this transport fixture.
              }
            })
          },
          cancel() {
            streams[streamIndex].closed = true
          }
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    }
    if (path.endsWith('/prompt_async')) {
      const prompt = (await request.json()) as Prompt
      prompts.push(prompt)
      nativeUser(prompt.messageID)
      emit(
        openCodeEvent('message.part.updated', {
          sessionID: 's1',
          part: textPart(prompt.parts.find((part) => part.type === 'text')?.text ?? '', {
            id: `host-part-${prompts.length}`,
            messageID: prompt.messageID,
            time: { start: Date.now(), end: Date.now() }
          }),
          time: Date.now()
        })
      )
      const respond = nextPromptResponse
      nextPromptResponse = undefined
      return respond ? respond() : new Response(null, { status: 204 })
    }
    if (path.endsWith('/abort')) {
      if (abortEvents === 'message-error')
        emit(
          openCodeEvent('message.updated', {
            sessionID: 's1',
            info: {
              ...assistantMessage('s1', prompts.at(-1)!.messageID, 'interrupted-answer'),
              error: { name: 'MessageAbortedError', data: { message: 'Aborted' } }
            }
          })
        )
      if (abortEvents === 'session-error')
        emit(
          openCodeEvent('session.error', {
            sessionID: 's1',
            error: { name: 'MessageAbortedError', data: { message: 'Aborted' } }
          })
        )
      if (abortEvents) emit(openCodeEvent('session.idle', { sessionID: 's1' }))
      return jsonResponse(true)
    }
    throw new Error(`Unexpected request: ${request.method} ${path}`)
  }
  const server: OpenCodeServer = {
    acquire: async () => ({ url: 'http://opencode.test', headers: {} }),
    installed: async () => ({ installed: true, version: '1.19.0' }),
    close: () => {}
  }
  const adapter = createOpenCodeAdapter({
    dataDirectory: 'unused',
    preferences: () => undefined,
    fetchImpl,
    server
  })
  const runtime = new SessionRuntime(adapter)
  const owner = { id: 1 } as WebContents
  const supervisor = new RuntimeSupervisor<WebContents>()
  const lease = supervisor.acquireChain({
    agentKind: 'code',
    logicalKey: sessionLeaseKey('s1'),
    sessionId: 's1',
    owner,
    requestedProviderKey: null
  }).lease
  let activeTurn = {
    agentKind: 'code',
    controller: new AbortController(),
    owner,
    live: null,
    dbSessionId: 's1',
    cwd: 'C:/work',
    extraDirs: [],
    pendingUserText: null,
    firstUserText: 'initial',
    pendingAttachmentViews: [],
    currentAssistantMessageId: null,
    assistantText: '',
    openToolRuns: new Map(),
    askPendingIds: [],
    pendingAskAnswers: [],
    askResolved: new Map(),
    subagentTaskIds: new Map(),
    subagentTypes: new Map(),
    blockedSubagents: new Set(),
    stoppedSubagents: new Set()
  } as unknown as TurnContext<WebContents>
  supervisor.startResume('s1', activeTurn)
  supervisor.activateChain(lease.leaseId, runtime, null, activeTurn)
  const pendingMessages = new PendingMessageQueue()
  const backgroundTasks = new BackgroundTaskTracker()
  const journal: Array<BackgroundEvent | ProviderMessageEvent> = []
  const background = new BackgroundController({
    tracker: backgroundTasks,
    persist(event, committed) {
      journal.push(event)
      committed()
    },
    load: () => [],
    publish: () => {},
    runtime: () => ({
      identity: runtime,
      generation: runtime.providerGeneration,
      stopTask: (taskId) => runtime.stopTask(taskId)
    }),
    roots: () => [],
    outputs: {} as never
  })
  const activity = new SessionActivityProjector({
    queue: pendingMessages,
    backgroundTasks,
    leases: {
      foreground: (sessionId, transport) =>
        sessionForeground(supervisor.getChainBySession(sessionId), transport),
      subscribe: (listener) => supervisor.subscribeLeases(listener)
    },
    emit: () => {}
  })
  const events: NormalizedEvent[] = []
  const commits: UserCommit[] = []
  const bus = new TypedBus<OrcaBusEvents<WebContents>>()
  bus.on('turn.event', ({ ev }) => events.push(ev))
  const persistence: TurnPersistSink<WebContents> = {
    persist: () => {},
    flushAskAnswers: () => {},
    finalizeTurn: () => {},
    commitUserMessage(_turn, input) {
      commits.push(structuredClone(input))
      return commits.length
    }
  }
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
  const coordinator = new TurnCoordinator({
    runtime,
    bus,
    persist: persistence,
    forward: { forward: (_owner, event) => events.push(event) },
    registry: supervisor,
    pendingMessages,
    backgroundTasks,
    activeTurns: supervisor.activeTurns,
    persistResponseBoundaries: () => true,
    classifyError: (error, phase) => adapter.classifyError(error, phase)
  })
  const settleDeadBackgroundTasks = (
    turn: TurnContext<WebContents>,
    sessionId: string
  ): Promise<void> =>
    settleTrackedTasks(
      turn,
      (current, ev) => bus.emit('turn.event', { turn: current, ev }),
      sessionId,
      backgroundTasks,
      { status: 'failed', summary: 'Channel closed.', stopLive: false }
    )
  const stopAndSettleAbortedTasks = (
    turn: TurnContext<WebContents>,
    sessionId: string
  ): Promise<void> =>
    settleTrackedTasks(
      turn,
      (current, ev) => bus.emit('turn.event', { turn: current, ev }),
      sessionId,
      backgroundTasks,
      { status: 'stopped', summary: 'User stopped waiting.', stopLive: true }
    )
  const listenRelease = new Map<string, () => void>()
  let initialBatches: SteerFlushBatch[] = []
  let beforePrepare: (() => Promise<void>) | undefined
  const runs: Promise<void>[] = []
  let completedRuns = 0
  const run = (text = 'initial'): Promise<void> => {
    activeTurn = makeContinuationTurn(activeTurn)
    supervisor.startResume('s1', activeTurn)
    const item = pendingMessages.enqueue('s1', { text })
    initialBatches = [pendingMessages.reserveItem('s1', item.id, lease.chainId)!]
    const request = buildTurnRequest(
      {
        wc: owner,
        pendingMessages,
        activity,
        chainId: lease.chainId,
        queueKey: 's1',
        getActiveTurn: () => activeTurn,
        getInitialBatches: () => initialBatches,
        settleDeadBackgroundTasks
      },
      {
        sessionId: 's1',
        promptUuid: initialBatches[0].uuid,
        text,
        cwd: 'C:/work',
        signal: activeTurn.controller.signal,
        model: 'fixture/model',
        extensions: { skills: [], hooks: { normalized: {} } },
        onProviderEvent: (event) => background.observe(event)
      }
    )
    const running = runTurnWithContinuations(
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
            prepared: { runtimeEnvFingerprint: 'fixture', envFingerprint: 'fixture' },
            shouldRespawn: false
          }
        },
        settleDeadBackgroundTasks,
        stopAndSettleAbortedTasks,
        getActiveTurn: () => activeTurn,
        setActiveTurn: (next) => (activeTurn = next),
        setInitialBatches: (next) => (initialBatches = next)
      },
      activeTurn,
      request,
      null
    )
    runs.push(running)
    void running.then(
      () => completedRuns++,
      () => completedRuns++
    )
    return running
  }
  const assistant = (parentID: string, id: string): void => {
    const info = assistantMessage('s1', parentID, id)
    info.time = { created: Date.now(), completed: Date.now() }
    emit(openCodeEvent('message.updated', { sessionID: 's1', info }))
  }
  const text = (messageID: string, value: string): void => {
    emit(
      openCodeEvent('message.part.updated', {
        sessionID: 's1',
        part: textPart(value, {
          id: `${messageID}-text`,
          messageID,
          time: { start: Date.now(), end: Date.now() }
        }),
        time: Date.now()
      })
    )
  }
  const idle = (sessionID = 's1'): void => emit(openCodeEvent('session.idle', { sessionID }))
  const feed = (messageID: string, value: string, partID = `${messageID}-part`): Event => {
    nativeUser(messageID)
    const event = openCodeEvent('message.part.updated', {
      sessionID: 's1',
      part: textPart(value, {
        id: partID,
        messageID,
        synthetic: true,
        time: { start: Date.now(), end: Date.now() }
      }),
      time: Date.now()
    })
    emit(event)
    return event
  }
  const launch = (children = ['child-1'], suffix = ''): void => {
    const messageID = `assistant-launch${suffix}`
    assistant(prompts.at(-1)!.messageID, messageID)
    for (const child of children) {
      emit(
        openCodeEvent('message.part.updated', {
          sessionID: 's1',
          part: editTool({
            id: `${child}-tool-part${suffix}`,
            messageID,
            callID: `${child}-call${suffix}`,
            tool: 'task',
            state: {
              status: 'completed',
              input: { description: child, prompt: 'inspect', subagent_type: 'explore' },
              output: `Background task ${child} started`,
              title: child,
              metadata: { sessionId: child, jobId: `${child}-job`, background: true },
              time: { start: Date.now(), end: Date.now() }
            }
          }),
          time: Date.now()
        })
      )
    }
    text(messageID, 'Background work started.')
  }
  const complete = (child: string, index = 1): string => {
    const messageID = `native-completion-${index}`
    feed(
      messageID,
      `<task id="${child}" state="completed"><task_result>Finished ${child}.</task_result></task>`
    )
    return messageID
  }
  const reply = (parentID: string, value: string, id = 'assistant-completion'): void => {
    assistant(parentID, id)
    text(id, value)
    idle()
  }
  return {
    runtime,
    requests,
    prompts,
    events,
    commits,
    journal,
    backgroundTasks,
    activity,
    emit,
    feed,
    nativeUser,
    assistant,
    text,
    launch,
    complete,
    reply,
    idle,
    run,
    sendNow: () =>
      ipc.handlers.get(CHANNELS.chatSteerSendNow)!({ sender: owner }, { sessionId: 's1' }),
    queueHeld: (text: string, id: string) =>
      reserveOnBusySession(
        { pendingMessages, listenRelease },
        { sender: owner } as never,
        's1',
        's1',
        supervisor.getChainBySession('s1')!,
        { text, clientRequestId: id },
        { attachmentTexts: [], attachmentImages: [] }
      ),
    completedRuns: () => completedRuns,
    subscriptionCount: () => streams.length,
    beforePrepare: (callback: () => Promise<void>) => (beforePrepare = callback),
    respondToNextPrompt: (callback: () => Promise<Response>) => (nextPromptResponse = callback),
    waitForPrompt: (count = 1) => waitFor(() => expect(prompts).toHaveLength(count)),
    waitReady: () => waitFor(() => expect(activity.current('s1').transport).toBe('ready')),
    disconnect: () => {
      const stream = streams.at(-1)!
      stream.closed = true
      stream.controller.close()
    },
    interrupt: () => {
      activeTurn.abortContinuation = 'send-now'
      activeTurn.controller.abort()
    },
    cleanup: async () => {
      lease.controller.abort()
      activeTurn.controller.abort()
      runtime.close()
      background.dispose('s1')
      activity.dispose()
      await Promise.allSettled(runs)
    }
  }
}

describe('OpenCode provider continuations through the real session pipeline', () => {
  it.each(['idle-only', 'message-error', 'session-error'] as const)(
    'send-now interrupts unfinished work immediately and starts one response without an error retry (%s)',
    async (abortEvents) => {
      const f = fixture(abortEvents)
      const running = f.run()
      try {
        await f.waitForPrompt()
        f.emit(
          openCodeEvent('message.updated', {
            sessionID: 's1',
            info: {
              ...assistantMessage('s1', f.prompts[0].messageID, 'interrupted-answer'),
              finish: undefined
            }
          })
        )
        f.emit(
          openCodeEvent('message.part.updated', {
            sessionID: 's1',
            time: 1,
            part: editTool({
              messageID: 'interrupted-answer',
              callID: 'unfinished-tool',
              state: { status: 'running', input: { filePath: 'sample.md' }, time: { start: 1 } }
            })
          })
        )
        await waitFor(() =>
          expect(f.events.some((ev) => ev.type === 'tool.call.started')).toBe(true)
        )
        f.queueHeld('Stop that and answer this instead.', 'immediate-input')
        await f.sendNow()
        // The fixture never completes the tool or sends a natural response end.
        // Only the explicit abort produces a cancellation boundary.
        await f.waitForPrompt(2)
        const controls = f.requests
          .map((req) => new URL(req.url).pathname)
          .filter((path) => /\/(abort|prompt_async)$/.test(path))
        expect(controls).toEqual([
          '/session/s1/prompt_async',
          '/session/s1/abort',
          '/session/s1/prompt_async'
        ])
        expect(f.prompts[1].parts[0].text).toBe('Stop that and answer this instead.')
        f.emit(
          openCodeEvent('message.updated', {
            sessionID: 's1',
            info: {
              ...assistantMessage('s1', f.prompts[0].messageID, 'interrupted-answer'),
              error: { name: 'MessageAbortedError', data: { message: 'Interrupted' } }
            }
          })
        )
        f.emit(
          openCodeEvent('message.part.updated', {
            sessionID: 's1',
            time: 3,
            part: textPart('stale cancelled response', { messageID: 'interrupted-answer' })
          })
        )
        f.reply(f.prompts[1].messageID, 'Switched immediately.', 'new-answer')
        await running
        expect(f.commits.map((commit) => commit.text)).toEqual([
          'initial',
          'Stop that and answer this instead.'
        ])
        expect(f.events.filter((ev) => ev.type === 'error' || ev.type === 'turn.retrying')).toEqual(
          []
        )
        expect(f.events).toContainEqual(
          expect.objectContaining({
            type: 'message.completed',
            message: { text: 'Switched immediately.' }
          })
        )
        expect(f.subscriptionCount()).toBe(1)
        expect(f.runtime.channelAlive).toBe(true)
        expect(JSON.stringify(f.events)).not.toContain('stale cancelled response')
      } finally {
        await f.cleanup()
      }
    }
  )
  it('receives the background completion after first idle without another prompt', async () => {
    const f = fixture()
    const running = f.run()
    try {
      await f.waitForPrompt()
      f.launch()
      f.idle()
      await f.waitReady()
      expect(f.completedRuns()).toBe(0)
      expect(f.runtime.channelAlive).toBe(true)
      expect(f.backgroundTasks.hasPending('s1')).toBe(true)
      expect(Object.values(f.backgroundTasks.getState('s1').tasks)).toEqual([
        expect.objectContaining({
          taskId: 'opencode:["child-1-job","child-1-call"]',
          status: 'running'
        })
      ])
      expect(Object.values(f.backgroundTasks.getState('s1').calls)).toContainEqual(
        expect.objectContaining({ toolUseId: 'child-1-call', mode: 'background' })
      )
      f.idle('child-1')
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(f.backgroundTasks.hasPending('s1')).toBe(true)
      const parentID = f.complete('child-1')
      f.reply(parentID, 'Background result received.')
      await running
      expect(f.backgroundTasks.hasPending('s1')).toBe(false)
      expect(Object.values(f.backgroundTasks.getState('s1').tasks)).toEqual([
        expect.objectContaining({
          taskId: 'opencode:["child-1-job","child-1-call"]',
          status: 'completed'
        })
      ])
      expect(f.events).toContainEqual({
        type: 'message.completed',
        sessionId: 's1',
        nativeMessageId: 'assistant-completion',
        message: { text: 'Background result received.' }
      })
      expect(f.prompts).toHaveLength(1)
      expect(f.subscriptionCount()).toBe(1)
      const usage = f.events.filter((event) => event.type === 'telemetry')
      expect(usage).toHaveLength(2)
      expect(usage.map((event) => event.type === 'telemetry' && event.usage?.outputTokens)).toEqual(
        [20, 20]
      )
    } finally {
      await f.cleanup()
    }
  })

  it('commits each native feed once before its provider reply', async () => {
    const f = fixture()
    const running = f.run()
    try {
      await f.waitForPrompt()
      const value = '<system-reminder>Continue the requested work.</system-reminder>'
      const received = f.feed('native-reminder', value)
      f.emit(received)
      f.emit({ ...received, id: 'redelivered-part-event' })
      f.reply('native-reminder', 'Continued once.')
      await running
      expect(f.commits.filter((commit) => commit.origin)).toEqual([
        expect.objectContaining({
          text: value,
          origin: { kind: 'automatic', format: 'system-reminder' }
        })
      ])
      expect(f.commits.filter((commit) => !commit.origin).map((commit) => commit.text)).toEqual([
        'initial'
      ])
      const receivedIndex = f.events.findIndex(
        (event) => event.type === 'message.committed' && event.origin !== undefined
      )
      const responseIndex = f.events.findIndex(
        (event) => event.type === 'message.completed' && event.message.text === 'Continued once.'
      )
      expect(receivedIndex).toBeGreaterThanOrEqual(0)
      expect(responseIndex).toBeGreaterThan(receivedIndex)
      expect(f.events.filter((event) => event.type === 'input.received')).toEqual([])
      expect(f.prompts).toHaveLength(1)
    } finally {
      await f.cleanup()
    }
  })

  it('retains completion received between root idle and listen registration', async () => {
    const f = fixture()
    const entered = deferred()
    const resume = deferred()
    f.beforePrepare(async () => {
      entered.resolve()
      await resume.promise
    })
    const running = f.run()
    try {
      await f.waitForPrompt()
      f.launch()
      f.idle()
      await entered.promise
      const parentID = f.complete('child-1')
      f.reply(parentID, 'Reply between frames.')
      await waitFor(() => expect(f.runtime.hasUnframedBacklog).toBe(true))
      expect(f.completedRuns()).toBe(0)
      resume.resolve()
      await running
      expect(f.commits.filter((commit) => commit.origin)).toHaveLength(1)
      expect(f.events).toContainEqual({
        type: 'message.completed',
        sessionId: 's1',
        nativeMessageId: 'assistant-completion',
        message: { text: 'Reply between frames.' }
      })
      expect(f.backgroundTasks.hasPending('s1')).toBe(false)
      expect(f.prompts).toHaveLength(1)
      expect(f.subscriptionCount()).toBe(1)
    } finally {
      resume.resolve()
      await f.cleanup()
    }
  })

  it('receives concurrent background completions and a later user turn on one subscription', async () => {
    const f = fixture()
    const running = f.run()
    try {
      await f.waitForPrompt()
      f.launch(['child-1', 'child-2'])
      f.idle()
      await f.waitReady()
      f.reply(f.complete('child-1', 1), 'First result.', 'assistant-first')
      await waitFor(() => {
        expect(f.commits.filter((commit) => commit.origin)).toHaveLength(1)
        expect(f.activity.current('s1').transport).toBe('ready')
      })
      expect(f.backgroundTasks.hasPending('s1')).toBe(true)
      expect(f.completedRuns()).toBe(0)
      expect(
        Object.values(f.backgroundTasks.getState('s1').tasks).map((task) => task.status)
      ).toEqual(['completed', 'running'])
      f.reply(f.complete('child-2', 2), 'Second result.', 'assistant-second')
      await running
      expect(f.backgroundTasks.hasPending('s1')).toBe(false)
      const next = f.run('explicit follow-up')
      await f.waitForPrompt(2)
      f.reply(f.prompts[1].messageID, 'Explicit reply.', 'assistant-explicit')
      await next
      expect(f.subscriptionCount()).toBe(1)
      expect(f.prompts.map((prompt) => prompt.parts[0].text)).toEqual([
        'initial',
        'explicit follow-up'
      ])
      expect(f.commits.filter((commit) => commit.origin)).toHaveLength(2)
    } finally {
      await f.cleanup()
    }
  })

  it('ends a disconnected chain without replaying accepted input', async () => {
    const f = fixture()
    const running = f.run()
    try {
      await f.waitForPrompt()
      f.launch()
      f.idle()
      await f.waitReady()
      const firstGeneration = f.runtime.providerGeneration
      f.disconnect()
      await running
      expect(f.runtime.channelAlive).toBe(false)
      expect(f.backgroundTasks.hasPending('s1')).toBe(false)
      expect(f.events).toContainEqual(
        expect.objectContaining({
          type: 'error',
          error: expect.objectContaining({ retryable: false })
        })
      )
      expect(f.prompts).toHaveLength(1)
      const next = f.run('new explicit input')
      await f.waitForPrompt(2)
      f.reply(f.prompts[1].messageID, 'Reconnected reply.', 'assistant-reconnected')
      await next
      expect(f.runtime.providerGeneration).not.toBe(firstGeneration)
      expect(f.subscriptionCount()).toBe(2)
      expect(f.prompts.map((prompt) => prompt.parts[0].text)).toEqual([
        'initial',
        'new explicit input'
      ])
    } finally {
      await f.cleanup()
    }
  })

  it('retires a warm channel after prompt rejection without leaking buffered replies or replaying input', async () => {
    const f = fixture()
    const response = deferred()
    const first = f.run()
    try {
      await f.waitForPrompt()
      f.reply(f.prompts[0].messageID, 'First reply.', 'assistant-first')
      await first
      const firstGeneration = f.runtime.providerGeneration

      f.respondToNextPrompt(async () => {
        await response.promise
        return jsonResponse({ error: 'Provider rejected this prompt.' }, 503)
      })
      const failed = f.run('rejected explicit input')
      await f.waitForPrompt(2)
      f.feed('native-rejected-reminder', '<system-reminder>Rejected turn feed.</system-reminder>')
      f.reply('native-rejected-reminder', 'Rejected turn reply.', 'assistant-rejected')
      response.resolve()
      await failed

      expect(f.runtime.channelAlive).toBe(false)
      expect(f.subscriptionCount()).toBe(1)
      expect(f.prompts).toHaveLength(2)
      expect(f.commits.map((commit) => commit.text)).toEqual(['initial'])
      expect(f.events.filter((event) => event.type === 'error')).toEqual([
        expect.objectContaining({ error: expect.objectContaining({ retryable: false }) })
      ])
      expect(f.events.filter((event) => event.type === 'message.completed')).toEqual([
        {
          type: 'message.completed',
          sessionId: 's1',
          nativeMessageId: 'assistant-first',
          message: { text: 'First reply.' }
        }
      ])

      const next = f.run('new explicit input')
      await f.waitForPrompt(3)
      f.reply(f.prompts[2].messageID, 'Fresh reply.', 'assistant-fresh')
      await next
      expect(f.runtime.providerGeneration).not.toBe(firstGeneration)
      // A rejected submission replaces the channel, while the healthy shared SSE stays live.
      expect(f.subscriptionCount()).toBe(1)
      expect(f.prompts.map((prompt) => prompt.parts[0].text)).toEqual([
        'initial',
        'rejected explicit input',
        'new explicit input'
      ])
      expect(f.commits.map((commit) => commit.text)).toEqual(['initial', 'new explicit input'])
      expect(f.events.filter((event) => event.type === 'message.completed')).toEqual([
        {
          type: 'message.completed',
          sessionId: 's1',
          nativeMessageId: 'assistant-first',
          message: { text: 'First reply.' }
        },
        {
          type: 'message.completed',
          sessionId: 's1',
          nativeMessageId: 'assistant-fresh',
          message: { text: 'Fresh reply.' }
        }
      ])
    } finally {
      response.resolve()
      await f.cleanup()
    }
  })

  it('keeps a reused child session pending until its new task invocation completes', async () => {
    const f = fixture()
    const first = f.run()
    try {
      await f.waitForPrompt()
      f.launch()
      f.idle()
      await f.waitReady()
      f.reply(f.complete('child-1', 1), 'First invocation complete.', 'assistant-first')
      await first
      const firstTasks = Object.values(f.backgroundTasks.getState('s1').tasks)
      expect(firstTasks).toHaveLength(1)
      expect(firstTasks[0].status).toBe('completed')

      const second = f.run('reuse child session')
      await f.waitForPrompt(2)
      f.launch(['child-1'], '-reuse')
      f.idle()
      await f.waitReady()
      const tasks = Object.values(f.backgroundTasks.getState('s1').tasks)
      expect(tasks.map((task) => task.status)).toEqual(['completed', 'running'])
      expect(new Set(tasks.map((task) => task.taskId)).size).toBe(2)
      expect(f.backgroundTasks.hasPending('s1')).toBe(true)
      expect(f.completedRuns()).toBe(1)

      f.reply(f.complete('child-1', 2), 'Second invocation complete.', 'assistant-reused')
      await second
      expect(f.backgroundTasks.hasPending('s1')).toBe(false)
      expect(
        Object.values(f.backgroundTasks.getState('s1').tasks).map((task) => task.status)
      ).toEqual(['completed', 'completed'])
      expect(f.prompts).toHaveLength(2)
      expect(f.subscriptionCount()).toBe(1)
    } finally {
      await f.cleanup()
    }
  })

  it('resumes reception after interrupt without retaining cancelled tail', async () => {
    const f = fixture()
    const running = f.run()
    try {
      await f.waitForPrompt()
      f.launch()
      await waitFor(() => expect(f.backgroundTasks.hasPending('s1')).toBe(true))
      f.interrupt()
      await waitFor(() =>
        expect(
          f.requests.filter((request) => new URL(request.url).pathname === '/session/s1/abort')
        ).toHaveLength(1)
      )
      f.assistant(f.prompts[0].messageID, 'assistant-cancelled-tail')
      f.text('assistant-cancelled-tail', 'Cancelled tail must not appear.')
      f.idle()
      await f.waitReady()
      f.reply(f.complete('child-1'), 'Still received completion.')
      await running
      expect(f.events).not.toContainEqual(
        expect.objectContaining({
          type: 'message.completed',
          message: { text: 'Cancelled tail must not appear.' }
        })
      )
      expect(f.events).toContainEqual({
        type: 'message.completed',
        sessionId: 's1',
        nativeMessageId: 'assistant-completion',
        message: { text: 'Still received completion.' }
      })
      expect(f.commits.filter((commit) => commit.origin)).toHaveLength(1)
      expect(f.prompts).toHaveLength(1)
      expect(f.subscriptionCount()).toBe(1)
      expect(f.runtime.channelAlive).toBe(true)
    } finally {
      await f.cleanup()
    }
  })
})
