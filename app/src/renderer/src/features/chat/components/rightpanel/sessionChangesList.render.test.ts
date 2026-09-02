import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GitDiffFileEntry, GitDiffSummary } from '../../../../../../shared/ipc'
import { SessionChangesList } from './SessionChangesList'
import { regionContains } from '../../../../shared/ui/htmlRegion.testlib'

const file = (path: string): GitDiffFileEntry => ({
  path,
  status: 'modified',
  added: 1,
  removed: 0,
  binary: false
})

const summary: GitDiffSummary = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'base-oid' },
  files: [file('session.ts'), file('shared.ts')],
  totals: { added: 3, removed: 1 },
  filesTruncated: false,
  commits: [
    {
      sha: 'commit-a',
      subject: 'Implement the session list',
      author: 'codex',
      committedAt: 0,
      body: 'Keep this real body.',
      files: [file('shared.ts'), file('more.ts')],
      filesTruncated: false,
      fileCount: 2,
      totals: { added: 2, removed: 1 }
    },
    {
      sha: 'fallback',
      subject: 'Fallback still has body',
      author: 'claude',
      committedAt: 0,
      body: 'Do not hide this.',
      files: [],
      filesTruncated: false,
      fileCount: null,
      totals: null
    }
  ],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: {
    files: [file('shared.ts')],
    totals: { added: 1, removed: 0 },
    filesTruncated: false
  }
}

describe('Session Changes SSR', () => {
  it('commit timeline 다음에 별도 uncommitted block을 두며 같은 path도 둘 다 보인다', () => {
    const html = renderToStaticMarkup(
      createElement(SessionChangesList, {
        summary,
        expandedCommitIds: new Set<string>(),
        onToggleCommit: () => undefined,
        onOpenPeek: () => undefined
      })
    )

    expect(html).toContain('data-session-changes-screen="list"')
    // 영역 주장은 **중첩**으로 잰다. 문서 순서만 보면 미커밋 블록을 commit timeline 컨테이너
    // 안으로 옮긴 변이(= 명세 §7 이 금지한 "timeline 의 새 node")가 그대로 통과한다.
    expect(regionContains(html, 'data-session-timeline', 'data-session-commit="commit-a"')).toBe(
      true
    )
    expect(regionContains(html, 'data-session-timeline', 'data-session-uncommitted')).toBe(false)
    expect(html.indexOf('data-session-timeline')).toBeLessThan(
      html.indexOf('data-session-uncommitted')
    )
    expect(html).toContain('Keep this real body.')
    expect(html).toContain('Fallback still has body')
    expect((html.match(/data-session-change-file="shared.ts"/g) ?? []).length).toBe(2)
  })

  it('AT-28 — 상단 요약이 여섯 값을 말하고, 기준선을 모르면 sha 자리에 HEAD 문구가 선다', () => {
    const render = (value: GitDiffSummary): string =>
      renderToStaticMarkup(
        createElement(SessionChangesList, {
          summary: value,
          expandedCommitIds: new Set<string>(),
          onToggleCommit: () => undefined,
          onOpenPeek: () => undefined
        })
      )

    const html = render(summary)
    expect(html).toContain('base-oi') // ① 기준선 7자
    expect(html).toContain('+3') // ② 합계 added
    expect(html).toContain('−1') // ②' 합계 removed
    expect(html).toContain('추적 파일 2개') // ③ 추적 파일 수
    expect(html).toContain('미추적 제외') // ④ 미추적 제외
    expect(html).toContain('커밋 2개') // ⑤ 커밋 수
    expect(html).toContain('미커밋 1개') // ⑥ 미커밋 파일 수

    // 기준선을 모르는 요약(레거시 세션)은 sha 자리에 sha 를 쓰지 않는다 — 그 sha 가 이
    // 세션의 출발점인 것처럼 읽힌다.
    const headHtml = render({ ...summary, base: { kind: 'head', oid: 'deadbee1234' } })
    expect(headHtml).toContain('현재 HEAD')
    expect(headHtml).not.toContain('deadbee')
  })

  it('fallback null metadata는 0으로 그리지 않고 unavailable 상태를 낸다', () => {
    const html = renderToStaticMarkup(
      createElement(SessionChangesList, {
        summary,
        expandedCommitIds: new Set<string>(),
        onToggleCommit: () => undefined,
        onOpenPeek: () => undefined
      })
    )

    expect(html).toContain('변경 파일 정보 없음')
    expect(html).not.toContain('Fallback still has body</span><span class="text-caption')
  })

  it('AT-26 — 8-file commit은 최초 2행과 +6 control만 보이고 확장 뒤에는 8행과 collapse control을 보인다', () => {
    const files = Array.from({ length: 8 }, (_, index) => file(`src/f${index}.ts`))
    const eightSummary: GitDiffSummary = {
      ...summary,
      commits: [{ ...summary.commits[0], files, fileCount: 8, filesTruncated: false }]
    }
    const collapsed = renderToStaticMarkup(
      createElement(SessionChangesList, {
        summary: eightSummary,
        expandedCommitIds: new Set<string>(),
        onToggleCommit: () => undefined,
        onOpenPeek: () => undefined
      })
    )
    const expanded = renderToStaticMarkup(
      createElement(SessionChangesList, {
        summary: eightSummary,
        expandedCommitIds: new Set(['commit-a']),
        onToggleCommit: () => undefined,
        onOpenPeek: () => undefined
      })
    )

    expect(collapsed).toContain('src/f0.ts')
    expect(collapsed).toContain('src/f1.ts')
    expect(collapsed).not.toContain('src/f2.ts')
    expect(collapsed).toContain('+6개 파일 더')
    expect(expanded).toContain('src/f7.ts')
    expect(expanded).toContain('파일 접기')
    expect(expanded).not.toContain('+6개 파일 더')
  })

  it('AT-26 — 51-file fallback은 최대 50 loaded rows까지만 확장하고 남은 1행 fetch를 암시하지 않는다', () => {
    const files = Array.from({ length: 50 }, (_, index) => file(`src/f${index}.ts`))
    const cappedSummary: GitDiffSummary = {
      ...summary,
      commits: [{ ...summary.commits[0], files, fileCount: 51, filesTruncated: true }]
    }
    const collapsed = renderToStaticMarkup(
      createElement(SessionChangesList, {
        summary: cappedSummary,
        expandedCommitIds: new Set<string>(),
        onToggleCommit: () => undefined,
        onOpenPeek: () => undefined
      })
    )
    const expanded = renderToStaticMarkup(
      createElement(SessionChangesList, {
        summary: cappedSummary,
        expandedCommitIds: new Set(['commit-a']),
        onToggleCommit: () => undefined,
        onOpenPeek: () => undefined
      })
    )

    expect(collapsed).toContain('+48개 파일 더')
    expect(expanded).toContain('src/f49.ts')
    expect(expanded).toContain('일부만 표시')
    expect(expanded).not.toContain('+1개 파일 더')
  })

  it('top-level cap/unavailable flags는 per-commit notice와 다른 명시 label로 보인다', () => {
    const flaggedSummary: GitDiffSummary = {
      ...summary,
      filesTruncated: true,
      commits: [{ ...summary.commits[0], filesTruncated: false }],
      commitsTruncated: true,
      commitFilesUnavailable: true,
      uncommitted: { ...summary.uncommitted, filesTruncated: false }
    }
    const html = renderToStaticMarkup(
      createElement(SessionChangesList, {
        summary: flaggedSummary,
        expandedCommitIds: new Set<string>(),
        onToggleCommit: () => undefined,
        onOpenPeek: () => undefined
      })
    )

    expect(html).toContain('세션 파일 목록 제한됨')
    expect(html).toContain('세션 커밋 목록 제한됨')
    expect(html).toContain('커밋별 파일 정보를 가져오지 못함')
    expect(html).not.toContain('변경 파일 정보 없음')
    expect(html).not.toContain('일부만 표시')
  })
})
