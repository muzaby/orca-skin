import { afterEach, describe, expect, it, vi } from 'vitest'
import { revealDiffRequirement } from './diffRequirementScroll'

afterEach(() => vi.unstubAllGlobals())

describe('선택 코멘트 스크롤', () => {
  it('diff 소유자 안의 정확한 카드로 이동하며 포커스를 바꾸지 않는다', () => {
    const escape = vi.fn(() => 'escaped-id')
    vi.stubGlobal('CSS', { escape })
    const card = { scrollIntoView: vi.fn(), focus: vi.fn() }
    const owner = { querySelector: vi.fn(() => card) }
    expect(revealDiffRequirement(owner, 'quoted"id')).toBe(true)
    expect(escape).toHaveBeenCalledWith('quoted"id')
    expect(owner.querySelector).toHaveBeenCalledWith('[data-diff-requirement-marker="escaped-id"]')
    expect(card.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    expect(card.focus).not.toHaveBeenCalled()
  })

  it('소유자나 카드가 없으면 다른 대상으로 이동하지 않는다', () => {
    vi.stubGlobal('CSS', { escape: (value: string) => value })
    expect(revealDiffRequirement(null, 'gone')).toBe(false)
    expect(revealDiffRequirement({ querySelector: () => null }, 'gone')).toBe(false)
  })
})
