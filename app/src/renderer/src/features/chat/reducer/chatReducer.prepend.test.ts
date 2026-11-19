import { describe, expect, it, vi } from 'vitest'
import type { AppMessagePart, LoadedMessage, NormalizedEvent } from '../../../../../shared/ipc'
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
})
