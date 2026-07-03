import { describe, expect, it } from 'vitest'
import { LruEvictionPolicy, type IdleRuntimeEntry } from './eviction-policy'

describe('LruEvictionPolicy (0055)', () => {
  it('snapshot 앞쪽(가장 오래된 idle)부터 capacity 밖 victim 을 고른다', () => {
    const policy = new LruEvictionPolicy<unknown>()
    const entries: IdleRuntimeEntry<unknown>[] = [
      { sessionId: 'a', runtime: {} },
      { sessionId: 'b', runtime: {} },
      { sessionId: 'c', runtime: {} }
    ]

    expect(policy.selectVictims(entries, 1)).toEqual(['a', 'b'])
  })

  it('capacity 가 idle size 이상이면 victim 이 없다', () => {
    const policy = new LruEvictionPolicy<unknown>()
    expect(policy.selectVictims([{ sessionId: 'a', runtime: {} }], 2)).toEqual([])
  })

  it('음수 capacity 는 0으로 취급해 전부 victim 으로 고른다', () => {
    const policy = new LruEvictionPolicy<unknown>()
    expect(
      policy.selectVictims(
        [
          { sessionId: 'a', runtime: {} },
          { sessionId: 'b', runtime: {} }
        ],
        -1
      )
    ).toEqual(['a', 'b'])
  })
})
