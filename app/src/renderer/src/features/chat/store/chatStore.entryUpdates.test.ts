import { beforeEach, describe, expect, it } from 'vitest'
import { chatActions, ingestChatEvent, useChatStore } from './chatStore'
import { flushRaf, installChatStoreHarness } from './chatStore.testHarness'
import { initialChatState } from '../reducer/chatReducer'
import { childMessageForParentToolRunId, partsText } from '../lib/parts'

beforeEach(() => installChatStoreHarness({ inflight: true, turnStartedAt: 1 }))

describe('chat entry update boundaries', () => {
  it('preserves the root and does not notify for reducer no-ops', () => {
    const before = useChatStore.getState()
    let notifications = 0
    const unsubscribe = useChatStore.subscribe(() => notifications++)
    try {
      chatActions.setDiffComparison({ kind: 'all' })
      chatActions.removeDiffRequirement('missing')
      chatActions.selectDiffRequirement('missing')
      expect(useChatStore.getState()).toBe(before)
      expect(notifications).toBe(0)
    } finally {
      unsubscribe()
    }
  })

  it('publishes completed text and cleared live preview together while preserving other entries', () => {
    const other = {
      session: { ...initialChatState, sessionId: 'other' },
      live: { text: '', reasoning: '' },
      subagentMeta: {}
    }
    useChatStore.setState((state) => ({ sessions: { ...state.sessions, other } }))
    ingestChatEvent({ type: 'message.delta', sessionId: 's', delta: { text: 'partial' } })
    flushRaf()
    const observed: { text: string; live: string }[] = []
    const unsubscribe = useChatStore.subscribe((state) => {
      const entry = state.sessions.s
      observed.push({ text: partsText(entry.session.messages[0].parts), live: entry.live.text })
    })
    try {
      ingestChatEvent({ type: 'message.completed', sessionId: 's', message: { text: 'complete' } })
      expect(observed).toEqual([{ text: 'complete', live: '' }])
      expect(useChatStore.getState().sessions.other).toBe(other)
    } finally {
      unsubscribe()
    }
  })

  it('preserves the main preview when a child completes and exposes its text only in the child transcript', () => {
    const other = {
      session: { ...initialChatState, sessionId: 'other' },
      live: { text: 'other preview', reasoning: '' },
      subagentMeta: {}
    }
    useChatStore.setState((state) => ({ sessions: { ...state.sessions, other } }))
    ingestChatEvent({ type: 'message.delta', sessionId: 's', delta: { text: 'main preview' } })
    flushRaf()
    const mainLive = useChatStore.getState().sessions.s.live

    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      parentToolRunId: 'parent-task',
      message: { text: 'child complete' }
    })

    const state = useChatStore.getState()
    const entry = state.sessions.s
    expect(entry.live).toBe(mainLive)
    expect(entry.live.text).toBe('main preview')
    expect(entry.session.messages.flatMap((message) => message.parts)).toEqual([
      { type: 'text', text: 'child complete', parentToolRunId: 'parent-task' }
    ])
    expect(entry.session.messages.map((message) => partsText(message.parts))).toEqual([''])
    const child = childMessageForParentToolRunId(entry.session.messages, 'parent-task')
    expect(child).not.toBeNull()
    expect(partsText(child!.parts)).toBe('child complete')
    expect(state.sessions.other).toBe(other)
  })

  it('commits remaining text before telemetry settles the turn, then advances and sends the queued draft', () => {
    const { chatSend } = installChatStoreHarness({
      sessionId: null,
      inflight: true,
      turnStartedAt: 1
    })
    useChatStore.setState((state) => ({
      sessions: { ...state.sessions, next: { ...state.sessions.s } },
      pendingNewChatKey: 's',
      newChatQueue: [{ key: 'next', payload: { sessionId: null, projectId: null, text: 'next' } }]
    }))
    ingestChatEvent({ type: 'message.delta', sessionId: 'unissued', delta: { text: 'remaining' } })
    ingestChatEvent({
      type: 'message.reasoning.delta',
      sessionId: 'unissued',
      delta: { text: 'thinking' }
    })
    flushRaf()
    const order: string[] = []
    const unsubscribe = useChatStore.subscribe((state) => {
      const entry = state.sessions.s
      expect(partsText(entry.session.messages[0].parts)).toBe('remaining')
      expect(entry.session.inflight).toBe(false)
      expect(entry.live).toEqual({ text: '', reasoning: '' })
      order.push(state.pendingNewChatKey === 's' ? 'settled' : 'gate')
    })
    chatSend.mockImplementation(() => {
      expect(useChatStore.getState().pendingNewChatKey).toBe('next')
      order.push('send')
      return Promise.resolve()
    })
    try {
      ingestChatEvent({
        type: 'telemetry',
        sessionId: 'unissued',
        usage: { inputTokens: 1, outputTokens: 2 }
      })
      expect(order).toEqual(['settled', 'gate', 'send'])
      expect(chatSend).toHaveBeenCalledExactlyOnceWith({
        sessionId: null,
        projectId: null,
        text: 'next'
      })
    } finally {
      unsubscribe()
    }
  })
})
