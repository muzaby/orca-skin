import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  },
  // 0215 — 이 턴이 실제로 쓰는 SDK 모델 문자열. main 은 alias 를 갖지 않으므로 보정의 유일한 입력이다.
  resolvedModel: { value: undefined as string | undefined }
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
        prepared: { providerSettings: { snapshot: true }, env: { SNAPSHOT: 'yes' } },
        model: mocks.resolvedModel.value
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
import { normalizeAttachments } from '../../features/chat/attachments'
import { enqueueTurnPrompt } from './enqueue'

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

// 0215 VP-14 (SD-03 ↔ AT-14 · §10 EP-15) — haiku + `auto_classified` 는 main 에서도 보정된다.
//
// **두 지점이 같은 값을 읽는가**가 계약이다. controller 기록(`send.ts` 세션 SSOT 동기화)과
// TurnRequest 조립이 각각 `payload.permissionMode` 를 따로 읽으면 한쪽만 고쳐졌을 때
// "controller 는 편집 자동 수락, SDK 세션은 auto" 가 된다.
describe('handleChatSend — 지원하지 않는 권한 모드 보정 (AT-14)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sessionMeta.value = null
    mocks.resolvedModel.value = undefined
    vi.mocked(normalizeAttachments).mockResolvedValue({
      attachmentTexts: [],
      attachmentImages: []
    })
    vi.mocked(enqueueTurnPrompt).mockReturnValue({
      preludes: [],
      mainBatch: { text: 'work', uuid: 'batch-1', ids: ['req-1'], createdAt: 1 },
      initialBatches: []
    })
  })

  const run = async (
    model: string | undefined,
    permissionMode: 'auto_classified' | 'plan'
  ): Promise<{ setMode: ReturnType<typeof vi.fn>; requestMode: unknown }> => {
    const harness = makeHarness('session-1')
    const setMode = vi.fn()
    harness.deps.permissionModes = { setMode } as never
    mocks.resolvedModel.value = model
    mocks.acquireTurnRuntime.mockResolvedValue({
      ok: true,
      runtime: { close: vi.fn(), channelAlive: true, markAborted: vi.fn() },
      extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
    })

    await handleChatSend(harness.deps as never, { sender: harness.sender } as never, {
      sessionId: 'session-1',
      text: 'work',
      permissionMode,
      attachmentViews: []
    })
    const call = mocks.buildTurnRequest.mock.calls.at(-1)
    return { setMode, requestMode: (call?.[1] as { permissionMode?: unknown })?.permissionMode }
  }

  it('haiku 면 두 지점이 모두 accept_edits 를 읽는다', async () => {
    const { setMode, requestMode } = await run('claude-haiku-4-5', 'auto_classified')
    expect(setMode).toHaveBeenCalledWith('session-1', 'accept_edits')
    expect(requestMode).toBe('accept_edits')
  })

  it('비-haiku 는 두 지점이 모두 원래 모드를 읽는다 — 양성 짝', async () => {
    const { setMode, requestMode } = await run('claude-sonnet-4-6', 'auto_classified')
    expect(setMode).toHaveBeenCalledWith('session-1', 'auto_classified')
    expect(requestMode).toBe('auto_classified')
  })

  it('auto 가 아닌 모드는 haiku 에서도 그대로다', async () => {
    const { setMode, requestMode } = await run('claude-haiku-4-5', 'plan')
    expect(setMode).toHaveBeenCalledWith('session-1', 'plan')
    expect(requestMode).toBe('plan')
  })

  it('모델 미해석이면 손대지 않는다 — 판정 불가를 강등으로 바꾸지 않는다', async () => {
    const { setMode, requestMode } = await run(undefined, 'auto_classified')
    expect(setMode).toHaveBeenCalledWith('session-1', 'auto_classified')
    expect(requestMode).toBe('auto_classified')
  })
})
