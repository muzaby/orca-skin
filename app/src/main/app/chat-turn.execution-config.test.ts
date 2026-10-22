import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHANNELS } from '../../shared/ipc'
import type { SteerFlushBatch, TurnRequest } from '../adapters/common/turn'
import { OpenCodeAdapter } from '../adapters/opencode/v1/adapter'
import { PermissionModeController } from '../features/approvals/permission-mode-controller'
import { createHarnessRuntimeConfigService } from '../features/harnesses/common/runtime-config'
import { createRuntimeModelCatalog } from '../features/harnesses/common/runtime-catalog'
import { RUNTIME_MODEL_CONTRIBUTIONS } from './deployment/harness-runtime'
import { createHarnessSettingsService, parseHarnessRuntimeModels } from './harnesses/registry'

const harness = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, raw: unknown) => Promise<unknown>>(),
  runs: [] as Array<{ providerKey: string | null; request: TurnRequest; kind?: string }>,
  errors: [] as unknown[],
  steps: [] as Array<'listen' | 'flush' | 'break'>,
  afterRun: undefined as ((request: TurnRequest) => void) | undefined
}))

vi.mock('electron', () => ({
  BrowserWindow: {},
  Notification: {},
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
vi.mock('../infra/config/temp-path', () => ({
  prepareTemporaryFilesPath: async () => '/tmp/orcinus-orca'
}))
vi.mock('../infra/ipc/send', () => ({
  broadcastBackgroundEvent: vi.fn(),
  sendChatEvent: vi.fn((_owner: unknown, event: { type: string; error?: unknown }) => {
    if (event.type === 'error') harness.errors.push(event.error)
  })
}))
vi.mock('../features/chat/post-turn', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/chat/post-turn')>()
  return {
    ...actual,
    decidePostTurnStep: (...args: Parameters<typeof actual.decidePostTurnStep>) =>
      harness.steps.shift() ?? actual.decidePostTurnStep(...args)
  }
})
// The coordinator hands each request to the session runtime unchanged, so this is the request
// the adapter receives. The turn's provider key is what history stores for the conversation.
vi.mock('../features/chat/turn-coordinator', () => ({
  TurnCoordinator: class {
    async run(
      turn: { dbSessionId: string | null; providerKey: string | null },
      request: TurnRequest,
      options?: { kind?: string }
    ): Promise<void> {
      harness.runs.push({ providerKey: turn.providerKey, request, kind: options?.kind })
      if (!turn.dbSessionId) turn.dbSessionId = 'session-1'
      harness.afterRun?.(request)
    }
  }
}))

import { registerChatHandlers } from './chat-turn'

// Two engines with different documents: a dropped or swapped engine changes what the turn runs.
const documents = {
  local: {
    provider: {
      local: {
        npm: '@ai-sdk/openai-compatible',
        options: { baseURL: 'https://local.test/v1' },
        models: { first: { name: 'First' } }
      }
    }
  },
  other: {
    provider: {
      other: {
        npm: '@ai-sdk/openai-compatible',
        options: { baseURL: 'https://other.test/v1' },
        models: { extra: { name: 'Extra' } }
      }
    }
  }
}

let root = ''
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
  root = ''
})

function install(
  steps: Array<'listen' | 'flush' | 'break'>,
  storedProviderKey: string,
  extraDocuments: Record<string, unknown> = {}
): {
  acquire: ReturnType<typeof vi.fn>
  runtime: {
    channelAlive: boolean
    channelBusy: boolean
    spawnedProviderSettings: TurnRequest['providerSettings']
    spawnedModel: string | undefined
    spawnedRuntimeToolsRevision: number | undefined
    spawnedRuntimeEnvFingerprint: string | undefined
    spawnedAgentProfileKey: string | undefined
    teardownChannel: ReturnType<typeof vi.fn>
  }
  pending: ReturnType<typeof vi.fn>
  takeForRespawn: ReturnType<typeof vi.fn>
  batch: SteerFlushBatch
  removeEngine: (provider: string) => void
  rewriteEngine: (provider: string, document: unknown) => void
} {
  harness.handlers.clear()
  harness.runs.length = 0
  harness.errors.length = 0
  harness.steps = [...steps]
  harness.afterRun = undefined
  root = mkdtempSync(join(tmpdir(), 'orca-turn-config-'))
  for (const [provider, document] of Object.entries({ ...documents, ...extraDocuments })) {
    const directory = join(root, 'sources', 'settings', 'opencode', provider)
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'settings.json'), JSON.stringify(document))
  }
  const acquire = vi.fn()
  const adapter = new OpenCodeAdapter(
    { acquire, installed: vi.fn(), close: vi.fn() } as never,
    vi.fn()
  )
  // Bootstrap's production services read the engine documents above.
  const harnessSettings = createHarnessSettingsService(root)
  const harnessRuntime = createHarnessRuntimeConfigService({
    settings: harnessSettings,
    augmenters: {}
  })
  const runtimeModelCatalog = createRuntimeModelCatalog({
    parseModels: parseHarnessRuntimeModels,
    contributions: RUNTIME_MODEL_CONTRIBUTIONS,
    runtime: harnessRuntime,
    snapshotOf: () => {
      throw new Error('the default deployment declares no runtime model contributions')
    }
  })
  const runtime = {
    channelAlive: true,
    channelBusy: false,
    hasUnframedBacklog: false,
    spawnedProviderSettings: undefined as TurnRequest['providerSettings'],
    spawnedModel: undefined as string | undefined,
    spawnedRuntimeToolsRevision: undefined as number | undefined,
    spawnedRuntimeEnvFingerprint: undefined as string | undefined,
    spawnedAgentProfileKey: undefined as string | undefined,
    subscribeChannelActivity: vi.fn(() => vi.fn()),
    teardownChannel: vi.fn(),
    endListenFrame: vi.fn(),
    close: vi.fn()
  }
  const batch = { uuid: 'batch-1', ids: ['batch-1'], text: 'queued text', createdAt: 1 }
  const pending = vi.fn((): Array<typeof batch> => [])
  const takeForRespawn = vi.fn((): Array<typeof batch> => [])
  registerChatHandlers({
    ctx: {
      mockAdapter: null,
      debugMock: { enabled: false },
      registry: { getActive: () => adapter, get: () => adapter },
      harnessSettings,
      harnessRuntime,
      runtimeModelCatalog,
      // A saved conversation and a continuation read the key history stored for it.
      db: {
        getSessionById: (id: string) =>
          id === 'session-1' || id === 'saved'
            ? {
                backend: 'opencode',
                agent_kind: 'code',
                provider_key: storedProviderKey,
                cwd: '/workspace',
                project_id: null
              }
            : undefined,
        ensurePathProject: vi.fn((project: { id: string }) => project)
      },
      settings: { getAll: () => ({}) },
      mcp: { resolver: () => () => undefined },
      extensions: { build: vi.fn(() => ({ skills: [], hooks: { normalized: {} } })) },
      workProfilePluginPath: '/unused',
      ensureExtensionsDeployedForTurn: async () => {},
      getCwd: () => '/workspace'
    },
    supervisor: {
      hasSession: vi.fn(() => false),
      hasPending: vi.fn(() => false),
      startNew: vi.fn(),
      startResume: vi.fn(),
      acquireRuntime: vi.fn(() => runtime),
      // A live runtime means the saved conversation needs no native history read before sending.
      peekRuntime: vi.fn(() => runtime),
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
    },
    bus: { emit: vi.fn() },
    approvals: { isSessionAllowed: vi.fn(), register: vi.fn() },
    persistence: { flushAskAnswers: vi.fn() },
    permissionModes: new PermissionModeController(),
    pendingMessages: {
      enqueue: vi.fn((_key: string, payload: { text: string }) => ({
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
      takeForRespawn,
      pending,
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
    },
    backgroundTasks: {
      hasCanonical: vi.fn(() => false),
      hasPending: vi.fn(() => false),
      hasAny: vi.fn(() => false),
      count: vi.fn(() => 0),
      ids: vi.fn(() => new Set<string>()),
      clear: vi.fn(),
      isAsyncLaunched: vi.fn(() => false),
      settled: vi.fn()
    },
    activity: { setTransport: vi.fn(), setResidualAttempts: vi.fn(), clear: vi.fn() },
    isUpdateInstallPending: () => false,
    // A saved conversation checks its worktree before preparing the turn.
    worktrees: {
      prepare: vi.fn(),
      recoverMissingWorktree: vi.fn(async () => ({ kind: 'none' }))
    }
  } as never)
  // The engine delete handler removes the document and clears both settings caches.
  const removeEngine = (provider: string): void => {
    rmSync(join(root, 'sources', 'settings', 'opencode', provider), {
      recursive: true,
      force: true
    })
    harnessSettings.invalidateAll()
    harnessRuntime.invalidate(`opencode-${provider}`, 'harness-settings-crud')
  }
  const rewriteEngine = (provider: string, document: unknown): void => {
    writeFileSync(
      join(root, 'sources', 'settings', 'opencode', provider, 'settings.json'),
      JSON.stringify(document)
    )
    harnessSettings.invalidateAll()
    harnessRuntime.invalidate(`opencode-${provider}`, 'harness-settings-crud')
  }
  return { acquire, runtime, pending, takeForRespawn, batch, removeEngine, rewriteEngine }
}

async function send(payload: Record<string, unknown>): Promise<void> {
  const handler = harness.handlers.get(CHANNELS.chatSend)
  if (!handler) throw new Error('chat send handler was not registered')
  await handler(
    { sender: { isDestroyed: () => false, once: vi.fn(), on: vi.fn(), removeListener: vi.fn() } },
    { projectId: null, text: 'initial', agentKind: 'code', ...payload }
  )
}

describe('chat:send execution configuration from the selected engine document (0262)', () => {
  describe.each([
    ['opencode-local', 'opencode-other', 'other/extra', 'other'],
    ['opencode-other', 'opencode-local', 'local/first', 'local']
  ] as const)('saved engine %s, selected engine %s', (storedKey, providerKey, model, provider) => {
    it.each(['listen then flush', 'live flush', 'closed flush'] as const)(
      'keeps the selected engine through %s before history records the new key',
      async (path) => {
        // Empty overrides run the production post-turn decision from channel/queue state.
        // The coordinator emits no session.updated/user commit, so DB still has storedKey.
        const { acquire, runtime, pending, takeForRespawn, batch } = install([], storedKey)
        runtime.teardownChannel.mockImplementation(() => {
          runtime.channelAlive = false
        })
        harness.afterRun = (request) => {
          if (harness.runs.length === 1) {
            // The initial engine switch may drain the old channel before this input is queued.
            takeForRespawn.mockClear()
            takeForRespawn.mockImplementation(() => [batch])
          }
          runtime.spawnedProviderSettings = request.providerSettings
          runtime.spawnedModel = request.model
          runtime.spawnedRuntimeToolsRevision = request.extensions.runtimeTools?.revision
          runtime.spawnedRuntimeEnvFingerprint = request.envFingerprint
          runtime.spawnedAgentProfileKey = request.extensions.agentProfileKey
          runtime.channelAlive = path !== 'closed flush'
          runtime.channelBusy = path === 'listen then flush' && harness.runs.length === 1
          const completed = harness.runs.length === (path === 'listen then flush' ? 3 : 2)
          pending.mockReturnValue(completed ? [] : [batch])
        }

        await send({ sessionId: 'saved', providerKey, modelFamily: null })

        expect(harness.errors).toEqual([])
        expect(harness.runs.map((run) => run.kind)).toEqual(
          path === 'listen then flush' ? [undefined, 'listen', undefined] : [undefined, undefined]
        )
        expect(harness.runs.map((run) => run.request.text)).toEqual(
          path === 'listen then flush' ? ['initial', '', batch.text] : ['initial', batch.text]
        )
        for (const run of harness.runs) {
          expect(run.providerKey).toBe(providerKey)
          expect(run.request.model).toBe(model)
          expect(run.request.providerSettings).toMatchObject({ providerKey, provider })
          expect(run.request.providerSettings?.settings).toEqual(documents[provider])
        }
        if (path === 'closed flush') {
          expect(takeForRespawn).toHaveBeenCalledWith('saved', 'chain-1')
        } else {
          expect(takeForRespawn).not.toHaveBeenCalled()
        }
        expect(acquire).not.toHaveBeenCalled()
      }
    )
  })

  it.each([
    ['opencode-local', 'listen', 'local/first', 'local'],
    ['opencode-local', 'flush', 'local/first', 'local'],
    ['opencode-other', 'listen', 'other/extra', 'other'],
    ['opencode-other', 'flush', 'other/extra', 'other']
  ] as const)(
    'runs %s with its own document and model on the initial and automatic %s turn',
    async (providerKey, step, model, provider) => {
      const { acquire } = install([step, 'break'], providerKey)
      await send({ sessionId: null, backend: 'opencode', providerKey, modelFamily: model })
      expect(harness.errors).toEqual([])
      expect(harness.runs.map((run) => run.kind)).toEqual([
        undefined,
        step === 'listen' ? 'listen' : undefined
      ])
      for (const run of harness.runs) {
        expect(run.providerKey).toBe(providerKey)
        expect(run.request.model).toBe(model)
        expect(run.request.providerSettings).toMatchObject({ providerKey, provider })
        expect(run.request.providerSettings?.settings).toEqual(documents[provider])
      }
      // Selection and configuration come from the documents; no server is needed before the turn.
      expect(acquire).not.toHaveBeenCalled()
    }
  )

  it.each(['live flush', 'closed flush'] as const)(
    'continues a %s with the saved engine document and model when the selected engine is deleted after the first turn',
    async (path) => {
      // Sorted engines are local, other, third: the saved engine is not the first entry, so a
      // dropped conversation id falls to local and a kept first-turn model stays on third.
      const third = {
        provider: {
          third: {
            npm: '@ai-sdk/openai-compatible',
            options: { baseURL: 'https://third.test/v1' },
            models: { only: { name: 'Only' } }
          }
        }
      }
      const { runtime, pending, takeForRespawn, batch, removeEngine } = install(
        [],
        'opencode-other',
        { third }
      )
      runtime.teardownChannel.mockImplementation(() => {
        runtime.channelAlive = false
      })
      harness.afterRun = (request) => {
        if (harness.runs.length === 1) {
          takeForRespawn.mockClear()
          takeForRespawn.mockImplementation(() => [batch])
          removeEngine('third')
        }
        runtime.spawnedProviderSettings = request.providerSettings
        runtime.spawnedModel = request.model
        runtime.spawnedRuntimeToolsRevision = request.extensions.runtimeTools?.revision
        runtime.spawnedRuntimeEnvFingerprint = request.envFingerprint
        runtime.spawnedAgentProfileKey = request.extensions.agentProfileKey
        runtime.channelAlive = path !== 'closed flush'
        pending.mockReturnValue(harness.runs.length === 2 ? [] : [batch])
      }

      await send({ sessionId: 'saved', providerKey: 'opencode-third', modelFamily: null })

      expect(harness.errors).toEqual([])
      expect(harness.runs.map((run) => run.request.text)).toEqual(['initial', batch.text])
      expect(harness.runs[0]?.request.model).toBe('third/only')
      expect(harness.runs[0]?.request.providerSettings?.settings).toEqual(third)
      const flush = harness.runs[1]!.request
      expect(flush.model).toBe('other/extra')
      expect(flush.providerSettings).toMatchObject({
        providerKey: 'opencode-other',
        provider: 'other'
      })
      expect(flush.providerSettings?.settings).toEqual(documents.other)
    }
  )

  it('keeps the first turn model on a listen turn when the continuation resolves the engine to no model', async () => {
    // A listen request is built fresh (a flush inherits the first request), so only the
    // continuation's fallback model can carry the model the turn ran with.
    const { runtime, pending, rewriteEngine } = install(['listen', 'break'], 'opencode-other')
    const modelless = {
      provider: { other: { ...documents.other.provider.other, models: {} } }
    }
    harness.afterRun = (request) => {
      if (harness.runs.length === 1) rewriteEngine('other', modelless)
      runtime.spawnedProviderSettings = request.providerSettings
      runtime.spawnedModel = request.model
      runtime.spawnedRuntimeToolsRevision = request.extensions.runtimeTools?.revision
      runtime.spawnedRuntimeEnvFingerprint = request.envFingerprint
      runtime.spawnedAgentProfileKey = request.extensions.agentProfileKey
      pending.mockReturnValue([])
    }

    await send({ sessionId: 'saved', providerKey: 'opencode-other', modelFamily: null })

    expect(harness.errors).toEqual([])
    expect(harness.runs.map((run) => run.kind)).toEqual([undefined, 'listen'])
    expect(harness.runs[0]?.request.model).toBe('other/extra')
    // The re-read document has no model, so the continuation keeps the one this turn ran with.
    expect(harness.runs[1]?.request.providerSettings?.settings).toEqual(modelless)
    expect(harness.runs[1]?.request.model).toBe('other/extra')
  })

  it('falls back to the saved conversation engine when its selected engine no longer exists', async () => {
    install(['break'], 'opencode-other')
    await send({ sessionId: 'saved', providerKey: 'opencode-removed', modelFamily: null })
    expect(harness.errors).toEqual([])
    expect(harness.runs).toHaveLength(1)
    expect(harness.runs[0]?.providerKey).toBe('opencode-other')
    expect(harness.runs[0]?.request.model).toBe('other/extra')
    expect(harness.runs[0]?.request.providerSettings?.settings).toEqual(documents.other)
  })
})
