import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { WebContents } from 'electron'
import type { ApprovalResolution, NormalizedEvent, PermissionAction } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import type { TurnRequest } from '../../adapters/turn'
import type { LiveTurn, ProviderMessageBatch } from '../../adapters/types'
import type { RuntimeSessionAdapter } from '../../contracts/ports'
import type { HistoryWriter } from '../../features/history/writer'
import { makeCanUseTool } from '../../adapters/claude'
import { claudeToNormalized } from '../../adapters/claude-map'
import { SessionRuntime } from '../../features/sessions/session-runtime'
import { ApprovalCoordinator } from '../../features/approvals/coordinator'
import { PermissionModeController } from '../../features/approvals/permission-mode-controller'
import { createApprovalRequester } from './approval'
import { buildFlushRequest, buildListenRequest } from './continuation'

const sendChatEvent = vi.hoisted(() => vi.fn())
vi.mock('electron', () => ({ ipcMain: {}, webContents: { getAllWebContents: () => [] } }))
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent }))

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function owner(sessionId: string | null): {
  turn: TurnContext<WebContents>
  request: ReturnType<typeof createApprovalRequester>
  register: MockInstance<ApprovalCoordinator['register']>
  setMode: MockInstance<PermissionModeController['setMode']>
  persist: ReturnType<typeof vi.fn>
} {
  const turn = {
    agentKind: 'code',
    dbSessionId: sessionId,
    controller: new AbortController(),
    pendingAskAnswers: []
  } as unknown as TurnContext<WebContents>
  const approvals = new ApprovalCoordinator()
  const register = vi.spyOn(approvals, 'register')
  const modes = new PermissionModeController()
  const setMode = vi.spyOn(modes, 'setMode')
  const persist = vi.fn()
  const request = createApprovalRequester({
    wc: {} as WebContents,
    approvals,
    permissionModes: modes,
    persistence: { persist, flushAskAnswers: vi.fn() } as unknown as HistoryWriter,
    getActiveTurn: () => turn
  })
  return { turn, request, register, setMode, persist }
}

function persistentChannel(): {
  live: LiveTurn
  close: ReturnType<typeof vi.fn>
  pushTurn: ReturnType<typeof vi.fn>
  interrupt: ReturnType<typeof vi.fn>
  emit: (events: NormalizedEvent[]) => void
  result: () => void
} {
  const queue: ProviderMessageBatch[] = []
  let closed = false
  let wake: (() => void) | undefined
  let sequence = 0
  const pushTurn = vi.fn(async () => ({ kind: 'accepted' as const }))
  const interrupt = vi.fn(async () => undefined)
  const close = vi.fn(() => {
    closed = true
    wake?.()
  })
  const live: LiveTurn = {
    eventBatches: (async function* () {
      while (!closed) {
        while (queue.length) yield queue.shift()!
        if (closed) return
        await new Promise<void>((resolve) => {
          wake = resolve
        })
      }
    })(),
    close,
    pushTurn,
    interrupt,
    setPermissionMode: async () => {},
    setModel: async () => {},
    stopTask: async () => {},
    backgroundTask: async () => false
  }
  const emit = (events: NormalizedEvent[]): void => {
    queue.push({ sequence: sequence++, events })
    wake?.()
  }
  const result = (): void => {
    // Use the production SDK result mapper, not a local terminal reimplementation.
    // The CLI result and its ordering relative to control_cancel_request remain injected.
    const events = claudeToNormalized(
      {
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        errors: ['Interrupted by user'],
        uuid: `interrupt-result-${sequence}`
      } as SDKMessage,
      { sessionId: 'old', cwd: '/workspace' }
    )
    expect(events.map((event) => event.type)).toEqual(['telemetry', 'error'])
    emit(events)
  }
  return { live, close, pushTurn, interrupt, emit, result }
}

const collect = async (events: AsyncIterable<NormalizedEvent>): Promise<void> => {
  for await (const ignored of events) void ignored
}

const req = (turn: ReturnType<typeof owner>, delegate = turn.request): TurnRequest => ({
  sessionId: turn.turn.dbSessionId,
  text: 'interrupt owner probe',
  cwd: '/workspace',
  signal: turn.turn.controller.signal,
  extensions: { skills: [], hooks: { normalized: {} } },
  requestApproval: delegate
})

describe('0249 ΔV3.4 — main approval signal capture before await', () => {
  beforeEach(() => sendChatEvent.mockClear())

  it.each(['old', 'other'])(
    'a live old SDK signal cannot send old main approval to the next delegate %s',
    async (nextSessionId) => {
      const old = owner('old')
      const current = owner(nextSessionId)
      const currentDelegate = vi.fn(current.request)
      const channel = persistentChannel()
      const captured: TurnRequest[] = []
      const adapter: RuntimeSessionAdapter = {
        id: 'claude',
        complete: async () => '',
        sendMessage: (request) => {
          captured.push(request)
          return channel.live
        },
        classifyError: (error) => {
          throw error
        }
      }
      const runtime = new SessionRuntime(adapter, 'persistent')
      const first = collect(runtime.send(req(old)))
      await tick()
      runtime.confirmRuntimeToolSession('old')
      let release!: (value: { tracked: { plan: string; planFilePath: string } }) => void
      const files = new Promise<{ tracked: { plan: string; planFilePath: string } }>((resolve) => {
        release = resolve
      })
      const getPlanFiles = vi.fn(async () => files)
      const sdk = new AbortController()
      const canUse = makeCanUseTool(captured[0].requestApproval, {
        providerGeneration: 'same-live-provider',
        getPlanFiles,
        getMainApprovalSignal: captured[0].getMainApprovalSignal
      })
      const pending = canUse('ExitPlanMode', { plan: '# Old model input' }, {
        signal: sdk.signal,
        requestId: 'old-control',
        toolUseID: 'old-exit'
      } as Parameters<typeof canUse>[2])
      let next: Promise<void> | undefined
      try {
        await tick()
        expect(getPlanFiles).toHaveBeenCalledOnce()
        expect(old.persist).not.toHaveBeenCalled()
        old.turn.controller.abort()
        await runtime.interrupt()
        await first
        expect(channel.interrupt).toHaveBeenCalledOnce()
        channel.result()
        await vi.waitFor(() => expect(runtime.channelBusy).toBe(false))
        next = collect(runtime.send(req(current, currentDelegate)))
        await vi.waitFor(() => expect(channel.pushTurn).toHaveBeenCalledOnce())
        expect(captured).toHaveLength(1)
        expect(channel.close).not.toHaveBeenCalled()
        expect(captured[0].signal?.aborted).toBe(false)
        expect(sdk.signal.aborted).toBe(false)
        release({ tracked: { plan: '# Old approved file', planFilePath: '/plans/old.md' } })
        await tick()
        expect({
          latestDelegate: currentDelegate.mock.calls.length,
          oldPersist: old.persist.mock.calls.length,
          currentPersist: current.persist.mock.calls.length,
          currentRegister: current.register.mock.calls.length,
          ipc: sendChatEvent.mock.calls.length,
          oldMode: old.setMode.mock.calls.length,
          currentMode: current.setMode.mock.calls.length
        }).toEqual({
          latestDelegate: 0,
          oldPersist: 0,
          currentPersist: 0,
          currentRegister: 0,
          ipc: 0,
          oldMode: 0,
          currentMode: 0
        })
        expect((await pending)?.behavior).toBe('deny')
      } finally {
        sdk.abort()
        release({ tracked: { plan: '# Old approved file', planFilePath: '/plans/old.md' } })
        await pending
        runtime.close()
        await first
        await next
      }
    }
  )

  it('a control_cancel_request-equivalent SDK abort denies the late main callback', async () => {
    const old = owner('old')
    const current = owner('old')
    const delegate = vi.fn(current.request)
    const channel = persistentChannel()
    let captured!: TurnRequest
    const runtime = new SessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: (request) => {
        captured = request
        return channel.live
      },
      classifyError: (error) => {
        throw error
      }
    })
    const first = collect(runtime.send(req(old)))
    await tick()
    runtime.confirmRuntimeToolSession('old')
    let release!: (value: Record<string, never>) => void
    const files = new Promise<Record<string, never>>((resolve) => {
      release = resolve
    })
    const sdk = new AbortController()
    const canUse = makeCanUseTool(captured.requestApproval, {
      getPlanFiles: async () => files,
      getMainApprovalSignal: captured.getMainApprovalSignal
    })
    const pending = canUse('ExitPlanMode', { plan: '# Old' }, {
      signal: sdk.signal,
      requestId: 'old-control',
      toolUseID: 'old-exit'
    } as Parameters<typeof canUse>[2])
    let next: Promise<void> | undefined
    try {
      old.turn.controller.abort()
      await runtime.interrupt()
      sdk.abort()
      await first
      channel.result()
      await vi.waitFor(() => expect(runtime.channelBusy).toBe(false))
      next = collect(runtime.send(req(current, delegate)))
      await vi.waitFor(() => expect(channel.pushTurn).toHaveBeenCalledOnce())
      release({})
      expect((await pending)?.behavior).toBe('deny')
      expect(delegate).not.toHaveBeenCalled()
      expect(current.persist).not.toHaveBeenCalled()
      expect(current.register).not.toHaveBeenCalled()
      expect(sendChatEvent).not.toHaveBeenCalled()
    } finally {
      sdk.abort()
      release({})
      await pending
      runtime.close()
      await next
    }
  })

  it('a child SDK permission keeps its independent lifetime through main interrupt and reuse', async () => {
    const old = owner('old')
    const current = owner('old')
    const delegate = vi.fn(current.request)
    const channel = persistentChannel()
    let captured!: TurnRequest
    const runtime = new SessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: (request) => {
        captured = request
        return channel.live
      },
      classifyError: (error) => {
        throw error
      }
    })
    const first = collect(runtime.send(req(old)))
    await tick()
    runtime.confirmRuntimeToolSession('old')
    const sdk = new AbortController()
    const canUse = makeCanUseTool(captured.requestApproval, {
      getMainApprovalSignal: captured.getMainApprovalSignal
    })
    let settled = false
    const pending = canUse('ExitPlanMode', { plan: '# Child' }, {
      signal: sdk.signal,
      requestId: 'child-control',
      toolUseID: 'child-exit',
      agentID: 'live-child'
    } as Parameters<typeof canUse>[2]).then((result) => {
      settled = true
      return result
    })
    let next: Promise<void> | undefined
    try {
      await tick()
      expect(old.register).toHaveBeenCalledOnce()
      expect(old.register.mock.calls[0][2]).toBe(sdk.signal)
      old.turn.controller.abort()
      await runtime.interrupt()
      await first
      channel.result()
      await vi.waitFor(() => expect(runtime.channelBusy).toBe(false))
      next = collect(runtime.send(req(current, delegate)))
      await vi.waitFor(() => expect(channel.pushTurn).toHaveBeenCalledOnce())
      expect(settled).toBe(false)
      expect(sdk.signal.aborted).toBe(false)
      expect(delegate).not.toHaveBeenCalled()
      expect(sendChatEvent).toHaveBeenCalledOnce()
      sdk.abort()
      expect((await pending)?.behavior).toBe('deny')
      expect(sendChatEvent).toHaveBeenCalledTimes(2)
      expect(old.setMode).not.toHaveBeenCalled()
      expect(current.setMode).not.toHaveBeenCalled()
    } finally {
      sdk.abort()
      await pending
      runtime.close()
      await next
    }
  })

  it.each(['initial', 'pre-init', 'followup', 'listen', 'flush', 'respawn'])(
    'a normal %s main callback uses the current original turn signal',
    async (entry) => {
      const firstOwner = owner(entry === 'pre-init' ? null : 'old')
      const current = owner('old')
      const channels = [persistentChannel(), persistentChannel()]
      const captured: TurnRequest[] = []
      const runtime = new SessionRuntime({
        id: 'claude',
        complete: async () => '',
        sendMessage: (request) => {
          captured.push(request)
          return channels[captured.length - 1].live
        },
        classifyError: (error) => {
          throw error
        }
      })
      const first = collect(runtime.send(req(firstOwner)))
      await tick()
      runtime.confirmRuntimeToolSession('old')
      let active = firstOwner
      let frame = first
      let activeChannel = channels[0]
      if (entry !== 'initial' && entry !== 'pre-init') {
        channels[0].emit([{ type: 'telemetry', sessionId: 'old' }])
        await first
        firstOwner.turn.controller.abort()
        // 새 send의 adoption 뒤 runAttempt 내부 teardown -> spawn을 실제로 밟는다.
        if (entry === 'respawn') {
          channels[0].emit([
            { type: 'message.delta', sessionId: 'old', delta: { text: 'unframed' } }
          ])
          await vi.waitFor(() => expect(runtime.hasUnframedBacklog).toBe(true))
        }
        const base = { ...req(firstOwner), requestApproval: current.request }
        const continuation = {
          extensions: base.extensions,
          prepared: { envFingerprint: 'main-scope', runtimeEnvFingerprint: 'main-scope' }
        }
        const request =
          entry === 'listen'
            ? buildListenRequest({
                base,
                sessionId: 'old',
                signal: current.turn.controller.signal,
                continuation
              })
            : entry === 'flush'
              ? buildFlushRequest({
                  base,
                  sessionId: 'old',
                  signal: current.turn.controller.signal,
                  batch: { uuid: 'flush', ids: [], text: 'flush', createdAt: 1 },
                  preludes: [],
                  continuation
                })
              : req(current)
        frame = collect(entry === 'listen' ? runtime.listen(request) : runtime.send(request))
        active = current
        if (entry === 'respawn') activeChannel = channels[1]
        await tick()
      }
      const wrapped = captured.at(-1)!
      expect(wrapped.getMainApprovalSignal!()).toBe(active.turn.controller.signal)
      expect(wrapped.signal).not.toBe(active.turn.controller.signal)
      const sdk = new AbortController()
      const canUse = makeCanUseTool(wrapped.requestApproval, {
        getMainApprovalSignal: wrapped.getMainApprovalSignal,
        getPlanFiles: async () => ({})
      })
      const pending = canUse('ExitPlanMode', { plan: '# Current' }, {
        signal: sdk.signal,
        requestId: entry,
        toolUseID: entry
      } as Parameters<typeof canUse>[2])
      try {
        await tick()
        expect(active.register).toHaveBeenCalledOnce()
        expect(active.persist).toHaveBeenCalledOnce()
        expect(sendChatEvent).toHaveBeenCalledOnce()
        const effective = active.register.mock.calls[0][2]
        expect(effective.aborted).toBe(false)
        active.turn.controller.abort()
        expect(effective.aborted).toBe(true)
        expect(sdk.signal.aborted).toBe(false)
        expect((await pending)?.behavior).toBe('deny')
      } finally {
        sdk.abort()
        await pending
        activeChannel.emit([{ type: 'telemetry', sessionId: 'old' }])
        await frame
        runtime.close()
      }
    }
  )

  it('an already cancelled main Exit denies before file, narrative or approval reads', async () => {
    const main = new AbortController()
    main.abort()
    const getMainApprovalSignal = vi.fn(() => main.signal)
    const getPlanFiles = vi.fn(async () => ({}))
    const getPlanNarrative = vi.fn(() => '# Narrative')
    const requestApproval = vi.fn(async (): Promise<ApprovalResolution> => ({ behavior: 'allow' }))
    const canUse = makeCanUseTool(requestApproval, {
      getMainApprovalSignal,
      getPlanFiles,
      getPlanNarrative
    })
    expect(
      (await canUse('ExitPlanMode', {}, { signal: new AbortController().signal } as never))
        ?.behavior
    ).toBe('deny')
    expect(getMainApprovalSignal).toHaveBeenCalledOnce()
    expect(getPlanFiles).not.toHaveBeenCalled()
    expect(getPlanNarrative).not.toHaveBeenCalled()
    expect(requestApproval).not.toHaveBeenCalled()
  })

  it.each(['AskUserQuestion', 'Bash', 'mcp__runtime__write'])(
    '%s main approval forwards a captured main plus SDK signal',
    async (toolName) => {
      const main = new AbortController()
      const sdk = new AbortController()
      const getMainApprovalSignal = vi.fn(() => main.signal)
      const requestApproval = vi.fn(
        async (action: PermissionAction, signal?: AbortSignal): Promise<ApprovalResolution> => {
          expect(action.kind).toMatch(/ask_question|tool_approval/)
          expect(signal).toBeDefined()
          return { behavior: 'allow' }
        }
      )
      const canUse = makeCanUseTool(requestApproval, {
        getMainApprovalSignal,
        runtimeApprovalToolNames: new Set(['mcp__runtime__write'])
      })
      expect((await canUse(toolName, {}, { signal: sdk.signal } as never))?.behavior).toBe('allow')
      expect(getMainApprovalSignal).toHaveBeenCalledOnce()
      const effective = requestApproval.mock.calls[0][1]!
      expect(effective).not.toBe(sdk.signal)
      expect(effective).not.toBe(main.signal)
      main.abort()
      expect(effective.aborted).toBe(true)
      expect(sdk.signal.aborted).toBe(false)
    }
  )

  it('a child and safe or unhandled calls never read the main signal getter', async () => {
    const cancelledMain = new AbortController()
    cancelledMain.abort()
    const getMainApprovalSignal = vi.fn(() => cancelledMain.signal)
    const requestApproval = vi.fn(async (): Promise<ApprovalResolution> => ({ behavior: 'allow' }))
    const canUse = makeCanUseTool(requestApproval, { getMainApprovalSignal })
    const sdk = new AbortController()
    for (const toolName of ['ExitPlanMode', 'AskUserQuestion', 'Bash']) {
      expect(
        (await canUse(toolName, {}, { signal: sdk.signal, agentID: 'child' } as never))?.behavior
      ).toBe('allow')
    }
    for (const toolName of ['Read', 'Agent', 'Task']) {
      expect((await canUse(toolName, {}, { signal: sdk.signal } as never))?.behavior).toBe('allow')
    }
    const unhandled = makeCanUseTool(undefined, { getMainApprovalSignal })
    expect((await unhandled('ExitPlanMode', {}, { signal: sdk.signal } as never))?.behavior).toBe(
      'allow'
    )
    expect(getMainApprovalSignal).not.toHaveBeenCalled()
    expect(requestApproval.mock.calls).toHaveLength(3)
  })

  it.each(['ExitPlanMode', 'AskUserQuestion', 'Bash'])(
    'legacy %s callbacks without the optional getter preserve their SDK signal',
    async (toolName) => {
      const sdk = new AbortController()
      const requestApproval = vi.fn(
        async (action: PermissionAction, signal?: AbortSignal): Promise<ApprovalResolution> => {
          expect(action.kind).toMatch(/plan_review|ask_question|tool_approval/)
          expect(signal).toBe(sdk.signal)
          return { behavior: 'allow' }
        }
      )
      const canUse = makeCanUseTool(requestApproval)
      expect((await canUse(toolName, {}, { signal: sdk.signal } as never))?.behavior).toBe('allow')
      expect(requestApproval.mock.calls[0][1]).toBe(sdk.signal)
    }
  )

  it('a duplicate requestId plus generation reuses its promise and main signal capture', async () => {
    const getMainApprovalSignal = vi.fn(() => new AbortController().signal)
    const getPlanFiles = vi.fn(async () => ({}))
    const requestApproval = vi.fn(async (): Promise<ApprovalResolution> => ({ behavior: 'allow' }))
    const canUse = makeCanUseTool(requestApproval, {
      providerGeneration: 'generation',
      getMainApprovalSignal,
      getPlanFiles
    })
    const options = {
      signal: new AbortController().signal,
      requestId: 'same-request',
      toolUseID: 'first'
    } as Parameters<typeof canUse>[2]
    const first = canUse('ExitPlanMode', {}, options)
    const duplicate = canUse('ExitPlanMode', {}, { ...options, toolUseID: 'different' })
    expect(duplicate).toBe(first)
    expect((await first)?.behavior).toBe('allow')
    expect(getMainApprovalSignal).toHaveBeenCalledOnce()
    expect(getPlanFiles).toHaveBeenCalledOnce()
    expect(requestApproval).toHaveBeenCalledOnce()
  })
})
