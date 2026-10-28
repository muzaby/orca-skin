import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Event } from '@opencode-ai/sdk/v2'
import type { NormalizedEvent } from '../../../../shared/ipc'
import type { TurnRequest } from '../../common/turn'
import type { ProviderMessageBatch } from '../../common/types'
import { OpenCodeAdapter } from './adapter'
import { OpenCodeServerPool } from './server'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { retentionTransport } from './opencode-retention.testfixture'
import { managedMcpAlias } from './managed-mcp'
import { openCodeDiscovery } from './discovery-cache'
import { setRootLogger } from '../../../infra/log/registry'
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
it('projects disabled global MCP overrides and connects them through the directory manager', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-global-projection-'))
  const aPath = join(root, 'A'),
    bPath = join(root, 'B')
  const configRoot = join(root, 'config')
  await mkdir(join(configRoot, 'opencode'), { recursive: true })
  await mkdir(aPath)
  await mkdir(bPath)
  const alias = managedMcpAlias('user', 'collision')
  const file = join(configRoot, 'opencode', 'opencode.json')
  const original = JSON.stringify({
    mcp: {
      native: { type: 'local', command: ['native'] },
      [alias]: { type: 'local', command: ['collision'] },
      disabled: { type: 'local', command: ['disabled'], enabled: false }
    }
  })
  await writeFile(file, original)
  await writeFile(
    join(aPath, 'opencode.json'),
    '{"mcp":{"projectOnly":{"type":"local","command":["project"]}}}'
  )
  const snapshot = {
    revision: 1,
    users: {
      collision: { command: 'managed' },
      good: { command: 'good' },
      bad: { command: 'bad' }
    },
    plugins: new Map()
  }
  const good = managedMcpAlias('user', 'good'),
    bad = managedMcpAlias('user', 'bad')
  const env = { XDG_CONFIG_HOME: configRoot }
  openCodeDiscovery.invalidate()
  const f = retentionTransport(
    {
      snapshot: () => snapshot,
      acquire: async () => ({ endpoints: new Map(), release: async () => {} })
    },
    { global: () => ({}) }
  )
  try {
    const a = await f.adapter.client({}, env, aPath)
    const b = await f.adapter.client({}, env, bPath)
    expect(f.children).toHaveLength(1)
    expect(f.configs[0].mcp).toEqual({
      native: { enabled: false },
      [alias]: { enabled: false },
      [good]: expect.objectContaining({ enabled: false, type: 'local' }),
      [bad]: expect.objectContaining({ enabled: false, type: 'local' })
    })
    expect(f.configs[0].mcp).not.toHaveProperty('projectOnly')
    expect(f.configs[0].mcp).not.toHaveProperty('disabled')
    expect(await a.mcp(new AbortController().signal)).toEqual([])
    await f.adapter.reconcileConnections()
    expect(f.requests.filter((entry) => entry.path.startsWith('/mcp'))).toEqual([])
    expect(a.managedMcpMentions).toEqual({})
    const unblock = f.holdMutation(bad)
    a.activate?.()
    await a.prepare(new AbortController().signal)
    await vi.waitFor(() => expect(a.mcpControl!.connected(good)).toBe(true))
    expect(a.managedMcpMentions).toEqual({ [good]: good })
    expect(a.managedMcpReferences).toEqual({ [good]: good, [bad]: bad })
    expect(
      (await a.mcp(new AbortController().signal)).find((item) => item.id === bad)
    ).toMatchObject({
      enabled: true,
      canToggle: false,
      status: 'pending'
    })
    expect(
      f.requests
        .filter((entry) => entry.path.endsWith('/connect'))
        .map((entry) => entry.path)
        .sort()
    ).toEqual(
      [
        `/mcp/${alias}/connect`,
        `/mcp/${good}/connect`,
        `/mcp/${bad}/connect`,
        '/mcp/native/connect',
        '/mcp/projectOnly/connect'
      ].sort()
    )
    expect(
      f.requests.filter((entry) => entry.directory === bPath && entry.path.startsWith('/mcp'))
    ).toEqual([])
    f.failMutation(true)
    unblock()
    await a.mcpControl!.submit(new AbortController().signal, async () => {}, [bad])
    expect(a.managedMcpMentions).toEqual({ [good]: good })
    const live = f.adapter.sendMessage({
      sessionId: 's1',
      cwd: aPath,
      env,
      text: `use @${bad}`,
      extensions: { skills: [], hooks: { normalized: {} }, managedMcp: snapshot }
    })
    const iterator = live.eventBatches[Symbol.asyncIterator]()
    try {
      await iterator.next()
      await vi.waitFor(() =>
        expect(f.requests.filter((entry) => entry.path.endsWith('/prompt_async'))).toHaveLength(1)
      )
      const prompt = f.requests.find((entry) => entry.path.endsWith('/prompt_async'))!.body as {
        system: string
      }
      expect(prompt.system).toContain(good)
      expect(prompt.system).not.toContain(bad)
      f.finish()
      for (;;) {
        const batch = await iterator.next()
        if (batch.done || batch.value.events.some((entry) => entry.type === 'turn.ended')) break
      }
    } finally {
      live.close()
      await iterator.return?.()
    }
    expect(await readFile(file, 'utf8')).toBe(original)
    await a.release()
    await b.release()
    const unmanaged = retentionTransport(undefined, { global: () => ({}) })
    try {
      const onlyNative = await unmanaged.adapter.client({}, env, bPath)
      expect(unmanaged.configs[0].mcp).toEqual({
        native: { enabled: false },
        [alias]: { enabled: false }
      })
      onlyNative.activate?.()
      await vi.waitFor(() => expect(unmanaged.status(bPath, 'native')).toBe('connected'))
      await onlyNative.release()
    } finally {
      unmanaged.adapter.close()
    }
  } finally {
    f.adapter.close()
    setRootLogger(null)
    openCodeDiscovery.invalidate()
    await rm(root, { recursive: true, force: true })
  }
})
function fixture(
  controls?: import('../../common/extension-control').ExtensionControl,
  preferences?: () => import('../../../../shared/harness').OpenCodePreferences
): {
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
  permissionError?: { status: number; body: unknown }
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
      if (result.permissionError && path.startsWith('/permission/'))
        return jsonResponse(result.permissionError.body, result.permissionError.status)
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
  const servers = { acquire, close: vi.fn() } as unknown as OpenCodeServerPool
  const result: ReturnType<typeof fixture> = {
    adapter: new OpenCodeAdapter(servers, transport, undefined, undefined, controls, preferences),
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
  expect(await live.reconcileNativeResources!(revision, () => true)).toBe('pending')
  const prompt = await f.requests.find((r) => r.url.includes('/prompt_async'))!.json()
  finish(f, prompt.messageID)
  for (;;) {
    const batch = await iterator.next()
    if (batch.done || batch.value.events.some((entry) => entry.type === 'turn.ended')) break
  }
  expect(await live.reconcileNativeResources!(revision, () => true)).toBe('applied')
  expect((await live.nativeResources!()).items[0].enabled).toBe(false)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 5_001)
  f.failMcp = true
  expect(await live.nativeResources!()).toMatchObject({
    partial: true,
    items: [{ id: 'docs', enabled: false, canToggle: false }]
  })
  live.close()
  await iterator.return?.()
  expect(await live.nativeResources!()).toEqual({ state: 'disconnected', items: [] })
  expect(f.release).not.toHaveBeenCalled()
  f.adapter.close()
  expect(f.release).toHaveBeenCalledOnce()
  vi.useRealTimers()
})
it('shares prepared and live inventory slots until freshness expiry and retries failed reads', async () => {
  const f = fixture()
  const prepared = await f.adapter.prepareComposer!({ cwd: 'C:/work' })
  prepared.activate?.()
  const signal = new AbortController().signal
  await Promise.all(
    ['agents', 'models', 'mcp'].map((part) =>
      prepared.read(part as 'agents' | 'models' | 'mcp', signal)
    )
  )
  f.onPrompt = (body) => finish(f, String(body.messageID))
  const live = f.adapter.sendMessage(request())
  const iterator = live.eventBatches[Symbol.asyncIterator]()
  for (;;) {
    const batch = await iterator.next()
    if (batch.done || batch.value.events.some((event) => event.type === 'turn.ended')) break
  }
  const count = (path: string): number =>
    f.requests.filter((request) => new URL(request.url).pathname === path).length
  try {
    const initial = await live.nativeResources!()
    expect(initial).toMatchObject({
      state: 'connected',
      items: [{ id: 'docs', status: 'connected' }],
      composer: { agents: [{ name: 'build' }], models: [{ id: 'vendor/model/name' }] }
    })
    await live.nativeResources!()
    expect([count('/agent'), count('/provider'), count('/mcp')]).toEqual([1, 1, 1])
    expect(count('/command')).toBe(3)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 5000)
    f.failMcp = true
    expect(await live.nativeResources!()).toMatchObject({ partial: true })
    expect(count('/mcp')).toBe(2)
    f.failMcp = false
    expect((await live.nativeResources!()).partial).toBeUndefined()
    expect(count('/mcp')).toBe(3)
    await prepared.read('mcp', signal, true)
    expect(count('/mcp')).toBe(4)
    expect([count('/agent'), count('/provider')]).toEqual([1, 1])
  } finally {
    vi.useRealTimers()
    live.close()
    await iterator.return?.()
    await prepared.release()
    f.adapter.close()
  }
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
  it.each([
    { id: 'settled', tag: 'PermissionNotFoundError', auto: false, completes: true },
    { id: 'settled', tag: 'PermissionNotFoundError', auto: true, completes: true },
    { id: 'other', tag: 'PermissionNotFoundError', auto: false, completes: false },
    { id: 'settled', tag: 'OtherFailure', auto: false, completes: false }
  ])(
    'handles only the exact native settled permission: $id/$tag/auto=$auto',
    async ({ id, tag, auto, completes }) => {
      const f = fixture(undefined, () => ({ instructions: '', autoApprovePermissions: auto }))
      f.permissionError = {
        status: 404,
        body: { _tag: tag, requestID: id, message: 'raw-secret-sentinel' }
      }
      let prompt = ''
      f.onPrompt = (body) => {
        prompt = body.messageID as string
        f.emit(
          event('permission.asked', {
            id: 'settled',
            sessionID: 's1',
            permission: 'mcp',
            patterns: ['orca_*'],
            always: [],
            metadata: {}
          })
        )
      }
      f.onReply = () => {
        setTimeout(() => finish(f, prompt), 25)
      }
      const approvals = vi.fn<NonNullable<TurnRequest['requestApproval']>>(async () => ({
        behavior: 'deny'
      }))
      const events = await collect(f.adapter, request({ requestApproval: approvals }))
      expect(events.at(-1)?.type).toBe(completes ? 'turn.ended' : 'error')
      expect(approvals).toHaveBeenCalledTimes(auto ? 0 : 1)
      expect(JSON.stringify(events)).not.toContain('raw-secret-sentinel')
    }
  )
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
    expect(f.release).not.toHaveBeenCalled()
    f.adapter.close()
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
    expect(f.release).not.toHaveBeenCalled()
    f.adapter.close()
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
    expect(f.release).toHaveBeenCalledTimes(2)
    f.adapter.close()
    expect(f.release).toHaveBeenCalledTimes(3)
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
      expect(release).not.toHaveBeenCalled()
      adapter.close()
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
      '/session/s1/prompt_async'
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

it('auto-accepts permissions once while enabled and still asks questions', async () => {
  const f = fixture(undefined, () => ({ instructions: '', autoApprovePermissions: true }))
  let promptId = ''
  f.onPrompt = (body) => {
    promptId = body.messageID as string
    f.emit(
      event('permission.asked', {
        id: 'auto',
        sessionID: 's1',
        permission: 'bash',
        patterns: ['*'],
        always: ['*'],
        metadata: {}
      })
    )
    f.emit(
      event('question.asked', {
        id: 'ask',
        sessionID: 's1',
        questions: [
          { header: 'Pick', question: 'Choose', options: [{ label: 'A', description: 'first' }] }
        ]
      })
    )
  }
  let replies = 0
  f.onReply = () => {
    if (++replies === 2) finish(f, promptId)
  }
  const approve = vi.fn<NonNullable<TurnRequest['requestApproval']>>(async () => ({
    behavior: 'allow',
    updatedInput: { answers: { Choose: 'A' } }
  }))
  await collect(f.adapter, request({ requestApproval: approve }))
  expect(approve).toHaveBeenCalledOnce()
  expect(approve.mock.calls[0][0].kind).toBe('ask_question')
  const repliesByPath = await Promise.all(
    f.requests
      .filter((req) => new URL(req.url).pathname.endsWith('/reply'))
      .map(async (req) => [new URL(req.url).pathname, await req.json()])
  )
  expect(repliesByPath).toEqual(
    expect.arrayContaining([
      ['/permission/auto/reply', { reply: 'once' }],
      ['/question/ask/reply', { answers: [['A']] }]
    ])
  )
})
it('reads the auto-accept preference per request including child sessions', async () => {
  let enabled = false
  const preferences = vi.fn(() => ({ instructions: '', autoApprovePermissions: enabled }))
  const f = fixture(undefined, preferences)
  const permission = (id: string, sessionID = 's1'): void =>
    f.emit(
      event('permission.asked', {
        id,
        sessionID,
        permission: 'bash',
        patterns: ['*'],
        always: [],
        metadata: {}
      })
    )
  let promptId = ''
  f.onPrompt = (body) => {
    promptId = body.messageID as string
    f.emit(event('message.updated', { sessionID: 's1', info: assistantMessage('s1', promptId) }))
    f.emit(
      event('message.part.updated', {
        sessionID: 's1',
        time: 1,
        part: editTool({
          tool: 'task',
          callID: 'task-1',
          state: {
            status: 'running',
            input: {},
            metadata: { sessionId: 'child' },
            time: { start: 1 }
          }
        })
      })
    )
    permission('manual')
  }
  f.onReply = (path) => {
    if (path.includes('/manual/')) {
      enabled = true
      permission('child-auto', 'child')
    } else if (path.includes('/child-auto/')) {
      enabled = false
      permission('manual-again')
    } else {
      f.emit(
        event('message.part.updated', {
          sessionID: 's1',
          time: 2,
          part: editTool({
            tool: 'task',
            callID: 'task-1',
            state: {
              status: 'completed',
              input: {},
              metadata: { sessionId: 'child' },
              title: 'Done',
              output: 'done',
              time: { start: 1, end: 2 }
            }
          })
        })
      )
      finish(f, promptId)
    }
  }
  const approve = vi.fn<NonNullable<TurnRequest['requestApproval']>>(async () => ({
    behavior: 'deny'
  }))
  await collect(f.adapter, request({ requestApproval: approve }))
  expect(approve).toHaveBeenCalledTimes(2)
  expect(preferences).toHaveBeenCalledTimes(3)
  const replies = await Promise.all(
    f.requests
      .filter((req) => new URL(req.url).pathname.endsWith('/reply'))
      .map(async (req) => [new URL(req.url).pathname, await req.json()])
  )
  expect(replies).toEqual([
    ['/permission/manual/reply', { reply: 'reject' }],
    ['/permission/child-auto/reply', { reply: 'once' }],
    ['/permission/manual-again/reply', { reply: 'reject' }]
  ])
})
