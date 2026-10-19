// 0265 — 실제 Bootstrap.register가 session handler에 넘긴 콜백을 실행한다.
// 다른 IPC 등록 직전에 멈추며, runtime과 activity는 프로덕션 인스턴스를 유지한다.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RouterContext } from './context'
import type { registerSessionHandlers } from './handlers/session'
import type { createNativeHistoryRefresh } from './native-history'
import type { RuntimeSupervisor } from '../features/sessions/supervisor'
import type { SessionActivityProjector } from '../features/chat/session-activity-projector'
import type { HistoryWriter } from '../features/history/writer'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { NativeResource } from '../../shared/native-resources'
import { nativePluginId } from '../adapters/claude/configured-resources'

const fixture = vi.hoisted(() => ({
  stop: new Error('fixture: session handler callbacks captured'),
  hooks: undefined as Parameters<typeof registerSessionHandlers>[1],
  lookup: undefined as ((sessionId: string) => unknown) | undefined,
  configured: undefined as ((sessionId: string) => Promise<NativeResource[]>) | undefined,
  pluginDirectory: undefined as
    ((sessionId: string, id: string) => Promise<string | undefined>) | undefined,
  refresh: vi.fn(),
  createRefresh: vi.fn(),
  disposeBackground: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getVersion: () => 'test', getPath: () => 'C:/fixture/user-data' },
  BrowserWindow: { getAllWindows: () => [] },
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
    pluginDirectory: (sessionId: string, id: string) => Promise<string | undefined>
  ) => {
    fixture.lookup = lookup
    fixture.configured = configured
    fixture.pluginDirectory = pluginDirectory
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
    const discard = vi.spyOn(supervisor, 'discardRuntime').mockReturnValue(true)
    const snapshot = activity.current('refresh-session')
    const current = vi.spyOn(activity, 'current').mockReturnValue(snapshot)
    expect(runtime.hasSession('refresh-session')).toBe(true)
    expect(runtime.discardRuntime('refresh-session')).toBe(true)
    expect(runtime.activity('refresh-session')).toBe(snapshot)
    expect(has).toHaveBeenCalledExactlyOnceWith('refresh-session')
    expect(discard).toHaveBeenCalledExactlyOnceWith('refresh-session')
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
    expect(await fixture.pluginDirectory?.('session-B', nativePluginId(installed))).toBe(installed)
    expect(await fixture.pluginDirectory?.('session-B', installed)).toBeUndefined()
    row.backend = 'opencode'
    expect(await fixture.pluginDirectory?.('session-B', nativePluginId(installed))).toBeUndefined()
    expect(await fixture.configured?.('session-B')).toEqual([])
    get.mockReturnValueOnce({ ...row, backend: 'claude', cwd: null } as never)
    get.mockReturnValueOnce({ ...row, backend: 'claude', cwd: null } as never)
    ctx.getCwd = vi.fn(() => cwd)
    expect((await fixture.configured?.('session-B'))?.[0].name).toBe('project-B')
    expect(ctx.getCwd).toHaveBeenCalledWith('project-B')
    get.mockReturnValueOnce({ ...row, backend: 'claude' })
    get.mockReturnValueOnce({ ...row, backend: 'opencode' })
    await expect(fixture.configured?.('session-B')).rejects.toThrow('바뀌었습니다')
    get.mockReturnValue(undefined as never)
    expect(await fixture.configured?.('missing')).toEqual([])
  } finally {
    activity.dispose()
    vi.unstubAllEnvs()
    await rm(temp, { recursive: true, force: true })
  }
})
