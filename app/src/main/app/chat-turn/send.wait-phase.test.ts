import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { ChatWaitPhase } from '../../../shared/ipc'
import { makeClassifiedError } from '../../infra/errors'

const mocks = vi.hoisted(() => ({
  acquireTurnRuntime: vi.fn(),
  buildTurnContext: vi.fn(),
  buildTurnRequest: vi.fn((...args: [unknown, unknown]) => ({ args })),
  runTurnWithContinuations: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  sendChatEvent: vi.fn(),
  startNew: vi.fn(),
  startResume: vi.fn(),
  release: vi.fn(),
  resolveTurn: vi.fn()
}))

vi.mock('../../features/chat/attachments', () => ({
  normalizeAttachments: vi.fn(async () => ({
    attachmentTexts: [],
    attachmentImages: []
  }))
}))
vi.mock('./admission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./admission')>()),
  admitChatSend: vi.fn(({ raw }) => ({ ok: true, data: raw })),
  attachmentFailure: vi.fn(),
  foreignPreparingLease: vi.fn()
}))
vi.mock('./resolve-turn', () => ({
  resolveTurnProvider: vi.fn(),
  resolveTurn: mocks.resolveTurn
}))
vi.mock('./turn-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./turn-context')>()),
  buildTurnContext: mocks.buildTurnContext
}))
vi.mock('./runtime-entry', () => ({ acquireTurnRuntime: mocks.acquireTurnRuntime }))
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: mocks.sendChatEvent }))
vi.mock('../../infra/log', () => ({
  getLogger: () => ({ child: () => ({ info: vi.fn() }) })
}))
vi.mock('./enqueue', () => ({
  enqueueTurnPrompt: vi.fn(() => ({
    preludes: [],
    mainBatch: { text: 'work', uuid: 'batch-1', ids: ['req-1'], createdAt: 1 },
    initialBatches: []
  }))
}))
vi.mock('./turn-request', () => ({ buildTurnRequest: mocks.buildTurnRequest }))
vi.mock('./approval', () => ({ createApprovalRequester: vi.fn(() => vi.fn()) }))
vi.mock('./post-turn', () => ({ runTurnWithContinuations: mocks.runTurnWithContinuations }))
vi.mock('../chat-turn-continuation', () => ({ prepareAutomaticContinuation: vi.fn() }))
vi.mock('../../features/chat/turn-coordinator', () => ({
  TurnCoordinator: class {
    run = vi.fn()
  }
}))

import { handleChatSend } from './send'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeHarness(options: { reportsWaitPhases?: true; sessionId?: string } = {}) {
  const controller = new AbortController()
  const turn = {
    controller: new AbortController(),
    abortContinuation: undefined as 'reception' | 'send-now' | undefined,
    cwd: '/managed/repo',
    extraDirs: [] as string[],
    queueKey: options.sessionId ?? 'new:1',
    dbSessionId: options.sessionId ?? null
  }
  mocks.buildTurnContext.mockImplementation((input) => {
    turn.controller = input.controller
    turn.cwd = input.payload.cwd
    turn.extraDirs = input.payload.extraDirs ?? []
    return turn
  })

  const setWaitPhase = vi.fn<(sessionId: string, phase: ChatWaitPhase | null) => void>()
  const supervisor = {
    getChainByKey: vi.fn(),
    acquireChain: vi.fn(() => ({
      acquired: true,
      lease: {
        admittedAt: 1,
        controller,
        control: {},
        chainId: 'chain-1',
        leaseId: 'lease-1'
      }
    })),
    startNew: mocks.startNew,
    startResume: mocks.startResume,
    release: mocks.release,
    releaseChain: vi.fn(),
    releaseRuntime: vi.fn()
  }
  const sender = new EventEmitter()
  const deps = {
    ctx: {
      db: {
        getProject: vi.fn(() => null),
        ensurePathProject: vi.fn((row) => ({ ...row, cwd_key: row.cwdKey })),
        getSessionById: () => ({
          cwd: null,
          project_id: null,
          provider_key: null,
          agent_kind: 'code'
        })
      },
      mockAdapter: null,
      debugMock: { enabled: false },
      registry: {
        getActive: () => ({
          id: options.reportsWaitPhases ? 'opencode' : 'claude',
          ...(options.reportsWaitPhases ? { reportsWaitPhases: true as const } : {}),
          agentSpawnEnv: vi.fn(() => ({})),
          complete: vi.fn(),
          classifyError: vi.fn((error) => error)
        })
      },
      getCwd: () => '/source/repo',
      ensureExtensionsDeployedForTurn: vi.fn(async () => undefined),
      extensions: { build: vi.fn(() => ({ skills: [], hooks: { normalized: {} } })) }
    },
    supervisor,
    bus: {},
    approvals: {},
    persistence: {},
    permissionModes: { setMode: vi.fn() },
    pendingMessages: {
      cancelAllHeld: vi.fn(() => []),
      rollback: vi.fn(),
      orphanUnconfirmed: vi.fn(() => [])
    },
    backgroundTasks: {},
    activity: { setWaitPhase },
    isUpdateInstallPending: () => false,
    listenRelease: new Map(),
    settleDeadBackgroundTasks: vi.fn(),
    worktrees: {
      prepare: vi.fn(),
      recoverMissingWorktree: vi.fn(async () => ({ kind: 'none' as const }))
    }
  }

  return { deps, sender, setWaitPhase }
}

describe('handleChatSend waitPhase producer wiring (0296 IT-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveTurn.mockImplementation(async (_ctx, _supervisor, _adapter, payload) => ({
      ok: true,
      value: {
        native: {},
        continuitySource: payload.forkFrom ?? payload.handoffFrom ?? null,
        continuityMeta: null,
        continuityLang: null,
        resolved: {
          prepared: { providerSettings: { snapshot: true }, env: { SNAPSHOT: 'yes' } }
        },
        sessionMeta: null,
        boundProjectId: payload.projectId ?? null,
        effectiveText: payload.text
      }
    }))
    mocks.acquireTurnRuntime.mockResolvedValue({
      ok: true,
      runtime: { close: vi.fn(), channelAlive: true, hasSchedules: false, markAborted: vi.fn() },
      extensions: { skills: [], hooks: { normalized: {} } }
    })
  })

  it('A1/A2: sets preparing before acquireTurnRuntime and clears with null in outer finally', async () => {
    const { deps, sender, setWaitPhase } = makeHarness({ reportsWaitPhases: true })

    await handleChatSend(deps as never, { sender } as never, {
      sessionId: null,
      clientKey: 'new:1',
      text: 'hello',
      agentKind: 'code'
    })

    expect(setWaitPhase).toHaveBeenCalledWith('new:1', { kind: 'preparing' })
    expect(setWaitPhase.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.acquireTurnRuntime.mock.invocationCallOrder[0]!
    )
    expect(setWaitPhase.mock.calls.at(-1)).toEqual(['new:1', null])
  })

  it('A3: clears waitPhase with null in outer finally when acquireTurnRuntime rejects', async () => {
    const { deps, sender, setWaitPhase } = makeHarness({ reportsWaitPhases: true })
    mocks.acquireTurnRuntime.mockRejectedValueOnce(new Error('runtime acquire failed'))

    await handleChatSend(deps as never, { sender } as never, {
      sessionId: null,
      clientKey: 'new:1',
      text: 'hello',
      agentKind: 'code'
    })

    expect(setWaitPhase.mock.calls).toEqual([
      ['new:1', { kind: 'preparing' }],
      ['new:1', null]
    ])
  })

  it('A4: maps resolveTurn onNativeHistory(true) -> history and (false) -> preparing before clearing with null', async () => {
    const { deps, sender, setWaitPhase } = makeHarness({
      reportsWaitPhases: true,
      sessionId: 'session-1'
    })
    mocks.resolveTurn.mockImplementationOnce(
      async (_ctx, _supervisor, _adapter, payload, _extra, options) => {
        options?.onNativeHistory?.(true)
        options?.onNativeHistory?.(false)
        return {
          ok: true,
          value: {
            native: {},
            continuitySource: null,
            continuityMeta: null,
            continuityLang: null,
            resolved: {
              prepared: { providerSettings: { snapshot: true }, env: { SNAPSHOT: 'yes' } }
            },
            sessionMeta: { cwd: '/source/repo', project_id: null },
            boundProjectId: payload.projectId ?? null,
            effectiveText: payload.text
          }
        }
      }
    )

    await handleChatSend(deps as never, { sender } as never, {
      sessionId: 'session-1',
      text: 'resume',
      agentKind: 'code'
    })

    expect(setWaitPhase.mock.calls).toEqual([
      ['session-1', { kind: 'preparing' }],
      ['session-1', { kind: 'history' }],
      ['session-1', { kind: 'preparing' }],
      ['session-1', null]
    ])
    expect(setWaitPhase.mock.calls.some(([key]) => key === 'session:session-1')).toBe(false)
  })

  it('A5: does not emit any non-null waitPhase when adapter does not report waitPhases (Claude)', async () => {
    const { deps, sender, setWaitPhase } = makeHarness({ sessionId: 'claude-1' })
    mocks.resolveTurn.mockImplementationOnce(
      async (_ctx, _supervisor, _adapter, payload, _extra, options) => {
        options?.onNativeHistory?.(true)
        options?.onNativeHistory?.(false)
        return {
          ok: true,
          value: {
            native: {},
            continuitySource: null,
            continuityMeta: null,
            continuityLang: null,
            resolved: {
              prepared: { providerSettings: { snapshot: true }, env: { SNAPSHOT: 'yes' } }
            },
            sessionMeta: { cwd: '/source/repo', project_id: null },
            boundProjectId: payload.projectId ?? null,
            effectiveText: payload.text
          }
        }
      }
    )

    await handleChatSend(deps as never, { sender } as never, {
      sessionId: 'claude-1',
      text: 'hello claude',
      agentKind: 'code'
    })

    const nonNullCalls = setWaitPhase.mock.calls.filter(([, phase]) => phase !== null)
    expect(nonNullCalls).toEqual([])
  })

  it('A6: clears waitPhase with null on confirmed turn.dbSessionId when new session confirms id during runTurnWithContinuations', async () => {
    const { deps, sender, setWaitPhase } = makeHarness({ reportsWaitPhases: true })
    mocks.runTurnWithContinuations.mockImplementationOnce(async (_deps, turn) => {
      ;(turn as { dbSessionId: string | null }).dbSessionId = 's-new'
    })

    await handleChatSend(deps as never, { sender } as never, {
      sessionId: null,
      clientKey: 'new:1',
      text: 'hello new confirmed',
      agentKind: 'code'
    })

    expect(setWaitPhase.mock.calls).toEqual([
      ['new:1', { kind: 'preparing' }],
      ['s-new', null]
    ])
  })

  it('A7: clears the resumed session waitPhase when resolveTurn fails before a turn is created', async () => {
    const { deps, sender, setWaitPhase } = makeHarness({
      reportsWaitPhases: true,
      sessionId: 'session-1'
    })
    const error = makeClassifiedError('provider_connection_error', 'resume resolution failed')
    mocks.resolveTurn.mockResolvedValueOnce({ ok: false, error })

    await handleChatSend(deps as never, { sender } as never, {
      sessionId: 'session-1',
      text: 'resume',
      agentKind: 'code'
    })

    expect(setWaitPhase.mock.calls).toEqual([
      ['session-1', { kind: 'preparing' }],
      ['session-1', null]
    ])
    expect(mocks.acquireTurnRuntime).not.toHaveBeenCalled()
    expect(mocks.buildTurnContext).not.toHaveBeenCalled()
    expect(mocks.sendChatEvent).toHaveBeenCalledWith(sender, { type: 'error', error })
  })
})
