import { extensionControl } from './extension-control'
import { errorReportHub } from '../infra/error-report'
// 0265 — 실제 Bootstrap.register가 session handler에 넘긴 콜백을 실행한다.
// 다른 IPC 등록 직전에 멈추며, runtime과 activity는 프로덕션 인스턴스를 유지한다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouterContext } from './context'
import type { registerSessionHandlers } from './handlers/session'
import type { createNativeHistoryRefresh } from './native-history'
import type { RuntimeSupervisor } from '../features/sessions/supervisor'
import type { SessionActivityProjector } from '../features/chat/session-activity-projector'
import type { NativeResourceSharing } from './native-resource-sharing'
import type { ProjectResourceSync } from './project-resource-sync'
import type { HistoryWriter } from '../features/history/writer'
import type { PendingMessageQueue } from '../features/chat/pending-message-queue'
import type { TurnContext } from '../contracts/turn'
import type { ManagedRuntime } from '../contracts/ports'
import type { AdapterRegistry } from '../adapters/common/registry'
import type { PluginSnapshots } from '../infra/config/plugin-snapshots'
import type { Options } from '@anthropic-ai/claude-agent-sdk'
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { OpenCodeGlobalWatch } from './opencode-global-watch'
import { openCodePluginId } from '../adapters/opencode/v1/plugin-installation'
import type {
  DraftNativeResourcesRequest,
  NativeCommand,
  NativeResource
} from '../../shared/native-resources'
import { nativePluginId } from '../adapters/claude/configured-resources'

const fixture = vi.hoisted(() => ({
  rawSettings: {} as Record<string, unknown>,
  fetch: vi.fn<typeof fetch>(),
  stop: new Error('fixture: session handler callbacks captured'),
  stopAtSession: true,
  hooks: undefined as Parameters<typeof registerSessionHandlers>[1],
  lookup: undefined as ((sessionId: string) => unknown) | undefined,
  draftCommands: undefined as
    ((request: DraftNativeResourcesRequest) => Promise<NativeCommand[]>) | undefined,
  commands: undefined as ((sessionId: string) => Promise<NativeCommand[] | undefined>) | undefined,
  configured: undefined as
    ((sessionId: string) => Promise<NativeResource[] | undefined>) | undefined,
  pluginDirectory: undefined as
    ((sessionId: string, id: string) => Promise<string | undefined>) | undefined,
  draftResources: undefined as
    ((request: DraftNativeResourcesRequest) => Promise<NativeResource[] | undefined>) | undefined,
  draftDirectory: undefined as
    ((request: DraftNativeResourcesRequest, id: string) => Promise<string | undefined>) | undefined,
  mcpFile: undefined as
    | ((
        request: DraftNativeResourcesRequest | { sessionId: string },
        id: string
      ) => Promise<string | undefined>)
    | undefined,
  sharing: undefined as NativeResourceSharing | undefined,
  projectSync: undefined as ProjectResourceSync | undefined,
  broadcasts: vi.fn(),
  peerBroadcasts: vi.fn(),
  refresh: vi.fn(),
  createRefresh: vi.fn(),
  disposeBackground: vi.fn()
}))

const sdk = vi.hoisted(() => ({
  query: vi.fn((request: unknown) => {
    void request
    return {
      async *[Symbol.asyncIterator]() {
        yield* []
      },
      close: vi.fn()
    }
  })
}))
vi.mock('@anthropic-ai/claude-agent-sdk', async (original) => ({
  ...(await original<typeof import('@anthropic-ai/claude-agent-sdk')>()),
  query: sdk.query
}))

vi.mock('electron', () => ({
  app: { getVersion: () => 'test', getPath: () => 'C:/fixture/user-data' },
  BrowserWindow: { getAllWindows: () => [] },
  webContents: {
    getAllWebContents: () => [
      { isDestroyed: () => false, send: fixture.broadcasts },
      { isDestroyed: () => false, send: fixture.peerBroadcasts }
    ]
  },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  net: { fetch: fixture.fetch },
  session: {},
  safeStorage: {}
}))
vi.mock('electron-store', () => ({
  default: class {
    get store(): Record<string, unknown> {
      return fixture.rawSettings
    }
    set store(value: Record<string, unknown>) {
      fixture.rawSettings = structuredClone(value)
    }
  }
}))
vi.mock('../features/worktrees/service', () => ({ WorktreeService: class {} }))
vi.mock('../features/approvals/coordinator', () => ({
  ApprovalCoordinator: class {
    registerHandlers = vi.fn()
  }
}))
vi.mock('./chat-turn', () => ({
  registerChatHandlers: () => ({ dispose: fixture.disposeBackground })
}))
vi.mock('./native-history', () => ({
  createNativeHistoryRefresh: (...args: Parameters<typeof createNativeHistoryRefresh>) => {
    fixture.createRefresh(...args)
    return fixture.refresh
  }
}))
vi.mock('./handlers/session-resources', () => ({
  registerSessionResourceHandlers: (
    lookup: (sessionId: string) => unknown,
    configured: (sessionId: string) => Promise<NativeResource[]>,
    pluginDirectory: (sessionId: string, id: string) => Promise<string | undefined>,
    commands: (sessionId: string) => Promise<NativeCommand[] | undefined>,
    draftCommands: (request: DraftNativeResourcesRequest) => Promise<NativeCommand[]>,
    draftResources: (request: DraftNativeResourcesRequest) => Promise<NativeResource[] | undefined>,
    draftDirectory: (
      request: DraftNativeResourcesRequest,
      id: string
    ) => Promise<string | undefined>,
    mcpFile: NonNullable<typeof fixture.mcpFile>,
    sharing: NativeResourceSharing,
    projectSync: ProjectResourceSync
  ) => {
    fixture.projectSync = projectSync
    fixture.sharing = sharing
    fixture.draftResources = draftResources
    fixture.draftDirectory = draftDirectory
    fixture.draftCommands = draftCommands
    fixture.commands = commands
    fixture.lookup = lookup
    fixture.configured = configured
    fixture.pluginDirectory = pluginDirectory
    fixture.mcpFile = mcpFile
    return async () => ({ state: 'connected', generation: 'fixture-live', items: [] })
  }
}))
vi.mock('./handlers/session', () => ({
  registerSessionHandlers: (
    _ctx: RouterContext,
    hooks: Parameters<typeof registerSessionHandlers>[1]
  ) => {
    fixture.hooks = hooks
    if (fixture.stopAtSession) throw fixture.stop
  }
}))
vi.mock('./handlers/project', () => ({ registerProjectHandlers: vi.fn() }))
vi.mock('./handlers/mcp', () => ({ registerMcpHandlers: vi.fn() }))
vi.mock('./handlers/engine', () => ({ registerEngineHandlers: vi.fn() }))
vi.mock('./handlers/boot', () => ({ registerBootHandlers: vi.fn() }))
vi.mock('./handlers/update', () => ({ registerUpdateHandlers: vi.fn() }))
vi.mock('./handlers/settings', () => ({ registerSettingsHandlers: vi.fn() }))
vi.mock('./handlers/skills', () => ({ registerSkillsHandlers: vi.fn() }))
vi.mock('./handlers/files', () => ({
  registerFilesHandlers: () => {
    throw fixture.stop
  }
}))

import { Bootstrap } from './bootstrap'
import { SettingsStore } from '../infra/settings-store'
import { OpenCodeServerPool } from '../adapters/opencode/v1/server'
import { CHANNELS, type SkillInfo } from '../../shared/ipc'
import { ipcMain } from 'electron'
import { harnessModule } from './harnesses/registry'

const watches: OpenCodeGlobalWatch[] = []
beforeEach(() => {
  fixture.rawSettings = {}
  fixture.fetch.mockReset()
})
afterEach(() => {
  for (const watch of watches.splice(0)) watch.close()
  fixture.projectSync?.close()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  fixture.hooks = undefined
  fixture.stopAtSession = true
})

function register(realBootstrap?: Bootstrap): {
  ctx: RouterContext
  supervisor: RuntimeSupervisor<Electron.WebContents>
  activity: SessionActivityProjector
  forget: ReturnType<typeof vi.fn>
  registry?: AdapterRegistry
  pendingMessages: PendingMessageQueue
} {
  const forget = vi.fn()
  const bootstrap = (realBootstrap ?? Object.create(Bootstrap.prototype)) as unknown as {
    register(ctx: RouterContext): void
    registerArtifacts(ctx: RouterContext): void
    registerTurnEvents(): HistoryWriter
    supervisor: RuntimeSupervisor<Electron.WebContents>
    activity: SessionActivityProjector
    extensionChoices: ReturnType<typeof extensionControl>
    registry?: AdapterRegistry
    openCodeGlobalWatch?: OpenCodeGlobalWatch
    settings: SettingsStore
    pendingMessages: PendingMessageQueue
  }
  if (!realBootstrap) {
    bootstrap.settings = new SettingsStore('test')
    bootstrap.extensionChoices = extensionControl({
      get: () => bootstrap.settings.getAll().nativeExtensionChoices ?? {},
      set: (choices) => bootstrap.settings.setNativeExtensionChoices(choices)
    })
  }
  bootstrap.registerArtifacts = vi.fn()
  bootstrap.registerTurnEvents = () =>
    ({ forgetProviderSession: forget }) as unknown as HistoryWriter
  const ctx = { db: {}, registry: bootstrap.registry ?? { get: () => undefined } } as RouterContext
  expect(() => bootstrap.register(ctx)).toThrow(fixture.stop)
  if (bootstrap.openCodeGlobalWatch) watches.push(bootstrap.openCodeGlobalWatch)
  expect(fixture.hooks).toBeDefined()
  return {
    ctx,
    supervisor: bootstrap.supervisor,
    activity: bootstrap.activity,
    forget,
    registry: bootstrap.registry,
    pendingMessages: bootstrap.pendingMessages
  }
}

it('carries catalog changes through the real bootstrap registry into every new SDK query', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'orca-control-wiring-'))
  const root = join(temp, 'native'),
    plugin = join(temp, 'plugin')
  await mkdir(join(root, 'plugins'), { recursive: true })
  await mkdir(join(plugin, '.claude-plugin'), { recursive: true })
  await writeFile(join(plugin, '.claude-plugin/plugin.json'), '{"name":"fixture"}')
  await writeFile(join(root, 'settings.json'), '{"enabledPlugins":{"fixture@market":false}}')
  await writeFile(
    join(root, 'plugins/installed_plugins.json'),
    JSON.stringify({
      plugins: { 'fixture@market': [{ scope: 'user', installPath: plugin }] }
    })
  )
  vi.spyOn(harnessModule('claude'), 'globalResources').mockResolvedValue([
    {
      id: 'fixture',
      name: 'fixture@market',
      kind: 'plugin',
      enabled: false,
      status: 'disabled',
      canToggle: true
    }
  ])
  const bootstrap = new Bootstrap(() => true)
  const snapshots = (bootstrap as unknown as { pluginSnapshots: PluginSnapshots }).pluginSnapshots
  vi.spyOn(snapshots, 'capture').mockImplementation((roots) => ({
    roots: [...roots],
    release: () => {}
  }))
  fixture.stopAtSession = false
  const { registry, activity } = register(bootstrap)
  const adapter = registry!.get('claude')!
  const request = {
    sessionId: null,
    cwd: join(temp, 'A'),
    text: 'fixture',
    env: { CLAUDE_CONFIG_DIR: root },
    extensions: { skills: [], hooks: { normalized: {} } }
  }
  const live: ReturnType<typeof adapter.sendMessage>[] = []
  const flag = (): boolean =>
    JSON.parse(String((sdk.query.mock.calls.at(-1)![0] as { options: Options }).options.settings))
      .enabledPlugins['fixture@inline']
  try {
    live.push(adapter.sendMessage(request))
    expect(flag()).toBe(false)
    const set = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === CHANNELS.extensionSetEnabled)![1]
    await set({} as Electron.IpcMainInvokeEvent, {
      backend: 'claude',
      kind: 'plugin',
      id: 'fixture',
      enabled: true
    })
    live.push(adapter.sendMessage({ ...request, cwd: join(temp, 'B') }))
    expect(flag()).toBe(true)
    live.push(adapter.sendMessage(request))
    expect(flag()).toBe(true)
  } finally {
    for (const turn of live) turn.close()
    activity.dispose()
    registry!.close()
    await rm(temp, { recursive: true, force: true })
  }
})

it('registers the global catalog and ignores legacy persisted defaults', async () => {
  fixture.rawSettings = {
    nativeExtensionChoices: { opencode: { 'mcp:docs': false } },
    settingsVersion: 1
  }
  fixture.stopAtSession = false
  vi.spyOn(harnessModule('opencode'), 'globalResources').mockResolvedValue([
    {
      id: 'docs',
      name: 'docs',
      kind: 'mcp',
      enabled: true,
      status: 'configured',
      canToggle: true
    }
  ])
  const { activity } = register()
  const callback = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CHANNELS.extensionCatalog)?.[1]
  expect(callback).toBeDefined()
  expect(await callback!({} as Electron.IpcMainInvokeEvent, { backend: 'opencode' })).toMatchObject(
    {
      items: [{ id: 'docs', enabled: true, status: 'configured' }]
    }
  )
  activity.dispose()
})

describe('native history bootstrap callbacks', () => {
  it('preserves background snapshots while disposing the same session runtime and activity', () => {
    const { supervisor, activity, forget } = register()
    const discard = vi.spyOn(supervisor, 'discardRuntime').mockReturnValue(true)
    const clear = vi.spyOn(activity, 'clear')
    fixture.hooks?.onSessionDisposed?.('removed-session')
    expect(fixture.disposeBackground).toHaveBeenCalledExactlyOnceWith('removed-session', {
      preserveOutputSnapshots: true
    })
    expect(forget).toHaveBeenCalledExactlyOnceWith('removed-session')
    expect(discard).toHaveBeenCalledExactlyOnceWith('removed-session')
    expect(clear).toHaveBeenCalledExactlyOnceWith('removed-session')
    activity.dispose()
  })

  it('forwards context and all native refresh runtime callbacks from the actual bootstrap registration', () => {
    const { ctx, supervisor, activity } = register()
    expect(fixture.createRefresh).toHaveBeenCalledOnce()
    const [input, runtime] = fixture.createRefresh.mock.calls[0] as Parameters<
      typeof createNativeHistoryRefresh
    >
    expect(input).toBe(ctx)
    expect(fixture.hooks?.refreshHistory).toBe(fixture.refresh)
    const has = vi.spyOn(supervisor, 'hasSession').mockReturnValue(true)
    const peek = vi
      .spyOn(supervisor, 'peekRuntime')
      .mockReturnValue({ providerGeneration: 'live-B' } as never)
    const snapshot = activity.current('refresh-session')
    const current = vi.spyOn(activity, 'current').mockReturnValue(snapshot)
    expect(runtime.hasSession('refresh-session')).toBe(true)
    expect(runtime.hasRuntime('refresh-session')).toBe(true)
    expect(runtime.activity('refresh-session')).toBe(snapshot)
    expect(has).toHaveBeenCalledExactlyOnceWith('refresh-session')
    expect(peek).toHaveBeenCalledExactlyOnceWith('refresh-session')
    peek.mockReturnValue({ state: 'live', providerGeneration: undefined } as never)
    expect(runtime.hasRuntime('refresh-session')).toBe(false)
    expect(current).toHaveBeenCalledExactlyOnceWith('refresh-session')
    activity.dispose()
  })
})

it('wires native resource lookups to the current supervisor runtime', () => {
  const { supervisor, activity } = register()
  const selected = { marker: 'native-session-B' }
  const peek = vi.spyOn(supervisor, 'peekRuntime').mockReturnValue(selected as never)
  expect(fixture.lookup?.('session-B')).toBe(selected)
  expect(peek).toHaveBeenCalledExactlyOnceWith('session-B')
  activity.dispose()
})

it('reads native configuration through the registered module using stored backend and cwd', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'orca-bootstrap-native-'))
  const root = join(temp, 'claude')
  const cwd = join(temp, 'session-B')
  const { ctx, activity } = register()
  try {
    await mkdir(root, { recursive: true })
    await mkdir(cwd, { recursive: true })
    await writeFile(
      join(cwd, '.mcp.json'),
      JSON.stringify({ mcpServers: { 'project-B': { command: 'hidden' } } })
    )
    vi.stubEnv('CLAUDE_CONFIG_DIR', root)
    vi.stubEnv('XDG_CONFIG_HOME', join(temp, 'xdg'))
    vi.stubEnv('OPENCODE_CONFIG', join(temp, 'absent-opencode.json'))
    vi.stubEnv('OPENCODE_CONFIG_DIR', join(temp, 'absent-opencode-config'))
    vi.stubEnv('ProgramData', join(temp, 'program-data'))
    await mkdir(join(cwd, '.git'))
    const row = { backend: 'claude', cwd, project_id: 'project-B' }
    const get = vi.fn(() => row)
    ctx.db.getSessionById = get as never
    ctx.getCwd = vi.fn(() => join(temp, 'wrong-default'))
    expect(await fixture.configured?.('session-B')).toEqual([
      {
        id: 'project-B',
        name: 'project-B',
        kind: 'mcp',
        status: 'configured',
        enabled: true,
        canToggle: false
      }
    ])
    expect(get).toHaveBeenCalledWith('session-B')
    expect(await fixture.mcpFile?.({ sessionId: 'session-B' }, 'project-B')).toBe(
      join(cwd, '.mcp.json')
    )
    expect(await fixture.mcpFile?.({ backend: 'claude', cwd, projectId: null }, 'project-B')).toBe(
      join(cwd, '.mcp.json')
    )
    expect(ctx.getCwd).not.toHaveBeenCalled()
    await mkdir(join(root, 'plugins'), { recursive: true })
    const installed = join(temp, 'native-plugin-B')
    await writeFile(
      join(root, 'plugins', 'installed_plugins.json'),
      JSON.stringify({
        plugins: {
          'native@market': [{ scope: 'project', projectPath: cwd, installPath: installed }]
        }
      })
    )
    await mkdir(join(installed, '.claude-plugin'), { recursive: true })
    await mkdir(join(installed, 'skills', 'review'), { recursive: true })
    await writeFile(
      join(installed, '.claude-plugin/plugin.json'),
      JSON.stringify({ name: 'native-B' })
    )
    await writeFile(
      join(installed, 'skills/review/SKILL.md'),
      '---\nname: review\ndescription: Native review\n---\nPrivate body'
    )
    await mkdir(join(cwd, '.claude'), { recursive: true })
    await writeFile(
      join(cwd, '.claude/settings.json'),
      JSON.stringify({ enabledPlugins: { 'native@market': true } })
    )
    expect(await fixture.commands?.('session-B')).toEqual([
      { name: 'native-B:review', description: 'Native review', argumentHint: '', source: 'plugin' }
    ])
    expect(
      await fixture.draftCommands?.({ backend: 'claude', cwd, projectId: 'project-B' })
    ).toEqual(await fixture.commands?.('session-B'))
    ctx.getCwd = vi.fn(() => cwd)
    expect(
      await fixture.draftCommands?.({ backend: 'claude', cwd: null, projectId: 'project-B' })
    ).toEqual(await fixture.commands?.('session-B'))
    expect(ctx.getCwd).toHaveBeenCalledWith('project-B')
    expect(await fixture.draftCommands?.({ backend: 'opencode', cwd, projectId: null })).toEqual([])
    await expect(
      fixture.draftCommands?.({ backend: 'claude', cwd: 'relative/path', projectId: null })
    ).rejects.toThrow('절대 경로')
    expect(await fixture.pluginDirectory?.('session-B', nativePluginId(installed))).toBe(installed)
    expect(await fixture.pluginDirectory?.('session-B', installed)).toBeUndefined()
    const draftScope = { backend: 'claude' as const, cwd, projectId: 'project-B' }
    expect(await fixture.draftResources?.(draftScope)).toEqual(
      await fixture.configured?.('session-B')
    )
    expect(await fixture.draftDirectory?.(draftScope, nativePluginId(installed))).toBe(installed)
    expect(
      await fixture.draftDirectory?.({ ...draftScope, cwd: null }, nativePluginId(installed))
    ).toBe(installed)
    await expect(fixture.draftResources?.({ ...draftScope, cwd: 'relative' })).rejects.toThrow(
      '절대 경로'
    )
    await expect(
      fixture.draftDirectory?.({ ...draftScope, cwd: 'relative' }, nativePluginId(installed))
    ).rejects.toThrow('절대 경로')

    row.backend = 'opencode'
    await writeFile(join(cwd, 'opencode.json'), JSON.stringify({ mcp: { 'open-B': {} } }))
    expect(await fixture.mcpFile?.({ sessionId: 'session-B' }, 'open-B')).toBe(
      join(cwd, 'opencode.json')
    )
    expect(await fixture.commands?.('session-B')).toBeUndefined()
    expect(await fixture.pluginDirectory?.('session-B', nativePluginId(installed))).toBeUndefined()
    expect(await fixture.configured?.('session-B')).toBeUndefined()
    expect(
      await fixture.draftResources?.({ backend: 'opencode', cwd, projectId: null })
    ).toMatchObject([{ id: 'open-B', kind: 'mcp', status: 'configured' }])
    get.mockReturnValueOnce({ ...row, backend: 'claude', cwd: null } as never)
    get.mockReturnValueOnce({ ...row, backend: 'claude', cwd: null } as never)
    ctx.getCwd = vi.fn(() => cwd)
    expect((await fixture.configured?.('session-B'))?.[0].name).toBe('project-B')
    expect(ctx.getCwd).toHaveBeenCalledWith('project-B')
    get.mockReturnValueOnce({ ...row, backend: 'claude' })
    get.mockReturnValueOnce({ ...row, backend: 'opencode' })
    await expect(fixture.configured?.('session-B')).rejects.toThrow('바뀌었습니다')
    get.mockReturnValueOnce({ ...row, backend: 'claude' })
    get.mockReturnValueOnce({ ...row, backend: 'opencode' })
    await expect(fixture.commands?.('session-B')).rejects.toThrow('바뀌었습니다')
    get.mockReturnValue(undefined as never)
    expect(await fixture.configured?.('missing')).toEqual([])
    expect(await fixture.commands?.('missing')).toEqual([])
  } finally {
    activity.dispose()
    vi.unstubAllEnvs()
    await rm(temp, { recursive: true, force: true })
  }
})

it('refreshes the bootstrap skill cache with native catalog sources and preserves Orca enablement', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-bootstrap-skills-'))
  try {
    vi.stubEnv('OPENCODE_CONFIG_DIR', root)
    await mkdir(join(root, 'skills', 'native-refresh'), { recursive: true })
    await mkdir(join(root, 'orca', 'off'), { recursive: true })
    await writeFile(
      join(root, 'skills', 'native-refresh', 'SKILL.md'),
      '---\nname: native-refresh\n---\nbody'
    )
    await writeFile(join(root, 'orca', 'off', 'SKILL.md'), '---\nname: off\n---\nbody')
    const bootstrap = Object.create(Bootstrap.prototype) as {
      extensionChoices: ReturnType<typeof extensionControl>
      settings: { getAll: () => { skillEnabled: Record<string, boolean> } }
      skillRoots: () => {
        sourceId: string
        sourceLabel: string
        sourceKind: 'orca'
        rootDir: string
      }[]
      refreshSkills: () => Promise<SkillInfo[]>
      skillsCache: SkillInfo[]
    }
    bootstrap.settings = { getAll: () => ({ skillEnabled: { 'orca/off': false } }) }
    bootstrap.skillRoots = () => [
      { sourceId: 'orca', sourceLabel: 'Orca', sourceKind: 'orca', rootDir: join(root, 'orca') }
    ]
    const values = await bootstrap.refreshSkills()
    expect(values).toBe(bootstrap.skillsCache)
    expect(values.find((skill) => skill.name === 'native-refresh')).toMatchObject({
      sourceId: 'adapter:opencode',
      sourceLabel: 'OpenCode 스킬',
      enabled: true
    })
    expect(values.find((skill) => skill.sourceId === 'orca' && skill.name === 'off')).toMatchObject(
      { enabled: false, canToggle: true }
    )
  } finally {
    vi.unstubAllEnvs()
    await rm(root, { recursive: true, force: true })
  }
})

it('groups runtimes by actual cwd and backend across project IDs and broadcasts actual snapshots', () => {
  const { ctx, supervisor, activity } = register()
  const sessions = new Map([
    ['A', { backend: 'claude', project_id: 'shared', cwd: '/same' }],
    ['B', { backend: 'claude', project_id: 'shared', cwd: '/same/child' }],
    ['C', { backend: 'claude', project_id: 'other', cwd: '/same' }],
    ['D', { backend: 'opencode', project_id: 'shared', cwd: '/same' }]
  ])
  ctx.db.getSessionById = vi.fn((id) => sessions.get(id)) as never
  const runtimes = ['A', 'B', 'C', 'D'].map((sessionId) => ({
    sessionId,
    runtime: { marker: sessionId } as never
  }))
  vi.spyOn(supervisor, 'runtimeEntries').mockReturnValue(runtimes)
  const key = fixture.sharing!.scope('A')!
  expect(fixture.sharing!.scope('B')).not.toBe(key)
  expect(fixture.sharing!.scope('C')).toBe(key)
  expect(fixture.sharing!.peers(key)).toEqual([runtimes[0], runtimes[2]])
  expect(fixture.sharing!.scope('missing')).toBeUndefined()
  fixture.broadcasts.mockClear()
  fixture.peerBroadcasts.mockClear()
  const resources = { state: 'connected' as const, generation: 'B-live', items: [] }
  fixture.sharing!.changed('B', resources)
  expect(fixture.broadcasts).toHaveBeenCalledExactlyOnceWith(
    'orca:session:native-resources-changed',
    { sessionId: 'B', resources }
  )
  expect(fixture.peerBroadcasts).toHaveBeenCalledExactlyOnceWith(
    'orca:session:native-resources-changed',
    { sessionId: 'B', resources }
  )
  activity.dispose()
})

it('keeps different current working directories distinct even under one Git root', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-sharing-root-'))
  const { ctx, activity } = register()
  try {
    await mkdir(join(directory, '.git'))
    ctx.db.getSessionById = vi.fn((id: string) => ({
      backend: 'claude',
      project_id: null,
      cwd: id === 'A' ? directory : join(directory, 'child')
    })) as never
    expect(fixture.sharing!.scope('A')).not.toBe(fixture.sharing!.scope('B'))
    expect(JSON.parse(fixture.sharing!.scope('A')!)[1]).toBe('directory')
  } finally {
    activity.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

it('observes external project settings through real bootstrap and waits for peer activity before reconciliation', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'orca-bootstrap-sync-'))
  const { ctx, supervisor, activity } = register()
  try {
    const cwd = join(temp, 'project'),
      root = join(temp, 'native')
    await mkdir(join(cwd, '.claude'), { recursive: true })
    await mkdir(root)
    vi.stubEnv('CLAUDE_CONFIG_DIR', root)
    ctx.db.getSessionById = vi.fn((id) => ({ id, backend: 'claude', cwd, project_id: id })) as never
    ctx.getCwd = () => cwd
    let busy = true
    const runtime = {
      responding: false,
      reconcileNativeResources: vi.fn(async () => 'applied' as const)
    }
    vi.spyOn(supervisor, 'peekRuntime').mockReturnValue(runtime as never)
    vi.spyOn(supervisor, 'runtimeEntries').mockReturnValue([
      { sessionId: 'A', runtime: runtime as never },
      { sessionId: 'B', runtime: runtime as never }
    ])
    const idle = activity.current('A')
    vi.spyOn(activity, 'current').mockImplementation((id) => ({
      ...idle,
      backgroundTaskCount: busy && id === 'B' ? 1 : 0
    }))
    fixture.projectSync!.tick()
    await vi.waitFor(() =>
      expect(fixture.broadcasts).toHaveBeenCalledWith(
        'orca:session:native-resources-changed',
        expect.objectContaining({
          resources: expect.objectContaining({ configurationPending: true })
        })
      )
    )
    await writeFile(
      join(cwd, '.claude/settings.local.json'),
      JSON.stringify({ enabledPlugins: { external: false } })
    )
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(runtime.reconcileNativeResources).not.toHaveBeenCalled()
    busy = false
    await vi.waitFor(() => expect(runtime.reconcileNativeResources).toHaveBeenCalled(), {
      timeout: 2000
    })
    const call = runtime.reconcileNativeResources.mock.calls.at(-1) as unknown as [
      string,
      () => boolean
    ]
    const { readClaudeProjectSettings } = await import('../adapters/claude/project-settings')
    expect(call[0]).toBe(readClaudeProjectSettings(cwd, root).revision)
    expect(call[1]()).toBe(true)
    fixture.projectSync!.close()
    expect(call[1]()).toBe(false)
    const count = runtime.reconcileNativeResources.mock.calls.length
    await writeFile(join(cwd, '.claude/settings.local.json'), '{}')
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(runtime.reconcileNativeResources).toHaveBeenCalledTimes(count)
  } finally {
    fixture.projectSync?.close()
    activity.dispose()
    vi.unstubAllEnvs()
    await rm(temp, { recursive: true, force: true })
  }
})

it('applies nav plugin choices to draft and stored-session commands and resources', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'orca-bootstrap-choices-'))
  const root = join(temp, 'claude'),
    cwd = join(temp, 'project'),
    plugin = join(temp, 'plugin')
  await mkdir(join(root, 'plugins'), { recursive: true })
  await mkdir(join(cwd, '.claude'), { recursive: true })
  await mkdir(join(plugin, '.claude-plugin'), { recursive: true })
  await mkdir(join(plugin, 'skills/review'), { recursive: true })
  await writeFile(join(plugin, '.claude-plugin/plugin.json'), '{"name":"fixture"}')
  await writeFile(join(plugin, 'skills/review/SKILL.md'), '---\nname: review\n---\nBody')
  await writeFile(join(root, 'settings.json'), '{"enabledPlugins":{"fixture@market":true}}')
  await writeFile(
    join(root, 'plugins/installed_plugins.json'),
    JSON.stringify({ plugins: { 'fixture@market': [{ scope: 'user', installPath: plugin }] } })
  )
  vi.stubEnv('CLAUDE_CONFIG_DIR', root)
  const bootstrap = new Bootstrap(() => true)
  vi.spyOn(
    (bootstrap as unknown as { pluginSnapshots: PluginSnapshots }).pluginSnapshots,
    'capture'
  ).mockReturnValue({ roots: [], release: () => {} })
  fixture.stopAtSession = false
  const { ctx, activity, registry } = register(bootstrap)
  ctx.db.getSessionById = vi.fn(() => ({ backend: 'claude', cwd, project_id: null })) as never
  const handler = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CHANNELS.extensionSetEnabled)![1]
  const request = { backend: 'claude', cwd, projectId: null } as const
  try {
    for (const enabled of [false, true]) {
      await handler({} as Electron.IpcMainInvokeEvent, {
        backend: 'claude',
        kind: 'plugin',
        id: nativePluginId(plugin),
        enabled
      })
      for (const commands of [
        await fixture.draftCommands!(request),
        await fixture.commands!('stored')
      ])
        expect(commands!.map((item) => item.name)).toEqual(enabled ? ['fixture:review'] : [])
      for (const items of [
        await fixture.draftResources!(request),
        await fixture.configured!('stored')
      ])
        expect(items!.find((item) => item.kind === 'plugin')?.enabled).toBe(enabled)
    }
    await handler({} as Electron.IpcMainInvokeEvent, {
      backend: 'claude',
      kind: 'plugin',
      id: nativePluginId(plugin),
      enabled: false
    })
    await writeFile(
      join(cwd, '.claude/settings.json'),
      '{"enabledPlugins":{"fixture@market":true}}'
    )
    expect((await fixture.draftCommands!(request)).map((item) => item.name)).toEqual([
      'fixture:review'
    ])
    expect((await fixture.commands!('stored'))!.map((item) => item.name)).toEqual([
      'fixture:review'
    ])
    expect((await fixture.draftResources!(request))![0].enabled).toBe(true)
    expect((await fixture.configured!('stored'))![0].enabled).toBe(true)
    await rm(plugin, { recursive: true })
    expect(await fixture.draftCommands!(request)).toEqual([])
    expect(await fixture.commands!('stored')).toEqual([])
    expect(await fixture.draftResources!(request)).toEqual([])
    expect(await fixture.configured!('stored')).toEqual([])
    const catalog = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === CHANNELS.extensionCatalog)![1]
    expect(await catalog({} as Electron.IpcMainInvokeEvent, { backend: 'claude' })).toMatchObject({
      items: []
    })
    const turn = registry!.get('claude')!.sendMessage({
      sessionId: null,
      cwd,
      text: 'new after deletion',
      extensions: { skills: [], hooks: { normalized: {} } }
    })
    expect((sdk.query.mock.calls.at(-1)![0] as { options: Options }).options.plugins ?? []).toEqual(
      []
    )
    turn.close()
  } finally {
    activity.dispose()
    registry!.close()
    vi.unstubAllEnvs()
    await rm(temp, { recursive: true, force: true })
  }
})

it('broadcasts each OpenCode plugin revision after retiring servers without an owner', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'orca-bootstrap-global-'))
  const plugin = join(temp, 'plugin'),
    file = join(temp, 'opencode/opencode.jsonc')
  await mkdir(plugin)
  await mkdir(join(temp, 'opencode'))
  const spec = pathToFileURL(plugin).href
  await writeFile(file, JSON.stringify({ plugin: [spec] }))
  vi.stubEnv('XDG_CONFIG_HOME', temp)
  const bootstrap = new Bootstrap(() => true)
  fixture.stopAtSession = false
  const { activity, registry } = register(bootstrap)
  const retired = vi.spyOn(OpenCodeServerPool.prototype, 'retireAll')
  const watch = (bootstrap as unknown as { openCodeGlobalWatch: OpenCodeGlobalWatch })
    .openCodeGlobalWatch
  const read = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CHANNELS.extensionCatalog)![1]
  const set = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CHANNELS.extensionSetEnabled)![1]
  const event = {} as Electron.IpcMainInvokeEvent
  try {
    await watch.check()
    expect(await read(event, { backend: 'opencode' })).toMatchObject({
      items: [
        expect.objectContaining({ id: openCodePluginId(spec), enabled: true, canToggle: false })
      ]
    })
    const before = await readFile(file, 'utf8'),
      settings = structuredClone(fixture.rawSettings)
    await expect(
      set(event, {
        backend: 'opencode',
        kind: 'plugin',
        id: openCodePluginId(spec),
        enabled: false
      })
    ).rejects.toThrow()
    expect(await readFile(file, 'utf8')).toBe(before)
    expect(fixture.rawSettings).toEqual(settings)
    expect(retired).not.toHaveBeenCalled()
    for (const [index, entries] of [[], [spec], []].entries()) {
      await writeFile(file, JSON.stringify({ plugin: entries }))
      // Observe the production watchFile callback, including the second and third revisions.
      await vi.waitFor(() => expect(retired).toHaveBeenCalledTimes(index + 1), {
        timeout: 4000,
        interval: 100
      })
      await watch.check()
    }
    const expected = [1, 2, 3].map((revision) => [
      CHANNELS.extensionOpenCodePluginsChanged,
      { revision }
    ])
    expect(fixture.broadcasts.mock.calls).toEqual(expected)
    expect(fixture.peerBroadcasts.mock.calls).toEqual(expected)
    for (let i = 0; i < 3; i++)
      expect(retired.mock.invocationCallOrder[i]).toBeLessThan(
        fixture.broadcasts.mock.invocationCallOrder[i]
      )
    expect(await read(event, { backend: 'opencode' })).toMatchObject({ items: [] })
    const stop = vi.spyOn(watch, 'close')
    bootstrap.shutdown()
    expect(stop).toHaveBeenCalledOnce()
  } finally {
    watch.close()
    activity.dispose()
    registry!.close()
    vi.unstubAllEnvs()
    await rm(temp, { recursive: true, force: true })
  }
})

it('restores global choices through production Bootstrap into catalogs, new Claude queries and OpenCode directories', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'orca-bootstrap-restart-'))
  const claude = join(temp, 'claude'),
    plugin = join(temp, 'plugin'),
    global = join(temp, 'opencode')
  await mkdir(join(claude, 'plugins'), { recursive: true })
  await mkdir(join(plugin, '.claude-plugin'), { recursive: true })
  await mkdir(global)
  await writeFile(join(plugin, '.claude-plugin/plugin.json'), '{"name":"fixture"}')
  await writeFile(
    join(claude, 'plugins/installed_plugins.json'),
    JSON.stringify({ plugins: { 'fixture@market': [{ scope: 'user', installPath: plugin }] } })
  )
  const claudeFile = join(claude, 'settings.json'),
    openFile = join(global, 'opencode.json')
  await writeFile(claudeFile, '{"enabledPlugins":{"fixture@market":true}}')
  await writeFile(openFile, '{"mcp":{"docs":{"type":"local","command":["native"]}}}')
  vi.stubEnv('CLAUDE_CONFIG_DIR', claude)
  vi.stubEnv('XDG_CONFIG_HOME', temp)
  vi.spyOn(OpenCodeServerPool.prototype, 'acquire').mockResolvedValue({
    url: 'http://fixture.test',
    headers: {}
  })
  const requests: Request[] = []
  fixture.fetch.mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    const path = new URL(request.url).pathname
    if (path === '/mcp') return Response.json({ docs: { status: 'connected' } })
    if (path === '/mcp/docs/disconnect' || path === '/mcp/docs/connect') return Response.json(true)
    throw new Error(`Unexpected request: ${path}`)
  })
  fixture.stopAtSession = false
  const first = new Bootstrap(() => true),
    one = register(first)
  const handler = (channel: string): Parameters<typeof ipcMain.handle>[1] =>
    vi
      .mocked(ipcMain.handle)
      .mock.calls.filter(([name]) => name === channel)
      .at(-1)![1]
  const event = {} as Electron.IpcMainInvokeEvent
  let two: ReturnType<typeof register> | undefined
  try {
    const before = [await readFile(claudeFile, 'utf8'), await readFile(openFile, 'utf8')]
    await handler(CHANNELS.extensionSetEnabled)(event, {
      backend: 'claude',
      kind: 'plugin',
      id: nativePluginId(plugin),
      enabled: false
    })
    await handler(CHANNELS.extensionSetEnabled)(event, {
      backend: 'opencode',
      kind: 'mcp',
      id: 'docs',
      enabled: false
    })
    expect(fixture.rawSettings.nativeExtensionChoices).toEqual({
      claude: { 'plugin:fixture@market': false },
      opencode: { 'mcp:docs': false }
    })
    one.registry!.close()
    one.activity.dispose()
    for (const watch of watches.splice(0)) watch.close()
    const second = new Bootstrap(() => true)
    two = register(second)
    const snapshots = (second as unknown as { pluginSnapshots: PluginSnapshots }).pluginSnapshots
    vi.spyOn(snapshots, 'capture').mockImplementation((roots) => ({
      roots: [...roots],
      release: () => {}
    }))
    for (const backend of ['claude', 'opencode'])
      expect(await handler(CHANNELS.extensionCatalog)(event, { backend })).toMatchObject({
        items: [expect.objectContaining({ enabled: false })]
      })
    const turn = two.registry!.get('claude')!.sendMessage({
      sessionId: null,
      cwd: temp,
      text: 'restart',
      extensions: { skills: [], hooks: { normalized: {} } }
    })
    const settings = JSON.parse(
      String((sdk.query.mock.calls.at(-1)![0] as { options: Options }).options.settings)
    )
    expect(settings.enabledPlugins['fixture@inline']).toBe(false)
    turn.close()
    const adapter = two.registry!.get('opencode')!
    const oldDirectory = await adapter.prepareComposer!({ cwd: join(temp, 'A') })
    await oldDirectory.read('mcp', new AbortController().signal)
    expect(requests.filter((r) => new URL(r.url).pathname === '/mcp/docs/disconnect')).toHaveLength(
      1
    )
    await handler(CHANNELS.extensionSetEnabled)(event, {
      backend: 'opencode',
      kind: 'mcp',
      id: 'docs',
      enabled: true
    })
    await oldDirectory.read('mcp', new AbortController().signal, true)
    const nextDirectory = await adapter.prepareComposer!({ cwd: join(temp, 'B') })
    await nextDirectory.read('mcp', new AbortController().signal)
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1)
    expect([await readFile(claudeFile, 'utf8'), await readFile(openFile, 'utf8')]).toEqual(before)
  } finally {
    one.registry!.close()
    one.activity.dispose()
    two?.registry!.close()
    two?.activity.dispose()
    for (const watch of watches.splice(0)) watch.close()
    vi.unstubAllEnvs()
    await rm(temp, { recursive: true, force: true })
  }
})

describe('Claude plugin toggle closes running Claude processes', () => {
  const plugin = {
    id: 'superpowers',
    name: 'superpowers@market',
    kind: 'plugin',
    enabled: true,
    status: 'configured',
    canToggle: true
  } as const
  const request = { backend: 'claude', kind: 'plugin', id: 'superpowers', enabled: false } as const
  const managed = (): ManagedRuntime & { closed: number } => {
    const runtime = {
      closed: 0,
      state: 'live',
      reusable: true,
      close(): void {
        runtime.closed += 1
        runtime.state = 'closed'
      }
    }
    return runtime as unknown as ManagedRuntime & { closed: number }
  }
  const handler = (channel: string): Parameters<typeof ipcMain.handle>[1] =>
    vi
      .mocked(ipcMain.handle)
      .mock.calls.filter(([name]) => name === channel)
      .at(-1)![1]
  const event = {} as Electron.IpcMainInvokeEvent
  function setup(): ReturnType<typeof register> & {
    idle(sessionId: string): ManagedRuntime & { closed: number }
    busy(
      sessionId: string,
      backend: 'claude' | 'opencode'
    ): { runtime: ManagedRuntime & { closed: number }; turn: TurnContext<Electron.WebContents> }
  } {
    fixture.stopAtSession = false
    vi.spyOn(harnessModule('claude'), 'globalResources').mockResolvedValue([plugin])
    vi.spyOn(harnessModule('opencode'), 'globalResources').mockResolvedValue([
      {
        id: 'docs',
        name: 'docs',
        kind: 'mcp',
        enabled: true,
        status: 'configured',
        canToggle: true
      }
    ])
    const registered = register()
    const backends: Record<string, { backend: string; cwd: string }> = {
      'claude-A': { backend: 'claude', cwd: 'C:/work/A' },
      'claude-B': { backend: 'claude', cwd: 'C:/work/B' },
      'claude-live': { backend: 'claude', cwd: 'C:/work/A' },
      'open-idle': { backend: 'opencode', cwd: 'C:/work/A' },
      'open-live': { backend: 'opencode', cwd: 'C:/work/B' }
    }
    registered.ctx.db.getSessionById = vi.fn((id: string) => backends[id]) as never
    return {
      ...registered,
      idle: (sessionId) => {
        const runtime = managed()
        registered.supervisor.releaseRuntime(sessionId, runtime)
        return runtime
      },
      busy: (sessionId, backend) => {
        const owner = {} as Electron.WebContents
        const turn = {
          controller: new AbortController(),
          owner,
          live: null,
          dbSessionId: sessionId
        } as unknown as TurnContext<Electron.WebContents>
        const { lease } = registered.supervisor.acquireChain({
          backend,
          logicalKey: `session:${sessionId}`,
          sessionId,
          owner,
          requestedProviderKey: null
        })
        const runtime = managed()
        expect(registered.supervisor.activateChain(lease.leaseId, runtime, null, turn)).toBe(true)
        return { runtime, turn }
      }
    }
  }

  it('closes every idle Claude process on a Claude plugin toggle without confirmation and leaves OpenCode running', async () => {
    const { idle, activity } = setup()
    const a = idle('claude-A'),
      b = idle('claude-B'),
      open = idle('open-idle')
    try {
      const result = await handler(CHANNELS.extensionSetEnabled)(event, request)
      expect(result).toMatchObject({
        status: 'applied',
        resources: { items: [expect.objectContaining({ id: 'superpowers', enabled: false })] }
      })
      expect([a.closed, b.closed, open.closed]).toEqual([1, 1, 0])
      expect(fixture.rawSettings.nativeExtensionChoices).toEqual({
        claude: { 'plugin:superpowers@market': false }
      })
    } finally {
      activity.dispose()
    }
  })

  it('asks before closing busy Claude sessions and closes every Claude process only after confirmation', async () => {
    const { idle, busy, activity, pendingMessages } = setup()
    const residual = idle('claude-A'),
      quiet = idle('claude-B'),
      openIdle = idle('open-idle')
    const live = busy('claude-live', 'claude'),
      openLive = busy('open-live', 'opencode')
    pendingMessages.enqueue('claude-A', { text: 'queued A' }, 1, 'm-A')
    const batch = pendingMessages.reserveHeld('claude-A', 'attempt-A')!
    expect(pendingMessages.commit('claude-A', batch.attemptId!, batch.chainId)).toBe(true)
    activity.setResidualAttempts('claude-A', ['attempt-A'])
    const submitted = vi.spyOn(pendingMessages, 'discardSubmitted')
    try {
      expect(await handler(CHANNELS.extensionSetEnabled)(event, request)).toEqual({
        status: 'confirm',
        reason: 'claude-processes',
        sessions: 2
      })
      expect(
        [residual, quiet, live.runtime, openIdle, openLive.runtime].map((r) => r.closed)
      ).toEqual([0, 0, 0, 0, 0])
      expect(live.turn.controller.signal.aborted).toBe(false)
      expect(fixture.rawSettings.nativeExtensionChoices).toBeUndefined()

      fixture.broadcasts.mockClear()
      expect(
        await handler(CHANNELS.extensionSetEnabled)(event, { ...request, confirmed: true })
      ).toMatchObject({ status: 'applied' })
      expect(live.turn.controller.signal.aborted).toBe(true)
      expect(openLive.turn.controller.signal.aborted).toBe(false)
      expect(
        [residual, quiet, live.runtime, openIdle, openLive.runtime].map((r) => r.closed)
      ).toEqual([1, 1, 1, 0, 0])
      expect(submitted).toHaveBeenCalledWith('claude-A', ['attempt-A'])
      expect(activity.current('claude-A').residualCount).toBe(0)
      expect(
        fixture.broadcasts.mock.calls.filter(
          ([channel, payload]) =>
            channel === CHANNELS.chatEvent && payload.type === 'message.cancelled'
        )
      ).toEqual([
        [CHANNELS.chatEvent, { type: 'message.cancelled', sessionId: 'claude-A', ids: ['m-A'] }]
      ])
      expect(fixture.rawSettings.nativeExtensionChoices).toEqual({
        claude: { 'plugin:superpowers@market': false }
      })
    } finally {
      activity.dispose()
    }
  })

  it('keeps every Claude process when the Claude plugin choice cannot be saved', async () => {
    const { idle, busy, activity } = setup()
    const quiet = idle('claude-A'),
      live = busy('claude-live', 'claude')
    vi.spyOn(SettingsStore.prototype, 'setNativeExtensionChoices').mockImplementation(() => {
      throw new Error('disk locked')
    })
    try {
      await expect(
        handler(CHANNELS.extensionSetEnabled)(event, { ...request, confirmed: true })
      ).rejects.toThrow('disk locked')
      expect([quiet.closed, live.runtime.closed]).toEqual([0, 0])
      expect(live.turn.controller.signal.aborted).toBe(false)
    } finally {
      activity.dispose()
    }
  })

  it('keeps closing Claude processes after one close fails and reports it once with the dedicated title', async () => {
    const { idle, activity } = setup()
    const a = idle('claude-A'),
      b = idle('claude-B')
    const failure = new Error('Claude process close failed')
    const close = vi.spyOn(a, 'close').mockImplementation(() => {
      throw failure
    })
    const publish = vi.spyOn(errorReportHub, 'publish').mockImplementation(() => {})
    try {
      await expect(handler(CHANNELS.extensionSetEnabled)(event, request)).resolves.toMatchObject({
        status: 'applied',
        resources: { items: [expect.objectContaining({ id: 'superpowers', enabled: false })] }
      })
      expect(close).toHaveBeenCalledTimes(1)
      expect(b.closed).toBe(1)
      expect(publish).toHaveBeenCalledTimes(1)
      expect(publish.mock.calls[0][0]).toMatchObject({
        title: 'claudeSessionsCloseFailed',
        detail: failure.message
      })
      expect(fixture.rawSettings.nativeExtensionChoices).toEqual({
        claude: { 'plugin:superpowers@market': false }
      })
    } finally {
      activity.dispose()
    }
  })

  it('applies OpenCode MCP toggles without confirmation or closing any runtime', async () => {
    const { idle, busy, activity } = setup()
    const quiet = idle('claude-A'),
      openLive = busy('open-live', 'opencode')
    try {
      expect(
        await handler(CHANNELS.extensionSetEnabled)(event, {
          backend: 'opencode',
          kind: 'mcp',
          id: 'docs',
          enabled: false
        })
      ).toMatchObject({ status: 'applied' })
      expect([quiet.closed, openLive.runtime.closed]).toEqual([0, 0])
      expect(openLive.turn.controller.signal.aborted).toBe(false)
      expect(fixture.rawSettings.nativeExtensionChoices).toEqual({
        opencode: { 'mcp:docs': false }
      })
    } finally {
      activity.dispose()
    }
  })
})
