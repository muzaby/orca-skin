import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHANNELS } from '../../shared/ipc'
import type { TurnRequest } from '../adapters/common/turn'
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
  steps: [] as Array<'listen' | 'flush' | 'break'>
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
vi.mock('../features/chat/post-turn', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/chat/post-turn')>()),
  decidePostTurnStep: () => harness.steps.shift() ?? 'break',
  postTurnHoldsSession: (step: string) => step !== 'break'
}))
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
  storedProviderKey: string
): { acquire: ReturnType<typeof vi.fn> } {
  harness.handlers.clear()
  harness.runs.length = 0
  harness.errors.length = 0
  harness.steps = [...steps]
  root = mkdtempSync(join(tmpdir(), 'orca-turn-config-'))
  for (const [provider, document] of Object.entries(documents)) {
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
    spawnedProviderSettings: undefined,
    spawnedModel: undefined,
    spawnedRuntimeToolsRevision: undefined,
    subscribeChannelActivity: vi.fn(() => vi.fn()),
    teardownChannel: vi.fn(),
    endListenFrame: vi.fn(),
    close: vi.fn()
  }
  const batch = { uuid: 'batch-1', ids: ['batch-1'], text: 'queued text', createdAt: 1 }
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
  return { acquire }
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
