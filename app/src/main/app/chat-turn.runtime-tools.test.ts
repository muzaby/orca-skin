import { describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../shared/ipc'

const harness = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, raw: unknown) => Promise<unknown>>(),
  requests: [] as Array<{ request: { model?: string; extensions: unknown }; kind?: string }>,
  steps: [] as Array<'listen' | 'flush' | 'break'>,
  coordinatorRuns: 0
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(
      (channel: string, handler: (event: unknown, raw: unknown) => Promise<unknown>) => {
        harness.handlers.set(channel, handler)
      }
    )
  }
}))

vi.mock('../features/chat/attachments', () => ({
  normalizeAttachments: async () => ({ attachmentTexts: [], attachmentImages: [] })
}))

vi.mock('../features/chat/recovery', () => ({ recoverSessionHistory: vi.fn() }))
vi.mock('../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))
vi.mock('../features/chat/post-turn', () => ({
  decidePostTurnStep: () => harness.steps.shift() ?? 'break',
  postTurnHoldsSession: (step: string) => step !== 'break'
}))

vi.mock('../features/chat/turn-coordinator', () => ({
  TurnCoordinator: class {
    beginApprovalPause(): () => void {
      return () => {}
    }

    async run(
      turn: { dbSessionId: string | null },
      request: { model?: string; extensions: unknown },
      options?: { kind?: string }
    ): Promise<void> {
      harness.requests.push({ request, kind: options?.kind })
      harness.coordinatorRuns += 1
      if (!turn.dbSessionId) turn.dbSessionId = 'session-1'
    }
  }
}))

import { registerChatHandlers } from './chat-turn'

function runtime(
  revision: number,
  model: string
): {
  channelAlive: boolean
  channelBusy: boolean
  hasUnframedBacklog: boolean
  spawnedProviderSettings: undefined
  spawnedModel: string
  spawnedRuntimeToolsRevision: number
  teardownChannel: ReturnType<typeof vi.fn>
  endListenFrame: ReturnType<typeof vi.fn>
} {
  const value = {
    channelAlive: true,
    channelBusy: false,
    hasUnframedBacklog: false,
    spawnedProviderSettings: undefined,
    spawnedModel: model,
    spawnedRuntimeToolsRevision: revision,
    teardownChannel: vi.fn(),
    endListenFrame: vi.fn()
  }
  value.teardownChannel.mockImplementation(() => {
    value.channelAlive = false
  })
  return value
}

function installHarness(options: {
  runtimeRevision: number
  extensionRevisions: number[]
  defaultModel: string
  selectedModel: string
  steps: Array<'listen' | 'flush' | 'break'>
}): { runtime: ReturnType<typeof runtime>; built: unknown[] } {
  harness.handlers.clear()
  harness.requests.length = 0
  harness.steps = [...options.steps]
  harness.coordinatorRuns = 0

  const selected = { alias: 'high', model: options.selectedModel, isDefault: false }
  const fallback = { alias: 'standard', model: options.defaultModel, isDefault: true }
  const built: unknown[] = []
  const turnRuntime = runtime(options.runtimeRevision, options.selectedModel)
  const extensions = {
    build: vi.fn(() => {
      const revision = options.extensionRevisions.shift()
      const snapshot = {
        mcp: {},
        skills: [],
        hooks: { normalized: {} },
        runtimeTools: { revision, servers: new Map() }
      }
      built.push(snapshot)
      return snapshot
    })
  }
  const batch = { uuid: 'batch-1', ids: ['batch-1'], text: 'queued text', createdAt: 1 }
  const pendingMessages = {
    enqueue: vi.fn((_sessionId: string, payload: { text: string }) => ({
      id: 'initial-1',
      text: payload.text,
      createdAt: 1
    })),
    reserveItem: vi.fn(() => ({
      uuid: 'initial-1',
      ids: ['initial-1'],
      text: 'initial',
      createdAt: 1
    })),
    takeForRespawn: vi.fn(() => []),
    pending: vi.fn(() => []),
    hasSubmitted: vi.fn(() => false),
    orphanUnconfirmed: vi.fn(() => []),
    reserveHeld: vi.fn(() => batch),
    rekey: vi.fn(),
    confirm: vi.fn(),
    rollback: vi.fn(() => false),
    submittedUuids: vi.fn(() => []),
    cancel: vi.fn(),
    dispose: vi.fn(),
    disposeAll: vi.fn()
  }
  const adapter = {
    id: 'claude',
    complete: async () => '',
    sendMessage: vi.fn(),
    classifyError: vi.fn()
  }
  const supervisor = {
    hasSession: vi.fn(() => false),
    hasPending: vi.fn(() => false),
    startNew: vi.fn(),
    startResume: vi.fn(),
    acquireRuntime: vi.fn(() => turnRuntime),
    release: vi.fn(),
    releaseRuntime: vi.fn(),
    activeTurns: { increment: vi.fn(), decrement: vi.fn() },
    promote: vi.fn(),
    getBySession: vi.fn()
  }

  registerChatHandlers({
    ctx: {
      mockAdapter: null,
      debugMock: { enabled: false },
      registry: { getActive: () => adapter },
      providerSettings: {
        list: () => [
          { key: 'team-a', adapter: 'claude', provider: 'team', models: [selected, fallback] }
        ],
        resolve: async () => undefined
      },
      db: { getSessionById: vi.fn() },
      settings: { getAll: () => ({}) },
      mcp: { resolver: () => () => undefined },
      extensions,
      ensureExtensionsDeployedForTurn: async () => {},
      getCwd: () => '/workspace'
    },
    supervisor,
    bus: { emit: vi.fn() },
    approvals: { isSessionAllowed: vi.fn(), register: vi.fn() },
    persistence: { flushAskAnswers: vi.fn() },
    permissionModes: { setMode: vi.fn() },
    pendingMessages,
    isUpdateInstallPending: () => false
  } as never)

  return { runtime: turnRuntime, built }
}

async function send(modelFamily = 'high'): Promise<void> {
  const handler = harness.handlers.get(CHANNELS.chatSend)
  if (!handler) throw new Error('chat send handler was not registered')
  await handler(
    { sender: { isDestroyed: () => false, once: vi.fn(), on: vi.fn(), removeListener: vi.fn() } },
    { sessionId: null, projectId: null, text: 'initial', modelFamily }
  )
}

describe('registerChatHandlers runtime-tool continuation wiring (0158)', () => {
  it('respawns a stale persistent channel before its listen request and forwards that fresh snapshot', async () => {
    const { runtime, built } = installHarness({
      runtimeRevision: 1,
      extensionRevisions: [1, 2],
      defaultModel: 'sonnet',
      selectedModel: 'opus',
      steps: ['listen', 'break']
    })

    await send()

    expect(runtime.teardownChannel).toHaveBeenCalledTimes(1)
    expect(harness.requests[1]).toMatchObject({ kind: 'listen' })
    expect(harness.requests[1]?.request.extensions).toBe(built[1])
  })

  it('keeps the non-default selected model on a flush continuation without an unnecessary respawn', async () => {
    const { runtime } = installHarness({
      runtimeRevision: 2,
      extensionRevisions: [2, 2],
      defaultModel: 'sonnet',
      selectedModel: 'opus',
      steps: ['flush', 'break']
    })

    await send()

    expect(runtime.teardownChannel).not.toHaveBeenCalled()
    expect(harness.requests[1]).toMatchObject({ kind: undefined })
    expect(harness.requests[1]?.request.model).toBe('opus')
  })
})
