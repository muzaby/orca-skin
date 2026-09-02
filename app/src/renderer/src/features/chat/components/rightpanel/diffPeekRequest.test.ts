import { describe, expect, it } from 'vitest'
import { diffPeekFileRequest } from './diffFileCache'

describe('Diff Peek file request', () => {
  it('commit에서 들어와도 Task-2 session-wide contract만 보내고 commit argument는 보내지 않는다', () => {
    const request = diffPeekFileRequest('/repo', 'session-a', {
      group: { kind: 'commit', sha: 'commit-a' },
      path: 'src/a.ts'
    })

    expect(request).toEqual({ cwd: '/repo', sessionId: 'session-a', path: 'src/a.ts' })
    expect(request).not.toHaveProperty('commit')
  })

  // AT-29 의 핵심. `commit` 멤버 0건이라는 타입 스윕은 "두 진입이 **같은 값**을 보낸다" 를
  // 말하지 못한다 — 한쪽 진입에만 다른 범위를 주는 변이가 단일 진입 단언을 그대로 통과한다.
  it('AT-29 — 커밋 진입과 미커밋 진입이 같은 파일에서 깊게 동등한 요청을 만든다', () => {
    const fromCommit = diffPeekFileRequest('/repo', 'session-a', {
      group: { kind: 'commit', sha: 'commit-a' },
      path: 'src/a.ts'
    })
    const fromUncommitted = diffPeekFileRequest('/repo', 'session-a', {
      group: { kind: 'uncommitted' },
      path: 'src/a.ts'
    })

    expect(fromUncommitted).toEqual(fromCommit)
    expect(Object.keys(fromUncommitted).sort()).toEqual(['cwd', 'path', 'sessionId'])
  })

  it('AT-29 — 세션 이전(랜딩) 진입도 두 group 이 같은 요청을 만든다', () => {
    const fromCommit = diffPeekFileRequest('/repo', null, {
      group: { kind: 'commit', sha: 'commit-a' },
      path: 'src/a.ts'
    })
    const fromUncommitted = diffPeekFileRequest('/repo', null, {
      group: { kind: 'uncommitted' },
      path: 'src/a.ts'
    })

    expect(fromUncommitted).toEqual(fromCommit)
    expect(fromUncommitted).not.toHaveProperty('sessionId')
  })
})
