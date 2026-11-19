import { describe, expect, it } from 'vitest'
import { createBlockList } from './blockList'

const blocks = (count: number): Array<{ key: string; text: string }> =>
  Array.from({ length: count }, (_, index) => ({ key: String(index), text: String(index) }))

describe('transcript block snapshots', () => {
  it('keeps old locations when the first lookup happens after a split, removal and reinsertion', () => {
    const list = createBlockList(blocks(130))
    const before = list.snapshot()
    const withHead = list.splice(0, 0, [{ key: 'head', text: 'head' }])
    const removed = list.splice(65, 1, [])
    const readded = list.splice(130, 0, [{ key: '64', text: 'replacement' }])
    expect(before.count).toBe(130)
    expect(before.indexOf('64')).toBe(64)
    expect(before.blockAt(64).text).toBe('64')
    expect(withHead.indexOf('64')).toBe(65)
    expect(removed.indexOf('64')).toBe(-1)
    expect(readded.indexOf('64')).toBe(130)
    expect(readded.keyAt(0)).toBe('head')
  })

  it('changes key revision only for edits to the key sequence', () => {
    const list = createBlockList(blocks(140))
    const before = list.snapshot()
    const inserted = blocks(6).map(({ text }, slot) => ({ key: String(61 + slot), text }))
    const edited = list.splice(61, 6, inserted)
    expect(edited.keyRevision).toBe(before.keyRevision)
    expect(edited.blockAt(60)).toBe(before.blockAt(60))
    expect(edited.blockAt(128)).toBe(before.blockAt(128))
    expect(edited.blockAt(64).text).toBe('3')
    expect(before.blockAt(64).text).toBe('64')
    const swapped = list.splice(61, 6, inserted.toReversed())
    expect(swapped.keyRevision).toBe(before.keyRevision + 1)
    expect(edited.keyAt(61)).toBe('61')
    expect(swapped.keyAt(61)).toBe('66')
  })

  it('u1, u2, u3, u4, u5, u6, u7 verify snapshot immutability, chunk sharing, cross-chunk replace, fallback indexOf, and keyRevision', () => {
    const list = createBlockList(blocks(200))
    const s0 = list.snapshot()
    const origBlock10 = s0.blockAt(10)
    const origBlock150 = s0.blockAt(150)

    // u1 & u3: prepend shifts new snapshot indices while s0 stays immutable
    const s1 = list.splice(0, 0, [
      { key: 'pre-0', text: 'p0' },
      { key: 'pre-1', text: 'p1' }
    ])
    expect(s0.count).toBe(200)
    expect(s0.keyAt(0)).toBe('0')
    expect(s0.indexOf('10')).toBe(10)
    expect(s1.indexOf('10')).toBe(12)

    // u2, u4, u5, u7: cross-chunk content replace keeps s1 block refs, shares untouched chunks, keeps keyRevision unchanged
    const crossChunk = Array.from({ length: 10 }, (_, i) => ({
      key: s1.keyAt(60 + i),
      text: `updated-${i}`
    }))
    const s2 = list.splice(60, 10, crossChunk)
    expect(s1.blockAt(64).text).toBe('62')
    expect(s2.blockAt(64).text).toBe('updated-4')
    expect(s2.blockAt(12)).toBe(origBlock10)
    expect(s2.blockAt(152)).toBe(origBlock150)
    expect(s2.keyRevision).toBe(s1.keyRevision)
    expect(s0.keyRevision).toBe(0)

    // u6: fresh s0 snapshot looked up AFTER replace, split, delete, reinsert still resolves original position
    const list2 = createBlockList(blocks(130))
    const snap0 = list2.snapshot()
    list2.splice(
      60,
      5,
      blocks(5).map((_, i) => ({ key: String(60 + i), text: `r${i}` }))
    )
    list2.splice(0, 0, [{ key: 'new-head', text: 'h' }])
    list2.splice(65, 1, [])
    list2.splice(129, 0, [{ key: '64', text: 'reinserted' }])
    expect(snap0.indexOf('64')).toBe(64)
    expect(snap0.indexOf('0')).toBe(0)
    expect(snap0.indexOf('129')).toBe(129)
  })
})
