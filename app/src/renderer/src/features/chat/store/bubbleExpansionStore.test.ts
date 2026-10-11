// 0257 AC11 — 펼침 상태는 키별로 보존되고 다른 키로 새지 않는다.
import { describe, expect, it } from 'vitest'
import { isBubbleExpanded, toggleBubbleExpanded } from './bubbleExpansionStore'

describe('bubbleExpansionStore', () => {
  it('키별 토글 · 재조회(재마운트) 유지 · 다른 키 불변', () => {
    expect(isBubbleExpanded('user:1')).toBe(false)
    toggleBubbleExpanded('user:1')
    expect(isBubbleExpanded('user:1')).toBe(true)
    expect(isBubbleExpanded('user:2')).toBe(false)
    toggleBubbleExpanded('user:1')
    expect(isBubbleExpanded('user:1')).toBe(false)
  })
})
