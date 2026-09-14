import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AgentKind } from '../../../shared/agent-kind'
import type { TurnExtensions } from '../../adapters/turn'
import type { DbQueries } from '../../infra/db'
import type { Settings } from '../../../shared/ipc'

const mocks = vi.hoisted(() => ({
  sendChatEvent: vi.fn(),
  acquire: vi.fn(),
  run: vi.fn(),
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
  resolveTurnProvider: vi.fn(async () => ({ providerKey: null, prepared: {}, model: 'fixture' })),
  resolveTurn: vi.fn(async (_ctx, _supervisor, _adapter, payload) => ({
    ok: true,
    value: {
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
  TurnCoordinator: class {
    beginApprovalPause = vi.fn()
  }
}))

import { handleChatSend } from './send'
import { ExtensionBuilder } from '../../features/extensions/builder'
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
})

describe('Work profile production send wiring', () => {
  it.each(['new', 'resume', 'forkFrom', 'handoffFrom'])(
    'keeps Work and Code isolated at %s and both automatic continuation preparations',
    async (arrival) => {
      const cwd = await mkdtemp(join(tmpdir(), 'orca-send-profile-'))
      try {
        const runs = [harness(cwd), harness(cwd)]
        for (const [index, kind] of (['work', 'code'] as const).entries()) {
          const current = runs[index]
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
