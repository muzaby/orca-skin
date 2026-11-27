import type { LoadedMessage, NormalizedEvent } from '../../../../../shared/ipc'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { userMessageId } from '../../../../../shared/message-id'
import { chatReducer, initialChatState } from '../reducer/chatReducer'
import { ingestChatEvent, useChatStore } from './chatStore'
import { flushRaf, installChatStoreHarness } from './chatStore.testHarness'

describe('VP-07 chatStore commit echo (r12)', () => {
  beforeEach(() => {
    installChatStoreHarness()
    const base = chatReducer(initialChatState, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: 'first',
      clientId: 'a'
    })
    useChatStore.setState({
      activeKey: 's',
      sessions: {
        s: {
          session: { ...base, sessionId: 's' },
          live: { text: '', reasoning: '', reasoningVisible: false },
          pendingSteer: [
            { id: 'b', text: 'steer', createdAt: 2 },
            { id: 'c', text: 'later', createdAt: 3 }
          ],
          subagentMeta: {}
        }
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('r12 independently publishes a pending-only cleanup and a transcript-only commit', () => {
    const initial = useChatStore.getState().sessions.s
    const event = {
      type: 'message.committed' as const,
      sessionId: 's',
      ids: ['b'],
      text: 'committed',
      messageId: 21,
      createdAt: 0,
      messageKey: 'u:a'
    }
    ingestChatEvent(event)
    const cleaned = useChatStore.getState().sessions.s
    expect(cleaned.session).toBe(initial.session)
    expect(cleaned.pendingSteer).toEqual([initial.pendingSteer![1]])
    expect(cleaned.live).toBe(initial.live)
    const confirmed = { ...event, messageKey: 'u:fresh', ids: ['fresh'] }
    ingestChatEvent(confirmed)
    const committed = useChatStore.getState().sessions.s
    expect(committed.pendingSteer).toBe(cleaned.pendingSteer)
    expect(committed.session.messages.at(-1)).toMatchObject({
      id: 'u:fresh',
      clientId: 'fresh',
      createdAt: 0
    })
    expect(committed.live).toBe(cleaned.live)
    ingestChatEvent(confirmed)
    expect(useChatStore.getState().sessions.s).toBe(committed)
    const entry = { ...committed, pendingSteer: undefined }
    useChatStore.setState({ sessions: { s: entry } })
    ingestChatEvent(confirmed)
    expect(useChatStore.getState().sessions.s).toBe(entry)
  })

  it('a mixed batch replaces the optimistic bubble and clears pending steer in one update', () => {
    const notifications = vi.fn()
    const unsub = useChatStore.subscribe(notifications)
    try {
      const event = {
        type: 'message.committed' as const,
        sessionId: 's',
        ids: ['a', 'b'],
        text: 'first\nsteer',
        messageId: 10,
        createdAt: 2,
        messageKey: userMessageId(['a', 'b'])
      }
      ingestChatEvent(event)
      const entry = useChatStore.getState().sessions.s
      expect(notifications).toHaveBeenCalledTimes(1)
      expect(entry.session.messages.map((m) => m.id)).toEqual(['u:a,b'])
      expect(entry.session.messages[0].parts).toEqual([{ type: 'text', text: 'first\nsteer' }])
      expect(entry.pendingSteer?.map((item) => item.id)).toEqual(['c'])
      ingestChatEvent(event)
      expect(useChatStore.getState().sessions.s).toBe(entry)
      expect(notifications).toHaveBeenCalledTimes(1)
    } finally {
      unsub()
    }
  })
})

it('keeps the live stream of B on a late first receipt for A and on redelivery, then resets it on B’s own terminal', () => {
  installChatStoreHarness()
  const user = (id: string): LoadedMessage => ({
    id,
    role: 'user' as const,
    parts: [],
    createdAt: 1
  })
  let session = chatReducer(initialChatState, {
    type: 'LOAD_SESSION',
    session: { id: 's', agentKind: 'code', backend: 'claude', title: null, messages: [user('u:a')] }
  })
  session = chatReducer(chatReducer(session, { type: 'BEGIN_TURN' }), {
    type: 'APPEND_COMMITTED_USER_MESSAGE',
    messageKey: 'u:b',
    text: 'B'
  })
  const live = { text: 'stream B', reasoning: 'detail', reasoningVisible: true }
  useChatStore.setState({ activeKey: 's', sessions: { s: { session, live, subagentMeta: {} } } })
  const event = (id: string): NormalizedEvent => ({
    type: 'error' as const,
    sessionId: 's',
    messageKey: 'a:' + id,
    error: { category: 'stream_error' as const, message: 'fail', retryable: true },
    failure: {
      failureId: id,
      assistantMessageKey: 'a:' + id,
      ownerUserMessageKey: 'u:' + id,
      occurredAt: 7
    }
  })
  ingestChatEvent(event('a'))
  ingestChatEvent(event('a'))
  expect(useChatStore.getState().sessions.s.live).toBe(live)
  expect(useChatStore.getState().sessions.s.session.inflight).toBe(true)
  ingestChatEvent(event('b'))
  expect(useChatStore.getState().sessions.s.live.text).toBe('')
  expect(useChatStore.getState().sessions.s.session.inflight).toBe(false)
})

it.each(['late insertions', 'automatic completion', 'automatic delta'] as const)(
  'settles only the original input even when %s move the live turn boundary',
  (scenario) => {
    installChatStoreHarness()
    const users = ['first', 'second', 'third'].map((id): LoadedMessage => ({
      id: 'u:' + id,
      role: 'user',
      parts: [],
      createdAt: 1
    }))
    let session = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: { id: 's', agentKind: 'code', backend: 'claude', title: null, messages: users }
    })
    if (scenario === 'late insertions') session = chatReducer(session, { type: 'BEGIN_TURN' })
    useChatStore.setState({
      activeKey: 's',
      sessions: {
        s: { session, live: { text: '', reasoning: '', reasoningVisible: false }, subagentMeta: {} }
      }
    })
    const receive = (id: string): void =>
      ingestChatEvent({
        type: 'error',
        sessionId: 's',
        messageKey: 'a:' + id,
        error: { category: 'stream_error', message: 'fault', retryable: true },
        failure: {
          failureId: id,
          ownerUserMessageKey: id,
          assistantMessageKey: 'a:' + id,
          occurredAt: 10
        }
      })
    const current = scenario === 'late insertions' ? 'u:active' : 'i:scheduled'
    ingestChatEvent({
      type: 'message.committed',
      sessionId: 's',
      messageKey: current,
      messageId: 100,
      ids: scenario === 'late insertions' ? ['active'] : [],
      text: 'input',
      createdAt: 10
    })
    if (scenario === 'automatic completion') {
      ingestChatEvent({
        type: 'message.completed',
        sessionId: 's',
        message: { text: 'working' },
        messageKey: 'a:partial'
      })
    } else {
      ingestChatEvent({
        type: 'message.delta',
        sessionId: 's',
        delta: { text: 'working' },
        messageKey: 'a:partial'
      })
      flushRaf()
    }
    const state = (): typeof session => useChatStore.getState().sessions.s.session
    expect(state().inflight).toBe(true)
    const expectCurrentBoundary = (): void => {
      expect(state().openCodeTodoTurnStartIndex).toBe(
        state().messages.findIndex((message) => message.id === current)
      )
    }
    expectCurrentBoundary()
    if (scenario === 'late insertions') {
      // Each previously unseen receipt inserts one assistant before the active input.
      for (const owner of ['u:second', 'u:first', 'u:third']) {
        receive(owner)
        expect(state().inflight, owner).toBe(true)
        expect(useChatStore.getState().sessions.s.live.text).toBe('working')
        expectCurrentBoundary()
      }
    }
    receive(current)
    expect(state().inflight).toBe(false)
    expect(state().messages.find((m) => m.id === 'a:' + current)?.parts).toHaveLength(1)
  }
)

it('publishes a receipt and its live reset atomically when a subscriber starts the next input', () => {
  installChatStoreHarness()
  const commit = (id: string): void =>
    ingestChatEvent({
      type: 'message.committed',
      sessionId: 's',
      messageKey: 'u:' + id,
      messageId: 100,
      ids: [id],
      text: 'input',
      createdAt: 10
    })
  const stream = (id: string): void => {
    commit(id)
    ingestChatEvent({
      type: 'message.delta',
      sessionId: 's',
      delta: { text: id },
      messageKey: 'a:' + id
    })
    flushRaf()
  }
  stream('first')
  const unsubscribe = useChatStore.subscribe((next, previous) => {
    if (previous.sessions.s.session.inflight && !next.sessions.s.session.inflight) stream('next')
  })
  try {
    ingestChatEvent({
      type: 'error',
      sessionId: 's',
      messageKey: 'a:first',
      error: { category: 'stream_error', message: 'fault', retryable: true },
      failure: {
        failureId: 'failure',
        ownerUserMessageKey: 'u:first',
        assistantMessageKey: 'a:first',
        occurredAt: 10
      }
    })
    expect(useChatStore.getState().sessions.s.session.inflight).toBe(true)
    expect(useChatStore.getState().sessions.s.live.text).toBe('next')
  } finally {
    unsubscribe()
  }
})
