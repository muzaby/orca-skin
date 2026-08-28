// 0206 AT-21 — 컴포저 패널 스택의 패널들이 **같은 크롬 모듈**에서 온다는 것을 렌더 출력으로
// 잠근다(D-021 · §10 EP-09).
//
// 왜 import 개수(`rg`)가 아니라 렌더 출력인가: import 만 세면 `composerPanel` 을 가져다
// 쓰지 않고 옆에 자기 배경을 덧칠한 패널이 통과한다. 실제로 DOM 에 실린 클래스를 봐야
// "두 패널이 같은 표면을 쓴다" 가 관측된다.
//
// JSX 를 쓰지 않는 이유: vitest include 가 `src/**/*.test.ts` 라 `.tsx` 를 잡지 않는다
// (0204 선례). props-only View 만 직접 렌더한다.

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GitRowView } from './GitRow'
import { Notice } from '../Notice'
import { composerPanelSurface } from './composerPanel'
import type { GitRowView as View } from './gitRowState'

const CHROME = composerPanelSurface.split(' ').filter((c) => c.length > 0)

const VISIBLE: View = {
  visible: true,
  repo: 'orca-skin',
  branch: 'claude/0206-composer-git-row',
  detached: false,
  added: 1097,
  removed: 24
}

// 루트 엘리먼트의 클래스 토큰. 문자열 `includes` 로 보면 `bg-bg2` 가 `bg-bg22` 에도
// 걸리므로 토큰 단위로 가른다.
function rootClasses(html: string): string[] {
  const m = html.match(/class="([^"]*)"/)
  return m ? m[1].split(' ').filter((c) => c.length > 0) : []
}

const gitRow = (): string =>
  renderToStaticMarkup(
    createElement(GitRowView, { view: VISIBLE, diffOpen: false, onToggleDiff: () => undefined })
  )

const notice = (): string =>
  renderToStaticMarkup(createElement(Notice, { title: '동시 턴' }, '진행 중입니다'))

describe('컴포저 패널 스택 — 크롬 SSOT (AT-21)', () => {
  it.each([
    ['git 행', gitRow],
    ['안내 패널', notice]
  ])('%s 이 크롬 클래스를 전부 갖는다', (_label, render) => {
    const classes = rootClasses(render())
    // 차집합으로 본다 — "몇 개 있다" 가 아니라 "빠진 것이 없다" 가 계약이다.
    expect(CHROME.filter((c) => !classes.includes(c))).toEqual([])
  })

  it('두 패널이 같은 표면을 쓴다 — 크롬 부분집합이 서로 같다', () => {
    const a = rootClasses(gitRow()).filter((c) => CHROME.includes(c))
    const b = rootClasses(notice()).filter((c) => CHROME.includes(c))
    expect([...a].sort()).toEqual([...b].sort())
    expect(a.length).toBe(CHROME.length)
  })

  it('음성 짝 — 어느 패널도 독자 배경·반경을 덧칠하지 않는다', () => {
    for (const render of [gitRow, notice]) {
      const classes = rootClasses(render())
      for (const stray of [
        'bg-sidebar',
        'bg-transparent',
        'bg-panel',
        'rounded-r6',
        'rounded-r7'
      ]) {
        expect(classes).not.toContain(stray)
      }
    }
  })

  it('크롬이 실제 값을 갖는다 — 빈 문자열이면 위 단언이 전부 공허하다', () => {
    expect(CHROME.length).toBeGreaterThanOrEqual(4)
    expect(CHROME).toContain('bg-bg2')
  })
})
