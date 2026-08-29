import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  acquireTurnRuntime: vi.fn(),
  buildTurnContext: vi.fn(),
  buildTurnRequest: vi.fn((...args: [unknown, unknown]) => ({ args })),
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
// TurnRequest 조립(11단계)까지 도달시키려면 그 사이 8~10단계의 경계를 열어 둔다.
// 조립 자체는 production `send.ts` 가 하고, 여기서는 그 인자만 들여다본다.
vi.mock('./enqueue', () => ({
  enqueueTurnPrompt: vi.fn(() => ({
    preludes: [],
    mainBatch: { text: 'work', uuid: 'batch-1' },
    initialBatches: []
  }))
}))
vi.mock('./turn-request', () => ({ buildTurnRequest: mocks.buildTurnRequest }))
vi.mock('./approval', () => ({ createApprovalRequester: vi.fn(() => vi.fn()) }))
vi.mock('./post-turn', () => ({ runTurnWithContinuations: vi.fn(async () => undefined) }))
vi.mock('./turn-setup', () => ({ chatForward: vi.fn(), resolveTurnProvider: vi.fn() }))
vi.mock('../chat-turn-continuation', () => ({ prepareAutomaticContinuation: vi.fn() }))
vi.mock('../../features/chat/turn-coordinator', () => ({
  TurnCoordinator: class {
    beginApprovalPause = vi.fn()
    run = vi.fn()
  }
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
      getCwd: () => '/source/repo',
      ensureExtensionsDeployedForTurn: vi.fn(async () => undefined),
      extensions: { build: vi.fn(() => ({ mcp: {}, skills: [], hooks: { normalized: {} } })) }
    },
    supervisor,
    bus: {},
    approvals: {},
    persistence: {},
    permissionModes: {},
    pendingMessages: { cancelAllHeld: vi.fn(() => []), rollback: vi.fn() },
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

  it('managed cwd와 extraDirs가 TurnRequest 조립까지 그대로 간다', async () => {
    const harness = makeHarness()
    harness.deps.worktrees.prepare.mockResolvedValue({
      kind: 'managed',
      worktreeId: 'w1',
      executionCwd: '/managed/repo'
    })
    const runtime = { close: vi.fn(), channelAlive: true, markAborted: vi.fn() }
    mocks.acquireTurnRuntime.mockResolvedValue({
      ok: true,
      runtime,
      extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
    })

    await handleChatSend(harness.deps as never, { sender: harness.sender } as never, {
      text: 'work',
      worktreeIsolation: true,
      extraDirs: ['/shared'],
      attachmentViews: []
    })

    // EP-08 3번째 좌표 — 여기서 source cwd 로 되돌아가면 worktree 는 만들어지고 Agent 는
    // 원본 checkout 에서 돈다. buildTurnContext 단언만으로는 이 홉이 잡히지 않는다.
    expect(mocks.buildTurnRequest).toHaveBeenCalledOnce()
    expect(mocks.buildTurnRequest.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ cwd: '/managed/repo', extraDirs: ['/shared'] })
    )
  })

  it('turn이 계승한 extraDirs를 TurnRequest가 payload 대신 그대로 쓴다', async () => {
    const harness = makeHarness()
    harness.deps.worktrees.prepare.mockResolvedValue({
      kind: 'managed',
      worktreeId: 'w1',
      executionCwd: '/managed/repo'
    })
    // resume·continuity 는 payload 에 없는 참조 경로를 세션 메타에서 계승한다. 두 출처가
    // 같은 값이면 "어느 쪽을 읽는가" 를 구별할 수 없으므로 여기서만 갈라 둔다.
    mocks.buildTurnContext.mockImplementation((input) => ({
      cwd: input.payload.cwd,
      extraDirs: ['/inherited'],
      queueKey: 'new:1',
      dbSessionId: null
    }))
    const runtime = { close: vi.fn(), channelAlive: true, markAborted: vi.fn() }
    mocks.acquireTurnRuntime.mockResolvedValue({
      ok: true,
      runtime,
      extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
    })

    await handleChatSend(harness.deps as never, { sender: harness.sender } as never, {
      text: 'work',
      worktreeIsolation: true,
      attachmentViews: []
    })

    expect(mocks.buildTurnRequest.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ cwd: '/managed/repo', extraDirs: ['/inherited'] })
    )
  })

  it('준비가 거부되면 context·runtime·TurnRequest를 하나도 만들지 않는다', async () => {
    const harness = makeHarness()
    harness.deps.worktrees.prepare.mockResolvedValue({
      kind: 'rejected',
      reason: 'dirty',
      message: '커밋되지 않은 변경이 있습니다.'
    })

    await handleChatSend(harness.deps as never, { sender: harness.sender } as never, {
      text: 'work',
      worktreeIsolation: true,
      extraDirs: ['/shared'],
      attachmentViews: []
    })

    expect(mocks.buildTurnContext).not.toHaveBeenCalled()
    expect(mocks.acquireTurnRuntime).not.toHaveBeenCalled()
    expect(mocks.buildTurnRequest).not.toHaveBeenCalled()
    expect(mocks.startNew).not.toHaveBeenCalled()
    expect(mocks.sendChatEvent).toHaveBeenCalledWith(
      harness.sender,
      expect.objectContaining({ type: 'error' })
    )
  })

  it('runtime 인출 뒤 확보가 실패해도 그 핸들을 닫는다', async () => {
    const harness = makeHarness()
    harness.deps.worktrees.prepare.mockResolvedValue({
      kind: 'managed',
      worktreeId: 'w1',
      executionCwd: '/managed/repo'
    })
    const runtime = { close: vi.fn(), channelAlive: true, markAborted: vi.fn() }
    // 실제 acquireTurnRuntime 과 같은 형상 — 인출 즉시 공개하고 그 뒤에서 실패한다.
    mocks.acquireTurnRuntime.mockImplementation(
      async (deps: { onRuntimeAcquired?: (r: unknown) => void }) => {
        deps.onRuntimeAcquired?.(runtime)
        throw new Error('extensions unavailable')
      }
    )

    await handleChatSend(harness.deps as never, { sender: harness.sender } as never, {
      text: 'work',
      worktreeIsolation: true,
      extraDirs: ['/shared'],
      attachmentViews: []
    })

    expect(runtime.close).toHaveBeenCalledOnce()
    expect(mocks.release).toHaveBeenCalledOnce()
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
