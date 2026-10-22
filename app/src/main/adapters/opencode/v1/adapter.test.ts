import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Event } from '@opencode-ai/sdk/v2'
import type { NormalizedEvent } from '../../../../shared/ipc'
import type { TurnRequest } from '../../common/turn'
import type { ProviderMessageBatch } from '../../common/types'
import { OpenCodeAdapter } from './adapter'
import { OpenCodeServerPool } from './server'
import {
  assistantMessage,
  editTool,
  jsonResponse,
  openCodeEvent as event,
  textPart
} from './adapter.testfixture'

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
function fixture(controls?: import('../../common/extension-control').ExtensionControl): {
  adapter: OpenCodeAdapter
  acquire: ReturnType<typeof vi.fn>
  release: ReturnType<typeof vi.fn>
  requests: Request[]
  emit: (value: Event) => void
  end: () => void
  onPrompt: (body: Record<string, unknown>) => void
  onReply: (path: string) => void
  failPrompt: boolean
  failMcp: boolean
  promptError?: { status: number; body: unknown }
  completionError?: unknown
} {
  const requests: Request[] = []
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  let closed = false
  let directory = 'C:/work'
  let mcpEnabled = true
  const encoder = new TextEncoder()
  const emit = (value: Event): void => {
    if (!closed)
      controller?.enqueue(
        encoder.encode(
          `id: ${value.id}\ndata: ${JSON.stringify({ directory, payload: value })}\n\n`
        )
      )
  }
  const transport: typeof fetch = async (input, init) => {
    const req = new Request(input, init)
    requests.push(req.clone())
    const path = new URL(req.url).pathname
    directory = new URL(req.url).searchParams.get('directory') ?? directory
    if (path === '/config') return jsonResponse({})
    if (path === '/mcp')
      return result.failMcp
        ? jsonResponse({}, 503)
        : jsonResponse({ docs: { status: mcpEnabled ? 'connected' : 'disabled' } })
    if (path === '/mcp/docs/connect' || path === '/mcp/docs/disconnect') {
      mcpEnabled = path.endsWith('/connect')
      return jsonResponse(true)
    }
    if (path === '/agent') return jsonResponse([{ name: 'build', mode: 'primary' }])
    if (path === '/provider')
      return jsonResponse({
        all: [
          { id: 'vendor', models: { 'model/name': { id: 'model/name', variants: { high: {} } } } }
        ]
      })
    if (path === '/instance/dispose') {
      emit(event('server.instance.disposed', { directory }))
      return jsonResponse(true)
    }
    if (path === '/command') return jsonResponse([])
    if (path === '/global/event') {
      const stream = new ReadableStream<Uint8Array>({
        start(streamController) {
          closed = false
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
      if (result.promptError)
        return jsonResponse(result.promptError.body, result.promptError.status)
      if (result.failPrompt)
        return jsonResponse({ name: 'BadRequest', data: { message: 'bad prompt' } }, 400)
      result.onPrompt((await req.json()) as Record<string, unknown>)
      return new Response(null, { status: 204 })
    }
    if (path.endsWith('/message') && req.method === 'POST')
      return jsonResponse({
        info: { ...assistantMessage(), error: result.completionError },
        parts: []
      })
    if (path === '/session/s1' && req.method === 'DELETE') return jsonResponse(true)
    if (path.endsWith('/abort')) return jsonResponse(true)
    if (path.endsWith('/reply') || path.endsWith('/reject')) {
      result.onReply(path)
      return jsonResponse(true)
    }
    throw new Error(`Unexpected SDK request: ${req.method} ${path}`)
  }
  const release = vi.fn()
  const acquire = vi.fn(async () => ({
    url: 'http://opencode.test',
    headers: { Authorization: 'Basic fixture' },
    release
  }))
  const servers = { acquire } as unknown as OpenCodeServerPool
  const result: ReturnType<typeof fixture> = {
    adapter: new OpenCodeAdapter(servers, transport, undefined, undefined, controls),
    acquire,
    release,
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
    failPrompt: false,
    failMcp: false
  }
  return result
}
it('applies SDK MCP choices before the first prompt, rejects unsafe project controls and retains partial observations safely', async () => {
  const f = fixture({
    global: () => ({ 'mcp:docs': false })
  })
  const live = f.adapter.sendMessage(request({ sessionId: null }))
  const iterator = live.eventBatches[Symbol.asyncIterator]()
  await iterator.next()
  await vi.waitFor(() =>
    expect(f.requests.some((req) => new URL(req.url).pathname.endsWith('/prompt_async'))).toBe(true)
  )
  const paths = f.requests.map((req) => new URL(req.url).pathname)
  expect(paths.indexOf('/mcp/docs/disconnect')).toBeLessThan(
    paths.indexOf('/session/s1/prompt_async')
  )
  const first = await live.nativeResources!()
  expect(first.items).toEqual([
    expect.objectContaining({ id: 'docs', enabled: false, canToggle: false })
  ])
  await expect(
    live.setNativeResource!({
      sessionId: 's1',
      generation: 'old',
      id: 'docs',
      kind: 'mcp',
      enabled: true
    })
  ).rejects.toThrow('제어')
  await expect(
    live.setNativeResource!({
      sessionId: 's1',
      generation: first.generation!,
      id: 'docs',
      kind: 'mcp',
      enabled: true
    })
  ).rejects.toThrow()
  const policy = live.projectResourcePolicy!()!
  const revision = (await policy.read('C:/work')).revision
  expect(await live.reconcileNativeResources!(revision, () => false)).toBe('pending')
  expect((await live.nativeResources!()).items[0].enabled).toBe(false)
  expect(await live.reconcileNativeResources!(revision, () => true)).toBe('applied')
  expect((await live.nativeResources!()).items[0].enabled).toBe(false)
  f.failMcp = true
  expect(await live.nativeResources!()).toMatchObject({
    partial: true,
    items: [{ id: 'docs', enabled: false, canToggle: false }]
  })
  live.close()
  await iterator.return?.()
  expect(await live.nativeResources!()).toEqual({ state: 'disconnected', items: [] })
  await vi.waitFor(() => expect(f.release).toHaveBeenCalledOnce())
})
async function collect(adapter: OpenCodeAdapter, req: TurnRequest): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = []
  for await (const batch of adapter.sendMessage(req).eventBatches) {
    events.push(...batch.events)
    if (batch.events.some((value) => ['turn.ended', 'turn.aborted', 'error'].includes(value.type)))
      break
  }
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
  it('sends native ascending IDs and completes successive turns under the legacy stop ordering contract', async () => {
    const f = fixture()
    const promptIds: string[] = []
    let assistantAttempts = 0
    // Independent native vectors for one millisecond after each client prompt.
    // The transport models the older 1.x loop, which gates stop on userID < assistantID.
    const vectors = [
      { now: 1792000000000, assistantId: 'msg_13b86000100100000000000000' },
      { now: 1792000000010, assistantId: 'msg_13b86000b00100000000000000' }
    ]
    const clock = vi.spyOn(Date, 'now')
    try {
      for (const [index, vector] of vectors.entries()) {
        clock.mockReturnValue(vector.now)
        f.onPrompt = (body) => {
          const promptId = String(body.messageID)
          promptIds.push(promptId)
          // A prior turn's late idle must not finish the current turn.
          if (index > 0) {
            f.emit(
              event('message.updated', {
                sessionID: 's1',
                info: assistantMessage('s1', promptIds[index - 1], 'stale')
              })
            )
            f.emit(event('session.idle', { sessionID: 's1' }))
          }
          assistantAttempts++
          f.emit(
            event('message.updated', {
              sessionID: 's1',
              info: { ...assistantMessage('s1', promptId, vector.assistantId), finish: 'stop' }
            })
          )
          f.emit(
            event('message.part.updated', {
              sessionID: 's1',
              time: vector.now + 2,
              part: textPart(`Done ${index + 1}`, {
                messageID: vector.assistantId,
                time: { start: vector.now + 1, end: vector.now + 2 }
              })
            })
          )
          if (promptId < vector.assistantId) {
            f.emit(event('session.idle', { sessionID: 's1' }))
          } else {
            // Bound the bad loop instead of hanging a test or hiding it with synthetic idle.
            assistantAttempts++
            f.end()
          }
        }
        const events = await collect(f.adapter, request())
        expect(assistantAttempts).toBe(index + 1)
        expect(promptIds[index]).toMatch(/^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
        expect(promptIds[index] < vector.assistantId).toBe(true)
        expect(events.filter((e) => e.type === 'message.completed')).toEqual([
          expect.objectContaining({ message: { text: `Done ${index + 1}` } })
        ])
        expect(events.filter((e) => e.type === 'turn.ended')).toHaveLength(1)
        expect(events.at(-1)?.type).toBe('turn.ended')
        expect(events.some((e) => e.type === 'error')).toBe(false)
      }
      expect(assistantAttempts).toBe(2)
      expect(new Set(promptIds).size).toBe(2)
      expect(promptIds[0] < promptIds[1]).toBe(true)
      expect(
        f.requests.filter((r) => new URL(r.url).pathname.endsWith('/prompt_async'))
      ).toHaveLength(2)
    } finally {
      clock.mockRestore()
    }
  })

  it('includes selected context directories in the prompt without changing native permissions', async () => {
    const f = fixture()
    let input: Record<string, unknown> = {}
    f.onPrompt = (body) => {
      input = body
      finish(f, String(body.messageID))
    }
    await collect(
      f.adapter,
      request({
        extraDirs: ['C:/references'],
        extensions: {
          skills: [],
          hooks: { normalized: {} },
          systemPromptAppend: 'Project instructions'
        }
      })
    )
    expect(input.system).toBe(
      'Project instructions\n\nAdditional context directories selected for this session (JSON): ["C:/references"]'
    )
    expect(input.permission).toBeUndefined()
  })
  it('delivers owned child activity and shell journal events from the SSE stream', async () => {
    const f = fixture()
    f.onPrompt = (body) => {
      const promptId = String(body.messageID)
      f.emit(event('message.updated', { sessionID: 's1', info: assistantMessage('s1', promptId) }))
      f.emit(
        event('message.part.updated', {
          sessionID: 's1',
          time: 1,
          part: editTool({
            tool: 'task',
            callID: 'task',
            state: {
              status: 'running',
              input: { description: 'Inspect' },
              metadata: { sessionId: 'child' },
              time: { start: 1 }
            }
          })
        })
      )
      f.emit(event('message.updated', { sessionID: 'child', info: assistantMessage('child') }))
      f.emit(
        event('message.part.updated', {
          sessionID: 'child',
          time: 2,
          part: textPart('Child response', { sessionID: 'child', time: { start: 1, end: 2 } })
        })
      )
      f.emit(
        event('message.part.updated', {
          sessionID: 'child',
          time: 3,
          part: editTool({
            sessionID: 'child',
            tool: 'bash',
            state: {
              status: 'running',
              input: { command: 'npm test' },
              metadata: { output: 'Running tests' },
              time: { start: 3 }
            }
          })
        })
      )
      f.emit(event('session.idle', { sessionID: 'child' }))
      finish(f, promptId)
    }
    const batches: ProviderMessageBatch[] = []
    for await (const batch of f.adapter.sendMessage(request()).eventBatches) {
      batches.push(batch)
      if (batch.events.some((value) => value.type === 'turn.ended')) break
    }
    expect(batches.flatMap((batch) => batch.events)).toContainEqual(
      expect.objectContaining({
        type: 'message.completed',
        parentToolRunId: 'task',
        message: { text: 'Child response' }
      })
    )
    expect(batches.flatMap((batch) => batch.providerEvents ?? [])).toContainEqual(
      expect.objectContaining({
        type: 'background.call',
        toolName: 'Bash',
        result: 'Running tests',
        parentToolUseId: 'task'
      })
    )
    expect(
      batches.flatMap((batch) => batch.events).filter((value) => value.type === 'turn.ended')
    ).toHaveLength(1)
  })
  const denied = {
    name: 'APIError' as const,
    data: {
      message: "OpenCode's free tier can only be used from within OpenCode. secret-message",
      statusCode: 403,
      isRetryable: false,
      responseHeaders: { authorization: 'secret-header' },
      responseBody: JSON.stringify({ error: { type: 'FreeTierError', detail: 'secret-body' } })
    }
  }

  it.each(['session.error', 'message.updated', 'http'] as const)(
    'explains provider free-tier rejection from %s without secrets, retry or false success',
    async (ingress) => {
      const f = fixture()
      if (ingress === 'http') f.promptError = { status: 403, body: denied }
      else
        f.onPrompt = (body) => {
          f.emit(
            ingress === 'session.error'
              ? event('session.error', { sessionID: 's1', error: denied })
              : event('message.updated', {
                  sessionID: 's1',
                  info: { ...assistantMessage('s1', String(body.messageID)), error: denied }
                })
          )
        }
      const rollback = vi.fn()
      const events = await collect(f.adapter, request({ rollbackInitialSubmission: rollback }))
      expect(events.filter((e) => e.type === 'error')).toEqual([
        expect.objectContaining({
          error: {
            category: 'permission_denied',
            provider: 'opencode',
            retryable: false,
            message: expect.stringContaining('OpenCode 무료 모델은 공급자 정책상')
          }
        })
      ])
      expect(JSON.stringify(events)).not.toContain('secret-')
      expect(events.some((e) => e.type === 'turn.ended')).toBe(false)
      expect(
        f.requests.filter((r) => new URL(r.url).pathname.endsWith('/prompt_async'))
      ).toHaveLength(1)
      expect(rollback).toHaveBeenCalledTimes(ingress === 'http' ? 1 : 0)
    }
  )

  it('rejects a failed auxiliary response and still deletes its temporary session', async () => {
    const f = fixture()
    f.completionError = denied
    await expect(f.adapter.complete({ cwd: 'C:/work', prompt: 'title' })).rejects.toThrow(
      'OpenCode 무료 모델'
    )
    expect(f.requests.filter((r) => r.method === 'DELETE')).toHaveLength(1)
    expect(f.release).toHaveBeenCalledOnce()
  })

  it('asks the auxiliary completion with the model it was given (0262 EP56 P40)', async () => {
    const f = fixture()
    await f.adapter.complete({ cwd: 'C:/work', prompt: 'title', model: 'other/extra' })
    const message = f.requests.find(
      (r) => r.method === 'POST' && new URL(r.url).pathname.endsWith('/message')
    )
    expect(await message?.json()).toMatchObject({
      model: { providerID: 'other', modelID: 'extra' }
    })
    expect(f.release).toHaveBeenCalledOnce()
  })

  it('starts the turn, completion and recovery on the server of the selected engine document', async () => {
    const f = fixture()
    // Without the document the server would start from the empty native-only configuration.
    const providerSettings = {
      providerKey: 'opencode-other',
      provider: 'other',
      sourceRevision: 'fixture',
      settings: {
        provider: {
          other: {
            options: { baseURL: 'https://other.test/v1' },
            models: { extra: { name: 'Extra' } }
          }
        }
      }
    }
    const env = { ORCA_SELECTED_ENGINE: 'other' }
    f.onPrompt = (body) => finish(f, String(body.messageID))
    await collect(f.adapter, request({ providerSettings, env }))
    await f.adapter.complete({ cwd: 'C:/work', prompt: 'title', providerSettings, env })
    await f.adapter.recoverSession({ sessionId: 's1', cwd: 'C:/work', env, providerSettings })
    expect(f.acquire.mock.calls).toEqual([
      [providerSettings.settings, env, 'C:/work'],
      [providerSettings.settings, env, 'C:/work'],
      [providerSettings.settings, env, 'C:/work']
    ])
    await vi.waitFor(() => expect(f.release).toHaveBeenCalledTimes(3))
  })

  it.each([404, 503])(
    'releases the history connection after an HTTP %s response',
    async (status) => {
      const release = vi.fn()
      const adapter = new OpenCodeAdapter(
        {
          acquire: async () => ({ url: 'http://fixture.test', headers: {}, release }),
          installed: async () => ({ installed: true }),
          close: () => {}
        },
        async () => jsonResponse({}, status)
      )
      expect(await adapter.readHistory({ sessionId: 's1', cwd: 'C:/work' })).toMatchObject({
        status: status === 404 ? 'missing' : 'unavailable'
      })
      expect(release).toHaveBeenCalledOnce()
    }
  )

  it('reports an unsupported CLI as a turn error before any server or HTTP request', async () => {
    const transport = vi.fn<typeof fetch>()
    const servers = new OpenCodeServerPool({
      dataDirectory: 'unused',
      preferences: () => undefined,
      executable: () => 'unsupported-opencode',
      readVersion: async () => '2.0.28',
      fetchImpl: transport,
      spawnProcess: () => {
        throw new Error('unsupported CLI must never spawn')
      }
    })
    try {
      const events = await collect(new OpenCodeAdapter(servers, transport), request())
      expect(events).toEqual([
        expect.objectContaining({
          type: 'error',
          error: expect.objectContaining({
            category: 'provider_connection_error',
            message: expect.stringContaining('OpenCode CLI 1.x가 필요합니다')
          })
        })
      ])
      expect(transport).not.toHaveBeenCalled()
    } finally {
      servers.close()
    }
  })
  beforeEach(() => {
    vi.stubGlobal('fetch', () => {
      throw new Error('Global fetch must never be used')
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('subscribes before sending, scopes the turn and leaves admission to the runtime', async () => {
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
    expect(commit).not.toHaveBeenCalled()
    expect(f.requests.map((req) => new URL(req.url).pathname)).toEqual([
      '/global/event',
      '/agent',
      '/provider',
      '/config',
      '/command',
      '/session',
      '/session/s1/prompt_async',
      '/instance/dispose'
    ])
    expect(f.requests.every((req) => req.headers.get('Authorization') === 'Basic fixture')).toBe(
      true
    )
    expect(new URL(f.requests[1]!.url).searchParams.get('directory')?.replaceAll('\\', '/')).toBe(
      'C:/work'
    )
    const payload = await f.requests
      .find((request) => new URL(request.url).pathname.endsWith('/prompt_async'))!
      .json()
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
      {
        type: 'input.echo',
        sessionId: 's1',
        text: 'inspect',
        uuid: 'orca-prompt',
        nativeMessageId: expect.any(String)
      }
    ])
    expect(events.filter((e) => e.type === 'message.completed')).toEqual([
      {
        type: 'message.completed',
        sessionId: 's1',
        nativeMessageId: 'a1',
        message: { text: 'Done' }
      }
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
      for await (const batch of turn.eventBatches) {
        events.push(...batch.events)
        if (batch.events.some((value) => value.type === 'turn.aborted')) break
      }
    })()
    await entered
    expect(await turn.interrupt?.()).toEqual({ stillQueued: [] })
    f.emit(event('session.idle', { sessionID: 's1' }))
    await reading
    expect(approvalSignal?.aborted).toBe(true)
    expect(events.at(-1)?.type).toBe('turn.aborted')
    expect(f.requests.filter((req) => req.url.includes('/abort'))).toHaveLength(1)
    expect(f.requests.some((req) => req.url.includes('/permission/'))).toBe(false)
  })

  it('does not send an aborted request and rolls back a rejected submission', async () => {
    const f = fixture()
    const commit = vi.fn(() => true)
    await collect(
      f.adapter,
      request({ signal: AbortSignal.abort(), commitInitialSubmission: commit })
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
