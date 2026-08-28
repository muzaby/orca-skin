import { describe, expect, it } from 'vitest'
import { parseWorktreeList } from './worktree'

describe('parseWorktreeList', () => {
  it('porcelain 목록의 branch와 detached worktree를 보존한다', () => {
    expect(
      parseWorktreeList(
        'worktree /repo\nHEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nbranch refs/heads/main\n\n' +
          'worktree /tmp/w\nHEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\ndetached\n'
      )
    ).toEqual([
      { path: '/repo', head: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', branch: 'main' },
      { path: '/tmp/w', head: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', branch: null }
    ])
  })
})
