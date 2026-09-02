import { describe, expect, it } from 'vitest'
import type { GitDiffFileContent } from '../../../../../../shared/ipc'
import {
  DIFF_BODY_CACHE_LIMIT,
  EMPTY_DIFF_BODY_CACHE,
  getDiffBody,
  putDiffBody,
  touchDiffBody,
  type DiffBodyCache
} from './diffBodyCache'
import { diffPeekBodyKey } from './diffFileCache'
import type { GitPeekTarget } from '../../reducer/chatReducer'

const text = (value: string): GitDiffFileContent => ({
  kind: 'text',
  oldValue: '',
  newValue: value,
  truncated: false
})

const fill = (count: number): DiffBodyCache => {
  let cache = EMPTY_DIFF_BODY_CACHE
  for (let i = 0; i < count; i += 1) cache = putDiffBody(cache, `k${i}`, text(`v${i}`))
  return cache
}

describe('diff 본문 캐시 (AT-38 · EP-24)', () => {
  it('상한을 넘기면 가장 오래 안 쓴 것만 빠진다', () => {
    const cache = fill(DIFF_BODY_CACHE_LIMIT + 1)

    expect(cache).toHaveLength(DIFF_BODY_CACHE_LIMIT)
    // 첫 항목만 miss, 나머지는 전부 hit — 차집합으로 센다.
    expect(getDiffBody(cache, 'k0')).toBeNull()
    const missing = Array.from({ length: DIFF_BODY_CACHE_LIMIT }, (_, i) => `k${i + 1}`).filter(
      (key) => getDiffBody(cache, key) === null
    )
    expect(missing).toEqual([])
  })

  it('LRU 는 삽입순이 아니라 **사용순**이다 — 다시 읽은 항목이 살아남는다', () => {
    let cache = fill(DIFF_BODY_CACHE_LIMIT)
    // 가장 오래된 것을 다시 쓴다.
    cache = touchDiffBody(cache, 'k0')
    cache = putDiffBody(cache, 'new', text('new'))

    expect(getDiffBody(cache, 'k0')).not.toBeNull()
    // 대신 두 번째로 오래된 것이 빠진다.
    expect(getDiffBody(cache, 'k1')).toBeNull()
  })

  it('실패 응답은 담지 않는다 — 일시적 실패가 고착되지 않는다', () => {
    const cache = putDiffBody(EMPTY_DIFF_BODY_CACHE, 'k', {
      kind: 'unavailable',
      reason: 'error'
    })
    const binary = putDiffBody(EMPTY_DIFF_BODY_CACHE, 'k', { kind: 'binary' })

    expect(cache).toEqual([])
    expect(binary).toEqual([])
  })

  it('없는 키를 touch 해도 캐시가 자라지 않는다', () => {
    const cache = putDiffBody(EMPTY_DIFF_BODY_CACHE, 'k', text('v'))
    expect(touchDiffBody(cache, 'missing')).toBe(cache)
  })
})

describe('캐시 키의 다섯 축 (AT-42 · EP-24 ①)', () => {
  interface KeyAxes {
    cwd: string
    sessionId: string
    generation: number
    target: GitPeekTarget
  }
  const base: KeyAxes = {
    cwd: '/repo',
    sessionId: 's1',
    generation: 3,
    target: { group: { kind: 'commit', sha: 'c1' }, path: 'a.ts' }
  }
  const key = (o: Partial<KeyAxes>): string => {
    const v = { ...base, ...o }
    return diffPeekBodyKey(v.cwd, v.sessionId, v.target, v.generation)
  }

  // 축을 하나씩만 바꾼다 — 하나라도 키에서 빠지면 그 줄이 hit 이 되어 red 다.
  const axes: Array<[string, Partial<KeyAxes>]> = [
    ['cwd', { cwd: '/other' }],
    ['sessionId', { sessionId: 's2' }],
    ['요약 세대', { generation: 4 }],
    ['group', { target: { group: { kind: 'uncommitted' }, path: 'a.ts' } }],
    ['path', { target: { group: { kind: 'commit', sha: 'c1' }, path: 'b.ts' } }]
  ]
  it.each(axes)('%s 하나만 달라도 캐시가 비껴간다', (_axis, override) => {
    const cache = putDiffBody(EMPTY_DIFF_BODY_CACHE, key({}), text('base'))

    expect(getDiffBody(cache, key({}))).not.toBeNull()
    expect(getDiffBody(cache, key(override))).toBeNull()
  })
})
