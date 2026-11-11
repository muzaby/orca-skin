import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcess, spawn } from 'node:child_process'
import type { WebContents } from 'electron'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import { createOpenCodeAdapter } from '../../adapters/opencode'
import { OpenCodeServerPool } from '../../adapters/opencode/v1/server'
import { RuntimePool } from '../../features/sessions/runtime-pool'
import {
  assistantMessage,
  jsonResponse,
  openCodeEvent,
  textPart
} from '../../adapters/opencode/v1/adapter.testfixture'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import { SessionActivityProjector } from '../../features/chat/session-activity-projector'
import { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import { SessionRuntime } from '../../features/sessions/session-runtime'
import { buildTurnRequest } from './turn-request'

vi.mock('../../infra/log', async () => import('../../infra/log/registry'))
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))

const adapters: ReturnType<typeof createOpenCodeAdapter>[] = []
afterEach(() => {
  for (const adapter of adapters.splice(0)) adapter.close?.()
})

function fixture(): {
  adapter: ReturnType<typeof createOpenCodeAdapter>
  runtime: SessionRuntime
  requests: Request[]
  rejectPrompt: () => void
  setConfigGate: (gate?: Promise<void>) => void
  setPromptGate: (gate?: Promise<void>) => void
  setIdleGate: (gate?: Promise<void>) => void
  killed: ReturnType<typeof vi.fn>
} {
  const requests: Request[] = []
  const encoder = new TextEncoder()
  let stream: ReadableStreamDefaultController<Uint8Array>
  let streamClosed = false
  let rejected = false
  let configGate: Promise<void> | undefined
  let promptGate: Promise<void> | undefined
  let idleGate: Promise<void> | undefined
  const emit = (event: ReturnType<typeof openCodeEvent>): void => {
    if (streamClosed) return
    stream.enqueue(
      encoder.encode(`data: ${JSON.stringify({ directory: 'C:/work', payload: event })}\n\n`)
    )
  }
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    const path = new URL(request.url).pathname
    if (path === '/global/health') return jsonResponse({ healthy: true })
    if (path === '/config') {
      if (configGate) await configGate
      return jsonResponse({})
    }
    if (path === '/instance/dispose') {
      emit(openCodeEvent('server.instance.disposed', { directory: 'C:/work' }))
      return jsonResponse(true)
    }
    if (path === '/command') return jsonResponse([])
    if (path === '/agent')
      return jsonResponse([
        { name: 'build', mode: 'primary' },
        { name: 'plan', mode: 'primary' }
      ])
    if (path === '/provider')
      return jsonResponse({
        all: [
          { id: 'fixture', models: { model: { id: 'model', variants: { low: {}, high: {} } } } }
        ],
        connected: ['fixture'],
        default: {}
      })
    if (path === '/session') return jsonResponse({ id: 's1' })
    if (path === '/global/event') {
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            stream = controller
            streamClosed = false
            request.signal.addEventListener(
              'abort',
              () => {
                if (!streamClosed) {
                  streamClosed = true
                  try {
                    controller.close()
                  } catch {
                    // already closed
                  }
                }
              },
              { once: true }
            )
            emit(openCodeEvent('server.connected', {}))
          },
          cancel() {
            streamClosed = true
          }
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    }
    if (path.endsWith('/prompt_async')) {
      if (promptGate) await promptGate
      if (rejected) return jsonResponse({ message: 'Rejected fixture prompt' }, 400)
      const body = (await request.json()) as { messageID: string }
      emit(
        openCodeEvent('message.updated', {
          sessionID: 's1',
          info: assistantMessage('s1', body.messageID, `assistant-${body.messageID}`)
        })
      )
      emit(
        openCodeEvent('message.part.updated', {
          sessionID: 's1',
          part: textPart('Runtime reply', {
            id: `part-${body.messageID}`,
            messageID: `assistant-${body.messageID}`,
            time: { start: 1, end: 2 }
          }),
          time: 2
        })
      )
      if (idleGate) {
        const gate = idleGate
        void gate.then(() => emit(openCodeEvent('session.idle', { sessionID: 's1' })))
      } else {
        emit(openCodeEvent('session.idle', { sessionID: 's1' }))
      }
      return new Response(null, { status: 204 })
    }
    if (path.endsWith('/abort')) return jsonResponse(true)
    throw new Error(`Unexpected request: ${request.method} ${path}`)
  }
  const killed = vi.fn(() => true)
  const server = new OpenCodeServerPool({
    dataDirectory: 'unused',
    preferences: () => undefined,
    fetchImpl,
    executable: () => 'fixture',
    readVersion: async () => '1.19.0',
    allocatePort: async () => 49123,
    spawnProcess: (() => {
      const child = Object.assign(new EventEmitter(), {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        kill: killed
      })
      queueMicrotask(() =>
        child.stdout.emit(
          'data',
          Buffer.from('opencode server listening on http://127.0.0.1:49123\n')
        )
      )
      return child as unknown as ChildProcess
    }) as typeof spawn
  })
  const adapter = createOpenCodeAdapter({
    dataDirectory: 'unused',
    preferences: () => undefined,
    fetchImpl,
    server
  })
  adapters.push(adapter)
  return {
    adapter,
    runtime: new SessionRuntime(adapter),
    requests,
    killed,
    rejectPrompt: () => {
      rejected = true
    },
    setConfigGate: (gate) => {
      configGate = gate
    },
    setPromptGate: (gate) => {
      promptGate = gate
    },
    setIdleGate: (gate) => {
      idleGate = gate
    }
  }
}

function admission(
  sessionId: string | null,
  activity: SessionActivityProjector = {} as SessionActivityProjector
): {
  request: ReturnType<typeof buildTurnRequest>
  pending: PendingMessageQueue
  commit: ReturnType<typeof vi.spyOn>
} {
  const pending = new PendingMessageQueue()
  const queueKey = sessionId ?? 'draft'
  const item = pending.enqueue(queueKey, { text: 'Hello' })
  const batch = pending.reserveItem(queueKey, item.id, 'chain')!
  const activeTurn = { dbSessionId: sessionId } as TurnContext<WebContents>
  const request = buildTurnRequest(
    {
      wc: {} as WebContents,
      pendingMessages: pending,
      activity,
      queueKey,
      getActiveTurn: () => activeTurn,
      getInitialBatches: () => [batch],
      settleDeadBackgroundTasks: async () => {}
    },
    {
      sessionId,
      cwd: 'C:/work',
      text: batch.text,
      promptUuid: batch.uuid,
      model: 'fixture/model',
      extensions: { skills: [], hooks: { normalized: {} } }
    }
  )
  return { request, pending, commit: vi.spyOn(pending, 'commitMany') }
}

async function collect(
  runtime: SessionRuntime,
  request: ReturnType<typeof buildTurnRequest>
): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = []
  for await (const event of runtime.send(request)) events.push(event)
  return events
}

describe('OpenCode submission through the production queue and session runtime', () => {
  it('reuses a live OpenCode process and releases it through the common runtime LRU', async () => {
    const first = fixture()
    const second = fixture()
    const pool = new RuntimePool<SessionRuntime>()
    try {
      await collect(first.runtime, admission('s1').request)
      expect(pool.keepIdle('first', first.runtime)).toBe(true)
      const reused = pool.take('first')!
      await collect(reused, admission('s1').request)
      pool.keepIdle('first', reused)
      expect(
        first.requests.filter((r) => new URL(r.url).pathname === '/global/health')
      ).toHaveLength(1)
      await collect(second.runtime, admission('s1').request)
      pool.keepIdle('second', second.runtime)
      expect(pool.evictToCapacity(1)).toBe(1)
      expect(first.runtime.channelAlive).toBe(false)
      expect(first.killed).not.toHaveBeenCalled()
      first.adapter.close?.()
      await vi.waitFor(() => expect(first.killed).toHaveBeenCalledOnce())
      expect(second.killed).not.toHaveBeenCalled()
      expect(pool.peek('second')).toBe(second.runtime)
      pool.closeAll()
      expect(second.runtime.channelAlive).toBe(false)
      expect(second.killed).not.toHaveBeenCalled()
      second.adapter.close?.()
      await vi.waitFor(() => expect(second.killed).toHaveBeenCalledOnce())
    } finally {
      first.runtime.close()
      second.runtime.close()
    }
  })
  it('forwards changed agent and variant with attachments on the existing channel', async () => {
    const { runtime, requests } = fixture()
    try {
      await collect(runtime, {
        ...admission('s1').request,
        harnessAgent: 'build',
        modelVariant: 'low'
      })
      const next = admission('s1').request
      const events = await collect(runtime, {
        ...next,
        harnessAgent: 'plan',
        modelVariant: 'high',
        attachmentImages: [
          {
            id: 'img',
            name: 'image.png',
            mimeType: 'image/png',
            sourceKind: 'dialog',
            data: 'AAAA'
          }
        ]
      })
      const submitted = requests.filter((item) => item.url.includes('prompt_async'))
      const payloads = await Promise.all(submitted.map((item) => item.json()))
      expect(payloads[0]).toMatchObject({ agent: 'build', variant: 'low' })
      expect(payloads[1]).toMatchObject({
        agent: 'plan',
        variant: 'high',
        parts: [
          { type: 'text', text: 'Hello' },
          { type: 'file', url: 'data:image/png;base64,AAAA' }
        ]
      })
      expect(payloads[1].messageID).not.toBe(payloads[0].messageID)
      expect(events).toContainEqual({
        type: 'input.echo',
        sessionId: 's1',
        nativeMessageId: payloads[1].messageID,
        text: 'Hello',
        uuid: next.promptUuid
      })
      expect(
        requests.filter((item) => new URL(item.url).pathname === '/global/event')
      ).toHaveLength(1)
      expect(requests.filter((item) => new URL(item.url).pathname === '/config')).toHaveLength(1)
    } finally {
      runtime.close()
    }
  })
  it.each([null, 's1'])(
    'delivers a reply after runtime admission for session %s',
    async (sessionId) => {
      const { runtime, requests } = fixture()
      try {
        for (const currentSession of [sessionId, 's1']) {
          const { request, commit } = admission(currentSession)
          expect(request.canSubmitInitial!()).toBe(true)
          const events = await collect(runtime, request)
          const submitted = requests.findLast((item) =>
            new URL(item.url).pathname.endsWith('/prompt_async')
          )
          if (!submitted) throw new Error('provider prompt was not submitted')
          const { messageID } = (await submitted.clone().json()) as { messageID: string }
          expect(commit).toHaveBeenCalledOnce()
          // A committed claim is deliberately no longer eligible for admission.
          expect(request.canSubmitInitial!()).toBe(false)
          expect(events).toContainEqual({
            type: 'input.echo',
            sessionId: 's1',
            nativeMessageId: messageID,
            text: 'Hello',
            uuid: request.promptUuid
          })
          expect(events).toContainEqual({
            type: 'message.completed',
            sessionId: 's1',
            nativeMessageId: `assistant-${messageID}`,
            message: { text: 'Runtime reply' }
          })
          expect(events.at(-1)?.type).toBe('turn.ended')
        }
        expect(
          requests.filter((request) => new URL(request.url).pathname.endsWith('/prompt_async'))
        ).toHaveLength(2)
      } finally {
        runtime.close()
      }
    }
  )

  it('rejects a withdrawn reservation in the runtime before contacting the provider', async () => {
    const { runtime, requests } = fixture()
    const { request, pending, commit } = admission('s1')
    pending.rollback('s1', request.promptUuid!)
    try {
      await expect(collect(runtime, request)).rejects.toThrow('submission_stale:before-spawn')
      expect(commit).not.toHaveBeenCalled()
      expect(requests).toEqual([])
    } finally {
      runtime.close()
    }
  })

  it('surfaces a rejected HTTP prompt as an error without fabricating an echo or reply', async () => {
    const { runtime, rejectPrompt } = fixture()
    rejectPrompt()
    const { request, commit } = admission('s1')
    try {
      const events = await collect(runtime, request)
      expect(commit).toHaveBeenCalledOnce()
      expect(events.map((event) => event.type)).toEqual(['session.updated', 'error'])
    } finally {
      runtime.close()
    }
  })

  it('IT-02: forwards waitPhase sequence [server, project, session, mcp, send, model, null] on 1st turn and omits server on 2nd turn', async () => {
    const { adapter, runtime } = fixture()
    expect(adapter.reportsWaitPhases).toBe(true)
    const setWaitPhase = vi.fn()
    const activity = { setWaitPhase } as unknown as SessionActivityProjector
    try {
      await collect(runtime, admission(null, activity).request)
      expect(setWaitPhase.mock.calls.map(([key, phase]) => [key, phase])).toEqual([
        ['draft', { kind: 'server' }],
        ['draft', { kind: 'project' }],
        ['draft', { kind: 'session' }],
        ['draft', { kind: 'mcp' }],
        ['draft', { kind: 'send' }],
        ['draft', { kind: 'model' }],
        ['draft', null]
      ])

      setWaitPhase.mockClear()
      await collect(runtime, admission('s1', activity).request)
      const secondPhases = setWaitPhase.mock.calls.map(([, phase]) => phase)
      expect(secondPhases).toEqual([{ kind: 'mcp' }, { kind: 'send' }, { kind: 'model' }, null])
      expect(secondPhases).not.toContainEqual({ kind: 'server' })
    } finally {
      runtime.close()
    }
  })

  it('ST-01: projects waitPhase through SessionActivityProjector across 1st turn /config gate, 2nd turn prompt_async gate, and 3rd turn close()', async () => {
    const { runtime, setConfigGate, setPromptGate, setIdleGate } = fixture()
    const queue = new PendingMessageQueue()
    const backgroundTasks = new BackgroundTaskTracker()
    const projector = new SessionActivityProjector({
      queue,
      backgroundTasks,
      leases: {
        foreground: () => 'streaming',
        subscribe: () => () => {}
      },
      emit: () => {}
    })
    try {
      // Turn 1: gate on /config -> current('s1').waitPhase.kind === 'project', clear on model output & completion
      const configGate = Promise.withResolvers<void>()
      const idleGate = Promise.withResolvers<void>()
      setConfigGate(configGate.promise)
      setIdleGate(idleGate.promise)
      const turn1 = collect(runtime, admission('s1', projector).request)
      await vi.waitFor(() => expect(projector.current('s1').waitPhase?.kind).toBe('project'))
      setConfigGate(undefined)
      configGate.resolve()
      await vi.waitFor(() => expect(projector.current('s1').waitPhase).toBeUndefined())
      setIdleGate(undefined)
      idleGate.resolve()
      await turn1
      expect(projector.current('s1').waitPhase).toBeUndefined()

      // Turn 2: gate on /prompt_async -> current('s1').waitPhase.kind === 'send', then clear on completion
      const promptGate2 = Promise.withResolvers<void>()
      setPromptGate(promptGate2.promise)
      const turn2 = collect(runtime, admission('s1', projector).request)
      await vi.waitFor(() => expect(projector.current('s1').waitPhase?.kind).toBe('send'))
      setPromptGate(undefined)
      promptGate2.resolve()
      await turn2
      expect(projector.current('s1').waitPhase).toBeUndefined()

      // Turn 3: gate on /prompt_async -> runtime.close() -> waitPhase cleared
      const promptGate3 = Promise.withResolvers<void>()
      setPromptGate(promptGate3.promise)
      const turn3 = collect(runtime, admission('s1', projector).request)
      await vi.waitFor(() => expect(projector.current('s1').waitPhase?.kind).toBe('send'))
      runtime.close()
      promptGate3.resolve()
      await turn3.catch(() => undefined)
      await vi.waitFor(() => expect(projector.current('s1').waitPhase).toBeUndefined())
    } finally {
      projector.dispose()
      runtime.close()
    }
  })
})
