import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GitDiffPatchRequestSchema, GitDiffRequestSchema } from './protocol'

describe('diff 요청의 비교 범위', () => {
  it('전체 요청은 SHA 없이 유효하고 요약은 commitSha를 받지 않는다', () => {
    expect(GitDiffPatchRequestSchema.parse({ cwd: '/repo' })).toEqual({ cwd: '/repo' })
    expect(GitDiffRequestSchema.parse({ cwd: '/repo', commitSha: 'a'.repeat(40) })).toEqual({
      cwd: '/repo'
    })
  })
  it('선택 커밋의 완전한 SHA만 patch 요청으로 전달한다', () => {
    const request = { cwd: '/repo', sessionId: 's1', commitSha: 'a'.repeat(40) }
    expect(GitDiffPatchRequestSchema.parse(request)).toEqual(request)
  })
  it.each(['', 'HEAD', 'HEAD~1', '--output=evil', 'abc1234', 'g'.repeat(40)])(
    '잘못된 commitSha %s를 거부한다',
    (commitSha) => {
      expect(GitDiffPatchRequestSchema.safeParse({ cwd: '/repo', commitSha }).success).toBe(false)
    }
  )

  it('IPC 문서는 세션 전체 범위와 commit 파일 availability를 설명한다', () => {
    const document = readFileSync(
      fileURLToPath(new URL('../../../docs/IPC_CONTRACT.md', import.meta.url)),
      'utf8'
    )
    const section = document.slice(document.indexOf('| `orca:git:diffSummary`'))

    expect(section).not.toContain('commit?: string')
    expect(section).not.toContain('ls-files --others')
    expect(section).toContain('commitFilesUnavailable')
    expect(section).toContain('uncommitted')
    // 0211 ΔV4 — 본문 채널이 패치 채널로 바뀐 것이 문서에도 남아야 한다(§10 EP-30).
    expect(document).toContain('`orca:git:diffPatch`')
    expect(document).not.toContain('`orca:git:diffFile`')
  })
})
