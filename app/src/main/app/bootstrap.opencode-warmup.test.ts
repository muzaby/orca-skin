import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SessionAdapter } from '../adapters/common/types'
import type { AuthChange, AuthRuntime, AuthSecretReader } from '../contracts/auth'
import type { ComposerPreparationService } from './composer-preparation-service'
import type { RouterContext } from './context'

const fixture = vi.hoisted(() => ({
  root: '',
  passed: false,
  resuming: false,
  adapter: undefined as SessionAdapter | undefined,
  savedSession: undefined as
    { id: string; backend: 'opencode'; cwd: string; project_id: null } | undefined,
  change: () => {},
  authChanges: [] as ((change: AuthChange) => void)[],
  settings: {
    lastBackend: 'opencode',
    lastCwd: null as string | null,
    nativeExtensionChoices: {},
    harnesses: {},
    authBypass: false,
    mcpEnabled: {},
    mcpMeta: {}
  }
}))
vi.mock('electron', () => ({
  app: {
    on: vi.fn(),
    removeListener: vi.fn(),
    getVersion: () => 'test',
    getPath: () => fixture.root,
    getAppPath: () => fixture.root
  },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle: vi.fn() },
  net: {},
  session: {},
  safeStorage: {},
  shell: {},
  powerMonitor: {},
  webContents: { getAllWebContents: () => [] }
}))
vi.mock('../infra/settings-store', () => ({
  SettingsStore: class {
    getAll(): typeof fixture.settings {
      return fixture.settings
    }
    onPatch(): void {
      /* The settings-wiring case installs the real SettingsStore. */
    }
    subscribe(): () => void {
      return () => {}
    }
    patch(patch: Partial<typeof fixture.settings>): typeof fixture.settings {
      Object.assign(fixture.settings, patch)
      return fixture.settings
    }
  }
}))
vi.mock('../infra/config/secret-store', () => ({ SecretStore: class {} }))
vi.mock('../infra/config/paths', async (original) => ({
  ...(await original<typeof import('../infra/config/paths')>()),
  orcaConfigDir: () => fixture.root,
  mcpJsonPath: () => `${fixture.root}/mcp.json`
}))
vi.mock('../infra/db', () => ({ initDb: () => ({}), getDbConnection: () => null }))
vi.mock('../features/chat/recovery', () => ({
  recoverSessionHistory: () => ({ toolResultsWritten: 0 })
}))
vi.mock('./handlers/settings', () => ({
  registerSettingsReadHandler: vi.fn(),
  registerSettingsHandlers: vi.fn()
}))
vi.mock('./handlers/providers', () => ({ registerConnectionHandlers: vi.fn() }))
vi.mock('electron-store', () => ({ default: class {} }))
vi.mock('./harnesses/opencode/global-watch', () => ({
  OpenCodeGlobalWatch: class {
    close = vi.fn()
  }
}))
vi.mock('../features/usage/tracker', () => ({
  UsageTracker: class {
    recompute = vi.fn()
  }
}))
vi.mock('../features/usage/jobs', () => ({ registerUsageJobs: vi.fn() }))
vi.mock('../features/scheduler', () => ({
  DbRunRecorder: class {},
  Scheduler: class {
    register = vi.fn()
    applySettings = vi.fn()
    stopAll = vi.fn()
  }
}))
vi.mock('../features/gate', () => ({
  selectGateMembers: () => ({ members: [], blocked: [] }),
  createGate: () => ({ state: () => ({ passed: fixture.passed }), noteLoginCommit: vi.fn() })
}))
vi.mock('./daily-gate', () => ({
  startDailyGate: (input: { pushConnectionState(): void }) => {
    fixture.change = input.pushConnectionState
    return { dispose: vi.fn() }
  }
}))
vi.mock('./deployment/plugins', () => ({ createPluginBindings: () => [] }))
vi.mock('./deployment/connections', () => ({ createConnectionSources: () => [] }))
vi.mock('./auth-resume', () => ({
  createAuthResume: () => ({
    resuming: () => fixture.resuming,
    run: vi.fn(),
    onGateChange: vi.fn()
  })
}))
vi.mock('./deployment/usage-fetcher', () => ({ createUsageFetcher: () => undefined }))
vi.mock('./deployment/harness-runtime', () => ({
  AUTH_INVALIDATED_HARNESS_KEYS: {},
  DIRECT_CREDENTIAL_AUTH_IDS: [],
  RUNTIME_MODEL_CONTRIBUTIONS: [],
  createRuntimeConfigAugmenters: () => ({})
}))
vi.mock('./harnesses/registry', async (original) => {
  const { AdapterRegistry } = await import('../adapters/common/registry')
  return {
    ...(await original<typeof import('./harnesses/registry')>()),
    createAdapterRegistry: () => new AdapterRegistry(fixture.adapter ? [fixture.adapter] : [], null)
  }
})

import { OpenCodeAdapter } from '../adapters/opencode/v1/adapter'
import { BootReportRecorder } from './boot-report'
import { Bootstrap } from './bootstrap'
import { createComposerPreparation } from './composer-preparation'

const bootstraps: Bootstrap[] = []
let service: ComposerPreparationService,
  requests: string[],
  models: ReturnType<typeof Promise.withResolvers<void>>
let resolveTarget: ReturnType<typeof vi.fn>
beforeEach(async () => {
  fixture.root = await mkdtemp(join(tmpdir(), 'orca-boot-warmup-'))
  fixture.passed = true
  fixture.resuming = false
  fixture.settings.lastBackend = 'opencode'
  fixture.settings.lastCwd = null
  fixture.savedSession = undefined
  fixture.authChanges.length = 0
  requests = []
  models = Promise.withResolvers<void>()
  const fetchImpl: typeof fetch = async (input, init) => {
    const path = new URL(new Request(input, init).url).pathname
    requests.push(path)
    if (path === '/provider') await models.promise
    return new Response(
      JSON.stringify(
        path === '/agent'
          ? [{ name: 'boot-agent', mode: 'primary' }]
          : path === '/provider'
            ? { all: [], connected: [], default: {} }
            : {}
      ),
      { headers: { 'content-type': 'application/json' } }
    )
  }
  fixture.adapter = new OpenCodeAdapter(
    {
      retireAll: () => {},
      listModels: async () => [],
      acquire: async () => ({ url: 'http://boot.test', headers: {}, release: vi.fn() }),
      installed: async () => ({ installed: true }),
      close: vi.fn()
    },
    fetchImpl
  )
  resolveTarget = vi.fn(async () => ({
    key: 'opencode-default',
    harnessId: 'opencode',
    modelProviderId: 'default',
    runtimeEnv: {},
    settings: {
      providerKey: 'opencode-default',
      provider: 'default',
      sourceRevision: 'boot',
      settings: {}
    }
  }))
  // Unrelated disk deployment and UI registration stay outside this boot fixture.
  const originalStep = BootReportRecorder.prototype.step
  vi.spyOn(BootReportRecorder.prototype, 'step').mockImplementation(function (
    this: BootReportRecorder,
    id,
    policy,
    action
  ) {
    return policy.critical
      ? originalStep.call(this, id, policy, action)
      : Promise.resolve(undefined)
  } as typeof BootReportRecorder.prototype.step)
  const originalSync = BootReportRecorder.prototype.stepSync
  vi.spyOn(BootReportRecorder.prototype, 'stepSync').mockImplementation(function (
    this: BootReportRecorder,
    id,
    policy,
    action
  ) {
    return policy.critical ? originalSync.call(this, id, policy, action) : undefined
  } as typeof BootReportRecorder.prototype.stepSync)
})
afterEach(async () => {
  for (const bootstrap of bootstraps.splice(0)) bootstrap.shutdown()
  models.resolve()
  vi.restoreAllMocks()
  await rm(fixture.root, { recursive: true, force: true })
})

function boot(realRegistration = false): Bootstrap {
  const bootstrap = new Bootstrap(() => true)
  bootstraps.push(bootstrap)
  const internal = bootstrap as unknown as {
    createAuthStack(): { auth: AuthRuntime; secretReader: AuthSecretReader }
    createDeploymentService(): unknown
    createUpdateController(): unknown
    register(ctx: RouterContext): void
    composerPreparation: ComposerPreparationService
    closeComposerCatalog: ReturnType<typeof createComposerPreparation>['close']
    registerArtifacts(): void
    registerTurnEvents(): unknown
  }
  vi.spyOn(internal, 'createAuthStack').mockReturnValue({
    auth: {
      subscribe: (listener: (change: AuthChange) => void) => {
        fixture.authChanges.push(listener)
        return () => {}
      },
      currentStep: () => null,
      // 로그인 프리 연결 재확인(0291) — 이 fixture 에는 연결 선언이 없다.
      connectAll: async () => undefined
    } as unknown as AuthRuntime,
    secretReader: { read: () => null }
  })
  vi.spyOn(internal, 'createDeploymentService').mockReturnValue({
    deployNow: vi.fn(async () => {})
  })
  vi.spyOn(internal, 'createUpdateController').mockReturnValue({})
  const originalRegister = internal.register.bind(internal)
  if (realRegistration) {
    vi.spyOn(internal, 'registerArtifacts').mockImplementation(() => undefined)
    vi.spyOn(internal, 'registerTurnEvents').mockReturnValue({ forgetProviderSession: vi.fn() })
  }
  vi.spyOn(internal, 'register').mockImplementation((ctx) => {
    const input = {
      ...ctx,
      db: { ...ctx.db, getSessionById: () => fixture.savedSession },
      harnessSettings: {
        list: () => [
          { key: 'opencode-default', harnessId: 'opencode', modelProviderId: 'default', models: [] }
        ]
      },
      harnessRuntime: { resolve: resolveTarget },
      runtimeModelCatalog: { merge: (value: unknown) => value, isReadOnly: () => false }
    } as unknown as RouterContext
    if (realRegistration) {
      originalRegister(input)
      service = internal.composerPreparation
      return
    }
    const prepared = createComposerPreparation(input)
    service = internal.composerPreparation = prepared.service
    internal.closeComposerCatalog = prepared.close
  })
  return bootstrap
}

it('starts eligible boot preparation without waiting for a stalled model and shares the landing target', async () => {
  const directory = join(fixture.root, 'landing')
  await mkdir(directory)
  fixture.settings.lastCwd = directory
  const bootstrap = boot()
  await bootstrap.start()
  await vi.waitFor(() => expect(requests.sort()).toEqual(['/agent', '/mcp', '/provider']))
  expect(resolveTarget).toHaveBeenCalledOnce()
  const result = await service.owners('catalog').read(
    1,
    {
      owner: 'foreground',
      scope: {
        backend: 'opencode',
        sessionId: null,
        cwd: directory,
        projectId: null,
        providerKey: null,
        agentKind: 'code'
      },
      part: 'agents'
    },
    () => {}
  )
  expect(result).toMatchObject({ value: [{ name: 'boot-agent' }] })
  expect(requests.filter((path) => path === '/agent')).toHaveLength(1)
  expect(requests.some((path) => path.startsWith('/session'))).toBe(false)
  models.resolve()
  await service.owners('catalog').release(1, 'foreground')
})

it('wires source changes and the runtime activity guard through actual Bootstrap registration', async () => {
  const configure = vi.spyOn(fixture.adapter!, 'configureResourceActivity')
  const retire = vi.spyOn(fixture.adapter!, 'extensionsChanged')
  const reconcile = vi.spyOn(fixture.adapter!, 'reconcileConnections').mockResolvedValue()
  const bootstrap = boot(true)
  await bootstrap.start()
  expect(configure).toHaveBeenCalledOnce()
  const invalidate = vi.spyOn(service, 'invalidate')
  const internal = bootstrap as unknown as {
    managedMcp: ReturnType<(typeof import('./managed-mcp'))['createManagedMcp']>
    mcp: { add(value: unknown): void; update(value: unknown): void }
    deployExtensions(): Promise<void>
    supervisor: { runtimeEntries(): unknown[]; peekRuntime(id: string): unknown }
    activity: { current(id: string): import('../../shared/ipc').ChatActivitySnapshot }
  }
  fixture.savedSession = { id: 'peer', backend: 'opencode', cwd: fixture.root, project_id: null }
  vi.spyOn(internal.supervisor, 'runtimeEntries').mockReturnValue([{ sessionId: 'peer' }])
  vi.spyOn(internal.supervisor, 'peekRuntime').mockReturnValue({ responding: false })
  const idle = {
    type: 'chat.activity',
    sessionId: 'peer',
    revision: 1,
    foreground: 'idle',
    transport: 'ready',
    queuedCount: 2,
    deliveryPendingCount: 1,
    backgroundTaskCount: 0,
    residualCount: 0,
    pendingSessionWakeup: true
  } as import('../../shared/ipc').ChatActivitySnapshot
  vi.spyOn(internal.activity, 'current').mockReturnValue(idle)
  const guard = configure.mock.calls[0][0]
  expect(guard(fixture.root, false)).toBe(false)
  expect(guard(fixture.root, true)).toBe(true)
  idle.backgroundTaskCount = 1
  expect(guard(fixture.root, true)).toBe(false)
  expect(guard(join(fixture.root, 'different'), false)).toBe(true)
  idle.backgroundTaskCount = 0
  internal.mcp.add({
    name: 'bootstrap-tool',
    transport: 'stdio',
    command: 'fixture',
    enabled: false
  })
  internal.managedMcp.source.refresh()
  expect(retire).toHaveBeenCalledOnce()
  expect(invalidate).toHaveBeenCalledOnce()
  internal.mcp.update({ id: 'bootstrap-tool', enabled: true })
  internal.managedMcp.source.refresh()
  expect(retire).toHaveBeenCalledOnce()
  expect(invalidate).toHaveBeenCalledOnce()
  await vi.waitFor(() => expect(reconcile).toHaveBeenCalledOnce())
  const refresh = vi.spyOn(internal.managedMcp.source, 'refresh')
  const revision = internal.managedMcp.source.snapshot().revision
  await internal.deployExtensions()
  expect(refresh).toHaveBeenCalledOnce()
  expect(internal.managedMcp.source.snapshot().revision).toBe(revision)
  const authChanged = {
    kind: 'snapshot',
    authId: 'source-auth',
    cause: 'revoked',
    credentialChanged: true,
    snapshot: { status: 'missing', credentialRevision: 7 }
  } as unknown as AuthChange
  for (const listener of fixture.authChanges) listener(authChanged)
  expect(refresh).toHaveBeenCalledTimes(2)
  expect(internal.managedMcp.source.snapshot().revision).toBe(revision)
  bootstrap.shutdown()
})

it.each(['gate', 'resuming'] as const)(
  'starts only after %s allows and cancels its owner when the gate closes',
  async (condition) => {
    fixture.passed = condition !== 'gate'
    fixture.resuming = condition === 'resuming'
    fixture.settings.lastCwd = join(fixture.root, 'missing')
    const bootstrap = boot()
    await bootstrap.start()
    expect(requests).toEqual([])
    fixture.passed = true
    fixture.resuming = false
    fixture.change()
    await vi.waitFor(() => expect(requests).toHaveLength(3))
    const release = vi.spyOn(service.owners('warmup'), 'release')
    fixture.passed = false
    fixture.change()
    expect(release).toHaveBeenCalled()
    models.resolve()
    fixture.passed = true
    fixture.change()
    await vi.waitFor(() => expect(requests).toHaveLength(3))
  }
)

it('does not warm a different last backend and closes a pending warmup from Bootstrap.shutdown', async () => {
  fixture.settings.lastBackend = 'claude'
  const other = boot()
  await other.start()
  expect(requests).toEqual([])
  fixture.settings.lastBackend = 'opencode'
  const next = boot()
  await next.start()
  await vi.waitFor(() => expect(requests).toHaveLength(3))
  const release = vi.spyOn(service.owners('warmup'), 'release')
  next.shutdown()
  expect(release).toHaveBeenCalledWith(-1, expect.stringMatching(/^warmup:/))
  fixture.change()
  models.resolve()
  expect(requests.some((path) => path.startsWith('/session'))).toBe(false)
})

it('overlaps the deferred install check with DB initialization, joins before finish, and removes focus listener', async () => {
  const bootstrap = boot()
  const owned = bootstrap as unknown as {
    registry: import('../adapters/common/registry').AdapterRegistry
    bootReport: BootReportRecorder
  }
  const gate = Promise.withResolvers<void>()
  const refresh = vi.spyOn(owned.registry, 'refreshInstallState').mockReturnValue(gate.promise)
  const finish = vi.spyOn(owned.bootReport, 'finish')
  let complete = false
  const started = bootstrap.start().then(() => {
    complete = true
  })
  expect(refresh).toHaveBeenCalledOnce()
  await vi.waitFor(() =>
    expect(owned.bootReport.getReport().steps.some((step) => step.id === 'db-init')).toBe(true)
  )
  expect(refresh).toHaveBeenCalledOnce()
  await vi.waitFor(() =>
    expect(vi.mocked(owned.bootReport.step).mock.calls.some(([id]) => id === 'skill-scan')).toBe(
      true
    )
  )
  await new Promise<void>((resolve) => setImmediate(resolve))
  expect(finish).not.toHaveBeenCalled()
  expect(complete).toBe(false)
  gate.resolve()
  await started
  expect(complete).toBe(true)
  expect(
    owned.bootReport.getReport().steps.filter((step) => step.id === 'adapter-registry')
  ).toHaveLength(1)
  const { app } = await import('electron')
  const focus = vi.spyOn(owned.registry, 'focusRecheck')
  const registration = (
    vi.mocked(app.on).mock.calls as unknown as Array<[string, () => void]>
  ).findLast(([event]) => event === 'browser-window-focus')!
  const callback = registration[1]
  callback()
  expect(focus).toHaveBeenCalledOnce()
  bootstrap.shutdown()
  expect(app.removeListener).toHaveBeenCalledWith('browser-window-focus', callback)
})
it('finishes boot before the SDK prefetch settles', async () => {
  const sdk = await import('../adapters/claude/sdk')
  const pending = Promise.withResolvers<Awaited<ReturnType<typeof sdk.loadClaudeSdk>>>()
  const prefetch = vi.spyOn(sdk, 'loadClaudeSdk').mockReturnValue(pending.promise)
  const bootstrap = boot()
  await bootstrap.start()
  expect(prefetch).toHaveBeenCalledOnce()
  const report = (bootstrap as unknown as { bootReport: BootReportRecorder }).bootReport.getReport()
  expect(report.status).toBe('ok')
})

it('rethrows a failed concurrent installation check at the join and keeps the critical boot report', async () => {
  const bootstrap = boot()
  const owned = bootstrap as unknown as {
    registry: import('../adapters/common/registry').AdapterRegistry
    bootReport: BootReportRecorder
  }
  const error = new Error('fixture installation failed')
  vi.spyOn(owned.registry, 'refreshInstallState').mockRejectedValue(error)
  await expect(bootstrap.start()).rejects.toBe(error)
  expect(
    owned.bootReport.getReport().steps.find((step) => step.id === 'adapter-registry')
  ).toMatchObject({ status: 'failed', critical: true })
})

it('broadcasts a changed availability once and resumes skipped warmup and observation through the real registry subscription', async () => {
  const installed = vi
    .spyOn(fixture.adapter!, 'isInstalled')
    .mockResolvedValue({ installed: false, usable: false, reason: 'missing' })
  const sends = await import('../infra/ipc/send')
  const broadcast = vi.spyOn(sends, 'broadcastHarnessAvailability')
  const bootstrap = boot()
  const owned = bootstrap as unknown as {
    registry: import('../adapters/common/registry').AdapterRegistry
    updateOpenCodeGlobalWatch(ctx: RouterContext, initial: boolean): void
  }
  const watch = vi.spyOn(owned, 'updateOpenCodeGlobalWatch')
  await bootstrap.start()
  expect(resolveTarget).not.toHaveBeenCalled()
  const invalidate = vi.spyOn(service, 'invalidate')
  const pluginsChanged = vi.spyOn(sends, 'broadcastOpenCodePluginsChanged')
  installed.mockResolvedValue({ installed: true, usable: true, version: '1.19' })
  await owned.registry.refreshInstallState('opencode')
  expect(broadcast).toHaveBeenCalledExactlyOnceWith({
    id: 'opencode',
    installed: true,
    usable: true,
    version: '1.19'
  })
  expect(watch).toHaveBeenCalledOnce()
  expect(invalidate).toHaveBeenCalledOnce()
  expect(pluginsChanged).toHaveBeenCalledExactlyOnceWith({ revision: 1 })
  const watcher = (
    bootstrap as unknown as { openCodeGlobalWatch: { close: ReturnType<typeof vi.fn> } }
  ).openCodeGlobalWatch
  await vi.waitFor(() => expect(resolveTarget).toHaveBeenCalledOnce())
  await owned.registry.refreshInstallState('opencode')
  expect(broadcast).toHaveBeenCalledOnce()
  expect(invalidate).toHaveBeenCalledOnce()
  expect(pluginsChanged).toHaveBeenCalledOnce()
  installed.mockResolvedValue({ installed: false, usable: false, reason: 'missing' })
  await owned.registry.refreshInstallState('opencode')
  expect(invalidate).toHaveBeenCalledTimes(2)
  expect(watcher.close).toHaveBeenCalledOnce()
})

it('routes actual settings patches from the initial executable path to the OpenCode registry only when changed', async () => {
  fixture.settings.lastBackend = 'claude'
  const { SettingsStore } =
    await vi.importActual<typeof import('../infra/settings-store')>('../infra/settings-store')
  const settings = new SettingsStore('test', {
    store: { harnesses: { opencode: { executablePath: '/initial' } } }
  })
  const bootstrap = boot()
  Object.defineProperty(bootstrap, 'settings', { value: settings })
  const owned = bootstrap as unknown as {
    registry: import('../adapters/common/registry').AdapterRegistry
  }
  await bootstrap.start()
  const refresh = vi.spyOn(owned.registry, 'refreshInstallState')
  settings.patch({ harnesses: { opencode: { executablePath: '/initial' } } })
  settings.patch({ lastCwd: '/unrelated' })
  expect(refresh).not.toHaveBeenCalled()
  settings.patch({ harnesses: { opencode: { executablePath: '/next' } } })
  expect(refresh).toHaveBeenCalledExactlyOnceWith('opencode')
  await owned.registry.settled('opencode')
})
