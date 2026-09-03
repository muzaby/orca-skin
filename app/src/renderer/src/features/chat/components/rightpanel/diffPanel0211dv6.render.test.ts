// 0211 ΔV6 AT-73·AT-74·AT-75·AT-76 / VP-74·VP-75·VP-76·VP-77 —
// 빈 커밋 문구 · 모드별 라벨 · 헤더 세그먼트 둘 · 참조 실측 토큰.
//
// 실측표(plan §8 ΔV6)가 이 파일의 계약이다. 각 행을 **양성 + 부정** 짝으로 센다 — "새 토큰이
// 있다" 만 보면 옛 클래스가 함께 남아 Tailwind 규칙 순서가 결과를 정하는 구현이 통과하고,
// 그때 화면은 맞아 보이는데 계약이 둘이 된다.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GitDiffPatch, GitDiffSummary, GitStatus } from '../../../../../../shared/ipc'
import { DiffReview } from './DiffReview'
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

function renderReview(patch: GitDiffPatch | null, summary: GitDiffSummary | null): string {
  return renderToStaticMarkup(
    createElement(DiffReview, {
      summary,
      patch,
      hasRequest: true,
      comparison: ALL_CHANGES,
      expandedFiles: new Set<string>(),
      sidebarVisible: false,
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

  it('이 키를 읽는 자리가 넷이다 — 자리마다 새 키를 만들지 않았다 (§10 EP-49 ②)', () => {
    const consumers = [
      'DiffReview.tsx',
      'ChangedNavigationSidebar.tsx',
      'FileDiffSection.tsx',
      'GitContextBar.tsx'
    ]
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

// ── AT-75 / VP-76 ────────────────────────────────────────────────────────────
describe('헤더 세그먼트 둘 (AT-75 · D-117)', () => {
  const source = read('GitContextBar.tsx')

  it('토글이 둘이고 옛 폴더 버튼은 없다', () => {
    expect(source.match(/data-diff-sidebar-toggle="(off|on)"/g)).toHaveLength(2)
    expect(source).not.toContain('leadingIcon="folder"')
  })

  it('두 버튼이 한 상태를 반대로 읽는다 — 같은 값을 준 변이가 red 다', () => {
    expect(source).toContain('pressed={!sidebarVisible}')
    expect(source).toContain('pressed={sidebarVisible}')
  })

  it('액션이 멱등이다 — `toggle` 이 아니라 값을 싣는다 (§10 EP-51 ②)', () => {
    expect(source).toContain('setDiffSidebarVisible(false)')
    expect(source).toContain('setDiffSidebarVisible(true)')
    expect(source).not.toContain('toggleDiffSidebar')
  })
})

// ── AT-76 / VP-77 ────────────────────────────────────────────────────────────
describe('참조 실측 토큰 (AT-76 · D-118·D-119·D-120)', () => {
  it('실측 1행 — 사이드바 폭이 참조의 24.8% 대다', () => {
    const source = read('ChangedNavigationSidebar.tsx')

    expect(source).toContain('w-[25%]')
    expect(source).not.toContain('w-[38%]')
  })

  it('실측 2·3행 — 헤더 라벨이 regular sans 이고 톤이 t7 이다', () => {
    const source = read('GitContextBar.tsx')
    // 라벨 셋(`base`·`head`·`commit subject`)이 전부 serif·semibold 를 벗었다.
    expect(source).not.toContain('font-serif')
    expect(source).not.toContain('font-semibold')
    expect(source).toContain('text-[13px] text-t7')
  })

  it('실측 5행 — 파일 헤더가 밴드 배경을 갖는다', () => {
    expect(read('FileDiffSection.tsx')).toContain('bg-bg2')
  })

  it('실측 6·7행 — 선택은 채움이고 비선택 커밋 카드에는 테두리가 없다', () => {
    const source = read('ChangedNavigationSidebar.tsx')

    expect(source.match(/bg-fill-selected/g)).toHaveLength(2)
    // 옛 표시 문법이 함께 남으면 두 계약이 된다.
    expect(source).not.toContain('border-accent')
    expect(source).not.toContain('text-accent')
    expect(source).not.toContain('border border-t5')
  })

  it('실측 9행 — 헤더 활성 토글이 눌린 상태를 그린다', () => {
    // `Button` 의 `pressed` 가 채움을 소유한다(squishClass). 세그먼트는 그것을 쓴다.
    expect(read('GitContextBar.tsx')).toContain('pressed={sidebarVisible}')
  })
})
