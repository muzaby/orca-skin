import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { userMessageId } from '../../../../../shared/message-id'
import { newTranscriptChanges } from '../lib/transcript/changeLog'
import { messageOrderFor } from '../lib/transcript/messageOrder'
import { initialChatState, type Message } from '../reducer/chatReducer'
import { ingestChatEvent, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'

describe('VP-12 chatStore message.cancelled indexed lookup (EP-6 ⑩)', () => {
  beforeEach(() => {
    installChatStoreHarness()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('recovers uncommitted bubbles by id without scanning history', () => {
    const historyReads = vi.fn()
    const messages: Message[] = Array.from({ length: 5_000 }, (_, i) => ({
      id: `h:${i}`,
      role: 'assistant',
      createdAt: 0,
      get parts() {
        historyReads(i)
        return []
      }
    }))
    messages.push({
      id: userMessageId(['draft-1']),
      role: 'user',
      clientId: 'draft-1',
      createdAt: 1,
      parts: [{ type: 'text', text: 'cancelled prompt' }]
    })
    const session = {
      ...initialChatState,
      sessionId: 's',
      messages,
      transcriptChanges: newTranscriptChanges()
    }
    // Prime index
    messageOrderFor(session, true)
    historyReads.mockClear()

    useChatStore.setState({
      activeKey: 's',
      sessions: {
        s: {
          session,
          live: { text: '', reasoning: '', reasoningVisible: false },
          pendingSteer: [{ id: 'steer-2', text: 'cancelled steer', createdAt: 2 }],
          subagentMeta: {}
        }
      }
    })

    ingestChatEvent({
      type: 'message.cancelled',
      sessionId: 's',
      ids: ['draft-1', 'steer-2'],
      reason: 'aborted'
    } as Parameters<typeof ingestChatEvent>[0])

    const after = useChatStore.getState().sessions.s
    expect(after.session.messages.find((m) => m.id === userMessageId(['draft-1']))).toBeUndefined()
    expect(after.pendingSteer ?? []).toHaveLength(0)
    expect(useChatStore.getState().draftRestore?.text).toBe('cancelled prompt\n\ncancelled steer')
    expect(historyReads).not.toHaveBeenCalled()
  })
})
