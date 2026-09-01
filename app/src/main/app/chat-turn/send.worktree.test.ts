import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiffRequirementAnchor } from '../../../shared/ipc'

const mocks = vi.hoisted(() => ({
  acquireTurnRuntime: vi.fn(),
  buildTurnContext: vi.fn(),
  buildTurnRequest: vi.fn((...args: [unknown, unknown]) => ({ args })),
  sendChatEvent: vi.fn(),
  startNew: vi.fn(),
  startResume: vi.fn(),
  release: vi.fn(),
  // resume 턴의 세션행. `null` 이면 신규 세션 축이다. 0210 은 이 값이 `payload.cwd` 와 **다를 때**
  // 어느 쪽을 읽는지가 계약이라, 두 출처가 같은 값이면 그 계약을 구별할 수 없다.
  sessionMeta: {
    value: null as { cwd: string | null; project_id: string | null; provider_key: null } | null
  }
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
      sessionMeta: mocks.sessionMeta.value,
      boundProjectId: null,
      effectiveText: payload.text
    }
  }))
}))
// `resolveTurnCwd` 는 **진짜**를 쓴다 — 0210 이 resume 준비 입력을 이 함수로 정하므로 stub 으로
// 대체하면 그 규칙이 하네스 안에서 사라진다. 조립부(`buildTurnContext`)만 spy 로 갈아 끼운다.
vi.mock('./turn-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./turn-context')>()),
  buildTurnContext: mocks.buildTurnContext
}))
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

const requirement = (overrides: Partial<DiffRequirementAnchor> = {}): DiffRequirementAnchor => ({
  sessionId: 'session-1',
  baselineCommit: '3486398aecbc2b97e42d3dba1aae8d13b18d186c',
  filePath: 'app/src/main/adapters/claude.ts',
  oldLine: 10,
  newLine: 14,
  hunkHeader: '@@ -10,2 +14,3 @@',
  contextBefore: ['before'],
  contextAfter: ['after'],
  comment: '요구사항',
  createdAt: 1_725_000_000_000,
  ...overrides
})

// `WorktreeService.recoverMissingWorktree` 의 반환 union. 하네스 기본값을 갈아끼우려면 넓은
// 타입이어야 한다 — `{kind:'none'}` 으로 좁히면 `mockResolvedValue` 가 다른 갈래를 거부한다.
type Recovery =
  | { kind: 'none' }
  | { kind: 'recovered'; executionCwd: string; lostWorktreeRoot: string }
  | { kind: 'unrecoverable'; lostWorktreeRoot: string }

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
    // production `buildTurnContext` 는 `resolveTurnExtraDirs` 로 **항상 배열**을 만든다.
    // 여기서 undefined 를 그대로 흘리면 하네스가 계약보다 느슨해진다.
    turn.extraDirs = input.payload.extraDirs ?? []
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
    releaseChain: vi.fn(),
    // resume 축은 신규 축보다 정리 경로가 길다 — 세션 id 가 있어야 도달하는 반납이 둘 더 있다.
    releaseRuntime: vi.fn()
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
    // `orphanUnconfirmed` 는 `finalSessionId` 가 있을 때만 도달하는 정리 지점이라(`send.ts:420`)
    // 신규 세션 케이스만 있던 동안에는 부재가 드러나지 않았다.
    pendingMessages: {
      cancelAllHeld: vi.fn(() => []),
      rollback: vi.fn(),
      orphanUnconfirmed: vi.fn(() => [])
    },
    backgroundTasks: {},
    activity: {},
    isUpdateInstallPending: () => false,
    reserveOnBusySession: vi.fn(),
    settleDeadBackgroundTasks: vi.fn(),
    // 0210 — resume 턴은 준비 전에 worktree 소실을 먼저 판정한다. 기본값은 '살아 있다'.
    worktrees: {
      prepare: vi.fn(),
      recoverMissingWorktree: vi.fn(async (): Promise<Recovery> => ({ kind: 'none' }))
    }
  }

  return { deps, sender, supervisor, turn }
}

describe('handleChatSend worktree production wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sessionMeta.value = null
  })

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

  it('requirements 가 직접 send 에서 TurnRequest 조립까지 그대로 간다', async () => {
    const harness = makeHarness()
    mocks.acquireTurnRuntime.mockResolvedValue({
      ok: true,
      runtime: { close: vi.fn(), channelAlive: true, markAborted: vi.fn() },
      extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
    })
    const requirements = [requirement()]

    await handleChatSend(harness.deps as never, { sender: harness.sender } as never, {
      text: 'work',
      requirements,
      attachmentViews: []
    })

    expect(mocks.buildTurnRequest).toHaveBeenCalledOnce()
    expect(mocks.buildTurnRequest.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ requirements })
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

  it('격리 준비가 거부돼도 다음 비격리 send 는 그대로 진행한다 (AC14)', async () => {
    const rejected = makeHarness()
    rejected.deps.worktrees.prepare.mockResolvedValue({
      kind: 'rejected',
      reason: 'not-repo',
      message: 'Git 저장소가 아닙니다.'
    })
    await handleChatSend(rejected.deps as never, { sender: rejected.sender } as never, {
      text: 'work',
      worktreeIsolation: true,
      attachmentViews: []
    })
    expect(mocks.buildTurnRequest).not.toHaveBeenCalled()

    // 같은 앱에서 이어지는 다음 턴 — 격리를 끄면 준비를 부르지도 않고 끝까지 간다.
    const next = makeHarness()
    const runtime = { close: vi.fn(), channelAlive: true, markAborted: vi.fn() }
    mocks.acquireTurnRuntime.mockResolvedValue({
      ok: true,
      runtime,
      extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
    })
    await handleChatSend(next.deps as never, { sender: next.sender } as never, {
      text: 'plain',
      attachmentViews: []
    })

    expect(next.deps.worktrees.prepare).not.toHaveBeenCalled()
    expect(mocks.buildTurnRequest).toHaveBeenCalledOnce()
    expect(mocks.buildTurnRequest.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ cwd: '/source/repo' })
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

// 0210 폴백의 **send 층 배선** — verify r2 D1·D2 가 연 자리다.
//
// `prepare-worktree.test.ts` 는 `prepareTurnWorktree` 안쪽(갈래 선택·통지 콜백 호출·respawn 전달)을,
// `worktree-recover.test.ts` 는 DB 두 쓰기를 잠근다. 그 둘 사이에 **send.ts 가 소유한 홉 셋**이
// 있고 r2 까지는 어느 것도 관측되지 않았다 — 지워도 스위트가 전건 green 이었다.
//
//  ① 판정 입력    `resolveTurnCwd` 로 확정한 세션행 경로 (payload.cwd 가 아니다)
//  ② 통지         `session.updated{patch.cwd}` 방출 (EP-17 세 번째 쓰기)
//  ③ 재조립 입력  `sessionMeta.cwd` 를 확정 경로로 덮기 (안 덮으면 죽은 경로가 되살아난다)
//
// 세 홉은 **세션행 cwd 와 payload.cwd 가 다를 때만** 구별된다. 하네스가 둘을 갈라 두는 이유다.
describe('handleChatSend — worktree 소실 폴백의 send 층 배선 (AC12 · AC17)', () => {
  const LOST = '/wt/repo-1234abcd/work-x'
  const SOURCE = '/source/repo'

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sessionMeta.value = { cwd: LOST, project_id: null, provider_key: null }
    mocks.acquireTurnRuntime.mockResolvedValue({
      ok: true,
      runtime: { close: vi.fn(), channelAlive: true, markAborted: vi.fn() },
      extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
    })
  })

  async function resumeSend(
    harness: ReturnType<typeof makeHarness>,
    recovery: Recovery
  ): Promise<void> {
    harness.deps.worktrees.recoverMissingWorktree.mockResolvedValue(recovery)
    await handleChatSend(harness.deps as never, { sender: harness.sender } as never, {
      text: 'work',
      sessionId: 'session-1',
      // 세션행과 **다른** 값을 일부러 싣는다. 이 값을 읽는 구현은 소실을 지나친다.
      cwd: '/payload/elsewhere',
      attachmentViews: []
    })
  }

  it('① 소실 판정 입력이 세션행이 잠근 실행 경로다 — payload.cwd 가 아니다', async () => {
    const harness = makeHarness('session-1')

    await resumeSend(harness, { kind: 'recovered', executionCwd: SOURCE, lostWorktreeRoot: LOST })

    expect(harness.deps.worktrees.recoverMissingWorktree).toHaveBeenCalledWith({
      sessionId: 'session-1',
      executionCwd: LOST
    })
  })

  it('② 폴백이 session.updated 로 화면까지 나간다 — DB 두 쓰기 뒤의 세 번째 쓰기다', async () => {
    const harness = makeHarness('session-1')

    await resumeSend(harness, { kind: 'recovered', executionCwd: SOURCE, lostWorktreeRoot: LOST })

    expect(mocks.sendChatEvent).toHaveBeenCalledWith(harness.sender, {
      type: 'session.updated',
      sessionId: 'session-1',
      patch: { cwd: SOURCE, worktree: null }
    })
    // 폴백은 오류가 아니다 — 같은 턴에서 error 이벤트가 나가면 화면이 두 말을 한다(AC13).
    for (const [, event] of mocks.sendChatEvent.mock.calls as Array<[unknown, { type: string }]>)
      expect(event.type).not.toBe('error')
  })

  it('③ 재조립이 확정 경로를 쓴다 — 세션행 사본을 덮지 않으면 죽은 경로가 되살아난다', async () => {
    const harness = makeHarness('session-1')

    await resumeSend(harness, { kind: 'recovered', executionCwd: SOURCE, lostWorktreeRoot: LOST })

    // `buildTurnContext` 의 `resolveTurnCwd` 는 resume 에서 세션행을 우선한다. 사본이 옛 경로면
    // 조립 결과가 다시 LOST 가 되고, 그 값이 그대로 spawn 인자가 된다.
    expect(mocks.buildTurnContext).toHaveBeenCalledWith(
      expect.objectContaining({ sessionMeta: expect.objectContaining({ cwd: SOURCE }) })
    )
    expect(mocks.buildTurnRequest.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ cwd: SOURCE })
    )
  })

  it('폴백 사실이 runtime 확보까지 간다 — 살아 있는 채널을 내리는 유일한 신호다 (AC14)', async () => {
    const harness = makeHarness('session-1')

    await resumeSend(harness, { kind: 'recovered', executionCwd: SOURCE, lostWorktreeRoot: LOST })

    expect(mocks.acquireTurnRuntime).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ executionCwdRecovered: true })
    )
  })

  it('worktree 가 살아 있으면 아무것도 통지하지 않고 세션행 경로를 그대로 쓴다 (AC19)', async () => {
    const harness = makeHarness('session-1')

    await resumeSend(harness, { kind: 'none' })

    expect(mocks.sendChatEvent).not.toHaveBeenCalled()
    expect(mocks.buildTurnContext).toHaveBeenCalledWith(
      expect.objectContaining({ sessionMeta: expect.objectContaining({ cwd: LOST }) })
    )
    expect(mocks.acquireTurnRuntime).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ executionCwdRecovered: false })
    )
  })

  it('원본까지 사라지면 오류로 접고 턴을 만들지 않는다', async () => {
    const harness = makeHarness('session-1')

    await resumeSend(harness, { kind: 'unrecoverable', lostWorktreeRoot: LOST })

    expect(mocks.buildTurnContext).not.toHaveBeenCalled()
    expect(mocks.buildTurnRequest).not.toHaveBeenCalled()
    expect(mocks.sendChatEvent).toHaveBeenCalledWith(
      harness.sender,
      expect.objectContaining({ type: 'error' })
    )
  })
})
