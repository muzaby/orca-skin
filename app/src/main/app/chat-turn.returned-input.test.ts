// 0301 ΔV1·ΔV2 VP-16 — 시작 단계에서 보내지 못한 턴 입력의 회수(§10 J′ · J1 · D-017).
// `chat:send` 실제 핸들러 + 실제 TurnCoordinator·SessionRuntime·PendingMessageQueue 를 잇는다.
// held 상태가 판정 입력이라 큐는 mock 하지 않는다. SDK 경계(adapter.sendMessage)만 대체한다.
import type { WebContents } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHANNELS, type NormalizedEvent } from '../../shared/ipc'
import type { TurnRequest } from '../adapters/common/turn'
import type { LiveTurn, ProviderMessageBatch } from '../adapters/common/types'
import { OpenCodeAdapter } from '../adapters/opencode/v1/adapter'
import { PermissionModeController } from '../features/approvals/permission-mode-controller'
import { BackgroundTaskTracker } from '../features/chat/background-tasks'
import { PendingMessageQueue } from '../features/chat/pending-message-queue'
import { createHarnessRuntimeConfigService } from '../features/harnesses/common/runtime-config'
import { createRuntimeModelCatalog } from '../features/harnesses/common/runtime-catalog'
import { SessionRuntime } from '../features/sessions/session-runtime'
import { RuntimeSupervisor } from '../features/sessions/supervisor'
import { makeClassifiedError } from '../infra/errors'
import { RUNTIME_MODEL_CONTRIBUTIONS } from './deployment/harness-runtime'
import { createHarnessSettingsService, parseHarnessRuntimeModels } from './harnesses/registry'

const harness = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, raw: unknown) => Promise<unknown>>(),
  events: [] as Array<{ type: string; sessionId?: string; ids?: string[]; error?: unknown }>
}))

vi.mock('../infra/git/probe', async (original) => ({
  ...(await original<typeof import('../infra/git/probe')>()),
  probeRepo: vi.fn(async () => ({ kind: 'not-repo' as const }))
}))
vi.mock('electron', () => ({
  BrowserWindow: {},
  Notification: {},
  webContents: { getAllWebContents: () => [] },
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
  sendChatEvent: vi.fn((_owner: unknown, event: (typeof harness.events)[number]) => {
    harness.events.push(event)
  })
}))

import { registerChatHandlers } from './chat-turn'

const document = {
  provider: {
    local: {
      npm: '@ai-sdk/openai-compatible',
      options: { baseURL: 'https://local.test/v1' },
      models: { first: { name: 'First' } }
    }
  }
}

let root = ''
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
  root = ''
})

function liveTurn(onIterate: () => NormalizedEvent[]): LiveTurn {
  return {
    eventBatches: (async function* (): AsyncGenerator<ProviderMessageBatch> {
      yield { sequence: 0, events: onIterate() }
    })(),
    close: () => {},
    interrupt: vi.fn(async () => undefined),
    setPermissionMode: async () => {},
    setModel: async () => {},
    stopTask: async () => {},
    backgroundTask: async () => false
  }
}

const answer = (sessionId: string): NormalizedEvent[] => [
  { type: 'message.delta', sessionId, delta: { text: 'answer' } },
  { type: 'telemetry', sessionId }
]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function install() {
  harness.handlers.clear()
  harness.events.length = 0
  root = mkdtempSync(join(tmpdir(), 'orcinus-orca-returned-input-'))
  const directory = join(root, 'sources', 'settings', 'opencode', 'local')
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'settings.json'), JSON.stringify(document))
  const adapter = new OpenCodeAdapter(
    { acquire: vi.fn(), installed: vi.fn(), close: vi.fn() } as never,
    vi.fn()
  )
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
  const sendMessage = vi.fn<(request: TurnRequest) => LiveTurn>(() => {
    throw new Error('sendMessage was not scripted')
  })
  const newRuntime = (): SessionRuntime =>
    new SessionRuntime({
      id: 'opencode',
      sendMessage,
      complete: async () => '',
      classifyError: (error) => makeClassifiedError('stream_error', String(error))
    })
  // 실제 supervisor — 진행 중 체인에 같은 세션으로 보낸 입력이 busy 예약이 되려면 lease 가 실재해야
  // 한다. 런타임 생성만 SDK 경계(sendMessage)를 가진 SessionRuntime 으로 바꾼다.
  const supervisor = new RuntimeSupervisor<WebContents>()
  const acquire = supervisor.acquireRuntime.bind(supervisor)
  vi.spyOn(supervisor, 'acquireRuntime').mockImplementation(((sessionId: string | null) =>
    acquire(sessionId, newRuntime)) as typeof supervisor.acquireRuntime)
  // A known runtime means the saved conversation needs no native history read.
  const peek = supervisor.peekRuntime.bind(supervisor)
  vi.spyOn(supervisor, 'peekRuntime').mockImplementation(
    (sessionId) => peek(sessionId) ?? (sessionId === 's1' ? newRuntime() : undefined)
  )
  const pendingMessages = new PendingMessageQueue()
  registerChatHandlers({
    ctx: {
      mockAdapter: null,
      debugMock: { enabled: false },
      registry: { getActive: () => adapter, get: () => adapter },
      harnessSettings,
      harnessRuntime,
      runtimeModelCatalog,
      db: {
        updateSessionProviderKey: vi.fn(),
        getSessionById: (id: string) =>
          id === 's1' || id === 'n1'
            ? {
                backend: 'opencode',
                agent_kind: 'code',
                provider_key: 'opencode-local',
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
    supervisor,
    // history 구독자(`features/history/writer.ts`)가 session.updated 에서 세션 ID 를 턴에 싣는다 —
    // 영속 대신 그 한 효과만 대신한다.
    bus: {
      emit: vi.fn(
        (_name: string, payload: { turn: { dbSessionId: string | null }; ev: NormalizedEvent }) => {
          if (payload.ev.type === 'session.updated') payload.turn.dbSessionId = payload.ev.sessionId
        }
      )
    },
    approvals: { isSessionAllowed: vi.fn(), register: vi.fn() },
    persistence: {
      persist: vi.fn(),
      flushAskAnswers: vi.fn(),
      finalizeTurn: vi.fn(),
      commitUserMessage: vi.fn(() => 1)
    },
    permissionModes: new PermissionModeController(),
    pendingMessages,
    backgroundTasks: new BackgroundTaskTracker(),
    activity: {
      setTransport: vi.fn(),
      setResidualAttempts: vi.fn(),
      setWaitPhase: vi.fn(),
      setSchedules: vi.fn(),
      clear: vi.fn()
    },
    isUpdateInstallPending: () => false,
    worktrees: {
      hasManagedWorktree: () => false,
      prepare: vi.fn(),
      recoverMissingWorktree: vi.fn(async () => ({ kind: 'none' }))
    }
  } as never)
  return { sendMessage, pendingMessages, supervisor }
}

async function send(payload: Record<string, unknown>): Promise<void> {
  const handler = harness.handlers.get(CHANNELS.chatSend)
  if (!handler) throw new Error('chat send handler was not registered')
  await handler(
    { sender: { isDestroyed: () => false, once: vi.fn(), on: vi.fn(), removeListener: vi.fn() } },
    {
      projectId: null,
      agentKind: 'code',
      providerKey: 'opencode-local',
      modelFamily: null,
      ...payload
    }
  )
}

const cancelled = (): Array<{ sessionId?: string; ids?: string[] }> =>
  harness.events.filter((event) => event.type === 'message.cancelled')
const errors = (): unknown[] =>
  harness.events.filter((event) => event.type === 'error').map((event) => event.error)

describe('chat:send returns an input that never left the start phase (0301 D-017 · §10 J′)', () => {
  it('J(i) a stored session takes the input back and does not send it with the next message', async () => {
    const f = install()
    f.sendMessage.mockImplementationOnce(() => {
      throw new Error('원래-오류')
    })
    await send({ sessionId: 's1', text: '질문-가', clientRequestId: 'req-1' })

    expect(errors()).toHaveLength(1)
    expect(String((errors()[0] as { message: string }).message)).toContain('원래-오류')
    expect(cancelled()).toEqual([{ type: 'message.cancelled', sessionId: 's1', ids: ['req-1'] }])
    expect(f.pendingMessages.pending('s1')).toEqual([])
    expect(f.sendMessage).toHaveBeenCalledTimes(1)

    f.sendMessage.mockImplementationOnce(() => liveTurn(() => answer('s1')))
    await send({ sessionId: 's1', text: '질문-나', clientRequestId: 'req-2' })

    expect(f.sendMessage).toHaveBeenCalledTimes(2)
    const prompt = f.sendMessage.mock.calls[1]![0]
    expect(prompt.text).toContain('질문-나')
    expect(
      [prompt.text, ...(prompt.preludes ?? []).map((batch) => batch.text)].join('\n')
    ).not.toContain('질문-가')
    expect(cancelled()).toHaveLength(1)
  })

  it('J(ii) a new conversation takes the input back without telling the renderer', async () => {
    const f = install()
    f.sendMessage.mockImplementationOnce(() => {
      throw new Error('원래-오류')
    })
    await send({ sessionId: null, backend: 'opencode', text: '질문-다', clientRequestId: 'req-3' })

    expect(errors()).toHaveLength(1)
    expect(cancelled()).toEqual([])
    expect(f.pendingMessages.pending('req-3')).toEqual([])
    expect(f.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('J(iii) a turn that finished normally takes nothing back', async () => {
    const f = install()
    f.sendMessage.mockImplementationOnce(() => liveTurn(() => answer('s1')))
    await send({ sessionId: 's1', text: '질문-라', clientRequestId: 'req-4' })

    expect(errors()).toEqual([])
    expect(cancelled()).toEqual([])
    expect(f.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('J(iv) a flush turn that fails synchronously takes back its own flush input', async () => {
    const f = install()
    f.sendMessage.mockImplementationOnce(() =>
      liveTurn(() => {
        // 응답 중 예약 — 진행 중 체인에 같은 세션으로 보낸 입력은 held 로 적재된다.
        void send({ sessionId: 's1', text: '예약-마', clientRequestId: 'req-5' })
        return answer('s1')
      })
    )
    f.sendMessage.mockImplementationOnce(() => {
      throw new Error('원래-오류')
    })
    await send({ sessionId: 's1', text: '질문-바', clientRequestId: 'req-6' })
    await vi.waitFor(() => expect(cancelled()).toHaveLength(1))

    expect(f.sendMessage).toHaveBeenCalledTimes(2)
    expect(f.sendMessage.mock.calls[1]![0].text).toContain('예약-마')
    expect(cancelled()).toEqual([{ type: 'message.cancelled', sessionId: 's1', ids: ['req-5'] }])
    expect(f.pendingMessages.pending('s1')).toEqual([])
  })
  it('J(v) a new conversation that got its session id takes back under that id', async () => {
    const f = install()
    f.sendMessage.mockImplementationOnce(() => ({
      ...liveTurn(() => []),
      eventBatches: (async function* (): AsyncGenerator<ProviderMessageBatch> {
        yield { sequence: 0, events: [{ type: 'session.updated', sessionId: 'n1', patch: {} }] }
        // 세션 ID 를 받은 renderer 가 그 ID 로 응답 중 예약한다.
        await send({ sessionId: 'n1', text: '예약-사', clientRequestId: 'req-8' })
        yield { sequence: 1, events: answer('n1') }
      })()
    }))
    f.sendMessage.mockImplementationOnce(() => {
      throw new Error('원래-오류')
    })
    await send({ sessionId: null, backend: 'opencode', text: '질문-아', clientRequestId: 'req-7' })
    await vi.waitFor(() => expect(cancelled()).toHaveLength(1))

    expect(f.sendMessage).toHaveBeenCalledTimes(2)
    expect(cancelled()).toEqual([{ type: 'message.cancelled', sessionId: 'n1', ids: ['req-8'] }])
    expect(f.pendingMessages.pending('n1')).toEqual([])
    expect(f.pendingMessages.pending('req-7')).toEqual([])
  })

  it('J(vi) a merged flush batch returns every reserved id in input order', async () => {
    const f = install()
    let endChannel!: () => void
    const channelEnd = new Promise<void>((resolve) => {
      endChannel = resolve
    })
    const pushTurn = vi.fn<NonNullable<LiveTurn['pushTurn']>>()
    let queuedBoth = false
    // 채널 생존 중 reserveHeld가 두 예약을 한 배치로 합친 뒤 채널을 내린다.
    // 그 배치를 새 spawn이 보내다 동기 실패하는 경로이며, 큐·런타임은 실제 구현이다.
    const unsubscribe = f.pendingMessages.subscribe(() => {
      if (queuedBoth && f.pendingMessages.pending('s1').length === 0) {
        queuedBoth = false
        ;(f.supervisor.peekRuntime('s1') as SessionRuntime).teardownChannel()
      }
    })
    f.sendMessage.mockImplementationOnce(() => ({
      ...liveTurn(() => []),
      close: endChannel,
      pushTurn,
      eventBatches: (async function* (): AsyncGenerator<ProviderMessageBatch> {
        await send({ sessionId: 's1', text: '예약-가1', clientRequestId: 'req-a' })
        await send({ sessionId: 's1', text: '예약-가2', clientRequestId: 'req-b' })
        queuedBoth = true
        yield { sequence: 0, events: answer('s1') }
        await channelEnd
      })()
    }))
    f.sendMessage.mockImplementationOnce(() => {
      throw new Error('원래-오류')
    })
    try {
      await send({ sessionId: 's1', text: '질문-처음', clientRequestId: 'req-10' })
    } finally {
      unsubscribe()
      endChannel()
    }

    expect(f.sendMessage).toHaveBeenCalledTimes(2)
    expect(pushTurn).not.toHaveBeenCalled()
    const flush = f.sendMessage.mock.calls[1]![0]
    expect(flush.text).toContain('예약-가1\n\n예약-가2')
    expect(flush.preludes ?? []).toEqual([])
    expect(errors()).toHaveLength(1)
    expect(String((errors()[0] as { message: string }).message)).toContain('원래-오류')
    expect(cancelled()).toEqual([
      { type: 'message.cancelled', sessionId: 's1', ids: ['req-a', 'req-b'] }
    ])
    expect(f.pendingMessages.pending('s1')).toEqual([])

    f.sendMessage.mockImplementationOnce(() => liveTurn(() => answer('s1')))
    await send({ sessionId: 's1', text: '질문-다음', clientRequestId: 'req-after-flush' })

    expect(f.sendMessage).toHaveBeenCalledTimes(3)
    const next = f.sendMessage.mock.calls[2]![0]
    expect(next.text).toContain('질문-다음')
    const nextInput = [next.text, ...(next.preludes ?? []).map((batch) => batch.text)].join('\n')
    expect(nextInput).not.toContain('예약-가1')
    expect(nextInput).not.toContain('예약-가2')
    expect(cancelled()).toHaveLength(1)
    expect(errors()).toHaveLength(1)
  })

  it('J(vii) a cold spawn returns both the carried prelude and the main batch in order', async () => {
    const f = install()
    f.pendingMessages.enqueue('s1', { text: '대기-자' }, undefined, 'p-9')
    f.sendMessage.mockImplementationOnce(() => {
      throw new Error('원래-오류')
    })
    await send({ sessionId: 's1', text: '질문-차', clientRequestId: 'req-11' })

    expect(f.sendMessage).toHaveBeenCalledTimes(1)
    const first = f.sendMessage.mock.calls[0]![0]
    expect(first.preludes).toEqual([expect.objectContaining({ ids: ['p-9'], text: '대기-자' })])
    expect(first.text).toContain('질문-차')
    expect(errors()).toHaveLength(1)
    expect(String((errors()[0] as { message: string }).message)).toContain('원래-오류')
    expect(cancelled()).toEqual([
      { type: 'message.cancelled', sessionId: 's1', ids: ['p-9', 'req-11'] }
    ])
    expect(f.pendingMessages.pending('s1')).toEqual([])

    f.sendMessage.mockImplementationOnce(() => liveTurn(() => answer('s1')))
    await send({ sessionId: 's1', text: '질문-다음', clientRequestId: 'req-12' })

    expect(f.sendMessage).toHaveBeenCalledTimes(2)
    const next = f.sendMessage.mock.calls[1]![0]
    expect(next.text).toContain('질문-다음')
    const nextInput = [next.text, ...(next.preludes ?? []).map((batch) => batch.text)].join('\n')
    expect(nextInput).not.toContain('대기-자')
    expect(nextInput).not.toContain('질문-차')
    expect(cancelled()).toHaveLength(1)
    expect(errors()).toHaveLength(1)
  })
})
