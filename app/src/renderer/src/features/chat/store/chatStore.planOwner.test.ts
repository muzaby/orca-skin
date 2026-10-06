import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
const transport = vi.hoisted(() => ({
  deliver: undefined as undefined | ((event: unknown) => void)
}))
vi.mock('../../../../../main/infra/ipc/send', () => ({
  sendChatEvent: (_owner: unknown, event: unknown) => transport.deliver?.(event)
}))
import { createApprovalRequester } from '../../../../../main/app/chat-turn/approval'
import { ApprovalBroker } from '../../../../../main/features/approvals/broker'
import { chatActions, ingestChatEvent, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { initialChatState, type ChatState } from '../reducer/chatReducer'
import { partsToolCalls } from '../lib/parts'
import { agentUiPolicy } from '../lib/agentPresentation'
import { ToolCard } from '../components/transcript/ToolCard'
import { WorkToolBody } from '../components/transcript/WorkToolBody'
import type {
  ApprovalResolution,
  NormalizedEvent,
  PermissionAction
} from '../../../../../shared/ipc'

afterEach(() => {
  transport.deliver = undefined
})

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

const correctedInput = {
  plan: '# 승인 시점 계획',
  planFilePath: 'C:/plans/owner.md',
  allowedPrompts: [{ tool: 'Bash', prompt: '테스트를 실행한다' }],
  extra: 'keep'
}
const actions: PermissionAction[] = [
  { kind: 'ask_question', request: { requestId: '', questions: [] } },
  {
    kind: 'plan_review',
    request: { requestId: '', plan: correctedInput.plan },
    input: correctedInput,
    providerRequest: { requestId: 'control', toolUseId: 'exit' }
  },
  { kind: 'tool_approval', toolName: 'Bash', input: { command: 'run-tests' } }
]

function installPendingDraft(): void {
  installChatStoreHarness()
  const state = useChatStore.getState()
  useChatStore.setState({
    sessions: {
      ...state.sessions,
      draft: {
        session: { ...initialChatState, inflight: true },
        live: { text: '', reasoning: '' },
        subagentMeta: {}
      }
    },
    pendingNewChatKey: 'draft',
    activeKey: 's'
  })
}

function approvalIds(session: ChatState): string[] {
  return [
    ...session.pendingAsks.map((request) => request.requestId),
    ...(session.pendingPlanReview ? [session.pendingPlanReview.requestId] : []),
    ...session.pendingToolApprovals.map((request) => request.approvalId)
  ]
}

function relayRequest(action: PermissionAction): {
  turn: { dbSessionId: string | null; controller: AbortController; agentKind: string }
  sdk: AbortController
  broker: ApprovalBroker<ApprovalResolution>
  persist: ReturnType<typeof vi.fn>
  pending: Promise<ApprovalResolution>
  events: NormalizedEvent[]
  id: string
} {
  const events: NormalizedEvent[] = []
  transport.deliver = (event) => {
    events.push(event as NormalizedEvent)
    ingestChatEvent(event as NormalizedEvent)
  }
  const turn = {
    dbSessionId: null as string | null,
    controller: new AbortController(),
    agentKind: 'code'
  }
  const sdk = new AbortController()
  const broker = new ApprovalBroker<ApprovalResolution>()
  const persist = vi.fn()
  const request = createApprovalRequester({
    wc: {},
    approvals: {
      isSessionAllowed: () => false,
      register: (id: string, _turn: unknown, signal: AbortSignal) =>
        broker.register(id, signal, { behavior: 'deny' })
    },
    persistence: { persist },
    permissionModes: { setMode: vi.fn() },
    getActiveTurn: () => turn
  } as never)
  const pending = request(action, sdk.signal)
  const requested = events.find((event) => event.type === 'permission.requested')!
  if (requested.type !== 'permission.requested') throw new Error('missing approval event')
  return { turn, sdk, broker, persist, pending, events, id: requested.approvalId }
}

describe('0249 ΔV3.1 — 실제 requester와 draft 승인 수명', () => {
  it.each(actions.flatMap((action) => ['deny', 'sdk-cancel'].map((end) => ({ action, end }))))(
    '$action.kind/$end: init 전 해결은 탐색 이후에도 요청 draft만 정리한다',
    async ({ action, end }) => {
      installPendingDraft()
      const other = useChatStore.getState().sessions.s
      const relay = relayRequest(action)
      try {
        expect(approvalIds(useChatStore.getState().sessions.draft.session)).toEqual([relay.id])
        expect(useChatStore.getState().sessions.s).toBe(other)
        chatActions.newChat()
        const unsent = useChatStore.getState().sessions[useChatStore.getState().activeKey]
        if (end === 'sdk-cancel') relay.sdk.abort()
        else relay.broker.resolve(relay.id, { behavior: 'deny' })
        expect(await relay.pending).toEqual({ behavior: 'deny' })
        expect(approvalIds(useChatStore.getState().sessions.draft.session)).toEqual([])
        expect(useChatStore.getState().sessions.s).toBe(other)
        expect(useChatStore.getState().sessions[useChatStore.getState().activeKey]).toBe(unsent)
        expect(useChatStore.getState().pendingNewChatKey).toBe('draft')
        expect(relay.events.map((event) => event.type)).toEqual([
          'permission.requested',
          'permission.resolved'
        ])
      } finally {
        relay.broker.resolve(relay.id, { behavior: 'deny' })
        await relay.pending
      }
    }
  )

  it('승격 후 실제 SID 해결·Work/Code 계획 카드·이웃 입력이 같은 소유자를 유지한다', async () => {
    installPendingDraft()
    useChatStore.setState({ activeKey: 'draft' })
    for (const call of [
      { toolRunId: 'neighbor', toolName: 'Read', args: { file_path: 'neighbor.md' } },
      { toolRunId: 'exit', toolName: 'ExitPlanMode', args: { allowedPrompts: [] } }
    ])
      ingestChatEvent({ type: 'tool.call.started', sessionId: '', ...call })
    const neighbor = useChatStore.getState().sessions.draft.session.messages[0].parts[0]
    useChatStore.setState({ activeKey: 's' })
    const other = useChatStore.getState().sessions.s
    const relay = relayRequest(actions[1])
    try {
      expect(relay.persist).toHaveBeenCalledTimes(1)
      const before = useChatStore.getState().sessions.draft.session
      expect(before.pendingPlanReview?.requestId).toBe(relay.id)
      relay.turn.dbSessionId = 'promoted'
      ingestChatEvent({ type: 'session.updated', sessionId: 'promoted', patch: {} })
      const promoted = useChatStore.getState().sessions.promoted.session
      expect(useChatStore.getState().sessions.draft).toBeUndefined()
      expect(promoted.messages).toBe(before.messages)
      expect(promoted.pendingPlanReview).toBe(before.pendingPlanReview)
      expect(promoted.messages[0].parts[0]).toBe(neighbor)
      expect(useChatStore.getState().sessions.s).toBe(other)
      const call = partsToolCalls(promoted.messages[0].parts).find(
        (item) => item.toolUseId === 'exit'
      )!
      expect(call.input).toBe(correctedInput)
      const code = load(
        renderToStaticMarkup(
          createElement(ToolCard, {
            call,
            presentation: 'detail-body',
            transcriptPolicy: agentUiPolicy('code').transcript
          })
        )
      )
      expect(code.text()).toContain(correctedInput.plan)
      expect(code.text()).toContain(correctedInput.planFilePath)
      expect(code.text()).toContain('allowedPrompts:')
      const work = load(renderToStaticMarkup(createElement(WorkToolBody, { call })))
      expect(JSON.parse(work('section').first().find('pre').text())).toEqual(correctedInput)
      relay.broker.resolve(relay.id, { behavior: 'allow' })
      await relay.pending
      expect(approvalIds(useChatStore.getState().sessions.promoted.session)).toEqual([])
      expect(relay.events.at(-1)).toMatchObject({
        type: 'permission.resolved',
        sessionId: 'promoted'
      })
      expect(useChatStore.getState().sessions.s).toBe(other)
    } finally {
      relay.broker.resolve(relay.id, { behavior: 'deny' })
      await relay.pending
    }
  })

  it('다음 queued draft를 열어도 승인은 dispatch된 draft에 붙고 늦은 해결은 다음 retry를 보존한다', async () => {
    const { chatSend } = installChatStoreHarness()
    chatActions.newChat()
    expect(chatActions.send('A')).toBe(true)
    const owner = useChatStore.getState().pendingNewChatKey!
    chatActions.newChat()
    expect(chatActions.send('B')).toBe(true)
    const queued = useChatStore.getState().activeKey
    const next = useChatStore.getState().sessions[queued]
    const relay = relayRequest(actions[1])
    try {
      expect(approvalIds(useChatStore.getState().sessions[owner].session)).toEqual([relay.id])
      expect(useChatStore.getState().sessions[queued]).toBe(next)
      expect(chatSend).toHaveBeenCalledTimes(1)
      ingestChatEvent({ type: 'turn.aborted', reason: 'user_cancelled' })
      expect(useChatStore.getState().pendingNewChatKey).toBe(queued)
      expect(chatSend).toHaveBeenCalledTimes(2)
      ingestChatEvent({
        type: 'turn.retrying',
        sessionId: '',
        attempt: 1,
        maxRetries: 3,
        error: { category: 'stream_error', message: 'retry', retryable: true }
      })
      const before = useChatStore.getState()
      relay.sdk.abort()
      await relay.pending
      expect(useChatStore.getState()).toBe(before)
      expect(useChatStore.getState().sessions[queued].session.retry?.attempt).toBe(1)
      ingestChatEvent({
        type: 'permission.resolved',
        approvalId: 'unknown',
        resolution: { behavior: 'deny' }
      })
      expect(useChatStore.getState()).toBe(before)
    } finally {
      relay.broker.resolve(relay.id, { behavior: 'deny' })
      await relay.pending
    }
  })

  it('noid 해결은 gate가 이동한 뒤에도 남은 승인 ID 소유자를 찾아 정리한다', () => {
    installPendingDraft()
    ingestChatEvent({
      type: 'permission.requested',
      approvalId: 'old',
      origin: 'agent',
      action: { kind: 'ask_question', request: { requestId: 'old', questions: [] } }
    })
    const state = useChatStore.getState()
    useChatStore.setState({ pendingNewChatKey: null, activeKey: 's' })
    ingestChatEvent({
      type: 'permission.resolved',
      approvalId: 'old',
      resolution: { behavior: 'deny' }
    })
    expect(approvalIds(useChatStore.getState().sessions.draft.session)).toEqual([])
    expect(useChatStore.getState().sessions.s).toBe(state.sessions.s)
  })
})
