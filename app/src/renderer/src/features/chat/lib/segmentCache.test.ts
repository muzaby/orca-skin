import { describe, expect, it, vi } from 'vitest'
import type { AppMessagePart } from '../../../../../shared/ipc'
import type { Message } from '../reducer/chatReducer'
import { messageSegments } from './parts'
import { createSegmentCache, rememberMessageEdit } from './segmentCache'

function message(parts: AppMessagePart[]): Message {
  return { id: 'a:1', role: 'assistant', createdAt: 0, parts }
}
const text = (text: string): AppMessagePart => ({ type: 'text', text })
const tool = (toolRunId: string): AppMessagePart => ({
  type: 'tool_call',
  toolRunId,
  toolName: 'Read',
  args: {}
})
const outcome = (toolRunId: string, result: string): AppMessagePart => ({
  type: 'tool_result',
  toolRunId,
  result,
  isError: false
})

describe('incremental message segments', () => {
  it('only reads the appended part when extending a long group', () => {
    const cache = createSegmentCache()
    const first = message(Array.from({ length: 10_000 }, () => text('x')))
    const before = cache.segmentsFor(first)
    const reads = vi.fn()
    const next = message(
      new Proxy([...first.parts, text('y')], {
        get(target, property, receiver) {
          if (typeof property === 'string' && /^\d+$/.test(property)) reads(property)
          return Reflect.get(target, property, receiver)
        }
      })
    )
    rememberMessageEdit(next, first, first.parts.length)
    const after = cache.segmentsFor(next)
    expect(reads).toHaveBeenCalledExactlyOnceWith('10000')
    expect(before).toEqual([{ kind: 'text', text: 'x'.repeat(10_000) }])
    expect(after).toEqual([{ kind: 'text', text: 'x'.repeat(10_000) + 'y' }])
    expect(cache.segmentsFor(next)).toBe(after)
  })

  it('shares sibling calls and removes a result contribution when rewound', () => {
    const cache = createSegmentCache()
    const parts = [tool('a'), tool('b'), text('done')]
    const first = cache.segmentsFor(message(parts))
    const withResult = [...parts, outcome('a', 'read')]
    const second = cache.segmentsFor(message(withResult), parts.length)
    expect(second).toEqual(messageSegments(withResult))
    expect(second[1]).toBe(first[1])
    if (first[0].kind !== 'tools' || second[0].kind !== 'tools') throw new Error('expected tools')
    expect(second[0].calls[0]).not.toBe(first[0].calls[0])
    expect(second[0].calls[1]).toBe(first[0].calls[1])
    expect(cache.segmentsFor(message(parts), parts.length)).toEqual(messageSegments(parts))
    expect(second[0].calls[0].result?.output).toBe('read')
  })

  it('rebuilds only the affected group and suffix after an edit before a hidden gap', () => {
    const cache = createSegmentCache()
    const compact: AppMessagePart = { type: 'compact_boundary' }
    const first = [compact, text('one'), outcome('missing', 'hidden'), text('two')]
    const second = [compact, text('one'), outcome('missing', 'updated'), tool('new'), text('two')]
    const before = cache.segmentsFor(message(first))
    const after = cache.segmentsFor(message(second), 2)
    expect(after).toEqual(messageSegments(second))
    expect(after[0]).toBe(before[0])
  })
})
