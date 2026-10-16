import { describe, expect, it, vi, type Mock } from 'vitest'
import type { ResolvedHarnessSettings } from '../adapters/common/harness-config'
import type { ChatActivitySnapshot } from '../../shared/ipc'
import type { SessionAdapter } from '../adapters/common/types'
import type { NativeHistoryResult } from '../adapters/common/native-history'
import { AdapterRegistry } from '../adapters/common/registry'
import type { RouterContext } from './context'
import { createNativeHistoryRefresh, nativeHistoryBusy } from './native-history'
import { resolveTurn } from './chat-turn/resolve-turn'
import { RuntimeSupervisor } from '../features/sessions/supervisor'
import { SessionRuntime } from '../features/sessions/session-runtime'
import type { RuntimeSessionAdapter } from '../contracts/ports'
import type { TurnRequest } from '../adapters/common/turn'
vi.mock('../infra/config/orca-config', () => ({ appEnv: () => ({ APP_ENV: 'app' }) }))
vi.mock('../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))
vi.mock('../features/chat/recovery', () => ({ recoverSessionHistory: vi.fn() }))

const idle: ChatActivitySnapshot = {
  type: 'chat.activity',
  sessionId: 's',
  revision: 1,
  foreground: 'idle',
  transport: 'ready',
  queuedCount: 0,
  deliveryPendingCount: 0,
  residualCount: 0,
  backgroundTaskCount: 0
}

function setup(backend: 'claude' | 'opencode'): {
  ctx: RouterContext
  runtime: {
    hasSession: Mock<() => boolean>
    discardRuntime: Mock
    activity: () => ChatActivitySnapshot
  }
  adapter: SessionAdapter
  read: Mock<() => Promise<NativeHistoryResult>>
  unused: SessionAdapter
  replace: Mock<() => boolean>
  settings: ResolvedHarnessSettings
} {
  const read = vi.fn<() => Promise<NativeHistoryResult>>(async () => ({
    status: 'ready',
    snapshot: {
      sessionId: 's',
      cwd: '/actual/worktree',
      sourceKey: 'root',
      revision: 'r',
      messages: []
    }
  }))
  const adapter = {
    id: backend,
    agentSpawnEnv: () => ({ NATIVE_ROOT: 'custom-root' }),
    readHistory: read
  } as unknown as SessionAdapter
  const unused = {
    id: backend === 'claude' ? 'opencode' : 'claude',
    readHistory: vi.fn()
  } as unknown as SessionAdapter
  const meta = {
    id: 's',
    backend,
    agent_kind: 'code',
    cwd: '/actual/worktree',
    project_id: 'project',
    provider_key: `${backend}-custom`
  }
  const settings = {
    providerKey: meta.provider_key,
    provider: 'custom',
    sourceRevision: 'revision',
    settings: { model: 'custom-model' }
  }
  const replace = vi.fn(() => true)
  const ctx = {
    db: {
      getSessionById: () => meta,
      nativeHistory: {
        observe: () => ({ version: 0, frontier: 0 }),
        get: () => undefined,
        replace
      }
    },
    registry: new AdapterRegistry([adapter, unused], unused.id),
    harnessSettings: {
      list: () => [
        { key: meta.provider_key, harnessId: backend, modelProviderId: 'custom', models: [] }
      ]
    },
    harnessRuntime: {
      resolve: async () => ({
        key: meta.provider_key,
        harnessId: backend,
        modelProviderId: 'custom',
        settings,
        runtimeEnv: { PROVIDER_ENV: 'override' }
      })
    },
    getCwd: () => '/wrong-default',
    mcp: { resolver: () => () => undefined }
  } as unknown as RouterContext
  const runtime = { hasSession: vi.fn(() => false), discardRuntime: vi.fn(), activity: () => idle }
  return { ctx, runtime, adapter, read, unused, replace, settings }
}

describe('native history composition', () => {
  it('closes the real idle runtime and delivers the next input through a fresh same-ID resume', async () => {
    const f = setup('claude')
    const sendMessage = vi.fn((request: TurnRequest) => ({
      eventBatches: (async function* () {
        yield {
          sequence: 0,
          events: [{ type: 'telemetry' as const, sessionId: request.sessionId! }]
        }
      })(),
      close: vi.fn()
    }))
    const execution = { id: 'claude', sendMessage } as unknown as RuntimeSessionAdapter
    const supervisor = new RuntimeSupervisor()
    const previous = new SessionRuntime(execution)
    const request = {
      sessionId: 's',
      text: 'first',
      cwd: '/actual/worktree',
      extensions: { skills: [], hooks: { normalized: {} } }
    }
    for await (const event of previous.send(request)) expect(event.type).toBe('telemetry')
    supervisor.releaseRuntime('s', previous)
    expect(supervisor.peekRuntime('s')).toBe(previous)
    expect(
      await createNativeHistoryRefresh(f.ctx, {
        hasSession: (id) => supervisor.hasSession(id),
        discardRuntime: (id) => supervisor.discardRuntime(id),
        activity: () => idle
      })('s')
    ).toEqual({ status: 'ready' })
    expect(previous.state).toBe('closed')
    expect(supervisor.peekRuntime('s')).toBeUndefined()
    const prepared = await resolveTurn(f.ctx, supervisor as never, f.adapter, {
      sessionId: 's',
      projectId: null,
      text: 'next input',
      agentKind: 'code'
    } as never)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) throw new Error('resume preparation failed')
    const next = supervisor.acquireRuntime('s', () => new SessionRuntime(execution))
    expect(next).not.toBe(previous)
    for await (const event of next.send({
      ...request,
      text: prepared.value.effectiveText,
      cwd: prepared.value.sessionMeta!.cwd!,
      env: prepared.value.resolved.prepared.env
    }))
      expect(event.type).toBe('telemetry')
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionId: 's',
        cwd: '/actual/worktree',
        text: 'next input',
        env: expect.objectContaining({ PROVIDER_ENV: 'override' })
      })
    )
    expect(f.read).toHaveBeenCalledTimes(2)
    next.close()
  })

  it.each(['claude', 'opencode'] as const)(
    'uses stored %s backend, actual cwd and the execution configuration',
    async (backend) => {
      const f = setup(backend)
      expect(await createNativeHistoryRefresh(f.ctx, f.runtime)('s')).toEqual({ status: 'ready' })
      expect(f.read).toHaveBeenCalledWith({
        sessionId: 's',
        cwd: '/actual/worktree',
        providerSettings: f.settings,
        env: expect.objectContaining({
          APP_ENV: 'app',
          PROVIDER_ENV: 'override',
          NATIVE_ROOT: 'custom-root'
        })
      })
      expect(f.unused.readHistory).not.toHaveBeenCalled()
      expect(f.runtime.discardRuntime).toHaveBeenCalledWith('s')
      expect(f.replace).toHaveBeenCalledOnce()
    }
  )
  it.each([
    { foreground: 'preparing' },
    { foreground: 'streaming' },
    { transport: 'listening' },
    { queuedCount: 1 },
    { deliveryPendingCount: 1 },
    { residualCount: 1 },
    { backgroundTaskCount: 1 },
    { pendingSessionWakeup: true },
    { sessionSchedules: [{ id: 'schedule' }] }
  ])('does not close or replace an occupied session: %j', async (patch) => {
    const f = setup('claude')
    f.runtime.activity = () => ({ ...idle, ...patch }) as ChatActivitySnapshot
    expect(nativeHistoryBusy(f.runtime.activity())).toBe(true)
    expect(await createNativeHistoryRefresh(f.ctx, f.runtime)('s')).toEqual({ status: 'busy' })
    expect(f.runtime.discardRuntime).not.toHaveBeenCalled()
    expect(f.read).not.toHaveBeenCalled()
  })
  it('protects a lease even if the projected activity is idle', async () => {
    const f = setup('claude')
    f.runtime.hasSession.mockReturnValue(true)
    expect(await createNativeHistoryRefresh(f.ctx, f.runtime)('s')).toEqual({ status: 'busy' })
    expect(f.runtime.discardRuntime).not.toHaveBeenCalled()
  })
  it.each(['missing', 'unavailable', 'migration-required', 'busy'] as const)(
    'checks native %s before cold resume with the same prepared input',
    async (status) => {
      const f = setup('claude')
      f.read.mockResolvedValue({ status, message: 'native unavailable' })
      const supervisor = { hasSession: () => false, peekRuntime: () => undefined }
      const result = await resolveTurn(f.ctx, supervisor as never, f.adapter, {
        sessionId: 's',
        projectId: null,
        text: 'only this new input',
        agentKind: 'code'
      } as never)
      expect(result.ok).toBe(status === 'busy')
      expect(f.read).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 's',
          cwd: '/actual/worktree',
          providerSettings: f.settings
        })
      )
      if (result.ok) expect(result.value.effectiveText).toBe('only this new input')
    }
  )
  it('does not reread a warm runtime or a new session', async () => {
    const f = setup('claude')
    const supervisor = { hasSession: () => false, peekRuntime: () => ({}) }
    for (const sessionId of ['s', null]) {
      const result = await resolveTurn(f.ctx, supervisor as never, f.adapter, {
        sessionId,
        projectId: null,
        text: 'new input',
        agentKind: 'code'
      } as never)
      expect(result.ok).toBe(true)
    }
    expect(f.read).not.toHaveBeenCalled()
  })
})
