import { describe, expect, it, vi } from 'vitest'
import type { Event } from '@opencode-ai/sdk/v2'
import type { LiveTurn, ProviderMessageBatch } from '../../common/types'
import type { TurnRequest } from '../../common/turn'
import { OpenCodeAdapter } from './adapter'
import {
  assistantMessage,
  editTool,
  jsonResponse,
  openCodeEvent as event,
  textPart
} from './adapter.testfixture'
import { reportError } from '../../../infra/error-report'

vi.mock('../../../infra/error-report', () => ({ reportError: vi.fn() }))

function fixture(overrides: Partial<TurnRequest> = {}): {
  live: LiveTurn
  requests: Request[]
  emit: (value: Event) => void
  reply: (id: string) => void
  setPrompt: (callback: (body: Record<string, unknown>) => Promise<void | Response>) => void
  failAbort: () => void
} {
  const requests: Request[] = []
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined
  let closed = false
  let rejectAbort = false
  const emit = (value: Event): void => {
    if (!closed) stream?.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`))
  }
  const reply = (id: string): void => {
    emit(event('message.updated', { sessionID: 's1', info: assistantMessage('s1', id, `a-${id}`) }))
    emit(
      event('message.part.updated', {
        sessionID: 's1',
        time: 2,
        part: textPart('Done', { id: `p-${id}`, messageID: `a-${id}`, time: { start: 1, end: 2 } })
      })
    )
    emit(event('session.idle', { sessionID: 's1' }))
  }
  let prompt = async (body: Record<string, unknown>): Promise<void | Response> => {
    reply(body.messageID as string)
  }
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    const path = new URL(request.url).pathname
    if (path === '/event')
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            stream = controller
            emit(event('server.connected', {}))
          },
          cancel() {
            closed = true
          }
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    if (path.endsWith('/prompt_async')) {
      const response = await prompt(await request.json())
      return response ?? new Response(null, { status: 204 })
    }
    if (path.endsWith('/abort')) {
      if (rejectAbort) return jsonResponse({ error: 'private provider failure' }, 500)
      emit(event('session.idle', { sessionID: 's1' }))
      return jsonResponse(true)
    }
    if (/\/(reply|reject)$/.test(path)) return jsonResponse(true)
    throw new Error(`Unexpected request: ${path}`)
  }
  const adapter = new OpenCodeAdapter(
    {
      acquire: async () => ({ url: 'http://fixture.test', headers: {} }),
      installed: async () => ({ installed: true, version: '1.19.0' }),
      close: () => {}
    },
    fetchImpl
  )
  return {
    live: adapter.sendMessage({
      sessionId: 's1',
      cwd: 'C:/work',
      text: 'First',
      promptUuid: 'first',
      extensions: { skills: [], hooks: { normalized: {} } },
      ...overrides
    }),
    requests,
    emit,
    reply,
    setPrompt: (callback) => {
      prompt = callback
    },
    failAbort: () => {
      rejectAbort = true
    }
  }
}

async function frame(
  iterator: AsyncIterator<ProviderMessageBatch>
): Promise<ProviderMessageBatch[]> {
  const batches: ProviderMessageBatch[] = []
  while (true) {
    const next = await iterator.next()
    if (next.done) return batches
    batches.push(next.value)
    if (
      next.value.events.some((value) =>
        ['turn.ended', 'turn.aborted', 'error'].includes(value.type)
      )
    )
      return batches
  }
}

async function dispose(
  live: LiveTurn,
  iterator: AsyncIterator<ProviderMessageBatch>
): Promise<void> {
  live.close()
  await iterator.return?.()
}

describe('OpenCode persistent SDK channel', () => {
  it('subscribes once before initial and subsequent prompts', async () => {
    const f = fixture()
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    try {
      await frame(iterator)
      expect(await f.live.pushTurn!({ text: 'Second', promptUuid: 'second' })).toEqual({
        kind: 'accepted'
      })
      const next = (await frame(iterator)).flatMap((batch) => batch.events)
      expect(next).toContainEqual({
        type: 'input.echo',
        sessionId: 's1',
        text: 'Second',
        uuid: 'second'
      })
      expect(f.requests.map((request) => new URL(request.url).pathname)).toEqual([
        '/event',
        '/session/s1/prompt_async',
        '/session/s1/prompt_async'
      ])
    } finally {
      await dispose(f.live, iterator)
    }
  })

  it('publishes the accepted echo before an early SSE reply while the HTTP response is pending', async () => {
    const f = fixture()
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    try {
      await frame(iterator)
      let release: (() => void) | undefined
      f.setPrompt(async (body) => {
        f.reply(body.messageID as string)
        await new Promise<void>((resolve) => {
          release = resolve
        })
      })
      const submission = f.live.pushTurn!({ text: 'Second', promptUuid: 'second' })
      await vi.waitFor(() => expect(release).toBeDefined())
      release!()
      await submission
      const events = (await frame(iterator)).flatMap((batch) => batch.events)
      expect(events[0]).toEqual({
        type: 'input.echo',
        sessionId: 's1',
        text: 'Second',
        uuid: 'second'
      })
      expect(events.at(-1)?.type).toBe('turn.ended')
      expect(events.filter((value) => value.type === 'message.completed')).toHaveLength(1)
    } finally {
      await dispose(f.live, iterator)
    }
  })

  it('retires a rejected warm submission before another adapter input can be accepted', async () => {
    const f = fixture()
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    try {
      await frame(iterator)
      f.setPrompt(async (body) => {
        f.reply(body.messageID as string)
        return jsonResponse({ error: 'Provider rejected this prompt.' }, 503)
      })
      await expect(
        f.live.pushTurn!({ text: 'Rejected', promptUuid: 'rejected' })
      ).rejects.toBeDefined()
      expect(await f.live.pushTurn!({ text: 'Later', promptUuid: 'later' })).toEqual({
        kind: 'rejectedBeforeAccept',
        reason: 'stream_closed'
      })
      expect(await frame(iterator)).toEqual([])
      expect(
        f.requests.filter((request) => new URL(request.url).pathname.endsWith('/prompt_async'))
      ).toHaveLength(2)
    } finally {
      await dispose(f.live, iterator)
    }
  })

  it('preserves owned reception on interrupt and retires stale channel callbacks', async () => {
    const f = fixture()
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    f.setPrompt(async () => {})
    const first = frame(iterator)
    await vi.waitFor(() =>
      expect(f.requests.some((request) => request.url.includes('prompt_async'))).toBe(true)
    )
    await f.live.interrupt()
    expect((await first).flatMap((batch) => batch.events).at(-1)?.type).toBe('turn.aborted')
    f.setPrompt(async (body) => {
      f.reply(body.messageID as string)
    })
    await f.live.pushTurn!({ text: 'Next' })
    expect((await frame(iterator)).flatMap((batch) => batch.events).at(-1)?.type).toBe('turn.ended')
    await dispose(f.live, iterator)
    expect(await f.live.pushTurn!({ text: 'Stale' })).toEqual({
      kind: 'rejectedBeforeAccept',
      reason: 'stream_closed'
    })
    expect(f.requests.filter((request) => request.url.includes('prompt_async'))).toHaveLength(2)
  })

  it('keeps child approvals independent from interrupted root frames', async () => {
    const seen: { signal: AbortSignal; resolve: (value: { behavior: 'deny' }) => void }[] = []
    const f = fixture({
      requestApproval: async (_action, signal) =>
        new Promise((resolve) => {
          seen.push({ signal: signal!, resolve })
        })
    })
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    f.setPrompt(async (body) => {
      f.emit(
        event('message.updated', {
          sessionID: 's1',
          info: assistantMessage('s1', body.messageID as string)
        })
      )
      f.emit(
        event('message.part.updated', {
          sessionID: 's1',
          time: 1,
          part: editTool({
            tool: 'task',
            state: {
              status: 'running',
              input: {},
              metadata: { sessionId: 'child', background: true },
              time: { start: 1 }
            }
          })
        })
      )
      for (const id of ['s1', 'child'])
        f.emit(
          event('permission.asked', {
            id: `approval-${id}`,
            sessionID: id,
            permission: 'read',
            patterns: [],
            always: [],
            metadata: {}
          })
        )
    })
    const first = frame(iterator)
    await vi.waitFor(() => expect(seen).toHaveLength(2))
    await f.live.interrupt()
    await first
    expect(seen[0].signal.aborted).toBe(true)
    expect(seen[1].signal.aborted).toBe(false)
    seen[0].resolve({ behavior: 'deny' })
    seen[1].resolve({ behavior: 'deny' })
    await vi.waitFor(() =>
      expect(f.requests.some((request) => request.url.includes('/approval-child/reply'))).toBe(true)
    )
    expect(f.requests.some((request) => request.url.includes('/approval-s1/reply'))).toBe(false)
    await dispose(f.live, iterator)
  })

  it('reads the current root approval scope on a subsequent frame', async () => {
    let current = new AbortController()
    const seen: AbortSignal[] = []
    const f = fixture({
      getMainApprovalSignal: () => current.signal,
      requestApproval: async (_action, signal) => {
        seen.push(signal!)
        return { behavior: 'deny' }
      }
    })
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    try {
      await frame(iterator)
      current.abort()
      current = new AbortController()
      f.setPrompt(async (body) => {
        f.emit(
          event('permission.asked', {
            id: 'next-frame',
            sessionID: 's1',
            permission: 'read',
            patterns: [],
            always: [],
            metadata: {}
          })
        )
        f.reply(body.messageID as string)
      })
      await f.live.pushTurn!({ text: 'Next' })
      await frame(iterator)
      await vi.waitFor(() =>
        expect(f.requests.some((request) => request.url.includes('/next-frame/reply'))).toBe(true)
      )
      expect(seen).toHaveLength(1)
      expect(seen[0].aborted).toBe(false)
    } finally {
      await dispose(f.live, iterator)
    }
  })

  it('closes owned subscriptions once and reports uncertain abort failures', async () => {
    vi.mocked(reportError).mockClear()
    const f = fixture()
    f.setPrompt(async () => {})
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    const receiving = frame(iterator)
    await vi.waitFor(() =>
      expect(f.requests.some((request) => request.url.includes('prompt_async'))).toBe(true)
    )
    f.failAbort()
    f.live.close()
    f.live.close()
    await receiving
    await iterator.return?.()
    expect(f.requests.filter((request) => request.url.includes('/abort'))).toHaveLength(1)
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'opencode.channel.abort.failed',
        error: undefined,
        detail: null,
        data: { provider: 'opencode', failedCount: 1 }
      })
    )
  })
})
