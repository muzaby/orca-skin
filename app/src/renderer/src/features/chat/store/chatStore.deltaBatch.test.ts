import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../../../../shared/ipc'
import { initialChatState } from '../reducer/chatReducer'
import { ingestChatEvent, useChatStore, type LiveTurnState } from './chatStore'
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
    const replaced: string[] = []
    const unsubscribe = useChatStore.subscribe((state, previous) => {
      if (state.sessions.s !== previous.sessions.s) replaced.push(state.sessions.s.live.text)
    })
    const joinSpy = vi.spyOn(Array.prototype, 'join')
    ingestChatEvent(makeDelta('a', { messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('b', { messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('c', { messageKey: 'a:1' }))
    joinSpy.mockClear()

    flushRaf()

    unsubscribe()
    const emptyJoinCalls = joinSpy.mock.calls.filter((args) => args[0] === '')
    expect(emptyJoinCalls.length).toBe(1)
    joinSpy.mockRestore()

    const entry = useChatStore.getState().sessions.s
    expect(entry.live.text).toBe('abc')
    expect(entry.live.textKey).toBe('a:1')
    expect(entry.session.agentKindLocked).toBe(true)
    expect(entry.session.sendCount).toBe(1)
    expect(replaced).toEqual(['abc'])
    ingestChatEvent(makeReasoning('r', { messageKey: 'a:1' }))
    flushRaf()
    expect(useChatStore.getState().sessions.s.session).toBe(entry.session)
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
    ingestChatEvent(makeReasoning('ignored', { sessionId: 's2', parentToolRunId: 'child' }))
    ingestChatEvent(makeDelta('hel', { messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('child', { messageKey: 'a:1', parentToolRunId: 'tu-1' }))
    ingestChatEvent(makeDelta('lo', { messageKey: 'a:1' }))
    joinSpy.mockClear()

    flushRaf()

    const emptyJoinCalls = joinSpy.mock.calls.filter((args) => args[0] === '')
    expect(emptyJoinCalls.length).toBe(1)
    joinSpy.mockRestore()

    expect(useChatStore.getState().sessions.s.live.text).toBe('hello')
    expect(useChatStore.getState().sessions.s2.session.sendCount).toBe(0)
  })

  it('b4·b6: a child-only or unknown-session batch publishes no state change', () => {
    const previous = useChatStore.getState()
    const writes = vi.fn()
    const stop = useChatStore.subscribe(writes)
    try {
      ingestChatEvent(makeDelta('ignored', { parentToolRunId: 'tool' }))
      ingestChatEvent(makeReasoning('unknown', { sessionId: 'missing' }))
      flushRaf()
      expect(useChatStore.getState()).toBe(previous)
      expect(writes).not.toHaveBeenCalled()
    } finally {
      stop()
    }
  })

  it('b4: ignores a late delta routed through a pending draft whose entry was already removed', () => {
    useChatStore.setState({ pendingNewChatKey: 'vanished-draft' })
    const before = useChatStore.getState()
    try {
      ingestChatEvent(makeDelta('late', { sessionId: 'missing' }))
      flushRaf()
      expect(useChatStore.getState()).toBe(before)
    } finally {
      useChatStore.setState({ pendingNewChatKey: null })
    }
  })

  it('b7: changing messageKey splits run, commits previous text buffer under its key, and clears previous reasoning buffer', () => {
    ingestChatEvent(makeDelta('first', { messageKey: 'a:1' }))
    ingestChatEvent(makeDelta('second', { messageKey: 'a:2' }))
    ingestChatEvent(makeReasoning('old-think', { messageKey: 'a:1' }))
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

  it('b7·b8: text and reasoning keep independent owners when a key is reused by the other lane', () => {
    ingestChatEvent(makeDelta('one', { messageKey: 'a:text' }))
    ingestChatEvent(makeReasoning('visible thought', { messageKey: 'a:thought' }))
    flushRaf()
    ingestChatEvent(makeDelta(' plus', { messageKey: 'a:text' }))
    ingestChatEvent(makeReasoning('  ', { messageKey: 'a:text' }))
    flushRaf()
    let entry = useChatStore.getState().sessions.s
    expect(entry.live).toMatchObject({
      text: 'one plus',
      textKey: 'a:text',
      reasoning: '  ',
      reasoningKey: 'a:text',
      reasoningVisible: false
    })
    expect(entry.session.messages).toHaveLength(0)
    ingestChatEvent(makeReasoning('new', { messageKey: 'a:text' }))
    ingestChatEvent(makeDelta('two', { messageKey: 'a:thought' }))
    flushRaf()
    entry = useChatStore.getState().sessions.s
    expect(entry.live).toMatchObject({
      text: 'two',
      textKey: 'a:thought',
      reasoning: '  new',
      reasoningKey: 'a:text',
      reasoningVisible: true
    })
    expect(entry.session.messages.map((m) => [m.id, m.parts])).toEqual([
      ['a:text', [{ type: 'text', text: 'one plus' }]]
    ])
  })

  it('b9·b10: message.completed clears only matching textKey buffer and leaves another messageKey buffer intact', () => {
    // b9: A completed then B delta in same frame
    ingestChatEvent(makeReasoning('pending thought', { messageKey: 'a:thought' }))
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

    expect(entry.live).toMatchObject({
      reasoning: 'pending thought',
      reasoningKey: 'a:thought',
      reasoningVisible: true
    })
    // b10: message.completed for M ('a:1') while buffer holds N ('a:2') keeps N buffer intact
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      messageKey: 'a:1',
      message: { text: 'A-extra' }
    })
    flushRaf()

    entry = useChatStore.getState().sessions.s
    expect(entry.session.messages.map((m) => [m.id, m.parts])).toEqual([
      [
        'a:1',
        [
          { type: 'text', text: 'A' },
          { type: 'text', text: 'A-extra' }
        ]
      ]
    ])
    expect(entry.live.text).toBe('B')
    expect(entry.live.textKey).toBe('a:2')
  })

  it('retains the parent reasoning buffer on child and other-key completions, then clears it on its own completion', () => {
    ingestChatEvent(makeReasoning('main thought', { messageKey: 'a:1' }))
    flushRaf()
    const initial = useChatStore.getState().sessions.s.live
    expect(initial).toMatchObject({
      reasoningKey: 'a:1',
      reasoning: 'main thought',
      reasoningVisible: true
    })
    for (const fields of [{ messageKey: 'a:1', parentToolRunId: 'child' }, { messageKey: 'a:2' }]) {
      ingestChatEvent({
        type: 'message.reasoning',
        sessionId: 's',
        text: 'other thought',
        ...fields
      })
      flushRaf()
      expect(useChatStore.getState().sessions.s.live).toBe(initial)
    }
    ingestChatEvent({ type: 'message.reasoning', sessionId: 's', messageKey: 'a:1', text: 'done' })
    flushRaf()
    expect(useChatStore.getState().sessions.s.live).toMatchObject({
      reasoning: '',
      reasoningKey: undefined,
      reasoningVisible: false
    })
  })

  it('b10·b11: completes the owner of an empty delta and clears remaining owners on telemetry', () => {
    ingestChatEvent(makeDelta('', { messageKey: 'empty-text' }))
    ingestChatEvent(makeReasoning('', { messageKey: 'empty-reasoning' }))
    flushRaf()
    const live = (): LiveTurnState => useChatStore.getState().sessions.s.live
    expect(live()).toMatchObject({ textKey: 'empty-text', reasoningKey: 'empty-reasoning' })
    ingestChatEvent({
      type: 'message.reasoning',
      sessionId: 's',
      messageKey: 'empty-reasoning',
      text: ''
    })
    expect(live().reasoningKey).toBeUndefined()
    expect(live().textKey).toBe('empty-text')
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      messageKey: 'empty-text',
      message: { text: '' }
    })
    expect(live().textKey).toBeUndefined()
    for (const delta of [makeDelta, makeReasoning]) {
      ingestChatEvent(delta('', { messageKey: 'later' }))
      flushRaf()
      expect([live().textKey, live().reasoningKey]).toContain('later')
      ingestChatEvent({
        type: 'telemetry',
        sessionId: 's',
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }
      })
      expect(live().textKey).toBeUndefined()
      expect(live().reasoningKey).toBeUndefined()
      expect(
        useChatStore
          .getState()
          .sessions.s.session.messages.some((message) => message.id === 'later')
      ).toBe(false)
    }
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
