import { describe, expect, it, vi } from 'vitest'
import type { AppMessagePart } from '../../../../../shared/ipc'
import { newTranscriptChanges } from '../lib/transcript/changeLog'
import { messageOrderFor } from '../lib/transcript/messageOrder'
import { chatReducer, initialChatState, type ChatState, type Message } from './chatReducer'

describe('VP-12 chatReducer indexed lookups (EP-6 ③~⑨, 10,000 messages, 0 unrelated parts reads)', () => {
  it('routes output.captured, tool.call.completed, user idempotence, drop, subagent notice and task completion without scanning 10,000 unrelated messages', () => {
    const unrelatedReads = vi.fn()
    const messages: Message[] = Array.from({ length: 10_000 }, (_, i) => ({
      id: `hist:${i}`,
      role: 'assistant',
      createdAt: 0,
      get parts() {
        unrelatedReads(i)
        return []
      }
    }))
    messages[1] = {
      id: 'hist:1',
      role: 'assistant',
      createdAt: 0,
      parts: [
        { type: 'tool_call', toolRunId: 'early-tool', toolName: 'Write', args: {} },
        { type: 'tool_call', toolRunId: 'early-agent', toolName: 'Agent', args: {} }
      ]
    }
    messages[9_999] = {
      id: 'hist:9999',
      role: 'assistant',
      createdAt: 0,
      parts: [{ type: 'tool_call', toolRunId: 'tail-tool', toolName: 'Bash', args: {} }]
    }

    let state: ChatState = {
      ...initialChatState,
      sessionId: 's',
      messages,
      transcriptChanges: newTranscriptChanges()
    }
    // Prime the index once
    messageOrderFor(state, true)
    unrelatedReads.mockClear()

    // ③ & ⑤: output.captured at index 1 -> 0 unrelated parts reads
    state = chatReducer(state, {
      type: 'RECV_EVENT',
      event: {
        type: 'output.captured',
        sessionId: 's',
        toolRunId: 'early-tool',
        artifact: { publicationId: 'pub-1' } as Extract<
          AppMessagePart,
          { type: 'artifact' }
        >['artifact']
      }
    })
    expect(state.messages[1].parts.some((p) => p.type === 'artifact')).toBe(true)

    // ④: tool.call.completed at tail -> 0 unrelated parts reads
    state = chatReducer(state, {
      type: 'RECV_EVENT',
      event: {
        type: 'tool.call.completed',
        sessionId: 's',
        toolRunId: 'tail-tool',
        result: 'ok',
        isError: false,
        messageKey: 'hist:9999'
      }
    })
    expect(
      state.messages[9_999].parts.some(
        (p) => p.type === 'tool_result' && p.toolRunId === 'tail-tool'
      )
    ).toBe(true)

    // ⑥ & ⑦: APPEND_COMMITTED_USER_MESSAGE idempotence + DROP_UNCOMMITTED_USER
    state = chatReducer(state, { type: 'APPEND_COMMITTED_USER_MESSAGE', text: 'u', clientId: 'c1' })
    const lenAfterAdd = state.messages.length
    state = chatReducer(state, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: 'u',
      messageKey: 'u:c1',
      ids: ['c1']
    })
    expect(state.messages).toHaveLength(lenAfterAdd)
    state = chatReducer(state, { type: 'DROP_UNCOMMITTED_USER', clientId: 'c1' })
    expect(state.messages).toHaveLength(lenAfterAdd - 1)

    // ⑧ & ⑨: subagent.task settled notice idempotence + markCompletedAgentTask
    state = chatReducer(state, {
      type: 'RECV_EVENT',
      event: {
        type: 'subagent.task',
        sessionId: 's',
        toolUseId: 'early-agent',
        phase: 'settled',
        background: true,
        status: 'completed',
        summary: 'done',
        messageKey: 'hist:9999'
      } as unknown as Parameters<typeof chatReducer>[1] extends { event: infer E } ? E : never
    })
    const countBeforeDup = state.messages[9_999].parts.length
    state = chatReducer(state, {
      type: 'RECV_EVENT',
      event: {
        type: 'subagent.task',
        sessionId: 's',
        toolUseId: 'early-agent',
        phase: 'settled',
        background: true,
        status: 'completed',
        summary: 'done',
        messageKey: 'hist:9999'
      } as unknown as Parameters<typeof chatReducer>[1] extends { event: infer E } ? E : never
    })
    expect(state.messages[9_999].parts).toHaveLength(countBeforeDup)

    expect(unrelatedReads).not.toHaveBeenCalled()
  })
})
