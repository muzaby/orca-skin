import { describe, expect, it, vi } from 'vitest'

const sendChatEvent = vi.hoisted(() => vi.fn())
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent }))

import type { ApprovalResolution, PermissionAction } from '../../../shared/ipc'
import { createApprovalRequester } from './approval'

const action = (requestId: string, generation = 'g1', agentId?: string): PermissionAction =>
  ({
    kind: 'tool_approval',
    toolName: 'Bash',
    input: { command: 'echo raw', unknownField: { keep: true } },
    providerRequest: {
      requestId,
      toolUseId: `tool-${requestId}`,
      ...(agentId ? { agentId } : {}),
      generation
    }
  }) as PermissionAction

function harness(): {
  pending: Map<string, (resolution: ApprovalResolution) => void>
  register: ReturnType<typeof vi.fn>
  request: ReturnType<typeof createApprovalRequester>
  turn: {
    agentKind: string
    dbSessionId: string
    controller: AbortController
    pendingAskAnswers: never[]
  }
} {
  const turn = {
    agentKind: 'code',
    dbSessionId: 's1',
    controller: new AbortController(),
    pendingAskAnswers: []
  }
  const pending = new Map<string, (resolution: ApprovalResolution) => void>()
  const register = vi.fn(
    (approvalId: string, _turn: unknown, signal: AbortSignal): Promise<ApprovalResolution> =>
      new Promise((resolve) => {
        pending.set(approvalId, resolve)
        signal.addEventListener('abort', () => resolve({ behavior: 'deny' }), { once: true })
      })
  )
  const request = createApprovalRequester({
    wc: {},
    approvals: { register, isSessionAllowed: () => false },
    permissionModes: { setMode: vi.fn() },
    persistence: { flushAskAnswers: vi.fn() },
    beginApprovalPause: () => undefined,
    getActiveTurn: () => turn
  } as never)
  return { pending, register, request, turn }
}

describe('createApprovalRequester provider identity', () => {
  it('surfaces provider identity and raw input on the registered card', async () => {
    const { pending, register, request } = harness()
    const first = request(action('r1'))

    expect(register).toHaveBeenCalledTimes(1)
    expect(sendChatEvent).toHaveBeenCalledTimes(1)
    expect(sendChatEvent.mock.calls[0][1]).toMatchObject({
      action: {
        providerRequest: { requestId: 'r1', toolUseId: 'tool-r1', generation: 'g1' },
        input: { command: 'echo raw', unknownField: { keep: true } }
      }
    })

    pending.values().next().value!({ behavior: 'allow' })
    await expect(first).resolves.toEqual({ behavior: 'allow' })
  })

  it('keeps simultaneous child requests independent', () => {
    const { register, request } = harness()
    expect(request(action('r1', 'g1', 'child-a'))).not.toBe(request(action('r2', 'g1', 'child-b')))
    expect(register).toHaveBeenCalledTimes(2)
  })

  it('does not abort a child approval when only the main turn is cancelled', async () => {
    const { request, turn } = harness()
    const sdk = new AbortController()
    const approval = request(action('r1', 'g1', 'child-a'), sdk.signal)

    turn.controller.abort()
    expect(sdk.signal.aborted).toBe(false)
    let settled = false
    void approval.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    sdk.abort()
    await expect(approval).resolves.toEqual({ behavior: 'deny' })
  })
})
