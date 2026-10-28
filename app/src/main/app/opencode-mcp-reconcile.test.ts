import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Settings, ChatActivitySnapshot } from '../../shared/ipc'
import { CHANNELS } from '../../shared/ipc'
import type { SettingsStore } from '../infra/settings-store'
import type { GovernedLiveTurn } from '../contracts/ports'
import type { RouterContext } from './context'
import type { ProviderMessageBatch } from '../adapters/common/types'
const boundary = vi.hoisted(() => ({
  root: '',
  handlers: new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
}))
vi.mock('electron', () => ({
  ipcMain: { handle: (name: string, handler: never) => boundary.handlers.set(name, handler) },
  shell: {}
}))
vi.mock('../infra/config/paths', async (original) => ({
  ...(await original<typeof import('../infra/config/paths')>()),
  orcaConfigDir: () => boundary.root,
  mcpJsonPath: () => `${boundary.root}/mcp.json`
}))
vi.mock('../infra/config/secret-store', () => ({
  SecretStore: class {
    get(): undefined {
      return undefined
    }
    has(): boolean {
      return false
    }
  }
}))
vi.mock('../infra/config/orca-config', () => ({ appEnv: () => ({}), secretEnvAllowlist: () => [] }))
vi.mock('./harnesses/registry', async (original) => {
  const { openCodeMainModule } = await import('./harnesses/opencode/module')
  return {
    ...(await original<typeof import('./harnesses/registry')>()),
    harnessModule: () => openCodeMainModule
  }
})
import { McpStore } from '../features/extensions/common/mcp/store'
import { createManagedMcp } from './managed-mcp'
import { createPluginBinding } from './deployment/plugins'
import type { PluginAuth } from '../contracts/auth'
import { extensionControl } from './extension-control'
import { registerMcpHandlers } from './handlers/mcp'
import { registerExtensionCatalogHandlers } from './handlers/extension-catalog'
import { OpenCodeMcpReconcile } from './opencode-mcp-reconcile'
import { retentionTransport } from './opencode-retention.testfixture'
import { managedMcpAlias } from '../adapters/opencode/v1/managed-mcp'
import { openCodeDiscovery } from '../adapters/opencode/v1/discovery-cache'
import { createComposerPreparation } from './composer-preparation'
import { OpenCodeWarmup } from './opencode-warmup'
import { setRootLogger } from '../infra/log/registry'

let f: ReturnType<typeof retentionTransport>,
  managed: ReturnType<typeof createManagedMcp>,
  reconcile: OpenCodeMcpReconcile
let preparation: ReturnType<typeof createComposerPreparation>,
  mcp: McpStore,
  cwd: string,
  peerCwd: string
let activity: ChatActivitySnapshot, saveFails: boolean
const alias = managedMcpAlias('user', 'user')
const call = (channel: string, payload: unknown): Promise<unknown> =>
  boundary.handlers.get(channel)!({}, payload)
const toggled = (enabled: boolean): Promise<unknown> =>
  call(CHANNELS.mcpUpdate, { id: 'user', enabled })
async function nextTurn(
  iterator: AsyncIterator<ProviderMessageBatch>
): Promise<ProviderMessageBatch[]> {
  const batches: ProviderMessageBatch[] = []
  for (;;) {
    const result = await iterator.next()
    if (result.done) return batches
    batches.push(result.value)
    if (result.value.events.some((event) => ['turn.ended', 'error'].includes(event.type)))
      return batches
  }
}
beforeEach(async () => {
  boundary.root = await mkdtemp(join(tmpdir(), 'orca-retention-assembly-'))
  cwd = join(boundary.root, 'A')
  peerCwd = join(boundary.root, 'B')
  await mkdir(cwd)
  await mkdir(peerCwd)
  await mkdir(join(boundary.root, 'opencode'))
  await writeFile(
    join(boundary.root, 'opencode', 'opencode.json'),
    '{"mcp":{"native":{"type":"local","command":["native"]},"project":{"type":"local","command":["project"]}}}'
  )
  await writeFile(join(cwd, 'opencode.json'), '{"mcp":{"project":{"enabled":false}}}')
  vi.stubEnv('XDG_CONFIG_HOME', boundary.root)
  openCodeDiscovery.invalidate()
  let settings = { mcpEnabled: {}, mcpMeta: {}, nativeExtensionChoices: {} } as Settings
  saveFails = false
  const store = {
    getAll: () => settings,
    patch: (patch: Partial<Settings>) => {
      if (saveFails) throw new Error('save failed')
      return (settings = { ...settings, ...patch })
    }
  }
  mcp = new McpStore(store as unknown as SettingsStore)
  mcp.add({ name: 'user', transport: 'stdio', command: 'fixture-user', enabled: false })
  const plugin = createPluginBinding({
    auth: {
      authId: 'builtin',
      snapshot: () => ({ status: 'valid', credentialRevision: 11 })
    } as PluginAuth,
    server: {
      descriptor: {
        id: 'builtin-server',
        connectorId: 'builtin',
        executionScope: 'application',
        tools: []
      },
      implementations: []
    },
    registry: { add: () => {}, remove: () => {} }
  })
  managed = createManagedMcp(mcp, [plugin])
  const control = extensionControl({
    get: () => settings.nativeExtensionChoices,
    set: (value) => {
      store.patch({ nativeExtensionChoices: value })
    }
  })
  f = retentionTransport(
    {
      snapshot: managed.source.snapshot,
      acquire: (snapshot) => managed.mcpBridge.acquire(snapshot)
    },
    control
  )
  activity = {
    type: 'chat.activity',
    sessionId: 'peer',
    revision: 1,
    foreground: 'idle',
    transport: 'ready',
    queuedCount: 0,
    deliveryPendingCount: 0,
    backgroundTaskCount: 0,
    residualCount: 0
  }
  reconcile = new OpenCodeMcpReconcile({
    adapter: f.adapter,
    peers: () => [{ cwd, runtime: { responding: false } as GovernedLiveTurn, activity }],
    changed: async () => {}
  })
  const ctx = {
    registry: { get: () => f.adapter },
    db: { getSessionById: () => undefined },
    getCwd: () => cwd,
    harnessSettings: {
      list: () => [
        { key: 'opencode-test', harnessId: 'opencode', modelProviderId: 'test', models: [] }
      ]
    },
    harnessRuntime: {
      resolve: async () => ({
        key: 'opencode-test',
        harnessId: 'opencode',
        modelProviderId: 'test',
        runtimeEnv: {},
        settings: {
          providerKey: 'opencode-test',
          provider: 'test',
          sourceRevision: 'one',
          settings: {}
        }
      })
    },
    runtimeModelCatalog: { merge: (value: unknown) => value, isReadOnly: () => false },
    mcp
  } as unknown as RouterContext
  preparation = createComposerPreparation(ctx)
  managed.source.subscribe((_revision, kind) => {
    if (kind === 'definitions') {
      f.adapter.extensionsChanged()
      preparation.service.invalidate()
    } else reconcile.changed()
  })
  registerMcpHandlers({
    mcp,
    deployExtensions: async () => {
      managed.source.refresh()
    }
  })
  registerExtensionCatalogHandlers(
    control,
    { plan: () => ({ busy: 0, targets: [] }), close: () => {} },
    () => reconcile.changed()
  )
})
afterEach(async () => {
  reconcile?.close()
  preparation?.close()
  f?.adapter.close()
  await managed?.mcpBridge.close()
  setRootLogger(null)
  openCodeDiscovery.invalidate()
  vi.unstubAllEnvs()
  vi.useRealTimers()
  await rm(boundary.root, { recursive: true, force: true })
})

it('applies saved managed and native choices across idle peers with stable definitions and project precedence', async () => {
  const [a, b] = await Promise.all([
    f.adapter.client({}, undefined, cwd),
    f.adapter.client({}, undefined, peerCwd)
  ])
  await Promise.all([a.mcp(new AbortController().signal), b.mcp(new AbortController().signal)])
  expect(Object.values(f.configs[0].mcp as object).every((value) => value.enabled === false)).toBe(
    true
  )
  const definition = managed.source.snapshot().definitionRevision
  await toggled(true)
  await vi.waitFor(() => expect(f.status(cwd, alias)).toBe('connected'))
  await vi.waitFor(() => expect(f.status(peerCwd, alias)).toBe('connected'))
  expect(managed.source.snapshot().definitionRevision).toBe(definition)
  expect(f.children).toHaveLength(1)
  expect(
    (await a.mcp(new AbortController().signal)).find((item) => item.id === alias)
  ).toMatchObject({ origin: 'orca', status: 'connected' })
  await call(CHANNELS.extensionSetEnabled, {
    backend: 'opencode',
    id: 'native',
    kind: 'mcp',
    enabled: false
  })
  await call(CHANNELS.extensionSetEnabled, {
    backend: 'opencode',
    id: 'project',
    kind: 'mcp',
    enabled: true
  })
  await vi.waitFor(() => expect(f.status(cwd, 'native')).toBe('disabled'))
  await vi.waitFor(() => expect(f.status(peerCwd, 'project')).toBe('connected'))
  expect(f.status(cwd, 'project')).toBe('disabled')
  expect(await readFile(join(cwd, 'opencode.json'), 'utf8')).toBe(
    '{"mcp":{"project":{"enabled":false}}}'
  )
  const before = f.requests.length
  saveFails = true
  await expect(toggled(false)).rejects.toThrow('save failed')
  expect(f.requests).toHaveLength(before)
  await a.release()
  await b.release()
})

it('defers busy/background peers and admits queued input only after successful connection mutation', async () => {
  const a = await f.adapter.client({}, undefined, cwd)
  await a.mcp(new AbortController().signal)
  activity.foreground = 'streaming'
  activity.backgroundTaskCount = 1
  await toggled(true)
  expect(f.status(cwd, alias)).toBe('disabled')
  expect(await a.mcpControl!.pending()).toBe(true)
  const live = f.adapter.sendMessage({
    sessionId: 's1',
    cwd,
    text: 'first',
    extensions: { skills: [], hooks: { normalized: {} }, managedMcp: managed.source.snapshot() }
  })
  const iterator = live.eventBatches[Symbol.asyncIterator]()
  const first = nextTurn(iterator)
  await vi.waitFor(() =>
    expect(f.requests.some((request) => request.path === '/config')).toBe(true)
  )
  expect(f.requests.some((request) => request.path.endsWith('/prompt_async'))).toBe(false)
  activity.foreground = 'idle'
  activity.backgroundTaskCount = 0
  activity.queuedCount = 2
  activity.deliveryPendingCount = 1
  activity.pendingSessionWakeup = true
  const unblock = f.holdMutation()
  await vi.waitFor(() =>
    expect(f.requests.some((request) => request.path === `/mcp/${alias}/connect`)).toBe(true)
  )
  expect(f.requests.some((request) => request.path.endsWith('/prompt_async'))).toBe(false)
  unblock()
  await vi.waitFor(() =>
    expect(f.requests.some((request) => request.path.endsWith('/prompt_async'))).toBe(true)
  )
  expect(f.status(cwd, alias)).toBe('connected')
  f.finish()
  expect(
    (await first).flatMap((batch) => batch.events).some((event) => event.type === 'turn.ended')
  ).toBe(true)
  const prompts = f.requests.filter((request) => request.path.endsWith('/prompt_async')).length
  await toggled(false)
  f.failMutation(true)
  await expect(live.pushTurn!({ text: 'must not submit' })).rejects.toThrow()
  expect(f.requests.filter((request) => request.path.endsWith('/prompt_async'))).toHaveLength(
    prompts
  )
  expect(await a.mcpControl!.pending()).toBe(true)
  f.failMutation(false)
  expect(await live.pushTurn!({ text: 'closed channel' })).toMatchObject({
    kind: 'rejectedBeforeAccept'
  })
  await iterator.return?.()
  const retry = f.adapter.sendMessage({
    sessionId: 's1',
    cwd,
    text: 'explicit retry',
    extensions: { skills: [], hooks: { normalized: {} }, managedMcp: managed.source.snapshot() }
  })
  const retryIterator = retry.eventBatches[Symbol.asyncIterator]()
  const retried = nextTurn(retryIterator)
  await vi.waitFor(() =>
    expect(f.requests.filter((request) => request.path.endsWith('/prompt_async'))).toHaveLength(
      prompts + 1
    )
  )
  f.finish()
  await retried
  expect(f.status(cwd, alias)).toBe('disabled')
  retry.close()
  await retryIterator.return?.()
  await a.release()
})

it('serializes rapid off/on and keeps the newest choice after a delayed mutation', async () => {
  const a = await f.adapter.client({}, undefined, cwd)
  await a.mcp(new AbortController().signal)
  const unblock = f.holdMutation()
  await toggled(true)
  await vi.waitFor(() =>
    expect(f.requests.some((request) => request.path === `/mcp/${alias}/connect`)).toBe(true)
  )
  await toggled(false)
  await toggled(true)
  unblock()
  await vi.waitFor(() => expect(f.status(cwd, alias)).toBe('connected'))
  await vi.waitFor(async () => expect(await a.mcpControl!.pending()).toBe(false))
  expect(f.children).toHaveLength(1)
  await a.release()
})

it('traces warmup navigation two sends toggle expiry and quit through the real assembly', async () => {
  const warmup = new OpenCodeWarmup({
    service: preparation.service,
    allowed: () => true,
    settings: () => ({ lastBackend: 'opencode', lastCwd: cwd }),
    cwd: () => cwd,
    installed: () => f.adapter.isInstalled()
  })
  warmup.update()
  await vi.waitFor(() =>
    expect(
      f.requests.filter((request) => ['/agent', '/provider', '/mcp'].includes(request.path))
    ).toHaveLength(4)
  )
  const scope = {
    backend: 'opencode' as const,
    sessionId: null,
    cwd,
    projectId: null,
    providerKey: null,
    agentKind: 'code' as const
  }
  const owners = preparation.service.owners('catalog')
  const initial = await owners.read(1, { owner: 'nav', scope, part: 'models' }, () => {})
  await owners.release(1, 'nav')
  const reentry = await owners.read(1, { owner: 'return', scope, part: 'models' }, () => {})
  expect(reentry).toEqual(initial)
  expect(f.requests.filter((request) => request.path === '/provider')).toHaveLength(1)
  const live = f.adapter.sendMessage({
    sessionId: 's1',
    cwd,
    text: 'first',
    extensions: { skills: [], hooks: { normalized: {} }, managedMcp: managed.source.snapshot() }
  })
  const iterator = live.eventBatches[Symbol.asyncIterator](),
    first = nextTurn(iterator)
  await vi.waitFor(() =>
    expect(f.requests.filter((request) => request.path.endsWith('/prompt_async'))).toHaveLength(1)
  )
  f.finish()
  await first
  await toggled(true)
  await live.pushTurn!({ text: 'second' })
  f.finish()
  await nextTurn(iterator)
  expect(f.children).toHaveLength(1)
  expect(f.traces.filter((entry) => entry.event === 'managed-mcp.bridge.open')).toHaveLength(1)
  expect(f.requests.filter((request) => request.path === '/agent')).toHaveLength(1)
  live.close()
  await iterator.return?.()
  await owners.release(1, 'return')
  warmup.close()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  // Reattach then release while the fake clock owns the sole directory deadline.
  const lease = await f.adapter.client({}, undefined, cwd)
  await lease.release()
  await vi.advanceTimersByTimeAsync(89_999)
  expect(f.children[0].kill).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  await vi.waitFor(() => expect(f.children[0].kill).toHaveBeenCalledOnce())
  await vi.waitFor(() =>
    expect(f.traces.filter((entry) => entry.event === 'managed-mcp.bridge.close')).toHaveLength(1)
  )
  const order = f.traces.map((entry) => entry.event)
  for (const kind of [
    'process.start-request',
    'process.spawn',
    'instance.idle',
    'instance.dispose',
    'instance.ack',
    'instance.event',
    'process.terminate-request',
    'process.exit'
  ])
    expect(order).toContain(`opencode.retention.${kind}`)
  expect(JSON.stringify(f.traces)).not.toContain(boundary.root)
  expect(JSON.stringify(f.traces)).not.toContain('secret-mutation')
  expect(f.traces).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ event: 'composer.owner.attach' }),
      expect.objectContaining({ event: 'composer.owner.detach' }),
      { event: 'composer.observation.cancelled', data: { reason: 'owner-left' } },
      expect.objectContaining({
        event: 'opencode.retention.slot.hit',
        data: expect.objectContaining({ part: 'models' })
      }),
      expect.objectContaining({
        event: 'opencode.retention.slot.http',
        data: expect.objectContaining({ part: 'mcp' })
      })
    ])
  )
  const next = await f.adapter.client({}, undefined, cwd)
  f.adapter.close()
  await next.release()
  expect(f.children.map((child) => child.kill.mock.calls.length)).toEqual([1, 1])
})
