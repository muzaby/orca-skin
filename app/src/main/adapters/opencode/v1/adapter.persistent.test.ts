import { openCodePluginId } from './plugin-installation'
import { realpath, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  adapter: OpenCodeAdapter
  live: LiveTurn
  requests: Request[]
  emit: (value: Event) => void
  reply: (id: string) => void
  setPrompt: (callback: (body: Record<string, unknown>) => Promise<void | Response>) => void
  failAbort: () => void
  setComposer: (agents: unknown[], models: Record<string, unknown>) => void
  holdComposer: (gate: Promise<void>) => void
  setCommands: (
    commands: {
      name: string
      description?: string
      source?: 'command' | 'mcp' | 'skill'
      hints: string[]
    }[]
  ) => void
} {
  const requests: Request[] = []
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined
  let closed = false
  let rejectAbort = false
  let composer: { agents: unknown[]; models: Record<string, unknown> } | undefined
  let composerGate: Promise<void> | undefined
  let commands: {
    name: string
    description?: string
    source?: 'command' | 'mcp' | 'skill'
    hints: string[]
  }[] = []
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
    if (path === '/session' && request.method === 'POST') return jsonResponse({ id: 'replacement' })
    if (path === '/mcp') return jsonResponse({ native: { status: 'connected' } })
    if (path === '/config') return jsonResponse({ plugin: ['@native/plugin@1'] })
    if (path === '/command') return jsonResponse(commands)
    if ((path === '/agent' || path === '/provider') && composer) {
      await composerGate
      return jsonResponse(
        path === '/agent'
          ? composer.agents
          : { all: [{ id: 'plugin', models: composer.models }], connected: ['plugin'], default: {} }
      )
    }
    if (path === '/skill')
      return jsonResponse(
        commands
          .filter((c) => c.source === 'skill')
          .map((c) => ({
            name: c.name,
            description: c.description,
            location: join(overrides.cwd ?? 'C:/B', '.opencode', 'skills', c.name, 'SKILL.md'),
            content: ''
          }))
      )
    if (path.endsWith('/message') && request.method === 'POST')
      return jsonResponse({ info: {}, parts: [] })
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
    if (path.endsWith('/prompt_async') || path.endsWith('/command')) {
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
    adapter,
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
    },
    setComposer: (agents, models) => {
      composer = { agents, models }
    },
    holdComposer: (gate) => {
      composerGate = gate
    },
    setCommands: (value) => {
      commands = value
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
  it('discards menu metadata that finishes after the channel closes', async () => {
    const f = fixture()
    const gate = Promise.withResolvers<void>()
    f.setComposer([{ name: 'late-agent', mode: 'primary' }], {})
    f.holdComposer(gate.promise)
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    try {
      await frame(iterator)
      const pending = f.live.nativeResources!()
      f.live.close()
      gate.resolve()
      expect(await pending).toEqual({ state: 'disconnected', items: [] })
      expect(await f.live.nativeResources!()).toEqual({ state: 'disconnected', items: [] })
    } finally {
      gate.resolve()
      await dispose(f.live, iterator)
    }
  })

  it('passes a live plugin agent and drops its removed variant on the next prompt', async () => {
    const f = fixture({
      model: 'plugin/model',
      harnessAgent: 'plugin-review',
      modelVariant: 'deep'
    })
    f.setComposer(
      [
        { name: 'plugin-review', mode: 'primary' },
        { name: 'private', mode: 'subagent' }
      ],
      { model: { id: 'model', variants: { deep: {} } } }
    )
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    try {
      await frame(iterator)
      let prompts = f.requests.filter((r) => new URL(r.url).pathname.endsWith('/prompt_async'))
      expect(await prompts[0].json()).toMatchObject({ agent: 'plugin-review', variant: 'deep' })
      f.setComposer([{ name: 'plugin-revised', mode: 'all' }], {
        model: { id: 'model', variants: {} }
      })
      expect((await f.live.nativeResources!()).composer).toEqual({
        agents: [{ name: 'plugin-revised' }],
        models: [{ id: 'plugin/model', variants: [] }]
      })
      await f.live.pushTurn!({
        text: 'next',
        model: 'plugin/model',
        harnessAgent: 'plugin-review',
        modelVariant: 'deep'
      })
      await frame(iterator)
      prompts = f.requests.filter((r) => new URL(r.url).pathname.endsWith('/prompt_async'))
      const body = await prompts[1].json()
      expect(body).not.toHaveProperty('agent')
      expect(body).not.toHaveProperty('variant')
      await f.live.pushTurn!({ text: 'updated agent', harnessAgent: 'plugin-revised' })
      await frame(iterator)
      prompts = f.requests.filter((r) => new URL(r.url).pathname.endsWith('/prompt_async'))
      expect(await prompts[2].json()).toMatchObject({ agent: 'plugin-revised' })
    } finally {
      await dispose(f.live, iterator)
    }
  })

  it('does not wait for menu metadata before sending a default prompt', async () => {
    const f = fixture()
    f.setComposer([], {})
    let release!: () => void
    f.holdComposer(
      new Promise<void>((resolve) => {
        release = resolve
      })
    )
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    try {
      await frame(iterator)
      expect(f.requests.some((r) => new URL(r.url).pathname.endsWith('/prompt_async'))).toBe(true)
    } finally {
      release()
      await dispose(f.live, iterator)
    }
  })

  it('dispatches a real native slash command while its HTTP response is pending and retains context and files', async () => {
    const approve = vi.fn(async () => ({ behavior: 'deny' as const }))
    const f = fixture({
      text: '/docs:search find auth',
      model: 'provider/model-B',
      harnessAgent: 'reviewer',
      modelVariant: 'deep',
      requestApproval: approve,
      extensions: { skills: [], hooks: { normalized: {} }, systemPromptAppend: 'session policy B' },
      attachmentTexts: [
        {
          id: 'file-B',
          sourceKind: 'dialog',
          path: 'C:/work/a.txt',
          name: 'a.txt',
          mimeType: 'text/plain'
        }
      ]
    })
    f.setCommands([
      { name: 'docs:search', source: 'mcp', description: 'Search docs', hints: ['query'] }
    ])
    let finish!: () => void
    f.setPrompt(async (body) => {
      f.emit(
        event('permission.asked', {
          id: 'command-approval',
          sessionID: 's1',
          permission: 'read',
          patterns: [],
          always: [],
          metadata: {}
        })
      )
      f.reply(body.messageID as string)
      await new Promise<void>((resolve) => {
        finish = resolve
      })
    })
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    try {
      const result = await frame(iterator)
      expect(
        result.flatMap((batch) => batch.events).some((value) => value.type === 'turn.ended')
      ).toBe(true)
      const request = f.requests.find(
        (item) => new URL(item.url).pathname.endsWith('/command') && item.method === 'POST'
      )!
      expect(await request.json()).toMatchObject({
        command: 'docs:search',
        arguments: 'find auth',
        model: 'provider/model-B',
        agent: 'reviewer',
        variant: 'deep',
        parts: [{ filename: 'a.txt', type: 'file' }]
      })
      const context = f.requests.find((item) => new URL(item.url).pathname.endsWith('/message'))!
      expect(await context.json()).toMatchObject({
        noReply: true,
        parts: [{ text: 'session policy B', synthetic: true }]
      })
      await vi.waitFor(() =>
        expect(f.requests.some((item) => item.url.includes('/command-approval/reply'))).toBe(true)
      )
      expect(approve).toHaveBeenCalledOnce()
      expect((await f.live.nativeResources!()).commands).toEqual([
        {
          name: 'docs:search',
          source: 'mcp',
          description: 'Search docs',
          argumentHint: 'query',
          skill: false
        }
      ])
      expect(f.requests.some((item) => item.url.includes('prompt_async'))).toBe(false)
    } finally {
      finish?.()
      await dispose(f.live, iterator)
    }
  })

  it('surfaces a rejected command and ignores a previous command error after a later submission', async () => {
    const f = fixture({ text: '/native:review' })
    f.setCommands([{ name: 'native:review', hints: [] }])
    let fail!: () => void
    f.setPrompt(async (body) => {
      f.reply(body.messageID as string)
      return new Promise<Response>((resolve) => {
        fail = () => resolve(jsonResponse({ error: 'failed' }, 500))
      })
    })
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    try {
      await frame(iterator)
      f.setPrompt(async (body) => {
        f.reply(body.messageID as string)
      })
      await f.live.pushTurn!({ text: 'Next regular input' })
      fail()
      expect((await frame(iterator)).flatMap((batch) => batch.events).at(-1)?.type).toBe(
        'turn.ended'
      )
      expect((await f.live.nativeResources!()).state).toBe('connected')
    } finally {
      await dispose(f.live, iterator)
    }

    const rejected = fixture({ text: '/native:review' })
    rejected.setCommands([{ name: 'native:review', hints: [] }])
    rejected.setPrompt(async () => jsonResponse({ error: 'failed' }, 500))
    const receiving = rejected.live.eventBatches[Symbol.asyncIterator]()
    const result = frame(receiving)
    try {
      await vi.waitFor(() =>
        expect(
          rejected.requests.some((item) => item.method === 'POST' && item.url.includes('/command'))
        ).toBe(true)
      )
      rejected.emit(event('server.connected', {}))
      expect(
        (await result).flatMap((batch) => batch.events).some((value) => value.type === 'error')
      ).toBe(true)
    } finally {
      await dispose(rejected.live, receiving)
    }
  })

  it('sends an unknown slash through the ordinary prompt path', async () => {
    const f = fixture({ text: '/unknown keep me' })
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    try {
      await frame(iterator)
      const prompt = f.requests.find((item) => item.url.includes('prompt_async'))!
      expect(await prompt.json()).toMatchObject({ parts: [{ text: '/unknown keep me' }] })
    } finally {
      await dispose(f.live, iterator)
    }
  })
  it('carries the selected engine model limit through the channel into telemetry', async () => {
    const f = fixture({
      providerSettings: {
        providerKey: 'engine',
        provider: 'provider-1',
        sourceRevision: 'r',
        settings: {
          provider: { 'provider-1': { models: { 'model-1': { limit: { context: 54321 } } } } }
        }
      }
    })
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    try {
      const events = (await frame(iterator)).flatMap((batch) => batch.events)
      expect(events.find((event) => event.type === 'telemetry')).toMatchObject({
        usage: { contextWindow: 54321, contextTokens: 19 }
      })
    } finally {
      await dispose(f.live, iterator)
    }
  })
  it('creates a replacement native session without trying to reuse an expired server identity', async () => {
    const f = fixture()
    try {
      expect(await f.adapter.recoverSession({ sessionId: 'expired', cwd: 'C:/work' })).toEqual({
        sessionId: 'replacement',
        freshStart: false
      })
      const request = f.requests.find((request) => new URL(request.url).pathname === '/session')!
      expect(new URL(request.url).searchParams.get('directory')).toBe('C:/work')
      expect(await request.json()).toEqual({
        permission: [{ permission: '*', pattern: '*', action: 'ask' }]
      })
    } finally {
      f.live.close()
    }
  })
  it('sends archived context only to the model and routes the replacement native session to the existing Orca transcript', async () => {
    const onPrompt = vi.fn()
    const f = fixture({
      sessionId: 'orca-archive',
      nativeSessionId: 's1',
      recovery: { history: 'archived conversation', freshStart: false, onPrompt }
    })
    const iterator = f.live.eventBatches[Symbol.asyncIterator]()
    try {
      const events = (await frame(iterator)).flatMap((batch) => batch.events)
      const request = f.requests.find((req) => req.url.includes('/prompt_async'))!
      const body = await request.json()
      expect(new URL(request.url).pathname).toBe('/session/s1/prompt_async')
      expect(body.parts[0].text).toContain('archived conversation')
      expect(body.parts[0].text).toMatch(/First$/)
      expect(onPrompt).toHaveBeenCalledWith(body.messageID)
      expect(events.find((event) => event.type === 'input.echo')).toMatchObject({
        sessionId: 'orca-archive',
        text: 'First',
        nativeMessageId: body.messageID
      })
      expect(
        events.every((event) => !('sessionId' in event) || event.sessionId === 'orca-archive')
      ).toBe(true)
      f.setPrompt(async (next) => f.reply(next.messageID as string))
      await f.live.pushTurn!({ text: 'Later', promptUuid: 'later' })
      await frame(iterator)
      expect(
        (await f.requests.filter((req) => req.url.includes('/prompt_async'))[1].json()).parts[0]
          .text
      ).toBe('Later')
      expect(onPrompt).toHaveBeenCalledTimes(1)
    } finally {
      await dispose(f.live, iterator)
    }
  })
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
        nativeMessageId: expect.any(String),
        sessionId: 's1',
        text: 'Second',
        uuid: 'second'
      })
      expect(f.requests.map((request) => new URL(request.url).pathname)).toEqual([
        '/agent',
        '/provider',
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
        nativeMessageId: expect.any(String),
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

it('exposes native resources from the live channel client and its directory without mutations', async () => {
  const f = fixture({ cwd: 'C:/native-B' })
  const iterator = f.live.eventBatches[Symbol.asyncIterator]()
  try {
    expect(await f.live.nativeResources?.()).toEqual({ state: 'disconnected', items: [] })
    await frame(iterator)
    expect(await f.live.nativeResources?.()).toEqual({
      state: 'connected',
      generation: f.live.providerGeneration,
      commands: [],
      partial: true,
      items: [
        {
          id: 'native',
          name: 'native',
          kind: 'mcp',
          status: 'connected',
          enabled: true,
          canToggle: false
        },
        {
          id: openCodePluginId('@native/plugin@1'),
          name: '@native/plugin@1',
          kind: 'plugin',
          status: 'enabled',
          enabled: true,
          canToggle: false
        }
      ]
    })
    const requests = f.requests.filter((request) =>
      ['/mcp', '/config'].includes(new URL(request.url).pathname)
    )
    expect(requests).toHaveLength(2)
    for (const request of requests) {
      expect(new URL(request.url).searchParams.get('directory')).toBe('C:/native-B')
      expect(request.method).toBe('GET')
    }
    expect(f.live.setNativeResource).toBeUndefined()
  } finally {
    await dispose(f.live, iterator)
  }
  expect(await f.live.nativeResources?.()).toEqual({ state: 'disconnected', items: [] })
})

it('resolves the native plugin directory with the same environment as the live channel', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-channel-plugin-')).then((path) => realpath(path))
  const directory = join(
    root,
    'opencode',
    'packages',
    '@native/plugin@1',
    'node_modules',
    '@native/plugin'
  )
  await mkdir(directory, { recursive: true })
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ description: 'Channel plugin skills' })
  )
  const f = fixture({ cwd: root, env: { XDG_CACHE_HOME: root } })
  const iterator = f.live.eventBatches[Symbol.asyncIterator]()
  try {
    expect(
      await f.live.nativePluginDirectory?.(openCodePluginId('@native/plugin@1'))
    ).toBeUndefined()
    await frame(iterator)
    expect(
      (await f.live.nativeResources?.())?.items.find((item) => item.kind === 'plugin')?.description
    ).toBe('Channel plugin skills')
    expect(await f.live.nativePluginDirectory?.(openCodePluginId('@native/plugin@1'))).toBe(
      directory
    )
    expect(await f.live.nativePluginDirectory?.('plugin:0')).toBeUndefined()
  } finally {
    await dispose(f.live, iterator)
    await rm(root, { recursive: true, force: true })
  }
})
