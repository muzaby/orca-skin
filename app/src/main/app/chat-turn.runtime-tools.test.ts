import { describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../shared/ipc'
import { PermissionModeController } from '../features/approvals/permission-mode-controller'
import { resolveAgentProfile } from '../features/agents/profiles'

const harness = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, raw: unknown) => Promise<unknown>>(),
  requests: [] as Array<{ request: { model?: string; extensions: unknown }; kind?: string }>,
  errors: [] as unknown[],
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
vi.mock('../infra/ipc/send', () => ({
  sendChatEvent: vi.fn((_owner: unknown, event: { type: string; error?: unknown }) => {
    if (event.type === 'error') harness.errors.push(event.error)
  })
}))
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
  subscribeChannelActivity: ReturnType<typeof vi.fn>
  teardownChannel: ReturnType<typeof vi.fn>
  endListenFrame: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
} {
  const value = {
    channelAlive: true,
    channelBusy: false,
    hasUnframedBacklog: false,
    spawnedProviderSettings: undefined,
    spawnedModel: model,
    spawnedRuntimeToolsRevision: revision,
    subscribeChannelActivity: vi.fn(() => vi.fn()),
    teardownChannel: vi.fn(),
    endListenFrame: vi.fn(),
    close: vi.fn()
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
  outputs?: boolean
}): {
  runtime: ReturnType<typeof runtime>
  built: unknown[]
  prepareOutputFiles: ReturnType<typeof vi.fn>
} {
  harness.handlers.clear()
  harness.requests.length = 0
  harness.errors.length = 0
  harness.steps = [...options.steps]
  harness.coordinatorRuns = 0

  const selected = { alias: 'high', model: options.selectedModel, isDefault: false }
  const fallback = { alias: 'standard', model: options.defaultModel, isDefault: true }
  const built: unknown[] = []
  const prepareOutputFiles = vi.fn(async () => ({ directory: '/tmp', capture: vi.fn() }))
  const turnRuntime = runtime(options.runtimeRevision, options.selectedModel)
  const extensions = {
    build: vi.fn(
      (
        _sessionId: string | null,
        _projectId: string | null,
        profile?: { agentInstructions?: string; agentProfileKey?: string }
      ) => {
        const revision = options.extensionRevisions.shift()
        const snapshot = {
          ...(profile?.agentProfileKey
            ? {
                agentProfileKey: profile.agentProfileKey,
                systemPromptAppend: profile.agentInstructions
              }
            : {}),
          skills: [],
          hooks: { normalized: {} },
          runtimeTools: { revision, servers: new Map() }
        }
        built.push(snapshot)
        return snapshot
      }
    )
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
    cancelAllHeld: vi.fn(() => []),
    dispose: vi.fn(),
    disposeAll: vi.fn()
  }
  const adapter = {
    id: 'claude',
    complete: async () => '',
    sendMessage: vi.fn(),
    classifyError: vi.fn((error: unknown) => error)
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
    getBySession: vi.fn(),
    getChainByKey: vi.fn(),
    acquireChain: vi.fn(({ logicalKey, owner, requestedProviderKey }) => ({
      acquired: true,
      lease: {
        kind: 'preparing',
        leaseId: 'lease-1',
        chainId: 'chain-1',
        admittedAt: 1,
        logicalKey,
        sessionId: null,
        owner,
        requestedProviderKey,
        controller: new AbortController(),
        activeChild: null,
        control: {
          taskIds: new Map(),
          subagentTypes: new Map(),
          stoppedSubagents: new Set(),
          blockedSubagents: new Set(),
          cancelled: false
        }
      }
    })),
    activateChain: vi.fn(() => true),
    releaseChain: vi.fn(),
    cancelChain: vi.fn(),
    discardRuntime: vi.fn()
  }

  registerChatHandlers({
    ctx: {
      mockAdapter: null,
      debugMock: { enabled: false },
      registry: { getActive: () => adapter },
      harnessSettings: {
        list: () => [
          {
            key: 'team-a',
            harnessId: 'claude',
            modelProviderId: 'team',
            models: [selected, fallback]
          }
        ],
        resolve: async () => undefined
      },
      db: {
        getSessionById: vi.fn(),
        ensurePathProject: vi.fn((project: { id: string }) => project)
      },
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
    permissionModes: new PermissionModeController(),
    pendingMessages,
    backgroundTasks: {
      hasAny: vi.fn(() => false),
      count: vi.fn(() => 0),
      ids: vi.fn(() => new Set<string>()),
      clear: vi.fn(),
      isAsyncLaunched: vi.fn(() => false),
      settled: vi.fn()
    },
    activity: { setTransport: vi.fn(), setResidualAttempts: vi.fn(), clear: vi.fn() },
    isUpdateInstallPending: () => false,
    ...(options.outputs ? { prepareOutputFiles } : {})
  } as never)

  return { runtime: turnRuntime, built, prepareOutputFiles }
}

async function send(modelFamily = 'high', agentKind?: 'code' | 'work'): Promise<void> {
  const handler = harness.handlers.get(CHANNELS.chatSend)
  if (!handler) throw new Error('chat send handler was not registered')
  await handler(
    { sender: { isDestroyed: () => false, once: vi.fn(), on: vi.fn(), removeListener: vi.fn() } },
    { sessionId: null, projectId: null, text: 'initial', modelFamily, agentKind }
  )
  expect(harness.errors, 'chat preparation and execution must not emit an error').toEqual([])
}

describe('registerChatHandlers runtime-tool continuation wiring (0158)', () => {
  it.each(['listen', 'flush'] as const)(
    'carries Work profile through the initial and automatic %s extension builds',
    async (step) => {
      const { runtime, built } = installHarness({
        runtimeRevision: 2,
        extensionRevisions: [2, 2],
        defaultModel: 'sonnet',
        selectedModel: 'opus',
        steps: [step, 'break']
      })
      Object.assign(runtime, { spawnedAgentProfileKey: resolveAgentProfile('work').key })
      await send('high', 'work')
      expect(built).toHaveLength(2)
      for (const extensions of built)
        expect(extensions).toMatchObject({
          agentProfileKey: resolveAgentProfile('work').key,
          systemPromptAppend: expect.stringContaining('deliverable')
        })
      expect(harness.requests).toHaveLength(2)
      expect(harness.requests.map(({ request }) => request.extensions)).toEqual(built)
      expect(harness.requests.map(({ request }) => request.model)).toEqual(['opus', 'opus'])
      expect(runtime.teardownChannel).not.toHaveBeenCalled()
    }
  )
  it.each(['work', 'code'] as const)(
    'enables output capture only for Work, preserving %s continuations',
    async (kind) => {
      const { prepareOutputFiles, runtime } = installHarness({
        runtimeRevision: 2,
        extensionRevisions: [2, 2],
        defaultModel: 'sonnet',
        selectedModel: 'opus',
        steps: ['listen', 'break'],
        outputs: true
      })
      Object.assign(runtime, { spawnedAgentProfileKey: resolveAgentProfile(kind).key })
      await send('high', kind)
      expect(prepareOutputFiles).toHaveBeenCalledTimes(kind === 'work' ? 1 : 0)
      expect(harness.requests).toHaveLength(2)
      for (const { request } of harness.requests) {
        if (kind === 'work')
          expect(request.extensions).toMatchObject({
            outputFiles: { directory: '/tmp', capture: expect.any(Function) },
            systemPromptAppend: expect.stringContaining('Final ordinary output directory: /tmp')
          })
        else expect(request.extensions).not.toHaveProperty('outputFiles')
      }
    }
  )
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
