import { describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import { createOpenCodeAdapter, type OpenCodeServer } from '../../adapters/opencode'
import {
  assistantMessage,
  jsonResponse,
  openCodeEvent,
  textPart
} from '../../adapters/opencode/v1/adapter.testfixture'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import type { SessionActivityProjector } from '../../features/chat/session-activity-projector'
import { SessionRuntime } from '../../features/sessions/session-runtime'
import { buildTurnRequest } from './turn-request'

vi.mock('../../infra/log', async () => import('../../infra/log/registry'))
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))

function fixture(): { runtime: SessionRuntime; requests: Request[]; rejectPrompt: () => void } {
  const requests: Request[] = []
  const encoder = new TextEncoder()
  let stream: ReadableStreamDefaultController<Uint8Array>
  let rejected = false
  const emit = (event: ReturnType<typeof openCodeEvent>): void => {
    stream.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
  }
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    const path = new URL(request.url).pathname
    if (path === '/session') return jsonResponse({ id: 's1' })
    if (path === '/event') {
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            stream = controller
            emit(openCodeEvent('server.connected', {}))
          }
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    }
    if (path.endsWith('/prompt_async')) {
      if (rejected) return jsonResponse({ message: 'Rejected fixture prompt' }, 400)
      const body = (await request.json()) as { messageID: string }
      emit(
        openCodeEvent('message.updated', {
          sessionID: 's1',
          info: assistantMessage('s1', body.messageID)
        })
      )
      emit(
        openCodeEvent('message.part.updated', {
          sessionID: 's1',
          part: textPart('Runtime reply', { time: { start: 1, end: 2 } }),
          time: 2
        })
      )
      emit(openCodeEvent('session.idle', { sessionID: 's1' }))
      return new Response(null, { status: 204 })
    }
    if (path.endsWith('/abort')) return jsonResponse(true)
    throw new Error(`Unexpected request: ${request.method} ${path}`)
  }
  const server: OpenCodeServer = {
    acquire: async () => ({ url: 'http://opencode.test', headers: {} }),
    installed: async () => ({ installed: true, version: '1.19.0' }),
    close: () => {}
  }
  return {
    runtime: new SessionRuntime(
      createOpenCodeAdapter({
        dataDirectory: 'unused',
        preferences: () => undefined,
        fetchImpl,
        server
      })
    ),
    requests,
    rejectPrompt: () => {
      rejected = true
    }
  }
}

function admission(sessionId: string | null): {
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
      activity: {} as SessionActivityProjector,
      chainId: 'chain',
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
  it.each([null, 's1'])(
    'delivers a reply after runtime admission for session %s',
    async (sessionId) => {
      const { runtime, requests } = fixture()
      try {
        for (const currentSession of [sessionId, 's1']) {
          const { request, commit } = admission(currentSession)
          expect(request.canSubmitInitial!()).toBe(true)
          const events = await collect(runtime, request)
          expect(commit).toHaveBeenCalledOnce()
          // A committed claim is deliberately no longer eligible for admission.
          expect(request.canSubmitInitial!()).toBe(false)
          expect(events).toContainEqual({
            type: 'input.echo',
            sessionId: 's1',
            text: 'Hello',
            uuid: request.promptUuid
          })
          expect(events).toContainEqual({
            type: 'message.completed',
            sessionId: 's1',
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
})
