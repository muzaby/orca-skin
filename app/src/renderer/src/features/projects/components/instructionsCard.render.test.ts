// 0208 — 첨부 파일 카드를 걷어낸 자리를 지침 카드가 가져갔다는 것을 렌더 출력으로 잠근다.
// min-h 만 주고 line-clamp 를 남기면 카드는 커지고 본문은 3줄이라 빈 공간만 생긴다 —
// 두 결정(D-010 고정 최소 높이 · D-011 말줄임 제거)이 함께 성립해야 한다(AT-12).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProjectInstructionsCard } from './ProjectInstructionsCard'

const LONG = Array.from({ length: 40 }, (_, i) => `지침 ${i + 1}번째 줄`).join('\n')

const render = (instructions: string): string =>
  renderToStaticMarkup(
    createElement(ProjectInstructionsCard, { instructions, onEdit: () => undefined })
  )

describe('지침 카드 — 확장 (AT-12)', () => {
  it('본문이 말줄임되지 않고 전문이 그려진다', () => {
    const html = render(LONG)
    expect(html).not.toContain('line-clamp')
    // 양성 짝 — 음성 술어만으로는 본문이 사라진 회귀도 통과한다.
    expect(html).toContain('지침 1번째 줄')
    expect(html).toContain('지침 40번째 줄')
  })

  it('본문이 되찾은 세로 공간만큼 최소 높이를 갖고 넘치면 스크롤한다', () => {
    expect(render(LONG)).toMatch(/min-h-\[280px\][^"]*overflow-y-auto/)
  })

  it('지침이 없으면 최소 높이를 유지한 채 안내 카피를 낸다', () => {
    const html = render('   ')
    expect(html).toContain('min-h-[280px]')
    expect(html).toMatch(/지침|instructions/i)
  })
})

describe('지침 카드 — 첨부 입력란 부재 (AT-10)', () => {
  it('드롭존 흔적이 남지 않는다', () => {
    const html = render(LONG)
    expect(html).not.toContain('border-dashed')
    expect(html).not.toContain('repeating-linear-gradient')
  })
})
