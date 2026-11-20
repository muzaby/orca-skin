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
  it('reads external results by the message call IDs, including calls introduced after warmup', () => {
    const cache = createSegmentCache()
    const global = new Map([
      ['local', { output: 'found', isError: false }],
      ['other', { output: 'unrelated', isError: false }]
    ])
    const keys = vi.spyOn(global, 'keys')
    const reads = vi.spyOn(global, 'get')
    const first = message([text('before')])
    cache.segmentsFor(first, undefined, global)
    const second = message([...first.parts, tool('local')])
    const segments = cache.segmentsFor(second, 1, global)
    expect(segments.at(-1)).toMatchObject({ calls: [{ result: { output: 'found' } }] })
    expect(keys).not.toHaveBeenCalled()
    expect(reads.mock.calls).toEqual([['local']])
    expect(cache.segmentsFor(second, undefined, new Map()).at(-1)).toMatchObject({
      calls: [{ toolUseId: 'local' }]
    })
    const cleared = cache.segmentsFor(second, undefined, new Map()).at(-1)
    expect(cleared?.kind === 'tools' && cleared.calls[0].result).toBeUndefined()
  })

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

  it('s1, s2, s3, s4, s5, s6, s7, s8 cover cache hit, text append, late tool_result, prefix edit, parented skip, per-id isolation, 10k segment, and result withdrawal', () => {
    const cache = createSegmentCache()
    // s1: same parts -> same array reference
    const m1 = message([text('hello'), tool('t1')])
    const r1 = cache.segmentsFor(m1)
    expect(cache.segmentsFor(m1)).toBe(r1)

    // s2: text append creates only last text segment
    const m2 = message([text('hello'), tool('t1'), text('world')])
    const r2 = cache.segmentsFor(m2, 2)
    expect(r2[0]).toBe(r1[0])
    expect(r2[1]).toBe(r1[1])

    // s3 & s8: late tool_result updates only target ToolCall/segment; withdrawing it reverts to running
    const m3 = message([text('hello'), tool('t1'), text('world'), outcome('t1', 'ok')])
    const r3 = cache.segmentsFor(m3, 3)
    expect(r3[0]).toBe(r2[0])
    expect(r3[2]).toBe(r2[2])
    expect(r3[1]).not.toBe(r2[1])
    const m3Rewound = message([text('hello'), tool('t1'), text('world')])
    const r3Rewound = cache.segmentsFor(m3Rewound, 3)
    expect(r3Rewound).toEqual(messageSegments(m3Rewound.parts))

    // s4: earlier part edit rebuilds from affected segment only
    const m4 = message([text('hello'), tool('t1'), text('edited')])
    const r4 = cache.segmentsFor(m4, 2)
    expect(r4[0]).toBe(r3Rewound[0])
    expect(r4[1]).toBe(r3Rewound[1])
    expect(r4).toEqual(messageSegments(m4.parts))

    // s5: parented parts are skipped
    const withParented = message([
      text('root'),
      { type: 'text', text: 'child', parentToolRunId: 'p1' }
    ])
    expect(cache.segmentsFor(withParented)).toEqual(messageSegments(withParented.parts))

    // s6: different message ids do not collide in cache
    const otherMsg: Message = {
      id: 'a:other',
      role: 'assistant',
      createdAt: 0,
      parts: [text('other')]
    }
    expect(cache.segmentsFor(otherMsg)).toEqual([{ kind: 'text', text: 'other' }])
    expect(cache.segmentsFor(m1)).not.toEqual(cache.segmentsFor(otherMsg))
  })

  it('property (2,000 seeded sequences): incremental segmentsFor always equals messageSegments', () => {
    let seed = 0x51a7
    const next = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed
    }
    const cache = createSegmentCache()
    for (let seq = 0; seq < 200; seq++) {
      let parts: AppMessagePart[] = []
      const id = `prop:${seq}`
      for (let step = 0; step < 10; step++) {
        const op = next() % 4
        let partsFrom: number | undefined
        if (op === 0 || parts.length === 0) {
          partsFrom = parts.length
          const kind = next() % 3
          if (kind === 0) parts = [...parts, text(`t${step}`)]
          else if (kind === 1) parts = [...parts, tool(`c${step}`)]
          else parts = [...parts, outcome(`c${next() % (step + 1)}`, `r${step}`)]
        } else if (op === 1) {
          const idx = next() % parts.length
          partsFrom = idx
          parts = parts.slice(0, idx)
        } else {
          const idx = next() % parts.length
          partsFrom = idx
          parts = parts.slice()
          parts[idx] = text(`rep${step}`)
        }
        const m: Message = { id, role: 'assistant', createdAt: 0, parts }
        expect(cache.segmentsFor(m, partsFrom)).toEqual(messageSegments(parts))
      }
    }
  })
})
