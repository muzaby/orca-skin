// 0211 ΔV4 r2 — 컨텍스트 바를 **실제로 그려서** 본다 (VP-51 · VP-60 / AT-43 · AT-52).
//
// r1 검증에서 이 컴포넌트를 렌더하는 테스트가 **0건**이었다(D1). 그래서 라벨 옆에
// `→ feature-x` 를 되살려도 924케이스가 전건 green 이었다 — 순수 `summaryBaseText` 만 잠겨
// 있었고, AC 가 지정한 관측 지점(렌더)에는 눈이 없었다.
//
// **부재를 세려면 있을 수 있었던 값을 줘야 한다.** 그래서 현재 브랜치를 기준선(`main`)과
// **다른 값**(`feature-x`)으로 store 에 넣는다 — 화살표를 되살린 구현이라면 그 문자열이
// 출력에 나타난다. 아무 값도 주지 않고 부재를 세면 그 단언은 언제나 참이다.
//
// vitest 는 `environment: 'node'` 지만 SSR 렌더는 설정 없이 그대로 돈다 — effect 가 없는
// 마크업 계약은 여기서 전부 관측된다(§8 사람 실기로 넘기지 않는다).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { GitDiffPatch, GitDiffSummary, GitStatus } from '../../../../../../shared/ipc'
import {
  DEFAULT_DIFF_VIEW,
  PANEL_DEFAULT_WIDTH,
  PANEL_MAX_WIDTH,
  type DiffViewOptions
} from '../../reducer/chatReducer'
import { ALL_CHANGES, type DiffComparison } from './diffComparison'

/** 세션 시작 브랜치는 `main`, 지금 체크아웃된 브랜치는 `feature-x` — 두 값이 달라야 부재가 뜻을 갖는다. */
const CURRENT_BRANCH = 'feature-x'

const summary: GitDiffSummary = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'a'.repeat(40), ref: 'main' },
  files: [],
  totals: { added: 0, removed: 0 },
  filesTruncated: false,
  commits: [],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: { files: [], totals: { added: 0, removed: 0 }, filesTruncated: false }
}

const patch: GitDiffPatch = {
  isRepo: true,
  base: summary.base,
  files: [],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}

const gitStatus: GitStatus = {
  isRepo: true,
  root: '/repo',
  branch: CURRENT_BRANCH,
  detached: false
}

interface Fixture {
  summary: GitDiffSummary | null
  comparison: DiffComparison
  sidebarVisible: boolean
  view: DiffViewOptions
  colWidth: number
}

let fixture: Fixture = {
  summary,
  comparison: ALL_CHANGES,
  sidebarVisible: false,
  view: DEFAULT_DIFF_VIEW,
  colWidth: PANEL_DEFAULT_WIDTH
}

vi.mock('../../store/chatStore', () => ({
  chatActions: {
    toggleDiffSidebar: vi.fn(),
    setDiffComparison: vi.fn(),
    setDiffViewOption: vi.fn(),
    setAllDiffFilesCollapsed: vi.fn(),
    setRightPanelColWidth: vi.fn(),
    refreshGitSnapshot: vi.fn()
  },
  useChatSession: (select: (state: unknown) => unknown) =>
    select({
      gitSnapshot: {
        summary: fixture.summary,
        patch,
        comparison: fixture.comparison,
        collapsedFiles: [],
        sidebarVisible: fixture.sidebarVisible,
        view: fixture.view,
        refreshGeneration: 0
      },
      gitStatus,
      rightPanelTiles: [
        { id: 'col-a', tiles: ['task'] },
        { id: 'col-b', tiles: ['diff'] }
      ],
      rightPanelColWidths: [PANEL_DEFAULT_WIDTH, fixture.colWidth]
    })
}))

const { GitContextBar } = await import('./GitContextBar')

function render(patchFixture: Partial<Fixture> = {}): string {
  fixture = {
    summary,
    comparison: ALL_CHANGES,
    sidebarVisible: false,
    view: DEFAULT_DIFF_VIEW,
    colWidth: PANEL_DEFAULT_WIDTH,
    ...patchFixture
  }
  return renderToStaticMarkup(createElement(GitContextBar))
}

describe('비교 기준 라벨 — 이름 하나뿐이다 (AT-43 · D-069)', () => {
  it('세션 시작 브랜치 이름을 그린다', () => {
    const html = render()

    expect(html).toContain('data-diff-context-bar')
    expect(html).toContain('main')
  })

  it('현재 브랜치와 화살표가 출력에 없다 — 둘 다 store 에서 읽을 수 있는데도 없다', () => {
    const html = render()

    expect(html).not.toContain(CURRENT_BRANCH)
    expect(html).not.toContain('→')
    expect(html).not.toContain('&#x2192;')
  })

  it('이름을 모르면 sha 7자로 접힌다 — 라벨 자리를 비우지 않는다 (D-071)', () => {
    const html = render({
      summary: { ...summary, base: { kind: 'worktree-base', oid: 'abcdef1234567890', ref: null } }
    })

    expect(html).toContain('abcdef1')
    expect(html).not.toContain(CURRENT_BRANCH)
  })
})

describe('컨텍스트 바의 네 컨트롤 — `×` 는 타일이 그린다 (제안서 §4)', () => {
  it('폴더 토글 · 비교 기준 · `⋮` · `↗` 가 함께 선다', () => {
    const html = render()

    for (const marker of [
      'data-diff-sidebar-toggle',
      'data-diff-comparison-trigger',
      'data-diff-view-trigger',
      'data-diff-expand-panel'
    ])
      expect(html).toContain(marker)
  })

  it('폴더 버튼의 aria-expanded 가 사이드바 상태를 읽는다 (EP-36 ①)', () => {
    expect(render({ sidebarVisible: false })).toContain('aria-expanded="false"')
    expect(render({ sidebarVisible: true })).toContain('aria-expanded="true"')
  })

  it('기본 화면에서는 두 메뉴가 닫혀 있다 — 사이드바도 메뉴도 펼쳐 있지 않다 (D-083)', () => {
    const html = render()

    expect(html).not.toContain('data-diff-view-menu')
    expect(html).not.toContain('data-diff-comparison="all"')
  })
})

describe('`↗` 라벨은 카탈로그로 해석된다 (AT-52)', () => {
  // **속성을 지목해 센다**(r2 검증 D17). 같은 문자열이 `title` 에도 실려 있어 문구만 찾으면
  // `aria-label` 을 통째로 지운 변이가 green 이다 — AT-52 가 이름 붙인 것은 접근성 이름이다.
  it('기본 폭이면 넓히는 라벨, 최대 폭이면 되돌리는 라벨이다', () => {
    const wide = render({ colWidth: PANEL_DEFAULT_WIDTH })
    const narrow = render({ colWidth: PANEL_MAX_WIDTH })

    // 키가 그대로 새어 나오면 카탈로그를 지나지 않은 것이다.
    expect(wide).not.toContain('chat.rightpanel.diff')
    expect(narrow).not.toContain('chat.rightpanel.diff')
    expect(wide).toContain('aria-label="패널 확대"')
    expect(narrow).toContain('aria-label="패널 폭 되돌리기"')
    // 호버로 읽는 자리도 같은 문구다 — 둘 중 하나만 있으면 두 독자 중 하나가 잃는다.
    expect(wide).toContain('title="패널 확대"')
    expect(narrow).toContain('title="패널 폭 되돌리기"')
  })

  it('컨텍스트 바의 아이콘 버튼 셋이 각자 접근성 이름을 갖는다 — 글리프만 남지 않는다', () => {
    const html = render()

    for (const name of ['파일 표시', 'diff 표시 설정', '패널 확대'])
      expect(html).toContain(`aria-label="${name}"`)
  })
})
