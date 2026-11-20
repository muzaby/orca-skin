import { describe, expect, it, vi } from 'vitest'
import type { AppMessagePart } from '../../../../../../shared/ipc'
import type { Message } from '../../reducer/chatReducer'
import { newTranscriptChanges, recordChange } from './changeLog'
import { messageOrderFor } from './messageOrder'

function tool(toolRunId: string): AppMessagePart {
  return { type: 'tool_call', toolRunId, toolName: 'Read', args: {} }
}

function message(id: string, parts: AppMessagePart[] = []): Message {
  return { id, role: 'assistant', createdAt: 0, parts }
}

describe('transcript order and part ownership', () => {
  it('updates suffix contributions without reading unrelated messages and keeps first ownership', () => {
    const reads = vi.fn()
    const other = message('other', [tool('duplicate')])
    const history: Message[] = Array.from({ length: 10_000 }, (_, index) => ({
      id: String(index),
      role: 'assistant',
      createdAt: 0,
      get parts() {
        reads(index)
        return []
      }
    }))
    history[1] = message('target', [tool('duplicate'), tool('old')])
    history[2] = other
    const before = { messages: history, transcriptChanges: newTranscriptChanges() }
    expect(messageOrderFor(before, true).toolCallOwner('duplicate')).toBe('target')
    reads.mockClear()

    const messages = history.slice()
    messages[1] = message('target', [tool('duplicate'), tool('new')])
    const transcriptChanges = recordChange(before.transcriptChanges, {
      kind: 'replace',
      id: 'target',
      partsFrom: 1
    })
    const order = messageOrderFor({ messages, transcriptChanges }, true)
    expect(order.toolCallOwner('old')).toBeUndefined()
    expect(order.toolCallOwner('new')).toBe('target')
    expect(order.toolCallOwner('duplicate')).toBe('target')
    expect(order.messagePosition('target')).toBe(1)
    expect(reads).not.toHaveBeenCalled()
  })

  it('applies prepends, deletion and readdition in order while contents catch up independently', () => {
    const before = {
      messages: [message('a', [tool('old')]), message('b')],
      transcriptChanges: newTranscriptChanges()
    }
    expect(messageOrderFor(before, true).toolCallOwner('old')).toBe('a')
    let changes = recordChange(before.transcriptChanges, { kind: 'prepend', ids: ['p', 'q'] })
    changes = recordChange(changes, { kind: 'remove', ids: ['a'] })
    changes = recordChange(changes, { kind: 'append', ids: ['a'] })
    const order = messageOrderFor(
      {
        messages: [message('p'), message('q'), before.messages[1], message('a', [tool('new')])],
        transcriptChanges: changes
      },
      true
    )
    expect(['p', 'q', 'b', 'a'].map((id) => order.messagePosition(id))).toEqual([0, 1, 2, 3])
    expect(order.toolCallOwner('old')).toBeUndefined()
    expect(order.toolCallOwner('new')).toBe('a')
  })

  it('keeps independent owners for the same provider ID and withdraws only the changed suffix', () => {
    const id = 'shared'
    const result: AppMessagePart = {
      type: 'tool_result',
      toolRunId: id,
      result: 'done',
      isError: false
    }
    const call = tool(id)
    const base = [
      message('t', [call, result, result, call]),
      message('b', [{ type: 'response_boundary', boundary: { phase: 'begin', id } }]),
      message('n', [{ type: 'subagent_notice', toolRunId: id, status: 'completed' }]),
      message('later', [call])
    ]
    const initial = { messages: base, transcriptChanges: newTranscriptChanges() }
    const order = messageOrderFor(initial, true)
    expect([order.toolCallOwner(id), order.responseOwner(id), order.noticeOwner(id)]).toEqual([
      't',
      'b',
      'n'
    ])
    expect(order.partSlot('t', 'result:shared')).toBe(1)
    const parts = [call, result]
    const readPrefix = vi.fn(() => result)
    Object.defineProperty(parts, 1, { get: readPrefix })
    const shortened = {
      messages: [message('t', parts), ...base.slice(1)],
      transcriptChanges: recordChange(initial.transcriptChanges, {
        kind: 'replace',
        id: 't',
        partsFrom: 2
      })
    }
    messageOrderFor(shortened, true)
    expect(readPrefix).not.toHaveBeenCalled()
    expect(order.toolCallOwner(id)).toBe('t')
    expect(order.partSlot('t', 'result:shared')).toBe(1)
    const boundaryEnd = message('b', [
      { type: 'response_boundary', boundary: { phase: 'end', id, outcome: 'ended' } }
    ])
    const removed = recordChange(shortened.transcriptChanges, { kind: 'remove', ids: ['t'] })
    messageOrderFor(
      {
        messages: [boundaryEnd, ...base.slice(2)],
        transcriptChanges: recordChange(removed, { kind: 'replace', id: 'b', partsFrom: 0 })
      },
      true
    )
    expect([order.toolCallOwner(id), order.responseOwner(id), order.noticeOwner(id)]).toEqual([
      'later',
      undefined,
      'n'
    ])
    expect(order.partSlot('t', 'result:shared')).toBeUndefined()
    expect(order.partSlot('b', 'boundary:begin:shared')).toBeUndefined()
    expect(order.partSlot('b', 'boundary:end:shared')).toBe(0)
  })

  it('q1, q2, q3, q4, q5, q6, q7 cover append, replace partsFrom, 10k index-1 reads=0, prepend ordinal, remove re-index, reset, and withdrawal', () => {
    const reads = vi.fn()
    const baseMsgs: Message[] = Array.from({ length: 10_000 }, (_, i) => ({
      id: `m:${i}`,
      role: 'assistant',
      createdAt: 0,
      get parts() {
        reads(i)
        return []
      }
    }))
    baseMsgs[1] = message('m:1', [tool('keep'), tool('old')])
    let state = { messages: baseMsgs, transcriptChanges: newTranscriptChanges() }
    const init = messageOrderFor(state, true)
    expect(init.messagePosition('m:0')).toBe(0)
    expect(init.messagePosition('m:1')).toBe(1)
    expect(init.toolCallOwner('old')).toBe('m:1')
    reads.mockClear()

    // q1: append increments ordinal; position = ordinal - firstOrdinal
    const appended = [...state.messages, message('m:10000', [tool('tail')])]
    state = {
      messages: appended,
      transcriptChanges: recordChange(state.transcriptChanges, { kind: 'append', ids: ['m:10000'] })
    }
    const afterQ1 = messageOrderFor(state, true)
    expect(afterQ1.messagePosition('m:10000')).toBe(10_000)
    expect(afterQ1.toolCallOwner('tail')).toBe('m:10000')
    expect(reads).not.toHaveBeenCalled()

    // q2, q3, q7: replace{partsFrom: 1} at index 1 withdraws 'old', adds 'new', reads 0 unrelated
    const replaced = state.messages.slice()
    replaced[1] = message('m:1', [tool('keep'), tool('new')])
    state = {
      messages: replaced,
      transcriptChanges: recordChange(state.transcriptChanges, {
        kind: 'replace',
        id: 'm:1',
        partsFrom: 1
      })
    }
    const afterQ237 = messageOrderFor(state, true)
    expect(afterQ237.toolCallOwner('old')).toBeUndefined()
    expect(afterQ237.toolCallOwner('new')).toBe('m:1')
    expect(afterQ237.toolCallOwner('keep')).toBe('m:1')
    expect(reads).not.toHaveBeenCalled()

    // q4: prepend k decrements ordinals without re-reading existing messages
    const prepended = [message('p:0'), message('p:1'), ...state.messages]
    state = {
      messages: prepended,
      transcriptChanges: recordChange(state.transcriptChanges, {
        kind: 'prepend',
        ids: ['p:0', 'p:1']
      })
    }
    const afterQ4 = messageOrderFor(state, true)
    expect(afterQ4.messagePosition('p:0')).toBe(0)
    expect(afterQ4.messagePosition('m:0')).toBe(2)
    expect(afterQ4.messagePosition('m:10000')).toBe(10_002)
    expect(reads).not.toHaveBeenCalled()

    // q5: remove middle marks positions dirty -> recomputed once on next lookup
    const removed = state.messages.filter((m) => m.id !== 'p:1')
    state = {
      messages: removed,
      transcriptChanges: recordChange(state.transcriptChanges, { kind: 'remove', ids: ['p:1'] })
    }
    const afterQ5 = messageOrderFor(state, true)
    expect(afterQ5.messagePosition('p:1')).toBe(-1)
    expect(afterQ5.messagePosition('m:0')).toBe(1)
    expect(afterQ5.messagePosition('m:1')).toBe(2)

    // q6: reset rebuilds cleanly
    const resetMsgs = [message('r:0', [tool('fresh')]), message('m:1')]
    const afterQ6 = messageOrderFor(
      {
        messages: resetMsgs,
        transcriptChanges: recordChange(state.transcriptChanges, { kind: 'reset', complete: true })
      },
      true
    )
    expect(afterQ6.messagePosition('r:0')).toBe(0)
    expect(afterQ6.toolCallOwner('fresh')).toBe('r:0')
    expect(afterQ6.toolCallOwner('new')).toBeUndefined()
  })
})
