import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { userMessageId } from '../../../../../shared/message-id'
import { chatReducer, initialChatState } from '../reducer/chatReducer'
import { ingestChatEvent, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'

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
  const user = (id: string) => ({ id, role: 'user' as const, parts: [], createdAt: 1 })
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
  const event = (id: string) => ({
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
