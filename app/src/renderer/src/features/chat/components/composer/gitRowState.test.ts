import { describe, expect, it } from 'vitest'
import type { GitStatus } from '../../../../../../shared/ipc'
import { gitRowView, repoNameFromRoot, shouldRefetchGitStatus } from './gitRowState'

const repo = (over: Partial<GitStatus> = {}): GitStatus => ({
  isRepo: true,
  branch: 'main',
  detached: false,
  dirty: null,
  root: '/home/u/proj/orca-skin',
  ...over
})

describe('git 행 노출 판정 (AT-02·AT-03)', () => {
  it('랜딩(세션 미시작)이면 그리지 않는다 — 양성 짝: 세션이면 그린다', () => {
    expect(gitRowView(false, '/home/u/proj/orca-skin/app', repo())).toEqual({ visible: false })
    expect(gitRowView(true, '/home/u/proj/orca-skin/app', repo()).visible).toBe(true)
  })

  it('git 저장소가 아니면 그리지 않는다 — 자리도 잡지 않는다', () => {
    expect(gitRowView(true, '/tmp/plain', repo({ isRepo: false, root: null }))).toEqual({
      visible: false
    })
  })

  it('작업 경로가 없거나 아직 조회 전이면 그리지 않는다', () => {
    expect(gitRowView(true, null, repo())).toEqual({ visible: false })
    expect(gitRowView(true, '/repo', null)).toEqual({ visible: false })
  })
})

describe('저장소 이름은 git 루트에서 읽는다 (AT-09)', () => {
  it('cwd 가 하위 폴더여도 루트의 마지막 세그먼트다', () => {
    const view = gitRowView(true, '/home/u/proj/orca-skin/app', repo())
    expect(view.visible && view.repo).toBe('orca-skin')
  })

  it('Windows 구분자도 마지막 세그먼트를 준다', () => {
    expect(repoNameFromRoot('C:\\Users\\u\\proj\\orca-skin')).toBe('orca-skin')
  })

  it('루트를 못 받으면 이름만 비고 나머지는 산다 — 행이 통째로 사라지지 않는다', () => {
    const view = gitRowView(true, '/repo', repo({ root: null, branch: 'feat/x' }))
    expect(view).toEqual({
      visible: true,
      repo: null,
      branch: 'feat/x',
      detached: false,
      added: 0,
      removed: 0
    })
  })
})

describe('변경량 접기 (AT-06·AT-08)', () => {
  it('dirty 가 null 이면 0/0 이다 — 커밋 없음과 변경 없음을 구분하지 않는다', () => {
    const view = gitRowView(true, '/repo', repo({ dirty: null }))
    expect(view.visible && [view.added, view.removed]).toEqual([0, 0])
  })

  it('양성 짝 — dirty 가 있으면 그 수치를 그대로 읽는다', () => {
    const view = gitRowView(
      true,
      '/repo',
      repo({ dirty: { files: 2, insertions: 7, deletions: 2 } })
    )
    expect(view.visible && [view.added, view.removed]).toEqual([7, 2])
  })

  it('detached HEAD 는 브랜치 null 과 함께 detached=true 로 온다', () => {
    const view = gitRowView(true, '/repo', repo({ branch: null, detached: true }))
    expect(view.visible && view.detached).toBe(true)
    expect(view.visible && view.branch).toBeNull()
  })
})

describe('재조회 트리거 (AT-04)', () => {
  it('턴이 끝나는 전이에서만 참이다 — 나머지 3조합은 거짓', () => {
    expect(shouldRefetchGitStatus(true, false)).toBe(true)
    expect(shouldRefetchGitStatus(false, false)).toBe(false)
    expect(shouldRefetchGitStatus(false, true)).toBe(false)
    expect(shouldRefetchGitStatus(true, true)).toBe(false)
  })
})
