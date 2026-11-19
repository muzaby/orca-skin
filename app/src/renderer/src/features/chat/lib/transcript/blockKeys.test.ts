import { describe, expect, it } from 'vitest'
import type { Message } from '../../reducer/chatReducer'
import {
  activityBlockKey,
  assertUniqueBlockKeys,
  carryPartKeys,
  liveBlockKey,
  nextPartKey,
  partBlockKey,
  PartKeyTracker,
  representativePart,
  toolBlockKey,
  turnArtifactsKey,
  turnMetaKey,
  userBlockKey,
  type MultiPartGroupRef
} from './blockKeys'
import { isTurnStart } from './turnStart'

function msg(id: string, role: 'user' | 'assistant', parts: Message['parts']): Message {
  return { id, role, createdAt: 1, parts }
}

describe('blockKeys (EP-7 y1~y20)', () => {
  it('produces canonical key formats for all block types', () => {
    expect(userBlockKey('u:1')).toBe('u:1:user')
    expect(partBlockKey('a:1', 'text', 0)).toBe('a:1:text:0')
    expect(toolBlockKey('a:1', 't1')).toBe('a:1:tool:t1')
    expect(activityBlockKey('a:1', 't1')).toBe('a:1:activity:t1')
    expect(turnMetaKey('a:1')).toBe('a:1:meta')
    expect(turnArtifactsKey('a:1')).toBe('a:1:artifacts')
    expect(liveBlockKey('s1')).toBe('live:s1')
  })

  it('y8: assertUniqueBlockKeys throws on duplicate keys', () => {
    expect(() =>
      assertUniqueBlockKeys([{ key: 'a:1:text:0' }, { key: 'a:1:text:1' }])
    ).not.toThrow()
    expect(() => assertUniqueBlockKeys([{ key: 'a:1:text:0' }, { key: 'a:1:text:0' }])).toThrow(
      /Duplicate transcript block key/
    )
  })

  it('y3·y14: inserting reasoning or same-kind text before existing text preserves existing text key', () => {
    const tracker = new PartKeyTracker()
    const m1 = msg('a:1', 'assistant', [{ type: 'text', text: 'original' }])
    const k1 = carryPartKeys(tracker, 'a:1', undefined, m1)
    expect(k1.map((e) => e.key)).toEqual(['a:1:text:0'])

    // y3: reasoning inserted before text
    const m2 = msg('a:1', 'assistant', [
      { type: 'reasoning', text: 'thinking' },
      { type: 'text', text: 'original' }
    ])
    const k2 = carryPartKeys(tracker, 'a:1', k1, m2)
    expect(k2.map((e) => e.key)).toEqual(['a:1:reasoning:0', 'a:1:text:0'])

    // y14: new text inserted before original text
    const m3 = msg('a:1', 'assistant', [
      { type: 'text', text: 'inserted' },
      { type: 'reasoning', text: 'thinking' },
      { type: 'text', text: 'original' }
    ])
    const k3 = carryPartKeys(tracker, 'a:1', k2, m3)
    expect(k3.map((e) => e.key)).toEqual(['a:1:text:1', 'a:1:reasoning:0', 'a:1:text:0'])
  })

  it('y15: deleting a part and adding another of the same kind never reuses the deleted sequence', () => {
    const tracker = new PartKeyTracker()
    const k1 = carryPartKeys(
      tracker,
      'a:1',
      undefined,
      msg('a:1', 'assistant', [{ type: 'text', text: 'A' }])
    )
    expect(k1[0].key).toBe('a:1:text:0')

    const k2 = carryPartKeys(tracker, 'a:1', k1, msg('a:1', 'assistant', []))
    expect(k2).toEqual([])

    const k3 = carryPartKeys(
      tracker,
      'a:1',
      k2,
      msg('a:1', 'assistant', [{ type: 'text', text: 'B' }])
    )
    expect(k3[0].key).toBe('a:1:text:1')
  })

  it('y17: multiplicity group count change (2 -> 3 identical text parts) allocates fresh keys for whole group while preserving other parts', () => {
    const tracker = new PartKeyTracker()
    const m1 = msg('a:1', 'assistant', [
      { type: 'text', text: 'dup' },
      { type: 'text', text: 'other' },
      { type: 'text', text: 'dup' }
    ])
    const k1 = carryPartKeys(tracker, 'a:1', undefined, m1)
    expect(k1.map((e) => e.key)).toEqual(['a:1:text:0', 'a:1:text:1', 'a:1:text:2'])

    const m2 = msg('a:1', 'assistant', [
      { type: 'text', text: 'dup' },
      { type: 'text', text: 'dup' },
      { type: 'text', text: 'other' },
      { type: 'text', text: 'dup' }
    ])
    const k2 = carryPartKeys(tracker, 'a:1', k1, m2)
    expect(k2[2].key).toBe('a:1:text:1') // 'other' preserved
    expect(k2[0].key).toBe('a:1:text:3') // whole dup group gets fresh keys
    expect(k2[1].key).toBe('a:1:text:4')
    expect(k2[3].key).toBe('a:1:text:5')
  })

  it('y18: multiplicity group with unchanged count (2 -> 2) preserves keys in document order even when another part is inserted between them', () => {
    const tracker = new PartKeyTracker()
    const m1 = msg('a:1', 'assistant', [
      { type: 'text', text: 'dup' },
      { type: 'text', text: 'dup' }
    ])
    const k1 = carryPartKeys(tracker, 'a:1', undefined, m1)
    expect(k1.map((e) => e.key)).toEqual(['a:1:text:0', 'a:1:text:1'])

    const m2 = msg('a:1', 'assistant', [
      { type: 'text', text: 'dup' },
      { type: 'text', text: 'middle' },
      { type: 'text', text: 'dup' }
    ])
    const k2 = carryPartKeys(tracker, 'a:1', k1, m2)
    expect(k2.map((e) => e.key)).toEqual(['a:1:text:0', 'a:1:text:2', 'a:1:text:1'])
  })

  it('y13·y16·y19: representativePart keeps front group on merge, preserves rep on front-prepend, and marks split inheritance', () => {
    // y16: front part prepended onto existing segment -> keeps existing repPartKey
    const prevSingle: MultiPartGroupRef[] = [
      { key: 'a:2:text:0', repPartKey: 'a:2:text:0', partKeys: new Set(['a:2:text:0']) }
    ]
    const mergedWithFront = representativePart(prevSingle, ['a:1:text:0', 'a:2:text:0'])
    expect(mergedWithFront.repPartKey).toBe('a:2:text:0')

    // y19: two groups merge -> front group's rep wins, back group key is dropped
    const prevTwo: MultiPartGroupRef[] = [
      { key: 'a:1:activity:t1', repPartKey: 'a:1:tool:t1', partKeys: new Set(['a:1:tool:t1']) },
      { key: 'a:2:activity:t2', repPartKey: 'a:2:tool:t2', partKeys: new Set(['a:2:tool:t2']) }
    ]
    const merged = representativePart(prevTwo, ['a:1:tool:t1', 'a:2:tool:t2'])
    expect(merged.repPartKey).toBe('a:1:tool:t1')
    expect(merged.droppedGroupKeys).toEqual(['a:2:activity:t2'])

    // y13: one group splits into two -> part with old rep keeps key, split-off inherits disclosure
    const prevOne: MultiPartGroupRef[] = [
      {
        key: 'a:1:activity:t1',
        repPartKey: 'a:1:tool:t1',
        partKeys: new Set(['a:1:tool:t1', 'a:1:tool:t2'])
      }
    ]
    const left = representativePart(prevOne, ['a:1:tool:t1'])
    const right = representativePart(prevOne, ['a:1:tool:t2'])
    expect(left.repPartKey).toBe('a:1:tool:t1')
    expect(left.inheritedFromKey).toBeUndefined()
    expect(right.repPartKey).toBe('a:1:tool:t2')
    expect(right.inheritedFromKey).toBe('a:1:activity:t1')
  })

  it('y10·y20: nextPartKey peeks without consuming so committed part gets identical key', () => {
    const tracker = new PartKeyTracker()
    const committed0 = tracker.allocate('a:M', 'text')
    expect(committed0).toBe('a:M:text:0')

    const livePeek1 = nextPartKey(tracker, 'a:M', 'text')
    const livePeek2 = nextPartKey(tracker, 'a:M', 'text')
    expect(livePeek1).toBe('a:M:text:1')
    expect(livePeek2).toBe('a:M:text:1') // peek did not consume

    const committed1 = tracker.allocate('a:M', 'text')
    expect(committed1).toBe(livePeek1)
  })

  it('y12: isTurnStart identifies assistant -> user boundary cleanly', () => {
    expect(isTurnStart(undefined, { role: 'user' })).toBe(true)
    expect(isTurnStart({ role: 'assistant' }, { role: 'user' })).toBe(true)
    expect(isTurnStart({ role: 'user' }, { role: 'user' })).toBe(false)
    expect(isTurnStart({ role: 'user' }, { role: 'assistant' })).toBe(false)
    expect(isTurnStart({ role: 'assistant' }, { role: 'assistant' })).toBe(false)
  })
})
