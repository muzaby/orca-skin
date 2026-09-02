// 0211 ΔV4 — **한 화면**의 연속 review (VP-53 · AT-45).
//
// 두 화면(목록↔peek)이 사라졌다는 것을 부재로만 세면 대체가 붙었는지 알 수 없다 — 여기서는
// ① 파일 섹션이 한 컨테이너에 순서대로 있고 ② 개별 접기가 **그 파일만** 접는다는 양성 단언과
// 짝짓는다(§5 방향 규칙).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GitDiffPatch, GitDiffPatchFile, GitDiffSummary } from '../../../../../../shared/ipc'
import { DEFAULT_DIFF_VIEW, PANEL_DEFAULT_WIDTH, PANEL_MAX_WIDTH } from '../../reducer/chatReducer'
import { DiffReview } from './DiffReview'
import { nextDiffPanelWidth } from './diffPanelWidth'
import { tileById } from './tileRegistry'

function textFile(path: string, texts: readonly string[]): GitDiffPatchFile {
  return {
    path,
    status: 'modified',
    added: texts.length,
    removed: 0,
    kind: 'text',
    lines: texts.map((text, index) => ({
      type: 'added' as const,
      oldLine: null,
      newLine: index + 1,
      text
    }))
  }
}

const patch: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'base-oid', ref: 'main' },
  files: [textFile('docs/a.md', ['alpha']), textFile('src/b.ts', ['beta'])],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}

const summary: GitDiffSummary = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'base-oid', ref: 'main' },
  files: [{ path: 'docs/a.md', status: 'modified', added: 1, removed: 0, binary: false }],
  totals: { added: 2, removed: 0 },
  filesTruncated: false,
  commits: [
    {
      sha: 'commit-a',
      subject: '첫 커밋',
      author: 'codex',
      committedAt: 0,
      files: [{ path: 'docs/a.md', status: 'modified', added: 1, removed: 0, binary: false }],
      filesTruncated: false,
      fileCount: 1,
      totals: { added: 1, removed: 0 }
    }
  ],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: {
    files: [{ path: 'src/b.ts', status: 'modified', added: 1, removed: 0, binary: false }],
    totals: { added: 1, removed: 0 },
    filesTruncated: false
  }
}

function render(props: Partial<Parameters<typeof DiffReview>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(DiffReview, {
      summary,
      patch,
      comparison: { kind: 'all' },
      collapsedFiles: new Set<string>(),
      sidebarVisible: false,
      view: DEFAULT_DIFF_VIEW,
      requirements: [],
      draft: null,
      onToggleCollapsed: () => undefined,
      onExpandFile: () => undefined,
      onPickComparison: () => undefined,
      ...props
    })
  )
}

describe('연속 파일 섹션 — 화면이 하나다 (AT-45)', () => {
  it('파일들이 한 스크롤 컨테이너 안에 순서대로 서고 각각 접기 컨트롤을 갖는다', () => {
    const html = render()

    expect(html.indexOf('data-diff-scroll-owner')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('data-diff-file="docs/a.md"')).toBeLessThan(
      html.indexOf('data-diff-file="src/b.ts"')
    )
    expect(html).toContain('data-diff-file-toggle="docs/a.md"')
    expect(html).toContain('aria-expanded="true"')
    // 두 파일의 본문이 모두 기본 펼침이다(D-074).
    expect(html).toContain('alpha')
    expect(html).toContain('beta')
  })

  it('한 파일을 접으면 그 파일의 줄만 사라진다 — 전체 접기와 구분된다', () => {
    const html = render({ collapsedFiles: new Set(['docs/a.md']) })

    expect(html).not.toContain('alpha')
    expect(html).toContain('beta')
    expect(html).toContain('data-diff-file="docs/a.md"')
  })

  it('peek 화면과 이전/다음 이동이 출력에 없다', () => {
    const html = render()

    expect(html).not.toContain('data-session-changes-screen')
    expect(html).not.toContain('이전 파일')
    expect(html).not.toContain('다음 파일')
  })

  it('파일 헤더가 파일명·부모 경로·변경량을 함께 말한다 (제안서 §6)', () => {
    const html = render()

    expect(html).toContain('a.md')
    expect(html).toContain('docs')
    expect(html).toContain('+1')
    expect(html).toContain('−0')
  })
})

describe('사이드바 — 기본 숨김, 열면 두 구획 (AT-50)', () => {
  it('기본 출력에는 사이드바가 없다', () => {
    expect(render()).not.toContain('data-diff-sidebar')
  })

  it('열면 변경 파일 트리와 커밋 목록이 함께 선다', () => {
    const html = render({ sidebarVisible: true })

    expect(html).toContain('data-diff-sidebar')
    expect(html).toContain('data-diff-file-tree')
    expect(html).toContain('data-diff-commit-list')
    expect(html).toContain('data-diff-tree-file="docs/a.md"')
    // 커밋 카드는 subject · sha7 · author · 상대 시각 넷을 말한다.
    expect(html).toContain('data-diff-commit-card="commit-a"')
    expect(html).toContain('첫 커밋')
    expect(html).toContain('commit-')
    expect(html).toContain('codex')
    // 범위 항목 둘이 커밋 카드 위에 선다(D-082).
    expect(html).toContain('data-diff-scope="all"')
    expect(html).toContain('data-diff-scope="uncommitted"')
  })

  it('사이드바가 깊이 연출 utility 를 쓴다 — 저장소의 기존 상수 승계 (D-092)', () => {
    expect(render({ sidebarVisible: true })).toContain('animate-depth-in')
  })
})

describe('비교 범위 — 목록만 좁힌다 (AT-49)', () => {
  it('커밋을 고르면 그 커밋의 파일만 남고 줄은 전체 모드와 같다', () => {
    const all = render()
    const scoped = render({ comparison: { kind: 'commit', sha: 'commit-a' } })

    expect(scoped).toContain('data-diff-file="docs/a.md"')
    expect(scoped).not.toContain('data-diff-file="src/b.ts"')
    // **같은 파일의 줄이 두 모드에서 같다** — diff 기준이 커밋 단위로 바뀌지 않았다는 직접 부정.
    expect(scoped).toContain('alpha')
    expect(all).toContain('alpha')
  })

  it('미커밋 범위는 HEAD 대비 파일만 남긴다', () => {
    const html = render({ comparison: { kind: 'uncommitted' } })

    expect(html).toContain('data-diff-file="src/b.ts"')
    expect(html).not.toContain('data-diff-file="docs/a.md"')
  })

  it('커밋 파일이 세션 패치에 없으면 헤더와 사유를 함께 그린다 (D-080)', () => {
    const revertedSummary: GitDiffSummary = {
      ...summary,
      commits: [
        {
          ...summary.commits[0],
          files: [{ path: 'gone.ts', status: 'modified', added: 4, removed: 2, binary: false }]
        }
      ]
    }
    const html = render({
      summary: revertedSummary,
      comparison: { kind: 'commit', sha: 'commit-a' }
    })

    expect(html).toContain('data-diff-file="gone.ts"')
    expect(html).toContain('세션 기준 변경 없음')
    // 목록에서 조용히 빼지 않으므로 그 커밋의 변경량은 계속 보인다.
    expect(html).toContain('+4')
  })
})

describe('패치 상태가 값으로 보인다 (AT-47)', () => {
  it('아직 오지 않았으면 로딩이고 빈 목록으로 보이지 않는다', () => {
    const html = render({ patch: null })

    expect(html).toContain('내용을 불러오는 중')
    expect(html).not.toContain('변경 사항이 없습니다')
  })

  it('두 조회가 모두 실패하면 사유와 재시도 안내가 뜬다', () => {
    const html = render({ patch: { ...patch, files: [], unavailable: true } })

    expect(html).toContain('불러오지 못했습니다')
  })

  it('축소 문맥으로 받았으면 그 사실을 말한다', () => {
    const html = render({ patch: { ...patch, contextLimited: true } })

    expect(html).toContain('문맥이 제한')
  })

  it('상한을 넘은 파일은 헤더와 변경량을 남기고 줄만 뺀다', () => {
    const html = render({
      patch: {
        ...patch,
        files: [{ ...textFile('huge.ts', []), kind: 'too-large', added: 90000, removed: 3 }]
      }
    })

    expect(html).toContain('data-diff-file="huge.ts"')
    expect(html).toContain('+90000')
    expect(html).toContain('너무 커서')
  })
})

describe('표시 옵션 넷이 화면을 바꾼다 (AT-51 · D-088)', () => {
  const wide: GitDiffPatch = {
    ...patch,
    files: [
      {
        path: 'w.ts',
        status: 'modified',
        added: 1,
        removed: 1,
        kind: 'text',
        lines: [
          { type: 'removed', oldLine: 1, newLine: null, text: 'const a = 1' },
          { type: 'added', oldLine: null, newLine: 1, text: 'const a = 2' }
        ]
      }
    ]
  }

  it('모든 파일 접기/펼치기가 섹션 전체를 한 번에 바꾼다', () => {
    const collapsedAll = render({ collapsedFiles: new Set(['docs/a.md', 'src/b.ts']) })

    expect(collapsedAll).not.toContain('alpha')
    expect(collapsedAll).not.toContain('beta')
    // 펼침으로 되돌리면 둘 다 돌아온다 — 접힘 집합이 비는 것이 곧 전체 펼침이다(D-074).
    expect(render({ collapsedFiles: new Set() })).toContain('alpha')
  })

  it('나란히는 한 행이 old·new 두 칸을 갖는다', () => {
    // 강조를 끄고 본다 — 켜져 있으면 바뀐 토큰이 `<mark>` 로 갈려 줄 문자열이 이어지지 않는다.
    const plain = { ...DEFAULT_DIFF_VIEW, highlightWords: false }
    const inline = render({ patch: wide, view: plain })
    const side = render({ patch: wide, view: { ...plain, layout: 'side-by-side' } })

    expect(inline).not.toContain('data-diff-side-by-side')
    expect(side).toContain('data-diff-side-by-side')
    // 좌우 칸이 각각 자기 줄을 그린다.
    expect(side).toContain('const a = 1')
    expect(side).toContain('const a = 2')
  })

  it('자동 줄 바꿈을 끄면 본문이 가로 스크롤로 바뀐다', () => {
    const wrapped = render({ patch: wide })
    const unwrapped = render({ patch: wide, view: { ...DEFAULT_DIFF_VIEW, wrapLines: false } })

    expect(wrapped).toContain('whitespace-pre-wrap')
    expect(unwrapped).toContain('overflow-x-auto')
    expect(unwrapped).not.toContain('whitespace-pre-wrap')
  })

  it('변경된 단어 강조를 끄면 강조 요소가 0개다 — 항목이 뜻을 갖는다', () => {
    const on = render({ patch: wide })
    const off = render({ patch: wide, view: { ...DEFAULT_DIFF_VIEW, highlightWords: false } })

    expect(on).toContain('data-diff-word-change')
    expect(off).not.toContain('data-diff-word-change')
  })

  it('공백 변경 숨기기가 공백만 다른 줄 쌍을 문맥으로 접고 진짜 변경은 남긴다', () => {
    const line = (
      type: 'unchanged' | 'added' | 'removed',
      oldLine: number | null,
      newLine: number | null,
      text: string
    ): GitDiffPatch['files'][number]['lines'][number] => ({ type, oldLine, newLine, text })
    const spaced: GitDiffPatch = {
      ...patch,
      files: [
        {
          path: 's.ts',
          status: 'modified',
          added: 2,
          removed: 2,
          kind: 'text',
          lines: [
            line('unchanged', 1, 1, 'header'),
            line('removed', 2, null, 'const a=1'),
            line('added', null, 2, 'const a = 1'),
            line('unchanged', 3, 3, 'mid'),
            line('removed', 4, null, 'const b = 1'),
            line('added', null, 4, 'const b = 2'),
            line('unchanged', 5, 5, 'tail')
          ]
        }
      ]
    }
    const plain = { ...DEFAULT_DIFF_VIEW, highlightWords: false }
    const shown = render({ patch: spaced, view: plain })
    const hidden = render({ patch: spaced, view: { ...plain, ignoreWhitespace: true } })

    // 켜기 전에는 공백 쌍도 제거/추가로 갈려 있다.
    expect(shown).toContain('const a=1')
    // 켜면 그 쌍만 문맥 한 줄로 접히고 **진짜 변경은 그대로** 남는다.
    expect(hidden).not.toContain('const a=1')
    expect(hidden).toContain('const a = 1')
    expect(hidden).toContain('const b = 1')
    expect(hidden).toContain('const b = 2')
  })
})

describe('패널 확대는 이미 있는 열 폭 축을 쓴다 (AT-52 · D-091)', () => {
  it('기본 폭이면 최대로, 최대면 기본으로 토글한다', () => {
    expect(nextDiffPanelWidth(PANEL_DEFAULT_WIDTH)).toBe(PANEL_MAX_WIDTH)
    expect(nextDiffPanelWidth(PANEL_MAX_WIDTH)).toBe(PANEL_DEFAULT_WIDTH)
  })

  it('폭이 아직 없으면 기본으로 보고 최대로 넓힌다', () => {
    expect(nextDiffPanelWidth(undefined)).toBe(PANEL_MAX_WIDTH)
  })

  it('최대보다 넓게 끌어둔 열도 기본으로 되돌린다 — 새 모드를 만들지 않는다', () => {
    expect(nextDiffPanelWidth(PANEL_MAX_WIDTH + 50)).toBe(PANEL_DEFAULT_WIDTH)
  })
})

describe('타일 registry — 헤더는 컨텍스트 바다', () => {
  it('diff 타일이 헤더 콘텐츠와 본문을 모두 해석한다', () => {
    const tile = tileById('diff')

    expect(tile.HeaderContent).toBeDefined()
    expect(tile.Content).toBeDefined()
  })
})
