// 0211 ΔV6 AT-73·AT-74 + ΔV7 AT-78: 빈 커밋·범위 라벨 회귀와 실제 DOM 배치.
// 폭과 높이는 대상 노드를 직접 관측한다. 구 세그먼트·25% 폭 계약은 ΔV7에서 대체했다.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, type ComponentProps } from 'react'
import { load } from 'cheerio'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GitDiffPatch, GitDiffSummary, GitStatus } from '../../../../../../shared/ipc'
import { DiffReview } from './DiffReview'
import { RightPanelTile } from './RightPanelTile'
import { defaultRightPanelTileLabelKey } from '../../lib/rightPanelTiles'
import { ALL_CHANGES, type DiffComparison } from './diffComparison'
import { summaryComparisonLabel } from './sessionChangesData'
import { DEFAULT_DIFF_VIEW } from '../../reducer/chatReducer'

const HERE = dirname(fileURLToPath(import.meta.url))

// **주석을 지우고 센다.** 이 파일의 스윕은 소스 텍스트를 보는데, 근거를 적은 주석에 같은
// 토큰 이름이 들어 있으면 스윕이 산문에 걸린다 — 실제로 `font-serif` 와 `→` 둘 다 그랬다.
// 그 상태로 두면 주석 한 줄을 고쳐 red 를 green 으로 만들 수 있어 눈이 없는 장치가 된다.
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const read = (name: string): string => stripComments(readFileSync(join(HERE, name), 'utf8'))

const SUMMARY: GitDiffSummary = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'a'.repeat(40), ref: 'main' },
  files: [],
  totals: { added: 0, removed: 0 },
  filesTruncated: false,
  commits: [
    {
      sha: '4ea4a51deadbeef0000000000000000000000000',
      subject: 'feat: add hello.txt with Hello world content',
      author: 'Claude',
      committedAt: 1_756_000_000_000,
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

const EMPTY_PATCH: GitDiffPatch = {
  isRepo: true,
  base: SUMMARY.base,
  files: [],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}

const STATUS: GitStatus = {
  isRepo: true,
  root: '/x/orca',
  branch: 'claude/hello-hcpxul',
  detached: false
}

function renderReview(
  patch: GitDiffPatch | null,
  summary: GitDiffSummary | null,
  sidebarVisible = false
): string {
  return renderToStaticMarkup(
    createElement(DiffReview, {
      summary,
      patch,
      hasRequest: true,
      comparison: ALL_CHANGES,
      expandedFiles: new Set<string>(),
      sidebarVisible,
      view: DEFAULT_DIFF_VIEW,
      requirements: [],
      draft: null,
      onToggleExpanded: () => undefined,
      onExpandFile: () => undefined,
      onOpenFile: () => undefined,
      onPickComparison: () => undefined
    })
  )
}

// ── AT-73 / VP-74 ────────────────────────────────────────────────────────────
describe('빈 커밋 문구 (AT-73 · D-112·D-113)', () => {
  it('커밋이 없으면 본문이 그 문구 하나이고 파일 섹션이 0개다', () => {
    const html = renderReview(EMPTY_PATCH, { ...SUMMARY, commits: [] })

    expect(html).toContain('표시할 변경 사항이 없습니다.')
    expect(html).not.toContain('data-diff-file=')
    // 안내 한 줄(D-105)도 나오면 안 된다 — 접힌 파일이 하나도 없기 때문이다.
    expect(html).not.toContain('대량 diff의 경우')
  })

  it('카탈로그 값이 사용자가 지정한 문장 그대로다', () => {
    const ko = readFileSync(join(HERE, '../../../../shared/i18n/resources/ko.ts'), 'utf8')

    expect(ko).toContain("diffEmpty: '표시할 변경 사항이 없습니다.'")
    // 옛 문구가 남아 있으면 자리마다 다른 말을 한다.
    expect(ko).not.toContain("diffEmpty: '변경 사항이 없습니다.'")
  })

  it('본문과 메뉴가 같은 빈 문구 키를 사용한다 (§10 EP-49 ② · D-153)', () => {
    const consumers = ['DiffReview.tsx', 'FileDiffSection.tsx', 'GitContextBar.tsx']
    const hits = consumers.filter((file) => read(file).includes('chat.rightpanel.diffEmpty'))

    expect(hits).toEqual(consumers)
  })
})

// ── AT-74 / VP-75 ────────────────────────────────────────────────────────────
describe('모드별 컨텍스트 라벨 (AT-74 · D-116)', () => {
  const tr = (key: string): string => key

  it('두 모드가 서로 다른 모양을 낸다 — 한 모양으로 합친 변이가 red 다', () => {
    const all = summaryComparisonLabel(SUMMARY, STATUS, ALL_CHANGES, tr)
    const commit: DiffComparison = { kind: 'commit', sha: SUMMARY.commits[0].sha }
    const one = summaryComparisonLabel(SUMMARY, STATUS, commit, tr)

    expect(all).toEqual({ kind: 'range', base: 'main', head: 'claude/hello-hcpxul' })
    expect(one).toEqual({
      kind: 'commit',
      sha: '4ea4a51',
      subject: 'feat: add hello.txt with Hello world content'
    })
  })

  it('고른 커밋이 사라지면 범위 라벨로 접는다 — 빈 라벨을 그리지 않는다', () => {
    const gone: DiffComparison = { kind: 'commit', sha: 'f'.repeat(40) }

    expect(summaryComparisonLabel(SUMMARY, STATUS, gone, tr)).toMatchObject({
      kind: 'range'
    })
  })

  it('컨텍스트 바가 커밋 모드에서 `→` 를 그리지 않는다 (§10 EP-50 ②)', () => {
    const source = read('GitContextBar.tsx')
    // 화살표는 `range` 갈래 안에만 있다 — 판별 유니온을 한 갈래로 접은 변이가 여기서 red 다.
    const arrowAt = source.indexOf('→')
    const rangeBranchAt = source.indexOf('data-diff-base-label')
    const commitBranchAt = source.indexOf('data-diff-commit-sha-label')

    expect(commitBranchAt).toBeGreaterThan(-1)
    expect(arrowAt).toBeGreaterThan(rangeBranchAt)
    expect(rangeBranchAt).toBeGreaterThan(commitBranchAt)
  })
})

// ΔV7 replaces the two-segment and percentage-width contracts with the supplied DOM.
// The element itself owns each assertion: moving a width to a child must fail (D29).
describe('실제 DOM의 대상 요소 (ΔV7 AT-78)', () => {
  const patch: GitDiffPatch = {
    ...EMPTY_PATCH,
    files: [
      { path: 'docs/a.md', status: 'modified', added: 1, removed: 0, kind: 'text', lines: [] }
    ]
  }

  it('사이드바가 고정 폭과 좁은 화면 상한을 갖고 커밋 구획 높이를 제한한다', () => {
    const $ = load(renderReview(patch, SUMMARY, true))
    const sidebar = $('[data-diff-sidebar]')
    expect(sidebar.attr('class')).toContain('w-[240px]')
    expect(sidebar.attr('class')).toContain('max-w-[50%]')
    expect(sidebar.attr('class')).not.toContain('w-[25%]')
    expect(sidebar.attr('class')).not.toContain('w-[38%]')
    expect($('[data-diff-commit-list]').attr('class')).toContain('max-h-[40%]')
    const card = $('[data-diff-commit-card]')
    expect(card.attr('class')).not.toContain('border')
    expect(card.find('[title]').attr('class')).toContain('text-footnote')
    expect($('[data-diff-scope="all"]').attr('class')).toContain('bg-fill-uncontained-active')
  })

  it('사이드바 본문은 좌측 nav와 같은 text-footnote이며 하위 text-body/text-code가 덮지 않는다', () => {
    const source = read('ChangedNavigationSidebar.tsx')

    expect(source).toContain('font-sans text-footnote font-normal')
    expect(source).not.toMatch(/\btext-body\b|\btext-code\b/)
  })

  it('파일 밴드가 sticky이고 변경량이 이름 바로 뒤에 있으며 본문 앞 안내가 없다', () => {
    const $ = load(renderReview(patch, SUMMARY, true))
    const header = $('[data-diff-file-header]')
    expect(header.attr('class')).toContain('sticky top-0')
    expect(header.attr('class')).toContain('h-[32px]')
    expect(header.attr('class')).toContain('bg-bg2')
    expect(header.find('[data-diff-file-counts]').attr('class')).not.toContain('ml-auto')
    expect(header.find('[data-diff-file-open]').attr('class')).toContain(
      'group-focus-within/filehead:opacity-100'
    )
    expect($('[data-diff-scroll-owner]').children().first().attr('data-diff-file')).toBe(
      'docs/a.md'
    )
  })
})

// ── ΔV14 AT-102 / VP-103 ─────────────────────────────────────────────────────
// 라운드 4 verify D38: 안내의 **존재**(M23)·트리 0개(M6)·토글 숨김(M7)은 잠겼는데 **중앙 배치**만
// 무관측이었다 — 중앙 클래스를 지워도 전건 green 이었다(M5). 형제 축(사이드바 240px·밴드 32px)이
// 이미 같은 방식으로 잠겨 있으므로 여기에 같은 단언을 둔다.
describe('빈 diff 본문의 중앙 배치 (AT-102 · D-153 · §10 EP-77 ①)', () => {
  it('안내가 본문 가로·세로 중앙에 하나만 선다', () => {
    const $ = load(renderReview(EMPTY_PATCH, { ...SUMMARY, commits: [] }))
    const empty = $('[data-diff-empty]')

    expect(empty).toHaveLength(1)
    expect(empty.text()).toContain('표시할 변경 사항이 없습니다.')
    // 세 축이 함께 있어야 중앙이다 — 하나만 지워도 위쪽 정렬로 돌아간다.
    for (const token of ['h-full', 'items-center', 'justify-center', 'text-center']) {
      expect(empty.attr('class')?.split(' ')).toContain(token)
    }
  })

  it('파일이 있으면 그 안내를 그리지 않는다 — 음성 축의 양성 짝', () => {
    const patch: GitDiffPatch = {
      ...EMPTY_PATCH,
      files: [
        { path: 'docs/a.md', status: 'modified', added: 1, removed: 0, kind: 'text', lines: [] }
      ]
    }
    const $ = load(renderReview(patch, SUMMARY))

    expect($('[data-diff-empty]')).toHaveLength(0)
    expect($('[data-diff-file]')).toHaveLength(1)
  })
})

// ── ΔV7 AT-78 / VP-79 — EP-53 ① ──────────────────────────────────────────────
// 라운드 4 verify D39: 사이드바 240px·커밋 목록 40%·파일 밴드 32px 는 위에서 잠겼는데 **헤더
// 밴드**만 무관측이었다 — 48px 로 바꿔도 전건 green 이었다(M29). 같은 파일·같은 방식으로 닫는다.
describe('타일 헤더 밴드 (AT-78 · D-123 · §10 EP-53 ①)', () => {
  const tile = (id: 'diff' | 'plan'): string =>
    renderToStaticMarkup(
      createElement(
        RightPanelTile,
        { id, defaultLabelKey: defaultRightPanelTileLabelKey(id) } as ComponentProps<
          typeof RightPanelTile
        >,
        null
      )
    )

  it('diff 타일 헤더가 32px 밴드다', () => {
    const header = load(tile('diff'))('[data-diff-tile-header]')

    expect(header).toHaveLength(1)
    expect(header.attr('class')?.split(' ')).toContain('h-[32px]')
    expect(header.attr('class')).not.toContain('py-2')
  })

  it('다른 타일은 그 밴드를 쓰지 않는다 — 두 갈래를 한 모양으로 합친 변이가 red 다', () => {
    const $ = load(tile('plan'))

    expect($('[data-diff-tile-header]')).toHaveLength(0)
    expect($('.app-frame-tile-header').attr('class')).not.toContain('h-[32px]')
  })
})
