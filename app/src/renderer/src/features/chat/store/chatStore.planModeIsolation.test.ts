import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import type {
  ApprovalResolution,
  NormalizedEvent,
  PermissionAction
} from '../../../../../shared/ipc'
import type { TurnContext } from '../../../../../main/contracts/turn'
import type { HistoryWriter } from '../../../../../main/features/history/writer'
import type { ApprovalCoordinator } from '../../../../../main/features/approvals/coordinator'
import { makeCanUseTool } from '../../../../../main/adapters/claude'
import { createApprovalRequester } from '../../../../../main/app/chat-turn/approval'
import { ApprovalBroker } from '../../../../../main/features/approvals/broker'
import { PermissionModeController } from '../../../../../main/features/approvals/permission-mode-controller'
import { chatActions, ingestChatEvent, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'

const transport = vi.hoisted(() => ({
  deliver: undefined as undefined | ((event: unknown) => void)
}))
vi.mock('../../../../../main/infra/ipc/send', () => ({
  sendChatEvent: (_owner: unknown, event: unknown) => transport.deliver?.(event)
}))

beforeEach(() => {
  transport.deliver = undefined
})

describe('0249 independent X2 — plan acceptance ownership and child mode isolation', () => {
  it.each([
    { scope: 'main', expected: 'accept_edits' },
    { scope: 'child', expected: 'plan' }
  ] as const)(
    '$scope acceptance preserves the intended main mode through the next send',
    async ({ scope, expected }) => {
      const harness = installChatStoreHarness({ agentKind: 'code', permissionMode: 'plan' })
      const start = useChatStore.getState()
      const neighbor = {
        ...start.sessions.s,
        session: { ...start.sessions.s.session, sessionId: 'neighbor' }
      }
      useChatStore.setState({ sessions: { ...start.sessions, neighbor } })
      const events: NormalizedEvent[] = []
      transport.deliver = (event) => {
        events.push(event as NormalizedEvent)
        ingestChatEvent(event as NormalizedEvent)
      }
      const broker = new ApprovalBroker<ApprovalResolution>()
      harness.permissionRespond.mockImplementation(async ({ approvalId, resolution }) => {
        broker.resolve(approvalId, resolution)
      })
      const permissionModes = new PermissionModeController()
      await permissionModes.setMode('s', 'plan')
      const controller = new AbortController()
      const turn = { dbSessionId: 's', agentKind: 'code', controller } as TurnContext<WebContents>
      const request = createApprovalRequester({
        wc: {} as WebContents,
        approvals: {
          isSessionAllowed: () => false,
          register: (id: string, _turn: unknown, signal: AbortSignal) =>
            broker.register(id, signal, { behavior: 'deny' })
        } as unknown as ApprovalCoordinator,
        permissionModes,
        persistence: { persist: vi.fn() } as unknown as HistoryWriter,
        getActiveTurn: () => turn
      })
      const sdk = new AbortController()
      const canUse = makeCanUseTool(request, { providerGeneration: 'independent-X2' })
      const pending = canUse(
        'ExitPlanMode',
        { plan: '# Requested plan', planFilePath: 'C:/plans/request.md' },
        {
          signal: sdk.signal,
          requestId: 'control-X2',
          toolUseID: 'exit-X2',
          ...(scope === 'child' ? { agentID: 'child-X2' } : {})
        } as Parameters<typeof canUse>[2]
      )
      await vi.waitFor(() => {
        expect(events.some((event) => event.type === 'permission.requested')).toBe(true)
      })
      const approvalId = events.find((event) => event.type === 'permission.requested')!
      if (approvalId.type !== 'permission.requested') throw new Error('missing production request')
      try {
        expect(
          useChatStore.getState().sessions.s.session.pendingPlanReview?.providerRequest?.agentId
        ).toBe(scope === 'child' ? 'child-X2' : undefined)
        chatActions.approvePlan(approvalId.approvalId)
        const result = await pending
        expect(result?.behavior).toBe('allow')
        if (scope === 'child') expect(result).not.toHaveProperty('updatedPermissions')
        else expect(result).toHaveProperty('updatedPermissions')
        expect(chatActions.send('next main turn')).toBe(true)
        expect(useChatStore.getState().sessions.neighbor).toBe(neighbor)
        expect({
          renderer: useChatStore.getState().sessions.s.session.permissionMode,
          controller: permissionModes.getCurrentMode('s'),
          nextPayload: harness.chatSend.mock.calls[0][0].permissionMode
        }).toEqual({ renderer: expected, controller: expected, nextPayload: expected })
      } finally {
        sdk.abort()
        await pending
      }
    }
  )

  const responses = [
    { handler: 'approve', respond: (id: string) => chatActions.approvePlan(id) },
    { handler: 'revise', respond: (id: string) => chatActions.revisePlan(id, 'Revise this plan') },
    {
      handler: 'comments',
      respond: (id: string) =>
        chatActions.revisePlanWithComments(
          id,
          [{ id: 'c', quote: 'plan', start: 0, end: 4, body: 'Revise', createdAt: 1 }],
          ''
        )
    },
    { handler: 'reject', respond: (id: string) => chatActions.rejectPlan(id) }
  ]
  it.each(
    responses.flatMap((response) =>
      (['different-id', 'already-resolved'] as const).map((state) => ({ ...response, state }))
    )
  )(
    '$handler $state cannot change the active request, mode or response owner',
    ({ state, respond }) => {
      const harness = installChatStoreHarness({ agentKind: 'code', permissionMode: 'plan' })
      const start = useChatStore.getState()
      const neighbor = {
        ...start.sessions.s,
        session: { ...start.sessions.s.session, sessionId: 'neighbor' }
      }
      useChatStore.setState({ sessions: { ...start.sessions, neighbor } })
      const approvalId = state === 'different-id' ? 'current' : 'stale'
      const action: PermissionAction = {
        kind: 'plan_review',
        request: { requestId: approvalId, plan: '# Current plan' },
        providerRequest: { requestId: `control-${approvalId}`, toolUseId: `exit-${approvalId}` }
      }
      ingestChatEvent({
        type: 'permission.requested',
        sessionId: 's',
        approvalId,
        origin: 'agent',
        action
      })
      if (state === 'already-resolved') {
        ingestChatEvent({
          type: 'permission.resolved',
          sessionId: 's',
          approvalId,
          resolution: { behavior: 'deny' }
        })
        expect(useChatStore.getState().sessions.s.session.pendingPlanReview).toBeNull()
      }
      const before = useChatStore.getState().sessions.s.session
      respond('stale')
      const after = useChatStore.getState().sessions.s.session
      expect(useChatStore.getState().sessions.neighbor).toBe(neighbor)
      expect({
        sessionSame: after === before,
        requestSame: after.pendingPlanReview === before.pendingPlanReview,
        request: after.pendingPlanReview,
        mode: after.permissionMode,
        sent: harness.permissionRespond.mock.calls.length
      }).toEqual({
        sessionSame: true,
        requestSame: true,
        request: before.pendingPlanReview,
        mode: before.permissionMode,
        sent: 0
      })
    }
  )
})
