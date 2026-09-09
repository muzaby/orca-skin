import { describe, expect, it } from 'vitest'
import { rebaseUnderRoot } from './rebase-path'

// §10 EP-09 / VP-09 — 접두 판정의 경계 규칙. 세그먼트 단위로 보지 않으면 `/a/orca-x` 가
// `/a/orca` 하위로 잡혀 남의 경로를 건드린다.
describe('rebaseUnderRoot', () => {
  it('하위 경로의 접두를 새 루트로 바꾼다', () => {
    expect(
      rebaseUnderRoot(
        '/h/.config/orca/projects/default',
        '/h/.config/orca',
        '/h/.config/orcinus-orca'
      )
    ).toBe('/h/.config/orcinus-orca/projects/default')
  })

  it('루트 자신도 대상이다', () => {
    expect(rebaseUnderRoot('/h/.config/orca', '/h/.config/orca', '/h/.config/orcinus-orca')).toBe(
      '/h/.config/orcinus-orca'
    )
  })

  it('세그먼트 경계를 지킨다 — 형제 접두는 잡지 않는다', () => {
    expect(rebaseUnderRoot('/a/orca-x', '/a/orca', '/a/orcinus-orca')).toBeNull()
    expect(rebaseUnderRoot('/a/orcaX/y', '/a/orca', '/a/orcinus-orca')).toBeNull()
  })

  it('루트 밖 경로와 짧은 경로는 null', () => {
    expect(rebaseUnderRoot('/other/repo', '/h/.config/orca', '/h/.config/orcinus-orca')).toBeNull()
    expect(rebaseUnderRoot('/h', '/h/.config/orca', '/h/.config/orcinus-orca')).toBeNull()
  })

  it('Windows 구분자에서도 세그먼트로 비교하고 새 루트의 구분자로 잇는다', () => {
    expect(
      rebaseUnderRoot(
        'C:\\Users\\u\\.config\\orca\\worktrees\\repo-1a2b\\feat',
        'C:\\Users\\u\\.config\\orca',
        'C:\\Users\\u\\.config\\orcinus-orca'
      )
    ).toBe('C:\\Users\\u\\.config\\orcinus-orca\\worktrees\\repo-1a2b\\feat')
    expect(
      rebaseUnderRoot('C:\\Users\\u\\.config\\orca-x', 'C:\\Users\\u\\.config\\orca', 'C:\\n')
    ).toBeNull()
  })

  it('꼬리 슬래시는 흡수한다', () => {
    expect(rebaseUnderRoot('/h/orca/sub', '/h/orca/', '/h/new/')).toBe('/h/new/sub')
  })

  it('빈 문자열은 대상이 아니다 — 이관 루트가 미상일 때 전체 경로를 갈아엎지 않는다', () => {
    expect(rebaseUnderRoot('/h/x', '', '/n')).toBeNull()
    expect(rebaseUnderRoot('', '/h/orca', '/n')).toBeNull()
  })
})
