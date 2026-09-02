// 0211 ΔV4 r3 — 이동의 **아래쪽 절반** (VP-58 / AT-50 · §10 EP-36 ②).
//
// r2 검증(D16)에서 `scrollIntoView` 를 지워도 3,071 케이스가 전건 green 이었다: SSR 은 ref 를
// 채우지 않아 그 줄이 아예 실행되지 않았다. 소유자를 인자로 받는 지금은 DOM 없이도 잰다.
//
// 위쪽 절반("고른 경로로 부른다")은 `diffReviewNavigation.test.ts` 가 잠근다.

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { revealFileSection, type FileSectionOwner } from './fileSectionScroll'

type ScrollSpy = Mock<(options?: ScrollIntoViewOptions) => void>
const scrollSpy = (): ScrollSpy => vi.fn<(options?: ScrollIntoViewOptions) => void>()

// node 환경에는 `CSS` 가 없다. 스텁을 세워 **선택자가 이스케이프를 지나는지**까지 관측한다.
const escape = vi.fn((value: string) => `esc(${value})`)
vi.stubGlobal('CSS', { escape })

function owner(sections: Record<string, { scrollIntoView: ScrollSpy }>): {
  owner: FileSectionOwner
  selectors: string[]
} {
  const selectors: string[] = []
  return {
    selectors,
    owner: {
      querySelector: (selector) => {
        selectors.push(selector)
        return sections[selector] ?? null
      }
    }
  }
}

beforeEach(() => escape.mockClear())

describe('revealFileSection', () => {
  it('찾은 섹션을 위쪽에 맞춰 이동한다 — block:start 가 아니면 헤더가 화면 밖에 선다', () => {
    const scrollIntoView = scrollSpy()
    const { owner: target } = owner({ '[data-diff-file="esc(docs/a.md)"]': { scrollIntoView } })

    expect(revealFileSection(target, 'docs/a.md')).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
  })

  it('경로가 CSS.escape 를 지난다 — `/`·`.` 를 날것으로 넣으면 자손·클래스 선택자가 된다', () => {
    const { owner: target, selectors } = owner({})

    revealFileSection(target, 'docs/a.md')

    expect(escape).toHaveBeenCalledWith('docs/a.md')
    expect(selectors).toEqual(['[data-diff-file="esc(docs/a.md)"]'])
  })

  it('그 파일 섹션이 없으면 false 이고 아무것도 부르지 않는다', () => {
    const other = scrollSpy()
    const { owner: target } = owner({
      '[data-diff-file="esc(src/b.ts)"]': { scrollIntoView: other }
    })

    expect(revealFileSection(target, 'docs/a.md')).toBe(false)
    expect(other).not.toHaveBeenCalled()
  })

  it('소유자가 아직 없으면 false 다 — 마운트 전 클릭이 예외로 터지지 않는다', () => {
    expect(revealFileSection(null, 'docs/a.md')).toBe(false)
  })
})
