import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../shared/ipc'
import type { RouterContext } from './context'
import { OpenCodeAdapter } from '../adapters/opencode/v1/adapter'
const handlers = vi.hoisted(
  () => new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
)
vi.mock('electron', () => ({
  ipcMain: { handle: (key: string, fn: never) => handlers.set(key, fn) },
  shell: {}
}))
vi.mock('../infra/config/orca-config', () => ({ appEnv: () => ({}) }))
import { createComposerPreparation } from './composer-preparation'
import { registerSessionResourceHandlers } from './handlers/session-resources'
import { ComposerPreparationService } from './composer-preparation-service'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const close of cleanups.splice(0)) close()
})
it('shares targets across catalog resources and warmup through the production assembly', async () => {
  const requests: string[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const path = new URL(new Request(input, init).url).pathname
    requests.push(path)
    return new Response(
      JSON.stringify(
        path === '/agent'
          ? [{ name: 'distinct-agent', mode: 'primary' }]
          : path === '/provider'
            ? { all: [], connected: [], default: {} }
            : path === '/mcp'
              ? { distinct: { status: 'connected' } }
              : {}
      ),
      { headers: { 'content-type': 'application/json' } }
    )
  }
  const adapter = new OpenCodeAdapter(
    {
      acquire: vi.fn(async () => ({ url: 'http://owned.test', headers: {}, release: vi.fn() })),
      close: vi.fn(),
      installed: vi.fn()
    },
    fetchImpl
  )
  const capture = vi.spyOn(adapter, 'prepareComposer')
  const resolving = Promise.withResolvers<void>()
  const resolve = vi.fn(async () => {
    await resolving.promise
    return {
      key: 'opencode-one',
      harnessId: 'opencode',
      modelProviderId: 'one',
      runtimeEnv: {},
      settings: {
        providerKey: 'opencode-one',
        provider: 'one',
        sourceRevision: 'one',
        settings: {}
      }
    }
  })
  const ctx = {
    registry: { get: () => adapter },
    db: { getSessionById: vi.fn() },
    getCwd: () => 'C:/same',
    harnessSettings: {
      list: () => [
        { key: 'opencode-one', harnessId: 'opencode', modelProviderId: 'one', models: [] }
      ]
    },
    harnessRuntime: { resolve },
    runtimeModelCatalog: { merge: (value: unknown) => value, isReadOnly: () => false },
    mcp: { resolver: () => () => undefined }
  } as unknown as RouterContext
  const assembly = createComposerPreparation(ctx)
  cleanups.push(() => {
    assembly.close()
    adapter.close()
  })
  const sync = {
    observe: vi.fn(),
    release: vi.fn(),
    releasePrefix: vi.fn(),
    retry: vi.fn(),
    decorate: (_: unknown, value: unknown) => value
  }
  registerSessionResourceHandlers(
    () => undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    sync as never,
    assembly.resources
  )
  const sender = Object.assign(new EventEmitter(), {
    id: 9,
    isDestroyed: () => false,
    send: vi.fn()
  })
  const scope = {
    backend: 'opencode' as const,
    sessionId: null,
    cwd: 'C:/same',
    projectId: null,
    providerKey: null,
    agentKind: 'code' as const
  }
  const { sessionId: _, ...draft } = scope
  void _
  const observation = handlers.get(CHANNELS.sessionNativeResources)!(
    { sender },
    { ...draft, observation: { owner: 'a4e3dd25-929a-4352-a9d9-b73762c13454', active: true } }
  )
  const reading = Promise.all([
    handlers.get(CHANNELS.composerCatalog)!(
      { sender },
      { owner: 'a4e3dd25-929a-4352-a9d9-b73762c13454', scope, part: 'agents' }
    ),
    handlers.get(CHANNELS.sessionNativeResources)!({ sender }, draft),
    assembly.service
      .owners('warmup')
      .read(
        -1,
        { owner: 'a4e3dd25-929a-4352-a9d9-b73762c13454', scope, part: 'models' },
        () => undefined
      )
  ])
  for (let n = 0; n < 30; n++) await Promise.resolve()
  resolving.resolve()
  const [catalog, resources, warm] = await reading
  await observation
  expect(capture).toHaveBeenCalledTimes(1)
  expect(resolve).toHaveBeenCalledTimes(1)
  expect(catalog).toMatchObject({ part: 'agents', value: [{ name: 'distinct-agent' }] })
  expect(resources).toMatchObject({ state: 'connected', items: [] })
  expect(warm).toMatchObject({ part: 'models', value: [] })
  expect(requests.sort()).toEqual(['/agent', '/provider'])
  const mcp = await handlers.get(CHANNELS.composerCatalog)!(
    { sender },
    { owner: 'a4e3dd25-929a-4352-a9d9-b73762c13454', scope, part: 'mcp' }
  )
  expect(mcp).toMatchObject({ part: 'mcp', value: [{ id: 'distinct' }] })
  expect(requests.filter((path) => path === '/mcp')).toHaveLength(1)
  await assembly.service
    .owners('warmup')
    .read(
      -1,
      { owner: 'a4e3dd25-929a-4352-a9d9-b73762c13454', scope, part: 'mcp' },
      () => undefined
    )
  expect(requests.filter((path) => path === '/mcp')).toHaveLength(1)
  await handlers.get(CHANNELS.composerCatalogRelease)!(
    { sender },
    { owner: 'a4e3dd25-929a-4352-a9d9-b73762c13454' }
  )
  expect(await assembly.resources.read(draft)).toMatchObject({ state: 'connected' })
  expect(capture).toHaveBeenCalledTimes(1)
})

it('cancels only the leaving waiter and releases a late shared acquisition once', async () => {
  const pending =
    Promise.withResolvers<import('../../shared/composer-catalog').ComposerCatalogLease>()
  const acquire = vi.fn(() => pending.promise)
  const service = new ComposerPreparationService(async () => ({ key: 'validated-target', acquire }))
  cleanups.push(() => service.close())
  const owners = service.owners('catalog')
  const scope = {
    backend: 'opencode' as const,
    sessionId: null,
    cwd: 'C:/same',
    projectId: null,
    providerKey: null,
    agentKind: 'code' as const
  }
  const leaving = owners.read(1, { owner: 'same', scope, part: 'models' }, () => undefined)
  const left = expect(leaving).rejects.toThrow('cancelled')
  const peer = owners.read(
    2,
    { owner: 'same', scope: { ...scope }, part: 'models' },
    () => undefined
  )
  await vi.waitFor(() => expect(acquire).toHaveBeenCalledOnce())
  await owners.release(1, 'same')
  await left
  const release = vi.fn(async () => {})
  pending.resolve({
    generation: 'shared',
    signal: new AbortController().signal,
    release,
    read: async () => [] as never
  })
  expect(await peer).toMatchObject({ generation: 'shared' })
  expect(release).not.toHaveBeenCalled()
  await owners.release(2, 'same')
  await vi.waitFor(() => expect(release).toHaveBeenCalledOnce())
})
