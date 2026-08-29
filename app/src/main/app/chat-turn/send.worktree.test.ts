import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  acquireTurnRuntime: vi.fn(),
  buildTurnContext: vi.fn(),
  sendChatEvent: vi.fn(),
  startNew: vi.fn(),
  startResume: vi.fn(),
  release: vi.fn()
}))

vi.mock('../../features/chat/attachments', () => ({
  normalizeAttachments: vi.fn(async () => ({}))
}))
vi.mock('./admission', () => ({
  admitChatSend: vi.fn(({ raw }) => ({ ok: true, data: raw })),
  attachmentFailure: vi.fn(),
  foreignPreparingLease: vi.fn(),
  leaseKeyFor: vi.fn(() => ({ provisionalKey: 'new:1', logicalKey: 'new:1' }))
}))
vi.mock('./resolve-turn', () => ({
  resolveTurn: vi.fn(async (_ctx, _supervisor, _adapter, payload) => ({
    ok: true,
    value: {
      continuitySource: null,
      continuityMeta: null,
      continuityLang: null,
      resolved: {
        prepared: { providerSettings: { snapshot: true }, env: { SNAPSHOT: 'yes' } }
      },
      sessionMeta: null,
      boundProjectId: null,
      effectiveText: payload.text
    }
  }))
}))
vi.mock('./turn-context', () => ({ buildTurnContext: mocks.buildTurnContext }))
vi.mock('./runtime-entry', () => ({ acquireTurnRuntime: mocks.acquireTurnRuntime }))
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: mocks.sendChatEvent }))
vi.mock('../../infra/log', () => ({
  getLogger: () => ({ child: () => ({ info: vi.fn() }) })
}))

import { handleChatSend } from './send'

// Test-only structural fixture is intentionally inferred so its spies retain their precise signatures.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeHarness(sessionId?: string) {
  const controller = new AbortController()
  const turn = {
    cwd: '/managed/repo',
    extraDirs: ['/shared'],
    queueKey: 'new:1',
    dbSessionId: sessionId ?? null
  }
  mocks.buildTurnContext.mockImplementation((input) => {
    turn.cwd = input.payload.cwd
    turn.extraDirs = input.payload.extraDirs
    return turn
  })

  const supervisor = {
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
    releaseChain: vi.fn()
  }
  const sender = {
    once: vi.fn(),
    removeListener: vi.fn()
  }
  const deps = {
    ctx: {
      mockAdapter: null,
      debugMock: { enabled: false },
      registry: {
        getActive: () => ({
          id: 'adapter',
          complete: vi.fn(),
          classifyError: vi.fn((error) => error)
        })
      },
      getCwd: () => '/source/repo'
    },
    supervisor,
    bus: {},
    approvals: {},
    persistence: {},
    permissionModes: {},
    pendingMessages: { cancelAllHeld: vi.fn(() => []) },
    backgroundTasks: {},
    activity: {},
    isUpdateInstallPending: () => false,
    reserveOnBusySession: vi.fn(),
    settleDeadBackgroundTasks: vi.fn(),
    worktrees: { prepare: vi.fn() }
  }

  return { deps, sender, supervisor, turn }
}

describe('handleChatSend worktree production wiring', () => {
  beforeEach(() => vi.clearAllMocks())

  it('준비 완료 전에는 context/runtime을 만들지 않고 managed cwd와 extraDirs를 runtime까지 전달한다', async () => {
    const harness = makeHarness()
    let finish!: (value: { kind: 'managed'; worktreeId: string; executionCwd: string }) => void
    harness.deps.worktrees.prepare.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    mocks.acquireTurnRuntime.mockResolvedValue({ ok: false, runtime: { close: vi.fn() } })

    const result = handleChatSend(harness.deps as never, { sender: harness.sender } as never, {
      text: 'work',
      worktreeIsolation: true,
      extraDirs: ['/shared'],
      attachmentViews: []
    })
    await vi.waitFor(() => expect(harness.deps.worktrees.prepare).toHaveBeenCalledOnce())

    expect(mocks.buildTurnContext).not.toHaveBeenCalled()
    expect(mocks.acquireTurnRuntime).not.toHaveBeenCalled()

    finish({ kind: 'managed', worktreeId: 'w1', executionCwd: '/managed/repo' })
    await result

    expect(mocks.buildTurnContext).toHaveBeenCalledWith(
      expect.objectContaining({
        titleSettings: { snapshot: true },
        titleEnv: { SNAPSHOT: 'yes' },
        payload: expect.objectContaining({ cwd: '/managed/repo', extraDirs: ['/shared'] })
      })
    )
    expect(mocks.acquireTurnRuntime).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cwd: '/managed/repo', extraDirs: ['/shared'] }),
      expect.anything()
    )
  })

  it.each([
    { label: 'new', sessionId: undefined },
    { label: 'resume', sessionId: 'session-1' }
  ])('runtime 확보가 실패해도 $label turn을 정확히 한 번 반납한다', async ({ sessionId }) => {
    const harness = makeHarness(sessionId)
    harness.deps.worktrees.prepare.mockResolvedValue({
      kind: 'managed',
      worktreeId: 'w1',
      executionCwd: '/managed/repo'
    })
    mocks.acquireTurnRuntime.mockRejectedValue(new Error('runtime unavailable'))

    await handleChatSend(harness.deps as never, { sender: harness.sender } as never, {
      text: 'work',
      worktreeIsolation: sessionId === undefined,
      ...(sessionId ? { sessionId } : {}),
      extraDirs: ['/shared'],
      attachmentViews: []
    })

    if (sessionId) {
      expect(mocks.startResume).toHaveBeenCalledOnce()
      expect(mocks.startNew).not.toHaveBeenCalled()
    } else {
      expect(mocks.startNew).toHaveBeenCalledOnce()
      expect(mocks.startResume).not.toHaveBeenCalled()
    }
    expect(mocks.release).toHaveBeenCalledOnce()
    expect(mocks.release).toHaveBeenCalledWith(harness.turn)
  })
})
