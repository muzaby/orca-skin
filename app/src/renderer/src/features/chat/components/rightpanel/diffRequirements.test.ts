import { describe, expect, it } from 'vitest'
import type { DiffRequirementItem } from '../../../../../../shared/ipc'
import type { DiffLine } from '../../lib/diffLines'
import { createDiffRequirementItem, reanchorDiffRequirementItem } from './diffRequirements'

const EXACT_ANCHOR_KEYS = [
  'sessionId',
  'baselineCommit',
  'filePath',
  'oldLine',
  'newLine',
  'hunkHeader',
  'contextBefore',
  'contextAfter',
  'comment',
  'createdAt'
]

function line(
  type: DiffLine['type'],
  oldLine: number | null,
  newLine: number | null,
  text: string
): DiffLine {
  return {
    type,
    oldLine,
    newLine,
    lineNo: type === 'removed' ? (oldLine ?? 0) : (newLine ?? 0),
    text
  }
}

describe('diff requirement anchors', () => {
  it('creates exactly the ten wire keys and caps context/comment without adding located', () => {
    const long = 'x'.repeat(240)
    const item = createDiffRequirementItem({
      id: 'req-1',
      sessionId: 'session-1',
      base: { kind: 'none' },
      filePath: 'src/a.ts',
      lines: [
        line('unchanged', 1, 1, 'before-1'),
        line('unchanged', 2, 2, long),
        line('unchanged', 3, 3, 'before-3'),
        line('unchanged', 4, 4, 'before-4'),
        line('added', null, 5, 'target added line'),
        line('unchanged', 5, 6, 'after-1'),
        line('unchanged', 6, 7, 'after-2'),
        line('unchanged', 7, 8, long),
        line('unchanged', 8, 9, 'after-4')
      ],
      lineIndex: 4,
      comment: 'c'.repeat(2100),
      createdAt: 123456789
    })

    expect(Object.keys(item)).toEqual(['id', 'anchor', 'located'])
    expect(Object.keys(item.anchor)).toEqual(EXACT_ANCHOR_KEYS)
    expect('located' in item.anchor).toBe(false)
    expect(item).toMatchObject({
      id: 'req-1',
      located: true,
      anchor: {
        sessionId: 'session-1',
        baselineCommit: 'HEAD',
        filePath: 'src/a.ts',
        oldLine: null,
        newLine: 5,
        hunkHeader: '@@ -2,6 +2,7 @@',
        contextBefore: [long.slice(0, 200), 'before-3', 'before-4'],
        contextAfter: ['after-1', 'after-2', long.slice(0, 200)],
        comment: 'c'.repeat(2000),
        createdAt: 123456789
      }
    })
  })

  it('records deletion anchors with a null new-line axis', () => {
    const item = createDiffRequirementItem({
      id: 'req-2',
      sessionId: 'session-1',
      base: { kind: 'head', oid: 'head-oid' },
      filePath: 'src/remove.ts',
      lines: [
        line('unchanged', 1, 1, 'before'),
        line('removed', 2, null, 'deleted line'),
        line('unchanged', 3, 2, 'after')
      ],
      lineIndex: 1,
      comment: 'remove this branch',
      createdAt: 456
    })

    expect(item.anchor.oldLine).toBe(2)
    expect(item.anchor.newLine).toBeNull()
    expect(item.anchor.baselineCommit).toBe('head-oid')
  })
})

describe('diff requirement reanchor', () => {
  const original: DiffRequirementItem = {
    id: 'req-3',
    located: true,
    anchor: {
      sessionId: 'session-1',
      baselineCommit: 'base-oid',
      filePath: 'src/a.ts',
      oldLine: null,
      newLine: 10,
      hunkHeader: '@@ -8,3 +8,4 @@',
      contextBefore: ['before'],
      contextAfter: ['after'],
      comment: 'keep near the same logical line',
      createdAt: 999
    }
  }

  it('chooses the matching context nearest the saved line instead of the first duplicate', () => {
    const next = reanchorDiffRequirementItem(original, [
      line('unchanged', 1, 1, 'before'),
      line('added', null, 2, 'duplicate target'),
      line('unchanged', 2, 3, 'after'),
      line('unchanged', 3, 4, 'filler'),
      line('unchanged', 4, 5, 'filler'),
      line('unchanged', 5, 6, 'filler'),
      line('unchanged', 6, 7, 'filler'),
      line('unchanged', 7, 8, 'filler'),
      line('unchanged', 8, 9, 'before'),
      line('added', null, 10, 'nearest target'),
      line('unchanged', 9, 11, 'after')
    ])

    expect(next.id).toBe(original.id)
    expect(next.located).toBe(true)
    expect(next.anchor.newLine).toBe(10)
    expect(next.anchor.oldLine).toBeNull()
    expect(next.anchor.comment).toBe(original.anchor.comment)
  })

  it('keeps the first candidate when duplicate matches are equally distant', () => {
    const next = reanchorDiffRequirementItem(original, [
      line('unchanged', 1, 7, 'before'),
      line('added', null, 8, 'first tied target'),
      line('unchanged', 2, 9, 'after'),
      line('unchanged', 3, 10, 'filler'),
      line('unchanged', 4, 11, 'before'),
      line('added', null, 12, 'second tied target'),
      line('unchanged', 5, 13, 'after')
    ])

    expect(next.located).toBe(true)
    expect(next.anchor.newLine).toBe(8)
  })

  it('marks a missing match unlocated while retaining the item and comment', () => {
    const next = reanchorDiffRequirementItem(original, [
      line('unchanged', 1, 1, 'other before'),
      line('added', null, 2, 'target'),
      line('unchanged', 2, 3, 'other after')
    ])

    expect(next).toEqual({
      ...original,
      located: false
    })
  })
})
