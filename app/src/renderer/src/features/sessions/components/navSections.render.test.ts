import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Project, SessionListItem } from '../../../../../shared/ipc'
import { PinnedSectionView } from './PinnedSection'
import { PinnedProjectsSectionView } from './PinnedProjectsSection'
import { SessionListView } from './SessionList'

// 0203 ΔV1 EP-9 / AT-13 — 구획 컴포넌트는 **받은 목록만** 그린다.
// JSX 를 쓰지 않는 이유: vitest include 가 `src/**/*.test.ts` 라 `.tsx` 를 잡지 않는다.
// jsdom·testing-library 없이 react-dom/server 로 돈다(신규 의존성 0, D-013).

function session(id: string, title: string, over: Partial<SessionListItem> = {}): SessionListItem {
  return {
    id,
    backend: 'claude',
    title,
    updatedAt: 1,
    preview: null,
    projectId: null,
    cwd: null,
    pinnedAt: null,
    ...over
  }
}

const noop = (): void => {}
const handlers = {
  currentSessionId: null,
  onSelectSession: noop,
  onTogglePinSession: noop,
  onDeleteSession: noop,
  onRenameSession: noop
}

// 세 구획에 "준 것"과 "주지 않은 것"을 각각 하나씩 둔다. 재파생하는 구현은 주지 않은 쪽을
// 어디선가 끌어와 출력에 넣게 되므로 음성 단언이 그것을 본다.
const GIVEN = session('given', '준-대화')
const WITHHELD = session('withheld', '안준-대화', { pinnedAt: 55 })

function renderPinned(sessions: SessionListItem[]): string {
  return renderToStaticMarkup(createElement(PinnedSectionView, { sessions, ...handlers }))
}

function renderRecent(sessions: SessionListItem[]): string {
  return renderToStaticMarkup(
    createElement(SessionListView, {
      sessions,
      currentSessionId: null,
      projectNameById: new Map<string, string>(),
      onSelect: noop,
      onDelete: noop,
      onRename: noop,
      onTogglePin: noop
    })
  )
}

const PROJECT: Project = {
  id: 'p1',
  name: '프로젝트하나',
  instructions: '',
  createdAt: 0,
  updatedAt: 0,
  pinnedAt: 1
}

function renderProjects(
  projectChildren: Record<string, SessionListItem[]>,
  pinnedProjects: Project[] = [PROJECT]
): string {
  return renderToStaticMarkup(
    createElement(PinnedProjectsSectionView, {
      pinnedProjects,
      projectChildren,
      onExpandProject: noop,
      onOpenProject: noop,
      onTogglePinProject: noop,
      ...handlers
    })
  )
}

describe('구획 컴포넌트는 props 목록만 렌더한다 (EP-9 · AT-13)', () => {
  it('"고정됨"은 준 목록만 그린다', () => {
    const html = renderPinned([GIVEN])
    expect(html).toContain('준-대화')
    expect(html).not.toContain('안준-대화')
  })

  it('"최근 대화"는 준 목록만 그린다', () => {
    const html = renderRecent([GIVEN])
    expect(html).toContain('준-대화')
    expect(html).not.toContain('안준-대화')
  })

  it('"프로젝트" 구획은 준 하위 목록만 그린다', () => {
    const html = renderProjects({ p1: [GIVEN] })
    expect(html).toContain('프로젝트하나')
    expect(html).not.toContain('안준-대화')
  })

  // AT-05a 의 렌더 절반 — 같은 대화를 한 구획에만 주면 다른 구획 출력에는 없다.
  it('고정된 대화는 고정됨 출력에만 나타나고 최근 출력에는 없다', () => {
    const pinnedHtml = renderPinned([WITHHELD])
    const recentHtml = renderRecent([GIVEN])
    expect(pinnedHtml).toContain('안준-대화')
    expect(recentHtml).not.toContain('안준-대화')
  })

  it('빈 목록이면 각 구획이 비어 있고 다른 대화를 끌어오지 않는다', () => {
    expect(renderPinned([])).not.toContain('준-대화')
    expect(renderRecent([])).not.toContain('준-대화')
  })
})

describe('구획 헤더와 로딩 상태 (D-003 · D-008)', () => {
  it('고정 항목이 0개여도 두 구획 헤더가 남는다', () => {
    expect(renderPinned([])).toContain('aria-expanded')
    expect(renderProjects({})).toContain('aria-expanded')
  })

  // 헤더만 남기려고 고정 프로젝트를 비운다 — 프로젝트 **행**의 chevron·kebab 까지 세면
  // 이 단언은 헤더가 아니라 본문을 재게 된다(초안이 그래서 3을 돌려줬다).
  it('구획 헤더의 컨트롤은 접기 토글 하나다 — 추가(+) 액션이 없다', () => {
    const html = renderProjects({}, [])
    expect(html.match(/<button/g) ?? []).toHaveLength(1)
    expect(html).toContain('aria-expanded')
    expect(html).not.toMatch(/aria-label="[^"]*(추가|add)/i)
  })
})
