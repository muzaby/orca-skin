// 0211 — diff 요청 스키마의 **경로·sha 문자셋 게이트**.
//
// 통과한 문자열은 `git show <base>:<path>` 인자와 작업 트리 파일 읽기 **두 곳**으로 그대로
// 간다. 그래서 형태에서 막는다: 절대경로·`..` 상승·비 16진 sha 는 여기서 끝난다.
// `GitBranchNameSchema` 가 checkout 에 하는 일과 같은 축이다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GitDiffFileRequestSchema, GitDiffRequestSchema } from './protocol'

const file = (path: string): { success: boolean } =>
  GitDiffFileRequestSchema.safeParse({ cwd: '/repo', path })

describe('diff 파일 경로 게이트', () => {
  it('저장소 상대 경로는 통과한다 — git 이 주는 형태 그대로', () => {
    expect(file('src/main/a.ts').success).toBe(true)
    expect(file('docs/한글 문서.md').success).toBe(true)
  })

  it('절대 경로를 막는다 — POSIX 와 Windows 드라이브 둘 다', () => {
    expect(file('/etc/passwd').success).toBe(false)
    expect(file('C:\\Windows\\System32\\config').success).toBe(false)
  })

  it('상위 경로 참조를 막는다 — 두 구분자 모두에서', () => {
    expect(file('../../../etc/passwd').success).toBe(false)
    expect(file('src/../../secret').success).toBe(false)
    expect(file('src\\..\\..\\secret').success).toBe(false)
  })

  it('이름 안의 점 두 개는 상승이 아니다 — 세그먼트 단위로 본다', () => {
    expect(file('src/a..b.ts').success).toBe(true)
    expect(file('src/..hidden/x.ts').success).toBe(true)
  })

  it('빈 경로를 막는다', () => {
    expect(file('').success).toBe(false)
  })
})

describe('diff 요청은 세션 범위 하나만 허용한다', () => {
  it('commit 필드를 입력해도 파싱된 요청에 노출하지 않는다', () => {
    const parsed = GitDiffRequestSchema.parse({ cwd: '/repo', sessionId: 's1', commit: 'a1b2c3d' })
    expect(parsed).toEqual({ cwd: '/repo', sessionId: 's1' })

    const fileParsed = GitDiffFileRequestSchema.parse({
      cwd: '/repo',
      sessionId: 's1',
      path: 'src/a.ts',
      commit: 'a1b2c3d'
    })
    expect(fileParsed).toEqual({ cwd: '/repo', sessionId: 's1', path: 'src/a.ts' })
  })

  it('production 호출부에는 commit 전용 range 분기가 없다', () => {
    const sources = [
      '../main/app/handlers/git.ts',
      '../main/infra/git/git-diff.ts',
      '../renderer/src/features/chat/components/composer/useGitSnapshot.ts',
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
    expect(section).toContain('같은 세션 baseline')
  })
})
