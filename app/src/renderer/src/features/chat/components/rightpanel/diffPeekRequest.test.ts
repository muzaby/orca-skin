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
})
