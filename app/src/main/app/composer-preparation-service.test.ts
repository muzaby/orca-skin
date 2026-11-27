import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withDataPort } from './data-host/data-port.testfixture'
import { afterEach, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../shared/ipc'
import { OpenCodeAdapter } from '../adapters/opencode/v1/adapter'
import { createComposerPreparation } from './composer-preparation'
import { ComposerPreparationService } from './composer-preparation-service'
import type { AgentContext, RouterContext } from './context'
import { registerSessionResourceHandlers } from './handlers/session-resources'
import { OpenCodeWarmup } from './harnesses/opencode/warmup'
import { invokeChannel } from '../infra/ipc/test-transport.testfixture'
import { fakeClient } from '../infra/ipc/client.testfixture'
vi.mock('../infra/config/oo-config', () => ({ appEnv: () => ({}) }))

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const close of cleanups.splice(0)) close()
})
it('shares targets across catalog resources and warmup through the production assembly', async () => {
  const projectDirectory = join(tmpdir(), 'composer-prepared-project')
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
      retireAll: () => {},
      listModels: async () => [],
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
    registry: {
      availability: () => ({ id: 'opencode', installed: true, usable: true }),
      get: () => adapter
    },
    db: { getSessionById: vi.fn() },
    getCwd: () => projectDirectory,
    harnessSettings: {
      list: () => [
        { key: 'opencode-one', harnessId: 'opencode', modelProviderId: 'one', models: [] }
      ]
    },
    harnessRuntime: { resolve },
    runtimeModelCatalog: { merge: (value: unknown) => value, isReadOnly: () => false },
    mcp: { resolver: () => () => undefined }
  } as unknown as RouterContext
  const assembly = createComposerPreparation(withDataPort(ctx) as unknown as AgentContext)
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
  registerSessionResourceHandlers({
    lookup: () => undefined,
    projectSync: sync as never,
    preparedMcp: assembly.resources
  })
  const sender = fakeClient(9)
  const scope = {
    backend: 'opencode' as const,
    sessionId: null,
    cwd: projectDirectory,
    projectId: null,
    providerKey: null,
    agentKind: 'code' as const
  }
  const { sessionId: _, ...draft } = scope
  void _
  const observation = invokeChannel(
    CHANNELS.sessionNativeResources,
    { ...draft, observation: { owner: 'a4e3dd25-929a-4352-a9d9-b73762c13454', active: true } },
    sender
  )
  const reading = Promise.all([
    invokeChannel(
      CHANNELS.composerCatalog,
      { owner: 'a4e3dd25-929a-4352-a9d9-b73762c13454', scope, part: 'agents' },
      sender
    ),
    invokeChannel(CHANNELS.sessionNativeResources, draft, sender),
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
  const mcp = await invokeChannel(
    CHANNELS.composerCatalog,
    { owner: 'a4e3dd25-929a-4352-a9d9-b73762c13454', scope, part: 'mcp' },
    sender
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
  await invokeChannel(
    CHANNELS.composerCatalogRelease,
    { owner: 'a4e3dd25-929a-4352-a9d9-b73762c13454' },
    sender
  )
  expect(await assembly.resources.read(draft)).toMatchObject({ state: 'connected' })
  expect(capture).toHaveBeenCalledTimes(1)
  const count = requests.filter((path) => path === '/mcp').length
  await invokeChannel(
    CHANNELS.sessionNativeResources,
    { ...draft, cwd: join(tmpdir(), 'composer-passive-only') },
    sender
  )
  expect(requests.filter((path) => path === '/mcp')).toHaveLength(count)
  const warmup = new OpenCodeWarmup({
    service: assembly.service,
    allowed: () => true,
    settings: () => ({ lastBackend: 'opencode', lastCwd: null }),
    cwd: () => join(tmpdir(), 'composer-warmup-only'),
    installed: async () => ({ installed: true })
  })
  cleanups.push(() => warmup.close())
  warmup.update()
  await vi.waitFor(() => expect(requests.filter((path) => path === '/mcp')).toHaveLength(count + 1))
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

it('shares one resolution per scope and resolves another scope separately', async () => {
  const resolve = vi.fn(
    async (scope: import('../../shared/composer-catalog').ComposerCatalogScope) => ({
      key: String(scope.cwd),
      acquire: async () => ({
        generation: String(scope.cwd),
        signal: new AbortController().signal,
        release: async () => {},
        read: async () => [] as never
      })
    })
  )
  const service = new ComposerPreparationService(resolve)
  cleanups.push(() => service.close())
  const scope = {
    backend: 'opencode' as const,
    sessionId: null,
    cwd: 'C:/same',
    projectId: null,
    providerKey: null,
    agentKind: 'code' as const
  }
  const signal = new AbortController().signal
  const leases = await Promise.all([
    service.acquire(scope, signal),
    service.acquire({ ...scope }, signal),
    service.acquire({ ...scope, cwd: 'C:/other' }, signal)
  ])
  expect(resolve).toHaveBeenCalledTimes(2)
  expect(leases.map((lease) => lease.generation)).toEqual(['C:/same', 'C:/same', 'C:/other'])
})

it('rejects unavailable OpenCode preparation before resolving or acquiring a native server', async () => {
  const get = vi.fn()
  const prepared = createComposerPreparation({
    registry: {
      availability: () => ({
        id: 'opencode',
        installed: false,
        usable: false,
        unavailableReason: 'missing'
      }),
      get
    }
  } as never)
  try {
    await expect(
      prepared.service.acquire(
        {
          backend: 'opencode',
          sessionId: null,
          cwd: process.cwd(),
          projectId: null,
          providerKey: null,
          agentKind: 'code'
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ failure: { stage: 'unavailable', reason: 'unavailable' } })
    expect(get).not.toHaveBeenCalled()
  } finally {
    prepared.close()
  }
})
