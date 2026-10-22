import { expect, it, vi } from 'vitest'
import { prepareComposerCatalog, registerComposerCatalog } from './composer-catalog'
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { CHANNELS } from '../../shared/ipc'
import type { RouterContext } from './context'
import type { ComposerCatalogScope } from '../../shared/composer-catalog'
import { OpenCodeAdapter } from '../adapters/opencode/v1/adapter'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const handlers = vi.hoisted(
  () => new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
)
vi.mock('electron', () => ({
  ipcMain: {
    handle: (key: string, handler: (event: unknown, payload: unknown) => Promise<unknown>) =>
      handlers.set(key, handler)
  }
}))
vi.mock('../infra/config/orca-config', () => ({ appEnv: () => ({ PREVIEW_APP_ENV: 'app-value' }) }))

function fixture(): {
  adapter: OpenCodeAdapter
  fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>
  acquire: ReturnType<typeof vi.fn>
  ctx: RouterContext
  scope: ComposerCatalogScope
  capture: import('vitest').MockInstance<OpenCodeAdapter['prepareComposer']>
  resolve: import('vitest').Mock<
    (entry: {
      key: string
      modelProviderId: string
    }) => Promise<import('../adapters/common/harness-config').HarnessRuntimeConfig>
  >
  getSessionById: import('vitest').Mock<
    () => {
      id: string
      backend: string
      agent_kind: string
      provider_key: string
      project_id: string
      cwd: string
      last_model: null
    }
  >
  saved: {
    id: string
    backend: string
    agent_kind: string
    provider_key: string
    project_id: string
    cwd: string
    last_model: null
  }
} {
  const fetchImpl = vi.fn<typeof fetch>()
  const acquire = vi.fn(async () => ({ url: 'http://owned.test', headers: {}, release: vi.fn() }))
  const adapter = new OpenCodeAdapter({ acquire, installed: vi.fn(), close: vi.fn() }, fetchImpl)
  const capture = vi.spyOn(adapter, 'prepareComposer').mockResolvedValue({
    generation: 'native-generation',
    signal: new AbortController().signal,
    read: vi.fn(),
    release: vi.fn()
  })
  const entries = ['one', 'two'].map((id) => ({
    key: `opencode-${id}`,
    harnessId: 'opencode',
    modelProviderId: id,
    models: []
  }))
  const saved = {
    id: 'saved',
    backend: 'opencode',
    agent_kind: 'code',
    provider_key: 'opencode-two',
    project_id: 'saved-project',
    cwd: 'C:/saved',
    last_model: null
  }
  const getSessionById = vi.fn(() => saved)
  const resolve = vi.fn(
    async (entry: {
      key: string
      modelProviderId: string
    }): Promise<import('../adapters/common/harness-config').HarnessRuntimeConfig> => ({
      ...entry,
      harnessId: 'opencode',
      runtimeEnv: { PREVIEW_RUNTIME_ENV: `runtime-${entry.modelProviderId}` },
      settings: {
        providerKey: entry.key,
        provider: entry.modelProviderId,
        sourceRevision: 'v1',
        settings: { instructions: [`${entry.modelProviderId}.md`] }
      }
    })
  )
  const ctx = {
    registry: { get: () => adapter },
    harnessSettings: { list: () => entries },
    harnessRuntime: { resolve },
    runtimeModelCatalog: { merge: (value: unknown) => value, isReadOnly: () => false },
    db: { getSessionById },
    getCwd: (id: string | null) => (id === 'draft-project' ? 'C:/draft-project' : 'C:/default'),
    mcp: { resolver: () => () => undefined }
  } as unknown as RouterContext
  const scope: ComposerCatalogScope = {
    backend: 'opencode',
    sessionId: null,
    cwd: null,
    projectId: 'draft-project',
    providerKey: 'opencode-one',
    agentKind: 'code'
  }
  return { ctx, scope, capture, resolve, getSessionById, saved, adapter, fetchImpl, acquire }
}

it.each(['configuration', 'acquire'] as const)(
  'preserves the %s failure stage through the registered catalog handler',
  async (stage) => {
    const f = fixture()
    const error = Object.assign(new Error('PRIVATE_PATH PRIVATE_TOKEN'), { status: 503 })
    if (stage === 'configuration') f.resolve.mockRejectedValueOnce(error)
    else f.capture.mockRejectedValueOnce(error)
    const close = registerComposerCatalog(f.ctx)
    const sender = Object.assign(new EventEmitter(), { id: 83, isDestroyed: () => false })
    try {
      const result = await handlers.get(CHANNELS.composerCatalog)!(
        { sender },
        { owner: randomUUID(), scope: f.scope, part: 'plugins' }
      )
      expect(result).toEqual({
        part: 'plugins',
        status: 'error',
        failure: { stage, reason: 'http', httpStatus: 503 }
      })
      expect(JSON.stringify(result)).not.toMatch(/PRIVATE_PATH|PRIVATE_TOKEN/)
      if (stage === 'configuration') expect(f.capture).not.toHaveBeenCalled()
    } finally {
      close()
      f.adapter.close()
    }
  }
)

it('reads installed plugin metadata using the resolved provider cache environment', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-prepared-plugin-env-'))
  const f = fixture()
  f.capture.mockRestore()
  const cache = join(root, 'provider-cache')
  const directory = join(
    cache,
    'opencode',
    'packages',
    '@oracle/plugin@1',
    'node_modules',
    '@oracle/plugin'
  )
  await mkdir(directory, { recursive: true })
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ description: 'Provider-only metadata' })
  )
  f.resolve.mockResolvedValue({
    key: 'opencode-one',
    harnessId: 'opencode',
    modelProviderId: 'one',
    runtimeEnv: { XDG_CACHE_HOME: cache },
    settings: { providerKey: 'opencode-one', provider: 'one', sourceRevision: 'env', settings: {} }
  })
  f.fetchImpl.mockImplementation(async (input, init) => {
    const path = new URL(new Request(input, init).url).pathname
    return new Response(
      JSON.stringify(path === '/config' ? { plugin: ['@oracle/plugin@1'] } : true),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    )
  })
  try {
    expect(process.env.XDG_CACHE_HOME).not.toBe(cache)
    const lease = await prepareComposerCatalog(
      f.ctx,
      { ...f.scope, cwd: root },
      new AbortController().signal
    )
    try {
      expect(await lease.read('plugins', new AbortController().signal)).toEqual([
        expect.objectContaining({ name: '@oracle/plugin@1', description: 'Provider-only metadata' })
      ])
    } finally {
      await lease.release()
    }
  } finally {
    f.adapter.close()
    await rm(root, { recursive: true, force: true })
  }
})

it('prepares draft and saved directory with the same production settings and env resolution as turns', async () => {
  const f = fixture(),
    signal = new AbortController().signal
  await prepareComposerCatalog(f.ctx, { ...f.scope, providerKey: 'opencode-two' }, signal)
  expect(f.resolve).toHaveBeenLastCalledWith({
    key: 'opencode-two',
    harnessId: 'opencode',
    modelProviderId: 'two'
  })
  expect(f.capture).toHaveBeenLastCalledWith(
    expect.objectContaining({
      cwd: 'C:/draft-project',
      env: expect.objectContaining({
        PREVIEW_APP_ENV: 'app-value',
        PREVIEW_RUNTIME_ENV: 'runtime-two'
      }),
      providerSettings: expect.objectContaining({
        provider: 'two',
        settings: { instructions: ['two.md'] }
      })
    })
  )
  await prepareComposerCatalog(
    f.ctx,
    { ...f.scope, sessionId: 'saved', cwd: 'C:/untrusted', providerKey: null },
    signal
  )
  expect(f.capture).toHaveBeenLastCalledWith(
    expect.objectContaining({
      cwd: 'C:/saved',
      env: expect.objectContaining({ PREVIEW_RUNTIME_ENV: 'runtime-two' }),
      providerSettings: expect.objectContaining({ provider: 'two' })
    })
  )
})

it('returns prepared plugin and agent parts through IPC before blocked MCP/models without a session', async () => {
  const f = fixture()
  f.capture.mockRestore()
  const gates = {
    mcp: Promise.withResolvers<Response>(),
    provider: Promise.withResolvers<Response>()
  }
  const requests: Request[] = []
  f.fetchImpl.mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    const path = new URL(request.url).pathname
    const json = (value: unknown): Response =>
      new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
    if (path === '/config') return json({ plugin: ['@dynamic/plugin@1'] })
    if (path === '/agent') return json([{ name: 'Atlas', mode: 'primary' }])
    if (path === '/mcp') return gates.mcp.promise
    if (path === '/provider') return gates.provider.promise
    throw new Error('unexpected endpoint')
  })
  const close = registerComposerCatalog(f.ctx)
  const sender = Object.assign(new EventEmitter(), {
    id: 77,
    isDestroyed: () => false,
    send: vi.fn()
  })
  const owner = randomUUID()
  const read = (part: string, refresh = false): Promise<unknown> =>
    handlers.get(CHANNELS.composerCatalog)!({ sender }, { owner, scope: f.scope, part, refresh })
  try {
    const mcp = read('mcp')
    const models = read('models')
    expect(await read('plugins')).toMatchObject({
      part: 'plugins',
      value: [{ name: '@dynamic/plugin@1', kind: 'plugin', status: 'enabled' }]
    })
    expect(await read('agents')).toMatchObject({ value: [{ name: 'Atlas' }] })
    expect(f.acquire).toHaveBeenCalledOnce()
    expect(
      requests.every((r) => new URL(r.url).searchParams.get('directory') === 'C:\\draft-project')
    ).toBe(true)
    expect(requests.map((r) => new URL(r.url).pathname).sort()).toEqual([
      '/agent',
      '/config',
      '/mcp',
      '/provider'
    ])
    gates.mcp.resolve(
      new Response(JSON.stringify({ dynamic: { status: 'connected' } }), {
        headers: { 'Content-Type': 'application/json' }
      })
    )
    gates.provider.resolve(
      new Response(JSON.stringify({ all: [], connected: [], default: {} }), {
        headers: { 'Content-Type': 'application/json' }
      })
    )
    expect(await mcp).toMatchObject({
      value: [{ id: 'dynamic', kind: 'mcp', status: 'connected', canToggle: false }]
    })
    await models
    await read('mcp')
    await read('plugins')
    expect(requests).toHaveLength(4)
  } finally {
    gates.mcp.resolve(new Response('{}'))
    gates.provider.resolve(new Response('{}'))
    f.adapter.close()
    close()
  }
})

it('does not start a native server after caller cancellation or session scope change during preparation', async () => {
  const f = fixture(),
    control = new AbortController()
  f.resolve.mockImplementationOnce(async () => {
    control.abort()
    return {
      key: 'opencode-one',
      modelProviderId: 'one',
      harnessId: 'opencode',
      runtimeEnv: {},
      settings: { providerKey: 'opencode-one', provider: 'one', sourceRevision: 'x', settings: {} }
    }
  })
  await expect(prepareComposerCatalog(f.ctx, f.scope, control.signal)).rejects.toThrow()
  expect(f.capture).not.toHaveBeenCalled()
  f.getSessionById
    .mockReturnValueOnce(f.saved)
    .mockReturnValueOnce(f.saved)
    .mockReturnValueOnce({ ...f.saved, cwd: 'C:/changed' })
  await expect(
    prepareComposerCatalog(f.ctx, { ...f.scope, sessionId: 'saved' }, new AbortController().signal)
  ).rejects.toThrow('session changed')
  expect(f.capture).not.toHaveBeenCalled()
})

it('wires the public handler through the production resolver and returns its shutdown cleanup', async () => {
  const f = fixture()
  const release = vi.fn(async () => undefined)
  f.capture.mockResolvedValue({
    generation: 'boot-owner',
    signal: new AbortController().signal,
    read: vi.fn(async () => []),
    release
  })
  const close = registerComposerCatalog(f.ctx)
  const sender = Object.assign(new EventEmitter(), {
    id: 10,
    isDestroyed: () => false,
    send: vi.fn()
  })
  try {
    await expect(
      handlers.get(CHANNELS.composerCatalog)!(
        { sender },
        {
          owner: randomUUID(),
          scope: f.scope,
          part: 'agents'
        }
      )
    ).resolves.toEqual({ part: 'agents', value: [], generation: 'boot-owner' })
    expect(f.capture).toHaveBeenCalledWith(expect.objectContaining({ cwd: 'C:/draft-project' }))
  } finally {
    close()
  }
  expect(release).toHaveBeenCalledOnce()
  expect(sender.listenerCount('destroyed')).toBe(0)
})
