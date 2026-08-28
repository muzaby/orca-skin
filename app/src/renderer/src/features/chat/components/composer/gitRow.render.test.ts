// 0206 — 컴포저 git 행의 **버튼 구성**을 렌더 출력으로 잠근다.
//
// 조사(`docs/etc/study/epitaxy/01`)가 정한 두 규칙이 계약이다: 좌는 식별 · 우는 조작이고,
// 배선할 수 없는 자리는 그리지 않는다(D-005). 존재만 단언하면 형제 자리를 맞바꾼 회귀가
// 통과하므로 **출현 인덱스**로 순서까지 본다.
//
// JSX 를 쓰지 않는 이유: vitest include 가 `src/**/*.test.ts` 라 `.tsx` 를 잡지 않는다
// (0204 선례). props-only View 만 직접 렌더한다.

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GitRowView } from './GitRow'
import type { GitRowView as View } from './gitRowState'

const VISIBLE: View = {
  visible: true,
  repo: 'orca-skin',
  branch: 'claude/0206-composer-git-row',
  detached: false,
  added: 1097,
  removed: 24
}

const render = (view: View, diffOpen = false): string =>
  renderToStaticMarkup(createElement(GitRowView, { view, diffOpen, onToggleDiff: () => undefined }))

describe('git 행 — 자리와 순서 (AT-01)', () => {
  it('저장소 → 브랜치 → 변경량 순서로 선다', () => {
    const html = render(VISIBLE)
    const repo = html.indexOf('orca-skin')
    const branch = html.indexOf('claude/0206-composer-git-row')
    const changes = html.indexOf('1097')
    expect(repo).toBeGreaterThan(-1)
    expect(repo).toBeLessThan(branch)
    expect(branch).toBeLessThan(changes)
  })

  it('저장소·브랜치는 버튼이 아니다 — 표시 전용이다 (D-006)', () => {
    const html = render(VISIBLE)
    // 버튼은 정확히 하나(변경량)이고, 그 하나가 두 이름보다 뒤에 있다.
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html.indexOf('<button')).toBeGreaterThan(html.indexOf('claude/0206-composer-git-row'))
  })

  it('행이 보이지 않으면 아무것도 그리지 않는다 — 양성 짝과 함께', () => {
    expect(render({ visible: false })).toBe('')
    expect(render(VISIBLE)).not.toBe('')
  })
})

describe('git 행 — 그리지 않는 자리 (AT-07)', () => {
  it('PR 링크·CI 팝오버·닫기 버튼이 없다', () => {
    const html = render(VISIBLE)
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('haspopup="dialog"')
    expect(html).not.toContain('닫기')
  })

  it('양성 짝 — 같은 출력에 변경량 버튼과 두 수치가 있다', () => {
    const html = render(VISIBLE)
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('+1097')
    expect(html).toContain('−24')
  })

  it('색으로만 구분되는 수치를 스크린리더에는 문장으로 준다', () => {
    expect(render(VISIBLE)).toContain('aria-label="1097줄 추가 24줄 삭제"')
  })
})

describe('git 행 — 변경량 버튼 상태 (AT-05 의 렌더 절)', () => {
  it('diff 타일이 열려 있으면 눌린 상태로 그린다', () => {
    expect(render(VISIBLE, true)).toContain('aria-pressed="true"')
    expect(render(VISIBLE, false)).toContain('aria-pressed="false"')
  })
})

describe('git 행 — detached HEAD (AT-08)', () => {
  it('브랜치 자리가 분리 상태를 말한다 — 빈 칸으로 두지 않는다', () => {
    const html = render({ ...VISIBLE, branch: null, detached: true })
    expect(html).toContain('분리 헤드')
  })
})
