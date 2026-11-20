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
