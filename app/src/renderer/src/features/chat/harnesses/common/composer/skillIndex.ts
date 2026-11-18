// 등록 스킬 이름의 기저 색인 (0325 D-039 · EP-6 ⑤). 이름을 끝 구두점을 뗀 기저로 묶고, 기저마다 끝 구두점
// 문자열을 트리로 둔다 — 토큰 판정은 기저 조회 1회와 끝 구두점 걸음(≤ 토큰의 끝 구두점 길이)이고 등록 이름의
// 길이와 무관하다. 구성은 등록 집합이 바뀔 때 한 번이고 기저 해시 + 끝 구두점 노드에 비례한다(B23).
// 키는 UTF-16 코드 단위(`String.prototype.slice` 와 같은 단위)다.

import { COMPOSER_DECORATION_MAX_CHARS } from '../../../../../shared/compute/limits'

// 스킬 토큰 끝에서 떼어 볼 수 있는 구두점 — 지금 판정과 같은 집합이다.
export const SKILL_TRAILING_PUNCTUATION: ReadonlySet<string> = new Set([
  '.',
  ',',
  '!',
  '?',
  ';',
  ':',
  ')',
  ']',
  '}'
])

// 장식 상한 안의 토큰(`/` + 이름)과 같을 수 없는 이름은 색인에 넣지 않는다.
export const SKILL_INDEX_MAX_NAME_CHARS = COMPOSER_DECORATION_MAX_CHARS - 1

export interface SkillTrieNode {
  end: boolean
  children: Map<string, SkillTrieNode> | null
}
export type SkillIndex = ReadonlyMap<string, SkillTrieNode>

// 끝 구두점 구간의 시작 — `text.slice(0, p)` 가 기저, `text.slice(p)` 는 전부 끝 구두점이다.
export function trailingPunctuationStart(text: string): number {
  let index = text.length
  while (index > 0 && SKILL_TRAILING_PUNCTUATION.has(text[index - 1])) index--
  return index
}

// 자식 하나 — 판정이 걷는 단위라 테스트가 걸음 수를 센다.
export function trieChild(node: SkillTrieNode, ch: string): SkillTrieNode | undefined {
  return node.children?.get(ch)
}

const indexes = new WeakMap<ReadonlySet<string>, SkillIndex>()

export function skillIndexFor(names: ReadonlySet<string>): SkillIndex {
  const cached = indexes.get(names)
  if (cached) return cached
  const index = new Map<string, SkillTrieNode>()
  for (const name of names) {
    if (name.length > SKILL_INDEX_MAX_NAME_CHARS) continue
    const start = trailingPunctuationStart(name)
    const base = name.slice(0, start)
    let node = index.get(base)
    if (!node) index.set(base, (node = { end: false, children: null }))
    for (let i = start; i < name.length; i++) {
      node.children ??= new Map()
      let child = node.children.get(name[i])
      if (!child) node.children.set(name[i], (child = { end: false, children: null }))
      node = child
    }
    node.end = true
  }
  indexes.set(names, index)
  return index
}
