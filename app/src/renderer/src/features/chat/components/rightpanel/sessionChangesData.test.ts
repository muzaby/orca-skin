import { describe, expect, it } from 'vitest'
import type { GitDiffCommit, GitDiffFileEntry, GitDiffSummary } from '../../../../../../shared/ipc'
import {
  commitDisplayMeta,
  commitFileRows,
  sessionChangeGroups,
  summaryBaseLabel,
  summaryBaseText,
  summaryNoticeKeys
} from './sessionChangesData'

const file = (path: string): GitDiffFileEntry => ({
  path,
  status: 'modified',
  added: 1,
  removed: 0,
  binary: false
})

const commit = (overrides: Partial<GitDiffCommit> = {}): GitDiffCommit => ({
  sha: 'commit-a',
  subject: 'implement session changes',
  author: 'codex',
  committedAt: 0,
  body: 'Retain the detail users wrote.',
  files: [file('shared.ts')],
  filesTruncated: true,
  fileCount: 3,
  totals: { added: 2, removed: 1 },
  ...overrides
})

const summary = (commits: GitDiffCommit[]): GitDiffSummary => ({
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'base-oid' },
  files: [file('session.ts')],
  totals: { added: 3, removed: 1 },
  filesTruncated: false,
  commits,
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: {
    files: [file('shared.ts')],
    totals: { added: 1, removed: 0 },
    filesTruncated: false
  }
})

describe('session changes data', () => {
  // AT-28 — 기준선 자리는 **세 종류**를 구분한다. `head` 는 "세션 기준선을 모른다" 이고,
  // 그 자리에 sha 를 쓰면 그 sha 가 이 세션의 출발점인 것처럼 읽힌다.
  it('AT-28 — base 3종이 각각 다른 헤더 값을 낸다', () => {
    const oidSummary = summary([])
    const headSummary: GitDiffSummary = {
      ...oidSummary,
      base: { kind: 'head', oid: 'headoid1234' }
    }
    const noneSummary: GitDiffSummary = { ...oidSummary, base: { kind: 'none' } }

    expect(summaryBaseLabel(oidSummary)).toEqual({ kind: 'oid', oid: 'base-oi' })
    expect(summaryBaseLabel(headSummary)).toEqual({ kind: 'head' })
    expect(summaryBaseLabel(noneSummary)).toEqual({ kind: 'none' })

    const tr = ((key: string) => `tr:${key}`) as Parameters<typeof summaryBaseText>[1]
    expect(summaryBaseText(oidSummary, tr)).toBe('base-oi')
    // sha 자리가 sha 가 **아니어야** 한다 — 문구 키로 간다.
    expect(summaryBaseText(headSummary, tr)).toBe('tr:chat.rightpanel.diffBaselineHead')
    expect(summaryBaseText(headSummary, tr)).not.toContain('headoid')
    expect(summaryBaseText(noneSummary, tr)).toBe('∅')
  })

  it('commit과 uncommitted는 같은 path여도 별도 group으로 유지한다', () => {
    const groups = sessionChangeGroups(summary([commit()]))

    expect(groups).toEqual([
      expect.objectContaining({
        group: { kind: 'commit', sha: 'commit-a' },
        files: [file('shared.ts')]
      }),
      expect.objectContaining({ group: { kind: 'uncommitted' }, files: [file('shared.ts')] })
    ])
  })

  it('commit fallback metadata의 null은 0으로 바꾸지 않고 unavailable로 표시한다', () => {
    expect(commitDisplayMeta(commit({ fileCount: null, totals: null }))).toEqual({
      kind: 'unavailable'
    })
    expect(commitDisplayMeta(commit({ fileCount: 0, totals: { added: 0, removed: 0 } }))).toEqual({
      kind: 'available',
      fileCount: 0,
      totals: { added: 0, removed: 0 },
      remainingFileCount: 0
    })
  })

  it('AT-26 — 8-file commit은 처음 2행만 보이고 로컬 확장 뒤 8행을 모두 보인다', () => {
    const eight = commit({
      files: Array.from({ length: 8 }, (_, index) => file(`f${index}.ts`)),
      filesTruncated: false,
      fileCount: 8
    })

    expect(commitFileRows(eight, false)).toMatchObject({
      loadedFiles: [file('f0.ts'), file('f1.ts')],
      moreLoadedCount: 6,
      partial: false
    })
    expect(commitFileRows(eight, true)).toMatchObject({
      loadedFiles: eight.files,
      moreLoadedCount: 0,
      partial: false
    })
  })

  it('AT-26 — 51-file fallback은 50 loaded rows까지만 확장하고 51번째를 더 가져올 수 있는 것처럼 보이지 않는다', () => {
    const capped = commit({
      files: Array.from({ length: 50 }, (_, index) => file(`f${index}.ts`)),
      filesTruncated: true,
      fileCount: 51
    })

    expect(commitFileRows(capped, false)).toMatchObject({
      loadedFiles: capped.files.slice(0, 2),
      moreLoadedCount: 48,
      partial: true
    })
    expect(commitFileRows(capped, true)).toMatchObject({
      loadedFiles: capped.files,
      moreLoadedCount: 0,
      partial: true
    })
  })

  it('top-level summary cap/unavailable flags를 별도 notice key로 낸다', () => {
    expect(summaryNoticeKeys({ ...summary([]), filesTruncated: true })).toEqual([
      'chat.rightpanel.diffSessionFilesTruncated'
    ])
    expect(summaryNoticeKeys({ ...summary([]), commitsTruncated: true })).toEqual([
      'chat.rightpanel.diffSessionCommitsTruncated'
    ])
    expect(summaryNoticeKeys({ ...summary([]), commitFilesUnavailable: true })).toEqual([
      'chat.rightpanel.diffSessionCommitFilesUnavailable'
    ])
  })
})
