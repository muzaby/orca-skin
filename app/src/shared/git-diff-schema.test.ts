// 0211 — diff 요청 스키마의 **경로·sha 문자셋 게이트**.
//
// 통과한 문자열은 `git show <base>:<path>` 인자와 작업 트리 파일 읽기 **두 곳**으로 그대로
// 간다. 그래서 형태에서 막는다: 절대경로·`..` 상승·비 16진 sha 는 여기서 끝난다.
// `GitBranchNameSchema` 가 checkout 에 하는 일과 같은 축이다.

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

describe('commit sha 게이트', () => {
  const commit = (value: string): { success: boolean } =>
    GitDiffRequestSchema.safeParse({ cwd: '/repo', commit: value })

  it('16진 sha 는 통과한다 — 축약형 포함', () => {
    expect(commit('a1b2c3d').success).toBe(true)
    expect(commit('a'.repeat(40)).success).toBe(true)
  })

  it('옵션처럼 보이는 값을 막는다 — execFile 인자로 나가는 자리다', () => {
    expect(commit('--upload-pack=evil').success).toBe(false)
    expect(commit('-n').success).toBe(false)
    expect(commit('HEAD~1').success).toBe(false)
    expect(commit('main').success).toBe(false)
  })

  it('생략하면 전체 변경이다', () => {
    expect(GitDiffRequestSchema.safeParse({ cwd: '/repo' }).success).toBe(true)
  })
})
