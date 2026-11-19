import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../../../../shared/ipc'
import { initialChatState } from '../reducer/chatReducer'
import { ingestChatEvent, useChatStore } from './chatStore'
import { flushRaf, installChatStoreHarness } from './chatStore.testHarness'

const makeDelta = (
  text: string,
  opts?: { sessionId?: string; messageKey?: string; parentToolRunId?: string }
): NormalizedEvent => ({
  type: 'message.delta',
  sessionId: opts?.sessionId ?? 's',
  delta: { text },
  messageKey: opts?.messageKey,
  parentToolRunId: opts?.parentToolRunId
})

const makeReasoning = (
  text: string,
  opts?: { sessionId?: string; messageKey?: string; parentToolRunId?: string }
): NormalizedEvent => ({
  type: 'message.reasoning.delta',
  sessionId: opts?.sessionId ?? 's',
  delta: { text },
  messageKey: opts?.messageKey,
  parentToolRunId: opts?.parentToolRunId
})

describe('chatStore receiveDeltaBatch (EP-20 b1~b11)', () => {
  beforeEach(() => {
    installChatStoreHarness()
    useChatStore.setState({
      activeKey: 's',
      sessions: {
        s: {
          session: { ...initialChatState, sessionId: 's' },
          live: { text: '', reasoning: '', reasoningVisible: false },
          subagentMeta: {}
        },
        s2: {
          session: { ...initialChatState, sessionId: 's2' },
          live: { text: '', reasoning: '', reasoningVisible: false },
          subagentMeta: {}
        }
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('b1·b5: merges consecutive same-session text deltas into 1 join and 1 entry replacement and triggers BEGIN_TURN once', () => {
    const joinSpy = vi.spyOn(Array.prototype, 'join')
    ingestChatEvent(makeDelta('a', { messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('b', { messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('c', { messageKey: 'a:1' }))
    joinSpy.mockClear()

    flushRaf()

    const emptyJoinCalls = joinSpy.mock.calls.filter((args) => args[0] === '')
    expect(emptyJoinCalls.length).toBe(1)
    joinSpy.mockRestore()

    const entry = useChatStore.getState().sessions.s
    expect(entry.live.text).toBe('abc')
    expect(entry.live.textKey).toBe('a:1')
    expect(entry.session.agentKindLocked).toBe(true)
    expect(entry.session.agentPanelInitialized).toBe(true)
  })

  it('b2·b3: splits runs when delta kind changes (text -> reasoning -> text)', () => {
    const joinSpy = vi.spyOn(Array.prototype, 'join')
    ingestChatEvent(makeDelta('t1', { messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('t2', { messageKey: 'a:1' }))
    ingestChatEvent(makeReasoning('r1', { messageKey: 'a:1' }))
    ingestChatEvent(makeReasoning('r2', { messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('t3', { messageKey: 'a:1' }))
    joinSpy.mockClear()

    flushRaf()

    const emptyJoinCalls = joinSpy.mock.calls.filter((args) => args[0] === '')
    expect(emptyJoinCalls.length).toBe(3)
    joinSpy.mockRestore()

    const entry = useChatStore.getState().sessions.s
    expect(entry.live.text).toBe('t1t2t3')
    expect(entry.live.reasoning).toBe('r1r2')
    expect(entry.live.text).not.toContain('r1')
  })

  it('b4: splits runs across interleaved sessions A and B', () => {
    const joinSpy = vi.spyOn(Array.prototype, 'join')
    ingestChatEvent(makeDelta('A1', { sessionId: 's', messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('B1', { sessionId: 's2', messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('A2', { sessionId: 's', messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('B2', { sessionId: 's2', messageKey: 'a:1' }))
    joinSpy.mockClear()

    flushRaf()

    const emptyJoinCalls = joinSpy.mock.calls.filter((args) => args[0] === '')
    expect(emptyJoinCalls.length).toBe(4)
    joinSpy.mockRestore()

    expect(useChatStore.getState().sessions.s.live.text).toBe('A1A2')
    expect(useChatStore.getState().sessions.s2.live.text).toBe('B1B2')
  })

  it('b6: skips parentToolRunId deltas without breaking the surrounding run', () => {
    const joinSpy = vi.spyOn(Array.prototype, 'join')
    ingestChatEvent(makeDelta('hel', { messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('child', { messageKey: 'a:1', parentToolRunId: 'tu-1' }))
    ingestChatEvent(makeDelta('lo', { messageKey: 'a:1' }))
    joinSpy.mockClear()

    flushRaf()

    const emptyJoinCalls = joinSpy.mock.calls.filter((args) => args[0] === '')
    expect(emptyJoinCalls.length).toBe(1)
    joinSpy.mockRestore()

    expect(useChatStore.getState().sessions.s.live.text).toBe('hello')
  })

  it('b7: changing messageKey splits run, commits previous text buffer under its key, and clears previous reasoning buffer', () => {
    ingestChatEvent(makeDelta('first', { messageKey: 'a:1' }))
    ingestChatEvent(makeReasoning('old-think', { messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('second', { messageKey: 'a:2' }))
    ingestChatEvent(makeReasoning('new-think', { messageKey: 'a:2' }))
    flushRaf()

    const entry = useChatStore.getState().sessions.s
    expect(entry.live.text).toBe('second')
    expect(entry.live.textKey).toBe('a:2')
    expect(entry.live.reasoning).toBe('new-think')
    expect(entry.live.reasoningKey).toBe('a:2')

    const committed = entry.session.messages.find((m) => m.id === 'a:1')
    expect(committed).toBeDefined()
    expect(committed?.parts).toEqual([{ type: 'text', text: 'first' }])
  })

  it('b8: same messageKey text -> reasoning -> text without completion appends to one text buffer with 0 commits', () => {
    ingestChatEvent(makeDelta('p1', { messageKey: 'a:1' }))
    ingestChatEvent(makeReasoning('r1', { messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('p2', { messageKey: 'a:1' }))
    flushRaf()

    const entry = useChatStore.getState().sessions.s
    expect(entry.live.text).toBe('p1p2')
    expect(entry.session.messages).toHaveLength(0)
  })

  it('b9·b10: message.completed clears only matching textKey buffer and leaves another messageKey buffer intact', () => {
    // b9: A completed then B delta in same frame
    ingestChatEvent(makeDelta('A', { messageKey: 'a:1' }))
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      messageKey: 'a:1',
      message: { text: 'A' }
    })
    ingestChatEvent(makeDelta('B', { messageKey: 'a:2' }))
    flushRaf()

    let entry = useChatStore.getState().sessions.s
    expect(entry.session.messages.map((m) => m.id)).toEqual(['a:1'])
    expect(entry.live.text).toBe('B')
    expect(entry.live.textKey).toBe('a:2')

    // b10: message.completed for M ('a:1') while buffer holds N ('a:2') keeps N buffer intact
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      messageKey: 'a:1',
      message: { text: 'A-extra' }
    })
    flushRaf()

    entry = useChatStore.getState().sessions.s
    expect(entry.live.text).toBe('B')
    expect(entry.live.textKey).toBe('a:2')
  })

  it('b11: telemetry fallback commits pending text under live.textKey even if it is not the last assistant message', () => {
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      messageKey: 'a:1',
      message: { text: 'msg1' }
    })
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      messageKey: 'a:2',
      message: { text: 'msg2' }
    })
    ingestChatEvent(makeDelta('tail-for-1', { messageKey: 'a:1' }))
    flushRaf()

    ingestChatEvent({
      type: 'telemetry',
      sessionId: 's',
      usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }
    })
    flushRaf()

    const entry = useChatStore.getState().sessions.s
    expect(entry.live.text).toBe('')
    const msg1 = entry.session.messages.find((m) => m.id === 'a:1')
    expect(msg1?.parts).toEqual([
      { type: 'text', text: 'msg1' },
      { type: 'text', text: 'tail-for-1' }
    ])
  })
})
