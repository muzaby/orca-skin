import { describe, expect, it, vi } from 'vitest'
import type { AppMessagePart, LoadedMessage, NormalizedEvent } from '../../../../../shared/ipc'
import { chatActions, useChatStore } from '../store/chatStore'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'

const message = (
  id: string,
  role: LoadedMessage['role'],
  ...parts: AppMessagePart[]
): LoadedMessage => ({ id, role, createdAt: 0, parts })
const text = (text: string): AppMessagePart => ({ type: 'text', text })
const LOAD = (messages: LoadedMessage[], complete = false): ChatState =>
  chatReducer(initialChatState, {
    type: 'LOAD_SESSION',
    session: { id: 's', backend: 'claude', agentKind: 'code', title: null, messages },
    complete
  })
const tail = [message('u:tail', 'user', text('next'))]
const result = (id: string, result: string, owner = true): NormalizedEvent => ({
  type: 'tool.call.completed',
  sessionId: 's',
  messageKey: id,
  ...(owner ? { messageKeySource: 'owner' } : {}),
  toolRunId: 'tool',
  result,
  isError: false
})
const recv = (state: ChatState, event: NormalizedEvent): ChatState =>
  chatReducer(state, { type: 'RECV_EVENT', event })
const prepend = (state: ChatState, messages: LoadedMessage[], reachedStart = false): ChatState =>
  chatReducer(state, { type: 'PREPEND_HISTORY', messages, reachedStart })

describe('transcript history prepend', () => {
  it('deduplicates pages, rejects a misplaced overlap, and preserves existing messages', () => {
    const state = LOAD(tail)
    const page = [
      message('u:old', 'user', text('old')),
      message('a:old', 'assistant', text('answer'))
    ]
    const after = prepend(state, [...page, page[1], ...tail])
    expect(after.messages.map(({ id }) => id)).toEqual(['u:old', 'a:old', 'u:tail'])
    expect(after.messages[2]).toBe(state.messages[0])
    expect(after.transcriptChanges.log.at(-1)).toEqual({ kind: 'prepend', ids: ['u:old', 'a:old'] })

    const diagnostic = vi.fn()
    expect(
      chatReducer(after, {
        type: 'PREPEND_HISTORY',
        messages: [tail[0], ...page],
        reachedStart: true,
        diagnostic
      })
    ).toBe(after)
    expect(diagnostic).toHaveBeenCalledExactlyOnceWith('prependRejected', 1)
    expect(after.historyComplete).toBe(false)
  })

  it('merges a held result in place, with the same result when the page arrives first', () => {
    const state = LOAD(tail)
    const old = result('a:old', 'stale')
    if (old.type !== 'tool.call.completed') throw new Error('expected tool result')
    const page = [
      message('a:old', 'assistant', {
        type: 'tool_result',
        toolRunId: old.toolRunId,
        result: old.result,
        isError: false
      })
    ]
    const event = result('a:old', 'current')
    const held = recv(recv(state, event), event)
    expect(held.messages).toBe(state.messages)
    expect(held.transcriptChanges).toBe(state.transcriptChanges)
    expect(held.heldPatches.size).toBe(1)
    const patchFirst = prepend(held, page)
    const pageFirst = recv(prepend(state, page), event)
    expect(patchFirst.messages).toEqual(pageFirst.messages)
    expect(patchFirst.messages[0].parts.map((part) => part.type)).toEqual(['tool_result'])
    expect(patchFirst.heldPatches.size).toBe(0)
  })

  it('keeps disjoint publications from tool and response owners in arrival order', () => {
    const state = LOAD(tail)
    const artifact = (
      publicationId: string
    ): Extract<AppMessagePart, { type: 'artifact' }>['artifact'] =>
      ({ publicationId }) as Extract<AppMessagePart, { type: 'artifact' }>['artifact']
    const event: NormalizedEvent = {
      type: 'output.captured',
      sessionId: 's',
      responseId: 'response',
      artifact: artifact('first')
    }
    const page = [
      message(
        'a:old',
        'assistant',
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'response' } },
        { type: 'tool_call', toolName: 'Read', toolRunId: 'tool', args: {} }
      )
    ]
    const other: NormalizedEvent = {
      ...event,
      responseId: undefined,
      toolRunId: 'tool',
      artifact: artifact('other')
    }
    const pending = recv(recv(recv(state, event), other), event)
    expect(pending.heldOutputs.size).toBe(2)
    const patchFirst = prepend(pending, page)
    const pageFirst = recv(recv(recv(prepend(state, page), event), other), event)
    expect(pageFirst.messages).toEqual(patchFirst.messages)
    expect(patchFirst.messages[0].parts).toHaveLength(4)
    expect(patchFirst.heldOutputs.size).toBe(0)
  })

  it('logs an incomplete reset at a non-turn boundary and clears unresolved patches on reached start', () => {
    const state = recv(LOAD(tail), result('a:missing', 'unresolved'))
    const after = prepend(state, [message('u:older', 'user', text('before'))])
    expect(after.transcriptChanges.log.at(-1)).toEqual({ kind: 'reset', complete: false })
    const diagnostic = vi.fn()
    const final = chatReducer(after, {
      type: 'PREPEND_HISTORY',
      messages: [],
      reachedStart: true,
      diagnostic
    })
    expect(final.historyComplete).toBe(true)
    expect(final.heldPatches.size).toBe(0)
    expect(final.transcriptChanges).toBe(after.transcriptChanges)
    expect(diagnostic).toHaveBeenCalledExactlyOnceWith('heldPatchOrphaned', 1)
  })

  it('records unapplied history, subsequent live mutations and a fresh chat in their own revisions', () => {
    const start = LOAD(tail)
    const withNew = recv(start, {
      type: 'message.completed',
      sessionId: 's',
      messageKey: 'a:1',
      message: { text: 'answer' }
    })
    const withEdit = recv(withNew, result('a:1', 'first'))
    const withReplacement = recv(withEdit, result('a:1', 'second'))
    expect(withReplacement.transcriptChanges.log).toEqual([
      { kind: 'reset', complete: false },
      { kind: 'append', ids: ['a:1'] },
      { kind: 'replace', id: 'a:1', partsFrom: 1 },
      { kind: 'replace', id: 'a:1', partsFrom: 1 }
    ])
    const fresh = chatReducer(withReplacement, { type: 'NEW_CHAT' })
    expect(fresh.transcriptChanges.lineage).not.toBe(start.transcriptChanges.lineage)
    expect(fresh.transcriptChanges.revision).toBe(0)
  })

  it('g2, g3, g4, g5, g6, g9, g10, g12, g13, g14 cover all prepend validation, dedup, overlap, boundary, and reachedStart branches', () => {
    const state = LOAD(tail)
    // g3: empty page -> unchanged
    expect(prepend(state, [])).toBe(state)

    // g5: T-preserving prepend -> single prepend{ids}, existing object identity preserved
    const p1 = [message('u:1', 'user', text('1')), message('a:1', 'assistant', text('a1'))]
    const s1 = prepend(state, p1)
    expect(s1.messages[2]).toBe(state.messages[0])
    expect(s1.transcriptChanges.log.at(-1)).toEqual({ kind: 'prepend', ids: ['u:1', 'a:1'] })

    // g2: already-present ids skipped; all-duplicate in-order page -> no change log
    const revBefore = s1.transcriptChanges.revision
    const sDup = prepend(s1, p1)
    expect(sDup.transcriptChanges.revision).toBe(revBefore)

    // g13: all-duplicate in-order page + reachedStart: true -> no log, historyComplete = true
    const sDupStart = prepend(s1, p1, true)
    expect(sDupStart.transcriptChanges.revision).toBe(revBefore)
    expect(sDupStart.historyComplete).toBe(true)

    // g14: all-duplicate out-of-order page + reachedStart: true -> rejected, historyComplete unchanged
    const diag14 = vi.fn()
    const sOutOfOrder = chatReducer(s1, {
      type: 'PREPEND_HISTORY',
      messages: [p1[1], p1[0]],
      reachedStart: true,
      diagnostic: diag14
    })
    expect(sOutOfOrder).toBe(s1)
    expect(sOutOfOrder.historyComplete).toBe(false)
    expect(diag14).toHaveBeenCalledWith('prependRejected', 1)

    // g9: duplicate id inside same page keeps first only
    const s9 = prepend(s1, [
      message('u:0', 'user', text('first')),
      message('u:0', 'user', text('second')),
      message('a:0', 'assistant', text('a0'))
    ])
    expect(s9.messages[0].parts).toEqual([text('first')])
    expect(s9.messages.filter((m) => m.id === 'u:0')).toHaveLength(1)

    // g4: T-violating prepend (user before user) -> reset{complete: false}
    const s4 = prepend(s9, [message('u:minus1', 'user', text('-1'))])
    expect(s4.transcriptChanges.log.at(-1)).toEqual({ kind: 'reset', complete: false })

    // g6: interleaved prepend + live append/replace keep arrival order in log
    const s6 = recv(
      prepend(LOAD(tail), [
        message('u:old', 'user', text('o')),
        message('a:old', 'assistant', text('ao'))
      ]),
      { type: 'message.completed', sessionId: 's', messageKey: 'a:live', message: { text: 'live' } }
    )
    expect(s6.messages.map((m) => m.id)).toEqual(['u:old', 'a:old', 'u:tail', 'a:live'])

    // g10: overlap in middle or wrong order -> rejected
    const diag10 = vi.fn()
    const s10 = chatReducer(s6, {
      type: 'PREPEND_HISTORY',
      messages: [message('u:new', 'user', text('n')), message('u:tail', 'user', text('next'))],
      reachedStart: false,
      diagnostic: diag10
    })
    expect(s10).toBe(s6)
    expect(diag10).toHaveBeenCalledWith('prependRejected', 1)

    // g12: reachedStart: true + empty list -> sets historyComplete = true and drops orphans
    const withOrphan = recv(LOAD(tail), result('a:never', 'x'))
    const diag12 = vi.fn()
    const s12 = chatReducer(withOrphan, {
      type: 'PREPEND_HISTORY',
      messages: [],
      reachedStart: true,
      diagnostic: diag12
    })
    expect(s12.historyComplete).toBe(true)
    expect(s12.heldPatches.size).toBe(0)
    expect(diag12).toHaveBeenCalledWith('heldPatchOrphaned', 1)
  })

  it('g7, g8, g15, g16 merge held patches and held outputs identically regardless of arrival order', () => {
    const state = LOAD(tail)
    const art = (
      publicationId: string
    ): Extract<AppMessagePart, { type: 'artifact' }>['artifact'] =>
      ({ publicationId }) as Extract<AppMessagePart, { type: 'artifact' }>['artifact']
    const page = [
      message(
        'a:old',
        'assistant',
        { type: 'tool_call', toolRunId: 'tool', toolName: 'Write', args: {} },
        { type: 'tool_result', toolRunId: 'tool', result: 'temp', isError: false },
        { type: 'artifact', artifact: art('P1') },
        { type: 'response_boundary', boundary: { id: 'rb1', phase: 'begin' } }
      )
    ]
    const evFinal = result('a:old', 'final')
    const evEnd: NormalizedEvent = {
      type: 'response.boundary',
      sessionId: 's',
      boundary: { id: 'rb1', phase: 'end', outcome: 'ended' },
      messageKey: 'a:old',
      messageKeySource: 'owner'
    } as NormalizedEvent
    const evP1: NormalizedEvent = {
      type: 'output.captured',
      sessionId: 's',
      toolRunId: 'tool',
      artifact: art('P1')
    }
    const evP2: NormalizedEvent = {
      type: 'output.captured',
      sessionId: 's',
      toolRunId: 'tool',
      artifact: art('P2')
    }
    const evQ1: NormalizedEvent = {
      type: 'output.captured',
      sessionId: 's',
      responseId: 'rb1',
      artifact: art('Q1')
    }

    // Order A (g7, g15, g16): events first (held), then page prepend
    let orderA = recv(state, evFinal)
    orderA = recv(orderA, evEnd)
    orderA = recv(orderA, evP1)
    orderA = recv(orderA, evP2)
    orderA = recv(orderA, evQ1)
    orderA = prepend(orderA, page)

    // Order B (g8, g15, g16): page prepend first, then live events
    let orderB = prepend(state, page)
    orderB = recv(orderB, evFinal)
    orderB = recv(orderB, evEnd)
    orderB = recv(orderB, evP1)
    orderB = recv(orderB, evP2)
    orderB = recv(orderB, evQ1)

    expect(orderA.messages).toEqual(orderB.messages)
    const parts = orderA.messages[0].parts
    expect(parts.filter((p) => p.type === 'tool_result')).toHaveLength(1)
    expect((parts.find((p) => p.type === 'tool_result') as { result: unknown }).result).toBe(
      'final'
    )
    expect(
      parts
        .filter((p): p is Extract<AppMessagePart, { type: 'artifact' }> => p.type === 'artifact')
        .map((p) => p.artifact.publicationId)
    ).toEqual(['P1', 'P2', 'Q1'])
  })

  it('g1 & g11 target only the named session without mutating active session or creating missing entries', () => {
    const activeState = LOAD([message('u:act', 'user', text('active'))])
    const otherState = LOAD([message('u:oth', 'user', text('other'))])
    useChatStore.setState({
      activeKey: 'active',
      sessions: {
        active: {
          session: activeState,
          live: { text: '', reasoning: '', reasoningVisible: false },
          subagentMeta: {}
        },
        other: {
          session: otherState,
          live: { text: '', reasoning: '', reasoningVisible: false },
          subagentMeta: {}
        }
      }
    })
    const activeBefore = useChatStore.getState().sessions.active
    chatActions.prependHistory(
      'other',
      [message('u:old', 'user', text('o')), message('a:old', 'assistant', text('ao'))],
      { reachedStart: false }
    )
    expect(useChatStore.getState().sessions.active).toBe(activeBefore)
    expect(useChatStore.getState().sessions.other.session.messages.map((m) => m.id)).toEqual([
      'u:old',
      'a:old',
      'u:oth'
    ])

    // g11: missing session key -> no-op, does not create entry
    chatActions.prependHistory('deleted-session', [message('u:x', 'user', text('x'))], {
      reachedStart: false
    })
    expect(useChatStore.getState().sessions['deleted-session']).toBeUndefined()
  })
})
