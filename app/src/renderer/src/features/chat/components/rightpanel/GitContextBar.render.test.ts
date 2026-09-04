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
  status: GitStatus | null
}

let fixture: Fixture = {
  summary,
  comparison: ALL_CHANGES,
  sidebarVisible: false,
  view: DEFAULT_DIFF_VIEW,
  colWidth: PANEL_DEFAULT_WIDTH,
  status: gitStatus
}

vi.mock('../../store/chatStore', () => ({
  chatActions: {
    setDiffSidebarVisible: vi.fn(),
    setDiffComparison: vi.fn(),
    setDiffViewOption: vi.fn(),
    setAllDiffFilesExpanded: vi.fn(),
    setRightPanelColWidth: vi.fn()
  },
  useChatSession: (select: (state: unknown) => unknown) =>
    select({
      gitSnapshot: {
        summary: fixture.summary,
        patch,
        comparison: fixture.comparison,
        expandedFiles: [],
        sidebarVisible: fixture.sidebarVisible,
        view: fixture.view
      },
      cwd: '/repo',
      gitStatus: { cwd: '/repo', status: fixture.status },
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
    status: gitStatus,
    ...patchFixture
  }
  return renderToStaticMarkup(createElement(GitContextBar))
}

// 0211 ΔV5 D-104 — 사용자가 참조 화면을 다시 보고 D-069 의 금지를 뒤집었다. 이제 두 값이다.
describe('비교 기준 라벨 — `기준 → 현재` 두 값이다 (AT-65 · D-104)', () => {
  it('세션 시작 브랜치와 현재 브랜치를 **그 순서로** 그린다', () => {
    const html = render()

    expect(html).toContain('data-diff-context-bar')
    expect(html).toContain('main')
    expect(html).toContain(CURRENT_BRANCH)
    // **순서가 계약의 절반이다.** 존재만 세면 두 값을 맞바꾼 구현도 통과한다.
    expect(html.indexOf('data-diff-base-label')).toBeLessThan(html.indexOf('data-diff-head-label'))
    expect(html.indexOf('>main<')).toBeLessThan(html.indexOf(`>${CURRENT_BRANCH}<`))
  })

  it('현재 브랜치를 모르면 화살표와 우측 값을 함께 생략한다 — 꼬리가 빈 라벨을 만들지 않는다', () => {
    const detached = render({ status: { ...gitStatus, branch: null, detached: true } })

    expect(detached).toContain('main')
    expect(detached).not.toContain('data-diff-head-label')
    expect(detached).not.toContain(CURRENT_BRANCH)
  })

  it('기준과 현재가 같은 이름이면 한 값으로 접는다 — 화살표가 아무것도 말하지 않는다', () => {
    const same = render({ status: { ...gitStatus, branch: 'main' } })

    expect(same).toContain('main')
    expect(same).not.toContain('data-diff-head-label')
  })

  it('이름을 모르면 sha 7자로 접힌다 — 라벨 자리를 비우지 않는다 (D-071)', () => {
    const html = render({
      summary: { ...summary, base: { kind: 'worktree-base', oid: 'abcdef1234567890', ref: null } }
    })

    expect(html).toContain('abcdef1')
  })
})

describe('컨텍스트 바의 컨트롤 — `×` 는 타일이 그린다 (제안서 §4 · ΔV6 D-117)', () => {
  it('목록 토글 하나 · 비교 기준 · 설정 · 확대가 함께 선다', () => {
    const html = render()

    for (const marker of [
      'data-diff-sidebar-toggle',
      'data-diff-comparison-trigger',
      'data-diff-view-trigger',
      'data-diff-expand-panel'
    ])
      expect(html).toContain(marker)
  })

  // 0211 ΔV6 D-117 — 하나짜리 `aria-expanded` 가 **세그먼트 둘의 `aria-pressed`** 가 됐다.
  // 두 상태를 한 케이스로 잰다: 하나만 보면 두 버튼이 늘 같은 값을 내는 구현이 통과한다.
  it('단일 토글의 상태와 이름이 목록 표시 여부를 따른다 (ΔV7 AT-77)', () => {
    const tagOf = (html: string): string => {
      expect(html.match(/data-diff-sidebar-toggle=/g)).toHaveLength(1)
      const at = html.indexOf('data-diff-sidebar-toggle=')
      const tag = html.slice(html.lastIndexOf('<', at), html.indexOf('>', at))
      return tag
    }
    const hidden = render({ sidebarVisible: false })
    const shown = render({ sidebarVisible: true })

    expect(tagOf(hidden)).toContain('aria-pressed="false"')
    expect(tagOf(hidden)).toContain('aria-label="파일 목록 표시"')
    expect(tagOf(shown)).toContain('aria-pressed="true"')
    expect(tagOf(shown)).toContain('aria-label="파일 목록 숨기기"')
  })

  it('활성 목록 토글은 Orca 파란 selected 토큰을 쓴다 (ΔV8 AT-80)', () => {
    const html = render({ sidebarVisible: true })
    const at = html.indexOf('data-diff-sidebar-toggle=')
    const button = html.slice(html.lastIndexOf('<button', at), html.indexOf('</button>', at))

    expect(button).toContain('aria-pressed:text-selected')
    expect(button).toContain('[&amp;[aria-pressed=true]&gt;.btn-squish]:bg-selected-soft')
    expect(button).not.toContain('bg-fill-selected')
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

  it('확대와 되돌리기는 같은 NE/SW 축에서 외향/내향으로 갈린다 (ΔV8 D-127)', () => {
    const iconPath = (html: string): string => {
      const at = html.indexOf('data-diff-expand-panel=')
      const button = html.slice(html.lastIndexOf('<button', at), html.indexOf('</button>', at))
      return button.match(/<path d="([^"]+)"/)?.[1] ?? ''
    }

    expect(iconPath(render({ colWidth: PANEL_DEFAULT_WIDTH }))).toBe(
      'M160-160v-240h80v104l168-168 56 56-168 168h104v80H160Zm400-640h240v240h-80v-104L552-496l-56-56 168-168H560v-80Z'
    )
    expect(iconPath(render({ colWidth: PANEL_MAX_WIDTH }))).toBe(
      'M560-560H800v-80h-104L864-808l-56-56-168 168v-104h-80v240Zm-160 160H160v80h104L96-152l56 56 168-168v104h80v-240Z'
    )
  })

  // 0211 ΔV4 r3 검증 D23 — 세 이름이 마크업에 **모두** 있어 존재만 세면 서로 맞바꿔도 green
  // 이었다. 버튼을 `data-*` 로 지목해 이름과 **짝지어** 단언한다.
  it('아이콘 버튼 셋이 각자의 접근성 이름을 갖는다 — 서로 맞바꾸면 red 다', () => {
    const html = render()
    const pairs: [string, string][] = [
      ['data-diff-sidebar-toggle', '파일 목록 표시'],
      ['data-diff-view-trigger', 'diff 표시 설정'],
      ['data-diff-expand-panel', '패널 확대']
    ]

    for (const [marker, name] of pairs) {
      // 같은 요소 안에서 마커와 이름이 함께 나오는지 — 태그 경계를 넘지 않는 범위로 자른다.
      const start = html.indexOf(marker)
      expect(start).toBeGreaterThanOrEqual(0)
      const tagStart = html.lastIndexOf('<', start)
      const tagEnd = html.indexOf('>', start)
      expect(html.slice(tagStart, tagEnd)).toContain(`aria-label="${name}"`)
    }
  })
})
