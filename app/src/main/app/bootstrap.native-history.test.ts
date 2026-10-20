// 0265 — 실제 Bootstrap.register가 session handler에 넘긴 콜백을 실행한다.
// 다른 IPC 등록 직전에 멈추며, runtime과 activity는 프로덕션 인스턴스를 유지한다.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RouterContext } from './context'
import type { registerSessionHandlers } from './handlers/session'
import type { createNativeHistoryRefresh } from './native-history'
import type { RuntimeSupervisor } from '../features/sessions/supervisor'
import type { SessionActivityProjector } from '../features/chat/session-activity-projector'
import type { NativeResourceSharing } from './native-resource-sharing'
import type { HistoryWriter } from '../features/history/writer'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  DraftNativeResourcesRequest,
  NativeCommand,
  NativeResource
} from '../../shared/native-resources'
import { nativePluginId } from '../adapters/claude/configured-resources'

const fixture = vi.hoisted(() => ({
  stop: new Error('fixture: session handler callbacks captured'),
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
  broadcasts: vi.fn(),
  peerBroadcasts: vi.fn(),
  refresh: vi.fn(),
  createRefresh: vi.fn(),
  disposeBackground: vi.fn()
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
  ipcMain: {},
  net: {},
  session: {},
  safeStorage: {}
}))
vi.mock('../infra/settings-store', () => ({ SettingsStore: class {} }))
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
    sharing: NativeResourceSharing
  ) => {
    fixture.sharing = sharing
    fixture.draftResources = draftResources
    fixture.draftDirectory = draftDirectory
    fixture.draftCommands = draftCommands
    fixture.commands = commands
    fixture.lookup = lookup
    fixture.configured = configured
    fixture.pluginDirectory = pluginDirectory
    fixture.mcpFile = mcpFile
  }
}))
vi.mock('./handlers/session', () => ({
  registerSessionHandlers: (
    _ctx: RouterContext,
    hooks: Parameters<typeof registerSessionHandlers>[1]
  ) => {
    fixture.hooks = hooks
    throw fixture.stop
  }
}))

import { Bootstrap } from './bootstrap'
import type { SkillInfo } from '../../shared/ipc'

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  fixture.hooks = undefined
})

function register(): {
  ctx: RouterContext
  supervisor: RuntimeSupervisor<Electron.WebContents>
  activity: SessionActivityProjector
  forget: ReturnType<typeof vi.fn>
} {
  const forget = vi.fn()
  const bootstrap = Object.create(Bootstrap.prototype) as {
    register(ctx: RouterContext): void
    registerArtifacts(ctx: RouterContext): void
    registerTurnEvents(): HistoryWriter
    supervisor: RuntimeSupervisor<Electron.WebContents>
    activity: SessionActivityProjector
  }
  bootstrap.registerArtifacts = vi.fn()
  bootstrap.registerTurnEvents = () =>
    ({ forgetProviderSession: forget }) as unknown as HistoryWriter
  const ctx = { db: {} } as RouterContext
  expect(() => bootstrap.register(ctx)).toThrow(fixture.stop)
  expect(fixture.hooks).toBeDefined()
  return { ctx, supervisor: bootstrap.supervisor, activity: bootstrap.activity, forget }
}

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

it('groups active and idle runtimes by the stored project and backend and broadcasts their real popup snapshots', () => {
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
  expect(fixture.sharing!.scope('B')).toBe(key)
  expect(fixture.sharing!.peers(key)).toEqual(runtimes.slice(0, 2))
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

it('uses the real Claude project root when unassigned sessions have different child working directories', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-sharing-root-'))
  const { ctx, activity } = register()
  try {
    await mkdir(join(directory, '.git'))
    ctx.db.getSessionById = vi.fn((id: string) => ({
      backend: 'claude',
      project_id: null,
      cwd: id === 'A' ? directory : join(directory, 'child')
    })) as never
    expect(fixture.sharing!.scope('A')).toBe(fixture.sharing!.scope('B'))
    expect(JSON.parse(fixture.sharing!.scope('A')!)[1]).toBe('directory')
  } finally {
    activity.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
