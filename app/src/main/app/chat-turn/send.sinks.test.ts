/**
 * VP-03 · k27 · EP-1 ⑬ — Verifies `handleChatSend` wires `TurnCoordinator.forward.relay`
 * to `persistence.relay` and `TurnCoordinator.forward.forward` to `sendChatEvent`.
 */
import { describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { ClientRef } from '../../contracts/client'
import type { TurnContext } from '../../contracts/turn'
import { fakeClient } from '../../infra/ipc/client.testfixture'
import { withDataPort } from '../data-host/data-port.testfixture'

const captured = vi.hoisted(() => ({
  coordinatorDeps: null as {
    forward: {
      forward: (owner: ClientRef, ev: NormalizedEvent) => void
      relay: (turn: TurnContext<ClientRef>, ev: NormalizedEvent) => void
    }
  } | null,
  sendChatEvent: vi.fn()
}))

vi.mock('../../infra/git/probe', async (original) => ({
  ...(await original<typeof import('../../infra/git/probe')>()),
  probeRepo: vi.fn(async () => ({ kind: 'not-repo' as const }))
}))
vi.mock('../../features/chat/attachments', () => ({
  normalizeAttachments: vi.fn(async () => ({ attachmentTexts: [], attachmentImages: [] }))
}))
vi.mock('./admission', async (original) => ({
  ...(await original<typeof import('./admission')>()),
  admitChatSend: vi.fn(({ raw }) => ({ ok: true, data: raw })),
  attachmentFailure: vi.fn(),
  foreignPreparingLease: vi.fn()
}))
vi.mock('./resolve-turn', () => ({
  resolveTurnProvider: vi.fn(),
  resolveTurn: vi.fn(async (_ctx, _supervisor, _adapter, payload) => ({
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
}))
vi.mock('./turn-context', async (original) => ({
  ...(await original<typeof import('./turn-context')>()),
  buildTurnContext: vi.fn((input) => ({
    controller: input.controller,
    cwd: '/managed/repo',
    extraDirs: [],
    queueKey: 'sess-1',
    sessionKey: 'sess-1',
    dbSessionId: 'sess-1',
    owner: input.owner,
    backend: 'claude',
    currentAssistantMessageId: null,
    currentAssistantText: ''
  }))
}))
vi.mock('./runtime-entry', () => ({
  acquireTurnRuntime: vi.fn(async () => ({
    ok: true,
    runtime: {
      close: vi.fn(),
      channelAlive: true,
      hasSchedules: false,
      markAborted: vi.fn(),
      complete: vi.fn()
    },
    extensions: { skills: [], hooks: { normalized: {} } }
  }))
}))
vi.mock('../../infra/ipc/send', () => ({
  sendChatEvent: (...args: unknown[]) => captured.sendChatEvent(...args)
}))
vi.mock('../../infra/log', () => ({
  getLogger: () => ({ child: () => ({ info: vi.fn() }) })
}))
vi.mock('./enqueue', () => ({
  enqueueTurnPrompt: vi.fn(() => ({
    preludes: [],
    mainBatch: { text: 'hello', uuid: 'batch-1', ids: ['req-1'], createdAt: 1 },
    initialBatches: []
  }))
}))
vi.mock('./turn-request', () => ({ buildTurnRequest: vi.fn(() => ({})) }))
vi.mock('./approval', () => ({ createApprovalRequester: vi.fn(() => vi.fn()) }))
vi.mock('./post-turn', () => ({ runTurnWithContinuations: vi.fn(async () => undefined) }))
vi.mock('../chat-turn-continuation', () => ({ prepareAutomaticContinuation: vi.fn() }))
vi.mock('../../features/chat/turn-coordinator', () => ({
  TurnCoordinator: class {
    constructor(deps: typeof captured.coordinatorDeps) {
      captured.coordinatorDeps = deps
    }
    register = vi.fn()
    run = vi.fn(async () => undefined)
  }
}))

import { handleChatSend } from './send'

describe('VP-03 k27 send.sinks', () => {
  it('조정자의 relay sink 는 저장 송신기 relay 로, forward sink 는 창 직접 전송으로 간다', async () => {
    captured.coordinatorDeps = null
    captured.sendChatEvent.mockReset()

    const persistenceRelay = vi.fn()
    const sender = fakeClient()
    const controller = new AbortController()
    const deps = {
      ctx: withDataPort({
        settings: { getAll: () => ({}) },
        db: {
          updateSessionProviderKey: vi.fn(),
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
            id: 'claude',
            agentSpawnEnv: vi.fn(() => ({})),
            complete: vi.fn(),
            classifyError: vi.fn((error) => error)
          })
        },
        getCwd: () => '/source/repo',
        ensureExtensionsDeployedForTurn: vi.fn(async () => undefined),
        extensions: { build: vi.fn(() => ({ skills: [], hooks: { normalized: {} } })) }
      }),
      supervisor: {
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
        startNew: vi.fn(),
        startResume: vi.fn(),
        release: vi.fn(),
        releaseChain: vi.fn(),
        releaseRuntime: vi.fn()
      },
      bus: {},
      approvals: {},
      persistence: { relay: persistenceRelay },
      permissionModes: { setMode: vi.fn() },
      pendingMessages: {
        cancelAllHeld: vi.fn(() => []),
        rollback: vi.fn(),
        orphanUnconfirmed: vi.fn(() => [])
      },
      backgroundTasks: {},
      activity: { setWaitPhase: vi.fn() },
      isUpdateInstallPending: () => false,
      background: { observe: vi.fn() },
      listenRelease: new Map(),
      worktrees: {
        hasManagedWorktree: () => false,
        prepare: vi.fn(),
        recoverMissingWorktree: vi.fn(async () => ({ kind: 'none' as const }))
      }
    } as unknown as Parameters<typeof handleChatSend>[0]

    await handleChatSend(
      deps,
      { sender, trusted: true } as unknown as Parameters<typeof handleChatSend>[1],
      {
        sessionId: 'sess-1',
        projectId: null,
        text: 'hello',
        clientRequestId: 'req-1'
      }
    )

    expect(captured.coordinatorDeps).not.toBeNull()
    const { forward, relay } = captured.coordinatorDeps!.forward

    const turn = {
      dbSessionId: 'sess-1',
      owner: sender,
      backend: 'claude',
      currentAssistantMessageId: null,
      currentAssistantText: ''
    } as unknown as TurnContext<ClientRef>
    const commitEv: NormalizedEvent = {
      type: 'message.committed',
      sessionId: 'sess-1',
      ids: ['c1'],
      text: 'hello',
      messageKey: 'u:c1',
      messageId: 1,
      createdAt: 1
    }
    const retryEv: NormalizedEvent = {
      type: 'turn.retrying',
      sessionId: 'sess-1',
      attempt: 1,
      maxRetries: 3,
      error: { category: 'stream_error', message: 'retry', retryable: true }
    }

    captured.sendChatEvent.mockClear()
    relay(turn, commitEv)
    expect(persistenceRelay).toHaveBeenCalledTimes(1)
    expect(persistenceRelay.mock.calls[0][0]).toBe(turn)
    expect(persistenceRelay.mock.calls[0][1]).toBe(commitEv)
    expect(captured.sendChatEvent).toHaveBeenCalledTimes(0)

    forward(sender, retryEv)
    expect(captured.sendChatEvent).toHaveBeenCalledTimes(1)
    expect(captured.sendChatEvent.mock.calls[0][0]).toBe(sender)
    expect(captured.sendChatEvent.mock.calls[0][1]).toBe(retryEv)
    expect(persistenceRelay).toHaveBeenCalledTimes(1)
  })
})
