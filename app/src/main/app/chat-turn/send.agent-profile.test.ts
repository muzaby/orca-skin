import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AgentKind } from '../../../shared/agent-kind'
import type { TurnExtensions, TurnRequest } from '../../adapters/common/turn'
import { SessionRuntime } from '../../features/sessions/session-runtime'
import type { RuntimeSessionAdapter } from '../../contracts/ports'
import type { DbQueries } from '../../infra/db'
import type { Settings } from '../../../shared/ipc'
import type { NativeSessionPreparation } from './native-session'

const mocks = vi.hoisted(() => ({
  sendChatEvent: vi.fn(),
  acquire: vi.fn(),
  run: vi.fn(),
  native: {} as NativeSessionPreparation,
  resolveTurnProvider: vi.fn<
    (
      ctx: unknown,
      request: { agentKind?: AgentKind }
    ) => Promise<{ providerKey: null; prepared: object; model: string }>
  >(async () => ({ providerKey: null, prepared: {}, model: 'fixture' })),
  sourceKind: undefined as AgentKind | undefined
}))
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: mocks.sendChatEvent }))
vi.mock('../../features/chat/attachments', () => ({
  normalizeAttachments: vi.fn(async () => ({ attachmentTexts: [], attachmentImages: [] }))
}))
vi.mock('./admission', () => ({
  admitChatSend: ({ raw }: { raw: unknown }) => ({ ok: true, data: raw }),
  attachmentFailure: vi.fn(),
  foreignPreparingLease: vi.fn(),
  leaseKeyFor: () => ({ provisionalKey: 'new:fixture', logicalKey: 'fixture' })
}))
vi.mock('./resolve-turn', () => ({
  resolveTurnProvider: mocks.resolveTurnProvider,
  resolveTurn: vi.fn(async (_ctx, _supervisor, _adapter, payload) => ({
    ok: true,
    value: {
      native: mocks.native,
      continuitySource: payload.forkFrom ?? payload.handoffFrom ?? null,
      continuityMeta: null,
      continuityLang: null,
      resolved: { prepared: {}, model: 'fixture' },
      sessionMeta: payload.sessionId ? { cwd: payload.cwd, project_id: null } : null,
      boundProjectId: null,
      effectiveText: payload.text
    }
  }))
}))
vi.mock('./turn-context', async (original) => ({
  ...(await original<typeof import('./turn-context')>()),
  buildTurnContext: (input) => ({
    agentKind: input.agentKind,
    controller: input.controller,
    owner: input.owner,
    cwd: input.payload.cwd,
    extraDirs: [],
    queueKey: input.queueKey,
    dbSessionId: input.payload.sessionId ?? null
  })
}))
vi.mock('./runtime-entry', () => ({ acquireTurnRuntime: mocks.acquire }))
vi.mock('./enqueue', () => ({
  reserveOnBusySession: vi.fn(),
  enqueueTurnPrompt: () => ({
    preludes: [],
    initialBatches: [],
    mainBatch: { text: 'fixture', uuid: 'batch' }
  })
}))
vi.mock('./approval', () => ({ createApprovalRequester: () => vi.fn() }))
vi.mock('./turn-request', () => ({ buildTurnRequest: (_deps, input) => input }))
vi.mock('./post-turn', () => ({ runTurnWithContinuations: mocks.run }))
vi.mock('../../features/chat/turn-coordinator', () => ({
  TurnCoordinator: class {}
}))

import { handleChatSend } from './send'
import { ExtensionBuilder } from '../../features/extensions/common/builder'
import { resolveAgentProfile } from '../../features/agents/profiles'

const plugin = resolve('resources/claude-plugins/work-profile')

// Preserve the inferred mock signatures used by the individual failure scenarios.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(cwd: string, pluginPath = plugin) {
  const sender = new EventEmitter()
  const roots = Object.freeze(['/existing/plugin'])
  const controller = new AbortController()
  const supervisor = {
    getChainByKey: vi.fn(),
    acquireChain: vi.fn(() => ({
      acquired: true,
      lease: {
        agentKind: 'work',
        controller,
        admittedAt: 1,
        chainId: 'chain',
        leaseId: 'lease',
        control: {}
      }
    })),
    startNew: vi.fn(),
    startResume: vi.fn(),
    release: vi.fn(),
    releaseRuntime: vi.fn(),
    releaseChain: vi.fn()
  }
  const db = {
    getSessionById: () => ({ agent_kind: mocks.sourceKind }),
    getProjectContextForSession: () => null,
    getProject: () => null,
    ensurePathProject: (row) => ({ ...row, cwd_key: row.cwdKey })
  }
  const builder = new ExtensionBuilder(
    db as unknown as DbQueries,
    () => [],
    () => ({}) as Settings,
    'fixture',
    () => [...roots]
  )
  const runtime = {
    close: vi.fn(),
    markAborted: vi.fn(),
    channelAlive: true,
    spawnedModel: 'fixture',
    spawnedAgentProfileKey: undefined as string | undefined
  }
  const extensions: TurnExtensions[] = []
  const deps = {
    ctx: {
      db,
      extensions: builder,
      workProfilePluginPath: pluginPath,
      mockAdapter: null,
      debugMock: { enabled: false },
      registry: {
        getActive: () => ({ id: 'fixture', classifyError: (error) => ({ message: error.message }) })
      },
      getCwd: () => cwd,
      ensureExtensionsDeployedForTurn: vi.fn(async () => {})
    },
    supervisor,
    bus: {},
    approvals: {},
    persistence: {},
    permissionModes: { setMode: vi.fn(), getCurrentMode: () => 'accept_edits' },
    pendingMessages: { cancelAllHeld: () => [], rollback: vi.fn(), orphanUnconfirmed: vi.fn() },
    backgroundTasks: {},
    activity: {},
    isUpdateInstallPending: () => false,
    listenRelease: new Map(),
    settleDeadBackgroundTasks: vi.fn(),
    worktrees: { recoverMissingWorktree: async () => ({ kind: 'none' }) },
    prepareOutputFiles: async () => ({ directory: join(cwd, 'outputs'), capture: vi.fn() })
  }
  return { sender, supervisor, runtime, extensions, deps, roots }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sourceKind = undefined
  mocks.native = {}
})

describe('Work profile production send wiring', () => {
  it.each([false, true])(
    'routes a saved OpenCode session through its runtime and keeps harness instructions isolated (recovery: %s)',
    async (recovery) => {
      const cwd = await mkdtemp(join(tmpdir(), 'orca-send-harness-'))
      const recoveryPrompt = vi.fn()
      if (recovery)
        mocks.native = {
          nativeSessionId: 'replacement',
          recoveryHistory: 'archived conversation',
          recoveryFreshStart: false
        }
      const sendMessage = vi.fn<RuntimeSessionAdapter['sendMessage']>((request) => {
        request.recovery?.onPrompt('native-receipt')
        return {
          eventBatches: (async function* () {
            yield { sequence: 1, events: [{ type: 'turn.ended' as const, sessionId: 'existing' }] }
          })(),
          close: () => {},
          setPermissionMode: async () => {},
          interrupt: async () => ({ stillQueued: [] }),
          setModel: async () => {},
          stopTask: async () => {},
          backgroundTask: async () => false
        }
      })
      const adapter = {
        id: 'opencode',
        sendMessage,
        complete: async () => '',
        classifyError: (error: unknown) => ({
          category: 'stream_error' as const,
          message: String(error),
          retryable: false
        })
      } as RuntimeSessionAdapter
      const claudeSend = vi.fn()
      const current = harness(cwd)
      const runtime = new SessionRuntime(adapter)
      Object.assign(current.deps.ctx.registry, {
        getActive: () => ({ id: 'claude', sendMessage: claudeSend }),
        get: (id: string) => (id === 'opencode' ? adapter : undefined)
      })
      Object.assign(current.deps.ctx.db, {
        getSessionById: () => ({ backend: 'opencode', agent_kind: 'code' }),
        nativeHistory: { recoveryPrompt }
      })
      Object.assign(current.deps.ctx, {
        settings: {
          getAll: () => ({
            harnesses: {
              claude: { instructions: 'Claude private instructions' },
              opencode: { instructions: 'OpenCode isolated instructions' }
            }
          })
        }
      })
      mocks.acquire.mockImplementation(async (input) => {
        expect(input.adapter).toBe(adapter)
        input.onRuntimeAcquired(runtime)
        return { ok: true, runtime, extensions: input.buildExtensions() }
      })
      mocks.run.mockImplementation(async (_input, _turn, request: TurnRequest) => {
        for await (const event of runtime.send(request)) expect(event.type).toBe('turn.ended')
      })
      try {
        await handleChatSend(current.deps as never, { sender: current.sender } as never, {
          text: 'fixture',
          cwd,
          sessionId: 'existing',
          agentKind: 'code',
          attachmentViews: [],
          harnessAgent: 'plan',
          modelVariant: 'high'
        })
        expect(sendMessage).toHaveBeenCalledOnce()
        expect(sendMessage.mock.calls[0]![0]).toMatchObject({
          sessionId: 'existing',
          harnessAgent: 'plan',
          modelVariant: 'high',
          extensions: {
            systemPromptAppend: expect.stringContaining('OpenCode isolated instructions')
          }
        })
        expect(sendMessage.mock.calls[0]![0].extensions.systemPromptAppend).not.toContain(
          'Claude private instructions'
        )
        expect(claudeSend).not.toHaveBeenCalled()
        if (recovery) {
          expect(sendMessage.mock.calls[0]![0]).toMatchObject({
            nativeSessionId: 'replacement',
            text: 'fixture',
            recovery: { history: 'archived conversation', freshStart: false }
          })
          expect(recoveryPrompt).toHaveBeenCalledWith('existing', 'native-receipt', 'fixture')
        } else {
          expect(sendMessage.mock.calls[0]![0].recovery).toBeUndefined()
          expect(recoveryPrompt).not.toHaveBeenCalled()
        }
        expect(current.supervisor.releaseChain).toHaveBeenCalledWith('lease')
      } finally {
        runtime.close()
        await rm(cwd, { recursive: true, force: true })
      }
    }
  )
  it.each(['new', 'resume', 'forkFrom', 'handoffFrom'])(
    'keeps Work and Code isolated at %s and both automatic continuation preparations',
    async (arrival) => {
      const cwd = await mkdtemp(join(tmpdir(), 'orca-send-profile-'))
      try {
        const runs = [harness(cwd), harness(cwd)]
        for (const [index, kind] of (['work', 'code'] as const).entries()) {
          const current = runs[index]
          const continuationCallStart = mocks.resolveTurnProvider.mock.calls.length
          mocks.sourceKind = kind
          mocks.acquire.mockImplementation(async (input) => {
            const extensions = input.buildExtensions()
            current.extensions.push(extensions)
            current.runtime.spawnedAgentProfileKey = extensions.agentProfileKey
            input.onRuntimeAcquired(current.runtime)
            return { ok: true, runtime: current.runtime, extensions }
          })
          mocks.run.mockImplementation(async (input, _turn, request) => {
            expect(request.extensions).toBe(current.extensions[0])
            for (let continuation = 0; continuation < 2; continuation++) {
              const next = await input.prepareContinuation('continued')
              current.extensions.push(next.extensions)
              expect(next.shouldRespawn).toBe(false)
            }
          })
          await handleChatSend(current.deps as never, { sender: current.sender } as never, {
            text: 'fixture',
            cwd,
            attachmentViews: [],
            ...(arrival === 'new' ? { agentKind: kind } : {}),
            ...(arrival === 'resume' ? { sessionId: 'existing' } : {}),
            ...(['forkFrom', 'handoffFrom'].includes(arrival) ? { [arrival]: 'source' } : {})
          })
          expect(current.extensions).toHaveLength(3)
          const continuationCalls =
            mocks.resolveTurnProvider.mock.calls.slice(continuationCallStart)
          expect(continuationCalls).toHaveLength(2)
          for (const [, request] of continuationCalls) {
            expect(request).toMatchObject({ agentKind: kind })
          }
          for (const ext of current.extensions) {
            expect(ext.pluginRoots).toEqual(
              kind === 'work' ? [...current.roots, plugin] : current.roots
            )
            expect(ext.agentProfileKey).toBe(kind === 'work' ? 'work:4' : undefined)
            expect(ext.systemPromptAppend?.includes('<work_instructions>')).toBe(kind === 'work')
            if (kind === 'work') {
              expect(ext.systemPromptAppend).toContain(resolveAgentProfile('work').instructions)
              expect(ext.systemPromptAppend).toContain(
                `Final ordinary output directory: ${join(cwd, 'outputs')}`
              )
            }
          }
          expect(current.supervisor.releaseChain).toHaveBeenCalledWith('lease')
        }
        expect(await readdir(cwd)).toEqual([])
        expect(
          mocks.sendChatEvent.mock.calls
            .flatMap(([, event]) => event)
            .filter((event) => event.type === 'error')
        ).toEqual([])
      } finally {
        await rm(cwd, { recursive: true, force: true })
      }
    }
  )

  it('reports missing Work resources and releases the registered turn and lease before runtime acquisition', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'orca-send-profile-failure-'))
    try {
      const current = harness(cwd, join(cwd, 'missing'))
      await handleChatSend(current.deps as never, { sender: current.sender } as never, {
        text: 'fixture',
        cwd,
        agentKind: 'work',
        attachmentViews: []
      })
      expect(mocks.acquire).not.toHaveBeenCalled()
      expect(mocks.run).not.toHaveBeenCalled()
      expect(current.supervisor.startNew).toHaveBeenCalledOnce()
      expect(current.supervisor.release).toHaveBeenCalledOnce()
      expect(current.supervisor.releaseChain).toHaveBeenCalledWith('lease')
      expect(mocks.sendChatEvent).toHaveBeenCalledWith(
        current.sender,
        expect.objectContaining({
          type: 'error',
          error: { message: expect.stringContaining('Work 프로필 리소스') }
        })
      )
      expect(await readdir(cwd)).toEqual([])
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('revalidates a removed resource on automatic continuation and closes the failed preparation', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'orca-send-profile-continuation-'))
    try {
      const current = harness(cwd)
      mocks.acquire.mockImplementation(async (input) => {
        const extensions = input.buildExtensions()
        input.onRuntimeAcquired(current.runtime)
        return { ok: true, runtime: current.runtime, extensions }
      })
      mocks.run.mockImplementation(async (input) => {
        current.deps.ctx.workProfilePluginPath = join(cwd, 'removed')
        await input.prepareContinuation('existing')
      })
      await handleChatSend(current.deps as never, { sender: current.sender } as never, {
        text: 'fixture',
        cwd,
        agentKind: 'work',
        attachmentViews: []
      })
      expect(mocks.run).toHaveBeenCalledOnce()
      expect(current.supervisor.release).toHaveBeenCalledOnce()
      expect(current.supervisor.releaseRuntime).toHaveBeenCalledOnce()
      expect(current.supervisor.releaseChain).toHaveBeenCalledWith('lease')
      expect(mocks.sendChatEvent).toHaveBeenCalledWith(
        current.sender,
        expect.objectContaining({
          type: 'error',
          error: { message: expect.stringContaining('Work 프로필 리소스') }
        })
      )
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
