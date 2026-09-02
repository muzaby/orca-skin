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
  toggleDiffSidebar: vi.fn(),
  setDiffComparison: vi.fn(),
  setDiffViewOption: vi.fn(),
  setAllDiffFilesCollapsed: vi.fn(),
  setRightPanelColWidth: vi.fn(),
  refreshGitSnapshot: vi.fn()
}

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
        collapsedFiles: [],
        sidebarVisible: false,
        view: DEFAULT_DIFF_VIEW,
        refreshGeneration: 0
      },
      gitStatus: { isRepo: true, root: '/repo', branch: 'feature-x', detached: false },
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

describe('사이드바 진입점 둘이 같은 상태를 토글한다 (§10 EP-36 ①)', () => {
  it('폴더 버튼과 `⋮ › 파일 표시` 가 각각 같은 액션을 부른다', () => {
    render()

    click(byMarker(buttons, 'data-diff-sidebar-toggle'))
    expect(actions.toggleDiffSidebar).toHaveBeenCalledTimes(1)

    click(menuItems.filter((props) => props['data-diff-view-item'] === 'files')[0])
    // 두 번째 진입점도 **같은 액션**이다 — 서로 다른 상태를 켜면 메뉴로 켠 것을 버튼으로 못 끈다.
    expect(actions.toggleDiffSidebar).toHaveBeenCalledTimes(2)
  })

  it('사이드바를 켜는 두 자리 말고 다른 상태를 건드리지 않는다', () => {
    render()

    click(byMarker(buttons, 'data-diff-sidebar-toggle'))

    expect(actions.setDiffViewOption).not.toHaveBeenCalled()
    expect(actions.setRightPanelColWidth).not.toHaveBeenCalled()
  })
})

describe('`⋮` 여덟 항목이 각자의 액션을 부른다 (AT-51 · §10 EP-33)', () => {
  it('메뉴가 여덟 항목을 그 순서로 그린다', () => {
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
      'whitespace',
      'refresh'
    ])
  })

  it('모든 파일 접기는 지금 패치의 파일 전부를 접고, 펼치기는 집합을 비운다', () => {
    render()
    const item = (id: string): Props =>
      menuItems.filter((props) => props['data-diff-view-item'] === id)[0]

    click(item('collapse-all'))
    expect(actions.setAllDiffFilesCollapsed).toHaveBeenCalledWith(true, ['docs/a.md', 'src/b.ts'])

    click(item('expand-all'))
    expect(actions.setAllDiffFilesCollapsed).toHaveBeenCalledWith(false, [])
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
    expect(actions.refreshGitSnapshot).not.toHaveBeenCalled()
  })

  it('새로고침만 조회 세대를 올린다 — 표시 옵션과 다른 축이다', () => {
    render()

    click(menuItems.filter((props) => props['data-diff-view-item'] === 'refresh')[0])

    expect(actions.refreshGitSnapshot).toHaveBeenCalledTimes(1)
    expect(actions.setDiffViewOption).not.toHaveBeenCalled()
  })
})

describe('비교 기준 메뉴가 범위를 고른다 (AT-49)', () => {
  it('`모든 변경사항`·`미커밋 변경` 두 항목이 각자의 범위를 보낸다', () => {
    render()
    const scope = (value: string): Props =>
      menuItems.filter((props) => props['data-diff-comparison'] === value)[0]

    click(scope('all'))
    click(scope('uncommitted'))

    expect(actions.setDiffComparison.mock.calls.map((call) => call[0])).toEqual([
      { kind: 'all' },
      { kind: 'uncommitted' }
    ])
  })
})
