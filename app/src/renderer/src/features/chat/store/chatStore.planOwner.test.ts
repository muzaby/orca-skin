import { expect, it, vi } from 'vitest'
const transport = vi.hoisted(() => ({
  deliver: undefined as undefined | ((event: unknown) => void)
}))
vi.mock('../../../../../main/infra/ipc/send', () => ({
  sendChatEvent: (_owner: unknown, event: unknown) => transport.deliver?.(event)
}))
import { createApprovalRequester } from '../../../../../main/app/chat-turn/approval'
import { ingestChatEvent, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { initialChatState } from '../reducer/chatReducer'
import type { NormalizedEvent, PermissionAction } from '../../../../../shared/ipc'

it('0249 independent X1: callback-before-init belongs to the pending draft after navigation', async () => {
  installChatStoreHarness()
  const current = useChatStore.getState()
  const draft = {
    session: { ...initialChatState, sessionId: null, inflight: true },
    live: { text: '', reasoning: '' },
    subagentMeta: {}
  }
  useChatStore.setState({
    sessions: { ...current.sessions, draft },
    pendingNewChatKey: 'draft',
    activeKey: 's'
  })
  transport.deliver = (event) => ingestChatEvent(event as NormalizedEvent)
  const input = {
    plan: '# Pending draft plan',
    planFilePath: 'C:/plans/pending.md',
    allowedPrompts: []
  }
  const action: PermissionAction = {
    kind: 'plan_review',
    request: { requestId: '', plan: input.plan },
    input,
    providerRequest: { requestId: 'control', toolUseId: 'exit' }
  }
  const persist = vi.fn()
  let resolve!: (value: { behavior: 'deny' }) => void
  const resolution = new Promise<{ behavior: 'deny' }>((r) => {
    resolve = r
  })
  const request = createApprovalRequester({
    wc: {},
    approvals: { register: vi.fn().mockReturnValue(resolution) },
    persistence: { persist },
    permissionModes: { setMode: vi.fn() },
    getActiveTurn: () => ({
      dbSessionId: null,
      controller: new AbortController(),
      agentKind: 'code'
    })
  } as never)
  const pending = request(action)
  expect(persist).toHaveBeenCalledTimes(1)
  const state = useChatStore.getState()
  try {
    expect({
      other: state.sessions.s.session.pendingPlanReview?.plan ?? null,
      owner: state.sessions.draft.session.pendingPlanReview?.plan ?? null
    }).toEqual({ other: null, owner: input.plan })
  } finally {
    resolve({ behavior: 'deny' })
    await pending
  }
})
