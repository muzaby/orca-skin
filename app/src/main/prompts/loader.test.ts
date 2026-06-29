import { describe, it, expect } from 'vitest'
import { assemblePolicies, loadPolicies } from './loader'

describe('loadPolicies — 실 번들', () => {
  it('정적 정책 0개이면 빈 Map 을 반환한다', () => {
    const loaded = loadPolicies()
    expect(loaded.size).toBe(0)
  })
})

describe('assemblePolicies — 정합 검증/트림', () => {
  const reg = [{ id: 'x', file: 'x.md' }]

  it('본문을 trim 해 적재한다', () => {
    const out = assemblePolicies(reg, { x: '\n  hello  \n' })
    expect(out.get('x')).toBe('hello')
  })

  it('registry 블록 본문이 sources 에 없으면 throw(누락)', () => {
    expect(() => assemblePolicies(reg, {})).toThrow(/정책 본문 누락/)
  })

  it('sources 에만 있고 registry 에 없으면 throw(잉여)', () => {
    expect(() => assemblePolicies(reg, { x: 'a', y: 'b' })).toThrow(/미등재 정책 본문/)
  })
})
