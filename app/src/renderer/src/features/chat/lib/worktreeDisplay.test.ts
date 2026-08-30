// 0211 VP-04 · VP-06 · VP-07 — 표시 이름의 **자리**를 잠근다.
//
// 이 불변식은 "이름은 원본에서, 동작·조회는 실행 경로에서" 라 자리를 말한다. 그래서 지우는
// 변이만으로는 부족하다 — 두 값을 **맞바꾸는** 변이도 red 여야 한다(plan §5 방향 규칙).
// 아래 단언은 격리 경로와 원본 경로가 **서로 다른 basename** 을 갖도록 fixture 를 골라
// `sourceCwd` 대신 `cwd` 를 읽는 회귀가 통과할 수 없게 한다.

import { describe, expect, it } from 'vitest'
import { cwdDisplayName, repoDisplayName } from './worktreeDisplay'

// 0210 D-104 의 실제 경로 형태 — `<repo>-<hash8>/<브랜치 slug>`.
const WORKTREE_ROOT = '/home/u/.config/orca/worktrees/orca-skin-1a2b3c4d/work-list-filter'
const SOURCE_REPO = '/home/u/proj/orca-skin'

describe('작업 경로 버튼 라벨 (VP-04)', () => {
  it('저장소 루트를 고른 세션은 원본 저장소 이름을 그린다 — 브랜치 slug 가 아니다', () => {
    expect(cwdDisplayName(WORKTREE_ROOT, { sourceCwd: SOURCE_REPO, repoRoot: SOURCE_REPO })).toBe(
      'orca-skin'
    )
    // 맞바꿈 방어: 실행 경로에서 파생하면 이 값이 나온다.
    expect(cwdDisplayName(WORKTREE_ROOT, null)).toBe('work-list-filter')
  })

  it('하위 폴더를 고른 세션은 그 폴더 이름을 그린다', () => {
    expect(
      cwdDisplayName(`${WORKTREE_ROOT}/app`, {
        sourceCwd: `${SOURCE_REPO}/app`,
        repoRoot: SOURCE_REPO
      })
    ).toBe('app')
  })

  it('row 가 없으면 실행 경로 파생으로 폴백한다 — 0210 폴백 후 그 경로가 곧 원본이다', () => {
    expect(cwdDisplayName(SOURCE_REPO, null)).toBe('orca-skin')
    expect(cwdDisplayName(SOURCE_REPO, undefined)).toBe('orca-skin')
  })

  it('cwd 가 없으면 기본 문구로 접힌다 — 라벨 자리가 비지 않는다', () => {
    expect(cwdDisplayName(null, null)).toBe('default')
  })
})

describe('git 행 저장소 이름 (VP-06)', () => {
  it('worktree 루트가 아니라 원본 저장소 루트를 읽는다', () => {
    expect(repoDisplayName(WORKTREE_ROOT, { sourceCwd: SOURCE_REPO, repoRoot: SOURCE_REPO })).toBe(
      'orca-skin'
    )
    // 맞바꿈 방어: `--show-toplevel` 이 준 worktree 루트를 그대로 쓰면 이 값이 나온다.
    expect(repoDisplayName(WORKTREE_ROOT, null)).toBe('work-list-filter')
  })

  it('Windows 구분자도 마지막 세그먼트를 준다 — 값의 출처가 어디든 계약은 하나다', () => {
    expect(repoDisplayName('C:\\proj\\orca-skin', null)).toBe('orca-skin')
  })

  it('루트를 못 받았으면 null 이다 — 이름 자리만 비고 나머지는 산다(0206 승계)', () => {
    expect(repoDisplayName(null, null)).toBeNull()
  })
})
