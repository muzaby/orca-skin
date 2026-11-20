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

it('q5 rebuilds ranks only on the first surviving lookup and q6 withdraws retired result slots', () => {
  const result: AppMessagePart = {
    type: 'tool_result',
    toolRunId: 'old',
    result: 'one',
    isError: false
  }
  const rows = [message('before'), message('gone'), message('result', [result])]
  let changes = newTranscriptChanges()
  const order = messageOrderFor({ messages: rows, transcriptChanges: changes }, true)
  expect(order.partSlot('result', 'result:old')).toBe(0)
  changes = recordChange(changes, { kind: 'remove', ids: ['gone'] })
  const next = messageOrderFor({ messages: [rows[0], rows[2]], transcriptChanges: changes }, true)
  const ranks = Reflect.get(next, 'ranks')
  const set = vi.spyOn(ranks, 'set')
  try {
    expect(next.messagePosition('gone')).toBe(-1)
    expect(set).not.toHaveBeenCalled()
    expect(next.messagePosition('result')).toBe(1)
    expect(set).toHaveBeenCalledTimes(2)
    expect(next.messagePosition('before')).toBe(0)
    expect(set).toHaveBeenCalledTimes(2)
  } finally {
    set.mockRestore()
  }
  changes = recordChange(changes, { kind: 'reset', complete: true })
  const reset = messageOrderFor({ messages: [message('new')], transcriptChanges: changes }, true)
  expect(reset.partSlot('result', 'result:old')).toBeUndefined()
})

it('q census indexes parts only on demand and respects snapshot, revision and lineage', () => {
  const firstParts = vi.fn(() => [tool('first')])
  const nextParts = vi.fn(() => [tool('next')])
  const first = {
    ...message('a'),
    get parts() {
      return firstParts()
    }
  }
  const next = {
    ...message('b'),
    get parts() {
      return nextParts()
    }
  }
  const changes = newTranscriptChanges()
  const initial = { messages: [first], transcriptChanges: changes }
  const order = messageOrderFor(initial)
  const appended = {
    messages: [first, next],
    transcriptChanges: recordChange(changes, { kind: 'append', ids: ['b'] })
  }
  expect(messageOrderFor(appended)).toBe(order)
  expect(order.messagePosition('b')).toBe(1)
  expect([firstParts.mock.calls.length, nextParts.mock.calls.length]).toEqual([0, 0])
  messageOrderFor(appended, true)
  messageOrderFor(appended, true)
  expect([firstParts.mock.calls.length, nextParts.mock.calls.length]).toEqual([1, 1])
  expect(order.toolCallOwner('next')).toBe('b')

  const changedRevision = recordChange(appended.transcriptChanges, {
    kind: 'reset',
    complete: true
  })
  messageOrderFor({ ...appended, transcriptChanges: changedRevision }, true)
  expect([firstParts.mock.calls.length, nextParts.mock.calls.length]).toEqual([2, 2])
  messageOrderFor({ messages: [next], transcriptChanges: changedRevision }, true)
  expect(order.messagePosition('b')).toBe(0)
  expect(order.toolCallOwner('first')).toBeUndefined()
  const independent = messageOrderFor({
    messages: [first],
    transcriptChanges: newTranscriptChanges()
  })
  expect(independent).not.toBe(order)
  expect(independent.messagePosition('b')).toBe(-1)
  expect(order.messagePosition('b')).toBe(0)
})

it('q census selects the earliest ordinal and retires sparse slot and owner maps', () => {
  const late = message('late', [tool('shared')])
  const early = message('early', [
    tool('shared'),
    { type: 'text', text: 'unindexed' },
    { type: 'tool_result', toolRunId: 'merge-only', result: 'ok', isError: false },
    { type: 'response_boundary', boundary: { phase: 'begin', id: 'both' } }
  ])
  let changes = newTranscriptChanges()
  const order = messageOrderFor({ messages: [late], transcriptChanges: changes }, true)
  changes = recordChange(changes, { kind: 'prepend', ids: ['early'] })
  messageOrderFor({ messages: [early, late], transcriptChanges: changes }, true)
  expect(order.toolCallOwner('shared')).toBe('early')
  expect(order.responseOwner('both')).toBe('early')
  expect(order.partSlot('early', 'result:merge-only')).toBe(2)
  expect(order.partSlot('early', 'boundary:begin:both')).toBe(3)
  const contributions = Reflect.get(order, 'contributions')
  const merges = Reflect.get(order, 'merges')
  const owners = Reflect.get(order, 'ownership')
  expect([...contributions.get('early').keys()]).toEqual([0, 2, 3])
  expect([...owners.keys()].sort()).toEqual(['response:both', 'tool:shared'])
  changes = recordChange(changes, { kind: 'replace', id: 'early', partsFrom: 3 })
  messageOrderFor(
    { messages: [message('early', early.parts.slice(0, 3)), late], transcriptChanges: changes },
    true
  )
  expect([...merges.get('early').keys()]).toEqual(['result:merge-only'])
  changes = recordChange(changes, { kind: 'remove', ids: ['early'] })
  messageOrderFor({ messages: [late], transcriptChanges: changes }, true)
  expect(order.toolCallOwner('shared')).toBe('late')
  expect(order.responseOwner('both')).toBeUndefined()
  expect(order.partSlot('early', 'result:merge-only')).toBeUndefined()
  expect([...contributions.keys()]).toEqual(['late'])
  expect(merges.size).toBe(0)
  expect([...owners.keys()]).toEqual(['tool:shared'])
})

it('q census keeps separate anonymous users across an indexed reset', () => {
  const user = (name: string): Message => {
    const legacy: Message = { ...message(name, [tool(name)]), role: 'user' }
    Reflect.deleteProperty(legacy, 'id')
    return legacy
  }
  const rows = [user('left'), user('right')]
  const changes = newTranscriptChanges()
  const order = messageOrderFor({ messages: rows, transcriptChanges: changes }, true)
  const ids = ['left', 'right'].map((name) => order.toolCallOwner(name))
  expect(ids[0]).toEqual(expect.stringMatching(/^r:legacy-/))
  expect(ids[1]).toEqual(expect.stringMatching(/^r:legacy-/))
  expect(ids[0]).not.toBe(ids[1])
  messageOrderFor(
    {
      messages: [rows[1], rows[0]],
      transcriptChanges: recordChange(changes, { kind: 'reset', complete: true })
    },
    true
  )
  expect(['left', 'right'].map((name) => order.toolCallOwner(name))).toEqual(ids)
})

it('q census preserves merge slots on extension and rebuilds after the change window expires', () => {
  const result = (toolRunId: string): AppMessagePart => ({
    type: 'tool_result',
    toolRunId,
    isError: false,
    result: 'ok'
  })
  let changes = newTranscriptChanges()
  const order = messageOrderFor(
    { messages: [message('a', [result('old')])], transcriptChanges: changes },
    true
  )
  changes = recordChange(changes, { kind: 'replace', id: 'a', partsFrom: 1 })
  messageOrderFor(
    { messages: [message('a', [result('old'), result('new')])], transcriptChanges: changes },
    true
  )
  expect(order.partSlot('a', 'result:old')).toBe(0)
  expect(order.partSlot('a', 'result:new')).toBe(1)
  const messages: Message[] = []
  changes = recordChange(changes, { kind: 'remove', ids: ['a'] })
  for (let i = 0; i < 65; i++) {
    const id = String(i)
    messages.push(message(id, [tool(id)]))
    changes = recordChange(changes, { kind: 'append', ids: [id] })
  }
  messageOrderFor({ messages, transcriptChanges: changes }, true)
  expect(order.messagePosition('a')).toBe(-1)
  expect(order.partSlot('a', 'result:old')).toBeUndefined()
  expect(order.toolCallOwner('0')).toBe('0')
  expect(order.messagePosition('64')).toBe(64)
})
