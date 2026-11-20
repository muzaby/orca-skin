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
  textPartGroups,
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

  it('keeps Markdown source offsets across non-rendered parts and restarts them at visual breaks', () => {
    const entries = [
      ['text', 'text:ab'],
      ['boundary', 'boundary:b:begin'],
      ['text', 'text:c'],
      ['reasoning', 'reasoning:  '],
      ['text', 'text:'],
      ['artifact', 'artifact:p'],
      ['text', 'text:de'],
      ['attachment', 'attachment:f'],
      ['text', 'text:f'],
      ['reasoning', 'reasoning:visible'],
      ['text', 'text:next'],
      ['tool', null],
      ['text', 'text:last']
    ] as const
    const groups = textPartGroups(
      entries.map(([kind, signature], partIndex) => ({
        key: String(partIndex),
        partIndex,
        kind,
        signature
      }))
    )
    expect(groups).toEqual([
      [
        { key: '0', start: 0 },
        { key: '2', start: 2 },
        { key: '6', start: 3 },
        { key: '8', start: 5 }
      ],
      [{ key: '10', start: 0 }],
      [{ key: '12', start: 0 }]
    ])
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

  it('y7 keeps a fork boundary key when the same row reopens', () => {
    const tracker = new PartKeyTracker()
    const row = msg('m:7', 'assistant', [{ type: 'fork_boundary' }])
    const previous = carryPartKeys(tracker, row.id, undefined, row)
    expect(carryPartKeys(tracker, row.id, previous, structuredClone(row))).toEqual(previous)
  })

  it('y14 keeps each attachment group key when IDs contain the separator and the groups move', () => {
    const tracker = new PartKeyTracker()
    const attachments = (...ids: string[]): Message['parts'][number] => ({
      type: 'attachment',
      attachments: ids.map((id) => ({ id, name: id, kind: 'file', mimeType: 'text/plain' }))
    })
    const first = attachments('a,b')
    const second = attachments('a', 'b')
    const row = msg('m:7', 'assistant', [first, second])
    const previous = carryPartKeys(tracker, row.id, undefined, row)
    expect(
      carryPartKeys(tracker, row.id, previous, { ...row, parts: [second, first] }).map((e) => e.key)
    ).toEqual([previous[1].key, previous[0].key])
  })

  it('y3 carries text and reasoning keys independently when their bodies match', () => {
    const tracker = new PartKeyTracker()
    const row = msg('m:8', 'assistant', [
      { type: 'text', text: 'same' },
      { type: 'reasoning', text: 'same' }
    ])
    const prev = carryPartKeys(tracker, row.id, undefined, row)
    const next = carryPartKeys(tracker, row.id, prev, { ...row, parts: [...row.parts].reverse() })
    expect(next.map((p) => p.key)).toEqual(['m:8:reasoning:0', 'm:8:text:0'])
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

  it('v2 advances key revision across same-size resets on all three models', async () => {
    const { createClaudeBlockModel } =
      await import('../../harnesses/claude/transcript/claudeBlocks')
    const { createOpenCodeBlockModel } =
      await import('../../harnesses/opencode/transcript/openCodeBlocks')
    const { newTranscriptChanges, recordChange } = await import('./changeLog')
    const before = [
      msg('u:a', 'user', []),
      msg('a:a', 'assistant', [{ type: 'text', text: 'alpha' }]),
      msg('u:b', 'user', []),
      msg('a:b', 'assistant', [{ type: 'text', text: 'beta' }])
    ]
    const reordered = [...before.slice(2), ...before.slice(0, 2)]
    for (const model of [
      createClaudeBlockModel({ mode: 'code', sessionKey: 's' }),
      createClaudeBlockModel({ mode: 'work', sessionKey: 's' }),
      createOpenCodeBlockModel()
    ]) {
      const changes = newTranscriptChanges()
      const first = model.advance({ messages: before, transcriptChanges: changes })
      const reset = recordChange(changes, { kind: 'reset', complete: true })
      const swapped = model.advance({ messages: reordered, transcriptChanges: reset })
      expect(swapped.count).toBe(first.count)
      expect(swapped.keyAt(0)).not.toBe(first.keyAt(0))
      expect(swapped.keyRevision).toBe(first.keyRevision + 1)
      const again = model.advance({
        messages: structuredClone(reordered),
        transcriptChanges: recordChange(reset, { kind: 'reset', complete: true })
      })
      expect(again.keyRevision).toBe(swapped.keyRevision)
    }
  })

  it('y1, y2, y4, y5, y6, y7, y9, y11 keep keys invariant under append, group context, T-violating prepends, reopen, duplicate tool_call, and cross-message OpenCode segments', async () => {
    const { createClaudeBlockModel } =
      await import('../../harnesses/claude/transcript/claudeBlocks')
    const { createOpenCodeBlockModel } =
      await import('../../harnesses/opencode/transcript/openCodeBlocks')
    const { newTranscriptChanges, recordChange } = await import('./changeLog')

    const u1 = msg('u:1', 'user', [{ type: 'text', text: 'q1' }])
    const a1 = msg('a:1', 'assistant', [
      { type: 'text', text: 'ans1' },
      { type: 'tool_call', toolRunId: 'dup-t', toolName: 'Read', args: { v: 1 } },
      { type: 'tool_call', toolRunId: 'dup-t', toolName: 'Read', args: { v: 2 } },
      { type: 'tool_result', toolRunId: 'dup-t', result: 'ok', isError: false }
    ])
    const a2 = msg('a:2', 'assistant', [{ type: 'text', text: 'ans2' }])

    // y1, y6, y9: Claude Code model — append keeps existing keys, turn meta stays anchored to first assistant a:1, duplicate tool_call produces 1 tool block
    const codeModel = createClaudeBlockModel({ mode: 'code', sessionKey: 's1' })
    const ch0 = newTranscriptChanges()
    const snap1 = codeModel.advance({ messages: [u1, a1], transcriptChanges: ch0 })
    const keys1 = Array.from({ length: snap1.count }, (_, i) => snap1.keyAt(i))
    expect(keys1.filter((k) => k.includes('dup-t'))).toHaveLength(1)
    expect(keys1).toContain(turnMetaKey('a:1'))

    const ch1 = recordChange(ch0, { kind: 'append', ids: ['a:2'] })
    const snap2 = codeModel.advance({ messages: [u1, a1, a2], transcriptChanges: ch1 })
    const keys2 = Array.from({ length: snap2.count }, (_, i) => snap2.keyAt(i))
    // y1 & y6: previous keys preserved and meta key stays a:1:meta
    for (const k of keys1) expect(keys2).toContain(k)
    expect(keys2).toContain(turnMetaKey('a:1'))

    // y7: reopening with cloned message objects produces identical key set
    const freshModel = createClaudeBlockModel({ mode: 'code', sessionKey: 's1' })
    const reopenSnap = freshModel.advance({
      messages: structuredClone([u1, a1, a2]),
      transcriptChanges: newTranscriptChanges()
    })
    expect(Array.from({ length: reopenSnap.count }, (_, i) => reopenSnap.keyAt(i))).toEqual(keys2)

    // y2, y4, y5: T-violating prepends (user before user, user before leading assistant) keep existing message keys unchanged
    const ch4 = recordChange(ch1, { kind: 'reset', complete: false })
    const u0 = msg('u:0', 'user', [{ type: 'text', text: 'prev user' }])
    const snap4 = codeModel.advance({ messages: [u0, u1, a1, a2], transcriptChanges: ch4 })
    const keys4 = Array.from({ length: snap4.count }, (_, i) => snap4.keyAt(i))
    for (const k of keys2) expect(keys4).toContain(k)

    const leadingModel = createClaudeBlockModel({ mode: 'code', sessionKey: 's2' })
    const leadCh0 = newTranscriptChanges()
    const leadSnap1 = leadingModel.advance({ messages: [a1], transcriptChanges: leadCh0 })
    const leadKeys1 = Array.from({ length: leadSnap1.count }, (_, i) => leadSnap1.keyAt(i))
    const leadSnap2 = leadingModel.advance({
      messages: [u1, a1],
      transcriptChanges: recordChange(leadCh0, { kind: 'reset', complete: false })
    })
    const leadKeys2 = Array.from({ length: leadSnap2.count }, (_, i) => leadSnap2.keyAt(i))
    for (const k of leadKeys1) expect(leadKeys2).toContain(k)

    // y11: OpenCode cross-message text segment keeps representative <A>:text:0 when C appends
    const ocModel = createOpenCodeBlockModel()
    const ocCh0 = newTranscriptChanges()
    const ocA = msg('a:A', 'assistant', [{ type: 'text', text: 'part A' }])
    const ocB = msg('a:B', 'assistant', [{ type: 'text', text: 'part B' }])
    const ocC = msg('a:C', 'assistant', [{ type: 'text', text: 'part C' }])
    const ocSnap1 = ocModel.advance(
      { messages: [u1, ocA, ocB], transcriptChanges: ocCh0 },
      { liveText: false, liveReasoning: false }
    )
    const ocKeys1 = Array.from({ length: ocSnap1.count }, (_, i) => ocSnap1.keyAt(i))
    expect(ocKeys1).toContain('a:A:text:0')
    const ocSnap2 = ocModel.advance(
      {
        messages: [u1, ocA, ocB, ocC],
        transcriptChanges: recordChange(ocCh0, { kind: 'append', ids: ['a:C'] })
      },
      { liveText: false, liveReasoning: false }
    )
    const ocKeys2 = Array.from({ length: ocSnap2.count }, (_, i) => ocSnap2.keyAt(i))
    expect(ocKeys2).toContain('a:A:text:0')
  })
})
