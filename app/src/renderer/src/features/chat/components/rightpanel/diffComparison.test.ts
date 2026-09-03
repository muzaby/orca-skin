// 0211 ΔV4 — 비교 범위 필터 (VP-57 · AT-49).
//
// 이 모듈의 계약은 하나다: **목록만 좁힌다**. 파일 줄은 언제나 세션 패치의 것이라, 커밋을 골라도
// 그 파일의 diff 는 baseline → 현재 그대로다(D-036·D-079).

import { describe, expect, it } from 'vitest'
import type { GitDiffFileEntry, GitDiffPatch, GitDiffSummary } from '../../../../../../shared/ipc'
import { ALL_CHANGES, diffSections, reconcileComparison } from './diffComparison'

const patch: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'base', ref: 'main' },
  files: [
    { path: 'a.ts', status: 'modified', added: 2, removed: 1, kind: 'text', lines: [] },
    { path: 'b.ts', status: 'added', added: 5, removed: 0, kind: 'text', lines: [] }
  ],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}

const entry = (path: string, added: number, removed: number): GitDiffFileEntry => ({
  path,
  status: 'modified',
  added,
  removed,
  binary: false
})

const summary: GitDiffSummary = {
  isRepo: true,
  base: patch.base,
  files: [entry('a.ts', 2, 1), entry('b.ts', 5, 0)],
  totals: { added: 7, removed: 1 },
  filesTruncated: false,
  commits: [
    {
      sha: 'c1',
      subject: 'first',
      author: 'x',
      committedAt: 0,
      files: [entry('a.ts', 2, 1), entry('reverted.ts', 4, 4)],
      filesTruncated: false,
      fileCount: 2,
      totals: { added: 6, removed: 5 }
    }
  ],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: {
    files: [entry('b.ts', 5, 0)],
    totals: { added: 5, removed: 0 },
    filesTruncated: false
  }
}

describe('diffSections', () => {
  it('전체 모드는 패치 순서 그대로다', () => {
    expect(diffSections(patch, summary, ALL_CHANGES).map((s) => s.path)).toEqual(['a.ts', 'b.ts'])
  })

  it('커밋 모드는 목록만 좁히고 같은 파일의 patch 참조는 그대로다', () => {
    const all = diffSections(patch, summary, ALL_CHANGES)
    const scoped = diffSections(patch, summary, { kind: 'commit', sha: 'c1' })

    expect(scoped.map((s) => s.path)).toEqual(['a.ts', 'reverted.ts'])
    // **같은 객체**다 — 커밋 범위로 다시 계산한 diff 가 아니다.
    expect(scoped[0].patch).toBe(all[0].patch)
  })

  it('세션 패치에 없는 커밋 파일은 patch=null 이고 그 커밋의 변경량을 쓴다 (D-080)', () => {
    const scoped = diffSections(patch, summary, { kind: 'commit', sha: 'c1' })

    expect(scoped[1]).toMatchObject({ path: 'reverted.ts', patch: null, added: 4, removed: 4 })
  })

  // 0211 ΔV5 D-107 — 미커밋 모드가 사라졌다. 미커밋 파일은 전체 목록에 계속 섞여 나온다.
  it('전체 모드가 미커밋 파일도 함께 담는다', () => {
    expect(diffSections(patch, summary, ALL_CHANGES).map((s) => s.path)).toContain('b.ts')
  })

  it('패치가 없으면 빈 목록이다 — 요약만으로 화면을 만들지 않는다', () => {
    expect(diffSections(null, summary, ALL_CHANGES)).toEqual([])
  })
})

describe('reconcileComparison', () => {
  it('고른 커밋이 새 요약에 없으면 전체로 접는다', () => {
    expect(reconcileComparison({ kind: 'commit', sha: 'gone' }, summary)).toEqual(ALL_CHANGES)
  })

  it('살아 있는 커밋은 그대로 유지한다', () => {
    const kept = { kind: 'commit' as const, sha: 'c1' }
    expect(reconcileComparison(kept, summary)).toBe(kept)
  })

  it('전체는 요약과 무관하게 유지한다', () => {
    expect(reconcileComparison(ALL_CHANGES, null)).toBe(ALL_CHANGES)
  })
})
