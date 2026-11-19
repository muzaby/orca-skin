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
})
