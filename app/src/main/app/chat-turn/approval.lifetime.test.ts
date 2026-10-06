import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { WebContents } from 'electron'
import type { ApprovalResolution, NormalizedEvent, PermissionAction } from '../../../shared/ipc'
import type { TurnRequest } from '../../adapters/turn'
import type { LiveTurn, ProviderMessageBatch } from '../../adapters/types'
import type { RuntimeSessionAdapter } from '../../contracts/ports'
import type { TurnContext } from '../../contracts/turn'
import type { HistoryWriter } from '../../features/history/writer'
import { SessionRuntime } from '../../features/sessions/session-runtime'
import { ApprovalCoordinator } from '../../features/approvals/coordinator'
import { PermissionModeController } from '../../features/approvals/permission-mode-controller'
import { makeCanUseTool } from '../../adapters/claude'
import { createApprovalRequester } from './approval'

const sendChatEvent = vi.hoisted(() => vi.fn())
vi.mock('electron', () => ({ ipcMain: {}, webContents: { getAllWebContents: () => [] } }))
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent }))

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function turn(sessionId: string): TurnContext<WebContents> {
  return {
    agentKind: 'code',
    dbSessionId: sessionId,
    controller: new AbortController(),
    pendingAskAnswers: []
  } as unknown as TurnContext<WebContents>
}

function requester(active: TurnContext<WebContents>): {
  request: ReturnType<typeof createApprovalRequester>
  persist: ReturnType<typeof vi.fn>
  register: MockInstance<ApprovalCoordinator['register']>
  setMode: MockInstance<PermissionModeController['setMode']>
  isSessionAllowed: MockInstance<ApprovalCoordinator['isSessionAllowed']>
} {
  // register를 관측만 하고 실제 coordinator/broker의 취소·대기 수명을 실행한다.
  const approvals = new ApprovalCoordinator()
  const register = vi.spyOn(approvals, 'register')
  const isSessionAllowed = vi.spyOn(approvals, 'isSessionAllowed')
  const permissionModes = new PermissionModeController()
  const setMode = vi.spyOn(permissionModes, 'setMode')
  const persist = vi.fn()
  const request = createApprovalRequester({
    wc: {} as WebContents,
    approvals,
    permissionModes,
    persistence: { persist, flushAskAnswers: vi.fn() } as unknown as HistoryWriter,
    getActiveTurn: () => active
  })
  return { request, persist, register, setMode, isSessionAllowed }
}

function channel(onClose: () => void = () => {}): {
  live: LiveTurn
  emit: (event: NormalizedEvent) => void
  finish: (error?: Error) => void
} {
  const queue: ProviderMessageBatch[] = []
  let closed = false
  let wake: (() => void) | undefined
  let sequence = 0
  let failure: Error | undefined
  return {
    live: {
      eventBatches: (async function* () {
        while (!closed) {
          while (queue.length) yield queue.shift()!
          if (closed) return
          await new Promise<void>((resolve) => {
            wake = resolve
          })
        }
        if (failure) throw failure
      })(),
      close: () => {
        closed = true
        onClose()
        wake?.()
      },
      pushTurn: async () => ({ kind: 'accepted' }),
      setPermissionMode: async () => {},
      interrupt: async () => undefined,
      setModel: async () => {},
      stopTask: async () => {},
      backgroundTask: async () => false
    },
    emit: (event) => {
      queue.push({ sequence: sequence++, events: [event] })
      wake?.()
    },
    finish: (error) => {
      failure = error
      closed = true
      wake?.()
    }
  }
}

async function collect(stream: AsyncIterable<NormalizedEvent>): Promise<void> {
  for await (const ignored of stream) void ignored
}

function req(sessionId: string, requestApproval: TurnRequest['requestApproval']): TurnRequest {
  return {
    sessionId,
    text: 'lifetime fixture',
    cwd: '/workspace',
    extensions: { skills: [], hooks: { normalized: {} } },
    requestApproval
  }
}

function planAction(agentId?: string): PermissionAction {
  return {
    kind: 'plan_review',
    request: { requestId: '', plan: '# Plan' },
    input: { plan: '# Plan', planFilePath: '/plans/current.md' },
    providerRequest: {
      requestId: 'request',
      toolUseId: 'exit',
      generation: 'generation',
      ...(agentId ? { agentId } : {})
    }
  }
}

describe('0249 AC25/26 approval callback lifetime', () => {
  beforeEach(() => sendChatEvent.mockClear())

  it.each(
    ['teardown', 'completed', 'errored', 'oneshot-completed', 'oneshot-errored'].flatMap(
      (retirement) => ['current-session', 'old-session'].map((sessionId) => [retirement, sessionId])
    )
  )(
    'an Exit file await after %s cannot surface to the next turn with session %s',
    async (retirement, currentSessionId) => {
      const sdk = new AbortController()
      const old = requester(turn('old-session'))
      const current = requester(turn(currentSessionId))
      const currentDelegate = vi.fn(current.request)
      const oldMode = vi.fn()
      const currentMode = vi.fn()
      // 명시 close의 SDK 취소와 달리 자연 종료는 SDK 요청 신호가 살아 있는 대조도 잠근다.
      const channels = [
        channel(() => {
          if (retirement === 'teardown') sdk.abort()
        }),
        channel()
      ]
      const captured: TurnRequest[] = []
      const adapter: RuntimeSessionAdapter = {
        id: 'claude',
        complete: async () => '',
        sendMessage: (request) => {
          captured.push(request)
          return channels[captured.length - 1].live
        },
        classifyError: (error) => {
          throw error
        }
      }
      const runtime = new SessionRuntime(
        adapter,
        retirement.startsWith('oneshot-') ? 'oneshot' : 'persistent'
      )
      const first = collect(
        runtime.send({ ...req('old-session', old.request), onPermissionModeChanged: oldMode })
      ).then(
        () => undefined,
        (error: unknown) => error
      )
      await tick()
      let release!: (value: { tracked: { plan: string; planFilePath: string } }) => void
      const files = new Promise<{ tracked: { plan: string; planFilePath: string } }>((resolve) => {
        release = resolve
      })
      const getPlanFiles = vi.fn(async () => files)
      const canUse = makeCanUseTool(captured[0].requestApproval, {
        providerGeneration: 'old-generation',
        getPlanFiles
      })
      const exit = canUse(
        'ExitPlanMode',
        { allowedPrompts: [{ tool: 'Bash', prompt: 'old action' }] },
        {
          signal: sdk.signal,
          requestId: 'old-request',
          toolUseID: 'old-exit'
        } as Parameters<typeof canUse>[2]
      )
      await tick()
      expect(getPlanFiles).toHaveBeenCalledTimes(1)
      const streamError = retirement.endsWith('errored') ? new Error('old stream ended') : undefined
      if (retirement === 'teardown') runtime.teardownChannel()
      else channels[0].finish(streamError)
      expect(await first).toBe(streamError)
      expect(captured[0].signal!.aborted).toBe(true)
      expect(sdk.signal.aborted).toBe(retirement === 'teardown')
      const next = collect(
        runtime.send({
          ...req(currentSessionId, currentDelegate),
          onPermissionModeChanged: currentMode
        })
      )
      await tick()
      expect(captured).toHaveLength(2)
      expect(captured[1].signal!.aborted).toBe(false)
      release({ tracked: { plan: '# Old plan', planFilePath: '/plans/old.md' } })
      expect((await exit)?.behavior).toBe('deny')
      captured[0].onPermissionModeChanged!(currentSessionId, 'plan')
      expect(oldMode).not.toHaveBeenCalled()
      expect(currentMode).not.toHaveBeenCalled()
      captured[1].onPermissionModeChanged!(currentSessionId, 'accept_edits')
      expect(currentMode).toHaveBeenCalledExactlyOnceWith(currentSessionId, 'accept_edits')
      expect(currentDelegate).not.toHaveBeenCalled()
      for (const owner of [old, current]) {
        expect(owner.persist).not.toHaveBeenCalled()
        expect(owner.register).not.toHaveBeenCalled()
        expect(owner.setMode).not.toHaveBeenCalled()
      }
      expect(sendChatEvent).not.toHaveBeenCalled()
      channels[1].emit({ type: 'telemetry', sessionId: currentSessionId })
      await next
      runtime.close()
    }
  )

  it.each(['SDK', 'main turn'])(
    'an already cancelled %s main request denies before persistence, IPC, registration or mode changes',
    async (cancelledOwner) => {
      const active = turn('s1')
      const sdk = new AbortController()
      if (cancelledOwner === 'SDK') sdk.abort()
      else active.controller.abort()
      const h = requester(active)
      expect(await h.request(planAction(), sdk.signal)).toEqual({ behavior: 'deny' })
      expect(h.persist).not.toHaveBeenCalled()
      expect(h.register).not.toHaveBeenCalled()
      expect(h.setMode).not.toHaveBeenCalled()
      expect(sendChatEvent).not.toHaveBeenCalled()
    }
  )

  it('a cancelled SDK request cannot use the session autoallow shortcut', async () => {
    const h = requester(turn('s1'))
    h.isSessionAllowed.mockReturnValue(true)
    const sdk = new AbortController()
    sdk.abort()
    expect(
      await h.request({ kind: 'tool_approval', toolName: 'Bash', input: {} }, sdk.signal)
    ).toEqual({
      behavior: 'deny'
    })
    expect(h.isSessionAllowed).not.toHaveBeenCalled()
    expect(h.register).not.toHaveBeenCalled()
    expect(sendChatEvent).not.toHaveBeenCalled()
  })

  it('a live child SDK request survives an already cancelled main turn until its own SDK cancellation', async () => {
    const active = turn('s1')
    active.controller.abort()
    const h = requester(active)
    const sdk = new AbortController()
    let settled = false
    const pending = h
      .request(planAction('child-a'), sdk.signal)
      .then((result: ApprovalResolution) => {
        settled = true
        return result
      })
    await tick()
    expect(settled).toBe(false)
    expect(h.persist).not.toHaveBeenCalled()
    expect(h.register.mock.calls[0][2]).toBe(sdk.signal)
    expect(h.register.mock.calls[0][2].aborted).toBe(false)
    expect(sendChatEvent).toHaveBeenCalledTimes(1)
    sdk.abort()
    expect(await pending).toEqual({ behavior: 'deny' })
    expect(sendChatEvent).toHaveBeenCalledTimes(2)
    expect(sendChatEvent.mock.calls[1][1]).toMatchObject({ type: 'permission.resolved' })
    expect(h.setMode).not.toHaveBeenCalled()
  })

  it.each(['SDK', 'main turn'])(
    'a main request cancelled by %s after entry retains the broker resolution path',
    async (cancelledOwner) => {
      const active = turn('s1')
      const h = requester(active)
      const sdk = new AbortController()
      const pending = h.request(planAction(), sdk.signal)
      expect(h.persist).toHaveBeenCalledTimes(1)
      expect(sendChatEvent).toHaveBeenCalledTimes(1)
      expect(h.register).toHaveBeenCalledTimes(1)
      if (cancelledOwner === 'SDK') sdk.abort()
      else active.controller.abort()
      expect(await pending).toEqual({ behavior: 'deny' })
      expect(sendChatEvent).toHaveBeenCalledTimes(2)
      expect(sendChatEvent.mock.calls[1][1]).toMatchObject({ type: 'permission.resolved' })
    }
  )

  it('a retired runtime wrapper with a live SDK signal never reaches the latest delegate', async () => {
    const channels = [channel(), channel()]
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
    const old = vi.fn(async (): Promise<ApprovalResolution> => ({ behavior: 'allow' }))
    const current = vi.fn(async (): Promise<ApprovalResolution> => ({ behavior: 'allow' }))
    const first = collect(runtime.send(req('s1', old)))
    await tick()
    runtime.teardownChannel()
    await first
    const next = collect(runtime.send(req('s1', current)))
    await tick()
    const liveSDK = new AbortController()
    expect(liveSDK.signal.aborted).toBe(false)
    expect(await captured[0].requestApproval!(planAction(), liveSDK.signal)).toEqual({
      behavior: 'deny'
    })
    expect(old).not.toHaveBeenCalled()
    expect(current).not.toHaveBeenCalled()
    expect(await captured[1].requestApproval!(planAction(), liveSDK.signal)).toEqual({
      behavior: 'allow'
    })
    expect(current).toHaveBeenCalledTimes(1)
    channels[1].emit({ type: 'telemetry', sessionId: 's1' })
    await next
    runtime.close()
  })

  it('a live runtime wrapper rejects an already cancelled SDK request and forwards live send/listen delegates', async () => {
    const ch = channel()
    let captured!: TurnRequest
    const runtime = new SessionRuntime({
      id: 'claude',
      complete: async () => '',
      sendMessage: (request) => {
        captured = request
        return ch.live
      },
      classifyError: (error) => {
        throw error
      }
    })
    const firstDelegate = vi.fn(async (): Promise<ApprovalResolution> => ({ behavior: 'allow' }))
    const sendDelegate = vi.fn(async (): Promise<ApprovalResolution> => ({ behavior: 'allow' }))
    const listenDelegate = vi.fn(async (): Promise<ApprovalResolution> => ({ behavior: 'deny' }))
    const first = collect(runtime.send(req('s1', firstDelegate)))
    await tick()
    const sdk = new AbortController()
    sdk.abort()
    expect(await captured.requestApproval!(planAction(), sdk.signal)).toEqual({ behavior: 'deny' })
    expect(firstDelegate).not.toHaveBeenCalled()
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await first
    const next = collect(runtime.send(req('s1', sendDelegate)))
    await tick()
    expect(await captured.requestApproval!(planAction())).toEqual({ behavior: 'allow' })
    expect(sendDelegate).toHaveBeenCalledTimes(1)
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await next
    const listening = collect(runtime.listen(req('s1', listenDelegate)))
    await tick()
    expect(await captured.requestApproval!(planAction())).toEqual({ behavior: 'deny' })
    expect(listenDelegate).toHaveBeenCalledTimes(1)
    expect(firstDelegate).not.toHaveBeenCalled()
    ch.emit({ type: 'telemetry', sessionId: 's1' })
    await listening
    runtime.close()
  })
})
