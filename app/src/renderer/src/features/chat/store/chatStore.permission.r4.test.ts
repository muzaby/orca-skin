import { beforeEach, describe, expect, it } from 'vitest'
import { chatActions, ingestChatEvent, useChatStore } from './chatStore'
import { installChatStoreHarness, harnessSession } from './chatStore.testHarness'
import type { NormalizedPermissionMode } from '../../../../../shared/permission-mode'
let harness: ReturnType<typeof installChatStoreHarness>
function deferred(): {
  promise: Promise<NormalizedPermissionMode | undefined>
  resolve: (mode: NormalizedPermissionMode | undefined) => void
} {
  let resolve!: (mode: NormalizedPermissionMode | undefined) => void
  const promise = new Promise<NormalizedPermissionMode | undefined>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
beforeEach(() => {
  harness = installChatStoreHarness({
    agentKind: 'work',
    permissionMode: 'default',
    modelFamily: 'claude-sonnet-4-6',
    modelAlias: 'sonnet'
  })
})
describe('r4 permission applied response lifetime', () => {
  it('Main actual-model fallback replaces optimistic auto', async () => {
    harness.permissionSetMode.mockResolvedValue('default')
    chatActions.setPermissionMode('auto_classified')
    await settle()
    expect(harnessSession().permissionMode).toBe('default')
  })
  it('older response cannot replace later choice', async () => {
    const first = deferred(),
      second = deferred()
    harness.permissionSetMode.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    chatActions.setPermissionMode('auto_classified')
    chatActions.setPermissionMode('bypass')
    second.resolve('bypass')
    await settle()
    first.resolve('default')
    await settle()
    expect(harnessSession().permissionMode).toBe('bypass')
  })
  it('model change invalidates older response even if mode remains auto', async () => {
    const pending = deferred()
    harness.permissionSetMode.mockReturnValueOnce(pending.promise)
    chatActions.setPermissionMode('auto_classified')
    chatActions.setModel('claude', 'claude-opus-4-6', 'opus', 'claude')
    pending.resolve('default')
    await settle()
    expect(harnessSession().permissionMode).toBe('auto_classified')
  })
  it('response updates its original session without touching the other active session', async () => {
    const pending = deferred()
    harness.permissionSetMode.mockReturnValueOnce(pending.promise)
    chatActions.setPermissionMode('auto_classified')
    const state = useChatStore.getState()
    useChatStore.setState({
      sessions: {
        ...state.sessions,
        other: {
          ...state.sessions.s,
          session: { ...state.sessions.s.session, sessionId: 'other', permissionMode: 'bypass' }
        }
      },
      activeKey: 'other'
    })
    pending.resolve('default')
    await settle()
    expect(useChatStore.getState().sessions.s.session.permissionMode).toBe('default')
    expect(useChatStore.getState().sessions.other.session.permissionMode).toBe('bypass')
  })
  it('failure rolls back and displays a failed state; same-mode model change retries', async () => {
    harness.permissionSetMode.mockResolvedValueOnce(undefined)
    chatActions.setPermissionMode('bypass')
    await settle()
    expect(harnessSession().permissionMode).toBe('default')
    expect(harnessSession().permissionModeError).toBe(true)
    chatActions.setModel('claude', 'claude-opus-4-6', 'opus', 'claude')
    await settle()
    expect(harness.permissionSetMode).toHaveBeenCalledTimes(2)
    expect(harnessSession().permissionModeError).toBe(false)
  })
  it('plan approval has Work manual target and original allow response', () => {
    chatActions.approvePlan('p1')
    expect(harness.permissionRespond).toHaveBeenCalledWith({
      approvalId: 'p1',
      resolution: { behavior: 'allow' }
    })
    expect(harnessSession().permissionMode).toBe('default')
    expect(harness.permissionSetMode).not.toHaveBeenCalled()
  })
})

describe('r4 authoritative patch and request response races', () => {
  it('an earlier Main patch cannot suppress the newest successful user request', async () => {
    const pending = deferred()
    harness.permissionSetMode.mockReturnValueOnce(pending.promise)
    chatActions.setPermissionMode('bypass')
    ingestChatEvent({
      type: 'session.updated',
      sessionId: 's',
      patch: { permissionMode: 'default' }
    })
    pending.resolve('bypass')
    await settle()
    expect(harnessSession().permissionMode).toBe('bypass')
  })
  it('late failure does not roll back a Main-confirmed mode even when the mode equals the optimistic value', async () => {
    const pending = deferred()
    harness.permissionSetMode.mockReturnValueOnce(pending.promise)
    chatActions.setPermissionMode('auto_classified')
    ingestChatEvent({
      type: 'session.updated',
      sessionId: 's',
      patch: { permissionMode: 'auto_classified' }
    })
    pending.resolve(undefined)
    await settle()
    expect(harnessSession().permissionMode).toBe('auto_classified')
    expect(harnessSession().permissionModeError).toBe(false)
  })
})
