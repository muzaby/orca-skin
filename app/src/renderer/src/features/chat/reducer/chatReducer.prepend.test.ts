import { describe, expect, it, vi } from 'vitest'
import type { AppMessagePart, LoadedMessage, NormalizedEvent } from '../../../../../shared/ipc'
import { chatActions, ingestChatEvent, useChatStore } from '../store/chatStore'
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
  it('retains a tool patch and its publication past the history start until the deferred body opens', () => {
    const ref = {
      kind: 'parts' as const,
      generation: 'g',
      session: 's',
      message: 'a:old',
      bytes: 1800
    }
    const parts: AppMessagePart[] = [
      { type: 'tool_call', toolRunId: 'tool', toolName: 'Write', args: {} }
    ]
    const initial = prepend(
      LOAD(tail),
      [{ ...message(ref.message, 'assistant'), deferredBody: ref }],
      true
    )
    const publication = captured('out', { toolRunId: 'tool' })
    const events = [result(ref.message, 'completed'), publication]
    const waiting = events.reduce(recv, initial)
    expect(waiting.heldPatches.size).toBe(1)
    expect(waiting.heldOutputs.size).toBe(1)
    const diagnostic = vi.fn()
    const completed = chatReducer(waiting, { type: 'RESOLVE_HISTORY_BODY', ref, parts, diagnostic })
    const expected = events.reduce(
      recv,
      prepend(LOAD(tail), [message(ref.message, 'assistant', ...parts)], true)
    )
    expect(completed.messages).toEqual(expected.messages)
    expect(completed.heldPatches.size + completed.heldOutputs.size).toBe(0)
    expect(diagnostic).not.toHaveBeenCalled()
  })

  it('g12/g13 accepts the end once and preserves the completed state on another empty or duplicate page', () => {
    const start = LOAD(tail)
    const diagnostic = vi.fn()
    const complete = chatReducer(start, {
      type: 'PREPEND_HISTORY',
      messages: tail,
      reachedStart: true,
      diagnostic
    })
    expect(complete.historyComplete).toBe(true)
    expect(complete.messages).toBe(start.messages)
    expect(complete.transcriptChanges).toBe(start.transcriptChanges)
    for (const messages of [[], tail]) {
      expect(
        chatReducer(complete, { type: 'PREPEND_HISTORY', messages, reachedStart: true, diagnostic })
      ).toBe(complete)
    }
    expect(diagnostic).not.toHaveBeenCalled()
  })

  it('records the first nonempty page as a prepend into an empty transcript', () => {
    const next = chatReducer(LOAD([]), {
      type: 'PREPEND_HISTORY',
      messages: tail,
      reachedStart: false
    })
    expect(next.transcriptChanges.log.at(-1)).toEqual({ kind: 'prepend', ids: ['u:tail'] })
  })

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

  const publication = (id: string, title = id): Extract<AppMessagePart, { type: 'artifact' }> => ({
    type: 'artifact',
    artifact: {
      publicationId: id,
      artifactFileId: id,
      filename: id,
      title,
      kind: 'text',
      sizeBytes: 1,
      publishedAt: 1
    }
  })
  const captured = (
    id: string,
    ref: { toolRunId?: string; responseId?: string },
    title = id
  ): NormalizedEvent => ({
    type: 'output.captured',
    sessionId: 's',
    artifact: publication(id, title).artifact,
    ...ref
  })
  const call: AppMessagePart = {
    type: 'tool_call',
    toolRunId: 'shared',
    toolName: 'Read',
    args: {}
  }

  it('g7/g16 keep a dual-reference publication pending for its tool when its response is visible first', () => {
    const response = message('a:response', 'assistant', {
      type: 'response_boundary',
      boundary: { id: 'response', phase: 'begin' }
    })
    const tool = message('a:tool', 'assistant', call)
    const event = captured('receipt', { toolRunId: 'shared', responseId: 'response' })
    const start = LOAD([response, ...tail])
    const pending = recv(start, event)
    expect(pending.messages).toBe(start.messages)
    expect([...pending.heldOutputs.keys()]).toEqual(['tool:shared'])
    const merged = prepend(pending, [tool])
    const afterLoad = recv(prepend(start, [tool]), event)
    expect(merged.messages).toEqual(afterLoad.messages)
    expect(merged.messages[0].parts).toEqual([call, publication('receipt')])
    expect(merged.messages[1].parts).toEqual(response.parts)
    expect(merged.heldOutputs.size).toBe(0)
    const missing = recv(LOAD([response], true), event)
    expect(missing.messages[0].parts).toEqual(response.parts)
    expect(missing.heldOutputs.size).toBe(0)
  })

  it('keeps tool and response owners separate and resolves only a response begin', () => {
    let pending = recv(LOAD(tail), captured('tool-file', { toolRunId: 'shared' }))
    pending = recv(pending, captured('response-file', { responseId: 'shared' }))
    const duplicate = recv(pending, captured('tool-file', { toolRunId: 'shared' }, 'later'))
    expect(duplicate).toBe(pending)
    expect([...pending.heldOutputs.keys()]).toEqual(['tool:shared', 'response:shared'])
    const merged = prepend(pending, [
      message('a:end', 'assistant', {
        type: 'response_boundary',
        boundary: { id: 'shared', phase: 'end', outcome: 'ended' }
      }),
      message('a:tool', 'assistant', call),
      message('a:begin', 'assistant', {
        type: 'response_boundary',
        boundary: { id: 'shared', phase: 'begin' }
      })
    ])
    expect(
      merged.messages.slice(0, 3).map((m) => m.parts.filter((p) => p.type === 'artifact'))
    ).toEqual([[], [publication('tool-file')], [publication('response-file')]])
    expect(merged.heldOutputs.size).toBe(0)
  })

  it('preserves first arrival order when a later held value replaces the first result', () => {
    const state = LOAD(tail)
    for (const outputFirst of [false, true]) {
      const output = captured('pub', { toolRunId: 'shared' })
      const patch = result('a:old', 'first')
      let pending = recv(recv(state, outputFirst ? output : patch), outputFirst ? patch : output)
      pending = recv(pending, result('a:old', 'last'))
      expect(pending.heldSequence).toBe(2)
      const merged = prepend(pending, [message('a:old', 'assistant', call)])
      const finalResult = { type: 'tool_result', result: 'last' }
      expect(merged.messages[0].parts).toMatchObject([
        { type: 'tool_call' },
        ...(outputFirst ? [publication('pub'), finalResult] : [finalResult, publication('pub')])
      ])
    }
  })

  it('counts unclaimed patches and outputs at the start of history, including a user ID collision', () => {
    let pending = recv(LOAD(tail), result('u:old', 'do not attach to a user'))
    pending = recv(pending, captured('pub', { responseId: 'missing' }))
    const diagnostic = vi.fn()
    const done = chatReducer(pending, {
      type: 'PREPEND_HISTORY',
      messages: [message('u:old', 'user', text('old'))],
      reachedStart: true,
      diagnostic
    })
    expect(done.messages[0].parts).toEqual([text('old')])
    expect(diagnostic).toHaveBeenCalledExactlyOnceWith('heldPatchOrphaned', 2)
    expect(done.heldPatches.size + done.heldOutputs.size).toBe(0)
  })

  it.each(['before', 'after', 'other turn'] as const)(
    'deduplicates a publication against an assistant %s the owner',
    (where) => {
      const pending = recv(LOAD(tail), captured('pub', { toolRunId: 'shared' }))
      const sibling = message('a:sibling', 'assistant', publication('pub'))
      const owner = message('a:owner', 'assistant', call)
      const page =
        where === 'before'
          ? [sibling, owner]
          : where === 'after'
            ? [owner, sibling]
            : [owner, message('u:new', 'user', text('next')), sibling]
      const merged = prepend(pending, page)
      expect(merged.messages.find((m) => m.id === 'a:owner')?.parts).toEqual(
        where === 'other turn' ? [call, publication('pub')] : [call]
      )
      expect(merged.heldOutputs.size).toBe(0)
    }
  )

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

  it('g2/g9/g10/g14 accepts exactly new IDs followed by a prefix of the loaded transcript', () => {
    const existing = [message('u:A', 'user'), message('a:B', 'assistant')]
    const before = LOAD(existing)
    // The only permitted old suffixes are an empty suffix, A, or A B.
    const permitted = new Set<string>()
    for (const prefix of ['', 'X', 'Y', 'XY', 'YX']) {
      for (const suffix of ['', 'A', 'AB']) permitted.add(prefix + suffix)
    }
    const byName = {
      A: existing[0],
      B: existing[1],
      X: message('u:X', 'user'),
      Y: message('a:Y', 'assistant')
    }
    type Label = keyof typeof byName
    const labels: Label[] = ['A', 'B', 'X', 'Y']
    const check = (input: Label[]): void => {
      const first = [...new Set(input)]
      const diagnostic = vi.fn()
      const next = chatReducer(before, {
        type: 'PREPEND_HISTORY',
        messages: input.map((k, i) => ({ ...byName[k], parts: [text(String(i))] })),
        reachedStart: true,
        diagnostic
      })
      if (permitted.has(first.join(''))) {
        const added = first.filter((k) => k === 'X' || k === 'Y')
        expect(
          next.messages.map((m) => m.id),
          input.join('')
        ).toEqual([...added.map((k) => byName[k].id), ...existing.map((m) => m.id)])
        for (const [index, key] of added.entries())
          expect(next.messages[index].parts).toEqual([text(String(input.indexOf(key)))])
        expect(next.messages.at(-1)).toBe(before.messages[1])
        expect(next.messages.at(-2)).toBe(before.messages[0])
        expect(next.historyComplete).toBe(true)
        expect(next.transcriptChanges.revision).toBe(
          before.transcriptChanges.revision + Number(added.length > 0)
        )
        expect(diagnostic).not.toHaveBeenCalled()
      } else {
        expect(next, input.join('')).toBe(before)
        expect(diagnostic.mock.calls).toEqual([['prependRejected', 1]])
      }
    }
    let layer: Label[][] = [[]]
    for (let length = 0; length <= 4; length++) {
      for (const input of layer) check(input)
      layer = layer.flatMap((input) => labels.map((label) => [...input, label]))
    }
  })

  it('g4/g5 chooses the recorded operation from the seam after overlap removal', () => {
    for (const last of ['assistant', 'user'] as const) {
      for (const first of ['assistant', 'user'] as const) {
        const existing = message('current', first, text('current'))
        const before = LOAD([existing])
        const after = prepend(
          before,
          [message('older', last), { ...existing, parts: [text('stale')] }],
          true
        )
        expect(after.transcriptChanges.log.at(-1)).toEqual(
          last === 'assistant' && first === 'user'
            ? { kind: 'prepend', ids: ['older'] }
            : { kind: 'reset', complete: false }
        )
        expect(after.historyComplete).toBe(true)
        expect(after.messages[1]).toBe(before.messages[0])
      }
    }
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

  it('g16 gives a shared publication to its first arriving owner across adjacent page messages', () => {
    const page = [
      message('a:call', 'assistant', {
        type: 'tool_call',
        toolRunId: 't',
        toolName: 'Write',
        args: {}
      }),
      message('a:response', 'assistant', {
        type: 'response_boundary',
        boundary: { id: 'r', phase: 'begin' }
      })
    ]
    const artifact = { publicationId: 'same' } as Extract<
      AppMessagePart,
      { type: 'artifact' }
    >['artifact']
    const events: NormalizedEvent[] = [
      { type: 'output.captured', sessionId: 's', responseId: 'r', artifact },
      { type: 'output.captured', sessionId: 's', toolRunId: 't', artifact }
    ]
    for (const order of [events, [...events].reverse()]) {
      const start = LOAD(tail)
      const pageFirst = order.reduce(recv, prepend(start, page))
      const eventsFirst = prepend(order.reduce(recv, start), page)
      const owners = (state: ChatState): string[] =>
        state.messages.filter((m) => m.parts.some((p) => p.type === 'artifact')).map((m) => m.id)
      expect(owners(pageFirst)).toEqual([order[0] === events[0] ? 'a:response' : 'a:call'])
      expect(eventsFirst.messages).toEqual(pageFirst.messages)
      expect(eventsFirst.heldOutputs.size).toBe(0)
    }
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
    const published = (id: string): NormalizedEvent => ({
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'tool',
      isError: false,
      result: 'final',
      messageKey: 'a:old',
      messageKeySource: 'owner',
      artifact: art(id)
    })
    const evP1 = published('P1')
    const evP2 = published('P2')
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
    orderA = recv(orderA, evP1)
    expect(orderA.heldPatches.get('a:old')?.map(({ part }) => part.type)).toEqual([
      'tool_result',
      'response_boundary',
      'artifact',
      'artifact'
    ])
    expect([...orderA.heldOutputs.keys()]).toEqual(['response:rb1'])
    orderA = prepend(orderA, page)

    // Order B (g8, g15, g16): page prepend first, then live events
    let orderB = prepend(state, page)
    orderB = recv(orderB, evFinal)
    orderB = recv(orderB, evEnd)
    orderB = recv(orderB, evP1)
    orderB = recv(orderB, evP2)
    orderB = recv(orderB, evQ1)
    orderB = recv(orderB, evP1)

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

  it('g6 interleaves real store prepend and live owner events in the same session revision stream', () => {
    const previous = useChatStore.getState()
    try {
      const session = LOAD(tail)
      useChatStore.setState({
        activeKey: 's',
        sessions: {
          s: {
            session,
            live: { text: '', reasoning: '', reasoningVisible: false },
            subagentMeta: {}
          }
        }
      })
      const boundary = { type: 'response.boundary' as const, sessionId: 's', messageKey: 'a:live' }
      ingestChatEvent({ ...boundary, boundary: { id: 'r', phase: 'begin' } })
      chatActions.prependHistory('s', [message('u:old', 'user'), message('a:old', 'assistant')], {
        reachedStart: false
      })
      ingestChatEvent({
        ...boundary,
        messageKeySource: 'owner',
        boundary: { id: 'r', phase: 'end', outcome: 'unknown' }
      })
      const previousLive = useChatStore.getState().sessions.s.session.messages.at(-1)
      ingestChatEvent({
        ...boundary,
        messageKeySource: 'owner',
        boundary: { id: 'r', phase: 'end', outcome: 'ended' }
      })
      const next = useChatStore.getState().sessions.s.session
      expect(next.messages.map((m) => m.id)).toEqual(['u:old', 'a:old', 'u:tail', 'a:live'])
      expect(next.messages.at(-1)?.parts).toEqual([
        { type: 'response_boundary', boundary: { id: 'r', phase: 'begin' } },
        { type: 'response_boundary', boundary: { id: 'r', phase: 'end', outcome: 'ended' } }
      ])
      expect(previousLive?.parts.at(-1)).toMatchObject({ boundary: { outcome: 'unknown' } })
      expect(next.transcriptChanges.log.slice(-4)).toEqual([
        { kind: 'append', ids: ['a:live'] },
        { kind: 'prepend', ids: ['u:old', 'a:old'] },
        { kind: 'replace', id: 'a:live', partsFrom: 1 },
        { kind: 'replace', id: 'a:live', partsFrom: 1 }
      ])
    } finally {
      useChatStore.setState(previous, true)
    }
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
    const beforeDeletedPage = useChatStore.getState()
    chatActions.prependHistory('deleted-session', [message('u:x', 'user', text('x'))], {
      reachedStart: false
    })
    expect(useChatStore.getState()).toBe(beforeDeletedPage)
    expect(useChatStore.getState().sessions['deleted-session']).toBeUndefined()
  })

  it.each(['patch', 'output'] as const)(
    'g7/g12 applies a final page with only the %s queue populated before counting orphans',
    (kind) => {
      const initial = { ...LOAD(tail), title: 'retained title' }
      const pending =
        kind === 'patch'
          ? recv(recv(initial, result('a:owner', 'current')), result('a:unseen', 'orphan'))
          : recv(
              recv(initial, captured('found', { toolRunId: 'shared' })),
              captured('orphan', { responseId: 'absent' })
            )
      const oldResult: AppMessagePart = {
        type: 'tool_result',
        toolRunId: 'tool',
        result: 'stale',
        isError: false
      }
      const page = message('a:owner', 'assistant', oldResult, call)
      const diagnostic = vi.fn()
      const after = chatReducer(pending, {
        type: 'PREPEND_HISTORY',
        messages: [page],
        reachedStart: true,
        diagnostic
      })
      const expectedParts =
        kind === 'patch'
          ? [{ ...oldResult, result: 'current' }, call]
          : [oldResult, call, publication('found')]
      expect(after.messages.map(({ id }) => id)).toEqual(['a:owner', 'u:tail'])
      expect(after.messages[0].parts).toEqual(expectedParts)
      expect(page.parts).toEqual([oldResult, call])
      expect(after.messages[1]).toBe(initial.messages[0])
      expect(after.title).toBe(initial.title)
      expect(after.historyComplete).toBe(true)
      expect(after.heldPatches.size + after.heldOutputs.size).toBe(0)
      expect(pending.heldPatches.size + pending.heldOutputs.size).toBe(2)
      expect(after.transcriptChanges.log.at(-1)).toEqual({ kind: 'prepend', ids: ['a:owner'] })
      expect(diagnostic).toHaveBeenCalledExactlyOnceWith('heldPatchOrphaned', 1)
    }
  )

  it('g15 replays different boundary IDs and phases in their own slots across multiple owners', () => {
    const begin: AppMessagePart = {
      type: 'response_boundary',
      boundary: { id: 'r', phase: 'begin' }
    }
    const end = (
      id: string,
      outcome: 'ended' | 'aborted'
    ): Extract<AppMessagePart, { type: 'response_boundary' }> => ({
      type: 'response_boundary',
      boundary: { id, phase: 'end', outcome }
    })
    const earlier = message('a:before', 'assistant', text('retained'))
    const owner = message('a:owner', 'assistant', begin, end('other', 'ended'), end('r', 'aborted'))
    const start = LOAD(tail)
    const changed: NormalizedEvent = {
      type: 'response.boundary',
      sessionId: 's',
      messageKey: 'a:owner',
      messageKeySource: 'owner',
      boundary: end('r', 'ended').boundary
    }
    const other = result('a:before', 'current')
    const reasoning = (value: string): NormalizedEvent => ({
      type: 'message.reasoning',
      sessionId: 's',
      messageKey: 'a:before',
      messageKeySource: 'owner',
      text: value
    })
    const events = [changed, other, reasoning('first'), reasoning('second')]
    const eventsFirst = prepend(events.reduce(recv, start), [earlier, owner])
    const pageFirst = events.reduce(recv, prepend(start, [earlier, owner]))
    expect(eventsFirst.messages).toEqual(pageFirst.messages)
    expect(eventsFirst.messages[0].parts).toMatchObject([
      text('retained'),
      { type: 'tool_result', result: 'current' },
      { type: 'reasoning', text: 'first' },
      { type: 'reasoning', text: 'second' }
    ])
    expect(eventsFirst.messages[1].parts).toEqual([begin, end('other', 'ended'), end('r', 'ended')])
    expect(owner.parts).toEqual([begin, end('other', 'ended'), end('r', 'aborted')])
    expect(eventsFirst.heldPatches.size).toBe(0)
  })

  it('g7 replays a notice and result sharing one tool ID, in either arrival order', () => {
    const notice = (toolUseId: string): NormalizedEvent => ({
      type: 'subagent.task',
      phase: 'settled',
      background: true,
      status: 'completed',
      sessionId: 's',
      messageKey: 'a:old',
      messageKeySource: 'owner',
      toolUseId,
      summary: toolUseId
    })
    const completed = result('a:old', 'latest')
    for (const noticeFirst of [false, true]) {
      const events = noticeFirst ? [notice('tool'), completed] : [completed, notice('tool')]
      events.push(notice('other'))
      const start = LOAD(tail)
      const page = [message('a:old', 'assistant')]
      const held = events.reduce(recv, start)
      const pageFirst = events.reduce(recv, prepend(start, page))
      const restored = prepend(held, page)
      const kinds = noticeFirst
        ? ['subagent_notice', 'tool_result']
        : ['tool_result', 'subagent_notice']
      expect(restored.messages[0].parts.map((part) => part.type)).toEqual([
        ...kinds,
        'subagent_notice'
      ])
      expect(restored.messages[0].parts.at(-1)).toMatchObject({
        type: 'subagent_notice',
        toolRunId: 'other'
      })
      expect(restored.messages).toEqual(pageFirst.messages)
    }
  })
})
