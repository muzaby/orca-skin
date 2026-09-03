// 0211 ΔV4 r2 — 컨텍스트 바의 **배선**을 본다 (VP-58 · VP-60 / AT-52 · §10 EP-36 ①).
//
// r1 검증에서 두 자리가 green 이었다(D1·D4): `↗` 의 클릭 인자를 세는 단언이 없었고,
// `⋮ › 파일 표시` 를 no-op 으로 바꿔도 아무도 red 가 되지 않았다. 구현 보고는 그 자리를
// `rg 'toggleDiffSidebar' GitContextBar.tsx` = 2 라는 **개수**로 닫았는데, 개수는 두 호출이
// 같은 상태를 만지는지 말하지 않는다.
//
// SSR 은 핸들러를 마크업에 남기지 않으므로 house primitive 를 **props 기록기**로 세워
// 프로덕션이 실제로 붙이는 `onClick` 을 잡는다(`BranchSwitchActions.test.ts` 와 같은 축 —
// 거기서는 훅이 없어 컴포넌트를 직접 부를 수 있었고, 여기서는 훅이 있어 렌더를 지난다).
// `Popover` 는 열림 상태에서만 children 을 그리므로 항상 그리는 double 로 바꿔 메뉴를 연다.

import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitDiffPatch, GitDiffSummary } from '../../../../../../shared/ipc'
import { DEFAULT_DIFF_VIEW, PANEL_DEFAULT_WIDTH, PANEL_MAX_WIDTH } from '../../reducer/chatReducer'
import { ALL_CHANGES } from './diffComparison'

type Props = Record<string, unknown>

const buttons: Props[] = []
const menuItems: Props[] = []

vi.mock('../../../../shared/ui/Button', () => ({
  Button: (props: Props) => {
    buttons.push(props)
    return null
  }
}))

vi.mock('../../../../shared/ui/MenuItem', () => ({
  MenuItem: (props: Props) => {
    menuItems.push(props)
    return null
  },
  MenuTitle: ({ children }: { children: ReactNode }) => children
}))

vi.mock('../../../../shared/ui/Popover', () => ({
  // 열림 여부와 무관하게 children 을 그린다 — 이 파일이 재는 것은 배치가 아니라 배선이다.
  Popover: ({ children }: { children: ReactNode }) => children
}))

const actions = {
  setDiffSidebarVisible: vi.fn(),
  setDiffComparison: vi.fn(),
  setDiffViewOption: vi.fn(),
  setAllDiffFilesExpanded: vi.fn(),
  setRightPanelColWidth: vi.fn()
}

const summary: GitDiffSummary = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'a'.repeat(40), ref: 'main' },
  files: [],
  totals: { added: 0, removed: 0 },
  filesTruncated: false,
  // **커밋이 있어야 서브메뉴 단언이 뜻을 갖는다** — 빈 목록이면 "첫 화면에 커밋이 없다" 가
  // 어떤 구현에서도 참이라 평면으로 되돌린 변이를 잡지 못한다(자기검증 M9 에서 실측).
  commits: [
    {
      sha: 'commit-a',
      subject: '첫 커밋',
      author: 'codex',
      committedAt: 0,
      files: [],
      filesTruncated: false,
      fileCount: 0,
      totals: { added: 1, removed: 0 }
    }
  ],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: { files: [], totals: { added: 0, removed: 0 }, filesTruncated: false }
}

const patch: GitDiffPatch = {
  isRepo: true,
  base: summary.base,
  files: [
    { path: 'docs/a.md', status: 'modified', added: 1, removed: 0, kind: 'text', lines: [] },
    { path: 'src/b.ts', status: 'modified', added: 2, removed: 1, kind: 'text', lines: [] }
  ],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}

let colWidth = PANEL_DEFAULT_WIDTH

vi.mock('../../store/chatStore', () => ({
  chatActions: new Proxy(
    {},
    { get: (_target, key: string) => (actions as Record<string, unknown>)[key] }
  ),
  useChatSession: (select: (state: unknown) => unknown) =>
    select({
      gitSnapshot: {
        summary,
        patch,
        comparison: ALL_CHANGES,
        expandedFiles: [],
        sidebarVisible: false,
        view: DEFAULT_DIFF_VIEW
      },
      cwd: '/repo',
      gitStatus: {
        cwd: '/repo',
        status: { isRepo: true, root: '/repo', branch: 'feature-x', detached: false }
      },
      rightPanelTiles: [
        { id: 'col-a', tiles: ['task'] },
        { id: 'col-b', tiles: ['plan'] },
        { id: 'col-c', tiles: ['diff'] }
      ],
      rightPanelColWidths: [PANEL_DEFAULT_WIDTH, PANEL_DEFAULT_WIDTH, colWidth]
    })
}))

const { GitContextBar } = await import('./GitContextBar')

/** diff 타일이 세 번째 열에 있다 — 인덱스를 고정값으로 쓰면 열이 옮겨간 회귀가 보이지 않는다. */
const DIFF_COL = 2

function render(width = PANEL_DEFAULT_WIDTH): void {
  buttons.length = 0
  menuItems.length = 0
  colWidth = width
  renderToStaticMarkup(createElement(GitContextBar))
}

const byMarker = (list: Props[], marker: string): Props =>
  list.filter((props) => props[marker] !== undefined)[0]

const click = (props: Props): void => (props.onClick as () => void)()

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockClear()
})

describe('`↗` 는 이 타일이 있는 열의 폭을 토글한다 (AT-52 · D-091)', () => {
  it('기본 폭에서 누르면 그 열을 최대로 넓힌다', () => {
    render(PANEL_DEFAULT_WIDTH)

    click(byMarker(buttons, 'data-diff-expand-panel'))

    expect(actions.setRightPanelColWidth).toHaveBeenCalledTimes(1)
    // 열 인덱스가 계약의 절반이다 — 폭만 맞고 열이 틀리면 남의 패널이 넓어진다.
    expect(actions.setRightPanelColWidth).toHaveBeenCalledWith(DIFF_COL, PANEL_MAX_WIDTH)
  })

  it('최대 폭에서 누르면 같은 열을 기본으로 되돌린다 — 새 모드를 만들지 않는다', () => {
    render(PANEL_MAX_WIDTH)

    click(byMarker(buttons, 'data-diff-expand-panel'))

    expect(actions.setRightPanelColWidth).toHaveBeenCalledWith(DIFF_COL, PANEL_DEFAULT_WIDTH)
  })
})

// 0211 ΔV6 D-117 · AT-75 — 진입점이 셋이다(세그먼트 둘 + `⋮ › 파일 목록 표시`). 셋 다 같은
// 상태를 쓰되 세그먼트는 **값**을 싣는다: `toggle` 이면 이미 선택된 쪽을 눌렀을 때 반대로
// 넘어가 세그먼트의 멱등이 깨진다.
describe('사이드바 진입점 셋이 같은 상태를 쓴다 (§10 EP-36 ① · EP-51)', () => {
  it('세그먼트 둘이 서로 반대 값을 싣고 메뉴는 현재 값을 뒤집는다', () => {
    render()

    click(byMarker(buttons, 'data-diff-sidebar-toggle'))
    // 첫 세그먼트(`off`)는 언제나 false 다 — 이미 꺼져 있어도 켜지지 않는다(멱등).
    expect(actions.setDiffSidebarVisible).toHaveBeenCalledWith(false)

    click(menuItems.filter((props) => props['data-diff-view-item'] === 'files')[0])
    // 메뉴는 켬/끔 체크 항목이라 현재 값을 뒤집는다 — 초기 상태가 숨김이므로 true 다.
    expect(actions.setDiffSidebarVisible).toHaveBeenCalledWith(true)
    expect(actions.setDiffSidebarVisible).toHaveBeenCalledTimes(2)
  })

  it('사이드바를 켜는 자리 말고 다른 상태를 건드리지 않는다', () => {
    render()

    click(byMarker(buttons, 'data-diff-sidebar-toggle'))

    expect(actions.setDiffViewOption).not.toHaveBeenCalled()
    expect(actions.setRightPanelColWidth).not.toHaveBeenCalled()
  })
})

describe('`⋮` 일곱 항목이 각자의 액션을 부른다 (AT-67 · §10 EP-33)', () => {
  it('메뉴가 일곱 항목을 그 순서로 그린다 — `새로고침` 이 빠졌다 (0211 ΔV5 D-106)', () => {
    render()

    const ids = menuItems
      .map((props) => props['data-diff-view-item'])
      .filter((id) => id !== undefined)

    expect(ids).toEqual([
      'files',
      'collapse-all',
      'expand-all',
      'side-by-side',
      'wrap',
      'highlight',
      'whitespace'
    ])
  })

  // 0211 ΔV5 D-105 — 방향이 반대다. **펼치기가 채우고 접기가 비운다.**
  it('모든 파일 펼치기는 지금 패치의 파일 전부를 담고, 접기는 집합을 비운다', () => {
    render()
    const item = (id: string): Props =>
      menuItems.filter((props) => props['data-diff-view-item'] === id)[0]

    click(item('expand-all'))
    expect(actions.setAllDiffFilesExpanded).toHaveBeenCalledWith(true, ['docs/a.md', 'src/b.ts'])

    click(item('collapse-all'))
    expect(actions.setAllDiffFilesExpanded).toHaveBeenCalledWith(false, [])
  })

  it('표시 옵션 넷은 각자의 축만 바꾸고 재조회를 부르지 않는다 (D-088)', () => {
    render()
    const item = (id: string): Props =>
      menuItems.filter((props) => props['data-diff-view-item'] === id)[0]

    click(item('side-by-side'))
    click(item('wrap'))
    click(item('highlight'))
    click(item('whitespace'))

    expect(actions.setDiffViewOption.mock.calls.map((call) => call[0])).toEqual([
      { layout: 'side-by-side' },
      { wrapLines: false },
      { highlightWords: false },
      { ignoreWhitespace: true }
    ])
    expect(actions.setAllDiffFilesExpanded).not.toHaveBeenCalled()
  })
})

describe('비교 기준 메뉴가 범위를 고른다 (AT-49)', () => {
  it('첫 화면은 `모든 변경사항` 하나이고 `미커밋 변경` 진입점이 없다 (D-107)', () => {
    render()
    const scope = (value: string): Props =>
      menuItems.filter((props) => props['data-diff-comparison'] === value)[0]

    click(scope('all'))

    expect(actions.setDiffComparison.mock.calls.map((call) => call[0])).toEqual([{ kind: 'all' }])
    expect(scope('uncommitted')).toBeUndefined()
  })

  it('커밋은 서브메뉴 뒤에 있다 — 첫 화면에 커밋 항목이 없다 (D-106)', () => {
    render()

    expect(menuItems.some((props) => props['data-diff-comparison-commits'] !== undefined)).toBe(
      true
    )
    expect(
      menuItems.some((props) => String(props['data-diff-comparison'] ?? '').startsWith('commit:'))
    ).toBe(false)
  })
})
