import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi, type Mock } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { ComposerCatalogLease } from '../../../shared/composer-catalog'
import type { NativeResources } from '../../../shared/native-resources'
const callbacks = vi.hoisted(
  () => new Map<string, (event: unknown, request: unknown) => Promise<NativeResources>>()
)
vi.mock('electron', () => ({
  shell: {},
  ipcMain: { handle: (name: string, fn: never) => callbacks.set(name, fn) }
}))
import { PreparedMcpResources } from '../prepared-mcp-resources'
import { registerSessionResourceHandlers } from './session-resources'

const scopes = {
  draft: {
    backend: 'opencode' as const,
    cwd: 'C:/probe',
    projectId: null,
    providerKey: null,
    agentKind: 'code' as const
  },
  session: { sessionId: 'saved' }
}
const configured = {
  id: 'configured',
  kind: 'mcp' as const,
  name: 'Configured',
  status: 'configured' as const,
  enabled: true,
  canToggle: false
}
const cleanup: (() => void)[] = []
afterEach(() => {
  for (const close of cleanup.splice(0)) close()
})
function fixture(): {
  prepared: PreparedMcpResources
  prepare: Mock<() => Promise<ComposerCatalogLease>>
  configuredResources: Mock<() => Promise<(typeof configured)[]>>
  invoke(request: unknown): Promise<NativeResources>
  lease(generation?: string): ComposerCatalogLease
} {
  const prepare = vi.fn<() => Promise<ComposerCatalogLease>>()
  const configuredResources = vi.fn(async () => [configured])
  const prepared = new PreparedMcpResources({
    scope: () => ({ ...scopes.draft, sessionId: null }),
    prepare
  })
  cleanup.push(() => prepared.close())
  const sync = {
    observe: vi.fn(),
    release: vi.fn(),
    releasePrefix: vi.fn(),
    retry: vi.fn(),
    decorate: (_: unknown, value: unknown) => value
  }
  registerSessionResourceHandlers(
    () => undefined,
    configuredResources,
    undefined,
    undefined,
    undefined,
    configuredResources,
    undefined,
    undefined,
    undefined,
    sync as never,
    prepared
  )
  const sender = Object.assign(new EventEmitter(), {
    id: 289,
    isDestroyed: () => false,
    send: vi.fn()
  })
  const invoke = (request: unknown): Promise<NativeResources> =>
    callbacks.get(CHANNELS.sessionNativeResources)!({ sender }, request)
  const lease = (generation = 'current'): ComposerCatalogLease =>
    ({
      generation,
      signal: new AbortController().signal,
      release: vi.fn(async () => {}),
      read: vi.fn(async () => [{ ...configured, id: generation, status: 'connected' }])
    }) as unknown as ComposerCatalogLease
  return { prepared, prepare, configuredResources, invoke, lease }
}

it.each(['draft', 'session'] as const)(
  'settles %s observation cancellation before acquisition completes',
  async (kind) => {
    const f = fixture()
    const entered = Promise.withResolvers<void>()
    const pendingLease = Promise.withResolvers<ComposerCatalogLease>()
    f.prepare.mockImplementation(() => {
      entered.resolve()
      return pendingLease.promise
    })
    const request = scopes[kind]
    await f.invoke({ ...request, observation: { owner: 'probe', active: true } })
    const pending = f.invoke(request)
    await entered.promise
    await f.invoke({ ...request, observation: { owner: 'probe', active: false } })
    const value = await pending
    expect(value).toMatchObject({ state: 'disconnected', partial: true, items: [configured] })
    expect(value.generation).toBeUndefined()
    const late = f.lease('retired')
    pendingLease.resolve(late)
    await vi.waitFor(() => expect(late.release).toHaveBeenCalledTimes(1))
  }
)

it.each(['draft', 'session'] as const)(
  'retries a superseded active %s observation once and keeps real failures distinct',
  async (kind) => {
    const f = fixture()
    const entered = Promise.withResolvers<void>()
    const pendingLease = Promise.withResolvers<ComposerCatalogLease>()
    f.prepare.mockImplementationOnce(() => {
      entered.resolve()
      return pendingLease.promise
    })
    f.prepare.mockResolvedValue(f.lease('latest'))
    await f.invoke({ ...scopes[kind], observation: { owner: 'probe', active: true } })
    const pending = f.invoke(scopes[kind])
    await entered.promise
    f.prepared.invalidate()
    const value = await pending
    expect(value).toMatchObject({ state: 'connected', generation: 'latest' })
    expect(value.items.map((item) => item.id)).toContain('latest')
    expect(f.prepare).toHaveBeenCalledTimes(2)
    pendingLease.resolve(f.lease('old'))
    f.prepared.invalidate()
    f.prepare.mockRejectedValue(new Error('bad config'))
    await expect(f.invoke(scopes[kind])).rejects.toThrow()
    f.prepared.invalidate()
    f.prepare.mockResolvedValue({ ...f.lease('empty'), read: async () => [] as never })
    expect(await f.invoke(scopes[kind])).toMatchObject({ state: 'connected', generation: 'empty' })
  }
)

it('matches draft requests independently of property insertion order', async () => {
  const f = fixture()
  f.prepare.mockResolvedValue(f.lease())
  await f.invoke({ ...scopes.draft, observation: { owner: 'probe', active: true } })
  const { cwd, backend, projectId, providerKey, agentKind } = scopes.draft
  expect(await f.invoke({ agentKind, providerKey, projectId, cwd, backend })).toMatchObject({
    generation: 'current'
  })
})
