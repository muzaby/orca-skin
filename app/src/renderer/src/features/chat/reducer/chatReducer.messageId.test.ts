import { describe, expect, it, vi } from 'vitest'
import type { AppMessagePart, LoadedMessage, NormalizedEvent } from '../../../../../shared/ipc'
import { userMessageId } from '../../../../../shared/message-id'
import { transcriptIndexFor } from '../lib/transcriptIndex'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'

const msg = (
  id: string,
  role: 'user' | 'assistant',
  ...parts: AppMessagePart[]
): LoadedMessage => ({
  id,
  role,
  createdAt: 0,
  parts
})

const load = (messages: LoadedMessage[], complete = true): ChatState =>
  chatReducer(initialChatState, {
    type: 'LOAD_SESSION',
    session: { id: 's', backend: 'claude', agentKind: 'code', title: null, messages },
    complete
  })

const recv = (state: ChatState, event: NormalizedEvent): ChatState =>
  chatReducer(state, { type: 'RECV_EVENT', event })

describe('VP-07 chatReducer message identity (r1~r17)', () => {
  it.each([
    { type: 'message.reasoning', text: 'thought' },
    { type: 'response.boundary', boundary: { id: 'r', phase: 'begin' } },
    { type: 'message.completed', message: { text: 'answer' } },
    { type: 'tool.call.started', toolName: 'Read', toolRunId: 't', args: {} },
    { type: 'tool.call.completed', toolRunId: 't', result: 'found', isError: false },
    { type: 'session.compacted', trigger: 'manual' },
    {
      type: 'subagent.task',
      phase: 'settled',
      toolUseId: 't',
      background: true,
      status: 'completed'
    }
  ] as const)('routes $type to its original message after a later turn', (event) => {
    const before = load([
      msg('a:original', 'assistant'),
      msg('u:next', 'user'),
      msg('a:next', 'assistant')
    ])
    const next = recv(before, { ...event, sessionId: 's', messageKey: 'a:original' })
    expect(next.messages[0].parts).toHaveLength(1)
    expect(next.messages[2]).toBe(before.messages[2])
    const partial = load([], false)
    const addressed = {
      ...event,
      sessionId: 's',
      messageKey: 'a:past',
      messageKeySource: 'owner' as const
    }
    const held = recv(partial, addressed)
    expect(held.messages).toBe(partial.messages)
    expect(held.heldPatches.get('a:past')).toHaveLength(1)
    const live = recv(partial, { ...addressed, messageKeySource: undefined })
    expect(live.heldPatches.size).toBe(0)
    expect(live.messages[0].id).toBe('a:past')
  })

  it('r1, r2, r3, r4, r9 route parts by messageKey without copying earlier messages', () => {
    let s = load([msg('u:1', 'user', { type: 'text', text: 'hi' })])
    // r4: after user, keyed event creates new assistant message
    s = recv(s, {
      type: 'tool.call.started',
      sessionId: 's',
      toolRunId: 'tx',
      toolName: 'Bash',
      args: {},
      messageKey: 'a:1'
    })
    expect(s.messages.map((m) => m.id)).toEqual(['u:1', 'a:1'])
    const userRef = s.messages[0]

    // r1: same key appends to same message; r9: earlier message keeps reference
    s = recv(s, {
      type: 'message.completed',
      sessionId: 's',
      message: { text: 'A text' },
      messageKey: 'a:1'
    })
    expect(s.messages.map((m) => m.id)).toEqual(['u:1', 'a:1'])
    expect(s.messages[0]).toBe(userRef)

    // r2: new key after assistant creates new message at end
    s = recv(s, {
      type: 'message.completed',
      sessionId: 's',
      message: { text: 'B text' },
      messageKey: 'a:2'
    })
    expect(s.messages.map((m) => m.id)).toEqual(['u:1', 'a:1', 'a:2'])
    const bRef = s.messages[2]

    // r3: late A result attaches to A, message count unchanged, B reference unchanged
    s = recv(s, {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'tx',
      result: 'late A',
      isError: false,
      messageKey: 'a:1',
      messageKeySource: 'owner'
    })
    expect(s.messages.map((m) => m.id)).toEqual(['u:1', 'a:1', 'a:2'])
    expect(s.messages[2]).toBe(bRef)
    expect(s.messages[1].parts.some((p) => p.type === 'tool_result' && p.toolRunId === 'tx')).toBe(
      true
    )
  })

  it('r4 preserves an explicitly addressed user but creates an assistant for an unkeyed tail event', () => {
    const before = load([msg('u:tail', 'user', { type: 'text', text: 'question' })])
    const event = { type: 'message.reasoning', sessionId: 's', text: 'thinking' } as const
    const collision = recv(before, { ...event, messageKey: 'u:tail' })
    expect(collision.messages).toBe(before.messages)
    expect(collision.transcriptChanges).toBe(before.transcriptChanges)
    const unkeyed = recv(before, event)
    expect(unkeyed.messages[0]).toBe(before.messages[0])
    expect(unkeyed.messages[1]).toMatchObject({
      role: 'assistant',
      parts: [{ type: 'reasoning', text: 'thinking' }]
    })
    expect(unkeyed.messages[1].id).not.toBe('u:tail')
    expect(unkeyed.transcriptChanges.log.at(-1)).toEqual({
      kind: 'append',
      ids: [unkeyed.messages[1].id]
    })
  })

  it('r3/r14 keep unkeyed late results on the tail and replace a keyed result only at its owner', () => {
    const prior: AppMessagePart = {
      type: 'tool_result',
      toolRunId: 'same',
      result: 'saved',
      isError: false
    }
    const before = load([
      msg('a:owner', 'assistant', prior),
      msg('u:next', 'user'),
      msg('a:tail', 'assistant', { type: 'text', text: 'tail prefix' }, prior)
    ])
    const event = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'same',
      isError: false,
      result: 'unkeyed'
    } as const
    const unkeyed = recv(before, event)
    expect(unkeyed.messages[0]).toBe(before.messages[0])
    expect(unkeyed.messages[2].parts).toEqual([
      { type: 'text', text: 'tail prefix' },
      prior,
      { ...prior, result: 'unkeyed' }
    ])
    expect(unkeyed.transcriptChanges.log.at(-1)).toEqual({
      kind: 'replace',
      id: 'a:tail',
      partsFrom: 2
    })
    const keyed = recv(unkeyed, { ...event, messageKey: 'a:owner', result: 'late' })
    expect(keyed.messages[0].parts).toEqual([{ ...prior, result: 'late' }])
    expect(keyed.messages[2]).toBe(unkeyed.messages[2])
    expect(keyed.transcriptChanges.log.at(-1)).toEqual({
      kind: 'replace',
      id: 'a:owner',
      partsFrom: 0
    })
  })

  it('r5 appends an unkeyed buffer to the last assistant and skips an empty commit', () => {
    const before = load([msg('a:first', 'assistant'), msg('a:last', 'assistant')])
    const after = chatReducer(before, { type: 'COMMIT_PENDING_TEXT', text: 'tail' })
    expect(after.messages.map(({ id, parts }) => [id, parts])).toEqual([
      ['a:first', []],
      ['a:last', [{ type: 'text', text: 'tail' }]]
    ])
    expect(after.messages[0]).toBe(before.messages[0])
    expect(
      chatReducer(after, { type: 'COMMIT_PENDING_TEXT', messageKey: 'a:other', text: '' })
    ).toBe(after)
  })

  it('r6/r12 prefers a canonical key to clientId and never replaces an assistant with a matching optimistic ID', () => {
    const prior = load([
      msg('u:client', 'assistant', { type: 'text', text: 'prior' }),
      msg('u:other', 'user')
    ])
    const committed = chatReducer(prior, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      ids: ['client'],
      clientId: 'client',
      messageKey: 'u:canonical',
      text: 'delivery'
    })
    expect(committed.messages.map((m) => m.id)).toEqual(['u:client', 'u:other', 'u:canonical'])
    expect(committed.messages[0]).toBe(prior.messages[0])
    expect(committed.transcriptChanges.log.at(-1)).toEqual({ kind: 'append', ids: ['u:canonical'] })
    const legacy = chatReducer(committed, { type: 'APPEND_COMMITTED_USER_MESSAGE', text: 'local' })
    expect(legacy.messages.at(-1)?.id).toMatch(/^r:/)
    expect(legacy.transcriptChanges.log.at(-1)).toEqual({
      kind: 'append',
      ids: [legacy.messages.at(-1)!.id]
    })
  })

  it('r6 dismisses only a matching optimistic user and preserves the other message keys', () => {
    const before = load([msg('u:sibling', 'assistant'), msg('u:actual', 'user')])
    const dismiss = (clientId: string): ChatState =>
      chatReducer(before, { type: 'DROP_UNCOMMITTED_USER', clientId })
    expect(() => dismiss('absent')).not.toThrow()
    expect(dismiss('absent')).toBe(before)
    expect(dismiss('sibling')).toBe(before)
    const result = dismiss('actual')
    expect(result.messages).toEqual([before.messages[0]])
    expect(result.messages[0]).toBe(before.messages[0])
    expect(result.transcriptChanges.log.at(-1)).toEqual({ kind: 'remove', ids: ['u:actual'] })
  })

  it('r12 replaces multiple optimistic messages at the earliest transcript position even when queue IDs are reversed', () => {
    const before = load([
      msg('u:z', 'user'),
      msg('a:between', 'assistant'),
      msg('u:a', 'user'),
      msg('u:after', 'user')
    ])
    const commit = {
      type: 'APPEND_COMMITTED_USER_MESSAGE' as const,
      messageKey: 'u:a,z',
      ids: ['a', 'z'],
      text: 'batch'
    }
    const after = chatReducer(before, commit)
    expect(after.messages.map((m) => m.id)).toEqual(['u:a,z', 'a:between', 'u:after'])
    expect(after.messages[1]).toBe(before.messages[1])
    expect(after.messages[2]).toBe(before.messages[3])
    expect(after.transcriptChanges.log.at(-1)).toEqual({ kind: 'reset', complete: true })
    expect(chatReducer(after, commit)).toBe(after)
  })

  it('r16/r17 keeps each unpublished result and receipt with the missing explicit owner', () => {
    const receipt = {
      publicationId: 'tool'
    } as Extract<AppMessagePart, { type: 'artifact' }>['artifact']
    const base = {
      type: 'tool.call.completed' as const,
      sessionId: 's',
      toolRunId: 'tool',
      result: 'first',
      isError: false,
      artifact: receipt,
      messageKey: 'a:past',
      messageKeySource: 'owner' as const
    }
    const before = load([msg('a:tail', 'assistant')], false)
    const loadedOwner = recv(load([msg('a:past', 'assistant')], false), base)
    expect(loadedOwner.heldPatches.size).toBe(0)
    expect(loadedOwner.messages[0].parts.at(-1)).toEqual({ type: 'artifact', artifact: receipt })
    const first = recv(before, base)
    const second = recv(first, { ...base, result: 'second' })
    expect(second.messages).toBe(before.messages)
    expect(second.transcriptChanges).toBe(before.transcriptChanges)
    expect(second.heldOutputs.size).toBe(0)
    expect(second.heldPatches.get('a:past')).toEqual([
      {
        sequence: 1,
        part: { type: 'tool_result', toolRunId: 'tool', result: 'second', isError: false }
      },
      { sequence: 2, part: { type: 'artifact', artifact: receipt } }
    ])
    expect(second.heldSequence).toBe(2)
    const tagged = recv(load([], true), base)
    const untagged = recv(before, { ...base, messageKeySource: undefined })
    for (const resolved of [tagged, untagged]) {
      expect(resolved.heldPatches.size).toBe(0)
      expect(resolved.messages.at(-1)).toMatchObject({
        id: 'a:past',
        parts: [{ type: 'tool_result' }, { type: 'artifact', artifact: receipt }]
      })
    }
    const withBoundary = recv(second, {
      type: 'response.boundary',
      sessionId: 's',
      messageKey: 'a:past',
      messageKeySource: 'owner',
      boundary: { phase: 'begin', id: 'tool' }
    })
    expect(withBoundary.heldPatches.get('a:past')?.map(({ part }) => part.type)).toEqual([
      'tool_result',
      'artifact',
      'response_boundary'
    ])
    const heldText = recv(second, {
      type: 'message.reasoning',
      sessionId: 's',
      messageKey: 'a:past',
      messageKeySource: 'owner',
      text: 'A'
    })
    const repeatedText = recv(heldText, {
      type: 'message.reasoning',
      sessionId: 's',
      messageKey: 'a:past',
      messageKeySource: 'owner',
      text: 'B'
    })
    expect(repeatedText.heldPatches.get('a:past')?.slice(2)).toEqual([
      { sequence: 3, part: { type: 'reasoning', text: 'A' } },
      { sequence: 4, part: { type: 'reasoning', text: 'B' } }
    ])
  })

  it('r13 preserves one settled notice per tool across held replays, page resets and prefix arrivals', () => {
    const event = {
      type: 'subagent.task' as const,
      sessionId: 's',
      messageKey: 'a:old',
      messageKeySource: 'owner' as const,
      phase: 'settled' as const,
      background: true,
      toolUseId: 'task',
      status: 'completed' as const,
      summary: 'first'
    }
    const late = recv(load([], false), event)
    const repeated = recv(late, { ...event, summary: 'duplicate' })
    expect(repeated.heldPatches).toBe(late.heldPatches)
    expect(repeated.heldSequence).toBe(1)
    const other = recv(repeated, { ...event, messageKey: 'a:other', summary: 'second address' })
    const notice = {
      type: 'subagent_notice' as const,
      toolRunId: 'task',
      status: 'completed' as const,
      summary: 'stored'
    }
    const before = msg('a:old', 'assistant')
    const after = msg('a:other', 'assistant')
    const reset = (rows: LoadedMessage[]): ChatState =>
      chatReducer(other, {
        type: 'LOAD_SESSION',
        session: { id: 's', backend: 'claude', agentKind: 'code', title: null, messages: rows },
        complete: true
      })
    expect(reset([before, after]).messages.map(({ parts }) => parts)).toEqual([
      [{ ...notice, summary: 'first' }],
      []
    ])
    expect(
      reset([before, { ...after, parts: [notice] }]).messages.map(({ parts }) => parts)
    ).toEqual([[], [notice]])
    const visible = recv(repeated, {
      ...event,
      messageKey: 'a:visible',
      messageKeySource: undefined,
      summary: 'visible'
    })
    const prepended = chatReducer(visible, {
      type: 'PREPEND_HISTORY',
      messages: [before],
      reachedStart: true
    })
    expect(prepended.messages.map(({ parts }) => parts)).toEqual([
      [],
      [{ ...notice, summary: 'visible' }]
    ])
  })

  it('r17 distinguishes missing owner references, held replays and loaded tool versus response owners', () => {
    const tool = msg('a:tool', 'assistant', {
      type: 'tool_call',
      toolRunId: 't',
      toolName: 'Read',
      args: {}
    })
    const response = msg('a:response', 'assistant', {
      type: 'response_boundary',
      boundary: { id: 'r', phase: 'begin' }
    })
    const state = load([tool, msg('u:middle', 'user'), response], false)
    const output = {
      type: 'output.captured' as const,
      sessionId: 's',
      artifact: { publicationId: 'p' } as Extract<AppMessagePart, { type: 'artifact' }>['artifact']
    }
    expect(recv(state, output)).toBe(state)
    const both = recv(state, { ...output, toolRunId: 't', responseId: 'r' })
    expect(both.messages[0].parts.at(-1)).toEqual({ type: 'artifact', artifact: output.artifact })
    expect(both.messages[2]).toBe(state.messages[2])
    const onlyResponse = recv(state, { ...output, responseId: 'r' })
    expect(onlyResponse.messages[0]).toBe(state.messages[0])
    expect(onlyResponse.messages[2].parts.at(-1)).toEqual({
      type: 'artifact',
      artifact: output.artifact
    })
    expect(recv(onlyResponse, { ...output, responseId: 'r' })).toBe(onlyResponse)
    const missing = { ...output, toolRunId: 'absent', responseId: 'r' }
    const held = recv(state, missing)
    expect(held.messages).toBe(state.messages)
    expect([...held.heldOutputs.keys()]).toEqual(['tool:absent'])
    expect(recv(held, missing)).toBe(held)
    const complete = load([tool, response], true)
    expect(recv(complete, missing)).toBe(complete)
  })

  it('r16 honors the explicit result owner and publishes only successful receipts', () => {
    const before = load([
      msg('a:call', 'assistant', {
        type: 'tool_call',
        toolRunId: 'tool',
        toolName: 'Read',
        args: {}
      }),
      msg('a:result', 'assistant')
    ])
    const artifact = {
      publicationId: 'pub',
      artifactFileId: 'f',
      title: 'f',
      filename: 'f',
      kind: 'text',
      sizeBytes: 1,
      publishedAt: 1
    } as const
    const base = {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'tool',
      result: 'value',
      artifact
    } as const
    for (const isError of [false, true]) {
      const explicit = recv(before, { ...base, isError, messageKey: 'a:result' })
      expect(explicit.messages[0]).toBe(before.messages[0])
      expect(explicit.messages[1].parts.map((p) => p.type)).toEqual(
        isError ? ['tool_result'] : ['tool_result', 'artifact']
      )
    }
    const unkeyed = recv(before, { ...base, isError: false })
    expect(unkeyed.messages[0].parts.at(-1)).toEqual({ type: 'artifact', artifact })
    expect(unkeyed.messages[1].parts.map((p) => p.type)).toEqual(['tool_result'])
  })

  it('r16 keeps an artifact off a user message when a completed tool carries that key', () => {
    const before = load([msg('u:owner', 'user'), msg('a:tail', 'assistant')], false)
    const after = recv(before, {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 't',
      messageKey: 'u:owner',
      messageKeySource: 'owner',
      result: 'receipt',
      isError: false,
      artifact: { publicationId: 'P' } as Extract<AppMessagePart, { type: 'artifact' }>['artifact']
    })
    expect(after.messages).toBe(before.messages)
    expect(after.transcriptChanges).toBe(before.transcriptChanges)
    expect(after.heldPatches.size).toBe(0)
  })

  it.each(['before', 'after', 'previous-turn'] as const)(
    'r16 checks the %s neighbor for a duplicate publication',
    (direction) => {
      const artifact = { publicationId: 'P' } as Extract<
        AppMessagePart,
        { type: 'artifact' }
      >['artifact']
      const duplicate = msg('a:neighbor', 'assistant', { type: 'artifact', artifact })
      const owner = msg('a:owner', 'assistant', {
        type: 'tool_call',
        toolRunId: 't',
        toolName: 'Write',
        args: {}
      })
      const messages =
        direction === 'after'
          ? [owner, duplicate]
          : direction === 'before'
            ? [duplicate, owner]
            : [duplicate, msg('u:next', 'user'), owner]
      const before = load(messages)
      const next = recv(before, {
        type: 'output.captured',
        sessionId: 's',
        toolRunId: 't',
        artifact
      })
      if (direction === 'previous-turn') {
        expect(next.messages.at(-1)?.parts).toEqual([
          ...owner.parts,
          { type: 'artifact', artifact }
        ])
        expect(next.transcriptChanges.log.at(-1)).toEqual({
          kind: 'replace',
          id: owner.id,
          partsFrom: 1
        })
      } else {
        expect(next).toBe(before)
      }
    }
  )

  it('r5 COMMIT_PENDING_TEXT targets messageKey even when not last assistant, and falls back when absent', () => {
    let s = load([
      msg('a:1', 'assistant', { type: 'reasoning', text: 'think' }),
      msg('a:2', 'assistant', { type: 'text', text: 'later' })
    ])
    s = chatReducer(s, { type: 'COMMIT_PENDING_TEXT', text: 'A body', messageKey: 'a:1' })
    expect(s.messages[0].parts.some((p) => p.type === 'text' && p.text === 'A body')).toBe(true)

    // Without messageKey after user -> creates r: message
    const afterUser = chatReducer(load([msg('u:1', 'user', { type: 'text', text: 'q' })]), {
      type: 'COMMIT_PENDING_TEXT',
      text: 'fallback'
    })
    expect(afterUser.messages[1].id.startsWith('r:')).toBe(true)
  })

  it('r6, r7, r8 preserve optimistic user id on echo, recommit idempotence, load id, fork r:, child c:', () => {
    const s = chatReducer(initialChatState, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: 'hello',
      clientId: 'c1'
    })
    expect(s.messages[0].id).toBe(userMessageId(['c1']))

    // r6: echo with same key -> no change
    const afterEcho = chatReducer(s, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: 'hello',
      messageKey: userMessageId(['c1']),
      ids: ['c1']
    })
    expect(afterEcho.messages).toBe(s.messages)

    // r7: recommit echo -> no change
    const afterRecommit = chatReducer(afterEcho, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: 'hello',
      messageKey: userMessageId(['c1']),
      ids: ['c1']
    })
    expect(afterRecommit.messages).toBe(s.messages)

    // r8: LOAD_SESSION preserves id, child uses c:
    const loaded = load([
      msg(
        'a:parent',
        'assistant',
        {
          type: 'tool_call',
          toolRunId: 'sub1',
          toolName: 'Agent',
          args: {}
        },
        {
          type: 'text',
          parentToolRunId: 'sub1',
          text: 'child text'
        }
      )
    ])
    expect(loaded.messages[0].id).toBe('a:parent')
    const child = transcriptIndexFor(loaded).childMessage('sub1')
    expect(child?.id).toBe('c:sub1')
  })

  it('r10, r11, r13 hold owner-sourced missing-key events on partial load and append on complete load or non-owner', () => {
    const partial = load([msg('u:tail', 'user', { type: 'text', text: 'tail' })], false)
    // r10 & r13: partial + messageKeySource='owner' -> held
    const held = recv(partial, {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'old-t',
      result: 'done',
      isError: false,
      messageKey: 'a:missing',
      messageKeySource: 'owner'
    })
    expect(held.messages).toHaveLength(1)
    expect(held.heldPatches.has('a:missing')).toBe(true)

    // r13: partial + no messageKeySource -> appends new message at end (held 0)
    const nonOwner = recv(partial, {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'cur-t',
      result: 'now',
      isError: false,
      messageKey: 'a:cur'
    })
    expect(nonOwner.messages.map((m) => m.id)).toEqual(['u:tail', 'a:cur'])
    expect(nonOwner.heldPatches.size).toBe(0)

    // r11: complete load + missing key -> appends new message at end
    const complete = load([msg('u:tail', 'user', { type: 'text', text: 'tail' })], true)
    const appended = recv(complete, {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 'old-t',
      result: 'done',
      isError: false,
      messageKey: 'a:missing',
      messageKeySource: 'owner'
    })
    expect(appended.messages.map((m) => m.id)).toEqual(['u:tail', 'a:missing'])
  })

  it('r12 replaces optimistic bubble with canonical mixed batch id and records reset{complete}', () => {
    let s = load([], false)
    s = chatReducer(s, { type: 'APPEND_COMMITTED_USER_MESSAGE', text: 'a', clientId: 'a' })
    expect(s.messages.map((m) => m.id)).toEqual(['u:a'])
    const mixed = chatReducer(s, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: 'a\nb',
      messageKey: userMessageId(['a', 'b']),
      ids: ['a', 'b']
    })
    expect(mixed.messages.map((m) => m.id)).toEqual(['u:a,b'])
    expect(mixed.messages[0].parts).toEqual([{ type: 'text', text: 'a\nb' }])
    expect(mixed.transcriptChanges.log.at(-1)).toEqual({ kind: 'reset', complete: false })

    // Re-delivery of same mixed batch -> no-op
    const redeliver = chatReducer(mixed, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: 'a\nb',
      messageKey: userMessageId(['a', 'b']),
      ids: ['a', 'b']
    })
    expect(redeliver.messages).toBe(mixed.messages)

    // Steer batch without optimistic bubble -> append
    const steerOnly = chatReducer(mixed, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: 'steer',
      messageKey: userMessageId(['c']),
      ids: ['c']
    })
    expect(steerOnly.messages.map((m) => m.id)).toEqual(['u:a,b', 'u:c'])
    expect(steerOnly.transcriptChanges.log.at(-1)).toEqual({ kind: 'append', ids: ['u:c'] })
  })

  it('r14 replaces same tool_result and response_boundary merge key in place while keeping begin/end separate', () => {
    let s = load([msg('a:1', 'assistant', { type: 'text', text: 'hi' })])
    s = recv(s, {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 't1',
      result: 'v1',
      isError: false,
      messageKey: 'a:1'
    })
    expect(s.messages[0].parts).toHaveLength(2)
    s = recv(s, {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 't1',
      result: 'v2',
      isError: false,
      messageKey: 'a:1'
    })
    expect(s.messages[0].parts).toHaveLength(2)
    expect((s.messages[0].parts[1] as { result: unknown }).result).toBe('v2')
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'replace', id: 'a:1', partsFrom: 1 })

    s = recv(s, {
      type: 'response.boundary',
      sessionId: 's',
      boundary: { id: 'rb1', phase: 'begin', kind: 'work' },
      messageKey: 'a:1'
    } as NormalizedEvent)
    s = recv(s, {
      type: 'response.boundary',
      sessionId: 's',
      boundary: { id: 'rb1', phase: 'end', outcome: 'ended' },
      messageKey: 'a:1'
    } as NormalizedEvent)
    expect(s.messages[0].parts).toHaveLength(4)
    s = recv(s, {
      type: 'response.boundary',
      sessionId: 's',
      boundary: { id: 'rb1', phase: 'end', outcome: 'ended' },
      messageKey: 'a:1'
    } as NormalizedEvent)
    expect(s.messages[0].parts).toHaveLength(4)
    s = recv(s, {
      type: 'response.boundary',
      sessionId: 's',
      messageKey: 'a:1',
      boundary: { id: 'other', phase: 'end', outcome: 'failed' }
    })
    s = recv(s, {
      type: 'response.boundary',
      sessionId: 's',
      messageKey: 'a:1',
      boundary: { id: 'rb1', phase: 'end', outcome: 'aborted' }
    })
    expect(s.messages[0].parts.slice(2)).toEqual([
      { type: 'response_boundary', boundary: { id: 'rb1', phase: 'begin', kind: 'work' } },
      { type: 'response_boundary', boundary: { id: 'rb1', phase: 'end', outcome: 'aborted' } },
      { type: 'response_boundary', boundary: { id: 'other', phase: 'end', outcome: 'failed' } }
    ])
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'replace', id: 'a:1', partsFrom: 3 })
  })

  it.each([true, false])(
    'r15 restores held boundary and output on a same-session reset with preserveLocalState=%s',
    (preserveLocalState) => {
      let state = load([], false)
      const artifact = { publicationId: 'held' } as Extract<
        AppMessagePart,
        { type: 'artifact' }
      >['artifact']
      const end = {
        type: 'response.boundary' as const,
        sessionId: 's',
        messageKey: 'a:past',
        messageKeySource: 'owner' as const
      }
      state = recv(state, { ...end, boundary: { id: 'r', phase: 'end', outcome: 'failed' } })
      state = recv(state, { type: 'output.captured', sessionId: 's', responseId: 'r', artifact })
      state = recv(state, {
        type: 'output.captured',
        sessionId: 's',
        toolRunId: 'absent',
        responseId: 'r',
        artifact
      })
      expect([...state.heldOutputs.keys()]).toEqual(['response:r', 'tool:absent'])
      const session = {
        id: 's',
        backend: 'claude' as const,
        agentKind: 'code' as const,
        title: null,
        messages: [
          msg(
            'a:past',
            'assistant',
            { type: 'response_boundary', boundary: { phase: 'begin', id: 'r' } },
            { type: 'response_boundary', boundary: { phase: 'end', id: 'r', outcome: 'ended' } }
          )
        ]
      }
      const diag = vi.fn()
      const reset = { type: 'LOAD_SESSION' as const, session, diagnostic: diag, preserveLocalState }
      const partial = chatReducer(state, { ...reset, complete: false })
      expect(partial.messages[0].parts).toEqual([
        session.messages[0].parts[0],
        { type: 'response_boundary', boundary: { phase: 'end', id: 'r', outcome: 'failed' } },
        { type: 'artifact', artifact }
      ])
      expect(partial.heldPatches.size).toBe(0)
      expect([...partial.heldOutputs.keys()]).toEqual(['tool:absent'])
      expect(diag).not.toHaveBeenCalled()
      const complete = chatReducer(state, { ...reset, complete: true })
      expect(complete.messages).toEqual(partial.messages)
      expect(complete.heldOutputs.size).toBe(0)
      expect(diag.mock.calls).toEqual([['heldPatchOrphaned', 1]])
      const unrelated = chatReducer(state, {
        ...reset,
        session: { ...session, id: 'other' },
        complete: false
      })
      expect(unrelated.messages[0].parts).toEqual(session.messages[0].parts)
      expect(unrelated.heldOutputs.size).toBe(0)
      expect(unrelated.heldPatches.size).toBe(0)
    }
  )

  it('r15 merges held patches/outputs on LOAD_SESSION reset{complete:true/false} and reports orphaned', () => {
    const partial = load([msg('u:tail', 'user', { type: 'text', text: 'tail' })], false)
    let held = recv(partial, {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 't1',
      result: 'final',
      isError: false,
      messageKey: 'a:old',
      messageKeySource: 'owner'
    })
    held = recv(held, {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 't2',
      result: 'orphan',
      isError: false,
      messageKey: 'a:gone',
      messageKeySource: 'owner'
    })

    // reset{complete: false}: merges owned, keeps missing
    const partialReset = chatReducer(held, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        backend: 'claude',
        agentKind: 'code',
        title: null,
        messages: [
          msg('a:old', 'assistant', {
            type: 'tool_call',
            toolRunId: 't1',
            toolName: 'Bash',
            args: {}
          })
        ]
      },
      complete: false
    })
    expect(
      partialReset.messages[0].parts.some((p) => p.type === 'tool_result' && p.toolRunId === 't1')
    ).toBe(true)
    expect(partialReset.heldPatches.has('a:old')).toBe(false)
    expect(partialReset.heldPatches.has('a:gone')).toBe(true)

    // reset{complete: true}: merges owned, drops orphan with diagnostic
    const diag = vi.fn()
    const fullReset = chatReducer(held, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        backend: 'claude',
        agentKind: 'code',
        title: null,
        messages: [
          msg('a:old', 'assistant', {
            type: 'tool_call',
            toolRunId: 't1',
            toolName: 'Bash',
            args: {}
          })
        ]
      },
      complete: true,
      diagnostic: diag
    })
    expect(
      fullReset.messages[0].parts.some((p) => p.type === 'tool_result' && p.toolRunId === 't1')
    ).toBe(true)
    expect(fullReset.heldPatches.size).toBe(0)
    expect(diag).toHaveBeenCalledWith('heldPatchOrphaned', 1)
  })

  it('r16 & r17 keep distinct publications per tool/response, dedup by publicationId, and hold missing owners on partial load', () => {
    const art = (
      publicationId: string
    ): Extract<AppMessagePart, { type: 'artifact' }>['artifact'] =>
      ({ publicationId }) as Extract<AppMessagePart, { type: 'artifact' }>['artifact']
    let s = load([
      msg(
        'a:1',
        'assistant',
        { type: 'tool_call', toolRunId: 't1', toolName: 'Write', args: {} },
        { type: 'response_boundary', boundary: { id: 'rb1', phase: 'begin' } }
      )
    ])
    s = recv(s, {
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 't1',
      result: 'ok',
      isError: false,
      artifact: art('P1'),
      messageKey: 'a:1'
    })
    s = recv(s, {
      type: 'output.captured',
      sessionId: 's',
      toolRunId: 't1',
      artifact: art('P2')
    })
    s = recv(s, {
      type: 'output.captured',
      sessionId: 's',
      responseId: 'rb1',
      artifact: art('Q1')
    })
    s = recv(s, {
      type: 'output.captured',
      sessionId: 's',
      responseId: 'rb1',
      artifact: art('Q2')
    })
    const artIds = s.messages[0].parts
      .filter((p): p is Extract<AppMessagePart, { type: 'artifact' }> => p.type === 'artifact')
      .map((p) => p.artifact.publicationId)
    expect(artIds).toEqual(['P1', 'P2', 'Q1', 'Q2'])

    // Re-delivery of P1 -> no-op
    const revBefore = s.transcriptChanges.revision
    const dup = recv(s, {
      type: 'output.captured',
      sessionId: 's',
      toolRunId: 't1',
      artifact: art('P1')
    })
    expect(dup.transcriptChanges.revision).toBe(revBefore)

    // r17: partial load with missing owner holds in heldOutputs; complete load ignores
    const partial = load([msg('u:tail', 'user', { type: 'text', text: 'tail' })], false)
    const heldOut = recv(partial, {
      type: 'output.captured',
      sessionId: 's',
      toolRunId: 'missing-tool',
      artifact: art('H1')
    })
    expect(heldOut.heldOutputs.has('tool:missing-tool')).toBe(true)
    expect(heldOut.messages).toBe(partial.messages)

    const complete = load([msg('u:tail', 'user', { type: 'text', text: 'tail' })], true)
    const ignoredOut = recv(complete, {
      type: 'output.captured',
      sessionId: 's',
      toolRunId: 'missing-tool',
      artifact: art('H1')
    })
    expect(ignoredOut.heldOutputs.size).toBe(0)
    expect(ignoredOut.messages).toBe(complete.messages)
  })
})
