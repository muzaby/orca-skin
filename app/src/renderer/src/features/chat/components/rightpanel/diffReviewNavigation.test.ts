// 0211 ΔV4 r2 — 트리에서 고른 파일이 **먼저 펼쳐진다** (VP-58 / §10 EP-36 ②).
//
// r1 검증에서 `pickFile` 의 `onExpandFile(path)` 를 지워도 766케이스가 전건 green 이었다(D4).
// 구현 보고는 이 자리를 "`DiffReview.pickFile` 이 `onExpandFile` 먼저 부른 뒤 `scrollIntoView`"
// 라는 **코드 읽기**로 닫았다 — 읽기는 회귀를 잡지 못한다.
//
// 잠그는 것은 §10 EP-36 ② 의 실패 의미다: 접힌 파일을 고르면 스크롤만 일어나 화면에 아무
// 변화가 없고, 사용자는 클릭이 먹지 않은 것으로 읽는다. 사이드바를 double 로 세워 프로덕션이
// 실제로 건네는 `onPickFile` 을 잡는다 — SSR 은 핸들러를 마크업에 남기지 않는다.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitDiffPatch, GitDiffPatchFile, GitDiffSummary } from '../../../../../../shared/ipc'
import { DEFAULT_DIFF_VIEW } from '../../reducer/chatReducer'

let onPickFile: ((path: string) => void) | null = null
let sectionPaths: string[] = []

// 이동은 `lib/fileSectionScroll` 이 한다. 여기서는 **부르는지**만 본다 — 그 함수가 실제로
// `scrollIntoView` 를 부르는지는 `fileSectionScroll.test.ts` 가 잰다(둘로 갈라야 SSR 에서도
// 양쪽이 잠긴다, r2 검증 D16).
const revealFileSection = vi.fn()
vi.mock('../../lib/fileSectionScroll', () => ({
  revealFileSection: (...args: unknown[]) => revealFileSection(...args)
}))

vi.mock('./ChangedNavigationSidebar', () => ({
  ChangedNavigationSidebar: (props: {
    sections: readonly { path: string }[]
    onPickFile: (path: string) => void
  }) => {
    onPickFile = props.onPickFile
    sectionPaths = props.sections.map((section) => section.path)
    return null
  }
}))

const { DiffReview } = await import('./DiffReview')

function textFile(path: string): GitDiffPatchFile {
  return {
    path,
    status: 'modified',
    added: 1,
    removed: 0,
    kind: 'text',
    lines: [{ type: 'added', oldLine: null, newLine: 1, text: `line of ${path}` }]
  }
}

const patch: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'base-oid', ref: 'main' },
  files: [textFile('docs/a.md'), textFile('src/b.ts')],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}

const summary: GitDiffSummary = {
  isRepo: true,
  base: patch.base,
  files: [],
  totals: { added: 2, removed: 0 },
  filesTruncated: false,
  commits: [],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: { files: [], totals: { added: 0, removed: 0 }, filesTruncated: false }
}

function render(collapsed: string[] = []): {
  html: string
  onExpandFile: ReturnType<typeof vi.fn>
} {
  const onExpandFile = vi.fn()
  const html = renderToStaticMarkup(
    createElement(DiffReview, {
      summary,
      patch,
      comparison: { kind: 'all' as const },
      collapsedFiles: new Set(collapsed),
      sidebarVisible: true,
      view: DEFAULT_DIFF_VIEW,
      requirements: [],
      draft: null,
      onToggleCollapsed: () => undefined,
      onExpandFile,
      onPickComparison: () => undefined
    })
  )
  return { html, onExpandFile }
}

beforeEach(() => {
  onPickFile = null
  sectionPaths = []
  revealFileSection.mockClear()
})

describe('사이드바 파일 선택 (§10 EP-36 ②)', () => {
  it('고른 파일을 먼저 펼친다 — 접힌 섹션으로 스크롤만 하면 아무 일도 안 일어난 것으로 보인다', () => {
    const { onExpandFile } = render(['src/b.ts'])

    onPickFile?.('src/b.ts')

    expect(onExpandFile).toHaveBeenCalledTimes(1)
    expect(onExpandFile).toHaveBeenCalledWith('src/b.ts')
  })

  it('펼친 다음 그 섹션으로 이동한다 — 펼치기만 하면 화면은 보던 자리에 남는다 (AT-50)', () => {
    render(['src/b.ts'])

    onPickFile?.('src/b.ts')

    expect(revealFileSection).toHaveBeenCalledTimes(1)
    // 두 번째 인자가 **고른 경로**다 — 첫 인자는 스크롤 소유자(SSR 이라 null)다.
    expect(revealFileSection.mock.calls[0][1]).toBe('src/b.ts')
  })

  it('고르지 않았으면 이동도 없다 — 렌더만으로 화면이 움직이지 않는다', () => {
    render()

    expect(revealFileSection).not.toHaveBeenCalled()
  })

  it('이미 펼친 파일을 골라도 같은 경로로 알린다 — 판정은 상위가 한다', () => {
    const { onExpandFile } = render([])

    onPickFile?.('docs/a.md')

    expect(onExpandFile).toHaveBeenCalledWith('docs/a.md')
  })

  it('선택은 새 화면을 열지 않는다 — 본문이 같은 컨테이너에 그대로 있다 (D-073)', () => {
    const { html } = render(['src/b.ts'])

    expect(html).toContain('data-diff-scroll-owner')
    // 두 섹션 모두 같은 스크롤 소유자 안에 남는다 — peek 처럼 한 파일만 남기지 않는다.
    expect(html).toContain('data-diff-file="docs/a.md"')
    expect(html).toContain('data-diff-file="src/b.ts"')
  })

  it('사이드바가 받는 목록이 지금 그리는 섹션과 같다 — 트리와 본문이 갈리지 않는다', () => {
    render()

    expect(sectionPaths).toEqual(['docs/a.md', 'src/b.ts'])
  })
})
