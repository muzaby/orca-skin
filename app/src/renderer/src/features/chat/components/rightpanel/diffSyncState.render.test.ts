// 0211 ΔV5 AT-63·AT-66·AT-68 — 미싱크 문구 · 기본 접힘 · 파일 헤더 한 줄.
//
// 계기가 턴 종료 하나로 줄면(D-099) **한 번도 싱크하지 않은 세션**이 정상 상태가 된다.
// 그 자리를 로딩 문구로 두면 사용자 지시 §3 의 고장 화면과 정상 화면이 같은 픽셀이 되어
// 다음 회귀를 화면에서 구분할 수 없다 — 그래서 두 상태를 **다른 문구**로 가른다(D-102).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it } from 'vitest'
import type { GitDiffPatch, GitDiffSummary } from '../../../../../../shared/ipc'
import { DEFAULT_DIFF_VIEW } from '../../reducer/chatReducer'
import { DiffReview } from './DiffReview'

const patch: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'base-oid', ref: 'main' },
  files: [
    {
      path: 'app/src/main/infra/db/queries.ts',
      status: 'modified',
      added: 21,
      removed: 6,
      kind: 'text',
      lines: [{ type: 'added', oldLine: null, newLine: 1, text: 'const alpha = 1' }]
    }
  ],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}

const summary: GitDiffSummary = {
  isRepo: true,
  base: patch.base,
  files: [],
  totals: { added: 21, removed: 6 },
  filesTruncated: false,
  commits: [],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: { files: [], totals: { added: 0, removed: 0 }, filesTruncated: false }
}

function render(props: Partial<Parameters<typeof DiffReview>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(DiffReview, {
      summary,
      patch,
      hasRequest: true,
      comparison: { kind: 'all' as const },
      expandedFiles: new Set<string>(),
      sidebarVisible: false,
      view: DEFAULT_DIFF_VIEW,
      requirements: [],
      draft: null,
      onToggleExpanded: () => undefined,
      onExpandFile: () => undefined,
      onOpenFile: () => undefined,
      onPickComparison: () => undefined,
      ...props
    })
  )
}

describe('싱크 전과 조회 중은 다른 화면이다 (AT-63 · D-102)', () => {
  it('빈 범위 안내는 본문에 한 번 나오고 파일트리에는 나오지 않는다 (AT-102)', () => {
    const html = render({ patch: { ...patch, files: [] }, sidebarVisible: true })
    const $ = load(html)
    expect($('[data-diff-scroll-owner]').text()).toBe('표시할 변경 사항이 없습니다.')
    expect($('[data-diff-file-tree]').text()).toBe('')
    expect(html.match(/표시할 변경 사항이 없습니다./g)).toHaveLength(1)
    expect($('[data-diff-sidebar]')).toHaveLength(1)
    expect($('[data-diff-commit-list] [data-diff-scope="all"]')).toHaveLength(1)
  })

  it.each<Partial<Parameters<typeof DiffReview>[0]>>([
    { hasRequest: false, patch: null },
    { patch: null },
    { patch: { ...patch, files: [], isRepo: false } },
    { patch: { ...patch, files: [], unavailable: true } },
    { patch: { ...patch, files: [] }, error: 'summary' },
    { patch: { ...patch, files: [] }, error: 'patch' }
  ])('미싱크·조회 중·실패는 빈 변경 안내를 표시하지 않는다: %j', (state) => {
    expect(render({ sidebarVisible: true, ...state })).not.toContain('표시할 변경 사항이 없습니다.')
  })

  it('한 번도 조회하지 않았으면 미싱크 문구이고 로딩 문구가 아니다', () => {
    const html = render({ hasRequest: false, patch: null })

    expect(html).toContain('data-diff-not-synced')
    expect(html).toContain('턴이 끝나면 표시됩니다')
    // **부재까지 센다** — 두 문구를 같은 자리에 함께 그린 구현이 통과하지 않게.
    expect(html).not.toContain('내용을 불러오는 중')
    expect(html).not.toContain('data-diff-loading')
  })

  it('조회가 나갔는데 아직 안 왔으면 로딩 문구이고 미싱크 문구가 아니다', () => {
    const html = render({ hasRequest: true, patch: null })

    expect(html).toContain('data-diff-loading')
    expect(html).toContain('내용을 불러오는 중')
    expect(html).not.toContain('data-diff-not-synced')
    expect(html).not.toContain('턴이 끝나면 표시됩니다')
  })

  it('두 문구가 서로 다른 문자열이다 — 같은 키를 두 번 쓰면 한 픽셀이 된다', () => {
    const notSynced = render({ hasRequest: false, patch: null })
    const loading = render({ hasRequest: true, patch: null })

    expect(notSynced).not.toBe(loading)
  })
})

describe('파일은 기본 접힘이고 헤더에서 펼친다 (AT-66 · ΔV7 D-126)', () => {
  it('첫 출력에 diff 줄이 없고 접힌 헤더부터 시작한다', () => {
    const html = render()

    expect(html).not.toContain('const alpha = 1')
    expect(html).not.toContain('대량 diff의 경우 파일이 축소되어 있습니다')
    expect(html).toContain('data-diff-file="app/src/main/infra/db/queries.ts"')
    expect(html).toContain('aria-expanded="false"')
  })

  it('펼친 집합에 넣은 파일만 본문을 낸다', () => {
    const html = render({ expandedFiles: new Set(['app/src/main/infra/db/queries.ts']) })

    expect(html).toContain('const alpha = 1')
    expect(html).toContain('aria-expanded="true"')
  })
})

describe('파일 헤더가 한 줄이다 (AT-68 · D-108)', () => {
  it('이름·부모 경로·변경량·열기 버튼이 같은 행에 선다', () => {
    const html = render()

    // 이름과 부모 경로가 **형제**다 — 두 줄 배치면 이름 쪽이 블록으로 감싸여 있었다.
    expect(html).toContain('queries.ts')
    expect(html).toContain('app/src/main/infra/db')
    expect(html).toContain('+21')
    expect(html).toContain('−6')
    expect(html).toContain('data-diff-file-open="app/src/main/infra/db/queries.ts"')
  })

  it('열기 버튼과 접기 버튼이 형제다 — 버튼 안에 버튼을 넣지 않는다', () => {
    const html = render()
    const toggle = html.indexOf('data-diff-file-toggle=')
    const open = html.indexOf('data-diff-file-open=')

    expect(toggle).toBeGreaterThanOrEqual(0)
    expect(open).toBeGreaterThan(toggle)
    // 토글 버튼이 열기 버튼보다 **먼저 닫힌다** — 중첩이면 닫는 태그가 뒤에 온다.
    expect(html.indexOf('</button>')).toBeLessThan(open)
  })
})
