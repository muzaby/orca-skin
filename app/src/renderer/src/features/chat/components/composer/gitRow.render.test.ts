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
import { load } from 'cheerio'
import { GitRowView } from './GitRow'
import type { GitRowView as View } from './gitRowState'

const VISIBLE: View = {
  visible: true,
  repo: 'orca-skin',
  branch: 'claude/0206-composer-git-row',
  detached: false,
  totals: { added: 1097, removed: 24 }
}

const render = (view: View, diffOpen = false): string =>
  renderToStaticMarkup(
    createElement(GitRowView, {
      view,
      diffOpen,
      onToggleDiff: () => undefined,
      onClose: () => undefined
    })
  )

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

  it('저장소·브랜치는 각각 이름 그대로 메뉴를 여는 버튼이다 (D-139)', () => {
    const $ = load(render(VISIBLE))
    const triggers = $('button[aria-haspopup="menu"]')
    expect(triggers).toHaveLength(2)
    expect(triggers.map((_, el) => $(el).text()).get()).toEqual([
      'orca-skin',
      'claude/0206-composer-git-row'
    ])
    expect(triggers.map((_, el) => $(el).attr('aria-expanded')).get()).toEqual(['false', 'false'])
    expect($('[data-git-row-diff]')).toHaveLength(1)
  })

  // 0211 ΔV6 AT-70 / VP-71 — 닫기는 **변경량 버튼 뒤**다(D-114). 존재만 세면 형제와 자리를
  // 맞바꾼 회귀가 통과한다 — 앞에 두면 누르려던 변경량 대신 닫기가 눌린다.
  it('닫기는 우측 끝이고 변경량 버튼 뒤에 선다 (D-114)', () => {
    const html = render(VISIBLE)

    expect(html).toContain('data-git-row-close')
    expect(html.indexOf('data-git-row-close')).toBeGreaterThan(html.indexOf('1097'))
    // **CSS 순서 축도 닫는다.** 위 단언은 DOM 순서만 본다 — `order-*` 유틸로 시각 순서를
    // 뒤집으면 DOM 은 그대로라 통과한다(실측: `order-first` 변이가 green 이었다).
    expect(html).not.toMatch(/class="[^"]*(?:^| )order-[a-z0-9]+/)
  })

  it('행이 보이지 않으면 아무것도 그리지 않는다 — 양성 짝과 함께', () => {
    expect(render({ visible: false })).toBe('')
    expect(render(VISIBLE)).not.toBe('')
  })
})

describe('git 행 — 그리지 않는 자리 (AT-07)', () => {
  // 0211 ΔV6 D-114 — 닫기는 금지 목록에서 빠졌다(사용자 요청). PR·CI 는 그대로 금지다.
  it('PR 링크·CI 팝오버가 없다', () => {
    const html = render(VISIBLE)
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('haspopup="dialog"')
  })

  it('양성 짝 — 같은 출력에 변경량 버튼·두 수치·닫기가 있다', () => {
    const html = render(VISIBLE)
    expect(load(html)('[data-git-row-diff]')).toHaveLength(1)
    expect(html).toContain('+1097')
    expect(html).toContain('−24')
    expect(html).toContain('data-git-row-close')
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
