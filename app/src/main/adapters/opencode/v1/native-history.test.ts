import { describe, expect, it, vi, type Mock } from 'vitest'
import type {
  AssistantMessage,
  OpencodeClient,
  Part,
  Session,
  ToolPart
} from '@opencode-ai/sdk/v2/client'
import type { NativeHistoryRequest } from '../../common/native-history'
import { createOpenCodeAdapter, type OpenCodeServer } from '../index'
import { assistantMessage, editTool, jsonResponse, textPart } from './adapter.testfixture'
import {
  nativeHistoryBusy,
  nativeRevision,
  projectNativeMessages,
  readOpenCodeHistory,
  type NativeMessages,
  type NativeReadDependencies
} from './native-history'

const request: NativeHistoryRequest = { sessionId: 's1', cwd: 'C:/work' }

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    slug: 'fixture',
    projectID: 'project',
    directory: request.cwd,
    title: 'Fixture',
    version: '1.19.0',
    time: { created: 1, updated: 120 },
    ...overrides
  }
}

function user(id = 'u1', parts: Part[] = []): NativeMessages[number] {
  return {
    info: {
      id,
      sessionID: 's1',
      role: 'user',
      time: { created: 1 },
      agent: 'build',
      model: { providerID: 'provider-1', modelID: 'model-1' }
    },
    parts
  }
}

function answer(
  id = 'a1',
  parts: Part[] = [],
  overrides: Partial<AssistantMessage> = {}
): NativeMessages[number] {
  return { info: { ...assistantMessage('s1', 'u1', id), finish: 'stop', ...overrides }, parts }
}

function text(text: string, messageID = 'a1', id = `text-${messageID}`): Part {
  return textPart(text, { id, messageID, time: { start: 100, end: 120 } })
}

function response<T>(
  data: T | undefined,
  status = 200
): { data: T | undefined; response: Response } {
  return { data, response: new Response(null, { status }) }
}

function fixture(messages: NativeMessages = [user(), answer('a1', [text('answer')])]): {
  deps: NativeReadDependencies
  get: Mock<() => Promise<{ data: Session | undefined; response: Response }>>
  messages: Mock<() => Promise<{ data: NativeMessages | undefined; response: Response }>>
  migrate: Mock<NonNullable<NativeReadDependencies['migrate']>>
} {
  const get = vi.fn(async () => response<Session>(session()))
  const readMessages = vi.fn(async () => response<NativeMessages>(messages))
  const migrate = vi.fn<NonNullable<NativeReadDependencies['migrate']>>()
  const client = { session: { get, messages: readMessages } } as unknown as OpencodeClient
  return {
    get,
    messages: readMessages,
    migrate,
    deps: {
      client: vi.fn(async () => client),
      sourceKey: vi.fn(async () => 'fixture-source'),
      migrate
    }
  }
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

describe('OpenCode native completion evidence', () => {
  it('allows a complete latest response even when an earlier turn was interrupted', () => {
    expect(
      nativeHistoryBusy([
        user('old'),
        answer('old-answer', [], { parentID: 'old', time: { created: 1 }, finish: undefined }),
        user(),
        answer()
      ])
    ).toBe(false)
    expect(nativeHistoryBusy([])).toBe(false)
  })

  it.each([
    ['unanswered user', [user()]],
    ['different parent', [user(), answer('a1', [], { parentID: 'other' })]],
    ['missing completion', [user(), answer('a1', [], { time: { created: 1 } })]],
    ['missing finish', [user(), answer('a1', [], { finish: undefined })]],
    ['unfinished continuation', [user(), answer('a1', [], { finish: 'tool-calls' })]]
  ] as const)('defers %s', (_name, messages) => {
    expect(nativeHistoryBusy([...messages])).toBe(true)
  })

  it.each(['pending', 'running'] as const)(
    'defers a %s tool even when the message has a stop marker',
    (status) => {
      const state: ToolPart['state'] =
        status === 'pending'
          ? { status, input: {}, raw: '' }
          : { status, input: {}, time: { start: 1 } }
      expect(nativeHistoryBusy([user(), answer('a1', [editTool({ state })])])).toBe(true)
    }
  )

  it('accepts a closed error and a completed tool continuation followed by the final answer', () => {
    expect(
      nativeHistoryBusy([
        user(),
        answer('a1', [], {
          error: { name: 'UnknownError', data: { message: 'failed' } },
          time: { created: 1 },
          finish: undefined
        })
      ])
    ).toBe(false)
    expect(
      nativeHistoryBusy([
        user(),
        answer('tool', [editTool({ messageID: 'tool' })], { finish: 'tool-calls' }),
        answer('final')
      ])
    ).toBe(false)
  })
})

describe('OpenCode native message projection', () => {
  it('preserves native IDs, response grouping, normalized tools, question answers and immutable source data', () => {
    const question = editTool({
      id: 'question-part',
      messageID: 'a2',
      callID: 'question-call',
      tool: 'question',
      state: {
        status: 'completed',
        input: { questions: [{ question: 'Which?', header: 'Choice', options: [] }] },
        output: 'User answered Blue',
        title: 'Question',
        metadata: { answers: [['Blue']] },
        time: { start: 130, end: 140 }
      }
    })
    const source = freeze<NativeMessages>([
      user('u1', [text('question', 'u1')]),
      answer('a1', [editTool(), text('first')], { finish: 'tool-calls' }),
      answer('a2', [question, text('second', 'a2')]),
      user('u2', [text('next', 'u2')]),
      answer('a3', [text('third', 'a3')], { parentID: 'u2' })
    ])
    const before = JSON.stringify(source)
    const projected = projectNativeMessages('s1', source)
    expect(projected.map(({ id, sourceIds }) => ({ id, sourceIds }))).toEqual([
      { id: 'u1', sourceIds: undefined },
      { id: 'a1', sourceIds: ['a1', 'a2'] },
      { id: 'u2', sourceIds: undefined },
      { id: 'a3', sourceIds: undefined }
    ])
    expect(projected[1].parts).toEqual([
      {
        type: 'tool_call',
        toolRunId: 'call-1',
        toolName: 'Edit',
        args: {
          filePath: 'src/a.ts',
          oldString: 'old',
          newString: 'new',
          file_path: 'src/a.ts',
          old_string: 'old',
          new_string: 'new'
        },
        providerTool: { name: 'edit', input: editTool().state.input }
      },
      {
        type: 'tool_result',
        toolRunId: 'call-1',
        result: 'Updated file',
        isError: false,
        durationMs: 25,
        structuredOutput: { diff: '-old\n+new' }
      },
      { type: 'text', text: 'first' },
      {
        type: 'tool_call',
        toolRunId: 'question-call',
        toolName: 'AskUserQuestion',
        args: question.state.input,
        providerTool: { name: 'question', input: question.state.input }
      },
      {
        type: 'tool_result',
        toolRunId: 'question-call',
        result: 'User answered Blue',
        isError: false,
        durationMs: 10,
        structuredOutput: { answers: [['Blue']] }
      },
      { type: 'text', text: 'second' }
    ])
    expect(JSON.stringify(source)).toBe(before)
  })

  it('keeps automatic-input provenance, skips ignored text, and preserves files, reasoning and compaction', () => {
    const file: Part = {
      id: 'file',
      sessionID: 's1',
      messageID: 'u1',
      type: 'file',
      mime: 'text/plain',
      url: 'file:///fixture/input.txt'
    }
    const compact: Part = {
      id: 'compact',
      sessionID: 's1',
      messageID: 'a1',
      type: 'compaction',
      auto: true
    }
    const source: NativeMessages = [
      user('u1', [
        {
          ...textPart('<system-reminder>continue</system-reminder>'),
          id: 'reminder',
          messageID: 'u1',
          synthetic: true
        },
        { ...textPart('<other>automatic</other>'), id: 'tagged', messageID: 'u1', synthetic: true },
        { ...textPart('ordinary'), id: 'ordinary', messageID: 'u1' },
        { ...textPart('ignored'), id: 'ignored', messageID: 'u1', ignored: true },
        file
      ]),
      answer('a1', [
        {
          id: 'reason',
          sessionID: 's1',
          messageID: 'a1',
          type: 'reasoning',
          text: 'reasoning',
          time: { start: 1, end: 2 }
        },
        text('done'),
        compact,
        { ...file, id: 'output', messageID: 'a1', url: 'file:///fixture/output.txt' }
      ])
    ]
    expect(projectNativeMessages('s1', freeze(source)).map((message) => message.parts)).toEqual([
      [
        {
          type: 'text',
          text: '<system-reminder>continue</system-reminder>',
          origin: { kind: 'automatic', format: 'system-reminder' }
        },
        {
          type: 'text',
          text: '<other>automatic</other>',
          origin: { kind: 'automatic', format: 'tagged' }
        },
        { type: 'text', text: 'ordinary' },
        { type: 'file', path: 'file:///fixture/input.txt' }
      ],
      [
        { type: 'reasoning', text: 'reasoning' },
        { type: 'text', text: 'done' },
        { type: 'compact_boundary', trigger: 'auto' },
        { type: 'file', path: 'file:///fixture/output.txt' }
      ]
    ])
  })

  it('retains a native user compaction marker', () => {
    const compact: Part = {
      id: 'compact',
      sessionID: 's1',
      messageID: 'u1',
      type: 'compaction',
      auto: false
    }
    expect(projectNativeMessages('s1', [user('u1', [compact])])[0].parts).toEqual([
      { type: 'compact_boundary', trigger: 'manual' }
    ])
  })

  it('keeps partial content and completed tools when the assistant ends in a classified error', () => {
    const source = freeze<NativeMessages>([
      user(),
      answer('a1', [editTool(), text('partial answer')], {
        error: {
          name: 'ProviderAuthError',
          data: { providerID: 'provider-1', message: 'Authorization: secret-fixture-token' }
        }
      })
    ])
    const parts = projectNativeMessages('s1', source)[1].parts
    expect(parts).toContainEqual({ type: 'text', text: 'partial answer' })
    expect(parts).toContainEqual(
      expect.objectContaining({ type: 'tool_result', toolRunId: 'call-1', isError: false })
    )
    expect(parts).toContainEqual(
      expect.objectContaining({
        type: 'error',
        error: expect.objectContaining({ category: 'auth_error' })
      })
    )
    expect(JSON.stringify(parts)).not.toContain('secret-fixture-token')
  })

  it('retains a native tool error, call ID and duration', () => {
    const tool = editTool({
      state: {
        status: 'error',
        input: { filePath: 'missing.md' },
        error: 'File not found',
        time: { start: 20, end: 25 }
      }
    })
    expect(projectNativeMessages('s1', [user(), answer('a1', [tool])])[1].parts).toContainEqual({
      type: 'tool_result',
      toolRunId: 'call-1',
      result: 'File not found',
      isError: true,
      durationMs: 5
    })
  })
})

describe('OpenCode native read through the SDK boundary', () => {
  it('reads a stable native snapshot twice with the original ID and cwd and does not invoke migration', async () => {
    const f = fixture()
    const result = await readOpenCodeHistory(request, f.deps)
    expect(result).toMatchObject({
      status: 'ready',
      snapshot: {
        sessionId: 's1',
        cwd: request.cwd,
        sourceKey: 'fixture-source',
        revision: expect.any(String),
        messages: [
          { id: 'u1', role: 'user' },
          { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'answer' }] }
        ]
      }
    })
    expect(f.get).toHaveBeenCalledTimes(3)
    expect(f.messages).toHaveBeenCalledTimes(2)
    expect(f.get).toHaveBeenCalledWith(
      { sessionID: 's1', directory: request.cwd },
      { throwOnError: false }
    )
    expect(f.messages).toHaveBeenCalledWith(
      { sessionID: 's1', directory: request.cwd },
      { throwOnError: false }
    )
    expect(f.migrate).not.toHaveBeenCalled()
  })

  it('reports a native 404 as missing when no migration port exists', async () => {
    const f = fixture()
    f.get.mockResolvedValue(response<Session>(undefined, 404))
    expect(await readOpenCodeHistory(request, { ...f.deps, migrate: undefined })).toEqual({
      status: 'missing',
      message: expect.any(String)
    })
    expect(f.messages).not.toHaveBeenCalled()
  })

  it('runs migration only after 404 and revalidates the migrated native session', async () => {
    const f = fixture()
    f.get.mockResolvedValueOnce(response<Session>(undefined, 404))
    f.migrate.mockResolvedValue({ status: 'migrated' })
    expect(await readOpenCodeHistory(request, f.deps)).toMatchObject({ status: 'ready' })
    expect(f.migrate).toHaveBeenCalledExactlyOnceWith(request)
    expect(f.get).toHaveBeenCalledTimes(4)
  })

  it.each(['missing', 'unavailable', 'migration-required', 'busy'] as const)(
    'reports migration %s without reading or overwriting missing native data',
    async (status) => {
      const f = fixture()
      f.get.mockResolvedValue(response<Session>(undefined, 404))
      f.migrate.mockResolvedValue({ status, message: 'fixture migration result' })
      expect(await readOpenCodeHistory(request, f.deps)).toEqual({
        status: status === 'busy' ? 'migration-required' : status,
        message: 'fixture migration result'
      })
      expect(f.get).toHaveBeenCalledOnce()
      expect(f.messages).not.toHaveBeenCalled()
    }
  )

  it('reports 403 as unavailable without attempting migration or exposing provider details', async () => {
    const f = fixture()
    f.get.mockResolvedValue(response<Session>(undefined, 403))
    const result = await readOpenCodeHistory(request, f.deps)
    expect(result).toEqual({ status: 'unavailable', message: expect.any(String) })
    expect(f.migrate).not.toHaveBeenCalled()
    expect(f.messages).not.toHaveBeenCalled()
  })

  it.each([{ id: 'other' }, { directory: 'C:/other' }])(
    'rejects an identity mismatch %j before reading messages',
    async (override) => {
      const f = fixture()
      f.get.mockResolvedValue(response<Session>(session(override)))
      expect(await readOpenCodeHistory(request, f.deps)).toEqual({
        status: 'migration-required',
        message: expect.any(String)
      })
      expect(f.migrate).not.toHaveBeenCalled()
      expect(f.messages).not.toHaveBeenCalled()
    }
  )

  it.each([{ id: 'other' }, { directory: 'C:/other' }])(
    'rejects a stable identity mismatch %j introduced during the repeated read',
    async (override) => {
      const f = fixture()
      f.get
        .mockResolvedValueOnce(response(session()))
        .mockResolvedValue(response(session(override)))
      expect(await readOpenCodeHistory(request, f.deps)).toEqual({
        status: 'migration-required',
        message: expect.any(String)
      })
      expect(f.get).toHaveBeenCalledTimes(3)
      expect(f.messages).toHaveBeenCalledTimes(2)
      expect(f.deps.sourceKey).toHaveBeenCalledWith(request)
    }
  )

  it.each(['header', 'messages'] as const)('defers a changing %s revision', async (part) => {
    const f = fixture()
    if (part === 'header') {
      f.get
        .mockResolvedValueOnce(response(session()))
        .mockResolvedValueOnce(response(session()))
        .mockResolvedValueOnce(response(session({ time: { created: 1, updated: 200 } })))
    } else {
      f.messages
        .mockResolvedValueOnce(response([user(), answer('a1', [text('before')])]))
        .mockResolvedValueOnce(response([user(), answer('a1', [text('after')])]))
    }
    expect(await readOpenCodeHistory(request, f.deps)).toEqual({
      status: 'busy',
      message: expect.any(String)
    })
    expect(f.deps.sourceKey).toHaveBeenCalledWith(request)
  })

  it('defers a stable but incomplete native response', async () => {
    const f = fixture([user()])
    expect(await readOpenCodeHistory(request, f.deps)).toEqual({
      status: 'busy',
      message: expect.any(String)
    })
    expect(f.messages).toHaveBeenCalledTimes(2)
  })

  it.each(['client', 'get', 'messages', 'sourceKey'] as const)(
    'redacts an exception from %s',
    async (stage) => {
      const f = fixture()
      const error = new Error('Authorization: secret-fixture-token')
      if (stage === 'client') f.deps.client = vi.fn().mockRejectedValue(error)
      else if (stage === 'sourceKey') f.deps.sourceKey = vi.fn().mockRejectedValue(error)
      else f[stage].mockRejectedValue(error)
      const result = await readOpenCodeHistory(request, f.deps)
      expect(result).toEqual({ status: 'unavailable', message: expect.any(String) })
      expect(JSON.stringify(result)).not.toContain('secret-fixture-token')
    }
  )

  it('wires the registered adapter to the installed SDK for read-only native requests with the selected environment', async () => {
    const requests: Request[] = []
    const native = [user('u1', [text('question', 'u1')]), answer('a1', [text('answer')])]
    const transport: typeof fetch = async (input, init) => {
      const req = new Request(input, init)
      requests.push(req.clone())
      const url = new URL(req.url)
      expect(req.method).toBe('GET')
      expect(url.searchParams.get('directory')).toBe(request.cwd)
      expect(req.headers.get('Authorization')).toBe('Basic fixture')
      if (url.pathname === '/session/s1') return jsonResponse(session())
      if (url.pathname === '/session/s1/message') return jsonResponse(native)
      throw new Error(`Unexpected SDK request ${req.method} ${url.pathname}`)
    }
    const server: OpenCodeServer = {
      acquire: vi.fn(async () => ({
        url: 'http://opencode.test',
        headers: { Authorization: 'Basic fixture' }
      })),
      databasePath: vi.fn(async () => 'C:/fixture/native/opencode.db'),
      installed: vi.fn(async () => ({ installed: true })),
      close: vi.fn()
    }
    const adapter = createOpenCodeAdapter({
      dataDirectory: 'C:/fixture/orca',
      preferences: () => undefined,
      fetchImpl: transport,
      server
    })
    const req: NativeHistoryRequest = {
      ...request,
      env: { XDG_DATA_HOME: 'C:/fixture/native' },
      providerSettings: {
        providerKey: 'fixture',
        provider: 'openai',
        sourceRevision: 'fixture',
        settings: { model: 'provider/model' }
      }
    }
    const result = await adapter.readHistory?.(req)
    expect(result).toMatchObject({
      status: 'ready',
      snapshot: {
        sessionId: 's1',
        sourceKey: nativeRevision(['C:/fixture/native/opencode.db', request.cwd]),
        messages: [{ id: 'u1' }, { id: 'a1', parts: [{ type: 'text', text: 'answer' }] }]
      }
    })
    expect(server.acquire).toHaveBeenCalledExactlyOnceWith(
      req.providerSettings?.settings,
      req.env,
      req.cwd
    )
    expect(server.databasePath).toHaveBeenCalledExactlyOnceWith(
      req.providerSettings?.settings,
      req.env,
      req.cwd
    )
    expect(requests.map((req) => new URL(req.url).pathname)).toEqual([
      '/session/s1',
      '/session/s1',
      '/session/s1/message',
      '/session/s1',
      '/session/s1/message'
    ])
  })
})

it('skips SDK messages only when the committed per-session probe still matches', async () => {
  const f = fixture()
  const probe = vi
    .fn()
    .mockResolvedValue({ kind: 'opencode-sqlite', sequence: 4, digest: 'before' })
  const deps = { ...f.deps, probe }
  const first = await readOpenCodeHistory(request, deps)
  if (first.status !== 'ready') throw new Error('snapshot required')
  f.messages.mockClear()
  const previous = { snapshot: first.snapshot, cursor: first.cursor }
  expect(await readOpenCodeHistory({ ...request, previous }, deps)).toEqual({ status: 'unchanged' })
  expect(f.messages).not.toHaveBeenCalled()
  probe.mockResolvedValue({
    kind: 'opencode-sqlite',
    sequence: 4,
    digest: 'part-updated-without-seq'
  })
  const changed = await readOpenCodeHistory({ ...request, previous }, deps)
  expect(changed.status).toBe('ready')
  expect(f.messages).toHaveBeenCalledTimes(2)
  expect(changed.status === 'ready' && changed.cursor?.checkpoint.digest).toBe(
    'part-updated-without-seq'
  )
})

it('does not pair a cursor from after a concurrent mutation with an earlier SDK snapshot', async () => {
  const f = fixture()
  const probe = vi
    .fn()
    .mockResolvedValueOnce({ digest: 'before' })
    .mockResolvedValue({ digest: 'after' })
  const result = await readOpenCodeHistory(request, { ...f.deps, probe })
  expect(result.status).toBe('busy')
  expect(result).not.toHaveProperty('cursor')
})

it('uses a stable SDK revision when the native schema has no supported checkpoint', async () => {
  const f = fixture()
  const first = await readOpenCodeHistory(request, f.deps)
  if (first.status !== 'ready') throw new Error('snapshot required')
  expect(
    await readOpenCodeHistory(
      { ...request, previous: { snapshot: first.snapshot, cursor: first.cursor } },
      f.deps
    )
  ).toEqual({ status: 'unchanged' })
})
