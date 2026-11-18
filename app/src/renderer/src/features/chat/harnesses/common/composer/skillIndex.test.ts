// 스킬 기저 색인의 구성 (0325 VP-23 d10·d11 · EP-6 ⑤).
import { describe, expect, it } from 'vitest'
import {
  SKILL_INDEX_MAX_NAME_CHARS,
  SKILL_TRAILING_PUNCTUATION,
  skillIndexFor,
  trailingPunctuationStart,
  type SkillTrieNode
} from './skillIndex'

const countNodes = (node: SkillTrieNode): number =>
  [...(node.children?.values() ?? [])].reduce((sum, child) => sum + 1 + countNodes(child), 0)

describe('skillIndexFor', () => {
  it('끝 구두점 집합은 지금 판정과 같다', () => {
    expect([...SKILL_TRAILING_PUNCTUATION].sort()).toEqual(
      [')', ',', '.', ':', ';', '?', ']', '}', '!'].sort()
    )
    expect(trailingPunctuationStart('build.)')).toBe(5)
    expect(trailingPunctuationStart('v1.2')).toBe(4)
    expect(trailingPunctuationStart('...')).toBe(0)
  })

  it('d10 끝 구두점 없는 이름 20,000개 × 24자 → 기저 20,000 · 끝 구두점 노드 0', () => {
    const names = new Set(
      Array.from({ length: 20_000 }, (_, index) => `skill-${String(index).padStart(18, '0')}`)
    )
    expect([...names].every((name) => name.length === 24)).toBe(true)
    const index = skillIndexFor(names)
    expect(index.size).toBe(20_000)
    expect([...index.values()].reduce((sum, node) => sum + countNodes(node), 0)).toBe(0)
    expect([...index.values()].every((node) => node.end)).toBe(true)
  })

  it('d11 19,999자 이름은 색인에 있고 20,000자 이름은 없다', () => {
    expect(SKILL_INDEX_MAX_NAME_CHARS).toBe(19_999)
    const index = skillIndexFor(new Set(['a'.repeat(19_999), 'b'.repeat(20_000)]))
    expect(index.has('a'.repeat(19_999))).toBe(true)
    expect(index.has('b'.repeat(20_000))).toBe(false)
  })

  it('기저 하나에 끝 구두점 이름 여럿이 트리로 묶인다', () => {
    const index = skillIndexFor(new Set(['deploy', 'deploy.', 'deploy..', 'deploy.)']))
    const node = index.get('deploy')!
    expect(index.size).toBe(1)
    expect(node.end).toBe(true)
    expect(countNodes(node)).toBe(3)
    expect(node.children!.get('.')!.end).toBe(true)
    expect(node.children!.get('.')!.children!.get('.')!.end).toBe(true)
  })
})
