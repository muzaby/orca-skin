// 0211 — diff 요청 스키마의 **경로·sha 문자셋 게이트**.
//
// 0211 ΔV4 — 본문 채널이 사라져 경로 인자가 없어졌다. 남은 게이트는 **범위 인자 하나**다:
// 요청에 commit 이 실리지 않는다(D-036·D-079). 경로는 이제 main 이 파싱한 패치가 만들고
// renderer 가 보내지 않으므로 스키마 표면이 아니다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GitDiffPatchRequestSchema, GitDiffRequestSchema } from './protocol'

describe('diff 요청은 세션 범위 하나만 허용한다', () => {
  it('commit 필드를 입력해도 파싱된 요청에 노출하지 않는다 — 요약도 패치도', () => {
    const parsed = GitDiffRequestSchema.parse({ cwd: '/repo', sessionId: 's1', commit: 'a1b2c3d' })
    expect(parsed).toEqual({ cwd: '/repo', sessionId: 's1' })

    const patchParsed = GitDiffPatchRequestSchema.parse({
      cwd: '/repo',
      sessionId: 's1',
      commit: 'a1b2c3d'
    })
    expect(patchParsed).toEqual({ cwd: '/repo', sessionId: 's1' })
  })

  it('production 호출부에는 commit 전용 range 분기가 없다', () => {
    const sources = [
      '../main/app/handlers/git.ts',
      '../main/infra/git/git-diff.ts',
      '../renderer/src/features/chat/components/composer/useGitSnapshot.ts',
      '../renderer/src/features/chat/hooks/useGitPatch.ts',
      '../renderer/src/features/chat/components/rightpanel/DiffTileContent.tsx'
    ].map((path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'))

    for (const source of sources) {
      expect(source).not.toMatch(/req\.commit\b/)
      expect(source).not.toMatch(/commit:\s*(?:req|selectedCommit)\b/)
    }
  })

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
