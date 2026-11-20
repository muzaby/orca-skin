import { describe, expect, it, vi } from 'vitest'
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

  it('u5 preserves untouched chunk objects when a structural edit splits a middle chunk', () => {
    const source = Array.prototype.map
    const snapshots: object[][] = []
    Array.prototype.map = new Proxy(source, {
      apply(target, receiver, args) {
        if (receiver[0]?.location?.slots instanceof Map && Array.isArray(receiver[0].blocks)) {
          snapshots.push(receiver.slice())
        }
        return Reflect.apply(target, receiver, args)
      }
    })
    try {
      const list = createBlockList(blocks(192))
      list.splice(80, 1, [{ key: 'new', text: 'changed' }])
    } finally {
      Array.prototype.map = source
    }
    const [before, after] = snapshots
    expect(before).toHaveLength(3)
    expect(after).toHaveLength(3)
    expect(after[0]).toBe(before[0])
    expect(after[2]).toBe(before[2])
    expect(after[1]).not.toBe(before[1])
  })

  it('u6 performs cold historical lookups without allocating a chunk offset map', () => {
    const list = createBlockList(blocks(195))
    const old = list.snapshot()
    list.splice(60, 7, [{ key: 'replacement', text: 'middle' }])
    list.splice(0, 0, [{ key: '61', text: 'reinserted' }])
    const map = globalThis.Map
    let allocations = 0
    vi.stubGlobal(
      'Map',
      new Proxy(map, {
        construct(target, args, receiver) {
          allocations++
          return Reflect.construct(target, args, receiver)
        }
      })
    )
    let indices: number[]
    try {
      indices = ['0', '61', '194', 'missing'].map((key) => old.indexOf(key))
    } finally {
      vi.unstubAllGlobals()
    }
    expect(indices).toEqual([0, 61, 194, -1])
    expect(allocations).toBe(0)
  })

  it('u6 consults at most one slot table per historical chunk without unpacking blocks', () => {
    let blockKeyReads = 0
    const rows = blocks(195).map((row) => ({
      get key() {
        blockKeyReads++
        return row.key
      },
      text: row.text
    }))
    const list = createBlockList(rows)
    const old = list.snapshot()
    list.splice(192, 3, [])
    list.splice(0, 0, [{ key: '194', text: 'reinserted' }])
    blockKeyReads = 0
    let reads = 0
    const get = Map.prototype.get
    let position: number
    try {
      Map.prototype.get = function (key: unknown): unknown {
        if (key === '194') reads++
        return get.call(this, key)
      }
      position = old.indexOf('194')
    } finally {
      Map.prototype.get = get
    }
    expect(position).toBe(194)
    expect(reads).toBeGreaterThan(0)
    expect(reads).toBeLessThanOrEqual(1 + Math.ceil(rows.length / 64))
    expect(blockKeyReads).toBe(0)
  })

  it('u1–u7 keep all four historical locations after independent cross-chunk edits', () => {
    const initial = blocks(195)
    const list = createBlockList(initial)
    const s0 = list.snapshot()
    let expected = initial
    let revision = 0
    const changes = [
      {
        start: 62,
        remove: 6,
        insert: initial.slice(62, 68).map((b) => ({ ...b, text: 'updated' })),
        rekey: false
      },
      { start: 65, remove: 0, insert: [{ key: 'new', text: 'insert' }], rekey: true },
      { start: 63, remove: 69, insert: [], rekey: true },
      { start: 1, remove: 0, insert: [initial[64]], rekey: true },
      { start: 62, remove: 2, insert: [initial[62], initial[61]], rekey: true }
    ]
    const snapshots = [{ snap: s0, rows: initial, keyRevision: 0 }]
    for (const { start, remove, insert, rekey } of changes) {
      expected = expected.toSpliced(start, remove, ...insert)
      expect(new Set(expected.map((row) => row.key)).size).toBe(expected.length)
      if (rekey) revision++
      snapshots.push({
        snap: list.splice(start, remove, insert),
        rows: expected,
        keyRevision: revision
      })
    }
    for (const { snap, rows, keyRevision } of snapshots) {
      expect(snap.keyRevision).toBe(keyRevision)
      expect(snap.count).toBe(rows.length)
      for (const [i, row] of rows.entries()) {
        expect(snap.indexOf(row.key)).toBe(i)
        expect(snap.keyAt(i)).toBe(row.key)
        expect(snap.blockAt(i)).toBe(row)
      }
      expect(snap.indexOf('missing')).toBe(-1)
    }
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
    expect(s1.keyRevision).toBe(s0.keyRevision + 1)
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

it('u1/u3 bounds reject invalid ranges and no-op edits retain the snapshot', () => {
  const list = createBlockList(blocks(65)),
    old = list.snapshot()
  for (const i of [-1, 65]) {
    expect(() => old.blockAt(i)).toThrow(RangeError)
    expect(() => old.keyAt(i)).toThrow(RangeError)
  }
  for (const [start, count] of [
    [-1, 0],
    [1, -1],
    [64, 2],
    [66, 0]
  ]) {
    expect(() => list.splice(start, count, [])).toThrow(RangeError)
    expect(list.snapshot()).toBe(old)
  }
  expect(list.splice(65, 0, [])).toBe(old)
  const mid = list.splice(64, 0, [{ key: 'middle', text: 'new' }])
  expect([mid.keyAt(63), mid.keyAt(64), mid.keyAt(65)]).toEqual(['63', 'middle', '64'])
  expect(old.indexOf('64')).toBe(64)
})

it('u3/u6 warms a current lookup once and removes a deleted owner from the shared location index', () => {
  const source = blocks(513)
  const list = createBlockList(source)
  const snapshot = list.splice(512, 1, [{ key: 'current-probe', text: 'new' }])
  expect(snapshot.indexOf('current-probe')).toBe(512)
  const get = Map.prototype.get
  const originalMap = globalThis.Map
  let reads = 0,
    allocations = 0
  const shared: Map<unknown, unknown>[] = []
  let found = -1
  try {
    vi.stubGlobal(
      'Map',
      new Proxy(originalMap, {
        construct(target, args) {
          allocations++
          return Reflect.construct(target, args)
        }
      })
    )
    Map.prototype.get = function (key: unknown) {
      const value = get.call(this, key)
      if (key === 'current-probe' && value?.slots instanceof originalMap) shared.push(this)
      reads++
      return value
    }
    found = snapshot.indexOf('current-probe')
  } finally {
    originalMap.prototype.get = get
    vi.unstubAllGlobals()
  }
  expect(found).toBe(512)
  expect(reads).toBeLessThanOrEqual(3)
  expect(allocations).toBe(0)
  expect(shared[0]?.has('current-probe')).toBe(true)
  list.splice(512, 1, [])
  expect(shared[0]?.has('current-probe')).toBe(false)
  expect(snapshot.indexOf('current-probe')).toBe(512)
})
