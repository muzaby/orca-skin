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
import type { NativeResources } from '../../shared/native-resources'
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
    hasRuntime: Mock<() => boolean>
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
  const runtime = {
    hasSession: vi.fn(() => false),
    hasRuntime: vi.fn(() => false),
    activity: () => idle
  }
  return { ctx, runtime, adapter, read, unused, replace, settings }
}

describe('native history composition', () => {
  it('reads the replacement identity and masks its recovery input before refreshing the Orca snapshot', async () => {
    const f = setup('opencode')
    f.ctx.db.nativeHistory.recovery = () => ({
      native_id: 'replacement',
      archive_json: '[]',
      local_frontier: 0,
      fresh_start: 0,
      accepted: 1,
      prompt_id: 'first',
      prompt_text: 'visible'
    })
    f.read.mockResolvedValue({
      status: 'ready',
      snapshot: {
        sessionId: 'replacement',
        cwd: '/actual/worktree',
        sourceKey: 'new',
        revision: 'new',
        messages: [
          {
            id: 'first',
            role: 'user',
            createdAt: 1,
            parts: [{ type: 'text', text: 'archive and visible' }]
          }
        ]
      }
    })
    expect(await createNativeHistoryRefresh(f.ctx, f.runtime)('s')).toEqual({ status: 'ready' })
    expect(f.read).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'replacement' }))
    const replacement = (f.replace.mock.calls as unknown[][])[0][0] as { payloadJson: string }
    expect(JSON.parse(replacement.payloadJson)).toMatchObject({
      sessionId: 's',
      messages: [{ id: 'first', parts: [{ type: 'text', text: 'visible' }] }]
    })
  })
  it.each(['claude', 'opencode'] as const)(
    'preserves the real idle %s runtime across navigation and uses the same channel',
    async (backend) => {
      const f = setup(backend)
      const resources: NativeResources = {
        state: 'connected',
        generation: `${backend}-live`,
        items: [
          {
            id: 'mcp',
            name: 'MCP',
            kind: 'mcp',
            enabled: false,
            canToggle: true,
            status: 'disabled'
          },
          {
            id: 'plugin',
            name: 'Plugin',
            kind: 'plugin',
            enabled: true,
            canToggle: true,
            status: 'connected'
          }
        ],
        commands: [
          { name: 'plugin:review', source: 'plugin', description: 'Review', argumentHint: '' }
        ]
      }
      let closed = false
      let queued = 1
      let wake: (() => void) | undefined
      const close = vi.fn(() => {
        closed = true
        wake?.()
      })
      const pushTurn = vi.fn(async () => {
        queued++
        wake?.()
        return { kind: 'accepted' as const }
      })
      const sendMessage = vi.fn((request: TurnRequest) => ({
        providerGeneration: resources.generation,
        nativeResources: async () => resources,
        pushTurn,
        eventBatches: (async function* () {
          let sequence = 0
          while (!closed) {
            while (queued > 0) {
              queued--
              yield {
                sequence: sequence++,
                events: [{ type: 'telemetry' as const, sessionId: request.sessionId! }]
              }
            }
            if (!closed)
              await new Promise<void>((resolve) => {
                wake = resolve
              })
          }
        })(),
        close
      }))
      const execution = { id: backend, sendMessage } as unknown as RuntimeSessionAdapter
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
      const refresh = createNativeHistoryRefresh(f.ctx, {
        hasSession: (id) => supervisor.hasSession(id),
        hasRuntime: (id) => !!supervisor.peekRuntime(id)?.providerGeneration,
        activity: () => idle
      })
      for (let visit = 0; visit < 3; visit++) {
        expect(await refresh('s')).toEqual({ status: 'busy' })
        expect(previous.providerGeneration).toBe(`${backend}-live`)
        expect(await previous.nativeResources()).toEqual(resources)
      }
      expect(close).not.toHaveBeenCalled()
      expect(previous.state).toBe('live')
      expect(supervisor.peekRuntime('s')).toBe(previous)
      const prepared = await resolveTurn(f.ctx, supervisor as never, f.adapter, {
        sessionId: 's',
        projectId: null,
        text: 'next input',
        agentKind: 'code'
      } as never)
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) throw new Error('resume preparation failed')
      const next = supervisor.acquireRuntime('s', () => new SessionRuntime(execution))
      expect(next).toBe(previous)
      for await (const event of next.send({
        ...request,
        text: prepared.value.effectiveText,
        cwd: prepared.value.sessionMeta!.cwd!,
        env: prepared.value.resolved.prepared.env
      }))
        expect(event.type).toBe('telemetry')
      expect(sendMessage).toHaveBeenCalledOnce()
      expect(pushTurn).toHaveBeenCalledExactlyOnceWith({ text: 'next input' })
      expect(prepared.value.resolved.prepared.env).toMatchObject({ PROVIDER_ENV: 'override' })
      expect(await next.nativeResources()).toEqual(resources)
      expect(f.read).not.toHaveBeenCalled()
      next.close()
      expect(await refresh('s')).toEqual({ status: 'ready' })
      expect(f.read).toHaveBeenCalledOnce()
    }
  )

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
      expect(f.runtime.hasRuntime).toHaveBeenCalledWith('s')
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
    expect(f.replace).not.toHaveBeenCalled()
    expect(f.read).not.toHaveBeenCalled()
  })
  it('protects a lease even if the projected activity is idle', async () => {
    const f = setup('claude')
    f.runtime.hasSession.mockReturnValue(true)
    expect(await createNativeHistoryRefresh(f.ctx, f.runtime)('s')).toEqual({ status: 'busy' })
    expect(f.replace).not.toHaveBeenCalled()
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
