import { describe, it, expect } from 'vitest'
import { buildAppend } from './buildAppend'
import { loadPolicies } from './loader'
import type { BuildContext, PolicyBlock } from './registry'

const ctx: BuildContext = { platform: 'linux' }

describe('buildAppend — 실 레지스트리', () => {
  it('python-runtime stable 블록을 단일 문자열로 반환한다', () => {
    const loaded = loadPolicies()
    const out = buildAppend(ctx, loaded)
    expect(typeof out).toBe('string')
    expect(out).toBe(loaded.get('python-runtime'))
  })
})

describe('buildAppend — 조건부 필터 메커니즘(합성 레지스트리)', () => {
  const loaded = new Map<string, string>([
    ['a', 'AAA'],
    ['b', 'BBB'],
    ['c', 'CCC']
  ])

  it('stable 은 항상, conditional 은 when 충족 시에만, 배열 순서대로 합친다', () => {
    const registry: PolicyBlock[] = [
      { id: 'a', file: 'a.md', tier: 'stable' },
      { id: 'b', file: 'b.md', tier: 'conditional', when: (c) => c.platform === 'win32' },
      { id: 'c', file: 'c.md', tier: 'stable' }
    ]
    expect(buildAppend({ platform: 'linux' }, loaded, registry)).toBe('AAA\n\nCCC')
    expect(buildAppend({ platform: 'win32' }, loaded, registry)).toBe('AAA\n\nBBB\n\nCCC')
  })

  it('when 없는 conditional 은 주입하지 않는다(false 취급)', () => {
    const registry: PolicyBlock[] = [
      { id: 'a', file: 'a.md', tier: 'stable' },
      { id: 'b', file: 'b.md', tier: 'conditional' }
    ]
    expect(buildAppend(ctx, loaded, registry)).toBe('AAA')
  })

  it('블록당 \\n\\n 로만 구분한다(단일 문자열, 4블록 버그 회피)', () => {
    const registry: PolicyBlock[] = [
      { id: 'a', file: 'a.md', tier: 'stable' },
      { id: 'b', file: 'b.md', tier: 'stable' },
      { id: 'c', file: 'c.md', tier: 'stable' }
    ]
    expect(buildAppend(ctx, loaded, registry)).toBe('AAA\n\nBBB\n\nCCC')
  })

  it('주입 대상 본문이 loaded 에 없으면 throw 한다', () => {
    const registry: PolicyBlock[] = [{ id: 'missing', file: 'missing.md', tier: 'stable' }]
    expect(() => buildAppend(ctx, loaded, registry)).toThrow(/로드되지 않은 정책/)
  })
})
