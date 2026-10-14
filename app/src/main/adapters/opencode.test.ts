import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Event } from '@opencode-ai/sdk/v2'
import type { NormalizedEvent } from '../../shared/ipc'
import type { TurnRequest } from './turn'
import { OpenCodeAdapter } from './opencode'
import type { OpenCodeServerPool } from './opencode-server'
import {
  assistantMessage,
  editTool,
  jsonResponse,
  openCodeEvent as event,
  textPart
} from './opencode.testfixture'

function request(overrides: Partial<TurnRequest> = {}): TurnRequest {
  return {
    sessionId: 's1',
    cwd: 'C:/work',
    text: 'inspect',
    promptUuid: 'orca-prompt',
    extensions: { skills: [], hooks: { normalized: {} } },
    ...overrides
  }
}
function fixture(): {
  adapter: OpenCodeAdapter
  requests: Request[]
  emit: (value: Event) => void
  end: () => void
  onPrompt: (body: Record<string, unknown>) => void
  onReply: (path: string) => void
  failPrompt: boolean
} {
  const requests: Request[] = []
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  let closed = false
  const encoder = new TextEncoder()
  const emit = (value: Event): void => {
    if (!closed)
      controller?.enqueue(encoder.encode(`id: ${value.id}\ndata: ${JSON.stringify(value)}\n\n`))
  }
  const transport: typeof fetch = async (input, init) => {
    const req = new Request(input, init)
    requests.push(req.clone())
    const path = new URL(req.url).pathname
    if (path === '/event') {
      const stream = new ReadableStream<Uint8Array>({
        start(streamController) {
          controller = streamController
          emit(event('server.connected', {}))
        },
        cancel() {
          closed = true
        }
      })
      return new Response(stream, { headers: { 'content-type': 'text/event-stream' } })
    }
    if (path === '/session' && req.method === 'POST') return jsonResponse({ id: 's1' })
    if (path.endsWith('/prompt_async')) {
      if (result.failPrompt)
        return jsonResponse({ name: 'BadRequest', data: { message: 'bad prompt' } }, 400)
      result.onPrompt((await req.json()) as Record<string, unknown>)
      return new Response(null, { status: 204 })
    }
    if (path.endsWith('/abort')) return jsonResponse(true)
    if (path.endsWith('/reply') || path.endsWith('/reject')) {
      result.onReply(path)
      return jsonResponse(true)
    }
    throw new Error(`Unexpected SDK request: ${req.method} ${path}`)
  }
  const servers = {
    acquire: vi.fn(async () => ({
      url: 'http://opencode.test',
      headers: { Authorization: 'Basic fixture' }
    }))
  } as unknown as OpenCodeServerPool
  const result = {
    adapter: new OpenCodeAdapter(servers, transport),
    requests,
    emit,
    end: () => {
      if (!closed) {
        closed = true
        controller?.close()
      }
    },
    onPrompt: (_body: Record<string, unknown>) => {
      void _body
    },
    onReply: (_path: string) => {
      void _path
    },
    failPrompt: false
  }
  return result
}
async function collect(adapter: OpenCodeAdapter, req: TurnRequest): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = []
  for await (const batch of adapter.sendMessage(req).eventBatches) events.push(...batch.events)
  return events
}
function finish(f: ReturnType<typeof fixture>, promptId: string): void {
  f.emit(event('message.updated', { sessionID: 's1', info: assistantMessage('s1', promptId) }))
  f.emit(
    event('message.part.updated', {
      sessionID: 's1',
      part: textPart('Done', { time: { start: 1, end: 2 } }),
      time: 2
    })
  )
  f.emit(event('session.status', { sessionID: 's1', status: { type: 'idle' } }))
}

describe('OpenCode adapter with the real installed SDK and injected HTTP/SSE transport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', () => {
      throw new Error('Global fetch must never be used')
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('subscribes before admission, scopes the turn and emits each completion exactly once', async () => {
    const f = fixture()
    f.onPrompt = (body) => {
      f.emit(
        event('message.updated', {
          sessionID: 'other-session',
          info: assistantMessage('other-session')
        })
      )
      f.emit(
        event('message.updated', { sessionID: 's1', info: assistantMessage('s1', 'old-prompt') })
      )
      f.emit(event('session.idle', { sessionID: 's1' }))
      f.emit(
        event('message.updated', {
          sessionID: 's1',
          info: assistantMessage('s1', body.messageID as string)
        })
      )
      const tool = event('message.part.updated', { sessionID: 's1', part: editTool(), time: 1 })
      f.emit(tool)
      f.emit(tool)
      finish(f, body.messageID as string)
    }
    const commit = vi.fn(() => true)
    const events = await collect(
      f.adapter,
      request({
        sessionId: null,
        model: 'vendor/model/name',
        harnessAgent: 'build',
        modelVariant: 'high',
        commitInitialSubmission: commit,
        attachmentImages: [
          { id: 'image', name: 'a.png', mimeType: 'image/png', data: 'AAAA', sourceKind: 'dialog' }
        ],
        attachmentTexts: [
          {
            id: 'file',
            name: 'a.txt',
            mimeType: 'text/plain',
            path: 'C:/work/a.txt',
            sourceKind: 'dialog'
          }
        ]
      })
    )
    expect(commit).toHaveBeenCalledOnce()
    expect(f.requests.map((req) => new URL(req.url).pathname)).toEqual([
      '/session',
      '/event',
      '/session/s1/prompt_async'
    ])
    expect(f.requests.every((req) => req.headers.get('Authorization') === 'Basic fixture')).toBe(
      true
    )
    expect(new URL(f.requests[1]!.url).searchParams.get('directory')).toBe('C:/work')
    const payload = await f.requests[2]!.json()
    expect(payload).toMatchObject({
      model: { providerID: 'vendor', modelID: 'model/name' },
      agent: 'build',
      variant: 'high'
    })
    expect(payload.parts).toMatchObject([
      { type: 'text', text: 'inspect' },
      { type: 'file', filename: 'a.txt' },
      { type: 'file', url: 'data:image/png;base64,AAAA' }
    ])
    expect(events.filter((e) => e.type === 'input.echo')).toEqual([
      { type: 'input.echo', sessionId: 's1', text: 'inspect', uuid: 'orca-prompt' }
    ])
    expect(events.filter((e) => e.type === 'message.completed')).toEqual([
      { type: 'message.completed', sessionId: 's1', message: { text: 'Done' } }
    ])
    expect(events.filter((e) => e.type === 'tool.call.started')).toHaveLength(1)
    expect(events.filter((e) => e.type === 'tool.call.completed')).toHaveLength(1)
    expect(events.filter((e) => e.type === 'turn.ended')).toHaveLength(1)
    expect(events.at(-1)?.type).toBe('turn.ended')
  })

  it('surfaces a disconnected stream and aborts only that session without resending the prompt', async () => {
    const f = fixture()
    f.onPrompt = () => f.end()
    const events = await collect(f.adapter, request())
    expect(events.at(-1)).toMatchObject({ type: 'error', error: { retryable: false } })
    expect(events.some((e) => e.type === 'turn.ended')).toBe(false)
    expect(f.requests.filter((req) => req.url.includes('prompt_async'))).toHaveLength(1)
    expect(f.requests.filter((req) => req.url.includes('/s1/abort'))).toHaveLength(1)
  })

  it('replies to permission and question approvals once, including rejection', async () => {
    const f = fixture()
    let promptId = ''
    f.onPrompt = (body) => {
      promptId = body.messageID as string
      const permission = event('permission.asked', {
        id: 'perm-1',
        sessionID: 's1',
        permission: 'edit',
        patterns: ['a.ts'],
        metadata: {},
        always: []
      })
      f.emit(permission)
      f.emit(permission)
      f.emit(
        event('permission.asked', {
          id: 'perm-deny',
          sessionID: 's1',
          permission: 'bash',
          patterns: ['cmd'],
          metadata: {},
          always: []
        })
      )
      for (const id of ['question-1', 'question-deny'])
        f.emit(
          event('question.asked', {
            id,
            sessionID: 's1',
            questions: [
              {
                header: 'Choice',
                question: id,
                options: [{ label: 'One', description: 'First' }],
                multiple: false
              }
            ]
          })
        )
    }
    let replied = 0
    f.onReply = () => {
      if (++replied === 4) finish(f, promptId)
    }
    const approve = vi.fn<NonNullable<TurnRequest['requestApproval']>>(async (action) => {
      if (action.kind === 'tool_approval')
        return action.toolName === 'Edit' ? { behavior: 'allow' } : { behavior: 'deny' }
      if (action.kind === 'ask_question')
        return action.request.requestId === 'question-1'
          ? { behavior: 'allow', updatedInput: { answers: { 'question-1': 'One' } } }
          : { behavior: 'deny' }
      return { behavior: 'deny' }
    })
    const events = await collect(f.adapter, request({ requestApproval: approve }))
    expect(approve).toHaveBeenCalledTimes(4)
    const replyRequests = f.requests.filter((req) =>
      /\/(reply|reject)$/.test(new URL(req.url).pathname)
    )
    const bodies = await Promise.all(
      replyRequests.map(async (req) => [
        new URL(req.url).pathname,
        req.body ? await req.json() : null
      ])
    )
    expect(bodies).toEqual(
      expect.arrayContaining([
        ['/permission/perm-1/reply', { reply: 'once' }],
        ['/permission/perm-deny/reply', { reply: 'reject' }],
        ['/question/question-1/reply', { answers: [['One']] }],
        ['/question/question-deny/reject', null]
      ])
    )
    expect(events.at(-1)?.type).toBe('turn.ended')
  })

  it('aborts the server and cancels a pending approval when interrupted', async () => {
    const f = fixture()
    f.onPrompt = () =>
      f.emit(
        event('permission.asked', {
          id: 'pending',
          sessionID: 's1',
          permission: 'bash',
          patterns: [],
          metadata: {},
          always: []
        })
      )
    let approvalSignal: AbortSignal | undefined
    let approvalEntered: () => void = () => {}
    const entered = new Promise<void>((resolve) => {
      approvalEntered = resolve
    })
    const turn = f.adapter.sendMessage(
      request({
        requestApproval: async (_action, signal) => {
          approvalSignal = signal
          approvalEntered()
          return new Promise((resolve) =>
            signal!.addEventListener('abort', () => resolve({ behavior: 'deny' }), { once: true })
          )
        }
      })
    )
    const events: NormalizedEvent[] = []
    const reading = (async () => {
      for await (const batch of turn.eventBatches) events.push(...batch.events)
    })()
    await entered
    expect(await turn.interrupt?.()).toEqual({ stillQueued: [] })
    await reading
    expect(approvalSignal?.aborted).toBe(true)
    expect(events.at(-1)?.type).toBe('turn.aborted')
    expect(f.requests.filter((req) => req.url.includes('/abort'))).toHaveLength(1)
    expect(f.requests.some((req) => req.url.includes('/permission/'))).toBe(false)
  })

  it('does not send after admission is withdrawn and rolls back a rejected submission', async () => {
    const f = fixture()
    const commit = vi.fn(() => true)
    await collect(
      f.adapter,
      request({ canSubmitInitial: () => false, commitInitialSubmission: commit })
    )
    expect(commit).not.toHaveBeenCalled()
    expect(f.requests.some((req) => req.url.includes('prompt_async'))).toBe(false)
    const rejected = fixture()
    rejected.failPrompt = true
    const rollback = vi.fn()
    const events = await collect(rejected.adapter, request({ rollbackInitialSubmission: rollback }))
    expect(rollback).toHaveBeenCalledOnce()
    expect(events.some((e) => e.type === 'input.echo')).toBe(false)
    expect(events.at(-1)?.type).toBe('error')
  })
})
