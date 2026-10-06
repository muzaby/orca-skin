import { beforeEach, describe, expect, it, vi } from 'vitest'
const sendChatEvent = vi.hoisted(() => vi.fn())
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent }))
import type { PermissionAction } from '../../../shared/ipc'
import { createApprovalRequester } from './approval'

describe('approval plan input persistence', () => {
  beforeEach(() => {
    sendChatEvent.mockReset()
  })
  const input = { plan: '# Disk', planFilePath: 'disk.md', allowedPrompts: [] }
  const action: PermissionAction = {
    kind: 'plan_review',
    request: { requestId: '', plan: '# Disk' },
    input,
    providerRequest: { requestId: 'sdk', toolUseId: 'exit' }
  }
  it.each([
    { behavior: 'allow' },
    { behavior: 'deny' },
    { behavior: 'deny', message: 'revise' }
  ] as const)('persists the reviewed input before the card is sent for %j', async (resolution) => {
    const order: string[] = []
    const turn = { dbSessionId: 's', agentKind: 'code', controller: new AbortController() }
    const persist = vi.fn((_turn, event) => {
      order.push('persist')
      expect(_turn).toBe(turn)
      expect(event.action.input).toBe(input)
    })
    sendChatEvent.mockImplementation((_wc, event) => {
      if (event.type === 'permission.requested') order.push('send')
    })
    const setMode = vi.fn()
    const request = createApprovalRequester({
      wc: {},
      approvals: { register: vi.fn().mockResolvedValue(resolution) },
      persistence: { persist },
      permissionModes: { setMode },
      getActiveTurn: () => turn
    } as never)
    await expect(request(action)).resolves.toEqual(resolution)
    expect(order).toEqual(['persist', 'send'])
    expect(persist).toHaveBeenCalledTimes(1)
    expect(persist.mock.calls[0][1]).toBe(sendChatEvent.mock.calls[0][1])
    expect(setMode).toHaveBeenCalledTimes(resolution.behavior === 'allow' ? 1 : 0)
  })
  it('keeps a child approval out of main history and main permission mode', async () => {
    const persist = vi.fn()
    const setMode = vi.fn()
    const request = createApprovalRequester({
      wc: {},
      approvals: { register: vi.fn().mockResolvedValue({ behavior: 'allow' }) },
      persistence: { persist },
      permissionModes: { setMode },
      getActiveTurn: () => ({
        dbSessionId: 's',
        agentKind: 'code',
        controller: new AbortController()
      })
    } as never)
    await request({ ...action, providerRequest: { ...action.providerRequest!, agentId: 'child' } })
    expect(persist).not.toHaveBeenCalled()
    expect(setMode).not.toHaveBeenCalled()
  })
  it('persists the reviewed input when the SDK request is cancelled', async () => {
    const signal = new AbortController()
    const persist = vi.fn()
    const register = vi.fn(
      (_id, _turn, registeredSignal: AbortSignal) =>
        new Promise((resolve) => {
          registeredSignal.addEventListener('abort', () => resolve({ behavior: 'deny' }), {
            once: true
          })
        })
    )
    const setMode = vi.fn()
    const request = createApprovalRequester({
      wc: {},
      approvals: { register },
      persistence: { persist },
      permissionModes: { setMode },
      getActiveTurn: () => ({ dbSessionId: 's', controller: new AbortController() })
    } as never)
    const pending = request(action, signal.signal)
    signal.abort()
    await expect(pending).resolves.toEqual({ behavior: 'deny' })
    expect(persist).toHaveBeenCalledTimes(1)
    expect(setMode).not.toHaveBeenCalled()
  })
})
